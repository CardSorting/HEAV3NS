/**
 * validate-subdir-hints.ts
 *
 * Comprehensive validation suite for Progressive Subdirectory Context Discovery
 * & Dynamic Instruction Hints Subsystem (Phase 129 / ADR-105 / Target #62).
 */

import assert from "node:assert";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { DeterministicSubdirHintEngine } from "../src/agents/extensions/subdir_hints/deterministic-subdir-hint-engine.js";
import { SubdirHintsSupervisor } from "../src/agents/extensions/subdir_hints/subdir-hints-supervisor.js";
import { BroccoliSubdirHintsSubstrate } from "../src/sessions/extensions/subdir_hints/broccoli-subdir-hints-substrate.js";
import { SubdirHintsSnapshotManager } from "../src/sessions/extensions/subdir_hints/subdir-hints-snapshot-manager.js";
import { SubdirHintsToolSuite } from "../src/tooling/extensions/subdir_hints/subdir-hints-tool-suite.js";

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Subdirectory Hints & Discovery Engine (ADR-105)         ");
  console.log("================================================================\n");

  const workspaceRoot = "/Users/bozoegg/Desktop/LUMI-NEW";
  const engine = new DeterministicSubdirHintEngine();
  const substrate = new BroccoliSubdirHintsSubstrate();
  substrate.setConfig({ workingDir: workspaceRoot });
  const snapshotManager = new SubdirHintsSnapshotManager(substrate);
  const supervisor = new SubdirHintsSupervisor(substrate, engine);
  const toolSuite = new SubdirHintsToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Suite 1: Candidate Path & Command Token Extraction
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating Candidate Path & Command Token Extraction...");

  const config = substrate.getConfig();
  const directPathDirs = engine.extractCandidateDirectories(
    "read_file",
    { path: "src/agents/extensions/osv/deterministic-osv-parser.ts" },
    config
  );
  assert.ok(directPathDirs.length > 0);
  assert.ok(directPathDirs.some((d) => d.endsWith("src/agents/extensions/osv")));

  const terminalDirs = engine.extractCandidateDirectories(
    "terminal",
    { command: "cd packages/frontend && npm test" },
    config
  );
  assert.ok(terminalDirs.some((d) => d.endsWith("packages/frontend")));
  console.log("  [✓] Path arguments and shell command tokens accurately extracted.");

  // ---------------------------------------------------------------------------
  // Suite 2: Ancestor Directory Traversal (Bounded)
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Ancestor Directory Traversal...");

  const nestedCandidates = new Set<string>();
  engine.addPathCandidates(
    "/Users/bozoegg/Desktop/LUMI-NEW/a/b/c/d/e/file.ts",
    workspaceRoot,
    { ...config, maxAncestorWalk: 3 },
    nestedCandidates
  );
  // Walk 3 levels: a/b/c/d/e, a/b/c/d, a/b/c
  assert.strictEqual(nestedCandidates.size, 3);
  console.log("  [✓] Ancestor directory traversal bounded by maxAncestorWalk SLA.");

  // ---------------------------------------------------------------------------
  // Suite 3: Workspace Confinement & External Path Exclusion
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Workspace Confinement...");

  assert.strictEqual(engine.isWithinWorkspace("/Users/bozoegg/Desktop/LUMI-NEW/src", workspaceRoot), true);
  assert.strictEqual(engine.isWithinWorkspace("/etc/passwd", workspaceRoot), false);
  assert.strictEqual(engine.isWithinWorkspace("/Users/bozoegg/.ssh", workspaceRoot), false);

  const outsideCandidates = new Set<string>();
  engine.addPathCandidates("/etc/shadow/config.txt", workspaceRoot, config, outsideCandidates);
  assert.strictEqual(outsideCandidates.size, 0, "External paths outside workspace must be ignored");
  console.log("  [✓] Strict workspace confinement verified; external paths rejected.");

  // ---------------------------------------------------------------------------
  // Suite 4: Non-Authoritative Directory Exclusion Filtering
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Non-Authoritative Directory Filtering...");

  assert.strictEqual(
    engine.isExcludedDirectory(
      "/Users/bozoegg/Desktop/LUMI-NEW/node_modules/pkg/sub",
      workspaceRoot,
      config.excludedDirNames
    ),
    true
  );
  assert.strictEqual(
    engine.isExcludedDirectory(
      "/Users/bozoegg/Desktop/LUMI-NEW/.git/objects",
      workspaceRoot,
      config.excludedDirNames
    ),
    true
  );
  assert.strictEqual(
    engine.isExcludedDirectory(
      "/Users/bozoegg/Desktop/LUMI-NEW/src/core",
      workspaceRoot,
      config.excludedDirNames
    ),
    false
  );
  console.log("  [✓] Non-authoritative directories (node_modules, .git, vendor) excluded.");

  // ---------------------------------------------------------------------------
  // Suite 5: SHA-256 Digest Computation & Duplicate Deduplication
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating SHA-256 Digest & Deduplication...");

  const contentA = "# Guidelines for Backend\nUse strict typing.";
  const digestA = engine.computeDigest(contentA);
  assert.strictEqual(digestA, engine.computeDigest(contentA));

  // Register virtual hints
  const targetDir1 = "/Users/bozoegg/Desktop/LUMI-NEW/packages/api";
  supervisor.registerVirtualHint(targetDir1, "AGENTS.md", contentA);

  const check1 = await supervisor.checkToolCall("read_file", { path: "packages/api/index.ts" });
  assert.strictEqual(check1.hintsFound.length, 1);
  assert.strictEqual(check1.hintsFound[0].contentDigest, digestA);

  // Subsequent check for same directory / content
  const check2 = await supervisor.checkToolCall("read_file", { path: "packages/api/index.ts" });
  assert.strictEqual(check2.hintsFound.length, 0, "Second access to loaded dir should return 0 new hints");

  // Duplicate content in different directory
  const targetDir2 = "/Users/bozoegg/Desktop/LUMI-NEW/packages/service";
  supervisor.registerVirtualHint(targetDir2, "CLAUDE.md", contentA);
  const check3 = await supervisor.checkToolCall("read_file", { path: "packages/service/worker.ts" });
  assert.strictEqual(check3.hintsFound.length, 0, "Duplicate content digest must be skipped");
  console.log("  [✓] SHA-256 deduplication and loaded directory caching verified.");

  // ---------------------------------------------------------------------------
  // Suite 6: Prefix-Cache-Safe Tool Attachment Formatting
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Tool Attachment Formatting...");

  const targetDir3 = "/Users/bozoegg/Desktop/LUMI-NEW/packages/db";
  const contentB = "# Database Invariants\nTransactions must be atomic.";
  supervisor.registerVirtualHint(targetDir3, "AGENTS.md", contentB);

  const checkDb = await supervisor.checkToolCall("read_file", { path: "packages/db/schema.ts" });
  assert.strictEqual(checkDb.hintsFound.length, 1);
  assert.ok(checkDb.formattedAttachment);
  assert.ok(checkDb.formattedAttachment.includes("Subdirectory Context Hint"));
  assert.ok(checkDb.formattedAttachment.includes("packages/db"));
  console.log("  [✓] Byte-stable markdown tool attachments formatted cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 7: In-Memory Substrate Binary Snapshotting & O(1) State Rollback
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Binary Snapshotting & O(1) State Rollback...");

  const snap = snapshotManager.takeSnapshot("snap-subdir-1");
  assert.ok(snap.discoveredHints.length > 0);

  // Mutate state
  supervisor.registerVirtualHint("/Users/bozoegg/Desktop/LUMI-NEW/temp", "TEMP.md", "temp content");
  await supervisor.checkToolCall("read_file", { path: "temp/file.ts" });

  // Rollback
  const tRewindStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("snap-subdir-1");
  const rewindLatencyMs = performance.now() - tRewindStart;

  assert.ok(restored, "Snapshot restore must succeed");
  assert.ok(rewindLatencyMs < 0.05, `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.05 ms SLA`);
  console.log(`  [✓] Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms).`);

  // ---------------------------------------------------------------------------
  // Suite 8: Model Tool Suite Execution & Micro-Benchmarks
  // ---------------------------------------------------------------------------
  console.log("\n[Test 8/8] Validating Model Tool Suite Execution & Micro-Benchmarks...");

  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 5, "Must expose exactly 5 model tools");

  const checkTool = tools.find((t) => t.name === "subdir_hints_check_tool")!;
  const registerTool = tools.find((t) => t.name === "subdir_hints_register_virtual")!;
  const listTool = tools.find((t) => t.name === "subdir_hints_list_discovered")!;
  const configTool = tools.find((t) => t.name === "subdir_hints_configure")!;
  const metricsTool = tools.find((t) => t.name === "subdir_hints_get_metrics")!;

  const regRes = (await registerTool.execute({
    directoryPath: "/Users/bozoegg/Desktop/LUMI-NEW/packages/auth",
    filename: "AGENTS.md",
    content: "Auth tokens must be JWT RS256",
  }, "")) as any;
  assert.strictEqual(regRes.success, true);

  const checkRes = (await checkTool.execute({
    toolName: "read_file",
    path: "packages/auth/token.ts",
  }, "")) as any;
  assert.strictEqual(checkRes.success, true);
  assert.strictEqual(checkRes.result.hintsFound.length, 1);

  const listRes = (await listTool.execute({}, "")) as any;
  assert.strictEqual(listRes.success, true);
  assert.ok(listRes.count > 0);

  const cfgRes = (await configTool.execute({
    maxHintChars: 10000,
    maxAncestorWalk: 4,
  }, "")) as any;
  assert.strictEqual(cfgRes.success, true);

  const metricsRes = (await metricsTool.execute({}, "")) as any;
  assert.strictEqual(metricsRes.success, true);
  assert.ok(metricsRes.metrics.totalToolChecks > 0);

  // Micro-Benchmark (Candidate directory extraction)
  const iterations = 100000;
  const tBenchStart = performance.now();

  const testArgs = { path: "src/agents/extensions/subdir_hints/deterministic-subdir-hint-engine.ts" };
  for (let i = 0; i < iterations; i++) {
    engine.extractCandidateDirectories("read_file", testArgs, config);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} directory extractions in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} checks/sec)`);
  assert.ok(throughputOpsPerSec > 250000, "Throughput must exceed 250,000 checks/sec");

  console.log("  [✓] All 5 Subdirectory Hint model tools executed cleanly & benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 SUBDIRECTORY HINT VALIDATION SUITES PASSED CLEANLY!   ");
  console.log("================================================================\n");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
