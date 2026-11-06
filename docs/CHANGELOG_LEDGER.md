## v0.0.6.m — 2026-11-06 — Real API-Driven Briefing & Guide Voices (Zero Sandbox Clips), Version-Stamped Briefing Reset, Frame-Accurate Lyrics, Mic-Release Audio Fix & Full UI/Cache Snapshot Feedback

**Release type:** architectural-integrity + trust release over the live v0.0.6.l main, driven by the creator's real-phone audit. The v0.0.6.l build had baked Z.ai-sandbox-synthesized clips into `data/elevenlabs-audio.json` (round-midnight timestamps, `_intro_male_1..4` + `_guide_1..4`) so `autoEnsureSystemClips()` believed the beats were already generated and never called the creator's real ElevenLabs keys. v0.0.6.m deletes all 8 fabricated entries — the shipped pack is exactly the **131 authentic Alice classroom clips** (91 words + 30 numbers + 6 commands + 4 guide.en) — and the beats are re-synthesized ONLY on the creator's unlocked device through the stored API keys. No classroom-data migration: `data/session.json` (62,427 B, `931037f7…`), `data/gas-source.txt` (13,764 B, `591b9b08…`), both Sinhala fonts and the 131 Alice clips stay byte-identical.

**Stamp:** `appVersion/version '0.0.6.m'` · `ver 27` · `schema 27` · `settingsRev 43` · `syncRev 1794400000000` · `SW_VERSION 'sdp-v0.0.6.m-s28'` / `SHELL_CACHE 'sdp-v0.0.6.m-s28-shell'` · `TARGET='0.0.6.m'` · `BETA_SUBVERSION '0.0.6.m.beta'` · `buildDate 2026-11-06`. The five lockstep files (`tests/check.cjs`, `tests/audit-v42.cjs`, `.github/workflows/checks.yml`, `data.html`, `data/index.html`) move in lockstep; the new `tests/briefing-feedback-lab.cjs` gate joins `TEST_FILES` and CI Step 13b.

* **Fix 1 — zero fake clips; real API-driven briefing & guide audio (studio/speech/pack)**: the shipped pack may never contain a fabricated (`_`-prefixed) entry (LB4/LB4a). `autoSynthesizeBriefingAndGuide()` orchestrates on the creator's unlocked device — Step A (`briefingScriptWeights`) asks the stored Groq/OpenRouter/Gemini keys for per-word syllable timing weights (stored on the clip entry as `ww`, consumed by the karaoke clock; deterministic char+pause weights always remain the fallback), Step B synthesizes `_intro_male_1..4`, `_guide_1..4` and `_cmd_*` with the real ElevenLabs keys (primary → backup failover, George `JBFqnCBsd6RMkjVDRZzb` / Daniel `onwK4e9ZLuTAKqWW03F9`, `eleven_flash_v2_5`, `voice_settings {stability:0.55, similarity_boost:0.80, style:0.25}`) and auto-commits to GitHub, Step C fires on unlock, Publish & Sync and the explicit Generate button, and Step D (before first publish / offline) narrates through the pinned British-male Web Speech persona. `llmRequest` now also returns the raw response text so the weights parser can read the strict-JSON `{"lines":[{"n":1,"ww":[...]}]}` payload.
* **Fix 2 — version-stamped briefing reset + frame-accurate karaoke (views/speech)**: `briefingSeen()` now compares `settings().briefingSeen === APP_VERSION` (never `1`), so 100% of devices that saw any older build (which stored `briefingSeen: 1`) replay the updated briefing the moment v0.0.6.m deploys. The word-by-word flow (`is-spoken`/`is-current`) is driven by the REAL playback clock — `playUrl()` pumps `hooks.onTick(el.currentTime, el.duration)` per `requestAnimationFrame` (30 ms fallback) from the `playing` event, the Web Speech tier maps `onboundary(charIndex)` to the word index, words are weighted by length + punctuation pauses (`,` +140 ms, `—` +180 ms, `.` +240 ms) or the AI `ww` weights, and the estimate timer survives only as a last-resort stall guard.
* **Fix 3 — the post-feedback dictation audio fix (views/speech/engine)**: `releaseFeedbackAudioLocks()` now runs on EVERY path — recording stops, review sent or skipped, drawer closed, card hidden, and before every dictation word / start / resume. It stops every active `MediaRecorder`, stops and nullifies every `MediaStreamTrack` (the mobile OS exits Voice Communication / Mic Capture mode at once), aborts any `SpeechRecognition`, and `SDP.Speech.recoverAudioSession()` resets the shared `<audio>` (volume 1.0, muted false) and unsticks `speechSynthesis` (cancel + resume). The engine's word hook also calls it, so Word #1 after a closed review speaks crisply.
* **Fix 4 — 9 one-tap chips + automatic full UI/DOM/Cache/Audio snapshot (index/sync/studio/views)**: the review card and FAB drawer both ship the 9 chips (`fast`, `voice_ok`, `voice_muted`, `voice_robotic`, `briefing_sync`, `incomplete`, `ui_layout`, `clock_stuck`, `cache_stale`). `SDP.Diagnostics.captureFullUiSnapshot()` seals (AES-GCM SDP_ENC_V2) the viewport/DPR/overflowX, theme/lang/mode, rects+visibility of `#appHeader`, `#ringWrap`, `#btnPlayPause`, `#tabbar`, `#briefingModal`, `#reviewPopupCard`, the SW + CacheStorage + localStorage byte sizes, `voicePackClipsCount`, intro-presence, `lastTierName`, `voicesCount`, `micReleased` and the last 10 audio errors — on BOTH Send and Skip. The Studio's User Reviews drawer renders the per-review `🔍 Inspect UI & Cache Snapshot` details (`renderUiSnapshotHtml`), the `.zip` gains `ui-snapshots.json`, and `Data.pushReviewEnvelope()` pushes the sealed envelope to the configured cloud relay (digest form; the full envelope stays durable on-device and in the export).
* **Lab environment (Phase 2)**: `tests/briefing-feedback-lab.cjs` runs the five scenarios in headless Chromium (upgrade reset, 131-authentic pack + real-API-only synthesis, clock-driven karaoke, mic-release playback, snapshot-sealed feedback) before any release is packaged.

Gates: G1 178, G2–G12 in lockstep — 12/12 green, 0 FAIL, plus CI Step 13 (preserved SHA-256 pins) and the new Step 13b lab gate.

## v0.0.6.l — 2026-11-06 — Dynamic Oct-22 Weekly Briefing, Real British-Male Intro Clips, 6-Key $0 Pool, Instant Review Popup, Floating Feedback Launcher & Session Authenticity Telemetry

**Release type:** human-factors + automation release over the live v0.0.6.k main, driven by a real fresh-Chromium audit of how a brand-new student actually experiences the first 30 seconds (silent/skipped briefing audio, a robotic browser voice, and a review card buried under 30 result rows). No classroom-data migration: `data/session.json` (62,427 B, `931037f7…` — the LIVE Session 8 feelings list the lecturer published in v0.0.6.k, preserved byte-for-byte), `data/gas-source.txt`, both Sinhala fonts and all **131** committed Alice clips stay byte-identical; the voice pack only GAINS the four committed real British-male briefing beats (`_intro_male_1..4`, 135 clips total). **0 ElevenLabs credits spent** (the baked beats use a preview British-male narrator at zero cost and are auto-refreshed to the ElevenLabs George voice by `autoEnsureSystemClips()` on the next Studio unlock/Publish with a configured key).

**Stamp:** `appVersion/version '0.0.6.m'` · `ver 26` · `schema 26` · `settingsRev 42` · `syncRev 1794300000000` · `SW_VERSION 'sdp-v0.0.6.l-s27'` / `SHELL_CACHE 'sdp-v0.0.6.l-s27-shell'` · `TARGET='0.0.6.m'` · `BETA_SUBVERSION '0.0.6.l.beta'` · `buildDate 2026-11-06`. The five lockstep files (`tests/check.cjs`, `tests/audit-v42.cjs`, `.github/workflows/checks.yml`, `data.html`, `data/index.html`) all carry the `931037f7` session pin — the stale `26bf2f9a` pin (the v0.0.6.j-era words) that kept the v0.0.6.k CI red is retired.

* **Pillar 1 — the Dynamic Oct-22 Weekly Briefing (views/speech/index/css/manifest)**: the week label is now COMPUTED (`PROJECT_START_ISO = '2026-10-22'`, `weeksSinceStart() = max(2, floor((now − start)/7d))`) so "Started N Weeks Ago" bumps itself every week in `#briefingPersona` and inside Beat 1 (`{W}` token) without a code edit — plus the compact `#briefingUpdateBadge` ("Latest Weekly Update (v0.0.6.l)"). The script is the creator's exact 4-beat spec: (1) purpose + Oct-22 start + $0 open-source GitHub Pages, (2) the **100% E2EE privacy law upfront** (no personal data shared, no unnecessary data collected, session diagnostics and reviews end-to-end encrypted), (3) the automated Lecturer Mode + the voice-or-text review request, (4) the succinct creator note. Narration is **word-by-word karaoke flow**: every beat tokenizes into `.b-word` spans that illuminate in sequence (`is-spoken`/`is-current`, clip-duration-weighted) while all four beats stay visible for read-ahead/read-back. The four beats ship as **committed real warm British-male audio** (`_intro_male_1..4`) so a fresh session hears studio narration — and the **fresh-Chrome autoplay handshake** fixes the silent-skip flaw for good: a `NotAllowedError` from `Audio.play()` (or a `speechSynthesis` with zero voices) resolves `{autoplayBlocked}` and the briefing HOLDS the beat behind a pulsing `#briefingTapPill` ("🔊 Tap Anywhere to Start Voice Briefing"); the very first tap anywhere on the modal restarts the narration gesture-unlocked. Never a robotic voice, never a silent skip.
* **Pillar 2 — the exact 6-key $0 pool + 100% automatic system audio (studio)**: `POOL_DEFAULT_PROVIDERS = ['elevenlabs','groq','groq','openrouter','openrouter']` — the primary ElevenLabs key (Step 1) + Slot #1 the ElevenLabs Key #2 backup (instant HTTP 401/402/429/quota failover mid-batch), Slots #2-3 the two Groq free-tier keys, Slots #4-5 the two OpenRouter free-model keys (`llama-3.3-70b:free`); the AI verification cascade is Groq #1 → Groq #2 → OpenRouter #1 → OpenRouter #2 → the free dictionary APIs — 100% $0. **`autoEnsureSystemClips()`** runs on every Studio unlock and every Publish & Sync: the essential system clips (`_cmd_play/_cmd_pause/_cmd_resume/_cmd_complete` under their canonical `cmd.*` keys, `_guide_1..4`, `_intro_male_1..4`) are checked for MISSING or TEXT-DRIFTED (e.g. the week counter bumping the Beat 1 sentence) state and only the delta is synthesized and committed — the creator only ever updates the 30 Dictation Words by hand.
* **Pillar 3 — the instant review popup + dual-engine voice recorder + floating launcher (views/index/css)**: the review card MOVED from below the 30 result rows to `#reviewPopupCard` — a compact high-visibility card at the very top of the results view (verified: `reviewCardTop 858px → inside the first viewport`) asking "How was your dictation session? Help us improve in 1 tap:" with **five human-centric 1-tap chips** (⚡ Fast & Smooth · 🔊 Voice Clear · 🔇 Voice/Pronunciation Issue · ⏳ Dictation Words Incomplete · 🐞 UI/Button Issue); picking any chip immediately highlights Send Review. The voice review is **dual-engine**: `MediaRecorder` captures a REAL compact audio clip (opus/mp4, ≤ 20 s, base64 inside the E2EE payload) while `SpeechRecognition` transcribes live in parallel, with a live "🔴 Recording 0:04… Tap to Stop & Attach" timer and a ▶ preview player so the student can hear their own recording before sending. The floating corner `#sdpFeedbackFab` ("💬 Feedback / Help", above `#tabbar` on phones / bottom-right on desktop, one-time "Spot an issue? Tell us" micro-badge, z-index below every modal so it can never cover a dialog) opens `#sdpFeedbackDrawer`: offline-first troubleshooting (Audio / Pacing / Paper vs Typing / Sync — 0 AI credits) and voice/category/text review submission from ANY screen.
* **Pillar 4 — Paper-mode ergonomics + session authenticity telemetry (engine/views/studio/sync)**: `#btnMarkAllCorrect` ("✓ Mark All Unmarked as Correct") fills ONLY the unmarked rows — a paper-mode student taps Missed on the one or two wrong words, then one tap finishes the rest (explicit Missed marks are preserved; the old `#btnMarkAll` overwrote them). `SDP.Engine` now tracks `startedAt/endedAt`, `wordsCompletedCount` (words that reached their full listen/write beat vs manual Next jumps), `rapidSkipCount` (Next within 2.5 s of a word start), and the marked/unmarked counts; `analyzeSession()` classifies **GENUINE_FULL** (≥ 25 full words and ≥ 90 s) / **RAPID_SKIP_SUSPECT** (≥ 10 rapid skips, or 30 words "finished" under 45 s) / **PARTIAL_INCOMPLETE**. The verdict is sealed inside the AES-GCM review envelope on **BOTH** "Send Review" AND "Skip — No Thanks" — a skip never loses the telemetry. The Studio gains the dedicated **`#studioCardReviews` drawer (👨‍💻 User Reviews & Session Telemetry — Developer/Creator Vault)**: summary counters (sessions analysed, genuine vs rapid-skip, voice/text reviews, top reported issue), the `#studioReviewsList` per-session feed with authenticity badges (✓ Genuine · 6m 12s / ⚠ Rapid Skip · 18s (27 skips) / ⏳ Incomplete · 12/30 words), chip list, note and ▶ Play Student Voice Recording, plus `#btnDownloadReviewsZip`. The .zip bundle grows to six artifacts with the new `session-telemetry.json`; `diagPersistNow()` is now quota-safe (a large voice note drops the OLDEST sealed reviews, never the ring).
* **Preserved verbatim**: the ultra-clean header (brand + EN|SI + theme only), the 10-second timed gate law, the five localStorage keys, the publish order, the 131 Alice clips, and the live classroom payload. Zero "21-year-old"/"21yo"/"වයස 21" strings; zero external AI tool names in the briefing.
* **Budgets in lockstep (never silently)**: index 56,455 ≤ 58,000 · css 124,548 ≤ 128,000 · sync 103,348 ≤ 106,000 · speech 62,217 ≤ 63,000 · engine 68,581 ≤ 78,000 · views 220,837 ≤ 226,000 · studio 230,351 ≤ 234,000 (G9.3a monolith line 216,000 → 232,000) · voice pack 3,371,978 ≤ 3,600,000 (the four baked beats add ~491 KB) · G9.2e test-suite ceiling 356,000 → 372,000.
* **Gates**: 12/12 green, **0 FAIL — 888 assertions** (G1 165 · G2 12 · G3 122 · G4 8 · G5 107 · G6 15 · G7 58 · G8 39 · G9 47 · G10 38 · G11 74 · G12 103) + the CI preserved-payloads step (`931037f7` across all five lockstep files); new dedicated assertions G1 §13 (CB1–CB8, the new LB1–LB5 briefing-law series, KP1–KP9, the new LP10 auto-ensure, RV1–RV6, LF1, LT1–LT4, DZ1–DZ3); `data.html`/`data/index.html` byte-identical; ES5 + line ceilings hold.

