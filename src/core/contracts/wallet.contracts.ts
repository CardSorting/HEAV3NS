/**
 * wallet.contracts.ts
 *
 * Core data contracts for the Deterministic Native Wallet Subsystem (Phase 93 / ADR-123).
 * Absorbed from ancestral Hermes Agent blockchain skills and elevated with Rainbow/Phantom/Blowfish-grade
 * transaction simulation, 1inch/Jupiter swap routing, DeFi health factor scoring, EIP-712 permit inspection,
 * Across/LiFi cross-chain bridging, ERC-4337 Account Abstraction paymaster simulation, automated yield staking,
 * Gnosis Safe multi-sig staging, and fail-closed opt-in gating.
 */

export type SupportedChain =
  | "ethereum"
  | "base"
  | "solana"
  | "polygon"
  | "arbitrum"
  | "optimism"
  | "avalanche"
  | "zksync";

export type SecurityRiskTier = "SAFE" | "CAUTION" | "CRITICAL_REVOKE_RECOMMENDED";

export interface WalletSkillConfig {
  readonly enabled: boolean;
  readonly allowedChains: readonly SupportedChain[];
  readonly maxDailyTransferLimitUsd: number;
  readonly requireSimulationBeforeAction: boolean;
  readonly allowUnverifiedContracts: boolean;
  readonly maxSlippagePercent: number; // e.g. 0.5%
  readonly enableMevProtection: boolean;
  readonly allowCrossChainBridging: boolean;
  readonly enableAccountAbstractionPaymaster: boolean;
  readonly customRpcEndpoints?: Readonly<Record<string, string>>;
}

export interface TokenHolding {
  readonly symbol: string;
  readonly name: string;
  readonly contractAddress: string;
  readonly balance: number;
  readonly balanceRaw: string;
  readonly decimals: number;
  readonly priceUsd: number;
  readonly totalValueUsd: number;
  readonly chain: SupportedChain;
  readonly verified: boolean;
}

export interface WalletPortfolio {
  readonly address: string;
  readonly chain: SupportedChain;
  readonly ensName?: string;
  readonly nativeBalance: number;
  readonly nativeBalanceUsd: number;
  readonly nativeSymbol: string;
  readonly tokens: readonly TokenHolding[];
  readonly totalPortfolioValueUsd: number;
  readonly lastUpdated: number;
  readonly formattedSummaryCard: string;
}

export interface TokenAllowanceRecord {
  readonly id: string;
  readonly walletAddress: string;
  readonly chain: SupportedChain;
  readonly tokenSymbol: string;
  readonly tokenAddress: string;
  readonly spenderAddress: string;
  readonly spenderName?: string;
  readonly allowanceAmount: string;
  readonly allowanceUsdEstimate?: number;
  readonly isUnlimited: boolean;
  readonly riskTier: SecurityRiskTier;
  readonly riskReason?: string;
  readonly updatedAt: number;
}

export interface AssetDelta {
  readonly asset: string;
  readonly delta: number;
  readonly deltaUsd: number;
  readonly direction: "IN" | "OUT" | "NEUTRAL";
}

export interface TransactionSimulationRequest {
  readonly chain: SupportedChain;
  readonly fromAddress: string;
  readonly toAddress: string;
  readonly valueNative?: number;
  readonly tokenTransfers?: readonly {
    readonly tokenAddress: string;
    readonly symbol: string;
    readonly amount: number;
  }[];
  readonly calldata?: string;
  readonly customGasPriceGwei?: number;
  readonly targetContractName?: string;
}

export interface TransactionSimulationResult {
  readonly simulationId: string;
  readonly success: boolean;
  readonly chain: SupportedChain;
  readonly fromAddress: string;
  readonly toAddress: string;
  readonly toAddressVerified: boolean;
  readonly estimatedGasGwei: number;
  readonly estimatedGasCostUsd: number;
  readonly assetDeltas: readonly AssetDelta[];
  readonly netValueChangeUsd: number;
  readonly riskTier: SecurityRiskTier;
  readonly warnings: readonly string[];
  readonly humanReadablePreview: string;
  readonly simulatedAt: number;
  readonly error?: string;
}

