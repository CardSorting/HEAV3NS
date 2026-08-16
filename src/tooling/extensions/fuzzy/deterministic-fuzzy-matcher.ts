/**
 * deterministic-fuzzy-matcher.ts
 *
 * Zero-GC, deterministic 11-strategy fuzzy line matcher, atomic multi-hunk patch engine,
 * Unicode typography coordinate mapper & preservation engine, block-anchor resolver,
 * token-normalized code matcher, indentation preservation engine, escape-drift detector,
 * whitespace-visualizing mismatch diagnostician, and edit idempotency substrate (Phase 103 / ADR-057).
 */

import type {
  ClosestLineCandidate,
  ContextWindow,
  EscapeDriftDetection,
  FuzzyMatcherOptions,
  FuzzyMatchResult,
  FuzzyMatchSpan,
  FuzzyMultiMatchResult,
  FuzzyReplacementHunk,
  FuzzyStrategyName,
  MismatchDiagnosis,
  WordDiffHighlight,
} from "../../../core/contracts/fuzzy-matcher.contracts.js";

export const DEFAULT_UNICODE_MAP: Record<string, string> = {
  "\u201c": '"', // smart double quote left
  "\u201d": '"', // smart double quote right
  "\u2018": "'", // smart single quote left
  "\u2019": "'", // smart single quote right
  "\u201a": "'", // low single quote
  "\u201b": "'", // high single quote reverse
  "\u201e": '"', // low double quote
  "\u201f": '"', // high double quote reverse
  "\u0060": "'", // backtick to quote for fuzzy equivalence
  "\u00b4": "'", // acute accent
  "\u2014": "--", // em dash
  "\u2013": "-", // en dash
  "\u2026": "...", // ellipsis
  "\u00a0": " ", // non-breaking space
  "\u2212": "-", // math minus sign
  "\u2000": " ", // en quad
  "\u2001": " ", // em quad
  "\u2002": " ", // en space
  "\u2003": " ", // em space
  "\u2004": " ", // three-per-em space
  "\u2005": " ", // four-per-em space
  "\u2006": " ", // six-per-em space
  "\u2007": " ", // figure space
  "\u2008": " ", // punctuation space
  "\u2009": " ", // thin space
  "\u200a": " ", // hair space
  "\u202f": " ", // narrow no-break space
  "\u205f": " ", // medium mathematical space
  "\u3000": " ", // ideographic (CJK full-width) space
  "\u200b": "", // zero-width space
  "\u200c": "", // zero-width non-joiner
  "\u200d": "", // zero-width joiner
  "\ufeff": "", // zero-width no-break space / BOM
};

export const ALL_STRATEGIES: readonly FuzzyStrategyName[] = [
  "exact",
  "line_trimmed",
  "whitespace_normalized",
  "indentation_flexible",
  "escape_normalized",
  "trimmed_boundary",
  "comment_tolerant",
  "token_normalized",
  "unicode_normalized",
  "block_anchor",
  "context_aware",
];

export const IDENTICAL_STRINGS_ERROR =
  "No edit was applied because old_string and new_string are identical. Provide the existing text to replace in old_string and the changed replacement text in new_string.";

export class DeterministicFuzzyMatcher {
  private unicodeMap: Record<string, string>;
  private similarityThreshold: number;
  private enabledStrategies: Set<FuzzyStrategyName>;
  private preserveIndentation: boolean;
  private normalizeLineEndings: boolean;
  private preserveUnicodeForUnchanged: boolean;

  constructor(options: FuzzyMatcherOptions = {}) {
    this.unicodeMap = { ...DEFAULT_UNICODE_MAP, ...(options.customUnicodeMap || {}) };
    this.similarityThreshold = options.similarityThreshold ?? 0.5;
    this.enabledStrategies = new Set<FuzzyStrategyName>(options.enabledStrategies || ALL_STRATEGIES);
    this.preserveIndentation = options.preserveIndentation ?? true;
    this.normalizeLineEndings = options.normalizeLineEndings ?? true;
    this.preserveUnicodeForUnchanged = options.preserveUnicodeForUnchanged ?? true;
  }

  // ---------------------------------------------------------------------------
  // Strategy & Option Configuration
  // ---------------------------------------------------------------------------

  setSimilarityThreshold(threshold: number): void {
    this.similarityThreshold = Math.max(0.1, Math.min(1.0, threshold));
  }

  getSimilarityThreshold(): number {
    return this.similarityThreshold;
  }

  enableStrategy(name: FuzzyStrategyName): void {
    this.enabledStrategies.add(name);
  }

  disableStrategy(name: FuzzyStrategyName): void {
    this.enabledStrategies.delete(name);
  }

  setEnabledStrategies(strategies: readonly FuzzyStrategyName[]): void {
    this.enabledStrategies = new Set<FuzzyStrategyName>(strategies);
  }

  getEnabledStrategies(): readonly FuzzyStrategyName[] {
    return ALL_STRATEGIES.filter((s) => this.enabledStrategies.has(s));
  }

  setPreserveIndentation(enabled: boolean): void {
    this.preserveIndentation = enabled;
  }

  getPreserveIndentation(): boolean {
    return this.preserveIndentation;
  }

  setNormalizeLineEndings(enabled: boolean): void {
    this.normalizeLineEndings = enabled;
  }

  getNormalizeLineEndings(): boolean {
    return this.normalizeLineEndings;
  }

  setPreserveUnicodeForUnchanged(enabled: boolean): void {
    this.preserveUnicodeForUnchanged = enabled;
  }

  getPreserveUnicodeForUnchanged(): boolean {
    return this.preserveUnicodeForUnchanged;
  }

  setCustomUnicodeMapping(char: string, replacement: string): void {
    this.unicodeMap[char] = replacement;
  }

  getUnicodeMap(): Record<string, string> {
    return { ...this.unicodeMap };
  }

  // ---------------------------------------------------------------------------
  // Unicode Typography Normalization & Coordinate Mapping
  // ---------------------------------------------------------------------------

  normalizeUnicode(text: string): string {
    let out = text;
    for (const [char, repl] of Object.entries(this.unicodeMap)) {
      if (out.includes(char)) {
        out = out.split(char).join(repl);
      }
    }
    return out;
  }

