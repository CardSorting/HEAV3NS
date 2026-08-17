/**
 * deterministic-acp-engine.ts
 *
 * Deterministic JSON-RPC 2.0 protocol engine for Agent Client Protocol (Phase 99 / ADR-129).
 * Formats multi-file changesets, unified diff previews, line-numbered changes, and interactive approval cards.
 */

import type {
  AcpDiffCard,
  AcpFileChange,
  AcpMultiFileChangeset,
  AcpRpcRequest,
  AcpRpcResponse,
} from "../../../core/contracts/acp.contracts.js";

export class DeterministicAcpEngine {
  /**
   * Parses JSON-RPC 2.0 requests from editors.
   */
  public parseRpcRequest(rawJson: string): AcpRpcRequest | undefined {
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed.jsonrpc !== "2.0" || !parsed.method || parsed.id === undefined) {
        return undefined;
      }
      return {
        jsonrpc: "2.0",
        id: parsed.id,
        method: String(parsed.method),
        params: parsed.params,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Creates standard JSON-RPC 2.0 response envelope.
   */
  public createRpcResponse(
    id: string | number,
    result?: Record<string, unknown>,
    error?: { code: number; message: string; data?: unknown }
  ): AcpRpcResponse {
    if (error) {
      return {
        jsonrpc: "2.0",
        id,
        error,
      };
    }
    return {
      jsonrpc: "2.0",
      id,
      result: result || {},
    };
  }

  /**
   * Generates a line-by-line unified diff and counts additions/deletions.
   */
  public formatUnifiedDiff(
    original = "",
    modified = "",
    filePath = "file.ts"
  ): { diffText: string; additions: number; deletions: number } {
    const origLines = original.split("\n");
    const modLines = modified.split("\n");

    let additions = 0;
    let deletions = 0;
    let diff = `--- a/${filePath}\n+++ b/${filePath}\n`;

    const maxLines = Math.max(origLines.length, modLines.length);

    for (let i = 0; i < maxLines; i++) {
      const orig = origLines[i];
      const mod = modLines[i];

      if (orig === undefined && mod !== undefined) {
        diff += `+ ${mod}\n`;
        additions++;
      } else if (orig !== undefined && mod === undefined) {
        diff += `- ${orig}\n`;
        deletions++;
      } else if (orig !== mod) {
        diff += `- ${orig}\n`;
        diff += `+ ${mod}\n`;
        additions++;
        deletions++;
      } else {
        diff += `  ${orig}\n`;
      }
    }

    return { diffText: diff, additions, deletions };
  }

  /**
   * Compiles an approachable multi-file changeset review card mirroring Cursor Composer.
   */
  public compileDiffCard(changeset: AcpMultiFileChangeset): AcpDiffCard {
    const statusEmoji = changeset.status === "ACCEPTED" ? "✅" : changeset.status === "REJECTED" ? "❌" : "⏳";
    const summaryText = `${statusEmoji} *Multi-File Changeset: ${changeset.title}*\n` +
      `Status: *${changeset.status}* • Files: *${changeset.files.length}* • \`+${changeset.totalAdditions} / -${changeset.totalDeletions}\` lines`;

    let filesListText = "📁 *Changed Files:*\n";
    for (const f of changeset.files) {
      filesListText += `• \`${f.filePath}\` (\`+${f.additionsCount} / -${f.deletionsCount}\`)\n`;
    }

    let formattedDiffText = "```diff\n";
    for (const f of changeset.files) {
      formattedDiffText += `# ${f.filePath} (${f.changeType})\n`;
      const diff = this.formatUnifiedDiff(f.originalContent, f.modifiedContent, f.filePath);
      formattedDiffText += diff.diffText + "\n";
    }
    formattedDiffText += "```";

    const actionButtons: AcpDiffCard["actionButtons"] = [
      { actionId: `acp_accept_${changeset.changesetId}`, label: "✅ Accept All", style: "primary" },
      { actionId: `acp_reject_${changeset.changesetId}`, label: "❌ Reject All", style: "danger" },
      { actionId: `acp_details_${changeset.changesetId}`, label: "🔍 Review Files", style: "secondary" },
    ];

    return {
      changesetId: changeset.changesetId,
      summaryText,
      filesListText,
      formattedDiffText,
      actionButtons,
    };
  }
}
