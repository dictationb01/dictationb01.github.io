# Arena.ai Master Prompt — Smart Dictation Player `v0.0.1.g` → `v0.0.1.h`

**Repo:** `https://github.com/dictationb1/dictationb1.github.io` · **Live:** `https://dictationb1.github.io/` · **Branch to build on:** create `release/v0.0.1.h` from `main` (`acff6c5`, `v0.0.1.g`), then merge to `main`.
**Classroom:** CCBE Galle Branch — B1 English (Sri Lanka). Students: Android `360×640` / `390×844`, 2 GB RAM, 3G/4G. Lecturer: Smart Board `1366×768` / `1440×900` / `1920×1080`.
**Credits that must never change:** `Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu)` / `නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini` / `CREDITS GOES TO Hansana`.
**Definition of done:** `ver: 8`, `schema: 8`, `settingsRev: 8`; every defect in §3 closed; **all 12 gates G1–G12 = 0 FAIL**; the 5 `docs/*.md` ledgers updated; merged to `main`; live site verified on a 360 px phone and a 1366 px board.

---

## 0. WORKING RULES W1..W10

- **W1 — Zero guessing.** Every change must cite a line you actually read on `main` (`acff6c5`). If a claim is not in the code or in a test result you ran, do not write it. No "probably", no invented APIs.
- **W2 — Read before write.** Open, in this order: `data/studio.js` (2347 L), `data/sdp-ui-views.js` (2152 L), `data/sdp-data-sync.js` (1716 L), `data/sdp-dictation-engine.js` (1137 L), `data/sdp-audio-speech.js` (897 L), `index.html` (459 L), `sw.js` (271 L), `data.html` = `data/index.html`, `assets/css/sdp-ui.css`, `data/*.json`, `tests/*.cjs`, the 5 `docs/*.md`.
- **W3 — ES5 only.** No `let`/`const`/arrow/`class`/template literals in shipped JS. `tests/check.cjs` and `tests/audit-v42.cjs` parse every file with `acorn`; a syntax regression fails G1/G9.
- **W4 — Byte budgets are law.** No shipped file may exceed its ceiling in `tests/check.cjs` `BUDGET` (e.g. `studio.js` 108 000, `sdp-ui-views.js` 125 000, `index.html` 36 000, `sdp-data-sync.js` 82 000). Re-base a ceiling only with a comment citing the release.
- **W5 — Secrets never ship.** No credential, token or key value may be committed, logged, put in a URL path, or written into `data/*.json`. Only the lecturer's device holds plaintext, and only in `sdp.settings.vaultLock`.
- **W6 — Only `data/studio.js` touches a key.** No other module may read, store, transmit or echo a key. G12 asserts it.
- **W7 — Five localStorage keys only.** `sdp.progress`, `sdp.settings`, `sdp.session`, `sdp.guide_seen`, `sdp.migrated_from_legacy`. Everything new lives inside one of them.
- **W8 — One publish clock.** `nextSyncRev()` = `max(Date.now(), prev+1)`; `version.json` is always the **last** PUT; `config.json` is sovereign on the read side.
- **W9 — Never red.** A network, quota, CORS, offline or 4xx/5xx response may change a *message*, never a *state machine*, and never block a publish. Legacy/offline paths must stay green.
- **W10 — Prove it.** Every fix gets a gate assertion or a `tests/*.cjs` case that fails before and passes after. Print PASS/FAIL counts. `npm ci --prefix tests` then `npm run gates --prefix tests` must end with **0 FAIL** across G1–G12.

---

## 1. GLOBAL RULES R1..R10

