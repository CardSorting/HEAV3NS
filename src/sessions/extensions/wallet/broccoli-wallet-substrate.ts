/**
 * broccoli-wallet-substrate.ts
 *
 * In-memory Broccolidb repository for tracked wallet portfolios, token price caches,
 * allowance security audits, swap quotes, cross-chain bridge quotes, ERC-4337 UserOps,
 * DeFi health positions, yield staking ledgers, and multi-sig stages (Phase 93 / ADR-123).
 */

import type {
  AccountAbstractionSimulationResult,
  AddressBookContact,
  BridgeQuoteResult,
  DeFiPosition,
  MultiSigTransactionStage,
  SwapQuoteResult,
  TokenAllowanceRecord,
  TransactionSimulationResult,
  WalletPortfolio,
  WalletSkillConfig,
  WalletSubstrateSnapshot,
  YieldStakingPosition,
} from "../../../core/contracts/wallet.contracts.js";

export class BroccoliWalletSubstrate {
  private portfolios: Map<string, WalletPortfolio>;
  private allowances: Map<string, TokenAllowanceRecord>;
  private simulations: Map<string, TransactionSimulationResult>;
  private swapQuotes: Map<string, SwapQuoteResult>;
  private defiPositions: Map<string, DeFiPosition>;
  private contacts: Map<string, AddressBookContact>;
  private bridgeQuotes: Map<string, BridgeQuoteResult>;
  private userOps: Map<string, AccountAbstractionSimulationResult>;
  private yieldPositions: Map<string, YieldStakingPosition>;
  private multiSigStages: Map<string, MultiSigTransactionStage>;
  private config: WalletSkillConfig;

  constructor(initialConfig?: Partial<WalletSkillConfig>) {
    this.portfolios = new Map();
    this.allowances = new Map();
    this.simulations = new Map();
    this.swapQuotes = new Map();
    this.defiPositions = new Map();
    this.contacts = new Map();
    this.bridgeQuotes = new Map();
    this.userOps = new Map();
    this.yieldPositions = new Map();
    this.multiSigStages = new Map();
    this.config = {
      enabled: false,
      allowedChains: ["ethereum", "base", "solana", "arbitrum", "optimism", "polygon"],
      maxDailyTransferLimitUsd: 50.0,
      requireSimulationBeforeAction: true,
      allowUnverifiedContracts: false,
      maxSlippagePercent: 0.5,
      enableMevProtection: true,
      allowCrossChainBridging: true,
      enableAccountAbstractionPaymaster: true,
      ...initialConfig,
    };
  }

