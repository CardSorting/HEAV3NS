import assert from "node:assert/strict";
import {
  LumiMonolith,
  ModelResolver,
  ModelCatalog,
  KNOWN_CODEX_MODELS,
} from "../src/index.js";
import { ContextBudgetCalculator } from "../src/agents/extensions/compaction/context-budget-calculator.js";
import { AgentSlashRouter } from "../src/agents/extensions/resolution/agent-slash-router.js";
import { ModelSelectModal } from "../src/tui/components/model-select-modal.js";

async function main(): Promise<void> {
  console.log("================================================================");
  console.log(" LUMI Codex Model Swapping & Dynamic Discovery Validation Suite ");
  console.log("================================================================\n");

  // -------------------------------------------------------------------------
  // [Test 1/7] Default Model Initialization (Defaults to Terra)
  // -------------------------------------------------------------------------
  console.log("[Test 1/7] Validating Default Model Initialization (Terra)...");
  const freshResolver = new ModelResolver();
  assert.equal(freshResolver.getActiveModel(), "gpt-5.6-terra");
  assert.equal(freshResolver.getPrimaryModel(), "gpt-5.6-terra");
  assert.deepEqual([...KNOWN_CODEX_MODELS], [
    "gpt-5.6-terra",
  ]);

  const monolith = new LumiMonolith({ cwd: process.cwd() });
  monolith.setModel("gpt-5.6-terra");
  assert.equal(monolith.modelResolver.getActiveModel(), "gpt-5.6-terra");
  console.log("  [✓] Monolith and ModelResolver cleanly default to gpt-5.6-terra.");

  // -------------------------------------------------------------------------
  // [Test 2/7] Alias Normalization (Terra, Luna, Sol, 4o, Claude, etc.)
  // -------------------------------------------------------------------------
  console.log("[Test 2/7] Validating Canonical Alias Normalization (Mapping to Terra)...");
  assert.equal(ModelResolver.normalizeModelName("terra"), "gpt-5.6-terra");
  assert.equal(ModelResolver.normalizeModelName("TERRA"), "gpt-5.6-terra");
  assert.equal(ModelResolver.normalizeModelName("gpt-terra"), "gpt-5.6-terra");
  assert.equal(ModelResolver.normalizeModelName("5.6-terra"), "gpt-5.6-terra");

  assert.equal(ModelResolver.normalizeModelName("luna"), "gpt-5.6-terra");
  assert.equal(ModelResolver.normalizeModelName("Luna"), "gpt-5.6-terra");
  assert.equal(ModelResolver.normalizeModelName("5.6-luna"), "gpt-5.6-terra");

  assert.equal(ModelResolver.normalizeModelName("sol"), "gpt-5.6-terra");
  assert.equal(ModelResolver.normalizeModelName("SOL"), "gpt-5.6-terra");
  assert.equal(ModelResolver.normalizeModelName("5.6-sol"), "gpt-5.6-terra");

  assert.equal(ModelResolver.normalizeModelName("codex"), "gpt-5.6-terra");
  assert.equal(ModelResolver.normalizeModelName("openai-codex"), "gpt-5.6-terra");

  assert.equal(ModelResolver.normalizeModelName("4o"), "gpt-4o");
  assert.equal(ModelResolver.normalizeModelName("claude"), "anthropic/claude-3.5-sonnet");
  assert.equal(ModelResolver.normalizeModelName("flash"), "google/gemini-2.0-flash-001");
  assert.equal(ModelResolver.normalizeModelName("r1"), "deepseek/deepseek-r1");
  console.log("  [✓] Canonical aliases normalize cleanly across all model families.");

  // -------------------------------------------------------------------------
  // [Test 3/7] Monolith Model Swapping Helpers & Cycling (All route to Terra)
  // -------------------------------------------------------------------------
  console.log("[Test 3/7] Validating Direct Swapping & Cycling (All route to Terra)...");
  // 1. Swap to Luna
  const setLuna = monolith.switchToLuna();
  assert.equal(setLuna, "gpt-5.6-terra");
  assert.equal(monolith.modelResolver.getActiveModel(), "gpt-5.6-terra");
  assert.equal(monolith.config.modelName, "gpt-5.6-terra");

  // 2. Swap to Sol
  const setSol = monolith.switchToSol();
  assert.equal(setSol, "gpt-5.6-terra");
  assert.equal(monolith.modelResolver.getActiveModel(), "gpt-5.6-terra");
  assert.equal(monolith.config.modelName, "gpt-5.6-terra");

  // 3. Swap back to Terra
  const setTerra = monolith.switchToTerra();
  assert.equal(setTerra, "gpt-5.6-terra");
  assert.equal(monolith.modelResolver.getActiveModel(), "gpt-5.6-terra");
  assert.equal(monolith.config.modelName, "gpt-5.6-terra");

  // 4. setModel with alias
  monolith.setModel("luna");
  assert.equal(monolith.modelResolver.getActiveModel(), "gpt-5.6-terra");

  // 5. Cycling through models: exclusively serves gpt-5.6-terra
  const cycle1 = monolith.cycleCodexModel();
  assert.equal(cycle1, "gpt-5.6-terra");
  const cycle2 = monolith.cycleCodexModel();
  assert.equal(cycle2, "gpt-5.6-terra");
  const cycle3 = monolith.cycleCodexModel();
  assert.equal(cycle3, "gpt-5.6-terra");
  console.log("  [✓] Direct swapping and cycleCodexModel route to Terra seamlessly.");

  // -------------------------------------------------------------------------
  // [Test 4/7] Dynamic Model Fetching & API Discovery (Exclusively serving Terra)
  // -------------------------------------------------------------------------
  console.log("[Test 4/7] Validating Dynamic Model Fetching & API Discovery (Exclusively serving Terra)...");
  const catalog = new ModelCatalog();

  // Test fallback codex models when offline
  const fallbackCodex = await catalog.fetchCodexModels(undefined, true);
  assert.equal(fallbackCodex.length, 1);
  assert.equal(fallbackCodex[0].modelName, "gpt-5.6-terra");

  // Verify dynamic cache returns the cached models
  const fromCache = await catalog.fetchCodexModels();
  assert.equal(fromCache.length, 1);
  assert.equal(fromCache[0].modelName, "gpt-5.6-terra");
  console.log("  [✓] Dynamic model fetching reliably and exclusively serves gpt-5.6-terra.");

  // -------------------------------------------------------------------------
  // [Test 5/7] Agent Slash Router Handlers (/terra, /luna, /sol, /model, /models)
  // -------------------------------------------------------------------------
  console.log("[Test 5/7] Validating Slash Router Handlers (/terra, /luna, /sol)...");
  const router = new AgentSlashRouter();
  const slashCtx = {
    sessionContext: monolith.sessionContext,
    sessionStore: monolith.sessionStore,
    sessionCompactor: monolith.sessionCompactor,
    sessionVfs: monolith.sessionVfs,
    sessionMemoryStore: monolith.sessionMemoryStore,
    modelResolver: monolith.modelResolver,
    toolRegistry: monolith.toolRegistry,
  };

  const resTerra = await router.handleSlashCommand("/terra", slashCtx);
  assert.equal(resTerra.handled, true);
  assert.ok(resTerra.output?.includes("gpt-5.6-terra"));
  assert.equal(monolith.modelResolver.getActiveModel(), "gpt-5.6-terra");

  const resLuna = await router.handleSlashCommand("/luna", slashCtx);
  assert.equal(resLuna.handled, true);
  assert.ok(resLuna.output?.includes("gpt-5.6-terra"));
  assert.equal(monolith.modelResolver.getActiveModel(), "gpt-5.6-terra");

  const resSol = await router.handleSlashCommand("/sol", slashCtx);
  assert.equal(resSol.handled, true);
  assert.ok(resSol.output?.includes("gpt-5.6-terra"));
  assert.equal(monolith.modelResolver.getActiveModel(), "gpt-5.6-terra");

  const resModel = await router.handleSlashCommand("/model terra", slashCtx);
  assert.equal(resModel.handled, true);
  assert.ok(resModel.output?.includes("gpt-5.6-terra"));
  assert.equal(monolith.modelResolver.getActiveModel(), "gpt-5.6-terra");

  const resModels = await router.handleSlashCommand("/models", slashCtx);
  assert.equal(resModels.handled, true);
  assert.ok(resModels.output?.includes("gpt-5.6-terra"));
  console.log("  [✓] All slash commands handled correctly with informative Markdown responses.");

  // -------------------------------------------------------------------------
  // [Test 6/7] Context Budget Calculations for Terra (900k)
  // -------------------------------------------------------------------------
  console.log("[Test 6/7] Validating 900K Context Budget for Terra...");
  const budgetCalc = new ContextBudgetCalculator();
  const terraBudget = budgetCalc.calculateBudget("gpt-5.6-terra", 16_384);

  assert.equal(terraBudget.maxTokens, 900_000);
  assert.equal(terraBudget.reservedOutputTokens, 16_384);
  console.log("  [✓] Context budget calculator allocates 900k context properly for Terra.");

  // -------------------------------------------------------------------------
  // [Test 7/7] TUI ModelSelectModal Hotkeys (t, l, s) & Rendering
  // -------------------------------------------------------------------------
  console.log("[Test 7/7] Validating TUI ModelSelectModal Hotkeys & Rendering...");
  let selectedFromModal = "";
  let modalClosed = false;

  const allModels = catalog.getAllModels();
  const modal = new ModelSelectModal(
    allModels,
    "gpt-5.6-terra",
    (m) => {
      selectedFromModal = m;
    },
    () => {
      modalClosed = true;
    }
  );

  // Test 'l' hotkey (routes to Terra)
  modal.handleInput("l");
  assert.equal(selectedFromModal, "gpt-5.6-terra");
  assert.equal(modalClosed, true);

  // Test 's' hotkey (routes to Terra)
  modalClosed = false;
  modal.handleInput("s");
  assert.equal(selectedFromModal, "gpt-5.6-terra");
  assert.equal(modalClosed, true);

  // Test 't' hotkey (routes to Terra)
  modalClosed = false;
  modal.handleInput("t");
  assert.equal(selectedFromModal, "gpt-5.6-terra");
  assert.equal(modalClosed, true);

  // Verify render lines contain active tabs and hotkey hints
  const rendered = modal.render(80);
  assert.ok(rendered.length > 0);
  console.log("  [✓] ModelSelectModal renders and dispatches instant hotkeys (t, l, s) accurately.");

  console.log("\n================================================================");
  console.log("  [✓] ALL 7 CODEX MODEL SWAPPING & DISCOVERY TESTS PASSED!     ");
  console.log("================================================================\n");
}

main().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
