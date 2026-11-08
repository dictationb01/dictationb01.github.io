# DAILY_UPGRADE_PROMPT_TEMPLATE — v0.0.1.a → next

Copy the block below into a fresh session, fill the three `<<…>>` slots, and the
agent has everything it needs: the contracts, the budgets, the preservation lock
and the gate order. Nothing else has to be explained.

---

## v0.0.1.d — 2026-11-01 — the twelve-gate release

Prompts written against v0.0.1.b asked for **eight** runtime gates and a
48,000 B `sdp-data-sync.js`. Both numbers are wrong now. Copy these lines into
any new upgrade prompt instead:

- The suite is **twelve gates, G1–G12**; `tests/check.cjs` (G1) fails if any of
  `voice-guide.cjs`, `vault-sync.cjs` or `studio-safety.cjs` is missing.
- Budgets: `index.html` 35,000 · `sdp-ui.css` 60,000 · `sdp-data-sync.js` 65,000 ·
  `sdp-audio-speech.js` 48,000 · `sdp-dictation-engine.js` 58,000 ·
  `sdp-ui-views.js` 110,000 · `studio.js` 85,000 · `data-meter.js` 22,000 ·
  `data.html` = `data/index.html` 60,000 · `sw.js` 12,000 · `docs/*.md` 40,000
  (this template 18,000).
- **Never** call `/v1/text-to-speech` from a gate, test, script or probe. The only
  live TTS is a human click on `#btnGenClips` / `#btnTestOneWord` in
  `data/studio.js`; G12 fails the release if a test file even mentions the path.
- `data/elevenlabs-audio.json` is **app-written** (D-UI11): budget it, never
  hash-freeze it.
- Credit lines are verbatim in EN *and* SI on Home, About and `/data`:
  `CREDITS GOES TO Hansana` ·
  `Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu)` ·
  `නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini`.

---

## v0.0.1.e — 2026-11-02 — the honest-sync release

Copy these extra lines into any upgrade prompt written against **v0.0.1.e**:

- The version check is **never-red dual-source**: same-origin `./data/version.json?t=`
  first, then `raw.githubusercontent.com`; either 200 is `ok: true`. Students
  never poll `api.github.com` (token-only Studio use).
- The unified voice ladder is lecturer → Alice → (verified Neural UK Female) →
  **dictionary human British audio** → TTS last, with an 800 ms word watchdog
  and a 700 ms guide watchdog driven by the real `utter.onstart` flag.
- Fresh devices boot `lang: 'en'`; the one-time `langResetV001e` flag lives
  inside `sdp.settings` and `lang` is never a class key.
- Every publish stamps ONE monotonic `syncRev = Math.max(Date.now(), prev + 1)`
  into config/session/voice-pack/version; `version.json` commits last.
- Home is a Bento grid at ≥ 1024 px (7fr/5fr, credits full-row) with 28 px
  `.step-badge` journey numbers and four rich `.practice-card` buttons.

---

## The template

