# SYNC_AND_DATA_CONTRACT — Smart Dictation Player v0.0.1.h

Everything that touches bytes on a student's phone, or a byte on GitHub, is
specified here. If code and this document disagree, the document wins and the
code is the bug.

---

## R1 — Version and cache constants

| Constant | Value | Where |
| --- | --- | --- |
| `APP_VERSION` / `SDP.version` | `0.0.1.h` | `index.html`, every module |
| `ver` | `7` | `data/version.json`, `data/config.json`, `data/elevenlabs-audio.json` |
| `schema` | `7` | same |
| `settingsRev` | `7` | same |
| `syncRev` | `1793595000000` | identical in version/config/voice-pack; seed for `nextSyncRev()` |
| `SW_VERSION` | `sdp-v0.0.1.h` | `sw.js` |
| `SHELL_CACHE` | `sdp-v0.0.1.h-shell` | `sw.js` |
| `PRESERVE_CACHES` | `['sdp-youdao-v1', 'sdp-audio-clips']` | `sw.js` |

There is exactly one version file: `data/version.json`. Never a root `/version.json`.

---

## R2 — `window.SDP` boot and reconciliation

```
boot()  →  GET ./data/version.json?t=<ms>   (cache: no-store)
        →  GET ./data/config.json?t=<ms>
        →  GET ./data/session.json?t=<ms>
        →  applyPayloads()  →  30 normalised words  →  'sdp:ready'
```

A hung request is finished by a 6,000 ms guard, so an offline phone never freezes
on the splash. `state.source` is `network`, `offline` or `memory`; the data toast
uses it (`Loaded · N KB` vs `Offline ready · 0 KB`).

`checkForUpdates(cb)` re-reads `version.json` and compares three fields:

| Field | Meaning | Effect when changed |
| --- | --- | --- |
| `session` | active session number | re-fetch `session.json`, swap the word bank |
| `settingsRev` | settings schema revision | re-fetch `config.json` |
| `syncRev` | monotonic publish stamp | re-fetch `session.json` |

`cb(null, {updated:true, session})` fires at most once per check. **It never
writes `sdp.progress`**, which is why a session published by the lecturer cannot
erase a student's streak (G8).

The watch runs `checkForUpdates` every 120,000 ms and on `visibilitychange`
(foreground). Tests set `window.__SDP_NO_LIVE__ = true` to stay offline.

---

## R3 — `data/version.json` (H3)

```json
{
  "ver": 5,
  "appVersion": "0.0.1.e",
  "version": "0.0.1.e",
  "buildDate": "2026-11-02",
  "schema": 5,
  "settingsRev": 5,
  "session": "8",
  "title": "Session 8 - Personal Feelings, Opinions & Experiences (Adj)",
  "updatedAt": "2026-11-02T00:00:00Z",
  "syncRev": 1793585000000
}
```

Ceiling 2,000 B. Anything larger means someone pasted the old multi-hundred-field
pointer file back in.

---

## R4 — `localStorage`: five keys, and only five (R8)

| Key | Shape |
| --- | --- |
| `sdp.progress` | `{mastered:{}, attempts:{}, weakWords:[], streak:{count,lastDate}, history:[], lastScore:null}` |
| `sdp.settings` | `{mode:"paper", writeSecs:8, repeats:3, pauseSecs:1.5, autoAdvance:true, voiceSource:"auto", rate:0.95, volume:1, lang:"en", theme:"dark", hints:{pos:true,first:false,si:false,sentence:false}}` |
| `sdp.session` | `{sessionId:"8", index:0, mode:"paper", answers:{}, updatedAt:0}` — deleted on finish |
| `sdp.guide_seen` | `"0.0.1.b"` once the student closes `#guideModal` (version stamp, not a boolean) |
| `sdp.migrated_from_legacy` | `"1"` after the one-time import |

**Corruption policy.** `Data.read()` wraps `JSON.parse` in try/catch. A corrupt
value is removed and replaced by the schema default; boot never throws
(G3 covers this).

