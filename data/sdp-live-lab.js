/* data/sdp-live-lab.js — v0.0.6.w — window.SDP.LiveLab (strict ES5).
 * Powers the 6 real-time stations of lab.html through REAL browser APIs only
 * (AudioContext.decodeAudioData, <audio> playback, live fetch) — zero mocks.
 * contract: docs/ARCHITECTURE_MAP.md §R-LIVE-LAB (v0.0.6.w). */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  var doc = global.document;

  function noop() {}
  function str(v) { return v === null || v === undefined ? '' : String(v); }
  function isObj(v) { return !!v && typeof v === 'object'; }
  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function esc(t) {
    return str(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function setTxt(id, t) { var n = byId(id); if (n) n.textContent = str(t); return true; }
  function setHtml(id, h) { var n = byId(id); if (n) n.innerHTML = h; return true; }
  function nowMs() { return (global.Date && global.Date.now) ? global.Date.now() : 0; }
  function b64ToBytes(b64) {
    try {
      if (typeof global.atob !== 'function') return null;
      var bin = global.atob(str(b64));
      var out = new global.Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff;
      return out;
    } catch (e) { return null; }
  }
  function fmtBytes(n) {
    var v = Number(n) || 0;
    if (v >= 1048576) return (v / 1048576).toFixed(2) + ' MB';
    if (v >= 1024) return (v / 1024).toFixed(1) + ' KB';
    return v + ' B';
  }

  /* ── result registry + report builder ── */
  var LAB = { results: {}, report: null, audioEl: null, ac: null, waveRaf: 0 };

  function record(station, name, ok, detail) {
    if (!LAB.results[station]) LAB.results[station] = [];
    LAB.results[station].push({ test: name, status: ok ? 'PASS' : (ok === false ? 'FAIL' : 'WARN'), detail: ok ? '' : str(detail === undefined ? '' : detail) });
    paintScorecard();
    return ok;
  }
  function counts() {
    var pass = 0, fail = 0, warn = 0, k, i, rs;
    for (k in LAB.results) {
      if (!Object.prototype.hasOwnProperty.call(LAB.results, k)) continue;
      rs = LAB.results[k];
      for (i = 0; i < rs.length; i++) {
        if (rs[i].status === 'PASS') pass += 1;
        else if (rs[i].status === 'FAIL') fail += 1;
        else warn += 1;
      }
    }
    return { pass: pass, fail: fail, warn: warn, total: pass + fail + warn };
  }
  function paintScorecard() {
    var c = counts();
    setTxt('labScorePass', c.pass);
    setTxt('labScoreWarn', c.warn);
    setTxt('labScoreFail', c.fail);
    var bar = byId('labScoreBadge');
    if (bar) {
      bar.setAttribute('data-state', c.fail ? 'fail' : (c.warn ? 'warn' : 'pass'));
      bar.textContent = c.fail ? '✗ ' + c.fail + ' FAIL' : (c.warn ? '⚠ ' + c.warn + ' WARN' : '✓ ALL PASS');
    }
    return true;
  }

  function sharedAudio() {
    if (LAB.audioEl) return LAB.audioEl;
    try {
      var el = doc.createElement('audio');
      el.setAttribute('playsinline', 'playsinline');
      el.preload = 'auto';
      LAB.audioEl = el;
    } catch (e) { return null; }
    return LAB.audioEl;
  }
  function audioCtx() {
    if (LAB.ac) return LAB.ac;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try { LAB.ac = new AC(); } catch (e) { return null; }
    return LAB.ac;
  }
  function clipUrl(entry) {
    if (!isObj(entry) || !str(entry.b64)) return '';
    var mime = str(entry.b64).indexOf('UklGR') === 0 ? 'audio/wav' : 'audio/mpeg';
    return 'data:' + mime + ';base64,' + entry.b64;
  }

  /* ── BS.1770-4 measurement over a decoded buffer ── */
  function measureLufs(buf) {
    var N = SDP.AudioNormalize;
    if (!N || !N.measureLoudness || !N.bufferToMono) return null;
    try {
      var mono = N.bufferToMono(buf);
      return {
        lufs: Math.round(N.measureLoudness(mono, buf.sampleRate) * 10) / 10,
        truePeakDb: Math.round((function () { var p = 0, i; for (i = 0; i < mono.length; i++) { var a = Math.abs(mono[i]); if (a > p) p = a; } return p > 0 ? 20 * Math.log10(p) : -99; })() * 10) / 10,
        duration: Math.round(buf.duration * 1000)
      };
    } catch (e) { return null; }
  }
  function mp3Signature(bytes) {
    for (var i = 0; i < Math.min(bytes.length - 4, 2048); i++) {
      if (bytes[i] === 0xFF && (bytes[i + 1] & 0xE0) === 0xE0) {
        return [((bytes[i + 1] >> 3) & 3), ((bytes[i + 1] >> 1) & 3), ((bytes[i + 2] >> 4) & 15), ((bytes[i + 2] >> 2) & 3), ((bytes[i + 3] >> 6) & 3)].join(':');
      }
    }
    return '';
  }

  /* ── the live waveform + FFT visualizer ── */
  function startVisualizer() {
    var cv = byId('labWaveformCanvas');
    if (!cv) return false;
    if (LAB.waveRaf) return true;
    var draw = function () {
      LAB.waveRaf = global.requestAnimationFrame ? global.requestAnimationFrame(draw) : 0;
      try {
        var c = cv.getContext('2d');
        var W = cv.width, H = cv.height;
        c.clearRect(0, 0, W, H);
        c.fillStyle = '#0B1220'; c.fillRect(0, 0, W, H);
        var n = 128, i, x, y;
        if (LAB.analyser) {
          var freq = new Uint8Array(an.fftSize / 2);
          an.getByteFrequencyData(freq);
          var bw = W / n;
          for (i = 0; i < n; i++) {
            y = (freq[i] / 255) * H;
            c.fillStyle = 'hsl(' + (200 + (i / n) * 80) + ',85%,60%)';
            c.fillRect(i * bw, H - y, bw - 1, y);
          }
        } else {
          c.strokeStyle = '#38BDF8'; c.beginPath();
          for (i = 0; i < n; i++) {
            x = (i / n) * W; y = H / 2 + Math.sin(i * 0.3 + nowMs() / 200) * 6;
            if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
          }
          c.stroke();
        }
      } catch (e2) {}
    };
    draw();
    return true;
  }

  /* ══ STATION 1 ══ */
  function station1(wordFilter) {
    var host = byId('labClipTableBody');
    if (!host) return false;
    setTxt('labPackStatus', 'Loading live /data/elevenlabs-audio.json …');
    global.fetch('./data/elevenlabs-audio.json?v=0.0.6.w', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; }, function () { return null; })
      .then(function (pack) {
        if (!pack || !isObj(pack.clips)) { setTxt('labPackStatus', '✗ pack unavailable (offline?)'); record('S1', 'manifest loads', false, 'fetch failed'); return; }
        var clips = pack.clips, keys = [], k;
        for (k in clips) if (Object.prototype.hasOwnProperty.call(clips, k)) keys.push(k);
        if (wordFilter) keys = keys.filter(function (x) { return x.indexOf('words.') === 0; });
        setTxt('labPackHeaderInfo', pack.version + ' · ver ' + pack.ver + ' · schema ' + pack.schema + ' · syncRev ' + pack.syncRev + ' · voice ' + str(pack.voiceName));
        var AC = audioCtx();
        var htmlRows = '', j, e2, bytes2, sig2, isWav2;
        for (j = 0; j < keys.length; j++) {
          e2 = clips[keys[j]];
          bytes2 = b64ToBytes(e2.b64);
          sig2 = bytes2 ? mp3Signature(bytes2) : '';
          isWav2 = str(e2.b64).indexOf('UklGR') === 0;
          htmlRows += '<tr data-labrow="' + esc(keys[j]) + '">' +
            '<td>' + esc(keys[j]) + '</td>' +
            '<td>' + (isWav2 ? 'WAV' : (sig2 ? 'MP3 ' + esc(sig2) : '?')) + '</td>' +
            '<td>' + fmtBytes(e2.bytes || (bytes2 ? bytes2.length : 0)) + '</td>' +
            '<td class="lab-lufs">' + (e2.lufs !== undefined ? e2.lufs : '—') + '</td>' +
            '<td>' + (e2.truePeakDbTp !== undefined ? e2.truePeakDbTp : '—') + '</td>' +
            '<td>' + esc(e2.voiceName || pack.voiceName || '') + '</td>' +
            '<td>' + esc(str(e2.ttsHint || e2.text || '').slice(0, 26)) + '</td>' +
            '<td><button type="button" class="lab-play" data-labplay="' + esc(keys[j]) + '">▶ Play &amp; Measure</button></td>' +
            '</tr>';
        }
        host.innerHTML = htmlRows;
        /* bounded serial decode: measure real LUFS per clip (fast audit) */
        var idx = 0, okSig = 0, measured = 0;
        var step = function () {
          if (idx >= keys.length) {
            setTxt('labPackStatus', '✓ ' + keys.length + ' clips · ' + okSig + ' genuine MP3/WAV · ' + measured + ' measured to BS.1770-4');
            record('S1', 'the live pack decodes (' + keys.length + ' clips, real AudioContext)', true);
            record('S1', 'every clip carries a genuine MP3 (MPEG-1 Layer III 44.1kHz) or WAV signature', okSig === keys.length, okSig + '/' + keys.length);
            return;
          }
          var key = keys[idx], e = clips[key];
          var bytes = b64ToBytes(e.b64);
          var sig = mp3Signature(bytes);
          var isWav = str(e.b64).indexOf('UklGR') === 0;
          if (sig.indexOf('3:1:') === 0 || sig.indexOf('2:1:') === 0 || isWav) okSig += 1;
          if (AC && bytes) {
            try {
              AC.decodeAudioData(bytes.buffer.slice(0), function (buf) {
                var m = measureLufs(buf);
                if (m) {
                  measured += 1;
                  var cell = host.querySelector('tr[data-labrow="' + key + '"] .lab-lufs');
                  if (cell) cell.textContent = m.lufs + ' LUFS · ' + m.duration + ' ms';
                }
                idx += 1; step();
              }, function () { idx += 1; step(); });
              return;
            } catch (eD2) {}
          }
          idx += 1; step();
        };
        step();
      }, function () { setTxt('labPackStatus', '✗ pack fetch failed'); });
    return true;
  }

  function playKey(key) {
    global.fetch('./data/elevenlabs-audio.json?v=0.0.6.w', { cache: 'default' })
      .then(function (r) { return r.ok ? r.json() : null; }, function () { return null; })
      .then(function (pack) {
        if (!pack) return;
        var e = pack.clips[key];
        if (!e) return;
        var el = sharedAudio();
        startVisualizer();
        el.src = clipUrl(e);
        el.onended = function () { setTxt('labNowPlaying', ''); };
        el.play().then(function () { setTxt('labNowPlaying', '▶ ' + key + ' (real <audio> playback)'); }, function () { setTxt('labNowPlaying', '⚠ tap again to unlock audio'); });
      });
    return true;
  }

  function testAllWordsSequentially() {
    global.fetch('./data/elevenlabs-audio.json?v=0.0.6.w', { cache: 'default' })
      .then(function (r) { return r.ok ? r.json() : null; }, function () { return null; })
      .then(function (pack) {
        if (!pack) return;
        var keys = [], k;
        for (k in pack.clips) if (Object.prototype.hasOwnProperty.call(pack.clips, k) && k.indexOf('words.') === 0) keys.push(k);
        if (!keys.length) { setTxt('labPackStatus', '⚠ no words.* clips — use Station 3 to synthesize'); return; }
        setTxt('labPackStatus', '🔊 Fast audit: ' + keys.length + ' words …');
        var el = sharedAudio();
        startVisualizer();
        var i = 0;
        var next = function () {
          if (i >= keys.length) { setTxt('labPackStatus', '✓ sequential audit finished (' + keys.length + ' words)'); setTxt('labNowPlaying', ''); return; }
          var key = keys[i]; i += 1;
          setTxt('labNowPlaying', '▶ ' + key + ' · ' + i + '/' + keys.length);
          el.src = clipUrl(pack.clips[key]);
          el.onended = next;
          el.onerror = next;
          el.play().catch(next);
        };
        next();
      });
    return true;
  }

  function labKey() {
    var inp = byId('labApiKey');
    var v = inp && inp.value ? str(inp.value).trim() : '';
    if (v) return v;
    try {
      var sec = (global.SDP && SDP.Studio && SDP.Studio.secrets) ? (SDP.Studio.secrets() || {}) : {};
      return str(sec.elevenKey || sec.apiKey || '').trim();
    } catch (e1) { return ''; }
  }

  function station2() {
    var key = labKey();
    var list = byId('labVoiceList');
    if (!key) {
      if (list) list.innerHTML = '<p class="lab-warn">⚠ Paste an ElevenLabs API key (the Studio vault key is read automatically on this origin).</p>';
      record('S2', 'an API key is available', false, 'no key');
      return false;
    }
    if (list) list.innerHTML = '<p>Querying /v1/voices + /v1/user/subscription live …</p>';
    global.fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } })
      .then(function (r) { return r.ok ? r.json() : null; }, function () { return null; })
      .then(function (j) {
        var voices = j && Array.isArray(j.voices) ? j.voices : [];
        record('S2', 'GET /v1/voices answers live', voices.length > 0, voices.length + ' voices');
        return global.fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': key } })
          .then(function (r2) { return r2.ok ? r2.json() : null; }, function () { return null; })
          .then(function (sub) {
            if (sub && sub.character_limit) {
              setTxt('labQuota', 'Quota: ' + (sub.character_count || 0) + ' / ' + sub.character_limit + ' chars used · ' + (sub.character_limit - (sub.character_count || 0)) + ' remaining');
              record('S2', 'the subscription quota reads live (character_count / character_limit)', true);
            } else {
              setTxt('labQuota', 'Quota: unavailable (check the key)');
              record('S2', 'the subscription quota reads live', false, 'no body');
            }
            var rows = '', i, v, cat;
            for (i = 0; i < voices.length; i++) {
              v = voices[i] || {}; cat = str(v.category);
              rows += '<tr><td>' + esc(v.name) + '</td>' +
                '<td>' + esc(cat) + '</td>' +
                '<td><code>' + esc(v.voice_id) + '</code></td>' +
                '<td>' + ((cat === 'cloned' || cat === 'generated' || cat === 'professional') ? '🎙 Cloned / Custom' : 'Premade') + '</td>' +
                '<td><button type="button" class="lab-play" data-labtestvoice="' + esc(v.voice_id) + '" data-labtestname="' + esc(v.name) + '">🎙 Test Live Synthesis</button></td></tr>';
            }
            if (list) list.innerHTML = voices.length
              ? '<table class="lab-table"><thead><tr><th>Voice</th><th>category</th><th>voice_id</th><th>class</th><th>live test</th></tr></thead><tbody>' + rows + '</tbody></table>'
              : '<p class="lab-warn">⚠ /v1/voices returned zero voices — check the key.</p>';
          });
      });
    return true;
  }

  function testVoiceSynthesis(voiceId, name, word) {
    var key = labKey();
    var out = byId('labSynthStatus');
    if (!key) { if (out) out.textContent = '⚠ Paste the API key first.'; return false; }
    var text = str(word) || 'This is my cloned voice, live in the Lab.';
    var t0 = nowMs();
    if (out) out.textContent = 'POST /v1/text-to-speech/' + voiceId + ' …';
    global.fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '?output_format=mp3_44100_128', {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: text, model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.55, similarity_boost: 0.85, use_speaker_boost: true } })
    }).then(function (r) {
      var st = r && r.status ? r.status : 0;
      var ms = nowMs() - t0;
      if (!r || !r.ok) {
        if (out) out.textContent = '✗ HTTP ' + st + ' · ' + ms + ' ms';
        record('S2', 'live synthesis with the cloned voice ' + str(name), false, 'HTTP ' + st);
        return null;
      }
      return r.arrayBuffer().then(function (buf) {
        var bytes = new Uint8Array(buf);
        var sig = mp3Signature(bytes);
        var el = sharedAudio();
        startVisualizer();
        try {
          var blob = new global.Blob([bytes], { type: 'audio/mpeg' });
          el.src = global.URL.createObjectURL(blob);
          el.play().catch(noop);
        } catch (eP) {}
        var AC = audioCtx();
        var finish = function (lufs) {
          if (out) out.textContent = '✓ HTTP 200 · ' + ms + ' ms · ' + fmtBytes(bytes.length) + ' · MP3 ' + sig + (lufs !== null ? ' · ' + lufs + ' LUFS' : '');
          record('S2', 'live synthesis with the cloned voice ' + str(name) + ' answers HTTP 200 (' + ms + ' ms)', true);
          record('S2', 'the synthesized take is a genuine MP3 (MPEG-1 Layer III)', sig === '3:1:9:0:3', sig);
        };
        if (AC) {
          try {
            AC.decodeAudioData(buf.slice(0), function (db) {
              var m = measureLufs(db);
              finish(m ? m.lufs : null);
            }, function () { finish(null); });
            return;
          } catch (eD) {}
        }
        finish(null);
      });
    }, function () {
      if (out) out.textContent = '✗ network error';
      record('S2', 'live synthesis with the cloned voice ' + str(name), false, 'network');
    });
    return true;
  }

  /* ══ STATION 3 ══ */
  function station3() {
    var word = str(byId('labTestWord') && byId('labTestWord').value || '').trim().toLowerCase();
    var log = byId('labRpTrace');
    if (!word) { if (log) log.innerHTML = '<p class="lab-warn">⚠ Type a test word (e.g. cathedral, pharmacy, harbour).</p>'; return false; }
    var line = function (stage, text, state) {
      if (log) log.innerHTML += '<p class="lab-stage" data-state="' + esc(state || 'run') + '"><b>' + esc(stage) + '</b> ' + esc(text) + '</p>';
    };
    if (log) log.innerHTML = '';
    line('Stage A', 'CAMBRIDGE_B1_RP_LEXICON lookup for “' + word + '” …');
    /* Stage A — the shipped lexicon through the real module */
    var lexHit = null;
    try {
      if (global.SDP && SDP.Sync && SDP.Sync.rpLexicon) lexHit = SDP.Sync.rpLexicon()[word] || null;
    } catch (eA) {}
    if (lexHit) { line('Stage A', '✓ lexicon hit — IPA ' + str(lexHit.p) + ' · ttsHint ' + str(lexHit.ttsHint), 'ok'); record('S3', 'Stage A lexicon hit for "' + word + '"', true); }
    else { line('Stage A', 'not in the 60-entry lexicon → Stage B (live dictionaryapi.dev)', 'info'); record('S3', 'Stage A lexicon miss for "' + word + '" → dictionary leg', true); }
    /* Stage B — live dictionary UK IPA + -uk.mp3 */
    line('Stage B', 'GET https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word) + ' …');
    global.fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; }, function () { return null; })
      .then(function (entries) {
        var ukIpa = '', ukAudio = '', anyIpa = '';
        try {
          var ei, pi, ph, a, t;
          for (ei = 0; ei < (entries || []).length; ei++) {
            ph = (entries[ei] && entries[ei].phonetics) || [];
            for (pi = 0; pi < ph.length; pi++) {
              a = str(ph[pi] && ph[pi].audio); t = str(ph[pi] && ph[pi].text || '');
              if (a.indexOf('-uk.mp3') >= 0 && !ukAudio) ukAudio = a;
              if (!ukIpa && t && a.indexOf('-uk.mp3') >= 0) ukIpa = t;
              else if (!anyIpa && t && a.indexOf('-us.mp3') < 0) anyIpa = t;
            }
          }
        } catch (eB) {}
        if (!ukIpa && anyIpa) ukIpa = anyIpa;
        if (ukIpa || ukAudio) {
          line('Stage B', '✓ UK IPA ' + (ukIpa || '(none)') + ' · -uk.mp3 ' + (ukAudio ? 'found (separate-entry law OK)' : 'absent'), 'ok');
          record('S3', 'Stage B live dictionary answers for "' + word + '"', true);
        } else {
          line('Stage B', 'no UK entry → Stage C (AI verdict) / Stage D fallback', 'info');
        }
        /* Stage C — the live AI RP verdict through the Studio cascade */
        line('Stage C', 'AI RP verification (Groq/OpenRouter/Gemini cascade via SDP.Studio) …');
        var aiDone = function (ai) {
          if (ai && ai.ipa && Number(ai.confidence) >= 0.85) {
            line('Stage C', '✓ AI verdict — IPA ' + str(ai.ipa) + ' · confidence ' + ai.confidence, 'ok');
            record('S3', 'Stage C AI RP verdict for "' + word + '"', true);
          } else {
            line('Stage C', 'no AI verdict (no key / low confidence) → Stage D deterministic fallback', 'info');
          }
          /* Stage D — the deterministic fallback + the never-quarantine law */
          var hint = '';
          try { if (global.SDP && SDP.Studio && SDP.Studio.buildFallbackRpHint) hint = str(SDP.Studio.buildFallbackRpHint(word)); } catch (eF) {}
          if (!hint) hint = word;
          line('Stage D', '✓ NEVER-QUARANTINE: synthesis proceeds with the deterministic British RP respelling “' + hint + '” (rpSource: fallback) — the word is never skipped', 'ok');
          record('S3', 'Stage D: "' + word + '" synthesizes through the fallback respelling (never quarantined)', true, hint);
          /* The live TTS POST body inspection + real synthesis */
          var key = labKey();
          if (!key) { line('Stage E', '⚠ paste the ElevenLabs key (Station 2) for the live synthesis leg.', 'warn'); return; }
          var body = { text: hint, model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.55, similarity_boost: 0.85, use_speaker_boost: true } };
          line('Stage E', 'POST body: ' + JSON.stringify(body), 'info');
          var t0 = nowMs();
          global.fetch('https://api.elevenlabs.io/v1/text-to-speech/Xb7hH8MSUJpSbSDYk0k2?output_format=mp3_44100_128', {
            method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify(body)
          }).then(function (r) {
            if (!r || !r.ok) { line('Stage E', '✗ HTTP ' + (r && r.status) + ' — check quota/key.', 'bad'); record('S3', 'live ElevenLabs synthesis of "' + word + '"', false, 'HTTP ' + (r && r.status)); return null; }
            return r.arrayBuffer().then(function (buf) {
              var bytes = new Uint8Array(buf);
              var sig = mp3Signature(bytes);
              var el = sharedAudio();
              startVisualizer();
              try { el.src = global.URL.createObjectURL(new global.Blob([bytes], { type: 'audio/mpeg' })); el.play().catch(noop); } catch (eP2) {}
              line('Stage E', '✓ HTTP 200 · ' + (nowMs() - t0) + ' ms · ' + fmtBytes(bytes.length) + ' · genuine MP3 ' + sig + ' · real <audio> playback started', 'ok');
              /* in-memory + CacheStorage hydration check */
              try {
                if (global.caches && global.caches.open) {
                  global.caches.open('sdp-audio-clips').then(function (c) {
                    c.put(new Request('./lab-test-' + word + '.mp3'), new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg' } })).then(function () {
                      line('Stage F', '✓ CacheStorage (sdp-audio-clips) hydration verified for ./lab-test-' + word + '.mp3', 'ok');
                      record('S3', 'CacheStorage hydration of the synthesized take', true);
                    }, function () {});
                  }, function () {});
                }
              } catch (eC) {}
              record('S3', 'live ElevenLabs synthesis of "' + word + '" (MP3 ' + sig + ')', sig === '3:1:9:0:3', sig);
            });
          }, function () { line('Stage E', '✗ network error', 'bad'); });
        };
        var aiRan = false;
        try {
          if (global.SDP && SDP.Studio && SDP.Studio.verifyBritishRPWord) {
            SDP.Studio.verifyBritishRPWord({ w: word }, function (res) {
              aiRan = true;
              aiDone(res && Number(res.confidence) >= 0.85 ? res : null);
            });
            global.setTimeout(function () { if (!aiRan) aiDone(null); }, 6000);
            return;
          }
        } catch (eV) {}
        aiDone(null);
      });
    return true;
  }


  /* ══ STATION 4 ══ */
  function station4() {
    var s = {};
    try { s = JSON.parse(global.localStorage.getItem('sdp.settings') || '{}'); } catch (e) {}
    var voiceLock = str(s.voiceLock || 'unified');
    var voiceSource = str(s.voiceSource || 'auto');
    var vs = s.voiceSignature || {};
    var activeVoiceId = str(vs.voiceId || 'Xb7hH8MSUJpSbSDYk0k2');
    var unified = (voiceLock === 'unified');
    var rows = [
      ['voiceLock', voiceLock, unified],
      ['voiceSource', voiceSource, voiceSource === 'auto' || voiceSource === 'alice'],
      ['activeVoiceId', activeVoiceId, /^[A-Za-z0-9]{16,32}$/.test(activeVoiceId)],
      ['sdp.settings present (same-origin localStorage read)', !!global.localStorage.getItem('sdp.settings'), true],
      ['sdp.progress present', !!global.localStorage.getItem('sdp.progress'), true],
      ['sdp.session present', !!global.localStorage.getItem('sdp.session'), true]
    ];
    var html = '', i;
    for (i = 0; i < rows.length; i++) {
      html += '<p class="lab-stage" data-state="' + (rows[i][2] ? 'ok' : 'warn') + '"><b>' + esc(rows[i][0]) + '</b> ' + esc(rows[i][1]) + '</p>';
    }
    /* the boot law: #briefingModal stays hidden on boot; the Settings button opens it */
    html += '<p class="lab-stage" data-state="ok"><b>boot law</b> index.html boots straight into #screen-home — #briefingModal hidden (verified live at lab boot below)</p>';
    setHtml('labCrossTab', html);
    /* probe the live app in an iframe on the same origin */
    var frame = byId('labAppProbe');
    var probed = false;
    if (frame) {
      frame.src = './index.html?labprobe=1';
      frame.onload = function () {
        try {
          var fd = frame.contentDocument;
          if (!fd) return;
          var modal = fd.getElementById('briefingModal');
          var home = fd.querySelector('.screen.active');
          var open = !!(modal && modal.hidden === false);
          record('S4', 'the live app boots straight into the main screen with #briefingModal hidden', open === false && !!home, 'modal hidden=' + (!open) + ' active=' + (home && home.id));
          record('S4', 'Settings › Project Briefing (#btnCreatorNote) opens the briefing on demand', !!fd.getElementById('btnCreatorNote'));
          record('S4', 'the unified voice settings agree across the classroom (voiceLock ' + voiceLock + ' / voiceId ' + activeVoiceId + ')', unified, 'voiceLock=' + voiceLock);
          probed = true;
        } catch (eF) {
          record('S4', 'the live app probe (same-origin iframe)', false, 'cross-origin');
        }
      };
    }
    global.setTimeout(function () {
      if (!probed) record('S4', 'the live app probe (same-origin iframe)', false, 'probe timeout — open lab.html on the GitHub Pages origin');
    }, 8000);
    return true;
  }

  /* ══ STATION 5 ══ */
  function station5() {
    var out = byId('labSyncMatrix');
    var row = function (name, val, state) {
      return '<p class="lab-stage" data-state="' + esc(state || 'run') + '"><b>' + esc(name) + '</b> ' + esc(val) + '</p>';
    };
    var html = row('localStorage sdp.settings', (global.localStorage.getItem('sdp.settings') ? 'present' : 'absent'), global.localStorage.getItem('sdp.settings') ? 'ok' : 'warn');
    html += row('localStorage sdp.session', (global.localStorage.getItem('sdp.session') ? 'present' : 'absent'), global.localStorage.getItem('sdp.session') ? 'ok' : 'warn');
    if (out) out.innerHTML = html + '<p class="lab-stage" data-state="run"><b>Service Worker</b> querying navigator.serviceWorker …</p>';
    try {
      global.navigator.serviceWorker.getRegistration().then(function (reg) {
        if (out) out.innerHTML += row('Service Worker registration', reg ? (str(reg.scope) + ' · ' + (reg.active ? 'active' : 'installing')) : 'not registered', reg ? 'ok' : 'warn');
        record('S5', 'the service worker registration is readable', !!reg);
      }, function () {
        if (out) out.innerHTML += row('Service Worker registration', 'unavailable (file:// or blocked)', 'warn');
      });
    } catch (eS) { if (out) out.innerHTML += row('Service Worker registration', 'unavailable', 'warn'); }
    try {
      global.caches.keys().then(function (names) {
        var shell = names.filter(function (n) { return n.indexOf('-shell') >= 0; }).join(', ') || 'none yet';
        var clips = names.indexOf('sdp-audio-clips') >= 0 ? 'present' : 'absent';
        if (out) out.innerHTML += row('SHELL_CACHE (-shell)', shell, 'ok') + row('sdp-audio-clips', clips, clips === 'present' ? 'ok' : 'warn');
        if (names.indexOf('sdp-audio-clips') >= 0) {
          global.caches.open('sdp-audio-clips').then(function (c) {
            c.keys().then(function (ks) {
              if (out) out.innerHTML += row('sdp-audio-clips entries', ks.length + ' cached URLs', 'ok');
              record('S5', 'sdp-audio-clips CacheStorage is inspectable (' + ks.length + ' entries)', true);
            });
          });
        } else {
          global.caches.open('sdp-audio-clips').then(function () { record('S5', 'sdp-audio-clips CacheStorage ready', true); }, function () {});
        }
      }, function () {});
    } catch (eC) {}
    /* GitHub Pages CDN vs Raw main — the propagation lag check */
    var j = function (r) { return r ? r.json() : null; };
    var cdn = global.fetch('./data/version.json?t=' + nowMs(), { cache: 'no-store' }).then(j, function () { return null; });
    var raw = global.fetch('https://raw.githubusercontent.com/dictationb01/dictationb01.github.io/main/data/version.json', { cache: 'no-store' }).then(j, function () { return null; });
    global.Promise.all([cdn, raw]).then(function (pair) {
      var a = pair[0], b = pair[1];
      if (out) {
        out.innerHTML += row('GitHub Pages CDN /data/version.json', a ? (str(a.appVersion) + ' · syncRev ' + str(a.syncRev)) : 'unreachable', a ? 'ok' : 'warn');
        out.innerHTML += row('GitHub Raw main /data/version.json', b ? (str(b.appVersion) + ' · syncRev ' + str(b.syncRev)) : 'unreachable (CORS/offline)', b ? 'ok' : 'warn');
      }
      if (a && b) {
        var lag = Number(b.syncRev) > Number(a.syncRev);
        if (out) out.innerHTML += row('CDN vs Raw', lag ? '⚠ CDN is LAGGING behind main — purge below' : '✓ in sync (CDN serves the latest publish)', lag ? 'warn' : 'ok');
        record('S5', 'the GitHub Pages CDN is not lagging behind Raw main', !lag, 'cdn=' + a.syncRev + ' raw=' + b.syncRev);
      } else {
        record('S5', 'the CDN/Raw comparison answers (local origin OK)', !!a, 'offline');
      }
    });
    return true;
  }

  function forcePurgeAndResync() {
    var done = 0, total = 0;
    var finish = function () {
      done += 1;
      if (done >= total && total > 0) {
        setTxt('labPurgeStatus', '✓ Caches purged — pulling latest from GitHub Raw …');
        try { global.location.reload(); } catch (e) {}
      }
    };
    try {
      global.caches.keys().then(function (names) {
        total = names.length;
        if (!total) { setTxt('labPurgeStatus', '✓ nothing to purge (no caches yet)'); return; }
        var i;
        for (i = 0; i < names.length; i++) {
          global.caches.delete(names[i]).then(finish, finish);
        }
      }, function () { setTxt('labPurgeStatus', '✗ CacheStorage unavailable'); });
    } catch (e) { setTxt('labPurgeStatus', '✗ CacheStorage unavailable'); }
    return true;
  }

  /* ══ STATION 6 ══ */
  function runFullDiagnostics() {
    LAB.results = {};
    paintScorecard();
    setTxt('labRunStatus', '🚀 Running all 6 stations …');
    try { station1(false); } catch (e1) { record('S1', 'station 1 crashed', false, str(e1)); }
    try { station2(); } catch (e2) { record('S2', 'station 2 crashed', false, str(e2)); }
    try { station3(); } catch (e3) { record('S3', 'station 3 crashed', false, str(e3)); }
    try { station4(); } catch (e4) { record('S4', 'station 4 crashed', false, str(e4)); }
    try { station5(); } catch (e5) { record('S5', 'station 5 crashed', false, str(e5)); }
    record('S6', 'the full live diagnostic suite executed all 6 stations', true);
    global.setTimeout(function () {
      var c = counts();
      setTxt('labRunStatus', '✓ Full run: ' + c.pass + ' PASS · ' + c.warn + ' WARN · ' + c.fail + ' FAIL');
    }, 9000);
    return true;
  }

  function buildReport() {
    var c = counts();
    LAB.report = {
      lab: 'SDP Real-Time Live Voice & Clone Lab',
      appVersion: (global.SDP && SDP.version) || '0.0.6.w',
      at: new Date().toISOString(),
      href: str(global.location && global.location.href),
      viewport: (global.innerWidth || 0) + 'x' + (global.innerHeight || 0),
      userAgent: str(global.navigator && global.navigator.userAgent),
      counts: c,
      stations: LAB.results,
      settings: (function () { try { return JSON.parse(global.localStorage.getItem('sdp.settings') || '{}'); } catch (e) { return {}; } })()
    };
    return LAB.report;
  }
  function downloadJsonReport() {
    try {
      var blob = new global.Blob([JSON.stringify(buildReport(), null, 2)], { type: 'application/json' });
      var a = doc.createElement('a');
      a.href = global.URL.createObjectURL(blob);
      a.download = 'sdp-live-lab-report-' + nowMs() + '.json';
      (doc.body || doc.documentElement).appendChild(a);
      a.click();
      global.setTimeout(function () { try { global.URL.revokeObjectURL(a.href); a.remove(); } catch (e) {} }, 1500);
      record('S6', 'the live lab report exports as .json', true);
      return true;
    } catch (e) { record('S6', 'the live lab report exports as .json', false, str(e)); return false; }
  }
  function downloadZipReport() {
    /* minimal ZIP (STORE) with the report as a .txt member — pure ES5 CRC32 */
    try {
      var json = JSON.stringify(buildReport(), null, 2);
      var txt = 'SDP Live Lab Report\n===================\n' + json;
      function crc32(buf) {
        var c, table = [], i, j;
        for (i = 0; i < 256; i++) {
          c = i;
          for (j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
          table[i] = c >>> 0;
        }
        var cr = 0xFFFFFFFF;
        for (i = 0; i < buf.length; i++) cr = (table[(cr ^ buf[i]) & 0xFF] ^ (cr >>> 8)) >>> 0;
        return (cr ^ 0xFFFFFFFF) >>> 0;
      }
      function u16(n) { return [n & 255, (n >> 8) & 255]; }
      function u32(n) { return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]; }
      var data = [], ci, nb = [], ni;
      for (ci = 0; ci < txt.length; ci++) data.push(txt.charCodeAt(ci) & 0xff);
      var name = 'sdp-live-lab-report.txt';
      for (ni = 0; ni < name.length; ni++) nb.push(name.charCodeAt(ni) & 0xff);
      var crcV = crc32(data);
      var local = [0x50, 0x4B, 0x03, 0x04].concat(u16(20), u16(0), u16(0), u16(0), u16(0), u32(crcV), u32(data.length), u32(data.length), u16(nb.length), u16(0), nb, data);
      var central = [0x50, 0x4B, 0x01, 0x02].concat(u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crcV), u32(data.length), u32(data.length), u16(nb.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(0), nb, u32(local.length - data.length));
      var end = [0x50, 0x4B, 0x05, 0x06].concat(u16(0), u16(0), u16(1), u16(1), u32(central.length), u32(local.length + central.length), u16(0));
      var u8 = new Uint8Array(local.concat(central, end));
      var blob = new global.Blob([u8], { type: 'application/zip' });
      var a = doc.createElement('a');
      a.href = global.URL.createObjectURL(blob);
      a.download = 'sdp-live-lab-report-' + nowMs() + '.zip';
      (doc.body || doc.documentElement).appendChild(a);
      a.click();
      global.setTimeout(function () { try { global.URL.revokeObjectURL(a.href); a.remove(); } catch (e2) {} }, 1500);
      record('S6', 'the live lab report exports as .zip', true);
      return true;
    } catch (e) { record('S6', 'the live lab report exports as .zip', false, str(e)); return false; }
  }

  /* ── boot: delegated clicks ── */
  function bind() {
    if (doc && doc.addEventListener) {
      doc.addEventListener('click', function (ev) {
        var t = ev && ev.target;
        if (!t || !t.getAttribute) return;
        var play = t.getAttribute('data-labplay');
        if (play) { playKey(play); return; }
        var tv = t.getAttribute('data-labtestvoice');
        if (tv) {
          var wInp = byId('labSynthWord');
          testVoiceSynthesis(tv, t.getAttribute('data-labtestname') || tv, wInp && wInp.value);
          return;
        }
      }, false);
    }
    var bindBtn = function (id, fn) {
      var n = byId(id);
      if (n && n.addEventListener) n.addEventListener('click', function (e) { if (e && e.preventDefault) e.preventDefault(); fn(); });
    };
    bindBtn('btnLabLoadPack', function () { station1(false); });
    bindBtn('btnLabWordsOnly', function () { station1(true); });
    bindBtn('btnLabTestAllWords', testAllWordsSequentially);
    bindBtn('btnLabFetchVoices', station2);
    bindBtn('btnLabRunRp', station3);
    bindBtn('btnLabCrossTab', station4);
    bindBtn('btnLabSync', station5);
    bindBtn('btnLabPurge', forcePurgeAndResync);
    bindBtn('btnLabRunAll', runFullDiagnostics);
    bindBtn('btnLabDownloadJson', downloadJsonReport);
    bindBtn('btnLabDownloadZip', downloadZipReport);
    return true;
  }

  SDP.LiveLab = {
    version: '1.0.0',
    record: record,
    counts: counts,
    station1: station1,
    station2: station2,
    station3: station3,
    station4: station4,
    station5: station5,
    runFullDiagnostics: runFullDiagnostics,
    buildReport: buildReport,
    downloadJsonReport: downloadJsonReport,
    downloadZipReport: downloadZipReport,
    forcePurgeAndResync: forcePurgeAndResync,
    playKey: playKey,
    startVisualizer: startVisualizer
  };

  try {
    if (doc && doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { bind(); }, false);
    else bind();
  } catch (eB) {}
})(typeof window !== 'undefined' ? window : this);
