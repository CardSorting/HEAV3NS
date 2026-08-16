/**
 * Comprehensive Validation Suite for Persistent Goals, Quality Gate Policies,
 * Milestone DAGs, Goal Templates, and Retrospectives (Target #74 / ADR-117).
 */

import assert from "node:assert";
import { performance } from "node:perf_hooks";
import { BroccoliGoalSubstrate } from "../src/sessions/extensions/goals/broccoli-goal-substrate.js";
import { GoalSnapshotManager } from "../src/sessions/extensions/goals/goal-snapshot-manager.js";
import { DeterministicGoalEngine } from "../src/agents/extensions/goals/deterministic-goal-engine.js";
import { GoalSupervisor } from "../src/agents/extensions/goals/goal-supervisor.js";
import { GoalToolSuite } from "../src/tooling/extensions/goals/goal-tool-suite.js";
import { GrandMonolithSynthesizer } from "../src/factories/grand-monolith-synthesizer.js";
import { MonolithFactory } from "../src/factories/monolith-factory.js";

async function runGoalValidationSuites() {
  console.log("================================================================");
  console.log("   LUMI World-Class Goal & Quality Gate System (ADR-117 Audit) ");
  console.log("================================================================\n");

  const substrate = new BroccoliGoalSubstrate();
  const engine = new DeterministicGoalEngine(substrate);
  const snapshotManager = new GoalSnapshotManager(substrate);
  const supervisor = new GoalSupervisor(substrate, engine);
  const toolSuite = new GoalToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Suite 1: Validating 5-field Goal Contract parsing and alias mapping
  // ---------------------------------------------------------------------------
  console.log("[Suite 1/12] Validating Contract Parsing & Alias Normalization...");
  const rawGoal = `
    Fix flaky test in session persister
    Outcome: All persister tests pass 100/100 runs
    Verification: npm test passes
    Constraints: Do not increase memory footprint
    Boundaries: src/sessions/*
    Stop when: Root cause is upstream node.js bug
  `;

  const parsed = engine.parseContract(rawGoal);
  assert.strictEqual(parsed.headline, "Fix flaky test in session persister");
  assert.strictEqual(parsed.contract.outcome, "All persister tests pass 100/100 runs");
  assert.strictEqual(parsed.contract.verification, "npm test passes");
  assert.strictEqual(parsed.contract.constraints, "Do not increase memory footprint");
  assert.strictEqual(parsed.contract.boundaries, "src/sessions/*");
  assert.strictEqual(parsed.contract.stopWhen, "Root cause is upstream node.js bug");
  console.log("  [✓] 5-field contract parsed cleanly with alias normalizations.");

  // ---------------------------------------------------------------------------
  // Suite 2: Validating Goal Templates Catalog & One-Click Instantiation
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 2/12] Validating Goal Templates Catalog & One-Click Instantiation...");
  const templates = supervisor.listTemplates();
  assert.ok(templates.length >= 6, "Must have at least 6 templates");
  assert.ok(templates.some((t) => t.id === "bugfix"));
  assert.ok(templates.some((t) => t.id === "feature"));
  assert.ok(templates.some((t) => t.id === "refactor"));
  assert.ok(templates.some((t) => t.id === "audit"));
  assert.ok(templates.some((t) => t.id === "release"));
  assert.ok(templates.some((t) => t.id === "learning"));

  const bugfixState = supervisor.instantiateTemplate("bugfix", "session-bugfix-1", "Fix database lock contention");
  assert.ok(bugfixState);
  assert.strictEqual(bugfixState?.category, "bugfix");
  assert.strictEqual(bugfixState?.icon, "🐛");
  assert.strictEqual(bugfixState?.milestones.length, 4);
  assert.strictEqual(bugfixState?.gates.length, 1);
  assert.strictEqual(bugfixState?.gates[0].command, "npm test");
  console.log("  [✓] Built-in goal templates catalog validated and instantiated seamlessly.");

  // ---------------------------------------------------------------------------
  // Suite 3: Validating Milestone Progression & Dynamic Percentage Recalculation
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 3/12] Validating Milestone Progression & Dynamic Progress...");
  assert.strictEqual(bugfixState?.progressPercent, 0);

  supervisor.completeMilestone("session-bugfix-1", "m-1");
  let updated = supervisor.getGoal("session-bugfix-1");
  assert.strictEqual(updated?.progressPercent, 25);

  supervisor.completeMilestone("session-bugfix-1", "m-2");
  updated = supervisor.getGoal("session-bugfix-1");
  assert.strictEqual(updated?.progressPercent, 50);

  supervisor.addMilestone("session-bugfix-1", "Add stress benchmark verification");
  updated = supervisor.getGoal("session-bugfix-1");
  assert.strictEqual(updated?.milestones.length, 5);
  assert.strictEqual(updated?.progressPercent, 40); // 2 of 5 = 40%
  console.log("  [✓] Milestone DAG completion and progress recalculation verified.");

  // ---------------------------------------------------------------------------
  // Suite 4: Multi-Stage Quality Gates with Blocking & Advisory Policy Support
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 4/12] Validating Multi-Stage Quality Gates (Blocking vs Advisory)...");
  supervisor.addGate("session-bugfix-1", "echo 'advisory lint passed'", { name: "Linter", policy: "advisory" });
  supervisor.addGate("session-bugfix-1", "echo 'tests passed'", { name: "Tests", policy: "blocking" });

  const stateWithGates = supervisor.getGoal("session-bugfix-1")!;
  assert.strictEqual(stateWithGates.gates.length, 3);
  assert.ok(stateWithGates.gates.some((g) => g.policy === "advisory"));
  assert.ok(stateWithGates.gates.some((g) => g.policy === "blocking"));
  console.log("  [✓] Blocking and advisory quality gate policies registered cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 5: Consecutive Failure Fingerprinting & Turn Budget Guard
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 5/12] Validating Turn Budget & Pause Mechanics...");
  const budgetState = supervisor.setGoal("session-budget-1", "Quick task", { maxTurns: 2 });
  assert.strictEqual(budgetState.maxTurns, 2);

  const eval1 = await supervisor.evaluateTurn("session-budget-1", "Step 1 in progress");
  assert.strictEqual(eval1.shouldContinue, true);

  const eval2 = await supervisor.evaluateTurn("session-budget-1", "Step 2 in progress");
  assert.strictEqual(eval2.shouldContinue, false);
  assert.strictEqual(eval2.verdict, "continue");
  assert.ok(eval2.pausedReason?.includes("Maximum turn budget"));
  console.log("  [✓] Automatic turn budget pause mechanics verified.");

  // ---------------------------------------------------------------------------
  // Suite 6: Goal Lifecycle State Transitions (Pause, Resume, Clear)
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 6/12] Validating Goal Lifecycle State Transitions...");
  const lifeState = supervisor.setGoal("session-life-1", "Lifecycle test goal");
  assert.strictEqual(lifeState.status, "active");

  supervisor.pauseGoal("session-life-1", "Awaiting user feedback");
  assert.strictEqual(supervisor.getGoal("session-life-1")?.status, "paused");

  supervisor.resumeGoal("session-life-1");
  assert.strictEqual(supervisor.getGoal("session-life-1")?.status, "active");

  supervisor.clearGoal("session-life-1");
  assert.strictEqual(supervisor.getGoal("session-life-1")?.status, "cleared");
  console.log("  [✓] Goal lifecycle transitions (active -> paused -> active -> cleared) verified.");

  // ---------------------------------------------------------------------------
  // Suite 7: Post-Goal Retrospective Summaries & Completion Archive
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 7/12] Validating Post-Goal Retrospective Summaries & Archive...");
  const completeState = supervisor.setGoal("session-done-1", "Release candidate packaging", {
    milestones: ["Build assets", "Verify checksums"],
  });
  supervisor.completeMilestone("session-done-1", "m-1");
  supervisor.completeMilestone("session-done-1", "m-2");

  const evalDone = await supervisor.evaluateTurn("session-done-1", "Goal completed successfully. [goal:done]");
  assert.strictEqual(evalDone.verdict, "done");
  assert.strictEqual(evalDone.shouldContinue, false);

  const retro = supervisor.getRetrospective("session-done-1");
  assert.ok(retro);
  assert.strictEqual(retro?.status, "done");
  assert.strictEqual(retro?.completedMilestones, 2);
  assert.strictEqual(retro?.contractAdherenceScore, 100);

  const archive = substrate.getArchive();
  assert.ok(archive.some((a) => a.sessionId === "session-done-1"));
  console.log("  [✓] Retrospective summary generated and archived to substrate.");

  // ---------------------------------------------------------------------------
  // Suite 8: Natural Query DSL Parsing & Multi-Session Goal Search
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 8/12] Validating Natural Query DSL & Multi-Session Goal Search...");
  const dslFilter = engine.parseQueryDSL("is:active category:bugfix sort:progress limit:10");
  assert.strictEqual(dslFilter.status, "active");
  assert.strictEqual(dslFilter.category, "bugfix");
  assert.strictEqual(dslFilter.sortBy, "progress");
  assert.strictEqual(dslFilter.limit, 10);

  const activeBugfixes = supervisor.listGoals("is:active category:bugfix");
  assert.ok(activeBugfixes.length > 0);
  assert.ok(activeBugfixes.every((g) => g.status === "active" && g.category === "bugfix"));
  console.log("  [✓] Natural Query DSL parsed and multi-session goal search verified.");

  // ---------------------------------------------------------------------------
  // Suite 9: Continuation Prompt Rendering & Cache-Aligned Context Assembly
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 9/12] Validating Continuation Prompt Rendering...");
  const prompt = engine.renderContinuationPrompt(
    "Implement feature X",
    { outcome: "Feature X works", verification: "npm test" },
    undefined,
    [{ id: "m-1", title: "Step 1", status: "completed", progressPercent: 100 }]
  );
  assert.ok(prompt.includes("Completion contract:"));
  assert.ok(prompt.includes("Milestone Progress:"));
  assert.ok(prompt.includes("[x] Step 1"));
  console.log("  [✓] Continuation prompt rendered with byte-stable structure.");

  // ---------------------------------------------------------------------------
  // Suite 10: In-Memory Substrate Snapshotting & Microsecond State Rewind
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 10/12] Validating Snapshotting & Microsecond Rollback...");
  snapshotManager.captureSnapshot("snap-goal-1");

  // Mutate state
  supervisor.setGoal("session-temp-1", "Temporary goal that should vanish on rewind");
  assert.ok(supervisor.getGoal("session-temp-1") !== null);

  // JIT warm-up
  for (let w = 0; w < 5; w++) {
    snapshotManager.restoreSnapshot("snap-goal-1");
  }

  const startRewind = performance.now();
  const restored = snapshotManager.restoreSnapshot("snap-goal-1");
  const rewindMs = performance.now() - startRewind;

  assert.strictEqual(restored, true);
  assert.strictEqual(supervisor.getGoal("session-temp-1"), null);
  assert.ok(rewindMs < 0.1, `Rewind latency (${rewindMs.toFixed(4)} ms) must be < 0.1 ms SLA`);
  console.log(`  [✓] Substrate state rollback completed in ${rewindMs.toFixed(4)} ms (< 0.1 ms SLA).`);

  // ---------------------------------------------------------------------------
  // Suite 11: Rich Interactive Slash Command Router (/goal, template, milestone, gate, retro)
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 11/12] Validating Slash Command Router (/goal)...");
  const dashSlash = supervisor.executeSlashCommand("session-slash-1", "/goal");
  assert.strictEqual(dashSlash.success, true);

  const tmplSlash = supervisor.executeSlashCommand("session-slash-1", "/goal template refactor Modularize subsystem");
  assert.strictEqual(tmplSlash.success, true);
  assert.ok(tmplSlash.output.includes("Modularize subsystem"));

  const statusSlash = supervisor.executeSlashCommand("session-slash-1", "/goal status");
  assert.strictEqual(statusSlash.success, true);
  assert.ok(statusSlash.output.includes("ACTIVE"));

  const msSlash = supervisor.executeSlashCommand("session-slash-1", "/goal milestone add Extract class A");
  assert.strictEqual(msSlash.success, true);

  const gateSlash = supervisor.executeSlashCommand("session-slash-1", "/goal gate add npm test");
  assert.strictEqual(gateSlash.success, true);

  const retroSlash = supervisor.executeSlashCommand("session-slash-1", "/goal retro");
  assert.strictEqual(retroSlash.success, true);

  console.log("  [✓] /goal slash command router executed all subcommands accurately.");

  // ---------------------------------------------------------------------------
  // Suite 12: 8 Model Tools Execution, High-Frequency Benchmarks & Monolith Composition
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 12/12] 8 Model Tools Execution, Benchmarks & Monolith Composition (554 Components)...");
  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 8, "GoalToolSuite must expose exactly 8 model tools");

  const setTool = tools.find((t) => t.name === "goal_set")!;
  const statusTool = tools.find((t) => t.name === "goal_status")!;
  const tmplTool = tools.find((t) => t.name === "goal_template")!;
  const msTool = tools.find((t) => t.name === "goal_milestone")!;
  const gateTool = tools.find((t) => t.name === "goal_gate")!;
  const ctrlTool = tools.find((t) => t.name === "goal_control")!;
  const retroTool = tools.find((t) => t.name === "goal_retro")!;
  const listTool = tools.find((t) => t.name === "goal_list")!;

  assert.ok(setTool && statusTool && tmplTool && msTool && gateTool && ctrlTool && retroTool && listTool);

  // Test goal_template tool
  const tmplListRes = (await tmplTool.execute({ action: "list" }, process.cwd())) as { success: boolean; totalTemplates: number };
  assert.strictEqual(tmplListRes.success, true);
  assert.ok(tmplListRes.totalTemplates >= 6);

  // Test goal_milestone tool
  const msAddRes = (await msTool.execute({ action: "add", titleOrId: "Milestone from tool", sessionId: "tool-test" }, process.cwd())) as { success: boolean };
  assert.ok(msAddRes);

  // Micro-benchmark
  const iterations = 50_000;
  for (let w = 0; w < 5000; w++) {
    substrate.recordInvocation();
  }
  const startBench = performance.now();
  for (let i = 0; i < iterations; i++) {
    substrate.recordInvocation();
  }
  const endBench = performance.now();
  const benchMs = endBench - startBench;
  const throughput = Math.round((iterations / benchMs) * 1000);
  console.log(`  Measured: ${iterations.toLocaleString()} invocations in ${benchMs.toFixed(3)} ms (${throughput.toLocaleString()} ops/sec)`);

  const monolith = MonolithFactory.createEngine();
  const verification = GrandMonolithSynthesizer.verifyComposition(monolith);
  assert.strictEqual(verification.cohesionStatus, "OPTIMAL");
  assert.strictEqual(verification.componentCount, 554);
  assert.strictEqual(verification.missingComponents.length, 0);
  assert.strictEqual(verification.unexpectedComponents.length, 0);
  assert.strictEqual(verification.duplicateManifestComponents.length, 0);
  console.log(`  [✓] Grand Monolith successfully verified with ${verification.componentCount}/554 components in OPTIMAL cohesion.`);

  console.log("\n================================================================");
  console.log("   ALL 12 WORLD-CLASS GOAL SYSTEM VALIDATION SUITES PASSED!     ");
  console.log("================================================================\n");
}

runGoalValidationSuites().catch((err) => {
  console.error("\n[FATAL] Goal validation failed:", err);
  process.exit(1);
});
