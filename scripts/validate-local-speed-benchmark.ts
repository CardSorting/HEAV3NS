/**
 * validate-local-speed-benchmark.ts
 *
 * Validation suite for Local LLM Speedometer, Context Auto-Tuner,
 * VRAM Memory Reclaimer, and Offline Embeddings Subsystems (Phase 105 / ADR-052).
 */

import * as assert from "node:assert/strict";
import {
  DeterministicLocalEndpointEngine,
  LocalContextAutoTuner,
  LocalInferenceSpeedometer,
  LocalVramReclaimer,
  LocalEmbeddingsEngine,
  LocalEndpointDashboardModal,
} from "../src/index.js";

async function testContextAutoTuner(): Promise<void> {
  console.log("[Test 1/6] Validating LocalContextAutoTuner KV-Cache & Budget Engine...");
  const tuner = new LocalContextAutoTuner();

  const profile7b = tuner.computeTuningProfile("qwen2.5-coder:7b", 32_768, 7.0);
  assert.ok(profile7b.safeContextTokens > 0);
  assert.ok(profile7b.maxPredictTokens > 0);
  assert.ok(profile7b.tuningRationale.length > 0);

  const profile70b = tuner.computeTuningProfile("llama3.3:70b", 65_536, 70.0);
  assert.ok(profile70b.safeContextTokens <= 32_768);

  const opts = tuner.getOllamaOptions("qwen2.5-coder:7b", 16_384, 0.2);
  assert.equal(typeof opts.num_ctx, "number");
  assert.equal(typeof opts.num_predict, "number");
  assert.equal(opts.temperature, 0.2);

  const summary = tuner.formatTuningSummary(profile7b);
  assert.ok(summary.includes("Context Auto-Tuner"));

  console.log(`  [✓] Auto-tuner computed safe context budget: ${profile7b.safeContextTokens} tokens.`);
}

async function testInferenceSpeedometer(): Promise<void> {
  console.log("[Test 2/6] Validating LocalInferenceSpeedometer & TPS Benchmark...");
  const speedometer = new LocalInferenceSpeedometer();

  const res = await speedometer.benchmarkModel("llama3.2:3b", { isSimulated: true });
  assert.equal(res.status, "completed");
  assert.ok(res.tokensPerSecond > 0);
  assert.ok(res.ttftMs > 0);
  assert.ok(res.generatedTokens > 0);
  assert.ok(res.speedScorecard.includes("Local LLM Speedometer"));
  assert.ok(res.speedScorecard.includes("tok/s"));

  console.log(`  [✓] Benchmark completed: ${res.tokensPerSecond} tok/s (TTFT: ${res.ttftMs}ms).`);
}

async function testVramReclaimer(): Promise<void> {
  console.log("[Test 3/6] Validating LocalVramReclaimer & GPU Memory Purge...");
  const reclaimer = new LocalVramReclaimer();

  const unloadRes = await reclaimer.unloadModel("qwen2.5-coder:7b");
  assert.equal(unloadRes.success, true);
  assert.ok(unloadRes.freedVramEstimatedMb > 0);
  assert.ok(unloadRes.message.includes("qwen2.5-coder:7b"));

  console.log(`  [✓] VRAM reclaimer successfully freed estimated ${unloadRes.freedVramEstimatedMb} MB.`);
}

async function testOfflineEmbeddings(): Promise<void> {
  console.log("[Test 4/6] Validating LocalEmbeddingsEngine & Vector Generation...");
  const embedEngine = new LocalEmbeddingsEngine();

  const res = await embedEngine.generateEmbedding("Deterministic software architecture", undefined, undefined, "ollama", true);
  assert.equal(res.dimensions, 768);
  assert.equal(res.embedding.length, 768);
  assert.ok(res.tokensProcessed > 0);
  assert.equal(typeof res.embedding[0], "number");

  console.log(`  [✓] Local embedding generated: ${res.dimensions}-dim vector in ${res.durationMs}ms.`);
}

async function testDeterministicEngineLocalEnhancements(): Promise<void> {
  console.log("[Test 5/6] Validating DeterministicLocalEndpointEngine Integration...");
  const engine = new DeterministicLocalEndpointEngine();

  const contextProfile = engine.getSafeContextBudget("deepseek-r1:8b");
  assert.ok(contextProfile.safeContextTokens > 0);

  const benchRes = await engine.benchmarkModel("deepseek-r1:8b", { isSimulated: true });
  assert.equal(benchRes.status, "completed");

  const unloadRes = await engine.unloadModel("deepseek-r1:8b");
  assert.equal(unloadRes.success, true);

  const embedRes = await engine.generateEmbedding("LUMI Agent OS local intelligence");
  assert.ok(embedRes.dimensions > 0);

  console.log("  [✓] Engine successfully coordinated context, benchmark, unload, and embedding subsystems.");
}

async function testModalQuickActions(): Promise<void> {
  console.log("[Test 6/6] Validating LocalEndpointDashboardModal Quick Actions ([U], [B])...");
  const engine = new DeterministicLocalEndpointEngine();
  const modal = new LocalEndpointDashboardModal(engine);

  modal.open();
  modal.setViewMode("models");

  // Test 'u' key (unload)
  const uRes = modal.handleKey("u");
  assert.equal(uRes.action, "render");

  // Test 'b' key (benchmark)
  const bRes = modal.handleKey("b");
  assert.equal(bRes.action, "render");

  // Close modal
  const closeRes = modal.handleKey("escape");
  assert.equal(closeRes.action, "close");

  console.log("  [✓] Modal shortcuts [U] Unload and [B] Benchmark verified.");
}

async function main(): Promise<void> {
  console.log("================================================================");
  console.log(" LUMI Local LLM Speedometer, Context Tuner & VRAM Suite        ");
  console.log(" (Speedometer, Context Auto-Tuner, VRAM Purge, Local Embeddings)");
  console.log("================================================================\n");

  await testContextAutoTuner();
  await testInferenceSpeedometer();
  await testVramReclaimer();
  await testOfflineEmbeddings();
  await testDeterministicEngineLocalEnhancements();
  await testModalQuickActions();

  console.log("\n================================================================");
  console.log("  [✓] ALL LOCAL SPEEDOMETER & AUTO-TUNING CHECKS PASSED!        ");
  console.log("================================================================\n");
}

main().catch((err) => {
  console.error("Local speedometer validation failed:", err);
  process.exit(1);
});
