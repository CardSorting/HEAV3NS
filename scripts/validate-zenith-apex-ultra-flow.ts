/**
 * validate-zenith-apex-ultra-flow.ts
 *
 * Comprehensive Validation Suite for Zenith Apex Ultra Pass:
 * 1. Multi-File Atomic Patch Orchestration with Fuzzy Auto-Healing (apply_workspace_edit_plan)
 * 2. High-Throughput Multi-Language Symbol Search (search_codebase_symbols)
 * 3. Safe Sandboxed JavaScript / TypeScript Expression Evaluator (execute_sandboxed_eval)
 * 4. Workspace ASCII File Tree Generation (get_workspace_file_tree)
 * 5. One-Step Turn Mutation Rollbacks (rollback_turn_mutations)
 */

import * as assert from "node:assert";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { MonolithFactory } from "../src/factories/monolith-factory.js";

async function run() {
  console.log("================================================================================");
  console.log(" LUMI Zenith Apex Ultra: Atomic Multi-Patch, Symbols & Sandboxed Evaluation     ");
  console.log("================================================================================\n");

  const components = MonolithFactory.createEngine();
  const registry = components.toolRegistry;
  const testDir = path.join(process.cwd(), "scratch", "zenith-ultra-test");
  await fs.mkdir(testDir, { recursive: true });

  // --------------------------------------------------------------------------
  // Test 1: Multi-File Atomic Patch Orchestration with Fuzzy Auto-Healing
  // --------------------------------------------------------------------------
  console.log("[Test 1/5] Validating Multi-File Atomic Patch with Fuzzy Auto-Healing...");
  {
    const fileA = path.join(testDir, "serviceA.ts");
    const fileB = path.join(testDir, "serviceB.ts");

    await fs.writeFile(
      fileA,
      `export class ServiceA {
    public execute(): void {
        console.log("old service A");
    }
}`,
      "utf8"
    );

    await fs.writeFile(
      fileB,
      `export class ServiceB {
    public run(): void {
        console.log("old service B");
    }
}`,
      "utf8"
    );

    // Plan with indentation mismatch on file B (2 spaces instead of 8)
    const patchPlan = {
      description: "Upgrade services A and B and create service C",
      files: [
        {
          path: "serviceA.ts",
          chunks: [
            {
              target: '        console.log("old service A");',
              replacement: '        console.log("new service A");',
            },
          ],
        },
        {
          path: "serviceB.ts",
          chunks: [
            {
              target: '  console.log("old service B");',
              replacement: '        console.log("new service B");',
            },
          ],
        },
      ],
      createFiles: [
        {
          path: "serviceC.ts",
          content: 'export class ServiceC { public active = true; }',
        },
      ],
    };

    const res: any = await registry.executeTool(
      "apply_workspace_edit_plan",
      { planJson: JSON.stringify(patchPlan) },
      testDir,
      { executionAuthority: "autonomous" }
    );

    assert.strictEqual(res.success, true, "Atomic patch plan should succeed");
    assert.strictEqual(res.modifiedFilesCount, 2, "Should modify 2 files");
    assert.strictEqual(res.createdFilesCount, 1, "Should create 1 file");
    assert.ok(res.autoHealedChunksCount >= 1, "Should auto-heal fuzzy chunk on service B");

    const contentA = await fs.readFile(fileA, "utf8");
    const contentB = await fs.readFile(fileB, "utf8");
    const contentC = await fs.readFile(path.join(testDir, "serviceC.ts"), "utf8");

    assert.ok(contentA.includes("new service A"));
    assert.ok(contentB.includes("new service B"));
    assert.ok(contentC.includes("ServiceC"));

    console.log("  [✓] Multi-file atomic patch with in-memory fuzzy healing verified.");
  }

  // --------------------------------------------------------------------------
  // Test 2: High-Throughput Codebase Symbol Search
  // --------------------------------------------------------------------------
  console.log("[Test 2/5] Validating Codebase Symbol Search...");
  {
    const symRes: any = await registry.executeTool(
      "search_codebase_symbols",
      { query: "Service", kind: "class" },
      testDir,
      { executionAuthority: "autonomous" }
    );

    assert.strictEqual(symRes.success, true);
    assert.ok(symRes.totalFound >= 3, "Should find ServiceA, ServiceB, ServiceC");
    const names = symRes.symbols.map((s: any) => s.name);
    assert.ok(names.includes("ServiceA"));
    assert.ok(names.includes("ServiceB"));
    assert.ok(names.includes("ServiceC"));

    console.log(`  [✓] Fast symbol scanner located ${symRes.totalFound} matching class symbols.`);
  }

  // --------------------------------------------------------------------------
  // Test 3: Safe Sandboxed Expression Evaluation
  // --------------------------------------------------------------------------
  console.log("[Test 3/5] Validating Sandboxed Expression Evaluation...");
  {
    const evalRes: any = await registry.executeTool(
      "execute_sandboxed_eval",
      {
        code: `const arr = [10, 20, 30, 40];
console.log("Processing array:", arr.length);
arr.map(x => x * 2).reduce((a, b) => a + b, 0);`,
      },
      testDir
    );

    assert.strictEqual(evalRes.success, true);
    assert.strictEqual(evalRes.result, 200, "Math calculation should equal 200");
    assert.ok(evalRes.stdout.includes("Processing array: 4"), "Stdout should be captured");

    // Timeout guard check
    const timeoutRes: any = await registry.executeTool(
      "execute_sandboxed_eval",
      {
        code: "while(true) {}",
        timeoutMs: 100,
      },
      testDir
    );
    assert.strictEqual(timeoutRes.success, false, "Infinite loop should be stopped by timeout guard");

    console.log("  [✓] Sandboxed expression evaluation and timeout guard verified.");
  }

  // --------------------------------------------------------------------------
  // Test 4: Workspace File Tree Generation
  // --------------------------------------------------------------------------
  console.log("[Test 4/5] Validating Workspace File Tree Generation...");
  {
    const treeRes: any = await registry.executeTool(
      "get_workspace_file_tree",
      { maxDepth: 2 },
      testDir
    );

    assert.strictEqual(treeRes.success, true);
    assert.ok(treeRes.tree.includes("serviceA.ts"));
    assert.ok(treeRes.tree.includes("serviceB.ts"));
    assert.ok(treeRes.tree.includes("serviceC.ts"));
    assert.ok(treeRes.totalEntries >= 3);

    console.log(`  [✓] ASCII file tree generated with ${treeRes.totalEntries} entries.`);
  }

  // --------------------------------------------------------------------------
  // Test 5: One-Step Turn Mutation Rollback
  // --------------------------------------------------------------------------
  console.log("[Test 5/5] Validating One-Step Turn Mutation Rollback...");
  {
    const rollbackFile = path.join(testDir, "rollbackTarget.ts");
    await fs.writeFile(rollbackFile, "const state = 'initial';", "utf8");

    // Set turn
    registry.journal.setTurnId("turn_test_rollback");

    await registry.executeTool(
      "write_file",
      { path: "rollbackTarget.ts", content: "const state = 'mutated_in_turn';" },
      testDir,
      { executionAuthority: "autonomous" }
    );

    const checkMutated = await fs.readFile(rollbackFile, "utf8");
    assert.strictEqual(checkMutated, "const state = 'mutated_in_turn';");

    // Rollback turn
    const rollbackRes: any = await registry.executeTool(
      "rollback_turn_mutations",
      { turnId: "turn_test_rollback" },
      testDir
    );

    assert.strictEqual(rollbackRes.success, true);
    assert.strictEqual(rollbackRes.rolledBackCount, 1);

    const checkRestored = await fs.readFile(rollbackFile, "utf8");
    assert.strictEqual(checkRestored, "const state = 'initial';", "File must be restored to pre-mutation state");

    console.log("  [✓] One-step turn rollback successfully restored mutated file state.");
  }

  // Cleanup testDir
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});

  console.log("\n================================================================================");
  console.log("  [✓] ALL 5/5 ZENITH APEX ULTRA FLOW SUITES PASSED!  ");
  console.log("================================================================================\n");
}

run().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
