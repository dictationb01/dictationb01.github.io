# ARCHITECTURE_MAP — Smart Dictation Player v0.0.3

Audience: **CCBE Galle Branch — B1 English Class, Sri Lanka**
Lecturer in Charge: **Ms. Sumodya Sewmini** · Creator: **Hansana** · Concept: **Ayya01 (Lesandu)**

This file is the map of every shipped byte. Read it before touching anything; if
a change needs a new file, it needs a new row in §H1 and a new budget in
`tests/check.cjs` (gate G1), or the release fails.

---

## 1. File tree (H1 — every file, one owner, one byte ceiling)

| File | Budget | Owner / role |
| --- | --- | --- |
| `index.html` | ≤ 58,000 B | Shell: 54px header, **6 screens** (`home/player/practice/dict/settings/studio`), guide modal, `#resumeBanner`, toast, boot check, 6 deferred modules |
| `assets/css/sdp-ui.css` | ≤ 128,000 B | The single stylesheet (Zinc + Sky flat matte, v0.0.3 tactile tokens). No runtime CSS injection, ever |
| `assets/fonts/NotoSansSinhala-Regular.woff2` | exactly 48,520 B | **Preserved read-only**, SHA-256 locked |
| `assets/fonts/NotoSansSinhala-Bold.woff2` | exactly 48,748 B | **Preserved read-only**, SHA-256 locked |
| `data/sdp-data-sync.js` | ≤ 106,000 B | `SDP.Data` (5 keys), `SDP.Sync` (fetch/reconcile/publish/SW), `SDP.Sync.Vault` (`SDP_ENC_V2`) |
| `data/sdp-audio-speech.js` | ≤ 63,000 B | `SDP.Speech`: `say()` normaliser, 4-tier `playWord()`, shared `<audio>` |
| `data/sdp-dictation-engine.js` | ≤ 78,000 B | `SDP.Engine`: beat machine, ring/bar timer, glyph transport deck + 30-pill `#sessionPills`, verbatim phase lines, Paper/Typing, hints, 30-row self-check |
| `data/sdp-ui-views.js` | ≤ 226,000 B | `SDP.Views`: `STRINGS_EN`/`STRINGS_SI`, 6-tab router, Home, Guide 4.0 spotlight, Words (`#01..#30`), Practice, Settings, Studio mounts, cues, toast |
| `data/studio.js` | ≤ 234,000 B | `SDP.Studio`: PIN vault (`BOOTSTRAP_PIN` recovery + atomic re-seal), 3-card studio, **70-clip** pack dashboard + one-click flow, `sha1Hex` clip hashes, `#btnVerifyEleven`, delta retry, session editor, recorder, ElevenLabs, publish |
| `data/data-meter.js` | ≤ 24,000 B | Preserved metering engine, `METER_VERSION = '0.0.1.a'`, `SCHEMA = 1` |
| `data/session.json` | exactly 44885 B (SHA `b1d178d3…`, v0.0.6.a real British IPA) | **Preserved read-only**: 30 Session 8 words + 30 archived Session 7 words + plan |
| `data/config.json` | ≤ 36,000 B | Preserved backend payload; only `ver/appVersion/version/schema/settingsRev` are ours |
| `data/version.json` | ≤ 2,000 B | Slim pointer schema (H3) |
| `data/gas-source.txt` | exactly 13,764 B | **Preserved read-only**: Apps Script backend |
| `data/elevenlabs-audio.json` | ≤ 3,600,000 B | **App-written** Charlotte voice pack (D-UI11, `hashAlgo: 'sha1'`); header asserted, clips travel with the repo |
| `data.html` | ≤ 34,000 B | `/data` transparency route |
| `data/index.html` | ≤ 34,000 B | Byte-identical twin of `data.html` |
| `sw.js` | ≤ 13,000 B | `sdp-v0.0.3` service worker |
| `manifest.webmanifest` | ≤ 4,000 B | PWA manifest, description pinned to `0.0.3` |
| `docs/*.md` (5 files) | ≤ 52,000 B each (template ≤ 26,000 B) | This ledger |

**Preserved files are never edited by hand.** `tests/check.cjs` compares their
byte count *and* SHA-256; the hashes live in its `PRESERVED_SHA` table and in
`docs/SYNC_AND_DATA_CONTRACT.md` Appendix A. Since v0.0.1.d that table is four
files, not five: `data/elevenlabs-audio.json` is written by the Lecturer Studio
on every publish (D-UI11), so freezing it would have made publishing impossible.

---

## 2. Public namespace (R10)

```js
window.SDP = {
  version: '0.0.3', build: '2026-11-02', ver: 12, schema: 12, settingsRev: 20,
  Data:   { /* storage + migration */ },
  Sync:   { /* fetchers, reconciliation, publishing, Service Worker, Vault */ },
  Speech: { /* utterances + audio tiers */ },
  Engine: { /* beat machine + grading */ },
  Views:  { /* i18n + renderers + router */ },
  Studio: { /* lecturer tools */ }
};
window.SDPCore = window.SDP;   // alias kept for the test harness
window.SDPDataMeter = { ... }; // preserved metering engine (data-meter.js)
```

Load order is fixed and enforced by G1:

1. `data/data-meter.js`
2. `data/sdp-data-sync.js`
3. `data/sdp-audio-speech.js`
4. `data/sdp-dictation-engine.js`
5. `data/sdp-ui-views.js`
6. `data/studio.js`

`index.html` runs one inline boot script **before** those six: it compares
`window.__SDP_BOOT_VERSION__` with `data/version.json` and, when a newer build is
published, purges stale `sdp-*` caches (never `sdp-youdao-v1` / `sdp-audio-clips`)
and reloads exactly once (`sessionStorage['sdp_upgraded_to']` guard). The watcher
re-checks on `visibilitychange` so a board or phone left open across the school
day still reloads to 0.0.1.b within two minutes, exactly once.

---

## 3. Structural DOM contract (H2)

Any id below is a public interface: tests, CSS and the engine depend on it.

