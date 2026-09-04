/**
 * LUMI-NEW: CLI Token Ingestion & Pool Synchronizer
 *
 * Adds or updates Codex/OpenAI accounts in the local pool (~/.lumi/config.json)
 * and syncs them to the live Cloudflare Edge Worker.
 *
 * Usage:
 *   LUMI_ACCESS_TOKEN=<access_token> LUMI_REFRESH_TOKEN=<refresh_token> npx tsx scripts/add-token.ts
 *   npx tsx scripts/add-token.ts --from-codex-auth
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import { writeAtomicJsonFile } from '../src/agents/extensions/resolution/codex-oauth-manager.js';

interface CliArgs {
  token?: string;
  refresh?: string;
  account?: string;
  email?: string;
  weight?: number;
  priority?: number;
  fromCodexAuth?: boolean;
  edgeWorkerUrl?: string;
  adminSecret?: string;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {
    token: process.env.LUMI_ACCESS_TOKEN,
    refresh: process.env.LUMI_REFRESH_TOKEN,
    adminSecret: process.env.LUMI_ADMIN_SECRET,
    edgeWorkerUrl: process.env.LUMI_EDGE_WORKER_URL,
  };
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--account' && argv[i + 1]) args.account = argv[++i];
    else if (arg === '--email' && argv[i + 1]) args.email = argv[++i];
    else if (arg === '--weight' && argv[i + 1]) args.weight = Number(argv[++i]);
    else if (arg === '--priority' && argv[i + 1]) args.priority = Number(argv[++i]);
    else if (arg === '--from-codex-auth') args.fromCodexAuth = true;
    else if (arg === '--worker-url' && argv[i + 1]) args.edgeWorkerUrl = argv[++i];
  }

  return args;
}

async function main() {
  const args = parseArgs();
  const lumiConfigPath = path.join(os.homedir(), '.lumi', 'config.json');

  if (args.fromCodexAuth) {
    const codexAuthPath = path.join(os.homedir(), '.codex', 'auth.json');
    if (!fs.existsSync(codexAuthPath)) {
      console.error(`❌ Error: ${codexAuthPath} does not exist. Run 'codex login' first.`);
      process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(codexAuthPath, 'utf-8'));
    const tokens = raw.tokens || raw;
    args.token = tokens.access_token || args.token;
    args.refresh = tokens.refresh_token || args.refresh;
    args.account = tokens.account_id || raw.account_id || args.account;
  }

  if (!args.token) {
    console.error('❌ Error: Missing LUMI_ACCESS_TOKEN, --token, or --from-codex-auth');
    console.log('\nUsage Examples:');
    console.log('  npx tsx scripts/add-token.ts --from-codex-auth');
    console.log('  LUMI_ACCESS_TOKEN="..." npx tsx scripts/add-token.ts --account "4957..."');
    console.log('  LUMI_EDGE_WORKER_URL="https://..." LUMI_ADMIN_SECRET="..." npm run token:add');
    process.exit(1);
  }

  // 1. Read or initialize ~/.lumi/config.json
  let config: Record<string, any> = {};
  if (fs.existsSync(lumiConfigPath)) {
    try {
      config = JSON.parse(fs.readFileSync(lumiConfigPath, 'utf-8'));
    } catch (error: unknown) {
      throw new Error(
        `Refusing to overwrite unreadable configuration: ${error instanceof Error ? error.message : 'invalid JSON'}`
      );
    }
  }

  if (!Array.isArray(config.codexOAuthPool)) {
    config.codexOAuthPool = [];
    if (config.codexOAuth?.access_token) {
      config.codexOAuthPool.push({
        id: 'codex_primary_legacy',
        ...config.codexOAuth,
        weight: 1,
        priority: 10,
        createdAt: Date.now(),
      });
    }
  }

  const accountId = args.account || 'unknown_account';
  const email = args.email || (args.token.startsWith('eyJ') ? 'codex_jwt_user' : 'codex_user');
  const accountSlug = accountId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32) || 'unknown';
  const tokenId = `codex_sh_${accountSlug}_${randomUUID()}`;

  // De-duplicate by account ID or token prefix
  const existingIdx = accountId === 'unknown_account'
    ? -1
    : config.codexOAuthPool.findIndex(
        (token: any) => token.accountId === accountId || token.account_id === accountId
      );

  if (args.weight !== undefined && (!Number.isFinite(args.weight) || args.weight < 1 || args.weight > 1_000)) {
    throw new RangeError('--weight must be a number from 1 through 1000');
  }
  if (args.priority !== undefined && (!Number.isFinite(args.priority) || args.priority < 0 || args.priority > 1_000)) {
    throw new RangeError('--priority must be a number from 0 through 1000');
  }

  const tokenRecord = {
    id: existingIdx !== -1 ? config.codexOAuthPool[existingIdx].id : tokenId,
    access_token: args.token,
    refresh_token: args.refresh || config.codexOAuthPool[existingIdx]?.refresh_token,
    accountId,
    account_id: accountId,
    email,
    weight: args.weight ?? 1,
    priority: args.priority ?? 10,
    updatedAt: Date.now(),
  };

  if (existingIdx !== -1) {
    config.codexOAuthPool[existingIdx] = tokenRecord;
    console.log(`[✓] Updated existing token in pool: ${tokenRecord.id} (${email})`);
  } else {
    config.codexOAuthPool.push(tokenRecord);
    console.log(`[✓] Added new token to pool: ${tokenRecord.id} (${email})`);
  }

  // Also update primary codexOAuth for backward compatibility
  config.codexOAuth = {
    access_token: args.token,
    refresh_token: args.refresh || config.codexOAuth?.refresh_token,
    accountId,
    email,
    expires: Date.now() + 3600 * 1000,
  };

  writeAtomicJsonFile(lumiConfigPath, config);
  console.log(`[✓] Successfully saved to ${lumiConfigPath}`);
  console.log(`[Fleet Status] Active tokens in pool: ${config.codexOAuthPool.length}`);

  // 2. Optionally sync directly with running Edge Worker
  const workerUrl = args.edgeWorkerUrl;
  if (workerUrl) {
    if (!args.adminSecret) {
      throw new Error('LUMI_ADMIN_SECRET is required whenever an Edge Worker URL is configured');
    }
    const parsedWorkerUrl = new URL(workerUrl);
    if (parsedWorkerUrl.protocol !== 'https:' && parsedWorkerUrl.hostname !== '127.0.0.1' && parsedWorkerUrl.hostname !== 'localhost') {
      throw new Error('Edge Worker URL must use HTTPS unless it targets localhost');
    }
    try {
      console.log(`[Sync] Pushing token to Cloudflare Edge Worker at ${workerUrl}...`);
      const syncResp = await fetch(`${workerUrl.replace(/\/$/, '')}/v1/tokens/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Lumi-Admin-Secret': args.adminSecret,
        },
        body: JSON.stringify({
          id: tokenRecord.id,
          accessToken: tokenRecord.access_token,
          refreshToken: tokenRecord.refresh_token,
          accountId: tokenRecord.accountId,
          email: tokenRecord.email,
          weight: tokenRecord.weight,
          priority: tokenRecord.priority,
        }),
      });

      if (!syncResp.ok) {
        throw new Error(`Edge Worker synchronization returned HTTP ${syncResp.status}`);
      }
      console.log('[✓] Edge Worker synchronized');
    } catch (syncError: unknown) {
      throw new Error(
        `Could not synchronize with Edge Worker: ${syncError instanceof Error ? syncError.message : 'unknown error'}`
      );
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
