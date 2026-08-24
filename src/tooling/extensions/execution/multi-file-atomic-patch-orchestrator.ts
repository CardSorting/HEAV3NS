/**
 * multi-file-atomic-patch-orchestrator.ts
 *
 * Multi-File Atomic Refactoring Patch Orchestrator.
 * Accepts multi-file patch plans, verifies all targeted search blocks across
 * every file before touching disk, and applies all changes in a single atomic
 * transaction backed by ToolTransactionJournal. If any target chunk fails to match,
 * zero files are modified.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ToolTransactionJournal } from "./tool-transaction-journal.js";

export interface FilePatchOperation {
  readonly path: string;
  readonly chunks: Array<{
    readonly target: string;
    readonly replacement: string;
  }>;
}

export interface AtomicPatchPlan {
  readonly description?: string;
  readonly files: FilePatchOperation[];
}

export interface AtomicPatchResult {
  readonly success: boolean;
  readonly modifiedFilesCount: number;
  readonly replacedChunksCount: number;
  readonly modifiedPaths: string[];
  readonly validationErrors?: string[];
}

export class MultiFileAtomicPatchOrchestrator {
  private readonly journal: ToolTransactionJournal;

  constructor(journal: ToolTransactionJournal) {
    this.journal = journal;
  }

  /**
   * Validates and applies a multi-file atomic patch.
   */
  public async applyAtomicPatch(
    plan: AtomicPatchPlan,
    cwd: string
  ): Promise<AtomicPatchResult> {
    if (!plan.files || plan.files.length === 0) {
      return {
        success: false,
        modifiedFilesCount: 0,
        replacedChunksCount: 0,
        modifiedPaths: [],
        validationErrors: ["Atomic patch plan contains no files to modify."],
      };
    }

    const validationErrors: string[] = [];
    const preparedFiles: Array<{
      resolvedPath: string;
      originalContent: string;
      updatedContent: string;
      replacementsCount: number;
    }> = [];

    // Phase 1: Pre-validation of all files and all target chunks
    for (const fileOp of plan.files) {
      const resolvedPath = path.isAbsolute(fileOp.path)
        ? fileOp.path
        : path.resolve(cwd, fileOp.path);

      let originalContent: string;
      try {
        originalContent = await fs.readFile(resolvedPath, "utf-8");
      } catch (err) {
        validationErrors.push(`Cannot read file '${fileOp.path}': ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }

      let workingContent = originalContent;
      let fileReplacements = 0;

      for (let cIdx = 0; cIdx < fileOp.chunks.length; cIdx++) {
        const chunk = fileOp.chunks[cIdx];
        if (!chunk.target) {
          validationErrors.push(`File '${fileOp.path}' chunk #${cIdx + 1} has empty target content.`);
          continue;
        }

        if (!workingContent.includes(chunk.target)) {
          validationErrors.push(
            `File '${fileOp.path}' chunk #${cIdx + 1} target content was not found in file.\nTarget snippet: "${chunk.target.slice(0, 100)}..."`
          );
          continue;
        }

        // Apply replacement in memory
        workingContent = workingContent.replace(chunk.target, chunk.replacement);
        fileReplacements++;
      }

      preparedFiles.push({
        resolvedPath,
        originalContent,
        updatedContent: workingContent,
        replacementsCount: fileReplacements,
      });
    }

    // If any chunk failed, abort immediately without touching physical disk
    if (validationErrors.length > 0) {
      return {
        success: false,
        modifiedFilesCount: 0,
        replacedChunksCount: 0,
        modifiedPaths: [],
        validationErrors,
      };
    }

    // Phase 2: Atomic execution & transaction recording
    const modifiedPaths: string[] = [];
    let totalChunksReplaced = 0;

    for (const item of preparedFiles) {
      await this.journal.recordFileMutation("atomic_multi_file_patch", item.resolvedPath, item.updatedContent);
      await fs.writeFile(item.resolvedPath, item.updatedContent, "utf-8");
      modifiedPaths.push(item.resolvedPath);
      totalChunksReplaced += item.replacementsCount;
    }

    return {
      success: true,
      modifiedFilesCount: modifiedPaths.length,
      replacedChunksCount: totalChunksReplaced,
      modifiedPaths,
    };
  }
}
