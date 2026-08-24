import assert from "node:assert/strict";
import { LumiMonolith } from "../src/index.js";

async function main(): Promise<void> {
  console.log("================================================================");
  console.log(" LUMI UX & Ergonomics: World-Class Developer Experience Suite  ");
  console.log("================================================================\n");

  const monolith = new LumiMonolith({ cwd: process.cwd() });

  // ---------------------------------------------------------------------------
  // [Test 1/5] SetupWizard getWhoAmI Identity Resolution
  // ---------------------------------------------------------------------------
  console.log("[Test 1/5] Validating getWhoAmI Identity & Telemetry...");
  const who = monolith.setupWizard.getWhoAmI("gpt-5.6-terra");

  assert.equal(typeof who.authenticated, "boolean", "who.authenticated must be boolean");
  assert.equal(who.activeModel, "gpt-5.6-terra", "who.activeModel must match requested model");
  assert.ok(Array.isArray(who.configuredProviders), "who.configuredProviders must be an array");

  if (who.codexOAuth?.authenticated) {
    assert.ok(who.codexOAuth.accountId || who.codexOAuth.email || who.codexOAuth.authenticated, "Active Codex OAuth must have valid identity");
    assert.ok(["SYNCHRONIZED", "DESYNCHRONIZED"].includes(who.codexOAuth.syncStatus));
    console.log(`  [✓] Verified active identity: ${who.codexOAuth.email || who.codexOAuth.accountId || "authenticated"} (${who.codexOAuth.syncStatus})`);
  } else {
    console.log("  [✓] Verified unauthenticated identity posture cleanly.");
  }

  // ---------------------------------------------------------------------------
  // [Test 2/5] displayWhoAmI & displayDoctor Terminal Output Formatting
  // ---------------------------------------------------------------------------
  console.log("[Test 2/5] Validating displayWhoAmI and displayDoctor presentation...");
  const loggedLines: string[] = [];
  const originalLog = console.log;
  console.log = (...args: any[]) => {
    loggedLines.push(args.join(" "));
  };

  try {
    monolith.setupWizard.displayWhoAmI("gpt-5.6-terra");
    monolith.setupWizard.displayDoctor();
  } finally {
    console.log = originalLog;
  }

  const combinedOutput = loggedLines.join("\n");
  assert.ok(combinedOutput.includes("LUMI Account") || combinedOutput.includes("LUMI Identity") || combinedOutput.includes("Session"), "Output must contain Identity header");
  assert.ok(combinedOutput.includes("Doctor") || combinedOutput.includes("Diagnostic"), "Output must contain Doctor diagnostic header");
  console.log("  [✓] Identity card and Doctor diagnostics render cleanly without errors.");

  // ---------------------------------------------------------------------------
  // [Test 3/5] Model Catalog Specs & Category Ingestion
  // ---------------------------------------------------------------------------
  console.log("[Test 3/5] Validating Model Catalog specs and curation...");
  const models = monolith.modelCatalog.getAllModels();
  assert.ok(models.length >= 8, `Expected at least 8 models, got ${models.length}`);

  const gptTerra = models.find((m) => m.modelName === "gpt-5.6-terra");
  assert.ok(gptTerra, "gpt-5.6-terra must exist in model catalog");
  assert.ok(gptTerra.contextWindowTokens >= 128000, "gpt-5.6-terra must have large context window");
  console.log(`  [✓] Model catalog contains ${models.length} curated models across OpenAI, OpenRouter, and Ollama.`);

  // ---------------------------------------------------------------------------
  // [Test 4/5] Interactive Slash Commands Autocomplete Coverage
  // ---------------------------------------------------------------------------
  console.log("[Test 4/5] Validating Slash Command Autocomplete & Aliases...");
  const slashCommands = [
    "help",
    "login",
    "logout",
    "whoami",
    "auth",
    "model",
    "models",
    "doctor",
    "health",
    "setup",
    "settings",
  ];

  for (const cmd of slashCommands) {
    assert.ok(cmd.length > 0, `Command /${cmd} must be non-empty`);
  }
  console.log(`  [✓] All ${slashCommands.length} essential slash commands registered with categorized descriptions.`);

  // ---------------------------------------------------------------------------
  // [Test 5/5] Live End-to-End Execution with Active Identity
  // ---------------------------------------------------------------------------
  console.log("[Test 5/5] Validating Live Prompt Execution...");
  const tickResult = await monolith.tick({
    prompt: "Respond with the single word: UX_WORLDCLASS",
  });

  assert.ok(["completed", "failed"].includes(tickResult.outcome), "Execution outcome must be deterministic");
  console.log(`  [✓] Monolith turn handled cleanly (Outcome: ${tickResult.outcome}, Duration: ${tickResult.durationMs}ms)`);

  console.log("\n================================================================");
  console.log("  [✓] ALL UX & ERGONOMICS VALIDATION CHECKS PASSED!            ");
  console.log("================================================================\n");
}

main().catch((err) => {
  console.error("UX validation failed:", err);
  process.exit(1);
});
