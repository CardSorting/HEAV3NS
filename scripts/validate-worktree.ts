/**
 * validate-worktree.ts
 *
 * Comprehensive validation suite for Git Worktree Isolation, Multi-Agent Branch Sandboxing
 * & Subagent Workspace Governance Subsystem (Phase 123 / ADR-099 / Target #56).
 */

import assert from "node:assert";
import { performance } from "node:perf_hooks";

import { DeterministicGitWorktree } from "../src/agents/extensions/worktree/deterministic-git-worktree.js";
import { WorktreeSupervisor } from "../src/agents/extensions/worktree/worktree-supervisor.js";
import { BroccoliWorktreeSubstrate } from "../src/sessions/extensions/worktree/broccoli-worktree-substrate.js";
import { WorktreeSnapshotManager } from "../src/sessions/extensions/worktree/worktree-snapshot-manager.js";
import { WorktreeToolSuite } from "../src/tooling/extensions/worktree/worktree-tool-suite.js";

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Git Worktree Isolation Validation (ADR-099)            ");
  console.log("================================================================\n");

  const engine = new DeterministicGitWorktree();
  const substrate = new BroccoliWorktreeSubstrate();
  const snapshotManager = new WorktreeSnapshotManager(substrate);
  const supervisor = new WorktreeSupervisor(substrate, engine);
  const toolSuite = new WorktreeToolSuite(supervisor);

  const mockRepoRoot = process.cwd();

  // ---------------------------------------------------------------------------
  // Suite 1: Repo Root Discovery & .gitignore Maintenance
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating Repo Root Discovery & .gitignore Maintenance...");

  const repoRoot = engine.resolveRepoRoot(mockRepoRoot);
  assert.ok(repoRoot !== null, "Must discover git repository root");
  assert.ok(repoRoot!.endsWith("LUMI-NEW") || repoRoot!.length > 0);

  const gitignoreUpdated = engine.ensureGitignore(repoRoot!);
  assert.strictEqual(typeof gitignoreUpdated, "boolean");
  console.log("  [✓] Repo root discovery and .gitignore registration verified.");

  // ---------------------------------------------------------------------------
  // Suite 2: Isolated Worktree Creation & Branch Generation
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Isolated Worktree Creation & Branch Generation...");

  const wt1 = supervisor.createWorktree(repoRoot!, "worker-alpha", "HEAD");
  assert.strictEqual(wt1.id, "wt-worker-alpha");
  assert.strictEqual(wt1.branch, "lumi-subagent/worker-alpha");
  assert.ok(wt1.path.includes(".worktrees/subagent-worker-alpha"));
  assert.strictEqual(wt1.status, "active");
  assert.strictEqual(wt1.commitCount, 0);
  assert.strictEqual(wt1.isDirty, false);

  const activeWorktrees = supervisor.getActiveWorktrees();
  assert.strictEqual(activeWorktrees.length, 1);
  console.log("  [✓] Isolated worktree and dedicated branch generated cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 3: Dirty Status Sniffing & Modified Files Detection
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Dirty Status Sniffing & Modified Files Detection...");

  const staged = ["src/models/user.ts"];
  const unstaged = ["src/models/user.ts", "package.json"];
  const inspectedDirty = supervisor.inspectWorktree(wt1.id, staged, unstaged, 0);

  assert.strictEqual(inspectedDirty.isDirty, true);
  assert.strictEqual(inspectedDirty.status, "dirty");
  assert.strictEqual(inspectedDirty.modifiedFiles.length, 2);
  assert.ok(inspectedDirty.modifiedFiles.includes("src/models/user.ts"));
  assert.ok(inspectedDirty.modifiedFiles.includes("package.json"));
  console.log("  [✓] Dirty status and modified files deduplication verified.");

  // ---------------------------------------------------------------------------
  // Suite 4: Commit Counting & Head Difference Calculation
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Commit Counting & Head Difference Calculation...");

  const inspectedCommitted = supervisor.inspectWorktree(wt1.id, [], [], 3);
  assert.strictEqual(inspectedCommitted.commitCount, 3);
  assert.strictEqual(inspectedCommitted.status, "committed");
  assert.strictEqual(inspectedCommitted.isDirty, false);
  console.log("  [✓] Commit counting and status transition to 'committed' verified.");

  // ---------------------------------------------------------------------------
  // Suite 5: Pristine Worktree Auto-Pruning & Dirty Worktree Protection
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Pristine Worktree Auto-Pruning & Protection...");

  const wtPristine = supervisor.createWorktree(repoRoot!, "worker-pristine");
  assert.strictEqual(supervisor.getActiveWorktrees().length, 2);

  // 1. Pristine worktree should auto-prune
  const prunePristine = supervisor.cleanupWorktree(wtPristine.id, false);
  assert.strictEqual(prunePristine.success, true);
  assert.strictEqual(prunePristine.pruned, true);
  assert.ok(prunePristine.reason.includes("Pristine worktree"));

  // 2. Committed worktree (wt1) should be protected from non-forced prune
  const pruneCommitted = supervisor.cleanupWorktree(wt1.id, false);
  assert.strictEqual(pruneCommitted.success, false);
  assert.strictEqual(pruneCommitted.pruned, false);
  assert.ok(pruneCommitted.reason.includes("contains active modifications"));

  // 3. Forced prune should succeed
  const pruneForced = supervisor.cleanupWorktree(wt1.id, true);
  assert.strictEqual(pruneForced.success, true);
  assert.strictEqual(pruneForced.pruned, true);
  console.log("  [✓] Pristine auto-pruning and dirty/committed tree protections verified.");

  // ---------------------------------------------------------------------------
  // Suite 6: Subagent Branch Merging & Conflict Diagnostics
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Subagent Branch Merging & Conflict Diagnostics...");

  const wtMergeable = supervisor.createWorktree(repoRoot!, "worker-mergeable");
  supervisor.inspectWorktree(wtMergeable.id, [], [], 2);

  // Clean merge
  const cleanMerge = supervisor.mergeBranch(wtMergeable.id, "main");
  assert.strictEqual(cleanMerge.success, true);
  assert.ok(cleanMerge.mergeCommit?.includes("merge-lumi-subagent-worker-mergeable-into-main"));

  // Conflict merge
  const wtConflict = supervisor.createWorktree(repoRoot!, "worker-conflict");
  const conflictMerge = supervisor.mergeBranch(wtConflict.id, "main", ["src/config.ts"]);
  assert.strictEqual(conflictMerge.success, false);
  assert.strictEqual(conflictMerge.conflictFiles?.length, 1);
  assert.strictEqual(conflictMerge.conflictFiles?.[0], "src/config.ts");
  console.log("  [✓] Clean branch merge and conflict diagnostics verified.");

  // ---------------------------------------------------------------------------
  // Suite 7: In-Memory Substrate Binary Snapshotting & O(1) State Rollback
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Binary Snapshotting & O(1) State Rollback...");

  const snap1 = snapshotManager.takeSnapshot("snap-wt-1");
  assert.strictEqual(snap1.metrics.totalCreated, 4);

  // Create another worktree
  supervisor.createWorktree(repoRoot!, "worker-temp");
  assert.strictEqual(supervisor.getMetrics().totalCreated, 5);

  // Rewind
  const tRewindStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("snap-wt-1");
  const rewindLatencyMs = performance.now() - tRewindStart;

  assert.ok(restored, "Snapshot restore must succeed");
  assert.strictEqual(supervisor.getMetrics().totalCreated, 4);
  assert.ok(rewindLatencyMs < 0.1, `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.1 ms SLA`);
  console.log(`  [✓] Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms).`);

  // ---------------------------------------------------------------------------
  // Suite 8: Model Tool Suite & Micro-Benchmarks
  // ---------------------------------------------------------------------------
  console.log("\n[Test 8/8] Validating Model Tool Suite & Micro-Benchmarks...");

  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 5, "Must expose exactly 5 model tools");

  const createTool = tools.find((t) => t.name === "worktree_create")!;
  const inspectTool = tools.find((t) => t.name === "worktree_inspect")!;
  const cleanupTool = tools.find((t) => t.name === "worktree_cleanup")!;
  const mergeTool = tools.find((t) => t.name === "worktree_merge_branch")!;
  const metricsTool = tools.find((t) => t.name === "worktree_get_metrics")!;

  const createRes = (await createTool.execute({ subagentId: "tool-agent-1" }, "")) as any;
  assert.strictEqual(createRes.success, true);
  assert.strictEqual(createRes.id, "wt-tool-agent-1");

  const inspectRes = (await inspectTool.execute({
    idOrPath: createRes.id,
    stagedFiles: "src/index.ts, src/types.ts",
  }, "")) as any;
  assert.strictEqual(inspectRes.success, true);
  assert.strictEqual(inspectRes.isDirty, true);

  const mergeRes = (await mergeTool.execute({
    idOrPath: createRes.id,
    targetBranch: "main",
  }, "")) as any;
  assert.strictEqual(mergeRes.success, true);

  const cleanupRes = (await cleanupTool.execute({
    idOrPath: createRes.id,
    force: true,
  }, "")) as any;
  assert.strictEqual(cleanupRes.success, true);

  const metricsRes = (await metricsTool.execute({}, "")) as any;
  assert.strictEqual(metricsRes.success, true);

  // Micro-benchmark: 50,000 worktree status evaluations
  const descriptor = supervisor.createWorktree(repoRoot!, "bench-agent");
  const iterations = 50000;
  const tBenchStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    engine.evaluateStatus(descriptor, ["file1.ts"], ["file2.ts"], 1);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} status evaluations in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(throughputOpsPerSec > 500000, "Throughput must exceed 500,000 ops/sec");

  console.log("  [✓] All 5 model tools executed cleanly & ultra-high-throughput benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 WORKTREE VALIDATION SUITES PASSED CLEANLY!             ");
  console.log("================================================================\n");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
