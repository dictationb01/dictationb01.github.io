# UI_COMPONENT_GUIDE — Smart Dictation Player v0.0.1.h

One stylesheet, flat matte, no glass. If a component is not documented here, it
does not belong in the app.

---

## 0. What changed in v0.0.1.d

Five new surfaces, all flat matte, all real DOM:

| Surface | Id | Rules |
| --- | --- | --- |
| Home journey card | `.journey-card` | three numbered steps, `1-2-3`, never a wall of text; the readiness badge next to it reads `Session 8 ready · 30 words` |
| Smart Board bar | `#boardClassBar` | `display:flex` only at ≥ 1024 px (or `data-theme="board"`); 1..N chips, 64 px transport (Play/Pause, Repeat, Next), word toggle defaults to `••••••` (R10 no-spoiler) |
| Board theme | `html[data-theme="board"]` | pure black, `#52525B` strokes, 18 px base type, 48 px `#beatSeconds`, 60 fps (no `backdrop-filter` anywhere) |
| Retry / paper labels | `#wordPosBadge.badge-retry`, `#paperModeNotice` | a retry run says `Retry · Word n of N` and the results table keeps `S<n> #<k>` (`data-orig`) instead of renumbering; paper mode states `Paper Mode: Tap any word you missed to mark ✗` above `.table-wrap` |
| Studio PIN pad | `#pinPad` | exactly twelve 56 px keys (1-9, Clear, 0, Unlock); ⌫ is `#pinPadBack`, outside the pad |

`--stroke` is defined as `var(--border)` in `:root`, `[data-theme="light"]` and
`[data-theme="board"]`, so every stroke follows its theme. The `.credits-pill`
shimmer runs at most three iterations.

---

## 1. Design tokens

Defined once in `assets/css/sdp-ui.css` on `:root` (dark default) and overridden
by `html[data-theme="light"]` / `body[data-theme="light"]`.

| Token | Dark | Light | Used for |
| --- | --- | --- | --- |
| `--bg-app` | `#09090B` | `#FFFFFF` | page, header |
| `--bg-card` | `#121216` | `#F4F4F5` | cards, tab bar |
| `--bg-elev` | `#18181D` | `#EDEDF0` | buttons, chips, table head |
| `--bg-sunken` | `#0C0C0F` | `#FAFAFA` | inputs, bar track |
| `--border` | `#27272A` | `#E4E4E7` | 1px hairlines |
| `--border-strong` | `#3F3F46` | `#D4D4D8` | interactive outlines |
| `--text` | `#FAFAFA` | `#09090B` | primary text |
| `--text-muted` | `#A1A1AA` | `#52525B` | labels, helper text |
| `--accent` | `#38BDF8` | `#0284C7` | primary actions, listening ring |
| `--ok` | `#10B981` | `#059669` | correct marks, writing ring |
| `--warn` | `#F59E0B` | `#B45309` | last-3-seconds ring |
| `--danger` | `#EF4444` | `#DC2626` | missed marks |
| `--header-h` | `54px` | `54px` | fixed header height |
| `--tabbar-h` | `60px` | `60px` | mobile bottom bar |
| `--rail-w` | `232px` | `232px` | desktop rail |
| `--radius` / `--radius-sm` | `14px` / `10px` | same | cards / controls |
| `--tap` | `48px` | `48px` | minimum hit target |

Rules that never change:

- `backdrop-filter: none !important` on header, cards, modals, toast, bars, pills.
- Zero shadows (`--shadow: none`); depth comes from the border + surface pair.
- No gradients except the credits shimmer sweep.
- Every interactive element is at least `48 × 48` px (`min-height: var(--tap)`).

---

## 2. Shell

**Header** — `#appHeader`: `position: fixed; top: 0; height: 54px`, flat `#09090B`
(or `#FFFFFF` in light), hairline bottom border. Left: swan SVG, `#brandName`
"Smart Dictation", `CCBE B1` badge, `#sdpVerPill` "v0.0.1.b". Right:
`? Guide`, `EN | SI`, theme toggle.

`body { padding-top: var(--header-h) }` and `#sdpScreens { padding-top: 8px }`
guarantee the first card starts at **54 + 8 = 62 px** from the viewport top,
inside the 68 px ceiling at both 390×844 and 1280×800.

