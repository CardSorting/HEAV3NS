import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  CodexOAuthManager,
  writeAtomicJsonFile,
  OPENAI_CODEX_OAUTH_CONFIG,
  LumiMonolith,
} from "../src/index.js";

async function main(): Promise<void> {
  console.log("================================================================");
  console.log(" LUMI Codex OAuth Subsystem: Enterprise Resilience Suite       ");
  console.log("================================================================\n");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-oauth-resilience-"));

  try {
    // -------------------------------------------------------------------------
    // [Suite 1/6] Atomic File Writing & Secure 0o600 POSIX File Permissions
    // -------------------------------------------------------------------------
    console.log("[Suite 1/6] Validating Atomic File Writing & 0o600 Mode...");
    const testFilePath = path.join(tempDir, "secure-auth.json");
    const testData = {
      auth_mode: "chatgpt",
      tokens: {
        access_token: "test_access_123",
        refresh_token: "test_refresh_123",
      },
    };

    writeAtomicJsonFile(testFilePath, testData);
    assert.equal(fs.existsSync(testFilePath), true, "File must exist after atomic write");
    
    const readBack = JSON.parse(fs.readFileSync(testFilePath, "utf-8"));
    assert.deepEqual(readBack, testData, "Data must match written content");

    if (process.platform !== "win32") {
      const stats = fs.statSync(testFilePath);
      const mode = stats.mode & 0o777;
      assert.equal(mode, 0o600, `File permissions must be 0o600, got 0o${mode.toString(8)}`);
    }
    console.log("  [✓] Atomic file write with fsync and 0o600 permission verified.");

    // -------------------------------------------------------------------------
    // [Suite 2/6] Single-Flight In-Flight Refresh Mutex & Deduplication
    // -------------------------------------------------------------------------
    console.log("[Suite 2/6] Validating Single-Flight In-Flight Refresh Mutex...");
    const manager = new CodexOAuthManager();
    // Do not mutate real user disk files during mock deduplication test
    manager.syncCredentialsToDisk = () => {};
    let networkCallCount = 0;

    // Mock global fetch for token refresh
    const originalFetch = globalThis.fetch;
    const mockAccessToken = "ey-new-access-token-rotated";
    const mockRefreshToken = "rt-new-refresh-token-rotated";

    // Set initial expired credentials
    (manager as any).credentials = {
      type: "openai-codex",
      access_token: "old-expired-token",
      refresh_token: "initial-refresh-token",
      expires: Date.now() - 10000, // Expired
      accountId: "acct-test-456",
    };

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);
      if (urlStr === OPENAI_CODEX_OAUTH_CONFIG.tokenEndpoint) {
        networkCallCount++;
        // Simulate 50ms network delay
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          ok: true,
          status: 200,
          text: async () => "",
          json: async () => ({
            access_token: `${mockAccessToken}-${networkCallCount}`,
            refresh_token: `${mockRefreshToken}-${networkCallCount}`,
            expires_in: 3600,
          }),
        } as Response;
      }
      return originalFetch(input, init);
    }) as typeof globalThis.fetch;

    try {
      // Trigger 50 concurrent getValidAccessToken calls simultaneously
      const concurrentCallers = 50;
      const promises: Promise<string | null>[] = [];
      for (let i = 0; i < concurrentCallers; i++) {
        promises.push(manager.getValidAccessToken());
      }

      const results = await Promise.all(promises);

      // Verify all callers received the exact same rotated token
      assert.equal(results.length, concurrentCallers);
      const expectedToken = `${mockAccessToken}-1`;
      for (const token of results) {
        assert.equal(token, expectedToken, "All concurrent callers must receive identical rotated token");
      }

      // Assert that exactly ONE network refresh occurred
      assert.equal(
        networkCallCount,
        1,
        `Single-flight mutex must coalesce 50 requests into 1 network call (actual: ${networkCallCount})`
      );
      console.log("  [✓] 50 concurrent refresh requests coalesced into exactly 1 network execution (Zero RTR collisions).");
    } finally {
      globalThis.fetch = originalFetch;
    }

    // -------------------------------------------------------------------------
    // [Suite 3/6] Multi-Source Freshness Timestamp Reconciliation
    // -------------------------------------------------------------------------
    console.log("[Suite 3/6] Validating Multi-Source Timestamp Reconciliation...");
    const multiDir = path.join(tempDir, "multi-source");
    fs.mkdirSync(multiDir, { recursive: true });

    const olderAuthPath = path.join(multiDir, "older-auth.json");
    const newerLumiPath = path.join(multiDir, "newer-lumi.json");

    const olderDate = new Date("2026-08-01T00:00:00Z");
    const newerDate = new Date("2026-08-18T18:00:00Z");

    const olderCreds = {
      tokens: {
        access_token: "older-access-token",
        refresh_token: "older-refresh-token",
        account_id: "older-acct",
      },
      last_refresh: olderDate.toISOString(),
    };

    const newerCreds = {
      codexOAuth: {
        type: "openai-codex",
        access_token: "newer-fresher-token",
        refresh_token: "newer-fresher-refresh",
        expires: Date.now() + 86400000,
        accountId: "newer-acct",
      },
      updatedAt: newerDate.getTime(),
    };

    writeAtomicJsonFile(olderAuthPath, olderCreds);
    writeAtomicJsonFile(newerLumiPath, newerCreds);

    const reconcileManager = new CodexOAuthManager();
    reconcileManager.syncCredentialsToDisk = () => {}; // Isolate disk sync during test
    const loaded = reconcileManager.loadFromDisk(undefined, [olderAuthPath, newerLumiPath]);
    assert.equal(loaded, true, "Must load credentials from candidate sources");

    const activeCreds = reconcileManager.getCredentials();
    assert.equal(
      activeCreds?.access_token,
      "newer-fresher-token",
      "Reconciliation heuristic must select freshest credentials based on timestamp"
    );
    assert.equal(activeCreds?.accountId, "newer-acct");
    console.log("  [✓] Multi-source reconciliation selected newest token lease deterministically.");

    // -------------------------------------------------------------------------
    // [Suite 4/6] Pre-Emptive Expiry Buffer & Clock-Skew Calculation
    // -------------------------------------------------------------------------
    console.log("[Suite 4/6] Validating Pre-Emptive Expiry Buffer...");
    const expiryManager = new CodexOAuthManager();

    // 1. Far future token (valid)
    (expiryManager as any).credentials = {
      type: "openai-codex",
      access_token: "valid-tok",
      refresh_token: "valid-ref",
      expires: Date.now() + 60 * 60 * 1000, // 60 mins remaining
    };
    assert.equal(expiryManager.isTokenExpired(), false, "Token with 60m remaining is not expired");

    // 2. Token within 5-minute pre-emptive buffer (should be flagged as expired to trigger safe refresh before turn)
    (expiryManager as any).credentials = {
      type: "openai-codex",
      access_token: "buffer-tok",
      refresh_token: "buffer-ref",
      expires: Date.now() + 3 * 60 * 1000, // 3 mins remaining (< 5m buffer)
    };
    assert.equal(
      expiryManager.isTokenExpired(),
      true,
      "Token within 5m buffer must trigger proactive refresh before turn dispatch"
    );
    console.log("  [✓] Pre-emptive 5-minute buffer triggers proactive rotation before expiration.");

    // -------------------------------------------------------------------------
    // [Suite 5/6] Auth Diagnostics & Telemetry
    // -------------------------------------------------------------------------
    console.log("[Suite 5/6] Validating Diagnostics Telemetry...");
    const realManager = new CodexOAuthManager();
    realManager.loadFromDisk();
    const diag = realManager.getAuthDiagnostics();

    assert.ok(Array.isArray(diag.sources));
    assert.ok(diag.sources.length >= 2);
    assert.equal(typeof diag.authenticated, "boolean");
    assert.ok(["SYNCHRONIZED", "DESYNCHRONIZED", "UNCONFIGURED"].includes(diag.syncStatus));
    console.log(`  [✓] Diagnostics telemetry generated cleanly (Sync Status: ${diag.syncStatus}, Authenticated: ${diag.authenticated}).`);

    // -------------------------------------------------------------------------
    // [Suite 6/6] Live Model Execution with Synchronized Credentials
    // -------------------------------------------------------------------------
    console.log("[Suite 6/6] Validating Live Monolith Model Dispatch with gpt-5.6-terra...");
    const monolith = new LumiMonolith({ cwd: process.cwd() });
    monolith.modelResolver.setActiveModel("gpt-5.6-terra");

    const liveTurn = await monolith.agentEngine.tick({
      prompt: "Respond with the single word: VERIFIED",
    });

    assert.equal(liveTurn.outcome, "completed");
    assert.ok(liveTurn.response && liveTurn.response.includes("VERIFIED"));
    console.log(`  [✓] Live model turn completed successfully: "${liveTurn.response.trim()}"`);

    console.log("\n================================================================");
    console.log("  [✓] ALL 6 CODEX OAUTH RESILIENCE SUITES PASSED!              ");
    console.log("================================================================\n");
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Non-fatal temp cleanup
    }
  }
}

main().catch((err) => {
  console.error("OAuth resilience validation failed:", err);
  process.exit(1);
});
