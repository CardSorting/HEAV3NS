/**
 * cost-governance-tool-suite.ts
 *
 * Model tool suite exposing cost estimation and budget queries (Phase 90 / ADR-042).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { CostGovernanceSupervisor } from "../../../agents/extensions/cost/cost-governance-supervisor.js";

export class CostGovernanceToolSuite {
  private supervisor: CostGovernanceSupervisor;

  constructor(supervisor: CostGovernanceSupervisor) {
    this.supervisor = supervisor;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "cost_estimate_turn",
        description: "Pre-flight estimates the token cost for a planned model turn against the pricing catalog.",
        parameters: {
          modelId: {
            type: "string",
            description: "The target model identifier (e.g., 'gpt-4o', 'claude-3-5-sonnet', 'deepseek-chat')",
            required: true,
          },
          promptTokens: {
            type: "number",
            description: "Estimated prompt token count",
            required: true,
          },
          completionTokens: {
            type: "number",
            description: "Estimated completion token count",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const modelId = typeof args.modelId === "string" ? args.modelId : "gpt-4o";
          const promptTokens = typeof args.promptTokens === "number" ? args.promptTokens : 0;
          const completionTokens = typeof args.completionTokens === "number" ? args.completionTokens : 0;

          const preflight = this.supervisor.evaluatePreFlight(promptTokens, completionTokens, modelId);
          return {
            success: preflight.allowed,
            modelId,
            estimatedCostUsd: preflight.estimatedCostUsd,
            formattedCostLabel: preflight.formattedCostLabel,
            totalSessionCostUsd: preflight.totalSessionCostUsd,
            remainingBudgetUsd: preflight.remainingBudgetUsd,
            hardCapBreached: preflight.hardCapBreached,
            breachReason: preflight.breachReason,
          };
        },
      },
      {
        name: "cost_budget_status",
        description: "Queries the current session token consumption, cumulative dollar cost, and budget ceiling status.",
        parameters: {},
        execute: async () => {
          const stats = this.supervisor.getStats();
          const recentLedger = this.supervisor.listLedger(10);
          return {
            success: true,
            stats,
            recentLedger,
          };
        },
      },
    ];
  }
}
