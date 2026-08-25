/**
 * validate-zenith-masterpiece-flow.ts
 *
 * Comprehensive Validation Suite for Zenith Masterpiece Pass:
 * 1. Unquoted Key JSON Auto-Repair in ToolCallArgParser
 * 2. Live Unified Workspace Diff Inspection (get_workspace_diff)
 * 3. In-Memory Code Syntax Validation (validate_code_syntax)
 * 4. Fuzzy File Pattern Finder (find_files_by_pattern)
 * 5. Multi-File Workspace Checkpoints & Restoration (create_workspace_checkpoint, restore_workspace_checkpoint)
 */

import * as assert from "node:assert";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { MonolithFactory } from "../src/factories/monolith-factory.js";
import { ToolCallArgParser } from "../src/tooling/extensions/registry/tool-call-arg-parser.js";

async function run() {
  console.log("================================================================================");
  console.log(" LUMI Zenith Masterpiece: Diffs, Syntax, Pattern Finder & Checkpoints          ");
  console.log("================================================================================\n");

  const components = MonolithFactory.createEngine();
  const registry = components.toolRegistry;
  const testDir = path.join(process.cwd(), "scratch", "zenith-masterpiece-test");
  await fs.mkdir(testDir, { recursive: true });

  // --------------------------------------------------------------------------
  // Test 1: Unquoted Key JSON Argument Auto-Repair
  // --------------------------------------------------------------------------
  console.log("[Test 1/5] Validating Unquoted Key JSON Argument Auto-Repair...");
  {
    const parser = new ToolCallArgParser();
    const rawMalformatted = `{ path: 'services/auth.ts', content: "export const auth = true;", count: 42, }`;
    const parsed = parser.parseRawArguments(rawMalformatted);

    assert.strictEqual(parsed.repaired, true);
    assert.strictEqual(parsed.args.path, "services/auth.ts");
    assert.strictEqual(parsed.args.content, "export const auth = true;");
    assert.strictEqual(parsed.args.count, 42);

    console.log("  [✓] Relaxed JSON auto-healed unquoted keys and trailing commas seamlessly.");
  }

  // --------------------------------------------------------------------------
  // Test 2: In-Memory Workspace Unified Diff Generation
  // --------------------------------------------------------------------------
  console.log("[Test 2/5] Validating Workspace Unified Diff Generator...");
  {
    const targetFile = path.join(testDir, "userProfile.ts");
    await fs.writeFile(targetFile, "export const user = { name: 'Alice', age: 30 };\n", "utf8");

    // Perform mutation via registry
    await registry.executeTool(
      "write_file",
      { path: "userProfile.ts", content: "export const user = { name: 'Alice', age: 31, verified: true };\n" },
      testDir,
      { executionAuthority: "autonomous" }
    );

    const diffRes: any = await registry.executeTool(
      "get_workspace_diff",
      {},
      testDir
    );

    assert.strictEqual(diffRes.success, true);
    assert.ok(diffRes.totalFilesChanged >= 1);
    assert.ok(diffRes.unifiedDiff.includes("--- a/"));
    assert.ok(diffRes.unifiedDiff.includes("+++ b/"));
    assert.ok(diffRes.unifiedDiff.includes("-export const user = { name: 'Alice', age: 30 };"));
    assert.ok(diffRes.unifiedDiff.includes("+export const user = { name: 'Alice', age: 31, verified: true };"));

    console.log(`  [✓] Unified git diff generated with ${diffRes.totalAdditions} additions / ${diffRes.totalDeletions} deletions.`);
  }

  // --------------------------------------------------------------------------
  // Test 3: In-Memory Code Syntax Validation
  // --------------------------------------------------------------------------
  console.log("[Test 3/5] Validating In-Memory Code Syntax Validator...");
  {
    // Valid TypeScript
    const validTs: any = await registry.executeTool(
      "validate_code_syntax",
      { code: "export interface User { id: string; name: string; }", language: "typescript" },
      testDir
    );
    assert.strictEqual(validTs.valid, true);

    // Invalid JSON
    const invalidJson: any = await registry.executeTool(
      "validate_code_syntax",
      { code: "{\n  \"missing\": quote\n}", language: "json" },
      testDir
    );
    assert.strictEqual(invalidJson.valid, false);
    assert.ok(invalidJson.errorsCount >= 1);

    console.log("  [✓] Syntax validator correctly validated TS and caught broken JSON syntax.");
  }

  // --------------------------------------------------------------------------
  // Test 4: Fuzzy File Pattern Finder
  // --------------------------------------------------------------------------
  console.log("[Test 4/5] Validating Fuzzy File Pattern Finder...");
  {
    await fs.writeFile(path.join(testDir, "user.controller.ts"), "export class UserController {}", "utf8");
    await fs.writeFile(path.join(testDir, "user.service.ts"), "export class UserService {}", "utf8");
    await fs.writeFile(path.join(testDir, "order.controller.ts"), "export class OrderController {}", "utf8");

    const patternRes: any = await registry.executeTool(
      "find_files_by_pattern",
      { pattern: "*controller*" },
      testDir
    );

    assert.strictEqual(patternRes.success, true);
    assert.strictEqual(patternRes.totalFound, 2, "Should find user.controller.ts and order.controller.ts");

    console.log(`  [✓] Pattern finder located ${patternRes.totalFound} matching controller files.`);
  }

  // --------------------------------------------------------------------------
  // Test 5: Transactional Workspace Checkpoint Creation & Restoration
  // --------------------------------------------------------------------------
  console.log("[Test 5/5] Validating Checkpoint Snapshot & Restoration...");
  {
    const fileA = path.join(testDir, "stateA.ts");
    const fileB = path.join(testDir, "stateB.ts");

    await fs.writeFile(fileA, "const version = 1;", "utf8");
    await fs.writeFile(fileB, "const version = 1;", "utf8");

    // Record initial checkpoint
    const chkRes: any = await registry.executeTool(
      "create_workspace_checkpoint",
      { label: "baseline_v1" },
      testDir
    );
    assert.strictEqual(chkRes.success, true);
    const checkpointId = chkRes.checkpointId;

    // Mutate files
    await registry.executeTool("write_file", { path: "stateA.ts", content: "const version = 2;" }, testDir, { executionAuthority: "autonomous" });
    await registry.executeTool("write_file", { path: "stateB.ts", content: "const version = 2;" }, testDir, { executionAuthority: "autonomous" });

    // Verify mutations took effect
    assert.strictEqual(await fs.readFile(fileA, "utf8"), "const version = 2;");
    assert.strictEqual(await fs.readFile(fileB, "utf8"), "const version = 2;");

    // Restore checkpoint
    const restoreRes: any = await registry.executeTool(
      "restore_workspace_checkpoint",
      { checkpointId },
      testDir
    );

    assert.strictEqual(restoreRes.success, true);
    assert.strictEqual(restoreRes.rolledBackCount, 2);

    // Verify files restored to baseline_v1
    assert.strictEqual(await fs.readFile(fileA, "utf8"), "const version = 1;");
    assert.strictEqual(await fs.readFile(fileB, "utf8"), "const version = 1;");

    console.log("  [✓] Transactional checkpoint restored files back to baseline snapshot.");
  }

  // Cleanup testDir
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});

  console.log("\n================================================================================");
  console.log("  [✓] ALL 5/5 ZENITH MASTERPIECE FLOW SUITES PASSED!  ");
  console.log("================================================================================\n");
}

run().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
