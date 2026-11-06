#!/usr/bin/env node
'use strict';
/* v0.0.6.l proof captures: ultra-clean header, executive briefing, 5-slot pool. */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const serverChromium = require('@sparticuz/chromium');
require('./chromium-env.cjs').ensureChromiumLibs();
const { start } = require('./static-server.cjs');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'shots-v006k');

async function launch() {
  const executablePath = process.env.SDP_BROWSER_BIN || await serverChromium.executablePath();
  const args = serverChromium.args.filter((a) => !['--single-process', '--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials'].includes(a));
  return chromium.launch({ headless: true, executablePath, args });
}

(async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await start({ root: ROOT });
  const browser = await launch();
  const summary = { header: {}, briefing: {}, pool: {}, urls: [] };
  try {
    // 1. ULTRA-CLEAN HEADER at 390x844, 360x800, 1280x800 (briefingSeen seeded so home shows)
    for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 800 }, { width: 1280, height: 800 }]) {
      const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block' });
      await ctx.addInitScript(() => {
        window.__SDP_NO_LIVE__ = true;
        try {
          localStorage.setItem('sdp.guide_seen', '0.0.6.l');
          localStorage.setItem('sdp.settings', JSON.stringify({ appliedSettingsRev: 99, guideAutoPlay: false, briefingSeen: 1, mode: 'paper', lang: 'en', theme: 'light' }));
        } catch (e) {}
      });
      const page = await ctx.newPage();
      await ctx.route('**/*', (route) => {
        const u = route.request().url();
        if (u.startsWith(server.origin) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      await page.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(900);
      const tag = vp.width + 'x' + vp.height;
      await page.screenshot({ path: path.join(OUT, 'header-' + tag + '.png') });
      summary.urls.push('header-' + tag + '.png');
      const h = await page.evaluate(() => ({
        text: (document.getElementById('appHeader') || {}).textContent.replace(/\s+/g, ' ').trim(),
        btns: Array.from(document.querySelectorAll('#appHeader button')).map((n) => n.id).join(','),
        h: document.getElementById('appHeader').getBoundingClientRect().height
      }));
      summary.header[tag] = h;
      // 1b. Settings > About card with the relocated triggers (390 only)
      if (vp.width === 390) {
        await page.click('#tab-settings');
        await page.waitForTimeout(400);
        await page.evaluate(() => { const a = document.getElementById('aboutCard'); if (a && a.scrollIntoView) a.scrollIntoView({ block: 'center' }); });
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(OUT, 'about-relocated.png') });
        summary.urls.push('about-relocated.png');
      }
      await ctx.close();
    }

    // 2. EXECUTIVE PROJECT BRIEFING on a brand-new visit (390x844)
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await ctx.addInitScript(() => { window.__SDP_NO_LIVE__ = true; });
      const page = await ctx.newPage();
      await ctx.route('**/*', (route) => {
        const u = route.request().url();
        if (u.startsWith(server.origin) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      await page.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT, 'briefing-390x844.png') });
      summary.urls.push('briefing-390x844.png');
      summary.briefing = await page.evaluate(() => ({
        eyebrow: (document.getElementById('briefingEyebrow') || {}).textContent.trim(),
        title: (document.getElementById('briefingTitle') || {}).textContent.trim(),
        persona: (document.getElementById('briefingPersona') || {}).textContent.trim(),
        beats: document.querySelectorAll('#briefingLyrics .b-line').length,
        firstBeat: (document.querySelector('#briefingLyrics .b-line') || {}).textContent.slice(0, 90),
        links: Array.from(document.querySelectorAll('.briefing-links a')).map((a) => a.textContent.trim()),
        ageText: /21-year-old|21yo|වයස 21/i.test(document.getElementById('briefingModal').textContent)
      }));
      await ctx.close();
    }

    // 3. 5-SLOT KEY POOL: unlock studio, screenshot the pool (390x844)
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await ctx.addInitScript(() => {
        window.__SDP_NO_LIVE__ = true;
        try {
          localStorage.setItem('sdp.guide_seen', '0.0.6.l');
          localStorage.setItem('sdp.settings', JSON.stringify({ appliedSettingsRev: 99, guideAutoPlay: false, briefingSeen: 1, mode: 'paper', lang: 'en', theme: 'light' }));
        } catch (e) {}
      });
      const page = await ctx.newPage();
      await ctx.route('**/*', (route) => {
        const u = route.request().url();
        if (u.startsWith(server.origin) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      await page.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      await page.evaluate(() => {
        SDP.Sync.Vault.verifyPinVerifier = function () { return Promise.resolve(true); };
        SDP.Sync.Vault.decryptV2 = function () { return Promise.resolve({}); };
        document.getElementById('tab-studio').click();
        SDP.Studio.unlock('4321', () => {});
      });
      await page.waitForTimeout(900);
      await page.evaluate(() => { const k = document.getElementById('studioCardKeys'); if (k && k.scrollIntoView) k.scrollIntoView({ block: 'start' }); });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, 'keypool-390x844.png') });
      summary.urls.push('keypool-390x844.png');
      summary.pool = await page.evaluate(() => ({
        slots: document.querySelectorAll('#studioKeyPool .kp-row').length,
        providers: Array.from(document.querySelectorAll('#studioKeyPool .kp-prov')).map((s) => s.value).join(','),
        hints: Array.from(document.querySelectorAll('#studioKeyPool .kp-key')).map((i) => i.placeholder.slice(0, 46)).join(' | '),
        label: (document.querySelector('#studioCardKeys label.lbl') || {}).textContent.trim()
      }));
      await ctx.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
