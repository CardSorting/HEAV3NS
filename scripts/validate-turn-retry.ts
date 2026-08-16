/**
 * validate-turn-retry.ts
 *
 * Comprehensive validation suite for Turn Retry State Machine, One-Shot Recovery Guards
 * & Adaptive Payload Restart Subsystem (Phase 131 / ADR-107 / Target #64).
 */

import assert from "node:assert";
import { performance } from "node:perf_hooks";

import { DeterministicTurnRetryEngine } from "../src/agents/extensions/turn_retry/deterministic-turn-retry-engine.js";
import { TurnRetrySupervisor } from "../src/agents/extensions/turn_retry/turn-retry-supervisor.js";
import { BroccoliTurnRetrySubstrate } from "../src/sessions/extensions/turn_retry/broccoli-turn-retry-substrate.js";
import { TurnRetrySnapshotManager } from "../src/sessions/extensions/turn_retry/turn-retry-snapshot-manager.js";
import { TurnRetryToolSuite } from "../src/tooling/extensions/turn_retry/turn-retry-tool-suite.js";

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Turn Retry State Machine & Recovery Guards (ADR-107)    ");
  console.log("================================================================\n");

  const substrate = new BroccoliTurnRetrySubstrate();
  const engine = new DeterministicTurnRetryEngine();
  const snapshotManager = new TurnRetrySnapshotManager(substrate);
  const supervisor = new TurnRetrySupervisor(substrate, engine);
  const toolSuite = new TurnRetryToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Suite 1: Turn Retry State Initialization & Defaults
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating Turn Retry State Initialization...");

  const state1 = supervisor.createTurnState(1, 0);
  assert.ok(state1.stateId.startsWith("turn-retry-"));
  assert.strictEqual(state1.turnIndex, 1);
  assert.strictEqual(state1.attemptIndex, 0);
  assert.strictEqual(state1.guards.codexAuthRetryAttempted, false);
  assert.strictEqual(state1.restartSignals.restartWithCompressedMessages, false);
  console.log("  [✓] Turn retry state initialized with pristine false flags.");

  // ---------------------------------------------------------------------------
  // Suite 2: One-Shot Guard Invariant (At-Most-Once Firing)
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating One-Shot Guard Invariant (At-Most-Once)...");

  const firstTrigger = supervisor.triggerRecovery("codexAuthRetryAttempted", "Initial 401 token expiry");
  assert.strictEqual(firstTrigger, true, "First trigger must succeed");

  const secondTrigger = supervisor.triggerRecovery("codexAuthRetryAttempted", "Duplicate 401 in same attempt");
  assert.strictEqual(secondTrigger, false, "Second trigger on same branch must be rejected");

  const activeState = supervisor.getActiveState();
  assert.ok(activeState);
  assert.strictEqual(activeState.guards.codexAuthRetryAttempted, true);
  console.log("  [✓] One-shot invariant strictly enforced (first: true, second: false).");

  // ---------------------------------------------------------------------------
  // Suite 3: Provider Auth Refresh Branches & Automatic Error Classifier
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Provider Auth Classification & Recovery...");

  const res1 = supervisor.handleAttemptError(new Error("Unauthorized"), 401, "anthropic");
  assert.strictEqual(res1.branchTriggered, "anthropicAuthRetryAttempted");
  assert.strictEqual(res1.recovered, true);

  const res2 = supervisor.handleAttemptError(new Error("model_not_available_for_integrator"), 400, "copilot");
  assert.strictEqual(res2.branchTriggered, "copilotStaleCredRetryAttempted");
  assert.strictEqual(res2.recovered, true);

  const res3 = supervisor.handleAttemptError(new Error("Rate limit exceeded"), 429, "openai");
  assert.strictEqual(res3.branchTriggered, "hasRetried429");
  assert.strictEqual(res3.recovered, true);
  console.log("  [✓] Provider-specific auth refreshes and rate-limit branches classified.");

  // ---------------------------------------------------------------------------
  // Suite 4: Format & Payload Recovery Guards
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Format & Payload Recovery Guards...");

  const resThinking = supervisor.handleAttemptError(new Error("Invalid thinking signature format"), 400, "deepseek");
  assert.strictEqual(resThinking.branchTriggered, "thinkingSigRetryAttempted");
  assert.strictEqual(resThinking.signalSet, "restartWithRebuiltMessages");

  const resContext = supervisor.handleAttemptError(new Error("Maximum context length exceeded"), 400, "generic");
  assert.strictEqual(resContext.branchTriggered, "nativeCompactionRejectRetryAttempted");
  assert.strictEqual(resContext.signalSet, "restartWithCompressedMessages");

  const resImage = supervisor.handleAttemptError(new Error("Image exceeds maximum size"), 400, "generic");
  assert.strictEqual(resImage.branchTriggered, "imageShrinkRetryAttempted");
  assert.strictEqual(resImage.signalSet, "restartWithRebuiltMessages");
  console.log("  [✓] Thinking tag, context length, and image format recoveries validated.");

  // ---------------------------------------------------------------------------
  // Suite 5: Adaptive Restart Signal Setting & Arbitration
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Restart Signal Arbitration...");

  supervisor.setRestartSignal("restartWithRedirectedMessages", "User cancelled mid-flight");
  const stateWithSignals = supervisor.getActiveState()!;
  assert.strictEqual(stateWithSignals.restartSignals.restartWithRedirectedMessages, true);
  assert.strictEqual(stateWithSignals.restartSignals.restartWithCompressedMessages, true);

  const actionSummary = engine.formatRestartAction(stateWithSignals.restartSignals);
  assert.ok(actionSummary.includes("compress_messages"));
  assert.ok(actionSummary.includes("rebuild_messages"));
  assert.ok(actionSummary.includes("redirect_messages"));
  console.log(`  Actions: ${actionSummary}`);
  console.log("  [✓] Adaptive restart signal emission and action plans verified.");

  // ---------------------------------------------------------------------------
  // Suite 6: In-Memory Substrate Binary Snapshotting & O(1) State Rollback
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Binary Snapshotting & O(1) State Rollback...");

  const snap = snapshotManager.takeSnapshot("snap-turn-retry-1");
  assert.ok(snap.activeState);

  // Mutate state by triggering vertex auth
  supervisor.triggerRecovery("vertexAuthRetryAttempted");
  assert.strictEqual(supervisor.getActiveState()!.guards.vertexAuthRetryAttempted, true);

  // Rollback
  const tRewindStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("snap-turn-retry-1");
  const rewindLatencyMs = performance.now() - tRewindStart;

  assert.ok(restored, "Snapshot restore must succeed");
  assert.strictEqual(supervisor.getActiveState()!.guards.vertexAuthRetryAttempted, false);
  assert.ok(rewindLatencyMs < 0.05, `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.05 ms SLA`);
  console.log(`  [✓] Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms).`);

  // ---------------------------------------------------------------------------
  // Suite 7: Model Tool Suite Execution
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Model Tool Suite Execution...");

  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 5, "Must expose exactly 5 model tools");

  const inspectTool = tools.find((t) => t.name === "turn_retry_inspect_state")!;
  const triggerTool = tools.find((t) => t.name === "turn_retry_trigger_recovery")!;
  const signalTool = tools.find((t) => t.name === "turn_retry_set_restart_signal")!;
  const configTool = tools.find((t) => t.name === "turn_retry_configure")!;
  const metricsTool = tools.find((t) => t.name === "turn_retry_get_metrics")!;

  const inspRes = (await inspectTool.execute({}, "")) as any;
  assert.strictEqual(inspRes.success, true);
  assert.strictEqual(inspRes.hasActiveState, true);

  const trigRes = (await triggerTool.execute({
    branch: "llamaCppGrammarRetryAttempted",
    details: "Grammar syntax error fallback",
  }, "")) as any;
  assert.strictEqual(trigRes.success, true);
  assert.strictEqual(trigRes.triggered, true);

  const sigRes = (await signalTool.execute({
    signalKey: "restartWithLengthContinuation",
    details: "Max token length reached",
  }, "")) as any;
  assert.strictEqual(sigRes.success, true);
  assert.strictEqual(sigRes.set, true);

  const cfgRes = (await configTool.execute({ maxRetriesPerTurn: 8 }, "")) as any;
  assert.strictEqual(cfgRes.success, true);
  assert.strictEqual(cfgRes.config.maxRetriesPerTurn, 8);

  const metRes = (await metricsTool.execute({}, "")) as any;
  assert.strictEqual(metRes.success, true);
  assert.ok(metRes.metrics.totalGuardsTriggered > 0);
  console.log("  [✓] All 5 Turn Retry model tools executed cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 8: High-Frequency State Transition Micro-Benchmarks
  // ---------------------------------------------------------------------------
  console.log("\n[Test 8/8] Benchmarking High-Frequency One-Shot Guard Checks...");

  const iterations = 100000;
  const config = substrate.getConfig();
  const testGuards = { ...activeState!.guards };

  const tBenchStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    engine.canTrigger("codexAuthRetryAttempted", testGuards, config);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} guard evaluations in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(throughputOpsPerSec > 1000000, "Throughput must exceed 1,000,000 ops/sec");

  console.log("  [✓] Ultra-high-throughput benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 TURN RETRY VALIDATION SUITES PASSED CLEANLY!          ");
  console.log("================================================================\n");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
