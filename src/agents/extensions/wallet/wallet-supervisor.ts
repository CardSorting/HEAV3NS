/**
 * wallet-supervisor.ts
 *
 * Master Wallet Skill Supervisor coordinating opt-in enablement, multi-chain address checks,
 * transaction dry-run simulations, dangerous allowance audits, swap quotes, DeFi health factor scoring,
 * EIP-712 permit inspection, Across/LiFi bridging, ERC-4337 UserOp simulation, yield staking optimization,
 * Gnosis Safe multi-sig staging, gas advice, and address book directories (Phase 93 / ADR-123).
 */

import type {
  AccountAbstractionSimulationResult,
  AddressBookContact,
  BridgeQuoteRequest,
  BridgeQuoteResult,
  ContractInspectionResult,
  DeFiHealthReport,
  EIP712SignatureAuditRequest,
  EIP712SignatureAuditResult,
  GasMarketReport,
  MultiSigTransactionStage,
  SupportedChain,
  SwapQuoteRequest,
  SwapQuoteResult,
  TokenAllowanceRecord,
  TransactionSimulationRequest,
  TransactionSimulationResult,
  UserOperationRequest,
  WalletBulkMutationResult,
  WalletDslQueryFilter,
  WalletGroupBy,
  WalletGroupedLane,
  WalletHealthAuditReport,
  WalletMetricsReport,
  WalletPortfolio,
  WalletSkillConfig,
  WalletSortBy,
  WalletSortDirection,
  WalletSubstrateSnapshot,
  YieldOptimizationReport,
} from "../../../core/contracts/wallet.contracts.js";
import { BroccoliWalletSubstrate } from "../../../sessions/extensions/wallet/broccoli-wallet-substrate.js";
import { DeterministicWalletEngine } from "../../../tooling/extensions/wallet/deterministic-wallet-engine.js";

export class WalletSupervisor {
  private substrate: BroccoliWalletSubstrate;
  private engine: DeterministicWalletEngine;

  constructor(substrate: BroccoliWalletSubstrate, engine: DeterministicWalletEngine) {
    this.substrate = substrate;
    this.engine = engine;
  }

  isSkillEnabled(): boolean {
    return this.substrate.getConfig().enabled;
  }

  getConfig(): WalletSkillConfig {
    return this.substrate.getConfig();
  }

  updateConfig(updates: Partial<WalletSkillConfig>): WalletSkillConfig {
    return this.substrate.updateConfig(updates);
  }

  /**
   * Retrieves the wallet portfolio across requested chain.
   */
  getPortfolio(
    address: string,
    chain: SupportedChain = "base"
  ): { success: boolean; portfolio?: WalletPortfolio; error?: string } {
    if (!this.isSkillEnabled()) {
      return {
        success: false,
        error: "Skill 'wallet' is currently disabled by user policy. Enable it via wallet_manage_config({ enabled: true }).",
      };
    }

    const config = this.getConfig();
    if (!config.allowedChains.includes(chain)) {
      return {
        success: false,
        error: `Chain '${chain}' is not in the allowedChains whitelist: [${config.allowedChains.join(", ")}]`,
      };
    }

    const portfolio = this.engine.fetchPortfolio(address, chain);
    this.substrate.storePortfolio(portfolio);

    return {
      success: true,
      portfolio,
    };
  }

  /**
   * Audits token allowances for high-risk infinite spenders.
   */
  auditAllowances(
    address: string,
    chain: SupportedChain = "base"
  ): { success: boolean; allowances?: readonly TokenAllowanceRecord[]; error?: string } {
    if (!this.isSkillEnabled()) {
      return {
        success: false,
        error: "Skill 'wallet' is currently disabled by user policy. Enable it via wallet_manage_config({ enabled: true }).",
      };
    }

    const records = this.engine.auditAllowances(address, chain);
    for (const r of records) {
      this.substrate.storeAllowance(r);
    }

    return {
      success: true,
      allowances: records,
    };
  }

  /**
   * Simulates a transaction dry-run before execution, verifying safety and calculating asset deltas.
   */
  simulateTransaction(
    request: TransactionSimulationRequest
  ): { success: boolean; simulation?: TransactionSimulationResult; error?: string } {
    if (!this.isSkillEnabled()) {
      return {
        success: false,
        error: "Skill 'wallet' is currently disabled by user policy. Enable it via wallet_manage_config({ enabled: true }).",
      };
    }

    const sim = this.engine.simulateTransaction(request);
    this.substrate.storeSimulation(sim);

    return {
      success: sim.success,
      simulation: sim,
      error: sim.error,
    };
  }

