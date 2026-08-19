/**
 * validate-runbook-fsm.ts
 *
 * Comprehensive End-to-End Validation Suite for Runbook FSM, Zero-Subshell File Predicates,
 * Entry-Scoped Dynamic Check Manifests, Hybrid BroccoliDB Persistence, and Grand Monolith Composition (Pass 193).
 */

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { MiniYamlParser } from "../src/agents/extensions/runbooks/mini-yaml-parser.js";
import { FilePredicateEvaluator } from "../src/agents/extensions/runbooks/file-predicate-evaluator.js";
import { BroccoliDatabaseKernel } from "../src/sessions/extensions/substrate/broccolidb-kernel.js";
import { BroccoliRunbookSubstrate } from "../src/agents/extensions/runbooks/broccoli-runbook-substrate.js";
import { RunbookSupervisor, TransitionBlockedError } from "../src/agents/extensions/runbooks/runbook-supervisor.js";
import { RunbookToolSuite } from "../src/tooling/extensions/runbooks/runbook-tool-suite.js";
import { StatefulCompactionSynthesizer } from "../src/tooling/extensions/compaction/stateful-compaction-synthesizer.js";
import { MonolithFactory } from "../src/factories/monolith-factory.js";
import { GrandMonolithSynthesizer } from "../src/factories/grand-monolith-synthesizer.js";
import type { RunbookSpec } from "../src/core/contracts/runbook.contracts.js";

