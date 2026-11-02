# SDP v0.0.1.g → v0.0.1.h — Forensic Audit & Upgrade Blueprint

**Subject:** `https://github.com/dictationb1/dictationb1.github.io` @ `main` = `acff6c5` — `v0.0.1.g`, `ver: 7`, `schema: 7`
**Live:** `https://dictationb1.github.io/` · **Transparency:** `/data`
**Classroom:** CCBE Galle Branch — B1 English (Sri Lanka) · students on `360×640` / `390×844` Android, lecturer on `1366×768` / `1440×900` / `1920×1080`
**Audit date:** 2026-11-02 · **Method:** every claim below is traced to shipped lines **and** executed (jsdom harness, real payloads, stubbed only at the network boundary). Nothing in this document is inferred from a screenshot alone.

**Credits preserved:** Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu) — *CREDITS GOES TO Hansana*
නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini

---

## 0. Executive summary (read this first)

### 0.1 The screenshot is reproducible — and it is not an ElevenLabs outage

The `Publish failed` + `❌ tts_failed` pair in `image_8e5239.png` is produced by **one** code path, and it was reproduced byte-for-byte in a jsdom session running the *shipped* `data/studio.js` against a 422 response:

```
EL 422 => cb: master_setup_failed {"ok":false,"step":3,"detail":"tts_failed"}
   studioMsg:     Publish failed · tts_failed
   publishing flag after: false   masterStep: 3 bad
   github PUTs:  []                       ← Step 4 never ran, nothing was published
EL 400 => cb: master_setup_failed {"ok":false,"step":3,"detail":"tts_failed"}
   github PUTs:  []
EL 403 => cb: master_setup_failed {"ok":false,"step":4,"detail":"publish_partial"}
   github PUTs:  ["data/session.json","data/config.json","data/elevenlabs-audio.json","data/version.json"]
```

**Verified cause:** the TTS failure whitelist in `data/studio.js:2008-2013` covers only HTTP `401/402/403/429`. Any other upstream status — `400`, `404`, `422`, `500`, or `0` (network/CORS/offline, where `res.status` is unreadable) — falls through to `finish(err)` (`1986-1990`), which prints the **raw** internal code because `quotaError()` has no mapping for it (`1770-1782`), and `oneClickMasterSetup()` then calls `fail(3, …)` (`1657-1659`) → `msg('Publish failed' + ' · ' + detail)` (`1622`). Step 4 (`publishBundle`, `1626-1644`) is **never reached**, so `session.json`, `config.json`, `elevenlabs-audio.json` and `version.json` are never written to GitHub.

ElevenLabs Free Tier returns `422 unprocessable_entity` / `401 invalid_api_key` for library-voice + free-tier combinations, and returns an unreadable status (`0`) behind CORS/VPN/ISP blocks. Both classes are fatal here. **The fix is not a bigger whitelist — it is making TTS non-fatal by construction** (P1 below).

### 0.2 "Any buttons on lecturer studio doesn't work" — three separate, verified causes (no guessing)

The three "dead-click" hypotheses in the brief were tested one by one in a live DOM:

| Hypothesis | Verdict | Evidence |
|---|---|---|
| **A** `ST.busy` lock stuck forever | **CONFIRMED (real)** | `requestClip()` has **no timeout/`AbortController`** (`studio.js:2026-2052`). A hanging ElevenLabs request leaves `ST.publishing = true` forever; `oneClickMasterSetup()` then returns `{ok:false,reason:'busy'}` with `cb = noop` (`1614`, `1050`) → **zero pixels change**. Executed: 2nd click left `studioMsg` at `Unlock studio ✓`, `publishing = true`. |
| **B** `renderAll()` / `sdp:update` re-render wipes `#studioBody` mid-click | **DISPROVED as written** — but a *different* wipe is real | `renderAll()` (`sdp-ui-views.js:1358-1364`) repaints home/words/practice/settings/guide/board bar only; `Studio.mount()` is called from exactly one place in the app shell (`openStudio()`, `views:2034`) plus `studio.js:2217` (`onDataReady`, locked only) and `onLangChange` (locked only). No 25 s poll ever touches `#studioBody`, and there is **no `blur`→re-render→lost-`click`** path: the click handler is delegated once on `#studioAccordion` (`studio.js:923-932`) and survives every `innerHTML` swap. **The real wipe:** `openStudio()` calls `mount()` unconditionally, and `paintSecretFields()` (`821-826`) overwrites every non-empty input from stale in-memory secrets → a lecturer who types a new key and then taps the header 🔒 loses it. |
| **C** Missing/mismatched IDs in `CLICK_ACTIONS` | **DISPROVED** | All 24 rendered studio button ids resolve to a `CLICK_ACTIONS` entry (`studio.js:1031-1066`). Reverse-gap only: `btnStudioUnlock` is registered (`1032`) but never rendered, and `btnCheckQuota`/`btnRefreshQuota` are rendered with `style="display:none"` (`731-732`). |
| **D** `[Paste]` / `[Show]` / `[Test]` rows | **WORK, with poor feedback** | Executed: `btnPasteElKey` → "Clipboard unavailable — paste manually"; `btnTestElKey` → "✅ Key accepted (scoped/free-tier key…"; `btnTestGhToken` → "✅ GitHub Connected (dictationb1/…)"; `btnTestAi` → "✅ Free Dictionary ready · zero API key · EN→SI OK". `btnToggle*` change the field type but print nothing anywhere (silent by design). |
| **E** Cards 2 & 3 buttons | **HALF-DEAD** | `#btnEnrichWords` works (30 words, 60 network calls). `#btnPublishWords`/`#btnPublishWordsAndVoice` reach GitHub. `#btnSaveKeys` and `#btnOneClickMasterSetup` give **no feedback for seconds** (PBKDF2 250 000 iterations + WebCrypto + sequential PUTs, no spinner, no `disabled`). |