**One-time legacy import.** While `sdp.migrated_from_legacy !== '1'`,
`Data.migrateLegacyOnce()` reads `sdp.v57_secure_local`, `sdp.v56_audit_verified`
and `sdp.v55_guaranteed_device_sync` (names built by string concatenation so no
shipped byte ever writes them), copies `streak`, `weakWords`/`missedWords`,
`mastered` and `history` into `sdp.progress`, writes the flag and then **never
touches a legacy key again**.

`data-meter.js` keeps its own metering counters under `sdp.dataMeter.*`; they are
telemetry for the `/data` page, contain no student content, and are excluded from
the five-key rule.

---

## R5 — `SDP_ENC_V2` cross-device vault (frozen wire format)

Envelope:

```
"SDP_ENC_V2:" + base64( salt[16] || iv[12] || AES-GCM-256(ciphertext || tag) )
```

Key derivation:

```js
baseKey = await crypto.subtle.importKey('raw', utf8(pin), 'PBKDF2', false, ['deriveKey']);
key     = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
            baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']);
```

- Plaintext: UTF-8 JSON, e.g. `{"ghToken":"…","elevenKey":"…","gasUrl":"…","updatedAt":1762000000000}`.
- Minimum real envelope: **29 decoded bytes** (16 salt + 12 iv + 1 tag byte).
- `"SDP_ENC_V2:AAA="` (3 bytes) and anything shorter is an **unconfigured empty
  vault**: `decryptV2()` resolves `{empty:true}` instead of throwing.
- Wrong PIN rejects `{code:'bad_pin', triesLeft}`. Five consecutive failures
  reject `{code:'locked', retrySec:60}` and lock for 60,000 ms; a correct PIN
  during the lock is still refused.
- Unlocked secrets live only in `sessionStorage['sdp.studio.unlocked']` and are
  cleared by `Vault.clear()` / the studio lock button. They never reach
  `localStorage`, a cookie, or the DOM.

Test vector (G2): `encryptV2({elevenKey:'sk_test', ghToken:'ghp_demo'}, '78987898')`
must round-trip, must differ on every run (fresh salt/iv), and must decrypt to
the identical object.

---

## R6 — Service worker policy

| Request | Strategy | Cache |
| --- | --- | --- |
| `dict.youdao.com/dictvoice…`, `?audio=` | cache-first | `sdp-youdao-v1` |
| `assets/audio/session-w*`, `blob:`, `elevenlabs` | cache-first | `sdp-audio-clips` |
| `.woff2`, `.png`, `.svg`, `.ico`, `.webp`, `/assets/fonts/` | cache-first | `sdp-v0.0.1.b-shell` |
| navigations | network-first, 4,000 ms → cache → `./index.html` | shell |
| same-origin `.html/.json/.js/.css/.webmanifest`, `/data/` | network-first, 4,000 ms | shell |

`install` precaches: `./`, `./index.html`, `./assets/css/sdp-ui.css`, the six
`./data/*.js` modules, `./data/version.json`, `./data/config.json`,
`./data/session.json`, both fonts, `./manifest.webmanifest`, `./data.html`,
`./data/index.html` — then `skipWaiting()`. A `sdp:cache-words` message handler
caches the 30 word-audio URLs on demand (offline downloader); both preserved
audio caches survive every upgrade.

`activate` deletes every `sdp-*` cache that is not the shell cache or a preserved
cache, then `clients.claim()`.

---

## R7 — Publishing (Studio only)

Two paths, both while unlocked:

1. **GitHub Contents API** — `PUT /repos/{owner}/{repo}/contents/{path}` with
   `{message, content: base64(utf8(text)), branch:'main', sha?}`. `sha` comes
   from a prior `GET`. Owner/repo come from the preserved `config.json`
   (`dictationb1` / `dictationb1.github.io`).
2. **GAS relay** — CORS-simple `POST` with `Content-Type: text/plain` body
   `{action, app:'sdp', ver:'0.0.1.d'}` (hard ceiling 600 B). **The PIN is never
   in the body** (W6/D-S9): it is verified inside the Apps Script, which is the
   only place it exists. Word publishing is chunked so every chunk stays under
   40,000 B.

### Sequential publisher (`SDP.Sync.publishFilesSequential`)

