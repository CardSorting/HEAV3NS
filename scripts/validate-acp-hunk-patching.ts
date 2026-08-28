/**
 * validate-acp-hunk-patching.ts
 *
 * Comprehensive validation suite for Agent Client Protocol (ACP) Fine-Grained
 * Hunk-Level Patching, Dynamic Client Tool Negotiation, and Interactive Hunk Review (Pass 197 / ADR-135).
 */

import { AcpFineGrainedHunkPatcher } from "../src/sessions/extensions/acp/acp-fine-grained-hunk-patcher.js";
import { AcpBridgeServer } from "../src/agents/extensions/acp/acp-bridge-server.js";
import { AcpProtocolCodec } from "../src/tooling/extensions/acp/acp-protocol-codec.js";
import { AcpPermissionGate } from "../src/tooling/extensions/acp/acp-permission-gate.js";
import { BroccoliAcpSubstrate } from "../src/sessions/extensions/acp/broccoli-acp-substrate.js";
import { AcpDashboardModal } from "../src/tui/components/acp-dashboard-modal.js";
import { LumiMonolith } from "../src/index.js";
import {
  CURRENT_EVOLUTION_BASELINE,
  CURRENT_REQUIRED_COMPONENTS,
  GrandMonolithSynthesizer,
} from "../src/factories/grand-monolith-synthesizer.js";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI ACP Fine-Grained Hunk Patching & Client Tools Validation");
  console.log("================================================================\n");

  const patcher = new AcpFineGrainedHunkPatcher();

  // Test 1: Diff Deconstruction into Line-Anchored Hunks
  console.log("[Test 1/8] Validating Diff Deconstruction into Line-Anchored Hunks...");
  const originalFile = [
    "function calculateTotal(items: number[]): number {",
    "  let sum = 0;",
    "  for (const item of items) {",
    "    sum += item;",
    "  }",
    "  return sum;",
    "}",
    "",
    "function formatCurrency(amount: number): string {",
    "  return '$' + amount.toFixed(2);",
    "}",
  ].join("\n");

  const sampleDiff = [
    "--- src/calc.ts",
    "+++ src/calc.ts",
    "@@ -1,7 +1,7 @@",
    " function calculateTotal(items: number[]): number {",
    "-  let sum = 0;",
    "+  let sum = 10; // base fee",
    "   for (const item of items) {",
    "     sum += item;",
    "   }",
    "   return sum;",
    " }",
    "@@ -9,3 +9,3 @@",
    " function formatCurrency(amount: number): string {",
    "-  return '$' + amount.toFixed(2);",
    "+  return 'USD ' + amount.toFixed(2);",
    " }",
  ].join("\n");

  const hunks = patcher.splitDiffIntoHunks("src/calc.ts", originalFile, sampleDiff);
  assert(hunks.length === 2, `Expected 2 hunks, got ${hunks.length}`);
  assert(hunks[0].additions === 1 && hunks[0].deletions === 1, "Hunk 1 additions/deletions mismatch");
  assert(hunks[1].additions === 1 && hunks[1].deletions === 1, "Hunk 2 additions/deletions mismatch");
  assert(hunks[0].isSelected === true, "Hunk 1 should be selected by default");
  console.log("  [✓] Diff deconstruction into discrete line-anchored hunks verified.");

  // Test 2: Selective Hunk Application with Offset Calculations
  console.log("[Test 2/8] Validating Selective Hunk Application with Line Offset Math...");
  // Apply only the 2nd hunk (formatCurrency edit), leave 1st hunk unapplied
  const partialApplyResult = patcher.applySelectedHunks(originalFile, hunks, [hunks[1].hunkId]);
  assert(partialApplyResult.success === true, "Partial apply should succeed");
  assert(partialApplyResult.appliedCount === 1, `Expected 1 applied hunk, got ${partialApplyResult.appliedCount}`);
  assert(partialApplyResult.discardedCount === 1, "Expected 1 discarded hunk");
  assert(partialApplyResult.patchedContent.includes("let sum = 0;"), "Unselected hunk 1 should remain untouched");
  assert(partialApplyResult.patchedContent.includes("return 'USD ' + amount.toFixed(2);"), "Selected hunk 2 should be applied");
  console.log("  [✓] Selective hunk application and line-offset recalculation passed.");

  // Test 3: Granular Hunk Discard
  console.log("[Test 3/8] Validating Granular Hunk Discard...");
  const discardedHunks = patcher.discardHunk(hunks, hunks[0].hunkId);
  assert(discardedHunks[0].status === "DISCARDED", "Hunk 0 should be marked DISCARDED");
  assert(discardedHunks[0].isSelected === false, "Hunk 0 should be deselected");
  assert(discardedHunks[1].status === "PENDING", "Hunk 1 should remain PENDING");
  console.log("  [✓] Granular hunk discard and status mutation verified.");

  // Test 4: Dynamic Client Tool Registration
  console.log("[Test 4/8] Validating Dynamic Client Tool Registration (client/registerTools)...");
  const codec = new AcpProtocolCodec();
  const substrate = new BroccoliAcpSubstrate();
  const gate = new AcpPermissionGate(substrate);
  const server = new AcpBridgeServer(codec, gate, substrate, undefined, patcher);

  const regReq = codec.encodeResponse(1, { ignored: true }); // formatting
  const registerMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 101,
    method: "client/registerTools",
    params: {
      tools: [
        {
          name: "editor/getSelection",
          description: "Returns highlighted text from editor",
        },
        {
          name: "editor/showNotification",
          description: "Displays a toast message in the IDE",
        },
      ],
    },
  });

  const regResponse = await server.handleRpcMessage(registerMsg);
  assert(regResponse !== undefined, "Registration response expected");
  const parsedReg = JSON.parse(regResponse!);
  assert(parsedReg.result.success === true, "Tool registration should succeed");
  assert(parsedReg.result.registeredCount === 2, "Registered tool count should be 2");
  assert(server.getClientTools().length === 2, "Bridge server should track 2 client tools");
  console.log("  [✓] Dynamic client tool registration verified.");

  // Test 5: Client-Side Tool Call Execution (tools/call)
  console.log("[Test 5/8] Validating Client-Side Tool Execution (tools/call & tools/list)...");
  const listMsg = JSON.stringify({ jsonrpc: "2.0", id: 102, method: "tools/list", params: {} });
  const listResp = await server.handleRpcMessage(listMsg);
  const parsedList = JSON.parse(listResp!);
  assert(parsedList.result.tools.length === 2, "tools/list should return 2 tools");

  const callMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 103,
    method: "tools/call",
    params: {
      name: "editor/showNotification",
      arguments: { message: "Hello from LUMI ACP", severity: "info" },
    },
  });
  const callResp = await server.handleRpcMessage(callMsg);
  const parsedCall = JSON.parse(callResp!);
  assert(parsedCall.result.success === true, "Tool call should succeed");
  assert(parsedCall.result.result.executedTool === "editor/showNotification", "Executed tool name should match");

  const unknownCallMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 104,
    method: "tools/call",
    params: { name: "editor/unknownTool", arguments: {} },
  });
  const unknownCallResp = await server.handleRpcMessage(unknownCallMsg);
  const parsedUnknown = JSON.parse(unknownCallResp!);
  assert(parsedUnknown.result.success === false, "Unknown tool call should fail cleanly");
  console.log("  [✓] Client tool invocation and safety handling verified.");

  // Test 6: Bridge Server Hunk Endpoints via JSON-RPC 2.0
  console.log("[Test 6/8] Validating Bridge Server Hunk Endpoints (hunk/list & hunk/apply)...");
  const hunkListMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 105,
    method: "hunk/list",
    params: { filePath: "src/calc.ts", originalContent: originalFile, diffText: sampleDiff },
  });
  const hunkListResp = await server.handleRpcMessage(hunkListMsg);
  const parsedHunkList = JSON.parse(hunkListResp!);
  assert(parsedHunkList.result.hunks.length === 2, "hunk/list should return 2 hunks");

  const hunkApplyMsg = JSON.stringify({
    jsonrpc: "2.0",
    id: 106,
    method: "hunk/apply",
    params: {
      originalContent: originalFile,
      hunks: parsedHunkList.result.hunks,
      selectedHunkIds: [parsedHunkList.result.hunks[0].hunkId],
    },
  });
  const hunkApplyResp = await server.handleRpcMessage(hunkApplyMsg);
  const parsedHunkApply = JSON.parse(hunkApplyResp!);
  assert(parsedHunkApply.result.result.success === true, "hunk/apply should succeed");
  assert(parsedHunkApply.result.result.appliedCount === 1, "hunk/apply should apply 1 hunk");
  console.log("  [✓] Bridge server hunk RPC endpoints verified.");

  // Test 7: Interactive AcpDashboardModal Hunks Tab & Checkbox Toggling
  console.log("[Test 7/8] Validating AcpDashboardModal Hunks Tab & Keybindings...");
  const modal = new AcpDashboardModal(substrate, gate, undefined, patcher);
  modal.open();
  modal.setHunks(hunks);
  modal.setViewMode("hunks");

  const initialRender = modal.render();
  assert(initialRender.includes("Fine-Grained Diff Hunks"), "Modal should display Hunks view");
  assert(initialRender.includes("[x]"), "Modal should display checked hunk");

  // Space toggles hunk selection
  modal.handleKey(" ");
  assert(modal.getHunks()[0].isSelected === false, "Hunk 0 should be toggled to false");
  const toggledRender = modal.render();
  assert(toggledRender.includes("[ ]"), "Modal should display unchecked hunk");
  console.log("  [✓] Interactive AcpDashboardModal Hunks tab and checkbox toggling verified.");

  // Test 8: Grand Monolith Baseline Validation (Pass 197+ / 600+ Components)
  console.log("[Test 8/8] Validating Grand Monolith Baseline (Pass 197+ / 600+ Components)...");
  assert(CURRENT_EVOLUTION_BASELINE.highestRecordedPass >= 197, "Baseline pass should be >= 197");
  assert(CURRENT_REQUIRED_COMPONENTS.length >= 600, `Expected >= 600 required components, got ${CURRENT_REQUIRED_COMPONENTS.length}`);
  assert(CURRENT_REQUIRED_COMPONENTS.includes("acpFineGrainedHunkPatcher"), "acpFineGrainedHunkPatcher must be in required components");

  const monolith = new LumiMonolith({ cwd: process.cwd(), sessionId: "acp-val-hunk-mono" });
  assert(Boolean(monolith.acpFineGrainedHunkPatcher), "LumiMonolith must expose acpFineGrainedHunkPatcher");
  assert(Boolean(monolith.acpBridgeServer), "LumiMonolith must expose acpBridgeServer");

  const synth = GrandMonolithSynthesizer.verifyComposition(monolith.components);
  assert(synth.cohesionStatus === "OPTIMAL", "Grand monolith synthesis status should be OPTIMAL");
  assert(synth.componentCount >= 600, `Expected >= 600 verified components, got ${synth.componentCount}`);
  assert(synth.missingComponents.length === 0, "No missing components expected");
  console.log(`  [✓] Grand Monolith synthesis verified optimal at Pass ${CURRENT_EVOLUTION_BASELINE.highestRecordedPass} (${synth.componentCount} components).`);

  console.log("\n================================================================");
  console.log("   ALL 8 ACP HUNK PATCHING & CLIENT TOOLS SUITES PASSED!       ");
  console.log("================================================================\n");
}

runSuite().catch((err) => {
  console.error("\n❌ Validation Failed:", err);
  process.exit(1);
});
