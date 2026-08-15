import * as assert from "node:assert/strict";
import {
  LumiMonolith,
  MonolithSwarmDelegator,
  SubagentLifecycleGuard,
  SubagentBudgetGovernor,
  SubagentVfsBrancher,
  AnchoredWorktreeManager,
  SwarmToolSuite,
  SessionVfs,
} from "../src/index.js";

async function main(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Autonomous Swarm Delegation (AKD-DSO Validation)       ");
  console.log("================================================================\n");

  const guard = new SubagentLifecycleGuard();
  const governor = new SubagentBudgetGovernor();
  const vfsBrancher = new SubagentVfsBrancher();
  const worktreeManager = new AnchoredWorktreeManager();
  const delegator = new MonolithSwarmDelegator(guard, governor, vfsBrancher, worktreeManager);

  // ── [Test 1/8] Delegation Manifest & Tree Depth Limit Guardrail ───────────
  console.log("[Test 1/8] Validating Subagent Task Manifest & Tree Depth Guardrails...");
  {
    // Valid subagent
    const validCheck = guard.canSpawnSubagent({
      id: "subtask-1",
      depth: 1,
      goal: "Analyze AST complexity",
      context: "Perform static analysis",
      allowedTools: ["read_file"],
      blockedTools: [],
      budget: { maxIterations: 5, maxTokens: 10000, maxWallClockMs: 10000, remainingIterations: 5, remainingTokens: 10000 },
      status: "pending",
      createdTick: 0,
    });
    assert.ok(validCheck.allowed, "Valid subagent at depth 1 should be allowed");

    // Exceeded depth limit (depth 3 >= limit 3)
    const deepCheck = guard.canSpawnSubagent({
      id: "subtask-deep",
      depth: 3,
      goal: "Recursive subtask",
      context: "",
      allowedTools: [],
      blockedTools: [],
      budget: { maxIterations: 5, maxTokens: 10000, maxWallClockMs: 10000, remainingIterations: 5, remainingTokens: 10000 },
      status: "pending",
      createdTick: 0,
    });
    assert.ok(!deepCheck.allowed, "Subagent at depth >= 3 must be blocked");
    assert.ok(deepCheck.reason?.includes("Maximum delegation depth exceeded"));

    console.log("\x1b[32m  [✓] Manifest validation & recursion depth limits passed.\x1b[0m");
  }

  // ── [Test 2/8] Forbidden Tool Stripping & Output Sanitization ──────────────
  console.log("[Test 2/8] Validating Forbidden Tool Stripping & Output Sanitization...");
  {
    const requestedTools = ["read_file", "delegate_task", "clarify", "search_symbols", "interactive_prompt"];
    const filteredTools = guard.filterSubagentTools(requestedTools);

    assert.deepEqual(Array.from(filteredTools), ["read_file", "search_symbols"], "Forbidden delegation tools must be stripped");

    const rawOutput = "\x1b[31mError\x1b[0m: Sample \u0000output\r\nwith control codes";
    const sanitized = guard.sanitizeSubagentOutput(rawOutput);
    assert.ok(!sanitized.includes("\u0000"), "Control codes must be stripped");

    console.log("\x1b[32m  [✓] Tool filtering & output sanitization passed.\x1b[0m");
  }

  // ── [Test 3/8] Frame-Level Token, Turn & Wall-Clock Budget Enforcement ────
  console.log("[Test 3/8] Validating Frame-Level Budget Governor...");
  {
    const taskManifest = {
      id: "budget-test-task",
      depth: 1,
      goal: "Compute primes",
      context: "",
      allowedTools: [],
      blockedTools: [],
      budget: { maxIterations: 2, maxTokens: 500, maxWallClockMs: 5000, remainingIterations: 2, remainingTokens: 500 },
      status: "pending" as const,
      createdTick: 0,
    };

    governor.allocateBudget(taskManifest);

    // Turn 1: Consume 200 tokens
    const turn1 = governor.consumeTurn("budget-test-task", 200);
    assert.ok(turn1.allowed);
    assert.equal(turn1.remainingBudget.remainingIterations, 1);
    assert.equal(turn1.remainingBudget.remainingTokens, 300);

    // Turn 2: Consume 200 tokens
    const turn2 = governor.consumeTurn("budget-test-task", 200);
    assert.ok(turn2.allowed);
    assert.equal(turn2.remainingBudget.remainingIterations, 0);
    assert.equal(turn2.remainingBudget.remainingTokens, 100);

    // Turn 3: Attempt another turn -> MUST FAIL (iterations exhausted)
    const turn3 = governor.consumeTurn("budget-test-task", 50);
    assert.ok(!turn3.allowed, "Turn must be rejected when iteration budget is exhausted");
    assert.ok(turn3.reason?.includes("Iteration budget exhausted"));

    governor.reclaimBudget("budget-test-task");
    console.log("\x1b[32m  [✓] Budget governor iteration and token limits passed.\x1b[0m");
  }

  // ── [Test 4/8] In-Memory Copy-on-Write VFS Overlay Branching & Commit ───────
  console.log("[Test 4/8] Validating Copy-on-Write VFS Branching...");
  {
    const parentVfs = new SessionVfs();
    parentVfs.stageWrite("src/app.ts", "console.log('original');");
    vfsBrancher.registerParentVfs("parent-session-1", parentVfs);

    // Create subagent branch overlay
    vfsBrancher.createBranchOverlay("parent-session-1", "subagent-1");
    const subagentVfs = vfsBrancher.getSubagentVfs("subagent-1");
    assert.ok(subagentVfs, "Subagent VFS must exist");
    assert.equal(subagentVfs.getFile("src/app.ts")?.content, "console.log('original');");

    // Mutate in subagent VFS
    subagentVfs.stageWrite("src/app.ts", "console.log('mutated-by-subagent');");
    subagentVfs.stageWrite("src/submodule.ts", "export const value = 42;");

    // Verify parent is NOT yet mutated
    assert.equal(parentVfs.getFile("src/app.ts")?.content, "console.log('original');");
    assert.equal(parentVfs.getFile("src/submodule.ts"), undefined);

    // Commit subagent VFS
    const committedFiles = vfsBrancher.commitBranchOverlay("subagent-1");
    assert.equal(committedFiles.length, 2);
    assert.equal(parentVfs.getFile("src/app.ts")?.content, "console.log('mutated-by-subagent');");
    assert.ok(parentVfs.getFile("src/submodule.ts"));

    console.log("\x1b[32m  [✓] Copy-on-write VFS branching and commit passed.\x1b[0m");
  }

  // ── [Test 5/8] Line-Anchored Git Worktree Sandbox Isolation ────────────────
  console.log("[Test 5/8] Validating Anchored Git Worktree Sandbox Manager...");
  {
    const worktreeSpec = {
      worktreePath: "/tmp/lumi-worktree-sandbox-1",
      branchName: "feature/subagent-sandbox-1",
      isTemporary: true,
      autoCleanup: true,
    };

    const createResult = await worktreeManager.createIsolatedWorktree(worktreeSpec);
    assert.ok(createResult.success);
    assert.equal(worktreeManager.getActiveWorktreesCount(), 1);

    worktreeManager.recordFileModification(worktreeSpec.branchName, "src/index.ts");
    worktreeManager.recordFileModification(worktreeSpec.branchName, "package.json");

    const mergeResult = await worktreeManager.mergeWorktreeChanges(worktreeSpec.branchName);
    assert.ok(mergeResult.success);
    assert.equal(mergeResult.filesChanged.length, 2);

    const cleanupResult = await worktreeManager.cleanupWorktree(worktreeSpec.worktreePath);
    assert.ok(cleanupResult.success);
    assert.equal(worktreeManager.getActiveWorktreesCount(), 0);

    console.log("\x1b[32m  [✓] Worktree sandbox creation, recording, merge, and cleanup passed.\x1b[0m");
  }

  // ── [Test 6/8] Parallel Swarm Batch Execution & Synthesis ───────────────────
  console.log("[Test 6/8] Validating Parallel Swarm Batch Execution...");
  {
    const batchTasks = [
      {
        id: "batch-task-1",
        depth: 1,
        goal: "Refactor AST perception",
        context: "Module 1",
        allowedTools: ["read_file"],
        blockedTools: [],
        budget: { maxIterations: 5, maxTokens: 10000, maxWallClockMs: 10000, remainingIterations: 5, remainingTokens: 10000 },
      },
      {
        id: "batch-task-2",
        depth: 1,
        goal: "Benchmark slab allocator",
        context: "Module 2",
        allowedTools: ["read_file"],
        blockedTools: [],
        budget: { maxIterations: 5, maxTokens: 10000, maxWallClockMs: 10000, remainingIterations: 5, remainingTokens: 10000 },
      },
    ];

    const startBatch = performance.now();
    const batchResult = await delegator.delegateBatch(batchTasks);
    const duration = performance.now() - startBatch;

    assert.equal(batchResult.totalTasks, 2);
    assert.equal(batchResult.completedCount, 2);
    assert.equal(batchResult.failedCount, 0);
    assert.ok(batchResult.combinedSummary.includes("batch-task-1"));
    assert.ok(batchResult.combinedSummary.includes("batch-task-2"));
    assert.ok(duration < 10.0, `Batch execution took ${duration} ms`);

    console.log("\x1b[32m  [✓] Parallel swarm batch execution & aggregated synthesis passed.\x1b[0m");
  }

  // ── [Test 7/8] Subagent Status Inspection & Graceful Abort ────────────────
  console.log("[Test 7/8] Validating Status Inspection & Graceful Abort...");
  {
    const subtask = {
      id: "abortable-subtask",
      depth: 1,
      goal: "Long running simulation",
      context: "",
      allowedTools: [],
      blockedTools: [],
      budget: { maxIterations: 10, maxTokens: 50000, maxWallClockMs: 60000, remainingIterations: 10, remainingTokens: 50000 },
    };

    // Before execution, spawn check
    const singleOutcome = await delegator.delegateTask(subtask);
    assert.ok(singleOutcome.success);
    assert.equal(delegator.getTaskStatus("abortable-subtask"), "completed");

    // Test tool suite status & abort tools
    const toolSuite = new SwarmToolSuite(delegator);
    const statusTool = await toolSuite.executeTool("delegate_status", { taskId: "abortable-subtask" });
    assert.ok(statusTool.success);

    const abortTool = await toolSuite.executeTool("delegate_abort", { taskId: "abortable-subtask", reason: "User cancel" });
    // Already completed so abort returns false
    assert.equal(abortTool.success, false);

    console.log("\x1b[32m  [✓] Status inspection and abort handling passed.\x1b[0m");
  }

  // ── [Test 8/8] Monolith Composition & Allocation Latency Micro-Benchmark ───
  console.log("[Test 8/8] Benchmarking Monolith Delegation & Allocation Latency...");
  {
    const monolith = new LumiMonolith({ sessionId: "swarm-benchmark-session" });
    assert.ok(monolith.monolithSwarmDelegator, "monolithSwarmDelegator must be composed");
    assert.ok(monolith.subagentBudgetGovernor, "subagentBudgetGovernor must be composed");
    assert.ok(monolith.subagentLifecycleGuard, "subagentLifecycleGuard must be composed");
    assert.ok(monolith.subagentVfsBrancher, "subagentVfsBrancher must be composed");
    assert.ok(monolith.anchoredWorktreeManager, "anchoredWorktreeManager must be composed");
    assert.ok(monolith.swarmToolSuite, "swarmToolSuite must be composed");

    // Allocation Micro-benchmark (1,000 subagent task allocations)
    const iterations = 1000;
    const startAlloc = performance.now();
    for (let i = 0; i < iterations; i++) {
      monolith.subagentBudgetGovernor.allocateBudget({
        id: `bench-subtask-${i}`,
        depth: 1,
        goal: `Bench goal ${i}`,
        context: "",
        allowedTools: [],
        blockedTools: [],
        budget: { maxIterations: 5, maxTokens: 10000, maxWallClockMs: 10000, remainingIterations: 5, remainingTokens: 10000 },
        status: "pending",
        createdTick: 0,
      });
    }
    const totalAllocMs = performance.now() - startAlloc;
    const perAllocUs = (totalAllocMs / iterations) * 1000;

    console.log(`  Measured: ${iterations} subagent budget allocations in ${totalAllocMs.toFixed(3)} ms (${perAllocUs.toFixed(3)} µs/alloc)`);
    assert.ok(totalAllocMs < 10.0, `1000 allocations took ${totalAllocMs} ms, must be < 10.0ms`);

    // Model tool execution via Monolith
    const delegateTool = await monolith.swarmToolSuite.executeTool("delegate_task", {
      id: "monolith-subtask-1",
      goal: "Verify monolith subagent delegation",
      maxIterations: 5,
    });
    assert.ok(delegateTool.success);

    console.log("\x1b[32m  [✓] Monolith composition & allocation benchmark passed.\x1b[0m");
  }

  console.log("\n================================================================");
  console.log("   ALL 8 SWARM DELEGATION VALIDATION SUITES PASSED!            ");
  console.log("================================================================\n");
}

main().catch((error) => {
  console.error("Validation failed with error:", error);
  process.exit(1);
});