- **Shell:** `#appHeader`, `#sdpBrand`, `#brandName`, `#sdpVerPill`, `#btnGuideTop`, `#btnLang`, `#btnTheme`, `#sdpScreens`, `#tabbar`, `#sdpSideRail`
- **Tabs:** `#tab-home`, `#tab-player`, `#tab-practice`, `#tab-dict`, `#tab-settings`, `#tab-studio` (rail twins: `#rail-*`)
- **Screens:** `#screen-home`, `#screen-player`, `#screen-practice`, `#screen-dict`, `#screen-settings`, `#screen-studio`
- **Home:** `#homeHero`, `#homeTitle`, `#homeSub`, `#btnStart`, `#btnGuide`, `#homeStatsRow`, `#homeQuickPractice`, `#homeAnn`, `#homeWordsPreview`, `#resumeBanner`, `#btnResumeWord`, `#btnStartOver`, `.cue[data-cue="home"]`, `#creditFoot`
- **Cockpit:** `#sessionProgressStrip`, `#sessionPills` (30 `.word-pill`), `#sessionProgressCount`, `#playerRepeatBadge`, `#playerPresetBadge`, `#cockpitBar`, `#sessionTitle`, `#wordPosBadge`, `#cockpitProgress`, `#beatRing`, `#beatBar`, `#beatSeconds`, `#beatStage`, `#beatStateText`, `#playerPausedBanner`, `#hintChips`, `#typeInput` (**typing mode only**), `#btnPrev`, `#btnPlayPause`, `#btnReplay`, `#btnNext`, `#btnRepeat`, `#btnHint`, `#btnModeSwitch`, `#btnFinish`
- **Results:** `#resultsPanel`, `#resultsTable`, `#scoreValue`, `#scorePct`, `#btnMarkAllCorrect` (v0.0.6.l: fills only UNMARKED rows — Missed marks kept), `#btnMarkAll`, `#btnToggleMissed`, `#btnRetryMissed`, `#btnNewSession`
- **Review popup + launcher (v0.0.6.l):** `#reviewPopupCard` (TOP of the results view, above the table), `#reviewPills` (`.rpill` × 5: `fast`/`voice_ok`/`voice_bad`/`incomplete`/`bug`), `#btnVoiceReview`, `#reviewVoiceStatus`, `#reviewVoicePreview`, `#reviewTextInput`, `#btnSendReview`, `#btnSkipReview`, `#sdpFeedbackFab`, `#sdpFeedbackDrawer`, `#fabFaq`, `#fabQuickChips`, `#btnFabVoiceNote`, `#btnFabSendReview`
- **Briefing (v0.0.6.l):** `#briefingUpdateBadge`, `#briefingTapPill`, `.b-line[data-bline]` > `.b-word[data-bword]` karaoke tokens
- **Studio reviews vault (v0.0.6.l):** `#studioCardReviews`, `#reviewsSummary`, `#studioReviewsList`, `#btnDownloadReviewsZip`, `#btnRefreshReviews`
- **Guide:** `#guideModal`, `#guideSteps` (4 `.guide-step` cards, each with a `.guide-mock`), `#btnGuideSkipStart`, `#guideLangPill`, `#guideSpeak`, `#btnGuideClose`
- **Words:** `#dictSearch`, `#dictFilterRow`, `#dictList` (30 `.dict-card`, `#01..#30`, each with `[data-play-word]`, `[data-mark-word="mastered"]`, `[data-mark-word="weak"]`), `#dictEmpty`
- **Practice:** `#pracMode`, `#pracStage`, `#pracWeakOnly`
- **Settings (student-only):** `#settingsSections`, `#aboutCard`, `#aboutVersion`, `#settingsLecturerBanner`, `#btnOpenStudioFromSettings`
- **Studio (6th screen, PIN-only body):** `#studioAccordion`, `#studioBody`, `#studioGate`, `#studioPin`, `#pinDots`, `#pinPad`, `#pinPadBack`, `#studioSyncDock`, `#lecturerSyncBar`, `#btnSyncClassSettings`, `#lecturerSyncLast`, `#studioSyncSlot`, `#studioCardKeys`, `#studioCardWords`, `#studioCardSettings`, `#studioPackDashboard`, `#studioGenProgress`, `#btnRetryFailedClip`, `#btnSaveKeys`, `#btnOneClickMasterSetup`, `#studioMasterSteps`, `#studioWordManager`, `#btnLockStudio`
- **Toast:** `#sdpDataToast`

### Retired ids and strings (must never reappear)

`bgLiveWrap`, `bgLiveVideo`, `btnLiveVideo`, `liveVideoInput`, `dimTpl`,
`dimHostSet`, `sVideoDim`, `topDataBadge`, `topDataMB`, `topDataLkr`,
`btnDataSheet`, `dataSheet`, `guideSheet`, `btnReadyTest`, `screen-comm`,
`tab-comm`, `commBadge`, `btnMsg`, `printview`, `v58Rail`, `sdpDesktopRail`,
`sdpV56`, `materialMixer`, `I'm ready`, `Write the word now`.

G1 scans every shipped HTML/CSS/JS byte for these; G5 scans the live DOM. A
retired feature is deleted, never hidden with `display:none`.

---

## 4. Screens and the single-active-screen law (R3)

```css
.screen { display: none !important; }
.screen.active { display: block !important; }
```

`SDP.Views.showTab(name)` is the only function allowed to add/remove `.active`.
It also sets `aria-selected` on the six bottom tabs and the six rail buttons.

| Tab | Screen | Rendered by |
| --- | --- | --- |
| `home` | `#screen-home` | `Views.renderHome()` |
| `player` | `#screen-player` | `Views.startDictation()` → `Engine.start()` |
| `practice` | `#screen-practice` | `Views.renderPractice()` |
| `dict` | `#screen-dict` | `Views.renderWords()` (30 cards immediately) |
| `settings` | `#screen-settings` | `Views.renderSettings()` (student-only + `#settingsLecturerBanner`) |
| `studio` | `#screen-studio` | `Views.showTab('studio')` → `SDP.Studio.mount()` + `paintQuickButton()` (gate when locked) |

Responsive navigation: `< 1024px` → bottom `#tabbar` (60px); `>= 1024px` →
232px `#sdpSideRail`. Both are in the DOM at all times; CSS decides which one is
visible, so no JS re-layout is needed.

---

## 5. Event flow

```
DOMContentLoaded (defer order guarantees all 6 modules are loaded)
        │
        ├─ Views.init()
        │    ├─ applyTheme(settings.theme) / applyLang(settings.lang)
        │    ├─ bindShell()  + Engine.bind()
        │    ├─ renderHome / renderWords / renderPractice / renderSettings
        │    ├─ first visit?  → openGuide()      (sdp.guide_seen !== '1')
        │    ├─ showToast()                      (2,400 ms whisper)
        │    └─ Sync.registerSW()
        │
        ├─ Sync.boot()  → fetch version/config/session (cache: no-store, 6 s cap)
        │    └─ applyPayloads() → 30 normalized words → emit 'sdp:ready'
        │         └─ Views.onDataReady() → Speech.loadManifest() → Studio.onDataReady()
        │
        └─ Engine.start() → per word: listening (repeats × gap) → writing (writeSecs)
              └─ finish() → grade() → renderResults() → Data.recordResult() → clearSession()
```

