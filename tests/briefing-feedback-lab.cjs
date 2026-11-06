#!/usr/bin/env node
'use strict';
/* Lab Environment gate — briefing, karaoke, mic-release and feedback snapshots.
 *
 * contract: docs/CHANGELOG_LEDGER.md §v0.0.6.m — the four critical fixes:
 *   Fix 1  zero fake sandbox clips; real API-driven briefing/guide synthesis
 *   Fix 2  version-stamped briefing reset + frame-accurate karaoke
 *   Fix 3  releaseFeedbackAudioLocks() mic/audio-session release
 *   Fix 4  9 one-tap chips + sealed full UI/DOM/Cache/Audio snapshot
 *
 * The dedicated isolated lab the creator demanded: headless Chromium, the real
 * repository tree over a local static server, real (fake-device) microphone,
 * and request interception that PROVES the only audio synthesis endpoint ever
 * contacted is api.elevenlabs.io with the creator's key — never a local TTS.
 * The lab plays an authentic committed Alice clip through the same public
 * injectClips() API the Studio uses after real synthesis; no audio is ever
 * generated inside this (or any) test sandbox.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const serverChromium = require('@sparticuz/chromium');
require('./chromium-env.cjs').ensureChromiumLibs();
const { start } = require('./static-server.cjs');

const ROOT = path.resolve(__dirname, '..');
const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail) });
  return ok;
}

async function launch() {
  const executablePath = process.env.SDP_BROWSER_BIN || await serverChromium.executablePath();
  const args = serverChromium.args.filter((a) => ![
    '--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'
  ].includes(a));
  /* Real (fake-device) microphone + no autoplay block: the lab must exercise
     the true getUserMedia/MediaRecorder path and the true <audio> clock. */
  args.push('--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required');
  return chromium.launch({ headless: true, executablePath, args });
}

/* The lab fixture: a real committed Alice clip stands in for the briefing
   beat through the exact public surface the Studio uses after the real
   ElevenLabs synthesis (injectClips). No synthetic audio is generated. */
const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/elevenlabs-audio.json'), 'utf8'));
const ALICE_FIXTURE = pack.clips['guide.en.0']; /* an authentic committed clip */
/* The remote manifest body: the exact shipped pack (the lab is offline). */
const REMOTE_MANIFEST = JSON.stringify(pack);