- **R1 — Lecturer wins, students keep their own.** A publish bumps `settingsRev`; the reader adopts the **11** classroom keys (`mode, writeSecs, repeats, pauseSecs, autoAdvance, pacingPreset, voiceLock, voiceSource, rate, theme, lang`) unless the student explicitly touched that key (`touchedKeys`). Personal keys (`volume`, `guideAutoPlay`, `hints`, `lang` when touched) and `sdp.progress` are never overwritten.
- **R2 — British English professor default.** `lang: 'en'`, `voiceLock: 'unified'`, `en-GB` persona, `pacingPreset: 'exam'`, `writeSecs: 5`, `repeats: 2`, `guideAutoPlay: true`. Sinhala is a first-class UI language; the credits appear verbatim in EN and SI.
- **R3 — PIN gate.** `78987898` opens the Lecturer Studio (`BOOTSTRAP_PIN`). 4–12 digits, PBKDF2-SHA256 (250 000 iters) verifier, persisted lockout. The PIN is a **UX gate only** — it must never be the sole protection for a GitHub PAT (see D19).
- **R4 — TTS is decorative, publishing is not.** See D1/D2. No ElevenLabs outcome may abort `oneClickMasterSetup` or `publishBundle`.
- **R5 — Every click answers within 100 ms.** Delegated clicks (`#studioAccordion`), `aria-busy`, `disabled` while running, one human sentence in EN + SI. No raw machine codes in any user-visible string.
- **R6 — Four files, one revision.** A words+voice publish writes `data/session.json`, `data/config.json`, `data/elevenlabs-audio.json`, `data/version.json` in that order with one `syncRev`; a settings/keys publish writes `config.json` then `version.json` and stamps `payloadFiles`.
- **R7 — Sync in ≤ 25 s.** `startWatch(25000)` + `visibilitychange` + window `focus`; dual source (origin, then `raw.githubusercontent.com`), higher `syncRev` wins, each leg verified by `verifyPayloadLeg`.
- **R8 — Offline-first.** No audio stubs, no fake files. The 5-rung ladder (`lecturer → eleven → neural_tts(score≥100) → dictionary UK human → device tts`) is the only voice path.
- **R9 — Preserve what is pinned.** `data/session.json` (30-word classroom payload), `data/gas-source.txt`, both Sinhala fonts, `data/elevenlabs-audio.json` header keys and `data/version.json` keys keep their contract; a re-pin is allowed **only** with the SHA-256 updated in `tests/check.cjs` **and** `.github/workflows/checks.yml` in the same commit.
- **R10 — Accessibility + low-end phones.** Focus order, `role`/`aria-live` on status lines, ≥44 px targets, no layout shift on re-render, ≤ 60 ms main-thread work per repaint, zero `backdrop-filter` on 360 px.

---

## 2. PHASES P0..P6

### P0 — Baseline (do this first, 15 min)
1. `git checkout main && git pull && git checkout -b release/v0.0.1.h`.
2. `npm ci --prefix tests` then record the **red baseline** (this is the "before" evidence in the PR):
   - `node tests/check.cjs` → expect `81 PASS / 7 FAIL`
   - `node tests/phase1.cjs` → expect `G3 harness crashed … phase1.cjs:168`
   - `node tests/server.cjs` → expect `9 == 7`
   - `node tests/vault-sync.cjs` → expect `72 PASS / 2 FAIL` (G11.13c, G11.14b)
   - `node tests/studio-safety.cjs` → 78 PASS / 0 FAIL
3. Save the transcript into the PR description.

### P1 — Security + credentials (D19, blocking)
1. **Rotate** the GitHub PAT, the ElevenLabs key and the Google/Gemini key in their consoles. Do not put the new values anywhere in the repo.
2. `data/config.json`: replace the real `encVault` with the frozen placeholder `SDP_ENC_V2:AAA=`, keep `pinVerifier` (PBKDF2 metadata only, no secret), keep `classSettings` (now 11 keys).
3. `data/studio.js`: keep `BOOTSTRAP_PIN = '78987898'` as the UX gate; sealing stays **per device** in `sdp.settings.vaultLock` (`writeLayerOne`). `publishConfigAndVersion()` must never write a device-sealed envelope to `config.json`; assert `isRealEnvelope(cfg.encVault) === false` for anything the app publishes.
4. Add a G1 assertion: no `SDP_ENC_V2:` string longer than `SDP_ENC_V2:AAA=` may exist in any shipped `data/*.json`.

