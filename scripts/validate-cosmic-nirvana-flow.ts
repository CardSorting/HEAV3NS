/**
 * validate-cosmic-nirvana-flow.ts
 *
 * Comprehensive Validation Suite for Cosmic Nirvana Pass:
 * 1. Multi-File Symbol Refactoring & Renaming (rename_symbol_across_codebase)
 * 2. In-Memory Working-Tree Stash Management (manage_workspace_stash)
 * 3. In-Memory Workspace Environment Probe (probe_workspace_environment)
 * 4. Dependency Matrix & Topological Orderer (generate_dependency_matrix)
 * 5. Dynamic Tool Cache Invalidator (invalidate_tool_cache)
 */

import * as assert from "node:assert";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { MonolithFactory } from "../src/factories/monolith-factory.js";

async function run() {
  console.log("================================================================================");
  console.log(" LUMI Cosmic Nirvana: Renamer, Stashes, Environment & Dependency Graph          ");
  console.log("================================================================================\n");

  const components = MonolithFactory.createEngine();
  const registry = components.toolRegistry;
  const testDir = path.join(process.cwd(), "scratch", "cosmic-nirvana-test");
  await fs.mkdir(testDir, { recursive: true });

  // --------------------------------------------------------------------------
  // Test 1: Workspace-Wide Symbol Refactoring & Renaming
  // --------------------------------------------------------------------------
  console.log("[Test 1/5] Validating Workspace-Wide Symbol Refactoring & Renaming...");
  {
    const fileA = path.join(testDir, "legacyService.ts");
    const fileB = path.join(testDir, "mainApp.ts");

    await fs.writeFile(fileA, `export class OldLegacyManager {\n  public run() {}\n}\n`, "utf8");
    await fs.writeFile(fileB, `import { OldLegacyManager } from './legacyService';\nconst mgr = new OldLegacyManager();\n`, "utf8");

    // Dry run preview
    const dryRes: any = await registry.executeTool(
      "rename_symbol_across_codebase",
      { oldName: "OldLegacyManager", newName: "ZenithManager", dryRun: true },
      testDir
    );
    assert.strictEqual(dryRes.success, true);
    assert.strictEqual(dryRes.dryRun, true);
    assert.strictEqual(dryRes.totalFilesModified, 2);
    assert.strictEqual(dryRes.totalOccurrencesReplaced, 3);

    // Live refactoring
    const liveRes: any = await registry.executeTool(
      "rename_symbol_across_codebase",
      { oldName: "OldLegacyManager", newName: "ZenithManager", dryRun: false },
      testDir
    );
    assert.strictEqual(liveRes.success, true);
    assert.strictEqual(liveRes.dryRun, false);

    const contentA = await fs.readFile(fileA, "utf8");
    const contentB = await fs.readFile(fileB, "utf8");
    assert.ok(contentA.includes("export class ZenithManager"));
    assert.ok(contentB.includes("import { ZenithManager } from './legacyService'"));
    assert.ok(contentB.includes("const mgr = new ZenithManager()"));

    console.log("  [✓] Multi-file refactor atomically replaced 'OldLegacyManager' -> 'ZenithManager' across 2 files.");
  }

  // --------------------------------------------------------------------------
  // Test 2: In-Memory Workspace Stash Management
  // --------------------------------------------------------------------------
  console.log("[Test 2/5] Validating In-Memory Working-Tree Stash Management...");
  {
    const stashFile = path.join(testDir, "stashTest.ts");
    await fs.writeFile(stashFile, "const initialVal = 100;", "utf8");

    // Save stash
    const saveRes: any = await registry.executeTool(
      "manage_workspace_stash",
      { action: "save", paths: ["stashTest.ts"], message: "WIP feature" },
      testDir
    );
    assert.strictEqual(saveRes.success, true);
    assert.strictEqual(saveRes.fileCount, 1);
    const stashId = saveRes.stashId;

    // Mutate file
    await fs.writeFile(stashFile, "const initialVal = 999;", "utf8");
    assert.strictEqual(await fs.readFile(stashFile, "utf8"), "const initialVal = 999;");

    // List stashes
    const listRes: any = await registry.executeTool("manage_workspace_stash", { action: "list" }, testDir);
    assert.strictEqual(listRes.success, true);
    assert.ok(listRes.totalStashes >= 1);

    // Pop stash
    const popRes: any = await registry.executeTool(
      "manage_workspace_stash",
      { action: "pop", stashId },
      testDir
    );
    assert.strictEqual(popRes.success, true);
    assert.strictEqual(popRes.restoredCount, 1);
    assert.strictEqual(await fs.readFile(stashFile, "utf8"), "const initialVal = 100;");

    console.log("  [✓] Stash save, list, and pop restored working-tree content seamlessly.");
  }

  // --------------------------------------------------------------------------
  // Test 3: Workspace Environment Probe
  // --------------------------------------------------------------------------
  console.log("[Test 3/5] Validating Workspace Environment Probe...");
  {
    const envRes: any = await registry.executeTool(
      "probe_workspace_environment",
      {},
      testDir
    );

    assert.strictEqual(envRes.success, true);
    assert.ok(envRes.nodeVersion.startsWith("v"));
    assert.ok(typeof envRes.pid === "number");
    assert.ok(envRes.platform.length > 0);

    console.log(`  [✓] Environment probe detected Node ${envRes.nodeVersion} on ${envRes.platform} (${envRes.arch}).`);
  }

  // --------------------------------------------------------------------------
  // Test 4: Dependency Matrix & Topological Order
  // --------------------------------------------------------------------------
  console.log("[Test 4/5] Validating Codebase Dependency Matrix Generator...");
  {
    const depDir = path.join(testDir, "modules");
    await fs.mkdir(depDir, { recursive: true });

    await fs.writeFile(path.join(depDir, "config.ts"), "export const port = 3000;", "utf8");
    await fs.writeFile(path.join(depDir, "db.ts"), "import { port } from './config';\nexport const db = true;", "utf8");
    await fs.writeFile(path.join(depDir, "server.ts"), "import { db } from './db';\nexport const app = true;", "utf8");

    const matrixRes: any = await registry.executeTool(
      "generate_dependency_matrix",
      { subpath: "modules" },
      testDir
    );

    assert.strictEqual(matrixRes.success, true);
    assert.strictEqual(matrixRes.totalFiles, 3);
    assert.strictEqual(matrixRes.circularCyclesCount, 0);
    assert.ok(matrixRes.topologicalOrder.length >= 3);

    console.log("  [✓] Dependency graph computed 3 files with 0 cycles and valid topological order.");
  }

  // --------------------------------------------------------------------------
  // Test 5: Dynamic Tool Cache Invalidator
  // --------------------------------------------------------------------------
  console.log("[Test 5/5] Validating Dynamic Tool Cache Invalidator...");
  {
    const cacheRes: any = await registry.executeTool(
      "invalidate_tool_cache",
      { tool: "view_file" },
      testDir
    );

    assert.strictEqual(cacheRes.success, true);
    assert.strictEqual(cacheRes.invalidatedTool, "view_file");

    console.log("  [✓] Tool cache for 'view_file' successfully invalidated.");
  }

  // Cleanup testDir
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});

  console.log("\n================================================================================");
  console.log("  [✓] ALL 5/5 COSMIC NIRVANA FLOW SUITES PASSED!  ");
  console.log("================================================================================\n");
}

run().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
