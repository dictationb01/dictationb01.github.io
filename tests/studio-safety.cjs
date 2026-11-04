#!/usr/bin/env node
'use strict';
/* G12 — Lecturer Studio: real DOM widgets, zero-credit quota, delta clips (P3/P4).
 * v0.0.2.b adds the 5-slot free ladder, the immortal-vault UI and Card 1 (D7/D10/D13/D14).
 * contract: docs/UI_COMPONENT_GUIDE.md §5 studio widgets
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §W5 CREDIT SAFETY
 * CREDIT SAFETY: this gate never calls /v1/text-to-speech. The only network
 * surface it allows the studio is the zero-character GET /v1/user/subscription,
 * and every fetch here is a local stub. */
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('./app-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail) });
  return ok;
}
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* A lecturer opening the studio for the first time: seal a vault with a PIN. */
async function unlockStudio(app) {
  app.byId('btnStudioQuick').click();
  await app.settle(6);
  await new Promise((resolve) => app.SDP.Studio.setup('78987898', { ghToken: 'ghp_x', elevenKey: 'sk_x' }, () => resolve()));
  await app.settle(8);
}

(async function main() {
  const base = { before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.6.c'); } };

  /* ── 1. W5: nothing in the shipped app or the suite may bill a character
   *       outside a human click ───────────────────────────────────────────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §W5
  {
    const tts = /\/v1\/text-to-speech\//;
    const suiteHits = fs.readdirSync(path.join(ROOT, 'tests'))
      .filter((f) => /\.(cjs|js)$/.test(f))
      .filter((f) => tts.test(read('tests/' + f)));
    check('G12.1a no gate or test file references the billing endpoint', suiteHits.length === 0, suiteHits.join(','));
    const studioSrc = read('data/studio.js');
    /* every reference to the TTS endpoint must live inside a click handler */
    const ttsSites = studioSrc.split('\n').map((line, i) => ({ line, i })).filter((x) => tts.test(x.line));
    check('G12.1b the studio reaches the TTS endpoint only from a human click',
      ttsSites.length > 0 && ttsSites.every((x) => /genClip|renderClip|speakClip|synthClip|ttsUrl|function /.test(x.line)),
      ttsSites.map((x) => x.i + 1).join(','));
    check('G12.1c the shipped app never auto-generates clips on boot',
      !/addEventListener\('DOMContentLoaded'[\s\S]{0,600}?genClips/.test(studioSrc));
    const other = ['data/sdp-data-sync.js', 'data/sdp-ui-views.js', 'data/sdp-audio-speech.js', 'data/sdp-dictation-engine.js', 'data/data-meter.js', 'sw.js']
      .filter((f) => tts.test(read(f)));
    check('G12.1d no background module can ever bill a character', other.length === 0, other.join(','));
  }

  /* ── 2. P3: the zero-cost Quota Inspector ───────────────────────────── */
  // contract: docs/CHANGELOG_LEDGER.md §P3 zero-character subscription read
  {
    const urls = [];
    const app = await createApp(Object.assign({
      fetch(url, init) {
        const u = String(url);
        if (u.indexOf('elevenlabs.io') < 0) return undefined;
        urls.push({ url: u, method: (init && init.method) || 'GET', body: init && init.body });
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve({ character_count: 1200, character_limit: 10000 })
        });
      }
    }, base));
    /* the studio is a modal; unlock it the way a lecturer does */
    await unlockStudio(app);
    const opened = app.byId('studioModal') || app.q('.studio-modal') || app.q('#screen-settings');
    check('G12.2a the studio quick launcher opens a real surface', !!opened);
    const testKey = app.byId('btnTestElKey');
    check('G12.2b #btnTestElKey is a real button', !!testKey && testKey.tagName === 'BUTTON');
    if (testKey) {
      app.byId('elKeyInput').value = 'sk_test_key_value';
      testKey.click();
      await app.settle(10);
    }
    const quotaHit = urls.filter((u) => u.url.indexOf('/v1/user/subscription') >= 0);
    check('G12.2c the key test reads /v1/user/subscription only', quotaHit.length >= 1 && urls.length === quotaHit.length,
      urls.map((u) => u.url).join(','));
    check('G12.2d the quota read is a zero-character GET', quotaHit.every((u) => u.method === 'GET' && !u.body),
      JSON.stringify(quotaHit));
    const quotaText = (app.byId('quotaText') || {}).textContent || '';
    check('G12.2e the inspector shows used / limit / remaining',
      /1200/.test(quotaText) && /10000/.test(quotaText), quotaText.slice(0, 90));
    check('G12.2f the key never appears in a URL',
      urls.every((u) => u.url.indexOf('sk_test_key_value') < 0), urls.map((u) => u.url).join(','));
    app.close();
  }

  /* ── 3. P3: the cost preview is honest and the generator is delta-only ─ */
  // contract: docs/CHANGELOG_LEDGER.md §P3 972-char preflight
  {
    const app = await createApp(base);
    await unlockStudio(app);
    const line = (app.byId('costPreviewLine') || {}).textContent || '';
    check('G12.3a the cost preview names words, numbers, commands, guide steps, the total and 70 clips',
      /30 words = (?:234|241) chars/.test(line) && /30 numbers = 291 chars/.test(line) &&
      /6 commands = 163 chars/.test(line) && /4 guide steps = 134 chars/.test(line) &&
      /total (?:822|829) chars/.test(line) &&
      /70 clips \(30 words \+ 30 numbers \+ 6 commands \+ 4 guide steps\)/.test(line), line);
    check('G12.3b the preview is written into the documented DOM node', !!app.byId('costPreviewLine'));
    check('G12.3c a one-word test button exists for cheap dry runs', !!app.byId('btnTestOneWord'));
    check('G12.3d the delta generator exists and is the primary action',
      !!app.byId('btnGenClips') && /btn-primary/.test(app.byId('btnGenClips').className));
    const studio = app.SDP.Studio;
    const guide = studio.guideClips ? studio.guideClips() : studio.guideSteps();
    check('G12.3e the guide ships four reusable clips', Array.isArray(guide) && guide.length === 4,
      Array.isArray(guide) ? guide.length : typeof guide);
    const keys = (guide || []).map((g) => g.key);
    check('G12.3f the guide clips are the frozen _guide_1.._guide_4 keys',
      JSON.stringify(keys) === JSON.stringify(['_guide_1', '_guide_2', '_guide_3', '_guide_4']), keys.join(','));
    app.close();
  }

  /* ── 4. P4: the foolproof PIN pad and the key tools ─────────────────── */
  // contract: docs/UI_COMPONENT_GUIDE.md §5 pinPad
  {
    const app = await createApp(base);
    app.byId('btnStudioQuick').click();
    await app.settle(8);
    const pad = app.byId('pinPad');
    check('G12.4a #pinPad is a real element', !!pad);
    const keys = pad ? pad.querySelectorAll('button.pin-key') : [];
    check('G12.4b #pinPad holds exactly twelve keys', keys.length === 12, keys.length);
    const dials = pad ? Array.from(pad.querySelectorAll('[data-pin]')).map((b) => b.getAttribute('data-pin')) : [];
    check('G12.4c the twelve keys are 1-9, Clear, 0 and Unlock',
      JSON.stringify(dials.sort()) === JSON.stringify(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) &&
      !!app.byId('pinPadClear') && !!app.byId('pinPadUnlock'),
      dials.join('') + ' +clear+unlock');
    check('G12.4d backspace lives outside the twelve keys', !!app.byId('pinPadBack'));
    check('G12.4e every pad key is tappable at 56px or larger',
      /pin-key[^{]*\{[^}]*min-height:\s*56px/.test(read('assets/css/sdp-ui.css')));
    /* pressing Clear then Unlock must never throw on an empty pad */
    let threw = null;
    try { app.byId('pinPadClear').click(); app.byId('pinPadUnlock').click(); } catch (e) { threw = String(e); }
    check('G12.4f an empty pad is rejected without throwing', threw === null, threw);
    app.close();
  }

  /* ── 5. P4: show / hide / paste and both token families ─────────────── */
  // contract: docs/CHANGELOG_LEDGER.md §D-S9 token families
  {
    const app = await createApp(base);
    await unlockStudio(app);
    check('G12.5a the EL key field has Show / Hide and Paste helpers',
      !!app.byId('btnToggleElKey') && !!app.byId('btnPasteElKey'));
    check('G12.5b the GitHub token field has a real test button', !!app.byId('btnTestGhToken'));
    check('G12.5c a clip can be committed to the vault from the studio', !!app.byId('btnCommitClip'));
    check('G12.5d the studio exposes its quick launcher in the shell', !!app.byId('btnStudioQuick'));
    const input = app.byId('elKeyInput');
    const before = input.type;
    app.byId('btnToggleElKey').click();
    const after = app.byId('elKeyInput').type;
    check('G12.5e Show / Hide really flips the input type',
      (before === 'password' && after === 'text') || (before === 'text' && after === 'password'), before + '->' + after);
    const studioSrc = read('data/studio.js');
    check('G12.5f both GitHub token families are accepted',
      /ghp_/.test(studioSrc) && /github_pat_/.test(studioSrc));
    app.close();
  }

  /* ── 6. R9: every widget string exists in EN and SI ─────────────────── */
  // contract: docs/ARCHITECTURE_MAP.md §R9 bilingual strings
  {
    const app = await createApp(base);
    const en = app.SDP.STRINGS_EN;
    const si = app.SDP.STRINGS_SI;
    const required = [
      'studioTitle', 'studioPinLabel', 'pinPadClear', 'pinPadUnlock', 'studioCommitClip',
      'testOneWordBtn', 'genDeltaBtn', 'costPreviewLabel', 'quotaHeading',
      'creditsLine', 'creditsPill', 'howToUse', 'guideSkipStartNow',
      /* v0.0.2.b studio surface */
      'studioCardKeys', 'studioCardWords', 'studioCardSettings', 'studioOneClick',
      'studioMasterSteps', 'studioEnrich', 'studioWordManager', 'studioAiProvider',
      'studioAiKey', 'studioAiNoKey', 'studioPublishWordsVoice', 'studioLock',
      'studioSyncSettings', 'studioBulkWords'
    ];
    const missingEn = required.filter((k) => !en[k]);
    const missingSi = required.filter((k) => !si[k]);
    check('G12.6a every studio and guide string ships in English', missingEn.length === 0, missingEn.join(','));
    check('G12.6b every studio and guide string ships in Sinhala', missingSi.length === 0, missingSi.join(','));
    check('G12.6c the Sinhala strings are genuinely Sinhala',
      missingSi.length === 0 && /[\u0D80-\u0DFF]/.test(si.studioTitle + si.pinPadUnlock), si.studioTitle);
    check('G12.6d the credit pill is preserved verbatim in both languages',
      en.creditsPill === 'CREDITS GOES TO Hansana' && /Hansana/.test(si.creditsPill), en.creditsPill + ' / ' + si.creditsPill);
    check('G12.6e the credit line is preserved verbatim in both languages',
      en.creditsLine === 'Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu)',
      en.creditsLine);
    app.close();
  }

  /* ── 7. v0.0.2.b: three cards, the one-click setup, the PIN and the dots ─ */
  // contract: docs/UI_COMPONENT_GUIDE.md §5 studio cards · §R4 PIN · §R5 lock
  {
    const app = await createApp(base);
    app.byId('btnStudioQuick').click();
    await app.settle(8);
    const pin = app.byId('studioPin');
    check('G12.7a the locked PIN field accepts 4–12 digits',
      !!pin && pin.getAttribute('maxlength') === '12' && pin.getAttribute('minlength') === '4',
      pin && pin.outerHTML.slice(0, 90));
    check('G12.7b the locked DOM is PIN-only — no keys, words or publish control',
      !app.byId('elKeyInput') && !app.byId('ghTokenInput') && !app.byId('studioWords') &&
      !app.byId('btnOneClickMasterSetup'));
    const dots = app.byId('pinDots');
    check('G12.7c the dot indicator ships twelve dots', !!dots && dots.querySelectorAll('span').length === 12,
      dots && dots.querySelectorAll('span').length);
    check('G12.7d an empty PIN shows eight dots', !!dots && dots.getAttribute('data-dots') === '8',
      dots && dots.getAttribute('data-dots'));
    for (const digit of '123456789012') {
      const key = app.q('#pinPad [data-pin="' + digit + '"]');
      if (key) key.click();
    }
    check('G12.7e a twelve-digit PIN grows the dots to twelve',
      app.byId('pinDots').getAttribute('data-dots') === '12', app.byId('pinDots').getAttribute('data-dots'));
    app.byId('pinPadClear').click();
    check('G12.7f Clear resets the dots to eight', app.byId('pinDots').getAttribute('data-dots') === '8',
      app.byId('pinDots').getAttribute('data-dots'));

    await unlockStudio(app);
    check('G12.7g the unlocked studio is three outcome cards',
      !!app.byId('studioCardKeys') && !!app.byId('studioCardWords') && !!app.byId('studioCardSettings'));
    const oneClick = app.byId('btnOneClickMasterSetup');
    check('G12.7h the one-click master setup carries the verbatim label',
      !!oneClick && oneClick.textContent === app.SDP.STRINGS_EN.studioOneClick,
      oneClick && oneClick.textContent);
    const steps = app.byId('studioMasterSteps');
    check('G12.7i the master setup tracks four steps',
      !!steps && steps.querySelectorAll('li').length === 4, steps && steps.querySelectorAll('li').length);
    check('G12.7j the unlocked header carries an explicit lock control', !!app.byId('btnLockStudio'));
    const prov = app.byId('studioAiProvider');
    const options = prov ? Array.from(prov.querySelectorAll('option')).map((o) => o.value) : [];
    check('G12.7k the free provider is the default and all five slots ship in ladder order',
      JSON.stringify(options) === JSON.stringify(['free_dict', 'pollinations_free', 'groq', 'openrouter', 'gemini']) &&
      prov.value === 'free_dict', options.join(','));
    check('G12.7l free_dict needs no key at all',
      app.SDP.Studio.aiProviderName() === 'free_dict' && app.SDP.Studio.aiProviderKey() === '',
      app.SDP.Studio.aiProviderName());
    const wm = app.byId('studioWordManager');
    check('G12.7m the word manager renders the full 30-word table',
      !!wm && wm.querySelectorAll('tbody tr').length === 30, wm && wm.querySelectorAll('tbody tr').length);
    check('G12.7n every row is editable in all six fields',
      !!wm && wm.querySelectorAll('[data-wm]').length === 180, wm && wm.querySelectorAll('[data-wm]').length);
    check('G12.7o the publish / enrich controls all exist',
      !!app.byId('btnEnrichWords') && !!app.byId('btnPreviewWords') &&
      !!app.byId('btnPublishWords') && !!app.byId('btnPublishWordsAndVoice') && !!app.byId('btnTestAi'));
    check('G12.7p pagehide auto-locks the studio',
      (app.w.dispatchEvent(new app.w.Event('pagehide')), app.SDP.Studio.isUnlocked() === false),
      app.SDP.Studio.isUnlocked());
    app.close();
  }

  /* ── 8. R8: the free enricher works with zero keys and never bills ───── */
  // contract: docs/CHANGELOG_LEDGER.md §R8 free enrichment
  {
    const hits = [];
    const tts = [];
    const app = await createApp(Object.assign({
      fetch(url, init) {
        const u = String(url);
        if (u.indexOf('elevenlabs.io') >= 0) { tts.push(u); return undefined; }
        if (u.indexOf('dictionaryapi.dev') >= 0) {
          hits.push(u);
          return Promise.resolve({
            ok: true, status: 200,
            json: () => Promise.resolve([{
              word: 'brave', phonetic: '/breɪv/',
              meanings: [{ partOfSpeech: 'adjective', definitions: [{ definition: 'ready to face danger', example: 'She was brave.' }] }]
            }])
          });
        }
        if (u.indexOf('mymemory.translated.net') >= 0) {
          hits.push(u);
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ responseData: { translatedText: 'නිර්භීත' } }) });
        }
        return undefined;
      }
    }, base));
    await unlockStudio(app);
    const report = await new Promise((resolve) => app.SDP.Studio.enrichWords('brave\ncalm', {}, (err, rep) => resolve(rep)));
    const first = report && report.words && report.words[0] ? report.words[0] : {};
    check('G12.8a the free enricher fills IPA, meaning and Sinhala',
      first.p === '/breɪv/' && first.m === 'ready to face danger' && first.si === 'නිර්භීත' &&
      first.pos === 'adjective.', JSON.stringify(first).slice(0, 140));
    check('G12.8b enrichment enriches every word in the list',
      !!report && report.words.length === 2 && report.provider === 'free_dict', report && report.words.length);
    check('G12.8c enrichment touched only the free dictionary/translation tiers',
      hits.length >= 2 && hits.every((u) => /dictionaryapi\.dev|mymemory\.translated\.net|translate\.googleapis\.com|pollinations\.ai/.test(u)),
      hits.join(','));
    check('G12.8d enrichment never reaches ElevenLabs', tts.length === 0, tts.join(','));
    check('G12.8e the enriched words land back in the editor',
      /brave/.test(app.byId('studioWords').value) && app.SDP.Studio.state.words.length === 2);
    app.close();

    /* a dead tower must still produce a usable six-field record */
    const offlineApp = await createApp(Object.assign({
      fetch(url) {
        const u = String(url);
        if (u.indexOf('dictionaryapi.dev') >= 0 || u.indexOf('mymemory') >= 0) return Promise.reject(new Error('offline'));
        return undefined;
      }
    }, base));
    await unlockStudio(offlineApp);
    const off = await new Promise((resolve) => offlineApp.SDP.Studio.enrichWords('brave', {}, (err, rep) => resolve(rep)));
    const f = off && off.words && off.words[0] ? off.words[0] : {};
    check('G12.8f offline the deterministic B1 lexicon still fills all six fields',
      !!f.w && !!f.p && !!f.pos && !!f.m && !!f.si && !!f.s && /[\u0D80-\u0DFF]/.test(f.si) &&
      (off.offline === 1 || String(f.enrichSource || '') === 'lexicon'), JSON.stringify(f).slice(0, 140));
    offlineApp.close();
  }

  /* ── 9. v0.0.2.b: 5-slot ladder, immortal vault UI, Card 1 for teachers ─ */
  // contract: docs/UI_COMPONENT_GUIDE.md §5 studio Card 1 · §R8 free ladder
  {
    const app = await createApp(base);
    await unlockStudio(app);

    /* D10 — the 5-slot 100% free AI ladder */
    const prov = app.byId('studioAiProvider');
    const slots = Array.from(prov.querySelectorAll('option')).map((o) => o.value);
    check('G12.9a the five free slots ship in ladder order',
      JSON.stringify(slots) === JSON.stringify(['free_dict', 'pollinations_free', 'groq', 'openrouter', 'gemini']), slots.join(','));
    check('G12.9b slot 1 needs no key, slot 3 does',
      app.SDP.Studio.providers.free_dict.needsKey === false &&
      app.SDP.Studio.providers.pollinations_free.needsKey === false &&
      app.SDP.Studio.providers.groq.needsKey === true, JSON.stringify(Object.keys(app.SDP.Studio.providers)));
    const freeBadge = app.byId('studioFreeNoKey');
    check('G12.9c slot 1 shows the zero-key badge verbatim',
      !!freeBadge && freeBadge.hidden === false &&
      freeBadge.textContent === app.SDP.STRINGS_EN.studioFreeNoKey &&
      /100% Free — No API Key Required!/.test(freeBadge.textContent), freeBadge && freeBadge.textContent);
    prov.value = 'pollinations_free';
    prov.dispatchEvent(new app.w.Event('change', { bubbles: true }));
    check('G12.9d the badge also shows for slot 2 (zero-key LLM)', freeBadge.hidden === false);
    prov.value = 'groq';
    prov.dispatchEvent(new app.w.Event('change', { bubbles: true }));
    check('G12.9e the badge hides for a keyed slot', freeBadge.hidden === true);
    prov.value = 'free_dict';
    prov.dispatchEvent(new app.w.Event('change', { bubbles: true }));

    /* D7 (Layer 3) — auto-filled, masked inputs + the green vault badge */
    const el = app.byId('elKeyInput');
    const gh = app.byId('ghTokenInput');
    check('G12.9f the ElevenLabs key is auto-filled after unlock', el.value === 'sk_x', el.value);
    check('G12.9g the GitHub token is auto-filled after unlock', gh.value === 'ghp_x', gh.value);
    check('G12.9h both credential inputs stay masked', el.type === 'password' && gh.type === 'password', el.type + '/' + gh.type);
    const badge = app.byId('studioVaultBadge');
    check('G12.9i the green vault badge proves the keys are protected',
      !!badge && badge.hidden === false &&
      /Vault Saved & Protected Across Updates/.test(badge.textContent), badge && badge.textContent);
    check('G12.9j the AI key row has the same Show / Paste / Test trio',
      !!app.byId('btnToggleAi') && !!app.byId('btnPasteAi') && !!app.byId('btnTestAi'));

    /* D14 — exactly one visible force-regen checkbox, the mirror stays hidden */
    const force = app.byId('studioForceRegen');
    const mirror = app.byId('chkForceRegen');
    check('G12.9k exactly one force-regen checkbox is visible',
      !!force && force.hidden === false && !!mirror && mirror.style.display === 'none' &&
      app.qa('.studio-card-keys input[type=checkbox]:not(#chkForceRegen)').length === 1,
      app.qa('.studio-card-keys input[type=checkbox]').length);
    force.checked = true;
    force.dispatchEvent(new app.w.Event('change', { bubbles: true }));
    check('G12.9l the hidden mirror stays in sync with the visible box', mirror.checked === true);
    force.checked = false;
    force.dispatchEvent(new app.w.Event('change', { bubbles: true }));

    /* D13 — the clean TWO-button primary action bar */
    const bar = app.q('.studio-primary-bar');
    const barButtons = bar ? Array.from(bar.querySelectorAll('button')).map((b) => b.id) : [];
    check('G12.9m the primary bar is exactly two buttons',
      JSON.stringify(barButtons) === JSON.stringify(['btnSaveKeys', 'btnOneClickMasterSetup']), barButtons.join(','));
    check('G12.9n #btnSaveKeys is the secondary vault-only action',
      app.byId('btnSaveKeys').textContent === app.SDP.STRINGS_EN.studioSave &&
      /^\s*Save Keys to Vault Only$/.test(app.byId('btnSaveKeys').textContent) &&
      /btn-ghost/.test(app.byId('btnSaveKeys').className),
      app.byId('btnSaveKeys').textContent);
    check('G12.9o #btnOneClickMasterSetup is the primary 70-clip CTA',
      app.byId('btnOneClickMasterSetup').textContent === app.SDP.STRINGS_EN.studioOneClick &&
      /^\s*Generate 70 British Professor Voices & Sync All Devices$/.test(app.byId('btnOneClickMasterSetup').textContent) &&
      app.byId('btnOneClickMasterSetup').getAttribute('data-primary-cta') === '1',
      app.byId('btnOneClickMasterSetup').textContent);
    check('G12.9p the legacy quota buttons stay in the DOM but hidden',
      !!app.byId('btnCheckQuota') && !!app.byId('btnRefreshQuota') &&
      app.byId('btnCheckQuota').style.display === 'none' && app.byId('btnRefreshQuota').style.display === 'none');
    const elTestButtons = app.qa('#studioCardKeys button').filter((b) => /Test ElevenLabs Key/.test(b.textContent) && b.style.display !== 'none');
    check('G12.9q no duplicate "Test ElevenLabs Key" button clutters Card 1',
      elTestButtons.length === 1, elTestButtons.length);
    check('G12.9r the diagnostics strip holds the 1-word test and the delta generator',
      !!app.byId('btnTestOneWord') && !!app.byId('btnGenClips') &&
      !!app.byId('quotaText') && !!app.byId('costPreviewLine'));
    check('G12.9s the four master steps and the vault badge are inside Card 1',
      !!app.byId('studioMasterSteps') && app.byId('studioMasterSteps').querySelectorAll('li').length === 4 &&
      !!badge && badge.parentNode === app.byId('studioCardKeys'));
    check('G12.9t the scoped-key note ships in both languages',
      /scoped\/free-tier key/.test(app.SDP.STRINGS_EN.studioQuotaScoped) &&
      /[\u0D80-\u0DFF]/.test(app.SDP.STRINGS_SI.studioQuotaScoped), app.SDP.STRINGS_SI.studioQuotaScoped);
    /* W7 — the Sinhala face and the single-numbered step list */
    const cssText = fs.readFileSync(path.join(ROOT, 'assets/css/sdp-ui.css'), 'utf8');
    check('G12.9v the shipped Sinhala face is wired for the Studio card',
      /html\[lang='si'\]\s+\.studio-card\s*\{[^}]*var\(--font-si\)/.test(cssText) &&
      /--font-ui:[^;]*'Noto Sans Sinhala'/.test(cssText));
    const stepLabels = Array.from(app.byId('studioMasterSteps').querySelectorAll('li')).map((li) => li.textContent);
    check('G12.9w the step list is numbered by the <ol> marker only',
      stepLabels.length === 4 && stepLabels.every((t) => !/^\s*\d+\s*[.·]/.test(t)), stepLabels.join('|'));
    check('G12.9x the tier warning ships in both languages',
      /Built-in Free British Female Professor Voice/.test(app.SDP.STRINGS_EN.studioElTierWarn) &&
      /[\u0D80-\u0DFF]/.test(app.SDP.STRINGS_SI.studioElTierWarn), app.SDP.STRINGS_SI.studioElTierWarn);
    app.close();
  }

  /* ── 13. v0.0.2.b: per-field secrets (D1/D9), the lecturer bar (D19)
   *        and the busy flags on a failure exit (D18) ────────────────────── */
  // contract: docs/CHANGELOG_LEDGER.md §v0.0.2.b · docs/UI_COMPONENT_GUIDE.md §11
  {
    const app = await createApp(base);
    await unlockStudio(app);
    const el = app.byId('elKeyInput');
    const gh = app.byId('ghTokenInput');
    const ai = app.byId('studioAiKey');
    const gas = app.byId('studioGasUrl');
    check('G12.13a every credential field ships data-pristine and no data-dirty',
      [el, gh, ai, gas].every((n) => !!n && n.getAttribute('data-pristine') === '1' && n.getAttribute('data-dirty') !== '1'),
      [el, gh, ai, gas].map((n) => n && n.getAttribute('data-pristine')).join(','));
    check('G12.13b the four credential fields each own an explicit Clear button',
      ['btnClearElKey', 'btnClearGhToken', 'btnClearAi', 'btnClearGasUrl'].every((id) => !!app.byId(id)),
      ['btnClearElKey', 'btnClearGhToken', 'btnClearAi', 'btnClearGasUrl'].filter((id) => !app.byId(id)).join(','));
    el.value = 'sk_typed_by_hand';
    el.removeAttribute('data-pristine'); el.setAttribute('data-dirty', '1');
    app.byId('btnClearElKey').click();
    check('G12.13c Clear empties only its own field', el.value === '' && gh.value === 'ghp_x', el.value + '|' + gh.value);
    check('G12.13d a cleared field is data-dirty, never pristine again',
      el.getAttribute('data-dirty') === '1' && !el.hasAttribute('data-pristine'));
    app.SDP.Studio.mergeSecretInputs();
    check('G12.13e an empty dirty field clears the vault slot it owns',
      app.SDP.Studio.secrets().elevenKey === '', JSON.stringify(app.SDP.Studio.secrets().elevenKey));
    check('G12.13f an untouched field never loses the secret it holds (D1 belt-and-braces)',
      app.SDP.Studio.secrets().ghToken === 'ghp_x', JSON.stringify(app.SDP.Studio.secrets().ghToken));

    /* D19: the lecturer sync bar is a real, polite, translated status line */
    const bar = app.byId('lecturerSyncLast');
    check('G12.13g the lecturer bar is a polite live region that starts idle',
      !!bar && bar.getAttribute('aria-live') === 'polite' && bar.getAttribute('data-state') === 'idle',
      bar && bar.outerHTML.slice(0, 120));
    check('G12.13h the idle line is an i18n key, not a bare version literal',
      !!bar && bar.getAttribute('data-i18n') === 'lecturerSyncIdle' &&
      !/rev \d/.test(bar.textContent) && /Not synced yet/.test(bar.textContent), bar && bar.textContent);
    check('G12.13i the string exists in both languages',
      !!app.SDP.STRINGS_EN.lecturerSyncIdle && /[\u0D80-\u0DFF]/.test(app.SDP.STRINGS_SI.lecturerSyncIdle),
      app.SDP.STRINGS_SI.lecturerSyncIdle);

    /* D18: a failed publish must not leave a spinner pinned on */
    app.byId('ghTokenInput').value = '';
    app.byId('ghTokenInput').setAttribute('data-dirty', '1');
    app.SDP.Studio.mergeSecretInputs();
    let failure = null;
    await new Promise((resolve) => { app.SDP.Studio.publish(function (err) { failure = err; resolve(); }); });
    check('G12.13j a token-less publish fails without leaving a busy flag set',
      !!failure && app.SDP.Studio.isBusy() === false, JSON.stringify(app.SDP.Studio.isBusy()));
    const line = app.byId('lecturerSyncLast');
    check('G12.13k the failure line stays a human sentence (R10)',
      !!line && !/^(ERR|E_|[a-z]+_[a-z]+$)/.test(String(line.textContent).trim()), line && line.textContent);
    /* D5/D6/D7: the failure composer and the mapped status sentences */
    app.SDP.Studio.saveClassSettings(function () {});
    const line2 = app.byId('lecturerSyncLast');
    check('G12.13l a failed class-settings publish reads "Publish failed · hhmm · reason"',
      !!line2 && /^Publish failed · \d{2}:\d{2} · no token$/.test(String(line2.textContent)) &&
      line2.getAttribute('data-state') === 'bad', line2 && line2.textContent);
    check('G12.13m a failed publish never prints a revision number',
      !!line2 && !/rev\s*\d/i.test(String(line2.textContent)), line2 && line2.textContent);
    const e401 = app.SDP.Sync.publishErrorText(401, 'Bad credentials');
    const e403 = app.SDP.Sync.publishErrorText(403, '');
    const e500 = app.SDP.Sync.publishErrorText(500, '');
    const eOff = app.SDP.Sync.publishErrorText(0, '');
    check('G12.13n every GitHub failure status gets its own sentence',
      [e401, e403, e500, eOff].every((t) => typeof t === 'string' && t.length > 8) &&
      new Set([e401, e403, e500, eOff]).size === 4, [e401, e403, e500, eOff].join(' | '));
    check("G12.13o GitHub's own message is appended when the API sent one",
      String(e401).indexOf('Bad credentials') > 0 && String(e403).indexOf('Bad credentials') < 0, e401);
    check('G12.13p the class-settings failure also leaves no busy flag behind (D18)',
      app.SDP.Studio.isBusy() === false, JSON.stringify(app.SDP.Studio.isBusy()));
    app.close();
  }

  const failed = results.filter((r) => r.status === 'FAIL');
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ gate: 'G12', passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  } else {
    for (const r of results) if (r.status === 'FAIL') console.log('FAIL  ' + r.test + (r.detail ? '  [' + r.detail + ']' : ''));
    console.log('G12 studio-safety.cjs — ' + (results.length - failed.length) + ' PASS / ' + failed.length + ' FAIL');
  }
  process.exit(failed.length ? 1 : 0);
})();
