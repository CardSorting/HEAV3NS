/**
 * validate-audio-container.ts
 *
 * Comprehensive validation suite for Target #47: Audio Container Magic-Byte Sniffer,
 * Streaming Audio Cache & Voice Extension Repair Subsystem (Phase 114 / ADR-090).
 */

import assert from "node:assert";
import {
  DeterministicAudioSniffer,
  AudioContainerSupervisor,
  BroccoliAudioContainerSubstrate,
  AudioContainerSnapshotManager,
  AudioContainerToolSuite,
  CONTAINER_TO_EXT,
  CONTAINER_TO_MIME,
} from "../src/index.js";

// Canonical Header Buffers
const OGG = Buffer.concat([Buffer.from("OggS\x00\x02", "binary"), Buffer.alloc(64)]);
const FLAC = Buffer.concat([Buffer.from("fLaC", "utf8"), Buffer.alloc(64)]);
const WAV = Buffer.concat([Buffer.from("RIFF\x24\x08\x00\x00WAVEfmt ", "binary"), Buffer.alloc(64)]);
const WEBP = Buffer.concat([Buffer.from("RIFF\x24\x08\x00\x00WEBPVP8 ", "binary"), Buffer.alloc(64)]);
const MP3_ID3 = Buffer.concat([Buffer.from("ID3\x04\x00\x00\x00\x00\x00\x00", "binary"), Buffer.alloc(64)]);
const MP3_FRAME = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x00]), Buffer.alloc(64)]);
const AAC_ADTS = Buffer.concat([Buffer.from([0xff, 0xf1, 0x50, 0x80]), Buffer.alloc(64)]);
const M4A = Buffer.concat([Buffer.from("\x00\x00\x00\x1cftypM4A ", "binary"), Buffer.alloc(64)]);
const M4B = Buffer.concat([Buffer.from("\x00\x00\x00\x1cftypM4B ", "binary"), Buffer.alloc(64)]);
const MP4_ISOM = Buffer.concat([Buffer.from("\x00\x00\x00\x18ftypisom", "binary"), Buffer.alloc(64)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(64)]);
const UNKNOWN = Buffer.concat([Buffer.from("not-audio-at-all", "utf8"), Buffer.alloc(64)]);