`Promise.all` over three PUTs is forbidden: GitHub rejects concurrent commits to
the same branch and the lecturer sees a half-published session.

1. One file at a time, in the order given by the caller.
2. Before **every** PUT, `getFileSha()` re-reads the current `sha` — a cached sha
   from two seconds ago is stale by the time the next file commits.
3. A `409` triggers exactly one retry with a fresh sha, then the file is reported
   as failed instead of silently skipped.
4. **`data/version.json` is always published last**, so no device can ever read a
   new version number pointing at a session that has not landed yet.
5. `onFileStatus(path, ok, err)` paints progress; the callback returns
   `{ok, published, failed[], order[]}`.

Publishing writes `data/session.json`, `data/config.json`,
`data/elevenlabs-audio.json` and finally `data/version.json`; the version bump
carries the new `syncRev`, which is exactly what `checkForUpdates` watches.

**Preserved-file rule.** A deliberate publish legitimately changes
`data/session.json`. When that happens, update the `BUDGET`/`EXACT`/`PRESERVED_SHA`
tables in `tests/check.cjs` **and** Appendix A below in the same commit, then
rerun G1. Never hand-edit the payload itself. `data/elevenlabs-audio.json` is
app-written since v0.0.1.d and is therefore budgeted, not hash-frozen (D-UI11).

---

## R8 — `data/config.json` preserved payload

Must keep, untouched: `credits`, `tts`, `voice`, `live` (ntfy state/community/inbox),
`repoOwner: "dictationb1"`, `repoName: "dictationb1.github.io"`,
`encVault: "SDP_ENC_V2:AAA="`, `defaults`, `classInfo`,
`voiceId: "Xb7hH8MSUJpSbSDYk0k2"`, `voiceName: "Alice"`,
`modelId: "eleven_flash_v2_5"`.

Only `ver: 3`, `appVersion: "0.0.1.d"`, `version: "0.0.1.d"`, `schema: 3`,
`settingsRev: 3` are ours to change.

---

## Appendix A — Preservation locks (this release)

```
e0e86c807fc667475dad43de7848d3b231642c99f913bdab8c48e24834b86a5f  data/session.json                 46,403 B
591b9b086f6d3723afb2604a837ffc495c69a481c490f11e58131c2222b0981e  data/gas-source.txt              13,764 B
23f1503e1e75413903dff05f4415f59d4b903cfeb2a8d1c0047ac158d20ff280  assets/fonts/NotoSansSinhala-Regular.woff2  48,520 B
bf59c1487b0a88a07a678190fd7a6e93aa01c5ec3f3f2f9e349922ac944a643e  assets/fonts/NotoSansSinhala-Bold.woff2     48,748 B
```

Verify at any time with:

```bash
shasum -a 256 -c /tmp/sdp-preserve.sha256   # phase manifest
node tests/check.cjs                        # G1, same table baked in
```

`data/elevenlabs-audio.json` left this table in v0.0.1.d: the Lecturer Studio
rewrites it on every publish, so a frozen hash was a publishing bug waiting to
happen. It is now capped at 2,500,000 B and its header (`version`, `appVersion`,
`ver`, `schema`, `voiceId`) is asserted by G1 and G9.6g.

`data/session.json` content contract: `lists[0]` = `list_session_8_feelings`
(30 words, `w/p/pos/m/si/s/audio`), `lists[1]` = `list_session_7_travel`
(30 archived words), plus `plan`, `session` metadata and `pastSessions`.

---

## Appendix B — Gate-to-contract map

