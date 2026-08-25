/**
 * validate-zenith-apex-resilience-flow.ts
 *
 * Comprehensive Validation Suite for Zenith Apex Tool Resilience, Safe Fast-Paths, & Token Optimization:
 * 1. In-Turn Whitespace-Tolerant Patch Auto-Healing (transparent replacement on indentation discrepancies)
 * 2. In-Turn Missing Parent Directory Auto-Creation (mkdir -p on nested file writes)
 * 3. Safe Fast-Path Execution for High-Frequency Read Tools (sub-millisecond latency & caching)
 * 4. Dynamic Tool Context Optimization & Token Footprint Metrics (DynamicToolRouter.optimizeToolContext)
 * 5. 5 Built-in Apex Developer & Pipeline Simulation Tools (heal_and_apply_patch, get_tool_resilience_status, fast_batch_read_files, optimize_tool_context_window, simulate_tool_pipeline)
 */

import * as assert from "node:assert";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { MonolithFactory } from "../src/factories/monolith-factory.js";

async function run() {
  console.log("================================================================================");
  console.log(" LUMI Zenith Apex: Resilience Auto-Healing, Fast-Paths & Context Optimization    ");
  console.log("================================================================================\n");

  const components = MonolithFactory.createEngine();
  const registry = components.toolRegistry;
  const testDir = path.join(process.cwd(), "scratch", "zenith-resilience-test");
  await fs.mkdir(testDir, { recursive: true });

  // --------------------------------------------------------------------------
  // Test 1: In-Turn Whitespace-Tolerant Patch Auto-Healing
  // --------------------------------------------------------------------------
  console.log("[Test 1/5] Validating In-Turn Whitespace-Tolerant Patch Auto-Healing...");
  {
    const targetFile = path.join(testDir, "userProfile.ts");
    const originalContent = `export interface UserProfile {
    id: string;
    displayName: string;
    role: "admin" | "user";
}`;
    await fs.writeFile(targetFile, originalContent, "utf8");

    // Attempt replace_file_content with sloppy indentation (2 spaces instead of 4)
    const sloppyTarget = `  displayName: string;
  role: "admin" | "user";`;
    const newReplacement = `  displayName: string;
  role: "admin" | "user" | "superadmin";`;

    const res: any = await registry.executeTool(
      "replace_file_content",
      {
        path: "userProfile.ts",
        targetContent: sloppyTarget,
        replacementContent: newReplacement,
      },
      testDir,
      { executionAuthority: "autonomous" }
    );

    assert.strictEqual(res.success, true, "Execution should succeed via transparent in-turn fuzzy auto-healing");
    assert.strictEqual(res.autoHealed, true, "Result should flag autoHealed: true");

    const updatedOnDisk = await fs.readFile(targetFile, "utf8");
    assert.ok(updatedOnDisk.includes('"superadmin"'), "File on disk must contain the updated replacement");

    console.log("  [✓] Transparent in-turn patch auto-healing successfully healed indentation mismatch.");
  }

  // --------------------------------------------------------------------------
  // Test 2: In-Turn Missing Parent Directory Auto-Creation (mkdir -p)
  // --------------------------------------------------------------------------
  console.log("[Test 2/5] Validating Missing Parent Directory Auto-Creation...");
  {
    const nestedFile = "deeply/nested/directory/structure/config.json";
    const content = JSON.stringify({ theme: "dark", level: "apex" });

    const res: any = await registry.executeTool(
      "write_file",
      {
        path: nestedFile,
        content,
      },
      testDir,
      { executionAuthority: "autonomous" }
    );

    assert.strictEqual(res.success, true, "write_file should transparently create parent directories");
    const exists = await fs.readFile(path.join(testDir, nestedFile), "utf8");
    assert.ok(exists.includes("dark"), "Nested file content must be written on disk");

    console.log("  [✓] Transparent parent directory creation (mkdir -p) completed without errors.");
  }

  // --------------------------------------------------------------------------
  // Test 3: Safe Fast-Path Execution on Read Tools (< 0.5ms)
  // --------------------------------------------------------------------------
  console.log("[Test 3/5] Validating Safe Fast-Path Execution on Read Tools...");
  {
    assert.strictEqual(registry.isSafeFastPathTool("view_file"), true);
    assert.strictEqual(registry.isSafeFastPathTool("file_info"), true);
    assert.strictEqual(registry.isSafeFastPathTool("replace_file_content"), false);

    // Warm execution & cache
    await registry.executeTool("view_file", { path: "userProfile.ts" }, testDir, { executionAuthority: "autonomous" });

    // Benchmark 100 fast-path cached reads
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) {
      await registry.executeTool("view_file", { path: "userProfile.ts" }, testDir, { executionAuthority: "autonomous" });
    }
    const durationMs = performance.now() - t0;
    const avgMs = durationMs / 100;

    assert.ok(avgMs < 0.5, `Fast-path read latency (${avgMs.toFixed(3)}ms) must be under 0.5ms SLA`);
    console.log(`  [✓] Safe fast-path executed 100 cached reads at ${avgMs.toFixed(3)} ms/read.`);
  }

  // --------------------------------------------------------------------------
  // Test 4: Dynamic Tool Context Optimization & Token Footprint Metrics
  // --------------------------------------------------------------------------
  console.log("[Test 4/5] Validating Dynamic Tool Context Optimization...");
  {
    const allTools = registry.listTools();
    const router = registry.dynamicRouter;

    const optResult = router.optimizeToolContext(allTools, "Please help me inspect the git repository and commit history");
    assert.ok(optResult.totalTools > 50, "Total registered tools should be large");
    assert.ok(optResult.selectedTools < optResult.totalTools, "Selected tools should be pruned for intent");
    assert.ok(optResult.savingsPercent > 0, "Token savings percentage should be positive");
    assert.ok(optResult.selectedToolNames.includes("view_file"), "Core tools must be retained");

    console.log(`  [✓] Dynamic context router achieved ${optResult.savingsPercent}% token savings (${optResult.selectedTools}/${optResult.totalTools} tools active).`);
  }

  // --------------------------------------------------------------------------
  // Test 5: 5 Built-in Apex Developer & Workflow Tools
  // --------------------------------------------------------------------------
  console.log("[Test 5/5] Validating 5 Built-in Apex Developer Tools...");
  {
    // 1. heal_and_apply_patch
    const samplePatcherFile = path.join(testDir, "patchMe.ts");
    await fs.writeFile(samplePatcherFile, "function add(a, b) {\n    return a + b;\n}\n", "utf8");

    const patchRes: any = await registry.executeTool(
      "heal_and_apply_patch",
      {
        path: "patchMe.ts",
        targetContent: "  return a + b;",
        replacementContent: "  return Number(a) + Number(b);",
      },
      testDir
    );
    assert.strictEqual(patchRes.success, true);
    assert.ok(patchRes.confidence >= 0.9);

    // 2. get_tool_resilience_status
    const resilienceRes: any = await registry.executeTool("get_tool_resilience_status", { limit: 10 }, testDir);
    assert.strictEqual(resilienceRes.success, true);
    assert.ok(resilienceRes.stats.totalRecovered >= 1);
    assert.ok(resilienceRes.recentRecoveries.length >= 1);

    // 3. fast_batch_read_files
    const batchReadRes: any = await registry.executeTool(
      "fast_batch_read_files",
      { paths: ["userProfile.ts", "patchMe.ts"] },
      testDir
    );
    assert.strictEqual(batchReadRes.success, true);
    assert.strictEqual(batchReadRes.successfulCount, 2);

    // 4. optimize_tool_context_window
    const optRes: any = await registry.executeTool(
      "optimize_tool_context_window",
      { contextPrompt: "run tests and lint codebase" },
      testDir
    );
    assert.strictEqual(optRes.success, true);
    assert.ok(optRes.routerOptimization);
    assert.ok(optRes.schemaCompression);

    // 5. simulate_tool_pipeline
    const simCalls = [
      { id: "c1", name: "view_file", args: { path: "userProfile.ts" } },
      { id: "c2", name: "write_file", args: { path: "userProfile.ts", content: "updated" } },
    ];
    const simRes: any = await registry.executeTool(
      "simulate_tool_pipeline",
      { callsJson: JSON.stringify(simCalls) },
      testDir
    );
    assert.strictEqual(simRes.success, true);
    assert.strictEqual(simRes.totalNodes, 2);
    assert.strictEqual(simRes.safetyAssessments.length, 2);

    console.log("  [✓] All 5 new apex developer tools executed and verified flawlessly.");
  }

  // Cleanup testDir
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});

  console.log("\n================================================================================");
  console.log("  [✓] ALL 5/5 ZENITH APEX RESILIENCE & FAST-PATH SUITES PASSED!  ");
  console.log("================================================================================\n");
}

run().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
