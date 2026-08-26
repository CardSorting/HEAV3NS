/**
 * scripts/validate-galx-provider.ts
 *
 * End-to-End Verification Suite for GALX AI Provider in LUMI-NEW.
 * Validates:
 * 1. GALX Contracts & Constants (endpoints, wholesale pricing, models)
 * 2. Broccoli Transport Substrate (Merkle receipt hashing, WAL persistence, envelope crypto)
 * 3. GALX Transport Client (circuit breaker, AIMD governor, signature generation)
 * 4. GalxProviderEngine (model normalization, cost calculation, headers)
 * 5. Model Catalog (only openrouter, codex, galx registered)
 * 6. CodexProviderBridge (auth resolution, attribution headers, endpoint routing)
 * 7. EnvironmentKeyResolver (GALX_API_KEY resolution)
 * 8. MonolithFactory & LumiMonolith component wiring
 */

import assert from "node:assert";
import {
  DEFAULT_GALX_BASE_URL,
  DEFAULT_GALX_CLEARINGHOUSE_URL,
  DEFAULT_GALX_MODEL_ID,
  GALX_DEFAULT_MODELS,
  GalxProviderEngine,
  GalxTransportClient,
  BroccoliTransportSubstrate,
  ModelCatalog,
  CodexProviderBridge,
  EnvironmentKeyResolver,
  MonolithFactory,
  LumiMonolith,
} from "../src/index.js";