Custom events on `document`: `sdp:ready`, `sdp:update`, `sdp:settings`,
`sdp:progress`, `sdp:online`, `sdp:offline`.

---

## 6. The beat state machine (R5)

States: `idle → listening → writing → (next word | finished)`; `paused` can be
entered from either live phase and returns to the phase it left. Resume into
`writing` remounts `#typeInput` preserving typed text; resume into `listening`
bumps the epoch and restarts at repeat 1 with a fresh listening deadline.

- `listening` lasts `max(1200, (1500 + pauseSecs×1000) × repeats)` ms and speaks
  the word `repeats` times.
- `writing` lasts `writeSecs` ms (3–20 s).
- Ring: `stroke-dashoffset = C × (1 − fraction)` with `C = 2π × 34 ≈ 213.63`.
- Ring colour: `#38BDF8` listening · `#10B981` writing · `#F59E0B` when ≤ 3 s
  remain · `#A1A1AA` idle/paused.
- One 100 ms ticker drives ring, bar, `#beatSeconds` and `#beatStateText`;
  phase changes are deadline based, so the timer never drifts.

### Focus and input law (R4)

- **Typing mode** injects `#typeInput` into `#beatStage` and focuses it once per
  word with `focus({ preventScroll: true })`. It is the only `.focus()` call in
  the app.
- **Paper mode** never creates `#typeInput` and never focuses anything, so the
  on-screen keyboard can never yank the page mid-dictation.

---

## 7. Results and grading

| Mode | Grading | Persisted |
| --- | --- | --- |
| Paper | Student self-checks: every row starts `✅ Correct`; tapping `❌ Missed` flips it | `sdp.progress` via `Data.recordResult()` then `syncMastery()` |
| Typing | Case-insensitive, whitespace-normalised match against `word.w`; the typed string is shown with `.r-diff` | same |

`#scoreValue` always reads `"<correct> / <total>"`; `#scorePct` reads the
percentage. Finishing clears `sdp.session` and unlocks `#btnRetryMissed`
(a session over just the missed words) and `#btnNewSession` (all 30 again).

---

## 8. Audio priority chain (R5)

`SDP.Speech.playWord(word, opts, cb)` tries, in order:

1. Lecturer MP3 — `word.clipUrl`, or `SDP.Sync.getClipUrl()` →
   `assets/audio/session-w<idx>-<ts>.mp3` declared in the session clip map.
2. ElevenLabs cached clip — `data/elevenlabs-audio.json` `clips[word]` (Alice,
   `eleven_flash_v2_5`). Playback of a cached clip costs 0 credits.
3. Dictionary UK audio — `word.audio` (`dict.youdao.com/dictvoice?type=1`).
4. Browser `speechSynthesis`, `en-GB` voice preferred.

Tiers 1–3 always play through one shared plain `<audio id="sdpSharedAudio">`
element. Element audio is never routed through Web Audio, because that is what
silences cross-origin dictionary MP3s. `SDP.Speech.resolveTiers(word)` exposes
the computed chain so G9 can audit it without touching the network.

`SDP.Speech.say()` normalises its argument first
(`Array.isArray(input) ? input.slice() : [String(input)]`), so a sentence is
one utterance, never 56 character utterances.

---

## 9. Service worker (R6)

`sw.js` — `SW_VERSION = 'sdp-v0.0.1.b'`, `SHELL_CACHE = 'sdp-v0.0.1.b-shell'`,
`PRESERVE_CACHES = ['sdp-youdao-v1', 'sdp-audio-clips']`.

- **install** precaches the 18-file shell list and `skipWaiting()`.
- **activate** deletes every cache starting with `sdp-` that is not the shell
  cache or a preserved cache, then `clients.claim()`.
- **fetch**: dictionary audio → cache-first `sdp-youdao-v1`; lecturer/Alice clips
  → cache-first `sdp-audio-clips`; fonts/icons → cache-first shell; navigations
  and `.html/.json/.js/.css` → network-first with a 4,000 ms fallback to cache.

Because the shell is network-first, a published session shows up on the next
open; because audio is cache-first, replaying a word costs zero data.

---

## 10. Where to change what

| I want to… | Edit | Then |
| --- | --- | --- |
| change a colour, radius, spacing | `assets/css/sdp-ui.css` | `node tests/check.cjs` |
| add a UI string | `STRINGS_EN` **and** `STRINGS_SI` in `data/sdp-ui-views.js` | G3 language purity |
| add a screen element | `index.html` (+ H2 table here) | G1 tree tests |
| change pacing or grading | `data/sdp-dictation-engine.js` | G3 + G7 |
| change storage or sync | `data/sdp-data-sync.js` (+ `docs/SYNC_AND_DATA_CONTRACT.md`) | G2 |
| change audio order | `data/sdp-audio-speech.js` | G9 |
| publish a new session | Lecturer Studio (`data/studio.js`) | `docs/DAILY_UPGRADE_PROMPT_TEMPLATE.md` |

---

## 12. Release gate map (v0.0.1.d)

| Gate | File | Runner | What it proves |
| --- | --- | --- | --- |
| G1 | `tests/check.cjs` | node | static contracts: ids, strings, budgets, load order |
| G2 | `tests/upgrade.test.cjs` | node:test | `Sync`/`Vault`/`Speech` API against real payloads |
| G3 | `tests/phase1.cjs` | jsdom | storage corruption, PIN lockout, guide, paper/typing runs |
| G4 | `tests/server.cjs` | node | config/metadata + Apps Script loader |
| G5 | `tests/browser.cjs` | Chromium | 54px header, one screen, focus law, ring colours, toast |
| G6 | `tests/upgrade-browser.cjs` | Chromium | v60 cache → 0.0.1.d, single reload, offline shell |
| G7 | `tests/e2e.cjs` | Chromium | the full student journey + backup download |
| G8 | `tests/live-lab.cjs` | Chromium | dead API, offline reload, hung relay, empty bank |
| G9 | `tests/audit-v42.cjs` | node | retirement, H1 budgets, ES5, PWA pins, preserved hashes |
| G10 | `tests/voice-guide.cjs` | jsdom | `pickVoice` exists, one en-GB professor, male names −100, Guide 2.0 step machine + tap banner |
| G11 | `tests/vault-sync.cjs` | jsdom | `SDP_ENC_V2` round trip, sequential publish with `version.json` last, fresh SHA per PUT, no PIN in any body |
| G12 | `tests/studio-safety.cjs` | jsdom | twelve-key `#pinPad`, zero-character quota read, 972-char cost preview, delta-only clips, no gate touches the billing endpoint |