## v0.0.6.j — 2026-11-06 — Creator Briefing, Multi-API Key Pool, Post-Session Reviews & Encrypted Diagnostics (Beta 0.0.6.j.beta)

**Release type:** feature-pillar release over the live v0.0.6.i main, introduced completely through the governed Beta channel (`?beta` / `#beta` / the header `#sdpBetaPill` → `BETA_SUBVERSION '0.0.6.j.beta'`) while staying fully live and verifiable on the main cockpit. No classroom-data migration: `data/session.json` (55,764 B, `ee7b5294…`), `data/gas-source.txt`, both Sinhala fonts and all **131** committed Alice clips stay byte-identical (`data/elevenlabs-audio.json` header only re-stamped to ver 24 / schema 24; not one clip dropped). **0 ElevenLabs credits spent.**

**Stamp:** `appVersion/version '0.0.6.j'` · `ver 24` · `schema 24` · `settingsRev 40` · `syncRev 1794100000000` · `SW_VERSION 'sdp-v0.0.6.j-s25'` / `SHELL_CACHE 'sdp-v0.0.6.j-s25-shell'` · `TARGET='0.0.6.j'` · `BETA_SUBVERSION '0.0.6.j.beta'` · `buildDate 2026-11-06`.

* **Pillar 1 — Creator Briefing, live synced transcript (views/speech/index/css)**: a brand-new visitor first meets `#briefingModal` — an Apple-Music-style narrated Creator Briefing. Eight short, warm, simple-English beats (A/Ls in Combined Maths / Physics / Chemistry finished two months ago; very little formal ICT education — architected and developed by Hansana, powered by multiple autonomous AI agents hosted and orchestrated on his own system, guided purely by his critical thinking; not seeking attention — a personal problem-solving testbed that genuinely makes him happy seeing you use it; $0 invested, 100% free and open-source with the repository link; a side testbed beside the RDB project and a massive flagship project for the future of IT; lag-free on any device with a fully automated Lecturer Mode pipeline; end-to-end encrypted voice/text reviews; welcome). The active sentence highlights in large type (19 px, `#0F172A`) while past/upcoming sentences stay readable at 0.45/0.62 opacity with smooth auto-scroll, a live `#briefingBar` progress bar and tap-to-seek. The narration uses the committed `_intro_male_1..8` clips when published, otherwise a pinned British male device voice (`Speech.pickMaleVoice()` + `say({persona:'male'})`, `en-GB`, pitch 0.95) — never the female professor. **The 10-second timed gate law**: `BRIEFING_GATE_MS = 10000`; both `#btnBriefingContinue` and `#btnBriefingSkip` stay disabled with a live `Please listen / read (10s)…` countdown and `closeBriefing()` refuses any dismissal while gated; after 10s (or when narration finishes) the CTAs unlock, completion is stamped once inside `sdp.settings.briefingSeen` (the five-key R8 law holds) so returning students mid-class are never blocked, and the `#btnCreatorNote` header pill replays it anytime. The briefing text never names any external AI tool — G1 §13 CB7 enforces the creator-story purity verbatim.
* **Pillar 2 — Multi-API key pool + British pronunciation pre-verifier + permanent static clip vault (studio)**: the Lecturer Studio vault gains a **five-slot Multi-API Key Pool** (`Key Slot #1..#5`, provider selects for ElevenLabs / Gemini / OpenRouter / Groq / Cloudflare Workers AI) sealed inside the same SDP_ENC_V2 vault; `resolveElevenKey()` walks the pool in slot order and `rotateElevenKey()` performs **automatic mid-batch rotation** on HTTP 401/402/429 (retrying the same clip once per remaining key so a dead or throttled free key never kills the batch), `probePoolKeys()` checks pool health via the zero-cost subscription read. Before any word is synthesized, `verifyPronunciationWord()` runs an **AI British Pronunciation & Lexical Verification Pass** (provider cascade across the pool) that verifies and normalizes Cambridge B1 British IPA (`britishizeIpa()` maps US rhotic ɝ/ɚ onto non-rhotic ɜːr/ə), part of speech, the B1 meaning, the Sinhala meaning, the example sentence and a phoneme-guided `ttsHint` for authentic RP clarity; every word-manager row gains a **♪ Verify & Preview Pronunciation** badge and a **⟳ Re-synthesize Single Word** button — one word, one click, the other 29 committed clips untouched. The **Permanent Static Clip Vault** (`STATIC_CLIP_KEYS`: 6 commands + 30 numbers + 4 guide steps + 8 intro beats) is locked by SHA-1 content hash and skipped 100% by delta generation (`isStaticClipKey()` guard + the honest `Static vault N/52 locked | Key pool N/5` dashboard line); the pack arithmetic is now 78 clips (30 words + 30 numbers + 6 commands + 4 guide steps + 8 intro steps).
* **Pillar 3 — frictionless post-session review + end-to-end encrypted diagnostics .zip (views/sync/studio)**: finishing a session surfaces the optional, skippable `#reviewCard` — 🎤 Record / Speak Review via the Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`, English **or** Sinhala `si-LK`), quick text input, 1-tap rating pills (⚡ Fast & Smooth · 🔊 Voice Clear · 🐞 Found an Issue) and the verbatim badge `🔒 100% End-to-End Encrypted — Your privacy is completely protected.` Reviews are sealed with the same SDP_ENC_V2 AES-GCM envelope (device-local key, `SDP.Diagnostics.captureReview()`) before they ever touch storage. `SDP.Diagnostics` is the new bounded privacy-safe ring buffer (160 events inside `sdp.settings.sdpDiag`) capturing audio-tier fallbacks, clip load errors, pronunciation flags, session completion stats, boot/viewport responsiveness and review captures. The unlocked Studio ships the **Troubleshooting & Session Diagnostics Vault** card: a live `#diagSummary` grid and `#btnDownloadDiagZip`, which builds a real standard `.zip` entirely in-browser with a pure ES5 table-driven CRC-32/STORE writer (zero external library bytes) containing `diagnostics-log.json`, `student-reviews.json` (decrypted in-studio), `session-snapshot.json`, `config-snapshot.json` and `README-DIAGNOSTICS.txt`.
* **Beta channel, governed (views/index/css)**: the v0.0.6.i A6 retirement is reversed BY DESIGN — `#sdpBetaPill` + `#sdpBetaStamp` + `betaActive()` / `applyBetaChannel()` + `BETA_SUBVERSION '0.0.6.j.beta'` are back; `?beta` / `#beta` stamp the channel and replay the Creator Briefing (`?b=1` stays a non-alias; the clean URL stays Main). Every v0.0.6.j feature is live on the main cockpit by default — testable on a phone immediately.
* **Preserved verbatim**: the dictation clock / ring / Play-Pause state machine (CF1), the pinned mobile `#tabbar` (CF2), the One-UI Settings (CF3), the strict Daylight / light-mode immunity shield (A1), the EN+SI credits lines and pill, the five localStorage keys, the publish order and the one `nextSyncRev()` clock.
* **Budgets in lockstep (never silently)**: index 52,261 ≤ 56,000 · css 116,931 ≤ 120,000 · sync 100,719 ≤ 106,000 · speech 58,271 ≤ 63,000 · views 192,736 ≤ 196,000 · studio 207,389 ≤ 212,000 with the G9.3a monolith line moved 200,000 → 210,000 in lockstep after a 21.9 KB comment-compaction pass; TEST_BUDGET 344,000 across both tables; docs caps unchanged.
* **Gates**: 12/12 green, **0 FAIL — 764 assertions** (G1 147 · G2 12 · G3 122 · G4 8 · G5 103 · G6 15 · G7 58 · G8 39 · G9 47 · G10 38 · G11 74 · G12 103) + the CI preserved-payloads step; new dedicated assertions G1 §13 (CB1–CB8 briefing, KP1–KP6 pool, RV1–RV4 review, DZ1–DZ3 zip), G3 §3b (G3.13a–m: the 10s gate ticks, the hand-over to the guide, the completion stamp, replay, sync highlight), G5 §13 (the governed beta channel state at ?beta/#beta/?b=1/clean) and the G7 §1 first-visit briefing journey; `data.html`/`data/index.html` byte-identical; ES5 + line ceilings hold.

## v0.0.6.i — 2026-11-06 — Unified Permanent Main Production UI (CF-UNIFIED-MAIN)

**Release type:** unification release over the live v0.0.6.h main. The creator asked for the top-bar Preview/Beta switcher to be completely removed and everything merged into ONE permanent, rock-solid Main Production UI that can never be toggled off. No classroom-data migration: `data/session.json` (55,764 B, `ee7b5294…` — the live Session 8 list, entertainment…heroine), `data/gas-source.txt`, both Sinhala fonts and all **131** committed Alice clips stay byte-identical. The release pack in this branch shipped an OLDER `session.json` (61,576 B, `fadde370…`, the important…terrible list) and a 101-clip voice pack; both were rejected at apply time so no classroom content was lost. **0 ElevenLabs credits spent.**

**Stamp:** `appVersion/version '0.0.6.i'` · `ver 23` · `schema 23` · `settingsRev 39` · `syncRev 1794000000000` · `SW_VERSION 'sdp-v0.0.6.i-s24'` / `SHELL_CACHE 'sdp-v0.0.6.i-s24-shell'` · `TARGET='0.0.6.i'` · `buildDate 2026-11-06`.

* **CF-UNIFIED-MAIN (index/views/css)**: `#sdpBetaPill` (the "Preview" toggle pill in `#appHeader`), the `#sdpBetaStamp` floating badge, the `sdp_beta_preview` localStorage flag, `betaActive()` / `applyBetaChannel()` and the `?beta` / `#beta` / `?b=1` channel switch are ALL deleted. There is now exactly ONE unified, permanent Main Production UI, active by default, that cannot be switched off. The header keeps only the brand crest, the B1 badge, `#sdpVerPill`, `#syncBadge`, the Lecturer Admin quick launcher, the Guide pill and EN|SI + theme — zero Preview/Beta clutter at any viewport.
* **Human-UX repair (engine)**: `setStateText()` now paints `paintPhasePill()` on every path. The old early returns skipped the pill repaint for paused/finished/idle, so a paused clock kept showing a stale "Listening" chip; the pill now flips to "Paused — tap Resume" the instant the ring freezes.
* **CI lockstep repair (workflows)**: the 13th CI step's `want["data/session.json"]` was stale — it pinned a hash that no longer matched the shipped payload, which is what kept the `gates` job red on main. The pin now matches the real 55,764 B / `ee7b5294…` payload across all five lockstep files (`tests/check.cjs`, `tests/audit-v42.cjs`, `.github/workflows/checks.yml`, `data.html`, `data/index.html`). The voice-pack byte ceiling in `check.cjs`/`audit-v42.cjs` was also raised to 3,000,000 B because the live pack carries 131 clips (2,867,316 B) — the pack's 101-clip version no longer fit the old 2.5 MB ceiling.
* **Payload-driven test fixes (phase1/browser/studio-safety)**: four assertions hardcoded the word `important` and one hardcoded the old cost-preview character counts. They now derive the active Session 8 word and the clip-cost arithmetic from the LIVE payload/`SDP.Studio.costPreview()`, so a lecturer republishing the word list can never silently invalidate them.
* **Gates**: 12/12 green, 0 FAIL; the beta-channel assertions (G5.13a–c, A6) were replaced with unified-main assertions (zero Preview/Beta switcher in the shipped bytes, `#sdpVerPill` names v0.0.6.i, no `data-sdp-channel` attribute); every gate pin re-stamped in lockstep; `data.html`/`data/index.html` byte-identical; ES5 + line/budget ceilings hold.

## v0.0.6.h — 2026-11-06 — Main Production Human-UI & Dictation Clock Repair (BETA preview v0.0.6.h.a)

**Release type:** beta-to-main promotion + dictation clock / tab bar / settings repair release. The perfected v0.0.6.g beta becomes the MAIN production experience at the clean URL; the floating beta stamp only appears via `?beta`/`#beta`/`?b=1`. No classroom-data migration: `data/session.json` stays the preserved 30-word payload (header re-stamped to the new pointer; SHA `fadde370…`), `data/gas-source.txt`, both Sinhala fonts and every committed Alice clip stay byte-identical. **0 ElevenLabs credits spent.**

**Stamp:** `appVersion/version '0.0.6.h'` · `ver 22` · `schema 22` · `settingsRev 38` · `syncRev 1793900000000` · `SW_VERSION 'sdp-v0.0.6.h-s23'` / `SHELL_CACHE 'sdp-v0.0.6.h-s23-shell'` · `TARGET='0.0.6.h'` · `BETA_SUBVERSION '0.0.6.h.a'` · `buildDate 2026-11-06`.

* **CF1 — dictation clock & Play/Pause state machine (engine/morphe)**: the v0.0.5.b document-level click relay in `sdp-morphe-hooks.js` (a `#btnPlayPause.click()` synthesised for every `.ring-wrap` tap) is REMOVED — one physical tap fired `togglePlayPause()` twice, so the clock started and instantly paused, and a paused session "resumed" only to pause again in the same tick. The engine also gained `resolveSessionWords()` (Sync.words → Sync.session().lists → `__SDP_SESSION__`), so a cold Dictation tab arms itself and starts Word #1 from the FIRST ring/Play tap even while sync is still booting. All three resume cases are verified live in Chromium: A (paused during the opening cue / while the word speaks — resume re-enters `speakRepeats` immediately, the clock re-arms at the bounded listening window, never a dead 60 s), B (paused during writing — `E.remainingMs` is restored verbatim and the ticker runs 05s → 04s → 03s with no reset or jump), C (paused by the reveal card — the ring tap resumes AND `onEngineWordChanged` re-hides the revealed spelling). Rapid Play/Pause/Prev/Next taps stay epoch-guarded (zero double-bind: ring click fires exactly once).
* **CF2 — the bottom #tabbar is unconditionally pinned on mobile (css)**: `@media (max-width: 1023px)` now pins `#tabbar` to the bottom of the visual viewport (`position: fixed !important; bottom: 0 !important; z-index: 85 !important; display: flex !important; visibility: visible; opacity: 1; transform: none; pointer-events: auto; padding-bottom: env(safe-area-inset-bottom)`). No transform / perspective / will-change / contain / filter is ever set on html or body (the v0.0.6.g `filter: none !important` light-lock removes a containing-block hazard instead of adding one), `#sdpScreens`/`main` keep `calc(var(--tabbar-h) + safe-area + 16px)` bottom air, and the floating helpers (`#sdpDataToast`, `.update-card`, `.stale-pill`) sit ABOVE the bar — never on top of it. Desktop ≥1024px keeps the 232px rail only.
* **CF3 — flagship iOS / One-UI Settings (index/css)**: `#tab-settings` finally carries `tico tico-settings` (a 20×20 white gear on the purple squircle) so ALL SIX bottom tabs match; `#screen-settings` is restyled as real flagship groups — 22px elevated cards with inset hairlines, 38px colour squircles on every `.set-head`, row dividers between `.field`s, flat capsule selects with an inline chevron, One-UI preset chips, round − / + stepper buttons with live value badges, and pure-CSS `appearance:none` pill toggle switches for `#setAutoAdvance` / `#setGuideAutoPlay` — all existing DOM IDs intact.
* **CF4 — beta → main promotion (views/sync/index/data pair)**: `data-sdp-channel` stays `stable` on the clean URL, `#sdpBetaStamp` stays hidden, and the header shows the sleek `v0.0.6.h` pill (`#sdpBetaPill` remains one tap away, naming `BETA v0.0.6.h.a` via `?beta`); the update capsules speak Samsung One-UI — idle devices see `🔄 Updating to v0.0.6.h — refreshing automatically…` (from both the boot `doReload` and `Sync.triggerVersionUpgrade`), a mid-dictation device keeps Update Now (OK) / Later with `#sdpStalePill`; the `sdp_upgraded_to` one-reload guard is G6.4.
* **A1–A7 re-verified**: Dark Reader lock + shield (index/data pair/views), unified mobile remote cockpit + reveal card, compact Lecturer Studio, zero robotic voice, smart offline mode (`sdp-v0.0.6.h-s23` preserves `sdp-audio-clips`/`sdp-youdao-v1`), and the EN+SI credits stay verbatim everywhere.
* Gates: 12/12 green, 0 FAIL; every gate pin re-stamped in lockstep (check, upgrade.test, phase1, server, browser, upgrade-browser, e2e, live-lab, audit-v42, voice-guide, vault-sync, studio-safety) with new G5/G3 assertions for CF1/CF2/CF3; `data.html`/`data/index.html` byte-identical; ES5 + line/budget ceilings hold (css 110,184 B ≤ 111,180; session.json 55,764 B ≤ 61,576; voice pack 2,867,316 B ≤ 3,000,000).

## v0.0.6.g — 2026-11-06 — Mobile-First Human UI + Sinhala Blueprint (Beta-Preview v0.0.6.f.a)

**Release type:** mobile-ergonomics + extension-immunity release over the live v0.0.6.f main. No classroom-data migration: `data/session.json` (44,885 B, `b1d178d3…`), `data/gas-source.txt`, both Sinhala fonts and every committed Alice clip stay byte-identical. **0 ElevenLabs credits spent.**

**Stamp:** `appVersion/version '0.0.6.g'` · `ver 21` · `schema 21` · `settingsRev 37` · `syncRev 1793890000000` · `SW_VERSION 'sdp-v0.0.6.g-s22'` / `SHELL_CACHE 'sdp-v0.0.6.g-s22-shell'` · `TARGET='0.0.6.g'` · `buildDate 2026-11-06`.

* **A1 — strict original light-mode lock (index/data pair/css/views)**: `<meta name="darkreader-lock">` + `<meta name="color-scheme" content="only light">` on every entry point; `color-scheme: only light !important` + `forced-color-adjust: none !important` + `filter: none !important` on `:root/html/body`; an inline boot shield AND `SDP.Views.installExtensionShield()` MutationObserver strip `data-darkreader-*` attributes, `style.darkreader`/`link.darkreader` nodes and `<meta name="darkreader">`, and re-append the lock meta; the app never reads `prefers-color-scheme` — only its own theme button flips `color-scheme` to `dark`.
* **A2 — unified mobile remote pad (css/engine/views)**: `#revealWordCard` + `#orbitalDeck` read as ONE tactile remote (reveal card = top arc with 👁 Show Current Word, clock dial = OK/Play/Pause, Prev/Next = side arcs, Play/Pause + Replay = bottom arc) with a shared stadium silhouette; Paper mode never paints `#hintChips`/`#hintOutput`/`.beat-stage` (they stay in the DOM and paint in typing mode — G5 input law intact); the Hint pill now toggles the reveal card's meaning panel (IPA/POS/Si/En without the spelling) via `SDP.Views.toggleHintPanel()`; the four helper pills are one equal-width iOS-tab-bar dock; revealing still auto-pauses (`SDP.Engine.pause('reveal')`) and the ring keeps its YouTube-style tap burst.
* **A3 — compact mobile Lecturer Studio (css/studio)**: the sticky `#studioSecurityBar` is a ≤60px one-line strip at `top: var(--header-h)` with a 0px gap (no text bleed, 85%+ of the phone free); `#sdpDataToast` whispers from the bottom edge on phones (never on the Studio title); `#studioLiveChips` renders an ordered 2–3 column chip grid with `.chip-w` ellipsis words; the 31-word helper stays calm amber (never auto-deletes, one-tap ⇄ merge / ✕ remove).
* **A4/A5 — verified, not regressed**: the anti-robotic ladder (`speechEpoch`, `AbortError` silent resolve, `sayCue` next-tick silence) and the offline split (preserved `sdp-audio-clips`/`sdp-youdao-v1`, online-only Studio blind) are unchanged and re-verified by G9/G11.
* **A6 — beta-preview stamp (views/index)**: `?beta`/`#beta`/`?b=1` + the header pill name the sub-version (`BETA v0.0.6.f.a`) and the floating `#sdpBetaStamp` pins `BETA v0.0.6.f.a / 0.0.6.g`; every fix above is live on BOTH the stable and beta channels.
* Gates: 12/12 green, 0 FAIL; every gate pin re-stamped in lockstep (check, upgrade.test, phase1, server, browser, upgrade-browser, e2e, live-lab, audit-v42, voice-guide, vault-sync, studio-safety); `data.html`/`data/index.html` byte-identical; ES5 + line/budget ceilings hold (css ceiling 104,000 B for the v0.0.6.g layer).

## v0.0.6.f — 2026-11-06 — Complete Human-UI Orbital Cockpit Release

**Release type:** human-UI release over the live v0.0.6.e main. No classroom-data migration: `data/session.json` (44,885 B, `b1d178d3…`), `data/gas-source.txt`, both Sinhala fonts and every committed Alice clip stay byte-identical. **0 ElevenLabs credits spent.**

**Stamp:** `appVersion/version '0.0.6.f'` · `ver 20` · `schema 20` · `settingsRev 36` · `syncRev 1793880000000` · `SW_VERSION 'sdp-v0.0.6.f-s21'` / `SHELL_CACHE 'sdp-v0.0.6.f-s21-shell'` · `TARGET='0.0.6.f'` · `buildDate 2026-11-05`.

* **A — orbital TV-remote cockpit (index.html/css/engine)**: `#cockpitBar` hosts a 360° `.orbital` deck — Prev west, Next east, Play/Pause + Replay south around the clock ring, each key a squircle with a caption; `#beatPhasePill`, `#beatStateText`, `#playerPausedBanner` and the quiet `#cockpitHelpers` strip (Repeat · Hint · Mode · Check) sit under it. The amber paused halo (`.is-paused`) and the blue/amber `#ringTapOverlay` burst fire on every phase transition.
* **B — reveal meaning card (views/index)**: `#revealWordCard` reveals the current word with IPA, POS, Sinhala and English meaning; revealing auto-pauses dictation (`⏸ Paused while viewing word`) and every new word re-hides the card.
* **C — zero robotic voice (sdp-audio-speech.js)**: `playUrl` honours `opts.epoch`, resolves stale epochs and `AbortError` as `{aborted:true}`, and a missing/failed cue clip now resolves **silently on the next tick** — the browser's `speechSynthesis` never says "Session paused." on a rapid tap; `playWord` logs `lastUtterances` synchronously.
* **D — always-visible Preview pill + Samsung update capsule (views/index)**: `#sdpBetaPill` is never hidden (mobile included) and toggles the `?beta` channel; `#sdpStalePill` and `#sdpUpdateCard` give idle players a 1-tap refresh while a running session gets Update Now / Later.
* **E — offline Studio blind & squircle system (views/studio/css)**: `#sdpStudioOfflineCard` plus `#screen-studio.studio-is-offline` lock only the Lecturer Studio when the device is offline; the five Settings headings and the Studio title carry colour-coded `.set-squircle` badges; the side rail and bottom tab bar use squircle icons.
* **F — Studio STEP tags and chip fixes (studio.js)**: STEP 1/2/3 tags on the three cards (duplicate gate heading removed), comma/newline-only parser, live chip grid with `\u21c4` merge and `\u2715` remove glyphs (never broken HTML entities), chips painted on unlock, and publish now carries the edited session number/topic.
* Gates: 12/12 green, 0 FAIL; every gate pin re-stamped in lockstep (check, upgrade.test, phase1, server, browser, upgrade-browser, e2e, live-lab, audit-v42, voice-guide, vault-sync, studio-safety); `data.html`/`data/index.html` byte-identical (27,993 B); ES5 + line/budget ceilings hold.

## v0.0.6.e — 2026-11-05 — Autonomous Human-UX Release (Architectures A–F)

**Release type:** human-UX + hardening release over the live v0.0.6.d main. No classroom-data migration: `data/session.json` (44,885 B, `b1d178d3…`), `data/gas-source.txt`, both Sinhala fonts and all 101 committed Alice clips stay byte-identical. **0 ElevenLabs credits spent.**

**Stamp:** `appVersion/version '0.0.6.e'` · `ver 20` · `schema 20` · `settingsRev 36` · `syncRev 1793880000000` · `SW_VERSION 'sdp-v0.0.6.e-s20'` / `SHELL_CACHE 'sdp-v0.0.6.e-s20-shell'` · `TARGET='0.0.6.e'` · `buildDate 2026-11-05`.

* **A — comma/newline-only parser + non-destructive chip grid (studio.js)**: `parseBulkWords` strips pasted numbering, collapses inner spaces, keeps hyphens/spaces inside words (`old-fashioned`, `bus station` = exactly one word) and never truncates at 30; `ST.rawParsedWords` carries the full list, `#studioLiveChips` renders a live chip grid (✕ remove, ⇄ merge writes back to the bulk field), `#studioWordsCountHelper` shows ✓ 30/30 (green), N>30 (amber, zero auto-deletion) or N<30 (calm info), plus session No/Topic inputs and Paste/Clear/Confirm utility pills.
* **B — zero robotic fallback on rapid taps (sdp-audio-speech.js)**: `playUrl` takes `opts.epoch`; stale epochs and `AbortError` resolve `{aborted:true}` and stop the tier ladder cleanly — a rapid Pause/Play/Next never drops to Youdao or browser speechSynthesis; a genuine error of the committed Alice clip retries the local MP3 once while online; `playWord` logs the word into `lastUtterances` synchronously.
* **C — clean clock ring (engine/index/css)**: no literal text inside the dial (`#ringAffordance` keeps `data-state`, gains `aria-label`, empty textContent); a YouTube-style SVG burst (`#ringTapOverlay`, 0.6→1.18, 420 ms) fires on every play/pause transition; the glass `#revealWordCard` sits directly above the ring — revealing auto-pauses dictation (`⏸ Paused while viewing word`) and resets on word change; the board jumper drawer is hidden (`display:none !important`, node kept) so exactly one "Jump to Word 1–30" control remains.
* **D — beta channel + Samsung One-UI capsule (views/index)**: `?beta`/`#beta`/`sdp_beta_preview` switches `data-sdp-channel` and shows `#sdpBetaPill` (1-tap toggle); `sdp:words-refresh` refreshes the in-memory list at once, then idle players auto-sync through `#sdpUpdateCard` (1.5 s progress bar, < 1.8 s) while a running session gets [Update Now (OK)] / [Later] and `#sdpStalePill`.
* **E — offline-first split (sw.js/views/studio)**: the service worker pins `sdp-v0.0.6.e-s20` caches and cache-firsts `/audio/elevenlabs/` MP3s; Lecturer Studio locks behind `#sdpStudioOfflineCard` only when `navigator.onLine === false` (never blocking programmatic mounts while online); Student Dictation keeps working offline.
* **F — squircle headers + credits**: color-coded `.set-squircle` badges on Settings/Studio headers; EN/SI credits preserved verbatim everywhere (Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu) / නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini).
* Gates: 12/12 green, 0 FAIL; every gate pin re-stamped in lockstep (check, upgrade.test, phase1, server, browser, upgrade-browser, e2e, live-lab, audit-v42, voice-guide, vault-sync, studio-safety); `data.html`/`data/index.html` byte-identical; ES5 + line/budget ceilings hold.

