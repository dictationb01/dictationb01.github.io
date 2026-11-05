#!/usr/bin/env node
'use strict';
/* G3 — jsdom behavioural and regression gate for the v0.0.1.e shell.
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R4 (storage), §R5 (vault), §R2 (guide)
 * contract: docs/ARCHITECTURE_MAP.md §R3, §R4, §R5, §R6
 * Deterministic: fake timers, stubbed fetch, WebCrypto from Node. */
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('./app-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail) });
  return ok;
}
const sinhala = /[\u0D80-\u0DFF]/;

(async function main() {
  const fails = [];

  /* ── 1. corrupt storage must never break boot ───────────────────────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R4 corruption policy
  {
    /* v0.0.6.d: the shipped config.json carries a live classSettings block
       (mode: typing, settingsRev 35). Corrupt-storage recovery is about the
       STORE, not the network: pin appliedSettingsRev above the shipped rev so
       the adoption path stays quiet and the corrupt sdp.settings really does
       fall back to the paper default. */
    const app = await createApp({
      before(w) {
        w.localStorage.setItem('sdp.progress', '{not json at all');
        w.localStorage.setItem('sdp.settings', 'null');
        w.localStorage.setItem('sdp.session', '[]]');
        w.localStorage.setItem('sdp.guide_seen', '0.0.6.d');
        w.localStorage.setItem('sdp.pin_rev_guard', '1');
      },
      files: (() => {
        const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/config.json'), 'utf8'));
        delete cfg.classSettings;
        return { 'data/config.json': JSON.stringify(cfg) };
      })()
    });
    const progress = JSON.parse(app.w.localStorage.getItem('sdp.progress'));
    check('G3.1a corrupt progress JSON resets to defaults without throwing',
      progress && progress.streak && progress.streak.count === 0 && Array.isArray(progress.weakWords),
      JSON.stringify(progress).slice(0, 120));
    check('G3.1b corrupt settings fall back to paper mode', app.SDP.Data.settings().mode === 'paper', app.SDP.Data.settings().mode);
    check('G3.1c corrupt session draft is ignored', app.SDP.Data.session() === null, JSON.stringify(app.SDP.Data.session()));
    check('G3.1d the app still renders Home', app.q('.screen.active') && app.q('.screen.active').id === 'screen-home');
    check('G3.1e boot produced no unexpected jsdom errors', app.realErrors().length === 0, app.realErrors().slice(0, 2).join(' | '));
    app.close();
  }

  /* ── 1b. the one-time v0.0.1.h classroom-defaults migration ─────────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R3 defaults + defaultsResetV001f
  {
    const stale = await createApp({
      before(w) {
        w.localStorage.setItem('sdp.guide_seen', '0.0.6.d');
        w.localStorage.setItem('sdp.settings', JSON.stringify({
          mode: 'paper', writeSecs: 8, repeats: 3, pauseSecs: 1.5, autoAdvance: true,
          lang: 'si', theme: 'dark', pacingPreset: 'standard', voiceLock: 'custom',
          touchedKeys: { pacingPreset: true, writeSecs: true, repeats: true },
          appliedSettingsRev: 7
        }));
      }
    });
    const s1 = stale.SDP.Data.settings();
    check('G3.1f the 0.0.1.g migration installs the classroom pacing once',
      s1.writeSecs === 5 && s1.repeats === 2 && s1.pacingPreset === 'exam' && s1.voiceLock === 'unified',
      JSON.stringify([s1.writeSecs, s1.repeats, s1.pacingPreset, s1.voiceLock]));
    check('G3.1g the migration also lands the British English default', s1.lang === 'en', s1.lang);
    check('G3.1h the migration clears its own touchedKeys', !s1.touchedKeys.writeSecs && !s1.touchedKeys.repeats, JSON.stringify(s1.touchedKeys));
    check('G3.1i the migration flag lives inside sdp.settings and is set',
      JSON.parse(stale.w.localStorage.getItem('sdp.settings')).defaultsResetV001f === true);
    stale.close();

    // a device that has already migrated keeps the student's own choices
    const migrated = await createApp({
      before(w) {
        w.localStorage.setItem('sdp.guide_seen', '0.0.6.d');
        w.localStorage.setItem('sdp.settings', JSON.stringify({
          mode: 'typing', writeSecs: 9, repeats: 3, lang: 'si', pacingPreset: 'standard',
          voiceLock: 'custom', theme: 'light', langResetV001e: true,
          /* D10: above the shipped settingsRev, so adoption cannot overwrite. */
          defaultsResetV001f: true, appliedSettingsRev: 99
        }));
      }
    });
    const s2 = migrated.SDP.Data.settings();
    check('G3.1j after the migration a student\'s own pacing still wins',
      s2.writeSecs === 9 && s2.repeats === 3 && s2.lang === 'si' && s2.pacingPreset === 'standard',
      JSON.stringify([s2.writeSecs, s2.repeats, s2.lang, s2.pacingPreset]));
    migrated.close();
  }

  /* ── 2. studio PIN lockout ──────────────────────────────────────────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 PIN attempt tracking
  {
    const app = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.6.d'); } });
    /* R7: use a PIN that is NOT the master recovery code, so the lockout
       assertions below still see a plain refusal. */
    const envelope = await app.SDP.Sync.Vault.encryptV2({ ghToken: 'ghp_t', elevenKey: 'sk_t' }, '159753');
    app.SDP.Studio.setEnvelope(envelope);
    app.SDP.Sync.Vault.resetLock();
    check('G3.2a a configured vault is recognised', app.SDP.Studio.hasVault() === true);
    let tries = 0;
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => app.SDP.Studio.unlock('111111', () => { tries += 1; resolve(); }));
    }
    check('G3.2b studio refuses five wrong PINs', tries === 5, tries);
    check('G3.2c vault locks out after the fifth failure', app.SDP.Sync.Vault.isLocked() === true);
    check('G3.2d lockout message is shown to the lecturer', /60/.test(app.SDP.Studio.message()), app.SDP.Studio.message());
    let lockedErr = null;
    await new Promise((resolve) => app.SDP.Studio.unlock('159753', (err) => { lockedErr = err; resolve(); }));
    check('G3.2e the correct PIN is refused while locked', !!lockedErr && lockedErr.code === 'locked', lockedErr && lockedErr.code);
    app.SDP.Sync.Vault.resetLock();
    let okErr = 'unset';
    await new Promise((resolve) => app.SDP.Studio.unlock('159753', (err) => { okErr = err; resolve(); }));
    check('G3.2f the correct PIN unlocks after the lock expires', okErr === null && app.SDP.Studio.isUnlocked(), String(okErr));
    check('G3.2g unlocked secrets stay in sessionStorage only', !!app.w.sessionStorage.getItem('sdp.studio.unlocked') && !app.w.localStorage.getItem('sdp.studio.unlocked'));
    app.close();
  }

  /* ── 2b. R7 bootstrap master recovery ──────────────────────────────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R7 recovery — the master code
  // always opens a recovery session, even while the PIN pad is locked out.
  {
    const app = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.6.d'); } });
    const envelope = await app.SDP.Sync.Vault.encryptV2({ ghToken: 'ghp_t', elevenKey: 'sk_t' }, '159753');
    app.SDP.Studio.setEnvelope(envelope);
    app.SDP.Sync.Vault.resetLock();
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => app.SDP.Studio.unlock('111111', () => { resolve(); }));
    }
    let recErr = 'unset';
    await new Promise((resolve) => app.SDP.Studio.unlock('78987898', (err) => { recErr = err; resolve(); }));
    check('G3.2h the master recovery code opens a session even while locked out',
      recErr === null && app.SDP.Studio.isUnlocked() === true, String(recErr));
    check('G3.2i a recovery session is flagged and can re-seal a fresh PIN',
      app.SDP.Studio.recoveryMode() === true && typeof app.SDP.Studio.changePin === 'function',
      String(app.SDP.Studio.recoveryMode()));
    app.SDP.Sync.Vault.resetLock();
    app.close();
  }

  /* ── 3. first-visit guide ───────────────────────────────────────────── */
  // contract: docs/ARCHITECTURE_MAP.md §R2 priority #2 — unmissable guide
  {
    const app = await createApp({ before(w) { w.localStorage.removeItem('sdp.guide_seen'); } });
    check('G3.3a guide auto-opens on the first visit', app.byId('guideModal').hidden === false);
    check('G3.3b guide renders exactly four steps', app.byId('guideSteps').children.length === 4, app.byId('guideSteps').children.length);
    check('G3.3c guide opens in English chrome', /Press .*Start Dictation/.test(app.byId('guideSteps').textContent),
      app.byId('guideSteps').textContent.slice(0, 80));
    app.byId('guideLangPill').click();
    check('G3.3d the guide language pill switches to Sinhala in place', sinhala.test(app.byId('guideSteps').textContent));
    app.byId('guideLangPill').click();
    app.byId('btnGuideClose').click();
    // contract: docs/ARCHITECTURE_MAP.md §R2 + W7 — the stamp is the version string
    check('G3.3e closing stores sdp.guide_seen = the running version', app.w.localStorage.getItem('sdp.guide_seen') === '0.0.6.d');
    check('G3.3f the modal is hidden after closing', app.byId('guideModal').hidden === true);
    check('G3.3g no fake guide audio stubs exist', !fs.existsSync(path.join(ROOT, 'assets/audio/guide-si-1.mp3')));
    check('G3.3h the header guide button reopens it', (app.byId('btnGuideTop').click(), app.byId('guideModal').hidden === false));
    app.byId('btnGuideClose').click();
    // a returning visitor is not interrupted
    const again = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.6.d'); } });
    check('G3.3i returning students are not interrupted by the guide', again.byId('guideModal').hidden === true);
    again.close();
    app.close();
  }

  /* ── 4. paper run, marking, resume, typing run ──────────────────────── */
  // contract: docs/ARCHITECTURE_MAP.md §R5 beat machine + §7 results
  {
    const app = await createApp({
      before(w) {
        w.localStorage.setItem('sdp.guide_seen', '0.0.6.d');
        // appliedSettingsRev pins the seeded pacing against a classSettings
        // adoption, and guideAutoPlay:false keeps Start on the fast path.
        /* D10: appliedSettingsRev sits ABOVE the shipped settingsRev so the
           classroom adoption cannot overwrite this test's own pacing. */
        w.localStorage.setItem('sdp.settings', JSON.stringify({ mode: 'paper', writeSecs: 3, repeats: 1, pauseSecs: 0.5, autoAdvance: true, rate: 1, volume: 1, lang: 'en', theme: 'dark', guideAutoPlay: false, appliedSettingsRev: 99, defaultsResetV001f: true }));
      }
    });
    check('G3.4a boot loads the 30-word active list', app.SDP.Sync.wordCount() === 30, app.SDP.Sync.wordCount());
    app.byId('btnStart').click();
    check('G3.4b Start opens the cockpit screen', app.q('.screen.active').id === 'screen-player');
    check('G3.4c paper mode has no #typeInput in the DOM', app.byId('typeInput') === null);
    check('G3.4d the beat starts in listening with the verbatim phase line',
      /Listen Carefully \(Repeat \d of \d\)/.test(app.byId('beatStateText').textContent), app.byId('beatStateText').textContent);
    /* R3: the classroom opening is "Preparing lesson." → "Number 1." → the
       word, so the first writing window opens ~5 s in on the fake clock. */
    for (let i = 0; i < 40 && app.SDP.Engine.state() !== 'writing'; i++) await app.advance(250);
    check('G3.4e the beat advances into writing with the word number and countdown',
      /Write Word #\d+ in Your Book! \(\d+s countdown\)/.test(app.byId('beatStateText').textContent), app.byId('beatStateText').textContent);
    app.SDP.Engine.pause();
    const paused = app.byId('beatStateText').textContent;
    check('G3.4f Pause freezes the beat', /Paused/.test(paused), paused);
    app.SDP.Engine.resume();
    check('G3.4g Resume returns to a live phase', ['listening', 'writing'].indexOf(app.SDP.Engine.state()) >= 0, app.SDP.Engine.state());
    // walk the whole 30-word bank with the fake clock
    for (let i = 0; i < 900 && app.SDP.Engine.state() !== 'finished'; i++) await app.advance(1000);
    check('G3.4h a full paper run reaches finished', app.SDP.Engine.state() === 'finished', app.SDP.Engine.state());
    check('G3.4i results panel is visible', app.byId('resultsPanel').hidden === false);
    check('G3.4j results table has 30 rows', app.byId('resultsTable').querySelectorAll('tbody tr').length === 30, app.byId('resultsTable').querySelectorAll('tbody tr').length);
    check('G3.4k the score starts at a full self-check', app.byId('scoreValue').textContent === '30 / 30', app.byId('scoreValue').textContent);
    const missedButtons = app.byId('resultsTable').querySelectorAll('[data-mark="missed"]');
    for (let i = 0; i < 6; i++) missedButtons[i].click();
    check('G3.4l six taps drop the score to 24 / 30 (80%)',
      app.byId('scoreValue').textContent === '24 / 30' && app.byId('scorePct').textContent === '80%',
      app.byId('scoreValue').textContent + ' · ' + app.byId('scorePct').textContent);
    const progress = JSON.parse(app.w.localStorage.getItem('sdp.progress'));
    check('G3.4m the six missed words are queued in weakWords', progress.weakWords.length === 6, JSON.stringify(progress.weakWords));
    check('G3.4n mastered tracks the 24 correct words', Object.keys(progress.mastered).length === 24, Object.keys(progress.mastered).length);
    check('G3.4o the streak opened on the same day', progress.streak.count === 1 && /^\d{4}-\d{2}-\d{2}$/.test(progress.streak.lastDate), JSON.stringify(progress.streak));
    check('G3.4p lastScore is stored for the Home card', progress.lastScore && progress.lastScore.correct === 24 && progress.lastScore.total === 30);
    check('G3.4q finishing clears the in-flight sdp.session draft', app.w.localStorage.getItem('sdp.session') === null);
    app.byId('btnRetryMissed').click();
    check('G3.4r Retry missed starts a 6-word session', app.SDP.Engine.items().length === 6, app.SDP.Engine.items().length);
    app.SDP.Engine.stop();
    check('G3.4s Home statistics reflect the saved progress',
      app.byId('statMastered').textContent === '24 / 30' && app.byId('statAccuracy').textContent === '80%',
      app.byId('statMastered').textContent + ' / ' + app.byId('statAccuracy').textContent);

    // typing mode
    app.byId('tab-home').click();
    app.byId('homeModePills').querySelector('[data-mode="typing"]').click();
    app.byId('btnStart').click();
    check('G3.4t typing mode mounts #typeInput', app.byId('typeInput') !== null);
    const input = app.byId('typeInput');
    check('G3.4u #typeInput carries the anti-autocorrect attributes',
      input.getAttribute('autocomplete') === 'off' && input.getAttribute('autocapitalize') === 'off' && input.getAttribute('spellcheck') === 'false');
    input.value = 'important';
    input.dispatchEvent(new app.w.Event('input'));
    app.SDP.Engine.finish();
    const firstRow = app.byId('resultsTable').querySelectorAll('tbody tr')[0];
    check('G3.4v a typed word is graded correct automatically', firstRow.className === 'is-correct', firstRow.className);
    const secondRow = app.byId('resultsTable').querySelectorAll('tbody tr')[1];
    check('G3.4w an empty answer is graded missed', secondRow.className === 'is-missed', secondRow.className);
    app.SDP.Engine.stop();

    // in-flight resume
    app.SDP.Data.saveSession({ sessionId: '8', index: 3, mode: 'paper', answers: { impressed: { typed: '', marked: 'correct' } }, updatedAt: 1 });
    app.SDP.Views.renderHome();
    check('G3.4x the resume banner appears for an in-flight session', app.byId('resumeBanner').hidden === false);
    app.byId('btnResume').click();
    check('G3.4y resume restarts at the saved word index', app.SDP.Engine.config().index === 3, app.SDP.Engine.config().index);
    app.SDP.Engine.stop();
    check('G3.4z paper mode after switching back never leaves an input behind',
      (app.SDP.Engine.setMode('paper'), app.byId('typeInput') === null));
    app.close();
  }

  /* ── 5. language purity ─────────────────────────────────────────────── */
  // contract: docs/UI_COMPONENT_GUIDE.md §5 language purity (W7)
  {
    const app = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.6.d'); } });
    app.byId('tab-dict').click();
    const cards = app.byId('dictList').querySelectorAll('.dict-card');
    check('G3.5a the Words tab renders all 30 cards', cards.length === 30, cards.length);
    const firstSi = cards[0].querySelector('.word-si');
    check('G3.5b each card carries the Sinhala meaning in .word-si', !!firstSi && sinhala.test(firstSi.textContent), firstSi && firstSi.textContent);
    app.SDP.Views.applyLang('en');
    // the vocabulary cards' .word-si / .hp-si are the ONLY legal Sinhala in EN mode
    const dictWithoutSi = app.byId('dictList').cloneNode(true);
    Array.from(dictWithoutSi.querySelectorAll('.word-si')).forEach((n) => n.remove());
    const homeClone = app.byId('screen-home').cloneNode(true);
    Array.from(homeClone.querySelectorAll('.word-si, .hp-si')).forEach((n) => n.remove());
    const chromeEn = [app.byId('tabbar'), app.byId('appHeader'), homeClone, app.byId('screen-settings'), app.byId('screen-studio')]
      .map((n) => n.textContent).join(' ') + ' ' + dictWithoutSi.textContent;
    check('G3.5c English chrome contains zero Sinhala outside the vocabulary cards', !sinhala.test(chromeEn), (chromeEn.match(/[\u0D80-\u0DFF]+/g) || []).join(','));
    app.SDP.Views.applyLang('si');
    const chromeSi = [app.byId('tabbar'), app.byId('appHeader'), app.byId('screen-home'), app.byId('screen-settings')]
      .map((n) => n.textContent).join(' ');
    check('G3.5d Sinhala chrome is rendered in Sinhala', sinhala.test(chromeSi));
    check('G3.5e proper nouns survive the switch', chromeSi.indexOf('CCBE B1') >= 0 && app.byId('appHeader').textContent.indexOf('Smart Dictation') >= 0);
    const guide = app.SDP.Views.t('guideSpotlight1');
    check('G3.5f Sinhala guide step one is natural Sinhala', sinhala.test(guide) && guide.length > 40, guide.slice(0, 60));
    check('G3.5g English and Sinhala tables have identical key sets',
      JSON.stringify(Object.keys(app.SDP.STRINGS_EN).sort()) === JSON.stringify(Object.keys(app.SDP.STRINGS_SI).sort()),
      Object.keys(app.SDP.STRINGS_EN).filter((k) => !(k in app.SDP.STRINGS_SI)).join(','));
    app.SDP.Views.applyLang('en');
    const tail = app.SDP.Views.t('creditsLine');
    check('G3.5h the attribution line is exact in English',
      tail === 'Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu)', tail);
    check('G3.5i the credits pill reads CREDITS GOES TO Hansana',
      app.q('#creditFoot .credits-pill').textContent === 'CREDITS GOES TO Hansana',
      app.q('#creditFoot .credits-pill').textContent);
    app.close();
  }

  /* ── 6. settings order and the studio accordion ─────────────────────── */
  // contract: docs/UI_COMPONENT_GUIDE.md §student-first settings order
  {
    const app = await createApp({ before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.6.d'); } });
    const order = app.SDP.Views.settingsOrder();
    check('G3.6a Settings is student-only: exactly five sections', order.length === 5, order.join(','));
    check('G3.6b About is the last student section and no studio card remains in Settings',
      order[4] === 'aboutCard' && order.indexOf('studioAccordion') < 0, order.join(','));
    check('G3.6c the studio lives in its own #screen-studio screen, not inside Settings',
      !!app.byId('screen-studio') && !!app.byId('studioAccordion') &&
      app.byId('screen-studio').contains(app.byId('studioAccordion')) &&
      !app.byId('screen-settings').contains(app.byId('studioAccordion')));
    check('G3.6d the repeats select is built once with 1x-5x', app.byId('setRepeats').options.length === 5, app.byId('setRepeats').options.length);
    // contract: docs/CHANGELOG_LEDGER.md §v0.0.1.e VOX-08 — the test now plays
    // the first session word through the real tier chain and names the tier.
    app.byId('btnTestVoice').click();
    /* D10: the chain is async now (dictionary <audio> first, TTS last). jsdom
       fires no media events, so run past the 12 s playUrl backstop to let the
       chain hand over and name the tier that actually played. */
    await app.advance(13000);
    const said = app.SDP.Speech.lastUtterances();
    const dictTiers = app.SDP.Speech.resolveTiers(app.SDP.Sync.word(0), { includeDictionary: true }).filter(function (t) { return t.tier === 'dictionary'; });
    check('G3.6e Test Voice plays the first session word through the tier chain',
      (said.length >= 1 && /important/i.test(said.join(' '))) ||
        (/British human audio/i.test(String(app.SDP.Speech.lastTierName())) &&
         dictTiers.length === 1 && /dict\.youdao\.com/.test(dictTiers[0].url) && /audio=important/i.test(dictTiers[0].url)),
      JSON.stringify({ said: said, tier: app.SDP.Speech.lastTierName(), dict: dictTiers }));
    check('G3.6f Test Voice reports the tier that actually played',
      typeof app.SDP.Speech.lastTierName() === 'string' && app.SDP.Speech.lastTierName().length > 0,
      app.SDP.Speech.lastTierName());
    app.close();
  }

  /* ── 7. R1: lecturer classSettings adoption (SYNC-01 / SYNC-02) ──────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R11.2
  {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/config.json'), 'utf8'));
    cfg.classSettings = Object.assign({}, cfg.classSettings, { writeSecs: 12, repeats: 4, theme: 'light' });
    const ver = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/version.json'), 'utf8'));
    ver.settingsRev = 7;
    ver.syncRev = 1762000000011;
    const app = await createApp({
      files: { 'data/config.json': JSON.stringify(cfg), 'data/version.json': JSON.stringify(ver) },
      before(w) {
        w.localStorage.setItem('sdp.guide_seen', '0.0.6.d');
        /* The student touched every classroom key — the lecturer still wins. */
        w.localStorage.setItem('sdp.settings', JSON.stringify({
          mode: 'typing', writeSecs: 3, repeats: 1, pauseSecs: 0.5, autoAdvance: false,
          pacingPreset: 'exam', voiceLock: 'custom', voiceSource: 'custom', rate: 1.1, theme: 'board',
          lang: 'si', volume: 0.4, appliedSettingsRev: 0, langResetV001e: true,
          defaultsResetV001f: true,
          touchedKeys: { writeSecs: true, repeats: true, theme: true, rate: true, pauseSecs: true }
        }));
      }
    });
    const s = app.SDP.Data.settings();
    check('G3.7a a settingsRev bump adopts classSettings even with touchedKeys set (SYNC-01)',
      s.writeSecs === 12 && s.repeats === 4 && s.theme === 'light', JSON.stringify([s.writeSecs, s.repeats, s.theme]));
    check('G3.7b the ten classroom keys are cleared from touchedKeys (SYNC-01)',
      s.touchedKeys.writeSecs === undefined && s.touchedKeys.repeats === undefined && s.touchedKeys.theme === undefined,
      JSON.stringify(s.touchedKeys));
    check('G3.7c appliedSettingsRev records the adopted revision (SYNC-02)',
      s.appliedSettingsRev === 7, s.appliedSettingsRev);
    check('G3.7d personal keys (lang, volume) are never overwritten by classSettings',
      s.lang === 'si' && s.volume === 0.4, JSON.stringify([s.lang, s.volume]));
    check('G3.7e the adoption repaints the settings controls',
      app.byId('setWriteSecs').value === '12', app.byId('setWriteSecs').value);
    app.close();
  }

  /* ── 8. R1 first-boot adoption (SYNC-02) ─────────────────────────────── */
  {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/config.json'), 'utf8'));
    cfg.classSettings = Object.assign({}, cfg.classSettings, { writeSecs: 10, repeats: 5, pauseSecs: 2.5 });
    const ver = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/version.json'), 'utf8'));
    ver.settingsRev = 9;
    ver.syncRev = 1762000000012;
    const app = await createApp({
      files: { 'data/config.json': JSON.stringify(cfg), 'data/version.json': JSON.stringify(ver) },
      before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.6.d'); }
    });
    const s = app.SDP.Data.settings();
    check('G3.8a a brand-new device adopts the teacher settings on its first boot (SYNC-02)',
      s.writeSecs === 10 && s.repeats === 5 && s.pauseSecs === 2.5 && s.appliedSettingsRev === 9,
      JSON.stringify([s.writeSecs, s.repeats, s.pauseSecs, s.appliedSettingsRev]));
    check('G3.8b the controls show the adopted pacing',
      app.byId('setRepeats').value === '5' && app.byId('setPause').value === '2.5',
      app.byId('setRepeats').value + ' / ' + app.byId('setPause').value);
    app.close();
  }

  /* ── 9. VOX-07: the quick spoken walkthrough on #btnStart ────────────── */
  // contract: docs/UI_COMPONENT_GUIDE.md §Quick Walkthrough Mode
  {
    const app = await createApp({
      before(w) {
        w.localStorage.setItem('sdp.guide_seen', '0.0.6.d');
        w.localStorage.setItem('sdp.settings', JSON.stringify({
          mode: 'paper', writeSecs: 3, repeats: 1, pauseSecs: 0.5, autoAdvance: true,
          rate: 1, volume: 1, lang: 'en', theme: 'dark', guideAutoPlay: true, appliedSettingsRev: 7
        }));
      }
    });
    app.byId('btnStart').click();
    check('G3.9a Start opens the Quick Voice Guide instead of jumping to the cockpit',
      app.byId('guideModal').hidden === false && app.q('.screen.active').id === 'screen-home',
      app.q('.screen.active').id);
    check('G3.9b the quick guide has its own title',
      app.byId('guideTitle').textContent === app.SDP.Views.t('guideQuickTitle'),
      app.byId('guideTitle').textContent);
    check('G3.9c #btnGuideSkipStart is visible and labelled',
      app.byId('btnGuideSkipStart').hidden === false &&
      /▶ Start Dictation Now/.test(app.byId('btnGuideSkipStart').textContent),
      app.byId('btnGuideSkipStart').textContent);
    await app.advance(1200);
    const spoken = app.SDP.Speech.lastUtterances();
    check('G3.9d the quick guide narrates steps 1 and 2 in English only',
      spoken.length >= 1 && spoken.every((line) => !sinhala.test(line)), JSON.stringify(spoken));
    app.byId('btnGuideSkipStart').click();
    check('G3.9e skipping closes the guide and starts the dictation immediately',
      app.byId('guideModal').hidden === true && app.q('.screen.active').id === 'screen-player',
      app.q('.screen.active').id);
    check('G3.9f the session intro is remembered for the rest of the run',
      app.SDP.Views.sessionIntroShown() === true);
    app.SDP.Engine.stop();
    app.byId('tab-home').click();
    app.byId('btnStart').click();
    check('G3.9g a second Start in the same session goes straight to the cockpit',
      app.q('.screen.active').id === 'screen-player' && app.byId('guideModal').hidden === true,
      app.q('.screen.active').id);
    app.close();
  }

  /* ── G3.10 — P4 cockpit: 30-pill map, 4-button transport, verbatim copy ── */
  {
    const app = await createApp({});
    await app.settle(10);
    const text = (id) => { const n = app.byId(id); return n ? String(n.textContent || '').trim() : ''; };
    check('G3.10a the cockpit paints the full 30-pill map at boot, before Start',
      app.qa('#sessionPills .word-pill').length === 30 &&
      app.qa('#sessionPills .word-pill.todo').length === 30,
      app.qa('#sessionPills .word-pill').length + ' pills');
    check('G3.10b the idle transport reads ▶ Start Dictation, never a lying Pause',
      app.byId('btnPlayPause').getAttribute('data-icon') === 'play' &&
      app.byId('btnPlayPause').getAttribute('aria-label') === app.SDP.Views.t('btnStartDictation') &&
      /Start Dictation/.test(app.byId('btnPlayPause').getAttribute('aria-label')),
      text('btnPlayPause') + ' | ' + app.byId('btnPlayPause').getAttribute('aria-label'));
    check('G3.10c the progress line and the preset badge are honest at boot',
      /^WORD #01 \/ 30$/.test(text('sessionProgressCount')) && /5s Write · 2×/.test(text('playerPresetBadge')),
      text('sessionProgressCount') + ' | ' + text('playerPresetBadge'));
    app.SDP.Engine.start({ mode: 'paper' });
    await app.settle(3);
    check('G3.10d a live beat reads the verbatim listening line and ⏸ Pause Dictation',
      /^Listen Carefully \(Repeat \d of \d\)…$/.test(text('beatStateText')) &&
      app.byId('btnPlayPause').getAttribute('aria-label') === app.SDP.Views.t('btnPauseDictation'),
      text('beatStateText') + ' | ' + app.byId('btnPlayPause').getAttribute('aria-label'));
    check('G3.10e exactly one pill is live and the numbered transport names the words',
      app.qa('#sessionPills .word-pill.current').length === 1 &&
      /^⏮ Prev \(#1\)$/.test(app.byId('btnPrev').getAttribute('aria-label')) &&
      /^⏭ Next \(#2\)$/.test(app.byId('btnNext').getAttribute('aria-label')) &&
      /^\s*Replay Word$/.test(app.byId('btnReplay').getAttribute('aria-label')) &&
      app.byId('btnPrev').getAttribute('data-icon') === 'prev' && app.byId('btnNext').getAttribute('data-icon') === 'next',
      app.byId('btnPrev').getAttribute('aria-label') + ' | ' + app.byId('btnNext').getAttribute('aria-label'));
    app.byId('btnPlayPause').click();
    await app.settle(2);
    check('G3.10f pause prints the verbatim paused sentence with ONE closing bracket',
      text('beatStateText') === 'Dictation Paused at Word #1 (Repeat 1 of 2) — Press Resume Below',
      text('beatStateText'));
    check('G3.10g pause relabels the transport ▶ Resume Word #1 and shows the banner',
      app.byId('btnPlayPause').getAttribute('aria-label') === '▶ Resume Word #1' &&
      app.byId('btnPlayPause').getAttribute('data-icon') === 'play' && app.byId('playerPausedBanner').hidden === false,
      app.byId('btnPlayPause').getAttribute('aria-label'));
    app.SDP.Views.showTab('home');
    await app.settle(2);
    check('G3.10h the giant resume card names the word, the repeat and the seconds left',
      app.byId('resumeBanner').hidden === false &&
      /Paused at Word #1 of 30/.test(app.byId('resumeBanner').textContent) &&
      /\d(\.\d)?s left/.test(app.byId('resumeBanner').textContent),
      app.byId('resumeBanner').textContent.replace(/\s+/g, ' ').slice(0, 120));
    app.SDP.Engine.resume();
    await app.settle(2);
    check('G3.10i resume returns to a live ⏸ Pause Dictation and clears the banner',
      app.byId('btnPlayPause').getAttribute('aria-label') === app.SDP.Views.t('btnPauseDictation') &&
      app.byId('playerPausedBanner').hidden === true,
      app.byId('btnPlayPause').getAttribute('aria-label'));
    app.byId('btnNext').click();
    await app.settle(2);
    check('G3.10j stepping forward turns pill 1 green and moves the live pill to 2',
      app.qa('#sessionPills .word-pill.done').length === 1 &&
      app.qa('#sessionPills .word-pill.current')[0].getAttribute('data-word-pill') === '2' &&
      /^WORD #02 \/ 30$/.test(text('sessionProgressCount')),
      text('sessionProgressCount'));
    app.close();
  }

  /* ── G3.11 — P3 studio: the 34-clip dashboard, one-click CTA, delta retry ─ */
  {
    const app = await createApp({});
    await app.settle(10);
    app.SDP.Views.showTab('studio');
    await app.settle(3);
    check('G3.11a the locked studio is a PIN gate, never the three cards',
      !!app.byId('studioGate') && app.qa('.studio-card').length === 0 &&
      app.qa('#pinDots span').length === 8 && app.qa('#pinPad .pin-key').length === 12,
      app.qa('.studio-card').length + ' cards');
    const barDocked = app.byId('lecturerSyncBar').parentNode.id;
    await new Promise((resolve) => app.SDP.Studio.unlock('78987898', resolve));
    await app.settle(4);
    check('G3.11b unlock mounts exactly the three numbered cards',
      app.qa('.studio-card').length === 3 && app.byId('studioGate') === null,
      app.qa('.studio-card').length + ' cards');
    check('G3.11c the 70-clip dashboard states X/70 live',
      /Voice Pack: \d+\/70 Clips/.test(app.byId('studioPackDashboard').textContent),
      app.byId('studioPackDashboard').textContent);
    check('G3.11d #btnOneClickMasterSetup is the primary 70-clip CTA',
      /^\s*Generate 70 British Professor Voices & Sync All Devices$/.test(app.byId('btnOneClickMasterSetup').textContent) &&
      app.byId('btnOneClickMasterSetup').getAttribute('data-primary-cta') === '1',
      app.byId('btnOneClickMasterSetup').textContent);
    check('G3.11e the retry row stays hidden until a clip actually fails',
      app.byId('btnRetryFailedClip').parentNode.hasAttribute('hidden'),
      app.byId('btnRetryFailedClip').parentNode.outerHTML.slice(0, 90));
    check('G3.11f the ONE sync bar hops from the dock into Card 3 on unlock',
      barDocked === 'studioSyncDock' && app.byId('lecturerSyncBar').parentNode.id === 'studioSyncSlot' &&
      app.byId('screen-studio').contains(app.byId('lecturerSyncBar')),
      barDocked + ' -> ' + app.byId('lecturerSyncBar').parentNode.id);
    const fullQueue = app.SDP.Studio.queueFor(null, false);
    const retryQueue = app.SDP.Studio.queueFor(null, false, ['guide.en.1']);
    check('G3.11g the pack is exactly 70 clips (30 words + 30 numbers + 6 commands + 4 guide steps)',
      fullQueue.length === 70 &&
      fullQueue.filter((c) => c.key.indexOf('guide.en.') === 0).length === 4 &&
      fullQueue.filter((c) => c.key.indexOf('num.') === 0).length === 30 &&
      fullQueue.filter((c) => c.key.indexOf('cmd.') === 0).length === 6,
      fullQueue.length + ' clips');
    check('G3.11h a delta retry re-queues ONLY the failed clip — never a paid one',
      retryQueue.length === 1 && retryQueue[0].key === 'guide.en.1',
      retryQueue.map((c) => c.key).join(','));
    app.SDP.Views.showTab('settings');
    await app.settle(2);
    check('G3.11i Settings is student-only: one banner in, no studio cards',
      app.byId('settingsLecturerBanner') !== null && app.qa('#screen-settings .studio-card').length === 0 &&
      !app.byId('screen-settings').contains(app.byId('studioBody')),
      app.byId('settingsLecturerBanner').textContent.slice(0, 60));
    app.close();
  }

  for (const r of results) if (r.status === 'FAIL') fails.push(r);
  console.log(JSON.stringify(results, null, 2));
  console.log('\nG3 phase1.cjs — ' + (results.length - fails.length) + ' PASS / ' + fails.length + ' FAIL');
  if (fails.length) process.exitCode = 1;
})().catch((err) => {
  console.error('G3 harness crashed:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
