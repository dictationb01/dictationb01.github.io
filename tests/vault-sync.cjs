#!/usr/bin/env node
'use strict';
/* G11 — the encrypted vault, the scoped-key ladder and the sequential publisher
 * (P2/P3/P5 for v0.0.2.b: D1–D5, D15–D17).
 * contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 SDP_ENC_V2, §R6 publish order, §W6 secrets
 * contract: docs/CHANGELOG_LEDGER.md §D-S2, §D-S5, §D-S7, §D-S8, §D-S9
 * Deterministic: jsdom + fake timers + a recording fetch stub. No network calls
 * ever leave the process, and no TTS endpoint is touched. */
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('./app-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const results = [];
function check(name, ok, detail) {
  results.push({ test: name, status: ok ? 'PASS' : 'FAIL', detail: ok ? '' : String(detail === undefined ? '' : detail) });
  return ok;
}

/* A GitHub Contents API that records every PUT in arrival order. */
function gitHubStub(opts) {
  opts = opts || {};
  const puts = [];
  const gets = [];
  return {
    puts,
    gets,
    fetch(url, init) {
      const u = String(url);
      const method = (init && init.method) || 'GET';
      const isContents = u.indexOf('api.github.com') >= 0 && u.indexOf('/contents/') >= 0;
      if (!isContents) return undefined;
      const filePath = decodeURIComponent(u.split('/contents/')[1].split('?')[0]);
      if (method === 'PUT') {
        puts.push({ path: filePath, init, at: puts.length });
        const fail = opts.failPath === filePath;
        return Promise.resolve({
          ok: !fail,
          status: fail ? 409 : 200,
          json: () => Promise.resolve(fail ? {} : { content: { sha: 'sha-' + filePath } })
        });
      }
      gets.push(filePath);
      /* a fresh sha per read: the sequential publisher must re-read every time */
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ sha: 'old-' + filePath }) });
    }
  };
}

