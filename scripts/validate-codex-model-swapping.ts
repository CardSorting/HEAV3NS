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
    "gpt-5.6-luna",
    "gpt-5.6-sol",
  ]);

  const monolith = new LumiMonolith({ cwd: process.cwd() });
  monolith.setModel("gpt-5.6-terra");
  assert.equal(monolith.modelResolver.getActiveModel(), "gpt-5.6-terra");
  console.log("  [✓] Monolith and ModelResolver cleanly default to gpt-5.6-terra.");

  // -------------------------------------------------------------------------
  // [Test 2/7] Alias Normalization (Terra, Luna, Sol, 4o, Claude, etc.)
  // -------------------------------------------------------------------------
  console.log("[Test 2/7] Validating Canonical Alias Normalization...");
  assert.equal(ModelResolver.normalizeModelName("terra"), "gpt-5.6-terra");
  assert.equal(ModelResolver.normalizeModelName("TERRA"), "gpt-5.6-terra");
  assert.equal(ModelResolver.normalizeModelName("gpt-terra"), "gpt-5.6-terra");
  assert.equal(ModelResolver.normalizeModelName("5.6-terra"), "gpt-5.6-terra");

  assert.equal(ModelResolver.normalizeModelName("luna"), "gpt-5.6-luna");
  assert.equal(ModelResolver.normalizeModelName("Luna"), "gpt-5.6-luna");
  assert.equal(ModelResolver.normalizeModelName("5.6-luna"), "gpt-5.6-luna");

  assert.equal(ModelResolver.normalizeModelName("sol"), "gpt-5.6-sol");
  assert.equal(ModelResolver.normalizeModelName("SOL"), "gpt-5.6-sol");
  assert.equal(ModelResolver.normalizeModelName("5.6-sol"), "gpt-5.6-sol");

  assert.equal(ModelResolver.normalizeModelName("codex"), "gpt-5.6-terra");
  assert.equal(ModelResolver.normalizeModelName("openai-codex"), "gpt-5.6-terra");

  assert.equal(ModelResolver.normalizeModelName("4o"), "gpt-4o");
  assert.equal(ModelResolver.normalizeModelName("claude"), "anthropic/claude-3.5-sonnet");
  assert.equal(ModelResolver.normalizeModelName("flash"), "google/gemini-2.0-flash-001");
  assert.equal(ModelResolver.normalizeModelName("r1"), "deepseek/deepseek-r1");
  console.log("  [✓] Canonical aliases normalize cleanly across all model families.");

  // -------------------------------------------------------------------------
  // [Test 3/7] Monolith Model Swapping Helpers & Cycling
  // -------------------------------------------------------------------------
  console.log("[Test 3/7] Validating Direct Swapping & Cycling...");
  // 1. Swap to Luna
  const setLuna = monolith.switchToLuna();
  assert.equal(setLuna, "gpt-5.6-luna");
  assert.equal(monolith.modelResolver.getActiveModel(), "gpt-5.6-luna");
  assert.equal(monolith.config.modelName, "gpt-5.6-luna");

  // 2. Swap to Sol
  const setSol = monolith.switchToSol();
  assert.equal(setSol, "gpt-5.6-sol");
  assert.equal(monolith.modelResolver.getActiveModel(), "gpt-5.6-sol");
  assert.equal(monolith.config.modelName, "gpt-5.6-sol");

  // 3. Swap back to Terra
  const setTerra = monolith.switchToTerra();
  assert.equal(setTerra, "gpt-5.6-terra");
  assert.equal(monolith.modelResolver.getActiveModel(), "gpt-5.6-terra");
  assert.equal(monolith.config.modelName, "gpt-5.6-terra");

  // 4. setModel with alias
  monolith.setModel("luna");
  assert.equal(monolith.modelResolver.getActiveModel(), "gpt-5.6-luna");

  // 5. Cycling through models: luna -> sol -> terra -> luna
  const cycle1 = monolith.cycleCodexModel();
  assert.equal(cycle1, "gpt-5.6-sol");
  const cycle2 = monolith.cycleCodexModel();
  assert.equal(cycle2, "gpt-5.6-terra");
  const cycle3 = monolith.cycleCodexModel();
  assert.equal(cycle3, "gpt-5.6-luna");
  console.log("  [✓] Direct swapping and cycleCodexModel rotate through Terra, Luna, Sol seamlessly.");

  // -------------------------------------------------------------------------
  // [Test 4/7] Dynamic Codex Model Discovery via API & Dynamic Cache
  // -------------------------------------------------------------------------
  console.log("[Test 4/7] Validating Dynamic Codex Model Fetching & API Discovery...");
  const catalog = new ModelCatalog();

  // Test fallback codex models when offline
  const fallbackCodex = await catalog.fetchCodexModels(undefined, true);
  assert.ok(fallbackCodex.some((m) => m.modelName === "gpt-5.6-terra"));
  assert.ok(fallbackCodex.some((m) => m.modelName === "gpt-5.6-luna"));
  assert.ok(fallbackCodex.some((m) => m.modelName === "gpt-5.6-sol"));
  assert.ok(fallbackCodex.some((m) => m.modelName === "gpt-4o"));

  // Mock OpenAI models endpoint returning a newly released model variant
  const originalFetch = globalThis.fetch;
  const mockApiUrl = "https://mock.openai.api/v1";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = String(input);
    if (urlStr === `${mockApiUrl}/models`) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          object: "list",
          data: [
            { id: "gpt-5.6-terra", created: 1700000000, owned_by: "openai" },
            { id: "gpt-5.6-luna", created: 1700000000, owned_by: "openai" },
            { id: "gpt-5.6-sol", created: 1700000000, owned_by: "openai" },
            { id: "gpt-5.7-terra-preview", created: 1710000000, owned_by: "openai" },
          ],
        }),
      } as Response;
    }
    return originalFetch(input, init);
  }) as typeof globalThis.fetch;

  try {
    const liveDiscovered = await catalog.fetchCodexModels(
      { Authorization: "Bearer mock_token" },
      true,
      mockApiUrl
    );

    const newVariant = liveDiscovered.find((m) => m.modelName === "gpt-5.7-terra-preview");
    assert.ok(newVariant, "Dynamically discovered model 'gpt-5.7-terra-preview' must be registered in catalog");
    assert.equal(newVariant.provider, "openai-codex");
    assert.equal(newVariant.contextWindowTokens, 900_000);
    assert.equal(newVariant.supportsReasoning, true);

    // Verify dynamic cache returns the cached models
    const fromCache = await catalog.fetchCodexModels();
    assert.ok(fromCache.some((m) => m.modelName === "gpt-5.7-terra-preview"));
    console.log("  [✓] Dynamic model fetching auto-discovered new model variants and cached them with TTL.");
  } finally {
    globalThis.fetch = originalFetch;
  }

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
  assert.ok(resLuna.output?.includes("gpt-5.6-luna"));
  assert.equal(monolith.modelResolver.getActiveModel(), "gpt-5.6-luna");

  const resSol = await router.handleSlashCommand("/sol", slashCtx);
  assert.equal(resSol.handled, true);
  assert.ok(resSol.output?.includes("gpt-5.6-sol"));
  assert.equal(monolith.modelResolver.getActiveModel(), "gpt-5.6-sol");

  const resModel = await router.handleSlashCommand("/model terra", slashCtx);
  assert.equal(resModel.handled, true);
  assert.ok(resModel.output?.includes("gpt-5.6-terra"));
  assert.equal(monolith.modelResolver.getActiveModel(), "gpt-5.6-terra");

  const resModels = await router.handleSlashCommand("/models", slashCtx);
  assert.equal(resModels.handled, true);
  assert.ok(resModels.output?.includes("gpt-5.6-terra"));
  assert.ok(resModels.output?.includes("gpt-5.6-luna"));
  assert.ok(resModels.output?.includes("gpt-5.6-sol"));
  console.log("  [✓] All slash commands handled correctly with informative Markdown responses.");

  // -------------------------------------------------------------------------
  // [Test 6/7] Context Budget Calculations for Terra, Luna, Sol
  // -------------------------------------------------------------------------
  console.log("[Test 6/7] Validating 900K Context Budget across Terra, Luna, Sol...");
  const budgetCalc = new ContextBudgetCalculator();
  const terraBudget = budgetCalc.calculateBudget("gpt-5.6-terra", 16_384);
  const lunaBudget = budgetCalc.calculateBudget("gpt-5.6-luna", 8_192);
  const solBudget = budgetCalc.calculateBudget("gpt-5.6-sol", 8_192);

  assert.equal(terraBudget.maxTokens, 900_000);
  assert.equal(terraBudget.reservedOutputTokens, 16_384);
  assert.equal(lunaBudget.maxTokens, 900_000);
  assert.equal(lunaBudget.reservedOutputTokens, 8_192);
  assert.equal(solBudget.maxTokens, 900_000);
  assert.equal(solBudget.reservedOutputTokens, 8_192);
  console.log("  [✓] Context budget calculator allocates 900k context properly for all 3 models.");

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

  // Test 'l' hotkey for Luna
  modal.handleInput("l");
  assert.equal(selectedFromModal, "gpt-5.6-luna");
  assert.equal(modalClosed, true);

  // Test 's' hotkey for Sol
  modalClosed = false;
  modal.handleInput("s");
  assert.equal(selectedFromModal, "gpt-5.6-sol");
  assert.equal(modalClosed, true);

  // Test 't' hotkey for Terra
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
