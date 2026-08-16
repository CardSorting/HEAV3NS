/**
 * Comprehensive Validation Suite for Persistent Session Goals, Quality Gates & Deterministic Goal Loop
 * Target #74 / ADR-117
 */

import assert from "node:assert";
import { performance } from "node:perf_hooks";
import {
  BroccoliGoalSubstrate,
  DeterministicGoalEngine,
  GoalSnapshotManager,
  GoalSupervisor,
  GoalToolSuite,
  GrandMonolithSynthesizer,
  LumiMonolith,
} from "../src/index.js";

async function runGoalValidationSuites(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Persistent Session Goals & Deterministic Goal Loop      ");
  console.log("   (Target #74 / ADR-117 Validation & Verification Suite)      ");
  console.log("================================================================\n");

  const substrate = new BroccoliGoalSubstrate();
  const engine = new DeterministicGoalEngine(substrate);
  const snapshotManager = new GoalSnapshotManager(substrate);
  const supervisor = new GoalSupervisor(substrate, engine);
  const toolSuite = new GoalToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Suite 1: Structured 5-Field Contract Parser & Alias Normalization
  // ---------------------------------------------------------------------------
  console.log("[Suite 1/8] Structured 5-Field Contract Parser & Alias Normalization...");

  const rawGoalWithContract = `
    Migrate auth subsystem to JWT tokens
    verify: npm test passes cleanly
    constraints: keep public /login response shape backward-compatible
    boundaries: only touch services/auth and src/core/contracts
    stop when: database migration requires human DBA review
  `;

  const parsed = engine.parseContract(rawGoalWithContract);
  assert.strictEqual(parsed.headline, "Migrate auth subsystem to JWT tokens");
  assert.strictEqual(parsed.contract.verification, "npm test passes cleanly");
  assert.strictEqual(parsed.contract.constraints, "keep public /login response shape backward-compatible");
  assert.strictEqual(parsed.contract.boundaries, "only touch services/auth and src/core/contracts");
  assert.strictEqual(parsed.contract.stopWhen, "database migration requires human DBA review");

  const continuationPrompt = engine.renderContinuationPrompt(parsed.headline, parsed.contract);
  assert.ok(continuationPrompt.includes("Completion contract:"));
  assert.ok(continuationPrompt.includes("Verification: npm test passes cleanly"));
  assert.ok(continuationPrompt.includes("Constraints: keep public /login response shape"));
  console.log("  [✓] 5-field structured contract parsed and rendered cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 2: Quality Gate Execution, Output Bounding & Unchanged Workspace Cache
  // ---------------------------------------------------------------------------
  console.log("[Suite 2/8] Quality Gate Execution, Output Bounding & Workspace Fingerprint Cache...");

  const gatePass = {
    command: "node -e 'console.log(\"Gate PASS\")'",
    timeoutSeconds: 5,
    maxRetries: 3,
    attempts: 0,
    lastOutputTail: "",
    lastFailedFingerprint: "",
  };

  const passRes = await engine.runGate(gatePass);
  assert.strictEqual(passRes.passed, true);
  assert.strictEqual(passRes.exitCode, 0);
  assert.ok(passRes.outputTail.includes("Gate PASS"));

  const gateFail = {
    command: "node -e 'console.error(\"Gate FAIL\"); process.exit(2)'",
    timeoutSeconds: 5,
    maxRetries: 3,
    attempts: 0,
    lastOutputTail: "",
    lastFailedFingerprint: "",
  };

  const failRes1 = await engine.runGate(gateFail, undefined, "sha256-abc123");
  assert.strictEqual(failRes1.passed, false);
  assert.strictEqual(failRes1.exitCode, 2);
  assert.ok(failRes1.outputTail.includes("Gate FAIL"));
  assert.strictEqual(gateFail.attempts, 1);
  assert.strictEqual(gateFail.lastFailedFingerprint, "sha256-abc123");

  // Re-running on unchanged fingerprint: fast skip replay
  const failRes2 = await engine.runGate(gateFail, undefined, "sha256-abc123");
  assert.strictEqual(failRes2.passed, false);
  assert.strictEqual(gateFail.attempts, 2);
  console.log("  [✓] Quality gate executed, bounded output captured, and unchanged fingerprint cache verified.");

  // ---------------------------------------------------------------------------
  // Suite 3: Deterministic 3-State Epistemic Judge (DONE, WAIT, CONTINUE)
  // ---------------------------------------------------------------------------
  console.log("[Suite 3/8] Deterministic 3-State Epistemic Judge (DONE, WAIT, CONTINUE)...");

  // Case A: Done
  const resDone = await engine.judgeGoal({
    goal: "Deploy staging server",
    lastResponse: "Task finished successfully. Goal is complete and all tests pass.",
  });
  assert.strictEqual(resDone.verdict, "done");
  assert.strictEqual(resDone.shouldContinue, false);

  // Case B: Blocked -> Done with reason
  const resBlocked = await engine.judgeGoal({
    goal: "Deploy staging server",
    lastResponse: "I am blocked: database credentials missing. Need user input.",
  });
  assert.strictEqual(resBlocked.verdict, "done");
  assert.strictEqual(resBlocked.shouldContinue, false);
  assert.ok(resBlocked.reason.includes("blocked"));

  // Case C: Wait on background process
  const resWait = await engine.judgeGoal({
    goal: "Run test suite",
    lastResponse: "Waiting for background process to finish test runner.",
    backgroundProcesses: [{ pid: 12345, command: "npm test", session: "sess-1" }],
  });
  assert.strictEqual(resWait.verdict, "wait");
  assert.strictEqual(resWait.shouldContinue, false);
  assert.strictEqual(resWait.waitOnPid, 12345);

  // Case D: Continue
  const resContinue = await engine.judgeGoal({
    goal: "Refactor auth",
    lastResponse: "I have edited login-handler.ts. Next I will update session-validator.ts.",
  });
  assert.strictEqual(resContinue.verdict, "continue");
  assert.strictEqual(resContinue.shouldContinue, true);
  assert.ok(resContinue.continuationPrompt?.includes("Continue working toward this goal"));
  console.log("  [✓] Epistemic judge accurately evaluated DONE, WAIT, and CONTINUE.");

  // ---------------------------------------------------------------------------
  // Suite 4: Dynamic Mid-Loop Subgoal Criteria Injection
  // ---------------------------------------------------------------------------
  console.log("[Suite 4/8] Dynamic Mid-Loop Subgoal Criteria Injection...");

  const subgoalsPrompt = engine.renderContinuationPrompt("Build authentication", undefined, [
    "Must add rate limiting to /login",
    "Must add CSRF validation",
  ]);
  assert.ok(subgoalsPrompt.includes("1. Must add rate limiting to /login"));
  assert.ok(subgoalsPrompt.includes("2. Must add CSRF validation"));
  console.log("  [✓] Mid-loop subgoals rendered into continuation prompt.");

  // ---------------------------------------------------------------------------
  // Suite 5: Zero-GC Substrate & Frame-Perfect Microsecond Rollback (< 0.05 ms)
  // ---------------------------------------------------------------------------
  console.log("[Suite 5/8] Zero-GC Substrate & Frame-Perfect Microsecond Rollback (< 0.05 ms)...");

  substrate.clear();
  supervisor.setGoal("sess-bench", "Initial standing goal", { maxTurns: 10 });
  supervisor.addSubgoal("sess-bench", "Subgoal 1");

  snapshotManager.createSnapshot("frame-1");

  // Advance state
  supervisor.addSubgoal("sess-bench", "Subgoal 2");
  supervisor.pauseGoal("sess-bench", "Test pause");

  const stateModified = supervisor.getGoal("sess-bench");
  assert.strictEqual(stateModified?.status, "paused");
  assert.strictEqual(stateModified?.subgoals.length, 2);

  // Instant Rollback
  const t0 = performance.now();
  const restored = snapshotManager.restoreSnapshot("frame-1");
  const t1 = performance.now();
  const rewindMs = t1 - t0;

  assert.strictEqual(restored, true);
  const stateRestored = supervisor.getGoal("sess-bench");
  assert.strictEqual(stateRestored?.status, "active");
  assert.strictEqual(stateRestored?.subgoals.length, 1);
  assert.strictEqual(stateRestored?.subgoals[0], "Subgoal 1");
  assert.ok(rewindMs < 0.05, `Rewind took ${rewindMs.toFixed(4)} ms (< 0.05 ms SLA)`);
  console.log(`  [✓] Substrate state rollback restored in ${rewindMs.toFixed(4)} ms (< 0.05 ms SLA).`);

  // ---------------------------------------------------------------------------
  // Suite 6: Goal Supervisor Lifecycle Coordination & Turn Evaluation
  // ---------------------------------------------------------------------------
  console.log("[Suite 6/8] Goal Supervisor Lifecycle Coordination & Turn Evaluation...");

  supervisor.setGoal("sess-lifecycle", "Build user profile", { maxTurns: 5 });
  supervisor.addGate("sess-lifecycle", "node -e 'process.exit(0)'");

  const eval1 = await supervisor.evaluateTurn("sess-lifecycle", "I created the database schema.");
  assert.strictEqual(eval1.verdict, "continue");
  assert.strictEqual(eval1.shouldContinue, true);

  const stateTurn1 = supervisor.getGoal("sess-lifecycle");
  assert.strictEqual(stateTurn1?.turnsUsed, 1);

  supervisor.pauseGoal("sess-lifecycle", "Manual user pause");
  const statePaused = supervisor.getGoal("sess-lifecycle");
  assert.strictEqual(statePaused?.status, "paused");

  supervisor.resumeGoal("sess-lifecycle");
  const stateResumed = supervisor.getGoal("sess-lifecycle");
  assert.strictEqual(stateResumed?.status, "active");

  const eval2 = await supervisor.evaluateTurn("sess-lifecycle", "All tests pass. Goal complete!");
  assert.strictEqual(eval2.verdict, "done");
  const stateDone = supervisor.getGoal("sess-lifecycle");
  assert.strictEqual(stateDone?.status, "done");
  console.log("  [✓] Supervisor lifecycle and turn evaluations verified.");

  // ---------------------------------------------------------------------------
  // Suite 7: Model Tool Suite Execution
  // ---------------------------------------------------------------------------
  console.log("[Suite 7/8] Model Tool Suite Execution...");

  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 6);

  const goalSetTool = tools.find((t) => t.name === "goal_set")!;
  const setRes = (await goalSetTool.execute(
    { sessionId: "tool-sess", goal: "Implement dark mode\nverify: tests pass" },
    process.cwd()
  )) as any;
  assert.strictEqual(setRes.success, true);
  assert.strictEqual(setRes.state.contract.verification, "tests pass");

  const goalStatusTool = tools.find((t) => t.name === "goal_status")!;
  const statusRes = (await goalStatusTool.execute({ sessionId: "tool-sess" }, process.cwd())) as any;
  assert.strictEqual(statusRes.success, true);
  assert.strictEqual(statusRes.hasGoal, true);

  const goalSubgoalTool = tools.find((t) => t.name === "goal_add_subgoal")!;
  const subRes = (await goalSubgoalTool.execute(
    { sessionId: "tool-sess", subgoal: "Support OS theme sync" },
    process.cwd()
  )) as any;
  assert.strictEqual(subRes.success, true);

  const goalEvalTool = tools.find((t) => t.name === "goal_evaluate_turn")!;
  const evalToolRes = (await goalEvalTool.execute(
    { sessionId: "tool-sess", lastResponse: "Dark mode implementation is complete with all tests pass." },
    process.cwd()
  )) as any;
  assert.strictEqual(evalToolRes.success, true);
  assert.strictEqual(evalToolRes.result.verdict, "done");
  console.log("  [✓] All 6 model tools executed cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 8: Micro-Benchmarks & Grand Monolith Composition (549 Components)
  // ---------------------------------------------------------------------------
  console.log("[Suite 8/8] Micro-Benchmarks & Grand Monolith Composition (549 Components)...");

  const iterations = 50_000;
  const startBench = performance.now();
  for (let i = 0; i < iterations; i++) {
    substrate.recordInvocation();
  }
  const endBench = performance.now();
  const benchMs = endBench - startBench;
  const throughput = Math.round((iterations / benchMs) * 1000);
  console.log(`  Measured: ${iterations.toLocaleString()} invocations in ${benchMs.toFixed(3)} ms (${throughput.toLocaleString()} ops/sec)`);

  const monolith = new LumiMonolith();
  assert.ok(monolith.components.deterministicGoalEngine);
  assert.ok(monolith.components.goalSupervisor);
  assert.ok(monolith.components.broccoliGoalSubstrate);
  assert.ok(monolith.components.goalSnapshotManager);
  assert.ok(monolith.components.goalToolSuite);

  const verification = GrandMonolithSynthesizer.verifyComposition(monolith.components);
  assert.strictEqual(verification.cohesionStatus, "OPTIMAL");
  assert.strictEqual(verification.componentCount, 549);
  assert.strictEqual(verification.missingComponents.length, 0);
  assert.strictEqual(verification.unexpectedComponents.length, 0);
  assert.strictEqual(verification.duplicateManifestComponents.length, 0);
  console.log(`  [✓] Grand Monolith successfully verified with ${verification.componentCount}/549 components in OPTIMAL cohesion.`);

  console.log("\n================================================================");
  console.log("   ALL 8 GOAL SYSTEM VALIDATION SUITES PASSED CLEANLY!         ");
  console.log("================================================================");
}

runGoalValidationSuites().catch((err) => {
  console.error("Validation error:", err);
  process.exit(1);
});
