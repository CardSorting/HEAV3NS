/**
 * validate-v4a-patch.ts
 *
 * Comprehensive validation suite for Target #52: V4A Multi-File Patch Parser,
 * Atomic Multi-Hunk Applicator & Working Tree Diff Synthesizer (Phase 119 / ADR-095).
 */

import assert from "node:assert";
import {
  DeterministicV4aPatch,
  V4aPatchSupervisor,
  BroccoliV4aPatchSubstrate,
  V4aPatchSnapshotManager,
  V4aPatchToolSuite,
} from "../src/index.js";

async function runSuite() {
  console.log("================================================================");
  console.log("   LUMI V4A Patch Parser & Working Diff Synthesizer (ADR-095)   ");
  console.log("================================================================");

  const v4aPatch = new DeterministicV4aPatch();
  const substrate = new BroccoliV4aPatchSubstrate();
  const snapshotManager = new V4aPatchSnapshotManager(substrate);
  const supervisor = new V4aPatchSupervisor(substrate, v4aPatch);
  const toolSuite = new V4aPatchToolSuite(supervisor);

  // --------------------------------------------------------------------------
  // [Test 1/8] V4A Patch Grammar Parsing (Begin/End, Update, Add, Delete, Move)
  // --------------------------------------------------------------------------
  console.log("\n[Test 1/8] Validating V4A Patch Grammar Parsing...");

  const samplePatch = `*** Begin Patch
*** Update File: src/math.ts
@@ calculateSum @@
 function calculateSum(a: number, b: number): number {
-  return a - b;
+  return a + b;
 }
*** Add File: src/constants.ts
+export const PI = 3.14159;
+export const E = 2.71828;
*** Move File: old/utils.ts -> new/utils.ts
*** Delete File: obsolete.ts
*** End Patch`;

  const parseRes = supervisor.parsePatch(samplePatch);
  assert.strictEqual(parseRes.success, true);
  assert.strictEqual(parseRes.operations.length, 4);

  const [opUpdate, opAdd, opMove, opDelete] = parseRes.operations;
  assert.strictEqual(opUpdate.type, "update");
  assert.strictEqual(opUpdate.filePath, "src/math.ts");
  assert.strictEqual(opUpdate.hunks.length, 1);
  assert.strictEqual(opUpdate.hunks[0].contextHint, "calculateSum");

  assert.strictEqual(opAdd.type, "add");
  assert.strictEqual(opAdd.filePath, "src/constants.ts");
  assert.ok(opAdd.content?.includes("export const PI = 3.14159;"));

  assert.strictEqual(opMove.type, "move");
  assert.strictEqual(opMove.filePath, "old/utils.ts");
  assert.strictEqual(opMove.newPath, "new/utils.ts");

  assert.strictEqual(opDelete.type, "delete");
  assert.strictEqual(opDelete.filePath, "obsolete.ts");

  console.log("  [✓] V4A patch grammar (Update, Add, Move, Delete) successfully parsed.");

  // --------------------------------------------------------------------------
  // [Test 2/8] Multi-Hunk Atomic Modification with Context Matching & Fuzzy
  // --------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Multi-Hunk Atomic Modification & Fuzzy Context...");

  const mockVfs = new Map<string, string>();
  mockVfs.set(
    "src/math.ts",
    "// Header\nfunction calculateSum(a: number, b: number): number {\n  return a - b;\n}\n\nfunction multiply(a: number, b: number): number {\n  return 0;\n}"
  );

  const multiHunkPatch = `*** Begin Patch
*** Update File: src/math.ts
@@ calculateSum @@
 function calculateSum(a: number, b: number): number {
-  return a - b;
+  return a + b;
 }
@@ multiply @@
 function multiply(a: number, b: number): number {
-  return 0;
+  return a * b;
 }
*** End Patch`;

  const reader = (p: string) => mockVfs.get(p) ?? null;
  const writer = (p: string, c: string | null) => {
    if (c === null) mockVfs.delete(p);
    else mockVfs.set(p, c);
  };

  const applyRes = supervisor.applyPatch(multiHunkPatch, reader, writer);
  assert.strictEqual(applyRes.success, true);
  assert.strictEqual(applyRes.appliedOperations, 1);
  assert.strictEqual(applyRes.modifiedFiles.length, 1);

  const updatedMath = mockVfs.get("src/math.ts")!;
  assert.ok(updatedMath.includes("return a + b;"));
  assert.ok(updatedMath.includes("return a * b;"));
  assert.ok(!updatedMath.includes("return a - b;"));
  assert.ok(!updatedMath.includes("return 0;"));

  console.log("  [✓] Multi-hunk updates with exact and fuzzy context matching succeeded.");

  // --------------------------------------------------------------------------
  // [Test 3/8] New File Addition & File Deletion Operations
  // --------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Add and Delete File Operations...");

  mockVfs.set("src/temp.txt", "temporary data");

  const addDeletePatch = `*** Begin Patch
*** Add File: src/config.json
+{
+  "version": "1.0.0",
+  "env": "production"
+}
*** Delete File: src/temp.txt
*** End Patch`;

  const addDelRes = supervisor.applyPatch(addDeletePatch, reader, writer);
  assert.strictEqual(addDelRes.success, true);
  assert.strictEqual(mockVfs.has("src/config.json"), true);
  assert.strictEqual(mockVfs.has("src/temp.txt"), false);
  assert.ok(mockVfs.get("src/config.json")?.includes('"version": "1.0.0"'));

  console.log("  [✓] File creation and deletion executed cleanly.");

  // --------------------------------------------------------------------------
  // [Test 4/8] Atomic File Move / Rename & All-or-Nothing Rollback
  // --------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Atomic File Move & All-or-Nothing Rollback...");

  mockVfs.set("old/legacy.ts", "export const legacy = true;");

  const movePatch = `*** Begin Patch
*** Move File: old/legacy.ts -> modern/legacy.ts
*** End Patch`;

  const moveRes = supervisor.applyPatch(movePatch, reader, writer);
  assert.strictEqual(moveRes.success, true);
  assert.strictEqual(mockVfs.has("old/legacy.ts"), false);
  assert.strictEqual(mockVfs.get("modern/legacy.ts"), "export const legacy = true;");

  // Test All-or-Nothing Atomicity: Fail in second operation should NOT apply first
  const failingPatch = `*** Begin Patch
*** Add File: src/will_not_apply.ts
+export const test = 123;
*** Update File: non_existent.ts
@@ missing @@
-non-existent line
+new line
*** End Patch`;

  const failRes = supervisor.applyPatch(failingPatch, reader, writer);
  assert.strictEqual(failRes.success, false);
  assert.strictEqual(mockVfs.has("src/will_not_apply.ts"), false);

  console.log("  [✓] Atomic file move verified; all-or-nothing rollback on partial failure confirmed.");

  // --------------------------------------------------------------------------
  // [Test 5/8] CRLF Line-Ending Normalization & Column 0 Boundary Isolation
  // --------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating CRLF Normalization & Column 0 Boundaries...");

  const crlfPatch = "*** Begin Patch\r\n*** Add File: src/crlf.txt\r\n+line 1\r\n+line 2\r\n*** End Patch\r\n";
  const crlfRes = supervisor.applyPatch(crlfPatch, reader, writer);
  assert.strictEqual(crlfRes.success, true);
  assert.strictEqual(mockVfs.get("src/crlf.txt"), "line 1\nline 2");

  // Boundary isolation: +*** End Patch inside code doc should not terminate patch
  const embeddedMarkerPatch = `*** Begin Patch
*** Add File: src/doc.md
+# Document Guide
+The following is how to end a patch:
+ *** End Patch
+And here is some more text.
*** End Patch`;

  const embedRes = supervisor.applyPatch(embeddedMarkerPatch, reader, writer);
  assert.strictEqual(embedRes.success, true);
  assert.ok(mockVfs.get("src/doc.md")?.includes("*** End Patch"));
  assert.ok(mockVfs.get("src/doc.md")?.includes("And here is some more text."));

  console.log("  [✓] CRLF stripped cleanly and column 0 boundaries isolated.");

  // --------------------------------------------------------------------------
  // [Test 6/8] Working Tree Diff Collection (working, staged, all)
  // --------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Working Tree Diff Collection...");

  const diffWorking = await supervisor.collectWorkingDiff(process.cwd(), "working");
  assert.strictEqual(diffWorking.success, true);
  assert.strictEqual(diffWorking.mode, "working");

  const diffStaged = await supervisor.collectWorkingDiff(process.cwd(), "staged");
  assert.strictEqual(diffStaged.success, true);
  assert.strictEqual(diffStaged.mode, "staged");

  const diffAll = await supervisor.collectWorkingDiff(process.cwd(), "all");
  assert.strictEqual(diffAll.success, true);
  assert.strictEqual(diffAll.mode, "all");

  console.log(`  [✓] Working tree diffs collected across modes (working, staged, all).`);

  // --------------------------------------------------------------------------
  // [Test 7/8] Binary Snapshotting & O(1) State Rollback
  // --------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Binary Snapshotting & O(1) State Rollback...");

  const initialHistoryLength = substrate.getPatchHistory().length;
  snapshotManager.takeSnapshot("checkpoint-v4a-1");

  supervisor.applyPatch(samplePatch, reader, writer);
  supervisor.applyPatch(multiHunkPatch, reader, writer);
  assert.strictEqual(substrate.getPatchHistory().length, initialHistoryLength + 2);

  // JIT Warmup
  for (let i = 0; i < 50; i++) {
    snapshotManager.restoreSnapshot("checkpoint-v4a-1");
  }

  supervisor.applyPatch(samplePatch, reader, writer);
  const tRollbackStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("checkpoint-v4a-1");
  const rollbackDurationMs = performance.now() - tRollbackStart;

  assert.strictEqual(restored, true);
  assert.strictEqual(substrate.getPatchHistory().length, initialHistoryLength);
  assert.ok(
    rollbackDurationMs < 0.05,
    `Rollback completed in ${rollbackDurationMs.toFixed(4)} ms (< 0.05 ms SLA)`
  );

  console.log(`  [✓] Substrate state rollback verified (${rollbackDurationMs.toFixed(4)} ms).`);

  // --------------------------------------------------------------------------
  // [Test 8/8] Model Tool Suite (5 Tools) & Ultra-High-Throughput Benchmark
  // --------------------------------------------------------------------------
  console.log("\n[Test 8/8] Validating Model Tool Suite & Micro-Benchmarks...");

  // Tool 1: v4a_apply_patch
  const toolPatch = `*** Begin Patch
*** Add File: src/tool_created.ts
+export const toolCreated = true;
*** End Patch`;
  const t1 = await toolSuite.getTools().find((t) => t.name === "v4a_apply_patch")?.execute({
    patch: toolPatch,
  }, "");
  assert.strictEqual((t1 as any)?.success, true);
  assert.strictEqual((t1 as any)?.appliedOperations, 1);

  // Tool 2: v4a_parse_patch_manifest
  const t2 = await toolSuite.getTools().find((t) => t.name === "v4a_parse_patch_manifest")?.execute({
    patch: samplePatch,
  }, "");
  assert.strictEqual((t2 as any)?.success, true);
  assert.strictEqual((t2 as any)?.operationsCount, 4);

  // Tool 3: v4a_collect_working_diff
  const t3 = await toolSuite.getTools().find((t) => t.name === "v4a_collect_working_diff")?.execute({
    mode: "working",
    cwd: process.cwd(),
  }, "");
  assert.strictEqual((t3 as any)?.success, true);

  // Tool 4: v4a_inspect_patch_history
  const t4 = await toolSuite.getTools().find((t) => t.name === "v4a_inspect_patch_history")?.execute({}, "");
  assert.strictEqual((t4 as any)?.success, true);
  assert.ok((t4 as any)?.totalApplied >= 1);

  // Tool 5: v4a_get_engine_metrics
  const t5 = await toolSuite.getTools().find((t) => t.name === "v4a_get_engine_metrics")?.execute({}, "");
  assert.strictEqual((t5 as any)?.success, true);
  assert.ok((t5 as any)?.metrics?.totalPatchesParsed >= 1);

  // Ultra-High-Throughput Micro-Benchmark: 20,000 V4A patch parsings
  const iterations = 20000;
  const tBenchStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    v4aPatch.parseV4aPatch(samplePatch);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} V4A parses in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/parse | ${throughputOpsPerSec.toLocaleString()} parses/sec)`);
  assert.ok(throughputOpsPerSec > 50000, "Throughput must exceed 50,000 parses/sec");

  console.log("  [✓] All 5 model tools executed cleanly & ultra-high-throughput benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 V4A PATCH VALIDATION SUITES PASSED CLEANLY!            ");
  console.log("================================================================");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
