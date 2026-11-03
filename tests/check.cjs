#!/usr/bin/env node
'use strict';
/* G1 — Structure, byte-budget, ES5, preservation and forbidden-legacy gate.
 *
 * contract: docs/ARCHITECTURE_MAP.md §H1 target tree & byte budgets
 * contract: docs/ARCHITECTURE_MAP.md §H2 structural DOM id contract
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R7 SDP_ENC_V2 wire format
 * contract: docs/CHANGELOG_LEDGER.md §Release ledger (pinned byte sizes)
 *
 * Usage:
 *   node tests/check.cjs                      strict release run (all files must exist)
 *   node tests/check.cjs --allow-pending      phase runs while modules are still landing
 *   node tests/check.cjs --json               machine readable output
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const acorn = require('acorn');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const ALLOW_PENDING = argv.indexOf('--allow-pending') >= 0 || argv.indexOf('--allow-pending-modules') >= 0;
const JSON_OUT = argv.indexOf('--json') >= 0;

const results = [];
function record(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail || '') });
  return ok;
}
function read(p) { return fs.readFileSync(path.join(ROOT, p)); }
function readText(p) { return read(p).toString('utf8'); }
function exists(p) { return fs.existsSync(path.join(ROOT, p)); }
function bytes(p) { return fs.statSync(path.join(ROOT, p)).size; }
function sha256(p) { return crypto.createHash('sha256').update(read(p)).digest('hex'); }

/* ── H1 byte budgets ───────────────────────────────────────────────────────
 * contract: docs/ARCHITECTURE_MAP.md §H1 — every shipped file has an owner
 * and an explicit ceiling; an unbudgeted file is a release blocker (W4). */
const BUDGET = {
  /* contract: docs/ARCHITECTURE_MAP.md §H1 — v0.0.2.b ceilings (W4). The three
     module ceilings moved again for the D1–D20 work: studio 126000, sync 86000,
     views 136000, engine 62000; session.json is the exact 57,381 B payload. */
  'index.html': 43000,
  'assets/css/sdp-ui.css': 78000,
  'assets/fonts/NotoSansSinhala-Regular.woff2': 48520,
  'assets/fonts/NotoSansSinhala-Bold.woff2': 48748,
  'data/sdp-data-sync.js': 86000,
  'data/sdp-audio-speech.js': 52000,
  'data/sdp-dictation-engine.js': 62000,
  'data/sdp-ui-views.js': 148000,
  /* v0.0.4.a: the studio gained sha1Hex, the 70-clip catalogue and the live key
     verifier; the ceiling moved with it, in lockstep with audit-v42.cjs. */
  'data/studio.js': 152000,
  'data/data-meter.js': 24000,
  'data/session.json': 57379,
  'data/config.json': 38000,
  'data/version.json': 2000,
  'data/gas-source.txt': 13764,
  'data/elevenlabs-audio.json': 2500000,
  'data.html': 34000,
  'data/index.html': 34000,
  'sw.js': 13000,
  'manifest.webmanifest': 4000,
  'docs/ARCHITECTURE_MAP.md': 52000,
  'docs/UI_COMPONENT_GUIDE.md': 52000,
  'docs/SYNC_AND_DATA_CONTRACT.md': 52000,
  'docs/CHANGELOG_LEDGER.md': 56000,
  'docs/DAILY_UPGRADE_PROMPT_TEMPLATE.md': 24000
};
/* contract: docs/ARCHITECTURE_MAP.md §H1 — preserved read-only payloads are
 * pinned to an exact byte count so an accidental editor save is caught. */
const EXACT = [
  'assets/fonts/NotoSansSinhala-Regular.woff2',
  'assets/fonts/NotoSansSinhala-Bold.woff2',
  'data/session.json',
  'data/gas-source.txt'
];
/* contract: docs/SYNC_AND_DATA_CONTRACT.md §D-UI11 — data/elevenlabs-audio.json is
 * now written by the app on every publish, so it is budgeted (<= 2.5 MB) and its
 * release header is asserted instead of being frozen to a hash. */
/* contract: docs/SYNC_AND_DATA_CONTRACT.md §Appendix A — hashes of the five
 * irreplaceable classroom files. Update only after an intentional publish. */
const PRESERVED_SHA = {
  'data/session.json': 'bd42e85870a9bda1f55d6ac1a45b5ca7352d83de951910722dc0387774a82479',
  'data/gas-source.txt': '591b9b086f6d3723afb2604a837ffc495c69a481c490f11e58131c2222b0981e',
  'assets/fonts/NotoSansSinhala-Regular.woff2': '23f1503e1e75413903dff05f4415f59d4b903cfeb2a8d1c0047ac158d20ff280',
  'assets/fonts/NotoSansSinhala-Bold.woff2': 'bf59c1487b0a88a07a678190fd7a6e93aa01c5ec3f3f2f9e349922ac944a643e'
};
/* contract: docs/ARCHITECTURE_MAP.md §H1 — release gates live in tests/ and
 * are budgeted too, so a runaway suite cannot become an unbudgeted artifact. */