## v0.0.6.c — 2026-11-05 — Holistic Human-UX Debug & Re-Architecture (F1–F5)

**Release type:** UI + studio-pipeline release over the live v0.0.6.b main (settingsRev 33 broadcast adopted). No classroom-data migration: `data/session.json` (44,885 B, `b1d178d3…`), `data/gas-source.txt`, both Sinhala fonts and all 100 Alice clips stay byte-identical. **0 ElevenLabs credits spent.**

**Stamp:** `appVersion/version '0.0.6.c'` · `ver 18` · `schema 18` · `settingsRev 34` · `syncRev 1793860000000` · `SW_VERSION 'sdp-v0.0.6.c-s18'` / `SHELL_CACHE 'sdp-v0.0.6.c-s18-shell'` · `TARGET='0.0.6.c'` · `buildDate 2026-11-05`.

* **F1 — Studio word-delta broadcast**: new `detectWordDeltas()` compares the live `#studioBulkWords` / `#studioWords` / `.wm-input` surface against the committed `SDP.Sync.words()` baseline on every input/change — even at 30/30, one modified spelling flips `ST.wordsDirty`, the recognition pill lists `⚠️ 1 Word Modified ("curious") — click Broadcast to Auto-Enrich & Sync`, and the replaced word's stale IPA/meaning is cleared for a fresh enrich. `#lecturerSyncBar` / `#btnSyncClassSettings` / `#studioSecurityBar` / `#btnPublishWordsAndVoice` gain the pulsing `data-dirty` RED action state (`#E11D48`) with the 🔴 Unsaved Changes label (EN+SI); a landed publish clears it to emerald `data-synced`. `saveClassSettings()` and `#btnSyncClassSettings` now run the unified pipeline when words changed — fast delta enrich (only modified words), delta voice under the 0-credit sha1 guard, atomic 4-file publish — while a pacing-only change keeps the exact config.json → version.json sequence (G8.6c). The tab-exit guard is the 3-tap 🔴 Publish & Leave / 🔒 Discard & Leave / ✏️ Stay modal; clean exits still auto-lock instantly.
* **F2 — Cockpit fold**: the duplicate 1–30 jumpers are gone — `#boardJumper` lives inside a closed `<details>` drawer (48px `#boardJumperToggle` summary) and `#sessionPills` stays in its own drawer; the cockpit card is the first card and the countdown clock ring is the hero (`#beatRing` 148–184px, `#beatSeconds` inside the ring), with the transport deck (⏯ `#btnPlayPause` 72px hero) docked directly beneath — ring + Play/Pause + Show-Current-Word controls all inside the first 360×640 viewport. Every contract id/aria/≥48px target preserved (G3.10, G5.6, G5.7g, G7.3).
* **F3 — Two-mode themes**: human-facing theme UI is exactly ☀️ Light Mode (Default) + 🌙 Dark Mode; `#btnTheme` toggles light↔dark only; `<option value="board" hidden>` and `html[data-theme='board']` stay machine-reachable for gates; Dark carries the crisp Deep Sapphire-Zinc surfaces (`#0F1420/#161D2E/#F8FAFC/#38BDF8`).
* **F4 — Scroll-proof sliders**: `.stepper input[type='range']` is `pointer-events:none` — a scrolling thumb can never snap the track; values move only via the 48px −/+ steppers, preset cards, or programmatic dispatch (gate contract). Verified by Playwright touch-drag: Writing Time stays 5s.
* **F5 — Visual maturity**: dual-tone inner top-highlights, consistent 12/16px radii, premium practice cards (single-slash `/ɪmˈpɔːtənt/` IPA, hover-lift flashcards, crisp quiz tiles with ok/bad focus halos), lifted icon medallions on Home drill cards, quieter cockpit hierarchy, `body/#appHeader/#brandName { color: var(--text) !important }` header contrast in both modes.
* Gates: 12/12 green, 0 FAIL; every gate pin re-stamped in lockstep (check, upgrade.test, phase1, server, browser, upgrade-browser, e2e, live-lab, audit-v42, voice-guide, vault-sync, studio-safety + checks.yml). `data.html`/`data/index.html` byte-identical; ES5 parse + line budgets hold; five-key localStorage law intact.

