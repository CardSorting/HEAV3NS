/**
 * validate-acp-2pc-streaming.ts
 *
 * Comprehensive validation suite for Two-Phase Commit (2PC) Speculative Staging,
 * Optimistic Concurrency Control (OCC), Streaming Tokens, and LSP Stream Framing (Pass 196 / ADR-134).
 */

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { performance } from "node:perf_hooks";

import { AcpProtocolCodec } from "../src/tooling/extensions/acp/acp-protocol-codec.js";
import { AcpPermissionGate } from "../src/tooling/extensions/acp/acp-permission-gate.js";
import { BroccoliAcpSubstrate } from "../src/sessions/extensions/acp/broccoli-acp-substrate.js";
import { AcpSpeculativeChangesetStager } from "../src/sessions/extensions/acp/acp-speculative-changeset-stager.js";
import { AcpBridgeServer } from "../src/agents/extensions/acp/acp-bridge-server.js";
import { LumiMonolith } from "../src/index.js";
import {
  CURRENT_EVOLUTION_BASELINE,
  CURRENT_REQUIRED_COMPONENTS,
  GrandMonolithSynthesizer,
} from "../src/factories/grand-monolith-synthesizer.js";

async function runAcp2pcStreamingValidation(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI ACP 2PC Speculative Staging & Streaming Validation      ");
  console.log("================================================================\n");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-acp-2pc-"));

  try {
    const codec = new AcpProtocolCodec();
    const substrate = new BroccoliAcpSubstrate();
    const permissionGate = new AcpPermissionGate(substrate);
    const stager = new AcpSpeculativeChangesetStager(substrate, permissionGate);
    const bridgeServer = new AcpBridgeServer(codec, permissionGate, substrate, stager);

    // -------------------------------------------------------------------------
    // Suite 1: LSP Content-Length Framing & Stream Buffer Parsing
    // -------------------------------------------------------------------------
    console.log("[Test 1/8] Validating LSP Content-Length Stream Buffer Codec...");
    const msg1 = codec.encodeNotification("session/chunk", { delta: "Hello " });
    const msg2 = codec.encodeNotification("session/chunk", { delta: "World!" });

    const framed1 = codec.encodeLspMessage(msg1);
    const framed2 = codec.encodeLspMessage(msg2);

    assert.ok(framed1.startsWith("Content-Length: "), "Must include Content-Length header");
    assert.ok(framed1.includes("\r\n\r\n"), "Must include CRLF header separator");

    // Partial chunk stream parsing
    const streamChunk1 = framed1 + framed2.slice(0, 15);
    const parseResult1 = codec.parseStreamBuffer(streamChunk1);
    assert.equal(parseResult1.messages.length, 1, "Should parse exactly 1 full message from partial stream");
    assert.equal((parseResult1.messages[0] as any).method, "session/chunk");

    const streamChunk2 = parseResult1.remainder + framed2.slice(15);
    const parseResult2 = codec.parseStreamBuffer(streamChunk2);
    assert.equal(parseResult2.messages.length, 1, "Should parse remaining message once stream completes");
    assert.equal((parseResult2.messages[0] as any).params.delta, "World!");
    console.log("  [✓] LSP header framing and chunked stream buffer parsing verified.");

    // -------------------------------------------------------------------------
    // Suite 2: Two-Phase Commit Speculative Preparation & Hashing
    // -------------------------------------------------------------------------
    console.log("[Test 2/8] Validating 2PC Speculative Preparation & SHA-256 Hashing...");
    const testFile1 = path.join(tempDir, "service.ts");
    const testFile2 = path.join(tempDir, "config.json");

    fs.writeFileSync(testFile1, "export const service = { status: 'idle' };\n", "utf8");
    fs.writeFileSync(testFile2, JSON.stringify({ version: "1.0.0" }, null, 2), "utf8");

    const prepResult = await stager.prepareTransaction(
      "session_test_2pc",
      "Upgrade Service to v2",
      [
        { filePath: testFile1, modifiedContent: "export const service = { status: 'active', version: 2 };\n" },
        { filePath: testFile2, modifiedContent: JSON.stringify({ version: "2.0.0" }, null, 2) },
      ]
    );

    assert.equal(prepResult.success, true);
    assert.ok(prepResult.transaction);
    assert.equal(prepResult.transaction.status, "PREPARED");
    assert.equal(prepResult.transaction.files.length, 2);

    // Verify SHA-256 integrity hashes
    for (const f of prepResult.transaction.files) {
      assert.equal(f.preImageHash.length, 64, "Pre-image must be valid 64-char SHA-256 hex string");
      assert.equal(f.postImageHash.length, 64, "Post-image must be valid 64-char SHA-256 hex string");
      assert.notEqual(f.preImageHash, f.postImageHash, "Pre and post hashes must differ for modified files");
    }

    // Verify disk content was NOT touched yet (Speculative Invariant)
    assert.equal(fs.readFileSync(testFile1, "utf8"), "export const service = { status: 'idle' };\n");
    console.log("  [✓] 2PC Speculative preparation, SHA-256 pre/post hashing, and disk isolation verified.");

    // -------------------------------------------------------------------------
    // Suite 3: Atomic 2PC Commit & Rollback Token Generation
    // -------------------------------------------------------------------------
    console.log("[Test 3/8] Validating Atomic 2PC Commit & Disk Application...");
    const commitResult = await stager.commitTransaction(prepResult.transaction.transactionId);
    assert.equal(commitResult.success, true);
    assert.ok(commitResult.rollbackToken);
    assert.equal(commitResult.rollbackToken.touchedFiles.length, 2);

    // Verify disk now reflects updated content
    assert.ok(fs.readFileSync(testFile1, "utf8").includes("status: 'active'"));
    assert.ok(fs.readFileSync(testFile2, "utf8").includes('"version": "2.0.0"'));
    console.log("  [✓] Atomic 2PC commit applied to disk; rollback token generated.");

    // -------------------------------------------------------------------------
    // Suite 4: 1-Click Atomic Rollback & State Restoration
    // -------------------------------------------------------------------------
    console.log("[Test 4/8] Validating 1-Click Atomic Rollback & State Reversal...");
    const rollbackResult = await stager.rollbackTransaction(commitResult.rollbackToken);
    assert.equal(rollbackResult.success, true);

    // Verify disk was completely reverted to original state
    assert.equal(fs.readFileSync(testFile1, "utf8"), "export const service = { status: 'idle' };\n");
    assert.ok(fs.readFileSync(testFile2, "utf8").includes('"version": "1.0.0"'));
    console.log("  [✓] 1-Click atomic rollback restored exact original disk pre-images.");

    // -------------------------------------------------------------------------
    // Suite 5: Optimistic Concurrency Control (OCC) Drift Detection
    // -------------------------------------------------------------------------
    console.log("[Test 5/8] Validating Optimistic Concurrency Control (OCC) Conflict Defense...");
    const driftPrep = await stager.prepareTransaction(
      "session_test_2pc",
      "Attempted edit on drifting file",
      [{ filePath: testFile1, modifiedContent: "// Staged content\n" }]
    );
    assert.equal(driftPrep.success, true);

    // Out-of-band external edit to simulate drift
    fs.writeFileSync(testFile1, "// External concurrent developer edit!\n", "utf8");

    // Commit must reject safely with OCC conflict
    const driftCommit = await stager.commitTransaction(driftPrep.transaction!.transactionId);
    assert.equal(driftCommit.success, false);
    assert.ok(driftCommit.error?.includes("Optimistic concurrency conflict"));
    console.log("  [✓] OCC drift detection successfully intercepted out-of-band file modifications.");

    // -------------------------------------------------------------------------
    // Suite 6: Streaming Token Chunks & Collapsible Thought Traces
    // -------------------------------------------------------------------------
    console.log("[Test 6/8] Validating Bidirectional Streaming Tokens & Thoughts...");
    const chunkNotice = bridgeServer.emitStreamChunk("session_stream_1", "const a = 10;", false);
    const thoughtNotice = bridgeServer.emitThoughtDelta("session_stream_1", "Analyzing AST requirements", "reasoning");

    assert.ok(chunkNotice.includes("session/chunk"));
    assert.ok(thoughtNotice.includes("session/thought"));
    console.log("  [✓] Streaming token deltas & collapsible thoughts emitted correctly.");

    // -------------------------------------------------------------------------
    // Suite 7: Workspace Roots & Dynamic Folder Synchronization
    // -------------------------------------------------------------------------
    console.log("[Test 7/8] Validating Dynamic Workspace Root Synchronization...");
    const initResRaw = await bridgeServer.handleRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: 10,
      method: "initialize",
      params: { clientName: "zed-editor", rootUri: "/projects/lumi" },
    }));
    assert.ok(initResRaw);
    const initRes = JSON.parse(initResRaw);
    assert.equal(initRes.result.agentCapabilities.speculativeTwoPhaseCommit, true);

    const changeResRaw = await bridgeServer.handleRpcMessage(JSON.stringify({
      jsonrpc: "2.0",
      id: 11,
      method: "workspace/didChangeWorkspaceFolders",
      params: {
        added: [{ uri: "/projects/lumi/sub-package", name: "sub-package" }],
        removed: [],
      },
    }));
    assert.ok(changeResRaw);
    assert.equal(JSON.parse(changeResRaw).result.activeRootsCount, 2);
    console.log("  [✓] Dynamic multi-root workspace synchronization passed.");

    // Suite 8: Grand Monolith Baseline Verification (Pass 196+ / 599+ Components)
    // -------------------------------------------------------------------------
    console.log("[Test 8/8] Validating Grand Monolith Baseline (Pass 196+ / 599+ Components)...");
    assert.ok(CURRENT_EVOLUTION_BASELINE.highestRecordedPass >= 196);
    assert.ok(CURRENT_REQUIRED_COMPONENTS.length >= 599);
    assert.ok(CURRENT_REQUIRED_COMPONENTS.includes("acpSpeculativeChangesetStager"));

    const monolith = new LumiMonolith({ cwd: process.cwd(), sessionId: "acp-val-2pc-mono" });
    assert.ok(monolith.acpSpeculativeChangesetStager, "LumiMonolith must expose acpSpeculativeChangesetStager");
    assert.ok(monolith.acpBridgeServer, "LumiMonolith must expose acpBridgeServer");

    const composition = GrandMonolithSynthesizer.verifyComposition(monolith.components);
    assert.equal(composition.cohesionStatus, "OPTIMAL");
    assert.equal(composition.missingComponents.length, 0);
    assert.ok(composition.componentCount >= 599);
    console.log(`  [✓] Grand Monolith synthesis verified optimal at Pass ${CURRENT_EVOLUTION_BASELINE.highestRecordedPass} (${composition.componentCount} components).`);

    console.log("\n================================================================");
    console.log("   ALL 8 ACP 2PC & STREAMING VALIDATION SUITES PASSED!         ");
    console.log("================================================================\n");
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  }
}

runAcp2pcStreamingValidation().catch((err) => {
  console.error("❌ Validation failure:", err);
  process.exit(1);
});