| Gate | Contracts asserted |
| --- | --- |
| G1 | H1 budgets, W3 ES5, R9 byte-identical `/data`, Appendix A, retired ids |
| G2 | R1, R5 (vault), R4 (migration), R2 (reconciliation), R7 (payload shapes) |
| G3 | R4 (corruption + migration), R5 (PIN lockout), R2 (guide), R5/R6 grading, W7 (language purity) |
| G4 | Preserved Apps Script backend (`data/gas-source.txt`) — seven behaviour tests unchanged |
| G5 | R3 (header 54px, single screen), R4 (input law), R5 (ring colours), R9 (toast) |
| G6 | R6 (cache purge → `sdp-v0.0.1.b-shell`, preserved caches, single reload, offline shell) |
| G7 | R2 (journeys), R5 (self-check + retry), R4 (legacy migration), R8 (settings order) |
| G8 | R2 (two-device propagation without touching progress), R7 (publish) |
| G9 | R5 (audio tiers, beat text, one-utterance `say`, same-element replay) |
| G10 | R4 (one professor voice, male-name blacklist), R3 (Guide 2.0 step machine, 600 ms watchdog, `#guideTapBanner`) |
| G11 | R5 (`SDP_ENC_V2` 16B salt ‖ 12B iv, 250k PBKDF2), R6 (sequential publish, `version.json` last, fresh sha, one 409 retry), W6 (no PIN in any body or URL) |
| G12 | W5 (no gate touches the billing endpoint), R9 (EN + SI strings), studio widgets `#pinPad`/`#btnTestElKey`/`#btnTestGhToken`/`#btnCommitClip` |

---

## R11. Publish chunk budget is measured in BYTES

Apps Script cells are limited to 40,000 **bytes**, not characters. Sinhala is
three bytes per glyph in UTF-8, so a chunk that looks safe by `.length` can be
33% over budget. `Sync.publishWordsChunked` therefore accumulates
`utf8Encode(line).length` and closes a chunk before it would exceed the limit.
The regression test builds 300 Sinhala-heavy words and asserts every chunk is
under budget (`tests/upgrade.test.cjs`, "R7: GitHub Contents payload").

## R12. Five keys, no probe

The store layer must never write a key just to test writability. Capability is
detected by shape (`typeof localStorage.setItem === 'function'`); every write is
individually wrapped in `try/catch` and returns `false` on failure. `tests/audit-v42.cjs`
(G9.5c) and `tests/upgrade.test.cjs` (R1) both fail the build if a sixth key
appears in the source.

---

**Credits — preserved verbatim, EN and SI.**
`CREDITS GOES TO Hansana` ·
Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu) ·
නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini

---

## R11 — v0.0.1.d: the guaranteed classroom settings contract

### R11.1 `config.classSettings` (the ten keys the lecturer owns)

```json
"classSettings": {
  "mode": "paper", "writeSecs": 8, "repeats": 3, "pauseSecs": 1.5,
  "autoAdvance": true, "pacingPreset": "standard", "voiceLock": "unified",
  "voiceSource": "auto", "rate": 0.95, "theme": "dark"
}
```

`SDP.Studio.saveClassSettings()` copies those ten keys out of
`SDP.Data.settings()`, bumps `settingsRev`, stamps `syncRev = Date.now()` and
commits `data/config.json` then `data/version.json` (always last) through
`SDP.Sync.publishFilesSequential`.

### R11.2 Adoption (SYNC-01, SYNC-02)

`sdp.settings.appliedSettingsRev` defaults to `0`. Whenever
`remote.settingsRev > appliedSettingsRev` — including the very first boot —
`SDP.Sync.adoptRemoteSettings()` copies the ten keys from `classSettings`
(falling back to `defaults`), **overrides `touchedKeys` for exactly those ten
keys**, clears them from `touchedKeys`, stores the new `appliedSettingsRev`,
calls `SDP.Engine.applySettings()` + `SDP.Views.renderAll()` and fires
`sdp:teacher-updated` (`{ settingsRev }`), which the UI shows as
`📡 Synced teacher's latest classroom settings (Rev #N)`.

Personal keys `lang`, `guideAutoPlay`, `volume`, `hints` and the whole
`sdp.progress` payload are never written by an adoption.

### R11.3 The 30 s pointer read (SYNC-05)

`SDP.Sync.startWatch(30000)` polls **only**
`https://raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/data/version.json?t=…`
(falling back to `./data/version.json`). A full `checkForUpdates()` — the only
path that touches `api.github.com` — runs only when `syncRev`, `settingsRev` or
`appVersion` moved, on `visibilitychange`, on a manual `#syncBadge` tap, or
while the Studio resolves its vault envelope.

### R11.4 PIN gate (SEC-01..04)

`data/config.json` ships:

```json
"pinVerifier": { "algo": "PBKDF2-SHA256", "iterations": 250000, "salt": "…", "hash": "…" }
```

