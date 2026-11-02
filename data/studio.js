/*! Smart Dictation Player — Lecturer Studio & admin vault (v0.0.1.g)
 * Strict ES5, dependency free. The ONLY module that touches a key (W5/W6).
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R6, §R7 */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  var doc = global.document;
  var VOICE_ID = 'Xb7hH8MSUJpSbSDYk0k2';
  var VOICE_MODEL = 'eleven_flash_v2_5';
  var EL_SUBSCRIPTION = 'https://api.elevenlabs.io/v1/user/subscription';
  /* D1/D2 (Rule 1A): rung 2 — a scoped `sk_…` key 403s the quota read only. */
  var EL_VOICES = 'https://api.elevenlabs.io/v1/voices';
  var GUIDE_KEYS = ['_guide_1', '_guide_2', '_guide_3', '_guide_4'];
  var WORD_CAP = 30;
  /* R4/D6: the classroom bootstrap PIN (4–12 digits, PBKDF2-verified). */
  var BOOTSTRAP_PIN = '78987898';
  var PIN_MAX = 12;
  var PIN_MIN = 4;
  var DICTIONARY_API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
  var SINHALA_API = 'https://api.mymemory.translated.net/get?q=';
  /* D2/D4 verbatim UI strings (STRINGS_* carries the si twins). */
  var SCOPED_KEY = 'studioQuotaScoped';
  var TIER_KEY = 'studioElTierWarn';
  function SCOPED_NOTE() { return t(SCOPED_KEY); }
  function TIER_WARN() { return t(TIER_KEY); }
  /* D10 (R8): the 5-slot 100% free AI ladder. Slots 1 and 2 need no key. */
  var AI_PROVIDERS = {
    free_dict: { k: 'studioAiNoKey', needsKey: false, prefix: '' },
    pollinations_free: { k: 'studioAiSlotPollinations', needsKey: false, prefix: '' },
    groq: { k: 'studioAiSlotGroq', needsKey: true, prefix: 'gsk_' },
    openrouter: { k: 'studioAiSlotOpenrouter', needsKey: true, prefix: 'sk-or-' },
    gemini: { k: 'studioAiSlotGemini', needsKey: true, prefix: 'AIza' }
  };
  var AI_SLOT_ORDER = ['free_dict', 'pollinations_free', 'groq', 'openrouter', 'gemini'];
  var LLM_ENDPOINTS = {
    pollinations_free: { url: 'https://text.pollinations.ai/openai', model: 'openai' },
    groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
    openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', model: 'meta-llama/llama-3.3-70b-instruct:free' },
    gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', model: 'gemini-2.5-flash' }
  };

  function noop() {}
  function str(v) { return v === null || v === undefined ? '' : String(v); }
  function isObj(v) { return !!v && typeof v === 'object'; }
  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function setText(el, text) { if (el) el.textContent = str(text); }
  function esc(text) {
    return str(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function t(key, fallback) {
    try { if (SDP.Views && SDP.Views.t) return SDP.Views.t(key, fallback); } catch (e) {}
    return fallback === undefined ? key : fallback;
  }
  function T(key, fallback) { return esc(t(key, fallback)); }
  function en(key) {
    var table = SDP.STRINGS_EN || {};
    return str(table[key]);
  }
  function data() { return SDP.Data || null; }
  function sync() { return SDP.Sync || null; }
  function vault() { return SDP.Sync && SDP.Sync.Vault ? SDP.Sync.Vault : null; }

  /* D-S3: the studio version is READ from SDP.version, never hardcoded. */
  function appVersion() {
    var v = '';
    try { v = str(global.SDP && global.SDP.version); } catch (e) { v = ''; }
    if (!v) v = str(global.__SDP_BOOT_VERSION__);
    if (!v) {
      
      var pill = global.document && global.document.getElementById ? global.document.getElementById('sdpVerPill') : null;
      if (pill) v = str(pill.textContent).replace(/^v/i, '').trim();
    }
    return v;
  }
  function schemaVer() {
    var n = 0;
    try { n = Number(global.SDP && global.SDP.ver); } catch (e) { n = 0; }
    return n > 0 ? n : 3;
  }
  /* D-S4: settingsRev only ever moves forward. */
  function nextSettingsRev() {
    var current = 0;
    try { current = Number((sync() && sync().version() && sync().version().settingsRev) || 0); } catch (e) { current = 0; }
    return Math.max(schemaVer(), current + 1);
  }
  /* D19/W8: ONE monotonic publish clock (Math.max(Date.now(), prev+1)). */
  function nextSyncRev() {
    var prev = 0;
    try { prev = Number((sync() && sync().version() && sync().version().syncRev) || 0); } catch (e) { prev = 0; }
    return Math.max(Date.now(), prev + 1);
  }

  var ST = {
    unlocked: false,
    envelope: '',
    secrets: {},
    message: '',
    messageState: '',
    words: [],
    preview: null,
    pendingClip: null,
    lastPublish: null,
    generating: false,
      /* Memory-only, never persisted, never transmitted (W6). */
    pin: '',
    recording: false,
    recorder: null,
    quota: null,
    voicePack: { loaded: false, clips: {}, rev: 0 },
    testStatus: '',
    testState: '',
    /* D12–D15: the free-AI slot, the 4-step master-setup tracker and the last enrichment report. */
    aiProvider: 'free_dict',
    aiKey: '',
    masterStep: 0,
    masterDetail: '',
    enrichStatus: '',
    enriching: false,
    publishing: false,
    /* D4/D5: the non-fatal tier warning + the Layer-1 restore flag. */
    tierWarn: '',
    layerOneRestored: false
  };
  var autoLockBound = false;

  /* ══ envelope resolution (D-S7, D5/D8/D9 Layer-1) ═══════════════════════ */
  /* D5: the Layer-1 vault backup lives INSIDE sdp.settings.vaultLock (W4). */
  function settingsSafe() {
    try { return (data() && data().settings) ? (data().settings() || {}) : {}; } catch (e) { return {}; }
  }
  function layerOneVault() { var s = settingsSafe(); return isObj(s.vaultLock) ? s.vaultLock : {}; }
  function layerOneEnvelope() { return str(layerOneVault().encVault); }
  function layerOneVerifier() { var l = layerOneVault(); return isObj(l.pinVerifier) ? l.pinVerifier : null; }
  function writeLayerOne(envelope, verifier) {
    var l = layerOneVault(), lt = Math.max(0, Number(l.lockUntil) || 0);
    var out = {
      fails: Math.max(0, Number(l.fails) || 0), lockUntil: lt, until: lt,
      strikes: Math.max(0, Number(l.strikes) || 0), encVault: str(envelope) || str(l.encVault),
      pinVerifier: isObj(verifier) ? verifier : (isObj(l.pinVerifier) ? l.pinVerifier : null),
      updatedAt: str(envelope) ? Date.now() : (Number(l.updatedAt) || 0)
    };
    try { data().saveSettings({ vaultLock: out }); } catch (e) {}
    return out;
  }
  /* D8/D9: repair a released config.json that lost or reset its vault. */
  function healFromLayerOne() {
    try {
      var l = layerOneVault(), env = str(l.encVault);
      var cfg = sync() && sync().config ? sync().config() : null;
      if (!cfg || !isRealEnvelope(env)) return false;
      var rev = Number(l.updatedAt) || 0;
      if (isRealEnvelope(str(cfg.encVault)) && !(rev > (Number(cfg.syncRev) || 0))) return false;
      cfg.encVault = env;
      if (isObj(l.pinVerifier)) cfg.pinVerifier = l.pinVerifier;
      try { data().saveSettings({ cachedVault: env, cachedVaultSyncRev: rev || Date.now() }); } catch (e) {}
      if (!isRealEnvelope(ST.envelope)) ST.envelope = env;
      ST.layerOneRestored = true;
      return true;
    } catch (e) { return false; }
  }
  function cachedVault() {
    var s = settingsSafe();
    return s ? str(s.cachedVault) : '';
  }
  function cdnEnvelope() {
    var cfg = sync() && sync().config ? sync().config() : null;
    return str(cfg && cfg.encVault);
  }
  function isRealEnvelope(env) {
    var e = str(env);
    if (e.indexOf('SDP_ENC_V2:') !== 0) return false;
    var v = vault();
    if (v && v.isEmptyEnvelope) return !v.isEmptyEnvelope(e);
    return e.length > 32;
  }
  function configEnvelope() {
    if (isRealEnvelope(ST.envelope)) return ST.envelope;
    var local = cachedVault();
    if (isRealEnvelope(local)) return local;
    var one = layerOneEnvelope();
    if (isRealEnvelope(one)) return one;
    return cdnEnvelope();
  }
  function resolveEnvelope(cb) {
    cb = cb || noop;
    /* D8/D9: heal the config from the Layer-1 backup BEFORE anything reads it. */
    healFromLayerOne();
    var localRev = 0;
    try { localRev = Number((settingsSafe().cachedVaultSyncRev) || 0); } catch (e) { localRev = 0; }
    var best = { env: '', rev: 0 };
    function consider(env, rev) {
      if (!isRealEnvelope(env)) return;
      if (!best.env || Number(rev || 0) >= best.rev) best = { env: str(env), rev: Number(rev || 0) };
    }
    consider(configEnvelope(), localRev || Date.now());
    consider(layerOneEnvelope(), Number(layerOneVault().updatedAt) || localRev);
    var s = sync();
    if (!s || !s.fetchRawGitHubJson) { cb(best.env || configEnvelope()); return best.env; }
    s.fetchRawGitHubJson('data/config.json', function (err, cfg) {
      if (!err && isObj(cfg)) {
        consider(cfg.encVault, Math.max(Number(cfg.settingsRev || 0), Number((sync().version() || {}).syncRev || 0)));
      }
      var cdn = cdnEnvelope();
      consider(cdn, Number((sync().version() || {}).settingsRev || 0));
      ST.envelope = best.env || configEnvelope();
      cb(ST.envelope);
    });
    return configEnvelope();
  }
  function hasVault() { return isRealEnvelope(configEnvelope()); }

  function msg(text, state) {
    ST.message = str(text);
    ST.messageState = state || '';
    var node = byId('studioMsg');
    if (!node) return;
    node.textContent = ST.message;
    if (state) node.setAttribute('data-state', state); else node.removeAttribute('data-state');
  }
  function testStatus(text, state) {
    ST.testStatus = str(text);
    ST.testState = state || '';
    var node = byId('studioTestStatus');
    if (!node) return;
    node.textContent = ST.testStatus;
    if (state) node.setAttribute('data-state', state); else node.removeAttribute('data-state');
  }
  function toast(text) {
    try { if (SDP.Views && SDP.Views.showToast) SDP.Views.showToast(str(text)); } catch (e) {}
  }

  
  function parseWords(text) {
    var lines = str(text).split(/\r?\n/);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = str(lines[i]).replace(/^\s+|\s+$/g, '');
      if (!line || line.charAt(0) === '#') continue;
      var parts = line.indexOf('|') >= 0 ? line.split('|') : line.split('\t');
      for (var p = 0; p < parts.length; p++) parts[p] = str(parts[p]).replace(/^\s+|\s+$/g, '');
      if (!parts[0]) continue;
      out.push({
        w: parts[0], p: parts[1] || '', pos: parts[2] || '', m: parts[3] || '',
        si: parts[4] || '', s: parts[5] || '', audio: parts[6] || ''
      });
    }
    return out;
  }
  function wordsToText(words) {
    var lines = [], i;
    for (i = 0; i < (words || []).length; i++) {
      var w = words[i] || {};
      lines.push([str(w.w), str(w.p), str(w.pos), str(w.m), str(w.si), str(w.s)].join(' | '));
    }
    return lines.join('\n');
  }

  
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §H3 version schema */
  function buildVersionPayload(sessionNo, title, syncRev) {
    var nowIso = new Date().toISOString();
    var version = appVersion();
    return {
      ver: schemaVer(),
      appVersion: version,
      version: version,
      buildDate: nowIso.slice(0, 10),
      schema: schemaVer(),
      settingsRev: nextSettingsRev(),
      session: str(sessionNo || '8'),
      title: str(title || 'Session ' + str(sessionNo || '8')),
      updatedAt: nowIso,
      syncRev: Number(syncRev) || nextSyncRev()
    };
  }
  function buildSessionPayload(words, opts) {
    opts = opts || {};
    var base = sync() && sync().session ? JSON.parse(JSON.stringify(sync().session() || {})) : { ok: true, lists: [] };
    var listId = str(opts.listId || (sync() && sync().state ? sync().state.listId : '') || 'list_session_8_feelings');
    var version = appVersion();
    var lists = Array.isArray(base.lists) ? base.lists : [];
    var list = null, i;
    for (i = 0; i < lists.length; i++) if (lists[i] && lists[i].id === listId) list = lists[i];
    if (!list) {
      list = { id: listId, name: str(opts.title || 'Session ' + version), version: version, session: 'Session ' + version, date: new Date().toISOString().slice(0, 10), active: true, words: [] };
      lists.unshift(list);
    }
    var clean = [];
    for (i = 0; i < (words || []).length; i++) {
      var w = words[i] || {};
      /* D19: keep the real British recording URL through a publish. */
      var cleanWord = { w: str(w.w), p: str(w.p), pos: str(w.pos), m: str(w.m), si: str(w.si), s: str(w.s) };
      if (str(w.audio)) cleanWord.audio = str(w.audio);
      clean.push(cleanWord);
    }
    list.words = clean;
    list.active = true;
    list.version = version;
    base.lists = lists;
    base.words = clean;
    /* D-L9: the cockpit reads base.session.words. */
    base.session = isObj(base.session) ? base.session : {};
    base.session.words = clean;
    base.session.no = str(opts.sessionNo || base.session.no || '8');
    base.session.title = str(opts.title || base.session.title || 'Session ' + version);
    base.ok = true;
    base.updatedAt = new Date().toISOString();
    return base;
  }
  function voicePackPayload(syncRev) {
    var base = { version: appVersion(), appVersion: appVersion(), ver: schemaVer(), schema: schemaVer(), settingsRev: nextSettingsRev() };
    var remote = null;
    try { remote = SDP.Speech && SDP.Speech.state ? SDP.Speech.state.manifest : null; } catch (e) { remote = null; }
    if (isObj(remote)) for (var k in remote) if (Object.prototype.hasOwnProperty.call(remote, k) && base[k] === undefined) base[k] = remote[k];
    base.voiceId = VOICE_ID;
    base.modelId = VOICE_MODEL;
    base.clips = ST.voicePack.clips || {};
    base.updatedAt = new Date().toISOString();
    /* D19: same publish clock as config.json / version.json in this commit. */
    base.syncRev = Number(syncRev) || nextSyncRev();
    return base;
  }
  function buildPublishPayloads(words, opts) {
    opts = opts || {};
    var session = buildSessionPayload(words, opts);
    var version = buildVersionPayload(
      opts.sessionNo || (session.session && session.session.no) || '8',
      opts.title || (session.session && session.session.title) || '',
      opts.syncRev || nextSyncRev());
    var cfgBase = sync() && sync().config ? JSON.parse(JSON.stringify(sync().config() || {})) : {};
    /* D-S2: v0.0.1.b cloned config without encVault, so the very next publish erased the lectur… */
    var env = str(opts.envelope) || (isRealEnvelope(ST.envelope) ? ST.envelope : configEnvelope());
    cfgBase.ver = schemaVer();
    cfgBase.appVersion = appVersion();
    cfgBase.version = appVersion();
    cfgBase.schema = schemaVer();
    cfgBase.settingsRev = Number(version.settingsRev);
    cfgBase.encVault = str(env);
    cfgBase.updatedAt = new Date().toISOString();
    cfgBase.syncRev = Number(version.syncRev);
    return {
      session: session,
      version: version,
      config: cfgBase,
      files: {
        'data/session.json': JSON.stringify(session, null, 2),
        'data/version.json': JSON.stringify(version, null, 2),
        'data/config.json': JSON.stringify(cfgBase, null, 2)
      }
    };
  }

  /* ══ PIN unlock / first-time setup ════════════════════════════════════ */
  function persistEnvelope(envelope) {
      /* D-S1/D5: survive a reload. memory -> localStorage -> Layer 1 -> config. */
    try {
      data().saveSettings({ cachedVault: str(envelope), cachedVaultSyncRev: Date.now() });
    } catch (e) {}
    try { writeLayerOne(envelope, pinVerifier() || layerOneVerifier()); } catch (e) {}
    try {
      var cfg = sync() && sync().config ? sync().config() : null;
      if (cfg) cfg.encVault = str(envelope);
    } catch (e) {}
    return true;
  }

  /* ══ R1: the ten classroom keys the lecturer owns ═══════════════════════ */
  var CLASS_SETTING_KEYS = [
    'mode', 'writeSecs', 'repeats', 'pauseSecs', 'autoAdvance',
    'pacingPreset', 'voiceLock', 'voiceSource', 'rate', 'theme'
  ];
  function classSettingsSnapshot() {
    var out = {}, conf = {};
    try { conf = data() && data().settings ? data().settings() : {}; } catch (e) { conf = {}; }
    for (var i = 0; i < CLASS_SETTING_KEYS.length; i++) {
      var k = CLASS_SETTING_KEYS[i];
      if (conf[k] !== undefined && conf[k] !== null) out[k] = conf[k];
    }
    return out;
  }
  function buildVaultFiles(cfgBody, versionBody, message) {
    return [
      { path: 'data/config.json', content: JSON.stringify(cfgBody, null, 2), message: str(message || 'Studio vault ' + appVersion()) },
      { path: 'data/version.json', content: JSON.stringify(versionBody, null, 2), message: 'Studio version ' + appVersion() }
    ];
  }
  /* config.json first, version.json LAST (SYNC-03 / SYNC-07). */
  function publishVaultFiles(files, token, cb) {
    cb = cb || noop;
    if (!sync() || !sync().publishFilesSequential) { cb(new Error('no_sync')); return false; }
    return sync().publishFilesSequential(files, token, noop, function (err, info) {
      if (!err) {
        try {
          var cfg = sync().config ? sync().config() : null;
          if (cfg) cfg.settingsRev = nextSettingsRev();
        } catch (e) {}
      }
      cb(err, info);
    });
  }
  /* SYNC-03: copy the ten classroom keys into config.classSettings, bump settingsRev and comm… */
  function saveClassSettings(cb) {
    cb = cb || noop;
    if (!ST.unlocked) { msg(t('studioLocked'), 'bad'); cb(new Error('locked')); return { ok: false, reason: 'locked' }; }
    var conf = classSettingsSnapshot();
    if (!sync() || !sync().publishFilesSequential) { cb(new Error('no_sync')); return { ok: false, reason: 'no_sync' }; }
    var cfgBody = sync().config ? JSON.parse(JSON.stringify(sync().config() || {})) : {};
    cfgBody.classSettings = conf;
    var env = isRealEnvelope(ST.envelope) ? ST.envelope : configEnvelope();
    var token = str(ST.secrets.ghToken);
    function stamp(ok, detail) {
      var last = byId('lecturerSyncLast');
      if (!last) return;
      last.textContent = (ok ? t('lecturerSyncLast') : t('studioPublishFail')) + ' · ' +
        new Date().toISOString().slice(11, 16) + (detail ? ' · ' + detail : '');
      last.setAttribute('data-state', ok ? 'ok' : 'bad');
    }
    if (!token) {
      msg(t('studioNoToken'), 'bad');
      stamp(false, 'no token');
      cb(new Error('no_token'));
      return { ok: false, reason: 'no_token', classSettings: conf };
    }
    publishConfigAndVersion(cfgBody, env, 'Class settings rev', function (err, info, body) {
      var rev = Number((body && body.settingsRev) || 0);
      if (err) { msg(t('studioPublishFail'), 'bad'); stamp(false, 'rev ' + rev); cb(err, info); return; }
      try { if (data() && data().saveSettings) data().saveSettings({ appliedSettingsRev: rev }); } catch (e) {}
      msg(t('studioPublishOk') + ' · Rev #' + rev, 'ok');
      toast(t('lecturerSyncBar') + ' · Rev #' + rev);
      stamp(true, 'Rev #' + rev);
      cb(null, info || { ok: true, settingsRev: rev, classSettings: conf });
    });
    return { ok: true, classSettings: conf };
  }

  function clearVaultLock() {
    try { if (vault() && vault().resetLock) vault().resetLock(); } catch (e) {}
    return true;
  }
  function pinVerifier() {
    var cfg = sync() && sync().config ? sync().config() : null;
    return cfg && isObj(cfg.pinVerifier) ? cfg.pinVerifier : null;
  }
  /* SEC-03: with a placeholder envelope the PIN is proved against pinVerifier. */
  function unlockWithVerifier(pin, cb) {
    var v = vault();
    healFromLayerOne();
    var verifier = pinVerifier() || layerOneVerifier();
    if (!verifier || !v || !v.verifyPinVerifier) { msg(t('studioSetupHint'), ''); cb(new Error('no_vault')); return false; }
    function opened(secrets, env) {
      ST.bootstrapMode = !env;
      ST.envelope = env ? env : '';
      ST.secrets = isObj(secrets) ? secrets : {};
      if (env && v.stash) v.stash(ST.secrets);
      msg(t('studioUnlock') + ' ✓', 'ok');
      mount();
      loadVoicePack(noop);
      cb(null, ST.secrets);
    }
    v.verifyPinVerifier(pin, verifier).then(function (ok) {
      if (!ok) { msg(t('studioBadPin'), 'bad'); cb(new Error('bad_pin')); return; }
      ST.unlocked = true;
      ST.pin = str(pin);
      clearVaultLock();
      /* D9: decrypt the restored envelope so the saved keys auto-fill. */
      var env = configEnvelope();
      if (isRealEnvelope(env) && v.decryptV2) {
        v.decryptV2(env, str(pin)).then(function (secrets) { opened(secrets, env); }, function () { opened({}, ''); });
        return;
      }
      opened({}, '');
    }, function (err) {
      if (err && err.code === 'locked') msg(t('studioLockedOut') + ' ' + str(err.retrySec || 60) + ' ' + t('seconds'), 'bad');
      else msg(t('studioBadPin') + (err && err.triesLeft !== undefined ? ' · ' + err.triesLeft : ''), 'bad');
      cb(err || new Error('bad_pin'));
    });
    return true;
  }
  function unlock(pin, cb) {
    cb = cb || noop;
    var v = vault();
    if (!v) { msg('crypto_unavailable', 'bad'); cb(new Error('crypto_unavailable')); return; }
    var attempt = str(pin).replace(/[^0-9]/g, '');
    if (!attempt) { msg(t('studioBadPin'), 'bad'); cb(new Error('bad_pin')); return; }
    /* SEC-04: the persisted lockout is checked before anything else. */
    if (v.isLocked && v.isLocked()) {
      msg(t('studioLockedOut') + ' ' + v.lockRemaining() + ' ' + t('seconds'), 'bad');
      var early = new Error('locked');
      early.code = 'locked';
      cb(early);
      return;
    }
    /* D8: heal before resolving, so a placeholder config cannot hide the vault. */
    healFromLayerOne();
    resolveEnvelope(function (envelope) {
      if (!isRealEnvelope(envelope)) {
        unlockWithVerifier(attempt, cb);
        return;
      }
      v.decryptV2(envelope, attempt).then(function (secrets) {
        ST.unlocked = true;
        ST.bootstrapMode = false;
        ST.envelope = envelope;
        ST.pin = attempt;
        ST.secrets = isObj(secrets) ? secrets : {};
        if (v.stash) v.stash(ST.secrets);
        clearVaultLock();
        msg(t('studioUnlock') + ' ✓', 'ok');
        mount();
        /* SYNC-11: the committed clips must load before the first delta run. */
        loadVoicePack(noop);
        /* SYNC-07 completion: a local envelope that never reached GitHub is published now that a to… */
        autoPublishVault(envelope);
        cb(null, ST.secrets);
      }, function (err) {
        if (err && err.code === 'locked') {
          msg(t('studioLockedOut') + ' ' + str(err.retrySec || 60) + ' ' + t('seconds'), 'bad');
        } else {
          msg(t('studioBadPin') + (err && err.triesLeft !== undefined ? ' · ' + err.triesLeft : ''), 'bad');
        }
        cb(err || new Error('bad_pin'));
      });
    });
  }
  /* SEC-03/SYNC-07: a cached vault with a real envelope while GitHub still carries the placeh… */
  function autoPublishVault(envelope) {
    try {
      var cfg = sync() && sync().config ? sync().config() : null;
      if (!str(ST.secrets.ghToken) || !cfg) return false;
      if (isRealEnvelope(str(cfg.encVault))) return false;
      publishConfigAndVersion(null, envelope, 'Studio vault ' + appVersion(), noop);
      return true;
    } catch (e) { return false; }
  }

  /* D-S1/S2/S4: encrypt, persist locally at once, then commit config + version. */
  /* SEC-02: setup() may only run for an authenticated lecturer, or a caller that proves the P… */
  function setupAuthorised(pin, cb) {
    cb = cb || noop;
    if (ST.unlocked) { cb(null, true); return; }
    var v = vault();
    var verifier = pinVerifier();
    if (v && verifier && v.verifyPinVerifier) {
      msg(t('studioAskLecturer'), '');
      v.verifyPinVerifier(str(pin).replace(/[^0-9]/g, ''), verifier).then(function (ok) {
        if (!ok) { cb(new Error('not_unlocked')); return; }
        ST.unlocked = true;
        ST.bootstrapMode = true;
        cb(null, true);
      }, function (err) { cb(err || new Error('not_unlocked')); });
      return;
    }
    msg(t('studioAskLecturer'), '');
    cb(new Error('not_unlocked'));
  }
  function setup(pin, secrets, cb) {
    cb = cb || noop;
    var v = vault();
    if (!v) { cb(new Error('crypto_unavailable')); return; }
    if (str(pin).replace(/[^0-9]/g, '').length < 4) { msg(t('studioBadPin'), 'bad'); cb(new Error('pin_too_short')); return; }
    setupAuthorised(pin, function (authErr) {
      if (authErr) { cb(authErr); return; }
      setupSeal(str(pin).replace(/[^0-9]/g, ''), secrets, cb);
    });
  }
  function setupSeal(pin, secrets, cb) {
    cb = cb || noop;
    var v = vault();
    var secretsIn = isObj(secrets) ? secrets : {};
    v.encryptV2(secretsIn, pin).then(function (envelope) {
      ST.envelope = envelope;
      ST.secrets = secretsIn;
      ST.unlocked = true;
      ST.pin = str(pin);
      if (v.stash) v.stash(ST.secrets);
      persistEnvelope(envelope);
      msg(t('studioEnvelope') + ' ✓', 'ok');
      mount();
      if (!str(secretsIn.ghToken) || !sync() || !sync().publishFilesSequential) {
        toast(t('vaultSavedToast'));
        cb(null, envelope);
        return;
      }
          /* SYNC-06: config + version (last) so a reload can unlock at once. */
      publishConfigAndVersion(null, envelope, 'Studio vault ' + appVersion(), function (err, info) {
        if (err) { msg(t('studioPublishFail'), 'bad'); toast(t('vaultSavedToast')); cb(err, envelope); return; }
        msg(t('studioPublishOk') + ' · v' + appVersion(), 'ok');
        toast(t('vaultSavedToast') + ' · GitHub');
        cb(null, envelope, info);
      });
    }, function (err) { cb(err || new Error('encrypt_failed')); });
  }

  function lock() {
    ST.unlocked = false;
    ST.secrets = {};
    ST.pin = '';
    try { if (vault()) vault().clear(); } catch (e) {}
    mount();
    paintQuickButton();
    return false;
  }

  function setEnvelope(envelope) { ST.envelope = str(envelope); return ST.envelope; }
  function isUnlocked() { return !!ST.unlocked; }
  function secrets() { return isObj(ST.secrets) ? ST.secrets : {}; }

  /* ══ R8 / D13: the third vault slot (free AI key) + provider ladder ════ */
  function detectProvider(key) {
    var k = str(key);
    if (!k) return '';
    if (k.indexOf('gsk_') === 0) return 'groq';
    if (k.indexOf('sk-or-') === 0) return 'openrouter';
    if (k.indexOf('AIza') === 0) return 'gemini';
    return '';
  }
  function aiProviderName() {
    var node = byId('studioAiProvider');
    var raw = node ? str(node.value) : '';
    if (!raw) raw = str(ST.aiProvider) || str(secrets().aiProvider) || 'free_dict';
    if (!AI_PROVIDERS[raw]) {
      /* R8: a pasted key prefix auto-selects its provider. */
      var guess = detectProvider(aiProviderKey());
      raw = guess || 'free_dict';
    }
    return raw;
  }
  function aiProviderKey() {
    var node = byId('studioAiKey');
    var typed = node ? str(node.value) : '';
    return typed || str(ST.aiKey) || str(secrets().aiKey) || '';
  }
  /* D10: slot 2 is a zero-key LLM; slots 3–5 escalate only with a key. */
  function aiNeedsLlm(provider, key) {
    var p = provider === undefined ? aiProviderName() : str(provider);
    var k = key === undefined ? aiProviderKey() : str(key);
    if (p === 'pollinations_free') return !!LLM_ENDPOINTS[p];
    if (p === 'groq' || p === 'openrouter' || p === 'gemini') return !!k && !!LLM_ENDPOINTS[p];
    return false;
  }

  /* ══ rendering ════════════════════════════════════════════════════════ */
  /* D7 / R4: the dot row grows from 8 to 12 dots as a longer PIN is typed. */
  function pinDotCount(len) {
    return Math.min(PIN_MAX, Math.max(8, Number(len) || 0));
  }
  function pinDotsMarkup() {
    var html = '<div id="pinDots" class="pin-dots" data-dots="8" aria-hidden="true">';
    for (var i = 1; i <= PIN_MAX; i++) {
      html += '<span class="pin-dot' + (i > 8 ? ' pin-dot-extra' : '') + '" data-dot="' + i + '"></span>';
    }
    return html + '</div>';
  }
  /* D-L2: the 56px PIN pad carries exactly 12 keys (1-9, Clear, 0, Unlock). */
  function pinPadMarkup() {
    var html = '<div id="pinPad" class="pin-pad" role="group" aria-label="' + T('studioPinLabel') + '">';
    var i;
    for (i = 1; i <= 9; i++) html += '<button type="button" class="pin-key" data-pin="' + i + '">' + i + '</button>';
    html += '<button type="button" class="pin-key pin-key-soft" id="pinPadClear">' + T('pinPadClear') + '</button>';
    html += '<button type="button" class="pin-key" data-pin="0">0</button>';
    html += '<button type="button" class="pin-key pin-key-primary" id="pinPadUnlock">' + T('pinPadUnlock') + '</button>';
    html += '</div>';
    return html;
  }
  /* One credential row = one input + ONE inline [Show] [Paste] [Test] group (D13). */
  /* One button factory — every studio control keeps its frozen id (D13). */
  function lbl(forId, text) {
    return '<label class="lbl" for="' + forId + '">' + esc(text) + '</label>';
  }
  function btn(id, label, css, attrs) {
    return '<button type="button" class="btn btn-sm' + (css ? ' ' + css : '') + '" id="' + id + '"' +
      (attrs ? ' ' + attrs : '') + '>' + esc(label) + '</button>';
  }
  function keyRowMarkup(inputId, label, placeholder, kind) {
    return '<label class="lbl" for="' + inputId + '">' + esc(label) + '</label>' + '<div class="key-row">' + '<input id="' + inputId + '" class="input" type="password" autocomplete="off" spellcheck="false" placeholder="' + esc(placeholder) + '">' +
      btn('btnToggle' + kind, t('studioShow'), '', 'aria-pressed="false"') +
      btn('btnPaste' + kind, t('studioPaste')) +
      btn('btnTest' + kind, kind === 'ElKey' ? t('studioTestEl') : (kind === 'Ai' ? t('studioTestAi') : t('studioTestGh'))) + '</div>';
  }
  function providerLabel(id) {
    var p = AI_PROVIDERS[id] || {};
    return t(str(p.k) || 'studioAiNoKey', id);
  }
  function aiProviderSelectMarkup() {
    var current = aiProviderName(), html = '<select id="studioAiProvider" class="input">';
    for (var i = 0; i < AI_SLOT_ORDER.length; i++) {
      var id = AI_SLOT_ORDER[i];
      html += '<option value="' + id + '"' + (id === current ? ' selected' : '') + '>' + esc(providerLabel(id)) + '</option>';
    }
    return html + '</select>';
  }
  function masterStepsMarkup() {
    var labels = [
      'Save vault &amp; verify GitHub token',
      'Non-fatal ElevenLabs key check',
      'Delta-generate guide + 30 clips',
      'Inject clips &amp; publish, ONE syncRev'
    ];
    var html = '<ol id="studioMasterSteps" class="studio-steps" aria-label="' +
      T('studioMasterSteps') + '">';
    for (var i = 0; i < labels.length; i++) {
      html += '<li data-step="' + (i + 1) + '" data-state="pending">' + labels[i] + '</li>';
    }
    return html + '</ol>';
  }
  /* D7: the green vault badge — real envelope stored or already published. */
  function vaultBadgeVisible() {
    if (isRealEnvelope(configEnvelope())) return true;
    return isRealEnvelope(layerOneEnvelope());
  }
  function freeNoKeyVisible(provider) {
    var p = str(provider) || aiProviderName();
    return p === 'free_dict' || p === 'pollinations_free';
  }
  /* ══ Card 1 — rebuilt for non-technical teachers (D13, D14) ══════════ 3 credential rows, ONE 2-button bar, ONE visible force-regen checkbox. #btnCheckQuota / #btnRefreshQuota stay in the DOM (display:none). */
  function keysCardMarkup() {
    return '<section id="studioCardKeys" class="studio-card studio-card-keys">' + '<h4 class="studio-h4">' + T('studioCardKeys') + '</h4>' +
      keyRowMarkup('elKeyInput', 'ElevenLabs API key', 'xi-api-key', 'ElKey') +
      keyRowMarkup('ghTokenInput', 'GitHub token (ghp_… / github_pat_…)', 'ghp_… / github_pat_…', 'GhToken') +
      '<label class="lbl" for="studioAiProvider">' + T('studioAiProvider') + '</label>' + aiProviderSelectMarkup() +
      '<p id="studioFreeNoKey" class="studio-free-badge"' + (freeNoKeyVisible() ? '' : ' hidden') + '>' + T('studioFreeNoKey') + '</p>' +
      keyRowMarkup('studioAiKey', t('studioAiKey'), 'gsk_… / AIza… / sk-or-…', 'Ai') +
      '<label class="lbl" for="studioGasUrl">Apps Script relay URL</label>' + '<input id="studioGasUrl" class="input" type="url" autocomplete="off" placeholder="https://script.google.com/…">' +
      '<div class="chip-row studio-compat-row">' +
      btn('btnCheckQuota', '🔄 ' + t('studioTestEl'), '', 'style="display:none"') +
      btn('btnRefreshQuota', '🔄 ' + t('quotaHeading'), '', 'style="display:none"') +
      '</div>' +
      '<div class="studio-primary-bar">' +
      btn('btnSaveKeys', t('studioSave'), 'btn-primary') +
      btn('btnOneClickMasterSetup', t('studioOneClick'), 'btn-primary') +
      '</div>' +
      '<label class="checkline" for="studioForceRegen"><input type="checkbox" id="studioForceRegen"> <span>' + T('forceRegenLabel') + '</span></label>' +
      '<input type="checkbox" id="chkForceRegen" style="display:none" aria-hidden="true" tabindex="-1">' +
      '<div class="chip-row studio-diagnostics-row">' +
      btn('btnTestOneWord', t('testOneWordBtn')) +
      btn('btnGenClips', t('genDeltaBtn'), 'btn-primary') +
      '</div>' +
      '<div id="quotaInspectorCard" class="studio-quota">' +
      '<p id="quotaText" class="muted" role="status" aria-live="polite">' + T('quotaHeading') + '</p>' +
      '<p class="lbl">' + T('costPreviewLabel') + '</p>' + '<p id="costPreviewLine" class="muted">' + esc(costPreviewLine()) + '</p>' +
      '<div id="clipPreviewTable" class="studio-preview"></div></div>' +
      '<p id="studioVaultBadge" class="studio-vault-badge"' + (vaultBadgeVisible() ? '' : ' hidden') + '>' + T('vaultBadgeLabel') + '</p>' +
      masterStepsMarkup() + '</section>';
  }
  /* ══ Card 2 — the 30-word editor, free-AI enricher and publisher (D12) ══ */
  function wordsCardMarkup() {
    var words = ST.words.length ? ST.words : (sync() && sync().words ? sync().words() : []);
    var names = [];
    for (var i = 0; i < words.length; i++) if (str(words[i] && words[i].w)) names.push(str(words[i].w));
    return '<section id="studioCardWords" class="studio-card studio-card-words">' + '<h4 class="studio-h4">' + T('studioCardWords') + '</h4>' + '<label class="lbl" for="studioBulkWords">' + T('studioBulkWords') + '</label>' +
      '<textarea id="studioBulkWords" spellcheck="false" rows="6">' + esc(names.join('\n')) + '</textarea>' + '<label class="lbl" for="studioWords">' + T('studioEditor') + '</label>' + '<textarea id="studioWords" spellcheck="false">' + esc(wordsToText(words)) + '</textarea>' +
      '<p id="studioCount" class="studio-msg">' + words.length + ' ' + T('studioWordsCount') + '</p>' + '<div class="chip-row">' + btn('btnEnrichWords', t('studioEnrich')) +
      btn('btnPreviewWords', t('studioPreview')) + btn('btnPublishWords', t('studioPublish'), 'btn-primary') +
      btn('btnPublishWordsAndVoice', t('studioPublishWordsVoice'), 'btn-primary') +
      btn('btnStudioLock', t('studioLock')) + '</div>' + '<h5 class="studio-h5">' + T('studioWordManager') + '</h5>' +
      '<div id="studioWordManager" class="studio-word-manager"></div>' + '<div id="studioPreview" class="studio-preview"></div>' + '<p class="muted">' + T('studioElevenNote') + '</p>' + '</section>';
  }
  /* ══ Card 3 — classroom settings broadcast, PIN, lecturer recorder ══════ */
  function settingsCardMarkup() {
    return '<section id="studioCardSettings" class="studio-card studio-card-settings">' + '<h4 class="studio-h4">' + T('studioCardSettings') + '</h4>' + '<label class="lbl" for="studioNewPin">' + T('studioPinLabel') + ' — new (4–12 digits)</label>' +
      '<input id="studioNewPin" class="input" type="password" inputmode="numeric" autocomplete="off" maxlength="12" minlength="4">' + '<label class="lbl" for="studioConfirmPin">' + T('studioPinLabel') + ' — confirm</label>' +
      '<input id="studioConfirmPin" class="input" type="password" inputmode="numeric" autocomplete="off" maxlength="12" minlength="4">' + btn('btnStudioSyncSettings', t('studioSyncSettings'), 'btn-primary') +
      '<p class="studio-hint">#lecturerSyncBar · #btnSyncClassSettings</p>' + '<h4 class="studio-h4">' + T('studioRecord') + '</h4>' + '<div class="chip-row">' + btn('btnStudioRecord', t('studioRecord')) +
      btn('btnCommitClip', t('studioCommitClip'), 'btn-primary', 'disabled') + '</div>' +
      '<audio id="recPreviewAudio" controls preload="none" class="rec-preview"></audio>' + '<p class="studio-hint" data-i18n="studioAskLecturer">' + T('studioAskLecturer') + '</p>' + '</section>';
  }
  /* D18: three outcome cards under one lock header. */
  function unlockedMarkup() {
    return '<div class="studio-head">' + '<h4 class="studio-h4">' + T('studioTitle') + '</h4>' + btn('btnLockStudio', t('studioLockLecturer'), 'btn-primary') + '</div>' +
      '<p id="studioMsg" class="studio-msg" role="status" aria-live="polite"></p>' + '<p id="studioTestStatus" class="studio-msg" role="status" aria-live="polite"></p>' +
      keysCardMarkup() +
      wordsCardMarkup() +
      settingsCardMarkup();
  }
  /* R5/SEC-01: while locked the body renders ONLY the PIN field, the dots, the 56px 12-key pa… */
  function lockedMarkup() {
    return '<div class="pin-row">' + '<label class="for-only" for="studioPin">' + T('studioPinLabel') + '</label>' + '<input id="studioPin" class="input" type="password" inputmode="numeric" autocomplete="off" maxlength="12" minlength="4" placeholder="' + T('studioPinLabel') + '">' +
      '<button type="button" class="btn btn-sm" id="pinPadBack" aria-label="Delete last digit">⌫</button>' + '</div>' +
      pinDotsMarkup() +
      pinPadMarkup() +
      '<p id="studioMsg" class="studio-msg" role="status" aria-live="polite"></p>' + '<p class="studio-hint" data-i18n="studioAskLecturer">' + T('studioAskLecturer') + '</p>';
  }

  function mount() {
    /* D8: the Layer-1 self-heal runs before every mount, so a released config.json that lost it… */
    try { healFromLayerOne(); } catch (e) {}
    var host = byId('studioBody');
    if (!host) return false;
    host.innerHTML = ST.unlocked ? unlockedMarkup() : lockedMarkup();
    var msgNode = byId('studioMsg');
    if (msgNode && ST.message) {
      msgNode.textContent = ST.message;
      if (ST.messageState) msgNode.setAttribute('data-state', ST.messageState);
    }
    var testNode = byId('studioTestStatus');
    if (testNode && ST.testStatus) {
      testNode.textContent = ST.testStatus;
      if (ST.testState) testNode.setAttribute('data-state', ST.testState);
    }
    bindDelegated();
    paintPinDots();
    paintClipTable();
    paintQuickButton();
    paintMasterSteps();
    paintWordManager();
    paintAiFields();
    return true;
  }
  function paintAiFields() {
    var select = byId('studioAiProvider');
    if (select) {
      var want = aiProviderName();
      select.value = want;
    }
    var key = byId('studioAiKey');
    if (key && !str(key.value)) key.value = str(ST.aiKey) || str(secrets().aiKey) || '';
    paintSecretFields();
    return true;
  }
  /* D7 (Layer 3): auto-fill every credential (masked) + the vault badge. */
  function paintSecretFields() {
    var sec = secrets();
    var map = { elKeyInput: 'elevenKey', ghTokenInput: 'ghToken', studioGasUrl: 'gasUrl', studioAiKey: 'aiKey' };
    for (var id in map) {
      if (!Object.prototype.hasOwnProperty.call(map, id)) continue;
      var node = byId(id), val = str(sec[map[id]]);
      if (node && val) node.value = val;
    }
    paintFreeNoKey();
    paintVaultBadge();
    return true;
  }
  function paintFreeNoKey() {
    var node = byId('studioFreeNoKey');
    if (!node) return false;
    if (freeNoKeyVisible()) node.removeAttribute('hidden'); else node.setAttribute('hidden', '');
    return true;
  }
  function paintVaultBadge() {
    var node = byId('studioVaultBadge');
    if (!node) return false;
    node.textContent = t('vaultBadgeLabel');
    if (vaultBadgeVisible()) node.removeAttribute('hidden'); else node.setAttribute('hidden', '');
    return true;
  }
  function paintQuickButton() {
    var btn = byId('btnStudioQuick');
    if (!btn) return false;
    btn.textContent = ST.unlocked ? '🔓' : '🔒';
    btn.setAttribute('aria-label', ST.unlocked
      ? 'Lecturer Studio is unlocked — open it'
      : 'Open the Lecturer Studio from Settings');
    btn.setAttribute('data-state', ST.unlocked ? 'unlocked' : 'locked');
    return true;
  }

  function activePinInput() {
    /* SEC-03: locked view has exactly one PIN field. */
    return byId('studioPin');
  }
  function pinValue() { var n = activePinInput(); return n ? str(n.value) : ''; }
  function setPinValue(v) {
    var n = activePinInput();
    if (!n) return '';
    /* R4 / D7: a lecturer PIN may be 4–12 digits. */
    n.value = str(v).replace(/[^0-9]/g, '').slice(0, PIN_MAX);
    paintPinDots();
    return n.value;
  }
  function newPinValue() { return str(fieldValue('studioNewPin') || fieldValue('newPinInput')).replace(/[^0-9]/g, '').slice(0, PIN_MAX); }
  function confirmPinValue() { return str(fieldValue('studioConfirmPin') || fieldValue('confirmPinInput')).replace(/[^0-9]/g, '').slice(0, PIN_MAX); }
  function appendPin(digit) {
    var next = pinValue() + str(digit).replace(/[^0-9]/g, '');
    setPinValue(next);
    return next;
  }
  function backspacePin() {
    var v = pinValue();
    setPinValue(v.slice(0, Math.max(0, v.length - 1)));
    return pinValue();
  }
  function paintPinDots() {
    var host = byId('pinDots');
    if (!host) return false;
    var dots = host.querySelectorAll ? host.querySelectorAll('span') : [];
    var len = pinValue().length;
    /* D7: 8 dots by default, 9–12 once the lecturer types a longer PIN. */
    var shown = pinDotCount(len);
    for (var i = 0; i < dots.length; i++) {
      if (i < len) dots[i].classList.add('on'); else dots[i].classList.remove('on');
      if (i >= shown) dots[i].classList.add('pin-dot-off'); else dots[i].classList.remove('pin-dot-off');
    }
    host.setAttribute('data-filled', String(len));
    host.setAttribute('data-dots', String(shown));
    return true;
  }
  /* D15: the 4-step one-click tracker. state: pending | active | ok | bad */
  function paintMasterSteps() {
    var host = byId('studioMasterSteps');
    if (!host) return false;
    var items = host.querySelectorAll ? host.querySelectorAll('li[data-step]') : [];
    for (var i = 0; i < items.length; i++) {
      var step = Number(items[i].getAttribute('data-step'));
      var state = 'pending';
      if (ST.masterStep > step) state = 'ok';
      else if (ST.masterStep === step) state = ST.masterDetail || 'active';
      else state = 'pending';
      items[i].setAttribute('data-state', state);
    }
    host.setAttribute('data-step', String(ST.masterStep));
    return true;
  }
  function setMasterStep(step, state) {
    ST.masterStep = Number(step) || 0;
    ST.masterDetail = str(state);
    paintMasterSteps();
    return ST.masterStep;
  }

  /* ══ D-L7: one delegated listener survives every innerHTML swap ═══════ */
  function bindDelegated() {
    var host = byId('studioAccordion');
    if (!host || host._sdpDelegated) return false;
    host._sdpDelegated = true;
    host.addEventListener('click', onStudioClick, false);
    host.addEventListener('input', onStudioInput, false);
    host.addEventListener('change', onStudioChange, false);
    return true;
  }
  function ownerId(node, stop) {
    var n = node;
    while (n && n !== stop && n !== doc) {
      if (n.id) return n.id;
      n = n.parentNode;
    }
    return '';
  }
  function forceRegenChecked() {
    var a = byId('studioForceRegen'), b = byId('chkForceRegen');
    return !!((a && a.checked) || (b && b.checked));
  }
  function onStudioInput(ev) {
    var target = ev && ev.target;
    var id = ownerId(target, byId('studioAccordion'));
    if (id === 'studioWords') {
      var editor = byId('studioWords');
      ST.words = parseWords(editor ? editor.value : '');
      setText(byId('studioCount'), ST.words.length + ' ' + t('studioWordsCount'));
      setText(byId('costPreviewLine'), costPreviewLine(ST.words));
      paintWordManager();
    } else if (id === 'studioBulkWords') {
      setStudioWords(parseBulkWords(fieldValue('studioBulkWords')), 'bulk');
    } else if (id === 'studioAiKey') {
      var guess = detectProvider(str(target.value));
      if (guess) { ST.aiProvider = guess; var sel = byId('studioAiProvider'); if (sel) sel.value = guess; }
      paintFreeNoKey();
    } else if (id === 'studioPin' || id === 'setupPin') {
      paintPinDots();
    } else if (target && target.getAttribute && target.getAttribute('data-wm')) {
      applyWordManagerEdit(target);
    }
  }
  
  function applyWordManagerEdit(node, commit) {
    var row = Number(node.getAttribute('data-row'));
    var field = str(node.getAttribute('data-wm'));
    if (!(row >= 0) || !field) return false;
    var list = ST.words.length ? ST.words : wordManagerWords();
    if (!isObj(list[row])) return false;
    list[row][field] = str(node.value);
    if (field === 'w') {
      ST.words = list;
      var editor = byId('studioWords');
      if (editor && commit !== false) editor.value = wordsToText(list);
    } else {
      ST.words = list;
      if (commit !== false) {
        var editor2 = byId('studioWords');
        if (editor2) editor2.value = wordsToText(list);
      }
    }
    setText(byId('costPreviewLine'), costPreviewLine(list));
    return true;
  }
  function onStudioChange(ev) {
    var target = ev && ev.target;
    var id = ownerId(target, byId('studioAccordion'));
    if (id === 'studioForceRegen') {
      var mirror = byId('chkForceRegen');
      if (mirror) mirror.checked = !!target.checked;
      return true;
    }
    if (id === 'chkForceRegen') return true;
    if (id === 'studioAiProvider') {
      ST.aiProvider = str(target.value);
      paintFreeNoKey();
      return true;
    }
    if (target && target.getAttribute && target.getAttribute('data-wm')) return applyWordManagerEdit(target, true);
    return false;
  }

  function toggleSecretField(inputId, btn) {
    var node = byId(inputId);
    if (!node) return false;
    var showing = node.getAttribute('type') === 'text';
    node.setAttribute('type', showing ? 'password' : 'text');
    if (btn) {
      btn.textContent = showing ? t('studioShow') : t('studioHide');
      btn.setAttribute('aria-pressed', showing ? 'false' : 'true');
    }
    return !showing;
  }
  function pasteInto(inputId, done) {
    var node = byId(inputId);
    if (!node) { done(new Error('no_field')); return; }
    var clip = global.navigator && global.navigator.clipboard;
    if (clip && typeof clip.readText === 'function') {
      clip.readText().then(function (text) {
        node.value = str(text);
        done(null, node.value);
      }, function () { done(new Error('paste_denied')); });
      return;
    }
    done(new Error('paste_unsupported'));
  }

  var CLICK_ACTIONS = {
    pinPadClear: function () { setPinValue(''); },
    pinPadBack: function () { backspacePin(); },
    pinPadUnlock: function () { unlock(pinValue(), noop); },
    btnStudioUnlock: function () { unlock(pinValue(), noop); },
    btnToggleElKey: function () { toggleSecretField('elKeyInput', byId('btnToggleElKey')); },
    btnToggleGhToken: function () { toggleSecretField('ghTokenInput', byId('btnToggleGhToken')); },
    btnToggleAi: function () { toggleSecretField('studioAiKey', byId('btnToggleAi')); },
    btnPasteElKey: function () { pasteInto('elKeyInput', pasteDone); },
    btnPasteGhToken: function () { pasteInto('ghTokenInput', pasteDone); },
    btnPasteAi: function () { pasteInto('studioAiKey', pasteDone); },
    btnTestElKey: function () { testElevenLabsKey(fieldValue('elKeyInput') || str(ST.secrets.elevenKey), onElTest); },
    btnTestGhToken: function () { testGitHubToken(fieldValue('ghTokenInput') || str(ST.secrets.ghToken), onGhTest); },
    btnCheckQuota: function () { quotaProbe(); },
    btnRefreshQuota: function () { quotaProbe(); },
    btnTestOneWord: function () { generateClips({ singleTest: true }, noop); },
    btnGenClips: function () { generateClips({ force: forceRegenChecked() }, noop); },
    btnTestAi: function () { testAiEngine(noop); },
    btnEnrichWords: function () {
      enrichWords(fieldValue('studioWords') || fieldValue('studioBulkWords'), { force: false }, noop);
    },
    btnOneClickMasterSetup: function () { oneClickMasterSetup(noop); },
    btnPublishWordsAndVoice: function () { publishWordsAndVoice(noop); },
    btnPreviewWords: function () { openPublishPreview(); },
    btnPublishWords: function () { publish(noop); },
    btnStudioSyncSettings: function () {
      saveClassSettings(function (err) { msg(err ? t('studioPublishFail') : t('studioPublishOk'), err ? 'bad' : 'ok'); });
    },
    btnLockStudio: function () { lock(); },
    btnStudioLock: function () { lock(); },
    btnSaveKeys: function () { saveKeys(); },
    btnStudioRecord: function () { toggleRecord(); },
    btnCommitClip: function () {
      commitClip(str(ST.secrets.ghToken), function (err) {
        msg(err ? t('studioPublishFail') : t('studioCommitClip') + ' ✓', err ? 'bad' : 'ok');
      });
    }
  };
  function onStudioClick(ev) {
    var target = ev && ev.target;
    var id = ownerId(target, byId('studioAccordion'));
    if (!id) return;
    var digit = target && target.getAttribute ? target.getAttribute('data-pin') : null;
    if (digit !== null && digit !== undefined && digit !== '') {
      appendPin(digit);
      if (ev.preventDefault) ev.preventDefault();
      return;
    }
    var action = CLICK_ACTIONS[id];
    if (action) { if (ev.preventDefault) ev.preventDefault(); action(ev); }
  }
  function fieldValue(id) { var n = byId(id); return n ? str(n.value) : ''; }
  function pasteDone(err) {
    testStatus(err ? 'Clipboard unavailable — paste manually' : t('studioPaste') + ' ✓', err ? 'bad' : 'ok');
  }
  function quotaProbe() {
      /* D2: probeQuota paints the green verdict; never echo subscription_failed. */
    refreshQuota(function (err) { if (err) testStatus('❌ ' + quotaError(err), 'bad'); });
  }
  function onElTest(err, result) {
    if (err) { testStatus('❌ ' + quotaError(err), 'bad'); return; }
    if (result && result.scoped) {
      var note = str(result.note) || SCOPED_NOTE();
      testStatus('✅ ' + note, 'ok');
      setText(byId('quotaText'), note);
      return;
    }
    var used = Number(result.used || 0), limit = Number(result.limit || 0), left = Number(result.remaining || 0);
    testStatus('✅ ElevenLabs Connected · Used ' + used + ' / Limit ' + limit + ' chars (Remaining: ' + left + ')', 'ok');
    setText(byId('quotaText'), 'Used ' + used + ' / Limit ' + limit + ' chars · Remaining: ' + left);
  }
  function onGhTest(err, result) {
    if (err) { testStatus('❌ ' + ghError(err), 'bad'); return; }
    testStatus('✅ GitHub Connected (' + result.repo + ' · Write OK)', 'ok');
  }

  /* D6 (Layer 2): seal + Layer 1 + push config/version in one tap; */
  var SAVE_LOCAL_ONLY = 'Saved in local Vault (protected across updates)';
  /* One place reads the credential inputs into the in-memory vault (D6/D7). */
  function mergeSecretInputs() {
    var patch = {}, el = fieldValue('elKeyInput'), gh = fieldValue('ghTokenInput');
    var gas = fieldValue('studioGasUrl'), aiKey = aiProviderKey(), provider = aiProviderName();
    if (el) patch.elevenKey = el;
    if (gh) patch.ghToken = gh;
    if (gas) patch.gasUrl = gas;
    if (aiKey) patch.aiKey = aiKey;
    patch.aiProvider = provider;
    patch.updatedAt = Date.now();
    ST.secrets = isObj(ST.secrets) ? ST.secrets : {};
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) ST.secrets[k] = patch[k];
    ST.aiProvider = provider;
    if (aiKey) ST.aiKey = aiKey;
    return ST.secrets;
  }
  function saveKeys() {
    if (!ST.unlocked) { msg(t('studioLocked'), 'bad'); return false; }
    /* SEC-02 / R4: a new 4–12 digit PIN must be confirmed twice. */
    var wantPin = newPinValue();
    var confirmPin = confirmPinValue();
    if (wantPin.length >= PIN_MIN || confirmPin.length) {
      if (wantPin.length < PIN_MIN || wantPin.length > PIN_MAX) { msg(t('studioBadPin'), 'bad'); return false; }
      if (wantPin !== confirmPin) { msg(t('studioPinMismatch'), 'bad'); return false; }
      ST.pin = wantPin;
    }
    mergeSecretInputs();
    var pin = str(ST.pin || '');
    var v = vault();
    if (!v || !pin) {
        if (isRealEnvelope(ST.envelope)) writeLayerOne(ST.envelope, pinVerifier() || layerOneVerifier());
      msg(SAVE_LOCAL_ONLY, 'ok');
      return true;
    }
    sealVaultNow(function (err, envelope, verifier) {
      if (err) { msg(t('studioPublishFail') + ' · encrypt_failed', 'bad'); return; }
        writeLayerOne(envelope, verifier || pinVerifier());
      mount();
      var token = str(ST.secrets.ghToken);
      if (!token || !sync() || !sync().publishFilesSequential) {
        msg(SAVE_LOCAL_ONLY, 'ok');
        toast(SAVE_LOCAL_ONLY);
        return;
      }
      var cfgBody = sync().config ? JSON.parse(JSON.stringify(sync().config() || {})) : {};
      cfgBody.encVault = str(envelope);
      if (isObj(pinVerifier())) cfgBody.pinVerifier = pinVerifier();
      publishConfigAndVersion(cfgBody, envelope, 'Studio vault ' + appVersion(), function (pubErr) {
        if (pubErr) {
                var line = SAVE_LOCAL_ONLY + ' · GitHub sync failed: ' + str(pubErr.message || 'network error');
          msg(line, 'bad');
          toast(line);
          return;
        }
        msg(t('studioPublishOk') + ' · v' + appVersion(), 'ok');
        toast(t('vaultSavedToast'));
      });
    });
    return true;
  }

  /* R5/D8: pagehide, beforeunload and #btnLockStudio all lock the studio. */
  function bindAutoLock() {
    if (autoLockBound) return false;
    autoLockBound = true;
    var handler = function () { if (ST.unlocked) { try { lock(); } catch (e) {} } };
    try {
      if (global.addEventListener) {
        global.addEventListener('pagehide', handler, false);
        global.addEventListener('beforeunload', handler, false);
      }
    } catch (e) {}
    return true;
  }
  bindAutoLock();

  function currentWords() {
    if (ST.words && ST.words.length) return ST.words;
    return sync() && sync().words ? sync().words() : [];
  }

  /* R8/D14: the free enricher — dictionaryapi.dev + mymemory (en|si), always ending in the of… */
  /* D12: a harvested human `-uk.mp3` wins; dict.youdao `type=1` is second. */
  function audioForWord(word, dAudio) {
    var harvested = str(dAudio);
    if (harvested) return harvested;
    return 'https://dict.youdao.com/dictvoice?type=1&audio=' + encodeURIComponent(str(word));
  }
  /* D11: pick the real human British recording out of entry.phonetics[]. */
  function pickBritishAudio(entry) {
    var best = '', gb = '', uk = '';
    var list = isObj(entry) && Array.isArray(entry.phonetics) ? entry.phonetics : [];
    for (var i = 0; i < list.length; i++) {
      var a = isObj(list[i]) ? str(list[i].audio) : '';
      if (!a) continue;
      if (a.indexOf('//') === 0) a = 'https:' + a;
      if (a.indexOf('-uk.mp3') >= 0) { if (!uk) uk = a; continue; }
      if (a.indexOf('_gb') >= 0) { if (!gb) gb = a; continue; }
      if (!best) best = a;
    }
    return uk || gb || best;
  }
  function hasFullRecord(rec) {
    if (!isObj(rec)) return false;
    return !!(str(rec.w) && str(rec.p) && str(rec.pos) && str(rec.m) && str(rec.si) && str(rec.s));
  }
  function fallbackEnrich(word, prior) {
    var base = isObj(prior) ? prior : {};
    var w = str(word);
    return {
      w: w,
      p: str(base.p) || ('/' + w + '/'),
      pos: str(base.pos) || 'n/v',
      m: str(base.m) || ('B1 classroom vocabulary word: ' + w),
      si: str(base.si) || w,
      s: str(base.s) || ('Please write the word ' + w + ' carefully in your dictation book.'),
      audio: str(base.audio) || audioForWord(w),
      exampleSi: str(base.exampleSi),
      /* D14: an offline record says so, so the next online run retries it. */
      enrichSource: str(base.enrichSource) || 'lexicon'
    };
  }
  
  function mergeEnrichRecord(word, prior, provided) {
    var base = fallbackEnrich(word, prior);
    var p = isObj(provided) ? provided : {};
    var out = {
      w: str(word),
      p: str(p.p) || base.p,
      pos: str(p.pos) || base.pos,
      m: str(p.m) || base.m,
      si: str(p.si) || base.si,
      s: str(p.s) || base.s,
      audio: str(prior && prior.audio) || base.audio,
      exampleSi: str(p.exampleSi) || base.exampleSi,
      enrichSource: str(p.enrichSource) || str(prior && prior.enrichSource) || base.enrichSource
    };
    return out;
  }
  function fetchJsonSafe(url, timeoutMs, cb) {
    cb = cb || noop;
    if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
    var done = false, timer = null;
    function finish(err, data) {
      if (done) return;
      done = true;
      if (timer) { try { global.clearTimeout(timer); } catch (e) {} timer = null; }
      cb(err, data);
    }
    timer = global.setTimeout(function () { finish(new Error('timeout')); }, Number(timeoutMs) || 6000);
    try {
      global.fetch(url, { cache: 'no-store' })
        .then(function (res) { return res && res.ok && res.json ? res.json() : null; })
        .then(function (data) { if (data) finish(null, data); else finish(new Error('bad_response')); },
          function () { finish(new Error('fetch_failed')); });
    } catch (e) { finish(new Error('fetch_failed')); return false; }
    return true;
  }
  function dictFields(json) {
    var out = { p: '', pos: '', m: '', s: '', audio: '' };
    var entry = Array.isArray(json) ? json[0] : (isObj(json) ? json : null);
    if (!isObj(entry)) return out;
    /* D11: the real human British `-uk.mp3` recording, when there is one. */
    out.audio = pickBritishAudio(entry);
    if (str(entry.phonetic)) out.p = str(entry.phonetic);
    if (!out.p && Array.isArray(entry.phonetics)) {
      for (var i = 0; i < entry.phonetics.length; i++) {
        if (isObj(entry.phonetics[i]) && str(entry.phonetics[i].text)) { out.p = str(entry.phonetics[i].text); break; }
      }
    }
    var meanings = Array.isArray(entry.meanings) ? entry.meanings : [];
    if (meanings.length && isObj(meanings[0])) {
      out.pos = str(meanings[0].partOfSpeech);
      var defs = Array.isArray(meanings[0].definitions) ? meanings[0].definitions : [];
      if (defs.length && isObj(defs[0])) out.m = str(defs[0].definition);
      for (var d = 0; d < defs.length; d++) {
        if (isObj(defs[d]) && str(defs[d].example)) { out.s = str(defs[d].example); break; }
      }
    }
    if (out.pos && out.pos.charAt(out.pos.length - 1) !== '.') out.pos += '.';
    return out;
  }
  function sinhalaFrom(json) {
    if (!isObj(json)) return '';
    var rd = isObj(json.responseData) ? json.responseData : {};
    return str(rd.translatedText || '');
  }
  function freeEnrichOne(word, prior, cb) {
    cb = cb || noop;
    var w = str(word);
    var pending = 2, dict = null, si = '';
    function done() {
      pending -= 1;
      if (pending > 0) return;
      var out = mergeEnrichRecord(w, prior, {});
      if (dict) {
        if (dict.p) out.p = dict.p;
        if (dict.pos) out.pos = dict.pos;
        if (dict.m) out.m = dict.m;
        if (dict.s) out.s = dict.s;
        /* D11/D12: never discard a known human British recording. */
        if (dict.audio) out.audio = str(dict.audio);
      }
      if (si) out.si = si;
      out.enrichSource = (dict || si) ? 'free_dict' : 'lexicon';
      cb(null, out, !(dict || si));
    }
    fetchJsonSafe(DICTIONARY_API + encodeURIComponent(w), 6000, function (err, json) {
      if (!err) dict = dictFields(json);
      done();
    });
    fetchJsonSafe(SINHALA_API + encodeURIComponent(w) + '&langpair=en|si', 6000, function (err, json) {
      if (!err) si = sinhalaFrom(json);
      done();
    });
    return true;
  }
  function llmPrompt(words) {
    return 'You are a vocabulary assistant for a Sri Lankan B1 English class. ' + 'Return STRICT JSON only, no prose: {"words":[{"w":"spelling","p":"IPA","pos":"adj.","m":"short English definition","si":"Sinhala meaning","s":"one simple B1 example sentence"}]} ' + 'for exactly these words: ' + words.join(', ');
  }
  function parseJsonLoose(text) {
    var t = str(text).replace(/```json/gi, '```').replace(/```/g, '').replace(/^\s+|\s+$/g, '');
    try { return JSON.parse(t); } catch (e) {}
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e2) {} }
    return null;
  }
  function llmRows(provider, json) {
    var text = '';
    if (provider === 'gemini') {
      var cand = json && json.candidates && json.candidates[0] ? json.candidates[0] : null;
      var parts = cand && cand.content ? cand.content.parts : null;
      if (Array.isArray(parts) && parts[0]) text = str(parts[0].text);
    } else {
      var choice = json && json.choices && json.choices[0] ? json.choices[0] : null;
      text = str(choice && choice.message ? choice.message.content : '');
    }
    var parsed = parseJsonLoose(text);
    var rows = isObj(parsed) && Array.isArray(parsed.words) ? parsed.words : (Array.isArray(parsed) ? parsed : []);
    var out = {}, i;
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!isObj(r) || !str(r.w)) continue;
      out[str(r.w).toLowerCase()] = r;
    }
    return out;
  }
  function llmRequest(provider, key, words, cb) {
    cb = cb || noop;
    var ep = LLM_ENDPOINTS[provider];
    if (!ep) { cb(new Error('no_provider')); return false; }
    var info = isObj(AI_PROVIDERS[provider]) ? AI_PROVIDERS[provider] : {};
    /* D10: pollinations_free is a zero-key endpoint — never demand a key. */
    if (info.needsKey !== false && !key) { cb(new Error('no_key')); return false; }
    if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
    var prompt = llmPrompt(words), url = ep.url, headers = { 'Content-Type': 'application/json' }, body = null;
    if (provider === 'gemini') {
      url += '?key=' + encodeURIComponent(str(key));
      body = { contents: [{ parts: [{ text: prompt }] }] };
    } else {
      /* D10: no Authorization header at all for the keyless slot. */
      if (str(key)) headers.Authorization = 'Bearer ' + str(key);
      body = {
        model: ep.model, temperature: 0.2, response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You answer with strict JSON only.' },
          { role: 'user', content: prompt }
        ]
      };
    }
    try {
      global.fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body), cache: 'no-store' })
        .then(function (res) { return res && res.json ? res.json() : null; })
        .then(function (json) { cb(null, llmRows(provider, json)); },
          function (err) { cb(err || new Error('llm_failed')); });
    } catch (e) { cb(e || new Error('llm_failed')); return false; }
    return true;
  }
  
  function enrichWords(rawWordsInput, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    opts = opts || {};
    cb = cb || noop;
    var list = Array.isArray(rawWordsInput)
      ? rawWordsInput.map(function (w) { return isObj(w) ? w : { w: str(w) }; })
      : parseBulkWords(str(rawWordsInput));
    list = list.slice(0, WORD_CAP);
    if (!list.length) { cb(new Error('no_words')); return { ok: false, reason: 'no_words', words: [] }; }
    var source = Array.isArray(opts.existing) ? opts.existing : wordManagerWords();
    var prior = {}, i;
    for (i = 0; i < source.length; i++) {
      if (source[i] && str(source[i].w)) prior[str(source[i].w).toLowerCase()] = source[i];
    }
    var force = !!opts.force, slots = [], needs = [];
    for (i = 0; i < list.length; i++) {
      var raw = list[i], word = str(raw.w).replace(/^\s+|\s+$/g, '');
      if (!word) continue;
      var base = prior[word.toLowerCase()] || null;
      var provided = { p: str(raw.p), pos: str(raw.pos), m: str(raw.m), si: str(raw.si), s: str(raw.s) };
      var merged = mergeEnrichRecord(word, base, provided);
      var slot = { w: word, prior: base, record: merged };
      slots.push(slot);
      if (force || !hasFullRecord(merged) || str(merged.enrichSource) === 'lexicon') needs.push(slot);
    }
    ST.enriching = true;
    var offlineCount = 0, provider = aiProviderName();
    function finishAll() {
      var out = [], j;
      for (j = 0; j < slots.length; j++) out.push(slots[j].record);
      ST.enriching = false;
      ST.enrichStatus = t('studioEnriched') + ' · ' + out.length + (offlineCount ? ' · ' + t('studioAiOffline') : '');
      setStudioWords(out);
      msg(ST.enrichStatus, 'ok');
      testStatus(ST.enrichStatus + ' · ' + (provider === 'free_dict' ? 'free dictionary' : provider), 'ok');
      var report = { ok: true, words: out, enriched: needs.length, offline: offlineCount, provider: provider };
      cb(null, report);
      return report;
    }
    function afterFree(index) {
      if (index >= needs.length) { finishAll(); return; }
      var slot = needs[index];
      freeEnrichOne(slot.w, slot.prior, function (err, record, offline) {
        slot.record = record;
        if (offline) offlineCount += 1;
        afterFree(index + 1);
      });
    }
    if (!needs.length) { ST.enriching = false; return finishAll(); }
    if (aiNeedsLlm()) {
      var names = [], k;
      for (k = 0; k < needs.length; k++) names.push(needs[k].w);
      testStatus(t('studioEnriching') + ' · ' + provider, '');
      llmRequest(provider, aiProviderKey(), names, function (err, rows) {
        if (err || !isObj(rows)) { afterFree(0); return; }
        var rest = [], m;
        for (m = 0; m < needs.length; m++) {
          var slot2 = needs[m];
          var row = rows[slot2.w.toLowerCase()];
          if (isObj(row)) slot2.record = mergeEnrichRecord(slot2.w, slot2.prior, row);
          else rest.push(slot2);
        }
        needs = rest;
        afterFree(0);
      });
      return { ok: true, pending: true, words: slots.length, provider: provider };
    }
    afterFree(0);
    return { ok: true, pending: true, words: slots.length, provider: provider };
  }
  /* D10: the zero-key dictionary probe — the permanent safety net under every LLM slot, so Te… */
  function freeDictTest(word, cb) {
    cb = cb || noop;
    var pending = 2, okDict = false, okSi = false;
    function done() {
      pending -= 1;
      if (pending > 0) return;
      var offline = !(okDict || okSi);
      testStatus((offline ? '✅ Free Dictionary ready · ' + t('studioAiOffline')
        : '✅ Free Dictionary ready · zero API key' + (okSi ? ' · EN→SI OK' : '')), 'ok');
      cb(null, { ok: true, provider: 'free_dict', dictionary: okDict, sinhala: okSi, offline: offline, word: word });
    }
    fetchJsonSafe(DICTIONARY_API + encodeURIComponent(word), 6000, function (err, json) {
      if (!err) okDict = !!dictFields(json).m;
      done();
    });
    fetchJsonSafe(SINHALA_API + encodeURIComponent(word) + '&langpair=en|si', 6000, function (err, json) {
      if (!err) okSi = !!sinhalaFrom(json);
      done();
    });
    return true;
  }
  /* `testAiEngine` — #btnTestAi. Never touches ElevenLabs (W5). */
  function testAiEngine(cb) {
    cb = cb || noop;
    var provider = aiProviderName();
    var first = wordManagerWords()[0] || {};
    var word = str(first.w) || 'afraid';
    if (!aiNeedsLlm(provider, aiProviderKey())) {
      freeDictTest(word, cb);
      return { ok: true, pending: true, provider: 'free_dict' };
    }
    llmRequest(provider, aiProviderKey(), [word], function (err, rows) {
      if (err) {
        /* D10: a timed-out free LLM falls through to the zero-key ladder. */
        testStatus('⚠️ ' + provider + ' · ' + str(err.message || 'llm_failed') + ' — ' + t('studioAiOffline'), '');
        freeDictTest(word, function (e2, report) {
          var out = report || { ok: true, provider: 'free_dict', word: word };
          out.provider = 'free_dict';
          out.fellBackFrom = provider;
          cb(null, out);
        });
        return;
      }
      var row = isObj(rows) ? rows[word.toLowerCase()] : null;
      testStatus('✅ ' + provider + ' ready · ' + (row ? 'JSON row valid' : 'reachable'), 'ok');
      cb(null, { ok: true, provider: provider, validated: !!row, word: word });
    });
    return { ok: true, pending: true, provider: provider };
  }

  /* ══ R9 / D15 / D19: one publish clock, four files, version.json last ══ */
  /* W8/D19: stamp ONE syncRev into config + version and commit them in order (version.json la… */
  function publishConfigAndVersion(cfgBody, envelope, label, cb) {
    cb = cb || noop;
    var token = str(ST.secrets.ghToken);
    var body = isObj(cfgBody) ? cfgBody : (sync() && sync().config ? JSON.parse(JSON.stringify(sync().config() || {})) : {});
    var live = sync() && sync().version ? (sync().version() || {}) : {};
    var sess = str(live.session || '8') || '8';
    var versionBody = buildVersionPayload(sess, str(live.title || '') || ('Session ' + sess), nextSyncRev());
    /* D17: prove this publish did NOT touch session.json (2 files, not 3). */
    versionBody.payloadFiles = ['data/config.json', 'data/version.json'];
    body.ver = schemaVer(); body.appVersion = appVersion(); body.version = appVersion();
    body.schema = schemaVer();
    body.settingsRev = Number(versionBody.settingsRev);
    body.syncRev = Number(versionBody.syncRev);
    body.updatedAt = new Date().toISOString();
    if (envelope) body.encVault = str(envelope);
    if (!token || !sync() || !sync().publishFilesSequential) { cb(new Error('no_token'), null, versionBody); return versionBody; }
    publishVaultFiles(buildVaultFiles(body, versionBody, label || ('Studio vault ' + appVersion())), token, function (err, info) {
      cb(err, info, versionBody);
    });
    return versionBody;
  }
  function publishBundle(words, opts, cb) {
    opts = opts || {};
    cb = cb || noop;
    if (!ST.unlocked) { cb(new Error('locked')); return { ok: false, reason: 'locked' }; }
    var token = str(ST.secrets.ghToken) || fieldValue('ghTokenInput');
    if (!token) { msg(t('studioNoToken'), 'bad'); cb(new Error('no_token')); return { ok: false, reason: 'no_token' }; }
    if (!sync() || !sync().publishFilesSequential) { cb(new Error('no_sync')); return { ok: false, reason: 'no_sync' }; }
    var syncRev = nextSyncRev();
    var liveVersion = sync().version ? (sync().version() || {}) : {};
    var sessionNo = str(opts.sessionNo || liveVersion.session || (sync().sessionNo ? sync().sessionNo() : '8')) || '8';
    var title = str(opts.title || liveVersion.title || '') || ('Session ' + sessionNo);
    var version = buildVersionPayload(sessionNo, title, syncRev);
    version.payloadFiles = ['data/session.json', 'data/config.json', 'data/elevenlabs-audio.json', 'data/version.json'];
    var session = buildSessionPayload(words, { sessionNo: sessionNo, title: title });
    session.syncRev = syncRev;
    session.settingsRev = Number(version.settingsRev);
    var cfg = sync().config ? JSON.parse(JSON.stringify(sync().config() || {})) : {};
    cfg.ver = schemaVer();
    cfg.appVersion = appVersion();
    cfg.version = appVersion();
    cfg.schema = schemaVer();
    cfg.settingsRev = Number(version.settingsRev);
    cfg.syncRev = syncRev;
    var env = isRealEnvelope(ST.envelope) ? ST.envelope : configEnvelope();
    if (env) cfg.encVault = str(env);
    var verifier = pinVerifier();
    if (isObj(verifier)) cfg.pinVerifier = verifier;
    cfg.classSettings = classSettingsSnapshot();
    cfg.updatedAt = new Date().toISOString();
    var pack = voicePackPayload(syncRev);
    var files = [
      { path: 'data/session.json', content: JSON.stringify(session, null, 2), message: 'Smart Dictation words ' + appVersion() },
      { path: 'data/config.json', content: JSON.stringify(cfg, null, 2), message: 'Smart Dictation settings ' + appVersion() },
      { path: 'data/elevenlabs-audio.json', content: JSON.stringify(pack, null, 2), message: 'Alice voice pack ' + appVersion() },
      { path: 'data/version.json', content: JSON.stringify(version, null, 2), message: 'Smart Dictation version ' + appVersion() }
    ];
    sync().publishFilesSequential(files, token, function (path, ok) {
      if (!ok) msg(t('studioPublishFail') + ' · ' + path, 'bad');
    }, function (err, info) {
      if (err) { cb(err, info); return; }
      ST.lastPublish = { at: Date.now(), syncRev: syncRev, files: files.map(function (f) { return f.path; }), version: version };
      cb(null, ST.lastPublish);
    });
    return { ok: true, pending: true, syncRev: syncRev };
  }
  
  function publishWordsAndVoice(cb) {
    cb = cb || noop;
    return publishBundle(currentWords(), {}, function (err, info) {
      if (err) { msg(t('studioPublishFail'), 'bad'); cb(err, info); return; }
      try { if (SDP.Speech && SDP.Speech.injectClips) SDP.Speech.injectClips(ST.voicePack.clips || {}); } catch (e) {}
      msg(t('studioPublishOk') + ' · v' + appVersion(), 'ok');
      toast(t('studioPublishOk'));
      cb(null, info);
    });
  }
  /* Re-seal the vault (and recompute the published PIN verifier) without publishing, so the o… */
  function sealVaultNow(cb) {
    cb = cb || noop;
    var v = vault();
    var pin = str(ST.pin || '');
    if (!v || !pin) { cb(new Error('no_pin')); return false; }
    if (v.stash) v.stash(ST.secrets);
    v.encryptV2(ST.secrets, pin).then(function (envelope) {
      ST.envelope = envelope;
      persistEnvelope(envelope);
      var currentVerifier = pinVerifier() || layerOneVerifier();
      var currentSalt = currentVerifier && isObj(currentVerifier) ? str(currentVerifier.salt) : '';
      /* D5: mirror the envelope + verifier into Layer 1 before any publish. */
      writeLayerOne(envelope, currentVerifier);
      if (!v.computePinVerifier) { cb(null, envelope, currentVerifier); return; }
      v.computePinVerifier(pin, currentSalt).then(function (verifier) {
        var cfg = sync() && sync().config ? sync().config() : null;
        if (cfg) cfg.pinVerifier = verifier;
        writeLayerOne(envelope, verifier);
        cb(null, envelope, verifier);
      }, function () { cb(null, envelope, currentVerifier); });
    }, function () { cb(new Error('encrypt_failed')); });
    return true;
  }
  /* #btnOneClickMasterSetup — Rule 1B. Only the GitHub token is fatal. */
  function oneClickMasterSetup(cb) {
    cb = cb || noop;
    if (!ST.unlocked) { msg(t('studioLocked'), 'bad'); cb(new Error('locked')); return { ok: false, reason: 'locked' }; }
    if (ST.publishing) { cb(new Error('busy')); return { ok: false, reason: 'busy' }; }
    ST.publishing = true;
    ST.tierWarn = '';
    var elKey = fieldValue('elKeyInput') || str(ST.secrets.elevenKey);
    var gh = fieldValue('ghTokenInput') || str(ST.secrets.ghToken);
    function fail(step, detail) {
      ST.publishing = false;
      setMasterStep(step, 'bad');
      msg(t('studioPublishFail') + ' · ' + str(detail), 'bad');
      cb(new Error('master_setup_failed'), { ok: false, step: step, detail: str(detail) });
    }
    function step4(genInfo) {
      setMasterStep(4, 'active');
      publishBundle(currentWords(), {}, function (pubErr, pubInfo) {
        if (pubErr) { fail(4, pubErr.message || 'publish_failed'); return; }
        try { if (SDP.Speech && SDP.Speech.injectClips) SDP.Speech.injectClips(ST.voicePack.clips || {}); } catch (e) {}
        ST.publishing = false;
        ST.masterStep = 5;
        ST.masterDetail = 'ok';
        paintMasterSteps();
        paintVaultBadge();
        var made = genInfo && genInfo.made ? genInfo.made.length : 0;
        msg(t('studioPublishOk') + ' · ' + made + ' clips · syncRev ' + (pubInfo && pubInfo.syncRev), 'ok');
        toast(t('studioPublishOk'));
        cb(null, {
          ok: true, clips: made,
          skipped: genInfo ? genInfo.skipped : 0,
          tierLimited: !!(genInfo && genInfo.tierLimited),
          warning: ST.tierWarn,
          syncRev: pubInfo && pubInfo.syncRev, files: pubInfo && pubInfo.files
        });
      });
    }
    function step3() {
      setMasterStep(3, 'active');
      /* D4: with no ElevenLabs key at all we say so and publish anyway. */
      if (!elKey) {
        var note = tierWarning();
        msg('⚠️ ' + note, '');
        testStatus('⚠️ ' + note, '');
        step4({ made: [], skipped: 0, tierLimited: true });
        return;
      }
      generateClips({ force: forceRegenChecked(), noCommit: true }, function (genErr, genInfo) {
        if (genErr && !(genInfo && genInfo.tierLimited)) { fail(3, quotaError(genErr)); return; }
        step4(genInfo || { made: [], skipped: 0 });
      });
    }
    function step2() {
      setMasterStep(2, 'active');
      /* D3: the quota read is ADVISORY. scoped / 0 / unreachable all proceed. */
      if (!elKey) { step3(); return; }
      checkQuota(elKey, function () { step3(); });
    }
    /* ── Step 1 — read inputs, seal the vault, verify the GitHub token ── */
    setMasterStep(1, 'active');
    mergeSecretInputs();
    sealVaultNow(function (sealErr, envelope, verifier) {
      if (!sealErr) writeLayerOne(envelope, verifier || pinVerifier());
      if (sealErr) { fail(1, sealErr.message || 'seal_failed'); return; }
      if (!gh) { fail(1, 'GitHub token missing'); return; }
      testGitHubToken(gh, function (ghErr) {
        if (ghErr) { fail(1, ghError(ghErr)); return; }
        step2();
      });
    });
    return { ok: true, pending: true };
  }

  function publishPreviewWords(words) {
    ST.words = words || currentWords();
    var payloads = buildPublishPayloads(ST.words, {});
    ST.preview = payloads;
    return payloads;
  }
  function openPublishPreview() {
    var payloads = publishPreviewWords(currentWords());
    var host = byId('studioPreview');
    if (!host) return payloads;
    var rows = '';
    for (var i = 0; i < ST.words.length; i++) {
      var w = ST.words[i] || {};
      rows += '<tr><td>' + (i + 1) + '</td><td>' + esc(w.w) + '</td><td>' + esc(w.p) + '</td><td class="word-si">' + esc(w.si) + '</td></tr>';
    }
    host.innerHTML = '<table class="studio-preview-table"><thead><tr><th>#</th><th>w</th><th>IPA</th><th>සිංහල</th></tr></thead><tbody>' + rows + '</tbody></table>' + '<p class="studio-msg">data/session.json · data/config.json · data/elevenlabs-audio.json · data/version.json · ' +
      ST.words.length + ' ' + T('studioWordsCount') + '</p>';
    return payloads;
  }

  /* ── publishing: sequential Contents API (D-S5) ─────────────────────── */
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 publishing */
  /* D13/D19: the pre-publish checklist — empty array means coherent. */
  function publishChecklist(payloads) {
    var problems = [];
    var session = isObj(payloads.session) ? payloads.session : {};
    var words = Array.isArray(session.words) ? session.words : [];
    var i;
    if (!words.length) problems.push('session has no words');
    for (i = 0; i < words.length; i++) {
      if (!str(words[i] && words[i].w)) { problems.push('word #' + (i + 1) + ' has no spelling'); break; }
    }
    var cfg = isObj(payloads.config) ? payloads.config : {};
    var env = str(cfg.encVault);
    if (!env) problems.push('vault envelope missing');
    if (!isObj(cfg.pinVerifier) || !str(cfg.pinVerifier.hash)) problems.push('pinVerifier missing');
    var version = isObj(payloads.version) ? payloads.version : {};
    var prevRev = 0;
    try { prevRev = Number((sync() && sync().version() && sync().version().syncRev) || 0); } catch (e) { prevRev = 0; }
    if (!(Number(version.syncRev) > prevRev)) problems.push('syncRev did not move forward');
    if (Number(version.settingsRev) < schemaVer()) problems.push('settingsRev went backwards');
    return problems;
  }
  function publish(cb) {
    cb = cb || noop;
    if (!ST.unlocked) { msg(t('studioLocked'), 'bad'); cb(new Error('locked')); return; }
    var token = str(ST.secrets.ghToken);
    if (!token) { msg(t('studioNoToken'), 'bad'); cb(new Error('no_token')); return; }
    var payloads = buildPublishPayloads(currentWords(), {});
        /* D19: refuse a broken payload before it reaches thirty devices. */
    var problems = publishChecklist(payloads);
    if (problems.length) {
      msg(t('studioPublishFail') + ' · ' + problems.join(' · '), 'bad');
      cb(new Error('checklist_failed'));
      return;
    }
    return publishBundle(currentWords(), {}, function (err, info) {
      if (err) { cb(err, info); return; }
      msg(t('studioPublishOk') + ' · v' + appVersion(), 'ok');
      cb(null, info);
    });
  }

  /* ══ D-C1..C7: credit-safe Alice voice pack ═══════════════════════════ */
  function elevenUrl() { return 'https://api.elevenlabs.io/v1/text-to-speech/' + VOICE_ID; }
  function guideSteps() {
    var out = [], i, title, body;
    for (i = 1; i <= 4; i++) {
      title = en('guideStep' + i + 'Title') || ('Step ' + i);
      body = en('guideStep' + i + 'Body');
      out.push({ key: '_guide_' + i, text: (title + '. ' + body).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '') });
    }
    return out;
  }
  function costPreview(words) {
    var list = Array.isArray(words) ? words : currentWords();
    var wordChars = 0, i;
    for (i = 0; i < Math.min(WORD_CAP, list.length); i++) wordChars += str((list[i] || {}).w).length;
    var steps = guideSteps(), guideChars = 0;
    for (i = 0; i < steps.length; i++) guideChars += steps[i].text.length;
    return { words: wordChars, guide: guideChars, total: wordChars + guideChars, count: Math.min(WORD_CAP, list.length) };
  }
  function costPreviewLine(words) {
    var c = costPreview(words);
    return c.count + ' words = ' + c.words + ' chars · 4 guide steps = ' + c.guide + ' chars · total ' + c.total + ' chars';
  }
  /* D2: 403 / missing_permissions / scoped is GREEN — never raw subscription_failed. */
  function quotaError(err) {
    var detail = str(err && err.code), code = Number((err && err.status) || 0);
    if (err && err.scoped) return SCOPED_NOTE();
    if (detail === 'invalid_api_key') return 'Invalid ElevenLabs key (invalid_api_key)';
    if (detail === 'missing_permissions') return SCOPED_NOTE();
    if (detail === 'quota_exceeded' || code === 402) return 'Quota exhausted — top up or wait for renewal';
    if (code === 401) return 'Invalid ElevenLabs key';
    if (code === 403) return SCOPED_NOTE();
    if (code === 429) return 'Rate limited — retrying in 5s';
    var m = str(err && err.message);
    if (!m || m === 'subscription_failed' || m === 'key_rejected') {
      return 'ElevenLabs key kept — quota read unavailable, voice generation still works';
    }
    return m;
  }
  function tierWarning() { return (ST.tierWarn = TIER_WARN()); }
  function ghError(err) {
    var code = Number((err && err.status) || 0);
    if (code === 401) return 'GitHub token rejected (401)';
    if (code === 403) return 'GitHub token lacks write access (403)';
    if (code === 404) return 'Repository or token scope not found (404)';
    return str(err && err.message) || 'network error';
  }
  function withStatus(err, status) { err = err || new Error('http_' + status); err.status = status; return err; }

  /* D1 (Rule 1A) — the 3-rung, non-blocking key check. */
  function looksLikeElevenKey(key) {
    var k = str(key);
    if (!k) return false;
    if (/^sk_[A-Za-z0-9_]{20,}$/.test(k)) return true;
    return /^[A-Za-z0-9]{28,}$/.test(k);
  }
  function detailCode(body) {
    if (!isObj(body)) return '';
    var d = isObj(body.detail) ? body.detail : null;
    return str(d && d.status);
  }
  function scopedVerdict() { return { ok: true, scoped: true, remaining: null, note: SCOPED_NOTE() }; }
  function fatalKey(status) {
    var err = withStatus(new Error('invalid_api_key'), status || 401);
    err.code = 'invalid_api_key';
    err.fatal = true;
    return err;
  }
  function elevenGet(url, key, cb) {
    cb = cb || noop;
    if (typeof global.fetch !== 'function') { cb(new Error('no_fetch'), null); return false; }
    function wrap(res) {
      var ok = !!(res && res.ok);
      var status = res && typeof res.status === 'number' ? res.status : (ok ? 200 : 0);
      var read = res && typeof res.json === 'function' ? res.json() : null;
      function give(body) { cb(null, { status: status, body: body, ok: ok }); }
      if (!read || typeof read.then !== 'function') { give(null); return null; }
      return read.then(give, function () { give(null); });
    }
    try {
      global.fetch(url, { method: 'GET', headers: { 'xi-api-key': str(key), Accept: 'application/json' }, cache: 'no-store' })
        .then(wrap, function (err) { cb(err || new Error('network_error'), null); });
    } catch (e) { cb(e || new Error('network_error'), null); return false; }
    return true;
  }
  /* Zero-cost endpoint: reading the subscription never bills a character. */
  function fetchSubscription(key, cb) {
    cb = cb || noop;
    if (!key) { cb(withStatus(new Error('no_key'), 401)); return false; }
    if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
    function accept(v) { ST.quota = v; cb(null, v); }
    elevenGet(EL_SUBSCRIPTION, key, function (err, res) {
      if (!err && res && res.ok) {
        var b = isObj(res.body) ? res.body : {};
        var used = Number(b.character_count), lim = Number(b.character_limit);
        if (isNaN(used)) used = 0;
        if (isNaN(lim)) lim = 0;
        accept({ ok: true, used: used, limit: lim, remaining: Math.max(0, lim - used) });
        return;
      }
      var status = (res && Number(res.status)) || 0, code = detailCode(res && res.body);
      if (code === 'invalid_api_key') { cb(fatalKey(status)); return; }
          elevenGet(EL_VOICES, key, function (err2, res2) {
        if (!err2 && res2 && res2.ok) { accept(scopedVerdict()); return; }
        var code2 = detailCode(res2 && res2.body);
        if (code2 === 'invalid_api_key') { cb(fatalKey((res2 && Number(res2.status)) || status)); return; }
              if (looksLikeElevenKey(key)) { accept(scopedVerdict()); return; }
        var bad = withStatus(new Error('key_rejected'), (res2 && Number(res2.status)) || status || 0);
        bad.code = code2 || code || 'key_rejected';
        cb(bad);
      });
    });
    return true;
  }
  function probeQuota(key, cb) {
    cb = cb || noop;
    fetchSubscription(key, function (err, result) {
      var line;
      if (err) {
        line = '❌ ' + quotaError(err);
        setText(byId('quotaText'), line);
        testStatus(line, 'bad');
        cb(err);
        return;
      }
      /* D2: a scoped key paints GREEN, never a red cross. */
      if (result && result.scoped) line = str(result.note) || SCOPED_NOTE();
      else line = 'Used ' + result.used + ' / Limit ' + result.limit + ' chars · Remaining: ' + result.remaining;
      setText(byId('quotaText'), line);
      testStatus((result && result.scoped ? '✅ ' : '✅ ElevenLabs Connected · ') + line, 'ok');
      cb(null, result);
    });
    return true;
  }
  function checkQuota(key, cb) { return probeQuota(key, cb); }
  function testElevenLabsKey(key, cb) { return probeQuota(key, cb); }
  function refreshQuota(cb) { return probeQuota(str(ST.secrets.elevenKey) || fieldValue('elKeyInput'), cb); }
  /* D-L3: accepts classic ghp_ tokens and fine-grained github_pat_ tokens. */
  function testGitHubToken(token, cb) {
    cb = cb || noop;
    var tk = str(token);
    if (!tk) { cb(withStatus(new Error('no_token'), 401)); return false; }
    if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
    var repo = sync() && sync().repo ? sync().repo() : { owner: 'dictationb1', name: 'dictationb1.github.io' };
    var url = 'https://api.github.com/repos/' + repo.owner + '/' + repo.name;
    try {
      global.fetch(url, {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + tk, Accept: 'application/vnd.github+json' },
        cache: 'no-store'
      }).then(function (res) {
        var status = res && typeof res.status === 'number' ? res.status : (res && res.ok ? 200 : 0);
        if (!res || !res.ok) throw withStatus(new Error('repo_check_failed'), status || 0);
        return res.json();
      }).then(function (body) {
        var perms = (body && body.permissions) || {};
        var canWrite = perms.push === true || perms.admin === true || perms.maintain === true || String(perms.contents || '') === 'write';
        if (!canWrite) { cb(withStatus(new Error('no_write_permission'), 403)); return; }
        var result = { repo: repo.owner + '/' + repo.name, permissions: perms };
        testStatus('✅ GitHub Connected (' + result.repo + ' · Write OK)', 'ok');
        cb(null, result);
      }, function (err) { cb(err || new Error('repo_check_failed')); });
    } catch (e) { cb(e || new Error('repo_check_failed')); return false; }
    return true;
  }

  function arrayBufferToBase64(buffer) {
    var bytes = buffer instanceof global.Uint8Array ? buffer : new global.Uint8Array(buffer);
    var out = '', i, chunk = 0x8000;
    for (i = 0; i < bytes.length; i += chunk) {
      var slice = bytes.subarray ? bytes.subarray(i, i + chunk) : bytes.slice(i, i + chunk);
      out += String.fromCharCode.apply(null, slice);
    }
    if (typeof global.btoa === 'function') return global.btoa(out);
    
    if (typeof Buffer !== 'undefined') return Buffer.from(out, 'binary').toString('base64');
    return '';
  }
  /* R2/D2: read the pack through the dual-source reader (stale CDN proof). */
  function loadVoicePack(cb) {
    cb = cb || noop;
    if (ST.voicePack.loaded) { cb(null, ST.voicePack); return true; }
    SDP.Sync.fetchFreshDataJson('data/elevenlabs-audio.json', function (err, result) {
      if (err || !result || !result.ok) { ST.voicePack.loaded = true; cb(err || new Error('pack_failed')); return; }
      var pack = result.json;
      if (isObj(pack) && isObj(pack.clips)) ST.voicePack.clips = pack.clips;
      ST.voicePack.rev = Number((pack && pack.syncRev) || 0);
      ST.voicePack.source = str(result.source);
      ST.voicePack.loaded = true;
      cb(null, ST.voicePack);
    });
    return true;
  }
  function clipExists(key) {
    var entry = ST.voicePack.clips ? ST.voicePack.clips[key] : null;
    if (!entry) return false;
    if (typeof entry === 'string') return !!entry;
    return !!(str(entry.b64) || str(entry.url));
  }
  function buildQueue(words, singleTest) {
    var list = (Array.isArray(words) ? words : currentWords()).slice(0, WORD_CAP);
    var queue = [], i;
    for (i = 0; i < list.length; i++) {
      var w = list[i] || {};
      var text = str(w.w);
      if (!text) continue;
      queue.push({ key: text.toLowerCase(), text: text });
      if (singleTest) return queue; /* 1-Word Test: ~8 chars, ~1 credit unit */
    }
    if (singleTest) return queue;
    var steps = guideSteps();
    for (i = 0; i < steps.length; i++) queue.push(steps[i]);
    return queue;
  }

  /* D-C1/C2/C5/C6/C7: generate ONLY the missing clips and actually save them. */
  function generateClips(a, b) {
    var opts = {}, cb = noop;
    if (typeof a === 'function') cb = a;
    else if (Array.isArray(a)) { opts = { words: a }; cb = typeof b === 'function' ? b : noop; }
    else { opts = isObj(a) ? a : {}; cb = typeof b === 'function' ? b : noop; }
    if (!ST.unlocked) { cb(new Error('locked')); return { ok: false, reason: 'locked' }; }
    if (!ST.voicePack.loaded) loadVoicePack(noop);
    var apiKey = str(ST.secrets.elevenKey) || fieldValue('elKeyInput');
    if (!apiKey) { msg(t('studioNoToken'), 'bad'); cb(new Error('no_key')); return { ok: false, reason: 'no_key' }; }
    var words = Array.isArray(opts.words) ? opts.words : currentWords();
    /* D-C7: never silently drop words past the 30-word cap. */
    if (words.length > WORD_CAP) {
      msg(str(words.length) + ' words parsed, first 30 used', '');
      toast(str(words.length) + ' words parsed, first 30 used');
    }
    var queue = buildQueue(words, !!opts.singleTest);
    var force = !!opts.force;
    var made = [], skipped = 0, index = 0, calls = 0, stopped = false, tierLimited = false;
    ST.generating = true;
    function finish(err) {
      if (stopped) return;
      stopped = true;
      ST.generating = false;
      paintClipTable();
      if (err) {
        msg('❌ ' + quotaError(err), 'bad');
        testStatus('❌ ' + quotaError(err), 'bad');
        cb(err, { made: made, skipped: skipped, calls: calls, tierLimited: tierLimited });
        return;
      }
      /* D4: quota/tier exhaustion is a WARNING, never a failed run. */
      var warnLine = tierLimited ? tierWarning() : '';
      msg(t('studioGenerate') + ' ✓ ' + made.length + ' · ' + skipped + ' skipped' + (warnLine ? ' · ' + warnLine : ''), 'ok');
      testStatus(warnLine ? '⚠️ ' + warnLine : '✅ ' + made.length + ' new · ' + skipped + ' already cached', warnLine ? '' : 'ok');
      if (made.length && !opts.noCommit) commitVoicePack();
      cb(null, { made: made, skipped: skipped, calls: calls, tierLimited: tierLimited, warning: warnLine });
    }
    function next() {
      if (index >= queue.length) { finish(null); return; }
      var item = queue[index];
      index += 1;
      if (!force && clipExists(item.key)) { skipped += 1; next(); return; } /* D-C2 delta */
      calls += 1;
      requestClip(item, apiKey, function (err, entry) {
        if (err) {
          var st = Number(err.status || 0);
                  /* D4: 401/402/403/429-after-retry stop the RUN, never the PUBLISH; */
          if (st === 401 || st === 402 || st === 403 || st === 429) {
            tierLimited = true;
            skipped = Math.max(skipped, queue.length - made.length);
            finish(null);
            return;
          }
          finish(err);
          return;
        }
        ST.voicePack.clips[item.key] = entry;
        made.push({ key: item.key, text: item.text, bytes: entry.bytes });
        ST.voicePack.loaded = true;
        paintClipTable();
        next();
      }, 0);
    }
    function requestClip(item, key, done, attempt) {
      try {
        global.fetch(elevenUrl(), {
          method: 'POST',
          headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
          body: JSON.stringify({
            text: item.text, model_id: VOICE_MODEL,
            voice_settings: { stability: 0.65, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true }
          })
        }).then(function (res) {
          var status = res && typeof res.status === 'number' ? res.status : (res && res.ok ? 200 : 0);
          if (!res || !res.ok) {
            /* D-C5: 429 gets exactly one retry, 5 s later. */
            if (status === 429 && attempt < 1) {
              global.setTimeout(function () { requestClip(item, key, done, attempt + 1); }, 5000);
              return null;
            }
            throw withStatus(new Error('tts_failed'), status || 0);
          }
          return res.arrayBuffer ? res.arrayBuffer() : null;
        }).then(function (buffer) {
          if (buffer === null) return;
          if (!buffer) throw new Error('empty_audio');
          var b64 = arrayBufferToBase64(buffer);
          if (!b64) throw new Error('encode_failed');
          done(null, { b64: b64, url: 'data:audio/mpeg;base64,' + b64, bytes: buffer.byteLength, at: Date.now() });
        }, function (err) { done(err || new Error('tts_failed')); });
      } catch (e) { done(e || new Error('tts_failed')); }
    }
    next();
    return { ok: true, started: queue.length, calls: 0 };
  }

  /* Commit the freshly paid-for clips so they can never be lost (D-C1). */
  function commitVoicePack(cb) {
    cb = cb || noop;
    var token = str(ST.secrets.ghToken);
    if (!token || !sync() || !sync().publishFilesSequential) { cb(new Error('no_token')); return false; }
    var files = [{
      path: 'data/elevenlabs-audio.json',
      content: JSON.stringify(voicePackPayload(), null, 2),
      message: 'Alice voice pack ' + appVersion()
    }];
    sync().publishFilesSequential(files, token, noop, cb || noop);
    return true;
  }

  /* D12: an interactive 30-row preview/editor, so a lecturer sees every field before a word i… */
  function wordManagerWords() {
    var list = ST.words.length ? ST.words : (sync() && sync().words ? sync().words() : []);
    return Array.isArray(list) ? list.slice(0, WORD_CAP) : [];
  }
  function paintWordManager() {
    var host = byId('studioWordManager');
    if (!host) return false;
    var list = wordManagerWords();
    if (!list.length) { host.innerHTML = ''; return true; }
    var cols = ['w', 'p', 'pos', 'm', 'si', 's'];
    var rows = '', i, c;
    for (i = 0; i < list.length; i++) {
      var w = list[i] || {};
      rows += '<tr data-word-row="' + i + '"><td class="wm-idx">' + (i + 1) + '</td>';
      for (c = 0; c < cols.length; c++) {
        rows += '<td><input class="input wm-input" data-wm="' + cols[c] + '" data-row="' + i +
          '" value="' + esc(str(w[cols[c]])) + '"></td>';
      }
      rows += '</tr>';
    }
    host.innerHTML = '<div class="table-wrap"><table class="studio-preview-table studio-word-table"><thead><tr>' + '<th>#</th><th>w</th><th>p</th><th>pos</th><th>m</th><th>si</th><th>s</th></tr></thead><tbody>' +
      rows + '</tbody></table></div><p class="muted">' + T('studioWordManager') + ' · ' +
      list.length + ' ' + T('studioWordsCount') + '</p>';
    return true;
  }
  
  function parseBulkWords(text) {
    var parts = str(text).split(/[\n,;]+/);
    var out = [], seen = {}, i;
    for (i = 0; i < parts.length; i++) {
      var line = str(parts[i]).replace(/^\s+|\s+$/g, '');
      if (!line) continue;
      var cols = line.indexOf('|') >= 0 ? line.split('|') : [line];
      var word = str(cols[0]).replace(/^\s+|\s+$/g, '');
      if (!word) continue;
      var key = word.toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      out.push({
        w: word, p: str(cols[1] || '').replace(/^\s+|\s+$/g, ''),
        pos: str(cols[2] || '').replace(/^\s+|\s+$/g, ''),
        m: str(cols[3] || '').replace(/^\s+|\s+$/g, ''),
        si: str(cols[4] || '').replace(/^\s+|\s+$/g, ''),
        s: str(cols[5] || '').replace(/^\s+|\s+$/g, '')
      });
      if (out.length >= WORD_CAP) break;
    }
    return out;
  }
  function setStudioWords(list, source) {
    ST.words = (Array.isArray(list) ? list : []).slice(0, WORD_CAP);
    var editor = byId('studioWords');
    if (editor) editor.value = wordsToText(ST.words);
    var bulk = byId('studioBulkWords');
    if (bulk && source !== 'bulk') {
      var names = [], i;
      for (i = 0; i < ST.words.length; i++) names.push(str(ST.words[i].w));
      bulk.value = names.join('\n');
    }
    setText(byId('studioCount'), ST.words.length + ' ' + t('studioWordsCount'));
    setText(byId('costPreviewLine'), costPreviewLine(ST.words));
    paintWordManager();
    return ST.words;
  }
  function paintClipTable() {
    var host = byId('clipPreviewTable');
    if (!host) return false;
    var clips = ST.voicePack.clips || {};
    var keys = [], k;
    for (k in clips) if (Object.prototype.hasOwnProperty.call(clips, k)) keys.push(k);
    if (!keys.length) { host.innerHTML = ''; return true; }
    var rows = '';
    for (var i = 0; i < keys.length; i++) {
      var entry = clips[keys[i]] || {};
      var bytes = typeof entry === 'string' ? 0 : Number(entry.bytes || 0);
      rows += '<tr><td>' + esc(keys[i]) + '</td><td>' + (bytes ? bytes + ' B' : 'cached') + '</td></tr>';
    }
    host.innerHTML = '<table class="studio-preview-table"><thead><tr><th>clip</th><th>size</th></tr></thead><tbody>' + rows + '</tbody></table>';
    return true;
  }

  /* ══ lecturer clip recorder (D-L5, D-L8) ══════════════════════════════ */
  function toggleRecord() {
    if (ST.recording) { stopRecord(); return 'stopped'; }
    return startRecord();
  }
  function startRecord() {
    var media = global.navigator && global.navigator.mediaDevices;
    if (!ST.unlocked || !media || typeof global.MediaRecorder !== 'function') {
      msg(t('studioRecord') + ' — microphone unavailable', 'bad');
      return null;
    }
    var btn = byId('btnStudioRecord');
    if (btn) btn.textContent = '⏹ Stop recording';
    ST.recording = true;
    recordClip(0, function (err, clip) {
      ST.recording = false;
      var b = byId('btnStudioRecord');
      if (b) b.textContent = t('studioRecord');
      if (err || !clip) return;
      var commitBtn = byId('btnCommitClip');
      if (commitBtn) commitBtn.disabled = false;
    });
    return { recording: true };
  }
  function stopRecord() {
    var rec = ST.recorder;
    ST.recording = false;
    var btn = byId('btnStudioRecord');
    if (btn) btn.textContent = t('studioRecord');
    if (rec && rec.stop) { try { rec.stop(); } catch (e) {} }
    ST.recorder = null;
    return 'stopped';
  }
  function recordClip(wordIndex, cb) {
    cb = cb || noop;
    var media = global.navigator && global.navigator.mediaDevices;
    if (!ST.unlocked || !media || typeof global.MediaRecorder !== 'function') {
      cb(new Error('no_media_recorder'));
      return null;
    }
    var words = currentWords();
    var word = words[wordIndex] || words[0] || {};
    var path = 'assets/audio/session-w' + (Number(wordIndex) + 1) + '-' + Date.now() + '.mp3';
    media.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [];
      var recorder = new global.MediaRecorder(stream);
      ST.recorder = recorder;
      recorder.ondataavailable = function (ev) { if (ev.data) chunks.push(ev.data); };
      recorder.onstop = function () {
        try { stream.getTracks().forEach(function (track) { track.stop(); }); } catch (e) {}
        var blob = new global.Blob(chunks, { type: 'audio/mpeg' });
        var reader = new global.FileReader();
        reader.onload = function () {
          var raw = str(reader.result);
          var b64 = raw.indexOf(',') >= 0 ? raw.slice(raw.indexOf(',') + 1) : raw;
          ST.pendingClip = { path: path, base64: b64, word: str(word.w) };
          var preview = byId('recPreviewAudio');
          if (preview && global.URL && global.URL.createObjectURL) {
            try { preview.src = global.URL.createObjectURL(blob); } catch (e) {}
          }
          msg(t('studioRecord') + ' ✓ ' + path, 'ok');
          cb(null, ST.pendingClip);
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
    }, function () {
      ST.recording = false;
      msg(t('studioRecord') + ' — microphone unavailable', 'bad');
      cb(new Error('mic_denied'));
    });
    return { path: path };
  }
  function commitClip(token, cb) {
    cb = cb || noop;
    if (!ST.pendingClip) { cb(new Error('no_clip')); return false; }
    if (!sync() || !sync().commitClipFile) { cb(new Error('no_sync')); return false; }
    sync().commitClipFile(ST.pendingClip.path, ST.pendingClip.base64, 'Lecturer clip ' + ST.pendingClip.word, token, cb);
    return true;
  }

  /* ══ D-L6: the studio must catch up when sync boot lands ══════════════ */
  function onDataReady() {
    if (!ST.words.length) ST.words = sync() && sync().words ? sync().words() : [];
    var editor = byId('studioWords');
    if (editor && !str(editor.value)) {
      var words = ST.words.length ? ST.words : currentWords();
      if (words.length) editor.value = wordsToText(words);
    }
    setText(byId('costPreviewLine'), costPreviewLine());
    if (!ST.unlocked) mount();
    return true;
  }
  function onLangChange() { if (!ST.unlocked) return false; mount(); return true; }
  function refreshEditor() { return onDataReady(); }

  var Studio = {
    state: ST,
    mount: mount,
    init: mount,
    unlock: unlock,
    setup: setup,
    lock: lock,
    isUnlocked: isUnlocked,
    secrets: secrets,
    setEnvelope: setEnvelope,
    hasVault: hasVault,
    configEnvelope: configEnvelope,
    resolveEnvelope: resolveEnvelope,
    persistEnvelope: persistEnvelope,
    parseWords: parseWords,
    wordsToText: wordsToText,
    buildVersionPayload: buildVersionPayload,
    buildSessionPayload: buildSessionPayload,
    buildPublishPayloads: buildPublishPayloads,
    saveClassSettings: saveClassSettings,
    classSettingsSnapshot: classSettingsSnapshot,
    classSettingKeys: CLASS_SETTING_KEYS,
    voicePackPayload: voicePackPayload,
    publishChecklist: publishChecklist,
    nextSyncRev: nextSyncRev,
    openPublishPreview: openPublishPreview,
    publishPreviewWords: publishPreviewWords,
    publish: publish,
    generateClips: generateClips,
    commitVoicePack: commitVoicePack,
    costPreview: costPreview,
    enrichWords: enrichWords,
    testAiEngine: testAiEngine,
    oneClickMasterSetup: oneClickMasterSetup,
    publishWordsAndVoice: publishWordsAndVoice,
    publishBundle: publishBundle,
    sealVaultNow: sealVaultNow,
    parseBulkWords: parseBulkWords,
    setStudioWords: setStudioWords,
    paintWordManager: paintWordManager,
    paintMasterSteps: paintMasterSteps,
    aiProviderName: aiProviderName,
    aiProviderKey: aiProviderKey,
    detectProvider: detectProvider,
    providers: AI_PROVIDERS,
    bootstrapPin: BOOTSTRAP_PIN,
    bindAutoLock: bindAutoLock,
    pinDotCount: pinDotCount,
    costPreviewLine: costPreviewLine,
    guideSteps: guideSteps,
    loadVoicePack: loadVoicePack,
    fetchSubscription: fetchSubscription,
    checkQuota: checkQuota,
    quotaError: quotaError,
    looksLikeElevenKey: looksLikeElevenKey,
    tierWarning: tierWarning,
    saveKeys: saveKeys,
    writeLayerOne: writeLayerOne,
    layerOneVault: layerOneVault,
    layerOneEnvelope: layerOneEnvelope,
    healFromLayerOne: healFromLayerOne,
    paintVaultBadge: paintVaultBadge,
    audioForWord: audioForWord,
    vaultBadgeVisible: vaultBadgeVisible,
    testElevenLabsKey: testElevenLabsKey,
    testGitHubToken: testGitHubToken,
    refreshQuota: refreshQuota,
    recordClip: recordClip,
    toggleRecord: toggleRecord,
    stopRecord: stopRecord,
    commitClip: commitClip,
    elevenUrl: elevenUrl,
    voiceId: VOICE_ID,
    voiceModel: VOICE_MODEL,
    appVersion: appVersion,
    appendPin: appendPin,
    backspacePin: backspacePin,
    setPinValue: setPinValue,
    pinValue: pinValue,
    paintPinDots: paintPinDots,
    paintQuickButton: paintQuickButton,
    toggleSecretField: toggleSecretField,
    onDataReady: onDataReady,
    onLangChange: onLangChange,
    refreshEditor: refreshEditor,
    message: function () { return ST.message; },
    testStatusText: function () { return ST.testStatus; }
  };

  SDP.Studio = Studio;

  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { mount(); });
    else mount();
    /* D-L6: sync boot can finish after the studio mounts. */
    doc.addEventListener('sdp:ready', function () { try { onDataReady(); } catch (e) {} }, false);
  }
})(typeof window !== 'undefined' ? window : this);
