/**
 * deterministic-fuzzy-matcher.ts
 *
 * Zero-GC, deterministic 9-strategy fuzzy line matcher, Unicode typography normalizer,
 * block-anchor resolver, indentation preservation engine, and edit idempotency substrate (Phase 103 / ADR-057).
 */

import type {
  ContextWindow,
  FuzzyMatcherOptions,
  FuzzyMatchResult,
  FuzzyMatchSpan,
  FuzzyStrategyName,
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

  constructor(options: FuzzyMatcherOptions = {}) {
    this.unicodeMap = { ...DEFAULT_UNICODE_MAP, ...(options.customUnicodeMap || {}) };
    this.similarityThreshold = options.similarityThreshold ?? 0.5;
    this.enabledStrategies = new Set<FuzzyStrategyName>(options.enabledStrategies || ALL_STRATEGIES);
    this.preserveIndentation = options.preserveIndentation ?? true;
    this.normalizeLineEndings = options.normalizeLineEndings ?? true;
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

  setCustomUnicodeMapping(char: string, replacement: string): void {
    this.unicodeMap[char] = replacement;
  }

  getUnicodeMap(): Record<string, string> {
    return { ...this.unicodeMap };
  }

  // ---------------------------------------------------------------------------
  // Unicode Typography Normalization
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
  // Indentation Adaptation
  // ---------------------------------------------------------------------------

  adaptIndentation(targetContent: string, matchSpan: FuzzyMatchSpan, replacement: string): string {
    if (!this.preserveIndentation) return replacement;

    const [start] = matchSpan;
    let lineStart = targetContent.lastIndexOf("\n", start - 1);
    lineStart = lineStart === -1 ? 0 : lineStart + 1;
    const lineEnd = targetContent.indexOf("\n", lineStart);
    const fullLine = targetContent.slice(lineStart, lineEnd === -1 ? targetContent.length : lineEnd);
    const leadingWhitespaceMatch = fullLine.match(/^[ \t]*/);
    const targetIndent = leadingWhitespaceMatch ? leadingWhitespaceMatch[0] : "";

    if (!targetIndent) return replacement;

    const replLines = replacement.split("\n");
    const replBaseIndentMatch = replLines[0].match(/^[ \t]*/);
    const replBaseIndent = replBaseIndentMatch ? replBaseIndentMatch[0] : "";

    if (replBaseIndent === targetIndent) return replacement;

    return replLines
      .map((line) => {
        if (!line.trim()) return "";
        if (line.startsWith(replBaseIndent)) {
          return targetIndent + line.slice(replBaseIndent.length);
        }
        return targetIndent + line;
      })
      .join("\n");
  }

  // ---------------------------------------------------------------------------
  // Unified Diff Preview Generator
  // ---------------------------------------------------------------------------

  generateDiffPreview(oldText: string, newText: string): string {
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");
    const diff: string[] = ["--- a/content", "+++ b/content"];

    let i = 0;
    let j = 0;
    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        i++;
        j++;
      } else {
        if (i < oldLines.length) {
          diff.push(`-${oldLines[i]}`);
          i++;
        }
        if (j < newLines.length) {
          diff.push(`+${newLines[j]}`);
          j++;
        }
      }
    }
    return diff.join("\n");
  }

  // ---------------------------------------------------------------------------
  // 9 Matching Strategies
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

  private strategyUnicodeNormalized(content: string, target: string): FuzzyMatchSpan[] {
    const normTarget = this.normalizeUnicode(target);
    const normContent = this.normalizeUnicode(content);

    if (normTarget === target && normContent === content) {
      return [];
    }

    const normMatches = this.strategyExact(normContent, normTarget);
    if (normMatches.length === 0) {
      return this.strategyLineTrimmed(normContent, normTarget);
    }
    return normMatches;
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
  // Master Find and Replace Cascading Entry Point
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

        // Apply replacement from right to left (backwards) to preserve indices
        let modified = content;
        const sortedMatches = [...matches].sort((a, b) => b[0] - a[0]);

        for (let m = 0; m < sortedMatches.length; m++) {
          const span = sortedMatches[m];
          const [start, end] = span;
          const adaptedReplacement = this.adaptIndentation(content, span, newString);
          modified = modified.slice(0, start) + adaptedReplacement + modified.slice(end);
        }

        const simScore =
          name === "exact"
            ? 1.0
            : this.calculateSimilarity(content.slice(matches[0][0], matches[0][1]), oldString);

        const diff = this.generateDiffPreview(content, modified);
        const windows = this.extractContextWindows(content, matches);

        if (options.dryRun) {
          return {
            success: true,
            modifiedContent: content, // unmodified under dry run
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

    return {
      success: false,
      modifiedContent: content,
      matchCount: 0,
      strategyUsed: null,
      isIdempotent: false,
      error: `Could not find a match for old_string across all active fuzzy matching strategies.`,
    };
  }
}