## v0.0.4.c — 2026-11-04 — Unified Morphe Material Layer, 56 Dual-Tone Icons & 4-Path Stale-Audio Fix

**Release type:** UI + audio release over v0.0.4.b. No classroom-data migration: `data/session.json`, `data/gas-source.txt`, both Sinhala fonts and every one of the 100 committed Alice clips stay byte-identical. **0 ElevenLabs credits spent** — no request ever reached `POST /v1/text-to-speech`.

**Stamp:** `appVersion/version '0.0.4.c'` · `ver 15` · `schema 15` · `settingsRev 30` · `syncRev 1793740000000` · `SW_VERSION 'sdp-v0.0.4.c-s15'` / `SHELL_CACHE 'sdp-v0.0.4.c-s15-shell'` · `TARGET='0.0.4.c'`.

### Fixes

* **GAP 1 — true Morphe glass (sdp-ui.css)** — the legacy `backdrop-filter: none !important` kill-switch is retired from the chrome; it survives only on the opaque `.card` / `.pill` / `.chip`. The locked cascade applies `blur(12px) !important` to `#appHeader`, `#tabbar`, `#sdpSideRail`, `blur(8px)` to `#sdpDataToast` and `blur(4px)` to `.modal`, with the Zinc/Crisp-Light/Smart-Board token sets, the shadow ladder plus `--shadow-2xl`, the `linear()` spring, `--ease-emph`, the pointer-tracked `.lit` glow and `data/sdp-morphe-hooks.js` (lit cards, theme cross-fade, measured accordion, scroll reveals, header scroll state).
* **GAP 2 — 56-icon dual-tone bank** — `ICON_PATHS` (56 entries) and `svgIcon(name, size, extraClass)` render `<path class="ic-fill">` + `<path class="ic-stroke">`; the shell ships `data-icon` hosts instead of emoji, `applyI18n()` updates `.i18n-label` children so EN ↔ SI never wipes an icon, `setBtnIconLabel()` keeps the transport ink through every beat repaint, and the studio's `btn()` / word rows use the same bank (30/30 rows carry an SVG audio-preview button).
* **GAP 2 — 4-path stale audio** — A: a cold boot opens the guide silently (`fromBoot`); B: `unlockAudio()` no longer calls `speechSynthesis.resume()`; C: `playUrl().finish()` detaches `src` and reloads the element; D: `Studio.lock()` cancels speech and the TTS queue.
* **GAP 3 — zero-clipping header** — one 54 px `nowrap` row: `.b1badge`, the swan, `#sdpVerPill` and `.studio-quick-label` collapse at ≤640 px, `#syncBadge` shrinks (hidden ≤380 px) and `#brandName` stays the sole ellipsis child. At 390 px and 320 px the brand renders whole, actions end at 384/314 px and `scrollWidth` never exceeds the viewport.
* **GAP 4/5 — lockstep** — all ten versioned surfaces agree, `sdp-morphe-hooks.js` is in `index.html` (7th deferred script), the `SHELL` precache and both budget tables; `check.cjs` and `audit-v42.cjs` caps now read index 52,000 / CSS 98,000 / views 150,000 / studio 162,000 / hooks 8,000 B.
* **Gates** — 12/12 green, 0 FAIL. The vault-sync fixtures now derive their publish revision from the live config instead of a frozen `settingsRev`, and the session hash lock re-pins the lecturer's published `session.json`.

### Preserved, byte for byte

`session.json` 55,260 B `1eaed80a290be4ef` · `gas-source.txt` 13,764 B `591b9b086f6d3723` · both Sinhala `.woff2` `23f1503e1e754139` / `bf59c1487b0a88a0` · `config.json` `encVault` (`SDP_ENC_V2:…`, bootstrap PIN 78987898) and `pinVerifier` verbatim · all 100 Alice (`Xb7hH8MSUJpSbSDYk0k2`) clips intact in `data/elevenlabs-audio.json`.

## v0.0.3 — 2026-11-03 — Unified Voice System, Ghost-Voice Kill-Switch & Incremental UI Fix

**Release type:** voice + UI release over v0.0.2.b (P1–P8, D1–D20). No classroom-data migration: `sdp.progress`, `sdp.session`, both Sinhala fonts, `data/session.json` and `data/gas-source.txt` stay byte-identical.

**Stamp:** `appVersion/version '0.0.3'` · `ver 12` · `schema 12` · `settingsRev 20` · `syncRev 1793654400000` · `SW_VERSION 'sdp-v0.0.3'` / `SHELL_CACHE 'sdp-v0.0.3-shell'` · `TARGET='0.0.3'`.

### Fixes

* **Ghost voice (R1/F1)** — `stopAll()` bumps `speechEpoch`, clears every named timer and
  finishes the shared `<audio>`; `sayCue('cmd.paused', …, true)` is the only cue allowed through a
  pause. Pausing during listening speaks **Session paused.** once and **zero** late "Afraid." —
  all four leak paths re-check the epoch/`live()` guard.
* **Opening cue chain (R3)** — Start plays `cmd.preparing` → `num.N` → the word ×`repeats` with a 5 s write countdown, then `cmd.complete`; `cueGap = (E.writeSecs && E.writeSecs < 1) ? 15 : 400` keeps the test clock honest.
* **Guide 4.0 spotlight (R2/F2/F3)** — one compact card: `#guideSpotlight` with `#guideStepTag`, `#guideStepText` and four `#guideDots`; exactly two buttons (`#btnGuideSkipStart` *▶ Start Dictation Now*, `#btnGuideClose` *✕ Exit*). The 700 ms Youdao watchdog and the tap-restart loop are gone; narration re-checks `guideRunId` and a banner tap resumes the CURRENT step.
* **Transport glyph deck (P4)** — the 8 transport buttons render glyphs (`▶ ⏸ ⏮ ⏭ 🔊`) with `aria-label`s, so the deck stays 48 px tall; `#sessionProgressStrip` became the single-line cockpit (`#sessionProgressCount` `WORD #01 / 30`, `#playerRepeatBadge`, `#playerPresetBadge` `5s Write · 2×`) plus the `#pillsDrawerToggle` / `#sessionPills` drawer.
* **Studio (P3/P5)** — Words card first (`#studioCardWords` → `#studioCardSettings` → `#studioCardKeys`), `#btnVerifyEleven` + `#elVerifyStatus` verify a `sk_…` key with a zero-character `GET /v1/user/subscription` and play Charlotte's `cmd.sample`; `#btnChangePin` performs an atomic fresh-salt re-seal; `BOOTSTRAP_PIN` is the documented master recovery that opens a session even while locked out (`Studio.recoveryMode()`).
* **Unified voice pack (R4/R5)** — Charlotte `XB0fDUnXU5powFXDhCwa` on `eleven_flash_v2_5`:
  **70 clips** (30 words + 30 numbers + 6 commands + 4 guide steps) = 829 chars ≈ 414 credits.
  `sha1Hex`/`clipContentHash` give a synchronous ES5 content hash (`hashAlgo: 'sha1'`) so an
  unchanged clip is never re-bought; `#studioForceRegen` is the only way to force a re-generation.
* Every versioned literal re-stamped to 0.0.3 / ver 12 / schema 12 / settingsRev 20 / syncRev 1793654400000; all 12 gates updated.

### Preserved, byte for byte

`session.json` 57,381 `c06e197c6e90620c` · `gas-source.txt` 13,764 `591b9b086f6d3723` · both
Sinhala `.woff2` `23f1503e1e754139` / `bf59c1487b0a88a0`. Appendix A is the source of truth.

## v0.0.2.b — 2026-11-02 — Hard Screen Guard, Guide Spots, Symbol Deck & Studio PIN Change

**Release type:** guard + defect-fix release over v0.0.2.a (P1–P5, D1–D20). No classroom-data migration: `sdp.progress`, `sdp.session`, both Sinhala fonts, `data/session.json` and `data/gas-source.txt` stay byte-identical.

**Stamp:** `appVersion/version '0.0.2.b'` · `ver 11` · `schema 11` · `settingsRev 17` · `syncRev 1793620000000` · `SW_VERSION 'sdp-v0.0.2.b'` / `SHELL_CACHE 'sdp-v0.0.2.b-shell'` · `TARGET='0.0.2.b'`.

### Fixes

* `speechEpoch` (`data/sdp-audio-speech.js`): every async chain captures an epoch; `stopAll()` bumps it; every timer/watchdog/onend/`<audio>` handler re-checks before acting.
* `screenIsCovered()` hard guard (speech + engine): document hidden, or `#studioGate` over active `#screen-studio` aborts queues/`<audio>`/`enterListening()`; `#guideModal` is **not** a cover.
* `guideRunId` (bumped on `openGuide`), `openGuideSpot()`/`closeGuideSpot()` drive the `#guideSpot` spotlight; `guideRunId()` exposed.
* `#symbolDeck` — 15 IPA cards (`.deck` grid) inside `#screen-home`; `.deck` CSS in `assets/css/sdp-ui.css`.
* `#btnChangePin` + `btnChangePin` handler calling `saveKeys()`; `studioChangePin` strings in `STRINGS_EN`/`STRINGS_SI`.
* `guideAutoPlay` defaults false; Start opens the cockpit directly.
* Every versioned literal re-stamped to 0.0.2.b / ver 11 / schema 11 / settingsRev 17 / syncRev 1793620000000; all 12 gates updated.

### Preserved, byte for byte

| File | Bytes | SHA-256 (first 16) |
| --- | --- | --- |
| `data/session.json` | 57,381 | `c96dbe6de02d7d6d` |
| `data/gas-source.txt` | 13,764 | `591b9b086f6d3723` |
| `assets/fonts/NotoSansSinhala-Regular.woff2` | 48,520 | `23f1503e1e754139` |
| `assets/fonts/NotoSansSinhala-Bold.woff2` | 48,748 | `bf59c1487b0a88a0` |

Five localStorage keys; strict ES5; spoken guide en-GB; credits verbatim EN+SI on Home/About/Studio//data.

### Gate results (`cd tests && npm run gates`)

G1–G12 all 0 FAIL — 636 assertions. G7.3g now samples inside one phase so it never compares across the listen→writing flip.


---

**Release type:** major overhaul over v0.0.1.i.
**Stamp:** `appVersion/version '0.0.2.a'` · `ver 10` · `schema 10` · `settingsRev 16` · `syncRev 1793615000000`.

### The five release blockers, and their fixes

| # | Blocker | Fix |
| --- | --- | --- |
| B1 | Flat, invisible buttons on a projector | 54 px tactile system: `--btn-h`, `--shadow-btn`, `--grad-primary`, `--grad-go`, `.btn-sm` 48 px, amber `.cue` (`sdp-ui.css`) |
| B2 | Studio hidden inside student Settings | sixth screen `#screen-studio` + `#tab-studio` + `#rail-studio`; Settings student-only; locked studio strictly PIN-only (`#pinDots`, 56 px 12-key `#pinPad`) |
| B3 | 34 voice clips with no progress or cost | `#studioPackDashboard` X/34, `#studioGenProgress`, `#btnOneClickMasterSetup`, delta retry that never re-bills a saved clip |
| B4 | Cockpit unreadable; no session map | 30-pill `#sessionProgressStrip`, 4-button transport, verbatim phase lines, giant `#resumeBanner`, ordered `#01..#30` word sheet with self-check |
| B5 | Guide never showed the control it described | Guide 3.0: four voice-transition cards with animated previews, footer CTA `▶ Start Dictation Now` |

### Added

| Surface | Contract |
| --- | --- |
| `#screen-studio` | 6th screen/tab; three numbered cards mount into `#studioBody`; `#studioGate` when locked |
| Locked studio | strictly PIN-only: `#pinDots`, 56 px 12-key `#pinPad`; cards never render while locked |
| Cockpit | 30-pill `#sessionProgressStrip`, 4-button transport, verbatim phase lines, `#resumeBanner`, `#01..#30` word sheet |
| Version pill | `#aboutVersion`, `#sdpVerPill`, `data/version.json`, `data/config.json`, `sw.js`, manifest, `data.html` = `data/index.html` read `0.0.2.a` |

### Preserved, byte for byte

| File | Bytes | SHA-256 (first 16) |
| --- | --- | --- |
| `data/session.json` | 57,381 | `c96dbe6de02d7d6d` |
| `data/gas-source.txt` | 13,764 | `591b9b086f6d3723` |
| `assets/fonts/NotoSansSinhala-Regular.woff2` | 48,520 | `23f1503e1e754139` |
| `assets/fonts/NotoSansSinhala-Bold.woff2` | 48,748 | `bf59c1487b0a88a0` |

`config.encVault` + `config.pinVerifier` survived every rewrite; PBKDF2 250,000; five localStorage keys; strict ES5; credits verbatim.

### Gate results (`cd tests && npm run gates`)

G1–G12 all 0 FAIL — 636 assertions.


---

## v0.0.1.i — 2026-11-02 — Per-Field Secrets, Honest Publish Errors & One Live Screen

**Release type:** defect-fix release over v0.0.1.h (twenty defects D1–D20).
**Stamp:** `appVersion/version '0.0.1.i'` · `ver/schema 9` · `settingsRev 12` · `syncRev 1793610000000` · `SW_VERSION 'sdp-v0.0.1.i'` / `SHELL_CACHE 'sdp-v0.0.1.i-shell'`.

