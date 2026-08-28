import type {
  AcpClientToolDefinition,
  AcpDiagnosticItem,
  AcpDiffHunk,
  AcpMultiFileChangeset,
  AcpRollbackToken,
  AcpSessionInfo,
  AcpSessionMode,
  AcpWorkspaceFolder,
  IAcpBridgeServer,
  IAcpFineGrainedHunkPatcher,
  IAcpPermissionGate,
  IAcpProtocolCodec,
  IAcpSpeculativeChangesetStager,
  IBroccoliAcpSubstrate,
} from "../../../core/contracts/acp.contracts.js";

/**
 * High-Performance Agent Client Protocol (ACP) JSON-RPC 2.0 Bridge Server.
 *
 * Provides bidirectional editor synchronization, interactive pre-commit
 * adversarial diff scrutiny, 2PC speculative changeset staging, fine-grained hunk-level patching,
 * LSP-compatible diagnostic streaming, and client tool negotiation.
 */
export class AcpBridgeServer implements IAcpBridgeServer {
  private readonly codec: IAcpProtocolCodec;
  private readonly permissionGate: IAcpPermissionGate;
  private readonly substrate: IBroccoliAcpSubstrate;
  private readonly stager?: IAcpSpeculativeChangesetStager;
  private readonly hunkPatcher?: IAcpFineGrainedHunkPatcher;
  private readonly workspaceRoots = new Set<string>();
  private readonly activeCancellations = new Set<string>();
  private readonly clientTools = new Map<string, AcpClientToolDefinition>();

