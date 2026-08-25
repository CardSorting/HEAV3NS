/**
 * validate-transcendental-singularity-flow.ts
 *
 * Comprehensive Validation Suite for Transcendental Singularity Pass:
 * 1. In-Memory Semantic Search (search_codebase_semantic)
 * 2. Dead Code & Unused Export Detection (prune_unused_exports)
 * 3. Boilerplate Template Scaffolding (scaffold_file_template)
 * 4. Tool Microbenchmark Profiler (benchmark_tool_latency)
 * 5. Code Complexity & Maintainability Evaluator (evaluate_code_complexity)
 */

import * as assert from "node:assert";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { MonolithFactory } from "../src/factories/monolith-factory.js";

async function run() {
  console.log("================================================================================");
  console.log(" LUMI Transcendental Singularity: Semantic Search, Dead Code, Scaffolder, MI    ");
  console.log("================================================================================\n");

  const components = MonolithFactory.createEngine();
  const registry = components.toolRegistry;
  const testDir = path.join(process.cwd(), "scratch", "transcendental-singularity-test");
  await fs.mkdir(testDir, { recursive: true });

  // --------------------------------------------------------------------------
  // Test 1: In-Memory Semantic Codebase Search
  // --------------------------------------------------------------------------
  console.log("[Test 1/5] Validating In-Memory Semantic BM25 Search...");
  {
    const searchFile = path.join(testDir, "paymentGateway.ts");
    await fs.writeFile(
      searchFile,
      `export class StripePaymentProcessor {\n  public async chargeCustomerCard(amountCents: number) {\n    return { status: 'succeeded' };\n  }\n}\n`,
      "utf8"
    );

    const searchRes: any = await registry.executeTool(
      "search_codebase_semantic",
      { query: "customer card stripe charge" },
      testDir
    );

    assert.strictEqual(searchRes.success, true);
    assert.ok(searchRes.totalFound >= 1);
    assert.ok(searchRes.results[0].path.includes("paymentGateway.ts"));
    assert.ok(searchRes.results[0].score > 0);

    console.log(`  [✓] Semantic BM25 search matched '${searchRes.results[0].path}' with score ${searchRes.results[0].score}.`);
  }

  // --------------------------------------------------------------------------
  // Test 2: Dead Code & Unused Export Detection
  // --------------------------------------------------------------------------
  console.log("[Test 2/5] Validating Unused Export & Dead Code Discovery...");
  {
    const modA = path.join(testDir, "utils.ts");
    const modB = path.join(testDir, "consumer.ts");

    await fs.writeFile(modA, `export const usedHelper = 1;\nexport const orphanSecretFunction = 2;\n`, "utf8");
    await fs.writeFile(modB, `import { usedHelper } from './utils';\nconsole.log(usedHelper);\n`, "utf8");

    const unusedRes: any = await registry.executeTool(
      "prune_unused_exports",
      {},
      testDir
    );

    assert.strictEqual(unusedRes.success, true);
    assert.ok(unusedRes.unusedExportsCount >= 1);
    const orphan = unusedRes.unusedExports.find((e: any) => e.symbol === "orphanSecretFunction");
    assert.ok(orphan, "orphanSecretFunction should be detected as unused export");

    console.log(`  [✓] Unused export detector correctly flagged orphan export '${orphan.symbol}' in '${orphan.file}'.`);
  }

  // --------------------------------------------------------------------------
  // Test 3: Boilerplate Template Scaffolding
  // --------------------------------------------------------------------------
  console.log("[Test 3/5] Validating Boilerplate File Template Scaffolder...");
  {
    const scaffoldRes: any = await registry.executeTool(
      "scaffold_file_template",
      { templateType: "service", name: "orderProcessing", targetPath: "orderProcessing.service.ts" },
      testDir
    );

    assert.strictEqual(scaffoldRes.success, true);
    assert.strictEqual(scaffoldRes.templateType, "service");

    const createdContent = await fs.readFile(path.join(testDir, "orderProcessing.service.ts"), "utf8");
    assert.ok(createdContent.includes("export class OrderProcessingService"));
    assert.ok(createdContent.includes("interface IOrderProcessingService"));

    console.log("  [✓] Template scaffolder cleanly generated 'OrderProcessingService' with zero hallucinations.");
  }

  // --------------------------------------------------------------------------
  // Test 4: Tool Latency Microbenchmark
  // --------------------------------------------------------------------------
  console.log("[Test 4/5] Validating Tool Latency Microbenchmark Profiler...");
  {
    const benchRes: any = await registry.executeTool(
      "benchmark_tool_latency",
      { tool: "probe_workspace_environment", iterations: 10 },
      testDir
    );

    assert.strictEqual(benchRes.success, true);
    assert.strictEqual(benchRes.tool, "probe_workspace_environment");
    assert.strictEqual(benchRes.iterations, 10);
    assert.ok(benchRes.p50Ms >= 0);
    assert.ok(benchRes.throughputOpsPerSec > 0);

    console.log(`  [✓] Microbenchmark profiled 10 iterations: p50 = ${benchRes.p50Ms}ms, throughput = ${benchRes.throughputOpsPerSec} ops/sec.`);
  }

  // --------------------------------------------------------------------------
  // Test 5: Code Complexity & Maintainability Index Evaluator
  // --------------------------------------------------------------------------
  console.log("[Test 5/5] Validating Code Complexity & Maintainability Index Evaluator...");
  {
    const complexFile = path.join(testDir, "complexLogic.ts");
    await fs.writeFile(
      complexFile,
      `export function processNestedLogic(a: number, b: number, c: boolean) {\n  if (a > 0 && b > 0) {\n    if (c) return a + b;\n    else return a - b;\n  } else if (a === 0 || b === 0) {\n    return 0;\n  }\n  return -1;\n}\n`,
      "utf8"
    );

    const complexityRes: any = await registry.executeTool(
      "evaluate_code_complexity",
      { path: "complexLogic.ts" },
      testDir
    );

    assert.strictEqual(complexityRes.success, true);
    assert.ok(complexityRes.cyclomaticComplexity >= 5);
    assert.ok(complexityRes.maintainabilityIndex > 0);
    assert.ok(["LOW", "MEDIUM", "HIGH"].includes(complexityRes.riskRating));

    console.log(`  [✓] Evaluator scored complexity CC=${complexityRes.cyclomaticComplexity}, MI=${complexityRes.maintainabilityIndex} (${complexityRes.riskRating} risk).`);
  }

  // Cleanup testDir
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});

  console.log("\n================================================================================");
  console.log("  [✓] ALL 5/5 TRANSCENDENTAL SINGULARITY FLOW SUITES PASSED!  ");
  console.log("================================================================================\n");
}

run().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
