/**
 * validate-transcription.ts
 *
 * Comprehensive validation suite for Multi-Provider Speech-to-Text Transcription,
 * Diarization & Audio Ingestion Subsystem (Phase 124 / ADR-100 / Target #57).
 */

import assert from "node:assert";
import { performance } from "node:perf_hooks";

import { DeterministicSpeechTranscriber } from "../src/agents/extensions/transcription/deterministic-speech-transcriber.js";
import { TranscriptionSupervisor } from "../src/agents/extensions/transcription/transcription-supervisor.js";
import { BroccoliTranscriptionSubstrate } from "../src/sessions/extensions/transcription/broccoli-transcription-substrate.js";
import { TranscriptionSnapshotManager } from "../src/sessions/extensions/transcription/transcription-snapshot-manager.js";
import { TranscriptionToolSuite } from "../src/tooling/extensions/transcription/transcription-tool-suite.js";

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Speech-to-Text Transcription Validation (ADR-100)       ");
  console.log("================================================================\n");

  const engine = new DeterministicSpeechTranscriber();
  const substrate = new BroccoliTranscriptionSubstrate();
  const snapshotManager = new TranscriptionSnapshotManager(substrate);
  const supervisor = new TranscriptionSupervisor(substrate, engine);
  const toolSuite = new TranscriptionToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Suite 1: Audio Format Perception & Extension Validation
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating Audio Format Perception & Extension Validation...");

  assert.strictEqual(engine.isSupportedAudio("voice_memo.mp3"), true);
  assert.strictEqual(engine.isSupportedAudio("recording.ogg"), true);
  assert.strictEqual(engine.isSupportedAudio("speech.wav"), true);
  assert.strictEqual(engine.isSupportedAudio("audio.m4a"), true);
  assert.strictEqual(engine.isSupportedAudio("stream.webm"), true);
  assert.strictEqual(engine.isSupportedAudio("song.flac"), true);
  assert.strictEqual(engine.isSupportedAudio("document.pdf"), false);
  assert.strictEqual(engine.isSupportedAudio("photo.png"), false);
  console.log("  [✓] Audio format perception across supported extensions verified.");

  // ---------------------------------------------------------------------------
  // Suite 2: Deterministic SHA-256 Audio Fingerprinting
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Deterministic SHA-256 Audio Fingerprinting...");

  const mockPayload = Buffer.from("RIFF....WAVEfmt ....data....test_audio_sample_bytes");
  const hash1 = engine.computeAudioHash(mockPayload);
  const hash2 = engine.computeAudioHash(mockPayload);

  assert.strictEqual(hash1.length, 64);
  assert.strictEqual(hash1, hash2, "Identical audio payloads must produce identical hashes");
  console.log(`  [✓] Audio SHA-256 fingerprint generated: ${hash1.slice(0, 16)}...`);

  // ---------------------------------------------------------------------------
  // Suite 3: Sentence Boundary & Word Timestamp Alignment
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Sentence Boundary & Word Timestamp Alignment...");

  const testSpeech = "Welcome to LUMI agent. This is an advanced speech-to-text test. Multi-speaker turns are supported!";
  const segments = engine.alignSegments(testSpeech, 6000, "speaker_0");

  assert.strictEqual(segments.length, 3);
  assert.strictEqual(segments[0].id, "seg_1");
  assert.strictEqual(segments[0].startMs, 0);
  assert.ok(segments[0].endMs > 0);
  assert.ok(segments[0].words && segments[0].words.length > 0);
  assert.strictEqual(segments[0].words[0].word, "Welcome");
  assert.strictEqual(segments[2].endMs, 6000);
  console.log(`  [✓] Aligned ${segments.length} sentence segments with word timestamps.`);

  // ---------------------------------------------------------------------------
  // Suite 4: Speaker Diarization Partitioning
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Speaker Diarization Partitioning...");

  const diarized = engine.diarizeSegments(segments, 2);
  assert.strictEqual(diarized[0].speaker, "speaker_0");
  assert.strictEqual(diarized[1].speaker, "speaker_1");
  assert.strictEqual(diarized[2].speaker, "speaker_0");
  console.log("  [✓] Multi-speaker turn alternation and diarization verified.");

  // ---------------------------------------------------------------------------
  // Suite 5: Substrate Transcript Caching & Deduplication
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Substrate Transcript Caching & Deduplication...");

  const res1 = await supervisor.transcribe(mockPayload, {
    mockTranscript: "Hello from Lumi voice transcription.",
    durationMs: 3000,
    provider: "openai",
  });

  assert.strictEqual(res1.cached, false);
  assert.strictEqual(res1.provider, "openai");

  // Second transcribe should hit cache
  const res2 = await supervisor.transcribe(mockPayload, {
    provider: "openai",
  });

  assert.strictEqual(res2.cached, true);
  assert.strictEqual(res2.transcript, "Hello from Lumi voice transcription.");
  assert.strictEqual(supervisor.getMetrics().cacheHits, 1);
  console.log("  [✓] Audio transcript caching and instant cache hit verified.");

  // ---------------------------------------------------------------------------
  // Suite 6: In-Memory Substrate Binary Snapshotting & O(1) State Rollback
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Binary Snapshotting & O(1) State Rollback...");

  const snap1 = snapshotManager.takeSnapshot("snap-stt-1");
  assert.strictEqual(snap1.metrics.totalTranscriptions, 1);

  // Ingest another audio
  await supervisor.transcribe(Buffer.from("another_audio_bytes"), {
    mockTranscript: "Second audio payload.",
    provider: "groq",
  });
  assert.strictEqual(supervisor.getMetrics().totalTranscriptions, 2);

  // Rewind
  const tRewindStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("snap-stt-1");
  const rewindLatencyMs = performance.now() - tRewindStart;

  assert.ok(restored, "Snapshot restore must succeed");
  assert.strictEqual(supervisor.getMetrics().totalTranscriptions, 1);
  assert.ok(rewindLatencyMs < 0.1, `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.1 ms SLA`);
  console.log(`  [✓] Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms).`);

  // ---------------------------------------------------------------------------
  // Suite 7: Model Tool Suite Execution
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Model Tool Suite Execution...");

  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 5, "Must expose exactly 5 model tools");

  const transcribeTool = tools.find((t) => t.name === "audio_transcribe")!;
  const diarizeTool = tools.find((t) => t.name === "audio_diarize")!;
  const inspectTool = tools.find((t) => t.name === "transcription_cache_inspect")!;
  const configTool = tools.find((t) => t.name === "transcription_configure")!;
  const metricsTool = tools.find((t) => t.name === "transcription_get_metrics")!;

  const transRes = (await transcribeTool.execute({
    audioPath: "samples/test_call.mp3",
    provider: "xai",
    diarize: true,
  }, "")) as any;
  assert.strictEqual(transRes.success, true);
  assert.strictEqual(transRes.provider, "xai");

  const diarizeRes = (await diarizeTool.execute({
    audioHashOrPath: transRes.audioHash,
    speakerCount: 3,
  }, "")) as any;
  assert.strictEqual(diarizeRes.success, true);
  assert.ok(diarizeRes.segmentCount > 0);

  const inspectRes = (await inspectTool.execute({
    audioHash: transRes.audioHash,
  }, "")) as any;
  assert.strictEqual(inspectRes.success, true);

  const configRes = (await configTool.execute({
    defaultProvider: "groq",
    defaultModel: "whisper-large-v3",
  }, "")) as any;
  assert.strictEqual(configRes.success, true);
  assert.strictEqual(configRes.config.defaultProvider, "groq");

  const metricsRes = (await metricsTool.execute({}, "")) as any;
  assert.strictEqual(metricsRes.success, true);
  console.log("  [✓] All 5 STT model tools executed cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 8: Ultra-High-Throughput Micro-Benchmark
  // ---------------------------------------------------------------------------
  console.log("\n[Test 8/8] Validating Ultra-High-Throughput Micro-Benchmark...");

  const benchmarkText = "Continuous speech recognition benchmarking. Fast alignment across thousands of sentences.";
  const iterations = 50000;
  const tBenchStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    engine.alignSegments(benchmarkText, 4500, "speaker_0");
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} segment alignments in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(throughputOpsPerSec > 250000, "Throughput must exceed 250,000 ops/sec");

  console.log("  [✓] Ultra-high-throughput benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 TRANSCRIPTION VALIDATION SUITES PASSED CLEANLY!       ");
  console.log("================================================================\n");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
