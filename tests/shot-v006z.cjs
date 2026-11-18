#!/usr/bin/env node
'use strict';
/* v0.0.6.z — the release screenshot capture: Z4 lock overlay (armed), the
 * Studio word-count select + session meta card + audit banner + lock button,
 * the Live Lab v4.0 ALL-PASS board, and the app Home. */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.SDP_SHOT_DIR || path.join(ROOT, '..', 'shots-v006z');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const chromium = require('playwright-core').chromium;
  const serverChromium = require('@sparticuz/chromium');
  require('./chromium-env.cjs').ensureChromiumLibs();
  const { start } = require('./static-server.cjs');
  const server = await start({ root: ROOT });
  const executablePath = process.env.SDP_BROWSER_BIN || await serverChromium.executablePath();
  const args = serverChromium.args.filter((a) => !['--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'].includes(a));
  const browser = await chromium.launch({ headless: true, executablePath, args });
  const names = [];
  try {
    /* ── Leg 1: the app — Home, the armed lock overlay, the Studio cards ── */
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.error('pageerror:', e.message));
      await ctx.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      await page.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2600);

      /* 1. Home */
      let f = path.join(OUT, '01-home.png');
      await page.screenshot({ path: f, fullPage: false });
      names.push(path.basename(f));

      /* 2. the armed classroom lock overlay on the player screen */
      await page.evaluate(() => new Promise((resolve) => { SDP.Studio.unlock('78987898', () => resolve()); }));
      await page.waitForTimeout(500);
      await page.evaluate(() => { SDP.Engine.setStudioLocked(true); });
      await page.evaluate(() => { document.getElementById('rail-player').click(); });
      await page.waitForTimeout(500);
      f = path.join(OUT, '02-lock-overlay.png');
      await page.screenshot({ path: f, fullPage: false });
      names.push(path.basename(f));

      /* lift the lock for the studio shots */
      await page.evaluate(() => { SDP.Engine.setStudioLocked(false); });

      /* 3. the Studio: audit banner + lock button + word-count select + session meta card */
      await page.evaluate(() => { document.getElementById('rail-studio').click(); });
      await page.waitForTimeout(700);
      /* paint the audit banner verdict so the shot shows a real verified line */
      await page.evaluate(() => { try { SDP.Studio.paintStudioActionAuditBanner('Release verification', 'v0.0.6.z'); } catch (e) {} });
      await page.waitForTimeout(200);
      f = path.join(OUT, '03-studio-audit-banner.png');
      await page.screenshot({ path: f, fullPage: false });
      names.push(path.basename(f));

      /* 4. the session meta card — scroll it into view */
      const metaVisible = await page.evaluate(() => {
        const el = document.getElementById('studioSessionMetaCard');
        if (el) el.scrollIntoView({ block: 'center' });
        return !!el;
      });
      await page.waitForTimeout(300);
      if (metaVisible) {
        f = path.join(OUT, '04-session-meta-card.png');
        await page.screenshot({ path: f, fullPage: false });
        names.push(path.basename(f));
      }

      /* 5. the word-count select — set to 20 so the pill shows the dynamic cap */
      const selVisible = await page.evaluate(() => {
        const el = document.getElementById('studioWordCountSelect');
        if (el) el.scrollIntoView({ block: 'center' });
        return !!el;
      });
      await page.waitForTimeout(200);
      if (selVisible) {
        f = path.join(OUT, '05-word-count-select.png');
        await page.screenshot({ path: f, fullPage: false });
        names.push(path.basename(f));
      }
      await ctx.close();
    }

    /* ── Leg 2: Live Lab v4.0 ── */
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.error('pageerror:', e.message));
      await ctx.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      await page.goto(server.origin + '/lab.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2800);
      await page.evaluate(() => { SDP.LiveLab.labSimulateSample(); });
      await page.waitForTimeout(3000);
      const f = path.join(OUT, '06-live-lab-v4.png');
      await page.screenshot({ path: f, fullPage: false });
      names.push(path.basename(f));
      await ctx.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  for (const n of names) {
    const p = path.join(OUT, n);
    console.log(n, fs.existsSync(p) ? fs.statSync(p).size + 'B' : 'MISSING');
  }
  console.log('shots:', names.length);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