**Outside the studio there is a genuinely dead button:** the primary **`#btnResumeDraft`** ("Resume Paused Dictation (Word #X/30)") on Home has **no click listener at all** (`index.html:67` is only referenced at `views:652` to toggle `.hidden`; the only bound resume control is `on('btnResume', 'click', resumeDictation)` at `views:1936`). Executed: tapping it leaves `Engine.state() === 'paused'`; tapping `#btnResume` resumes instantly.

### 0.3 The release itself is red on `main`

Executed with `npm ci --prefix tests` on `acff6c5`:

| Gate | Result on `v0.0.1.g` | First failing assertion |
|---|---|---|
| G1 `check.cjs` | **81 PASS / 7 FAIL** | `data/session.json` 57 380 B > 46 403 B budget; SHA-256 lock; `version.json` schema/syncRev pins; `config.json` version fields; **`classSettings.lang` missing** |
| G2 `upgrade.test.cjs` | PASS | — |
| G3 `phase1.cjs` | **CRASH** | `TypeError … reading 'click'` at `phase1.cjs:168` — the paper run never renders a results table inside the test's 300-tick budget |
| G4 `server.cjs` | **FAIL** | `AssertionError: 9 == 7` — published `settingsRev` is 9, code pins 7 |
| G11 `vault-sync.cjs` | **72 PASS / 2 FAIL** | `G11.13c writeSecs 9/repeats 3 never landed` → `[5,2]`; `G11.14b` same adoption rejection |
| G12 `studio-safety.cjs` | 78 PASS / 0 FAIL | — |

Root of the G1/G4/G11 cluster: **a studio publish bumped `settingsRev` to 9 (`data/version.json`, `data/config.json`) while `data/sdp-data-sync.js:17` still declares `SETTINGS_REV = 7`**, and `adoptRemoteSettings()` refuses any revision `<= appliedSettingsRev` (`sdp-data-sync.js:931`). A teacher publish numbered *below* a device's already-applied revision is therefore silently swallowed forever. That is also the mechanical reason "settings changed on one device don't arrive on the others" — see D5.

### 0.4 One security finding that must be handled before anything else ships

`BOOTSTRAP_PIN = '78987898'` is hardcoded (`studio.js:17`), **and** the published `data/config.json` carries a *real* `SDP_ENC_V2` envelope (467 chars) plus a PBKDF2 verifier. Executed in a clean boot: `Studio.unlock('78987898')` decrypted that envelope and returned the lecturer's live secrets (a `github_pat_…` PAT, a 64-hex ElevenLabs key, a `AQ.…` Google key). **Anyone who reads `data/config.json` and this repository can recover write access to the repository.**

Required actions in `v0.0.1.h` (D19): rotate all three credentials in the GitHub/ElevenLabs/Google consoles today; stop publishing a decryptable vault from a public repo (ship a **verifier only**, seal per-device); keep the classroom PIN `78987898` as the UX gate but never as the only secret protecting a PAT.

---

## 1. Verified root-cause trace — `Publish failed` / `❌ tts_failed` (Priority 1.1)

### 1.1 Every occurrence of the strings on `main`

| Where | Line | Role |
|---|---|---|
| `data/studio.js` | **2042** | `throw withStatus(new Error('tts_failed'), status \|\| 0)` — the only *creation* site |
| `data/studio.js` | **2051** | `done(err \|\| new Error('tts_failed'))` — network/CORS rejection |
| `data/studio.js` | **2052** | `catch (e) { done(e \|\| new Error('tts_failed')); }` — synchronous throw |
| `data/studio.js` | **1987-1988** | `msg('❌ ' + quotaError(err))` + `testStatus('❌ ' + quotaError(err))` — paints the screenshot text |
| `data/studio.js` | **1770-1782** | `quotaError()` — maps only `invalid_api_key`, `missing_permissions`, `quota_exceeded`/402, 401, 403, 429, `subscription_failed`, `key_rejected`; **anything else returns `err.message` verbatim** → `"tts_failed"` |
| `data/studio.js` | **1657-1659** | `if (genErr && !(genInfo && genInfo.tierLimited)) { fail(3, quotaError(genErr)); return; }` — the abort |
| `data/studio.js` | **1611-1625** | `oneClickMasterSetup` → `fail()` sets `ST.publishing = false`, `setMasterStep(step,'bad')`, `msg('Publish failed' + ' · ' + detail)` |
| `data/studio.js` | **1626-1644** | `step4()` → `publishBundle(...)` — **skipped whenever `fail(3, …)` fires** |
| `data/sdp-ui-views.js` | **143** | `studioPublishFail: 'Publish failed'` (EN) / **329** (SI) |

### 1.2 The exact call chain

```
CLICK #btnOneClickMasterSetup
  studio.js:1050  → oneClickMasterSetup(noop)
  :1611-1620      → guard, ST.publishing = true, mergeSecretInputs()
  :1670-1678      → step 1: sealVaultNow() + testGitHubToken()
  :1660-1666      → step 2: checkQuota()               (advisory, non-fatal)
  :1646-1660      → step 3: generateClips({force, noCommit:true})
      :1962-2000  → buildQueue() → 30 words + 4 guide steps = 34 requests
      :2025-2052  → requestClip() → POST https://api.elevenlabs.io/v1/text-to-speech/Xb7hH8MSUJpSbSDYk0k2
                    body { text, model_id: 'eleven_flash_v2_5', voice_settings:{stability:0.65,…} }
                    ← 422 (or 400/404/500) or CORS/network failure ⇒ status ∈ {422,400,404,500,0}
      :2042       → throw withStatus(new Error('tts_failed'), 422)
      :2005-2013  → st = 422 ∉ {401,402,403,429} ⇒ finish(err)   [tierLimited stays FALSE]
      :1986-1990  → msg('❌ tts_failed'); testStatus('❌ tts_failed'); cb(err,{made:[],…,tierLimited:false})
      :1657-1659  → genErr && !tierLimited ⇒ fail(3, 'tts_failed')
      :1621-1625  → msg('Publish failed · tts_failed'), step 3 marked bad, ST.publishing = false
  ⇒ step4() is never invoked ⇒ 0 GitHub PUTs
```

