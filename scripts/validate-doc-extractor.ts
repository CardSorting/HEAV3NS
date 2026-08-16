/**
 * validate-doc-extractor.ts
 *
 * Comprehensive validation suite for Target #49: Binary Extension Perception,
 * Opaque Document Destruction Guard & Structured Document Extractor Subsystem (Phase 116 / ADR-092).
 */

import assert from "node:assert";
import { deflateRawSync } from "node:zlib";
import {
  DeterministicDocExtractor,
  DocExtractorSupervisor,
  BroccoliDocExtractorSubstrate,
  DocExtractorSnapshotManager,
  DocExtractorToolSuite,
  BINARY_EXTENSIONS,
  OPAQUE_DOCUMENT_EXTENSIONS,
} from "../src/index.js";

function createMockZipBuffer(entries: Record<string, string | Buffer>): Buffer {
  const fileBuffers: Buffer[] = [];

  for (const [name, content] of Object.entries(entries)) {
    const rawData = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
    const compData = deflateRawSync(rawData);

    const nameBuf = Buffer.from(name, "utf-8");
    const header = Buffer.alloc(30);

    header.writeUInt32LE(0x04034b50, 0); // Signature
    header.writeUInt16LE(20, 4); // Version needed
    header.writeUInt16LE(0, 6); // Bit flag
    header.writeUInt16LE(8, 8); // Method = DEFLATE
    header.writeUInt16LE(0, 10); // Mod time
    header.writeUInt16LE(0, 12); // Mod date
    header.writeUInt32LE(0, 14); // CRC32 (mock 0)
    header.writeUInt32LE(compData.length, 18); // Comp size
    header.writeUInt32LE(rawData.length, 22); // Uncomp size
    header.writeUInt16LE(nameBuf.length, 26); // File name len
    header.writeUInt16LE(0, 28); // Extra field len

    fileBuffers.push(Buffer.concat([header, nameBuf, compData]));
  }

  return Buffer.concat(fileBuffers);
}