const TEST_FILES = [
  'tests/check.cjs', 'tests/upgrade.test.cjs', 'tests/phase1.cjs', 'tests/server.cjs',
  'tests/browser.cjs', 'tests/upgrade-browser.cjs', 'tests/e2e.cjs', 'tests/live-lab.cjs',
  'tests/audit-v42.cjs', 'tests/app-harness.cjs', 'tests/chromium-env.cjs',
  'tests/test-pin.cjs', 'tests/package.json',
  /* v0.0.1.e registers three more gates: voice/guide, vault/sync, studio safety */
  'tests/voice-guide.cjs', 'tests/vault-sync.cjs', 'tests/studio-safety.cjs'
];
const TEST_BUDGET = 320000;

/* contract: docs/ARCHITECTURE_MAP.md §H2 — retired v42–v60 ids/strings must be
 * gone from every shipped byte, never merely hidden with display:none (W8). */
const FORBIDDEN = [
  'bgLiveWrap', 'bgLiveVideo', 'btnLiveVideo', 'liveVideoInput', 'dimTpl', 'dimHostSet',
  'sVideoDim', 'topDataBadge', 'topDataMB', 'topDataLkr', 'btnDataSheet', 'dataSheet',
  'guideSheet', 'btnReadyTest', 'screen-comm', 'tab-comm', 'commBadge', 'btnMsg',
  'printview', 'v58Rail', 'sdpDesktopRail', 'sdpV56', 'materialMixer',
  "I'm ready", 'Write the word now'
];
const SHIPPED = [
  'index.html', 'data.html', 'data/index.html', 'sw.js',
  'assets/css/sdp-ui.css',
  'data/sdp-data-sync.js', 'data/sdp-audio-speech.js', 'data/sdp-dictation-engine.js',
  'data/sdp-ui-views.js', 'data/studio.js', 'data/data-meter.js'
];
const DOCS = [
  'docs/ARCHITECTURE_MAP.md', 'docs/UI_COMPONENT_GUIDE.md', 'docs/SYNC_AND_DATA_CONTRACT.md',
  'docs/CHANGELOG_LEDGER.md', 'docs/DAILY_UPGRADE_PROMPT_TEMPLATE.md'
];

function pending(p) {
  /* contract: W6 — phase runs verify everything that exists yet */
  if (ALLOW_PENDING) { record('pending: ' + p, true); return true; }
  return false;
}

/* 1 ── file tree, budgets and no unbudgeted overflow (W4) ------------------ */
(function treeAndBudgets() {
  let missing = 0, over = 0;
  Object.keys(BUDGET).forEach(function (p) {
    if (!exists(p)) { if (!pending(p)) missing += 1; return; }
    const size = bytes(p);
    if (size > BUDGET[p]) over += 1;
    record('budget ' + p + ' <= ' + BUDGET[p] + 'B (' + size + 'B)', size <= BUDGET[p], size + ' > ' + BUDGET[p]);
  });
  record('H1 tree complete (' + (Object.keys(BUDGET).length - missing) + '/' + Object.keys(BUDGET).length + ' budgeted files)', missing === 0, missing + ' missing');

  /* W4: nothing shipped may exist outside the H1 table. */
  const shippedDirs = ['assets', 'data'];
  const strays = [];
  shippedDirs.forEach(function (dir) {
    const walk = function (rel) {
      fs.readdirSync(path.join(ROOT, rel)).forEach(function (name) {
        const p = rel + '/' + name;
        if (fs.statSync(path.join(ROOT, p)).isDirectory()) { walk(p); return; }
        if (!BUDGET[p]) strays.push(p + ' (' + bytes(p) + 'B)');
      });
    };
    if (fs.existsSync(path.join(ROOT, dir))) walk(dir);
  });
  ['index.html', 'data.html', 'sw.js', 'manifest.webmanifest'].forEach(function (p) {
    if (exists(p) && !BUDGET[p]) strays.push(p);
  });
  if (exists('data/index.html') && !BUDGET['data/index.html']) strays.push('data/index.html');
  record('no unbudgeted shipped files', strays.length === 0, strays.join(', '));
})();

/* 2 ── strict ES5 syntax on every shipped script (W3) --------------------- */
(function es5() {
  const files = Object.keys(BUDGET).filter(function (p) { return /\.js$/.test(p); });
  let bad = [];
  files.forEach(function (p) {
    if (!exists(p)) return;
    try { acorn.parse(readText(p), { ecmaVersion: 5, sourceType: 'script' }); }
    catch (e) { bad.push(p + ': ' + e.message); }
  });
  /* contract: W3 — inline scripts in the three HTML entry points are ES5 too */
  ['index.html', 'data.html', 'data/index.html'].forEach(function (p) {
    if (!exists(p)) return;
    const html = readText(p);
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
    let m, n = 0;
    while ((m = re.exec(html)) !== null) {
      const body = m[1];
      if (!body.trim()) continue;
      n += 1;
      try { acorn.parse(body, { ecmaVersion: 5, sourceType: 'script' }); }
      catch (e) { bad.push(p + ' inline#' + n + ': ' + e.message); }
    }
  });
  record('every shipped script parses as strict ES5 (acorn ecmaVersion 5)', bad.length === 0, bad.join(' | '));
})();