export interface ContractInspectionResult {
  readonly address: string;
  readonly chain: SupportedChain;
  readonly isContract: boolean;
  readonly contractName?: string;
  readonly isProxy: boolean;
  readonly implementationAddress?: string;
  readonly isVerified: boolean;
  readonly standards: readonly ("ERC-20" | "ERC-721" | "ERC-1155" | "SPL-Token" | "Proxy")[];
  readonly riskTier: SecurityRiskTier;
  readonly riskFlags: readonly string[];
  readonly summaryCard: string;
}

// ---------------------------------------------------------------------------
// Beyond the Fold: DEX Aggregation & Swap Routing Previews
// ---------------------------------------------------------------------------

export interface SwapRouteHop {
  readonly protocol: "UniswapV3" | "UniswapV2" | "Curve" | "Aerodrome" | "Raydium" | "Orca";
  readonly fromToken: string;
  readonly toToken: string;
  readonly feeTier?: string;
  readonly poolAddress?: string;
  readonly percentSplit: number;
}

export interface SwapQuoteRequest {
  readonly chain: SupportedChain;
  readonly fromTokenAddress: string;
  readonly fromTokenSymbol: string;
  readonly toTokenAddress: string;
  readonly toTokenSymbol: string;
  readonly amountIn: number;
  readonly slippageTolerancePercent?: number;
  readonly recipientAddress?: string;
}

export interface SwapQuoteResult {
  readonly quoteId: string;
  readonly chain: SupportedChain;
  readonly fromTokenSymbol: string;
  readonly toTokenSymbol: string;
  readonly amountIn: number;
  readonly estimatedAmountOut: number;
  readonly minimumAmountOut: number;
  readonly priceImpactPercent: number;
  readonly effectiveRate: number;
  readonly routeHops: readonly SwapRouteHop[];
  readonly estimatedGasCostUsd: number;
  readonly mevProtectionActive: boolean;
  readonly formattedRoutePreview: string;
  readonly validUntilMs: number;
}

// ---------------------------------------------------------------------------
// Beyond the Fold: DeFi Health Factor & Position Diagnostics
// ---------------------------------------------------------------------------

export interface DeFiPosition {
  readonly protocol: "AaveV3" | "Morpho" | "CompoundV3" | "MakerDAO" | "Kamino";
  readonly chain: SupportedChain;
  readonly userAddress: string;
  readonly suppliedCollateralUsd: number;
  readonly borrowedDebtUsd: number;
  readonly netWorthUsd: number;
  readonly currentLtvPercent: number;
  readonly maxLtvPercent: number;
  readonly liquidationThresholdPercent: number;
  readonly healthFactor: number;
  readonly liquidationRiskTier: "SAFE" | "MODERATE" | "HIGH_RISK" | "LIQUIDATION_IMMINENT";
  readonly suppliedAssets: readonly { readonly symbol: string; readonly amount: number; readonly valueUsd: number; readonly apyPercent: number }[];
  readonly borrowedAssets: readonly { readonly symbol: string; readonly amount: number; readonly valueUsd: number; readonly borrowApyPercent: number }[];
}

export interface DeFiHealthReport {
  readonly userAddress: string;
  readonly overallHealthFactor: number;
  readonly aggregateCollateralUsd: number;
  readonly aggregateDebtUsd: number;
  readonly overallLtvPercent: number;
  readonly positions: readonly DeFiPosition[];
  readonly alerts: readonly string[];
  readonly formattedHealthCard: string;
}

// ---------------------------------------------------------------------------
// Beyond the Fold: EIP-712 Typed Signature & Permit Drainer Scanner
// ---------------------------------------------------------------------------

export interface EIP712SignatureAuditRequest {
  readonly chain: SupportedChain;
  readonly userAddress: string;
  readonly domainName: string;
  readonly verifyingContract: string;
  readonly primaryType: "Permit" | "Permit2" | "OrderComponents" | "BulkTransfer" | "Custom";
  readonly messagePayload: Readonly<Record<string, unknown>>;
}

export interface EIP712SignatureAuditResult {
  readonly auditId: string;
  readonly isPhishingDrainerPattern: boolean;
  readonly authorizedSpender?: string;
  readonly authorizedToken?: string;
  readonly authorizedAmount?: string;
  readonly isUnlimitedApproval: boolean;
  readonly expiryDeadline?: number;
  readonly riskTier: SecurityRiskTier;
  readonly riskAnalysis: string;
  readonly inspectionCard: string;
}

