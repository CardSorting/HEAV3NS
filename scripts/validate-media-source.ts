/**
 * validate-media-source.ts
 *
 * Comprehensive validation suite for Unified Media Source Resolver, Magic-Byte MIME Perception
 * & Multimodal Ingestion Engine (Phase 122 / ADR-098 / Target #55).
 */

import assert from "node:assert";
import { performance } from "node:perf_hooks";

import { DeterministicMediaResolver } from "../src/agents/extensions/media_source/deterministic-media-resolver.js";
import { MediaSourceSupervisor } from "../src/agents/extensions/media_source/media-source-supervisor.js";
import { BroccoliMediaSourceSubstrate } from "../src/sessions/extensions/media_source/broccoli-media-source-substrate.js";
import { MediaSourceSnapshotManager } from "../src/sessions/extensions/media_source/media-source-snapshot-manager.js";
import { MediaSourceToolSuite } from "../src/tooling/extensions/media_source/media-source-tool-suite.js";

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Unified Media Source Resolver Validation (ADR-098)      ");
  console.log("================================================================\n");

  const resolver = new DeterministicMediaResolver();
  const substrate = new BroccoliMediaSourceSubstrate();
  const snapshotManager = new MediaSourceSnapshotManager(substrate);
  const supervisor = new MediaSourceSupervisor(substrate, resolver);
  const toolSuite = new MediaSourceToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Suite 1: RFC 2397 Data URL Resolution & Base64 Decoding
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating RFC 2397 Data URL Resolution & Base64 Decoding...");

  // Synthetic 1x1 PNG data URL
  const rawPngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG magic
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x04, 0x00, // width: 1024
    0x00, 0x00, 0x03, 0x00, // height: 768
    0x08, 0x06, 0x00, 0x00, 0x00,
  ]);
  const pngDataUrl = supervisor.toDataUrl(rawPngBytes, "image/png");
  assert.ok(pngDataUrl.startsWith("data:image/png;base64,"), "Data URL must begin with valid header");

  const resolvedPng = await supervisor.resolve(pngDataUrl);
  assert.strictEqual(resolvedPng.mime, "image/png");
  assert.strictEqual(resolvedPng.kind, "image");
  assert.strictEqual(resolvedPng.origin, "data");
  assert.strictEqual(resolvedPng.width, 1024);
  assert.strictEqual(resolvedPng.height, 768);
  assert.strictEqual(resolvedPng.sizeBytes, rawPngBytes.length);
  assert.ok(resolvedPng.sha256.length === 64, "SHA-256 must be 64-char hex");
  console.log("  [✓] RFC 2397 data URL decoding and metadata resolution verified.");

  // ---------------------------------------------------------------------------
  // Suite 2: Magic-Byte Image MIME Perception
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Magic-Byte Image MIME Perception...");

  // JPEG (FF D8 FF)
  const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  assert.strictEqual(supervisor.sniffMagicBytes(jpegBytes).mime, "image/jpeg");
  assert.strictEqual(supervisor.sniffMagicBytes(jpegBytes).kind, "image");

  // GIF89a (47 49 46 38 39 61)
  const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x03, 0x58, 0x02]); // width 800, height 600
  assert.strictEqual(supervisor.sniffMagicBytes(gifBytes).mime, "image/gif");

  // WebP (RIFF....WEBP)
  const webpBytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
    0x14, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d,
    0x01, 0x2a, 0x80, 0x02, 0xe0, 0x01, // 640 x 480
  ]);
  assert.strictEqual(supervisor.sniffMagicBytes(webpBytes).mime, "image/webp");

  // BMP (42 4D)
  const bmpBytes = new Uint8Array([0x42, 0x4d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x32, 0x00, 0x00, 0x00]); // 100 x 50
  assert.strictEqual(supervisor.sniffMagicBytes(bmpBytes).mime, "image/bmp");

  // SVG (<svg)
  const svgBytes = new TextEncoder().encode("<svg width='100' height='100'><circle/></svg>");
  assert.strictEqual(supervisor.sniffMagicBytes(svgBytes).mime, "image/svg+xml");

  console.log("  [✓] Magic-byte perception accurately identified PNG, JPEG, GIF, WebP, BMP, and SVG.");

  // ---------------------------------------------------------------------------
  // Suite 3: Magic-Byte Video MIME Perception
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Magic-Byte Video MIME Perception...");

  // MP4 (....ftyp)
  const mp4Bytes = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  const mp4Sniff = supervisor.sniffMagicBytes(mp4Bytes);
  assert.strictEqual(mp4Sniff.mime, "video/mp4");
  assert.strictEqual(mp4Sniff.kind, "video");

  // WebM (1A 45 DF A3)
  const webmBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
  const webmSniff = supervisor.sniffMagicBytes(webmBytes);
  assert.strictEqual(webmSniff.mime, "video/webm");
  assert.strictEqual(webmSniff.kind, "video");

  console.log("  [✓] Video container headers (MP4, WebM) accurately classified.");

  // ---------------------------------------------------------------------------
  // Suite 4: Header-Based Image Dimension Extraction
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Header-Based Image Dimension Extraction...");

  // PNG: 1024x768
  const pngDims = supervisor.extractDimensions(rawPngBytes, "image/png");
  assert.strictEqual(pngDims.width, 1024);
  assert.strictEqual(pngDims.height, 768);

  // GIF: 800x600
  const gifDims = supervisor.extractDimensions(gifBytes, "image/gif");
  assert.strictEqual(gifDims.width, 800);
  assert.strictEqual(gifDims.height, 600);

  // BMP: 100x50
  const bmpDims = supervisor.extractDimensions(bmpBytes, "image/bmp");
  assert.strictEqual(bmpDims.width, 100);
  assert.strictEqual(bmpDims.height, 50);

  console.log("  [✓] Zero-rendering dimension extraction succeeded across all image formats.");

  // ---------------------------------------------------------------------------
  // Suite 5: Ingest Budget Limits (50MB Cap) & Oversized Input Protection
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Ingest Budget Limits & Oversized Input Protection...");

  supervisor.configure({ maxIngestBytes: 1024 }); // Set small 1KB limit for testing
  const oversizedPayload = new Uint8Array(2048);

  let caught = false;
  try {
    await supervisor.resolve(oversizedPayload);
  } catch (err: any) {
    caught = true;
    assert.ok(err.message.includes("exceeds max ingestion limit"));
  }
  assert.ok(caught, "Oversized payload must be rejected before memory consumption");

  supervisor.configure({ maxIngestBytes: 50 * 1024 * 1024 }); // Restore 50MB
  console.log("  [✓] Ingest budget governor rejected oversized inputs cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 6: In-Memory Substrate Logging & MIME Metrics
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating In-Memory Substrate Logging & MIME Metrics...");

  await supervisor.resolve(rawPngBytes, "local");
  await supervisor.resolve(jpegBytes, "file");

  const metrics = supervisor.getMetrics();
  assert.strictEqual(metrics.totalResolutions, 3); // 1 from Test 1 + 2 from Test 6
  assert.strictEqual(metrics.mimeCounts["image/png"], 2);
  assert.strictEqual(metrics.mimeCounts["image/jpeg"], 1);
  assert.strictEqual(metrics.failedResolutions, 1); // 1 from Test 5
  console.log(`  [✓] Substrate recorded ${metrics.totalResolutions} resolutions (${metrics.totalBytesIngested} bytes ingested).`);

  // ---------------------------------------------------------------------------
  // Suite 7: Binary Snapshotting & O(1) State Rollback
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Binary Snapshotting & O(1) State Rollback...");

  const snap1 = snapshotManager.takeSnapshot("snap-media-1");
  assert.strictEqual(snap1.metrics.totalResolutions, 3);

  // Add more resolutions
  await supervisor.resolve(gifBytes, "local");
  assert.strictEqual(supervisor.getMetrics().totalResolutions, 4);

  // Rewind
  const tRewindStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("snap-media-1");
  const rewindLatencyMs = performance.now() - tRewindStart;

  assert.ok(restored, "Snapshot restore must succeed");
  assert.strictEqual(supervisor.getMetrics().totalResolutions, 3);
  assert.ok(rewindLatencyMs < 0.05, `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.05 ms`);
  console.log(`  [✓] Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms).`);

  // ---------------------------------------------------------------------------
  // Suite 8: Model Tool Suite & Micro-Benchmarks
  // ---------------------------------------------------------------------------
  console.log("\n[Test 8/8] Validating Model Tool Suite & Micro-Benchmarks...");

  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 5, "Must expose exactly 5 model tools");

  const resolveTool = tools.find((t) => t.name === "media_source_resolve")!;
  const inspectMagicTool = tools.find((t) => t.name === "media_source_inspect_magic")!;
  const extractDimsTool = tools.find((t) => t.name === "media_source_extract_dimensions")!;
  const toDataUrlTool = tools.find((t) => t.name === "media_source_to_data_url")!;
  const getMetricsTool = tools.find((t) => t.name === "media_source_get_metrics")!;

  const base64Png = Buffer.from(rawPngBytes).toString("base64");
  const magicRes = await inspectMagicTool.execute({ base64: base64Png });
  assert.strictEqual(magicRes.mime, "image/png");

  const dimsRes = await extractDimsTool.execute({ base64: base64Png });
  assert.strictEqual(dimsRes.width, 1024);
  assert.strictEqual(dimsRes.height, 768);

  const dataUrlRes = await toDataUrlTool.execute({ base64: base64Png });
  assert.ok(typeof dataUrlRes.dataUrl === "string" && dataUrlRes.dataUrl.startsWith("data:image/png"));

  const resolveRes = await resolveTool.execute({ uri: dataUrlRes.dataUrl });
  assert.strictEqual(resolveRes.success, true);
  assert.strictEqual(resolveRes.mime, "image/png");

  const metricsRes = await getMetricsTool.execute({});
  assert.strictEqual(metricsRes.success, true);

  // Micro-benchmark: 50,000 magic-byte header inspections
  const iterations = 50000;
  const tBenchStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    resolver.sniffMagicBytes(rawPngBytes);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} magic-byte header sniffs in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(throughputOpsPerSec > 500000, "Throughput must exceed 500,000 ops/sec");

  console.log("  [✓] All 5 model tools executed cleanly & ultra-high-throughput benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 MEDIA SOURCE VALIDATION SUITES PASSED CLEANLY!         ");
  console.log("================================================================\n");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
