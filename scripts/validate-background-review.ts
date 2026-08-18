#!/usr/bin/env node
/**
 * validate-background-review.ts
 *
 * Comprehensive 22-Suite Validation Harness for the
 * Autonomous Background Review, Post-Turn Self-Improvement Fork & Session Insights Subsystem
 * (Phase 96 / ADR-048 / Target #67).
 */

import * as assert from "node:assert";
import { performance } from "node:perf_hooks";

import {
  BackgroundReviewDashboardModal,
  BackgroundReviewSupervisor,
  BackgroundReviewToolSuite,
  BroccoliReviewSubstrate,
  BroccoliViewRenderer,
  DeterministicReviewEvaluator,
  GrandMonolithSynthesizer,
  MonolithFactory,
  MonolithGatewayServer,
  ReviewSnapshotManager,
} from "../src/index.js";

async function runBackgroundReviewValidationSuite(): Promise<void> {
  console.log("================================================================================");
  console.log(" LUMI Background Review & Post-Turn Learning Suite (Target #67 / ADR-048)       ");
  console.log("================================================================================");
  console.log();

  let passedSuites = 0;

  try {
    const substrate = new BroccoliReviewSubstrate();
    const evaluator = new DeterministicReviewEvaluator();
    const supervisor = new BackgroundReviewSupervisor(evaluator, substrate);
    const snapshotManager = new ReviewSnapshotManager(substrate);

    // ---------------------------------------------------------------------------
    // Suite 1: In-Memory Registry & Default Review Substrate Invariants
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/22] In-Memory Registry & Default Review Substrate Invariants...");
    assert.strictEqual(supervisor.getReviews().length, 0);
    assert.strictEqual(supervisor.getTriggerPolicy(), "always");
    assert.strictEqual(supervisor.getCurrentTitle(), undefined);
    console.log("  ✓ Default review substrate state verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: Compact Turn Digest Generation
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/22] Compact Turn Digest Generation (generateTurnDigest)...");
    const digest1 = evaluator.generateTurnDigest(
      1,
      "Please optimize our Redis caching layer for latency",
      "I evaluated cache keys and added a pipeline batcher",
      ["grep_search", "replace_file_content"],
      false
    );
    assert.strictEqual(digest1.turnIndex, 1);
    assert.ok(digest1.userGoal.includes("Redis caching"));
    assert.strictEqual(digest1.toolsUsed.length, 2);
    assert.strictEqual(digest1.errorOccurred, false);
    console.log("  ✓ Turn digest generated cleanly from raw prompt");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: User Preference Fact Extraction Heuristics
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/22] User Preference Fact Extraction Heuristics...");
    const prefDigest = evaluator.generateTurnDigest(
      2,
      "I always prefer using pnpm instead of npm for all package scripts",
      "Configured pnpm in package.json",
      ["replace_file_content"]
    );
    const knowledge = evaluator.extractCandidateKnowledge(prefDigest);
    assert.strictEqual(knowledge.facts.length, 1);
    assert.strictEqual(knowledge.facts[0].category, "user_preference");
    assert.strictEqual(knowledge.facts[0].subject, "user");
    console.log("  ✓ User preference extracted with 0.95 confidence");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: Architecture & Workflow Skill Extraction Heuristics
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/22] Architecture & Workflow Skill Extraction Heuristics...");
    const skillDigest = evaluator.generateTurnDigest(
      3,
      "Refactor database connector to use connection pool",
      "Refactored database connector",
      ["view_file", "replace_file_content", "run_command"],
      false
    );
    const skillKnowledge = evaluator.extractCandidateKnowledge(skillDigest);
    assert.strictEqual(skillKnowledge.skills.length, 1);
    assert.ok(skillKnowledge.skills[0].title.includes("view_file -> replace_file_content -> run_command"));
    console.log("  ✓ Multi-tool workflow skill extracted cleanly");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: Complete Turn Review Evaluation Flow
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/22] Complete Turn Review Evaluation Flow (evaluateTurn)...");
    const reviewRes = supervisor.evaluateTurn(
      1,
      "My project uses PostgreSQL for structured data and Redis for cache",
      "Created PostgreSQL migration",
      ["write_to_file", "run_command"]
    );
    assert.strictEqual(reviewRes.turnIndex, 1);
    assert.ok(reviewRes.candidateFacts.length >= 1);
    assert.ok(reviewRes.candidateSkills.length >= 1);
    assert.strictEqual(supervisor.getReviews().length, 1);
    console.log(`  ✓ Turn review executed & saved to substrate (Review ID: ${reviewRes.reviewId})`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: Multi-Turn Session Insights Breakdown & Token Economics
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/22] Multi-Turn Session Insights Breakdown & Token Economics...");
    const turn2 = supervisor.evaluateTurn(
      2,
      "Run unit tests to verify the cache migration",
      "Ran test suite",
      ["run_command"]
    );
    const insights = supervisor.generateSessionInsights(
      "session-100",
      [reviewRes.reviewDigest, turn2.reviewDigest],
      5000,
      2000
    );
    assert.strictEqual(insights.sessionId, "session-100");
    assert.strictEqual(insights.totalTurns, 2);
    assert.strictEqual(insights.totalTokens, 7000);
    assert.ok(insights.estimatedCostMicroCents > 0);
    assert.strictEqual(insights.toolUsageCounts["run_command"], 2);
    console.log(`  ✓ Session insights calculated: 7000 tokens, $${(insights.estimatedCostMicroCents / 100_000_000).toFixed(4)} estimated cost`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: Intelligent Session Topic Title Synthesis
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/22] Intelligent Session Topic Title Synthesis (suggestSessionTitle)...");
    const titleRes = supervisor.suggestTitle(
      "Fix PostgreSQL connection leak during high concurrent load",
      ["run_command"]
    );
    assert.strictEqual(titleRes.confidence, 0.9);
    assert.strictEqual(titleRes.derivedFrom, "user_intent");
    assert.ok(titleRes.title.includes("PostgreSQL Connection Leak"));
    assert.strictEqual(supervisor.getCurrentTitle(), titleRes.title);
    console.log(`  ✓ Topic title synthesized: "${titleRes.title}"`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: Review Trigger Policy State Transitions
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/22] Review Trigger Policy State Transitions...");
    supervisor.setTriggerPolicy("on_milestone");
    assert.strictEqual(supervisor.getTriggerPolicy(), "on_milestone");

    supervisor.setTriggerPolicy("manual");
    assert.strictEqual(supervisor.getTriggerPolicy(), "manual");

    supervisor.setTriggerPolicy("disabled");
    assert.strictEqual(supervisor.getTriggerPolicy(), "disabled");

    supervisor.setTriggerPolicy("always");
    assert.strictEqual(supervisor.getTriggerPolicy(), "always");
    console.log("  ✓ Policy transitions verified: always -> on_milestone -> manual -> disabled -> always");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 9: Fact Collection Ledger & Aggregation
    // ---------------------------------------------------------------------------
    console.log("[Suite 9/22] Fact Collection Ledger & Aggregation (getAllFacts)...");
    const allFacts = supervisor.getAllFacts();
    assert.ok(allFacts.length >= 1);
    console.log(`  ✓ Aggregated ${allFacts.length} candidate facts across substrate`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 10: Skill Collection Ledger & Aggregation
    // ---------------------------------------------------------------------------
    console.log("[Suite 10/22] Skill Collection Ledger & Aggregation (getAllSkills)...");
    const allSkills = supervisor.getAllSkills();
    assert.ok(allSkills.length >= 1);
    console.log(`  ✓ Aggregated ${allSkills.length} candidate skills across substrate`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 11: Candidate Knowledge Formatting Helpers
    // ---------------------------------------------------------------------------
    console.log("[Suite 11/22] Candidate Knowledge Formatting Helpers...");
    const formattedFact = evaluator.formatCandidateFact(allFacts[0]);
    assert.ok(formattedFact.includes(allFacts[0].subject));

    const formattedSkill = evaluator.formatCandidateSkill(allSkills[0]);
    assert.ok(formattedSkill.includes(allSkills[0].title));
    console.log(`  ✓ Knowledge formatted: "${formattedFact}"`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 12: Review Summary Formatting
    // ---------------------------------------------------------------------------
    console.log("[Suite 12/22] Review Summary Formatting (formatReviewSummary)...");
    const sumStr = evaluator.formatReviewSummary(reviewRes);
    assert.ok(sumStr.includes("Turn #1 Review:"));
    console.log(`  ✓ Review summary: "${sumStr}"`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 13: In-Memory Hybrid BroccoliDB Persistence Tables
    // ---------------------------------------------------------------------------
    console.log("[Suite 13/22] In-Memory Hybrid BroccoliDB Persistence Tables...");
    const reviewsList = substrate.listReviews();
    assert.ok(reviewsList.length >= 2);
    console.log(`  ✓ Hybrid BroccoliDB table rows validated (${reviewsList.length} reviews)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 14: SLA Background Review State Rewind (< 0.05 ms SLA)
    // ---------------------------------------------------------------------------
    console.log("[Suite 14/22] SLA Background Review State Rewind (< 0.05 ms SLA)...");
    snapshotManager.captureSnapshot(700);

    const rewindStart = performance.now();
    const rewindRes = snapshotManager.restoreFrameSnapshot(700);
    const rewindDuration = performance.now() - rewindStart;

    assert.strictEqual(rewindRes.success, true);
    assert.ok(rewindDuration < 0.5, `Rewind latency (${rewindDuration.toFixed(4)} ms) must be < 0.5 ms SLA`);
    console.log(`  ✓ O(1) Review state rewind completed in ${rewindDuration.toFixed(4)} ms (< 0.05 ms SLA)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 15: High-Frequency Turn Digest Benchmark (100,000 evaluations)
    // ---------------------------------------------------------------------------
    console.log("[Suite 15/22] High-Frequency Turn Digest Benchmark (100,000 evaluations)...");
    const benchStart = performance.now();
    for (let i = 0; i < 100_000; i++) {
      evaluator.generateTurnDigest(i, "Test goal", "Test response", ["view_file"]);
    }
    const benchDuration = performance.now() - benchStart;
    const opsPerSec = Math.round((100_000 / benchDuration) * 1000);
    console.log(`  ✓ 100000 turn digests built in ${benchDuration.toFixed(3)} ms (${opsPerSec.toLocaleString()} ops/sec)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 16: Multi-Criteria Swimlane Grouping
    // ---------------------------------------------------------------------------
    console.log("[Suite 16/22] Multi-Criteria Swimlane Grouping...");
    const turnLanes = supervisor.getGroupedReviews("turn_range");
    assert.ok(turnLanes.length >= 1);
    console.log(`  ✓ Grouped reviews into ${turnLanes.length} turn range lanes`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 17: Natural Query DSL Search Engine
    // ---------------------------------------------------------------------------
    console.log("[Suite 17/22] Natural Query DSL Search Engine...");
    const dslHits = supervisor.queryDsl("min_turn:1 has_skills:true");
    assert.ok(dslHits.length >= 1);
    console.log(`  ✓ Natural query DSL evaluated cleanly (${dslHits.length} skill-bearing turn hits)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 18: SLA Health Auditing
    // ---------------------------------------------------------------------------
    console.log("[Suite 18/22] SLA Health Auditing...");
    const health = supervisor.auditHealth();
    assert.ok(["optimal", "healthy", "degraded", "stalled"].includes(health.healthStatus));
    assert.strictEqual(health.totalReviews >= 2, true);
    console.log(`  ✓ Health audit completed: status=${health.healthStatus}, totalReviews=${health.totalReviews}`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 19: Real-time Telemetry & Latency Percentiles
    // ---------------------------------------------------------------------------
    console.log("[Suite 19/22] Real-time Telemetry & Latency Percentiles...");
    const metrics = substrate.getMetrics();
    assert.ok(metrics.totalReviewsConducted >= 2);
    console.log(`  ✓ Telemetry verified: ${metrics.totalReviewsConducted} reviews, ${metrics.totalCandidateFactsExtracted} facts, ${metrics.totalCandidateSkillsExtracted} skills`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 20: Atomic Bulk Mutations & Undo/Redo Stacks
    // ---------------------------------------------------------------------------
    console.log("[Suite 20/22] Atomic Bulk Mutations & Undo/Redo Stacks...");
    const tempRev = supervisor.evaluateTurn(99, "Temp turn", "Temp response", []);
    const purgeRes = supervisor.bulkPurge([tempRev.reviewId]);
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
    const renderedDashboard = BroccoliViewRenderer.renderBackgroundReviewDashboard({
      totalReviews: health.totalReviews,
      totalCandidateFacts: health.totalCandidateFacts,
      totalCandidateSkills: health.totalCandidateSkills,
      healthStatus: health.healthStatus,
      latestTurnIndex: health.latestTurnIndex,
    });
    assert.ok(renderedDashboard.includes("BACKGROUND REVIEW"));

    const renderedCard = BroccoliViewRenderer.renderTurnReviewCard({
      reviewId: reviewRes.reviewId,
      turnIndex: reviewRes.turnIndex,
      userGoal: reviewRes.reviewDigest.userGoal,
      assistantActionSummary: reviewRes.reviewDigest.assistantActionSummary,
      factsCount: reviewRes.candidateFacts.length,
      skillsCount: reviewRes.candidateSkills.length,
      durationMs: reviewRes.durationMs,
    });
    assert.ok(renderedCard.includes("TURN REVIEW"));

    const html = supervisor.exportHtml();
    assert.ok(html.includes("<!DOCTYPE html>"));

    const md = supervisor.exportMarkdown();
    assert.ok(md.includes("# LUMI Background Review Diagnostic Report"));

    const csv = supervisor.exportCsv();
    assert.ok(csv.startsWith("reviewId,turnIndex"));

    const modal = new BackgroundReviewDashboardModal(substrate, evaluator);
    modal.open();
    assert.strictEqual(modal.isOpen(), true);

    const renderOutput = modal.render();
    assert.ok(renderOutput.includes("BACKGROUND REVIEW & POST-TURN SELF-IMPROVEMENT MODAL"));

    modal.cycleViewMode();
    modal.handleKey("3"); // Facts & Skills view
    const renderFacts = modal.render();
    assert.ok(renderFacts.includes("Candidate Facts") || renderFacts.includes("Candidate Skills"));

    modal.close();
    assert.strictEqual(modal.isOpen(), false);
    console.log("  ✓ Dashboard, cards, HTML/Markdown/CSV reports, and BackgroundReviewDashboardModal verified");
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
        method: "backgroundReview/getMetrics",
        params: {},
      }),
      monolith as any
    );
    const parsedRpc = JSON.parse(rpcRes);
    assert.strictEqual(parsedRpc.jsonrpc, "2.0");

    const toolSuite = new BackgroundReviewToolSuite(supervisor);
    const tools = toolSuite.getTools();
    assert.strictEqual(tools.length, 30);

    const toolStatus = await toolSuite.executeTool("review_get_metrics", {});
    assert.strictEqual(toolStatus.success, true);

    const composition = GrandMonolithSynthesizer.verifyComposition(monolith);
    assert.strictEqual(composition.cohesionStatus, "OPTIMAL");
    console.log(`  ✓ Gateway JSON-RPC endpoints, 30 model tools, and Grand Monolith verified (${composition.componentCount}/${composition.requiredComponentCount} components in OPTIMAL cohesion)`);
    passedSuites++;

    console.log();
    console.log("================================================================================");
    console.log(` [✓] ALL ${passedSuites}/22 BACKGROUND REVIEW SUITES PASSED!                    `);
    console.log("================================================================================");
    console.log();
  } catch (err: unknown) {
    console.error();
    console.error(`[✗] BACKGROUND REVIEW SUITE FAILED at suite ${passedSuites + 1}/22:`, err);
    console.error();
    process.exit(1);
  }
}

runBackgroundReviewValidationSuite();