**Navigation** — `< 1024px`: `#tabbar` fixed bottom, 5 equal columns, 60px.
`>= 1024px`: `#tabbar` hidden, `#sdpSideRail` fixed left (54px → bottom), 232px,
and `#sdpLayout` gets `padding-left: 232px`.

---

## 3. Components

### Card
`.card` — `background: var(--bg-card); border: 1px solid var(--border);
border-radius: var(--radius); padding: 14px`.

### Buttons
| Class | Look | Use |
| --- | --- | --- |
| `.btn` | elevated surface + strong border | secondary action |
| `.btn-primary` | accent fill, dark ink | the one obvious next step |
| `.btn-accent` | emerald fill | "Finish & check" |
| `.btn-danger` | red outline | Reset local stats only |
| `.btn-sm` | 44px tall, 13px | dense rows, chips |
| `.hbtn` | 40px header button | header actions |
| `.seg-btn` | segmented control | Paper / Typing |

### Chips and pills
`.pill` / `.chip` — 999px radius, `aria-pressed="true"` flips to accent fill.
Always drive state through `aria-pressed` (or `aria-selected` for tabs); CSS
does the rest and screen readers stay correct.

### Inputs
`.input` — 48px tall, sunken background, strong border. `select.input` uses the
same shell. `#typeInput` is special: 56px tall, 20px text, 2px accent border,
created only in Typing mode.

### Beat ring
```html
<svg class="ring" viewBox="0 0 80 80">
  <circle class="ring-track" cx="40" cy="40" r="34"></circle>
  <circle id="beatRing" cx="40" cy="40" r="34" stroke="#38BDF8" fill="none"
          stroke-width="6" stroke-linecap="round" transform="rotate(-90 40 40)"></circle>
</svg>
```
The engine sets `stroke-dasharray="213.63"` and animates `stroke-dashoffset`
(`C × (1 − fraction)`), plus the `stroke` attribute for phase colour. The bar
below (`#beatBar`) mirrors the same fraction and colour.

### Self-check table
`#resultsTable` — sticky header, `.mark-btn` per row with
`data-mark="correct"|"missed"` and `aria-pressed`. Row class `is-correct` /
`is-missed` colours the word. `.r-diff` shows what the student typed in Typing
mode.

### Guide modal
`#guideModal` is a full-screen scrim with a bottom sheet on phones
(`align-items: flex-end`) and a centred card on `>= 720px`. Four `<li>` steps
with a 3px accent left border. `#guideLangPill` toggles language in place.

### Data toast
`#sdpDataToast`: `position: fixed; right: 10px; bottom: calc(var(--tabbar-h) + 12px);
max-height: 26px; pointer-events: none;` — text is `Loaded · N KB` or
`Offline ready · 0 KB`. It shows once per load, holds 2,400 ms, then
`.toast-hidden` fades it out in 400 ms. It is never clickable, so it cannot cover
a control.

### Credits shimmer
`.credits-pill` — uppercase 11.5px accent text in a hairline capsule; the `::after`
pseudo-element sweeps a 45%-wide light band (`@keyframes sdp-shimmer`, 3.4s,
infinite) and is disabled under `prefers-reduced-motion: reduce`. Text is always
exactly `CREDITS GOES TO Hansana`. It lives in `#creditFoot` on Home — never as a
floating badge over the player.

---

## 4. Sinhala typography

```css
@font-face { font-family: 'Noto Sans Sinhala'; font-weight: 400;
  src: url('../fonts/NotoSansSinhala-Regular.woff2') format('woff2'); font-display: swap; }
```

`../fonts/…` resolves from `assets/css/` to `assets/fonts/…`, i.e. the preserved
`./assets/fonts/` files. Applied to `.word-si`, `.si`, `[lang="si"]`, the credit
line in Sinhala mode, guide bodies and hint output. Latin text keeps Inter.

---

## 5. Language purity (W7)

`SDP.Views.applyLang('en'|'si')` rewrites every `[data-i18n]` node from
`STRINGS_EN` / `STRINGS_SI`, sets `<html lang>`, repaints the language pills and
re-renders dynamic regions (Home, Words, Practice, Guide, Settings, results).

- **EN mode:** no Sinhala characters anywhere in chrome. The only Sinhala on
  screen is the vocabulary card's `.word-si` meaning.
- **SI mode:** all chrome, buttons, labels, guide and beat states are natural
  Sri Lankan Sinhala. Proper nouns (`CCBE B1`, `Hansana`, `Ms. Sumodya Sewmini`,
  `Ayya01`, `Alice`, `ElevenLabs`), the IPA and the English target words are
  never translated.

