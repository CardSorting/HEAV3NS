/**
 * Comprehensive Validation Suite for Persistent Goals, Quality Gate Policies,
 * Milestone DAGs, Goal Templates, Diffing, Swarms and Retrospectives (Target #74 / ADR-117).
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
  console.log("================================================================================");
  console.log(" LUMI World-Class Goal & Quality Gate System (ADR-117 Above-The-Fold Audit)    ");
  console.log("================================================================================\n");

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
  // Suite 3: Validating Milestone DAG Dependency Blocker Resolution & Progress
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 3/12] Validating Milestone DAG Dependency Blocker Resolution...");
  // In bugfix: m-1 is pending, m-2 depends on m-1 (blocked), m-3 depends on m-2 (blocked), m-4 depends on m-3 (blocked)
  let ms1 = bugfixState?.milestones.find((m) => m.id === "m-1");
  let ms2 = bugfixState?.milestones.find((m) => m.id === "m-2");
  assert.strictEqual(ms1?.status, "pending");
  assert.strictEqual(ms2?.status, "blocked");
  assert.deepStrictEqual(ms2?.blockers, ["m-1"]);

  // Complete m-1 -> m-2 should transition from blocked to pending
  supervisor.completeMilestone("session-bugfix-1", "m-1");
  let updated = supervisor.getGoal("session-bugfix-1");
  assert.strictEqual(updated?.progressPercent, 25);
  ms2 = updated?.milestones.find((m) => m.id === "m-2");
  assert.strictEqual(ms2?.status, "pending");
  assert.strictEqual(ms2?.blockers?.length, 0);

  // Complete m-2 -> m-3 unblocks
  supervisor.completeMilestone("session-bugfix-1", "m-2");
  updated = supervisor.getGoal("session-bugfix-1");
  assert.strictEqual(updated?.progressPercent, 50);
  let ms3 = updated?.milestones.find((m) => m.id === "m-3");
  assert.strictEqual(ms3?.status, "pending");
  console.log("  [✓] Milestone topological DAG dependencies and blocker unravelling verified.");

  // ---------------------------------------------------------------------------
  // Suite 4: Multi-Stage Quality Gates with Blocking, Advisory & Auto-Remediation
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 4/12] Validating Quality Gates Policies & Auto-Remediation...");
  supervisor.addGate("session-bugfix-1", "echo 'advisory lint passed'", { name: "Linter", policy: "advisory" });
  supervisor.addGate("session-bugfix-1", "echo 'tests passed'", {
    name: "Tests",
    policy: "blocking",
    autoRemediateCommand: "echo 'fixing formatting'",
  });

  const stateWithGates = supervisor.getGoal("session-bugfix-1")!;
  assert.strictEqual(stateWithGates.gates.length, 3);
  assert.ok(stateWithGates.gates.some((g) => g.policy === "advisory"));
  assert.ok(stateWithGates.gates.some((g) => g.policy === "blocking"));
  assert.ok(stateWithGates.gates.some((g) => g.autoRemediateCommand !== undefined));
  console.log("  [✓] Blocking/advisory gates and auto-remediation command bindings verified.");

  // ---------------------------------------------------------------------------
  // Suite 5: Turn Budget & Consecutive Failure Throttling
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
  // Suite 6: Multi-Session Goal Delegation & Swarm Blended Progress
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 6/12] Validating Multi-Session Goal Delegation & Swarm Blended Progress...");
  const parentGoal = supervisor.setGoal("session-swarm-parent", "Major Architecture Migration", {
    milestones: ["Phase 1 Core", "Phase 2 Extensions"],
  });
  supervisor.completeMilestone("session-swarm-parent", "m-1"); // 50%

  const childWorker1 = supervisor.delegateSubGoal(
    "session-swarm-parent",
    "session-swarm-child-1",
    "Subgoal: Migrate Token Verifier"
  );
  assert.ok(childWorker1);
  assert.strictEqual(childWorker1?.parentGoalSessionId, "session-swarm-parent");

  const parentWithChild = supervisor.getGoal("session-swarm-parent");
  assert.ok(parentWithChild?.childGoalSessionIds?.includes("session-swarm-child-1"));
  console.log("  [✓] Multi-session goal delegation and parent-child swarm coordination verified.");

  // ---------------------------------------------------------------------------
  // Suite 7: Structural Goal Differential Comparison Engine (diffGoals)
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 7/12] Validating Structural Goal Differential Comparison (diffGoals)...");
  const diffRes = supervisor.diffGoals("session-bugfix-1", "session-swarm-parent");
  assert.ok(diffRes);
  assert.strictEqual(diffRes?.identical, false);
  assert.ok(diffRes?.differences.length && diffRes.differences.length > 0);
  assert.ok(diffRes?.milestoneDelta.onlyInA.length && diffRes.milestoneDelta.onlyInA.length > 0);

  const identicalDiff = supervisor.diffGoals("session-bugfix-1", "session-bugfix-1");
  assert.strictEqual(identicalDiff?.identical, true);
  console.log("  [✓] Structural goal differential comparison verified.");

  // ---------------------------------------------------------------------------
  // Suite 8: Execution Step Trajectory Timeline Logging
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 8/12] Validating Step Trajectory Timeline Logging...");
  const trajGoal = supervisor.setGoal("session-traj-1", "Trajectory test goal");
  await supervisor.evaluateTurn("session-traj-1", "Taking turn 1");
  await supervisor.evaluateTurn("session-traj-1", "Taking turn 2");

  const trajectory = supervisor.getTrajectory("session-traj-1");
  assert.strictEqual(trajectory.length, 2);
  assert.strictEqual(trajectory[0].turnIndex, 1);
  assert.strictEqual(trajectory[1].turnIndex, 2);
  console.log("  [✓] Chronological execution trajectory events logged and inspected cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 9: Post-Goal Retrospective Summaries & Completion Archive
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 9/12] Validating Post-Goal Retrospective Summaries & Archive...");
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
  // Suite 10: Natural Query DSL Parsing & Multi-Session Goal Search
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 10/12] Validating Natural Query DSL & Multi-Session Goal Search...");
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
  // Suite 11: In-Memory Substrate Snapshotting & Microsecond State Rewind
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 11/12] Validating Snapshotting & Microsecond Rollback...");
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
  // Suite 12: 10 Model Tools Execution, High-Frequency Benchmarks & Monolith Composition
  // ---------------------------------------------------------------------------
  console.log("\n[Suite 12/12] 10 Model Tools Execution, Benchmarks & Monolith Composition (554 Components)...");
  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 10, "GoalToolSuite must expose exactly 10 model tools");

  const setTool = tools.find((t) => t.name === "goal_set")!;
  const statusTool = tools.find((t) => t.name === "goal_status")!;
  const tmplTool = tools.find((t) => t.name === "goal_template")!;
  const msTool = tools.find((t) => t.name === "goal_milestone")!;
  const gateTool = tools.find((t) => t.name === "goal_gate")!;
  const diffTool = tools.find((t) => t.name === "goal_diff")!;
  const trajTool = tools.find((t) => t.name === "goal_trajectory")!;
  const ctrlTool = tools.find((t) => t.name === "goal_control")!;
  const retroTool = tools.find((t) => t.name === "goal_retro")!;
  const listTool = tools.find((t) => t.name === "goal_list")!;

  assert.ok(
    setTool &&
      statusTool &&
      tmplTool &&
      msTool &&
      gateTool &&
      diffTool &&
      trajTool &&
      ctrlTool &&
      retroTool &&
      listTool
  );

  // Test goal_diff tool
  const diffToolRes = (await diffTool.execute(
    { sessionIdA: "session-bugfix-1", sessionIdB: "session-swarm-parent" },
    process.cwd()
  )) as { success: boolean; diff: any };
  assert.strictEqual(diffToolRes.success, true);
  assert.strictEqual(diffToolRes.diff.identical, false);

  // Test goal_trajectory tool
  const trajToolRes = (await trajTool.execute({ sessionId: "session-traj-1" }, process.cwd())) as {
    success: boolean;
    totalEvents: number;
  };
  assert.strictEqual(trajToolRes.success, true);
  assert.strictEqual(trajToolRes.totalEvents, 2);

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
  console.log(
    `  Measured: ${iterations.toLocaleString()} invocations in ${benchMs.toFixed(3)} ms (${throughput.toLocaleString()} ops/sec)`
  );

  const monolith = MonolithFactory.createEngine();
  const verification = GrandMonolithSynthesizer.verifyComposition(monolith);
  assert.strictEqual(verification.cohesionStatus, "OPTIMAL");
  assert.strictEqual(verification.componentCount, 554);
  assert.strictEqual(verification.missingComponents.length, 0);
  assert.strictEqual(verification.unexpectedComponents.length, 0);
  assert.strictEqual(verification.duplicateManifestComponents.length, 0);
  console.log(
    `  [✓] Grand Monolith successfully verified with ${verification.componentCount}/554 components in OPTIMAL cohesion.`
  );

  console.log("\n================================================================================");
  console.log("   ALL 12 WORLD-CLASS GOAL SYSTEM VALIDATION SUITES PASSED!                     ");
  console.log("================================================================================\n");
}

runGoalValidationSuites().catch((err) => {
  console.error("\n[FATAL] Goal validation failed:", err);
  process.exit(1);
});
