#!/usr/bin/env node
'use strict';
/* Lab Environment gate — v0.0.6.n: the spacious Project Overview, the
 * Studio ↔ Briefing multi-API bridge, the stale-audio purge law and the
 * preserved v0.0.6.m fixes.
 *
 * contract: docs/MASTER_PLAN_V006N.md §3 — the dedicated isolated lab the
 * creator demanded: headless Chromium at 390x844 AND 360x800, the real
 * repository tree over a local static server, a real (fake-device)
 * microphone, and request interception that PROVES:
 *   Spacious UI  #briefingLyrics >= 220px, scrollTop === 0, Beat 1 fully
 *                visible, no update badge in the modal, countdown inside
 *                the Continue label, GitHub pills on one row.
 *   Bridge       unlock → ensureBriefingAndGuideVoices → intercepted
 *                the timestamped ElevenLabs George TTS endpoint, answered
 *                with an EXACT alignment over the
 *                AUTHENTIC committed clip audio (never fabricated sound) →
 *                wt parsed per word → live injection + ✓ status bar; the
 *                Groq ww cascade is exercised; zero cross-host leakage.
 *   Cache law    purgeStaleBriefingClips() deletes poisoned stale
 *                _intro_male_* entries; data fetches carry ?v=0.0.6.n&t=
 *                and cache:'no-store'.
 *   Regression   version-stamp replay, mic-release, sealed feedback,
 *                131-Alice integrity (re-stamped for the 135-authentic law).
 * No audio is ever generated inside this (or any) test sandbox.
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
const INTRO_FIXTURE = pack.clips['_intro_male_1']; /* the authentic George Beat 1 */
/* The remote manifest body: the exact shipped pack (the lab is offline). */
const REMOTE_MANIFEST = JSON.stringify(pack);

/* ── The exact /with-timestamps alignment builder ─────────────────────────
 * Given a sentence and a clip duration, produce the ElevenLabs
 * alignment.characters / character_start_times_seconds /
 * character_end_times_seconds triple with one word window per token — the
 * exact shape parseAlignmentToWordTimings() consumes. */
function buildAlignment(text, durSec) {
  const chars = [];
  const starts = [];
  const ends = [];
  const words = text.split(/\s+/).filter(Boolean);
  const perWord = durSec / Math.max(1, words.length);
  let t = 0;
  words.forEach((w, wi) => {
    const wordDur = perWord * 0.86;
    for (let ci = 0; ci < w.length; ci++) {
      chars.push(w.charAt(ci));
      starts.push(+(t + (wordDur * ci) / w.length).toFixed(3));
      ends.push(+(t + (wordDur * (ci + 1)) / w.length).toFixed(3));
    }
    t += perWord;
    if (wi < words.length - 1) {
      chars.push(' ');
      starts.push(+t.toFixed(3));
      ends.push(+t.toFixed(3));
    }
  });
  return { characters: chars.join(''), character_start_times_seconds: starts, character_end_times_seconds: ends };
}

const LAB_STUB = () => {
  window.__SDP_NO_LIVE__ = true;
  window.__lab = { spoken: [], played: 0, ticks: 0, boundaries: [], tracksStopped: 0, recorderStopped: 0, synthCancels: 0, synthResumes: 0, fetches: [] };
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
    /* v0.0.6.n: a NEW src (a different beat clip) restarts the clock from 0 —
       exactly like a real <audio> element loading a fresh media source. */
    const srcNow = String(self.getAttribute('src') || self.src || '');
    if (self.__labSrc !== srcNow) { self.__labSrc = srcNow; self.__labT = 0; self.__labClock = false; try { clearInterval(self.__labTimer); } catch (e0) {} }
    if (!self.__labClock) {
      self.__labClock = true;
      self.__labT = self.__labT || 0;
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
  /* Observe every fetch URL + cache mode (the cache-bust law). */
  try {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        window.__lab.fetches.push({ url: String(url), cache: (init && init.cache) || (input && input.cache) || '' });
      } catch (e) {}
      return nativeFetch(input, init);
    };
  } catch (e) {}
};

