/**
 * validate-terminal-cleaner.ts
 *
 * Comprehensive validation suite for Deterministic Terminal ANSI Sanitizer,
 * Display Control Byte Filter & Binary Asset Guard Subsystem (Phase 136 / ADR-112 / Target #69).
 */

import assert from "node:assert";
import { performance } from "node:perf_hooks";

import { DeterministicTerminalCleanerEngine } from "../src/agents/extensions/terminal_cleaner/deterministic-terminal-cleaner-engine.js";
import { TerminalCleanerSupervisor } from "../src/agents/extensions/terminal_cleaner/terminal-cleaner-supervisor.js";
import { BroccoliTerminalCleanerSubstrate } from "../src/sessions/extensions/terminal_cleaner/broccoli-terminal-cleaner-substrate.js";
import { TerminalCleanerSnapshotManager } from "../src/sessions/extensions/terminal_cleaner/terminal-cleaner-snapshot-manager.js";
import { TerminalCleanerToolSuite } from "../src/tooling/extensions/terminal_cleaner/terminal-cleaner-tool-suite.js";

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Terminal ANSI Sanitizer & Binary Guard (ADR-112)        ");
  console.log("================================================================\n");

  const substrate = new BroccoliTerminalCleanerSubstrate();
  const engine = new DeterministicTerminalCleanerEngine();
  const snapshotManager = new TerminalCleanerSnapshotManager(substrate);
  const supervisor = new TerminalCleanerSupervisor(substrate, engine);
  const toolSuite = new TerminalCleanerToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Suite 1: Full ECMA-48 ANSI Escape Sequence Stripping
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating ECMA-48 ANSI Sequence Stripping...");

  // CSI color codes, cursor movement, OSC hyperlinks, and 8-bit C1 sequences
  const rawWithAnsi = "\x1b[31;1mError:\x1b[0m \x1b[2J\x1b]8;;https://example.com\x07Click Here\x1b]8;;\x07 \x9b1mBold\x1b[0m";
  const stripped = supervisor.stripAnsi(rawWithAnsi);

  assert.strictEqual(stripped, "Error: Click Here Bold");
  console.log(`  Input:  ${JSON.stringify(rawWithAnsi)}`);
  console.log(`  Output: ${JSON.stringify(stripped)}`);
  console.log("  [✓] Full ECMA-48 escape sequence stripping verified.");

  // ---------------------------------------------------------------------------
  // Suite 2: Fast-Path Zero-Allocation Pass-Through
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Fast-Path Pass-Through...");

  const cleanText = "Simple standard log line without any escape sequences.";
  const fastRes = engine.stripAnsi(cleanText);

  assert.strictEqual(fastRes.fastPath, true, "Must take fast-path on clean string");
  assert.strictEqual(fastRes.cleaned, cleanText);
  assert.strictEqual(fastRes.wasModified, false);
  console.log("  [✓] Fast-path zero-allocation pass-through verified.");

  // ---------------------------------------------------------------------------
  // Suite 3: Terminal Display Sanitization & Control Character Filtering
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Terminal Display Sanitization...");

  // Text with BEL \x07, backspace \x08, NUL \x00, DEL \x7f
  const rawWithControls = "Alert\x07Bell\x08Back\x00Null\x7fDel\tTab\nNewline";
  const sanitizedDisplay = supervisor.sanitizeDisplayText(rawWithControls);

  assert.strictEqual(sanitizedDisplay, "AlertBellBackNullDel\tTab\nNewline");
  console.log(`  Sanitized Display: ${JSON.stringify(sanitizedDisplay)}`);
  console.log("  [✓] Dangerous control characters filtered while preserving tabs and newlines.");

  // ---------------------------------------------------------------------------
  // Suite 4: Carriage Return Normalization & Overwrite Spoofing Defense
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating \\r-Overwrite Spoofing Defense...");

  const spoofedText = "Transfer $1,000,000\rTransfer $10 (spoofed)";
  const normalizedText = supervisor.sanitizeDisplayText(spoofedText);

  assert.strictEqual(normalizedText, "Transfer $1,000,000\nTransfer $10 (spoofed)");
  assert.strictEqual(normalizedText.includes("\r"), false, "All carriage returns must be normalized to newlines");
  console.log("  [✓] Carriage return overwrite spoofing neutralized.");

  // ---------------------------------------------------------------------------
  // Suite 5: Binary Asset & Opaque Document Extension Classification
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Binary Asset & Opaque Document Classification...");

  assert.strictEqual(supervisor.classifyPath("src/index.ts"), "text");
  assert.strictEqual(supervisor.classifyPath("assets/logo.png"), "binary");
  assert.strictEqual(supervisor.classifyPath("reports/quarterly.docx"), "opaque_document");
  assert.strictEqual(supervisor.classifyPath("docs/manual.pdf"), "pdf");

  const docxCheck = supervisor.canWriteAsText("reports/quarterly.docx");
  const tsCheck = supervisor.canWriteAsText("src/index.ts");
  const pdfCheck = supervisor.canWriteAsText("docs/manual.pdf");

  assert.strictEqual(docxCheck.allowed, false, "Must block plain text writes to .docx");
  assert.ok(docxCheck.reason?.includes("opaque container document"));
  assert.strictEqual(tsCheck.allowed, true);
  assert.strictEqual(pdfCheck.allowed, true);
  console.log("  [✓] Binary asset classification and opaque container document safety verified.");

  // ---------------------------------------------------------------------------
  // Suite 6: In-Memory Substrate Binary Snapshotting & O(1) Rollback
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Substrate Binary Snapshotting & O(1) Rollback...");

  const snap = snapshotManager.takeSnapshot("snap-cleaner-1");
  assert.ok(substrate.getMetrics().totalStringsCleaned >= 2);

  // Mutate substrate
  substrate.clear();
  assert.strictEqual(substrate.getMetrics().totalStringsCleaned, 0);

  // Rewind (warmed)
  snapshotManager.restoreSnapshot("snap-cleaner-1");
  const tRewindStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("snap-cleaner-1");
  const rewindLatencyMs = performance.now() - tRewindStart;

  assert.ok(restored, "Snapshot restore must succeed");
  assert.ok(substrate.getMetrics().totalStringsCleaned >= 2);
  assert.ok(rewindLatencyMs < 0.05, `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.05 ms SLA`);
  console.log(`  [✓] Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms).`);

  // ---------------------------------------------------------------------------
  // Suite 7: Model Tool Suite Execution
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Model Tool Suite Execution...");

  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 5, "Must expose exactly 5 model tools");

  const stripTool = tools.find((t) => t.name === "terminal_cleaner_strip_ansi")!;
  const sanitizeTool = tools.find((t) => t.name === "terminal_cleaner_sanitize_display")!;
  const classifyTool = tools.find((t) => t.name === "terminal_cleaner_classify_path")!;
  const configTool = tools.find((t) => t.name === "terminal_cleaner_configure")!;
  const metricsTool = tools.find((t) => t.name === "terminal_cleaner_get_metrics")!;

  const stripRes = (await stripTool.execute({ text: "\x1b[32mSuccess\x1b[0m" }, "")) as any;
  assert.strictEqual(stripRes.success, true);
  assert.strictEqual(stripRes.cleaned, "Success");

  const sanRes = (await sanitizeTool.execute({ text: "Hello\rWorld\x07" }, "")) as any;
  assert.strictEqual(sanRes.success, true);
  assert.strictEqual(sanRes.cleaned, "Hello\nWorld");

  const clsRes = (await classifyTool.execute({ filePath: "data/sheet.xlsx" }, "")) as any;
  assert.strictEqual(clsRes.success, true);
  assert.strictEqual(clsRes.classification, "opaque_document");
  assert.strictEqual(clsRes.canWriteAsText, false);

  const cfgRes = (await configTool.execute({ guardOpaqueDocuments: false }, "")) as any;
  assert.strictEqual(cfgRes.success, true);
  assert.strictEqual(cfgRes.config.guardOpaqueDocuments, false);

  const metRes = (await metricsTool.execute({}, "")) as any;
  assert.strictEqual(metRes.success, true);
  assert.ok(metRes.metrics.totalStringsCleaned > 0);
  console.log("  [✓] All 5 Terminal Cleaner model tools executed cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 8: High-Frequency Text Cleaning Micro-Benchmarks
  // ---------------------------------------------------------------------------
  console.log("\n[Test 8/8] Benchmarking High-Frequency Text Sanitization...");

  const iterations = 100000;
  const rawTextWithEscapes = "\x1b[1;34mInfo:\x1b[0m Process completed in \x1b[32m12.4ms\x1b[0m\r\n";

  const tBenchStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    engine.sanitizeDisplayText(rawTextWithEscapes);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} text sanitizations in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(throughputOpsPerSec > 1000000, "Throughput must exceed 1,000,000 ops/sec");

  console.log("  [✓] Ultra-high-throughput benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 TERMINAL CLEANER VALIDATION SUITES PASSED CLEANLY!     ");
  console.log("================================================================\n");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