### 1.3 What the request actually is (Priority 2.1)

`data/studio.js:1747` → `https://api.elevenlabs.io/v1/text-to-speech/Xb7hH8MSUJpSbSDYk0k2` (`VOICE_ID`, `:9`)
Payload (`:2027-2034`): `{ text, model_id: 'eleven_flash_v2_5' (`VOICE_MODEL`, `:10`), voice_settings: { stability: 0.65, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true } }`, headers `xi-api-key`, `Accept: audio/mpeg`.
The **model and voice are correct for Free Tier**; the payload has no `output_format`, no `language_code`, no request id. `requestClip()` reads only `res.ok` + `res.status` and **discards the JSON error body**, so the teacher can never be told *why* (missing permission vs quota vs voice-not-in-library). That is why the message is a machine code.

**Uploaded key shape:** the vault contains a 64-character hex string for ElevenLabs and a `AQ.…` Google key (both redacted here). `looksLikeElevenKey()` (`1800-1805`) accepts any 28+ alphanumeric string, so no client-side validation rejects a malformed key before 34 requests are attempted.

### 1.4 The non-fatal contract that `v0.0.1.h` must satisfy (binding)

> **Rule TTS-0 (new).** No result from `requestClip()` / `generateClips()` may ever prevent, delay or abort the GitHub publish. `oneClickMasterSetup()` step 3 must be wrapped so that *every* outcome — success, quota, 400/401/402/403/404/422/429/500, CORS, offline, timeout, hung socket, empty audio — continues to **step 4** and finishes on the green status `Published & Synced to All Devices`.

Implementation shape for `v0.0.1.h` (all in `data/studio.js`):

1. `requestClip()` gains `AbortController` with a hard 12 s timeout per clip and one 429 retry (keep `:2037-2040`); on abort it calls `done(err)` with `err.code = 'timeout'`.
2. A new `ttsCircuit()` state: after **2 consecutive** failures of *any* kind, stop the queue, set `tierLimited = true`, `reason = <mapped human text>`, and `finish(null, {aborted:true})`.
3. `generateClips()` classifies **every** error, never re-throws: `tierLimited = true` for 401/402/403/404/422/429/0/timeout/empty_audio; `finish(null, …)` always; the callback signature `(err, info)` keeps `err === null` for all of these.
4. Remaining words/guide steps are marked `source: 'fallback'` in the voice pack, and `SDP.Speech` already resolves them through the 5-rung ladder (`sdp-audio-speech.js:604-640`) — Alice → verified British neural → **human UK dictionary audio** → device TTS. No new audio engine is needed; only *reachability* of step 4.
5. `quotaError()` becomes `humanTtsReason(err)` with **zero** machine codes in output, e.g. *"ElevenLabs Free Tier refused this clip (voice not included in your plan) — the lesson was published with the built-in British voice."*
6. Step 4 status text becomes `Published & Synced to All Devices` (`studioPublishedSynced`) with a `⚠` sub-line carrying the reason when clips were skipped.

---

## 2. Button-by-Button Truth Table — Lecturer Studio (Priority 1.2)

Host: `<details id="studioAccordion">` (`index.html:363`) → `<div id="studioBody">` (`:365`). All clicks are delegated: `bindDelegated()` (`studio.js:923-932`) → `onStudioClick()` (`1068-1082`) → `ownerId()` → `CLICK_ACTIONS[id]` (`1031-1066`).

Legend — **Exec** column is the observed result of a real click in the harness (stubbed network only).

### 2.1 Locked view (`lockedMarkup()`, `studio.js:777-784`)

| # | Button id | Rendered at | Handler | Exec on `v0.0.1.g` | Verdict / v0.0.1.h fix |
|---|---|---|---|---|---|
| 1 | `pinPadClear` | `656-664` | `1031` `setPinValue('')` | dots clear ✔ | OK · add `aria-live` count |
| 2 | `pinPadBack` | `777` | `1032` `backspacePin()` | deletes one digit ✔ | OK |
| 3 | `pinPadUnlock` | `663` | `1033` `unlock(pinValue())` | unlocks with `78987898` ✔ (executed) | OK · paint spinner, never a silent 250 ms PBKDF2 stall |
| 4 | digits `data-pin` | `660-662` | `1074-1078` `appendPin` | appends ✔ | OK |
| — | `btnStudioUnlock` | **never rendered** | `1032` | — | dead registration → delete or render (D20) |

### 2.2 Card 1 — keys (`keysCardMarkup()`, `studio.js:717-746`)