async function runValidation(): Promise<void> {
  console.log("\x1b[1;36m===================================================\x1b[0m");
  console.log("\x1b[1;36m  LUMI-NEW GALX AI PROVIDER INTEGRATION TEST SUITE \x1b[0m");
  console.log("\x1b[1;36m===================================================\x1b[0m\n");

  // 1. Contracts and Constants Check
  console.log("▶ [Test 1] Validating GALX Contracts and Constants...");
  assert.strictEqual(DEFAULT_GALX_BASE_URL, "https://galx.ai/v1");
  assert.strictEqual(DEFAULT_GALX_CLEARINGHOUSE_URL, "https://galx.ai");
  assert.strictEqual(DEFAULT_GALX_MODEL_ID, "gpt-5.6-sol");
  assert.ok(GALX_DEFAULT_MODELS["gpt-5.6-sol"]);
  assert.ok(GALX_DEFAULT_MODELS["gpt-5.6-terra"]);
  assert.ok(GALX_DEFAULT_MODELS["gpt-5.6-luna"]);
  assert.strictEqual(GALX_DEFAULT_MODELS["gpt-5.6-sol"].contextWindowTokens, 900_000);
  assert.strictEqual(GALX_DEFAULT_MODELS["gpt-5.6-sol"].inputPricePer1M, 3.75);
  console.log("  ✔ Contracts and constants verified successfully.\n");

  // 2. Broccoli Transport Substrate Check
  console.log("▶ [Test 2] Validating Broccoli Transport Substrate & Merkle Tree Chain...");
  const substrate = new BroccoliTransportSubstrate();
  const entry = substrate.enqueueOutbox("/v1/chat/completions", {
    model: "gpt-5.6-sol",
    messages: [{ role: "user", content: "Hello GALX" }],
  });
  assert.ok(entry.id.startsWith("bwal_"));

  const receipt = substrate.sealReceipt(entry.id, {
    success: true,
    status: 200,
    data: { response: "OK" },
    durationMs: 142,
    attempts: 1,
    correlationId: entry.correlationId,
  });
  assert.ok(receipt.receiptId.startsWith("rcpt_"));
  assert.ok(receipt.receiptHash.length === 64); // SHA-256 hex string

  // Record a second entry and verify hash chaining
  const secondEntry = substrate.enqueueOutbox("/v1/chat/completions", {
    model: "gpt-5.6-terra",
    messages: [{ role: "user", content: "Hello Terra" }],
  });
  const secondReceipt = substrate.sealReceipt(secondEntry.id, {
    success: true,
    status: 200,
    data: { response: "OK" },
    durationMs: 85,
    attempts: 1,
    correlationId: secondEntry.correlationId,
  });
  assert.strictEqual(secondReceipt.prevReceiptHash, receipt.receiptHash);

  const metrics = substrate.getSlaMetrics();
  assert.ok(metrics.totalRequests >= 2);
  assert.ok(metrics.p50LatencyMs > 0);
  assert.ok(metrics.merkleRoot.length === 64);
  console.log(`  ✔ Merkle chain verified. Rolling P50: ${metrics.p50LatencyMs}ms, Merkle Root: ${metrics.merkleRoot.slice(0, 16)}...`);

  // Test envelope crypto roundtrip
  const testPayload = { prompt: "Hello GALX", seed: 42 };
  const encrypted = substrate.encryptEnvelope(testPayload, "galx_test_secret_key_12345");
  const decrypted = substrate.decryptEnvelope(encrypted, "galx_test_secret_key_12345");
  assert.strictEqual(decrypted.prompt, "Hello GALX");
  assert.strictEqual(decrypted.seed, 42);
  console.log("  ✔ Substrate envelope AES-256-GCM encryption/decryption roundtrip verified.\n");

  // 3. GALX Transport Client Check
  console.log("▶ [Test 3] Validating GALX Hardened Transport Client...");
  const transportClient = new GalxTransportClient();
  const audit = transportClient.getTransportAuditReport();
  assert.strictEqual(audit.circuitBreaker.state, "CLOSED");
  assert.strictEqual(audit.concurrencyLimit, 20);
  assert.strictEqual(audit.inFlightRequests, 0);
  console.log("  ✔ Transport Client initialized. Circuit state: CLOSED, Concurrency: 20.\n");

  // 4. GalxProviderEngine Check
  console.log("▶ [Test 4] Validating GalxProviderEngine...");
  const galxEngine = new GalxProviderEngine(undefined, transportClient);
  
  // Model normalization
  assert.strictEqual(galxEngine.normalizeModelId("sol"), "gpt-5.6-sol");
  assert.strictEqual(galxEngine.normalizeModelId("galx-sol"), "gpt-5.6-sol");
  assert.strictEqual(galxEngine.normalizeModelId("galx/gpt-5.6-terra"), "gpt-5.6-terra");
  assert.strictEqual(galxEngine.normalizeModelId("terra"), "gpt-5.6-terra");
  assert.strictEqual(galxEngine.normalizeModelId("luna"), "gpt-5.6-luna");

  // Cost calculation
  const solCost = galxEngine.calculateTurnCost("gpt-5.6-sol", 1_000_000, 1_000_000, 500_000);
  // (0.5M * 3.75) + (1M * 15.00) + (0.5M * 1.25) = 1.875 + 15.00 + 0.625 = 17.50
  assert.strictEqual(solCost, 17.5);

  // Attribution headers
  const headers = galxEngine.buildAttributionHeaders();
  assert.strictEqual(headers["X-GALX-Client"], "LUMI/12.5.0");
  assert.strictEqual(headers["X-GALX-Client-ID"], "lumi-ide");
  assert.strictEqual(headers["X-OpenRouter-Title"], "LUMI");
  console.log("  ✔ GalxProviderEngine normalization, cost calculation, and headers verified.\n");

  // 5. Model Catalog Provider Scoping Check
  console.log("▶ [Test 5] Validating ModelCatalog Provider Scoping...");
  const catalog = new ModelCatalog(undefined, undefined, galxEngine);
  const allModels = catalog.getAllModels();
  const registeredProviders = new Set(allModels.map((m) => m.provider));
  console.log("  Active Providers in Catalog:", Array.from(registeredProviders));
  
  // Verify only allowed providers are in defaults
  for (const prov of registeredProviders) {
    assert.ok(
      prov === "openai-codex" || prov === "galx" || prov === "openrouter",
      `Unexpected provider found: ${prov}`
    );
  }

  // Verify GALX models are queryable
  const galxModels = await catalog.getModelsForProvider("galx");
  assert.ok(galxModels.length >= 3);
  assert.ok(galxModels.some((m) => m.modelName === "gpt-5.6-sol"));
  assert.ok(galxModels.some((m) => m.modelName === "gpt-5.6-terra"));
  assert.ok(galxModels.some((m) => m.modelName === "gpt-5.6-luna"));

  const solInfo = catalog.getModelInfo("galx/gpt-5.6-sol");
  assert.strictEqual(solInfo.provider, "galx");
  assert.strictEqual(solInfo.contextWindowTokens, 900_000);
  console.log("  ✔ ModelCatalog correctly scopes only openrouter, openai-codex, and galx.\n");

  // 6. CodexProviderBridge & Auth Resolution Check
  console.log("▶ [Test 6] Validating CodexProviderBridge...");
  process.env.GALX_API_KEY = "galx_test_mock_token_abc123";
  const bridge = new CodexProviderBridge();
  
  assert.strictEqual(bridge.resolveProviderName("galx/gpt-5.6-sol"), "galx");
  assert.strictEqual(bridge.resolveProviderName("galx-terra"), "galx");
  assert.strictEqual(bridge.resolveProviderName("openrouter/anthropic/claude-3.5-sonnet"), "openrouter");
  assert.strictEqual(bridge.resolveProviderName("gpt-5.6-terra"), "openai-codex");

  assert.strictEqual(bridge.getDefaultEndpointForModel("galx/gpt-5.6-sol"), "https://galx.ai/v1/chat/completions");
  assert.strictEqual(bridge.getDefaultEndpointForModel("openrouter/auto"), "https://openrouter.ai/api/v1/chat/completions");

  const resolvedAuth = await bridge.resolveProviderAuth("galx/gpt-5.6-sol");
  assert.strictEqual(resolvedAuth.authType, "api-key");
  assert.strictEqual(resolvedAuth.headers["Authorization"], "Bearer galx_test_mock_token_abc123");
  assert.strictEqual(resolvedAuth.headers["X-GALX-Client"], "LUMI/12.5.0");
  assert.strictEqual(resolvedAuth.headers["X-GALX-Client-ID"], "lumi-ide");
  console.log("  ✔ CodexProviderBridge resolved GALX authentication, headers, and endpoint.\n");

  // 7. EnvironmentKeyResolver Check
  console.log("▶ [Test 7] Validating EnvironmentKeyResolver...");
  const envResolver = new EnvironmentKeyResolver();
  const resolvedKey = envResolver.resolveKey("galx");
  assert.strictEqual(resolvedKey, "galx_test_mock_token_abc123");
  const statuses = envResolver.getProviderStatuses();
  assert.ok(statuses.some((s) => s.provider === "galx" && s.hasKey));
  console.log("  ✔ EnvironmentKeyResolver successfully resolved GALX_API_KEY.\n");

  // 8. Monolith Factory & LumiMonolith Check
  console.log("▶ [Test 8] Validating Monolith Factory & LumiMonolith Integration...");
  const monolith = new LumiMonolith();
  monolith.setModel("galx/gpt-5.6-sol");

  assert.ok(monolith.galxEngine, "LumiMonolith.galxEngine must be defined");
  assert.ok(monolith.galxTransportClient, "LumiMonolith.galxTransportClient must be defined");
  assert.ok(monolith.modelCatalog, "LumiMonolith.modelCatalog must be defined");
  assert.ok(monolith.setupWizard, "LumiMonolith.setupWizard must be defined");

  // Test setup wizard connection test with galx
  const wizardTest = await monolith.setupWizard.testProviderConnection("galx");
  assert.strictEqual(wizardTest.passed, true);
  console.log(`  ✔ SetupWizard connection diagnostic for GALX: ${wizardTest.details}`);
  console.log("  ✔ MonolithFactory created LumiMonolith with galxEngine and galxTransportClient!\n");

  console.log("\x1b[1;32m===================================================\x1b[0m");
  console.log("\x1b[1;32m  ALL 8 VALIDATION PHASES PASSED WITH ZERO ERRORS! \x1b[0m");
  console.log("\x1b[1;32m===================================================\x1b[0m");
}

runValidation().catch((err) => {
  console.error("\x1b[1;31mValidation Failed:\x1b[0m", err);
  process.exit(1);
});
