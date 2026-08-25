/**
 * merge-conflict-previewer.ts
 *
 * In-Memory 3-Way Merge Conflict & Patch Previewer.
 * Computes non-destructive 3-way text merges between base, local, and incoming strings
 * with conflict detection and automated resolution previews.
 */

export interface MergeConflictResult {
  readonly success: boolean;
  readonly hasConflicts: boolean;
  readonly conflictsCount: number;
  readonly mergedText: string;
}

export class MergeConflictPreviewer {
  /**
   * Merges incoming changes into local content relative to a base ancestor.
   */
  public previewMerge(baseText: string, localText: string, incomingText: string): MergeConflictResult {
    // Trivial cases
    if (localText === incomingText || baseText === incomingText) {
      return { success: true, hasConflicts: false, conflictsCount: 0, mergedText: localText };
    }
    if (baseText === localText) {
      return { success: true, hasConflicts: false, conflictsCount: 0, mergedText: incomingText };
    }

    const baseLines = baseText.split(/\r?\n/);
    const localLines = localText.split(/\r?\n/);
    const incomingLines = incomingText.split(/\r?\n/);

    const mergedLines: string[] = [];
    let conflictsCount = 0;
    let hasConflicts = false;

    const maxLen = Math.max(baseLines.length, localLines.length, incomingLines.length);

    for (let i = 0; i < maxLen; i++) {
      const b = baseLines[i];
      const l = localLines[i];
      const inc = incomingLines[i];

      // No changes on this line
      if (l === inc) {
        if (l !== undefined) mergedLines.push(l);
        continue;
      }

      // Local changed, incoming didn't change
      if (inc === b && l !== undefined) {
        mergedLines.push(l);
        continue;
      }

      // Incoming changed, local didn't change
      if (l === b && inc !== undefined) {
        mergedLines.push(inc);
        continue;
      }

      // Both changed differently -> Conflict
      hasConflicts = true;
      conflictsCount++;
      mergedLines.push("<<<<<<< LOCAL");
      if (l !== undefined) mergedLines.push(l);
      mergedLines.push("=======");
      if (inc !== undefined) mergedLines.push(inc);
      mergedLines.push(">>>>>>> INCOMING");
    }

    return {
      success: !hasConflicts,
      hasConflicts,
      conflictsCount,
      mergedText: mergedLines.join("\n"),
    };
  }
}
