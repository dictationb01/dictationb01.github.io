/* data/sdp-audio-normalize.js — v0.0.6.v
 * The client-side broadcast normalizer (strict ES5). Exposed as
 * window.SDP.AudioNormalize. BS.1770-4 integrated loudness with 400 ms
 * blocks, 75% overlap (100 ms hop) and two-stage gating (-70 LUFS absolute,
 * -10 dB relative), RBJ biquad filters with mandatory /a0 normalization,
 * and a PCM WAV encoder — so every words.* / num.* take a lecturer
 * synthesizes lands at the SAME -21.0 LUFS / +2.5 dB @ 3 kHz presence as
 * the committed cmd.complete reference (the _intro_male_* briefing beats
 * are NEVER passed through this module).
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R-AUDIO-NORM (v0.0.6.v). */
(function (global) {
  'use strict';

  var SDP = global.SDP = global.SDP || {};

  /* RBJ Audio EQ Cookbook coefficient generators. CRITICAL FILTER MATH:
     b0, b1, b2, a1, a2 are ALL divided by a0 before use. */
  function highShelf(fs, f0, gainDb, q) {
    var A = Math.pow(10, gainDb / 40);
    var w0 = 2 * Math.PI * f0 / fs;
    var cw = Math.cos(w0), sw = Math.sin(w0);
    var alpha = sw / (2 * q);
    var twoSqrtAalpha = 2 * Math.sqrt(A) * alpha;
    var a0 = A + 1 - (A - 1) * cw + twoSqrtAalpha;
    return {
      b0: (A * (A + 1 + (A - 1) * cw + twoSqrtAalpha)) / a0,
      b1: (-2 * A * (A - 1 + (A + 1) * cw)) / a0,
      b2: (A * (A + 1 + (A - 1) * cw - twoSqrtAalpha)) / a0,
      a1: (2 * (A - 1 - (A + 1) * cw)) / a0,
      a2: (A + 1 - (A - 1) * cw - twoSqrtAalpha) / a0
    };
  }

  function highPass(fs, f0, q) {
    var w0 = 2 * Math.PI * f0 / fs;
    var cw = Math.cos(w0), sw = Math.sin(w0);
    var alpha = sw / (2 * q);
    var a0 = 1 + alpha;
    return {
      b0: ((1 + cw) / 2) / a0,
      b1: (-(1 + cw)) / a0,
      b2: ((1 + cw) / 2) / a0,
      a1: (-2 * cw) / a0,
      a2: (1 - alpha) / a0
    };
  }

  function peaking(fs, f0, gainDb, q) {
    var A = Math.pow(10, gainDb / 40);
    var w0 = 2 * Math.PI * f0 / fs;
    var cw = Math.cos(w0), sw = Math.sin(w0);
    var alpha = sw / (2 * q);
    var a0 = 1 + alpha / A;
    return {
      b0: (1 + alpha * A) / a0,
      b1: (-2 * cw) / a0,
      b2: (1 - alpha * A) / a0,
      a1: (-2 * cw) / a0,
      a2: (1 - alpha / A) / a0
    };
  }

  function biquad(samples, coef) {
    var x1 = 0, x2 = 0, y1 = 0, y2 = 0, i, x, y;
    for (i = 0; i < samples.length; i++) {
      x = samples[i];
      y = coef.b0 * x + coef.b1 * x1 + coef.b2 * x2 - coef.a1 * y1 - coef.a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      samples[i] = y;
    }
    return samples;
  }

  /* BS.1770-4 integrated loudness: 400 ms blocks with 75% overlap (100 ms
     hop), K-weighted (high-shelf +4 dB @ 1500 Hz, then high-pass 38 Hz),
     two-stage gating: absolute -70 LUFS, then -10 dB relative. */
  function measureLoudness(samples, fs) {
    if (!samples || !samples.length || !fs) return -70;
    var shelf = highShelf(fs, 1500, 4, 0.7071);
    var hp = highPass(fs, 38, 0.7071);
    var k = biquad(samples.slice(0), hp);
    k = biquad(k, shelf);
    var blockSize = Math.floor(fs * 0.4);
    var hop = Math.floor(fs * 0.1);
    if (blockSize < 1 || k.length < blockSize) {
      var mean = 0, i0;
      for (i0 = 0; i0 < k.length; i0++) mean += k[i0] * k[i0];
      mean = mean / Math.max(1, k.length);
      if (mean <= 0) return -70;
      return -0.691 + 10 * Math.log10(mean);
    }
    var blocks = [], i;
    for (i = 0; i + blockSize <= k.length; i += hop) {
      var z = 0, j;
      for (j = 0; j < blockSize; j++) z += k[i + j] * k[i + j];
      blocks.push(z / blockSize);
    }
    var n = blocks.length, sum = 0, cnt = 0, loud = [];
    for (i = 0; i < n; i++) {
      if (blocks[i] <= 0) continue;
      var l = -0.691 + 10 * Math.log10(blocks[i]);
      loud.push(l);
      if (l > -70) { sum += blocks[i]; cnt += 1; }
    }
    if (!cnt) return -70;
    var rel = -0.691 + 10 * Math.log10(sum / cnt) - 10;
    sum = 0; cnt = 0;
    for (i = 0; i < n; i++) {
      var lb = -70;
      if (blocks[i] > 0) lb = -0.691 + 10 * Math.log10(blocks[i]);
      if (lb > rel) { sum += blocks[i]; cnt += 1; }
    }
    if (!cnt) return -70;
    return -0.691 + 10 * Math.log10(sum / cnt);
  }

  function truePeakDb(samples) {
    var peak = 0, i;
    for (i = 0; i < samples.length; i++) {
      var a = Math.abs(samples[i]);
      if (a > peak) peak = a;
    }
    if (peak <= 0) return -99;
    return 20 * Math.log10(peak);
  }

  /* Convert a decoded AudioBuffer (any channel count) to mono Float32. */
  function bufferToMono(audioBuffer) {
    var ch = audioBuffer.numberOfChannels || 1;
    var len = audioBuffer.length;
    var mono = new Float32Array(len);
    var c, i;
    for (c = 0; c < ch; c++) {
      var data = audioBuffer.getChannelData(c);
      for (i = 0; i < len; i++) mono[i] += data[i] / ch;
    }
    return mono;
  }

  /* Encode Float32 mono PCM into a 16-bit WAV ArrayBuffer. */
  function encodeWav(samples, fs) {
    var n = samples.length;
    var buf = new ArrayBuffer(44 + n * 2);
    var v = new DataView(buf);
    function str(off, s) {
      var i;
      for (i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
    }
    str(0, 'RIFF');
    v.setUint32(4, 36 + n * 2, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, fs, true);
    v.setUint32(28, fs * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    str(36, 'data');
    v.setUint32(40, n * 2, true);
    var i, s;
    for (i = 0; i < n; i++) {
      s = samples[i];
      if (s > 1) s = 1; else if (s < -1) s = -1;
      v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buf;
  }

  /* Strict-ES5 hex helper (NO .padStart): ('0' + n.toString(16)).slice(-2) */
  function hex2(n) { return ('0' + n.toString(16)).slice(-2); }

  var DEFAULT_SIGNATURE = {
    voiceId: 'Xb7hH8MSUJpSbSDYk0k2',
    voiceName: 'Alice',
    modelId: 'eleven_flash_v2_5',
    lufsTarget: -21,
    truePeakMax: -1.0,
    presenceShelfHz: 3000,
    presenceGainDb: 2.5,
    highShelfHz: 1500,
    highShelfGainDb: 4,
    highPassHz: 38
  };

  /* Normalize raw PCM samples in place: presence shelf -> linear gain to the
   * signature target -> soft-limit at truePeakMax. Returns the samples. */
  function normalizeSamples(samples, fs, signature) {
    var sig = signature || DEFAULT_SIGNATURE;
    var presence = peaking(fs, sig.presenceShelfHz || 3000, sig.presenceGainDb || 2.5, 0.9);
    biquad(samples, presence);
    var current = measureLoudness(samples.slice(0), fs);
    var target = typeof sig.lufsTarget === 'number' ? sig.lufsTarget : -21;
    var gain = Math.pow(10, (target - current) / 20);
    var i;
    for (i = 0; i < samples.length; i++) samples[i] *= gain;
    /* Soft-limit at truePeakMax (default -1.0 dBTP) with a tanh knee. */
    var ceil = Math.pow(10, (typeof sig.truePeakMax === 'number' ? sig.truePeakMax : -1.0) / 20);
    for (i = 0; i < samples.length; i++) {
      var a = Math.abs(samples[i]);
      if (a > ceil) samples[i] = Math.sign(samples[i]) * (ceil + (1 - ceil) * Math.tanh((a - ceil) / (1 - ceil)));
    }
    return samples;
  }

  /* measureBuffer(arrayBuffer, cb) — decode + integrated loudness. */
  function measureBuffer(arrayBuffer, cb) {
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC || !cb) { cb(new Error('no_audio_context'), null); return false; }
    try {
      var ctx = new AC();
      ctx.decodeAudioData(arrayBuffer, function (buf) {
        try {
          var mono = bufferToMono(buf);
          var lufs = measureLoudness(mono, buf.sampleRate);
          cb(null, { lufs: Math.round(lufs * 10) / 10, truePeakDb: Math.round(truePeakDb(mono) * 10) / 10, sampleRate: buf.sampleRate, duration: buf.duration });
        } catch (e) { cb(e, null); }
        try { ctx.close(); } catch (e2) {}
      }, function (e) { try { ctx.close(); } catch (e2) {} cb(e || new Error('decode_failed'), null); });
    } catch (e) { cb(e, null); return false; }
    return true;
  }

  /* normalizeTake(arrayBuffer, signature, cb) — decode -> normalize ->
   * PCM WAV ArrayBuffer (cb(err, wavArrayBuffer, measured)). */
  function normalizeTake(arrayBuffer, signature, cb) {
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC || typeof cb !== 'function') { cb(new Error('no_audio_context'), null, null); return false; }
    try {
      var ctx = new AC();
      ctx.decodeAudioData(arrayBuffer, function (buf) {
        try {
          var fs = buf.sampleRate;
          var mono = bufferToMono(buf);
          var before = measureLoudness(mono.slice(0), fs);
          var out = normalizeSamples(mono, fs, signature);
          var after = measureLoudness(out.slice(0), fs);
          var tp = truePeakDb(out);
          var wav = encodeWav(out, fs);
          try { ctx.close(); } catch (e2) {}
          cb(null, wav, { lufsBefore: Math.round(before * 10) / 10, lufsAfter: Math.round(after * 10) / 10, truePeakDb: Math.round(tp * 10) / 10, sampleRate: fs });
        } catch (e) { try { ctx.close(); } catch (e2) {} cb(e, null, null); }
      }, function (e) { try { ctx.close(); } catch (e2) {} cb(e || new Error('decode_failed'), null, null); });
    } catch (e) { cb(e, null, null); return false; }
    return true;
  }

  SDP.AudioNormalize = {
    version: '1.0.0',
    highShelf: highShelf,
    highPass: highPass,
    peaking: peaking,
    biquad: biquad,
    measureLoudness: measureLoudness,
    measureBuffer: measureBuffer,
    normalizeSamples: normalizeSamples,
    normalizeTake: normalizeTake,
    encodeWav: encodeWav,
    bufferToMono: bufferToMono,
    hex2: hex2,
    defaultSignature: function () { return JSON.parse(JSON.stringify(DEFAULT_SIGNATURE)); }
  };
})(typeof window !== 'undefined' ? window : this);
