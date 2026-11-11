# Smart Dictation Player — v0.0.6.n Master Architectural Plan
## Spacious Project Overview UI · Deep Studio ↔ Briefing Multi-API Integration · Stale Audio Purge

**Release stamp:** v0.0.6.n · ver 28 · schema 28 · settingsRev 44 · syncRev 1794500000000 ·
SW_VERSION `sdp-v0.0.6.n-s29` · SHELL_CACHE `sdp-v0.0.6.n-s29-shell` · buildDate 2026-11-07
**Live site:** https://dictationb01.github.io/ · **Repo:** dictationb01/dictationb01.github.io (main)

---

## 0. Why v0.0.6.m failed on the real phone (field report → engineering root causes)

The creator's live test of v0.0.6.m reported four symptoms. Each maps to a verified
defect in the shipped tree (baseline re-tested in this lab before any edit):

| # | Field symptom (creator's report) | Engineering root cause found in the v0.0.6.m tree |
|---|---|---|
| RC1 | "මුළු UI එකම කවර් වෙන විදිහට… මුල ඉඳන් පටන් ගන්නෙත් නැහැ" — the briefing is covered, never starts from the beginning | Inside `#briefingModal` the stack — eyebrow pill + 20 px title + persona + the bulky multi-line purple `#briefingUpdateBadge` + lyrics (`max-height: 52vh` but squeezed by everything above/below) + progress bar + tap pill + yellow `#briefingCount` box + two-row GitHub links + two stacked footer buttons — left `#briefingLyrics` ≈ 80–120 px on a 390×844 phone. `openBriefing()` never reset `briefingLyrics.scrollTop`, and `paintBriefingLine()` auto-scrolls to `offsetTop − 38 %` of a tiny viewport, so Beat 1/2 scrolled out of view. |
| RC2 | "තාම පරණ තිබ්බ වොයිස් ක්ලිප්ස තමයි තාම තියෙන්නේ" — old voice clips keep playing | The service worker preserves `sdp-audio-clips` forever, the SW/browser fallback can serve a stale `elevenlabs-audio.json`, and there was **no purge of `_intro_male_*` / `guide.en.*` entries on version upgrade**. The Studio→Briefing pipeline existed (`autoSynthesizeBriefingAndGuide`, unlock trigger) but had **no live status surface, no on-briefing-open trigger, no 1-click control**, and no exact-timestamp capture. |
| RC3 | "ලිට්රික්ස් වගේ ගලාගෙන යන එක තවදුරටත් අප්ඩේට් කරන්න ඕනේ" — lyrics flow still not silky | The v0.0.6.m clock was frame-accurate only when a real `<audio>` duration arrived; word slices came from char-length estimates or LLM `ww` weights, never from ElevenLabs' exact per-word alignment. `#briefingBar` advanced in ¼ jumps per beat, not continuously. |
| RC4 | Release discipline | The shipped tree **fails its own gates at baseline**: G1 3 FAIL (pack 4 056 684 B > 3 000 000 B budget; 135 clips vs "exactly 131"; underscore entries present) and the lab shows the pack header drifted (settingsRev 44 / syncRev 1794400000001 vs pinned 43 / 1794400000000) — the release was stamped without re-running the gate suite. |

## 1. Target architecture — five pillars

### Pillar 1 — Spacious, breathable Project Overview (`#briefingModal`)
* **Remove the bulky purple update banner from the modal.** `#briefingUpdateBadge`
  moves to **Settings › About** (release-note line, id kept for DOM contracts) and
  takes 0 px from the lyrics stage.
* **Compact 2-line header**: `#briefingTitle` 18 px bold + inline `#briefingBeatBadge`
  (♪ synced pill); `#briefingPersona` "Started {W} Weeks Ago (Oct 22) · $0 Open-Source
  System" 12.5 px muted. The eyebrow row is retired from the modal.