```
ROLE: upgrade engineer for Smart Dictation Player, CCBE Galle Branch B1 class.

TASK: ship version <<NEW_VERSION>> (from <<OLD_VERSION>>) without breaking a
single classroom byte.

HARD RULES
1. Read docs/ARCHITECTURE_MAP.md, docs/SYNC_AND_DATA_CONTRACT.md and
   docs/UI_COMPONENT_GUIDE.md before editing.
2. Preserve read-only: data/session.json, data/gas-source.txt,
   data/elevenlabs-audio.json, assets/fonts/NotoSansSinhala-{Regular,Bold}.woff2.
   Verify with: shasum -a 256 -c /tmp/sdp-preserve.sha256
   (recreate the manifest first if /tmp was wiped).
3. Strict ES5 only in shipped JS: var, function(){}, no let/const/arrow/
   template literals/class/async/destructuring/for..of. No bundler, no minifier,
   no runtime CSS injection.
4. Respect every H1 byte budget in docs/ARCHITECTURE_MAP.md §1 and
   tests/check.cjs BUDGET. Never add an unbudgeted shipped file.
5. UI strings change only in STRINGS_EN and STRINGS_SI (data/sdp-ui-views.js).
   EN mode = zero Sinhala in chrome; SI mode = all chrome in natural Sinhala,
   proper nouns and IPA untouched.
6. Gate files (tests/*.cjs) change only in commits prefixed `gate-align:`.

THE CHANGE
<<DESCRIBE THE CHANGE IN 1-5 SENTENCES: what the student sees, which screen,
which words, which behaviour.>>

VERSION BUMP
- data/version.json: appVersion/version = <<NEW_VERSION>>, buildDate = <<DATE>>,
  updatedAt = <<ISO>>, syncRev = <<NEW_SYNC_REV>>
- index.html boot target and data/sdp-data-sync.js APP_VERSION/SDP.version
- sw.js SW_VERSION = 'sdp-<<NEW_VERSION>>', SHELL_CACHE = 'sdp-<<NEW_VERSION>>-shell'
- manifest.webmanifest description/start_url
- data/config.json: only ver/appVersion/version/schema/settingsRev

DONE MEANS
  shasum -a 256 -c /tmp/sdp-preserve.sha256
  node tests/check.cjs
  node --test tests/upgrade.test.cjs
  node tests/phase1.cjs
  node tests/server.cjs
  node tests/browser.cjs
  node tests/upgrade-browser.cjs
  node tests/e2e.cjs
  node tests/live-lab.cjs
  node tests/audit-v42.cjs
all exit 0 with 0 FAIL, then append a CHANGELOG_LEDGER.md block with the real
byte counts and PASS counts, and merge to main with --no-ff.
```

---

## Worked example — a real `0.0.1.a → 0.0.1.b` change

**Goal:** give the student a "slow replay" button that re-plays the current word
at 0.72× without restarting the beat.

### 1. Find the owners

- Button markup → `index.html` (cockpit controls block).
- Colour/space → `assets/css/sdp-ui.css` (`.btn` variants).
- Behaviour → `data/sdp-dictation-engine.js` (`repeatWord()` lives there).
- Rate override → `data/sdp-audio-speech.js` (`playWord(word, {rate})`).
- Labels → `data/sdp-ui-views.js` (`STRINGS_EN.slowReplay` / `STRINGS_SI.slowReplay`).

### 2. Make the change (ES5)

```html
<!-- index.html — inside .cockpit-controls, after #btnRepeat -->
<button id="btnSlow" type="button" class="btn" data-i18n="slowReplay">Slow replay</button>
```

```js
// data/sdp-dictation-engine.js — next to repeatWord()
function slowReplay() {
  var item = current();
  if (!item || !SDP.Speech) return;
  SDP.Speech.playWord(item.word, { rate: 0.72 }, noop);
}
// …and in bind(): ['btnSlow', slowReplay],
```

```js
// data/sdp-ui-views.js — both tables, same key
// STRINGS_EN: slowReplay: 'Slow replay',
// STRINGS_SI: slowReplay: 'සෙමින් නැවත අසන්න',
```

### 3. Bump the version (five files, no more)

| File | Edit |
| --- | --- |
| `index.html` | `var TARGET = '0.0.1.b';`, `#sdpVerPill` text |
| `data/sdp-data-sync.js` | `APP_VERSION`, `SDP.version` |
| `sw.js` | `SW_VERSION`, `SHELL_CACHE` |
| `data/version.json` | `appVersion`, `version`, `buildDate`, `updatedAt`, `syncRev + 1` |
| `manifest.webmanifest` | description, `start_url` query |

`data/config.json` still only changes `ver/appVersion/version/schema/settingsRev`.

### 4. Prove it