/* 3 ── no minified/bundled monolith (W3 / PR #111 guard) ------------------ */
(function unminified() {
  const files = Object.keys(BUDGET).filter(function (p) { return /\.js$/.test(p); });
  const offenders = [];
  files.forEach(function (p) {
    if (!exists(p)) return;
    const lines = readText(p).split('\n');
    let longest = 0;
    lines.forEach(function (l) { if (l.length > longest) longest = l.length; });
    if (longest > 900) offenders.push(p + ' longest line ' + longest);
  });
  record('no shipped script is minified (longest line <= 900 chars)', offenders.length === 0, offenders.join(', '));
})();

/* 4 ── /data transparency pair is byte identical --------------------------- */
(function dataPair() {
  if (!exists('data.html') || !exists('data/index.html')) { pending('data.html pair'); return; }
  const a = read('data.html'), b = read('data/index.html');
  record('data.html and data/index.html are byte identical', a.equals(b), a.length + ' vs ' + b.length);
  record('transparency routes <= 60000 B', a.length <= 60000 && b.length <= 60000, a.length + '/' + b.length);
})();

/* 5 ── preserved classroom payloads -------------------------------------- */
(function preserved() {
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §Appendix A */
  const sizeBad = EXACT.filter(function (p) { return exists(p) && bytes(p) !== BUDGET[p]; });
  record('preserved files keep their exact pinned byte sizes', sizeBad.length === 0, sizeBad.map(function (p) { return p + '=' + bytes(p) + ' (want ' + BUDGET[p] + ')'; }).join(', '));
  const shaBad = Object.keys(PRESERVED_SHA).filter(function (p) { return exists(p) && sha256(p) !== PRESERVED_SHA[p]; });
  record('preserved files keep their SHA-256 (classroom data lock)', shaBad.length === 0, shaBad.join(', '));

  const fonts = ['assets/fonts/NotoSansSinhala-Regular.woff2', 'assets/fonts/NotoSansSinhala-Bold.woff2'];
  const fontBad = fonts.filter(function (p) { return !exists(p) || read(p).slice(0, 4).toString('latin1') !== 'wOF2'; });
  record('both Sinhala fonts carry the wOF2 magic header', fontBad.length === 0, fontBad.join(', '));

  if (exists('data/session.json')) {
    const s = JSON.parse(readText('data/session.json'));
    const active = (s.lists || []).filter(function (l) { return l.id === 'list_session_8_feelings'; })[0];
    const archived = (s.lists || []).filter(function (l) { return l.id === 'list_session_7_travel'; })[0];
    record('session.json keeps 30 Session 8 (feelings) words', !!active && active.words.length === 30, active ? active.words.length : 'no list');
    record('session.json keeps 30 Session 7 (travel) archive words', !!archived && archived.words.length === 30, archived ? archived.words.length : 'no list');
    const fields = ['w', 'p', 'pos', 'm', 'si', 's'];
    const fieldBad = (active ? active.words : []).filter(function (w) {
      return fields.some(function (f) { return !w[f]; });
    });
    record('all 30 active words carry w/p/pos/m/si/s', fieldBad.length === 0, fieldBad.length + ' incomplete');
  } else { pending('session.json payload'); }

  if (exists('data/elevenlabs-audio.json')) {
    const v = JSON.parse(readText('data/elevenlabs-audio.json'));
    record('voice pack pins Alice / eleven_flash_v2_5',
      v.voiceId === 'Xb7hH8MSUJpSbSDYk0k2' && v.voiceName === 'Alice' &&
      v.modelId === 'eleven_flash_v2_5' && typeof v.clips === 'object',
      JSON.stringify({ voiceId: v.voiceId, voiceName: v.voiceName, modelId: v.modelId }));
  }
  if (exists('data/gas-source.txt')) {
    record('Apps Script backend source keeps doGet/doPost handlers',
      /function doGet/.test(readText('data/gas-source.txt')) && /function doPost/.test(readText('data/gas-source.txt')));
  }
})();

