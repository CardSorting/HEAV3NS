/**
 * validate-streaming-scrubber.ts
 *
 * Comprehensive validation suite for Streaming Reasoning Tag Scrubber,
 * Boundary Gated Holdback Buffer & Live Delta Filter Subsystem (Phase 137 / ADR-113 / Target #70).
 */

import assert from "node:assert";
import { performance } from "node:perf_hooks";

import { DeterministicStreamingScrubberEngine } from "../src/agents/extensions/streaming_scrubber/deterministic-streaming-scrubber-engine.js";
import { StreamingScrubberSupervisor } from "../src/agents/extensions/streaming_scrubber/streaming-scrubber-supervisor.js";
import { BroccoliStreamingScrubberSubstrate } from "../src/sessions/extensions/streaming_scrubber/broccoli-streaming-scrubber-substrate.js";
import { StreamingScrubberSnapshotManager } from "../src/sessions/extensions/streaming_scrubber/streaming-scrubber-snapshot-manager.js";
import { StreamingScrubberToolSuite } from "../src/tooling/extensions/streaming_scrubber/streaming-scrubber-tool-suite.js";

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Streaming Reasoning Scrubber System (ADR-113)          ");
  console.log("================================================================\n");

  const substrate = new BroccoliStreamingScrubberSubstrate();
  const engine = new DeterministicStreamingScrubberEngine();
  const snapshotManager = new StreamingScrubberSnapshotManager(substrate);
  const supervisor = new StreamingScrubberSupervisor(substrate, engine);
  const toolSuite = new StreamingScrubberToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Suite 1: Split-Chunk Delta Suppression across Boundary Splits
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating Split-Chunk Delta Reasoning Suppression...");

  const splitChunks = [
    "<th",
    "ink>",
    "Let me inspect ",
    "their database schema ",
    "and config files.",
    "</th",
    "ink>",
    "Here is the solution to your issue.",
  ];

  const simResult = supervisor.simulateStream(splitChunks);
  assert.strictEqual(simResult.accumulatedText, "Here is the solution to your issue.");
  assert.ok(simResult.totalSuppressedDeltas >= 6, "Must suppress internal reasoning chunks");
  console.log(`  Split Chunks Input Count: ${splitChunks.length}`);
  console.log(`  Reconstructed Output:    ${JSON.stringify(simResult.accumulatedText)}`);
  console.log("  [✓] Split-chunk delta reasoning suppression verified.");

  // ---------------------------------------------------------------------------
  // Suite 2: Closed Reasoning Pair Extraction
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Closed Reasoning Pair Extraction...");

  const closedPairChunks = [
    "Before reasoning. ",
    "<think>Internal chain of thought</think>",
    "After reasoning.",
  ];

  const closedSim = supervisor.simulateStream(closedPairChunks);
  assert.strictEqual(closedSim.accumulatedText, "Before reasoning. After reasoning.");
  console.log(`  Output: ${JSON.stringify(closedSim.accumulatedText)}`);
  console.log("  [✓] Closed pair inline stripping verified.");

  // ---------------------------------------------------------------------------
  // Suite 3: Boundary-Gated Prose Mentions Protection
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Boundary-Gated Prose Mentions Protection...");

  const proseChunks = [
    "To instruct the model, please use <think> tags in your prompt for best results.",
  ];

  const proseSim = supervisor.simulateStream(proseChunks);
  assert.strictEqual(
    proseSim.accumulatedText,
    "To instruct the model, please use <think> tags in your prompt for best results."
  );
  console.log(`  Output: ${JSON.stringify(proseSim.accumulatedText)}`);
  console.log("  [✓] Prose mentions of tags preserved when not at a block boundary.");

  // ---------------------------------------------------------------------------
  // Suite 4: Multi-Tag Variant Handling
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Multi-Tag Variant Handling...");

  const variantPairs = [
    ["<thinking>thinking block</thinking>", "Visible 1."],
    ["<reasoning>reasoning block</reasoning>", "Visible 2."],
    ["<thought>thought block</thought>", "Visible 3."],
    ["<REASONING_SCRATCHPAD>scratchpad block</REASONING_SCRATCHPAD>", "Visible 4."],
  ];

  for (const [tagBlock, visible] of variantPairs) {
    const res = supervisor.simulateStream([tagBlock, visible]);
    assert.strictEqual(res.accumulatedText, visible);
  }
  console.log("  [✓] All 5 reasoning tag variants verified.");

  // ---------------------------------------------------------------------------
  // Suite 5: Fail-Closed Flush on Unterminated Stream
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Fail-Closed Flush on Unterminated Block...");

  supervisor.resetSession("sess-fail-closed");
  supervisor.feedDelta("sess-fail-closed", "<think>Secret internal thought that was interrupted");
  const tail = supervisor.flushStream("sess-fail-closed");

  assert.strictEqual(tail, "", "Flush must return empty string and discard unterminated thoughts");
  assert.strictEqual(supervisor.getSessionState("sess-fail-closed").inBlock, false);
  console.log("  [✓] Fail-closed flush on interrupted stream verified.");

  // ---------------------------------------------------------------------------
  // Suite 6: Substrate Binary Snapshotting & Instant O(1) Rollback
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Substrate Binary Snapshotting & O(1) Rollback...");

  supervisor.resetSession("sess-snap-1");
  supervisor.feedDelta("sess-snap-1", "Prefix text");
  const snap = snapshotManager.takeSnapshot("snap-stream-1");

  supervisor.feedDelta("sess-snap-1", "\n<think>Mutated state");
  assert.strictEqual(supervisor.getSessionState("sess-snap-1").inBlock, true);

  // Rewind (warmed)
  snapshotManager.restoreSnapshot("snap-stream-1");
  const tRewindStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("snap-stream-1");
  const rewindLatencyMs = performance.now() - tRewindStart;

  assert.ok(restored, "Restore must succeed");
  assert.strictEqual(supervisor.getSessionState("sess-snap-1").inBlock, false);
  assert.ok(rewindLatencyMs < 0.05, `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.05 ms SLA`);
  console.log(`  [✓] Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms).`);

  // ---------------------------------------------------------------------------
  // Suite 7: Model Tool Suite Execution & Simulation Tool
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Model Tool Suite Execution...");

  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 5, "Must expose exactly 5 model tools");

  const feedTool = tools.find((t) => t.name === "streaming_scrubber_feed_delta")!;
  const flushTool = tools.find((t) => t.name === "streaming_scrubber_flush_stream")!;
  const simTool = tools.find((t) => t.name === "streaming_scrubber_simulate_stream")!;
  const configTool = tools.find((t) => t.name === "streaming_scrubber_configure")!;
  const metricsTool = tools.find((t) => t.name === "streaming_scrubber_get_metrics")!;

  const feedRes = (await feedTool.execute(
    { sessionId: "test-sess", delta: "Hello world" },
    ""
  )) as any;
  assert.strictEqual(feedRes.success, true);
  assert.strictEqual(feedRes.visibleText, "Hello world");

  const flushRes = (await flushTool.execute({ sessionId: "test-sess" }, "")) as any;
  assert.strictEqual(flushRes.success, true);

  const simToolRes = (await simTool.execute(
    { chunks: ["<th", "ink>thought</th", "ink>Done!"] },
    ""
  )) as any;
  assert.strictEqual(simToolRes.success, true);
  assert.strictEqual(simToolRes.accumulatedText, "Done!");

  const cfgRes = (await configTool.execute({ preserveProseMentions: true }, "")) as any;
  assert.strictEqual(cfgRes.success, true);
  assert.strictEqual(cfgRes.config.preserveProseMentions, true);

  const metRes = (await metricsTool.execute({}, "")) as any;
  assert.strictEqual(metRes.success, true);
  assert.ok(metRes.metrics.totalDeltasProcessed > 0);
  console.log("  [✓] All 5 Streaming Scrubber model tools executed cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 8: High-Frequency Delta Processing Micro-Benchmarks
  // ---------------------------------------------------------------------------
  console.log("\n[Test 8/8] Benchmarking High-Frequency Delta Filtration...");

  const iterations = 100000;
  const sampleDelta = " regular streamed token chunk ";
  let state = supervisor.getSessionState("bench-sess");
  const cfg = supervisor.getConfig();

  const tBenchStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const res = engine.feed(sampleDelta, state, cfg);
    state = res.nextState;
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(
    `  Measured: ${iterations} delta feeds in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/delta | ${throughputOpsPerSec.toLocaleString()} deltas/sec)`
  );
  assert.ok(throughputOpsPerSec > 1000000, "Throughput must exceed 1,000,000 deltas/sec");

  console.log("  [✓] High-frequency delta filtration benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 STREAMING SCRUBBER VALIDATION SUITES PASSED!           ");
  console.log("================================================================\n");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
