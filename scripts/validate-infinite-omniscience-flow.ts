/**
 * validate-infinite-omniscience-flow.ts
 *
 * Comprehensive Validation Suite for Infinite Omniscience Pass:
 * 1. Multi-File Regex Mutator (batch_regex_mutate)
 * 2. Markdown Documentation Link Validator (validate_documentation_links)
 * 3. File Mutation History & Journal Inspector (inspect_file_history)
 * 4. Technical Debt & TODO Harvester (harvest_technical_debt)
 * 5. Memory Slab & Buffer Optimizer (optimize_memory_slab)
 */

import * as assert from "node:assert";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { MonolithFactory } from "../src/factories/monolith-factory.js";

async function run() {
  console.log("================================================================================");
  console.log(" LUMI Infinite Omniscience: Regex Mutator, Doc Links, History, Debt & Memory     ");
  console.log("================================================================================\n");

  const components = MonolithFactory.createEngine();
  const registry = components.toolRegistry;
  const testDir = path.join(process.cwd(), "scratch", "infinite-omniscience-test");
  await fs.mkdir(testDir, { recursive: true });

  // --------------------------------------------------------------------------
  // Test 1: Multi-File Regex Mutator
  // --------------------------------------------------------------------------
  console.log("[Test 1/5] Validating Multi-File Regex Mutation Engine...");
  {
    const file1 = path.join(testDir, "apiConfig1.ts");
    const file2 = path.join(testDir, "apiConfig2.ts");

    await fs.writeFile(file1, `export const API_V1_ENDPOINT = "https://api.v1.com";\n`, "utf8");
    await fs.writeFile(file2, `export const API_V1_BACKUP = "https://backup.v1.com";\n`, "utf8");

    // Dry-run preview
    const dryRes: any = await registry.executeTool(
      "batch_regex_mutate",
      { pattern: "API_V1_([A-Z]+)", replacement: "API_V2_$1", dryRun: true },
      testDir
    );

    assert.strictEqual(dryRes.success, true);
    assert.strictEqual(dryRes.dryRun, true);
    assert.strictEqual(dryRes.totalFilesModified, 2);

    // Live execution
    const liveRes: any = await registry.executeTool(
      "batch_regex_mutate",
      { pattern: "API_V1_([A-Z]+)", replacement: "API_V2_$1", dryRun: false },
      testDir
    );

    assert.strictEqual(liveRes.success, true);
    assert.strictEqual(liveRes.dryRun, false);

    const c1 = await fs.readFile(file1, "utf8");
    const c2 = await fs.readFile(file2, "utf8");
    assert.ok(c1.includes("API_V2_ENDPOINT"));
    assert.ok(c2.includes("API_V2_BACKUP"));

    console.log("  [✓] Batch regex mutator replaced 'API_V1_$1' -> 'API_V2_$1' across 2 files.");
  }

  // --------------------------------------------------------------------------
  // Test 2: Markdown Documentation Link Validator
  // --------------------------------------------------------------------------
  console.log("[Test 2/5] Validating Markdown Documentation Link Validator...");
  {
    const validDoc = path.join(testDir, "VALID_DOC.md");
    const existingTarget = path.join(testDir, "target.ts");
    await fs.writeFile(existingTarget, "export const target = 1;", "utf8");
    await fs.writeFile(validDoc, `# Doc\n\nLink to [valid target](./target.ts) and [broken](./missing_target.ts).\n`, "utf8");

    const docRes: any = await registry.executeTool(
      "validate_documentation_links",
      {},
      testDir
    );

    assert.strictEqual(docRes.success, true);
    assert.ok(docRes.totalLinksChecked >= 2);
    assert.strictEqual(docRes.brokenLinksCount, 1);
    assert.ok(docRes.brokenLinks[0].link.includes("missing_target.ts"));

    console.log(`  [✓] Doc link validator checked ${docRes.totalLinksChecked} links and isolated 1 broken link.`);
  }

  // --------------------------------------------------------------------------
  // Test 3: Mutation Journal History Inspector
  // --------------------------------------------------------------------------
  console.log("[Test 3/5] Validating Mutation Journal File History Inspector...");
  {
    const histFile = "tracked_file.ts";
    await registry.executeTool(
      "write_file",
      { path: histFile, content: "console.log('v1');" },
      testDir,
      { executionAuthority: "autonomous", bypassConfirmation: true }
    );
    await registry.executeTool(
      "write_file",
      { path: histFile, content: "console.log('v2');" },
      testDir,
      { executionAuthority: "autonomous", bypassConfirmation: true }
    );

    const histRes: any = await registry.executeTool(
      "inspect_file_history",
      { path: histFile },
      testDir
    );

    assert.strictEqual(histRes.success, true);
    assert.ok(histRes.totalTransactionsRecorded >= 2);

    console.log(`  [✓] File history inspector retrieved ${histRes.totalTransactionsRecorded} recorded transactions for '${histFile}'.`);
  }

  // --------------------------------------------------------------------------
  // Test 4: Technical Debt & TODO Harvester
  // --------------------------------------------------------------------------
  console.log("[Test 4/5] Validating Technical Debt & TODO Harvester...");
  {
    const debtFile = path.join(testDir, "debtSample.ts");
    await fs.writeFile(
      debtFile,
      `// TODO(alice): refactor this database query\n// FIXME: fix race condition on shutdown\n// HACK: temporary workaround\n`,
      "utf8"
    );

    const debtRes: any = await registry.executeTool(
      "harvest_technical_debt",
      {},
      testDir
    );

    assert.strictEqual(debtRes.success, true);
    assert.ok(debtRes.totalItems >= 3);
    assert.strictEqual(debtRes.itemsByTag["TODO"] >= 1, true);
    assert.strictEqual(debtRes.itemsByTag["FIXME"] >= 1, true);
    assert.strictEqual(debtRes.itemsByTag["HACK"] >= 1, true);

    console.log(`  [✓] Debt harvester categorized ${debtRes.totalItems} technical debt items across files.`);
  }

  // --------------------------------------------------------------------------
  // Test 5: Memory Slab & Buffer Optimizer
  // --------------------------------------------------------------------------
  console.log("[Test 5/5] Validating Memory Slab & Buffer Optimizer...");
  {
    const memRes: any = await registry.executeTool(
      "optimize_memory_slab",
      {},
      testDir
    );

    assert.strictEqual(memRes.success, true);
    assert.ok(memRes.heapUsedBytes > 0);
    assert.ok(memRes.contiguousSlabInvariant.includes("16777216 bytes"));
    assert.strictEqual(memRes.gcStatus, "healthy");

    console.log(`  [✓] Memory optimizer verified slab invariant: ${memRes.contiguousSlabInvariant}.`);
  }

  // Cleanup testDir
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});

  console.log("\n================================================================================");
  console.log("  [✓] ALL 5/5 INFINITE OMNISCIENCE FLOW SUITES PASSED!  ");
  console.log("================================================================================\n");
}

run().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
