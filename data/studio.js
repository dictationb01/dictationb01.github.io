/* ! Smart Dictation Player — Lecturer Studio & admin vault (v0.0.4.a) */
(function (global) {
 'use strict';

 var SDP = global.SDP = global.SDP || {};
 var doc = global.document;
 /* R5 (F6)/v0.0.4.a: Alice — the free-tier British female educator voice. */
 var VOICE_ID = 'Xb7hH8MSUJpSbSDYk0k2';
 var VOICE_NAME = 'Alice';
 var VOICE_MODEL = 'eleven_flash_v2_5';
 var VOICE_PERSONA = 'British English female educator (Alice-class)';
 var VOICE_FALLBACK = { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice' };
 var activeVoiceId = VOICE_ID;
 var activeVoiceName = VOICE_NAME;
 /* v0.0.4.a W1: single-voice engine law. Library voices (Charlotte) answer */
 function resolveProfessorVoice(key, cb) {
  cb = cb || noop;
  if (!key || !global.fetch) { cb(VOICE_FALLBACK.id, VOICE_FALLBACK.name); return; }
  try {
   global.fetch(EL_VOICES, { headers: { 'xi-api-key': key }, cache: 'no-store' })
    .then(function (r) { return r && r.ok ? r.json() : null; })
    .then(function (j) {
     var list = j && Array.isArray(j.voices) ? j.voices : [], best = '', bestName = '', bestScore = -1;
     for (var i = 0; i < list.length; i++) {
      var v = list[i] || {}, lb = v.labels || {};
      var hay = (str(v.name) + ' ' + str(lb.accent) + ' ' + str(lb.gender) + ' ' + str(lb.use_case)).toLowerCase();
      if (hay.indexOf('british') < 0 || hay.indexOf('female') < 0) continue;
      var score = 10;
      if (hay.indexOf('educational') >= 0 || hay.indexOf('educator') >= 0 || hay.indexOf('informative') >= 0) score += 5;
      if (str(v.voice_id) === VOICE_FALLBACK.id) score += 20;
      if (score > bestScore) { bestScore = score; best = str(v.voice_id); bestName = str(v.name); }
     }
     activeVoiceId = best || VOICE_FALLBACK.id;
     activeVoiceName = bestName || VOICE_FALLBACK.name;
     cb(activeVoiceId, activeVoiceName);
    }, function () { cb(VOICE_FALLBACK.id, VOICE_FALLBACK.name); });
  } catch (e) { cb(VOICE_FALLBACK.id, VOICE_FALLBACK.name); }
 }
 /* v0.0.4.a: auto-generation runs in the real app only — never inside the */
 function allowAutoGen() {
  if (global.__SDP_ALLOW_AUTOGEN === true) return true;
  /* v0.0.6.n lab law: a cross-world bridge flag (localStorage) authorizes the
     creator-device bridge from automation contexts where the isolated-world
     window property is invisible to the main-world closure. */
  try {
    if (global.localStorage && global.localStorage.getItem('sdp.lab.allowAutoGen') === '1') return true;
  } catch (eL) {}
  return !global.__SDP_NO_LIVE__;
 }
 function countExistingClips() { return clipCount(); }
 var HASH_ALGO = 'sha1';
 var EL_SUBSCRIPTION = 'https://api.elevenlabs.io/v1/user/subscription';
 /* D1/D2 (Rule 1A): rung 2 — a scoped */
 var EL_VOICES = 'https://api.elevenlabs.io/v1/voices';
 var GUIDE_KEYS = ['_guide_1', '_guide_2', '_guide_3', '_guide_4'];
 var WORD_CAP = 30;
 /* R4/D6: the classroom bootstrap PIN */
 var BOOTSTRAP_PIN = '78987898';
 var PIN_MAX = 8;
 var PIN_MIN = 4;
 var DICTIONARY_API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
 var SINHALA_API = 'https://api.mymemory.translated.net/get?q=';
 /* D2/D4 verbatim UI strings (STRINGS_ */
 var SCOPED_KEY = 'studioQuotaScoped';
 var TIER_KEY = 'studioElTierWarn';
 function SCOPED_NOTE() { return t(SCOPED_KEY); }
 function TIER_WARN() { return t(TIER_KEY); }
 /* D10 (R8): the 5-slot 100% free AI */
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

 /* ══ v0.0.6.m Pillar 2 — Multi-API Key Pool: the exact 6-key $0 layout ══
  * (1 Primary ElevenLabs key in Step 1 + 5 pool slots):
  *   Slot #1 elevenlabs  — ElevenLabs Key #2, the automatic backup that
  *                         carries the batch the moment the primary key
  *                         hits HTTP 401/402/429 / quota_exhaustion;
  *   Slot #2 groq        — Groq Free Tier Key #1 (AI British IPA, Sinhala
  *                         & lexical / pronunciation verifier);
  *   Slot #3 groq        — Groq Free Tier Key #2 (quota auto-rotation);
  *   Slot #4 openrouter  — OpenRouter Free Models Key #1
  *                         (llama-3.3-70b:free / gemini-2.0-flash:free);
  *   Slot #5 openrouter  — OpenRouter Free Models Key #2 (free LLM
  *                         failover) — 100% $0 cost, all free-tier keys. */
 var KEY_POOL_SLOTS = 5;
 var POOL_PROVIDERS = {
  elevenlabs: { label: 'ElevenLabs · backup voice', keyHint: 'sk_…' },
  gemini: { label: 'Gemini · free tier', keyHint: 'AIza…' },
  openrouter: { label: 'OpenRouter · free models', keyHint: 'sk-or-…' },
  groq: { label: 'Groq · free tier', keyHint: 'gsk_…' },
  cloudflare: { label: 'Cloudflare Workers AI', keyHint: 'key / token' }
 };
 var POOL_PROVIDER_ORDER = ['elevenlabs', 'groq', 'openrouter', 'gemini', 'cloudflare'];
 /* v0.0.6.m: the creator's exact 6-key default architecture — Slot #1 the
    ElevenLabs backup (instant credit-exhaustion failover), Slots #2-3 the
    two Groq free-tier keys (AI IPA / Sinhala / lexical engine with
    auto-rotation on HTTP 429), Slots #4-5 the two OpenRouter free-model
    keys (free LLM failover after Groq, before the free dictionary APIs). */
 var POOL_DEFAULT_PROVIDERS = ['elevenlabs', 'groq', 'groq', 'openrouter', 'openrouter'];
 var POOL_DEFAULT_HINTS = [
  'sk_… (ElevenLabs Key #2 — Backup)',
  'gsk_… (Groq Free Key #1)',
  'gsk_… (Groq Free Key #2)',
  'sk-or-… (OpenRouter Free Key #1)',
  'sk-or-… (OpenRouter Free Key #2)'
 ];
 /* The dedicated deep British male narrators for the Project Briefing:
    George (warm British male storyteller) is the default; Daniel
    (authoritative British male) is the drop-in alternative. */
 var INTRO_VOICE = { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George · deep British male', model: 'eleven_flash_v2_5' };
 var INTRO_VOICE_ALT = { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel · authoritative British male', model: 'eleven_flash_v2_5' };

 /* ══ R5: synchronous pure-ES5 SHA-1 (no async, no build step) ══════════ */
 function utf8Bytes(text) {
  var out = [], s = str(text), i, c, c2, cp;
  for (i = 0; i < s.length; i++) {
   c = s.charCodeAt(i);
   if (c < 0x80) { out.push(c); continue; }
   if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F)); continue; }
   if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
    c2 = s.charCodeAt(i + 1);
    if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
     i += 1;
     cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
     out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
     continue;
    }
   }
   out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
  }
  return out;
 }
 function hex8(n) {
  var v = (n >>> 0).toString(16);
  while (v.length < 8) v = '0' + v;
  return v;
 }
 function sha1Hex(text) {
  var bytes = utf8Bytes(text);
  var len = bytes.length, i, j, x;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  var hi = Math.floor(len / 536870912);
  var lo = (len * 8) >>> 0;
  bytes.push((hi >>> 24) & 0xFF, (hi >>> 16) & 0xFF, (hi >>> 8) & 0xFF, hi & 0xFF);
  bytes.push((lo >>> 24) & 0xFF, (lo >>> 16) & 0xFF, (lo >>> 8) & 0xFF, lo & 0xFF);
  var h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  var w = [], a, b, c, d, e, f, k, tmp;
  for (i = 0; i < bytes.length; i += 64) {
   for (j = 0; j < 16; j++) {
    w[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) |
     (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3];
   }
   for (j = 16; j < 80; j++) {
    x = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
    w[j] = (x << 1) | (x >>> 31);
   }
   a = h0; b = h1; c = h2; d = h3; e = h4;
   for (j = 0; j < 80; j++) {
    if (j < 20) { f = (b & c) | ((~b) & d); k = 0x5A827999; }
    else if (j < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
    else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
    else { f = b ^ c ^ d; k = 0xCA62C1D6; }
    tmp = ((((a << 5) | (a >>> 27)) + f + e + k + w[j]) | 0);
    e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = tmp;
   }
   h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0;
   h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }
  return hex8(h0) + hex8(h1) + hex8(h2) + hex8(h3) + hex8(h4);
 }
 function clipContentHash(text, voiceId, modelId) {
  return 'sha1:' + sha1Hex(str(text) + '|' + str(voiceId || activeVoiceId) + '|' + str(modelId || VOICE_MODEL));
 }

 /* R5 (F6): the whole 74-clip pack — 30 words, 30 numbers, 6 commands, 4 */
 var CMD_CLIPS = [
  { key: 'cmd.preparing', text: 'Preparing lesson. Listen carefully.' },
  { key: 'cmd.paused', text: 'Session paused.' },
  { key: 'cmd.resumed', text: 'Session resumed.' },
  { key: 'cmd.hint', text: 'Hint shown.' },
  { key: 'cmd.complete', text: "Dictation complete. Let's check your thirty words." },
  { key: 'cmd.sample', text: 'British female lecturer voice ready.' }
 ];
 var GUIDE_CLIP_TEXTS = [
  'Press Start Dictation to begin.',
  'Listen twice, then write in five seconds.',
  'Check all thirty words in order.',
  'Practise the words you missed.'
 ];
 function numberClipText(n) { return 'Number ' + n + '.'; }

 /* ══ v0.0.6.m Pillar 2 — the Permanent Static Clip Vault ════════════════ */
 var STATIC_CLIP_KEYS = (function () {
  var keys = [], i;
  for (i = 0; i < CMD_CLIPS.length; i++) keys.push(CMD_CLIPS[i].key);
  for (i = 1; i <= WORD_CAP; i++) keys.push('num.' + i);
  for (i = 0; i < GUIDE_CLIP_TEXTS.length; i++) keys.push('guide.en.' + i);
  for (i = 1; i <= 4; i++) keys.push('_guide_' + i);
  for (i = 1; i <= 4; i++) keys.push('_intro_male_' + i);
  return keys;
 })();
 function isStaticClipKey(key) { return STATIC_CLIP_KEYS.indexOf(str(key)) >= 0; }
 function introSteps() {
  /* The canonical sentences live in sdp-ui-views.js so the briefing always */
  var lines = [], i;
  try {
   if (global.SDP && SDP.Views && SDP.Views.briefingSentences) lines = SDP.Views.briefingSentences();
  } catch (e) { lines = []; }
  var out = [];
  /* v0.0.6.m: the executive briefing carries exactly 4 beats — the three
     project-summary beats inside the 10-second gate plus the end-of-note
     creator context. */
  for (i = 0; i < lines.length && i < 4; i++) out.push({ key: '_intro_male_' + (i + 1), text: str(lines[i]) });
  return out;
 }
 function staticVaultStats() {
  var total = STATIC_CLIP_KEYS.length, locked = 0, i, k;
  for (i = 0; i < STATIC_CLIP_KEYS.length; i++) {
   k = STATIC_CLIP_KEYS[i];
   if (isObj(ST.voicePack.clips[k]) && str(ST.voicePack.clips[k].b64)) locked += 1;
  }
  return { total: total, locked: locked, keys: STATIC_CLIP_KEYS.slice() };
 }

 /* ══ v0.0.6.m Pillar 2 — 100% automatic system & briefing audio ═══════
  * The creator only ever updates the 30 Dictation Words by hand. Every
  * essential SYSTEM clip — the command cues (_cmd_play/_cmd_pause/
  * _cmd_resume/_cmd_complete, stored under their canonical keys
  * cmd.preparing/cmd.paused/cmd.resumed/cmd.complete), the four guide
  * steps (_guide_1..4) and the four Project Briefing beats
  * (_intro_male_1..4) — is checked whenever the Studio unlocks or a
  * publish runs. MISSING clips, and clips whose stored text has DRIFTED
  * (e.g. the Oct-22 week counter bumping the Beat 1 sentence), are
  * synthesized as a delta with the configured ElevenLabs keys and ride
  * along in the GitHub sync automatically. */
 var ESSENTIAL_SYSTEM_CLIPS = (function () {
  var out = [], i;
  var cmdRoles = { 'cmd.preparing': '_cmd_play', 'cmd.paused': '_cmd_pause', 'cmd.resumed': '_cmd_resume', 'cmd.complete': '_cmd_complete' };
  for (i = 0; i < CMD_CLIPS.length; i++) {
   if (cmdRoles[CMD_CLIPS[i].key]) out.push({ key: CMD_CLIPS[i].key, role: cmdRoles[CMD_CLIPS[i].key] });
  }
  for (i = 1; i <= 4; i++) out.push({ key: '_guide_' + i, role: '_guide_' + i });
  for (i = 1; i <= 4; i++) out.push({ key: '_intro_male_' + i, role: '_intro_male_' + i });
  return out;
 })();
 function essentialClipText(key) {
  var k = str(key), i;
  for (i = 0; i < CMD_CLIPS.length; i++) if (CMD_CLIPS[i].key === k) return CMD_CLIPS[i].text;
  for (i = 0; i < GUIDE_CLIP_TEXTS.length; i++) if (k === '_guide_' + (i + 1)) return GUIDE_CLIP_TEXTS[i];
  var steps = introSteps();
  for (i = 0; i < steps.length; i++) if (steps[i].key === k) return steps[i].text;
  return '';
 }
 function missingSystemClips() {
  var out = [], i, k, text, entry;
  for (i = 0; i < ESSENTIAL_SYSTEM_CLIPS.length; i++) {
   k = ESSENTIAL_SYSTEM_CLIPS[i].key;
   text = essentialClipText(k);
   if (!text) continue;
   entry = isObj(ST.voicePack.clips[k]) ? ST.voicePack.clips[k] : null;
   if (!entry || !str(entry.b64)) { out.push({ key: k, text: text, why: 'missing' }); continue; }
   /* Outdated = the stored canonical text no longer matches (week-count
      drift on the briefing beats, edited guide lines). The hash pins the
      text/voice/model identity, so a drift means a re-synthesis. */
   if (str(entry.text) !== text) out.push({ key: k, text: text, why: 'outdated' });
  }
  return out;
 }
 /* Runs on Studio unlock and before every Publish & Sync. Never blocks the
    UI, never fires in the automated gates (allowAutoGen law), and silently
    reports "no key" when the vault holds no ElevenLabs key yet. */
 function autoEnsureSystemClips(opts, cb) {
  cb = cb || noop;
  opts = opts || {};
  function done(res) { try { cb(null, res); } catch (e1) {} }
  if (!ST.unlocked) { done({ skipped: 'locked' }); return false; }
  if (!allowAutoGen()) { done({ skipped: 'gates' }); return false; }
  var delta = missingSystemClips();
  if (!delta.length) { done({ delta: 0 }); return true; }
  var key = trimmedKey(str(resolveElevenKey()));
  if (!key) {
   if (!opts.quiet) {
    msg('System audio: ' + delta.length + ' essential clip(s) missing/outdated — add the ElevenLabs key and they will auto-sync on the next unlock or Publish.', '');
   }
   done({ delta: delta.length, synthesized: 0, noKey: true });
   return false;
  }
  var introKeys = [], sysQueue = [], i;
  for (i = 0; i < delta.length; i++) {
   if (delta[i].key.indexOf('_intro_male_') === 0) introKeys.push(delta[i].key);
   else sysQueue.push({ key: delta[i].key, text: delta[i].text, why: delta[i].why });
  }
  var made = 0;
  try {
   if (SDP.Diagnostics) SDP.Diagnostics.log('auto_ensure_system_clips', { delta: delta.length, intro: introKeys.length, system: sysQueue.length, source: str(opts.source || '') });
  } catch (e0) {}
  function afterSys() { done({ delta: delta.length, synthesized: made }); }
  function afterIntro(err, info) {
   if (info && info.made) made += info.made.length;
   if (err || !sysQueue.length) { afterSys(); return; }
   generateClips({ systemQueue: sysQueue, regenKeys: keysOf(sysQueue) }, function (err2, info2) {
    if (info2 && info2.made) made += info2.made.length;
    afterSys();
   });
  }
  if (introKeys.length) generateClips({ intro: true, keys: introKeys, regenKeys: introKeys }, afterIntro);
  else afterIntro(null, null);
  return true;
 }
 function keysOf(queue) {
  var out = [], i;
  for (i = 0; i < queue.length; i++) out.push(queue[i].key);
  return out;
 }

 /* ══ v0.0.6.m FIX 1 — autoSynthesizeBriefingAndGuide() ══════════════════
  * THE LAW: the four Project Briefing beats (_intro_male_1..4) and the four
  * guide steps (_guide_1..4) plus the _cmd_* cues are ONLY ever synthesized
  * with the creator's real stored API keys on the creator's own unlocked
  * device — never inside any build sandbox. Step A asks the stored LLM keys
  * (Groq → OpenRouter → Gemini free cascade) to verify the British phrasing
  * and produce per-word syllable timing weights (wordWeights), stored on the
  * clip entries as `ww` and consumed by the karaoke clock. Step B
  * synthesizes via the real ElevenLabs keys (primary → backup failover,
  * George voice, eleven_flash_v2_5, stability 0.55 / similarity_boost 0.80 /
  * style 0.25) and auto-commits the pack to GitHub. Step C fires on unlock,
  * publish and the explicit Generate button. Step D (before the first
  * publish, or offline) narrates through the pinned British-male Web Speech
  * persona — never a fabricated clip. */
 function briefingScriptWeights(lines, cb) {
  cb = cb || noop;
  if (!allowAutoGen()) { cb(null, null); return; }
  var candidates = llmCandidates({ p: aiProviderName(), k: str(ST.secrets.aiKey) || fieldValue('studioAiKey') });
  if (!candidates.length) { cb(null, null); return; }
  var joined = lines.map(function (l, i) { return (i + 1) + '. ' + l; }).join('\n');
  var prompt = 'You are a British English speech-timing editor. For each numbered sentence, ' +
   'return STRICT JSON only, exactly: {"lines":[{"n":1,"ww":[5,7,4,...]}]} where ww is one ' +
   'relative syllable-timing weight (2..14, integer) per word IN ORDER, heavier for long or ' +
   'emphasised words, and add +2 for a word followed by a comma pause. Sentences:\n' + joined;
  var at = 0;
  function attempt() {
   if (at >= candidates.length) { cb(null, null); return; }
   var c = candidates[at];
   at += 1;
   llmRequest(c.p, c.k, [], function (err, rows, rawText) {
    /* llmRequest indexes rows by word; the weights arrive through the
       raw-JSON branch — on any failure we fall straight back to the
       deterministic local weights (char length + punctuation law). */
    var parsed = parseScriptWeights(rawText || '', lines);
    if (parsed) {
     try {
      if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('script_weights_llm', { provider: c.p });
     } catch (e1) {}
     cb(null, parsed);
     return;
    }
    if (at < candidates.length) { attempt(); return; }
    cb(null, null);
   }, prompt);
  }
  /* The LLM pass is a best-effort optimiser: whatever it returns, the
     deterministic weights always remain a valid fallback, so a failed or
     absent LLM never blocks the real ElevenLabs synthesis. */
  try { attempt(); } catch (e) { cb(null, null); }
  return true;
 }
 function parseScriptWeights(text, lines) {
  var out = null;
  try {
   var parsed = parseJsonLoose(str(text));
   var rows = isObj(parsed) && Array.isArray(parsed.lines) ? parsed.lines : null;
   if (!rows) return null;
   var byN = {}, i;
   for (i = 0; i < rows.length; i++) if (isObj(rows[i]) && rows[i].n) byN[Number(rows[i].n)] = rows[i];
   out = [];
   for (i = 0; i < lines.length; i++) {
    var r = byN[i + 1];
    out.push((r && Array.isArray(r.ww)) ? r.ww.slice(0, 64) : null);
   }
  } catch (e) { out = null; }
  return out;
 }
 function autoSynthesizeBriefingAndGuide(opts, cb) {
  cb = cb || noop;
  opts = opts || {};
  if (!ST.unlocked) { cb(new Error('locked'), null); return false; }
  if (!allowAutoGen()) { cb(new Error('gates'), null); return false; }
  var steps = introSteps();
  var guideKeys = GUIDE_KEYS.slice();
  var lines = [];
  try {
   if (global.SDP && SDP.Views && SDP.Views.briefingSentences) lines = SDP.Views.briefingSentences();
  } catch (e) { lines = []; }
  for (var i = 0; i < lines.length && i < 4; i++) steps.push({ key: '_guide_' + (i + 1), text: str(GUIDE_CLIP_TEXTS[i] || '') });
  var weights = null;
  var run = function () {
   generateClips({ intro: true, keys: ['_intro_male_1', '_intro_male_2', '_intro_male_3', '_intro_male_4'], regenKeys: ['_intro_male_1', '_intro_male_2', '_intro_male_3', '_intro_male_4'], noCommit: !!opts.noCommit, force: !!opts.force }, function (err, info) {
    if (err && str(err.message) === 'no_key') {
     msg('Briefing voices: add the ElevenLabs key (Step 1) and they auto-synthesize on the next unlock or Publish — until then the app narrates with the pinned British-male device voice.', 'warn');
     cb(err, { stage: 'no_key' });
     return;
    }
    /* the guide steps + command cues ride the system queue */
    generateClips({ systemQueue: ESSENTIAL_SYSTEM_CLIPS.map(function (c) { return { key: c.key, text: essentialClipText(c.key), why: 'auto' }; }), regenKeys: guideKeys.concat(['_cmd_play', '_cmd_pause', '_cmd_resume', '_cmd_complete']) }, function (err2, info2) {
     /* stamp the AI syllable weights onto the intro entries for the karaoke clock */
     if (weights && Array.isArray(weights)) {
      for (var wi = 0; wi < 4; wi++) {
       var entry = isObj(ST.voicePack.clips['_intro_male_' + (wi + 1)]) ? ST.voicePack.clips['_intro_male_' + (wi + 1)] : null;
       if (entry && weights[wi]) entry.ww = weights[wi];
      }
     }
     var made = ((info && info.made ? info.made.length : 0) + (info2 && info2.made ? info2.made.length : 0));
     try {
      if (global.SDP && SDP.Diagnostics) {
       SDP.Diagnostics.log('auto_synth_briefing_guide', { source: str(opts.source || ''), made: made, err: err ? str(err.message) : '', err2: err2 ? str(err2.message) : '' });
      }
     } catch (e0) {}
     cb(null, { made: made, weights: !!weights });
    });
   });
  };
  /* Step A first (best-effort, never blocks): then Step B. */
  briefingScriptWeights(lines, function (e, w) {
   weights = w;
   run();
  });
  return true;
 }

 /* ══ v0.0.6.n RECOMMENDATION 1 — the /with-timestamps alignment parser ══
  * ElevenLabs responds with alignment.characters plus
  * character_start_times_seconds / character_end_times_seconds. This walks
  * the character stream, splits on whitespace boundaries and returns one
  * [startMs, endMs] pair PER WORD in utterance order — the exact `wt` array
  * stored on the clip entry and consumed by the karaoke clock. A trailing
  * punctuation character keeps its word's window (no zero-width words). */
 function parseAlignmentToWordTimings(alignment, text) {
  var out = [];
  try {
   if (!isObj(alignment)) return null;
   var chars = alignment.characters;
   var starts = alignment.character_start_times_seconds;
   var ends = alignment.character_end_times_seconds;
   if (typeof chars !== 'string' || !Array.isArray(starts) || !Array.isArray(ends)) return null;
   var n = Math.min(chars.length, starts.length, ends.length);
   if (!n) return null;
   var i, ch, s, e, curStart = -1, lastEnd = -1, sawWord = false;
   for (i = 0; i < n; i++) {
    ch = chars.charAt(i);
    s = Number(starts[i]);
    e = Number(ends[i]);
    if (!(s >= 0) || !(e >= s)) continue;
    if (/\s/.test(ch)) {
     if (sawWord) { out.push([Math.round(curStart * 1000), Math.round(lastEnd * 1000)]); sawWord = false; curStart = -1; }
     continue;
    }
    if (!sawWord) { sawWord = true; curStart = s; lastEnd = e; }
    else { lastEnd = e; }
   }
   if (sawWord) out.push([Math.round(curStart * 1000), Math.round(lastEnd * 1000)]);
   /* The alignment must cover the SAME word count as the spoken sentence —
      a mismatch means the parser must not guess (null falls back to ww). */
   var words = str(text).split(/\s+/).filter(function (w) { return !!w; });
   if (!out.length || out.length !== words.length) return null;
   return out;
  } catch (e) { return null; }
 }

 /* ══ v0.0.6.n FIX 2 — the Direct Vault-to-Briefing Live Synthesis Bridge ═
  * ensureBriefingAndGuideVoices(): the one entry point every trigger calls.
  * Law: ONLY on the creator's own unlocked device with real stored keys —
  * never in any automated gate/lab (allowAutoGen). Checks the four Project
  * Overview beats (_intro_male_1..4) AND the four guide steps against the
  * LIVE BRIEFING_SENTENCES (the weekly {W} counter included), synthesizes
  * the delta through the real ElevenLabs keys (primary → backup failover),
  * injects the fresh clips into the live session (SDP.Speech.injectClips),
  * primes the sdp-audio-clips CacheStorage with their playable URLs and
  * queues the GitHub commit — the unbreakable Studio ↔ Briefing pipeline. */
 var BRIDGE_FLAG = 'sdp.studio.vaultUnlocked';
 var bridgeBusy = false;
 function vaultSessionActive() {
  try { return global.sessionStorage && global.sessionStorage.getItem(BRIDGE_FLAG) === '1'; } catch (e) { return false; }
 }
 function markVaultSession() {
  try { if (global.sessionStorage) global.sessionStorage.setItem(BRIDGE_FLAG, '1'); } catch (e) {}
 }
 /* The live status surface: #studioBriefingVoiceBar sits at the top of the
    Lecturer Studio and narrates every phase of the bridge. */
 function paintBriefingVoiceBar(state, detail) {
  var bar = byId('studioBriefingVoiceBar');
  if (!bar) return false;
  var lines = {
   idle: '🎙 Project Overview & Guide voices are checked automatically on unlock — or press Generate below.',
   checking: '🎙 Checking Project Overview & Guide Voices… Synthesizing with ElevenLabs (George British Male) + Groq/Gemini Timing…',
   ok: '✓ Project Overview (4/4) & Guide (4/4) Voices Synced to GitHub & Live Cache!',
   noop: '✓ Project Overview & Guide voices already up to date (live weekly counter checked).',
   nokey: '⚠ Add the ElevenLabs key (Step 1) — the briefing narrates with the pinned British-male device voice until then.',
   busy: '🎙 Bridge already running — one moment…',
   error: '✗ Briefing voice bridge failed — check the key pool and retry with the Generate button.'
  };
  var s = lines[state] ? state : 'idle';
  bar.setAttribute('data-state', s);
  bar.textContent = lines[s] + (detail ? ' ' + str(detail) : '');
  try {
   if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('briefing_voice_bridge', { state: s, detail: str(detail || '') });
  } catch (e0) {}
  return true;
 }
 function briefingVoiceDelta() {
  /* The exact drift check: text equality against the LIVE sentences, so a
     weekly {W} bump or an edited beat means a re-synthesis. */
  var out = { intro: [], guide: [], total: 0 };
  var steps = introSteps(), i, entry, k;
  for (i = 0; i < steps.length; i++) {
   k = steps[i].key;
   entry = isObj(ST.voicePack.clips[k]) ? ST.voicePack.clips[k] : null;
   if (!entry || !str(entry.b64) || str(entry.text) !== steps[i].text) out.intro.push(k);
  }
  for (i = 0; i < GUIDE_KEYS.length; i++) {
   k = GUIDE_KEYS[i];
   entry = isObj(ST.voicePack.clips[k]) ? ST.voicePack.clips[k] : null;
   if (!entry || !str(entry.b64)) out.guide.push(k);
  }
  out.total = out.intro.length + out.guide.length;
  return out;
 }
 function primeClipCache(entries) {
  /* Best-effort CacheStorage prime: the playable blob URL of each fresh
     clip is PUT into sdp-audio-clips so the very next briefing replay is
     served from the live cache, never a stale older-version entry. */
  try {
   if (!global.caches || !global.caches.open) return false;
   var SPEECH = global.SDP && global.SDP.Speech ? global.SDP.Speech : null;
   global.caches.open('sdp-audio-clips').then(function (cache) {
    var chain = Promise.resolve();
    Object.keys(entries).forEach(function (k) {
     chain = chain.then(function () {
      var url = '';
      try { if (SPEECH && SPEECH.playableUrlFor) url = SPEECH.playableUrlFor(entries[k]); } catch (e1) {}
      if (!url) return null;
      return cache.put(new Request(url, { cache: 'reload' }), new Response(entries[k].b64 ? ('data:audio/mpeg;base64,' + entries[k].b64) : '', { headers: { 'Content-Type': 'audio/mpeg' } })).catch(function () {});
     });
    });
   }).catch(function () {});
   return true;
  } catch (e) { return false; }
 }
 function ensureBriefingAndGuideVoices(opts, cb) {
  cb = cb || noop;
  opts = opts || {};
  var source = str(opts.source || 'manual');
  if (!ST.unlocked && !vaultSessionActive()) { cb(new Error('locked'), null); return false; }
  if (!allowAutoGen()) { cb(new Error('gates'), null); return false; }
  if (!trimmedKey(str(resolveElevenKey()))) {
   if (source === 'unlock' || source === 'button' || source === 'briefing-open') paintBriefingVoiceBar('nokey');
   cb(new Error('no_key'), { stage: 'no_key' });
   return false;
  }
  if (bridgeBusy) {
   paintBriefingVoiceBar('busy');
   cb(new Error('busy'), { stage: 'busy' });
   return false;
  }
  loadVoicePack(function () {
   var delta = briefingVoiceDelta();
   if (!delta.total && !opts.force) {
    if (source === 'unlock' || source === 'button') paintBriefingVoiceBar('noop');
    cb(null, { made: 0, stage: 'noop' });
    return;
   }
   bridgeBusy = true;
   paintBriefingVoiceBar('checking');
   autoSynthesizeBriefingAndGuide({ source: source, noCommit: !!opts.noCommit, force: !!opts.force }, function (err, info) {
    bridgeBusy = false;
    if (err && str(err.message) === 'no_key') {
     paintBriefingVoiceBar('nokey');
     cb(err, { stage: 'no_key' });
     return;
    }
    if (err) {
     paintBriefingVoiceBar('error', err.message);
     cb(err, { stage: 'error' });
     return;
    }
    var made = info && info.made ? info.made : 0;
    /* Live-session injection + cache prime: the fresh beats are playable
       on the VERY NEXT briefing open, without any reload. */
    try {
     var fresh = {};
     var ks = ['_intro_male_1', '_intro_male_2', '_intro_male_3', '_intro_male_4'].concat(GUIDE_KEYS);
     for (var i = 0; i < ks.length; i++) {
      if (isObj(ST.voicePack.clips[ks[i]]) && str(ST.voicePack.clips[ks[i]].b64)) fresh[ks[i]] = ST.voicePack.clips[ks[i]];
     }
     if (global.SDP && SDP.Speech && SDP.Speech.injectClips) SDP.Speech.injectClips(fresh);
     primeClipCache(fresh);
    } catch (e1) {}
    paintBriefingVoiceBar('ok');
    cb(null, { made: made, stage: 'done' });
   });
  });
  return true;
 }

 /* ══ v0.0.6.m Pillar 2 — pool storage, health and rotation ═════════════ */
 function poolDefaultProvider(slotIndex) {
  var i = Number(slotIndex);
  if (!(i >= 0) || i >= POOL_DEFAULT_PROVIDERS.length) return 'groq';
  return POOL_DEFAULT_PROVIDERS[i];
 }
 function normalizePoolEntry(e, slotIndex) {
  var fallbackP = poolDefaultProvider(slotIndex);
  if (!isObj(e)) return { p: fallbackP, k: '' };
  var p = str(e.p);
  if (!p) p = fallbackP;
  if (!POOL_PROVIDERS[p]) p = fallbackP;
  return { p: p, k: trimmedKey(str(e.k)) };
 }
 function keyPoolEntries() {
  var raw = isObj(ST.secrets) && Array.isArray(ST.secrets.keyPool) ? ST.secrets.keyPool : [];
  var out = [], i;
  for (i = 0; i < KEY_POOL_SLOTS; i++) out.push(normalizePoolEntry(raw[i], i));
  return out;
 }
 function mergeKeyPoolInputs() {
  var pool = keyPoolEntries(), i, prov, inp, v;
  for (i = 0; i < KEY_POOL_SLOTS; i++) {
   prov = byId('kpProv' + (i + 1));
   inp = byId('kpSlot' + (i + 1));
   if (prov) pool[i].p = str(prov.value) || pool[i].p;
   if (inp) {
    v = trimmedKey(str(inp.value));
    if (v) pool[i].k = v;
    else if (inp.getAttribute('data-dirty') === '1') pool[i].k = '';
   }
  }
  if (!isObj(ST.secrets)) ST.secrets = {};
  ST.secrets.keyPool = pool;
  return pool;
 }
 function keyPoolCount() {
  var pool = keyPoolEntries(), n = 0, i;
  for (i = 0; i < pool.length; i++) if (str(pool[i].k)) n += 1;
  return n;
 }
 function elevenKeyPool() {
  /* Slot order is the rotation order: the primary ElevenLabs field first, */
  var out = [], seen = {};
  var primary = trimmedKey(str(ST.secrets.elevenKey) || fieldValue('elKeyInput'));
  if (looksLikeElevenKey(primary)) { out.push(primary); seen[primary] = 1; }
  var pool = keyPoolEntries(), i, k;
  for (i = 0; i < pool.length; i++) {
   k = str(pool[i].k);
   if (pool[i].p === 'elevenlabs' && looksLikeElevenKey(k) && !seen[k]) { out.push(k); seen[k] = 1; }
  }
  return out;
 }
 function llmKeyPool() {
  var out = [], pool = keyPoolEntries(), i;
  for (i = 0; i < pool.length; i++) {
   if (str(pool[i].k) && pool[i].p !== 'elevenlabs') out.push({ p: pool[i].p, k: str(pool[i].k) });
  }
  return out;
 }
 /* ══ v0.0.6.m: the 4× Groq rotation engine ══════════════════════════════
  * The four Groq slots (1 → 2 → 3 → 4) auto-rotate whenever any key hits
  * HTTP 429 (rate limit) or quota exhaustion, at $0 cost for the IPA /
  * Sinhala / lexical / pronunciation-verification work. Groq slots are
  * tried in order before the other LLM providers, so the free tier always
  * carries the load and a paid/free-tier Gemini or OpenRouter key is only
  * a graceful extra. */
 function groqKeyPool() {
  var out = [], pool = keyPoolEntries(), i;
  for (i = 0; i < pool.length; i++) {
   if (pool[i].p === 'groq' && str(pool[i].k)) out.push({ p: 'groq', k: str(pool[i].k), slot: i + 1 });
  }
  return out;
 }
 function llmCandidates(preferred) {
  /* The chosen provider + key first, then the two Groq slots in order
     (free-tier IPA / Sinhala / lexical engine leads), then the OpenRouter
     free-model slots, then any remaining LLM slots — the exact
     v0.0.6.m $0 cascade: Groq #1 → Groq #2 → OpenRouter #1 → OpenRouter #2,
     with the free dictionary APIs as the final no-key fallback. */
  var out = [], seen = {};
  var first = { p: str(preferred && preferred.p), k: str(preferred && preferred.k) };
  if (first.k && LLM_ENDPOINTS[first.p]) { out.push(first); seen[first.k] = 1; }
  var groq = groqKeyPool(), i;
  for (i = 0; i < groq.length; i++) {
   if (!seen[groq[i].k]) { out.push({ p: 'groq', k: groq[i].k }); seen[groq[i].k] = 1; }
  }
  var pool = llmKeyPool();
  for (i = 0; i < pool.length; i++) {
   if (!seen[pool[i].k]) { out.push({ p: pool[i].p, k: pool[i].k }); seen[pool[i].k] = 1; }
  }
  return out;
 }
 function logGroqRotation(reason, slot) {
  try {
   if (global.SDP && SDP.Diagnostics) {
    SDP.Diagnostics.log('groq_key_rotated', { reason: str(reason || ''), slot: Number(slot) || 0 });
   }
  } catch (e) {}
 }
 var poolCursor = 0;
 function resolveElevenKey() {
  var list = elevenKeyPool();
  if (!list.length) return trimmedKey(str(ST.secrets.elevenKey) || fieldValue('elKeyInput'));
  return list[Math.min(poolCursor, list.length - 1)];
 }
 function rotateElevenKey(reason) {
  var list = elevenKeyPool();
  if (list.length <= 1) return null;
  poolCursor = (poolCursor + 1) % list.length;
  var nextKey = list[poolCursor];
  try {
   if (global.SDP && SDP.Diagnostics) {
    SDP.Diagnostics.log('key_pool_rotated', { reason: str(reason || ''), slot: poolCursor + 1, keys: list.length });
   }
  } catch (e) {}
  return nextKey;
 }
 function probePoolKeys(cb) {
  var pool = keyPoolEntries();
  var elevenList = elevenKeyPool();
  var results = [], done = 0, i;
  var finishOne = function () {
   done += 1;
   if (done >= elevenList.length) { cb(null, results); }
  };
  if (!elevenList.length) { cb(null, []); return false; }
  for (i = 0; i < elevenList.length; i++) {
   (function (key, idx) {
    global.fetch(EL_SUBSCRIPTION, { headers: { 'xi-api-key': key, Accept: 'application/json' }, cache: 'no-store' })
     .then(function (res) { return res && res.json ? res.json() : null; })
     .then(function (json) {
      var tier = isObj(json) ? str(json.tier) : '';
      results.push({ slot: idx + 1, ok: !!tier, status: 200, tier: tier });
      finishOne();
     }, function () {
      results.push({ slot: idx + 1, ok: false, status: 0, tier: '' });
      finishOne();
     });
   })(elevenList[i], i);
  }
  return true;
 }

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

 /* D-S3: the studio version is READ */
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
 /* D-S4: settingsRev only ever moves */
 function nextSettingsRev() {
  var current = 0;
  try { current = Number((sync() && sync().version() && sync().version().settingsRev) || 0); } catch (e) { current = 0; }
  return Math.max(schemaVer(), current + 1);
 }
 /* D19/W8: ONE monotonic publish clock… */
 function nextSyncRev() {
  var prev = 0;
  try { prev = Number((sync() && sync().version() && sync().version().syncRev) || 0); } catch (e) { prev = 0; }
  return Math.max(Date.now(), prev + 1);
 }

 var ST = {
  unlocked: false,
  /* v0.0.6.b (S4): unpublished word edits — powers the tab-exit guard. */
  dirty: false,
  /* v0.0.6.c (F1): per-word delta recognition — wordsDirty is true only */
  wordsDirty: false,
  wordDeltas: [],
  envelope: '',
  secrets: {},
  message: '',
  messageState: '',
  words: [],
  preview: null,
  pendingClip: null,
  lastPublish: null,
  generating: false,
   /* Memory-only, never persisted, never… */
  pin: '',
  recording: false,
  recorder: null,
  quota: null,
  voicePack: { loaded: false, clips: {}, rev: 0 },
  testStatus: '',
  testState: '',
  /* D12–D15: the free-AI slot, the */
  aiProvider: 'free_dict',
  aiKey: '',
  masterStep: 0,
  masterDetail: '',
  enrichStatus: '',
  enriching: false,
  publishing: false,
  /* D4/D5: the non-fatal tier warning */
  tierWarn: '',
  layerOneRestored: false,
  /* R7 (F7): a master recovery unlock must prompt a fresh PIN immediately. */
  recoveryMode: false,
  wordsConfirmed: false,
  rawParsedWords: [],
  sessionNo: '',
  title: ''
 };
 var autoLockBound = false;

 /* D3/D17: busy-button helper — sets */
 function withBusy(btnOrId, workFn) {
  var btn = typeof btnOrId === 'string' ? byId(btnOrId) : btnOrId;
  if (!btn) { try { workFn(noop); } catch (e) {} return; }
  var orig = str(btn.textContent || '');
  btn.setAttribute('data-orig-label', orig);
  btn.setAttribute('data-busy', '1');
  btn.disabled = true;
  btn.textContent = T('studioWorking');
  function done() {
   try { btn.textContent = btn.getAttribute('data-orig-label') || orig; btn.removeAttribute('data-busy'); btn.disabled = false; } catch (e) {}
  }
  try { workFn(done); } catch (e) { done(); }
 }

 /* ══ envelope resolution (D-S7 */
 /* D5: the Layer-1 vault backup */
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
 /* D8/D9: repair a released */
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
  /* D8/D9: heal the config from the */
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
   /* D19: keep the real British */
   var cleanWord = { w: str(w.w), p: str(w.p), pos: str(w.pos), m: str(w.m), si: str(w.si), s: str(w.s) };
   if (str(w.audio)) cleanWord.audio = str(w.audio);
   clean.push(cleanWord);
  }
  list.words = clean;
  list.active = true;
  list.version = version;
  base.lists = lists;
  base.words = clean;
  /* D-L9: the cockpit reads */
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
  base.voiceId = activeVoiceId;
  base.voiceName = activeVoiceName;
  base.modelId = VOICE_MODEL;
  base.voiceModel = VOICE_MODEL;
  base.persona = VOICE_PERSONA;
  base.hashAlgo = HASH_ALGO;
  base.clips = packClipsForDisk();
  base.updatedAt = new Date().toISOString();
  /* D19: same publish clock as */
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
  /* D-S2: v0.0.1.b cloned config */
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

 /* ══ PIN unlock / first-time */
 function persistEnvelope(envelope) {
   /* D-S1/D5: survive a reload. memory */
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

 /* ══ R1: the ten classroom keys the */
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
 /* D7: the British English default rides */
 function classSettingsPayload() {
  var out = classSettingsSnapshot();
  if (out.lang === undefined) out.lang = 'en';
  return out;
 }
 function buildVaultFiles(cfgBody, versionBody, message) {
  return [
   { path: 'data/config.json', content: JSON.stringify(cfgBody, null, 2), message: str(message || 'Studio vault ' + appVersion()) },
   { path: 'data/version.json', content: JSON.stringify(versionBody, null, 2), message: 'Studio version ' + appVersion() }
  ];
 }
 /* config.json first, version.json LAST */
 function publishVaultFiles(files, token, cb) {
  cb = cb || noop;
  if (!sync() || !sync().publishFilesSequential) { cb(new Error('no_sync')); return false; }
  return sync().publishFilesSequential(files, token, noop, function (err, info) {
   if (!err) {
    try {
     var cfg = sync().config ? sync().config() : null;
     if (cfg) cfg.settingsRev = nextSettingsRev();
    } catch (e) {}
    bumpMeterCache();
   }
   cb(err, info);
  });
 }
 /* SYNC-03: copy the ten classroom */
 function saveClassSettings(cb) {
  cb = cb || noop;
  if (!ST.unlocked) { msg(t('studioLocked'), 'bad'); cb(new Error('locked')); return { ok: false, reason: 'locked' }; }
  /* v0.0.6.c (F1): word edits ride the SAME button — the unified pipeline */
  try { detectWordDeltas(); } catch (e) {}
  if (ST.wordsDirty && str(ST.secrets.ghToken)) {
   return publishWordsAndVoice(function (err, info) { cb(err, info); });
  }
  var conf = classSettingsPayload();
  if (!sync() || !sync().publishFilesSequential) { cb(new Error('no_sync')); return { ok: false, reason: 'no_sync' }; }
  var cfgBody = sync().config ? JSON.parse(JSON.stringify(sync().config() || {})) : {};
  cfgBody.classSettings = conf;
  var env = isRealEnvelope(ST.envelope) ? ST.envelope : configEnvelope();
  var token = str(ST.secrets.ghToken);
  function stamp(ok, detail) {
   var last = byId('lecturerSyncLast');
   if (!last) return;
   last.textContent = (ok ? t('lecturerSyncLast') : t('studioPublishFail')) + ' · ' +
    hhmm() + (detail ? ' · ' + detail : '');
   last.setAttribute('data-state', ok ? 'ok' : 'bad');
  }
  if (!token) {
   msg(t('studioNoToken'), 'bad');
   stamp(false, 'no token');
   clearBusy();
   cb(new Error('no_token'));
   return { ok: false, reason: 'no_token', classSettings: conf };
  }
  publishConfigAndVersion(cfgBody, env, 'Class settings rev', function (err, info, body) {
   var rev = Number((body && body.settingsRev) || 0);
   if (err) {
    /* D6: a failed publish NEVER prints */
    var why = publishReason(err, info);
    msg(t('studioPublishFail') + ' · ' + why, 'bad');
    stamp(false, why);
    clearBusy();
    cb(err, info);
    return;
   }
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
 /* SEC-03: with a placeholder */
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
   ST.message = ''; ST.messageState = '';
   mount();
   paintLecturerBar();
   loadVoicePack(noop);
   loadVoicePack(function () {
    paintPackDashboard();
    paintClipTable();
    /* v0.0.6.m Pillar 2: the moment the studio opens, the essential
       system clips are auto-checked (and the missing delta synthesized
       when an ElevenLabs key is configured). */
    autoEnsureSystemClips({ source: 'unlock', quiet: true }, noop);
    /* v0.0.6.n FIX 2 — Trigger 1 (Instant on PIN Unlock): the creator
       unlocked the vault — the device-local session cache of the active keys
       is stamped and the direct Studio ↔ Briefing bridge runs IMMEDIATELY
       with the live status bar (#studioBriefingVoiceBar), so the Project
       Overview beats + guide steps are synthesized with the real keys,
       injected into the live session, cached, and synced to GitHub. */
    markVaultSession();
    ensureBriefingAndGuideVoices({ source: 'unlock' }, noop);
   });
   cb(null, ST.secrets);
  }
  v.verifyPinVerifier(pin, verifier).then(function (ok) {
   if (!ok) {
    /* R7 (F7): BOOTSTRAP_PIN is the documented master recovery code. */
    if (isBootstrapPin(pin)) { recoveryOpen(cb); return; }
    msg(t('studioBadPin'), 'bad'); cb(new Error('bad_pin')); return;
   }
   ST.unlocked = true;
   ST.pin = str(pin);
   clearVaultLock();
   /* D9: decrypt the restored envelope */
   var env = configEnvelope();
   if (isRealEnvelope(env) && v.decryptV2) {
    v.decryptV2(env, str(pin)).then(function (secrets) { opened(secrets, env); }, function () { opened({}, ''); });
    return;
   }
   opened({}, '');
  }, function (err) {
   if (isBootstrapPin(pin)) { recoveryOpen(cb); return; }
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
  /* SEC-04: the persisted lockout is */
  if (v.isLocked && v.isLocked()) {
   if (isBootstrapPin(attempt)) { recoveryOpen(cb); return; }
   msg(t('studioLockedOut') + ' ' + v.lockRemaining() + ' ' + t('seconds'), 'bad');
   var early = new Error('locked');
   early.code = 'locked';
   cb(early);
   return;
  }
  /* D8: heal before resolving, so a */
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
    ST.message = ''; ST.messageState = '';
    mount();
    /* D4: #lecturerSyncBar appears */
    paintLecturerBar();
    /* SYNC-11: the committed clips must load */
    loadVoicePack(noop);
    loadVoicePack(function () {
     paintPackDashboard();
     paintClipTable();
     /* v0.0.6.m Pillar 2: unlock auto-checks the essential system clips. */
     autoEnsureSystemClips({ source: 'unlock', quiet: true }, noop);
    /* v0.0.6.n FIX 2 — Trigger 1 (Instant on PIN Unlock): the creator
       unlocked the vault — the device-local session cache of the active keys
       is stamped and the direct Studio ↔ Briefing bridge runs IMMEDIATELY
       with the live status bar (#studioBriefingVoiceBar), so the Project
       Overview beats + guide steps are synthesized with the real keys,
       injected into the live session, cached, and synced to GitHub. */
    markVaultSession();
    ensureBriefingAndGuideVoices({ source: 'unlock' }, noop);
    });
    /* SYNC-07 completion: a local */
    autoPublishVault(envelope);
    cb(null, ST.secrets);
   }, function (err) {
    /* R7: a forgotten PIN is never a dead end. */
    if (isBootstrapPin(attempt)) { recoveryOpen(cb); return; }
    if (err && err.code === 'locked') {
     msg(t('studioLockedOut') + ' ' + str(err.retrySec || 60) + ' ' + t('seconds'), 'bad');
    } else {
     msg(t('studioBadPin') + (err && err.triesLeft !== undefined ? ' · ' + err.triesLeft : ''), 'bad');
    }
    cb(err || new Error('bad_pin'));
   });
  });
 }
 /* SEC-03/SYNC-07: a cached vault with a */
 function autoPublishVault(envelope) {
  try {
   var cfg = sync() && sync().config ? sync().config() : null;
   if (!str(ST.secrets.ghToken) || !cfg) return false;
   if (isRealEnvelope(str(cfg.encVault))) return false;
   publishConfigAndVersion(null, envelope, 'Studio vault ' + appVersion(), noop);
   return true;
  } catch (e) { return false; }
 }

 /* D-S1/S2/S4: encrypt, persist */
 /* SEC-02: setup() may only run for an… */
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
   msg(t('studioEnvelope') + ' ', 'ok');
   mount();
   if (!str(secretsIn.ghToken) || !sync() || !sync().publishFilesSequential) {
    toast(t('vaultSavedToast'));
    cb(null, envelope);
    return;
   }
     /* SYNC-06: config + version (last) so a */
   publishConfigAndVersion(null, envelope, 'Studio vault ' + appVersion(), function (err, info) {
    if (err) { msg(t('studioPublishFail'), 'bad'); toast(t('vaultSavedToast')); cb(err, envelope); return; }
    msg(t('studioPublishOk') + ' · v' + appVersion(), 'ok');
    toast(t('vaultSavedToast') + ' · GitHub');
    cb(null, envelope, info);
   });
  }, function (err) { cb(err || new Error('encrypt_failed')); });
 }

 /* R5: lock always drops in-memory */
 function lock(keepStash) {
  /* v0.0.5.c Path D: locking the vault silences every voice — the TTS queue */
  try { if (SDP.Speech && SDP.Speech.stop) SDP.Speech.stop(); } catch (e) {}
  try { if (global.speechSynthesis && global.speechSynthesis.cancel) global.speechSynthesis.cancel(); } catch (e) {}
  ST.unlocked = false;
  ST.dirty = false;
  ST.wordsDirty = false;
  ST.wordDeltas = [];
  ST.secrets = {};
  ST.pin = '';
  try { if (vault() && vault().clear && !keepStash) vault().clear(); } catch (e) {}
  /* v0.0.6.d (D8): no Chrome "Save password?" popup on Lock either. */
  defusePasswordInputs(byId('studioBody'));
  mount();
  paintQuickButton();
  paintLecturerBar();
  return false;
 }
 /* D13: restore the same-tab stash ONCE */
 var stashRestoreTried = false;
 function restoreSessionStash() {
  if (stashRestoreTried) return false;
  stashRestoreTried = true;
  var v = vault(), secrets = null;
  if (ST.unlocked || !v || typeof v.read !== 'function') return false;
  try { secrets = v.read(); } catch (e) { return false; }
  if (!isObj(secrets)) return false;
  ST.secrets = secrets;
  ST.unlocked = true;
  ST.bootstrapMode = !isRealEnvelope(configEnvelope());
  ST.message = t('studioRestored');
  ST.messageState = 'ok';
  return true;
 }
 function setEnvelope(envelope) { ST.envelope = str(envelope); return ST.envelope; }
 function isUnlocked() { return !!ST.unlocked; }
 function secrets() { return isObj(ST.secrets) ? ST.secrets : {}; }

 /* ══ R8 / D13: the third vault slot */
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
   /* R8: a pasted key prefix auto-selects */
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
 /* D10: slot 2 is a zero-key LLM; slots */
 function aiNeedsLlm(provider, key) {
  var p = provider === undefined ? aiProviderName() : str(provider);
  var k = key === undefined ? aiProviderKey() : str(key);
  if (p === 'pollinations_free') return !!LLM_ENDPOINTS[p];
  if (p === 'groq' || p === 'openrouter' || p === 'gemini') return !!k && !!LLM_ENDPOINTS[p];
  return false;
 }

 /* ══ rendering… */
 /* v0.0.6.d (D8): the PIN length is a first-class fact. The default class */
 function activePinLen() {
  var n = 0;
  try { n = Number(layerOneVault().pinLen); } catch (e) { n = 0; }
  if (!(n >= PIN_MIN && n <= PIN_MAX)) n = Number(BOOTSTRAP_PIN.length) || 8;
  return Math.min(PIN_MAX, Math.max(PIN_MIN, n));
 }
 /* D7 / R4: the dot row renders exactly pinLen dots. */
 function pinDotCount(len) {
  return Math.min(PIN_MAX, Math.max(PIN_MIN, Number(len) || activePinLen()));
 }
 function pinDotsMarkup() {
  var shown = activePinLen();
  var html = '<div id="pinDots" class="pin-dots" data-dots="' + shown + '" aria-hidden="true">';
  for (var i = 1; i <= PIN_MAX; i++) {
   html += '<span class="pin-dot' + (i > shown ? ' pin-dot-extra' : '') + '" data-dot="' + i + '"></span>';
  }
  return html + '</div><p id="pinCompleteHint" class="pin-complete-hint" role="status" aria-live="polite" hidden></p>';
 }
 /* D-L2: the 56px PIN pad carries */
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
 /* One credential row = one input + ONE */
 /* One button factory — every studio */
 function lbl(forId, text) {
  return '<label class="lbl" for="' + forId + '">' + esc(text) + '</label>';
 }
 /* v0.0.5.c (GAP 2): one icon helper for every studio surface. */
 function ico(name, size) {
  try { if (SDP.Icons && SDP.Icons.icon) return SDP.Icons.icon(name, size || 16); } catch (e) {}
  return '';
 }
 function btn(id, label, css, attrs, icon) {
  return '<button type="button" class="btn btn-sm' + (css ? ' ' + css : '') + '" id="' + id + '"' +
   (attrs ? ' ' + attrs : '') + '>' + ico(icon, 16) +
   '<span class="i18n-label">' + esc(label) + '</span></button>';
 }
 function keyRowMarkup(inputId, label, placeholder, kind) {
  /* D1: data-pristine = untouched */
  return '<label class="lbl" for="' + inputId + '">' + esc(label) + '</label>' + '<div class="key-row">' +
   '<input id="' + inputId + '" class="input" type="password" autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-form-type="other" data-pristine="1" placeholder="' + esc(placeholder) + '">' +
   btn('btnToggle' + kind, t('studioShow'), '', 'aria-pressed="false"') +
   btn('btnPaste' + kind, t('studioPaste')) +
   btn('btnTest' + kind, kind === 'ElKey' ? t('studioTestEl') : (kind === 'Ai' ? t('studioTestAi') : t('studioTestGh'))) +
   btn('btnClear' + kind, t('studioClear')) + '</div>';
 }
 /* D1: the four credential fields */
 var SECRET_FIELDS = [
  { id: 'elKeyInput', key: 'elevenKey' }, { id: 'ghTokenInput', key: 'ghToken' },
  { id: 'studioAiKey', key: 'aiKey' }, { id: 'studioGasUrl', key: 'gasUrl' }
 ];
 function secretSnapshot() {
  var o = {}, i;
  for (i = 0; i < SECRET_FIELDS.length; i++) o[SECRET_FIELDS[i].key] = str(ST.secrets[SECRET_FIELDS[i].key]);
  return o;
 }
 /* D1: belt-and-braces — a field */
 function guardSecretMerge(prev) {
  var s = ST.secrets = isObj(ST.secrets) ? ST.secrets : {}, i, el, k;
  for (i = 0; i < SECRET_FIELDS.length; i++) {
   el = byId(SECRET_FIELDS[i].id); k = SECRET_FIELDS[i].key;
   if (!(el && el.getAttribute('data-dirty') === '1') && !str(s[k]) && str(prev && prev[k])) s[k] = str(prev[k]);
  }
  ST.aiKey = str(s.aiKey);
  return s;
 }
 /* D1: the explicit [Clear] — the */
 function clearSecretField(id, key) {
  var el = byId(id);
  if (el) { el.value = ''; el.setAttribute('data-dirty', '1'); el.removeAttribute('data-pristine'); try { el.focus(); } catch (e) {} }
  var s = ST.secrets = isObj(ST.secrets) ? ST.secrets : {};
  s[key] = '';
  if (key === 'aiKey') ST.aiKey = '';
  return true;
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
  /* v0.0.6.a Track 6: the four human-readable All-in-One stages. */
  var labels = [
   'Step 1 \u00b7 Verify vault & keys',
   'Step 2 \u00b7 Enrich the 30 words (IPA + Sinhala)',
   'Step 3 \u00b7 Voice pack sync \u2014 0 credits',
   'Step 4 \u00b7 Publish & broadcast to the class'
  ];
  var html = '<ol id="studioMasterSteps" class="studio-steps" aria-label="' +
   T('studioMasterSteps') + '">';
  for (var i = 0; i < labels.length; i++) {
   html += '<li data-step="' + (i + 1) + '" data-state="pending">' + labels[i] + '</li>';
  }
  return html + '</ol>';
 }
 /* D7: the green vault badge — real */
 function vaultBadgeVisible() {
  if (isRealEnvelope(configEnvelope())) return true;
  return isRealEnvelope(layerOneEnvelope());
 }
 function freeNoKeyVisible(provider) {
  var p = str(provider) || aiProviderName();
  return p === 'free_dict' || p === 'pollinations_free';
 }
 /* ══ Card 1 — rebuilt for */
 /* v0.0.6.m: the five pool slots — a provider select + a masked key input.
    Defaults ship the creator's exact architecture: Slots 1-4 = Groq free
    tier (auto-rotation on 429), Slot 5 = ElevenLabs backup voice key. */
 function keyPoolMarkup() {
  var pool = keyPoolEntries(), html = '<div id="studioKeyPool" class="kp-grid">', i, j;
  for (i = 0; i < KEY_POOL_SLOTS; i++) {
   var e = pool[i] || { p: poolDefaultProvider(i), k: '' };
   var hint = POOL_DEFAULT_HINTS[i] || POOL_PROVIDERS[e.p].keyHint;
   html += '<div class="kp-row"><span class="kp-no">Key Slot #' + (i + 1) + '</span>' +
    '<select id="kpProv' + (i + 1) + '" class="input kp-prov" aria-label="Key Slot #' + (i + 1) + ' provider">';
   for (j = 0; j < POOL_PROVIDER_ORDER.length; j++) {
    var pid = POOL_PROVIDER_ORDER[j];
    html += '<option value="' + pid + '"' + (pid === e.p ? ' selected' : '') + '>' + esc(POOL_PROVIDERS[pid].label) + '</option>';
   }
   html += '</select>' +
    '<input id="kpSlot' + (i + 1) + '" class="input kp-key" type="password" autocomplete="off" data-pristine="1"' +
    ' placeholder="' + esc(hint) + '" value="' + esc(e.k) + '"' +
    (e.k ? ' data-sealed="1"' : '') + '>' +
    '<span class="kp-badge" data-kp-badge="' + (i + 1) + '"' + (e.k ? ' data-on="1"' : '') + '>' + (e.k ? '●' : '○') + '</span></div>';
  }
  return html + '</div>';
 }
 /* v0.0.6.m Pillar 3: the Troubleshooting & Session Diagnostics Vault card — */
 function diagCardMarkup() {
  return '<details id="studioCardDiag" class="studio-card studio-card-diag">' +
   '<summary class="studio-h4"><span class="studio-step-tag">DIAG</span> Troubleshooting &amp; Session Diagnostics Vault</summary>' +
   '<div class="studio-diag-body">' +
   '<p class="muted">Privacy-safe ring buffer — audio tier fallbacks, clip errors, pronunciation flags, session stats, viewport responsiveness and end-to-end encrypted student reviews. Nothing personal is ever recorded.</p>' +
   '<div id="diagSummary" class="diag-grid" role="status" aria-live="polite"></div>' +
   '<div class="chip-row studio-diag-row">' +
   btn('btnDownloadDiagZip', ' Download Full Diagnostics &amp; Project Analysis (.zip)', 'btn-primary') +
   btn('btnClearDiag', ' Clear local diagnostics', 'btn-ghost') +
   '</div>' +
   '<p id="diagStatus" class="studio-msg" role="status" aria-live="polite"></p>' +
   '</div></details>';
 }
 /* ══ v0.0.6.m Pillar 4 — User Reviews & Session Telemetry drawer ════════
  * The creator's dedicated vault: every finished session is analysed for
  * authenticity (Genuine / Rapid-Skip / Incomplete) and sealed end-to-end
  * encrypted — whether the student sent a review OR tapped Skip. This
  * drawer summarises the counts, lists each session with its badge,
  * chips, note and ▶ voice playback, and exports the full .zip. */
 function reviewsCardMarkup() {
  return '<details id="studioCardReviews" class="studio-advanced-drawer studio-card-reviews">' +
   '<summary class="studio-h4">👨‍💻 User Reviews &amp; Session Telemetry (Developer / Creator Vault)</summary>' +
   '<div class="studio-adv-body">' +
   '<p class="muted">Every finished dictation session is captured with an authenticity verdict (✓ Genuine · ⚠ Rapid Skip · ⏳ Incomplete) — even when the student taps “Skip — no thanks”. Reviews, voice notes and telemetry are sealed AES-GCM (SDP_ENC_V2) before they ever touch storage.</p>' +
   '<div id="reviewsSummary" class="reviews-summary" role="status" aria-live="polite"></div>' +
   '<div id="studioReviewsList" class="studio-reviews-list"></div>' +
   '<div class="chip-row studio-reviews-row">' +
   btn('btnDownloadReviewsZip', ' Download User Reviews &amp; Full Telemetry (.zip)', 'btn-primary') +
   btn('btnRefreshReviews', ' Refresh', 'btn-ghost') +
   '</div>' +
   '<p id="reviewsStatus" class="studio-msg" role="status" aria-live="polite"></p>' +
   '</div></details>';
 }
 function keysCardMarkup() {
  return '<section id="studioCardKeys" class="studio-card studio-card-keys">' + '<h4 class="studio-h4"><span class="studio-step-tag">' + t('studioStep1', 'STEP 1 · ONE-TIME SETUP') + '</span>' + T('studioCardKeys') + '</h4>' +
   /* D2 (v0.0.2.a): the honest one-line status dashboard. */
   '<p id="studioPackDashboard" class="studio-pack-dashboard" role="status" aria-live="polite">' + esc(packDashboardText()) + '</p>' +
   keyRowMarkup('elKeyInput', 'ElevenLabs API key (sk_…)', 'sk_…', 'ElKey') +
   /* R4 (F5): one click proves the key AND the voice, before a single */
   '<div class="chip-row studio-verify-row">' + btn('btnVerifyEleven', t('studioVerifyEl'), 'btn-primary') + '</div>' +
   '<p id="elVerifyStatus" class="studio-msg" role="status" aria-live="polite"></p>' +
   keyRowMarkup('ghTokenInput', 'GitHub token (ghp_… / github_pat_…)', 'ghp_… / github_pat_…', 'GhToken') +
   '<label class="lbl" for="studioAiProvider">' + T('studioAiProvider') + '</label>' + aiProviderSelectMarkup() +
   '<p id="studioFreeNoKey" class="studio-free-badge"' + (freeNoKeyVisible() ? '' : ' hidden') + '>' + T('studioFreeNoKey') + '</p>' +
   keyRowMarkup('studioAiKey', t('studioAiKey'), 'gsk_… / AIza… / sk-or-…', 'Ai') +
   '<label class="lbl" for="studioGasUrl">Apps Script relay URL</label>' + '<div class="key-row">' + '<input id="studioGasUrl" class="input" type="url" autocomplete="off" data-pristine="1" placeholder="https://script.google.com/…">' + btn('btnClearGasUrl', t('studioClear')) + '</div>' +
   /* ══ v0.0.6.m Pillar 2: the Multi-API Key Pool (6-key $0 layout) ══ */
   '<label class="lbl">Multi-API Key Pool · 5 slots — 1× ElevenLabs Backup (credit-exhaustion failover) + 2× Groq Free Tier (auto-rotation on 429) + 2× OpenRouter Free Models (free LLM failover)</label>' +
   keyPoolMarkup() +
   '<div class="chip-row studio-pool-row">' +
   btn('btnProbePool', ' Check Pool Health &amp; Rotate') +
   btn('btnGenIntroClips', ' Generate Project Briefing Voice (Deep British Male · 4 clips)', 'btn-ghost') +
   '</div>' +
   '<p id="kpStatus" class="studio-msg" role="status" aria-live="polite"></p>' +
   '<div class="chip-row studio-compat-row">' +
   btn('btnCheckQuota', ' ' + t('studioTestEl'), '', 'style="display:none"') +
   btn('btnRefreshQuota', ' ' + t('quotaHeading'), '', 'style="display:none"') +
   '</div>' +
   '<div class="studio-primary-bar">' +
   btn('btnSaveKeys', t('studioSave'), 'btn-ghost') +
   btn('btnOneClickMasterSetup', t('studioOneClick'), 'btn-primary', 'data-primary-cta="1"') +
   '</div>' +
   /* D3/D4 (v0.0.2.a): verbatim live progress and a delta-only retry. */
   '<p id="studioGenProgress" class="studio-gen-progress" role="status" aria-live="polite">' + esc(genProgressText()) + '</p>' +
   '<div class="chip-row studio-retry-row"' + (ST.lastFailedClip ? '' : ' hidden') + '>' + btn('btnRetryFailedClip', t('studioRetryFailed'), 'btn-ghost') + '</div>' +
   '<label class="checkline" for="studioForceRegen"><input type="checkbox" id="studioForceRegen"> <span>' + T('forceRegenLabel') + '</span></label>' +
   '<input type="checkbox" id="chkForceRegen" style="display:none" aria-hidden="true" tabindex="-1">' +
   '<div class="chip-row studio-recovery-row"><button id="btnRecoverClips" type="button" class="btn btn-primary" data-action="recoverClips"> Recover Generated Clips From ElevenLabs History (0 Credits)</button></div>' +
   '<div class="chip-row studio-diagnostics-row">' +
   btn('btnTestOneWord', t('testOneWordBtn')) +
   btn('btnGenClips', t('genDeltaBtn'), 'btn-primary') +
   '</div>' +
   '<details class="studio-diag-drawer"><summary class="studio-h4">' + T('quotaHeading') + '</summary><div id="quotaInspectorCard" class="studio-quota">' +
   '<p id="quotaText" class="muted" role="status" aria-live="polite">' + T('quotaHeading') + '</p>' +
   '<p class="lbl">' + T('costPreviewLabel') + '</p>' + '<p id="costPreviewLine" class="muted">' + esc(costPreviewLine()) + '</p>' +
   '<div id="clipPreviewTable" class="studio-preview"></div></div></details>' +
   '<p id="studioVaultBadge" class="studio-vault-badge"' + (vaultBadgeVisible() ? '' : ' hidden') + '>' + T('vaultBadgeLabel') + '</p>' +
   '</section>';
 }
 /* v0.0.6.a Track 6: live "N / 30 Words Recognized" pill + spring CTA. */
 /* ══ v0.0.6.c (F1): true per-word delta recognition ═══════════════════ */
 function committedWords() {
  var out = [];
  try { out = sync() && sync().words ? sync().words() : []; } catch (e) { out = []; }
  return Array.isArray(out) ? out : [];
 }
 function liveStudioWords() {
  /* F1: the structured ST.words list (what the word manager edits) is the */
  var bulkEl = byId('studioBulkWords');
  var bulkActive = !!(bulkEl && str(fieldValue('studioBulkWords')) &&
   (bulkEl.getAttribute('data-dirty') === '1' || document.activeElement === bulkEl));
  if (bulkActive) return parseBulkWords(fieldValue('studioBulkWords'));
  if (ST.words && ST.words.length) return ST.words;
  return committedWords();
 }
 /* F1: before the studio is unlocked/mounted with real content the delta */
 function deltaDetectionReady() {
  return !!(ST.unlocked && (str(fieldValue('studioBulkWords')) || (ST.words && ST.words.length)));
 }
 function wordFieldSig(w) {
  return [str(w && w.w).toLowerCase(), str(w && w.p), str(w && w.pos),
   str(w && w.m), str(w && w.si), str(w && w.s)].join('~');
 }
 /* F1: a live word is a DELTA only when its spelling is new/renamed, or */
 function wordIsDelta(live, prior) {
  if (!prior) return true;
  var fields = ['p', 'pos', 'm', 'si', 's'], changed = 0, present = 0, i;
  for (i = 0; i < fields.length; i++) {
   var v = str(live && live[fields[i]]);
   if (!v) continue;
   present++;
   if (v !== str(prior[fields[i]])) changed++;
  }
  return present > 0 && changed > 0;
 }
 function detectWordDeltas() {
  if (!deltaDetectionReady()) { ST.wordsDirty = false; ST.wordDeltas = []; return []; }
  var live = liveStudioWords();
  var base = {};
  var committed = committedWords();
  var i, deltas = [];
  for (i = 0; i < committed.length; i++) {
   base[str(committed[i] && committed[i].w).toLowerCase()] = committed[i];
  }
  /* v0.0.6.d (D2): slot-by-slot comparison. When the spelling at slot i */
  for (i = 0; i < live.length; i++) {
   var w = str(live[i] && live[i].w);
   if (!w) continue;
   var prior = base[w.toLowerCase()] || null;
   var slotPrior = (i < committed.length && str(committed[i] && committed[i].w).toLowerCase() === w.toLowerCase()) ? committed[i] : null;
   var renamed = !!(committed.length && i < committed.length && str(committed[i] && committed[i].w).toLowerCase() !== w.toLowerCase());
   if (renamed) {
    /* A replaced spelling: brand-new enrichment state, nothing carried over. */
    if (isObj(live[i])) {
     live[i].p = str(live[i].p) && !str(slotPrior && slotPrior.p) ? str(live[i].p) : '';
     if (!slotPrior || str(live[i].p) === str(slotPrior.p)) live[i].p = '';
     live[i].pos = ''; live[i].m = ''; live[i].si = ''; live[i].s = '';
    }
    deltas.push({ w: w, index: i, prior: null, renamed: true });
    continue;
   }
   if (wordIsDelta(live[i], prior)) deltas.push({ w: w, index: i, prior: prior });
  }
  ST.wordDeltas = deltas.slice(0, 3);
  ST.wordsDirty = deltas.length > 0;
  /* F1: any word change is an unsaved change for the tab-exit guard too. */
  if (ST.wordsDirty) ST.dirty = true;
  return deltas;
 }
 /* A replaced word must lose the OLD word's stale IPA/meaning so the fast */
 function clearStaleEnrichOnDeltas(deltas) {
  var i, k, changed = {};
  for (i = 0; i < (deltas || []).length; i++) changed[str(deltas[i].w).toLowerCase()] = true;
  for (i = 0; i < (ST.words || []).length; i++) {
   var w = str(ST.words[i] && ST.words[i].w).toLowerCase();
   if (!changed[w]) continue;
   for (k = 0; k < ST.words.length; k++) {
    var other = str(ST.words[k] && ST.words[k].w).toLowerCase();
    if (k !== i && other === w) break;
   }
   ST.words[i].p = ''; ST.words[i].pos = ''; ST.words[i].m = '';
   ST.words[i].si = ''; ST.words[i].s = '';
  }
  return true;
 }
 /* The RED unsaved-changes warning state on #lecturerSyncBar / */
 function paintDirtyState() {
  var dirty = !!(ST.unlocked && ST.dirty);
  var ids = ['lecturerSyncBar', 'btnSyncClassSettings', 'studioSecurityBar', 'btnPublishWordsAndVoice'];
  for (var i = 0; i < ids.length; i++) {
   var node = byId(ids[i]);
   if (!node || !node.setAttribute) continue;
   if (dirty) node.setAttribute('data-dirty', 'true');
   else node.removeAttribute('data-dirty');
  }
  var bar = byId('lecturerSyncBar');
  if (bar && bar.setAttribute && !dirty) bar.setAttribute('data-synced', 'true');
  else if (bar && bar.removeAttribute) bar.removeAttribute('data-synced');
  paintWordCountPill();
  return dirty;
 }
 function deltaPillSuffix() {
  if (!ST.wordsDirty || !ST.wordDeltas.length) return '';
  var names = [], i;
  for (i = 0; i < ST.wordDeltas.length; i++) names.push('\u201c' + ST.wordDeltas[i].w + '\u201d');
  var more = ST.wordDeltas.length >= 3 ? '\u2026' : '';
  return ' \u26a0\ufe0f ' + ST.wordDeltas.length + ' ' + t('studioWordModified', 'word(s) modified') +
   ' (' + names.join(', ') + more + ') \u2014 ' + t('studioClickBroadcast', 'click Broadcast to auto-enrich & sync');
 }
 function wordCountPillText(n) {
  var full = n >= 30;
  /* v0.0.6.c (F1): even at 30/30 the pill names the modified word(s). */
  return String(n) + ' / 30 ' + T('studioWordsRecognized') + (full ? ' \u2713' : '') + deltaPillSuffix();
 }
 function paintWordCountPill() {
  var host = byId('studioWordCountPill');
  if (!host) return false;
  var words = parseBulkWords(fieldValue('studioBulkWords') || wordsToText(ST.words));
  setText(host, wordCountPillText(words.length));
  host.setAttribute('data-full', words.length >= 30 ? 'true' : 'false');
  return true;
 }
 function pulseOneClickCTA() {
  var node = byId('btnOneClickMasterSetup') || byId('btnPublishWordsAndVoice');
  if (!node || !node.classList) return false;
  node.classList.remove('sdp-cta-pop');
  void node.offsetWidth;
  node.classList.add('sdp-cta-pop');
  return true;
 }
 /* ══ Card 2 — the 30-word editor */
 function wordsCardMarkup() {
  var words = ST.words.length ? ST.words : (sync() && sync().words ? sync().words() : []);
  var names = [];
  for (var i = 0; i < words.length; i++) if (str(words[i] && words[i].w)) names.push(str(words[i].w));
  return '<section id="studioCardWords" class="studio-card studio-card-words">' + '<h4 class="studio-h4"><span class="studio-step-tag">' + t('studioStep2', 'STEP 2 · PASTE 30 WORDS') + '</span>' + T('studioCardWords') + '</h4>' + '<label class="lbl" for="studioBulkWords">' + T('studioBulkWords') + '</label>' +
   '<p id="studioWordCountPill" class="studio-word-count-pill" role="status" aria-live="polite">' + esc(wordCountPillText(names.length)) + '</p>' +
   '<div class="studio-session-row">' +
   '<label class="lbl" for="studioSessionNoInput">' + t('sessionNoLabel', 'Session No') + '</label>' +
   '<input id="studioSessionNoInput" class="input" type="text" maxlength="4" inputmode="numeric" autocomplete="off" value="' + esc(str(ST.sessionNo || liveSessionNo())) + '">' +
   '<label class="lbl" for="studioSessionTitleInput">' + t('sessionTitleLabel', 'Session Topic / Title') + '</label>' +
   '<input id="studioSessionTitleInput" class="input" type="text" maxlength="80" autocomplete="off" value="' + esc(str(ST.title || liveSessionTitle())) + '">' +
   '</div>' +
   '<p id="studioWordsCountHelper" class="studio-count-helper" role="status" aria-live="polite" data-state="under"></p>' +
   '<textarea id="studioBulkWords" spellcheck="false" rows="6">' + esc(names.join('\n')) + '</textarea>' +
   '<div class="chip-row studio-util-row">' +
   btn('btnStudioPasteWords', t('pasteWords', '\ud83d\udccb Paste'), 'btn-ghost') +
   btn('btnStudioClearWords', t('clearWords', '\ud83e\uddf9 Clear'), 'btn-ghost') +
   btn('btnStudioConfirmWords', t('confirmWords', '\u2713 Confirm Edited Words'), 'btn-primary') + '</div>' +
   '<div id="studioLiveChips" class="studio-live-chips" role="list" aria-label="' + esc(t('liveChipsLabel', 'Live word chips')) + '"></div>' +
   '<p id="studioWordsStatusBanner" class="studio-msg" role="status" aria-live="polite"></p>' +
   '<p id="studioEnrichStatus" class="studio-msg" role="status" aria-live="polite"></p>' +
   '<div class="chip-row">' + btn('btnEnrichWords', t('studioEnrich'), 'btn-ghost') +
   btn('btnPreviewWords', t('studioPreview')) + btn('btnPublishWords', t('studioPublish'), 'btn-primary') +
   btn('btnPublishWordsAndVoice', t('studioOneClickFull'), 'btn-primary', 'data-primary-cta="1" data-one-click="1"', 'sparkles') + '</div>' +
   '<p class="studio-sub">' + T('studioOneClickSub') + '</p>' + masterStepsMarkup() +
   '<details class="studio-word-inspector"><summary class="studio-h5">' + ico('list', 16) + 'Inspect & Edit Individual Words (IPA / Sinhala / Audio Preview)</summary>' +
   '<div class="studio-insp-body">' + '<label class="lbl" for="studioWords">' + T('studioEditor') + '</label>' + '<textarea id="studioWords" spellcheck="false">' + esc(wordsToText(words)) + '</textarea>' +
   '<p id="studioCount" class="studio-msg">' + words.length + ' ' + T('studioWordsCount') + '</p>' +
   '<h5 class="studio-h5">' + T('studioWordManager') + '</h5>' +
   '<div id="studioWordManager" class="studio-word-manager"></div>' + '<div id="studioPreview" class="studio-preview"></div>' + '<p class="muted">' + T('studioElevenNote') + '</p>' + '</div></details></section>';
 }
 /* ══ Card 3 — classroom settings */
 function settingsCardMarkup() {
  return '<section id="studioCardSettings" class="studio-card studio-card-settings">' + '<h4 class="studio-h4"><span class="studio-step-tag">' + t('studioStep3', 'STEP 3 · BROADCAST TO CLASS') + '</span>' + T('studioCardSettings') + '</h4>' +
   '<label class="lbl" for="studioNewPin">' + T('studioPinLabel') + ' — new (4–8 digits)</label>' +
   '<input id="studioNewPin" class="input pin-mask" type="text" inputmode="numeric" autocomplete="off" ' +
   'autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" ' +
   'data-form-type="other" maxlength="8" minlength="4" aria-label="New lecturer PIN">' + '<label class="lbl" for="studioConfirmPin">' + T('studioPinLabel') + ' — confirm</label>' +
   '<input id="studioConfirmPin" class="input pin-mask" type="text" inputmode="numeric" autocomplete="off" ' +
   'autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" ' +
   'data-form-type="other" maxlength="8" minlength="4" aria-label="Confirm lecturer PIN">' + btn('btnChangePin', t('studioChangePinBtn'), 'btn-ghost', 'data-atomic-pin="1"') + btn('btnStudioSyncSettings', t('studioSyncSettings'), 'btn-primary') +
   '<div class="studio-lock-row">' + btn('btnLockStudio', t('studioLockLecturer'), 'btn-ghost') + '</div>' +
   '<h4 class="studio-h4">' + T('studioRecord') + '</h4>' + '<div class="chip-row">' + btn('btnStudioRecord', t('studioRecord')) +
   btn('btnCommitClip', t('studioCommitClip'), 'btn-primary', 'disabled') + '</div>' +
   '<audio id="recPreviewAudio" controls preload="none" class="rec-preview"></audio>' + '<p class="studio-hint" data-i18n="studioAskLecturer">' + T('studioAskLecturer') + '</p>' + '</section>';
 }
 /* D18: three outcome cards under */
 /* D19: compact sub-label, no */
 function securityBarMarkup() {
  /* v0.0.6.b (S4): the high-visibility Lecturer Mode bar — Lock or Publish */
  return '<div id="studioSecurityBar" class="studio-security-bar" role="region" aria-live="polite">' +
   '<span class="ssb-badge">' + ico('unlock', 16) + T('ssbUnlocked') + '</span>' +
   '<span class="studio-mode-pill">Lecturer Mode Unlocked</span>' +
   btn('btnSsbPublish', t('guardPublish'), 'btn-primary', 'data-primary-cta="1"', 'upload') +
   btn('btnSsbLock', t('studioLockLecturer'), 'btn-ghost', '', 'lock') +
   '</div>';
 }
 function unlockedMarkup() {
  return securityBarMarkup() +
   '<p id="studioMsg" class="studio-msg" role="status" aria-live="polite"></p>' + '<p id="studioTestStatus" class="studio-msg" role="status" aria-live="polite"></p>' +
   '<div id="studioErrorAssistant" class="studio-error-assistant" data-state="hidden" role="region" aria-live="polite"></div>' +
   /* v0.0.6.n FIX 2 — Trigger 3: the dedicated 1-click bridge control and
      its live status bar sit at the VERY TOP of the Lecturer Studio: force
      regenerate + preview the 4 Project Overview beats and 4 guide steps
      with the stored keys anytime, and watch the GitHub & live-cache sync. */
   '<section id="studioCardBriefingVoices" class="studio-card studio-card-briefing-voices">' +
   '<h4 class="studio-h4"><span class="studio-step-tag">STUDIO ↔ BRIEFING BRIDGE</span>Project Overview &amp; Guide Voices</h4>' +
   '<div class="chip-row studio-bridge-row">' +
   btn('btnStudioBriefingVoices', '🎙 Generate &amp; Sync Project Overview + Guide Voices Now', 'btn-primary') +
   btn('btnPreviewBriefingBeat', '▶ Preview Beat 1', 'btn-ghost') +
   '</div>' +
   '<p id="studioBriefingVoiceBar" class="studio-briefing-voice-bar" role="status" aria-live="polite" data-state="idle">🎙 Project Overview &amp; Guide voices are checked automatically on unlock — or press Generate below.</p>' +
   '</section>' +
   /* R7 (F7): words first — editing vocabulary is the daily job. Card order */
   wordsCardMarkup() +
   '<div id="studioSyncSlot" class="studio-sync-slot"></div>' +
   '<details id="studioAdvancedDrawer" class="studio-advanced-drawer"><summary class="studio-h4">' + ico('gear', 16) + T('studioAdvancedToggle') + '</summary>' +
   '<div class="studio-adv-body">' + settingsCardMarkup() + keysCardMarkup() + diagCardMarkup() + '</div></details>' +
   /* v0.0.6.m Pillar 4: the dedicated User Reviews & Session Telemetry
      drawer sits right below Advanced Tools & the Word Inspector. */
   reviewsCardMarkup();
 }
 /* R5/SEC-01: while locked the body */
 function lockedMarkup() {
  return '<div id="studioGate" class="studio-gate" role="group" aria-label="' + T('studioPinLabel') + '">' +
   '<p class="muted">' + T('studioLocked') + '</p>' +
   '<div class="pin-row">' + '<label class="for-only" for="studioPin">' + T('studioPinLabel') + '</label>' + '<input id="studioPin" class="input pin-mask" type="text" readonly inputmode="none" tabindex="-1" aria-hidden="true" autocomplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other" maxlength="8" minlength="4" placeholder="' + T('studioPinLabel') + '">' +
   '<button type="button" class="btn btn-sm" id="pinPadBack" aria-label="Delete last digit">⌫</button>' + '</div>' +
   pinDotsMarkup() +
   pinPadMarkup() +
   '<p id="studioMsg" class="studio-msg" role="status" aria-live="polite"></p>' + '<p class="studio-hint" data-i18n="studioAskLecturer">' + T('studioAskLecturer') + '</p>' +
   '</div>';
 }

 /* ══ D2/D18 (v0.0.2.a): the honest 34-clip dashboard ═════════════════════ */
 function clipCount() {
  var clips = isObj(ST.voicePack.clips) ? ST.voicePack.clips : {};
  var n = 0, k;
  for (k in clips) {
   if (!Object.prototype.hasOwnProperty.call(clips, k)) continue;
   if (clipExists(k)) n += 1;
  }
  return n;
 }
 function packDashboardText() {
  var vault = vaultBadgeVisible() ? t('studioPackVault') : 'Vault: —';
  var gh = str(ST.secrets.ghToken) ? t('studioPackGithub') : 'GitHub: —';
  /* v0.0.6.m Pillar 2: the immutable static vault is part of the honest */
  var stats = staticVaultStats();
  var pool = keyPoolCount();
  return vault + ' | ' + gh + ' | ' + t('studioPackClips') + clipCount() + t('studioClipsUnit') +
   ' | Static vault ' + stats.locked + '/' + stats.total + ' locked | Key pool ' + pool + '/' + KEY_POOL_SLOTS;
 }
 function paintPackDashboard() {
  var node = byId('studioPackDashboard');
  if (!node) return false;
  node.textContent = packDashboardText();
  return true;
 }
 function genProgressText() {
  return str(ST.genProgress) || (t('studioPackClips') + clipCount() + t('studioClipsUnit'));
 }
 /* D4: the retry row is visible only while a real failure is on record. */
 function paintRetryRow() {
  var btn = byId('btnRetryFailedClip');
  var row = btn && btn.parentNode;
  var shown = !!(ST.lastFailedClip && ST.lastFailedClip.key);
  if (row && row.setAttribute) {
   if (shown) row.removeAttribute('hidden'); else row.setAttribute('hidden', 'hidden');
  }
  if (shown && btn) btn.textContent = t('studioRetryOne') + ' ' + ST.lastFailedClip.key;
  return shown;
 }
 function paintGenProgress(text) {
  if (text !== undefined) ST.genProgress = str(text);
  var node = byId('studioGenProgress');
  if (node) node.textContent = genProgressText();
  if (ST.unlocked) paintRetryRow();
  return true;
 }
 /* D7: the single #lecturerSyncBar element hops into Card 3 while unlocked and */
 function lecturerBarNode() {
  var bar = byId('lecturerSyncBar');
  if (bar) ST.lecturerBar = bar;
  return ST.lecturerBar || null;
 }
 function stashLecturerBar() {
  var bar = lecturerBarNode();
  if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
  return bar;
 }
 function placeLecturerBar() {
  var bar = lecturerBarNode();
  if (!bar) return false;
  var slot = byId('studioSyncSlot');
  var dock = byId('studioSyncDock');
  var target = (ST.unlocked && slot) ? slot : dock;
  if (target && bar.parentNode !== target) target.appendChild(bar);
  return true;
 }

 /* v0.0.6.d (D8): Chrome fires its "Save password?" heuristic the moment a */
 function defusePasswordInputs(host) {
  try {
   var inputs = host && host.querySelectorAll ? host.querySelectorAll('input[type="password"]') : [];
   for (var i = 0; i < inputs.length; i++) {
    try { inputs[i].type = 'text'; } catch (e) {}
    try { inputs[i].value = ''; } catch (e) {}
   }
  } catch (e2) {}
  return true;
 }

 function mount() {
  /* D8: the Layer-1 self-heal runs before */
  try { healFromLayerOne(); } catch (e) {}
  /* D13: same-tab reload restores the */
  try { restoreSessionStash(); } catch (e) {}
  var host = byId('studioBody');
  if (!host) return false;
  /* D7: the ONE #lecturerSyncBar node survives every re-render. */
  stashLecturerBar();
  defusePasswordInputs(host);
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
  if (ST.unlocked) {
   paintLiveChips();
   paintWordsHelper();
   paintDiagSummary();
   /* v0.0.6.m Pillar 4: the reviews drawer feed + the ▶ voice-note player. */
   paintReviewsDrawer();
   bindReviewsDrawer();
  }
  paintAiFields();
  placeLecturerBar();
  paintPackDashboard();
  paintGenProgress();
  try { detectWordDeltas(); } catch (e) {}
  if (deltaDetectionReady()) paintDirtyState();
  try { if (SDP.Views && SDP.Views.paintLecturerBar) SDP.Views.paintLecturerBar(); } catch (e) {}
  try { if (SDP.Views && SDP.Views.paintLecturerBanner) SDP.Views.paintLecturerBanner(); } catch (e) {}
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
 /* D7 (Layer 3): auto-fill every */
 /* D1: every painted field starts */
 function paintSecretFields() {
  var sec = secrets();
  var map = { elKeyInput: 'elevenKey', ghTokenInput: 'ghToken', studioGasUrl: 'gasUrl', studioAiKey: 'aiKey' };
  for (var id in map) {
   if (!Object.prototype.hasOwnProperty.call(map, id)) continue;
   var node = byId(id), val = str(sec[map[id]]);
   if (!node) continue;
   if (val) node.value = val;
   node.setAttribute('data-pristine', '1');
   node.removeAttribute('data-dirty');
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
  /* D5 + v0.0.5.c: dual-tone lock icon + words, never a bare glyph, and the */
  btn.innerHTML = ico(ST.unlocked ? 'unlock' : 'lock', 16) + '<span class="i18n-label studio-quick-label"></span>';
  var lbl = btn.querySelector ? btn.querySelector('.studio-quick-label') : null;
  if (lbl) lbl.textContent = ST.unlocked ? t('lecturerAdminUnlocked') : t('lecturerAdminLocked');
  btn.setAttribute('aria-label', ST.unlocked
   ? t('lecturerAdminUnlocked') + ' — open the Lecturer Admin Studio'
   : t('lecturerAdminLocked') + ' — open the Lecturer Admin Studio');
  btn.setAttribute('data-state', ST.unlocked ? 'unlocked' : 'locked');
  return true;
 }

 function activePinInput() {
  /* SEC-03: locked view has exactly */
  return byId('studioPin');
 }
 function pinValue() { var n = activePinInput(); return n ? str(n.value) : ''; }
 function setPinValue(v) {
  var n = activePinInput();
  if (!n) return '';
  /* R4 / D7: a lecturer PIN may be 4–8 */
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
  /* v0.0.6.d (D8): exactly pinLen dots are shown; the extra pool stays in */
  var shown = pinDotCount(activePinLen());
  for (var i = 0; i < dots.length; i++) {
   if (i < len) dots[i].classList.add('on'); else dots[i].classList.remove('on');
   if (i >= shown) dots[i].classList.add('pin-dot-off'); else dots[i].classList.remove('pin-dot-off');
  }
  host.setAttribute('data-filled', String(len));
  host.setAttribute('data-dots', String(shown));
  /* D8: the clear "✓ PIN Complete" moment once every digit is in. */
  var hint = byId('pinCompleteHint');
  if (hint) {
   if (len > 0 && len >= shown) {
    hint.hidden = false;
    hint.textContent = t('pinComplete', '✓ PIN Complete');
    host.setAttribute('data-complete', 'true');
   } else {
    hint.hidden = true;
    host.setAttribute('data-complete', 'false');
   }
  }
  return true;
 }
 /* D15: the 4-step one-click */
 function paintMasterSteps() {
  var host = byId('studioMasterSteps');
  if (!host) return false;
  var items = host.querySelectorAll ? host.querySelectorAll('li[data-step]') : [];
  var stateIcons = { pending: '\u25cb', active: '\u23f3', ok: '\u2705', bad: '\u26a0\ufe0f' };
  for (var i = 0; i < items.length; i++) {
   var step = Number(items[i].getAttribute('data-step'));
   var state = 'pending';
   if (ST.masterStep > step) state = 'ok';
   else if (ST.masterStep === step) state = ST.masterDetail || 'active';
   else state = 'pending';
   items[i].setAttribute('data-state', state);
   var span = items[i].querySelector ? items[i].querySelector('.studio-step-state') : null;
   if (!span) {
     span = doc.createElement('span');
     span.className = 'studio-step-state';
     items[i].insertBefore(span, items[i].firstChild);
   }
   span.textContent = stateIcons[state] || '\u25cb';
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

 /* ══ D-L7: one delegated listener */
 function bindDelegated() {
  var host = byId('studioAccordion');
  if (!host || host._sdpDelegated) return false;
  host._sdpDelegated = true;
  host.addEventListener('click', onStudioClick, false);
  host.addEventListener('input', onStudioInput, false);
  host.addEventListener('change', onStudioChange, false);
  host.addEventListener('focusout', function (ev) {
   if (ownerId(ev && ev.target, host) === 'studioBulkWords') { paintWordCountPill(); scheduleAutoEnrich(); }
  }, false);
  var scr = byId('screen-studio');
  if (scr && !scr._sdpKeyBound) {
   scr._sdpKeyBound = true;
   scr.addEventListener('keydown', onStudioKeydown, false);
  }
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
 /* v0.0.4.a W2: debounced zero-touch auto-enrichment while typing words. */
 function scheduleAutoEnrich() {
  try { if (ST.autoEnrichTimer) global.clearTimeout(ST.autoEnrichTimer); } catch (e) {}
  ST.autoEnrichTimer = global.setTimeout(function () {
   ST.autoEnrichTimer = null;
   paintWordCountPill();
   var recognized = parseBulkWords(fieldValue('studioBulkWords') || '').length >= 30;
   enrichWords(fieldValue('studioBulkWords'), { force: false }, function () {
    paintWordManager();
    if (recognized) pulseOneClickCTA();
   });
  }, 400);
 }
 /* v0.0.4.a W3: physical-keyboard PIN entry on the locked gate — the mobile */
 function onStudioKeydown(ev) {
  if (!byId('studioGate')) return;
  var t = ev && ev.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && t.id !== 'studioPin') return;
  var k = ev && ev.key;
  if (/^[0-9]$/.test(str(k))) {
   appendPin(str(k));
   if (ev.preventDefault) ev.preventDefault();
  } else if (k === 'Backspace') {
   backspacePin();
   if (ev.preventDefault) ev.preventDefault();
  } else if (k === 'Enter') {
   unlock(pinValue(), noop);
   if (ev.preventDefault) ev.preventDefault();
  }
 }
 function onStudioInput(ev) {
  var target = ev && ev.target;
  var id = ownerId(target, byId('studioAccordion'));
  /* D1: a real keystroke makes that */
  if (id === 'elKeyInput' || id === 'ghTokenInput' || id === 'studioAiKey' || id === 'studioGasUrl') {
   if (target && target.getAttribute) {
    target.removeAttribute('data-pristine');
    target.setAttribute('data-dirty', '1');
   }
  }
  if (id === 'studioWords') {
   var editor = byId('studioWords');
   ST.dirty = true;
   ST.words = parseWords(editor ? editor.value : '');
   detectWordDeltas();
   setText(byId('studioCount'), ST.words.length + ' ' + t('studioWordsCount'));
   setText(byId('costPreviewLine'), costPreviewLine(ST.words));
   paintWordManager();
  } else if (id === 'studioBulkWords') {
   ST.dirty = true;
   setStudioWords(parseBulkWords(fieldValue('studioBulkWords')), 'bulk');
   detectWordDeltas();
   clearStaleEnrichOnDeltas(ST.wordDeltas);
   paintDirtyState();
   scheduleAutoEnrich();
   paintLiveChips();
   paintWordsHelper();
  } else if (id === 'studioSessionNoInput') {
   ST.sessionNo = str(target.value).replace(/[^0-9]/g, '');
   ST.dirty = true;
  } else if (id === 'studioSessionTitleInput') {
   ST.title = str(target.value);
   ST.dirty = true;
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
  if (target && target.getAttribute && target.getAttribute('data-wm')) { ST.dirty = true; var okWm = applyWordManagerEdit(target, true); detectWordDeltas(); paintDirtyState(); return okWm; }
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
 /* D10: on clipboard failure */
 function pasteInto(inputId, done) {
  var node = byId(inputId);
  if (!node) { done(new Error('no_field')); return; }
  function focusNode() { try { if (node.focus) node.focus(); } catch (e) {} try { if (node.select) node.select(); } catch (e) {} }
  var clip = global.navigator && global.navigator.clipboard;
  if (clip && typeof clip.readText === 'function') {
   clip.readText().then(function (text) { node.value = str(text); done(null, node.value); }, function () { focusNode(); done(new Error('paste_denied')); });
   return;
  }
  focusNode(); done(new Error('paste_unsupported'));
 }

 /* D3/D15/D17: dead btnStudioUnlock */
 var CLICK_ACTIONS = {
  btnRecoverClips: function () { recoverFromHistory(noop); },
  recoverClips: function () { recoverFromHistory(noop); },
  pinPadClear: function () { setPinValue(''); },
  pinPadBack: function () { backspacePin(); },
  pinPadUnlock: function () { unlock(pinValue(), noop); },
  btnToggleElKey: function () { toggleSecretField('elKeyInput', byId('btnToggleElKey')); },
  btnToggleGhToken: function () { toggleSecretField('ghTokenInput', byId('btnToggleGhToken')); },
  btnToggleAi: function () { toggleSecretField('studioAiKey', byId('btnToggleAi')); },
  btnPasteElKey: function () { pasteInto('elKeyInput', pasteDone); },
  btnPasteGhToken: function () { pasteInto('ghTokenInput', pasteDone); },
  btnPasteAi: function () { pasteInto('studioAiKey', pasteDone); },
  /* D1: the explicit per-row clears (never */
  btnClearElKey: function () { clearSecretField('elKeyInput', 'elevenKey'); },
  btnClearGhToken: function () { clearSecretField('ghTokenInput', 'ghToken'); },
  btnClearAi: function () { clearSecretField('studioAiKey', 'aiKey'); },
  btnClearGasUrl: function () { clearSecretField('studioGasUrl', 'gasUrl'); },
  btnCheckQuota: function () { quotaProbe(); },
  /* ══ v0.0.6.m: key pool, briefing voice, diagnostics vault ══ */
  btnProbePool: function () {
   withBusy('btnProbePool', function (d) {
    mergeKeyPoolInputs();
    probePoolKeys(function (err, results) {
     var line = '', i;
     if (err || !results.length) line = ' No ElevenLabs keys in the pool yet — paste a key in any slot first';
     else {
      for (i = 0; i < results.length; i++) {
       line += (line ? ' · ' : '') + 'Slot ' + results[i].slot + ': ' +
        (results[i].ok ? ('OK (' + str(results[i].tier) + ')') : 'unreachable');
      }
     }
     /* v0.0.6.m: the Groq half of the pool is free-tier — report its shape. */
     var groq = groqKeyPool();
     line += groq.length ? (' · Groq free-tier slots: ' + groq.length + '/4') : ' · No Groq free-tier keys yet (Slots #1–#4)';
     var node = byId('kpStatus');
     if (node) { node.textContent = line; }
     msg(' ' + line, results && results.length ? 'ok' : 'bad');
     try { if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('key_pool_probed', { keys: results ? results.length : 0, groq: groq.length }); } catch (e) {}
     d();
    });
   });
  },
  btnGenIntroClips: function () {
   withBusy('btnGenIntroClips', function (d) {
    /* v0.0.6.n: the Advanced-Tools button now routes through the SAME
       direct bridge (live status bar + live-session injection + cache
       prime + GitHub sync) as the top-of-studio 1-click control. */
    ensureBriefingAndGuideVoices({ source: 'button' }, function (err, info) {
     d();
     if (err && str(err.message) === 'no_key') return;
     if (err) { msg(' Project Briefing voice failed · ' + quotaError(err), 'bad'); return; }
     msg(' Project Briefing & Guide voices ready · ' + (info ? info.made : 0) + ' new · ' + INTRO_VOICE.name, 'ok');
    });
   });
  },
  btnStudioBriefingVoices: function () {
   /* v0.0.6.n FIX 2 — Trigger 3: the 1-tap control at the top of the
      Lecturer Studio. force:true regenerates the beats even when the
      weekly drift check says they are current. */
   withBusy('btnStudioBriefingVoices', function (d) {
    var run = function (force) {
     ensureBriefingAndGuideVoices({ source: 'button', force: force }, function (err, info) {
      d();
      if (err && str(err.message) === 'no_key') return;
      if (err && str(err.message) === 'busy') return;
      if (err) { msg(' Bridge failed · ' + quotaError(err), 'bad'); return; }
      msg(' Project Overview & Guide voices synced (GitHub + live cache) · ' + ((info && info.made) || 0) + ' new', 'ok');
     });
    };
    var delta = { total: 0 };
    try { delta = briefingVoiceDelta(); } catch (e0) {}
    if (!delta.total) {
     /* Up to date — a forced regenerate still honors the 1-tap intent. */
     try {
      if (global.SDP && SDP.Views && global.confirm && global.confirm('Project Overview & Guide voices are already up to date.\\n\\nForce a full regeneration with the stored ElevenLabs keys now?')) { run(true); return; }
     } catch (e1) {}
     paintBriefingVoiceBar('noop');
     return;
    }
    run(false);
   });
  },
  btnPreviewBriefingBeat: function () {
   /* Plays the committed Beat 1 through the exact briefing tier so the
      creator hears the real George voice right inside the Studio. */
   try {
    if (global.SDP && SDP.Speech && SDP.Speech.playBriefingStep) {
     SDP.Speech.playBriefingStep(0, (introSteps()[0] || {}).text || '', function (res) {
      paintBriefingVoiceBar(res && res.autoplayBlocked ? 'idle' : 'ok', '· Beat 1 preview');
     }, {});
    }
   } catch (e) { msg(' Preview failed — unlock and generate the voices first.', 'bad'); }
  },
  btnDownloadDiagZip: function () {
   withBusy('btnDownloadDiagZip', function (d) {
    buildDiagZip(function (err, info) {
     var node = byId('diagStatus');
     if (err) {
      if (node) node.textContent = ' Diagnostics .zip failed · ' + str(err.message || err);
      msg(' Diagnostics .zip failed · ' + str(err.message || err), 'bad');
     } else {
      if (node) node.textContent = ' Diagnostics .zip downloaded · ' + info.files + ' files · ' + info.bytes + ' bytes';
      msg(' Diagnostics .zip downloaded · ' + info.files + ' files · ' + info.bytes + ' bytes', 'ok');
     }
     d();
    });
   });
  },
  btnClearDiag: function () {
   try { if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.clearAll(); } catch (e) {}
   paintDiagSummary();
   msg(' Local diagnostics cleared', 'ok');
  },
  /* ══ v0.0.6.m Pillar 4: the User Reviews & Session Telemetry vault ══ */
  btnDownloadReviewsZip: function () {
   withBusy('btnDownloadReviewsZip', function (d) {
    buildReviewsZip(function (err, info) {
     var node = byId('reviewsStatus');
     if (err) {
      if (node) node.textContent = ' Reviews .zip failed · ' + str(err.message || err);
      msg(' Reviews .zip failed · ' + str(err.message || err), 'bad');
     } else {
      if (node) node.textContent = ' Reviews & telemetry .zip downloaded · ' + info.files + ' files · ' + info.bytes + ' bytes';
      msg(' Reviews & telemetry .zip downloaded · ' + info.files + ' files · ' + info.bytes + ' bytes', 'ok');
     }
     d();
    });
   });
  },
  btnRefreshReviews: function () {
   paintReviewsDrawer();
   msg(' User reviews & session telemetry refreshed', 'ok');
  },
  btnRefreshQuota: function () { quotaProbe(); },
  btnPreviewWords: function () { openPublishPreview(); },
  btnLockStudio: function () { lock(); },
  btnStudioLock: function () { lock(); },
  btnSsbLock: function () { lock(); },
  btnSsbPublish: function () { withBusy('btnSsbPublish', function (d) { publishWordsAndVoice(function () { d(); lock(); }); }); },
  btnStudioRecord: function () { toggleRecord(); },
  btnCommitClip: function () {
   commitClip(str(ST.secrets.ghToken), function (err) {
    msg(err ? t('studioPublishFail') : t('studioCommitClip') + ' ', err ? 'bad' : 'ok');
   });
  },
  btnTestElKey: function () { withBusy('btnTestElKey', function (d) { testElevenLabsKey(fieldValue('elKeyInput') || str(ST.secrets.elevenKey), function (e, r) { onElTest(e, r); d(); }); }); },
  btnTestGhToken: function () { withBusy('btnTestGhToken', function (d) { testGitHubToken(fieldValue('ghTokenInput') || str(ST.secrets.ghToken), function (e, r) { onGhTest(e, r); d(); }); }); },
  btnTestOneWord: function () { withBusy('btnTestOneWord', function (d) { generateClips({ singleTest: true }, function () { d(); }); }); },
  btnGenClips: function () { withBusy('btnGenClips', function (d) { generateClips({ force: forceRegenChecked() }, function () { d(); }); }); },
  btnTestAi: function () { withBusy('btnTestAi', function (d) { testAiEngine(function () { d(); }); }); },
  btnEnrichWords: function () { withBusy('btnEnrichWords', function (d) { enrichWords(fieldValue('studioWords') || fieldValue('studioBulkWords'), { force: false }, function () { d(); }); }); },
  btnOneClickMasterSetup: function () { withBusy('btnOneClickMasterSetup', function (d) { oneClickMasterSetup(function () { d(); }); }); },
  btnRetryFailedStep: function () {
   var host = byId('studioErrorAssistant');
   var step = Number(host && host.getAttribute('data-step')) || 4;
   withBusy('btnRetryFailedStep', function (d) { oneClickMasterSetup(function () { d(); }); });
  },
  btnDismissError: function () {
   var host = byId('studioErrorAssistant');
   if (host) { host.setAttribute('data-state', 'hidden'); host.innerHTML = ''; }
  },
  btnPublishWordsAndVoice: function () { withBusy('btnPublishWordsAndVoice', function (d) { publishWordsAndVoice(function () { d(); }); }); },
  btnPublishWords: function () { withBusy('btnPublishWords', function (d) { publish(function () { d(); }); }); },
  btnStudioSyncSettings: function () { withBusy('btnStudioSyncSettings', function (d) { publishWordsAndVoice(function (err) { msg(err ? t('studioPublishFail') : t('studioPublishOk'), err ? 'bad' : 'ok'); d(); }); }); },
  /* E8: atomic PIN change — validate 4–8 digits, confirm match, re-seal the */
  btnChangePin: function () { withBusy('btnChangePin', function (d) { changePin(function () { d(); }); }); },
  btnVerifyEleven: function () { withBusy('btnVerifyEleven', function (d) { verifyElevenKey(); d(); }); },
  btnRetryFailedClip: function () {
   var failed = ST.lastFailedClip;
   if (!failed || !failed.key) { msg(t('studioRetryNone'), ''); return; }
   withBusy('btnRetryFailedClip', function (d) { generateClips({ keys: [failed.key] }, function () { d(); }); });
  },
  btnSaveKeys: function () { withBusy('btnSaveKeys', function (d) { saveKeys(); global.setTimeout(function () { msg(T('studioSavedOk'), 'ok'); d(); }, 1500); }); },
  /* v0.0.6.e (A): non-destructive chip-grid utilities. */
  btnStudioPasteWords: function () {
   pasteInto('studioBulkWords', function (err) {
    if (!err) { setStudioWords(parseBulkWords(fieldValue('studioBulkWords')), 'bulk'); }
    paintLiveChips(); paintWordsHelper();
   });
  },
  btnStudioClearWords: function () {
   var bulk = byId('studioBulkWords'); if (bulk) bulk.value = '';
   ST.words = []; ST.rawParsedWords = [];
   setStudioWords([], 'bulk'); paintLiveChips(); paintWordsHelper();
   msg(t('wordsCleared', 'Word editor cleared'), '');
  },
  btnStudioConfirmWords: function () {
   ST.wordsConfirmed = true;
   var b = byId('studioWordsStatusBanner');
   if (b) { setText(b, t('wordsConfirmedOk', '\u2713 Words confirmed \u2014 ready to Broadcast')); b.setAttribute('data-state', 'ok'); }
   msg(t('wordsConfirmedOk', '\u2713 Words confirmed \u2014 ready to Broadcast'), 'ok');
  }
 };
 function onStudioClick(ev) {
  var target = ev && ev.target;
  var actEl = target;
  while (actEl && actEl !== byId('studioAccordion') && !(actEl.getAttribute && actEl.getAttribute('data-action'))) actEl = actEl.parentNode;
  if (actEl && actEl.getAttribute && actEl.getAttribute('data-action') === 'previewWmRow') {
   if (ev.preventDefault) ev.preventDefault();
   previewWmRow(actEl.getAttribute('data-row'));
   return;
  }
  if (actEl && actEl.getAttribute && actEl.getAttribute('data-action') === 'toggleWmRow') {
   if (ev.preventDefault) ev.preventDefault();
   toggleWmRow(actEl.getAttribute('data-row'));
   return;
  }
  /* v0.0.6.m Pillar 2: the per-word verifier + single-word re-synthesis. */
  if (actEl && actEl.getAttribute && actEl.getAttribute('data-action') === 'verifyWmRow') {
   if (ev.preventDefault) ev.preventDefault();
   verifyWmRow(actEl.getAttribute('data-row'));
   return;
  }
  if (actEl && actEl.getAttribute && actEl.getAttribute('data-action') === 'resynthWmRow') {
   if (ev.preventDefault) ev.preventDefault();
   resynthWmRow(actEl.getAttribute('data-row'));
   return;
  }
  if (actEl && actEl.getAttribute && actEl.getAttribute('data-action') === 'chip-remove') {
   if (ev.preventDefault) ev.preventDefault();
   chipRemove(Number(actEl.getAttribute('data-idx')));
   paintLiveChips(); paintWordsHelper();
   return;
  }
  if (actEl && actEl.getAttribute && actEl.getAttribute('data-action') === 'chip-merge') {
   if (ev.preventDefault) ev.preventDefault();
   chipMerge(Number(actEl.getAttribute('data-idx')));
   paintLiveChips(); paintWordsHelper();
   return;
  }
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
  testStatus(err ? 'Clipboard unavailable — field focused, press Ctrl+V to paste' : t('studioPaste') + ' ', err ? 'warn' : 'ok');
 }
 function quotaProbe() {
   /* D2: probeQuota paints the green */
  refreshQuota(function (err) {
   if (err) { testStatus(quotaError(err), 'bad'); paintCreditBanner(quotaError(err)); return; }
   hideCreditBanner();
  });
 }
 /* v0.0.6.d (D8): the bilingual API Credits Exhausted warning banner. Shown */
 function paintCreditBanner(reason) {
  var host = byId('studioCreditBanner');
  if (!host) {
   host = doc.createElement('div');
   host.id = 'studioCreditBanner';
   host.className = 'studio-credit-banner';
   host.setAttribute('role', 'region');
   host.setAttribute('aria-live', 'polite');
   host.setAttribute('data-state', 'hidden');
   host.innerHTML =
    '<p class="scb-line">' + esc(t('apiCreditsExhausted')) + '</p>' +
    '<p class="scb-line" lang="si">' + esc(t('apiCreditsExhaustedSi')) + '</p>' +
    (str(reason) ? '<p class="scb-detail">' + esc(str(reason)) + '</p>' : '') +
    '<button type="button" class="btn btn-primary btn-sm" id="btnFixApiCredits">' +
    ico('key', 16) + '<span class="i18n-label">' + esc(t('apiCreditsFixNow')) + '</span></button>';
   var body = byId('studioBody');
   if (body && body.firstChild) body.insertBefore(host, body.firstChild);
   else if (body) body.appendChild(host);
   var fix = byId('btnFixApiCredits');
   if (fix && fix.addEventListener) {
    fix.addEventListener('click', function () {
     try {
      var drawer = byId('studioAdvancedDrawer');
      if (drawer && drawer.setAttribute) drawer.setAttribute('open', 'open');
      if (drawer && typeof drawer.open === 'boolean') drawer.open = true;
     } catch (e) {}
     try {
      var key = byId('elKeyInput') || byId('studioAiKey');
      if (key && key.focus) key.focus({ preventScroll: false });
     } catch (e2) {}
    }, false);
   }
  }
  var detail = host.querySelector ? host.querySelector('.scb-detail') : null;
  if (detail) detail.textContent = str(reason) || '';
  host.setAttribute('data-state', 'visible');
  host.removeAttribute('hidden');
  return true;
 }
 function hideCreditBanner() {
  var host = byId('studioCreditBanner');
  if (host) host.setAttribute('data-state', 'hidden');
  return true;
 }
 function creditExhausted(result, err) {
  if (err) {
   var c = Number((err && err.status) || 0);
   return c === 401 || c === 402 || c === 429;
  }
  if (isObj(result) && !result.scoped) {
   var left = Number(result.remaining);
   return !isNaN(left) && left < 200;
  }
  return false;
 }
 function onElTest(err, result) {
  if (err) { testStatus(quotaError(err), 'bad'); if (creditExhausted(null, err)) paintCreditBanner(quotaError(err)); return; }
  if (creditExhausted(result, null)) {
   paintCreditBanner('Remaining: ' + Number(result.remaining) + ' chars');
  } else { hideCreditBanner(); }
  if (result && result.scoped) {
   var note = str(result.note) || SCOPED_NOTE();
   testStatus(' ' + note, 'ok');
   setText(byId('quotaText'), note);
   return;
  }
  var used = Number(result.used || 0), limit = Number(result.limit || 0), left = Number(result.remaining || 0);
  testStatus(' ElevenLabs Connected · Used ' + used + ' / Limit ' + limit + ' chars (Remaining: ' + left + ')', 'ok');
  setText(byId('quotaText'), 'Used ' + used + ' / Limit ' + limit + ' chars · Remaining: ' + left);
 }
 function onGhTest(err, result) {
  if (err) { testStatus(' ' + ghError(err), 'bad'); return; }
  testStatus(' GitHub Connected (' + result.repo + ' · Write OK)', 'ok');
 }

 /* D6 (Layer 2): seal + Layer 1 + push… */
 var SAVE_LOCAL_ONLY = 'Saved in local Vault (protected across updates)';
 /* D1: one place reads the */
 function mergeSecretInputs() {
  var s = ST.secrets = isObj(ST.secrets) ? ST.secrets : {}, p = {}, i, k, el, v, dirty;
  for (i = 0; i < SECRET_FIELDS.length; i++) {
   k = SECRET_FIELDS[i].key; el = byId(SECRET_FIELDS[i].id);
   v = el ? str(el.value) : '';
   dirty = !!(el && el.getAttribute('data-dirty') === '1');
   /* D1: unmounted or empty-pristine */
   p[k] = v !== '' ? v : (dirty ? '' : str(s[k]));
  }
  p.aiProvider = aiProviderName(); p.updatedAt = Date.now();
  for (k in p) if (Object.prototype.hasOwnProperty.call(p, k)) s[k] = p[k];
  /* v0.0.6.m: the five pool slots ride the same sealed vault write. */
  mergeKeyPoolInputs();
  ST.aiProvider = p.aiProvider; ST.aiKey = p.aiKey;
  return s;
 }
 function saveKeys() {
  if (!ST.unlocked) { msg(t('studioLocked'), 'bad'); return false; }
  /* R4 (F5): never seal a key ID. e1b… is 64 hex chars and ElevenLabs */
  var typed = trimmedKey(fieldValue('elKeyInput'));
  if (typed && !looksLikeElevenKey(typed)) {
   msg(elevenKeyHint(), 'bad');
   testStatus(' ' + elevenKeyHint(), 'bad');
   paintElVerify(elevenKeyHint(), 'bad');
   return false;
  }
  /* SEC-02 / R4: a new 4–8 digit PIN */
  var wantPin = newPinValue();
  var confirmPin = confirmPinValue();
  if (wantPin.length >= PIN_MIN || confirmPin.length) {
   if (wantPin.length < PIN_MIN || wantPin.length > PIN_MAX) { msg(t('studioBadPin'), 'bad'); return false; }
   if (wantPin !== confirmPin) { msg(t('studioPinMismatch'), 'bad'); return false; }
   ST.pin = wantPin;
  }
  /* D1: snapshot before the merge, then */
  var prevSecrets = secretSnapshot();
  mergeSecretInputs();
  guardSecretMerge(prevSecrets);
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
    loadVoicePack(function () { paintPackDashboard(); paintClipTable(); });
   });
  });
  return true;
 }

 /* R5/D8: pagehide, beforeunload and… */
 function bindAutoLock() {
  if (autoLockBound) return false;
  autoLockBound = true;
  /* R5 + D13: tab close / navigate */
  var handler = function () { if (ST.unlocked) { try { lock(true); } catch (e) {} } };
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

 /* R8/D14: the free enricher */
 /* D12: a harvested human `-uk.mp3` */
 function audioForWord(word, dAudio) {
  var harvested = str(dAudio);
  if (harvested) return harvested;
  return 'https://dict.youdao.com/dictvoice?type=1&audio=' + encodeURIComponent(str(word));
 }
 /* D11: pick the real human British */
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

/* ══ v0.0.6.a W1: offline British IPA engine — lexicon + deterministic */
var BRITISH_IPA_LEXICON = {
 "important":"/\u026am\u02c8p\u0254\u02d0t\u0259nt/","impressed":"/\u026am\u02c8prest/","intelligent":"/\u026an\u02c8tel\u026ad\u0292\u0259nt/",
 "interested":"/\u02c8\u026antr\u0259st\u026ad/","jealous":"/\u02c8d\u0292el\u0259s/","married":"/\u02c8m\u00e6rid/",
 "miserable":"/\u02c8m\u026azr\u0259bl/","modern":"/\u02c8m\u0252dn/","negative":"/\u02c8neg\u0259t\u026av/","nervous":"/\u02c8n\u025c\u02d0v\u0259s/",
 "noisy":"/\u02c8n\u0254\u026azi/","normal":"/\u02c8n\u0254\u02d0ml/","old":"/\u0259\u028ald/","fashioned":"/\u02c8f\u00e6\u0283nd/","ordinary":"/\u02c8\u0254\u02d0dnri/",
 "original":"/\u0259\u02c8r\u026ad\u0292\u0259nl/","patient":"/\u02c8pe\u026a\u0283nt/","personal":"/\u02c8p\u025c\u02d0s\u0259nl/","pleasant":"/\u02c8pleznt/","positive":"/\u02c8p\u0252z\u0259t\u026av/",
 "realistic":"/\u02ccri\u02d0\u0259\u02c8l\u026ast\u026ak/","reasonable":"/\u02c8ri\u02d0zn\u0259bl/","relaxed":"/r\u026a\u02c8l\u00e6kst/","reliable":"/r\u026a\u02c8la\u026abl/","relieved":"/r\u026a\u02c8li\u02d0vd/",
 "satisfied":"/\u02c8s\u00e6t\u026asfa\u026ad/","special":"/\u02c8spe\u0283l/","stupid":"/\u02c8stju\u02d0p\u026ad/","surprised":"/s\u0259\u02c8pra\u026azd/","terrible":"/\u02c8ter\u0259bl/",
 "guidebook":"/\u02c8\u0261a\u026adb\u028ak/","handlebars":"/\u02c8h\u00e6ndlb\u0251\u02d0z/","harbour":"/\u02c8h\u0251\u02d0b\u0259/","helicopter":"/\u02c8hel\u026ak\u0252pt\u0259/",
 "hitchhike":"/\u02c8h\u026at\u0283ha\u026ak/","immigration":"/\u02cc\u026am\u026a\u02c8\u0261re\u026a\u0283n/","journey":"/\u02c8d\u0292\u025c\u02d0ni/","luggage":"/\u02c8l\u028ag\u026ad\u0292/","machine":"/m\u0259\u02c8\u0283i\u02d0n/",
 "mechanic":"/m\u0259\u02c8k\u00e6n\u026ak/","nationality":"/\u02ccn\u00e6\u0283\u0259\u02c8n\u00e6l\u0259ti/","overnight":"/\u02cc\u0259\u028av\u0259\u02c8na\u026at/","passenger":"/\u02c8p\u00e6s\u026and\u0292\u0259/",
 "reception":"/r\u026a\u02c8sep\u0283n/","reservation":"/\u02ccrez\u0259\u02c8ve\u026a\u0283n/","signpost":"/\u02c8sa\u026anp\u0259\u028ast/","spaceship":"/\u02c8spe\u026a\u0283\u0283\u026ap/","suitcase":"/\u02c8su\u02d0tke\u026as/",
 "tunnel":"/\u02c8t\u028anl/","vehicle":"/\u02c8vi\u02d0\u0259kl/","visa":"/\u02c8vi\u02d0z\u0259/","waiting room":"/\u02c8we\u026at\u026a\u014b ru\u02d0m/","windscreen":"/\u02c8w\u026andskri\u02d0n/",
 "on business":"/\u0252n \u02c8b\u026azn\u0259s/","on vacation":"/\u0252n v\u0259\u02c8ke\u026a\u0283n/","public transport":"/\u02ccp\u028abl\u026ak \u02c8tr\u00e6nsp\u0254\u02d0t/",
 "road sign":"/\u02c8r\u0259\u028ad sa\u026an/","traffic lights":"/\u02c8tr\u00e6f\u026ak la\u026ats/","tourist information centre":"/\u02c8t\u028a\u0259r\u026ast \u02cc\u026anf\u0259\u02c8me\u026a\u0283n \u02c8sent\u0259/",
 "tyre":"/\u02c8ta\u026a\u0259/","tire":"/\u02c8ta\u026a\u0259/","guide":"/\u0261a\u026ad/","book":"/b\u028ak/","handle":"/\u02c8h\u00e6ndl/","bar":"/b\u0251\u02d0/"
};
var G2P_DIGRAPHS = [["ch","t\u0283"],["sh","\u0283"],["th","\u03b8"],["ph","f"],["wh","w"],["ck","k"],["ng","\u014b"],["qu","kw"],
 ["ee","i\u02d0"],["oo","u\u02d0"],["ea","i\u02d0"],["ou","a\u028a"],["ai","e\u026a"],["ay","e\u026a"],["oa","\u0259\u028a"],["oi","\u0254\u026a"],
 ["oy","\u0254\u026a"],["au","\u0254\u02d0"],["aw","\u0254\u02d0"],["ir","\u025c\u02d0"],["ur","\u025c\u02d0"],["er","\u0259"],["or","\u0254\u02d0"],
 ["ar","\u0251\u02d0"],["ie","a\u026a"],["ue","u\u02d0"],["ey","e\u026a"]];
var G2P_TAIL = {"e":"","es":"z","ed":"d","ing":"\u026a\u014b","ly":"li","tion":"\u0283n","sion":"\u0283n","ture":"t\u0283\u0259","ous":"\u0259s","ful":"fl","able":"\u0259bl","ible":"\u026abl",
 "er":"\u0259","ies":"iz","ation":"e\u026a\u0283n","fully":"fli","ingly":"\u026a\u014bli"};
var G2P_SINGLE = {"a":"\u00e6","e":"e","i":"\u026a","o":"\u0252","u":"\u028c","y":"\u026a","b":"b","c":"k","d":"d","f":"f","g":"\u0261","h":"h","j":"d\u0292","k":"k","l":"l","m":"m","n":"n","p":"p",
 "q":"kw","r":"r","s":"s","t":"t","v":"v","w":"w","x":"ks","z":"z"};
var G2P_VOWELS = "\u00e6e\u026a\u0252\u028cu\u0259\u0251\u0254\u025ci\u02d0\u028a\u0254\u026a";
function g2pIsVowel(ipa) { return ipa.length > 0 && G2P_VOWELS.indexOf(ipa.charAt(0)) >= 0; }
/* The deterministic G2P transcriber: scan left-to-right in the reading */
function transcribeBritishIPA(raw) {
  var w = str(raw).toLowerCase().replace(/[^a-z ]/g, '').replace(/^\s+|\s+$/g, '');
  if (!w) return '';
  if (BRITISH_IPA_LEXICON[w]) return BRITISH_IPA_LEXICON[w];
  if (w.indexOf(' ') >= 0) {
    var parts = w.split(' '), joined = [];
    for (var p = 0; p < parts.length; p++) {
      var sub = transcribeBritishIPA(parts[p]);
      joined.push(sub ? sub.replace(/^\/+|\/+$/g, '') : parts[p]);
    }
    return '/' + joined.join(' ') + '/';
  }
  var head = w, tail = '';
  var keys = ['ation','tion','sion','ature','ible','able','fully','ingly','ing','ous','ful','ly','ies','es','ed','er','e'];
  for (var k = 0; k < keys.length; k++) {
    if (w.length > keys[k].length + 1 && w.slice(-keys[k].length) === keys[k]) {
      tail = G2P_TAIL[keys[k]]; head = w.slice(0, w.length - keys[k].length); break;
    }
  }
  var out = '', i = 0;
  if (head.charAt(0) === 'y') { out = 'j'; head = head.slice(1); }
  if (head.slice(-1) === 'e' && head.length > 2 && 'aeiou'.indexOf(head.charAt(head.length - 2)) < 0) head = head.slice(0, -1);
  while (i < head.length) {
    var seg = head.slice(i, i + 2), hit = '';
    for (var d = 0; d < G2P_DIGRAPHS.length; d++) {
      if (seg === G2P_DIGRAPHS[d][0] && i + 2 <= head.length) { hit = G2P_DIGRAPHS[d][1]; i += 2; break; }
    }
    if (!hit) {
      hit = G2P_SINGLE[head.charAt(i)] || '';
      i += 1;
      /* a word-final weak vowel collapses to schwa \u0259. */
      if (head.charAt(i - 1) === 'e' && i === head.length) hit = '\u0259';
    }
    if (!hit) continue;
    /* a consonant followed by the SAME consonant is a single sound. */
    if (out.length && out.charAt(out.length - 1) === hit && !g2pIsVowel(hit)) continue;
    out += hit;
  }
  out += tail;
  /* -es after a sibilant is a separate syllable: boxes -> -ksIz. */
  if (out.length > 2 && out.slice(-2) === 'sz') out = out.slice(0, -2) + 's\u026az';
  /* stress BEFORE the first syllable onset (Oxford style: /\u02c8st\u028cdent/). */
  for (var v = 0; v < out.length; v++) {
    if (g2pIsVowel(out.charAt(v))) {
      var s0 = v;
      while (s0 > 0 && !g2pIsVowel(out.charAt(s0 - 1))) s0 -= 1;
      out = out.slice(0, s0) + '\u02c8' + out.slice(s0);
      break;
    }
  }
  if (out.replace(/[\u02c8\/]/g, '').length < 2) return '';
  return '/' + out + '/';
}
function offlineIPA(word) {
  var w = str(word).toLowerCase();
  var lex = BRITISH_IPA_LEXICON[w];
  if (lex) return lex;
  if (/^(tyre|tire)$/.test(w)) return '/\u02c8ta\u026a\u0259/';
  var prior = priorIPAFor(w);
  if (prior && prior !== '/' + w + '/') return prior;
  var t = transcribeBritishIPA(w);
  if (t && t !== '/' + w + '/') return t;
  return '';
}

function priorIPAFor(w) {
  try {
    if (SDP.Sync && SDP.Sync.words) {
      var all = SDP.Sync.words();
      for (var i = 0; i < all.length; i++) {
        if (all[i] && str(all[i].w).toLowerCase() === w && str(all[i].p).indexOf('/') === 0 && str(all[i].p).length > 4) return str(all[i].p);
      }
    }
  } catch (e) {}
  return '';
}

 function fallbackEnrich(word, prior) {
  var base = isObj(prior) ? prior : {};
  var w = str(word);
  var ipa = str(base.p);
  if (!ipa || ipa === '/' + w + '/') ipa = offlineIPA(w);
  if (!ipa || ipa === '/' + w + '/') ipa = transcribeBritishIPA(w);
  /* v0.0.6.d (D2): a replaced word never inherits the old slot's POS — the */
  var pos = str(base.pos);
  if (!pos || pos === '—' || pos === '-') pos = guessPartOfSpeech(w);
  var m = str(base.m);
  if (!m || m.indexOf('B1 classroom vocabulary word:') === 0) m = b1Definition(w, pos);
  var si = str(base.si);
  var s = str(base.s);
  if (!s || s.indexOf('Please write the word ' + w) === 0) s = b1Example(w, pos);
  return {
   w: w,
   p: ipa,
   pos: pos,
   m: m,
   si: si,
   s: s,
   audio: str(base.audio) || audioForWord(w),
   exampleSi: str(base.exampleSi),
   /* D14: an offline record says so, so the */
   enrichSource: str(base.enrichSource) || 'lexicon'
  };
 }

 /* v0.0.6.d (D2): the smart morphological analyzer — suffix rules give an */
 function guessPartOfSpeech(w) {
  var s = str(w).toLowerCase().replace(/[^a-z ]/g, '');
  if (!s) return '—';
  if (POS_LEXICON[s]) return POS_LEXICON[s];
  if (/ $|^ /.test(s)) return '—';
  if (/ly$/.test(s)) return 'adv.';
  if (/(ness|tion|sion|ment|ity|ship|hood|ance|ence|ism|age|ery)$/.test(s)) return 'n.';
  if (/(ous|ful|able|ible|ive|al|ic|ish|ant|ent|ary|less|y)$/.test(s) && !/^(day|key|way)$/.test(s)) return 'adj.';
  if (/(ize|ise|ate|ify|en)$/.test(s) && s.length > 4) return 'v.';
  if (/(ing)$/.test(s)) return s.length > 6 ? 'v.' : 'n.';
  if (/(ed)$/.test(s)) return s.length > 5 ? 'adj.' : 'v.';
  if (/(er|or|ist)$/.test(s) && s.length > 4) return 'n.';
  return 'n.';
 }
 /* A tiny offline POS lexicon for the words a B1 class actually changes to. */
 var POS_LEXICON = {
  important: 'adj.', impressed: 'adj.', intelligent: 'adj.', interested: 'adj.',
  jealous: 'adj.', married: 'adj.', miserable: 'adj.', modern: 'adj.', negative: 'adj.',
  nervous: 'adj.', noisy: 'adj.', normal: 'adj.', old: 'adj.', ordinary: 'adj.',
  original: 'adj.', patient: 'adj.', personal: 'adj.', pleasant: 'adj.', positive: 'adj.',
  realistic: 'adj.', reasonable: 'adj.', relaxed: 'adj.', reliable: 'adj.', relieved: 'adj.',
  satisfied: 'adj.', special: 'adj.', stupid: 'adj.', surprised: 'adj.', terrible: 'adj.',
  afraid: 'adj.', brave: 'adj.', calm: 'adj.', careful: 'adj.', cheerful: 'adj.',
  clever: 'adj.', confident: 'adj.', crazy: 'adj.', cruel: 'adj.', curious: 'adj.',
  delighted: 'adj.', depressed: 'adj.', disappointed: 'adj.', excited: 'adj.',
  famous: 'adj.', friendly: 'adj.', generous: 'adj.', guilty: 'adj.', healthy: 'adj.',
  hungry: 'adj.', lazy: 'adj.', lucky: 'adj.', polite: 'adj.', proud: 'adj.',
  quiet: 'adj.', rude: 'adj.', serious: 'adj.', shy: 'adj.', smart: 'adj.',
  useful: 'adj.', worried: 'adj.', angry: 'adj.', anxious: 'adj.', ashamed: 'adj.',
  amazed: 'adj.', amusing: 'adj.', annoyed: 'adj.', awesome: 'adj.', boring: 'adj.',
  brilliant: 'adj.', challenging: 'adj.', charming: 'adj.', confusing: 'adj.',
  delightful: 'adj.', enjoyable: 'adj.', excellent: 'adj.', fantastic: 'adj.',
  favourite: 'adj.', frightened: 'adj.', guilty_: 'adj.', quickly: 'adv.',
  slowly: 'adv.', carefully_: 'adv.', suddenly: 'adv.', really: 'adv.', very: 'adv.',
  never: 'adv.', always: 'adv.', often: 'adv.', usually: 'adv.', early: 'adv.',
  hard: 'adv.', fast: 'adv.', well: 'adv.', badly: 'adv.', together: 'adv.',
  journey: 'n.', luggage: 'n.', machine: 'n.', mechanic: 'n.', passenger: 'n.',
  reception: 'n.', reservation: 'n.', suitcase: 'n.', tunnel: 'n.', vehicle: 'n.',
  harbour: 'n.', helicopter: 'n.', guidebook: 'n.', passport: 'n.', ticket: 'n.',
  airport: 'n.', station: 'n.', hotel: 'n.', teacher: 'n.', student: 'n.',
  doctor: 'n.', engineer: 'n.', library: 'n.', hospital: 'n.', market: 'n.',
  travel: 'v.', arrive: 'v.', borrow: 'v.', cancel: 'v.', complain: 'v.',
  describe: 'v.', destroy: 'v.', develop: 'v.', discover: 'v.', discuss: 'v.',
  embarrass: 'v.', enjoy: 'v.', expect: 'v.', explain: 'v.', feel: 'v.',
  finish: 'v.', forget: 'v.', happen: 'v.', hurry: 'v.', imagine: 'v.',
  improve: 'v.', invite: 'v.', laugh: 'v.', learn: 'v.', leave: 'v.',
  listen: 'v.', live: 'v.', look: 'v.', lose: 'v.', love: 'v.',
  move: 'v.', need: 'v.', offer: 'v.', own: 'v.', pack: 'v.',
  practise: 'v.', prefer: 'v.', prepare: 'v.', promise: 'v.', protect: 'v.',
  reach: 'v.', realise: 'v.', receive: 'v.', recommend: 'v.', refuse: 'v.',
  remember: 'v.', repair: 'v.', repeat: 'v.', reply: 'v.', require: 'v.',
  reserve: 'v.', return: 'v.', smile: 'v.', sound: 'v.', stay: 'v.',
  suggest: 'v.', suppose: 'v.', surprise: 'v.', translate: 'v.', travel_: 'v.'
 };
 /* v0.0.6.d (D2): a natural B1 definition and a contextual example sentence */
 function b1Definition(w, pos) {
  var p = str(pos);
  if (p === 'adv.') return 'In the way described by "' + str(w) + '".';
  if (p === 'v.') return 'To ' + str(w) + ' (something).';
  if (p === 'adj.') return 'Having the quality of being ' + str(w) + '.';
  return 'A ' + str(w) + '.';
 }
 function b1Example(w, pos) {
  var word = str(w);
  var p = str(pos);
  if (p === 'adv.') return 'She answered the question ' + word + '.';
  if (p === 'v.') return 'They ' + word + ' together every weekend.';
  if (p === 'adj.') return 'The story was very ' + word + ' to read.';
  return 'We saw a ' + word + ' near the station.';
 }
 
 function mergeEnrichRecord(word, prior, provided) {
  var base = fallbackEnrich(word, prior);
  var p = isObj(provided) ? provided : {};
  var ipaIn = str(p.p) || base.p;
  /* v0.0.6.a: a spelling-as-phonetics placeholder is worthless in a B1 class; */
  if (ipaIn === '/' + str(word) + '/') ipaIn = '';
  /* v0.0.6.d (D2): never carry the OLD word's POS/meaning/sentence onto a */
  var stalePrior = isObj(prior) && str(prior.w) && str(prior.w).toLowerCase() !== str(word).toLowerCase();
  var posIn = str(p.pos) || (stalePrior ? '' : '') || '';
  if (!posIn && !str(p.m) && !str(p.s)) {
   /* No LLM row landed: the analyzer owns POS, and the generic fallbacks */
   if (stalePrior) { base.pos = guessPartOfSpeech(str(word)); base.m = ''; base.s = ''; }
  }
  var mIn = str(p.m);
  var sIn = str(p.s);
  var siIn = str(p.si);
  var out = {
   w: str(word),
   p: ipaIn || offlineIPA(str(word)) || transcribeBritishIPA(str(word)),
   pos: posIn || base.pos,
   m: mIn || (stalePrior ? b1Definition(str(word), base.pos) : base.m),
   si: siIn || (stalePrior ? '' : base.si),
   s: sIn || (stalePrior ? b1Example(str(word), base.pos) : base.s),
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
  /* D11: the real human British */
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
 /* v0.0.4.a W2: built-in B1 Sinhala lexicon + multi-tier translateSi cascade. */
 var SI_LEXICON = {
  "afraid": "බියට පත් වූ",
  "amazed": "මවිතයට පත් වූ",
  "amusing": "විනෝදජනක",
  "annoyed": "කෝපයට හෝ කරදරයට පත් වූ",
  "anxious": "කනස්සල්ලෙන් සිටින",
  "ashamed": "ලැජ්ජාවට පත් වූ",
  "awesome": "ඉතා විශිෂ්ට",
  "boring": "කම්මැලි හෝ නීරස",
  "brilliant": "ඉතා දක්ෂ හෝ විශිෂ්ට",
  "challenging": "අභියෝගාත්මක",
  "charming": "ආකර්ෂණීය හෝ සිත්ගන්නාසුලු",
  "confident": "ආත්ම විශ්වාසයෙන් යුතු",
  "confusing": "ව්‍යාකූල කරන",
  "cruel": "කෲර හෝ නපුරු",
  "curious": "කුතුහලයෙන් යුතු",
  "delighted": "ඉතා සතුටට පත් වූ",
  "depressed": "දැඩි කලකිරීමට හෝ දුකට පත් වූ",
  "disappointed": "බලාපොරොත්තු සුන් වූ",
  "embarrassing": "අපහසුතාවයට පත් කරන",
  "enjoyable": "රසවත් හෝ සතුටුදායක",
  "excellent": "ඉතා විශිෂ්ට",
  "excited": "උද්‍යෝගිමත් වූ",
  "fantastic": "අති විශිෂ්ට",
  "favourite": "ප්‍රියතම",
  "frightened": "බියට පත් වූ",
  "friendly": "මිත්‍රශීලී",
  "generous": "ත්‍යාගශීලී",
  "guilty": "වරදකාරී හැඟීමක් ඇති",
  "healthy": "සෞඛ්‍ය සම්පන්න",
  "hungry": "කුසගින්නෙන් පෙළෙන",
  "brave": "නිර්භීත"
 };
 var GOOGLE_SI_API = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=si&dt=t&q=';
 var POLLINATIONS_SI_API = 'https://text.pollinations.ai/';
 function sessionLexicon() {
  var out = {}, i, list = [];
  try { list = sync() && sync().words ? sync().words() : []; } catch (e) { list = []; }
  for (i = 0; i < list.length; i++) {
   var rw = list[i] || {};
   if (str(rw.w) && /[\u0D80-\u0DFF]/.test(str(rw.si))) out[str(rw.w).toLowerCase()] = str(rw.si);
  }
  return out;
 }
 function fetchTextSafe(url, timeoutMs, cb) {
  cb = cb || noop;
  if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
  var done = false, timer = null;
  function finish(err, text) {
   if (done) return; done = true;
   if (timer) { try { global.clearTimeout(timer); } catch (e) {} timer = null; }
   cb(err, text);
  }
  timer = global.setTimeout(function () { finish(new Error('timeout')); }, Number(timeoutMs) || 6000);
  try {
   global.fetch(url, { cache: 'no-store' })
    .then(function (res) { return res && res.ok && res.text ? res.text() : null; })
    .then(function (t) { if (t) finish(null, t); else finish(new Error('bad_response')); },
     function (err) { finish(err || new Error('network_error')); });
  } catch (e) { finish(e || new Error('network_error')); }
  return true;
 }
 /* (a) lexicon → (b) Google Translate gtx → (c) MyMemory → (d) pollinations. */
 function translateSi(word, cb) {
  cb = cb || noop;
  var w = str(word).toLowerCase();
  var lex = SI_LEXICON[w] || sessionLexicon()[w] || '';
  if (lex && /[\u0D80-\u0DFF]/.test(lex)) { cb(null, lex, 'lexicon'); return true; }
  fetchJsonSafe(GOOGLE_SI_API + encodeURIComponent(w), 6000, function (err, json) {
   var t = '', i;
   if (!err && Array.isArray(json) && Array.isArray(json[0])) {
    for (i = 0; i < json[0].length; i++) t += str(json[0][i] && json[0][i][0]);
   }
   if (t && /[\u0D80-\u0DFF]/.test(t)) { cb(null, t, 'net'); return; }
   fetchJsonSafe(SINHALA_API + encodeURIComponent(w) + '&langpair=en|si', 6000, function (err2, json2) {
    var t2 = !err2 ? sinhalaFrom(json2) : '';
    if (t2 && t2.indexOf('MYMEMORY WARNING') < 0 && /[\u0D80-\u0DFF]/.test(t2)) { cb(null, t2, 'net'); return; }
    fetchTextSafe(POLLINATIONS_SI_API + encodeURIComponent('Translate the English word "' + w + '" into Sinhala. Answer with ONLY the Sinhala word, no explanation.'), 8000, function (err3, text) {
     var t3 = err3 ? '' : str(text).replace(/^["'\s]+|["'\s]+$/g, '');
     if (t3 && /[\u0D80-\u0DFF]/.test(t3)) { cb(null, t3, 'net'); return; }
     cb(new Error('no_sinhala'), '');
    });
   });
  });
  return true;
 }
 function freeEnrichOne(word, prior, cb) {
  cb = cb || noop;
  var w = str(word);
  var pending = 2, dict = null, si = '', siLex = false;
  function done() {
   pending -= 1;
   if (pending > 0) return;
   var out = mergeEnrichRecord(w, prior, {});
   if (dict) {
    if (dict.p) out.p = dict.p;
    if (dict.pos) out.pos = dict.pos;
    if (dict.m) out.m = dict.m;
    if (dict.s) out.s = dict.s;
    /* D11/D12: never discard a known human */
    if (dict.audio) out.audio = str(dict.audio);
   }
   /* v0.0.6.d (D2): a changed word must land with an EXACT part of speech — */
   if (!str(out.pos) || out.pos === '—' || out.pos === '-') {
    out.pos = (dict && str(dict.pos)) || guessPartOfSpeech(w);
   }
   /* …and a natural B1 example that fits that part of speech. */
   if (!str(out.s) || out.s.indexOf('Please write the word ' + w) === 0) {
    out.s = b1Example(w, out.pos);
   }
   if (si) out.si = si;
   var net = !!(dict || (si && !siLex));
   out.enrichSource = net ? 'free_dict' : 'lexicon';
   cb(null, out, !net);
  }
  fetchJsonSafe(DICTIONARY_API + encodeURIComponent(w), 6000, function (err, json) {
   if (!err) dict = dictFields(json);
   done();
  });
  translateSi(w, function (err, text, src) {
   if (!err) { si = str(text); if (src === 'lexicon') siLex = true; }
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
 function llmRequest(provider, key, words, cb, promptOverride) {
  cb = cb || noop;
  var ep = LLM_ENDPOINTS[provider];
  if (!ep) { cb(new Error('no_provider')); return false; }
  var info = isObj(AI_PROVIDERS[provider]) ? AI_PROVIDERS[provider] : {};
  /* D10: pollinations_free is a zero-key */
  if (info.needsKey !== false && !key) { cb(new Error('no_key')); return false; }
  if (typeof global.fetch !== 'function') { cb(new Error('no_fetch')); return false; }
  /* v0.0.6.m: the pronunciation verifier injects its own strict prompt. */
  var prompt = str(promptOverride) || llmPrompt(words), url = ep.url, headers = { 'Content-Type': 'application/json' }, body = null;
  /* v0.0.6.m: every provider branch names the HTTP status on failure so the
     caller can rotate Groq slots on 429 / quota exhaustion. */
  var statusOf = function (res) {
   return res && typeof res.status === 'number' ? res.status : (res && res.ok ? 200 : 0);
  };
  var failWith = function (status) {
   var err = new Error(status === 429 ? 'groq_rate_limited' : 'llm_failed');
   err.status = Number(status) || 0;
   cb(err);
  };
  if (provider === 'gemini') {
   /* v0.0.4.a W2: model cascade — gemini-2.0-flash → gemini-flash-latest → */
   var models = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];
   if (str(ST.aiModel) && models.indexOf(str(ST.aiModel)) >= 0) {
    models = [str(ST.aiModel)].concat(models.filter(function (m) { return m !== str(ST.aiModel); }));
   }
   var geminiTry = function (mi) {
    var m = models[mi];
    if (!m) { cb(new Error('llm_failed')); return; }
    var gurl = 'https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + encodeURIComponent(str(key));
    var gbody = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } };
    global.fetch(gurl, { method: 'POST', headers: headers, body: JSON.stringify(gbody), cache: 'no-store' })
     .then(function (res) {
      var st = res && typeof res.status === 'number' ? res.status : (res && res.ok ? 200 : 0);
      /* v0.0.6.d (D8): a Gemini quota/auth failure raises the credit banner. */
      if (st === 401 || st === 402 || st === 429) {
        try { paintCreditBanner('Gemini ' + st + ' · ' + (st === 429 ? 'quota exceeded' : 'key rejected')); } catch (e3) {}
      }
      if ((st === 404 || st === 400) && mi + 1 < models.length) { geminiTry(mi + 1); return null; }
      return res && res.json ? res.json() : null;
     })
     .then(function (json) {
      if (json === null) return;
      ST.aiModel = m;
      var raw = '';
      try {
       var parts = json && json.candidates ? json.candidates : null;
       if (Array.isArray(parts) && parts[0] && parts[0].content && Array.isArray(parts[0].content.parts)) raw = str(parts[0].content.parts[0].text);
      } catch (e0) {}
      cb(null, llmRows(provider, json), raw);
     }, function (err) { cb(err || new Error('llm_failed')); });
   };
   try { geminiTry(0); } catch (e) { cb(e || new Error('llm_failed')); return false; }
   return true;
  } else {
   /* D10: no Authorization header at */
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
    .then(function (res) {
     /* v0.0.6.m: a non-2xx OpenAI-compatible answer (Groq 429 rate limit,
        401/402 key trouble) fails WITH its status so the caller can rotate
        to the next Groq slot instead of parsing an error body as JSON. */
     if (!res || !res.ok) { failWith(statusOf(res)); return null; }
     return res && res.json ? res.json() : null;
    })
    .then(function (json) {
     if (json === null) return;
     var raw = '';
     try {
      var choice = json && json.choices ? json.choices[0] : null;
      if (choice && choice.message) raw = str(choice.message.content);
     } catch (e0) {}
     cb(null, llmRows(provider, json), raw);
    }, function (err) { cb(err || new Error('llm_failed')); });
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
  if (!list.length) { clearBusy(); cb(new Error('no_words')); return { ok: false, reason: 'no_words', words: [] }; }
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
   var deltaHit = (Array.isArray(opts.deltaOnly) && opts.deltaOnly.indexOf(word.toLowerCase()) >= 0);
   if (force || deltaHit || !hasFullRecord(merged) || str(merged.enrichSource) === 'lexicon') needs.push(slot);
  }
  ST.enriching = true;
  var offlineCount = 0, provider = aiProviderName(), capped = false;
  /* D3: live n/total progress + ONE */
  var total = needs.length, done = 0, settled = false, cap = null;
  function paintProgress() {
   var line = t('studioEnriching') + ' ' + done + '/' + total + '…';
   testStatus(line, '');
   setText(byId('studioEnrichStatus'), line);
  }
  function stopCap() { if (cap) { try { global.clearTimeout(cap); } catch (e) {} cap = null; } }
  function finishAll() {
   if (settled) return null;
   settled = true; stopCap();
   var out = [], j;
   for (j = 0; j < slots.length; j++) out.push(slots[j].record);
   ST.enriching = false;
   ST.enrichStatus = t('studioEnriched') + ' · ' + out.length + (offlineCount ? ' · ' + t('studioAiOffline') : '');
   setStudioWords(out);
   setText(byId('studioEnrichStatus'), ST.enrichStatus);
   msg(ST.enrichStatus, 'ok');
   testStatus(ST.enrichStatus + ' · ' + (provider === 'free_dict' ? 'free dictionary' : provider), 'ok');
   paintLecturerBar();
   var report = { ok: true, words: out, enriched: total, offline: offlineCount, provider: provider, capped: capped };
   cb(null, report);
   return report;
  }
  function capRemaining() {
   if (settled) return false;
   /* D3: every still-pending word */
   capped = true;
   for (var j = 0; j < needs.length; j++) {
    if (needs[j].recordDone) continue;
    needs[j].record = fallbackEnrich(needs[j].w, needs[j].prior);
    needs[j].recordDone = true;
    offlineCount += 1;
   }
   done = total;
   paintProgress();
   finishAll();
   return true;
  }
  function afterFree(index) {
   if (settled) return;
   if (index >= needs.length) { finishAll(); return; }
   var slot = needs[index];
   paintProgress();
   freeEnrichOne(slot.w, slot.prior, function (err, record, offline) {
    if (settled) return;
    slot.record = record;
    slot.recordDone = true;
    if (offline) offlineCount += 1;
    done = Math.min(total, done + 1);
    paintProgress();
    afterFree(index + 1);
   });
  }
  if (!needs.length) { ST.enriching = false; return finishAll(); }
  cap = global.setTimeout(capRemaining, 45000);
  if (aiNeedsLlm()) {
   var names = [], k;
   for (k = 0; k < needs.length; k++) names.push(needs[k].w);
   testStatus(t('studioEnriching') + ' · ' + provider, '');
   llmRequest(provider, aiProviderKey(), names, function (err, rows) {
    /* D6: when LLM slot fails, immediately */
    if (err || !isObj(rows)) {
     testStatus(T('studioAiOfflineFallback'), 'warn');
     afterFree(0);
     return;
    }
    if (settled) return;
    var rest = [], m;
    for (m = 0; m < needs.length; m++) {
     var slot2 = needs[m];
     var row = rows[slot2.w.toLowerCase()];
     if (isObj(row)) {
      slot2.record = mergeEnrichRecord(slot2.w, slot2.prior, row);
      slot2.recordDone = true;
      done = Math.min(total, done + 1);
     } else rest.push(slot2);
    }
    needs = rest;
    paintProgress();
    afterFree(0);
   });
   return { ok: true, pending: true, words: slots.length, provider: provider };
  }
  afterFree(0);
  return { ok: true, pending: true, words: slots.length, provider: provider };
 }
 /* D10: the zero-key dictionary probe */
 function freeDictTest(word, cb) {
  cb = cb || noop;
  var pending = 2, okDict = false, okSi = false;
  function done() {
   pending -= 1;
   if (pending > 0) return;
   var offline = !(okDict || okSi);
   testStatus((offline ? ' Free Dictionary ready · ' + t('studioAiOffline')
    : ' Free Dictionary ready · zero API key' + (okSi ? ' · EN→SI OK' : '')), 'ok');
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
 /* `testAiEngine` — #btnTestAi. Never */
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
    /* D10: a timed-out free LLM falls */
    testStatus(' ' + provider + ' · ' + str(err.message || 'llm_failed') + ' — ' + t('studioAiOffline'), '');
    freeDictTest(word, function (e2, report) {
     var out = report || { ok: true, provider: 'free_dict', word: word };
     out.provider = 'free_dict';
     out.fellBackFrom = provider;
     cb(null, out);
    });
    return;
   }
   var row = isObj(rows) ? rows[word.toLowerCase()] : null;
   testStatus(' ' + provider + ' ready · ' + (row ? 'JSON row valid' : 'reachable'), 'ok');
   cb(null, { ok: true, provider: provider, validated: !!row, word: word });
  });
  return { ok: true, pending: true, provider: provider };
 }

 /* ══ R9 / D15 / D19: one publish */
 /* W8/D19: stamp ONE syncRev into */
 function publishConfigAndVersion(cfgBody, envelope, label, cb) {
  cb = cb || noop;
  var token = str(ST.secrets.ghToken);
  var body = isObj(cfgBody) ? cfgBody : (sync() && sync().config ? JSON.parse(JSON.stringify(sync().config() || {})) : {});
  var live = sync() && sync().version ? (sync().version() || {}) : {};
  var sess = str(live.session || '8') || '8';
  /* D14/W8: ONE publish clock per call */
  var rev = nextSyncRev();
  var versionBody = buildVersionPayload(sess, str(live.title || '') || ('Session ' + sess), rev);
  var settingsRev = Number(versionBody.settingsRev);
  versionBody.syncRev = Number(rev);
  versionBody.settingsRev = settingsRev;
  /* D17: prove this publish did NOT */
  versionBody.payloadFiles = ['data/config.json', 'data/version.json'];
  body.ver = schemaVer(); body.appVersion = appVersion(); body.version = appVersion();
  body.schema = schemaVer();
  body.settingsRev = settingsRev;
  body.syncRev = Number(rev);
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
  if (!ST.unlocked) { clearBusy(); cb(new Error('locked')); return { ok: false, reason: 'locked' }; }
  var token = str(ST.secrets.ghToken) || fieldValue('ghTokenInput');
  if (!token) { clearBusy(); msg(t('studioNoToken'), 'bad'); cb(new Error('no_token')); return { ok: false, reason: 'no_token' }; }
  if (!sync() || !sync().publishFilesSequential) { clearBusy(); cb(new Error('no_sync')); return { ok: false, reason: 'no_sync' }; }
  var syncRev = nextSyncRev();
  var liveVersion = sync().version ? (sync().version() || {}) : {};
  var sessionNo = str(opts.sessionNo || ST.sessionNo || fieldValue('studioSessionNoInput') || liveVersion.session || (sync().sessionNo ? sync().sessionNo() : '8')) || '8';
  var title = str(opts.title || ST.title || fieldValue('studioSessionTitleInput') || liveVersion.title || '') || ('Session ' + sessionNo);
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
  cfg.classSettings = classSettingsPayload();
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
   if (err) { clearBusy(); cb(err, info); return; }
   bumpMeterCache();
   /* v0.0.6.c (F1): a landed atomic publish clears every dirty flag. */
   ST.dirty = false;
   ST.wordsDirty = false;
   ST.wordDeltas = [];
   try { paintDirtyState(); } catch (e2) {}
   ST.lastPublish = { at: Date.now(), syncRev: syncRev, files: files.map(function (f) { return f.path; }), version: version };
   cb(null, ST.lastPublish);
  });
  return { ok: true, pending: true, syncRev: syncRev };
 }
 
 /* D4: generate clips (non-fatal */
 function publishWordsAndVoice(cb) {
  cb = cb || noop;
  /* v0.0.6.c (F1): Fast Delta Enrich (<2s in-app budget) — ONLY the words */
  function enrichDeltas(next) {
   try { detectWordDeltas(); } catch (e) {}
   if (!ST.wordsDirty || !ST.wordDeltas.length) { next(); return; }
   var names = [], i;
   for (i = 0; i < ST.wordDeltas.length; i++) names.push(ST.wordDeltas[i].w);
   var raw = fieldValue('studioBulkWords') || wordsToText(currentWords());
   var list = parseBulkWords(raw);
   /* mark ONLY the changed words for the enricher (force the rest off) */
   var forceNames = names.map(function (n) { return n.toLowerCase(); });
   for (i = 0; i < list.length; i++) {
    var w = str(list[i] && list[i].w).toLowerCase();
    list[i].force = forceNames.indexOf(w) >= 0;
   }
   enrichWords(list, { force: false, deltaOnly: forceNames }, function () {
    paintWordManager();
    next();
   });
  }
  /* Fast Delta Voice: generateClips already skips every unchanged clip at 0 */
  function voiceDeltas(next) {
   if (!str(ST.secrets.elevenKey) || !allowAutoGen()) { next(); return; }
   generateClips({ noCommit: true }, function (e, i) {
    if (e && !(i && i.tierLimited)) { clearBusy(); msg(t('studioPublishFail'), 'bad'); cb(e, i); return; }
    next();
   });
  }
  /* D18 mirror: any pipeline failure must clear every busy flag. */
  function failPipeline(err, info) { clearBusy(); msg(t('studioPublishFail') + ' \u00b7 ' + publishReason(err, info), 'bad'); cb(err, info); }
  function pub() { publishBundle(currentWords(), {}, function (err, info) {
   if (err) { clearBusy(); msg(t('studioPublishFail') + ' \u00b7 ' + publishReason(err, info), 'bad'); cb(err, info); return; }
   try {
    if (SDP.Speech) {
     if (SDP.Speech.injectClips) SDP.Speech.injectClips(ST.voicePack.clips || {});
     if (SDP.Speech.reloadManifest) SDP.Speech.reloadManifest(true);
    }
   } catch (e) {}
   /* v0.0.6.c (F1): the publish LANDED — clear the red warning, paint the */
   ST.dirty = false;
   ST.wordsDirty = false;
   ST.wordDeltas = [];
   paintDirtyState();
   var last = byId('lecturerSyncLast');
   if (last) {
    last.textContent = t('lecturerSyncLast') + ' \u00b7 ' + hhmm() + ' \u00b7 Rev #' + str(info && info.syncRev);
    last.setAttribute('data-state', 'ok');
   }
   var saved = clipCount() + t('studioClipsSaved') + (info && info.syncRev) + ' \u00b7 data/elevenlabs-audio.json';
   paintGenProgress(saved);
   paintPackDashboard();
   msg(saved, 'ok'); toast(T('studioPublishOkFull')); cb(null, info);
  }); }
  enrichDeltas(function () { voiceDeltas(pub); });
 }
 /* Re-seal the vault (and recompute */
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
   /* D5: mirror the envelope + */
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
 /* #btnOneClickMasterSetup — v0.0.6.a Track 6: the animated All-in-One wizard. */
 function oneClickMasterSetup(cb) {
  cb = cb || noop;
  if (!ST.unlocked) { msg(t('studioLocked'), 'bad'); cb(new Error('locked')); return { ok: false, reason: 'locked' }; }
  if (ST.publishing) { cb(new Error('busy')); return { ok: false, reason: 'busy' }; }
  ST.publishing = true;
  ST.tierWarn = '';
  var elKey = '', gh = '';
  function fail(step, detail) {
   ST.publishing = false;
   setMasterStep(step, 'bad');
   paintErrorAssistant(step, detail);
   msg(t('studioPublishFail') + ' · ' + str(detail), 'bad');
   paintLecturerBar();
   cb(new Error('master_setup_failed'), { ok: false, step: step, detail: str(detail) });
  }
  /* v0.0.6.a: human-friendly bilingual Problem+Solution card. */
  function paintErrorAssistant(step, detail) {
   var host = byId('studioErrorAssistant');
   if (!host) return false;
   var problems = {
    1: ['The vault or a key could not be verified. Usually an expired GitHub token, a wrong PIN, or a missing AI key.',
        'තහඩුව හෝ යතුරක් තහවුරු කළ නොහැකි විය. සාමාන්‍යයෙන් ඉකුත් වූ GitHub token, වැරදි PIN එකක් හෝ AI යතුරක් නොමැති වීමයි.'],
    2: ['Auto-enrichment did not finish for every word. The network may be offline or the AI quota is exhausted.',
        'ස්වයංක්‍රීය පොහොසත් කිරීම සියලු වචන සඳහා නොනිමිණි. ජාලය නොමැති වීම හෝ AI කෝටාව අවසන් වීම විය හැකියි.'],
    3: ['The voice pack sync hit a limit or a missing clip. Existing clips are always reused at 0 credits.',
        'හඬ පැකේජ සමමුහුර්තයට සීමාවක් හෝ නොමැති ක්ලිප් එකක් බාධා කළා. පවතින ක්ලිප් සැමවිටම 0 ක්‍රෙඩිට් වලින් නැවත භාවිත වේ.'],
    4: ['The publish did not land. Most often a 409 conflict (another device pushed first) or a rate limit.',
        'පළ කිරීම සාර්ථක නොවීය. බොහෝවිට 409 ගැටුමක් (වෙනත් උපාංගයක් පළ කර ඇත) හෝ සීමාවකි.']
   };
   var solutions = {
    1: 'Re-enter the GitHub token (ghp_…/github_pat_…) and the PIN, then press 1-Click Fix.',
    2: 'Check the connection, then press 1-Click Fix — the built-in offline British IPA lexicon finishes the words with zero credits.',
    3: 'Press 1-Click Fix to run the 0-credit recovery (reuse the 100 saved clips + history).',
    4: 'Press 1-Click Fix — the publisher retries with a fresh SHA and a monotonic syncRev.'
   };
   var pair = problems[step] || problems[4];
   host.setAttribute('data-step', String(step));
   host.setAttribute('data-state', 'visible');
   host.innerHTML =
    '<h4 class="studio-h4">⚠ ' + T('studioErrTitle') + '</h4>' +
    '<p class="studio-err-line">' + esc(str(detail) || pair[0]) + '</p>' +
    '<p class="studio-err-line">' + esc(pair[0]) + '</p>' +
    '<p class="studio-err-line" lang="si">' + esc(pair[1]) + '</p>' +
    '<p class="studio-err-solution">→ ' + esc(solutions[step] || solutions[4]) + '</p>' +
    '<div class="chip-row">' +
    btn('btnRetryFailedStep', t('studioErrFixNow'), 'btn-primary', 'data-retry-step="' + step + '"') +
    btn('btnDismissError', t('studioErrDismiss'), 'btn-ghost') +
    '</div>';
   try { host.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
   return true;
  }
  function hideErrorAssistant() {
   var host = byId('studioErrorAssistant');
   if (host) { host.setAttribute('data-state', 'hidden'); host.innerHTML = ''; }
   return true;
  }
  function step4(genInfo) {
   setMasterStep(4, 'active');
   publishBundle(currentWords(), {}, function (pubErr, pubInfo) {
    if (pubErr) { fail(4, publishReason(pubErr, pubInfo)); return; }
    try { if (SDP.Speech && SDP.Speech.injectClips) SDP.Speech.injectClips(ST.voicePack.clips || {}); } catch (e) {}
    ST.publishing = false;
    ST.masterStep = 5;
    ST.masterDetail = 'ok';
    hideErrorAssistant();
    paintMasterSteps();
    paintVaultBadge();
    var made = genInfo && genInfo.made ? genInfo.made.length : 0;
    var totalClips = clipCount();
    var savedLine = totalClips + t('studioClipsSaved') + (pubInfo && pubInfo.syncRev) + ' · data/elevenlabs-audio.json · 0 credits';
    msg(savedLine, 'ok');
    paintGenProgress(savedLine);
    paintPackDashboard();
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
  /* Step 3 — voice pack with the IRON LAW 0-credit guard: existing clips and */
  function step3() {
   setMasterStep(3, 'active');
   if (!elKey) {
    var note = tierWarning();
    msg(' ' + note, '');
    testStatus(' ' + note, '');
    step4({ made: [], skipped: 0, tierLimited: true });
    return;
   }
   generateClips({ force: false, noCommit: true }, function (genErr, genInfo) {
    if (genErr && !(genInfo && genInfo.tierLimited)) { fail(3, quotaError(genErr)); return; }
    step4(genInfo || { made: [], skipped: 0 });
   });
  }
  /* Step 2 — auto-enrich every word with real British IPA; the offline */
  function step2() {
   setMasterStep(2, 'active');
   var raw = fieldValue('studioBulkWords') || wordsToText(currentWords());
   enrichWords(raw, { force: false }, function (err) {
    if (err && str(err && err.message) === 'no_words') { fail(2, 'paste the 30 words first'); return; }
    testStatus(t('studioEnriched') + ' · real British IPA /…/ · POS · EN+SI meanings', 'ok');
    step3();
   });
  }
  /* Step 1 — read inputs, seal vault, verify GitHub token. */
  setMasterStep(1, 'active');
  hideErrorAssistant();
  var prevSecrets = secretSnapshot();
  mergeSecretInputs();
  guardSecretMerge(prevSecrets);
  elKey = str(ST.secrets.elevenKey);
  gh = str(ST.secrets.ghToken);
  sealVaultNow(function (sealErr, envelope, verifier) {
   if (!sealErr) writeLayerOne(envelope, verifier || pinVerifier());
   if (sealErr) { fail(1, 'the vault could not be sealed — check the PIN (4–8 digits) and try again'); return; }
   if (!gh) { fail(1, 'GitHub token missing — add a ghp_… / github_pat_… token in Key 2'); return; }
   testGitHubToken(gh, function (ghErr) {
    if (ghErr) { fail(1, ghError(ghErr)); return; }
    testStatus(T('vaultBadgeLabel') + ' · keys verified', 'ok');
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

 /* ── publishing: sequential */
 /* contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 publishing */
 /* D13/D19: the pre-publish checklist */
 /* D17: the vault legs are REQUIRED only */
 function publishChecklist(payloads, opts) {
  opts = opts || {};
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
  var needVault = hasVault() || !!opts.requireVault;
  if (needVault) {
   if (!env) problems.push('vault envelope missing');
   if (!isObj(cfg.pinVerifier) || !str(cfg.pinVerifier.hash)) problems.push('pinVerifier missing');
  }
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
  /* v0.0.6.m Pillar 2: Publish & Sync first auto-synthesizes any missing
     or drifted essential system clips (commands / guide / briefing beats),
     so they ride along in this very GitHub sync — the creator only ever
     edits the 30 Dictation Words by hand. */
  autoEnsureSystemClips({ source: 'publish' }, function () {
    /* v0.0.6.m FIX 1: Publish & Sync also completes any missing briefing/guide audio through the real API before the push. */
    ensureBriefingAndGuideVoices({ source: 'publish' }, noop);
    /* v0.0.6.n cache-bust law: a publish must also purge any stale
       briefing/guide clip left in the local audio cache. */
    try {
      if (global.SDP && SDP.Sync && SDP.Sync.purgeStaleBriefingClips) SDP.Sync.purgeStaleBriefingClips();
    } catch (eP) {}
   var payloads = buildPublishPayloads(currentWords(), {});
   /* D19: refuse a broken payload */
   var problems = publishChecklist(payloads, { requireVault: false });
   if (problems.length) {
    msg(t('studioPublishFail') + ' · ' + problems.join(' · '), 'bad');
    clearBusy();
    cb(new Error('checklist_failed'));
    return;
   }
   /* D17: no vault yet is a warning */
   if (!hasVault()) {
    testStatus(' ' + t('studioNoVaultWarn'), 'warn');
    toast(t('studioNoVaultWarn'));
   }
   return publishBundle(currentWords(), {}, function (err, info) {
    if (err) { clearBusy(); cb(err, info); return; }
    msg(t('studioPublishOk') + ' · v' + appVersion(), 'ok');
    cb(null, info);
   });
  });
 }

 /* ══ D-C1..C7: credit-safe Alice */
 function elevenUrl() { return 'https://api.elevenlabs.io/v1/text-to-speech/' + activeVoiceId; }
/* v0.0.6.m: the Project Briefing clips synthesize with the dedicated
   British male narrator voice (human click only, W5 credit safety). */
function introVoiceTtsUrl() { return 'https://api.elevenlabs.io/v1/text-to-speech/' + INTRO_VOICE.id; }
 function guideSteps() {
  /* R5: the four reusable guide clips. The frozen legacy keys stay readable */
  var out = [], i;
  for (i = 1; i <= 4; i++) out.push({ key: '_guide_' + i, text: GUIDE_CLIP_TEXTS[i - 1] });
  return out;
 }
 function commandClips() {
  var out = [], i;
  for (i = 0; i < CMD_CLIPS.length; i++) out.push({ key: CMD_CLIPS[i].key, text: CMD_CLIPS[i].text });
  return out;
 }
 function numberClips() {
  var out = [], i;
  for (i = 1; i <= WORD_CAP; i++) out.push({ key: 'num.' + i, text: numberClipText(i) });
  return out;
 }
 function costPreview(words) {
  var list = Array.isArray(words) ? words : currentWords();
  var wordChars = 0, i, count = Math.min(WORD_CAP, list.length);
  for (i = 0; i < count; i++) wordChars += str((list[i] || {}).w).length;
  var numbers = numberClips(), numsChars = 0;
  for (i = 0; i < numbers.length; i++) numsChars += numbers[i].text.length;
  var cmds = commandClips(), cmdChars = 0;
  for (i = 0; i < cmds.length; i++) cmdChars += cmds[i].text.length;
  var steps = guideSteps(), guideChars = 0;
  for (i = 0; i < steps.length; i++) guideChars += steps[i].text.length;
  /* v0.0.6.m Pillar 1: the 4 Project Briefing beats (deep British male). */
  var intro = introSteps(), introChars = 0;
  for (i = 0; i < intro.length; i++) introChars += intro[i].text.length;
  var clips = count + numbers.length + cmds.length + steps.length + intro.length;
  return {
   words: wordChars, numbers: numsChars, commands: cmdChars, guide: guideChars, intro: introChars,
   total: wordChars + numsChars + cmdChars + guideChars + introChars, count: count, clips: clips
  };
 }
 function costPreviewLine(words) {
  var c = costPreview(words);
  /* R5: the 74-clip arithmetic, always stated, never guessed. */
  return c.count + ' words = ' + c.words + ' chars · 30 numbers = ' + c.numbers +
   ' chars · 6 commands = ' + c.commands + ' chars · 4 guide steps = ' + c.guide +
   ' chars · 4 intro steps = ' + c.intro + ' chars · total ' + c.total + ' chars · ' + c.clips +
   ' clips (30 words + 30 numbers + 6 commands + 4 guide steps + 4 intro steps)';
 }
 /* D2: 403 / missing_permissions / */
 /* D5/D16: human error sentences. */
 function quotaError(err) {
  var d = str(err && err.code), c = Number((err && err.status) || 0), m = str(err && err.message);
  if (err && err.scoped) return SCOPED_NOTE();
  if (d === 'invalid_api_key' || c === 401) return 'ElevenLabs key not accepted — please check and try again';
  if (d === 'missing_permissions' || c === 403) return SCOPED_NOTE();
  if (c === 402 && /paid_plan_required|library voices/i.test(m + ' ' + d)) return 'This voice needs an ElevenLabs paid plan — switched to the free British female educator voice (Alice)';
  if (d === 'quota_exceeded' || c === 402) 'ElevenLabs free quota used up — top up or wait for renewal';
  if (c === 429) return 'ElevenLabs is busy — trying again in a few seconds';
  if (c === 422) return 'Voice settings not on this plan — using simplified settings';
  if (c === 400) return 'ElevenLabs could not process the request — please try again';
  if (c === 500) return 'ElevenLabs server temporarily unavailable — try again soon';
  if (c > 0) return 'ElevenLabs returned an unexpected response — please try again';
  if (m === 'empty_audio' || m === 'encode_failed') return 'Voice clip could not be created — please try again';
  if (m === 'network_error' || m === 'network error' || m === 'no_fetch') return 'Network problem — check your internet and try again';
  if (!m || m === 'subscription_failed' || m === 'key_rejected' || m === 'tts_failed') return 'ElevenLabs key kept — quota read unavailable, voice generation still works';
  return 'Something went wrong with the voice service — please try again';
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
 /* D7: the sync module owns the */
 function publishErrorText(status, message) {
  try { if (sync() && sync().publishErrorText) return sync().publishErrorText(Number(status) || 0, str(message)); } catch (e) {}
  return 'Network problem — check your internet and try again';
 }
 /* D6/D7: the best human reason out */
 function publishReason(err, info) {
  var list = err && Array.isArray(err.errors) ? err.errors : (info && Array.isArray(info.errors) ? info.errors : []);
  var reason = str(err && err.reason) || (list.length ? str(list[0].message) : '');
  if (!reason) {
   var text = str(err && err.message);
   if (text === 'no_token') reason = t('studioNoToken');
   else reason = publishErrorText(Number(err && err.status) || 0, text !== 'publish_partial' ? text : '');
  }
  return reason;
 }
 function hhmm() { return new Date().toISOString().slice(11, 16); }
 function paintLecturerBar() {
  try { if (global.SDP && SDP.Views && SDP.Views.paintLecturerBar) return SDP.Views.paintLecturerBar(); } catch (e) {}
  return false;
 }
 function clearBusy() { ST.generating = false; ST.publishing = false; ST.enriching = false; paintLecturerBar(); }
 function bumpMeterCache() {
  try { if (global.SDPDataMeter && global.SDPDataMeter.clearCache) return global.SDPDataMeter.clearCache(); } catch (e) {}
  return '';
 }
 /* D1 (Rule 1A) — the 3-rung */
 function trimmedKey(key) { return str(key).replace(/^\s+|\s+$/g, ''); }
 /* R4 (F5): ONLY an sk_… secret is an API key. The 64-char e1b… value is the */
 function looksLikeElevenKey(key) {
  return /^sk_[A-Za-z0-9_]{20,}$/.test(trimmedKey(key));
 }
 function elevenKeyHint() { return t('studioVerifyHint', 'INVALID KEY — paste the sk_… secret from ElevenLabs'); }

 /* ══ R4: the live ElevenLabs key verifier ══════════════════════════════ */
 function paintElVerify(text, state) {
  var node = byId('elVerifyStatus');
  if (!node) return false;
  node.textContent = str(text);
  if (state) node.setAttribute('data-state', state);
  else node.removeAttribute('data-state');
  return true;
 }
 function playVaultClip(key) {
  var entry = ST.voicePack.clips ? ST.voicePack.clips[key] : null;
  var url = '';
  if (typeof entry === 'string') url = entry;
  else if (isObj(entry)) url = str(entry.url) || (str(entry.b64) ? 'data:audio/mpeg;base64,' + str(entry.b64) : '');
  if (!url) return false;
  try { if (SDP.Speech && SDP.Speech.playUrl) { SDP.Speech.playUrl(url, { timeoutMs: 15000 }, noop); return true; } } catch (e) {}
  return false;
 }
 function verifyElevenKey() {
  var key = trimmedKey(fieldValue('elKeyInput') || str(ST.secrets.elevenKey));
  if (!looksLikeElevenKey(key)) {
   paintElVerify(elevenKeyHint(), 'bad');
   msg(elevenKeyHint(), 'bad');
   return false;
  }
  paintElVerify(t('studioWorking', 'Working…'), '');
  elevenGet(EL_SUBSCRIPTION, key, function (err, res) {
   if (!res || !res.ok) {
    var status = Number((res && res.status) || 0);
    var line = t('studioVerifyBad') + status + ' — ' + t('studioVerifyHint') + ')';
    paintElVerify(line, 'bad');
    return;
   }
   var b = isObj(res.body) ? res.body : {};
   var used = Number(b.character_count), lim = Number(b.character_limit);
   if (isNaN(used)) used = 0;
   if (isNaN(lim)) lim = 0;
   var left = Math.max(0, lim - used);
   paintElVerify(t('studioVerifyOk') + left + ' / ' + lim + ' chars)', 'ok');
   testStatus(' ' + t('studioVerifyOk') + left + ' / ' + lim + ' chars)', 'ok');
   /* VALID: prove the voice. A cached sample is free; otherwise ONE 36-char */
   ST.secrets = isObj(ST.secrets) ? ST.secrets : {};
   ST.secrets.elevenKey = key;
   if (clipExists('cmd.sample')) { playVaultClip('cmd.sample'); return true; }
   generateClips({ keys: ['cmd.sample'] }, function () { playVaultClip('cmd.sample'); });
   return true;
  });
  return true;
 }

 /* ══ R7 (F7): the atomic fresh-salt PIN re-seal ═════════════════════════ */
 function isBootstrapPin(pin) { return trimmedKey(pin) === BOOTSTRAP_PIN; }
 function recoveryOpen(cb) {
  cb = cb || noop;
  ST.recoveryMode = true;
  ST.unlocked = true;
  ST.bootstrapMode = true;
  ST.pin = '';
  ST.envelope = '';
  ST.secrets = isObj(ST.secrets) ? ST.secrets : {};
  msg(t('studioChangePinBtn') + ' — ' + t('studioRecoveryUsed'), 'warn');
  try { mount(); } catch (e) {}
  try { paintLecturerBar(); } catch (e) {}
  try { loadVoicePack(noop); } catch (e) {}
  cb(null, ST.secrets);
  return true;
 }
 function changePin(cb) {
  cb = cb || noop;
  var want = newPinValue(), confirm = confirmPinValue();
  if (want.length < PIN_MIN || want.length > PIN_MAX) { msg(t('studioBadPin'), 'bad'); cb(new Error('bad_pin')); return false; }
  if (want !== confirm) { msg(t('studioPinMismatch'), 'bad'); cb(new Error('pin_mismatch')); return false; }
  var v = vault();
  if (!v || !v.computePinVerifier || !v.encryptV2) { msg(t('studioPublishFail') + ' · crypto_unavailable', 'bad'); cb(new Error('crypto_unavailable')); return false; }
  var plain = isObj(ST.secrets) ? ST.secrets : {};
  /* A FRESH salt every time — never reuse the old verifier's salt. */
  v.computePinVerifier(want).then(function (verifier) {
   return v.encryptV2(plain, want).then(function (envelope) {
    ST.pin = want;
    ST.envelope = envelope;
    ST.recoveryMode = false;
    writeLayerOne(envelope, verifier);
    /* v0.0.6.d (D8): remember the new PIN length so the gate renders exactly */
    try {
     var lock = layerOneVault();
     lock.pinLen = want.length;
     data().saveSettings({ vaultLock: lock });
    } catch (e2) {}
    var cfgBody = sync().config ? JSON.parse(JSON.stringify(sync().config() || {})) : {};
    cfgBody.encVault = envelope;
    cfgBody.pinVerifier = verifier;
    publishConfigAndVersion(cfgBody, envelope, 'Lecturer PIN change ' + appVersion(), function (err) {
     if (err) { msg(t('studioPublishFail'), 'bad'); cb(err); return; }
     msg(t('studioPublishOk') + ' · ' + t('studioChangePinBtn'), 'ok');
     try { mount(); } catch (e) {}
     cb(null, true);
    });
    return true;
   });
  }, function (err) { msg(t('studioPublishFail') + ' · encrypt_failed', 'bad'); cb(err || new Error('encrypt_failed')); });
  return true;
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
 /* Zero-cost endpoint: reading the */
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
    line = ' ' + quotaError(err);
    setText(byId('quotaText'), line);
    testStatus(line, 'bad');
    cb(err);
    return;
   }
   /* D2: a scoped key paints GREEN, never a */
   if (result && result.scoped) line = str(result.note) || SCOPED_NOTE();
   else line = 'Used ' + result.used + ' / Limit ' + result.limit + ' chars · Remaining: ' + result.remaining;
   setText(byId('quotaText'), line);
   testStatus((result && result.scoped ? ' ' : ' ElevenLabs Connected · ') + line, 'ok');
   cb(null, result);
  });
  return true;
 }
 function checkQuota(key, cb) { return probeQuota(key, cb); }
 function testElevenLabsKey(key, cb) { return probeQuota(key, cb); }
 function refreshQuota(cb) { return probeQuota(str(ST.secrets.elevenKey) || fieldValue('elKeyInput'), cb); }
 /* D-L3: accepts classic ghp_ tokens */
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
    testStatus(' GitHub Connected (' + result.repo + ' · Write OK)', 'ok');
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
 /* R2/D2: read the pack through the */
 function loadVoicePack(cb) {
  cb = cb || noop;
  if (ST.voicePack.loaded) { cb(null, ST.voicePack); return true; }
  SDP.Sync.fetchFreshDataJson('data/elevenlabs-audio.json', function (err, result) {
   if (err || !result || !result.ok) { ST.voicePack.loaded = true; cb(err || new Error('pack_failed')); return; }
   var pack = result.json;
   if (isObj(pack) && isObj(pack.clips)) ST.voicePack.clips = pack.clips;
   /* v0.0.4.b: the shipped pack is b64-only; drop any legacy .url in memory. */
   if (isObj(ST.voicePack.clips)) {
    for (var ck in ST.voicePack.clips) {
     if (!Object.prototype.hasOwnProperty.call(ST.voicePack.clips, ck)) continue;
     var ce2 = ST.voicePack.clips[ck];
     if (ce2 && typeof ce2 === 'object' && ce2.url) delete ce2.url;
    }
   }
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
   /* R5: the new key is words.<w>; the bare legacy key stays readable. */
   queue.push({ key: 'words.' + text.toLowerCase(), legacyKey: text.toLowerCase(), text: text });
   if (singleTest) return queue; /* 1-Word Test: ~8 chars, ~1 credit unit */
  }
  if (singleTest) return queue;
  var numbers = numberClips();
  for (i = 0; i < numbers.length; i++) queue.push(numbers[i]);
  var cmds = commandClips();
  for (i = 0; i < cmds.length; i++) queue.push(cmds[i]);
  for (i = 0; i < GUIDE_CLIP_TEXTS.length; i++) queue.push({ key: 'guide.en.' + i, text: GUIDE_CLIP_TEXTS[i] });
  return queue;
 }

 /* D4: the delta-retry queue — only the requested keys, never a paid clip. */
 function queueFor(words, singleTest, keys) {
  var queue = buildQueue(words, singleTest);
  if (!Array.isArray(keys) || !keys.length) return queue;
  var keep = [], i;
  for (i = 0; i < queue.length; i++) if (keys.indexOf(queue[i].key) >= 0) keep.push(queue[i]);
  return keep.length ? keep : queue;
 }
 /* D-C1/C2/C5/C6/C7: generate ONLY the */
 function generateClips(a, b) {
  var opts = {}, cb = noop;
  if (typeof a === 'function') cb = a;
  else if (Array.isArray(a)) { opts = { words: a }; cb = typeof b === 'function' ? b : noop; }
  else { opts = isObj(a) ? a : {}; cb = typeof b === 'function' ? b : noop; }
  if (!ST.unlocked) { cb(new Error('locked')); return { ok: false, reason: 'locked' }; }
  if (!ST.voicePack.loaded) loadVoicePack(noop);
  /* v0.0.6.m Pillar 2: the active key comes from the pool (primary field
     first, then the Slot #5 ElevenLabs backup). A 401/402/429 from the
     primary mid-batch rotates to the backup key instantly — the batch
     keeps its progress and the backup's credits carry on until the
     creator updates the primary key. */
  poolCursor = 0;
  var apiKey = resolveElevenKey();
  if (!apiKey) { msg(t('studioNoToken'), 'bad'); cb(new Error('no_key')); return { ok: false, reason: 'no_key' }; }
  var introMode = !!opts.intro;
  /* v0.0.6.m Pillar 1: the Project Briefing clips use the dedicated deep
     British male George voice (ElevenLabs JBFqnCBsd6RMkjVDRZzb). */
  var genVoiceId = introMode ? INTRO_VOICE.id : activeVoiceId;
  var genModel = introMode ? INTRO_VOICE.model : VOICE_MODEL;
  var genUrl = introMode ? introVoiceTtsUrl() : elevenUrl();
  var words = introMode ? [] : (Array.isArray(opts.words) ? opts.words : currentWords());
  /* D-C7: never silently drop words */
  if (words.length > WORD_CAP) {
   msg(str(words.length) + ' words parsed, first 30 used', '');
   toast(str(words.length) + ' words parsed, first 30 used');
  }
  /* v0.0.6.m: intro queues can be filtered to a delta (autoEnsureSystemClips
     regenerates ONLY the drifted beats), and a literal systemQueue carries
     the essential command/guide clips. regenKeys lets the immutable static
     vault re-synthesize a clip whose canonical text drifted. */
  var regenKeys = Array.isArray(opts.regenKeys) ? opts.regenKeys : null;
  var queue;
  if (introMode) {
   queue = introSteps();
   if (Array.isArray(opts.keys) && opts.keys.length) {
    queue = queue.filter(function (it) { return opts.keys.indexOf(it.key) >= 0; });
   }
  } else if (Array.isArray(opts.systemQueue) && opts.systemQueue.length) {
   queue = opts.systemQueue.slice();
  } else {
   queue = queueFor(words, !!opts.singleTest, opts.keys);
  }
  var force = !!opts.force;
  var made = [], skipped = 0, index = 0, calls = 0, stopped = false, tierLimited = false;
  /* D3/D18 (v0.0.2.a): the SAME character counter the preflight uses, so the */
  var runningChars = 0;
  ST.generating = true;
  ST.lastFailedClip = null;
  paintGenProgress(t('studioGenPrefix') + '0/' + queue.length + ' · ' + queue.length + ' ' + t('studioClipsUnit').replace('/', '') + ' queued');
  function finish(err) {
   if (stopped) return;
   stopped = true;
   ST.generating = false;
   paintClipTable();
   paintPackDashboard();
   if (err) {
    /* D4/D18: a failure exit names the exact clip and clears every busy */
    clearBusy();
    var failed = ST.lastFailedClip;
    var why = quotaError(err);
    if (failed) {
     var line = ' ' + failed.key + ' · ' + failed.reason;
     msg(line, 'bad');
     testStatus(line, 'bad');
     paintGenProgress(line);
    } else {
     msg(' ' + why, 'bad');
     testStatus(' ' + why, 'bad');
    }
    cb(err, { made: made, skipped: skipped, calls: calls, tierLimited: tierLimited, failed: failed });
    return;
   }
   /* D4: quota/tier exhaustion is a WARNING */
   var warnLine = tierLimited ? tierWarning() : '';
   msg(t('studioGenerate') + ' ' + made.length + ' · ' + skipped + ' skipped' + (warnLine ? ' · ' + warnLine : ''), 'ok');
   testStatus(warnLine ? ' ' + warnLine : ' ' + made.length + ' new · ' + skipped + ' already cached', warnLine ? '' : 'ok');
   if (made.length && !opts.noCommit) commitVoicePack();
   paintGenProgress(t('studioPackClips') + (made.length + skipped) + t('studioClipsUnit') + ' · ' + runningChars + t('studioGenCharsTail'));
   cb(null, { made: made, skipped: skipped, calls: calls, tierLimited: tierLimited, warning: warnLine });
  }
  function next() {
   if (index >= queue.length) { finish(null); return; }
   var item = queue[index];
   index += 1;
   /* R5: delta on CONTENT, not on mere existence. A clip whose sha1 hash */
   var itemHash = clipContentHash(item.text, genVoiceId, genModel);
   var existing = ST.voicePack.clips[item.key];
   /* v0.0.6.m Pillar 2: immutable static system audio (commands, numbers,
      guides, intro beats) — EXCEPT when autoEnsureSystemClips flagged the
      clip as drifted (regenKeys): the Oct-22 weekly counter bumps the
      Beat 1 sentence every week and the committed clip must follow. */
   if (!force && clipExists(item.key)) {
    if (isStaticClipKey(item.key) && !(regenKeys && regenKeys.indexOf(item.key) >= 0)) { skipped += 1; next(); return; }
    var storedHash = isObj(existing) ? str(existing.hash) : '';
    if (!storedHash || storedHash === itemHash) { skipped += 1; next(); return; }
   }
   calls += 1;
   var charsUsed = str(item.text).length;
   var rotationsThisItem = 0;
   requestClip(item, apiKey, function (err, entry) {
    if (err) {
     /* v0.0.6.m Pillar 2: key-level failures rotate to the next pool slot
        (primary field → Slot #5 backup ElevenLabs key) MID-BATCH without
        losing progress; the backup's credits carry the rest of the run. */
     var st = Number((err && err.status) || 0);
     if ((st === 401 || st === 402 || st === 429) && rotationsThisItem < elevenKeyPool().length - 1) {
      var rotated = rotateElevenKey('http_' + st);
      if (rotated) {
       rotationsThisItem += 1;
       apiKey = rotated;
       index -= 1;
       msg(' Key rotated → Slot #' + (poolCursor + 1) + ' (HTTP ' + st + ')', 'warn');
       next();
       return;
      }
     }
     /* D4: remember the exact clip and its mapped reason for the retry. */
     ST.lastFailedClip = { key: item.key, status: st, reason: quotaError(err) };
     tierLimited = true;
     skipped = Math.max(skipped, queue.length - made.length);
     index = queue.length;
     var w = T('studioElTierWarn'); ST.tierWarn = w;
     msg(' ' + w, 'warn'); testStatus(' ' + w, 'warn');
     finish(null); return;
    }
    ST.voicePack.clips[item.key] = entry;
    made.push({ key: item.key, text: item.text, bytes: entry.bytes });
    ST.voicePack.loaded = true;
    runningChars += charsUsed;
    /* D3: verbatim live progress after every real clip. */
    paintGenProgress(t('studioGenPrefix') + Math.min(queue.length, made.length + skipped) + '/' + queue.length +
     ' · ' + item.key + ' · ' + runningChars + t('studioGenCharsTail'));
    paintClipTable(); /* D14: live row-by-row progress */
    paintPackDashboard();
    next();
   }, 0);
  }
  function requestClip(item, key, done, attempt) {
   /* D13: on 422, retry with minimal… */
   /* v0.0.6.m FIX 1: the briefing/guide beats use the exact George
      voice_settings from the release spec — warm, mature, authoritative
      British male (stability 0.55 / similarity_boost 0.80 / style 0.25). */
   var vs = attempt === 1 ? { stability: 0.5, similarity_boost: 0.75 } : { stability: 0.65, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true };
   if (introMode) vs = { stability: 0.55, similarity_boost: 0.80, style: 0.25 };
   /* v0.0.6.n RECOMMENDATION 1: the briefing/guide beats FIRST attempt
      ElevenLabs' timestamped endpoint — the response carries the exact
      character alignment (characters / character_start_times_seconds /
      character_end_times_seconds), parsed into per-word [startMs, endMs]
      boundaries (wt) for the frame-accurate karaoke clock. Any failure
      falls back seamlessly to the standard endpoint. */
   var url = genUrl;
   var wantTs = false;
   if (introMode) {
     url = genUrl + '/with-timestamps';
     wantTs = true;
   }
   try {
    global.fetch(url, { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: wantTs ? 'application/json' : 'audio/mpeg' }, body: JSON.stringify({ text: item.text, model_id: genModel, voice_settings: vs }) })
     .then(function (res) {
      var st = res && typeof res.status === 'number' ? res.status : (res && res.ok ? 200 : 0);
      if (!res || !res.ok) {
       if (st === 422 && attempt < 1) { requestClip(item, key, done, 1); return null; } /* D13 */
       if (st === 429 && attempt < 1) { global.setTimeout(function () { requestClip(item, key, done, attempt + 1); }, 5000); return null; }
       throw withStatus(new Error('tts_failed'), st || 0);
      }
      if (wantTs) return res.json ? res.json().then(function (j) { return { ts: j }; }) : null;
      return res.arrayBuffer ? res.arrayBuffer() : null;
     }).then(function (payload) {
      if (payload === null) return;
      if (payload && payload.ts) {
       /* /with-timestamps: base64 audio + alignment in one JSON body. */
       var j = payload.ts;
       var b64ts = str(j.audio_base64 || j.audio || j.b64 || '');
       var align = isObj(j.normalized_alignment) ? j.normalized_alignment : (isObj(j.alignment) ? j.alignment : null);
       if (!b64ts || !align) {
        /* Malformed timestamped body → seamless standard-endpoint retry. */
        requestClip(item, key, done, attempt + 1);
        return;
       }
       var wt = parseAlignmentToWordTimings(align, item.text);
       done(null, {
        b64: b64ts, text: str(item.text), bytes: Math.floor(b64ts.length * 3 / 4),
        at: Date.now(), voiceId: genVoiceId, modelId: genModel,
        hashAlgo: HASH_ALGO, hash: clipContentHash(item.text, genVoiceId, genModel),
        wt: wt
       });
       return;
      }
      if (!payload) throw new Error('empty_audio');
      var b64 = arrayBufferToBase64(payload);
      if (!b64) throw new Error('encode_failed');
      done(null, {
       b64: b64, text: str(item.text), bytes: payload.byteLength,
       at: Date.now(), voiceId: genVoiceId, modelId: genModel,
       hashAlgo: HASH_ALGO, hash: clipContentHash(item.text, genVoiceId, genModel)
      });
     }, function (err) { done(err || new Error('tts_failed')); });
   } catch (e) { done(e || new Error('tts_failed')); }
  }
  next();
  return { ok: true, started: queue.length, calls: 0 };
 }

 /* ══ v0.0.6.m Pillar 3 — the in-browser .zip diagnostics exporter ═══════ */
 function buildDiagZip(cb) {
  cb = cb || noop;
  var Diag = null;
  try { Diag = global.SDP && SDP.Diagnostics ? SDP.Diagnostics : null; } catch (e) { Diag = null; }
  if (!Diag || !Diag.buildDiagFiles || !Diag.zipStore) { cb(new Error('no_diagnostics')); return false; }
  Diag.buildDiagFiles().then(function (bundle) {
   var bytes = Diag.zipStore(bundle.files);
   try {
    var blob = new global.Blob([bytes], { type: 'application/zip' });
    var url = global.URL && global.URL.createObjectURL ? global.URL.createObjectURL(blob) : '';
    if (!url) { cb(new Error('no_blob_url')); return; }
    var a = doc.createElement('a');
    a.href = url;
    a.download = 'sdp-diagnostics-' + str(appVersion()) + '.zip';
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    global.setTimeout(function () { try { global.URL.revokeObjectURL(url); } catch (e) {} }, 4000);
    try { Diag.log('diag_zip_exported', { files: bundle.files.length, bytes: bytes.length }); } catch (e) {}
    cb(null, { files: bundle.files.length, bytes: bytes.length });
   } catch (e) { cb(e || new Error('zip_failed')); }
  }, function (err) { cb(err || new Error('decrypt_failed')); });
  return true;
 }
 function paintDiagSummary() {
  var host = byId('diagSummary');
  if (!host) return false;
  var summary = { events: 0, reviews: 0, firstAt: '', lastAt: '' };
  var stats = { locked: 0, total: STATIC_CLIP_KEYS.length };
  try {
   if (global.SDP && SDP.Diagnostics) {
    summary = SDP.Diagnostics.summary();
    stats = staticVaultStats();
   }
  } catch (e) {}
  host.innerHTML =
   '<div class="diag-cell"><strong>' + summary.events + '</strong><span>diagnostic events</span></div>' +
   '<div class="diag-cell"><strong>' + summary.reviews + '</strong><span>encrypted reviews</span></div>' +
   '<div class="diag-cell"><strong>' + stats.locked + ' / ' + stats.total + '</strong><span>static clips locked</span></div>' +
   '<div class="diag-cell"><strong>' + keyPoolCount() + ' / ' + KEY_POOL_SLOTS + '</strong><span>key pool slots</span></div>' +
   '<div class="diag-cell diag-cell-wide"><strong>' + esc(str(summary.lastAt || '—')) + '</strong><span>last captured event</span></div>';
  return true;
 }

 /* ══ v0.0.6.m Pillar 4 — the User Reviews & Session Telemetry feed ═════ */
 function fmtDuration(sec) {
  var s = Math.max(0, Math.round(Number(sec) || 0));
  if (s >= 60) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  return s + 's';
 }
 function authBadgeHtml(tel) {
  if (!isObj(tel)) return '<span class="auth-badge partial">· review only</span>';
  var a = str(tel.authenticityStatus);
  if (a === 'GENUINE_FULL') return '<span class="auth-badge genuine">✓ Genuine · ' + fmtDuration(tel.durationSec) + '</span>';
  if (a === 'RAPID_SKIP_SUSPECT') return '<span class="auth-badge rapid">⚠ Rapid Skip · ' + fmtDuration(tel.durationSec) + ' (' + (Number(tel.rapidSkipCount) || 0) + ' skips)</span>';
  if (a === 'PARTIAL_INCOMPLETE') return '<span class="auth-badge partial">⏳ Incomplete · ' + (Number(tel.wordsCompletedCount) || 0) + '/' + (Number(tel.wordsTotal) || 30) + ' words</span>';
  return '<span class="auth-badge partial">· ' + esc(a) + '</span>';
 }
 var CHIP_LABELS = {
  /* v0.0.6.m FIX 4: the 9 comprehensive 1-tap chips (identical on the
     review card and the FAB drawer), plus the two legacy guide keys. */
  fast: '⚡ Fast & Smooth',
  voice_ok: '🔊 Voice Clear',
  voice_muted: '🔇 Word Audio Not Playing',
  voice_robotic: '🤖 Robotic / Wrong Pronunciation',
  briefing_sync: '🎵 Briefing / Lyrics Sync Issue',
  incomplete: '⏳ Dictation Words Incomplete',
  ui_layout: '📱 Screen / Layout Issue',
  clock_stuck: '⏱ Clock / Play-Pause Stuck',
  cache_stale: '🔄 Old Words / Cache Issue',
  clear: '🔊 Voice Clear', issue: '🐞 Found an Issue'
 };
 var reviewAudioNode = null;
 function playReviewVoice(b64, mime) {
  try {
   if (reviewAudioNode) { try { reviewAudioNode.pause(); } catch (e0) {} reviewAudioNode = null; }
   if (!str(b64)) return false;
   var url = 'data:' + (str(mime) || 'audio/webm') + ';base64,' + str(b64);
   reviewAudioNode = new global.Audio(url);
   reviewAudioNode.play();
   return true;
  } catch (e) { return false; }
 }
 function renderUiSnapshotHtml(snap) {
  var u = isObj(snap) && isObj(snap.ui) ? snap.ui : {};
  var c = isObj(snap) && isObj(snap.cache) ? snap.cache : {};
  var a = isObj(snap) && isObj(snap.audio) ? snap.audio : {};
  var vp = isObj(u.viewport) ? u.viewport : {};
  var els = isObj(u.elements) ? u.elements : {};
  var RECT_IDS = ['appHeader', 'ringWrap', 'btnPlayPause', 'tabbar', 'briefingModal', 'reviewPopupCard'];
  var rows = '', i, id, n, r;
  for (i = 0; i < RECT_IDS.length; i++) {
   id = RECT_IDS[i];
   n = els[id] || {};
   r = isObj(n.rect) ? n.rect : { x: 0, y: 0, w: 0, h: 0 };
   rows += '<tr><td>#' + esc(id) + '</td><td>' + (n.present ? '✓' : '—') + '</td><td>' + (n.visible ? '✓' : (n.hidden ? 'hidden' : '✗')) + '</td><td>' + r.x + '×' + r.y + '</td><td>' + r.w + '×' + r.h + '</td></tr>';
  }
  var ls = isObj(c.localStorage) ? c.localStorage : {};
  var lsKeys = [], lk;
  for (lk in ls) { if (Object.prototype.hasOwnProperty.call(ls, lk)) lsKeys.push(lk); }
  var lsRows = '';
  for (i = 0; i < lsKeys.length && i < 12; i++) lsRows += '<tr><td>' + esc(lsKeys[i]) + '</td><td>' + ls[lsKeys[i]] + ' B</td></tr>';
  return '<div class="rev-snap-grid">' +
   '<div><strong>Viewport &amp; Screen</strong><dl>' +
   '<dt>screen</dt><dd>' + esc(str(u.screen || '—')) + '</dd>' +
   '<dt>viewport</dt><dd>' + (vp.w || 0) + '×' + (vp.h || 0) + ' @' + (vp.dpr || 1) + 'x</dd>' +
   '<dt>overflowX</dt><dd>' + (vp.overflowX ? 'YES ⚠' : 'none') + '</dd>' +
   '<dt>theme / lang / mode</dt><dd>' + esc(str(u.theme || '')) + ' / ' + esc(str(u.lang || '')) + ' / ' + esc(str(u.mode || '')) + '</dd>' +
   '</dl></div>' +
   '<div><strong>Audio Pipeline</strong><dl>' +
   '<dt>lastTierName</dt><dd>' + esc(str(a.lastTierName || '—')) + '</dd>' +
   '<dt>voicesCount</dt><dd>' + (a.voicesCount || 0) + '</dd>' +
   '<dt>micReleased</dt><dd>' + (a.micReleased === false ? 'NO ⚠' : 'yes') + '</dd>' +
   '<dt>recentAudioErrors</dt><dd>' + (Array.isArray(a.recentAudioErrors) ? a.recentAudioErrors.length : 0) + '</dd>' +
   '</dl></div>' +
   '<div><strong>Cache &amp; Storage</strong><dl>' +
   '<dt>swActive</dt><dd>' + (c.swActive ? 'yes' : 'no') + '</dd>' +
   '<dt>voicePackClips</dt><dd>' + (c.voicePackClipsCount || 0) + '</dd>' +
   '<dt>introPresent</dt><dd>' + (c.introPresent ? 'yes' : 'no ⚠') + '</dd>' +
   '<dt>settingsRev / sessionRev</dt><dd>' + (c.settingsRev || 0) + ' / ' + (c.sessionRev || 0) + '</dd>' +
   '</dl></div>' +
   '</div>' +
   '<table class="rev-snap-table"><thead><tr><th>Element</th><th>present</th><th>visible</th><th>x×y</th><th>w×h</th></tr></thead><tbody>' + rows + '</tbody></table>' +
   (lsRows ? '<table class="rev-snap-table"><thead><tr><th>localStorage key</th><th>size</th></tr></thead><tbody>' + lsRows + '</tbody></table>' : '');
 }
 function paintReviewsDrawer() {
  var host = byId('studioReviewsList');
  var sum = byId('reviewsSummary');
  if (!host && !sum) return false;
  var Diag = null;
  try { Diag = global.SDP && SDP.Diagnostics ? SDP.Diagnostics : null; } catch (e) { Diag = null; }
  if (!Diag || !Diag.decryptReviews) {
   if (host) host.innerHTML = '<p class="muted">Diagnostics module unavailable.</p>';
   return false;
  }
  Diag.decryptReviews().then(function (list) {
   list = Array.isArray(list) ? list : [];
   /* Newest first: the creator reads the latest session at the top. */
   var rows = list.slice().reverse(), i, r, tel, chips, k;
   var counts = { genuine: 0, rapid: 0, partial: 0, voice: 0, text: 0 };
   var catCounts = {};
   var html = '';
   for (i = 0; i < rows.length; i++) {
    r = rows[i];
    if (!r || !r.ok || !isObj(r.review)) {
     html += '<div class="rev-session"><div class="rev-session-head"><span class="auth-badge partial">🔒 sealed (key changed)</span></div></div>';
     continue;
    }
    var review = r.review;
    tel = isObj(review.telemetry) ? review.telemetry : null;
    var a = tel ? str(tel.authenticityStatus) : '';
    if (a === 'GENUINE_FULL') counts.genuine += 1;
    else if (a === 'RAPID_SKIP_SUSPECT') counts.rapid += 1;
    else if (a === 'PARTIAL_INCOMPLETE') counts.partial += 1;
    if (review.voiceClip && str(review.voiceClip.b64)) counts.voice += 1;
    if (str(review.text)) counts.text += 1;
    chips = Array.isArray(review.pills) ? review.pills : [];
    for (k = 0; k < chips.length; k++) catCounts[chips[k]] = (catCounts[chips[k]] || 0) + 1;
    html += '<div class="rev-session">' +
     '<div class="rev-session-head">' + authBadgeHtml(tel) +
     '<small>' + esc(str(review.at || '')) + (review.skipped ? ' · skipped review' : ' · review sent') + (tel ? ' · ' + esc(str(tel.mode || '')) + ' mode' : '') + '</small></div>' +
     (chips.length ? '<div class="rev-chips">' + chips.map(function (c) { return '<span class="rev-chip">' + esc(CHIP_LABELS[c] || c) + '</span>'; }).join('') + '</div>' : '') +
     (str(review.text) ? '<p class="rev-note">“' + esc(str(review.text).slice(0, 220)) + '”</p>' : '') +
     (review.voiceClip && str(review.voiceClip.b64)
      ? '<div class="rev-play"><button type="button" class="btn btn-sm" data-play-review-voice="1" data-vmime="' + esc(str(review.voiceClip.mime || 'audio/webm')) + '" data-vb64="' + esc(str(review.voiceClip.b64)) + '">▶ Play Student Voice Recording (' + fmtDuration(review.voiceClip.secs) + ')</button></div>'
      : '') +
     (isObj(review.uiSnapshot)
      ? '<details class="rev-snapshot"><summary>🔍 Inspect UI &amp; Cache Snapshot</summary>' + renderUiSnapshotHtml(review.uiSnapshot) + '</details>'
      : '') +
     '</div>';
   }
   if (!rows.length) html = '<p class="muted">No sessions captured on this device yet — finish a dictation session (or tap Skip on the review card) and it appears here, encrypted.</p>';
   if (host) host.innerHTML = html;
   var topCat = '', topN = 0;
   for (var ck in catCounts) {
    if (Object.prototype.hasOwnProperty.call(catCounts, ck) && catCounts[ck] > topN) { topN = catCounts[ck]; topCat = ck; }
   }
   if (sum) {
    sum.innerHTML =
     '<div class="rev-cell"><strong>' + rows.length + '</strong><span>total sessions analysed</span></div>' +
     '<div class="rev-cell"><strong>' + counts.genuine + ' ✓ / ' + counts.rapid + ' ⚠</strong><span>genuine vs rapid-skip</span></div>' +
     '<div class="rev-cell"><strong>' + counts.voice + ' 🎤 / ' + counts.text + ' ✍️</strong><span>voice / text reviews</span></div>' +
     '<div class="rev-cell"><strong>' + esc(topCat ? (CHIP_LABELS[topCat] || topCat) : '—') + '</strong><span>top reported issue</span></div>';
   }
   return true;
  }, function () {
   if (host) host.innerHTML = '<p class="muted">Reviews could not be decrypted on this device.</p>';
   return false;
  });
 }
 function buildReviewsZip(cb) {
  cb = cb || noop;
  var Diag = null;
  try { Diag = global.SDP && SDP.Diagnostics ? SDP.Diagnostics : null; } catch (e) { Diag = null; }
  if (!Diag || !Diag.buildDiagFiles || !Diag.zipStore) { cb(new Error('no_diagnostics')); return false; }
  Diag.buildDiagFiles().then(function (bundle) {   var bytes = Diag.zipStore(bundle.files);
   try {
    var blob = new global.Blob([bytes], { type: 'application/zip' });
    var url = global.URL && global.URL.createObjectURL ? global.URL.createObjectURL(blob) : '';
    if (!url) { cb(new Error('no_blob_url')); return; }
    var a = doc.createElement('a');
    a.href = url;
    a.download = 'sdp-user-reviews-telemetry-' + str(appVersion()) + '.zip';
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    global.setTimeout(function () { try { global.URL.revokeObjectURL(url); } catch (e) {} }, 4000);
    try { Diag.log('reviews_zip_exported', { files: bundle.files.length, bytes: bytes.length }); } catch (e) {}
    cb(null, { files: bundle.files.length, bytes: bytes.length });
   } catch (e) { cb(e || new Error('zip_failed')); }
  }, function (err) { cb(err || new Error('decrypt_failed')); });
  return true;
 }
 /* Delegated ▶ voice-note playback + live refresh when the drawer opens. */
 function bindReviewsDrawer() {
  var list = byId('studioReviewsList');
  if (list && !list._sdpRevBound) {
   list._sdpRevBound = true;
   list.addEventListener('click', function (ev) {
    var target = ev && ev.target;
    if (!target || !target.getAttribute || target.getAttribute('data-play-review-voice') !== '1') return;
    if (ev && ev.preventDefault) ev.preventDefault();
    playReviewVoice(target.getAttribute('data-vb64'), target.getAttribute('data-vmime'));
   });
  }
  var drawer = byId('studioCardReviews');
  if (drawer && !drawer._sdpRevBound) {
   drawer._sdpRevBound = true;
   drawer.addEventListener('toggle', function () {
    if (drawer.open) paintReviewsDrawer();
   });
  }
  return true;
 }

 /* v0.0.4.b: serialise clips without the duplicate .url data URL on disk. */
 function packClipsForDisk() {
  var src = ST.voicePack.clips || {}, out = {}, k;
  for (k in src) {
   if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
   var c = src[k];
   if (!c || typeof c !== 'object') { out[k] = c; continue; }
   out[k] = {
    b64: str(c.b64), bytes: Number(c.bytes) || 0, at: Number(c.at) || 0,
    text: str(c.text), hashAlgo: str(c.hashAlgo), hash: str(c.hash),
    voiceId: str(c.voiceId), modelId: str(c.modelId)
   };
  }
  return out;
 }
 /* IRON LAW: GET /v1/history only — 0 credits, never POST to the audio API. */
 function recoverFromHistory(cb) {
  cb = cb || noop;
  var key = str(ST.secrets.elevenKey || fieldValue('elKeyInput'));
  if (!looksLikeElevenKey(key)) {
   msg('Paste a valid sk_... ElevenLabs key first to recover clips from history.', 'warn');
   cb(new Error('no_key'));
   return;
  }
  msg('Checking ElevenLabs History (0 credits)...', 'info');
  loadVoicePack(function () {
   global.fetch('https://api.elevenlabs.io/v1/history?page_size=100', {
    method: 'GET', headers: { 'xi-api-key': key }, cache: 'no-store'
   }).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (j) {
    var items = (j && Array.isArray(j.history)) ? j.history : [];
    var byText = {}, i;
    for (i = 0; i < items.length; i++) {
     var it = items[i] || {};
     var t = str(it.text).trim();
     if (t && it.history_item_id && !byText[t]) byText[t] = str(it.history_item_id);
    }
    var q = buildQueue(currentWords()), todo = [], k;
    for (k = 0; k < q.length; k++) {
     if (!clipExists(q[k].key) && byText[str(q[k].text).trim()]) {
      todo.push({ key: q[k].key, text: q[k].text, hid: byText[str(q[k].text).trim()] });
     }
    }
    function repaint() {
     try {
      if (global.SDP && global.SDP.Speech) {
       if (global.SDP.Speech.injectClips) global.SDP.Speech.injectClips(ST.voicePack.clips);
       if (global.SDP.Speech.reloadManifest) global.SDP.Speech.reloadManifest(true);
      }
     } catch (e) {}
     paintPackDashboard();
     paintClipTable();
    }
    if (!todo.length) {
     repaint();
     msg('All 74 voice pack clips are already loaded and verified (0 credits spent).', 'ok');
     cb(null, { recovered: 0 });
     return;
    }
    var idx = 0, rec = 0;
    function pullNext() {
     if (idx >= todo.length) {
      repaint();
      commitVoicePack(function () {
       msg('Recovered ' + rec + ' clips from ElevenLabs History (0 credits spent)!', 'ok');
       cb(null, { recovered: rec });
      });
      return;
     }
     var cur = todo[idx++];
     global.fetch('https://api.elevenlabs.io/v1/history/' + encodeURIComponent(cur.hid) + '/audio', {
      method: 'GET', headers: { 'xi-api-key': key }
     }).then(function (ar) { return ar && ar.ok ? ar.arrayBuffer() : null; }).then(function (buf) {
      if (buf && buf.byteLength > 100) {
       var b64 = arrayBufferToBase64(buf);
       ST.voicePack.clips[cur.key] = {
        b64: b64, bytes: buf.byteLength, at: Date.now(), text: cur.text,
        voiceId: activeVoiceId, modelId: VOICE_MODEL, hashAlgo: HASH_ALGO,
        hash: clipContentHash(cur.text, activeVoiceId, VOICE_MODEL)
       };
       rec++;
      }
      pullNext();
     }, function () { pullNext(); });
    }
    pullNext();
   }, function (err) {
    msg('Could not reach ElevenLabs History.', 'warn');
    cb(err);
   });
  });
 }

 /* Commit the freshly paid-for clips so */
 /* v0.0.4.b: sequential publish mutex — concurrent calls queue, never race */
 var packPublishQueue = [], packPublishBusy = false;
 function commitVoicePack(cb) {
  cb = cb || noop;
  packPublishQueue.push(cb);
  if (packPublishBusy) return true;
  packPublishBusy = true;
  function done(err, info) {
   var list = packPublishQueue.slice();
   packPublishQueue = [];
   packPublishBusy = false;
   if (!err) {
    try {
     if (global.SDP && global.SDP.Speech) {
      if (global.SDP.Speech.injectClips) global.SDP.Speech.injectClips(ST.voicePack.clips);
      if (global.SDP.Speech.reloadManifest) global.SDP.Speech.reloadManifest(true);
     }
    } catch (e) {}
   }
   for (var i = 0; i < list.length; i++) { try { list[i](err, info); } catch (e2) {} }
  }
  var token = str(ST.secrets.ghToken);
  if (!token || !sync() || !sync().publishFilesSequential) {
   packPublishBusy = false;
   var waiting = packPublishQueue.slice();
   packPublishQueue = [];
   for (var j = 0; j < waiting.length; j++) { try { waiting[j](new Error('no_token')); } catch (e3) {} }
   return false;
  }
  var files = [{
   path: 'data/elevenlabs-audio.json',
   content: JSON.stringify(voicePackPayload(), null, 2),
   message: 'Alice voice pack ' + appVersion()
  }];
  sync().publishFilesSequential(files, token, noop, done);
  return true;
 }

 /* D12: an interactive 30-row */
 function wordManagerWords() {
  var list = ST.words.length ? ST.words : (sync() && sync().words ? sync().words() : []);
  return Array.isArray(list) ? list.slice(0, WORD_CAP) : [];
 }
 /* v0.0.4.a W2: read-only auto-enriched preview badge per row; the six edit */
 /* v0.0.5.c: the per-row SVG preview button plays the committed Alice clip */
 function previewWmRow(row) {
  var list = wordManagerWords(), idx = Number(row);
  if (!list.length || isNaN(idx) || !list[idx]) return false;
  return playVaultClip('words.' + str(list[idx].w).toLowerCase());
 }
 function toggleWmRow(row) {
  var host = byId('studioWordManager');
  if (!host || !host.querySelectorAll) return false;
  var trs = host.querySelectorAll('tr.wm-row');
  for (var i = 0; i < trs.length; i++) {
   if (String(trs[i].getAttribute('data-word-row')) === String(row)) {
    var cells = trs[i].querySelector('.wm-edit-cells');
    if (cells) cells.hidden = !cells.hidden;
    return true;
   }
  }
  return false;
 }

 /* ══ v0.0.6.m Pillar 2 — AI British Pronunciation Pre-Verifier ══════════ */
 function britishizeIpa(raw) {
  var ipa = str(raw).replace(/^\s+|\s+$/g, '').replace(/^\/+|\/+$/g, '');
  if (!ipa) return '';
  ipa = ipa
   .replace(/\u025d/g, '\u025c\u02d0r')  /* ɝ → ɜːr */
   .replace(/\u025a/g, '\u0259')          /* ɚ → ə (non-rhotic) */
   .replace(/\u0254r/g, '\u0254\u02d0r')  /* ɔr → ɔːr */
   .replace(/\u0251r/g, '\u0251\u02d0r'); /* ɑr → ɑːr */
  return '/' + ipa + '/';
 }
 function verifyPrompt(word) {
  return 'You are a Cambridge English B1 (CCBE, Sri Lanka) British English pronunciation editor. ' +
   'For the word "' + str(word) + '" return STRICT JSON only, exactly: ' +
   '{"words":[{"w":"' + str(word) + '","p":"UK IPA in slashes, Cambridge B1 British, non-rhotic","pos":"grammar abbreviation with a dot, e.g. adj.",' +
   '"m":"one simple B1 English meaning, max 12 words","si":"accurate Sinhala meaning","s":"one simple B1 example sentence using the word",' +
   '"ttsHint":"phoneme-guided respelling of the word that forces Received Pronunciation from a TTS engine"}]}. ' +
   'The IPA must be British (e.g. /ɪmˈpɔːtənt/), never US /ɝ/ or /ɚ/. No extra fields, no commentary.';
 }
 function verifyPronunciationWord(word, cb) {
  cb = cb || noop;
  var w = str(word && word.w ? word.w : word);
  if (!w) { cb(new Error('no_word')); return false; }
  /* v0.0.6.m provider cascade: the chosen provider + key first, then the
     four Groq slots in order (free tier leads), then every other LLM slot.
     A 429 / quota-exhausted key rotates to the NEXT Groq slot instantly. */
  var candidates = llmCandidates({ p: aiProviderName(), k: str(ST.secrets.aiKey) || fieldValue('studioAiKey') });
  var at = 0;
  function attemptOne() {
   if (at >= candidates.length) { cb(new Error('llm_failed')); return; }
   var c = candidates[at];
   at += 1;
   llmRequest(c.p, c.k, [w], function (err, rows) {
    var rec = (!err && rows) ? rows[w.toLowerCase()] : null;
    if (isObj(rec) && str(rec.p)) {
     rec.p = britishizeIpa(rec.p);
     cb(null, rec);
     return;
    }
    /* v0.0.6.m: HTTP 429 / 401 / 429-style failures rotate the Groq pool */
    var st = Number((err && err.status) || 0);
    if (st === 429 && c.p === 'groq') logGroqRotation('http_429', at);
    attemptOne();
   }, verifyPrompt(w));
  }
  attemptOne();
  return true;
 }
 function verifyWmRow(row) {
  var list = wordManagerWords(), idx = Number(row);
  if (!list.length || isNaN(idx) || !list[idx]) return false;
  var word = list[idx];
  if (!isObj(ST.verifyBadges)) ST.verifyBadges = {};
  msg(' Verifying "' + esc(str(word.w)) + '" · Cambridge B1 British English…', '');
  verifyPronunciationWord(word, function (err, rec) {
   if (err) {
    ST.verifyBadges[idx] = '⚠';
    paintWordManager();
    try { if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('pronunciation_flag', { word: str(word.w), reason: 'llm_failed' }); } catch (e) {}
    msg(' Could not verify "' + esc(str(word.w)) + '" — check the AI key or pool slots', 'bad');
    return;
   }
   list[idx].p = str(rec.p) || list[idx].p;
   if (str(rec.pos)) list[idx].pos = str(rec.pos);
   if (str(rec.m)) list[idx].m = str(rec.m);
   if (str(rec.si)) list[idx].si = str(rec.si);
   if (str(rec.s)) list[idx].s = str(rec.s);
   if (str(rec.ttsHint)) list[idx].ttsHint = str(rec.ttsHint);
   ST.words = list;
   ST.verifyBadges[idx] = '✓';
   ST.dirty = true;
   paintDirtyState();
   paintWordManager();
   var editor = byId('studioWords');
   if (editor) editor.value = wordsToText(list);
   try {
    if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('pronunciation_verified', { word: str(word.w) });
   } catch (e) {}
   msg(' ' + esc(str(word.w)) + ' verified · ' + esc(str(list[idx].p)) + ' — listening preview…', 'ok');
   /* Preview: the phoneme-guided hint, so the lecturer hears the exact RP */
   try {
    if (global.SDP && SDP.Speech && SDP.Speech.say) {
     SDP.Speech.say([str(list[idx].ttsHint) || str(word.w)], { lang: 'en-GB', rate: 0.9 }, noop);
    }
   } catch (e) {}
  });
  return true;
 }
 function resynthWmRow(row) {
  var list = wordManagerWords(), idx = Number(row);
  if (!list.length || isNaN(idx) || !list[idx]) return false;
  var w = list[idx];
  var key = 'words.' + str(w.w).toLowerCase();
  /* Drop just this one stale clip so the delta queue rebuilds exactly it; */
  if (isObj(ST.voicePack.clips)) delete ST.voicePack.clips[key];
  msg(' Re-synthesizing 1 word: ' + esc(str(w.w)) + '…', '');
  generateClips({ words: [w], keys: [key], force: true }, function (err) {
   if (err) { msg(' Re-synthesis failed · ' + quotaError(err), 'bad'); return; }
   try { if (global.SDP && SDP.Diagnostics) SDP.Diagnostics.log('word_resynthesized', { word: str(w.w) }); } catch (e) {}
   msg(' ' + esc(str(w.w)) + ' re-synthesized · 1 word · the other 29 clips untouched', 'ok');
  });
  return true;
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
   var ipa = str(w.p) ? '/' + str(w.p).replace(/^\/+|\/+$/g, '') + '/' : '/—/';
   rows += '<tr class="wm-row" data-word-row="' + i + '"><td class="wm-idx">' + (i + 1) + '</td>' +
    '<td colspan="6"><div class="wm-preview">#' + (i + 1) + ' <b>' + esc(str(w.w)) + '</b> · ' + esc(ipa) +
    ' · ' + esc(str(w.pos) || '—') + ' · <span lang="si">' + esc(str(w.si) || '—') + '</span> · ' +
    esc(str(w.m)) + ' · <i>' + esc(str(w.s)) + '</i>' +
    ' <button type="button" class="btn btn-sm wm-preview" data-action="previewWmRow" data-row="' + i +
    '" aria-label="Play the Alice clip for row ' + (i + 1) + '">' + ico('volume', 15) + '</button>' +
    ' <button type="button" class="btn btn-sm wm-toggle" data-action="toggleWmRow" data-row="' + i +
    '" aria-label="Edit row ' + (i + 1) + '">' + ico('edit', 15) + '</button>' +
    /* v0.0.6.m Pillar 2: per-word Verify & Preview Pronunciation (♪) and */
    ' <button type="button" class="btn btn-sm wm-verify" data-action="verifyWmRow" data-row="' + i +
    '" title="Verify &amp; preview pronunciation (Cambridge B1 British)" aria-label="Verify and preview pronunciation for row ' + (i + 1) + '">\u266a</button>' +
    ' <button type="button" class="btn btn-sm wm-resynth" data-action="resynthWmRow" data-row="' + i +
    '" title="Re-synthesize this single word" aria-label="Re-synthesize single word for row ' + (i + 1) + '">\u21bb</button>' +
    ' <span class="wm-vbadge" data-vbadge="' + i + '">' + esc(str((ST.verifyBadges || {})[i])) + '</span></div><div class="wm-edit-cells" hidden>';
   for (c = 0; c < cols.length; c++) {
    rows += '<input class="input wm-input" data-wm="' + cols[c] + '" data-wm-field="' + cols[c] + '" data-row="' + i +
     '" value="' + esc(str(w[cols[c]])) + '">';
   }
   rows += '</div></td></tr>';
  }
  host.innerHTML = '<div class="table-wrap"><table class="studio-preview-table studio-word-table"><thead><tr>' + '<th>#</th><th>w · p · pos · si · m · s</th></tr></thead><tbody>' +
   rows + '</tbody></table></div><p class="muted">' + T('studioWordManager') + ' · ' +
   list.length + ' ' + T('studioWordsCount') + '</p>';
  return true;
 }
 
 function parseBulkWords(text) {
  var parts = str(text).split(/[\n,;]+/);
  var out = [], seen = {}, i;
  var committed = committedWords();
  for (i = 0; i < parts.length; i++) {
   var line = str(parts[i]).replace(/^\s+|\s+$/g, '');
   if (!line) continue;
   /* v0.0.6.e (A): strip pasted list numbering (1. / 2) / #03 / 4:) and */
   line = line.replace(/^#\d+[.)]?\s*/, '').replace(/^\d+[.)\]:-]\s*/, '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
   if (!line) continue;
   var cols = line.indexOf('|') >= 0 ? line.split('|') : [line];
   var word = str(cols[0]).replace(/^\s+|\s+$/g, '');
   if (!word) continue;
   var key = word.toLowerCase();
   if (seen[key]) continue;
   seen[key] = true;
   var rec = {
    w: word, p: str(cols[1] || '').replace(/^\s+|\s+$/g, ''),
    pos: str(cols[2] || '').replace(/^\s+|\s+$/g, ''),
    m: str(cols[3] || '').replace(/^\s+|\s+$/g, ''),
    si: str(cols[4] || '').replace(/^\s+|\s+$/g, ''),
    s: str(cols[5] || '').replace(/^\s+|\s+$/g, '')
   };
   /* v0.0.6.d (D2): when the spelling at this slot differs from the committed */
   if (committed.length && i < committed.length &&
     str(committed[i] && committed[i].w).toLowerCase() !== key) {
    rec.p = ''; rec.pos = ''; rec.m = ''; rec.si = ''; rec.s = '';
   }
   out.push(rec);
   /* v0.0.6.e (A): never truncate at 30 — the lecturer sees every extra word */
  }
  return out;
 }
 
function liveSessionNo() { try { return str(SDP.Sync && SDP.Sync.sessionNo ? SDP.Sync.sessionNo() : '8') || '8'; } catch (e) { return '8'; } }
function liveSessionTitle() { try { return str(SDP.Sync && SDP.Sync.sessionTitle ? SDP.Sync.sessionTitle() : ''); } catch (e) { return ''; } }
function rawParsedFromField() { return parseBulkWords(fieldValue('studioBulkWords') || wordsToText(ST.words)); }
function currentParsed() { return (ST.rawParsedWords && ST.rawParsedWords.length ? ST.rawParsedWords : rawParsedFromField()).slice(); }
function wordsHelperState(n) { if (n === 30) return 'ready'; if (n > 30) return 'over'; return 'under'; }
function paintWordsHelper() {
  var host = byId('studioWordsCountHelper'); if (!host) return false;
  var parsed = currentParsed(); var n = parsed.length; var st = wordsHelperState(n); var text = '';
  if (st === 'ready') text = t('helperReady', '\u2713 30 / 30 words ready');
  else if (st === 'over') text = t('helperOver', '{n} words detected (need 30) \u2014 tap \u21c4 on a split word to merge it, or tap \u2715 to remove an extra word').replace('{n}', String(n));
  else text = t('helperUnder', '{n} / 30 words \u2014 add {need} more').replace('{n}', String(n)).replace('{need}', String(30 - n));
  setText(host, text);
  host.setAttribute('data-state', st);
  host.className = 'studio-count-helper is-' + st;
  return true;
}
function paintLiveChips() {
  var host = byId('studioLiveChips'); if (!host) return false;
  var parsed = currentParsed(); var html = ''; var i;
  for (i = 0; i < parsed.length; i++) {
    var w = str(parsed[i] && parsed[i].w ? parsed[i].w : parsed[i]);
    var extra = i >= 30 ? ' chip-extra' : '';
    html += '<span class="chip-word' + extra + '" role="listitem"><b>#' + (i + 1) + '</b> <i class="chip-w">' + esc(w) + '</i>' +
     (i < parsed.length - 1 ? ' <button type="button" class="chip-merge" data-action="chip-merge" data-idx="' + i + '" aria-label="' + esc(t('chipMergeLabel', 'Merge with next word')) + '">\u21c4</button>' : '') +
     ' <button type="button" class="chip-x" data-action="chip-remove" data-idx="' + i + '" aria-label="' + esc(t('chipRemoveLabel', 'Remove word')) + '">\u2715</button></span>';
  }
  host.innerHTML = html;
  var pill = byId('studioWordCountPill');
  if (pill) {
    setText(pill, wordCountPillText(Math.min(parsed.length, 30)));
    pill.setAttribute('data-full', parsed.length >= 30 ? 'true' : 'false');
    pill.setAttribute('data-state', wordsHelperState(parsed.length));
  }
  return true;
}
function writeBulkFromParsed(parsed) {
  var bulk = byId('studioBulkWords'); var arr = []; var i;
  for (i = 0; i < (parsed || []).length; i++) arr.push(str(parsed[i] && parsed[i].w ? parsed[i].w : parsed[i]));
  if (bulk) bulk.value = arr.join(', ');
  setStudioWords(parseBulkWords(fieldValue('studioBulkWords')), 'bulk');
  try { detectWordDeltas(); } catch (e) {}
  try { paintDirtyState(); } catch (e) {}
  try { scheduleAutoEnrich(); } catch (e) {}
  return true;
}
function chipRemove(idx) { var l = currentParsed(); if (!(idx >= 0) || idx >= l.length) return false; l.splice(idx, 1); return writeBulkFromParsed(l); }
function chipMerge(idx) {
  var l = currentParsed(); if (!(idx >= 0) || idx + 1 >= l.length) return false;
  var a = str(l[idx] && l[idx].w ? l[idx].w : l[idx]), b = str(l[idx + 1] && l[idx + 1].w ? l[idx + 1].w : l[idx + 1]);
  l[idx] = isObj(l[idx]) ? copyParsed(l[idx], a + '-' + b) : { w: a + '-' + b };
  l.splice(idx + 1, 1);
  return writeBulkFromParsed(l);
}
function copyParsed(src, w) { var o = {}; o.w = w; o.p = str(src.p); o.pos = str(src.pos); o.m = str(src.m); o.si = str(src.si); o.s = str(src.s); return o; }
function setStudioWords(list, source) {
  ST.words = (Array.isArray(list) ? list : []).slice(0, WORD_CAP);
  ST.rawParsedWords = Array.isArray(list) ? list.slice() : [];
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
  paintLiveChips();
  paintWordsHelper();
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

 /* ══ lecturer clip recorder (D-L5 */
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
     msg(t('studioRecord') + ' ' + path, 'ok');
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

 /* ══ D-L6: the studio must catch up */
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
 /* D11: stash/restore input values */
 function onLangChange() {
  if (!ST.unlocked) return false;
  var ids = ['elKeyInput','ghTokenInput','studioGasUrl','studioAiKey','studioAiProvider','studioBulkWords','studioWords'];
  var s = {}, i, n;
  for (i = 0; i < ids.length; i++) { n = byId(ids[i]); if (n) s[ids[i]] = n.value; }
  var wm = [];
  try {
   var rows = doc.querySelectorAll ? doc.querySelectorAll('[data-wm]') : [];
   for (i = 0; i < rows.length; i++) wm.push({ w: rows[i].getAttribute('data-wm'), r: rows[i].getAttribute('data-row'), v: rows[i].value || '' });
  } catch (e) {}
  mount();
  try {
   for (i = 0; i < ids.length; i++) { n = byId(ids[i]); if (n && s[ids[i]] !== undefined) n.value = s[ids[i]]; }
   for (i = 0; i < wm.length; i++) {
    n = doc.querySelector ? doc.querySelector('[data-wm="' + wm[i].w + '"][data-row="' + wm[i].r + '"]') : null;
    if (n) n.value = wm[i].v;
   }
  } catch (e) {}
  return true;
 }
 function refreshEditor() { return onDataReady(); }

 var Studio = {
  state: ST,
  mount: mount,
  init: mount,
  unlock: unlock,
  setup: setup,
  lock: lock,
  isUnlocked: isUnlocked,
  allowAutoGen: allowAutoGen,
  /* v0.0.6.d (D2): the five-field re-enrichment rule, exposed for the */
  __mergeEnrichRecordForGate: mergeEnrichRecord,
  guessPartOfSpeech: guessPartOfSpeech,
  hasUnpublishedEdits: function () { return !!(ST.unlocked && ST.dirty); },
  /* v0.0.6.c (F1): the delta surface the views and gates read. */
  wordsDirty: function () { return !!(ST.unlocked && ST.wordsDirty); },
  wordDeltas: function () { return (ST.wordDeltas || []).slice(); },
  detectWordDeltas: function () { return detectWordDeltas(); },
  paintDirtyState: function () { return paintDirtyState(); },
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
  classSettingsPayload: classSettingsPayload,
  classSettingKeys: CLASS_SETTING_KEYS,
  voicePackPayload: voicePackPayload,
  publishChecklist: publishChecklist,
  nextSyncRev: nextSyncRev,
  openPublishPreview: openPublishPreview,
  publishPreviewWords: publishPreviewWords,
  publish: publish,
  generateClips: generateClips,
  commitVoicePack: commitVoicePack,
  queueFor: queueFor,
  costPreview: costPreview,
  enrichWords: enrichWords,
  testAiEngine: testAiEngine,
  oneClickMasterSetup: oneClickMasterSetup,
  publishWordsAndVoice: publishWordsAndVoice,
  publishBundle: publishBundle,
  sealVaultNow: sealVaultNow,
  parseBulkWords: parseBulkWords,
  /* ══ v0.0.6.m Pillar 2/4: automatic system audio + reviews vault ══ */
  autoEnsureSystemClips: autoEnsureSystemClips,
  /* v0.0.6.m FIX 1: the real-API briefing/guide orchestrator. */
  autoSynthesizeBriefingAndGuide: autoSynthesizeBriefingAndGuide,
  briefingScriptWeights: briefingScriptWeights,
  /* v0.0.6.n FIX 2: the direct Studio ↔ Briefing bridge surface. */
  ensureBriefingAndGuideVoices: ensureBriefingAndGuideVoices,
  parseAlignmentToWordTimings: parseAlignmentToWordTimings,
  briefingVoiceDelta: briefingVoiceDelta,
  vaultSessionActive: vaultSessionActive,
  paintBriefingVoiceBar: paintBriefingVoiceBar,
  missingSystemClips: missingSystemClips,
  essentialSystemClipKeys: function () { return ESSENTIAL_SYSTEM_CLIPS.slice(); },
  paintReviewsDrawer: paintReviewsDrawer,
  buildReviewsZip: buildReviewsZip,
  paintLiveChips: paintLiveChips,
  paintWordsHelper: paintWordsHelper,
  chipRemove: chipRemove,
  chipMerge: chipMerge,
  currentParsed: currentParsed,
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
  /* D1: the explicit Clear buttons + the */
  clearSecretField: clearSecretField,
  mergeSecretInputs: mergeSecretInputs,
  secretSnapshot: secretSnapshot,
  guardSecretMerge: guardSecretMerge,
  /* D2: one busy-button helper for */
  withBusy: withBusy,
  /* D6/D7: the human GitHub sentence used */
  publishErrorText: publishErrorText,
  publishReason: publishReason,
  bumpMeterCache: bumpMeterCache,
  /* D13: same-tab stash restore */
  restoreSessionStash: restoreSessionStash,
  /* D18: failure exits clear every */
  clearBusy: clearBusy,
  paintLecturerBar: paintLecturerBar,
  writeLayerOne: writeLayerOne,
  layerOneVault: layerOneVault,
  layerOneEnvelope: layerOneEnvelope,
  healFromLayerOne: healFromLayerOne,
  paintVaultBadge: paintVaultBadge,
  paintPackDashboard: paintPackDashboard,
  paintGenProgress: paintGenProgress,
  clipCount: clipCount,
  packDashboardText: packDashboardText,
  placeLecturerBar: placeLecturerBar,
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
  voiceName: VOICE_NAME,
  voiceModel: VOICE_MODEL,
  persona: VOICE_PERSONA,
  sha1Hex: sha1Hex,
  clipContentHash: clipContentHash,
  buildQueue: buildQueue,
  commandClips: commandClips,
  numberClips: numberClips,
  guideClips: guideSteps,
  verifyElevenKey: verifyElevenKey,
  changePin: changePin,
  recoveryOpen: recoveryOpen,
  recoveryMode: function () { return !!ST.recoveryMode; },
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
  /* D12/D18: busy state guard for view */
  isBusy: function () { return !!(ST.generating || ST.publishing || ST.enriching); },
  message: function () { return ST.message; },
  testStatusText: function () { return ST.testStatus; }
 };

 Studio.recoverFromHistory = recoverFromHistory;

 SDP.Studio = Studio;

 if (doc) {
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { mount(); });
  else mount();
  /* D-L6: sync boot can finish after the */
  doc.addEventListener('sdp:ready', function () { try { onDataReady(); } catch (e) {} }, false);
 }
})(typeof window !== 'undefined' ? window : this);