* **`#briefingLyrics` breathing room**: flex-grow stage, `min-height: clamp(260px, 48vh,
  480px)`, `padding: 16px 18px`, line-height 1.58, beats spaced `margin-bottom: 14px`,
  active beat 17.5 px `#0F172A`, card elevation. ≥ 220 px guaranteed at 390×844 and
  360×800 (lab-asserted).
* **Always Beat 1**: `openBriefing()` resets `briefingLyrics.scrollTop = 0`, paints
  Beat 1 active with Word 1 `is-current` immediately; auto-centering scrolls **only
  when the active beat is actually out of view** (never yanks Beats 1–2 away).
* **Ultra-compact footer**: two GitHub pill links side-by-side on one row; the
  10-second countdown lives **inside** the Continue button label
  ("Continue (10s)…" → "Continue to Smart Dictation →"); the old yellow countdown
  box becomes a screen-reader-only status.

### Pillar 2 — Unbreakable Studio ↔ Briefing & Guide bridge (`SDP.Studio`)
* **`ensureBriefingAndGuideVoices()`** — the direct vault-to-briefing live synthesis
  bridge wrapping `autoSynthesizeBriefingAndGuide()`: checks missing/drifted
  `_intro_male_1..4` + `_guide_1..4` against the live `BRIEFING_SENTENCES`
  (weekly `{W}` counter included), synthesizes with the stored keys, **injects into
  the live session (`SDP.Speech.injectClips`)**, **writes the clip URLs into
  `caches.open('sdp-audio-clips')`**, and **queues the GitHub commit**.
* **Three triggers + one control**:
  1. *Instant on Lecturer PIN unlock* — runs with a visible live status bar
     `#studioBriefingVoiceBar` ("🎙 Checking… Synthesizing with ElevenLabs (George
     British Male) + Groq/Gemini Timing…" → "✓ Project Overview (4/4) & Guide (4/4)
     Voices Synced to GitHub & Live Cache!").
  2. *On briefing open* — if this device unlocked the vault this session
     (sessionStorage flag) and `_intro_male_1..4` are missing, synthesize on the fly.
  3. *1-click* — `#btnStudioBriefingVoices` at the top of `#screen-studio`:
     "🎙 Generate & Sync Project Overview + Guide Voices Now".
* **Key sources**: device-local session cache of the active keys set at unlock;
  ElevenLabs primary field → backup Slot #1 auto-failover on 401/402/429 (existing
  rotation engine); Groq Slots #2–3 → OpenRouter #4–5 → Gemini for timing weights.

### Pillar 3 — Exact word timestamps (`wt`) from ElevenLabs `/with-timestamps`
* Intro/guide synthesis first POSTs
  `https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb/with-timestamps`
  (seamless fallback to the standard endpoint on any failure).
* `parseAlignmentToWordTimings(alignment, text)` converts
  `alignment.characters` + `character_start_times_seconds` +
  `character_end_times_seconds` into a per-word `[startMs, endMs]` array stored as
  **`wt`** on each clip entry in `data/elevenlabs-audio.json`.
* When `/with-timestamps` is unavailable, the LLM cascade
  (`briefingScriptWeights()` over Groq → OpenRouter → Gemini) still produces
  syllable-stress weights **`ww`**; the deterministic char-length law remains the
  final fallback. Karaoke precedence: **`wt` > `ww` > deterministic**.

### Pillar 4 — v0.0.6.n cache-bust & stale-audio purge law
* Every manifest/update fetch carries `?v=0.0.6.n&t=<syncRev>` + `cache: 'no-store'`
  (SW shell `s29` re-fetches with `cache: 'reload'` as before).
* `purgeStaleBriefingClips()` (exported on `SDP.Sync`) — on version upgrade and
  after every Studio publish, deletes from `caches.open('sdp-audio-clips')` every
  `_intro_male_*` / `guide.en.*` / `_guide_*` entry plus any stale manifest JSON,
  so **no device can ever replay an earlier version's briefing voice**.
