/*! Smart Dictation Player — dictation engine (v0.0.3)
 * Strict ES5, dependency free.
 * contract: docs/ARCHITECTURE_MAP.md §R2 priority #3 single integrated cockpit
 * contract: docs/ARCHITECTURE_MAP.md §R4 focus & input law
 * contract: docs/ARCHITECTURE_MAP.md §R5 beat state machine */
(function (global) {
 'use strict';

 var SDP = global.SDP = global.SDP || {};
 var doc = global.document;

 function noop() {}
 function str(v) { return v === null || v === undefined ? '' : String(v); }
 function now() { return Date.now(); }
 function isObj(v) { return !!v && typeof v === 'object'; }
 function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
 function setText(el, text) { if (el) el.textContent = str(text); }
 /* v0.0.5.c (GAP 2) — the ONE transport painter. It writes the dual-tone SVG
   plus an optional .i18n-label span and never leaves a bare emoji behind, so
   every dictation beat repaint keeps its icon. */
 function setBtnIconLabel(btn, iconName, text, ariaLabel) {
  if (!btn) return false;
  var label = str(text), svg = '';
  try { if (SDP.Icons && SDP.Icons.icon) svg = SDP.Icons.icon(iconName, 22); } catch (e) {}
  btn.innerHTML = svg + (label ? '<span class="i18n-label"></span>' : '');
  var span = btn.querySelector ? btn.querySelector('.i18n-label') : null;
  if (span) span.textContent = label;
  if (iconName) btn.setAttribute('data-icon', str(iconName));
  if (ariaLabel !== undefined && ariaLabel !== null) btn.setAttribute('aria-label', str(ariaLabel));
  return true;
 }
 function pad2(n) { return (n < 10 ? '0' : '') + n; }
 function settings() {
  try { return SDP.Data.settings(); } catch (e) { return { mode: 'paper', writeSecs: 5, repeats: 2, pauseSecs: 1.5, autoAdvance: true, lang: 'en', pacingPreset: 'exam', voiceLock: 'unified', voiceSource: 'auto', rate: 0.95 }; }
 }
 function t(key, fallback) {
  try { if (SDP.Views && SDP.Views.t) return SDP.Views.t(key, fallback); } catch (e) {}
  return fallback === undefined ? key : fallback;
 }
 function lang() {
  try { return SDP.Views ? SDP.Views.lang() : 'en'; } catch (e) { return 'en'; }
 }

 var RING_R = 34;
 var RING_C = 2 * Math.PI * RING_R; /* 213.63 */
 var TICK_MS = 100;

 var E = {
  phase: 'idle',
  pausedPhase: '',
  mode: 'paper',
  index: 0,
  items: [],
  hints: { pos: false, first: false, si: false, sentence: false },
  writeSecs: 5,
  repeats: 2,
  pauseSecs: 1.5,
  autoAdvance: true,
  repeatsDone: 0,
  repeatsTotal: 1,
  phaseEnd: 0,
  invertConfirmUntil: 0,
  phaseMs: 0,
  remainingMs: 0,
  deadline: 0,
  ticker: null,
  repeatTimer: null,
  /* R3: the cue chain (preparing / number / paused / resumed / complete)
    owns exactly one timer at a time so a pause can always cancel it. */
  cueTimer: null,
  needPreparingCue: false,
  /* R1: the explicit pause flag. E.phase === 'paused' is the cockpit state;
    E.paused is the one law every speech path re-checks. */
  paused: false,
  epoch: 0,
  retryOnly: false,
  sessionNo: '8',
  finished: false,
  pauseReason: '',
  startedAt: 0
 };

 var els = {};
 function el(name) {
  if (!els[name]) els[name] = byId(name);
  return els[name];
 }
 function refreshEls() { els = {}; }

 function state() { return E.phase; }
 function items() { return E.items; }
 function current() { return E.items[E.index] || null; }
 /* E5 hard screen guard — the listening/writing beat never starts while a
   screen covers the cockpit (document hidden, guide modal open, lecturer
   lock gate up). E.epoch is re-checked on every tick and watchdog. */
 /* E5 hard screen guard — the beat never starts while the page is hidden or
   the lecturer lock gate covers the cockpit. The guide modal is NOT a
   cover: narration happens inside it. */
 function screenIsCovered() {
  try { if (doc && doc.hidden === true) return true; } catch (e) { return true; }
  var g = byId('studioGate');
  var studioScreen = byId('screen-studio');
  if (g && !g.hidden && studioScreen && studioScreen.classList && studioScreen.classList.contains('active')) return true;
  return false;
 }

 /* ── scoring helpers ────────────────────────────────────────────────── */
 function isCorrectItem(item) {
  if (!item) return false;
  if (item.correct !== null && item.correct !== undefined) return !!item.correct;
  if (E.mode === 'typing') return normalize(item.typed) === normalize(item.w);
  return item.marked === 'correct';
 }
 function normalize(text) {
  return str(text).replace(/^\s+|\s+$/g, '').toLowerCase().replace(/\s+/g, ' ');
 }
 function scored() {
  var correct = 0, i;
  for (i = 0; i < E.items.length; i++) if (isCorrectItem(E.items[i])) correct += 1;
  return { correct: correct, total: E.items.length };
 }

 function buildModel() {
  var out = [], i;
  for (i = 0; i < E.items.length; i++) {
   var item = E.items[i];
   out.push({
    i: item.i, w: item.w, typed: item.typed, correct: isCorrectItem(item),
    marked: item.marked, si: item.word ? item.word.si : '', pos: item.word ? item.word.pos : '',
    origIndex: item.origIndex
   });
  }
  return { mode: E.mode, items: out, retryOnly: E.retryOnly, sessionNo: E.sessionNo };
 }

 /* ── ring / bar / readouts ──────────────────────────────────────────── */
 function ringColor() {
  if (E.phase === 'listening') return '#38BDF8';
  if (E.phase === 'writing') return (E.remainingMs <= 3000 ? '#F59E0B' : '#10B981');
  return '#A1A1AA';
 }
 function paint(frac) {
  var ring = el('beatRing');
  if (ring) {
   var f = Math.max(0, Math.min(1, frac));
   ring.setAttribute('stroke-dasharray', String(Math.round(RING_C * 100) / 100));
   ring.setAttribute('stroke-dashoffset', String(Math.round(RING_C * (1 - f) * 100) / 100));
   ring.setAttribute('stroke', ringColor());
   ring.style.stroke = ringColor();
  }
  var bar = el('beatBar');
  if (bar) {
   bar.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
   bar.style.backgroundColor = ringColor();
  }
  var secs = el('beatSeconds');
  if (secs) setText(secs, pad2(Math.max(0, Math.ceil(E.remainingMs / 1000))) + 's');
  /* P4: the strip tracks the live word on every tick, done/current/todo. */
  paintProgressStrip();
  renderBadges();
 }

 /* v0.0.6.a Track 4: the human-friendly Phase Pill. One glance answers
   "what is happening right now?" — Listening (which repeat), Writing (how
   long), or the last-3s amber warning — in English and Sinhala, while the
   verbatim #beatStateText contract (G3.4d/e, G5.6a/b/c) is untouched. */
 function paintPhasePill(phaseOverride, secondsLeft) {
  var pill = el('beatPhasePill');
  if (!pill) return '';
  var phase = phaseOverride || E.phase;
  var left = Math.max(0, Math.ceil((arguments.length > 1 ? secondsLeft : E.remainingMs) / 1000));
  var label = '';
  if (phase === 'paused') label = t('pillPaused', '⏸ Paused — tap Resume');
  else if (phase === 'finished') label = t('pillFinished', '✅ Finished — check answers');
  else if (phase === 'idle') label = t('pillReady', '🎧 Ready');
  else if (phase === 'listening') {
   var total2 = Math.max(1, Number(E.repeats) || 1);
   var rep2 = Math.min(total2, Math.max(1, Number(E.repeatShown || E.repeatsDone || 1)));
   label = t('pillListening', '🎧 Listening · Repeat') + ' ' + rep2 + '/' + total2;
  } else if (phase === 'writing') {
   var amber = left <= 3;
   if (amber) label = t('pillFinishWarn', '⏳ Finish writing ·') + ' ' + left + 's';
   else label = t('pillWriting', '✍️ Write the word ·') + ' ' + left + 's';
  }
  setText(pill, label);
  pill.setAttribute('data-phase', phase);
  if (phase === 'writing' && left <= 3) pill.setAttribute('data-warn', 'true');
  else pill.removeAttribute('data-warn');
  return pill.textContent || '';
 }

 /* D12 (v0.0.2.a): the phase line spells out the student action verbatim —
   "Listen Carefully (Repeat 1 of 2)…", "Write Word #12 in Your Book! (5s
   countdown)" and the paused sentence with the exact word and repeat. */
 function setStateText() {
  var node = el('beatStateText');
  if (!node) return;
  var total = Math.max(1, Number(E.repeats) || 1);
  var rep = Math.min(total, Math.max(1, Number(E.repeatShown || E.repeatsDone || 1)));
  if (E.phase === 'paused') {
   setText(node, t('pausedAtWord', 'Dictation Paused at Word #') + (E.index + 1) +
    ' (' + t('repeatWord', 'Repeat') + ' ' + rep + ' of ' + total + ')' + t('pausedResumeTail', ' — Press Resume Below'));
   return;
  }
  if (E.phase === 'finished') { setText(node, t('finishedBeat', 'Finished — check your answers')); return; }
  if (E.phase === 'idle') { setText(node, t('readyBeat', 'Ready')); return; }
  if (E.phase === 'listening') {
   setText(node, t('listenCarefully', 'Listen Carefully (Repeat ') + rep + ' of ' + total + ')…');
  } else if (E.phase === 'writing') {
   var left = Math.max(0, Math.ceil(E.remainingMs / 1000));
   setText(node, t('writeInBook', 'Write Word #') + (E.index + 1) +
    t('inYourBook', ' in Your Book! (') + left + t('countdownTail', 's countdown)'));
  }
  paintPhasePill();
 }

 /* D11 (v0.0.2.a): the 30-pill progress map. Completed words are green,
   the live word pulses, the rest stay slate, and a completed pill replays
   that word. The strip never invents a word count: it uses E.items.length. */
 function paintProgressStrip() {
  var host = byId('sessionPills');
  var total = E.items.length || 30;
  var i, pill;
  if (host && host.querySelectorAll) {
   pill = host.querySelectorAll('.word-pill');
   if (!pill.length || pill.length !== total) {
    var html = '';
    for (i = 1; i <= total; i++) {
     html += '<button type="button" class="word-pill todo" data-word-pill="' + i + '" aria-label="Word ' + i + '">' + i + '</button>';
    }
    host.innerHTML = html;
    pill = host.querySelectorAll('.word-pill');
   }
   for (i = 0; i < pill.length; i++) {
    var live = !!(E.items.length && !E.finished && E.phase !== 'idle');
    var state = i < E.index ? 'done' : (i === E.index && live ? 'current' : 'todo');
    pill[i].className = 'word-pill ' + state;
    pill[i].setAttribute('aria-current', i === E.index ? 'true' : 'false');
   }
  }
  /* Phase 5: the single-line cockpit header (WORD #01 / 30). */
  setText(byId('sessionProgressCount'), t('progressWordUpper', 'WORD #') + pad2(E.index + 1) + t('progressOf30', ' / 30'));
  /* v0.0.5.c: an ICON-first deck — the dual-tone SVG is the button, the
    caption beside it carries the word. aria-label keeps it accessible. */
  setBtnIconLabel(byId('btnPrev'), 'prev', '', t('btnPrevNum', '⏮ Prev (#') + (E.index + 1) + ')');
  setBtnIconLabel(byId('btnNext'), 'next', '', t('btnNextNum', '⏭ Next (#') + Math.min(total, E.index + 2) + ')');
  setBtnIconLabel(byId('btnReplay'), 'volume', '', t('btnReplay', ' Replay Word'));
  setBtnIconLabel(byId('btnHint'), 'bulb', '', null);
  setBtnIconLabel(byId('btnFinish'), 'check', '', null);
  var preset = byId('playerPresetBadge');
  if (preset) setText(preset, String(Math.max(3, Number(E.writeSecs) || 5)) + t('writeSecsBadge', 's Write') + ' · ' + Math.max(1, Number(E.repeats) || 1) + '×');
  return total;
 }
 function updateMeta() {
  var item = current();
  setText(el('cockpitProgress'), (E.index + 1) + ' / ' + (E.items.length || 30));
  var badge = el('wordPosBadge');
  /* D-E4: a retry run is labelled as a retry, and still shows the original
    Session # so a student can find the word in their exercise book. */
  if (E.retryOnly) {
   var pos = item && item.word && item.word.pos ? ' · ' + item.word.pos : '';
   var orig = item && item.origIndex !== undefined ? ' · Session ' + str(E.sessionNo) + ' #' + (Number(item.origIndex) + 1) : '';
   setText(badge, 'Retry · Word ' + (E.index + 1) + ' of ' + (E.items.length || 0) + pos + orig);
   badge.className = 'badge badge-retry';
  } else {
   setText(badge, item && item.word && item.word.pos ? item.word.pos : '—');
   badge.className = 'badge';
  }
  var title = el('sessionTitle');
  if (title && SDP.Sync && SDP.Sync.sessionTitle) setText(title, SDP.Sync.sessionTitle());
  paintProgressStrip();
  renderBadges();
 }

 /* ── hints ──────────────────────────────────────────────────────────── */
 function renderHints() {
  var item = current();
  var word = item && item.word ? item.word : { w: '', pos: '', si: '', s: '' };
  var host = el('hintChips');
  var out = byId('hintOutput');
  if (!host) return;
  if (!out) {
   out = doc.createElement('div');
   out.id = 'hintOutput';
   out.className = 'hint-output';
   if (host.parentNode) host.parentNode.insertBefore(out, host.nextSibling);
  }
  var lines = [];
  if (E.hints.pos && word.pos) lines.push(t('hintPos', 'Word type') + ': ' + word.pos);
  if (E.hints.first && word.w) {
   var letters = str(word.w).split('');
   var masked = [];
   for (var i = 0; i < letters.length; i++) masked.push(i === 0 ? letters[i] : (/[a-zA-Z]/.test(letters[i]) ? '_' : letters[i]));
   lines.push(t('hintFirst', 'First letter') + ': ' + masked.join(' '));
  }
  if (E.hints.si && word.si) lines.push(word.si);
  if (E.hints.sentence && word.s) {
   var blanked = str(word.s).replace(new RegExp('\\b' + str(word.w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'ig'), '_____');
   lines.push(blanked);
  }
  var html = '';
  for (var j = 0; j < lines.length; j++) html += '<p class="hint-chip-out">' + escapeHtml(lines[j]) + '</p>';
  out.innerHTML = html;
  out.hidden = lines.length === 0;
  var chips = host.querySelectorAll ? host.querySelectorAll('[data-hint]') : [];
  for (var c = 0; c < chips.length; c++) {
   var key = chips[c].getAttribute('data-hint');
   chips[c].setAttribute('aria-pressed', E.hints[key] ? 'true' : 'false');
  }
 }
 function escapeHtml(text) {
  return str(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
 }
 function toggleHint(name) {
  if (!name) return;
  E.hints[name] = !E.hints[name];
  renderHints();
 }
 function cycleHint() {
  var order = ['pos', 'first', 'si', 'sentence'], i;
  for (i = 0; i < order.length; i++) {
   if (!E.hints[order[i]]) {
    E.hints[order[i]] = true;
    renderHints();
    /* R3: one cue per reveal, never per tap-loop. */
    try { if (SDP.Speech && SDP.Speech.sayCue) SDP.Speech.sayCue('cmd.hint', noop); } catch (e) {}
    return order[i];
   }
  }
  for (i = 0; i < order.length; i++) E.hints[order[i]] = false;
  renderHints();
  return '';
 }

 /* ── typing input law (R4) ──────────────────────────────────────────── */
 function mountInput() {
  var stage = el('beatStage');
  if (!stage) return null;
  var input = byId('typeInput');
  if (E.mode !== 'typing') {
   if (input && input.parentNode) input.parentNode.removeChild(input);
   return null;
  }
  if (!input) {
   input = doc.createElement('input');
   input.id = 'typeInput';
   input.type = 'text';
   input.className = 'type-input';
   input.setAttribute('autocomplete', 'off');
   input.setAttribute('autocapitalize', 'off');
   input.setAttribute('autocorrect', 'off');
   input.setAttribute('spellcheck', 'false');
   input.setAttribute('aria-label', 'Type the word you hear');
   input.value = '';
   stage.appendChild(input);
  }
  var item = current();
  if (input) input.value = item ? str(item.typed) : '';
  return input;
 }
 function unmountInput() {
  var input = byId('typeInput');
  if (input && input.parentNode) input.parentNode.removeChild(input);
 }
 function focusInputOnce() {
  /* The ONLY focus call in the whole app, typing mode only (R4). */
  if (E.mode !== 'typing') return;
  var input = byId('typeInput');
  if (!input || typeof input.focus !== 'function') return;
  try { input.focus({ preventScroll: true }); } catch (e) { try { input.focus(); } catch (e2) {} }
 }
 function submitTyped() {
  /* Typing-mode submit: Enter works in listening or writing, because a fast
    student may finish typing before the listening window closes. */
  var input = byId('typeInput');
  var item = current();
  if (!input || !item) return false;
  item.typed = input.value;
  saveDraft();
  if (E.index >= E.items.length - 1) { finish(); return true; }
  goNext();
  return true;
 }
 function bindInput() {
  var input = byId('typeInput');
  if (!input || input._sdpBound) return;
  input._sdpBound = true;
  input.addEventListener('input', function () {
   var item = current();
   if (item) item.typed = input.value;
   saveDraft();
  });
  input.addEventListener('keydown', function (ev) {
   var key = ev && (ev.key || ev.keyCode);
   if (key !== 'Enter' && key !== 13) return;
   if (ev && ev.preventDefault) ev.preventDefault();
   if (E.mode !== 'typing') return;
   if (E.phase !== 'listening' && E.phase !== 'writing') return;
   submitTyped();
  });
 }

 /* ── phase machine ──────────────────────────────────────────────────── */
 /* ENG-02: the 0.5 s slider position used to become a 2.0 s gap because of a
   hard 1500 ms floor. 0.5 s → 800 ms, 1.5 s → 1800 ms, 3 s → 3300 ms. */
 function repeatGapMs() {
  return Math.max(600, Math.round(Number(E.pauseSecs || 0) * 1000) + 300);
 }
 function listenMs() {
  return Math.max(1200, repeatGapMs() * Math.max(1, E.repeats));
 }

 function stopTicker() {
  if (E.ticker) { global.clearInterval(E.ticker); E.ticker = null; }
  if (E.repeatTimer) { global.clearTimeout(E.repeatTimer); E.repeatTimer = null; }
  clearCueTimer();
 }
 function startTicker() {
  stopTicker();
  E.ticker = global.setInterval(tick, TICK_MS);
 }

 function tick() {
  /* F2: while the final repetition is still speaking, keep the listening
    phase alive (polling on the 100ms ticker) so the writing countdown
    never starts mid-audio; hard cap at +2000 ms past phase end. */
  if (E.phase === 'listening' && E.waitingForSpeech) {
   /* D-E1: one timestamp field only. onPhaseEnd() writes E.waitSince; this
     path must read the same field. v0.0.1.b read E.phaseStart here, which
     was already >2000 ms old on any listening phase longer than 2 s, so the
     grace window expired instantly and writing cut the final repeat off. */
   if (!E.waitSince) E.waitSince = now();
   /* ENG-01: 8 s of grace (re-armed per repeat) instead of 2 s, so audio on
     a slow 3G phone is never cut off mid-word. */
   if (now() - E.waitSince >= 8000) { E.waitingForSpeech = false; E.waitSince = 0; enterWriting(); return; }
   if (SDP.Speech && SDP.Speech.isSpeaking && SDP.Speech.isSpeaking()) {
    /* D-E3: paint the true remaining listening fraction, not a constant. */
    var leftMs = Math.max(0, E.deadline - now());
    paint(E.phaseMs ? leftMs / E.phaseMs : 0);
    setStateText();
    return;
   }
   E.waitingForSpeech = false;
   E.waitSince = 0;
   enterWriting();
   return;
  }
  if (E.phase !== 'listening' && E.phase !== 'writing') return;
  var left = E.deadline - now();
  if (left < 0) left = 0;
  E.remainingMs = left;
  paint(E.phaseMs ? left / E.phaseMs : 0);
  setStateText();
  if (left <= 0) {
   /* ENG-01: a pending repeat always buys the listening phase more time. */
   if (E.phase === 'listening' && E.repeatsDone < E.repeatsTotal) {
    extendListening();
    return;
   }
   onPhaseEnd();
  }
 }

 /* ENG-01: one shared extender so a repeat can never be truncated by the
   original listening deadline (clip load + play + gap + 1.8 s of slack). */
 function extendListening() {
  var until = now() + repeatGapMs() + 1800;
  if (until > E.deadline) {
   E.deadline = until;
   E.phaseMs = Math.max(E.phaseMs, E.deadline - (E.phaseStart || now()));
   E.remainingMs = E.deadline - now();
  }
  E.phaseEnd = E.deadline;
  return E.deadline;
 }

 function onPhaseEnd() {
  if (E.phase === 'listening') {
   /* F2: wait for in-flight speech before the writing window opens. */
   if (SDP.Speech && SDP.Speech.isSpeaking && SDP.Speech.isSpeaking()) {
    E.waitingForSpeech = true;
    E.waitSince = now();
    return;
   }
   E.waitSince = 0;
   enterWriting();
   return;
  }
  if (E.phase === 'writing') {
   saveDraft();
   if (E.autoAdvance) {
    if (E.index + 1 >= E.items.length) finish();
    else enterWord(E.index + 1);
   } else {
    pause();
   }
  }
 }

 function enterListening() {
  if (screenIsCovered()) return false;
  E.phase = 'listening';
  E.paused = false;
  E.pausedPhase = '';
  E.pauseReason = '';
  E.phaseStart = now();
  E.epoch += 1;
  E.phaseMs = listenMs();
  E.remainingMs = E.phaseMs;
  E.deadline = now() + E.phaseMs;
  E.repeatShown = 1;
  E.repeatsDone = 0;
  E.repeatsTotal = Math.max(1, Number(E.repeats) || 1);
  E.phaseEnd = E.deadline;
  E.waitSince = 0;
  E.waitingForSpeech = false;
  paint(1);
  setStateText();
  speakRepeats(E.epoch);
  startTicker();
 }

 /* D-E2: repeats used to be scheduled by a blind timer, so a slow dictionary
   clip or a long Alice clip overlapped the next repetition. Every repeat now
   waits for the previous one to finish, then holds the configured gap.
   A bounded fallback timer guarantees the chain never stalls if a speech
   backend forgets to call back. */
 function speakRepeats(epoch, startFrom) {
  /* D11: resuming a 'listening' pause continues from the repeat that was
    already spoken, instead of paying for repeat 1 again. */
  var done = Math.max(0, Math.min(Number(startFrom) || 0, Math.max(0, Number(E.repeats) - 1)));
  var gap = repeatGapMs();
  var cueGap = cueGapMs();
  function live() { return epoch === E.epoch && E.phase === 'listening' && !E.paused; }
  function scheduleNext() {
   if (!live()) return;
   if (done >= E.repeats) return;
   if (E.repeatTimer) { global.clearTimeout(E.repeatTimer); E.repeatTimer = null; }
   E.repeatTimer = global.setTimeout(fire, gap);
  }
  function fire() {
   E.repeatTimer = null;
   /* R1 Path D (F1): the repeat chain is the fourth leak. A timer that
     fired after Pause used to speak "Afraid." into an empty cockpit. */
   if (!live()) return;
   var item = current();
   if (!item) return;
   done += 1;
   E.repeatsDone = done;
   E.repeatsTotal = Math.max(1, Number(E.repeats) || 1);
   E.repeatShown = Math.min(done, E.repeats);
   /* ENG-01: every pending repeat re-arms the grace window and pushes the
     listening deadline out by one gap plus 1.8 s. */
   if (E.repeatsDone < E.repeatsTotal) {
    extendListening();
    E.waitSince = 0;
   }
   setStateText();
   var settled = false;
   var guard = global.setTimeout(function () { if (!settled) { settled = true; scheduleNext(); } }, Math.max(2600, gap + estimatePlayMs(item)));
   function after() {
    if (settled) return;
    settled = true;
    global.clearTimeout(guard);
    if (!live()) return;
    if (E.repeatsDone < E.repeatsTotal) extendListening();
    scheduleNext();
   }
   try {
    if (SDP.Speech && SDP.Speech.playWord) SDP.Speech.playWord(item.word, {}, after);
    else after();
   } catch (e) { after(); }
  }
  /* R3: the natural classroom opening. Word #1 announces the lesson and its
    number; words #2–#30 announce only their number; both then hand over to
    the first repetition after `cueGap`. Every callback re-checks live(). */
  if (done === 0) {
   var withPreparing = !!E.needPreparingCue;
   reserveCueAir((withPreparing ? 1700 + cueGap : 0) + 1700 + cueGap + 600);
   E.needPreparingCue = false;
   var speakNumber = function () {
    if (!live()) return;
    sayCueSafe('num.' + (E.index + 1), epoch, function () {
     if (!live()) return;
     clearCueTimer();
     E.cueTimer = global.setTimeout(function () {
      E.cueTimer = null;
      if (!live()) return;
      fire();
     }, cueGap);
    });
   };
   if (withPreparing) {
    sayCueSafe('cmd.preparing', epoch, function () {
     if (!live()) return;
     clearCueTimer();
     E.cueTimer = global.setTimeout(function () {
      E.cueTimer = null;
      if (!live()) return;
      speakNumber();
     }, cueGap);
    });
   } else {
    speakNumber();
   }
   return;
  }
  fire();
 }
 function estimatePlayMs(item) {
  var word = str(item && item.word ? (item.word.w || item.word) : '');
  return 600 + 90 * word.length;
 }

 function enterWriting() {
  if (E.repeatTimer) { global.clearTimeout(E.repeatTimer); E.repeatTimer = null; }
  E.phase = 'writing';
  E.phaseMs = Math.max(3, Number(E.writeSecs) || 8) * 1000;
  E.remainingMs = E.phaseMs;
  E.deadline = now() + E.phaseMs;
  paint(1);
  setStateText();
  mountInput();
  bindInput();
  focusInputOnce();
  startTicker();
 }

 function enterWord(index) {
  if (index < 0) index = 0;
  if (index >= E.items.length) { finish(); return; }
  E.index = index;
  E.finished = false;
  E.paused = false;
  E.hints = { pos: false, first: false, si: false, sentence: false };
  updateMeta();
  /* v0.0.6.a Track 3: every new beat re-arms the hidden reveal so the next
     spelling can never leak (R10) — phone, projector or desktop alike. */
  try { if (SDP.Views && SDP.Views.resetBoardReveal) SDP.Views.resetBoardReveal(); } catch (e) {}
  renderHints();
  mountInput();
  if (E.startedAt === 0) E.startedAt = now();
  saveDraft();
  enterListening();
  renderBadges();
  /* D4: a deferred remote adoption lands here — between words, never
    mid-word, so a settings bump can never cut a beat in half. */
  try { if (SDP.Sync && SDP.Sync.flushDeferred) SDP.Sync.flushDeferred(); } catch (e) {}
 }

 /* R6 / D10: isActive() is the ONE truth about a live beat. An active
   dictation is in the 'listening' or 'writing' phase (never 'running'). */
 function isActive() {
  if (E.finished) return false;
  return E.phase === 'listening' || E.phase === 'writing';
 }
 function isPaused() { return !!E.paused || E.phase === 'paused'; }
 /* R3: one guarded cue call. The callback only runs while this exact beat is
   still live, listening and unpaused — never in a 5 s write window. */
 function sayCueSafe(key, epoch, cb) {
  cb = cb || noop;
  try {
   if (!SDP.Speech || !SDP.Speech.sayCue) { cb(); return false; }
   SDP.Speech.sayCue(key, function () {
    if (epoch !== E.epoch || E.phase !== 'listening' || E.paused) return;
    cb();
   });
   return true;
  } catch (e) { cb(); return false; }
 }
 function clearCueTimer() {
  if (E.cueTimer) { try { global.clearTimeout(E.cueTimer); } catch (e) {} E.cueTimer = null; }
  return true;
 }
 /* R3/R9: 400 ms of studio air in class, 15 ms under a sub-second test pacing
   so a Chromium journey never waits on the intro. */
 function cueGapMs() { return (E.writeSecs && E.writeSecs < 1) ? 15 : 400; }
 /* R3: the intro chain needs air; push the listening deadline out so the
   write countdown cannot open on top of "Preparing lesson." */
 function reserveCueAir(ms) {
  var extra = Math.max(0, Number(ms) || 0);
  if (!extra) return E.deadline;
  E.deadline = Math.max(E.deadline, now() + extra);
  E.phaseMs = Math.max(E.phaseMs, E.deadline - (E.phaseStart || now()));
  E.remainingMs = Math.max(0, E.deadline - now());
  E.phaseEnd = E.deadline;
  return E.deadline;
 }

 function reasonLabel(reason) {
  var r = str(reason);
  if (r === 'navigation') return t('pauseReasonNavigation', 'you switched screens');
  if (r === 'modal') return t('pauseReasonModal', 'a dialog opened');
  if (r === 'visibility') return t('pauseReasonVisibility', 'the app went to the background');
  return t('pauseReasonUser', 'you tapped pause');
 }

 /* D17: the cockpit badges — repeat position, the paused reason banner and
   the Resume button label all live in one painter. */
 function renderBadges() {
  var rep = byId('playerRepeatBadge');
  if (rep) {
   var total = Math.max(1, Number(E.repeats) || 1);
   var shown = Math.min(total, Math.max(1, Number(E.repeatShown || E.repeatsDone || 1)));
   var live = E.phase === 'listening' || E.phase === 'writing' || E.phase === 'paused';
   rep.hidden = !live;
   setText(rep, t('repeatBadge', 'Repeat') + ' ' + shown + t('repeatOf', ' of ') + total);
  }
  var banner = byId('playerPausedBanner');
  if (banner) {
   var paused = E.phase === 'paused';
   banner.hidden = !paused;
   if (paused) {
    setText(banner, t('pausedBanner', 'Paused — Tap Resume to Continue') +
     ' · ' + reasonLabel(E.pauseReason));
   }
  }
  var btn = byId('btnPlayPause');
  if (btn) {
   if (E.phase === 'paused') {
    setBtnIconLabel(btn, 'play', '', t('btnResumeWord', '▶ Resume Word #') + (E.index + 1));
   } else if (E.phase === 'listening' || E.phase === 'writing') {
    setBtnIconLabel(btn, 'pause', '', t('btnPauseDictation', '⏸ Pause Dictation'));
   } else {
    setBtnIconLabel(btn, 'play', '', t('btnStartDictation', '▶ Start Dictation'));
   }
  }
  return true;
 }

 /* D10: pause(reason) stops the ticker, silences speech, saves the exact beat
   position and repaints the cockpit, so a Smart Board can never keep
   dictating to an empty classroom. */
 function pause(reason) {
  if (E.phase !== 'listening' && E.phase !== 'writing') return false;
  E.pausedPhase = E.phase;
  E.pauseReason = str(reason) || 'user';
  E.remainingMs = Math.max(0, E.deadline - now());
  E.phase = 'paused';
  /* R1: the flag every speech path reads. Set BEFORE the stop so an
    in-flight callback can never sneak a word out in between. */
  E.paused = true;
  stopTicker();
  E.epoch += 1;
  try { if (SDP.Speech) SDP.Speech.stop(); } catch (e) {}
  paint(E.phaseMs ? E.remainingMs / E.phaseMs : 0);
  setStateText();
  /* R3 (F4): the student now hears why the room went quiet. */
  try {
   if (SDP.Speech && SDP.Speech.sayCue) SDP.Speech.sayCue('cmd.paused', noop);
  } catch (e) {}
  saveDraft();
  renderBadges();
  try { if (SDP.Sync && SDP.Sync.flushDeferred) SDP.Sync.flushDeferred(); } catch (e) {}
  return true;
 }

 /* F1 / D11: resume into 'writing' restores the exact remaining countdown and
   any partial typed text; resume into 'listening' continues from the repeat
   that was already spoken of the current word, never from repeat 1. */
 function resumeFromPaused() {
  var back = E.pausedPhase === 'writing' ? 'writing' : 'listening';
  E.pauseReason = '';
  E.paused = false;
  if (back === 'writing') {
   E.phase = 'writing';
   if (!(E.phaseMs > 0)) E.phaseMs = Math.max(3, Number(E.writeSecs) || 5) * 1000;
   if (!(E.remainingMs > 0)) E.remainingMs = E.phaseMs;
   E.deadline = now() + E.remainingMs;
   startTicker();
   paint(E.phaseMs ? E.remainingMs / E.phaseMs : 1);
   setStateText();
   mountInput();
   bindInput();
   focusInputOnce();
   try { if (SDP.Speech && SDP.Speech.sayCue) SDP.Speech.sayCue('cmd.resumed', noop); } catch (e) {}
  } else {
   E.phase = 'listening';
   E.epoch += 1;
   E.phaseMs = listenMs();
   E.remainingMs = E.phaseMs;
   E.deadline = now() + E.phaseMs;
   E.repeatShown = Math.min(Math.max(1, Number(E.repeats) || 1), Math.max(1, Number(E.repeatsDone) || 0) + 1);
   paint(1);
   setStateText();
   startTicker();
   /* R3: "Session resumed." then the interrupted repetition. The chain is
     handed back at most 1.5 s later (20 ms under a sub-second test pace)
     even if the cue backend never calls back. */
   var epoch = E.epoch;
   var resumed = false;
   var handover = function () {
    if (resumed) return;
    resumed = true;
    clearCueTimer();
    if (epoch !== E.epoch || E.phase !== 'listening' || E.paused) return;
    speakRepeats(epoch, E.repeatsDone || 0);
   };
   E.cueTimer = global.setTimeout(handover, (E.writeSecs && E.writeSecs < 1) ? 20 : 1500);
   try {
    if (SDP.Speech && SDP.Speech.sayCue) SDP.Speech.sayCue('cmd.resumed', function () { handover(); });
    else handover();
   } catch (e) { handover(); }
  }
  saveDraft();
  renderBadges();
  return true;
 }
 /* R6: a page that reloaded into a paused draft resumes the same beat. */
 function restorePausedDraft(draft) {
  var d = isObj(draft) ? draft : {};
  start({
   mode: d.mode, startIndex: Number(d.index) || 0,
   answers: isObj(d.answers) ? d.answers : {}, silentMode: true, restore: true
  });
  if (E.phase !== 'listening' && E.phase !== 'writing') return false;
  E.pausedPhase = str(d.pausedPhase) === 'writing' ? 'writing' : 'listening';
  E.pauseReason = str(d.pauseReason) || 'user';
  E.phase = 'paused';
  E.paused = true;
  stopTicker();
  E.epoch += 1;
  try { if (SDP.Speech) SDP.Speech.stop(); } catch (e) {}
  if (E.pausedPhase === 'writing') E.phaseMs = Math.max(3, Number(E.writeSecs) || 5) * 1000;
  E.remainingMs = Math.max(0, Number(d.remainingMs) || 0);
  E.repeatsDone = Math.max(0, Number(d.repeatsDone) || 0);
  paint(E.phaseMs ? E.remainingMs / E.phaseMs : 0);
  setStateText();
  renderBadges();
  return true;
 }
 function resume() {
  if (E.phase === 'paused') return resumeFromPaused();
  if (E.phase === 'idle') {
   var draft = loadDraft();
   if (draft && str(draft.status) === 'paused' && restorePausedDraft(draft)) return resumeFromPaused();
  }
  return false;
 }

 function togglePlayPause() {
  if (E.phase === 'paused') { resume(); return 'resumed'; }
  if (E.phase === 'idle') { if (E.items.length) enterWord(E.index); return 'started'; }
  if (E.phase === 'finished') return 'finished';
  pause();
  return 'paused';
 }

 function repeatWord() {
  var item = current();
  if (!item || !SDP.Speech) return;
  try { SDP.Speech.playWord(item.word, {}, noop); } catch (e) {}
 }

 function goNext() {
  if (E.index + 1 >= E.items.length) { finish(); return; }
  enterWord(E.index + 1);
 }
 function goPrev() {
  if (E.index <= 0) { enterWord(0); return; }
  enterWord(E.index - 1);
 }
 /* R7 Smart Board jumper: tap any word number on the board; pause the
   current word, remount at the chosen index and enter listening. */
 function jumpTo(index) {
  if (index < 0) index = 0;
  if (index >= E.items.length) return false;
  if (E.phase !== 'idle' && E.phase !== 'finished') pause();
  E.index = index;
  saveDraft();
  enterWord(E.index);
  return true;
 }

 function setMode(mode, silent) {
  E.mode = mode === 'typing' ? 'typing' : 'paper';
  if (!silent) {
   try { SDP.Data.saveSettings({ mode: E.mode }); } catch (e) {}
   if (SDP.Views && SDP.Views.applyModePills) SDP.Views.applyModePills(E.mode);
  }
  if (E.mode === 'typing') { mountInput(); bindInput(); }
  else unmountInput();
  return E.mode;
 }
 function toggleMode() {
  setMode(E.mode === 'typing' ? 'paper' : 'typing');
  if (E.phase === 'writing') focusInputOnce();
  return E.mode;
 }

 /* ── draft resume (R8 sdp.session) ─────────────────────────────────── */
 /* D11: the draft now carries the exact beat position, so a reload (or a
   Smart Board that slept) resumes the same word, the same countdown and the
   same repeat instead of restarting. */
 function draftStatus() {
  if (E.phase === 'paused') return 'paused';
  if (E.phase === 'listening' || E.phase === 'writing') return E.phase;
  if (E.phase === 'finished') return 'finished';
  return 'idle';
 }
 /* v0.0.4.b: fingerprint the exact word list a draft belongs to. */
 function wordsSignature(items) {
  var list = Array.isArray(items) ? items : [], out = [], i;
  for (i = 0; i < list.length; i++) {
   var it = list[i] || {};
   var raw = typeof it === 'string' ? it : (it.w || it.word || '');
   out.push(String(raw).trim().toLowerCase());
  }
  return out.join('|');
 }
 function saveDraft() {
  try {
   if (!SDP.Data || E.finished || !E.items.length) return null;
   var answers = {}, i;
   for (i = 0; i < E.items.length; i++) {
    var item = E.items[i];
    if (item.typed || item.marked) answers[item.w] = { typed: item.typed, marked: item.marked };
   }
   var draft = {
    sessionId: str(E.sessionNo),
    index: E.index,
    mode: E.mode,
    status: draftStatus(),
    pausedPhase: str(E.pausedPhase || E.phase),
    remainingMs: Math.max(0, Math.round(Number(E.remainingMs) || 0)),
    repeatsDone: Math.max(0, Number(E.repeatsDone) || 0),
    pauseReason: str(E.pauseReason || ''),
    answers: answers,
    wordsSig: wordsSignature(E.items),
    updatedAt: now()
   };
   SDP.Data.saveSession(draft);
   return draft;
  } catch (e) { return null; }
 }
 function loadDraft() {
  try {
   var d = SDP.Data && SDP.Data.session ? SDP.Data.session() : null;
   if (!d || typeof d.index !== 'number') return null;
   var active = [];
   try {
    if (SDP.Sync && typeof SDP.Sync.words === 'function') active = SDP.Sync.words();
    else if (SDP.Sync && SDP.Sync.state && Array.isArray(SDP.Sync.state.words)) active = SDP.Sync.state.words;
   } catch (e) { active = []; }
   if (d && d.wordsSig && active.length && d.wordsSig !== wordsSignature(active)) {
    if (SDP.Data && SDP.Data.clearSession) SDP.Data.clearSession();
    return null;
   }
   if (d && !d.wordsSig && active.length && d.answers) {
    var valid = {}, i, ww;
    for (i = 0; i < active.length; i++) {
     ww = active[i] || {};
     valid[String(ww.w || ww.word || ww).trim().toLowerCase()] = 1;
    }
    for (var k in d.answers) {
     if (Object.prototype.hasOwnProperty.call(d.answers, k) && !valid[String(k).trim().toLowerCase()]) {
      if (SDP.Data && SDP.Data.clearSession) SDP.Data.clearSession();
      return null;
     }
    }
   }
   return d;
  } catch (e) { return null; }
 }

 /* ── results & self-check table ─────────────────────────────────────── */
 function grade() {
  var i;
  for (i = 0; i < E.items.length; i++) {
   var item = E.items[i];
   if (E.mode === 'typing') {
    item.correct = normalize(item.typed) === normalize(item.w);
    item.marked = item.correct ? 'correct' : 'missed';
   } else {
    if (item.marked !== 'correct' && item.marked !== 'missed') item.marked = 'correct';
    item.correct = item.marked === 'correct';
   }
  }
 }

 function paintPaperNotice() {
  var panel = el('resultsPanel');
  if (!panel) return false;
  var node = el('paperModeNotice');
  if (!node && panel.querySelector && doc.createElement) {
   node = doc.createElement('p');
   node.id = 'paperModeNotice';
   node.className = 'paper-notice';
   node.setAttribute('role', 'status');
   var table = panel.querySelector('.table-wrap');
   if (table && table.parentNode) table.parentNode.insertBefore(node, table);
   else panel.appendChild(node);
  }
  if (!node) return false;
  /* D-E5: paper mode starts every word as "correct" because nothing was
    typed. Say so, instead of silently handing out a perfect score. */
  node.hidden = E.mode !== 'paper';
  node.textContent = E.mode === 'paper' ? 'Paper Mode: Tap any word you missed to mark ' : '';
  return true;
 }

 function renderResults() {
  var body = doc && doc.querySelector ? doc.querySelector('#resultsTable tbody') : null;
  if (!body) return;
  paintPaperNotice();
  var html = '', i;
  for (i = 0; i < E.items.length; i++) {
   var item = E.items[i];
   var correct = isCorrectItem(item);
   var typed = str(item.typed);
   var diff = '';
   var yourWord = '—';
   if (typed) yourWord = typed;
   if (E.mode === 'typing' && typed && !correct) diff = '<span class="r-diff">' + escapeHtml(typed) + '</span>';
   /* D-E4: in a retry run the row number alone is meaningless — show the
     original Session # so the word can be found in the book. */
   var idxLabel = E.retryOnly && item.origIndex !== undefined
    ? 'S' + str(E.sessionNo) + ' #' + (Number(item.origIndex) + 1)
    : str(i + 1);
   html += '<tr data-row="' + i + '" class="' + (correct ? 'is-correct' : 'is-missed') + '"' +
    (E.retryOnly && item.origIndex !== undefined ? ' data-orig="' + (Number(item.origIndex) + 1) + '"' : '') + '>' +
    '<td class="r-idx">' + idxLabel + '</td>' +
    '<td class="r-word">' + (diff || escapeHtml(yourWord)) + '</td>' +
    '<td class="r-correct">' + escapeHtml(item.w) + (item.word && item.word.si ? ' <span class="word-si">' + escapeHtml(item.word.si) + '</span>' : '') + '</td>' +
    '<td><button type="button" class="mark-btn" data-mark="correct" data-row-index="' + i + '" aria-pressed="' + (item.marked === 'correct') + '"> ' + escapeHtml(t('markCorrect', 'Correct')) + '</button> ' +
    '<button type="button" class="mark-btn" data-mark="missed" data-row-index="' + i + '" aria-pressed="' + (item.marked === 'missed') + '"> ' + escapeHtml(t('markMissed', 'Missed')) + '</button></td>' +
    '</tr>';
  }
  body.innerHTML = html;
  paintScore();
 }

 function paintScore() {
  var score = scored();
  setText(el('scoreValue'), score.correct + ' / ' + score.total);
  var pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
  setText(el('scorePct'), pct + '%');
  return { score: score, pct: pct };
 }

 function mark(index, markState) {
  var item = E.items[index];
  if (!item) return null;
  item.marked = markState === 'missed' ? 'missed' : 'correct';
  item.correct = item.marked === 'correct';
  var row = doc && doc.querySelector ? doc.querySelector('#resultsTable tr[data-row="' + index + '"]') : null;
  if (row) {
   row.className = item.correct ? 'is-correct' : 'is-missed';
   var buttons = row.querySelectorAll ? row.querySelectorAll('.mark-btn') : [];
   for (var b = 0; b < buttons.length; b++) {
    buttons[b].setAttribute('aria-pressed', String(buttons[b].getAttribute('data-mark') === item.marked));
   }
  }
  paintScore();
  syncMastery();
  return item;
 }
 function markAll() {
  var i;
  for (i = 0; i < E.items.length; i++) E.items[i].marked = 'correct';
  for (i = 0; i < E.items.length; i++) E.items[i].correct = true;
  renderResults();
  syncMastery();
 }
 /* ENG-07: one stray Smart Board tap used to score 0/30. The first tap only
   arms the action; the second one inside 3 s actually inverts every row. */
 function toggleMissed() {
  var i;
  if (!E.invertConfirmUntil || E.invertConfirmUntil <= now()) {
   E.invertConfirmUntil = now() + 3000;
   var btn = byId('btnToggleMissed');
   if (btn) {
    btn.setAttribute('data-confirm-arm', '1');
    btn.setAttribute('aria-pressed', 'true');
   }
   if (SDP.Views && SDP.Views.showToast) {
    try { SDP.Views.showToast(t('invertConfirmToast', 'Tap Invert marks again within 3s to confirm')); } catch (e) {}
   }
   return 'armed';
  }
  E.invertConfirmUntil = 0;
  var armed = byId('btnToggleMissed');
  if (armed) {
   armed.setAttribute('data-confirm-arm', '0');
   armed.setAttribute('aria-pressed', 'false');
  }
  for (i = 0; i < E.items.length; i++) {
   E.items[i].marked = E.items[i].marked === 'missed' ? 'correct' : 'missed';
   E.items[i].correct = E.items[i].marked === 'correct';
  }
  renderResults();
  syncMastery();
  return 'inverted';
 }

 /* After the first save, mark changes update mastery/weak words only: the
   attempt counters and the streak are never inflated by tapping (R8). */
 function syncMastery() {
  if (!SDP.Data) return;
  try {
   var progress = SDP.Data.progress();
   var score = scored();
   var i;
   for (i = 0; i < E.items.length; i++) {
    var item = E.items[i];
    var key = str(item.w).toLowerCase();
    if (!key) continue;
    /* The first save counted one attempt per word; flipping a mark must
      move the correct counter by exactly the delta, never add attempts. */
    var attempt = progress.attempts[key];
    if (attempt) {
     var want = isCorrectItem(item) ? 1 : 0;
     var have = item.attemptCorrect ? 1 : 0;
     if (want !== have) {
      attempt.correct = Math.max(0, (Number(attempt.correct) || 0) + want - have);
      item.attemptCorrect = want === 1;
      progress.attempts[key] = attempt;
     }
    }
    if (isCorrectItem(item)) {
     progress.mastered[key] = true;
     var at = progress.weakWords.indexOf(key);
     if (at >= 0) progress.weakWords.splice(at, 1);
    } else {
     delete progress.mastered[key];
     if (progress.weakWords.indexOf(key) < 0) progress.weakWords.push(key);
    }
   }
   progress.lastScore = {
    correct: score.correct, total: score.total,
    pct: score.total ? Math.round((score.correct / score.total) * 100) : 0,
    mode: E.mode, at: now()
   };
   SDP.Data.saveProgress(progress);
   if (SDP.Views && SDP.Views.renderHome) SDP.Views.renderHome();
  } catch (e) {}
 }

 function showResults(show) {
  var panel = el('resultsPanel');
  if (panel) panel.hidden = !show;
 }

 function finish() {
  if (!E.items.length) return;
  stopTicker();
  E.epoch += 1;
  E.pauseReason = '';
  E.phase = 'finished';
  E.finished = true;
  E.remainingMs = 0;
  E.paused = false;
  try { if (SDP.Speech) SDP.Speech.stop(); } catch (e) {}
  paint(0);
  setStateText();
  /* R3 (F4): the run ends with a sentence, not silence. */
  try {
   if (SDP.Speech && SDP.Speech.sayCue) SDP.Speech.sayCue('cmd.complete', noop);
  } catch (e) {}
  grade();
  renderResults();
  showResults(true);
  try {
   if (SDP.Data) {
    SDP.Data.recordResult(buildModel());
    SDP.Data.clearSession();
   }
   for (var ai = 0; ai < E.items.length; ai++) E.items[ai].attemptCorrect = isCorrectItem(E.items[ai]);
  } catch (e) {}
  if (SDP.Views && SDP.Views.renderHome) { try { SDP.Views.renderHome(); } catch (e) {} }
  if (SDP.Views && SDP.Views.onFinished) { try { SDP.Views.onFinished(buildModel()); } catch (e) {} }
  if (doc && doc.getElementById && doc.getElementById('resultsPanel')) {
   try { doc.getElementById('resultsPanel').scrollIntoView({ block: 'nearest' }); } catch (e) {}
  }
  renderBadges();
  try { if (SDP.Sync && SDP.Sync.flushDeferred) SDP.Sync.flushDeferred(); } catch (e) {}
  return buildModel();
 }

 function missedWords() {
  var out = [], i;
  for (i = 0; i < E.items.length; i++) if (!isCorrectItem(E.items[i])) out.push(E.items[i].word);
  return out;
 }

 function retryMissedOnly() {
  var words = missedWords();
  if (!words.length) return { ok: false, reason: 'nothing_missed' };
  start({ words: words, mode: E.mode, retryOnly: true });
  return { ok: true, count: words.length };
 }

 function startNewSession() {
  var words = SDP.Sync && SDP.Sync.words ? SDP.Sync.words() : [];
  start({ words: words, mode: E.mode, retryOnly: false });
  return { ok: true, count: words.length };
 }

 function applySettings() {
  var conf = settings();
  /* ENG-03: the student's saved default hint toggles used to be ignored. */
  if (isObj(conf.hints)) {
   E.hints = {
    pos: conf.hints.pos !== false && conf.hints.pos !== undefined ? !!conf.hints.pos : false,
    first: !!conf.hints.first,
    si: !!conf.hints.si,
    sentence: !!conf.hints.sentence
   };
  }
  /* R3 / D9: 5 s · 2× is the classroom default; intervalSec is the older
    field name for the same writing window. */
  E.writeSecs = Math.max(3, Number(conf.writeSecs || conf.intervalSec) || 5);
  E.repeats = Math.min(5, Math.max(1, Number(conf.repeats) || 2));
  E.pauseSecs = Number(conf.pauseSecs) || 1.5;
  E.autoAdvance = conf.autoAdvance !== false;
  E.mode = conf.mode === 'typing' ? 'typing' : 'paper';
 }

 function start(opts) {
  opts = opts || {};
  applySettings();
  if (opts.mode) E.mode = opts.mode === 'typing' ? 'typing' : 'paper';
  if (opts.writeSecs) E.writeSecs = Math.max(3, Number(opts.writeSecs));
  var words = opts.words && opts.words.length ? opts.words : (SDP.Sync && SDP.Sync.words ? SDP.Sync.words() : []);
  E.sessionNo = SDP.Sync && SDP.Sync.sessionNo ? SDP.Sync.sessionNo() : '8';
  E.items = [];
  var i;
  /* D-E4: keep the word's position in the live session so a retry run can
    show "Session 8 #12" instead of renumbering 1..N and losing the place. */
  var sessionWords = SDP.Sync && SDP.Sync.words ? SDP.Sync.words() : [];
  var sessionIndexOf = {};
  for (i = 0; i < sessionWords.length; i++) {
   var key = str(sessionWords[i] && sessionWords[i].w).toLowerCase();
   if (key && sessionIndexOf[key] === undefined) sessionIndexOf[key] = i;
  }
  for (i = 0; i < words.length; i++) {
   var word = words[i] || {};
   var wkey = str(word.w).toLowerCase();
   var origIndex = (word.i && !opts.retryOnly) ? (Number(word.i) - 1) : sessionIndexOf[wkey];
   if (origIndex === undefined) origIndex = i;
   E.items.push({ i: i + 1, w: str(word.w), typed: '', correct: null, marked: null, word: word, origIndex: origIndex });
  }
  if (opts.answers && typeof opts.answers === 'object') {
   /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R8 — sdp.session resume */
   for (i = 0; i < E.items.length; i++) {
    var saved = opts.answers[E.items[i].w];
    if (!saved) continue;
    E.items[i].typed = str(saved.typed);
    E.items[i].marked = saved.marked === 'missed' ? 'missed' : (saved.marked === 'correct' ? 'correct' : null);
   }
  }
  E.retryOnly = !!opts.retryOnly;
  E.index = Math.min(Math.max(0, Number(opts.startIndex) || 0), Math.max(0, E.items.length - 1));
  E.finished = false;
  E.pausedPhase = '';
  E.paused = false;
  E.pauseReason = '';
  E.remainingMs = 0;
  E.startedAt = now();
  /* R3/R6: the opening cue belongs to the FIRST word of this run only, and
    the fallback persona is pinned for the whole run. */
  E.needPreparingCue = true;
  try {
   if (SDP.Speech && SDP.Speech.lockSessionVoice) SDP.Speech.lockSessionVoice();
  } catch (e) {}
  refreshEls();
  showResults(false);
  setMode(E.mode, !!opts.silentMode);
  updateMeta();
  if (!E.items.length) {
   E.phase = 'idle';
   setText(el('beatStateText'), t('noWords', 'No words loaded yet'));
   return null;
  }
  enterWord(E.index);
  return buildModel();
 }

 function stop() {
  stopTicker();
  E.epoch += 1;
  E.phase = 'idle';
  E.finished = false;
  E.paused = false;
  E.needPreparingCue = false;
  try { if (SDP.Speech) SDP.Speech.stop(); } catch (e) {}
  try { if (SDP.Speech && SDP.Speech.endSessionVoice) SDP.Speech.endSessionVoice(); } catch (e) {}
  return state();
 }

 function bind() {
  refreshEls();
  var map = [
   ['btnPrev', goPrev],
   ['btnPlayPause', togglePlayPause],
   ['btnNext', goNext],
   ['btnRepeat', repeatWord],
   ['btnReplay', repeatWord],
   ['btnHint', cycleHint],
   ['btnModeSwitch', toggleMode],
   ['btnFinish', finish],
   ['btnMarkAll', markAll],
   ['btnToggleMissed', toggleMissed],
   ['btnRetryMissed', retryMissedOnly],
   ['btnNewSession', startNewSession]
  ];
  for (var i = 0; i < map.length; i++) {
   (function (id, fn) {
    var node = byId(id);
    if (!node || node._sdpBound) return;
    node._sdpBound = true;
    node.addEventListener('click', function (ev) {
     if (ev && ev.preventDefault) ev.preventDefault();
     try { fn(); } catch (e) {}
    });
   })(map[i][0], map[i][1]);
  }
  var pills = byId('sessionPills');
  if (pills && !pills._sdpBound) {
   pills._sdpBound = true;
   pills.addEventListener('click', function (ev) {
    var target = ev && ev.target;
    while (target && target !== pills && !(target.getAttribute && target.getAttribute('data-word-pill'))) target = target.parentNode;
    if (!target || target === pills || !target.getAttribute) return;
    var idx = Number(target.getAttribute('data-word-pill')) - 1;
    if (!isNaN(idx)) jumpTo(idx);
   });
  }
  var host = byId('hintChips');
  if (host && !host._sdpBound) {
   host._sdpBound = true;
   host.addEventListener('click', function (ev) {
    var target = ev && ev.target;
    while (target && target !== host && !(target.getAttribute && target.getAttribute('data-hint'))) target = target.parentNode;
    if (target && target !== host && target.getAttribute) toggleHint(target.getAttribute('data-hint'));
   });
  }
  var table = byId('resultsTable');
  if (table && !table._sdpBound) {
   table._sdpBound = true;
   table.addEventListener('click', function (ev) {
    var target = ev && ev.target;
    while (target && target !== table && !(target.getAttribute && target.getAttribute('data-row-index'))) target = target.parentNode;
    if (!target || target === table || !target.getAttribute) return;
    var idx = Number(target.getAttribute('data-row-index'));
    mark(idx, target.getAttribute('data-mark'));
   });
  }
  return true;
 }

 /* D10: ONE module-level lifecycle binder. A hidden tab, a page hide or a
   window that loses focus pauses the beat instead of letting it run into an
   empty room (and burning the student's data plan on silent repeats). */
 var lifecycleBound = false;
 function bindLifecycle() {
  if (lifecycleBound) return false;
  lifecycleBound = true;
  try {
   if (doc && doc.addEventListener) {
    doc.addEventListener('visibilitychange', function () {
     if (doc.hidden && isActive()) pause('visibility');
    }, false);
   }
   if (global.addEventListener) {
    global.addEventListener('pagehide', function () { if (isActive()) pause('visibility'); }, false);
    global.addEventListener('blur', function () { if (isActive()) pause('visibility'); }, false);
   }
  } catch (e) {}
  return true;
 }
 bindLifecycle();
 /* P4: the 30-pill strip is a map of the whole session, so it paints at boot
   and again the moment a session lands — never only after Start. */
 function watchSession() {
  if (!doc || typeof doc.addEventListener !== 'function') return false;
  if (doc._sdpPillWatch) return false;
  doc._sdpPillWatch = true;
  doc.addEventListener('sdp:ready', function () {
   try { paintProgressStrip(); } catch (e) {}
   try { renderBadges(); } catch (e2) {}
  }, false);
  doc.addEventListener('sdp:update', function () { try { paintProgressStrip(); } catch (e) {} }, false);
  return true;
 }
 watchSession();
 try { paintProgressStrip(); } catch (e) {}
 try { renderBadges(); } catch (e) {}

 var Engine = {
  start: start,
  stop: stop,
  bind: bind,
  state: state,
  items: items,
  current: current,
  model: buildModel,
  score: scored,
  mark: mark,
  markAll: markAll,
  toggleMissed: toggleMissed,
  retryMissedOnly: retryMissedOnly,
  startNewSession: startNewSession,
  missedWords: missedWords,
  finish: finish,
  pause: pause,
  resume: resume,
  isActive: isActive,
  isPaused: isPaused,
  draftStatus: draftStatus,
  loadDraft: loadDraft,
  restorePausedDraft: restorePausedDraft,
  renderBadges: renderBadges,
  paintProgressStrip: paintProgressStrip,
  pauseReasonLabel: reasonLabel,
  bindLifecycle: bindLifecycle,
  flushDeferred: function () { try { if (SDP.Sync && SDP.Sync.flushDeferred) return SDP.Sync.flushDeferred(); } catch (e) {} return 0; },
  togglePlayPause: togglePlayPause,
  next: goNext,
  prev: goPrev,
  jumpTo: jumpTo,
  repeat: repeatWord,
  toggleHint: toggleHint,
  cycleHint: cycleHint,
  setMode: setMode,
  submitTyped: submitTyped,
  toggleMode: toggleMode,
  applySettings: applySettings,
  renderResults: renderResults,
  renderHints: renderHints,
  saveDraft: saveDraft,
  refreshEls: refreshEls,
  stateText: function () { var n = byId('beatStateText'); return n ? n.textContent : ''; },
  repaintState: function () { setStateText(); return true; },
  ringColor: ringColor,
  config: function () {
   return { writeSecs: E.writeSecs, repeats: E.repeats, pauseSecs: E.pauseSecs, autoAdvance: E.autoAdvance, mode: E.mode, index: E.index, phase: E.phase, pausedPhase: E.pausedPhase, remainingMs: E.remainingMs, repeatsDone: E.repeatsDone, pauseReason: E.pauseReason, active: isActive() };
  }
 };

 SDP.Engine = Engine;
})(typeof window !== 'undefined' ? window : this);
