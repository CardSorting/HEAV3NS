/**
 * wallet-tool-suite.ts
 *
 * Model tool surface for the Native Wallet Subsystem (Phase 93 / ADR-123).
 * Exposes Rainbow/Phantom-grade structured portfolio queries, dangerous allowance audits,
 * dry-run transaction simulations, DEX aggregator swap quotes, DeFi health factor scoring,
 * EIP-712 permit security scans, Across/LiFi bridging, ERC-4337 UserOp simulation,
 * automated staking yield optimization, Gnosis Safe multi-sig staging, and gas timing advice.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { SupportedChain } from "../../../core/contracts/wallet.contracts.js";
import { WalletSupervisor } from "../../../agents/extensions/wallet/wallet-supervisor.js";

export class WalletToolSuite {
  private readonly supervisor: WalletSupervisor;

  constructor(supervisor: WalletSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "wallet_get_portfolio",
        description: "Queries multi-chain token balances, native asset holdings, and USD portfolio value with EIP-55 checksum validation.",
        parameters: {
          address: { type: "string", required: true, description: "Wallet address (EVM 0x... or Solana Base58)" },
          chain: { type: "string", description: "Target blockchain (ethereum, base, solana, polygon, arbitrum, optimism, avalanche, zksync). Default: base" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const address = String(args.address || "").trim();
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const result = this.supervisor.getPortfolio(address, chain);

          if (!result.success || !result.portfolio) {
            return {
              success: false,
              error: result.error || "Failed to retrieve wallet portfolio",
            };
          }

          return {
            success: true,
            address: result.portfolio.address,
            chain: result.portfolio.chain,
            totalValueUsd: result.portfolio.totalPortfolioValueUsd,
            nativeBalance: result.portfolio.nativeBalance,
            nativeSymbol: result.portfolio.nativeSymbol,
            tokensCount: result.portfolio.tokens.length,
            tokens: result.portfolio.tokens,
            preview: result.portfolio.formattedSummaryCard,
          };
        },
      },
      {
        name: "wallet_audit_allowances",
        description: "Audits token approvals and flags dangerous infinite spenders or unverified contracts (Revoke.cash pattern).",
        parameters: {
          address: { type: "string", required: true, description: "Wallet address to audit" },
          chain: { type: "string", description: "Target chain. Default: base" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const address = String(args.address || "").trim();
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const result = this.supervisor.auditAllowances(address, chain);

          if (!result.success || !result.allowances) {
            return {
              success: false,
              error: result.error || "Failed to audit token allowances",
            };
          }

          const criticalCount = result.allowances.filter((a) => a.riskTier === "CRITICAL_REVOKE_RECOMMENDED").length;

          return {
            success: true,
            totalAllowances: result.allowances.length,
            criticalRevokeCount: criticalCount,
            allowances: result.allowances,
            summary: criticalCount > 0
              ? `⚠️ **Security Alert**: Found ${criticalCount} CRITICAL dangerous allowance(s). Revocation recommended!`
              : "✓ Token allowances reviewed. No critical vulnerabilities found.",
          };
        },
      },
      {
        name: "wallet_simulate_transaction",
        description: "Dry-runs a proposed transfer or contract interaction, calculating exact asset deltas, gas fees, and Blowfish-grade security risks.",
        parameters: {
          chain: { type: "string", required: true, description: "Target blockchain" },
          fromAddress: { type: "string", required: true, description: "Sender wallet address" },
          toAddress: { type: "string", required: true, description: "Recipient or contract address" },
          valueNative: { type: "number", description: "Amount of native asset (ETH, SOL, etc.) to send" },
          calldata: { type: "string", description: "Contract interaction payload in hex (default: 0x)" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const fromAddress = String(args.fromAddress || "").trim();
          const toAddress = String(args.toAddress || "").trim();
          const valueNative = typeof args.valueNative === "number" ? args.valueNative : 0;
          const calldata = args.calldata ? String(args.calldata) : "0x";

          const result = this.supervisor.simulateTransaction({
            chain,
            fromAddress,
            toAddress,
            valueNative,
            calldata,
          });

          if (!result.success || !result.simulation) {
            return {
              success: false,
              error: result.error || "Transaction simulation failed",
              preview: result.simulation?.humanReadablePreview,
            };
          }

          return {
            success: true,
            simulationId: result.simulation.simulationId,
            riskTier: result.simulation.riskTier,
            netValueChangeUsd: result.simulation.netValueChangeUsd,
            estimatedGasCostUsd: result.simulation.estimatedGasCostUsd,
            assetDeltas: result.simulation.assetDeltas,
            preview: result.simulation.humanReadablePreview,
          };
        },
      },
      {
        name: "wallet_quote_swap",
        description: "Quotes optimal multi-hop DEX aggregation swap routes (1inch / Jupiter style) with slippage and MEV protection.",
        parameters: {
          chain: { type: "string", required: true, description: "Target blockchain (base, ethereum, solana, arbitrum, optimism)" },
          fromTokenSymbol: { type: "string", required: true, description: "Source token symbol (e.g. ETH, USDC)" },
          fromTokenAddress: { type: "string", required: true, description: "Source token contract address" },
          toTokenSymbol: { type: "string", required: true, description: "Destination token symbol" },
          toTokenAddress: { type: "string", required: true, description: "Destination token contract address" },
          amountIn: { type: "number", required: true, description: "Amount of source token to swap" },
          slippageTolerancePercent: { type: "number", description: "Slippage tolerance percent. Default: 0.5%" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const fromTokenSymbol = String(args.fromTokenSymbol || "ETH");
          const fromTokenAddress = String(args.fromTokenAddress || "0x");
          const toTokenSymbol = String(args.toTokenSymbol || "USDC");
          const toTokenAddress = String(args.toTokenAddress || "0x");
          const amountIn = typeof args.amountIn === "number" ? args.amountIn : 1.0;
          const slippageTolerancePercent = typeof args.slippageTolerancePercent === "number" ? args.slippageTolerancePercent : 0.5;

          const result = this.supervisor.quoteSwap({
            chain,
            fromTokenSymbol,
            fromTokenAddress,
            toTokenSymbol,
            toTokenAddress,
            amountIn,
            slippageTolerancePercent,
          });

          if (!result.success || !result.quote) {
            return {
              success: false,
              error: result.error || "Swap quote failed",
            };
          }

          return {
            success: true,
            quoteId: result.quote.quoteId,
            amountIn: result.quote.amountIn,
            estimatedAmountOut: result.quote.estimatedAmountOut,
            minimumAmountOut: result.quote.minimumAmountOut,
            priceImpactPercent: result.quote.priceImpactPercent,
            preview: result.quote.formattedRoutePreview,
          };
        },
      },
      {
        name: "wallet_inspect_defi_health",
        description: "Inspects user borrowing health factor, collateral ratios, and liquidation risks across DeFi protocols (Aave, Morpho).",
        parameters: {
          address: { type: "string", required: true, description: "User wallet address" },
          chain: { type: "string", description: "Target blockchain. Default: base" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const address = String(args.address || "").trim();
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;

          const result = this.supervisor.inspectDeFiHealth(address, chain);
          if (!result.success || !result.health) {
            return {
              success: false,
              error: result.error || "DeFi health inspection failed",
            };
          }

          return {
            success: true,
            overallHealthFactor: result.health.overallHealthFactor,
            collateralUsd: result.health.aggregateCollateralUsd,
            debtUsd: result.health.aggregateDebtUsd,
            currentLtvPercent: result.health.overallLtvPercent,
            preview: result.health.formattedHealthCard,
          };
        },
      },
      {
        name: "wallet_audit_signature",
        description: "Scans off-chain EIP-712 typed permit signatures (Permit, Permit2, Seaport) for hidden phishing and drainer threats.",
        parameters: {
          chain: { type: "string", required: true, description: "Blockchain network" },
          userAddress: { type: "string", required: true, description: "Signer wallet address" },
          domainName: { type: "string", required: true, description: "EIP-712 domain name" },
          verifyingContract: { type: "string", required: true, description: "Contract verifying the signature" },
          primaryType: { type: "string", required: true, description: "Signature type (Permit, Permit2, OrderComponents)" },
          messagePayload: { type: "string", required: true, description: "JSON string payload of the typed message" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const userAddress = String(args.userAddress || "");
          const domainName = String(args.domainName || "");
          const verifyingContract = String(args.verifyingContract || "");
          const primaryType = (String(args.primaryType || "Permit")) as any;
          let messagePayload: Record<string, unknown> = {};
          if (typeof args.messagePayload === "string") {
            try {
              messagePayload = JSON.parse(args.messagePayload);
            } catch {
              messagePayload = {};
            }
          } else if (typeof args.messagePayload === "object" && args.messagePayload !== null) {
            messagePayload = args.messagePayload as Record<string, unknown>;
          }

          const result = this.supervisor.auditSignature({
            chain,
            userAddress,
            domainName,
            verifyingContract,
            primaryType,
            messagePayload,
          });

          if (!result.success || !result.audit) {
            return {
              success: false,
              error: result.error || "Signature audit failed",
              riskTier: result.audit?.riskTier,
              preview: result.audit?.inspectionCard,
            };
          }

          return {
            success: true,
            riskTier: result.audit.riskTier,
            isUnlimited: result.audit.isUnlimitedApproval,
            preview: result.audit.inspectionCard,
          };
        },
      },
      {
        name: "wallet_quote_bridge",
        description: "Quotes optimal cross-chain bridge routes (Across v3, Li.Fi, Stargate) with transit time and fee estimates.",
        parameters: {
          fromChain: { type: "string", required: true, description: "Source chain" },
          toChain: { type: "string", required: true, description: "Destination chain" },
          tokenSymbol: { type: "string", required: true, description: "Asset symbol (e.g. USDC, ETH)" },
          tokenAddress: { type: "string", required: true, description: "Asset contract address" },
          amount: { type: "number", required: true, description: "Amount of token to bridge" },
          recipientAddress: { type: "string", required: true, description: "Recipient address on destination chain" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const fromChain = (String(args.fromChain || "ethereum").toLowerCase()) as SupportedChain;
          const toChain = (String(args.toChain || "base").toLowerCase()) as SupportedChain;
          const tokenSymbol = String(args.tokenSymbol || "USDC");
          const tokenAddress = String(args.tokenAddress || "0x");
          const amount = typeof args.amount === "number" ? args.amount : 100.0;
          const recipientAddress = String(args.recipientAddress || "");

          const result = this.supervisor.quoteBridge({
            fromChain,
            toChain,
            tokenSymbol,
            tokenAddress,
            amount,
            recipientAddress,
          });

          if (!result.success || !result.quote) {
            return {
              success: false,
              error: result.error || "Bridge quote failed",
            };
          }

          return {
            success: true,
            bridgeQuoteId: result.quote.bridgeQuoteId,
            provider: result.quote.bridgeProvider,
            amountIn: result.quote.amountIn,
            estimatedReceived: result.quote.estimatedAmountReceived,
            feeUsd: result.quote.totalBridgeFeeUsd,
            durationSeconds: result.quote.estimatedDurationSeconds,
            preview: result.quote.formattedBridgeCard,
          };
        },
      },
      {
        name: "wallet_simulate_user_op",
        description: "Simulates an ERC-4337 Account Abstraction UserOperation with paymaster gas sponsorship.",
        parameters: {
          chain: { type: "string", required: true, description: "Target blockchain" },
          senderSmartAccount: { type: "string", required: true, description: "Smart account address" },
          targetContract: { type: "string", required: true, description: "Target interaction contract" },
          callData: { type: "string", required: true, description: "Execution calldata" },
          gasTokenSymbol: { type: "string", description: "Gas token symbol (SPONSORED or USDC). Default: SPONSORED" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const senderSmartAccount = String(args.senderSmartAccount || "");
          const targetContract = String(args.targetContract || "");
          const callData = String(args.callData || "0x");
          const gasTokenSymbol = args.gasTokenSymbol ? String(args.gasTokenSymbol) : "SPONSORED";

          const result = this.supervisor.simulateUserOp({
            chain,
            senderSmartAccount,
            targetContract,
            callData,
            gasTokenSymbol,
          });

          if (!result.success || !result.result) {
            return {
              success: false,
              error: result.error || "UserOp simulation failed",
            };
          }

          return {
            success: true,
            userOpHash: result.result.userOpHash,
            isGasSponsored: result.result.isGasSponsored,
            feeUsd: result.result.estimatedFeeUsd,
            preview: result.result.formattedUserOpCard,
          };
        },
      },
      {
        name: "wallet_optimize_yield",
        description: "Inspects liquid staking and yield positions (Lido wstETH, Morpho Vaults), computing APY returns and harvesting plans.",
        parameters: {
          chain: { type: "string", description: "Target blockchain. Default: base" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const result = this.supervisor.optimizeYield(chain);

          if (!result.success || !result.report) {
            return {
              success: false,
              error: result.error || "Yield optimization query failed",
            };
          }

          return {
            success: true,
            totalStakedUsd: result.report.totalStakedUsd,
            weightedApyPercent: result.report.weightedAverageApyPercent,
            annualYieldUsd: result.report.projectedTotalAnnualYieldUsd,
            preview: result.report.formattedYieldCard,
          };
        },
      },
      {
        name: "wallet_stage_multisig",
        description: "Stages a proposed Gnosis Safe transaction and tracks quorum threshold approvals.",
        parameters: {
          safeAddress: { type: "string", required: true, description: "Gnosis Safe contract address" },
          chain: { type: "string", description: "Target chain. Default: base" },
          proposedAction: { type: "string", required: true, description: "Summary description of proposed transaction" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const safeAddress = String(args.safeAddress || "");
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const proposedAction = String(args.proposedAction || "Transfer 100 USDC to Operations");

          const result = this.supervisor.stageMultiSig(safeAddress, chain, proposedAction, []);

          if (!result.success || !result.stage) {
            return {
              success: false,
              error: result.error || "MultiSig staging failed",
            };
          }

          return {
            success: true,
            safeTxHash: result.stage.safeTxHash,
            isQuorumReached: result.stage.isQuorumReached,
            thresholdRequired: result.stage.thresholdRequired,
            preview: result.stage.formattedStageCard,
          };
        },
      },
      {
        name: "wallet_get_gas_advice",
        description: "Retrieves live multi-tier gas pricing (slow, standard, fast, instant) and timing recommendations.",
        parameters: {
          chain: { type: "string", description: "Target blockchain. Default: base" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const result = this.supervisor.getGasReport(chain);

          if (!result.success || !result.gasReport) {
            return {
              success: false,
              error: result.error || "Gas report failed",
            };
          }

          return {
            success: true,
            baseFeeGwei: result.gasReport.currentBaseFeeGwei,
            advice: result.gasReport.timingAdvice,
            preview: result.gasReport.formattedGasCard,
          };
        },
      },
      {
        name: "wallet_resolve_contact",
        description: "Resolves ENS names (e.g. vitalik.eth) and saves or looks up verified address book contacts.",
        parameters: {
          nameOrAddress: { type: "string", required: true, description: "ENS name or raw crypto address" },
          chain: { type: "string", description: "Target chain. Default: base" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const nameOrAddress = String(args.nameOrAddress || "").trim();
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const result = this.supervisor.resolveNameOrContact(nameOrAddress, chain);

          if (!result.success || !result.contact) {
            return {
              success: false,
              error: result.error || "Contact resolution failed",
            };
          }

          return {
            success: true,
            address: result.contact.address,
            label: result.contact.label,
            ensOrDomain: result.contact.ensOrDomain,
            trustRating: result.contact.trustRating,
          };
        },
      },
      {
        name: "wallet_inspect_contract",
        description: "Inspects a smart contract bytecode, checking verification status, proxy standards, and phishing risk flags.",
        parameters: {
          address: { type: "string", required: true, description: "Smart contract address" },
          chain: { type: "string", description: "Blockchain network. Default: base" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const address = String(args.address || "").trim();
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const result = this.supervisor.inspectContract(address, chain);

          if (!result.success || !result.inspection) {
            return {
              success: false,
              error: result.error || "Contract inspection failed",
            };
          }

          return {
            success: true,
            inspection: result.inspection,
            preview: result.inspection.summaryCard,
          };
        },
      },
      {
        name: "wallet_manage_config",
        description: "Enables, disables, or updates security policies (chains, spend limits, slippage) for the Native Wallet skill.",
        parameters: {
          enabled: { type: "boolean", description: "Enable or disable native wallet capabilities" },
          maxDailyTransferLimitUsd: { type: "number", description: "Daily spending threshold in USD for mandatory confirmation" },
          requireSimulationBeforeAction: { type: "boolean", description: "Enforce transaction dry-run simulation before action" },
          maxSlippagePercent: { type: "number", description: "Maximum allowed slippage percent for swaps" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const updates: Record<string, unknown> = {};
          if (typeof args.enabled === "boolean") updates.enabled = args.enabled;
          if (typeof args.maxDailyTransferLimitUsd === "number") updates.maxDailyTransferLimitUsd = args.maxDailyTransferLimitUsd;
          if (typeof args.requireSimulationBeforeAction === "boolean") updates.requireSimulationBeforeAction = args.requireSimulationBeforeAction;
          if (typeof args.maxSlippagePercent === "number") updates.maxSlippagePercent = args.maxSlippagePercent;

          const updated = this.supervisor.updateConfig(updates);

          return {
            success: true,
            status: updated.enabled ? "ACTIVE (ENABLED)" : "DISABLED (FAIL-CLOSED)",
            config: updated,
            message: updated.enabled
              ? `✓ Wallet skill is now ENABLED on [${updated.allowedChains.join(", ")}] with $${updated.maxDailyTransferLimitUsd} daily limit.`
              : "✓ Wallet skill is now DISABLED. All operations will fail closed.",
          };
        },
      },
    ];
  }
}
