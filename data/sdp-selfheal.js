/* data/sdp-selfheal.js — v0.0.6.v
 * The student self-heal assistant (strict ES5). Exposed as
 * window.SDP.SelfHeal. Owns #sdpSelfHealModal and the seven triggers
 * (T1 manifest load timeout/abort, T2 MEDIA_ERR_* on a word clip,
 * T3 tier fall-through to tts, T4 long-frame lag, T5 SW version mismatch,
 * T6 storage quota, T7 extension interference) with exact plain-English
 * copy and 1-tap actions. Every trigger logs an incident into
 * SDP.Telemetry.recordIncident(...) (five-key law: incidents nest inside
 * sdp.settings.telemetry).
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R-SELFHEAL (v0.0.6.v). */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  var REARM_MS = 300000; /* one popup per trigger-type per 5 minutes */
  var armed = { T1: true, T2: true, T3: true, T4: true, T5: true, T6: true, T7: true };

  function byId(id) {
    try { return global.document.getElementById(id); } catch (e) { return null; }
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var COPY = {
    T1: { title: 'Voice clips are still loading',
      body: "Voice clips did not finish loading because of a slow internet connection. Tap 'Reload Voice Clips' or refresh the page to fix this immediately.",
      actions: [['reload', '🔄 Reload Voice Clips'], ['refresh', '↻ Refresh Page']] },
    T2: { title: 'One word did not load correctly',
      body: "This word's voice file did not load correctly. Tap 'Switch to Backup Audio' to hear it in the backup voice, or 'Reload Voice Clips' to try again.",
      actions: [['backup', '🔊 Switch to Backup Audio'], ['reload', '🔄 Reload Voice Clips']] },
    T3: { title: 'Using the backup voice',
      body: "Voice clips are not available right now — the backup voice is being used. Tap 'Reload Voice Clips' to restore the clear British voice.",
      actions: [['reload', '🔄 Reload Voice Clips']] },
    T4: { title: 'The app feels slow',
      body: "The app feels slow on this phone. Tap 'Refresh Page' to clear it, or continue — your progress is saved.",
      actions: [['refresh', '↻ Refresh Page'], ['dismiss', 'Continue']] },
    T5: { title: 'A new version is ready',
      body: "A new version is ready. Tap 'Refresh Page' to update — it takes one reload.",
      actions: [['refresh', '↻ Refresh Page']] },
    T6: { title: 'Storage is full',
      body: "Storage is full on this phone. Tap 'Clear Old Audio' to free space — your session and progress are kept.",
      actions: [['clear', 'Clear Old Audio']] },
    T7: { title: 'A browser extension may be changing this page',
      body: 'A browser extension may be changing this page. Try disabling it for this site.',
      actions: [['dismiss', 'Got it']] }
  };

  function ensureModal() {
    var m = byId('sdpSelfHealModal');
    if (m) return m;
    try {
      var div = global.document.createElement('div');
      div.id = 'sdpSelfHealModal';
      div.className = 'modal selfheal-modal';
      div.setAttribute('role', 'dialog');
      div.setAttribute('aria-modal', 'true');
      div.setAttribute('aria-labelledby', 'sdpSelfHealTitle');
      div.setAttribute('aria-hidden', 'true');
      div.hidden = true;
      div.innerHTML = '<div class="modal-card selfheal-card">' +
        '<div class="modal-head"><h2 id="sdpSelfHealTitle">Smart Dictation · Quick Fix</h2></div>' +
        '<p id="sdpSelfHealBody" class="selfheal-body" role="status" aria-live="polite"></p>' +
        '<div class="modal-foot selfheal-foot" id="sdpSelfHealActions"></div>' +
        '</div>';
      (global.document.body || global.document.documentElement).appendChild(div);
      div.addEventListener('click', function (ev) {
        if (ev && ev.target === div) hide();
      }, false);
      return div;
    } catch (e) { return null; }
  }

  function hide() {
    var m = byId('sdpSelfHealModal');
    if (!m) return false;
    m.hidden = true;
    m.setAttribute('aria-hidden', 'true');
    if (m.classList) m.classList.remove('is-open');
    return true;
  }

  function show(type, detail) {
    var copy = COPY[type];
    if (!copy) return false;
    if (!armed[type]) return false;
    armed[type] = false;
    global.setTimeout(function () { armed[type] = true; }, REARM_MS);
    var m = ensureModal();
    if (!m) return false;
    var title = byId('sdpSelfHealTitle'), body = byId('sdpSelfHealBody'), foot = byId('sdpSelfHealActions');
    if (title) title.textContent = copy.title;
    if (body) body.textContent = copy.body;
    if (foot) {
      var html = '', i;
      for (i = 0; i < copy.actions.length; i++) {
        html += '<button type="button" class="btn ' + (i === 0 ? 'btn-go' : 'btn-ghost') +
          '" data-selfheal-act="' + esc(copy.actions[i][0]) + '">' + esc(copy.actions[i][1]) + '</button>';
      }
      foot.innerHTML = html;
      var btns = foot.getElementsByTagName('button');
      for (i = 0; i < btns.length; i++) {
        (function (btn) {
          btn.addEventListener('click', function () { runAction(btn.getAttribute('data-selfheal-act') || '', type, detail || {}); }, false);
        })(btns[i]);
      }
    }
    m.hidden = false;
    m.setAttribute('aria-hidden', 'false');
    if (m.classList) m.classList.add('is-open');
    try {
      if (SDP.Telemetry && SDP.Telemetry.recordIncident) SDP.Telemetry.recordIncident('selfheal_' + type, detail || {});
    } catch (e) {}
    try {
      if (SDP.Diagnostics && SDP.Diagnostics.log) SDP.Diagnostics.log('selfheal_show', { type: type });
    } catch (e2) {}
    return true;
  }

  /* The 1-tap healing actions. */
  function runAction(act, type, detail) {
    var result = 'ok';
    try {
      if (act === 'refresh') {
        global.location.reload();
        result = 'reloading';
      } else if (act === 'reload') {
        if (SDP.Sync && SDP.Sync.purgeStaleBriefingClips) {
          try { SDP.Sync.purgeStaleBriefingClips({ words: true }); } catch (eP) {}
        }
        if (SDP.Speech && SDP.Speech.reloadManifest) {
          SDP.Speech.reloadManifest(function (err) {
            hide();
            if (err && SDP.Telemetry && SDP.Telemetry.recordIncident) {
              SDP.Telemetry.recordIncident('selfheal_' + type + '_retry_failed', { lastErr: String(err && err.message || err) });
            }
          }, true);
          result = 'reloading_clips';
        } else { hide(); result = 'no_speech'; }
      } else if (act === 'backup') {
        try {
          if (SDP.Data && SDP.Data.saveSettings) SDP.Data.saveSettings({ includeDictionary: true, voiceSource: 'auto' });
        } catch (eS) {}
        hide();
        result = 'backup_audio_on';
      } else if (act === 'clear') {
        try {
          if (global.caches && global.caches.keys) {
            global.caches.keys().then(function (names) {
              var i;
              for (i = 0; i < names.length; i++) {
                if (String(names[i]).indexOf('sdp-audio-clips') === 0 || String(names[i]).indexOf('sdp-youdao') === 0) {
                  global.caches.delete(names[i]);
                }
              }
            }, function () {});
          }
        } catch (eC) {}
        hide();
        result = 'old_audio_cleared';
      } else {
        hide();
        result = 'dismissed';
      }
    } catch (e) { result = 'error'; }
    try {
      if (SDP.Diagnostics && SDP.Diagnostics.log) SDP.Diagnostics.log('selfheal_action', { type: type, action: act, result: result });
    } catch (e2) {}
  }

  /* T4 — long-frame lag monitor: 4 rAF deltas > 350 ms within 10 s on active screens. */
  function bindLagMonitor() {
    if (!global.requestAnimationFrame) return;
    var hits = [], firstAt = 0, lastT = 0;
    function tick(t) {
      var bm = byId('briefingModal'), gm = byId('guideModal');
      var modalBusy = (bm && !bm.hidden) || (gm && !gm.hidden) || (global.document && global.document.hidden);
      if (modalBusy) {
        hits = []; firstAt = 0; lastT = t;
      } else if (lastT && (t - lastT) > 350 && (t - lastT) < 5000) {
        if (!firstAt) firstAt = t;
        if (t - firstAt > 10000) { hits = []; firstAt = 0; }
        hits.push(t - lastT);
        if (hits.length >= 4) { show('T4', { lagMs: Math.round(hits[hits.length - 1]) }); hits = []; firstAt = 0; }
      }
      lastT = t;
      global.requestAnimationFrame(tick);
    }
    try { global.requestAnimationFrame(tick); } catch (e) {}
  }

  /* T6 — storage quota guard. */
  function bindStorageGuard() {
    try {
      var probe = '_sdp_quota_probe_' + Date.now();
      global.localStorage.setItem(probe, 'x'.repeat(64));
      global.localStorage.removeItem(probe);
    } catch (e) {
      show('T6', { lastErr: String(e && e.message || e) });
    }
  }

  /* T7 — extension interference heuristics. */
  function bindExtensionGuard() {
    try {
      var html = global.document.documentElement;
      var darkInjected = html && (html.getAttribute('data-darkreader-mode') || html.getAttribute('data-lightsite') ||
        (global.document.querySelector && global.document.querySelector('darkreader-style, style[data-dm]')));
      var translated = html && (html.getAttribute('class') || '').indexOf('translated') >= 0;
      if (darkInjected || translated) show('T7', { extension: darkInjected ? 'dark-mode' : 'translate' });
    } catch (e) {}
  }

  function boot() {
    ensureModal();
    /* v0.0.6.v: arm lag, storage, and extension probes AFTER the first-visit
       welcome + briefing flow (15 s) so the modal never intercepts the
       Project Briefing on a cold load. */
    global.setTimeout(function () { bindLagMonitor(); bindStorageGuard(); bindExtensionGuard(); }, 15000);
    /* T5 — SW version mismatch. */
    try {
      if (global.navigator && global.navigator.serviceWorker && global.navigator.serviceWorker.getRegistration) {
        global.navigator.serviceWorker.getRegistration().then(function (reg) {
          try {
            if (reg && reg.waiting) show('T5', {});
          } catch (e) {}
        }, function () {});
      }
    } catch (e) {}
  }

  SDP.SelfHeal = {
    version: '1.0.0',
    show: show,
    hide: hide,
    triggers: COPY,
    boot: boot,
    rearm: function (type) { armed[type] = true; }
  };

  try {
    if (global.document && global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', function () { boot(); }, false);
    } else { boot(); }
  } catch (e) {}
})(typeof window !== 'undefined' ? window : this);
