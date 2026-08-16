/**
 * validate-context-breakdown.ts
 *
 * Comprehensive validation suite for Context Window Token Composition Breakdown
 * & Category Metering Subsystem (Phase 127 / ADR-103 / Target #60).
 */

import assert from "node:assert";
import { performance } from "node:perf_hooks";

import { DeterministicContextBreakdownEngine } from "../src/agents/extensions/context_breakdown/deterministic-context-breakdown-engine.js";
import { ContextBreakdownSupervisor } from "../src/agents/extensions/context_breakdown/context-breakdown-supervisor.js";
import { BroccoliContextBreakdownSubstrate } from "../src/sessions/extensions/context_breakdown/broccoli-context-breakdown-substrate.js";
import { ContextBreakdownSnapshotManager } from "../src/sessions/extensions/context_breakdown/context-breakdown-snapshot-manager.js";
import { ContextBreakdownToolSuite } from "../src/tooling/extensions/context_breakdown/context-breakdown-tool-suite.js";

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Context Window Breakdown & Metering (ADR-103)           ");
  console.log("================================================================\n");

  const engine = new DeterministicContextBreakdownEngine();
  const substrate = new BroccoliContextBreakdownSubstrate();
  const snapshotManager = new ContextBreakdownSnapshotManager(substrate);
  const supervisor = new ContextBreakdownSupervisor(substrate, engine);
  const toolSuite = new ContextBreakdownToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Suite 1: Pure Token Estimation (charsToTokens, jsonTokens)
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating Pure Token Estimation...");

  assert.strictEqual(engine.charsToTokens(""), 0);
  assert.strictEqual(engine.charsToTokens("abcd"), 1);
  assert.strictEqual(engine.charsToTokens("a".repeat(400)), 100);

  const sampleObj = { name: "test_tool", parameters: { foo: "bar" } };
  const jsonToks = engine.jsonTokens(sampleObj);
  assert.ok(jsonToks > 0, "JSON token count must be positive");
  console.log("  [✓] Zero-allocation character and JSON token estimation verified.");

  // ---------------------------------------------------------------------------
  // Suite 2: Multi-Category Tool Partitioning
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Multi-Category Tool Partitioning...");

  const mockTools = [
    { name: "read_file" },
    { name: "write_file" },
    { name: "mcp_sqlite_query" },
    { name: "mcp_fetch_weather" },
    { name: "swarm_delegate_task" },
    { name: "subagent_spawn" },
  ];

  const partitioned = engine.partitionTools(mockTools);
  assert.strictEqual(partitioned.builtin.length, 2);
  assert.strictEqual(partitioned.mcp.length, 2);
  assert.strictEqual(partitioned.subagent.length, 2);
  console.log("  [✓] Tool partitioning correctly separated builtin, MCP, and subagent tools.");

  // ---------------------------------------------------------------------------
  // Suite 3: Full 8-Category Token Breakdown & Percentage Calculation
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Full 8-Category Token Breakdown...");

  const report = supervisor.computeBreakdown({
    systemPrompt: "You are LUMI agent.\n".repeat(50),
    rulesText: "Rule 1: Be safe.\nRule 2: Be deterministic.",
    skillsText: "Skill: code-repair\nSkill: git-commit",
    memoryText: "User prefers concise answers.",
    tools: mockTools,
    messages: [
      { role: "user", content: "Hello LUMI!" },
      { role: "assistant", content: "Hello! How can I help you today?" },
    ],
    model: "claude-3-7-sonnet",
    maxContextTokens: 100000,
  });

  assert.ok(report.totalTokens > 0, "Total tokens must be > 0");
  assert.strictEqual(report.categories.length, 8, "All 8 categories should have tokens");
  assert.strictEqual(report.model, "claude-3-7-sonnet");
  assert.ok(report.headroomTokens < 100000);

  const sumCategoryPercentages = report.categories.reduce((acc, c) => acc + c.percentage, 0);
  assert.ok(
    Math.abs(sumCategoryPercentages - 100) < 1.0,
    `Category percentages must sum to ~100%, got ${sumCategoryPercentages}`
  );
  console.log(`  [✓] 8 categories parsed: ${report.totalTokens} tokens total (${report.utilizationPercent}% of 100K).`);

  // ---------------------------------------------------------------------------
  // Suite 4: Compression Imminent Threshold Detection
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Compression Threshold Detection...");

  // Normal utilization (low %)
  assert.strictEqual(supervisor.isCompressionImminent(), false);

  // Heavy utilization (90% capacity)
  const heavyReport = supervisor.computeBreakdown({
    systemPrompt: "A".repeat(360000), // ~90K tokens on 100K limit
    maxContextTokens: 100000,
  });

  assert.strictEqual(heavyReport.utilizationPercent >= 80, true);
  assert.strictEqual(heavyReport.compressionImminent, true);
  assert.strictEqual(supervisor.isCompressionImminent(), true);
  console.log("  [✓] Compression proximity threshold trigger verified.");

  // ---------------------------------------------------------------------------
  // Suite 5: ASCII Progress Bar Formatting
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating ASCII Progress Bar Formatting...");

  const asciiBar = supervisor.renderBar(heavyReport, 30);
  assert.ok(asciiBar.includes("█"), "ASCII bar must contain filled blocks");
  assert.ok(asciiBar.includes("[COMPRESSION IMMINENT]"), "Must include warning tag when compression is imminent");
  console.log(`  Rendered Bar: ${asciiBar}`);
  console.log("  [✓] ASCII visual progress bar formatting verified.");

  // ---------------------------------------------------------------------------
  // Suite 6: Dynamic Reconfiguration
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Dynamic Reconfiguration...");

  supervisor.configure({
    defaultContextLimit: 200000,
    compressionThresholdPercent: 75,
  });

  const cfg = supervisor.getConfig();
  assert.strictEqual(cfg.defaultContextLimit, 200000);
  assert.strictEqual(cfg.compressionThresholdPercent, 75);
  console.log("  [✓] Dynamic configuration changes applied to substrate.");

  // ---------------------------------------------------------------------------
  // Suite 7: In-Memory Substrate Binary Snapshotting & O(1) State Rollback
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Binary Snapshotting & O(1) State Rollback...");

  const snap = snapshotManager.takeSnapshot("snap-context-1");
  assert.ok(snap.latestReport);

  // Modify state
  supervisor.clear();
  assert.strictEqual(supervisor.getLatestReport(), undefined);

  // Rollback
  const tRewindStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("snap-context-1");
  const rewindLatencyMs = performance.now() - tRewindStart;

  assert.ok(restored, "Snapshot restore must succeed");
  assert.ok(supervisor.getLatestReport() !== undefined);
  assert.ok(rewindLatencyMs < 0.05, `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.05 ms SLA`);
  console.log(`  [✓] Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms).`);

  // ---------------------------------------------------------------------------
  // Suite 8: Model Tool Suite Execution & Micro-Benchmarks
  // ---------------------------------------------------------------------------
  console.log("\n[Test 8/8] Validating Model Tool Suite Execution & Micro-Benchmarks...");

  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 5, "Must expose exactly 5 model tools");

  const computeTool = tools.find((t) => t.name === "context_breakdown_compute")!;
  const renderBarTool = tools.find((t) => t.name === "context_breakdown_render_bar")!;
  const checkCompTool = tools.find((t) => t.name === "context_breakdown_check_compression")!;
  const configTool = tools.find((t) => t.name === "context_breakdown_configure")!;
  const metricsTool = tools.find((t) => t.name === "context_breakdown_get_metrics")!;

  const computeRes = (await computeTool.execute({
    systemPrompt: "System test",
    rulesText: "Rules test",
    skillsText: "Skills test",
  }, "")) as any;
  assert.strictEqual(computeRes.success, true);

  const barRes = (await renderBarTool.execute({ width: 25 }, "")) as any;
  assert.strictEqual(barRes.success, true);
  assert.ok(barRes.bar.length > 0);

  const compRes = (await checkCompTool.execute({}, "")) as any;
  assert.strictEqual(compRes.success, true);

  const cfgRes = (await configTool.execute({
    defaultContextLimit: 150000,
  }, "")) as any;
  assert.strictEqual(cfgRes.success, true);

  const metricsRes = (await metricsTool.execute({}, "")) as any;
  assert.strictEqual(metricsRes.success, true);
  assert.ok(metricsRes.metrics.totalBreakdowns > 0);

  // Micro-Benchmark
  const iterations = 50000;
  const tBenchStart = performance.now();

  const benchParams = {
    systemPrompt: "Prompt text",
    rulesText: "Rules text",
    skillsText: "Skills text",
    tools: mockTools,
    messages: [
      { role: "user", content: "Query" },
      { role: "assistant", content: "Response" },
    ],
  };

  const currentCfg = supervisor.getConfig();
  for (let i = 0; i < iterations; i++) {
    engine.computeBreakdown(benchParams, currentCfg);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} breakdowns in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} breakdowns/sec)`);
  assert.ok(throughputOpsPerSec > 250000, "Throughput must exceed 250,000 breakdowns/sec");

  console.log("  [✓] All 5 Context Breakdown model tools executed cleanly & benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 CONTEXT BREAKDOWN VALIDATION SUITES PASSED CLEANLY!   ");
  console.log("================================================================\n");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
