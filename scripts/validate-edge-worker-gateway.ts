import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SmoothWeightedPool } from '../src/agents/extensions/credential/smooth-weighted-pool.js';

const [workerSource, loginSource, addTokenSource, wranglerSource] = await Promise.all([
  readFile(new URL('../src/worker.ts', import.meta.url), 'utf8'),
  readFile(new URL('./login.ts', import.meta.url), 'utf8'),
  readFile(new URL('./add-token.ts', import.meta.url), 'utf8'),
  readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'),
]);

assert.match(workerSource, /X-Lumi-Admin-Secret/);
assert.match(workerSource, /crypto\.subtle\.timingSafeEqual/);
assert.match(workerSource, /admin_auth_not_configured/);
assert.match(workerSource, /readBoundedJson/);
assert.match(workerSource, /MAX_CREDENTIAL_RECORDS/);
assert.doesNotMatch(workerSource, /searchParams\.get\(['"]url['"]\)/);
assert.doesNotMatch(workerSource, /bodyPreview|X-Lumi-Account-Id/);
assert.doesNotMatch(workerSource, /request\.json\(\)|upstreamResp\.text\(\)/);

assert.doesNotMatch(loginSource, /\.workers\.dev/);
assert.match(loginSource, /returnedState !== state/);
assert.match(loginSource, /LUMI_EDGE_WORKER_URL/);
assert.match(loginSource, /LUMI_ADMIN_SECRET/);
assert.match(addTokenSource, /writeAtomicJsonFile/);
assert.doesNotMatch(addTokenSource, /arg === ['"]--token['"]|arg === ['"]--admin-secret['"]/);

const wranglerConfig = JSON.parse(wranglerSource) as {
  compatibility_date?: string;
  observability?: { enabled?: boolean };
  vars?: Record<string, string>;
};
assert.equal(wranglerConfig.compatibility_date, '2026-09-04');
assert.equal(wranglerConfig.observability?.enabled, true);
assert.equal(wranglerConfig.vars?.CORS_ALLOWED_ORIGIN, '');

const pool = new SmoothWeightedPool(60_000, 2);
assert.throws(() => pool.addTokenAccount({ accessToken: '' }), /accessToken/);
assert.throws(
  () => pool.addTokenAccount({ id: '../invalid', accessToken: 'valid-token-value' }),
  /id may contain/
);
const account = pool.addTokenAccount({
  id: 'valid_account',
  accessToken: 'valid-token-value',
  weight: Number.POSITIVE_INFINITY,
});
assert.equal(account.baseWeight, 1);

console.log('Edge Worker gateway security contract passed (20 assertions).');
