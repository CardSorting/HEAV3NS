/**
 * validate-supreme-sovereign-continuum-flow.ts
 *
 * Comprehensive Validation Suite for Supreme Sovereign Continuum Pass:
 * 1. Interactive Workspace Tree Visualizer (generate_workspace_tree)
 * 2. Package Dependency Auditor (audit_package_dependencies)
 * 3. JSON Config Patcher (patch_json_config)
 * 4. Code Smell & Anti-Pattern Detector (detect_code_smells)
 * 5. Session State & Telemetry Exporter (export_session_state)
 */

import * as assert from "node:assert";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { MonolithFactory } from "../src/factories/monolith-factory.js";

async function run() {
  console.log("================================================================================");
  console.log(" LUMI Supreme Sovereign Continuum: Tree, Packages, JSON Patch, Smells & Session ");
  console.log("================================================================================\n");

  const components = MonolithFactory.createEngine();
  const registry = components.toolRegistry;
  const testDir = path.join(process.cwd(), "scratch", "supreme-sovereign-continuum-test");
  await fs.mkdir(testDir, { recursive: true });

  // --------------------------------------------------------------------------
  // Test 1: Workspace Tree Visualizer
  // --------------------------------------------------------------------------
  console.log("[Test 1/5] Validating Workspace Directory Tree Visualizer...");
  {
    const subDir = path.join(testDir, "src", "modules");
    await fs.mkdir(subDir, { recursive: true });
    await fs.writeFile(path.join(subDir, "app.ts"), "export const app = 1;\n", "utf8");

    const treeRes: any = await registry.executeTool(
      "generate_workspace_tree",
      { maxDepth: 4 },
      testDir
    );

    assert.strictEqual(treeRes.success, true);
    assert.ok(treeRes.totalFiles >= 1);
    assert.ok(treeRes.treeOutput.includes("modules/"));
    assert.ok(treeRes.treeOutput.includes("app.ts"));

    console.log(`  [✓] Workspace tree visualizer mapped ${treeRes.totalFiles} files across ${treeRes.totalDirectories} directories.`);
  }

  // --------------------------------------------------------------------------
  // Test 2: Package Dependency Auditor
  // --------------------------------------------------------------------------
  console.log("[Test 2/5] Validating Package Dependency Auditor...");
  {
    const pkgJson = path.join(testDir, "package.json");
    await fs.writeFile(
      pkgJson,
      JSON.stringify(
        {
          name: "test-pkg",
          version: "1.0.0",
          dependencies: {
            lodash: "*", // Wildcard issue
            express: "^4.18.0",
          },
          devDependencies: {
            express: "^4.18.0", // Overlap issue
          },
          scripts: {
            build: "tsc",
          },
        },
        null,
        2
      ),
      "utf8"
    );

    const auditRes: any = await registry.executeTool(
      "audit_package_dependencies",
      {},
      testDir
    );

    assert.strictEqual(auditRes.success, true);
    assert.strictEqual(auditRes.hasIssues, true);
    const issues = auditRes.reports[0].issues;
    assert.ok(issues.some((i: string) => i.toLowerCase().includes("wildcard")));
    assert.ok(issues.some((i: string) => i.toLowerCase().includes("overlapping")));

    console.log(`  [✓] Package auditor caught ${issues.length} semver & overlap issues.`);
  }

  // --------------------------------------------------------------------------
  // Test 3: JSON Config Patcher
  // --------------------------------------------------------------------------
  console.log("[Test 3/5] Validating JSON Config Patcher...");
  {
    const configPath = "tsconfig.sample.json";
    const fullConfigPath = path.join(testDir, configPath);
    await fs.writeFile(
      fullConfigPath,
      JSON.stringify({ compilerOptions: { target: "ES2020", strict: false } }, null, 2),
      "utf8"
    );

    // Dry run
    const dryPatch: any = await registry.executeTool(
      "patch_json_config",
      { path: configPath, updates: { "compilerOptions.strict": true, "compilerOptions.target": "ES2022" }, dryRun: true },
      testDir
    );

    assert.strictEqual(dryPatch.success, true);
    assert.strictEqual(dryPatch.dryRun, true);
    assert.strictEqual(dryPatch.afterJson.compilerOptions.strict, true);

    // Live run
    const livePatch: any = await registry.executeTool(
      "patch_json_config",
      { path: configPath, updates: { "compilerOptions.strict": true, "compilerOptions.target": "ES2022" }, dryRun: false },
      testDir
    );

    assert.strictEqual(livePatch.success, true);
    assert.strictEqual(livePatch.dryRun, false);

    const diskContent = JSON.parse(await fs.readFile(fullConfigPath, "utf8"));
    assert.strictEqual(diskContent.compilerOptions.strict, true);
    assert.strictEqual(diskContent.compilerOptions.target, "ES2022");

    console.log("  [✓] JSON config patcher applied dot-notation updates to tsconfig.");
  }

  // --------------------------------------------------------------------------
  // Test 4: Code Smell & Anti-Pattern Detector
  // --------------------------------------------------------------------------
  console.log("[Test 4/5] Validating Code Smell & Anti-Pattern Detector...");
  {
    const smellyFile = path.join(testDir, "smelly.ts");
    await fs.writeFile(
      smellyFile,
      `try { console.log(1); } catch (e) {}\n\nfunction complexHandler(a: number, b: number, c: number, d: number, e: number, f: number) {\n  return a;\n}\n`,
      "utf8"
    );

    const smellRes: any = await registry.executeTool(
      "detect_code_smells",
      {},
      testDir
    );

    assert.strictEqual(smellRes.success, true);
    assert.ok(smellRes.totalSmellsFound >= 2);
    const smellTypes = smellRes.smells.map((s: any) => s.type);
    assert.ok(smellTypes.includes("Empty Catch Block"));
    assert.ok(smellTypes.includes("Long Parameter List"));

    console.log(`  [✓] Code smell detector detected ${smellRes.totalSmellsFound} anti-patterns.`);
  }

  // --------------------------------------------------------------------------
  // Test 5: Session State & Telemetry Exporter
  // --------------------------------------------------------------------------
  console.log("[Test 5/5] Validating Session State & Telemetry Exporter...");
  {
    const stateRes: any = await registry.executeTool(
      "export_session_state",
      { includeTelemetry: true },
      testDir
    );

    assert.strictEqual(stateRes.success, true);
    assert.ok(stateRes.timestamp > 0);
    assert.strictEqual(typeof stateRes.activeTurnId, "string");
    assert.ok(stateRes.cache !== undefined);

    console.log(`  [✓] Session state exporter generated diagnostic snapshot (turn: ${stateRes.activeTurnId}).`);
  }

  // Cleanup testDir
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});

  console.log("\n================================================================================");
  console.log("  [✓] ALL 5/5 SUPREME SOVEREIGN CONTINUUM FLOW SUITES PASSED!  ");
  console.log("================================================================================\n");
}

run().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