  /**
   * Inspects smart contract bytecode and security signals.
   */
  inspectContract(
    address: string,
    chain: SupportedChain = "base"
  ): { success: boolean; inspection?: ContractInspectionResult; error?: string } {
    if (!this.isSkillEnabled()) {
      return {
        success: false,
        error: "Skill 'wallet' is currently disabled by user policy. Enable it via wallet_manage_config({ enabled: true }).",
      };
    }

    const inspection = this.engine.inspectContract(address, chain);
    return {
      success: true,
      inspection,
    };
  }

  /**
   * Quotes optimal swap route via DEX aggregation.
   */
  quoteSwap(
    request: SwapQuoteRequest
  ): { success: boolean; quote?: SwapQuoteResult; error?: string } {
    if (!this.isSkillEnabled()) {
      return {
        success: false,
        error: "Skill 'wallet' is currently disabled by user policy. Enable it via wallet_manage_config({ enabled: true }).",
      };
    }

    const quote = this.engine.quoteSwap(request);
    this.substrate.storeSwapQuote(quote);

    return {
      success: true,
      quote,
    };
  }

  /**
   * Inspects user borrowing and collateral health factor across lending protocols.
   */
  inspectDeFiHealth(
    address: string,
    chain: SupportedChain = "base"
  ): { success: boolean; health?: DeFiHealthReport; error?: string } {
    if (!this.isSkillEnabled()) {
      return {
        success: false,
        error: "Skill 'wallet' is currently disabled by user policy. Enable it via wallet_manage_config({ enabled: true }).",
      };
    }

    const report = this.engine.inspectDeFiHealth(address, chain);
    for (const p of report.positions) {
      this.substrate.storeDeFiPosition(p);
    }

    return {
      success: true,
      health: report,
    };
  }

  /**
   * Scans off-chain EIP-712 typed permit signatures for drainer payloads.
   */
  auditSignature(
    request: EIP712SignatureAuditRequest
  ): { success: boolean; audit?: EIP712SignatureAuditResult; error?: string } {
    if (!this.isSkillEnabled()) {
      return {
        success: false,
        error: "Skill 'wallet' is currently disabled by user policy. Enable it via wallet_manage_config({ enabled: true }).",
      };
    }

    const audit = this.engine.auditSignature(request);
    return {
      success: !audit.isPhishingDrainerPattern,
      audit,
      error: audit.isPhishingDrainerPattern ? "Aborted: Malicious drainer signature detected" : undefined,
    };
  }

  /**
   * Quotes cross-chain bridge routes (Across / Li.Fi / Stargate).
   */
  quoteBridge(
    request: BridgeQuoteRequest
  ): { success: boolean; quote?: BridgeQuoteResult; error?: string } {
    if (!this.isSkillEnabled()) {
      return {
        success: false,
        error: "Skill 'wallet' is currently disabled by user policy. Enable it via wallet_manage_config({ enabled: true }).",
      };
    }

    const quote = this.engine.quoteBridge(request);
    this.substrate.storeBridgeQuote(quote);

    return {
      success: true,
      quote,
    };
  }

  /**
   * Simulates an ERC-4337 UserOperation with paymaster gas sponsorship.
   */
  simulateUserOp(
    request: UserOperationRequest
  ): { success: boolean; result?: AccountAbstractionSimulationResult; error?: string } {
    if (!this.isSkillEnabled()) {
      return {
        success: false,
        error: "Skill 'wallet' is currently disabled by user policy. Enable it via wallet_manage_config({ enabled: true }).",
      };
    }

    const sim = this.engine.simulateUserOp(request);
    this.substrate.storeUserOp(sim);

    return {
      success: true,
      result: sim,
    };
  }

  /**
   * Evaluates yield and staking positions with compound projections.
   */
  optimizeYield(
    chain: SupportedChain = "base"
  ): { success: boolean; report?: YieldOptimizationReport; error?: string } {
    if (!this.isSkillEnabled()) {
      return {
        success: false,
        error: "Skill 'wallet' is currently disabled by user policy. Enable it via wallet_manage_config({ enabled: true }).",
      };
    }

    const report = this.engine.optimizeYield(chain);
    for (const p of report.positions) {
      this.substrate.storeYieldPosition(p);
    }

    return {
      success: true,
      report,
    };
  }

  /**
   * Stages a Gnosis Safe multi-sig transaction with quorum tracking.
   */
  stageMultiSig(
    safeAddress: string,
    chain: SupportedChain,
    proposedAction: string,
    signers: readonly string[] = [],
    thresholdRequired?: number
  ): { success: boolean; stage?: MultiSigTransactionStage; error?: string } {
    if (!this.isSkillEnabled()) {
      return {
        success: false,
        error: "Skill 'wallet' is currently disabled by user policy. Enable it via wallet_manage_config({ enabled: true }).",
      };
    }

    const stage = this.engine.stageMultiSig(safeAddress, chain, proposedAction, signers, thresholdRequired);
    this.substrate.storeMultiSigStage(stage);

    return {
      success: true,
      stage,
    };
  }

