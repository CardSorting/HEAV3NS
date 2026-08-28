/**
 * validate-adversarial-scrutiny.ts
 *
 * Comprehensive Validation Suite for Adversarial Scrutiny, Factual Provenance Verification,
 * Cognitive Spend Decomposition, and Grand Monolith Composition (Pass 194 / ADR-132).
 */

import * as assert from "node:assert";
import { AdversarialScrutinySupervisor } from "../src/agents/extensions/adversarial/adversarial-scrutiny-supervisor.js";
import { AdversarialHumanizer } from "../src/agents/extensions/adversarial/adversarial-humanizer.js";
import { BroccoliAdversarialSubstrate } from "../src/sessions/extensions/adversarial/broccoli-adversarial-substrate.js";
import { AdversarialToolSuite } from "../src/tooling/extensions/adversarial/adversarial-tool-suite.js";
import { MonolithFactory } from "../src/factories/monolith-factory.js";
import { GrandMonolithSynthesizer, CURRENT_EVOLUTION_BASELINE } from "../src/factories/grand-monolith-synthesizer.js";
import { LumiMonolith } from "../src/index.js";

async function runValidationSuite(): Promise<void> {
  console.log("\x1b[1;35m╭─── [PASS 194] ADVERSARIAL SCRUTINY & PROVENANCE VALIDATION ────────────╮\x1b[0m");

  const substrate = new BroccoliAdversarialSubstrate();
  const supervisor = new AdversarialScrutinySupervisor(substrate);
  const humanizer = new AdversarialHumanizer();
  const toolSuite = new AdversarialToolSuite(supervisor, humanizer);

  // -------------------------------------------------------------
  // Test 1: Adversarial Plan Red-Teaming
  // -------------------------------------------------------------
  console.log("  [1/7] Testing Adversarial Plan Red-Teaming & Vulnerability Detection...");
  const vulnerablePlan = `
# Implementation Plan
We will completely effortlessly optimize the engine by 100x with magic caching.
Just modify the core files and ship it immediately.
`;

  const verdictRejection = supervisor.scrutinizePlan(vulnerablePlan);
  assert.strictEqual(
    verdictRejection.verdict,
    "REJECTED_FAIL_CLOSED",
    "Flawed plan lacking verification and using hyperbolic claims must be rejected fail-closed."
  );
  assert.ok(verdictRejection.criticalCount > 0, "Must have critical findings.");
  assert.ok(verdictRejection.score < 50, "Score must be penalized.");

  const robustPlan = `
# Hardened Implementation Plan
## Proposed Changes
Modify database indexing and add fail-closed rollback handlers.

## Verification Plan
### Automated Tests
Run \`npm test\` and \`npm run check\` to assert 0 errors and test suite passes.
Execute \`node --import tsx scripts/benchmark-cache.ts\` to verify empirical latency.

## Failure Recovery
If boundary assertions fail, trigger frame-perfect snapshot rollback to snapshot #12.
Handle invalid null input gracefully with timeout exception fallback.
`;

  const verdictApproval = supervisor.scrutinizePlan(robustPlan);
  assert.strictEqual(
    verdictApproval.verdict,
    "APPROVED",
    "Robust plan with concrete verification, rollback, and edge case handling must be approved."
  );
  assert.strictEqual(verdictApproval.criticalCount, 0, "Approved plan must have 0 critical findings.");
  assert.ok(verdictApproval.score >= 80, "Approved plan score must be >= 80.");
  console.log("    ✓ Plan red-teaming successfully discriminated vulnerable vs. robust plans.");

  // -------------------------------------------------------------
  // Test 2: Fail-Closed Factual Provenance Verification
  // -------------------------------------------------------------
  console.log("  [2/7] Testing Fail-Closed Factual Provenance Verification...");
  const evidenceSource = "Benchmark run on 2026-08-28 confirmed 85.93% prompt token spend reduction across 180 domains with 0 errors.";

  const groundedClaim = "85.93% prompt token spend reduction";
  const proof1 = supervisor.auditProvenance(groundedClaim, evidenceSource);
  assert.strictEqual(proof1.isGrounded, true, "Verifiable exact claim must be grounded.");
  assert.strictEqual(proof1.confidence, 1.0, "Exact substring match must have 1.0 confidence.");

  const ungroundedClaim = "achieved 99.99% speedup with 500 domains";
  const proof2 = supervisor.auditProvenance(ungroundedClaim, evidenceSource);
  assert.strictEqual(proof2.isGrounded, false, "Ungrounded numbers (99.99%, 500) must fail closed.");
  assert.ok(proof2.divergenceDetails?.includes("Ungrounded numerical values"), "Must detail missing numbers.");
  console.log("    ✓ Factual provenance asserted strict character and numerical grounding.");

  // -------------------------------------------------------------
  // Test 3: Cognitive Spend & Compressibility Decomposition
  // -------------------------------------------------------------
  console.log("  [3/7] Testing Cognitive Spend Decomposition & Fluff Analysis...");
  const bloatedText = `
Certainly! I would be happy to help you with that task as an AI assistant.
Please let me know if you need anything else!


>> Nested redundant quote block here
TBD placeholder data for testing.
`;

  const decomp = supervisor.decomposeCognitiveSpend(bloatedText);
  assert.ok(decomp.compressibleTokens > 0, "Must detect compressible fluff tokens.");
  assert.ok(decomp.compressiblePercentage > 30, "Compressible percentage should exceed 30%.");
  assert.ok(decomp.fluffCategories.length >= 2, "Must identify multiple fluff categories.");
  assert.ok(decomp.potentialLatencyReductionMs >= 0, "Must estimate latency savings.");
  console.log(`    ✓ Cognitive decomposition: ${decomp.compressiblePercentage}% compressible fluff identified.`);

  // -------------------------------------------------------------
  // Test 4: Anti-Premature Completion & Verification Receipt Auditor
  // -------------------------------------------------------------
  console.log("  [4/7] Testing Anti-Premature Completion & Evidence Receipts...");
  
  // Empty receipts
  const emptyVerdict = supervisor.verifyTaskCompletion("I have completed all features.", []);
  assert.strictEqual(emptyVerdict.verdict, "REJECTED_FAIL_CLOSED", "Empty receipts must be rejected.");

  // Failing receipts
  const failingReceipts = ["tsc --noEmit -> Error: TS2304 Cannot find name 'foo'", "npm test -> 3 failed, 12 passed"];
  const failVerdict = supervisor.verifyTaskCompletion("All done!", failingReceipts);
  assert.strictEqual(failVerdict.verdict, "REJECTED_FAIL_CLOSED", "Receipts with errors must be rejected.");

  // Live passing receipts
  const passingReceipts = [
    "tsc --noEmit -> Exit Code 0 (0 errors)",
    "ALL 139/139 VALIDATION SUITES PASSED in 54.58s",
  ];
  const passVerdict = supervisor.verifyTaskCompletion("Successfully verified with zero errors.", passingReceipts);
  assert.strictEqual(passVerdict.verdict, "APPROVED", "Verified passing receipts must be approved.");
  console.log("    ✓ Anti-premature completion gate correctly verified execution receipts.");

  // -------------------------------------------------------------
  // Test 5: Hybrid BroccoliDB Persistence & Latency SLA
  // -------------------------------------------------------------
  console.log("  [5/7] Testing BroccoliDB Substrate & Microsecond Invariants...");
  const metrics = substrate.getMetrics();
  assert.ok(metrics.totalAudits >= 4, "Substrate must record all audits.");
  assert.ok(metrics.rejectedAudits >= 2, "Substrate must record rejected audits.");
  assert.ok(metrics.passedAudits >= 2, "Substrate must record passed audits.");
  assert.ok(metrics.averageAuditLatencyMs < 10.0, "Audit latency SLA must remain <10 ms in Node.");

  const health = substrate.getHealth();
  assert.ok(["optimal", "healthy"].includes(health.healthStatus), "Substrate health should be optimal or healthy.");
  console.log(`    ✓ Substrate recorded ${metrics.totalAudits} audits with avg latency ${metrics.averageAuditLatencyMs} ms.`);

  // -------------------------------------------------------------
  // Test 6: Humanizer ASCII Shields & Diagnostics
  // -------------------------------------------------------------
  console.log("  [6/7] Testing Adversarial Humanizer Visual Shields...");
  const banner = humanizer.renderVerdictBanner(verdictRejection);
  assert.ok(banner.includes("LUMI ADVERSARIAL SCRUTINY SHIELD"), "Banner must include title.");
  assert.ok(banner.includes("REJECTED - FAIL-CLOSED"), "Banner must include rejection badge.");
  assert.ok(banner.includes("ADVERSARIAL RED-TEAM FINDINGS"), "Banner must include findings table.");

  const decompBanner = humanizer.renderCognitiveDecomposition(decomp);
  assert.ok(decompBanner.includes("COGNITIVE SPEND & TOKEN COMPRESSIBILITY"), "Must render cognitive chart.");
  console.log("    ✓ Humanizer formatted executive ASCII shields and diagnostics.");

  // -------------------------------------------------------------
  // Test 7: Monolith Factory & LumiMonolith Integration
  // -------------------------------------------------------------
  console.log("  [7/7] Testing Grand Monolith Factory & LumiMonolith Composition...");
  const engine = MonolithFactory.createEngine();
  assert.ok(engine.broccoliAdversarialSubstrate, "broccoliAdversarialSubstrate must be present in factory.");
  assert.ok(engine.adversarialScrutinySupervisor, "adversarialScrutinySupervisor must be present in factory.");
  assert.ok(engine.adversarialHumanizer, "adversarialHumanizer must be present in factory.");
  assert.ok(engine.adversarialToolSuite, "adversarialToolSuite must be present in factory.");

  const tools = engine.toolRegistry.listTools();
  const adversarialToolNames = ["adversarial_scrutinize_plan", "adversarial_audit_provenance", "adversarial_decompose_spend", "adversarial_verify_completion"];
  for (const name of adversarialToolNames) {
    assert.ok(tools.some((t) => t.name === name), `Tool '${name}' must be registered in tool registry.`);
  }

  const composition = GrandMonolithSynthesizer.verifyComposition(engine);
  assert.ok(composition.baseline.highestRecordedPass >= 194, "Baseline must reflect Pass 194 or above.");
  assert.strictEqual(composition.cohesionStatus, "OPTIMAL", "Grand monolith cohesion status must be OPTIMAL.");
  assert.strictEqual(composition.missingComponents.length, 0, "0 missing components required.");

  const lumi = new LumiMonolith();
  const liveVerdict = lumi.scrutinizePlan(robustPlan);
  assert.strictEqual(liveVerdict.verdict, "APPROVED", "LumiMonolith.scrutinizePlan() must work directly.");

  const liveProof = lumi.auditProvenance(groundedClaim, evidenceSource);
  assert.strictEqual(liveProof.isGrounded, true, "LumiMonolith.auditProvenance() must work directly.");

  console.log("    ✓ Grand Monolith Pass 194 composition confirmed OPTIMAL across all components.");

  console.log("\x1b[1;32m\n================================================================================");
  console.log("  [✓] ALL 7/7 ADVERSARIAL SCRUTINY VALIDATION GATES PASSED!");
  console.log("================================================================================\x1b[0m");
}

runValidationSuite().catch((err) => {
  console.error("\x1b[1;31mValidation Failed:\x1b[0m", err);
  process.exit(1);
});
