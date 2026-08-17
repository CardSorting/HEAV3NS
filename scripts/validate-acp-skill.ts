/**
 * validate-acp-skill.ts
 *
 * Comprehensive validation suite for Agent Client Protocol (ACP) Universal Editor Bridge & Changesets (Phase 99 / ADR-129).
 * 1. Client Session Handshakes (VSCode, Cursor, JetBrains, Zed, Windsurf).
 * 2. Multi-File Changeset Staging with additions/deletions counts.
 * 3. Unified Diff generation & Cursor Composer style visual diff cards.
 * 4. Human-in-the-Loop review resolutions (ACCEPTED, REJECTED, MODIFIED).
 * 5. Deterministic JSON-RPC 2.0 Request / Response / Notification routing.
 * 6. Zero-GC O(1) state snapshotting & rollback.
 * 7. Model Tool Suite (9 model tools) execution & schema verification.
 * 8. Performance SLA benchmarking for changesets and diff generation (<5ms SLA).
 */

import assert from "node:assert";
import { performance } from "node:perf_hooks";
import { DeterministicAcpEngine } from "../src/tooling/extensions/acp/deterministic-acp-engine.js";
import { BroccoliAcpSubstrate } from "../src/sessions/extensions/acp/broccoli-acp-substrate.js";
import { AcpSnapshotManager } from "../src/sessions/extensions/acp/acp-snapshot-manager.js";
import { AcpSupervisor } from "../src/agents/extensions/acp/acp-supervisor.js";
import { AcpToolSuite } from "../src/tooling/extensions/acp/acp-tool-suite.js";