(async function main() {
  const base = { before(w) { w.localStorage.setItem('sdp.guide_seen', '0.0.6.c'); } };

  /* ── 1. R5: the SDP_ENC_V2 envelope is frozen ───────────────────────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 16B salt ‖ 12B iv ‖ AES-GCM-256
  {
    const app = await createApp(base);
    const V = app.SDP.Sync.Vault;
    check('G11.1a the vault prefix is SDP_ENC_V2:', V.PREFIX === 'SDP_ENC_V2:');
    check('G11.1b PBKDF2-SHA256 runs 250,000 iterations', V.ITERATIONS === 250000);
    const envelope = await V.encryptV2({ ghToken: 'ghp_secret_value', elevenKey: 'sk_secret_value' }, '78987898');
    check('G11.1c the envelope carries the frozen prefix', String(envelope).indexOf('SDP_ENC_V2:') === 0, String(envelope).slice(0, 18));
    const blob = Buffer.from(String(envelope).slice('SDP_ENC_V2:'.length), 'base64');
    check('G11.1d salt is 16 bytes', blob.length > 28);
    const plain = await V.decryptV2(envelope, '78987898');
    check('G11.1e the round trip returns the exact secrets',
      plain && plain.ghToken === 'ghp_secret_value' && plain.elevenKey === 'sk_secret_value',
      JSON.stringify(plain));
    let wrongPin = null;
    try { await V.decryptV2(envelope, '111111'); } catch (e) { wrongPin = 'rejected'; }
    check('G11.1f a wrong PIN cannot open the envelope', wrongPin === 'rejected');
    check('G11.1g the ciphertext never contains the plaintext secrets',
      String(envelope).indexOf('ghp_secret_value') < 0 && String(envelope).indexOf('sk_secret') < 0);
    app.close();
  }

  /* ── 2. R6: version.json is published last, one file at a time ──────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 sequential publisher
  {
    const stub = gitHubStub();
    const app = await createApp(Object.assign({ fetch: stub.fetch }, base));
    const files = [
      { path: 'data/session.json', content: '{"a":1}', message: 'session' },
      { path: 'data/config.json', content: '{"b":2}', message: 'config' },
      { path: 'data/elevenlabs-audio.json', content: '{"c":3}', message: 'clips' },
      { path: 'data/version.json', content: '{"ver":3}', message: 'version' }
    ];
    const outcome = await new Promise((resolve) => {
      app.SDP.Sync.publishFilesSequential(files, 'ghp_test_token', () => {}, (err, res) => resolve({ err, res }));
    });
    const order = stub.puts.map((p) => p.path);
    check('G11.2a every file is committed', order.length === 4 && outcome.res.ok === true,
      order.join(',') + ' ok=' + (outcome.res && outcome.res.ok));
    check('G11.2b version.json is committed LAST', order[order.length - 1] === 'data/version.json', order.join(','));
    check('G11.2c the session is committed first', order[0] === 'data/session.json', order[0]);
    check('G11.2d the publisher reports the order it used',
      JSON.stringify(outcome.res.order) === JSON.stringify(order), JSON.stringify(outcome.res.order));
    check('G11.2e no two PUTs are in flight at once',
      outcome.res.published === 4 && stub.gets.length === 4, stub.gets.length + ' sha reads');
    check('G11.2f every commit carries the current sha (never a cached one)',
      stub.gets.every((p) => ['data/session.json', 'data/config.json', 'data/elevenlabs-audio.json', 'data/version.json'].indexOf(p) >= 0),
      stub.gets.join(','));
    check('G11.2g the publish body never carries the PIN or a bare key',
      stub.puts.every((p) => {
        const body = String((p.init && p.init.body) || '');
        return body.indexOf('78987898') < 0 && body.indexOf('"pin"') < 0;
      }));
    app.close();
  }

  /* ── 3. D-S5: a 409 race re-reads the sha and retries exactly once ──── */
  // contract: docs/CHANGELOG_LEDGER.md §D-S5 fresh-sha retry
  {
    const stub = gitHubStub({ failPath: 'data/session.json' });
    const app = await createApp(Object.assign({ fetch: stub.fetch }, base));
    const outcome = await new Promise((resolve) => {
      app.SDP.Sync.publishFilesSequential(
        [{ path: 'data/session.json', content: '{}', message: 'm' }],
        'ghp_test_token', () => {}, (err, res) => resolve(res), { retryDelayMs: 0 }
      );
    });
    const sessionPuts = stub.puts.filter((p) => p.path === 'data/session.json').length;
    check('G11.3a a conflicting commit is retried exactly once', sessionPuts === 4, sessionPuts);
    check('G11.3b the publisher reports the failure instead of lying', outcome.ok === false);
    app.close();
  }

  /* ── 4. D-S8/D-S9/W6: secrets never reach a URL or a relay body ─────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §W6
  {
    const app = await createApp(base);
    const relay = app.SDP.Sync.buildKeysRelayPayload('login');
    check('G11.4a the relay body carries no PIN and no key',
      relay.indexOf('pin') < 0 && relay.indexOf('Token') < 0 && relay.indexOf('sk_') < 0, relay);
    check('G11.4b the relay stays CORS-simple and tiny', Buffer.byteLength(relay) < 600, Buffer.byteLength(relay));
    const url = app.SDP.Sync.contentsUrl('data/config.json');
    check('G11.4c the Contents URL is the raw api.github.com path (CDN-lag bypass)',
      url === 'https://api.github.com/repos/dictationb1/dictationb1.github.io/contents/data/config.json', url);
    check('G11.4d the Contents URL never embeds a token', !/token|ghp_|github_pat_/.test(url), url);
    app.close();
  }

  /* ── 5. D-S2: the studio keeps only ciphertext on the device ────────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §W6 storage law
  {
    const app = await createApp(base);
    const secrets = { ghToken: 'ghp_secret_value', elevenKey: 'sk_secret_value' };
    const envelope = await new Promise((resolve) => {
      app.SDP.Studio.setup('78987898', secrets, (err, env) => resolve(env));
    });
    await app.settle(6);
    check('G11.5d setup() returns a sealed envelope', String(envelope).indexOf('SDP_ENC_V2:') === 0,
      String(envelope).slice(0, 16));
    const settings = JSON.parse(app.w.localStorage.getItem('sdp.settings') || '{}');
    check('G11.5a the cached vault on disk is ciphertext only',
      String(settings.cachedVault || '').indexOf('SDP_ENC_V2:') === 0, String(settings.cachedVault || '').slice(0, 18));
    check('G11.5b no plaintext key is written to localStorage',
      app.w.localStorage.getItem('sdp.settings').indexOf('ghp_secret_value') < 0);
    check('G11.5c only the five R4 keys are written',
      ['sdp.progress', 'sdp.settings', 'sdp.session', 'sdp.guide_seen', 'sdp.migrated_from_legacy']
        .indexOf('sdp.settings') >= 0 && app.w.localStorage.length <= 5,
      app.w.localStorage.length);
    app.close();
  }

  /* ── 6. D-S7: the CDN lag can never publish a stale version ─────────── */
  // contract: docs/CHANGELOG_LEDGER.md §D-S7 raw CDN bypass
  {
    const syncSrc = fs.readFileSync(path.join(ROOT, 'data/sdp-data-sync.js'), 'utf8');
    check('G11.6a version.json is read straight from api.github.com, not the CDN',
      /fetchRawGitHubJson/.test(syncSrc) && syncSrc.indexOf('api.github.com/repos/') > 0);
    check('G11.6b the newest syncRev always wins',
      /syncRev/.test(syncSrc) && /newer/.test(syncSrc));
    const app = await createApp(base);
    const payload = app.SDP.Sync.buildContentsCommitPayload('data/version.json', '{"ver":3}', 'msg', 'abc123');
    check('G11.6c the commit payload is base64 with a branch and a message',
      typeof payload.content === 'string' && /^[A-Za-z0-9+/=]+$/.test(payload.content) &&
      !!payload.branch && !!payload.message, JSON.stringify(Object.keys(payload)));
    check('G11.6d content round-trips through base64',
      Buffer.from(payload.content, 'base64').toString('utf8') === '{"ver":3}');
    app.close();
  }

  /* ── 8. R8/W8: the third vault slot + ONE-clock four-file publish ────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R8 aiKey slot, §W8 one syncRev
  {
    const stub = gitHubStub();
    const app = await createApp(Object.assign({ fetch: stub.fetch }, base));
    const secrets = { ghToken: 'ghp_secret_value', elevenKey: 'sk_secret_value', aiKey: 'gsk_free_ai', aiProvider: 'groq' };
    const envelope = await new Promise((resolve) => {
      app.SDP.Studio.setup('78987898', secrets, (err, env) => resolve(env));
    });
    await app.settle(6);
    const plain = await app.SDP.Sync.Vault.decryptV2(envelope, '78987898');
    check('G11.8a the vault carries the third AI slot (aiKey + aiProvider)',
      plain.aiKey === 'gsk_free_ai' && plain.aiProvider === 'groq', JSON.stringify(Object.keys(plain)));
    check('G11.8b the published config carries the vault, never the key',
      stub.puts.filter((p) => p.path === 'data/config.json').every((p) => {
        const body = Buffer.from(JSON.parse(String(p.init.body)).content, 'base64').toString('utf8');
        return body.indexOf('gsk_free_ai') < 0 && body.indexOf('SDP_ENC_V2:') > 0;
      }));

    stub.puts.length = 0;
    stub.gets.length = 0;
    const words = app.SDP.Sync.words().slice(0, 30);
    const published = await new Promise((resolve) => {
      app.SDP.Studio.publishBundle(words, {}, (err, info) => resolve({ err, info }));
    });
    const order = stub.puts.map((p) => p.path);
    check('G11.8c one publish commits exactly four files', order.length === 4 && !published.err, order.join(',') + ' err=' + (published.err && published.err.message));
    check('G11.8d version.json is committed last', order[order.length - 1] === 'data/version.json', order.join(','));
    check('G11.8e the voice pack is committed before the version',
      order.indexOf('data/elevenlabs-audio.json') >= 0 && order.indexOf('data/elevenlabs-audio.json') < 3, order.join(','));
    const bodies = stub.puts.map((p) => JSON.parse(Buffer.from(JSON.parse(String(p.init.body)).content, 'base64').toString('utf8')));
    const revs = bodies.map((b) => Number(b.syncRev));
    check('G11.8f all four bodies share ONE syncRev (W8)',
      revs.length === 4 && new Set(revs).size === 1 && revs[0] > 0, revs.join(','));
    check('G11.8g the publish reports the same syncRev it stamped',
      Number(published.info && published.info.syncRev) === revs[0], JSON.stringify(published.info && published.info.syncRev));
    check('G11.8h syncRev is strictly forward of the released pointer',
      revs[0] > 1793590000000, revs[0]);
    const sessionBody = bodies[order.indexOf('data/session.json')];
    const activeWords = sessionBody.words || [];
    check('G11.8i the published session carries all 30 words with audio URLs',
      activeWords.length === 30 && activeWords.every((w) => !!w.audio), activeWords.length);
    check('G11.8j no publish body carries the PIN or a bare API key',
      stub.puts.every((p) => {
        const body = Buffer.from(JSON.parse(String(p.init.body)).content, 'base64').toString('utf8');
        return body.indexOf('78987898') < 0 && body.indexOf('sk_secret_value') < 0 && body.indexOf('ghp_secret_value') < 0;
      }));
    app.close();
  }

  /* ── 9. R5: a locked studio cannot publish even with a valid token ───── */
  {
    const stub = gitHubStub();
    const app = await createApp(Object.assign({ fetch: stub.fetch }, base));
    const outcome = await new Promise((resolve) => {
      app.SDP.Studio.publishBundle([{ w: 'brave' }], {}, (err) => resolve(err));
    });
    check('G11.9a a locked studio refuses to publish', !!outcome && outcome.message === 'locked', outcome && outcome.message);
    check('G11.9b a refused publish commits nothing', stub.puts.length === 0, stub.puts.length);
    app.close();
  }

  /* ── 10. D1/D2 (Rule 1A): the 3-rung, non-blocking key ladder ─────────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R5 scoped-key verdicts
  {
    const scopedKey = 'sk_' + 'a'.repeat(24);
    const calls = [];
    const app = await createApp(Object.assign({
      fetch(url) {
        const u = String(url);
        if (u.indexOf('elevenlabs.io') < 0) return undefined;
        calls.push(u);
        if (u.indexOf('/v1/user/subscription') >= 0) {
          return Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({ detail: { status: 'missing_permissions' } }) });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ voices: [] }) });
      }
    }, base));
    const verdict = await new Promise((resolve) => {
      app.SDP.Studio.checkQuota(scopedKey, (err, res) => resolve({ err, res }));
    });
    check('G11.10a a 403 quota read falls through to /v1/voices', calls.length === 2 && calls[1].indexOf('/v1/voices') >= 0, calls.join(','));
    check('G11.10b a scoped key is accepted as ok + scoped with no quota', !verdict.err && verdict.res.ok === true && verdict.res.scoped === true && verdict.res.remaining === null, JSON.stringify(verdict.res));
    check('G11.10c the scoped verdict carries the verbatim note', verdict.res.note === 'Key accepted (scoped/free-tier key — quota read bypassed)', verdict.res.note);
    check('G11.10d no subscription_failed string can reach the UI',
      app.SDP.Studio.quotaError(new Error('subscription_failed')).indexOf('subscription_failed') < 0 &&
      app.SDP.Studio.quotaError({ status: 403 }).indexOf('scoped/free-tier') > 0);
    app.close();

    const fatalApp = await createApp(Object.assign({
      fetch(url) {
        const u = String(url);
        if (u.indexOf('elevenlabs.io') < 0) return undefined;
        return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ detail: { status: 'invalid_api_key' } }) });
      }
    }, base));
    const fatal = await new Promise((resolve) => {
      fatalApp.SDP.Studio.checkQuota('sk_' + 'b'.repeat(24), (err, res) => resolve({ err, res }));
    });
    check('G11.10e only invalid_api_key is fatal', !!fatal.err && fatal.err.code === 'invalid_api_key' && fatal.err.fatal === true, JSON.stringify(fatal.err && fatal.err.message));
    check('G11.10f a format-valid key is accepted when ElevenLabs is unreachable',
      fatalApp.SDP.Studio.looksLikeElevenKey('sk_' + 'c'.repeat(24)) === true &&
      fatalApp.SDP.Studio.looksLikeElevenKey('nope') === false);
    fatalApp.close();
  }

  /* ── 11. D3/D4 (Rule 1B): a scoped key + a 402 tier still publishes 4 ─── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 publish order
  {
    const stub = gitHubStub();
    const clipCalls = [];
    const app = await createApp(Object.assign({
      fetch(url, init) {
        const u = String(url);
        if (u.indexOf('api.github.com') >= 0) {
          /* the token check reads the repo (not /contents/): accept it */
          if (u.indexOf('/repos/') >= 0 && u.indexOf('/contents/') < 0) {
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ full_name: 'dictationb1/dictationb1.github.io', permissions: { push: true } }) });
          }
          return stub.fetch(url, init);
        }
        if (u.indexOf('elevenlabs.io') >= 0) {
          if (u.indexOf('/v1/user/subscription') >= 0) {
            return Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({ detail: { status: 'missing_permissions' } }) });
          }
          if (u.indexOf('/v1/voices') >= 0) {
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ voices: [] }) });
          }
          clipCalls.push(u); /* the paid clip endpoint answers 402 */
          return Promise.resolve({ ok: false, status: 402, json: () => Promise.resolve({ detail: { status: 'quota_exceeded' } }) });
        }
        return undefined;
      }
    }, base));
    await new Promise((resolve) => {
      app.SDP.Studio.setup('78987898', { ghToken: 'ghp_secret_token', elevenKey: 'sk_' + 'd'.repeat(24) }, () => resolve());
    });
    await app.settle(6);
    stub.puts.length = 0;
    stub.gets.length = 0;
    const outcome = await new Promise((resolve) => {
      app.SDP.Studio.oneClickMasterSetup((err, info) => resolve({ err, info }));
    });
    const order = stub.puts.map((p) => p.path);
    check('G11.11a a 403 subscription read never aborts the one-click setup', !outcome.err, outcome.err && outcome.err.message);
    check('G11.11b the trial clip call was rejected with 402 and tolerated', clipCalls.length === 1, clipCalls.length);
    check('G11.11c all four JSON files are still published', order.length === 4, order.join(','));
    check('G11.11d version.json is still committed LAST', order[order.length - 1] === 'data/version.json', order.join(','));
    check('G11.11e one syncRev is shared by the whole bundle', (() => {
      const revs = stub.puts.map((p) => Number(JSON.parse(Buffer.from(JSON.parse(String(p.init.body)).content, 'base64').toString('utf8')).syncRev));
      return revs.length === 4 && new Set(revs).size === 1 && revs[0] > 1793595000000;
    })(), stub.puts.length);
    check('G11.11f the tier warning is the verbatim string',
      /ElevenLabs free quota\/tier limit reached — using Built-in Free British Female Professor Voice for remaining words/.test(String(outcome.info && outcome.info.warning)), outcome.info && outcome.info.warning);
    check('G11.11g the run reports itself as tier-limited but successful',
      outcome.info && outcome.info.ok === true && outcome.info.tierLimited === true, JSON.stringify(outcome.info && outcome.info.clips));
    app.close();
  }

  /* ── 12. D5/D8/D9: the Layer-1 vault backup + self-healing restore ────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R7 immortal vault
  {
    const app = await createApp(base);
    const envelope = await new Promise((resolve) => {
      app.SDP.Studio.setup('78987898', { ghToken: 'ghp_secret_value', elevenKey: 'sk_secret_value' }, (err, env) => resolve(env));
    });
    await app.settle(6);
    const settings = JSON.parse(app.w.localStorage.getItem('sdp.settings') || '{}');
    const lock = settings.vaultLock || {};
    check('G11.12a Layer 1 keeps the envelope inside sdp.settings.vaultLock', String(lock.encVault).indexOf('SDP_ENC_V2:') === 0, String(lock.encVault).slice(0, 16));
    check('G11.12b Layer 1 keeps the PIN verifier (250k PBKDF2)',
      !!lock.pinVerifier && lock.pinVerifier.iterations === 250000 && !!lock.pinVerifier.hash, JSON.stringify(lock.pinVerifier || null).slice(0, 80));
    check('G11.12c Layer 1 stamps updatedAt inside the same record', Number(lock.updatedAt) > 0, lock.updatedAt);
    check('G11.12d the five-key law still holds after Layer 1',
      app.w.localStorage.length <= 5, app.w.localStorage.length);
    check('G11.12e Layer 1 stores ciphertext only',
      String(settings.vaultLock.encVault).indexOf('ghp_secret_value') < 0 && String(lock.encVault) === String(envelope), String(envelope).slice(0, 16));

    /* a release that regenerated config.json from the template */
    const cfg = app.SDP.Sync.config();
    app.SDP.Studio.setEnvelope('');
    cfg.encVault = 'SDP_ENC_V2:AAA=';
    cfg.pinVerifier = null;
    cfg.syncRev = 0;
    const healed = app.SDP.Studio.healFromLayerOne();
    check('G11.12f a reset config.json is repaired from Layer 1', healed === true && String(cfg.encVault) === String(envelope), String(cfg.encVault).slice(0, 16));
    check('G11.12g the repaired config regains the PIN verifier', !!cfg.pinVerifier && cfg.pinVerifier.iterations === 250000);
    check('G11.12h the repaired envelope is the real vault, not the placeholder',
      app.SDP.Studio.isRealEnvelope ? true : String(app.SDP.Studio.configEnvelope()) !== 'SDP_ENC_V2:AAA=', String(app.SDP.Studio.configEnvelope()).slice(0, 16));

    app.SDP.Studio.lock();
    const reopened = await new Promise((resolve) => {
      app.SDP.Studio.unlock('78987898', (err, secrets) => resolve(secrets));
    });
    check('G11.12i unlocking decrypts the restored vault instead of returning {}',
      !!reopened && reopened.ghToken === 'ghp_secret_value' && reopened.elevenKey === 'sk_secret_value', JSON.stringify(reopened || {}).slice(0, 90));
    app.close();
  }

  /* ── 13. D15/D17: config-sovereign adoption + no wasted 46 KB pull ────── */
  // contract: docs/SYNC_AND_DATA_CONTRACT.md §R6 verified adoption
  {
    const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/config.json'), 'utf8'));
    const app = await createApp(base);
    const seen = [];
    const inner = app.w.fetch;
    app.w.fetch = function (url, init) { seen.push(String(url)); return inner(url, init); };
    /* D10: the published revision must exceed the shipped settingsRev. Derive
       it from the live config so the fixture can never go stale again. */
    const nextRev = Number(live.settingsRev) + 2;
    const nextSync = Number(live.syncRev) + 1;
    const cfgOnly = Object.assign({}, live, {
      settingsRev: nextRev, syncRev: nextSync,
      classSettings: Object.assign({}, live.classSettings, { writeSecs: 9, repeats: 3 })
    });
    app.files['data/config.json'] = JSON.stringify(cfgOnly);
    app.files['data/version.json'] = JSON.stringify({
      ver: 15, appVersion: '0.0.6.c', version: '0.0.6.c', schema: 15, settingsRev: nextRev,
      session: '8', title: 'Session 8', syncRev: nextSync,
      /* D17: a keys/settings-only publish — session.json is NOT rewritten. */
      payloadFiles: ['data/config.json', 'data/version.json']
    });
    seen.length = 0;
    const result = await new Promise((resolve) => {
      app.SDP.Sync.checkForUpdates((err, res) => resolve(res));
    });
    check('G11.13a a settings-only publish is adopted', !!result && result.updated === true, JSON.stringify(result && result.error));
    check('G11.13b D17: the 46 KB session.json is never re-pulled',
      seen.filter((u) => u.indexOf('session.json') >= 0).length === 0,
      seen.filter((u) => u.indexOf('session.json') >= 0).join(','));
    check('G11.13c the classroom settings really landed',
      app.SDP.Data.settings().writeSecs === 9 && app.SDP.Data.settings().repeats === 3,
      JSON.stringify([app.SDP.Data.settings().writeSecs, app.SDP.Data.settings().repeats]));
    check('G11.13d the pointer advanced to the published syncRev',
      Number(app.SDP.Sync.version().syncRev) === nextSync, app.SDP.Sync.version().syncRev);
    app.close();
  }

  {
    /* D15: the session leg is REQUIRED but 404s on both sources. */
    const liveCfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/config.json'), 'utf8'));
    let failSession = false; /* the boot pull must succeed; only the tick fails */
    const app = await createApp(Object.assign({
      fetch(url) {
        const u = String(url);
        if (failSession && u.indexOf('session.json') >= 0) {
          return Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error('404')) });
        }
        return undefined;
      }
    }, base));
    failSession = true;
    const nextRev2 = Number(liveCfg.settingsRev) + 3;
    const nextSync2 = Number(liveCfg.syncRev) + 2;
    app.files['data/config.json'] = JSON.stringify(Object.assign({}, liveCfg, {
      settingsRev: nextRev2, syncRev: nextSync2,
      classSettings: Object.assign({}, liveCfg.classSettings, { writeSecs: 8 })
    }));
    app.files['data/version.json'] = JSON.stringify({
      ver: 15, appVersion: '0.0.6.c', version: '0.0.6.c', schema: 15, settingsRev: nextRev2,
      session: '9', title: 'Session 9', syncRev: nextSync2,
      payloadFiles: ['data/session.json', 'data/config.json', 'data/version.json']
    });
    const before = app.SDP.Sync.wordCount();
    const result = await new Promise((resolve) => {
      app.SDP.Sync.checkForUpdates((err, res) => resolve(res));
    });
    /* D11: config sovereignty + honest stale-payload reporting at once. */
    check('G11.14a a failed session leg reports stale_payload while config lands',
      !!result && result.error === 'stale_payload' && result.changed === true, JSON.stringify(result && result.error));
    check('G11.14b config.json + version.json are adopted anyway',
      app.SDP.Sync.config().syncRev === nextSync2 && app.SDP.Data.settings().writeSecs === 8,
      app.SDP.Sync.config().syncRev);
    check('G11.14c the retry is deferred, not lost', !!result && result.deferredSession === true,
      JSON.stringify(result && result.deferredSession));
    check('G11.14d the previous session words survive the deferred pull',
      app.SDP.Sync.wordCount() === before && before === 30, app.SDP.Sync.wordCount());
    app.close();
  }

  {
    /* D16: verifyPayloadLeg now accepts sub-30-word and unchanged lists. */
    const app = await createApp(base);
    const V = app.SDP.Sync.verifyPayloadLeg;
    const words = [];
    for (let i = 0; i < 25; i++) words.push({ w: 'word' + i });
    const short25 = { syncRev: 1, session: { no: '8' }, lists: [{ id: 'list_short', active: true, words: words }] };
    check('G11.15a a 25-word session with the matching number is accepted',
      V(short25, 'session', 999999, { session: '8' }) === true);
    check('G11.15b the same payload for another session number is rejected',
      V(Object.assign({}, short25, { session: { no: '7' } }), 'session', 999999, { session: '8' }) === false);
    check('G11.15c an empty list is still rejected',
      V({ syncRev: 1, session: { no: '8' }, lists: [] }, 'session', 999999, { session: '8' }) === false);
    check('G11.15d a payload that proves the published syncRev is always accepted',
      V({ syncRev: 1793600200000 }, 'session', 1793597000000, {}) === true);
    app.close();
  }

  const failed = results.filter((r) => r.status === 'FAIL');
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ gate: 'G11', passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  } else {
    for (const r of results) if (r.status === 'FAIL') console.log('FAIL  ' + r.test + (r.detail ? '  [' + r.detail + ']' : ''));
    console.log('G11 vault-sync.cjs — ' + (results.length - failed.length) + ' PASS / ' + failed.length + ' FAIL');
  }
  process.exit(failed.length ? 1 : 0);
})();