```bash
shasum -a 256 -c /tmp/sdp-preserve.sha256     # 5 × OK
node tests/check.cjs                          # G1: budgets + ES5 + docs
node --test tests/upgrade.test.cjs            # G2: constants + vault
node tests/phase1.cjs                         # G3: jsdom behaviour
node tests/server.cjs                         # G4: backend 8/8
node tests/browser.cjs                        # G5: 54px header, ring, toast
node tests/upgrade-browser.cjs                # G6: cache purge + reload once
node tests/e2e.cjs                            # G7: student journeys
node tests/live-lab.cjs                       # G8: two-device sync
node tests/audit-v42.cjs                      # G9: audio tiers + utterances
```

If `#btnSlow` pushes `index.html` past 35,000 B, delete something — a budget is a
ceiling, not a suggestion.

### 5. Ledger + merge

Append to `docs/CHANGELOG_LEDGER.md`:

```md
## v0.0.1.b — 2026-11-__ — Slow replay

| File | Bytes | Δ | Gate |
| --- | --- | --- | --- |
| index.html | 20,4xx | +1xx | G1 |
| data/sdp-dictation-engine.js | 26,5xx | +2xx | G3, G9 |
| data/sdp-ui-views.js | 52,5xx | +2xx | G3 |

Gates: G1 51/0 · G2 30/0 · G3 xx/0 · G4 8/0 · G5 22/0 · G6 6/0 · G7 12/0 · G8 16/0 · G9 10/0
Preservation: 5/5 OK
```

```bash
git commit -m "v0.0.1.b: slow replay at 0.72x in the cockpit"
git push origin <branch>
gh pr merge <n> --merge --delete-branch   # or: git merge --no-ff
```

---

## Fast answers

- **A gate fails on bytes** → the budget table and this doc are the contract; trim
  the change, do not raise the budget. Raising a budget is a `gate-align:` commit
  with a one-line justification.
- **A gate fails on Sinhala** → you added a string to one table only. Both tables,
  same key, every time.
- **You need a new file** → add it to `docs/ARCHITECTURE_MAP.md` §1, add a BUDGET
  row in `tests/check.cjs`, then ship it.
- **The lecturer published a new session** → `data/session.json` bytes changed on
  purpose; update `BUDGET`/`EXACT`/`PRESERVED_SHA` in `tests/check.cjs` and
  Appendix A, rerun G1, and note it in the ledger.
- **Never** re-introduce a retired id (`bgLiveVideo`, `dataSheet`, `screen-comm`, …)
  or a floating credit badge over the player.

---

## Appendix — v0.0.1.a additions to quote verbatim

- Publish chunks are measured in **bytes** (`utf8Encode(line).length`), never
  `String.length`; Sinhala is 3 bytes per glyph.
- The store layer writes **five keys only** — no `__sdp_probe__`, no capability
  test writes.
- Typing mode submits on **Enter** in either listening or writing phase.
- Settings is **six** sections; `#aboutCard` is fifth, `#studioAccordion` last.
- The About card repeats the exact credit line; credits are never a fixed badge.
- An empty bank shows `#bankEmpty`, disables Start and prints `—` for mastered.
- `/data` back link is `../index.html` (works from `/data.html`, `/data/` and `/data/index.html`).
- Exactly one `<style id="sdpCloak">` under 400 bytes may exist in `index.html`.
- All nine gates must print `0 FAIL`; the expected counts are
  71 / 10 / 61 / 8 / 44 / 15 / 48 / 26 / 46 = **329 assertions** (≥ 325 required).

## v0.0.1.d — 2026-11-01 — the 12-gate, PIN-gated, class-synced release

**PIPE-03 correction.** Earlier revisions of this template claimed that G1
(`tests/check.cjs`) asserts the existence of `tests/voice-guide.cjs`,
`tests/vault-sync.cjs` and `tests/studio-safety.cjs`. That claim was true only
for the file list; from v0.0.1.d the assertion is real:

