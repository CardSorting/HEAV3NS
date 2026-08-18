/**
 * checkpoint-kernel-tool-suite.ts
 *
 * Model tool surface for Content-Addressable Blob Store & Checkpoint Kernel:
 * 30 specialized model tools for immutable Merkle checkpoints, rollbacks, CAS inspections,
 * 256-shard partitioning, Bloom probes, cherry-picking, reverts, bisecting, line blaming,
 * rebasing, squashing, Git bundle import/export, and interactive exports (Phase 87 / ADR-039).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { CheckpointKernelSupervisor } from "../../../agents/extensions/checkpoint/checkpoint-kernel-supervisor.js";
import { BroccoliCheckpointSubstrate } from "../../../sessions/extensions/checkpoint/broccoli-checkpoint-substrate.js";
import { DeterministicCasStore } from "./deterministic-cas-store.js";
import { CheckpointSnapshotManager } from "../../../sessions/extensions/checkpoint/checkpoint-snapshot-manager.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";
import type {
  CheckpointGroupBy,
  CheckpointSortBy,
  CheckpointSortDirection,
  GitBundlePayload,
} from "../../../core/contracts/checkpoint.contracts.js";

export class CheckpointKernelToolSuite {
  private readonly supervisor: CheckpointKernelSupervisor;
  private readonly substrate: BroccoliCheckpointSubstrate;
  private readonly store: DeterministicCasStore;
  private readonly snapshotManager: CheckpointSnapshotManager;

  constructor(
    supervisor?: CheckpointKernelSupervisor,
    substrate?: BroccoliCheckpointSubstrate,
    store?: DeterministicCasStore
  ) {
    this.store = store ?? new DeterministicCasStore();
    this.substrate = substrate ?? new BroccoliCheckpointSubstrate();
    this.supervisor = supervisor ?? new CheckpointKernelSupervisor(this.store, this.substrate);
    this.snapshotManager = new CheckpointSnapshotManager(this.substrate);
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "create_checkpoint",
        description: "Creates an immutable content-addressable Merkle tree checkpoint of workspace files with a commit message.",
        parameters: {
          message: { type: "string", required: true, description: "Commit message describing the checkpoint" },
          filesJson: { type: "string", required: true, description: "JSON array of files [{path: 'string', content: 'string'}]" },
          frameIndex: { type: "number", description: "Frame index number" },
          branchName: { type: "string", description: "Target branch name" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("create_checkpoint", args);
        },
      },
      {
        name: "rollback_checkpoint",
        description: "Rolls back the workspace state to a previous Merkle tree checkpoint commit ID.",
        parameters: {
          checkpointId: { type: "string", required: true, description: "The commit ID of the checkpoint to restore" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("rollback_checkpoint", args);
        },
      },
      {
        name: "rollback_dry_run",
        description: "Pre-flight preview of files and bytes that would be modified on rolling back to a checkpoint.",
        parameters: {
          checkpointId: { type: "string", required: true, description: "The commit ID of the checkpoint to test" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("rollback_dry_run", args);
        },
      },
      {
        name: "get_checkpoint",
        description: "Retrieves metadata for a specific checkpoint commit ID.",
        parameters: {
          checkpointId: { type: "string", required: true, description: "Commit ID to retrieve" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("get_checkpoint", args);
        },
      },
      {
        name: "list_checkpoints",
        description: "Lists historical checkpoint commits in chronological order.",
        parameters: {
          limit: { type: "number", description: "Maximum commits to return (default: 20)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("list_checkpoints", args);
        },
      },
      {
        name: "inspect_cas_store",
        description: "Inspects Content-Addressable Storage (CAS) statistics, 256-shard distribution, blob count, deltas, and bytes.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("inspect_cas_store", args);
        },
      },
      {
        name: "get_merkle_tree",
        description: "Retrieves the file entry manifest for a given Merkle tree hash.",
        parameters: {
          treeHash: { type: "string", required: true, description: "Merkle tree SHA-256 hash" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("get_merkle_tree", args);
        },
      },
      {
        name: "get_blob_content",
        description: "Retrieves the raw content of a stored CAS blob by its SHA-256 hash.",
        parameters: {
          hash: { type: "string", required: true, description: "Blob SHA-256 hash" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("get_blob_content", args);
        },
      },
      {
        name: "checkpoint_stage_file",
        description: "Stages a file into the virtual staging area (git add equivalent).",
        parameters: {
          path: { type: "string", required: true, description: "File path" },
          content: { type: "string", required: true, description: "File content string" },
          mode: { type: "number", description: "File mode (default: 0o644)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_stage_file", args);
        },
      },
      {
        name: "checkpoint_unstage_file",
        description: "Unstages a file from the virtual staging area (git reset <file> equivalent).",
        parameters: {
          path: { type: "string", required: true, description: "File path to unstage" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_unstage_file", args);
        },
      },
      {
        name: "checkpoint_commit_staged",
        description: "Commits all currently staged files into a new checkpoint commit.",
        parameters: {
          message: { type: "string", required: true, description: "Commit message" },
          frameIndex: { type: "number", description: "Frame index number" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_commit_staged", args);
        },
      },
      {
        name: "checkpoint_get_status",
        description: "Inspects git status-style working tree differences against HEAD (staged, modified, untracked, deleted).",
        parameters: {
          filesJson: { type: "string", required: true, description: "JSON array of current files [{path: 'string', content: 'string'}]" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_get_status", args);
        },
      },
      {
        name: "checkpoint_audit_health",
        description: "Audits SLA checkpoint health, 256-shard partition balance, deduplication ratio, CDC, and delta savings.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_audit_health", args);
        },
      },
      {
        name: "checkpoint_get_metrics",
        description: "Fetches comprehensive telemetry on commits, blobs, active shards, chunks, bytes, and rollback latencies.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_get_metrics", args);
        },
      },
      {
        name: "checkpoint_group_and_sort",
        description: "Organizes checkpoint commits into multi-criteria swimlanes (frame, size, parent, date, branch).",
        parameters: {
          groupBy: { type: "string", description: "Group by: frame, size, parent, date, branch" },
          sortBy: { type: "string", description: "Sort by: timestamp, frameIndex, byteCount, fileCount" },
          direction: { type: "string", description: "Sort direction: asc or desc" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_group_and_sort", args);
        },
      },
      {
        name: "checkpoint_search_dsl",
        description: "Searches checkpoint commits using natural query DSL (e.g. 'branch:feature commit:abc files>5 bytes<50000').",
        parameters: {
          query: { type: "string", required: true, description: "DSL search query" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_search_dsl", args);
        },
      },
      {
        name: "checkpoint_render_dashboard",
        description: "Renders an ANSI CLI summary card for checkpoint kernel and hybrid BroccoliDB CAS metrics.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_render_dashboard", args);
        },
      },
      {
        name: "checkpoint_render_graph_dag",
        description: "Renders an ANSI CLI visual ASCII commit DAG graph showing branch forks and merge points.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_render_graph_dag", args);
        },
      },
      {
        name: "checkpoint_render_staging_status",
        description: "Renders a git status-style ANSI CLI working tree and virtual staging status table.",
        parameters: {
          filesJson: { type: "string", required: true, description: "JSON array of current files [{path: 'string', content: 'string'}]" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_render_staging_status", args);
        },
      },
      {
        name: "checkpoint_render_blame",
        description: "Renders an ANSI CLI line-by-line file history blame report with commit attribution.",
        parameters: {
          path: { type: "string", required: true, description: "File path to blame" },
          commitId: { type: "string", description: "Target commit ID (default: HEAD)" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_render_blame", args);
        },
      },
      {
        name: "checkpoint_render_bisect",
        description: "Renders the active bisect binary search regression status box.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_render_bisect", args);
        },
      },
      {
        name: "checkpoint_export_html",
        description: "Exports checkpoint commit DAG and CAS blob analytics into a single-page interactive HTML app.",
        parameters: {},
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_export_html", args);
        },
      },
      {
        name: "checkpoint_rebase",
        description: "Rebases a feature branch onto another target branch, replaying commit deltas.",
        parameters: {
          sourceBranch: { type: "string", required: true, description: "Source branch name to rebase" },
          ontoBranch: { type: "string", required: true, description: "Onto target branch name" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_rebase", args);
        },
      },
      {
        name: "checkpoint_squash",
        description: "Squashes multiple contiguous checkpoint commits into a single commit with a new message.",
        parameters: {
          commitIdsJson: { type: "string", required: true, description: "JSON array of commit IDs to squash" },
          message: { type: "string", required: true, description: "New squashed commit message" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_squash", args);
        },
      },
      {
        name: "checkpoint_cherry_pick",
        description: "Cherry-picks a commit delta onto a target branch, creating a new commit.",
        parameters: {
          commitId: { type: "string", required: true, description: "Commit ID to cherry-pick" },
          targetBranch: { type: "string", required: true, description: "Target branch name" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_cherry_pick", args);
        },
      },
      {
        name: "checkpoint_revert",
        description: "Reverts a commit by generating and applying its inverse delta anti-commit.",
        parameters: {
          commitId: { type: "string", required: true, description: "Commit ID to revert" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_revert", args);
        },
      },
      {
        name: "checkpoint_bisect_start",
        description: "Starts a binary search bisect session between known good and bad commits.",
        parameters: {
          goodCommitId: { type: "string", required: true, description: "Known good commit ID" },
          badCommitId: { type: "string", required: true, description: "Known bad commit ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_bisect_start", args);
        },
      },
      {
        name: "checkpoint_bisect_step",
        description: "Steps the active bisect session by providing verdict (good or bad) on the candidate commit.",
        parameters: {
          verdict: { type: "string", required: true, description: "Verdict: 'good' or 'bad'" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_bisect_step", args);
        },
      },
      {
        name: "checkpoint_diff_commits",
        description: "Computes file-level diff between two checkpoint commit IDs.",
        parameters: {
          commitA: { type: "string", required: true, description: "First commit ID" },
          commitB: { type: "string", required: true, description: "Second commit ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_diff_commits", args);
        },
      },
      {
        name: "checkpoint_merge_branches",
        description: "Performs 3-way Merkle DAG merge between two branches with conflict detection.",
        parameters: {
          oursBranchOrId: { type: "string", required: true, description: "Target branch or commit ID (ours)" },
          theirsBranchOrId: { type: "string", required: true, description: "Source branch or commit ID (theirs)" },
          baseId: { type: "string", description: "Optional explicit common ancestor commit ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd?: string) => {
          return this.executeTool("checkpoint_merge_branches", args);
        },
      },
    ];
  }

  public async executeTool(
    name: string,
    args: Record<string, unknown>,
    _cwd?: string
  ): Promise<{ success: boolean; data?: unknown; [key: string]: unknown; error?: string }> {
    try {
      switch (name) {
        case "create_checkpoint": {
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

          const frameIndex = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const branchName = typeof args.branchName === "string" ? args.branchName : undefined;
          const commit = this.supervisor.checkpoint(message, filePayloads, frameIndex, undefined, branchName);

          return {
            success: true,
            checkpointId: commit.id,
            treeHash: commit.treeHash,
            branchName: commit.branchName,
            fileCount: commit.stats.fileCount,
            byteCount: commit.stats.byteCount,
            chunkCount: commit.stats.chunkCount,
            timestamp: commit.timestamp,
          };
        }

        case "rollback_checkpoint": {
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
        }

        case "rollback_dry_run": {
          const checkpointId = String(args.checkpointId || "").trim();
          if (!checkpointId) return { success: false, error: "checkpointId parameter is required" };

          const dryRun = this.supervisor.rollbackDryRun(checkpointId);
          return { ...dryRun };
        }

        case "get_checkpoint": {
          const checkpointId = String(args.checkpointId || "");
          const commit = this.supervisor.getCheckpoint(checkpointId);
          return { success: commit !== undefined, commit };
        }

        case "list_checkpoints": {
          const limit = typeof args.limit === "number" ? args.limit : 20;
          const history = this.supervisor.listCheckpoints(limit);
          return { success: true, count: history.length, history };
        }

        case "inspect_cas_store": {
          const stats = this.supervisor.getStats();
          const deltas = this.supervisor.getDeltaCompressionStats();
          return { success: true, stats, deltas };
        }

        case "get_merkle_tree": {
          const treeHash = String(args.treeHash || "");
          const tree = this.supervisor.getTree(treeHash);
          return { success: tree !== undefined, tree };
        }

        case "get_blob_content": {
          const hash = String(args.hash || "");
          const blob = this.supervisor.getBlob(hash);
          const content = blob ? new TextDecoder().decode(blob.data) : undefined;
          return { success: blob !== undefined, hash, size: blob?.size, isChunked: blob?.isChunked, content };
        }

        case "checkpoint_stage_file": {
          const path = String(args.path || "").trim();
          const content = String(args.content || "");
          const mode = typeof args.mode === "number" ? args.mode : 0o644;
          if (!path) return { success: false, error: "path is required" };
          this.supervisor.stageFile(path, content, mode);
          return { success: true, stagedPath: path };
        }

        case "checkpoint_unstage_file": {
          const path = String(args.path || "").trim();
          if (!path) return { success: false, error: "path is required" };
          const ok = this.supervisor.unstageFile(path);
          return { success: ok, unstagedPath: path };
        }

        case "checkpoint_commit_staged": {
          const message = String(args.message || "").trim();
          if (!message) return { success: false, error: "message is required" };
          const frameIndex = typeof args.frameIndex === "number" ? args.frameIndex : 1;
          const commit = this.supervisor.commitStaged(message, frameIndex);
          return { success: commit !== undefined, commit };
        }

        case "checkpoint_get_status": {
          const filesJson = String(args.filesJson || "[]").trim();
          let files: { path: string; content: string }[];
          try {
            files = JSON.parse(filesJson) as { path: string; content: string }[];
          } catch {
            return { success: false, error: "Invalid JSON files" };
          }
          const filePayloads = files.map((f) => ({ path: f.path, data: f.content }));
          const status = this.supervisor.getWorkingTreeStatus(filePayloads);
          return { success: true, status };
        }

        case "checkpoint_audit_health": {
          const audit = this.substrate.auditCheckpointHealth();
          return { success: true, audit };
        }

        case "checkpoint_get_metrics": {
          const metrics = this.substrate.getCheckpointMetrics();
          return { success: true, metrics };
        }

        case "checkpoint_group_and_sort": {
          const groupBy = (args.groupBy as CheckpointGroupBy) || "frame";
          const sortBy = (args.sortBy as CheckpointSortBy) || "timestamp";
          const direction = (args.direction as CheckpointSortDirection) || "desc";
          const lanes = this.substrate.getGroupedCheckpoints(groupBy, sortBy, direction);
          return { success: true, lanes };
        }

        case "checkpoint_search_dsl": {
          const query = String(args.query || "");
          const checkpoints = this.substrate.queryCheckpointsDsl(query);
          return { success: true, count: checkpoints.length, checkpoints };
        }

        case "checkpoint_render_dashboard": {
          const metrics = this.substrate.getCheckpointMetrics();
          const rendered = BroccoliViewRenderer.renderCheckpointDashboard(metrics);
          return { success: true, rendered };
        }

        case "checkpoint_render_graph_dag": {
          const checkpoints = this.substrate.listCheckpoints(50);
          const branches = this.supervisor.listBranches();
          const rendered = BroccoliViewRenderer.renderAsciiCommitGraph(checkpoints, branches);
          return { success: true, rendered };
        }

        case "checkpoint_render_staging_status": {
          const filesJson = String(args.filesJson || "[]").trim();
          let files: { path: string; content: string }[];
          try {
            files = JSON.parse(filesJson) as { path: string; content: string }[];
          } catch {
            return { success: false, error: "Invalid JSON files" };
          }
          const filePayloads = files.map((f) => ({ path: f.path, data: f.content }));
          const status = this.supervisor.getWorkingTreeStatus(filePayloads);
          const rendered = BroccoliViewRenderer.renderWorkingTreeStatus(status);
          return { success: true, rendered };
        }

        case "checkpoint_render_blame": {
          const path = String(args.path || "").trim();
          const commitId = typeof args.commitId === "string" ? args.commitId : undefined;
          if (!path) return { success: false, error: "path is required" };
          const report = this.supervisor.blame(path, commitId);
          const rendered = BroccoliViewRenderer.renderBlameView(report);
          return { success: true, rendered, report };
        }

        case "checkpoint_render_bisect": {
          const state = this.supervisor.getBisectState();
          if (!state) return { success: false, error: "No active bisect session" };
          const rendered = BroccoliViewRenderer.renderBisectStatus(state);
          return { success: true, rendered, state };
        }

        case "checkpoint_export_html": {
          const html = this.substrate.exportInteractiveHtmlView();
          return { success: true, html };
        }

        case "checkpoint_rebase": {
          const sourceBranch = String(args.sourceBranch || "");
          const ontoBranch = String(args.ontoBranch || "");
          const res = this.supervisor.rebase(sourceBranch, ontoBranch);
          return { ...res };
        }

        case "checkpoint_squash": {
          const commitIdsJson = String(args.commitIdsJson || "[]");
          const message = String(args.message || "");
          let commitIds: string[];
          try {
            commitIds = JSON.parse(commitIdsJson) as string[];
          } catch {
            return { success: false, error: "Invalid commitIdsJson" };
          }
          const res = this.supervisor.squash(commitIds, message);
          return { ...res };
        }

        case "checkpoint_cherry_pick": {
          const commitId = String(args.commitId || "");
          const targetBranch = String(args.targetBranch || "");
          const res = this.supervisor.cherryPick(commitId, targetBranch);
          return { ...res };
        }

        case "checkpoint_revert": {
          const commitId = String(args.commitId || "");
          const res = this.supervisor.revert(commitId);
          return { ...res };
        }

        case "checkpoint_bisect_start": {
          const good = String(args.goodCommitId || "");
          const bad = String(args.badCommitId || "");
          const res = this.supervisor.startBisect(good, bad);
          return { success: true, ...res };
        }

        case "checkpoint_bisect_step": {
          const verdict = (args.verdict as "good" | "bad") || "good";
          const res = this.supervisor.stepBisect(verdict);
          return { success: true, ...res };
        }

        case "checkpoint_diff_commits": {
          const commitA = String(args.commitA || "");
          const commitB = String(args.commitB || "");
          const diff = this.supervisor.diff(commitA, commitB);
          return { success: true, diff };
        }

        case "checkpoint_merge_branches": {
          const oursId = String(args.oursBranchOrId || "");
          const theirsId = String(args.theirsBranchOrId || "");
          const baseId = typeof args.baseId === "string" ? args.baseId : undefined;
          const result = this.supervisor.merge(oursId, theirsId, baseId);
          return { success: result.success, result };
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