The suite is exactly these twelve gates; G1 asserts that every one of them is
present, and G12 asserts that no gate or test file even mentions
`/v1/text-to-speech` (W5 credit safety).

Shared plumbing: `tests/static-server.cjs` (one server, `setOverride` for
per-test payloads) and `tests/app-harness.cjs` (jsdom + `@sinonjs/fake-timers`
+ WebCrypto + a fetch stub over the real `data/*.json`). Neither gate may
reimplement them; that is how the suite stays consistent.

## 13. Empty-bank behaviour (new in 0.0.1.a)

`SDP.Sync.wordCount() === 0` is a first-class state, not an error: Home shows
`#bankEmpty`, `#btnStart` is `disabled`, `#statMastered` renders `—`,
`startDictation()` toasts and stays on Home, and the Words tab hides the list
behind `#dictEmpty`. This is what a student sees if they install the PWA while
GitHub is unreachable and no cached payload exists.

---

**Credits — preserved verbatim, EN and SI.**
`CREDITS GOES TO Hansana` ·
Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu) ·
නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini

---

## 13. v0.0.1.d — classroom sync, PIN gate and the professor voice

Audience: **CCBE Galle Branch — B1 English Class, Sri Lanka**
Lecturer in Charge: **Ms. Sumodya Sewmini** · Creator: **Hansana** · Concept: **Ayya01 (Lesandu)**

| Pill | Line |
| --- | --- |
| `CREDITS GOES TO Hansana` | `Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu)` |
| `නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini` | both lines ship in EN and SI on Home, About and `/data` |

### 13.1 New public surface (R10 additions)

```js
SDP.version = '0.0.1.d'; SDP.ver = 4;
SDP.Sync.adoptRemoteSettings(remoteConfig, remoteSettingsRev); // R1
SDP.Sync.fetchRawMainJson(relPath, cb);   // raw.githubusercontent.com, no token
SDP.Sync.pollVersionTick(cb);             // the 30 s pointer read
SDP.Sync.Vault.computePinVerifier(pin, saltB64);      // PBKDF2-SHA256, 250k
SDP.Sync.Vault.verifyPinVerifier(pin, verifierObj);   // constant-time compare
SDP.Sync.Vault.recordFail() / .strikes() / .resetLock();
SDP.Studio.saveClassSettings(cb);         // the #lecturerSyncBar button
SDP.Studio.classSettingKeys;              // the ten classroom keys
SDP.Speech.activeUtter();                 // VOX-01 module-scope guard
SDP.Speech.lastTierName();                // VOX-08 honest toast
SDP.Views.renderAll();                    // one repaint after an adoption
SDP.Views.openGuideQuick(mode); SDP.Views.finishQuickGuide(start);
```

### 13.2 New structural DOM ids (H2 additions)

`#lecturerSyncBar`, `#btnSyncClassSettings`, `#lecturerSyncLast`,
`#btnGuideSkipStart`, `#newPinInput`, `#confirmPinInput`, `#studioGasUrl`
(unlocked only). `#studioFirstTimePanel`, `#setupPin` and `#btnStudioSetup`
no longer exist anywhere in the locked Studio DOM (SEC-01).

### 13.3 Byte ceilings after the bump

Every H1 budget is unchanged; the largest growth is `data/sdp-ui-views.js`
(string tables + quick guide) and `data/studio.js` (class-settings publish),
both far inside their 110,000 B / 85,000 B ceilings. `data/config.json` gained
`classSettings` and `pinVerifier` and stays under 36,000 B.

## 14. v0.0.1.e — honest sync, British English default, guaranteed voice, Bento home

Audience and attribution are unchanged. New public surface (R10 additions):

```js
SDP.ver = 5; SDP.version = '0.0.1.e';
SDP.Sync.parseRemoteAppVer(v);        // one shared reader of string/object version fields
SDP.Sync.fetchRawMainJson(rel, cb);   // raw.githubusercontent.com source of the never-red check
SDP.Speech.hasStarted();              // real utter.onstart flag (D10/D11 watchdogs)
SDP.Speech.isAudioPlaying();          // shared <audio> playing flag
SDP.Speech.getVoicesSafe();           // voices after a user gesture, never throws
SDP.Speech.youdaoAudioUrl(text); SDP.Speech.shortGuideLine(i);
SDP.Studio.publishChecklist(payloads); // pre-publish coherence, plain-language problems
SDP.Studio.nextSyncRev();             // Math.max(Date.now(), prevSyncRev + 1) — the ONE publish clock
```

New structural classes (H2 additions): `.step-badge` (28 px circular journey numbers),
`.practice-grid` / `.practice-card` / `.prac-ico` / `.prac-title` / `.prac-sub`
(Quick Practice rich cards). `#screen-home` becomes a two-column Bento grid at
≥ 1024 px (`minmax(0,7fr) minmax(0,5fr)`, gap 16 px; `#creditFoot` spans the full
row). Behavioural contracts live in `docs/SYNC_AND_DATA_CONTRACT.md` §R13 and
`docs/UI_COMPONENT_GUIDE.md` §v0.0.1.e.

## §H3 — v0.0.1.f release tree, budgets and module deltas (2026-11-02)

ver 6 · schema 6 · settingsRev 6 · `SDP.version` `0.0.1.f` · release `syncRev`
1793590000000. No file was added and no build step was introduced.

| file | v0.0.1.f bytes | cap |
|---|---|---|
| `index.html` | 30,170 | 40,000 |
| `assets/css/sdp-ui.css` | 43,383 | 68,000 |
| `data/sdp-data-sync.js` | 73,761 | 74,000 |
| `data/sdp-audio-speech.js` | 38,831 | 54,000 |
| `data/sdp-dictation-engine.js` | 43,844 | 64,000 |
| `data/sdp-ui-views.js` | 115,546 | 120,000 |
| `data/studio.js` | 97,706 | 98,000 |
| `data/data-meter.js` | 21,740 | 22,000 |
| `data.html` = `data/index.html` | 27,905 | 60,000 |
| `sw.js` | 10,759 | 12,000 |
| `data/config.json` | 35,001 | 36,000 |
| `data/version.json` | 289 | 2,000 |
| `docs/*.md` | see §H3.4 | 44,000 (template 22,000) |

### §H3.1 Module responsibilities after v0.0.1.f

* `data/sdp-data-sync.js` — the five storage keys, the `SDP_ENC_V2` vault, and the
  **single** reconciliation entry point `fetchFreshDataJson(relPath, cb)`
  (`{ok, json, source:'origin'|'raw'}`). `checkForUpdates()` verifies every payload leg
  against the winning pointer, retries it once on the alternate source, refuses to
  advance `state.version` when a leg stays undelivered, and never returns `ok:false`
  while either version source answered.
