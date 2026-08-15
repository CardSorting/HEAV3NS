import * as assert from "node:assert/strict";
import {
  LumiMonolith,
  JitteredBackoffGovernor,
  DeterministicErrorClassifier,
  BroccoliFaultSubstrate,
  FaultSnapshotManager,
  FaultRecoverySupervisor,
  FaultDiagnosticToolSuite,
} from "../src/index.js";

async function main(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Fault Recovery & Error Taxonomy (AKD-DSO Validation)    ");
  console.log("================================================================\n");

  const governor = new JitteredBackoffGovernor(42);
  const classifier = new DeterministicErrorClassifier(governor);
  const substrate = new BroccoliFaultSubstrate();
  const snapshotManager = new FaultSnapshotManager(substrate);
  const supervisor = new FaultRecoverySupervisor(classifier, governor, substrate);
  const toolSuite = new FaultDiagnosticToolSuite(supervisor, substrate);

  // ── [Test 1/8] HTTP Status & Code Taxonomy Classification ────────────────
  console.log("[Test 1/8] Validating HTTP Status & Error Code Taxonomy...");
  {
    // 401 Unauthorized -> auth_transient
    const fault401 = classifier.classify({ status: 401, message: "Invalid API key provided" });
    assert.equal(fault401.category, "auth_transient");
    assert.equal(fault401.directive, "rotate_credential");
    assert.equal(fault401.retryable, true);

    // 402 Payment Required -> billing_exhausted
    const fault402 = classifier.classify({ status: 402, message: "Account balance is zero" });
    assert.equal(fault402.category, "billing_exhausted");
    assert.equal(fault402.directive, "rotate_credential");

    // 429 Rate Limit -> rate_limit
    const fault429 = classifier.classify({ status: 429, message: "Rate limit exceeded" });
    assert.equal(fault429.category, "rate_limit");
    assert.equal(fault429.directive, "rotate_credential");

    // 413 Context Overflow -> context_overflow
    const fault413 = classifier.classify({ status: 413, message: "Prompt is too long for model context length" });
    assert.equal(fault413.category, "context_overflow");
    assert.equal(fault413.directive, "compress_context");

    // 404 Model Not Found -> model_unavailable
    const fault404 = classifier.classify({ status: 404, message: "Model 'gpt-deprecated' not found" });
    assert.equal(fault404.category, "model_unavailable");
    assert.equal(fault404.directive, "fallback_model");

    // 503 Overloaded -> overloaded_server
    const fault503 = classifier.classify({ status: 503, message: "Server is temporarily overloaded" });
    assert.equal(fault503.category, "overloaded_server");
    assert.equal(fault503.directive, "retry_backoff");

    // SSL Failure -> ssl_failure (Fail Fast)
    const faultSsl = classifier.classify(new Error("SELF_SIGNED_CERT_IN_CHAIN"));
    assert.equal(faultSsl.category, "ssl_failure");
    assert.equal(faultSsl.directive, "abort_fail_fast");
    assert.equal(faultSsl.retryable, false);

    console.log("\x1b[32m  [✓] Standard HTTP status and code error taxonomy classification verified.\x1b[0m");
  }

  // ── [Test 2/8] Multi-Provider Error Payload Parsing ───────────────────────
  console.log("[Test 2/8] Validating Multi-Provider Error Payload Parsing...");
  {
    // OpenAI error format
    const openAiErr = {
      error: {
        message: "You exceeded your current quota, please check your plan and billing details.",
        type: "insufficient_quota",
        code: "insufficient_quota",
      },
      status: 429,
    };
    const openAiClassified = classifier.classify(openAiErr, { provider: "openai" });
    assert.equal(openAiClassified.category, "billing_exhausted");
    assert.equal(openAiClassified.directive, "rotate_credential");

    // Anthropic format
    const anthropicErr = {
      type: "error",
      error: {
        type: "invalid_request_error",
        message: "prompt is too long: 210000 tokens > 200000 maximum",
      },
      statusCode: 400,
    };
    const anthropicClassified = classifier.classify(anthropicErr, { provider: "anthropic" });
    assert.equal(anthropicClassified.category, "context_overflow");
    assert.equal(anthropicClassified.directive, "compress_context");

    // OpenRouter Upstream Model Throttling
    const openRouterErr = {
      status: 429,
      message: "Upstream model provider is currently overloaded for claude-3-5-sonnet",
    };
    const openRouterClassified = classifier.classify(openRouterErr, { provider: "openrouter" });
    assert.equal(openRouterClassified.category, "upstream_rate_limit");
    assert.equal(openRouterClassified.directive, "fallback_model");

    console.log("\x1b[32m  [✓] Multi-provider (OpenAI, Anthropic, OpenRouter) payload parsing verified.\x1b[0m");
  }

  // ── [Test 3/8] Deterministic Jittered Backoff Calculations ────────────────
  console.log("[Test 3/8] Validating Deterministic Jittered Backoff Governor...");
  {
    // Check Retry-After header parsing
    const numericRetryAfter = governor.parseRetryAfterMs("5");
    assert.equal(numericRetryAfter, 5000);

    const dateStr = new Date(Date.now() + 10000).toUTCString();
    const dateRetryAfter = governor.parseRetryAfterMs(dateStr);
    assert.ok(dateRetryAfter !== undefined && dateRetryAfter > 8000 && dateRetryAfter <= 10000);

    // Deterministic repeatability: same seed produces identical sequences
    const gov1 = new JitteredBackoffGovernor(999);
    const gov2 = new JitteredBackoffGovernor(999);

    const b1_1 = gov1.calculateBackoffMs(1, { jitterMode: "full" });
    const b2_1 = gov2.calculateBackoffMs(1, { jitterMode: "full" });
    assert.equal(b1_1, b2_1);

    const b1_2 = gov1.calculateBackoffMs(2, { jitterMode: "equal" });
    const b2_2 = gov2.calculateBackoffMs(2, { jitterMode: "equal" });
    assert.equal(b1_2, b2_2);

    console.log("\x1b[32m  [✓] Deterministic seeded jitter and Retry-After header parsing verified.\x1b[0m");
  }

  // ── [Test 4/8] Fault Recovery Supervisor Directives ───────────────────────
  console.log("[Test 4/8] Validating Fault Recovery Supervisor Directives...");
  {
    const recovery1 = supervisor.evaluateRecovery({ status: 500, message: "Internal server error" }, {
      provider: "deepseek",
      attemptCount: 2,
    });
    assert.equal(recovery1.category, "overloaded_server");
    assert.equal(recovery1.directive, "retry_backoff");
    assert.ok(recovery1.suggestedBackoffMs > 0);

    console.log("\x1b[32m  [✓] Supervisor dynamic backoff and directive evaluation verified.\x1b[0m");
  }

  // ── [Test 5/8] In-Memory Broccolidb Fault Substrate Metrics ───────────────
  console.log("[Test 5/8] Validating In-Memory Broccolidb Fault Substrate...");
  {
    const health = substrate.getProviderHealth("deepseek");
    assert.ok(health);
    assert.equal(health.provider, "deepseek");
    assert.ok(health.totalFaults >= 1);
    assert.equal(substrate.getTotalFaultCount(), 1);

    // Record success to clear consecutive failure count
    substrate.recordSuccess("deepseek");
    const refreshed = substrate.getProviderHealth("deepseek");
    assert.equal(refreshed?.consecutiveFailures, 0);

    console.log("\x1b[32m  [✓] In-memory Broccolidb fault substrate metrics verified.\x1b[0m");
  }

  // ── [Test 6/8] Frame-Perfect Binary Snapshotting & O(1) Rollback ───────────
  console.log("[Test 6/8] Validating Fault Binary Snapshotting & O(1) Rollback...");
  {
    const snapshot20 = snapshotManager.createSnapshot(20);
    assert.equal(snapshot20.providerHealth.length, 1);
    assert.equal(snapshot20.totalClassifiedFaults, 1);

    // Mutate state with new fault
    substrate.recordFault("groq", "rate_limit");
    assert.equal(substrate.listProviderHealth().length, 2);

    // Rollback to frame 20
    const startRollback = performance.now();
    snapshotManager.restoreSnapshot(snapshot20);
    const rollbackDuration = performance.now() - startRollback;

    assert.equal(substrate.listProviderHealth().length, 1);
    assert.equal(substrate.getProviderHealth("groq"), undefined);
    assert.ok(rollbackDuration < 1.0, `Rollback took ${rollbackDuration} ms, must be < 1.0ms`);

    console.log(`\x1b[32m  [✓] Frame-perfect binary snapshotting and O(1) rollback passed (${rollbackDuration.toFixed(3)} ms).\x1b[0m`);
  }

  // ── [Test 7/8] Fault Diagnostic Model Tool Suite Operations ───────────────
  console.log("[Test 7/8] Validating Fault Diagnostic Model Tool Suite...");
  {
    // 1. fault_inspect_error
    const inspectRes = await toolSuite.executeTool("fault_inspect_error", {
      errorMessage: "Rate limit reached for requests per minute",
      statusCode: 429,
      provider: "openai",
    });
    assert.ok(inspectRes.success);
    const inspectObj = inspectRes.result as { category: string; directive: string };
    assert.equal(inspectObj.category, "rate_limit");
    assert.equal(inspectObj.directive, "rotate_credential");

    // 2. fault_query_provider_health
    const healthRes = await toolSuite.executeTool("fault_query_provider_health", {
      provider: "deepseek",
    });
    assert.ok(healthRes.success);

    // 3. fault_reset_history
    const resetRes = await toolSuite.executeTool("fault_reset_history", {});
    assert.ok(resetRes.success);
    assert.equal(substrate.getTotalFaultCount(), 0);

    console.log("\x1b[32m  [✓] Fault diagnostic tool operations (inspect_error, query_health, reset_history) passed.\x1b[0m");
  }

  // ── [Test 8/8] Monolith Composition & Benchmark ───────────────────────────
  console.log("[Test 8/8] Benchmarking Monolith Composition & Error Classification Latency...");
  {
    const monolith = new LumiMonolith({ sessionId: "fault-bench-session" });
    assert.ok(monolith.jitteredBackoffGovernor, "jitteredBackoffGovernor must be composed");
    assert.ok(monolith.deterministicErrorClassifier, "deterministicErrorClassifier must be composed");
    assert.ok(monolith.broccoliFaultSubstrate, "broccoliFaultSubstrate must be composed");
    assert.ok(monolith.faultSnapshotManager, "faultSnapshotManager must be composed");
    assert.ok(monolith.faultRecoverySupervisor, "faultRecoverySupervisor must be composed");
    assert.ok(monolith.faultDiagnosticToolSuite, "faultDiagnosticToolSuite must be composed");

    const sampleError = {
      status: 429,
      message: "Rate limit exceeded: 500 requests per minute",
      code: "rate_limit_exceeded",
    };

    const iterations = 1000;
    const startBench = performance.now();
    for (let i = 0; i < iterations; i++) {
      monolith.deterministicErrorClassifier.classify(sampleError, { provider: "openai" });
    }
    const totalBenchMs = performance.now() - startBench;
    const perClassifyUs = (totalBenchMs / iterations) * 1000;

    console.log(`  Measured: ${iterations} error classifications in ${totalBenchMs.toFixed(3)} ms (${perClassifyUs.toFixed(3)} µs/classify)`);
    assert.ok(totalBenchMs < 10.0, `1,000 classifications took ${totalBenchMs} ms, must be < 10.0ms`);

    console.log("\x1b[32m  [✓] Monolith composition & error classification micro-benchmark passed.\x1b[0m");
  }

  console.log("\n================================================================");
  console.log("   ALL 8 FAULT RECOVERY VALIDATION SUITES PASSED!               ");
  console.log("================================================================\n");
}

main().catch((error) => {
  console.error("Validation failed with error:", error);
  process.exit(1);
});