async function runSuite() {
  console.log("================================================================");
  console.log("   LUMI Document Extractor & Binary Perception (ADR-092)        ");
  console.log("================================================================");

  const extractor = new DeterministicDocExtractor();
  const substrate = new BroccoliDocExtractorSubstrate();
  const snapshotManager = new DocExtractorSnapshotManager(substrate);
  const supervisor = new DocExtractorSupervisor(substrate, extractor);
  const toolSuite = new DocExtractorToolSuite(supervisor);

  // --------------------------------------------------------------------------
  // [Test 1/8] Fast Binary Extension Classification across 80+ extensions
  // --------------------------------------------------------------------------
  console.log("\n[Test 1/8] Validating Fast Binary Extension Classification...");

  const binarySamples = [
    "avatar.png", "photo.jpg", "clip.mp4", "movie.mkv", "audio.mp3", "track.flac",
    "bundle.zip", "archive.tar.gz", "app.exe", "libcore.so", "runtime.dylib",
    "cache.pyc", "engine.wasm", "data.sqlite", "vector.db", "font.woff2",
    "design.psd", "lock.lockb"
  ];

  for (const file of binarySamples) {
    assert.strictEqual(extractor.hasBinaryExtension(file), true, `Failed on ${file}`);
  }

  const textSamples = [
    "index.ts", "config.json", "script.py", "README.md", "styles.css", "main.rs"
  ];

  for (const file of textSamples) {
    assert.strictEqual(extractor.hasBinaryExtension(file), false, `Failed on ${file}`);
  }

  assert.ok(BINARY_EXTENSIONS.size >= 50);
  console.log(`  [✓] Verified ${BINARY_EXTENSIONS.size} binary file extension patterns (Zero-I/O string resolution).`);

  // --------------------------------------------------------------------------
  // [Test 2/8] Opaque Document Destruction Guard
  // --------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Opaque Document Destruction Guard...");

  const opaqueFiles = [
    "quarterly_report.docx", "financials.xlsx", "presentation.pptx",
    "book.epub", "document.odt", "sheet.ods"
  ];

  for (const file of opaqueFiles) {
    assert.strictEqual(extractor.isOpaqueDocument(file), true);
    const check = extractor.verifySafeWrite(file);
    assert.strictEqual(check.safe, false);
    assert.strictEqual(check.format, "opaque_container");
    assert.ok(check.reason && check.reason.includes("opaque container document"));
    assert.ok(check.recommendedAction && check.recommendedAction.includes("Export or convert"));
  }

  const safeFiles = ["report.md", "data.csv", "notes.txt", "doc.pdf"];
  for (const file of safeFiles) {
    const check = extractor.verifySafeWrite(file);
    assert.strictEqual(check.safe, true);
  }

  assert.ok(OPAQUE_DOCUMENT_EXTENSIONS.size >= 10);
  console.log("  [✓] Opaque document overwrites intercepted and guarded against destructive plain-text loss.");

  // --------------------------------------------------------------------------
  // [Test 3/8] Jupyter Notebook (.ipynb) Extraction
  // --------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Jupyter Notebook (.ipynb) Extraction...");

  const mockIpynb = {
    nbformat: 4,
    metadata: {
      kernelspec: { name: "python3" }
    },
    cells: [
      {
        cell_type: "markdown",
        source: ["# Data Analysis\n", "Let's load the dataset."]
      },
      {
        cell_type: "code",
        execution_count: 1,
        source: ["import numpy as np\n", "x = np.array([1, 2, 3])\n", "print(x)"],
        outputs: [
          {
            output_type: "stream",
            text: ["[1 2 3]\n"]
          }
        ]
      },
      {
        cell_type: "code",
        execution_count: 2,
        source: ["1 / 0"],
        outputs: [
          {
            output_type: "error",
            traceback: ["\x1b[0;31mZeroDivisionError\x1b[0m: division by zero"]
          }
        ]
      }
    ]
  };

  const ipynbRes = extractor.extractIpynb(JSON.stringify(mockIpynb));
  assert.strictEqual(ipynbRes.format, "ipynb");
  assert.ok(ipynbRes.textContent.includes("# Data Analysis"));
  assert.ok(ipynbRes.textContent.includes("```python # In [1]"));
  assert.ok(ipynbRes.textContent.includes("[1 2 3]"));
  assert.ok(ipynbRes.textContent.includes("ZeroDivisionError: division by zero"));
  assert.strictEqual(ipynbRes.pageOrSheetCount, 3);

  console.log("  [✓] Jupyter Notebook (.ipynb) markdown, code cells, stream outputs, and clean tracebacks extracted.");

  // --------------------------------------------------------------------------
  // [Test 4/8] OpenXML Word Document (.docx) Extraction
  // --------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating OpenXML Word Document (.docx) Extraction...");

  const mockDocXml = `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>Project Specification</w:t></w:r></w:p>
        <w:p><w:r><w:t>Hermes Agent &amp; LUMI Monolith integration.</w:t></w:r></w:p>
      </w:body>
    </w:document>
  `;

  const docxZipBuf = createMockZipBuffer({
    "word/document.xml": mockDocXml,
  });

  const docxRes = extractor.extractDocx(docxZipBuf);
  assert.strictEqual(docxRes.format, "docx");
  assert.ok(docxRes.textContent.includes("Project Specification"));
  assert.ok(docxRes.textContent.includes("Hermes Agent & LUMI Monolith integration."));

  console.log("  [✓] OpenXML Word Document (.docx) zero-dependency ZIP decompression and paragraph extraction verified.");

  // --------------------------------------------------------------------------
  // [Test 5/8] OpenXML Excel Spreadsheet (.xlsx) Extraction
  // --------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating OpenXML Excel Spreadsheet (.xlsx) Extraction...");

  const mockSharedStrings = `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <si><t>Service</t></si>
      <si><t>Status</t></si>
      <si><t>Gateway</t></si>
      <si><t>Active</t></si>
    </sst>
  `;

  const mockSheet1 = `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <sheetData>
        <row r="1">
          <c r="A1" t="s"><v>0</v></c>
          <c r="B1" t="s"><v>1</v></c>
        </row>
        <row r="2">
          <c r="A2" t="s"><v>2</v></c>
          <c r="B2" t="s"><v>3</v></c>
        </row>
      </sheetData>
    </worksheet>
  `;

  const xlsxZipBuf = createMockZipBuffer({
    "xl/sharedStrings.xml": mockSharedStrings,
    "xl/worksheets/sheet1.xml": mockSheet1,
  });

  const xlsxRes = extractor.extractXlsx(xlsxZipBuf);
  assert.strictEqual(xlsxRes.format, "xlsx");
  assert.ok(xlsxRes.textContent.includes("## Sheet: sheet1"));
  assert.ok(xlsxRes.textContent.includes("| Service | Status |"));
  assert.ok(xlsxRes.textContent.includes("| Gateway | Active |"));

  console.log("  [✓] OpenXML Excel Spreadsheet (.xlsx) shared strings and grid markdown formatting verified.");

  // --------------------------------------------------------------------------
  // [Test 6/8] PDF Text Stream (.pdf) Extraction Heuristics
  // --------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating PDF Text Stream (.pdf) Extraction...");

  const mockPdfContent = `
    %PDF-1.4
    1 0 obj
    << /Type /Catalog /Pages 2 0 R >>
    endobj
    2 0 obj
    << /Type /Pages /Kids [3 0 R] /Count 1 >>
    endobj
    3 0 obj
    << /Type /Page /Parent 2 0 R /Contents 4 0 R >>
    endobj
    4 0 obj
    << /Length 50 >>
    stream
    BT
    /F1 12 Tf
    (Hello Antigravity Autonomous Agent) Tj
    (Deterministic PDF stream extraction) Tj
    ET
    endstream
    endobj
    xref
    trailer
    << /Root 1 0 R >>
    %%EOF
  `;

  const pdfRes = extractor.extractPdfText(Buffer.from(mockPdfContent, "latin1"));
  assert.strictEqual(pdfRes.format, "pdf");
  assert.ok(pdfRes.textContent.includes("Hello Antigravity Autonomous Agent"));
  assert.ok(pdfRes.textContent.includes("Deterministic PDF stream extraction"));

  console.log("  [✓] PDF text streams and literal string sequences unescaped and extracted.");

  // --------------------------------------------------------------------------
  // [Test 7/8] In-Memory Substrate Caching, Binary Snapshots & O(1) Rollback
  // --------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating In-Memory Substrate Caching & O(1) Rollback...");

  substrate.clear();
  supervisor.extractDocument("spec.docx", docxZipBuf);
  supervisor.extractDocument("grid.xlsx", xlsxZipBuf);
  supervisor.verifySafeWrite("contract.docx");

  assert.strictEqual(substrate.listCachedDocs().length, 2);
  assert.strictEqual(substrate.getMetrics().totalOpaqueBlocks, 1);

  // Take Snapshot
  const snapshot = snapshotManager.takeSnapshot("checkpoint-doc-1");

  supervisor.extractDocument("notes.ipynb", JSON.stringify(mockIpynb));
  assert.strictEqual(substrate.listCachedDocs().length, 3);

  // JIT Warmup
  for (let i = 0; i < 5; i++) {
    snapshotManager.restoreSnapshot("checkpoint-doc-1");
  }

  supervisor.extractDocument("notes.ipynb", JSON.stringify(mockIpynb));
  const tRollbackStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("checkpoint-doc-1");
  const rollbackDurationMs = performance.now() - tRollbackStart;

  assert.strictEqual(restored, true);
  assert.strictEqual(substrate.listCachedDocs().length, 2);
  assert.ok(
    rollbackDurationMs < 0.05,
    `Rollback completed in ${rollbackDurationMs.toFixed(4)} ms (< 0.05 ms SLA)`
  );

  console.log(`  [✓] Substrate document cache & instant O(1) rollback verified (${rollbackDurationMs.toFixed(4)} ms).`);

  // --------------------------------------------------------------------------
  // [Test 8/8] Model Tool Suite (5 Tools) & Ultra-High-Throughput Micro-Benchmark
  // --------------------------------------------------------------------------
  console.log("\n[Test 8/8] Validating Model Tool Suite & Micro-Benchmarks...");

  // Tool 1: doc_extract_text
  const t1 = await toolSuite.getTools().find((t) => t.name === "doc_extract_text")?.execute({
    file_path: "document.docx",
    content_base64: docxZipBuf.toString("base64"),
  }, "");
  assert.strictEqual((t1 as any)?.success, true);
  assert.ok((t1 as any)?.textContent.includes("Project Specification"));

  // Tool 2: doc_check_binary_extension
  const t2 = await toolSuite.getTools().find((t) => t.name === "doc_check_binary_extension")?.execute({
    file_path: "archive.zip",
  }, "");
  assert.strictEqual((t2 as any)?.success, true);
  assert.strictEqual((t2 as any)?.isBinary, true);

  // Tool 3: doc_verify_safe_write
  const t3 = await toolSuite.getTools().find((t) => t.name === "doc_verify_safe_write")?.execute({
    file_path: "presentation.pptx",
  }, "");
  assert.strictEqual((t3 as any)?.success, true);
  assert.strictEqual((t3 as any)?.safe, false);

  // Tool 4: doc_inspect_cache
  const t4 = await toolSuite.getTools().find((t) => t.name === "doc_inspect_cache")?.execute({}, "");
  assert.strictEqual((t4 as any)?.success, true);

  // Tool 5: doc_get_extractor_metrics
  const t5 = await toolSuite.getTools().find((t) => t.name === "doc_get_extractor_metrics")?.execute({}, "");
  assert.strictEqual((t5 as any)?.success, true);
  assert.ok((t5 as any)?.metrics?.totalExtractions >= 1);

  // Ultra-High-Throughput Micro-Benchmark: 50,000 binary extension & write safety evaluations
  const iterations = 50000;
  const samplePaths = [
    "src/index.ts", "public/image.png", "docs/manual.docx",
    "build/app.wasm", "archive.tar.gz", "sheets/data.xlsx"
  ];
  const tBenchStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    const p = samplePaths[i % samplePaths.length];
    extractor.hasBinaryExtension(p);
    extractor.verifySafeWrite(p);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} operations in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(throughputOpsPerSec > 500000, "Throughput must exceed 500,000 ops/sec");

  console.log("  [✓] All 5 model tools executed cleanly & ultra-high-throughput benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 DOCUMENT EXTRACTOR VALIDATION SUITES PASSED CLEANLY!  ");
  console.log("================================================================");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
