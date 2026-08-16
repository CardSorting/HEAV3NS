/**
 * validate-wake-word.ts
 *
 * Comprehensive validation suite for Target #54: Streaming Acoustic Wake-Word Detection,
 * Ring-Buffer Audio Engine & Hands-Free Trigger Subsystem (Phase 121 / ADR-097).
 */

import assert from "node:assert";
import {
  DeterministicWakeWord,
  WakeWordSupervisor,
  BroccoliWakeWordSubstrate,
  WakeWordSnapshotManager,
  WakeWordToolSuite,
} from "../src/index.js";

async function runSuite() {
  console.log("================================================================");
  console.log("   LUMI Streaming Acoustic Wake-Word Detection (ADR-097)        ");
  console.log("================================================================");

  const detector = new DeterministicWakeWord();
  const substrate = new BroccoliWakeWordSubstrate();
  const snapshotManager = new WakeWordSnapshotManager(substrate);
  const supervisor = new WakeWordSupervisor(substrate, detector);
  const toolSuite = new WakeWordToolSuite(supervisor);

  // --------------------------------------------------------------------------
  // [Test 1/8] Audio Signal Processing & RMS/Peak Amplitude Computation
  // --------------------------------------------------------------------------
  console.log("\n[Test 1/8] Validating Audio Signal Processing & Feature Extraction...");

  const silence = new Int16Array(1280);
  assert.strictEqual(detector.computeRmsEnergy(silence), 0);
  assert.strictEqual(detector.computePeakAmplitude(silence), 0);

  const sineWave = new Int16Array(1280);
  for (let i = 0; i < 1280; i++) {
    sineWave[i] = Math.round(Math.sin(i / 10) * 10000);
  }
  const rms = detector.computeRmsEnergy(sineWave);
  const peak = detector.computePeakAmplitude(sineWave);
  assert.ok(rms > 6000 && rms < 8000, `Expected RMS ~7071, got ${rms}`);
  assert.ok(peak >= 9900 && peak <= 10000, `Expected Peak ~10000, got ${peak}`);

  // Byte conversion
  const uint8Buffer = new Uint8Array(sineWave.buffer, sineWave.byteOffset, sineWave.byteLength);
  const convertedInt16 = detector.convertBytesToInt16(uint8Buffer);
  assert.strictEqual(convertedInt16.length, 1280);
  assert.strictEqual(convertedInt16[10], sineWave[10]);

  console.log("  [✓] Audio RMS, peak amplitude, and byte conversions verified.");

  // --------------------------------------------------------------------------
  // [Test 2/8] Dead-Mic Silence Detection & Threshold Alerts
  // --------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Dead-Mic Silence Detection...");

  supervisor.startListening();

  for (let i = 0; i < 10; i++) {
    const res = supervisor.feedAudio(silence);
    assert.strictEqual(res.silent, true);
  }
  assert.strictEqual(supervisor.isDeadMic(), false);

  // Feed 120 more silent frames (total 130 >= 125 threshold)
  for (let i = 0; i < 120; i++) {
    supervisor.feedAudio(silence);
  }
  assert.strictEqual(supervisor.isDeadMic(), true);

  // Feed active audio frame to clear dead mic
  supervisor.feedAudio(sineWave);
  assert.strictEqual(supervisor.isDeadMic(), false);

  console.log("  [✓] Dead-mic silence streak accumulation and threshold recovery verified.");

  // --------------------------------------------------------------------------
  // [Test 3/8] Consecutive Confirmation Frame Filter & Noise Spike Rejection
  // --------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating N-Frame Confirmation Filter & Noise Spike Rejection...");

  supervisor.configure({ confirmationFrames: 3, sensitivity: 0.6, cooldownSeconds: 2.0 });

  // Frame 1: High confidence frame -> should not trigger yet (1/3)
  const frame1 = supervisor.feedAudio(sineWave);
  assert.strictEqual(frame1.triggered, false);
  assert.strictEqual(frame1.consecutiveHits, 1);

  // Frame 2: High confidence frame -> should not trigger yet (2/3)
  const frame2 = supervisor.feedAudio(sineWave);
  assert.strictEqual(frame2.triggered, false);
  assert.strictEqual(frame2.consecutiveHits, 2);

  // Frame 3: High confidence frame -> triggers! (3/3)
  const frame3 = supervisor.feedAudio(sineWave);
  assert.strictEqual(frame3.triggered, true);
  assert.strictEqual(supervisor.getState(), "triggered");

  console.log("  [✓] N-frame confirmation filter prevented premature trigger and fired at threshold.");

  // --------------------------------------------------------------------------
  // [Test 4/8] 2.0s Cooldown Guard & Rapid Retrigger Prevention
  // --------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating 2.0s Cooldown Guard...");

  // Immediate subsequent frame during cooldown window
  const cooldownFrame = supervisor.feedAudio(sineWave);
  assert.strictEqual(cooldownFrame.triggered, false);
  assert.strictEqual(cooldownFrame.score, 0);

  console.log("  [✓] Rapid re-triggering suppressed by cooldown window.");

  // --------------------------------------------------------------------------
  // [Test 5/8] Detector State Machine Transitions (listening, paused, muted)
  // --------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating State Machine Transitions & Echo Muting...");

  supervisor.pause();
  assert.strictEqual(supervisor.getState(), "paused");
  const pausedRes = supervisor.feedAudio(sineWave);
  assert.strictEqual(pausedRes.triggered, false);
  assert.strictEqual(pausedRes.state, "paused");

  supervisor.mute();
  assert.strictEqual(supervisor.getState(), "muted");
  const mutedRes = supervisor.feedAudio(sineWave);
  assert.strictEqual(mutedRes.triggered, false);

  supervisor.resume();
  assert.strictEqual(supervisor.getState(), "listening");

  console.log("  [✓] Pause/mute/resume state machine transitions verified.");

  // --------------------------------------------------------------------------
  // [Test 6/8] In-Memory Substrate Logging, Event History & Telemetry
  // --------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating In-Memory Substrate Logging & Telemetry...");

  const metrics = supervisor.getMetrics();
  assert.ok(metrics.framesProcessed >= 135);
  assert.ok(metrics.silentFramesCount >= 130);
  assert.ok(metrics.triggersCount >= 1);
  assert.ok(metrics.averageRms > 0);

  const history = supervisor.getHistory();
  assert.strictEqual(history.length, metrics.triggersCount);

  console.log(`  [✓] Substrate recorded ${metrics.framesProcessed} frames (${metrics.triggersCount} triggers, avg RMS: ${metrics.averageRms}).`);

  // --------------------------------------------------------------------------
  // [Test 7/8] Binary Snapshotting & O(1) State Rollback
  // --------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Binary Snapshotting & O(1) State Rollback...");

  const snapshotId = "checkpoint-wake-1";
  snapshotManager.takeSnapshot(snapshotId);

  supervisor.feedAudio(sineWave);
  supervisor.feedAudio(sineWave);
  assert.ok(supervisor.getMetrics().framesProcessed > metrics.framesProcessed);

  // JIT Warmup
  for (let i = 0; i < 50; i++) {
    snapshotManager.restoreSnapshot(snapshotId);
  }

  const tRollbackStart = performance.now();
  const restored = snapshotManager.restoreSnapshot(snapshotId);
  const rollbackDurationMs = performance.now() - tRollbackStart;

  assert.strictEqual(restored, true);
  assert.strictEqual(supervisor.getMetrics().framesProcessed, metrics.framesProcessed);
  assert.ok(
    rollbackDurationMs < 0.05,
    `Rollback completed in ${rollbackDurationMs.toFixed(4)} ms (< 0.05 ms SLA)`
  );

  console.log(`  [✓] Substrate state rollback verified (${rollbackDurationMs.toFixed(4)} ms).`);

  // --------------------------------------------------------------------------
  // [Test 8/8] Model Tool Suite (5 Tools) & Ultra-High-Throughput Benchmark
  // --------------------------------------------------------------------------
  console.log("\n[Test 8/8] Validating Model Tool Suite & Micro-Benchmarks...");

  // Tool 1: wake_word_feed_audio
  const t1 = await toolSuite.getTools().find((t) => t.name === "wake_word_feed_audio")?.execute({}, "");
  assert.strictEqual((t1 as any)?.success, true);

  // Tool 2: wake_word_configure
  const t2 = await toolSuite.getTools().find((t) => t.name === "wake_word_configure")?.execute({
    phrase: "hey lumi",
    sensitivity: 0.7,
  }, "");
  assert.strictEqual((t2 as any)?.success, true);
  assert.strictEqual((t2 as any)?.config?.sensitivity, 0.7);

  // Tool 3: wake_word_control
  const t3 = await toolSuite.getTools().find((t) => t.name === "wake_word_control")?.execute({
    action: "pause",
  }, "");
  assert.strictEqual((t3 as any)?.success, true);
  assert.strictEqual((t3 as any)?.state, "paused");

  // Tool 4: wake_word_inspect_status
  const t4 = await toolSuite.getTools().find((t) => t.name === "wake_word_inspect_status")?.execute({}, "");
  assert.strictEqual((t4 as any)?.success, true);
  assert.strictEqual((t4 as any)?.state, "paused");

  // Tool 5: wake_word_get_metrics
  const t5 = await toolSuite.getTools().find((t) => t.name === "wake_word_get_metrics")?.execute({}, "");
  assert.strictEqual((t5 as any)?.success, true);
  assert.ok((t5 as any)?.metrics?.framesProcessed >= 1);

  // Ultra-High-Throughput Micro-Benchmark: 50,000 audio frame evaluations
  supervisor.startListening();
  const iterations = 50000;
  const tBenchStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    detector.feedPcmFrame(sineWave, supervisor.getConfig(), "listening");
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} audio frames in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/frame | ${throughputOpsPerSec.toLocaleString()} frames/sec)`);
  assert.ok(throughputOpsPerSec > 250000, "Throughput must exceed 250,000 frames/sec (20,000x realtime)");

  console.log("  [✓] All 5 model tools executed cleanly & ultra-high-throughput benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 WAKE-WORD VALIDATION SUITES PASSED CLEANLY!            ");
  console.log("================================================================");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