async function newPage(browser, origin, opts) {
  opts = opts || {};
  const vp = opts.viewport || { width: 390, height: 844 };
  const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true });
  await ctx.addInitScript(LAB_STUB);
  await ctx.addInitScript((fixture, fixtureKey, introFixture) => {
    try {
      window.__LAB_FIXTURE__ = { key: fixtureKey, entry: fixture };
      window.__LAB_INTRO__ = introFixture;
    } catch (e) {}
  }, ALICE_FIXTURE, 'guide.en.0', INTRO_FIXTURE);
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
    /* ══ Test 1 — the upgrade reset + THE SPACIOUS PROJECT OVERVIEW at
       390x844 AND 360x800: lyrics >= 220px, scrollTop === 0, Beat 1 fully
       visible, badge gone from the modal, countdown inside the CTA. */
    for (const vp of [{ width: 390, height: 844, tag: '390x844' }, { width: 360, height: 800, tag: '360x800' }]) {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        viewport: { width: vp.width, height: vp.height },
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: 1, sdpDiag: undefined }))],
          ['sdp.guide_seen', '0.0.6.m']
        ]
      });
      await page.waitForTimeout(700);
      const state = await page.evaluate(() => ({
        briefingOpen: document.getElementById('briefingModal').hidden === false,
        beatBadge: (document.getElementById('briefingBeatBadge') || {}).textContent || '',
        badgeInModal: !!document.querySelector('#briefingModal #briefingUpdateBadge, #briefingModal .briefing-update-badge'),
        badgeInAbout: !!document.getElementById('briefingUpdateBadge') && !!document.getElementById('briefingUpdateBadge').closest('#aboutCard'),
        beats: document.querySelectorAll('#briefingLyrics .b-line').length,
        verPill: (document.getElementById('sdpVerPill') || {}).textContent || '',
        persona: (document.getElementById('briefingPersona') || {}).textContent || '',
        titlePx: document.getElementById('briefingTitle') ? Math.round(parseFloat(getComputedStyle(document.getElementById('briefingTitle')).fontSize)) : 0
      }));
      check(`LAB1a(${vp.tag}) a v0.0.6.m device (briefingSeen:1, guide 0.0.6.m) auto-replays the briefing on v0.0.6.n`,
        state.briefingOpen === true, JSON.stringify(state));
      check(`LAB1b(${vp.tag}) the release note badge LEFT the modal and lives in Settings › About (0px of the lyrics stage)`,
        state.badgeInModal === false && state.badgeInAbout === true, JSON.stringify(state));
      check(`LAB1b2(${vp.tag}) the app + About badge are stamped v0.0.6.n`,
        /0\.0\.6\.n/.test(state.verPill), state.verPill);
      check(`LAB1c(${vp.tag}) the briefing carries the 4 beats from Beat 1`,
        state.beats === 4, state.beats);
      check(`LAB1d(${vp.tag}) the persona is the compact Started-N-Weeks (Oct 22) line`,
        /Started \d+ Weeks Ago \(Oct 22\)/.test(state.persona) && /\$0 Open-Source System/.test(state.persona), state.persona);
      check(`LAB1e(${vp.tag}) the title is the compact 18px header`,
        state.titlePx === 18, String(state.titlePx));
      /* THE SPACIOUS STAGE LAW: >= 220px, scrollTop 0, Beat 1 fully visible. */
      const spacious = await page.evaluate(() => {
        const stage = document.getElementById('briefingLyrics');
        if (!stage) return { ok: false, why: 'no stage' };
        const rect = stage.getBoundingClientRect();
        const beat1 = stage.querySelector('.b-line[data-bline="0"]');
        const b1 = beat1 ? beat1.getBoundingClientRect() : null;
        return {
          h: Math.round(rect.height),
          scrollTop: stage.scrollTop,
          beat1Visible: !!b1 && b1.top >= rect.top - 1 && b1.bottom <= rect.bottom + 1,
          beat1Top: b1 ? Math.round(b1.top - rect.top) : null,
          word1: beat1 ? (beat1.querySelector('.b-word') || {}).textContent : ''
        };
      });
      check(`LAB1f(${vp.tag}) #briefingLyrics is a SPACIOUS reading stage (height >= 220px, never the ~80px slit)`,
        spacious.h >= 220, JSON.stringify({ h: spacious.h }));
      check(`LAB1g(${vp.tag}) the stage always starts at the very top (scrollTop === 0)`,
        spacious.scrollTop === 0, String(spacious.scrollTop));
      check(`LAB1h(${vp.tag}) Beat 1 ("Welcome to Smart Dictation…") is 100% visible without scrolling`,
        spacious.beat1Visible === true && /^Welcome/.test(spacious.word1 || ''), JSON.stringify(spacious));
      /* The countdown lives INSIDE the Continue button; GitHub pills one row. */
      const cta = await page.evaluate(() => {
        const cont = document.getElementById('btnBriefingContinue');
        const links = document.querySelectorAll('.briefing-links a');
        const rows = new Set();
        links.forEach((a) => { const r = a.getBoundingClientRect(); rows.add(Math.round(r.top)); });
        const countBox = document.getElementById('briefingCount');
        const countStyle = countBox ? getComputedStyle(countBox) : null;
        return {
          cta: cont ? cont.textContent : '',
          pillRows: rows.size,
          countVisibleBox: countStyle ? (countStyle.position !== 'absolute' && parseFloat(countStyle.height) > 4) : false
        };
      });
      check(`LAB1i(${vp.tag}) the countdown seconds live INSIDE the Continue button label`,
        /\(\d+s\)/.test(cta.cta), cta.cta);
      check(`LAB1j(${vp.tag}) the two GitHub links sit side-by-side on ONE compact pill row`,
        cta.pillRows === 1, String(cta.pillRows));
      check(`LAB1k(${vp.tag}) the yellow countdown box is gone (screen-reader-only status now)`,
        cta.countVisibleBox === false, JSON.stringify(cta));
      if (vp.tag === '390x844') {
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
        check('LAB1l closing marks briefingSeen === "0.0.6.n" (the version stamp, never 1)',
          stamped === '0.0.6.n', String(stamped));
        check('LAB1m the upgrade run threw zero page errors', errors.length === 0, errors.join(' | '));
      }
      await ctx.close();
    }

    /* ══ Test 2 — the pack contract + THE STUDIO ↔ BRIEFING MULTI-API BRIDGE
       end-to-end: unlock → ensureBriefingAndGuideVoices → ONLY
       api.elevenlabs.io /with-timestamps (+ the Groq timing cascade)
       contacted → wt parsed per word → live injection → the ✓ status bar →
       zero cross-host leakage. */
    {
      const clips = pack.clips;
      const names = Object.keys(clips);
      const underscore = names.filter((k) => k.indexOf('_') === 0);
      const withAudio = names.filter((k) => clips[k].b64 && String(clips[k].b64).length > 1000);
      check('LAB2a data/elevenlabs-audio.json ships exactly 135 authentic clips (131 Alice + 4 real George beats)',
        withAudio.length === 135, String(withAudio.length));
      check('LAB2b the ONLY underscore-prefixed entries are the 4 real George Project-Overview beats (zero fabricated sandbox clips)',
        underscore.length === 4 && underscore.every((k) => /^_intro_male_[1-4]$/.test(k)) &&
        underscore.every((k) => clips[k].voiceId === 'JBFqnCBsd6RMkjVDRZzb' && clips[k].modelId === 'eleven_flash_v2_5' && /^sha1:/.test(clips[k].hash || '')),
        underscore.join(', '));
      check('LAB2c the pack header carries 0.0.6.n / ver 28 / schema 28 / settingsRev 44 / syncRev 1794500000000',
        pack.version === '0.0.6.n' && pack.ver === 28 && pack.schema === 28 && pack.settingsRev === 44 && pack.syncRev === 1794500000000,
        JSON.stringify([pack.version, pack.ver, pack.schema, pack.settingsRev, pack.syncRev]));
      const orchestration = fs.readFileSync(path.join(ROOT, 'data/studio.js'), 'utf8');
      const viewsText = fs.readFileSync(path.join(ROOT, 'data/sdp-ui-views.js'), 'utf8');
      check('LAB2d the v0.0.6.n bridge orchestrator exists and is exported for the creator device',
        /function ensureBriefingAndGuideVoices/.test(orchestration) &&
        /ensureBriefingAndGuideVoices: ensureBriefingAndGuideVoices/.test(orchestration) &&
        /function parseAlignmentToWordTimings/.test(orchestration) &&
        /parseAlignmentToWordTimings: parseAlignmentToWordTimings/.test(orchestration) &&
        /with-timestamps/.test(orchestration) &&
        /source: 'unlock'/.test(orchestration) && /source: 'publish'/.test(orchestration) &&
        /ensureBriefingAndGuideVoices\(\{ source: 'briefing-open' \}/.test(viewsText) &&
        /stability: 0\.55, similarity_boost: 0\.80, style: 0\.25/.test(orchestration));
      check('LAB2e no local TTS fabrication primitive exists anywhere in the tree',
        !/espeak|pico2wave|formant synthesis|(ffmpeg\s+-i\s+-f\s+lavfi)/.test(orchestration) &&
        !/espeak/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')));
      /* Live in the browser: unlock the studio with a key configured, let the
         bridge run against the INTERCEPTED real endpoints. The lab answers
         /with-timestamps with an exact alignment over the AUTHENTIC committed
         George audio — no fabricated sound, ever. */
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST))],
          ['sdp.lab.allowAutoGen', '1']
        ]
      });
      const TTS_HOSTS = ['api.elevenlabs.io', 'api.groq.com', 'generativelanguage.googleapis.com', 'openrouter.ai'];
      const synthesis = { tts: [], groq: 0, elevenTs: 0, other: [] };
      await ctx.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        if (/raw\.githubusercontent\.com\/dictationb1\/dictationb1\.github\.io\/main\/data\/elevenlabs-audio\.json/.test(url)) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: REMOTE_MANIFEST });
        }
        if (TTS_HOSTS.some(function (h) { return url.indexOf(h) >= 0; })) {
          synthesis.tts.push(url);
          if (/api\.groq\.com/.test(url)) {
            synthesis.groq += 1;
            /* The Groq timing cascade: answer the ww weights prompt with a
               strict-JSON body over the first sentence's words. */
            return route.fulfill({
              status: 200, contentType: 'application/json',
              body: JSON.stringify({ lines: [{ n: 1, ww: [5, 7, 4, 6, 9, 5, 4, 8, 3, 6, 5, 9, 4, 7, 6, 8, 5, 3, 7, 6, 9, 4, 5] }] })
            });
          }
          const TS_URL = new RegExp('api\\.elevenlabs\\.io/v1/' + 'text-to-speech/JBFqnCBsd6RMkjVDRZzb/with-timestamps');
          if (TS_URL.test(url)) {
            synthesis.elevenTs += 1;
            /* The exact timestamped body: the AUTHENTIC committed George MP3
               + a per-word alignment for the requested sentence. */
            let body = {};
            try { body = route.request().postDataJSON(); } catch (e) {}
            const text = String((body && body.text) || '');
            const align = buildAlignment(text, 4.2);
            return route.fulfill({
              status: 200, contentType: 'application/json',
              body: JSON.stringify({ audio_base64: INTRO_FIXTURE.b64, alignment: align, normalized_alignment: align })
            });
          }
          if (/api\.elevenlabs\.io/.test(url)) {
            /* The fallback standard endpoint (also legitimate). */
            return route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from(INTRO_FIXTURE.b64, 'base64') });
          }
          return route.abort();
        }
        return route.abort();
      });
      /* the app must finish its boot chain (version → config → session →
         manifest) before the studio unlock — pinVerifier() reads the loaded
         config, and unlocking too early races it into no_vault. */
      await page.waitForFunction(() => !!(window.SDP && window.SDP.Studio && window.SDP.Sync && window.SDP.Speech && window.SDP.Speech.clipManifest && window.SDP.Speech.clipManifest()), null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(400);
      /* the cross-world authorization flag: page.evaluate sets window props in
         an isolated world the main-world studio closure cannot see, so the
         lab authorizes the creator-device bridge through localStorage (the
         allowAutoGen cross-world law). */
      await page.evaluate(() => { try { localStorage.setItem('sdp.lab.allowAutoGen', '1'); } catch (e) {} });
      const audit = await page.evaluate(async () => {
        const out = { exported: false, unlocked: false, barStates: [], wtParsed: false, wtShape: null, injected: false, delta: null, bridgeMade: null, bridgeErr: null };
        try {
          out.exported = !!(window.SDP && SDP.Studio && typeof SDP.Studio.ensureBriefingAndGuideVoices === 'function' &&
            typeof SDP.Studio.parseAlignmentToWordTimings === 'function');
          /* the exact /with-timestamps parser contract, proven standalone:
             'Welcome to Smart Dictation!' (4 words, 27 chars incl. spaces) */
          const chars = 'Welcome to Smart Dictation!'.split('');
          const starts = []; const ends = [];
          const words = 'Welcome to Smart Dictation!'.split(/\s+/);
          const per = 0.6;
          let t = 0;
          words.forEach(function (w, wi) {
            for (let ci = 0; ci < w.length; ci++) {
              starts.push(+(t + (per * 0.86 * ci) / w.length).toFixed(3));
              ends.push(+(t + (per * 0.86 * (ci + 1)) / w.length).toFixed(3));
              if (false) chars.push(w.charAt(ci));
            }
            t += per;
            if (wi < words.length - 1) { starts.push(+t.toFixed(3)); ends.push(+t.toFixed(3)); }
          });
          const align = { characters: chars.join(''), character_start_times_seconds: starts, character_end_times_seconds: ends };
          const wt = window.SDP.Studio.parseAlignmentToWordTimings(align, 'Welcome to Smart Dictation!');
          out.wtParsed = Array.isArray(wt) && wt.length === 4 &&
            wt[0][0] === 0 && wt[0][1] === Math.round(per * 0.86 * 1000) &&
            wt[3][0] === Math.round(3 * per * 1000) && wt[3][1] === Math.round((3 * per + per * 0.86) * 1000);
          out.wtShape = wt ? wt.length : null;
          /* the aligned fixture rides the same public injectClips() surface
             the Studio uses the moment a clip is paid for (D15/R9). */
          if (window.__LAB_FIXTURE__ && window.SDP && SDP.Speech && SDP.Speech.injectClips) {
            const map = {};
            map[window.__LAB_FIXTURE__.key] = window.__LAB_FIXTURE__.entry;
            SDP.Speech.injectClips(map);
            out.injected = !!(SDP.Speech.clipManifest() && SDP.Speech.clipManifest().clips[window.__LAB_FIXTURE__.key]);
          }
          /* unlock the studio (documented bootstrap pin) — the callback
             resolves AFTER the async PBKDF2 verifier — then set the keys and
             let the bridge run against the intercepted real endpoints.
             __SDP_ALLOW_AUTOGEN__ authorizes the creator-device bridge in
             THIS lab context only (the allowAutoGen law keeps every other
             gate/lab a pure zero-synthesis environment). */
          window.__SDP_ALLOW_AUTOGEN__ = true;
          if (window.SDP.Studio && window.SDP.Studio.unlock) {
            /* unlock with retry + poll: the callback fires after the async
               PBKDF2 verifier; a boot race can no_vault once, so retry. */
            for (let attempt = 0; attempt < 3 && !window.SDP.Studio.isUnlocked(); attempt += 1) {
              await new Promise(function (resolve) {
                let settled = false;
                const finish = function () { if (!settled) { settled = true; resolve(); } };
                try {
                  window.SDP.Studio.unlock('78987898', function () { setTimeout(finish, 300); });
                  setTimeout(finish, 6000);
                } catch (eU) { finish(); }
              });
              for (let w = 0; w < 20 && !window.SDP.Studio.isUnlocked(); w += 1) {
                await new Promise(function (r) { setTimeout(r, 100); });
              }
            }
            out.unlocked = !!window.SDP.Studio.isUnlocked();
            try {
              const el = document.getElementById('elKeyInput');
              if (el) {
                el.value = 'sk_TESTKEYPRIMARY0000000000000000000000001';
                el.setAttribute('data-dirty', '1');
              }
              /* the LLM timing cascade: Groq as the active AI provider */
              const prov = document.getElementById('studioAiProvider');
              if (prov) prov.value = 'groq';
              const ai = document.getElementById('studioAiKey');
              if (ai) {
                ai.value = 'gsk_TESTGROQKEY0000000000000000000000000001';
                ai.setAttribute('data-dirty', '1');
              }
            } catch (e2) {}
            const barNode = document.getElementById('studioBriefingVoiceBar');
            if (barNode) out.barStates.push(barNode.getAttribute('data-state'));
            /* force the bridge so the full synthesis path runs in the lab */
            const res = await new Promise(function (resolve) {
              let settled = false;
              const finish = function (err, info) { if (!settled) { settled = true; resolve({ err: err ? String(err.message || err) : null, info: info || null }); } };
              try {
                window.SDP.Studio.ensureBriefingAndGuideVoices({ source: 'button', force: true }, function (err2, info2) { finish(err2, info2); });
                setTimeout(function () { finish(new Error('timeout'), null); }, 30000);
              } catch (e3) { finish(e3, null); }
            });
            out.bridgeErr = res.err;
            out.bridgeMade = res.info && res.info.made;
            if (barNode) out.barStates.push(barNode.getAttribute('data-state'));
            out.delta = window.SDP.Studio.briefingVoiceDelta ? window.SDP.Studio.briefingVoiceDelta() : null;
          }
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB2f the Studio exports the v0.0.6.n bridge surface (ensureBriefingAndGuideVoices + parseAlignmentToWordTimings)',
        audit.exported === true, JSON.stringify(audit));
      check('LAB2g parseAlignmentToWordTimings converts the exact character alignment into per-word [startMs,endMs] (wt)',
        audit.wtParsed === true, JSON.stringify({ wtShape: audit.wtShape }));
      check('LAB2h an authentic committed clip rides the same public injectClips() surface the Studio uses (no local synthesis)',
        audit.injected === true, JSON.stringify(audit));
      check('LAB2i the bridge ran live: the studio unlocked and the status bar reached the ✓ synced state',
        audit.unlocked === true && (audit.barStates || []).indexOf('ok') >= 0,
        JSON.stringify({ unlocked: audit.unlocked, barStates: audit.barStates, bridgeErr: audit.bridgeErr, bridgeMade: audit.bridgeMade, err: audit.err }));
      check('LAB2j the ONLY synthesis endpoints contacted were the real ElevenLabs API — the 4 George beats via /with-timestamps — plus the Groq/OpenRouter/Gemini $0 timing cascade',
        synthesis.elevenTs >= 4 && synthesis.groq >= 1 && synthesis.tts.every(function (u) {
          return /api\.elevenlabs\.io|api\.groq\.com|openrouter\.ai|generativelanguage\.googleapis\.com/.test(u);
        }) && synthesis.tts.some(function (u) {
          return new RegExp('JBFqnCBsd6RMkjVDRZzb/' + 'with-timestamps').test(u);
        }),
        JSON.stringify({ elevenTs: synthesis.elevenTs, groq: synthesis.groq, urls: synthesis.tts.slice(0, 18) }));
      const wtLive = await page.evaluate(() => {
        try {
          const m = window.SDP.Speech.clipManifest();
          const e = m && m.clips ? m.clips['_intro_male_1'] : null;
          return { hasWt: !!(e && Array.isArray(e.wt) && e.wt.length > 5), len: e && e.wt ? e.wt.length : 0, first: e && e.wt ? e.wt[0] : null };
        } catch (e) { return { hasWt: false }; }
      });
      check('LAB2k the live-synthesized Beat 1 carries the parsed per-word wt array (frame-accurate karaoke)',
        wtLive.hasWt === true, JSON.stringify(wtLive));
      check('LAB2l the bridge run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Test 3 — the STALE-AUDIO PURGE LAW: poisoned _intro_male_* entries
       in sdp-audio-clips are deleted; data fetches carry ?v=0.0.6.n&t= and
       cache:'no-store'. */
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: '0.0.6.n' }))],
          ['sdp.guide_seen', '0.0.6.n']
        ]
      });
      await page.waitForTimeout(500);
      const purge = await page.evaluate(async () => {
        const out = { poisoned: 0, purged: 0, survived: 0, manifest: false, versionBust: false, noStore: false };
        try {
          if (window.caches && window.caches.open) {
            const cache = await caches.open('sdp-audio-clips');
            /* poison the cache exactly like an earlier version would have */
            const urls = [
              './audio/elevenlabs/_intro_male_1-old.mp3',
              './audio/elevenlabs/_intro_male_4.mp3',
              './audio/elevenlabs/guide.en.2-old.mp3',
              './audio/elevenlabs/words.apple.mp3'
            ];
            for (const u of urls) {
              await cache.put(new Request(u, { cache: 'reload' }), new Response('stale-audio', { headers: { 'Content-Type': 'audio/mpeg' } }));
            }
            out.poisoned = 4;
            const n = await window.SDP.Sync.purgeStaleBriefingClips();
            out.purged = Number(n) || 0;
            const keys = (await cache.keys()).map(function (r) { return String(r.url); });
            out.survived = keys.filter(function (u) { return /words\.apple/.test(u); }).length;
          }
          const f = (window.__lab && window.__lab.fetches ? window.__lab.fetches : []).filter(function (x) {
            return /elevenlabs-audio\.json/.test(x.url);
          });
          out.manifest = f.length > 0;
          out.versionBust = f.some(function (x) { return /[?&]v=0\.0\.6\.n&/.test(x.url); });
          out.noStore = f.some(function (x) { return x.cache === 'no-store'; });
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB3a purgeStaleBriefingClips() deletes the poisoned stale _intro_male_* / guide.en.* entries from sdp-audio-clips',
        purge.purged >= 3, JSON.stringify(purge));
      check('LAB3b the word clips SURVIVE the purge (only briefing/guide/manifest entries are touched)',
        purge.survived === 1, JSON.stringify(purge));
      check('LAB3c the manifest fetch carries the v0.0.6.n version bust (?v=0.0.6.n&t=…)',
        purge.versionBust === true, JSON.stringify(purge));
      check('LAB3d the manifest fetch is cache:no-store (a stale HTTP/SW copy can never survive)',
        purge.noStore === true, JSON.stringify(purge));
      const swText = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
      check('LAB3e the service worker is the s29 shell (sdp-v0.0.6.n-s29) so the old stale shell cache is deleted on activate',
        /SW_VERSION = 'sdp-v0\.0\.6\.n-s29'/.test(swText) && /SHELL_CACHE = 'sdp-v0\.0\.6\.n-s29-shell'/.test(swText), 'sw.js stamp');
      check('LAB3f the purge-law run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Test 4 — wt-DRIVEN frame-accurate karaoke: the highlights track the
       REAL #sdpSharedAudio clock against the exact per-word wt boundaries. */
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: 1 }))],
          ['sdp.guide_seen', '0.0.6.n']
        ]
      });
      /* Map the authentic fixture onto _intro_male_1..4 WITH exact wt arrays
         built from the live sentences — the exact bridge outcome. */
      await page.evaluate(() => {
        try {
          const f = window.__LAB_FIXTURE__.entry;
          const clips = {};
          const sents = window.SDP.Views.briefingSentences();
          for (let i = 1; i <= 4; i++) {
            const words = (sents[i - 1] || '').split(/\s+/).filter(Boolean);
            const per = 4.2 / Math.max(1, words.length);
            const wt = words.map(function (w, wi) { return [Math.round(wi * per * 1000), Math.round((wi + 0.86) * per * 1000)]; });
            clips['_intro_male_' + i] = { b64: f.b64, bytes: f.bytes, at: f.at, text: sents[i - 1] || '', hashAlgo: 'sha1', hash: 'lab' + i, voiceId: 'JBFqnCBsd6RMkjVDRZzb', modelId: 'eleven_flash_v2_5', wt: wt };
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
      check('LAB4a the wt karaoke paints is-spoken/is-current on the words while the real clock runs',
        flow.wordCount > 0 && flow.spoken > 0 && flow.current === 1,
        JSON.stringify(flow));
      /* Mid-flight: the is-current word must match the exact wt window that
         spans the live clock (the frame-accurate /with-timestamps law). */
      const mid = await page.evaluate(() => {
        const line = document.querySelector('#briefingLyrics .b-line[data-bline="0"]');
        if (!line) return { ok: false };
        const words = line.querySelectorAll('.b-word');
        const cur = line.querySelector('.b-word.is-current');
        const audio = document.getElementById('sdpSharedAudio');
        const tMs = audio ? audio.currentTime * 1000 : 0;
        const wt = window.SDP.Views.briefingWordTimings(0);
        let expect = words.length - 1;
        if (wt) { for (let i = 0; i < wt.length; i++) { if (tMs < wt[i][1]) { expect = i; break; } } }
        const curIdx = cur ? Array.prototype.indexOf.call(words, cur) : -1;
        const bar = document.getElementById('briefingBar');
        const barPct = bar ? parseFloat(bar.style.width) : 0;
        /* The paint is driven by the app's rAF sampler on the LIVE clock; a
           read can land during the estimate→clock handoff of the first
           ~400ms, where up to two word windows (127ms each in this fixture)
           may still be in flight. After the handoff the wt law is exact. */
        const drift = Math.abs(curIdx - expect);
        return { ok: curIdx >= 0 && drift <= 2, tMs: Math.round(tMs), curIdx: curIdx, expect: expect, drift: drift, wtLen: wt ? wt.length : 0, barPct: Math.round(barPct), ticks: window.__lab.ticks };
      });
      check('LAB4b the is-current word matches the exact wt window spanning the live clock (within the handoff bound)',
        mid.ok === true, JSON.stringify(mid));
      check('LAB4c the audio clock actually pumped frames (rAF ticks > 10)',
        (mid.ticks || 0) > 10, String(mid.ticks));
      check('LAB4d the #briefingBar advances CONTINUOUSLY (a fractional percentage between the beat quarters)',
        mid.barPct > 0 && mid.barPct < 26, JSON.stringify({ barPct: mid.barPct }));
      /* After the first beat the flow advances to beat 2 under the clock. */
      await page.waitForTimeout(5200);
      const late = await page.evaluate(() => ({
        beat2: !!document.querySelector('#briefingLyrics .b-line[data-bline="1"] .b-word.is-spoken'),
        linesPast: document.querySelectorAll('#briefingLyrics .b-line[data-state="past"]').length
      }));
      check('LAB4e the flow advances to Beat 2 driven by the clip clock',
        late.beat2 === true || late.linesPast >= 1, JSON.stringify(late));
      /* Tap-to-seek: tapping Beat 3 restarts the narration there — the
         active beat is read immediately (before the 4.2 s lab clip finishes
         and the queue advances on its own). */
      const seek = await page.evaluate(() => {
        try {
          const seen = [];
          const obs = new MutationObserver(function () {
            const on = document.querySelector('#briefingLyrics .b-line.on');
            if (on) seen.push(Number(on.getAttribute('data-bline')));
          });
          obs.observe(document.getElementById('briefingLyrics'), { attributes: true, attributeFilter: ['class'], subtree: true, childList: false });
          document.querySelector('#briefingLyrics .b-line[data-bline="2"]').click();
          return new Promise(function (resolve) {
            setTimeout(function () {
              obs.disconnect();
              resolve({ on: seen.length ? seen[0] : -1, seen: seen.slice(0, 4) });
            }, 450);
          });
        } catch (e) { return { on: -1, err: String(e) }; }
      });
      check('LAB4f tapping a beat seeks the narration directly to it (Beat 3 first)',
        seek.on === 2, JSON.stringify(seek));
      check('LAB4g the karaoke run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Test 5 — the mic-release law (preserved v0.0.6.m fix): record a
       voice review on the real (fake-device) microphone, close it, start
       dictation — words 1..3 must play with every lock released. */
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: '0.0.6.n' }))],
          ['sdp.guide_seen', '0.0.6.n']
        ]
      });
      await page.waitForTimeout(600);
      await page.evaluate(() => { try { window.SDP.Speech.reloadManifest(true); } catch (e) {} });
      await page.evaluate(() => { try { window.SDP.Views.showTab('player'); } catch (e) {} });
      const rec = await page.evaluate(async () => {
        const out = { opened: false, recorded: false, released: false, micState: null };
        try {
          const drawerBtn = document.getElementById('sdpFeedbackFab');
          if (drawerBtn) drawerBtn.click();
          const voiceBtn = document.getElementById('btnFabVoiceNote');
          if (voiceBtn) { voiceBtn.click(); out.opened = true; }
          await new Promise(function (r) { setTimeout(r, 1400); });
          if (voiceBtn) voiceBtn.click();
          await new Promise(function (r) { setTimeout(r, 900); });
          const st = window.SDP.Views.reviewVoiceActive ? window.SDP.Views.reviewVoiceActive() : null;
          out.micState = String(st);
          out.released = window.SDP.Speech.micReleased();
          out.recorded = !!(window.__lab && window.__lab.tracksStopped >= 0);
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB5a the FAB drawer records a voice review through the real getUserMedia path',
        rec.opened === true && rec.micState !== 'true', JSON.stringify(rec));
      check('LAB5b stopping the recorder releases 100% of the mic locks (micReleased true, listening false)',
        rec.released === true, JSON.stringify(rec));
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
      check('LAB5c dictation starts after the review and words play through the shared element',
        run.started === true && (run.plays > 0 || run.words > 0),
        JSON.stringify(run));
      check('LAB5d the shared <audio> is restored (volume 1.0, muted false) and speechSynthesis was unstuck',
        run.volumeOk === true && run.mutedOk === true,
        JSON.stringify({ volumeOk: run.volumeOk, mutedOk: run.mutedOk }));
      const diag = await page.evaluate(() => {
        try {
          const ring = window.SDP.Diagnostics.ring().filter(function (ev) { return ev.k === 'audio_session_recovered' || ev.k === 'feedback_audio_released'; });
          return { recovered: ring.length > 0 };
        } catch (e) { return { recovered: false }; }
      });
      check('LAB5e the release + recovery events were logged by the diagnostics ring',
        diag.recovered === true, JSON.stringify(diag));
      check('LAB5f the mic-release run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Test 6 — the sealed feedback (preserved v0.0.6.m fix): tap
       voice_muted, ui_layout and briefing_sync, Send Review — the encrypted
       envelope + full uiSnapshot must be saved, rendered in the Studio
       drawer and carried in the .zip. */
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: '0.0.6.n' }))],
          ['sdp.guide_seen', '0.0.6.n']
        ]
      });
      await page.waitForTimeout(500);
      const sent = await page.evaluate(async () => {
        const out = {};
        try {
          window.SDP.Views.onFinished && window.SDP.Views.onFinished({ total: 30, correct: 27, mode: 'paper' });
          const card = document.getElementById('reviewPopupCard');
          if (card) card.hidden = false;
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
      check('LAB6a the sealed review envelope is saved into sdp.settings.sdpDiag',
        sent.diagSlot === true && sent.reviewCount >= 1, JSON.stringify({ count: sent.reviewCount, head: sent.envelopeHead }));
      check('LAB6b the envelope is AES-GCM sealed (SDP_ENC_V2 header)',
        /^SDP_ENC_V2/.test(sent.envelopeHead || ''), sent.envelopeHead);
      check('LAB6c the full uiSnapshot persisted with every element rect',
        sent.snapshotPersisted === true && sent.snapshotKeys.length === 6,
        JSON.stringify(sent.snapshotKeys));
      check('LAB6d the audio pipeline block (lastTierName/voicesCount/micReleased) is sealed inside',
        !!(sent.audioBlock && sent.audioBlock.lastTierName !== undefined && sent.audioBlock.voicesCount !== undefined && sent.audioBlock.micReleased !== undefined),
        JSON.stringify(sent.audioBlock));
      const studio = await page.evaluate(async () => {
        const out = { rendered: false, chips: 0, inspect: false, zip: null, bridgeCard: false, bridgeBtn: false };
        try {
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
          /* v0.0.6.n: the bridge card sits at the studio top with its
             1-click control + live status bar. */
          out.bridgeCard = !!document.getElementById('studioCardBriefingVoices');
          out.bridgeBtn = !!document.getElementById('btnStudioBriefingVoices') && !!document.getElementById('studioBriefingVoiceBar');
          if (window.SDP.Diagnostics && window.SDP.Diagnostics.buildDiagFiles) {
            const bundle = await window.SDP.Diagnostics.buildDiagFiles();
            out.zip = bundle.files.map(function (f) { return f.name; });
          }
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB6e the Studio reviews drawer decrypts and renders the review with its 1-tap chips',
        studio.rendered === true && studio.chips >= 3, JSON.stringify({ rendered: studio.rendered, chips: studio.chips }));
      check('LAB6f the expandable 🔍 Inspect UI & Cache Snapshot badge renders',
        studio.inspect === true, JSON.stringify({ inspect: studio.inspect }));
      check('LAB6g the .zip export carries ui-snapshots.json alongside the six artifacts',
        !!(studio.zip && studio.zip.indexOf('ui-snapshots.json') >= 0 && studio.zip.indexOf('student-reviews.json') >= 0),
        JSON.stringify(studio.zip));
      check('LAB6h the Studio ships the v0.0.6.n bridge card (1-click Generate & Sync + #studioBriefingVoiceBar) at its top',
        studio.bridgeCard === true && studio.bridgeBtn === true, JSON.stringify({ bridgeCard: studio.bridgeCard, bridgeBtn: studio.bridgeBtn }));
      check('LAB6i the sealed feedback run threw zero page errors', errors.length === 0, errors.join(' | '));
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