* `data/sdp-dictation-engine.js` — beat machine with an explicit `paused` phase:
  `isActive()`, `isPaused()`, `pause(reason)`, `resume()`, `saveDraft()`,
  `restorePausedDraft()`, `renderBadges()`, `bindLifecycle()`. `pause()` stops the ticker
  *and* the speech backend, stores `pausedPhase`/`remainingMs`/`repeatsDone`/
  `pauseReason`, and `resume()` restores the same word, the same repeat index and the
  exact write-window remainder.
* `data/sdp-ui-views.js` — one router (`showTab`, aliased `showScreen`), `renderAll`
  (aliased `refreshAll`), the 25 s watcher hand-off, the `sdp:update` repaint listener,
  `paintPresetBadge()` → `Fast Exam · 5s · 2× · British English`, the Resume banner and
  the 900 ms `#guideAutoplayBanner`.
* `data/sdp-audio-speech.js` — `loadManifest`/`reloadManifest` through the shared reader,
  `injectClips()` for an instance-level refresh without a page reload.
* `data/studio.js` — three outcome cards (keys/voice, words publisher, settings/PIN),
  the 4-step `#btnOneClickMasterSetup`, `enrichWords()`, `publishBundle()`,
  `sealVaultNow()` and the auto-lock bindings. ES5 only, no new file, one publish clock.

### §H3.2 Locked vs unlocked Studio

Locked (the whole studio is its own screen, `#screen-studio`): `#studioPin`
(`maxlength="12" minlength="4"`), `#pinDots` (`min(12, max(8, len))` dots, `data-dots`),
the 12-key `#pinPad`, `#pinPadBack`, the status line and the lecturer hint — nothing else.
`#lecturerSyncBar` stays in `#studioSyncDock`; `#studioAccordion`/`#studioBody` never
contain a card while locked. Unlocked: `#studioCardKeys`,
`#studioCardWords`, `#studioCardSettings`, `#btnLockStudio`, `#studioMasterSteps`
(4 × `li[data-state]`), `#studioAiProvider`, `#studioAiKey`, `#studioWordManager`
(30 rows × 6 editable cells), `#btnEnrichWords`, `#btnPublishWords`,
`#btnPublishWordsAndVoice`, `#btnSaveKeys`, `#btnTestAi`, `#btnCheckQuota`,
`#btnGenClips`, `#btnTestOneWord`, `#studioForceRegen`/`#chkForceRegen`.

### §H3.3 Publish order (unchanged law, new clock)

`session.json → config.json → elevenlabs-audio.json → version.json` — one
`nextSyncRev()` stamps all four bodies, `version.json` is always committed last, and a
locked or token-less studio commits nothing.

### §H3.4 Docs budget used at release

Caps only (the bytes move every release; the v0.0.2.a measurements are §H6.4):
`CHANGELOG_LEDGER.md` ≤ 52,000 · every other doc ≤ 52,000 · this template file ≤ 26,000.
G1 and G9.2c both enforce them, so a doc that grows past its cap fails the release the
same way an oversized module does.

---

## §H4 — v0.0.1.h release tree, budgets and module deltas (2026-11-02)

Pointer: `appVersion/version '0.0.1.h'` · `ver/schema/settingsRev 8` ·
`syncRev 1793600000000` · `SW_VERSION 'sdp-v0.0.1.h'` / `SHELL_CACHE 'sdp-v0.0.1.h-shell'`.
`tests/check.cjs` (W2 ceilings) and `tests/audit-v42.cjs` §G9.2 carry the same table.

### §H4.1 Bytes measured on the release tree

| File | Bytes | Ceiling |
| --- | --- | --- |
| `index.html` | 30,170 | 36,000 |
| `assets/css/sdp-ui.css` | 44,305 | 60,000 |
| `data/sdp-data-sync.js` | 78,825 | 82,000 |
| `data/sdp-audio-speech.js` | 38,831 | 52,000 |
| `data/sdp-dictation-engine.js` | 43,844 | 60,000 |
| `data/sdp-ui-views.js` | 118,919 | 125,000 |
| `data/studio.js` | 111,993 | 112,000 |
| `data/data-meter.js` | 21,740 | 24,000 |
| `data.html` = `data/index.html` | 27,905 each | 32,000 |
| `sw.js` | 10,759 | 13,000 |
| `data/config.json` | 35,001 | 36,000 |
| `data/version.json` | 289 | 2,000 |

### §H4.2 Module ownership of the D1–D18 register

* **`data/studio.js` (Studio).** D1 `fetchSubscription` 3-rung ladder · D2 `quotaError`
  (403 + `res.scoped` + `detail.status`; scoped is green, never red) · D3/D4
  `oneClickMasterSetup` (4 steps, GitHub token the only fatal one, tier statuses warn and
  keep made clips) · D6 `saveKeys` = Layer 2 · D7 `paintSecretFields` (masked auto-fill) ·
  D10 `AI_PROVIDERS` 5-slot ladder, `free_dict` default · D13 `keysCardMarkup` ·
  D14 `#studioForceRegen` ↔ `#chkForceRegen`.
* **`data/sdp-data-sync.js` (Data + Sync + Vault).** D5 `settings.vaultLock` Layer 1 ·
  D8/D9 `healFromLayerOne` at boot, inside `resolveEnvelope()` and
  `unlockWithVerifier()` · D15 config-sovereign `settle()` + `deferredSession` ·
  D16 `verifyPayloadLeg` · D17 `needSession`.
* **`data/sdp-audio-speech.js` (Speech).** D11/D12 `audioForWord(w, dAudio)`, British
  harvest (`-uk.mp3`/`_gb`), Youdao `type=1` fallback.
* **`data/sdp-ui-views.js` (Views).** `STRINGS_EN`/`STRINGS_SI` gained `studioSave`,
  `studioOneClick`, `studioQuotaScoped`, `studioElTierWarn`, `studioAiNoKey`,
  `studioAiSlot1..5`, `studioFreeNoKey`, `vaultBadgeLabel`.
* **`data/sdp-dictation-engine.js` (Engine).** untouched by v0.0.1.h except the header
  stamp; `renderResults()` still owns every result row.
* **`data/data-meter.js` (transparency).** untouched, `METER_VERSION` unchanged.

### §H4.3 What a release must never move

`data/session.json`, `data/gas-source.txt` and both Sinhala `woff2` files stay
byte-identical (Appendix A). `data/elevenlabs-audio.json` is app-written and budgeted,
never hash-frozen. The credits strip stays verbatim in EN and SI on Home, About and
`/data`.