### P2 — Lecturer Studio: make it impossible to fail silently (D1, D2, D3, D4, D7, D14, D15, D20, D21)
`data/studio.js`:
1. **`requestClip(item, key, done, attempt)`** — add `AbortController`, `setTimeout(12 000)`; one retry on `429` (keep `attempt < 1`); on any non-2xx read the JSON body if the content type allows and set `err.code` from `body.detail.status`; always `done(err)`.
2. **`generateClips()`** — add a failure counter; after **2** consecutive failures of any kind: `stopped = true`, `tierLimited = true`, `finish(null, {made, skipped, deferred, reason, tierLimited:true})`. `err` is **always null** for TTS failures. Never `msg('❌ ' + code)`.
3. **`oneClickMasterSetup()`** — `step3()` must call `step4()` for every outcome (wrap in a `try/finally`-style ES5 guard). `fail()` remains only for step 1 (no GitHub token / token rejected). Final message: `t('studioPublishedSynced')` = `Published & Synced to All Devices` + `· N clips · syncRev R`, with a `⚠ <human reason>` sub-line when clips were skipped.
4. **`humanTtsReason(err)`** replaces `quotaError()` for user text: map `401/402/403/404/422/429/500/0/timeout/empty_audio/encode_failed` to one sentence each (EN + SI). No literal `tts_failed`, `publish_partial`, `encrypt_failed` may reach the DOM (G1 greps the shipped strings).
5. **Busy state machine** — `paintBusy(id, on, label)` sets `aria-busy`, `disabled`, a `.is-busy` class (CSS spinner) and a `#studioMsg` line. Apply to `btnSaveKeys`, `btnOneClickMasterSetup`, `btnGenClips`, `btnTestOneWord`, `btnEnrichWords`, `btnPublishWords`, `btnPublishWordsAndVoice`, `btnStudioSyncSettings`, `btnTestElKey`, `btnTestGhToken`, `btnTestAi`. A `busy`/`publishing` guard must **print** `t('studioBusyStep')` instead of returning silently.
6. **`mount({preserve:true})`** — snapshot every input value (id → value) before `host.innerHTML = …`, restore after; `openStudio()` calls `mount({preserve:true})` and **only when locked**. `paintSecretFields()` must skip an input that currently has focus.
7. **`unlockedMarkup()`** — remove the duplicate `<h4>` title (D7). Emit `<div class="studio-status">` with the vault badge, the 4-step tracker and the word count. The string `studioTitle` stays only in `index.html:364` `<summary>`.
8. **Remove** `btnStudioUnlock` from `CLICK_ACTIONS` (never rendered, D20); un-hide `btnCheckQuota`/`btnRefreshQuota` inside a `<details class="studio-diagnostics">` instead of `display:none`.
9. **Counts** — report `skipped` (cached) and `deferred` (never attempted) separately (D21).

### P3 — Free AI: correctness, persistence, 100% free ladder (D10, D11, D12, D13)
1. `aiProviderName()` order → `secrets().aiProvider` → `#studioAiProvider` value → `ST.aiProvider` → `'free_dict'`. Seed `ST.aiProvider`/`ST.aiKey` in `opened()` and `unlock()`.
2. `detectProvider()` accepts `AIza…` **and** `AQ.…` for Gemini; update `AI_PROVIDERS.gemini.prefix` to `'AIza|AQ.'`, the option label (`sdp-ui-views.js`, EN 217 / SI 403) to `5: Google Gemini Free Tier · gemini-2.5-flash (AIza… / AQ… — Optional)`, and the placeholder in `keyRowMarkup('studioAiKey', …)`.
3. `llmRequest()` — per provider: timeout 15 s with `AbortController`; **`if (!res.ok) return cb(withStatus(new Error('llm_http'), res.status))`**; Gemini native body gains `generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 2048 }` and sends the key in the **`x-goog-api-key` header** (not `?key=`); OpenAI-compatible slots keep `response_format:{type:'json_object'}` and `Accept: application/json`.
4. `testAiEngine()` must say `❌ <provider> · <human reason> — using the free dictionary` on a non-2xx and must never print `ready` without a parsed JSON row (or a successful free-dictionary probe).
5. `free_dict` remains the last resort: `api.dictionaryapi.dev` + `mymemory.translated.net` (6 s each), then the built-in B1 lexicon. Add a per-word progress line `Enriching 12/30`.
6. Document the ladder in `docs/UI_COMPONENT_GUIDE.md`: slot order `free_dict → pollinations_free → groq → openrouter → gemini`, which keys are free, and that all five fall back automatically.