```js
['voice-guide.cjs', 'vault-sync.cjs', 'studio-safety.cjs'].forEach(function (f) {
  record('G10–G12 exists: tests/' + f, exists('tests/' + f));
});
```

`tests/package.json` (`scripts.gates`) and `.github/workflows/checks.yml` both
chain **all twelve** gates now, and CI no longer SHA-pins the app-written
`data/elevenlabs-audio.json` (PIPE-02).

| Gate | Command | Contract |
| --- | --- | --- |
| G1 | `node tests/check.cjs` | budgets, ES5, `/data` parity, G10–G12 existence |
| G2 | `node --test tests/upgrade.test.cjs` | constants, `SDP_ENC_V2`, publish payloads |
| G3 | `node tests/phase1.cjs` | jsdom behaviour: PIN gate, classSettings, quick guide |
| G4 | `node tests/server.cjs` | config metadata + Apps Script loader |
| G5 | `node tests/browser.cjs` | layout, routing, focus law, 48 px targets |
| G6 | `node tests/upgrade-browser.cjs` | SW upgrade, cache purge, single reload |
| G7 | `node tests/e2e.cjs` | student journeys incl. guide skip |
| G8 | `node tests/live-lab.cjs` | two-device classSettings propagation |
| G9 | `node tests/audit-v42.cjs` | audio tiers, unified lock, repeat-safe deadline |
| G10 | `node tests/voice-guide.cjs` | activeUtter GC guard, 10 s keepalive, Guide 2.0 |
| G11 | `node tests/vault-sync.cjs` | pinVerifier, saveKeys publish, persisted lockout |
| G12 | `node tests/studio-safety.cjs` | credit-saver delta + locked-studio zero widgets |

Every gate must print `0 FAIL`; the release commit records the counts in
`docs/CHANGELOG_LEDGER.md`.

**HARD RULE (W5).** No gate, test, script or probe may ever call
`https://api.elevenlabs.io/v1/text-to-speech/...`. Only a human tapping
`#btnGenClips` or `#btnTestOneWord` inside the PIN-unlocked Studio may spend a
credit. G12 fails the release if any test file contains a live TTS call.

## v0.0.1.f upgrade prompt (copy/paste block, 2026-11-02)

```
Upgrade dictationb1/dictationb1.github.io from v0.0.1.e to v0.0.1.f in one autonomous pass.
Target: ver 6, schema 6, settingsRev 6, appVersion 0.0.1.f, release syncRev 1793590000000,
buildDate 2026-11-02.

R1/R2  SDP.Sync.fetchFreshDataJson(relPath, cb) — same-origin (6 s, no-store) vs raw (5 s);
       higher syncRev wins, raw breaks ties, one retry on the alternate source, never
       advance state.version on an undelivered leg. Wire checkForUpdates(), the Speech
       manifest loader and Studio.loadVoicePack() onto it.
R3     Defaults = en / exam / 5 s / 2x / unified / auto / 0.95, plus the one-time
       defaultsResetV001f migration INSIDE sdp.settings (five-key law intact).
R4     PIN 78987898, PBKDF2-SHA256 x 250k, inputs maxlength=12 minlength=4, 12-key pad,
       dots min(12, max(8, len)), scrub the retired PIN everywhere.
R5     Locked Studio = PIN-only DOM; #btnLockStudio in the unlocked header; auto-lock on
       pagehide / beforeunload.
R6     Engine.isActive()/pause(reason)/resume() with status, pausedPhase, remainingMs,
       repeatsDone, pauseReason and an exact beat-preserving resume.
R7     applyPayloads -> adoptRemoteSettings -> Speech.reloadManifest -> Views.refreshAll,
       beat deferral, 25 s watch + focus listener, sdp:update repaint.
R8     Third vault slot aiKey/aiProvider (free_dict default, groq/gemini/openrouter) and
       Studio.enrichWords() — dictionaryapi.dev + mymemory en|si + offline B1, never TTS.
R9     Speech.injectClips()/reloadManifest(), #btnOneClickMasterSetup 4-step tracker,
       900 ms #guideAutoplayBanner, ONE nextSyncRev() per publish, version.json last.
R10    Version bump in version.json, config.json, elevenlabs-audio.json, sw.js, manifest,
       #sdpVerPill, About, and byte-identical data.html == data/index.html.

Hard gates: 12 gates 0 FAIL, shasum -a 256 -c 4/4 OK, data/session.json byte-identical,
zero occurrences of the retired PIN, verbatim EN + SI credit lines, all five docs updated.
```