| # | Button id | Handler | Exec on `v0.0.1.g` | Verdict / fix |
|---|---|---|---|---|
| 5 | `btnToggleElKey` | `1035` `toggleSecretField` | type flips password↔text ✔, **no status line** | Low: add `Show ✓` in `#studioTestStatus` |
| 6 | `btnPasteElKey` | `1036` `pasteInto` | "Clipboard unavailable — paste manually" ✔ | OK; on iOS 14 add `execCommand` fallback |
| 7 | `btnTestElKey` | `1043` → `probeQuota` | "✅ Key accepted (scoped/free-tier…)" ✔ | OK |
| 8 | `btnToggleGhToken` | `1037` | ✔ / silent | as #5 |
| 9 | `btnPasteGhToken` | `1038` | ✔ | OK |
| 10 | `btnTestGhToken` | `1044` | "✅ GitHub Connected (dictationb1/… Write OK)" ✔ | OK |
| 11 | `btnToggleAi` | `1039` | ✔ / silent | as #5 |
| 12 | `btnPasteAi` | `1040` | ✔ | OK |
| 13 | `btnTestAi` | `1046` → `testAiEngine` (`1479-1512`) | "✅ Free Dictionary ready · zero API key · EN→SI OK" ✔ | **Fix false positive** (D12): a 400/403 body is currently reported as “ready”. |
| 14 | `btnCheckQuota` | `1041` → `quotaProbe` | works but **`display:none`** (`731`) | Unhide or delete (D20) |
| 15 | `btnRefreshQuota` | `1042` | same | same |
| 16 | **`btnSaveKeys`** | `1059` → `saveKeys()` (`1126-1170`) | **no feedback for seconds; 0 visible change** | **P1**: add `aria-busy` + `Saving keys…` + spinner; `disabled` while running; then `✓ Saved in local Vault + GitHub` |
| 17 | **`btnOneClickMasterSetup`** | `1050` → `oneClickMasterSetup` (`1611-1680`) | silent start; on 422 ends `Publish failed · tts_failed`, **nothing published** | **P1**: 4-step tracker must drive a visible progress bar; TTS non-fatal (D1); always publish |
| 18 | `btnTestOneWord` | `1044`(`1048`) → `generateClips({singleTest:true})` | `❌ tts_failed` (raw) | Map to human text; keep it a 1-word probe |
| 19 | `btnGenClips` | `1049` | same raw code, 34 attempts possible | Circuit-break after 2 failures (D2) |

### 2.3 Card 2 — words (`wordsCardMarkup()`, `studio.js:747-759`)

| # | Button id | Handler | Exec on `v0.0.1.g` | Verdict / fix |
|---|---|---|---|---|
| 20 | `btnEnrichWords` | `1047` → `enrichWords` (`1386-1477`) | "Enriched · 30 · free dictionary", 60 fetches ✔ | OK; add per-word progress (`n/30`) |
| 21 | `btnPreviewWords` | `1052` → `openPublishPreview` (`1689-1701`) | 30-row table written to `#studioPreview`, **no toast** | Add `✓ Preview ready (30 words)` |
| 22 | `btnPublishWords` | `1053` → `publish` → `publishBundle` | reaches GitHub (8 calls) ✔ | Add busy state + `Published · syncRev` |
| 23 | `btnPublishWordsAndVoice` | `1051` → `publishWordsAndVoice` (`1576-1585`) | ✔ | Same |
| 24 | `btnStudioLock` | `1057` `lock()` (`595-603`) | re-renders locked view ✔ | OK |

### 2.4 Card 3 — settings (`settingsCardMarkup()`, `studio.js:760-768`)

| # | Button id | Handler | Exec on `v0.0.1.g` | Verdict / fix |
|---|---|---|---|---|
| 25 | `btnStudioSyncSettings` | `1054` → `saveClassSettings` (`403-435`) | publishes, but **never publishes `lang`** (D6) and can be swallowed at rev-9 (D5) | **P2**: publish all 11 keys, confirm rev advance, show `Rev #N` |
| 26 | `btnStudioRecord` | `1060` `toggleRecord` | "Record word — microphone unavailable" (no mic in harness) ✔ | OK on device |
| 27 | `btnCommitClip` | `1061` `commitClip` | `disabled` until a clip exists (`765`) ✔ | OK |
| 28 | `btnLockStudio` | `1058` `lock()` | ✔ | OK |
| 29 | **`btnResumeDraft`** (outside studio) | **none** | **click does nothing** (executed) | **P1 dead button** (D8) |

**Feedback law for v0.0.1.h (binding):** every studio click must produce a visible response **within 100 ms** — either a `data-state="busy"` on the clicked button (+`disabled`) or a status line. A `busy` guard must never be silent: if `ST.publishing` is already true, print *"Still publishing — Step 3 of 4…"* instead of returning.

---

## 3. Free-tier AI audit (Priority 2.2)

### 3.1 Gemini — the endpoint is *correct*, the error handling is not

`LLM_ENDPOINTS` (`studio.js:36-41`):
`gemini: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` — **native** `:generateContent`, not an OpenAI path.
`llmRequest()` (`1354-1385`) branches at `1363`:
```js
if (provider === 'gemini') {
  url += '?key=' + encodeURIComponent(str(key));
  body = { contents: [{ parts: [{ text: prompt }] }] };   // native Gemini shape ✔
} else {
  headers.Authorization = 'Bearer ' + key;                  // OpenAI shape for pollinations/groq/openrouter ✔
  body = { model: ep.model, temperature: 0.2, response_format: { type: 'json_object' }, messages: […] };
}
```
So the brief's “OpenAI body sent to `:generateContent`” hypothesis is **not** the defect. Three real defects remain:

1. **No HTTP status check** (`1372-1376`): `.then(res => res.json()).then(json => cb(null, llmRows(provider, json)))`. A `400 INVALID_ARGUMENT` (bad key), `403 PERMISSION_DENIED`, or `429` returns `cb(null, {})` — an *empty success*. `testAiEngine()` then prints `✅ gemini ready · reachable` (`1505`) and `enrichWords()` silently falls back (`1439-1455`). The teacher is told the key works when it does not.
2. **No `generationConfig.responseMimeType = 'application/json'`** (`1370`): with `gemini-2.5-flash` thinking enabled the model frequently wraps JSON in prose/markdown; `parseJsonLoose()` may still salvage it, but the request should pin the MIME type and `maxOutputTokens`.
3. **Key in the query string** (`1368`): use the `x-goog-api-key` header instead — never in a URL that a proxy log can capture.

Also verified: `AI_SLOT_ORDER = ['free_dict','pollinations_free','groq','openrouter','gemini']` (`:34`) matches the five `<option>`s built by `aiProviderSelectMarkup()` (`685-692`), and `AI_PROVIDERS[*].needsKey` is honoured (`1360`), so slot 1 and slot 2 truly need no key.

### 3.2 The saved provider is lost on every reload (verified)

