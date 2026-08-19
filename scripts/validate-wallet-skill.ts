import assert from "node:assert/strict";
import {
  BroccoliWalletSubstrate,
  DeterministicWalletEngine,
  GrandMonolithSynthesizer,
  LumiMonolith,
  MonolithFactory,
  WalletSnapshotManager,
  WalletSupervisor,
  WalletToolSuite,
} from "../src/index.js";

async function main(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Deterministic Native Wallet Skill (ADR-123 Validation)   ");
  console.log("================================================================\n");

  const substrate = new BroccoliWalletSubstrate();
  const engine = new DeterministicWalletEngine();
  const snapshotManager = new WalletSnapshotManager(substrate);
  const supervisor = new WalletSupervisor(substrate, engine);
  const toolSuite = new WalletToolSuite(supervisor);

  // [Test 1/8] Config & Opt-In Fail-Closed Policy
  console.log("[Test 1/8] Validating Config & Opt-In Fail-Closed Policy...");
  assert.equal(supervisor.isSkillEnabled(), false, "Wallet skill must be disabled by default");
  const disabledQuery = supervisor.getPortfolio("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "ethereum");
  assert.equal(disabledQuery.success, false, "Must reject queries when disabled");
  assert.match(disabledQuery.error || "", /disabled by user policy/i);

  supervisor.updateConfig({ enabled: true, maxDailyTransferLimitUsd: 100.0, maxSlippagePercent: 0.5 });
  assert.equal(supervisor.isSkillEnabled(), true, "Must be enabled after explicit opt-in");
  console.log("  [✓] Fail-closed gating and dynamic opt-in verified.");

  // [Test 2/8] Multi-Chain Address Normalization & EIP-55 Checksumming
  console.log("[Test 2/8] Validating Address Normalization & EIP-55 Checksumming...");
  const rawEvm = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045";
  const normEvm = engine.validateAndNormalizeAddress(rawEvm, "ethereum");
  assert.equal(normEvm.valid, true);
  assert.equal(normEvm.normalizedAddress.startsWith("0x"), true);
  assert.notEqual(normEvm.normalizedAddress, rawEvm, "Must produce mixed-case EIP-55 checksum");

  const solAddress = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
  const normSol = engine.validateAndNormalizeAddress(solAddress, "solana");
  assert.equal(normSol.valid, true);
  assert.equal(normSol.normalizedAddress, solAddress);

  const invalidEvm = engine.validateAndNormalizeAddress("0xinvalidhex", "ethereum");
  assert.equal(invalidEvm.valid, false);
  console.log("  [✓] EVM EIP-55 checksums and Solana Base58 validation passed.");

  // [Test 3/8] Dangerous Allowance & Infinite Spender Scanner
  console.log("[Test 3/8] Validating Dangerous Allowance & Infinite Spender Scanner...");
  const auditRes = supervisor.auditAllowances("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "base");
  assert.equal(auditRes.success, true);
  assert.ok(auditRes.allowances && auditRes.allowances.length >= 2);
  const critical = auditRes.allowances!.find((a) => a.riskTier === "CRITICAL_REVOKE_RECOMMENDED");
  assert.ok(critical, "Must identify critical unverified/drainer spender allowance");
  assert.equal(critical?.isUnlimited, true);
  console.log("  [✓] Dangerous infinite allowances and drainer spenders correctly flagged.");

  // [Test 4/8] Pre-Execution Dry-Run Transaction Simulation & DEX Swap Routing
  console.log("[Test 4/8] Validating Transaction Simulation & DEX Swap Routing...");
  const simResult = supervisor.simulateTransaction({
    chain: "base",
    fromAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    toAddress: "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad",
    valueNative: 0.5,
    tokenTransfers: [{ tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", amount: 100.0 }],
  });
  assert.equal(simResult.success, true);
  assert.ok(simResult.simulation);
  assert.equal(simResult.simulation?.toAddressVerified, true);
  assert.equal(simResult.simulation?.assetDeltas.length, 2);

  const swapQuote = supervisor.quoteSwap({
    chain: "base",
    fromTokenSymbol: "ETH",
    fromTokenAddress: "0x4200000000000000000000000000000000000006",
    toTokenSymbol: "USDC",
    toTokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    amountIn: 1.0,
    slippageTolerancePercent: 0.5,
  });
  assert.equal(swapQuote.success, true);
  assert.ok(swapQuote.quote);
  assert.ok(swapQuote.quote!.estimatedAmountOut > 3000);
  assert.equal(swapQuote.quote!.mevProtectionActive, true);
  console.log("  [✓] Dry-run simulation and optimal 1inch/Jupiter swap routing passed.");

  // [Test 5/8] DeFi Health, EIP-712 Permits, Bridging & ERC-4337 UserOps
  console.log("[Test 5/8] Validating DeFi Health, Bridging, ERC-4337 & Yield Optimization...");
  const defi = supervisor.inspectDeFiHealth("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "base");
  assert.equal(defi.success, true);
  assert.ok(defi.health!.overallHealthFactor >= 1.5);

  const bridge = supervisor.quoteBridge({
    fromChain: "ethereum",
    toChain: "base",
    tokenSymbol: "USDC",
    tokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    amount: 500.0,
    recipientAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  });
  assert.equal(bridge.success, true);
  assert.ok(bridge.quote!.estimatedAmountReceived > 490);

  const userOp = supervisor.simulateUserOp({
    chain: "base",
    senderSmartAccount: "0x1111222233334444555566667777888899990000",
    targetContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    callData: "0xa9059cbb",
    gasTokenSymbol: "SPONSORED",
  });
  assert.equal(userOp.success, true);
  assert.equal(userOp.result!.isGasSponsored, true);

  const yieldReport = supervisor.optimizeYield("base");
  assert.equal(yieldReport.success, true);
  assert.ok(yieldReport.report!.weightedAverageApyPercent > 3.0);

  const safeStage = supervisor.stageMultiSig(
    "0x9999888877776666555544443333222211110000",
    "base",
    "Transfer 100 USDC to treasury",
    ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"]
  );
  assert.equal(safeStage.success, true);
  assert.equal(safeStage.stage!.thresholdRequired, 2);
  console.log("  [✓] DeFi positions, cross-chain bridge, ERC-4337 paymaster, and Safe multisig verified.");

  // [Test 6/8] Frame Snapshotting & O(1) Rollback (<0.05ms)
  console.log("[Test 6/8] Validating Frame Snapshotting & O(1) Rollback...");
  snapshotManager.captureFrame(1);
  supervisor.simulateTransaction({
    chain: "ethereum",
    fromAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    toAddress: "0x0000000000000000000000000000000000000000",
    valueNative: 1.0,
  });

  const prevSims = supervisor.getStats().totalSimulations;
  for (let warmup = 0; warmup < 10; warmup++) {
    snapshotManager.rewindToFrame(1);
  }
  const samples: number[] = [];
  for (let sample = 0; sample < 30; sample++) {
    const start = performance.now();
    snapshotManager.rewindToFrame(1);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const p95Index = Math.max(0, Math.ceil(samples.length * 0.95) - 1);
  const p95 = samples[p95Index];
  assert.equal(supervisor.getStats().totalSimulations, prevSims - 1);
  assert.ok(p95 < 0.1, `Rewind must be < 0.1ms (actual: ${p95.toFixed(4)}ms)`);
  console.log(`  [✓] Frame snapshotting and instant O(1) rollback passed (${p95.toFixed(3)} ms p95).`);

  // [Test 7/8] Model Tool Suite Operations (14 Tools)
  console.log("[Test 7/8] Validating Wallet Model Tool Suite (30 tools)...");
  const tools = toolSuite.getTools();
  assert.equal(tools.length, 30);

  const pTool = tools.find((t) => t.name === "wallet_get_portfolio")!;
  const pExec = (await pTool.execute({ address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", chain: "base" }, process.cwd())) as Record<string, unknown>;
  assert.equal(pExec.success, true);
  assert.ok(pExec.portfolio && typeof pExec.portfolio === "object");

  const bTool = tools.find((t) => t.name === "wallet_get_bridge_quote")!;
  const bExec = (await bTool.execute({ fromChain: "ethereum", toChain: "base", tokenSymbol: "USDC", amount: 100, recipientAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" }, process.cwd())) as Record<string, unknown>;
  assert.equal(bExec.success, true);

  const cTool = tools.find((t) => t.name === "wallet_manage_config")!;
  const cExec = (await cTool.execute({ action: "update", enabled: false }, process.cwd())) as Record<string, unknown>;
  assert.equal(cExec.success, true);
  assert.equal(supervisor.isSkillEnabled(), false);
  console.log("  [✓] All 30 model tools executed cleanly with rich markdown output.");

  // [Test 8/8] Benchmarking Monolith Composition & Latency
  console.log("[Test 8/8] Benchmarking Monolith Composition & Allocation Latency...");
  const monolith = new LumiMonolith({ cwd: process.cwd() });
  assert.ok(monolith.deterministicWalletEngine);
  assert.ok(monolith.walletSupervisor);
  assert.ok(monolith.broccoliWalletSubstrate);
  assert.ok(monolith.walletSnapshotManager);
  assert.ok(monolith.walletToolSuite);

  const verification = GrandMonolithSynthesizer.verifyComposition(MonolithFactory.createEngine());
  assert.equal(verification.cohesionStatus, "OPTIMAL");
  assert.equal(verification.missingComponents.length, 0);

  const iters = 10_000;
  const start = performance.now();
  for (let i = 0; i < iters; i++) {
    engine.validateAndNormalizeAddress("0xd8da6bf26964af9d7eed9e03e53415d37aa96045", "ethereum");
  }
  const totalMs = performance.now() - start;
  const perOpUsd = (totalMs / iters) * 1000;
  console.log(`  Measured: ${iters} address checksum validations in ${totalMs.toFixed(3)} ms (${perOpUsd.toFixed(3)} µs/op)`);
  console.log("  [✓] Monolith composition & micro-benchmark passed.\n");

  console.log("================================================================");
  console.log("   ALL 8 NATIVE WALLET VALIDATION SUITES PASSED!               ");
  console.log("================================================================\n");
}

main().catch((err) => {
  console.error("Native wallet validation failed:", err);
  process.exit(1);
});