Adding a string is a three-step change: add the key to `STRINGS_EN`, add the same
key to `STRINGS_SI`, then use `data-i18n="key"` or `Views.t('key')`.

---

## 6. Restyle in minutes

**Different accent colour (e.g. teal).**
1. `--accent: #14B8A6;` in `:root` (and `#0D9488` in light).
2. `grep -n "38BDF8" assets/css/sdp-ui.css` — update the shimmer gradient stops.
3. `data/sdp-dictation-engine.js`: `ringColor()` listening value.
4. `node tests/check.cjs && node tests/browser.cjs`.

**Taller header (e.g. 62px).**
1. `--header-h: 62px` in `:root`.
2. `#appHeader { height: var(--header-h) }` already follows the token.
3. Re-check the first-card offset: `62 + 8 = 70px` breaks the 68px ceiling, so
   reduce `#sdpScreens` top padding to `6px`. G5 asserts the ceiling.

**Rounder cards.**
`--radius: 18px; --radius-sm: 12px;` — nothing else hardcodes a radius.

**Sinhala-first default.**
`data/sdp-data-sync.js` → `defaultSettings().lang = 'si'`, and set
`<html lang="si">` in `index.html`. Then G3's purity test still passes because
`applyLang` is driven by settings, not by the static attribute.

---

## 7. Accessibility floor

- Landmarks: `<header>`, `<nav aria-label="Sections">`, `<main>`.
- Tabs expose `aria-selected`; the hidden screens get `aria-hidden="true"`.
- The guide is `role="dialog" aria-modal="true"` and moves focus to
  `#btnGuideClose` when it opens.
- `#beatStateText` and `#sdpDataToast` are `aria-live="polite"`.
- Focus is visible everywhere (`:focus-visible` 2px accent outline).
- Colour is never the only signal: marks carry `✅` / `❌` and words.

---

## 8. The About card (fifth settings section)

Settings is six `.set-card` sections in this order — the studio vault is always
sixth and last, collapsed:

| # | Section id | Audience |
| --- | --- | --- |
| 1 | study | student |
| 2 | display | student |
| 3 | audio | student |
| 4 | `#setProgress` (data & updates) | student |
| 5 | `#aboutCard` | student |
| 6 | `#studioAccordion` | lecturer only |

`#aboutCard` carries the version, the build date, a link to the `/data`
transparency page, the audience line and its own `.credit-foot` block — the
same `.credits-pill` (`CREDITS GOES TO Hansana`) and `.credit-line` used by
`#creditFoot` on Home. The ids are unique; the *content* must stay byte-equal:

```
Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu)
```

Never render this as a `position: fixed` badge over the cockpit — G7.2c/G7.2d
fail the build if the credits appear on `#screen-player` or if the footer
computes to `fixed`.

## 9. Empty and broken states are stated, never faked

| State | Home | Words tab | Engine |
| --- | --- | --- | --- |
| 0 words in the bank | `#bankEmpty` visible, `#btnStart` disabled, mastered shows `—` | `#dictEmpty` visible | `startDictation` refuses and toasts |
| corrupt progress | counters fall back to 0 | cards still render | `Data.progress()` returns defaults |
| corrupt settings | paper mode, defaults | — | `setMode` reads defaults |
| offline | shell from SW cache | cards from cached payload | audio falls back to TTS |

## 10. Typing mode submits on Enter

`#typeInput` accepts `Enter` (and `keyCode 13`) in **listening or writing**
phase: the value is stored on the item, the draft is saved, and the beat
advances — or finishes if it was the last word. Nothing else is bound to the
keyboard, and no other focus call exists.

## 11. The pre-paint cloak

`index.html` carries exactly one `<style id="sdpCloak">` block, under 400 bytes:

```
html,body{margin:0;background:#09090B;color:#FAFAFA;…}.screen{display:none!important}
.screen.active{display:block!important}
```

It exists so a budget Android on 2G never flashes five stacked screens before
`sdp-ui.css` arrives. It is the *only* allowed inline style in the app shell
(G9.3d enforces the 400-byte cap and the selector allow-list), and it carries no
layout rules — every real rule lives in the single stylesheet. The `/data`
transparency page is a standalone document and keeps its own inline sheet
(G9.3e).

---