for the bootstrap lecturer PIN `78987898`. While locked, the Studio renders only
`#studioPin`, `#pinDots`, `#pinPad` (12 keys, 56 px), `#studioMsg` and the
ask-your-lecturer hint. When `encVault` is the placeholder `SDP_ENC_V2:AAA=`
the PIN is proved against `pinVerifier`; otherwise the real envelope is
decrypted with `Vault.decryptV2()`.

Brute force is bounded by `sdp.settings.vaultLock = { fails, lockUntil, strikes }`:
5 wrong attempts → 60,000 ms lock; a second offence (`strikes >= 2`) → 300,000
ms. The value lives in `localStorage`, so a reload never clears it.

### R11.5 Voice tiers (VOX-04, rewritten in v0.0.1.e by D10)

`voiceLock === 'unified'` (default) and `voiceSource !== 'custom'` →
`resolveTiers()` returns lecturer clip → Alice clip → **`neural_tts` only when a
verified Tier-1 Neural UK Female voice is present (score ≥ 100 and
`getVoices().length > 0`)** → dictionary (`dict.youdao.com` type=1, real human
British recording) → browser TTS **last**. v0.0.1.d excluded the dictionary tier
entirely and left Brave (0 voices) silent; the real human recording now always
precedes low-quality synth. Explicit `custom` keeps the d behaviour.

---

## R13 — v0.0.1.e: honest sync, migration and the one publish clock

### R13.1 Never-red dual-source version check (D1, D5, D17)

`checkForUpdates(cb)` reads `./data/version.json?t=<ms>` (same-origin, Source 1)
and, if that fails, `raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/data/version.json`
(Source 2). **Either HTTP 200 resolves `cb(null, { ok: true, … })`; the badge
goes red only when both sources fail.** `api.github.com` is never polled by
students — it stays token-only Studio access. `cb(err, result)` fires exactly
once per check; one shared `Views.handleSyncCheckResult(err, result)` composes
the badge/toast, and the 30 s watch tick plus `visibilitychange` both feed it.

### R13.2 Service worker origin gate (D2)

The `fetch` handler's FIRST check is the origin: only same-origin requests and
`dict.youdao.com/dictvoice` audio are ever intercepted — everything else
(including `api.github.com` and `api.elevenlabs.io`) passes straight through.
Data reads (`data/*.json`): 10 s network-first with `cache: 'reload'`, a clean
path cache put (never a `?t=` URL), an `ignoreSearch` cache fallback, and an
honest 503 JSON offline page. `activate` purges retired `sdp-*` caches and every
stale `?t=` entry, preserving `sdp-youdao-v1` and `sdp-audio-clips`.

### R13.3 One-time language migration (D7, R3)

`defaultSettings().lang` is `'en'`. On boot, while `sdp.settings.langResetV001e`
is falsy, `Data.settings()` forces `lang: 'en'` once, sets
`langResetV001e: true` **inside** `sdp.settings` (never a sixth top-level key)
and persists. `lang` is NOT in `CLASS_SETTING_KEYS`: a student's later choice is
personal and survives every class-settings adoption.

### R13.4 One publish clock + coherent payloads (D13, D19)

`Studio.nextSyncRev()` = `Math.max(Date.now(), prevSyncRev + 1)`. Every file of
one publish (config, session, voice pack, version) carries the SAME stamp;
`version.json` is committed last via `publishFilesSequential`. `saveKeys()`
ALWAYS recomputes `config.pinVerifier` from the salt already published in
`config.json` (fresh 16-byte salt only when no verifier exists) — the verifier
can never go stale after a PIN change. `session.clips` (word→clip URLs) survive
`buildSessionPayload()`, and `Studio.publishChecklist()` refuses a publish whose
words, envelope, verifier or syncRev are incoherent — in plain language.

## §R12 — v0.0.1.f verified adoption, one clock and the third vault slot

### §R12.1 `SDP.Sync.fetchFreshDataJson(relPath, cb)`

```
fetchFreshDataJson('data/version.json', function (err, result) {
  // err   — only when BOTH sources failed (never a red screen for one blocked host)
  // result.ok        === true
  // result.json      — the winning payload
  // result.source    — 'origin' | 'raw'
});
```