  getConfig(): WalletSkillConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<WalletSkillConfig>): WalletSkillConfig {
    this.config = {
      ...this.config,
      ...updates,
    };
    return this.getConfig();
  }

  storePortfolio(portfolio: WalletPortfolio): void {
    const key = `${portfolio.chain}:${portfolio.address.toLowerCase()}`;
    this.portfolios.set(key, portfolio);
  }

  getPortfolio(address: string, chain: string): WalletPortfolio | undefined {
    const key = `${chain}:${address.toLowerCase()}`;
    return this.portfolios.get(key);
  }

  listPortfolios(): readonly WalletPortfolio[] {
    return Array.from(this.portfolios.values());
  }

  storeAllowance(record: TokenAllowanceRecord): void {
    this.allowances.set(record.id, record);
  }

  getAllowances(walletAddress: string): readonly TokenAllowanceRecord[] {
    const target = walletAddress.toLowerCase();
    return Array.from(this.allowances.values()).filter(
      (a) => a.walletAddress.toLowerCase() === target
    );
  }

  storeSimulation(sim: TransactionSimulationResult): void {
    this.simulations.set(sim.simulationId, sim);
  }

  getSimulation(id: string): TransactionSimulationResult | undefined {
    return this.simulations.get(id);
  }

  storeSwapQuote(quote: SwapQuoteResult): void {
    this.swapQuotes.set(quote.quoteId, quote);
  }

  getSwapQuote(id: string): SwapQuoteResult | undefined {
    return this.swapQuotes.get(id);
  }

  storeDeFiPosition(pos: DeFiPosition): void {
    const key = `${pos.protocol}:${pos.chain}:${pos.userAddress.toLowerCase()}`;
    this.defiPositions.set(key, pos);
  }

  getDeFiPositions(userAddress: string): readonly DeFiPosition[] {
    const target = userAddress.toLowerCase();
    return Array.from(this.defiPositions.values()).filter(
      (p) => p.userAddress.toLowerCase() === target
    );
  }

  storeContact(contact: AddressBookContact): void {
    const key = `${contact.chain}:${contact.address.toLowerCase()}`;
    this.contacts.set(key, contact);
  }

  getContact(address: string, chain: string): AddressBookContact | undefined {
    const key = `${chain}:${address.toLowerCase()}`;
    return this.contacts.get(key);
  }

  listContacts(): readonly AddressBookContact[] {
    return Array.from(this.contacts.values());
  }

  deleteContact(address: string, chain: string): boolean {
    const key = `${chain}:${address.toLowerCase()}`;
    return this.contacts.delete(key);
  }

  storeBridgeQuote(quote: BridgeQuoteResult): void {
    this.bridgeQuotes.set(quote.bridgeQuoteId, quote);
  }

  getBridgeQuote(id: string): BridgeQuoteResult | undefined {
    return this.bridgeQuotes.get(id);
  }

  storeUserOp(userOp: AccountAbstractionSimulationResult): void {
    this.userOps.set(userOp.userOpHash, userOp);
  }

  getUserOp(hash: string): AccountAbstractionSimulationResult | undefined {
    return this.userOps.get(hash);
  }

  storeYieldPosition(pos: YieldStakingPosition): void {
    const key = `${pos.protocol}:${pos.chain}:${pos.assetSymbol}`;
    this.yieldPositions.set(key, pos);
  }

  listYieldPositions(): readonly YieldStakingPosition[] {
    return Array.from(this.yieldPositions.values());
  }

  storeMultiSigStage(stage: MultiSigTransactionStage): void {
    this.multiSigStages.set(stage.safeTxHash, stage);
  }

  getMultiSigStage(hash: string): MultiSigTransactionStage | undefined {
    return this.multiSigStages.get(hash);
  }

  listMultiSigStages(): readonly MultiSigTransactionStage[] {
    return Array.from(this.multiSigStages.values());
  }

  exportSnapshot(): WalletSubstrateSnapshot {
    return {
      portfolios: Array.from(this.portfolios.values()),
      allowances: Array.from(this.allowances.values()),
      simulations: Array.from(this.simulations.values()),
      swapQuotes: Array.from(this.swapQuotes.values()),
      defiPositions: Array.from(this.defiPositions.values()),
      contacts: Array.from(this.contacts.values()),
      bridgeQuotes: Array.from(this.bridgeQuotes.values()),
      userOps: Array.from(this.userOps.values()),
      yieldPositions: Array.from(this.yieldPositions.values()),
      multiSigStages: Array.from(this.multiSigStages.values()),
      totalTrackedWallets: this.portfolios.size,
      totalAllowanceRecords: this.allowances.size,
      totalSimulations: this.simulations.size,
      totalContacts: this.contacts.size,
      totalBridgeQuotes: this.bridgeQuotes.size,
      totalUserOps: this.userOps.size,
      config: { ...this.config },
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: WalletSubstrateSnapshot): void {
    this.config = { ...snapshot.config };
    this.portfolios = new Map();
    for (const p of snapshot.portfolios || []) {
      const key = `${p.chain}:${p.address.toLowerCase()}`;
      this.portfolios.set(key, p);
    }
    this.allowances = new Map();
    for (const a of snapshot.allowances || []) {
      this.allowances.set(a.id, a);
    }
    this.simulations = new Map();
    for (const s of snapshot.simulations || []) {
      this.simulations.set(s.simulationId, s);
    }
    this.swapQuotes = new Map();
    for (const q of snapshot.swapQuotes || []) {
      this.swapQuotes.set(q.quoteId, q);
    }
    this.defiPositions = new Map();
    for (const d of snapshot.defiPositions || []) {
      const key = `${d.protocol}:${d.chain}:${d.userAddress.toLowerCase()}`;
      this.defiPositions.set(key, d);
    }
    this.contacts = new Map();
    for (const c of snapshot.contacts || []) {
      const key = `${c.chain}:${c.address.toLowerCase()}`;
      this.contacts.set(key, c);
    }
    this.bridgeQuotes = new Map();
    for (const b of snapshot.bridgeQuotes || []) {
      this.bridgeQuotes.set(b.bridgeQuoteId, b);
    }
    this.userOps = new Map();
    for (const u of snapshot.userOps || []) {
      this.userOps.set(u.userOpHash, u);
    }
    this.yieldPositions = new Map();
    for (const y of snapshot.yieldPositions || []) {
      const key = `${y.protocol}:${y.chain}:${y.assetSymbol}`;
      this.yieldPositions.set(key, y);
    }
    this.multiSigStages = new Map();
    for (const m of snapshot.multiSigStages || []) {
      this.multiSigStages.set(m.safeTxHash, m);
    }
  }

  clear(): void {
    this.portfolios.clear();
    this.allowances.clear();
    this.simulations.clear();
    this.swapQuotes.clear();
    this.defiPositions.clear();
    this.contacts.clear();
    this.bridgeQuotes.clear();
    this.userOps.clear();
    this.yieldPositions.clear();
    this.multiSigStages.clear();
  }
}
