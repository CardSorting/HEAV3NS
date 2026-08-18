/**
 * file-mutation-tool-suite.ts
 *
 * Model tool surface for Atomic File Mutation, Unified Patch Engine & VFS (Phase 77 / ADR-029 / Target #74):
 * 30 specialized model tools for applying unified diffs, atomic file writes, line replacements,
 * staging ledgers, DSL search, swimlanes, dashboards, and HTML/Markdown/CSV exporters.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  PatchMutationGroupBy,
  PatchMutationSortBy,
  PatchMutationSortDirection,
} from "../../../core/contracts/patch-mutation.contracts.js";
import { AtomicMutationSupervisor } from "../../../agents/extensions/patch/atomic-mutation-supervisor.js";
import { PatchSnapshotManager } from "../../../sessions/extensions/patch/patch-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";

export class FileMutationToolSuite {
  private readonly supervisor: AtomicMutationSupervisor;
  private readonly snapshotManager: PatchSnapshotManager;

  constructor(supervisor: AtomicMutationSupervisor) {
    this.supervisor = supervisor;
    this.snapshotManager = new PatchSnapshotManager(supervisor.getSubstrate());
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "patch_apply",
        description: "Applies a unified diff or V4A format patch across one or more files with transactional rollback on failure.",
        parameters: {
          patch: { type: "string", required: true, description: "Patch text in Unified Diff or V4A format" },
          dryRun: { type: "boolean", description: "Simulate patch application without mutating disk" },
        },
        execute: async (args: Record<string, unknown>, cwd = process.cwd()) => {
          return this.executeTool("patch_apply", args, cwd);
        },
      },
      {
        name: "patch_parse_unified",
        description: "Parses unified diff text into structured patch operations.",
        parameters: {
          diffText: { type: "string", required: true, description: "Unified diff string" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_parse_unified", args);
        },
      },
      {
        name: "patch_parse_v4a",
        description: "Parses V4A format patch text into structured patch operations.",
        parameters: {
          patchText: { type: "string", required: true, description: "V4A patch string" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_parse_v4a", args);
        },
      },
      {
        name: "file_view_paginated",
        description: "Views a text or code file with optional line-range pagination and truncation guards.",
        parameters: {
          filePath: { type: "string", required: true, description: "File path to view" },
          startLine: { type: "number", description: "1-indexed starting line number" },
          endLine: { type: "number", description: "1-indexed ending line number" },
        },
        execute: async (args: Record<string, unknown>, cwd = process.cwd()) => {
          return this.executeTool("file_view_paginated", args, cwd);
        },
      },
      {
        name: "file_replace_content",
        description: "Replaces a single contiguous block of code within a file with tolerance matching.",
        parameters: {
          filePath: { type: "string", required: true, description: "File to modify" },
          targetContent: { type: "string", required: true, description: "Exact lines to replace" },
          replacementContent: { type: "string", required: true, description: "New replacement content" },
        },
        execute: async (args: Record<string, unknown>, cwd = process.cwd()) => {
          return this.executeTool("file_replace_content", args, cwd);
        },
      },
      {
        name: "file_multi_replace",
        description: "Replaces multiple non-contiguous chunks in a single atomic transaction.",
        parameters: {
          filePath: { type: "string", required: true, description: "File to modify" },
          chunksJson: { type: "string", required: true, description: "JSON array of replacement chunks" },
        },
        execute: async (args: Record<string, unknown>, cwd = process.cwd()) => {
          return this.executeTool("file_multi_replace", args, cwd);
        },
      },
      {
        name: "file_write_atomic",
        description: "Atomically writes a complete file with auto-creation of parent directories.",
        parameters: {
          filePath: { type: "string", required: true, description: "Target file path" },
          content: { type: "string", required: true, description: "File content string" },
          overwrite: { type: "boolean", description: "Whether to overwrite existing file" },
        },
        execute: async (args: Record<string, unknown>, cwd = process.cwd()) => {
          return this.executeTool("file_write_atomic", args, cwd);
        },
      },
      {
        name: "patch_stage_file",
        description: "Stages a modified file content in the transactional memory substrate.",
        parameters: {
          filePath: { type: "string", required: true, description: "File path" },
          content: { type: "string", required: true, description: "Staged content" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_stage_file", args);
        },
      },
      {
        name: "patch_get_staged",
        description: "Retrieves a staged file mutation entry from memory.",
        parameters: {
          filePath: { type: "string", required: true, description: "File path" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_get_staged", args);
        },
      },
      {
        name: "patch_list_staged",
        description: "Lists all currently staged file mutations.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_list_staged", args);
        },
      },
      {
        name: "patch_unstage_file",
        description: "Unstages a file from the memory buffer.",
        parameters: {
          filePath: { type: "string", required: true, description: "File path" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_unstage_file", args);
        },
      },
      {
        name: "patch_commit_all",
        description: "Commits all staged file mutations to history and flushes staging buffer.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_commit_all", args);
        },
      },
      {
        name: "patch_revert_all",
        description: "Reverts all staged file mutations.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_revert_all", args);
        },
      },
      {
        name: "patch_audit_health",
        description: "Audits patch mutation transaction health, conflict counts, and active staged items.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_audit_health", args);
        },
      },
      {
        name: "patch_get_metrics",
        description: "Fetches aggregated mutation metrics, line counts, and bytes staged.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_get_metrics", args);
        },
      },
      {
        name: "patch_group_and_sort",
        description: "Organizes staged mutations into multi-criteria swimlanes (status, extension, directory).",
        parameters: {
          groupBy: { type: "string", description: "status, extension, directory" },
          sortBy: { type: "string", description: "timestamp, path, size" },
          direction: { type: "string", description: "asc or desc" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_group_and_sort", args);
        },
      },
      {
        name: "patch_search_dsl",
        description: "Searches staged mutations using Natural Query DSL (e.g. 'status:staged ext:.ts').",
        parameters: {
          query: { type: "string", required: true, description: "DSL query string" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_search_dsl", args);
        },
      },
      {
        name: "patch_render_dashboard",
        description: "Renders an ANSI CLI summary card with staged counts and health posture.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_render_dashboard", args);
        },
      },
      {
        name: "patch_render_operation_card",
        description: "Renders an interactive ANSI CLI patch operation card.",
        parameters: {
          filePath: { type: "string", required: true, description: "Target file path" },
          type: { type: "string", description: "Operation type" },
          hunksCount: { type: "number", description: "Number of hunks" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_render_operation_card", args);
        },
      },
      {
        name: "patch_export_html_view",
        description: "Exports staged file mutations ledger to a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_export_html_view", args);
        },
      },
      {
        name: "patch_export_markdown_report",
        description: "Exports staged mutations report to Markdown format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_export_markdown_report", args);
        },
      },
      {
        name: "patch_export_csv_report",
        description: "Exports staged file mutations to CSV format.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_export_csv_report", args);
        },
      },
      {
        name: "patch_bulk_purge",
        description: "Atomically purges multiple staged file mutations.",
        parameters: {
          pathsJson: { type: "string", required: true, description: "JSON array of file paths" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_bulk_purge", args);
        },
      },
      {
        name: "patch_bulk_commit",
        description: "Atomically commits all staged file mutations.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_bulk_commit", args);
        },
      },
      {
        name: "patch_undo",
        description: "Reverts the last file mutation from the undo stack.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_undo", args);
        },
      },
      {
        name: "patch_redo",
        description: "Re-applies the last undone file mutation.",
        parameters: {},
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_redo", args);
        },
      },
      {
        name: "patch_capture_snapshot",
        description: "Captures a frame-perfect snapshot of staged mutation state.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_capture_snapshot", args);
        },
      },
      {
        name: "patch_restore_snapshot",
        description: "Restores staged mutation state to a previous frame in < 0.05 ms SLA.",
        parameters: {
          frameId: { type: "number", required: true, description: "Frame ID" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_restore_snapshot", args);
        },
      },
      {
        name: "patch_format_entry",
        description: "Formats a mutation entry into a human-readable string.",
        parameters: {
          filePath: { type: "string", required: true, description: "Target file path" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_format_entry", args);
        },
      },
      {
        name: "patch_format_result",
        description: "Formats a patch apply result into a human-readable string.",
        parameters: {
          success: { type: "boolean", required: true, description: "Success status" },
          modifiedFilesJson: { type: "string", description: "JSON array of modified files" },
          dryRun: { type: "boolean", description: "Dry run mode" },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("patch_format_result", args);
        },
      },
    ];
  }

  public async executeTool(
    name: string,
    args: Record<string, unknown>,
    cwd = process.cwd()
  ): Promise<{ success: boolean; data?: unknown; [key: string]: unknown; error?: string }> {
    try {
      switch (name) {
        case "patch_apply": {
          const patchText = String(args.patch || "");
          const dryRun = Boolean(args.dryRun);
          const res = await this.supervisor.applyPatch(patchText, { dryRun, cwd });
          return { ...res };
        }

        case "patch_parse_unified": {
          const diffText = String(args.diffText || "");
          const ops = this.supervisor.getPatchEngine().parseUnifiedDiff(diffText);
          return { success: true, count: ops.length, operations: ops };
        }

        case "patch_parse_v4a": {
          const patchText = String(args.patchText || "");
          const ops = this.supervisor.getPatchEngine().parseV4APatch(patchText);
          return { success: true, count: ops.length, operations: ops };
        }

        case "file_view_paginated": {
          const filePath = String(args.filePath || "");
          const startLine = typeof args.startLine === "number" ? args.startLine : undefined;
          const endLine = typeof args.endLine === "number" ? args.endLine : undefined;
          const res = await this.supervisor.readPaginated({ filePath, startLine, endLine }, cwd);
          return { success: true, ...res };
        }

        case "file_replace_content": {
          const filePath = String(args.filePath || "");
          const targetContent = String(args.targetContent || "");
          const replacementContent = String(args.replacementContent || "");
          const res = await this.supervisor.applyReplaceContent({ filePath, targetContent, replacementContent }, cwd);
          return { ...res };
        }

        case "file_multi_replace": {
          const filePath = String(args.filePath || "");
          const chunksJson = String(args.chunksJson || "[]");
          const chunks = JSON.parse(chunksJson);
          const res = await this.supervisor.applyMultiReplace({ filePath, chunks }, cwd);
          return { ...res };
        }

        case "file_write_atomic": {
          const filePath = String(args.filePath || "");
          const content = String(args.content || "");
          const overwrite = typeof args.overwrite === "boolean" ? args.overwrite : true;
          const res = this.supervisor.writeAtomic(filePath, content, overwrite, cwd);
          return { ...res };
        }

        case "patch_stage_file": {
          const filePath = String(args.filePath || "");
          const content = String(args.content || "");
          const entry = this.supervisor.stageFile(filePath, content);
          return { success: true, entry };
        }

        case "patch_get_staged": {
          const filePath = String(args.filePath || "");
          const entry = this.supervisor.getSubstrate().getEntry(filePath);
          if (!entry) return { success: false, error: `Staged file '${filePath}' not found` };
          return { success: true, entry };
        }

        case "patch_list_staged": {
          const staged = this.supervisor.listStaged();
          return { success: true, count: staged.length, staged };
        }

        case "patch_unstage_file": {
          const filePath = String(args.filePath || "");
          const ok = this.supervisor.unstageFile(filePath);
          return { success: ok };
        }

        case "patch_commit_all": {
          const committed = this.supervisor.commitAll();
          return { success: true, count: committed.length, committed };
        }

        case "patch_revert_all": {
          const reverted = this.supervisor.revertAll();
          return { success: true, count: reverted.length, reverted };
        }

        case "patch_audit_health": {
          const audit = this.supervisor.auditHealth();
          return { success: true, audit };
        }

        case "patch_get_metrics": {
          const metrics = this.supervisor.getMetrics();
          return { success: true, metrics };
        }

        case "patch_group_and_sort": {
          const groupBy = (args.groupBy as PatchMutationGroupBy) || "status";
          const sortBy = (args.sortBy as PatchMutationSortBy) || "timestamp";
          const direction = (args.direction as PatchMutationSortDirection) || "desc";
          const lanes = this.supervisor.getGroupedMutations(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "patch_search_dsl": {
          const query = String(args.query || "");
          const entries = this.supervisor.queryDsl(query);
          return { success: true, count: entries.length, entries };
        }

        case "patch_render_dashboard": {
          const health = this.supervisor.auditHealth();
          const metrics = this.supervisor.getMetrics();
          const rendered = BroccoliViewRenderer.renderPatchMutationDashboard({
            totalStaged: metrics.totalStaged,
            totalCommitted: metrics.totalCommitted,
            totalReverted: metrics.totalReverted,
            totalBytesStaged: metrics.totalBytesStaged,
            healthStatus: health.healthStatus,
          });
          return { success: true, rendered };
        }

        case "patch_render_operation_card": {
          const filePath = String(args.filePath || "");
          const type = String(args.type || "update");
          const hunksCount = typeof args.hunksCount === "number" ? args.hunksCount : 1;
          const rendered = BroccoliViewRenderer.renderPatchOperationCard({
            filePath,
            type,
            hunksCount,
          });
          return { success: true, rendered };
        }

        case "patch_export_html_view": {
          const html = this.supervisor.exportHtml();
          return { success: true, html };
        }

        case "patch_export_markdown_report": {
          const markdown = this.supervisor.exportMarkdown();
          return { success: true, markdown };
        }

        case "patch_export_csv_report": {
          const csv = this.supervisor.exportCsv();
          return { success: true, csv };
        }

        case "patch_bulk_purge": {
          const pathsJson = String(args.pathsJson || "[]");
          let paths: string[];
          try {
            paths = JSON.parse(pathsJson);
          } catch {
            return { success: false, error: "pathsJson must be valid JSON" };
          }
          const result = this.supervisor.bulkPurge(paths);
          return { success: true, result };
        }

        case "patch_bulk_commit": {
          const result = this.supervisor.bulkCommit();
          return { success: true, result };
        }

        case "patch_undo": {
          const ok = this.supervisor.undo();
          return { success: ok };
        }

        case "patch_redo": {
          const ok = this.supervisor.redo();
          return { success: ok };
        }

        case "patch_capture_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const snap = this.snapshotManager.captureSnapshot(frameId);
          return { success: true, frameId, snapshot: snap };
        }

        case "patch_restore_snapshot": {
          const frameId = typeof args.frameId === "number" ? args.frameId : 1;
          const res = this.snapshotManager.restoreFrameSnapshot(frameId);
          return { ...res };
        }

        case "patch_format_entry": {
          const filePath = String(args.filePath || "");
          const entry = this.supervisor.getSubstrate().getEntry(filePath);
          if (!entry) return { success: false, error: `Staged file '${filePath}' not found` };
          const formatted = this.supervisor.getPatchEngine().formatMutationEntry(entry);
          return { success: true, formatted };
        }

        case "patch_format_result": {
          const success = Boolean(args.success);
          const dryRun = Boolean(args.dryRun);
          const modifiedFiles = args.modifiedFilesJson ? JSON.parse(String(args.modifiedFilesJson)) : [];
          const formatted = this.supervisor.getPatchEngine().formatPatchApplyResult({
            success,
            modifiedFiles,
            errors: [],
            dryRun,
          });
          return { success: true, formatted };
        }

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}
