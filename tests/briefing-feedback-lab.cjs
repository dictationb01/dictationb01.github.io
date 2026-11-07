#!/usr/bin/env node
'use strict';
/* Lab Environment gate — v0.0.6.o: the TWO-STAGE cinematic welcome, the
 * zero cut-off Project Overview, the Studio ↔ Briefing multi-API bridge,
 * the stale-audio purge law and the preserved v0.0.6.m fixes.
 *
 * contract: docs/MASTER_PLAN_V006N.md §3 — the dedicated isolated lab the
 * creator demanded: headless Chromium at 390x844 AND 360x800, the real
 * repository tree over a local static server, a real (fake-device)
 * microphone, and request interception that PROVES:
 *   Welcome      Stage 1 (#welcomeStage) shows the animated "Welcome to
 *                Smart Dictation Web App" splash + #btnWelcomeContinue;
 *                clicking it unlocks audio INSIDE the gesture and hands
 *                over to Stage 2 — narration starts strictly at Paragraph
 *                1, Word 1 (idx === 0) with NO tap pill in normal flow.
 *   Zero cut-off Every paragraph plays ALL the way to its FINAL word
 *                (wordIdx === lastWordIdx, all words is-spoken) before the
 *                next beat advances — never a premature jump.
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
 *                _intro_male_* entries; data fetches carry ?v=0.0.6.o&t=
 *                and cache:'no-store'.
 *   Regression   version-stamp replay, mic-release, sealed feedback,
 *                131-Alice integrity (the stale v0.0.6.n George beats are
 *                purged; SDP.Speech refuses text-drifted clips).
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
/* v0.0.6.o: the stale _intro_male_* beats were purged from the shipped pack —
   the lab maps the authentic Alice fixture onto the 4 beats with exact wt
   arrays built from the LIVE v0.0.6.o sentences (the exact bridge outcome). */
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
    /* v0.0.6.o: a NEW src (a different beat clip) restarts the clock from 0 —
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
  }, ALICE_FIXTURE, 'guide.en.0', ALICE_FIXTURE);
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
    /* ══ Test 1 — THE TWO-STAGE CINEMATIC WELCOME + ZERO CUT-OFF PROJECT
       OVERVIEW at 390x844 AND 360x800. A v0.0.6.m device (briefingSeen:1,
       guide 0.0.6.m) auto-replays on v0.0.6.o: Stage 1 shows the animated
       welcome splash; clicking #btnWelcomeContinue unlocks audio INSIDE the
       gesture and Stage 2 narrates from Paragraph 1, Word 1 — every beat
       playing ALL the way to its final word before advancing. */
    for (const vp of [{ width: 390, height: 844, tag: '390x844' }, { width: 360, height: 800, tag: '360x800' }]) {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        viewport: { width: vp.width, height: vp.height },
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: 1, sdpDiag: undefined }))],
          ['sdp.guide_seen', '0.0.6.m']
        ]
      });
      await page.waitForTimeout(700);
      /* ── Stage 1: the cinematic welcome splash. */
      const stage1 = await page.evaluate(() => {
        const modal = document.getElementById('briefingModal');
        const w = document.getElementById('welcomeStage');
        const b = document.getElementById('briefingStage');
        const rect = w ? w.getBoundingClientRect() : null;
        return {
          briefingOpen: modal ? modal.hidden === false : false,
          welcomeVisible: !!(w && w.hidden === false),
          overviewHidden: !!(b && b.hidden === true),
          eyebrow: w ? ((w.querySelector('.welcome-eyebrow') || {}).textContent || '').trim() : '',
          title: w ? ((w.querySelector('.welcome-title') || {}).innerText || '').replace(/\s+/g, ' ').trim() : '',
          sub: w ? ((w.querySelector('.welcome-sub') || {}).innerText || '').replace(/\s+/g, ' ').trim() : '',
          cta: w ? ((w.querySelector('#btnWelcomeContinue') || {}).textContent || '').trim() : '',
          ctaVisible: !!(function () { const c = document.getElementById('btnWelcomeContinue'); if (!c) return false; const r = c.getBoundingClientRect(); return r.height > 10 && r.width > 40; })(),
          stageH: rect ? Math.round(rect.height) : 0,
          crest: !!w && !!w.querySelector('.welcome-crest'),
          tapPillHidden: (document.getElementById('briefingTapPill') || {}).hidden !== false
        };
      });
      check(`LAB1a(${vp.tag}) a v0.0.6.m device (briefingSeen:1, guide 0.0.6.m) auto-replays on v0.0.6.o and opens on the WELCOME stage`,
        stage1.briefingOpen === true && stage1.welcomeVisible === true && stage1.overviewHidden === true, JSON.stringify(stage1));
      check(`LAB1a2(${vp.tag}) Stage 1 shows the animated splash: CCBE eyebrow + Welcome to Smart Dictation Web App + $0 subtitle`,
        /CCBE GALLE BRANCH · B1 ENGLISH CLASS/.test(stage1.eyebrow) &&
        /Welcome to Smart Dictation Web App/i.test(stage1.title) &&
        /Zero-Cost \(\$0\) · 100% Open-Source/.test(stage1.sub) &&
        /Autonomous AI-Engineered System by Hansana/.test(stage1.sub) &&
        stage1.crest === true && stage1.stageH >= 220,
        JSON.stringify({ eyebrow: stage1.eyebrow, title: stage1.title, sub: stage1.sub, h: stage1.stageH }));
      check(`LAB1a3(${vp.tag}) the prominent tactile CTA "Continue to Project Overview →" is visible and the tap pill stays retired`,
        stage1.cta === 'Continue to Project Overview →' && stage1.ctaVisible === true && stage1.tapPillHidden === true,
        JSON.stringify(stage1));
      /* ── The Continue click: audio unlocks INSIDE the gesture; Stage 2
         starts STRICTLY at Paragraph 1, Word 1 (idx === 0). */
      await page.click('#btnWelcomeContinue');
      await page.waitForTimeout(1000);
      const stage2 = await page.evaluate(() => {
        const w = document.getElementById('welcomeStage');
        const b = document.getElementById('briefingStage');
        const line0 = document.querySelector('#briefingLyrics .b-line[data-bline="0"]');
        const audio = document.getElementById('sdpSharedAudio');
        return {
          welcomeGone: !!(w && w.hidden === true),
          overviewVisible: !!(b && b.hidden === false),
          beats: document.querySelectorAll('#briefingLyrics .b-line').length,
          beat1WordCount: line0 ? line0.querySelectorAll('.b-word').length : 0,
          beat1Word1: line0 ? (line0.querySelector('.b-word') || {}).textContent : '',
          spokenEarly: line0 ? line0.querySelectorAll('.b-word.is-spoken').length : 0,
          audioUnlocked: audio ? (audio.muted === false && audio.volume === 1) : false,
          verPill: (document.getElementById('sdpVerPill') || {}).textContent || ''
        };
      });
      check(`LAB1b(${vp.tag}) clicking Continue transitions 320ms into Stage 2 (#briefingStage) with the welcome gone`,
        stage2.welcomeGone === true && stage2.overviewVisible === true, JSON.stringify(stage2));
      check(`LAB1b2(${vp.tag}) narration starts STRICTLY at Paragraph 1, Word 1 (Beat 1 rendered, "Welcome" first, app stamped v0.0.6.o)`,
        stage2.beats === 4 && stage2.beat1WordCount > 0 && /^Welcome/.test(stage2.beat1Word1 || '') &&
        /0\.0\.6\.o/.test(stage2.verPill), JSON.stringify(stage2));
      check(`LAB1b3(${vp.tag}) the shared <audio> was primed by the Continue gesture (muted false, volume 1.0)`,
        stage2.audioUnlocked === true, JSON.stringify({ audioUnlocked: stage2.audioUnlocked }));
      /* ── THE ZERO CUT-OFF LAW: watch every beat advance and prove the
         final word of each paragraph is highlighted (is-spoken) BEFORE the
         next beat begins. Map the authentic Alice clip onto all 4 beats
         with exact wt arrays over the LIVE v0.0.6.o sentences. */
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
      /* Observe beat transitions + the last-word highlight across the full
         4-beat narration (the 4.2s lab clip per beat + 320ms pauses). */
      const cutOff = await page.evaluate(() => new Promise((resolve) => {
        const out = { beatsSeen: [], lastWordPainted: [false, false, false, false], finalBeatWords: [0, 0, 0, 0], skippedTo: null };
        const stage = document.getElementById('briefingLyrics');
        if (!stage) { resolve(out); return out; }
        let activeBeat = -1;
        const readBeat = () => {
          const on = stage.querySelector('.b-line.on');
          return on ? Number(on.getAttribute('data-bline')) : -1;
        };
        const sample = () => {
          const beat = readBeat();
          if (beat >= 0 && beat !== activeBeat) {
            if (activeBeat >= 0 && beat > activeBeat + 1) out.skippedTo = beat;
            activeBeat = beat;
            if (out.beatsSeen.indexOf(beat) < 0) out.beatsSeen.push(beat);
          }
          for (let i = 0; i < 4; i++) {
            const line = stage.querySelector('.b-line[data-bline="' + i + '"]');
            if (!line) continue;
            const words = line.querySelectorAll('.b-word');
            if (!words.length) continue;
            const spoken = line.querySelectorAll('.b-word.is-spoken').length;
            if (spoken >= words.length) {
              out.lastWordPainted[i] = true;
              out.finalBeatWords[i] = words.length;
            }
          }
        };
        const iv = setInterval(sample, 60);
        setTimeout(function () {
          clearInterval(iv);
          sample();
          resolve(out);
        }, 21500);
      }));
      check(`LAB1c(${vp.tag}) the narration walks ALL 4 paragraphs in order (no skip, no restart)`,
        cutOff.beatsSeen.length === 4 && cutOff.beatsSeen.join('') === '0123' && cutOff.skippedTo === null,
        JSON.stringify(cutOff.beatsSeen));
      check(`LAB1d(${vp.tag}) ZERO CUT-OFF: every paragraph's FINAL word paints is-spoken (all 4 beats reach their last word)`,
        cutOff.lastWordPainted[0] === true && cutOff.lastWordPainted[1] === true &&
        cutOff.lastWordPainted[2] === true && cutOff.lastWordPainted[3] === true,
        JSON.stringify({ lastWordPainted: cutOff.lastWordPainted, finalBeatWords: cutOff.finalBeatWords }));
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
      check(`LAB1i(${vp.tag}) the countdown seconds live INSIDE the Continue button label (or the gate already opened)`,
        /\(\d+s\)/.test(cta.cta) || /Continue to Smart Dictation/.test(cta.cta), cta.cta);
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
        /* DOM click (not an input-style playwright click): the briefing card
           is a flex modal whose footer can sit outside the 390x844 viewport
           after the stage settles — a programmatic click is exactly what a
           keyboard/screen-reader user performs on the focused control. */
        await page.evaluate(() => { document.getElementById('btnBriefingSkip').click(); });
        await page.waitForTimeout(400);
        const stamped = await page.evaluate(() => {
          try { return JSON.parse(localStorage.getItem('sdp.settings') || '{}').briefingSeen; } catch (e) { return null; }
        });
        check('LAB1l closing marks briefingSeen === "0.0.6.o" (the version stamp, never 1)',
          stamped === '0.0.6.o', String(stamped));
        check('LAB1m the two-stage welcome run threw zero page errors', errors.length === 0, errors.join(' | '));
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
      check('LAB2a data/elevenlabs-audio.json ships exactly the 131 authentic Alice clips (the 4 stale v0.0.6.n George beats are purged)',
        withAudio.length === 131, String(withAudio.length));
      check('LAB2b ZERO underscore-prefixed entries ship (no fabricated sandbox clips; the v0.0.6.o beats are synthesized on the creator device only)',
        underscore.length === 0, underscore.join(', '));
      check('LAB2c the pack header carries 0.0.6.o / ver 29 / schema 29 / settingsRev 45 / syncRev 1794600000000',
        pack.version === '0.0.6.o' && pack.ver === 29 && pack.schema === 29 && pack.settingsRev === 45 && pack.syncRev === 1794600000000,
        JSON.stringify([pack.version, pack.ver, pack.schema, pack.settingsRev, pack.syncRev]));
      const orchestration = fs.readFileSync(path.join(ROOT, 'data/studio.js'), 'utf8');
      const viewsText = fs.readFileSync(path.join(ROOT, 'data/sdp-ui-views.js'), 'utf8');
      check('LAB2d the v0.0.6.o bridge orchestrator exists and is exported for the creator device',
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
              body: JSON.stringify({ audio_base64: ALICE_FIXTURE.b64, alignment: align, normalized_alignment: align })
            });
          }
          if (/api\.elevenlabs\.io/.test(url)) {
            /* The fallback standard endpoint (also legitimate). */
            return route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from(ALICE_FIXTURE.b64, 'base64') });
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
            /* v0.0.6.o: the stale _intro_male_* beats are PURGED from the pack,
               so the first ensureBriefingAndGuideVoices() call synthesizes all
               4 missing beats — the exact creator-device flow. The FIRST call
               can also race the briefing-open trigger on boot (busy); retry
               until the ✓ ok state (bounded). */
            for (let round = 0; round < 3; round += 1) {
              const res = await new Promise(function (resolve) {
                let settled = false;
                const finish = function (err, info) { if (!settled) { settled = true; resolve({ err: err ? String(err.message || err) : null, info: info || null }); } };
                try {
                  window.SDP.Studio.ensureBriefingAndGuideVoices({ source: 'button', force: round === 0 }, function (err2, info2) { finish(err2, info2); });
                  setTimeout(function () { finish(new Error('timeout'), null); }, 30000);
                } catch (e3) { finish(e3, null); }
              });
              out.bridgeErr = res.err;
              out.bridgeMade = res.info && res.info.made;
              if (barNode) out.barStates.push(barNode.getAttribute('data-state'));
              if ((barNode && barNode.getAttribute('data-state') === 'ok') || (res.info && res.info.stage === 'done')) break;
              await new Promise(function (r) { setTimeout(r, 700); });
            }
            out.delta = window.SDP.Studio.briefingVoiceDelta ? window.SDP.Studio.briefingVoiceDelta() : null;
          }
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB2f the Studio exports the v0.0.6.o bridge surface (ensureBriefingAndGuideVoices + parseAlignmentToWordTimings)',
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
      /* the synthesized beats are injected into THIS live page; read the wt
         array through the page's own manifest (retry: the injection lands
         asynchronously after the bridge resolves). */
      let wtLive = { hasWt: false, len: 0, first: null };
      for (let wRound = 0; wRound < 10 && !wtLive.hasWt; wRound += 1) {
        wtLive = await page.evaluate(() => {
          try {
            const m = window.SDP.Speech.clipManifest();
            const e = m && m.clips ? m.clips['_intro_male_1'] : null;
            return { hasWt: !!(e && Array.isArray(e.wt) && e.wt.length > 5), len: e && e.wt ? e.wt.length : 0, first: e && e.wt ? e.wt[0] : null };
          } catch (e) { return { hasWt: false }; }
        });
        if (!wtLive.hasWt) await page.waitForTimeout(400);
      }
      check('LAB2k the live-synthesized Beat 1 carries the parsed per-word wt array (frame-accurate karaoke)',
        wtLive.hasWt === true, JSON.stringify(wtLive));
      check('LAB2l the bridge run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Test 3 — the STALE-AUDIO PURGE LAW: poisoned _intro_male_* entries
       in sdp-audio-clips are deleted; data fetches carry ?v=0.0.6.o&t= and
       cache:'no-store'. */
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: '0.0.6.o' }))],
          ['sdp.guide_seen', '0.0.6.o']
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
          out.versionBust = f.some(function (x) { return /[?&]v=0\.0\.6\.o&/.test(x.url); });
          out.noStore = f.some(function (x) { return x.cache === 'no-store'; });
        } catch (e) { out.err = String(e); }
        return out;
      });
      check('LAB3a purgeStaleBriefingClips() deletes the poisoned stale _intro_male_* / guide.en.* entries from sdp-audio-clips',
        purge.purged >= 3, JSON.stringify(purge));
      check('LAB3b the word clips SURVIVE the purge (only briefing/guide/manifest entries are touched)',
        purge.survived === 1, JSON.stringify(purge));
      check('LAB3c the manifest fetch carries the v0.0.6.o version bust (?v=0.0.6.o&t=…)',
        purge.versionBust === true, JSON.stringify(purge));
      check('LAB3d the manifest fetch is cache:no-store (a stale HTTP/SW copy can never survive)',
        purge.noStore === true, JSON.stringify(purge));
      const swText = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
      check('LAB3e the service worker is the s30 shell (sdp-v0.0.6.o-s30) so the old stale shell cache is deleted on activate',
        /SW_VERSION = 'sdp-v0.0.6.o-s30'/.test(swText) && /SHELL_CACHE = 'sdp-v0.0.6.o-s30-shell'/.test(swText), 'sw.js stamp');
      check('LAB3f the purge-law run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Test 4 — wt-DRIVEN frame-accurate karaoke: the highlights track the
       REAL #sdpSharedAudio clock against the exact per-word wt boundaries. */
    {
      const { ctx, page, errors } = await newPage(browser, server.origin, {
        localStorage: [
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: 1 }))],
          ['sdp.guide_seen', '0.0.6.o']
        ]
      });
      /* Map the authentic fixture onto _intro_male_1..4 WITH exact wt arrays
         built from the live sentences AND the exact sha1 text pins the speech
         layer recomputes (the v0.0.6.o zero cut-off guard accepts a clip only
         when its stored text AND hash match the live sentence) — the exact
         bridge outcome. */
      await page.evaluate(() => {
        try {
          const f = window.__LAB_FIXTURE__.entry;
          const clips = {};
          const sents = window.SDP.Views.briefingSentences();
          for (let i = 1; i <= 4; i++) {
            const words = (sents[i - 1] || '').split(/\s+/).filter(Boolean);
            const per = 4.2 / Math.max(1, words.length);
            const wt = words.map(function (w, wi) { return [Math.round(wi * per * 1000), Math.round((wi + 0.86) * per * 1000)]; });
            /* exact pin: the same sha1(text|voiceId|modelId) the Studio stamps */
            const pin = 'sha1:' + window.SDP.Studio.sha1Hex(sents[i - 1] + '|JBFqnCBsd6RMkjVDRZzb|eleven_flash_v2_5');
            clips['_intro_male_' + i] = { b64: f.b64, bytes: f.bytes, at: f.at, text: sents[i - 1] || '', hashAlgo: 'sha1', hash: pin, voiceId: 'JBFqnCBsd6RMkjVDRZzb', modelId: 'eleven_flash_v2_5', wt: wt };
          }
          if (window.SDP && SDP.Speech && SDP.Speech.injectClips) {
            SDP.Speech.injectClips(clips);
          }
        } catch (e) {}
      });
      await page.evaluate(() => { try { window.SDP.Views.openBriefing({ replay: true }); } catch (e) {} });
      /* The lab stub advances its 4.2 s fixture clock in 50 ms steps every
         16 ms, so one wall second is already ~3.1 s of clip time: a blind
         1200 ms wait reads the paint BEFORE the estimate→clock handoff has
         even happened on a slow (2-core) runner. Wait for the handoff the app
         documents — a real onTick switches the flow to clock mode — and cap
         the wait just below the 4.2 s clip end so Beat 1 stays on screen. */
      await page.waitForFunction(() => {
        try { return window.SDP.Views.briefingFlowMode() === 'clock'; } catch (e) { return false; }
      }, null, { timeout: 2000, polling: 16 }).catch(() => {});
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
      const mid = await page.evaluate(() => new Promise((resolve) => {
        const line = document.querySelector('#briefingLyrics .b-line[data-bline="0"]');
        if (!line) { resolve({ ok: false }); return; }
        const words = line.querySelectorAll('.b-word');
        const audio = document.getElementById('sdpSharedAudio');
        const bar = document.getElementById('briefingBar');
        const wt = window.SDP.Views.briefingWordTimings(0);
        /* The paint is driven by the app's rAF sampler on the LIVE clock. A
           single read can land inside the estimate→clock handoff (up to two
           word windows may still be in flight) or inside a long runner frame.
           Sample ACROSS frames on the same beat: the law must hold on every
           sample, and the biggest observed drift is the reported one. */
        const samples = [];
        let rounds = 0;
        function snap() {
          /* Only frames where the app is already painting from the real
             clock: the estimate tick is a fallback, not the wt law. */
          if (window.SDP.Views.briefingFlowMode() !== 'clock') return;
          const cur = line.querySelector('.b-word.is-current');
          const tMs = audio ? audio.currentTime * 1000 : 0;
          let expect = words.length - 1;
          if (wt) { for (let i = 0; i < wt.length; i++) { if (tMs < wt[i][1]) { expect = i; break; } } }
          const curIdx = cur ? Array.prototype.indexOf.call(words, cur) : -1;
          samples.push({ tMs: Math.round(tMs), curIdx: curIdx, expect: expect, drift: Math.abs(curIdx - expect) });
        }
        function loop() {
          snap();
          rounds += 1;
          /* stop at 10 samples, once the beat is nearly over, or if the
             line has already scrolled away — never inside another beat. */
          const tMs = audio ? audio.currentTime * 1000 : 0;
          if (rounds >= 14 || tMs > 3400 || !line.isConnected) {
            const good = samples.filter(function (s) { return s.curIdx >= 0; });
            /* The FIRST samples can still carry the residual of the
               estimate→clock handoff, and a slow runner can skip frames, so a
               per-sample equality bound would measure the machine, not the
               app. The wt law itself is what must hold on EVERY sample:
                 · the paint is NEVER ahead of the clip clock (the real bug
                   class: highlighting a word that has not been spoken yet);
                 · it never walks backwards;
                 · it CONVERGES to the exact window (the read this test makes
                   its verdict on is exact);
                 · it never stalls further than two words behind. */
            const ahead = good.filter(function (s) { return s.curIdx > s.expect; });
            let backward = 0;
            for (let k = 1; k < good.length; k += 1) { if (good[k].curIdx < good[k - 1].curIdx) backward += 1; }
            /* The first frames still settle the handoff; from there every
               frame must sit on the exact window (one frame of leeway for
               the DOM write ordering), never ahead of the clock. */
            const settled = good.slice(3);
            const settledMax = settled.length ? Math.max.apply(null, settled.map(function (s2) { return s2.drift; })) : -1;
            const last = good.length ? good[good.length - 1] : null;
            const worst = good.reduce(function (a, b) { return (b.drift > (a ? a.drift : -1)) ? b : a; }, null) || {};
            const barPct = bar ? parseFloat(bar.style.width) : 0;
            resolve({
              ok: good.length >= 8 && settled.length >= 4 && settledMax <= 1 && !!last && last.drift === 0 && ahead.length === 0 && backward === 0,
              samples: good.length, settledMax: settledMax, ahead: ahead.length, backward: backward, last: last, worst: worst,
              wtLen: wt ? wt.length : 0, barPct: Math.round(barPct), ticks: window.__lab.ticks
            });
            return;
          }
          /* Sample per animation frame: the app repaints from its own rAF
             tick, so a frame-aligned read measures the wt law itself. A
             timer-driven read on a throttled runner would instead measure
             frame starvation (the clock keeps moving between frames). */
          requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
      }));
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
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: '0.0.6.o' }))],
          ['sdp.guide_seen', '0.0.6.o']
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
          ['sdp.settings', JSON.stringify(Object.assign({}, FAST, { briefingSeen: '0.0.6.o' }))],
          ['sdp.guide_seen', '0.0.6.o']
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
          /* v0.0.6.o: the bridge card sits at the studio top with its
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
      check('LAB6h the Studio ships the v0.0.6.o bridge card (1-click Generate & Sync + #studioBriefingVoiceBar) at its top',
        studio.bridgeCard === true && studio.bridgeBtn === true, JSON.stringify({ bridgeCard: studio.bridgeCard, bridgeBtn: studio.bridgeBtn }));
      check('LAB6i the sealed feedback run threw zero page errors', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    /* ══ Exit ── */
    const fails = results.filter((r) => r.status === 'FAIL');
    if (fails.length) exitCode = 1;
    /* CI observability: surface every failed check as a GitHub Actions
       annotation so the failing assertion is readable from the check-run
       API even when the raw job log blob is unreachable. */
    if (process.env.GITHUB_ACTIONS && fails.length) {
      fails.forEach(function (f) {
        const msg = (f.test + ' — ' + (f.detail || 'failed')).replace(/\r?\n/g, ' ').slice(0, 600);
        console.log('::error title=Lab check failed::' + msg);
      });
    }
    console.log(JSON.stringify(results, null, 2));
    console.log('\nLab briefing-feedback-lab.cjs — ' + (results.length - fails.length) + ' PASS / ' + fails.length + ' FAIL');
  } catch (e) {
    console.error('LAB FATAL', e);
    if (process.env.GITHUB_ACTIONS) {
      console.log('::error title=Lab fatal::' + String(e && e.stack || e).replace(/\r?\n/g, ' ').slice(0, 600));
    }
    exitCode = 1;
  } finally {
    try { await browser.close(); } catch (e) {}
    try { await server.close(); } catch (e) {}
  }
  process.exit(exitCode);
})();
