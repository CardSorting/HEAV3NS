/**
 * patch-mutation.contracts.ts
 *
 * Core data contracts for the Unified Patch Engine, Atomic Mutation Substrate & VFS (Phase 77 / ADR-029).
 */

export type PatchOperationType = "add" | "update" | "delete" | "move" | "replace_range";

export interface PatchHunkLine {
  readonly prefix: " " | "-" | "+";
  readonly content: string;
}

export interface PatchHunk {
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly lines: readonly PatchHunkLine[];
  readonly contextHint?: string;
}

export interface PatchOperation {
  readonly type: PatchOperationType;
  readonly filePath: string;
  readonly newPath?: string;
  readonly hunks: readonly PatchHunk[];
  readonly content?: string;
}

export interface PatchApplyResult {
  readonly success: boolean;
  readonly modifiedFiles: readonly string[];
  readonly errors: readonly string[];
  readonly dryRun: boolean;
}

export interface FileMutationEntry {
  readonly path: string;
  readonly previousContent: string | null;
  readonly stagedContent: string | null;
  readonly status: "staged" | "committed" | "reverted";
  readonly timestamp: number;
}

export interface FileMutationSnapshot {
  readonly stagedFiles: readonly FileMutationEntry[];
  readonly totalStaged: number;
  readonly timestamp: number;
}

export interface FilePaginationOptions {
  readonly filePath: string;
  readonly startLine?: number;
  readonly endLine?: number;
  readonly maxChars?: number;
  readonly offsetBytes?: number;
}

export interface FilePaginatedReadResult {
  readonly filePath: string;
  readonly content: string;
  readonly totalLines: number;
  readonly startLine: number;
  readonly endLine: number;
  readonly truncated: boolean;
  readonly isBinary: boolean;
}
