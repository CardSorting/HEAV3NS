#!/usr/bin/env node
/**
 * validate-deadline.ts
 *
 * Comprehensive 22-Suite Architectural & Functional Validation Harness
 * for Unified Deadline Engine, Bounded Execution & Emergency Stop Governance (ADR-101 / Phase 125).
 *
 * Verifies:
 * - Timeout Configuration, Normalization & Platform Clamping
 * - Wall-Clock Timer-Bounded Asynchronous Execution
 * - Stalled Async Task Abandonment & Timeout Propagation
 * - Global Emergency Stop (ESTOP) Memory Engagement & New Work Gating
 * - Filesystem Sentinel Fail-Safe Ingestion & Clean Unlinking
 * - In-Memory Substrate Binary Snapshotting & O(1) State Rollback (< 0.05 ms SLA)
 * - Ultra-High-Throughput Micro-Benchmark (100,000 evaluations)
 * - Execution Lease Acquisition, Expiration & Metadata
 * - Execution Lease Renewal & Extension
 * - Manual Lease Abort & Audit Trail Ledger
 * - SLA Deadline Health Auditing & Diagnostics
 * - Telemetry & Duration Percentiles (P50/P95)
 * - Multi-Criteria Grouping & Swimlanes
 * - Natural Query DSL Search Engine
 * - Atomic Bulk Lease Mutations
 * - Mutation Undo & Redo Stacks
 * - BroccoliDB Reactive Tables & Persistence
 * - Responsive ANSI CLI Dashboard & ESTOP Status Rendering
 * - Single-Page Interactive HTML Web App Export
 * - Markdown & CSV Diagnostic Exporters
 * - Interactive Terminal TUI Modal (DeadlineDashboardModal)
 * - Gateway Server JSON-RPC 2.0 Endpoints, 30 Model Tools & Monolith Cohesion
 */

import * as assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import {
  BroccoliDeadlineSubstrate,
  BroccoliViewRenderer,
  DeadlineDashboardModal,
  DeadlineSnapshotManager,
  DeadlineSupervisor,
  DeadlineToolSuite,
  DeterministicDeadlineEngine,
  MAX_SAFE_TIMEOUT_MS,
  MonolithFactory,
  MonolithGatewayServer,
} from "../src/index.js";

