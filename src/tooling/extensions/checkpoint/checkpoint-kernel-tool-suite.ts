/**
 * checkpoint-kernel-tool-suite.ts
 *
 * Model tool surface for Content-Addressable Blob Store & Checkpoint Kernel (Phase 87 / ADR-039).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { CheckpointKernelSupervisor } from "../../../agents/extensions/checkpoint/checkpoint-kernel-supervisor.js";

export class CheckpointKernelToolSuite {
  private readonly supervisor: CheckpointKernelSupervisor;

  constructor(supervisor: CheckpointKernelSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "create_checkpoint",
        description: "Creates an immutable content-addressable Merkle tree checkpoint of workspace files with a commit message.",
        parameters: {
          message: { type: "string", required: true, description: "Commit message describing the checkpoint" },
          filesJson: { type: "string", required: true, description: "JSON array of files [{path: 'string', content: 'string'}]" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const message = String(args.message || "").trim();
          if (!message) return { success: false, error: "message parameter is required" };

          const filesJson = String(args.filesJson || "").trim();
          if (!filesJson) return { success: false, error: "filesJson parameter is required" };

          let files: { path: string; content: string }[];
          try {
            files = JSON.parse(filesJson) as { path: string; content: string }[];
            if (!Array.isArray(files)) {
              return { success: false, error: "filesJson must be a JSON array" };
            }
          } catch (err: unknown) {
            return { success: false, error: `Invalid JSON files: ${err instanceof Error ? err.message : String(err)}` };
          }

          const filePayloads = files.map((f) => ({
            path: f.path,
            data: f.content,
          }));

          const commit = this.supervisor.checkpoint(message, filePayloads);

          return {
            success: true,
            checkpointId: commit.id,
            treeHash: commit.treeHash,
            fileCount: commit.stats.fileCount,
            byteCount: commit.stats.byteCount,
            timestamp: commit.timestamp,
          };
        },
      },
      {
        name: "rollback_checkpoint",
        description: "Rolls back the workspace state to a previous Merkle tree checkpoint commit ID.",
        parameters: {
          checkpointId: { type: "string", required: true, description: "The commit ID of the checkpoint to restore" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const checkpointId = String(args.checkpointId || "").trim();
          if (!checkpointId) return { success: false, error: "checkpointId parameter is required" };

          const rollbackResult = this.supervisor.rollback(checkpointId);

          return {
            success: rollbackResult.success,
            checkpointId,
            restoredFilesCount: rollbackResult.restoredFiles.length,
            durationMs: rollbackResult.durationMs,
            error: rollbackResult.error,
          };
        },
      },
      {
        name: "checkpoint_status",
        description: "Queries the checkpoint commit DAG history, current HEAD, and Content-Addressable Storage (CAS) stats.",
        parameters: {
          limit: { type: "number", description: "Maximum number of historical checkpoints to return (default: 10)" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const limit = typeof args.limit === "number" ? args.limit : 10;
          const stats = this.supervisor.getStats();
          const history = this.supervisor.listCheckpoints(limit);

          return {
            success: true,
            stats,
            history,
          };
        },
      },
    ];
  }
}