  /**
   * Builds an array mapping each original character index to its offset in the normalized string.
   */
  buildOrigToNormMap(original: string): number[] {
    const result: number[] = [];
    let normPos = 0;
    for (let i = 0; i < original.length; i++) {
      result.push(normPos);
      const char = original[i];
      const repl = this.unicodeMap[char];
      normPos += repl !== undefined ? repl.length : 1;
    }
    result.push(normPos);
    return result;
  }

  /**
   * Maps match spans found in normalized space back to exact character index spans in original space.
   */
  mapPositionsNormToOrig(origToNorm: readonly number[], normMatches: readonly FuzzyMatchSpan[]): FuzzyMatchSpan[] {
    const normToOrigStart = new Map<number, number>();
    for (let origPos = 0; origPos < origToNorm.length - 1; origPos++) {
      const normPos = origToNorm[origPos];
      if (!normToOrigStart.has(normPos)) {
        normToOrigStart.set(normPos, origPos);
      }
    }

    const results: FuzzyMatchSpan[] = [];
    const origLen = origToNorm.length - 1;

    for (let m = 0; m < normMatches.length; m++) {
      const [normStart, normEnd] = normMatches[m];
      const origStart = normToOrigStart.get(normStart);
      if (origStart === undefined) continue;

      let origEnd = origStart;
      while (origEnd < origLen && origToNorm[origEnd] < normEnd) {
        origEnd++;
      }

      results.push([origStart, origEnd]);
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Idempotency Verification
  // ---------------------------------------------------------------------------

  isAlreadyApplied(content: string, oldString: string, newString: string): boolean {
    if (!newString || newString.trim().length < 8) {
      return false;
    }
    if (!content.includes(newString)) {
      return false;
    }
    if (oldString === newString) {
      return true;
    }
    return !content.includes(oldString);
  }

  // ---------------------------------------------------------------------------
  // Escape-Drift & Backslash Doubling Guards
  // ---------------------------------------------------------------------------

  private extractBackslashRuns(s: string): number[] {
    const runs: number[] = [];
    let count = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "\\") {
        count++;
      } else if (count > 0) {
        runs.push(count);
        count = 0;
      }
    }
    if (count > 0) {
      runs.push(count);
    }
    return runs;
  }

  detectEscapeDrift(
    content: string,
    matches: readonly FuzzyMatchSpan[],
    oldString: string,
    newString: string
  ): EscapeDriftDetection {
    const hasQuoteSuspects = newString.includes("\\'") || newString.includes('\\"');
    if (!hasQuoteSuspects && !oldString.includes("\\")) {
      return { detected: false, reason: null, message: null };
    }

    const matchedRegions = matches.map(([s, e]) => content.slice(s, e)).join("");

    if (hasQuoteSuspects) {
      for (const suspect of ["\\'", '\\"']) {
        if (newString.includes(suspect) && oldString.includes(suspect) && !matchedRegions.includes(suspect)) {
          const plain = suspect[1];
          return {
            detected: true,
            reason: "quote_escape",
            suspectSequence: suspect,
            message: `Escape-drift detected: old_string and new_string contain literal sequence '${suspect}' but the matched file region does not. Pass old_string/new_string without backslash-escaping '${plain}'.`,
          };
        }
      }
    }

    // Backslash Doubling Check
    const oldRuns = this.extractBackslashRuns(oldString);
    const fileRuns = this.extractBackslashRuns(matchedRegions);
    if (oldRuns.length > 0 && fileRuns.length > 0 && oldRuns.length === fileRuns.length) {
      const isDoubled = oldRuns.every((o, idx) => o === fileRuns[idx] * 2);
      const hasNontrivial = fileRuns.some((f) => f >= 2) || fileRuns.length >= 2;
      const newRuns = this.extractBackslashRuns(newString);
      const newMatchesFile = newRuns.length === fileRuns.length && newRuns.every((n, idx) => n === fileRuns[idx]);

      if (isDoubled && hasNontrivial && !newMatchesFile) {
        return {
          detected: true,
          reason: "backslash_doubling",
          message: "Escape-drift detected: backslash runs in old_string are exactly twice as long as in the file. Re-send old_string/new_string without doubled JSON backslashes.",
        };
      }
    }

    return { detected: false, reason: null, message: null };
  }

  // ---------------------------------------------------------------------------
  // Indentation Adaptation & Relative Re-indentation
  // ---------------------------------------------------------------------------

  private leadingWhitespace(line: string): string {
    const m = line.match(/^[ \t]*/);
    return m ? m[0] : "";
  }

  private firstMeaningfulLine(text: string): string | null {
    for (const line of text.split("\n")) {
      if (line.trim()) return line;
    }
    return null;
  }

  reindentReplacement(fileRegion: string, oldString: string, newString: string): string {
    if (!this.preserveIndentation || !newString) return newString;

    const oldFirst = this.firstMeaningfulLine(oldString);
    const fileFirst = this.firstMeaningfulLine(fileRegion);
    if (!oldFirst || !fileFirst) return newString;

    const oldIndent = this.leadingWhitespace(oldFirst);
    const fileIndent = this.leadingWhitespace(fileFirst);

    if (oldIndent === fileIndent) return newString;

    const outLines: string[] = [];
    for (const line of newString.split("\n")) {
      if (!line.trim()) {
        outLines.push(line);
        continue;
      }
      const lineIndent = this.leadingWhitespace(line);
      if (lineIndent.startsWith(oldIndent)) {
        const remainder = line.slice(oldIndent.length);
        outLines.push(fileIndent + remainder);
      } else {
        outLines.push(fileIndent + line.trimStart());
      }
    }
    return outLines.join("\n");
  }

  // ---------------------------------------------------------------------------
  // Control Character Unescaping (\t, \r)
  // ---------------------------------------------------------------------------

