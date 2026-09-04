/**
 * LUMI-NEW: Interactive OAuth Login & Pool Ingestion Script
 *
 * Runs local OAuth PKCE flow to log in to OpenAI/ChatGPT, obtains
 * valid access & refresh tokens, saves them to ~/.lumi/config.json
 * and ~/.codex/auth.json. Remote synchronization is explicit and requires
 * both LUMI_EDGE_WORKER_URL and LUMI_ADMIN_SECRET.
 *
 * Usage:
 *   npx tsx scripts/login.ts
 */

import * as http from 'node:http';
import { randomUUID } from 'node:crypto';
import { CodexOAuthManager } from '../src/agents/extensions/resolution/codex-oauth-manager.js';

async function main() {
  const manager = new CodexOAuthManager();
  const { url, codeVerifier, state } = manager.generateAuthUrl();

  console.log('\n======================================================================');
  console.log('   🔑 LUMI: OPENAI CODEX OAUTH LOGIN & POOL INGESTION');
  console.log('======================================================================\n');
  console.log('👉 Please open this URL in your browser to sign in:\n');
  console.log(url);
  console.log('\nWaiting for callback on http://127.0.0.1:1455/auth/callback ...\n');

  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url!, 'http://127.0.0.1:1455');
      if (parsedUrl.pathname === '/auth/callback') {
        const code = parsedUrl.searchParams.get('code');
        const returnedState = parsedUrl.searchParams.get('state');

        if (!code || returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Error: Invalid OAuth callback.</h1>');
          return;
        }

        console.log('[✓] Authorization code received! Exchanging for tokens...');
        const creds = await manager.exchangeCodeForTokens(code, codeVerifier);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authentication Successful!</h1><p>You can close this tab and return to your terminal.</p>');

        console.log(`[✓] Successfully authenticated as ${creds.email || 'OpenAI User'}!`);
        console.log(`[✓] Account ID: ${creds.accountId}`);
        console.log(`[✓] Tokens saved to ~/.codex/auth.json and ~/.lumi/config.json!`);

        const workerUrl = process.env.LUMI_EDGE_WORKER_URL;
        const adminSecret = process.env.LUMI_ADMIN_SECRET;
        if (workerUrl && !adminSecret) {
          console.warn('[!] Edge synchronization skipped: LUMI_ADMIN_SECRET is not configured.');
        } else if (workerUrl && adminSecret) {
          try {
            const parsedWorkerUrl = new URL(workerUrl);
            if (parsedWorkerUrl.protocol !== 'https:' && parsedWorkerUrl.hostname !== '127.0.0.1' && parsedWorkerUrl.hostname !== 'localhost') {
              throw new Error('Edge Worker URL must use HTTPS unless it targets localhost');
            }
            const accountSlug = (creds.accountId || 'user').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32) || 'user';
            console.log(`[Sync] Pushing token to Edge Worker: ${workerUrl}...`);
            const syncResp = await fetch(`${workerUrl.replace(/\/$/, '')}/v1/tokens/ingest`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Lumi-Admin-Secret': adminSecret,
              },
              body: JSON.stringify({
                id: `codex_sh_${accountSlug}_${randomUUID()}`,
                accessToken: creds.access_token,
                refreshToken: creds.refresh_token,
                accountId: creds.accountId,
                email: creds.email,
                weight: 1,
                priority: 10,
              }),
            });
            if (syncResp.ok) {
              console.log('[✓] Token successfully registered in Cloudflare Edge Round-Robin Pool!');
            } else {
              console.warn(`[!] Edge Worker synchronization returned HTTP ${syncResp.status}`);
            }
          } catch (error: unknown) {
            console.warn('[!] Edge Worker synchronization failed:', error instanceof Error ? error.message : 'unknown error');
          }
        }

        server.close();
        process.exit(0);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
      }
    } catch (error: unknown) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<h1>Authentication failed.</h1>');
      console.error('Error in callback:', error instanceof Error ? error.message : 'unknown error');
    }
  });

  server.listen(1455, '127.0.0.1');
}

main().catch((err) => {
  console.error('Login error:', err);
  process.exit(1);
});
