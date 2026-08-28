/**
 * acp-fine-grained-hunk-patcher.ts
 *
 * Fine-Grained Hunk-Level Deconstruction, Selective Approval, and Line-Offset
 * Patching Substrate for the Agent Client Protocol (Phase 197 / ADR-135).
 */

import type {
  AcpDiffHunk,
  AcpHunkLine,
  IAcpFineGrainedHunkPatcher,
} from "../../../core/contracts/acp.contracts.js";

export class AcpFineGrainedHunkPatcher implements IAcpFineGrainedHunkPatcher {
  /**
   * Deconstructs a unified diff string or original/modified pair into discrete, line-anchored hunks.
   */
  public splitDiffIntoHunks(filePath: string, originalContent: string, diffText: string): readonly AcpDiffHunk[] {
    const lines = diffText.split("\n");
    const hunks: AcpDiffHunk[] = [];

    let currentHunk: {
      header: string;
      oldStart: number;
      oldLines: number;
      newStart: number;
      newLines: number;
      lines: AcpHunkLine[];
      additions: number;
      deletions: number;
    } | null = null;

    let currentOldLine = 1;
    let currentNewLine = 1;

    for (const rawLine of lines) {
      if (rawLine.startsWith("---") || rawLine.startsWith("+++")) {
        continue;
      }

      const hunkHeaderMatch = rawLine.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
      if (hunkHeaderMatch) {
        if (currentHunk) {
          hunks.push({
            hunkId: `hunk_${filePath.replace(/[^a-zA-Z0-9]/g, "_")}_${hunks.length + 1}`,
            filePath,
            oldStart: currentHunk.oldStart,
            oldLines: currentHunk.oldLines,
            newStart: currentHunk.newStart,
            newLines: currentHunk.newLines,
            header: currentHunk.header,
            lines: currentHunk.lines,
            additions: currentHunk.additions,
            deletions: currentHunk.deletions,
            isSelected: true,
            status: "PENDING",
          });
        }

        const oldStart = parseInt(hunkHeaderMatch[1], 10);
        const oldLinesCount = hunkHeaderMatch[2] !== undefined ? parseInt(hunkHeaderMatch[2], 10) : 1;
        const newStart = parseInt(hunkHeaderMatch[3], 10);
        const newLinesCount = hunkHeaderMatch[4] !== undefined ? parseInt(hunkHeaderMatch[4], 10) : 1;

        currentOldLine = oldStart;
        currentNewLine = newStart;

        currentHunk = {
          header: rawLine,
          oldStart,
          oldLines: oldLinesCount,
          newStart,
          newLines: newLinesCount,
          lines: [],
          additions: 0,
          deletions: 0,
        };
        continue;
      }

      if (!currentHunk) {
        // Synthesize an initial hunk if diff text lacks explicit @@ headers
        currentHunk = {
          header: "@@ -1,1 +1,1 @@",
          oldStart: 1,
          oldLines: 1,
          newStart: 1,
          newLines: 1,
          lines: [],
          additions: 0,
          deletions: 0,
        };
      }

      if (rawLine.startsWith("+")) {
        currentHunk.lines.push({
          type: "addition",
          content: rawLine.slice(1).startsWith(" ") ? rawLine.slice(2) : rawLine.slice(1),
          newLineNumber: currentNewLine++,
        });
        currentHunk.additions++;
      } else if (rawLine.startsWith("-")) {
        currentHunk.lines.push({
          type: "deletion",
          content: rawLine.slice(1).startsWith(" ") ? rawLine.slice(2) : rawLine.slice(1),
          oldLineNumber: currentOldLine++,
        });
        currentHunk.deletions++;
      } else {
        const text = rawLine.startsWith(" ") ? rawLine.slice(1) : rawLine;
        currentHunk.lines.push({
          type: "context",
          content: text,
          oldLineNumber: currentOldLine++,
          newLineNumber: currentNewLine++,
        });
      }
    }

    if (currentHunk && (currentHunk.additions > 0 || currentHunk.deletions > 0 || currentHunk.lines.length > 0)) {
      hunks.push({
        hunkId: `hunk_${filePath.replace(/[^a-zA-Z0-9]/g, "_")}_${hunks.length + 1}`,
        filePath,
        oldStart: currentHunk.oldStart,
        oldLines: currentHunk.oldLines,
        newStart: currentHunk.newStart,
        newLines: currentHunk.newLines,
        header: currentHunk.header,
        lines: currentHunk.lines,
        additions: currentHunk.additions,
        deletions: currentHunk.deletions,
        isSelected: true,
        status: "PENDING",
      });
    }

    return hunks;
  }

  /**
   * Selectively applies approved hunks to original content while computing line-offset shifts.
   */
  public applySelectedHunks(
    originalContent: string,
    hunks: readonly AcpDiffHunk[],
    selectedHunkIds?: readonly string[]
  ): { success: boolean; patchedContent: string; appliedCount: number; discardedCount: number } {
    const origLines = originalContent.split("\n");
    const activeSelectedSet = selectedHunkIds
      ? new Set(selectedHunkIds)
      : new Set(hunks.filter((h) => h.isSelected && h.status !== "DISCARDED").map((h) => h.hunkId));

    let appliedCount = 0;
    let discardedCount = 0;
    let resultLines = [...origLines];
    let lineOffset = 0;

    for (const hunk of hunks) {
      if (!activeSelectedSet.has(hunk.hunkId)) {
        discardedCount++;
        continue;
      }

      // Calculate adjusted target starting line in the shifting buffer
      const targetIndex = Math.max(0, hunk.oldStart - 1 + lineOffset);
      const deleteCount = hunk.lines.filter((l) => l.type === "deletion" || l.type === "context").length;
      
      const replacement: string[] = [];
      for (const line of hunk.lines) {
        if (line.type === "addition" || line.type === "context") {
          replacement.push(line.content);
        }
      }

      // Splice replacement into buffer
      resultLines.splice(targetIndex, deleteCount, ...replacement);
      lineOffset += hunk.additions - hunk.deletions;
      appliedCount++;
    }

    return {
      success: true,
      patchedContent: resultLines.join("\n"),
      appliedCount,
      discardedCount,
    };
  }

  /**
   * Discards a specific hunk, returning an updated immutably cloned hunks list.
   */
  public discardHunk(hunks: readonly AcpDiffHunk[], hunkId: string): readonly AcpDiffHunk[] {
    return hunks.map((h) => {
      if (h.hunkId === hunkId) {
        return {
          ...h,
          isSelected: false,
          status: "DISCARDED" as const,
        };
      }
      return h;
    });
  }
}
