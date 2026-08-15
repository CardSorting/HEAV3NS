import type {
  AcpSessionInfo,
  AcpSessionMode,
  IAcpBridgeServer,
  IAcpPermissionGate,
  IAcpProtocolCodec,
  IBroccoliAcpSubstrate,
} from "../../../core/contracts/acp.contracts.js";

/**
 * High-Performance Agent Client Protocol (ACP) JSON-RPC 2.0 Bridge Server.
 */
export class AcpBridgeServer implements IAcpBridgeServer {
  private readonly codec: IAcpProtocolCodec;
  private readonly permissionGate: IAcpPermissionGate;
  private readonly substrate: IBroccoliAcpSubstrate;

  constructor(
    codec: IAcpProtocolCodec,
    permissionGate: IAcpPermissionGate,
    substrate: IBroccoliAcpSubstrate
  ) {
    this.codec = codec;
    this.permissionGate = permissionGate;
    this.substrate = substrate;
  }

  async handleRpcMessage(rawJson: string): Promise<string | undefined> {
    this.substrate.incrementRpcCallCount();

    let message;
    try {
      message = this.codec.parseMessage(rawJson);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.codec.encodeError(0, -32700, msg);
    }

    if (!("id" in message) || message.id === undefined) {
      // It's a notification from client (e.g. session/cancel)
      this.handleNotification(message.method, message.params);
      return undefined;
    }

    const { id, method, params } = message;

    try {
      const result = await this.dispatchMethod(method, params ?? {});
      return this.codec.encodeResponse(id, result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.codec.encodeError(id, -32603, msg);
    }
  }

  sendNotification(method: string, params?: Record<string, unknown>): string {
    return this.codec.encodeNotification(method, params);
  }

  getActiveSessions(): readonly AcpSessionInfo[] {
    return this.substrate.listSessions();
  }

  private async dispatchMethod(method: string, params: Record<string, unknown>): Promise<unknown> {
    switch (method) {
      case "initialize": {
        const clientName = typeof params.clientName === "string" ? params.clientName : "generic-ide";
        return {
          protocolVersion: "2026-03-01",
          agentCapabilities: {
            prompts: true,
            streaming: true,
            sessions: {
              list: true,
              fork: true,
              resume: true,
            },
            editApproval: true,
          },
          implementation: {
            name: "LUMI-JOY-ACP-Engine",
            version: "0.1.0",
            clientName,
          },
        };
      }

      case "session/new": {
        const sessionId = typeof params.sessionId === "string"
          ? params.sessionId
          : `acp-session-${Date.now()}`;
        const mode = (params.mode as AcpSessionMode) ?? "code";
        const cwd = typeof params.cwd === "string" ? params.cwd : process.cwd();
        const clientName = typeof params.clientName === "string" ? params.clientName : undefined;

        const info = this.substrate.createSession(sessionId, mode, cwd, clientName);
        return { session: info };
      }

      case "session/get":
      case "session/load": {
        const sessionId = String(params.sessionId ?? "");
        const session = this.substrate.getSession(sessionId);
        if (!session) {
          throw new Error(`Session '${sessionId}' not found (-32602)`);
        }
        return { session };
      }

      case "session/list": {
        return { sessions: this.substrate.listSessions() };
      }

      case "session/set_mode": {
        const sessionId = String(params.sessionId ?? "");
        const mode = params.mode as AcpSessionMode;
        if (!mode || !["architect", "code", "ask"].includes(mode)) {
          throw new Error(`Invalid mode '${mode}'. Must be 'architect', 'code', or 'ask' (-32602)`);
        }
        const updated = this.substrate.updateSessionMode(sessionId, mode);
        if (!updated) {
          throw new Error(`Session '${sessionId}' not found (-32602)`);
        }
        return { success: true, sessionId, mode };
      }

      case "session/fork": {
        const parentSessionId = String(params.parentSessionId ?? "");
        const parent = this.substrate.getSession(parentSessionId);
        if (!parent) {
          throw new Error(`Parent session '${parentSessionId}' not found (-32602)`);
        }
        const newSessionId = typeof params.newSessionId === "string"
          ? params.newSessionId
          : `${parentSessionId}-fork-${Date.now()}`;
        const child = this.substrate.createSession(
          newSessionId,
          parent.mode,
          parent.workingDirectory,
          parent.clientName
        );
        return { session: child, parentSessionId };
      }

      case "approval/decision": {
        const approvalId = String(params.approvalId ?? "");
        const approved = Boolean(params.approved);
        const reason = typeof params.reason === "string" ? params.reason : undefined;

        const submitted = this.permissionGate.submitApprovalDecision({
          approvalId,
          approved,
          reason,
        });

        if (!submitted) {
          throw new Error(`Pending approval '${approvalId}' not found or already resolved (-32602)`);
        }
        return { success: true, approvalId, approved };
      }

      case "approval/pending": {
        return { pendingApprovals: this.substrate.listPendingApprovals() };
      }

      default:
        throw new Error(`Method '${method}' not found (-32601)`);
    }
  }

  private handleNotification(method: string, _params?: Record<string, unknown>): void {
    // Notifications like session/cancel
    if (method === "session/cancel") {
      // In-flight cancellation hook
    }
  }
}