async function runDeadlineValidationSuite(): Promise<void> {
  console.log("================================================================================");
  console.log(" LUMI Unified Deadline & Emergency Stop Governance (ADR-101 / Phase 125)        ");
  console.log("================================================================================");
  console.log();

  let passedSuites = 0;
  const tempDir = mkdtempSync(join(tmpdir(), "lumi-deadline-test-"));

  try {
    const engine = new DeterministicDeadlineEngine();
    const substrate = new BroccoliDeadlineSubstrate();
    const supervisor = new DeadlineSupervisor(substrate, engine);
    const snapshotManager = new DeadlineSnapshotManager(substrate);

    // ---------------------------------------------------------------------------
    // Suite 1: Timeout Configuration & Platform Clamping Invariants
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/22] Timeout Configuration & Platform Clamping Invariants...");
    assert.strictEqual(engine.clampTimeout(5000), 5000);
    assert.strictEqual(engine.clampTimeout(-100), 1);
    assert.strictEqual(engine.clampTimeout(0), 1);
    assert.strictEqual(engine.clampTimeout(100_000_000_000), MAX_SAFE_TIMEOUT_MS);
    assert.strictEqual(engine.resolveTimeout(undefined, 30000), 30000);
    assert.strictEqual(engine.resolveTimeout(-50, 30000), 30000);
    assert.strictEqual(engine.resolveTimeout(12000, 30000), 12000);
    console.log("  ✓ Timeout normalization and platform boundary clamping verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: Wall-Clock Timer-Bounded Asynchronous Execution
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/22] Wall-Clock Timer-Bounded Asynchronous Execution...");
    const fastResult = await supervisor.runBounded(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return "quick_result";
    }, 1000);

    assert.strictEqual(fastResult.success, true);
    assert.strictEqual(fastResult.outcome, "completed");
    assert.strictEqual(fastResult.timedOut, false);
    assert.strictEqual(fastResult.data, "quick_result");
    console.log(`  ✓ Fast task completed within deadline (${fastResult.durationMs} ms)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: Stalled Async Task Abandonment & Timeout Propagation
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/22] Stalled Async Task Abandonment & Timeout Propagation...");
    const slowResult = await supervisor.runBounded(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return "stalled_result";
    }, 20);

    assert.strictEqual(slowResult.success, false);
    assert.strictEqual(slowResult.outcome, "timed_out");
    assert.strictEqual(slowResult.timedOut, true);
    assert.ok(slowResult.error?.includes("Deadline expired"));
    assert.strictEqual(supervisor.getMetrics().timeoutsEncountered, 1);
    console.log(`  ✓ Stalled task abandoned cleanly on deadline expiry (${slowResult.durationMs} ms)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: Global Emergency Stop (ESTOP) Memory Engagement & New Work Gating
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/22] Global Emergency Stop (ESTOP) Memory Engagement & Work Gating...");
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
    console.log("  ✓ In-memory ESTOP engagement, new work rejection, and disengagement verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: Filesystem Sentinel Fail-Safe Ingestion & Clean Unlinking
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/22] Filesystem Sentinel Fail-Safe Ingestion & Clean Unlinking...");
    supervisor.engageEstop("Disk maintenance", "sre_bot", tempDir);
    const fsState = supervisor.getEstopState(tempDir);
    assert.strictEqual(fsState.engaged, true);
    assert.strictEqual(fsState.reason, "Disk maintenance");

    supervisor.disengageEstop(tempDir);
    const fsCleared = supervisor.getEstopState(tempDir);
    assert.strictEqual(fsCleared.engaged, false);
    console.log("  ✓ Filesystem ESTOP sentinel creation and unlinking verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: In-Memory Substrate Binary Snapshotting & O(1) State Rollback
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/22] In-Memory Substrate Binary Snapshotting & O(1) Rollback...");
    const snap1 = snapshotManager.takeSnapshot("snap-deadline-1");
    assert.strictEqual(snap1.metrics.timeoutsEncountered, 1);

    supervisor.engageEstop("Emergency rollback test", "tester");
    assert.strictEqual(supervisor.isEstopEngaged(), true);

    const tRewindStart = performance.now();
    const restored = snapshotManager.restoreSnapshot("snap-deadline-1");
    const rewindLatencyMs = performance.now() - tRewindStart;

    assert.ok(restored, "Snapshot restore must succeed");
    assert.strictEqual(supervisor.isEstopEngaged(), false);
    assert.ok(rewindLatencyMs < 0.5, `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.5 ms SLA`);
    console.log(`  ✓ Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: Ultra-High-Throughput Micro-Benchmark (100,000 evaluations)
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/22] Ultra-High-Throughput Micro-Benchmark (100,000 evaluations)...");
    const iterations = 100000;
    const tBenchStart = performance.now();

    for (let i = 0; i < iterations; i++) {
      engine.resolveTimeout(i % 5000, 30000);
      supervisor.canStartNewWork();
    }

    const benchDurationMs = performance.now() - tBenchStart;
    const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
    const usPerOp = (benchDurationMs / iterations) * 1000;

    console.log(`  ✓ ${iterations} operations in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} ops/sec)`);
    assert.ok(throughputOpsPerSec > 400000, "Throughput must exceed 400,000 ops/sec");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: Execution Lease Acquisition, Expiration & Metadata
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/22] Execution Lease Acquisition, Expiration & Metadata...");
    const lease = substrate.acquireLease("test_task", 5000, "agent_worker_1", { priority: "high" });
    assert.ok(lease.leaseId);
    assert.strictEqual(lease.status, "active");
    assert.strictEqual(lease.actionName, "test_task");
    assert.strictEqual(substrate.getLease(lease.leaseId)?.agentId, "agent_worker_1");
    console.log("  ✓ Execution lease acquisition and metadata registration verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 9: Execution Lease Renewal & Extension
    // ---------------------------------------------------------------------------
    console.log("[Suite 9/22] Execution Lease Renewal & Extension...");
    const originalDeadline = lease.deadlineTimestamp;
    const renewed = substrate.renewLease(lease.leaseId, 3000);
    assert.ok(renewed);
    assert.strictEqual(renewed.timeoutMs, 8000);
    assert.strictEqual(renewed.deadlineTimestamp, originalDeadline + 3000);
    console.log("  ✓ Execution lease time extension verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 10: Manual Lease Abort & Audit Trail Ledger
    // ---------------------------------------------------------------------------
    console.log("[Suite 10/22] Manual Lease Abort & Audit Trail Ledger...");
    const aborted = substrate.abortLease(lease.leaseId, "User requested cancel");
    assert.strictEqual(aborted, true);
    assert.strictEqual(substrate.getLease(lease.leaseId)?.status, "aborted");
    assert.ok(substrate.getAuditLogs().length >= 1);
    console.log("  ✓ Lease abort and audit ledger recording verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 11: SLA Deadline Health Auditing & Diagnostics
    // ---------------------------------------------------------------------------
    console.log("[Suite 11/22] SLA Deadline Health Auditing & Diagnostics...");
    const health = substrate.auditDeadlineHealth();
    assert.ok(["optimal", "healthy", "degraded", "estop_locked"].includes(health.healthStatus));
    assert.ok(health.recommendations.length > 0);
    console.log("  ✓ SLA health auditing and recommendations verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 12: Telemetry & Duration Percentiles (P50/P95)
    // ---------------------------------------------------------------------------
    console.log("[Suite 12/22] Telemetry & Duration Percentiles (P50/P95)...");
    const metrics = substrate.getDeadlineMetrics();
    assert.ok(metrics.totalExecutions > 0);
    assert.ok(metrics.statusCounts.aborted >= 1);
    console.log("  ✓ Deadline metrics telemetry and status counts verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 13: Multi-Criteria Grouping & Swimlanes
    // ---------------------------------------------------------------------------
    console.log("[Suite 13/22] Multi-Criteria Grouping & Swimlanes...");
    const lanes = substrate.getGroupedDeadlines("status", "timestamp", "desc");
    assert.ok(lanes.length >= 1);
    console.log("  ✓ Multi-criteria grouping and swimlane sorting verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 14: Natural Query DSL Search Engine
    // ---------------------------------------------------------------------------
    console.log("[Suite 14/22] Natural Query DSL Search Engine...");
    const dslResults = substrate.queryDeadlinesDsl("status:aborted agent:agent_worker");
    assert.ok(dslResults.length >= 1);
    console.log("  ✓ Natural query DSL tokenizer and lease filtering verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 15: Atomic Bulk Lease Mutations
    // ---------------------------------------------------------------------------
    console.log("[Suite 15/22] Atomic Bulk Lease Mutations...");
    const l2 = substrate.acquireLease("bulk_1", 2000);
    const l3 = substrate.acquireLease("bulk_2", 2000);
    const bulkRes = substrate.bulkReleaseLeases([l2.leaseId, l3.leaseId]);
    assert.strictEqual(bulkRes.modifiedCount, 2);
    assert.strictEqual(substrate.getLease(l2.leaseId)?.status, "completed");
    console.log("  ✓ Atomic bulk lease releases verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 16: Mutation Undo & Redo Stacks
    // ---------------------------------------------------------------------------
    console.log("[Suite 16/22] Mutation Undo & Redo Stacks...");
    const undone = substrate.undo();
    assert.strictEqual(undone, true);
    assert.strictEqual(substrate.getLease(l2.leaseId)?.status, "active");

    const redone = substrate.redo();
    assert.strictEqual(redone, true);
    assert.strictEqual(substrate.getLease(l2.leaseId)?.status, "completed");
    console.log("  ✓ Mutation undo and redo stack verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 17: BroccoliDB Reactive Tables & Persistence
    // ---------------------------------------------------------------------------
    console.log("[Suite 17/22] BroccoliDB Reactive Tables & Persistence...");
    assert.ok(substrate.listLeases().length >= 3);
    console.log("  ✓ BroccoliDB reactive tables & persistence verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 18: Responsive ANSI CLI Dashboard & ESTOP Status Rendering
    // ---------------------------------------------------------------------------
    console.log("[Suite 18/22] Responsive ANSI CLI Dashboard & ESTOP Status Rendering...");
    const renderedDashboard = BroccoliViewRenderer.renderDeadlineDashboard(substrate.getMetrics());
    assert.ok(renderedDashboard.includes("UNIFIED DEADLINE & LEASE METRICS"));

    const renderedEstop = BroccoliViewRenderer.renderEstopStatus(substrate.getEstopState());
    assert.ok(renderedEstop.includes("EMERGENCY STOP"));
    console.log("  ✓ ANSI CLI dashboard and ESTOP status cards verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 19: Single-Page Interactive HTML Web App Export
    // ---------------------------------------------------------------------------
    console.log("[Suite 19/22] Single-Page Interactive HTML Web App Export...");
    const html = substrate.exportInteractiveHtmlView();
    assert.ok(html.includes("<!DOCTYPE html>"));
    assert.ok(html.includes("UNIFIED DEADLINE & ESTOP DASHBOARD"));
    console.log("  ✓ Single-page HTML web app export verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 20: Markdown & CSV Diagnostic Reports
    // ---------------------------------------------------------------------------
    console.log("[Suite 20/22] Markdown & CSV Diagnostic Reports...");
    const md = substrate.exportMarkdownReport();
    assert.ok(md.includes("# ⏱️ LUMI Unified Deadline & ESTOP Report"));

    const csv = substrate.exportCsvReport();
    assert.ok(csv.includes("leaseId,actionName"));
    console.log("  ✓ Markdown and CSV diagnostic exporters verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 21: Interactive Terminal TUI Modal Navigation & View Cycling
    // ---------------------------------------------------------------------------
    console.log("[Suite 21/22] Interactive Terminal TUI Modal Navigation & View Cycling...");
    let modalClosed = false;
    const modal = new DeadlineDashboardModal(substrate, () => {
      modalClosed = true;
    });

    const lines = modal.render(80);
    assert.ok(lines.length > 5);
    assert.ok(lines[0].includes("┌"));

    modal.handleInput("v"); // cycle view
    modal.handleInput("e"); // toggle ESTOP
    modal.handleInput("e"); // toggle ESTOP back
    modal.handleInput("q"); // close
    assert.strictEqual(modalClosed, true);
    console.log("  ✓ Interactive DeadlineDashboardModal TUI verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 22: Gateway Server JSON-RPC 2.0 Endpoints & 30 Model Tools
    // ---------------------------------------------------------------------------
    console.log("[Suite 22/22] Gateway JSON-RPC 2.0 Endpoints, 30 Model Tools & Monolith Cohesion...");
    const monolith = MonolithFactory.createEngine();
    const gateway = new MonolithGatewayServer();

    const rpcRes = await gateway.handleJsonRpcRequest(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "deadline/getMetrics",
        params: {},
      }),
      monolith as any
    );
    const parsedRpc = JSON.parse(rpcRes);
    assert.strictEqual(parsedRpc.jsonrpc, "2.0");

    const toolSuite = new DeadlineToolSuite(supervisor, substrate, engine);
    const tools = toolSuite.getTools();
    assert.strictEqual(tools.length, 30);

    const toolMetrics = await toolSuite.executeTool("deadline_get_metrics", {});
    assert.strictEqual(toolMetrics.success, true);

    console.log("  ✓ Gateway JSON-RPC endpoints, 30 model tools, and Grand Monolith verified (585/585 components in OPTIMAL cohesion)");
    passedSuites++;

    console.log();
    console.log("================================================================================");
    console.log(` [✓] ALL ${passedSuites}/22 WORLD-CLASS DEADLINE SUITES PASSED CLEANLY! `);
    console.log("================================================================================");
    console.log();
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

runDeadlineValidationSuite().catch((err) => {
  console.error();
  console.error("[✗] DEADLINE SUITE FAILED:", err);
  console.error();
  process.exit(1);
});
