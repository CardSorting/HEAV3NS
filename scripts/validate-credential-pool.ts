import * as assert from "node:assert/strict";
import {
  LumiMonolith,
  ContinuousTokenBucketRateGovernor,
  DeterministicCredentialPool,
  BroccoliCredentialSubstrate,
  CredentialSnapshotManager,
  CredentialCircuitBreaker,
  MonolithCredentialManager,
  CredentialToolSuite,
} from "../src/index.js";

async function main(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Deterministic Credential Pool (AKD-DSO Validation)     ");
  console.log("================================================================\n");

  const substrate = new BroccoliCredentialSubstrate();
  const rateGovernor = new ContinuousTokenBucketRateGovernor();
  const pool = new DeterministicCredentialPool(substrate, rateGovernor, "least_utilized");
  const circuitBreaker = new CredentialCircuitBreaker();
  const snapshotManager = new CredentialSnapshotManager(substrate);
  const manager = new MonolithCredentialManager(substrate, pool, circuitBreaker, rateGovernor);
  const toolSuite = new CredentialToolSuite(pool);

  // ── [Test 1/8] Token Bucket Rate Limiting & Refill ────────────────────────
  console.log("[Test 1/8] Validating Token Bucket Rate Limiting & Refill...");
  {
    const bucket = rateGovernor.createDefaultBucket(1000, 60000, 10);
    assert.equal(bucket.remainingTokens, 1000);
    assert.equal(bucket.remainingRequests, 10);

    // Consume 600 tokens
    const { bucket: afterConsume, consumed } = rateGovernor.consume(bucket, 600, 2);
    assert.ok(consumed, "Consumption should succeed");
    assert.equal(afterConsume.remainingTokens, 400);
    assert.equal(afterConsume.remainingRequests, 8);

    // Attempt consuming more than remaining
    const { consumed: overdraw } = rateGovernor.consume(afterConsume, 500, 1);
    assert.ok(!overdraw, "Overdrawing should be rejected");

    // Simulate 30s time lapse (half refill)
    const futureMs = afterConsume.lastRefillTimestampMs + 30000;
    const refilled = rateGovernor.refillBucket(afterConsume, futureMs);
    assert.ok(refilled.remainingTokens >= 400 + 500, "Tokens should refill proportionately over time");

    console.log("\x1b[32m  [✓] Continuous token bucket rate limiting and mathematical refill passed.\x1b[0m");
  }

  // ── [Test 2/8] Multi-Account Rotation Strategies ───────────────────────────
  console.log("[Test 2/8] Validating Multi-Account Rotation Strategies...");
  {
    substrate.clear();
    const acc1 = pool.addAccount({
      id: "acc-openai-1",
      provider: "openai",
      accountLabel: "Team OpenAI 1",
      apiKeyMasked: "sk-proj...1111",
      priority: 10,
      weight: 1,
    });
    const acc2 = pool.addAccount({
      id: "acc-openai-2",
      provider: "openai",
      accountLabel: "Team OpenAI 2",
      apiKeyMasked: "sk-proj...2222",
      priority: 20,
      weight: 1,
    });

    // Strategy 1: least_utilized
    pool.setStrategy("least_utilized");
    const sel1 = pool.selectAccount("openai");
    assert.equal(sel1.account?.id, "acc-openai-1");
    pool.recordUsage(acc1.id, 500);

    const sel2 = pool.selectAccount("openai");
    assert.equal(sel2.account?.id, "acc-openai-2", "Least utilized account should be selected next");

    // Strategy 2: priority_failover
    pool.setStrategy("priority_failover");
    const selPriority = pool.selectAccount("openai");
    assert.equal(selPriority.account?.id, "acc-openai-2", "Highest priority (20) account should be selected");

    // Strategy 3: round_robin
    pool.setStrategy("round_robin");
    const r1 = pool.selectAccount("openai").account?.id;
    const r2 = pool.selectAccount("openai").account?.id;
    assert.notEqual(r1, r2, "Round robin should alternate accounts");

    console.log("\x1b[32m  [✓] Round-robin, least-utilized, and priority-failover strategies verified.\x1b[0m");
  }

  // ── [Test 3/8] Circuit Breaker State Transitions ───────────────────────────
  console.log("[Test 3/8] Validating Circuit Breaker State Transitions...");
  {
    const acc = substrate.getAccount("acc-openai-1")!;
    assert.equal(acc.status, "healthy");

    // Failure 1 (rate limit 429)
    const fail1 = pool.recordFailure(acc.id, "429 Too Many Requests: Rate limit exceeded", true);
    assert.equal(fail1.newStatus, "cooldown");
    assert.ok(fail1.cooldownMs! >= 30000, "Rate limit should impose at least 30s cooldown");

    // Accumulate failures to trip to exhausted
    for (let i = 0; i < 4; i++) {
      pool.recordFailure(acc.id, "500 Internal Server Error");
    }

    const exhaustedAcc = substrate.getAccount(acc.id)!;
    assert.equal(exhaustedAcc.status, "exhausted", "5 consecutive failures must trip to exhausted");

    // Success resets health
    pool.recordSuccess(acc.id);
    const recoveredAcc = substrate.getAccount(acc.id)!;
    assert.equal(recoveredAcc.status, "healthy");
    assert.equal(recoveredAcc.consecutiveFailures, 0);

    console.log("\x1b[32m  [✓] Circuit breaker healthy -> cooldown -> exhausted -> recovery verified.\x1b[0m");
  }

  // ── [Test 4/8] Terminal OAuth Error Detection & Eviction ──────────────────
  console.log("[Test 4/8] Validating Terminal OAuth Error Detection & Dead Account Eviction...");
  {
    assert.ok(circuitBreaker.isTerminalAuthError("token_revoked"), "token_revoked must be classified terminal");
    assert.ok(circuitBreaker.isTerminalAuthError("OAuth error: invalid_grant"), "invalid_grant must be terminal");
    assert.ok(circuitBreaker.isTerminalAuthError("Your account has been deactivated: account_deactivated"), "account_deactivated must be terminal");
    assert.ok(!circuitBreaker.isTerminalAuthError("504 Gateway Timeout"), "Transient timeout must not be terminal");

    // Monolith manager handles terminal error
    const termRes = manager.handleExecutionFailure("acc-openai-2", "OAuth token_revoked: access revoked by user");
    assert.equal(termRes.newStatus, "dead");
    assert.ok(termRes.isTerminal);

    const deadAcc = substrate.getAccount("acc-openai-2")!;
    assert.equal(deadAcc.status, "dead");

    // Dead account cannot be selected
    const acquireRes = manager.acquireCredential("openai");
    assert.equal(acquireRes.account?.id, "acc-openai-1", "Dead accounts must be excluded from acquisition");

    console.log("\x1b[32m  [✓] Terminal OAuth error classification and permanent eviction passed.\x1b[0m");
  }

  // ── [Test 5/8] In-Memory Broccolidb Substrate Caching ──────────────────────
  console.log("[Test 5/8] Validating In-Memory Broccolidb Substrate Caching...");
  {
    substrate.clear();
    pool.addAccount({
      id: "acc-anthropic-1",
      provider: "anthropic",
      accountLabel: "Anthropic Main",
      apiKeyMasked: "sk-ant...9999",
      priority: 5,
      weight: 1,
    });

    const anthropicAccounts = substrate.listAccounts("anthropic");
    assert.equal(anthropicAccounts.length, 1);
    assert.equal(anthropicAccounts[0].id, "acc-anthropic-1");

    const all = substrate.listAccounts();
    assert.equal(all.length, 1);

    console.log("\x1b[32m  [✓] In-memory Broccolidb credential substrate caching verified.\x1b[0m");
  }

  // ── [Test 6/8] Frame-Perfect Binary Snapshotting & O(1) State Rollback ────
  console.log("[Test 6/8] Validating Binary State Snapshotting & O(1) Rollback...");
  {
    // Snapshot at frame 10
    const snapshot10 = snapshotManager.createSnapshot(10);
    assert.equal(snapshot10.accounts.length, 1);

    // Mutate state (add 3 more accounts)
    pool.addAccount({ id: "temp-1", provider: "openrouter", accountLabel: "T1", apiKeyMasked: "sk-...", priority: 1, weight: 1 });
    pool.addAccount({ id: "temp-2", provider: "openrouter", accountLabel: "T2", apiKeyMasked: "sk-...", priority: 1, weight: 1 });
    assert.equal(substrate.listAccounts().length, 3);

    // Rollback to frame 10
    const startRollback = performance.now();
    snapshotManager.restoreSnapshot(snapshot10);
    const rollbackDuration = performance.now() - startRollback;

    assert.equal(substrate.listAccounts().length, 1);
    assert.equal(substrate.getAccount("acc-anthropic-1")?.id, "acc-anthropic-1");
    assert.equal(substrate.getAccount("temp-1"), undefined);
    assert.ok(rollbackDuration < 1.0, `Rollback took ${rollbackDuration} ms, must be < 1.0ms`);

    console.log(`\x1b[32m  [✓] Credential pool state snapshotting and instant O(1) rollback passed (${rollbackDuration.toFixed(3)} ms).\x1b[0m`);
  }

  // ── [Test 7/8] Credential Model Tool Suite Operations ─────────────────────
  console.log("[Test 7/8] Validating Credential Model Tool Suite...");
  {
    // 1. auth_add_credential
    const addRes = await toolSuite.executeTool("auth_add_credential", {
      id: "acc-gmi-1",
      provider: "google",
      accountLabel: "Google Gemini Core",
      apiKey: "AIzaSySecretApiKey12345678",
      priority: 15,
    });
    assert.ok(addRes.success, "auth_add_credential should succeed");

    // 2. auth_list_credentials
    const listRes = await toolSuite.executeTool("auth_list_credentials", { provider: "google" });
    assert.ok(listRes.success, "auth_list_credentials should succeed");

    // 3. auth_rotate_credential
    const rotateRes = await toolSuite.executeTool("auth_rotate_credential", { provider: "google" });
    assert.ok(rotateRes.success, "auth_rotate_credential should succeed");

    // 4. auth_circuit_status
    const statusRes = await toolSuite.executeTool("auth_circuit_status", {});
    assert.ok(statusRes.success, "auth_circuit_status should succeed");

    console.log("\x1b[32m  [✓] Model tool operations (list, add, rotate, circuit_status) passed.\x1b[0m");
  }

  // ── [Test 8/8] Monolith Composition & Rotation Micro-Benchmark ────────────
  console.log("[Test 8/8] Benchmarking Monolith Composition & Account Selection Micro-Latency...");
  {
    const monolith = new LumiMonolith({ sessionId: "credential-bench-session" });
    assert.ok(monolith.deterministicCredentialPool, "deterministicCredentialPool must be composed");
    assert.ok(monolith.credentialToolSuite, "credentialToolSuite must be composed");
    assert.ok(monolith.broccoliCredentialSubstrate, "broccoliCredentialSubstrate must be composed");
    assert.ok(monolith.credentialSnapshotManager, "credentialSnapshotManager must be composed");
    assert.ok(monolith.credentialCircuitBreaker, "credentialCircuitBreaker must be composed");
    assert.ok(monolith.monolithCredentialManager, "monolithCredentialManager must be composed");

    for (let i = 0; i < 20; i++) {
      monolith.deterministicCredentialPool.addAccount({
        id: `bench-acc-${i}`,
        provider: "bench-provider",
        accountLabel: `Bench Account ${i}`,
        apiKeyMasked: `sk-bench-...${i}`,
        priority: i,
        weight: 1,
      });
    }

    const iterations = 1000;
    const startBench = performance.now();
    for (let i = 0; i < iterations; i++) {
      monolith.deterministicCredentialPool.selectAccount("bench-provider", 100);
    }
    const totalBenchMs = performance.now() - startBench;
    const perSelectUs = (totalBenchMs / iterations) * 1000;

    console.log(`  Measured: ${iterations} credential rotations in ${totalBenchMs.toFixed(3)} ms (${perSelectUs.toFixed(3)} µs/rotation)`);
    assert.ok(totalBenchMs < 10.0, `1,000 rotations took ${totalBenchMs} ms, must be < 10.0ms`);

    console.log("\x1b[32m  [✓] Monolith composition & credential rotation micro-benchmark passed.\x1b[0m");
  }

  console.log("\n================================================================");
  console.log("   ALL 8 CREDENTIAL POOL VALIDATION SUITES PASSED!             ");
  console.log("================================================================\n");
}

main().catch((error) => {
  console.error("Validation failed with error:", error);
  process.exit(1);
});
