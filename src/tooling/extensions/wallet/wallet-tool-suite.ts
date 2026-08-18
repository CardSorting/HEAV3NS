/**
 * wallet-tool-suite.ts
 *
 * Model tool surface for Autonomous Agent Wallet & DeFi Subsystem (Phase 91/93 / ADR-123 / ADR-043):
 * 30 specialized model tools for multi-chain balances, transaction simulations, DEX swap quotes,
 * DeFi health factors, EIP-712 audits, cross-chain bridging, userOps, yield staking, safe staging,
 * DSL queries, swimlanes, dashboards, and reports.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  SupportedChain,
  WalletGroupBy,
  WalletSortBy,
  WalletSortDirection,
} from "../../../core/contracts/wallet.contracts.js";
import { WalletSupervisor } from "../../../agents/extensions/wallet/wallet-supervisor.js";
import { WalletSnapshotManager } from "../../../sessions/extensions/wallet/wallet-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class WalletToolSuite {
  private readonly supervisor: WalletSupervisor;
  private readonly snapshotManager: WalletSnapshotManager;

  constructor(supervisor: WalletSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new WalletSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "wallet_manage_config",
        description: "Manages native wallet skill enablement, daily USD limits, allowed chains, and simulation requirements.",
        parameters: {
          action: { type: "string", description: "Action: 'get' or 'update'" },
          enabled: { type: "boolean", description: "Enable or disable wallet skills" },
          allowedChainsJson: { type: "string", description: "JSON array of allowed chains" },
          maxDailyTransferLimitUsd: { type: "number", description: "Daily USD transfer safety limit" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_manage_config", args);
        },
      },
      {
        name: "wallet_get_portfolio",
        description: "Queries multi-chain token balances, native asset holdings, and USD portfolio value with EIP-55 checksum validation.",
        parameters: {
          address: { type: "string", required: true, description: "Wallet address" },
          chain: { type: "string", description: "Target blockchain. Default: base" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_get_portfolio", args);
        },
      },
      {
        name: "wallet_list_portfolios",
        description: "Lists all cached multi-chain wallet portfolios.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_list_portfolios", args);
        },
      },
      {
        name: "wallet_audit_allowances",
        description: "Audits token approvals and flags dangerous infinite spenders or unverified contracts.",
        parameters: {
          address: { type: "string", required: true, description: "Wallet address to audit" },
          chain: { type: "string", description: "Target blockchain. Default: base" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_audit_allowances", args);
        },
      },
      {
        name: "wallet_simulate_transaction",
        description: "Simulates transaction execution with asset deltas and risk classification.",
        parameters: {
          chain: { type: "string", required: true, description: "Target blockchain" },
          fromAddress: { type: "string", required: true, description: "Sender address" },
          toAddress: { type: "string", required: true, description: "Recipient or contract address" },
          valueNative: { type: "number", description: "Native value to send" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_simulate_transaction", args);
        },
      },
      {
        name: "wallet_get_swap_quote",
        description: "Fetches multi-hop DEX swap quote across Uniswap, Curve, Aerodrome, etc.",
        parameters: {
          chain: { type: "string", required: true, description: "Blockchain" },
          fromTokenSymbol: { type: "string", required: true, description: "Input token symbol" },
          toTokenSymbol: { type: "string", required: true, description: "Output token symbol" },
          amountIn: { type: "number", required: true, description: "Amount to swap" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_get_swap_quote", args);
        },
      },
      {
        name: "wallet_inspect_contract",
        description: "Inspects smart contract bytecode, verification, standards (ERC20/721/1155), and proxy risk.",
        parameters: {
          address: { type: "string", required: true, description: "Contract address" },
          chain: { type: "string", description: "Blockchain" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_inspect_contract", args);
        },
      },
      {
        name: "wallet_get_defi_health",
        description: "Calculates lending position health factor and liquidation risk across Aave, Morpho, MakerDAO.",
        parameters: {
          userAddress: { type: "string", required: true, description: "User wallet address" },
          chain: { type: "string", description: "Blockchain" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_get_defi_health", args);
        },
      },
      {
        name: "wallet_audit_eip712_signature",
        description: "Audits typed EIP-712 permits and scans for phishing drainer signatures.",
        parameters: {
          chain: { type: "string", required: true, description: "Blockchain" },
          userAddress: { type: "string", required: true, description: "Signer address" },
          domainName: { type: "string", required: true, description: "EIP-712 Domain name" },
          verifyingContract: { type: "string", required: true, description: "Verifying contract address" },
          primaryType: { type: "string", required: true, description: "Primary type" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_audit_eip712_signature", args);
        },
      },
      {
        name: "wallet_get_gas_report",
        description: "Provides real-time gas oracle metrics across slow/standard/fast/instant tiers.",
        parameters: {
          chain: { type: "string", description: "Blockchain. Default: base" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_get_gas_report", args);
        },
      },
      {
        name: "wallet_manage_address_book",
        description: "Resolves or manages contacts and ENS names in address book.",
        parameters: {
          nameOrAddress: { type: "string", required: true, description: "ENS name or address" },
          chain: { type: "string", description: "Blockchain. Default: base" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_manage_address_book", args);
        },
      },
      {
        name: "wallet_get_bridge_quote",
        description: "Fetches cross-chain bridge quote across Across, LiFi, Stargate.",
        parameters: {
          fromChain: { type: "string", required: true, description: "Source chain" },
          toChain: { type: "string", required: true, description: "Destination chain" },
          tokenSymbol: { type: "string", required: true, description: "Token symbol" },
          amount: { type: "number", required: true, description: "Amount to bridge" },
          recipientAddress: { type: "string", required: true, description: "Recipient address" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_get_bridge_quote", args);
        },
      },
      {
        name: "wallet_simulate_user_op",
        description: "Simulates ERC-4337 Account Abstraction UserOperation and paymaster gas sponsorship.",
        parameters: {
          chain: { type: "string", required: true, description: "Blockchain" },
          senderSmartAccount: { type: "string", required: true, description: "Smart account address" },
          targetContract: { type: "string", required: true, description: "Target contract address" },
          callData: { type: "string", required: true, description: "Execution calldata" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_simulate_user_op", args);
        },
      },
      {
        name: "wallet_get_yield_report",
        description: "Optimizes staking yields and auto-compounding schedules across Lido, RocketPool, Convex.",
        parameters: {
          userAddress: { type: "string", required: true, description: "User wallet address" },
          chain: { type: "string", description: "Blockchain" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_get_yield_report", args);
        },
      },
      {
        name: "wallet_stage_multisig_tx",
        description: "Stages Gnosis Safe multi-sig transaction with quorum validation and timelock checks.",
        parameters: {
          safeAddress: { type: "string", required: true, description: "Gnosis Safe address" },
          chain: { type: "string", required: true, description: "Blockchain" },
          thresholdRequired: { type: "number", required: true, description: "Required signatures" },
          confirmationsJson: { type: "string", required: true, description: "JSON array of signer addresses" },
          proposedActionSummary: { type: "string", required: true, description: "Action summary" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_stage_multisig_tx", args);
        },
      },
      {
        name: "wallet_audit_health",
        description: "Audits wallet security posture, allowance exposures, and simulation success rates.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_audit_health", args);
        },
      },
      {
        name: "wallet_get_metrics",
        description: "Fetches comprehensive telemetry on tracked portfolios, total USD value, and chain distribution.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_get_metrics", args);
        },
      },
      {
        name: "wallet_group_and_sort",
        description: "Organizes portfolios into multi-criteria swimlanes (chain, valueTier, riskTier).",
        parameters: {
          groupBy: { type: "string", description: "Group by: chain, valueTier, riskTier" },
          sortBy: { type: "string", description: "Sort by: value, chain, lastUpdated" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_group_and_sort", args);
        },
      },
      {
        name: "wallet_search_dsl",
        description: "Searches portfolios using natural query DSL (e.g. 'chain:base min_balance>100').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_search_dsl", args);
        },
      },
      {
        name: "wallet_render_dashboard",
        description: "Renders an ANSI CLI summary card with portfolio USD values and chain allocations.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_render_dashboard", args);
        },
      },
      {
        name: "wallet_render_card",
        description: "Renders an interactive ANSI CLI portfolio card for a specific wallet.",
        parameters: {
          address: { type: "string", required: true, description: "Wallet address" },
          chain: { type: "string", description: "Blockchain" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_render_card", args);
        },
      },
      {
        name: "wallet_export_html",
        description: "Exports wallet portfolios to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_export_html", args);
        },
      },
      {
        name: "wallet_export_markdown",
        description: "Exports wallet diagnostic report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_export_markdown", args);
        },
      },
      {
        name: "wallet_export_csv",
        description: "Exports wallet portfolios to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_export_csv", args);
        },
      },
      {
        name: "wallet_bulk_purge",
        description: "Atomically purges multiple wallet portfolios.",
        parameters: {
          addressesJson: { type: "string", required: true, description: "JSON array of addresses" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_bulk_purge", args);
        },
      },
      {
        name: "wallet_undo",
        description: "Reverts the last wallet mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_undo", args);
        },
      },
      {
        name: "wallet_redo",
        description: "Re-applies the last undone wallet mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_redo", args);
        },
      },
      {
        name: "wallet_capture_snapshot",
        description: "Captures a frame-perfect snapshot of wallet state in memory.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_capture_snapshot", args);
        },
      },
      {
        name: "wallet_restore_snapshot",
        description: "Restores wallet state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameIndex: { type: "number", required: true, description: "Frame index" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_restore_snapshot", args);
        },
      },
      {
        name: "wallet_validate_address",
        description: "Validates and checksums EVM or Solana wallet addresses.",
        parameters: {
          address: { type: "string", required: true, description: "Wallet address" },
          chain: { type: "string", description: "Blockchain. Default: base" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("wallet_validate_address", args);
        },
      },
    ];
  }

  public async executeTool(
    name: string,
    args: Record<string, unknown>,
    _cwd?: string
  ): Promise<{ success: boolean; data?: unknown; [key: string]: unknown; error?: string }> {
    try {
      switch (name) {
        case "wallet_manage_config": {
          const action = String(args.action || "get");
          if (action === "update" || args.enabled !== undefined || args.maxDailyTransferLimitUsd !== undefined) {
            const updates: Record<string, unknown> = {};
            if (typeof args.enabled === "boolean") updates.enabled = args.enabled;
            if (typeof args.maxDailyTransferLimitUsd === "number") updates.maxDailyTransferLimitUsd = args.maxDailyTransferLimitUsd;
            if (args.allowedChainsJson) {
              try {
                updates.allowedChains = JSON.parse(String(args.allowedChainsJson));
              } catch {
                return { success: false, error: "allowedChainsJson must be valid JSON" };
              }
            }
            const updated = this.supervisor.updateConfig(updates);
            return { success: true, config: updated };
          }
          return { success: true, config: this.supervisor.getConfig() };
        }

        case "wallet_get_portfolio": {
          const address = String(args.address || "").trim();
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const result = this.supervisor.getPortfolio(address, chain);
          return { ...result };
        }

        case "wallet_list_portfolios": {
          const portfolios = this.supervisor.getSubstrate().listPortfolios();
          return { success: true, count: portfolios.length, portfolios };
        }

        case "wallet_audit_allowances": {
          const address = String(args.address || "").trim();
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const result = this.supervisor.auditAllowances(address, chain);
          return { ...result };
        }

        case "wallet_simulate_transaction": {
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const fromAddress = String(args.fromAddress || "").trim();
          const toAddress = String(args.toAddress || "").trim();
          const valueNative = typeof args.valueNative === "number" ? args.valueNative : undefined;
          const result = this.supervisor.simulateTransaction({ chain, fromAddress, toAddress, valueNative });
          return { ...result };
        }

        case "wallet_get_swap_quote": {
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const fromTokenSymbol = String(args.fromTokenSymbol || "").trim();
          const toTokenSymbol = String(args.toTokenSymbol || "").trim();
          const amountIn = Number(args.amountIn || 0);
          const result = this.supervisor.getSwapQuote({
            chain,
            fromTokenAddress: "0x0000000000000000000000000000000000000000",
            fromTokenSymbol,
            toTokenAddress: "0x0000000000000000000000000000000000000000",
            toTokenSymbol,
            amountIn,
          });
          return { ...result };
        }

        case "wallet_inspect_contract": {
          const address = String(args.address || "").trim();
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const result = this.supervisor.inspectContract(address, chain);
          return { ...result };
        }

        case "wallet_get_defi_health": {
          const userAddress = String(args.userAddress || "").trim();
          const chain = (String(args.chain || "ethereum").toLowerCase()) as SupportedChain;
          const result = this.supervisor.getDeFiHealth(userAddress, chain);
          return { ...result };
        }

        case "wallet_audit_eip712_signature": {
          const chain = (String(args.chain || "ethereum").toLowerCase()) as SupportedChain;
          const userAddress = String(args.userAddress || "").trim();
          const domainName = String(args.domainName || "").trim();
          const verifyingContract = String(args.verifyingContract || "").trim();
          const primaryType = String(args.primaryType || "Permit") as any;
          const result = this.supervisor.auditEIP712Signature({
            chain,
            userAddress,
            domainName,
            verifyingContract,
            primaryType,
            messagePayload: {},
          });
          return { ...result };
        }

        case "wallet_get_gas_report": {
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const result = this.supervisor.getGasReport(chain);
          return { ...result };
        }

        case "wallet_manage_address_book": {
          const nameOrAddress = String(args.nameOrAddress || "").trim();
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const result = this.supervisor.resolveNameOrContact(nameOrAddress, chain);
          return { ...result };
        }

        case "wallet_get_bridge_quote": {
          const fromChain = (String(args.fromChain || "ethereum").toLowerCase()) as SupportedChain;
          const toChain = (String(args.toChain || "base").toLowerCase()) as SupportedChain;
          const tokenSymbol = String(args.tokenSymbol || "USDC").trim();
          const amount = Number(args.amount || 0);
          const recipientAddress = String(args.recipientAddress || "").trim();
          const result = this.supervisor.getBridgeQuote({
            fromChain,
            toChain,
            tokenSymbol,
            tokenAddress: "0x0000000000000000000000000000000000000000",
            amount,
            recipientAddress,
          });
          return { ...result };
        }

        case "wallet_simulate_user_op": {
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const senderSmartAccount = String(args.senderSmartAccount || "").trim();
          const targetContract = String(args.targetContract || "").trim();
          const callData = String(args.callData || "0x").trim();
          const result = this.supervisor.simulateUserOp({ chain, senderSmartAccount, targetContract, callData });
          return { ...result };
        }

        case "wallet_get_yield_report": {
          const userAddress = String(args.userAddress || "").trim();
          const chain = (String(args.chain || "ethereum").toLowerCase()) as SupportedChain;
          const result = this.supervisor.getYieldOptimizationReport(userAddress, chain);
          return { ...result };
        }

        case "wallet_stage_multisig_tx": {
          const safeAddress = String(args.safeAddress || "").trim();
          const chain = (String(args.chain || "ethereum").toLowerCase()) as SupportedChain;
          const thresholdRequired = Number(args.thresholdRequired || 2);
          const confirmationsJson = String(args.confirmationsJson || "[]");
          let confirmations: string[];
          try {
            confirmations = JSON.parse(confirmationsJson);
          } catch {
            return { success: false, error: "confirmationsJson must be valid JSON" };
          }
          const proposedActionSummary = String(args.proposedActionSummary || "").trim();
          const result = this.supervisor.stageMultiSigTransaction(safeAddress, chain, thresholdRequired, confirmations, proposedActionSummary);
          return { ...result };
        }

        case "wallet_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "wallet_get_metrics": {
          const metrics = this.supervisor.getMetrics();
          return { success: true, metrics };
        }

        case "wallet_group_and_sort": {
          const groupBy = (args.groupBy as WalletGroupBy) || "chain";
          const sortBy = (args.sortBy as WalletSortBy) || "value";
          const direction = (args.direction as WalletSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedPortfolios(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "wallet_search_dsl": {
          const query = String(args.query || "");
          const portfolios = this.supervisor.queryDsl(query);
          return { success: true, count: portfolios.length, portfolios };
        }

        case "wallet_render_dashboard": {
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderWalletDashboard(metrics);
          return { success: true, rendered };
        }

        case "wallet_render_card": {
          const address = String(args.address || "").trim();
          const chain = String(args.chain || "base");
          const portfolio = this.supervisor.getSubstrate().getPortfolio(address, chain);
          if (!portfolio) return { success: false, error: `Portfolio ${address} on ${chain} not found` };
          const rendered = BroccoliViewRenderer.renderWalletCard(portfolio);
          return { success: true, rendered };
        }

        case "wallet_export_html": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "wallet_export_markdown": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "wallet_export_csv": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "wallet_bulk_purge": {
          const addrsJson = String(args.addressesJson || "[]");
          let addrs: string[];
          try {
            addrs = JSON.parse(addrsJson);
          } catch {
            return { success: false, error: "addressesJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(addrs);
          return { success: true, result };
        }

        case "wallet_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "wallet_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "wallet_capture_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const snap = this.snapshotManager.captureSnapshot(frame);
          return { success: true, frameIndex: frame, snapshot: snap };
        }

        case "wallet_restore_snapshot": {
          const frame = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frame);
          return { ...res };
        }

        case "wallet_validate_address": {
          const address = String(args.address || "").trim();
          const chain = (String(args.chain || "base").toLowerCase()) as SupportedChain;
          const res = this.supervisor.getEngine().validateAndNormalizeAddress(address, chain);
          return { success: res.valid, ...res };
        }

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}