### P4 — Sync: settings must land on every device (D5, D6, D16, S1–S5)
`data/sdp-data-sync.js`:
1. `var SETTINGS_REV = 8;` and `CLASS_SETTING_KEYS` gains `'lang'` (11 keys, order fixed).
2. `classSettingsSig(obj)` — FNV-1a over `JSON.stringify` of the 11 keys in fixed order. Stored in `sdp.settings.appliedClassSettingsSig`.
3. `adoptRemoteSettings()` — adopt when `rev > appliedSettingsRev` **OR** `sig !== appliedClassSettingsSig`; always update `appliedSettingsRev = Math.max(applied, rev)`; strip only non-classroom `touchedKeys`; emit `sdp:teacher-updated` with `{settingsRev, sig, applied, changed}`.
4. `data/studio.js` `classSettingsSnapshot()` publishes all 11 keys **plus** `sig`; `nextSettingsRev()` stays monotonic: `Math.max(SETTINGS_REV, live+1)`.
5. `Views.renderAll()` must not paint `state:'synced'`; keep the last `sdp:sync-status` `(err, result)` in a module variable and paint the honest 4-state badge (D16).
6. Watch: keep `startWatch(25000)`; add a `setTimeout` catch-up 3 s after `visibilitychange` → `visible` when the doc was hidden > 5 min.

### P5 — Student-first polish (D8, D9, D23, layout)
1. **Bind `#btnResumeDraft`** → `resumeDictation()` (same function as `#btnResume`). Its label = `t('resumePaused') + ' (Word #' + (index+1) + '/' + bank + ')'`, updated in `renderHome()` and in `Engine.renderBadges()`. One primary CTA: hide `#btnResume` when the engine is paused, hide `#btnResumeDraft` otherwise.
2. `#guideModal` auto-opens when `sdp.guide_seen !== '0.0.1.h'`; `#guideAutoplayBanner` shows on blocked autoplay; narration prefers `_guide_1…_guide_4`, then the four British human fallback lines.
3. `.studio-msg { overflow-wrap: anywhere }`; `.studio-status` grid collapses to one column ≤ 420 px; all studio buttons ≥ 44 px on touch.
4. Home → cockpit → Home → resume must be proven at 360×640 and 1366×768 in G5/G7.

### P6 — Release, docs, gates, merge
1. Version law (all of it, one commit per file group):
   - `index.html`: `TARGET='0.0.1.h'`, `#sdpVerPill`, `#aboutVersion`, meta description.
   - `sw.js`: `SW_VERSION='sdp-v0.0.1.h'`, `SHELL_CACHE='sdp-v0.0.1.h-shell'`; keep `PRESERVE_CACHES`.
   - `data/sdp-data-sync.js`: `APP_VERSION='0.0.1.h'`, `SDP.version='0.0.1.h'`, `SDP.ver=8`, `SCHEMA=8`.
   - `data/version.json`: `ver:8, appVersion/version:'0.0.1.h', buildDate:2026-11-02, schema:8, settingsRev:8, syncRev:<max(now, prev+1)>, session:'8', title unchanged`, `payloadFiles` as published.
   - `data/config.json`: `ver:8, appVersion/version, schema:8, settingsRev:8`, `classSettings` = 11 keys + `sig`, `encVault:'SDP_ENC_V2:AAA='`, `pinVerifier` retained.
   - `data/elevenlabs-audio.json`: `version/appVersion/ver/schema/settingsRev` headers; `voiceId` `Xb7hH8MSUJpSbSDYk0k2`, `modelId` `eleven_flash_v2_5`.
   - `manifest.webmanifest`: description, `start_url:"./?v=0.0.1.h"`, both shortcuts.
