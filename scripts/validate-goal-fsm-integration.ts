import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  BroccoliDatabaseKernel,
  BroccoliGoalSubstrate,
  DeterministicGoalEngine,
  GoalSupervisor,
  BroccoliRunbookSubstrate,
  RunbookSupervisor,
} from "../src/index.js";

async function runGoalFsmIntegrationSuite(): Promise<void> {
  console.log("\x1b[1;36m╭─── [GOAL FSM INTEGRATION] DETERMINISTIC VERIFICATION SUITE ───────────╮\x1b[0m");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-goal-fsm-test-"));

  try {
    const kernel = new BroccoliDatabaseKernel({ workspaceRoot: tmpDir });
    const runbookSubstrate = new BroccoliRunbookSubstrate(kernel);
    const runbookSupervisor = new RunbookSupervisor(runbookSubstrate, { workspaceRoot: tmpDir });

    const goalSubstrate = new BroccoliGoalSubstrate();
    const goalEngine = new DeterministicGoalEngine(goalSubstrate);
    const goalSupervisor = new GoalSupervisor(goalSubstrate, goalEngine, runbookSupervisor);

    // -------------------------------------------------------------
    // Test 1: Goal FSM Auto-Provisioning
    // -------------------------------------------------------------
    console.log("  [1/5] Testing Goal FSM Auto-Provisioning & Preset Binding...");
    const goal = goalSupervisor.setGoal("test-session-01", "Implement OAuth PKCE login flow", {
      category: "feature",
      maxTurns: 15,
      milestones: ["Draft Spec", "Implement Code", "Verify Tests", "Ship Release"],
    });

    assert.strictEqual(goal.sessionId, "test-session-01");
    assert.strictEqual(goal.status, "active");
    assert.strictEqual(goal.category, "feature");
    console.log("    ✔ Goal created and bound to deterministic feature workflow");

    // -------------------------------------------------------------
    // Test 2: Interactive Slash Dashboard with ASCII Pipeline
    // -------------------------------------------------------------
    console.log("  [2/5] Testing Interactive /goal Dashboard with Workflow FSM Pipeline...");
    const dashboardResult = goalSupervisor.executeSlashCommand("test-session-01", "/goal");
    assert.strictEqual(dashboardResult.success, true);
    assert.ok(dashboardResult.output.includes("Workflow FSM Pipeline:"));
    assert.ok(dashboardResult.output.includes("Active Session Goal:"));
    console.log("    ✔ /goal dashboard rendered live ASCII DAG pipeline breadcrumbs");

    // -------------------------------------------------------------
    // Test 3: Stage Advancement via /goal next / advance
    // -------------------------------------------------------------
    console.log("  [3/5] Testing Goal Stage Transitions (/goal next)...");
    const advanceResult = goalSupervisor.executeSlashCommand("test-session-01", "/goal next");
    assert.strictEqual(advanceResult.success, true);
    assert.ok(advanceResult.output.includes("Advanced Goal FSM Stage"));

    const updatedGoal = goalSupervisor.getGoal("test-session-01")!;
    assert.ok(updatedGoal.activeFsmStage);
    assert.strictEqual(updatedGoal.fsmVerificationStatus, "verified");
    console.log(`    ✔ Advanced stage to '${updatedGoal.activeFsmStage}' with verification state recorded`);

    // -------------------------------------------------------------
    // Test 4: Amnesia-Proof Context Compaction (/goal compact)
    // -------------------------------------------------------------
    console.log("  [4/5] Testing Amnesia-Proof /goal compact Prompt Synthesis...");
    const compactResult = goalSupervisor.executeSlashCommand("test-session-01", "/goal compact");
    assert.strictEqual(compactResult.success, true);
    assert.ok(compactResult.output.includes("Run ID:"));
    assert.ok(compactResult.output.includes("Post-Compaction Recovery Protocol:"));
    console.log("    ✔ Generated amnesia-proof reconstitution envelope preserving goal context");

    // -------------------------------------------------------------
    // Test 5: Milestone Completion & Gate Alignment
    // -------------------------------------------------------------
    console.log("  [5/5] Testing Milestone Lifecycle & Gate Tracking...");
    const m1Ok = goalSupervisor.completeMilestone("test-session-01", "m-1");
    assert.strictEqual(m1Ok, true);

    const postMilestone = goalSupervisor.getGoal("test-session-01")!;
    assert.strictEqual(postMilestone.milestones[0].status, "completed");
    assert.strictEqual(postMilestone.milestones[0].progressPercent, 100);
    console.log("    ✔ Milestone DAG status updated with 100% progress metrics");

    console.log("\x1b[1;32m╰─── ALL GOAL FSM INTEGRATION TESTS PASSED (100%) ─────────────────────╯\x1b[0m\n");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runGoalFsmIntegrationSuite().catch((err) => {
  console.error("Goal FSM Integration test failed:", err);
  process.exit(1);
});