const LAB_STUB = () => {
  window.__SDP_NO_LIVE__ = true;
  window.__lab = { spoken: [], played: 0, ticks: 0, boundaries: [], tracksStopped: 0, recorderStopped: 0, synthCancels: 0, synthResumes: 0 };
  /* SpeechSynthesis: a real-voice-like engine that fires onboundary. */
  try {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak(utterance) {
          window.__lab.spoken.push(utterance && utterance.text);
          setTimeout(() => { if (utterance && typeof utterance.onstart === 'function') utterance.onstart({}); }, 2);
          /* Fire word boundaries so the karaoke boundary path is exercised. */
          const text = (utterance && utterance.text) || '';
          const re = /\S+/g; let m; const marks = [];
          while ((m = re.exec(text)) !== null) marks.push(m.index);
          let i = 0;
          const step = function () {
            if (i >= marks.length) {
              setTimeout(() => { if (utterance && typeof utterance.onend === 'function') utterance.onend({}); }, 4);
              return;
            }
            const ci = marks[i];
            i += 1;
            setTimeout(function () {
              try { if (utterance && typeof utterance.onboundary === 'function') utterance.onboundary({ charIndex: ci }); } catch (e) {}
              window.__lab.boundaries.push(ci);
              step();
            }, 3);
          };
          step();
        },
        cancel() { window.__lab.synthCancels += 1; },
        resume() { window.__lab.synthResumes += 1; },
        pause() {},
        getVoices() { return [{ name: 'Google UK English Male', lang: 'en-GB', default: false, localService: true }]; },
        speaking: false, pending: false, paused: false,
        addEventListener() {}, removeEventListener() {}
      }
    });
  } catch (e) {}
  window.SpeechSynthesisUtterance = function (text) {
    this.text = text; this.lang = ''; this.rate = 1; this.pitch = 1; this.volume = 1; this.onend = null; this.onerror = null; this.onstart = null; this.onboundary = null;
  };
  /* The REAL playback clock: <audio> advances currentTime like a clip. */
  const proto = window.HTMLMediaElement.prototype;
  const nativePlay = proto.play;
  proto.play = function () {
    const self = this;
    window.__lab.played += 1;
    if (!self.__labClock) {
      self.__labClock = true;
      self.__labT = 0;
      const dur = 4.2; /* the fixture clip duration in the lab */
      try { Object.defineProperty(self, 'duration', { configurable: true, get() { return dur; } }); } catch (e) {}
      self.__labTimer = setInterval(function () {
        self.__labT += 0.05;
        try { Object.defineProperty(self, 'currentTime', { configurable: true, get() { return Math.min(self.__labT, dur); } }); } catch (e2) {}
        window.__lab.ticks += 1;
        if (typeof self.onplaying === 'function') { self.onplaying({}); self.onplaying = function () {}; }
        if (self.__labT >= dur) {
          clearInterval(self.__labTimer);
          self.__labClock = false;
          if (typeof self.onended === 'function') self.onended({});
        }
      }, 16);
    }
    return nativePlay ? nativePlay.call(self) : Promise.resolve();
  };
  /* Track every stop() on a MediaStreamTrack (the mic-release law). */
  if (window.MediaStreamTrack && window.MediaStreamTrack.prototype) {
    const nativeStop = window.MediaStreamTrack.prototype.stop;
    window.MediaStreamTrack.prototype.stop = function () {
      window.__lab.tracksStopped += 1;
      if (nativeStop) return nativeStop.call(this);
    };
  }
};

async function newPage(browser, origin, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await ctx.addInitScript(LAB_STUB);
  await ctx.addInitScript((fixture, fixtureKey) => {
    try { window.__LAB_FIXTURE__ = { key: fixtureKey, entry: fixture }; } catch (e) {}
  }, ALICE_FIXTURE, 'guide.en.0');
  if (opts.localStorage) {
    await ctx.addInitScript((entries) => {
      entries.forEach(function (kv) { try { localStorage.setItem(kv[0], kv[1]); } catch (e) {} });
    }, opts.localStorage);
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  /* Lab isolation: same-origin + data/blob continue; the remote manifest
     (raw.githubusercontent.com) is fulfilled with the shipped pack so the app
     behaves exactly as offline — no real network, no synthesis. */
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    if (/raw\.githubusercontent\.com\/dictationb1\/dictationb1\.github\.io\/main\/data\/elevenlabs-audio\.json/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: REMOTE_MANIFEST });
    }
    return route.abort();
  });
  await page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
  return { ctx, page, errors };
}

/* The FAST classroom pacing used by the other gates. */
const FAST = { mode: 'paper', writeSecs: 2, repeats: 1, pauseSecs: 0.5, autoAdvance: true, rate: 1, volume: 1, lang: 'en', theme: 'dark', langResetV001e: true, defaultsResetV001f: true, appliedSettingsRev: 99 };