  maybeUnescapeNewString(newString: string, matchedRegions: string): string {
    if (!newString.includes("\\t") && !newString.includes("\\r")) {
      return newString;
    }
    let out = newString;
    if (out.includes("\\t") && matchedRegions.includes("\t")) {
      out = out.split("\\t").join("\t");
    }
    if (out.includes("\\r") && matchedRegions.includes("\r")) {
      out = out.split("\\r").join("\r");
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Unicode Preservation in Replacement (Opcode / LCS Diffing)
  // ---------------------------------------------------------------------------

  preserveUnicodeInReplacement(fileRegion: string, oldString: string, newString: string): string {
    if (!this.preserveUnicodeForUnchanged || !fileRegion || !newString) return newString;

    const normOld = this.normalizeUnicode(oldString);
    const normFile = this.normalizeUnicode(fileRegion);
    if (normOld !== normFile) return newString;

    const fileOrigToNorm = this.buildOrigToNormMap(fileRegion);
    const fileNormToOrig = new Map<number, number>();
    for (let origPos = 0; origPos < fileOrigToNorm.length - 1; origPos++) {
      const np = fileOrigToNorm[origPos];
      if (!fileNormToOrig.has(np)) {
        fileNormToOrig.set(np, origPos);
      }
    }

    // Dynamic Programming LCS for character-level diff between normOld and newString
    const m = normOld.length;
    const n = newString.length;
    if (m === 0) return newString;

    // LCS table
    const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (normOld[i - 1] === newString[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to create segment operations
    let i = m;
    let j = n;
    interface DiffSegment {
      readonly type: "equal" | "replace" | "delete" | "insert";
      readonly oldStart: number;
      readonly oldEnd: number;
      readonly newStart: number;
      readonly newEnd: number;
    }
    const segments: DiffSegment[] = [];

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && normOld[i - 1] === newString[j - 1]) {
        segments.unshift({
          type: "equal",
          oldStart: i - 1,
          oldEnd: i,
          newStart: j - 1,
          newEnd: j,
        });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        segments.unshift({
          type: "insert",
          oldStart: i,
          oldEnd: i,
          newStart: j - 1,
          newEnd: j,
        });
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        segments.unshift({
          type: "delete",
          oldStart: i - 1,
          oldEnd: i,
          newStart: j,
          newEnd: j,
        });
        i--;
      }
    }

    // Merge adjacent equal segments
    const merged: DiffSegment[] = [];
    for (let k = 0; k < segments.length; k++) {
      const seg = segments[k];
      const prev = merged[merged.length - 1];
      if (prev && prev.type === seg.type) {
        merged[merged.length - 1] = {
          type: prev.type,
          oldStart: prev.oldStart,
          oldEnd: seg.oldEnd,
          newStart: prev.newStart,
          newEnd: seg.newEnd,
        };
      } else {
        merged.push(seg);
      }
    }

    // Assemble output preserving original Unicode on 'equal' spans
    const resultParts: string[] = [];
    for (let k = 0; k < merged.length; k++) {
      const seg = merged[k];
      if (seg.type === "equal") {
        const origStart = fileNormToOrig.get(seg.oldStart) ?? 0;
        let origEnd = origStart;
        while (origEnd < fileRegion.length && fileOrigToNorm[origEnd] < seg.oldEnd) {
          origEnd++;
        }
        resultParts.push(fileRegion.slice(origStart, origEnd));
      } else if (seg.type === "insert") {
        resultParts.push(newString.slice(seg.newStart, seg.newEnd));
      } else if (seg.type === "replace") {
        resultParts.push(newString.slice(seg.newStart, seg.newEnd));
      }
    }

    return resultParts.join("");
  }

  // ---------------------------------------------------------------------------
  // Ambiguity Location Formatting & Context Windows
  // ---------------------------------------------------------------------------

  extractContextWindows(content: string, matches: readonly FuzzyMatchSpan[], contextLines: number = 2): ContextWindow[] {
    const lines = content.split("\n");
    const lineOffsets: number[] = [0];
    for (let i = 0; i < content.length; i++) {
      if (content[i] === "\n") lineOffsets.push(i + 1);
    }

    const windows: ContextWindow[] = [];

    for (let m = 0; m < matches.length; m++) {
      const [start, end] = matches[m];

      let startLine = 0;
      let endLine = 0;

      for (let i = 0; i < lineOffsets.length; i++) {
        if (lineOffsets[i] <= start) startLine = i;
        if (lineOffsets[i] < end) endLine = i;
      }

      const beforeStart = Math.max(0, startLine - contextLines);
      const afterEnd = Math.min(lines.length - 1, endLine + contextLines);

      windows.push({
        startLine: startLine + 1,
        endLine: endLine + 1,
        beforeContext: lines.slice(beforeStart, startLine),
        matchedLines: lines.slice(startLine, endLine + 1),
        afterContext: lines.slice(endLine + 1, afterEnd + 1),
      });
    }

    return windows;
  }

  formatMatchLocations(content: string, matches: readonly FuzzyMatchSpan[], cap: number = 5): string {
    const windows = this.extractContextWindows(content, matches, 1);
    const rows: string[] = [];
    const slice = windows.slice(0, cap);

    for (let i = 0; i < slice.length; i++) {
      const w = slice[i];
      let snippet = w.matchedLines.join(" \u23CE ");
      if (snippet.length > 80) {
        snippet = snippet.slice(0, 77) + "...";
      }
      rows.push(`  L${w.startLine}: ${snippet}`);
    }

    const extra = matches.length - cap;
    if (extra > 0) {
      rows.push(`  ... and ${extra} more`);
    }
    return rows.join("\n");
  }

  // ---------------------------------------------------------------------------
  // Whitespace Visualization & Closest Line Diagnostics
  // ---------------------------------------------------------------------------

  visualizeWhitespace(line: string): string {
    let i = 0;
    const prefix: string[] = [];
    while (i < line.length && (line[i] === " " || line[i] === "\t")) {
      prefix.push(line[i] === "\t" ? "→" : "·");
      i++;
    }
    return prefix.join("") + line.slice(i);
  }

  private computeWordHighlights(fileLine: string, searchLine: string): WordDiffHighlight[] {
    const fileWords = fileLine.trim().split(/\s+/);
    const searchWords = searchLine.trim().split(/\s+/);
    const highlights: WordDiffHighlight[] = [];

    const maxWords = Math.min(fileWords.length, searchWords.length);
    for (let idx = 0; idx < maxWords; idx++) {
      if (fileWords[idx] !== searchWords[idx]) {
        highlights.push({
          fileToken: fileWords[idx],
          searchToken: searchWords[idx],
          index: idx,
        });
      }
    }
    return highlights;
  }

  diagnoseMismatch(oldString: string, content: string, contextLines: number = 2, maxResults: number = 3): MismatchDiagnosis {
    if (!oldString || !content) {
      return { hasCandidate: false, formattedHint: "", candidates: [], whitespaceIssueDetected: false };
    }

    const oldLines = oldString.split("\n");
    const contentLines = content.split("\n");
    if (oldLines.length === 0 || contentLines.length === 0) {
      return { hasCandidate: false, formattedHint: "", candidates: [], whitespaceIssueDetected: false };
    }

    let anchor = oldLines[0].trim();
    if (!anchor) {
      const meaningful = oldLines.find((l) => l.trim().length > 0);
      if (!meaningful) {
        return { hasCandidate: false, formattedHint: "", candidates: [], whitespaceIssueDetected: false };
      }
      anchor = meaningful.trim();
    }

    const scored: Array<{ score: number; lineIndex: number }> = [];
    for (let i = 0; i < contentLines.length; i++) {
      const stripped = contentLines[i].trim();
      if (!stripped) continue;
      const sim = this.calculateSimilarity(anchor, stripped);
      if (sim > 0.3) {
        scored.push({ score: sim, lineIndex: i });
      }
    }

    if (scored.length === 0) {
      return { hasCandidate: false, formattedHint: "", candidates: [], whitespaceIssueDetected: false };
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, maxResults);

    const candidates: ClosestLineCandidate[] = [];
    const formattedParts: string[] = [];
    let whitespaceDetected = false;

    for (let t = 0; t < top.length; t++) {
      const { score, lineIndex } = top[t];
      const start = Math.max(0, lineIndex - contextLines);
      const end = Math.min(contentLines.length, lineIndex + oldLines.length + contextLines);

      const snippetLines: string[] = [];
      for (let j = start; j < end; j++) {
        const lineNum = (j + 1).toString().padStart(4, " ");
        snippetLines.push(`${lineNum}| ${contentLines[j]}`);
      }
      const snippet = snippetLines.join("\n");
      formattedParts.push(snippet);

      const candidateLine = contentLines[lineIndex];
      let wsDiff: { fileHasVisual: string; youSentVisual: string } | undefined = undefined;

      for (let j = 0; j < oldLines.length; j++) {
        const cIdx = lineIndex + j;
        if (cIdx < contentLines.length) {
          const cLine = contentLines[cIdx];
          const oLine = oldLines[j];
          if (cLine.trim() === oLine.trim() && cLine !== oLine && !wsDiff) {
            whitespaceDetected = true;
            wsDiff = {
              fileHasVisual: this.visualizeWhitespace(cLine),
              youSentVisual: this.visualizeWhitespace(oLine),
            };
            break;
          }
        }
      }

      const wordHighlights = score > 0.5 ? this.computeWordHighlights(candidateLine, anchor) : undefined;

      candidates.push({
        lineNumber: lineIndex + 1,
        lineContent: candidateLine,
        similarity: score,
        snippet,
        whitespaceDifference: wsDiff,
        wordHighlights,
      });
    }

    let formattedHint = formattedParts.join("\n---\n");

    if (whitespaceDetected && candidates[0]?.whitespaceDifference) {
      formattedHint += `\n\nWhitespace difference detected (→ = tab, · = space):\n  file has: ${candidates[0].whitespaceDifference.fileHasVisual}\n  you sent: ${candidates[0].whitespaceDifference.youSentVisual}\nUse the exact whitespace shown in 'file has'.`;
    }

    return {
      hasCandidate: true,
      formattedHint,
      candidates,
      whitespaceIssueDetected: whitespaceDetected,
    };
  }

  formatNoMatchHint(oldString: string, content: string): string {
    const diagnosis = this.diagnoseMismatch(oldString, content);
    if (!diagnosis.hasCandidate || !diagnosis.formattedHint) return "";
    return `\n\nDid you mean one of these sections?\n${diagnosis.formattedHint}`;
  }

  // ---------------------------------------------------------------------------
  // Levenshtein & Similarity Metrics
  // ---------------------------------------------------------------------------

  calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0.0;

    const lenA = a.length;
    const lenB = b.length;
    const maxLen = Math.max(lenA, lenB);
    if (maxLen === 0) return 1.0;

    let v0 = new Int32Array(lenB + 1);
    let v1 = new Int32Array(lenB + 1);

    for (let i = 0; i <= lenB; i++) {
      v0[i] = i;
    }

    for (let i = 0; i < lenA; i++) {
      v1[0] = i + 1;
      const charA = a[i];

      for (let j = 0; j < lenB; j++) {
        const cost = charA === b[j] ? 0 : 1;
        v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
      }

      const tmp = v0;
      v0 = v1;
      v1 = tmp;
    }

    const distance = v0[lenB];
    return Math.max(0.0, 1.0 - distance / maxLen);
  }

  // ---------------------------------------------------------------------------
  // Myers Unified Diff Generator
  // ---------------------------------------------------------------------------

  generateUnifiedDiff(oldText: string, newText: string, filename: string = "file"): string {
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");
    const diff: string[] = [`--- a/${filename}`, `+++ b/${filename}`];

    let i = 0;
    let j = 0;
    let hunkOldStart = 1;
    let hunkNewStart = 1;
    let hunkOldCount = 0;
    let hunkNewCount = 0;
    let hunkLines: string[] = [];

    const flushHunk = () => {
      if (hunkLines.length > 0) {
        diff.push(`@@ -${hunkOldStart},${hunkOldCount} +${hunkNewStart},${hunkNewCount} @@`);
        diff.push(...hunkLines);
        hunkLines = [];
        hunkOldCount = 0;
        hunkNewCount = 0;
      }
    };

    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        if (hunkLines.length > 0) {
          flushHunk();
        }
        i++;
        j++;
      } else {
        if (hunkLines.length === 0) {
          hunkOldStart = i + 1;
          hunkNewStart = j + 1;
        }
        if (i < oldLines.length) {
          hunkLines.push(`-${oldLines[i]}`);
          hunkOldCount++;
          i++;
        }
        if (j < newLines.length) {
          hunkLines.push(`+${newLines[j]}`);
          hunkNewCount++;
          j++;
        }
      }
    }

