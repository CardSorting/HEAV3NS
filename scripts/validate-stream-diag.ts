/**
 * validate-stream-diag.ts
 *
 * Comprehensive validation suite for LLM Stream Diagnostics, Upstream Edge Forensic
 * Header Capture & Exception Chain Breadcrumb Subsystem (Phase 130 / ADR-106 / Target #63).
 */

import assert from "node:assert";
import { performance } from "node:perf_hooks";

import { DeterministicStreamDiagEngine } from "../src/agents/extensions/stream_diag/deterministic-stream-diag-engine.js";
import { StreamDiagSupervisor } from "../src/agents/extensions/stream_diag/stream-diag-supervisor.js";
import { BroccoliStreamDiagSubstrate } from "../src/sessions/extensions/stream_diag/broccoli-stream-diag-substrate.js";
import { StreamDiagSnapshotManager } from "../src/sessions/extensions/stream_diag/stream-diag-snapshot-manager.js";
import { StreamDiagToolSuite } from "../src/tooling/extensions/stream_diag/stream-diag-tool-suite.js";

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI LLM Stream Diagnostics & Forensics Engine (ADR-106)    ");
  console.log("================================================================\n");

  const substrate = new BroccoliStreamDiagSubstrate();
  const engine = new DeterministicStreamDiagEngine();
  const snapshotManager = new StreamDiagSnapshotManager(substrate);
  const supervisor = new StreamDiagSupervisor(substrate, engine);
  const toolSuite = new StreamDiagToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Suite 1: Stream Attempt Lifecycle Initialization & Options
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating Stream Attempt Lifecycle Initialization...");

  const attempt1 = supervisor.startAttempt("openrouter", "anthropic/claude-3.7-sonnet", {
    subagentId: "sub-worker-42",
    delegateDepth: 2,
    midToolCall: false,
  });

  assert.ok(attempt1.attemptId.startsWith("stream-"));
  assert.strictEqual(attempt1.provider, "openrouter");
  assert.strictEqual(attempt1.subagentId, "sub-worker-42");
  assert.strictEqual(attempt1.delegateDepth, 2);
  assert.strictEqual(attempt1.status, "streaming");
  console.log("  [✓] Stream attempt initialized with provider and subagent attribution.");

  // ---------------------------------------------------------------------------
  // Suite 2: Upstream Edge & CDN Header Capture with Bounded Value Lengths
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Upstream Edge & CDN Header Capture...");

  const rawHeaders = {
    "CF-Ray": "9123456789abcdef-SJC",
    "cf-cache-status": "DYNAMIC",
    "X-OpenRouter-Provider": "Anthropic",
    "x-openrouter-model": "claude-3.7-sonnet",
    "x-openrouter-id": "gen-abc-12345",
    "X-Request-ID": "req-999-000",
    "Server": "cloudflare",
    "untracked-custom-header": "ignore-this-payload",
  };

  supervisor.captureResponse(attempt1.attemptId, 200, rawHeaders);

  const updatedAttempt1 = substrate.getAttempt(attempt1.attemptId);
  assert.ok(updatedAttempt1);
  assert.strictEqual(updatedAttempt1.httpStatus, 200);
  assert.strictEqual(updatedAttempt1.headers["cf-ray"], "9123456789abcdef-SJC");
  assert.strictEqual(updatedAttempt1.headers["x-openrouter-provider"], "Anthropic");
  assert.strictEqual(updatedAttempt1.headers["server"], "cloudflare");
  assert.strictEqual(updatedAttempt1.headers["untracked-custom-header"], undefined);
  console.log("  [✓] Upstream edge diagnostic headers captured and normalized.");

  // ---------------------------------------------------------------------------
  // Suite 3: Streaming Chunk Accounting, TTFB & Duration Computation
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Streaming Chunk Accounting & TTFB...");

  supervisor.recordChunk(attempt1.attemptId, 256);
  supervisor.recordChunk(attempt1.attemptId, 512);
  supervisor.recordChunk(attempt1.attemptId, 256);

  const chunkedAttempt = substrate.getAttempt(attempt1.attemptId);
  assert.ok(chunkedAttempt);
  assert.strictEqual(chunkedAttempt.chunks, 3);
  assert.strictEqual(chunkedAttempt.bytes, 1024);
  assert.ok(chunkedAttempt.ttfbMs !== undefined && chunkedAttempt.ttfbMs >= 0);

  supervisor.completeAttempt(attempt1.attemptId);
  const completedAttempt = substrate.getAttempt(attempt1.attemptId);
  assert.ok(completedAttempt);
  assert.strictEqual(completedAttempt.status, "completed");

  const metrics = substrate.getMetrics();
  assert.strictEqual(metrics.totalStreams, 1);
  assert.strictEqual(metrics.completedStreams, 1);
  assert.strictEqual(metrics.totalBytesStreamed, 1024);
  assert.strictEqual(metrics.totalChunksStreamed, 3);
  console.log("  [✓] Chunk counts, byte accumulation, and TTFB metrics tracked cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 4: Exception Cause Chain Flattener
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Exception Cause Chain Flattener...");

  const innerCause = new Error("Connection reset by peer");
  (innerCause as any).name = "RemoteProtocolError";

  const midCause = new Error("Stream terminated prematurely");
  (midCause as any).name = "APIConnectionError";
  (midCause as any).cause = innerCause;

  const topError = new Error("Provider request failed");
  (topError as any).name = "OpenRouterAPIError";
  (topError as any).cause = midCause;

  const flattenedChain = engine.flattenExceptionChain(topError);
  assert.ok(flattenedChain.includes("OpenRouterAPIError"));
  assert.ok(flattenedChain.includes("APIConnectionError"));
  assert.ok(flattenedChain.includes("RemoteProtocolError"));
  assert.ok(flattenedChain.includes("<-"));
  console.log(`  Chain: ${flattenedChain}`);
  console.log("  [✓] Multi-level exception cause chain unwrapped and flattened.");

  // ---------------------------------------------------------------------------
  // Suite 5: Structured Drop Event Creation & Subagent Attribution
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Structured Drop Event & Subagent Attribution...");

  const attempt2 = supervisor.startAttempt("anthropic", "claude-3.5-sonnet", {
    subagentId: "subagent-7",
    delegateDepth: 1,
    midToolCall: true,
  });

  supervisor.captureResponse(attempt2.attemptId, 502, {
    "cf-ray": "8877665544-IAD",
    "via": "1.1 vegur",
  });
  supervisor.recordChunk(attempt2.attemptId, 128);

  const dropEvent = supervisor.recordDropAndRetry(attempt2.attemptId, topError, 1, 3);
  assert.ok(dropEvent);
  assert.strictEqual(dropEvent.kind, "drop mid tool-call");
  assert.strictEqual(dropEvent.subagentId, "subagent-7");
  assert.strictEqual(dropEvent.attempt, 1);
  assert.strictEqual(dropEvent.maxAttempts, 3);
  assert.strictEqual(dropEvent.httpStatus, 502);
  assert.ok(dropEvent.userFacingMessage.includes("[subagent:subagent-7]"));
  assert.ok(dropEvent.userFacingMessage.includes("mid tool-call"));
  assert.ok(dropEvent.userFacingMessage.includes("retrying (1/3)"));

  const recentDrops = supervisor.getDropEvents();
  assert.strictEqual(recentDrops.length, 1);
  console.log("  [✓] Structured drop event recorded with subagent and mid-tool-call tags.");

  // ---------------------------------------------------------------------------
  // Suite 6: In-Memory Substrate Binary Snapshotting & O(1) State Rollback
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Binary Snapshotting & O(1) State Rollback...");

  const snap = snapshotManager.takeSnapshot("snap-stream-diag-1");
  assert.strictEqual(snap.attempts.length, 2);
  assert.strictEqual(snap.dropEvents.length, 1);

  // Mutate state
  supervisor.startAttempt("dummy", "dummy-model");

  // Rollback
  const tRewindStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("snap-stream-diag-1");
  const rewindLatencyMs = performance.now() - tRewindStart;

  assert.ok(restored, "Snapshot restore must succeed");
  assert.strictEqual(supervisor.getRecentAttempts().length, 2);
  assert.ok(rewindLatencyMs < 0.05, `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.05 ms SLA`);
  console.log(`  [✓] Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms).`);

  // ---------------------------------------------------------------------------
  // Suite 7: Model Tool Suite Execution
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Model Tool Suite Execution...");

  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 5, "Must expose exactly 5 model tools");

  const inspectTool = tools.find((t) => t.name === "stream_diag_inspect_attempts")!;
  const recordTool = tools.find((t) => t.name === "stream_diag_record_event")!;
  const chainTool = tools.find((t) => t.name === "stream_diag_format_chain")!;
  const configTool = tools.find((t) => t.name === "stream_diag_configure")!;
  const metricsTool = tools.find((t) => t.name === "stream_diag_get_metrics")!;

  const recRes = (await recordTool.execute({
    provider: "deepseek",
    model: "deepseek-reasoner",
    bytes: 2048,
    chunks: 16,
  }, "")) as any;
  assert.strictEqual(recRes.success, true);

  const inspRes = (await inspectTool.execute({ limit: 10 }, "")) as any;
  assert.strictEqual(inspRes.success, true);
  assert.ok(inspRes.attemptsCount > 0);

  const chainRes = (await chainTool.execute({
    errorMessage: "GatewayTimeout",
    innerCause: "TLS handshake timeout",
  }, "")) as any;
  assert.strictEqual(chainRes.success, true);
  assert.ok(chainRes.chain.includes("GatewayTimeout"));

  const cfgRes = (await configTool.execute({ maxTrackedAttempts: 150 }, "")) as any;
  assert.strictEqual(cfgRes.success, true);
  assert.strictEqual(cfgRes.config.maxTrackedAttempts, 150);

  const metRes = (await metricsTool.execute({}, "")) as any;
  assert.strictEqual(metRes.success, true);
  assert.ok(metRes.metrics.totalStreams > 0);
  console.log("  [✓] All 5 Stream Diagnostics model tools executed cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 8: High-Frequency Stream Lifecycle Micro-Benchmarks
  // ---------------------------------------------------------------------------
  console.log("\n[Test 8/8] Benchmarking High-Frequency Stream Lifecycle Operations...");

  const iterations = 100000;
  const tBenchStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    engine.flattenExceptionChain(topError);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} chain unwrap operations in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(throughputOpsPerSec > 500000, "Throughput must exceed 500,000 ops/sec");

  console.log("  [✓] Ultra-high-throughput benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 STREAM DIAGNOSTICS VALIDATION SUITES PASSED CLEANLY!  ");
  console.log("================================================================\n");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