**Credits — preserved verbatim, EN and SI.**
`CREDITS GOES TO Hansana` ·
Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu) ·
නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini

---

## v0.0.1.d UI additions

### Lecturer classroom sync bar (`#lecturerSyncBar`)

Sticky, full-width, at the top of Settings section 1 and rendered **only**
while `SDP.Studio.isUnlocked()` is true. It holds one primary button
`#btnSyncClassSettings`
(`data-i18n="lecturerSyncBar"`, `📡 Save & Sync Current Settings to All
Classroom Devices`) and the honest status line `#lecturerSyncLast`
(`data-i18n="lecturerSyncLast"`), which prints `Last synced to the class ·
HH:MM · Rev #N` after a successful publish.

### Locked Lecturer Studio (SEC-01)

The locked body is now **only**:

1. masked `#studioPin` (`type="password" inputmode="numeric" maxlength="8"`)
   with the `#pinDots` indicator,
2. the 56 px 12-key `#pinPad` (`1..9`, `#pinPadClear`, `0`, `#pinPadUnlock`)
   plus the ⌫ helper `#pinPadBack`,
3. `#studioMsg` and the hint `data-i18n="studioAskLecturer"`.

Zero key inputs, zero `#setupPin`, zero `#studioFirstTimePanel`, zero word
editor — in every vault state, including the placeholder
`SDP_ENC_V2:AAA=`.

### Quick Walkthrough Mode (`VOX-07`)

`#btnStart` (first Start of a session, `settings.guideAutoPlay !== false`)
opens `#guideModal` with title `data-i18n="guideQuickTitle"`, narrates Steps 1
and 2 in English and shows the primary
`#btnGuideSkipStart` (`⏩ Skip Guide & Start Immediately`). Skipping, or the
end of Step 2, closes the modal and starts the cockpit countdown.

### Touch targets

Every cockpit and Settings control is at least **48 px** tall (`.btn`,
`.btn-sm`, `.seg-btn`, `.pill`, `.mark-btn`, `select`, `.checkline`,
`.pin-key`). `assets/css/sdp-ui.css` ends with the enforced block.

### Honest badges and marks

- `#syncBadge` is composed at render time: `Synced · Session N · v<version>`
  (EN) / `සමමුහුර්තයි · N වන වාරය · v<version>` (SI). No version or session
  literal lives in `STRINGS_EN` / `STRINGS_SI` (ENG-06).
- `#btnToggleMissed` reads **Invert marks (tap twice)**
  (`data-i18n="invertMarks"`); the first tap arms the action for 3,000 ms
  (`data-confirm-arm="1"`), the second inverts all rows (ENG-07).

## v0.0.1.e UI additions

### The Bento home board (≥ 1024 px)

`#screen-home` is a two-column grid: `grid-template-columns: minmax(0, 7fr)
minmax(0, 5fr); gap: 16px` (the rule carries `!important` because
`.screen.active` sets `display:block !important`). Hero + stats + announcement
fill the wide left column; journey + Quick Practice the right; `#creditFoot`
spans the full row (`grid-column: 1 / -1`). Below 1024 px everything stacks in
one column with ≥ 48 px targets, exactly as before.

### Journey step badges

`.journey-list` is `list-style: none; padding-left: 0`; each `<li>` is a flex
row of a **28 px circular `.step-badge`** (accent fill, dark ink, `aria-hidden`)
plus the label span. The typed `1. `/`2. `/`3. ` prefixes are gone from
`STRINGS_EN`/`STRINGS_SI` — the badge IS the number.

### Quick Practice rich cards

`.practice-grid` (single column) holds four `.practice-card` buttons —
`min-height: 64px`, icon (`.prac-ico`) + title (`.prac-title`) + subtitle
(`.prac-sub`) — replacing the four small `btn-sm` chips. The click contract is
unchanged: `data-prac="flash|quiz|listen|weak"` and the same
`#homeQuickPractice [data-prac]` binding.

### Hero buttons

`.hero-actions .btn` is `flex: 0 1 auto` with `min-width: 176px;
max-width: 260px` — buttons size to their label instead of stretching to equal
columns on a Smart Board.

### The honest guide watchdog (D11)

