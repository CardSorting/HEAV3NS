/**
 * validate-local-ergonomics-pro.ts
 *
 * Comprehensive validation suite for advanced local LLM ergonomics:
 * System Hardware Profiler, VRAM Compatibility Evaluator, In-TUI Model Puller,
 * Process Supervisor, and 7-Tab Local Control Center (Phase 105 / ADR-052).
 */

import * as assert from "node:assert/strict";
import {
  LumiMonolith,
  DeterministicLocalEndpointEngine,
  LocalHardwareProfiler,
  LocalModelPuller,
  LocalProcessSupervisor,
  LocalEndpointDashboardModal,
  type ModelPullProgress,
} from "../src/index.js";

async function testHardwareProfilerAndVram(): Promise<void> {
  console.log("[Test 1/6] Validating LocalHardwareProfiler & VRAM Compatibility Engine...");
  const profiler = new LocalHardwareProfiler();

  const hw = profiler.assessHardware();
  assert.ok(hw.totalMemoryBytes > 0);
  assert.ok(hw.totalMemoryGb > 0);
  assert.ok(hw.cpuCores > 0);
  assert.ok(typeof hw.hasAppleSiliconMetal === "boolean");
  assert.ok(hw.estimatedGpuHeadroomGb > 0);
  assert.ok(hw.summaryText.length > 0);

  // Model size evaluations
  const smallModel = profiler.evaluateModel("llama3.2:3b", "3B", "Q4_K_M");
  assert.equal(smallModel.tier, "optimal_gpu");
  assert.ok(smallModel.badge.includes("100% GPU"));
  assert.equal(smallModel.isRecommendedForHost, true);

  const mediumModel = profiler.evaluateModel("qwen2.5-coder:7b", "7B", "Q4_K_M");
  assert.ok(mediumModel.estimatedTotalMemoryGb > 0);
  assert.ok(mediumModel.estimatedWeightBytes > 0);

  const hugeModel = profiler.evaluateModel("llama-3.3-70b-fp16", "70B", "FP16");
  assert.ok(hugeModel.estimatedTotalMemoryGb > 100);
  assert.ok(hugeModel.tier === "insufficient_ram" || hugeModel.tier === "cpu_spill");

  const card = profiler.formatHardwareCard();
  assert.ok(card.includes("System Hardware & Local VRAM Capacity"));
  assert.ok(card.includes("RAM Utilization"));

  console.log(`  [✓] Hardware profiled: ${hw.totalMemoryGb}GB RAM, ${hw.estimatedGpuHeadroomGb}GB VRAM headroom on ${hw.platform}.`);
}

async function testStreamingModelPuller(): Promise<void> {
  console.log("[Test 2/6] Validating In-TUI & CLI Streaming Model Puller...");
  const puller = new LocalModelPuller();

  // Test progress bar formatter
  const bar1 = puller.formatProgressBar(50, 2 * 1024 * 1024 * 1024, 4 * 1024 * 1024 * 1024, 50 * 1024 * 1024, 40);
  assert.ok(bar1.includes("50%"));
  assert.ok(bar1.includes("2.0/4.0 GB"));
  assert.ok(bar1.includes("50.0 MB/s"));
  assert.ok(bar1.includes("ETA 40s"));

  // Test simulated pull stream
  const updates: ModelPullProgress[] = [];
  const finalProgress = await puller.simulatePull("qwen2.5-coder:7b", (p) => {
    updates.push(p);
  });

  assert.equal(finalProgress.done, true);
  assert.equal(finalProgress.percentage, 100);
  assert.equal(finalProgress.phase, "completed");
  assert.ok(updates.length >= 5);

  console.log("  [✓] Streaming pull engine and progress formatting verified.");
}

async function testProcessSupervisor(): Promise<void> {
  console.log("[Test 3/6] Validating LocalProcessSupervisor & Daemon Launcher...");
  const supervisor = new LocalProcessSupervisor();

  const ollamaPath = supervisor.findBinary("ollama");
  assert.ok(ollamaPath === null || typeof ollamaPath === "string");

  const macInst = supervisor.getInstallInstructions("ollama");
  assert.ok(macInst.includes("Ollama"));

  // Check healthCheck detection when already active or starting
  const dummyHealthCheck = async () => true;
  const result = await supervisor.startServer("ollama", dummyHealthCheck, "/fake/ollama/bin");
  assert.equal(result.started, true);
  assert.equal(result.alreadyRunning, true);

  console.log("  [✓] Process supervisor binary discovery and health polling verified.");
}