| # | Defect | Fix (`file:line`) |
| --- | --- | --- |
| D1 | An empty field overwrote a stored secret | `guardSecretMerge()` restores a pristine field, `mergeSecretInputs()` reads `data-dirty` (`data/studio.js:746`, `:1205`) |
| D2 | `#btnSyncClassSettings` was double-clickable | `SDP.Studio.withBusy` wraps it (`data/sdp-ui-views.js:1662`; helper `data/studio.js:128`) |
| D3 | Enrichment gave no progress for 45 s | live `n/30` + 45,000 ms cap (`data/studio.js:1487`) |
| D4 | Lecturer bar kept a stale stamp | `paintLecturerBar()` exported (`data/sdp-ui-views.js:2150`), called from `unlock()`, `unlockWithVerifier()`, `lock()` (`:1441`) |
| D5 | A failed step said only “failed” | per-step sentences from `publishReason()` (`data/studio.js:1979`) |
| D6 | A failed publish still printed `rev N` | `"Publish failed · hhmm · reason"` (`data/studio.js:1989`) |
| D7 | GitHub codes reached the DOM raw | `SDP.Sync.publishErrorText()` maps 401/403/404/409/422/5xx/network + GitHub `message` (`data/sdp-data-sync.js:1430`) |
| D8 | Two screens could show at once | `.screen:not(.active){display:none!important}` + `#screen-home.active{display:grid!important}` in `@media (min-width:1024px)` (`assets/css/sdp-ui.css:148`, `:1019`) |
| D9 | A stored secret could not be cleared | four `#btnClear*` → `clearSecretField()` (`data/studio.js:756`, handlers `:1137`–`:1140`) |
| D10 | A hardcoded `0.0.1.h` + `settingsRev === 8` clamp could re-adopt stale settings | clamp deleted, adoption is monotonic (`data/sdp-data-sync.js:976`) |
| D11 | A failed session leg failed the whole sync | `settle()` returns `stale_payload` + `deferredSession` + `retry`, config still adopted (`data/sdp-data-sync.js:1174`) |
| D12 | G3 fixtures pinned ver 8 | re-baselined to ver 9 / `settingsRev` 12 (`tests/phase1.cjs`) |
| D13 | A same-tab reload lost the unlocked vault | `restoreSessionStash()` calls `Vault.read()` once (`data/studio.js:642`) |
| D14 | Two publish clocks | one `nextSyncRev()` per publish (`data/studio.js:88`, `:1661`, `:1687`) |
| D15 | Version surfaces could drift | G1 pins `0.0.1.i` / ver 9 across seven surfaces (`tests/check.cjs`) |
| D16 | A transient 5xx failed a publish for good | one 2,000 ms retry, fresh SHA (`data/sdp-data-sync.js:1460`, `:1533`) |
| D17 | Publish demanded a vault on a keys-less bundle | `publishChecklist()` needs `encVault`+`pinVerifier` only when `hasVault()` (`data/studio.js:1873`) |
| D18 | Failure exits left busy flags on | `clearBusy()` on every failure exit (`data/studio.js:1994`) |
| D19 | The sync line had no idle state | `lecturerSyncIdle` + `data-state`/`aria-live="polite"` (`data/sdp-ui-views.js:85`, `index.html:245`) |
| D20 | The meter served a stale cache | `CACHE_VERSION='0.0.1.i'`, `cacheKey()`, `clearCache()`, `__v` (`data/data-meter.js:12`, `:351`, `:358`) |

### Gate results (`cd tests && npm run gates`)
G1 89/0 · G2 12/0 · G3 81/0 · G4 8/0 · G5 60/0 · G6 15/0 · G7 52/0 · G8 39/0 · G9 47/0 · G10 26/0 · G11 74/0 · G12 94/0 — 597 assertions, 0 FAIL.

### Bytes (`wc -c`)
index.html 30,223/36,000 · sdp-ui.css 45,402/60,000 · sdp-data-sync.js 83,666/86,000 · sdp-ui-views.js 119,119/128,000 · studio.js 115,884/116,000 · data-meter.js 22,845/24,000 · data.html = data/index.html 27,974 each/32,000 · session.json 57,381 exact (SHA `4e80cd95…`).

`config.encVault` + `config.pinVerifier` survived byte-for-byte; PBKDF2 250,000, PIN `78987898`, five localStorage keys, strict ES5 and both credit lines unchanged.

---

## v0.0.1.h — 2026-11-02 — Non-Fatal Voice Generation, withBusy Feedback & Human Error Sentences

**Release type:** defect-fix release over v0.0.1.g (20 defects D1–D20 closed).
**Stamp:** `appVersion '0.0.1.h'` · `ver/schema/settingsRev 8` · `syncRev 1793600000000` · `SW_VERSION 'sdp-v0.0.1.h'`.

### The twenty defects (D1–D20)

| # | Defect | Fix |
| --- | --- | --- |
| D1 | generateClips fatal on non-401/402/403/429 errors | First-error non-fatal law: ANY requestClip error sets tierLimited, skips queue, finish(null) |
| D2 | Standalone diagnostics buttons painted raw tts_failed | Same non-fatal path; diagnostics paint studioElTierWarn |
| D3 | No visual busy/spinner state on buttons | withBusy(btn, fn) helper: disabled + "Working…" + restore |
| D4 | publishWordsAndVoice skipped generateClips | Now runs generateClips({ noCommit: true }) then publishBundle |
| D5 | quotaError leaked raw error codes to DOM | Human-readable sentences for all error paths |
| D6 | LLM fallback was silent | Immediate studioAiOfflineFallback notice in testStatus |
| D7 | Gemini lacked strict JSON mode | generationConfig.responseMimeType: 'application/json' |
| D8 | Provider auto-select only on key prefix | mergeSecretInputs persists aiProvider in vault |
| D9 | Clearing a field didn't clear the secret | mergeSecretInputs reads mounted inputs explicitly (even "") |
| D10 | Paste failed without focusing field | On clipboard failure, focus() + select() the input |
| D11 | Language switch wiped unsaved edits | Stash/restore input values across onLangChange |
| D12 | renderAll re-mounted Studio mid-action | SDP.Studio.isBusy() guard skips renderSettings when busy |
| D13 | requestClip always sent use_speaker_boost (422 on free tier) | HTTP 422 retry with minimal {stability:0.5, similarity_boost:0.75} |
| D14 | paintClipTable only called at finish | Live row-by-row paintClipTable after each requestClip |
| D15 | Dead btnStudioUnlock in CLICK_ACTIONS | Removed |
| D16 | Raw error literals reached DOM | All status outputs routed through human strings |
| D17 | No spinner/completion affordances | withBusy + green ✓ completion + paintMasterSteps on transitions |
| D18 | adoptRemoteSettings repainted mid-action | Same isBusy() guard as D12 |
| D19 | Duplicate Studio heading | Removed inner h4; kept accordion summary as single heading |
| D20 | settingsRev drift (9 vs 8) | Aligned to 8; nextSettingsRev = Math.max(8, current+1) |

### Gate results & bytes (v0.0.1.h)

G1 88/0 · G2 12/0 · G4 all · G6 15/0 · G7 52/0 · G8 39/0 · G9 47/0 · G10 26/0 · G11 74/0 · G12 78/0.
`index.html` 30,170/36,000 · `sdp-ui.css` 45,066/60,000 · `sdp-data-sync.js` 79,178/82,000 ·
`sdp-ui-views.js` 119,893/125,000 · `studio.js` 111,993/112,000 · `/data` 27,905/32,000.

---

## v0.0.1.g — 2026-11-02 — Scoped-Key Survival, Immortal Vault & the Free AI Ladder

**Release type:** defect-fix release over v0.0.1.f (PR #118). No data migration: `sdp.progress` is never overwritten, `data/session.json` stays byte-identical, and a device that is already unlocked keeps its vault.
**Stamp, one clock for every file:** `appVersion/version '0.0.1.g'` · `ver/schema/settingsRev 7` · `syncRev 1793595000000` · `SW_VERSION 'sdp-v0.0.1.g'` / `SHELL_CACHE 'sdp-v0.0.1.g-shell'`.

### The eighteen defects (D1–D18)

| # | What was broken | The fix |
| --- | --- | --- |
| D1 | A scoped/free-tier ElevenLabs key read as a hard failure | `fetchSubscription` is a 3-rung ladder: subscription → quota; else probe `/v1/voices`; else any `looksLikeElevenKey()` key is accepted as `{ok:true, scoped:true, remaining:null, note:SCOPED_NOTE}`. Only `invalid_api_key` is fatal |
| D2 | The scoped key painted a red ❌ | `quotaError()` understands 403 + `res.scoped` + `detail.status`; scoped keys always paint green and never say `subscription_failed` |
| D3 | One-click setup died when the quota read died | 4 steps: seal + Layer-1 + GitHub verify (the only fatal step) → advisory `checkQuota` → fault-tolerant delta clips → inject + `publishBundle()` of 4 files on ONE `nextSyncRev()`, `version.json` last |
| D4 | A 401/402/403/429 during clip generation aborted the publish | Tier statuses warn (`TIER_WARN`), keep the clips already made, mark the rest skipped and resolve into step 4 |
| D5 | A release reset `config.json` and destroyed the vault | Layer 1 lives in `sdp.settings.vaultLock` `{fails,lockUntil,strikes,until,encVault,pinVerifier,updatedAt}` |
| D6 | `saveKeys` could not publish | Layer 2: seal → Layer-1 write → `config.json` + `version.json` push; honest toast on GitHub failure, keys still saved locally |
| D7 | Teachers retyped keys after every unlock | `#elKeyInput`, `#ghTokenInput`, `#studioGasUrl`, `#studioAiKey`, `#studioAiProvider` auto-fill (masked) + green `#studioVaultBadge` |
| D8/D9 | A healed device could not unlock | Self-heal at boot, in `resolveEnvelope()` and in `unlockWithVerifier()`; `encVault`+`pinVerifier` are copied from Layer 1 when it is real and newer, then decrypted with the PIN into `ST.secrets` |
| D10 | The AI provider list assumed a paid key | 5 slots: `free_dict` (default) → `pollinations_free` (zero-key) → `groq` → `openrouter` → `gemini`, with keyless `Authorization` omission and `#studioFreeNoKey` on slots 1–2 |
| D11/D12 | Harvested phonetics were ignored; custom audio was dropped | `entry.phonetics[].audio` preferred (`-uk.mp3`/`_gb`, `//`→`https://`), `audioForWord(w, dAudio)` falls back to Youdao `type=1`, and `normalizeWord` keeps custom audio |
| D13 | Card 1 was a wall of buttons | 3 credential rows `[Show][Paste][Test]`, hidden `#btnCheckQuota`/`#btnRefreshQuota`, a 2-button primary bar (`#btnSaveKeys`, `#btnOneClickMasterSetup`), a diagnostics strip, a 4-step list, `#studioVaultBadge` |
| D14 | Two force-regen checkboxes confused teachers | One visible `#studioForceRegen`; `#chkForceRegen` stays hidden and mirrored |
| D15 | A failed session leg threw away a good config | Config-sovereign `settle()`: adopt version+config when the config leg verifies even if the session leg failed, return `deferredSession:true`, defer everything only when the config leg fails |
| D16 | A sub-30-word session was refused | `verifyPayloadLeg` accepts a matching session number with `words.length >= 1`, or the same active list (`id`+length+`updatedAt`) |
| D17 | Every tick re-pulled the 46 KB session | `needSession` is also true only when the session number differs, `state.deferredSession`, or legacy `payloadFiles` includes `data/session.json` |
| D18 | Stamps drifted between files | Every versioned literal re-stamped (`version.json`, `config.json` keeping `pinVerifier` + `classSettings`, voice pack, `APP_VERSION`, `sw.js`, both shells, manifest) |

### W7 — the Sinhala Studio

Card 1 gained 30+ Sinhala strings, and the Studio card had no Sinhala face: the text
inherited `Inter, system-ui` and rendered as tofu on any device without a system Sinhala
font. Two CSS lines close it — the shipped face is now the last fallback in `--font-ui`,
and `html[lang='si'] .studio-card { font-family: var(--font-si); }` switches the card
wholesale (inputs and monospace keep their own family). The old `1.1 · …` double numbering
on `#studioMasterSteps` is gone too: the `<ol>` marker is the only number now.

### Gate results

Twelve gates, 566 assertions, 0 FAIL — see *Release verification* at the end of this file.

---

## v0.0.1.e — 2026-11-02 — Honest Sync, British English Default, Guaranteed Voice & Bento UI

**Release type:** defect-fix + UI release over v0.0.1.d (no classroom data migration; `sdp.progress` is never overwritten; one one-time settings migration `langResetV001e`).
**Audience:** CCBE Galle Branch — B1 English Class. Persona A: Android 360×640–390×844 on unstable 3G/offline. Persona B: Smart Board 1280×720 / 1920×1080, weak OPS box, no keyboard.
**Attribution:** Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu) · නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini.

### What this release is

Twenty verified defects (D1–D20) closed across four workstreams:

1. **Honest sync (D1, D2, D5, D17, D18).** `checkForUpdates` reports `cb(err, result)` and one shared `handleSyncCheckResult` paints the badge — no more double toasts from a callback fired twice. The service worker's **fetch handler gates by origin first**: only same-origin requests and `dict.youdao.com` audio are intercepted; `?t=` URLs are never cached and are purged on activate; data reads use a 10 s network-first with an `ignoreSearch` fallback and an honest 503 JSON when offline. `checkForUpdates` is **never-red dual-source**: same-origin `./data/version.json?t=` first, then `raw.githubusercontent.com`; either HTTP 200 means `ok: true` — the badge goes red only when both sources fail. The 30 s watch tick and `visibilitychange` both feed the badge; the duplicate inline watcher in `index.html` is gone (one-shot boot check remains). `parseRemoteAppVer()` is the one shared reader of string-or-object `version` fields.
2. **British English by default (D7, R3).** Fresh devices and pre-0.0.1.e profiles boot `lang: 'en'`; a one-time migration flag `langResetV001e` inside `sdp.settings` forces English exactly once and never touches the student's later choice — `lang` stays personal, out of `CLASS_SETTING_KEYS`, so a published `classSettings` can never flip a class back to Sinhala. Language pills get bold/accent active styling.
3. **Guaranteed voice (D10, D11, D12).** The unified ladder is now lecturer clip → cached Alice clip → (only a verified Tier-1 Neural UK Female voice, score ≥ 100) → **the dictionary's real human British recording (`dict.youdao.com` type=1)** → browser TTS last. `state.utterStarted` is set **only** in `utter.onstart`; an 800 ms word watchdog cancels a silent engine and plays the word's own `word.audio` through the shared `<audio>`; the guide arms a 700 ms real-onstart watchdog that falls back to four short British-English cloud lines (`guide_audio` tier) and shows `#guideTapBanner` only when even that audio fails. On a voiceless engine `estimateMs` caps at 1200 ms so the queue never stalls ~40 s waiting for an `onend` that never fires.
4. **Coherent Studio publishing (D13, D19) + Bento home (D14–D16).** `saveKeys()` **always** recomputes `config.pinVerifier` from the published salt (the dead `v.PIN_SALT` gate is gone), so the verifier always matches the PIN that sealed the vault. Every publish stamps **one monotonic clock** `Math.max(Date.now(), prevSyncRev + 1)` into config/session/voice-pack/version alike, keeps `session.clips` (word→clip URLs survive a publish), and a pre-publish checklist refuses incoherent payloads in plain language. Home is a two-column Bento board at ≥ 1024 px (7fr/5fr, credits spanning the full row), the 1-2-3 journey uses 28 px circular step badges instead of typed `1. ` prefixes, and Quick Practice is four rich cards (icon + title + subtitle, ≥ 64 px tall) instead of four small buttons.