Both legs start in parallel: same-origin `./<relPath>?t=<ms>` with `cache:'no-store'`
and a 6 s timeout, and `raw.githubusercontent.com/dictationb1/dictationb1.github.io/main/<relPath>`
with a 5 s timeout. The higher `payload.syncRev` wins; `raw` breaks an exact tie. A
failed leg can never win, so a Brave-Shields-blocked CDN still delivers the truth.

### §R12.2 Payload verification (the load-bearing rule)

For every publish tick, the winning `version.json` defines `targetSyncRev`. A payload
leg is usable only when `Number(json.syncRev) >= targetSyncRev`, **or** — for
`data/session.json` only — it is the preserved classroom baseline: same session number
as the pointer and ≥ 30 words. A leg that fails this test is refetched once from the
other source; if it still fails, the result is

```
{ ok: true, error: 'stale_payload', changed: false, updated: false,
  deferred: true, retry: ['data/config.json', ...] }
```

and `SDP.Sync.state.version` keeps pointing at the last fully delivered publish. The
next watch tick retries the same publish, so nothing is silently skipped. `ok:false` is
reserved for "both version sources are unreachable".

### §R12.3 Adoption chain and beat deferral

`applyPayloads(version, config, session)` → `adoptRemoteSettings(cfg, settingsRev)` →
`SDP.Speech.reloadManifest()` → `SDP.Views.renderAll()` (alias `refreshAll`). When
`SDP.Engine.isActive()` is true (`listening`/`writing`) the chain is queued and replayed
by `SDP.Sync.flushDeferred()` at the end of the beat, so a lecturer publish never cuts a
word off mid-speech. `sdp:update` is dispatched for anything that listens outside the
core (Home badge, preset pill, Studio).

### §R12.4 One publish clock (W8)

`nextSyncRev() = Math.max(Date.now(), previous + 1)` is called exactly once per publish
path (`publishBundle()`, `publishWordsAndVoice()`, `sealVaultNow()`-driven vault save,
`saveClassSettings()`). The same integer is stamped into `session.json`, `config.json`,
`elevenlabs-audio.json` and `version.json`; `version.json` is committed last by
`publishFilesSequential()`, so a device that reads a new pointer can always fetch bodies
that belong to it.

### §R12.5 Third vault slot (`aiKey` / `aiProvider`)

`SDP_ENC_V2` now seals three secrets: `elevenKey`, `ghToken` and the free-AI pair
`aiKey` + `aiProvider` (`free_dict` | `groq` | `gemini` | `openrouter`). Nothing new is
written to disk: the ciphertext still lives in `config.encVault` and the local cache
inside `sdp.settings.cachedVault`. `config.json` never carries a key — only the
envelope and `pinVerifier`.

### §R12.6 Free enrichment contract

`SDP.Studio.enrichWords(wordsOrText, opts, cb)`:

* `free_dict` (default, zero keys) → `api.dictionaryapi.dev` (`p`, `pos`, `m`, `s`) and
  `api.mymemory.translated.net?langpair=en|si` (`si`);
* `groq` / `gemini` / `openrouter` → one batch JSON call for the whole list, validated
  row by row;
* every path ends in the deterministic offline B1 lexicon, so a dead tower still
  yields a complete six-field record (`enrichSource:'lexicon'`);
* it never calls ElevenLabs — extraction and synthesis are separate concerns (W5).

### §R12.7 Defaults and the one-time migration

`lang:'en'`, `pacingPreset:'exam'`, `writeSecs:5`, `repeats:2`, `voiceLock:'unified'`,
`voiceSource:'auto'`, `rate:0.95`. On the first read after upgrading, `sdp.settings`
gains `defaultsResetV001f:true`, the seven defaults above are re-applied once and the
`touchedKeys` entries for `pacingPreset`/`writeSecs`/`repeats`/`voiceLock` are cleared.
No sixth localStorage key is ever created (W4).

---

## R13 — v0.0.1.h: Rule 1A, Rule 1B, Layer 1 and the session trap

### R13.1 Rule 1A — the key ladder (D1, D2)