### Sequencing that worked

1. Bump the payload headers first (`version.json`, `config.json`, `elevenlabs-audio.json`,
   `sw.js`, manifest, `#sdpVerPill`, About, `data.html` pair) so G1's literals can flip.
2. Land the data/sync contract (`fetchFreshDataJson`, verified legs, one clock), then the
   engine pause/resume, then the views affordances, then the Studio cards.
3. Update the gate literals in a dedicated `gate-align: v0.0.1.f` commit — budgets,
   version literals, guide stamps, `appliedSettingsRev` pins, PIN string.
4. Re-run all twelve gates, write the real numbers into `CHANGELOG_LEDGER.md`, then
   `shasum -a 256 -c` the four preserved payloads and merge `--no-ff`.

### Traps seen last time

* `defaultsResetV001f` overwrites any seeded pacing — test seeds that pin their own
  `writeSecs`/`repeats` must also seed `defaultsResetV001f:true`.
* a bumped `settingsRev` re-adopts `classSettings`; raise the test's `appliedSettingsRev`
  to the release value when the test pins its own pacing.
* `enrichWords()` must decide what needs enrichment from the *provided/prior* record, not
  from the merged fallback, otherwise the lexicon short-circuits the dictionary call.

## v0.0.2.a upgrade prompt (copy/paste block, 2026-11-02)

```
Upgrade dictationb1/dictationb1.github.io from v0.0.1.i to v0.0.2.a in one autonomous pass.
Target: appVersion/version 0.0.2.a, ver 10, schema 10, settingsRev 16,
syncRev 1793615000000, buildDate 2026-11-02, TARGET '0.0.2.a',
SW sdp-v0.0.2.a / sdp-v0.0.2.a-shell.

P1  54px tactile buttons (.btn-h, --shadow-btn, --grad-primary, --grad-go) and amber .cue callouts.
    .btn 54px/700/1.5px border, :active translateY(2px) + no shadow, .btn-sm 48px,
    .btn-ghost dashed, .badge flat #A1A1AA. Every new class needs a rule in sdp-ui.css
    (W3: never a runtime <style>).
P2  A sixth screen: #screen-studio + #tab-studio + #rail-studio. Settings stays
    student-only (5 sections + #aboutCard + #settingsLecturerBanner); #studioAccordion,
    #studioBody and the three studio cards live only in #screen-studio. Locked studio is
    strictly PIN-only: 12-dot #pinDots (8 visible digits max), 56px 12-key #pinPad.
P3  One-click 34-clip workflow: #studioPackDashboard X/34 (clipCount()), #studioGenProgress
    "Generating clip n/N · key · chars used", #btnRetryFailedClip doing a delta retry
    through queueFor(words, singleTest, keys) so a saved clip is never re-billed.
    #btnOneClickMasterSetup is the primary CTA (data-primary-cta), #btnSaveKeys is ghost.
P4  Cockpit: 30-pill #sessionProgressStrip/#sessionPills (done/current/todo, click jumps),
    4-button transport (⏮ Prev (#k) / ⏸ Pause Dictation / ▶ Resume Word #k / 🔇 Replay Word
    / ⏭ Next (#k)), verbatim phase lines "Listen Carefully (Repeat n of m)…",
    "Write Word #k in Your Book! (Ns countdown)", "Dictation Paused at Word #k (Repeat n of
    m) — Press Resume Below", giant #resumeBanner, ordered #01..#30 word sheet with
    ✓ Correct / ✗ Needs Practice writing sdp.progress.mastered + weakWords.
P5  Guide 3.0: four voice-transition cards with animated previews (guideMockMarkup(),
    .active-step, sdpRing), footer CTA "▶ Start Dictation Now", stamp follows APP_VERSION.
P6  Ledgers: ARCHITECTURE_MAP §1 budgets + §H2 ids, this template, CHANGELOG, sync
    contract (schema 10) and UI guide (tactile tokens) updated in the same release.

Legal: config.encVault/config.pinVerifier never rewritten; five localStorage keys;
strict ES5, no build step; /v1/text-to-speech only from a human click; version.json last.

Hard gates: 12 gates 0 FAIL — G1 109, G2 12, G3 100, G4 8, G5 60, G6 15, G7 52, G8 39,
G9 47, G10 26, G11 74, G12 94 = 636 assertions; preserved SHA-256 4/4; merge to main.
```

