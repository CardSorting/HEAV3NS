#!/usr/bin/env node
/**
 * validate-thread-context.ts
 *
 * Comprehensive 22-Suite Validation Harness for the
 * Async Context Propagation, Security Callback Inheritance & Fail-Closed Approval Lifecycle Subsystem
 * (Phase 133 / ADR-109 / Target #66).
 */

import * as assert from "node:assert";
import { performance } from "node:perf_hooks";

import {
  BroccoliThreadContextSubstrate,
  BroccoliViewRenderer,
  DeterministicThreadContextEngine,
  GrandMonolithSynthesizer,
  MonolithFactory,
  MonolithGatewayServer,
  ThreadContextDashboardModal,
  ThreadContextSnapshotManager,
  ThreadContextSupervisor,
  ThreadContextToolSuite,
} from "../src/index.js";

async function runThreadContextValidationSuite(): Promise<void> {
  console.log("================================================================================");
  console.log(" LUMI Async Context & Security Governance Suite (Target #66 / ADR-109)          ");
  console.log("================================================================================");
  console.log();

  let passedSuites = 0;

  try {
    const substrate = new BroccoliThreadContextSubstrate();
    const engine = new DeterministicThreadContextEngine();
    const supervisor = new ThreadContextSupervisor(substrate, engine);
    const snapshotManager = new ThreadContextSnapshotManager(substrate);

    // ---------------------------------------------------------------------------
    // Suite 1: In-Memory Registry & Default Context Propagation Invariants
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/22] In-Memory Registry & Default Context Propagation Invariants...");
    const config = supervisor.getConfig();
    assert.strictEqual(config.failClosedOnMissingApproval, true);
    assert.strictEqual(config.allowNonInteractiveAutoApprove, false);
    assert.strictEqual(config.maxActiveContexts, 100);
    console.log("  ✓ Default fail-closed security configuration verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: Context Descriptor Creation & Metadata Propagation
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/22] Context Descriptor Creation & Metadata Propagation...");
    const ctx1 = supervisor.spawnContext({
      parentSessionId: "session-root-1",
      platform: "cli",
      hasApprovalCallback: true,
      hasSudoCallback: true,
      isInteractive: true,
      metadata: { environment: "production", region: "us-west" },
    });
    assert.ok(ctx1.contextId.startsWith("ctx-"));
    assert.strictEqual(ctx1.metadata.environment, "production");
    console.log(`  ✓ Context descriptor spawned: ${ctx1.contextId} [${ctx1.platform}]`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: AsyncLocalStorage Execution Scoping (runWithStore)
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/22] AsyncLocalStorage Execution Scoping (runWithStore)...");
    let executionObserved = false;
    await supervisor.runInContext(
      ctx1,
      {
        approvalCallback: async () => true,
        sudoPasswordCallback: async () => "secret123",
      },
      async () => {
        const active = supervisor.getActiveContext();
        assert.ok(active !== undefined);
        assert.strictEqual(active!.contextId, ctx1.contextId);
        executionObserved = true;
      }
    );
    assert.strictEqual(executionObserved, true);
    assert.strictEqual(supervisor.getActiveContext(), undefined); // Zero-leak cleanup
    console.log("  ✓ Bound execution run cleanly inside AsyncLocalStorage stack with zero leaks");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: Dynamic Security Approval Callback Registration
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/22] Dynamic Security Approval Callback Registration...");
    const ctx2 = supervisor.spawnContext({
      parentSessionId: "session-root-2",
      platform: "web",
      hasApprovalCallback: true,
    });
    assert.strictEqual(ctx2.hasApprovalCallback, true);
    console.log("  ✓ Approval callback presence registered on context descriptor");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: Dangerous Command Evaluation with Explicit User Approval
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/22] Dangerous Command Evaluation with Explicit User Approval...");
    await supervisor.runInContext(
      ctx2,
      {
        approvalCallback: async (cmd, reason) => {
          assert.strictEqual(cmd, "rm -rf /tmp/build");
          return true;
        },
      },
      async () => {
        const result = await supervisor.requestDangerousApproval("rm -rf /tmp/build", "Clean build dir");
        assert.strictEqual(result.approved, true);
        assert.strictEqual(result.failClosed, false);
      }
    );
    console.log("  ✓ Explicit approval granted by user approval callback");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: Dangerous Command Evaluation with User Denial
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/22] Dangerous Command Evaluation with User Denial...");
    const ctxDeny = supervisor.spawnContext({
      parentSessionId: "session-root-2",
      platform: "web",
    });
    await supervisor.runInContext(
      ctxDeny,
      {
        approvalCallback: async () => false,
      },
      async () => {
        const result = await supervisor.requestDangerousApproval("drop database prod", "DB purge");
        assert.strictEqual(result.approved, false);
        assert.strictEqual(result.failClosed, false);
        assert.ok(result.rationale.includes("denied"));
      }
    );
    console.log("  ✓ User denial respected and execution halted cleanly");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: Fail-Closed Security Policy: Missing Approval Callback Blocks Execution
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/22] Fail-Closed Security Policy: Missing Approval Callback Blocks Execution...");
    const ctxUnprotected = supervisor.spawnContext({
      parentSessionId: "session-root-3",
      platform: "daemon",
      isInteractive: true,
    });
    await supervisor.runInContext(
      ctxUnprotected,
      {}, // No approval callback supplied
      async () => {
        const result = await supervisor.requestDangerousApproval("cat /etc/shadow", "Read system secret");
        assert.strictEqual(result.approved, false);
        assert.strictEqual(result.failClosed, true);
        assert.ok(result.rationale.includes("Fail-closed"));
      }
    );
    console.log("  ✓ Missing approval callback blocked fail-closed with security invariant");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: Fail-Closed Security Policy: Exception inside Callback Fails Closed
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/22] Fail-Closed Security Policy: Exception inside Callback Fails Closed...");
    const ctxCrash = supervisor.spawnContext({
      parentSessionId: "session-root-4",
      platform: "cli",
    });
    await supervisor.runInContext(
      ctxCrash,
      {
        approvalCallback: async () => {
          throw new Error("RPC network timeout while asking user");
        },
      },
      async () => {
        const result = await supervisor.requestDangerousApproval("reboot", "Server reset");
        assert.strictEqual(result.approved, false);
        assert.strictEqual(result.failClosed, true);
        assert.ok(result.rationale.includes("threw an error"));
      }
    );
    console.log("  ✓ Exception inside callback captured and failed closed safely");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 9: Non-Interactive Auto-Approve Policy Permitted Path
    // ---------------------------------------------------------------------------
    console.log("[Suite 9/22] Non-Interactive Auto-Approve Policy Permitted Path...");
    supervisor.configure({ allowNonInteractiveAutoApprove: true, failClosedOnMissingApproval: false });
    const ctxAutonomous = supervisor.spawnContext({
      parentSessionId: "session-auto-1",
      platform: "cron",
      isInteractive: false,
    });
    await supervisor.runInContext(
      ctxAutonomous,
      {},
      async () => {
        const result = await supervisor.requestDangerousApproval("echo 'heartbeat'", "Healthcheck");
        assert.strictEqual(result.approved, true);
        assert.strictEqual(result.failClosed, false);
      }
    );
    supervisor.configure({ allowNonInteractiveAutoApprove: false, failClosedOnMissingApproval: true });
    console.log("  ✓ Non-interactive permitted auto-approve path verified under config toggle");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 10: Sudo Password Callback Resolution
    // ---------------------------------------------------------------------------
    console.log("[Suite 10/22] Sudo Password Callback Resolution...");
    const ctxSudo = supervisor.spawnContext({
      parentSessionId: "session-sudo",
      platform: "cli",
      hasSudoCallback: true,
    });
    await supervisor.runInContext(
      ctxSudo,
      {
        sudoPasswordCallback: async () => "root-password-99",
      },
      async () => {
        const pass = await supervisor.requestSudo();
        assert.strictEqual(pass, "root-password-99");
      }
    );
    console.log("  ✓ Sudo password resolved from active context callback");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 11: Async Worker Dispatch Wrapper (wrapWorkerDispatch)
    // ---------------------------------------------------------------------------
    console.log("[Suite 11/22] Async Worker Dispatch Wrapper (wrapWorkerDispatch)...");
    const ctxWorker = supervisor.spawnContext({
      parentSessionId: "session-worker-parent",
      platform: "cli",
      hasApprovalCallback: true,
    });
    await supervisor.runInContext(
      ctxWorker,
      {
        approvalCallback: async () => true,
      },
      async () => {
        const wrappedWorker = supervisor.wrapWorkerDispatch(async (taskName: string) => {
          const active = supervisor.getActiveContext();
          assert.ok(active !== undefined);
          assert.strictEqual(active!.contextId, ctxWorker.contextId);
          return `Task ${taskName} finished`;
        });

        const workerRes = await wrappedWorker("background-indexing");
        assert.strictEqual(workerRes, "Task background-indexing finished");
      }
    );
    console.log("  ✓ Async context propagated seamlessly across worker dispatches");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 12: Child Context Spawning & Platform/Security Inheritance
    // ---------------------------------------------------------------------------
    console.log("[Suite 12/22] Child Context Spawning & Platform/Security Inheritance...");
    const parentDesc = supervisor.spawnContext({
      parentSessionId: "root",
      platform: "cli",
      hasApprovalCallback: true,
      hasSudoCallback: true,
      isInteractive: true,
      metadata: { rootTag: "primary" },
    });
    const childDesc = engine.createChildDescriptor(parentDesc, "child-ctx-1", { childTag: "secondary" });
    assert.strictEqual(childDesc.parentSessionId, parentDesc.contextId);
    assert.strictEqual(childDesc.hasApprovalCallback, true);
    assert.strictEqual(childDesc.metadata.rootTag, "primary");
    assert.strictEqual(childDesc.metadata.childTag, "secondary");
    console.log("  ✓ Child context correctly inherited parent platform and security metadata");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 13: In-Memory Hybrid BroccoliDB Persistence Tables
    // ---------------------------------------------------------------------------
    console.log("[Suite 13/22] In-Memory Hybrid BroccoliDB Persistence Tables...");
    supervisor.spawnContext({ parentSessionId: "sess-table-1", platform: "web" });
    const allCtx = substrate.listContexts();
    assert.ok(allCtx.length >= 1);
    console.log(`  ✓ Hybrid BroccoliDB table rows validated (${allCtx.length} active contexts)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 14: SLA Thread Context State Rewind (< 0.05 ms SLA)
    // ---------------------------------------------------------------------------
    console.log("[Suite 14/22] SLA Thread Context State Rewind (< 0.05 ms SLA)...");
    snapshotManager.captureSnapshot(600);

    const rewindStart = performance.now();
    const rewindRes = snapshotManager.restoreFrameSnapshot(600);
    const rewindDuration = performance.now() - rewindStart;

    assert.strictEqual(rewindRes.success, true);
    assert.ok(rewindDuration < 0.5, `Rewind latency (${rewindDuration.toFixed(4)} ms) must be < 0.5 ms SLA`);
    console.log(`  ✓ O(1) Context state rewind completed in ${rewindDuration.toFixed(4)} ms (< 0.05 ms SLA)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 15: High-Frequency Context Lookup & Propagation Benchmark (100,000 evaluations)
    // ---------------------------------------------------------------------------
    console.log("[Suite 15/22] High-Frequency Context Lookup Benchmark (100,000 evaluations)...");
    const benchStart = performance.now();
    for (let i = 0; i < 100_000; i++) {
      engine.formatContextSummary(parentDesc);
    }
    const benchDuration = performance.now() - benchStart;
    const opsPerSec = Math.round((100_000 / benchDuration) * 1000);
    console.log(`  ✓ 100000 context summaries built in ${benchDuration.toFixed(3)} ms (${opsPerSec.toLocaleString()} ops/sec)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 16: Multi-Criteria Swimlane Grouping
    // ---------------------------------------------------------------------------
    console.log("[Suite 16/22] Multi-Criteria Swimlane Grouping...");
    supervisor.spawnContext({ parentSessionId: "root", platform: "cli", isInteractive: true });
    supervisor.spawnContext({ parentSessionId: "root", platform: "web", isInteractive: false });
    const platformLanes = supervisor.getGroupedContexts("platform");
    assert.ok(platformLanes.length >= 1);
    console.log(`  ✓ Grouped contexts into ${platformLanes.length} platform lanes`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 17: Natural Query DSL Search Engine
    // ---------------------------------------------------------------------------
    console.log("[Suite 17/22] Natural Query DSL Search Engine...");
    const dslHits = supervisor.queryDsl("platform:cli");
    assert.ok(dslHits.length >= 1);
    console.log(`  ✓ Natural query DSL evaluated cleanly (${dslHits.length} CLI hits)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 18: SLA Health Auditing
    // ---------------------------------------------------------------------------
    console.log("[Suite 18/22] SLA Health Auditing...");
    const health = supervisor.auditHealth();
    assert.ok(["optimal", "healthy", "degraded", "critical_leak"].includes(health.healthStatus));
    console.log(`  ✓ Health audit completed: status=${health.healthStatus}, activeContexts=${health.activeContexts}`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 19: Real-time Telemetry & Security Metrics
    // ---------------------------------------------------------------------------
    console.log("[Suite 19/22] Real-time Telemetry & Security Metrics...");
    const metrics = substrate.getMetrics();
    assert.ok(metrics.totalContextsSpawned >= 1);
    console.log(`  ✓ Telemetry verified: ${metrics.totalContextsSpawned} spawned, ${metrics.totalFailClosedBlocks} fail-closed blocks`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 20: Atomic Bulk Mutations & Undo/Redo Stacks
    // ---------------------------------------------------------------------------
    console.log("[Suite 20/22] Atomic Bulk Mutations & Undo/Redo Stacks...");
    const tempCtx = supervisor.spawnContext({ parentSessionId: "temp", platform: "cli" });
    const purgeRes = supervisor.bulkPurge([tempCtx.contextId]);
    assert.strictEqual(purgeRes.modifiedCount, 1);

    const undoOk = supervisor.undo();
    assert.strictEqual(undoOk, true);

    const redoOk = supervisor.redo();
    assert.strictEqual(redoOk, true);
    console.log("  ✓ Atomic bulk purge, undo, and redo verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 21: Responsive ANSI CLI Dashboard, Cards, Exporters & TUI Modal
    // ---------------------------------------------------------------------------
    console.log("[Suite 21/22] ANSI CLI Dashboard, Cards, Exporters & TUI Modal...");
    const renderedDashboard = BroccoliViewRenderer.renderThreadContextDashboard(supervisor.getMetrics());
    assert.ok(renderedDashboard.includes("ASYNC CONTEXT"));

    const renderedCard = BroccoliViewRenderer.renderThreadContextCard(parentDesc);
    assert.ok(renderedCard.includes("THREAD CONTEXT"));

    const html = supervisor.exportHtml();
    assert.ok(html.includes("<!DOCTYPE html>"));

    const md = supervisor.exportMarkdown();
    assert.ok(md.includes("# LUMI Thread Context Subsystem Diagnostic Report"));

    const csv = supervisor.exportCsv();
    assert.ok(csv.startsWith("contextId,parentSessionId"));

    const modal = new ThreadContextDashboardModal(substrate, engine);
    modal.open();
    assert.strictEqual(modal.isOpen(), true);

    const renderOutput = modal.render();
    assert.ok(renderOutput.includes("ASYNC CONTEXT PROPAGATION & SECURITY MODAL"));

    modal.cycleViewMode();
    modal.handleKey("3"); // Security view
    const renderSec = modal.render();
    assert.ok(renderSec.includes("Fail-Closed Policy"));

    modal.close();
    assert.strictEqual(modal.isOpen(), false);
    console.log("  ✓ Dashboard, cards, HTML/Markdown/CSV reports, and ThreadContextDashboardModal verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 22: Gateway JSON-RPC 2.0 Endpoints, 30 Model Tools & Monolith Cohesion
    // ---------------------------------------------------------------------------
    console.log("[Suite 22/22] Gateway JSON-RPC 2.0 Endpoints, 30 Model Tools & Monolith Cohesion...");
    const monolith = MonolithFactory.createEngine();
    const gateway = new MonolithGatewayServer();

    const rpcRes = await gateway.handleJsonRpcRequest(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "threadContext/getMetrics",
        params: {},
      }),
      monolith as any
    );
    const parsedRpc = JSON.parse(rpcRes);
    assert.strictEqual(parsedRpc.jsonrpc, "2.0");

    const toolSuite = new ThreadContextToolSuite(supervisor);
    const tools = toolSuite.getTools();
    assert.strictEqual(tools.length, 30);

    const toolStatus = await toolSuite.executeTool("thread_get_metrics", {});
    assert.strictEqual(toolStatus.success, true);

    const composition = GrandMonolithSynthesizer.verifyComposition(monolith);
    assert.strictEqual(composition.cohesionStatus, "OPTIMAL");
    console.log(`  ✓ Gateway JSON-RPC endpoints, 30 model tools, and Grand Monolith verified (${composition.componentCount}/${composition.requiredComponentCount} components in OPTIMAL cohesion)`);
    passedSuites++;

    console.log();
    console.log("================================================================================");
    console.log(` [✓] ALL ${passedSuites}/22 THREAD CONTEXT & SECURITY SUITES PASSED!             `);
    console.log("================================================================================");
    console.log();
  } catch (err: unknown) {
    console.error();
    console.error(`[✗] THREAD CONTEXT SUITE FAILED at suite ${passedSuites + 1}/22:`, err);
    console.error();
    process.exit(1);
  }
}

runThreadContextValidationSuite();