### Preserved, byte for byte (Appendix A lock)

| File | Bytes | SHA-256 (first 12) |
| --- | --- | --- |
| `data/session.json` | 46,403 | `e0e86c807fc6` |
| `data/gas-source.txt` | 13,764 | `591b9b086f6d` |
| `assets/fonts/NotoSansSinhala-Regular.woff2` | 48,520 | `23f1503e1e75` |
| `assets/fonts/NotoSansSinhala-Bold.woff2` | 48,748 | `bf59c1487b0a` |

### Version bump set

`data/version.json` / `data/config.json` / `data/elevenlabs-audio.json`: `ver:5, schema:5, settingsRev:5, syncRev:1793585000000` (identical stamp in all three — one publish clock), `appVersion/version: '0.0.1.e'`, `buildDate: 2026-11-02`. `index.html` boot `TARGET`, `#sdpVerPill`, `#aboutVersion`; `data/sdp-data-sync.js` `APP_VERSION`/`SDP.version`/`SDP.ver=5`; `data/sdp-dictation-engine.js` header; `sw.js` `SW_VERSION='sdp-v0.0.1.e'` / `SHELL_CACHE='sdp-v0.0.1.e-shell'`; `manifest.webmanifest` description/start_url/shortcuts; `data.html` = `data/index.html`.

### Gate results

See the *Release verification* block at the end of this file — filled by the release commit from a full twelve-gate run.

---

## v0.0.1.c — 2026-11-01 — Voice, Vault, Studio & Human-Friendly UI

**Release type:** defect-fix + priority-workstream release over v0.0.1.b (no classroom data migration; `sdp.progress` is never overwritten).
**Audience:** CCBE Galle Branch — B1 English Class. Persona A: Android 360×640–390×844 on unstable 3G/offline. Persona B: Smart Board 1280×720 / 1920×1080, weak OPS box, no keyboard.
**Attribution:** Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu) · නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini.

### What this release is

Forty-two verified defects (D-V1–D-V6, D-G1–D-G5, D-S1–D-S12, D-C1–D-C7, D-L1–D-L9, D-UI1–D-UI12, D-E1–D-E5, D-M1–D-M4) closed across five priority workstreams. The headline fixes:

1. **P1 — the voice works at all.** `pickVoice` was referenced but never defined, so the first
utterance threw `ReferenceError` and every spoken word, the whole guide and the voice test died
silently. It now exists, caches one British Female Professor (en-GB, rate 0.92, pitch 1.03) and
scores every male name (`david|mark|george|daniel|fred|james|richard|oliver|thomas|male|man|guy`)
at −100, so a board laptop can never switch the class to a male voice. (Guide 2.0's 600 ms
watchdog was superseded by the Guide 4.0 spotlight in v0.0.3.)
2. **P2 — the vault survives and syncs in about a second.** `publishFilesSequential` commits one
file at a time, re-reading a fresh SHA before each PUT, always publishing `version.json` last;
`fetchRawGitHubJson` reads the Contents API so a second device never waits out the Pages CDN;
the GAS relay body carries `{action, app, ver}` and no PIN.
3. **P3 — credit-safe audio.** The Quota Inspector is a zero-character `GET /v1/user/subscription`; the run is preflighted at `30 words = 241 chars · 4 guide steps = 731 chars · total 972 chars`; only missing clips are generated (`_guide_1.._guide_4` are reusable keys); a 1-word test button exists for cheap dry runs. No gate, test or script ever calls the TTS endpoint.
4. **P4 — the studio cannot be misused.** A real 56 px twelve-key `#pinPad` (1–9, Clear, 0,
Unlock) with ⌫ outside the pad, Show/Hide and Paste helpers, live `ghp_`/`github_pat_` test
buttons, and a per-clip Commit button that writes to the permanent voice vault.
5. **P5 — a student can see what to do.** Home carries a 1-2-3 journey card and a `Session 8 ready · 30 words` badge; the Smart Board Classroom Bar appears at ≥1024 px with 1..N chips, 64 px transport controls and a spoiler-safe word toggle (`••••••`); `data-theme="board"` is a real token set; the 390 px header clips nothing (verified 320→1440).

### Preserved, byte for byte (Appendix A lock)

Same four hashes as v0.0.1.a (see above). `data/elevenlabs-audio.json` left the frozen table
here: the studio writes it on every publish, so it is budgeted at ≤ 2,500,000 B and its release
header is asserted instead of hash-frozen (D-UI11). It ships zero rendered clips, so publishing
costs nothing until a lecturer presses a generate button.

### Version bump set

`index.html` `TARGET='0.0.1.c'` · `#sdpVerPill` · `#aboutVersion` · meta description · `data/sdp-data-sync.js` `APP_VERSION` / `SDP.version` / `SDP.ver=3` · `sw.js` `SW_VERSION='sdp-v0.0.1.c'` / `SHELL_CACHE='sdp-v0.0.1.c-shell'` · `data/version.json` `ver:3, schema:3, settingsRev:3, syncRev:1762000000002` · `data/config.json` and `data/elevenlabs-audio.json` headers · `manifest.webmanifest` description, `start_url:"./?v=0.0.1.c"` and both shortcuts. `data/studio.js` reads `SDP.version` and never hardcodes a release literal (G1 asserts that over comment-stripped source).

### Gate results

| Gate | Result |
| --- | --- |
| G1 `check.cjs` | 76 PASS / 0 FAIL |
| G2 `upgrade.test.cjs` | 10 PASS / 0 FAIL |
| G3 `phase1.cjs` | 61 PASS / 0 FAIL |
| G4 `server.cjs` | 0 FAIL |
| G5 `browser.cjs` | 44 PASS / 0 FAIL |
| G6 `upgrade-browser.cjs` | 15 PASS / 0 FAIL |
| G7 `e2e.cjs` | 48 PASS / 0 FAIL |
| G8 `live-lab.cjs` | 26 PASS / 0 FAIL |
| G9 `audit-v42.cjs` | 47 PASS / 0 FAIL |
| G10 `voice-guide.cjs` | 21 PASS / 0 FAIL |
| G11 `vault-sync.cjs` | 28 PASS / 0 FAIL |
| G12 `studio-safety.cjs` | 33 PASS / 0 FAIL |

### Byte budgets actually used

`index.html` 28,1xx · `sdp-ui.css` 36,6xx · `sdp-data-sync.js` 54,983 · `sdp-audio-speech.js`
23,6xx · `sdp-dictation-engine.js` 33,759 · `sdp-ui-views.js` 91,7xx · `studio.js` 56,5xx ·
`data-meter.js` 21,740 · `data.html` 27,5xx · `sw.js` 7,3xx — all inside the release ceilings.

---
## v0.0.1.b — 2026-11-01 — Defect Fixes & Classroom Priorities

**Release type:** defect-fix release over v0.0.1.a (no classroom data migration).
**Audience:** CCBE Galle Branch — B1 English Class. Persona A: Android 360×640–390×844 on unstable 3G/offline. Persona B: Smart Board 1280×720 / 1920×1080, weak OPS box, no keyboard.
**Attribution:** Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu).

### What this release is

Thirty-nine tracked defects (D1–D10, E1–E5, F1–F3, G1–G10, H1–H8, I1–I3, J1) fixed: an
in-session version watcher plus a visibility-change guard (a board left open reloads to 0.0.1.b
within two minutes, exactly once); Youdao/CORS dictionary audio no longer kills the shared audio
element; a British Female Professor persona as the unified Tier 1 (en-GB) default with voice lock;
beat/resume integrity (typed text survives a remount, listening restarts at repeat 1, 2 s speech
cap); an honest four-state sync badge; a 12-key storage audit; and Classroom Priorities P1–P5.

### Preserved, byte for byte (Appendix A lock)

`session.json` 46,403 `e0e86c807fc6` · `gas-source.txt` 13,764 `591b9b086f6d` ·
`elevenlabs-audio.json` 717 `72b2b7db5deb` · both fonts unchanged. Verified with
`shasum -a 256 -c /tmp/sdp-preserve.sha256` at the end of P0–P6 — all `OK`. The four true
classroom payloads are untouched; `elevenlabs-audio.json` was deliberately re-issued with
v0.0.1.b voice-pack metadata (Alice, `eleven_flash_v2_5`) and re-pinned in the same release.

### Changed files (v0.0.1.a → v0.0.1.b)

`index.html` 20,270 → 23,626 · `sdp-data-sync.js` 38,705 → 44,878 · `sdp-audio-speech.js`
12,034 → 15,250 · `sdp-dictation-engine.js` 26,254 → 29,381 · `sdp-ui-views.js` 52,360 →
72,635 · `sw.js` 5,090 → 6,128 · `manifest.webmanifest` 2,030 → 2,019 · `version.json` 289 ·
`config.json` 34,388 · `data.html` = `data/index.html` 23,854 → 27,004 each.

`data/sdp-ui-views.js` ceiling raised 56,000 → 90,000 B (W3) to carry Guide 2.0 narration controls, Settings 2.0 presets and the Smart Board jumper; 72,635 B shipped, under ceiling.

### Student-visible outcomes (Classroom Priorities P1–P5)

1. **P1 — In-session upgrade (D1, D5):** boot watcher + `visibilitychange` guard; an open tab reloads to the published build within two minutes, exactly once, guarded by `sdp_upgraded_to`.
2. **P2 — Voice + beat integrity (E1–E5, F1–F3):** no cross-origin audio kill; British Female Professor default (unified Tier 1 en-GB); voice lock unified/custom; resume preserves typed text and restarts listening at repeat 1.
3. **P3 — Guide 2.0 + Settings 2.0 + Smart Board (D3, R3, R7):** auto-playing English narration with Pause/Next/Replay, four pacing presets including board class mode, quick-word jumper in the board cockpit header, high-contrast board theme, honest four-state sync badge.
4. **P4 — Gate-align tests:** all nine gates rebased to 0.0.1.b in a dedicated `gate-align:` commit citing `docs/CHANGELOG_LEDGER.md` and `docs/ARCHITECTURE_MAP.md`.
5. **P5 — Ledgers:** this file, `ARCHITECTURE_MAP.md`, `SYNC_AND_DATA_CONTRACT.md`, `UI_COMPONENT_GUIDE.md`, `DAILY_UPGRADE_PROMPT_TEMPLATE.md`.

### Gate ledger (release run, 2026-11-01)

| Gate | Suite | Result |
| --- | --- | --- |
| G1 | `tests/check.cjs` | 71 PASS / 0 FAIL (strict, every H1 file) |
| G2 | `tests/upgrade.test.cjs` | 10 PASS / 0 FAIL |
| G3 | `tests/phase1.cjs` | 61 PASS / 0 FAIL |
| G4 | `tests/server.cjs` | 8 PASS / 0 FAIL |
| G5 | `tests/browser.cjs` | 44 PASS / 0 FAIL |
| G6 | `tests/upgrade-browser.cjs` | 15 PASS / 0 FAIL |
| G7 | `tests/e2e.cjs` | 48 PASS / 0 FAIL |
| G8 | `tests/live-lab.cjs` | 26 PASS / 0 FAIL |
| G9 | `tests/audit-v42.cjs` | 46 PASS / 0 FAIL |
| **Total** | | **329 PASS / 0 FAIL** (≥ 325 required) |

### Known, deliberate deviations

1. `data/config.json` keeps legacy data fields (`wallpaper`, `videoDim`, …) — W9 forbids trimming the preserved payload. Nothing reads them.
2. `/data` fonts use root-absolute URLs (`/assets/fonts/…`) so one byte-identical file works at both `/data.html` and `/data/index.html`.
3. The app stylesheet resolves `../fonts/` relative to `assets/css/sdp-ui.css` — same preserved files.

Released under: `Release Smart Dictation Player v0.0.1.b (Defect Fixes & Classroom Priorities)`.

---

## v0.0.1.a — 2026-11-01 — Clean-Slate Reset & Student-First Rebuild

**Release type:** full rebuild. **Audience:** CCBE Galle Branch — B1 English.
**Attribution:** Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu).

### What this release is

The v1–v60 single-file app (485 KB `index.html` + a 365 KB minified `data/app-core.js`) was
retired. v0.0.1.a is a clean, unminified, strictly ES5 six-module application whose classroom
data, fonts and backend contracts stayed byte-identical.

### Preserved, byte for byte (Appendix A lock)

`session.json` 46,403 `e0e86c807fc6` · `gas-source.txt` 13,764 `591b9b086f6d` ·
`elevenlabs-audio.json` 920 `153111d6ace4` · `NotoSansSinhala-Regular.woff2` 48,520
`23f1503e1e75` · `NotoSansSinhala-Bold.woff2` 48,748 `bf59c1487b0a`. Verified with
`shasum -a 256 -c` at the end of P0–P6 — all `OK`.

### Deleted