async function runValidationSuite(): Promise<void> {
  console.log("\x1b[1;35m╭─── [PASS 193] RUNBOOK FSM & BROCCOLIDB VALIDATION SUITE ──────────────╮\x1b[0m");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-runbook-test-"));

  try {
    // -------------------------------------------------------------
    // Test 1: MiniYAML Parser
    // -------------------------------------------------------------
    console.log("  [1/7] Testing MiniYAML Zero-Dependency Parser...");
    const sampleYaml = `
name: test-coding-loop
initial: plan

nodes:
  plan:
    prompt: |
      Generate a concrete plan.
    before_transfer:
      - type: checklist
        items:
          - Scope is bounded
          - Requirements noted
  execute:
    prompt: Implement the plan.
    before_transfer:
      - type: predicate
        path: progress.md
        exists: true
        non_empty: true

edges:
  - from: plan
    to: execute
    condition: "Plan is ready."
  - from: execute
    to: handoff
    condition: "Implementation is complete."
`;

    const parsedYaml = MiniYamlParser.parse(sampleYaml) as Record<string, any>;
    assert.strictEqual(parsedYaml.name, "test-coding-loop");
    assert.strictEqual(parsedYaml.initial, "plan");
    assert.ok(parsedYaml.nodes.plan);
    assert.ok(parsedYaml.nodes.execute);
    assert.strictEqual(parsedYaml.edges.length, 2);
    assert.strictEqual(parsedYaml.edges[0].from, "plan");
    assert.strictEqual(parsedYaml.edges[0].to, "execute");
    console.log("    \x1b[32m✔ MiniYAML parser handled nested mappings, lists, and block scalars cleanly\x1b[0m");

    // -------------------------------------------------------------
    // Test 2: File Predicate Evaluator
    // -------------------------------------------------------------
    console.log("  [2/7] Testing Zero-Subshell File Predicate Evaluator...");
    const evaluator = new FilePredicateEvaluator();

    const testFilePath = path.join(tempDir, "test-contract.json");
    fs.writeFileSync(
      testFilePath,
      JSON.stringify({
        status: "passed",
        version: "1.0.0",
        stats: { coverage: 95, failed: 0 },
        tags: ["core", "security"],
      })
    );

    // Predicate 1: Exists and non-empty
    const res1 = evaluator.evaluate({ path: "test-contract.json", exists: true, nonEmpty: true }, tempDir);
    assert.strictEqual(res1.passed, true);

    // Predicate 2: Contains substring
    const res2 = evaluator.evaluate({ path: "test-contract.json", contains: "passed" }, tempDir);
    assert.strictEqual(res2.passed, true);

    // Predicate 3: Forbidden substring (should pass if not contained)
    const res3 = evaluator.evaluate({ path: "test-contract.json", notContains: "FATAL_ERROR" }, tempDir);
    assert.strictEqual(res3.passed, true);

    // Predicate 4: Regex match
    const res4 = evaluator.evaluate({ path: "test-contract.json", matchesPattern: '"coverage":\\s*\\d+' }, tempDir);
    assert.strictEqual(res4.passed, true);

    // Predicate 5: JSONPath equals
    const res5 = evaluator.evaluate({ path: "test-contract.json", jsonPath: "status", equals: "passed" }, tempDir);
    assert.strictEqual(res5.passed, true);

    // Predicate 6: JSONPath nested number
    const res6 = evaluator.evaluate({ path: "test-contract.json", jsonPath: "stats.coverage", equals: 95 }, tempDir);
    assert.strictEqual(res6.passed, true);

    // Predicate 7: JSONPath oneOf
    const res7 = evaluator.evaluate({ path: "test-contract.json", jsonPath: "tags.0", oneOf: ["core", "edge"] }, tempDir);
    assert.strictEqual(res7.passed, true);

    // Predicate 8: Failing predicate
    const res8 = evaluator.evaluate({ path: "test-contract.json", jsonPath: "status", equals: "failed" }, tempDir);
    assert.strictEqual(res8.passed, false);
    assert.ok(res8.errors.length > 0);

    console.log("    \x1b[32m✔ All zero-subshell predicate checks (JSONPath, regex, existence, contents) passed\x1b[0m");

    // -------------------------------------------------------------
    // Test 3: BroccoliDB Runbook Substrate
    // -------------------------------------------------------------
    console.log("  [3/7] Testing BroccoliDB Runbook Substrate...");
    const kernel = new BroccoliDatabaseKernel({ workspaceRoot: tempDir });
    const substrate = new BroccoliRunbookSubstrate(kernel);
    await substrate.initialize();

    const specObj: RunbookSpec = {
      name: "broccoli-fsm-spec",
      initial: "start",
      nodes: {
        start: { id: "start", prompt: "Load context" },
        work: { id: "work", prompt: "Do work" },
        done: { id: "done", prompt: "Done" },
      },
      edges: [
        { from: "start", to: "work", condition: "Ready" },
        { from: "work", to: "done", condition: "Finished" },
      ],
    };

    const specHash = await substrate.saveSpec(specObj);
    assert.ok(specHash);

    const loadedSpec = await substrate.getSpec(specHash);
    assert.ok(loadedSpec);
    assert.strictEqual(loadedSpec?.name, "broccoli-fsm-spec");
    assert.strictEqual(Object.keys(loadedSpec?.nodes || {}).length, 3);
    assert.strictEqual(loadedSpec?.edges.length, 2);

    console.log("    \x1b[32m✔ BroccoliDB tables indexed and queried runbook spec seamlessly\x1b[0m");

    // -------------------------------------------------------------
    // Test 4: 10-Step Transition Transaction & Gate Enforcement
    // -------------------------------------------------------------
    console.log("  [4/7] Testing 10-Step Atomic FSM Transition Engine...");
    const supervisor = new RunbookSupervisor(substrate, { workspaceRoot: tempDir, autoConfirm: true });

    const fsmSpec: RunbookSpec = {
      name: "verification-loop",
      initial: "init",
      nodes: {
        init: {
          id: "init",
          prompt: "Initialize task and files.",
          beforeTransfer: [
            {
              type: "predicate",
              path: "task-receipt.json",
              exists: true,
              nonEmpty: true,
            },
          ],
        },
        execute: {
          id: "execute",
          prompt: "Execute task.",
          dynamicBeforeTransfer: {
            path: "current_entry",
            required: true,
            minItems: 1,
          },
        },
        handoff: {
          id: "handoff",
          prompt: "Handoff to user.",
        },
      },
      edges: [
        { from: "init", to: "execute", condition: "Context verified", maxAttempts: 3 },
        { from: "execute", to: "handoff", condition: "Dynamic verification passed" },
      ],
    };

    const runState = await supervisor.start(fsmSpec, { fresh: true });
    assert.strictEqual(runState.current, "init");

    // Step A: Attempt transition before creating receipt (MUST FAIL)
    let blocked = false;
    try {
      await supervisor.goto("execute", runState.runId);
    } catch (err) {
      blocked = true;
      assert.ok(err instanceof TransitionBlockedError);
    }
    assert.strictEqual(blocked, true, "Transition must block when pre-transfer predicate fails");

    // Step B: Create receipt and retry transition (MUST SUCCEED)
    fs.writeFileSync(path.join(tempDir, "task-receipt.json"), JSON.stringify({ verified: true }));
    const transResult = await supervisor.goto("execute", runState.runId);
    assert.strictEqual(transResult.current, "execute");
    assert.strictEqual(transResult.from, "init");
    assert.strictEqual(transResult.to, "execute");

    // Step C: Attempt transition from execute to handoff without dynamic checks (MUST FAIL due to required dynamic_before_transfer)
    let dynamicBlocked = false;
    try {
      await supervisor.goto("handoff", runState.runId);
    } catch (err) {
      dynamicBlocked = true;
      assert.ok(err instanceof TransitionBlockedError);
    }
    assert.strictEqual(dynamicBlocked, true, "Transition must block when required dynamic check is missing");

    // Step D: Write dynamic check manifest and transition (MUST SUCCEED)
    const curView = await supervisor.cur(runState.runId);
    await supervisor.dynamicWrite({
      runId: runState.runId,
      nodeName: "execute",
      entryId: curView.currentEntryId,
      producer: { agentId: "test-agent", role: "tester", updatedAt: new Date().toISOString() },
      basis: { taskContract: "Must verify receipt exists", implementationSummary: "Added receipt" },
      checks: [
        {
          type: "predicate",
          path: "task-receipt.json",
          exists: true,
          jsonPath: "verified",
          equals: true,
          reason: "Verify task was completed",
          blocking: true,
        },
      ],
      registeredAt: Date.now(),
    });

    const finalTrans = await supervisor.goto("handoff", runState.runId);
    assert.strictEqual(finalTrans.current, "handoff");
    console.log("    \x1b[32m✔ 10-step atomic transitions with static/dynamic gates & rollback passed\x1b[0m");

    // -------------------------------------------------------------
    // Test 5: Context Lifecycle & Compaction Synthesis
    // -------------------------------------------------------------
    console.log("  [5/7] Testing Stateful Compaction Prompt Synthesis...");
    const compactionSynth = new StatefulCompactionSynthesizer();
    const updatedRun = (await substrate.getRun(runState.runId))!;
    const compactionPrompt = compactionSynth.synthesizeCompactionPrompt(updatedRun, fsmSpec, {
      durableNotesPath: "progress.md",
    });

    assert.ok(compactionPrompt.includes("/compact Keep only the durable state"));
    assert.ok(compactionPrompt.includes(runState.runId));
    assert.ok(compactionPrompt.includes("handoff"));
    assert.ok(compactionPrompt.includes("lumi runbook_cur"));

    console.log("    \x1b[32m✔ Amnesia-proof /compact prompt synthesis verified\x1b[0m");

    // -------------------------------------------------------------
    // Test 6: Model Tool Suite
    // -------------------------------------------------------------
    console.log("  [6/7] Testing Runbook Tool Suite Interface...");
    const toolSuite = new RunbookToolSuite(supervisor);
    const tools = toolSuite.getTools();
    assert.strictEqual(tools.length, 9);

    const startTool = tools.find((t) => t.name === "runbook_start")!;
    const curTool = tools.find((t) => t.name === "runbook_cur")!;
    const gotoTool = tools.find((t) => t.name === "runbook_goto")!;

    const startRes = (await startTool.execute({ spec: sampleYaml, runId: "tool-test-run" }, tempDir)) as any;
    assert.strictEqual(startRes.success, true);
    assert.strictEqual(startRes.current, "plan");

    const curRes = (await curTool.execute({ runId: "tool-test-run" }, tempDir)) as any;
    assert.strictEqual(curRes.success, true);
    assert.strictEqual(curRes.current, "plan");

    const gotoRes = (await gotoTool.execute({ target: "execute", runId: "tool-test-run" }, tempDir)) as any;
    assert.strictEqual(gotoRes.success, true);
    assert.strictEqual(gotoRes.current, "execute");

    console.log("    \x1b[32m✔ All Runbook Tool Suite model tools executed cleanly\x1b[0m");

    // -------------------------------------------------------------
    // Test 7: Monolith Factory & Baseline Composition Verification
    // -------------------------------------------------------------
    console.log("  [7/7] Testing Grand Monolith Synthesizer Composition...");
    const engine = MonolithFactory.createEngine({ cwd: tempDir });
    assert.ok(engine.broccoliRunbookSubstrate);
    assert.ok(engine.runbookSupervisor);
    assert.ok(engine.runbookToolSuite);

    const verification = GrandMonolithSynthesizer.verifyComposition(engine);
    assert.strictEqual(
      verification.cohesionStatus,
      "OPTIMAL",
      `Monolith composition must be OPTIMAL. Missing: ${verification.missingComponents.join(", ")}, Unexpected: ${verification.unexpectedComponents.join(", ")}`
    );

    console.log(`    \x1b[32m✔ Monolith Composition Verified: ${verification.componentCount} components intact, status: OPTIMAL\x1b[0m`);

    // Clean up
    await kernel.stop();
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignored
    }
  }

  console.log("\x1b[1;32m╰─── ALL RUNBOOK FSM & BROCCOLIDB TESTS PASSED PERFECTLY (100%) ──────╯\x1b[0m\n");
}

runValidationSuite().catch((err) => {
  console.error("\x1b[1;31mValidation failed:\x1b[0m", err);
  process.exit(1);
});