async function testDeterministicEngineVramIntegration(): Promise<void> {
  console.log("[Test 4/6] Validating Engine VRAM Annotations & Cost Savings Tally...");
  const engine = new DeterministicLocalEndpointEngine();

  const hw = engine.getHardwareAssessment();
  assert.ok(hw.totalMemoryGb > 0);

  const hwCard = engine.getHardwareCard();
  assert.ok(hwCard.includes("System Hardware"));

  const evalRes = engine.evaluateModelCompatibility("deepseek-r1:8b");
  assert.ok(evalRes.badge.length > 0);

  // Record turns and verify cost saved calculation ($3.00/1M cloud tokens)
  engine.recordTurn("ollama", 1_000_000, 450);
  const metrics = engine.getMetrics();
  assert.equal(metrics.totalLocalTurns, 1);
  assert.equal(metrics.totalLocalTokens, 1_000_000);
  assert.equal(metrics.estimatedCostSavedUsd, 3.0);

  console.log("  [✓] Local token metrics and $3.00 cost savings verified.");
}

async function testEnhanced7TabDashboardModal(): Promise<void> {
  console.log("[Test 5/6] Validating Enhanced 7-Tab Local Control Center Modal...");
  const engine = new DeterministicLocalEndpointEngine();
  let selectedModel: string | undefined;

  const modal = new LocalEndpointDashboardModal(engine, (m) => {
    selectedModel = m;
  });

  modal.open();
  assert.equal(modal.isOpen(), true);

  // Test 1: Fleet tab
  modal.setViewMode("fleet");
  const outFleet = modal.render();
  assert.ok(outFleet.includes("FLEET"));

  // Test 2: Models tab
  modal.setViewMode("models");
  const outModels = modal.render();
  assert.ok(outModels.includes("MODELS"));

  // Test 3: Pull tab
  modal.setViewMode("pull");
  const outPull = modal.render();
  assert.ok(outPull.includes("IN-APP MODEL DOWNLOADER"));
  assert.ok(outPull.includes("qwen2.5-coder"));

  // Test 4: Hardware tab
  modal.setViewMode("hardware");
  const outHw = modal.render();
  assert.ok(outHw.includes("SYSTEM HARDWARE & LOCAL VRAM CAPACITY"));
  assert.ok(outHw.includes("RAM Utilization"));

  // Test 5: Endpoints tab
  modal.setViewMode("endpoints");
  const outEndp = modal.render();
  assert.ok(outEndp.includes("CONFIGURED LOCAL ENDPOINT PROFILES"));

  // Test 6: Guides tab
  modal.setViewMode("guides");
  const outGuides = modal.render();
  assert.ok(outGuides.includes("BEGINNER LOCAL LLM SETUP"));

  // Test 7: Telemetry tab
  modal.setViewMode("diagnostics");
  const outDiag = modal.render();
  assert.ok(outDiag.includes("LOCAL LLM SLA & TELEMETRY"));

  // Cycle view mode
  modal.setViewMode("fleet");
  modal.cycleViewMode(); // -> models
  assert.ok(modal.render().includes("MODELS"));

  // Close modal
  const closeAction = modal.handleKey("escape");
  assert.equal(closeAction.action, "close");
  assert.equal(modal.isOpen(), false);

  console.log("  [✓] 7-Tab Modal navigation, hardware graphs, and in-app pull tab verified.");
}

async function testMonolithIntegrationAndCli(): Promise<void> {
  console.log("[Test 6/6] Validating Grand Monolith Subsystem Wiring...");
  const monolith = new LumiMonolith();

  // Test Hardware Card generation from Monolith
  const card = monolith.proxyGateway.getLocalEngine().getHardwareCard();
  assert.ok(card.includes("System Hardware"));

  // Test probe all servers includes hardware assessment
  const report = await monolith.proxyGateway.getLocalEngine().probeAllServers();
  assert.ok(report.hardwareAssessment);
  assert.ok(report.hardwareAssessment.totalMemoryGb > 0);

  console.log("  [✓] Grand Monolith wiring and hardware telemetry integration verified.");
}

async function main(): Promise<void> {
  console.log("================================================================");
  console.log(" LUMI Local LLM Ergonomics Pro & Hardware Assessment Suite    ");
  console.log(" (VRAM Calculator, Model Puller, Process Supervisor, 7-Tab TUI)");
  console.log("================================================================\n");

  await testHardwareProfilerAndVram();
  await testStreamingModelPuller();
  await testProcessSupervisor();
  await testDeterministicEngineVramIntegration();
  await testEnhanced7TabDashboardModal();
  await testMonolithIntegrationAndCli();

  console.log("\n================================================================");
  console.log("  [✓] ALL ADVANCED LOCAL ERGONOMICS CHECKS PASSED!             ");
  console.log("================================================================\n");
}

main().catch((err) => {
  console.error("Local ergonomics validation failed:", err);
  process.exit(1);
});
