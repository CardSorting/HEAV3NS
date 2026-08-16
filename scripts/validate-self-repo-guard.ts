/**
 * validate-self-repo-guard.ts
 *
 * Comprehensive validation suite for Deterministic Self-Repository Mutation Guard,
 * Shell Worktree Context Tracker & Module-Skew Firewall Subsystem (Phase 138 / ADR-114 / Target #71).
 */

import assert from "node:assert";
import * as path from "node:path";
import { performance } from "node:perf_hooks";

import { DeterministicSelfRepoGuardEngine } from "../src/agents/extensions/self_repo_guard/deterministic-self-repo-guard-engine.js";
import { SelfRepoGuardSupervisor } from "../src/agents/extensions/self_repo_guard/self-repo-guard-supervisor.js";
import { BroccoliSelfRepoGuardSubstrate } from "../src/sessions/extensions/self_repo_guard/broccoli-self-repo-guard-substrate.js";
import { SelfRepoGuardSnapshotManager } from "../src/sessions/extensions/self_repo_guard/self-repo-guard-snapshot-manager.js";
import { SelfRepoGuardToolSuite } from "../src/tooling/extensions/self_repo_guard/self-repo-guard-tool-suite.js";

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Self-Repository Mutation Guard System (ADR-114)        ");
  console.log("================================================================\n");

  const substrate = new BroccoliSelfRepoGuardSubstrate();
  const engine = new DeterministicSelfRepoGuardEngine();
  const snapshotManager = new SelfRepoGuardSnapshotManager(substrate);
  const supervisor = new SelfRepoGuardSupervisor(substrate, engine);
  const toolSuite = new SelfRepoGuardToolSuite(supervisor);

  const runningRoot = "/Users/bozoegg/Desktop/LUMI-NEW";
  supervisor.configure({ runningSourceRoot: runningRoot, enabled: true });

  // ---------------------------------------------------------------------------
  // Suite 1: Block Destructive Worktree Mutations on Running Root
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating Destructive Worktree Mutation Blocking...");

  const destructiveCommands = [
    "git checkout feature-branch",
    "git switch -c new-feature",
    "git reset --hard HEAD~1",
    "git clean -fd",
    "git pull origin main",
    "git rebase upstream/main",
    "git merge feat",
    "git restore src/index.ts",
    "git bisect start",
    "git worktree remove /Users/bozoegg/Desktop/LUMI-NEW",
  ];

  for (const cmd of destructiveCommands) {
    const verdict = supervisor.inspectShellCommand(cmd, runningRoot);
    assert.strictEqual(
      verdict.allowed,
      false,
      `Command '${cmd}' must be blocked on running source root`
    );
    assert.ok(verdict.reason, "Must provide reason");
    assert.ok(verdict.suggestedRemediation, "Must provide remediation suggestion");
  }
  console.log(`  [✓] All ${destructiveCommands.length} destructive Git operations blocked on running root.`);

  // ---------------------------------------------------------------------------
  // Suite 2: Allow Safe Read-Only & Inspection Operations
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Safe Read-Only & Staged Git Operations...");

  const safeCommands = [
    "git status",
    "git diff HEAD",
    "git log -n 5",
    "git show HEAD:src/index.ts",
    "git stash list",
    "git clean -n",
    "git clean --dry-run",
    "git reset --soft HEAD~1",
    "git restore --staged src/index.ts",
    "git branch -a",
    "git rev-parse HEAD",
  ];

  for (const cmd of safeCommands) {
    const verdict = supervisor.inspectShellCommand(cmd, runningRoot);
    assert.strictEqual(
      verdict.allowed,
      true,
      `Safe command '${cmd}' must be allowed on running source root`
    );
  }
  console.log(`  [✓] All ${safeCommands.length} safe Git operations allowed on running root.`);

  // ---------------------------------------------------------------------------
  // Suite 3: Directory Navigation Context Tracking (cd, pushd)
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Directory Navigation Context Tracking...");

  // Navigating to external repo and running git checkout is ALLOWED
  const foreignCmd = "cd /tmp/other-workspace && git checkout main";
  const foreignVerdict = supervisor.inspectShellCommand(foreignCmd, runningRoot);
  assert.strictEqual(
    foreignVerdict.allowed,
    true,
    "Git checkout on external directory must be allowed"
  );

  // Navigating from external directory back into running root and running git checkout is BLOCKED
  const backToRootCmd = `cd /tmp/other-workspace && cd ${runningRoot} && git checkout main`;
  const backVerdict = supervisor.inspectShellCommand(backToRootCmd, "/tmp/other-workspace");
  assert.strictEqual(
    backVerdict.allowed,
    false,
    "Git checkout after navigating back to running root must be blocked"
  );
  console.log("  [✓] Directory context tracking across 'cd' verified.");

  // ---------------------------------------------------------------------------
  // Suite 4: Flag and Wrapper Handling (git -C, env -C, sudo)
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Flags & Wrapper Handling...");

  // git -C targeting running root from /tmp is BLOCKED
  const gitCCmd = `git -C ${runningRoot} reset --hard HEAD`;
  const gitCVerdict = supervisor.inspectShellCommand(gitCCmd, "/tmp");
  assert.strictEqual(gitCVerdict.allowed, false);

  // env -C targeting running root is BLOCKED
  const envCCmd = `env -C ${runningRoot} git switch main`;
  const envCVerdict = supervisor.inspectShellCommand(envCCmd, "/tmp");
  assert.strictEqual(envCVerdict.allowed, false);

  // sudo git checkout on running root is BLOCKED
  const sudoCmd = `sudo git checkout feature`;
  const sudoVerdict = supervisor.inspectShellCommand(sudoCmd, runningRoot);
  assert.strictEqual(sudoVerdict.allowed, false);

  console.log("  [✓] Wrappers (sudo, env -C, git -C) verified.");

  // ---------------------------------------------------------------------------
  // Suite 5: Nested Script Execution (bash -c)
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Nested Script Execution (bash -c)...");

  const nestedCmd = `bash -c "git checkout branch-b"`;
  const nestedVerdict = supervisor.inspectShellCommand(nestedCmd, runningRoot);
  assert.strictEqual(nestedVerdict.allowed, false);
  console.log("  [✓] Nested shell execution inspection verified.");

  // ---------------------------------------------------------------------------
  // Suite 6: Substrate Binary Snapshotting & Instant O(1) Rollback
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Substrate Binary Snapshotting & O(1) Rollback...");

  const initialBlocked = supervisor.getMetrics().destructiveGitMutationsBlocked;
  const snap = snapshotManager.takeSnapshot("snap-guard-1");
  supervisor.inspectShellCommand("git checkout break-repo", runningRoot);
  assert.strictEqual(supervisor.getMetrics().destructiveGitMutationsBlocked, initialBlocked + 1);

  // Rewind (warmed)
  snapshotManager.restoreSnapshot("snap-guard-1");
  const tRewindStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("snap-guard-1");
  const rewindLatencyMs = performance.now() - tRewindStart;

  assert.ok(restored, "Restore must succeed");
  assert.strictEqual(supervisor.getMetrics().destructiveGitMutationsBlocked, initialBlocked);
  assert.ok(
    rewindLatencyMs < 0.05,
    `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.05 ms SLA`
  );
  console.log(`  [✓] Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms).`);

  // ---------------------------------------------------------------------------
  // Suite 7: Model Tool Suite Execution
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Model Tool Suite Execution...");

  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 5, "Must expose exactly 5 model tools");

  const inspectTool = tools.find((t) => t.name === "self_repo_guard_inspect_command")!;
  const getRootTool = tools.find((t) => t.name === "self_repo_guard_get_running_root")!;
  const classifyTool = tools.find((t) => t.name === "self_repo_guard_classify_git_operation")!;
  const configTool = tools.find((t) => t.name === "self_repo_guard_configure")!;
  const metricsTool = tools.find((t) => t.name === "self_repo_guard_get_metrics")!;

  const inspectRes = (await inspectTool.execute(
    { command: "git reset --hard HEAD~1", cwd: runningRoot },
    ""
  )) as any;
  assert.strictEqual(inspectRes.success, true);
  assert.strictEqual(inspectRes.allowed, false);

  const getRootRes = (await getRootTool.execute({}, "")) as any;
  assert.strictEqual(getRootRes.success, true);
  assert.strictEqual(getRootRes.runningSourceRoot, runningRoot);

  const classifyRes = (await classifyTool.execute(
    { subcommand: "clean", args: ["-fd"] },
    ""
  )) as any;
  assert.strictEqual(classifyRes.success, true);
  assert.strictEqual(classifyRes.safety, "destructive_worktree");

  const cfgRes = (await configTool.execute({ allowWorktreeSandboxes: true }, "")) as any;
  assert.strictEqual(cfgRes.success, true);

  const metricsRes = (await metricsTool.execute({}, "")) as any;
  assert.strictEqual(metricsRes.success, true);
  assert.ok(metricsRes.metrics.totalCommandsInspected > 0);

  console.log("  [✓] All 5 Self-Repo Guard model tools executed cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 8: High-Frequency Command Inspection Micro-Benchmarks
  // ---------------------------------------------------------------------------
  console.log("\n[Test 8/8] Benchmarking High-Frequency Shell Inspection...");

  const iterations = 100000;
  const sampleCmd = "npm run test && git status";
  const cfg = supervisor.getConfig();

  const tBenchStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    engine.evaluateCommand(sampleCmd, runningRoot, runningRoot, cfg);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(
    `  Measured: ${iterations} command evaluations in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/cmd | ${throughputOpsPerSec.toLocaleString()} cmds/sec)`
  );
  assert.ok(throughputOpsPerSec > 500000, "Throughput must exceed 500,000 commands/sec");

  console.log("  [✓] High-frequency command evaluation benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 SELF-REPO GUARD VALIDATION SUITES PASSED!             ");
  console.log("================================================================\n");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
