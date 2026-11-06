#!/usr/bin/env node
'use strict';
/* v0.0.6.j (CF-UNIFIED-MAIN) proof captures: the unified permanent Main
 * Production UI at the clean URL, plus the same proof with ?beta / #beta /
 * ?b=1 present — the URLs must stay on the unified main UI too, because the
 * beta channel no longer exists anywhere in the shipped bytes. Native-dark
 * theme captures stay for the report. */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const serverChromium = require('@sparticuz/chromium');
const { start } = require('./static-server.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUT = '/tmp/render/beta';

async function launch() {
  const executablePath = await serverChromium.executablePath();
  const args = serverChromium.args.filter((a) => ![
    '--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'
  ].includes(a));
  return chromium.launch({ headless: true, executablePath, args });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await start({ root: ROOT });
  const browser = await launch();

  async function shot(name, url, vp, opts) {
    const ctx = await browser.newContext({
      viewport: { width: vp[0], height: vp[1] },
      isMobile: vp[0] < 800, hasTouch: vp[0] < 800, deviceScaleFactor: 2
    });
    await ctx.addInitScript((o) => {
      try {
        localStorage.setItem('sdp.guide_seen', '0.0.6.j');
        const s = JSON.parse(localStorage.getItem('sdp.settings') || '{}');
        if (o && o.dark) s.theme = 'dark';
        localStorage.setItem('sdp.settings', JSON.stringify(s));
      } catch (e) {}
    }, opts || {});
    const page = await ctx.newPage();
    await page.goto(server.origin + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    if (opts && opts.tabPlayer) await page.evaluate(() => { document.getElementById('tab-player').click(); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    await ctx.close();
  }

  await shot('main-home-360x640', '/', [360, 640]);
  await shot('main-player-390x844', '/', [390, 844], { tabPlayer: true });
  /* the retired channel flags must not change anything — same unified main UI */
  await shot('legacy-beta-query-360x640', '/?beta', [360, 640]);
  await shot('legacy-hash-beta-360x640', '/#beta', [360, 640]);
  await shot('legacy-b1-360x640', '/?b=1', [360, 640]);
  await shot('dark-player-360x640', '/', [360, 640], { dark: true, tabPlayer: true });
  await shot('dark-studio-locked-360x640', '/', [360, 640], { dark: true });
  await shot('studio-unlocked-412x915', '/', [412, 915]);
  await shot('data-page-390x844', '/data/', [390, 844]);
  await shot('home-360x640', '/', [360, 640]);

  await browser.close();
  await server.close();
  console.log('done ->', OUT);
})().catch((e) => { console.error(e); process.exit(1); });
