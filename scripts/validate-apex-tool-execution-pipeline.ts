/**
 * validate-apex-tool-execution-pipeline.ts
 *
 * Apex-Tier Tool Calling, Parallel Scheduling, Read Caching, Output Governance,
 * Error Auto-Healing, and Strict Schema Pipeline Validation Suite.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import { ToolExecutionScheduler } from "../src/tooling/extensions/execution/tool-execution-scheduler.js";
import { ToolExecutionCache } from "../src/tooling/extensions/execution/tool-execution-cache.js";
import { ToolOutputGovernor } from "../src/tooling/extensions/execution/tool-output-governor.js";
import { ToolErrorAutoHealer } from "../src/tooling/extensions/execution/tool-error-auto-healer.js";
import { ToolSchemaSerializer } from "../src/tooling/extensions/registry/tool-schema-serializer.js";
import { MonolithFactory } from "../src/factories/monolith-factory.js";
import type { ToolDefinition } from "../src/core/contracts/tooling.contracts.js";

async function runApexSuite(): Promise<void> {
  console.log("================================================================================");
  console.log(" LUMI Zenith Tier: Advanced Tool Scheduling, Caching & Healing Pipeline         ");
  console.log("================================================================================\n");

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "lumi-apex-tool-test-"));
  let passedTests = 0;
  const totalTests = 7;

  try {
    // Setup test files
    const fileA = path.join(tempDir, "file_a.txt");
    const fileB = path.join(tempDir, "file_b.txt");
    const fileC = path.join(tempDir, "file_c.txt");
    await fs.writeFile(fileA, "Content of File A\nLine 2\nLine 3\n", "utf-8");
    await fs.writeFile(fileB, "Content of File B\nLine 2\nLine 3\n", "utf-8");
    await fs.writeFile(fileC, "Content of File C\nLine 2\nLine 3\n", "utf-8");

    const components = MonolithFactory.createEngine();
    const registry = components.toolRegistry;

    // -------------------------------------------------------------------------
    // Test 1: Parallel Read Tool Execution & Wave Partitioning
    // -------------------------------------------------------------------------
    console.log("[Test 1/7] Validating ToolExecutionScheduler Parallel Concurrency & Wave Partitioning...");
    const scheduler = new ToolExecutionScheduler();

    const batchCalls = [
      { id: "call_1", name: "view_file", args: { path: fileA } },
      { id: "call_2", name: "view_file", args: { path: fileB } },
      { id: "call_3", name: "view_file", args: { path: fileC } },
    ];

    const waves = scheduler.partitionWaves(batchCalls, registry);
    if (waves.length !== 1 || waves[0].length !== 3) {
      throw new Error(`Expected 1 concurrent read wave with 3 calls, got: ${JSON.stringify(waves)}`);
    }

    const { results: batchResults, metrics } = await scheduler.executeBatch(batchCalls, registry, tempDir);
    if (batchResults.length !== 3) {
      throw new Error(`Expected 3 results, got ${batchResults.length}`);
    }
    if (!batchResults[0].success || !batchResults[1].success || !batchResults[2].success) {
      throw new Error("One or more parallel tool executions failed");
    }

    console.log(`  [✓] 3 tool calls executed in parallel (Execution time: ${metrics.executionTimeMs}ms, Concurrency speedup: ${metrics.concurrencySpeedup}x).`);
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 2: Mutation Wave Serialization
    // -------------------------------------------------------------------------
    console.log("[Test 2/7] Validating Mutating Tool Wave Serialization & Atomicity...");
    const mixedCalls = [
      { id: "call_r1", name: "view_file", args: { path: fileA } },
      { id: "call_r2", name: "view_file", args: { path: fileB } },
      { id: "call_w1", name: "write_file", args: { path: path.join(tempDir, "new_file.txt"), content: "New content" } },
      { id: "call_r3", name: "view_file", args: { path: path.join(tempDir, "new_file.txt") } },
    ];

    const mixedWaves = scheduler.partitionWaves(mixedCalls, registry);
    if (mixedWaves.length !== 3) {
      throw new Error(`Expected 3 waves (Reads, Mutation, Read), got ${mixedWaves.length}`);
    }
    if (mixedWaves[0].length !== 2 || mixedWaves[1].length !== 1 || mixedWaves[2].length !== 1) {
      throw new Error(`Wave partitioning structure mismatch: ${JSON.stringify(mixedWaves)}`);
    }

    const { results: mixedResults } = await scheduler.executeBatch(mixedCalls, registry, tempDir);
    if (mixedResults.length !== 4 || !mixedResults.every((r) => r.success)) {
      throw new Error("Mixed read-write batch execution failed");
    }

    console.log("  [✓] Mutating tool calls correctly sequenced into dedicated ordered waves.");
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 3: In-Memory Read Caching & Path-Driven Invalidation
    // -------------------------------------------------------------------------
    console.log("[Test 3/7] Validating ToolExecutionCache Microsecond Hits & Path-Based Invalidation...");
    const cache = new ToolExecutionCache();
    const cacheScheduler = new ToolExecutionScheduler({ cache });

    // Initial read (cache miss, then cached)
    const firstRead = await cacheScheduler.executeSingleCall(
      { id: "c1", name: "view_file", args: { path: fileA } },
      registry,
      tempDir,
      true,
      false
    );
    if (firstRead.isCached) throw new Error("First read should be a cache miss");

    // Second read on identical args (cache hit)
    const secondRead = await cacheScheduler.executeSingleCall(
      { id: "c2", name: "view_file", args: { path: fileA } },
      registry,
      tempDir,
      true,
      false
    );
    if (!secondRead.isCached) throw new Error("Second read should be an instant cache hit");

    // Mutation on fileA -> invalidates fileA cache
    await cacheScheduler.executeSingleCall(
      { id: "c3", name: "write_file", args: { path: fileA, content: "Modified Content" } },
      registry,
      tempDir,
      true,
      false
    );

    // Third read after mutation (cache miss)
    const thirdRead = await cacheScheduler.executeSingleCall(
      { id: "c4", name: "view_file", args: { path: fileA } },
      registry,
      tempDir,
      true,
      false
    );
    if (thirdRead.isCached) throw new Error("Third read after mutation should be a cache miss");

    const stats = cache.getStats();
    if (stats.hits < 1 || stats.invalidations < 1) {
      throw new Error(`Cache stats unexpected: ${JSON.stringify(stats)}`);
    }

    console.log(`  [✓] Read cache verified (Hit rate: ${stats.hitRatePercent}%, Auto-invalidations: ${stats.invalidations}).`);
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 4: ToolOutputGovernor Bounding, Markdown Tables & Spill Vault
    // -------------------------------------------------------------------------
    console.log("[Test 4/7] Validating ToolOutputGovernor Markdown Tables & Spill Vault...");
    const governor = new ToolOutputGovernor({ maxLines: 10, headLines: 4, tailLines: 3 });

    // Tabular formatting
    const sampleTableData = [
      { id: 1, name: "Alice", role: "Engineer", status: "Active" },
      { id: 2, name: "Bob", role: "Designer", status: "Active" },
      { id: 3, name: "Charlie", role: "Architect", status: "Review" },
    ];
    const markdownTable = governor.formatAsMarkdownTable(sampleTableData);
    if (!markdownTable.includes("| id |") || !markdownTable.includes("| Alice |")) {
      throw new Error(`Markdown table formatting failed: ${markdownTable}`);
    }

    // Output bounding and spill vault
    const longOutput = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}: Some long output description here`).join("\n");
    const bounded = governor.governOutput(longOutput, "terminal");
    if (!bounded.wasTruncated || !bounded.spillId || !bounded.omittedLines) {
      throw new Error(`Expected output truncation and spill ID: ${JSON.stringify(bounded)}`);
    }

    const retrievedSpill = governor.getSpillContent(bounded.spillId);
    if (retrievedSpill !== longOutput) {
      throw new Error("Spill vault content retrieval mismatch");
    }

    console.log(`  [✓] Output governor bounded 50 lines to ${bounded.outputText.split("\n").length} lines with spill ID '${bounded.spillId}'.`);
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 5: ToolErrorAutoHealer Model Diagnostics & Fuzzy File Matching
    // -------------------------------------------------------------------------
    console.log("[Test 5/7] Validating ToolErrorAutoHealer Fuzzy Matching & Self-Healing Advice...");
    const healer = new ToolErrorAutoHealer();

    // 5a. File not found with fuzzy match
    const healedNotFound = healer.diagnoseAndHeal(
      "view_file",
      { path: "file_z_not_real.txt" },
      new Error("ENOENT: no such file or directory, open 'file_z_not_real.txt'"),
      tempDir
    );
    if (!healedNotFound.remediationAction || healedNotFound.suggestions.length === 0) {
      throw new Error(`Auto-healing file diagnostic failed: ${JSON.stringify(healedNotFound)}`);
    }

    // 5b. Replace chunk not found
    const healedChunk = healer.diagnoseAndHeal(
      "replace_file_content",
      { path: fileA, targetContent: "NON_EXISTENT_CHUNK_LINE" },
      new Error("could not find target content in file"),
      tempDir
    );
    if (!healedChunk.actionableMessage.includes("Target content to replace was not found")) {
      throw new Error(`Auto-healing edit chunk diagnostic failed: ${JSON.stringify(healedChunk)}`);
    }

    console.log("  [✓] Error auto-healer generated actionable diagnostics for file misses and chunk mismatches.");
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 6: OpenAI Strict Mode & Provider tool_choice Formatters
    // -------------------------------------------------------------------------
    console.log("[Test 6/7] Validating OpenAI Strict Mode & Multi-Provider tool_choice Formatters...");
    const serializer = new ToolSchemaSerializer();

    const sampleTool: ToolDefinition = {
      name: "configure_project",
      description: "Configures project metadata",
      parameters: {
        projectName: { type: "string", required: true },
        version: { type: "string", required: true },
        enableLogging: { type: "boolean", required: false, default: false },
      },
      execute: async () => ({ success: true }),
    };

    // Strict OpenAI format
    const strictSchema = serializer.toOpenAIStrictFunction(sampleTool);
    if (strictSchema.function.strict !== true) {
      throw new Error("Strict mode flag missing");
    }
    if (strictSchema.function.parameters.additionalProperties !== false) {
      throw new Error("strict mode requires additionalProperties: false");
    }
    if (!strictSchema.function.parameters.required.includes("enableLogging")) {
      throw new Error("strict mode requires all properties in required array");
    }

    // tool_choice formatters
    const openAIChoice = serializer.toOpenAIToolChoice({ toolName: "configure_project" });
    if (typeof openAIChoice !== "object" || openAIChoice.function.name !== "configure_project") {
      throw new Error("OpenAI tool_choice serialization failed");
    }

    const anthropicChoice = serializer.toAnthropicToolChoice("any");
    if (typeof anthropicChoice !== "object" || anthropicChoice.type !== "any") {
      throw new Error("Anthropic tool_choice serialization failed");
    }

    const geminiConfig = serializer.toGeminiToolConfig("ANY", ["configure_project"]);
    if (geminiConfig.functionCallingConfig.mode !== "ANY" || !geminiConfig.functionCallingConfig.allowedFunctionNames?.includes("configure_project")) {
      throw new Error("Gemini tool_config serialization failed");
    }

    console.log("  [✓] Strict schema mode and provider tool_choice formatters verified.");
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 7: Monolith Execution Pipeline & Engine Integration
    // -------------------------------------------------------------------------
    console.log("[Test 7/7] Validating Monolith Registry Parallel Execution & Scheduler Pipeline...");
    const monolithResult = await registry.scheduler.executeBatch(
      [
        { id: "m_1", name: "view_file", args: { path: fileA } },
        { id: "m_2", name: "view_file", args: { path: fileB } },
      ],
      registry,
      tempDir
    );

    if (monolithResult.results.length !== 2 || !monolithResult.results[0].success) {
      throw new Error("Monolith registry batch execution failed");
    }

    console.log("  [✓] Monolith scheduler pipeline verified end-to-end.");
    passedTests++;

  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }

  console.log("\n================================================================================");
  console.log(`  [✓] ALL ${passedTests}/${totalTests} ADVANCED TOOL PIPELINE SUITES PASSED! `);
  console.log("================================================================================\n");
}

runApexSuite().catch((err) => {
  console.error("Pipeline validation failed:", err);
  process.exit(1);
});
