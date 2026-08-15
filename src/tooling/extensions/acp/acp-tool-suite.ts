import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  AcpSessionMode,
  IAcpPermissionGate,
  IBroccoliAcpSubstrate,
} from "../../../core/contracts/acp.contracts.js";

/**
 * Model-Facing Tool Suite for ACP & IDE Bridge Operations.
 */
export class AcpToolSuite {
  private readonly permissionGate: IAcpPermissionGate;
  private readonly substrate: IBroccoliAcpSubstrate;

  constructor(permissionGate: IAcpPermissionGate, substrate: IBroccoliAcpSubstrate) {
    this.permissionGate = permissionGate;
    this.substrate = substrate;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "acp_request_approval",
        description: "Request user/IDE approval before modifying sensitive configuration or credential files.",
        parameters: {
          filePath: {
            type: "string",
            required: true,
            description: "Path to the file to be modified.",
          },
          diffSnippet: {
            type: "string",
            required: true,
            description: "Unified diff or description of proposed modifications.",
          },
          sessionId: {
            type: "string",
            required: false,
            description: "Current ACP session ID.",
          },
        },
        execute: async (args: Record<string, unknown>) => this.executeTool("acp_request_approval", args),
      },
      {
        name: "acp_inspect_session",
        description: "Inspect active ACP sessions, modes, working directories, and pending edit approvals.",
        parameters: {
          sessionId: {
            type: "string",
            required: false,
            description: "Target session ID to inspect, or omit to list all.",
          },
        },
        execute: async (args: Record<string, unknown>) => this.executeTool("acp_inspect_session", args),
      },
      {
        name: "acp_set_mode",
        description: "Switch active ACP session mode ('architect', 'code', or 'ask').",
        parameters: {
          sessionId: {
            type: "string",
            required: true,
            description: "Target ACP session ID.",
          },
          mode: {
            type: "string",
            required: true,
            description: "Session mode: 'architect', 'code', or 'ask'.",
          },
        },
        execute: async (args: Record<string, unknown>) => this.executeTool("acp_set_mode", args),
      },
    ];
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ success: boolean; result?: unknown; error?: string; executionTimeMs: number }> {
    const startedAt = Date.now();

    try {
      if (name === "acp_request_approval") {
        const filePath = String(args.filePath ?? "");
        const diffSnippet = String(args.diffSnippet ?? "");
        const sessionId = typeof args.sessionId === "string" ? args.sessionId : "default-session";

        const decision = await this.permissionGate.requestEditApproval({
          filePath,
          diffSnippet,
          sessionId,
          isSensitivePath: true,
        });

        return {
          success: true,
          result: decision,
          executionTimeMs: Date.now() - startedAt,
        };
      }

      if (name === "acp_inspect_session") {
        const sessionId = typeof args.sessionId === "string" ? args.sessionId : undefined;
        if (sessionId) {
          const session = this.substrate.getSession(sessionId);
          return {
            success: true,
            result: session ?? { error: `Session '${sessionId}' not found` },
            executionTimeMs: Date.now() - startedAt,
          };
        }

        return {
          success: true,
          result: {
            sessions: this.substrate.listSessions(),
            pendingApprovals: this.substrate.listPendingApprovals(),
            totalRpcCalls: this.substrate.getRpcCallCount(),
          },
          executionTimeMs: Date.now() - startedAt,
        };
      }

      if (name === "acp_set_mode") {
        const sessionId = String(args.sessionId ?? "");
        const mode = args.mode as AcpSessionMode;
        if (!mode || !["architect", "code", "ask"].includes(mode)) {
          return {
            success: false,
            error: `Invalid mode '${mode}'. Must be 'architect', 'code', or 'ask'.`,
            executionTimeMs: Date.now() - startedAt,
          };
        }

        const updated = this.substrate.updateSessionMode(sessionId, mode);
        if (!updated) {
          return {
            success: false,
            error: `Session '${sessionId}' not found.`,
            executionTimeMs: Date.now() - startedAt,
          };
        }

        return {
          success: true,
          result: { sessionId, mode },
          executionTimeMs: Date.now() - startedAt,
        };
      }

      return {
        success: false,
        error: `Unknown tool '${name}' in AcpToolSuite.`,
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