2. Update all five ledgers: `ARCHITECTURE_MAP.md` (byte table re-based, id table, gate table, load order), `UI_COMPONENT_GUIDE.md` (studio buttons + busy states + AI slots + resume CTA), `SYNC_AND_DATA_CONTRACT.md` (§R1 sig adoption, §R6 publish order, §R7 vault policy: verifier only), `CHANGELOG_LEDGER.md` (D1–D24 closure table + gate ledger + before/after byte table), `DAILY_UPGRADE_PROMPT_TEMPLATE.md` (re-based to `v0.0.1.h`).
3. Re-pin every changed payload in `tests/check.cjs` **and** `.github/workflows/checks.yml` in the same commit (R9), including the new `data/session.json` size/SHA if it changed.
4. Run `npm run gates --prefix tests`; G1–G12 must all report **0 FAIL**. Paste the 12 counts into the PR.
5. Push `release/v0.0.1.h`, open a PR, wait for the `release gates` workflow to go green, then `gh pr merge --merge` (no `--auto`).
6. Post-merge smoke on the live URL: cold boot → PIN `78987898` → One-Click Setup with **a deliberately invalid ElevenLabs key** must still end `Published & Synced to All Devices`; a second device must pull the new words within 25 s; one heading only; Home resume button resumes the exact beat.

---

## 3. HELPER FILES — verified defect & upgrade register (source of truth for P1–P5)

Line numbers are from `main` @ `acff6c5`. `[exec]` = reproduced at runtime by the audit (`docs/SDP_v0.0.1.h_Forensic_Audit_and_Blueprint.md`).

| ID | Sev | Defect (as found) | Location | Fix mandate |
|---|---|---|---|---|
| D1 | P0 | `❌ tts_failed` aborts master setup; 0 files published `[exec 422/400]` | `studio.js:2042,2051,2008-2013,1986-1990,1657-1659,1622` | TTS non-fatal; step 4 always runs; green `Published & Synced to All Devices` |
| D2 | P0 | Hung TTS locks `ST.publishing` forever; later clicks silent `[exec]` | `studio.js:2026-2052,1614,1050` | 12 s abort + 2-failure circuit breaker + a visible `busy` message |
| D3 | P1 | No busy/disabled/spinner; `Save Keys`/`One-Click` look dead for seconds `[exec]` | `studio.js:671-673,731-733,1126-1170,1611-1680,2174` | `paintBusy()` everywhere + 100 ms feedback law |
| D4 | P1 | Machine codes shown to the teacher | `studio.js:1770-1782,1622,1055,1142,1579` | `humanTtsReason()`; G1 forbids the literals in DOM strings |
| D5 | P0 | Settings never reach other devices; G4/G11 red `[exec 9≠7]` | `sdp-data-sync.js:17,931`; `version.json settingsRev 9` | `SETTINGS_REV=8` + `classSettings.sig` content adoption + monotonic publish |
| D6 | P0 | `lang` never broadcast (10 keys only); G1 red `[exec]` | `studio.js:373-381`; `sdp-data-sync.js:75-79`; `check.cjs:291-296` | Publish/adopt 11 keys incl. `lang` |
| D7 | P1 | `6 · LECTURER STUDIO` heading duplicated | `index.html:364` + `studio.js:770` | Replace the `<h4>` with a status row |
| D8 | P0 | Home **`#btnResumeDraft` is dead** — no listener `[exec]` | `index.html:67`; `views:652-653`; only `views:1936` binds `#btnResume` | Bind to `resumeDictation()`; label with `Word #X/30` |
| D9 | P2 | Two resume controls, one dead | `index.html:66-67` | One primary CTA |
| D10 | P1 | Saved AI provider resets to `free_dict` on unlock `[exec]` | `studio.js:113,618-627,808-818` | Vault value wins; seed `ST.aiProvider` on unlock |
| D11 | P1 | Google key `AQ.…` not detected; labels say `AIza` only `[exec]` | `studio.js:33,615,723`; `views:217,403`; `UI_COMPONENT_GUIDE.md:450` | Accept `AIza|AQ.`; update labels/placeholders/docs |
| D12 | P1 | `llmRequest()` ignores HTTP status → false “✅ ready” | `studio.js:1372-1376,1479-1512` | `res.ok` check, human error, Gemini `generationConfig`, `x-goog-api-key` header |
| D13 | P2 | No timeouts/JSON-mode per LLM slot | `studio.js:36-41,1378-1383` | 15 s abort, `Accept: application/json`, per-provider body |
| D14 | P1 | `mount()` wipes typed secrets + PIN `[exec]` | `studio.js:785-806,821-826`; `views:2034` | `mount({preserve:true})`; skip the focused field |
| D15 | P2 | Publish reports no revision/file list | `studio.js:1582-1584,1626-1644` | Print `syncRev` + 4 paths |
| D16 | P2 | Sync pill claims `Synced` after a failed check | `views:1364,1411,1640-1660` | Honest 4-state badge from `sdp:sync-status` |
| D17 | P0 | CI red: `session.json` 57 380 B > 46 403 B + SHA lock; version/config pins `[exec]` | `tests/check.cjs` BUDGET/pins; `checks.yml` | Re-pin in both files in one commit (R9) |
| D18 | P0 | Alice pack empty (`clips: {}`) → tier 2 never plays `[exec]` | `data/elevenlabs-audio.json` | After D1, commit clips on the first successful generation; G12 asserts non-empty or a documented stub |
| D19 | **P0** | Published vault decrypts with a public PIN → live PAT/keys exposed `[exec]` | `studio.js:17`; `data/config.json encVault` | Rotate credentials **now**; publish verifier only; per-device sealing; G1 blocks a real envelope in repo |
| D20 | P3 | Registered-but-unrendered / hidden controls | `studio.js:1032,731-732` | Delete `btnStudioUnlock`; unhide quota buttons |
| D21 | P3 | `skipped` counts un-attempted words | `studio.js:2011` | Separate `skipped` vs `deferred` |
| D22 | P3 | G3 crashes instead of failing cleanly `[exec]` | `tests/phase1.cjs:168` | Guard the array; raise the tick budget to 600 |
| D23 | P2 | Home resume button omits `Word #X/30` | `views:647`; `engine:521` | Single source for both labels |
| D24 | P3 | Docs still describe `v0.0.1.g` | `docs/*.md` | Update all five ledgers in P6 |