// ---------------------------------------------------------------------------
// Beyond the Fold: Gas Oracle & Execution Timing Advisor
// ---------------------------------------------------------------------------

export interface GasTierEstimate {
  readonly tier: "slow" | "standard" | "fast" | "instant";
  readonly baseFeeGwei: number;
  readonly priorityFeeGwei: number;
  readonly totalGwei: number;
  readonly estimatedTransferCostUsd: number;
  readonly estimatedDexSwapCostUsd: number;
  readonly expectedConfirmationSeconds: number;
}

export interface GasMarketReport {
  readonly chain: SupportedChain;
  readonly currentBaseFeeGwei: number;
  readonly gasTiers: readonly GasTierEstimate[];
  readonly historicalTrend: "cheap" | "average" | "elevated" | "spike";
  readonly timingAdvice: string;
  readonly formattedGasCard: string;
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Beyond the Fold: Address Book & ENS / Name Directory
// ---------------------------------------------------------------------------

export interface AddressBookContact {
  readonly address: string;
  readonly chain: SupportedChain;
  readonly label: string;
  readonly ensOrDomain?: string;
  readonly trustRating: "VERIFIED_PARTNER" | "INTERNAL_TEAM" | "KNOWN" | "UNVERIFIED";
  readonly notes?: string;
  readonly createdAt: number;
}

// ---------------------------------------------------------------------------
// Next Frontier: Cross-Chain Bridge Aggregator (Across / Li.Fi / Stargate)
// ---------------------------------------------------------------------------

export interface BridgeQuoteRequest {
  readonly fromChain: SupportedChain;
  readonly toChain: SupportedChain;
  readonly tokenSymbol: string;
  readonly tokenAddress: string;
  readonly amount: number;
  readonly recipientAddress: string;
  readonly maxBridgeFeeUsd?: number;
}

export interface BridgeQuoteResult {
  readonly bridgeQuoteId: string;
  readonly bridgeProvider: "AcrossV3" | "LiFi" | "Stargate" | "LayerZero";
  readonly fromChain: SupportedChain;
  readonly toChain: SupportedChain;
  readonly tokenSymbol: string;
  readonly amountIn: number;
  readonly estimatedAmountReceived: number;
  readonly totalBridgeFeeUsd: number;
  readonly estimatedDurationSeconds: number;
  readonly securityScore: number; // 0-100
  readonly formattedBridgeCard: string;
  readonly validUntilMs: number;
}

// ---------------------------------------------------------------------------
// Next Frontier: ERC-4337 Account Abstraction & Paymaster Gas Sponsorship
// ---------------------------------------------------------------------------

export interface UserOperationRequest {
  readonly chain: SupportedChain;
  readonly senderSmartAccount: string;
  readonly targetContract: string;
  readonly callData: string;
  readonly valueNative?: number;
  readonly gasTokenSymbol?: string; // e.g. "USDC" or "SPONSORED"
}

export interface AccountAbstractionSimulationResult {
  readonly userOpHash: string;
  readonly senderSmartAccount: string;
  readonly isGasSponsored: boolean;
  readonly paymasterAddress?: string;
  readonly feeTokenSymbol: string;
  readonly estimatedFeeAmount: number;
  readonly estimatedFeeUsd: number;
  readonly verificationGasLimit: number;
  readonly callGasLimit: number;
  readonly simulationSuccess: boolean;
  readonly formattedUserOpCard: string;
}

// ---------------------------------------------------------------------------
// Next Frontier: Automated Staking & Yield Optimization (Lido / Convex)
// ---------------------------------------------------------------------------

export interface YieldStakingPosition {
  readonly protocol: "Lido" | "RocketPool" | "Convex" | "MorphoVault" | "KaminoLend";
  readonly chain: SupportedChain;
  readonly assetSymbol: string;
  readonly stakedAmount: number;
  readonly totalValueUsd: number;
  readonly currentApyPercent: number;
  readonly projectedAnnualYieldUsd: number;
  readonly autoCompoundSchedule: "daily" | "weekly" | "continuous";
}

export interface YieldOptimizationReport {
  readonly totalStakedUsd: number;
  readonly weightedAverageApyPercent: number;
  readonly projectedTotalAnnualYieldUsd: number;
  readonly positions: readonly YieldStakingPosition[];
  readonly optimizationRecommendations: readonly string[];
  readonly formattedYieldCard: string;
}

// ---------------------------------------------------------------------------
// Next Frontier: Gnosis Safe Multi-Sig Quorum Staging & Time-Lock
// ---------------------------------------------------------------------------

export interface MultiSigTransactionStage {
  readonly safeTxHash: string;
  readonly safeAddress: string;
  readonly chain: SupportedChain;
  readonly thresholdRequired: number;
  readonly currentConfirmations: readonly string[]; // addresses of signers
  readonly isQuorumReached: boolean;
  readonly timeLockRemainingSeconds: number;
  readonly proposedActionSummary: string;
  readonly formattedStageCard: string;
}

export interface WalletSubstrateSnapshot {
  readonly portfolios: readonly WalletPortfolio[];
  readonly allowances: readonly TokenAllowanceRecord[];
  readonly simulations: readonly TransactionSimulationResult[];
  readonly swapQuotes: readonly SwapQuoteResult[];
  readonly defiPositions: readonly DeFiPosition[];
  readonly contacts: readonly AddressBookContact[];
  readonly bridgeQuotes: readonly BridgeQuoteResult[];
  readonly userOps: readonly AccountAbstractionSimulationResult[];
  readonly yieldPositions: readonly YieldStakingPosition[];
  readonly multiSigStages: readonly MultiSigTransactionStage[];
  readonly totalTrackedWallets: number;
  readonly totalAllowanceRecords: number;
  readonly totalSimulations: number;
  readonly totalContacts: number;
  readonly totalBridgeQuotes: number;
  readonly totalUserOps: number;
  readonly config: WalletSkillConfig;
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// Typed BroccoliDB Persistence Table Row Schemas
// ---------------------------------------------------------------------------

export interface WalletPortfolioRow {
  readonly id: string;
  readonly address: string;
  readonly chain: SupportedChain;
  readonly totalPortfolioValueUsd: number;
  readonly nativeBalanceUsd: number;
  readonly tokenCount: number;
  readonly lastUpdated: number;
  readonly [key: string]: unknown;
}

export interface TokenAllowanceRow {
  readonly id: string;
  readonly walletAddress: string;
  readonly chain: SupportedChain;
  readonly tokenSymbol: string;
  readonly spenderAddress: string;
  readonly riskTier: SecurityRiskTier;
  readonly updatedAt: number;
  readonly [key: string]: unknown;
}

export interface WalletSimulationRow {
  readonly id: string;
  readonly simulationId: string;
  readonly chain: SupportedChain;
  readonly success: boolean;
  readonly riskTier: SecurityRiskTier;
  readonly netValueChangeUsd: number;
  readonly simulatedAt: number;
  readonly [key: string]: unknown;
}

export interface WalletAuditRow {
  readonly id: string;
  readonly action: string;
  readonly operator: string;
  readonly details: string;
  readonly timestamp: number;
  readonly [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SLA Health & Metrics Telemetry
// ---------------------------------------------------------------------------

export type WalletHealthStatus =
  | "optimal"
  | "healthy"
  | "degraded"
  | "critical_risk";

export interface WalletHealthAuditReport {
  readonly totalPortfolios: number;
  readonly totalPortfolioValueUsd: number;
  readonly totalAllowances: number;
  readonly criticalAllowancesCount: number;
  readonly totalSimulations: number;
  readonly simulationSuccessRate: number;
  readonly healthStatus: WalletHealthStatus;
  readonly recommendations: readonly string[];
}

export interface WalletMetricsReport {
  readonly totalTrackedWallets: number;
  readonly totalPortfolioValueUsd: number;
  readonly chainDistribution: Readonly<Record<string, number>>;
  readonly totalSimulations: number;
  readonly totalQuotes: number;
  readonly totalBridgeQuotes: number;
  readonly totalDeFiPositions: number;
  readonly totalUserOps: number;
  readonly totalYieldPositions: number;
  readonly totalMultiSigStages: number;
  readonly p50PortfolioValueUsd: number;
  readonly p95PortfolioValueUsd: number;
}

// ---------------------------------------------------------------------------
// Multi-Criteria Grouping & Swimlanes
// ---------------------------------------------------------------------------

export type WalletGroupBy = "chain" | "valueTier" | "riskTier";

export type WalletSortBy = "value" | "chain" | "lastUpdated";

export type WalletSortDirection = "asc" | "desc";

export interface WalletGroupedLane {
  readonly key: string;
  readonly title: string;
  readonly count: number;
  readonly totalValueUsd: number;
  readonly portfolios: readonly WalletPortfolio[];
}

// ---------------------------------------------------------------------------
// Natural Query DSL Search Engine
// ---------------------------------------------------------------------------

export interface WalletDslQueryFilter {
  readonly rawQuery: string;
  readonly chain?: SupportedChain;
  readonly minValueUsd?: number;
  readonly maxValueUsd?: number;
  readonly riskTier?: SecurityRiskTier;
  readonly textTerms?: readonly string[];
}

// ---------------------------------------------------------------------------
// Mutation Undo / Redo & Bulk Mutations
// ---------------------------------------------------------------------------

export interface WalletMutationUndoRecord {
  readonly mutationType: "store_portfolio" | "purge_portfolios" | "update_config" | "bulk";
  readonly previousSnapshot: WalletSubstrateSnapshot;
  readonly nextSnapshot: WalletSubstrateSnapshot;
  readonly timestampMs: number;
}

export interface WalletBulkMutationResult {
  readonly matchedCount: number;
  readonly modifiedCount: number;
  readonly affectedAddresses: readonly string[];
}

// ---------------------------------------------------------------------------
// Substrate Interface
// ---------------------------------------------------------------------------

export interface IBroccoliWalletSubstrate {
  getConfig(): WalletSkillConfig;
  updateConfig(updates: Partial<WalletSkillConfig>): WalletSkillConfig;
  storePortfolio(portfolio: WalletPortfolio): void;
  getPortfolio(address: string, chain: string): WalletPortfolio | undefined;
  listPortfolios(): readonly WalletPortfolio[];
  storeAllowance(record: TokenAllowanceRecord): void;
  getAllowances(walletAddress: string): readonly TokenAllowanceRecord[];
  storeSimulation(sim: TransactionSimulationResult): void;
  getSimulation(id: string): TransactionSimulationResult | undefined;
  listSimulations(limit?: number): readonly TransactionSimulationResult[];
  storeSwapQuote(quote: SwapQuoteResult): void;
  getSwapQuote(id: string): SwapQuoteResult | undefined;
  storeDeFiPosition(pos: DeFiPosition): void;
  listDeFiPositions(userAddress?: string): readonly DeFiPosition[];
  storeContact(contact: AddressBookContact): void;
  getContact(address: string, chain?: string): AddressBookContact | undefined;
  listContacts(): readonly AddressBookContact[];
  storeBridgeQuote(quote: BridgeQuoteResult): void;
  getBridgeQuote(id: string): BridgeQuoteResult | undefined;
  storeUserOp(userOp: AccountAbstractionSimulationResult): void;
  getUserOp(userOpHash: string): AccountAbstractionSimulationResult | undefined;
  storeYieldPosition(pos: YieldStakingPosition): void;
  listYieldPositions(): readonly YieldStakingPosition[];
  storeMultiSigStage(stage: MultiSigTransactionStage): void;
  getMultiSigStage(safeTxHash: string): MultiSigTransactionStage | undefined;
  listMultiSigStages(): readonly MultiSigTransactionStage[];
  getMetrics(): WalletMetricsReport;
  auditHealth(): WalletHealthAuditReport;
  getGroupedPortfolios(groupBy?: WalletGroupBy, sortBy?: WalletSortBy, direction?: WalletSortDirection): readonly WalletGroupedLane[];
  queryPortfoliosDsl(query: WalletDslQueryFilter | string): readonly WalletPortfolio[];
  bulkPurgePortfolios(addresses: readonly string[]): WalletBulkMutationResult;
  undo(): boolean;
  redo(): boolean;
  exportSnapshot(): WalletSubstrateSnapshot;
  importSnapshot(snapshot: WalletSubstrateSnapshot): void;
  exportInteractiveHtmlView(): string;
  exportMarkdownReport(): string;
  exportCsvReport(): string;
  clear(): void;
}

