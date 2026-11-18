
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const serverChromium = require('@sparticuz/chromium');
require('./chromium-env.cjs').ensureChromiumLibs();
const { start } = require('./static-server.cjs');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'shots-v006w');
(async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await start({ root: ROOT });
  const executablePath = process.env.SDP_BROWSER_BIN || await serverChromium.executablePath();
  const args = serverChromium.args.filter((a) => !['--single-process','--disable-web-security','--allow-running-insecure-content','--disable-site-isolation-trials'].includes(a));
  args.push('--autoplay-policy=no-user-gesture-required');
  const browser = await chromium.launch({ headless: true, executablePath, args });
  const summary = {};
  const mk = async (w, h) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(() => {
      window.__SDP_NO_LIVE__ = true;
      try {
        localStorage.setItem('sdp.guide_seen', '0.0.6.w');
        localStorage.setItem('sdp.settings', JSON.stringify({ briefingSeen: '0.0.6.w', guideAutoPlay: false, appliedSettingsRev: 99 }));
      } catch (e) {}
    });
    await ctx.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
      return route.abort();
    });
    return ctx;
  };
  // Boot: straight to cockpit at 3 viewports
  for (const vp of [{w:320,h:568,t:'320'},{w:390,h:844,t:'390'},{w:1280,h:800,t:'1280'}]) {
    const ctx = await mk(vp.w, vp.h);
    const page = await ctx.newPage();
    await page.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    summary['boot-' + vp.t] = await page.evaluate(() => ({
      briefingHidden: document.getElementById('briefingModal').hidden === true,
      guideHidden: document.getElementById('guideModal').hidden === true,
      active: (document.querySelector('.screen.active') || {}).id
    }));
    await page.screenshot({ path: path.join(OUT, '01-boot-no-popup-' + vp.t + '.png') });
    if (vp.t === '1280') {
      // Settings About: btnCreatorNote + btnOpenLiveLab
      await page.evaluate(() => { document.getElementById('tab-settings').click(); });
      await page.waitForTimeout(500);
      await page.evaluate(() => { const c = document.getElementById('aboutCard'); if (c) c.scrollIntoView(); });
      await page.waitForTimeout(300);
      summary.settings = await page.evaluate(() => ({
        creator: !!document.getElementById('btnCreatorNote'),
        lab: !!document.getElementById('btnOpenLiveLab')
      }));
      await page.screenshot({ path: path.join(OUT, '02-settings-about-' + vp.t + '.png') });
      // On-demand briefing (direct stage)
      await page.evaluate(() => { document.getElementById('btnCreatorNote').click(); });
      await page.waitForTimeout(1600);
      summary.onDemand = await page.evaluate(() => ({
        open: document.getElementById('briefingModal').hidden === false,
        welcomeHidden: document.getElementById('welcomeStage').hidden === true,
        exitsUnlocked: document.getElementById('btnBriefingSkip').disabled === false,
        onBeat: (document.querySelector('#briefingLyrics .b-line.on') || {}).getAttribute('data-bline')
      }));
      await page.screenshot({ path: path.join(OUT, '03-on-demand-briefing-' + vp.t + '.png') });
    }
    await ctx.close();
  }
  // lab.html at 2 viewports
  for (const vp of [{w:1280,h:800,t:'1280'},{w:390,h:844,t:'390'}]) {
    const ctx = await mk(vp.w, vp.h);
    const page = await ctx.newPage();
    await page.goto(server.origin + '/lab.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    summary['lab-' + vp.t] = await page.evaluate(() => ({
      liveLab: !!(window.SDP && SDP.LiveLab),
      stations: document.querySelectorAll('section.card').length,
      rows: document.querySelectorAll('#labClipTableBody tr').length
    }));
    await page.screenshot({ path: path.join(OUT, '04-live-lab-' + vp.t + '.png'), fullPage: vp.t === '1280' ? false : false });
    if (vp.t === '390') {
      await page.evaluate(() => { try { window.scrollTo(0, 900); } catch (e) {} });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, '05-live-lab-stations-' + vp.t + '.png') });
    }
    await ctx.close();
  }
  console.log(JSON.stringify(summary, null, 2));
  await browser.close();
  await server.close();
})().catch((e) => { console.error('SHOT FATAL', e); process.exit(1); });