`ST` initialises `aiProvider: 'free_dict'` (`studio.js:113`). `aiProviderName()` (`618-627`) reads `ST.aiProvider` **before** `secrets().aiProvider`:
```js
if (!raw) raw = str(ST.aiProvider) || str(secrets().aiProvider) || 'free_dict';
```
`'free_dict'` is truthy, so the vault's saved `aiProvider: 'gemini'` can never win. Executed after unlocking the real vault (`secrets().aiProvider === 'gemini'`): `studioAiProvider` renders **`free_dict`**. Consequence: the lecturer re-selects slot 5 on every session; `paintAiFields()` (`808-818`) also re-writes the select on every mount. **v0.0.1.h:** `aiProviderName()` must prefer `secrets().aiProvider` (then the select, then `'free_dict'`), and `ST.aiProvider` must be seeded from the vault at `opened()`/`unlock()`.

### 3.3 Provider detection vs. the key the lecturer actually has

`detectProvider()` (`610-616`) recognises exactly `gsk_`, `sk-or-`, `AIza`. `AI_PROVIDERS.gemini.prefix = 'AIza'` (`:33`), the option label says `(AIza… — Optional)` (`sdp-ui-views.js:217`, `403`), and the placeholder says `gsk_… / AIza… / sk-or-…` (`studio.js:723`). The stored Google key is an **`AQ.…` API key** (58 chars) — executed: `detectProvider('AQ.…') === ''`, so paste-auto-detect fails and the field silently keeps whatever slot was selected. **Fix:** accept `AIza|AQ\.` for Gemini, normalise the label to `(AIza… / AQ… )`, and detect on key shape (`AQ.` → gemini).

### 3.4 The zero-key safety net is genuinely good

`freeDictTest()` (`1460-1478`) probes `api.dictionaryapi.dev` **and** `mymemory.translated.net` (`DICTIONARY_API` `:18`, `SINHALA_API` `:19`) with a 6 s `fetchJsonSafe` (`1246-1260`) and reports `dictionary`/`sinhala`/`offline`. `enrichWords()` calls the free dictionary for **every** word that a paid LLM did not fill (`1428-1440`), and `fallbackEnrich()`/`buildLexicon` keeps a built-in B1 lexicon behind that. This layer needs no change beyond surfacing per-word progress.

---

## 4. Key persistence across reloads and version upgrades (Priority 2.3)

**Verified working (executed):** cold boot on a *fresh* profile → `Studio.unlock('78987898')` → `resolveEnvelope()` (`185-210`) → `configEnvelope()` picks the published `config.json` envelope → `Vault.decryptV2(env, pin)` → `ST.secrets` populated → `mount()` → `paintSecretFields()` fills `#elKeyInput`, `#ghTokenInput`, `#studioAiKey`, `#studioGasUrl`. Result: all four fields repopulated, `isRealEnvelope()` true, Layer-1 backup (`sdp.settings.vaultLock`, `129-146`) intact.

**Failure modes that still exist:**

