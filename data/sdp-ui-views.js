/*! Smart Dictation Player — views, i18n & router (v0.0.4.a)
 * Strict ES5, dependency free, no runtime CSS injection.
 * contract: docs/UI_COMPONENT_GUIDE.md §Components
 * contract: docs/ARCHITECTURE_MAP.md §R3 single-active-screen, §R9 data toast */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};
  var doc = global.document;
  /* Single source of truth: SDP.version (sdp-data-sync.js). */
  var APP_VERSION = (function () {
    try { if (SDP && SDP.version) return String(SDP.version); } catch (e) {}
    try { if (global.__SDP_BOOT_VERSION__) return String(global.__SDP_BOOT_VERSION__); } catch (e) {}
    return '0.0.4.a';
  })();

  function noop() {}
  function str(v) { return v === null || v === undefined ? '' : String(v); }
  /* D14: the #01..#30 badge keeps two digits so the order never looks wrong. */
  function pad2(n) { var v = Number(n) || 0; return (v < 10 ? '0' : '') + v; }
  function isObj(v) { return !!v && typeof v === 'object'; }
  function byId(id) { return doc && doc.getElementById ? doc.getElementById(id) : null; }
  function setText(el, text) { if (el) el.textContent = str(text); }
  function esc(text) {
    return str(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function on(id, evt, fn) {
    var node = byId(id);
    if (!node || node['_sdp_' + evt]) return null;
    node['_sdp_' + evt] = true;
    node.addEventListener(evt, fn);
    return node;
  }

  /* ══ STRINGS  ══ */
  
  var STRINGS_EN = {
    appName: 'Smart Dictation',
    guideBtn: '? Guide',
    tabHome: 'Home', tabPlayer: 'Dictation', tabPractice: 'Practice', tabWords: '30 Words', tabSettings: 'Settings',
    homeTitle: 'Smart Dictation', homeSub: 'Listen, write, and check 30 B1 words with your class.',
    startDictation: '▶ Start Dictation (Word #1 to #30)', howToUse: 'How to Use',
    paperMode: 'Paper', typingMode: 'Typing', resumeSession: 'Continue where you stopped',
    statMastered: 'Mastered', statAccuracy: 'Accuracy', statStreak: 'Day streak',
    quickPractice: 'Quick practice', flashcards: 'Flashcards', quiz: '4-Choice Quiz', listening: 'Listening Drill',
    flashcardsSub: 'Flip through all 30 words', quizSub: 'Pick the right meaning', listeningSub: 'Hear it, then choose', weakWordsSub: 'Retry the ones you missed',
    weakWords: 'Weak Words', mastered: 'Mastered', announcements: 'Class announcement',
    creditsLine: 'Lecturer in Charge: Ms. Sumodya Sewmini · Creator: Hansana · Concept: Ayya01 (Lesandu)',
    creditsPill: 'CREDITS GOES TO Hansana',
    btnPrev: '⏮ Prev', btnPlayPause: '⏸ Pause Dictation', btnNext: 'Next', btnRepeat: 'Repeat', btnHint: 'Hint',
    btnModeSwitch: 'Paper / Typing', btnFinish: 'Finish & check',
    readyBeat: 'Ready', listeningBeat: 'Listening', writeNowBeat: 'Write Now', pausedBeat: 'Paused',
    finishedBeat: 'Finished — check your answers', repeatWord: 'Repeat', remainingWord: 'remaining',
    noWords: 'No words loaded yet', hintPos: 'Word type', hintFirst: 'First letter', hintSi: 'Sinhala meaning',
    hintSentence: 'Example sentence', playAudio: 'Play audio',
    resultsTitle: 'Self-Check & Results', colYourWord: 'Your word', colCorrectWord: 'Correct word', colMark: 'Mark',
    markCorrect: 'Correct', markMissed: 'Missed', markAll: 'Mark all correct', toggleMissed: 'Toggle missed',
    btnRetryMissed: 'Retry missed words', btnNewSession: 'Start new session',
    filterAll: 'All 30', searchWords: 'Search words', noWordsFound: 'No words found',
    tapToFlip: 'Tap the card to see the meaning', nextCard: 'Next card', prevCard: 'Previous card',
    chooseMeaning: 'Choose the correct meaning', listenAndChoose: 'Listen and choose the correct word',
    weakWordsOnly: 'Weak words only', correctPick: 'Correct!', wrongPick: 'Not quite',
    setPacing: '1 · Dictation pacing & mode', modeLabel: 'Mode', writeTime: 'Writing time', repeats: 'Word repeats',
    pauseBetween: 'Pause between repeats', autoAdvance: 'Advance automatically',
    setAudio: '2 · Audio & voice', voiceSource: 'Voice source', voiceAuto: 'Auto (best British voice)',
    voiceLecturer: 'Lecturer clips', voiceAlice: 'Charlotte (ElevenLabs UK)', voiceDevice: 'Device voice',
    rate: 'Speech rate', volume: 'Volume', testVoice: 'Test Voice',
    setLangTheme: '3 · Language & appearance', language: 'Language', theme: 'Theme',
    themeDark: 'Dark', themeLight: 'Light', langEnglish: 'English', langSinhala: 'Sinhala',
    aboutTitle: '5 · About this app',
    aboutBlurb: 'A free, offline-first dictation trainer for one class — no accounts, no ads, no tracking.',
    aboutAudience: 'Built for the CCBE Galle Branch — B1 English Class, Sri Lanka.',
    aboutVersionLabel: 'Version', aboutBuiltLabel: 'Built',
    aboutDataLink: 'See every byte this app stores',
    emptyBank: 'No word list is available yet. Connect once, then tap "Check for session update" in Settings.',
    setProgress: '4 · Progress & offline storage', exportBackup: 'Export backup', importBackup: 'Import backup',
    resetStats: 'Reset local stats', checkUpdate: 'Check for session update',
    studioTitle: '6 · Lecturer Studio & admin vault', studioLocked: 'Enter the lecturer PIN to open the studio.',
    studioChangePin: 'Change PIN',
    /* Table B additions — UI labels, badges, presets and studio controls */
    dictSearchPh: 'Search 30 words (English, Sinhala, IPA)...',
    syncBadgeSynced: 'Synced',
    syncShortSyncing: 'Syncing…',
    lecturerSyncBar: ' Broadcast Current Pacing & Settings (Fast Exam 5s · 2×) to All Classroom Devices',
    lecturerSyncLast: 'Last synced to the class',
    /* D19: a dedicated idle label — applyLang can never overwrite a real stamp. */
    lecturerSyncIdle: 'Not synced yet — press Save & Sync',
    lecturerSyncedToast: ' Synced teacher\'s latest classroom settings (Rev #',
    lecturerSyncNoToken: 'Add a GitHub token in Lecturer Studio to sync the class',
    guideQuickTitle: 'Quick Voice Guide — How This Dictation Works',
    guideSkipStart: '⏩ Skip Guide & Start Immediately',
    studioAskLecturer: 'Ask your lecturer to unlock Lecturer Studio with the PIN.',
    studioPinMismatch: 'The two PINs do not match — type the same 4–8 digits twice.',
    invertMarks: 'Invert marks (tap twice)',
    invertConfirmToast: 'Tap Invert marks again within 3s to confirm',
    syncBadgeOffline: 'Offline — showing cached session',
    syncBadgeUpdate: 'Update found — tap to reload',
    syncBadgeRetry: 'Check failed — retry',
    guideReplay: ' Replay Step-by-Step Voice Guide',
    guideAutoPlay: 'Auto-play English voice guide on start',
    presetHeading: 'Quick Pacing Presets',
    presetBeginner: ' Beginner Slow (12s · 4×)',
    presetStandard: ' CCBE B1 Standard (8s · 3×)',
    presetExam: ' Fast Exam (5s · 2×)',
    presetBoard: ' Smart Board Class Mode',
    themeBoard: 'Smart Board High-Contrast',
    voiceLockLabel: 'Voice Persona Lock',
    voiceLockUnified: 'British Female Professor (Unified 25–35 UK)',
    voiceLockCustom: 'Follow Individual Tier Source',
    downloadClips: ' Download All 30 Word Audio Clips for Offline Use',
    downloadClipsDone: 'Cached 30 of 30 audio clips for offline use',
    studioFirstTime: 'First-Time Studio Setup: Set Your 4–8 Digit Lecturer PIN + API Keys',
    studioTestEl: 'Test ElevenLabs Key',
    studioTestGh: 'Test GitHub Token',
    studioShow: 'Show',
    studioHide: 'Hide',
    studioPaste: 'Paste',
    pinPadClear: 'Clear',
    pinPadUnlock: 'Unlock',
    studioCommitClip: 'Commit Recorded Clip',
    toastLoaded: 'Loaded', toastOffline: 'Offline ready',
    updateChecking: 'Checking for a newer session…', updateNone: 'You already have the latest session',
    updateFound: 'New session downloaded', resetDone: 'Local stats cleared', exportReady: 'Backup downloaded',
    importOk: 'Backup restored', importBad: 'That backup file could not be read',
    presetApplied: 'Preset applied',
    storageLine: 'stored on this device', resumeAt: 'Continue from word',
    voiceTest: 'Voice test', playWordAudio: 'Play', listen: 'Listen',
    studioPinLabel: 'Lecturer PIN', studioUnlock: 'Unlock studio', studioSetup: 'Create the vault',
    studioSetupHint: 'First time here? Choose a PIN to create the encrypted vault.',
    studioLockedOut: 'Too many wrong PINs. Try again in', seconds: 'seconds',
    studioBadPin: 'Wrong PIN', studioEditor: 'Session words (one per line: w | ipa | pos | meaning | sinhala | sentence)',
    studioPreview: 'Publish preview', studioPublish: 'Publish session', studioGenerate: 'Generate Alice clips',
    studioRecord: 'Record word', studioSave: ' Save Keys to Vault Only', studioLock: 'Lock studio',
    studioEnvelope: 'Encrypted vault envelope (SDP_ENC_V2)', studioCopy: 'Copy envelope',
    studioPublishOk: 'Session published', studioPublishFail: 'Publish failed',
    studioNoToken: 'Add a GitHub token (Contents API) in the vault first', studioWordsCount: 'words parsed',
    studioElevenNote: 'ElevenLabs generation runs only while unlocked, using the Charlotte voice and flash_v2_5.',
    /* ── v0.0.1.c Table B: Guide 2.0, Home journey, Smart Board bar, Studio ── */
    guideTapToStart: ' Tap anywhere to start the voice guide',
    homeJourney1: 'Listen & write',
    homeJourney2: 'Check your 30 words',
    homeJourney3: 'Train weak words',
    homeReadyBadge: 'Session 8 ready · 30 words',
    modePaperFull: ' Write in Exercise Book (Paper)',
    modeTypingFull: '⌨ Type on Screen',
    voiceGuideBtn: ' Interactive Voice Guide',
    boardShowWord: ' Show Word on Board',
    boardHideWord: ' Hide Word on Board',
    quotaHeading: 'ElevenLabs Character Quota (Zero-Cost Check)',
    costPreviewLabel: 'Estimated Generation Cost',
    testOneWordBtn: ' Test 1 Word (~8 chars)',
    forceRegenLabel: 'Force re-generate existing clips',
    genDeltaBtn: ' Generate Missing Clips (Credit-Saver)',
    teacherUpdatedToast: 'Your teacher updated the class settings',
    vaultSavedToast: 'Vault saved · synced to GitHub',
    guideVoiceFailed: 'Voice guide unavailable — tap to retry',
    boardPlayPause: '▶ Play / Pause',
    boardRepeat: ' Repeat',
    boardNext: '⏭ Next',
    boardJumpLabel: 'Jump to word',
    syncShortSynced: 'Synced ',
    syncShortOffline: 'Offline',
    syncShortUpdate: 'Update',
    syncShortRetry: 'Retry',
    homeJourneyTitle: 'Your 3 steps today',
    settingsSyncLabel: 'Sync',
    settingsUpdateLabel: 'Update',
    guiding: 'Guide',
    /* v0.0.1.f additions (D9, D13, D14, D17, D18) */
    resumePaused: 'Resume Paused Dictation',
    homePresetBadge: 'Fast Exam · 5s · 2× · British English',
    repeatBadge: 'Repeat',
    pausedBanner: 'Paused — Tap Resume to Continue',
    btnResumeDictation: 'Resume Dictation',
    pauseReasonNavigation: 'you switched screens',
    pauseReasonModal: 'a dialog opened',
    pauseReasonVisibility: 'the app went to the background',
    pauseReasonUser: 'you tapped pause',
    guideAutoplayBanner: ' Tap Anywhere to Start Voice Guide',
    studioCardKeys: 'STEP 1 — API KEYS & 70-CLIP VOICE PACK GENERATOR',
    studioCardWords: 'STEP 2 — 30-WORD SESSION EDITOR & FREE AI AUTO-FILL',
    studioCardSettings: 'STEP 3 — CLASSROOM SETTINGS BROADCAST & PIN SECURITY',
    studioLockLecturer: 'Lock Lecturer Mode',
    studioAiProvider: 'Free AI / dictionary engine',
    studioAiKey: 'Free AI key (optional)',
    studioTestAi: 'Test Free AI / Dictionary Engine',
    studioAiNoKey: '1: Built-in Free Oxford/Wikimedia Dictionary + Sinhala Translator (100% Free — No API Key Needed)',
    studioOneClick: ' Generate 70 British Professor Voices & Sync All Devices',
    studioBulkWords: 'Paste or type up to 30 words (one per line, or comma separated)',
    studioEnrich: 'Auto-Fill IPA, English & Sinhala Meanings (Free AI / Dictionary)',
    studioWordManager: 'Word manager — # · w · p · pos · m · si · s',
    studioPublishWordsVoice: ' Auto-Enrich & Publish 30 Words',
    studioSyncSettings: ' Save & Sync Classroom Settings to All Devices',
    studioMasterSteps: 'Setup progress',
    studioEnriching: 'Enriching',
    studioEnriched: 'Enriched',
    studioAiOffline: 'offline B1 lexicon used',
    /* ── v0.0.1.h (D2, D6, D7, D10, D13, D14) ── */
    vaultBadgeLabel: 'Vault Saved & Protected Across Updates',
    studioFreeNoKey: '100% Free — No API Key Required!',
    studioQuotaScoped: 'Key accepted (scoped/free-tier key — quota read bypassed)',
    studioElTierWarn: 'ElevenLabs free quota/tier limit reached — using Built-in Free British Female Professor Voice for remaining words',
    studioSavedLocal: 'Saved in local Vault (protected across updates)',
    studioAiSlotPollinations: '2: Pollinations Free Open-Source AI (Llama/Mistral — 100% Free, No API Key Needed!)',
    studioAiSlotGroq: '3: Groq Cloud Free Tier · Llama-3.3-70B Open-Source (gsk_… — Free, No Credit Card)',
    studioAiSlotOpenrouter: '4: OpenRouter Free Models · Llama-3.3-70B:free (sk-or-… — Free Tier)',
    studioAiSlotGemini: '5: Google Gemini Free Tier · gemini-2.5-flash (AIza… — Optional)',
    studioWorking: 'Working…',
    studioClear: 'Clear',
    studioRestored: 'Studio restored from this tab',
    studioNoVaultWarn: 'No vault sealed yet — words publish without keys; seal the vault when you add your keys',
    studioAiOfflineFallback: 'AI offline — free dictionary used',
    /* ── v0.0.2.a (D5–D16): 6-tab shell, 1-2-3 Home, tactile cues, Guide 3.0 ── */
    tabStudio: 'Lecturer',
    homeStep1Tag: 'STEP 1', homeStep2Tag: 'STEP 2', homeStep3Tag: 'STEP 3',
    homeWordsTitle: 'Check & Study All 30 Session Words in Order #1–#30',
    homeWordsSub: 'Every word in class order with its British IPA, Sinhala meaning and example sentence.',
    homeWordsBtn: ' Open the 30-Word List (#1–#30)',
    resumeMetaIdle: 'Paused at Word #1 of 30',
    startOver: '↺ Start Over from Word #1',
    cueStep1: 'STEP 1 — PRESS HERE',
    cuePlayer: 'PAUSE OR RESUME HERE',
    cueDict: 'TAP A WORD TO LISTEN',
    cueStudio: 'ENTER YOUR PIN',
    settingsLecturerActive: ' Lecturer Mode Active — Open Lecturer Admin Studio to Broadcast Settings or Edit 30 Words',
    openStudioBtn: ' Open Lecturer Admin Studio',
    studioScreenTitle: ' Lecturer Admin Studio',
    studioScreenSub: 'Three numbered steps: keys and the 70-clip voice pack, the 30-word session editor, and the classroom settings broadcast.',
    lecturerAdminLocked: ' Lecturer Admin', lecturerAdminUnlocked: ' Lecturer Admin',
    btnReplay: ' Replay Word',
    btnPauseDictation: '⏸ Pause Dictation',
    btnResumeWord: '▶ Resume Word #',
    btnPrevNum: '⏮ Prev (#', btnNextNum: '⏭ Next (#',
    listenCarefully: 'Listen Carefully (Repeat ', writeInBook: 'Write Word #',
    inYourBook: ' in Your Book! (', countdownTail: 's countdown)',
    pausedAtWord: 'Dictation Paused at Word #', pausedResumeTail: ' — Press Resume Below',
    resumeMetaLine: 'Paused at Word #', ofWord: ' of 30 · Repeat ', secondsLeft: 's left',
    progressWord: 'Word #', progressOf: ' of 30',
    /* Phase 5 (v0.0.4.a): the one-line cockpit header and the symbol deck. */
    progressWordUpper: 'WORD #', progressOf30: ' / 30', repeatOf: ' of ', writeSecsBadge: 's Write',
    capPrev: 'Prev', capPlay: 'Pause', capReplay: 'Replay', capNext: 'Next',
    capRepeat: 'Repeat', capHint: 'Hint', capMode: 'Mode', capFinish: 'Check',
    pillsDrawer: 'Jump to Word 1–30 ▾',
    markCorrectWord: ' Correct', markWeakWord: ' Needs Practice', btnStartDictation: '▶ Start Dictation',
    studioRetryNone: 'No failed clip to retry — every clip is already saved.',
    studioRetryOne: '↻ Retry Only the Failed Clip',
    studioStep1Head: 'STEP 1 — API KEYS & 70-CLIP VOICE PACK GENERATOR',
    studioStep2Head: 'STEP 2 — 30-WORD SESSION EDITOR & FREE AI AUTO-FILL',
    studioStep3Head: 'STEP 3 — CLASSROOM SETTINGS BROADCAST & PIN SECURITY',
    studioPackVault: 'Vault: Saved ', studioPackGithub: 'GitHub: Connected ', studioPackClips: 'Voice Pack: ',
    studioClipsUnit: '/70 Clips', studioGenPrefix: 'Generating clip ',
    studioGenCharsTail: ' chars used', studioClipsSaved: '/70 Clips Saved to GitHub · syncRev ',
    studioRetryFailed: ' Retry Only the Missing Clips',
    studioOneClick34: ' Generate 70 British Professor Voices & Sync All Devices',
    studioSaveOnly: ' Save Keys to Vault Only',
    studioPublishWordsVoice34: ' Auto-Enrich & Publish 30 Words',
    studioBroadcast34: ' Broadcast Current Pacing & Settings (Fast Exam 5s · 2×) to All Classroom Devices',    guideCard3Tag: '3 of 4 — Check Words #1 to #30 in Order', guideCard4Tag: '4 of 4 — Automatic Classroom Sync & Lecturer Admin',
    guideSkipStartNow: '▶ Start Dictation Now',
    /* R2 (v0.0.4.a): the compact spotlight — four clean spoken sentences. */
    guideSpotlight1: 'Press Start Dictation to begin.',
    guideSpotlight2: 'Listen twice, then write in five seconds.',
    guideSpotlight3: 'Check all thirty words in order.',
    guideSpotlight4: 'Practise the words you missed.',
    guideStepTagPrefix: 'Step', guideStepTagSuffix: 'of 4',
    guideExitBtn: ' Exit',
    studioSavedOk: ' Keys saved & protected across updates',
    studioVerifyEl: ' Test & Verify ElevenLabs Voice Key',
    studioVerifyOk: 'VALID  (Remaining Free Credits: ',
    studioVerifyBad: 'INVALID KEY  (HTTP ',
    studioVerifyHint: 'INVALID KEY — paste the sk_… secret from ElevenLabs (the e1b… value is the key ID and will not work)',
    studioClips70: '70 clips = 829 chars ≈ 8.3% of the free monthly quota (flash_v2_5 ≈ 414 credits)',
    studioRecoveryUsed: 'Master recovery used — set a new PIN now',
    studioChangePinBtn: ' Change Lecturer PIN',
    studioPublishOkFull: ' Published & synced to all classroom devices'
  };

  
  var STRINGS_SI = {
    appName: 'Smart Dictation',
    guideBtn: '? උපදෙස්',
    tabHome: 'මුල් පිටුව', tabPlayer: 'ඩික්ටේෂන්', tabPractice: 'අභ්‍යාස', tabWords: 'වචන 30', tabSettings: 'සැකසුම්',
    homeTitle: 'Smart Dictation', homeSub: 'ඔබේ පන්තියේ B1 වචන 30 අසමින් ලියන්න, පසුව පරීක්ෂා කරන්න.',
    startDictation: '▶ ඩික්ටේෂන් ආරම්භ කරන්න (වචන #1–#30)', howToUse: 'භාවිතා කරන ආකාරය',
    paperMode: 'පොතේ ලිවීම', typingMode: 'ටයිප් කිරීම', resumeSession: 'නැවැත්වූ තැනින් ඉදිරියට යන්න',
    statMastered: 'ප්‍රගුණ කළ වචන', statAccuracy: 'නිවැරදිභාවය', statStreak: 'දින පෙළ',
    quickPractice: 'ක්ෂණික අභ්‍යාස', flashcards: 'ෆ්ලෑෂ් කාඩ්', quiz: 'බහුවරණ ප්‍රශ්න', listening: 'ශ්‍රවණ අභ්‍යාස',
    flashcardsSub: 'වචන 30 ම පෙරළන්න', quizSub: 'නිවැරදි අර්ථය තෝරන්න', listeningSub: 'අහන්න, එතැනින් තෝරන්න', weakWordsSub: 'මඟ හැරි ඒවා නැවත අභ්‍යාස කරන්න',
    weakWords: 'දුර්වල වචන', mastered: 'ප්‍රගුණ කළ', announcements: 'පන්ති දැනුම්දීම',
    creditsLine: 'නිර්මාණය: Hansana · අදහස: Ayya01 (Lesandu) · භාරකාර කථිකාචාර්ය: Ms. Sumodya Sewmini',
    creditsPill: 'CREDITS GOES TO Hansana',
    btnPrev: '⏮ පෙර', btnPlayPause: 'අසන්න / නවතන්න', btnNext: 'ඊළඟ වචනය', btnRepeat: 'නැවත අසන්න',
    btnHint: 'ඉඟියක්', btnModeSwitch: 'පොතේ / ටයිප් මාරුව', btnFinish: 'අවසන් කර පිළිතුරු බලන්න',
    readyBeat: 'සූදානම්', listeningBeat: 'අසන්න', writeNowBeat: 'දැන් ලියන්න', pausedBeat: 'තාවකාලිකව නවතා ඇත',
    finishedBeat: 'අවසන් — පිළිතුරු පරීක්ෂා කරන්න', repeatWord: 'වාරය', remainingWord: 'ඉතිරි',
    noWords: 'වචන තවම පූරණය වී නැත', hintPos: 'වචන වර්ගය', hintFirst: 'පළමු අක්ෂරය', hintSi: 'සිංහල තේරුම',
    hintSentence: 'උදාහරණ වාක්‍යය', playAudio: 'හඬ වාදනය',
    resultsTitle: 'ස්වයං පරීක්ෂාව සහ ප්‍රතිඵල', colYourWord: 'ඔබ ලියූ වචනය', colCorrectWord: 'නිවැරදි වචනය', colMark: 'ලකුණු කිරීම',
    markCorrect: 'නිවැරදි', markMissed: 'වැරදි', markAll: 'සියල්ල නිවැරදි ලෙස ලකුණු කරන්න', toggleMissed: 'වැරදි මාරු කරන්න',
    btnRetryMissed: 'වැරදුණු වචන පමණක් නැවත ලියන්න', btnNewSession: 'නව වාරයක් අරඹන්න',
    filterAll: 'සියල්ල 30', searchWords: 'වචන සොයන්න', noWordsFound: 'වචන හමු නොවීය',
    tapToFlip: 'තේරුම බැලීමට කාඩ්පත ස්පර්ශ කරන්න', nextCard: 'ඊළඟ', prevCard: 'පෙර',
    chooseMeaning: 'නිවැරදි තේරුම තෝරන්න', listenAndChoose: 'අසා නිවැරදි වචනය තෝරන්න',
    weakWordsOnly: 'දුර්වල වචන පමණක්', correctPick: 'නිවැරදි!', wrongPick: 'වැරදි',
    setPacing: '1 · ඩික්ටේෂන් වේගය සහ ආකාරය', modeLabel: 'ආකාරය', writeTime: 'ලිවීමට කාලය', repeats: 'වචන පුනරාවර්තන',
    pauseBetween: 'පුනරාවර්තන අතර විරාමය', autoAdvance: 'ස්වයංක්‍රීයව ඉදිරියට යන්න',
    setAudio: '2 · හඬ සහ උච්චාරණය', voiceSource: 'හඬ මූලාශ්‍රය', voiceAuto: 'ස්වයංක්‍රීය (හොඳම බ්‍රිතාන්‍ය හඬ)',
    voiceLecturer: 'කථිකාචාර්ය පටිගත කිරීම්', voiceAlice: 'Alice (ElevenLabs UK)', voiceDevice: 'උපාංගයේ හඬ',
    rate: 'කථන වේගය', volume: 'හඬ පරිමාව', testVoice: 'හඬ පරීක්ෂා කරන්න',
    setLangTheme: '3 · භාෂාව සහ පෙනුම', language: 'භාෂාව', theme: 'තේමාව',
    themeDark: 'අඳුරු', themeLight: 'දීප්ත', langEnglish: 'English', langSinhala: 'සිංහල',
    aboutTitle: '5 · මෙම යෙදුම ගැන',
    aboutBlurb: 'එක් පන්තියක් සඳහා නොමිලේ සකසන ලද, අන්තර්ජාලය නොමැතිව ද ක්‍රියා කරන අක්ෂර වින්‍යාස පුහුණු යෙදුමක් — ගිණුම් නැත, දැන්වීම් නැත, ලුහුබැඳීම් නැත.',
    aboutAudience: 'කොළඹ විශ්ව විද්‍යාලයීය ව්‍යාප්ත අධ්‍යයන මධ්‍යස්ථානය — ගාල්ල ශාඛාවේ B1 ඉංග්‍රීසි පන්තිය සඳහා.',
    aboutVersionLabel: 'අනුවාදය', aboutBuiltLabel: 'නිර්මිත දිනය',
    aboutDataLink: 'මෙම යෙදුම සුරකින සෑම දත්තයක්ම බලන්න',
    emptyBank: 'තවම වචන ලැයිස්තුවක් නොමැත. එක් වරක් අන්තර්ජාලයට සම්බන්ධ වී, සැකසුම් තුළ "Check for session update" ඔබන්න.',
    setProgress: '4 · ප්‍රගතිය සහ නොබැඳි ගබඩාව', exportBackup: 'උපස්ථයක් අපනයනය', importBackup: 'උපස්ථයක් ආනයනය',
    resetStats: 'දේශීය සංඛ්‍යාලේඛන මකන්න', checkUpdate: 'වාර යාවත්කාලීනය පරීක්ෂා කරන්න',
    studioTitle: '6 · කථිකාචාර්ය ස්ටුඩියෝ සහ පරිපාලන බඳුන', studioLocked: 'ස්ටුඩියෝ විවෘත කිරීමට කථිකාචාර්ය PIN ඇතුළත් කරන්න.',
    studioChangePin: 'PIN වෙනස් කරන්ඕ.',
    /* Table B additions — Sinhala UI labels, badges, presets and studio controls */
    dictSearchPh: 'වචන 30 සොයන්න (ඉංග්‍රීසි, සිංහල, උච්චාරණය)...',
    syncBadgeSynced: 'සමමුහුර්තයි',
    syncShortSyncing: 'සමමුහුර්ත වෙමින්…',
    lecturerSyncBar: ' වර්තමාන වේග සැකසුම් (විභාග 5 තත් · 2×) සියලු පන්ති උපකරණවලට විකාශනය කරන්න',
    lecturerSyncLast: 'පන්තියට සමමුහුර්ත කළ අවසන් වාරය',
    lecturerSyncIdle: 'තවම සමමුහුර්ත නොවීය — Save & Sync එබන්න',
    lecturerSyncedToast: ' ගුරුවරයාගේ නවතම පන්ති සැකසුම් සමමුහුර්ත විය (අනුවාදය #',
    lecturerSyncNoToken: 'පන්තිය සමමුහුර්ත කිරීමට කථිකාචාර්ය ස්ටූඩියෝවේ GitHub ටෝකනය එක් කරන්න',
    guideQuickTitle: 'ක්ෂණික හඬ උපදෙස් — ඩික්ටේෂන් ක්‍රියා කරන ආකාරය',
    guideSkipStart: '⏩ උපදෙස් මඟහැර දැන්ම ආරම්භ කරන්න',
    studioAskLecturer: 'ස්ටූඩියෝ විවෘත කිරීමට ඔබේ කථිකාචාර්යවරයාගෙන් විමසන්න.',
    studioPinMismatch: 'PIN දෙක නොගැළපේ — එකම ඉලක්කම් 4–8 දෙවරක් ලියන්න.',
    invertMarks: 'ලකුණු මාරු කරන්න (දෙවරක් ස්පර්ශ කරන්න)',
    invertConfirmToast: 'තහවුරු කිරීමට තත්පර 3ක් ඇතුළත නැවත ස්පර්ශ කරන්න',
    syncBadgeOffline: 'අන්තර්ජාලය නැත — සුරැකි වාරය පෙන්වයි',
    syncBadgeUpdate: 'නව යාවත්කාලීනයක් ඇත — නැවත පූරණයට ඔබන්න',
    syncBadgeRetry: 'පරීක්ෂාව අසාර්ථකයි — නැවත උත්සාහ කරන්න',
    guideReplay: ' පියවරෙන් පියවර හඬ උපදෙස් නැවත අසන්න',
    guideAutoPlay: 'ආරම්භයේදී ඉංග්‍රීසි හඬ උපදෙස් ස්වයංක්‍රීයව වාදනය කරන්න',
    presetHeading: 'ඉක්මන් කාල සැකසුම් (Presets)',
    presetBeginner: ' ආරම්භක මන්දගාමී (තත් 12 · 4×)',
    presetStandard: ' CCBE B1 සාමාන්‍ය (තත් 8 · 3×)',
    presetExam: ' විභාග වේගවත් (තත් 5 · 2×)',
    presetBoard: ' ස්මාර්ට් බෝඩ් පන්ති ප්‍රකාරය',
    themeBoard: 'ස්මාර්ට් බෝඩ් අධි-පැහැදිලි තේමාව',
    voiceLockLabel: 'හඬ අගුල (Voice Lock)',
    voiceLockUnified: 'බ්‍රිතාන්‍ය කාන්තා කථිකාචාර්ය හඬ (ඒකාබදද්ධ 25–35 UK)',
    voiceLockCustom: 'තෝරාගත් හඬ මූලාශ්‍රය අනුව',
    downloadClips: ' අන්තර්ජාලය නොමැතිව භාවිතයට වචන 30 හඬපට බාගන්න',
    downloadClipsDone: 'වචන 30න් 30ම නොබැඳි භාවිතයට සුරැකිණි',
    studioFirstTime: 'පළමු වරට ස්ටුඩියෝ පිහිටුවීම: ඉලක්කම් 4–8 කථිකාචාර්ය PIN අංකය සහ API යතුරු ඇතුළත් කරන්න',
    studioTestEl: 'ElevenLabs යතුර පරීක්ෂා කරන්න',
    studioTestGh: 'GitHub යතුර පරීක්ෂා කරන්න',
    studioShow: 'පෙන්වන්න',
    studioHide: 'සඟවන්න',
    studioPaste: 'අලවන්න',
    pinPadClear: 'මකන්න',
    pinPadUnlock: 'විවෘත කරන්න',
    studioCommitClip: 'පටිගත කළ හඬපටය සුරකින්න',
    toastLoaded: 'පූරණය විය', toastOffline: 'නොබැඳිව සූදානම්',
    updateChecking: 'නව වාරයක් පරීක්ෂා කරමින්…', updateNone: 'ඔබ සතුව නවතම වාරය දැනටමත් ඇත',
    updateFound: 'නව වාරය බාගත විය', resetDone: 'දේශීය සංඛ්‍යාලේඛන මකා දමන ලදී', exportReady: 'උපස්ථය බාගත විය',
    importOk: 'උපස්ථය ප්‍රතිසාධනය විය', importBad: 'එම උපස්ථ ගොනුව කියවිය නොහැක',
    presetApplied: 'සැකසුම යොදවීමට පවතී',
    storageLine: 'මෙම උපාංගයේ ගබඩා කර ඇත', resumeAt: 'මෙම වචනයෙන් දිගටම කරගෙන යන්න',
    voiceTest: 'හඬ පරීක්ෂණය', playWordAudio: 'වාදනය', listen: 'අසන්න',
    studioPinLabel: 'කථිකාචාර්ය PIN', studioUnlock: 'ස්ටුඩියෝ විවෘත කරන්න', studioSetup: 'බඳුන සාදන්න',
    studioSetupHint: 'පළමු වතාවද? සංකේතිත බඳුන සෑදීමට PIN එකක් තෝරන්න.',
    studioLockedOut: 'වැරදි PIN ගණන වැඩිය. නැවත උත්සාහ කරන්න', seconds: 'තත්පර',
    studioBadPin: 'වැරදි PIN', studioEditor: 'වාරයේ වචන (පේළියකට එකක්: w | ipa | pos | meaning | sinhala | sentence)',
    studioPreview: 'ප්‍රකාශන පෙරදසුන', studioPublish: 'වාරය ප්‍රකාශයට පත් කරන්න', studioGenerate: 'Alice හඬ පටි සාදන්න',
    studioRecord: 'වචනය පටිගත කරන්න', studioSave: 'පියවර 1: යතුරු ස්ථිරවම සුරකින්න (දේශීය බඳුන + GitHub සමමුහුර්තය)', studioLock: 'ස්ටුඩියෝ අගුළු දමන්න',
    studioEnvelope: 'සංකේතිත බඳුන ලියුම (SDP_ENC_V2)', studioCopy: 'ලියුම පිටපත් කරන්න',
    studioPublishOk: 'වාරය ප්‍රකාශයට පත් විය', studioPublishFail: 'ප්‍රකාශනය අසාර්ථක විය',
    studioNoToken: 'පළමුව බඳුනට GitHub ටෝකනයක් එක් කරන්න', studioWordsCount: 'වචන විග්‍රහ කර ඇත',
    studioElevenNote: 'ElevenLabs ජනනය සිදු වන්නේ අගුළු හැර ඇති විට පමණක්, Charlotte හඬ සහ flash_v2_5 සමඟය.',
    /* ── v0.0.1.c Table B (සිංහල) ── */
    guideTapToStart: ' හඬ උපදෙස් ආරම්භ කිරීමට ඕනෑම තැනක ස්පර්ශ කරන්න',
    homeJourney1: 'අසා ලියන්න',
    homeJourney2: 'වචන 30 පරීක්ෂා කරන්න',
    homeJourney3: 'දුර්වල වචන පුහුණු වන්න',
    homeReadyBadge: '8 වන වාරය සූදානම් · වචන 30',
    modePaperFull: ' අභ්‍යාස පොතේ ලිවීම (Paper)',
    modeTypingFull: '⌨ තිරයේ ටයිප් කිරීම (Typing)',
    voiceGuideBtn: ' අන්තර්ක්‍රියාකාරී හඬ උපදෙස්',
    boardShowWord: ' පුවරුවේ වචනය පෙන්වන්න',
    boardHideWord: ' පුවරුවේ වචනය සඟවන්න',
    quotaHeading: 'ElevenLabs අක්ෂර සීමාව (ගාස්තු රහිත පරීක්ෂාව)',
    costPreviewLabel: 'ඇස්තමේන්තුගත අක්ෂර වැයවීම',
    testOneWordBtn: ' එක් වචනයක් පරීක්ෂා කරන්න (~අක්ෂර 8)',
    forceRegenLabel: 'දැනට පවතින හඬපට නැවත උත්පාදනය කරන්න',
    genDeltaBtn: ' ඉතිරි හඬපට පමණක් සාදන්න (Credit-Saver)',
    teacherUpdatedToast: 'ගුරුවරයා පන්තියේ සැකසුම් යාවත්කාලීන කරන ලදී',
    vaultSavedToast: 'ආරක්ෂිත යතුරු සුරැකිණි · GitHub වෙත සමමුහුර්ත විය',
    guideVoiceFailed: 'හඬ උපදෙස් නොමැත — නැවත උත්සාහ කිරීමට ස්පර්ශ කරන්න',
    boardPlayPause: '▶ වාදනය / නවතන්න',
    boardRepeat: ' නැවත අසන්න',
    boardNext: '⏭ ඊළඟ',
    boardJumpLabel: 'වචනයට යන්න',
    syncShortSynced: 'සමමුහුර්තයි ',
    syncShortOffline: 'නොබැඳි',
    syncShortUpdate: 'යාවත්කාලීන',
    syncShortRetry: 'නැවත',
    homeJourneyTitle: 'අද ඔබේ පියවර 3',
    settingsSyncLabel: 'සමමුහුර්තය',
    settingsUpdateLabel: 'යාවත්කාලීනය',
    guiding: 'උපදෙස්',
    /* v0.0.1.f additions (D9, D13, D14, D17, D18) */
    resumePaused: 'නැවැත්වූ ඩික්ටේෂන් දිගටම කරගෙන යන්න',
    homePresetBadge: 'වේගවත් විභාග අඩවිය · තත්පර 5 · 2 වාරය · බ්‍රිතාන්‍ය ඉංග්‍රීසි',
    repeatBadge: 'වාරය',
    pausedBanner: 'තාවකාලිකව නවතා ඇත — දිගටම කරගෙන යාමට ස්පර්ශ කරන්න',
    btnResumeDictation: 'ඩික්ටේෂන් දිගටම කරගෙන යන්න',
    pauseReasonNavigation: 'ඔබ තිරය මාරු කළා',
    pauseReasonModal: 'කවුළුවක් විවෘත විය',
    pauseReasonVisibility: 'යෙදුම පසුගිය තලයට ගියා',
    pauseReasonUser: 'ඔබ නැවැත්වීමට ස්පර්ශ කළා',
    guideAutoplayBanner: ' හඬ උපදෙස් ආරම්භ කිරීමට ඕනෑම තැනක ස්පර්ශ කරන්න',
    studioCardKeys: 'පියවර 1 — API යතුරු සහ හඬපට 34 පැකේජය',
    studioCardWords: 'පියවර 2 — වචන 30 සංස්කාරකය සහ නොමිලේ AI ස්වයං පිරවීම',
    studioCardSettings: 'පියවර 3 — පන්ති සැකසුම් විකාශනය සහ PIN ආරක්ෂාව',
    studioLockLecturer: 'කථිකාචාර්ය ප්‍රකාරය අගුළු දමන්න',
    studioAiProvider: 'නොමිලේ AI / ශබ්දකෝෂ එන්ජිම',
    studioAiKey: 'නොමිලේ AI යතුර (අවශ්‍ය නැත)',
    studioTestAi: 'නොමිලේ AI / ශබ්දකෝෂ එන්ජිම පරීක්ෂා කරන්න',
    studioAiNoKey: '1: ඉදිකළ නොමිලේ Oxford/Wikimedia ශබ්දකෝෂය සහ සිංහල පරිවර්තකය (100% නොමිලේ — යතුරක් අවශ්‍ය නැත)',
    studioOneClick: ' බ්‍රිතාන්‍ය මහාචාර්ය හඬ 70 සාදා සියලු උපාංග සමමුහුර්ත කරන්න',
    studioBulkWords: 'වචන 30 දක්වා අලවන්න හෝ ලියන්න (එක් පේළියකට එකක් හෝ කොමාවෙන් වෙන් කර)',
    studioEnrich: 'IPA, ඉංග්‍රීසි සහ සිංහල අර්ථ ස්වයංක්‍රීයව පුරවන්න (නොමිලේ AI / ශබ්දකෝෂය)',
    studioWordManager: 'වචන කළමනාකරු — # · w · p · pos · m · si · s',
    studioPublishWordsVoice: ' හඬ සාදා වචන 30 සියලු උපාංග වෙත පළ කරන්න',
    studioSyncSettings: ' පන්ති සැකසුම් සියලු උපාංග වෙත සුරකා සමමුහුර්ත කරන්න',
    studioMasterSteps: 'සැකසුම් ප්‍රගතිය',
    studioEnriching: 'පුරවමින්',
    studioEnriched: 'පුරවා අවසන්',
    studioAiOffline: 'නොබැඳි B1 ශබ්දකෝෂය භාවිතා විය',
    /* ── v0.0.1.h (D2, D6, D7, D10, D13, D14) ── */
    vaultBadgeLabel: 'යතුරු බඳුන සුරකින ලදී · යාවත්කාලීනවලින් ආරක්ෂිතයි',
    studioFreeNoKey: '100% නොමිලේ — API යතුරක් අවශ්‍ය නැත!',
    studioQuotaScoped: 'යතුර පිළිගැනිණි (scoped/නොමිලේ මට්ටමේ යතුර — සීමා කියවීම මඟ හැරිණි)',
    studioElTierWarn: 'ElevenLabs නොමිලේ සීමාව අවසන් — ඉතිරි වචන සඳහා ඉදිකළ නොමිලේ බ්‍රිතාන්‍ය කාන්තා මහාචාර්ය හඬ භාවිතා වේ',
    studioSavedLocal: 'දේශීය බඳුනේ සුරකින ලදී (යාවත්කාලීනවලින් ආරක්ෂිතයි)',
    studioAiSlotPollinations: '2: Pollinations නොමිලේ විවෘත මූලාශ්‍ර AI (Llama/Mistral — 100% නොමිලේ, යතුරක් අවශ්‍ය නැත!)',
    studioAiSlotGroq: '3: Groq Cloud නොමිලේ මට්ටම · Llama-3.3-70B (gsk_… — නොමිලේ, කාඩ්පතක් අවශ්‍ය නැත)',
    studioAiSlotOpenrouter: '4: OpenRouter නොමිලේ ආකෘති · Llama-3.3-70B:free (sk-or-… — නොමිලේ මට්ටම)',
    studioAiSlotGemini: '5: Google Gemini නොමිලේ මට්ටම · gemini-2.5-flash (AIza… — අමතර)',
    studioWorking: 'ක්‍රියාත්මක වෙමින්…',
    studioClear: 'හිස් කරන්න',
    studioRestored: 'මෙම ටැබයෙන් ස්ටූඩියෝව නැවත ලබා ගන්නා ලදි',
    studioNoVaultWarn: 'තවම බඳුනක් සකසා නැත — යතුරු නොමැතිව වචන ප්‍රකාශ වේ',
    studioAiOfflineFallback: 'AI අක්‍රියයි — නොමිලේ ශබ්දකෝෂය භාවිතා විය',
    /* ── v0.0.2.a (සිංහල) ── */
    tabStudio: 'කථිකාචාර්ය',
    homeStep1Tag: 'පියවර 1', homeStep2Tag: 'පියවර 2', homeStep3Tag: 'පියවර 3',
    homeWordsTitle: 'වචන 30 ම #1–#30 අනුපිළිවෙලින් පරීක්ෂා කර අධ්‍යයනය කරන්න',
    homeWordsSub: 'සෑම වචනයක්ම පන්ති අනුපිළිවෙලින්, බ්‍රිතාන්‍ය උච්චාරණය, සිංහල තේරුම සහ උදාහරණ වාක්‍යය සමඟ.',
    homeWordsBtn: ' වචන 30 ලැයිස්තුව විවෘත කරන්න (#1–#30)',
    resumeMetaIdle: 'වචන #1 දී නවතා ඇත (වචන 30 න්)',
    startOver: '↺ වචන #1 සිට නැවත අරඹන්න',
    cueStep1: 'පියවර 1 — මෙතැන ඔබන්න',
    cuePlayer: 'මෙතැනින් නවතන්න හෝ දිගටම යන්න',
    cueDict: 'අසන්න වචනයක් ඔබන්න',
    cueStudio: 'ඔබේ PIN ඇතුළත් කරන්න',
    settingsLecturerActive: ' කථිකාචාර්ය ප්‍රකාරය සක්‍රීයයි — සැකසුම් විකාශනයට හෝ වචන 30 සංස්කරණයට කථිකාචාර්ය ස්ටූඩියෝව විවෘත කරන්න',
    openStudioBtn: ' කථිකාචාර්ය ස්ටූඩියෝව විවෘත කරන්න',
    studioScreenTitle: ' කථිකාචාර්ය පරිපාලන ස්ටූඩියෝව',
    studioScreenSub: 'අංකිත පියවර තුනක්: යතුරු සහ හඬපට 34 පැකේජය, වචන 30 සංස්කාරකය, සහ පන්ති සැකසුම් විකාශනය.',
    lecturerAdminLocked: ' කථිකාචාර්ය පරිපාලනය', lecturerAdminUnlocked: ' කථිකාචාර්ය පරිපාලනය',
    btnReplay: ' වචනය නැවත අසන්න',
    btnPauseDictation: '⏸ ඩික්ටේෂන් නවතන්න',
    btnResumeWord: '▶ වචන # ට දිගටම යන්න',
    btnPrevNum: '⏮ පෙර (#', btnNextNum: '⏭ ඊළඟ (#',
    listenCarefully: 'හොඳින් අසන්න (වාරය ', writeInBook: 'වචන #',
    inYourBook: ' ඔබේ පොතේ ලියන්න! (', countdownTail: ' තත්පර ගණන්)',
    pausedAtWord: 'වචන #', pausedResumeTail: ' දී ඩික්ටේෂන් නවතා ඇත — පහතින් දිගටම යන්න ඔබන්න',
    resumeMetaLine: 'වචන # දී නවතා ඇත · ඉතිරි ', ofWord: ' / 30 · වාරය ', secondsLeft: ' තත්පර',
    progressWord: 'වචන #', progressOf: ' / 30',
    progressWordUpper: 'වචන #', progressOf30: ' / 30', repeatOf: ' න් ', writeSecsBadge: 'තත් ලියන්න',
    capPrev: 'පෙර', capPlay: 'නවත්වන්න', capReplay: 'නැවත', capNext: 'ඊළඟ',
    capRepeat: 'පුනරාවර්තනය', capHint: 'ඉඟිය', capMode: 'ක්‍රමය', capFinish: 'පරීක්ෂාව',
    pillsDrawer: 'වචන 1–30 වෙත යන්න ▾',
    markCorrectWord: ' නිවැරදි', markWeakWord: ' පුහුණුව අවශ්‍යයි', btnStartDictation: '▶ ඩික්ටේෂන් අරඹන්න',
    studioRetryNone: 'නැවත උත්සාහ කිරීමට අසාර්ථක ක්ලිපයක් නැත — සියලු ක්ලිප සුරකිනු ලැබීය.',
    studioRetryOne: '↻ අසාර්ථක වූ ක්ලිපය පමණක් නැවත උත්සාහ කරන්න',
    studioStep1Head: 'පියවර 1 — API යතුරු සහ හඬපට 34 උත්පාදකය',
    studioStep2Head: 'පියවර 2 — වචන 30 සංස්කාරකය සහ නොමිලේ AI ස්වයං පිරවීම',
    studioStep3Head: 'පියවර 3 — පන්ති සැකසුම් විකාශනය සහ PIN ආරක්ෂාව',
    studioPackVault: 'බඳුන: සුරකින ලදී ', studioPackGithub: 'GitHub: සම්බන්ධයි ', studioPackClips: 'හඬ පැකේජය: ',
    studioClipsUnit: '/හඬපට 70', studioGenPrefix: 'හඬපට සාදමින් ',
    studioGenCharsTail: ' අක්ෂර භාවිතය', studioClipsSaved: '/හඬපට 34 GitHub වෙත සුරකින ලදී · syncRev ',
    studioRetryFailed: ' ඉතිරි හඬපට පමණක් නැවත උත්සාහ කරන්න',
    studioOneClick34: ' බ්‍රිතාන්‍ය මහාචාර්ය හඬ 70 සාදා සියලු උපාංග සමමුහුර්ත කරන්න',
    studioSaveOnly: ' යතුරු බඳුනේ පමණක් සුරකින්න',
    studioPublishWordsVoice34: ' හඬ සාදා වචන 30 සියලු උපාංග වෙත පළ කරන්න',
    studioBroadcast34: ' වර්තමාන වේග සැකසුම් (විභාග 5 තත් · 2×) සියලු පන්ති උපාංගවලට විකාශනය කරන්න',    guideCard3Tag: '4 න් 3 — වචන #1 සිට #30 දක්වා පිළිවෙලින් පරීක්ෂා කරන්න', guideCard4Tag: '4 න් 4 — ස්වයංක්‍රීය පන්ති සමමුහුර්තය සහ කථිකාචාර්ය පරිපාලනය',
    guideSkipStartNow: '▶ දැන්ම ඩික්ටේෂන් ආරම්භ කරන්න',
    guideSpotlight1: 'ඩික්ටේෂන් ආරම්භ කිරීමට පහළ ඇති ▶ Start Dictation බොත්තම ඔබන්න.',
    guideSpotlight2: 'සෑම වචනයක්ම දෙවරක් අසන්න, පසුව තත්පර පහක් තුළ ලියන්න.',
    guideSpotlight3: 'වාරය අවසන් වූ පසු වචන තිහම පිළිවෙලින් පරීක්ෂා කරන්න.',
    guideSpotlight4: 'ඔබට මඟ හැරුණු වචන නැවත පුහුණු වන්න.',
    guideStepTagPrefix: 'පියවර', guideStepTagSuffix: 'න් 4',
    guideExitBtn: ' ඉවත් වන්න',
    studioSavedOk: ' යතුරු සුරක්ෂිතව තැන්පත් කරන ලදී',
    studioVerifyEl: ' ElevenLabs හඬ යතුර පරීක්ෂා කරන්න',
    studioVerifyOk: 'වලංගුයි  (ඉතිරි නොමිලේ අක්ෂර: ',
    studioVerifyBad: 'වලංගු නොවේ  (HTTP ',
    studioVerifyHint: 'වලංගු නොවේ — ElevenLabs වෙතින් sk_… රහස අලවන්න (e1b… අගය යතුරු හැඳුනුමයි, වැඩ නොකරයි)',
    studioClips70: 'හඬපට 70 = අක්ෂර 829 ≈ මාසික නොමිලේ කෝටාවෙන් 8.3% (flash_v2_5 ≈ ණය 414)',
    studioRecoveryUsed: 'ප්‍රධාන ප්‍රතිසාධනය භාවිතයි — දැන් නව PIN එකක් සකසන්න',
    studioChangePinBtn: ' කථිකාචාර්ය PIN වෙනස් කරන්න',
    studioPublishOkFull: ' සියලුම උපාංග වෙත සාර්ථකව ප්‍රකාශයට පත් කරන ලදී'
  };

  var lang = 'en';
  var theme = 'dark';
  var initialized = false;
  var practice = { mode: 'flash', index: 0, flipped: false, answered: '', score: 0, pool: [] };

  function t(key, fallback) {
    var table = lang === 'si' ? STRINGS_SI : STRINGS_EN;
    var value = table[key];
    if (value === undefined) value = STRINGS_EN[key];
    if (value === undefined) return fallback === undefined ? key : fallback;
    return value;
  }
  function settings() {
    try { return SDP.Data.settings(); } catch (e) { return { mode: 'paper', lang: 'en', theme: 'dark' }; }
  }
  function words() {
    try { return SDP.Sync && SDP.Sync.words ? SDP.Sync.words() : []; } catch (e) { return []; }
  }
  function stats() {
    try { return SDP.Data.stats(); } catch (e) { return { mastered: 0, accuracy: 0, streak: 0 }; }
  }

  /* ══ language / theme  ══ */
  function applyI18n() {
    var nodes = doc.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      if (!key) continue;
      var value = t(key);
      if (value === undefined) continue;
      /* v0.0.4.c (GAP 2): never wipe an SVG icon. A [data-i18n] node with a
         .i18n-label child updates only the label, so EN <-> SI keeps its icon. */
      var label = nodes[i].querySelector ? nodes[i].querySelector('.i18n-label') : null;
      if (label) { label.textContent = value; continue; }
      if (nodes[i].querySelector && nodes[i].querySelector('svg.sdp-icon')) continue;
      nodes[i].textContent = value;
    }
    var placeholders = doc.querySelectorAll('[data-i18n-placeholder]');
    for (var j = 0; j < placeholders.length; j++) {
      var pkey = placeholders[j].getAttribute('data-i18n-placeholder');
      if (!pkey) continue;
      var pvalue = t(pkey);
      if (pvalue !== undefined) placeholders[j].placeholder = pvalue;
    }
  }
  function paintLangPills() {
    var pills = [byId('btnLang'), byId('guideLangPill')];
    for (var i = 0; i < pills.length; i++) {
      var pill = pills[i];
      if (!pill) continue;
      var onEl = pill.querySelector ? pill.querySelector('.lang-on') : null;
      var offEl = pill.querySelector ? pill.querySelector('.lang-off') : null;
      if (onEl) onEl.style.opacity = lang === 'en' ? '1' : '0.45';
      if (offEl) offEl.style.opacity = lang === 'si' ? '1' : '0.45';
      pill.setAttribute('aria-label', lang === 'en' ? 'Switch to Sinhala' : 'Switch to English');
    }
  }

  function applyLang(next, quiet) {
    lang = next === 'si' ? 'si' : 'en';
    if (doc && doc.documentElement) doc.documentElement.setAttribute('lang', lang === 'si' ? 'si' : 'en');
    if (doc && doc.body) doc.body.setAttribute('data-lang', lang);
    if (!quiet) { try { SDP.Data.saveSettings({ lang: lang }); } catch (e) {} }
    applyI18n();
    paintIconHosts();
    paintLangPills();
    var select = byId('setLang');
    if (select) select.value = lang;
    renderHome();
    renderWords();
    renderPractice();
    renderGuideSteps();
    renderSettings();
    if (SDP.Engine) {
      if (SDP.Engine.repaintState) { try { SDP.Engine.repaintState(); } catch (e) {} }
      if (SDP.Engine.renderResults && SDP.Engine.state && SDP.Engine.state() === 'finished') {
        try { SDP.Engine.renderResults(); } catch (e) {}
      }
    }
    if (SDP.Studio && SDP.Studio.onLangChange) { try { SDP.Studio.onLangChange(); } catch (e) {} }
    return lang;
  }
  function toggleLang() { return applyLang(lang === 'en' ? 'si' : 'en'); }

  var THEMES = ['dark', 'light', 'board'];
  function normalizeTheme(next) {
    var wanted = str(next).toLowerCase();
    return THEMES.indexOf(wanted) >= 0 ? wanted : 'dark';
  }
  /* D-UI2: 'board' must survive normalizeTheme. */
  function applyTheme(next, quiet) {
    theme = normalizeTheme(next);
    if (doc && doc.documentElement) doc.documentElement.setAttribute('data-theme', theme);
    if (doc && doc.body) doc.body.setAttribute('data-theme', theme);
    var meta = doc.querySelector ? doc.querySelector('meta[name="theme-color"]') : null;
    if (meta) meta.setAttribute('content', theme === 'light' ? '#FFFFFF' : (theme === 'board' ? '#000000' : '#09090B'));
    if (!quiet) { try { SDP.Data.saveSettings({ theme: theme, touchedKeys: touchedPatch('theme') }); } catch (e) {} }
    var select = byId('setTheme');
    if (select) select.value = theme;
    var icon = byId('themeIcon');
    if (icon) {
      icon.innerHTML = svgIcon(theme === 'light' ? 'sun' : (theme === 'board' ? 'target' : 'moon'), 20);
      icon.setAttribute('data-icon', theme === 'light' ? 'sun' : (theme === 'board' ? 'target' : 'moon'));
    }
    /* R7 / H5: Smart Board shows a clean quick-word jumper in the cockpit header. */
    var jumper = byId('quickJumper');
    if (jumper) {
      if (theme === 'board') { jumper.hidden = false; renderQuickJumper(); }
      else jumper.hidden = true;
    }
    renderBoardBar();
    return theme;
  }
  /* ENG-05/R1: the ten classroom keys; personal keys are never marked touched. */
  var CLASS_SETTING_KEYS = [
    'mode', 'writeSecs', 'repeats', 'pauseSecs', 'autoAdvance',
    'pacingPreset', 'voiceLock', 'voiceSource', 'rate', 'theme'
  ];
  /* R7: remember that this student changed a setting by hand. */
  function touchedPatch(key) {
    var out = {};
    if (!key) return out;
    var current = {};
    try { current = settings().touchedKeys || {}; } catch (e) { current = {}; }
    for (var k in current) if (Object.prototype.hasOwnProperty.call(current, k)) out[k] = current[k];
    out[key] = true;
    return out;
  }
  /* ENG-05: ONE writer for classroom keys. */
  function saveTouched(patch, label) {
    var withTouch = {}, k, i;
    var keys = [];
    for (k in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      withTouch[k] = patch[k];
      if (CLASS_SETTING_KEYS.indexOf(k) >= 0) keys.push(k);
    }
    if (keys.length) {
      var merged = {};
      var current = {};
      try { current = settings().touchedKeys || {}; } catch (e) { current = {}; }
      for (k in current) if (Object.prototype.hasOwnProperty.call(current, k)) merged[k] = current[k];
      for (i = 0; i < keys.length; i++) merged[keys[i]] = true;
      withTouch.touchedKeys = merged;
    }
    try { SDP.Data.saveSettings(withTouch); } catch (e) {}
    var node = byId('settingsFeedback');
    if (node) node.textContent = str(label) || '';
    if (label) showToast(str(label));
    return withTouch;
  }
  function toggleTheme() {
    var next = theme === 'dark' ? 'light' : (theme === 'light' ? 'board' : 'dark');
    return applyTheme(next);
  }

  /* ══ router  ══ */
  
  var TABS = ['home', 'player', 'practice', 'dict', 'settings', 'studio'];
  /* R6/D10: leaving the cockpit pauses the live beat; Settings is a modal surface. */
  function pauseForNavigation(target) {
    var engine = SDP.Engine;
    if (!engine || !engine.isActive || !engine.isActive()) return false;
    var reason = target === 'settings' ? 'modal' : 'navigation';
    try { if (engine.pause) engine.pause(reason); } catch (e) {}
    try { if (SDP.Speech && SDP.Speech.stop) SDP.Speech.stop(); } catch (e) {}
    return true;
  }
  function showTab(name) {
    var target = TABS.indexOf(name) >= 0 ? name : 'home';
    var i;
    if (target !== 'player' && target !== 'dict' && target !== 'dictation') pauseForNavigation(target);
    for (i = 0; i < TABS.length; i++) {
      var screen = byId('screen-' + TABS[i]);
      if (!screen) continue;
      if (TABS[i] === target) {
        if (screen.classList) screen.classList.add('active');
        screen.setAttribute('aria-hidden', 'false');
      } else {
        if (screen.classList) screen.classList.remove('active');
        screen.setAttribute('aria-hidden', 'true');
      }
    }
    var tabIds = ['tab-home', 'tab-player', 'tab-practice', 'tab-dict', 'tab-settings', 'tab-studio'];
    for (i = 0; i < tabIds.length; i++) {
      var node = byId(tabIds[i]);
      if (node) node.setAttribute('aria-selected', String(tabIds[i] === 'tab-' + target));
    }
    var rails = doc.querySelectorAll('#sdpSideRail [data-tab]');
    for (i = 0; i < rails.length; i++) rails[i].setAttribute('aria-selected', String(rails[i].getAttribute('data-tab') === target));
    if (target === 'dict') renderWords();
    if (target === 'home') renderHome();
    if (target === 'practice') renderPractice();
    if (target === 'settings') renderSettings();
    /* D6: the router owns mounting the studio screen (gate or 3 cards). */
    if (target === 'studio') {
      try { if (SDP.Studio && SDP.Studio.mount) SDP.Studio.mount(); } catch (e) {}
      try { if (SDP.Studio && SDP.Studio.paintQuickButton) SDP.Studio.paintQuickButton(); } catch (e2) {}
    }
    if (target === 'player') { renderBoardJumper(); }
    renderBoardBar();
    if (target === 'player' && SDP.Engine && SDP.Engine.refreshEls) SDP.Engine.refreshEls();
    return target;
  }
  function currentTab() {
    for (var i = 0; i < TABS.length; i++) {
      var screen = byId('screen-' + TABS[i]);
      if (screen && screen.classList && screen.classList.contains('active')) return TABS[i];
    }
    return 'home';
  }

  /* ══ Home  ══ */
  function renderHome() {
    var s = stats();
    var bank = words().length;
    var total = bank || 30;
    /* An empty bank is a real state (first run offline): say so. */
    var empty = byId('bankEmpty');
    if (empty) empty.hidden = bank > 0;
    var start = byId('btnStart');
    if (start) {
      start.disabled = bank === 0;
      if (bank === 0) start.setAttribute('aria-disabled', 'true');
      else start.removeAttribute('aria-disabled');
    }
    setText(byId('statMastered'), bank ? s.mastered + ' / ' + total : '—');
    setText(byId('statAccuracy'), s.accuracy + '%');
    setText(byId('statStreak'), String(s.streak));
    var line = doc.querySelector ? doc.querySelector('#creditFoot .credit-line') : null;
    if (line) setText(line, t('creditsLine'));
    var pill = doc.querySelector ? doc.querySelector('#creditFoot .credits-pill') : null;
    if (pill) setText(pill, 'CREDITS GOES TO Hansana');
    paintCredits();
    paintReadiness(bank);
    /* D13/D15: giant resume card — word, repeat, seconds, resume or restart. */
    var banner = byId('resumeBanner');
    var draft = null;
    try { draft = SDP.Data.session(); } catch (e) {}
    var enginePaused = false;
    try { enginePaused = !!(SDP.Engine && SDP.Engine.isPaused && SDP.Engine.isPaused()); } catch (e) { enginePaused = false; }
    var draftPaused = !!(draft && str(draft.status) === 'paused');
    var hasAnswers = !!(draft && draft.answers && Object.keys(draft.answers).length > 0);
    var resumable = !!(draft && typeof draft.index === 'number' && (draftPaused || hasAnswers)) || enginePaused;
    var cfg = {};
    try { cfg = SDP.Engine && SDP.Engine.config ? (SDP.Engine.config() || {}) : {}; } catch (e) { cfg = {}; }
    var draftIndex = enginePaused ? Number(cfg.index || 0) : (draft && typeof draft.index === 'number' ? draft.index : 0);
    var bankCount = bank || 30;
    var repeatsTotal = Math.max(1, Number(cfg.repeats || (draft && draft.repeats) || (settings().repeats) || 2));
    var repeatsDone = Math.max(0, Number(enginePaused ? cfg.repeatsDone : (draft && draft.repeatsDone) || 0));
    var repeatsShown = Math.min(repeatsTotal, repeatsDone + 1);
    var remainingMs = Math.max(0, Number(enginePaused ? cfg.remainingMs : (draft && draft.remainingMs) || 0));
    var secondsLeft = (Math.ceil(remainingMs / 100) / 10).toFixed(1);
    if (banner) {
      banner.hidden = !resumable;
      if (resumable) {
        banner.setAttribute('data-state', (enginePaused || draftPaused) ? 'paused' : 'draft');
        setText(byId('resumeText'), '⏸ ' + t('resumeMetaLine') + (draftIndex + 1) + t('ofWord') +
          repeatsShown + ' of ' + repeatsTotal + ' · ' + secondsLeft + t('secondsLeft'));
        setText(byId('resumeMeta'), resumable ? t('resumePaused') : t('resumeMetaIdle'));
      }
    }
    var resumeBtn = byId('btnResume');
    if (resumeBtn) setText(resumeBtn, t('resumeSession'));
    if (resumeBtn) resumeBtn.hidden = !!(enginePaused || draftPaused);
    var resumeDraftBtn = byId('btnResumeDraft');
    if (resumeDraftBtn) {
      resumeDraftBtn.hidden = !(enginePaused || draftPaused);
      setText(resumeDraftBtn, t('btnResumeWord') + (draftIndex + 1));
    }
    var startOverBtn = byId('btnStartOver');
    if (startOverBtn) setText(startOverBtn, t('startOver'));
    paintHomeWordsPreview();
    paintPresetBadge();
    paintCues();
    var ann = byId('homeAnn');
    var announcement = null;
    try { announcement = SDP.Sync && SDP.Sync.announcement ? SDP.Sync.announcement() : null; } catch (e) {}
    var annText = isObj(announcement) ? str(announcement.text || announcement.title) : str(announcement);
    if (ann) ann.hidden = !annText;
    setText(byId('homeAnnText'), annText);
    paintModePills();
  }
  /* D15: Home Step-2 previews #01..#03 in strict class order. */
  function paintHomeWordsPreview() {
    var host = byId('homeWordsPreview');
    if (!host) return false;
    var list = words();
    var html = '', i, n = Math.min(3, list.length);
    for (i = 0; i < n; i++) {
      var w = list[i] || {};
      html += '<div class="hp-row"><span class="hp-num">#' + pad2(i + 1) + '</span>' +
        '<span class="hp-w">' + esc(w.w) + '</span>' +
        '<span class="hp-si word-si">' + esc(w.si) + '</span></div>';
    }
    host.innerHTML = html;
    return true;
  }

  /* D9: the amber STEP cue retires per screen via sdp.settings.cuesSeen. */
  function cuesSeen() {
    var conf = settings();
    return isObj(conf.cuesSeen) ? conf.cuesSeen : {};
  }
  function paintCues() {
    if (!doc || !doc.querySelectorAll) return false;
    var seen = cuesSeen();
    var nodes = doc.querySelectorAll('.cue[data-cue]');
    for (var i = 0; i < nodes.length; i++) {
      var screen = str(nodes[i].getAttribute('data-cue'));
      nodes[i].hidden = seen[screen] === true;
    }
    return true;
  }
  function markCueSeen(screen) {
    var key = str(screen) || 'home';
    var seen = cuesSeen();
    if (seen[key] === true) return false;
    seen[key] = true;
    try { SDP.Data.saveSettings({ cuesSeen: seen }); } catch (e) {}
    paintCues();
    return true;
  }

  /* R1: all three credit lines stay verbatim, but only the active language is… */
  function paintCredits() {
    if (!doc || !doc.querySelectorAll) return false;
    var enText = lang === 'si' ? '' : STRINGS_EN.creditsLine;
    var siText = lang === 'si' ? STRINGS_SI.creditsLine : '';
    var enNodes = doc.querySelectorAll('.credit-line:not(.credit-line-si)');
    var siNodes = doc.querySelectorAll('.credit-line-si');
    var i;
    for (i = 0; i < enNodes.length; i++) setText(enNodes[i], enText);
    for (i = 0; i < siNodes.length; i++) setText(siNodes[i], siText);
    return true;
  }

  /* P5: "Session 8 ready · 30 words" — the student knows the bank is loaded… */
  function paintReadiness(bank) {
    var badge = byId('homeReadyBadge');
    if (!badge) return false;
    var count = Number(bank);
    if (isNaN(count)) count = boardWordCount();
    var sessionNo = '8';
    try { sessionNo = str(SDP.Sync && SDP.Sync.sessionNo ? SDP.Sync.sessionNo() : '8'); } catch (e) { sessionNo = '8'; }
    var label = t('homeReadyBadge')
      .replace('Session 8', 'Session ' + sessionNo)
      .replace('8 වන වාරය', sessionNo + ' වන වාරය')
      .replace('30 words', count + ' words')
      .replace('වචන 30', 'වචන ' + count);
    badge.textContent = label;
    badge.setAttribute('data-ready', count > 0 ? 'true' : 'false');
    return true;
  }
  /* D17: show the published preset on Home (Fast Exam · 5s · 2× · British). */
  function presetLabel(conf) {
    var s = isObj(conf) ? conf : settings();
    var preset = str(s.pacingPreset || 'exam');
    var secs = Number(s.writeSecs || s.intervalSec) || 5;
    var repeats = Math.min(5, Math.max(1, Number(s.repeats) || 2));
    var name = preset === 'beginner' ? 'Beginner Slow'
      : (preset === 'board' ? 'Smart Board Class' : (preset === 'standard' ? 'CCBE B1 Standard' : 'Fast Exam'));
    return name + ' · ' + secs + 's · ' + repeats + '× · British English';
  }
  function paintPresetBadge() {
    var badge = byId('homePresetBadge');
    if (!badge) return false;
    badge.textContent = presetLabel(settings());
    badge.setAttribute('data-preset', str(settings().pacingPreset || 'exam'));
    return true;
  }
  function paintModePills() {
    var mode = settings().mode === 'typing' ? 'typing' : 'paper';
    var pills = doc.querySelectorAll('#homeModePills [data-mode]');
    for (var i = 0; i < pills.length; i++) pills[i].setAttribute('aria-pressed', String(pills[i].getAttribute('data-mode') === mode));
    var segPaper = byId('setModePaper');
    var segTyping = byId('setModeTyping');
    if (segPaper) segPaper.setAttribute('aria-pressed', String(mode === 'paper'));
    if (segTyping) segTyping.setAttribute('aria-pressed', String(mode === 'typing'));
  }
  function applyModePills(mode) {
    var pills = doc.querySelectorAll('#homeModePills [data-mode]');
    for (var i = 0; i < pills.length; i++) pills[i].setAttribute('aria-pressed', String(pills[i].getAttribute('data-mode') === mode));
    var segPaper = byId('setModePaper');
    var segTyping = byId('setModeTyping');
    if (segPaper) segPaper.setAttribute('aria-pressed', String(mode === 'paper'));
    if (segTyping) segTyping.setAttribute('aria-pressed', String(mode === 'typing'));
  }

  /* VOX-07: the first Start of a session speaks a condensed two-step English… */
  var sessionState = { introShown: false };
  function startDictation(mode) {
    var chosen = mode || settings().mode;
    var conf = settings();
    if (!sessionState.introShown && conf.guideAutoPlay === true && words().length) {
      sessionState.introShown = true;
      if (openGuideQuick(chosen)) return true;
    }
    return beginDictation(chosen);
  }
  function beginDictation(mode) {
    var chosen = mode || settings().mode;
    if (!words().length) {
      /* Never open an empty cockpit: retry boot, then say what to do. */
      try { SDP.Sync.boot({}, function () { startDictation(chosen); }); } catch (e) {}
      showToast(t('emptyBank'));
      showTab('home');
      renderHome();
      return false;
    }
    try { SDP.Data.saveSettings({ mode: chosen }); } catch (e) {}
    try { SDP.Engine.start({ mode: chosen }); } catch (e) {}
    showTab('player');
    return true;
  }
  function resumeDictation() {
    var draft = null;
    try { draft = SDP.Data.session(); } catch (e) {}
    /* D11: Engine.resume() restores the exact beat (countdown for 'writing',… */
    var resumed = false;
    try { resumed = !!(SDP.Engine && SDP.Engine.resume && SDP.Engine.resume()); } catch (e) { resumed = false; }
    if (!resumed) {
      if (!draft) { startDictation(); return; }
      try {
        SDP.Engine.start({ mode: draft.mode || settings().mode, startIndex: draft.index || 0, answers: draft.answers || {} });
      } catch (e) {}
    }
    showTab('player');
    if (!resumed && SDP.Engine && SDP.Engine.isPaused && SDP.Engine.isPaused()) {
      try { SDP.Engine.resume(); } catch (e) {}
    }
  }

  /* ══ Guide 4.0 — the compact four-step spotlight (R2 / F2 / F3) ══════
   * One viewport, one sentence, four dots, two buttons. The spoken text is
   * NEVER the card chrome: the class used to hear "Auto pause. Listen twice.
   * Write in five seconds..." because the title carried badge words. The four
   * sentences below are the only thing narration may say. */
  var GUIDE_SPOTLIGHT_STEPS = [
    'Press Start Dictation to begin.',
    'Listen twice, then write in five seconds.',
    'Check all thirty words in order.',
    'Practise the words you missed.'
  ];
  var guideState = { activeStep: 0, narrating: false, opener: null, autoplayTimer: null, quickMode: false, pendingMode: null, guideRunId: 0 };
  function guideIndex(n) {
    var i = Number(n);
    if (!(i >= 0)) i = 0;
    if (i > 3) i = 3;
    return i;
  }
  function guideSentence(idx) { return GUIDE_SPOTLIGHT_STEPS[guideIndex(idx)]; }
  /* The hidden <ol> keeps the four steps machine-readable (and translated) for
     the language pill and for assistive tech; the spotlight is what is seen. */
  function renderGuideSteps() {
    var host = byId('guideSteps');
    if (!host) return 0;
    var html = '', i;
    for (i = 1; i <= 4; i++) {
      html += '<li class="guide-step" data-step="' + (i - 1) + '">' + esc(t('guideSpotlight' + i)) + '</li>';
    }
    host.innerHTML = html;
    paintGuideSpotlight(guideState.activeStep);
    return 4;
  }
  function paintGuideSpotlight(idx) {
    var at = guideIndex(idx);
    guideState.activeStep = at;
    setText(byId('guideStepTag'), t('guideStepTagPrefix', 'Step') + ' ' + (at + 1) + ' ' + t('guideStepTagSuffix', 'of 4'));
    setText(byId('guideStepText'), t('guideSpotlight' + (at + 1), GUIDE_SPOTLIGHT_STEPS[at]));
    var dots = byId('guideDots');
    if (dots && dots.querySelectorAll) {
      var all = dots.querySelectorAll('.guide-dot');
      for (var d = 0; d < all.length; d++) {
        var on = d === at;
        if (all[d].classList) {
          if (on) all[d].classList.add('is-active'); else all[d].classList.remove('is-active');
        }
        if (on) all[d].setAttribute('aria-current', 'step');
        else all[d].removeAttribute('aria-current');
      }
    }
    var host = byId('guideSteps');
    if (host && host.querySelectorAll) {
      var steps = host.querySelectorAll('.guide-step');
      for (var j = 0; j < steps.length; j++) {
        var live = j === at;
        if (steps[j].classList) {
          if (live) { steps[j].classList.add('guide-active'); steps[j].classList.add('active-step'); }
          else { steps[j].classList.remove('guide-active'); steps[j].classList.remove('active-step'); }
        }
      }
    }
    return at;
  }

  /* ── D-G2: the "tap to start" autoplay-unlock banner ──────────────────── */
  function showGuideTapBanner() {
    var banner = byId('guideTapBanner');
    if (!banner) return false;
    if (banner.classList) banner.classList.remove('hidden');
    banner.hidden = false;
    return true;
  }
  function hideGuideTapBanner() {
    var banner = byId('guideTapBanner');
    if (!banner) return false;
    if (banner.classList) banner.classList.add('hidden');
    banner.hidden = true;
    return true;
  }
  function guideTapBannerVisible() {
    var banner = byId('guideTapBanner');
    if (!banner) return false;
    if (banner.hidden) return false;
    return !(banner.classList && banner.classList.contains('hidden'));
  }
  /* D16/R9: 900 ms in, a cold-boot browser may still be un-gestured. */
  function showGuideAutoplayBanner() {
    var banner = byId('guideAutoplayBanner');
    if (!banner) return false;
    if (banner.classList) banner.classList.remove('hidden');
    banner.hidden = false;
    banner.textContent = t('guideAutoplayBanner', ' Tap Anywhere to Start Voice Guide');
    return true;
  }
  function hideGuideAutoplayBanner() {
    var banner = byId('guideAutoplayBanner');
    if (!banner) return false;
    if (banner.classList) banner.classList.add('hidden');
    banner.hidden = true;
    return true;
  }
  function guideAutoplayBannerVisible() {
    var banner = byId('guideAutoplayBanner');
    if (!banner) return false;
    if (banner.hidden) return false;
    return !(banner.classList && banner.classList.contains('hidden'));
  }
  function clearGuideAutoplayWatch() {
    if (guideState.autoplayTimer) {
      try { global.clearTimeout(guideState.autoplayTimer); } catch (e) {}
      guideState.autoplayTimer = null;
    }
    return true;
  }
  function armGuideAutoplayWatch() {
    clearGuideAutoplayWatch();
    guideState.autoplayTimer = global.setTimeout(function () {
      guideState.autoplayTimer = null;
      var modal = byId('guideModal');
      if (!modal || modal.hidden) return;
      var started = false;
      try {
        started = !!(SDP.Speech && SDP.Speech.hasStarted && SDP.Speech.hasStarted()) ||
          !!(SDP.Speech && SDP.Speech.isAudioPlaying && SDP.Speech.isAudioPlaying());
      } catch (e) { started = false; }
      if (!started) showGuideAutoplayBanner();
    }, 900);
    return true;
  }
  /* R2: one run id per narration. Every callback re-checks it, so a tap or a
     skip can never be overtaken by an older chain (the F2 loop). */
  function startGuideNarration(fromStep, lastStep) {
    guideState.narrating = true;
    guideState.guideRunId += 1;
    var runId = guideState.guideRunId;
    var start = guideIndex(fromStep);
    var last = lastStep === undefined ? 3 : guideIndex(lastStep);
    renderGuideSteps();
    function speakStep(idx) {
      if (runId !== guideState.guideRunId) return false;
      var modal = byId('guideModal');
      if (!modal || modal.hidden) { guideState.narrating = false; return false; }
      if (idx > last) {
        guideState.narrating = false;
        /* VOX-07: the quick walkthrough starts the dictation by itself. */
        if (guideState.quickMode) finishQuickGuide(true);
        return true;
      }
      paintGuideSpotlight(idx);
      hideGuideTapBanner();
      var sentence = guideSentence(idx);
      try {
        SDP.Speech.playGuideStep(idx, sentence, { lang: 'en-GB', rate: 0.94, pitch: 1.03 }, function () {
          if (runId !== guideState.guideRunId || !guideState.narrating) return;
          speakStep(idx + 1);
        });
      } catch (e) {
        /* D-G1: never swallow a narration failure. */
        guideState.narrating = false;
        try { console.error('[SDP] guide narration failed:', e); } catch (e2) {}
        showToast(t('guideVoiceFailed'));
        showGuideTapBanner();
      }
      return true;
    }
    speakStep(start);
    return true;
  }
  function stopGuideNarration() {
    guideState.guideRunId += 1;
    try { if (SDP.Speech) SDP.Speech.stop(); } catch (e) {}
    guideState.narrating = false;
    return true;
  }
  /* R2 (F2): the banner tap primes audio and resumes the CURRENT step — it is
     not a modal-wide gesture loop that restarts from Step 1 on every tap. */
  function onGuideBannerTap(ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    if (ev && ev.preventDefault) ev.preventDefault();
    hideGuideTapBanner();
    hideGuideAutoplayBanner();
    clearGuideAutoplayWatch();
    closeGuideSpot();
    try { if (SDP.Speech && SDP.Speech.unlockAudio) SDP.Speech.unlockAudio(); } catch (e) {}
    if (!guideState.narrating) startGuideNarration(guideState.activeStep);
    return true;
  }
  function openGuide(opener, opts) {
    opts = opts || {};
    var modal = byId('guideModal');
    if (!modal) return false;
    guideState.guideRunId += 1;
    /* R6 / D10: opening the guide is a modal event — pause the beat first. */
    pauseForNavigation('settings');
    if (!opts.quick) restoreGuideTitle();
    guideState.opener = opener && typeof opener.focus === 'function' ? opener : null;
    guideState.activeStep = 0;
    renderGuideSteps();
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    if (modal.classList) modal.classList.add('is-open');
    var conf = settings();
    hideGuideTapBanner();
    hideGuideAutoplayBanner();
    /* v0.0.4.c Path A: a cold boot paints the guide silently. */
    if (!opts.fromBoot && conf.guideAutoPlay !== false && !opts.quick) startGuideNarration(0);
    armGuideAutoplayWatch();
    var banner = byId('guideTapBanner');
    if (banner && !banner._sdpBound) {
      banner._sdpBound = true;
      banner.addEventListener('click', onGuideBannerTap, false);
      banner.addEventListener('keydown', function (ev) {
        if (ev && (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar')) onGuideBannerTap(ev);
      }, false);
    }
    var auto = byId('guideAutoplayBanner');
    if (auto && !auto._sdpBound) {
      auto._sdpBound = true;
      auto.addEventListener('click', onGuideBannerTap, false);
    }
    var spotClose = byId('btnGuideSpotClose');
    if (spotClose && !spotClose._sdpBound) {
      spotClose._sdpBound = true;
      spotClose.addEventListener('click', closeGuideSpot, false);
    }
    var close = byId('btnGuideClose');
    if (close && close.focus) { try { close.focus({ preventScroll: true }); } catch (e) {} }
    return true;
  }
  function closeGuide() {
    var modal = byId('guideModal');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      if (modal.classList) modal.classList.remove('is-open');
    }
    closeGuideSpot();
    stopGuideNarration();
    clearGuideAutoplayWatch();
    hideGuideTapBanner();
    hideGuideAutoplayBanner();
    /* W7/D-G5: write the stamp — dismissing still counts as seen (G7.1d). */
    try { SDP.Data.markGuideSeen(); } catch (e) {}
    restoreGuideTitle();
    var opener = guideState.opener;
    if (opener && typeof opener.focus === 'function') { try { opener.focus({ preventScroll: true }); } catch (e) {} }
    guideState.opener = null;
    guideState.activeStep = 0;
    return true;
  }
  /* ── VOX-07: Quick Walkthrough Mode ───────────────────────────────────── */
  function quickSkipButton(show) {
    var btn = byId('btnGuideSkipStart');
    if (!btn) return false;
    btn.hidden = show === false;
    btn.setAttribute('aria-hidden', show === false ? 'true' : 'false');
    btn.textContent = t('guideSkipStartNow', '▶ Start Dictation Now');
    return true;
  }
  function restoreGuideTitle() {
    var title = byId('guideTitle');
    if (title) title.textContent = t('howToUse');
    guideState.quickMode = false;
    guideState.pendingMode = null;
    /* R2: the footer always carries exactly ▶ Start Dictation Now. */
    quickSkipButton(true);
    return true;
  }
  function openGuideQuick(mode) {
    var modal = byId('guideModal');
    if (!modal) return false;
    guideState.pendingMode = mode || settings().mode;
    guideState.quickMode = true;
    openGuide(null, { quick: true });
    var title = byId('guideTitle');
    if (title) title.textContent = t('guideQuickTitle');
    quickSkipButton(true);
    guideState.activeStep = 0;
    renderGuideSteps();
    if (settings().guideAutoPlay !== false) {
      stopGuideNarration();
      startGuideNarration(0, 1);
    }
    return true;
  }
  /* Called when the quick walkthrough ends or the student skips it. */
  function finishQuickGuide(startNow) {
    var mode = guideState.pendingMode || settings().mode;
    var wasQuick = !!guideState.quickMode;
    guideState.quickMode = false;
    guideState.pendingMode = null;
    closeGuide();
    if (wasQuick && startNow !== false) beginDictation(mode);
    return true;
  }
  /* R2: the retired "Listen to the steps (EN)" affordance now just reopens the
     spotlight and starts from Step 1. */
  function speakGuide() {
    var modal = byId('guideModal');
    if (modal && modal.hidden) {
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      if (modal.classList) modal.classList.add('is-open');
    }
    try { if (SDP.Speech && SDP.Speech.unlockAudio) SDP.Speech.unlockAudio(); } catch (e) {}
    hideGuideTapBanner();
    closeGuideSpot();
    stopGuideNarration();
    startGuideNarration(0);
    armGuideAutoplayWatch();
    return 4;
  }
  /* E7: guide-spot spotlight — highlights the control the step describes. */
  function openGuideSpot(targetId, cueText) {
    var spot = byId('guideSpot');
    var cue = byId('guideSpotCue');
    if (!spot) return false;
    if (cue) cue.textContent = str(cueText || '');
    spot.hidden = false;
    spot.setAttribute('aria-hidden', 'false');
    return true;
  }
  function closeGuideSpot() {
    var spot = byId('guideSpot');
    if (spot) { spot.hidden = true; spot.setAttribute('aria-hidden', 'true'); }
    return true;
  }
  function trapGuideKeys() {
    if (doc.documentElement._sdpGuideKeys) return;
    doc.documentElement._sdpGuideKeys = true;
    doc.addEventListener('keydown', function (ev) {
      var modal = byId('guideModal');
      if (!modal || modal.hidden) return;
      if (ev.key === 'Escape') { ev.preventDefault(); closeGuide(); return; }
      if (ev.key === 'Tab') {
        var focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        var first = focusables[0], last = focusables[focusables.length - 1];
        if (ev.shiftKey) {
          if (doc.activeElement === first) { ev.preventDefault(); last.focus(); }
        } else if (doc.activeElement === last || !modal.contains(doc.activeElement)) {
          ev.preventDefault(); first.focus();
        }
      }
    }, true);
  }

  /* ══ Words explorer  ══ */
  function wordFilter() {
    var active = doc.querySelector ? doc.querySelector('#dictFilterRow [aria-pressed="true"]') : null;
    return active ? str(active.getAttribute('data-filter')) : 'all';
  }
  /* v0.0.4.a W4: wrap the first case-insensitive match of the word inside its
     example sentence in a <b class="d-hit"> highlight. */
  function highlightWordInSentence(sentence, word) {
    var s = str(sentence), w = str(word);
    if (!s || !w) return esc(s);
    var at = s.toLowerCase().indexOf(w.toLowerCase());
    if (at < 0) return esc(s);
    return esc(s.slice(0, at)) + '<b class="d-hit">' + esc(s.slice(at, at + w.length)) + '</b>' + esc(s.slice(at + w.length));
  }
  function renderWords() {
    var host = byId('dictList');
    if (!host) return 0;
    var list = words();
    var query = str(byId('dictSearch') ? byId('dictSearch').value : '').toLowerCase();
    var filter = wordFilter();
    var progress = {};
    try { progress = SDP.Data.progress(); } catch (e) {}
    var weak = (progress.weakWords || []).slice(0);
    var html = '', shown = 0, i;
    for (i = 0; i < list.length; i++) {
      var w = list[i];
      var key = str(w.w).toLowerCase();
      if (query && key.indexOf(query) < 0 && str(w.si).indexOf(query) < 0 && str(w.m).toLowerCase().indexOf(query) < 0) continue;
      if (filter === 'weak' && weak.indexOf(key) < 0) continue;
      if (filter === 'mastered' && !progress.mastered[key]) continue;
      shown += 1;
      /* D14: #01..#30 rows + per-word self-check into sdp.progress. */
      var isMastered = !!progress.mastered[key];
      var isWeak = weak.indexOf(key) >= 0;
      var rowState = isMastered ? 'mastered' : (isWeak ? 'weak' : '');
      html += '<article class="dict-card" data-word="' + esc(w.w) + '" data-state="' + rowState + '">' +
        '<div class="d-body">' +
        '<div class="d-top"><span class="d-index">#' + pad2(i + 1) + '</span> <strong class="d-w">' + esc(w.w) + '</strong> <span class="d-pos">' + esc(w.pos) + '</span></div>' +
        '<div class="d-p">/' + esc(w.p) + '/</div>' +
        '<div class="d-m">' + esc(w.m) + '</div>' +
        '<div class="word-si">' + esc(w.si) + '</div>' +
        '<div class="d-s">' + highlightWordInSentence(str(w.s), str(w.w)) + '</div>' +
        '</div>' +
        '<div class="d-side">' +
        '<button type="button" class="btn btn-sm d-play" data-play="' + esc(w.w) + '" data-play-word="' + esc(w.w) + '" aria-label="' + esc(t('playAudio')) + ' ' + esc(w.w) + '"> Listen</button>' +
        '<button type="button" class="btn btn-sm d-mark-correct" data-mark-word="mastered" data-word-mark="' + esc(w.w) + '" aria-pressed="' + String(isMastered) + '">' + esc(t('markCorrectWord')) + '</button>' +
        '<button type="button" class="btn btn-sm d-mark-weak" data-mark-word="weak" data-word-mark="' + esc(w.w) + '" aria-pressed="' + String(isWeak) + '">' + esc(t('markWeakWord')) + '</button>' +
        '</div>' +
        '</article>';
    }
    var dictEmpty = byId('dictEmpty');
    if (dictEmpty) dictEmpty.hidden = list.length > 0;
    host.innerHTML = shown ? html : (list.length ? '<p class="dict-empty">' + esc(t('noWordsFound')) + '</p>' : '');
    return shown;
  }
  /* D14:  /  write sdp.progress.mastered / weakWords and repaint. */
  function markDictWord(wordName, state) {
    var key = str(wordName).toLowerCase();
    if (!key) return false;
    var progress = {};
    try { progress = SDP.Data.progress(); } catch (e) { return false; }
    if (!isObj(progress.mastered)) progress.mastered = {};
    var weak = Array.isArray(progress.weakWords) ? progress.weakWords.slice(0) : [];
    var at = weak.indexOf(key);
    if (state === 'mastered') {
      progress.mastered[key] = true;
      if (at >= 0) weak.splice(at, 1);
    } else if (state === 'weak') {
      delete progress.mastered[key];
      if (at < 0) weak.push(key);
    }
    progress.weakWords = weak;
    try { SDP.Data.saveProgress(progress); } catch (e) {}
    renderWords();
    renderHome();
    return true;
  }
  function bindWords() {
    var search = byId('dictSearch');
    if (search && !search._sdpBound) {
      search._sdpBound = true;
      search.addEventListener('input', function () { renderWords(); });
    }
    var filters = byId('dictFilterRow');
    if (filters && !filters._sdpBound) {
      filters._sdpBound = true;
      filters.addEventListener('click', function (ev) {
        var node = ev && ev.target;
        while (node && node !== filters && !(node.getAttribute && node.getAttribute('data-filter'))) node = node.parentNode;
        if (!node || node === filters || !node.getAttribute) return;
        var pills = filters.querySelectorAll('[data-filter]');
        for (var i = 0; i < pills.length; i++) pills[i].setAttribute('aria-pressed', String(pills[i] === node));
        renderWords();
      });
    }
    var list = byId('dictList');
    if (list && !list._sdpBound) {
      list._sdpBound = true;
      list.addEventListener('click', function (ev) {
        var node = ev && ev.target;
        var markNode = node;
        while (markNode && markNode !== list && !(markNode.getAttribute && markNode.getAttribute('data-mark-word'))) markNode = markNode.parentNode;
        if (markNode && markNode !== list && markNode.getAttribute) {
          markDictWord(markNode.getAttribute('data-word-mark'), markNode.getAttribute('data-mark-word'));
          return;
        }
        while (node && node !== list && !(node.getAttribute && (node.getAttribute('data-play') || node.getAttribute('data-play-word')))) node = node.parentNode;
        if (!node || node === list || !node.getAttribute) return;
        var word = null;
        try { word = SDP.Sync.wordByName(node.getAttribute('data-play') || node.getAttribute('data-play-word')); } catch (e) {}
        if (word && SDP.Speech) SDP.Speech.playWord(word, {}, noop);
      });
    }
  }

  /* ══ Practice  ══ */
  function practicePool() {
    var list = words().slice(0);
    var weakOnly = byId('pracWeakOnly');
    if (weakOnly && weakOnly.checked) {
      var progress = {};
      try { progress = SDP.Data.progress(); } catch (e) {}
      var weak = progress.weakWords || [];
      var filtered = [];
      for (var i = 0; i < list.length; i++) if (weak.indexOf(str(list[i].w).toLowerCase()) >= 0) filtered.push(list[i]);
      if (filtered.length) list = filtered;
    }
    return list;
  }
  function shuffle(list) {
    var copy = list.slice(0), i, j, tmp;
    for (i = copy.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
  }
  function renderPractice() {
    var host = byId('pracStage');
    if (!host) return;
    practice.pool = practicePool();
    if (practice.index >= practice.pool.length) practice.index = 0;
    var pills = doc.querySelectorAll('#pracMode [data-prac]');
    for (var p = 0; p < pills.length; p++) pills[p].setAttribute('aria-selected', String(pills[p].getAttribute('data-prac') === practice.mode));
    var word = practice.pool[practice.index];
    if (!word) { host.innerHTML = '<p class="dict-empty">' + esc(t('noWords')) + '</p>'; return; }
    var html = '';
    if (practice.mode === 'quiz' || practice.mode === 'listen') {
      var distractors = [];
      var others = shuffle(practice.pool.filter(function (x) { return str(x.w) !== str(word.w); }));
      for (var d = 0; d < others.length && distractors.length < 3; d++) distractors.push(others[d]);
      var options = shuffle(distractors.concat([word]));
      var prompt = practice.mode === 'quiz' ? '<div class="prac-word">' + esc(word.w) + '</div><div class="prac-mini">/' + esc(word.p) + '/ · ' + esc(t('chooseMeaning')) + '</div>'
        : '<div class="prac-word">▶</div><div class="prac-mini">' + esc(t('listenAndChoose')) + '</div>';
      html += '<div class="prac-card">' + prompt + '</div><div class="prac-options">';
      for (var o = 0; o < options.length; o++) {
        var label = practice.mode === 'quiz' ? str(options[o].m) : str(options[o].w);
        var state = '';
        if (practice.answered) {
          if (str(options[o].w) === str(word.w)) state = 'ok';
          else if (practice.answered === str(options[o].w)) state = 'bad';
        }
        html += '<button type="button" class="prac-option" data-pick="' + esc(options[o].w) + '" data-state="' + state + '">' + esc(label) + '</button>';
      }
      html += '</div>';
      if (practice.answered) {
        var good = practice.answered === str(word.w);
        html += '<p class="prac-verdict">' + (good ? t('correctPick') : t('wrongPick')) + '</p>';
      }
      html += '<div class="prac-actions">' +
        (practice.mode === 'listen' ? '<button type="button" class="btn btn-sm" data-prac-act="say">' + esc(t('listen')) + '</button>' : '') +
        '<button type="button" class="btn btn-sm" data-prac-act="next">' + esc(t('nextCard')) + '</button></div>';
    } else {
      var face = practice.flipped
        ? '<div class="prac-word si">' + esc(word.si) + '</div><div class="prac-mini">' + esc(word.m) + '</div>'
        : '<div class="prac-word">' + esc(word.w) + '</div><div class="prac-mini">/' + esc(word.p) + '/ · ' + esc(word.pos) + '</div>';
      html += '<div class="prac-card" data-prac-act="flip" role="button" tabindex="0">' + face +
        '<div class="prac-mini">' + esc(t('tapToFlip')) + '</div></div>' +
        '<div class="prac-actions">' +
        '<button type="button" class="btn btn-sm" data-prac-act="say">' + esc(t('listen')) + '</button>' +
        '<button type="button" class="btn btn-sm" data-prac-act="next">' + esc(t('nextCard')) + '</button>' +
        '</div>';
    }
    host.innerHTML = html;
    /* F3: speak a listen-mode card exactly once per card via the spoken flag. */
    if (practice.mode === 'listen' && !practice.answered && !practice.spoken) {
      practice.spoken = true;
      try { if (SDP.Speech) SDP.Speech.playWord(word, {}, noop); } catch (e) {}
    }
  }
  function bindPractice() {
    var modeHost = byId('pracMode');
    if (modeHost && !modeHost._sdpBound) {
      modeHost._sdpBound = true;
      modeHost.addEventListener('click', function (ev) {
        var node = ev && ev.target;
        while (node && node !== modeHost && !(node.getAttribute && node.getAttribute('data-prac'))) node = node.parentNode;
        if (!node || node === modeHost || !node.getAttribute) return;
        practice.mode = str(node.getAttribute('data-prac')) || 'flash';
        /* ENG-04: without this the first drill card stayed silent. */
        practice.index = 0; practice.answered = ''; practice.flipped = false; practice.spoken = false;
        renderPractice();
      });
    }
    var weak = byId('pracWeakOnly');
    if (weak && !weak._sdpBound) {
      weak._sdpBound = true;
      weak.addEventListener('change', function () { practice.index = 0; renderPractice(); });
    }
    var host = byId('pracStage');
    if (host && !host._sdpBound) {
      host._sdpBound = true;
      host.addEventListener('click', function (ev) {
        var node = ev && ev.target;
        var pick = null, act = null;
        while (node && node !== host) {
          if (node.getAttribute) {
            if (!pick && node.getAttribute('data-pick')) pick = node.getAttribute('data-pick');
            if (!act && node.getAttribute('data-prac-act')) act = node.getAttribute('data-prac-act');
          }
          node = node.parentNode;
        }
        var word = practice.pool[practice.index];
        if (pick) {
          practice.answered = str(pick);
          if (practice.answered === str(word && word.w)) practice.score += 1;
          renderPractice();
          return;
        }
        if (act === 'flip') { practice.flipped = !practice.flipped; practice.spoken = false; renderPractice(); return; }
        if (act === 'say' && word) { if (SDP.Speech) SDP.Speech.playWord(word, {}, noop); return; }
        if (act === 'next') {
          practice.index = (practice.index + 1) % Math.max(1, practice.pool.length);
          practice.answered = ''; practice.flipped = false; practice.spoken = false;
          renderPractice();
        }
      });
    }
  }
  function startPractice(mode) {
    practice.mode = mode === 'weak' ? 'flash' : (mode || 'flash');
    if (mode === 'weak') { var weak = byId('pracWeakOnly'); if (weak) weak.checked = true; }
    practice.index = 0; practice.answered = ''; practice.flipped = false; practice.spoken = false;
    showTab('practice');
    renderPractice();
    return practice.mode;
  }

  /* ══ Settings  ══ */
  function buildRepeatsOptions(select) {
    /* ONE shared builder for #setRepeats (never duplicated). */
    if (!select || select._sdpBuilt) return;
    select._sdpBuilt = true;
    var html = '';
    for (var n = 1; n <= 5; n++) html += '<option value="' + n + '">' + n + '×</option>';
    select.innerHTML = html;
  }
  /* One call for every surface — used after a classroom settings adoption. */
  /* D12/D18: skip Studio re-render while an action is in flight. */
  function studioIsBusy() {
    try { return !!(SDP.Studio && SDP.Studio.isBusy && SDP.Studio.isBusy()); } catch (e) { return false; }
  }
  function renderAll() {
    renderHome(); renderWords(); renderPractice();
    if (!studioIsBusy()) { renderSettings(); }
    renderGuideSteps(); renderBoardBar(); renderBoardJumper();
    paintPresetBadge();
    try { paintSyncBadge({ state: 'synced', session: str(SDP.Sync && SDP.Sync.sessionNo ? SDP.Sync.sessionNo() : '8') }); } catch (e) {}
    return true;
  }
  /* R1: the lecturer-only sticky bar at the top of Settings section 1. */
  function paintLecturerBar() {
    var bar = byId('lecturerSyncBar');
    if (!bar) return false;
    var unlocked = false;
    try { unlocked = !!(SDP.Studio && SDP.Studio.isUnlocked && SDP.Studio.isUnlocked()); } catch (e) { unlocked = false; }
    bar.hidden = !unlocked;
    bar.setAttribute('aria-hidden', unlocked ? 'false' : 'true');
    if (unlocked) {
      var btn = byId('btnSyncClassSettings');
      /* D2: never repaint a mid-action button label. */
      if (btn && btn.getAttribute('data-busy') !== '1') btn.textContent = t('lecturerSyncBar');
      var hint = byId('lecturerSyncHint');
      if (hint) hint.textContent = t('studioAskLecturer');
    }
    /* D19: the idle label is separate from the live status stamp. */
    var last = byId('lecturerSyncLast');
    if (last && !last.getAttribute('data-state')) last.textContent = t('lecturerSyncIdle');
    return unlocked;
  }
  /* D7: Settings is student-only; one banner links into the studio. */
  function paintLecturerBanner() {
    var banner = byId('settingsLecturerBanner');
    if (!banner) return false;
    var unlocked = false;
    try { unlocked = !!(SDP.Studio && SDP.Studio.isUnlocked && SDP.Studio.isUnlocked()); } catch (e) { unlocked = false; }
    banner.hidden = !unlocked;
    setText(byId('settingsLecturerText'), t('settingsLecturerActive'));
    var btn = byId('btnOpenStudioFromSettings');
    if (btn) btn.textContent = t('openStudioBtn');
    return unlocked;
  }
  function renderSettings() {
    var conf = settings();
    buildRepeatsOptions(byId('setRepeats'));
    var write = byId('setWriteSecs');
    if (write) write.value = String(conf.writeSecs);
    setText(byId('outWriteSecs'), conf.writeSecs + 's');
    var repeats = byId('setRepeats');
    if (repeats) repeats.value = String(conf.repeats);
    var pause = byId('setPause');
    if (pause) pause.value = String(conf.pauseSecs);
    setText(byId('outPause'), conf.pauseSecs + 's');
    var auto = byId('setAutoAdvance');
    if (auto) auto.checked = conf.autoAdvance !== false;
    var source = byId('setVoiceSource');
    if (source) source.value = str(conf.voiceSource || 'auto');
    var rate = byId('setRate');
    if (rate) rate.value = String(conf.rate);
    setText(byId('outRate'), conf.rate + 'x');
    var volume = byId('setVolume');
    if (volume) volume.value = String(Math.round((isNaN(Number(conf.volume)) ? 1 : Number(conf.volume)) * 100));
    setText(byId('outVolume'), Math.round((isNaN(Number(conf.volume)) ? 1 : Number(conf.volume)) * 100) + '%');
    var langSel = byId('setLang');
    if (langSel) langSel.value = lang;
    var themeSel = byId('setTheme');
    if (themeSel) themeSel.value = theme;
    var voiceLock = byId('setVoiceLock');
    if (voiceLock) voiceLock.value = str(conf.voiceLock || 'unified');
    paintLecturerBanner();
    var guideAuto = byId('setGuideAutoPlay');
    if (guideAuto) guideAuto.checked = conf.guideAutoPlay !== false;
    var pills = doc.querySelectorAll ? doc.querySelectorAll('#presetRow [data-preset]') : [];
    for (var pi = 0; pi < pills.length; pi++) {
      pills[pi].setAttribute('aria-pressed', String(pills[pi].getAttribute('data-preset') === str(conf.pacingPreset || 'standard')));
    }
    paintModePills();
    paintLecturerBar();
    paintSyncBadge({ state: 'synced', session: str(SDP.Sync && SDP.Sync.sessionNo ? SDP.Sync.sessionNo() : '8') });
    var storage = byId('storageStatus');
    if (storage) {
      var kb = 0;
      try {
        var payload = (global.localStorage ? str(global.localStorage.getItem('sdp.progress')).length : 0) +
          (global.localStorage ? str(global.localStorage.getItem('sdp.settings')).length : 0);
        kb = Math.round(payload / 1024);
      } catch (e) { kb = 0; }
      setText(storage, (SDP.Data.available ? '' : ' ') + kb + ' KB ' + t('storageLine'));
    }
  }
  function bindSettings() {
    function save(patch) { try { SDP.Data.saveSettings(patch); } catch (e) {} }
    /* P5/ENG-05: every manual change answers at once and is remembered as touched. */
    window.__sdpSaveTouched = saveTouched;
    function range(id, key, scale, format, label, personal) {
      var node = byId(id);
      if (!node || node._sdpBound) return;
      node._sdpBound = true;
      var commit = function () {
        var raw = Number(node.value);
        var value = scale ? raw / scale : raw;
        var patch = {};
        patch[key] = value;
        var line = label ? label + ' → ' + (format ? format.fn(value) : value) : '';
        /* Personal keys (volume) are saved but never marked as touched. */
        if (personal) save(patch); else saveTouched(patch, line);
        if (format) setText(byId(format.out), format.fn(value));
        if (SDP.Engine && SDP.Engine.applySettings) SDP.Engine.applySettings();
      };
      /* 'change' is the moment a range settles: toast once, never per pixel. */
      node.addEventListener('input', function () {
        var raw = Number(node.value);
        var value = scale ? raw / scale : raw;
        var patch = {};
        patch[key] = value;
        save(patch);
        if (format) setText(byId(format.out), format.fn(value));
        if (SDP.Engine && SDP.Engine.applySettings) SDP.Engine.applySettings();
      });
      node.addEventListener('change', commit);
    }
    range('setWriteSecs', 'writeSecs', 1, { out: 'outWriteSecs', fn: function (v) { return v + 's'; } }, t('writeTime'));
    range('setPause', 'pauseSecs', 1, { out: 'outPause', fn: function (v) { return v + 's'; } }, t('pauseBetween'));
    range('setRate', 'rate', 1, { out: 'outRate', fn: function (v) { return v + 'x'; } }, t('rate'));
    range('setVolume', 'volume', 100, { out: 'outVolume', fn: function (v) { return Math.round(v * 100) + '%'; } }, t('volume'), true);
    var repeats = byId('setRepeats');
    if (repeats && !repeats._sdpBound2) {
      repeats._sdpBound2 = true;
      repeats.addEventListener('change', function () {
        saveTouched({ repeats: Number(repeats.value) }, t('repeats') + ' → ' + repeats.value);
        if (SDP.Engine) SDP.Engine.applySettings();
      });
    }
    var auto = byId('setAutoAdvance');
    if (auto && !auto._sdpBound) {
      auto._sdpBound = true;
      auto.addEventListener('change', function () {
        saveTouched({ autoAdvance: !!auto.checked }, t('autoAdvance') + ' → ' + (auto.checked ? 'on' : 'off'));
        if (SDP.Engine) SDP.Engine.applySettings();
      });
    }
    var source = byId('setVoiceSource');
    if (source && !source._sdpBound) {
      source._sdpBound = true;
      source.addEventListener('change', function () {
        saveTouched({ voiceSource: source.value }, t('voiceSource') + ' → ' + source.value);
      });
    }
    var voiceLock = byId('setVoiceLock');
    if (voiceLock && !voiceLock._sdpBound) {
      voiceLock._sdpBound = true;
      voiceLock.addEventListener('change', function () {
        var val = voiceLock.value;
        var patch = { voiceLock: val };
        if (val === 'unified') patch.voiceSource = 'auto';
        else if (str(source ? source.value : '') === 'auto') patch.voiceSource = 'custom';
        saveTouched(patch, t('voiceLockLabel') + ' → ' + val);
        if (SDP.Engine && SDP.Engine.applySettings) SDP.Engine.applySettings();
      });
    }
    var guideAuto = byId('setGuideAutoPlay');
    if (guideAuto && !guideAuto._sdpBound) {
      guideAuto._sdpBound = true;
      guideAuto.addEventListener('change', function () { save({ guideAutoPlay: !!guideAuto.checked }); });
    }
    var btnReplay = byId('btnReplayGuide');
    if (btnReplay && !btnReplay._sdpBound) {
      btnReplay._sdpBound = true;
      btnReplay.addEventListener('click', function () { openGuide(); });
    }
    var dl = byId('btnDownloadClips');
    if (dl && !dl._sdpBound) {
      dl._sdpBound = true;
      dl.addEventListener('click', function () {
        try {
          var words = SDP.Sync && typeof SDP.Sync.words === 'function' ? SDP.Sync.words() : [];
          var status = byId('downloadClipsStatus');
          if (status) status.textContent = '…';
          SDP.Sync.downloadOfflineAudio(words, function (done, total) {
            if (status) status.textContent = str(done) + ' of ' + str(total) + ' cached';
          }, function (result) {
            if (status) status.textContent = result.ok ? t('downloadClipsDone') : t('downloadClipsDone') + ' — incomplete';
            setUpdateStatus(status ? status.textContent : '', result.ok ? 'ok' : 'bad');
          });
        } catch (e) { var status = byId('downloadClipsStatus'); if (status) status.textContent = 'Download unavailable'; }
      });
    }
    var badge = byId('syncBadge');
    if (badge && !badge._sdpBound) {
      badge._sdpBound = true;
      badge.addEventListener('click', function () {
        var st = badge.getAttribute('data-sync-state');
        if (st === 'update') { location.reload(); }
        else checkForUpdate();
      });
    }
    var langSel = byId('setLang');
    if (langSel && !langSel._sdpBound) {
      langSel._sdpBound = true;
      langSel.addEventListener('change', function () { applyLang(langSel.value); });
    }
    var themeSel = byId('setTheme');
    if (themeSel && !themeSel._sdpBound) {
      themeSel._sdpBound = true;
      themeSel.addEventListener('change', function () {
        var next = applyTheme(themeSel.value, true);
        saveTouched({ theme: next }, t('theme') + ' → ' + next);
      });
    }
    [['setModePaper', 'paper'], ['setModeTyping', 'typing']].forEach(function (pair) {
      var node = byId(pair[0]);
      if (!node || node._sdpBound) return;
      node._sdpBound = true;
      node.addEventListener('click', function () {
        saveTouched({ mode: pair[1] }, t('modeLabel') + ' → ' + pair[1]);
        applyModePills(pair[1]);
        if (SDP.Engine && SDP.Engine.setMode) SDP.Engine.setMode(pair[1], true);
      });
    });
    var test = byId('btnTestVoice');
    if (test && !test._sdpBound) {
      test._sdpBound = true;
      test.addEventListener('click', function () { try { SDP.Speech.testVoice(noop); } catch (e) {} });
    }
    var exportBtn = byId('btnExportBackup');
    if (exportBtn && !exportBtn._sdpBound) {
      exportBtn._sdpBound = true;
      exportBtn.addEventListener('click', function () {
        try {
          var text = SDP.Data.backup();
          var blob = new global.Blob([text], { type: 'application/json' });
          var url = global.URL.createObjectURL(blob);
          var a = doc.createElement('a');
          a.href = url;
          a.download = 'smart-dictation-backup-' + APP_VERSION + '.json';
          if (doc.body) doc.body.appendChild(a);
          a.click();
          global.setTimeout(function () { try { global.URL.revokeObjectURL(url); } catch (e) {} }, 1500);
          setUpdateStatus(t('exportReady'), 'ok');
        } catch (e) { setUpdateStatus(t('importBad'), 'bad'); }
      });
    }
    var importBtn = byId('btnImportBackup');
    var importFile = byId('importFile');
    if (importBtn && importFile && !importBtn._sdpBound) {
      importBtn._sdpBound = true;
      importBtn.addEventListener('click', function () { try { importFile.click(); } catch (e) {} });
      importFile.addEventListener('change', function () {
        var file = importFile.files && importFile.files[0];
        if (!file || typeof global.FileReader !== 'function') return;
        var reader = new global.FileReader();
        reader.onload = function () {
          var result = { ok: false };
          try { result = SDP.Data.restore(str(reader.result)); } catch (e) { result = { ok: false }; }
          setUpdateStatus(result.ok ? t('importOk') : t('importBad'), result.ok ? 'ok' : 'bad');
          renderHome(); renderWords(); renderSettings();
        };
        reader.readAsText(file);
      });
    }
    var reset = byId('btnResetStats');
    if (reset && !reset._sdpBound) {
      reset._sdpBound = true;
      reset.addEventListener('click', function () {
        try { SDP.Data.resetProgress(); } catch (e) {}
        renderHome(); renderWords();
        setUpdateStatus(t('resetDone'), 'ok');
      });
    }
    var check = byId('btnCheckUpdate');
    if (check && !check._sdpBound) {
      check._sdpBound = true;
      check.addEventListener('click', function () { checkForUpdate(); });
    }
    /* R1 / SYNC-03: the lecturer's one button that moves the class. */
    var syncBtn = byId('btnSyncClassSettings');
    if (syncBtn && !syncBtn._sdpBound) {
      syncBtn._sdpBound = true;
      syncBtn.addEventListener('click', function () {
        if (!SDP.Studio || !SDP.Studio.saveClassSettings) return;
        /* D2: no double-click can ever start two publishes. */
        if (syncBtn.getAttribute('data-busy') === '1') return;
        var work = function (finish) {
          var result = SDP.Studio.saveClassSettings(function (err) {
            if (err) {
              setUpdateStatus(err.message === 'no_token' ? t('lecturerSyncNoToken') : t('studioPublishFail'), 'bad');
              showToast(err.message === 'no_token' ? t('lecturerSyncNoToken') : t('studioPublishFail'));
            } else {
              /* D19: Studio stamped the exact Rev # on #lecturerSyncLast. */
              setUpdateStatus(t('lecturerSyncLast') + ' · ' + t('studioPublishOk'), 'ok');
            }
            finish();
          });
          if (result && result.ok === false && result.reason === 'no_token') {
            showToast(t('lecturerSyncNoToken'));
          }
        };
        if (SDP.Studio.withBusy) SDP.Studio.withBusy(syncBtn, work);
        else {
          syncBtn.setAttribute('data-busy', '1');
          syncBtn.disabled = true;
          work(function () { syncBtn.removeAttribute('data-busy'); syncBtn.disabled = false; });
        }
      });
    }
  }
  function setUpdateStatus(text, state) {
    var node = byId('settingsUpdateStatus') || byId('updateStatus');
    if (!node) return;
    node.textContent = str(text);
    if (state) node.setAttribute('data-state', state); else node.removeAttribute('data-state');
  }
  /* ══ Sync badge ══ */
  function paintSyncBadge(state) {
    state = state || {};
    var session = str(state.session || '8');
    var badge = byId('syncBadge');
    /* D-UI10: the badge owns #settingsSyncStatus only. */
    var status = byId('settingsSyncStatus');
    var label;
    if (state.state === 'synced') {
      /* ENG-06: no version or session literal lives in the string tables — the… */
      var base = t('syncBadgeSynced');
      label = lang === 'si'
        ? base + ' · ' + session + ' වන වාරය · v' + APP_VERSION
        : base + ' · Session ' + session + ' · v' + APP_VERSION;
    } else if (state.state === 'offline') {
      label = t('syncBadgeOffline');
    } else if (state.state === 'update') {
      label = t('syncBadgeUpdate');
    } else {
      label = t('syncBadgeRetry');
    }
    if (badge) {
      /* D-UI6: below 480 px the badge shows a two-word summary. */
      var vw = Number(global.innerWidth || 0);
      var shortLabel = label;
      if (vw > 0 && vw < 480) {
        if (state.state === 'offline') shortLabel = t('syncShortOffline');
        else if (state.state === 'update') shortLabel = t('syncShortUpdate');
        else if (state.state === 'error') shortLabel = t('syncShortRetry');
        else shortLabel = t('syncShortSynced');
      }
      badge.textContent = shortLabel;
      badge.setAttribute('data-sync-state', state.state || 'synced');
      badge.setAttribute('title', label);
    }
    if (status) { status.textContent = label; status.setAttribute('data-state', state.state || 'synced'); status.setAttribute('title', label); }
  }
  /* R2/D1: checkForUpdates(cb) is node-style, cb(err, result); v0.0.1.d read… */
  function handleSyncCheckResult(err, result) {
    var res = (result && typeof result === 'object') ? result : ((err && typeof err === 'object' && 'ok' in err) ? err : {});
    var hasErr = (result !== undefined && !!err) || !res.ok;
    if (hasErr) {
      paintSyncBadge({ state: res.error === 'no_fetch' ? 'offline' : 'error', session: syncSessionNo() });
      return;
    }
    if (res.appVersionChanged) {
      paintSyncBadge({ state: 'update', session: res.session || syncSessionNo() });
      return;
    }
    paintSyncBadge({ state: 'synced', session: res.session || syncSessionNo() });
  }
  function syncSessionNo() {
    var n = '8';
    try { if (SDP.Sync && SDP.Sync.sessionNo) n = SDP.Sync.sessionNo() || '8'; } catch (e) {}
    return str(n);
  }
  function checkForUpdate() {
    setUpdateStatus(t('updateChecking'), '');
    try {
      SDP.Sync.checkForUpdates(function (err, result) {
        var res = (result && typeof result === 'object') ? result : ((err && typeof err === 'object' && 'ok' in err) ? err : {});
        var failed = (result !== undefined && !!err) || !res.ok;
        if (failed) {
          var state = (res && res.error === 'no_fetch') ? 'offline' : 'error';
          paintSyncBadge({ state: state, session: syncSessionNo() });
          setUpdateStatus(state === 'offline' ? t('syncBadgeOffline') : t('syncBadgeRetry'), state === 'offline' ? '' : 'bad');
          return;
        }
        if (res.appVersionChanged) {
          paintSyncBadge({ state: 'update', session: res.session || syncSessionNo(), appVersion: res.appVersion });
          setUpdateStatus(t('syncBadgeUpdate'), 'ok');
          return;
        }
        if (res.updated) {
          paintSyncBadge({ state: 'synced', session: res.session || syncSessionNo() });
          setUpdateStatus(t('updateFound') + ' · Session ' + str(res.session), 'ok');
          onDataReady();
          return;
        }
        paintSyncBadge({ state: 'synced', session: res.session || syncSessionNo() });
        setUpdateStatus(t('updateNone'), '');
      });
    } catch (e) {
      paintSyncBadge({ state: 'error', session: syncSessionNo() });
      setUpdateStatus(t('syncBadgeRetry'), 'bad');
    }
  }

  /* ══ Quick pacing presets ══ */
  var PRESETS = {
    beginner: { pacingPreset: 'beginner', writeSecs: 12, repeats: 4, pauseSecs: 2, autoAdvance: true },
    standard: { pacingPreset: 'standard', writeSecs: 8, repeats: 3, pauseSecs: 1.5, autoAdvance: true },
    exam: { pacingPreset: 'exam', writeSecs: 5, repeats: 2, pauseSecs: 1, autoAdvance: true },
    board: { pacingPreset: 'board', writeSecs: 10, repeats: 3, pauseSecs: 1.5, autoAdvance: true, theme: 'board' }
  };
  function applyPreset(id) {
    var p = PRESETS[id];
    if (!p) return;
    var patch = { pacingPreset: p.pacingPreset, writeSecs: p.writeSecs, repeats: p.repeats, pauseSecs: p.pauseSecs, autoAdvance: p.autoAdvance };
    if (p.theme) patch.theme = p.theme;
    /* ENG-05: a preset is a classroom change like any other. */
    saveTouched(patch, t('presetHeading') + ' → ' + id);
    renderSettings();
    if (p.theme) applyTheme(p.theme, true);
    if (SDP.Engine && SDP.Engine.applySettings) SDP.Engine.applySettings();
    setUpdateStatus(t('presetApplied'), 'ok');
  }

  /* ══ Smart Board Classroom Bar (D-UI4, D-UI5, R10)  ══ */
  var boardState = { wordShown: false };
  function boardWordCount() {
    var n = 0;
    try { n = Number(SDP.Sync && SDP.Sync.wordCount ? SDP.Sync.wordCount() : 0) || 0; } catch (e) { n = 0; }
    return n;
  }
  function boardBarShouldShow() {
    /* R10/D-UI4: a projector viewport shows the board bar once a session exists. */
    if (boardWordCount() <= 0) return false;
    if (theme === 'board') return true;
    var vw = Number(global.innerWidth || (doc && doc.documentElement && doc.documentElement.clientWidth) || 0);
    return vw >= 1024;
  }
  function renderBoardBar() {
    var bar = byId('boardClassBar');
    if (!bar) return false;
    var show = boardBarShouldShow();
    if (bar.classList) {
      if (show) bar.classList.add('is-active'); else bar.classList.remove('is-active');
    }
    bar.hidden = !show;
    if (show) renderBoardJumper();
    paintBoardWord();
    return show;
  }
  function renderBoardJumper() {
    var host = byId('boardJumper');
    if (!host) return 0;
    /* D-UI5: 1..N from the live session, never a hardcoded 1..30. */
    var count = boardWordCount();
    var active = -1;
    try { active = Number(SDP.Engine && SDP.Engine.config ? SDP.Engine.config().index : -1); } catch (e) { active = -1; }
    var html = '', i;
    for (i = 0; i < count; i++) {
      html += '<button type="button" class="board-chip" data-board-jump="' + i + '" aria-pressed="' +
        (i === active ? 'true' : 'false') + '">' + (i + 1) + '</button>';
    }
    host.innerHTML = html;
    return count;
  }
  function currentWordText() {
    try {
      if (SDP.Engine && SDP.Engine.current) {
        var c = SDP.Engine.current();
        if (c && c.word) return str(c.word.w || c.word);
      }
    } catch (e) {}
    var idx = 0;
    try { idx = Number(SDP.Engine && SDP.Engine.config ? SDP.Engine.config().index : 0) || 0; } catch (e) { idx = 0; }
    var w = null;
    try { w = SDP.Sync && SDP.Sync.word ? SDP.Sync.word(idx) : null; } catch (e) { w = null; }
    return w ? str(w.w) : '';
  }
  /* R10 — the board NEVER spoils the spelling during dictation by default. */
  function currentBoardWord() {
    var idx = 0;
    try { idx = Number(SDP.Engine && SDP.Engine.config ? SDP.Engine.config().index : 0) || 0; } catch (e) { idx = 0; }
    try { return SDP.Sync && SDP.Sync.word ? (SDP.Sync.word(idx) || null) : null; } catch (e2) { return null; }
  }
  function paintBoardWord() {
    var node = byId('boardWordDisplay');
    if (!node) return false;
    var text = currentWordText();
    node.textContent = boardState.wordShown ? text : '••••••';
    node.setAttribute('data-revealed', boardState.wordShown ? 'true' : 'false');
    var w = currentBoardWord();
    var idx = 0, count = boardWordCount();
    try { idx = Number(SDP.Engine && SDP.Engine.config ? SDP.Engine.config().index : 0) || 0; } catch (e) { idx = 0; }
    setText(byId('boardWordNo'), '#' + (idx + 1) + '/' + count);
    setText(byId('boardIpa'), w && w.p ? '/' + String(w.p).replace(/^\/+|\/+$/g, '') + '/' : '/—/');
    setText(byId('boardPos'), (w && w.pos) || '—');
    setText(byId('boardSi'), (w && w.si) || '—');
    var btn = byId('btnBoardToggleWord');
    if (btn) {
      btn.textContent = boardState.wordShown ? t('boardHideWord') : t('boardShowWord');
      btn.setAttribute('aria-pressed', boardState.wordShown ? 'true' : 'false');
    }
    return true;
  }
  function toggleBoardWord() {
    boardState.wordShown = !boardState.wordShown;
    paintBoardWord();
    return boardState.wordShown;
  }
  function bindBoardBar() {
    var bar = byId('boardClassBar');
    if (!bar || bar._sdpBound) return false;
    bar._sdpBound = true;
    bar.addEventListener('click', function (ev) {
      var node = ev && ev.target;
      while (node && node !== bar && !(node.getAttribute && node.getAttribute('data-board-jump') !== null)) node = node.parentNode;
      if (node && node !== bar) {
        if (ev.preventDefault) ev.preventDefault();
        var jump = Number(node.getAttribute('data-board-jump'));
        if (isFinite(jump)) {
          try { if (SDP.Engine && SDP.Engine.jumpTo) SDP.Engine.jumpTo(jump); } catch (e) {}
          renderBoardJumper();
          paintBoardWord();
        }
        return;
      }
      var t2 = ev && ev.target;
      while (t2 && t2 !== bar && !(t2.id)) t2 = t2.parentNode;
      var id = (t2 && t2 !== bar) ? t2.id : '';
      if (id === 'btnBoardToggleWord') { toggleBoardWord(); return; }
      var engine = SDP.Engine;
      if (!engine) return;
      if (id === 'boardPlayPause') { try { engine.togglePlayPause(); } catch (e) {} }
      else if (id === 'boardRepeat') { try { engine.repeat(); } catch (e) {} }
      else if (id === 'boardNext') { try { engine.next(); } catch (e) {} }
      renderBoardJumper();
      paintBoardWord();
    }, false);
    return true;
  }

  /* ══ Smart Board quick-word jumper (R7 / H5)  ══ */
  function renderQuickJumper() {
    var sel = byId('setQuickWord');
    if (!sel) return;
    /* D-UI5: live word count, never a hardcoded 30. */
    var count = boardWordCount() || 30;
    var i, html = '';
    for (i = 1; i <= count; i++) html += '<option value="' + i + '">' + str(i) + '</option>';
    sel.innerHTML = html;
    if (sel._jqBound) return;
    sel._jqBound = true;
    sel.addEventListener('change', function () {
      var idx = Number(sel.value) - 1;
      if (SDP.Engine && typeof SDP.Engine.jumpTo === 'function') SDP.Engine.jumpTo(idx);
    });
  }

  /* ══ Settings order guard ══ */
  
  function settingsOrder() {
    var host = byId('settingsSections');
    if (!host) return [];
    var sections = host.querySelectorAll('.set-card');
    var order = [];
    for (var i = 0; i < sections.length; i++) order.push(sections[i].id || sections[i].getAttribute('data-section') || 'section');
    return order;
  }

  /* ══ Data toast  ══ */
  
  var toastTimer = null;
  function toastBytes() {
    var meter = global.SDPDataMeter;
    try {
      if (meter && meter.getLive) {
        var live = meter.getLive();
        if (live && live.sessionBytes) return Math.round(live.sessionBytes / 1024);
      }
    } catch (e) {}
    var kb = 0;
    try {
      var session = SDP.Sync.session();
      kb = session ? Math.round(JSON.stringify(session).length / 1024) : 0;
    } catch (e) { kb = 0; }
    return kb;
  }
  function toastText() {
    var offline = false;
    try { offline = SDP.Sync.state.source === 'offline'; } catch (e) {}
    var kb = offline ? 0 : toastBytes();
    return t(offline ? 'toastOffline' : 'toastLoaded') + ' · ' + kb + ' KB';
  }
  function showToast() {
    var node = byId('sdpDataToast');
    if (!node) return;
    node.textContent = toastText();
    node.hidden = false;
    if (node.classList) node.classList.remove('toast-hidden');
    if (toastTimer) global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(function () {
      if (node.classList) node.classList.add('toast-hidden');
      toastTimer = global.setTimeout(function () { node.hidden = true; }, 420);
    }, 2400);
  }

  /* ══ wiring  ══ */
  /* D13: the resume card's secondary route — a clean run from word #1. */
  function startOver() {
    try { SDP.Data.clearSession(); } catch (e) {}
    try { SDP.Engine.start({ mode: settings().mode, fresh: true }); } catch (e) {}
    showTab('player');
    return true;
  }
  /* D9: any human tap on a [data-primary-cta] retires that screen's cue. */
  function bindCueWatcher() {
    if (!doc || !doc.addEventListener || bindCueWatcher._bound) return false;
    bindCueWatcher._bound = true;
    doc.addEventListener('click', function (ev) {
      var node = ev && ev.target;
      while (node && node !== doc && !(node.getAttribute && node.getAttribute('data-primary-cta'))) node = node.parentNode;
      if (!node || node === doc || !node.getAttribute) return;
      markCueSeen(currentTab());
    }, false);
    return true;
  }

  function bindShell() {
    on('btnGuideTop', 'click', openGuide);
    on('btnGuide', 'click', openGuide);
    on('btnGuideClose', 'click', closeGuide);
    on('btnGuideSkipStart', 'click', function () {
      /* R2: ▶ Start Dictation Now — close, stamp, speak the lesson. */
      var mode = guideState.pendingMode || settings().mode;
      closeGuide();
      beginDictation(mode);
    });
    /* Phase 5: the 30-pill map lives in a collapsed bottom drawer. */
    on('pillsDrawerToggle', 'click', function () {
      var drawer = byId('pillsDrawer');
      var toggle = byId('pillsDrawerToggle');
      if (!drawer) return;
      var open = drawer.hidden === true;
      drawer.hidden = !open;
      if (toggle) {
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.textContent = t('pillsDrawer', 'Jump to Word 1–30 ▾');
      }
    });
    on('btnLang', 'click', toggleLang);
    on('guideLangPill', 'click', toggleLang);
    on('btnTheme', 'click', toggleTheme);
    on('btnStart', 'click', function () { markCueSeen('home'); startDictation(); });
    on('btnResume', 'click', resumeDictation);
    on('btnHomeWords', 'click', function () { showTab('dict'); });
    on('btnOpenStudioFromSettings', 'click', function () { openStudio(); });
    on('btnStartOver', 'click', startOver);
    on('btnResumeDraft', 'click', resumeDictation);
    var tabs = ['home', 'player', 'practice', 'dict', 'settings', 'studio'];
    for (var i = 0; i < tabs.length; i++) {
      (function (name) {
        on('tab-' + name, 'click', function () { showTab(name); });
        on('rail-' + name, 'click', function () { showTab(name); });
      })(tabs[i]);
    }
    var modePills = doc.querySelectorAll('#homeModePills [data-mode]');
    for (var m = 0; m < modePills.length; m++) {
      (function (node) {
        if (node._sdpBound) return;
        node._sdpBound = true;
        node.addEventListener('click', function () {
          var mode = str(node.getAttribute('data-mode'));
          try { SDP.Data.saveSettings({ mode: mode }); } catch (e) {}
          applyModePills(mode);
          if (SDP.Engine && SDP.Engine.setMode) SDP.Engine.setMode(mode, true);
        });
      })(modePills[m]);
    }
    var presetPills = doc.querySelectorAll ? doc.querySelectorAll('#presetRow [data-preset]') : [];
    for (var pp = 0; pp < presetPills.length; pp++) {
      (function (node) {
        if (node._sdpBound) return;
        node._sdpBound = true;
        node.addEventListener('click', function () {
          applyPreset(str(node.getAttribute('data-preset')));
        });
      })(presetPills[pp]);
    }
    var quick = doc.querySelectorAll('#homeQuickPractice [data-prac]');
    for (var q = 0; q < quick.length; q++) {
      (function (node) {
        if (node._sdpBound) return;
        node._sdpBound = true;
        node.addEventListener('click', function () { startPractice(str(node.getAttribute('data-prac'))); });
      })(quick[q]);
    }
    /* D-L1: the header studio button mirrors the lock state. */
    var quickBtn = byId('btnStudioQuick');
    if (quickBtn && !quickBtn._sdpBound) {
      quickBtn._sdpBound = true;
      quickBtn.addEventListener('click', function () { openStudio(); }, false);
    }
    var modal = byId('guideModal');
    if (modal && !modal._sdpBound) {
      modal._sdpBound = true;
      modal.addEventListener('click', function (ev) { if (ev && ev.target === modal) closeGuide(); });
    }
    trapGuideKeys();
    bindBoardBar();
    bindWords();
    bindPractice();
    bindSettings();
    bindCueWatcher();
    paintCues();
  }

  /* D-S10/S11 (R7): a teacher publish tells the student, and only the keys… */
  function bindTeacherUpdates() {
    if (bindTeacherUpdates._bound || !doc || !doc.addEventListener) return false;
    bindTeacherUpdates._bound = true;
    doc.addEventListener('sdp:teacher-updated', function (ev) {
      var rev = Number(ev && ev.detail && ev.detail.settingsRev) || 0;
      /* R1: the student is told exactly which revision arrived. */
      showToast(rev ? t('lecturerSyncedToast') + rev + ')' : t('teacherUpdatedToast'));
      renderAll();
    }, false);
    /* D3: every adopted publish repaints — v0.0.1.e emitted 'sdp:update' to nobody. */
    doc.addEventListener('sdp:update', function () {
      renderAll();
      if (SDP.Engine && SDP.Engine.refreshEls) { try { SDP.Engine.refreshEls(); } catch (e) {} }
    }, false);
    /* The same event on window, for harnesses that dispatch on window. */
    if (global.addEventListener) {
      global.addEventListener('sdp:update', function () { renderAll(); }, false);
    }
    /* D16: the 30 s tick and every visibilitychange repaint the badge from the… */
    doc.addEventListener('sdp:sync-status', function (ev) {
      var d = (ev && ev.detail) || {};
      handleSyncCheckResult(d.err, d.result);
    }, false);
    return true;
  }

  /* D6: Studio is a top-level screen; focus the PIN (locked) or the key row. */
  function openStudio() {
    try { showTab('studio'); } catch (e) {}
    try { if (SDP.Studio && SDP.Studio.mount) SDP.Studio.mount(); } catch (e) {}
    var unlocked = false;
    try { unlocked = !!(SDP.Studio && SDP.Studio.isUnlocked && SDP.Studio.isUnlocked()); } catch (e) { unlocked = false; }
    /* v0.0.4.a W3: never call .focus() while the Studio is locked — the mobile
       OS keyboard must never cover #pinPad. Desktop + unlocked still focuses. */
    var isDesktopFine = global.matchMedia && global.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var target = (unlocked && isDesktopFine) ? (byId('elKeyInput') || byId('btnOneClickMasterSetup')) : null;
    if (target && target.focus) { try { target.focus({ preventScroll: true }); } catch (e) {} }
    var acc = byId('studioAccordion');
    if (acc && acc.scrollIntoView) { try { acc.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { try { acc.scrollIntoView(); } catch (e2) {} } }
    try { if (SDP.Studio && SDP.Studio.paintQuickButton) SDP.Studio.paintQuickButton(); } catch (e) {}
    paintCues();
    return true;
  }

  function onDataReady(err) {
    renderHome();
    renderBoardBar();
    renderWords();
    renderPractice();
    renderSettings();
    if (SDP.Engine && SDP.Engine.applySettings) SDP.Engine.applySettings();
    var title = byId('sessionTitle');
    try { if (title && SDP.Sync.sessionTitle()) setText(title, SDP.Sync.sessionTitle()); } catch (e) {}
    try { if (SDP.Speech && SDP.Speech.loadManifest) SDP.Speech.loadManifest(noop); } catch (e) {}
    try { if (SDP.Studio && SDP.Studio.onDataReady) SDP.Studio.onDataReady(); } catch (e) {}
    if (!err && global.__SDP_NO_LIVE__ !== true) {
      /* R8 (F8): the watch tightened from 25 s to 15 s; the honest badge and
         the deferred-adoption queue both ride on this single ticker. */
      try { SDP.Sync.startWatch(15000); } catch (e) {}
    }
    return true;
  }

  function init() {
    if (initialized) return false;
    initialized = true;
    var conf = settings();
    applyTheme(normalizeTheme(conf.theme), true);
    applyLang(conf.lang === 'si' ? 'si' : 'en', true);
    bindShell();
    paintIconHosts();
    bindTeacherUpdates();
    try { if (SDP.Engine && SDP.Engine.bind) SDP.Engine.bind(); } catch (e) {}
    setText(byId('sdpVerPill'), 'v' + APP_VERSION);
    setText(byId('aboutVersion'), APP_VERSION);
    setText(byId('brandName'), 'Smart Dictation');
    renderHome();
    renderWords();
    renderPractice();
    renderGuideSteps();
    renderSettings();
    paintSyncBadge({ state: 'synced', session: str(SDP.Sync && SDP.Sync.sessionNo ? SDP.Sync.sessionNo() : '8') });
    if (!SDP.Data.guideSeen()) openGuide(null, { fromBoot: true });
    showToast();
    try { SDP.Sync.registerSW(); } catch (e) {}
    try {
      SDP.Sync.boot({}, function (err) { onDataReady(err); });
    } catch (e) { onDataReady(e); }
    return true;
  }

  /* v0.0.4.c (GAP 2) — the 56-icon dual-tone bank. Every glyph ships TWO
     paths: .ic-fill (soft solid silhouette, 22% ink) and .ic-stroke (the 1.9px
     line detail). Zero emoji pictographs remain in the DOM; every view, the
     dictation transport and the studio ask this one function for an icon. */
  var ICON_PATHS = {
    play: { f: 'M8 4.5l12 7.5-12 7.5z', s: 'M8 4.5l12 7.5-12 7.5z' },
    pause: { f: 'M6 5h4v14H6zM14 5h4v14h-4z', s: 'M6 5h4v14H6zM14 5h4v14h-4z' },
    stop: { f: 'M6 6h12v12H6z', s: 'M6 6h12v12H6z' },
    prev: { f: 'M6 5h3v14H6zM19 5.5L9 12l10 6.5z', s: 'M6 5h3v14H6zM19 5.5L9 12l10 6.5z' },
    next: { f: 'M18 5h3v14h-3zM5 5.5L15 12 5 18.5z', s: 'M18 5h3v14h-3zM5 5.5L15 12 5 18.5z' },
    replay: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M12 5V2L7 6.5l5 4.5V7a5 5 0 11-5 5H5a7 7 0 107-7z' },
    repeat: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M4 8a4 4 0 014-4h12M20 16a4 4 0 01-4 4H4M16 1l4 3-4 3M8 23l-4-3 4-3' },
    volume: { f: 'M11 5L6 9H2v6h4l5 4z', s: 'M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13' },
    volumeOff: { f: 'M11 5L6 9H2v6h4l5 4z', s: 'M11 5L6 9H2v6h4l5 4zM16 9l5 6M21 9l-5 6' },
    mic: { f: 'M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3z', s: 'M8 11a4 4 0 008 0M12 15v4M9 21h6M7 11a5 5 0 0010 0' },
    bulb: { f: 'M12 3a6 6 0 00-3.6 10.8c.6.5.9 1.2 1 2.2h5.2c.1-1 .4-1.7 1-2.2A6 6 0 0012 3z', s: 'M9.5 16h5M10 19h4M12 2v1M4 5l1 1M20 5l-1 1' },
    check: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M20 6L9 17l-5-5' },
    checkCircle: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M8 12.5l2.8 2.8L16 9.5' },
    close: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M6 6l12 12M18 6L6 18' },
    plus: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M12 5v14M5 12h14' },
    minus: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M5 12h14' },
    home: { f: 'M12 3l9 7.5v10.5H3V10.5z', s: 'M3 10.5L12 3l9 7.5M5 9.5V21h14V9.5' },
    headphones: { f: 'M12 3a8 8 0 018 8v5h-3v-5a5 5 0 00-10 0v5H4v-5a8 8 0 018-8z', s: 'M4 14v-2a8 8 0 0116 0v2M4 14h3v6H4zM17 14h3v6h-3z' },
    sparkles: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 15l.9 2.6 2.1.9-2.1.9L19 22l-.9-2.6-2.1-.9 2.1-.9L19 15z' },
    list: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01' },
    gear: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.8 1.4-1.8 3.1-2.2-.9a7 7 0 0 1-1.7 1L15.2 20h-3.6l-.3-2.5a7 7 0 0 1-1.7-1l-2.2.9-1.8-3.1 1.8-1.4a7 7 0 0 1 0-2l-1.8-1.4 1.8-3.1 2.2.9a7 7 0 0 1 1.7-1L11.6 2.6h3.6l.3 2.5a7 7 0 0 1 1.7 1l2.2-.9 1.8 3.1-1.8 1.4a7 7 0 0 1 0 2z' },
    sliders: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M4 7h10M18 7h2M4 17h4M12 17h8M15 4v6M8 14v6' },
    cap: { f: 'M12 4L1 9l11 5 9-4.1V15h2V9L12 4z', s: 'M12 4L1 9l11 5 9-4.1V15h2V9L12 4zM5 13.5V17c0 1.7 3.1 3 7 3s7-1.3 7-3v-3.5' },
    book: { f: 'M4 4a2 2 0 012-2h13v18H6a2 2 0 00-2 2V4z', s: 'M4 4a2 2 0 012-2h13v18H6a2 2 0 00-2 2V4zM4 20a2 2 0 012-2h13' },
    sun: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1' },
    moon: { f: 'M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z', s: 'M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z' },
    eye: { f: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z', s: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 100-6 3 3 0 000 6z' },
    eyeOff: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A9.8 9.8 0 0 1 12 5c7 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A16.6 16.6 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 4-.8' },
    search: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M11 4a7 7 0 100 14 7 7 0 000-14zM16.5 16.5L21 21' },
    download: { f: 'M5 14v6h14v-6', s: 'M12 3v12M7 11l5 5 5-5M4 20h16' },
    upload: { f: 'M4 4h16v2H4z', s: 'M12 20V8M7 12l5-5 5 5M4 20h16' },
    cloud: { f: 'M7 18h10a4 4 0 000-8 6 6 0 00-11.6 1.6A3.5 3.5 0 006 18z', s: 'M7 18h10a4 4 0 000-8 6 6 0 00-11.6 1.6A3.5 3.5 0 006 18z' },
    cloudOff: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M3 3l18 18M7 18h9M18.5 14.5A4 4 0 0017 7a6 6 0 00-9.3 2.1' },
    sync: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M20 12a8 8 0 01-13.7 5.6M4 12a8 8 0 0113.7-5.6M4 4v5h5M20 20v-5h-5' },
    lock: { f: 'M5 11h14v9H5z', s: 'M8 11V8a4 4 0 018 0v3M5 11h14v9H5z' },
    unlock: { f: 'M5 11h14v9H5z', s: 'M8 11V8a4 4 0 017-2.6M5 11h14v9H5z' },
    key: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M14 4a6 6 0 00-5.6 8.1L3 17.5V21h3.5l1-1v-2h2v-2h2l1.1-1.1A6 6 0 1014 4z' },
    shield: { f: 'M12 2l8 3v6c0 5-3.4 9.2-8 11-4.6-1.8-8-6-8-11V5z', s: 'M12 2l8 3v6c0 5-3.4 9.2-8 11-4.6-1.8-8-6-8-11V5z' },
    user: { f: 'M12 12a4 4 0 100-8 4 4 0 000 8z', s: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0' },
    users: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2 21a7 7 0 0114 0M17 4.5a3.5 3.5 0 010 7M18 14a6 6 0 014 6' },
    edit: { f: 'M4 20l1.5-5L16 4.5 19.5 8 9 18.5z', s: 'M14.5 6L18 9.5M4 20l1.5-5L16 4.5 19.5 8 9 18.5z' },
    trash: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6' },
    save: { f: 'M5 3h11l3 3v15H5z', s: 'M5 3h11l3 3v15H5zM8 3v6h8V3M8 13h8v8H8z' },
    table: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M3 4h18v16H3zM3 9h18M3 14.5h18M9 9v11M15 9v11' },
    chart: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M4 20V6M4 20h16M8 20v-6M13 20v-9M18 20v-4' },
    clock: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M12 7v5l3.5 2M12 3a9 9 0 100 18 9 9 0 000-18z' },
    alert: { f: 'M12 3l10 18H2z', s: 'M12 3l10 18H2zM12 9v5M12 17h.01' },
    info: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 7h.01' },
    star: { f: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z', s: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z' },
    heart: { f: 'M12 20.5S3.5 15 3.5 9.3A4.8 4.8 0 0112 6a4.8 4.8 0 018.5 3.3C20.5 15 12 20.5 12 20.5z', s: 'M12 20.5S3.5 15 3.5 9.3A4.8 4.8 0 0112 6a4.8 4.8 0 018.5 3.3C20.5 15 12 20.5 12 20.5z' },
    mail: { f: 'M3 5h18v14H3z', s: 'M3 5h18v14H3zM3 6l9 7 9-7' },
    github: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M9 19c-4 1.5-4-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 4.5-1.4 4.5-5a4 4 0 00-1.1-2.8 3.7 3.7 0 00-.1-2.8s-1.2-.3-3.9 1.5a9.3 9.3 0 00-5 0C6.2 2.6 5 2.9 5 2.9a3.7 3.7 0 00-.1 2.8A4 4 0 003.8 8.5c0 3.6 1.7 4.7 4.5 5-.6.6-.5 1-.5 2V21' },
    globe: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.4 3.9 5.5 4 9-.1 3.5-1.5 6.6-4 9-2.5-2.4-3.9-5.5-4-9 .1-3.5 1.5-6.6 4-9z' },
    folder: { f: 'M3 6h6l2 2h10v11H3z', s: 'M3 6h6l2 2h10v11H3zM3 9h18' },
    target: { f: 'M12 2a10 10 0 100 20 10 10 0 000-20z', s: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8zM12 11.5a.5.5 0 100 1 .5.5 0 000-1z' },
    keyboard: { f: 'M3 7h18v10H3z', s: 'M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8' }
  };
  function iconNames() {
    var out = [], k;
    for (k in ICON_PATHS) { if (ICON_PATHS.hasOwnProperty(k)) out.push(k); }
    return out;
  }
  function svgIcon(name, size, extraClass) {
    var key = ICON_PATHS[name] ? name : 'sparkles';
    var ic = ICON_PATHS[key];
    var s = Number(size) || 18;
    return '<svg class="sdp-icon sdp-icon-' + esc(key) + (extraClass ? ' ' + esc(extraClass) : '') +
      '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path class="ic-fill" d="' + ic.f + '"/><path class="ic-stroke" d="' + ic.s + '"/></svg>';
  }
  /* Hosts declared in index.html as <span data-icon="name"> are painted once,
     so the shell ships semantic placeholders instead of emoji. */
  function paintIconHosts() {
    if (!doc || !doc.querySelectorAll) return 0;
    var hosts = doc.querySelectorAll('[data-icon]'), i, host, name, painted = 0;
    for (i = 0; i < hosts.length; i++) {
      host = hosts[i];
      name = host.getAttribute('data-icon');
      if (!name || !ICON_PATHS[name]) continue;
      if (host.querySelector && host.querySelector('svg')) continue;
      host.innerHTML = svgIcon(name, Number(host.getAttribute('data-icon-size')) || 18);
      painted += 1;
    }
    return painted;
  }
  var Views = {
    init: init,
    t: t,
    strings: function () { return lang === 'si' ? STRINGS_SI : STRINGS_EN; },
    stringsEn: STRINGS_EN,
    stringsSi: STRINGS_SI,
    lang: function () { return lang; },
    theme: function () { return theme; },
    applyLang: applyLang,
    applyTheme: applyTheme,
    toggleLang: toggleLang,
    toggleTheme: toggleTheme,
    showTab: showTab,
    /* R6: showScreen is the documented alias of the one router (D10). */
    showScreen: showTab,
    currentTab: currentTab,
    pauseForNavigation: pauseForNavigation,
    paintPresetBadge: paintPresetBadge,
    presetLabel: presetLabel,
    renderHome: renderHome,
    renderWords: renderWords,
    renderPractice: renderPractice,
    renderSettings: renderSettings,
    renderAll: renderAll,
    refreshAll: renderAll,
    paintLecturerBar: paintLecturerBar,
    renderGuideSteps: renderGuideSteps,
    settingsOrder: settingsOrder,
    applyModePills: applyModePills,
    startDictation: startDictation,
    resumeDictation: resumeDictation,
    startPractice: startPractice,
    openGuide: openGuide,
    openGuideQuick: openGuideQuick,
    finishQuickGuide: finishQuickGuide,
    beginDictation: beginDictation,
    sessionIntroShown: function () { return !!sessionState.introShown; },
    openStudio: openStudio,
    startOver: startOver,
    paintCues: paintCues,
    cuesSeen: cuesSeen,
    markCueSeen: markCueSeen,
    paintHomeWordsPreview: paintHomeWordsPreview,
    markDictWord: markDictWord,
    paintLecturerBanner: paintLecturerBanner,
    renderBoardBar: renderBoardBar,
    renderBoardJumper: renderBoardJumper,
    toggleBoardWord: toggleBoardWord,
    paintBoardWord: paintBoardWord,
    closeGuide: closeGuide,
    speakGuide: speakGuide,
    startGuideNarration: startGuideNarration,
    showGuideTapBanner: showGuideTapBanner,
    hideGuideTapBanner: hideGuideTapBanner,
    showGuideAutoplayBanner: showGuideAutoplayBanner,
    hideGuideAutoplayBanner: hideGuideAutoplayBanner,
    guideAutoplayBannerVisible: guideAutoplayBannerVisible,
    armGuideAutoplayWatch: armGuideAutoplayWatch,
    showToast: showToast,
    toastText: toastText,
    checkForUpdate: checkForUpdate,
    setUpdateStatus: setUpdateStatus,
    onDataReady: onDataReady
  };
  SDP.Views = Views;
  Views.Icons = { icon: svgIcon, names: iconNames, count: function () { return iconNames().length; }, paint: paintIconHosts };
  SDP.Icons = Views.Icons;
  SDP.STRINGS_EN = STRINGS_EN;
  SDP.STRINGS_SI = STRINGS_SI;

  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { init(); });
    else init();
  }
})(typeof window !== 'undefined' ? window : this);