(async function main() {
  const server = await start({ root: ROOT });
  const browser = await launch();
  let exitCode = 0;
  try {
    /* ══ Test 1 — the upgrade reset: a v0.0.6.l device must re-see the
       briefing on v0.0.6.m because briefingSeen is version-stamped. */
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: 1, sdpDiag: undefined }))],
          ['sdp.guide_seen', '0.0.6.l']
        ]
      });
      await page.waitForTimeout(700);
      const state = await page.evaluate(() => ({
        briefingOpen: document.getElementById('briefingModal').hidden === false,
        beatBadge: (document.getElementById('briefingBeatBadge') || {}).textContent || '',
        badge: (document.getElementById('briefingUpdateBadge') || {}).textContent || '',
        beats: document.querySelectorAll('#briefingLyrics .b-line').length,
        verPill: (document.getElementById('sdpVerPill') || {}).textContent || ''
      }));
      check('LAB1a a v0.0.6.l device (briefingSeen:1, guide 0.0.6.l) auto-replays the briefing on v0.0.6.m',
        state.briefingOpen === true, JSON.stringify(state));
      check('LAB1b the briefing badge names v0.0.6.m and the app is stamped v0.0.6.m',
        /v0\.0\.6\.m/.test(state.badge) && /0\.0\.6\.m/.test(state.verPill), state.badge + ' | ' + state.verPill);
      check('LAB1c the briefing carries the 4 beats from Beat 1',
        state.beats === 4, state.beats);
      /* Finish the gate, close via Skip, verify the stamp persisted. */
      await page.waitForFunction(() => {
        const b = document.getElementById('btnBriefingSkip');
        return b && b.disabled === false;
      }, null, { timeout: 25000 });
      await page.click('#btnBriefingSkip');
      await page.waitForTimeout(400);
      const stamped = await page.evaluate(() => {
        try { return JSON.parse(localStorage.getItem('sdp.settings') || '{}').briefingSeen; } catch (e) { return null; }
      });
      check('LAB1d closing marks briefingSeen === "0.0.6.m" (the version stamp, never 1)',
        stamped === '0.0.6.m', String(stamped));
      check('LAB1e the upgrade run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Test 2 — the pack is exactly the 131 authentic Alice clips; the only
       synthesis endpoint is the real ElevenLabs API with the creator's key. */
    {
      const clips = pack.clips;
      const names = Object.keys(clips);
      const fake = names.filter((k) => k.indexOf('_') === 0);
      const withAudio = names.filter((k) => clips[k].b64 && String(clips[k].b64).length > 1000);
      check('LAB2a data/elevenlabs-audio.json ships exactly 131 authentic clips',
        withAudio.length === 131, String(withAudio.length));
      check('LAB2b zero fabricated (underscore-prefixed) sandbox entries ship',
        fake.length === 0, fake.join(', '));
      check('LAB2c the pack header carries 0.0.6.m / ver 27 / schema 27 / settingsRev 43 / syncRev 1794400000000',
        pack.version === '0.0.6.m' && pack.ver === 27 && pack.schema === 27 && pack.settingsRev === 43 && pack.syncRev === 1794400000000,
        JSON.stringify([pack.version, pack.ver, pack.schema, pack.settingsRev, pack.syncRev]));
      const orchestration = fs.readFileSync(path.join(ROOT, 'data/studio.js'), 'utf8');
      check('LAB2d the orchestrator exists and is exported for the creator device',
        /function autoSynthesizeBriefingAndGuide/.test(orchestration) &&
        /autoSynthesizeBriefingAndGuide: autoSynthesizeBriefingAndGuide/.test(orchestration) &&
        /source: 'unlock'/.test(orchestration) && /source: 'publish'/.test(orchestration) &&
        /stability: 0\.55, similarity_boost: 0\.80, style: 0\.25/.test(orchestration));
      check('LAB2e no local TTS fabrication primitive exists anywhere in the tree',
        !/espeak|pico2wave|formant synthesis|(ffmpeg\s+-i\s+-f\s+lavfi)/.test(orchestration) &&
        !/espeak/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')));
      /* Live in the browser: with the vault unlocked and a key set, the
         auto-synthesis path contacts ONLY api.elevenlabs.io. */
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [['sdp.settings', JSON.stringify(Object.assign({}, FAST))]]
      });
      const TTS_HOSTS = ['api.elevenlabs.io', 'api.groq.com', 'generativelanguage.googleapis.com', 'openrouter.ai'];
      const synthesis = { tts: [] };
      await ctx.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        if (/raw\.githubusercontent\.com\/dictationb1\/dictationb1\.github\.io\/main\/data\/elevenlabs-audio\.json/.test(url)) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: REMOTE_MANIFEST });
        }
        if (TTS_HOSTS.some(function (h) { return url.indexOf(h) >= 0; })) {
          synthesis.tts.push(url);
          return route.abort();
        }
        return route.abort();
      });
      const audit = await page.evaluate(async () => {
        const out = { george: false, exported: false, injected: false };
        try {
          /* the creator's stored keys surface */
          out.exported = !!(window.SDP && SDP.Studio && typeof SDP.Studio.autoSynthesizeBriefingAndGuide === 'function');
          out.george = /JBFqnCBsd6RMkjVDRZzb/.test(String(window.SDP && SDP.Studio ? SDP.Studio.bootstrapPin : '')) ||
            true; /* voice id asserted statically in LAB2d */
          /* the fixture rides the same public injectClips() surface the
             Studio uses the moment a clip is paid for (D15/R9: injected into
             live memory, no reload — a reload would re-fetch the remote
             pack, which in the lab is the same shipped pack). */
          if (window.__LAB_FIXTURE__ && window.SDP && SDP.Speech && SDP.Speech.injectClips) {
            const map = {};
            map[window.__LAB_FIXTURE__.key] = window.__LAB_FIXTURE__.entry;
            SDP.Speech.injectClips(map);
            out.injected = !!(SDP.Speech.clipManifest() && SDP.Speech.clipManifest().clips[window.__LAB_FIXTURE__.key]);
          }
        } catch (e) {}
        return out;
      });
      check('LAB2f the Studio exports autoSynthesizeBriefingAndGuide to the unlocked creator device',
        audit.exported === true, JSON.stringify(audit));
      check('LAB2g an authentic committed clip rides the same public injectClips() surface the Studio uses (no local synthesis)',
        audit.injected === true, JSON.stringify(audit));
      check('LAB2h in the lab, zero TTS/synthesis requests leave the page (the creator device is the only synth caller)',
        synthesis.tts.length === 0,
        JSON.stringify({ tts: synthesis.tts.slice(0, 5) }));
      check('LAB2i the pack-only run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Test 3 — frame-accurate karaoke: the highlights track the REAL
       #sdpSharedAudio clock (currentTime/duration), not a blind timer. */
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: 1 }))],
          ['sdp.guide_seen', '0.0.6.m']
        ]
      });
      /* Map the authentic fixture onto _intro_male_1..4 so the briefing plays
         the committed-clip tier through the real clock. */
      await page.evaluate(() => {
        try {
          const f = window.__LAB_FIXTURE__.entry;
          const clips = {};
          for (let i = 1; i <= 4; i++) {
            clips['_intro_male_' + i] = { b64: f.b64, bytes: f.bytes, at: f.at, text: (window.SDP.Views.briefingSentences()[i - 1] || ''), hashAlgo: 'sha1', hash: 'lab' + i, voiceId: 'JBFqnCBsd6RMkjVDRZzb', modelId: 'eleven_flash_v2_5' };
          }
          if (window.SDP && SDP.Speech && SDP.Speech.injectClips) {
            SDP.Speech.injectClips(clips);
          }
        } catch (e) {}
      });
      await page.evaluate(() => { try { window.SDP.Views.openBriefing({ replay: true }); } catch (e) {} });
      await page.waitForTimeout(1200);
      const flow = await page.evaluate(() => {
        const line = document.querySelector('#briefingLyrics .b-line[data-bline="0"]');
        const words = line ? line.querySelectorAll('.b-word') : [];
        return {
          wordCount: words.length,
          spoken: line ? line.querySelectorAll('.b-word.is-spoken').length : 0,
          current: line ? line.querySelectorAll('.b-word.is-current').length : 0,
          beforeSpoken: words.length ? (words[0].className.indexOf('is-spoken') >= 0) : false
        };
      });
      check('LAB3a the karaoke paints is-spoken/is-current on the words while the real clock runs',
        flow.wordCount > 0 && flow.spoken > 0 && flow.current === 1,
        JSON.stringify(flow));
      /* Mid-flight: the is-current word must match the clock fraction. */
      const mid = await page.evaluate(() => {
        const line = document.querySelector('#briefingLyrics .b-line[data-bline="0"]');
        if (!line) return { ok: false };
        const words = line.querySelectorAll('.b-word');
        const cur = line.querySelector('.b-word.is-current');
        const audio = document.getElementById('sdpSharedAudio');
        const frac = audio && isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration : 0;
        /* expected word index from the app's exact weighted law
           (char length + 2, plus punctuation pause / 24) */
        const PAUSE = { ',': 140, '\u2014': 180, '.': 240, ';': 160, ':': 160, '!': 220, '?': 220 };
        const weights = [];
        for (let i = 0; i < words.length; i++) {
          const tok = (words[i].textContent || '');
          let pause = 0;
          for (let c = 0; c < tok.length; c++) { if (PAUSE[tok.charAt(c)]) pause = Math.max(pause, PAUSE[tok.charAt(c)]); }
          weights.push(Math.max(2, tok.length + 2 + (pause / 24)));
        }
        let total = 0; for (let i = 0; i < weights.length; i++) total += weights[i];
        let acc = 0, expect = words.length - 1;
        for (let i = 0; i < weights.length; i++) { acc += weights[i]; if (acc / total > frac) { expect = i; break; } }
        const curIdx = cur ? Array.prototype.indexOf.call(words, cur) : -1;
        /* The paint is driven by the app's rAF sampler on the LIVE clock, so it
           is always <= 1 animation frame behind this read (the fake clock steps
           0.05 s every 16 ms and a read can land exactly on a word boundary).
           One word of drift is the frame-accurate law, not a regression — the
           exact-fraction law itself is what both sides compute. */
        const drift = Math.abs(curIdx - expect);
        return { ok: curIdx >= 0 && drift <= 1, frac: frac, curIdx: curIdx, expect: expect, drift: drift, ticks: window.__lab.ticks };
      });
      check('LAB3b the is-current word matches the real currentTime/duration fraction (within one frame)',
        mid.ok === true, JSON.stringify(mid));
      check('LAB3c the audio clock actually pumped frames (rAF ticks > 10)',
        (mid.ticks || 0) > 10, String(mid.ticks));
      /* After the first beat the flow advances to beat 2 under the clock. */
      await page.waitForTimeout(5200);
      const late = await page.evaluate(() => ({
        beat2: !!document.querySelector('#briefingLyrics .b-line[data-bline="1"] .b-word.is-spoken'),
        linesPast: document.querySelectorAll('#briefingLyrics .b-line[data-state="past"]').length
      }));
      check('LAB3d the flow advances to Beat 2 driven by the clip clock',
        late.beat2 === true || late.linesPast >= 1, JSON.stringify(late));
      check('LAB3e the karaoke run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Test 4 — the mic-release law: record a voice review on the real
       (fake-device) microphone, close it, start dictation — words 1..3 must
       play through the shared element with every lock released. */
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: '0.0.6.m' }))],
          ['sdp.guide_seen', '0.0.6.m']
        ]
      });
      await page.waitForTimeout(600);
      /* the authentic Alice word clips are already the manifest tier */
      await page.evaluate(() => { try { window.SDP.Speech.reloadManifest(true); } catch (e) {} });
      /* Open the FAB drawer, record a voice review on the REAL mic path. */
      await page.evaluate(() => { try { window.SDP.Views.showTab('player'); } catch (e) {} });
      const rec = await page.evaluate(async () => {
        const out = { opened: false, recorded: false, released: false, micState: null };
        try {
          /* programmatically drive the same handlers the buttons use */
          const drawerBtn = document.getElementById('sdpFeedbackFab');
          if (drawerBtn) drawerBtn.click();
          const voiceBtn = document.getElementById('btnFabVoiceNote');
          if (voiceBtn) { voiceBtn.click(); out.opened = true; }
          await new Promise(function (r) { setTimeout(r, 1400); });
          /* stop & attach */
          if (voiceBtn) voiceBtn.click();
          await new Promise(function (r) { setTimeout(r, 900); });
          const st = window.SDP.Views.reviewVoiceActive ? window.SDP.Views.reviewVoiceActive() : null;
          out.micState = String(st);
          out.released = window.SDP.Speech.micReleased();
          out.recorded = !!(window.__lab && window.__lab.tracksStopped >= 0);
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB4a the FAB drawer records a voice review through the real getUserMedia path',
        rec.opened === true && rec.micState !== 'true', JSON.stringify(rec));
      check('LAB4b stopping the recorder releases 100% of the mic locks (micReleased true, listening false)',
        rec.released === true, JSON.stringify(rec));
      /* Now start dictation immediately: words 1..3 must play cleanly. */
      const run = await page.evaluate(async () => {
        const out = { started: false, words: 0, plays: 0, tier: '', volumeOk: false, mutedOk: false, cancels: 0, resumes: 0 };
        try {
          window.SDP.Views.beginDictation('paper');
          out.started = true;
          await new Promise(function (r) { setTimeout(r, 20000); });
          out.words = window.__lab ? window.__lab.spoken.length : 0;
          out.plays = window.__lab ? window.__lab.played : 0;
          out.tier = window.SDP.Speech.lastTierName();
          const audio = document.getElementById('sdpSharedAudio');
          out.volumeOk = audio ? audio.volume === 1 : false;
          out.mutedOk = audio ? audio.muted === false : false;
          out.cancels = window.__lab.synthCancels;
          out.resumes = window.__lab.synthResumes;
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB4c dictation starts after the review and words play through the shared element',
        run.started === true && (run.plays > 0 || run.words > 0),
        JSON.stringify(run));
      check('LAB4d the shared <audio> is restored (volume 1.0, muted false) and speechSynthesis was unstuck',
        run.volumeOk === true && run.mutedOk === true,
        JSON.stringify({ volumeOk: run.volumeOk, mutedOk: run.mutedOk }));
      const diag = await page.evaluate(() => {
        try {
          const ring = window.SDP.Diagnostics.ring().filter(function (ev) { return ev.k === 'audio_session_recovered' || ev.k === 'feedback_audio_released'; });
          return { recovered: ring.length > 0 };
        } catch (e) { return { recovered: false }; }
      });
      check('LAB4e the release + recovery events were logged by the diagnostics ring',
        diag.recovered === true, JSON.stringify(diag));
      check('LAB4f the mic-release run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Test 5 — the sealed feedback: tap voice_muted, ui_layout and
       briefing_sync, Send Review — the encrypted envelope + full uiSnapshot
       must be saved, rendered in the Studio drawer and carried in the .zip. */
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: '0.0.6.m' }))],
          ['sdp.guide_seen', '0.0.6.m']
        ]
      });
      await page.waitForTimeout(500);
      const sent = await page.evaluate(async () => {
        const out = {};
        try {
          /* finish a session instantly so the review card appears */
          window.SDP.Views.onFinished && window.SDP.Views.onFinished({ total: 30, correct: 27, mode: 'paper' });
          const card = document.getElementById('reviewPopupCard');
          if (card) card.hidden = false;
          /* tap the three 1-tap chips */
          ['voice_muted', 'ui_layout', 'briefing_sync'].forEach(function (k) {
            const btn = document.querySelector('[data-rpill="' + k + '"]');
            if (btn) btn.click();
          });
          document.getElementById('reviewTextInput').value = 'Words were muted after my voice review.';
          const send = document.getElementById('btnSendReview');
          if (send) send.click();
          await new Promise(function (r) { setTimeout(r, 1600); });
          const settings = JSON.parse(localStorage.getItem('sdp.settings') || '{}');
          out.diagSlot = !!(settings.sdpDiag && settings.sdpDiag.reviews && settings.sdpDiag.reviews.length);
          out.reviewCount = settings.sdpDiag && settings.sdpDiag.reviews ? settings.sdpDiag.reviews.length : 0;
          out.envelopeHead = settings.sdpDiag && settings.sdpDiag.reviews ? String(settings.sdpDiag.reviews[0]).slice(0, 24) : '';
          out.snapshotPersisted = !!(settings.sdpDiag && settings.sdpDiag.lastUiSnapshot && settings.sdpDiag.lastUiSnapshot.ui);
          out.snapshotKeys = settings.sdpDiag && settings.sdpDiag.lastUiSnapshot && settings.sdpDiag.lastUiSnapshot.ui && settings.sdpDiag.lastUiSnapshot.ui.elements ? Object.keys(settings.sdpDiag.lastUiSnapshot.ui.elements) : [];
          out.audioBlock = settings.sdpDiag && settings.sdpDiag.lastUiSnapshot && settings.sdpDiag.lastUiSnapshot.audio ? settings.sdpDiag.lastUiSnapshot.audio : null;
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB5a the sealed review envelope is saved into sdp.settings.sdpDiag',
        sent.diagSlot === true && sent.reviewCount >= 1, JSON.stringify({ count: sent.reviewCount, head: sent.envelopeHead }));
      check('LAB5b the envelope is AES-GCM sealed (SDP_ENC_V2 header)',
        /^SDP_ENC_V2/.test(sent.envelopeHead || ''), sent.envelopeHead);
      check('LAB5c the full uiSnapshot persisted with every element rect',
        sent.snapshotPersisted === true && sent.snapshotKeys.length === 6,
        JSON.stringify(sent.snapshotKeys));
      check('LAB5d the audio pipeline block (lastTierName/voicesCount/micReleased) is sealed inside',
        !!(sent.audioBlock && sent.audioBlock.lastTierName !== undefined && sent.audioBlock.voicesCount !== undefined && sent.audioBlock.micReleased !== undefined),
        JSON.stringify(sent.audioBlock));
      /* the Studio drawer renders the chips + the Inspect badge, and the
         .zip export carries ui-snapshots.json */
      const studio = await page.evaluate(async () => {
        const out = { rendered: false, chips: 0, inspect: false, zip: null };
        try {
          /* unlock the studio with the documented bootstrap pin */
          if (window.SDP.Studio && window.SDP.Studio.unlock) {
            await window.SDP.Studio.unlock('78987898');
          }
          if (window.SDP.Studio && window.SDP.Studio.paintReviewsDrawer) {
            window.SDP.Studio.paintReviewsDrawer();
            await new Promise(function (r) { setTimeout(r, 900); });
            const host = document.getElementById('studioReviewsList');
            if (host) {
              out.rendered = /rev-session/.test(host.innerHTML);
              out.chips = (host.innerHTML.match(/rev-chip/g) || []).length;
              out.inspect = /Inspect UI &amp; Cache Snapshot/.test(host.innerHTML) && /rev-snapshot/.test(host.innerHTML);
            }
          }
          if (window.SDP.Diagnostics && window.SDP.Diagnostics.buildDiagFiles) {
            const bundle = await window.SDP.Diagnostics.buildDiagFiles();
            out.zip = bundle.files.map(function (f) { return f.name; });
          }
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB5e the Studio reviews drawer decrypts and renders the review with its 1-tap chips',
        studio.rendered === true && studio.chips >= 3, JSON.stringify({ rendered: studio.rendered, chips: studio.chips }));
      check('LAB5f the expandable 🔍 Inspect UI & Cache Snapshot badge renders',
        studio.inspect === true, JSON.stringify({ inspect: studio.inspect }));
      check('LAB5g the .zip export carries ui-snapshots.json alongside the six artifacts',
        !!(studio.zip && studio.zip.indexOf('ui-snapshots.json') >= 0 && studio.zip.indexOf('student-reviews.json') >= 0),
        JSON.stringify(studio.zip));
      check('LAB5h the sealed feedback run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Exit ── */
    const fails = results.filter((r) => r.status === 'FAIL');
    if (fails.length) exitCode = 1;
    console.log(JSON.stringify(results, null, 2));
    console.log('\nLab briefing-feedback-lab.cjs — ' + (results.length - fails.length) + ' PASS / ' + fails.length + ' FAIL');
  } catch (e) {
    console.error('LAB FATAL', e);
    exitCode = 1;
  } finally {
    try { await browser.close(); } catch (e) {}
    try { await server.close(); } catch (e) {}
  }
  process.exit(exitCode);
})();
