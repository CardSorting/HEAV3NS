/**
 * validate-thread-context.ts
 *
 * Comprehensive validation suite for Async Context Propagation,
 * Security Callback Inheritance & Fail-Closed Approval Lifecycle Subsystem (Phase 133 / ADR-109 / Target #66).
 */

import assert from "node:assert";
import { performance } from "node:perf_hooks";

import { DeterministicThreadContextEngine } from "../src/agents/extensions/thread_context/deterministic-thread-context-engine.js";
import { ThreadContextSupervisor } from "../src/agents/extensions/thread_context/thread-context-supervisor.js";
import { BroccoliThreadContextSubstrate } from "../src/sessions/extensions/thread_context/broccoli-thread-context-substrate.js";
import { ThreadContextSnapshotManager } from "../src/sessions/extensions/thread_context/thread-context-snapshot-manager.js";
import { ThreadContextToolSuite } from "../src/tooling/extensions/thread_context/thread-context-tool-suite.js";

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Async Context Propagation & Approvals (ADR-109)         ");
  console.log("================================================================\n");

  const substrate = new BroccoliThreadContextSubstrate();
  const engine = new DeterministicThreadContextEngine();
  const snapshotManager = new ThreadContextSnapshotManager(substrate);
  const supervisor = new ThreadContextSupervisor(substrate, engine);
  const toolSuite = new ThreadContextToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Suite 1: Thread Context Initialization & Registration
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating Thread Context Registration...");

  const ctx1 = supervisor.spawnContext({
    parentSessionId: "session-alpha-123",
    platform: "telegram",
    isInteractive: true,
  });

  assert.ok(ctx1.contextId.startsWith("ctx-"));
  assert.strictEqual(ctx1.parentSessionId, "session-alpha-123");
  assert.strictEqual(ctx1.platform, "telegram");
  assert.strictEqual(ctx1.isInteractive, true);
  console.log("  [✓] Async context descriptor spawned and registered.");

  // ---------------------------------------------------------------------------
  // Suite 2: AsyncLocalStorage Context Stack Binding & Zero-Leak Cleanup
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Context Stack Binding & Zero-Leak Cleanup...");

  let insideContextId: string | undefined;
  await supervisor.runInContext(
    ctx1,
    {
      approvalCallback: async (cmd) => cmd.includes("safe"),
      sudoPasswordCallback: async () => "secret123",
    },
    async () => {
      const current = supervisor.getActiveContext();
      insideContextId = current?.contextId;
      assert.strictEqual(insideContextId, ctx1.contextId);
    }
  );

  // Outside runInContext -> Context must be unmounted and substrate reference cleaned
  assert.strictEqual(supervisor.getActiveContext(), undefined);
  assert.strictEqual(substrate.getContext(ctx1.contextId), undefined);
  console.log("  [✓] Context cleanly mounted inside stack and destroyed on exit (zero-leak).");

  // ---------------------------------------------------------------------------
  // Suite 3: Security Approval Callback Propagation Across Worker Promises
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Callback Propagation Across Async Workers...");

  const ctx2 = supervisor.spawnContext({
    parentSessionId: "session-beta-456",
    platform: "cli",
    isInteractive: true,
  });

  await supervisor.runInContext(
    ctx2,
    {
      approvalCallback: async (cmd, reason) => {
        return cmd === "docker run safe" && reason.length > 0;
      },
    },
    async () => {
      // Create detached worker dispatch
      const workerDispatch = supervisor.wrapWorkerDispatch(async (testCmd: string) => {
        return await supervisor.requestDangerousApproval(testCmd, "Testing worker propagation");
      });

      const resSafe = await workerDispatch("docker run safe");
      assert.strictEqual(resSafe.approved, true);
      assert.strictEqual(resSafe.failClosed, false);

      const resDangerous = await workerDispatch("rm -rf /");
      assert.strictEqual(resDangerous.approved, false);
      assert.strictEqual(resDangerous.failClosed, false);
    }
  );
  console.log("  [✓] Security callbacks successfully propagated into detached async workers.");

  // ---------------------------------------------------------------------------
  // Suite 4: Fail-Closed Security Approval Evaluation
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Fail-Closed Security Approval...");

  // Unbound execution (no context / no callback) -> Must fail closed
  const unboundRes = await supervisor.requestDangerousApproval("sudo apt-get update", "Unbound dispatch");
  assert.strictEqual(unboundRes.approved, false);
  assert.strictEqual(unboundRes.failClosed, true);
  assert.ok(unboundRes.rationale.includes("Fail-closed"));

  const metrics = supervisor.getMetrics();
  assert.ok(metrics.totalFailClosedBlocks > 0);
  console.log(`  Fail-closed blocks: ${metrics.totalFailClosedBlocks}`);
  console.log("  [✓] Fail-closed security gate strictly blocked unapproved execution.");

  // ---------------------------------------------------------------------------
  // Suite 5: Sudo Password Resolution & Error Isolation
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Sudo Password Resolution & Error Isolation...");

  const ctx3 = supervisor.spawnContext({
    parentSessionId: "session-gamma-789",
    platform: "cli",
  });

  await supervisor.runInContext(
    ctx3,
    {
      sudoPasswordCallback: async () => "master-password-42",
    },
    async () => {
      const sudoPass = await supervisor.requestSudo();
      assert.strictEqual(sudoPass, "master-password-42");
    }
  );

  // Outside context -> Sudo must return undefined without throwing
  const outsideSudo = await supervisor.requestSudo();
  assert.strictEqual(outsideSudo, undefined);
  console.log("  [✓] Sudo password resolution and error boundary verified.");

  // ---------------------------------------------------------------------------
  // Suite 6: In-Memory Substrate Binary Snapshotting & O(1) Rollback
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Binary Snapshotting & O(1) Rollback...");

  const ctxSnap = supervisor.spawnContext({
    parentSessionId: "session-snap-1",
    platform: "discord",
  });

  const snap = snapshotManager.takeSnapshot("snap-thread-1");
  assert.ok(snap.contexts.length > 0);

  // Mutate substrate
  supervisor.spawnContext({
    parentSessionId: "session-snap-2",
    platform: "slack",
  });
  assert.strictEqual(supervisor.getAllContexts().length, snap.contexts.length + 1);

  // Rewind
  const tRewindStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("snap-thread-1");
  const rewindLatencyMs = performance.now() - tRewindStart;

  assert.ok(restored, "Snapshot restore must succeed");
  assert.strictEqual(supervisor.getAllContexts().length, snap.contexts.length);
  assert.ok(rewindLatencyMs < 0.05, `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.05 ms SLA`);
  console.log(`  [✓] Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms).`);

  // ---------------------------------------------------------------------------
  // Suite 7: Model Tool Suite Execution
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Model Tool Suite Execution...");

  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 5, "Must expose exactly 5 model tools");

  const inspectTool = tools.find((t) => t.name === "thread_context_inspect")!;
  const approvalTool = tools.find((t) => t.name === "thread_context_request_approval")!;
  const verifyTool = tools.find((t) => t.name === "thread_context_verify_propagation")!;
  const configTool = tools.find((t) => t.name === "thread_context_configure")!;
  const metricsTool = tools.find((t) => t.name === "thread_context_get_metrics")!;

  const inspRes = (await inspectTool.execute({}, "")) as any;
  assert.strictEqual(inspRes.success, true);

  const apprRes = (await approvalTool.execute({ command: "rm -rf /", reason: "Model test" }, "")) as any;
  assert.strictEqual(apprRes.success, true);
  assert.strictEqual(apprRes.approved, false);
  assert.strictEqual(apprRes.failClosed, true);

  const verRes = (await verifyTool.execute({}, "")) as any;
  assert.strictEqual(verRes.success, true);

  const cfgRes = (await configTool.execute({ failClosedOnMissingApproval: true }, "")) as any;
  assert.strictEqual(cfgRes.success, true);

  const metRes = (await metricsTool.execute({}, "")) as any;
  assert.strictEqual(metRes.success, true);
  assert.ok(metRes.metrics.totalFailClosedBlocks > 0);
  console.log("  [✓] All 5 Thread Context model tools executed cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 8: High-Frequency Context Switching Micro-Benchmarks
  // ---------------------------------------------------------------------------
  console.log("\n[Test 8/8] Benchmarking High-Frequency Context Wrapping...");

  const iterations = 100000;
  const testStore = {
    descriptor: ctxSnap,
  };

  const tBenchStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    engine.runWithStore(testStore, () => {
      engine.getActiveContextStore();
    });
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} context runs in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(throughputOpsPerSec > 1000000, "Throughput must exceed 1,000,000 ops/sec");

  console.log("  [✓] Ultra-high-throughput benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 THREAD CONTEXT VALIDATION SUITES PASSED CLEANLY!       ");
  console.log("================================================================\n");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
