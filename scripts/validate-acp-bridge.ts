import * as assert from "node:assert/strict";
import {
  LumiMonolith,
  AcpProtocolCodec,
  AcpPermissionGate,
  BroccoliAcpSubstrate,
  AcpSnapshotManager,
  AcpBridgeServer,
  AcpToolSuite,
} from "../src/index.js";

async function main(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Agent Client Protocol (ACP) & IDE Bridge Validation     ");
  console.log("================================================================\n");

  const codec = new AcpProtocolCodec();
  const substrate = new BroccoliAcpSubstrate();
  const permissionGate = new AcpPermissionGate(substrate);
  const snapshotManager = new AcpSnapshotManager(substrate);
  const bridgeServer = new AcpBridgeServer(codec, permissionGate, substrate);
  const toolSuite = new AcpToolSuite(permissionGate, substrate);

  // ── [Test 1/8] JSON-RPC 2.0 Framing & Error Serialization ─────────────────
  console.log("[Test 1/8] Validating JSON-RPC 2.0 Framing & Error Serialization...");
  {
    // Valid Request
    const rawReq = JSON.stringify({ jsonrpc: "2.0", id: 101, method: "ping", params: { msg: "hello" } });
    const parsed = codec.parseMessage(rawReq);
    assert.equal("id" in parsed && parsed.id, 101);
    assert.equal(parsed.method, "ping");

    // Invalid JSON
    assert.throws(() => codec.parseMessage("invalid json {"), /Parse error/);

    // Missing version
    assert.throws(() => codec.parseMessage(JSON.stringify({ id: 1, method: "test" })), /Missing or invalid 'jsonrpc'/);

    // Method Not Found RPC response
    const unknownMethodRes = await bridgeServer.handleRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: 102,
      method: "unknown_nonexistent_method",
    }));
    assert.ok(unknownMethodRes);
    const parsedRes = JSON.parse(unknownMethodRes);
    assert.equal(parsedRes.id, 102);
    assert.ok(parsedRes.error);
    assert.equal(parsedRes.error.code, -32603);

    console.log("\x1b[32m  [✓] JSON-RPC 2.0 parsing and error encoding verified.\x1b[0m");
  }

  // ── [Test 2/8] ACP Initialization Handshake ──────────────────────────────
  console.log("[Test 2/8] Validating ACP Initialization Handshake & Capabilities...");
  {
    const initPayload = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { clientName: "vscode-lumiext" },
    });

    const initResRaw = await bridgeServer.handleRpcMessage(initPayload);
    assert.ok(initResRaw);
    const initRes = JSON.parse(initResRaw);
    assert.equal(initRes.id, 1);
    assert.equal(initRes.result.protocolVersion, "2026-03-01");
    assert.equal(initRes.result.agentCapabilities.streaming, true);
    assert.equal(initRes.result.agentCapabilities.editApproval, true);
    assert.equal(initRes.result.implementation.name, "LUMI-JOY-ACP-Engine");

    console.log("\x1b[32m  [✓] ACP initialization handshake & capability negotiation passed.\x1b[0m");
  }

  // ── [Test 3/8] ACP Session Lifecycle & Forking ────────────────────────────
  console.log("[Test 3/8] Validating ACP Session Lifecycle & Mode Switching...");
  {
    // session/new
    const newSessionResRaw = await bridgeServer.handleRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "session/new",
      params: { sessionId: "acp-session-alpha", mode: "code" },
    }));
    assert.ok(newSessionResRaw);
    const newSessionRes = JSON.parse(newSessionResRaw);
    assert.equal(newSessionRes.result.session.sessionId, "acp-session-alpha");
    assert.equal(newSessionRes.result.session.mode, "code");

    // session/set_mode
    const setModeResRaw = await bridgeServer.handleRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "session/set_mode",
      params: { sessionId: "acp-session-alpha", mode: "architect" },
    }));
    assert.ok(setModeResRaw);
    const setModeRes = JSON.parse(setModeResRaw);
    assert.equal(setModeRes.result.mode, "architect");

    // session/fork
    const forkResRaw = await bridgeServer.handleRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "session/fork",
      params: { parentSessionId: "acp-session-alpha", newSessionId: "acp-session-alpha-child" },
    }));
    assert.ok(forkResRaw);
    const forkRes = JSON.parse(forkResRaw);
    assert.equal(forkRes.result.session.sessionId, "acp-session-alpha-child");
    assert.equal(forkRes.result.session.mode, "architect");

    // session/list
    const listResRaw = await bridgeServer.handleRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: 5,
      method: "session/list",
    }));
    assert.ok(listResRaw);
    const listRes = JSON.parse(listResRaw);
    assert.equal(listRes.result.sessions.length, 2);

    console.log("\x1b[32m  [✓] ACP session lifecycle (new, set_mode, fork, list) verified.\x1b[0m");
  }

  // ── [Test 4/8] Streaming Notification Multiplexing ────────────────────────
  console.log("[Test 4/8] Validating Streaming Notification Multiplexing...");
  {
    const chunkNotif = bridgeServer.sendNotification("agent/message_chunk", {
      sessionId: "acp-session-alpha",
      delta: "Synthesizing code module...",
      index: 0,
    });
    const parsedChunk = JSON.parse(chunkNotif);
    assert.equal(parsedChunk.method, "agent/message_chunk");
    assert.equal(parsedChunk.params.delta, "Synthesizing code module...");

    const thoughtNotif = bridgeServer.sendNotification("agent/thought_chunk", {
      sessionId: "acp-session-alpha",
      thought: "Verifying type invariants...",
    });
    const parsedThought = JSON.parse(thoughtNotif);
    assert.equal(parsedThought.method, "agent/thought_chunk");

    console.log("\x1b[32m  [✓] Streaming notification encoding verified.\x1b[0m");
  }

  // ── [Test 5/8] Permission Gate & Sensitive Edit Approval ───────────────────
  console.log("[Test 5/8] Validating Permission Gate & Sensitive Edit Approval...");
  {
    // Hard Deny
    assert.equal(permissionGate.checkPathPermission("/etc/passwd"), "deny");
    assert.equal(permissionGate.checkPathPermission("~/.ssh/id_rsa"), "deny");

    // Sensitive Ask
    assert.equal(permissionGate.checkPathPermission(".env"), "ask");
    assert.equal(permissionGate.checkPathPermission(".git-credentials"), "ask");

    // Safe Allow
    assert.equal(permissionGate.checkPathPermission("src/index.ts"), "allow");

    // Test async approval flow
    const approvalPromise = permissionGate.requestEditApproval({
      sessionId: "acp-session-alpha",
      filePath: ".env",
      diffSnippet: "+API_KEY=secret_123",
      isSensitivePath: true,
    });

    const pending = substrate.listPendingApprovals();
    assert.equal(pending.length, 1);
    const targetApprovalId = pending[0].approvalId;

    // Submit decision
    const submitResRaw = await bridgeServer.handleRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: 6,
      method: "approval/decision",
      params: { approvalId: targetApprovalId, approved: true },
    }));
    assert.ok(submitResRaw);

    const resolvedDecision = await approvalPromise;
    assert.equal(resolvedDecision.approved, true);
    assert.equal(substrate.listPendingApprovals().length, 0);

    console.log("\x1b[32m  [✓] Permission gate safety checks and interactive approval flow passed.\x1b[0m");
  }

  // ── [Test 6/8] Frame-Perfect Binary Snapshotting & O(1) Rollback ───────────
  console.log("[Test 6/8] Validating ACP Binary Snapshotting & O(1) Rollback...");
  {
    const snap1 = snapshotManager.createSnapshot(50);
    assert.equal(snap1.sessions.length, 2);

    // Mutate state
    substrate.createSession("ephemeral-session-999", "ask");
    assert.equal(substrate.listSessions().length, 3);

    // Rollback to frame 50
    const startRollback = performance.now();
    snapshotManager.restoreSnapshot(snap1);
    const rollbackDuration = performance.now() - startRollback;

    assert.equal(substrate.listSessions().length, 2);
    assert.equal(substrate.getSession("ephemeral-session-999"), undefined);
    assert.ok(rollbackDuration < 1.0, `Rollback took ${rollbackDuration} ms, must be < 1.0ms`);

    console.log(`\x1b[32m  [✓] Frame-perfect binary snapshotting and O(1) rollback passed (${rollbackDuration.toFixed(3)} ms).\x1b[0m`);
  }

  // ── [Test 7/8] ACP Model Tool Suite Operations ────────────────────────────
  console.log("[Test 7/8] Validating ACP Model Tool Suite Operations...");
  {
    // 1. acp_inspect_session
    const inspectRes = await toolSuite.executeTool("acp_inspect_session", {
      sessionId: "acp-session-alpha",
    });
    assert.ok(inspectRes.success);
    const inspectObj = inspectRes.result as { sessionId: string; mode: string };
    assert.equal(inspectObj.sessionId, "acp-session-alpha");

    // 2. acp_set_mode
    const setModeRes = await toolSuite.executeTool("acp_set_mode", {
      sessionId: "acp-session-alpha",
      mode: "ask",
    });
    assert.ok(setModeRes.success);

    // 3. acp_request_approval for safe file (auto-approved)
    const autoApprovalRes = await toolSuite.executeTool("acp_request_approval", {
      filePath: "src/utils.ts",
      diffSnippet: "+export const x = 1;",
    });
    assert.ok(autoApprovalRes.success);
    assert.equal((autoApprovalRes.result as { approved: boolean }).approved, true);

    console.log("\x1b[32m  [✓] ACP model tool operations (inspect_session, set_mode, request_approval) passed.\x1b[0m");
  }

  // ── [Test 8/8] Monolith Composition & Benchmark ───────────────────────────
  console.log("[Test 8/8] Benchmarking Monolith Composition & JSON-RPC Request Codec Latency...");
  {
    const monolith = new LumiMonolith({ sessionId: "acp-bench-session" });
    assert.ok(monolith.acpProtocolCodec, "acpProtocolCodec must be composed");
    assert.ok(monolith.acpPermissionGate, "acpPermissionGate must be composed");
    assert.ok(monolith.broccoliAcpSubstrate, "broccoliAcpSubstrate must be composed");
    assert.ok(monolith.acpSnapshotManager, "acpSnapshotManager must be composed");
    assert.ok(monolith.acpBridgeServer, "acpBridgeServer must be composed");
    assert.ok(monolith.acpToolSuite, "acpToolSuite must be composed");

    const sampleRpc = JSON.stringify({
      jsonrpc: "2.0",
      id: 42,
      method: "session/list",
    });

    const iterations = 1000;
    const startBench = performance.now();
    for (let i = 0; i < iterations; i++) {
      monolith.acpProtocolCodec.parseMessage(sampleRpc);
    }
    const totalBenchMs = performance.now() - startBench;
    const perParseUs = (totalBenchMs / iterations) * 1000;

    console.log(`  Measured: ${iterations} JSON-RPC parses in ${totalBenchMs.toFixed(3)} ms (${perParseUs.toFixed(3)} µs/parse)`);
    assert.ok(totalBenchMs < 10.0, `1,000 parses took ${totalBenchMs} ms, must be < 10.0ms`);

    console.log("\x1b[32m  [✓] Monolith composition & JSON-RPC benchmark passed.\x1b[0m");
  }

  console.log("\n================================================================");
  console.log("   ALL 8 ACP BRIDGE VALIDATION SUITES PASSED!                   ");
  console.log("================================================================\n");
}

main().catch((error) => {
  console.error("Validation failed with error:", error);
  process.exit(1);
});
