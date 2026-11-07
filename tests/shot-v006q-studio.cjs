#!/usr/bin/env node
/* v0.0.6.q — Studio Voice Selector 390x844 proof capture (unlock with the
 * documented bootstrap PIN, then screenshot the Executive Male Voice row). */
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const serverChromium = require('@sparticuz/chromium');
require('./chromium-env.cjs').ensureChromiumLibs();
const { start } = require('./static-server.cjs');

const ROOT = path.resolve(__dirname, '..');
const OUT = '/tmp/shots-v006q';

(async function main() {
  const server = await start({ root: ROOT });
  const browser = await chromium.launch({ executablePath: await serverChromium.executablePath(), args: [...serverChromium.args, '--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__SDP_NO_LIVE__ = true;
    try { localStorage.setItem('sdp.settings', JSON.stringify({ appliedSettingsRev: 99, guideAutoPlay: false, mode: 'paper', lang: 'en', theme: 'light', briefingSeen: '0.0.6.q' })); } catch (e) {}
    try { localStorage.setItem('sdp.guide_seen', '0.0.6.q'); } catch (e2) {}
  });
  await page.goto(server.origin + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  /* switch to the Lecturer Studio tab so #screen-studio is rendered */
  await page.evaluate(() => { try { document.getElementById('tab-studio').click(); } catch (e) {} });
  await page.waitForTimeout(400);
  const state = await page.evaluate(() => new Promise((resolve) => {
    const out = { unlocked: false, select: false, custom: false, fetch: false, options: 0 };
    let done = false;
    function finish() {
      if (done) return;
      done = true;
      try {
        const sel = document.getElementById('studioBriefingVoiceSelect');
        const cus = document.getElementById('studioBriefingCustomVoiceId');
        const btn = document.getElementById('btnFetchClonedVoices');
        const gen = document.getElementById('btnStudioBriefingVoices');
        out.select = !!sel; out.custom = !!cus; out.fetch = !!btn; out.generate = !!gen;
        out.options = sel ? sel.options.length : 0;
        out.firstOption = sel && sel.options[0] ? sel.options[0].textContent : '';
        out.selectsVisible = [sel, cus, btn, gen].every((n) => {
          if (!n) return false;
          const r = n.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (sel) { sel.value = 'daniel'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        resolve(out);
      } catch (e) { out.err = String(e); resolve(out); }
    }
    try {
      window.SDP.Studio.unlock('78987898', function () { setTimeout(finish, 500); });
      setTimeout(finish, 6000);
    } catch (e) { out.err = String(e); finish(); }
  }));
  /* make sure the voice selector card is in view */
  await page.evaluate(() => {
    try {
      const card = document.getElementById('studioCardBriefingVoices');
      if (card && card.scrollIntoView) card.scrollIntoView({ block: 'start' });
    } catch (e) {}
  });
  await page.waitForTimeout(400);
  fs.writeFileSync(OUT + '/06-studio-state.json', JSON.stringify(state, null, 1));
  await page.screenshot({ path: OUT + '/06-studio-voice-selector-390x844.png', fullPage: false });
  await browser.close();
  await server.close();
  console.log(JSON.stringify(state));
})().catch((e) => { console.error(e); process.exit(1); });