## v0.0.2.b upgrade prompt (copy/paste block, 2026-11-02)

```
Upgrade dictationb1/dictationb1.github.io from v0.0.2.a to v0.0.2.b in one autonomous pass.
Target: 0.0.2.b, ver 11, schema 11, settingsRev 17, syncRev 1793620000000, SW sdp-v0.0.2.b.
P1 Stamp every surface. P2 speechEpoch + stopAll() + screenIsCovered(). P3 guideRunId,
#guideSpot, #symbolDeck. P4 guard enterListening. P5 #btnChangePin -> saveKeys().
Hard gates: 12 gates 0 FAIL; shasum 4/4 OK.
```

## v0.0.3 upgrade prompt (copy/paste block, 2026-11-03)

```
Upgrade dictationb1/dictationb1.github.io from v0.0.2.b to v0.0.3 in one autonomous pass.
Target: appVersion/version 0.0.3, ver 12, schema 12, settingsRev 20,
syncRev 1793654400000, TARGET '0.0.3', SW sdp-v0.0.3 / sdp-v0.0.3-shell.

P1 Ghost voice: speechEpoch on every async chain, stopAll() bumps it, named timers,
   playUrl.finish(); sayCue('cmd.paused', true) is the only pause-permitted cue.
P2 Cue chain: cmd.preparing -> num.N -> word x repeats -> 5 s write -> cmd.complete.
P3 Guide 4.0 spotlight: #guideSpotlight/#guideStepTag/#guideStepText/#guideDots,
   exactly #btnGuideSkipStart + #btnGuideClose; no watchdog, no tap-restart loop.
P4 Glyph transport deck + aria-labels; #sessionProgressCount/#playerPresetBadge.
P5 Studio: Words card first, #btnVerifyEleven, #btnChangePin atomic re-seal,
   BOOTSTRAP_PIN master recovery (Studio.recoveryMode()).
P6 Charlotte XB0fDUnXU5powFXDhCwa / eleven_flash_v2_5, 70 clips (829 chars), sha1Hex hash.

Legal: five localStorage keys; strict ES5 (G1/acorn); credits verbatim EN+SI;
preserved SHA-256 4/4 (session.json c06e197c..., gas-source.txt, both fonts).
Hard gates: 12 gates 0 FAIL — G1 109, G2 12, G3 102, G4 8, G5 60, G6 15, G7 52, G8 39,
G9 47, G10 38, G11 74, G12 94 = 650 assertions.
```

## v0.0.6.s (ver 33) — SHA-256 verification stamp — 2026-11-07

