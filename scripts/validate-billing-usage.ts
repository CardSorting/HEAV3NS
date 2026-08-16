/**
 * validate-billing-usage.ts
 *
 * Comprehensive validation suite for Dollar-Denominated Billing Usage,
 * Top-Up Balance Rollover & Low-Balance Alerting Subsystem (Phase 132 / ADR-108 / Target #65).
 */

import assert from "node:assert";
import { performance } from "node:perf_hooks";

import { DeterministicBillingUsageEngine } from "../src/agents/extensions/billing_usage/deterministic-billing-usage-engine.js";
import { BillingUsageSupervisor } from "../src/agents/extensions/billing_usage/billing-usage-supervisor.js";
import { BroccoliBillingUsageSubstrate } from "../src/sessions/extensions/billing_usage/broccoli-billing-usage-substrate.js";
import { BillingUsageSnapshotManager } from "../src/sessions/extensions/billing_usage/billing-usage-snapshot-manager.js";
import { BillingUsageToolSuite } from "../src/tooling/extensions/billing_usage/billing-usage-tool-suite.js";

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Dollar-Denominated Billing Usage Subsystem (ADR-108)    ");
  console.log("================================================================\n");

  const substrate = new BroccoliBillingUsageSubstrate();
  const engine = new DeterministicBillingUsageEngine();
  const snapshotManager = new BillingUsageSnapshotManager(substrate);
  const supervisor = new BillingUsageSupervisor(substrate, engine);
  const toolSuite = new BillingUsageToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Suite 1: Billing Account Initialization & Defaults
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating Billing Account Initialization & Defaults...");

  const defaultModel = supervisor.getUsageModel();
  assert.strictEqual(defaultModel.status, "free");
  assert.strictEqual(defaultModel.planAllowanceUsd, 0);
  assert.strictEqual(defaultModel.totalSpendableUsd, 0);
  assert.strictEqual(defaultModel.isLowBalance, false);
  console.log("  [✓] Default billing state initialized cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 2: USD Precision Formatting & Humanized Date Parsing
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating USD Precision Math & Date Formatting...");

  assert.strictEqual(engine.formatUsd(12.3456), "$12.35");
  assert.strictEqual(engine.formatUsd(0), "$0.00");
  assert.strictEqual(engine.formatUsd(1000000.5), "$1,000,000.50");
  assert.strictEqual(engine.formatUsd(undefined), "$0.00");

  const formattedDate = engine.formatRenews("2026-07-24T11:05:01.000Z");
  assert.strictEqual(formattedDate, "Jul 24, 2026");
  console.log(`  Formatted date: ${formattedDate}`);
  console.log("  [✓] USD precision formatting and ISO date conversion verified.");

  // ---------------------------------------------------------------------------
  // Suite 3: Dual Usage Bars (Plan % Used vs. Top-up Rollover)
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Dual Usage Bars Calculation...");

  supervisor.updateAccountInfo({
    accountId: "acct-pro-1",
    isPaidPlan: true,
    planAllowanceUsd: 20.0,
    planRemainingUsd: 15.0,
    topupRemainingUsd: 50.0,
    periodEndIso: "2026-08-31T00:00:00.000Z",
  });

  const proModel = supervisor.getUsageModel();
  assert.strictEqual(proModel.status, "active_paid");
  assert.strictEqual(proModel.totalSpendableUsd, 65.0);
  assert.strictEqual(proModel.planSpentUsd, 5.0);

  assert.ok(proModel.planBar);
  assert.strictEqual(proModel.planBar.pctUsed, 25); // 5 spent of 20 = 25% used
  assert.strictEqual(proModel.planBar.fillFraction, 0.75); // 15 remaining of 20 = 75% remaining

  assert.ok(proModel.topupBar);
  assert.strictEqual(proModel.topupBar.remainingUsd, 50.0);
  assert.strictEqual(proModel.topupBar.fillFraction, 1.0);
  console.log("  [✓] Dual bars computed with accurate percentages and fractions.");

  // ---------------------------------------------------------------------------
  // Suite 4: Account Status Classification & Low-Balance Alerting
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Account Status Classification & Alerting...");

  // Set total spendable to $3.00 (below default $5.00 threshold)
  supervisor.updateAccountInfo({
    planRemainingUsd: 1.0,
    topupRemainingUsd: 2.0,
  });

  const lowModel = supervisor.getUsageModel();
  assert.strictEqual(lowModel.status, "low_balance");
  assert.strictEqual(lowModel.isLowBalance, true);

  // Set total spendable to $0.00
  supervisor.updateAccountInfo({
    planRemainingUsd: 0.0,
    topupRemainingUsd: 0.0,
  });

  const exhModel = supervisor.getUsageModel();
  assert.strictEqual(exhModel.status, "exhausted");
  assert.strictEqual(exhModel.isLowBalance, true);
  console.log("  [✓] Account status flags ('low_balance', 'exhausted') correctly triggered.");

  // ---------------------------------------------------------------------------
  // Suite 5: Debit Prioritization (Plan Allowance First, Top-up Second)
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Debit Prioritization Order...");

  // Setup: $10 plan remaining, $20 top-up remaining
  supervisor.updateAccountInfo({
    planAllowanceUsd: 20.0,
    planRemainingUsd: 10.0,
    topupRemainingUsd: 20.0,
    isPaidPlan: true,
  });

  // Debit $15.00 -> Should exhaust $10 from plan, then take $5 from topup
  const debitRes = supervisor.debitUsage(15.0, "GPT-4o API Batch Run");
  assert.strictEqual(debitRes.transaction.planDebitedUsd, 10.0);
  assert.strictEqual(debitRes.transaction.topupDebitedUsd, 5.0);
  assert.strictEqual(debitRes.model.planRemainingUsd, 0.0);
  assert.strictEqual(debitRes.model.topupRemainingUsd, 15.0);
  assert.strictEqual(debitRes.model.totalSpendableUsd, 15.0);
  console.log("  [✓] Debit prioritization (plan first: $10, topup second: $5) strictly enforced.");

  // ---------------------------------------------------------------------------
  // Suite 6: In-Memory Substrate Binary Snapshotting & O(1) Rollback
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Binary Snapshotting & O(1) Rollback...");

  const snap = snapshotManager.takeSnapshot("snap-billing-1");
  assert.strictEqual(snap.accountInfo.topupRemainingUsd, 15.0);

  // Credit top-up $100
  supervisor.addTopup(100.0, "Manual Refill");
  assert.strictEqual(supervisor.getUsageModel().topupRemainingUsd, 115.0);

  // Rewind
  const tRewindStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("snap-billing-1");
  const rewindLatencyMs = performance.now() - tRewindStart;

  assert.ok(restored, "Snapshot restore must succeed");
  assert.strictEqual(supervisor.getUsageModel().topupRemainingUsd, 15.0);
  assert.ok(rewindLatencyMs < 0.05, `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.05 ms SLA`);
  console.log(`  [✓] Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms).`);

  // ---------------------------------------------------------------------------
  // Suite 7: Model Tool Suite Execution
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Model Tool Suite (5 Tools)...");

  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 5, "Must expose exactly 5 model tools");

  const getModelTool = tools.find((t) => t.name === "billing_usage_get_model")!;
  const debitTool = tools.find((t) => t.name === "billing_usage_record_debit")!;
  const topupTool = tools.find((t) => t.name === "billing_usage_add_topup")!;
  const configTool = tools.find((t) => t.name === "billing_usage_configure")!;
  const metricsTool = tools.find((t) => t.name === "billing_usage_get_metrics")!;

  const getRes = (await getModelTool.execute({}, "")) as any;
  assert.strictEqual(getRes.success, true);
  assert.ok(getRes.summary.includes("Account Status:"));

  const topupRes = (await topupTool.execute({ amountUsd: 25.0, reason: "Stripe Purchase" }, "")) as any;
  assert.strictEqual(topupRes.success, true);
  assert.strictEqual(topupRes.updatedModel.topupRemainingUsd, 40.0);

  const debitToolRes = (await debitTool.execute({ amountUsd: 10.0, reason: "Claude 3.7 Sonnet" }, "")) as any;
  assert.strictEqual(debitToolRes.success, true);
  assert.strictEqual(debitToolRes.updatedModel.topupRemainingUsd, 30.0);

  const cfgRes = (await configTool.execute({ lowBalanceThresholdUsd: 10.0 }, "")) as any;
  assert.strictEqual(cfgRes.success, true);
  assert.strictEqual(cfgRes.config.lowBalanceThresholdUsd, 10.0);

  const metRes = (await metricsTool.execute({}, "")) as any;
  assert.strictEqual(metRes.success, true);
  assert.ok(metRes.metrics.totalSpendUsd > 0);
  console.log("  [✓] All 5 Billing Usage model tools executed cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 8: High-Frequency Usage Model & ASCII Bar Micro-Benchmarks
  // ---------------------------------------------------------------------------
  console.log("\n[Test 8/8] Benchmarking High-Frequency Usage Model Calculations...");

  const iterations = 100000;
  const testAccount = { ...supervisor.getAccountInfo() };
  const testConfig = { ...supervisor.getConfig() };

  const tBenchStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    engine.buildUsageModel(testAccount, testConfig);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} model computations in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(throughputOpsPerSec > 1000000, "Throughput must exceed 1,000,000 ops/sec");

  console.log("  [✓] Ultra-high-throughput benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 BILLING USAGE VALIDATION SUITES PASSED CLEANLY!       ");
  console.log("================================================================\n");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