---

## §H5 — v0.0.1.i release tree, budgets and module deltas (2026-11-02)

Pointer: `appVersion/version '0.0.1.i'` · `ver/schema 9` · `settingsRev 12` ·
`syncRev 1793610000000` · `SW_VERSION 'sdp-v0.0.1.i'` / `SHELL_CACHE 'sdp-v0.0.1.i-shell'`.
`tests/check.cjs` (gate G1 `BUDGET`) and `tests/audit-v42.cjs` §G9.2 carry the same
ceilings; a ceiling that exists in only one of them fails the release (§H5.4).

### §H5.1 Bytes measured on the release tree (`wc -c`, this checkout)

| File | Bytes | Ceiling |
| --- | --- | --- |
| `index.html` | 30,223 | 36,000 |
| `assets/css/sdp-ui.css` | 45,402 | 60,000 |
| `data/sdp-data-sync.js` | 83,666 | 86,000 |
| `data/sdp-audio-speech.js` | 38,831 | 52,000 |
| `data/sdp-dictation-engine.js` | 43,844 | 60,000 |
| `data/sdp-ui-views.js` | 119,119 | 128,000 |
| `data/studio.js` | 115,884 | 116,000 |
| `data/data-meter.js` | 22,845 | 24,000 |
| `data/session.json` | 44885 (exact, SHA `b1d178d3…`) | 44885 |
| `data/config.json` | 35,469 | 36,000 |
| `data/version.json` | 366 | 2,000 |
| `data/elevenlabs-audio.json` | 744 | 2,500,000 |
| `data.html` = `data/index.html` | 27,974 each | 32,000 |
| `sw.js` | 10,759 | 13,000 |
| `manifest.webmanifest` | 2,030 | 4,000 |

`data/studio.js` was 111,993 B on v0.0.1.h and is 115,884 B here: the D1–D20 work
added ~4 KB net after consolidating duplicate helpers (see §H5.3). The 116,000 B
ceiling was **not** raised to make room; the code was compacted instead.

### §H5.2 Module ownership of the v0.0.1.i register

* **`data/studio.js` (Studio).** D1/D9 `SECRET_FIELDS` + `secretSnapshot()` +
  `guardSecretMerge()` + `clearSecretField()` (`:736`–`:760`), `mergeSecretInputs()`
  (`:1205`), the four `#btnClear*` handlers (`:1137`–`:1140`); D2 `withBusy()`
  (`:128`); D3 `enrichWords()` live `n/30` + 45,000 ms cap (`:1487`); D4
  `paintLecturerBar()` (`:1990`); D5 `publishReason()` (`:1979`); D6 `hhmm()` +
  `"Publish failed · hhmm · reason"`; D7 `publishErrorText()` (`:1974`, delegates to
  `SDP.Sync`); D13 `restoreSessionStash()` (`:642`); D14 one `nextSyncRev()` (`:88`,
  `:1661`, `:1687`); D17 `publishChecklist()` (`:1873`); D18 `clearBusy()` (`:1994`);
  D20 `bumpMeterCache()` (`:1995`).
* **`data/sdp-data-sync.js` (Data + Sync + Vault).** `SCHEMA 9` (`:16`),
  `SETTINGS_REV 12` (`:17`, aligned with the shipped `settingsRev`); D7
  `publishErrorText(status, ghMsg)` (`:1430`); D10 the hardcoded
  `APP_VERSION === '0.0.1.h' && settingsRev === 8` clamp is gone — adoption is
  monotonic (`:976`); D11 config-sovereign `settle()` (`:1174`) returning
  `stale_payload` + `deferredSession` + `retry`; D16 one delayed retry with a fresh
  SHA (`:1460`, `:1533`); R6 `publishFilesSequential()` (`:1480` region) commits
  `version.json` last.
* **`data/sdp-ui-views.js` (Views).** D4 exported `paintLecturerBar()` (`:1388`,
  export `:2150`) repainted from `unlock()`, `unlockWithVerifier()` and `lock()`
  (`:1441`); D19 `lecturerSyncIdle` in EN (`:85`) and SI (`:279`) with
  `data-state`/`aria-live`; D2 `SDP.Studio.withBusy` around `#btnSyncClassSettings`
  (`:1662`); new strings `studioClear`, `studioRestored`, `studioNoVaultWarn`.
* **`assets/css/sdp-ui.css` (stylesheet).** D8 `.screen:not(.active) { display: none
  !important; }` (`:148`) and the desktop Bento rule scoped to `#screen-home.active`
  (`:1019`) behind `@media (min-width: 1024px)` (`:1018`), so an id rule can never
  outrank the single-active-screen law.
* **`data/data-meter.js` (transparency).** D20 `CACHE_VERSION = '0.0.1.i'` (`:12`),
  `cacheKey()` (`:358`), `clearCache()` (`:351`), and a cached manifest is honoured
  only when its `__v` matches (`:39`, `:46`).
* **`data/sdp-dictation-engine.js` / `data/sdp-audio-speech.js`.** Untouched by
  v0.0.1.i; their headers stay at the release that last changed them
  (`0.0.1.h` / `0.0.1.d`).

### §H5.3 Why the studio grew and then shrank

The D1–D20 edits first pushed `data/studio.js` to 124,447 B. Comment-only
compression could not recover 8,447 B, so duplicate helper definitions
(`withStatus`, a second provider mapper) were removed and `doneCount` folded into
`done`; the shipped file is 115,884 B with every behaviour intact. This is the
only sanctioned way to buy room: **never raise a ceiling to fit a change.**

### §H5.4 Two budget tables, one truth

`tests/check.cjs` `BUDGET` and `tests/audit-v42.cjs` §G9.2 hold the same numbers
(`data/sdp-data-sync.js` 86,000 · `data/sdp-ui-views.js` 128,000 ·
`data/studio.js` 176,000 · `data/session.json` 44,881). Bumping one and not the
other is exactly what turned G9.2a red on this release; both were re-pinned in the
same commit. G9.3a is a third, independent line: any single `data/*.js` over
120,000 B fails it, and the 128,000 B ceiling above it is not an exemption. The
D1–D20 strings pushed `sdp-ui-views.js` to 121,619 B, so the module was trimmed
back to 119,119 B by folding twenty-four historical comment blocks into one-liners
(no code path changed) rather than raising the monolith line.

### §H5.5 Gate results on this tree

G1 89/0 · G2 12/0 · G3 81/0 · G4 8/0 · G5 60/0 · G6 15/0 · G7 52/0 · G8 39/0 ·
G9 47/0 · G10 26/0 · G11 74/0 · G12 94/0 — 597 assertions, 0 FAIL
(`cd tests && npm run gates`).

