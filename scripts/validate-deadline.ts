/**
 * validate-deadline.ts
 *
 * Comprehensive validation suite for Unified Deadline Engine, Bounded Execution &
 * Emergency Stop Governance Subsystem (Phase 125 / ADR-101 / Target #58).
 */

import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { DeterministicDeadlineEngine } from "../src/agents/extensions/deadline/deterministic-deadline-engine.js";
import { DeadlineSupervisor } from "../src/agents/extensions/deadline/deadline-supervisor.js";
import { BroccoliDeadlineSubstrate } from "../src/sessions/extensions/deadline/broccoli-deadline-substrate.js";
import { DeadlineSnapshotManager } from "../src/sessions/extensions/deadline/deadline-snapshot-manager.js";
import { DeadlineToolSuite } from "../src/tooling/extensions/deadline/deadline-tool-suite.js";
import { MAX_SAFE_TIMEOUT_MS } from "../src/core/contracts/deadline.contracts.js";

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Deadline & Emergency Stop Validation (ADR-101)         ");
  console.log("================================================================\n");

  const tempDir = mkdtempSync(join(tmpdir(), "lumi-deadline-test-"));
  const engine = new DeterministicDeadlineEngine();
  const substrate = new BroccoliDeadlineSubstrate();
  const snapshotManager = new DeadlineSnapshotManager(substrate);
  const supervisor = new DeadlineSupervisor(substrate, engine);
  const toolSuite = new DeadlineToolSuite(supervisor);

  try {
    // ---------------------------------------------------------------------------
    // Suite 1: Timeout Configuration & Platform Clamping Invariants
    // ---------------------------------------------------------------------------
    console.log("[Test 1/8] Validating Timeout Configuration & Platform Clamping Invariants...");

    assert.strictEqual(engine.clampTimeout(5000), 5000);
    assert.strictEqual(engine.clampTimeout(-100), 1);
    assert.strictEqual(engine.clampTimeout(0), 1);
    assert.strictEqual(engine.clampTimeout(100_000_000_000), MAX_SAFE_TIMEOUT_MS);
    assert.strictEqual(engine.resolveTimeout(undefined, 30000), 30000);
    assert.strictEqual(engine.resolveTimeout(-50, 30000), 30000);
    assert.strictEqual(engine.resolveTimeout(12000, 30000), 12000);
    console.log("  [✓] Timeout normalization and platform boundary clamping verified.");

    // ---------------------------------------------------------------------------
    // Suite 2: Wall-Clock Timer-Bounded Asynchronous Execution
    // ---------------------------------------------------------------------------
    console.log("\n[Test 2/8] Validating Wall-Clock Timer-Bounded Execution...");

    const fastResult = await supervisor.runBounded(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return "quick_result";
    }, 1000);

    assert.strictEqual(fastResult.success, true);
    assert.strictEqual(fastResult.outcome, "completed");
    assert.strictEqual(fastResult.timedOut, false);
    assert.strictEqual(fastResult.data, "quick_result");
    console.log(`  [✓] Fast task completed within deadline (${fastResult.durationMs} ms).`);

    // ---------------------------------------------------------------------------
    // Suite 3: Stalled Async Task Abandonment & Timeout Propagation
    // ---------------------------------------------------------------------------
    console.log("\n[Test 3/8] Validating Stalled Task Abandonment & Timeout Propagation...");

    const slowResult = await supervisor.runBounded(async () => {
      // Simulate stalled asynchronous promise
      await new Promise((resolve) => setTimeout(resolve, 500));
      return "stalled_result";
    }, 20);

    assert.strictEqual(slowResult.success, false);
    assert.strictEqual(slowResult.outcome, "timed_out");
    assert.strictEqual(slowResult.timedOut, true);
    assert.ok(slowResult.error?.includes("Deadline expired"));
    assert.strictEqual(supervisor.getMetrics().timeoutsEncountered, 1);
    console.log(`  [✓] Stalled task abandoned cleanly on deadline expiry (${slowResult.durationMs} ms).`);

    // ---------------------------------------------------------------------------
    // Suite 4: Global Emergency Stop (ESTOP) Memory Engagement & New Work Gating
    // ---------------------------------------------------------------------------
    console.log("\n[Test 4/8] Validating ESTOP Engagement & New Work Gating...");

    assert.strictEqual(supervisor.isEstopEngaged(), false);
    assert.strictEqual(supervisor.canStartNewWork().allowed, true);

    supervisor.engageEstop("Maintenance window", "admin_user");
    assert.strictEqual(supervisor.isEstopEngaged(), true);
    assert.strictEqual(supervisor.canStartNewWork().allowed, false);

    const blockedRun = await supervisor.runBounded(async () => "never_runs", 1000);
    assert.strictEqual(blockedRun.success, false);
    assert.strictEqual(blockedRun.outcome, "estopped");
    assert.strictEqual(supervisor.getMetrics().estopRejections, 2);

    supervisor.disengageEstop();
    assert.strictEqual(supervisor.isEstopEngaged(), false);
    assert.strictEqual(supervisor.canStartNewWork().allowed, true);
    console.log("  [✓] In-memory ESTOP engagement, new work rejection, and disengagement verified.");

    // ---------------------------------------------------------------------------
    // Suite 5: Filesystem Sentinel Fail-Safe Ingestion & Clean Unlinking
    // ---------------------------------------------------------------------------
    console.log("\n[Test 5/8] Validating Filesystem Sentinel Fail-Safe Ingestion...");

    supervisor.engageEstop("Disk maintenance", "sre_bot", tempDir);
    const fsState = supervisor.getEstopState(tempDir);
    assert.strictEqual(fsState.engaged, true);
    assert.strictEqual(fsState.reason, "Disk maintenance");

    supervisor.disengageEstop(tempDir);
    const fsCleared = supervisor.getEstopState(tempDir);
    assert.strictEqual(fsCleared.engaged, false);
    console.log("  [✓] Filesystem ESTOP sentinel creation and unlinking verified.");

    // ---------------------------------------------------------------------------
    // Suite 6: In-Memory Substrate Binary Snapshotting & O(1) State Rollback
    // ---------------------------------------------------------------------------
    console.log("\n[Test 6/8] Validating Binary Snapshotting & O(1) State Rollback...");

    const snap1 = snapshotManager.takeSnapshot("snap-deadline-1");
    assert.strictEqual(snap1.metrics.timeoutsEncountered, 1);

    // Modify state
    supervisor.engageEstop("Emergency rollback test", "tester");
    assert.strictEqual(supervisor.isEstopEngaged(), true);

    // Rollback
    const tRewindStart = performance.now();
    const restored = snapshotManager.restoreSnapshot("snap-deadline-1");
    const rewindLatencyMs = performance.now() - tRewindStart;

    assert.ok(restored, "Snapshot restore must succeed");
    assert.strictEqual(supervisor.isEstopEngaged(), false);
    assert.ok(rewindLatencyMs < 0.1, `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.1 ms SLA`);
    console.log(`  [✓] Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms).`);

    // ---------------------------------------------------------------------------
    // Suite 7: Model Tool Suite Execution
    // ---------------------------------------------------------------------------
    console.log("\n[Test 7/8] Validating Model Tool Suite Execution...");

    const tools = toolSuite.getTools();
    assert.strictEqual(tools.length, 5, "Must expose exactly 5 model tools");

    const runBoundedTool = tools.find((t) => t.name === "deadline_run_bounded")!;
    const engageTool = tools.find((t) => t.name === "estop_engage")!;
    const disengageTool = tools.find((t) => t.name === "estop_disengage")!;
    const statusTool = tools.find((t) => t.name === "estop_get_status")!;
    const metricsTool = tools.find((t) => t.name === "deadline_get_metrics")!;

    const runRes = (await runBoundedTool.execute({
      actionName: "test_job",
      timeoutMs: 100,
      simulatedDurationMs: 5,
    }, "")) as any;
    assert.strictEqual(runRes.success, true);
    assert.strictEqual(runRes.outcome, "completed");

    const engageRes = (await engageTool.execute({
      reason: "Tool test pause",
      engagedBy: "agent_runner",
    }, "")) as any;
    assert.strictEqual(engageRes.success, true);
    assert.strictEqual(engageRes.engaged, true);

    const statusRes = (await statusTool.execute({}, "")) as any;
    assert.strictEqual(statusRes.engaged, true);

    const disengageRes = (await disengageTool.execute({}, "")) as any;
    assert.strictEqual(disengageRes.engaged, false);

    const metricsRes = (await metricsTool.execute({}, "")) as any;
    assert.strictEqual(metricsRes.success, true);
    assert.ok(metricsRes.metrics.totalExecutions > 0);
    console.log("  [✓] All 5 Deadline & ESTOP model tools executed cleanly.");

    // ---------------------------------------------------------------------------
    // Suite 8: Ultra-High-Throughput Micro-Benchmark
    // ---------------------------------------------------------------------------
    console.log("\n[Test 8/8] Validating Ultra-High-Throughput Micro-Benchmark...");

    const iterations = 100000;
    const tBenchStart = performance.now();

    for (let i = 0; i < iterations; i++) {
      engine.resolveTimeout(i % 5000, 30000);
      supervisor.canStartNewWork();
    }

    const benchDurationMs = performance.now() - tBenchStart;
    const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
    const usPerOp = (benchDurationMs / iterations) * 1000;

    console.log(`  Measured: ${iterations} operations in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} ops/sec)`);
    assert.ok(throughputOpsPerSec > 500000, "Throughput must exceed 500,000 ops/sec");

    console.log("  [✓] Ultra-high-throughput micro-benchmark passed.");

    console.log("\n================================================================");
    console.log("   ALL 8 DEADLINE & ESTOP VALIDATION SUITES PASSED CLEANLY!    ");
    console.log("================================================================\n");
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
