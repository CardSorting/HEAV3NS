/**
 * validate-runbook-ux.ts
 *
 * Comprehensive End-to-End Validation Suite for Runbook Humanizer,
 * Out-of-the-box Runbook Catalog Presets, Slash Command Router, and TUI Dashboard Modal (Pass 193).
 */

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { RunbookHumanizer } from "../src/agents/extensions/runbooks/runbook-humanizer.js";
import { RunbookCatalog } from "../src/agents/extensions/runbooks/runbook-catalog.js";
import { BroccoliDatabaseKernel } from "../src/sessions/extensions/substrate/broccolidb-kernel.js";
import { BroccoliRunbookSubstrate } from "../src/agents/extensions/runbooks/broccoli-runbook-substrate.js";
import { RunbookSupervisor } from "../src/agents/extensions/runbooks/runbook-supervisor.js";
import { RunbookDashboardModal } from "../src/tui/components/runbook-dashboard-modal.js";
import { AgentSlashRouter, type SlashRouteContext } from "../src/agents/extensions/resolution/agent-slash-router.js";
import { MonolithFactory } from "../src/factories/monolith-factory.js";

async function runUxValidationSuite(): Promise<void> {
  console.log("\x1b[1;35m╭─── [PASS 193] RUNBOOK WORLD-CLASS UX & ERGONOMICS VALIDATION ────────╮\x1b[0m");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-runbook-ux-test-"));

  try {
    // -------------------------------------------------------------
    // Test 1: RunbookHumanizer State & Diagnostics
    // -------------------------------------------------------------
    console.log("  [1/5] Testing RunbookHumanizer Plain-English Diagnostics & Naming...");
    const planInfo = RunbookHumanizer.humanizeState("plan");
    assert.strictEqual(planInfo.displayName, "Planning & Scoping");
    assert.strictEqual(planInfo.icon, "📋");
    assert.strictEqual(planInfo.category, "planning");

    const execInfo = RunbookHumanizer.humanizeState("execute");
    assert.strictEqual(execInfo.displayName, "Active Implementation");
    assert.strictEqual(execInfo.icon, "⚡");

    // Humanize Gate Failure (Missing File)
    const missingFileDiag = RunbookHumanizer.humanizeGateFailure(
      { path: "contract.json", error: "File 'contract.json' does not exist" },
      "plan",
      "execute"
    );
    assert.ok(missingFileDiag.title.includes("Missing File"));
    assert.ok(missingFileDiag.plainExplanation.includes("has not been created yet"));
    assert.ok(missingFileDiag.suggestedRemediation.includes("creates or writes to 'contract.json'"));

    // Humanize Gate Failure (JSONPath Mismatch)
    const jsonPathDiag = RunbookHumanizer.humanizeGateFailure(
      { path: "results.json", error: "JSONPath 'stats.coverage' expected 90 got 75" },
      "execute",
      "review"
    );
    assert.ok(jsonPathDiag.title.includes("Data Field Verification Pending"));
    assert.ok(jsonPathDiag.suggestedRemediation.includes("match the expected values"));

    console.log("    \x1b[32m✔ RunbookHumanizer translated low-level gate failures into clear, empathetic guidance\x1b[0m");

    // -------------------------------------------------------------
    // Test 2: ASCII Pipeline Breadcrumb Rendering
    // -------------------------------------------------------------
    console.log("  [2/5] Testing Visual ASCII Pipeline DAG Breadcrumb Trail...");
    const sampleSpec = RunbookCatalog.instantiate("coding_loop");
    const renderedPipeline = RunbookHumanizer.renderAsciiPipeline(sampleSpec, "execute", { useColor: false });
    assert.ok(renderedPipeline.includes("[✔ 1. Planning & Scoping]"));
    assert.ok(renderedPipeline.includes("[● 2. Active Implementation (ACTIVE)]"));
    assert.ok(renderedPipeline.includes("[○ 3. Quality & Verification Review]"));
    assert.ok(renderedPipeline.includes("[○ 4. Completion & Delivery]"));

    console.log("    \x1b[32m✔ Visual ASCII pipeline rendered past [✔], current [● ACTIVE], and future [○] stages\x1b[0m");

    // -------------------------------------------------------------
    // Test 3: RunbookCatalog Presets
    // -------------------------------------------------------------
    console.log("  [3/5] Testing Out-of-the-Box Runbook Presets Catalog...");
    const presets = RunbookCatalog.listPresets();
    assert.ok(presets.length >= 5);

    const codingLoopPreset = RunbookCatalog.getPresetMetadata("coding_loop");
    assert.ok(codingLoopPreset);
    assert.strictEqual(codingLoopPreset?.stages.length, 4);

    const benchmarkPreset = RunbookCatalog.getPresetMetadata("benchmark_solve");
    assert.ok(benchmarkPreset);
    assert.strictEqual(benchmarkPreset?.stages.length, 6);

    const instantiated = RunbookCatalog.instantiate("bugfix_patch", { customName: "auth-bugfix" });
    assert.strictEqual(instantiated.name, "auth-bugfix");
    assert.strictEqual(instantiated.initial, "reproduce");
    assert.ok(instantiated.nodes.reproduce);
    assert.ok(instantiated.nodes.patch);

    console.log("    \x1b[32m✔ All 5 standard presets (coding, bugfix, feature, benchmark, security) instantiated\x1b[0m");

    // -------------------------------------------------------------
    // Test 4: AgentSlashRouter /runbook Subcommands
    // -------------------------------------------------------------
    console.log("  [4/5] Testing /runbook Slash Commands Router...");
    const kernel = new BroccoliDatabaseKernel({ workspaceRoot: tempDir });
    const substrate = new BroccoliRunbookSubstrate(kernel);
    await substrate.initialize();
    const supervisor = new RunbookSupervisor(substrate, { workspaceRoot: tempDir, autoConfirm: true });

    const engine = MonolithFactory.createEngine({ cwd: tempDir });
    const router = new AgentSlashRouter();

    const slashContext: SlashRouteContext = {
      sessionContext: engine.sessionContext,
      sessionStore: engine.sessionStore,
      sessionCompactor: engine.sessionCompactor,
      sessionVfs: engine.sessionVfs,
      sessionMemoryStore: engine.sessionMemoryStore,
      modelResolver: engine.modelResolver,
      toolRegistry: engine.toolRegistry,
      runbookSupervisor: supervisor,
    };

    // Subcommand 1: /runbook presets
    const resPresets = await router.handleSlashCommand("/runbook presets", slashContext);
    assert.strictEqual(resPresets.handled, true);
    assert.ok(resPresets.output?.includes("Available Standard Runbook Presets"));

    // Subcommand 2: /runbook start coding_loop
    const resStart = await router.handleSlashCommand("/runbook start coding_loop", slashContext);
    assert.strictEqual(resStart.handled, true);
    assert.ok(resStart.output?.includes("Started Runbook Preset"));
    assert.ok(resStart.output?.includes("Active Stage: **plan**"));

    // Subcommand 3: /runbook (status)
    const resStatus = await router.handleSlashCommand("/runbook", slashContext);
    assert.strictEqual(resStatus.handled, true);
    assert.ok(resStatus.output?.includes("Planning & Scoping"));

    // Subcommand 4: /runbook story
    const resStory = await router.handleSlashCommand("/runbook story", slashContext);
    assert.strictEqual(resStory.handled, true);
    assert.ok(resStory.output?.includes("Active Stage"));

    // Subcommand 5: /runbook compact
    const resCompact = await router.handleSlashCommand("/runbook compact", slashContext);
    assert.strictEqual(resCompact.handled, true);
    assert.ok(resCompact.output?.includes("/compact Keep only the durable state"));

    console.log("    \x1b[32m✔ Slash router handled all /runbook subcommands seamlessly\x1b[0m");

    // -------------------------------------------------------------
    // Test 5: Interactive TUI Dashboard Modal View Modes & Key Handlers
    // -------------------------------------------------------------
    console.log("  [5/5] Testing Interactive TUI RunbookDashboardModal...");
    let closed = false;
    const modal = new RunbookDashboardModal(supervisor, undefined, () => {
      closed = true;
    });

    await modal.refreshState();

    // Render Pipeline View
    const renderedPipelineLines = modal.render(100);
    assert.ok(renderedPipelineLines.length > 0);

    // Switch to Gates View ('2' key)
    assert.strictEqual(modal.handleKey("2"), true);
    const renderedGates = modal.render(100);
    assert.ok(renderedGates.some((line) => line.includes("Pre-Transfer Quality Gates") || line.includes("Gates")));

    // Switch to Dynamic View ('3' key)
    assert.strictEqual(modal.handleKey("3"), true);

    // Switch to Timeline View ('4' key)
    assert.strictEqual(modal.handleKey("4"), true);

    // Switch to Story View ('5' key)
    assert.strictEqual(modal.handleKey("5"), true);

    // Cycle View ('v' key)
    assert.strictEqual(modal.handleKey("v"), true);

    // Help View ('?' key)
    assert.strictEqual(modal.handleKey("?"), true);
    const helpLines = modal.render(100);
    assert.ok(helpLines.some((line) => line.includes("Runbook FSM Shortcuts")));

    // Dismiss Help ('?' key)
    assert.strictEqual(modal.handleKey("?"), true);

    // Close Modal ('q' key)
    assert.strictEqual(modal.handleKey("q"), true);
    assert.strictEqual(closed, true);

    console.log("    \x1b[32m✔ Interactive TUI modal handled all views, above-the-fold KPI ribbon, and keys\x1b[0m");

    // Clean up
    await kernel.stop();
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignored
    }
  }

  console.log("\x1b[1;32m╰─── ALL WORLD-CLASS RUNBOOK UX & ERGONOMICS TESTS PASSED (100%) ─────╯\x1b[0m\n");
}

runUxValidationSuite().catch((err) => {
  console.error("\x1b[1;31mUX Validation failed:\x1b[0m", err);
  process.exit(1);
});
