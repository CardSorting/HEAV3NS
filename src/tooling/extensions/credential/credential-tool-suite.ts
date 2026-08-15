import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { ICredentialPool, CredentialRotationStrategy } from "../../../core/contracts/credential.contracts.js";

/**
 * Model-facing tool suite for credential pool inspection and rotation.
 */
export class CredentialToolSuite {
  private pool: ICredentialPool;

  constructor(pool: ICredentialPool) {
    this.pool = pool;
  }

  setPool(pool: ICredentialPool): void {
    this.pool = pool;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "auth_list_credentials",
        description: "List all configured provider credentials, health status, and token bucket allocations.",
        parameters: {
          provider: {
            type: "string",
            required: false,
            description: "Optional provider filter (e.g. 'openai', 'anthropic', 'openrouter').",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("auth_list_credentials", args);
        },
      },
      {
        name: "auth_add_credential",
        description: "Add a new API credential account into the failover pool.",
        parameters: {
          id: {
            type: "string",
            required: true,
            description: "Unique account identifier.",
          },
          provider: {
            type: "string",
            required: true,
            description: "Provider identifier (e.g. 'openai', 'anthropic').",
          },
          accountLabel: {
            type: "string",
            required: true,
            description: "Human-readable label for this account.",
          },
          apiKey: {
            type: "string",
            required: true,
            description: "Secret API key string.",
          },
          priority: {
            type: "number",
            required: false,
            description: "Priority ranking (higher integer has higher priority).",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("auth_add_credential", args);
        },
      },
      {
        name: "auth_rotate_credential",
        description: "Manually rotate to the next active credential account for a provider.",
        parameters: {
          provider: {
            type: "string",
            required: true,
            description: "Provider identifier.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("auth_rotate_credential", args);
        },
      },
      {
        name: "auth_circuit_status",
        description: "Inspect the circuit breaker status and cooldown states across all accounts.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("auth_circuit_status", args);
        },
      },
    ];
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      switch (name) {
        case "auth_list_credentials": {
          const provider = args.provider ? String(args.provider) : undefined;
          const accounts = this.pool.listAccounts(provider);
          return {
            success: true,
            data: accounts.map((a) => ({
              id: a.id,
              provider: a.provider,
              accountLabel: a.accountLabel,
              apiKeyMasked: a.apiKeyMasked,
              status: a.status,
              priority: a.priority,
              totalRequestsServed: a.totalRequestsServed,
              remainingTokens: a.tokenBucket.remainingTokens,
              consecutiveFailures: a.consecutiveFailures,
            })),
          };
        }
        case "auth_add_credential": {
          const id = String(args.id);
          const provider = String(args.provider);
          const accountLabel = String(args.accountLabel);
          const apiKey = String(args.apiKey);
          const priority = typeof args.priority === "number" ? args.priority : 1;

          const masked = apiKey.length > 8
            ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
            : "****";

          const created = this.pool.addAccount({
            id,
            provider,
            accountLabel,
            apiKeyMasked: masked,
            priority,
            weight: 1,
          });

          return { success: true, data: created };
        }
        case "auth_rotate_credential": {
          const provider = String(args.provider);
          const result = this.pool.selectAccount(provider);
          if (!result.account) {
            return { success: false, error: result.reason };
          }
          return { success: true, data: result.account };
        }
        case "auth_circuit_status": {
          const accounts = this.pool.listAccounts();
          return {
            success: true,
            data: {
              totalAccounts: accounts.length,
              healthy: accounts.filter((a) => a.status === "healthy").length,
              cooldown: accounts.filter((a) => a.status === "cooldown").length,
              exhausted: accounts.filter((a) => a.status === "exhausted").length,
              dead: accounts.filter((a) => a.status === "dead").length,
            },
          };
        }
        default:
          return { success: false, error: `Unknown auth tool '${name}'` };
      }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