  /**
   * Retrieves real-time gas market pricing and timing recommendations.
   */
  getGasReport(
    chain: SupportedChain = "base"
  ): { success: boolean; gasReport?: GasMarketReport; error?: string } {
    if (!this.isSkillEnabled()) {
      return {
        success: false,
        error: "Skill 'wallet' is currently disabled by user policy. Enable it via wallet_manage_config({ enabled: true }).",
      };
    }

    const report = this.engine.getGasReport(chain);
    return {
      success: true,
      gasReport: report,
    };
  }

  /**
   * Resolves or adds an address book contact.
   */
  resolveNameOrContact(
    nameOrAddress: string,
    chain: SupportedChain = "base"
  ): { success: boolean; contact?: AddressBookContact; error?: string } {
    if (!this.isSkillEnabled()) {
      return {
        success: false,
        error: "Skill 'wallet' is currently disabled by user policy. Enable it via wallet_manage_config({ enabled: true }).",
      };
    }

    const contact = this.engine.resolveNameOrContact(nameOrAddress, chain);
    this.substrate.storeContact(contact);

    return {
      success: true,
      contact,
    };
  }

  getSwapQuote(request: SwapQuoteRequest): { success: boolean; swapQuote?: SwapQuoteResult; error?: string } {
    const res = this.quoteSwap(request);
    return {
      success: res.success,
      swapQuote: res.quote,
      error: res.error,
    };
  }

  getDeFiHealth(address: string, chain: SupportedChain = "base"): { success: boolean; healthReport?: DeFiHealthReport; error?: string } {
    const res = this.inspectDeFiHealth(address, chain);
    return {
      success: res.success,
      healthReport: res.health,
      error: res.error,
    };
  }

  auditEIP712Signature(request: EIP712SignatureAuditRequest): { success: boolean; auditResult?: EIP712SignatureAuditResult; error?: string } {
    const res = this.auditSignature(request);
    return {
      success: res.success,
      auditResult: res.audit,
      error: res.error,
    };
  }

  getBridgeQuote(request: BridgeQuoteRequest): { success: boolean; bridgeQuote?: BridgeQuoteResult; error?: string } {
    const res = this.quoteBridge(request);
    return {
      success: res.success,
      bridgeQuote: res.quote,
      error: res.error,
    };
  }

  getYieldOptimizationReport(_address: string, chain: SupportedChain = "base"): { success: boolean; yieldReport?: YieldOptimizationReport; error?: string } {
    const res = this.optimizeYield(chain);
    return {
      success: res.success,
      yieldReport: res.report,
      error: res.error,
    };
  }

  stageMultiSigTransaction(
    safeAddress: string,
    chain: SupportedChain,
    thresholdRequired: number,
    signers: readonly string[],
    proposedAction: string
  ): { success: boolean; stage?: MultiSigTransactionStage; error?: string } {
    return this.stageMultiSig(safeAddress, chain, proposedAction, signers, thresholdRequired);
  }

  getStats(): WalletSubstrateSnapshot {
    return this.substrate.exportSnapshot();
  }

  auditHealth(): WalletHealthAuditReport {
    return this.substrate.auditHealth();
  }

  getMetrics(): WalletMetricsReport {
    return this.substrate.getMetrics();
  }

  getGroupedPortfolios(groupBy?: WalletGroupBy, sortBy?: WalletSortBy, direction?: WalletSortDirection): readonly WalletGroupedLane[] {
    return this.substrate.getGroupedPortfolios(groupBy, sortBy, direction);
  }

  queryDsl(query: WalletDslQueryFilter | string): readonly WalletPortfolio[] {
    return this.substrate.queryPortfoliosDsl(query);
  }

  bulkPurge(addresses: readonly string[]): WalletBulkMutationResult {
    return this.substrate.bulkPurgePortfolios(addresses);
  }

  undo(): boolean {
    return this.substrate.undo();
  }

  redo(): boolean {
    return this.substrate.redo();
  }

  exportHtml(): string {
    return this.substrate.exportInteractiveHtmlView();
  }

  exportMarkdown(): string {
    return this.substrate.exportMarkdownReport();
  }

  exportCsv(): string {
    return this.substrate.exportCsvReport();
  }

  getSubstrate(): BroccoliWalletSubstrate {
    return this.substrate;
  }

  getEngine(): DeterministicWalletEngine {
    return this.engine;
  }
}