`armGuideWatchdog()` fires at **700 ms** and checks `SDP.Speech.hasStarted()`
(the real `utter.onstart` flag) and `SDP.Speech.isAudioPlaying()` — never the
synchronous `isSpeaking()`. `#guideTapBanner` appears only when no real speech
started AND no cloud fallback audio is playing; the audio fallback itself is
four short British-English lines played through the shared `<audio>` element
(`state.lastTier = 'guide_audio'`).

### Language pills (D7)

`.lang-on`/`.lang-off` weight and the active side's accent + underline are
driven by `body[data-lang]`; `#setLang option[value=en]` is bold.

## §6 — v0.0.1.f components

### §6.1 Studio: three outcome cards under one lock header

`#studioBody` renders exactly one of two trees.

Locked (R5): `#studioPin` (`maxlength="12"`, `minlength="4"`, `inputmode="numeric"`),
`#pinDots` (12 spans, `data-dots` = `min(12, max(8, len))`, `.pin-dot-off` for the
spare dots), the 56 px `#pinPad` (1–9, Clear, 0, Unlock), `#pinPadBack`, the status line
and the "ask your lecturer" hint. No key field, no word editor, no publish control may
exist in this tree.

Unlocked: a `.studio-head` row with the title and `#btnLockStudio`, then

1. `#studioCardKeys` — `#elKeyInput` (+ Show/Paste/Test), `#ghTokenInput` (+ Show/Paste/
   Test), `#studioGasUrl`, `#studioAiProvider`, `#studioAiKey`, `#btnSaveKeys`,
   `#btnCheckQuota`/`#btnRefreshQuota`, `#btnTestOneWord`, `#btnGenClips`,
   `#studioForceRegen` (+ hidden `#chkForceRegen` mirror), `#btnOneClickMasterSetup`,
   `#studioMasterSteps`, `#quotaInspectorCard` with `#quotaText` and
   `#costPreviewLine`, `#clipPreviewTable`;
2. `#studioCardWords` — `#studioBulkWords` (names only), `#studioWords` (`w|p|pos|m|si|s`
   per line), `#studioCount`, `#btnEnrichWords`, `#btnPreviewWords`, `#btnPublishWords`,
   `#btnPublishWordsAndVoice`, `#studioWordManager` (30 rows × 6 editable cells keyed
   `data-wm="w|p|pos|m|si|s"`), `#studioPreview`;
3. `#studioCardSettings` — `#studioNewPin` + `#studioConfirmPin` (both 4–12 digits),
   `#btnStudioSyncSettings` (publishes the ten classroom keys with a bumped
   `settingsRev`), the lecturer recorder (`#btnStudioRecord`, `#btnCommitClip`,
   `#recPreviewAudio`).

### §6.2 One-click master setup

`#btnOneClickMasterSetup` ("One-Click Master Setup — Fix Everything") drives four
`li[data-state]` rows in `#studioMasterSteps`: idle → active → done (or `bad`):

1. verify the ElevenLabs key **and** the GitHub token;
2. save the encrypted vault and recompute `config.pinVerifier`;
3. delta-generate `_guide_1.._guide_4` + the 30 word clips (Alice);
4. publish all four JSON files on one `syncRev`, `version.json` last.

### §6.3 Cockpit and Home affordances

* `#playerRepeatBadge` — `Repeat <n> / <total>` while a beat is live.
* `#playerPausedBanner` — `Paused — resume word #k of 30`; `#btnPlayPause` relabels to
  `Resume Dictation (Word #k)`.
* `#homePresetBadge` — `Fast Exam · 5s · 2× · British English`, repainted from settings.
* `#btnResumeDraft` inside `#resumeBanner` — `Resume Paused Dictation (Word #k/30)`.
* `#guideAutoplayBanner` — 900 ms cold-boot affordance, `🔊 Tap Anywhere to Start Voice
  Guide` / `🔊 හඬ උපදෙස් ආරම්භ කිරීමට ඕනෑම තැනක ස්පර්ශ කරන්න`; hidden the moment
  `Speech.hasStarted()` or a real audio element is playing.

### §6.4 Language law

Every new string ships in `STRINGS_EN` and `STRINGS_SI` with identical keys; Sinhala
text may only appear inside `.word-si` (word data) and the Sinhala string table. The
credit pill `CREDITS GOES TO Hansana` and both credit lines are untouched.

---

## 10. Studio Card 1 after v0.0.1.h (D7, D10, D13, D14)

Card 1 is the only card a teacher must touch. It reads top to bottom:

