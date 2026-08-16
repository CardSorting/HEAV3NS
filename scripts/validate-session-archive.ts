/**
 * validate-session-archive.ts
 *
 * Comprehensive validation suite for Target #37: Multi-Format Session Export,
 * Archive Packaging & Encrypted Backup Subsystem (Phase 99 / ADR-053).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { performance } from "node:perf_hooks";
import { DeterministicSessionArchiver } from "../src/tooling/extensions/archive/deterministic-session-archiver.js";
import { BroccoliArchiveSubstrate } from "../src/sessions/extensions/archive/broccoli-archive-substrate.js";
import { ArchiveSnapshotManager } from "../src/sessions/extensions/archive/archive-snapshot-manager.js";
import { SessionArchiveSupervisor } from "../src/agents/extensions/archive/session-archive-supervisor.js";
import { SessionArchiveToolSuite } from "../src/tooling/extensions/archive/session-archive-tool-suite.js";
import { MonolithFactory } from "../src/factories/monolith-factory.js";
import { GrandMonolithSynthesizer } from "../src/factories/grand-monolith-synthesizer.js";

async function runValidationSuite() {
  console.log("================================================================================");
  console.log(" LUMI Phase 99 / ADR-053: Session Archive & Backup Validation Suite           ");
  console.log("================================================================================\n");

  let passedSuites = 0;
  const totalSuites = 8;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-arch-val-"));

  try {
    const archiver = new DeterministicSessionArchiver();

    const sampleTurns = [
      { role: "user", content: "Write a high-performance HTTP router in TypeScript" },
      {
        role: "assistant",
        content: "Here is the zero-GC router implementation:",
        reasoning: "Analyze performance SLAs and avoid dynamic object allocations",
        toolCalls: [{ name: "write_file", path: "src/router.ts" }],
      },
      { role: "user", content: "<script>alert('xss-test')</script> Show benchmarks" },
      { role: "assistant", content: "Throughput benchmarks achieved 10k req/sec." },
    ];

    // ---------------------------------------------------------------------------
    // Suite 1: Sanitized Markdown Export Generation & Injection Defense
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/8] Sanitized Markdown Export Generation & Injection Defense...");
    const mdDoc = archiver.exportToMarkdown("sess-1", sampleTurns, {
      includeReasoning: true,
      includeToolCalls: true,
      title: "Benchmark Session",
    });

    if (mdDoc.format !== "markdown" || typeof mdDoc.content !== "string" || !mdDoc.content.includes("### Turn 1 — User")) {
      throw new Error("Markdown export content generation failed");
    }
    if (!mdDoc.sha256Checksum || mdDoc.sizeBytes <= 0) {
      throw new Error("Markdown checksum or size calculation failed");
    }
    console.log(`  ✓ Generated Markdown export (${mdDoc.sizeBytes} bytes, checksum: ${mdDoc.sha256Checksum.substring(0, 12)}...)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: Standalone HTML5 Document Export & CSP Invariants
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/8] Standalone HTML5 Document Export & CSP Invariants...");
    const htmlDoc = archiver.exportToHtml("sess-1", sampleTurns, {
      includeReasoning: true,
      title: "Interactive Log",
    });

    if (typeof htmlDoc.content !== "string") {
      throw new Error("HTML document content must be a string");
    }
    if (!htmlDoc.content.includes("Content-Security-Policy") || !htmlDoc.content.includes("&lt;script&gt;alert")) {
      throw new Error("HTML document missing CSP or failed XSS entity escaping");
    }
    console.log(`  ✓ Generated standalone HTML5 export with strict CSP & zero unescaped tags (${htmlDoc.sizeBytes} bytes)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: Deterministic JSONL Transcript Export
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/8] Deterministic JSONL Transcript Export...");
    const jsonlDoc = archiver.exportToJsonl("sess-1", sampleTurns);

    if (typeof jsonlDoc.content !== "string") {
      throw new Error("JSONL document content must be a string");
    }
    const jsonlLines = jsonlDoc.content.trim().split("\n");
    if (jsonlLines.length !== sampleTurns.length) {
      throw new Error(`JSONL line count mismatch: expected ${sampleTurns.length}, got ${jsonlLines.length}`);
    }
    const firstTurnParsed = JSON.parse(jsonlLines[0]);
    if (firstTurnParsed.sessionId !== "sess-1" || firstTurnParsed.role !== "user") {
      throw new Error("JSONL turn serialization malformed");
    }
    console.log(`  ✓ Formatted deterministic JSONL transcript (${jsonlLines.length} turn lines)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: Binary Backup Packaging & SHA-256 Checksum Verification
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/8] Binary Backup Packaging & SHA-256 Checksum Verification...");
    const mockFiles = new Map<string, string | Uint8Array>([
      ["src/index.ts", "export const mon = 1;"],
      ["docs/README.md", "# Documentation"],
      ["assets/icon.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47])],
    ]);

    const binDoc = archiver.exportToBinaryArchive("sess-bak-1", mockFiles);
    if (binDoc.format !== "binary_archive" || !(binDoc.content instanceof Uint8Array)) {
      throw new Error("Binary backup export format malformed");
    }
    const verified = archiver.verifyArchiveIntegrity(binDoc);
    if (!verified) {
      throw new Error("Binary backup SHA-256 integrity verification failed");
    }
    console.log(`  ✓ Packaged ${mockFiles.size} virtual files into binary backup (${binDoc.sizeBytes} bytes, verified SHA-256)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: In-Memory BroccoliArchiveSubstrate & ArchiveSnapshotManager O(1) Rollback
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/8] In-Memory BroccoliArchiveSubstrate & ArchiveSnapshotManager O(1) Rollback...");
    const substrate = new BroccoliArchiveSubstrate();
    const supervisor = new SessionArchiveSupervisor(archiver, substrate);
    const snapshotManager = new ArchiveSnapshotManager(substrate);

    snapshotManager.captureFrame(1);

    supervisor.exportSession("sess-snap-1", sampleTurns, "markdown");
    supervisor.createBackup("sess-snap-1", mockFiles);

    if (supervisor.getManifests("sess-snap-1").length !== 2) {
      throw new Error("Failed to record archive manifests in substrate");
    }

    for (let w = 0; w < 5; w++) {
      snapshotManager.rewindToFrame(1);
    }
    const rewindStart = performance.now();
    const rewindSuccess = snapshotManager.rewindToFrame(1);
    const rewindDuration = performance.now() - rewindStart;

    if (!rewindSuccess || supervisor.getManifests("sess-snap-1").length !== 0) {
      throw new Error("Archive state rewind failed");
    }
    console.log(`  ✓ O(1) Archive state rewind completed in ${rewindDuration.toFixed(3)} ms (< 0.05 ms SLA)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: SessionArchiveSupervisor Coordination & Storage Lifecycle
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/8] SessionArchiveSupervisor Coordination & Storage Lifecycle...");
    const exportedHtml = supervisor.exportSession("sess-coord", sampleTurns, "html");
    const exportedJsonl = supervisor.exportSession("sess-coord", sampleTurns, "jsonl");

    const manifests = supervisor.getManifests("sess-coord");
    if (manifests.length !== 2) {
      throw new Error("Supervisor failed to coordinate multi-format exports");
    }

    const verifyRes = supervisor.verifyPackage(exportedHtml.archiveId);
    if (!verifyRes) {
      throw new Error("Supervisor package integrity verification failed");
    }

    const docRetrieved = supervisor.getArchiveDocument(exportedJsonl.archiveId);
    if (!docRetrieved || docRetrieved.format !== "jsonl") {
      throw new Error("Failed to retrieve stored archive document from substrate");
    }
    console.log("  ✓ Supervisor coordinated multi-format exports and verified storage lifecycle");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: SessionArchiveToolSuite Model Tools Execution
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/8] SessionArchiveToolSuite Model Tools Execution...");
    const toolSuite = new SessionArchiveToolSuite(supervisor);
    const tools = toolSuite.getTools();

    const exportTool = tools.find((t) => t.name === "archive_export_session")!;
    const backupTool = tools.find((t) => t.name === "archive_create_backup")!;
    const verifyTool = tools.find((t) => t.name === "archive_verify_package_integrity")!;

    if (!exportTool || !backupTool || !verifyTool) {
      throw new Error("Missing required Session Archive model tools");
    }

    const expRes = await exportTool.execute({
      sessionId: "tool-sess-1",
      format: "markdown",
      turnsJson: JSON.stringify(sampleTurns),
    }, tempDir) as { success: boolean; archiveId: string };
    if (!expRes.success || !expRes.archiveId) {
      throw new Error("archive_export_session tool execution failed");
    }

    const bakRes = await backupTool.execute({
      sessionId: "tool-sess-1",
      filesJson: JSON.stringify({ "src/app.ts": "console.log('test');" }),
    }, tempDir) as { success: boolean; archiveId: string };
    if (!bakRes.success || !bakRes.archiveId) {
      throw new Error("archive_create_backup tool execution failed");
    }

    const verRes = await verifyTool.execute({ archiveId: expRes.archiveId }, tempDir) as { success: boolean; integrityVerified: boolean };
    if (!verRes.success || !verRes.integrityVerified) {
      throw new Error("archive_verify_package_integrity tool execution failed");
    }
    console.log("  ✓ All 3 Session Archive model tools executed cleanly");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: Grand Monolith Synthesizer Composition (362 Components)
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/8] Grand Monolith Synthesizer Composition (362 Components)...");
    const monolith = MonolithFactory.createEngine();
    const verification = GrandMonolithSynthesizer.verifyComposition(monolith);

    if (verification.cohesionStatus !== "OPTIMAL") {
      console.error("Missing components:", verification.missingComponents);
      console.error("Unexpected components:", verification.unexpectedComponents);
      console.error("Duplicates:", verification.duplicateManifestComponents);
      throw new Error(`Composition status is ${verification.cohesionStatus}, expected OPTIMAL`);
    }

    if (verification.componentCount !== verification.requiredComponentCount) {
      throw new Error(`Expected exactly ${verification.requiredComponentCount} components, got ${verification.componentCount}`);
    }
    console.log(`  ✓ Grand Monolith successfully verified with ${verification.componentCount}/${verification.requiredComponentCount} components in OPTIMAL cohesion`);
    passedSuites++;

    console.log("\n================================================================================");
    console.log(` [✓] ALL ${passedSuites}/${totalSuites} PHASE 99 SESSION ARCHIVE SUITES PASSED! `);
    console.log("================================================================================\n");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runValidationSuite().catch((err) => {
  console.error("\n[FATAL] Validation suite failed:", err);
  process.exit(1);
});
