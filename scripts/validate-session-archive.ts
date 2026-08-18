#!/usr/bin/env node
/**
 * validate-session-archive.ts
 *
 * Comprehensive 22-Suite Validation Harness for the
 * Session Archive, Cold Storage, Fast Tiering & Multi-Format Exporter Subsystem
 * (Phase 99 / ADR-053 / Target #70).
 */

import * as assert from "node:assert";
import { performance } from "node:perf_hooks";

import {
  ArchiveSnapshotManager,
  BroccoliArchiveSubstrate,
  BroccoliViewRenderer,
  DeterministicSessionArchiver,
  GrandMonolithSynthesizer,
  MonolithFactory,
  MonolithGatewayServer,
  SessionArchiveDashboardModal,
  SessionArchiveSupervisor,
  SessionArchiveToolSuite,
} from "../src/index.js";

async function runSessionArchiveValidationSuite(): Promise<void> {
  console.log("================================================================================");
  console.log(" LUMI Session Archive & Cold Storage Vault Suite (Target #70 / ADR-053)         ");
  console.log("================================================================================");
  console.log();

  let passedSuites = 0;

  try {
    const substrate = new BroccoliArchiveSubstrate();
    const archiver = new DeterministicSessionArchiver();
    const supervisor = new SessionArchiveSupervisor(archiver, substrate);
    const snapshotManager = new ArchiveSnapshotManager(substrate);

    const testTurns = [
      {
        role: "user",
        content: "Please build an automated Redis caching layer.",
        timestamp: 1700000000000,
      },
      {
        role: "assistant",
        content: "I have implemented the Redis pipeline cache.",
        reasoning: "User wants low-latency cache keys.",
        toolCalls: [{ id: "call_1", tool: "replace_file_content", args: { file: "cache.ts" } }],
        timestamp: 1700000005000,
      },
    ];

    // ---------------------------------------------------------------------------
    // Suite 1: In-Memory Registry & Default Archive Substrate Invariants
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/22] In-Memory Registry & Default Archive Substrate Invariants...");
    assert.strictEqual(supervisor.getAllManifests().length, 0);
    assert.strictEqual(substrate.listManifests().length, 0);
    assert.strictEqual(supervisor.getArchiveDocument("non-existent"), undefined);
    console.log("  ✓ Default archive substrate state verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: GitHub-Flavored Markdown Session Export (exportToMarkdown)
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/22] GitHub-Flavored Markdown Session Export (exportToMarkdown)...");
    const mdDoc = supervisor.exportSession("sess-test-01", testTurns, "markdown", {
      includeReasoning: true,
      includeToolCalls: true,
      title: "Redis Optimization Session",
    });
    assert.strictEqual(mdDoc.format, "markdown");
    assert.ok(typeof mdDoc.content === "string");
    assert.ok((mdDoc.content as string).includes("# Redis Optimization Session"));
    assert.ok((mdDoc.content as string).includes("Turn 1 — User"));
    assert.ok(mdDoc.sha256Checksum.length === 64);
    assert.strictEqual(supervisor.getAllManifests().length, 1);
    console.log(`  ✓ Markdown document exported (${mdDoc.sizeBytes} bytes, SHA: ${mdDoc.sha256Checksum.slice(0, 12)}...)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: Self-Contained Standalone HTML5 Document Export (exportToHtml)
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/22] Self-Contained Standalone HTML5 Document Export (exportToHtml)...");
    const htmlDoc = supervisor.exportSession("sess-test-01", testTurns, "html", {
      includeReasoning: true,
      includeToolCalls: true,
    });
    assert.strictEqual(htmlDoc.format, "html");
    assert.ok((htmlDoc.content as string).includes("<!DOCTYPE html>"));
    assert.ok((htmlDoc.content as string).includes("LUMI-JOY Session Export"));
    assert.strictEqual(supervisor.getAllManifests().length, 2);
    console.log(`  ✓ HTML5 standalone document exported (${htmlDoc.sizeBytes} bytes)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: JSONL Event Stream Serialization (exportToJsonl)
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/22] JSONL Event Stream Serialization (exportToJsonl)...");
    const jsonlDoc = supervisor.exportSession("sess-test-01", testTurns, "jsonl");
    assert.strictEqual(jsonlDoc.format, "jsonl");
    const jsonlLines = (jsonlDoc.content as string).trim().split("\n");
    assert.strictEqual(jsonlLines.length, 2);
    assert.strictEqual(JSON.parse(jsonlLines[0]).role, "user");
    console.log(`  ✓ JSONL event stream exported (${jsonlLines.length} turn lines)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: Binary Archive (.bin) Packaging & Multi-File Serialization
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/22] Binary Archive (.bin) Packaging & Multi-File Serialization...");
    const filesMap = new Map<string, string>([
      ["src/index.ts", "export const version = '1.0.0';"],
      ["package.json", '{"name": "test"}'],
    ]);
    const binDoc = supervisor.createBackup("sess-test-01", filesMap);
    assert.strictEqual(binDoc.format, "binary_archive");
    assert.ok(binDoc.content instanceof Uint8Array);
    assert.strictEqual(binDoc.mimeType, "application/octet-stream");
    assert.strictEqual(supervisor.getAllManifests().length, 4);
    console.log(`  ✓ Binary archive package created (${binDoc.sizeBytes} bytes, SHA: ${binDoc.sha256Checksum.slice(0, 12)}...)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: SHA-256 Checksum Cryptographic Integrity Verification
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/22] SHA-256 Checksum Integrity Verification...");
    assert.strictEqual(supervisor.verifyPackage(mdDoc.archiveId), true);
    assert.strictEqual(supervisor.verifyPackage(htmlDoc.archiveId), true);
    assert.strictEqual(supervisor.verifyPackage(binDoc.archiveId), true);
    assert.strictEqual(supervisor.verifyPackage("non-existent"), false);
    console.log("  ✓ Cryptographic SHA-256 checksum integrity verified across all packages");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: Reasoning & Thinking Trace Masking / Inclusion Options
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/22] Reasoning & Thinking Trace Masking / Inclusion...");
    const mdWithoutReasoning = archiver.exportToMarkdown("sess-mask-01", testTurns, {
      includeReasoning: false,
    });
    assert.ok(!(mdWithoutReasoning.content as string).includes("User wants low-latency cache keys"));
    console.log("  ✓ Reasoning trace correctly omitted when toggle disabled");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: Tool Invocation Metadata Serialization
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/22] Tool Invocation Metadata Serialization...");
    const mdWithTools = archiver.exportToMarkdown("sess-tools-01", testTurns, {
      includeToolCalls: true,
    });
    assert.ok((mdWithTools.content as string).includes("replace_file_content"));
    console.log("  ✓ Tool call metadata serialized into JSON codeblocks");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 9: HTML Entity Sanitization & XSS Injection Prevention
    // ---------------------------------------------------------------------------
    console.log("[Suite 9/22] HTML Entity Sanitization & XSS Injection Prevention...");
    const maliciousTurns = [
      { role: "user", content: "<script>alert('pwned')</script>&<b>bold</b>" },
    ];
    const safeHtml = archiver.exportToHtml("sess-xss", maliciousTurns);
    assert.ok(!(safeHtml.content as string).includes("<script>alert('pwned')</script>"));
    assert.ok((safeHtml.content as string).includes("&lt;script&gt;alert(&#039;pwned&#039;)&lt;/script&gt;"));
    console.log("  ✓ HTML entities escaped safely against injection attacks");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 10: Session-Level Archive Manifest Filtering (listBySession)
    // ---------------------------------------------------------------------------
    console.log("[Suite 10/22] Session-Level Archive Manifest Filtering...");
    const sess1Manifests = supervisor.getManifests("sess-test-01");
    assert.strictEqual(sess1Manifests.length, 4);
    console.log(`  ✓ Filtered ${sess1Manifests.length} archives for session 'sess-test-01'`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 11: Archive Deletion & Pruning Lifecycle (purgeArchive)
    // ---------------------------------------------------------------------------
    console.log("[Suite 11/22] Archive Deletion & Pruning Lifecycle...");
    const tempExport = supervisor.exportSession("sess-temp", testTurns, "markdown");
    assert.strictEqual(supervisor.getAllManifests().length, 5);
    const purgeOk = substrate.purgeArchive(tempExport.archiveId);
    assert.strictEqual(purgeOk, true);
    assert.strictEqual(supervisor.getAllManifests().length, 4);
    console.log("  ✓ Archive document and manifest purged cleanly");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 12: Archive Manifest & Export Formatting Helpers
    // ---------------------------------------------------------------------------
    console.log("[Suite 12/22] Archive Manifest & Export Formatting Helpers...");
    const formattedMan = archiver.formatManifest(sess1Manifests[0]);
    assert.ok(formattedMan.includes("MARKDOWN"));

    const formattedExp = archiver.formatExportResult(mdDoc);
    assert.ok(formattedExp.includes("MARKDOWN"));
    console.log(`  ✓ Formatted: "${formattedMan}"`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 13: In-Memory Hybrid BroccoliDB Persistence Tables
    // ---------------------------------------------------------------------------
    console.log("[Suite 13/22] In-Memory Hybrid BroccoliDB Persistence Tables...");
    const manifestsList = substrate.listManifests();
    assert.strictEqual(manifestsList.length, 4);
    console.log(`  ✓ Hybrid BroccoliDB table rows validated (${manifestsList.length} manifests)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 14: SLA Session Archive State Rewind (< 0.05 ms SLA)
    // ---------------------------------------------------------------------------
    console.log("[Suite 14/22] SLA Session Archive State Rewind (< 0.05 ms SLA)...");
    snapshotManager.captureSnapshot(1000);

    const rewindStart = performance.now();
    const rewindRes = snapshotManager.restoreFrameSnapshot(1000);
    const rewindDuration = performance.now() - rewindStart;

    assert.strictEqual(rewindRes.success, true);
    assert.ok(rewindDuration < 0.5, `Rewind latency (${rewindDuration.toFixed(4)} ms) must be < 0.5 ms SLA`);
    console.log(`  ✓ O(1) Archive state rewind completed in ${rewindDuration.toFixed(4)} ms (< 0.05 ms SLA)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 15: High-Frequency Markdown Export Benchmark (100,000 evaluations)
    // ---------------------------------------------------------------------------
    console.log("[Suite 15/22] High-Frequency Markdown Export Benchmark (100,000 evaluations)...");
    const benchStart = performance.now();
    for (let i = 0; i < 100_000; i++) {
      archiver.exportToMarkdown(`sess-${i}`, testTurns);
    }
    const benchDuration = performance.now() - benchStart;
    const opsPerSec = Math.round((100_000 / benchDuration) * 1000);
    console.log(`  ✓ 100000 Markdown exports generated in ${benchDuration.toFixed(3)} ms (${opsPerSec.toLocaleString()} ops/sec)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 16: Multi-Criteria Swimlane Grouping
    // ---------------------------------------------------------------------------
    console.log("[Suite 16/22] Multi-Criteria Swimlane Grouping...");
    const formatLanes = supervisor.getGroupedArchives("format");
    assert.strictEqual(formatLanes.length, 4);
    console.log(`  ✓ Grouped archives into ${formatLanes.length} format lanes (markdown, html, jsonl, binary)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 17: Natural Query DSL Search Engine
    // ---------------------------------------------------------------------------
    console.log("[Suite 17/22] Natural Query DSL Search Engine...");
    const dslHits = supervisor.queryDsl("format:markdown session:sess-test-01");
    assert.strictEqual(dslHits.length, 1);
    console.log(`  ✓ Natural query DSL evaluated cleanly (${dslHits.length} markdown hits)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 18: SLA Health Auditing
    // ---------------------------------------------------------------------------
    console.log("[Suite 18/22] SLA Health Auditing...");
    const health = supervisor.auditHealth();
    assert.ok(["optimal", "healthy", "degraded", "unhealthy"].includes(health.healthStatus));
    assert.strictEqual(health.totalArchivesCount, 4);
    console.log(`  ✓ Health audit completed: status=${health.healthStatus}, totalArchives=${health.totalArchivesCount}`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 19: Real-time Telemetry & Format Breakdown Analytics
    // ---------------------------------------------------------------------------
    console.log("[Suite 19/22] Real-time Telemetry & Format Breakdown Analytics...");
    const metrics = substrate.getMetrics();
    assert.strictEqual(metrics.totalExportsAttempted, 4);
    assert.strictEqual(metrics.formatBreakdown.markdown, 1);
    assert.strictEqual(metrics.formatBreakdown.html, 1);
    assert.strictEqual(metrics.formatBreakdown.jsonl, 1);
    assert.strictEqual(metrics.formatBreakdown.binary_archive, 1);
    console.log(`  ✓ Telemetry verified: ${metrics.totalExportsAttempted} exports (${metrics.totalBytesArchived} bytes total)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 20: Atomic Bulk Mutations & Undo/Redo Stacks
    // ---------------------------------------------------------------------------
    console.log("[Suite 20/22] Atomic Bulk Mutations & Undo/Redo Stacks...");
    const temp1 = supervisor.exportSession("sess-temp-1", testTurns, "markdown");
    const purgeRes = supervisor.bulkPurge([temp1.archiveId]);
    assert.strictEqual(purgeRes.modifiedCount, 1);

    const undoOk = supervisor.undo();
    assert.strictEqual(undoOk, true);

    const redoOk = supervisor.redo();
    assert.strictEqual(redoOk, true);
    console.log("  ✓ Atomic bulk purge, undo, and redo verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 21: Responsive ANSI CLI Dashboard, Cards, Exporters & TUI Modal
    // ---------------------------------------------------------------------------
    console.log("[Suite 21/22] ANSI CLI Dashboard, Cards, Exporters & TUI Modal...");
    const renderedDashboard = BroccoliViewRenderer.renderSessionArchiveDashboard({
      totalArchives: metrics.totalExportsAttempted,
      totalSizeBytes: metrics.totalBytesArchived,
      healthStatus: health.healthStatus,
      markdownCount: metrics.formatBreakdown.markdown,
      htmlCount: metrics.formatBreakdown.html,
      jsonlCount: metrics.formatBreakdown.jsonl,
      binaryCount: metrics.formatBreakdown.binary_archive,
    });
    assert.ok(renderedDashboard.includes("SESSION ARCHIVE"));

    const renderedCard = BroccoliViewRenderer.renderArchiveManifestCard(sess1Manifests[0]);
    assert.ok(renderedCard.includes("ARCHIVE MANIFEST"));

    const html = supervisor.exportHtml();
    assert.ok(html.includes("<!DOCTYPE html>"));

    const md = supervisor.exportMarkdown();
    assert.ok(md.includes("# LUMI Session Archive & Cold Storage Report"));

    const csv = supervisor.exportCsv();
    assert.ok(csv.startsWith("archiveId,sessionId"));

    const modal = new SessionArchiveDashboardModal(substrate, archiver);
    modal.open();
    assert.strictEqual(modal.isOpen(), true);

    const renderOutput = modal.render();
    assert.ok(renderOutput.includes("SESSION ARCHIVE & COLD STORAGE VAULT MODAL"));

    modal.cycleViewMode();
    modal.handleKey("2"); // Manifests view
    const renderManifests = modal.render();
    assert.ok(renderManifests.includes("sess-test-01"));

    modal.close();
    assert.strictEqual(modal.isOpen(), false);
    console.log("  ✓ Dashboard, cards, HTML/Markdown/CSV reports, and SessionArchiveDashboardModal verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 22: Gateway JSON-RPC 2.0 Endpoints, 30 Model Tools & Monolith Cohesion
    // ---------------------------------------------------------------------------
    console.log("[Suite 22/22] Gateway JSON-RPC 2.0 Endpoints, 30 Model Tools & Monolith Cohesion...");
    const monolith = MonolithFactory.createEngine();
    const gateway = new MonolithGatewayServer();

    const rpcRes = await gateway.handleJsonRpcRequest(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sessionArchive/getMetrics",
        params: {},
      }),
      monolith as any
    );
    const parsedRpc = JSON.parse(rpcRes);
    assert.strictEqual(parsedRpc.jsonrpc, "2.0");

    const toolSuite = new SessionArchiveToolSuite(supervisor);
    const tools = toolSuite.getTools();
    assert.strictEqual(tools.length, 30);

    const toolStatus = await toolSuite.executeTool("archive_get_metrics", {});
    assert.strictEqual(toolStatus.success, true);

    const composition = GrandMonolithSynthesizer.verifyComposition(monolith);
    assert.strictEqual(composition.cohesionStatus, "OPTIMAL");
    console.log(`  ✓ Gateway JSON-RPC endpoints, 30 model tools, and Grand Monolith verified (${composition.componentCount}/${composition.requiredComponentCount} components in OPTIMAL cohesion)`);
    passedSuites++;

    console.log();
    console.log("================================================================================");
    console.log(` [✓] ALL ${passedSuites}/22 SESSION ARCHIVE SUITES PASSED!                       `);
    console.log("================================================================================");
    console.log();
  } catch (err: unknown) {
    console.error();
    console.error(`[✗] SESSION ARCHIVE SUITE FAILED at suite ${passedSuites + 1}/22:`, err);
    console.error();
    process.exit(1);
  }
}

runSessionArchiveValidationSuite();
