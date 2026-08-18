/**
 * broccoli-wallet-substrate.ts
 *
 * In-memory zero-GC Broccolidb repository for tracked wallet portfolios, token price caches,
 * allowance security audits, swap quotes, cross-chain bridge quotes, ERC-4337 UserOps,
 * DeFi health positions, yield staking ledgers, and multi-sig stages (Phase 91/93 / ADR-123 / ADR-043).
 */

import type {
  AccountAbstractionSimulationResult,
  AddressBookContact,
  BridgeQuoteResult,
  DeFiPosition,
  IBroccoliWalletSubstrate,
  MultiSigTransactionStage,
  SwapQuoteResult,
  TokenAllowanceRecord,
  TokenAllowanceRow,
  TransactionSimulationResult,
  WalletAuditRow,
  WalletBulkMutationResult,
  WalletDslQueryFilter,
  WalletGroupBy,
  WalletGroupedLane,
  WalletHealthAuditReport,
  WalletHealthStatus,
  WalletMetricsReport,
  WalletMutationUndoRecord,
  WalletPortfolio,
  WalletPortfolioRow,
  WalletSimulationRow,
  WalletSkillConfig,
  WalletSortBy,
  WalletSortDirection,
  WalletSubstrateSnapshot,
  YieldStakingPosition,
} from "../../../core/contracts/wallet.contracts.js";
import type { IBroccoliDatabaseKernel, IDbTable } from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliWalletSubstrate implements IBroccoliWalletSubstrate {
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
  private auditLogs: WalletAuditRow[] = [];
  private config: WalletSkillConfig;

  private readonly undoStack: WalletMutationUndoRecord[] = [];
  private readonly redoStack: WalletMutationUndoRecord[] = [];
  private static readonly MAX_UNDO_STACK = 50;

  // BroccoliDB Hybrid Persistence Tables
  private readonly dbKernel?: IBroccoliDatabaseKernel;
  private portfoliosTable?: IDbTable<WalletPortfolioRow>;
  private allowancesTable?: IDbTable<TokenAllowanceRow>;
  private simulationsTable?: IDbTable<WalletSimulationRow>;
  private auditsTable?: IDbTable<WalletAuditRow>;

  constructor(initialConfig?: Partial<WalletSkillConfig>, dbKernel?: IBroccoliDatabaseKernel) {
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

    if (dbKernel) {
      this.dbKernel = dbKernel;
      this.portfoliosTable = dbKernel.getTable<WalletPortfolioRow>("wallet_portfolios");
      this.allowancesTable = dbKernel.getTable<TokenAllowanceRow>("wallet_allowances");
      this.simulationsTable = dbKernel.getTable<WalletSimulationRow>("wallet_simulations");
      this.auditsTable = dbKernel.getTable<WalletAuditRow>("wallet_audits");
    }
  }

  // ---------------------------------------------------------------------------
  // Mutation Snapshot & Undo/Redo Engine
  // ---------------------------------------------------------------------------

  private pushUndoRecord(mutationType: WalletMutationUndoRecord["mutationType"], prev: WalletSubstrateSnapshot): void {
    this.undoStack.push({
      mutationType,
      previousSnapshot: prev,
      nextSnapshot: this.exportSnapshot(),
      timestampMs: Date.now(),
    });
    if (this.undoStack.length > BroccoliWalletSubstrate.MAX_UNDO_STACK) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  public undo(): boolean {
    const record = this.undoStack.pop();
    if (!record) return false;

    this.redoStack.push({
      mutationType: record.mutationType,
      previousSnapshot: this.exportSnapshot(),
      nextSnapshot: record.previousSnapshot,
      timestampMs: Date.now(),
    });

    this.importSnapshot(record.previousSnapshot);
    this.recordAudit("system", "undo", "system", `Reverted ${record.mutationType}`);
    return true;
  }

  public redo(): boolean {
    const record = this.redoStack.pop();
    if (!record) return false;

    this.undoStack.push({
      mutationType: record.mutationType,
      previousSnapshot: this.exportSnapshot(),
      nextSnapshot: record.nextSnapshot,
      timestampMs: Date.now(),
    });

    this.importSnapshot(record.nextSnapshot);
    this.recordAudit("system", "redo", "system", `Reapplied ${record.mutationType}`);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Configuration & Portfolios
  // ---------------------------------------------------------------------------

  getConfig(): WalletSkillConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<WalletSkillConfig>): WalletSkillConfig {
    const prev = this.exportSnapshot();
    this.config = {
      ...this.config,
      ...updates,
    };
    this.pushUndoRecord("update_config", prev);
    this.recordAudit("config", "update_config", "system", "Updated wallet skill config");
    return this.getConfig();
  }

  storePortfolio(portfolio: WalletPortfolio): void {
    const prev = this.exportSnapshot();
    const key = `${portfolio.chain}:${portfolio.address.toLowerCase()}`;
    this.portfolios.set(key, portfolio);

    if (this.portfoliosTable) {
      this.portfoliosTable.put(key, {
        id: key,
        address: portfolio.address,
        chain: portfolio.chain,
        totalPortfolioValueUsd: portfolio.totalPortfolioValueUsd,
        nativeBalanceUsd: portfolio.nativeBalanceUsd,
        tokenCount: portfolio.tokens.length,
        lastUpdated: portfolio.lastUpdated,
      });
    }

    this.pushUndoRecord("store_portfolio", prev);
    this.recordAudit(portfolio.address, "store_portfolio", "wallet_engine", `Updated ${portfolio.chain} portfolio ($${portfolio.totalPortfolioValueUsd.toFixed(2)})`);
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
    if (this.allowancesTable) {
      this.allowancesTable.put(record.id, {
        id: record.id,
        walletAddress: record.walletAddress,
        chain: record.chain,
        tokenSymbol: record.tokenSymbol,
        spenderAddress: record.spenderAddress,
        riskTier: record.riskTier,
        updatedAt: record.updatedAt,
      });
    }
  }

  getAllowances(walletAddress: string): readonly TokenAllowanceRecord[] {
    const target = walletAddress.toLowerCase();
    return Array.from(this.allowances.values()).filter(
      (a) => a.walletAddress.toLowerCase() === target
    );
  }

  storeSimulation(sim: TransactionSimulationResult): void {
    this.simulations.set(sim.simulationId, sim);
    if (this.simulationsTable) {
      this.simulationsTable.put(sim.simulationId, {
        id: sim.simulationId,
        simulationId: sim.simulationId,
        chain: sim.chain,
        success: sim.success,
        riskTier: sim.riskTier,
        netValueChangeUsd: sim.netValueChangeUsd,
        simulatedAt: sim.simulatedAt,
      });
    }
  }

  getSimulation(id: string): TransactionSimulationResult | undefined {
    return this.simulations.get(id);
  }

  listSimulations(limit = 20): readonly TransactionSimulationResult[] {
    return Array.from(this.simulations.values()).slice(-limit);
  }

  storeSwapQuote(quote: SwapQuoteResult): void {
    this.swapQuotes.set(quote.quoteId, quote);
  }

  getSwapQuote(id: string): SwapQuoteResult | undefined {
    return this.swapQuotes.get(id);
  }

  storeDeFiPosition(pos: DeFiPosition): void {
    const key = `${pos.chain}:${pos.protocol}:${pos.userAddress.toLowerCase()}`;
    this.defiPositions.set(key, pos);
  }

  listDeFiPositions(userAddress?: string): readonly DeFiPosition[] {
    if (!userAddress) {
      return Array.from(this.defiPositions.values());
    }
    const target = userAddress.toLowerCase();
    return Array.from(this.defiPositions.values()).filter(
      (p) => p.userAddress.toLowerCase() === target
    );
  }

  storeContact(contact: AddressBookContact): void {
    const key = `${contact.chain}:${contact.address.toLowerCase()}`;
    this.contacts.set(key, contact);
  }

  getContact(address: string, chain?: string): AddressBookContact | undefined {
    if (chain) {
      const key = `${chain}:${address.toLowerCase()}`;
      return this.contacts.get(key);
    }
    const target = address.toLowerCase();
    return Array.from(this.contacts.values()).find(
      (c) => c.address.toLowerCase() === target
    );
  }

  listContacts(): readonly AddressBookContact[] {
    return Array.from(this.contacts.values());
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

  getUserOp(userOpHash: string): AccountAbstractionSimulationResult | undefined {
    return this.userOps.get(userOpHash);
  }

  storeYieldPosition(pos: YieldStakingPosition): void {
    const key = `${pos.chain}:${pos.protocol}:${pos.assetSymbol}`;
    this.yieldPositions.set(key, pos);
  }

  listYieldPositions(): readonly YieldStakingPosition[] {
    return Array.from(this.yieldPositions.values());
  }

  storeMultiSigStage(stage: MultiSigTransactionStage): void {
    this.multiSigStages.set(stage.safeTxHash, stage);
  }

  getMultiSigStage(safeTxHash: string): MultiSigTransactionStage | undefined {
    return this.multiSigStages.get(safeTxHash);
  }

  listMultiSigStages(): readonly MultiSigTransactionStage[] {
    return Array.from(this.multiSigStages.values());
  }

  // ---------------------------------------------------------------------------
  // SLA Health & Metrics Telemetry
  // ---------------------------------------------------------------------------

  public auditHealth(): WalletHealthAuditReport {
    const portList = Array.from(this.portfolios.values());
    const totalPortfolios = portList.length;
    const totalPortfolioValueUsd = portList.reduce((acc, p) => acc + p.totalPortfolioValueUsd, 0);

    const allowList = Array.from(this.allowances.values());
    const totalAllowances = allowList.length;
    const criticalAllowances = allowList.filter((a) => a.riskTier === "CRITICAL_REVOKE_RECOMMENDED");

    const simList = Array.from(this.simulations.values());
    const totalSimulations = simList.length;
    const successfulSims = simList.filter((s) => s.success).length;
    const simulationSuccessRate = totalSimulations > 0 ? Number(((successfulSims / totalSimulations) * 100).toFixed(1)) : 100;

    let healthStatus: WalletHealthStatus = "optimal";
    const recommendations: string[] = [];

    if (criticalAllowances.length > 0) {
      healthStatus = "critical_risk";
      recommendations.push(`Detected ${criticalAllowances.length} critical unverified token approvals. Prompt immediate revocation.`);
    } else if (totalPortfolios > 0) {
      healthStatus = "healthy";
    }

    if (recommendations.length === 0) {
      recommendations.push("Wallet security posture and allowance exposures are within optimal bounds.");
    }

    return {
      totalPortfolios,
      totalPortfolioValueUsd,
      totalAllowances,
      criticalAllowancesCount: criticalAllowances.length,
      totalSimulations,
      simulationSuccessRate,
      healthStatus,
      recommendations,
    };
  }

  public getMetrics(): WalletMetricsReport {
    const portList = Array.from(this.portfolios.values());
    const totalPortfolioValueUsd = portList.reduce((acc, p) => acc + p.totalPortfolioValueUsd, 0);

    const chainDist: Record<string, number> = {};
    const valuesList: number[] = [];

    for (const p of portList) {
      chainDist[p.chain] = (chainDist[p.chain] || 0) + 1;
      valuesList.push(p.totalPortfolioValueUsd);
    }

    valuesList.sort((a, b) => a - b);
    const p50 = valuesList.length > 0 ? valuesList[Math.floor(valuesList.length * 0.5)] : 0;
    const p95 = valuesList.length > 0 ? valuesList[Math.floor(valuesList.length * 0.95)] : 0;

    return {
      totalTrackedWallets: portList.length,
      totalPortfolioValueUsd,
      chainDistribution: chainDist,
      totalSimulations: this.simulations.size,
      totalQuotes: this.swapQuotes.size,
      totalBridgeQuotes: this.bridgeQuotes.size,
      totalDeFiPositions: this.defiPositions.size,
      totalUserOps: this.userOps.size,
      totalYieldPositions: this.yieldPositions.size,
      totalMultiSigStages: this.multiSigStages.size,
      p50PortfolioValueUsd: p50,
      p95PortfolioValueUsd: p95,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Criteria Grouping & Swimlanes
  // ---------------------------------------------------------------------------

  public getGroupedPortfolios(
    groupBy: WalletGroupBy = "chain",
    sortBy: WalletSortBy = "value",
    direction: WalletSortDirection = "desc"
  ): readonly WalletGroupedLane[] {
    const lanes = new Map<string, WalletPortfolio[]>();

    for (const p of this.portfolios.values()) {
      let key: string = p.chain;
      switch (groupBy) {
        case "chain":
          key = p.chain;
          break;
        case "valueTier":
          key = p.totalPortfolioValueUsd > 10000 ? "whale (>$10k)" : (p.totalPortfolioValueUsd > 1000 ? "mid ($1k-$10k)" : "standard (<$1k)");
          break;
        case "riskTier": {
          const userAllowances = this.getAllowances(p.address);
          const hasCrit = userAllowances.some((a) => a.riskTier === "CRITICAL_REVOKE_RECOMMENDED");
          const hasCaut = userAllowances.some((a) => a.riskTier === "CAUTION");
          key = hasCrit ? "CRITICAL_RISK" : (hasCaut ? "CAUTION" : "SAFE");
          break;
        }
      }

      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key)!.push(p);
    }

    const result: WalletGroupedLane[] = [];
    for (const [key, items] of lanes.entries()) {
      items.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "value") cmp = a.totalPortfolioValueUsd - b.totalPortfolioValueUsd;
        else if (sortBy === "chain") cmp = a.chain.localeCompare(b.chain);
        else if (sortBy === "lastUpdated") cmp = a.lastUpdated - b.lastUpdated;
        return direction === "asc" ? cmp : -cmp;
      });

      const totalVal = items.reduce((sum, i) => sum + i.totalPortfolioValueUsd, 0);

      result.push({
        key,
        title: key.toUpperCase(),
        count: items.length,
        totalValueUsd: totalVal,
        portfolios: items,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Natural Query DSL Search Engine
  // ---------------------------------------------------------------------------

  public queryPortfoliosDsl(query: WalletDslQueryFilter | string): readonly WalletPortfolio[] {
    const parsed: WalletDslQueryFilter = typeof query === "string" ? this.parseDslQuery(query) : query;

    return Array.from(this.portfolios.values()).filter((p) => {
      if (parsed.chain && p.chain !== parsed.chain) return false;
      if (parsed.minValueUsd !== undefined && p.totalPortfolioValueUsd < parsed.minValueUsd) return false;
      if (parsed.maxValueUsd !== undefined && p.totalPortfolioValueUsd > parsed.maxValueUsd) return false;

      if (parsed.riskTier) {
        const userAllowances = this.getAllowances(p.address);
        const hasCrit = userAllowances.some((a) => a.riskTier === "CRITICAL_REVOKE_RECOMMENDED");
        const hasCaut = userAllowances.some((a) => a.riskTier === "CAUTION");
        const risk: "SAFE" | "CAUTION" | "CRITICAL_REVOKE_RECOMMENDED" = hasCrit ? "CRITICAL_REVOKE_RECOMMENDED" : (hasCaut ? "CAUTION" : "SAFE");
        if (risk !== parsed.riskTier) return false;
      }

      if (parsed.textTerms && parsed.textTerms.length > 0) {
        const text = `${p.address} ${p.ensName || ""} ${p.chain} ${p.tokens.map((t) => t.symbol).join(" ")}`.toLowerCase();
        if (!parsed.textTerms.every((term) => text.includes(term.toLowerCase()))) return false;
      }

      return true;
    });
  }

  private parseDslQuery(raw: string): WalletDslQueryFilter {
    const tokens = raw.trim().split(/\s+/);
    const textTerms: string[] = [];
    let chain: any;
    let minValueUsd: number | undefined;
    let maxValueUsd: number | undefined;
    let riskTier: any;

    for (const tok of tokens) {
      if (tok.startsWith("chain:")) {
        chain = tok.slice(6);
      } else if (tok.startsWith("min_balance>") || tok.startsWith("min_val>")) {
        minValueUsd = Number(tok.split(">")[1]);
      } else if (tok.startsWith("max_val<")) {
        maxValueUsd = Number(tok.split("<")[1]);
      } else if (tok.startsWith("risk:")) {
        riskTier = tok.slice(5).toUpperCase();
      } else if (tok.length > 0) {
        textTerms.push(tok);
      }
    }

    return {
      rawQuery: raw,
      chain,
      minValueUsd,
      maxValueUsd,
      riskTier,
      textTerms: textTerms.length > 0 ? textTerms : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Bulk Mutations
  // ---------------------------------------------------------------------------

  public bulkPurgePortfolios(addresses: readonly string[]): WalletBulkMutationResult {
    const prev = this.exportSnapshot();
    const affected: string[] = [];

    for (const addr of addresses) {
      const target = addr.toLowerCase();
      for (const [key, p] of this.portfolios.entries()) {
        if (p.address.toLowerCase() === target) {
          this.portfolios.delete(key);
          affected.push(key);
        }
      }
    }

    this.pushUndoRecord("bulk", prev);
    return {
      matchedCount: addresses.length,
      modifiedCount: affected.length,
      affectedAddresses: affected,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Format Exporters
  // ---------------------------------------------------------------------------

  public exportInteractiveHtmlView(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LUMI Autonomous Agent Wallet & DeFi Subsystem</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h1 { color: #38bdf8; font-size: 24px; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .metric-val { font-size: 28px; font-weight: bold; color: #38bdf8; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #334155; }
    th { background: #1e293b; color: #94a3b8; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; background: #0284c7; color: #bae6fd; }
  </style>
</head>
<body>
  <h1>👛 LUMI Autonomous Agent Wallet & DeFi Subsystem</h1>
  <p style="color: #94a3b8;">Multi-Chain Portfolio, Blowfish-Grade Simulations & Safe Staging (Phase 91/93 / ADR-123)</p>
  
  <div class="grid">
    <div class="card"><div>Tracked Wallets</div><div class="metric-val">${metrics.totalTrackedWallets}</div></div>
    <div class="card"><div>Portfolio Value</div><div class="metric-val" style="color:#10b981;">$${metrics.totalPortfolioValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
    <div class="card"><div>Simulations Run</div><div class="metric-val" style="color:#f59e0b;">${metrics.totalSimulations}</div></div>
    <div class="card"><div>Security Posture</div><div class="metric-val" style="color:${health.healthStatus === 'critical_risk' ? '#ef4444' : '#22c55e'};">${health.healthStatus.toUpperCase()}</div></div>
  </div>

  <h2>Active Portfolios</h2>
  <table>
    <thead>
      <tr>
        <th>Address</th>
        <th>Chain</th>
        <th>Native Balance</th>
        <th>Total Value USD</th>
        <th>Tokens</th>
      </tr>
    </thead>
    <tbody>
      ${Array.from(this.portfolios.values()).slice(0, 25).map((p) => `
        <tr>
          <td><code>${p.address}</code> ${p.ensName ? `(${p.ensName})` : ''}</td>
          <td><span class="badge">${p.chain.toUpperCase()}</span></td>
          <td>${p.nativeBalance} ${p.nativeSymbol}</td>
          <td><strong>$${p.totalPortfolioValueUsd.toFixed(2)}</strong></td>
          <td>${p.tokens.length} assets</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
</body>
</html>`;
  }

  public exportMarkdownReport(): string {
    const metrics = this.getMetrics();
    const health = this.auditHealth();

    let md = `# LUMI Agent Wallet & DeFi Subsystem Diagnostic Report\n\n`;
    md += `**Health Status:** \`${health.healthStatus.toUpperCase()}\` | **Total Value:** \`$${metrics.totalPortfolioValueUsd.toFixed(2)}\` | **Tracked Wallets:** \`${metrics.totalTrackedWallets}\`\n\n`;
    md += `## Metrics Summary\n`;
    md += `- **Tracked Wallets:** ${metrics.totalTrackedWallets}\n`;
    md += `- **Simulations Executed:** ${metrics.totalSimulations}\n`;
    md += `- **Active Allowances:** ${this.allowances.size}\n`;
    md += `- **DeFi Positions:** ${this.defiPositions.size}\n`;
    md += `- **Yield Staking Positions:** ${this.yieldPositions.size}\n`;
    md += `- **p95 Portfolio Value:** $${metrics.p95PortfolioValueUsd.toFixed(2)}\n\n`;

    md += `## Portfolios\n\n`;
    md += `| Address | Chain | Value (USD) | Tokens |\n`;
    md += `|---|---|---|---|\n`;
    for (const p of Array.from(this.portfolios.values()).slice(0, 20)) {
      md += `| \`${p.address}\` | ${p.chain} | **$${p.totalPortfolioValueUsd.toFixed(2)}** | ${p.tokens.length} |\n`;
    }

    return md;
  }

  public exportCsvReport(): string {
    const header = "address,chain,ensName,nativeBalance,nativeSymbol,totalPortfolioValueUsd,tokenCount,lastUpdated\n";
    const rows = Array.from(this.portfolios.values()).map((p) => {
      return `"${p.address}","${p.chain}","${p.ensName || ""}",${p.nativeBalance},"${p.nativeSymbol}",${p.totalPortfolioValueUsd},${p.tokens.length},${p.lastUpdated}`;
    }).join("\n");
    return header + rows;
  }

  // ---------------------------------------------------------------------------
  // Snapshots & Audits
  // ---------------------------------------------------------------------------

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
      config: this.getConfig(),
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: WalletSubstrateSnapshot): void {
    this.portfolios.clear();
    for (const p of snapshot.portfolios) {
      this.portfolios.set(`${p.chain}:${p.address.toLowerCase()}`, p);
    }

    this.allowances.clear();
    for (const a of snapshot.allowances) {
      this.allowances.set(a.id, a);
    }

    this.simulations.clear();
    for (const s of snapshot.simulations) {
      this.simulations.set(s.simulationId, s);
    }

    this.swapQuotes.clear();
    for (const q of snapshot.swapQuotes) {
      this.swapQuotes.set(q.quoteId, q);
    }

    this.defiPositions.clear();
    for (const d of snapshot.defiPositions) {
      this.defiPositions.set(`${d.chain}:${d.protocol}:${d.userAddress.toLowerCase()}`, d);
    }

    this.contacts.clear();
    for (const c of snapshot.contacts) {
      this.contacts.set(`${c.chain}:${c.address.toLowerCase()}`, c);
    }

    this.bridgeQuotes.clear();
    for (const b of snapshot.bridgeQuotes) {
      this.bridgeQuotes.set(b.bridgeQuoteId, b);
    }

    this.userOps.clear();
    for (const u of snapshot.userOps) {
      this.userOps.set(u.userOpHash, u);
    }

    this.yieldPositions.clear();
    for (const y of snapshot.yieldPositions) {
      this.yieldPositions.set(`${y.chain}:${y.protocol}:${y.assetSymbol}`, y);
    }

    this.multiSigStages.clear();
    for (const m of snapshot.multiSigStages) {
      this.multiSigStages.set(m.safeTxHash, m);
    }

    this.config = { ...snapshot.config };
  }

  public recordAudit(address: string, action: string, operator: string, details: string): void {
    const row: WalletAuditRow = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action: `${action}:${address}`,
      operator,
      details,
      timestamp: Date.now(),
    };
    this.auditLogs.unshift(row);
    if (this.auditLogs.length > 500) this.auditLogs.pop();
    if (this.auditsTable) {
      this.auditsTable.put(row.id, row);
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
    this.auditLogs.length = 0;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