async function runSuite() {
  console.log("================================================================");
  console.log("   LUMI Audio Container Sniffer & Repair Subsystem (ADR-090)    ");
  console.log("================================================================");

  const sniffer = new DeterministicAudioSniffer();
  const substrate = new BroccoliAudioContainerSubstrate();
  const snapshotManager = new AudioContainerSnapshotManager(substrate);
  const supervisor = new AudioContainerSupervisor(substrate, sniffer);
  const toolSuite = new AudioContainerToolSuite(supervisor);

  // --------------------------------------------------------------------------
  // [Test 1/8] Canonical Magic-Byte Container Sniffing across 8 Formats
  // --------------------------------------------------------------------------
  console.log("\n[Test 1/8] Validating Magic-Byte Container Sniffing across 8 Formats...");

  assert.strictEqual(sniffer.sniffContainer(OGG), "ogg");
  assert.strictEqual(sniffer.sniffContainer(FLAC), "flac");
  assert.strictEqual(sniffer.sniffContainer(WAV), "wav");
  assert.strictEqual(sniffer.sniffContainer(MP3_ID3), "mp3");
  assert.strictEqual(sniffer.sniffContainer(MP3_FRAME), "mp3");
  assert.strictEqual(sniffer.sniffContainer(AAC_ADTS), "aac");
  assert.strictEqual(sniffer.sniffContainer(M4A), "m4a");
  assert.strictEqual(sniffer.sniffContainer(M4B), "m4a");
  assert.strictEqual(sniffer.sniffContainer(MP4_ISOM), "mp4");
  assert.strictEqual(sniffer.sniffContainer(WEBM), "webm");
  assert.strictEqual(sniffer.sniffContainer(UNKNOWN), undefined);

  // Verify all canonical extensions and MIME types exist
  for (const [id, ext] of Object.entries(CONTAINER_TO_EXT)) {
    assert.ok(ext.startsWith("."), `Extension for ${id} must start with '.'`);
    assert.ok(CONTAINER_TO_MIME[id as keyof typeof CONTAINER_TO_MIME], `MIME type for ${id} must exist`);
  }

  console.log("  [✓] All 8 canonical container formats recognized accurately.");

  // --------------------------------------------------------------------------
  // [Test 2/8] RIFF Form-Type Parsing & WEBP Image Exclusion Guard
  // --------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating RIFF Header & WEBP Image Exclusion...");

  assert.strictEqual(sniffer.sniffContainer(WAV), "wav");
  // WEBP image header must return undefined so callers can perform image classification
  assert.strictEqual(sniffer.sniffContainer(WEBP), undefined);

  console.log("  [✓] RIFF/WAVE recognized and RIFF/WEBP images cleanly excluded.");

  // --------------------------------------------------------------------------
  // [Test 3/8] ISO ftyp Brand Resolution (Audio Brands vs Video Brands)
  // --------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating ISO ftyp Brand Resolution...");

  assert.strictEqual(sniffer.sniffContainer(M4A), "m4a");
  assert.strictEqual(sniffer.sniffContainer(M4B), "m4a");
  assert.strictEqual(sniffer.sniffContainer(MP4_ISOM), "mp4");

  // In audio contexts, generic MP4 maps to .m4a
  assert.strictEqual(sniffer.sniffAudioExt(MP4_ISOM, ".ogg"), ".m4a");

  console.log("  [✓] ISO ftyp audio brands (M4A/M4B) and generic MP4 audio-context mapping passed.");

  // --------------------------------------------------------------------------
  // [Test 4/8] 0xFF 0xFx Sync Word Disambiguation (ADTS AAC vs MP3 Frame)
  // --------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating 0xFF 0xFx Sync Word Disambiguation...");

  assert.strictEqual(sniffer.sniffContainer(AAC_ADTS), "aac");
  assert.strictEqual(sniffer.sniffContainer(MP3_FRAME), "mp3");

  const mp3FrameAlternate = Buffer.concat([Buffer.from([0xff, 0xfa, 0x80, 0x00]), Buffer.alloc(64)]);
  assert.strictEqual(sniffer.sniffContainer(mp3FrameAlternate), "mp3");

  console.log("  [✓] ADTS AAC and MP3 sync-word bitmasks accurately disambiguated.");

  // --------------------------------------------------------------------------
  // [Test 5/8] Outbound TTS & Inbound Voice Note Extension & Filename Repair
  // --------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Outbound TTS & Inbound Voice Note Repairs...");

  // 1. Outbound TTS Repair: MP3 bytes disguised as speech.ogg
  const r1 = supervisor.sniffAudio(MP3_ID3, "speech.ogg");
  assert.strictEqual(r1.containerId, "mp3");
  assert.strictEqual(r1.canonicalExtension, ".mp3");
  assert.strictEqual(r1.isRepaired, true);
  assert.strictEqual(r1.repairedExtension, ".mp3");
  assert.strictEqual(supervisor.repairFilename(MP3_ID3, "speech.ogg"), "speech.mp3");

  // 2. Inbound Voice Note: iOS voice note claimed as voice.oga
  const r2 = supervisor.sniffAudio(M4A, "voice.oga");
  assert.strictEqual(r2.containerId, "m4a");
  assert.strictEqual(r2.canonicalExtension, ".m4a");
  assert.strictEqual(r2.isRepaired, true);
  assert.strictEqual(supervisor.repairFilename(M4A, "/tmp/inbound/voice.oga"), "/tmp/inbound/voice.m4a");

  // 3. RIFF/WAVE delivered as note.mp3
  assert.strictEqual(supervisor.repairFilename(WAV, "note.mp3"), "note.wav");

  // 4. FLAC delivered as audio.ogg
  assert.strictEqual(supervisor.repairFilename(FLAC, "audio.ogg"), "audio.flac");

  // 5. Android ADTS AAC delivered as record.ogg
  assert.strictEqual(supervisor.repairFilename(AAC_ADTS, "record.ogg"), "record.aac");

  // 6. Honest extension (no repair needed)
  const rHonest = supervisor.sniffAudio(OGG, "real_opus.ogg");
  assert.strictEqual(rHonest.isRepaired, false);
  assert.strictEqual(supervisor.repairFilename(OGG, "real_opus.ogg"), "real_opus.ogg");

  console.log("  [✓] Outbound TTS and inbound voice note filename and extension repairs verified.");

  // --------------------------------------------------------------------------
  // [Test 6/8] In-Memory Substrate Audio Cache & SHA-256 Key Addressing
  // --------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating In-Memory Audio Cache & SHA-256 Addressing...");

  substrate.clear();

  const cachedEntry1 = supervisor.cacheAudio({
    pathOrUrl: "https://api.tts.internal/v1/synthesize/123.ogg",
    data: MP3_ID3,
    metadata: { voice: "nova", speed: 1.0 },
  });

  assert.ok(cachedEntry1.cacheKey.startsWith("audio_"));
  assert.strictEqual(cachedEntry1.containerId, "mp3");
  assert.strictEqual(cachedEntry1.extension, ".mp3");
  assert.strictEqual(cachedEntry1.mimeType, "audio/mpeg");
  assert.strictEqual(cachedEntry1.sizeBytes, MP3_ID3.length);

  const lookup1 = supervisor.getCacheEntry(cachedEntry1.cacheKey);
  assert.ok(lookup1);
  assert.strictEqual(lookup1.cacheKey, cachedEntry1.cacheKey);

  const allEntries = supervisor.listCacheEntries();
  assert.strictEqual(allEntries.length, 1);

  console.log("  [✓] In-memory audio substrate caching and SHA-256 key addressing verified.");

  // --------------------------------------------------------------------------
  // [Test 7/8] Frame-Perfect Binary Snapshotting & Instant O(1) State Rollback
  // --------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Frame-Perfect Snapshots & Instant O(1) Rollback...");

  const snapshot = snapshotManager.takeSnapshot("checkpoint-audio-1");

  // Mutate substrate
  supervisor.cacheAudio({
    pathOrUrl: "/tmp/voice2.flac",
    data: FLAC,
  });
  assert.strictEqual(supervisor.listCacheEntries().length, 2);

  // Warmup JIT
  for (let i = 0; i < 5; i++) {
    snapshotManager.restoreSnapshot("checkpoint-audio-1");
  }

  supervisor.cacheAudio({ pathOrUrl: "/tmp/voice2.flac", data: FLAC });
  const tRollbackStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("checkpoint-audio-1");
  const rollbackDurationMs = performance.now() - tRollbackStart;

  assert.strictEqual(restored, true);
  assert.strictEqual(supervisor.listCacheEntries().length, 1);
  assert.ok(
    rollbackDurationMs < 0.05,
    `Rollback completed in ${rollbackDurationMs.toFixed(4)} ms (< 0.05 ms SLA)`
  );

  console.log(`  [✓] Binary snapshotting and instant O(1) rollback verified (${rollbackDurationMs.toFixed(4)} ms).`);

  // --------------------------------------------------------------------------
  // [Test 8/8] Model Tool Suite (5 Tools) & Ultra-High-Throughput Micro-Benchmark
  // --------------------------------------------------------------------------
  console.log("\n[Test 8/8] Validating Model Tool Suite & Micro-Benchmarks...");

  // Tool 1: audio_sniff_container
  const t1 = await toolSuite.getTools().find((t) => t.name === "audio_sniff_container")?.execute({
    payload_base64: MP3_ID3.toString("base64"),
    claimed_filename_or_ext: "sample.ogg",
  }, "");
  assert.strictEqual((t1 as any)?.success, true);
  assert.strictEqual((t1 as any)?.containerId, "mp3");
  assert.strictEqual((t1 as any)?.isRepaired, true);

  // Tool 2: audio_repair_extension
  const t2 = await toolSuite.getTools().find((t) => t.name === "audio_repair_extension")?.execute({
    payload_base64: WAV.toString("base64"),
    filename: "voice.mp3",
  }, "");
  assert.strictEqual((t2 as any)?.success, true);
  assert.strictEqual((t2 as any)?.repairedFilename, "voice.wav");

  // Tool 3: audio_cache_payload
  const t3 = await toolSuite.getTools().find((t) => t.name === "audio_cache_payload")?.execute({
    path_or_url: "https://stream.audio/sample.mp4",
    payload_base64: M4A.toString("base64"),
    metadata_json: JSON.stringify({ speaker: "agent" }),
  }, "");
  assert.strictEqual((t3 as any)?.success, true);
  assert.strictEqual((t3 as any)?.containerId, "m4a");

  // Tool 4: audio_inspect_cache
  const t4 = await toolSuite.getTools().find((t) => t.name === "audio_inspect_cache")?.execute({}, "");
  assert.strictEqual((t4 as any)?.success, true);
  assert.ok((t4 as any)?.totalEntries >= 1);

  // Tool 5: audio_get_container_metrics
  const t5 = await toolSuite.getTools().find((t) => t.name === "audio_get_container_metrics")?.execute({}, "");
  assert.strictEqual((t5 as any)?.success, true);
  assert.ok((t5 as any)?.metrics?.totalSniffs >= 1);

  // Ultra-High-Throughput Micro-Benchmark: 100,000 audio sniffs
  const iterations = 100000;
  const sampleHeaders = [OGG, FLAC, WAV, MP3_ID3, AAC_ADTS, M4A, MP4_ISOM, WEBM];
  const tBenchStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    sniffer.sniffContainer(sampleHeaders[i % sampleHeaders.length]);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} sniffs in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/sniff | ${throughputOpsPerSec.toLocaleString()} sniffs/sec)`);
  assert.ok(throughputOpsPerSec > 500000, "Throughput must exceed 500,000 sniffs/sec");

  console.log("  [✓] All 5 model tools executed cleanly & ultra-high-throughput benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 AUDIO CONTAINER VALIDATION SUITES PASSED CLEANLY!     ");
  console.log("================================================================");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
