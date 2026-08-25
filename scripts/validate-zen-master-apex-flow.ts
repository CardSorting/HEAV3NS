/**
 * validate-zen-master-apex-flow.ts
 *
 * Comprehensive Validation Suite for Zen Master Apex Pass:
 * 1. AST Code Structure & Symbol Outlining (get_file_outline)
 * 2. Standard Unified Diff & V4A Patch Application (apply_unified_diff)
 * 3. Batch Multi-File Regex Search & Replace with Dry-Run (batch_replace_regex)
 * 4. Real-Time Turn Telemetry & Execution Profiling (get_turn_execution_profile)
 * 5. Background Process Exit Synchronizer (process_wait_for_exit)
 */

import * as assert from "node:assert";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { MonolithFactory } from "../src/factories/monolith-factory.js";

async function run() {
  console.log("================================================================================");
  console.log(" LUMI Zen Master Apex: Unified Diffs, AST Outlines, Batch Regex & Profiling     ");
  console.log("================================================================================\n");

  const components = MonolithFactory.createEngine();
  const registry = components.toolRegistry;
  const testDir = path.join(process.cwd(), "scratch", "zen-master-test");
  await fs.mkdir(testDir, { recursive: true });

  // --------------------------------------------------------------------------
  // Test 1: AST Code Structure Outlining
  // --------------------------------------------------------------------------
  console.log("[Test 1/5] Validating AST Code Structure Outlining...");
  {
    const sampleFile = path.join(testDir, "calculator.ts");
    await fs.writeFile(
      sampleFile,
      `export interface CalculatorOptions {
  precision: number;
}

export class Calculator {
  public precision: number;

  constructor(opts: CalculatorOptions) {
    this.precision = opts.precision;
  }

  public add(a: number, b: number): number {
    return a + b;
  }

  private format(val: number): string {
    return val.toFixed(this.precision);
  }
}
`,
      "utf8"
    );

    const outlineRes: any = await registry.executeTool(
      "get_file_outline",
      { path: "calculator.ts" },
      testDir
    );

    assert.strictEqual(outlineRes.success, true);
    assert.strictEqual(outlineRes.itemsCount, 2, "Should extract CalculatorOptions interface and Calculator class");
    assert.ok(outlineRes.formattedOutline.includes("CalculatorOptions"));
    assert.ok(outlineRes.formattedOutline.includes("Calculator"));
    assert.ok(outlineRes.formattedOutline.includes("add"));
    assert.ok(outlineRes.formattedOutline.includes("format"));

    console.log("  [✓] AST file outline extracted with methods, interfaces, and line spans.");
  }

  // --------------------------------------------------------------------------
  // Test 2: Standard Unified Diff Patch Application
  // --------------------------------------------------------------------------
  console.log("[Test 2/5] Validating Unified Diff Patch Application...");
  {
    const targetFile = path.join(testDir, "appConfig.ts");
    await fs.writeFile(
      targetFile,
      `export const config = {
  version: "1.0.0",
  mode: "development",
  port: 8080,
};
`,
      "utf8"
    );

    const unifiedDiff = `--- a/appConfig.ts
+++ b/appConfig.ts
@@ -1,5 +1,5 @@
 export const config = {
-  version: "1.0.0",
-  mode: "development",
+  version: "2.0.0",
+  mode: "production",
   port: 8080,
 };
`;

    const patchRes: any = await registry.executeTool(
      "apply_unified_diff",
      { diff: unifiedDiff },
      testDir,
      { executionAuthority: "autonomous" }
    );

    assert.strictEqual(patchRes.success, true);
    assert.strictEqual(patchRes.modifiedFilesCount, 1);

    const updatedContent = await fs.readFile(targetFile, "utf8");
    assert.ok(updatedContent.includes('version: "2.0.0"'));
    assert.ok(updatedContent.includes('mode: "production"'));

    console.log("  [✓] Unified diff parsed and applied atomically.");
  }

  // --------------------------------------------------------------------------
  // Test 3: Batch Multi-File Regex Search & Replace with Dry-Run
  // --------------------------------------------------------------------------
  console.log("[Test 3/5] Validating Batch Multi-File Regex Replacement...");
  {
    const file1 = path.join(testDir, "moduleA.ts");
    const file2 = path.join(testDir, "moduleB.ts");

    await fs.writeFile(file1, `const OLD_PREFIX_A = 100;\nconsole.log(OLD_PREFIX_A);`, "utf8");
    await fs.writeFile(file2, `const OLD_PREFIX_B = 200;\nconsole.log(OLD_PREFIX_B);`, "utf8");

    // Phase 3a: Dry-run check
    const dryRunRes: any = await registry.executeTool(
      "batch_replace_regex",
      {
        find: "OLD_PREFIX",
        replace: "NEW_PREFIX",
        dryRun: true,
      },
      testDir
    );

    assert.strictEqual(dryRunRes.success, true);
    assert.strictEqual(dryRunRes.dryRun, true);
    assert.strictEqual(dryRunRes.totalFilesMatched, 2);
    assert.strictEqual(dryRunRes.totalReplacements, 4);

    // Verify disk was NOT modified during dry-run
    const unmod1 = await fs.readFile(file1, "utf8");
    assert.ok(unmod1.includes("OLD_PREFIX_A"));

    // Phase 3b: Live execution
    const liveRes: any = await registry.executeTool(
      "batch_replace_regex",
      {
        find: "OLD_PREFIX",
        replace: "NEW_PREFIX",
        dryRun: false,
      },
      testDir,
      { executionAuthority: "autonomous" }
    );

    assert.strictEqual(liveRes.success, true);
    assert.strictEqual(liveRes.dryRun, false);

    const mod1 = await fs.readFile(file1, "utf8");
    const mod2 = await fs.readFile(file2, "utf8");
    assert.ok(mod1.includes("NEW_PREFIX_A"));
    assert.ok(mod2.includes("NEW_PREFIX_B"));

    console.log("  [✓] Batch regex preview (dry-run) and live multi-file replacement verified.");
  }

  // --------------------------------------------------------------------------
  // Test 4: Real-Time Turn Telemetry & Execution Profiling
  // --------------------------------------------------------------------------
  console.log("[Test 4/5] Validating Turn Telemetry & Execution Profiling...");
  {
    const profileRes: any = await registry.executeTool(
      "get_turn_execution_profile",
      {},
      testDir
    );

    assert.strictEqual(profileRes.success, true);
    assert.ok(profileRes.executionAuthority);
    assert.ok(profileRes.memoryUsage.heapUsedMB > 0);
    assert.ok(profileRes.fastPathToolsCount >= 10);

    console.log(`  [✓] Turn telemetry verified (Heap: ${profileRes.memoryUsage.heapUsedMB} MB, Fast-Paths: ${profileRes.fastPathToolsCount} tools).`);
  }

  // --------------------------------------------------------------------------
  // Test 5: Process Exit Synchronizer
  // --------------------------------------------------------------------------
  console.log("[Test 5/5] Validating Process Wait Synchronizer...");
  {
    // Spawn simple echo process
    const spawnRes: any = await registry.executeTool(
      "process_spawn",
      { command: "node -e 'console.log(\"ZEN_PROCESS_COMPLETED\"); process.exit(0);'" },
      testDir
    );

    assert.strictEqual(spawnRes.success, true);
    const processId = spawnRes.processId;

    const waitRes: any = await registry.executeTool(
      "process_wait_for_exit",
      { processId, timeoutMs: 4000 },
      testDir
    );

    assert.strictEqual(waitRes.success, true);
    assert.strictEqual(waitRes.exitCode, 0);

    console.log("  [✓] Background process awaited and exited with code 0.");
  }

  // Cleanup testDir
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});

  console.log("\n================================================================================");
  console.log("  [✓] ALL 5/5 ZEN MASTER APEX FLOW SUITES PASSED!  ");
  console.log("================================================================================\n");
}

run().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
