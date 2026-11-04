/*! Smart Dictation Player — speech & audio pipeline (v0.0.3)
 * Strict ES5, dependency free.
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 audio priority chain
 * Dictionary audio always plays through a plain <audio> element; element audio
 * is never routed through Web Audio, which is what used to silence Youdao MP3s
 * on cross-origin responses. */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  var doc = global.document;

  function noop() {}
  function str(v) { return v === null || v === undefined ? '' : String(v); }
  function isObj(v) { return !!v && typeof v === 'object'; }
  function nowMs() { return Date.now(); }

  function settings() {
    try { return SDP.Data ? SDP.Data.settings() : { rate: 0.95, volume: 1, repeats: 3, pauseSecs: 1.5, voiceSource: 'auto' }; }
    catch (e) { return { rate: 0.95, volume: 1, repeats: 3, pauseSecs: 1.5, voiceSource: 'auto' }; }
  }
  function sync() { return SDP.Sync || null; }

  /* ══ utterance text normaliser ═════════════════════════════════════════ */
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 — say() normalises first */
  function normalizeInput(input) {
    return Array.isArray(input) ? input.slice() : [String(input == null ? '' : input)];
  }

  var state = {
    manifest: null,
    manifestRequested: false,
    manifestRetryBound: false,
    lastTier: '',
    lastUtterances: [],
    speaking: false,
    queueId: 0,
    speechEpoch: 0,
    audioEl: null,
    /* D11: the REAL onstart flag. It is set only inside utter.onstart — never
       by the synchronous state.speaking bookkeeping — so the watchdogs can
       tell a genuinely speaking engine from a silently dropped utterance. */
    utterStarted: false,
    audioPlaying: false,
    /* VOX-01: the live utterance and queue live at MODULE scope. v0.0.1.c kept
       `var utter` inside next(), so Chrome's GC could collect the utterance
       mid-sentence and onend never fired — the queue froze for 30+ seconds. */
    activeUtter: null,
    activeQueue: null,
    activeIndex: 0,
    /* VOX-06: every concurrent selectProfessorVoice() caller waits here. */
    voiceWaiters: [],
    voiceResolved: false,
    /* VOX-03: the 10 s speechSynthesis.resume() keepalive. */
    keepAlive: null,
    /* VOX-09: Chrome drops a speak() issued in the same tick as cancel(). */
    lastCancelAt: 0,
    /* R1 (F1): every live timer is named so stopAll() can kill it. A timer
       that outlives a pause is exactly how "Afraid." spoke after Stop. */
    wordWatchTimer: null,
    guardTimer: null,
    urlTimer: null,
    /* R6 (F9): the persona is pinned once per Engine.start(), never swapped
       mid-session when Android re-announces voiceschanged. */
    sessionVoice: null,
    voiceDirty: false
  };

  /* D10/D12: one honest read of the platform voice list. Brave desktop and
     locked-down kiosks expose zero voices; every watchdog keys off this. */
  function getVoicesSafe() {
    try {
      var synth = global.speechSynthesis;
      if (!synth || typeof synth.getVoices !== 'function') return [];
      return synth.getVoices() || [];
    } catch (e) { return []; }
  }

  /* ── shared <audio> element: same element, many sources, clean replay ── */
  function sharedAudio() {
    if (state.audioEl) return state.audioEl;
    var el = doc && doc.getElementById ? doc.getElementById('sdpSharedAudio') : null;
    if (!el && doc && doc.createElement) {
      el = doc.createElement('audio');
      el.id = 'sdpSharedAudio';
      el.preload = 'auto';
      el.setAttribute('playsinline', 'playsinline');
      /* E1: never set crossOrigin on <audio>. dict.youdao.com sends no
         Access-Control-Allow-Origin, so crossorigin='anonymous' blocked
         every one of the 30 dictionary clips. Plain element audio only. */
      if (doc.body) doc.body.appendChild(el);
    }
    state.audioEl = el;
    return el;
  }

  function stopKeepAlive() {
    if (state.keepAlive) {
      try { global.clearInterval(state.keepAlive); } catch (e) {}
      state.keepAlive = null;
    }
    return false;
  }
  /* VOX-03: desktop Chrome pauses speechSynthesis after ~15 s of continuous
     narration; a 10 s resume() tick keeps a long guide or session audible. */
  function startKeepAlive() {
    if (state.keepAlive) return true;
    state.keepAlive = global.setInterval(function () {
      try {
        var synth = global.speechSynthesis;
        if (!synth) { stopKeepAlive(); return; }
        if (synth.speaking || state.activeUtter) synth.resume();
        else if (!state.speaking) stopKeepAlive();
      } catch (e) { stopKeepAlive(); }
    }, 10000);
    return true;
  }
  /* E5: every async chain gets an epoch. stopAll() bumps it so any in-flight
   * timer, watchdog, onend or <audio> handler from a dead chain is ignored.
   * Hard screen guard: no speech or <audio> act while a screen is covered
   * (document hidden, the guide modal open, or the lecturer lock gate up).
   */
  /* E5 hard screen guard — no speech or <audio> acts while the page is
     hidden or the lecturer lock gate covers the cockpit. The guide modal is
     not a cover: guide narration happens inside it. */
  function screenIsCovered() {
    try { if (doc && doc.hidden === true) return true; } catch (e) { return true; }
    var g = doc && doc.getElementById ? doc.getElementById('studioGate') : null;
    var studioScreen = doc && doc.getElementById ? doc.getElementById('screen-studio') : null;
    if (g && !g.hidden && studioScreen && studioScreen.classList && studioScreen.classList.contains('active')) return true;
    return false;
  }
  function stopAll() {
    state.queueId += 1;
    state.speechEpoch += 1;
    state.speaking = false;
    state.utterStarted = false;
    state.activeUtter = null;
    state.activeQueue = null;
    state.activeIndex = 0;
    state.audioPlaying = false;
    state.lastCancelAt = nowMs();
    /* R1 Path C: every named timer dies with the queue. A watchdog that fires
       after Stop is a second voice the student never asked for. */
    var names = ['wordWatchTimer', 'guardTimer', 'urlTimer'];
    for (var t = 0; t < names.length; t++) {
      if (state[names[t]]) {
        try { global.clearTimeout(state[names[t]]); } catch (e) {}
        state[names[t]] = null;
      }
    }
    stopKeepAlive();
    try { if (global.speechSynthesis) global.speechSynthesis.cancel(); } catch (e) {}
    var el = state.audioEl || (doc && doc.getElementById ? doc.getElementById('sdpSharedAudio') : null);
    if (el) {
      /* R1 Path C: an <audio> handler that survives Stop can re-enter the
         ladder and speak the next word into a paused cockpit. */
      el.onended = null;
      el.onerror = null;
      try { el.pause(); el.removeAttribute('src'); el.load(); } catch (e) {}
    }
  }

  /* ── E2: deterministic Professor Voice scoring (Table D) ──────────────── */
  /* Tier 1 (+100): en-GB + Google UK English Female / Microsoft Sonia, Libby,
   * Maisie / Apple Serena, Kate, Martha / Alice.
   * Tier 2 (+60): en-GB/en-AU/en-NZ + female token in name or voiceURI.
   * Tier 3 (+30): any en-* + female token.
   * Tie-breaker: localService === false first, then lowest array index.
   * A voice with score <= 0 is never chosen while a scored voice exists.
   */
  /* D-V3: a male voice must never win, even as the last-resort fallback
   * (Windows/Android expose "Microsoft David" as the default en-US voice).
   * -100 is a hard veto: pickBestVoice() can only return it when no other
   * voice exists at all, and resolveOnce() rejects any score <= 0. */
  var MALE_VOICE_RE = /\b(david|mark|george|daniel|fred|james|richard|oliver|thomas|male|man|guy)\b/i;
  function scoreVoice(v) {
    if (!v || !v.lang) return -1;
    var name = str(v.name || '').toLowerCase();
    var lang = str(v.lang).toLowerCase().replace(/_/g, '-');
    var uri = str(v.voiceURI || '').toLowerCase();
    var hay = name + ' ' + uri;
    if (MALE_VOICE_RE.test(hay)) return -100;
    var score = -1;
    if (lang.indexOf('en-gb') === 0 && /google uk english female|microsoft sonia|microsoft libby|microsoft maisie|apple serena|apple kate|apple martha|\balice\b/i.test(hay)) score = 100;
    else if ((lang.indexOf('en-gb') === 0 || lang.indexOf('en-au') === 0 || lang.indexOf('en-nz') === 0) && /female|woman|sonia|libby|maisie|serena|kate|martha|ava|amelia|hazel|susan|catherine|karen/i.test(hay)) score = 60;
    else if (lang.indexOf('en') === 0 && /female|woman|samantha|victoria|zira|aria|jenny|allison|susan|karen|serena|alice/i.test(hay)) score = 30;
    if (score > 0 && v.localService === false) score += 5;
    return score;
  }
  function pickBestVoice(voices) {
    var best = null, bestScore = -1, i, v, s;
    for (i = 0; i < voices.length; i++) {
      v = voices[i];
      if (!v || !v.lang) continue;
      s = scoreVoice(v);
      if (s > bestScore) { best = v; bestScore = s; }
      else if (s === bestScore && s > 0 && best && v.localService === false && best.localService !== false) { best = v; }
    }
    return { voice: best, score: bestScore };
  }
  function resolveOnce(voices, synth, cb) {
    var picked = pickBestVoice(voices);
    cb(picked.score > 0 ? picked.voice : null);
  }
  /* E2: never blindly lock in male voices[0]. On an empty list (common on
   * Android Chrome) listen once to onvoiceschanged, with a 400 ms fallback
   * timer so headless/mock browsers can never hang. */
  function flushVoiceWaiters(voice) {
    var list = state.voiceWaiters;
    state.voiceWaiters = [];
    state.voiceResolved = true;
    for (var i = 0; i < list.length; i++) {
      try { list[i](voice); } catch (e) {}
    }
    return list.length;
  }
  function selectProfessorVoice(cb) {
    cb = cb || noop;
    var synth = global.speechSynthesis;
    if (!synth || typeof synth.getVoices !== 'function') { cb(null); return; }
    var voices = [];
    try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
    if (voices.length > 0) { resolveOnce(voices, synth, cb); return; }
    /* VOX-06: v0.0.1.c answered every concurrent caller with cb(null), so a
       second voice test spoke in the default male voice. They all queue now
       and all receive the resolved professor. */
    state.voiceWaiters.push(cb);
    if (selectProfessorVoice._waiting) return;
    selectProfessorVoice._waiting = true;
    var fired = false;
    function finish(list) {
      selectProfessorVoice._waiting = false;
      resolveOnce(list || [], synth, function (voice) { flushVoiceWaiters(voice); });
    }
    function onVoicesChanged() {
      if (fired) return;
      fired = true;
      try { synth.removeEventListener('voiceschanged', onVoicesChanged); } catch (e) {}
      var v2 = [];
      try { v2 = synth.getVoices() || []; } catch (e) {}
      finish(v2);
    }
    try { synth.addEventListener('voiceschanged', onVoicesChanged, false); } catch (e) {}
    global.setTimeout(function () {
      if (fired) return;
      fired = true;
      try { synth.removeEventListener('voiceschanged', onVoicesChanged); } catch (e) {}
      var v3 = [];
      try { v3 = synth.getVoices() || []; } catch (e) {}
      finish(v3);
    }, 400);
  }

  /* ══ D-V1 / D-V2: the cached British Female Professor voice ════════════
   * v0.0.1.b crashed with `ReferenceError: pickVoice is not defined` on the
   * very first utterance, which killed every spoken word, the whole guide and
   * the voice test. The resolver below is the single source of truth: it
   * returns the cached voice, or kicks off selectProfessorVoice() once and
   * returns null while that promise resolves (say() then falls back to
   * lang = 'en-GB', which still steers the platform to a British voice). */
  var cachedProfVoice = null;

  function pickVoice(lang) { /* lang kept for signature stability */
    if (cachedProfVoice) return cachedProfVoice;
    selectProfessorVoice(function (v) { if (v) cachedProfVoice = v; });
    return cachedProfVoice;
  }
  /* Warm the cache now, again on voiceschanged, and again on the student's
   * first real gesture (D-V6: iOS/Android only expose voices after a tap). */
  function warmProfessorVoice(cb) {
    cb = cb || noop;
    if (cachedProfVoice) { cb(cachedProfVoice); return cachedProfVoice; }
    selectProfessorVoice(function (v) {
      if (v) cachedProfVoice = v;
      cb(cachedProfVoice);
    });
    return cachedProfVoice;
  }
  function voiceName() {
    return cachedProfVoice ? str(cachedProfVoice.name) : '';
  }

  /* First-gesture unlock shared by every player surface (D-V6, R3). */
  var unlocked = false;
  function unlockAudio() {
    unlocked = true;
    /* v0.0.5.c Path B: a first gesture only unlocks playback. Calling
       speechSynthesis.resume() here re-queued the previous utterance, which is
       exactly the stale voice students heard on a cold boot. */
    var el = sharedAudio();
    if (el) { try { el.load(); } catch (e) {} }
    if (!cachedProfVoice) warmProfessorVoice(noop);
    return true;
  }
  function isUnlocked() { return !!unlocked; }

  function bindFirstGesture() {
    if (!doc || !doc.addEventListener || bindFirstGesture._bound) return false;
    bindFirstGesture._bound = true;
    var onGesture = function () {
      try { doc.removeEventListener('pointerup', onGesture, false); } catch (e) {}
      try { doc.removeEventListener('click', onGesture, false); } catch (e) {}
      try { doc.removeEventListener('touchstart', onGesture, false); } catch (e) {}
      unlockAudio();
    };
    doc.addEventListener('pointerup', onGesture, false);
    doc.addEventListener('click', onGesture, false);
    doc.addEventListener('touchstart', onGesture, false);
    return true;
  }

  /* VOX-02: a slow, deliberate 0.92-rate professor needs ~85 ms per character;
     the old 62 ms estimate cut long lines off mid-word on real devices.
     D12: on a voiceless engine (getVoices() is empty) the estimate is capped
     at 1200 ms so a headless or offline browser never stalls ~40 s waiting
     for an onend that will never fire — the queue falls through to the
     <audio> tiers immediately instead. */
  function estimateMs(text, rate) {
    if (getVoicesSafe().length === 0) return 1200;
    var perChar = Number(rate) < 1 ? 85 : 65;
    return Math.max(2600, Math.round(str(text).length * perChar) + 2400);
  }

  /* ══ SDP.Speech.say — one utterance per array entry, never per character ══ */
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 say() normaliser */
  function say(input, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    opts = opts || {};
    cb = cb || noop;
    var list = normalizeInput(input);
    var queue = [];
    var i;
    for (i = 0; i < list.length; i++) {
      var line = str(list[i]);
      if (line === '') continue;
      queue.push(line);
    }
    state.lastUtterances = state.lastUtterances || [];
    for (i = 0; i < queue.length; i++) {
      /* R2 (F2): the audit trail of what was actually spoken. The pause cue
         assertion in G7 reads this, and the cap keeps it bounded. */
      if (state.lastUtterances[state.lastUtterances.length - 1] !== queue[i]) {
        state.lastUtterances.push(queue[i]);
        if (state.lastUtterances.length > 25) state.lastUtterances.shift();
      }
    }
    if (!queue.length) { cb(null); return; }
    stopAll();
    var myId = ++state.queueId;
    var myEpoch = state.speechEpoch;
    var conf = settings();
    /* D-V4: voiceLock 'unified' is the shipped default and owns the whole
     * utterance, not just voiceSource === 'auto'. Every line then leaves with
     * the same British Female Professor persona:
     *   lang 'en-GB' · rate 0.92 (or the caller's explicit rate) · pitch 1.03.
     * 'custom' keeps the per-tier behaviour. */
    var locked = str(conf.voiceLock || 'unified') === 'unified';
    var rate = Math.min(1.2, Math.max(0.7, Number(opts.rate || (locked ? 0.92 : conf.rate)) || 0.95));
    var pitch = locked ? 1.03 : Number(opts.pitch || 1);
    var utterLang = locked ? 'en-GB' : str(opts.lang || 'en-GB');
    var volume = Math.min(1, Math.max(0, opts.volume === undefined ? (isNaN(Number(conf.volume)) ? 1 : Number(conf.volume)) : Number(opts.volume)));
    var synth = global.speechSynthesis;
    var Utter = global.SpeechSynthesisUtterance;
    var at = 0;

    function next() {
      if (myId !== state.queueId || state.speechEpoch !== myEpoch) return;
      /* E5 hard screen guard: a covered screen aborts the queue cleanly so
         no utterance lands while the student cannot see the cockpit. */
      if (screenIsCovered()) {
        state.speaking = false;
        state.activeUtter = null;
        state.activeQueue = null;
        state.activeIndex = 0;
        stopKeepAlive();
        if (guard) global.clearTimeout(guard);
        if (wordWatch) global.clearTimeout(wordWatch);
        cb(null);
        return;
      }
      if (at >= queue.length) {
        state.speaking = false;
        state.activeUtter = null;
        state.activeQueue = null;
        state.activeIndex = 0;
        stopKeepAlive();
        cb(null);
        return;
      }
      var line = queue[at];
      at += 1;
      if (synth && Utter) {
        var utter = new Utter(line);
        utter.lang = utterLang;
        utter.rate = rate;
        utter.volume = volume;
        utter.pitch = pitch;
        /* D-V1/D-V2: cached professor voice, always female, always en-GB. */
        var voice = pickVoice(utterLang);
        if (voice) utter.voice = voice;
        var advanced = false;
        var guardExtended = false;
        var guardMs = estimateMs(line, rate);
        var guard = null;
        var wordWatch = null;
        /* D10: the ONLY writer of the real-onstart flag. */
        utter.onstart = function () { state.utterStarted = true; };
        var armGuard = function (ms) {
          guard = global.setTimeout(function () {
            if (state.guardTimer === guard) state.guardTimer = null;
            if (advanced || myId !== state.queueId) return;
            /* VOX-02: onend is the primary driver. The guard only fires when a
               platform silently swallows onend, and it extends exactly once
               while the engine still reports speech in flight. */
            if (synth && (synth.speaking || synth.pending) && !guardExtended) {
              guardExtended = true;
              armGuard(1800);
              return;
            }
            advanced = true;
            state.activeUtter = null;
            next();
          }, ms);
          state.guardTimer = guard;
        };
        /* D10/D12: the 800 ms real-onstart word watchdog. A voiceless engine,
           or one that silently drops the utterance (no onstart), is cancelled
           at once; opts.fallbackAudioUrl (the word's real human British
           recording) then plays through <audio> so a word is NEVER silent. */
        var armWordWatchdog = function () {
          wordWatch = global.setTimeout(function () {
            wordWatch = null;
            if (state.wordWatchTimer === wordWatch) state.wordWatchTimer = null;
            if (advanced || myId !== state.queueId) return;
            if (state.utterStarted) return;
            try { if (synth && synth.cancel) synth.cancel(); } catch (e) {}
            if (guard) global.clearTimeout(guard);
            advanced = true;
            state.activeUtter = null;
            var fallbackUrl = str(opts.fallbackAudioUrl);
            if (fallbackUrl) {
              playUrl(fallbackUrl, { rate: rate, volume: volume, timeoutMs: 9000 }, function () {
                if (myId !== state.queueId) return;
                next();
              });
              return;
            }
            next();
          }, 800);
          state.wordWatchTimer = wordWatch;
        };
        utter.onend = function () {
          if (advanced) return;
          advanced = true;
          global.clearTimeout(guard);
          if (state.guardTimer === guard) state.guardTimer = null;
          if (wordWatch) global.clearTimeout(wordWatch);
          if (state.wordWatchTimer === wordWatch) state.wordWatchTimer = null;
          /* VOX-01: release the module-scope reference only when done. */
          if (state.activeUtter === utter) state.activeUtter = null;
          next();
        };
        utter.onerror = function () {
          if (advanced) return;
          advanced = true;
          global.clearTimeout(guard);
          if (state.guardTimer === guard) state.guardTimer = null;
          if (wordWatch) global.clearTimeout(wordWatch);
          if (state.wordWatchTimer === wordWatch) state.wordWatchTimer = null;
          if (state.activeUtter === utter) state.activeUtter = null;
          next();
        };
        /* VOX-01: keep the utterance (and its queue) reachable until it ends. */
        state.activeUtter = utter;
        state.activeQueue = queue;
        state.activeIndex = at - 1;
        state.speaking = true;
        state.utterStarted = false;
        startKeepAlive();
        armGuard(guardMs);
        armWordWatchdog();
        /* VOX-09: Chrome drops a speak() issued in the same tick as cancel(). */
        var sinceCancel = nowMs() - (Number(state.lastCancelAt) || 0);
        if (sinceCancel >= 0 && sinceCancel < 200) {
          global.setTimeout(function () {
            /* R1 Path B (F1): a deferred speak() outliving a pause/cancel is
               the exact "Afraid." leak. Re-check the id, the epoch and the
               pause flag immediately before the engine is touched. */
            if (myId !== state.queueId || myEpoch !== state.speechEpoch) return;
            if (!opts || !opts.allowWhenPaused) {
              if (SDP.Engine && SDP.Engine.isPaused && SDP.Engine.isPaused()) return;
            }
            if (advanced) return;
            try { synth.speak(utter); } catch (e) { utter.onerror(); }
          }, 200);
        } else {
          try { synth.speak(utter); } catch (e) { utter.onerror(); }
        }
      } else {
        /* No speech engine (headless, tests, locked-down browsers): keep the
           rhythm with a bounded timer so callbacks always resolve. */
        state.speaking = true;
        global.setTimeout(next, estimateMs(line, rate));
      }
    }
    next();
  }

  /* ── audio element playback with a hard timeout ─────────────────────── */
  function playUrl(url, opts, cb) {
    opts = opts || {};
    cb = cb || noop;
    var pEpoch = state.speechEpoch;
    var el = sharedAudio();
    if (!el) { cb(new Error('no_audio_element')); return; }
    var srcUrl = playableUrl(url);
    /* v0.0.4.b BUG-4: an unconvertible data clip cannot play in a plain <audio>;
       hand over to the next tier at once instead of stalling for twelve seconds. */
    if (str(srcUrl).indexOf('data:audio/') === 0) { cb(new Error('audio_failed')); return; }
    /* E5 hard screen guard: a covered screen never plays <audio>. */
    if (screenIsCovered()) { finish(false); return; }
    var conf = settings();
    var volume = Math.min(1, Math.max(0, opts.volume === undefined ? (isNaN(Number(conf.volume)) ? 1 : Number(conf.volume)) : Number(opts.volume)));
    var done = false;
    var timer = null;
    function finish(ok) {
      if (done) return;
      done = true;
      state.audioPlaying = false;
      if (timer) { try { global.clearTimeout(timer); } catch (e) {} }
      if (state.urlTimer === timer) state.urlTimer = null;
      timer = null;
      /* R1 Path C + v0.0.5.c Path C: detach the handlers AND drop the finished
         MP3 buffer, so no stale clip stays attached to the shared element. */
      if (el) {
        el.onended = null;
        el.onerror = null;
        try { el.pause(); el.removeAttribute('src'); el.load(); } catch (e) {}
      }
      if (state.speechEpoch !== pEpoch) return;
      cb(ok ? null : new Error('audio_failed'));
    }
    try {
      el.pause();
      state.audioPlaying = true; /* D11: the views guide watchdog reads this */
      /* D-M1: a data:audio/mpeg manifest entry becomes a cached Blob URL. */
      el.src = srcUrl;
      el.volume = volume;
      try { el.playbackRate = Math.min(1.2, Math.max(0.7, Number(opts.rate || conf.rate) || 1)); } catch (e) {}
      el.onended = function () { finish(true); };
      el.onerror = function () { finish(false); };
      var playing = el.play();
      if (playing && typeof playing.then === 'function') {
        playing.then(null, function () { finish(false); });
      }
    } catch (e) { finish(false); return; }
    /* Bounded: a broken URL must hand over to the next tier quickly. */
    timer = global.setTimeout(function () { finish(false); }, Number(opts.timeoutMs) || 12000);
    state.urlTimer = timer;
  }

  /* ── ElevenLabs manifest: cached clips only (student path, 0 credits) ── */
  /* D-M1: manifest entries may ship as `data:audio/mpeg;base64,...`. A service
   * worker cannot cache a data: URL, and re-decoding a 20 KB base64 string on
   * every repeat wastes the main thread. Decode once into a Blob URL and play
   * that instead (plain <audio> only — never Web Audio). */
  var blobUrls = {};
  var blobCount = 0;
  function playableUrl(url) {
    var u = str(url);
    if (u.indexOf('data:audio/') !== 0) return u;
    if (blobUrls[u]) return blobUrls[u];
    try {
      if (typeof global.Blob !== 'function' || !global.URL || typeof global.URL.createObjectURL !== 'function') return u;
      if (typeof global.atob !== 'function') return u;
      var comma = u.indexOf(',');
      if (comma < 0 || u.slice(0, comma).indexOf(';base64') < 0) return u;
      var bin = global.atob(u.slice(comma + 1));
      var bytes = new global.Uint8Array(bin.length);
      for (var b = 0; b < bin.length; b++) bytes[b] = bin.charCodeAt(b) & 0xff;
      var blobUrl = global.URL.createObjectURL(new global.Blob([bytes], { type: 'audio/mpeg' }));
      /* Bounded memo: 40 clips is more than one class ever needs at once. */
      if (blobCount < 40) { blobUrls[u] = blobUrl; blobCount += 1; }
      return blobUrl;
    } catch (e) { return u; }
  }

  function normKey(k) { return str(k).trim().toLowerCase().replace(/[.,!?;:]+$/, ''); }
  function canBlobUrl() {
    return typeof global.Blob === 'function' && !!global.URL && typeof global.URL.createObjectURL === 'function';
  }
  /* v0.0.4.b: the shipped pack is b64-only. Hydrate data URLs in memory where
     Blob URLs are actually playable, and index both words.<w> and <w> keys. */
  function hydrateClips(map) {
    if (!isObj(map)) return map;
    var keys = [], k;
    for (k in map) if (Object.prototype.hasOwnProperty.call(map, k)) keys.push(k);
    for (var i = 0; i < keys.length; i++) {
      var srcKey = keys[i], v = map[srcKey];
      if (canBlobUrl() && v && isObj(v) && !v.url && v.b64) v.url = 'data:audio/mpeg;base64,' + v.b64;
      var n = normKey(srcKey);
      if (!n) continue;
      var bare = n.replace(/^words\./, '');
      if (n !== srcKey && !map[n]) map[n] = v;
      if (bare && !map[bare]) map[bare] = v;
      if (bare && !map['words.' + bare]) map['words.' + bare] = v;
    }
    return map;
  }
  function applyManifest(data) {
    state.manifest = data && isObj(data) ? data : { clips: {} };
    if (!isObj(state.manifest.clips)) state.manifest.clips = {};
    hydrateClips(state.manifest.clips);
    state.manifestSyncRev = Number(state.manifest.syncRev || 0);
    state.manifestRequested = false;
    return state.manifest;
  }
  /* D2 / R2: the manifest is read through SDP.Sync.fetchFreshDataJson, so a
     freshly published Alice pack is heard from raw.githubusercontent.com even
     while the Pages CDN still serves yesterday's clips. A same-origin-only
     read kept the old word pack alive for minutes after a publish. */
  function loadManifest(cb, force) {
    cb = cb || noop;
    if (state.manifest && !force) { cb(null, state.manifest); return; }
    if (state.manifestRequested && !force) { cb(null, null); return; }
    state.manifestRequested = true;
    var s = sync();
    if (s && s.fetchFreshDataJson) {
      try {
        s.fetchFreshDataJson('data/elevenlabs-audio.json', function (err, result) {
          if (err || !result || !result.json) {
            /* SYNC-10: a failed manifest never blocks a later retry. */
            state.manifestRequested = false;
            bindManifestRetry();
            cb(err || new Error('manifest_failed'));
            return;
          }
          var manifest = applyManifest(result.json);
          manifest.manifestSource = str(result.source);
          cb(null, manifest);
        });
        return;
      } catch (e) {
        state.manifestRequested = false;
        bindManifestRetry();
        cb(new Error('manifest_failed'));
        return;
      }
    }
    if (typeof global.fetch !== 'function') { state.manifestRequested = false; bindManifestRetry(); cb(new Error('no_fetch')); return; }
    try {
      global.fetch('./data/elevenlabs-audio.json?t=' + nowMs(), { cache: 'no-store' })
        .then(function (res) { return res && res.ok ? res.json() : null; })
        .then(function (data) { cb(null, applyManifest(data)); }, function () {
          state.manifestRequested = false;
          bindManifestRetry();
          cb(new Error('manifest_failed'));
        });
    } catch (e) { state.manifestRequested = false; bindManifestRetry(); cb(new Error('manifest_failed')); }
  }
  /* D15 / R9: generated clips are injected into live memory the moment they
     are paid for, so the very next tap plays the Alice recording with 0 API
     calls — no reload, no second publish. */
  function injectClips(clipsMap) {
    if (!isObj(clipsMap)) return 0;
    if (!isObj(state.manifest)) state.manifest = { clips: {} };
    if (!isObj(state.manifest.clips)) state.manifest.clips = {};
    var added = 0, k;
    for (k in clipsMap) {
      if (!Object.prototype.hasOwnProperty.call(clipsMap, k)) continue;
      var entry = clipsMap[k];
      if (entry === null || entry === undefined || entry === '') continue;
      state.manifest.clips[normKey(k)] = entry;
      added += 1;
    }
    hydrateClips(state.manifest.clips);
    state.manifestSyncRev = Math.max(Number(state.manifestSyncRev || 0), Number(state.manifest.syncRev || 0));
    state.manifestRequested = false;
    return added;
  }
  /* The adoption chain calls this after every adopted publish. */
  function reloadManifest(cb, force) {
    if (typeof cb === 'boolean') { force = cb; cb = noop; }
    cb = cb || noop;
    state.manifest = null;
    state.manifestRequested = false;
    loadManifest(cb, force !== false);
    return true;
  }
  /* One-shot listeners: the next online / visible moment reloads the pack. */
  function bindManifestRetry() {
    if (state.manifestRetryBound) return false;
    state.manifestRetryBound = true;
    var retry = function () {
      if (state.manifestRequested) return;
      loadManifest(noop, true);
    };
    try { if (global.addEventListener) global.addEventListener('online', retry, false); } catch (e) {}
    try {
      if (doc && doc.addEventListener) {
        doc.addEventListener('visibilitychange', function () {
          if (!doc.visibilityState || doc.visibilityState === 'visible') retry();
        }, false);
      }
    } catch (e) {}
    return true;
  }

  function entryUrl(entry) {
    if (typeof entry === 'string') return entry;
    if (entry && isObj(entry)) return str(entry.url || entry.src || entry.file || (canBlobUrl() && entry.b64 ? 'data:audio/mpeg;base64,' + entry.b64 : ''));
    return '';
  }
  /* R5: the 70-clip pack names every word clip 'words.<w>' and keeps the legacy
     bare '<w>' key readable, so an old published pack never goes silent. */
  function manifestClip(key) {
    var clips = state.manifest && isObj(state.manifest.clips) ? state.manifest.clips : null;
    if (!clips) return '';
    var k = normKey(str(key));
    if (!k) return '';
    return entryUrl(clips[k] || clips['words.' + k] || null);
  }
  function clipFromManifest(word) {
    var clips = state.manifest && isObj(state.manifest.clips) ? state.manifest.clips : null;
    if (!clips) {
      var s = sync();
      var ses = s && s.state ? s.state.clips : null;
      if (s && ses) {
        var key = str(word && word.w).toLowerCase();
        if (key && ses[key]) return entryUrl(ses[key]);
      }
      return '';
    }
    var k = normKey(str(word && word.w));
    return entryUrl(clips['words.' + k] || clips[k] || clips[str(word && word.i)] || null);
  }

  /* E3 / VOX-04 / D10: the bulletproof word ladder under voiceLock 'unified'.
   * 1 'lecturer'   committed lecturer clip
   * 2 'eleven'     cached ElevenLabs Alice clip (0 credits to replay)
   * 3 'neural_tts' ONLY a verified Tier-1 Neural UK Female voice (score >= 100)
   * 4 'dictionary' real human British pronunciation (dict.youdao.com type=1)
   * 5 'tts'        browser speechSynthesis, always last
   * v0.0.1.d dropped the dictionary tier under 'unified', so Brave (0 voices)
   * stayed silent and Windows fell back to robotic US Zira. Now the real human
   * UK recording ALWAYS precedes low-quality synth, and the neural tier exists
   * only when a genuinely British female neural voice is verified present. */
  /* R1(c): the active dictation may only speak into #screen-player. */
  function viewIsPlayer() {
    try {
      if (!SDP.Views || typeof SDP.Views.currentTab !== 'function') return true;
      return str(SDP.Views.currentTab()) === 'player';
    } catch (e) { return true; }
  }
  function resolveTiers(wordObj, opts) {
    opts = opts || {};
    var w = isObj(wordObj) ? wordObj : { w: wordObj };
    var s = sync();
    var lecturer = s && s.getClipUrl ? str(s.getClipUrl(w)) : str(w.clipUrl);
    var eleven = clipFromManifest(w);
    var dictionary = str(w.audio);
    var tiers = [];
    var conf = settings();
    var source = str(opts.voiceSource || conf.voiceSource || 'auto');
    var voiceLock = str(conf.voiceLock || 'unified');
    if (source === 'lecturer') return [{ tier: 'lecturer', url: lecturer }];
    if (source === 'alice') return [{ tier: 'eleven', url: eleven }];
    if (source === 'device') return [{ tier: 'tts', url: '' }];
    var unified = voiceLock === 'unified' && source !== 'custom';
    var hasTier1Neural = !!cachedProfVoice && scoreVoice(cachedProfVoice) >= 100 && getVoicesSafe().length > 0;
    if (lecturer) tiers.push({ tier: 'lecturer', url: lecturer });
    if (eleven) tiers.push({ tier: 'eleven', url: eleven });
    if (unified && hasTier1Neural) tiers.push({ tier: 'neural_tts', url: '' });
    /* v0.0.4.a W1: under 'unified' the Youdao dictionary MP3 tier is NEVER
       mixed with Web Speech TTS — opt in explicitly via includeDictionary. */
    if (dictionary && (!unified || (opts && opts.includeDictionary))) tiers.push({ tier: 'dictionary', url: dictionary });
    tiers.push({ tier: 'tts', url: '' });
    return tiers;
  }
  /* E3 / D-C6 helper: speak one guide step in English with professor cadence.
   * Canonical call is playGuideStep(stepIdx, stepText, opts, cb); the v0.0.1.b
   * two-argument call playGuideStep(stepText, opts, cb) is still accepted so no
   * caller can silently lose its narration.
   * When the lecturer has generated the Alice guide pack ('_guide_1'..'_guide_4'
   * in data/elevenlabs-audio.json) that clip is played instead of TTS — zero
   * credits, identical voice on every device. */
  function guideClipUrl(stepIdx) {
    if (stepIdx === null || stepIdx === undefined || stepIdx < 0) return '';
    var clips = state.manifest && isObj(state.manifest.clips) ? state.manifest.clips : null;
    if (!clips) return '';
    var n = Number(stepIdx);
    var entry = clips['guide.en.' + n] || clips['_guide_' + (n + 1)] || null;
    return entryUrl(entry);
  }
  /* D11: four concise British-English fallback lines for the guide. When the
     browser never fires utter.onstart (Brave desktop, voiceless kiosks), the
     guide plays the REAL human British recording of these lines from the
     dictionary CDN through plain <audio> — the steps are never silent. */
  var GUIDE_AUDIO_FALLBACK_LINES = [
    'Choose how you learn.',
    'Listen and write against the timer.',
    'Check all thirty words and see your score.',
    'Practise the words you missed.'
  ];
  function shortGuideLine(stepIdx) {
    var i = Number(stepIdx);
    if (!(i >= 0) || i > GUIDE_AUDIO_FALLBACK_LINES.length - 1) i = 0;
    return GUIDE_AUDIO_FALLBACK_LINES[i] || GUIDE_AUDIO_FALLBACK_LINES[0];
  }
  function youdaoAudioUrl(text) {
    return 'https://dict.youdao.com/dictvoice?type=1&audio=' + encodeURIComponent(text);
  }
  /* D11: say() the step AND arm a 700 ms real-onstart watchdog. If
     state.utterStarted is still false (or the device has no voices at all),
     speechSynthesis is cancelled and the cloud British-female fallback line
     plays through <audio> (state.lastTier = 'guide_audio'). Only when that
     <audio> playback also fails does the caller reveal #guideTapBanner. */
  function narrateGuideStep(stepIdx, stepText, rate, volume, cb) {
    /* R2 (F2): the 700 ms watchdog used to cancel a perfectly good utterance
       and play a Youdao clip of a DIFFERENT sentence — that is the loop the
       class heard. One sentence in, one utterance out; the views watchdog
       (900 ms, no speech) is the only silent-device fallback. */
    say([str(stepText)], { lang: 'en-GB', rate: rate, pitch: 1.03, volume: volume }, function () { cb(null); });
    return true;
  }
  function playGuideStep(a, b, c, d) {
    var stepIdx = -1, stepText = '', o = {}, cb = noop;
    if (typeof a === 'number') {
      stepIdx = a;
      stepText = str(b);
      if (typeof c === 'function') { cb = c; } else { o = isObj(c) ? c : {}; if (typeof d === 'function') cb = d; }
    } else {
      stepText = str(a);
      if (typeof b === 'function') { cb = b; } else { o = isObj(b) ? b : {}; if (typeof c === 'function') cb = c; }
    }
    var rate = o.rate !== undefined ? o.rate : 0.94;
    var volume = o.volume;
    /* 1. A committed Alice guide clip always wins (zero credits). */
    var clip = guideClipUrl(stepIdx);
    if (clip) {
      var gEpoch = state.speechEpoch;
      state.speaking = true;
      playUrl(playableUrl(clip), { rate: rate, volume: volume }, function (err) {
        if (state.speechEpoch !== gEpoch) return;
        state.speaking = false;
        if (!err) { state.lastTier = 'guide_clip'; cb(null); return; }
        /* A broken cached clip must still narrate the step. */
        narrateGuideStep(stepIdx, stepText, rate, volume, cb);
      });
      return true;
    }
    /* 2. Professor TTS with the 700 ms real-onstart watchdog + cloud fallback. */
    narrateGuideStep(stepIdx, stepText, rate, volume, cb);
    return false;
  }

  /* ══ R3: spoken button cues (`cmd.*` and `num.<n>`) ══════════════════════
   * Every cue has three tiers and none of them bills a character:
   *   1. the committed 70-clip pack clip (state.manifest.clips[key])
   *   2. the documented English fallback sentence below
   *   3. silence, with the callback still honoured so the beat never stalls. */
  var CUE_TEXTS = {
    'cmd.preparing': 'Preparing lesson. Listen carefully.',
    'cmd.paused': 'Session paused.',
    'cmd.resumed': 'Session resumed.',
    'cmd.hint': 'Hint shown.',
    'cmd.complete': "Dictation complete. Let's check your thirty words.",
    'cmd.sample': 'British female lecturer voice ready.'
  };
  function cueDefaultText(cueKey) {
    var k = str(cueKey).toLowerCase();
    if (CUE_TEXTS[k]) return CUE_TEXTS[k];
    var m = /^num\.(\d+)$/.exec(k);
    if (m) return 'Number ' + m[1] + '.';
    return '';
  }
  function sayCue(cueKey, fallbackText, cb) {
    if (typeof fallbackText === 'function') { cb = fallbackText; fallbackText = ''; }
    cb = cb || noop;
    var key = str(cueKey).toLowerCase();
    var text = str(fallbackText) || cueDefaultText(key);
    /* The caller has already called stop(); this epoch is this cue's own. */
    var cueEpoch = state.speechEpoch;
    if (text) {
      state.lastUtterances = state.lastUtterances || [];
      if (state.lastUtterances[state.lastUtterances.length - 1] !== text) {
        state.lastUtterances.push(text);
        if (state.lastUtterances.length > 25) state.lastUtterances.shift();
      }
    }
    var clipUrl = manifestClip(key);
    if (clipUrl) {
      playUrl(playableUrl(clipUrl), { rate: 0.92, volume: undefined }, function (err) {
        if (state.speechEpoch !== cueEpoch) return;
        if (!err) { state.lastTier = 'eleven'; cb(null); return; }
        if (!text) { cb(null); return; }
        say([text], { lang: 'en-GB', rate: 0.92, pitch: 1.03, allowWhenPaused: key === 'cmd.paused' }, cb);
      });
      return true;
    }
    if (!text) { cb(null); return false; }
    say([text], { lang: 'en-GB', rate: 0.92, pitch: 1.03, allowWhenPaused: key === 'cmd.paused' }, cb);
    return true;
  }

  /* R6 (F9): the persona is resolved once per session and then held. Android
     fires voiceschanged mid-session; swapping the voice then changes the
     speaker in the middle of a word. */
  function lockSessionVoice() {
    if (state.sessionVoice) return state.sessionVoice;
    var v = pickVoice('en-GB');
    if (!v) {
      state.voiceDirty = true;
      warmProfessorVoice(function (warmed) { if (warmed && !state.sessionVoice) state.sessionVoice = warmed; });
      return null;
    }
    state.sessionVoice = v;
    state.voiceDirty = false;
    return v;
  }
  function endSessionVoice() { state.sessionVoice = null; return null; }

  /* ══ SDP.Speech.playWord — the D10 5-tier chain, bounded at every step ══ */
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 tier order */
  function playWord(word, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    opts = opts || {};
    cb = cb || noop;
    var at = 0;
    var tiers = null;
    var settled = false;
    var gen = 0;
    var wEpoch = state.speechEpoch;
    state.lastTier = '';
    /* R1 (a)(b)(c)(d): no word may be produced by a paused engine, by a dead
       epoch, or into a screen the student cannot see. This single gate is the
       one law; the per-tier checks below are only belt and braces. */
    if (Refuse()) { cb(null); return false; }
    function Refuse() {
      if (SDP.Engine && SDP.Engine.isPaused && SDP.Engine.isPaused()) return true;
      var active = false;
      try { active = !!(SDP.Engine && SDP.Engine.isActive && SDP.Engine.isActive()); } catch (e) { active = false; }
      if (active && !viewIsPlayer()) return true;
      return false;
    }
    function attempt() {
      var myGen = gen;
      if (at >= tiers.length) {
        state.lastTier = state.lastTier || 'tts';
        settled = true;
        cb(null);
        return;
      }
      var current = tiers[at];
      at += 1;
      if (current.tier === 'tts' || current.tier === 'neural_tts') {
        state.lastTier = current.tier;
        /* E2 professor cadence. D10: the utterance carries the word's real
           human British recording as its 800 ms watchdog fallback, so even
           the TTS tier can never leave a word silent. */
        say([str(word && word.w ? word.w : word)], { rate: 0.92, pitch: 1.03, volume: opts.volume, fallbackAudioUrl: str(word && word.audio) }, function () {
          if (myGen !== gen || settled || state.speechEpoch !== wEpoch) return;
          settled = true;
          cb(null);
        });
        /* say() bumps the epoch through its own stopAll(); adopt it so the
           callback above is not rejected as stale, and so a real pause during
           the word still invalidates this chain. */
        wEpoch = state.speechEpoch;
        return;
      }
      playUrl(current.url, { rate: opts.rate, volume: opts.volume, timeoutMs: opts.timeoutMs }, function (err) {
        if (myGen !== gen || settled || state.speechEpoch !== wEpoch) return;
        if (!err) {
          state.lastTier = current.tier;
          settled = true;
          cb(null);
          return;
        }
        attempt();
      });
    }
    /* D10 correction: never WAIT for the manifest — the d behaviour started
       playing at once, and a hanging manifest fetch must never mute a word.
       The chain starts immediately; if the manifest lands during the very
       first word and nothing has succeeded yet, the ladder is restarted once
       (stale tier results are dropped by the generation counter). */
    function run() {
      tiers = opts.tiers || resolveTiers(word);
      attempt();
    }
    if (!opts.tiers && !state.manifest && !state.manifestRequested) {
      loadManifest(function () {
        /* R1 Path A (F1): the manifest restart was the loudest leak — a slow
           fetch landed seconds after Pause and replayed the word. The epoch,
           the pause flag and the current screen are all re-checked FIRST. */
        if (settled || opts.tiers || !state.manifest) return;
        if (state.speechEpoch !== wEpoch) return;
        if (SDP.Engine && SDP.Engine.isPaused && SDP.Engine.isPaused()) return;
        if (Refuse()) return;
        gen += 1;
        at = 0;
        tiers = resolveTiers(word);
        attempt();
      });
    }
    run();
  }

  /* VOX-08: the old test only called say() and always claimed 'Alice'. It now
     plays a real session word through the real tier chain and reports the tier
     that actually produced the sound. */
  function testVoice(cb) {
    cb = cb || noop;
    var conf = settings();
    var wordsList = [];
    try { wordsList = sync() && sync().words ? sync().words() : []; } catch (e) { wordsList = []; }
    var first = wordsList && wordsList.length ? wordsList[0] : { w: 'confident', audio: '' };
    playWord(first, { volume: conf.volume }, function () {
      var tier = lastTierName();
      var spoken = str(first && first.w) || 'confident';
      say(['Professor voice ready · ' + spoken], { lang: 'en-GB', rate: 0.92, pitch: 1.03, volume: conf.volume }, function () {
        cb(null, { tier: tier, word: spoken });
      });
    });
    return true;
  }
  function lastTierName() {
    var names = {
      lecturer: 'Lecturer clip',
      eleven: 'Alice (ElevenLabs)',
      neural_tts: 'Professor neural voice (UK female)',
      dictionary: 'British human audio',
      guide_clip: 'Alice guide clip',
      guide_audio: 'British guide audio',
      tts: 'Professor voice'
    };
    return names[state.lastTier] || str(state.lastTier) || 'Professor voice';
  }

  var Speech = {
    state: state,
    normalizeInput: normalizeInput,
    say: say,
    stop: stopAll,
    playWord: playWord,
    playUrl: playUrl,
    testVoice: testVoice,
    resolveTiers: resolveTiers,
    playGuideStep: playGuideStep,
    guideClipUrl: guideClipUrl,
    sayCue: sayCue,
    cueDefaultText: cueDefaultText,
    lockSessionVoice: lockSessionVoice,
    endSessionVoice: endSessionVoice,
    selectProfessorVoice: selectProfessorVoice,
    pickVoice: pickVoice,
    warmProfessorVoice: warmProfessorVoice,
    voiceName: voiceName,
    unlockAudio: unlockAudio,
    isUnlocked: isUnlocked,
    playableUrl: playableUrl,
    scoreVoice: scoreVoice,
    loadManifest: loadManifest,
    reloadManifest: reloadManifest,
    injectClips: injectClips,
    sharedAudio: sharedAudio,
    lastTier: function () { return state.lastTier; },
    lastTierName: lastTierName,
    activeUtter: function () { return state.activeUtter; },
    lastUtterances: function () { return state.lastUtterances.slice(); },
    isSpeaking: function () { return !!state.speaking; },
    /* D11: the real utter.onstart flag and the shared <audio> playing flag —
       the views guide watchdog checks these instead of state.speaking. */
    hasStarted: function () { return !!state.utterStarted; },
    isAudioPlaying: function () { return !!state.audioPlaying; },
    getVoicesSafe: getVoicesSafe,
    youdaoAudioUrl: youdaoAudioUrl,
    shortGuideLine: shortGuideLine,
    hasSynth: function () { return !!(global.speechSynthesis && global.SpeechSynthesisUtterance); }
  };

  /* ── module init: warm the voice, listen for updates, arm the gesture ── */
  (function initSpeech() {
    /* D-V2/D-V6: voices may arrive after load. Warm now, then on every
     * voiceschanged notification, then once more on the first real tap. */
    try { warmProfessorVoice(noop); } catch (e) {}
    try {
      var synth = global.speechSynthesis;
      if (synth && synth.addEventListener) {
        synth.addEventListener('voiceschanged', function () {
          if (state.sessionVoice) { state.voiceDirty = true; return; }
          cachedProfVoice = null;
          warmProfessorVoice(noop);
        }, false);
      } else if (synth && typeof synth.onvoiceschanged !== 'undefined') {
        synth.onvoiceschanged = function () {
          if (state.sessionVoice) { state.voiceDirty = true; return; }
          cachedProfVoice = null;
          warmProfessorVoice(noop);
        };
      }
    } catch (e) {}
    bindFirstGesture();
    /* D-V5: a freshly published Alice pack must be visible without a reload.
       SDP.Sync emits CustomEvents on `document` (non-bubbling), so listen
       there as well as on `window`. */
    var onUpdate = function (ev) {
      var detail = (ev && ev.detail) || {};
      var nextRev = Number(detail.syncRev || 0);
      if (state.manifest && nextRev && nextRev <= Number(state.manifestSyncRev || 0)) return;
      state.manifest = null;
      state.manifestRequested = false;
      loadManifest(noop, true);
    };
    try { if (doc && doc.addEventListener) doc.addEventListener('sdp:update', onUpdate, false); } catch (e) {}
    try { if (global.addEventListener) global.addEventListener('sdp:update', onUpdate, false); } catch (e) {}
  })();

  SDP.Speech = Speech;
})(typeof window !== 'undefined' ? window : this);