| # | Mechanism | Lines | Effect |
|---|---|---|---|
| K1 | `openStudio()` calls `mount()` unconditionally | `views:2034`, `studio.js:785-806` | every open re-renders `#studioBody`; `#studioPin` cleared, any in-progress edit lost |
| K2 | `paintSecretFields()` overwrites non-empty inputs from stale secrets | `821-826` | typed-but-not-saved key reverts to the old vault value |
| K3 | `lock()` wipes `ST.secrets` **and** `Vault.clear()` | `595-603` | correct by design, but `pagehide`/`beforeunload` fire it (`1183-1198`) — an in-flight publish loses its token mid-request |
| K4 | `saveKeys()` reports only after PBKDF2 + 2–4 network round-trips | `1126-1170` | looks dead (see §2 #16) |
| K5 | keys are only durable if the publish succeeded | `1151-1166` | on `no_token` it says `Saved in local Vault` — true, and correctly labelled |

**v0.0.1.h spec:** `mount({preserve:true})` restores every field from a snapshot taken before `innerHTML` replacement; `openStudio()` must not call `mount()` when `ST.unlocked`; a single `paintBusy(id, on)` helper drives every async button; `saveKeys()` must (a) paint busy immediately, (b) seal, (c) publish, (d) print one human sentence, and (e) never destroy typed input while pending.

---

## 5. Multi-device sync (Priority 3) — Device A → GitHub → Device B

### 5.1 Lecturer broadcast path (Device A) — verified

| Step | Code | Verified behaviour |
|---|---|---|
| Settings snapshot | `classSettingsSnapshot()` `studio.js:373-381` | writes the **10** `CLASS_SETTING_KEYS` (`sdp-data-sync.js:75-79`) → **`lang` is missing** (D6) |
| Publish | `saveClassSettings()` `403-435` → `publishConfigAndVersion()` `1511-1529` | `config.json` then `version.json` last, one `syncRev` from `nextSyncRev()` (`88-92`) ✔ |
| Words publish | `publishBundle()` `1530-1575` | 4 files, `version.json` **last**, `payloadFiles` stamped ✔ |
| Keys publish | `saveKeys()` `1152-1166` / `setupSeal()` `567-594` | `config.json` + `version.json` only ✔ |
| TTS cannot block | **violated** | see §1 |

### 5.2 Receiver path (Device B) — verified

```
startWatch(25000)            sdp-data-sync.js:1263-1280   one raw GET / 25 s + visibilitychange + focus
  └ checkForUpdates(cb)      :1067-1240                    dual source (origin + raw), higher syncRev wins
      ├ pullVerified()       :1156-1171                    per-leg verify + one alternate-source retry
      ├ verifyPayloadLeg()   :778-796                      json.syncRev >= targetSyncRev
      ├ applyPayloads()      :954-1001                     words/session/clips/state
      │   └ adoptRemoteSettings()  :925-951                ← the gate that can silently refuse (D5)
      └ notify('update') → Views.renderAll()               views:2009-2017
```
- **Config is sovereign** (`settle()`, `1172-1215`): a failed `session.json` leg no longer holds settings/keys hostage; the session leg is retried on the next tick. Verified by G11 (72 PASS) and by D15 comments.
- **`sdp:update` → `renderAll()`** (`views:2009-2017`) repaints home/words/practice/settings/guide — and does **not** touch `#studioBody`, so an unlocked studio on Device A survives a poll. ✔
- **`adoptRemoteSettings()` strips `touchedKeys`** for classroom keys (`938-948`): the lecturer always wins over a student's manual change. Correct per R1.

**Remaining gaps (v0.0.1.h must close):**

| # | Gap | Lines | Consequence |
|---|---|---|---|
| S1 | `rev <= appliedSettingsRev ⇒ return false` | `:931` | a publish numbered below the device's applied rev is **ignored forever**; this is exactly why the classroom does not see a change (D5) |
| S2 | `lang` is never broadcast | `studio.js:373-381` | a lecturer cannot switch the class to Sinhala/English for all devices (D6) |
| S3 | watching stops while `document.hidden` | `:1265-1268` | a phone in the background misses ticks (recovered on `visibilitychange` ✔, but a board that never blurs a tab can drift) |
| S4 | the badge always paints `state:'synced'` from `renderSettings()` | `views:1411`, `1364` | the pill can say *Synced* while the last check failed (D16 note) |
| S5 | no `settingsRev`-monotonic guarantee across releases | `sync:17` vs `version.json: settingsRev 9` | gate drift; a new release numbered 8 would be *older* than a device at 9 (D5) |

**Rule for `settingsRev: 8` without deadlock (binding):** ship `SETTINGS_REV = 8`, but make adoption **content-aware**: publish `classSettings.sig` (FNV-1a of the canonical JSON of the 11 keys) and adopt when
`rev > appliedSettingsRev` **OR** `cfg.classSettings.sig !== settings().appliedClassSettingsSig`.
`nextSettingsRev()` stays monotonic (`max(8, live+1)`), so the released `config.json` can carry `8` while any device that had adopted `9` still accepts the new content. Without this rule, pinning `settingsRev: 8` would re-create the exact deadlock that is currently failing G11.

---

## 6. Auto-pause / resume (Priority 4.3) — verified

| Behaviour | Code | Verified |
|---|---|---|
| Leaving the cockpit pauses | `showTab()` `views:570-600` → `pauseForNavigation()` `562-569` | ✔ executed: `state: paused` after tapping Home |
| Pause silences speech + saves the beat | `pause()` `engine:532-547` | ✔ (`Speech.stop()`, `saveDraft()`, `renderBadges()`) |
| Backgrounding/screen-off pauses | `bindLifecycle()` `engine:1068-1084` (`visibilitychange`, `blur`, `pagehide`) | ✔ bound once |
| Banner shows the exact word | `renderHome()` `views:640-649` → `resumeText = 'Resume Paused Dictation (Word #1/30)'` | ✔ |
| Resume restores the countdown/repeat | `resumeFromPaused()` `engine:552-580` | ✔ |
| **The Home Resume button works** | `#btnResume` → `resumeDictation()` `views:761-790` | ✔ executed: `paused → listening` |
| **`#btnResumeDraft` works** | — | **✘ DEAD** (D8) |

---

## 7. Voice ladder (Priority 4.2 / default classroom state)

`resolveTiers()` (`sdp-audio-speech.js:615-640`), `voiceLock: 'unified'`:
1 `lecturer` clip → 2 `eleven` (Alice, cached, 0 credits) → 3 `neural_tts` **only** when `scoreVoice(cachedProfVoice) >= 100` (verified Tier-1 British female list `123-140`) → 4 `dictionary` (human UK audio, `dict.youdao.com type=1`) → 5 device `tts`.
Guide narration prefers `_guide_1…_guide_4` clips (`guideClipUrl()` `649-660`) and falls back to the four real British human lines (`GUIDE_AUDIO_FALLBACK_LINES` `662+`). Defaults verified in `defaultSettings()` (`sdp-data-sync.js:58-74`): `lang: 'en'`, `pacingPreset: 'exam'`, `writeSecs: 5`, `repeats: 2`, `voiceLock: 'unified'`, `guideAutoPlay: true`; `SETTINGS` migration key `defaultsResetV001f` applies once.
Guide auto-open on a version bump: executed — with `sdp.guide_seen = '0.0.1.f'`, `#guideModal.hidden === false` and 4 steps render; `#guideAutoplayBanner` exists (`index.html:389`, `views:844-862`) for blocked autoplay. ✔

**One caveat:** the Alice tier can never fire today because `data/elevenlabs-audio.json` ships **`"clips": {}`** (0 clips). Every device therefore starts at rung 3/4. See D18.

---

## 8. UI/UX defects visible in `image_8e5239.png`

| Defect | Proof | Fix |
|---|---|---|
| **Heading printed twice**: `6 · LECTURER STUDIO & ADMIN VAULT` on the accordion bar *and* again inside the body | `index.html:364` `<summary class="set-head" data-i18n="studioTitle">` + `studio.js:770` `'<h4 class="studio-h4">' + T('studioTitle') + '</h4>'`; the same string `sdp-ui-views.js:76` / `262` | `unlockedMarkup()` renders a **status row** instead (`<div class="studio-status">` with vault badge + step tracker); the string stays only in the `<summary>` |
| Raw machine codes shown to the teacher | `studio.js:1622`, `1987`, `1779`, `1055`, `1142`, `1579` | human-only strings (new `t()` keys for every case) |
| No progress affordance on the two headline buttons | `studio.js:731-733` (no `aria-busy`), `2174` (only `btnCommitClip` ever gets `disabled`) | `paintBusy()` + CSS spinner + `disabled` + step list |
| `#studioMsg` / `#studioTestStatus` duplicated ids in both markup branches | `770-771` (unlocked) and `778-780` (locked) | safe (one branch at a time) — keep, but document |
| Error text can be longer than the card on a 360 px phone | `msg()` `213-219` sets `textContent` only | `word-break: break-word` on `.studio-msg` |

---

## 9. Defect & Upgrade Register D1–D24 (binding specification for `v0.0.1.h`)

> Every row was read at the cited line on `acff6c5`; rows marked **[exec]** were additionally reproduced at runtime. Severity: **P0** = blocks the classroom today, **P1** = blocks the lecturer, **P2** = data/UX correctness, **P3** = hygiene.

| ID | Sev | Defect | Exact location on `v0.0.1.g` | Verified root cause | Binding fix in `v0.0.1.h` |
|---|---|---|---|---|---|
| **D1** | P0 | `❌ tts_failed` aborts the whole master setup and **nothing is published** | `studio.js:2042, 2051, 2008-2013, 1986-1990, 1657-1659, 1622` **[exec]** | Only 401/402/403/429 are treated as tier-limited; 400/404/422/500/0 call `finish(err)` → `fail(3,…)` → step 4 skipped | Make step 3 non-fatal by construction (Rule TTS-0, §1.4); every status continues to step 4; final status `Published & Synced to All Devices` |
| **D2** | P0 | A hung TTS request locks publishing **forever** | `studio.js:2026-2052` (no `AbortController`), `1614` (`busy`), `1050` (`cb = noop`) **[exec]** | No timeout, no circuit breaker, silent `busy` return | 12 s `AbortController` per clip, 2-failure circuit breaker, `busy` always prints a message |
| **D3** | P1 | Studio buttons look dead for seconds (no busy/disabled/spinner) | `studio.js:671-673` (`btn()` factory), `731-733`, `1126-1170`, `1611-1680`; only `2174` ever toggles `disabled` **[exec]** | No visual state machine; PBKDF2 250 000 iters + sequential PUTs | `paintBusy(id, labelOn, labelOff)`; `aria-busy`; 100 ms feedback law (§2) |
| **D4** | P1 | Machine codes leak to the teacher (`tts_failed`, `publish_partial`, `encrypt_failed`) | `studio.js:1770-1782`, `1622`, `1055`, `1142`, `1579` | `quotaError()` returns `err.message` for unmapped errors | One mapping table → human sentences in EN + SI; G1 greps for the forbidden literals in user-facing strings |
| **D5** | P0 | Classroom settings do not reach other devices; G4/G11 red | `sdp-data-sync.js:17` (`SETTINGS_REV = 7`) vs `data/version.json:settingsRev 9`; gate at `:931` **[exec]** | Published rev outran `appliedSettingsRev`; `rev <= applied` returns `false` with no content check | `SETTINGS_REV = 8` + `classSettings.sig` (FNV-1a) + adopt on sig mismatch; publish `settingsRev = max(8, live+1)`; add a `settingsRevCeil` guard |
| **D6** | P0 | `lang` is never broadcast; a lecturer cannot change the class language | `studio.js:373-381`; `sdp-data-sync.js:75-79`; G1 expects it at `tests/check.cjs:291-296` **[exec]** | `classSettingsSnapshot()` copies the 10 keys only | Publish **11** keys incl. `lang`, adopt `lang` (personal opt-out via `touchedKeys.lang`), restore the G1 assertion |
| **D7** | P1 | Duplicate `6 · LECTURER STUDIO` heading | `index.html:364` + `studio.js:770` | The body re-renders the accordion's own title | Status row instead of an `<h4>` title (see §8) |
| **D8** | P0 | **`#btnResumeDraft` is dead** — the primary Home resume button | `index.html:67`, `views:652-653` (hide/show only); only `views:1936` binds `#btnResume` **[exec]** | No listener was ever added | Bind it to `resumeDictation()`; label from `#resumeText` (`Word #X/30`); hide `#btnResume` when a paused engine exists |
| **D9** | P2 | Resume affordance is ambiguous (two buttons, one dead) | `index.html:66-67` | see D8 | One primary CTA, one secondary |
| **D10** | P1 | The saved free-AI provider is reset to `free_dict` on every unlock | `studio.js:113`, `618-627`, `808-818` **[exec]** | `ST.aiProvider` default shadows `secrets().aiProvider` | Prefer the vault value; seed `ST.aiProvider` in `opened()`/`unlock()` |
| **D11** | P1 | Gemini/Google key prefix mismatch (`AQ.` vs `AIza`) | `studio.js:33`, `615`, `723`; `views:217`, `403`; `docs/UI_COMPONENT_GUIDE.md:450` **[exec]** | `detectProvider()` knows only `AIza` | Accept `AIza|AQ\.`, update labels/placeholders/docs |
| **D12** | P1 | `llmRequest()` treats HTTP errors as success; “✅ ready” on a 400/403 | `studio.js:1372-1376`, `1479-1512`, `1439-1455` | No `res.ok` check; body ignored | Check `res.ok`, surface `error.message` humanised, `generationConfig:{responseMimeType:'application/json', maxOutputTokens:2048}`, header `x-goog-api-key` instead of `?key=` |
| **D13** | P2 | `pollinations_free` / `groq` / `openrouter` are never validated for shape | `studio.js:36-41`, `1378-1383` | single generic OpenAI body | Per-provider body (pollinations needs `model:'openai'` + no auth — already sent ✔), `Accept: application/json`, 15 s timeout, JSON-mode where supported |
| **D14** | P1 | `mount()` wipes typed secrets and the PIN | `studio.js:785-806`, `821-826`; `views:2034` **[exec]** | Unconditional re-render + stale-value overwrite | `mount({preserve:true})`, snapshot/restore, no mount when unlocked |
| **D15** | P2 | Publishing reports success/failure with no revision or file list | `studio.js:1582-1584`, `1626-1644` | Only a toast | Print `syncRev`, file count and the 4 paths in `#studioMsg` |
| **D16** | P2 | The sync pill can claim `Synced` while a check failed | `views:1364`, `1411`, `1640-1660` | `renderAll()` paints `state:'synced'` unconditionally | Keep the last `sdp:sync-status` result in state and paint honestly (4 states) |
| **D17** | P0 | CI is red: `data/session.json` 57 380 B vs pinned 46 403 B + SHA lock; `version.json` schema/syncRev pins; `config.json` fields | `tests/check.cjs` BUDGET/pins; `.github/workflows/checks.yml` “Preserved payloads” **[exec]** | A studio publish rewrote the preserved 30-word payload on 2026-11-02 | Re-pin sizes + SHA-256 for `v0.0.1.h` in `check.cjs` **and** the workflow step, or restore the preserved payload; never publish a payload the gates do not know |
| **D18** | P0 | The Alice voice pack is empty — tier 2 can never play | `data/elevenlabs-audio.json` `"clips": {}` **[exec]** | Every generation attempt died at D1 before `commitVoicePack()` | After D1 is fixed, a 1-word test + delta generation must commit clips; G12 asserts `Object.keys(clips).length > 0` **or** a documented `voicePack.stub:true` with the fallback proven |
| **D19** | **P0 (security)** | The published vault decrypts with a hardcoded PIN → live PAT + API keys recoverable by anyone | `studio.js:17` (`BOOTSTRAP_PIN`), `data/config.json` (`encVault` 467 chars + `pinVerifier`) **[exec]** | A real sealed vault was committed to a public repo with a public PIN | Rotate the GitHub PAT, ElevenLabs key and Google key **now**; publish a **verifier only** (`pinVerifier` + `SDP_ENC_V2:AAA=` placeholder); seal per device into `sdp.settings.vaultLock`; keep `78987898` as the UX gate only |
| **D20** | P3 | Registered-but-unrendered / hidden controls | `studio.js:1032` (`btnStudioUnlock`), `731-732` (`display:none`) | legacy ids kept “just in case” | Delete or unhide; G1 asserts every `CLICK_ACTIONS` key has a rendered id |
| **D21** | P3 | `skipped` count lies after a tier stop | `studio.js:2011` `skipped = max(skipped, queue.length - made.length)` | counts un-attempted words as cached | count `skipped` (cached) and `deferred` (never attempted) separately |
| **D22** | P3 | G3 gate crashes instead of failing cleanly | `tests/phase1.cjs:168` **[exec]** | 300 × 1 s is less than 30 words × ~13 s at the exam preset (adopted by D5) | Fix D5, raise the tick budget to 600, and guard `missedButtons[i]` with a length assertion |
| **D23** | P2 | The Home resume button text ignores the word number | `views:647` sets `#resumeText` only; `engine:521` does it for the cockpit | two independent labels | Single source: both read `Word #X/30` |
| **D24** | P3 | Docs drift (5 ledgers + UI guide still describe `v0.0.1.g`, gates, budgets) | `docs/*.md` | manual upkeep | Update all five ledgers in the release commit (P6) |

**Score on `main`:** 24 tracked defects — 8 × **P0**, 9 × **P1**, 4 × **P2**, 3 × **P3**. Executed: 11 of them reproduced at runtime; 5 gates red.

---

## 10. Release plan for `v0.0.1.h`

1. **P0 first, in this order:** D19 (rotate + stop publishing a live vault) → D1/D2 (TTS never fatal) → D8 (dead resume button) → D5/D6 (settingsRev + `lang` sync) → D17/D18 (payload pins + a non-empty pack).
2. **Version law:** `ver: 8`, `schema: 8`, `settingsRev: 8` with the `classSettings.sig` adoption rule (§5.2) so pinning 8 cannot deadlock a device that already adopted 9. `sw.js`: `SW_VERSION = 'sdp-v0.0.1.h'`, `SHELL_CACHE = 'sdp-v0.0.1.h-shell'`. `index.html` `TARGET`, `#aboutVersion`, `#sdpVerPill`, `manifest.webmanifest` `start_url`/shortcuts, `data/sdp-data-sync.js` `APP_VERSION`/`SDP.version`/`SDP.ver`, `data/version.json`, `data/config.json`, `data/elevenlabs-audio.json` headers.
3. **Gates:** G1–G12 all green (0 FAIL), plus the payload SHA step in `checks.yml`; new assertions for D1 (a 422 must still PUT 4 files), D8 (the resume button resumes), D5/D6 (lang + sig adoption), D19 (no real envelope in the repo).
4. **Docs:** `ARCHITECTURE_MAP.md` (§H1 byte budgets re-based, §H2 ids, gate table), `UI_COMPONENT_GUIDE.md` (§studio buttons + busy states + AI slots incl. `AQ.`), `SYNC_AND_DATA_CONTRACT.md` (§R1 sig adoption, §R6 publish order, §R7 vault policy), `CHANGELOG_LEDGER.md` (D1–D24 closure table + gate ledger), `DAILY_UPGRADE_PROMPT_TEMPLATE.md` (re-based to `v0.0.1.h`).
5. **Smoke on device:** 360×640 Chrome cold boot → PIN `78987898` → One-Click Setup with a **deliberately wrong** ElevenLabs key → must end green `Published & Synced to All Devices` with 4 PUTs; second phone pulls the words within 25 s; board at 1366×768 shows one heading only.

---

## 11. What this audit does **not** claim

- It does not claim ElevenLabs is broken. The request (`eleven_flash_v2_5` + `Xb7hH8MSUJpSbSDYk0k2`) is correctly formed; the *handling* of a non-whitelisted status is the bug.
- It does not claim `renderAll()` wipes the studio (it does not — disproved, §0.2/§5.2), nor that a `blur`→click race exists.
- It does not claim the PIN `78987898` is wrong; it is the correct classroom gate — it is simply not a secret (D19).
- No credential value is reproduced in this document; only prefixes/lengths needed to justify D11/D19.