### §H5.6 Bytes measured on the five living docs at v0.0.1.i (`wc -c`)

| Doc | Bytes | Cap |
| --- | --- | --- |
| `docs/ARCHITECTURE_MAP.md` | 30,963 | 48,000 |
| `docs/CHANGELOG_LEDGER.md` | 51,232 | 52,000 |
| `docs/SYNC_AND_DATA_CONTRACT.md` | 30,634 | 48,000 |
| `docs/UI_COMPONENT_GUIDE.md` | 26,854 | 48,000 |
| `docs/DAILY_UPGRADE_PROMPT_TEMPLATE.md` | 20,348 | 24,000 |

The changelog is the only doc near its cap; the old duplicate block in its P7 section
and the duplicated P6b/P7 gate tables were folded into one line each to make room for
the v0.0.1.i register rather than raising the cap.

---

## §H6 — v0.0.2.a release tree, budgets and module deltas (2026-11-02)

Pointer: `appVersion/version '0.0.2.a'` · `ver 10` · `schema 10` · `settingsRev 16` ·
`syncRev 1793615000000` · `SW_VERSION 'sdp-v0.0.2.a'` / `SHELL_CACHE 'sdp-v0.0.2.a-shell'` ·
`TARGET '0.0.2.a'`. `tests/check.cjs` (G1 `BUDGET`) and `tests/audit-v42.cjs` §G9.2 carry the
same ceilings; a ceiling that exists in only one of them fails the release.

### §H6.1 Bytes measured on the release tree (`wc -c`, this checkout)

| File | Bytes | Ceiling |
| --- | --- | --- |
| `index.html` | 33,381 | 38,000 |
| `assets/css/sdp-ui.css` | 59,197 | 68,000 |
| `data/sdp-data-sync.js` | 84,004 | 86,000 |
| `data/sdp-audio-speech.js` | 38,831 | 52,000 |
| `data/sdp-dictation-engine.js` | 47,685 | 62,000 |
| `data/sdp-ui-views.js` | 135,328 | 136,000 |
| `data/studio.js` | 122,792 | 126,000 |
| `data/data-meter.js` | 22,845 | 24,000 |
| `data/session.json` | 44885 (exact, SHA `b1d178d3…`) | 44885 |
| `data/config.json` | 35,477 | 36,000 |
| `data/version.json` | 369 | 2,000 |
| `data/elevenlabs-audio.json` | 747 | 2,500,000 |
| `data.html` = `data/index.html` | 27,967 each | 34,000 |
| `sw.js` | 10,759 | 13,000 |
| `manifest.webmanifest` | 2,029 | 4,000 |

### §H6.2 Module ownership of the v0.0.2.a register

* **`index.html` (Shell).** sixth `#screen-studio` (`#studioSyncDock`, `#lecturerSyncBar`,
  `#studioAccordion`, `#studioBody`), `#settingsLecturerBanner` in Settings, 30-pill
  `#sessionProgressStrip`, 4-button `.cockpit-transport`, `#resumeBanner`, `.cue` on the Home
  CTA, `TARGET = '0.0.2.a'`.
* **`assets/css/sdp-ui.css` (Style).** the tactile tokens (`--btn-h`, `--shadow-btn`,
  `--grad-primary`, `--grad-go`, `--cue-bg`), `.btn/.btn-sm/.btn-ghost/.btn-transport`,
  `.cue`, `.progress-strip`/`.word-pill.done|current|todo`, `.dict-card[data-state]`,
  `.resume-card`, `.guide-steps/.guide-step/.guide-mock`, the studio card + gate block.
  No runtime `<style>`, ever (W3).
* **`data/sdp-ui-views.js` (Views).** `STRINGS_EN`/`STRINGS_SI` (every new string in both),
  6-tab router, `pad2()`, ordered `#01..#30` sheet + `markDictWord()`, Guide 3.0
  (`guideMockMarkup()`, `.active-step`, footer `▶ Start Dictation Now`), `paintCues()` /
  `markCueSeen()` (`sdp.settings.cuesSeen`), `paintHomeWordsPreview()`,
  `paintLecturerBanner()`, `startOver()`, `#aboutVersion`.
* **`data/sdp-dictation-engine.js` (Engine).** `paintProgressStrip()` (30 pill buttons, click
  jumps, `#sessionProgressCount`, `⏮ Prev (#k)`/`⏭ Next (#k)`, `#btnReplay`,
  `#playerPresetBadge`), verbatim phase sentences, `⏸ Pause Dictation` / `▶ Resume Word #k` /
  `▶ Start Dictation`, one `paint()` path that repaints the strip and the badges every tick.
* **`data/studio.js` (Studio).** `clipCount()`/`packDashboardText()` (`#studioPackDashboard`
  X/34), `genProgressText()`/`paintGenProgress()` (`#studioGenProgress`), `queueFor(words,
  singleTest, keys)` for delta retry, `paintRetryRow()` (`#btnRetryFailedClip` hidden until a
  real failure), `lecturerBarNode()`/`stashLecturerBar()`/`placeLecturerBar()` (ONE bar, dock
  → slot), `paintQuickButton()` (`Lecturer Admin Locked/Unlocked`).
* **`data/sdp-data-sync.js` (Data).** `cuesSeen` lives inside `sdp.settings` and is healed on
  read; the five localStorage keys are unchanged.

### §H6.3 What a release must never move

`config.encVault` (`SDP_ENC_V2:…`, 487 chars) and `config.pinVerifier` (`VlIxxCOF1…`, PIN
`78987898`) are never rewritten; `data/session.json` (44,881 B), `data/gas-source.txt`
(13,764 B) and both Sinhala fonts stay byte-identical; the five localStorage keys stay five;
strict ES5 with no build step; `/v1/text-to-speech` only from a human click inside
`data/studio.js`; `version.json` commits last, off one monotonic `syncRev`.

### §H6.4 Gate results and doc bytes on this tree

G1 109/0 · G2 12/0 · G3 100/0 · G4 8/0 · G5 60/0 · G6 15/0 · G7 52/0 · G8 39/0 · G9 47/0 ·
G10 26/0 · G11 74/0 · G12 94/0 — 636 assertions, 0 FAIL (`cd tests && npm run gates`).