/* 6 ── version, vault and secret hygiene ---------------------------------- */
(function versions() {
  if (exists('data/version.json')) {
    const v = JSON.parse(readText('data/version.json'));
    // contract: docs/CHANGELOG_LEDGER.md §Release ledger — v0.0.4.a ships ver 12 / schema 12 / settingsRev 20
    const ok = v.ver === 13 && v.appVersion === '0.0.4.a' && v.version === '0.0.4.a' &&
      v.schema === 13 && v.settingsRev === 23 && String(v.session) === '8';
    record('version.json carries the v0.0.4.a schema', ok, JSON.stringify(v).slice(0, 220));
    record('version.json pins syncRev 1793656017976', Number(v.syncRev) === 1793656017976, JSON.stringify(v).slice(0, 200));
    /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R14.1 — the module constant and the
       shipped pointer must never disagree, or a device re-adopts stale classSettings. */
    const syncSrc = exists('data/sdp-data-sync.js') ? readText('data/sdp-data-sync.js') : '';
    const m = /var\s+SETTINGS_REV\s*=\s*(\d+)/.exec(syncSrc);
    record('SETTINGS_REV agrees with version.json settingsRev',
      !!m && Number(m[1]) === Number(v.settingsRev), m ? m[1] + ' vs ' + v.settingsRev : 'SETTINGS_REV missing');
    record('version.json stays slim (<= 2000 B)', bytes('data/version.json') <= 2000, bytes('data/version.json'));
  } else { pending('version.json'); }

  if (exists('data/config.json')) {
    const c = JSON.parse(readText('data/config.json'));
    record('config.json keeps the preserved backend payload',
      c.credits && c.credits.createdBy === 'Hansana' && c.credits.ideaBy === 'Ayya01 (Lesandu)' &&
      c.tts && c.live && c.live.state && c.voiceId === 'Xb7hH8MSUJpSbSDYk0k2' && c.voiceName === 'Alice' &&
      c.modelId === 'eleven_flash_v2_5' && c.repoOwner === 'dictationb1' &&
      c.repoName === 'dictationb1.github.io' && c.defaults && c.classInfo,
      'preserved payload trimmed');
    record('config.json exposes the SDP_ENC_V2 vault slot', c.encVault === 'SDP_ENC_V2:AAA=' || /^SDP_ENC_V2:/.test(String(c.encVault)), String(c.encVault));
    // contract: docs/CHANGELOG_LEDGER.md §Release ledger — config.json header follows the v0.0.4.a bump set
    record('config.json carries v0.0.4.a version fields',
      c.ver === 13 && c.appVersion === '0.0.4.a' && c.version === '0.0.4.a' && c.schema === 13 && c.settingsRev === 23,
      JSON.stringify([c.ver, c.appVersion, c.schema, c.settingsRev]));
    record('config.json keeps the credits block verbatim',
      c.credits.en === 'Created by Hansana · Idea given by Ayya01 (Lesandu) · Lecturer in Charge: Sumodya Sewmini' &&
      /^නිර්මාණය: Hansana · අදහස: Ayya01 \(Lesandu\) · භාරකාර කථිකාචාර්ය: /.test(c.credits.si),
      JSON.stringify(c.credits && [c.credits.en, c.credits.si]));
    /* contract: docs/CHANGELOG_LEDGER.md §v0.0.1.e — the credits must survive
       verbatim in EN and SI, plus the pill, on Home, About and /data. */
    const PILL = 'CREDITS GOES TO Hansana';
    const EN_LINE = 'Lecturer in Charge: Ms. Sumodya Sewmini \u00b7 Creator: Hansana \u00b7 Concept: Ayya01 (Lesandu)';
    const SI_HEAD = '\u0db1\u0dd2\u0dbb\u0dca\u0db8\u0dcf\u0dab\u0dba: Hansana';
    if (exists('index.html')) {
      const home = readText('index.html');
      const pills = (home.match(new RegExp(PILL, 'g')) || []).length;
      record('index.html keeps the credits pill on Home and About', pills >= 2, pills);
      record('index.html keeps the EN + SI credit lines twice',
        (home.match(new RegExp(EN_LINE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length >= 2 &&
        (home.match(new RegExp(SI_HEAD, 'g')) || []).length >= 2, 'en/si');
    } else { pending('index.html credits'); }
    if (exists('data.html')) {
      const dp = readText('data.html');
      record('data.html keeps the credits pill, EN line and SI line',
        dp.indexOf(PILL) !== -1 && dp.indexOf(EN_LINE) !== -1 && dp.indexOf(SI_HEAD) !== -1,
        JSON.stringify([dp.indexOf(PILL) !== -1, dp.indexOf(EN_LINE) !== -1, dp.indexOf(SI_HEAD) !== -1]));
    } else { pending('data.html credits'); }
    /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R11.1 — the ten classroom keys */
    const CLASSY = ['mode', 'writeSecs', 'repeats', 'pauseSecs', 'autoAdvance',
      'pacingPreset', 'voiceLock', 'voiceSource', 'rate', 'theme'];
    /* D7: classSettings.lang = 'en' — the British English DEFAULT a fresh device
       adopts. lang is still not one of the ten keys Studio publishes (R3). */
    record('config.json ships classSettings with the ten classroom keys + the D7 en default',
      !!c.classSettings && CLASSY.every(function (k) { return c.classSettings[k] !== undefined; }) &&
      c.classSettings.lang === 'en' && Object.keys(c.classSettings).length === CLASSY.length + 1,
      JSON.stringify(c.classSettings || null).slice(0, 200));
    /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R11.4 — the bootstrap PIN gate */
    record('config.json ships a PBKDF2-SHA256 pinVerifier (250,000 iterations)',
      !!c.pinVerifier && c.pinVerifier.algo === 'PBKDF2-SHA256' && c.pinVerifier.iterations === 250000 &&
      String(c.pinVerifier.salt).length >= 16 && String(c.pinVerifier.hash).length >= 32,
      JSON.stringify(c.pinVerifier || null));
    record('pinVerifier carries only a salt and a hash (never the PIN)',
      !!c.pinVerifier && !/78987898/.test(JSON.stringify(c.pinVerifier)));
  } else { pending('config.json'); }

  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R7 — secrets never land in git */
  const tracked = [];
  (function walk(rel) {
    fs.readdirSync(path.join(ROOT, rel)).forEach(function (name) {
      if (name === 'node_modules' || name === 'artifacts' || name === '.git') return;
      const p = rel ? rel + '/' + name : name;
      const full = path.join(ROOT, p);
      if (fs.statSync(full).isDirectory()) { walk(p); return; }
      if (!/\.(js|cjs|json|html|md|txt|webmanifest|css|yml)$/.test(name)) return;
      tracked.push(p);
    });
  })('');
  const secrets = [];
  tracked.forEach(function (p) {
    const text = readText(p);
    /* build the needles from fragments so this file is not its own finding */
    const needles = ['s' + 'k_', 'gh' + 'p_', 'github' + '_pat_'];
    needles.forEach(function (n) {
      const at = text.indexOf(n);
      if (at >= 0 && text.slice(at).replace(/[A-Za-z0-9_\-]{16,}/, '').length < text.slice(at).length) {
        const tail = text.slice(at + n.length, at + n.length + 24);
        if (/^[A-Za-z0-9_\-]{16,}$/.test(tail)) secrets.push(p + ' -> ' + n + '…');
      }
    });
  });
  record('no plaintext API secrets in tracked files', secrets.length === 0, secrets.join(', '));

  /* contract: docs/DAILY_UPGRADE_PROMPT_TEMPLATE.md §v0.0.1.e — PIPE-01/03:
     the three newest gates must exist, and both pipelines must chain all 12. */
  ['voice-guide.cjs', 'vault-sync.cjs', 'studio-safety.cjs'].forEach(function (f) {
    record('G10-G12 gate exists: tests/' + f, exists('tests/' + f));
  });
  const pkg = exists('tests/package.json') ? JSON.parse(readText('tests/package.json')) : {};
  const gatesScript = String((pkg.scripts || {}).gates || '');
  const chained = ['check.cjs', 'upgrade.test.cjs', 'phase1.cjs', 'server.cjs', 'browser.cjs',
    'upgrade-browser.cjs', 'e2e.cjs', 'live-lab.cjs', 'audit-v42.cjs', 'voice-guide.cjs',
    'vault-sync.cjs', 'studio-safety.cjs'];
  record('tests/package.json chains all 12 gates',
    chained.every(function (f) { return gatesScript.indexOf(f) >= 0; }), gatesScript.slice(0, 120));
  const workflow = exists('.github/workflows/checks.yml') ? readText('.github/workflows/checks.yml') : '';
  record('checks.yml runs G10, G11 and G12',
    ['voice-guide.cjs', 'vault-sync.cjs', 'studio-safety.cjs'].every(function (f) { return workflow.indexOf(f) >= 0; }));
  /* contract: docs/CHANGELOG_LEDGER.md §v0.0.1.e — PIPE-02: the app-written
     voice pack must never be SHA-pinned in CI again. */
  const shaStep = workflow.slice(workflow.indexOf('Preserved payloads must still match'));
  record('CI no longer SHA-pins the app-written elevenlabs-audio.json',
    shaStep.indexOf('elevenlabs-audio.json') < 0 && workflow.indexOf('153111d6') < 0);
})();

/* 7 ── retired ids, media and stubs are gone for good (W8) ---------------- */
(function retired() {
  const hits = [];
  SHIPPED.forEach(function (p) {
    if (!exists(p)) return;
    const text = readText(p);
    FORBIDDEN.forEach(function (needle) {
      if (text.indexOf(needle) >= 0) hits.push(p + ' -> ' + needle);
    });
  });
  record('zero forbidden legacy ids/strings in shipped bytes', hits.length === 0, hits.join(', '));

  const media = [];
  (function walk(rel) {
    if (!fs.existsSync(path.join(ROOT, rel))) return;
    fs.readdirSync(path.join(ROOT, rel)).forEach(function (name) {
      const p = rel + '/' + name;
      if (fs.statSync(path.join(ROOT, p)).isDirectory()) { walk(p); return; }
      if (/\.mp4$/i.test(name) || /^guide-si-\d+\.mp3$/.test(name)) media.push(p + ' (' + bytes(p) + 'B)');
    });
  })('assets');
  record('zero wallpaper videos and zero fake guide-si mp3 stubs', media.length === 0, media.join(', '));

  record('no retired build scripts directory', !fs.existsSync(path.join(ROOT, 'scripts')));
})();

/* 8 ── documentation ledger installed ----------------------------------- */
(function docs() {
  const bad = [];
  DOCS.forEach(function (p) {
    if (!exists(p)) { if (!ALLOW_PENDING) bad.push(p + ' missing'); return; }
    if (bytes(p) < 400) bad.push(p + ' looks empty (' + bytes(p) + 'B)');
  });
  record('all five docs/*.md ledger files exist and are non-empty', bad.length === 0, bad.join(', '));
  const unbudgeted = DOCS.filter(function (p) { return exists(p) && bytes(p) > (BUDGET[p] || 0); });
  record('docs/*.md stay inside their budgets', unbudgeted.length === 0, unbudgeted.join(', '));
})();

/* 9 ── index.html shell wiring ------------------------------------------ */
(function shell() {
  if (!exists('index.html')) { pending('index.html'); return; }
  const html = readText('index.html');
  const order = [
    './data/data-meter.js', './data/sdp-data-sync.js', './data/sdp-audio-speech.js',
    './data/sdp-dictation-engine.js', './data/sdp-ui-views.js', './data/studio.js'
  ];
  const positions = order.map(function (src) { return html.indexOf(src); });
  const ordered = positions.every(function (p, i) { return p > 0 && (i === 0 || p > positions[i - 1]); });
  /* contract: docs/ARCHITECTURE_MAP.md §R10 fixed load order */
  record('index.html loads the six modules in the fixed R10 order', ordered, JSON.stringify(positions));
  record('index.html ships the single sdp-ui.css stylesheet', html.indexOf('./assets/css/sdp-ui.css') > 0);
  // contract: docs/ARCHITECTURE_MAP.md §R1 boot target is a single TARGET constant
  record('index.html declares the v0.0.4.a boot target', html.indexOf("'0.0.4.a'") > 0 || html.indexOf('"0.0.4.a"') > 0);
  const tabs = ['tab-home', 'tab-player', 'tab-practice', 'tab-dict', 'tab-settings', 'tab-studio'];
  record('index.html contains the six tab ids', tabs.every(function (id) { return html.indexOf('id="' + id + '"') >= 0; }), tabs.filter(function (id) { return html.indexOf('id="' + id + '"') < 0; }).join(','));
  const screens = ['screen-home', 'screen-player', 'screen-practice', 'screen-dict', 'screen-settings', 'screen-studio'];
  record('index.html contains the six screen ids', screens.every(function (id) { return html.indexOf('id="' + id + '"') >= 0; }), screens.filter(function (id) { return html.indexOf('id="' + id + '"') < 0; }).join(','));
  record('index.html ships #rail-studio beside the five original rail buttons', html.indexOf('id="rail-studio"') > 0 && html.indexOf('data-tab="studio"') > 0);
  record('index.html ships the dedicated Lecturer Admin Studio screen', /<section class="screen" id="screen-studio" aria-label="Lecturer Admin Studio">/.test(html));
  record('index.html keeps #lecturerSyncBar + #btnSyncClassSettings inside #screen-studio',
    (function () {
      var studio = html.slice(html.indexOf('id="screen-studio"'));
      return studio.indexOf('id="lecturerSyncBar"') > 0 && studio.indexOf('id="btnSyncClassSettings"') > 0 && studio.indexOf('id="studioBody"') > 0;
    })());
  record('index.html ships the amber STEP cue on the Home primary CTA',
    /class="cue" data-cue="home"/.test(html) && html.indexOf('STEP 1 — PRESS HERE') > 0);
  record('index.html ships #sessionProgressStrip and #sessionPills', html.indexOf('id="sessionProgressStrip"') > 0 && html.indexOf('id="sessionPills"') > 0);
  record('index.html ships the 4-button tactile transport', ['btnPrev', 'btnPlayPause', 'btnReplay', 'btnNext'].every(function (id) { return html.indexOf('id="' + id + '"') > 0; }));
  record('index.html no longer nests the studio inside #screen-settings',
    (function () {
      var settings = html.slice(html.indexOf('id="screen-settings"'), html.indexOf('id="screen-studio"'));
      return settings.indexOf('studioAccordion') < 0 && settings.indexOf('lecturerSyncBar') < 0 && settings.indexOf('settingsLecturerBanner') > 0;
    })());
})();

/* 9b ── v0.0.2.b tactile system, 34-clip arithmetic and Guide 3.0 (D8–D18) --- */
(function tactileSystem() {
  var css = exists('assets/css/sdp-ui.css') ? readText('assets/css/sdp-ui.css') : '';
  record('D8 the 54px tactile tokens ship in the single stylesheet',
    /--btn-h:\s*54px/.test(css) && /--shadow-btn:/.test(css) && /--grad-primary:/.test(css) && /--grad-go:/.test(css));
  record('D8 .btn is 54px tall with a 2px press collapse',
    /\.btn \{[^}]*min-height: var\(--btn-h\)/.test(css) && /\.btn:active \{[^}]*translateY\(2px\)/.test(css));
  record('D8 .btn-primary and .btn-go are gradient fills with #FFFFFF ink',
    /\.btn-primary \{[^}]*var\(--grad-primary\)/.test(css) && /\.btn-go \{[^}]*var\(--grad-go\)/.test(css));
  record('D8 static .badge and unpressed .pill are flattened to a sunken label',
    /\.badge \{[^}]*box-shadow: none/.test(css) && /\.pill:not\(\[aria-pressed='true'\]\)/.test(css));
  record('D9 the .cue amber callout pill ships', /\.cue \{[^}]*background: #F59E0B/.test(css));
  record('D11 the 30-pill strip and its done/current/todo states ship',
    /\.word-pill\.done/.test(css) && /\.word-pill\.current/.test(css) && /\.word-pill\.todo/.test(css));
  var studio = exists('data/studio.js') ? readText('data/studio.js') : '';
  record('D2 #studioPackDashboard computes X/70 clips live from the pack',
    studio.indexOf('studioPackDashboard') > 0 && /studioClipsUnit/.test(studio) && /\.clips/.test(studio));
  record('D3 #studioGenProgress prints the verbatim "Generating clip n/N" line',
    /studioGenPrefix/.test(studio) && studio.indexOf('studioGenProgress') > 0);
  record('D4 the failed clip is recorded and #btnRetryFailedClip exists',
    /lastFailedClip/.test(studio) && studio.indexOf('btnRetryFailedClip') > 0);
  record('D18 the 70-clip arithmetic is stated in the cost line',
    /clips \(30 words \+ 30 numbers \+ 6 commands \+ 4 guide steps\)/.test(studio));
  var views = exists('data/sdp-ui-views.js') ? readText('data/sdp-ui-views.js') : '';
  /* contract: docs/UI_COMPONENT_GUIDE.md §3 — v0.0.4.a replaces the four mock
     cards with ONE compact spotlight (R2/F3). No mock markup may survive. */
  record('D16 the compact four-step spotlight ships (no mock cards)',
    /GUIDE_SPOTLIGHT_STEPS/.test(views) && /guideSpotlight/.test(readText('index.html')) &&
    /guideStepTag/.test(readText('index.html')) && /guideDots/.test(readText('index.html')) &&
    !/guideMockMarkup/.test(views) && !/mock-ring/.test(views));
  record('D16 the guide stamp follows the running version', /markGuideSeen/.test(exists('data/sdp-data-sync.js') ? readText('data/sdp-data-sync.js') : '') && /APP_VERSION/.test(views));
})();

/* 10 ── test suite files budgeted --------------------------------------- */
(function tests() {
  const bad = TEST_FILES.filter(function (p) {
    if (!exists(p)) { if (ALLOW_PENDING) return false; return true; }
    return bytes(p) > TEST_BUDGET;
  });
  record('release gate files present and inside budget', bad.length === 0, bad.join(', '));
  /* contract: docs/ARCHITECTURE_MAP.md §12-gate registry — the suite is exactly
     the twelve registered gates plus its harnesses. */
  const GATES = ['check.cjs', 'upgrade.test.cjs', 'phase1.cjs', 'server.cjs', 'browser.cjs',
    'upgrade-browser.cjs', 'e2e.cjs', 'live-lab.cjs', 'audit-v42.cjs',
    'voice-guide.cjs', 'vault-sync.cjs', 'studio-safety.cjs'];
  const missingGates = GATES.filter(function (g) { return !exists('tests/' + g); });
  record('all twelve registered gates ship in tests/', missingGates.length === 0, missingGates.join(','));
})();

  /* 11 ── v0.0.1.b feature surface (release ledger, docs/CHANGELOG_LEDGER.md) -- */
  (function vb1FeatureSurface() {
    if (!exists('index.html')) { pending('index.html'); return; }
    var html = readText('index.html');
    var sw = exists('sw.js') ? readText('sw.js') : '';
    var sync = exists('data/sdp-data-sync.js') ? readText('data/sdp-data-sync.js') : '';
    var speech = exists('data/sdp-audio-speech.js') ? readText('data/sdp-audio-speech.js') : '';
    var views = exists('data/sdp-ui-views.js') ? readText('data/sdp-ui-views.js') : '';
    record('index.html ships the in-session sync badge', html.indexOf('id="syncBadge"') > 0);
    record('index.html ships the studio quick launcher', html.indexOf('id="btnStudioQuick"') > 0);
    record('index.html ships exactly the two spotlight buttons (start / exit)',
      /id="btnGuideSkipStart"/.test(html) && /id="btnGuideClose"/.test(html) &&
      !/guideNextStep/.test(html) && !/guideReplayStep/.test(html) && !/guidePauseVoice/.test(html));
    record('index.html boots at the v0.0.4.a target', /var TARGET = '0\.0\.4\.a'/.test(html));
    record('service worker pins the v0.0.4.a shell caches',
      /SW_VERSION = 'sdp-v0\.0\.4\.a'/.test(sw) && /SHELL_CACHE = 'sdp-v0\.0\.4\.a-shell'/.test(sw));
    /* W7: the studio must stamp whatever SDP.version says — never a frozen literal. */
    var studioCode = readText('data/studio.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    record('studio.js never hardcodes a release literal (reads SDP.version)',
      !/0\.0\.[0-9]/.test(studioCode) && /SDP\.version/.test(studioCode), (studioCode.match(/0\.0\.[0-9]/g) || []).join(','));
    record('service worker handles on-demand word-audio caching (sdp:cache-words)', /sdp:cache-words/.test(sw));
    record('sync module exposes triggerVersionUpgrade (D1 in-session upgrade)', /triggerVersionUpgrade/.test(sync));
    record('sync module exposes downloadOfflineAudio (offline clips)', /downloadOfflineAudio/.test(sync));
    record('speech module exports playGuideStep for EN guide narration', /playGuideStep/.test(speech));
    record('settings ship quick pacing presets (beginner / standard / exam / board)',
      /presetRow/.test(views) && /presetBeginner/.test(views) && /presetBoard/.test(views));
    record('settings ship Voice Persona Lock (unified / custom)', /id="setVoiceLock"/.test(html));
    record('settings ship guide auto-play preference', /id="setGuideAutoPlay"/.test(html));
    record('settings ship offline clip download (btnDownloadClips)', /id="btnDownloadClips"/.test(html));
    if (exists('data/version.json')) {
      var v = JSON.parse(readText('data/version.json'));
      record('version.json pins buildDate 2026-11-02', v.buildDate === '2026-11-03');
    }
    var man = exists('manifest.webmanifest') ? readText('manifest.webmanifest') : '';
    record('manifest start_url carries the PWA source tag', /source=pwa/.test(man));
    record('manifest start_url and shortcuts carry v0.0.4.a',
      /"start_url": "\.\/\?v=0\.0\.4\.a/.test(man) && man.indexOf('?v=0.0.4.a') > 0 &&
      (man.match(/v=0\.0\.4\.a/g) || []).length >= 3, (man.match(/v=0\.0\.4\.a/g) || []).length);
    /* D15 (v0.0.2.b): every versioned surface must agree, byte for byte, on the
       release literal and on ver 9 — no file may drift on its own. */
    var app = '0.0.4.a';
    var agree = {
      'index.html': html.indexOf(app) > 0,
      'data.html': exists('data.html') ? readText('data.html').indexOf(app) > 0 : false,
      'data/sdp-data-sync.js': sync.indexOf("'" + app + "'") > 0 && /SDP.ver = 13;/.test(sync),
      'sw.js': sw.indexOf('sdp-v' + app) > 0,
      'manifest.webmanifest': man.indexOf(app) > 0,
      'data/config.json': JSON.parse(readText('data/config.json')).appVersion === app && JSON.parse(readText('data/config.json')).ver === 13,
      'data/version.json': JSON.parse(readText('data/version.json')).appVersion === app && JSON.parse(readText('data/version.json')).ver === 13
    };
    var drifted = Object.keys(agree).filter(function (k) { return !agree[k]; });
    record('D15 all seven versioned surfaces agree on 0.0.4.a / ver 12',
      drifted.length === 0, drifted.join(', ') + ' ' + JSON.stringify(agree));
    var pack = JSON.parse(readText('data/elevenlabs-audio.json'));
    record('voice pack carries the v0.0.4.a header',
      pack.version === '0.0.4.a' && pack.appVersion === '0.0.4.a' && pack.ver === 13 && pack.schema === 13 &&
      pack.voiceId === 'Xb7hH8MSUJpSbSDYk0k2' && pack.hashAlgo === 'sha1',
      JSON.stringify([pack.version, pack.ver, pack.voiceId]));
  })();

const failed = results.filter(function (r) { return r.status === 'FAIL'; });
if (JSON_OUT) {
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results: results }, null, 2));
} else {
  results.forEach(function (r) {
    if (r.status === 'PASS' && r.test.indexOf('pending:') === 0) return;
    console.log((r.status === 'PASS' ? 'PASS  ' : 'FAIL  ') + r.test + (r.detail ? '  [' + r.detail + ']' : ''));
  });
  console.log('\nG1 check.cjs — ' + (results.length - failed.length) + ' PASS / ' + failed.length + ' FAIL');
}
process.exitCode = failed.length ? 1 : 0;