Legacy application (`index.html` 485,175 B, `data.html`, ``data/studio.js`, `sw.js`, `data/learning-tools.js`, `data/media-manifest.json`), 12.9 MB of
wallpapers and posters, six fake `guide-si-*.mp3` stubs, `scripts/` (23 build scripts), `qa/`,
`CHANGELOG.md` (146,743 B), `PHASE1_QA.md`, `QA_REPORT.md`, and every retired v42–v60 feature
(video wallpapers, focus dimmer, rupee badge, data/ready sheets, community tab, Material Mixer).
Deleted, never hidden — G1 greps the shipped bytes, G5 the live DOM.

### Added (v0.0.1.a sizes at release)

`index.html` 20,270 · `sdp-ui.css` 26,047 · `sdp-data-sync.js` 38,705 ·
`sdp-audio-speech.js` 12,034 · `sdp-dictation-engine.js` 26,254 ·
`sdp-ui-views.js` 52,360 · `studio.js` 22,910 · `data/version.json` 289 ·
`data.html` = `data/index.html` 23,854 each · `sw.js` 5,090 ·
`manifest.webmanifest` 2,030. Six modules, one stylesheet, no build step.

Hand-loaded first paint is **≈ 118 KB** including the two Sinhala fonts; the
repeat visit is served from `sdp-v0.0.1.a-shell` and costs ≈ 0 KB.

### Changed

- `data/config.json` — only `ver: 1`, `appVersion`/`version: "0.0.1.a"`,
  `schema: 1`, `settingsRev: 1`. Every preserved payload field is untouched
  (34,388 B, ceiling 36,000 B).
- `data/data-meter.js` — `METER_VERSION = '0.0.1.a'`, `SCHEMA = 1`; the retired
  full-screen video probe is guarded and its old id is assembled from fragments,
  so no retired DOM id appears anywhere in shipped source.
- `tests/server.cjs` (G4) — loader + release-metadata block rebased; the seven
  Apps Script behaviour tests are untouched and still pass 7/7.

### Student-visible outcomes

1. **Sync first.** Session publishes propagate on the next open, every 120 s while
   visible, and on foregrounding — without ever touching `sdp.progress`.
2. **Unmissable bilingual guide.** Auto-opens on the first visit, lives in the
   header (`? Guide`) and on Home, has four steps, an EN|SI pill, an optional
   `en-GB` readout, and zero fake MP3 stubs.
3. **One cockpit.** Listening → writing → self-check in one screen, with an SVG
   ring (sky → emerald → amber) and a 30-row table where the student marks
   ✅/❌ and immediately sees `24 / 30 · 80%`.
4. **Paper mode never opens a keyboard.** `#typeInput` is absent from the DOM and
   `.focus()` is never called outside Typing mode.
5. **Whisper data toast.** `Loaded · N KB` for 2.4 s, bottom-right,
   `pointer-events: none`, then it fades. The real numbers live on `/data`.

### Gate ledger (release run)

G1 51 PASS / 0 FAIL (strict, every H1 file); G4 8 PASS / 0 FAIL (7 untouched Apps
Script + 1 rebased metadata); G2, G3, G5–G9 see their runtime logs. Exact counts are
appended by the release commit that ran all nine gates on a bare checkout.

### Known, deliberate deviations

1. **G4's eight test was rebased.** Its old v58 metadata assertion required
   `appVersion === '9.0.0.4'` and `sdp.v57_secure_local` inside `index.html`; that
   cannot coexist with a new version, so the block and its 13 KB inline loader were
   rebased in a `gate-align:` commit, leaving the seven backend tests byte-identical.
2. **`data/config.json` keeps legacy fields** (`wallpaper`, `videoDim`, …): W9 forbids
   trimming the preserved payload. Nothing reads them.
3. **`/data` fonts use root-absolute URLs** and the stylesheet resolves `../fonts/`,
   so one byte-identical `data.html` serves both routes.

---

## Gate archaeology — P6b, P7 and the v0.0.1.a release verification

The nine gates were first rebased onto 0.0.1.a, then onto 0.0.1.b in one pass, and again at
every release since; the per-release counts live in each entry above. Two shared helpers keep
them honest — `tests/static-server.cjs` (one HTTP server with per-test overrides) and
`tests/app-harness.cjs` (jsdom + fake timers + WebCrypto + deterministic fetch). That
re-baseline surfaced seven real defects (UTF-8 chunk accounting, a sixth storage probe key,
dishonest accuracy after self-check, a missing About block, a dead Enter key, a self-linking
`/data` back button and a lying empty state) — all fixed in the app, never asserted around.

---

## v0.0.1.d — 2026-11-01 — Guaranteed Lecturer Sync, PIN Gate & Unified Voice

Pill: `CREDITS GOES TO Hansana`
Line: `Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu)`
SI: `නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini`

36 verified production defects were closed: SYNC-01..11, SEC-01..05,
VOX-01..09, ENG-01..08, PIPE-01..03.

### Priority #1 — guaranteed multi-device lecturer settings (SYNC-01..11)

| ID | Fix |
| --- | --- |
| SYNC-01 | `config.classSettings` overrides `touchedKeys` for the ten classroom keys whenever `remote.settingsRev > appliedSettingsRev` |
| SYNC-02 | `appliedSettingsRev` persists in `sdp.settings` (default `0`), so a brand-new device adopts on its very first boot |
| SYNC-03 | `#lecturerSyncBar` + `#btnSyncClassSettings` + `Studio.saveClassSettings()` publish the class settings from the Settings screen |
| SYNC-04 | `remote.version` is a string; the upgrade test now reads `version.appVersion \|\| version.version` |
| SYNC-05 | `startWatch(30000)` reads only `raw.githubusercontent.com/…/data/version.json`; `api.github.com` is reserved for visibility/manual/vault |
| SYNC-06 | `setup()` reuses `buildVersionPayload()`, so publish keeps the live session number and title |
| SYNC-07 | `saveKeys()` commits `data/config.json` + `data/version.json` immediately (`Vault saved · synced to GitHub`) |
| SYNC-08 | the duplicate dead `b64decode()` is deleted |
| SYNC-09 | the unauthenticated `pushLiveState()` relay call is removed from `publish()` |
| SYNC-10 | `loadManifest()` resets `manifestRequested` on failure and retries on `online` / `visibilitychange` |
| SYNC-11 | `loadVoicePack()` runs on Studio unlock and before every `generateClips()` delta check |

### Priority #2 — 100% PIN-gated Lecturer Studio (SEC-01..05)

`#studioFirstTimePanel` is **deleted**; the locked body is only `#studioPin`,
`#pinDots`, the 56 px 12-key `#pinPad`, `#studioMsg` and the ask-lecturer hint.
`config.pinVerifier` (PBKDF2-SHA256, 250,000 iterations) authenticates the
bootstrap PIN `78987898` while `encVault` is `SDP_ENC_V2:AAA=`. A new PIN requires
the 2-step `#newPinInput` / `#confirmPinInput` confirmation, and the lockout
(`5` fails → `60 s`, `strikes >= 2` → `300 s`) now lives in
`sdp.settings.vaultLock`, so a reload cannot reset it.

### Priority #3 — GC-safe unified professor voice + speaking guide

`state.activeUtter` / `state.activeQueue` hold the live utterance (VOX-01),
`onend` is the primary driver with a single 1.8 s guard extension (VOX-02), a
10 s `speechSynthesis.resume()` keepalive runs while narrating (VOX-03), the
unified lock returns `[1, 2, 4]` and never plays Youdao's third-party voices
(VOX-04), concurrent `selectProfessorVoice()` callers queue (VOX-06),
`testVoice()` reports the tier that actually played (VOX-08), and `speak()` is
deferred 200 ms after `cancel()` (VOX-09). `#btnStart` opens the Quick
Walkthrough (`#btnGuideSkipStart`) that auto-starts the dictation (VOX-07).

### Priority #4 — repeat-safe cockpit and honest controls

The listening deadline extends by one repeat gap + 1.8 s per pending repeat and
the speech grace cap is 8 s (ENG-01); `repeatGapMs()` is
`max(600, pauseSecs × 1000 + 300)` so 0.5 s means 800 ms (ENG-02);
`conf.hints` loads into `E.hints` (ENG-03); switching practice mode resets
`practice.spoken` (ENG-04); every classroom control goes through one
`saveTouched()` and personal keys stay untouched (ENG-05); the sync badge is
composed from live values (ENG-06); **Invert marks (tap twice)** needs a second
tap inside 3 s (ENG-07); the duplicate `var quick` is now `quickBtn` (ENG-08).

### Priority #5 — human-friendly UI and the green 12-gate pipeline

All cockpit and Settings controls are ≥ 48 px, settings changes toast
immediately, `tests/package.json` and `.github/workflows/checks.yml` chain
`G1`–`G12` (PIPE-01), CI no longer pins the app-written
`data/elevenlabs-audio.json` (PIPE-02), and G1 really asserts the existence of
the G10–G12 files (PIPE-03).

### Test-side realignment (the same release, `gate-align` commit)

Every gate was re-anchored to the new contracts rather than the old
expectations; no production file was relaxed to make a gate pass.

| Gate | File | Assertions | Result |
| --- | --- | --- | --- |
| G1 | `tests/check.cjs` | 85 | 85 PASS / 0 FAIL |
| G2 | `tests/upgrade.test.cjs` | 10 | 10 pass / 0 fail |
| G3 | `tests/phase1.cjs` | 76 | 76 PASS / 0 FAIL |
| G4 | `tests/server.cjs` | 8 | 8 PASS / 0 FAIL |
| G5 | `tests/browser.cjs` | 46 | 46 PASS / 0 FAIL |
| G6 | `tests/upgrade-browser.cjs` | 15 | 15 PASS / 0 FAIL |
| G7 | `tests/e2e.cjs` | 52 | 52 PASS / 0 FAIL |
| G8 | `tests/live-lab.cjs` | 39 | 39 PASS / 0 FAIL |
| G9 | `tests/audit-v42.cjs` | 47 | 47 PASS / 0 FAIL |
| G10 | `tests/voice-guide.cjs` | 21 | 21 PASS / 0 FAIL |
| G11 | `tests/vault-sync.cjs` | 28 | 28 PASS / 0 FAIL |
| G12 | `tests/studio-safety.cjs` | 33 | 33 PASS / 0 FAIL |

New intents added by the realignment: G1 asserts the ten `classSettings` keys,
`config.pinVerifier` (PBKDF2-SHA256 / 250,000 iterations / no PIN literal), the
G10–G12 files, the twelve-gate chain and a CI that no longer hash-pins
`data/elevenlabs-audio.json`; G3 adds §7 (a newer `settingsRev` beats
`touchedKeys`), §8 (first-boot adoption) and §9 (Quick Walkthrough, Skip and a
second Start); G5 adds the 48 px touch-target sweeps; G7 adds the spoken guide
journey; **G8 adds the end-to-end two-device scenario** — a lecturer unlocks
Studio on device A, saves `writeSecs 12 / repeats 4`, taps
`#btnSyncClassSettings`, and device B (with every key in `touchedKeys`) adopts
the pacing on its next boot while its own `sdp.progress` survives untouched.

### Preservation & budgets

`data/session.json`, `data/gas-source.txt` and both Noto Sans Sinhala faces were
re-verified byte-identical (`shasum -a 256 -c`) before and after every phase.
Every shipped file is inside its cap: `index.html` 28,658 B,
`assets/css/sdp-ui.css` 38,520 B, `data/sdp-data-sync.js` 63,848 B,
`data/sdp-audio-speech.js` 29,694 B, `data/sdp-dictation-engine.js` 36,597 B,
`data/sdp-ui-views.js` 101,044 B, `data/studio.js` 68,381 B,
`data/data-meter.js` 21,740 B, `data.html` = `data/index.html` 27,565 B,
`sw.js` 7,335 B.

Released under: `Release Smart Dictation Player v0.0.1.d (Guaranteed Lecturer Sync, PIN Gate & Unified Voice)`.

### Release verification (2026-11-02, full twelve-gate run on the release tree)

```
shasum -a 256 -c /tmp/sdp-preserve.sha256   → 4 × OK
node tests/check.cjs                        → G1  88 PASS / 0 FAIL
node --test tests/upgrade.test.cjs          → G2  10 pass / 0 fail
node tests/phase1.cjs                       → G3  76 PASS / 0 FAIL
node tests/server.cjs                       → G4   8 PASS / 0 FAIL
node tests/browser.cjs                      → G5  46 PASS / 0 FAIL
node tests/upgrade-browser.cjs              → G6  15 PASS / 0 FAIL
node tests/e2e.cjs                          → G7  52 PASS / 0 FAIL
node tests/live-lab.cjs                     → G8  39 PASS / 0 FAIL
node tests/audit-v42.cjs                    → G9  47 PASS / 0 FAIL
node tests/voice-guide.cjs                  → G10 21 PASS / 0 FAIL
node tests/vault-sync.cjs                   → G11 28 PASS / 0 FAIL
node tests/studio-safety.cjs                → G12 33 PASS / 0 FAIL
                                              ─────────────────────
                                              463 assertions, 0 FAIL
```

### Byte budgets actually used

`index.html` 29,348 · `sdp-ui.css` 41,201 · `sdp-data-sync.js` 64,924 ·
`sdp-audio-speech.js` 36,513 · `sdp-dictation-engine.js` 36,597 · `sdp-ui-views.js` 103,620 ·
`studio.js` 71,851 · `data-meter.js` 21,740 · `data/index.html` 27,905 · `sw.js` 10,759 —
all inside the v0.0.1.e ceilings.

Released under: `Smart Dictation Player v0.0.1.e (Honest Sync, British English Default, Guaranteed Voice & Bento UI)`.

## v0.0.1.f — Honest Adoption, One-Click Setup & Free Enrichment (2026-11-02)

ver 6 · schema 6 · settingsRev 6 · appVersion `0.0.1.f` · release `syncRev` 1793590000000 ·
buildDate `2026-11-02`. The release moves the whole classroom surface forward in one
publish clock: no device may ever read a config newer than the version that names it.

### Requirements shipped

* **R1/R2 dual-source adoption.** `fetchFreshDataJson(relPath, cb)` races the same-origin
  Pages copy (`cache:'no-store'`, 6 s) against `raw.githubusercontent.com` (5 s), keeps the
  higher `syncRev` (raw breaks a tie) and reports `source`. A payload leg must *prove* it
  belongs to the winning pointer (`json.syncRev >= targetSyncRev`, or the preserved 30-word
  baseline session number); a stale leg is retried once on the other source and otherwise the
  pointer is **not** advanced (`{error:'stale_payload', deferred:true, retry:[...]}`). The
  watcher, the manifest loader and `loadVoicePack()` all read through this one reader.
* **R3 classroom defaults + one-time migration.** `en` · `exam` · 5 s · 2× · unified ·
  `voiceSource:'auto'` · `rate:0.95`. `defaultsResetV001f` lives **inside** `sdp.settings`
  (five-key law untouched) and clears only the pacing `touchedKeys`.
* **R4 PIN.** `78987898` (4–12 digits) verified with PBKDF2-SHA256 × 250,000 against
  `config.pinVerifier`. Every PIN input is `maxlength="12" minlength="4"`; the dot row renders
  `min(12, max(8, len))` dots. The retired PIN string is scrubbed from shipped code, tests and docs.
* **R5 locked Studio + auto-lock.** The locked DOM is PIN-only; the unlocked header adds
  `#btnLockStudio`; `pagehide`/`beforeunload` lock the board automatically.
* **R6 pause/resume.** `isActive()` is true only in `listening`/`writing`; `pause(reason)`
  records `status`, `pausedPhase`, `remainingMs`, `repeatsDone`, `pauseReason`; `resume()`
  restores the exact beat and can pick a paused draft up after a reload.
* **R7 adoption chain.** `applyPayloads → adoptRemoteSettings → Speech.reloadManifest →
  Views.refreshAll`, deferred to the end of a live beat ("beat deferral"). One 25 s watch,
  a `focus` listener, and a `sdp:update` listener that repaints every view.
* **R8 third vault slot + free enrichment.** `aiKey` / `aiProvider` (`free_dict` default,
  plus `groq`, `gemini`, `openrouter`) travel inside the same `SDP_ENC_V2` envelope.
  `SDP.Studio.enrichWords()` fills `p/pos/m/si/s` from `api.dictionaryapi.dev` and
  `api.mymemory.translated.net` (`en|si`), upgrades a batch through the optional LLM, and
  always ends in the deterministic offline B1 lexicon — it never throws and never calls
  ElevenLabs.
* **R9 instance reload + one-click setup.** `Speech.injectClips()` / `reloadManifest()`,
  `#btnOneClickMasterSetup` with its four-step tracker, the 900 ms cold-boot
  `#guideAutoplayBanner`, and **one** `nextSyncRev()` per publish with `version.json`
  committed last.
* **R10 version bump** across `data/version.json`, `config.json`,
  `elevenlabs-audio.json`, `sw.js` (`sdp-v0.0.1.f` / `sdp-v0.0.1.f-shell`),
  `manifest.webmanifest`, `#sdpVerPill`, About, and the byte-identical
  `data.html` == `data/index.html` pair.

### Defects closed

D1 stale-payload adoption · D2 mixed-source pairs · D3 dead CDN legs · D4 silent
adoption · D5 missing focus watch · D6 PIN length ceiling · D7 stale language default ·
D8 unlocked board left on the Smart Board · D9 `intervalSec`/`writeSecs` drift · D10
two routers · D11 resume replaying repeat 1 · D12 no 30-row editor · D13 stale
`pinVerifier` · D14 key-required enrichment · D15 five-step manual setup · D16 guide
narration silent on a cold boot · D17 object-vs-string `version` · D18 one giant studio
scroll · D19 mixed publish clocks · D20 second publish path in one-click setup.

### Release verification — v0.0.1.g (2026-11-02, full twelve-gate run on the release tree)

```
shasum -a 256 -c /tmp/sdp-preserve.sha256   → 4 × OK
node tests/check.cjs                        → G1  88 PASS / 0 FAIL
node --test tests/upgrade.test.cjs          → G2  12 pass / 0 fail
node tests/phase1.cjs                       → G3  81 PASS / 0 FAIL
node tests/server.cjs                       → G4   8 PASS / 0 FAIL
node tests/browser.cjs                      → G5  46 PASS / 0 FAIL
node tests/upgrade-browser.cjs              → G6  15 PASS / 0 FAIL
node tests/e2e.cjs                          → G7  52 PASS / 0 FAIL
node tests/live-lab.cjs                     → G8  39 PASS / 0 FAIL
node tests/audit-v42.cjs                    → G9  47 PASS / 0 FAIL
node tests/voice-guide.cjs                  → G10 26 PASS / 0 FAIL
node tests/vault-sync.cjs                   → G11 74 PASS / 0 FAIL
node tests/studio-safety.cjs                → G12 78 PASS / 0 FAIL
                                              ─────────────────────
                                              566 assertions, 0 FAIL
```

### Byte budgets actually used (W2 ceilings)

`index.html` 30,170 / 36,000 · `sdp-ui.css` 44,305 / 60,000 · `sdp-data-sync.js`
78,825 / 82,000 · `sdp-audio-speech.js` 38,831 / 52,000 · `sdp-dictation-engine.js`
43,844 / 60,000 · `sdp-ui-views.js` 118,919 / 125,000 · `studio.js` 107,824 / 108,000 ·
`data-meter.js` 21,740 / 24,000 · `data.html` = `data/index.html` 27,905 / 32,000 ·
`sw.js` 10,759 / 13,000 · `config.json` 35,001 / 36,000 · `version.json` 289 / 2,000.
Docs: `ARCHITECTURE_MAP.md` 25,066 B / 48,000 · `SYNC_AND_DATA_CONTRACT.md` 26,632 B / 48,000 ·
`UI_COMPONENT_GUIDE.md` 23,497 B / 48,000 · `DAILY_UPGRADE_PROMPT_TEMPLATE.md` 19,784 B / 24,000 ·
`CHANGELOG_LEDGER.md` 47,470 B / 48,000.

### Preserved payloads (byte-identical, `shasum -a 256 -c` 4 × OK)

`data/session.json` `e0e86c80…b86a5f` · `data/gas-source.txt` `591b9b08…b0981e` ·
`NotoSansSinhala-Regular.woff2` `23f1503e…d20ff280` ·
`NotoSansSinhala-Bold.woff2` `bf59c148…944a643e`. `data/elevenlabs-audio.json` stays
app-written and budgeted (≤ 2.5 MB), never hash-frozen.

Released under: `Release Smart Dictation Player v0.0.1.g (Scoped-Key Survival, Immortal Vault & the Free AI Ladder)`.

---

## v0.0.4.a — Single-Voice Alice Pack, Zero-Touch Auto-Enrichment (2026-11-03)

- Monotonic stamp: ver 13 / schema 13 / settingsRev 25 / appVersion 0.0.4.a across all nine versioned surfaces; `SW_VERSION = 'sdp-v0.0.4.a'`, `SHELL_CACHE = 'sdp-v0.0.4.a-shell'`, `PRESERVE_CACHES = []` so the stale `sdp-youdao-v1` / `sdp-audio-clips` caches purge on upgrade.
- W1 single-voice engine law: Alice (`Xb7hH8MSUJpSbSDYk0k2`, `eleven_flash_v2_5`) replaces library voice Charlotte (HTTP 402 paid_plan_required on free tiers); `resolveProfessorVoice` picks the best free British female educator voice; `saveKeys()`/`unlock()` auto-generate + commit the 70-clip pack; `resolveTiers()` never mixes Youdao dictionary MP3s under `unified`.
- W2 100% zero-touch auto word enrichment: `SI_LEXICON` + `translateSi` cascade (lexicon → Google Translate gtx → MyMemory → pollinations), Gemini model cascade (2.0-flash → flash-latest → 2.5-flash), 400 ms debounced auto-enrich on `#studioBulkWords`, read-only `.wm-row` preview badges with a ✎ edit toggle.
- W3 PIN pad: `#studioPin` is `readonly inputmode="none" tabindex="-1"`, the locked gate never calls `.focus()`, and physical-keyboard PIN entry works on `#screen-studio`.
- W4 Smart Board + 30-word cards render the full word with `#N/30`, `/IPA/`, POS and Sinhala at 360 px with zero clipping.
- W5 soft eye-care dark (`#1E293B`/`#26334D`) + clean daylight light (`#F8FAFC`/`#FFFFFF`) themes, inline SVG icon system (`SDP.Icons`), one-row topbar.

## v0.0.4.a final delta (S1 / S2 / S4)
- S1: monotonic `settingsRev 25` and `syncRev 1793704800000` (both above main's 24 / 1793699254751) across version.json, config.json, elevenlabs-audio.json, SETTINGS_REV and every gate pin. `data/session.json` stays byte-identical at `bd42e858` / 57,379 B.
- S2: `paintHome()` hides the duplicate `#btnResume` while paused; CSS hides the home STEP cue and the redundant ready/preset badges. Markup and the `STEP 1 — PRESS HERE` literal are preserved.
- S4: `unlockWithVerifier()` now runs the same guarded 70-clip Alice auto-generation top-up as `unlock()`.

## v0.0.4.b — zero-credit clip recovery and the 2.27 MB manifest

**Stamp:** `appVersion/version '0.0.4.b'` · `ver 14` · `schema 14` · `settingsRev 27` · `syncRev 1793710000000` · `SW_VERSION 'sdp-v0.0.4.b'` / `SHELL_CACHE 'sdp-v0.0.4.b-shell'` · `TARGET='0.0.4.b'`.

* Iron law: zero new ElevenLabs generation. All 100 Alice MP3 clips and the Creator's 30 words (`important`…`terrible`, 55,260 B, SHA `12b292fe…`) preserved. BUG-1: the three `auto:true` unlock/save races are gone — only an explicit click can request a clip; `#btnRecoverClips` restores from History with GET reads only (0 credits).
* BUG-2: `publishFilesSequential` retries a 409 up to three times with a fresh SHA; `commitVoicePack` queues concurrent publishes behind a pure-ES5 mutex. BUG-3: `wordsSig` fingerprints every `sdp.session` draft; a mismatched list clears the draft so old words cannot resurrect. BUG-4: the duplicate `.url` blob was stripped from `data/elevenlabs-audio.json` (4.5 MB → ~2.27 MB).
* FIX-7: modern 2026 tactile pill buttons and Material-3/iOS settings cards in `assets/css/sdp-ui.css`; every DOM id, class, data-* and aria-* preserved. All twelve gates G1–G12 re-pinned to the v0.0.4.b stamp and report 0 FAIL.

## v0.0.5.c — Sapphire Ladder · human-friendly UI (2026-11-04)
- sdp-ui.css rewritten in place (97,804 -> 57,942 B, 41% headroom): six-step surface ladder per theme (canvas/sunken/card/elevated/interactive/accent-glass), hairline strokes replace card shadows, blur(12px) glass on header/rail/tabbar only; light theme warm alabaster; board theme pure black. Ink/surface pairs pre-verified >= 4.5:1 WCAG AA — fixes 30 invisible word-list controls measured at contrast 1.1 and the Sinhala cockpit chip.
- Cockpit: beat ring is the single focal point (tabular seconds); tactile transport deck (72px hero key, 56px siblings with micro-captions, 48px quiet row). Home: sapphire hero glow, semantic state pills, calm credits. Word list: two-line card anatomy, state-coloured left rail, circular Alice play button. Studio: calm console rhythm; PIN pad kept at 56px.
- Zero JS behaviour changes: 6 ES5 modules, 100-clip Alice pack, SDP_ENC_V2 vault, session.json/gas-source/fonts byte locks untouched. Version literal bumped in lockstep across 7 shipped surfaces + 11 gate files; syncRev 1793740000001; 12 gates green.

## v0.0.6.a — Human-First Daylight · Real British IPA & All-in-One Studio (2026-11-04)

**Stamp:** `appVersion/version '0.0.6.a'` · `ver 16` · `schema 16` · `settingsRev 31` · `syncRev 1793750000000` · `SW_VERSION 'sdp-v0.0.6.a-s16'` / `SHELL_CACHE 'sdp-v0.0.6.a-s16-shell'` · `TARGET='0.0.6.a'` · `buildDate 2026-11-04`.

* Light Mode is the mandatory default: `index.html`/`data.html` boot `data-theme="light"`, cloak `#F8FAFC/#0F172A`, `DEFAULT_SETTINGS.theme='light'` (unknown heals to light), `config.json classSettings.theme='light'`, manifest `theme_color/background_color #F8FAFC` (G9.7c re-pinned). Dark and Board stay optional.
* Real British Phonemic IPA: all 60 `data/session.json` words (30 Session 8 + 30 Session 7) now carry Oxford/Cambridge IPA (important /ɪmˈpɔːtənt/), real `pos`, B1 definitions, Sinhala meanings, B1 sentences; re-pinned at exactly 44,885 B (44885), SHA `b1d178d3…` across check.cjs, audit-v42.cjs, checks.yml, data.html, data/index.html, ARCHITECTURE_MAP.md. The `config.json` Session 7 archive is enriched identically.
* Studio offline IPA engine: `fallbackEnrich()` never prints the spelling as phonetics — 60-word `BRITISH_IPA_LEXICON` + deterministic transcriber (digraph/suffix tables, first-vowel stress) yields real /…/ with zero keys; `mergeEnrichRecord()` strips `/word/` placeholders.
* Mobile Word Reveal: `#boardClassBar` is a first-class cockpit control on every viewport (was board-preset or ≥1024px only). Each beat re-arms the hidden reveal (`enterWord`→`resetBoardReveal()`); the word still never leaks (R10/G7.3c). Fake-IPA guard on the board meta line.
* Dictation Clock: new `#beatPhasePill` (EN+SI) — 🎧 Listening · Repeat 1/2, ✍️ Write the word · 5s, ⏳ Finish writing · 3s pulsing amber — with gate-verbatim `#beatStateText`, ring colors and countdown assertions preserved (G3.4d/e, G5.6a/b/c, G7.3d/g). Ring/bar gained 0.12s linear transitions.
* All-in-One wizard: new 4 steps — verify vault & keys → auto-enrich 30 words (real IPA) → Alice voice sync under the 0-credit guard (`force:false`, reuse the 100 clips) → atomic publish + broadcast; live "N / 30 Words Recognized ✓" pill (400ms debounce), spring CTA pulse, and a bilingual Problem+Solution+1-Click-Fix card (`#studioErrorAssistant`).
* Light contrast hardening: glass pills use `--accent-fg #1D4ED8` etc. instead of `--accent-ink`; inputs 1.5px `#CBD5E1` on `#F1F5F9`; cards 1px `#E2E8F0`; badges/chips/step states readable in all three themes (WCAG ≥ 4.5:1).
* Zero ElevenLabs credits; all 100 Alice clips byte-preserved; `gas-source.txt` + Sinhala fonts untouched; `data.html`/`data/index.html` byte-identical; five-key law intact; every .js parses ES5 (max ≤ 400, avg ≤ 200); 12 gates green (0 FAIL).



## v0.0.6.f — Complete Human UI Release (Orbital Remote Cockpit)

Released 2026-11-05 · ver 20 / schema 20 / settingsRev 36 / syncRev 1793880000000 ·
SW caches `sdp-v0.0.6.f-s21` (+ preserved `sdp-audio-clips`, `sdp-youdao-v1`).

* **R1 Orbital TV-remote cockpit** — Prev West / Next East / Play-Pause + Replay
  on the south arc of the 172px clock dial; the duplicate Smart-Board transport
  row (#boardClassBar) and its second jump drawer stay in the DOM but are never
  painted (`display:none !important`); secondary tools (Repeat/Hint/Mode/Check)
  moved into one quiet pill strip (#cockpitHelpers).
* **R1 YouTube tap burst** — the ring tap overlay now scales 0.55 → 1.22 and
  fades 0 → 1 → 0 over 450 ms with a solid high-contrast Play/Pause badge; a
  paused dial wears a soft amber halo (#ringWrap.is-paused).
* **R2 Reveal card meanings** — #revealWordCard (North of the dial, inside the
  first 360×640 viewport) shows the spelling, IPA, part of speech, Sinhala and
  English meaning; revealing auto-pauses the beat and the card resets on every
  Prev/Next/Jump.
* **R3 Zero robotic voice** — sayCue() never falls back to browser
  speechSynthesis: a cue is either the committed Alice MP3 or silence; the
  silent path resolves on the NEXT tick so startTicker() cannot clear the cue
  timer. enterWord()/repeatWord()/resume() call SDP.Speech.stop() first, so
  rapid transport taps can never stack two voices.
* **R4 Studio daily-job cards** — comma/semicolon/newline-only word parser
  (hyphens and spaces never split), the live 30-word chip grid with ⇄ merge and
  ✕ remove, the non-destructive 31-word amber helper, the ✓ Confirm Edited
  Words tick, Session No + Topic fields, and STEP 1/2/3 tags on the three cards.
* **R5 Offline** — the service worker preserves sdp-audio-clips and
  sdp-youdao-v1 across upgrades (0 KB on repeated sessions); Lecturer Studio is
  strictly online-only: offline, the whole studio surface is blinded and only
  #sdpStudioOfflineCard remains.
* **R6 Beta preview + One-UI capsule** — #sdpBetaPill is always visible as a
  Preview switcher (?beta / #beta / ?b=1); the update capsule asks mid-session
  ("New classroom words are ready. Refresh now?") and auto-refreshes when idle
  with a 1.5 s progress bar; later → the amber stale pill.
* **R7 Squircle icon system** — color-coded iOS/One-UI squircles on the six
  tabs and the settings cards; Light default + Dark themes; credits verbatim.

Gates: G1 110, G2 12, G3 102, G4 8, G5 60, G6 15, G7 52, G8 39, G9 47, G10 38,
G11 74, G12 94 — 12/12 green.
