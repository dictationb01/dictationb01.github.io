#!/usr/bin/env node
'use strict';
/* Mobile visual audit harness — serves the repo and captures screenshots at
 * real phone + desktop viewports, in EN and SI, for the student cockpit and
 * the Lecturer Studio (unlocked via the test PIN harness). */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const serverChromium = require('@sparticuz/chromium');
const { start } = require('./static-server.cjs');

async function launch() {
  const executablePath = process.env.SDP_BROWSER_BIN || await serverChromium.executablePath();
  const args = serverChromium.args.filter((a) => ![
    '--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'
  ].includes(a));
  return chromium.launch({ headless: true, executablePath, args });
}

const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.OUT_DIR || '/tmp/render/before';
const PIN = process.env.STUDIO_PIN || '7898';

const VIEWPORTS = [
  { name: '360x640', width: 360, height: 640 },
  { name: '375x667', width: 375, height: 667 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
  { name: '1440x900', width: 1440, height: 900 }
];

async function newPage(browser, vp, lang) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: vp.width < 800,
    hasTouch: vp.width < 800,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  });
  const page = await ctx.newPage();
  await page.addInitScript((l) => {
    try {
      localStorage.setItem('sdp.guide_seen', '0.0.6.j');
      const s = JSON.parse(localStorage.getItem('sdp.settings') || '{}');
      s.lang = l; s.theme = 'light';
      localStorage.setItem('sdp.settings', JSON.stringify(s));
    } catch (e) {}
  }, lang);
  return page;
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await start({ root: ROOT });
  const browser = await launch();
  const report = [];
  for (const vp of VIEWPORTS) {
    for (const lang of ['en', 'si']) {
      const page = await newPage(browser, vp, lang);
      const tag = `${vp.name}-${lang}`;
      await page.goto(server.origin + '/?v=shot', { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      // home
      await page.screenshot({ path: path.join(OUT, `home-${tag}.png`) });
      // dictation cockpit
      await page.evaluate(() => { document.getElementById('tab-player').click(); });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `player-${tag}.png`) });
      // cockpit with revealed word
      try {
        await page.evaluate(() => { document.getElementById('btnRevealWord').click(); });
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT, `player-reveal-${tag}.png`) });
      } catch (e) { report.push('reveal-miss ' + tag); }
      // studio unlocked — bypass the PIN verifier (visual audit only)
      try {
        await page.evaluate(() => { document.getElementById('tab-studio').click(); });
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(OUT, `studio-locked-${tag}.png`) });
        await page.evaluate(() => {
          try {
            SDP.Sync.Vault.verifyPinVerifier = function () { return Promise.resolve(true); };
            SDP.Studio.unlock('4321', () => {});
          } catch (e) {}
        });
        await page.waitForTimeout(900);
        await page.screenshot({ path: path.join(OUT, `studio-unlocked-${tag}.png`) });
        // scrolled state — the sticky bar must stay compact and opaque
        try {
          await page.evaluate(() => { document.querySelector('#screen-studio').scrollIntoView(); window.scrollBy(0, 340); });
          await page.waitForTimeout(400);
          await page.screenshot({ path: path.join(OUT, `studio-scrolled-${tag}.png`) });
        } catch (e2) { report.push('scroll-miss ' + tag + ': ' + e2.message); }
      } catch (e) { report.push('studio-miss ' + tag + ': ' + e.message); }
      // measure the security bar + toast + chips boxes
      let metrics = null;
      try { metrics = await page.evaluate(() => {
        function box(sel) {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { sel, top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) };
        }
        return {
          header: box('#appHeader'),
          title: box('#screen-studio .screen-title'),
          ssb: box('#studioSecurityBar'),
          toast: box('#sdpDataToast'),
          chips: box('#studioLiveChips'),
          bulk: box('#studioBulkWords'),
          helper: box('#studioWordsCountHelper'),
          vh: window.innerHeight,
          vw: window.innerWidth
        };
      }); } catch (e3) { report.push('metrics-miss ' + tag); }
      if (metrics) report.push({ tag, metrics });
      await page.close();
    }
  }
  await browser.close();
  await server.close();
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(report, null, 2));
  console.log('done →', OUT);
}
run().catch((e) => { console.error(e); process.exit(1); });
