/**
 * deterministic-fuzzy-matcher.ts
 *
 * Zero-GC, deterministic 12-strategy fuzzy line matcher, atomic multi-hunk patch engine,
 * SEARCH/REPLACE block parser & applicator, line-hint biased fuzzy matcher, multi-file patch engine,
 * ellipsis-wildcard block resolver, unified diff patch parser & applicator,
 * Unicode typography coordinate mapper & preservation engine, block-anchor resolver,
 * token-normalized code matcher, indentation preservation engine, escape-drift detector,
 * whitespace-visualizing mismatch diagnostician, and edit idempotency substrate (Phase 103 / ADR-057).
 */

import type {
  CandidateMatchScore,
  CandidateRankingResult,
  ClosestLineCandidate,
  ConflictBlockAnalysis,
  ConflictMarkerChunk,
  ConflictResolutionResult,
  ConflictResolutionStrategy,
  ContextWindow,
  EscapeDriftDetection,
  FuzzyMatcherOptions,
  FuzzyMatchResult,
  FuzzyMatchSpan,
  FuzzyMultiMatchResult,
  FuzzyReplacementHunk,
  FuzzyStrategyName,
  HistogramDiffHunk,
  HistogramDiffOptions,
  HistogramDiffResult,
  ImportOptimizationOptions,
  ImportOptimizationResult,
  ImportSpecifierItem,
  ImportStatementAnalysis,
  IndentationHarmonizationResult,
  IndentationStyle,
  InversePatchHunk,
  InversePatchResult,
  LexicalToken,
  LexicalTokenType,
  LspApplyResult,
  LspPosition,
  LspRange,
  LspTextEdit,
  LspWorkspaceEdit,
  MergeResolutionCandidate,
  MismatchDiagnosis,
  MultiCursorEditSpan,
  MultiCursorParallelResult,
  MultiFileInversePatchResult,
  MultiFilePatchResult,
  MultiFileTransactionHunk,
  MultiFileTransactionResult,
  MultiSourceHunkInput,
  MultiSourcePatchSynthesisResult,
  MultiSourceSynthesizedPatch,
  NGramMatchCandidate,
  NGramSimilarityOptions,
  NGramSimilarityResult,
  PatchDriftHunkResult,
  PatchDriftOptions,
  PatchDriftResult,
  PatienceDiffHunk,
  PatienceDiffOptions,
  PatienceDiffResult,
  RecordedConflictEntry,
  RecordedConflictPreimage,
  RerereReplayResult,
  ScopeBoundedMatchOptions,
  ScopeBoundedMatchResult,
  SearchReplaceBlock,
  SemanticConflictExplanation,
  SemanticTreeApplyResult,
  SemanticTreeDiffOptions,
  SemanticTreeDiffResult,
  SemanticTreeNode,
  SemanticTreeNodeType,
  SemanticTreeOp,
  SemanticTreeOpType,
  SignatureRefactorOptions,
  SignatureRefactorResult,
  StructuralHoleBinding,
  StructuralPatternMatchItem,
  StructuralPatternMatchResult,
  StructuralPatternOptions,
  SymbolRenameFileResult,
  SymbolRenameOccurrence,
  SymbolRenameOptions,
  SyntaxBalanceIssue,
  SyntaxBoundarySnapResult,
  SyntaxRepairResult,
  ThreeWayMergeConflictResolution,
  ThreeWayMergeHunk,
  ThreeWayMergeOptions,
  ThreeWayMergeResult,
  TokenStreamMatchOptions,
  TokenStreamMatchResult,
  UnifiedPatchHunk,
  UnifiedPatchResult,
  WordDiffHighlight,
  WorkspaceSymbolRenameResult,
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
  "ellipsis_wildcard",
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
  private rerereCache: Map<string, RecordedConflictEntry>;

  constructor(options: FuzzyMatcherOptions = {}) {
    this.unicodeMap = { ...DEFAULT_UNICODE_MAP, ...(options.customUnicodeMap || {}) };
    this.similarityThreshold = options.similarityThreshold ?? 0.5;
    this.enabledStrategies = new Set<FuzzyStrategyName>(options.enabledStrategies || ALL_STRATEGIES);
    this.preserveIndentation = options.preserveIndentation ?? true;
    this.normalizeLineEndings = options.normalizeLineEndings ?? true;
    this.preserveUnicodeForUnchanged = options.preserveUnicodeForUnchanged ?? true;
    this.rerereCache = new Map<string, RecordedConflictEntry>();
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
  // Line Ending Preservation (CRLF vs LF)
  // ---------------------------------------------------------------------------

  private detectLineEnding(text: string): "\r\n" | "\n" {
    return text.includes("\r\n") ? "\r\n" : "\n";
  }

  private applyLineEnding(text: string, eol: "\r\n" | "\n"): string {
    if (eol === "\r\n") {
      return text.replace(/\r?\n/g, "\r\n");
    }
    return text.replace(/\r\n/g, "\n");
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

    const m = normOld.length;
    const n = newString.length;
    if (m === 0) return newString;

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

  levenshteinDistance(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const lenA = a.length;
    const lenB = b.length;
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
      for (let j = 0; j <= lenB; j++) {
        v0[j] = v1[j];
      }
    }
    return v0[lenB];
  }

  findMatchSpans(content: string, target: string): FuzzyMatchSpan[] {
    const strategies = [
      this.strategyExact.bind(this),
      this.strategyLineTrimmed.bind(this),
      this.strategyWhitespaceNormalized.bind(this),
      this.strategyIndentationFlexible.bind(this),
      this.strategyEscapeNormalized.bind(this),
      this.strategyTrimmedBoundary.bind(this),
      this.strategyCommentTolerant.bind(this),
      this.strategyTokenNormalized.bind(this),
      this.strategyEllipsisWildcard.bind(this),
      this.strategyUnicodeNormalized.bind(this),
      this.strategyBlockAnchor.bind(this),
      this.strategyContextAware.bind(this),
    ];
    for (let i = 0; i < strategies.length; i++) {
      const matches = strategies[i](content, target);
      if (matches.length > 0) {
        return matches;
      }
    }
    return [];
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
  // Unified Diff Patch Parser & Applicator
  // ---------------------------------------------------------------------------

  parseUnifiedPatch(patch: string): UnifiedPatchHunk[] {
    const lines = patch.split("\n");
    const hunks: UnifiedPatchHunk[] = [];
    let currentHunk: {
      oldStart: number;
      oldCount: number;
      newStart: number;
      newCount: number;
      lines: string[];
    } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const hunkHeaderMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);

      if (hunkHeaderMatch) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        currentHunk = {
          oldStart: parseInt(hunkHeaderMatch[1], 10),
          oldCount: hunkHeaderMatch[2] !== undefined ? parseInt(hunkHeaderMatch[2], 10) : 1,
          newStart: parseInt(hunkHeaderMatch[3], 10),
          newCount: hunkHeaderMatch[4] !== undefined ? parseInt(hunkHeaderMatch[4], 10) : 1,
          lines: [],
        };
      } else if (currentHunk) {
        if (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) {
          currentHunk.lines.push(line);
        } else if (line === "") {
          const currentOld = currentHunk.lines.filter((l) => l.startsWith("-") || l.startsWith(" ") || l === "").length;
          if (currentOld < currentHunk.oldCount) {
            currentHunk.lines.push(line);
          }
        }
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return hunks;
  }

  applyUnifiedPatch(content: string, patch: string): UnifiedPatchResult {
    const hunks = this.parseUnifiedPatch(patch);
    if (hunks.length === 0) {
      return {
        success: false,
        modifiedContent: content,
        hunksParsed: 0,
        hunksApplied: 0,
        error: "No valid unified diff hunks found in patch.",
      };
    }

    const lines = content.split("\n");
    let lineDelta = 0;
    let appliedCount = 0;

    for (let h = 0; h < hunks.length; h++) {
      const hunk = hunks[h];
      const targetStart = Math.max(0, hunk.oldStart - 1 + lineDelta);

      const expectedOld: string[] = [];
      const replacementNew: string[] = [];

      for (let l = 0; l < hunk.lines.length; l++) {
        const hLine = hunk.lines[l];
        if (hLine.startsWith("-")) {
          expectedOld.push(hLine.slice(1));
        } else if (hLine.startsWith("+")) {
          replacementNew.push(hLine.slice(1));
        } else if (hLine.startsWith(" ")) {
          expectedOld.push(hLine.slice(1));
          replacementNew.push(hLine.slice(1));
        } else if (hLine === "") {
          expectedOld.push("");
          replacementNew.push("");
        }
      }

      let matchIdx = -1;
      const searchRadius = 5;
      const minIdx = Math.max(0, targetStart - searchRadius);
      const maxIdx = Math.min(lines.length - expectedOld.length, targetStart + searchRadius);

      for (let testIdx = minIdx; testIdx <= maxIdx; testIdx++) {
        let isMatch = true;
        for (let k = 0; k < expectedOld.length; k++) {
          if (lines[testIdx + k] !== expectedOld[k]) {
            isMatch = false;
            break;
          }
        }
        if (isMatch) {
          matchIdx = testIdx;
          break;
        }
      }

      if (matchIdx === -1) {
        return {
          success: false,
          modifiedContent: content,
          hunksParsed: hunks.length,
          hunksApplied: appliedCount,
          error: `Hunk #${h + 1} failed to apply at line ${hunk.oldStart}.`,
        };
      }

      lines.splice(matchIdx, expectedOld.length, ...replacementNew);
      lineDelta += replacementNew.length - expectedOld.length;
      appliedCount++;
    }

    const modified = lines.join("\n");
    const diff = this.generateUnifiedDiff(content, modified);

    return {
      success: true,
      modifiedContent: modified,
      hunksParsed: hunks.length,
      hunksApplied: appliedCount,
      diffPreview: diff,
      error: null,
    };
  }

  // ---------------------------------------------------------------------------
  // SEARCH/REPLACE Block Parser & Applicator (Aider / LLM Standard Pattern)
  // ---------------------------------------------------------------------------

  parseSearchReplaceBlocks(blockText: string): SearchReplaceBlock[] {
    const blocks: SearchReplaceBlock[] = [];
    const lines = blockText.split("\n");

    let state: "IDLE" | "SEARCH" | "REPLACE" = "IDLE";
    let currentFilename: string | undefined = undefined;
    let searchLines: string[] = [];
    let replaceLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith("<<<<<<< SEARCH") || trimmed === "<<<<<<<") {
        state = "SEARCH";
        searchLines = [];
        replaceLines = [];
      } else if (state === "SEARCH" && (trimmed.startsWith("=======") || trimmed === "=======")) {
        state = "REPLACE";
      } else if (state === "REPLACE" && (trimmed.startsWith(">>>>>>> REPLACE") || trimmed === ">>>>>>>")) {
        blocks.push({
          filename: currentFilename,
          oldString: searchLines.join("\n"),
          newString: replaceLines.join("\n"),
        });
        state = "IDLE";
        searchLines = [];
        replaceLines = [];
      } else if (state === "SEARCH") {
        searchLines.push(line);
      } else if (state === "REPLACE") {
        replaceLines.push(line);
      } else if (state === "IDLE") {
        // Check for filename header like "### filename" or "filename"
        if (trimmed.startsWith("### ") || trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
          currentFilename = trimmed.replace(/^#+\s*/, "").trim();
        } else if (trimmed.length > 0 && !trimmed.startsWith("`") && trimmed.includes(".")) {
          currentFilename = trimmed;
        }
      }
    }

    return blocks;
  }

  applySearchReplaceBlocks(
    content: string,
    blockText: string,
    options: { dryRun?: boolean } = {}
  ): FuzzyMultiMatchResult {
    const blocks = this.parseSearchReplaceBlocks(blockText);
    if (blocks.length === 0) {
      return {
        success: false,
        modifiedContent: content,
        totalHunks: 0,
        appliedHunks: 0,
        isFullyIdempotent: false,
        strategiesUsed: [],
        error: "No valid <<<<<<< SEARCH ... ======= ... >>>>>>> REPLACE blocks found.",
      };
    }

    const hunks: FuzzyReplacementHunk[] = blocks.map((b) => ({
      oldString: b.oldString,
      newString: b.newString,
    }));

    return this.findAndReplaceMulti(content, hunks, options);
  }

  // ---------------------------------------------------------------------------
  // Line-Hint Centered Fuzzy Matcher (Disambiguation by Line Number)
  // ---------------------------------------------------------------------------

  findAndReplaceAtLine(
    content: string,
    oldString: string,
    newString: string,
    lineHint: number,
    lineTolerance: number = 15,
    options: { dryRun?: boolean } = {}
  ): FuzzyMatchResult {
    const lines = content.split("\n");
    const totalLines = lines.length;

    const oldLinesCount = oldString.split("\n").length;
    const startLineIdx = Math.max(0, lineHint - 1 - lineTolerance);
    const endLineIdx = Math.min(totalLines, lineHint - 1 + oldLinesCount + lineTolerance);

    const windowLines = lines.slice(startLineIdx, endLineIdx);
    const windowContent = windowLines.join("\n");

    const windowResult = this.findAndReplace(windowContent, oldString, newString, false, options);
    if (!windowResult.success) {
      return windowResult;
    }

    // Splice window result back into content
    const prefix = lines.slice(0, startLineIdx).join("\n");
    const suffix = lines.slice(endLineIdx).join("\n");

    let fullModified = "";
    if (prefix.length > 0 && suffix.length > 0) {
      fullModified = prefix + "\n" + windowResult.modifiedContent + "\n" + suffix;
    } else if (prefix.length > 0) {
      fullModified = prefix + "\n" + windowResult.modifiedContent;
    } else if (suffix.length > 0) {
      fullModified = windowResult.modifiedContent + "\n" + suffix;
    } else {
      fullModified = windowResult.modifiedContent;
    }

    if (this.normalizeLineEndings) {
      fullModified = this.applyLineEnding(fullModified, this.detectLineEnding(content));
    }

    const diff = this.generateUnifiedDiff(content, fullModified);

    return {
      success: true,
      modifiedContent: options.dryRun ? content : fullModified,
      matchCount: 1,
      strategyUsed: windowResult.strategyUsed,
      isIdempotent: windowResult.isIdempotent,
      similarityScore: windowResult.similarityScore,
      diffPreview: diff,
      linesAffected: newString.split("\n").length,
      error: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-File Unified Patch Parser & Applicator
  // ---------------------------------------------------------------------------

  parseMultiFileUnifiedPatch(multiFilePatch: string): Record<string, string> {
    const files: Record<string, string[]> = {};
    const lines = multiFilePatch.split("\n");
    let currentFile: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const diffGitMatch = line.match(/^diff --git a\/(.+?) b\/(.+?)$/);
      const minusHeaderMatch = line.match(/^--- (?:a\/)?(.+?)(?:\t.*)?$/);
      const plusHeaderMatch = line.match(/^\+\+\+ (?:b\/)?(.+?)(?:\t.*)?$/);

      if (diffGitMatch) {
        currentFile = diffGitMatch[2];
        if (!files[currentFile]) files[currentFile] = [];
        files[currentFile].push(line);
      } else if (minusHeaderMatch && !minusHeaderMatch[1].startsWith("/dev/null") && i + 1 < lines.length && lines[i + 1].startsWith("+++ ")) {
        // Look ahead to check if this is a new file header
        const nextPlus = lines[i + 1].match(/^\+\+\+ (?:b\/)?(.+?)(?:\t.*)?$/);
        currentFile = (nextPlus && !nextPlus[1].startsWith("/dev/null")) ? nextPlus[1] : minusHeaderMatch[1];
        if (!files[currentFile]) files[currentFile] = [];
        files[currentFile].push(line);
      } else if (currentFile) {
        files[currentFile].push(line);
      }
    }

    const result: Record<string, string> = {};
    for (const [filename, patchLines] of Object.entries(files)) {
      result[filename] = patchLines.join("\n");
    }
    return result;
  }

  applyMultiFileUnifiedPatch(
    fileContents: Record<string, string>,
    multiFilePatch: string
  ): MultiFilePatchResult {
    const parsedPatches = this.parseMultiFileUnifiedPatch(multiFilePatch);
    const fileResults: Record<string, UnifiedPatchResult> = {};
    let successfulCount = 0;
    const filenames = Object.keys(parsedPatches);

    if (filenames.length === 0) {
      return {
        success: false,
        fileResults: {},
        totalFiles: 0,
        successfulFiles: 0,
        error: "No file patches detected in multi-file diff.",
      };
    }

    for (let i = 0; i < filenames.length; i++) {
      const file = filenames[i];
      const patch = parsedPatches[file];
      const content = fileContents[file] || "";

      const res = this.applyUnifiedPatch(content, patch);
      fileResults[file] = res;
      if (res.success) {
        successfulCount++;
      }
    }

    return {
      success: successfulCount === filenames.length,
      fileResults,
      totalFiles: filenames.length,
      successfulFiles: successfulCount,
      error: successfulCount === filenames.length ? null : "One or more files failed to patch cleanly.",
    };
  }

  // ---------------------------------------------------------------------------
  // Git Conflict Marker Parser & Deterministic Resolver
  // ---------------------------------------------------------------------------

  parseConflictMarkers(content: string): ConflictMarkerChunk[] {
    const chunks: ConflictMarkerChunk[] = [];
    const lines = content.split("\n");

    let state: "IDLE" | "OURS" | "BASE" | "THEIRS" = "IDLE";
    let startLine = 0;
    let oursHeader = "";
    let theirsHeader = "";
    let oursLines: string[] = [];
    let baseLines: string[] = [];
    let theirsLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith("<<<<<<<")) {
        state = "OURS";
        startLine = i + 1;
        oursHeader = trimmed.replace(/^<{7}\s*/, "");
        oursLines = [];
        baseLines = [];
        theirsLines = [];
      } else if (state === "OURS" && trimmed.startsWith("|||||||")) {
        state = "BASE";
      } else if ((state === "OURS" || state === "BASE") && trimmed === "=======") {
        state = "THEIRS";
      } else if (state === "THEIRS" && trimmed.startsWith(">>>>>>>")) {
        theirsHeader = trimmed.replace(/^>{7}\s*/, "");
        chunks.push({
          startLine,
          endLine: i + 1,
          oursHeader,
          oursContent: oursLines.join("\n"),
          baseContent: baseLines.length > 0 ? baseLines.join("\n") : undefined,
          theirsHeader,
          theirsContent: theirsLines.join("\n"),
        });
        state = "IDLE";
      } else if (state === "OURS") {
        oursLines.push(line);
      } else if (state === "BASE") {
        baseLines.push(line);
      } else if (state === "THEIRS") {
        theirsLines.push(line);
      }
    }

    return chunks;
  }

  resolveConflictMarkers(
    content: string,
    strategy: ConflictResolutionStrategy | ((chunk: ConflictMarkerChunk) => string) = "take_ours"
  ): ConflictResolutionResult {
    const chunks = this.parseConflictMarkers(content);
    if (chunks.length === 0) {
      return {
        success: true,
        modifiedContent: content,
        conflictsFound: 0,
        conflictsResolved: 0,
        chunks: [],
        error: null,
      };
    }

    const lines = content.split("\n");
    const sortedChunks = [...chunks].sort((a, b) => b.startLine - a.startLine);

    for (const chunk of sortedChunks) {
      let replacement = "";
      if (typeof strategy === "function") {
        replacement = strategy(chunk);
      } else if (strategy === "take_ours") {
        replacement = chunk.oursContent;
      } else if (strategy === "take_theirs") {
        replacement = chunk.theirsContent;
      } else if (strategy === "take_both_ours_first") {
        replacement =
          chunk.oursContent +
          (chunk.oursContent.length > 0 && chunk.theirsContent.length > 0 ? "\n" : "") +
          chunk.theirsContent;
      } else if (strategy === "take_both_theirs_first") {
        replacement =
          chunk.theirsContent +
          (chunk.theirsContent.length > 0 && chunk.oursContent.length > 0 ? "\n" : "") +
          chunk.oursContent;
      }

      const replacementLines = replacement.length > 0 ? replacement.split("\n") : [];
      const deleteCount = chunk.endLine - chunk.startLine + 1;
      lines.splice(chunk.startLine - 1, deleteCount, ...replacementLines);
    }

    let modifiedContent = lines.join("\n");
    if (this.normalizeLineEndings) {
      modifiedContent = this.applyLineEnding(modifiedContent, this.detectLineEnding(content));
    }

    return {
      success: true,
      modifiedContent,
      conflictsFound: chunks.length,
      conflictsResolved: chunks.length,
      chunks,
      error: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Indentation Style Detection & Proportional Harmonizer
  // ---------------------------------------------------------------------------

  detectIndentationStyle(content: string): IndentationStyle {
    const lines = content.split("\n");
    let tabLines = 0;
    let spaceLines = 0;
    const spaceIndents: number[] = [];

    for (const line of lines) {
      if (line.trim().length === 0) continue;
      const leadingTabs = line.match(/^\t+/);
      const leadingSpaces = line.match(/^ +/);

      if (leadingTabs) {
        tabLines++;
      } else if (leadingSpaces) {
        spaceLines++;
        spaceIndents.push(leadingSpaces[0].length);
      }
    }

    if (tabLines === 0 && spaceLines === 0) {
      return { type: "spaces", size: 2, confidence: 1.0 };
    }

    if (tabLines > spaceLines * 2) {
      return { type: "tabs", size: 1, confidence: tabLines / (tabLines + spaceLines) };
    }

    if (spaceLines > tabLines * 2) {
      const counts: Record<number, number> = { 2: 0, 4: 0, 8: 0 };
      for (const indent of spaceIndents) {
        if (indent % 4 === 0) counts[4]++;
        if (indent % 2 === 0) counts[2]++;
        if (indent % 8 === 0) counts[8]++;
      }

      let detectedSize = 2;
      if (counts[4] >= counts[2] * 0.7 && counts[4] > 0) {
        detectedSize = 4;
      }
      return { type: "spaces", size: detectedSize, confidence: spaceLines / (tabLines + spaceLines) };
    }

    return { type: "mixed", size: 2, confidence: 0.5 };
  }

  harmonizeIndentation(targetContent: string, snippet: string): IndentationHarmonizationResult {
    const targetStyle = this.detectIndentationStyle(targetContent);
    const snippetStyle = this.detectIndentationStyle(snippet);

    const snippetLines = snippet.split("\n");
    let linesAdjusted = 0;
    const harmonizedLines: string[] = [];

    const snippetStep = snippetStyle.size || 2;
    const targetStep = targetStyle.size || 2;

    for (const line of snippetLines) {
      if (line.trim().length === 0) {
        harmonizedLines.push(line);
        continue;
      }

      const match = line.match(/^([ \t]+)(.*)$/);
      if (!match) {
        harmonizedLines.push(line);
        continue;
      }

      const indentStr = match[1];
      const rest = match[2];

      let logicalLevel = 0;
      if (indentStr.includes("\t")) {
        logicalLevel = indentStr.split("\t").length - 1;
      } else {
        logicalLevel = Math.round(indentStr.length / snippetStep);
      }

      let newIndent = "";
      if (targetStyle.type === "tabs") {
        newIndent = "\t".repeat(logicalLevel);
      } else {
        newIndent = " ".repeat(logicalLevel * targetStep);
      }

      if (newIndent !== indentStr) {
        linesAdjusted++;
      }
      harmonizedLines.push(newIndent + rest);
    }

    return {
      originalSnippet: snippet,
      harmonizedSnippet: harmonizedLines.join("\n"),
      detectedStyle: targetStyle,
      linesAdjusted,
    };
  }

  // ---------------------------------------------------------------------------
  // Syntax-Aware Structural Boundary Snapping
  // ---------------------------------------------------------------------------

  snapToSyntaxBoundaries(content: string, start: number, end: number): SyntaxBoundarySnapResult {
    let snappedStart = Math.max(0, Math.min(content.length, start));
    let snappedEnd = Math.max(0, Math.min(content.length, end));

    // Snap start back if cutting in middle of word token
    if (snappedStart > 0 && snappedStart < content.length) {
      const prevChar = content[snappedStart - 1];
      const currChar = content[snappedStart];
      if (/[\w$]/.test(prevChar) && /[\w$]/.test(currChar)) {
        while (snappedStart > 0 && /[\w$]/.test(content[snappedStart - 1])) {
          snappedStart--;
        }
      }
    }

    // Snap end forward if cutting in middle of word token
    if (snappedEnd > 0 && snappedEnd < content.length) {
      const prevChar = content[snappedEnd - 1];
      const currChar = content[snappedEnd];
      if (/[\w$]/.test(prevChar) && /[\w$]/.test(currChar)) {
        while (snappedEnd < content.length && /[\w$]/.test(content[snappedEnd])) {
          snappedEnd++;
        }
      }
    }

    const adjustmentMade = snappedStart !== start || snappedEnd !== end;
    return {
      originalStart: start,
      originalEnd: end,
      snappedStart,
      snappedEnd,
      snappedSubstring: content.slice(snappedStart, snappedEnd),
      adjustmentMade,
    };
  }

  // ---------------------------------------------------------------------------
  // Atomic Multi-File Workspace Transaction Engine
  // ---------------------------------------------------------------------------

  applyMultiFileTransaction(
    fileContents: Record<string, string>,
    transactions: MultiFileTransactionHunk[],
    options: { dryRun?: boolean } = {}
  ): MultiFileTransactionResult {
    const committedFiles: Record<string, string> = {};
    const fileErrors: Record<string, string> = {};
    let rollbackTriggered = false;

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const filePath = tx.filePath;
      let currentContent =
        committedFiles[filePath] !== undefined ? committedFiles[filePath] : fileContents[filePath] || "";

      if (tx.searchReplaceBlocks) {
        const res = this.applySearchReplaceBlocks(currentContent, tx.searchReplaceBlocks, options);
        if (!res.success) {
          fileErrors[filePath] = res.error || `Failed applying SEARCH/REPLACE blocks to ${filePath}`;
          rollbackTriggered = true;
          break;
        }
        currentContent = res.modifiedContent;
      }

      if (tx.hunks && tx.hunks.length > 0) {
        const res = this.findAndReplaceMulti(currentContent, tx.hunks, options);
        if (!res.success) {
          fileErrors[filePath] = res.error || `Failed applying hunks to ${filePath}`;
          rollbackTriggered = true;
          break;
        }
        currentContent = res.modifiedContent;
      }

      if (tx.unifiedPatch) {
        const res = this.applyUnifiedPatch(currentContent, tx.unifiedPatch);
        if (!res.success) {
          fileErrors[filePath] = res.error || `Failed applying unified patch to ${filePath}`;
          rollbackTriggered = true;
          break;
        }
        currentContent = res.modifiedContent;
      }

      committedFiles[filePath] = currentContent;
    }

    if (rollbackTriggered) {
      return {
        success: false,
        committedFiles: {},
        totalFilesTargeted: transactions.length,
        totalFilesModified: 0,
        rollbackTriggered: true,
        fileErrors,
        error: `Transaction rolled back due to error(s): ${Object.values(fileErrors).join("; ")}`,
      };
    }

    return {
      success: true,
      committedFiles,
      totalFilesTargeted: transactions.length,
      totalFilesModified: Object.keys(committedFiles).length,
      rollbackTriggered: false,
      fileErrors: {},
      error: null,
    };
  }

  // ---------------------------------------------------------------------------
  // 12 Matching Strategies
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

  private strategyEllipsisWildcard(content: string, target: string): FuzzyMatchSpan[] {
    const isEllipsisMarker = (line: string) => {
      const t = line.trim();
      return (
        t === "..." ||
        t === "// ..." ||
        t === "/* ... */" ||
        t === "# ..." ||
        t === "// ... existing code ..." ||
        t === "/* ... existing code ... */" ||
        t === "# ... existing code ..." ||
        t.includes("... existing code ...")
      );
    };

    const targetLines = target.split("\n");
    const ellipsisIndices: number[] = [];
    for (let i = 0; i < targetLines.length; i++) {
      if (isEllipsisMarker(targetLines[i])) {
        ellipsisIndices.push(i);
      }
    }

    if (ellipsisIndices.length === 0) return [];

    const prefixLines = targetLines.slice(0, ellipsisIndices[0]).map((l) => l.trim()).filter((l) => l.length > 0);
    const suffixLines = targetLines
      .slice(ellipsisIndices[ellipsisIndices.length - 1] + 1)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (prefixLines.length === 0 || suffixLines.length === 0) return [];

    const contentLines = content.split("\n");
    const lineOffsets: number[] = [0];
    for (let i = 0; i < content.length; i++) {
      if (content[i] === "\n") lineOffsets.push(i + 1);
    }

    const matches: FuzzyMatchSpan[] = [];

    for (let i = 0; i <= contentLines.length - prefixLines.length - suffixLines.length; i++) {
      let prefixMatch = true;
      for (let p = 0; p < prefixLines.length; p++) {
        if (contentLines[i + p].trim() !== prefixLines[p]) {
          prefixMatch = false;
          break;
        }
      }
      if (!prefixMatch) continue;

      const searchStart = i + prefixLines.length;
      for (let s = searchStart; s <= contentLines.length - suffixLines.length; s++) {
        let suffixMatch = true;
        for (let p = 0; p < suffixLines.length; p++) {
          if (contentLines[s + p].trim() !== suffixLines[p]) {
            suffixMatch = false;
            break;
          }
        }
        if (suffixMatch) {
          const start = lineOffsets[i];
          const endLineIdx = s + suffixLines.length - 1;
          const end =
            endLineIdx < contentLines.length - 1
              ? lineOffsets[endLineIdx + 1] - 1
              : content.length;
          matches.push([start, end]);
          break;
        }
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

    const nativeEol = this.detectLineEnding(content);

    // Check idempotency
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
      { name: "ellipsis_wildcard", fn: this.strategyEllipsisWildcard.bind(this) },
      { name: "unicode_normalized", fn: this.strategyUnicodeNormalized.bind(this) },
      { name: "block_anchor", fn: this.strategyBlockAnchor.bind(this) },
      { name: "context_aware", fn: this.strategyContextAware.bind(this) },
    ];

    const similarityStrategies = new Set<FuzzyStrategyName>(["block_anchor", "context_aware", "ellipsis_wildcard"]);

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
          continue;
        }

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

        let modified = content;
        const sortedMatches = [...matches].sort((a, b) => b[0] - a[0]);

        for (let m = 0; m < sortedMatches.length; m++) {
          const span = sortedMatches[m];
          const [start, end] = span;
          const matchedRegion = content.slice(start, end);

          let finalReplacement = this.maybeUnescapeNewString(newString, matchedRegion);

          if (name !== "exact" && name !== "ellipsis_wildcard") {
            finalReplacement = this.reindentReplacement(matchedRegion, oldString, finalReplacement);
          }

          if (name === "unicode_normalized") {
            finalReplacement = this.preserveUnicodeInReplacement(matchedRegion, oldString, finalReplacement);
          }

          modified = modified.slice(0, start) + finalReplacement + modified.slice(end);
        }

        if (this.normalizeLineEndings) {
          modified = this.applyLineEnding(modified, nativeEol);
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

    const nativeEol = this.detectLineEnding(content);

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

      const strategies: Array<{ name: FuzzyStrategyName; fn: (c: string, t: string) => FuzzyMatchSpan[] }> = [
        { name: "exact", fn: this.strategyExact.bind(this) },
        { name: "line_trimmed", fn: this.strategyLineTrimmed.bind(this) },
        { name: "whitespace_normalized", fn: this.strategyWhitespaceNormalized.bind(this) },
        { name: "indentation_flexible", fn: this.strategyIndentationFlexible.bind(this) },
        { name: "escape_normalized", fn: this.strategyEscapeNormalized.bind(this) },
        { name: "trimmed_boundary", fn: this.strategyTrimmedBoundary.bind(this) },
        { name: "comment_tolerant", fn: this.strategyCommentTolerant.bind(this) },
        { name: "token_normalized", fn: this.strategyTokenNormalized.bind(this) },
        { name: "ellipsis_wildcard", fn: this.strategyEllipsisWildcard.bind(this) },
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

    let modified = content;
    const sortedDescending = [...resolved].sort((a, b) => b.span[0] - a.span[0]);

    for (let r = 0; r < sortedDescending.length; r++) {
      const item = sortedDescending[r];
      const [start, end] = item.span;
      const matchedRegion = content.slice(start, end);

      let finalReplacement = this.maybeUnescapeNewString(item.replacement, matchedRegion);
      if (item.strategy !== "exact" && item.strategy !== "ellipsis_wildcard") {
        finalReplacement = this.reindentReplacement(matchedRegion, hunks[item.index].oldString, finalReplacement);
      }
      if (item.strategy === "unicode_normalized") {
        finalReplacement = this.preserveUnicodeInReplacement(matchedRegion, hunks[item.index].oldString, finalReplacement);
      }

      modified = modified.slice(0, start) + finalReplacement + modified.slice(end);
    }

    if (this.normalizeLineEndings) {
      modified = this.applyLineEnding(modified, nativeEol);
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

  // ---------------------------------------------------------------------------
  // Fuzzy 3-Way Merge & Reconciliation Engine
  // ---------------------------------------------------------------------------

  /**
   * Performs a 3-way merge between baseContent, oursContent, and theirsContent.
   */
  threeWayMerge(
    baseContent: string,
    oursContent: string,
    theirsContent: string,
    options: ThreeWayMergeOptions = {}
  ): ThreeWayMergeResult {
    const nativeEol = this.detectLineEnding(baseContent || oursContent);
    const baseLines = baseContent.replace(/\r\n/g, "\n").split("\n");
    const oursLines = oursContent.replace(/\r\n/g, "\n").split("\n");
    const theirsLines = theirsContent.replace(/\r\n/g, "\n").split("\n");

    const oursLabel = options.oursLabel || "OURS";
    const theirsLabel = options.theirsLabel || "THEIRS";
    const baseLabel = options.baseLabel || "BASE";
    const resolution = options.conflictResolution || "markers";

    // Fast path: if ours equals theirs, return ours
    if (oursContent === theirsContent) {
      return {
        success: true,
        mergedContent: this.applyLineEnding(oursContent, nativeEol),
        cleanHunksApplied: 1,
        conflictCount: 0,
        conflictChunks: [],
        error: null,
      };
    }

    // Fast path: if ours equals base, return theirs
    if (oursContent === baseContent) {
      return {
        success: true,
        mergedContent: this.applyLineEnding(theirsContent, nativeEol),
        cleanHunksApplied: 1,
        conflictCount: 0,
        conflictChunks: [],
        error: null,
      };
    }

    // Fast path: if theirs equals base, return ours
    if (theirsContent === baseContent) {
      return {
        success: true,
        mergedContent: this.applyLineEnding(oursContent, nativeEol),
        cleanHunksApplied: 1,
        conflictCount: 0,
        conflictChunks: [],
        error: null,
      };
    }

    const mergedLines: string[] = [];
    const conflictChunks: ConflictMarkerChunk[] = [];
    let cleanHunksApplied = 0;
    let conflictCount = 0;

    let bIdx = 0;
    let oIdx = 0;
    let tIdx = 0;

    const findNextCommon = (bStart: number, oStart: number, tStart: number): { b: number; o: number; t: number } | null => {
      for (let b = bStart; b < baseLines.length; b++) {
        const target = baseLines[b];
        const o = oursLines.indexOf(target, oStart);
        const t = theirsLines.indexOf(target, tStart);
        if (o !== -1 && t !== -1) {
          return { b, o, t };
        }
      }
      return null;
    };

    while (bIdx < baseLines.length || oIdx < oursLines.length || tIdx < theirsLines.length) {
      const common = findNextCommon(bIdx, oIdx, tIdx);
      const bEnd = common ? common.b : baseLines.length;
      const oEnd = common ? common.o : oursLines.length;
      const tEnd = common ? common.t : theirsLines.length;

      const bChunk = baseLines.slice(bIdx, bEnd);
      const oChunk = oursLines.slice(oIdx, oEnd);
      const tChunk = theirsLines.slice(tIdx, tEnd);

      const oChanged = oChunk.join("\n") !== bChunk.join("\n");
      const tChanged = tChunk.join("\n") !== bChunk.join("\n");

      if (!oChanged && !tChanged) {
        mergedLines.push(...bChunk);
      } else if (oChanged && !tChanged) {
        mergedLines.push(...oChunk);
        cleanHunksApplied++;
      } else if (!oChanged && tChanged) {
        mergedLines.push(...tChunk);
        cleanHunksApplied++;
      } else if (oChunk.join("\n") === tChunk.join("\n")) {
        mergedLines.push(...oChunk);
        cleanHunksApplied++;
      } else {
        conflictCount++;
        const startLine = mergedLines.length + 1;

        if (resolution === "ours") {
          mergedLines.push(...oChunk);
        } else if (resolution === "theirs") {
          mergedLines.push(...tChunk);
        } else if (resolution === "both_ours_first") {
          mergedLines.push(...oChunk, ...tChunk);
        } else if (resolution === "both_theirs_first") {
          mergedLines.push(...tChunk, ...oChunk);
        } else {
          mergedLines.push(`<<<<<<< ${oursLabel}`);
          mergedLines.push(...oChunk);
          if (bChunk.length > 0) {
            mergedLines.push(`||||||| ${baseLabel}`);
            mergedLines.push(...bChunk);
          }
          mergedLines.push("=======");
          mergedLines.push(...tChunk);
          mergedLines.push(`>>>>>>> ${theirsLabel}`);
        }

        const endLine = mergedLines.length;
        conflictChunks.push({
          startLine,
          endLine,
          oursHeader: oursLabel,
          oursContent: oChunk.join("\n"),
          baseContent: bChunk.join("\n"),
          theirsHeader: theirsLabel,
          theirsContent: tChunk.join("\n"),
        });
      }

      if (common) {
        mergedLines.push(baseLines[common.b]);
        bIdx = common.b + 1;
        oIdx = common.o + 1;
        tIdx = common.t + 1;
      } else {
        break;
      }
    }

    let finalContent = mergedLines.join("\n");
    if (this.normalizeLineEndings) {
      finalContent = this.applyLineEnding(finalContent, nativeEol);
    }

    return {
      success: resolution !== "markers" || conflictCount === 0,
      mergedContent: finalContent,
      cleanHunksApplied,
      conflictCount,
      conflictChunks,
      error: conflictCount > 0 && resolution === "markers" ? `Encountered ${conflictCount} merge conflict(s).` : null,
    };
  }

  // ---------------------------------------------------------------------------
  // LSP TextEdit & WorkspaceEdit Interoperability Engine
  // ---------------------------------------------------------------------------

  /**
   * Applies an array of LSP-compliant 0-indexed TextEdit objects to content.
   */
  applyLspTextEdits(content: string, edits: readonly LspTextEdit[]): LspApplyResult {
    if (edits.length === 0) {
      return { success: true, modifiedContent: content, editsApplied: 0, error: null };
    }

    const nativeEol = this.detectLineEnding(content);
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const lineOffsets: number[] = [0];
    for (let i = 0; i < lines.length; i++) {
      lineOffsets.push(lineOffsets[i] + lines[i].length + 1);
    }

    interface ResolvedEdit {
      startOffset: number;
      endOffset: number;
      newText: string;
      originalIndex: number;
    }

    const resolved: ResolvedEdit[] = [];
    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];
      const startLine = edit.range.start.line;
      const startChar = edit.range.start.character;
      const endLine = edit.range.end.line;
      const endChar = edit.range.end.character;

      if (startLine < 0 || startLine >= lines.length) {
        return { success: false, modifiedContent: content, editsApplied: 0, error: `Invalid start line ${startLine} in edit #${i + 1}.` };
      }
      if (endLine < 0 || endLine >= lines.length) {
        return { success: false, modifiedContent: content, editsApplied: 0, error: `Invalid end line ${endLine} in edit #${i + 1}.` };
      }

      const startOffset = Math.min(lineOffsets[startLine] + startChar, content.length);
      const endOffset = Math.min(lineOffsets[endLine] + endChar, content.length);

      if (startOffset > endOffset) {
        return { success: false, modifiedContent: content, editsApplied: 0, error: `Start offset (${startOffset}) exceeds end offset (${endOffset}) in edit #${i + 1}.` };
      }

      resolved.push({ startOffset, endOffset, newText: edit.newText, originalIndex: i });
    }

    const sortedAsc = [...resolved].sort((a, b) => a.startOffset - b.startOffset);
    for (let i = 0; i < sortedAsc.length - 1; i++) {
      if (sortedAsc[i].endOffset > sortedAsc[i + 1].startOffset) {
        return {
          success: false,
          modifiedContent: content,
          editsApplied: 0,
          error: `Overlapping LSP edits detected between edit #${sortedAsc[i].originalIndex + 1} and edit #${sortedAsc[i + 1].originalIndex + 1}.`,
        };
      }
    }

    let modified = content;
    const sortedDesc = [...resolved].sort((a, b) => b.startOffset - a.startOffset);
    for (const edit of sortedDesc) {
      modified = modified.slice(0, edit.startOffset) + edit.newText + modified.slice(edit.endOffset);
    }

    if (this.normalizeLineEndings) {
      modified = this.applyLineEnding(modified, nativeEol);
    }

    return {
      success: true,
      modifiedContent: modified,
      editsApplied: edits.length,
      error: null,
    };
  }

  /**
   * Converts fuzzy replacement hunks into standard 0-indexed LSP TextEdit objects.
   */
  fuzzyHunksToLspEdits(content: string, hunks: readonly FuzzyReplacementHunk[]): LspTextEdit[] {
    const lspEdits: LspTextEdit[] = [];
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const lineOffsets: number[] = [0];
    for (let i = 0; i < lines.length; i++) {
      lineOffsets.push(lineOffsets[i] + lines[i].length + 1);
    }

    const offsetToPosition = (offset: number): LspPosition => {
      for (let l = lineOffsets.length - 1; l >= 0; l--) {
        if (offset >= lineOffsets[l]) {
          return { line: l, character: offset - lineOffsets[l] };
        }
      }
      return { line: 0, character: offset };
    };

    for (const hunk of hunks) {
      const matches = this.findMatchSpans(content, hunk.oldString);
      if (matches.length > 0) {
        const matchSpan = matches[0];
        lspEdits.push({
          range: {
            start: offsetToPosition(matchSpan[0]),
            end: offsetToPosition(matchSpan[1]),
          },
          newText: hunk.newString,
        });
      }
    }

    return lspEdits;
  }

  /**
   * Applies an LSP WorkspaceEdit across multiple files in memory with atomic rollback.
   */
  applyLspWorkspaceEdit(
    fileContents: Record<string, string>,
    workspaceEdit: LspWorkspaceEdit,
    options: { dryRun?: boolean } = {}
  ): MultiFileTransactionResult {
    const committedFiles: Record<string, string> = {};
    const fileErrors: Record<string, string> = {};
    const targetPaths = Object.keys(workspaceEdit.changes);

    for (const filePath of targetPaths) {
      const currentContent = fileContents[filePath];
      if (currentContent === undefined) {
        fileErrors[filePath] = `Target file '${filePath}' not found in workspace file map.`;
        return {
          success: false,
          committedFiles: {},
          totalFilesTargeted: targetPaths.length,
          totalFilesModified: 0,
          rollbackTriggered: true,
          fileErrors,
          error: `Transaction rolled back: File '${filePath}' not found.`,
        };
      }

      const edits = workspaceEdit.changes[filePath];
      const res = this.applyLspTextEdits(currentContent, edits);
      if (!res.success) {
        fileErrors[filePath] = res.error || "Failed to apply LSP edits";
        return {
          success: false,
          committedFiles: {},
          totalFilesTargeted: targetPaths.length,
          totalFilesModified: 0,
          rollbackTriggered: true,
          fileErrors,
          error: `Transaction rolled back: Failed on '${filePath}' (${res.error}).`,
        };
      }

      committedFiles[filePath] = res.modifiedContent;
    }

    if (options.dryRun) {
      return {
        success: true,
        committedFiles: {},
        totalFilesTargeted: targetPaths.length,
        totalFilesModified: targetPaths.length,
        rollbackTriggered: false,
        fileErrors: {},
        error: null,
      };
    }

    return {
      success: true,
      committedFiles,
      totalFilesTargeted: targetPaths.length,
      totalFilesModified: targetPaths.length,
      rollbackTriggered: false,
      fileErrors: {},
      error: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Structural Syntax & Balanced Bracket / Tag Auto-Healer
  // ---------------------------------------------------------------------------

  /**
   * Validates structural syntax of a code snippet and auto-repairs unbalanced brackets or unclosed strings.
   */
  validateAndRepairCodeBlock(codeSnippet: string): SyntaxRepairResult {
    const issues: SyntaxBalanceIssue[] = [];
    const repairs: string[] = [];

    const bracketStack: Array<{ char: string; line: number; col: number }> = [];
    const bracketPairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
    const closeToOpen: Record<string, string> = { ")": "(", "}": "{", "]": "[" };

    let inString: "'" | '"' | "`" | null = null;
    let stringStart = { line: 1, col: 1 };
    let escaped = false;

    let line = 1;
    let col = 0;

    for (let i = 0; i < codeSnippet.length; i++) {
      const char = codeSnippet[i];
      col++;

      if (char === "\n") {
        if (inString === "'" || inString === '"') {
          issues.push({
            type: "unclosed_string",
            token: inString,
            line: stringStart.line,
            column: stringStart.col,
            message: `Unclosed string literal ${inString} before newline.`,
          });
          inString = null;
        }
        line++;
        col = 0;
        escaped = false;
        continue;
      }

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (inString) {
        if (char === inString) {
          inString = null;
        }
        continue;
      }

      if (char === "'" || char === '"' || char === "`") {
        inString = char;
        stringStart = { line, col };
        continue;
      }

      if (bracketPairs[char]) {
        bracketStack.push({ char, line, col });
      } else if (closeToOpen[char]) {
        const top = bracketStack[bracketStack.length - 1];
        if (top && top.char === closeToOpen[char]) {
          bracketStack.pop();
        } else {
          issues.push({
            type: "unmatched_bracket",
            token: char,
            line,
            column: col,
            message: `Unmatched closing bracket '${char}'.`,
          });
        }
      }
    }

    let repaired = codeSnippet;

    if (inString) {
      issues.push({
        type: "unclosed_string",
        token: inString,
        line: stringStart.line,
        column: stringStart.col,
        message: `Unclosed string literal ${inString} at end of snippet.`,
      });
      repaired += inString;
      repairs.push(`Appended closing quote ${inString}`);
    }

    while (bracketStack.length > 0) {
      const top = bracketStack.pop()!;
      const closing = bracketPairs[top.char];
      issues.push({
        type: "unmatched_bracket",
        token: top.char,
        line: top.line,
        column: top.col,
        message: `Unclosed opening bracket '${top.char}'.`,
      });
      repaired += closing;
      repairs.push(`Appended closing bracket '${closing}'`);
    }

    return {
      isValid: issues.length === 0,
      repairedCode: repaired,
      issuesFound: issues,
      repairsApplied: repairs,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Candidate Semantic Jaccard & Levenshtein Match Scorer
  // ---------------------------------------------------------------------------

  /**
   * Computes semantic Jaccard and Levenshtein similarity to rank candidate match spans for a search snippet.
   */
  rankCandidateMatches(content: string, searchSnippet: string, limit: number = 5): CandidateRankingResult {
    if (!content || !searchSnippet) {
      return { bestMatch: null, candidates: [], totalEvaluated: 0, searchSnippet };
    }

    const searchTokens = new Set(searchSnippet.trim().split(/\s+/).filter(Boolean));
    const searchLines = searchSnippet.split(/\r?\n/).length;
    const contentLines = content.split(/\r?\n/);

    const candidates: CandidateMatchScore[] = [];
    const windowSize = Math.max(1, searchLines);

    for (let startLine = 0; startLine <= contentLines.length - windowSize; startLine++) {
      const endLine = startLine + windowSize;
      const candidateLines = contentLines.slice(startLine, endLine);
      const candidateSnippet = candidateLines.join("\n");

      const candidateTokens = new Set(candidateSnippet.trim().split(/\s+/).filter(Boolean));

      let intersection = 0;
      for (const token of searchTokens) {
        if (candidateTokens.has(token)) intersection++;
      }
      const union = searchTokens.size + candidateTokens.size - intersection;
      const jaccard = union > 0 ? intersection / union : 0;

      const levDist = this.levenshteinDistance(searchSnippet.trim(), candidateSnippet.trim());
      const maxLen = Math.max(searchSnippet.trim().length, candidateSnippet.trim().length, 1);
      const levSim = Math.max(0, 1 - levDist / maxLen);

      const combinedScore = 0.6 * jaccard + 0.4 * levSim;

      if (combinedScore > 0.1) {
        const startOffset = contentLines.slice(0, startLine).join("\n").length + (startLine > 0 ? 1 : 0);
        const endOffset = startOffset + candidateSnippet.length;

        const contextStart = Math.max(0, startLine - 2);
        const contextEnd = Math.min(contentLines.length, endLine + 2);
        const contextLines = contentLines.slice(contextStart, contextEnd);

        candidates.push({
          span: [startOffset, endOffset],
          startLine: startLine + 1,
          endLine,
          jaccardSimilarity: Number(jaccard.toFixed(4)),
          levenshteinSimilarity: Number(levSim.toFixed(4)),
          combinedScore: Number(combinedScore.toFixed(4)),
          candidateSnippet,
          contextLines,
        });
      }
    }

    candidates.sort((a, b) => b.combinedScore - a.combinedScore);
    const topCandidates = candidates.slice(0, limit);

    return {
      bestMatch: topCandidates[0] || null,
      candidates: topCandidates,
      totalEvaluated: candidates.length,
      searchSnippet,
    };
  }

  // ---------------------------------------------------------------------------
  // Patience Diff & Semantic Hunk Clustering
  // ---------------------------------------------------------------------------

  /**
   * Generates a Patience Diff, which aligns unique common lines as semantic anchors
   * to avoid ambiguous closing-brace matching and produce clean function/block diffs.
   */
  generatePatienceDiff(
    oldText: string,
    newText: string,
    filename: string = "file",
    options: PatienceDiffOptions = {}
  ): PatienceDiffResult {
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");
    const contextLines = options.contextLines ?? 3;

    if (oldText === newText) {
      return {
        diffText: "",
        hunks: [],
        uniqueCommonLinesMatched: 0,
        totalLinesChanged: 0,
        hasChanges: false,
      };
    }

    // Find unique lines in an array
    const findUniqueLines = (lines: readonly string[]): Map<string, number> => {
      const counts = new Map<string, number>();
      const indices = new Map<string, number>();
      for (let i = 0; i < lines.length; i++) {
        const line = options.ignoreWhitespace ? lines[i].trim() : lines[i];
        counts.set(line, (counts.get(line) || 0) + 1);
        indices.set(line, i);
      }
      const unique = new Map<string, number>();
      for (const [line, count] of counts.entries()) {
        if (count === 1) {
          unique.set(line, indices.get(line)!);
        }
      }
      return unique;
    };

    const oldUnique = findUniqueLines(oldLines);
    const newUnique = findUniqueLines(newLines);
    const commonUnique: Array<{ oldIdx: number; newIdx: number; line: string }> = [];

    for (const [line, oldIdx] of oldUnique.entries()) {
      if (newUnique.has(line)) {
        commonUnique.push({ oldIdx, newIdx: newUnique.get(line)!, line });
      }
    }

    commonUnique.sort((a, b) => a.oldIdx - b.oldIdx);

    // Compute Longest Increasing Subsequence (LIS) on newIdx
    const lis: Array<{ oldIdx: number; newIdx: number; line: string }> = [];
    if (commonUnique.length > 0) {
      const piles: number[] = [];
      const pileIndices: number[] = [];
      const parent = new Array<number>(commonUnique.length).fill(-1);

      for (let i = 0; i < commonUnique.length; i++) {
        const val = commonUnique[i].newIdx;
        let left = 0;
        let right = piles.length;
        while (left < right) {
          const mid = (left + right) >> 1;
          if (piles[mid] < val) left = mid + 1;
          else right = mid;
        }
        piles[left] = val;
        pileIndices[left] = i;
        if (left > 0) {
          parent[i] = pileIndices[left - 1];
        }
      }

      let curr = pileIndices[piles.length - 1];
      while (curr !== -1) {
        lis.push(commonUnique[curr]);
        curr = parent[curr];
      }
      lis.reverse();
    }

    // Partition oldLines and newLines by the matched anchors and construct diff
    const computeSliceDiff = (
      aStart: number,
      aEnd: number,
      bStart: number,
      bEnd: number
    ): Array<{ type: "equal" | "delete" | "insert"; line: string; oldLineNum: number; newLineNum: number }> => {
      const a = oldLines.slice(aStart, aEnd);
      const b = newLines.slice(bStart, bEnd);
      const m = a.length;
      const n = b.length;
      const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          if (a[i - 1] === b[j - 1]) {
            dp[i][j] = dp[i - 1][j - 1] + 1;
          } else {
            dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
          }
        }
      }

      let i = m;
      let j = n;
      const res: Array<{ type: "equal" | "delete" | "insert"; line: string; oldLineNum: number; newLineNum: number }> = [];

      while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
          res.push({ type: "equal", line: a[i - 1], oldLineNum: aStart + i, newLineNum: bStart + j });
          i--;
          j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
          res.push({ type: "insert", line: b[j - 1], oldLineNum: aStart + i, newLineNum: bStart + j });
          j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
          res.push({ type: "delete", line: a[i - 1], oldLineNum: aStart + i, newLineNum: bStart + j });
          i--;
        }
      }
      return res.reverse();
    };

    const diffOps: Array<{ type: "equal" | "delete" | "insert"; line: string; oldLineNum: number; newLineNum: number }> = [];
    let lastOld = 0;
    let lastNew = 0;

    for (const anchor of lis) {
      if (anchor.oldIdx > lastOld || anchor.newIdx > lastNew) {
        const sliceOps = computeSliceDiff(lastOld, anchor.oldIdx, lastNew, anchor.newIdx);
        diffOps.push(...sliceOps);
      }
      diffOps.push({
        type: "equal",
        line: oldLines[anchor.oldIdx],
        oldLineNum: anchor.oldIdx + 1,
        newLineNum: anchor.newIdx + 1,
      });
      lastOld = anchor.oldIdx + 1;
      lastNew = anchor.newIdx + 1;
    }

    if (lastOld < oldLines.length || lastNew < newLines.length) {
      const sliceOps = computeSliceDiff(lastOld, oldLines.length, lastNew, newLines.length);
      diffOps.push(...sliceOps);
    }

    // Cluster operations into hunks with context
    const hunks: PatienceDiffHunk[] = [];

    const changedIndices = new Set<number>();
    for (let idx = 0; idx < diffOps.length; idx++) {
      if (diffOps[idx].type !== "equal") {
        for (let c = Math.max(0, idx - contextLines); c <= Math.min(diffOps.length - 1, idx + contextLines); c++) {
          changedIndices.add(c);
        }
      }
    }

    let i = 0;
    let totalLinesChanged = 0;
    while (i < diffOps.length) {
      if (!changedIndices.has(i)) {
        i++;
        continue;
      }

      const currentHunkOps: typeof diffOps = [];
      while (i < diffOps.length && changedIndices.has(i)) {
        currentHunkOps.push(diffOps[i]);
        if (diffOps[i].type !== "equal") totalLinesChanged++;
        i++;
      }

      if (currentHunkOps.length > 0) {
        let oldStart = 0;
        let oldCount = 0;
        let newStart = 0;
        let newCount = 0;
        const lines: string[] = [];

        for (const op of currentHunkOps) {
          if (op.type === "equal") {
            if (oldStart === 0) oldStart = op.oldLineNum;
            if (newStart === 0) newStart = op.newLineNum;
            oldCount++;
            newCount++;
            lines.push(` ${op.line}`);
          } else if (op.type === "delete") {
            if (oldStart === 0) oldStart = op.oldLineNum;
            if (newStart === 0) newStart = op.newLineNum;
            oldCount++;
            lines.push(`-${op.line}`);
          } else if (op.type === "insert") {
            if (oldStart === 0) oldStart = op.oldLineNum;
            if (newStart === 0) newStart = op.newLineNum;
            newCount++;
            lines.push(`+${op.line}`);
          }
        }

        hunks.push({
          oldStart: oldStart || 1,
          oldCount,
          newStart: newStart || 1,
          newCount,
          lines,
        });
      }
    }

    const diffLines: string[] = [`--- a/${filename}`, `+++ b/${filename}`];
    for (const hunk of hunks) {
      diffLines.push(`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`);
      diffLines.push(...hunk.lines);
    }

    return {
      diffText: diffLines.join("\n"),
      hunks,
      uniqueCommonLinesMatched: lis.length,
      totalLinesChanged,
      hasChanges: hunks.length > 0,
    };
  }

  /**
   * Applies a patience diff patch to content.
   */
  applyPatiencePatch(content: string, patch: string): UnifiedPatchResult {
    return this.applyUnifiedPatch(content, patch);
  }

  // ---------------------------------------------------------------------------
  // Lexical Token Stream Align Matcher
  // ---------------------------------------------------------------------------

  /**
   * Tokenizes arbitrary source code into a stream of typed lexical tokens.
   */
  tokenizeCode(code: string): LexicalToken[] {
    const tokens: LexicalToken[] = [];
    let pos = 0;
    const len = code.length;

    const keywords = new Set([
      "function", "const", "let", "var", "return", "if", "else", "for", "while",
      "switch", "case", "break", "continue", "import", "export", "from", "default",
      "class", "interface", "type", "extends", "implements", "async", "await",
      "try", "catch", "finally", "throw", "new", "typeof", "instanceof", "in",
      "of", "void", "delete", "true", "false", "null", "undefined",
    ]);

    while (pos < len) {
      const char = code[pos];

      // Whitespace
      if (/\s/.test(char)) {
        const start = pos;
        while (pos < len && /\s/.test(code[pos])) pos++;
        tokens.push({ type: "WHITESPACE", value: code.slice(start, pos), start, end: pos });
        continue;
      }

      // Line Comment
      if (char === "/" && code[pos + 1] === "/") {
        const start = pos;
        while (pos < len && code[pos] !== "\n") pos++;
        tokens.push({ type: "COMMENT", value: code.slice(start, pos), start, end: pos });
        continue;
      }

      // Block Comment
      if (char === "/" && code[pos + 1] === "*") {
        const start = pos;
        pos += 2;
        while (pos < len && !(code[pos] === "*" && code[pos + 1] === "/")) pos++;
        if (pos < len) pos += 2;
        tokens.push({ type: "COMMENT", value: code.slice(start, pos), start, end: pos });
        continue;
      }

      // String literal
      if (char === '"' || char === "'" || char === "`") {
        const quote = char;
        const start = pos;
        pos++;
        while (pos < len && code[pos] !== quote) {
          if (code[pos] === "\\") pos++;
          pos++;
        }
        if (pos < len) pos++;
        tokens.push({ type: "STRING", value: code.slice(start, pos), start, end: pos });
        continue;
      }

      // Number literal
      if (/[0-9]/.test(char)) {
        const start = pos;
        while (pos < len && /[0-9.xXa-fA-F_]/.test(code[pos])) pos++;
        tokens.push({ type: "NUMBER", value: code.slice(start, pos), start, end: pos });
        continue;
      }

      // Identifiers / Keywords
      if (/[a-zA-Z_$]/.test(char)) {
        const start = pos;
        while (pos < len && /[a-zA-Z0-9_$]/.test(code[pos])) pos++;
        const val = code.slice(start, pos);
        const type = keywords.has(val) ? "KEYWORD" : "IDENT";
        tokens.push({ type, value: val, start, end: pos });
        continue;
      }

      // Punctuation & Operators
      tokens.push({ type: "PUNCT", value: char, start: pos, end: pos + 1 });
      pos++;
    }

    return tokens;
  }

  /**
   * Matches code across lexical token streams, allowing robust search and replacement
   * despite formatting changes (e.g. single-line vs multi-line destructuring, trailing commas).
   */
  findAndReplaceTokenStream(
    content: string,
    oldSnippet: string,
    newSnippet: string,
    options: TokenStreamMatchOptions = {}
  ): TokenStreamMatchResult {
    const contentTokens = this.tokenizeCode(content);
    const snippetTokens = this.tokenizeCode(oldSnippet);

    const filterTokens = (toks: LexicalToken[]): LexicalToken[] => {
      const filtered: LexicalToken[] = [];
      for (let i = 0; i < toks.length; i++) {
        const t = toks[i];
        if (t.type === "WHITESPACE" && (options.ignoreWhitespace ?? true)) continue;
        if (t.type === "COMMENT" && (options.ignoreComments ?? true)) continue;

        // Skip trailing comma before closing brace/bracket/paren
        if (t.type === "PUNCT" && t.value === ",") {
          let nextIdx = i + 1;
          const ignoreWs = options.ignoreWhitespace ?? true;
          const ignoreComments = options.ignoreComments ?? true;
          while (
            nextIdx < toks.length &&
            ((ignoreWs && toks[nextIdx].type === "WHITESPACE") ||
              (ignoreComments && toks[nextIdx].type === "COMMENT"))
          ) {
            nextIdx++;
          }
          if (
            nextIdx < toks.length &&
            toks[nextIdx].type === "PUNCT" &&
            (toks[nextIdx].value === "}" || toks[nextIdx].value === "]" || toks[nextIdx].value === ")")
          ) {
            continue;
          }
        }

        filtered.push(t);
      }
      return filtered;
    };

    const targetStream = filterTokens(contentTokens);
    const searchStream = filterTokens(snippetTokens);

    if (searchStream.length === 0) {
      return {
        success: false,
        modifiedContent: content,
        matchSpan: null,
        tokensMatched: 0,
        error: "Search snippet contains no significant lexical tokens.",
      };
    }

    // Find searchStream inside targetStream
    let matchTargetStartIdx = -1;
    for (let i = 0; i <= targetStream.length - searchStream.length; i++) {
      let matched = true;
      for (let j = 0; j < searchStream.length; j++) {
        const t1 = targetStream[i + j];
        const t2 = searchStream[j];
        if (t1.type !== t2.type) {
          matched = false;
          break;
        }
        const val1 = options.caseSensitive ?? true ? t1.value : t1.value.toLowerCase();
        const val2 = options.caseSensitive ?? true ? t2.value : t2.value.toLowerCase();
        if (val1 !== val2) {
          matched = false;
          break;
        }
      }
      if (matched) {
        matchTargetStartIdx = i;
        break;
      }
    }

    if (matchTargetStartIdx === -1) {
      return {
        success: false,
        modifiedContent: content,
        matchSpan: null,
        tokensMatched: 0,
        error: `Could not match lexical token stream of ${searchStream.length} tokens in target content.`,
      };
    }

    const firstMatchedToken = targetStream[matchTargetStartIdx];
    const lastMatchedToken = targetStream[matchTargetStartIdx + searchStream.length - 1];

    const matchSpan: FuzzyMatchSpan = [firstMatchedToken.start, lastMatchedToken.end];

    // Splice replacement
    const modifiedContent =
      content.slice(0, matchSpan[0]) + newSnippet + content.slice(matchSpan[1]);

    return {
      success: true,
      modifiedContent,
      matchSpan,
      tokensMatched: searchStream.length,
      error: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Semantic Merge Conflict Explainer
  // ---------------------------------------------------------------------------

  /**
   * Analyzes 3-way merge conflict regions, identifying base ancestor snippets,
   * local changes, remote changes, and proposing high-confidence auto-resolutions.
   */
  explainMergeConflict(
    baseContent: string,
    oursContent: string,
    theirsContent: string
  ): SemanticConflictExplanation {
    const mergeResult = this.threeWayMerge(baseContent, oursContent, theirsContent, {
      conflictResolution: "markers",
      oursLabel: "OURS",
      theirsLabel: "THEIRS",
    });

    if (mergeResult.success || mergeResult.conflictCount === 0) {
      return {
        totalConflicts: 0,
        analyses: [],
        summary: "No merge conflicts detected. Branches reconciled cleanly.",
        autoResolvable: true,
      };
    }

    const conflictRegex = /<<<<<<< OURS\n([\s\S]*?)\n\|\|\|\|\|\|\| BASE\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> THEIRS/g;
    const analyses: ConflictBlockAnalysis[] = [];
    let match: RegExpExecArray | null;
    let conflictIndex = 0;

    while ((match = conflictRegex.exec(mergeResult.mergedContent)) !== null) {
      conflictIndex++;
      const oursSnippet = match[1];
      const baseSnippet = match[2];
      const theirsSnippet = match[3];

      const matchStartOffset = match.index;
      const startLine = mergeResult.mergedContent.slice(0, matchStartOffset).split("\n").length;
      const endLine = startLine + match[0].split("\n").length - 1;

      let conflictCategory: ConflictBlockAnalysis["conflictCategory"] = "overlapping_edit";
      if (oursSnippet.trim() === theirsSnippet.trim()) {
        conflictCategory = "reformat_conflict";
      } else if (oursSnippet.length === 0 && theirsSnippet.length > 0) {
        conflictCategory = "deletion_conflict";
      } else if (baseSnippet.length === 0 && oursSnippet.length > 0 && theirsSnippet.length > 0) {
        conflictCategory = "addition_collision";
      }

      const proposedResolutions: MergeResolutionCandidate[] = [
        {
          strategy: "take_ours",
          description: "Keep local branch modifications",
          resolvedContent: oursSnippet,
          confidenceScore: 0.8,
        },
        {
          strategy: "take_theirs",
          description: "Accept remote branch modifications",
          resolvedContent: theirsSnippet,
          confidenceScore: 0.8,
        },
        {
          strategy: "combine_both",
          description: "Concatenate local changes followed by remote changes",
          resolvedContent: `${oursSnippet}\n${theirsSnippet}`,
          confidenceScore: conflictCategory === "addition_collision" ? 0.85 : 0.5,
        },
      ];

      if (conflictCategory === "reformat_conflict") {
        proposedResolutions.unshift({
          strategy: "harmonized_reformat",
          description: "Adopt consistent indentation and whitespace across both edits",
          resolvedContent: oursSnippet,
          confidenceScore: 0.98,
        });
      }

      analyses.push({
        conflictIndex,
        startLine,
        endLine,
        baseSnippet,
        oursSnippet,
        theirsSnippet,
        conflictCategory,
        proposedResolutions,
      });
    }

    const autoResolvable = analyses.every(
      (a) => a.conflictCategory === "reformat_conflict" || a.conflictCategory === "addition_collision"
    );

    return {
      totalConflicts: analyses.length,
      analyses,
      summary: `Found ${analyses.length} conflict(s). ${autoResolvable ? "All conflicts are automatically resolvable." : "Manual or supervised review recommended."}`,
      autoResolvable,
    };
  }

  // ---------------------------------------------------------------------------
  // Deterministic Inverse Patch Generator
  // ---------------------------------------------------------------------------

  /**
   * Generates a reversible inverse diff that undoes changes from modifiedContent back to originalContent.
   */
  generateInversePatch(
    originalContent: string,
    modifiedContent: string,
    filename: string = "file"
  ): InversePatchResult {
    if (originalContent === modifiedContent) {
      return {
        success: true,
        inverseDiff: "",
        invertedHunks: [],
        originalLength: originalContent.length,
        modifiedLength: modifiedContent.length,
        error: null,
      };
    }

    const inverseDiff = this.generateUnifiedDiff(modifiedContent, originalContent, filename);
    const parsedHunks = this.parseUnifiedPatch(inverseDiff);

    const testReversal = this.applyUnifiedPatch(modifiedContent, inverseDiff);
    if (!testReversal.success || testReversal.modifiedContent !== originalContent) {
      return {
        success: false,
        inverseDiff,
        invertedHunks: parsedHunks,
        originalLength: originalContent.length,
        modifiedLength: modifiedContent.length,
        error: "Inverse patch failed self-verification check against original content.",
      };
    }

    return {
      success: true,
      inverseDiff,
      invertedHunks: parsedHunks,
      originalLength: originalContent.length,
      modifiedLength: modifiedContent.length,
      error: null,
    };
  }

  /**
   * Generates a multi-file inverse patch to cleanly revert modifications across an entire workspace.
   */
  generateMultiFileInversePatch(
    originalFiles: Record<string, string>,
    modifiedFiles: Record<string, string>
  ): MultiFileInversePatchResult {
    const fileInverseDiffs: Record<string, string> = {};
    const allPatchParts: string[] = [];

    for (const [filePath, origContent] of Object.entries(originalFiles)) {
      const modContent = modifiedFiles[filePath] ?? origContent;
      if (origContent !== modContent) {
        const invRes = this.generateInversePatch(origContent, modContent, filePath);
        if (!invRes.success) {
          return {
            success: false,
            inversePatchText: "",
            fileInverseDiffs: {},
            totalFiles: 0,
            error: `Failed generating inverse patch for '${filePath}': ${invRes.error}`,
          };
        }
        fileInverseDiffs[filePath] = invRes.inverseDiff;
        allPatchParts.push(invRes.inverseDiff);
      }
    }

    return {
      success: true,
      inversePatchText: allPatchParts.join("\n\n"),
      fileInverseDiffs,
      totalFiles: Object.keys(fileInverseDiffs).length,
      error: null,
    };
  }

  /**
   * Scope-Bounded Fuzzy Splicer: Restricts fuzzy search and replace to a specific enclosing
   * function, class, interface, or block declaration.
   */
  findAndReplaceInScope(
    content: string,
    oldSnippet: string,
    newSnippet: string,
    options: ScopeBoundedMatchOptions
  ): ScopeBoundedMatchResult {
    const scopeQuery = options.enclosingScope.trim();
    if (!scopeQuery) {
      return {
        success: false,
        modifiedContent: content,
        matchedScopeSpan: null,
        innerMatchResult: null,
        error: "Enclosing scope query cannot be empty.",
      };
    }

    // Locate scope declaration start
    const searchIdx = options.caseSensitive ?? true
      ? content.indexOf(scopeQuery)
      : content.toLowerCase().indexOf(scopeQuery.toLowerCase());

    if (searchIdx === -1) {
      return {
        success: false,
        modifiedContent: content,
        matchedScopeSpan: null,
        innerMatchResult: null,
        error: `Could not locate enclosing scope '${scopeQuery}' in target content.`,
      };
    }

    // Find opening brace after declaration
    let braceOpenIdx = content.indexOf("{", searchIdx);
    let scopeStart = searchIdx;
    let scopeEnd = content.length;

    if (braceOpenIdx !== -1 && braceOpenIdx - searchIdx < 300) {
      // Find matching balanced closing brace
      let depth = 1;
      let pos = braceOpenIdx + 1;
      let inString: string | null = null;

      while (pos < content.length && depth > 0) {
        const ch = content[pos];
        if (inString) {
          if (ch === "\\" && pos + 1 < content.length) {
            pos += 2;
            continue;
          }
          if (ch === inString) {
            inString = null;
          }
        } else if (ch === '"' || ch === "'" || ch === "`") {
          inString = ch;
        } else if (ch === "{") {
          depth++;
        } else if (ch === "}") {
          depth--;
          if (depth === 0) {
            scopeEnd = pos + 1;
            break;
          }
        }
        pos++;
      }
    }

    const scopeSlice = content.slice(scopeStart, scopeEnd);
    const innerRes = this.findAndReplace(scopeSlice, oldSnippet, newSnippet);

    if (!innerRes.success) {
      return {
        success: false,
        modifiedContent: content,
        matchedScopeSpan: [scopeStart, scopeEnd],
        innerMatchResult: innerRes,
        error: `Scope found, but inner snippet replacement failed: ${innerRes.error ?? "No match"}`,
      };
    }

    const modified = content.slice(0, scopeStart) + innerRes.modifiedContent + content.slice(scopeEnd);

    return {
      success: true,
      modifiedContent: modified,
      matchedScopeSpan: [scopeStart, scopeEnd],
      innerMatchResult: innerRes,
      error: null,
    };
  }

  /**
   * N-Gram Token Cosine Similarity Matrix Search:
   * Fast vector similarity scoring across candidate code windows for large files.
   */
  searchByNGramCosineSimilarity(
    content: string,
    searchSnippet: string,
    options: NGramSimilarityOptions = {}
  ): NGramSimilarityResult {
    const n = options.n ?? 3;
    const minScore = options.minScoreThreshold ?? 0.2;
    const maxResults = options.maxResults ?? 5;
    const contentLines = content.split("\n");
    const snippetLines = searchSnippet.split("\n");
    const windowSize = Math.max(1, snippetLines.length);

    const makeNGrams = (text: string): Map<string, number> => {
      const counts = new Map<string, number>();
      const norm = text.toLowerCase().replace(/\s+/g, " ");
      if (norm.length < n) {
        counts.set(norm, 1);
        return counts;
      }
      for (let i = 0; i <= norm.length - n; i++) {
        const gram = norm.slice(i, i + n);
        counts.set(gram, (counts.get(gram) ?? 0) + 1);
      }
      return counts;
    };

    const targetVector = makeNGrams(searchSnippet);
    let targetMag = 0;
    for (const val of targetVector.values()) {
      targetMag += val * val;
    }
    targetMag = Math.sqrt(targetMag);

    const candidates: NGramMatchCandidate[] = [];
    let evaluatedWindows = 0;

    for (let i = 0; i <= contentLines.length - windowSize; i++) {
      evaluatedWindows++;
      const candidateText = contentLines.slice(i, i + windowSize).join("\n");
      const candVector = makeNGrams(candidateText);

      let dotProduct = 0;
      let candMag = 0;
      for (const [gram, cVal] of candVector.entries()) {
        candMag += cVal * cVal;
        const tVal = targetVector.get(gram);
        if (tVal !== undefined) {
          dotProduct += cVal * tVal;
        }
      }
      candMag = Math.sqrt(candMag);

      const cosineSim = targetMag > 0 && candMag > 0 ? dotProduct / (targetMag * candMag) : 0;

      if (cosineSim >= minScore) {
        candidates.push({
          startLine: i + 1,
          endLine: i + windowSize,
          lineSpan: [i + 1, i + windowSize],
          similarityScore: Math.round(cosineSim * 10000) / 10000,
          candidateText,
        });
      }
    }

    candidates.sort((a, b) => b.similarityScore - a.similarityScore);
    const topCandidates = candidates.slice(0, maxResults);

    return {
      searchSnippet,
      candidates: topCandidates,
      topCandidate: topCandidates.length > 0 ? topCandidates[0] : null,
      totalEvaluatedWindows: evaluatedWindows,
    };
  }

  /**
   * Multi-File Fuzzy Symbol Refactoring:
   * Coordinated whole-word identifier renaming across workspaces with comment/string filters.
   */
  renameSymbolWorkspace(
    files: Record<string, string>,
    oldSymbol: string,
    newSymbol: string,
    options: SymbolRenameOptions = {}
  ): WorkspaceSymbolRenameResult {
    if (!oldSymbol || !newSymbol) {
      return {
        success: false,
        oldSymbol,
        newSymbol,
        totalOccurrencesRenamed: 0,
        totalFilesModified: 0,
        fileResults: {},
        committedFiles: files,
        error: "Old and new symbol names must be non-empty.",
      };
    }

    const fileResults: Record<string, SymbolRenameFileResult> = {};
    const committedFiles: Record<string, string> = { ...files };
    let totalOccurrences = 0;
    let modifiedFilesCount = 0;

    const regex = options.wholeWordOnly ?? true
      ? new RegExp(`\\b${oldSymbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")
      : new RegExp(oldSymbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");

    for (const [filePath, content] of Object.entries(files)) {
      const tokens = this.tokenizeCode(content);
      const occurrences: SymbolRenameOccurrence[] = [];
      const lines = content.split("\n");

      // Scan token-by-token for accurate classification
      let modifiedText = content;
      const renameInComments = options.renameInComments ?? true;
      const renameInStrings = options.renameInStrings ?? false;

      // Find occurrences matching filter
      let match: RegExpExecArray | null = null;
      regex.lastIndex = 0;

      while ((match = regex.exec(content)) !== null) {
        const offset = match.index;
        // Determine line & col
        const prefix = content.slice(0, offset);
        const lineNum = prefix.split("\n").length;
        const lineStart = prefix.lastIndexOf("\n") + 1;
        const colNum = offset - lineStart;

        // Check token context
        const tok = tokens.find((t) => offset >= t.start && offset < t.end);
        const isComment = tok?.type === "COMMENT";
        const isString = tok?.type === "STRING";

        if ((isComment && !renameInComments) || (isString && !renameInStrings)) {
          continue;
        }

        occurrences.push({
          line: lineNum,
          character: colNum,
          span: [offset, offset + oldSymbol.length],
          context: lines[lineNum - 1] ?? "",
          inCommentOrString: isComment || isString,
        });
      }

      if (occurrences.length > 0) {
        // Replace from end to start to maintain char offsets
        const sortedOccurrences = [...occurrences].sort((a, b) => b.span[0] - a.span[0]);
        for (const occ of sortedOccurrences) {
          modifiedText =
            modifiedText.slice(0, occ.span[0]) +
            newSymbol +
            modifiedText.slice(occ.span[1]);
        }

        totalOccurrences += occurrences.length;
        modifiedFilesCount++;

        fileResults[filePath] = {
          filePath,
          occurrencesCount: occurrences.length,
          occurrences,
          originalContent: content,
          modifiedContent: modifiedText,
        };

        if (!(options.dryRun ?? false)) {
          committedFiles[filePath] = modifiedText;
        }
      }
    }

    return {
      success: true,
      oldSymbol,
      newSymbol,
      totalOccurrencesRenamed: totalOccurrences,
      totalFilesModified: modifiedFilesCount,
      fileResults,
      committedFiles,
      error: null,
    };
  }

  /**
   * Adaptive Patch Drift Compensation:
   * Applies unified diff hunks with dynamic offset drift search and fuzzy similarity tolerance.
   */
  applyUnifiedPatchWithDrift(
    content: string,
    patchText: string,
    options: PatchDriftOptions = {}
  ): PatchDriftResult {
    const maxDrift = options.maxDriftLines ?? 50;
    const similarityThreshold = options.similarityThreshold ?? 0.6;
    const parsedHunks = this.parseUnifiedPatch(patchText);

    if (parsedHunks.length === 0) {
      return {
        success: true,
        modifiedContent: content,
        totalHunks: 0,
        appliedHunks: 0,
        maxObservedDrift: 0,
        hunkResults: [],
        error: null,
      };
    }

    const contentLines = content.split("\n");
    const hunkResults: PatchDriftHunkResult[] = [];
    let currentLines = [...contentLines];
    let maxDriftObserved = 0;

    for (let hIdx = 0; hIdx < parsedHunks.length; hIdx++) {
      const hunk = parsedHunks[hIdx];
      const targetOldStart = hunk.oldStart - 1; // 0-indexed

      // Extract hunk search lines (context + deletions)
      const expectedLines: string[] = [];
      const replacementHunkLines: string[] = [];

      for (const line of hunk.lines) {
        if (line.startsWith(" ") || line.startsWith("-")) {
          expectedLines.push(line.slice(1));
        }
        if (line.startsWith(" ") || line.startsWith("+")) {
          replacementHunkLines.push(line.slice(1));
        }
      }

      // Search with drift: d = 0, +1, -1, +2, -2, ... up to maxDrift
      let bestPos = -1;
      let bestSim = 0;
      let bestDrift = 0;

      for (let drift = 0; drift <= maxDrift; drift++) {
        const offsets = drift === 0 ? [0] : [drift, -drift];
        for (const off of offsets) {
          const testStart = targetOldStart + off;
          if (testStart < 0 || testStart + expectedLines.length > currentLines.length) continue;

          // Compute similarity across expectedLines vs candidate window
          let matchedLines = 0;
          for (let i = 0; i < expectedLines.length; i++) {
            if (currentLines[testStart + i].trim() === expectedLines[i].trim()) {
              matchedLines++;
            }
          }
          const sim = expectedLines.length > 0 ? matchedLines / expectedLines.length : 1.0;

          if (sim > bestSim) {
            bestSim = sim;
            bestPos = testStart;
            bestDrift = off;
          }
          if (sim === 1.0) break;
        }
        if (bestSim === 1.0) break;
      }

      if (bestPos !== -1 && bestSim >= similarityThreshold) {
        // Apply replacement at bestPos
        currentLines.splice(bestPos, expectedLines.length, ...replacementHunkLines);
        maxDriftObserved = Math.max(maxDriftObserved, Math.abs(bestDrift));

        hunkResults.push({
          hunkIndex: hIdx,
          originalOldStart: hunk.oldStart,
          actualAppliedStart: bestPos + 1,
          driftOffset: bestDrift,
          similarityScore: Math.round(bestSim * 1000) / 1000,
          appliedSuccessfully: true,
          error: null,
        });
      } else {
        hunkResults.push({
          hunkIndex: hIdx,
          originalOldStart: hunk.oldStart,
          actualAppliedStart: -1,
          driftOffset: 0,
          similarityScore: Math.round(bestSim * 1000) / 1000,
          appliedSuccessfully: false,
          error: `Could not anchor hunk ${hIdx + 1} within max drift of ${maxDrift} lines (best similarity: ${bestSim.toFixed(2)}).`,
        });
      }
    }

    const allApplied = hunkResults.every((r) => r.appliedSuccessfully);
    const finalContent = allApplied ? currentLines.join("\n") : content;

    return {
      success: allApplied,
      modifiedContent: finalContent,
      totalHunks: parsedHunks.length,
      appliedHunks: hunkResults.filter((r) => r.appliedSuccessfully).length,
      maxObservedDrift: maxDriftObserved,
      hunkResults,
      error: allApplied ? null : "One or more hunks failed drift-compensated application.",
    };
  }

  // ---------------------------------------------------------------------------
  // Git Rerere (Reuse Recorded Resolution) Conflict Cache
  // ---------------------------------------------------------------------------

  /**
   * Computes a deterministic canonical fingerprint for a conflict pre-image.
   */
  computeConflictFingerprint(preimage: RecordedConflictPreimage): string {
    const raw = [
      preimage.baseSnippet.trim().replace(/\r\n/g, "\n"),
      preimage.oursSnippet.trim().replace(/\r\n/g, "\n"),
      preimage.theirsSnippet.trim().replace(/\r\n/g, "\n"),
    ].join(":::PREIMAGE_SEP:::");

    let hash = 0x811c9dc5;
    for (let i = 0; i < raw.length; i++) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return `rerere_${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  /**
   * Records a manual or verified merge conflict resolution into the in-memory Rerere cache.
   */
  recordConflictResolution(
    preimage: RecordedConflictPreimage,
    resolvedSnippet: string
  ): RecordedConflictEntry {
    const fingerprint = this.computeConflictFingerprint(preimage);
    const existing = this.rerereCache.get(fingerprint);

    const entry: RecordedConflictEntry = {
      conflictFingerprint: fingerprint,
      preimage,
      resolvedSnippet,
      recordedAt: Date.now(),
      hitsCount: existing ? existing.hitsCount : 0,
    };

    this.rerereCache.set(fingerprint, entry);
    return entry;
  }

  replayConflictResolution(content: string): RerereReplayResult {
    const chunks = this.parseConflictMarkers(content);
    if (chunks.length === 0) {
      return {
        success: true,
        modifiedContent: content,
        replayedConflictsCount: 0,
        unresolvedConflictsCount: 0,
        appliedResolutions: [],
        error: null,
      };
    }

    const lines = content.split("\n");
    const sortedChunks = [...chunks].sort((a, b) => b.startLine - a.startLine);
    let replayed = 0;
    let unresolved = 0;
    const appliedResolutions: { conflictIndex: number; fingerprint: string; resolvedSnippet: string }[] = [];

    for (let i = 0; i < sortedChunks.length; i++) {
      const chunk = sortedChunks[i];
      const preimage: RecordedConflictPreimage = {
        baseSnippet: chunk.baseContent ?? "",
        oursSnippet: chunk.oursContent,
        theirsSnippet: chunk.theirsContent,
      };
      const fp = this.computeConflictFingerprint(preimage);
      const recorded = this.rerereCache.get(fp);

      if (recorded) {
        replayed++;
        this.rerereCache.set(fp, {
          conflictFingerprint: recorded.conflictFingerprint,
          preimage: recorded.preimage,
          resolvedSnippet: recorded.resolvedSnippet,
          recordedAt: recorded.recordedAt,
          hitsCount: recorded.hitsCount + 1,
        });
        appliedResolutions.push({
          conflictIndex: i + 1,
          fingerprint: fp,
          resolvedSnippet: recorded.resolvedSnippet,
        });
        const replacementLines = recorded.resolvedSnippet.length > 0 ? recorded.resolvedSnippet.split("\n") : [];
        const deleteCount = chunk.endLine - chunk.startLine + 1;
        lines.splice(chunk.startLine - 1, deleteCount, ...replacementLines);
      } else {
        unresolved++;
      }
    }

    let modifiedContent = lines.join("\n");
    if (this.normalizeLineEndings) {
      modifiedContent = this.applyLineEnding(modifiedContent, this.detectLineEnding(content));
    }

    return {
      success: unresolved === 0,
      modifiedContent,
      replayedConflictsCount: replayed,
      unresolvedConflictsCount: unresolved,
      appliedResolutions,
      error: unresolved > 0 ? `${unresolved} conflicts have no recorded resolution in Rerere cache.` : null,
    };
  }

  getRerereCacheEntries(): readonly RecordedConflictEntry[] {
    return Array.from(this.rerereCache.values());
  }

  clearRerereCache(): void {
    this.rerereCache.clear();
  }

  // ---------------------------------------------------------------------------
  // AST-Tolerant Function Signature & Call-Site Refactorer
  // ---------------------------------------------------------------------------

  /**
   * Refactors function signatures (parameter reordering, options-object conversions)
   * and updates call-sites across the file content.
   */
  refactorFunctionSignature(
    content: string,
    options: SignatureRefactorOptions
  ): SignatureRefactorResult {
    const fnName = options.functionName.trim();
    if (!fnName) {
      return {
        success: false,
        modifiedContent: content,
        declarationUpdated: false,
        callsitesUpdatedCount: 0,
        error: "Function name cannot be empty.",
      };
    }

    // Locate function declaration: function foo(...) or const foo = (...)
    const declRegex = new RegExp(
      `(function\\s+${fnName}|(?:const|let|var)\\s+${fnName}\\s*=\\s*(?:async\\s*)?)(?:<[^>]*>)?\\s*\\(([^)]*)\\)`,
      "g"
    );

    const declMatch = declRegex.exec(content);
    if (!declMatch) {
      return {
        success: false,
        modifiedContent: content,
        declarationUpdated: false,
        callsitesUpdatedCount: 0,
        error: `Could not locate declaration for function '${fnName}'.`,
      };
    }

    const declFullMatch = declMatch[0];
    const declPrefix = declMatch[1];
    const oldParamsRaw = declMatch[2];
    const oldParams = oldParamsRaw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const parts = p.split(":");
        return { name: parts[0].trim(), type: parts[1]?.trim() };
      });

    // Build new declaration parameter string
    let newParamString = "";
    if (options.convertToOptionsObject) {
      const fieldList = options.newParams.map((p) => p.name).join(", ");
      const typeAnnotation = options.optionsInterfaceName ? `: ${options.optionsInterfaceName}` : "";
      newParamString = `{ ${fieldList} }${typeAnnotation}`;
    } else {
      newParamString = options.newParams
        .map((p) => {
          let str = p.isRest ? `...${p.name}` : p.name;
          if (p.type) str += `: ${p.type}`;
          if (p.defaultValue) str += ` = ${p.defaultValue}`;
          return str;
        })
        .join(", ");
    }

    const newDeclHeader = `${declPrefix}(${newParamString})`;
    const declStart = declMatch.index;
    const declEnd = declStart + newDeclHeader.length;

    let updatedContent =
      content.slice(0, declMatch.index) +
      newDeclHeader +
      content.slice(declMatch.index + declFullMatch.length);

    // Now update callsites: foo(arg1, arg2)
    // Find all callsites excluding the declaration
    const callsiteRegex = new RegExp(`\\b${fnName}\\s*\\(([^)]*)\\)`, "g");
    const callsiteMatches: { index: number; fullMatch: string; argsRaw: string }[] = [];

    let callMatch: RegExpExecArray | null = null;
    while ((callMatch = callsiteRegex.exec(updatedContent)) !== null) {
      const matchIdx = callMatch.index;
      // Skip if within the declaration range
      if (matchIdx >= declStart && matchIdx < declEnd) continue;
      // Also skip if immediately preceded by declaration keywords
      const prefixBefore = updatedContent.slice(Math.max(0, matchIdx - 30), matchIdx);
      if (/(?:function\s+|async\s+|class\s+|export\s+(?:default\s+)?(?:async\s+)?function\s+|const\s+|let\s+|var\s+)$/.test(prefixBefore)) {
        continue;
      }

      callsiteMatches.push({
        index: matchIdx,
        fullMatch: callMatch[0],
        argsRaw: callMatch[1],
      });
    }

    // Sort callsites descending to replace safely
    callsiteMatches.sort((a, b) => b.index - a.index);
    let callsitesUpdated = 0;

    for (const call of callsiteMatches) {
      const rawArgs = call.argsRaw.split(",").map((a) => a.trim()).filter(Boolean);
      let newCallArgs = "";

      if (options.convertToOptionsObject) {
        // Map positional args to object properties
        const objProps = options.newParams.map((p, idx) => {
          const mapping = options.paramMapping?.[p.name];
          let argVal = "";
          if (typeof mapping === "number" && rawArgs[mapping] !== undefined) {
            argVal = rawArgs[mapping];
          } else if (typeof mapping === "string") {
            const oldIdx = oldParams.findIndex((op) => op.name === mapping);
            argVal = oldIdx !== -1 && rawArgs[oldIdx] !== undefined ? rawArgs[oldIdx] : p.defaultValue ?? "undefined";
          } else if (rawArgs[idx] !== undefined) {
            argVal = rawArgs[idx];
          } else {
            argVal = p.defaultValue ?? "undefined";
          }
          return `${p.name}: ${argVal}`;
        });
        newCallArgs = `{ ${objProps.join(", ")} }`;
      } else {
        // Re-order positional args
        const reorderedArgs = options.newParams.map((p, idx) => {
          const mapping = options.paramMapping?.[p.name];
          if (typeof mapping === "number" && rawArgs[mapping] !== undefined) {
            return rawArgs[mapping];
          }
          if (typeof mapping === "string") {
            const oldIdx = oldParams.findIndex((op) => op.name === mapping);
            if (oldIdx !== -1 && rawArgs[oldIdx] !== undefined) return rawArgs[oldIdx];
          }
          if (rawArgs[idx] !== undefined) return rawArgs[idx];
          return p.defaultValue ?? "undefined";
        });
        newCallArgs = reorderedArgs.join(", ");
      }

      const newCallsite = `${fnName}(${newCallArgs})`;
      updatedContent =
        updatedContent.slice(0, call.index) +
        newCallsite +
        updatedContent.slice(call.index + call.fullMatch.length);
      callsitesUpdated++;
    }

    return {
      success: true,
      modifiedContent: updatedContent,
      declarationUpdated: true,
      callsitesUpdatedCount: callsitesUpdated,
      error: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Multi-Cursor Parallel Simultaneous Fuzzy Spans
  // ---------------------------------------------------------------------------

  /**
   * Executes atomic simultaneous replacements across multiple non-contiguous cursor loci,
   * validating non-overlapping invariant before modifying content.
   */
  applyParallelMultiCursorEdits(
    content: string,
    edits: readonly MultiCursorEditSpan[]
  ): MultiCursorParallelResult {
    if (edits.length === 0) {
      return {
        success: true,
        modifiedContent: content,
        totalCursorsApplied: 0,
        appliedSpans: [],
        error: null,
      };
    }

    const resolvedSpans: { span: FuzzyMatchSpan; replacement: string; search: string }[] = [];

    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];
      const matches = this.findMatchSpans(content, edit.searchSnippet);

      if (matches.length === 0) {
        return {
          success: false,
          modifiedContent: content,
          totalCursorsApplied: 0,
          appliedSpans: [],
          error: `Cursor edit ${i + 1} ('${edit.searchSnippet.slice(0, 30)}...') could not be matched.`,
        };
      }

      let selectedMatch = matches[0];
      if (typeof edit.expectedLineHint === "number" && matches.length > 1) {
        const lineOffsets: number[] = [0];
        for (let idx = 0; idx < content.length; idx++) {
          if (content[idx] === "\n") lineOffsets.push(idx + 1);
        }
        let bestDiff = Infinity;
        for (const m of matches) {
          const lineNum = lineOffsets.findIndex((offset) => offset > m[0]);
          const actualLine = lineNum === -1 ? lineOffsets.length : lineNum;
          const diff = Math.abs(actualLine - edit.expectedLineHint);
          if (diff < bestDiff) {
            bestDiff = diff;
            selectedMatch = m;
          }
        }
      }

      resolvedSpans.push({
        span: selectedMatch,
        replacement: edit.replacementSnippet,
        search: edit.searchSnippet,
      });
    }

    // Sort ascending to verify non-overlapping invariant
    resolvedSpans.sort((a, b) => a.span[0] - b.span[0]);

    for (let i = 0; i < resolvedSpans.length - 1; i++) {
      const current = resolvedSpans[i];
      const next = resolvedSpans[i + 1];
      if (current.span[1] > next.span[0]) {
        return {
          success: false,
          modifiedContent: content,
          totalCursorsApplied: 0,
          appliedSpans: [],
          error: `Multi-cursor collision detected: span [${current.span[0]}, ${current.span[1]}] overlaps with span [${next.span[0]}, ${next.span[1]}].`,
        };
      }
    }

    // Apply edits in descending order of start offset
    let modified = content;
    resolvedSpans.sort((a, b) => b.span[0] - a.span[0]);

    for (const item of resolvedSpans) {
      modified = modified.slice(0, item.span[0]) + item.replacement + modified.slice(item.span[1]);
    }

    return {
      success: true,
      modifiedContent: modified,
      totalCursorsApplied: edits.length,
      appliedSpans: resolvedSpans.map((r) => r.span),
      error: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Hierarchical Line-Diff Histogram Algorithm
  // ---------------------------------------------------------------------------

  /**
   * Git-style --histogram diff algorithm: Isolates low-frequency anchor lines across files
   * to eliminate pathological Myers diff behavior on repetitive code blocks.
   */
  generateHistogramDiff(
    oldText: string,
    newText: string,
    filename: string = "file",
    options: HistogramDiffOptions = {}
  ): HistogramDiffResult {
    const contextLines = options.contextLines ?? 3;
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");

    if (oldText === newText) {
      return {
        diffText: "",
        hunks: [],
        lowFrequencyAnchorsUsed: 0,
        totalLinesChanged: 0,
        hasChanges: false,
      };
    }

    // Compute line occurrence frequencies
    const oldFreq = new Map<string, number>();
    const newFreq = new Map<string, number>();

    for (const l of oldLines) oldFreq.set(l, (oldFreq.get(l) ?? 0) + 1);
    for (const l of newLines) newFreq.set(l, (newFreq.get(l) ?? 0) + 1);

    // Identify low-frequency matching lines (lowest combined frequency)
    let lowFreqCount = 0;
    const anchors: { oldIdx: number; newIdx: number; line: string }[] = [];

    // First pass: unique lines (1 in old and 1 in new)
    for (let i = 0; i < oldLines.length; i++) {
      const line = oldLines[i];
      if (oldFreq.get(line) === 1 && newFreq.get(line) === 1) {
        const j = newLines.indexOf(line);
        if (j !== -1) {
          anchors.push({ oldIdx: i, newIdx: j, line });
          lowFreqCount++;
        }
      }
    }

    // Sort anchors by old index and enforce monotonic new index
    anchors.sort((a, b) => a.oldIdx - b.oldIdx);
    const monotonicAnchors: { oldIdx: number; newIdx: number; line: string }[] = [];
    let lastNewIdx = -1;
    for (const a of anchors) {
      if (a.newIdx > lastNewIdx) {
        monotonicAnchors.push(a);
        lastNewIdx = a.newIdx;
      }
    }

    // Build diff ops using patience sub-slicing
    const diffOps: { type: "keep" | "del" | "add"; line: string }[] = [];

    const diffSlice = (oStart: number, oEnd: number, nStart: number, nEnd: number) => {
      const oSlice = oldLines.slice(oStart, oEnd);
      const nSlice = newLines.slice(nStart, nEnd);

      // Common prefix
      let pre = 0;
      while (pre < oSlice.length && pre < nSlice.length && oSlice[pre] === nSlice[pre]) {
        diffOps.push({ type: "keep", line: oSlice[pre] });
        pre++;
      }

      // Common suffix
      let suf = 0;
      while (
        suf < oSlice.length - pre &&
        suf < nSlice.length - pre &&
        oSlice[oSlice.length - 1 - suf] === nSlice[nSlice.length - 1 - suf]
      ) {
        suf++;
      }

      // Middle deletions
      for (let i = pre; i < oSlice.length - suf; i++) {
        diffOps.push({ type: "del", line: oSlice[i] });
      }
      // Middle additions
      for (let j = pre; j < nSlice.length - suf; j++) {
        diffOps.push({ type: "add", line: nSlice[j] });
      }
      // Trailing common suffix
      for (let i = oSlice.length - suf; i < oSlice.length; i++) {
        diffOps.push({ type: "keep", line: oSlice[i] });
      }
    };

    let curOld = 0;
    let curNew = 0;

    for (const anchor of monotonicAnchors) {
      diffSlice(curOld, anchor.oldIdx, curNew, anchor.newIdx);
      diffOps.push({ type: "keep", line: anchor.line });
      curOld = anchor.oldIdx + 1;
      curNew = anchor.newIdx + 1;
    }
    diffSlice(curOld, oldLines.length, curNew, newLines.length);

    // Group into unified hunks
    const hunks: HistogramDiffHunk[] = [];
    let i = 0;
    let oldLineNum = 1;
    let newLineNum = 1;

    while (i < diffOps.length) {
      if (diffOps[i].type === "keep") {
        oldLineNum++;
        newLineNum++;
        i++;
        continue;
      }

      // Found changed region
      const hunkStartOld = Math.max(1, oldLineNum - contextLines);
      const hunkStartNew = Math.max(1, newLineNum - contextLines);
      const contextPrefixCount = oldLineNum - hunkStartOld;

      const hunkLines: string[] = [];
      // Add context lines before change
      for (let c = i - contextPrefixCount; c < i; c++) {
        if (c >= 0) hunkLines.push(` ${diffOps[c].line}`);
      }

      let oldCount = contextPrefixCount;
      let newCount = contextPrefixCount;

      while (i < diffOps.length) {
        if (diffOps[i].type === "del") {
          hunkLines.push(`-${diffOps[i].line}`);
          oldCount++;
          oldLineNum++;
          i++;
        } else if (diffOps[i].type === "add") {
          hunkLines.push(`+${diffOps[i].line}`);
          newCount++;
          newLineNum++;
          i++;
        } else {
          // Lookahead for more changes within contextLines * 2
          let keepCount = 0;
          while (i + keepCount < diffOps.length && diffOps[i + keepCount].type === "keep") {
            keepCount++;
          }
          if (keepCount <= contextLines * 2 && i + keepCount < diffOps.length) {
            for (let k = 0; k < keepCount; k++) {
              hunkLines.push(` ${diffOps[i + k].line}`);
              oldCount++;
              newCount++;
              oldLineNum++;
              newLineNum++;
            }
            i += keepCount;
          } else {
            // Trailing context lines
            const trailingCount = Math.min(keepCount, contextLines);
            for (let k = 0; k < trailingCount; k++) {
              hunkLines.push(` ${diffOps[i + k].line}`);
              oldCount++;
              newCount++;
              oldLineNum++;
              newLineNum++;
            }
            i += trailingCount;
            break;
          }
        }
      }

      hunks.push({
        oldStart: hunkStartOld,
        oldCount,
        newStart: hunkStartNew,
        newCount,
        lines: hunkLines,
      });
    }

    const header = `--- a/${filename}\n+++ b/${filename}\n`;
    const hunkTexts = hunks.map((h) => `@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@\n${h.lines.join("\n")}`);
    const fullDiff = hunks.length > 0 ? header + hunkTexts.join("\n") : "";

    const linesChanged = hunks.reduce((sum, h) => sum + h.lines.filter((l) => l.startsWith("+") || l.startsWith("-")).length, 0);

    return {
      diffText: fullDiff,
      hunks,
      lowFrequencyAnchorsUsed: lowFreqCount,
      totalLinesChanged: linesChanged,
      hasChanges: hunks.length > 0,
    };
  }

  /**
   * Applies a histogram unified patch directly to content.
   */
  applyHistogramPatch(content: string, patchText: string): UnifiedPatchResult {
    return this.applyUnifiedPatch(content, patchText);
  }

  // ---------------------------------------------------------------------------
  // Structural Pattern & Hole Wildcard Matcher / Splicer (Pass 10)
  // ---------------------------------------------------------------------------

  /**
   * Matches code structures using named syntactic holes (e.g. :[name], :[body], ...)
   * and expands them into replacement templates while preserving balanced syntax.
   */
  structuralPatternMatchAndReplace(
    content: string,
    pattern: string,
    replacementTemplate: string,
    options?: StructuralPatternOptions
  ): StructuralPatternMatchResult {
    if (!pattern.trim()) {
      return {
        success: false,
        modifiedContent: content,
        matchCount: 0,
        matches: [],
        error: "Pattern cannot be empty.",
      };
    }

    const holeRegex = /:\[([a-zA-Z0-9_]+)\]|:\b([a-zA-Z0-9_]+)\b/g;
    const holes: string[] = [];
    let match: RegExpExecArray | null = null;
    while ((match = holeRegex.exec(pattern)) !== null) {
      holes.push(match[1] || match[2]);
    }

    // Convert pattern to regex
    let patternRegexStr = "";
    let lastIdx = 0;
    holeRegex.lastIndex = 0;

    while ((match = holeRegex.exec(pattern)) !== null) {
      const literalPart = pattern.slice(lastIdx, match.index);
      if (literalPart) {
        const escaped = literalPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        patternRegexStr += options?.matchWhitespaceFlexible !== false
          ? escaped.replace(/\s+/g, "\\s+")
          : escaped;
      }
      // Non-greedy capture for the hole
      patternRegexStr += "([\\s\\S]*?)";
      lastIdx = match.index + match[0].length;
    }

    const trailingLiteral = pattern.slice(lastIdx);
    if (trailingLiteral) {
      const escaped = trailingLiteral.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      patternRegexStr += options?.matchWhitespaceFlexible !== false
        ? escaped.replace(/\s+/g, "\\s+")
        : escaped;
    }

    let compiledPattern: RegExp;
    try {
      compiledPattern = new RegExp(patternRegexStr, "g");
    } catch (e: any) {
      return {
        success: false,
        modifiedContent: content,
        matchCount: 0,
        matches: [],
        error: `Failed to compile pattern regex: ${e.message}`,
      };
    }

    const matches: StructuralPatternMatchItem[] = [];
    let execMatch: RegExpExecArray | null = null;
    const maxMatches = options?.maxMatches ?? Infinity;

    while ((execMatch = compiledPattern.exec(content)) !== null && matches.length < maxMatches) {
      const startIndex = execMatch.index;
      const endIndex = startIndex + execMatch[0].length;
      const bindings: Record<string, string> = {};

      for (let i = 0; i < holes.length; i++) {
        const holeName = holes[i];
        bindings[holeName] = execMatch[i + 1] ?? "";
      }

      // Expand replacement template
      let expanded = replacementTemplate;
      for (const [k, v] of Object.entries(bindings)) {
        expanded = expanded.replace(new RegExp(`:\\[${k}\\]|:${k}\\b`, "g"), v);
      }

      matches.push({
        matchSpan: [startIndex, endIndex],
        bindings,
        expandedReplacement: expanded,
      });
    }

    if (matches.length === 0) {
      return {
        success: false,
        modifiedContent: content,
        matchCount: 0,
        matches: [],
        error: "No structural pattern matches found.",
      };
    }

    // Apply replacements in descending order
    let modified = content;
    const sortedMatches = [...matches].sort((a, b) => b.matchSpan[0] - a.matchSpan[0]);

    for (const item of sortedMatches) {
      modified =
        modified.slice(0, item.matchSpan[0]) +
        item.expandedReplacement +
        modified.slice(item.matchSpan[1]);
    }

    if (this.normalizeLineEndings) {
      modified = this.applyLineEnding(modified, this.detectLineEnding(content));
    }

    return {
      success: true,
      modifiedContent: modified,
      matchCount: matches.length,
      matches,
      error: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Hierarchical Tree-Diff & Semantic AST Node Swapper (Pass 10)
  // ---------------------------------------------------------------------------

  /**
   * Parses top-level AST declarations into a structured semantic node tree.
   */
  parseSemanticTree(content: string): readonly SemanticTreeNode[] {
    const nodes: SemanticTreeNode[] = [];
    const lines = content.split("\n");

    let currentOffset = 0;
    let nodeIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lineStartOffset = currentOffset;

      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
        currentOffset += line.length + 1;
        continue;
      }

      // 1. Imports
      if (trimmed.startsWith("import ")) {
        let fullImport = line;
        let endLine = i;
        while (!fullImport.includes(";") && !fullImport.includes("from") && endLine < lines.length - 1) {
          endLine++;
          fullImport += "\n" + lines[endLine];
        }
        const moduleMatch = fullImport.match(/from\s+['"]([^'"]+)['"]/);
        const identifier = moduleMatch ? moduleMatch[1] : `import_${nodeIndex++}`;
        const totalLen = fullImport.length;

        nodes.push({
          id: `node_import_${nodeIndex}`,
          type: "import",
          identifier,
          startOffset: lineStartOffset,
          endOffset: lineStartOffset + totalLen,
          rawCode: fullImport,
        });

        i = endLine;
        currentOffset += totalLen + 1;
        continue;
      }

      // 2. Interfaces
      const ifaceMatch = trimmed.match(/^(?:export\s+)?interface\s+([a-zA-Z0-9_$]+)/);
      if (ifaceMatch) {
        const identifier = ifaceMatch[1];
        const block = this.extractBalancedCodeBlock(content, lineStartOffset);
        nodes.push({
          id: `node_interface_${identifier}`,
          type: "interface",
          identifier,
          startOffset: lineStartOffset,
          endOffset: lineStartOffset + block.length,
          rawCode: block,
        });
        const consumedLines = block.split("\n").length;
        i += Math.max(0, consumedLines - 1);
        currentOffset += block.length + 1;
        continue;
      }

      // 3. Types
      const typeMatch = trimmed.match(/^(?:export\s+)?type\s+([a-zA-Z0-9_$]+)/);
      if (typeMatch) {
        const identifier = typeMatch[1];
        let fullType = line;
        let endLine = i;
        while (!fullType.includes(";") && endLine < lines.length - 1) {
          endLine++;
          fullType += "\n" + lines[endLine];
        }
        nodes.push({
          id: `node_type_${identifier}`,
          type: "type",
          identifier,
          startOffset: lineStartOffset,
          endOffset: lineStartOffset + fullType.length,
          rawCode: fullType,
        });
        i = endLine;
        currentOffset += fullType.length + 1;
        continue;
      }

      // 4. Functions
      const fnMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/);
      if (fnMatch) {
        const identifier = fnMatch[1];
        const block = this.extractBalancedCodeBlock(content, lineStartOffset);
        nodes.push({
          id: `node_fn_${identifier}`,
          type: "function",
          identifier,
          startOffset: lineStartOffset,
          endOffset: lineStartOffset + block.length,
          rawCode: block,
        });
        const consumedLines = block.split("\n").length;
        i += Math.max(0, consumedLines - 1);
        currentOffset += block.length + 1;
        continue;
      }

      // 5. Classes
      const classMatch = trimmed.match(/^(?:export\s+)?(?:abstract\s+)?class\s+([a-zA-Z0-9_$]+)/);
      if (classMatch) {
        const identifier = classMatch[1];
        const block = this.extractBalancedCodeBlock(content, lineStartOffset);
        nodes.push({
          id: `node_class_${identifier}`,
          type: "class",
          identifier,
          startOffset: lineStartOffset,
          endOffset: lineStartOffset + block.length,
          rawCode: block,
        });
        const consumedLines = block.split("\n").length;
        i += Math.max(0, consumedLines - 1);
        currentOffset += block.length + 1;
        continue;
      }

      // 6. Exported const / variables
      const constMatch = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)/);
      if (constMatch) {
        const identifier = constMatch[1];
        let fullConst = line;
        let endLine = i;
        if (fullConst.includes("{") && !fullConst.includes("}")) {
          const block = this.extractBalancedCodeBlock(content, lineStartOffset);
          fullConst = block;
          const consumedLines = block.split("\n").length;
          endLine = i + Math.max(0, consumedLines - 1);
        } else {
          while (!fullConst.includes(";") && endLine < lines.length - 1) {
            endLine++;
            fullConst += "\n" + lines[endLine];
          }
        }
        nodes.push({
          id: `node_const_${identifier}`,
          type: "export_const",
          identifier,
          startOffset: lineStartOffset,
          endOffset: lineStartOffset + fullConst.length,
          rawCode: fullConst,
        });
        i = endLine;
        currentOffset += fullConst.length + 1;
        continue;
      }

      currentOffset += line.length + 1;
    }

    return nodes;
  }

  private extractBalancedCodeBlock(content: string, startOffset: number): string {
    let braceDepth = 0;
    let started = false;
    let inString: string | null = null;
    let endOffset = content.length;

    for (let i = startOffset; i < content.length; i++) {
      const char = content[i];
      const prev = i > 0 ? content[i - 1] : "";

      if (inString) {
        if (char === inString && prev !== "\\") {
          inString = null;
        }
        continue;
      }

      if ((char === '"' || char === "'" || char === "`") && prev !== "\\") {
        inString = char;
        continue;
      }

      if (char === "{") {
        braceDepth++;
        started = true;
      } else if (char === "}") {
        braceDepth--;
        if (started && braceDepth === 0) {
          endOffset = i + 1;
          break;
        }
      } else if (char === ";" && !started) {
        endOffset = i + 1;
        break;
      }
    }

    return content.slice(startOffset, endOffset);
  }

  /**
   * Generates a semantic tree diff comparing top-level declarations between two code contents.
   */
  generateSemanticTreeDiff(
    oldContent: string,
    newContent: string,
    options?: SemanticTreeDiffOptions
  ): SemanticTreeDiffResult {
    const oldNodes = this.parseSemanticTree(oldContent);
    const newNodes = this.parseSemanticTree(newContent);

    const oldMap = new Map<string, SemanticTreeNode>();
    for (const node of oldNodes) {
      oldMap.set(`${node.type}:${node.identifier}`, node);
    }

    const newMap = new Map<string, SemanticTreeNode>();
    for (const node of newNodes) {
      newMap.set(`${node.type}:${node.identifier}`, node);
    }

    const ops: SemanticTreeOp[] = [];

    // Deleted nodes
    for (const [key, oldNode] of oldMap.entries()) {
      if (!newMap.has(key)) {
        ops.push({
          opType: "delete",
          nodeId: oldNode.id,
          nodeType: oldNode.type,
          identifier: oldNode.identifier,
        });
      }
    }

    // Inserted or Updated nodes
    for (let idx = 0; idx < newNodes.length; idx++) {
      const newNode = newNodes[idx];
      const key = `${newNode.type}:${newNode.identifier}`;
      const oldNode = oldMap.get(key);

      if (!oldNode) {
        ops.push({
          opType: "insert",
          nodeId: newNode.id,
          nodeType: newNode.type,
          identifier: newNode.identifier,
          newCode: newNode.rawCode,
          targetIndex: idx,
        });
      } else {
        const oldCode = options?.ignoreFormatting
          ? oldNode.rawCode.replace(/\s+/g, " ").trim()
          : oldNode.rawCode.trim();
        const newCode = options?.ignoreFormatting
          ? newNode.rawCode.replace(/\s+/g, " ").trim()
          : newNode.rawCode.trim();

        if (oldCode !== newCode) {
          ops.push({
            opType: "update",
            nodeId: oldNode.id,
            nodeType: oldNode.type,
            identifier: oldNode.identifier,
            newCode: newNode.rawCode,
          });
        }
      }
    }

    const summary = `${ops.length} structural operations (${ops.filter((o) => o.opType === "insert").length} inserts, ${ops.filter((o) => o.opType === "update").length} updates, ${ops.filter((o) => o.opType === "delete").length} deletes).`;

    return {
      operations: ops,
      totalChanges: ops.length,
      summary,
    };
  }

  /**
   * Applies semantic tree diff operations directly to content.
   */
  applySemanticTreeDiff(content: string, diff: SemanticTreeDiffResult): SemanticTreeApplyResult {
    let modified = content;
    let appliedCount = 0;

    // Apply updates and deletes in descending offset order
    const nodes = this.parseSemanticTree(modified);
    const nodeMap = new Map<string, SemanticTreeNode>();
    for (const n of nodes) {
      nodeMap.set(`${n.type}:${n.identifier}`, n);
    }

    // 1. Deletes & Updates
    const targetedOps: { op: SemanticTreeOp; start: number; end: number }[] = [];
    for (const op of diff.operations) {
      if (op.opType === "delete" || op.opType === "update") {
        const node = nodeMap.get(`${op.nodeType}:${op.identifier}`);
        if (node) {
          targetedOps.push({ op, start: node.startOffset, end: node.endOffset });
        }
      }
    }

    targetedOps.sort((a, b) => b.start - a.start);

    for (const item of targetedOps) {
      if (item.op.opType === "delete") {
        // Strip trailing newline if any
        let end = item.end;
        if (modified[end] === "\n") end++;
        modified = modified.slice(0, item.start) + modified.slice(end);
        appliedCount++;
      } else if (item.op.opType === "update" && item.op.newCode) {
        modified = modified.slice(0, item.start) + item.op.newCode + modified.slice(item.end);
        appliedCount++;
      }
    }

    // 2. Inserts
    const insertOps = diff.operations.filter((o) => o.opType === "insert" && o.newCode);
    for (const ins of insertOps) {
      if (ins.newCode) {
        modified = modified.trimEnd() + "\n\n" + ins.newCode + "\n";
        appliedCount++;
      }
    }

    if (this.normalizeLineEndings) {
      modified = this.applyLineEnding(modified, this.detectLineEnding(content));
    }

    return {
      success: true,
      modifiedContent: modified,
      appliedOpsCount: appliedCount,
      error: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Swarm Multi-Source Patch Synthesizer (Pass 10)
  // ---------------------------------------------------------------------------

  /**
   * Synthesizes and coordinates patches from multiple autonomous swarm subagents,
   * detecting inter-hunk collisions and generating topologically ordered patches.
   */
  synthesizeMultiSourcePatch(
    inputs: readonly MultiSourceHunkInput[],
    baseFiles: Record<string, string>
  ): MultiSourcePatchSynthesisResult {
    if (inputs.length === 0) {
      return {
        success: true,
        synthesizedPatches: [],
        conflictingHunks: [],
        totalSourcesProcessed: 0,
        error: null,
      };
    }

    const fileMap = new Map<string, MultiSourceHunkInput[]>();
    for (const input of inputs) {
      const list = fileMap.get(input.fileRelativePath) ?? [];
      list.push(input);
      fileMap.set(input.fileRelativePath, list);
    }

    const synthesizedPatches: MultiSourceSynthesizedPatch[] = [];
    const conflictingHunks: { fileRelativePath: string; agentA: string; agentB: string; reason: string }[] = [];

    for (const [fileRel, hunks] of fileMap.entries()) {
      const baseContent = baseFiles[fileRel] ?? "";
      let currentContent = baseContent;
      const contributingAgents = Array.from(new Set(hunks.map((h) => h.sourceAgentId)));

      // Sort hunks by priority descending, then by original line offset
      const sortedHunks = [...hunks].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      let appliedForFile = 0;

      for (let i = 0; i < sortedHunks.length; i++) {
        const hunkA = sortedHunks[i];

        // Check conflicts against remaining hunks
        for (let j = i + 1; j < sortedHunks.length; j++) {
          const hunkB = sortedHunks[j];
          if (
            hunkA.sourceAgentId !== hunkB.sourceAgentId &&
            hunkA.oldText === hunkB.oldText &&
            hunkA.newText !== hunkB.newText
          ) {
            conflictingHunks.push({
              fileRelativePath: fileRel,
              agentA: hunkA.sourceAgentId,
              agentB: hunkB.sourceAgentId,
              reason: `Conflicting replacement for identical search span: '${hunkA.oldText.slice(0, 25)}...'`,
            });
          }
        }

        const repRes = this.findAndReplace(currentContent, hunkA.oldText, hunkA.newText);
        if (repRes.success) {
          currentContent = repRes.modifiedContent;
          appliedForFile++;
        }
      }

      const diff = this.generateUnifiedDiff(baseContent, currentContent, fileRel);
      synthesizedPatches.push({
        fileRelativePath: fileRel,
        synthesizedDiff: diff,
        hunksAppliedCount: appliedForFile,
        contributingAgents,
      });
    }

    return {
      success: conflictingHunks.length === 0,
      synthesizedPatches,
      conflictingHunks,
      totalSourcesProcessed: inputs.length,
      error: conflictingHunks.length > 0 ? `${conflictingHunks.length} inter-agent hunk conflicts detected.` : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Fuzzy Import Specifier & Barrel-Bypass Optimizer (Pass 10)
  // ---------------------------------------------------------------------------

  /**
   * Parses import statements in file preamble into structured analysis representations.
   */
  parseImportStatements(content: string): readonly ImportStatementAnalysis[] {
    const imports: ImportStatementAnalysis[] = [];
    const lines = content.split("\n");

    const importRegex = /^import\s+(?:type\s+)?(?:([a-zA-Z0-9_$]+)\s*,?\s*)?(?:\*\s+as\s+([a-zA-Z0-9_$]+)\s*,?\s*)?(?:\{\s*([^}]*)\s*\}\s*,?\s*)?from\s+['"]([^'"]+)['"];?/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith("import ")) continue;

      let fullStatement = line;
      let endLine = i;
      while (!fullStatement.includes("from") && !fullStatement.includes(";") && endLine < lines.length - 1) {
        endLine++;
        fullStatement += " " + lines[endLine].trim();
      }

      const match = importRegex.exec(fullStatement);
      if (!match) continue;

      const isTypeOnly = /^import\s+type\b/.test(fullStatement);
      const defaultImport = match[1];
      const namespaceImport = match[2];
      const namedRaw = match[3];
      const moduleSpecifier = match[4];

      const namedImports: ImportSpecifierItem[] = [];
      if (namedRaw) {
        const parts = namedRaw.split(",").map((p) => p.trim()).filter(Boolean);
        for (const part of parts) {
          const itemTypeOnly = part.startsWith("type ");
          const clean = part.replace(/^type\s+/, "");
          const asParts = clean.split(/\s+as\s+/);
          namedImports.push({
            importedName: asParts[0].trim(),
            localName: asParts[1]?.trim() ?? asParts[0].trim(),
            isTypeOnly: isTypeOnly || itemTypeOnly,
          });
        }
      }

      let category: "builtin" | "external" | "internal_direct" | "internal_barrel" = "external";
      if (moduleSpecifier.startsWith("node:") || moduleSpecifier === "fs" || moduleSpecifier === "path" || moduleSpecifier === "events") {
        category = "builtin";
      } else if (moduleSpecifier.startsWith("./") || moduleSpecifier.startsWith("../")) {
        if (moduleSpecifier.endsWith("/index") || !moduleSpecifier.includes("/") || moduleSpecifier.split("/").length === 2) {
          category = "internal_barrel";
        } else {
          category = "internal_direct";
        }
      }

      imports.push({
        fullStatement,
        moduleSpecifier,
        defaultImport,
        namespaceImport,
        namedImports,
        isTypeOnlyStatement: isTypeOnly,
        startLine: i + 1,
        endLine: endLine + 1,
        category,
      });

      i = endLine;
    }

    return imports;
  }

  /**
   * Optimizes, de-duplicates, harmonizes, and reorders imports, with optional barrel bypass mapping.
   */
  optimizeAndHarmonizeImports(
    content: string,
    options?: ImportOptimizationOptions
  ): ImportOptimizationResult {
    const rawImports = this.parseImportStatements(content);
    if (rawImports.length === 0) {
      return {
        success: true,
        modifiedContent: content,
        originalImportsCount: 0,
        optimizedImportsCount: 0,
        mergedStatementsCount: 0,
        resolvedBarrelImportsCount: 0,
        error: null,
      };
    }

    const barrelMapping = options?.barrelMapping ?? {};
    let resolvedBarrels = 0;

    // Merge imports by resolved module specifier
    const moduleMap = new Map<
      string,
      {
        specifier: string;
        category: "builtin" | "external" | "internal_direct" | "internal_barrel";
        defaultImport?: string;
        namespaceImport?: string;
        namedImports: Map<string, ImportSpecifierItem>;
        isTypeOnly: boolean;
      }
    >();

    for (const imp of rawImports) {
      let spec = imp.moduleSpecifier;
      if (options?.resolveBarrelToDirect && barrelMapping[spec]) {
        spec = barrelMapping[spec];
        resolvedBarrels++;
      }

      let entry = moduleMap.get(spec);
      if (!entry) {
        entry = {
          specifier: spec,
          category: imp.category,
          defaultImport: imp.defaultImport,
          namespaceImport: imp.namespaceImport,
          namedImports: new Map(),
          isTypeOnly: imp.isTypeOnlyStatement,
        };
        moduleMap.set(spec, entry);
      }

      if (imp.defaultImport && !entry.defaultImport) {
        entry.defaultImport = imp.defaultImport;
      }
      if (imp.namespaceImport && !entry.namespaceImport) {
        entry.namespaceImport = imp.namespaceImport;
      }
      if (!imp.isTypeOnlyStatement) {
        entry.isTypeOnly = false;
      }

      for (const named of imp.namedImports) {
        entry.namedImports.set(named.localName, named);
      }
    }

    // Build optimized import lines
    const categories: ("builtin" | "external" | "internal_direct" | "internal_barrel")[] =
      options?.groupByCategory !== false
        ? ["builtin", "external", "internal_direct", "internal_barrel"]
        : ["builtin"];

    const builtGroups: string[][] = [];

    for (const cat of categories) {
      const items = Array.from(moduleMap.values()).filter(
        (m) => options?.groupByCategory === false || m.category === cat
      );
      if (items.length === 0) continue;

      if (options?.sortAlphabetically !== false) {
        items.sort((a, b) => a.specifier.localeCompare(b.specifier));
      }

      const groupLines: string[] = [];
      for (const item of items) {
        const parts: string[] = [];
        if (item.defaultImport) parts.push(item.defaultImport);
        if (item.namespaceImport) parts.push(`* as ${item.namespaceImport}`);

        if (item.namedImports.size > 0) {
          const namedList = Array.from(item.namedImports.values());
          if (options?.sortAlphabetically !== false) {
            namedList.sort((a, b) => a.importedName.localeCompare(b.importedName));
          }
          const namedStrs = namedList.map((n) =>
            n.importedName === n.localName ? n.importedName : `${n.importedName} as ${n.localName}`
          );
          parts.push(`{ ${namedStrs.join(", ")} }`);
        }

        const typePrefix = item.isTypeOnly ? "type " : "";
        if (parts.length > 0) {
          groupLines.push(`import ${typePrefix}${parts.join(", ")} from "${item.specifier}";`);
        } else {
          groupLines.push(`import "${item.specifier}";`);
        }
      }

      builtGroups.push(groupLines);
      if (options?.groupByCategory === false) break;
    }

    const optimizedImportBlock = builtGroups.map((g) => g.join("\n")).join("\n\n");

    // Replace original import block in content
    const lastImportEndLine = Math.max(...rawImports.map((i) => i.endLine));
    const lines = content.split("\n");
    const postImportLines = lines.slice(lastImportEndLine);

    // Trim leading blank lines in post-import section
    while (postImportLines.length > 0 && postImportLines[0].trim() === "") {
      postImportLines.shift();
    }

    let modifiedContent = optimizedImportBlock + "\n\n" + postImportLines.join("\n");
    if (this.normalizeLineEndings) {
      modifiedContent = this.applyLineEnding(modifiedContent, this.detectLineEnding(content));
    }

    const mergedCount = rawImports.length - moduleMap.size;

    return {
      success: true,
      modifiedContent,
      originalImportsCount: rawImports.length,
      optimizedImportsCount: moduleMap.size,
      mergedStatementsCount: Math.max(0, mergedCount),
      resolvedBarrelImportsCount: resolvedBarrels,
      error: null,
    };
  }
}