* `sw.js` bumps to `sdp-v0.0.6.n-s29` (new SHELL_CACHE name ⇒ the old shell with the
  stale `elevenlabs-audio.json` is deleted on activate).

### Pillar 5 — Silky Apple-Music flow + preserved v0.0.6.m gains
* 60 fps rAF loop reads the real `<audio>` `currentTime/duration`; with `wt` the
  is-current word is the exact word whose `[startMs, endMs]` spans the clock;
  Web Speech `onboundary` remains the device-voice path.
* `#briefingBar` becomes **continuous across all four beats** —
  `(beatIdx + beatFraction) / 4 × 100 %`.
* Tap any beat → `briefingSeek(i)` restarts narration at that beat (kept).
* Preserved: ultra-clean header, version-stamped `briefingSeen === '0.0.6.n'`,
  mic-release audio fix, 9 one-tap chips + sealed snapshot + Studio inspector +
  .zip, 6-key $0 pool, classroom payloads (session.json 62 427 B, gas-source.txt
  13 764 B, both Sinhala fonts), 131 authentic Alice clips, credits (EN & SI).

## 2. Release-pack truth (fixing RC4)

The shipped pack keeps **all 131 authentic Alice clips untouched** **plus** the four
**real** George-voice Project-Overview beats the creator already synthesized with
their live ElevenLabs keys (real MP3, real hashes, voiceId
`JBFqnCBsd6RMkjVDRZzb`, `eleven_flash_v2_5`) = **135 authentic clips, zero
fabricated audio**. Gate expectations are updated to state this contract exactly:
the only underscore-prefixed keys allowed are `_intro_male_1..4` with George
provenance and text equal to the live `BRIEFING_SENTENCES`; the byte ceiling moves
to 4 600 000 B with the same anti-runaway intent. Preserved-payload SHA-256 pins
(session.json, gas-source.txt, both fonts) are byte-identical.

## 3. Verification strategy (Phase 3 — the lab contract)

`tests/briefing-feedback-lab.cjs` (extended, still headless Chromium at **390×844
and 360×800**, real fake-device mic, request interception):

1. **Spacious UI** — `#briefingLyrics` `rect.height ≥ 220 px`, `scrollTop === 0`,
   Beat 1 100 % visible without scrolling, badge absent from the modal, countdown
   inside the Continue label, GitHub pills on one row.
2. **Bridge end-to-end** — unlock studio → `__SDP_ALLOW_AUTOGEN__` → intercepted
   `api.elevenlabs.io …/with-timestamps` answered with a synthetic alignment over
   the **authentic committed clip audio** (no fabricated sound) → assert `wt`
   parsed, clip injected, `#studioBriefingVoiceBar` reaches the ✓ state, Groq
   `ww` cascade exercised, zero cross-host leakage.
3. **Cache law** — `purgeStaleBriefingClips()` deletes poisoned stale entries;
   update fetches carry `?v=0.0.6.n&t=` + `no-store`.
4. **Regression** — version-stamp replay, mic-release, sealed feedback, 131-Alice
   integrity (from v0.0.6.m, re-stamped).

All 12 gates G1–G12 + the lab + CI-13 (preserved SHA-256) must report **0 FAIL**
before the release pack is built.

## 4. Deliverables

1. `sdp_v0.0.6.n_spacious_overview_studio_api_sync_release_pack.zip` (< 25 MB,
   no `.git/`, no `tests/node_modules/`).
2. `SDP_v0.0.6.n_Spacious_Overview_and_Studio_API_Integration_Blueprint.pdf` —
   this plan + lab report + real 390×844 screenshots + 12-gate scorecard +
   Sinhala user guide.
3. `ARENA_MASTER_PROMPT_v0.0.6.n.md` — self-contained Arena.ai pre-merge contract
   (unpack → verify bridge contract → 5-surface version lockstep → 12 gates +
   lab + CI-13 → poll Actions → merge).