Built in the release tree: Hard Full-Briefing (All 4 Paragraphs) Completion Gate Lock +
the 100% Authentic First-Person Creator Overview (zero false claims) + canonical text on
every system clip (no unlock synthesis race) + the SWR release-change overwrite guard.
appVersion 0.0.6.s, ver 33, schema 33, settingsRev 49, syncRev 1795000000000,
SW_VERSION `sdp-v0.0.6.s-s34`, studio.js 269035 B (cap 271000 B) — post-audit packedSystemClip patch,
elevenlabs-audio.json 4765314 B (cap 4900000 B).
LOCK-OK rows are the read-only classroom payloads pinned by PRESERVED_SHA in tests/check.cjs.

```
index.html                                    59713 B  3cd4deda8c344e72645fe0858bac403942d9f1d04c19f0548db667c24b13b680
data.html                                     29847 B  d373e07d0fcd7d864516fc5d5f3acc6151848425ea5fc88f4968c2c964b9781b
data/index.html                               29847 B  d373e07d0fcd7d864516fc5d5f3acc6151848425ea5fc88f4968c2c964b9781b
sw.js                                         16921 B  bc5d5cdcea2880675352b7787c75c7eb2e7334ecaed40d408815dc4c8208d10f
manifest.webmanifest                           1743 B  43382d0e8ada27a7dda3131124e234dcab27085d8a50c4a2dcb455fd94eaa2c8
assets/css/sdp-ui.css                        135328 B  0a81337b89987e677c79e5cfedad6e2daefb16c083c28332d911a3f481602cba
data/sdp-data-sync.js                        119893 B  6bf1d7e1a252ac6359fd9237dbc702c26f9b0c4f4cc34ff3157e2a586ef816bb
data/sdp-audio-speech.js                      81288 B  f570efcf8658e311e28f0a98ab7f9041614ae750f895fcc2a3958b0abde05658
data/sdp-dictation-engine.js                  68990 B  4fdad11617c5f845ee32abb74b1faf9e69c74f7385062a661d98ab64f34ebd86
data/sdp-ui-views.js                         261245 B  34211e8e69fd5a309a279fb5d08b613932a1cab29a7840208a53c1be584d24b9
data/studio.js                               269035 B  29dd5c5c5cdac733a79313ebeb679aa6fc72d788f0e3b6fc3b2c9bc8fa768679
data/data-meter.js                            22850 B  60381c6255825b4f3b1ccb2d963c0b16596d689476c136ebf42053ecd314e9bf
data/sdp-morphe-hooks.js                       6738 B  e0c4f4ab625dbf3787f760e2194e3ceef733a58b2932e6efbbd17ab8b87805ec
data/version.json                               379 B  81714e0ed50474c2ba0afaee483b4566a0eccb450bb6be998ce79425675f2934
data/config.json                              38828 B  fb403378b513db3dcdd54241d409bca9284ddee63f5ef360b44d3bee7524bdd6
data/session.json                             62427 B  931037f77f8bbbfe2e171b26b589a6fc7f2ffbc3b2811b9aa442331d2e01bba1  LOCK-OK
data/gas-source.txt                           13764 B  591b9b086f6d3723afb2604a837ffc495c69a481c490f11e58131c2222b0981e  LOCK-OK
data/elevenlabs-audio.json                  4765314 B  f9e595126998ffae917284c9215b3378d4f784a713e0e7765e741b2b5b2d952e
assets/fonts/NotoSansSinhala-Regular.woff2    48520 B  23f1503e1e75413903dff05f4415f59d4b903cfeb2a8d1c0047ac158d20ff280  LOCK-OK
assets/fonts/NotoSansSinhala-Bold.woff2       48748 B  bf59c1487b0a88a07a678190fd7a6e93aa01c5ec3f3f2f9e349922ac944a643e  LOCK-OK
```

Hard gates: 13 commands, 0 FAIL — G1 190, G2 14, G3 137, G4 8, G5 107, G6 15,
G7 58, G8 39, G9 47, G10 38, G11 74, G12 103, Lab 86 = 916 assertions.
