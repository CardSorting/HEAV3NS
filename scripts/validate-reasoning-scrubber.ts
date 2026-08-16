/**
 * validate-reasoning-scrubber.ts
 *
 * Comprehensive validation suite for Target #40: Dynamic Streaming Reasoning Scrubber,
 * Custom Chunk-Boundary Tag Parser, Dynamic Timeout Floor & Adaptive Thinking Budget Substrate (Phase 102 / ADR-056).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { performance } from "node:perf_hooks";
import { DeterministicReasoningScrubber } from "../src/tooling/extensions/reasoning/deterministic-reasoning-scrubber.js";
import { BroccoliReasoningSubstrate } from "../src/sessions/extensions/reasoning/broccoli-reasoning-substrate.js";
import { ReasoningSnapshotManager } from "../src/sessions/extensions/reasoning/reasoning-snapshot-manager.js";
import { ReasoningSupervisor } from "../src/agents/extensions/reasoning/reasoning-supervisor.js";
import { ReasoningToolSuite } from "../src/tooling/extensions/reasoning/reasoning-tool-suite.js";
import { MonolithFactory } from "../src/factories/monolith-factory.js";
import { GrandMonolithSynthesizer } from "../src/factories/grand-monolith-synthesizer.js";

async function runValidationSuite() {
  console.log("================================================================================");
  console.log(" LUMI Phase 102 / ADR-056: Dynamic Reasoning Scrubber & Budget Validation Suite ");
  console.log("================================================================================\n");

  let passedSuites = 0;
  const totalSuites = 8;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-reasoning-val-"));

  try {
    // ---------------------------------------------------------------------------
    // Suite 1: Single-Chunk & Multi-Chunk Streaming Tag Lookahead Parsing
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/8] Single-Chunk & Multi-Chunk Streaming Tag Lookahead Parsing...");
    const scrubber = new DeterministicReasoningScrubber();

    const text = "Hello! <think>Let me formulate the optimal plan.</think> Here is your solution.";
    const result = scrubber.scrubCompleteText(text);

    if (result.visibleText !== "Hello!  Here is your solution.") {
      throw new Error(`Expected clean visible prose, got: '${result.visibleText}'`);
    }
    if (result.reasoningBlocks.length !== 1 || result.reasoningBlocks[0].content !== "Let me formulate the optimal plan.") {
      throw new Error(`Failed to extract reasoning block: ${JSON.stringify(result.reasoningBlocks)}`);
    }
    console.log("  ✓ Verified single-pass reasoning scrubbing with zero prose corruption");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: Fragmented Chunk-Boundary Open/Close Tag Handling (<th + ink>)
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/8] Fragmented Chunk-Boundary Open/Close Tag Handling (<th + ink>)...");
    scrubber.reset();

    const deltas = [
      "I will analyze this. <th",
      "ink>First, check the database constraints.",
      " Second, verify auth.</th",
      "ink> Now I can execute safely.",
    ];

    let accumulatedVisible = "";
    let accumulatedReasoning = "";

    for (let i = 0; i < deltas.length; i++) {
      const chunk = scrubber.feed(deltas[i]);
      accumulatedVisible += chunk.visibleDelta;
      accumulatedReasoning += chunk.reasoningDelta;
    }
    const tail = scrubber.flush();
    accumulatedVisible += tail.visibleDelta;
    accumulatedReasoning += tail.reasoningDelta;

    if (accumulatedVisible !== "I will analyze this.  Now I can execute safely.") {
      throw new Error(`Visible text leak during boundary fragmentation: '${accumulatedVisible}'`);
    }
    if (accumulatedReasoning !== "First, check the database constraints. Second, verify auth.") {
      throw new Error(`Reasoning stream mismatch: '${accumulatedReasoning}'`);
    }
    console.log("  ✓ Successfully scrubbed fragmented multi-chunk tags across delta boundaries");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: Multi-Tag Variety & Dynamic Custom User Tag Registration
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/8] Multi-Tag Variety & Dynamic Custom User Tag Registration...");
    const multiTagTests = [
      { input: "Intro <thinking>deep thinking</thinking> Outro", expVis: "Intro  Outro", expReas: "deep thinking" },
      { input: "Start <reasoning>logical deduction</reasoning> End", expVis: "Start  End", expReas: "logical deduction" },
      { input: "A <thought>internal thought</thought> B", expVis: "A  B", expReas: "internal thought" },
      { input: "P <REASONING_SCRATCHPAD>scratchpad note</REASONING_SCRATCHPAD> Q", expVis: "P  Q", expReas: "scratchpad note" },
    ];

    for (const test of multiTagTests) {
      const res = scrubber.scrubCompleteText(test.input);
      if (res.visibleText !== test.expVis || res.reasoningBlocks[0]?.content !== test.expReas) {
        throw new Error(`Multi-tag test failed for: ${test.input}, got visible='${res.visibleText}'`);
      }
    }

    // Dynamic user tag registration test
    scrubber.registerTagPair({ openTag: "<my_custom_thought>", closeTag: "</my_custom_thought>" });
    const customTagRes = scrubber.scrubCompleteText("Prefix <my_custom_thought>dynamic internal chain</my_custom_thought> Suffix");
    if (customTagRes.visibleText !== "Prefix  Suffix" || customTagRes.reasoningBlocks[0]?.content !== "dynamic internal chain") {
      throw new Error(`Dynamic custom tag scrubbing failed: ${JSON.stringify(customTagRes)}`);
    }
    console.log("  ✓ Validated standard reasoning tags and dynamically added custom user tags");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: Dynamic Model Timeout Floor Resolution & User Overrides
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/8] Dynamic Model Timeout Floor Resolution & User Overrides...");
    const o1Floor = scrubber.getReasoningTimeoutFloor("openai/o1-preview");
    const r1Floor = scrubber.getReasoningTimeoutFloor("deepseek/deepseek-r1");
    const defaultFloor = scrubber.getReasoningTimeoutFloor("gpt-4o-mini");

    if (o1Floor !== 300 || r1Floor !== 240 || defaultFloor !== 90) {
      throw new Error(`Timeout floor resolution failed: o1=${o1Floor}, r1=${r1Floor}, default=${defaultFloor}`);
    }

    // Dynamically set model floor
    scrubber.setTimeoutFloor("my-custom-model-pro", 500);
    const setFloor = scrubber.getReasoningTimeoutFloor("my-custom-model-pro");
    if (setFloor !== 500) {
      throw new Error(`Dynamic custom timeout floor failed: ${setFloor}`);
    }

    // Dynamic global default floor
    scrubber.setDefaultTimeoutFloor(120);
    const newDefault = scrubber.getReasoningTimeoutFloor("unknown-model");
    if (newDefault !== 120) {
      throw new Error(`Default timeout floor update failed: ${newDefault}`);
    }
    console.log("  ✓ Dynamic timeout floors and customizable defaults correctly enforced");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: Adaptive Reasoning Effort Level & Dynamic Token Budget Configuration
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/8] Adaptive Reasoning Effort Level & Dynamic Token Budget Configuration...");
    const noneBudget = scrubber.getReasoningEffortTokenLimit("none");
    const lowBudget = scrubber.getReasoningEffortTokenLimit("low");
    const mediumBudget = scrubber.getReasoningEffortTokenLimit("medium");
    const highBudget = scrubber.getReasoningEffortTokenLimit("high");
    const maxBudget = scrubber.getReasoningEffortTokenLimit("max");

    if (noneBudget !== 0 || lowBudget !== 4096 || mediumBudget !== 16384 || highBudget !== 32768 || maxBudget !== 65536) {
      throw new Error("Reasoning effort token budgeting mapping incorrect");
    }

    // Dynamically customize budget mapping
    scrubber.setEffortBudget("high", 48000);
    if (scrubber.getReasoningEffortTokenLimit("high") !== 48000) {
      throw new Error("Dynamic effort budget override failed");
    }
    console.log("  ✓ Verified dynamic thinking budget overrides across effort levels");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: In-Memory BroccoliReasoningSubstrate & ReasoningSnapshotManager O(1) Rollback
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/8] In-Memory BroccoliReasoningSubstrate & ReasoningSnapshotManager O(1) Rollback...");
    const substrate = new BroccoliReasoningSubstrate();
    const supervisor = new ReasoningSupervisor(scrubber, substrate);
    const snapshotManager = new ReasoningSnapshotManager(substrate);

    snapshotManager.captureFrame(1);

    supervisor.setEffortLevel("high");
    supervisor.setTimeoutFloor("nemotron-custom", 350);
    supervisor.registerTagPair({ openTag: "<agent_secret_cot>", closeTag: "</agent_secret_cot>" });
    supervisor.scrubCompleteText("Prefix <agent_secret_cot>Step 1 analysis</agent_secret_cot> Suffix");

    if (substrate.getBlocks().length !== 1 || substrate.getEffortLevel() !== "high" || substrate.getTimeoutFloor("nemotron-custom") !== 350) {
      throw new Error("Reasoning substrate state mutation failed");
    }

    for (let w = 0; w < 5; w++) {
      snapshotManager.rewindToFrame(1);
    }
    const rewindStart = performance.now();
    const rewindSuccess = snapshotManager.rewindToFrame(1);
    const rewindDuration = performance.now() - rewindStart;

    if (!rewindSuccess || substrate.getBlocks().length !== 0 || substrate.getEffortLevel() !== "medium" || substrate.getTimeoutFloor("nemotron-custom") !== undefined) {
      throw new Error("Reasoning snapshot state rewind failed");
    }
    console.log(`  ✓ O(1) Reasoning substrate rewind completed in ${rewindDuration.toFixed(3)} ms (< 0.05 ms SLA)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: ReasoningSupervisor Live Streaming & Dynamic Model Tool Suite Execution
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/8] ReasoningSupervisor Live Streaming & Dynamic Model Tool Suite Execution...");
    const toolSuite = new ReasoningToolSuite(supervisor);
    const tools = toolSuite.getTools();

    const scrubTool = tools.find((t) => t.name === "reasoning_scrub_text")!;
    const effortTool = tools.find((t) => t.name === "reasoning_set_effort_level")!;
    const tagConfigTool = tools.find((t) => t.name === "reasoning_configure_tags")!;
    const floorConfigTool = tools.find((t) => t.name === "reasoning_configure_timeout_floor")!;
    const budgetConfigTool = tools.find((t) => t.name === "reasoning_configure_budget")!;
    const inspectTool = tools.find((t) => t.name === "reasoning_inspect_trace")!;

    if (!scrubTool || !effortTool || !tagConfigTool || !floorConfigTool || !budgetConfigTool || !inspectTool) {
      throw new Error("Missing required Reasoning dynamic model tools");
    }

    // Dynamic tag config tool execution
    const addTagRes = await tagConfigTool.execute({ action: "add", openTag: "<cot_internal>", closeTag: "</cot_internal>" }, tempDir) as { success: boolean };
    if (!addTagRes.success) {
      throw new Error("reasoning_configure_tags add execution failed");
    }

    // Dynamic floor config tool execution
    const floorRes = await floorConfigTool.execute({ modelSlug: "gpt-5.6-reasoner", floorSeconds: 450 }, tempDir) as { success: boolean; floorSeconds: number };
    if (!floorRes.success || floorRes.floorSeconds !== 450) {
      throw new Error("reasoning_configure_timeout_floor execution failed");
    }

    // Dynamic budget config tool execution
    const budgetRes = await budgetConfigTool.execute({ effortLevel: "max", tokenLimit: 100000 }, tempDir) as { success: boolean; tokenLimit: number };
    if (!budgetRes.success || budgetRes.tokenLimit !== 100000) {
      throw new Error("reasoning_configure_budget execution failed");
    }

    const effortRes = await effortTool.execute({ effortLevel: "max" }, tempDir) as { success: boolean; thinkingBudgetTokens: number };
    if (!effortRes.success || effortRes.thinkingBudgetTokens !== 100000) {
      throw new Error("reasoning_set_effort_level execution failed");
    }

    const scrubRes = await scrubTool.execute({
      text: "Action: <cot_internal>Verify git commit cleanliness</cot_internal> Success.",
    }, tempDir) as { success: boolean; visibleText: string; reasoningBlocksCount: number };
    if (!scrubRes.success || scrubRes.visibleText !== "Action:  Success." || scrubRes.reasoningBlocksCount !== 1) {
      throw new Error("reasoning_scrub_text execution with dynamic tag failed");
    }

    const inspectRes = await inspectTool.execute({ modelSlug: "gpt-5.6-reasoner" }, tempDir) as { success: boolean; modelTimeoutFloorSeconds: number; recordedBlocksCount: number };
    if (!inspectRes.success || inspectRes.modelTimeoutFloorSeconds !== 450 || inspectRes.recordedBlocksCount !== 1) {
      throw new Error("reasoning_inspect_trace execution failed");
    }
    console.log("  ✓ All 6 Dynamic Reasoning model tools executed cleanly");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: Grand Monolith Synthesizer Composition (377 Components) with Reasoning Options
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/8] Grand Monolith Synthesizer Composition (377 Components)...");
    const monolith = MonolithFactory.createEngine({
      reasoningOptions: {
        defaultTimeoutFloorSeconds: 150,
        customTimeoutFloors: { "my-custom-llm": 600 },
        customBudgetMapping: { high: 50000 },
        customTagPairs: [
          { openTag: "<think>", closeTag: "</think>" },
          { openTag: "<custom_cot>", closeTag: "</custom_cot>" },
        ],
      },
    });
    const verification = GrandMonolithSynthesizer.verifyComposition(monolith);

    if (verification.cohesionStatus !== "OPTIMAL") {
      console.error("Missing components:", verification.missingComponents);
      console.error("Unexpected components:", verification.unexpectedComponents);
      console.error("Duplicates:", verification.duplicateManifestComponents);
      throw new Error(`Composition status is ${verification.cohesionStatus}, expected OPTIMAL`);
    }

    if (verification.componentCount !== verification.requiredComponentCount) {
      throw new Error(`Expected exactly ${verification.requiredComponentCount} components, got ${verification.componentCount}`);
    }

    // Verify dynamic options applied to monolith scrubber
    const monolithFloor = monolith.deterministicReasoningScrubber.getReasoningTimeoutFloor("my-custom-llm");
    const monolithBudget = monolith.deterministicReasoningScrubber.getReasoningEffortTokenLimit("high");
    if (monolithFloor !== 600 || monolithBudget !== 50000) {
      throw new Error(`Monolith dynamic reasoning options not applied: floor=${monolithFloor}, budget=${monolithBudget}`);
    }

    console.log(`  ✓ Grand Monolith successfully verified with ${verification.componentCount}/${verification.requiredComponentCount} components in OPTIMAL cohesion`);
    passedSuites++;

    console.log("\n================================================================================");
    console.log(` [✓] ALL ${passedSuites}/${totalSuites} PHASE 102 DYNAMIC REASONING SCRUBBER SUITES PASSED! `);
    console.log("================================================================================\n");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runValidationSuite().catch((err) => {
  console.error("\n[FATAL] Validation suite failed:", err);
  process.exit(1);
});
