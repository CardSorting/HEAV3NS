/**
 * validate-openrouter-provider.ts
 *
 * Comprehensive validation suite for OpenRouter Provider Engine, Dynamic Model Discovery,
 * Attribution Headers, Stream Parsing, Error Classification, and Monolith Synthesis.
 */

import * as assert from "node:assert/strict";
import {
  LumiMonolith,
  OpenRouterProviderEngine,
  OPENROUTER_STEALTH_MODELS,
  DeterministicErrorClassifier,
  JitteredBackoffGovernor,
  ModelCatalog,
  ProviderAttributionComposer,
  type OpenRouterStreamChunk,
} from "../src/index.js";

async function main(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI OpenRouter Provider Integration (Phase 135 / ADR-110)   ");
  console.log("================================================================\n");

  const engine = new OpenRouterProviderEngine();

  // ── [Test 1/11] Attribution Headers Synthesis ──────────────────────────────
  console.log("[Test 1/11] Validating OpenRouter attribution headers...");
  {
    const headers = engine.buildAttributionHeaders();
    assert.equal(headers["HTTP-Referer"], "https://github.com/CardSorting/LUMI-JOY");
    assert.equal(headers["X-Title"], "LUMI AGENT OS");
    assert.equal(headers["X-OpenRouter-Title"], "LUMI");
    assert.equal(headers["X-OpenRouter-Categories"], "ide-extension");
    console.log("  [✓] Attribution headers properly formatted and populated.");
  }

  // ── [Test 2/11] Model Normalization & Claude 1M Routing ────────────────────
  console.log("[Test 2/11] Validating Model Normalization & Claude 1M routing...");
  {
    assert.equal(engine.isClaude1mModel("anthropic/claude-sonnet-4:1m"), true);
    assert.equal(engine.isClaude1mModel("anthropic/claude-sonnet-4.5:1m"), true);
    assert.equal(engine.isClaude1mModel("anthropic/claude-3.5-sonnet"), false);

    const norm1m = engine.normalizeModelId("anthropic/claude-sonnet-4.6:1m");
    assert.equal(norm1m.normalizedId, "anthropic/claude-sonnet-4.6");
    assert.equal(norm1m.is1m, true);

    const normStandard = engine.normalizeModelId("deepseek/deepseek-r1");
    assert.equal(normStandard.normalizedId, "deepseek/deepseek-r1");
    assert.equal(normStandard.is1m, false);

    // Verify 1M request payload sets explicit provider routing
    const res1m = engine.prepareRequestPayload({
      modelId: "anthropic/claude-sonnet-4.6:1m",
      messages: [{ role: "user", content: "Hello" }],
    });
    assert.equal(res1m.effectiveModelId, "anthropic/claude-sonnet-4.6");
    assert.deepEqual(res1m.payload.provider, {
      order: ["anthropic", "google-vertex/global"],
      allow_fallbacks: false,
    });
    console.log("  [✓] Claude 1M suffix stripping and provider routing verified.");
  }

  // ── [Test 3/11] Ephemeral Prompt Caching Injection ─────────────────────────
  console.log("[Test 3/11] Validating Ephemeral Prompt Caching for Claude & MiniMax...");
  {
    assert.equal(engine.supportsPromptCaching("anthropic/claude-3.7-sonnet"), true);
    assert.equal(engine.supportsPromptCaching("minimax/minimax-m2.5"), true);
    assert.equal(engine.supportsPromptCaching("meta-llama/llama-3-70b"), false);

    const cachedPayload = engine.prepareRequestPayload({
      modelId: "anthropic/claude-3.5-sonnet",
      messages: [
        { role: "system", content: "System prompt context" },
        { role: "user", content: "User query" },
      ],
    });

    const systemMsg = (cachedPayload.payload.messages as any[])[0];
    assert.equal(Array.isArray(systemMsg.content), true);
    assert.equal(systemMsg.content[0].type, "text");
    assert.equal(systemMsg.content[0].text, "System prompt context");
    assert.deepEqual(systemMsg.content[0].cache_control, { type: "ephemeral" });
    console.log("  [✓] Ephemeral cache control injected for compatible models.");
  }

  // ── [Test 4/11] Model Temperature & Reasoning Calibration ──────────────────
  console.log("[Test 4/11] Validating Model-Specific Temperature & Reasoning Calibration...");
  {
    // DeepSeek R1 should calibrate to temperature 0.7, top_p 0.95
    const r1Payload = engine.prepareRequestPayload({
      modelId: "deepseek/deepseek-r1",
      messages: [{ role: "user", content: "Prove Riemann Hypothesis" }],
    });
    assert.equal(r1Payload.payload.temperature, 0.7);
    assert.equal(r1Payload.payload.top_p, 0.95);

    // Gemini 3 should calibrate to temperature 1.0
    const geminiPayload = engine.prepareRequestPayload({
      modelId: "google/gemini-3-flash",
      messages: [{ role: "user", content: "Analyze data" }],
    });
    assert.equal(geminiPayload.payload.temperature, 1.0);

    // Extended thinking budget suppresses temperature
    const thinkingPayload = engine.prepareRequestPayload({
      modelId: "anthropic/claude-3.7-sonnet",
      messages: [{ role: "user", content: "Complex logic problem" }],
      thinkingBudgetTokens: 4096,
    });
    assert.equal(thinkingPayload.payload.temperature, undefined);
    assert.deepEqual(thinkingPayload.payload.reasoning, { max_tokens: 4096 });

    // Reasoning effort mapping
    const effortPayload = engine.prepareRequestPayload({
      modelId: "openai/o3-mini",
      messages: [{ role: "user", content: "Math solve" }],
      reasoningEffort: "high",
    });
    assert.deepEqual(effortPayload.payload.reasoning, { effort: "high" });

    // Skip reasoning for grok-4 / devstral / glm
    assert.equal(engine.shouldSkipReasoningForModel("x-ai/grok-4"), true);
    assert.equal(engine.shouldSkipReasoningForModel("mistralai/devstral-24b"), true);
    assert.equal(engine.shouldSkipReasoningForModel("z-ai/glm-4.6"), true);
    assert.equal(engine.shouldSkipReasoningForModel("anthropic/claude-3.7-sonnet"), false);
    console.log("  [✓] Model parameter calibration and reasoning suppression verified.");
  }

  // ── [Test 5/11] Provider Preference Routing ────────────────────────────────
  console.log("[Test 5/11] Validating Exacto & Specialized Provider Preferences...");
  {
    const kimiPref = engine.getProviderPreferences("moonshotai/kimi-k2:exacto");
    assert.ok(kimiPref);
    assert.deepEqual(kimiPref?.order, ["groq", "moonshotai"]);
    assert.equal(kimiPref?.allow_fallbacks, false);

    const qwenPref = engine.getProviderPreferences("qwen/qwen3-coder");
    assert.ok(qwenPref);
    assert.ok(qwenPref.order?.includes("nebius"));

    const payloadExacto = engine.prepareRequestPayload({
      modelId: "moonshotai/kimi-k2:exacto",
      messages: [{ role: "user", content: "Test" }],
    });
    assert.deepEqual(payloadExacto.payload.provider, kimiPref);
    console.log("  [✓] Provider preferences accurately resolved and embedded.");
  }

  // ── [Test 6/11] Stream Chunk & Mid-Stream Error Parsing ─────────────────────
  console.log("[Test 6/11] Validating Stream Chunk & Mid-Stream Error Parsing...");
  {
    // Normal text chunk
    const textChunk: OpenRouterStreamChunk = {
      id: "gen-123",
      choices: [
        {
          delta: {
            content: "Hello from OpenRouter!",
          },
        },
      ],
    };
    const eventsText = engine.parseStreamChunk(textChunk);
    assert.equal(eventsText.length, 1);
    assert.equal(eventsText[0].type, "text");
    assert.equal(eventsText[0].text, "Hello from OpenRouter!");

    // Reasoning tokens and reasoning_details preservation
    const reasoningChunk: OpenRouterStreamChunk = {
      id: "gen-124",
      choices: [
        {
          delta: {
            reasoning: "Thinking about the algorithmic complexity...",
            reasoning_details: [{ signature: "sig-xyz", data: { step: 1 } }],
          },
        },
      ],
    };
    const eventsReasoning = engine.parseStreamChunk(reasoningChunk);
    assert.equal(eventsReasoning.length, 2);
    assert.equal(eventsReasoning[0].type, "reasoning");
    assert.equal(eventsReasoning[0].reasoning, "Thinking about the algorithmic complexity...");
    assert.equal(eventsReasoning[1].type, "reasoning");
    assert.equal(eventsReasoning[1].details?.length, 1);

    // Usage tokens chunk
    const usageChunk: OpenRouterStreamChunk = {
      id: "gen-125",
      usage: {
        prompt_tokens: 1500,
        completion_tokens: 350,
        prompt_tokens_details: { cached_tokens: 500 },
        cost: 0.0042,
        cost_details: { upstream_inference_cost: 0.0008 },
      },
    };
    const eventsUsage = engine.parseStreamChunk(usageChunk);
    assert.equal(eventsUsage.length, 1);
    assert.equal(eventsUsage[0].type, "usage");
    assert.equal(eventsUsage[0].inputTokens, 1000); // 1500 - 500 cached
    assert.equal(eventsUsage[0].cacheReadTokens, 500);
    assert.equal(eventsUsage[0].outputTokens, 350);
    assert.equal(eventsUsage[0].totalCost, 0.005); // 0.0042 + 0.0008

    // Root chunk error
    const rootErrorChunk: OpenRouterStreamChunk = {
      error: { code: 429, message: "Rate limit exceeded" },
    };
    assert.throws(() => engine.parseStreamChunk(rootErrorChunk), /OpenRouter API Error 429/);

    // Mid-stream finish_reason: error
    const midStreamErrorChunk: OpenRouterStreamChunk = {
      choices: [
        {
          finish_reason: "error",
          error: { code: "upstream_error", message: "Provider dropped connection" },
        },
      ],
    };
    assert.throws(() => engine.parseStreamChunk(midStreamErrorChunk), /OpenRouter Mid-Stream Error/);
    console.log("  [✓] Stream chunk delta, reasoning, usage, and error parsing verified.");
  }

  // ── [Test 7/11] OAuth & URI Callback Code Parsing ──────────────────────────
  console.log("[Test 7/11] Validating OpenRouter OAuth callback parsing...");
  {
    const uriCallback = engine.handleOpenRouterCallback("vscode://dietcode.dietcode/openrouter?code=sk-or-code-12345");
    assert.equal(uriCallback.success, true);
    assert.equal(uriCallback.code, "sk-or-code-12345");

    const httpCallback = engine.handleOpenRouterCallback("https://github.com/CardSorting/LUMI-JOY/openrouter?code=secret_code_abc");
    assert.equal(httpCallback.success, true);
    assert.equal(httpCallback.code, "secret_code_abc");

    const directCode = engine.handleOpenRouterCallback("plain_auth_code_789");
    assert.equal(directCode.success, true);
    assert.equal(directCode.code, "plain_auth_code_789");

    const empty = engine.handleOpenRouterCallback("");
    assert.equal(empty.success, false);
    console.log("  [✓] OAuth callback URI & code extraction verified.");
  }

  // ── [Test 8/11] Dynamic Model Catalog Discovery & Fallback Presets ─────────
  console.log("[Test 8/11] Validating Dynamic Model Catalog & Fallback Presets...");
  {
    const catalog = new ModelCatalog(undefined, engine);
    const fallbackModels = engine.getFallbackModelSpecs();
    assert.ok(fallbackModels.length >= 5);
    assert.ok(fallbackModels.some((m) => m.modelName === "anthropic/claude-3.7-sonnet"));
    assert.ok(fallbackModels.some((m) => m.modelName === "google/gemini-2.0-flash-001"));
    assert.ok(fallbackModels.some((m) => m.modelName === "deepseek/deepseek-r1"));

    // Check stealth models registration
    assert.ok(OPENROUTER_STEALTH_MODELS["stealth/giga-potato"]);
    assert.ok(OPENROUTER_STEALTH_MODELS["x-ai/grok-4.5"]);

    // Check dynamic model info lookup
    const info = catalog.getModelInfo("anthropic/claude-3.7-sonnet");
    assert.equal(info.provider, "openrouter");
    assert.equal(info.supportsVision, true);
    assert.equal(info.supportsReasoning, true);

    // Turn cost calculation
    const cost = catalog.calculateTurnCost("anthropic/claude-3.7-sonnet", 100_000, 10_000);
    // (100k / 1M) * 3.0 + (10k / 1M) * 15.0 = 0.30 + 0.15 = 0.45
    assert.equal(cost, 0.45);
    console.log("  [✓] Dynamic model catalog specifications & pricing verified.");
  }

  // ── [Test 9/11] Provider Attribution Composer ──────────────────────────────
  console.log("[Test 9/11] Validating Provider Attribution Composer with OpenRouter...");
  {
    const attribution = new ProviderAttributionComposer();
    const rec = attribution.recordUsage("anthropic/claude-3.7-sonnet", 10_000, 2_000);
    // (10k/1k)*0.003 + (2k/1k)*0.015 = 0.03 + 0.03 = 0.06
    assert.equal(rec.estimatedCostUsd, 0.06);

    const summary = attribution.getAttributionSummary();
    assert.equal(summary.recordsCount, 1);
    assert.equal(summary.totalInputTokens, 10_000);
    assert.equal(summary.totalOutputTokens, 2_000);
    assert.equal(summary.totalCostUsd, 0.06);
    console.log("  [✓] Provider attribution pricing calculations verified.");
  }

  // ── [Test 10/11] Deterministic Error Classifier OpenRouter Taxonomies ──────
  console.log("[Test 10/11] Validating Deterministic Error Classifier with OpenRouter...");
  {
    const governor = new JitteredBackoffGovernor(100);
    const classifier = new DeterministicErrorClassifier(governor);

    // OpenRouter Mid-Stream Error
    const midStreamFault = classifier.classify(new Error("OpenRouter Mid-Stream Error: Provider disconnected mid-stream"));
    assert.equal(midStreamFault.category, "overloaded_server");
    assert.equal(midStreamFault.directive, "retry_backoff");
    assert.equal(midStreamFault.retryable, true);

    // OpenRouter Upstream Rate Limit
    const upstreamFault = classifier.classify({
      status: 429,
      message: "OpenRouter upstream model provider overloaded",
    });
    assert.equal(upstreamFault.category, "upstream_rate_limit");
    assert.equal(upstreamFault.directive, "fallback_model");
    assert.equal(upstreamFault.retryable, true);

    // OpenRouter Auth Transient
    const authFault = classifier.classify({
      status: 401,
      message: "OpenRouter API Error 401: Invalid API key",
    });
    assert.equal(authFault.category, "auth_transient");
    assert.equal(authFault.directive, "rotate_credential");
    console.log("  [✓] Error classifier handling of OpenRouter faults verified.");
  }

  // ── [Test 11/11] Monolith Factory & Grand Monolith Integration ─────────────
  console.log("[Test 11/11] Validating Monolith Factory & Component Wiring...");
  {
    const monolith = new LumiMonolith();

    assert.ok(monolith.openRouterEngine, "Monolith should have openRouterEngine initialized");
    assert.ok(monolith.modelCatalog, "Monolith should have modelCatalog initialized");
    assert.ok(monolith.codexProviderBridge, "Monolith should have codexProviderBridge initialized");

    const auth = await monolith.codexProviderBridge.resolveProviderAuth("openrouter/anthropic/claude-3.5-sonnet", "sk-or-test-key");
    assert.equal(auth.authType, "api-key");
    assert.equal(auth.headers.Authorization, "Bearer sk-or-test-key");
    assert.equal(auth.headers["HTTP-Referer"], "https://github.com/CardSorting/LUMI-JOY");
    assert.equal(auth.headers["X-OpenRouter-Title"], "LUMI");
    assert.equal(auth.headers["X-OpenRouter-Categories"], "ide-extension");

    console.log("  [✓] Grand Monolith component synthesis and OpenRouter wiring verified.");
  }

  console.log("\n================================================================");
  console.log("   [✓] ALL 11 OPENROUTER INTEGRATION TESTS PASSED CLEANLY       ");
  console.log("================================================================\n");
}

main().catch((err) => {
  console.error("OpenRouter provider validation failed:", err);
  process.exit(1);
});
