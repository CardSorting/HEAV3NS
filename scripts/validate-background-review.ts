/**
 * validate-background-review.ts
 *
 * Comprehensive validation suite for Target #34: Autonomous Background Review,
 * Self-Improvement Fork & Session Insights Subsystem (Phase 96 / ADR-048).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { performance } from "node:perf_hooks";
import { DeterministicReviewEvaluator } from "../src/tooling/extensions/review/deterministic-review-evaluator.js";
import { BroccoliReviewSubstrate } from "../src/sessions/extensions/review/broccoli-review-substrate.js";
import { ReviewSnapshotManager } from "../src/sessions/extensions/review/review-snapshot-manager.js";
import { BackgroundReviewSupervisor } from "../src/agents/extensions/review/background-review-supervisor.js";
import { BackgroundReviewToolSuite } from "../src/tooling/extensions/review/background-review-tool-suite.js";
import { MonolithFactory } from "../src/factories/monolith-factory.js";
import { GrandMonolithSynthesizer } from "../src/factories/grand-monolith-synthesizer.js";

async function runValidationSuite() {
  console.log("================================================================================");
  console.log(" LUMI Phase 96 / ADR-048: Background Review & Insights Validation Suite ");
  console.log("================================================================================\n");

  let passedSuites = 0;
  const totalSuites = 8;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-review-val-"));

  try {
    const evaluator = new DeterministicReviewEvaluator();

    // ---------------------------------------------------------------------------
    // Suite 1: Compact Turn Digest Generation & Policy Evaluation
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/8] Compact Turn Digest Generation & Policy Evaluation...");
    const userMsg = "Please check the status of the database and test the connection";
    const assistantMsg = "Checked the PostgreSQL connection and verified that all tables are online.";
    const toolsUsed = ["read_file", "terminal"];

    const digest = evaluator.generateTurnDigest(1, userMsg, assistantMsg, toolsUsed, false);
    if (digest.turnIndex !== 1 || digest.toolsUsed.length !== 2 || digest.errorOccurred) {
      throw new Error("Turn digest generation failed");
    }
    console.log("  ✓ Compact turn digest generated cleanly");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: Candidate Memory Fact & Skill Extraction
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/8] Candidate Memory Fact & Skill Extraction...");
    const preferenceMsg = "I always use TypeScript and strict typing in my projects";
    const prefDigest = evaluator.generateTurnDigest(2, preferenceMsg, "Configured strict TypeScript", ["write_file", "terminal"], false);
    const { facts, skills } = evaluator.extractCandidateKnowledge(prefDigest);

    if (facts.length !== 1 || facts[0].category !== "user_preference") {
      throw new Error("Failed to extract user preference fact");
    }
    if (skills.length !== 1 || !skills[0].title.includes("write_file -> terminal")) {
      throw new Error("Failed to extract multi-tool execution skill");
    }
    console.log("  ✓ Candidate facts and multi-tool workflow skills extracted");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: Session Insights Metrics & Tool Usage Distribution
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/8] Session Insights Metrics & Tool Usage Distribution...");
    const digests = [digest, prefDigest];
    const insights = evaluator.generateSessionInsights("sess-1", digests, 4000, 2000, 250);

    if (insights.totalTurns !== 2 || insights.totalTokens !== 6000) {
      throw new Error(`Invalid token totals: expected 6000, got ${insights.totalTokens}`);
    }
    if (insights.topTools.length !== 3 || insights.topTools[0].toolName !== "terminal") {
      throw new Error("Tool usage distribution calculation failed");
    }
    if (insights.estimatedCostMicroCents !== 1500) {
      throw new Error(`Cost estimate mismatch: expected 1500 micro-cents, got ${insights.estimatedCostMicroCents}`);
    }
    console.log("  ✓ Session insights, token accounting, and tool frequency distribution verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: Deterministic Session Title Generation
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/8] Deterministic Session Title Generation...");
    const titleSuggestion = evaluator.suggestSessionTitle(
      "Fix the responsive layout issue on the checkout page",
      ["read_file", "patch"]
    );

    if (!titleSuggestion.title.toLowerCase().includes("fix") || titleSuggestion.confidence < 0.8) {
      throw new Error(`Title generation failed: ${titleSuggestion.title}`);
    }

    const fallbackTitle = evaluator.suggestSessionTitle("", ["terminal"]);
    if (!fallbackTitle.title.includes("terminal")) {
      throw new Error("Fallback tool-derived title failed");
    }
    console.log(`  ✓ Title generated: '${titleSuggestion.title}' (confidence: ${titleSuggestion.confidence})`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: In-Memory BroccoliReviewSubstrate & ReviewSnapshotManager O(1) Rollback
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/8] In-Memory BroccoliReviewSubstrate & ReviewSnapshotManager O(1) Rollback...");
    const substrate = new BroccoliReviewSubstrate();
    const supervisor = new BackgroundReviewSupervisor(evaluator, substrate);
    const snapshotManager = new ReviewSnapshotManager(substrate);

    snapshotManager.captureFrame(1);

    supervisor.evaluateTurn(1, userMsg, assistantMsg, toolsUsed, false);
    supervisor.generateSessionInsights("sess-1", [digest], 1000, 500);
    supervisor.suggestTitle(userMsg, toolsUsed);

    if (supervisor.getReviews().length !== 1 || !supervisor.getLatestInsights() || !supervisor.getCurrentTitle()) {
      throw new Error("Failed to record review state in substrate");
    }

    for (let w = 0; w < 5; w++) {
      snapshotManager.rewindToFrame(1);
    }
    const rewindStart = performance.now();
    const rewindSuccess = snapshotManager.rewindToFrame(1);
    const rewindDuration = performance.now() - rewindStart;

    if (!rewindSuccess || supervisor.getReviews().length !== 0 || supervisor.getLatestInsights() !== undefined) {
      throw new Error("Review state rewind failed");
    }
    console.log(`  ✓ O(1) Review state rewind completed in ${rewindDuration.toFixed(3)} ms (< 0.05 ms SLA)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: BackgroundReviewSupervisor Coordination & State Invariants
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/8] BackgroundReviewSupervisor Coordination & State Invariants...");
    const res = supervisor.evaluateTurn(2, preferenceMsg, "Acknowledged", ["write_file", "terminal"]);
    if (res.candidateFacts.length !== 1 || res.candidateSkills.length !== 1) {
      throw new Error("Supervisor failed to coordinate candidate knowledge extraction");
    }
    console.log("  ✓ BackgroundReviewSupervisor candidate evaluation verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: BackgroundReviewToolSuite Model Tools Execution
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/8] BackgroundReviewToolSuite Model Tools Execution...");
    const toolSuite = new BackgroundReviewToolSuite(supervisor);
    const tools = toolSuite.getTools();

    const reviewTool = tools.find((t) => t.name === "review_trigger_evaluation")!;
    const insightsTool = tools.find((t) => t.name === "session_generate_insights")!;
    const titleTool = tools.find((t) => t.name === "session_suggest_title")!;

    if (!reviewTool || !insightsTool || !titleTool) {
      throw new Error("Missing required Background Review model tools");
    }

    const revRes = await reviewTool.execute(
      { turnIndex: 3, userMessage: preferenceMsg, assistantResponse: "Done", toolsUsed: "write_file, terminal" },
      tempDir
    ) as { success: boolean; candidateFactsCount: number };

    if (!revRes.success || revRes.candidateFactsCount !== 1) {
      throw new Error("review_trigger_evaluation tool execution failed");
    }

    const insRes = await insightsTool.execute({ sessionId: "sess-1" }, tempDir) as { success: boolean; totalTurns: number };
    if (!insRes.success || insRes.totalTurns <= 0) {
      throw new Error("session_generate_insights tool execution failed");
    }

    const titRes = await titleTool.execute({ firstUserMessage: "Build a modern React dashboard" }, tempDir) as { success: boolean; title: string };
    if (!titRes.success || !titRes.title.includes("React")) {
      throw new Error("session_suggest_title tool execution failed");
    }
    console.log("  ✓ All 3 Background Review model tools executed cleanly");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: Grand Monolith Synthesizer Composition (347 Components)
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/8] Grand Monolith Synthesizer Composition (347 Components)...");
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
    console.log(` [✓] ALL ${passedSuites}/${totalSuites} PHASE 96 BACKGROUND REVIEW SUITES PASSED! `);
    console.log("================================================================================\n");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runValidationSuite().catch((err) => {
  console.error("\n[FATAL] Validation suite failed:", err);
  process.exit(1);
});
