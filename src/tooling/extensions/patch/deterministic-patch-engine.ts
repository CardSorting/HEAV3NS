/**
 * deterministic-patch-engine.ts
 *
 * High-performance, zero-GC deterministic patch parser and diff application engine.
 * Supports Unified Diff format, V4A patch format, contiguous block matching,
 * and whitespace-tolerant fuzzy hunk resolution.
 */

import type {
  PatchHunk,
  PatchHunkLine,
  PatchOperation,
  PatchApplyResult,
} from "../../../core/contracts/patch-mutation.contracts.js";

export class DeterministicPatchEngine {
  /**
   * Parses standard Unified Diff text into structured PatchOperations.
   */
  public parseUnifiedDiff(diffText: string): PatchOperation[] {
    const lines = diffText.split(/\r?\n/);
    const operations: PatchOperation[] = [];

    let currentFile = "";
    let currentType: "add" | "update" | "delete" = "update";
    let isOldDevNull = false;
    let isNewDevNull = false;
    let oldFile = "";
    let currentHunks: PatchHunk[] = [];
    let currentHunkLines: PatchHunkLine[] = [];
    let oldStart = 0;
    let oldLines = 0;
    let newStart = 0;
    let newLines = 0;
    let contextHint: string | undefined;

    const flushHunk = () => {
      if (currentHunkLines.length > 0) {
        currentHunks.push({
          oldStart,
          oldLines,
          newStart,
          newLines,
          lines: [...currentHunkLines],
          contextHint,
        });
        currentHunkLines = [];
      }
    };

    const flushFile = () => {
      flushHunk();
      if (currentFile && currentHunks.length > 0) {
        let content: string | undefined;
        if (currentType === "add") {
          const addLines: string[] = [];
          for (const h of currentHunks) {
            for (const l of h.lines) {
              if (l.prefix === "+") {
                addLines.push(l.content);
              }
            }
          }
          content = addLines.join("\n") + "\n";
        }

        operations.push({
          type: currentType,
          filePath: currentFile,
          hunks: [...currentHunks],
          content,
        });
        currentHunks = [];
        currentFile = "";
        currentType = "update";
        isOldDevNull = false;
        isNewDevNull = false;
        oldFile = "";
      }
    };

    for (const line of lines) {
      if (line.startsWith("--- ")) {
        flushFile();
        const pathPart = line.slice(4).trim();
        isOldDevNull = pathPart === "/dev/null";
        oldFile = pathPart.replace(/^[ab]\//, "");
        continue;
      }

      if (line.startsWith("+++ ")) {
        const pathPart = line.slice(4).trim();
        isNewDevNull = pathPart === "/dev/null";
        const newFile = pathPart.replace(/^[ab]\//, "");
        currentFile = isNewDevNull ? oldFile : newFile;
        currentType = isOldDevNull ? "add" : isNewDevNull ? "delete" : "update";
        continue;
      }

      if (line.startsWith("@@ ")) {
        flushHunk();
        // @@ -oldStart,oldLines +newStart,newLines @@ optional hint
        const match = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/);
        if (match) {
          oldStart = parseInt(match[1], 10);
          oldLines = match[2] !== undefined ? parseInt(match[2], 10) : 1;
          newStart = parseInt(match[3], 10);
          newLines = match[4] !== undefined ? parseInt(match[4], 10) : 1;
          contextHint = match[5]?.trim() || undefined;
        }
        continue;
      }

      if (currentFile && (line.startsWith(" ") || line.startsWith("-") || line.startsWith("+"))) {
        const prefix = line[0] as " " | "-" | "+";
        currentHunkLines.push({
          prefix,
          content: line.slice(1),
        });
      }
    }

    flushFile();
    return operations;
  }

  /**
   * Parses V4A patch format (used by Codex/Cline/Hermes).
   */
  public parseV4APatch(patchText: string): PatchOperation[] {
    const lines = patchText.split(/\r?\n/);
    const operations: PatchOperation[] = [];

    let currentOp: PatchOperation | null = null;
    let currentHunks: PatchHunk[] = [];
    let currentHunkLines: PatchHunkLine[] = [];
    let currentContent: string[] = [];

    const flushHunk = () => {
      if (currentHunkLines.length > 0) {
        currentHunks.push({
          oldStart: 1,
          oldLines: currentHunkLines.filter((l) => l.prefix !== "+").length,
          newStart: 1,
          newLines: currentHunkLines.filter((l) => l.prefix !== "-").length,
          lines: [...currentHunkLines],
        });
        currentHunkLines = [];
      }
    };

    const flushOp = () => {
      flushHunk();
      if (currentOp) {
        if (currentOp.type === "add") {
          operations.push({
            ...currentOp,
            content: currentContent.join("\n"),
          });
        } else {
          operations.push({
            ...currentOp,
            hunks: [...currentHunks],
          });
        }
        currentOp = null;
        currentHunks = [];
        currentContent = [];
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "*** Begin Patch" || trimmed === "*** End Patch") {
        if (trimmed === "*** End Patch") flushOp();
        continue;
      }

      if (trimmed.startsWith("*** Update File: ") || trimmed.startsWith("*** File: ")) {
        flushOp();
        const filePath = trimmed.startsWith("*** Update File: ") ? trimmed.slice(17).trim() : trimmed.slice(10).trim();
        currentOp = { type: "update", filePath, hunks: [] };
        continue;
      }

      if (trimmed.startsWith("*** Add File: ")) {
        flushOp();
        const filePath = trimmed.slice(14).trim();
        currentOp = { type: "add", filePath, hunks: [], content: "" };
        continue;
      }

      if (trimmed.startsWith("*** Delete File: ")) {
        flushOp();
        const filePath = trimmed.slice(17).trim();
        currentOp = { type: "delete", filePath, hunks: [] };
        continue;
      }

      if (trimmed.startsWith("*** Move File: ")) {
        flushOp();
        const [source, dest] = trimmed.slice(15).split("->").map((s) => s.trim());
        currentOp = { type: "move", filePath: source, newPath: dest, hunks: [] };
        continue;
      }

      if (currentOp) {
        if (currentOp.type === "add") {
          if (line.startsWith("+")) {
            currentContent.push(line.slice(1));
          } else {
            currentContent.push(line);
          }
        } else if (currentOp.type === "update") {
          if (line.startsWith("@@")) {
            flushHunk();
          } else if (line.startsWith(" ") || line.startsWith("-") || line.startsWith("+")) {
            currentHunkLines.push({
              prefix: line[0] as " " | "-" | "+",
              content: line.slice(1),
            });
          }
        }
      }
    }

    flushOp();
    return operations;
  }

  /**
   * Applies structured hunks to an existing text file with exact and fuzzy fallback matching.
   */
  public applyHunks(originalText: string, hunks: readonly PatchHunk[]): { success: boolean; newContent?: string; error?: string } {
    let fileLines = originalText.split(/\r?\n/);

    for (const hunk of hunks) {
      const matchIndex = this.findHunkMatch(fileLines, hunk);
      if (matchIndex === -1) {
        return {
          success: false,
          error: `Hunk failed to match context (expected around line ${hunk.oldStart})`,
        };
      }

      const before = fileLines.slice(0, matchIndex);
      const matchedHunkLines = hunk.lines;

      let oldLineCount = 0;
      for (const hl of matchedHunkLines) {
        if (hl.prefix === " " || hl.prefix === "-") {
          oldLineCount++;
        }
      }

      const after = fileLines.slice(matchIndex + oldLineCount);
      const replacementLines: string[] = [];

      for (const hl of matchedHunkLines) {
        if (hl.prefix === " " || hl.prefix === "+") {
          replacementLines.push(hl.content);
        }
      }

      fileLines = [...before, ...replacementLines, ...after];
    }

    return {
      success: true,
      newContent: fileLines.join("\n"),
    };
  }

  /**
   * Performs contiguous substring replacement with whitespace normalization and line bounds checking.
   */
  public replaceContiguous(
    originalText: string,
    targetContent: string,
    replacementContent: string,
    options: { startLine?: number; endLine?: number; allowMultiple?: boolean } = {}
  ): { success: boolean; newContent?: string; error?: string; replacementsMade?: number } {
    const lines = originalText.split(/\r?\n/);
    const startIdx = options.startLine ? Math.max(0, options.startLine - 1) : 0;
    const endIdx = options.endLine ? Math.min(lines.length, options.endLine) : lines.length;

    const sliceLines = lines.slice(startIdx, endIdx);
    const sliceText = sliceLines.join("\n");

    const targetNormalized = targetContent.replace(/\r\n/g, "\n");
    const replacementNormalized = replacementContent.replace(/\r\n/g, "\n");

    // 1. Direct exact substring match in the slice
    if (sliceText.includes(targetNormalized)) {
      if (!options.allowMultiple && sliceText.indexOf(targetNormalized) !== sliceText.lastIndexOf(targetNormalized)) {
        return {
          success: false,
          error: "Multiple occurrences of target content found; specify allowMultiple: true or narrower line range",
        };
      }

      const newSliceText = options.allowMultiple
        ? sliceText.replaceAll(targetNormalized, replacementNormalized)
        : sliceText.replace(targetNormalized, replacementNormalized);

      const before = lines.slice(0, startIdx);
      const after = lines.slice(endIdx);
      const finalContent = [...before, newSliceText, ...after].join("\n");

      return {
        success: true,
        newContent: finalContent,
        replacementsMade: 1,
      };
    }

    // 2. Line-by-line whitespace-trimmed fuzzy block match
    const targetLines = targetNormalized.split("\n");
    const replacementLines = replacementNormalized.split("\n");

    let matchIdx = -1;
    for (let i = 0; i <= sliceLines.length - targetLines.length; i++) {
      if (this.linesMatchFuzzy(sliceLines, i, targetLines)) {
        matchIdx = i;
        break;
      }
    }

    if (matchIdx !== -1) {
      const before = sliceLines.slice(0, matchIdx);
      const after = sliceLines.slice(matchIdx + targetLines.length);
      const newSliceLines = [...before, ...replacementLines, ...after];
      const finalLines = [...lines.slice(0, startIdx), ...newSliceLines, ...lines.slice(endIdx)];

      return {
        success: true,
        newContent: finalLines.join("\n"),
        replacementsMade: 1,
      };
    }

    return {
      success: false,
      error: "Target content not found within specified line bounds",
    };
  }

  private findHunkMatch(fileLines: string[], hunk: PatchHunk): number {
    const expectedOldLines: string[] = [];
    for (const hl of hunk.lines) {
      if (hl.prefix === " " || hl.prefix === "-") {
        expectedOldLines.push(hl.content);
      }
    }

    if (expectedOldLines.length === 0) return Math.min(hunk.oldStart - 1, fileLines.length);

    // 1. Try exact line index match
    const candidateIdx = Math.max(0, hunk.oldStart - 1);
    if (this.linesMatch(fileLines, candidateIdx, expectedOldLines)) {
      return candidateIdx;
    }

    // 2. Scan entire file for exact match
    for (let i = 0; i <= fileLines.length - expectedOldLines.length; i++) {
      if (this.linesMatch(fileLines, i, expectedOldLines)) {
        return i;
      }
    }

    // 3. Scan for whitespace-trimmed match
    for (let i = 0; i <= fileLines.length - expectedOldLines.length; i++) {
      if (this.linesMatchFuzzy(fileLines, i, expectedOldLines)) {
        return i;
      }
    }

    return -1;
  }

  private linesMatch(fileLines: string[], start: number, expected: string[]): boolean {
    if (start + expected.length > fileLines.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (fileLines[start + i] !== expected[i]) return false;
    }
    return true;
  }

  private linesMatchFuzzy(fileLines: string[], start: number, expected: string[]): boolean {
    if (start + expected.length > fileLines.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (fileLines[start + i].trim() !== expected[i].trim()) return false;
    }
    return true;
  }

  private findFuzzyMatch(source: string, target: string): boolean {
    const normSource = source.replace(/\s+/g, " ").trim();
    const normTarget = target.replace(/\s+/g, " ").trim();
    return normSource.includes(normTarget);
  }

  public formatMutationEntry(entry: { path: string; status: string; stagedContent: string | null }): string {
    const len = entry.stagedContent ? entry.stagedContent.length : 0;
    return `[MUTATION:${entry.status.toUpperCase()}] ${entry.path} (${len} bytes staged)`;
  }

  public formatPatchApplyResult(result: PatchApplyResult): string {
    const status = result.success ? "SUCCESS" : "FAILED";
    const mode = result.dryRun ? "DRY-RUN" : "APPLIED";
    return `[PATCH:${status}:${mode}] ${result.modifiedFiles.length} files modified, ${result.errors.length} errors`;
  }

  public formatHunk(hunk: PatchHunk): string {
    return `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@ (${hunk.lines.length} lines)`;
  }
}
