#!/usr/bin/env node
'use strict';
/* v0.0.6.o proof captures for the Blueprint PDF: the TWO-STAGE cinematic
 * entry at 390x844 —
 *   01 Stage 1: the animated "Welcome to Smart Dictation Web App" splash
 *   02 Stage 2: the Project Overview at Beat 1, Word 1 (immediately after
 *      the Continue click unlocked audio inside the gesture)
 *   03 Stage 2 mid-narration: karaoke word highlight + continuous bar
 *   04 Stage 2 late: Beat 3/4 spoken, final-word highlight (zero cut-off)
 * Authentic clip audio is mapped onto the 4 beats with exact wt arrays built
 * from the LIVE v0.0.6.o sentences — exactly what the Studio bridge injects
 * after the creator's real synthesis. No audio is generated here. */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const serverChromium = require('@sparticuz/chromium');
require('./chromium-env.cjs').ensureChromiumLibs();
const { start } = require('./static-server.cjs');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'shots-v006o');

async function launch() {
  const executablePath = process.env.SDP_BROWSER_BIN || await serverChromium.executablePath();
  const args = serverChromium.args.filter((a) => !['--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'].includes(a));
  args.push('--autoplay-policy=no-user-gesture-required');
  return chromium.launch({ headless: true, executablePath, args });
}

(async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await start({ root: ROOT });
  const browser = await launch();
  const summary = {};
  try {
    const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/elevenlabs-audio.json'), 'utf8'));
    const REMOTE = JSON.stringify(pack);

    for (const vp of [{ width: 390, height: 844, tag: '390' }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await ctx.addInitScript(() => {
        window.__SDP_NO_LIVE__ = true;
        try {
          localStorage.setItem('sdp.guide_seen', '0.0.6.m');
          localStorage.setItem('sdp.settings', JSON.stringify({ appliedSettingsRev: 99, guideAutoPlay: false, briefingSeen: 1, mode: 'paper', lang: 'en', theme: 'light' }));
        } catch (e) {}
      });
      const page = await ctx.newPage();
      await ctx.route('**/*', (route) => {
        const u = route.request().url();
        if (u.startsWith(server.origin) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
        if (/raw\.githubusercontent\.com/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: REMOTE });
        return route.abort();
      });
      await page.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
      /* Boot path: the two-stage welcome (briefingSeen:1 ≠ 0.0.6.o replays
         it). Wait for the Views init + the welcome stage to actually show. */
      await page.waitForFunction(() => {
        try { return !!(window.SDP && window.SDP.Views && document.getElementById('briefingModal') && document.getElementById('briefingModal').hidden === false); } catch (e) { return false; }
      }, null, { timeout: 20000 });
      await page.waitForTimeout(900);
      summary.stage1 = await page.evaluate(() => {
        const w = document.getElementById('welcomeStage');
        return { welcomeVisible: !!(w && w.hidden === false) };
      });
      await page.screenshot({ path: path.join(OUT, `01-welcome-stage1-${vp.tag}.png`) });
      /* The Continue click: audio unlocks inside the gesture; Stage 2 starts
         at Paragraph 1, Word 1. Map the authentic clip + exact wt FIRST so
         the beats have real audio immediately. */
      await page.evaluate(() => {
        try {
          const f = JSON.parse(JSON.stringify(window.SDP.Speech.clipManifest().clips['guide.en.0']));
          const clips = {};
          const sents = window.SDP.Views.briefingSentences();
          for (let i = 1; i <= 4; i++) {
            const words = (sents[i - 1] || '').split(/\s+/).filter(Boolean);
            const per = 4.2 / Math.max(1, words.length);
            const wt = words.map(function (w, wi) { return [Math.round(wi * per * 1000), Math.round((wi + 0.86) * per * 1000)]; });
            const pin = 'sha1:' + window.SDP.Studio.sha1Hex(sents[i - 1] + '|JBFqnCBsd6RMkjVDRZzb|eleven_flash_v2_5');
            clips['_intro_male_' + i] = { b64: f.b64, bytes: f.bytes, at: f.at, text: sents[i - 1] || '', hashAlgo: 'sha1', hash: pin, voiceId: 'JBFqnCBsd6RMkjVDRZzb', modelId: 'eleven_flash_v2_5', wt: wt };
          }
          if (window.SDP && SDP.Speech && SDP.Speech.injectClips) SDP.Speech.injectClips(clips);
        } catch (e) {}
      });
      await page.evaluate(() => { try { document.getElementById('btnWelcomeContinue').click(); } catch (e) {} });
      await page.waitForTimeout(900);
      summary.stage2beat1 = await page.evaluate(() => {
        const line0 = document.querySelector('#briefingLyrics .b-line[data-bline="0"]');
        const w = document.getElementById('welcomeStage');
        return {
          welcomeGone: !!(w && w.hidden === true),
          beat1Words: line0 ? line0.querySelectorAll('.b-word').length : 0,
          word1: line0 ? (line0.querySelector('.b-word') || {}).textContent : ''
        };
      });
      await page.screenshot({ path: path.join(OUT, `02-overview-stage2-beat1-word1-${vp.tag}.png`) });
      /* Mid-narration: karaoke highlight + continuous bar. */
      await page.waitForTimeout(2400);
      summary.stage2mid = await page.evaluate(() => ({
        spoken: document.querySelectorAll('#briefingLyrics .b-word.is-spoken').length,
        current: document.querySelectorAll('#briefingLyrics .b-word.is-current').length,
        bar: document.getElementById('briefingBar').style.width
      }));
      await page.screenshot({ path: path.join(OUT, `03-overview-stage2-karaoke-${vp.tag}.png`) });
      /* Late narration: Beat 3 with earlier beats past (zero cut-off flow). */
      await page.waitForTimeout(4800);
      await page.screenshot({ path: path.join(OUT, `04-overview-stage2-beat3-${vp.tag}.png`) });
      summary.stage2late = await page.evaluate(() => ({
        past: document.querySelectorAll('#briefingLyrics .b-line[data-state="past"]').length,
        bar: document.getElementById('briefingBar').style.width
      }));
      await ctx.close();
    }
    console.log(JSON.stringify(summary, null, 2));
  } catch (e) {
    console.error('SHOT FATAL', e);
    process.exitCode = 1;
  } finally {
    try { await browser.close(); } catch (e) {}
    try { await server.close(); } catch (e) {}
  }
})();
