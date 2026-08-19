import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  BroccoliDatabaseKernel,
  BroccoliKanbanSubstrate,
  DeterministicKanbanEngine,
  KanbanBoardSupervisor,
  BroccoliRunbookSubstrate,
  RunbookSupervisor,
  FilePredicateEvaluator,
} from "../src/index.js";

async function runKanbanFsmIntegrationSuite(): Promise<void> {
  console.log("\x1b[1;35m╭─── [KANBAN FSM INTEGRATION] DETERMINISTIC VERIFICATION SUITE ────────╮\x1b[0m");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-kanban-fsm-test-"));

  try {
    const kernel = new BroccoliDatabaseKernel({ workspaceRoot: tmpDir });
    const runbookSubstrate = new BroccoliRunbookSubstrate(kernel);
    const runbookSupervisor = new RunbookSupervisor(runbookSubstrate, { workspaceRoot: tmpDir });
    const predicateEvaluator = new FilePredicateEvaluator();

    const kanbanSubstrate = new BroccoliKanbanSubstrate();
    const kanbanEngine = new DeterministicKanbanEngine();
    const kanbanSupervisor = new KanbanBoardSupervisor(
      kanbanEngine,
      kanbanSubstrate,
      runbookSupervisor,
      predicateEvaluator
    );

    kanbanSupervisor.createBoard("dev-board", "Core Development Board");

    // -------------------------------------------------------------
    // Test 1: Task Creation with FSM Verification Tracking
    // -------------------------------------------------------------
    console.log("  [1/5] Testing Task Creation with FSM Verification Status...");
    const createRes = kanbanSupervisor.createTask({
      boardId: "dev-board",
      title: "Implement Stripe Webhook Consumer",
      description: "Handle incoming customer subscription events",
      priority: "high",
      column: "in_progress",
    });

    assert.strictEqual(createRes.success, true);
    assert.ok(createRes.task);
    assert.strictEqual(createRes.task.column, "in_progress");
    assert.strictEqual(createRes.task.fsmVerificationStatus, "in_progress");
    const taskId = createRes.task.id;
    console.log(`    ✔ Created task '${taskId}' with 'in_progress' FSM verification state`);

    // -------------------------------------------------------------
    // Test 2: Block Move to Done with Pending Subtasks
    // -------------------------------------------------------------
    console.log("  [2/5] Testing Mechanical Block on Move to Done (Pending Subtasks)...");
    kanbanSupervisor.updateTask("dev-board", taskId, {
      subtaskChecklist: [
        { id: "s-1", text: "Signature verification helper", done: true },
        { id: "s-2", text: "Unit test for idempotency", done: false },
      ],
    });

    const moveBlockedRes = kanbanSupervisor.updateTask("dev-board", taskId, { column: "done" });
    assert.strictEqual(moveBlockedRes.success, false);
    assert.ok(moveBlockedRes.error?.includes("Quality Gate Blocked"));
    assert.ok(moveBlockedRes.error?.includes("uncompleted subtask(s)"));
    console.log("    ✔ Transition to 'done' strictly blocked by subtask verification gate");

    // -------------------------------------------------------------
    // Test 3: Satisfy Subtasks & Transition to Done
    // -------------------------------------------------------------
    console.log("  [3/5] Testing Successful Transition to Done (All Subtasks Complete)...");
    kanbanSupervisor.updateTask("dev-board", taskId, {
      subtaskChecklist: [
        { id: "s-1", text: "Signature verification helper", done: true },
        { id: "s-2", text: "Unit test for idempotency", done: true },
      ],
    });

    const moveDoneRes = kanbanSupervisor.updateTask("dev-board", taskId, { column: "done" });
    assert.strictEqual(moveDoneRes.success, true);
    assert.ok(moveDoneRes.task);
    assert.strictEqual(moveDoneRes.task.column, "done");
    assert.strictEqual(moveDoneRes.task.fsmVerificationStatus, "verified");
    console.log("    ✔ Card moved to 'done' and stamped with 'verified' FSM status");

    // -------------------------------------------------------------
    // Test 4: Custom Predicate Verification Gate Evaluation
    // -------------------------------------------------------------
    console.log("  [4/5] Testing Custom In-Memory File Predicate Quality Gates...");
    const proofFile = path.join(tmpDir, "test_receipt.json");
    
    // Create task with file gate
    const gatedTaskRes = kanbanSupervisor.createTask({
      boardId: "dev-board",
      title: "Hardened Auth Middleware",
      column: "in_progress",
      metadata: {
        verification: [
          {
            path: proofFile,
            exists: true,
            blocking: true,
          },
        ],
      },
    });
    const gatedTaskId = gatedTaskRes.task!.id;

    // Moving to done fails because proofFile doesn't exist yet
    const failGateRes = kanbanSupervisor.updateTask("dev-board", gatedTaskId, { column: "done" });
    assert.strictEqual(failGateRes.success, false);
    assert.ok(failGateRes.error?.includes("Quality Gate Blocked"));

    // Create the proof file
    fs.writeFileSync(proofFile, JSON.stringify({ passed: true, score: 100 }));

    // Now moving to done succeeds
    const passGateRes = kanbanSupervisor.updateTask("dev-board", gatedTaskId, { column: "done" });
    assert.strictEqual(passGateRes.success, true);
    assert.strictEqual(passGateRes.task?.column, "done");
    assert.strictEqual(passGateRes.task?.fsmVerificationStatus, "verified");
    console.log("    ✔ Custom file predicate evaluated and verified before allowing 'done'");

    // -------------------------------------------------------------
    // Test 5: Board Metrics & Diagnostics Integrity
    // -------------------------------------------------------------
    console.log("  [5/5] Testing Board Diagnostics & Metrics...");
    const metrics = kanbanSupervisor.getBoardMetrics("dev-board");
    assert.ok(metrics);
    assert.strictEqual(metrics.totalTasks, 2);
    assert.strictEqual(metrics.columnCounts.done, 2);
    console.log(`    ✔ Board metrics validated: ${metrics.totalTasks} tasks verified and done`);

    console.log("\x1b[1;32m╰─── ALL KANBAN FSM INTEGRATION TESTS PASSED (100%) ──────────────────╯\x1b[0m\n");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runKanbanFsmIntegrationSuite().catch((err) => {
  console.error("Kanban FSM Integration test failed:", err);
  process.exit(1);
});
