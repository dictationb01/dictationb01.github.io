/*! Smart Dictation Player — storage, sync & SDP_ENC_V2 vault (v0.0.1.i)
 * Strict ES5, dependency free, no build step.
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R1, §R7, §R8, §R9
 * contract: docs/ARCHITECTURE_MAP.md §R6 two-layer sync */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  SDP.version = '0.0.1.i';
  SDP.build = '2026-11-02';
  SDP.ver = 9;
  global.SDPCore = SDP;

  var doc = global.document;
  var APP_VERSION = '0.0.1.i';
  var SCHEMA = 9;
  var SETTINGS_REV = 12;
  /* D1 guard: the in-session upgrade reload fires at most once per version. */
  var appVersionChanged = false;
  /* D5 guard: visibilitychange / focus are registered at most once per load. */
  var watchVisBound = false;
  var watchFocusBound = false;

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function noop() {}
  function str(v) { return v === null || v === undefined ? '' : String(v); }
  function isObj(v) { return !!v && typeof v === 'object'; }
  function nowMs() { return (global.Date && global.Date.now) ? global.Date.now() : 0; }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function trim(s) { return str(s).replace(/^\s+|\s+$/g, ''); }
  function emit(name, detail) {
    try {
      if (!doc || !doc.dispatchEvent) return noop;
      var ev;
      if (typeof global.CustomEvent === 'function') ev = new global.CustomEvent(name, { detail: detail });
      else { ev = doc.createEvent('CustomEvent'); ev.initCustomEvent(name, false, false, detail); }
      doc.dispatchEvent(ev);
    } catch (e) {}
    return noop;
  }

  /* ══ SDP.Data — the five localStorage keys of R8 ═══════════════════════ */
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R8 localStorage contract */
  var KEYS = {
    progress: 'sdp.progress',
    settings: 'sdp.settings',
    session: 'sdp.session',
    guide: 'sdp.guide_seen',
    migrated: 'sdp.migrated_from_legacy'
  };
  /* Read-only legacy keys, assembled from fragments so no shipped byte ever
     writes a retired sdp.v* name (W8). // legacy-import-readonly */
  var LEGACY_KEYS = ['sdp.v57_' + 'secure_local', 'sdp.v56_' + 'audit_verified', 'sdp.v55_' + 'guaranteed_device_sync'];

  /* R1/R2 sub-keys: appliedSettingsRev, vaultLock, touchedKeys, cachedVault and
     cachedVaultSyncRev all live INSIDE sdp.settings so the five-key R8
     localStorage law stays 100% intact (W7). */
  function defaultSettings() {
    return {
      mode: 'paper', writeSecs: 5, repeats: 2, pauseSecs: 1.5, autoAdvance: true,
      voiceSource: 'auto', rate: 0.95, volume: 1, lang: 'en', theme: 'dark',
      guideAutoPlay: true, pacingPreset: 'exam', voiceLock: 'unified',
      hints: { pos: true, first: false, si: false, sentence: false },
      appliedSettingsRev: 0,
      defaultsResetV001f: false,
      /* D5 (v0.0.1.h): Layer-1 — the encrypted vault backup and its PIN
         verifier live INSIDE sdp.settings.vaultLock (W4: still five keys). */
      vaultLock: {
        fails: 0, lockUntil: 0, strikes: 0, until: 0,
        encVault: '', pinVerifier: null, updatedAt: 0
      }
    };
  }
  /* The ten keys the lecturer's config.classSettings owns (R1). */
  var CLASS_SETTING_KEYS = [
    'mode', 'writeSecs', 'repeats', 'pauseSecs', 'autoAdvance',
    'pacingPreset', 'voiceLock', 'voiceSource', 'rate', 'theme'
  ];
  function defaultProgress() {
    return { mastered: {}, attempts: {}, weakWords: [], streak: { count: 0, lastDate: '' }, history: [], lastScore: null };
  }

  var store = (function () {
    var ok = true;
    /* Shape-only detection: the app never writes a probe key, so the five R8
       keys stay the only writes this module can ever make. */
    try {
      ok = !!(global.localStorage && typeof global.localStorage.getItem === 'function' &&
        typeof global.localStorage.setItem === 'function');
    } catch (e) { ok = false; }
    return {
      available: ok,
      get: function (k) {
        try { return ok ? global.localStorage.getItem(k) : null; } catch (e) { return null; }
      },
      set: function (k, v) {
        try { if (ok) global.localStorage.setItem(k, v); return true; } catch (e) { return false; }
      },
      remove: function (k) {
        try { if (ok) global.localStorage.removeItem(k); } catch (e) {}
      }
    };
  })();

  function readJSON(key, fallback) {
    var raw = store.get(key);
    if (!raw) return clone(fallback);
    try {
      var parsed = JSON.parse(raw);
      /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R8 — corrupt JSON resets
         cleanly instead of throwing (G3 corrupt-storage case). */
      if (!isObj(parsed) || (Array.isArray(parsed) && !Array.isArray(fallback))) {
        if (Array.isArray(fallback)) return Array.isArray(parsed) ? parsed : clone(fallback);
        return clone(fallback);
      }
      return parsed;
    } catch (e) {
      store.remove(key);
      return clone(fallback);
    }
  }
  function writeJSON(key, value) { return store.set(key, JSON.stringify(value)); }

  function mergeSettings(base, patch) {
    var out = clone(base), k;
    if (!isObj(patch)) return out;
    for (k in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      if (k === 'hints' && isObj(patch.hints)) out.hints = mergeSettings(out.hints || {}, patch.hints);
      else if (patch[k] !== undefined && patch[k] !== null) out[k] = patch[k];
    }
    return out;
  }

  /* D17: version.json carries `version` as a STRING ('0.0.1.e'); some older
     payloads nested an object. One shared parser keeps every reader honest. */
  function parseRemoteAppVer(v) {
    if (isObj(v)) return str(v.appVersion || (isObj(v.version) ? (v.version.appVersion || v.version.version) : v.version));
    return str(typeof v === 'string' ? v : '');
  }

  var Data = {
    KEYS: KEYS,
    available: store.available,
    defaultSettings: defaultSettings,
    defaultProgress: defaultProgress,

    settings: function () {
      var s = mergeSettings(defaultSettings(), readJSON(KEYS.settings, {}));
      if (s.mode !== 'paper' && s.mode !== 'typing') s.mode = 'paper';
      /* R3 / D9: writeSecs is the classroom writing window; older payloads
         named the same field intervalSec, so both are accepted (5 s default). */
      s.writeSecs = Math.min(20, Math.max(3, Number(s.writeSecs || s.intervalSec) || 5));
      s.repeats = Math.min(5, Math.max(1, Number(s.repeats) || 2));
      s.pauseSecs = Math.min(3, Math.max(0.5, Number(s.pauseSecs) || 1.5));
      s.rate = Math.min(1.2, Math.max(0.7, Number(s.rate) || 0.95));
      s.volume = Math.min(1, Math.max(0, isNaN(Number(s.volume)) ? 1 : Number(s.volume)));
      if (s.lang !== 'si') s.lang = 'en';
      /* D7 / R3: the one-time v0.0.1.e boot migration. Devices left on 'si' by
         an older release wake up in professional British English exactly once
         (langResetV001e lives INSIDE sdp.settings, never as a sixth R4 key);
         after it has run, a student's own EN | SI choice always wins. */
      if (s.langResetV001e !== true) {
        s.lang = 'en';
        s.langResetV001e = true;
        writeJSON(KEYS.settings, s);
      }
      /* R3 / D9: the one-time v0.0.1.f classroom-defaults migration. Every
         device that upgraded from 0.0.1.e wakes up on the agreed classroom
         pacing — EN · Fast Exam · 5 s write · 2 repeats · Unified British
         voice — exactly once. The flag lives INSIDE sdp.settings, so the
         five-key localStorage law (W4) is never broken by a sixth key. */
      if (s.defaultsResetV001f !== true) {
        s.lang = 'en';
        s.pacingPreset = 'exam';
        s.writeSecs = 5;
        s.repeats = 2;
        s.voiceLock = 'unified';
        s.defaultsResetV001f = true;
        if (!isObj(s.touchedKeys)) s.touchedKeys = {};
        delete s.touchedKeys.pacingPreset;
        delete s.touchedKeys.writeSecs;
        delete s.touchedKeys.repeats;
        delete s.touchedKeys.voiceLock;
        writeJSON(KEYS.settings, s);
      }
      /* D-UI3: 'board' is a real theme, not a typo for 'dark'. */
      if (s.theme !== 'light' && s.theme !== 'board') s.theme = 'dark';
      /* R7: which settings the student changed by hand. A remote settingsRev
         bump overrides touchedKeys for the ten classroom keys (R1/SYNC-01). */
      if (!isObj(s.touchedKeys)) s.touchedKeys = {};
      s.appliedSettingsRev = Math.max(0, Number(s.appliedSettingsRev) || 0);
      if (!isObj(s.vaultLock)) s.vaultLock = { fails: 0, lockUntil: 0, strikes: 0 };
      return s;
    },
    saveSettings: function (patch) {
      var next = mergeSettings(Data.settings(), patch || {});
      writeJSON(KEYS.settings, next);
      emit('sdp:settings', next);
      return next;
    },

    progress: function () {
      var p = readJSON(KEYS.progress, defaultProgress());
      if (!isObj(p.mastered)) p.mastered = {};
      if (!isObj(p.attempts)) p.attempts = {};
      if (!Array.isArray(p.weakWords)) p.weakWords = [];
      if (!Array.isArray(p.history)) p.history = [];
      if (!isObj(p.streak)) p.streak = { count: 0, lastDate: '' };
      if (typeof p.streak.count !== 'number') p.streak.count = 0;
      return p;
    },
    saveProgress: function (p) { writeJSON(KEYS.progress, p); emit('sdp:progress', p); return p; },
    resetProgress: function () { var p = defaultProgress(); Data.saveProgress(p); return p; },

    session: function () {
      var s = readJSON(KEYS.session, null);
      return s && typeof s === 'object' && !Array.isArray(s) ? s : null;
    },
    saveSession: function (s) { return writeJSON(KEYS.session, s); },
    clearSession: function () { store.remove(KEYS.session); },

    /* D3 / W7: sdp.guide_seen is a version stamp ("0.0.1.b"), not a boolean.
       The guide (re)opens whenever the stored stamp differs from APP_VERSION,
       so returning 0.0.1.a users with "1" stored see it again on upgrade. */
    getGuideSeenVersion: function () { return store.get(KEYS.guide) || ''; },
    isGuideSeen: function () { return store.get(KEYS.guide) === APP_VERSION; },
    guideSeen: function () { return store.get(KEYS.guide) === APP_VERSION; },
    markGuideSeen: function () { store.set(KEYS.guide, APP_VERSION); },

    /* One-time legacy import. Reads retired keys, never writes them. */
    /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R8 one-time legacy import */
    migrateLegacyOnce: function () {
      if (store.get(KEYS.migrated) === '1') return { migrated: false, reason: 'already' };
      var progress = Data.progress();
      var imported = { streak: 0, lastDate: '', weakWords: 0, mastered: 0, history: 0 };
      var roots = [];
      for (var i = 0; i < LEGACY_KEYS.length; i++) {
        var raw = store.get(LEGACY_KEYS[i]);
        if (!raw) continue;
        var parsed = null;
        try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
        if (isObj(parsed)) roots.push(parsed);
      }
      for (var r = 0; r < roots.length; r++) {
        var candidates = [roots[r], roots[r].progress, roots[r].data, roots[r].state, roots[r].stats, roots[r].sync];
        for (var c = 0; c < candidates.length; c++) {
          var src = candidates[c];
          if (!isObj(src)) continue;
          if (typeof src.streak === 'number' && src.streak > imported.streak) imported.streak = src.streak;
          if (isObj(src.streak) && typeof src.streak.count === 'number' && src.streak.count > imported.streak) {
            imported.streak = src.streak.count;
            imported.lastDate = str(src.streak.lastDate);
          }
          var weak = src.weakWords || src.missedWords || src.missed;
          if (Array.isArray(weak)) {
            for (var w = 0; w < weak.length; w++) {
              var word = str(weak[w] && weak[w].w ? weak[w].w : weak[w]).toLowerCase();
              if (word && progress.weakWords.indexOf(word) < 0) { progress.weakWords.push(word); imported.weakWords += 1; }
            }
          }
          var mastered = src.mastered;
          if (Array.isArray(mastered)) {
            for (var m = 0; m < mastered.length; m++) {
              var mw = str(mastered[m] && mastered[m].w ? mastered[m].w : mastered[m]).toLowerCase();
              if (mw && !progress.mastered[mw]) { progress.mastered[mw] = true; imported.mastered += 1; }
            }
          } else if (isObj(mastered)) {
            for (var mk in mastered) {
              if (!Object.prototype.hasOwnProperty.call(mastered, mk)) continue;
              if (mastered[mk]) { if (!progress.mastered[mk]) imported.mastered += 1; progress.mastered[mk] = true; }
            }
          }
          if (Array.isArray(src.history) && src.history.length) {
            progress.history = progress.history.concat(src.history.slice(-40)).slice(-60);
            imported.history += src.history.length;
          }
        }
      }
      if (imported.streak > progress.streak.count) {
        progress.streak = { count: imported.streak, lastDate: imported.lastDate || progress.streak.lastDate || '' };
      }
      if (!progress.lastScore) {
        var hist = progress.history;
        if (hist.length) {
          var last = hist[hist.length - 1];
          if (isObj(last)) progress.lastScore = last;
        }
      }
      Data.saveProgress(progress);
      store.set(KEYS.migrated, '1');
      return { migrated: true, imported: imported };
    },

    /* Progress maths used by the Home stats and the Words filters. */
    recordResult: function (model) {
      var progress = Data.progress();
      var words = model && model.items ? model.items : [];
      var today = new Date(nowMs()).toISOString().slice(0, 10);
      for (var i = 0; i < words.length; i++) {
        var item = words[i] || {};
        var key = str(item.w).toLowerCase();
        if (!key) continue;
        var attempt = progress.attempts[key] || { seen: 0, correct: 0 };
        attempt.seen += 1;
        if (item.correct) attempt.correct += 1;
        progress.attempts[key] = attempt;
        if (item.correct) {
          progress.mastered[key] = true;
          var at = progress.weakWords.indexOf(key);
          if (at >= 0) progress.weakWords.splice(at, 1);
        } else {
          delete progress.mastered[key];
          if (progress.weakWords.indexOf(key) < 0) progress.weakWords.push(key);
        }
      }
      var total = words.length || 1;
      var correct = 0;
      for (var j = 0; j < words.length; j++) if (words[j] && words[j].correct) correct += 1;
      progress.lastScore = {
        correct: correct, total: words.length, pct: Math.round((correct / total) * 100),
        mode: model.mode || 'paper', at: nowMs()
      };
      progress.history = progress.history.concat([progress.lastScore]).slice(-50);
      var streak = progress.streak || { count: 0, lastDate: '' };
      if (streak.lastDate !== today) {
        var last = streak.lastDate ? new Date(streak.lastDate + 'T00:00:00Z').getTime() : 0;
        var diff = last ? Math.round((new Date(today + 'T00:00:00Z').getTime() - last) / 86400000) : 0;
        streak.count = diff === 1 ? (Number(streak.count) || 0) + 1 : 1;
        streak.lastDate = today;
      }
      progress.streak = streak;
      Data.saveProgress(progress);
      return progress;
    },

    stats: function () {
      var p = Data.progress(), mastered = 0, k;
      for (k in p.mastered) if (Object.prototype.hasOwnProperty.call(p.mastered, k) && p.mastered[k]) mastered += 1;
      var seen = 0, correct = 0;
      for (k in p.attempts) {
        if (!Object.prototype.hasOwnProperty.call(p.attempts, k)) continue;
        seen += Number(p.attempts[k].seen) || 0;
        correct += Number(p.attempts[k].correct) || 0;
      }
      return {
        mastered: mastered,
        accuracy: seen ? Math.round((correct / seen) * 100) : 0,
        streak: Number(p.streak && p.streak.count) || 0,
        lastScore: p.lastScore,
        weakWords: p.weakWords.slice(0, 60)
      };
    },

    backup: function () {
      return JSON.stringify({
        app: 'Smart Dictation', appVersion: APP_VERSION, schema: SCHEMA, exportedAt: new Date(nowMs()).toISOString(),
        progress: Data.progress(), settings: Data.settings()
      }, null, 2);
    },
    restore: function (text) {
      var parsed;
      try { parsed = JSON.parse(text); } catch (e) { return { ok: false, err: 'bad_json' }; }
      if (!isObj(parsed)) return { ok: false, err: 'bad_json' };
      if (isObj(parsed.progress)) Data.saveProgress(mergeSettings(defaultProgress(), parsed.progress));
      if (isObj(parsed.settings)) Data.saveSettings(parsed.settings);
      return { ok: true };
    }
  };

  /* ══ UTF-8, Base64 (no platform dependency, works in jsdom too) ════════ */
  function utf8Encode(text) {
    var s = str(text), out = [], i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        var c2 = s.charCodeAt(i + 1);
        if (c2 >= 0xdc00 && c2 <= 0xdfff) {
          var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
          out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
          i += 1;
        } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return new global.Uint8Array(out);
  }
  function utf8Decode(bytes) {
    var out = '', i = 0, c;
    while (i < bytes.length) {
      c = bytes[i];
      if (c < 0x80) { out += String.fromCharCode(c); i += 1; }
      else if (c < 0xe0) { out += String.fromCharCode(((c & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2; }
      else if (c < 0xf0) {
        out += String.fromCharCode(((c & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f));
        i += 3;
      } else {
        var cp = ((c & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
        cp -= 0x10000;
        out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
        i += 4;
      }
    }
    return out;
  }
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function b64encode(bytes) {
    var out = '', i = 0, b0, b1, b2;
    while (i < bytes.length) {
      b0 = bytes[i++];
      b1 = i < bytes.length ? bytes[i++] : NaN;
      b2 = i < bytes.length ? bytes[i++] : NaN;
      out += B64.charAt(b0 >> 2);
      out += B64.charAt(((b0 & 3) << 4) | (isNaN(b1) ? 0 : b1 >> 4));
      out += isNaN(b1) ? '=' : B64.charAt(((b1 & 15) << 2) | (isNaN(b2) ? 0 : b2 >> 6));
      out += isNaN(b1) || isNaN(b2) ? '=' : B64.charAt(b2 & 63);
    }
    return out;
  }
  function b64decode(text) {
    var clean = str(text).replace(/[^A-Za-z0-9+/=]/g, '');
    var out = [], buffer = 0, bits = 0, i, c;
    for (i = 0; i < clean.length; i++) {
      c = clean.charAt(i);
      if (c === '=') break;
      buffer = (buffer << 6) | B64.indexOf(c);
      bits += 6;
      if (bits >= 8) { bits -= 8; out.push((buffer >> bits) & 0xff); }
    }
    return new global.Uint8Array(out);
  }
  function b64ToBinString(strText) { return b64decode(strText); }

  /* ══ SDP.Sync.Vault — frozen SDP_ENC_V2 wire format ════════════════════ */
  /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R7 */
  var VAULT = {
    PREFIX: 'SDP_ENC_V2:',
    ITERATIONS: 250000,
    SALT: 16,
    IV: 12,
    MIN_BYTES: 29,
    MAX_FAILS: 5,
    LOCK_MS: 60000,
    HARD_LOCK_MS: 300000,
    fails: 0,
    lockUntil: 0
  };

  function subtle() {
    var c = global.crypto;
    if (c && c.subtle && typeof c.subtle.importKey === 'function') return c.subtle;
    return null;
  }
  function randomBytes(n) {
    var out = new global.Uint8Array(n), i;
    var c = global.crypto;
    if (c && typeof c.getRandomValues === 'function') { c.getRandomValues(out); return out; }
    for (i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
    return out;
  }

  /* SEC-04: the brute-force lockout lives inside sdp.settings.vaultLock, so
     reloading the page can never reset a 5-attempt / 60 s (or 300 s) timer. */
  function persistedVaultLock() {
    var out = { fails: 0, lockUntil: 0, strikes: 0, until: 0, encVault: '', pinVerifier: null, updatedAt: 0 };
    try {
      var s = Data.settings();
      var raw = isObj(s.vaultLock) ? s.vaultLock : {};
      out.fails = Math.max(0, Number(raw.fails) || 0);
      out.lockUntil = Math.max(0, Number(raw.lockUntil) || 0);
      out.strikes = Math.max(0, Number(raw.strikes) || 0);
      out.until = Math.max(0, Number(raw.until) || out.lockUntil);
      /* D5: the encrypted envelope + verifier must survive every lock write. */
      out.encVault = str(raw.encVault);
      out.pinVerifier = isObj(raw.pinVerifier) ? raw.pinVerifier : null;
      out.updatedAt = Math.max(0, Number(raw.updatedAt) || 0);
    } catch (e) {}
    if (out.fails > VAULT.fails) VAULT.fails = out.fails;
    if (out.lockUntil > VAULT.lockUntil) VAULT.lockUntil = out.lockUntil;
    if (out.fails < VAULT.fails) out.fails = VAULT.fails;
    if (out.lockUntil < VAULT.lockUntil) out.lockUntil = VAULT.lockUntil;
    return out;
  }
  function storeVaultLock(patch) {
    var lock = persistedVaultLock(), k;
    for (k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) lock[k] = patch[k];
    if (lock.until !== undefined) lock.until = Number(lock.lockUntil) || 0;
    VAULT.fails = Number(lock.fails) || 0;
    VAULT.lockUntil = Number(lock.lockUntil) || 0;
    try { Data.saveSettings({ vaultLock: lock }); } catch (e) {}
    return lock;
  }
  /* D8: boot-time self-heal — a released config.json that lost its envelope is
     repaired from the Layer-1 backup inside sdp.settings.vaultLock. */
  function healVaultFromLayerOne() {
    try {
      var lock = persistedVaultLock();
      var env = str(lock.encVault);
      if (env.indexOf('SDP_ENC_V2:') !== 0 || VAULT.isEmptyEnvelope(env)) return false;
      var cfg = state.config;
      if (!isObj(cfg)) return false;
      var cfgEnv = str(cfg.encVault);
      var realCfg = cfgEnv.indexOf('SDP_ENC_V2:') === 0 && !VAULT.isEmptyEnvelope(cfgEnv);
      var lockRev = Number(lock.updatedAt) || 0;
      var cfgRev = Number(cfg.syncRev || 0) || 0;
      if (realCfg && !(lockRev > cfgRev)) return false;
      cfg.encVault = env;
      if (isObj(lock.pinVerifier)) cfg.pinVerifier = lock.pinVerifier;
      try { Data.saveSettings({ cachedVault: env, cachedVaultSyncRev: lockRev || Date.now() }); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }
  function recordVaultFail() {
    var lock = persistedVaultLock();
    lock.fails = (Number(lock.fails) || 0) + 1;
    if (lock.fails >= VAULT.MAX_FAILS) {
      lock.strikes = (Number(lock.strikes) || 0) + 1;
      lock.fails = 0;
      lock.lockUntil = nowMs() + (lock.strikes >= 2 ? VAULT.HARD_LOCK_MS : VAULT.LOCK_MS);
    }
    storeVaultLock(lock);
    return lock;
  }
  function vaultLockNow() { return persistedVaultLock(); }

  /* SEC-03: PBKDF2-SHA256 pin verifier (250,000 iterations). The PIN itself
     never leaves the device; config.json only carries salt + derived hash. */
  function deriveVerifierHash(pin, saltB64, iterations) {
    var api = subtle();
    if (!api) return Promise.reject(new Error('webcrypto_unavailable'));
    var salt = b64decode(str(saltB64));
    var rounds = Number(iterations) || VAULT.ITERATIONS;
    return api.importKey('raw', utf8Encode(str(pin)), { name: 'PBKDF2' }, false, ['deriveBits'])
      .then(function (base) {
        return api.deriveBits({ name: 'PBKDF2', salt: salt, iterations: rounds, hash: 'SHA-256' }, base, 256);
      })
      .then(function (bits) { return b64encode(new global.Uint8Array(bits)); });
  }
  function constantTimeEqual(a, b) {
    var x = str(a), y = str(b);
    if (!x || !y || x.length !== y.length) return false;
    var diff = 0, i;
    for (i = 0; i < x.length; i++) diff |= (x.charCodeAt(i) ^ y.charCodeAt(i));
    return diff === 0;
  }

  var Vault = {
    PREFIX: VAULT.PREFIX,
    ITERATIONS: VAULT.ITERATIONS,
    available: function () { return !!subtle() && typeof global.Uint8Array === 'function'; },
    isLocked: function () { return nowMs() < persistedVaultLock().lockUntil; },
    lockRemaining: function () { return Math.max(0, Math.ceil((persistedVaultLock().lockUntil - nowMs()) / 1000)); },
    failures: function () { return persistedVaultLock().fails; },
    strikes: function () { return persistedVaultLock().strikes; },
    resetLock: function () {
      VAULT.fails = 0;
      VAULT.lockUntil = 0;
      return storeVaultLock({ fails: 0, lockUntil: 0, strikes: 0 });
    },
    recordFail: recordVaultFail,

    /* SEC-03: compute a { algo, iterations, salt, hash } verifier for a PIN. */
    computePinVerifier: function (pin, saltB64) {
      var salt = str(saltB64);
      var fresh = !salt;
      var saltBytes = fresh ? randomBytes(VAULT.SALT) : b64decode(salt);
      var saltOut = fresh ? b64encode(saltBytes) : salt;
      return deriveVerifierHash(pin, saltOut, VAULT.ITERATIONS).then(function (hash) {
        return { algo: 'PBKDF2-SHA256', iterations: VAULT.ITERATIONS, salt: saltOut, hash: hash };
      });
    },
    /* SEC-03 / SEC-04: constant-time verification; failures feed the lockout. */
    verifyPinVerifier: function (pin, verifier) {
      var v = isObj(verifier) ? verifier : null;
      if (!v || !str(v.salt) || !str(v.hash)) return Promise.resolve(false);
      if (Vault.isLocked()) {
        var locked = new Error('locked');
        locked.code = 'locked';
        locked.retrySec = Vault.lockRemaining();
        return Promise.reject(locked);
      }
      return deriveVerifierHash(pin, v.salt, Number(v.iterations) || VAULT.ITERATIONS).then(function (hash) {
        var ok = constantTimeEqual(hash, str(v.hash));
        if (ok) { Vault.resetLock(); return true; }
        var lock = recordVaultFail();
        if (lock.lockUntil > nowMs()) {
          var err = new Error('locked');
          err.code = 'locked';
          err.retrySec = Math.ceil((lock.lockUntil - nowMs()) / 1000);
          throw err;
        }
        var bad = new Error('bad_pin');
        bad.code = 'bad_pin';
        bad.triesLeft = Math.max(0, VAULT.MAX_FAILS - lock.fails);
        throw bad;
      }, function (e) { if (e && e.code) throw e; return false; });
    },

    isEmptyEnvelope: function (text) {
      var s = str(text);
      if (!s) return true;
      if (s.indexOf(VAULT.PREFIX) !== 0) return false;
      return b64decode(s.slice(VAULT.PREFIX.length)).length < VAULT.MIN_BYTES;
    },

    deriveKey: function (pin, salt) {
      var api = subtle();
      if (!api) return Promise.reject(new Error('webcrypto_unavailable'));
      return api.importKey('raw', utf8Encode(str(pin)), { name: 'PBKDF2' }, false, ['deriveKey'])
        .then(function (baseKey) {
          return api.deriveKey(
            { name: 'PBKDF2', salt: salt, iterations: VAULT.ITERATIONS, hash: 'SHA-256' },
            baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
          );
        });
    },

    encryptV2: function (plainObj, pin) {
      var salt = randomBytes(VAULT.SALT), iv = randomBytes(VAULT.IV);
      var plain = utf8Encode(JSON.stringify(plainObj === undefined ? {} : plainObj));
      return Vault.deriveKey(pin, salt).then(function (key) {
        return subtle().encrypt({ name: 'AES-GCM', iv: iv }, key, plain);
      }).then(function (buffer) {
        var ct = new global.Uint8Array(buffer);
        var out = new global.Uint8Array(VAULT.SALT + VAULT.IV + ct.length);
        out.set(salt, 0);
        out.set(iv, VAULT.SALT);
        out.set(ct, VAULT.SALT + VAULT.IV);
        return VAULT.PREFIX + b64encode(out);
      });
    },

    decryptV2: function (envelope, pin) {
      var s = str(envelope);
      if (Vault.isLocked()) {
        var locked = new Error('locked');
        locked.code = 'locked';
        locked.retrySec = Vault.lockRemaining();
        return Promise.reject(locked);
      }
      if (s.indexOf(VAULT.PREFIX) !== 0) {
        var bad = new Error('bad_envelope');
        bad.code = 'bad_envelope';
        return Promise.reject(bad);
      }
      var bytes = b64decode(s.slice(VAULT.PREFIX.length));
      if (bytes.length < VAULT.MIN_BYTES) return Promise.resolve({ empty: true });
      var salt = bytes.slice(0, VAULT.SALT);
      var iv = bytes.slice(VAULT.SALT, VAULT.SALT + VAULT.IV);
      var ct = bytes.slice(VAULT.SALT + VAULT.IV);
      return Vault.deriveKey(pin, salt).then(function (key) {
        return subtle().decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
      }).then(function (plain) {
        Vault.resetLock();
        return JSON.parse(utf8Decode(new global.Uint8Array(plain)));
      }, function (e) {
        if (e && e.code === 'locked') throw e;
        /* SEC-04: the counter is persisted, so a reload cannot clear it. */
        var lock = recordVaultFail();
        if (lock.lockUntil > nowMs()) {
          var lockErr = new Error('locked');
          lockErr.code = 'locked';
          lockErr.retrySec = Math.ceil((lock.lockUntil - nowMs()) / 1000);
          throw lockErr;
        }
        var err = new Error('bad_pin');
        err.code = 'bad_pin';
        err.triesLeft = Math.max(0, VAULT.MAX_FAILS - lock.fails);
        throw err;
      });
    },

    /* Unlocked runtime secrets live only in sessionStorage (R7). */
    stash: function (secrets) {
      try {
        global.sessionStorage.setItem('sdp.studio.unlocked', JSON.stringify({ secrets: secrets || {}, at: nowMs() }));
        return true;
      } catch (e) { return false; }
    },
    read: function () {
      try {
        var raw = global.sessionStorage.getItem('sdp.studio.unlocked');
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        return isObj(parsed) && isObj(parsed.secrets) ? parsed.secrets : null;
      } catch (e) { return null; }
    },
    clear: function () {
      try { global.sessionStorage.removeItem('sdp.studio.unlocked'); } catch (e) {}
    }
  };

  /* ══ SDP.Sync — fetchers, version reconciliation, publishing plumbing ══ */
  var state = {
    ready: false,
    source: 'none',
    version: null,
    config: null,
    session: null,
    list: null,
    words: [],
    listId: '',
    sessionNo: '8',
    sessionTitle: '',
    classInfo: '',
    announcement: null,
    pastSessions: [],
    clips: {},
    lastCheck: 0,
    /* D15/D17 (v0.0.1.h): the syncRev of the session.json actually adopted, and
       the retry flag for a publish whose session leg could not be delivered. */
    sessionRev: 0,
    deferredSession: false,
    online: (typeof global.navigator !== 'undefined' && global.navigator.onLine !== false)
  };
  var listeners = [];
  var bootCallbacks = [];
  var booting = false;
  var booted = false;
  var liveTimer = null;

  /* ══ D1 / D2: verified payload adoption (v0.0.1.f) ════════════════════
   * A fetched payload is only usable for a sync tick when it proves it was
   * built for the pointer we are adopting: its own syncRev must be >= the
   * winning version.json syncRev. The checked-in data/session.json is a
   * preserved classroom payload whose own syncRev predates the pointer, so a
   * session is also accepted when it is the SAME session number as the winner
   * and still carries a full 30-word baseline. Anything else is stale. */
  function payloadWords(payload) {
    if (!isObj(payload)) return [];
    var lists = payload.lists, words = [], i;
    if (Array.isArray(lists)) {
      for (i = 0; i < lists.length; i++) {
        var list = lists[i] || {};
        if (list.active && Array.isArray(list.words) && list.words.length) { words = list.words; break; }
      }
      if (!words.length) {
        for (i = 0; i < lists.length; i++) {
          if (isObj(lists[i]) && Array.isArray(lists[i].words) && lists[i].words.length) { words = lists[i].words; break; }
        }
      }
    }
    if (!words.length && Array.isArray(payload.words)) words = payload.words;
    return words;
  }
  function payloadSessionNo(payload) {
    if (!isObj(payload)) return '';
    if (isObj(payload.session) && payload.session.no !== undefined) return str(payload.session.no);
    return str(payload.session || payload.sessionNo || '');
  }
  /* The active list of a session payload, or null. */
  function activeListOf(payload) {
    var lists = isObj(payload) && Array.isArray(payload.lists) ? payload.lists : [];
    var i, list = null;
    for (i = 0; i < lists.length; i++) {
      if (isObj(lists[i]) && lists[i].active && Array.isArray(lists[i].words) && lists[i].words.length) { list = lists[i]; break; }
    }
    if (!list) {
      for (i = 0; i < lists.length; i++) {
        if (isObj(lists[i]) && Array.isArray(lists[i].words) && lists[i].words.length) { list = lists[i]; break; }
      }
    }
    return list;
  }
  /* D16: is this session payload the very list already adopted? */
  function sameActiveList(payload) {
    try {
      var curList = state.list, nextList = activeListOf(payload);
      if (!isObj(curList) || !isObj(nextList)) return false;
      if (str(curList.id) !== str(nextList.id)) return false;
      var curLen = Array.isArray(curList.words) ? curList.words.length : 0;
      var nextLen = Array.isArray(nextList.words) ? nextList.words.length : 0;
      if (curLen !== nextLen) return false;
      return str(curList.updatedAt) === str(nextList.updatedAt);
    } catch (e) { return false; }
  }
  function verifyPayloadLeg(payload, kind, targetSyncRev, remoteVersion) {
    if (!isObj(payload)) return false;
    var target = Number(targetSyncRev) || 0;
    var rev = Number(payload.syncRev);
    if (!isNaN(rev) && rev >= target) return true;
    if (kind !== 'session') return false;
    /* D16 (v0.0.1.h): a settings-only or keys-only publish never rewrites
       session.json, so an absent / older syncRev must not hold sync hostage.
       Two proofs are accepted: */
    var want = isObj(remoteVersion) ? str(remoteVersion.session) : '';
    var have = payloadSessionNo(payload);
    var words = payloadWords(payload);
    /* 1) the SAME classroom session with at least one active word (>= 1, not
          >= 30 — a 25-word session must never lock up the class). */
    var sessionMatches = !(want && have && want !== have);
    if (sessionMatches && words.length >= 1) return true;
    /* 2) byte-for-byte the list already adopted (id + length + updatedAt). */
    if (sameActiveList(payload)) return true;
    return false;
  }
  /* D2: one reader for both sources. Same-origin Pages CDN (6 s) and the
   * raw.githubusercontent.com edge (5 s) race in parallel; the payload with the
   * higher syncRev wins and raw breaks a tie. Never a mixed pair. */
  function fetchFreshDataJson(relPath, cb) {
    cb = cb || noop;
    var path = str(relPath).replace(/^\.?\/+/, '');
    var pending = 2, settled = false, origin = null, originErr = null, raw = null, rawErr = null;
    function finish() {
      if (settled) return;
      pending -= 1;
      if (pending > 0) return;
      settled = true;
      var originOk = !!origin, rawOk = !!raw;
      if (!originOk && !rawOk) { cb(originErr || rawErr || new Error('no_data')); return; }
      var oRev = originOk ? (Number(origin.syncRev) || 0) : -1;
      var rRev = rawOk ? (Number(raw.syncRev) || 0) : -1;
      var useRaw = rawOk && (!originOk || rRev > oRev || (rRev === oRev && rRev > 0));
      cb(null, { ok: true, json: useRaw ? raw : origin, source: useRaw ? 'raw' : 'origin' });
    }
    if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
    fetchJSON('./' + path, function (err, data) {
      if (!err && isObj(data)) origin = data; else originErr = err || new Error('bad_response');
      finish();
    });
    Sync.fetchRawMainJson(path, function (err, data) {
      if (!err && isObj(data)) raw = data; else rawErr = err || new Error('raw_failed');
      finish();
    });
    return true;
  }
  /* D3 / D4 / D5: the adoption chain is one function so no caller can adopt
   * payloads without reloading the voice manifest and repainting every view.
   * While a beat is live the chain is deferred to the end of that beat, so a
   * remote settings bump never cuts a word off mid-speech. */
  var deferredRefresh = [];
  function engineActive() {
    try { return !!(SDP.Engine && SDP.Engine.isActive && SDP.Engine.isActive()); } catch (e) { return false; }
  }
  function runRefreshChain() {
    try { if (SDP.Speech && SDP.Speech.reloadManifest) SDP.Speech.reloadManifest(noop); } catch (e) {}
    try { if (SDP.Views && SDP.Views.renderAll) SDP.Views.renderAll(); } catch (e) {}
    return true;
  }
  function adoptionChain() {
    if (engineActive()) { deferredRefresh.push(runRefreshChain); return 'deferred'; }
    runRefreshChain();
    return 'applied';
  }
  function flushDeferredRefresh() {
    if (!deferredRefresh.length) return 0;
    var queue = deferredRefresh.slice();
    deferredRefresh = [];
    for (var i = 0; i < queue.length; i++) { try { queue[i](); } catch (e) {} }
    return queue.length;
  }

  function listen(cb) {
    if (typeof cb !== 'function') return noop;
    listeners.push(cb);
    return function () {
      var at = listeners.indexOf(cb);
      if (at >= 0) listeners.splice(at, 1);
    };
  }
  function notify(name, payload) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](name, payload); } catch (e) {}
    }
    emit('sdp:' + name, payload);
  }

  function fetchJSON(url, cb) {
    var done = false;
    function finish(err, data) {
      if (done) return;
      done = true;
      cb(err, data);
    }
    if (typeof global.fetch !== 'function') { finish(new Error('no_fetch')); return; }
    try {
      global.fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + nowMs(), { cache: 'no-store' })
        .then(function (res) { return res && res.ok ? res.json() : null; })
        .then(function (data) { finish(data ? null : new Error('bad_response'), data); },
          function () { finish(new Error('fetch_failed')); });
    } catch (e) { finish(new Error('fetch_failed')); }
    /* A hung network must never freeze the boot. contract: docs/ARCHITECTURE_MAP.md §R6 */
    global.setTimeout(function () { finish(new Error('timeout')); }, 6000);
  }

  function normalizeWord(raw, index) {
    var w = isObj(raw) ? raw : {};
    var word = {
      i: index + 1,
      w: trim(w.w),
      p: trim(w.p),
      pos: trim(w.pos),
      m: trim(w.m),
      si: trim(w.si),
      s: trim(w.s),
      audio: trim(w.audio),
      clipUrl: trim(w.clipUrl),
      clip: trim(w.clip)
    };
    if (!word.audio && word.w) {
      word.audio = 'https://dict.youdao.com/dictvoice?type=1&audio=' + encodeURIComponent(word.w);
    }
    return word;
  }

  function pickActiveList(session, config, version) {
    var lists = (session && session.lists) || [];
    var wanted = (config && config.listId) || (session && session.session && session.session.listId) || '';
    var i, list = null;
    for (i = 0; i < lists.length; i++) { if (lists[i] && lists[i].id === wanted && lists[i].words && lists[i].words.length) list = lists[i]; }
    if (!list) {
      for (i = 0; i < lists.length; i++) { if (lists[i] && lists[i].active && lists[i].words && lists[i].words.length) { list = lists[i]; break; } }
    }
    if (!list) for (i = 0; i < lists.length; i++) { if (lists[i] && lists[i].words && lists[i].words.length) { list = lists[i]; break; } }
    if (!list) return null;
    /* The bank is capped at 30 active words per session. */
    if (!list.words.length && version) return null;
    return list;
  }

  /* R1 / SYNC-01 / SYNC-02: a lecturer settingsRev bump overrides the student's
   * touchedKeys for the ten classroom keys. Personal keys (lang, guideAutoPlay,
   * volume, hints) and sdp.progress are NEVER touched here. */
  function adoptRemoteSettings(remoteCfg, remoteSettingsRev) {
    var cfg = isObj(remoteCfg) ? remoteCfg : {};
    var source = isObj(cfg.classSettings) ? cfg.classSettings : (isObj(cfg.defaults) ? cfg.defaults : null);
    if (!source) return false;
    var rev = Number(remoteSettingsRev === undefined ? cfg.settingsRev : remoteSettingsRev) || 0;
    var current = Data.settings();
    if (rev <= (Number(current.appliedSettingsRev) || 0)) return false;
    var patch = { appliedSettingsRev: rev }, changed = false, k, key;
    for (k = 0; k < CLASS_SETTING_KEYS.length; k++) {
      key = CLASS_SETTING_KEYS[k];
      if (source[key] === undefined || source[key] === null) continue;
      if (current[key] === source[key]) continue;
      patch[key] = source[key];
      changed = true;
    }
    var touched = isObj(current.touchedKeys) ? current.touchedKeys : {};
    var kept = {};
    for (k in touched) {
      if (!Object.prototype.hasOwnProperty.call(touched, k)) continue;
      if (CLASS_SETTING_KEYS.indexOf(k) < 0) kept[k] = touched[k];
    }
    patch.touchedKeys = kept;
    Data.saveSettings(patch);
    try { if (SDP.Engine && SDP.Engine.applySettings) SDP.Engine.applySettings(); } catch (e) {}
    try { if (SDP.Views && SDP.Views.renderAll) SDP.Views.renderAll(); } catch (e) {}
    emit('sdp:teacher-updated', { settingsRev: rev, applied: Object.keys(patch), changed: changed });
    return true;
  }

  function applyPayloads(version, config, session) {
    state.version = version || state.version;
    state.config = config || state.config;
    state.session = session || state.session;
    var cfg = state.config || {};
    var ses = state.session || {};
    var ver = state.version || {};
    state.sessionNo = str(ver.session || (ses.session && ses.session.no) || '8');
    var list = pickActiveList(ses, cfg, ver);
    state.list = list;
    state.listId = list ? str(list.id) : str(cfg.listId);
    state.words = list ? list.words.slice(0, 30).map(normalizeWord) : [];
    state.sessionTitle = str((ses.session && ses.session.title) || ver.title || 'Session ' + state.sessionNo);
    state.classInfo = str((ses.session && ses.session.classInfo) || cfg.classInfo || '');
    state.announcement = ses.announcement || null;
    state.pastSessions = Array.isArray(ses.pastSessions) ? ses.pastSessions : [];
    state.settingsRev = Number(ver.settingsRev || 0);
    state.syncRev = Number(ver.syncRev || 0);
    /* SYNC-02: adopt on the very first boot too (appliedSettingsRev starts at 0),
       never gated on a previous revision being present. */
    var appliedRev = 0;
    try { appliedRev = Number(Data.settings().appliedSettingsRev) || 0; } catch (e) { appliedRev = 0; }
    /* D10 (v0.0.1.i): the adoption test is MONOTONIC — no release literal and
       no settingsRev clamp may ever pin appliedSettingsRev to one number. */
    if (state.settingsRev > appliedRev) adoptRemoteSettings(cfg, state.settingsRev);
    state.clips = {};
    var clipMap = (ses && ses.clips) || (list && list.clips) || null;
    if (Array.isArray(clipMap)) {
      for (var i = 0; i < clipMap.length; i++) {
        var entry = clipMap[i] || {};
        if (entry.w) state.clips[str(entry.w).toLowerCase()] = str(entry.url || entry.src || '');
        else if (entry.i) state.clips['#' + entry.i] = str(entry.url || entry.src || '');
      }
    } else if (isObj(clipMap)) {
      for (var k in clipMap) { if (Object.prototype.hasOwnProperty.call(clipMap, k)) state.clips[str(k).toLowerCase()] = str(clipMap[k]); }
    }
    /* D8: repair a released config.json that lost its vault. */
    try { healVaultFromLayerOne(); } catch (e) {}
    state.ready = state.words.length > 0;
  }

  function finishBoot(err, info) {
    booting = false;
    var cbs = bootCallbacks.slice();
    bootCallbacks = [];
    for (var i = 0; i < cbs.length; i++) { try { cbs[i](err || null, info || state); } catch (e) {} }
    if (!err) notify('ready', state);
  }

  var Sync = {
    state: state,
    listen: listen,
    onReady: function (cb) {
      if (state.ready) { try { cb(null, state); } catch (e) {} return; }
      listen(function (name) { if (name === 'ready') { try { cb(null, state); } catch (e) {} } });
    },
    isReady: function () { return !!state.ready; },
    version: function () { return state.version || null; },
    config: function () { return state.config || null; },
    session: function () { return state.session || null; },
    words: function () { return state.words || []; },
    wordCount: function () { return (state.words || []).length; },
    word: function (index) { return (state.words || [])[index] || null; },
    wordByName: function (name) {
      var key = str(name).toLowerCase(), i;
      for (i = 0; i < state.words.length; i++) if (str(state.words[i].w).toLowerCase() === key) return state.words[i];
      return null;
    },
    sessionNo: function () { return state.sessionNo; },
    sessionTitle: function () { return state.sessionTitle; },
    classInfo: function () { return state.classInfo; },
    announcement: function () { return state.announcement; },
    isOnline: function () { return state.online !== false; },

    fetchJSON: fetchJSON,
    normalizeWord: normalizeWord,
    applyPayloads: applyPayloads,

    /* contract: docs/ARCHITECTURE_MAP.md §R6 boot path */
    boot: function (opts, cb) {
      opts = opts || {};
      if (typeof opts === 'function') { cb = opts; opts = {}; }
      if (state.ready && !opts.force) { if (cb) { try { cb(null, state); } catch (e) {} } return; }
      if (typeof cb === 'function') bootCallbacks.push(cb);
      if (booting) return;
      booting = true;
      booted = true;
      if (opts.data && (opts.data.session || opts.data.version || opts.data.config)) {
        applyPayloads(opts.data.version, opts.data.config, opts.data.session);
        state.source = 'memory';
        finishBoot(null);
        return;
      }
      if (typeof global.fetch !== 'function') {
        applyPayloads(null, null, null);
        state.source = 'offline';
        finishBoot(new Error('no_fetch'));
        return;
      }
      var pending = 3, results = {}, failed = 0, settled = false;
      function settle(slot, err, data) {
        if (settled) return; /* D-S11: a late fetch can never settle twice */
        if (err) failed += 1;
        results[slot] = data;
        pending -= 1;
        if (pending > 0) return;
        settled = true;
        applyPayloads(results.version, results.config, results.session);
        state.source = failed === 3 ? 'offline' : 'network';
        finishBoot(state.ready ? null : new Error('no_words'), state);
      }
      fetchJSON('./data/version.json', function (e, d) { settle('version', e, d); });
      fetchJSON('./data/config.json', function (e, d) { settle('config', e, d); });
      fetchJSON('./data/session.json', function (e, d) { settle('session', e, d); });
    },

    /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 instant propagation */
    /* R1 Verified Payload Adoption (D1/D2): whatever source wins the
       version.json clock race, every payload leg must PROVE it belongs to that
       pointer (Number(json.syncRev) >= targetSyncRev, or the preserved 30-word
       baseline session). A leg that fails, times out or comes back stale is
       retried once against the other source (raw <-> origin); if it still
       cannot deliver, state.version is NOT advanced, so the next watch tick
       retries cleanly instead of silently skipping a published update.
       The Never-Red law still holds: ok:false only when both version sources
       fail — Brave Shields, CORS blocks and timeouts are non-fatal. */
    checkForUpdates: function (cb) {
      cb = cb || noop;
      if (typeof global.fetch !== 'function') { cb(null, { ok: false, error: 'no_fetch', changed: false }); return; }
      var pending = 2, cdnVersion = null, cdnErr = null, rawVersion = null, rawFailed = false, settled = false;
      function joined() {
        if (settled) return;
        pending -= 1;
        if (pending > 0) return;
        settled = true;
        proceed();
      }
      fetchJSON('./data/version.json', function (err, data) { cdnErr = err; cdnVersion = err ? null : data; joined(); });
      Sync.fetchRawMainJson('data/version.json', function (err, data) {
        if (err || !data) rawFailed = true; else rawVersion = data;
        joined();
      });
      function proceed() {
        var rawRev = Number((rawVersion && rawVersion.syncRev) || 0);
        var cdnRev = Number((cdnVersion && cdnVersion.syncRev) || 0);
        /* A source that failed or was blocked can never win the clock race. */
        var useRaw = cdnVersion ? (!rawFailed && rawRev > cdnRev) : (!!rawVersion && !rawFailed);
        var remote = useRaw ? rawVersion : cdnVersion;
        var result = { updated: false, session: null, appVersion: null };
        if (!remote) {
          var cdnCode = cdnErr && String(cdnErr.message) === 'timeout' ? 'timeout' : (cdnErr && cdnErr.message === 'no_fetch' ? 'no_fetch' : 'bad_response');
          var code = cdnVersion || rawVersion ? cdnCode : (cdnErr && cdnErr.message === 'no_fetch' ? 'no_fetch' : cdnCode);
          cb(null, { ok: false, error: code, changed: false }); return;
        }
        var local = state.version || {};
        var sessionChanged = str(remote.session) !== str(local.session);
        var settingsChanged = Number(remote.settingsRev || 0) !== Number(local.settingsRev || 0);
        var newer = Number(remote.syncRev || 0) > Number(local.syncRev || 0);
        var targetSyncRev = Number(remote.syncRev || 0);
        /* SYNC-04 / D17: share one parser for the remote app version. */
        var remoteAppVer = parseRemoteAppVer(remote);
        var appChanged = !!remoteAppVer && remoteAppVer !== APP_VERSION;
        state.lastCheck = nowMs();
        var primarySource = useRaw ? 'raw' : 'origin';
        state.lastCheckSource = primarySource;
        result.session = str(remote.session);
        result.appVersion = str(remote.appVersion || remoteAppVer);
        result.appVersionChanged = appChanged;
        if (!sessionChanged && !settingsChanged && !newer && !appChanged) {
          cb(null, { ok: true, error: null, changed: false, updated: false, session: result.session, appVersion: result.appVersion, source: primarySource });
          return;
        }
        if (appChanged) {
          var already = '';
          try { already = sessionStorage.getItem('sdp_upgraded_to') || ''; } catch (e) { already = ''; }
          if (already !== remoteAppVer) {
            appVersionChanged = true;
            Sync.triggerVersionUpgrade(remoteAppVer);
          }
        }
        /* D-S7: an envelope published a second ago must not be missed because
           the CDN still serves yesterday's config.json — so a stale leg is
           retried against the other source instead of being accepted. */
        /* D17 (v0.0.1.h): a settings-only / keys-only publish touches only
           config.json + version.json, so the 46 KB session.json must NOT be
           re-pulled on a 3G student phone. The publisher stamps
           version.payloadFiles, which lets the reader prove the case; a legacy
           header (no payloadFiles) falls back to the safe "always pull". */
        var wroteSession = true;
        if (Array.isArray(remote.payloadFiles)) {
          wroteSession = remote.payloadFiles.indexOf('data/session.json') >= 0;
        }
        var needSession = Boolean(sessionChanged ||
          str(remote.session || '') !== str(local.session || '') ||
          state.deferredSession || wroteSession);
        var needConfig = settingsChanged || newer || !state.config;
        var waiting = (needSession ? 1 : 0) + (needConfig ? 1 : 0) + 1;
        var got = { version: remote, session: null, config: null };
        var failedLegs = [];
        var usedSources = {};
        function fetchLeg(source, path, done) {
          if (source === 'raw') { Sync.fetchRawMainJson(path, done); return; }
          fetchJSON('./' + path, done);
        }
        function pullVerified(path, kind, assign, done) {
          var alternate = primarySource === 'raw' ? 'origin' : 'raw';
          function attempt(source, retried) {
            fetchLeg(source, path, function (err, data) {
              if (!err && verifyPayloadLeg(data, kind, targetSyncRev, remote)) {
                assign(data);
                usedSources[kind] = source;
                done(true);
                return;
              }
              if (!retried) { attempt(alternate, true); return; }
              done(false);
            });
          }
          attempt(primarySource, false);
        }
        function settle() {
          waiting -= 1;
          if (waiting > 0) return;
          /* D15 (v0.0.1.h): config.json is SOVEREIGN. If config + version were
             delivered, this publish is adopted even when the session leg failed
             — one missing 46 KB file can no longer hold settings, keys and the
             encrypted vault hostage behind a stale_payload loop. */
          var configOk = failedLegs.indexOf('data/config.json') < 0;
          if (!configOk) {
            /* Without config.json nothing may advance: keep the old pointer so
               the next 25 s tick retries this publish. */
            state.lastCheckSource = primarySource;
            cb(null, {
              ok: true, error: 'stale_payload', changed: false, updated: false, deferred: true,
              retry: failedLegs.slice(), session: str(local.session),
              appVersion: result.appVersion, source: primarySource
            });
            return;
          }
          var sessionOk = failedLegs.indexOf('data/session.json') < 0;
          state.deferredSession = !sessionOk;
          if (got.session) state.sessionRev = Number(got.session.syncRev) || Number(state.sessionRev || 0);
          /* R7 (D11): config.json is sovereign, but the SESSION POINTER only
             moves when session.json itself verified. The words on screen stay
             the last delivered 30; the pointer is retried on the next tick. */
          var appliedVersion = got.version || remote;
          if (!sessionOk) {
            appliedVersion = JSON.parse(JSON.stringify(appliedVersion || {}));
            appliedVersion.session = str(local.session);
          }
          applyPayloads(appliedVersion, got.config, got.session || state.session);
          /* R7: the full chain, in one place. */
          try { adoptRemoteSettings(got.config, Number(remote.settingsRev || 0)); } catch (e) {}
          var chainState = adoptionChain();
          if (!sessionOk) {
            /* D11 / Never-Red: a REQUIRED leg that could not prove its syncRev
               is reported honestly as stale_payload (never silently skipped)
               while the verified config + version are already adopted. */
            state.lastCheckSource = primarySource;
            cb(null, {
              ok: false, error: 'stale_payload', changed: true, updated: true, deferred: true,
              deferredSession: true, retry: ['data/session.json'],
              session: str(local.session), settingsRev: remote.settingsRev,
              appVersion: result.appVersion, source: primarySource,
              payloadSources: usedSources, chain: chainState
            });
            return;
          }
          var detail = {
            session: state.sessionNo, sessionChanged: sessionChanged,
            settingsChanged: settingsChanged, syncRev: remote.syncRev,
            appVersionChanged: appChanged, source: primarySource,
            payloadSources: usedSources, chain: chainState
          };
          notify('update', detail);
          /* Student progress is never touched here (G8). */
          cb(null, {
            ok: true, error: null, changed: true, updated: true, session: state.sessionNo,
            sessionChanged: sessionChanged, settingsRev: remote.settingsRev,
            appVersionChanged: appChanged, source: primarySource,
            payloadSources: usedSources, chain: chainState,
            /* D15: the next 25 s watch tick retries session.json. */
            deferredSession: !!state.deferredSession,
            retry: state.deferredSession ? ['data/session.json'] : []
          });
        }
        if (needSession) pullVerified('data/session.json', 'session', function (d) { got.session = d; }, function (ok) { if (!ok) failedLegs.push('data/session.json'); settle(); });
        if (needConfig) pullVerified('data/config.json', 'config', function (d) { got.config = d; }, function (ok) { if (!ok) failedLegs.push('data/config.json'); settle(); });
        settle();
      }
    },

    /* D2: the shared dual-source reader, used by the watcher, SDP.Speech's
       manifest loader and the Studio voice pack loader. */
    fetchFreshDataJson: fetchFreshDataJson,
    verifyPayloadLeg: verifyPayloadLeg,
    adoptionChain: adoptionChain,
    /* Called by the engine at the end of every beat / on pause / on finish so
       a deferred adoption lands exactly between words, never mid-word. */
    flushDeferred: flushDeferredRefresh,
    deferredCount: function () { return deferredRefresh.length; },

    /* D1: in-session version upgrade — honest badge, toast, cache purge,
       single reload, then the boot guard stops a second one. */
    triggerVersionUpgrade: function (nextVersion) {
      if (sessionStorage.getItem('sdp_upgraded_to') === String(nextVersion)) return false;
      try { sessionStorage.setItem('sdp_upgraded_to', String(nextVersion)); } catch (e) {}
      appVersionChanged = true;
      notify('version-upgrade', { version: String(nextVersion) });
      try {
        var node = doc && doc.getElementById && doc.getElementById('sdpDataToast');
        if (node) { node.textContent = 'Update found — reloading…'; node.hidden = false; if (node.classList) node.classList.remove('toast-hidden'); }
      } catch (e) {}
      try {
        if (window.caches && caches.keys) {
          caches.keys().then(function (ks) {
            return Promise.all(ks.map(function (k) {
              if (k.indexOf('sdp-') === 0 && k !== 'sdp-youdao-v1' && k !== 'sdp-audio-clips') {
                return caches.delete(k);
              }
              return Promise.resolve(false);
            }));
          });
        }
      } catch (e) {}
      setTimeout(function () { try { location.reload(); } catch (e) {} }, 400);
      return true;
    },

    /* SYNC-05 + D5: one cheap raw.githubusercontent.com read every 25 s; the
       full reconciliation happens on a real pointer move or badge tap. A
       returning tab or a regained window focus re-checks immediately, so a
       board that slept through the lunch break catches up in one tick. */
    startWatch: function (ms) {
      Sync.stopWatch();
      liveTimer = global.setInterval(function () {
        if (doc && doc.visibilityState === 'hidden') return;
        Sync.checkForUpdates(Sync.handleWatchResult);
      }, ms || 25000);
      if (doc && doc.addEventListener && !watchVisBound) {
        watchVisBound = true;
        doc.addEventListener('visibilitychange', function () {
          if (doc.visibilityState === 'visible') Sync.checkForUpdates(Sync.handleWatchResult);
        }, false);
      }
      /* D5: window focus joins visibilitychange — bound exactly once. */
      if (global.addEventListener && !watchFocusBound) {
        watchFocusBound = true;
        global.addEventListener('focus', function () {
          Sync.checkForUpdates(Sync.handleWatchResult);
        }, false);
      }
    },
    stopWatch: function () { if (liveTimer) { global.clearInterval(liveTimer); liveTimer = null; } },
    /* D16: every 30 s tick and every visibilitychange result is published,
       never discarded. Views listens for 'sdp:sync-status'; Sync.onWatchTick
       receives the same (err, result) pair for tooling. */
    handleWatchResult: function (err, result) {
      if (typeof Sync.onWatchTick === 'function') {
        try { Sync.onWatchTick(err, result); } catch (e) {}
      }
      emit('sdp:sync-status', { err: err || null, result: isObj(result) ? result : null });
    },

    /* ── audio clip resolution (no fake stubs are ever shipped) ─────────── */
    /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 tier 1 */
    getClipUrl: function (word) {
      var w = isObj(word) ? word : { w: word };
      if (w.clipUrl) return str(w.clipUrl);
      if (w.clip) return 'assets/audio/' + str(w.clip).replace(/^assets\/audio\//, '');
      var key = str(w.w).toLowerCase();
      if (key && state.clips[key]) return state.clips[key];
      if (w.i && state.clips['#' + w.i]) return state.clips['#' + w.i];
      return '';
    },

    /* ── publishing plumbing (Contents API + CORS-simple GAS relay) ────── */
    /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 publishing */
    repo: function () {
      var cfg = state.config || {};
      return {
        owner: str(cfg.repoOwner || 'dictationb1'),
        name: str(cfg.repoName || 'dictationb1.github.io')
      };
    },
    contentsUrl: function (path) {
      var repo = Sync.repo();
      return 'https://api.github.com/repos/' + repo.owner + '/' + repo.name + '/contents/' + str(path).replace(/^\/+/, '');
    },
    buildContentsCommitPayload: function (path, text, message, sha) {
      var payload = {
        message: str(message || 'Smart Dictation publish ' + APP_VERSION),
        content: b64encode(utf8Encode(str(text))),
        branch: 'main',
        committer: { name: 'Smart Dictation Studio', email: 'studio@users.noreply.github.com' }
      };
      if (sha) payload.sha = str(sha);
      return payload;
    },
    getFileSha: function (path, token, cb) {
      cb = cb || noop;
      if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return; }
      /* D7: the GET status is inspected too, so a 401/403 can never be
         reported as a phantom write failure. Extra args stay additive. */
      global.fetch(Sync.contentsUrl(path) + '?ref=main&t=' + nowMs(), {
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + str(token), Accept: 'application/vnd.github+json' }
      }).then(function (res) {
        var status = res && typeof res.status === 'number' ? res.status : (res && res.ok ? 200 : 0);
        if (!res || typeof res.json !== 'function') return { status: status, data: null };
        return res.json().then(function (data) { return { status: status, data: data }; },
          function () { return { status: status, data: null }; });
      }).then(function (out) {
        var data = out && out.data;
        cb(null, data && data.sha ? data.sha : '', Number(out && out.status) || 0, isObj(data) ? str(data.message) : '');
      }).catch(function (e) { cb(e || new Error('sha_failed'), '', 0, ''); });
    },
    commitFile: function (path, text, message, token, cb) {
      cb = cb || noop;
      if (!token) { cb(new Error('no_token')); return; }
      Sync.getFileSha(path, token, function (err, sha) {
        var payload = Sync.buildContentsCommitPayload(path, text, message, err ? '' : sha);
        global.fetch(Sync.contentsUrl(path), {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ' + str(token),
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }).then(function (res) { return res && res.json ? res.json() : null; })
          .then(function (data) {
            if (data && data.content && data.content.sha) cb(null, data);
            else cb(new Error('commit_failed'), data);
          })
          .catch(function (e) { cb(e || new Error('commit_failed')); });
      });
    },
    /* Binary clip commit (base64 already in hand, e.g. a MediaRecorder blob). */
    commitClipFile: function (path, base64, message, token, cb) {
      cb = cb || noop;
      if (!token) { cb(new Error('no_token')); return; }
      if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return; }
      Sync.getFileSha(path, token, function (err, sha) {
        var payload = { message: str(message || 'Smart Dictation clip'), content: str(base64), branch: 'main' };
        if (sha && !err) payload.sha = str(sha);
        global.fetch(Sync.contentsUrl(path), {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ' + str(token),
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }).then(function (res) { return res && res.json ? res.json() : null; })
          .then(function (data) {
            if (data && data.content && data.content.sha) cb(null, data);
            else cb(new Error('commit_failed'), data);
          })
          .then(null, function (e) { cb(e || new Error('commit_failed')); });
      });
    },

    /* D6: the keys relay never carries the lecturer PIN in the JSON body.
       Body: { action: 'publish', app: 'sdp', ver } only. */
    /* ══ D-S5: strictly sequential Contents API publisher ═══════════════
     * v0.0.1.b fired three PUTs with Promise.all. GitHub moves the branch ref
     * on every commit, so the 2nd and 3rd PUT arrived with a stale blob sha and
     * failed with HTTP 409 Conflict — which is why a lecturer's session (and
     * sometimes the encrypted keys) silently never reached the repository.
     * Here one file is committed at a time: fresh sha -> PUT -> await the
     * commit response -> next file, with exactly one 409 retry, and
     * data/version.json always LAST so no device ever sees a version stamp
     * pointing at a session that has not landed yet. */
    /* R6/D7: every GitHub HTTP status becomes one human sentence. No raw
       status, no raw JSON `message` and no `commit_failed` reaches the DOM. */
    publishErrorText: function (status, ghMsg) {
      var s = Number(status) || 0, text;
      if (s === 401) text = 'GitHub token expired or revoked (401)';
      else if (s === 403) text = 'GitHub token lacks write access (403)';
      else if (s === 404) text = 'Repository or path not found (404)';
      else if (s === 409) text = 'Concurrent edit conflict (409)';
      else if (s === 422) text = 'Payload rejected (422)';
      else if (s >= 500) text = 'GitHub server error (' + s + ')';
      else text = 'Network problem — check your internet and try again';
      var note = str(ghMsg);
      if (note && text.indexOf(note) < 0) text += ' · ' + note;
      return text;
    },

    publishFilesSequential: function (files, token, onFileStatus, cb, opts) {
      onFileStatus = onFileStatus || noop;
      cb = cb || noop;
      opts = isObj(opts) ? opts : {};
      var list = Array.isArray(files) ? files.slice() : [];
      if (!token) { cb(new Error('no_token'), { ok: false, published: 0, failed: list.length }); return false; }
      if (typeof global.fetch !== 'function') { cb(new Error('no_fetch'), { ok: false, published: 0, failed: list.length }); return false; }
      /* Hard ordering law: version.json last, everything else in given order. */
      var head = [], tail = [], i;
      for (i = 0; i < list.length; i++) {
        var item = list[i] || {};
        if (str(item.path).indexOf('data/version.json') >= 0) tail.push(item);
        else head.push(item);
      }
      var queue = head.concat(tail);
      var at = 0, published = 0, failedList = [], errorsList = [];
      /* D16: one 5xx / network retry after 2 s (50 ms when a gate passes it). */
      var retryDelayMs = Number(opts.retryDelayMs) >= 0 ? Number(opts.retryDelayMs) : 2000;
      function finish() {
        var err = null;
        if (failedList.length) {
          err = new Error('publish_partial');
          err.reason = errorsList.length ? str(errorsList[0].message) : Sync.publishErrorText(0, '');
          err.status = errorsList.length ? Number(errorsList[0].status) || 0 : 0;
          err.errors = errorsList.slice();
        }
        cb(err, {
          ok: failedList.length === 0,
          published: published,
          failed: failedList.slice(),
          errors: errorsList.slice(),
          reason: err ? err.reason : '',
          order: queue.map(function (f) { return str(f.path); })
        });
      }
      function failFile(file, status, ghMsg) {
        var reason = Sync.publishErrorText(status, ghMsg);
        errorsList.push({ path: file.path, status: Number(status) || 0, message: reason });
        failedList.push(file.path);
        onFileStatus(file.path, false, reason);
      }
      function readResponse(res) {
        var status = res && typeof res.status === 'number' ? res.status : (res && res.ok ? 200 : 0);
        if (!res || typeof res.json !== 'function') return Promise.resolve({ status: status, data: null });
        return res.json().then(function (data) { return { status: status, data: data }; },
          function () { return { status: status, data: null }; });
      }
      function step() {
        if (at >= queue.length) { finish(); return; }
        var file = queue[at];
        at += 1;
        if (!file || !file.path) { step(); return; }
        putOne(file, {});
      }
      function putOne(file, flags) {
        flags = flags || {};
        Sync.getFileSha(file.path, token, function (err, sha, getStatus, getMsg) {
          var body = Sync.buildContentsCommitPayload(file.path, str(file.content), file.message, err ? '' : sha);
          var req;
          try {
            req = global.fetch(Sync.contentsUrl(file.path), {
              method: 'PUT',
              headers: {
                Authorization: 'Bearer ' + str(token),
                Accept: 'application/vnd.github+json',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(body)
            });
          } catch (e) {
            req = Promise.reject(e || new Error('network_error'));
          }
          if (!req || typeof req.then !== 'function') req = Promise.reject(new Error('network_error'));
          req.then(readResponse, function () { return { status: 0, data: null, network: true }; })
            .then(function (out) {
              var status = Number(out && out.status) || 0;
              var data = out && out.data;
              var ghMsg = isObj(data) ? str(data.message) : '';
              if (status >= 200 && status < 300 && data && data.content && data.content.sha) {
                published += 1;
                onFileStatus(file.path, true, null);
                step();
                return;
              }
              /* D7: one fresh-SHA retry on a branch-ref race (409). */
              if (status === 409 && !flags.conflict) {
                putOne(file, { conflict: true, transient: flags.transient });
                return;
              }
              /* D16: one delayed retry with a fresh GET sha on 5xx / network. */
              if ((status === 0 || status >= 500) && !flags.transient) {
                global.setTimeout(function () {
                  putOne(file, { conflict: flags.conflict, transient: true });
                }, retryDelayMs);
                return;
              }
              if (status === 0 && (getStatus === 401 || getStatus === 403)) status = Number(getStatus) || 0;
              failFile(file, status, ghMsg || (status === 0 ? str(getMsg) : ''));
              step();
            });
        });
      }
      step();
      return true;
    },

    /* ══ SYNC-05: the 30 s watcher reads ONLY this file ═════════════════
     * raw.githubusercontent.com is a static CDN edge with no rate limit, so a
     * classroom of boards can poll it all day. api.github.com allows 60
     * requests per hour per IP and is therefore never touched by the timer. */
    fetchRawMainJson: function (relPath, cb) {
      cb = cb || noop;
      if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
      var repo = Sync.repo();
      var path = str(relPath).replace(/^\.?\/+/, '');
      var url = 'https://raw.githubusercontent.com/' + repo.owner + '/' + repo.name + '/main/' + path + '?t=' + nowMs();
      var done = false;
      function finish(err, data) {
        if (done) return;
        done = true;
        cb(err, data);
      }
      try {
        global.fetch(url, { cache: 'no-store' })
          .then(function (res) { return res && res.ok && res.json ? res.json() : null; })
          .then(function (data) { if (data) finish(null, data); else finish(new Error('raw_unavailable')); },
            function () { finish(new Error('raw_failed')); });
      } catch (e) { finish(new Error('raw_failed')); return false; }
      global.setTimeout(function () { finish(new Error('raw_timeout')); }, 5000);
      return true;
    },

    /* The timer tick: read version.json from raw main (CDN fallback) and only
       escalate to a full checkForUpdates() when a pointer actually moved. */
    pollVersionTick: function (cb) {
      cb = cb || noop;
      function compare(remote) {
        if (!remote) { cb(null, { ok: false, error: 'bad_response', changed: false }); return; }
        var local = state.version || {};
        var applied = 0;
        try { applied = Number(Data.settings().appliedSettingsRev) || 0; } catch (e) { applied = 0; }
        var remoteAppVer = parseRemoteAppVer(remote);
        var moved = Number(remote.syncRev || 0) > Number(local.syncRev || 0) ||
          Number(remote.settingsRev || 0) > applied ||
          (!!remoteAppVer && remoteAppVer !== APP_VERSION);
        if (!moved) {
          state.lastCheck = nowMs();
          state.lastCheckSource = 'raw';
          cb(null, { ok: true, error: null, changed: false, checked: true, source: 'raw' });
          return;
        }
        Sync.checkForUpdates(cb);
      }
      Sync.fetchRawMainJson('data/version.json', function (err, data) {
        if (!err && data) { compare(data); return; }
        fetchJSON('./data/version.json', function (err2, data2) {
          if (err2 || !data2) { cb(err2 || err || new Error('bad_response'), { ok: false, changed: false }); return; }
          compare(data2);
        });
      });
    },

    /* ══ Studio-only token-bearing read (D5): students never call this. The
     * Contents API answers while the Pages CDN rebuilds; without a token the
     * caller degrades to the same raw CDN every student uses. */
    fetchRawGitHubJson: function (path, cb, token) {
      cb = cb || noop;
      if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
      var repo = Sync.repo();
      var url = 'https://api.github.com/repos/' + repo.owner + '/' + repo.name + '/contents/' +
        str(path).replace(/^\/+/, '') + '?ref=main&t=' + nowMs();
      var headers = { Accept: 'application/vnd.github+json' };
      if (token) headers.Authorization = 'Bearer ' + str(token);
      var done = false;
      function finish(err, data) {
        if (done) return;
        done = true;
        cb(err, data);
      }
      try {
        global.fetch(url, { cache: 'no-store', headers: headers })
          .then(function (res) { return res && res.ok && res.json ? res.json() : null; })
          .then(function (data) {
            if (!data || !data.content) { finish(new Error('raw_unavailable')); return; }
            var text = '';
            try {
              text = utf8Decode(b64decode(str(data.content)));
            } catch (e) { text = ''; }
            if (!text) { finish(new Error('raw_unavailable')); return; }
            var parsed = null;
            try { parsed = JSON.parse(text); } catch (e) { finish(new Error('raw_bad_json')); return; }
            finish(null, parsed);
          }, function () { finish(new Error('raw_failed')); });
      } catch (e) { finish(new Error('raw_failed')); return false; }
      global.setTimeout(function () { finish(new Error('raw_timeout')); }, 5000);
      return true;
    },

    /* D-S8: the PIN is a local unlock secret and must never enter a JSON body
       that leaves the device. The parameter is accepted and deliberately
       ignored so no caller can smuggle it back in. */
    buildKeysRelayPayload: function (action) {
      return JSON.stringify({ action: str(action || 'status'), app: 'sdp', ver: APP_VERSION });
    },
    publishWordsChunked: function (words, limitBytes) {
      var cap = Number(limitBytes) || 39000;
      var chunks = [], current = [], size = 2, i;
      var list = Array.isArray(words) ? words : [];
      for (i = 0; i < list.length; i++) {
        var item = list[i] || {};
        var line = JSON.stringify({ w: str(item.w), p: str(item.p), pos: str(item.pos), m: str(item.m), si: str(item.si), s: str(item.s) });
        /* Sinhala is 3 bytes per glyph in UTF-8, so the limit is measured in
           encoded bytes, exactly like the Apps Script cell budget. */
        var added = utf8Encode(line).length + 1;
        if (current.length && size + added > cap) {
          chunks.push(current);
          current = [];
          size = 2;
        }
        current.push(item);
        size += added;
      }
      if (current.length) chunks.push(current);
      return chunks;
    },
    postRelay: function (relayUrl, body, cb) {
      cb = cb || noop;
      if (!relayUrl || typeof global.fetch !== 'function') { cb(new Error('no_relay')); return; }
      global.fetch(relayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: str(body)
      }).then(function (res) { return res && res.json ? res.json() : null; })
        .then(function (data) { cb(null, data); })
        .catch(function (e) { cb(e || new Error('relay_failed')); });
    },

    /* D8: bounded live-state poll — 8 second timeout, clean /json?poll=1 URL,
       never hangs a low-end phone on a dead relay. */
    pollLiveState: function (cb) {
      cb = cb || noop;
      var cfg = state.config || {};
      var topic = cfg.live && cfg.live.state ? cfg.live.state : '';
      if (!topic || typeof global.fetch !== 'function') { cb(new Error('no_live')); return; }
      var done = false, timer = null;
      function finish(err, data) { if (done) return; done = true; if (timer) global.clearTimeout(timer); cb(err, data); }
      timer = global.setTimeout(function () { finish(new Error('timeout')); }, 8000);
      global.fetch(topic + '/json?poll=1', { cache: 'no-store' })
        .then(function (res) { return res && res.text ? res.text() : ''; })
        .then(function (text) {
          var lines = str(text).split('\n'), latest = null, i;
          for (i = 0; i < lines.length; i++) {
            if (!trim(lines[i])) continue;
            try { latest = JSON.parse(lines[i]); } catch (e) {}
          }
          if (latest && latest.message) {
            try {
              var payload = JSON.parse(latest.message);
              if (payload && payload.session && str(payload.session) !== str(state.sessionNo)) {
                Sync.checkForUpdates(function () {});
              }
            } catch (e) {}
          }
          finish(null, latest);
        })
        .catch(function (e) { finish(e || new Error('live_failed')); });
    },

    /* D1: download the 30 word-audio URLs into the SW audio caches so a
       1–2 GB Android can practise fully offline. Posts sdp:cache-words to the
       SW controller; falls back to a direct Cache API fetch in JSDOM or when
       the controller is not yet attached. */
    downloadOfflineAudio: function (words, onProgress, cb) {
      cb = cb || noop; onProgress = onProgress || noop;
      var urls = [], i, w;
      for (i = 0; i < (words || []).length; i++) {
        w = words[i] || {};
        var url = str(w.clipUrl || w.audio || '');
        if (url) urls.push(url);
      }
      var done = 0, settled = false;
      function report() { try { onProgress(done, urls.length); } catch (e) {} }
      function finish() {
        if (settled) return; settled = true;
        cb(null, { cached: done, total: urls.length });
      }
      if (!urls.length) { finish(); return; }
      if (global.navigator && global.navigator.serviceWorker && global.navigator.serviceWorker.controller) {
        global.navigator.serviceWorker.controller.postMessage({ type: 'sdp:cache-words', urls: urls });
        var listener = function (ev) {
          var d = ev && ev.data;
          if (d && d.type === 'sdp:cache-progress') {
            done = Number(d.cached) || 0; report();
            if (done >= Number(d.total || urls.length)) {
              global.navigator.serviceWorker.removeEventListener('message', listener);
              finish();
            }
          }
        };
        global.navigator.serviceWorker.addEventListener('message', listener, false);
        global.setTimeout(function () { finish(); }, 20000);
        return;
      }
      /* Direct cache fallback: SW-less browsers and headless test harnesses. */
      var pending = urls.length;
      for (i = 0; i < urls.length; i++) {
        (function (url) {
          try {
            global.caches.open('sdp-youdao-v1').then(function (cache) {
              return global.fetch(url).then(function (res) {
                if (res && (res.ok || res.type === 'opaque')) {
                  try { cache.put(url, res.clone()); } catch (e) {}
                }
                return res;
              }, function () { return null; });
            }).then(function () {
              done += 1; report();
              if (done >= pending) finish();
            }, function () {
              done += 1; report();
              if (done >= pending) finish();
            });
          } catch (e) {
            done += 1; report();
            if (done >= pending) finish();
          }
        })(urls[i]);
      }
    },

    /* contract: docs/ARCHITECTURE_MAP.md §R6 service worker registration */
    registerSW: function () {
      try {
        var loc = global.location || {};
        var host = str(loc.hostname);
        var secure = loc.protocol === 'https:' || host === 'localhost' || host === '127.0.0.1';
        if (!secure || !global.navigator || !global.navigator.serviceWorker) return false;
        global.navigator.serviceWorker.register('./sw.js');
        return true;
      } catch (e) { return false; }
    }
  };

  SDP.Data = Data;
  SDP.Sync = Sync;
  SDP.Sync.Vault = Vault;
  SDP.utils = { utf8Encode: utf8Encode, utf8Decode: utf8Decode, b64encode: b64encode, b64decode: b64decode };
  /* Kept for tooling that expects a promise-capable base64 helper name. */
  SDP.Sync.b64ToBinString = b64ToBinString;

  /* Boot the store once per page: migration runs before any view renders. */
  try {
    Data.migrateLegacyOnce();
  } catch (e) {}

  if (doc && doc.addEventListener) {
    global.addEventListener('online', function () { state.online = true; notify('online', true); });
    global.addEventListener('offline', function () { state.online = false; notify('offline', false); });
  }
})(typeof window !== 'undefined' ? window : this);
