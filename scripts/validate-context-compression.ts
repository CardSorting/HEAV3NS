import * as assert from "node:assert/strict";
import {
  LumiMonolith,
  HeadTailBudgetGovernor,
  DeterministicToolPruner,
  BroccoliCompressionSubstrate,
  CompressionSnapshotManager,
  TrajectoryCompactorEngine,
  CompressionToolSuite,
} from "../src/index.js";

async function main(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Context Compression & Compactor (AKD-DSO Validation)  ");
  console.log("================================================================\n");

  const substrate = new BroccoliCompressionSubstrate();
  const budgetGovernor = new HeadTailBudgetGovernor(128000, "balanced");
  const toolPruner = new DeterministicToolPruner({ maxOutputChars: 4000 });
  const snapshotManager = new CompressionSnapshotManager(substrate);
  const compactorEngine = new TrajectoryCompactorEngine(substrate, budgetGovernor, toolPruner);
  const toolSuite = new CompressionToolSuite(substrate, budgetGovernor, toolPruner, compactorEngine);

  // ── [Test 1/8] Token Window Budget Calculation & Thresholds ───────────────
  console.log("[Test 1/8] Validating Token Window Budget Calculation & Thresholds...");
  {
    const budget = budgetGovernor.calculateBudget(50000, 128000);
    assert.equal(budget.maxContextLimit, 128000);
    assert.equal(budget.compressionThreshold, 102400); // 80% of 128k
    assert.equal(budget.headReservedTokens, 19200);   // 15%
    assert.equal(budget.tailReservedTokens, 32000);   // 25%

    assert.ok(!budgetGovernor.shouldCompress(50000, budget), "50k tokens should NOT trigger compression");
    assert.ok(budgetGovernor.shouldCompress(105000, budget), "105k tokens MUST trigger compression");

    console.log("\x1b[32m  [✓] Mathematical token budget calculations and threshold triggers verified.\x1b[0m");
  }

  // ── [Test 2/8] Head/Tail Context Partitioning ──────────────────────────────
  console.log("[Test 2/8] Validating Head/Tail Turn Partitioning...");
  {
    const turns = Array.from({ length: 12 }, (_, i) => ({ id: `turn-${i}`, text: `Message #${i}` }));
    const { head, middle, tail } = budgetGovernor.partitionTurns(turns, 2, 4);

    assert.equal(head.length, 2, "Head must have 2 turns");
    assert.equal(head[0].id, "turn-0");
    assert.equal(head[1].id, "turn-1");

    assert.equal(tail.length, 4, "Tail must have 4 turns");
    assert.equal(tail[3].id, "turn-11");

    assert.equal(middle.length, 6, "Middle window must have remaining 6 turns");
    assert.equal(middle[0].id, "turn-2");
    assert.equal(middle[middle.length - 1].id, "turn-7");

    console.log("\x1b[32m  [✓] Head/middle/tail context turn partitioning verified.\x1b[0m");
  }

  // ── [Test 3/8] AST-Aware Deterministic Tool Pruning ────────────────────────
  console.log("[Test 3/8] Validating Deterministic Tool Output Pruning...");
  {
    // 1. Strip Base64 image payload
    const base64Data = "A".repeat(500);
    const rawImageOutput = `Rendered UI preview: data:image/png;base64,${base64Data} completed.`;
    const prunedBase64 = toolPruner.pruneToolResult(rawImageOutput);
    assert.ok(prunedBase64.wasPruned, "Base64 data must be pruned");
    assert.ok(prunedBase64.prunedText.includes("[base64 data stripped:"), "Base64 replacement tag must be inserted");

    // 2. Collapse repeated lines
    const repeatedOutput = `Status check OK\n` + `Retrying server probe...\n`.repeat(10) + `Final status: connected.`;
    const prunedRepeat = toolPruner.pruneToolResult(repeatedOutput);
    assert.ok(prunedRepeat.wasPruned);
    assert.ok(prunedRepeat.prunedText.includes("[... repeated 10 identical lines omitted ...]"));

    // 3. Truncate oversized output
    const hugeOutput = "X".repeat(10000);
    const prunedHuge = toolPruner.pruneToolResult(hugeOutput, { maxOutputChars: 1000 });
    assert.ok(prunedHuge.prunedText.length <= 1200);
    assert.ok(prunedHuge.prunedText.includes("[... "));

    console.log("\x1b[32m  [✓] Base64 stripping, repeated line collapse, and length truncation verified.\x1b[0m");
  }

  // ── [Test 4/8] Trajectory Compaction & Structured Synthesis ───────────────
  console.log("[Test 4/8] Validating Trajectory Compactor Engine...");
  {
    substrate.clear();
    const turns = [
      { turnIndex: 1, role: "system", content: "You are LUMI agent." },
      { turnIndex: 2, role: "user", content: "Build Flappy Bird game." },
      { turnIndex: 3, role: "assistant", content: "Step 1: Created canvas component. COMPLETED: Initial canvas scaffolded.\n" + "Canvas code details line item.\n".repeat(20) },
      { turnIndex: 4, role: "assistant", content: "Step 2: Added bird physics logic. COMPLETED: Velocity & gravity added.\n" + "Physics calculations applied.\n".repeat(20) },
      { turnIndex: 5, role: "assistant", content: "Step 3: Added obstacle pipes. TODO: Pipe collision detection.\n" + "Pipe obstacle rendering logic.\n".repeat(20) },
      { turnIndex: 6, role: "assistant", content: "Step 4: Added scoring system. COMPLETED: Score counter verified.\n" + "Score increment state updates.\n".repeat(20) },
      { turnIndex: 7, role: "assistant", content: "Step 5: Testing gameplay loop." },
      { turnIndex: 8, role: "assistant", content: "Final Step: Complete game ready." },
      { turnIndex: 9, role: "user", content: "Add sound effects." },
      { turnIndex: 10, role: "assistant", content: "Now implementing audio synthesizer." },
    ];

    const budget = budgetGovernor.calculateBudget(10000);
    const result = compactorEngine.compactTrajectory(turns, budget);

    assert.ok(result.summary, "Summary must be generated for middle turns");
    assert.ok(result.tokensSaved > 0, "Tokens must be saved");
    assert.equal(result.compactedTurns.length, 7, "Compacted turns count must be Head(2) + Summary(1) + Tail(4) = 7");
    assert.equal(result.compactedTurns[2].role, "system");
    assert.ok(result.compactedTurns[2].content.includes("[LUMI-COMPACTED-TRAJECTORY:"));
    assert.ok(result.summary.resolvedGoals.length >= 2, "Resolved goals must be extracted");
    assert.ok(result.summary.pendingGoals.length >= 1, "Pending goals must be extracted");

    console.log("\x1b[32m  [✓] Trajectory middle-turn compaction into structured summary block verified.\x1b[0m");
  }

  // ── [Test 5/8] In-Memory Broccolidb Compression Substrate ──────────────────
  console.log("[Test 5/8] Validating In-Memory Broccolidb Compression Substrate...");
  {
    const all = substrate.listSummaries();
    assert.equal(all.length, 1);
    const latest = substrate.getLatestSummary();
    assert.ok(latest);
    assert.equal(latest.sourceTurnStart, 3);
    assert.equal(latest.sourceTurnEnd, 6);

    console.log("\x1b[32m  [✓] In-memory Broccolidb compression substrate storage and retrieval passed.\x1b[0m");
  }

  // ── [Test 6/8] Frame-Perfect Binary Snapshotting & O(1) Rollback ───────────
  console.log("[Test 6/8] Validating Compression Binary Snapshotting & O(1) Rollback...");
  {
    // Snapshot at frame 20
    const snapshot20 = snapshotManager.createSnapshot(20);
    assert.equal(snapshot20.summaries.length, 1);

    // Mutate state (record 2 extra summaries)
    substrate.recordSummary({
      id: "summary-temp-1",
      sourceTurnStart: 10,
      sourceTurnEnd: 15,
      originalTokens: 2000,
      compressedTokens: 200,
      summaryText: "Temp summary 1",
      resolvedGoals: [],
      pendingGoals: [],
      timestampMs: Date.now(),
    });
    assert.equal(substrate.listSummaries().length, 2);

    // Rollback to frame 20
    const startRollback = performance.now();
    snapshotManager.restoreSnapshot(snapshot20);
    const rollbackDuration = performance.now() - startRollback;

    assert.equal(substrate.listSummaries().length, 1);
    assert.equal(substrate.getSummary("summary-temp-1"), undefined);
    assert.ok(rollbackDuration < 1.0, `Rollback took ${rollbackDuration} ms, must be < 1.0ms`);

    console.log(`\x1b[32m  [✓] Frame-perfect binary snapshotting and O(1) rollback passed (${rollbackDuration.toFixed(3)} ms).\x1b[0m`);
  }

  // ── [Test 7/8] Compression Model Tool Suite Operations ────────────────────
  console.log("[Test 7/8] Validating Compression Model Tool Suite...");
  {
    // 1. context_compress_window
    const compRes = await toolSuite.executeTool("context_compress_window", { currentTokens: 110000 });
    assert.ok(compRes.success, "context_compress_window should succeed");

    // 2. context_prune_tools
    const pruneRes = await toolSuite.executeTool("context_prune_tools", {
      rawOutput: "A".repeat(5000),
      maxChars: 1000,
    });
    assert.ok(pruneRes.success, "context_prune_tools should succeed");

    // 3. context_inspect_budget
    const inspectRes = await toolSuite.executeTool("context_inspect_budget", { totalTokens: 120000 });
    assert.ok(inspectRes.success, "context_inspect_budget should succeed");

    console.log("\x1b[32m  [✓] Model tool operations (compress_window, prune_tools, inspect_budget) passed.\x1b[0m");
  }

  // ── [Test 8/8] Monolith Composition & Pruning Micro-Benchmark ─────────────
  console.log("[Test 8/8] Benchmarking Monolith Composition & High-Frequency Pruning...");
  {
    const monolith = new LumiMonolith({ sessionId: "compression-bench-session" });
    assert.ok(monolith.headTailBudgetGovernor, "headTailBudgetGovernor must be composed");
    assert.ok(monolith.deterministicToolPruner, "deterministicToolPruner must be composed");
    assert.ok(monolith.broccoliCompressionSubstrate, "broccoliCompressionSubstrate must be composed");
    assert.ok(monolith.compressionSnapshotManager, "compressionSnapshotManager must be composed");
    assert.ok(monolith.trajectoryCompactorEngine, "trajectoryCompactorEngine must be composed");
    assert.ok(monolith.compressionToolSuite, "compressionToolSuite must be composed");

    const sampleOutput = `[STDOUT] Scanning dependencies...\n` + `  Processing line item\n`.repeat(50) + `data:image/png;base64,${'Z'.repeat(300)}\nAll items verified.`;

    const iterations = 1000;
    const startBench = performance.now();
    for (let i = 0; i < iterations; i++) {
      monolith.deterministicToolPruner.pruneToolResult(sampleOutput);
    }
    const totalBenchMs = performance.now() - startBench;
    const perPruneUs = (totalBenchMs / iterations) * 1000;

    console.log(`  Measured: ${iterations} tool output prunings in ${totalBenchMs.toFixed(3)} ms (${perPruneUs.toFixed(3)} µs/prune)`);
    assert.ok(totalBenchMs < 10.0, `1,000 prunings took ${totalBenchMs} ms, must be < 10.0ms`);

    console.log("\x1b[32m  [✓] Monolith composition & tool output pruning micro-benchmark passed.\x1b[0m");
  }

  console.log("\n================================================================");
  console.log("   ALL 8 CONTEXT COMPRESSION VALIDATION SUITES PASSED!         ");
  console.log("================================================================\n");
}

main().catch((error) => {
  console.error("Validation failed with error:", error);
  process.exit(1);
});