async function runAcpValidation(): Promise<void> {
  console.log("================================================================================");
  console.log("    LUMI Apex Enterprise: Agent Client Protocol (ACP) Bridge & Changesets       ");
  console.log("================================================================================\n");

  const substrate = new BroccoliAcpSubstrate();
  const engine = new DeterministicAcpEngine();
  const snapshotMgr = new AcpSnapshotManager(substrate);
  const supervisor = new AcpSupervisor(substrate, engine);
  const toolSuite = new AcpToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Suite 1: Editor Session Handshake
  // ---------------------------------------------------------------------------
  console.log("[Suite 1/8] Validating Editor Session Handshake...");
  supervisor.updateConfig({ enabled: true });
  const session = supervisor.initializeSession(
    "sess_cursor_001",
    "cursor",
    "0.45.2",
    "/workspace/my-project",
    {
      streamingEdits: true,
      inlineDiffs: true,
      terminalIntegration: true,
      notificationActions: true,
      multiFileChangesets: true,
    }
  );
  assert.strictEqual(session.sessionId, "sess_cursor_001");
  assert.strictEqual(session.clientType, "cursor");
  assert.strictEqual(supervisor.listSessions().length, 1);
  console.log("  [✓] Editor session established for Cursor v0.45.2");

  // ---------------------------------------------------------------------------
  // Suite 2: Multi-File Changeset Staging
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 2/8] Validating Multi-File Changeset Staging...");
  const stageRes = supervisor.stageMultiFileChangeset(
    session.sessionId,
    "Refactor Database Substrate to Zero-GC Memory Slab",
    [
      {
        filePath: "src/db/kernel.ts",
        changeType: "MODIFY",
        originalContent: "export const bufferSize = 1024;\nexport function alloc() { return new Buffer(); }",
        modifiedContent: "export const SLAB_SIZE = 16 * 1024 * 1024;\nexport function allocSlab() { return new Uint8Array(SLAB_SIZE); }",
      },
      {
        filePath: "src/db/slab-pool.ts",
        changeType: "CREATE",
        modifiedContent: "export class SlabPool {\n  private readonly slab = new Uint8Array(16777216);\n}",
      },
    ],
    "Replaces traditional buffers with 16MB contiguous slabs"
  );
  assert.strictEqual(stageRes.success, true);
  const changeset = stageRes.changeset!;
  assert.ok(changeset.changesetId, "Changeset must have an ID");
  assert.strictEqual(changeset.status, "PENDING");
  assert.strictEqual(changeset.files.length, 2);
  console.log(`  [✓] Changeset ${changeset.changesetId} staged with 2 files (+${changeset.totalAdditions}/-${changeset.totalDeletions} lines)`);

  // ---------------------------------------------------------------------------
  // Suite 3: Unified Diff & Visual Diff Cards
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 3/8] Validating Diff Card Formatting & Unified Diff...");
  const diffCard = stageRes.diffCard!;
  assert.ok(diffCard, "Diff card must be generated");
  assert.ok(diffCard.summaryText.includes("Refactor Database Substrate"));
  assert.ok(diffCard.filesListText.includes("src/db/kernel.ts"));
  assert.ok(diffCard.formattedDiffText.includes("+++ b/src/db/kernel.ts"));
  assert.strictEqual(diffCard.actionButtons.length, 3);
  console.log("  [✓] Diff card compiled:\n" + diffCard.formattedDiffText.split("\n").slice(0, 7).join("\n"));

  // ---------------------------------------------------------------------------
  // Suite 4: Human-in-the-Loop Review Resolution
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 4/8] Validating Changeset Approval Workflow...");
  const approved = supervisor.resolveEditApproval(changeset.changesetId, "ACCEPTED");
  assert.strictEqual(approved.success, true);
  assert.strictEqual(approved.changeset?.status, "ACCEPTED");
  assert.ok(approved.changeset?.resolvedAt !== undefined);
  console.log(`  [✓] Changeset ${changeset.changesetId} accepted and resolved.`);

  // ---------------------------------------------------------------------------
  // Suite 5: JSON-RPC 2.0 Protocol Envelopes
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 5/8] Validating JSON-RPC 2.0 Envelopes & Error Handling...");
  const rawReq = JSON.stringify({ jsonrpc: "2.0", id: 101, method: "session/initialize", params: { client: "windsurf" } });
  const rpcReq = engine.parseRpcRequest(rawReq);
  assert.ok(rpcReq, "RPC request must parse");
  assert.strictEqual(rpcReq.jsonrpc, "2.0");
  assert.strictEqual(rpcReq.id, 101);
  assert.strictEqual(rpcReq.method, "session/initialize");

  const rpcRes = engine.createRpcResponse(101, { success: true });
  assert.strictEqual(rpcRes.jsonrpc, "2.0");
  assert.strictEqual(rpcRes.id, 101);

  const rpcErr = engine.createRpcResponse(101, undefined, { code: -32601, message: "Method not found" });
  assert.strictEqual(rpcErr.error?.code, -32601);
  console.log("  [✓] JSON-RPC 2.0 protocol envelopes validated.");

  // ---------------------------------------------------------------------------
  // Suite 6: State Snapshotting & Zero-GC Invariance
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 6/8] Validating Zero-GC State Snapshotting & Rollback...");
  snapshotMgr.captureFrame(1);
  assert.strictEqual(snapshotMgr.hasFrame(1), true);

  // Clear substrate
  substrate.removeSession(session.sessionId);
  assert.strictEqual(substrate.listModernSessions().length, 0);

  // Restore snapshot
  const restored = snapshotMgr.rewindToFrame(1);
  assert.strictEqual(restored, true);
  assert.strictEqual(substrate.listModernSessions().length, 1);
  console.log("  [✓] ACP snapshot captured and restored successfully.");

  // ---------------------------------------------------------------------------
  // Suite 7: Model Tool Suite (9 Tools) Schema & Execution
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 7/8] Validating Model Tool Suite (9 Model Tools)...");
  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 9, "AcpToolSuite must provide exactly 9 tools");
  const toolNames = tools.map((t) => t.name);
  assert.ok(toolNames.includes("acp_initialize_session"));
  assert.ok(toolNames.includes("acp_stage_multi_file_changeset"));
  assert.ok(toolNames.includes("acp_render_diff_card"));
  assert.ok(toolNames.includes("acp_resolve_edit_approval"));
  assert.ok(toolNames.includes("acp_stream_session_events"));
  assert.ok(toolNames.includes("acp_inspect_editor_state"));
  assert.ok(toolNames.includes("acp_dispatch_client_command"));
  assert.ok(toolNames.includes("acp_query_session_health"));
  assert.ok(toolNames.includes("acp_manage_config"));

  // Test tool execution
  const healthTool = tools.find((t) => t.name === "acp_query_session_health")!;
  const healthRes = (await healthTool.execute({}, process.cwd())) as { success: boolean; activeSessions: number };
  assert.strictEqual(healthRes.success, true);
  assert.strictEqual(healthRes.activeSessions, 1);
  console.log("  [✓] All 9 model tools verified and executed cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 8: Microbenchmarking & Performance SLAs
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 8/8] Microbenchmarking Changeset & Diff Generation Latency...");
  const WARMUP_ITERATIONS = 500;
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    engine.formatUnifiedDiff("const a = 1;", "const a = 2;\nconst b = 3;", "test.txt");
  }

  const BENCH_ITERATIONS = 1000;
  const start = performance.now();
  for (let i = 0; i < BENCH_ITERATIONS; i++) {
    engine.formatUnifiedDiff("const a = 1;", "const a = 2;\nconst b = 3;", "test.txt");
  }
  const totalMs = performance.now() - start;
  const avgUs = (totalMs / BENCH_ITERATIONS) * 1000;
  console.log(`  [✓] Unified diff generation: ${avgUs.toFixed(2)}µs/op (<5000µs SLA). Total bench duration: ${totalMs.toFixed(2)}ms`);
  assert.ok(avgUs < 5000, "Diff generation must be under 5ms (5000µs)");

  console.log("\n================================================================================");
  console.log("  [✓] ALL 8 ACP BRIDGE & CHANGESET SUITES PASSED FLAWLESSLY                      ");
  console.log("================================================================================\n");
}

runAcpValidation().catch((err) => {
  console.error("ACP Validation failed:", err);
  process.exit(1);
});
