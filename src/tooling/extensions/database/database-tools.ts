/**
 * [LAYER: TOOLING EXTENSION]
 * database-tools.ts
 *
 * Model tool suite exposing Hybrid In-Memory + Handrolled BroccoliDB Kernel operations
 * (Phase 71 / ADR-120).
 *
 * Exposes db_inspect_status, db_query_table, db_checkpoint_wal, db_cas_audit,
 * db_timeline_history, and db_rollback_timeline to the model tool registry.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { BroccoliDatabaseKernel } from "../../../sessions/extensions/substrate/broccolidb-kernel.js";

export class DatabaseToolSuite {
  private readonly kernel: BroccoliDatabaseKernel;

  constructor(kernel: BroccoliDatabaseKernel) {
    this.kernel = kernel;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "db_inspect_status",
        description:
          "Inspects the BroccoliDB Zenith hybrid database health, including 4-pillar diagnostic probe, memory tables, WAL uncommitted frames, CAS vault size, and compression stats.",
        parameters: {},
        execute: async () => {
          const health = await this.kernel.health();
          const checkpoints = this.kernel.listCheckpoints();

          return {
            success: true,
            status: health.status,
            timestamp: health.timestamp,
            pillars: health.pillars,
            checkpointCount: checkpoints.length,
            latestCheckpoint: checkpoints[0]?.checkpointId ?? null,
            actionableRecommendations: health.actionableRecommendations,
          };
        },
      },
      {
        name: "db_query_table",
        description:
          "Executes a fast indexed predicate query against a BroccoliDB in-memory reactive table with optional filters, sorting, and pagination.",
        parameters: {
          table: {
            type: "string",
            description: "The name of the database table to query (e.g., 'sessions', 'goals', 'skills', 'kanban_cards')",
            required: true,
          },
          where: {
            type: "string",
            description: "Optional JSON-encoded key-value predicate filters (e.g. '{\"status\":\"active\"}')",
            required: false,
          },
          limit: {
            type: "number",
            description: "Maximum number of records to return",
            required: false,
          },
          offset: {
            type: "number",
            description: "Number of records to skip",
            required: false,
          },
          sortBy: {
            type: "string",
            description: "Field name to sort by",
            required: false,
          },
          sortOrder: {
            type: "string",
            description: "'asc' or 'desc'",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const tableName = typeof args.table === "string" ? args.table : "default";
          let where: Record<string, unknown> | undefined;
          if (typeof args.where === "string") {
            try {
              where = JSON.parse(args.where);
            } catch {
              where = undefined;
            }
          } else if (args.where && typeof args.where === "object") {
            where = args.where as Record<string, unknown>;
          }

          const limit = typeof args.limit === "number" ? args.limit : undefined;
          const offset = typeof args.offset === "number" ? args.offset : undefined;
          const sortBy = typeof args.sortBy === "string" ? args.sortBy : undefined;
          const sortOrder = args.sortOrder === "desc" ? "desc" : "asc";

          const table = this.kernel.getTable(tableName);
          const records = table.query({ where, limit, offset, sortBy, sortOrder });

          return {
            success: true,
            table: tableName,
            matchedCount: records.length,
            totalRecordsInTable: table.count(),
            records,
          };
        },
      },
      {
        name: "db_checkpoint_wal",
        description:
          "Forces an immediate atomic WAL flush, creates a double-buffered base state snapshot, and rotates the Write-Ahead Log.",
        parameters: {
          label: {
            type: "string",
            description: "A descriptive label for this checkpoint milestone",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const label = typeof args.label === "string" ? args.label : "model_checkpoint";
          const checkpoint = await this.kernel.checkpoint(label);

          return {
            success: true,
            checkpointId: checkpoint.checkpointId,
            frameIndex: checkpoint.frameIndex,
            timestamp: checkpoint.timestamp,
            label: checkpoint.label,
            tableCount: checkpoint.tableCount,
            totalRecords: checkpoint.totalRecords,
            snapshotHash: checkpoint.snapshotHash,
          };
        },
      },
      {
        name: "db_cas_audit",
        description:
          "Executes a cryptographic integrity audit across the Content-Addressable Storage (CAS) vault, quarantines any corrupt blobs, and optionally executes garbage collection.",
        parameters: {
          runGc: {
            type: "boolean",
            description: "Whether to execute mark-sweep garbage collection for unreferenced blobs",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const runGc = Boolean(args.runGc);
          let prunedCount = 0;
          if (runGc) {
            prunedCount = await this.kernel.gc();
          }

          const health = await this.kernel.health();
          return {
            success: true,
            casIntegrity: health.pillars.casIntegrity,
            garbageCollectedBlobs: prunedCount,
            healthy: health.pillars.casIntegrity.healthy,
          };
        },
      },
      {
        name: "db_timeline_history",
        description:
          "Lists all available historical timeline checkpoints for time-travel state rollback.",
        parameters: {},
        execute: async () => {
          const checkpoints = this.kernel.listCheckpoints();
          return {
            success: true,
            totalCheckpoints: checkpoints.length,
            checkpoints,
          };
        },
      },
      {
        name: "db_rollback_timeline",
        description:
          "Restores the entire database world state to a prior timeline checkpoint with frame-perfect precision.",
        parameters: {
          checkpointId: {
            type: "string",
            description: "The unique identifier of the checkpoint to rollback to",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const checkpointId = typeof args.checkpointId === "string" ? args.checkpointId : "";
          if (!checkpointId) {
            return { success: false, error: "checkpointId is required" };
          }

          const success = await this.kernel.rollback(checkpointId);
          return {
            success,
            checkpointId,
            message: success
              ? `Successfully rolled back database world state to ${checkpointId}.`
              : `Checkpoint ${checkpointId} not found or corrupted.`,
          };
        },
      },
    ];
  }
}
