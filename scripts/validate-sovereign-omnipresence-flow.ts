/**
 * validate-sovereign-omnipresence-flow.ts
 *
 * Comprehensive Validation Suite for Sovereign Omnipresence Pass:
 * 1. AST Import Path Healing & Auto-Insertion (resolve_and_fix_imports)
 * 2. API Surface Type Introspector (introspect_type_signatures)
 * 3. Parallel Batch Tool Concurrency (execute_parallel_batch)
 * 4. 3-Way Merge Conflict Previewer (preview_merge_conflict_resolution)
 * 5. Log & Telemetry Stream Filter (filter_execution_logs)
 */

import * as assert from "node:assert";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { MonolithFactory } from "../src/factories/monolith-factory.js";

async function run() {
  console.log("================================================================================");
  console.log(" LUMI Sovereign Omnipresence: Imports, Types, Parallelism & Merge Previewer     ");
  console.log("================================================================================\n");

  const components = MonolithFactory.createEngine();
  const registry = components.toolRegistry;
  const testDir = path.join(process.cwd(), "scratch", "sovereign-omnipresence-test");
  await fs.mkdir(testDir, { recursive: true });

  // --------------------------------------------------------------------------
  // Test 1: AST Import Path Healing & Auto-Insertion
  // --------------------------------------------------------------------------
  console.log("[Test 1/5] Validating AST Import Path Healing & Auto-Insertion...");
  {
    const subDir = path.join(testDir, "services");
    await fs.mkdir(subDir, { recursive: true });
    await fs.writeFile(path.join(subDir, "billing.service.ts"), "export class BillingService {}", "utf8");

    // Create consumer file with broken relative import (missing 'services/')
    const consumerPath = path.join(testDir, "app.controller.ts");
    await fs.writeFile(
      consumerPath,
      `import { BillingService } from './billing.service';\n\nexport class AppController {}\n`,
      "utf8"
    );

    const resolveRes: any = await registry.executeTool(
      "resolve_and_fix_imports",
      {
        path: "app.controller.ts",
        newImports: ["import type { ILogger } from './logger';"],
        save: true,
      },
      testDir
    );

    assert.strictEqual(resolveRes.success, true);
    assert.strictEqual(resolveRes.fixedCount, 1);
    assert.strictEqual(resolveRes.addedCount, 1);

    const healedContent = await fs.readFile(consumerPath, "utf8");
    assert.ok(healedContent.includes("from './services/billing.service'"));
    assert.ok(healedContent.includes("import type { ILogger } from './logger';"));

    console.log("  [✓] Healed broken relative import to './services/billing.service' and added new import declaration.");
  }

  // --------------------------------------------------------------------------
  // Test 2: In-Memory API Surface Type Introspector
  // --------------------------------------------------------------------------
  console.log("[Test 2/5] Validating API Surface Type Introspector...");
  {
    const sourceCode = `
export interface UserAccount {
  id: string;
  email: string;
}

export class AuthService {
  private secret = "key";
  public async login(email: string): Promise<boolean> {
    // 50 lines of complex hashing implementation
    const hashed = "xyz";
    return true;
  }
}
`;
    const typeRes: any = await registry.executeTool(
      "introspect_type_signatures",
      { code: sourceCode },
      testDir
    );

    assert.strictEqual(typeRes.success, true);
    assert.ok(typeRes.signatures.includes("export interface UserAccount"));
    assert.ok(typeRes.signatures.includes("export class AuthService"));
    assert.ok(typeRes.signatures.includes("public async login(email: string): Promise<boolean>;"));
    assert.ok(!typeRes.signatures.includes("complex hashing implementation"));

    console.log(`  [✓] Introspected public API types with ${typeRes.compressionRatio} token reduction.`);
  }

  // --------------------------------------------------------------------------
  // Test 3: Parallel Tool Batch Execution
  // --------------------------------------------------------------------------
  console.log("[Test 3/5] Validating Parallel Tool Batch Concurrency...");
  {
    const batchRes: any = await registry.executeTool(
      "execute_parallel_batch",
      {
        calls: [
          { tool: "system_info", args: {} },
          { tool: "get_env", args: {} },
          { tool: "get_workspace_diff", args: {} },
        ],
        concurrency: 3,
      },
      testDir
    );

    assert.strictEqual(batchRes.success, true);
    assert.strictEqual(batchRes.totalCalls, 3);
    assert.strictEqual(batchRes.successfulCallsCount, 3);

    console.log(`  [✓] Parallel batch executed 3 concurrent tools in ${batchRes.durationMs}ms.`);
  }

  // --------------------------------------------------------------------------
  // Test 4: 3-Way Merge Conflict Previewer
  // --------------------------------------------------------------------------
  console.log("[Test 4/5] Validating 3-Way Merge Conflict Previewer...");
  {
    const base = "line1\nline2\nline3\n";
    const local = "line1\nline2_modified_local\nline3\n";
    const incoming = "line1\nline2_modified_incoming\nline3\n";

    const mergeRes: any = await registry.executeTool(
      "preview_merge_conflict_resolution",
      { base, local, incoming },
      testDir
    );

    assert.strictEqual(mergeRes.hasConflicts, true);
    assert.strictEqual(mergeRes.conflictsCount, 1);
    assert.ok(mergeRes.mergedText.includes("<<<<<<< LOCAL"));
    assert.ok(mergeRes.mergedText.includes(">>>>>>> INCOMING"));

    console.log("  [✓] 3-way merge correctly detected conflict markers.");
  }

  // --------------------------------------------------------------------------
  // Test 5: Semantic Log & Telemetry Stream Filter
  // --------------------------------------------------------------------------
  console.log("[Test 5/5] Validating Semantic Log & Telemetry Stream Filter...");
  {
    const logRes: any = await registry.executeTool(
      "filter_execution_logs",
      { maxEntries: 10 },
      testDir
    );

    assert.strictEqual(logRes.success, true);
    console.log(`  [✓] Log filter retrieved ${logRes.totalFound} telemetry entries.`);
  }

  // Cleanup testDir
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});

  console.log("\n================================================================================");
  console.log("  [✓] ALL 5/5 SOVEREIGN OMNIPRESENCE FLOW SUITES PASSED!  ");
  console.log("================================================================================\n");
}

run().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
