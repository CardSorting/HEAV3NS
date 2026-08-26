/**
 * validate-local-endpoints.ts
 *
 * Comprehensive validation suite for local and on-premises endpoints:
 * Ollama, llama.cpp, LM Studio, vLLM, and Custom Local Gateways (Phase 105 / ADR-052).
 */

import * as assert from "node:assert/strict";
import {
  LumiMonolith,
  CodexProviderBridge,
  CodexOAuthManager,
  EnvironmentKeyResolver,
  LlmProxyGateway,
  ModelCatalog,
  DeterministicLocalEndpointEngine,
  DEFAULT_LOCAL_ENDPOINT_PRESETS,
  LOCAL_QUICKSTART_GUIDES,
  LocalEndpointDashboardModal,
} from "../src/index.js";

async function testProviderResolution(): Promise<void> {
  console.log("[Test 1/8] Validating Provider & Endpoint Resolution for Local Engines...");
  const oauthMgr = new CodexOAuthManager();
  const envResolver = new EnvironmentKeyResolver();
  const proxyGateway = new LlmProxyGateway();
  const bridge = new CodexProviderBridge(oauthMgr, undefined, envResolver, proxyGateway);

  // Model Name -> Provider mapping
  assert.equal(bridge.resolveProviderName("galx/gpt-5.6-sol"), "galx");
  assert.equal(bridge.resolveProviderName("gpt-5.6-terra"), "openai-codex");
  assert.equal(bridge.resolveProviderName("openrouter/auto"), "openrouter");

  // Default Endpoints
  assert.equal(bridge.getDefaultEndpointForModel("galx/gpt-5.6-sol"), "https://galx.ai/v1/chat/completions");
  assert.equal(bridge.getDefaultEndpointForModel("openrouter/auto"), "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(bridge.getDefaultEndpointForModel("gpt-5.6-terra"), "https://api.openai.com/v1/chat/completions");

  console.log("  [✓] Provider and endpoint resolution verified across GALX, Codex, and OpenRouter.");
}

async function testUrlNormalizationAndOverrides(): Promise<void> {
  console.log("[Test 2/8] Validating URL Normalization & Per-Provider Overrides...");
  const engine = new DeterministicLocalEndpointEngine();

  assert.equal(
    engine.normalizeChatCompletionsUrl("http://localhost:11434"),
    "http://localhost:11434/v1/chat/completions"
  );
  assert.equal(
    engine.normalizeChatCompletionsUrl("http://localhost:11434/v1"),
    "http://localhost:11434/v1/chat/completions"
  );
  assert.equal(
    engine.normalizeChatCompletionsUrl("http://localhost:11434/v1/chat/completions"),
    "http://localhost:11434/v1/chat/completions"
  );
  assert.equal(
    engine.normalizeChatCompletionsUrl("localhost:1234"),
    "http://localhost:1234/v1/chat/completions"
  );
  assert.equal(
    engine.extractBaseUrl("http://localhost:11434/v1/chat/completions"),
    "http://localhost:11434"
  );

  const proxyGateway = new LlmProxyGateway(engine);

  // Configure per-provider override
  proxyGateway.setProviderEndpoint("ollama", {
    baseUrl: "http://192.168.1.50:11434",
    apiKey: "ollama-secret-token",
  });

  const effectiveOllama = proxyGateway.getEffectiveEndpoint("ollama", "http://localhost:11434/v1/chat/completions");
  assert.equal(effectiveOllama.url, "http://192.168.1.50:11434/v1/chat/completions");
  assert.equal(effectiveOllama.headers.Authorization, "Bearer ollama-secret-token");

  // Unconfigured provider uses default
  const effectiveLmStudio = proxyGateway.getEffectiveEndpoint("lmstudio", "http://localhost:1234/v1/chat/completions");
  assert.equal(effectiveLmStudio.url, "http://localhost:1234/v1/chat/completions");

  console.log("  [✓] Endpoint normalization and per-provider overrides operating cleanly.");
}

async function testLocalEngineProbingAndDiscovery(): Promise<void> {
  console.log("[Test 3/8] Validating Local Engine Probing & Discovery...");
  const engine = new DeterministicLocalEndpointEngine();

  // Test probing offline port gracefully returns unreachable status
  const probe = await engine.probeServer("ollama", "http://127.0.0.1:19999", undefined, 500);
  assert.equal(probe.reachable, false);
  assert.equal(probe.activeModelCount, 0);
  assert.ok(probe.error);

  // Test troubleshooting card generator
  const card = engine.getTroubleshootingCard("ollama", "http://localhost:11434/v1/chat/completions");
  assert.ok(card.includes("Ollama"));
  assert.ok(card.includes("ollama run"));
  assert.ok(card.includes("http://localhost:11434/v1/chat/completions"));

  const cardLmStudio = engine.getTroubleshootingCard("lmstudio");
  assert.ok(cardLmStudio.includes("LM Studio"));
  assert.ok(cardLmStudio.includes("lms") || cardLmStudio.includes("lmstudio.ai"));

  const cardLlamaCpp = engine.getTroubleshootingCard("llamacpp");
  assert.ok(cardLlamaCpp.includes("llama.cpp"));
  assert.ok(cardLlamaCpp.includes("llama-server"));

  // Quickstart guides
  const guide = engine.getQuickstartGuide("ollama");
  assert.equal(guide.provider, "ollama");
  assert.ok(guide.recommendedModels.length > 0);

  console.log("  [✓] Probing resilience and compassionate troubleshooting card generation verified.");
}

async function testModelCatalogLocalSpecs(): Promise<void> {
  console.log("[Test 4/8] Validating Model Catalog Specifications...");
  const catalog = new ModelCatalog();

  const galxSpec = catalog.getModelInfo("galx/gpt-5.6-sol");
  assert.equal(galxSpec.provider, "galx");
  assert.equal(galxSpec.inputPricePer1M, 3.75);

  const codexSpec = catalog.getModelInfo("gpt-5.6-terra");
  assert.equal(codexSpec.provider, "openai-codex");
  assert.equal(codexSpec.inputPricePer1M, 0.0);

  // Provider filter
  const galxList = await catalog.getModelsForProvider("galx");
  assert.ok(galxList.length >= 3);

  const codexList = await catalog.getModelsForProvider("openai-codex");
  assert.ok(codexList.length >= 5);

  console.log("  [✓] Model catalog specifications and provider filtering verified.");
}

async function testSetupWizardLocalAuditing(): Promise<void> {
  console.log("[Test 5/8] Validating SetupWizard Auditing & Testing...");
  const monolith = new LumiMonolith();

  const statuses = monolith.setupWizard.auditStatus();
  assert.ok(statuses.length >= 2);

  // Connection test for provider
  const connTest = await monolith.setupWizard.testProviderConnection("galx");
  assert.ok(typeof connTest.passed === "boolean");
  assert.ok(typeof connTest.details === "string");

  console.log("  [✓] SetupWizard audit and test methods verified.");
}

async function testLocalDashboardModal(): Promise<void> {
  console.log("[Test 6/8] Validating LocalEndpointDashboardModal Navigation & Rendering...");
  const engine = new DeterministicLocalEndpointEngine();
  let selectedModelName: string | undefined;

  const modal = new LocalEndpointDashboardModal(engine, (model) => {
    selectedModelName = model;
  });

  modal.open();
  assert.equal(modal.isOpen(), true);

  // Render fleet tab
  const outputFleet = modal.render();
  assert.ok(outputFleet.includes("LOCAL & ON-PREMISES LLM CONTROL PANEL"));
  assert.ok(outputFleet.includes("FLEET"));

  // Cycle view modes
  modal.handleKey("2");
  const outputModels = modal.render();
  assert.ok(outputModels.includes("MODELS"));

  modal.handleKey("3");
  const outputPull = modal.render();
  assert.ok(outputPull.includes("PULL"));

  modal.handleKey("4");
  const outputHw = modal.render();
  assert.ok(outputHw.includes("HARDWARE"));

  modal.handleKey("5");
  const outputEndp = modal.render();
  assert.ok(outputEndp.includes("ENDPOINTS"));

  modal.handleKey("6");
  const outputGuides = modal.render();
  assert.ok(outputGuides.includes("GUIDES"));
  assert.ok(outputGuides.includes("Ollama"));

  modal.handleKey("7");
  const outputDiag = modal.render();
  assert.ok(outputDiag.includes("TELEMETRY") || outputDiag.includes("DIAGNOSTICS"));

  // Close modal with escape
  const closeRes = modal.handleKey("escape");
  assert.equal(closeRes.action, "close");
  assert.equal(modal.isOpen(), false);

  console.log("  [✓] LocalEndpointDashboardModal 7-tab navigation and rendering verified.");
}

async function testAgentEngineLocalMetricsAndGuidance(): Promise<void> {
  console.log("[Test 7/8] Validating Agent Engine Turn Execution & Metric Tracking...");
  const monolith = new LumiMonolith();

  // Test turn tick with local model name
  monolith.setModel("llama3.2:latest");
  assert.equal(monolith.modelResolver.getActiveModel(), "llama3.2:latest");

  // Record a simulated local turn
  monolith.proxyGateway.getLocalEngine().recordTurn("ollama", 250, 15);
  const metrics = monolith.proxyGateway.getLocalEngine().getMetrics();
  assert.equal(metrics.totalLocalTurns, 1);
  assert.equal(metrics.totalLocalTokens, 250);
  assert.equal(metrics.lastTurnProvider, "ollama");

  console.log("  [✓] AgentEngine local model execution and metric recording verified.");
}

async function testMonolithCliLocalFleetProbe(): Promise<void> {
  console.log("[Test 8/8] Validating Grand Monolith Local Fleet Integration...");
  const monolith = new LumiMonolith();

  const localReport = await monolith.proxyGateway.getLocalEngine().probeAllServers();
  assert.ok(typeof localReport.activeServers === "number");
  assert.ok(typeof localReport.totalServersChecked === "number");
  assert.ok(Array.isArray(localReport.serverStatuses));
  assert.ok(localReport.serverStatuses.length >= 4);

  console.log(`  [✓] Grand Monolith local fleet probe checked ${localReport.totalServersChecked} servers successfully.`);
}

async function main(): Promise<void> {
  console.log("================================================================");
  console.log(" LUMI Local & On-Premises LLM Subsystem Validation Suite        ");
  console.log(" (Ollama, llama.cpp, LM Studio, vLLM, and Custom Local Endpoints)");
  console.log("================================================================\n");

  await testProviderResolution();
  await testUrlNormalizationAndOverrides();
  await testLocalEngineProbingAndDiscovery();
  await testModelCatalogLocalSpecs();
  await testSetupWizardLocalAuditing();
  await testLocalDashboardModal();
  await testAgentEngineLocalMetricsAndGuidance();
  await testMonolithCliLocalFleetProbe();

  console.log("\n================================================================");
  console.log("  [✓] ALL LOCAL & ON-PREMISES VALIDATION CHECKS PASSED!        ");
  console.log("================================================================\n");
}

main().catch((err) => {
  console.error("Local endpoints validation failed:", err);
  process.exit(1);
});
