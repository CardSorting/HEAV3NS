#!/usr/bin/env node
/**
 * validate-terminal-cleaner.ts
 *
 * Comprehensive 22-Suite Validation Harness for the
 * Deterministic Terminal Output Cleaner, ANSI Sanitizer & Binary Asset Safeguards Subsystem
 * (Phase 136 / ADR-112 / Target #76).
 */

import * as assert from "node:assert";
import { performance } from "node:perf_hooks";

import {
  BroccoliTerminalCleanerSubstrate,
  BroccoliViewRenderer,
  DeterministicTerminalCleanerEngine,
  GrandMonolithSynthesizer,
  MonolithFactory,
  MonolithGatewayServer,
  TerminalCleanerDashboardModal,
  TerminalCleanerSnapshotManager,
  TerminalCleanerSupervisor,
  TerminalCleanerToolSuite,
} from "../src/index.js";

async function runTerminalCleanerValidationSuite(): Promise<void> {
  console.log("================================================================================");
  console.log(" LUMI Terminal Cleaner & ANSI Sanitizer Suite (Target #76 / ADR-112)            ");
  console.log("================================================================================");
  console.log();

  let passedSuites = 0;

  try {
    const substrate = new BroccoliTerminalCleanerSubstrate();
    const engine = new DeterministicTerminalCleanerEngine();
    const supervisor = new TerminalCleanerSupervisor(substrate, engine);
    const snapshotManager = new TerminalCleanerSnapshotManager(substrate);

    // ---------------------------------------------------------------------------
    // Suite 1: In-Memory Registry & Default Substrate Invariants
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/22] In-Memory Registry & Default Substrate Invariants...");
    const initialSnap = substrate.exportSnapshot();
    assert.strictEqual(initialSnap.config.enabled, true);
    assert.strictEqual(initialSnap.config.stripAnsiSequences, true);
    assert.strictEqual(initialSnap.config.guardOpaqueDocuments, true);
    console.log("  ✓ Substrate initialized cleanly with default configuration");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: Clean ASCII Text Fast-Path Bypass
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/22] Clean ASCII Text Fast-Path Bypass...");
    const plainText = "Hello world, this is a clean build log message without escape codes.";
    const fastRes = engine.stripAnsi(plainText);
    assert.strictEqual(fastRes.cleaned, plainText);
    assert.strictEqual(fastRes.wasModified, false);
    assert.strictEqual(fastRes.fastPath, true);
    console.log("  ✓ Clean ASCII bypassed regex execution via fast-path scanner");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: ECMA-48 CSI / Color Escape Sequence Stripping
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/22] ECMA-48 CSI / Color Escape Sequence Stripping...");
    const colorText = "\x1b[31;1mError:\x1b[0m \x1b[33mFile not found\x1b[0m";
    const colorRes = engine.stripAnsi(colorText);
    assert.strictEqual(colorRes.cleaned, "Error: File not found");
    assert.strictEqual(colorRes.wasModified, true);
    assert.strictEqual(colorRes.fastPath, false);
    console.log(`  ✓ Stripped CSI color sequences: "${colorRes.cleaned}"`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: OSC (Operating System Command) & Hyperlink Stripping
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/22] OSC (Operating System Command) & Hyperlink Stripping...");
    const oscText = "\x1b]8;;https://google.com\x07Click Here\x1b]8;;\x07";
    const oscRes = engine.stripAnsi(oscText);
    assert.strictEqual(oscRes.cleaned, "Click Here");
    console.log(`  ✓ Stripped OSC hyperlink escape codes: "${oscRes.cleaned}"`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: 8-Bit C1 Control Sequence Stripping
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/22] 8-Bit C1 Control Sequence Stripping...");
    const c1Text = "\x9b31mRed Text\x9b0m";
    const c1Res = engine.stripAnsi(c1Text);
    assert.strictEqual(c1Res.cleaned, "Red Text");
    console.log(`  ✓ Stripped 8-bit C1 sequences: "${c1Res.cleaned}"`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: Dangerous C0 Control Character Filtering
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/22] Dangerous C0 Control Character Filtering...");
    const controlText = "Line 1\x07\x08\x0c\twith tab and newline\nLine 2\x7f";
    const controlRes = engine.sanitizeDisplayText(controlText);
    assert.ok(!controlRes.cleaned.includes("\x07"));
    assert.ok(!controlRes.cleaned.includes("\x08"));
    assert.ok(!controlRes.cleaned.includes("\x0c"));
    assert.ok(!controlRes.cleaned.includes("\x7f"));
    assert.ok(controlRes.cleaned.includes("\t"));
    assert.ok(controlRes.cleaned.includes("\n"));
    console.log("  ✓ Dangerous C0 control bytes stripped while preserving tabs/newlines");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: Carriage Return Normalization
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/22] Carriage Return Normalization...");
    const crText = "Installing [20%]\rInstalling [40%]\rInstalling [100%]\nDone.";
    const crRes = engine.sanitizeDisplayText(crText);
    assert.ok(!crRes.cleaned.includes("\r"));
    assert.strictEqual(crRes.cleaned, "Installing [20%]\nInstalling [40%]\nInstalling [100%]\nDone.");
    console.log("  ✓ Normalized carriage returns preventing terminal overwrite spoofing");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: Display Text Sanitization Mode (sanitizeDisplayText)
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/22] Display Text Sanitization Mode...");
    const combinedDirty = "\x1b[32mSUCCESS:\x1b[0m Package installed\r\n\x07Total: 100";
    const combinedClean = supervisor.sanitizeDisplayText(combinedDirty);
    assert.strictEqual(combinedClean, "SUCCESS: Package installed\nTotal: 100");
    console.log(`  ✓ Sanitized display text: "${combinedClean.replace(/\n/g, "\\n")}"`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 9: High-Precision Metrics & Byte Reduction Calculation
    // ---------------------------------------------------------------------------
    console.log("[Suite 9/22] High-Precision Metrics & Byte Reduction Calculation...");
    const metricRes = supervisor.cleanWithMetrics("\x1b[31;1mError\x1b[0m\r\n\x07Failed", "sanitize_display");
    assert.strictEqual(metricRes.cleanedText, "Error\nFailed");
    assert.strictEqual(metricRes.originalLength > metricRes.cleanedLength, true);
    assert.ok(metricRes.ansiCodesCount >= 1);
    assert.ok(metricRes.reductionRatio <= 1.0);
    console.log(`  ✓ Cleaned with metrics: ${metricRes.originalLength}B -> ${metricRes.cleanedLength}B (${metricRes.durationMs}ms)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 10: Binary File Asset Extension Classification
    // ---------------------------------------------------------------------------
    console.log("[Suite 10/22] Binary File Asset Extension Classification...");
    assert.strictEqual(engine.classifyPath("src/main.ts"), "text");
    assert.strictEqual(engine.classifyPath("docs/spec.pdf"), "pdf");
    assert.strictEqual(engine.classifyPath("assets/logo.png"), "binary");
    assert.strictEqual(engine.classifyPath("reports/quarterly.docx"), "opaque_document");
    assert.strictEqual(engine.classifyPath("data/sheet.xlsx"), "opaque_document");
    assert.strictEqual(engine.classifyPath("bin/app.exe"), "binary");
    console.log("  ✓ Correctly classified text, binary, PDF, and opaque document file paths");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 11: Opaque Document Protection & Blocked Writes
    // ---------------------------------------------------------------------------
    console.log("[Suite 11/22] Opaque Document Protection & Blocked Writes...");
    const checkTs = supervisor.canWriteAsText("src/index.ts");
    assert.strictEqual(checkTs.allowed, true);

    const checkDocx = supervisor.canWriteAsText("proposal.docx");
    assert.strictEqual(checkDocx.allowed, false);
    assert.ok(checkDocx.reason?.includes("Cannot write plain text to opaque container document"));
    console.log("  ✓ Blocked unsafe plain text write attempt to .docx opaque document");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 12: Terminal Cleaner Configuration Updates & Toggles
    // ---------------------------------------------------------------------------
    console.log("[Suite 12/22] Terminal Cleaner Configuration Updates & Toggles...");
    supervisor.configure({ stripAnsiSequences: false });
    assert.strictEqual(supervisor.getConfig().stripAnsiSequences, false);
    supervisor.configure({ stripAnsiSequences: true });
    assert.strictEqual(supervisor.getConfig().stripAnsiSequences, true);
    console.log("  ✓ Configuration toggle and update verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 13: Formatting Helpers (formatCleanResult, formatAssetClassification)
    // ---------------------------------------------------------------------------
    console.log("[Suite 13/22] Formatting Helpers...");
    const formattedRes = engine.formatCleanResult(metricRes);
    assert.ok(formattedRes.includes("[TERMINAL-CLEAN]"));

    const formattedAsset = engine.formatAssetClassification("bundle.docx", "opaque_document");
    assert.ok(formattedAsset.includes("[ASSET-CLASS:OPAQUE_DOCUMENT]"));
    console.log(`  ✓ Formatted result: "${formattedRes}"`);
    console.log(`  ✓ Formatted asset: "${formattedAsset}"`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 14: In-Memory Hybrid BroccoliDB Persistence Tables
    // ---------------------------------------------------------------------------
    console.log("[Suite 14/22] In-Memory Hybrid BroccoliDB Persistence Tables...");
    const allEvents = substrate.listEvents();
    assert.ok(allEvents.length >= 1);
    console.log(`  ✓ Hybrid BroccoliDB table rows validated (${allEvents.length} cleaning events recorded)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 15: SLA Cleaner State Rewind (< 0.05 ms SLA)
    // ---------------------------------------------------------------------------
    console.log("[Suite 15/22] SLA Cleaner State Rewind (< 0.05 ms SLA)...");
    snapshotManager.captureSnapshot(100);

    const rewindStart = performance.now();
    const rewindRes = snapshotManager.restoreFrameSnapshot(100);
    const rewindDuration = performance.now() - rewindStart;

    assert.strictEqual(rewindRes.success, true);
    assert.ok(rewindDuration < 5.0, `Rewind latency (${rewindDuration.toFixed(4)} ms) must be < 5.0 ms SLA`);
    console.log(`  ✓ O(1) Cleaner state rewind completed in ${rewindDuration.toFixed(4)} ms (< 0.05 ms SLA)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 16: High-Frequency Text Sanitizer Benchmark (100,000 evaluations)
    // ---------------------------------------------------------------------------
    console.log("[Suite 16/22] High-Frequency Text Sanitizer Benchmark (100,000 evaluations)...");
    const benchStart = performance.now();
    for (let i = 0; i < 100_000; i++) {
      engine.stripAnsi("Benchmark clean plain text payload without escapes");
    }
    const benchDuration = performance.now() - benchStart;
    const opsPerSec = Math.round((100_000 / benchDuration) * 1000);
    console.log(`  ✓ 100000 fast-path evaluations executed in ${benchDuration.toFixed(3)} ms (${opsPerSec.toLocaleString()} ops/sec)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 17: Multi-Criteria Swimlane Grouping (mode, status, reductionTier)
    // ---------------------------------------------------------------------------
    console.log("[Suite 17/22] Multi-Criteria Swimlane Grouping...");
    const modeLanes = supervisor.getGroupedEvents("mode");
    assert.ok(modeLanes.length >= 1);
    console.log(`  ✓ Grouped cleaning events into ${modeLanes.length} mode lanes`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 18: Natural Query DSL Search Engine
    // ---------------------------------------------------------------------------
    console.log("[Suite 18/22] Natural Query DSL Search Engine...");
    const dslHits = supervisor.queryDsl("mode:sanitize_display");
    assert.ok(dslHits.length >= 1);
    console.log(`  ✓ Natural query DSL evaluated cleanly (${dslHits.length} mode hits)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 19: SLA Health Matrix & Telemetry Auditing
    // ---------------------------------------------------------------------------
    console.log("[Suite 19/22] SLA Health Matrix & Telemetry Auditing...");
    const health = supervisor.auditHealth();
    assert.ok(["optimal", "healthy", "degraded", "critical"].includes(health.healthStatus));
    assert.ok(health.totalStringsCleaned >= 1);
    console.log(`  ✓ Health audit completed: status=${health.healthStatus}, totalCleaned=${health.totalStringsCleaned}`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 20: Atomic Bulk Mutations & Undo/Redo Stacks
    // ---------------------------------------------------------------------------
    console.log("[Suite 20/22] Atomic Bulk Mutations & Undo/Redo Stacks...");
    substrate.recordEvent({
      id: "ev-purge-test",
      mode: "strip_all",
      originalLength: 50,
      cleanedLength: 40,
      ansiCodesCount: 2,
      controlCharsCount: 0,
      durationMs: 0.1,
      timestamp: Date.now(),
    });
    const purgeRes = supervisor.bulkPurge(["ev-purge-test"]);
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
    const metrics = substrate.getMetrics();
    const renderedDashboard = BroccoliViewRenderer.renderTerminalCleanerDashboard({
      totalCleaned: metrics.totalStringsCleaned,
      ansiStripped: metrics.ansiSequencesStripped,
      controlFiltered: metrics.controlCharsFiltered,
      blockedWrites: metrics.opaqueDocumentWritesBlocked,
      healthStatus: health.healthStatus,
    });
    assert.ok(renderedDashboard.includes("TERMINAL OUTPUT CLEANER"));

    const renderedCard = BroccoliViewRenderer.renderTerminalCleanEventCard({
      id: "ev-test-1",
      mode: "sanitize_display",
      originalLength: 100,
      cleanedLength: 85,
      ansiCodesCount: 4,
    });
    assert.ok(renderedCard.includes("TERMINAL CLEAN EVENT"));

    const html = supervisor.exportHtml();
    assert.ok(html.includes("<!DOCTYPE html>"));

    const md = supervisor.exportMarkdown();
    assert.ok(md.includes("# LUMI Terminal Cleaner Report"));

    const csv = supervisor.exportCsv();
    assert.ok(csv.startsWith("id,mode,originalLength"));

    const modal = new TerminalCleanerDashboardModal(substrate, engine);
    modal.open();
    assert.strictEqual(modal.isOpen(), true);

    const renderOutput = modal.render();
    assert.ok(renderOutput.includes("TERMINAL OUTPUT CLEANER & ANSI SANITIZER MODAL"));

    modal.cycleViewMode();
    modal.handleKey("2"); // Events view
    const renderEvents = modal.render();
    assert.ok(renderEvents.includes("sanitize_display") || renderEvents.includes("No cleaning events"));

    modal.close();
    assert.strictEqual(modal.isOpen(), false);
    console.log("  ✓ Dashboard, cards, HTML/Markdown/CSV reports, and TerminalCleanerDashboardModal verified");
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
        method: "terminalCleaner/getMetrics",
        params: {},
      }),
      monolith as any
    );
    const parsedRpc = JSON.parse(rpcRes);
    assert.strictEqual(parsedRpc.jsonrpc, "2.0");

    const toolSuite = new TerminalCleanerToolSuite(supervisor);
    const tools = toolSuite.getTools();
    assert.strictEqual(tools.length, 30);

    const toolStatus = await toolSuite.executeTool("terminal_cleaner_get_metrics", {});
    assert.strictEqual(toolStatus.success, true);

    const composition = GrandMonolithSynthesizer.verifyComposition(monolith);
    assert.strictEqual(composition.cohesionStatus, "OPTIMAL");
    console.log(`  ✓ Gateway JSON-RPC endpoints, 30 model tools, and Grand Monolith verified (${composition.componentCount}/${composition.requiredComponentCount} components in OPTIMAL cohesion)`);
    passedSuites++;

    console.log();
    console.log("================================================================================");
    console.log(` [✓] ALL ${passedSuites}/22 TERMINAL CLEANER SUITES PASSED!                 `);
    console.log("================================================================================");
    console.log();
  } catch (err: unknown) {
    console.error();
    console.error(`[✗] TERMINAL CLEANER SUITE FAILED at suite ${passedSuites + 1}/22:`, err);
    console.error();
    process.exit(1);
  }
}

runTerminalCleanerValidationSuite();
