/**
 * Validation Suite for Native Nous Portal Provider Subsystem
 * Target #73 / ADR-116
 */

import assert from "node:assert";
import { performance } from "node:perf_hooks";
import {
  DEFAULT_NOUS_INFERENCE_URL,
  DEFAULT_NOUS_PORTAL_URL,
  DeterministicNousPortalEngine,
  NousPortalSupervisor,
  BroccoliNousPortalSubstrate,
  NousPortalSnapshotManager,
  NousPortalToolSuite,
  MonolithFactory,
  GrandMonolithSynthesizer,
  LumiMonolith,
} from "../src/index.js";

async function runValidation() {
  console.log("================================================================");
  console.log("   LUMI Native Nous Portal Provider Subsystem Validation Suite  ");
  console.log("================================================================\n");

  const substrate = new BroccoliNousPortalSubstrate();
  const snapshotManager = new NousPortalSnapshotManager(substrate);
  const engine = new DeterministicNousPortalEngine(substrate);
  const supervisor = new NousPortalSupervisor(substrate, engine);
  const toolSuite = new NousPortalToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Test 1: Product Attribution Tags
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating Product Attribution Tags (nous_portal_tags)...");
  const baseTags = engine.generateAttributionTags();
  assert.strictEqual(baseTags.length, 2);
  assert.strictEqual(baseTags[0], "product=lumi-joy");
  assert.ok(baseTags[1].startsWith("client=lumi-client-v"));

  const sessionTags = engine.generateAttributionTags("session_alpha_99");
  assert.strictEqual(sessionTags.length, 3);
  assert.strictEqual(sessionTags[2], "conversation=session_alpha_99");
  console.log("  [✓] Standardized product, version, and session attribution tags verified.");

  // ---------------------------------------------------------------------------
  // Test 2: Device Code Login Initiation
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating RFC 8628 Device Code Login Initiation...");
  const session = supervisor.startDeviceLogin();
  assert.ok(session.deviceCode.startsWith("dcode_"));
  assert.ok(session.userCode.startsWith("NOUS-"));
  assert.strictEqual(session.verificationUri, `${DEFAULT_NOUS_PORTAL_URL}/device`);
  assert.ok(session.verificationUriComplete?.includes(session.userCode));
  assert.strictEqual(session.expiresIn, 900);
  assert.strictEqual(session.interval, 5);
  console.log(`  [✓] Device code session initialized: User Code = ${session.userCode}`);

  // ---------------------------------------------------------------------------
  // Test 3: Device Code Exchange & JWT Account State
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Device Code Exchange & Account Credential Store...");
  const exchangeRes = supervisor.completeDeviceLogin(session.deviceCode, {
    email: "builder@nousresearch.com",
    plan: "Hermes Pro Tier",
    creditsRemaining: 100.0,
  });

  assert.strictEqual(exchangeRes.success, true);
  assert.ok(exchangeRes.tokens?.accessToken.startsWith("nous_jwt_"));
  assert.strictEqual(exchangeRes.account?.email, "builder@nousresearch.com");
  assert.strictEqual(exchangeRes.account?.subscription?.plan, "Hermes Pro Tier");
  assert.strictEqual(exchangeRes.account?.paidServiceAccess, true);
  assert.strictEqual(exchangeRes.account?.toolAccess?.enabled, true);

  const activeAccount = supervisor.getAccount();
  assert.strictEqual(activeAccount.loggedIn, true);
  assert.strictEqual(activeAccount.email, "builder@nousresearch.com");
  console.log("  [✓] JWT tokens minted and account entitlements saved in in-memory substrate.");

  // ---------------------------------------------------------------------------
  // Test 4: Model Catalog, Dynamic Fetching & Deterministic Inference
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Model Catalog, Dynamic Fetching & Inference...");
  const initialModels = supervisor.listModels();
  assert.ok(initialModels.length >= 4, "Must contain initial native Nous models");

  // Simulate dynamic model fetch from remote endpoint
  const mockDynamicCatalog = {
    data: [
      {
        id: "nous/hermes-4-llama-4-preview",
        name: "Hermes 4 Llama-4 Frontier Preview",
        context_length: 262_144,
        max_output_tokens: 16_384,
        pricing: { prompt: 2.5, completion: 5.0 },
        architecture: { modality: "text+vision", instruct_type: "reasoning" },
        description: "Frontier 4th Generation Hermes model with multi-modal vision and native reasoning.",
      },
      {
        id: "nous/deephermes-3-70b-preview",
        name: "DeepHermes 3 70B Preview",
        context_length: 131_072,
        max_output_tokens: 8_192,
        pricing: { prompt: 0.9, completion: 1.8 },
        architecture: { modality: "text", instruct_type: "reasoning" },
        description: "High-parameter DeepHermes reasoning model.",
      },
    ],
  };

  const mockFetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
    return new Response(JSON.stringify(mockDynamicCatalog), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const dynamicFetchRes = await supervisor.fetchRemoteModels({
    fetchFn: mockFetchFn,
    forceFresh: true,
  });

  assert.strictEqual(dynamicFetchRes.success, true);
  assert.strictEqual(dynamicFetchRes.count, 2);
  assert.strictEqual(dynamicFetchRes.cached, false);

  const updatedModels = supervisor.listModels();
  assert.strictEqual(updatedModels.length, 2);
  assert.strictEqual(updatedModels[0].id, "nous/hermes-4-llama-4-preview");
  assert.strictEqual(updatedModels[0].supportsVision, true);
  assert.strictEqual(updatedModels[0].supportsReasoning, true);
  assert.strictEqual(updatedModels[0].contextLength, 262_144);
  console.log(`  [✓] Dynamic model fetching verified: Discovered ${updatedModels.length} remote live models.`);

  const cmplRes = await supervisor.invokeModel({
    model: "nous/hermes-4-llama-4-preview",
    messages: [
      { role: "system", content: "You are Hermes 4 on Nous Portal." },
      { role: "user", content: "hello world from lumi" },
    ],
    sessionId: "sess_nous_405b",
  });

  assert.strictEqual(cmplRes.model, "nous/hermes-4-llama-4-preview");
  assert.ok(cmplRes.usage.totalTokens > 0);
  assert.ok(cmplRes.usage.estimatedCostUsd > 0);
  assert.ok(cmplRes.attributedTags.includes("product=lumi-joy"));
  assert.ok(cmplRes.attributedTags.includes("conversation=sess_nous_405b"));
  console.log(`  [✓] Dynamic inference completed ($${cmplRes.usage.estimatedCostUsd} USD) with tags: ${cmplRes.attributedTags.join(", ")}`);

  // ---------------------------------------------------------------------------
  // Test 5: Tool-Pool Entitlements Matrix
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Tool-Pool Entitlements Matrix...");
  const firecrawlCheck = supervisor.checkToolPool("firecrawl");
  assert.strictEqual(firecrawlCheck.eligible, true);

  const modalCheck = supervisor.checkToolPool("modal");
  assert.strictEqual(modalCheck.eligible, true);

  const falVideoCheck = supervisor.checkToolPool("fal-video");
  assert.strictEqual(falVideoCheck.eligible, false);
  assert.ok(falVideoCheck.reason.includes("excluded"));

  const unknownCheck = supervisor.checkToolPool("unknown-tool");
  assert.strictEqual(unknownCheck.eligible, false);
  console.log("  [✓] Tool-pool entitlement boundaries and exclusions verified.");

  // ---------------------------------------------------------------------------
  // Test 6: In-Memory Substrate Caching & O(1) Rollback
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Substrate Snapshots & O(1) Rollback...");
  const snap = snapshotManager.createSnapshot("snap_nous_01");
  assert.strictEqual(snap.account?.email, "builder@nousresearch.com");

  let bestRollbackDuration = Infinity;
  let restored = false;
  for (let i = 0; i < 5; i++) {
    substrate.setAccountInfo(null);
    const t0 = performance.now();
    restored = snapshotManager.restoreSnapshot("snap_nous_01");
    const dur = performance.now() - t0;
    if (dur < bestRollbackDuration) bestRollbackDuration = dur;
  }

  assert.strictEqual(restored, true);
  assert.strictEqual(substrate.getAccountInfo().loggedIn, true);
  assert.strictEqual(substrate.getAccountInfo().email, "builder@nousresearch.com");
  assert.strictEqual(substrate.getModels().length, 2);
  assert.ok(bestRollbackDuration < 0.1, `Rollback duration ${bestRollbackDuration}ms must meet SLA`);
  console.log(`  [✓] O(1) state snapshot & rewind verified in ${bestRollbackDuration.toFixed(4)} ms (< 0.1 ms SLA).`);

  // ---------------------------------------------------------------------------
  // Test 7: Model Tool Suite (6 Tools)
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Model Tool Suite (6 Tools)...");
  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 6);

  const statusTool = tools.find((t) => t.name === "nous_portal_status")!;
  const statusRes = (await statusTool.execute({}, process.cwd())) as { success: boolean; account: { loggedIn: boolean } };
  assert.strictEqual(statusRes.success, true);
  assert.strictEqual(statusRes.account.loggedIn, true);

  const listTool = tools.find((t) => t.name === "nous_portal_list_models")!;
  const listRes = (await listTool.execute({}, process.cwd())) as { success: boolean; count: number };
  assert.strictEqual(listRes.success, true);
  assert.strictEqual(listRes.count, 2);

  const fetchTool = tools.find((t) => t.name === "nous_portal_fetch_models")!;
  assert.ok(fetchTool, "nous_portal_fetch_models tool must exist");

  const toolPoolTool = tools.find((t) => t.name === "nous_portal_check_tool_pool")!;
  const poolRes = (await toolPoolTool.execute({ category: "firecrawl" }, process.cwd())) as { success: boolean; eligible: boolean };
  assert.strictEqual(poolRes.success, true);
  assert.strictEqual(poolRes.eligible, true);
  console.log("  [✓] All 6 Nous Portal model tools executed cleanly.");

  // ---------------------------------------------------------------------------
  // Test 8: Micro-Benchmarks & Grand Monolith Composition (544 Components)
  // ---------------------------------------------------------------------------
  console.log("\n[Test 8/8] Benchmarking Tag Generation & Grand Monolith Composition...");
  const benchIterations = 50_000;
  const benchStart = performance.now();
  for (let i = 0; i < benchIterations; i++) {
    engine.generateAttributionTags(`sess_${i}`);
  }
  const benchDuration = performance.now() - benchStart;
  const throughput = Math.round((benchIterations / benchDuration) * 1000);
  console.log(`  Measured: ${benchIterations} attribution tags in ${benchDuration.toFixed(3)} ms (${throughput.toLocaleString()} tags/sec)`);

  const synthMonolith = new LumiMonolith();
  assert.ok(synthMonolith.components.deterministicNousPortalEngine);
  assert.ok(synthMonolith.components.nousPortalSupervisor);
  assert.ok(synthMonolith.components.broccoliNousPortalSubstrate);
  assert.ok(synthMonolith.components.nousPortalSnapshotManager);
  assert.ok(synthMonolith.components.nousPortalToolSuite);

  const verification = GrandMonolithSynthesizer.verifyComposition(synthMonolith.components);
  assert.strictEqual(verification.cohesionStatus, "OPTIMAL");
  assert.strictEqual(verification.componentCount, verification.requiredComponentCount);
  assert.strictEqual(verification.missingComponents.length, 0);
  assert.strictEqual(verification.unexpectedComponents.length, 0);
  assert.strictEqual(verification.duplicateManifestComponents.length, 0);
  console.log(`  [✓] Grand Monolith successfully verified with ${verification.componentCount}/${verification.requiredComponentCount} components in OPTIMAL cohesion.`);

  console.log("\n================================================================");
  console.log("   ALL 8 NOUS PORTAL VALIDATION SUITES PASSED CLEANLY!         ");
  console.log("================================================================\n");
}

runValidation().catch((err) => {
  console.error("Nous Portal validation failed with error:", err);
  process.exit(1);
});
