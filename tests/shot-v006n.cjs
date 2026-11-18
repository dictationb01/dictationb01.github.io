#!/usr/bin/env node
'use strict';
/* v0.0.6.n proof captures: the SPACIOUS Project Overview reading stage at
 * 390x844 / 360x800 (Beat 1 spaciously visible from scrollTop 0, word-by-word
 * karaoke, tap-to-seek), the About release-note relocation, the Studio
 * bridge card with its live status bar, and the continuous progress bar. */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const serverChromium = require('@sparticuz/chromium');
require('./chromium-env.cjs').ensureChromiumLibs();
const { start } = require('./static-server.cjs');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'shots-v006n');

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
  const summary = { briefing: {}, about: {}, studio: {}, urls: [] };
  try {
    const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/elevenlabs-audio.json'), 'utf8'));
    const REMOTE = JSON.stringify(pack);

    /* 1 — the SPACIOUS briefing at 390x844 and 360x800: fresh open (Beat 1
       from the top), mid-karaoke word highlight, tap-seek Beat 3. */
    for (const vp of [{ width: 390, height: 844, tag: '390' }, { width: 360, height: 800, tag: '360' }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await ctx.addInitScript(() => {
        window.__SDP_NO_LIVE__ = true;
        try {
          localStorage.setItem('sdp.guide_seen', '0.0.6.o');
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
      await page.waitForTimeout(400);
      /* Fresh open: the briefing replays for this capture (version-stamped). */
      await page.evaluate(() => { try { window.SDP.Views.openBriefing({ replay: true }); } catch (e) {} });
      await page.waitForTimeout(1500);
      summary.briefing['spacious_' + vp.tag] = await page.evaluate(() => {
        const st = document.getElementById('briefingLyrics');
        const r = st.getBoundingClientRect();
        const b1 = st.querySelector('.b-line[data-bline="0"]').getBoundingClientRect();
        return { lyricsH: Math.round(r.height), scrollTop: st.scrollTop, beat1Visible: b1.top >= r.top - 1 && b1.bottom <= r.bottom + 1 };
      });
      await page.screenshot({ path: path.join(OUT, `01-briefing-spacious-beat1-${vp.tag}.png`) });
      /* Mid-karaoke: word highlight + continuous bar. */
      await page.waitForTimeout(2600);
      summary.briefing['karaoke_' + vp.tag] = await page.evaluate(() => ({
        spoken: document.querySelectorAll('#briefingLyrics .b-word.is-spoken').length,
        current: document.querySelectorAll('#briefingLyrics .b-word.is-current').length,
        bar: document.getElementById('briefingBar').style.width
      }));
      await page.screenshot({ path: path.join(OUT, `02-briefing-karaoke-flow-${vp.tag}.png`) });
      /* Tap-to-seek Beat 3. */
      await page.evaluate(() => { try { document.querySelector('#briefingLyrics .b-line[data-bline="2"]').click(); } catch (e) {} });
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(OUT, `03-briefing-tap-seek-beat3-${vp.tag}.png`) });
      /* Close the briefing (finish the 10s gate instantly for capture). */
      await page.evaluate(() => {
        try {
          const m = document.getElementById('briefingModal');
          const b = document.getElementById('btnBriefingSkip');
          if (b) { b.disabled = false; }
          if (window.SDP.Views) { window.SDP.Views.closeBriefing('skip'); }
        } catch (e) {}
      });
      await page.waitForTimeout(300);
      await ctx.close();
    }

    /* 2 — the About card release note (badge relocation proof) at 390x844. */
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.addInitScript(() => {
        window.__SDP_NO_LIVE__ = true;
        try {
          localStorage.setItem('sdp.guide_seen', '0.0.6.o');
          localStorage.setItem('sdp.settings', JSON.stringify({ appliedSettingsRev: 99, guideAutoPlay: false, briefingSeen: '0.0.6.o', mode: 'paper', lang: 'en', theme: 'light' }));
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
      await page.waitForTimeout(400);
      await page.evaluate(() => { try { window.SDP.Views.showTab('settings'); } catch (e) {} });
      await page.waitForTimeout(300);
      summary.about = await page.evaluate(() => ({
        badgeInAbout: !!document.getElementById('briefingUpdateBadge'),
        ver: (document.getElementById('aboutVersion') || {}).textContent || ''
      }));
      await page.evaluate(() => { try { document.getElementById('aboutCard').scrollIntoView({ block: 'start' }); } catch (e) {} });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, '04-about-release-note-390.png') });
      await ctx.close();
    }

    /* 3 — the Studio bridge card at 1280x800 (unlocked studio top). */
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await ctx.addInitScript(() => {
        window.__SDP_NO_LIVE__ = true;
        try {
          localStorage.setItem('sdp.guide_seen', '0.0.6.o');
          localStorage.setItem('sdp.settings', JSON.stringify({ appliedSettingsRev: 99, guideAutoPlay: false, briefingSeen: '0.0.6.o', mode: 'paper', lang: 'en', theme: 'light' }));
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
      await page.waitForTimeout(400);
      await page.evaluate(() => { try { window.SDP.Views.showTab('studio'); } catch (e) {} });
      await page.evaluate(async () => {
        try {
          await new Promise(function (resolve) {
            let settled = false;
            const fin = function () { if (!settled) { settled = true; resolve(); } };
            window.SDP.Studio.unlock('78987898', function () { setTimeout(fin, 250); });
            setTimeout(fin, 8000);
          });
        } catch (e) {}
      });
      await page.waitForTimeout(500);
      summary.studio = await page.evaluate(() => ({
        unlocked: !!(window.SDP.Studio && window.SDP.Studio.isUnlocked && window.SDP.Studio.isUnlocked()),
        bridgeCard: !!document.getElementById('studioCardBriefingVoices'),
        bridgeBtn: !!document.getElementById('btnStudioBriefingVoices'),
        voiceBar: !!document.getElementById('studioBriefingVoiceBar'),
        voiceBarState: (document.getElementById('studioBriefingVoiceBar') || {}).getAttribute('data-state')
      }));
      await page.screenshot({ path: path.join(OUT, '05-studio-bridge-card-1280.png') });
      await ctx.close();
    }

    fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    console.log('shots written to', OUT);
  } catch (e) {
    console.error('SHOT FATAL', e);
    process.exitCode = 1;
  } finally {
    try { await browser.close(); } catch (e) {}
    try { await server.close(); } catch (e) {}
  }
})();