| Doc | Bytes | Cap |
| --- | --- | --- |
| `docs/ARCHITECTURE_MAP.md` | 36,991 | 52,000 |
| `docs/CHANGELOG_LEDGER.md` | 51,966 | 52,000 |
| `docs/SYNC_AND_DATA_CONTRACT.md` | 32,323 | 52,000 |
| `docs/UI_COMPONENT_GUIDE.md` | 31,180 | 52,000 |
| `docs/DAILY_UPGRADE_PROMPT_TEMPLATE.md` | 23,070 | 26,000 |

## v0.0.4.b — systems map delta

* `data/studio.js`: `recoverFromHistory()` (GET /v1/history + /audio, 0 credits), `packClipsForDisk()`, the `commitVoicePack` mutex and `#btnRecoverClips`; no automatic generation path remains.
* `data/sdp-data-sync.js`: `SETTINGS_REV 27`, `SCHEMA 14`, three 409 retries, `normClipKey()` and stale-draft invalidation in `applyPayloads()`.
* `data/sdp-dictation-engine.js`: `wordsSignature()` stamps `wordsSig` on drafts and invalidates stale ones in `loadDraft()`.
* `data/sdp-audio-speech.js`: `normKey()` / `hydrateClips()` / `canBlobUrl()`, boolean `reloadManifest(force)`, fast handover for unplayable clips.
* `data/elevenlabs-audio.json`: 100 clips, b64 only, ~2.27 MB (H1 cap 2,500,000 B). `assets/css/sdp-ui.css` carries the v0.0.4.b tactile pill system (cap 82,000 B).
* Stamp: `0.0.4.b` / `ver 14` / `schema 14` / `settingsRev 27` / `syncRev 1793710000000` across all nine surfaces.

## §H7 — v0.0.6.j release tree, feature surface and module deltas (2026-11-06)

ver 24 · schema 24 · settingsRev 40 · `SDP.version '0.0.6.j'` · release `syncRev`
1794100000000 · `SW_VERSION 'sdp-v0.0.6.j-s25'` / `SHELL_CACHE 'sdp-v0.0.6.j-s25-shell'`
· `BETA_SUBVERSION '0.0.6.j.beta'`. No new file; the twelve-gate suite is unchanged
in shape — the new features are asserted inside G1 §13, G3 §3b, G5 §13 and G7 §1.

### §H7.1 New public surface (R10 additions)

```js
SDP.Diagnostics     // sdp-data-sync.js — bounded privacy-safe ring (160) +
                    //   AES-GCM review capture/decrypt + snapshot builders +
                    //   the pure ES5 CRC32/STORE zip writer (zipStore)
SDP.Views.openBriefing/closeBriefing/briefingSentences/briefingSeen/
        briefingGateLeft/briefingSeek/betaSubversion/betaActive/
        applyBetaChannel/onFinished/sendReview
SDP.Speech.playBriefingStep/briefingClipUrl/pickMaleVoice/maleVoiceName/clipCount
SDP.Studio          // keyPoolEntries/rotateElevenKey/probePoolKeys/
                    //   verifyPronunciationWord/verifyWmRow/resynthWmRow/
                    //   generateClips({intro:true})/buildDiagZip/paintDiagSummary
```

### §H7.2 New structural DOM ids (H2 additions)

Briefing: `#briefingModal`, `#briefingTitle`, `#briefingPersona`,
`#briefingLyrics` (8 `.b-line`), `#briefingBar`, `#briefingCount`,
`#btnBriefingContinue`, `#btnBriefingSkip`, `#btnCreatorNote`.
Review: `#reviewCard`, `#reviewPills` (`.rpill` fast/clear/issue),
`#btnVoiceReview`, `#reviewVoiceStatus`, `#reviewTextInput`, `#btnSendReview`,
`#btnSkipReview`, `#reviewE2eeBadge`.
Studio: `#studioKeyPool` (`#kpProv1..5`, `#kpSlot1..5`, `.kp-badge`),
`#btnProbePool`, `#btnGenIntroClips`, `#kpStatus`, `#studioCardDiag`,
`#diagSummary`, `#btnDownloadDiagZip`, `#btnClearDiag`, `#diagStatus`,
per-row `data-action="verifyWmRow|resynthWmRow"` + `.wm-vbadge`.
Beta: `#sdpBetaPill`, `#sdpBetaStamp`.

### §H7.3 Laws this release adds

* The 10-second briefing gate: `BRIEFING_GATE_MS = 10000`; `closeBriefing()`
  refuses dismissal while `gateLeft > 0`; completion stamps
  `sdp.settings.briefingSeen = 1` once (five-key R8 law holds); the guide
  takes over exactly as before (R2).
* The static clip vault: `STATIC_CLIP_KEYS` (6 cmd + 30 num + 4 guide + 8
  intro) is immutable once committed; delta generation skips it unless a
  human forces a text change; the pack arithmetic is 78 clips.
* The key pool: rotation order = the primary ElevenLabs field, then Key
  Slots #1..#5 typed `elevenlabs`; 401/402/429 rotates mid-batch once per
  remaining key; every rotation is a diagnostics event.
* Reviews are sealed with `SDP_ENC_V2` (AES-GCM, device-local key) BEFORE
  storage; nothing readable ever hits disk; the `.zip` decrypts them only
  inside the unlocked studio.

### §H7.4 Bytes measured on the release tree (`wc -c`)

| File | Bytes | Ceiling |
|---|---|---|
| `index.html` | 52,261 | 56,000 |
| `assets/css/sdp-ui.css` | 116,931 | 120,000 |
| `data/sdp-data-sync.js` | 100,719 | 106,000 |
| `data/sdp-audio-speech.js` | 58,271 | 63,000 |
| `data/sdp-dictation-engine.js` | 63,868 | 76,000 |
| `data/sdp-ui-views.js` | 192,736 | 196,000 |
| `data/studio.js` | 207,389 | 212,000 (G9.3a line 210,000, moved in lockstep after a 21.9 KB comment compaction) |
| `data/session.json` | 55,764 (exact, SHA `ee7b5294…`) | preserved |
| `data/elevenlabs-audio.json` | 2,867,317 (131 Alice clips, all preserved; header ver 24/schema 24) | 3,000,000 |
| `data/config.json` | 40,026 | 42,000 |
| `data/version.json` | 428 | 2,000 |
| `data.html` = `data/index.html` | 29,782 each | 34,000 |
| `sw.js` | 10,934 | 13,000 |

### §H7.5 Gate results on this tree

G1 147/0 · G2 12/0 · G3 122/0 · G4 8/0 · G5 103/0 · G6 15/0 · G7 58/0 ·
G8 39/0 · G9 47/0 · G10 38/0 · G11 74/0 · G12 103/0 — **764 assertions,
0 FAIL** (`cd tests && npm run gates`), plus the CI preserved-payloads step
(all four SHA-256 locks OK).
