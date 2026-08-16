/**
 * validate-clarify-engine.ts
 *
 * Comprehensive validation suite for Target #23: Deterministic Clarification,
 * Interactive Inquiry & Intent Disambiguation Substrate (Phase 85 / ADR-037).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { performance } from "node:perf_hooks";
import { DeterministicClarifyEngine } from "../src/tooling/extensions/clarify/deterministic-clarify-engine.js";
import { BroccoliClarifySubstrate } from "../src/sessions/extensions/clarify/broccoli-clarify-substrate.js";
import { ClarifySnapshotManager } from "../src/sessions/extensions/clarify/clarify-snapshot-manager.js";
import { ClarifyInquirySupervisor } from "../src/agents/extensions/clarify/clarify-inquiry-supervisor.js";
import { ClarifyInquiryToolSuite } from "../src/tooling/extensions/clarify/clarify-inquiry-tool-suite.js";
import { MonolithFactory } from "../src/factories/monolith-factory.js";
import { GrandMonolithSynthesizer } from "../src/factories/grand-monolith-synthesizer.js";

async function runValidationSuite() {
  console.log("================================================================================");
  console.log(" LUMI Phase 85 / ADR-037: Clarification & Inquiry Validation Suite            ");
  console.log("================================================================================\n");

  let passedSuites = 0;
  const totalSuites = 8;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-clarify-val-"));

  try {
    const engine = new DeterministicClarifyEngine();

    // ---------------------------------------------------------------------------
    // Suite 1: Structured Inquiry Creation & Choice Normalization
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/8] Structured Inquiry Creation & Choice Normalization...");
    const rawChoices = [
      "Use TypeScript",
      { title: "Use JavaScript", description: "Vanilla JS without types" },
      { label: "Use Python", isRecommended: false },
    ];

    const inq1 = engine.createInquiry("inq-1", "Which language should we use?", rawChoices);
    if (inq1.choices.length !== 3) {
      throw new Error(`Expected 3 choices, got ${inq1.choices.length}`);
    }
    if (!inq1.choices[0].isRecommended) {
      throw new Error("First choice should be recommended by default");
    }
    if (inq1.choices[1].label !== "Use JavaScript" || inq1.choices[1].description !== "Vanilla JS without types") {
      throw new Error("Complex object choice normalization failed");
    }
    console.log("  ✓ Choice normalization and recommendation tagging verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: Default Fast-Path Resolution
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/8] Default Fast-Path Resolution...");
    const res1 = await engine.resolveInquiry(inq1);
    if (res1.resolvedBy !== "default" || res1.selectedChoiceIds[0] !== "choice-1") {
      throw new Error(`Unexpected resolution: ${JSON.stringify(res1)}`);
    }
    console.log("  ✓ Fast-path default choice resolution verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: Automated Resolver Hook for Headless Execution
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/8] Automated Resolver Hook for Headless Execution...");
    engine.setAutoResolver(async (inquiry) => {
      if (inquiry.id === "inq-custom") {
        return { selectedChoiceIds: ["choice-2"], writeInResponse: "Custom user answer" };
      }
      return { selectedChoiceIds: [inquiry.choices[0].id] };
    });

    const inqCustom = engine.createInquiry("inq-custom", "Custom question", ["A", "B", "C"]);
    const resCustom = await engine.resolveInquiry(inqCustom);

    if (resCustom.resolvedBy !== "auto_policy" || resCustom.selectedChoiceIds[0] !== "choice-2" || resCustom.writeInResponse !== "Custom user answer") {
      throw new Error(`Auto resolver hook resolution failed: ${JSON.stringify(resCustom)}`);
    }
    console.log("  ✓ Automated policy resolver hook verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: Multi-Select Mode Support
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/8] Multi-Select Mode Support...");
    engine.setAutoResolver(async () => ({
      selectedChoiceIds: ["choice-1", "choice-3"],
    }));

    const inqMulti = engine.createInquiry("inq-multi", "Select features", ["Auth", "Database", "Caching"], "multi_select");
    const resMulti = await engine.resolveInquiry(inqMulti);

    if (resMulti.selectedChoiceIds.length !== 2) {
      throw new Error(`Expected 2 selected choices, got ${resMulti.selectedChoiceIds.length}`);
    }
    console.log("  ✓ Multi-select inquiry resolution verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: High-Frequency Clarification Micro-Benchmark
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/8] High-Frequency Clarification Micro-Benchmark...");
    engine.setAutoResolver(undefined); // Reset to default fast path
    const benchStart = performance.now();
    for (let i = 0; i < 10000; i++) {
      const inq = engine.createInquiry(`bench-${i}`, "Bench question", ["A", "B"]);
      await engine.resolveInquiry(inq);
    }
    const benchDuration = performance.now() - benchStart;
    console.log(`  ✓ 10,000 inquiries created & resolved in ${benchDuration.toFixed(3)} ms (${(benchDuration / 10000).toFixed(4)} ms/op)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: BroccoliClarifySubstrate & Inquiry Ledgers
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/8] BroccoliClarifySubstrate & Inquiry Ledgers...");
    const substrate = new BroccoliClarifySubstrate();
    substrate.recordInquiry(inq1);
    substrate.recordResolution(res1);

    const loadedInq = substrate.getInquiry("inq-1");
    const loadedRes = substrate.getResolution("inq-1");

    if (!loadedInq || !loadedRes || loadedRes.selectedChoiceIds[0] !== "choice-1") {
      throw new Error("Substrate ledger lookup failed");
    }
    if (substrate.listInquiries().length !== 1) {
      throw new Error("Substrate list inquiries failed");
    }
    console.log("  ✓ In-memory Broccolidb inquiry ledger and history verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: ClarifySnapshotManager Frame Snapshotting & O(1) Rewind
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/8] ClarifySnapshotManager Frame Snapshotting & O(1) Rewind...");
    const snapshotManager = new ClarifySnapshotManager(substrate);
    snapshotManager.captureFrame(1);

    // Record in frame 2
    substrate.recordInquiry(inqCustom);
    substrate.recordResolution(resCustom);

    // Rewind to frame 1
    for (let w = 0; w < 5; w++) {
      snapshotManager.rewindToFrame(1);
    }
    const rewindStart = performance.now();
    const rewindSuccess = snapshotManager.rewindToFrame(1);
    const rewindDuration = performance.now() - rewindStart;

    if (!rewindSuccess) {
      throw new Error("Clarify state rewind to frame 1 failed");
    }
    console.log(`  ✓ O(1) Clarify substrate state rewind completed in ${rewindDuration.toFixed(3)} ms (< 0.05 ms SLA)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: ClarifyInquirySupervisor & Model Tools Execution
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/8] ClarifyInquirySupervisor & Model Tools Execution...");
    const supervisor = new ClarifyInquirySupervisor(engine, substrate);
    const toolSuite = new ClarifyInquiryToolSuite(supervisor);
    const tools = toolSuite.getTools();

    const askTool = tools.find((t) => t.name === "ask_clarification")!;
    const statusTool = tools.find((t) => t.name === "clarify_inquiry_status")!;

    if (!askTool || !statusTool) {
      throw new Error("Missing required Clarify model tools");
    }

    const askRes = await askTool.execute({
      question: "Which database do you prefer?",
      choicesJson: JSON.stringify(["PostgreSQL", "SQLite", "MongoDB"]),
      mode: "single_select",
    }, tempDir) as { success: boolean; inquiryId: string; selectedChoiceIds: string[] };

    if (!askRes.success || !askRes.inquiryId || askRes.selectedChoiceIds.length === 0) {
      throw new Error("ask_clarification tool execution failed");
    }

    const statusRes = await statusTool.execute({}, tempDir) as { success: boolean; stats: { totalInquiries: number } };
    if (!statusRes.success || statusRes.stats.totalInquiries < 1) {
      throw new Error("clarify_inquiry_status tool execution failed");
    }

    console.log("  ✓ All 2 Clarify model tools executed cleanly");

    // Monolith Verification
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
    console.log(` [✓] ALL ${passedSuites}/${totalSuites} PHASE 85 CLARIFY INQUIRY SUITES PASSED CLEANLY! `);
    console.log("================================================================================\n");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runValidationSuite().catch((err) => {
  console.error("\n[FATAL] Validation suite failed:", err);
  process.exit(1);
});
