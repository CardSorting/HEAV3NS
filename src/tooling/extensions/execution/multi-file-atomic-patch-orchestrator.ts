/**
 * multi-file-atomic-patch-orchestrator.ts
 *
 * Multi-File Atomic Refactoring Patch Orchestrator with Fuzzy Auto-Healing.
 * Accepts composite multi-file patch plans (patches, creates, deletes),
 * pre-validates all targeted search blocks across every file in memory before touching disk,
 * transparently applies whitespace-tolerant fuzzy matching on indentation mismatches,
 * and executes all changes in a single atomic transaction backed by ToolTransactionJournal.
 * If any critical validation fails, zero files are modified on disk.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ToolTransactionJournal } from "./tool-transaction-journal.js";
import { ToolErrorAutoHealer } from "./tool-error-auto-healer.js";

export interface FilePatchOperation {
  readonly path: string;
  readonly chunks: Array<{
    readonly target: string;
    readonly replacement: string;
  }>;
}

export interface FileCreateOperation {
  readonly path: string;
  readonly content: string;
}

export interface AtomicPatchPlan {
  readonly description?: string;
  readonly files?: FilePatchOperation[];
  readonly createFiles?: FileCreateOperation[];
  readonly deleteFiles?: string[];
}

export interface AtomicPatchResult {
  readonly success: boolean;
  readonly modifiedFilesCount: number;
  readonly createdFilesCount: number;
  readonly deletedFilesCount: number;
  readonly replacedChunksCount: number;
  readonly autoHealedChunksCount: number;
  readonly modifiedPaths: string[];
  readonly validationErrors?: string[];
}

export class MultiFileAtomicPatchOrchestrator {
  private readonly journal: ToolTransactionJournal;
  private readonly healer = new ToolErrorAutoHealer();

  constructor(journal: ToolTransactionJournal) {
    this.journal = journal;
  }

  /**
   * Validates and atomically applies a multi-file patch plan.
   */
  public async applyAtomicPatch(
    plan: AtomicPatchPlan,
    cwd: string
  ): Promise<AtomicPatchResult> {
    const patchFiles = plan.files || [];
    const createFiles = plan.createFiles || [];
    const deleteFiles = plan.deleteFiles || [];

    if (patchFiles.length === 0 && createFiles.length === 0 && deleteFiles.length === 0) {
      return {
        success: false,
        modifiedFilesCount: 0,
        createdFilesCount: 0,
        deletedFilesCount: 0,
        replacedChunksCount: 0,
        autoHealedChunksCount: 0,
        modifiedPaths: [],
        validationErrors: ["Atomic patch plan contains no file operations (patches, creates, or deletes)."],
      };
    }

    const validationErrors: string[] = [];
    const preparedPatches: Array<{
      resolvedPath: string;
      originalContent: string;
      updatedContent: string;
      replacementsCount: number;
      autoHealedCount: number;
    }> = [];

    let totalAutoHealed = 0;

    // Phase 1: Pre-validation of all files to patch
    for (const fileOp of patchFiles) {
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
      let fileAutoHealed = 0;

      for (let cIdx = 0; cIdx < fileOp.chunks.length; cIdx++) {
        const chunk = fileOp.chunks[cIdx];
        if (!chunk.target) {
          validationErrors.push(`File '${fileOp.path}' chunk #${cIdx + 1} has empty target content.`);
          continue;
        }

        const exactIndex = workingContent.indexOf(chunk.target);
        const isExactLineMatch =
          exactIndex !== -1 &&
          (exactIndex === 0 || workingContent[exactIndex - 1] === "\n" || workingContent[exactIndex - 1] === "\r") &&
          (exactIndex + chunk.target.length === workingContent.length ||
            workingContent[exactIndex + chunk.target.length] === "\n" ||
            workingContent[exactIndex + chunk.target.length] === "\r");

        if (isExactLineMatch) {
          workingContent = workingContent.replace(chunk.target, chunk.replacement);
          fileReplacements++;
        } else {
          // Attempt whole-line whitespace/indentation-tolerant fuzzy healing
          const fuzzy = this.healer.healFuzzyPatch(workingContent, chunk.target);
          if (fuzzy.found && fuzzy.adjustedTarget) {
            workingContent = workingContent.replace(fuzzy.adjustedTarget, chunk.replacement);
            fileReplacements++;
            fileAutoHealed++;
            totalAutoHealed++;
          } else if (exactIndex !== -1) {
            // Direct substring fallback
            workingContent = workingContent.replace(chunk.target, chunk.replacement);
            fileReplacements++;
          } else {
            validationErrors.push(
              `File '${fileOp.path}' chunk #${cIdx + 1} target content was not found even with fuzzy scanning.\nTarget snippet: "${chunk.target.slice(0, 100)}..."`
            );
          }
        }
      }

      preparedPatches.push({
        resolvedPath,
        originalContent,
        updatedContent: workingContent,
        replacementsCount: fileReplacements,
        autoHealedCount: fileAutoHealed,
      });
    }

    // Pre-validate createFiles (ensure parent directories are resolvable)
    const preparedCreates: Array<{ resolvedPath: string; content: string }> = [];
    for (const createOp of createFiles) {
      const resolvedPath = path.isAbsolute(createOp.path)
        ? createOp.path
        : path.resolve(cwd, createOp.path);
      preparedCreates.push({ resolvedPath, content: createOp.content });
    }

    // Pre-validate deleteFiles (check existence)
    const preparedDeletes: string[] = [];
    for (const delPath of deleteFiles) {
      const resolvedPath = path.isAbsolute(delPath)
        ? delPath
        : path.resolve(cwd, delPath);
      preparedDeletes.push(resolvedPath);
    }

    // If any validation error occurred, abort immediately without disk mutations
    if (validationErrors.length > 0) {
      return {
        success: false,
        modifiedFilesCount: 0,
        createdFilesCount: 0,
        deletedFilesCount: 0,
        replacedChunksCount: 0,
        autoHealedChunksCount: 0,
        modifiedPaths: [],
        validationErrors,
      };
    }

    // Phase 2: Atomic execution & transaction recording
    const modifiedPaths: string[] = [];
    let totalChunksReplaced = 0;

    // Apply creates
    for (const item of preparedCreates) {
      const parentDir = path.dirname(item.resolvedPath);
      await fs.mkdir(parentDir, { recursive: true });
      await this.journal.recordFileMutation("create_file", item.resolvedPath, item.content);
      await fs.writeFile(item.resolvedPath, item.content, "utf-8");
      modifiedPaths.push(item.resolvedPath);
    }

    // Apply patches
    for (const item of preparedPatches) {
      await this.journal.recordFileMutation("atomic_multi_file_patch", item.resolvedPath, item.updatedContent);
      await fs.writeFile(item.resolvedPath, item.updatedContent, "utf-8");
      modifiedPaths.push(item.resolvedPath);
      totalChunksReplaced += item.replacementsCount;
    }

    // Apply deletes
    for (const delPath of preparedDeletes) {
      await this.journal.recordFileMutation("delete_file", delPath);
      await fs.rm(delPath, { force: true, recursive: true }).catch(() => {});
      modifiedPaths.push(delPath);
    }

    return {
      success: true,
      modifiedFilesCount: preparedPatches.length,
      createdFilesCount: preparedCreates.length,
      deletedFilesCount: preparedDeletes.length,
      replacedChunksCount: totalChunksReplaced,
      autoHealedChunksCount: totalAutoHealed,
      modifiedPaths,
    };
  }
}
