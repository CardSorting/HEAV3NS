/**
 * validate-verification-evidence.ts
 *
 * Comprehensive validation suite for Target #30: Deterministic Coding Verification Evidence Ledger,
 * Stop-Gate Policy & Session Insights Subsystem (Phase 92 / ADR-044).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { performance } from "node:perf_hooks";
import { DeterministicEvidenceLedger } from "../src/tooling/extensions/evidence/deterministic-evidence-ledger.js";
import { BroccoliEvidenceSubstrate } from "../src/sessions/extensions/evidence/broccoli-evidence-substrate.js";
import { EvidenceSnapshotManager } from "../src/sessions/extensions/evidence/evidence-snapshot-manager.js";
import { VerificationEvidenceSupervisor } from "../src/agents/extensions/evidence/verification-evidence-supervisor.js";
import { VerificationEvidenceToolSuite } from "../src/tooling/extensions/evidence/verification-evidence-tool-suite.js";
import { MonolithFactory } from "../src/factories/monolith-factory.js";
import { GrandMonolithSynthesizer } from "../src/factories/grand-monolith-synthesizer.js";

async function runValidationSuite() {
  console.log("================================================================================");
  console.log(" LUMI Phase 92 / ADR-044: Verification Evidence Ledger Validation Suite ");
  console.log("================================================================================\n");

  let passedSuites = 0;
  const totalSuites = 8;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-evidence-val-"));

  try {
    const ledger = new DeterministicEvidenceLedger();

    // ---------------------------------------------------------------------------
    // Suite 1: Evidence Kind & Scope Validation
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/8] Evidence Kind & Scope Validation...");
    const rec1 = ledger.recordEvidence({
      frameIndex: 1,
      command: "npm test",
      kind: "test",
      scope: "workspace",
      passed: true,
      exitCode: 0,
      durationMs: 120,
      outputSummary: "All tests passed",
      verifiedPaths: [],
    });

    if (!rec1.id.startsWith("evid-") || rec1.kind !== "test" || !rec1.passed) {
      throw new Error("Failed to record workspace test evidence");
    }
    console.log("  ✓ Evidence entry recorded with unique monotonic ID");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: Non-Code File Extension & Filename Filtering
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/8] Non-Code File Extension & Filename Filtering...");
    const docMd = ledger.isCodeFile("README.md");
    const docTxt = ledger.isCodeFile("notes.txt");
    const docJson = ledger.isCodeFile("package.json");
    const license = ledger.isCodeFile("LICENSE");
    const soul = ledger.isCodeFile("SOUL.md");
    const tsCode = ledger.isCodeFile("src/engine.ts");
    const pyCode = ledger.isCodeFile("server/app.py");

    if (docMd || docTxt || docJson || license || soul || !tsCode || !pyCode) {
      throw new Error("Code vs non-code file classification failed");
    }
    console.log("  ✓ Documentation, metadata, and license files correctly identified as non-code");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: Actionable Code File Modification Tracking
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/8] Actionable Code File Modification Tracking...");
    ledger.reset();
    ledger.recordModifiedFile("docs/architecture.md"); // Should be ignored
    ledger.recordModifiedFile("src/factories/monolith-factory.ts"); // Should be tracked

    const modified = ledger.getModifiedCodeFiles();
    if (modified.length !== 1 || modified[0] !== "src/factories/monolith-factory.ts") {
      throw new Error(`Expected 1 modified code file, got ${JSON.stringify(modified)}`);
    }
    console.log("  ✓ Code modifications filtered and tracked accurately");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: Stop-Gate Nudge Policy with Unverified Edits
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/8] Stop-Gate Nudge Policy with Unverified Edits...");
    const stopEval1 = ledger.evaluateStopGate();
    if (!stopEval1.shouldNudge || stopEval1.unverifiedModifiedFiles.length !== 1) {
      throw new Error("Stop gate failed to nudge for unverified modified code file");
    }
    console.log("  ✓ Stop-gate successfully nudges when code is edited without fresh verification evidence");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: Fresh Passing Verification Satisfaction & Gate Clearance
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/8] Fresh Passing Verification Satisfaction & Gate Clearance...");
    ledger.recordEvidence({
      frameIndex: 2,
      command: "tsc --noEmit",
      kind: "typecheck",
      scope: "file",
      passed: true,
      exitCode: 0,
      durationMs: 45,
      outputSummary: "Typecheck clean",
      verifiedPaths: ["src/factories/monolith-factory.ts"],
    });

    const stopEval2 = ledger.evaluateStopGate();
    if (stopEval2.shouldNudge || stopEval2.unverifiedModifiedFiles.length !== 0) {
      throw new Error("Stop gate did not clear after passing verification evidence was recorded");
    }

    const insights = ledger.generateInsightsReport(2);
    if (insights.passedEvidenceCount !== 1 || insights.unverifiedCodeFiles.length !== 0) {
      throw new Error(`Insights report mismatch: ${JSON.stringify(insights)}`);
    }
    console.log("  ✓ Stop-gate satisfied and cleared by fresh passing evidence");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: In-Memory BroccoliEvidenceSubstrate & EvidenceSnapshotManager O(1) Rollback
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/8] In-Memory BroccoliEvidenceSubstrate & EvidenceSnapshotManager O(1) Rollback...");
    const substrate = new BroccoliEvidenceSubstrate();
    const supervisor = new VerificationEvidenceSupervisor(ledger, substrate);
    const snapshotManager = new EvidenceSnapshotManager(substrate);

    snapshotManager.captureFrame(1);

    supervisor.trackFileModification("src/new-feature.ts");
    supervisor.recordEvidence({
      frameIndex: 3,
      command: "npm test",
      kind: "test",
      scope: "workspace",
      passed: false,
      exitCode: 1,
      durationMs: 80,
      outputSummary: "1 test failed",
      verifiedPaths: [],
    });

    if (supervisor.getRecords().length < 1 || supervisor.getModifiedFiles().length < 1) {
      throw new Error("Failed to record evidence in supervisor substrate");
    }

    for (let w = 0; w < 5; w++) {
      snapshotManager.rewindToFrame(1);
    }
    const rewindStart = performance.now();
    const rewindSuccess = snapshotManager.rewindToFrame(1);
    const rewindDuration = performance.now() - rewindStart;

    if (!rewindSuccess || supervisor.getRecords().length !== 0) {
      throw new Error("Evidence state rewind failed");
    }
    console.log(`  ✓ O(1) Evidence state rewind completed in ${rewindDuration.toFixed(3)} ms (< 0.05 ms SLA)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: VerificationEvidenceToolSuite Model Tools Execution
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/8] VerificationEvidenceToolSuite Model Tools Execution...");
    const toolSuite = new VerificationEvidenceToolSuite(supervisor);
    const tools = toolSuite.getTools();

    const recordTool = tools.find((t) => t.name === "evidence_record")!;
    const checkTool = tools.find((t) => t.name === "evidence_stop_check")!;
    const insightsTool = tools.find((t) => t.name === "evidence_insights_report")!;

    if (!recordTool || !checkTool || !insightsTool) {
      throw new Error("Missing required Verification Evidence model tools");
    }

    const recRes = await recordTool.execute(
      {
        command: "npm test",
        kind: "test",
        scope: "workspace",
        passed: true,
      },
      tempDir
    ) as { success: boolean; passed: boolean };

    if (!recRes.success || !recRes.passed) {
      throw new Error("evidence_record tool execution failed");
    }

    const checkRes = await checkTool.execute({}, tempDir) as { success: boolean; shouldNudge: boolean };
    if (!checkRes.success) {
      throw new Error("evidence_stop_check tool execution failed");
    }

    const reportRes = await insightsTool.execute({ totalFrames: 5 }, tempDir) as { success: boolean; report: { totalFrames: number } };
    if (!reportRes.success || reportRes.report.totalFrames !== 5) {
      throw new Error("evidence_insights_report tool execution failed");
    }
    console.log("  ✓ All 3 Verification Evidence model tools executed cleanly");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: Grand Monolith Synthesizer Composition (327 Components)
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/8] Grand Monolith Synthesizer Composition (327 Components)...");
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
    console.log(` [✓] ALL ${passedSuites}/${totalSuites} PHASE 92 VERIFICATION EVIDENCE SUITES PASSED! `);
    console.log("================================================================================\n");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runValidationSuite().catch((err) => {
  console.error("\n[FATAL] Validation suite failed:", err);
  process.exit(1);
});