1. **Green vault badge** `#studioVaultBadge` — `Vault Saved & Protected Across Updates`
   (`STRINGS_EN.vaultBadgeLabel`). Visible from the moment the vault is sealed, hidden
   while locked. It is the promise that the next release cannot eat the keys.
2. **Three credential rows**, one per secret — ElevenLabs, GitHub, and (for the optional
   back end) Apps Script + AI. Each row is an input plus a `[Show]` / `[Paste]` / `[Test]`
   trio; the input `type` flips between `password` and `text`, never a read-only label.
   After an unlock every input is auto-filled from `ST.secrets` **and stays masked** (D7).
3. **The AI provider select** `#studioAiProvider`, five slots in ladder order (D10):

   | Slot | `value` | Needs a key | Endpoint / prefix |
   | --- | --- | --- | --- |
   | 1 | `free_dict` | no | offline dictionary enricher (default) |
   | 2 | `pollinations_free` | no | `text.pollinations.ai/openai`, `model:'openai'` |
   | 3 | `groq` | yes, `gsk_…` | Groq chat completions |
   | 4 | `openrouter` | yes, `sk-or-…` | OpenRouter |
   | 5 | `gemini` | yes, `AIza…` | Google Gemini |

   Slots 1 and 2 show `#studioFreeNoKey` — `100% Free — No API Key Required!`. The badge
   is re-painted on every `change` and hides for slots 3–5 (G12.9a–e). A keyless slot
   omits the `Authorization` header entirely rather than sending an empty one.
4. **The diagnostics strip** — `#quotaText`, `#costPreviewLine` (`30 words = 241 chars`),
   `#btnTestOneWord` (a one-word, one-credit probe) and `#btnGenClips` (the delta
   generator that only makes the clips that are missing).
5. **One force-regen checkbox** `#studioForceRegen` (D14). `#chkForceRegen` still exists
   for old code paths, stays `display:none`, and is mirrored from the visible box on every
   `change` — never the reverse (G12.9k–l).
6. **The four master steps** `#studioMasterSteps` — one `<li>` per step, painted `active`
   → `ok` / `bad` as `oneClickMasterSetup()` walks them.
7. **The two-button primary bar** `.studio-primary-bar` (D13):

   | Button | Label (verbatim, `STRINGS_EN`) |
   | --- | --- |
   | `#btnSaveKeys` | `Step 1: Save Keys Permanently (Local Vault + GitHub Sync)` |
   | `#btnOneClickMasterSetup` | `Step 2: One-Click Generate British Professor Voices & Sync Everything to All Devices` |

   Nothing else lives in the bar. The old `#btnCheckQuota` / `#btnRefreshQuota` remain in
   the DOM for compatibility but are `display:none`; exactly one visible button says
   `Test ElevenLabs Key` (the ElevenLabs row's own `[Test]`), never two (G12.9m–r).

### 10.1 Honest states a teacher will see

| Situation | What the UI says |
| --- | --- |
| Key is real but scoped/free-tier | green: `studioQuotaScoped` — “key accepted, quota read bypassed” |
| Quota exhausted mid-generation | amber `studioElTierWarn`: the free British Female Professor voice takes over; the publish still happens |
| No AI key | neutral `studioFreeNoKey`: slots 1–2 work with no key at all |
| GitHub push failed during Save Keys | red toast `Saved in local Vault (protected across updates) · GitHub sync failed: <reason>` — the keys are **not** lost |
| Session leg failed, config leg verified | a quiet retry is queued (`deferredSession`); the badge stays green because the settings really did land |

### 10.2 The Sinhala face law (W7)

The Studio card is the densest Sinhala surface on the site, so it is also the one place a
missing font is obvious. Two rules make it correct:

* `--font-ui` ends in `'Noto Sans Sinhala'`, so a Sinhala glyph inside an English sentence
  (a class name, a teacher's note) renders in the shipped face instead of a system guess;
* `html[lang='si'] .studio-card { font-family: var(--font-si); }` switches the whole card
  when the language is Sinhala. Inputs, `#studioGasUrl` and any monospace rule keep their
  own family on purpose.

`#studioMasterSteps` is an `<ol>` and shows its numbers from the list marker alone; never
type `1 · ` into the label, or the card reads `1.1 · …` (that was a v0.0.1.f defect).

Every Sinhala string above ships in `STRINGS_SI` in the same commit; `G12.9t/u` fail if
either language is missing for the scoped-key note or the tier warning.
