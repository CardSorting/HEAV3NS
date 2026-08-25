/**
 * workspace-diff-generator.ts
 *
 * Real-Time Workspace Unified Diff Generator.
 * Computes standard git-style unified diffs directly from in-memory mutation journals
 * without requiring git repository commits or external subprocess overhead.
 */

import type { ToolTransactionJournal, MutationTransaction } from "./tool-transaction-journal.js";

export interface FileDiffSummary {
  readonly path: string;
  readonly type: "created" | "modified" | "deleted";
  readonly additions: number;
  readonly deletions: number;
  readonly unifiedDiff: string;
}

export interface WorkspaceDiffResult {
  readonly turnId: string;
  readonly totalFilesChanged: number;
  readonly totalAdditions: number;
  readonly totalDeletions: number;
  readonly files: FileDiffSummary[];
  readonly unifiedDiff: string;
}

export class WorkspaceDiffGenerator {
  /**
   * Generates a unified diff for mutations recorded in the journal.
   */
  public generateDiff(
    journal: ToolTransactionJournal,
    options: { turnId?: string } = {}
  ): WorkspaceDiffResult {
    const transactions = (journal as any).transactions as MutationTransaction[] || [];
    const targetTurn = options.turnId;

    const filtered = targetTurn
      ? transactions.filter((tx) => tx.turnId === targetTurn)
      : transactions;

    // Deduplicate by targetPath (take earliest previousContent and latest newContent)
    const byPath = new Map<string, { prev?: string; next?: string; created?: boolean }>();

    for (const tx of filtered) {
      const existing = byPath.get(tx.targetPath);
      if (!existing) {
        byPath.set(tx.targetPath, {
          prev: tx.previousContent,
          next: tx.newContent,
          created: tx.createdNewFile,
        });
      } else {
        byPath.set(tx.targetPath, {
          prev: existing.prev !== undefined ? existing.prev : tx.previousContent,
          next: tx.newContent,
          created: existing.created || tx.createdNewFile,
        });
      }
    }

    const summaries: FileDiffSummary[] = [];
    const diffBlocks: string[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const [filePath, data] of byPath.entries()) {
      const oldText = data.prev ?? "";
      const newText = data.next ?? "";
      const isCreated = Boolean(data.created && !data.prev);
      const isDeleted = Boolean(data.prev && data.next === undefined);

      const oldLines = oldText ? oldText.split(/\r?\n/) : [];
      const newLines = newText ? newText.split(/\r?\n/) : [];

      let adds = 0;
      let dels = 0;
      const hunkLines: string[] = [];

      if (isCreated) {
        adds = newLines.length;
        for (const line of newLines) {
          hunkLines.push(`+${line}`);
        }
      } else if (isDeleted) {
        dels = oldLines.length;
        for (const line of oldLines) {
          hunkLines.push(`-${line}`);
        }
      } else {
        // Line-by-line diff
        const maxLen = Math.max(oldLines.length, newLines.length);
        for (let i = 0; i < maxLen; i++) {
          const oldLine = oldLines[i];
          const newLine = newLines[i];

          if (oldLine === newLine) {
            hunkLines.push(` ${oldLine}`);
          } else {
            if (oldLine !== undefined) {
              hunkLines.push(`-${oldLine}`);
              dels++;
            }
            if (newLine !== undefined) {
              hunkLines.push(`+${newLine}`);
              adds++;
            }
          }
        }
      }

      totalAdditions += adds;
      totalDeletions += dels;

      const fileHeader = `--- a/${filePath}\n+++ b/${filePath}\n@@ -1,${oldLines.length || 1} +1,${newLines.length || 1} @@\n`;
      const fileUnified = fileHeader + hunkLines.join("\n");
      diffBlocks.push(fileUnified);

      summaries.push({
        path: filePath,
        type: isCreated ? "created" : isDeleted ? "deleted" : "modified",
        additions: adds,
        deletions: dels,
        unifiedDiff: fileUnified,
      });
    }

    return {
      turnId: targetTurn || journal.getCurrentTurnId(),
      totalFilesChanged: summaries.length,
      totalAdditions,
      totalDeletions,
      files: summaries,
      unifiedDiff: diffBlocks.join("\n\n"),
    };
  }
}
