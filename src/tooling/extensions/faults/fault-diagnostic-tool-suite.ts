import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  IBroccoliFaultSubstrate,
  IFaultRecoverySupervisor,
} from "../../../core/contracts/fault.contracts.js";

/**
 * Model-Facing Tool Suite for Fault Diagnostics & Provider Health.
 */
export class FaultDiagnosticToolSuite {
  private readonly supervisor: IFaultRecoverySupervisor;
  private readonly substrate: IBroccoliFaultSubstrate;

  constructor(supervisor: IFaultRecoverySupervisor, substrate: IBroccoliFaultSubstrate) {
    this.supervisor = supervisor;
    this.substrate = substrate;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "fault_inspect_error",
        description: "Classify an API error and determine the optimal recovery directive (retry, rotate, fallback, compress, abort).",
        parameters: {
          errorMessage: {
            type: "string",
            required: true,
            description: "Error message or status description to classify.",
          },
          statusCode: {
            type: "number",
            required: false,
            description: "Optional HTTP status code (e.g. 429, 401, 500).",
          },
          provider: {
            type: "string",
            required: false,
            description: "Target LLM provider name (e.g. 'openai', 'anthropic').",
          },
        },
        execute: async (args: Record<string, unknown>) => this.executeTool("fault_inspect_error", args),
      },
      {
        name: "fault_query_provider_health",
        description: "Query provider health metrics, consecutive failure runs, and cooldown states.",
        parameters: {
          provider: {
            type: "string",
            required: false,
            description: "Specific provider to query, or omit to list all.",
          },
        },
        execute: async (args: Record<string, unknown>) => this.executeTool("fault_query_provider_health", args),
      },
      {
        name: "fault_reset_history",
        description: "Reset all fault counts and provider cooldown states.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => this.executeTool("fault_reset_history", args),
      },
    ];
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ success: boolean; result?: unknown; error?: string; executionTimeMs: number }> {
    const startedAt = Date.now();

    try {
      if (name === "fault_inspect_error") {
        const errorMessage = String(args.errorMessage ?? "");
        const statusCode = typeof args.statusCode === "number" ? args.statusCode : undefined;
        const provider = typeof args.provider === "string" ? args.provider : undefined;

        const classified = this.supervisor.evaluateRecovery(new Error(errorMessage), {
          statusCode,
          provider,
        });

        return {
          success: true,
          result: {
            category: classified.category,
            directive: classified.directive,
            statusCode: classified.statusCode,
            retryable: classified.retryable,
            suggestedBackoffMs: classified.suggestedBackoffMs,
            message: classified.message,
          },
          executionTimeMs: Date.now() - startedAt,
        };
      }

      if (name === "fault_query_provider_health") {
        const provider = typeof args.provider === "string" ? args.provider : undefined;
        if (provider) {
          const health = this.substrate.getProviderHealth(provider);
          return {
            success: true,
            result: health ?? { provider, status: "healthy_no_history" },
            executionTimeMs: Date.now() - startedAt,
          };
        }

        const allHealth = this.substrate.listProviderHealth();
        return {
          success: true,
          result: {
            totalFaultsRecorded: this.substrate.getTotalFaultCount(),
            providers: allHealth,
          },
          executionTimeMs: Date.now() - startedAt,
        };
      }

      if (name === "fault_reset_history") {
        this.substrate.clear();
        return {
          success: true,
          result: { message: "Fault history and cooldown states cleared." },
          executionTimeMs: Date.now() - startedAt,
        };
      }

      return {
        success: false,
        error: `Unknown tool '${name}' in FaultDiagnosticToolSuite.`,
        executionTimeMs: Date.now() - startedAt,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        executionTimeMs: Date.now() - startedAt,
      };
    }
  }
}
