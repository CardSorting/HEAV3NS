/**
 * acp-supervisor.ts
 *
 * Supervisor orchestrator for the Agent Client Protocol (ACP) Subsystem (Phase 99 / ADR-129).
 * Governs editor sessions (VSCode, Cursor, JetBrains, Zed), multi-file changeset reviews,
 * diff approvals, command dispatch, and editor state synchronization.
 */

import type {
  AcpApprovalStatus,
  AcpClientCapabilities,
  AcpClientType,
  AcpDiffCard,
  AcpFileChange,
  AcpMultiFileChangeset,
  AcpServerConfig,
  AcpSession,
} from "../../../core/contracts/acp.contracts.js";
import { BroccoliAcpSubstrate } from "../../../sessions/extensions/acp/broccoli-acp-substrate.js";
import { DeterministicAcpEngine } from "../../../tooling/extensions/acp/deterministic-acp-engine.js";

export class AcpSupervisor {
  private readonly substrate: BroccoliAcpSubstrate;
  private readonly engine: DeterministicAcpEngine;

  constructor(substrate: BroccoliAcpSubstrate, engine: DeterministicAcpEngine) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public isSkillEnabled(): boolean {
    return this.substrate.getConfig().enabled;
  }

  public getConfig(): AcpServerConfig {
    return this.substrate.getConfig();
  }

  public updateConfig(updates: Partial<AcpServerConfig>): AcpServerConfig {
    return this.substrate.updateConfig(updates);
  }

  /**
   * Initializes or updates an active editor client session.
   */
  public initializeSession(
    sessionId: string,
    clientType: AcpClientType,
    clientVersion: string,
    workspaceRoot: string,
    capabilities: Partial<AcpClientCapabilities> = {}
  ): AcpSession {
    const fullCapabilities: AcpClientCapabilities = {
      streamingEdits: capabilities.streamingEdits ?? true,
      inlineDiffs: capabilities.inlineDiffs ?? true,
      terminalIntegration: capabilities.terminalIntegration ?? true,
      notificationActions: capabilities.notificationActions ?? true,
      multiFileChangesets: capabilities.multiFileChangesets ?? true,
    };

    const session: AcpSession = {
      sessionId,
      clientType,
      clientVersion,
      workspaceRoot,
      capabilities: fullCapabilities,
      connectedAt: Date.now(),
      lastHeartbeatAt: Date.now(),
    };

    if (this.isSkillEnabled()) {
      this.substrate.upsertSession(session);
    }

    return session;
  }

  /**
   * Stages a multi-file changeset for review and diff rendering.
   */
  public stageMultiFileChangeset(
    sessionId: string,
    title: string,
    rawFiles: readonly { filePath: string; originalContent?: string; modifiedContent: string; changeType?: "CREATE" | "MODIFY" | "DELETE" }[],
    description?: string
  ): { success: boolean; changeset?: AcpMultiFileChangeset; diffCard?: AcpDiffCard; error?: string } {
    if (!this.isSkillEnabled()) {
      return { success: false, error: "ACP skill is disabled by policy." };
    }

    const changesetId = `cs_${Date.now()}`;
    let totalAdditions = 0;
    let totalDeletions = 0;

    const files: AcpFileChange[] = rawFiles.map((f) => {
      const diff = this.engine.formatUnifiedDiff(f.originalContent, f.modifiedContent, f.filePath);
      totalAdditions += diff.additions;
      totalDeletions += diff.deletions;

      return {
        filePath: f.filePath,
        changeType: f.changeType || "MODIFY",
        originalContent: f.originalContent,
        modifiedContent: f.modifiedContent,
        additionsCount: diff.additions,
        deletionsCount: diff.deletions,
      };
    });

    const changeset: AcpMultiFileChangeset = {
      changesetId,
      sessionId,
      title,
      description,
      files,
      totalAdditions,
      totalDeletions,
      status: "PENDING",
      createdAt: Date.now(),
    };

    this.substrate.upsertChangeset(changeset);
    const diffCard = this.engine.compileDiffCard(changeset);

    return {
      success: true,
      changeset,
      diffCard,
    };
  }

  /**
   * Resolves a pending multi-file changeset approval.
   */
  public resolveEditApproval(
    changesetId: string,
    decision: AcpApprovalStatus
  ): { success: boolean; changeset?: AcpMultiFileChangeset; error?: string } {
    if (!this.isSkillEnabled()) {
      return { success: false, error: "ACP skill is disabled." };
    }

    const existing = this.substrate.getChangeset(changesetId);
    if (!existing) {
      return { success: false, error: `Changeset '${changesetId}' not found.` };
    }

    const updated: AcpMultiFileChangeset = {
      ...existing,
      status: decision,
      resolvedAt: Date.now(),
    };

    this.substrate.upsertChangeset(updated);
    return { success: true, changeset: updated };
  }

  public getChangeset(changesetId: string): AcpMultiFileChangeset | undefined {
    return this.substrate.getChangeset(changesetId);
  }

  public listChangesets(): readonly AcpMultiFileChangeset[] {
    return this.substrate.listChangesets();
  }

  public getSession(sessionId: string): AcpSession | undefined {
    return this.substrate.getModernSession(sessionId);
  }

  public listSessions(): readonly AcpSession[] {
    return this.substrate.listModernSessions();
  }

  public updateEditorCoordinates(sessionId: string, activeDocument: string, line: number, character: number): boolean {
    const session = this.substrate.getModernSession(sessionId);
    if (!session) return false;

    const updated: AcpSession = {
      ...session,
      activeDocument,
      cursorPosition: { line, character },
      lastHeartbeatAt: Date.now(),
    };

    this.substrate.upsertSession(updated);
    return true;
  }
}
