/**
 * validate-apex-tool-dag-engine.ts
 *
 * Apex-Tier Pass 6 DAG, Summarizer, Mock Sandbox & Tool Choice Engine Suite:
 * - ToolDependencyGraphPlanner (Topological Wave Partitioning, Piped Args & Cycle Detection)
 * - ToolOutputSummarizer (Failure Chunk Elevation, Noise Stripping & Compression)
 * - ToolMockHarness (Mock Handlers, Record/Replay Fixture Matching & Mode Isolation)
 * - ToolChoicePolicyOrchestrator (Multi-Provider Tool Choice Serialization & System Directives)
 * - summarize_tool_output (Built-in Tool Execution & Registry Verification)
 * - Monolith AgentEngine & Registry Pass 6 End-to-End Synchronization
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import { ToolDependencyGraphPlanner } from "../src/tooling/extensions/execution/tool-dependency-graph-planner.js";
import { ToolOutputSummarizer } from "../src/tooling/extensions/execution/tool-output-summarizer.js";
import { ToolMockHarness } from "../src/tooling/extensions/execution/tool-mock-harness.js";
import { ToolChoicePolicyOrchestrator } from "../src/tooling/extensions/registry/tool-choice-policy-orchestrator.js";
import { MonolithFactory } from "../src/factories/monolith-factory.js";

async function runDAGEngineSuite(): Promise<void> {
  console.log("================================================================================");
  console.log(" LUMI DAG Engine: Topological Waves, Output Summarizer, Mocks & Tool Choice     ");
  console.log("================================================================================\n");

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "lumi-dag-test-"));
  let passedTests = 0;
  const totalTests = 6;

  try {
    const components = MonolithFactory.createEngine();
    const registry = components.toolRegistry;

    // -------------------------------------------------------------------------
    // Test 1: ToolDependencyGraphPlanner Topological Partitioning & Execution
    // -------------------------------------------------------------------------
    console.log("[Test 1/6] Validating ToolDependencyGraphPlanner Topological Waves & Piped Args...");
    const planner = new ToolDependencyGraphPlanner();

    const sampleFile1 = path.join(tempDir, "sample1.txt");
    const sampleFile2 = path.join(tempDir, "sample2.txt");
    await fs.writeFile(sampleFile1, "Hello DAG World\n", "utf-8");
    await fs.writeFile(sampleFile2, "Second DAG Node\n", "utf-8");

    // Node 1 & Node 2 are independent (Wave 0), Node 3 depends on Node 1 (Wave 1)
    const dagNodes = [
      { id: "node1", toolName: "view_file", args: { path: sampleFile1 }, dependencies: [] },
      { id: "node2", toolName: "view_file", args: { path: sampleFile2 }, dependencies: [] },
      { id: "node3", toolName: "view_file", args: { path: "$node1.result.path" }, dependencies: ["node1"] },
    ];

    const plan = planner.planDAG(dagNodes);
    if (plan.hasCycles || plan.waves.length !== 2 || plan.waves[0].length !== 2 || plan.waves[1].length !== 1) {
      throw new Error(`DAG planning unexpected: ${JSON.stringify(plan)}`);
    }

    const records = await planner.executeDAG(dagNodes, tempDir, registry);
    if (records.size !== 3 || !records.get("node3")?.success) {
      throw new Error(`DAG execution failed: ${JSON.stringify(Array.from(records.entries()))}`);
    }

    // Verify cycle detection
    const cyclicNodes = [
      { id: "a", toolName: "view_file", args: {}, dependencies: ["b"] },
      { id: "b", toolName: "view_file", args: {}, dependencies: ["a"] },
    ];
    const cyclicPlan = planner.planDAG(cyclicNodes);
    if (!cyclicPlan.hasCycles) {
      throw new Error("Cycle detection failed for circular DAG");
    }

    console.log("  [✓] DAG planner partitioned 3 nodes into 2 topological waves and resolved piped argument dependencies.");
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 2: ToolOutputSummarizer Error Extraction & Noise Compression
    // -------------------------------------------------------------------------
    console.log("[Test 2/6] Validating ToolOutputSummarizer Failure Extraction & Noise Compression...");
    const summarizer = new ToolOutputSummarizer();

    // Synthesize long build log with failure hidden in middle
    const logLines: string[] = [];
    for (let i = 0; i < 40; i++) logLines.push(`[${i}%] Compiling chunk ${i}...`);
    logLines.push("TypeError: Cannot read properties of undefined (reading 'token')");
    logLines.push("    at Tokenizer.parse (/app/src/parser.ts:42:15)");
    logLines.push("    at Compiler.compile (/app/src/compiler.ts:108:12)");
    for (let i = 40; i < 100; i++) logLines.push(`[${i}%] Compiling chunk ${i}...`);

    const rawLog = logLines.join("\n");
    const summary = summarizer.summarizeOutput(rawLog, { maxOutputLines: 30 });

    if (summary.failureChunksFound === 0 || !summary.summary.includes("TypeError: Cannot read properties")) {
      throw new Error("Summarizer failed to elevate TypeError stack trace");
    }

    console.log(`  [✓] Summarizer extracted ${summary.failureChunksFound} critical failure context lines (${summary.originalLineCount} -> ${summary.summaryLineCount} lines).`);
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 3: ToolMockHarness Mock Handlers, Record & Replay Modes
    // -------------------------------------------------------------------------
    console.log("[Test 3/6] Validating ToolMockHarness Mock Handlers & Record/Replay Isolation...");
    const harness = new ToolMockHarness();

    // 3a. Mock handler
    harness.mockTool("custom_tool", async (args) => ({ mocked: true, received: args.val }));
    const mockRes = await harness.interceptExecution("custom_tool", { val: 42 }, tempDir);
    if (!mockRes.intercepted || (mockRes.result as any).mocked !== true) {
      throw new Error("Mock handler interception failed");
    }

    // 3b. Replay mode with fixtures
    harness.setMode("replay");
    const hash = harness.generateHash("api_query", { endpoint: "/users" });
    harness.loadFixtures([
      {
        toolName: "api_query",
        argsHash: hash,
        args: { endpoint: "/users" },
        result: [{ id: 1, name: "Alice" }],
        durationMs: 12,
      },
    ]);

    const replayRes = await harness.interceptExecution("api_query", { endpoint: "/users" }, tempDir);
    if (!replayRes.intercepted || (replayRes.result as any)[0].name !== "Alice") {
      throw new Error("Replay fixture interception failed");
    }

    console.log("  [✓] Tool mock harness intercepted executions across mock and replay modes deterministically.");
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 4: ToolChoicePolicyOrchestrator Multi-Provider Serialization
    // -------------------------------------------------------------------------
    console.log("[Test 4/6] Validating ToolChoicePolicyOrchestrator Multi-Provider Formats...");
    const orchestrator = new ToolChoicePolicyOrchestrator();

    const openAIAuto = orchestrator.toOpenAIToolChoice({ mode: "auto" });
    const openAIForced = orchestrator.toOpenAIToolChoice({ mode: "forced", forcedToolName: "view_file" });
    const anthropicRequired = orchestrator.toAnthropicToolChoice({ mode: "required" });
    const geminiForced = orchestrator.toGeminiToolConfig({ mode: "forced", forcedToolName: "grep_search" }) as any;
    const promptDirective = orchestrator.toSystemPromptDirective({ mode: "required" });

    if (openAIAuto !== "auto" || (openAIForced as any).function?.name !== "view_file") {
      throw new Error("OpenAI tool choice serialization mismatch");
    }
    if ((anthropicRequired as any).type !== "any") {
      throw new Error("Anthropic tool choice serialization mismatch");
    }
    if (geminiForced.function_calling_config?.allowed_function_names?.[0] !== "grep_search") {
      throw new Error("Gemini tool config serialization mismatch");
    }
    if (!promptDirective.includes("MUST invoke at least one tool")) {
      throw new Error("Prompt fallback directive mismatch");
    }

    console.log("  [✓] ToolChoicePolicyOrchestrator serialized formats accurately for OpenAI, Anthropic, and Gemini.");
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 5: Built-in summarize_tool_output Tool
    // -------------------------------------------------------------------------
    console.log("[Test 5/6] Validating Built-in 'summarize_tool_output' Registry Tool...");
    const toolSummaryRes = (await registry.executeTool(
      "summarize_tool_output",
      {
        rawOutput: "Step 1\nStep 2\nFatal Error: Database connection timeout\n    at DB.connect (db.ts:12)\nStep 3\nStep 4",
        maxOutputLines: 10,
      },
      tempDir
    )) as { summary: string; failureChunksFound: number };

    if (!toolSummaryRes.summary || !toolSummaryRes.summary.includes("Fatal Error: Database connection timeout")) {
      throw new Error(`Registry summarize_tool_output failed: ${JSON.stringify(toolSummaryRes)}`);
    }

    console.log("  [✓] Built-in 'summarize_tool_output' executed and extracted fatal error context.");
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 6: Monolith AgentEngine & Registry Pass 6 Integration
    // -------------------------------------------------------------------------
    console.log("[Test 6/6] Validating Monolith AgentEngine & ToolRegistry Pass 6 Synchronization...");
    const engine = components.agentEngine;
    if (!engine.dagPlanner || !engine.choiceOrchestrator || !registry.dagPlanner || !registry.mockHarness) {
      throw new Error("Pass 6 monolith engine/registry properties missing");
    }

    console.log("  [✓] Pass 6 Monolith AgentEngine and ToolRegistry synchronized end-to-end.");
    passedTests++;

  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }

  console.log("\n================================================================================");
  console.log(`  [✓] ALL ${passedTests}/${totalTests} DAG & MOCK ENGINE SUITES PASSED! `);
  console.log("================================================================================\n");
}

runDAGEngineSuite().catch((err) => {
  console.error("DAG engine validation failed:", err);
  process.exit(1);
});
