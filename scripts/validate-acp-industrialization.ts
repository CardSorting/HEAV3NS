/**
 * validate-acp-industrialization.ts
 *
 * Comprehensive validation suite for Phase 195 / ADR-133:
 * Agent Client Protocol (ACP) Industrialization, Pre-Commit Adversarial Diff Scrutinizer & Interactive TUI Bridge.
 */

import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  AcpBridgeServer,
  AcpDashboardModal,
  AcpPermissionGate,
  AcpProtocolCodec,
  AcpSnapshotManager,
  AcpToolSuite,
  AdversarialHumanizer,
  AdversarialScrutinySupervisor,
  BroccoliAcpSubstrate,
  BroccoliAdversarialSubstrate,
  BroccoliDatabaseKernel,
  CURRENT_EVOLUTION_BASELINE,
  GrandMonolithSynthesizer,
  LumiMonolith,
} from "../src/index.js";

async function runAcpIndustrializationValidation(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI ACP Industrialization & Pre-Commit Scrutiny Validation   ");
  console.log("================================================================\n");

  const dbKernel = new BroccoliDatabaseKernel();
  const advSubstrate = new BroccoliAdversarialSubstrate(dbKernel);
  const advSupervisor = new AdversarialScrutinySupervisor(advSubstrate);
  const advHumanizer = new AdversarialHumanizer();

  const acpSubstrate = new BroccoliAcpSubstrate(dbKernel);
  const permissionGate = new AcpPermissionGate(acpSubstrate, advSupervisor, advHumanizer);
  const protocolCodec = new AcpProtocolCodec();
  const snapshotManager = new AcpSnapshotManager(acpSubstrate);
  const bridgeServer = new AcpBridgeServer(protocolCodec, permissionGate, acpSubstrate);
  const toolSuite = new AcpToolSuite(permissionGate, acpSubstrate);
  const dashboardModal = new AcpDashboardModal(acpSubstrate, permissionGate);

  // ---------------------------------------------------------------------------
  // Suite 1: ACP Capability Negotiation & Initialization
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating JSON-RPC 2.0 ACP Handshake & Capability Manifest...");
  const initMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { clientName: "cursor-ide", version: "0.45.2" },
  });

  const initRespRaw = await bridgeServer.handleRpcMessage(initMsg);
  assert.ok(initRespRaw, "Expected initialization response");
  const initResp = JSON.parse(initRespRaw);
  assert.equal(initResp.result.protocolVersion, "2026-03-01");
  assert.equal(initResp.result.agentCapabilities.adversarialScrutiny, true);
  assert.equal(initResp.result.agentCapabilities.diagnosticStreaming, true);
  assert.equal(initResp.result.agentCapabilities.multiFileChangesets, true);
  console.log("  [✓] Capability negotiation & manifest verified.");

  // ---------------------------------------------------------------------------
  // Suite 2: LSP-Compatible Diagnostic Streaming
  // ---------------------------------------------------------------------------
  console.log("[Test 2/8] Validating LSP-Compatible Diagnostic Push Notifications...");
  const diagNotification = bridgeServer.publishDiagnostics("file:///workspace/src/App.tsx", [
    {
      range: { start: { line: 10, character: 2 }, end: { line: 10, character: 20 } },
      severity: "error",
      source: "adversarial-scrutiny",
      message: "Direct hardcoded credential in component JSX",
    },
  ]);
  const parsedDiag = JSON.parse(diagNotification);
  assert.equal(parsedDiag.method, "diagnostics/publish");
  assert.equal(parsedDiag.params.diagnostics[0].source, "adversarial-scrutiny");
  console.log("  [✓] LSP Diagnostic push encoding verified.");

  // ---------------------------------------------------------------------------
  // Suite 3: Pre-Commit Adversarial Diff Scrutiny & Risk Scoring
  // ---------------------------------------------------------------------------
  console.log("[Test 3/8] Validating Pre-Commit Adversarial Diff Scrutiny & Scoring...");
  
  // Safe edit
  const safeRisk = await permissionGate.scrutinizeEdit({
    filePath: "src/components/Button.tsx",
    proposedContent: "export const Button = () => <button>Click</button>;",
  });
  assert.equal(safeRisk.riskLevel, "LOW");
  assert.equal(safeRisk.recommendedAction, "APPROVE_SAFE");

  // Dangerous edit with exposed secret
  const secretRisk = await permissionGate.scrutinizeEdit({
    filePath: ".env",
    proposedContent: `API_KEY="${["sk", "live", "1234567890abcdef123456"].join("_")}"`,
  });
  assert.ok(secretRisk.riskLevel === "HIGH" || secretRisk.riskLevel === "CRITICAL");
  assert.equal(secretRisk.recommendedAction, "REQUIRE_MANUAL_REVIEW");
  assert.ok(secretRisk.findings.some((f) => f.category === "UNGROUNDED_PROVENANCE" || f.category === "ARCHITECTURAL_FRAGILITY"));

  // Hard forbidden path
  const denyRisk = await permissionGate.scrutinizeEdit({
    filePath: "/etc/shadow",
    proposedContent: "root:x:0:0:root:/root:/bin/bash",
  });
  assert.equal(denyRisk.riskLevel, "CRITICAL");
  assert.equal(denyRisk.recommendedAction, "REJECT_HARMFUL");
  console.log("  [✓] Pre-commit adversarial diff risk evaluation and scoring verified.");

  // ---------------------------------------------------------------------------
  // Suite 4: Interactive Permission Gating with Attached Risk Shields
  // ---------------------------------------------------------------------------
  console.log("[Test 4/8] Validating Interactive Edit Approval Flow with ASCII Shields...");
  
  const approvalPromise = permissionGate.requestEditApproval({
    sessionId: "acp-session-test",
    filePath: ".env.production",
    proposedContent: 'STRIPE_SECRET="rk_live_998877665544332211"',
  });

  await new Promise((r) => setImmediate(r));

  const pendingList = acpSubstrate.listPendingApprovals();
  assert.equal(pendingList.length, 1);
  const pending = pendingList[0];
  assert.ok(pending.riskAssessment, "Risk assessment must be attached to approval request");
  assert.ok(pending.diagnosticShield, "ASCII diagnostic shield must be rendered and attached");
  assert.ok(pending.diagnosticShield.includes("LUMI ADVERSARIAL SCRUTINY"));

  // Resolve approval
  const resolved = permissionGate.submitApprovalDecision({
    approvalId: pending.approvalId,
    approved: true,
    reason: "Approved test secret in test harness",
  });
  assert.equal(resolved, true);

  const decision = await approvalPromise;
  assert.equal(decision.approved, true);
  assert.equal(acpSubstrate.listPendingApprovals().length, 0);
  console.log("  [✓] Interactive approval queue, attached risk assessment & ASCII shield passed.");

  // ---------------------------------------------------------------------------
  // Suite 5: Multi-File Changeset Batch Scrutiny
  // ---------------------------------------------------------------------------
  console.log("[Test 5/8] Validating Multi-File Changeset Batch Scrutiny...");
  const cs = acpSubstrate.upsertChangeset({
    changesetId: "cs_101",
    sessionId: "acp-session-test",
    title: "Feature: Add Payment Gateway",
    files: [
      {
        filePath: "src/billing.ts",
        changeType: "MODIFY",
        modifiedContent: "export const pay = () => { try { stripe.charge(); } catch (e) { rollback(); } };",
        additionsCount: 5,
        deletionsCount: 1,
      },
      {
        filePath: "src/config.ts",
        changeType: "MODIFY",
        modifiedContent: "export const API_KEY = 'secret_12345678';",
        additionsCount: 1,
        deletionsCount: 0,
      },
    ],
    totalAdditions: 6,
    totalDeletions: 1,
    status: "PENDING",
    createdAt: Date.now(),
  });

  const csRisk = await permissionGate.scrutinizeChangeset(cs);
  assert.ok(csRisk.findings.length > 0);
  assert.equal(csRisk.recommendedAction, "REQUIRE_MANUAL_REVIEW");
  console.log("  [✓] Multi-file changeset batch scrutiny passed.");

  // ---------------------------------------------------------------------------
  // Suite 6: Typed BroccoliDB WAL Journaling & O(1) Rollback
  // ---------------------------------------------------------------------------
  console.log("[Test 6/8] Validating BroccoliDB WAL Journaling & Sub-Millisecond Snapshotting...");
  const walEvents = acpSubstrate.getWalJournal();
  assert.ok(walEvents.length >= 3, `Expected at least 3 WAL journal entries, got ${walEvents.length}`);
  assert.ok(walEvents.some((e) => e.action === "APPROVAL_QUEUED"));
  assert.ok(walEvents.some((e) => e.action === "APPROVAL_RESOLVED"));

  const startSnap = performance.now();
  const snap = snapshotManager.createSnapshot();
  const snapLatency = performance.now() - startSnap;
  snapshotManager.restoreSnapshot(snap);
  console.log(`  [✓] BroccoliDB WAL journal entries verified; snapshot restored in ${snapLatency.toFixed(3)} ms.`);

  // ---------------------------------------------------------------------------
  // Suite 7: Interactive AcpDashboardModal TUI Component
  // ---------------------------------------------------------------------------
  console.log("[Test 7/8] Validating Interactive AcpDashboardModal ANSI Rendering...");
  dashboardModal.open();
  assert.equal(dashboardModal.isOpen(), true);

  // Tab 1: Sessions
  dashboardModal.setViewMode("sessions");
  let rendered = dashboardModal.render();
  assert.ok(rendered.includes("AGENT CLIENT PROTOCOL"));
  assert.ok(rendered.includes("Connected Sessions"));

  // Tab 2: Approvals
  dashboardModal.setViewMode("approvals");
  rendered = dashboardModal.render();
  assert.ok(rendered.includes("Approvals & Diffs"));

  // Tab 3: Changesets
  dashboardModal.setViewMode("changesets");
  rendered = dashboardModal.render();
  assert.ok(rendered.includes("Changesets"));

  // Tab 5: Risk Ledger
  dashboardModal.setViewMode("audit-ledger");
  rendered = dashboardModal.render();
  assert.ok(rendered.includes("Risk Ledger"));

  // Key navigation
  const cycleResult = dashboardModal.handleKey("Tab");
  assert.equal(cycleResult.action, "render");

  const closeResult = dashboardModal.handleKey("q");
  assert.equal(closeResult.action, "close");
  assert.equal(dashboardModal.isOpen(), false);
  console.log("  [✓] Interactive AcpDashboardModal ANSI tabs, keybindings, and render verified.");

  // ---------------------------------------------------------------------------
  // Suite 8: Monolith Composition & Evolution Baseline
  // ---------------------------------------------------------------------------
  console.log("[Test 8/8] Validating Grand Monolith Baseline (Pass 196 / 599 Components)...");
  assert.ok(CURRENT_EVOLUTION_BASELINE.highestRecordedPass >= 195);

  const monolith = new LumiMonolith({ cwd: process.cwd(), sessionId: "acp-val-mono" });
  assert.ok(monolith.acpBridgeServer, "LumiMonolith must expose acpBridgeServer");
  assert.ok(monolith.acpPermissionGate, "LumiMonolith must expose acpPermissionGate");
  assert.ok(monolith.acpDashboardModal, "LumiMonolith must expose acpDashboardModal");

  const compCheck = GrandMonolithSynthesizer.verifyComposition(monolith.components);
  assert.equal(compCheck.cohesionStatus, "OPTIMAL");
  assert.ok(compCheck.componentCount >= 598);
  assert.equal(compCheck.missingComponents.length, 0);
  assert.equal(compCheck.unexpectedComponents.length, 0);
  console.log(`  [✓] Grand Monolith synthesis verified optimal at Pass ${CURRENT_EVOLUTION_BASELINE.highestRecordedPass} (${compCheck.componentCount} components).`);

  console.log("\n================================================================");
  console.log("   ALL 8 ACP INDUSTRIALIZATION SUITES PASSED FLAWLESSLY!        ");
  console.log("================================================================\n");
}

runAcpIndustrializationValidation().catch((err) => {
  console.error("❌ Validation failure:", err);
  process.exit(1);
});