`SDP.Studio.fetchSubscription(key, cb)` never invents a failure. Three rungs, in order:

1. `GET /v1/user/subscription` → 200 → the real quota (`{ok:true, remaining:(character_count,character_limit)}`).
2. Subscription refused (401/403/404/429) → probe `GET /v1/voices`. Anything 200 means the
   key is real but scoped → `{ok:true, scoped:true, remaining:null, note:SCOPED_NOTE}`.
3. Probe also failed → accept the key when `looksLikeElevenKey(key)` (format check only) →
   same scoped verdict, so a free-tier key on a locked-down network still gets green.

Only `detail.status === 'invalid_api_key'` (HTTP 401) is fatal, and it is the only path
that paints red. `quotaError()` translates every other status into a sentence a teacher
can act on; the literal string `subscription_failed` can never reach the DOM (G11.10d).

### R13.2 Rule 1B — one-click master setup (D3, D4)

```
step 1  merge inputs → sealVaultNow → writeLayerOne → testGitHubToken   ← the ONLY fatal step
step 2  checkQuota(elKey)                                              ← advisory, always proceeds
step 3  generateClips({force, noCommit:true})  guide 1–4 + up to 30 words
step 4  injectClips → publishBundle() → 4 files, ONE nextSyncRev(), version.json LAST
```

A 401/402/403/429 *inside* clip generation is a tier status, not an error: the clips
already produced are kept, the rest are marked skipped, `ST.tierWarn = TIER_WARN()` is
shown, and the run resolves into step 4 so the four files still publish (G11.11a–g).
`G11` also proves the paid endpoint is never called by a test — the stub answers any
`elevenlabs.io` URL that is not `/v1/user/subscription` or `/v1/voices`.

### R13.3 Layer 1 — the vault inside `sdp.settings` (D5, D8, D9)

`sdp.settings.vaultLock` is the second copy of the envelope: a **plain object** with
`{fails, lockUntil, strikes, until, encVault, pinVerifier, updatedAt}`. It is written by
`setup`, `saveKeys`, `unlock` (on success) and `writeLayerOne()`, and read by
`healFromLayerOne()` at boot, inside `resolveEnvelope()` and in `unlockWithVerifier()`.

Self-heal rule: when Layer 1 holds a real `SDP_ENC_V2:` envelope, its `updatedAt` is newer
than the config record, or the config record is the template placeholder
(`SDP_ENC_V2:AAA=`), then `encVault` + `pinVerifier` are copied into the config record and
the vault survives a release that reset `data/config.json`. Unlocking then decrypts the
healed envelope with the PIN, so `ST.secrets` is filled instead of `{}` (G11.12a–i).
Layer 1 is still *inside* `sdp.settings`: the five-key law in R4 is untouched (G11.12d).

### R13.4 Config-sovereign adoption (D15) and the session trap (D16, D17)

`settle()` weighs three legs. The session leg no longer has veto power:

* config verified → adopt `version.json` + `config.json`, apply `classSettings`, advance the
  pointer, and report `deferredSession:true` when the session leg failed;
* config failed → adopt nothing (`stale_payload`), so a half-published tree can never brick
  a device.

`verifyPayloadLeg('session')` accepts a payload that proves the pointer (`syncRev`), a
matching session number with at least one word (D16), or the same active list by
`id` + `words.length` + `updatedAt`. Because any of those proves the payload, a test that
wants a rejection must send a 0-word list or a different session number (G11.15a–d).

`needSession` is false only when the session number is unchanged **and** `payloadFiles`
names no session file (D17, legacy headers excluded) and no device state asked for a
retry. A settings-only publish therefore costs 3 small requests and never re-downloads the
46,403 B `data/session.json` (G11.13a–d). A device that lost its session still pulls it on
the next tick because `state.deferredSession` survives the adoption (G11.14c).

### R13.5 The publish contract did not move

`publishFilesSequential()` is unchanged: fresh SHA → PUT → await → next file, exactly one
409 retry, `data/version.json` committed last, one `nextSyncRev() = max(Date.now(), prev+1)`
across all four files (G11.11c–e). A locked Studio still refuses to publish at all.