  constructor(
    codec: IAcpProtocolCodec,
    permissionGate: IAcpPermissionGate,
    substrate: IBroccoliAcpSubstrate,
    stager?: IAcpSpeculativeChangesetStager,
    hunkPatcher?: IAcpFineGrainedHunkPatcher
  ) {
    this.codec = codec;
    this.permissionGate = permissionGate;
    this.substrate = substrate;
    this.stager = stager;
    this.hunkPatcher = hunkPatcher;
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

  publishDiagnostics(uri: string, diagnostics: readonly AcpDiagnosticItem[]): string {
    return this.sendNotification("diagnostics/publish", {
      uri,
      diagnostics,
      timestamp: Date.now(),
    });
  }

  emitStreamChunk(sessionId: string, delta: string, isComplete = false): string {
    return this.sendNotification("session/chunk", {
      sessionId,
      delta,
      isComplete,
      timestamp: Date.now(),
    });
  }

  emitThoughtDelta(sessionId: string, thoughtDelta: string, stage = "reasoning"): string {
    return this.sendNotification("session/thought", {
      sessionId,
      thoughtDelta,
      stage,
      timestamp: Date.now(),
    });
  }

  getActiveSessions(): readonly AcpSessionInfo[] {
    return this.substrate.listSessions();
  }

  getWorkspaceRoots(): readonly string[] {
    return Array.from(this.workspaceRoots);
  }

  getClientTools(): readonly AcpClientToolDefinition[] {
    return Array.from(this.clientTools.values());
  }

  private async dispatchMethod(method: string, params: Record<string, unknown>): Promise<unknown> {
    switch (method) {
      case "initialize": {
        const clientName = typeof params.clientName === "string" ? params.clientName : "generic-ide";
        const rootUri = typeof params.rootUri === "string" ? params.rootUri : undefined;
        if (rootUri) {
          this.workspaceRoots.add(rootUri);
        }
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
            adversarialScrutiny: true,
            diagnosticStreaming: true,
            multiFileChangesets: true,
            speculativeTwoPhaseCommit: true,
            fineGrainedHunkPatching: true,
            clientTools: true,
          },
          implementation: {
            name: "LUMI-JOY-ACP-Engine",
            version: "1.0.13",
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
        if (!mode || !["architect", "code", "ask", "adversarial"].includes(mode)) {
          throw new Error(`Invalid mode '${mode}'. Must be 'architect', 'code', 'ask', or 'adversarial' (-32602)`);
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

      case "session/step":
      case "session/prompt": {
        const sessionId = String(params.sessionId ?? "");
        const prompt = String(params.prompt ?? "");
        if (!prompt) {
          throw new Error("Prompt is required (-32602)");
        }

        // Emit initial thought and stream chunk notifications
        this.emitThoughtDelta(sessionId, `Scrutinizing user request: "${prompt.slice(0, 50)}..."`, "planning");
        this.emitStreamChunk(sessionId, `Acknowledged: ${prompt.slice(0, 60)}...`, false);

        return {
          sessionId,
          outcome: "completed",
          response: `Processed ACP turn step: "${prompt.slice(0, 80)}"`,
          timestamp: Date.now(),
        };
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

      case "approval/scrutinize": {
        const filePath = String(params.filePath || "workspace_file");
        const diffSnippet = typeof params.diffSnippet === "string" ? params.diffSnippet : "";
        const risk = await this.permissionGate.scrutinizeEdit({ filePath, diffSnippet });
        return { risk };
      }

      case "transaction/prepare": {
        if (!this.stager) {
          throw new Error("2PC Speculative Stager not initialized (-32603)");
        }
        const sessionId = String(params.sessionId ?? "default_session");
        const title = String(params.title ?? "Speculative Patch");
        const changes = (params.changes as any[]) || [];
        const description = typeof params.description === "string" ? params.description : undefined;

        const prepResult = await this.stager.prepareTransaction(sessionId, title, changes, description);
        if (!prepResult.success) {
          throw new Error(prepResult.error || "Failed to prepare 2PC transaction (-32000)");
        }
        return { transaction: prepResult.transaction };
      }

      case "transaction/commit": {
        if (!this.stager) {
          throw new Error("2PC Speculative Stager not initialized (-32603)");
        }
        const transactionId = String(params.transactionId ?? "");
        const commitResult = await this.stager.commitTransaction(transactionId);
        if (!commitResult.success) {
          throw new Error(commitResult.error || "Failed to commit 2PC transaction (-32000)");
        }
        return { success: true, rollbackToken: commitResult.rollbackToken };
      }

      case "transaction/rollback": {
        if (!this.stager) {
          throw new Error("2PC Speculative Stager not initialized (-32603)");
        }
        const rollbackToken = params.rollbackToken as AcpRollbackToken;
        const rollbackResult = await this.stager.rollbackTransaction(rollbackToken);
        if (!rollbackResult.success) {
          throw new Error(rollbackResult.error || "Failed to rollback 2PC transaction (-32000)");
        }
        return { success: true };
      }

      case "workspace/roots": {
        return { roots: Array.from(this.workspaceRoots).map((r) => ({ uri: r, name: r.split("/").pop() || "root" })) };
      }

      case "workspace/didChangeWorkspaceFolders": {
        const added = (params.added as AcpWorkspaceFolder[]) || [];
        const removed = (params.removed as AcpWorkspaceFolder[]) || [];

        for (const a of added) {
          if (a.uri) this.workspaceRoots.add(a.uri);
        }
        for (const r of removed) {
          if (r.uri) this.workspaceRoots.delete(r.uri);
        }
        return { success: true, activeRootsCount: this.workspaceRoots.size };
      }

      case "changeset/create": {
        const changeset = params.changeset as unknown as AcpMultiFileChangeset;
        if (!changeset || !changeset.changesetId) {
          throw new Error("Invalid changeset object (-32602)");
        }
        const created = this.substrate.upsertChangeset(changeset);
        return { changeset: created };
      }

      case "changeset/list": {
        return { changesets: this.substrate.listChangesets() };
      }

      case "changeset/scrutinize": {
        const changesetId = String(params.changesetId ?? "");
        const changeset = this.substrate.getChangeset(changesetId);
        if (!changeset) {
          throw new Error(`Changeset '${changesetId}' not found (-32602)`);
        }
        const risk = await this.permissionGate.scrutinizeChangeset(changeset);
        const updated = this.substrate.upsertChangeset({ ...changeset, riskAssessment: risk });
        return { changeset: updated, risk };
      }

      case "hunk/list": {
        if (!this.hunkPatcher) {
          throw new Error("Fine-grained hunk patcher not initialized (-32603)");
        }
        const filePath = String(params.filePath || "file.ts");
        const originalContent = typeof params.originalContent === "string" ? params.originalContent : "";
        const diffText = typeof params.diffText === "string" ? params.diffText : "";
        const hunks = this.hunkPatcher.splitDiffIntoHunks(filePath, originalContent, diffText);
        return { hunks };
      }

      case "hunk/apply": {
        if (!this.hunkPatcher) {
          throw new Error("Fine-grained hunk patcher not initialized (-32603)");
        }
        const originalContent = typeof params.originalContent === "string" ? params.originalContent : "";
        const hunks = (params.hunks as AcpDiffHunk[]) || [];
        const selectedHunkIds = params.selectedHunkIds as string[] | undefined;
        const result = this.hunkPatcher.applySelectedHunks(originalContent, hunks, selectedHunkIds);
        return { result };
      }

      case "hunk/discard": {
        if (!this.hunkPatcher) {
          throw new Error("Fine-grained hunk patcher not initialized (-32603)");
        }
        const hunks = (params.hunks as AcpDiffHunk[]) || [];
        const hunkId = String(params.hunkId || "");
        const updatedHunks = this.hunkPatcher.discardHunk(hunks, hunkId);
        return { hunks: updatedHunks };
      }

      case "client/registerTools": {
        const tools = (params.tools as AcpClientToolDefinition[]) || [];
        for (const tool of tools) {
          if (tool.name) {
            this.clientTools.set(tool.name, tool);
          }
        }
        return { success: true, registeredCount: this.clientTools.size };
      }

      case "tools/list": {
        return { tools: Array.from(this.clientTools.values()) };
      }

      case "tools/call": {
        const name = String(params.name || "");
        const args = (params.arguments as Record<string, unknown>) || {};
        const callId = String(params.callId || `call_${Date.now()}`);

        if (!this.clientTools.has(name)) {
          return { callId, success: false, error: `Tool '${name}' not registered by client (-32601)` };
        }

        return {
          callId,
          success: true,
          result: { executedTool: name, args, status: "completed", timestamp: Date.now() },
        };
      }

      case "risk/list": {
        return { riskAudits: this.substrate.listRiskAudits() };
      }

      default:
        throw new Error(`Method '${method}' not found (-32601)`);
    }
  }

  private handleNotification(method: string, params?: Record<string, unknown>): void {
    if (method === "session/cancel" || method === "$/cancelRequest") {
      const sessionId = typeof params?.sessionId === "string" ? params.sessionId : String(params?.id || "");
      if (sessionId) {
        this.activeCancellations.add(sessionId);
      }
    }
  }
}