    if (hunkLines.length > 0) {
      flushHunk();
    }

    return diff.join("\n");
  }

  // ---------------------------------------------------------------------------
  // 11 Matching Strategies
  // ---------------------------------------------------------------------------

  private strategyExact(content: string, target: string): FuzzyMatchSpan[] {
    const matches: FuzzyMatchSpan[] = [];
    let pos = 0;
    while ((pos = content.indexOf(target, pos)) !== -1) {
      matches.push([pos, pos + target.length]);
      pos += target.length > 0 ? target.length : 1;
    }
    return matches;
  }

  private strategyLineTrimmed(content: string, target: string): FuzzyMatchSpan[] {
    const targetLines = target.split("\n").map((l) => l.trim());
    if (targetLines.length === 0) return [];

    const contentLines = content.split("\n");
    const lineOffsets: number[] = [0];
    for (let i = 0; i < content.length; i++) {
      if (content[i] === "\n") lineOffsets.push(i + 1);
    }

    const matches: FuzzyMatchSpan[] = [];
    for (let i = 0; i <= contentLines.length - targetLines.length; i++) {
      let matched = true;
      for (let j = 0; j < targetLines.length; j++) {
        if (contentLines[i + j].trim() !== targetLines[j]) {
          matched = false;
          break;
        }
      }
      if (matched) {
        const start = lineOffsets[i];
        const endLineIdx = i + targetLines.length - 1;
        const end =
          endLineIdx < contentLines.length - 1
            ? lineOffsets[endLineIdx + 1] - 1
            : content.length;
        matches.push([start, end]);
      }
    }
    return matches;
  }

  private strategyWhitespaceNormalized(content: string, target: string): FuzzyMatchSpan[] {
    const normalizeWs = (s: string) => s.trim().replace(/[ \t]+/g, " ");
    const targetLines = target.split("\n").map(normalizeWs).filter((l) => l.length > 0);
    if (targetLines.length === 0) return [];

    const contentLines = content.split("\n");
    const lineOffsets: number[] = [0];
    for (let i = 0; i < content.length; i++) {
      if (content[i] === "\n") lineOffsets.push(i + 1);
    }

    const matches: FuzzyMatchSpan[] = [];
    for (let i = 0; i <= contentLines.length - targetLines.length; i++) {
      let matched = true;
      for (let j = 0; j < targetLines.length; j++) {
        if (normalizeWs(contentLines[i + j]) !== targetLines[j]) {
          matched = false;
          break;
        }
      }
      if (matched) {
        const start = lineOffsets[i];
        const endLineIdx = i + targetLines.length - 1;
        const end =
          endLineIdx < contentLines.length - 1
            ? lineOffsets[endLineIdx + 1] - 1
            : content.length;
        matches.push([start, end]);
      }
    }
    return matches;
  }

  private strategyIndentationFlexible(content: string, target: string): FuzzyMatchSpan[] {
    const targetLines = target.split("\n").map((l) => l.trimStart());
    if (targetLines.length === 0) return [];

    const contentLines = content.split("\n");
    const lineOffsets: number[] = [0];
    for (let i = 0; i < content.length; i++) {
      if (content[i] === "\n") lineOffsets.push(i + 1);
    }

    const matches: FuzzyMatchSpan[] = [];
    for (let i = 0; i <= contentLines.length - targetLines.length; i++) {
      let matched = true;
      for (let j = 0; j < targetLines.length; j++) {
        if (contentLines[i + j].trimStart() !== targetLines[j]) {
          matched = false;
          break;
        }
      }
      if (matched) {
        const start = lineOffsets[i];
        const endLineIdx = i + targetLines.length - 1;
        const end =
          endLineIdx < contentLines.length - 1
            ? lineOffsets[endLineIdx + 1] - 1
            : content.length;
        matches.push([start, end]);
      }
    }
    return matches;
  }

  private strategyEscapeNormalized(content: string, target: string): FuzzyMatchSpan[] {
    let unescaped = target;
    if (unescaped.includes("\\n")) unescaped = unescaped.split("\\n").join("\n");
    if (unescaped.includes("\\t")) unescaped = unescaped.split("\\t").join("\t");
    if (unescaped.includes('\\"')) unescaped = unescaped.split('\\"').join('"');
    if (unescaped.includes("\\'")) unescaped = unescaped.split("\\'").join("'");

    if (unescaped === target) return [];
    return this.strategyExact(content, unescaped);
  }

  private strategyTrimmedBoundary(content: string, target: string): FuzzyMatchSpan[] {
    const lines = target.split("\n");
    if (lines.length < 2) return [];

    lines[0] = lines[0].trim();
    lines[lines.length - 1] = lines[lines.length - 1].trim();
    const boundaryTarget = lines.join("\n");

    return this.strategyLineTrimmed(content, boundaryTarget);
  }

  private strategyCommentTolerant(content: string, target: string): FuzzyMatchSpan[] {
    const stripLineComment = (s: string) =>
      s
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*/g, "")
        .replace(/#.*/g, "")
        .trim();

    const targetLines = target.split("\n").map(stripLineComment).filter((l) => l.length > 0);
    if (targetLines.length === 0) return [];

    const contentLines = content.split("\n");
    const contentLinesStripped = contentLines.map(stripLineComment);

    const lineOffsets: number[] = [0];
    for (let i = 0; i < content.length; i++) {
      if (content[i] === "\n") lineOffsets.push(i + 1);
    }

    const matches: FuzzyMatchSpan[] = [];
    for (let i = 0; i < contentLines.length; i++) {
      let tIdx = 0;
      let cIdx = i;
      while (cIdx < contentLines.length && tIdx < targetLines.length) {
        if (!contentLinesStripped[cIdx]) {
          cIdx++;
          continue;
        }
        if (contentLinesStripped[cIdx] === targetLines[tIdx]) {
          cIdx++;
          tIdx++;
        } else {
          break;
        }
      }

      if (tIdx === targetLines.length) {
        const start = lineOffsets[i];
        const endLineIdx = cIdx - 1;
        const end =
          endLineIdx < contentLines.length - 1
            ? lineOffsets[endLineIdx + 1] - 1
            : content.length;
        matches.push([start, end]);
        i = endLineIdx;
      }
    }
    return matches;
  }

  private strategyTokenNormalized(content: string, target: string): FuzzyMatchSpan[] {
    const tokenize = (s: string) =>
      s
        .replace(/\s*([(){}[\];,:=+\-*/><?!&|])\s*/g, "$1")
        .replace(/\s+/g, " ")
        .trim();

    const targetTokenized = tokenize(target);
    if (!targetTokenized || targetTokenized === target) return [];

    const targetLines = target.split("\n").map(tokenize).filter((l) => l.length > 0);
    if (targetLines.length === 0) return [];

    const contentLines = content.split("\n");
    const lineOffsets: number[] = [0];
    for (let i = 0; i < content.length; i++) {
      if (content[i] === "\n") lineOffsets.push(i + 1);
    }

    const matches: FuzzyMatchSpan[] = [];
    for (let i = 0; i <= contentLines.length - targetLines.length; i++) {
      let matched = true;
      for (let j = 0; j < targetLines.length; j++) {
        if (tokenize(contentLines[i + j]) !== targetLines[j]) {
          matched = false;
          break;
        }
      }
      if (matched) {
        const start = lineOffsets[i];
        const endLineIdx = i + targetLines.length - 1;
        const end =
          endLineIdx < contentLines.length - 1
            ? lineOffsets[endLineIdx + 1] - 1
            : content.length;
        matches.push([start, end]);
      }
    }
    return matches;
  }

  private strategyUnicodeNormalized(content: string, target: string): FuzzyMatchSpan[] {
    const normTarget = this.normalizeUnicode(target);
    const normContent = this.normalizeUnicode(content);

    if (normTarget === target && normContent === content) {
      return [];
    }

    const origToNorm = this.buildOrigToNormMap(content);

    let normMatches = this.strategyExact(normContent, normTarget);
    if (normMatches.length === 0) {
      normMatches = this.strategyLineTrimmed(normContent, normTarget);
    }

    if (normMatches.length === 0) {
      return [];
    }

    return this.mapPositionsNormToOrig(origToNorm, normMatches);
  }

  private strategyBlockAnchor(content: string, target: string): FuzzyMatchSpan[] {
    const targetLines = target.split("\n");
    if (targetLines.length < 3) return [];

    const firstTarget = targetLines[0].trim();
    const lastTarget = targetLines[targetLines.length - 1].trim();
    const contentLines = content.split("\n");

    const lineOffsets: number[] = [0];
    for (let i = 0; i < content.length; i++) {
      if (content[i] === "\n") lineOffsets.push(i + 1);
    }

    const matches: FuzzyMatchSpan[] = [];
    const middleTarget = targetLines.slice(1, -1).join("\n");

    for (let i = 0; i <= contentLines.length - targetLines.length; i++) {
      if (contentLines[i].trim() === firstTarget) {
        const endLineIdx = i + targetLines.length - 1;
        if (contentLines[endLineIdx].trim() === lastTarget) {
          const middleContent = contentLines.slice(i + 1, endLineIdx).join("\n");
          const sim = this.calculateSimilarity(middleContent, middleTarget);
          if (sim >= this.similarityThreshold) {
            const start = lineOffsets[i];
            const end =
              endLineIdx < contentLines.length - 1
                ? lineOffsets[endLineIdx + 1] - 1
                : content.length;
            matches.push([start, end]);
          }
        }
      }
    }
    return matches;
  }

  private strategyContextAware(content: string, target: string): FuzzyMatchSpan[] {
    const targetLines = target.split("\n");
    const contentLines = content.split("\n");
    if (contentLines.length < targetLines.length) return [];

    const lineOffsets: number[] = [0];
    for (let i = 0; i < content.length; i++) {
      if (content[i] === "\n") lineOffsets.push(i + 1);
    }

    let bestScore = 0;
    let bestSpan: FuzzyMatchSpan | null = null;

    for (let i = 0; i <= contentLines.length - targetLines.length; i++) {
      const window = contentLines.slice(i, i + targetLines.length).join("\n");
      const sim = this.calculateSimilarity(window, target);
      if (sim > bestScore && sim >= this.similarityThreshold) {
        bestScore = sim;
        const start = lineOffsets[i];
        const endLineIdx = i + targetLines.length - 1;
        const end =
          endLineIdx < contentLines.length - 1
            ? lineOffsets[endLineIdx + 1] - 1
            : content.length;
        bestSpan = [start, end];
      }
    }

    return bestSpan ? [bestSpan] : [];
  }

  // ---------------------------------------------------------------------------
  // Master Single Find and Replace Cascading Entry Point
  // ---------------------------------------------------------------------------

  findAndReplace(
    content: string,
    oldString: string,
    newString: string,
    replaceAll: boolean = false,
    options: { dryRun?: boolean } = {}
  ): FuzzyMatchResult {
    if (!oldString) {
      return {
        success: false,
        modifiedContent: content,
        matchCount: 0,
        strategyUsed: null,
        isIdempotent: false,
        error: "old_string cannot be empty",
      };
    }

    if (!oldString.trim()) {
      return {
        success: false,
        modifiedContent: content,
        matchCount: 0,
        strategyUsed: null,
        isIdempotent: false,
        error: "old_string is only whitespace — provide non-blank text to match",
      };
    }

    if (oldString === newString) {
      return {
        success: false,
        modifiedContent: content,
        matchCount: 0,
        strategyUsed: null,
        isIdempotent: false,
        error: IDENTICAL_STRINGS_ERROR,
      };
    }

    // Check idempotency (where newString is present and oldString is gone)
    if (this.isAlreadyApplied(content, oldString, newString)) {
      return {
        success: true,
        modifiedContent: content,
        matchCount: 1,
        strategyUsed: "exact",
        isIdempotent: true,
        similarityScore: 1.0,
        linesAffected: 0,
        error: null,
      };
    }

    const strategies: Array<{ name: FuzzyStrategyName; fn: (c: string, t: string) => FuzzyMatchSpan[] }> = [
      { name: "exact", fn: this.strategyExact.bind(this) },
      { name: "line_trimmed", fn: this.strategyLineTrimmed.bind(this) },
      { name: "whitespace_normalized", fn: this.strategyWhitespaceNormalized.bind(this) },
      { name: "indentation_flexible", fn: this.strategyIndentationFlexible.bind(this) },
      { name: "escape_normalized", fn: this.strategyEscapeNormalized.bind(this) },
      { name: "trimmed_boundary", fn: this.strategyTrimmedBoundary.bind(this) },
      { name: "comment_tolerant", fn: this.strategyCommentTolerant.bind(this) },
      { name: "token_normalized", fn: this.strategyTokenNormalized.bind(this) },
      { name: "unicode_normalized", fn: this.strategyUnicodeNormalized.bind(this) },
      { name: "block_anchor", fn: this.strategyBlockAnchor.bind(this) },
      { name: "context_aware", fn: this.strategyContextAware.bind(this) },
    ];

    const similarityStrategies = new Set<FuzzyStrategyName>(["block_anchor", "context_aware"]);

    for (let i = 0; i < strategies.length; i++) {
      const { name, fn } = strategies[i];
      if (!this.enabledStrategies.has(name)) continue;

      const matches = fn(content, oldString);
      if (matches.length > 0) {
        if (matches.length > 1 && !replaceAll) {
          const locs = this.formatMatchLocations(content, matches);
          const windows = this.extractContextWindows(content, matches);
          return {
            success: false,
            modifiedContent: content,
            matchCount: matches.length,
            strategyUsed: name,
            isIdempotent: false,
            error: `Found ${matches.length} occurrences using strategy '${name}'. Specify additional context to make old_string unique, or enable replace_all.\nMatching locations:\n${locs}`,
            ambiguityLocations: locs,
            contextWindows: windows,
          };
        }

        if (replaceAll && similarityStrategies.has(name)) {
          // Similarity strategies are unsafe for mass replace_all
          continue;
        }

        // Check for transport-level escape drift
        const drift = this.detectEscapeDrift(content, matches, oldString, newString);
        if (drift.detected) {
          return {
            success: false,
            modifiedContent: content,
            matchCount: matches.length,
            strategyUsed: name,
            isIdempotent: false,
            error: drift.message,
            escapeDrift: drift,
          };
        }

        // Apply replacement from right to left (backwards) to preserve indices
        let modified = content;
        const sortedMatches = [...matches].sort((a, b) => b[0] - a[0]);

        for (let m = 0; m < sortedMatches.length; m++) {
          const span = sortedMatches[m];
          const [start, end] = span;
          const matchedRegion = content.slice(start, end);

          // Unescape \t / \r if matched region has them
          let finalReplacement = this.maybeUnescapeNewString(newString, matchedRegion);

          // Re-indent if non-exact strategy
          if (name !== "exact") {
            finalReplacement = this.reindentReplacement(matchedRegion, oldString, finalReplacement);
          }

          // Preserve Unicode if unicode_normalized strategy
          if (name === "unicode_normalized") {
            finalReplacement = this.preserveUnicodeInReplacement(matchedRegion, oldString, finalReplacement);
          }

          modified = modified.slice(0, start) + finalReplacement + modified.slice(end);
        }

        const simScore =
          name === "exact"
            ? 1.0
            : this.calculateSimilarity(content.slice(matches[0][0], matches[0][1]), oldString);

        const diff = this.generateUnifiedDiff(content, modified);
        const windows = this.extractContextWindows(content, matches);

        if (options.dryRun) {
          return {
            success: true,
            modifiedContent: content,
            matchCount: matches.length,
            strategyUsed: name,
            isIdempotent: false,
            similarityScore: simScore,
            diffPreview: diff,
            linesAffected: newString.split("\n").length,
            contextWindows: windows,
            error: null,
          };
        }

        return {
          success: true,
          modifiedContent: modified,
          matchCount: matches.length,
          strategyUsed: name,
          isIdempotent: false,
          similarityScore: simScore,
          diffPreview: diff,
          linesAffected: newString.split("\n").length,
          contextWindows: windows,
          error: null,
        };
      }
    }

    const hint = this.formatNoMatchHint(oldString, content);
    return {
      success: false,
      modifiedContent: content,
      matchCount: 0,
      strategyUsed: null,
      isIdempotent: false,
      diagnosticHint: hint,
      error: `Could not find a match for old_string across all active fuzzy matching strategies.${hint}`,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Multi-Hunk / Multi-Edit Batch Replacement Engine
  // ---------------------------------------------------------------------------

  findAndReplaceMulti(
    content: string,
    hunks: readonly FuzzyReplacementHunk[],
    options: { dryRun?: boolean } = {}
  ): FuzzyMultiMatchResult {
    if (hunks.length === 0) {
      return {
        success: true,
        modifiedContent: content,
        totalHunks: 0,
        appliedHunks: 0,
        isFullyIdempotent: true,
        strategiesUsed: [],
        error: null,
      };
    }

    // Step 1: Pre-flight validate and resolve match spans for all hunks
    interface ResolvedHunk {
      readonly index: number;
      readonly span: FuzzyMatchSpan;
      readonly strategy: FuzzyStrategyName;
      readonly replacement: string;
      readonly isIdempotent: boolean;
    }

    const resolved: ResolvedHunk[] = [];
    const strategiesUsed: FuzzyStrategyName[] = [];
    let fullyIdempotent = true;

    for (let i = 0; i < hunks.length; i++) {
      const hunk = hunks[i];
      if (!hunk.oldString) {
        return {
          success: false,
          modifiedContent: content,
          totalHunks: hunks.length,
          appliedHunks: 0,
          isFullyIdempotent: false,
          strategiesUsed: [],
          failedHunkIndex: i,
          failedHunkError: `Hunk #${i + 1}: oldString cannot be empty.`,
          error: `Multi-hunk batch failed at hunk #${i + 1}: oldString cannot be empty.`,
        };
      }

      if (hunk.oldString === hunk.newString) {
        return {
          success: false,
          modifiedContent: content,
          totalHunks: hunks.length,
          appliedHunks: 0,
          isFullyIdempotent: false,
          strategiesUsed: [],
          failedHunkIndex: i,
          failedHunkError: `Hunk #${i + 1}: ${IDENTICAL_STRINGS_ERROR}`,
          error: `Multi-hunk batch failed at hunk #${i + 1}: ${IDENTICAL_STRINGS_ERROR}`,
        };
      }

      if (this.isAlreadyApplied(content, hunk.oldString, hunk.newString)) {
        continue;
      }

      fullyIdempotent = false;

      // Find match
      const singleRes = this.findAndReplace(content, hunk.oldString, hunk.newString, hunk.replaceAll ?? false, { dryRun: true });
      if (!singleRes.success || !singleRes.strategyUsed) {
        return {
          success: false,
          modifiedContent: content,
          totalHunks: hunks.length,
          appliedHunks: 0,
          isFullyIdempotent: false,
          strategiesUsed: [],
          failedHunkIndex: i,
          failedHunkError: `Hunk #${i + 1}: ${singleRes.error}`,
          error: `Multi-hunk batch failed at hunk #${i + 1}: ${singleRes.error}`,
        };
      }

      // Find first span location in content
      const strategies: Array<{ name: FuzzyStrategyName; fn: (c: string, t: string) => FuzzyMatchSpan[] }> = [
        { name: "exact", fn: this.strategyExact.bind(this) },
        { name: "line_trimmed", fn: this.strategyLineTrimmed.bind(this) },
        { name: "whitespace_normalized", fn: this.strategyWhitespaceNormalized.bind(this) },
        { name: "indentation_flexible", fn: this.strategyIndentationFlexible.bind(this) },
        { name: "escape_normalized", fn: this.strategyEscapeNormalized.bind(this) },
        { name: "trimmed_boundary", fn: this.strategyTrimmedBoundary.bind(this) },
        { name: "comment_tolerant", fn: this.strategyCommentTolerant.bind(this) },
        { name: "token_normalized", fn: this.strategyTokenNormalized.bind(this) },
        { name: "unicode_normalized", fn: this.strategyUnicodeNormalized.bind(this) },
        { name: "block_anchor", fn: this.strategyBlockAnchor.bind(this) },
        { name: "context_aware", fn: this.strategyContextAware.bind(this) },
      ];

      const stratFn = strategies.find((s) => s.name === singleRes.strategyUsed)?.fn;
      const spans = stratFn ? stratFn(content, hunk.oldString) : [];
      if (spans.length === 0) {
        return {
          success: false,
          modifiedContent: content,
          totalHunks: hunks.length,
          appliedHunks: 0,
          isFullyIdempotent: false,
          strategiesUsed: [],
          failedHunkIndex: i,
          failedHunkError: `Hunk #${i + 1}: Span resolution failed.`,
          error: `Multi-hunk batch failed at hunk #${i + 1}: Span resolution failed.`,
        };
      }

      strategiesUsed.push(singleRes.strategyUsed);
      resolved.push({
        index: i,
        span: spans[0],
        strategy: singleRes.strategyUsed,
        replacement: hunk.newString,
        isIdempotent: false,
      });
    }

    if (fullyIdempotent || resolved.length === 0) {
      return {
        success: true,
        modifiedContent: content,
        totalHunks: hunks.length,
        appliedHunks: 0,
        isFullyIdempotent: true,
        strategiesUsed,
        error: null,
      };
    }

    // Step 2: Detect overlapping spans
    const sortedByStart = [...resolved].sort((a, b) => a.span[0] - b.span[0]);
    for (let i = 0; i < sortedByStart.length - 1; i++) {
      const cur = sortedByStart[i];
      const next = sortedByStart[i + 1];
      if (cur.span[1] > next.span[0]) {
        return {
          success: false,
          modifiedContent: content,
          totalHunks: hunks.length,
          appliedHunks: 0,
          isFullyIdempotent: false,
          strategiesUsed: [],
          failedHunkIndex: next.index,
          failedHunkError: `Overlapping hunks detected: Hunk #${cur.index + 1} [${cur.span[0]}..${cur.span[1]}] overlaps with Hunk #${next.index + 1} [${next.span[0]}..${next.span[1]}].`,
          error: `Overlapping hunks detected between Hunk #${cur.index + 1} and Hunk #${next.index + 1}.`,
        };
      }
    }

    // Step 3: Apply replacements descending by start offset
    let modified = content;
    const sortedDescending = [...resolved].sort((a, b) => b.span[0] - a.span[0]);

    for (let r = 0; r < sortedDescending.length; r++) {
      const item = sortedDescending[r];
      const [start, end] = item.span;
      const matchedRegion = content.slice(start, end);

      let finalReplacement = this.maybeUnescapeNewString(item.replacement, matchedRegion);
      if (item.strategy !== "exact") {
        finalReplacement = this.reindentReplacement(matchedRegion, hunks[item.index].oldString, finalReplacement);
      }
      if (item.strategy === "unicode_normalized") {
        finalReplacement = this.preserveUnicodeInReplacement(matchedRegion, hunks[item.index].oldString, finalReplacement);
      }

      modified = modified.slice(0, start) + finalReplacement + modified.slice(end);
    }

    const diff = this.generateUnifiedDiff(content, modified);

    if (options.dryRun) {
      return {
        success: true,
        modifiedContent: content,
        totalHunks: hunks.length,
        appliedHunks: resolved.length,
        isFullyIdempotent: false,
        strategiesUsed,
        diffPreview: diff,
        error: null,
      };
    }

    return {
      success: true,
      modifiedContent: modified,
      totalHunks: hunks.length,
      appliedHunks: resolved.length,
      isFullyIdempotent: false,
      strategiesUsed,
      diffPreview: diff,
      error: null,
    };
  }
}