### Required new gate assertions (add to the stated files)
- **G1** `tests/check.cjs`: `data/config.json` has 11 `classSettings` keys **and** `classSettings.lang === 'en'` **and** a `sig`; `encVault === 'SDP_ENC_V2:AAA='`; no user-facing string contains `tts_failed|publish_partial|encrypt_failed|subscription_failed`; every `CLICK_ACTIONS` id exists in `studio.js` markup; `ver/schema/settingsRev === 8`; budgets re-based.
- **G3** `tests/phase1.cjs`: the paper run reaches `finished` inside the budget; `#btnResumeDraft` resumes (`paused → listening`); a version bump opens the guide.
- **G4** `tests/server.cjs`: `version/config settingsRev === 8`; `ver === 8`; `schema === 8`.
- **G11** `tests/vault-sync.cjs`: a settings-only publish at a **lower** rev but a new `sig` is adopted (D5); `lang: 'si'` propagates to a second app instance within one `checkForUpdates()` (D6).
- **G12** `tests/studio-safety.cjs`: with a stubbed ElevenLabs `422`, `oneClickMasterSetup()` still issues **4** `PUT /contents/` requests and ends with `Published & Synced to All Devices` (D1); the rejected clip leaves `deferred > 0` and never sets a fatal flag.
- **G5/G7** `tests/browser.cjs`, `tests/e2e.cjs`: exactly one `6 · LECTURER STUDIO` heading exists in the live DOM at 360×640 and 1366×768 (D7).

### Hard constraints for the executor
- Do **not** rename files, modules, ids, exports or the 5 localStorage keys.
- Do **not** reintroduce a relay, a topic, or any server-side key store.
- Do **not** widen a byte budget instead of fixing the defect.
- Do **not** claim a fix without a gate assertion that fails before and passes after.
- Do **not** put a credential in the repo, in a prompt, in a log, or in a URL.
- Keep every existing passing assertion passing: 81+ G1, 78 G12, 72 G11 (now 74+), all of G2/G5–G10.
