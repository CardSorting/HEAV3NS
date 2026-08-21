import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface RipgrepMatch {
  filePath: string;
  lineNumber: number;
  columnNumber?: number;
  matchLength?: number;
  captures?: string[];
  lineContent: string;
  previewLineContent?: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

export interface RipgrepOptions {
  maxResults?: number;
  offset?: number;
  includes?: string[];
  excludes?: string[];
  pathRegex?: string;
  caseInsensitive?: boolean;
  smartCase?: boolean;
  isRegex?: boolean;
  wordMatch?: boolean;
  multiline?: boolean;
  fuzzy?: boolean;
  previewReplacement?: string;
  minMatchesPerFile?: number;
  maxMatchesPerFile?: number;
  ignoreComments?: boolean;
  uniqueLines?: boolean;
  requireAllQueriesInFile?: boolean;
  contextLines?: number;
  contextBefore?: number;
  contextAfter?: number;
  minFileSize?: number;
  maxFileSize?: number;
  maxLineLength?: number;
  maxDepth?: number;
  mtimeAfter?: number | Date;
  mtimeBefore?: number | Date;
  preserveWhitespace?: boolean;
  invertMatch?: boolean;
  startLine?: number;
  endLine?: number;
  filesOnly?: boolean;
  groupByFile?: boolean;
  highlight?: boolean;
  highlightTags?: [string, string];
  sortBy?: "path" | "matches" | "line";
  sortOrder?: "asc" | "desc";
  queries?: string[];
  signal?: AbortSignal;
}

export interface RipgrepSearchResult {
  matches: RipgrepMatch[];
  totalMatches: number;
  filesScanned: number;
  filesMatched: number;
  matchedFiles?: string[];
  fileCounts?: Record<string, number>;
  groupedByFile?: Record<string, RipgrepMatch[]>;
  durationMs: number;
  truncated: boolean;
}

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
  ".woff", ".woff2", ".ttf", ".eot",
  ".zip", ".tar", ".gz", ".7z", ".rar",
  ".pdf", ".wasm", ".bin", ".exe", ".dylib", ".so", ".dll",
  ".mp3", ".mp4", ".wav", ".webm", ".node",
  ".lock", ".lockb",
]);

export class RipgrepSearchService {
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private resolveCaseSensitivity(queries: string[], options?: RipgrepOptions): boolean {
    if (options?.smartCase === true) {
      return !queries.some((q) => /[A-Z]/.test(q));
    }
    if (typeof options?.caseInsensitive === "boolean") {
      return options.caseInsensitive;
    }
    return true; // Default case-insensitive
  }

  private normalizeQueries(query: string | string[], options?: RipgrepOptions): string[] {
    const list: string[] = [];
    if (Array.isArray(query)) {
      list.push(...query.map(String));
    } else if (typeof query === "string" && query.length > 0) {
      list.push(query);
    }
    if (options?.queries && Array.isArray(options.queries)) {
      list.push(...options.queries.map(String));
    }
    return list.filter((q) => q.length > 0);
  }

  private buildRegex(
    queries: string[],
    caseInsensitive: boolean = true,
    wordMatch: boolean = false,
    isRegex?: boolean,
    multiline: boolean = false,
    fuzzy: boolean = false
  ): RegExp {
    let flags = "";
    if (caseInsensitive) flags += "i";
    if (multiline) flags += "m";

    const patterns = queries.map((q) => {
      if (fuzzy) {
        return q
          .split("")
          .map((c) => this.escapeRegex(c))
          .join(".*?");
      }
      if (isRegex === false) {
        return this.escapeRegex(q);
      }
      try {
        new RegExp(q);
        return q;
      } catch {
        return this.escapeRegex(q);
      }
    });

    const combined = patterns.length === 1 ? patterns[0] : patterns.map((p) => `(?:${p})`).join("|");
    const finalPattern = wordMatch ? `\\b(?:${combined})\\b` : combined;
    try {
      return new RegExp(finalPattern, flags);
    } catch {
      const fallbackCombined = queries.map((q) => this.escapeRegex(q)).join("|");
      return new RegExp(wordMatch ? `\\b(?:${fallbackCombined})\\b` : fallbackCombined, flags);
    }
  }

  private expandBracePattern(pattern: string): string[] {
    const braceMatch = pattern.match(/^(.*)\{([^{}]+)\}(.*)$/);
    if (!braceMatch) return [pattern];
    const prefix = braceMatch[1];
    const choices = braceMatch[2].split(",").map((c) => c.trim());
    const suffix = braceMatch[3];
    const results: string[] = [];
    for (const choice of choices) {
      const expanded = `${prefix}${choice}${suffix}`;
      results.push(...this.expandBracePattern(expanded));
    }
    return results;
  }

  private matchesGlob(filename: string, fullPath: string, pattern: string): boolean {
    const expandedPatterns = this.expandBracePattern(pattern);
    const normalizedPath = fullPath.replace(/\\/g, "/");

    return expandedPatterns.some((pat) => {
      const cleanPat = pat.trim().replace(/\\/g, "/");
      if (cleanPat === "*") return true;
      if (cleanPat.includes("/")) {
        if (cleanPat.startsWith("**/")) {
          const suffix = cleanPat.slice(3);
          if (suffix.startsWith("*.")) {
            return filename.endsWith(suffix.slice(1));
          }
          return normalizedPath.endsWith(suffix) || normalizedPath.includes(`/${suffix}`);
        }
        return normalizedPath.endsWith(cleanPat) || normalizedPath.includes(`/${cleanPat}`);
      }
      if (cleanPat.startsWith("*.")) {
        const ext = cleanPat.slice(1);
        return filename.endsWith(ext);
      }
      if (cleanPat.startsWith("*")) {
        return filename.endsWith(cleanPat.slice(1));
      }
      if (cleanPat.endsWith("*")) {
        return filename.startsWith(cleanPat.slice(0, -1));
      }
      return filename.includes(cleanPat) || normalizedPath.includes(cleanPat);
    });
  }

  private truncateLine(line: string, colNum: number, maxLen: number): string {
    if (line.length <= maxLen) return line;
    const half = Math.floor(maxLen / 2);
    const start = Math.max(0, colNum - half);
    const end = Math.min(line.length, start + maxLen);
    return (start > 0 ? "..." : "") + line.slice(start, end) + (end < line.length ? "..." : "");
  }

  private cleanContent(raw: string): string | null {
    // Strip BOM
    let text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    // Fast binary null byte sniff
    const checkLen = Math.min(text.length, 512);
    for (let i = 0; i < checkLen; i++) {
      if (text.charCodeAt(i) === 0) return null;
    }
    return text;
  }

  private highlightMatch(line: string, colNum: number, matchLen: number, tags: [string, string]): string {
    const start = Math.max(0, colNum - 1);
    const end = start + matchLen;
    return line.slice(0, start) + tags[0] + line.slice(start, end) + tags[1] + line.slice(end);
  }

  private isCommentLine(line: string): boolean {
    const trimmed = line.trimStart();
    return (
      trimmed.startsWith("//") ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("--") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("*/") ||
      trimmed.startsWith("<!--") ||
      trimmed.startsWith("rem ") ||
      trimmed.startsWith("REM ")
    );
  }

  async *searchStream(
    query: string | string[],
    searchPath: string,
    options?: RipgrepOptions
  ): AsyncGenerator<RipgrepMatch, void, unknown> {
    const queries = this.normalizeQueries(query, options);
    if (queries.length === 0) return;

    const maxResults = options?.maxResults ?? 50;
    const caseInsensitive = this.resolveCaseSensitivity(queries, options);
    const isRegex = options?.isRegex;
    const wordMatch = options?.wordMatch ?? false;
    const fuzzy = options?.fuzzy ?? false;
    const previewReplacement = options?.previewReplacement;
    const isMultilineQuery = queries.some((q) => q.includes("\n")) || options?.multiline === true;
    const contextBefore = Math.max(0, options?.contextBefore ?? options?.contextLines ?? 0);
    const contextAfter = Math.max(0, options?.contextAfter ?? options?.contextLines ?? 0);
    const minFileSize = typeof options?.minFileSize === "number" ? options.minFileSize : undefined;
    const maxFileSize = options?.maxFileSize ?? 4 * 1024 * 1024; // 4MB
    const maxLineLength = options?.maxLineLength ?? 500;
    const maxDepth = typeof options?.maxDepth === "number" ? options.maxDepth : undefined;
    const mtimeAfterMs = options?.mtimeAfter instanceof Date ? options.mtimeAfter.getTime() : (typeof options?.mtimeAfter === "number" ? options.mtimeAfter : undefined);
    const mtimeBeforeMs = options?.mtimeBefore instanceof Date ? options.mtimeBefore.getTime() : (typeof options?.mtimeBefore === "number" ? options.mtimeBefore : undefined);
    const requireAllQueriesInFile = options?.requireAllQueriesInFile ?? false;
    const maxMatchesPerFile = typeof options?.maxMatchesPerFile === "number" ? options.maxMatchesPerFile : undefined;
    const ignoreComments = options?.ignoreComments ?? false;
    const preserveWhitespace = options?.preserveWhitespace ?? false;
    const invertMatch = options?.invertMatch ?? false;
    const startLine = options?.startLine ? Math.max(1, options.startLine) : 1;
    const endLine = options?.endLine ? Math.max(startLine, options.endLine) : Number.MAX_SAFE_INTEGER;
    const highlight = options?.highlight ?? false;
    const highlightTags: [string, string] = options?.highlightTags ?? ["<<<", ">>>"];
    const signal = options?.signal;
    const visitedDirs = new Set<string>();

    let matchCount = 0;

    const positiveIncludes: string[] = [];
    const negativeIncludes: string[] = [];
    if (options?.includes) {
      for (const inc of options.includes) {
        if (inc.startsWith("!")) {
          negativeIncludes.push(inc.slice(1));
        } else {
          positiveIncludes.push(inc);
        }
      }
    }

    const excludes = [...(options?.excludes ?? []), ...negativeIncludes];
    const regex = this.buildRegex(queries, caseInsensitive, wordMatch, isRegex, isMultilineQuery, fuzzy);

    const checkExists = await fs.stat(searchPath).catch(() => null);
    if (!checkExists) return;

    const walk = async function* (this: RipgrepSearchService, target: string, currentDepth: number): AsyncGenerator<RipgrepMatch, void, unknown> {
      if (signal?.aborted || matchCount >= maxResults) return;
      if (maxDepth !== undefined && currentDepth > maxDepth) return;

      try {
        const stat = await fs.stat(target);
        if (minFileSize !== undefined && stat.size < minFileSize) return;
        if (mtimeAfterMs !== undefined && stat.mtimeMs < mtimeAfterMs) return;
        if (mtimeBeforeMs !== undefined && stat.mtimeMs > mtimeBeforeMs) return;

        if (stat.isFile()) {
          const rawContent = await fs.readFile(target, "utf-8");
          if (rawContent.length > maxFileSize) return;
          const content = this.cleanContent(rawContent);
          if (content === null) return;

          if (requireAllQueriesInFile && queries.length > 1) {
            const allMatch = queries.every((q) =>
              this.buildRegex([q], caseInsensitive, wordMatch, isRegex, isMultilineQuery, fuzzy).test(content)
            );
            if (!allMatch) return;
          }

          let fileYieldCount = 0;

          if (isMultilineQuery && !invertMatch) {
            const globalFlags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
            const globalRegex = new RegExp(regex.source, globalFlags);
            let match: RegExpExecArray | null;

            while ((match = globalRegex.exec(content)) !== null) {
              if (signal?.aborted || matchCount >= maxResults) break;
              if (maxMatchesPerFile !== undefined && fileYieldCount >= maxMatchesPerFile) break;

              const matchIndex = match.index;
              const textBefore = content.slice(0, matchIndex);
              const lineNum = (textBefore.match(/\n/g) || []).length + 1;
              if (lineNum < startLine || lineNum > endLine) continue;

              const lines = content.split("\n");
              const lineIdx = lineNum - 1;
              const rawLine = lines[lineIdx] ?? match[0];
              if (ignoreComments && this.isCommentLine(rawLine)) continue;

              const lastNl = textBefore.lastIndexOf("\n");
              const colNum = matchIndex - (lastNl === -1 ? 0 : lastNl + 1) + 1;

              const displayContent = preserveWhitespace ? rawLine : rawLine.trim();
              const finalContent = highlight ? this.highlightMatch(displayContent, colNum, match[0].length, highlightTags) : displayContent;
              const previewLine = previewReplacement !== undefined ? rawLine.replace(regex, previewReplacement) : undefined;

              const matchObj: RipgrepMatch = {
                filePath: target,
                lineNumber: lineNum,
                columnNumber: colNum,
                matchLength: match[0].length,
                lineContent: this.truncateLine(finalContent, colNum, maxLineLength),
                previewLineContent: previewLine !== undefined ? this.truncateLine(preserveWhitespace ? previewLine : previewLine.trim(), colNum, maxLineLength) : undefined,
              };

              if (contextBefore > 0 || contextAfter > 0) {
                const startBefore = Math.max(0, lineIdx - contextBefore);
                const endAfter = Math.min(lines.length, lineIdx + 1 + contextAfter);
                matchObj.contextBefore = lines.slice(startBefore, lineIdx).map((l) => (preserveWhitespace ? l.slice(0, maxLineLength) : l.trim().slice(0, maxLineLength)));
                matchObj.contextAfter = lines.slice(lineIdx + 1, endAfter).map((l) => (preserveWhitespace ? l.slice(0, maxLineLength) : l.trim().slice(0, maxLineLength)));
              }

              fileYieldCount++;
              matchCount++;
              yield matchObj;
              if (match[0].length === 0) {
                globalRegex.lastIndex++;
              }
            }
          } else {
            const lines = content.split("\n");
            if (lines.length > 0 && lines[lines.length - 1] === "") {
              lines.pop();
            }
            const fromIdx = Math.max(0, startLine - 1);
            const toIdx = Math.min(lines.length, endLine);

            for (let i = fromIdx; i < toIdx; i++) {
              if (signal?.aborted || matchCount >= maxResults) break;
              if (maxMatchesPerFile !== undefined && fileYieldCount >= maxMatchesPerFile) break;

              const matchExec = regex.exec(lines[i]);
              const isMatch = invertMatch ? !matchExec : !!matchExec;

              if (isMatch) {
                const rawLine = lines[i];
                if (ignoreComments && this.isCommentLine(rawLine)) continue;

                const displayContent = preserveWhitespace ? rawLine : rawLine.trim();
                const colNum = matchExec ? matchExec.index + 1 : 1;
                const matchLen = matchExec ? matchExec[0].length : 0;
                const finalContent = highlight && matchExec ? this.highlightMatch(displayContent, colNum, matchLen, highlightTags) : displayContent;
                const previewLine = previewReplacement !== undefined ? rawLine.replace(regex, previewReplacement) : undefined;

                const matchObj: RipgrepMatch = {
                  filePath: target,
                  lineNumber: i + 1,
                  columnNumber: colNum,
                  matchLength: matchLen,
                  lineContent: this.truncateLine(finalContent, colNum, maxLineLength),
                  previewLineContent: previewLine !== undefined ? this.truncateLine(preserveWhitespace ? previewLine : previewLine.trim(), colNum, maxLineLength) : undefined,
                };

                if (contextBefore > 0 || contextAfter > 0) {
                  const startBefore = Math.max(0, i - contextBefore);
                  const endAfter = Math.min(lines.length, i + 1 + contextAfter);
                  matchObj.contextBefore = lines.slice(startBefore, i).map((l) => (preserveWhitespace ? l.slice(0, maxLineLength) : l.trim().slice(0, maxLineLength)));
                  matchObj.contextAfter = lines.slice(i + 1, endAfter).map((l) => (preserveWhitespace ? l.slice(0, maxLineLength) : l.trim().slice(0, maxLineLength)));
                }

                fileYieldCount++;
                matchCount++;
                yield matchObj;
              }
            }
          }
          return;
        }

        const realDir = await fs.realpath(target).catch(() => target);
        if (visitedDirs.has(realDir)) return;
        visitedDirs.add(realDir);

        const entries = await fs.readdir(target, { withFileTypes: true });
        const subdirs: string[] = [];
        const filesToScan: string[] = [];

        for (const entry of entries) {
          if (
            entry.name === "node_modules" ||
            entry.name === ".git" ||
            entry.name === "dist" ||
            entry.name === ".turbo" ||
            entry.name === ".next" ||
            entry.name === "coverage" ||
            entry.name === ".cache"
          ) {
            continue;
          }

          const fullPath = path.join(target, entry.name);
          if (excludes.length > 0) {
            const isExcluded = excludes.some((pat) => this.matchesGlob(entry.name, fullPath, pat));
            if (isExcluded) continue;
          }

          if (entry.isDirectory()) {
            subdirs.push(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (BINARY_EXTENSIONS.has(ext)) continue;

            if (positiveIncludes.length > 0) {
              const matchesInclude = positiveIncludes.some((pat) => this.matchesGlob(entry.name, fullPath, pat));
              if (!matchesInclude) continue;
            }

            filesToScan.push(fullPath);
          }
        }

        for (const f of filesToScan) {
          if (signal?.aborted || matchCount >= maxResults) break;
          yield* walk.call(this, f, currentDepth + 1);
        }

        for (const d of subdirs) {
          if (signal?.aborted || matchCount >= maxResults) break;
          yield* walk.call(this, d, currentDepth + 1);
        }
      } catch {
        // Skip unreadable files or dirs
      }
    };

    yield* walk.call(this, searchPath, 0);
  }

  async searchDetailed(
    query: string | string[],
    searchPath: string,
    options?: RipgrepOptions
  ): Promise<RipgrepSearchResult> {
    const startTime = performance.now();
    let matches: RipgrepMatch[] = [];
    const queries = this.normalizeQueries(query, options);

    if (queries.length === 0) {
      return {
        matches: [],
        totalMatches: 0,
        filesScanned: 0,
        filesMatched: 0,
        durationMs: 0,
        truncated: false,
      };
    }

    const maxResults = options?.maxResults ?? 50;
    const offset = typeof options?.offset === "number" && options.offset > 0 ? options.offset : 0;
    const caseInsensitive = this.resolveCaseSensitivity(queries, options);
    const isRegex = options?.isRegex;
    const wordMatch = options?.wordMatch ?? false;
    const fuzzy = options?.fuzzy ?? false;
    const previewReplacement = options?.previewReplacement;
    const minMatchesPerFile = typeof options?.minMatchesPerFile === "number" ? options.minMatchesPerFile : 1;
    const maxMatchesPerFile = typeof options?.maxMatchesPerFile === "number" ? options.maxMatchesPerFile : undefined;
    const ignoreComments = options?.ignoreComments ?? false;
    const uniqueLines = options?.uniqueLines ?? false;
    const pathRegex = typeof options?.pathRegex === "string" ? new RegExp(options.pathRegex) : undefined;
    const requireAllQueriesInFile = options?.requireAllQueriesInFile ?? false;
    const isMultilineQuery = queries.some((q) => q.includes("\n")) || options?.multiline === true;
    const contextBefore = Math.max(0, options?.contextBefore ?? options?.contextLines ?? 0);
    const contextAfter = Math.max(0, options?.contextAfter ?? options?.contextLines ?? 0);
    const minFileSize = typeof options?.minFileSize === "number" ? options.minFileSize : undefined;
    const maxFileSize = options?.maxFileSize ?? 4 * 1024 * 1024; // 4MB
    const maxLineLength = options?.maxLineLength ?? 500;
    const maxDepth = typeof options?.maxDepth === "number" ? options.maxDepth : undefined;
    const mtimeAfterMs = options?.mtimeAfter instanceof Date ? options.mtimeAfter.getTime() : (typeof options?.mtimeAfter === "number" ? options.mtimeAfter : undefined);
    const mtimeBeforeMs = options?.mtimeBefore instanceof Date ? options.mtimeBefore.getTime() : (typeof options?.mtimeBefore === "number" ? options.mtimeBefore : undefined);
    const preserveWhitespace = options?.preserveWhitespace ?? false;
    const invertMatch = options?.invertMatch ?? false;
    const startLine = options?.startLine ? Math.max(1, options.startLine) : 1;
    const endLine = options?.endLine ? Math.max(startLine, options.endLine) : Number.MAX_SAFE_INTEGER;
    const filesOnly = options?.filesOnly ?? false;
    const groupByFile = options?.groupByFile ?? false;
    const highlight = options?.highlight ?? false;
    const highlightTags: [string, string] = options?.highlightTags ?? ["<<<", ">>>"];
    const sortBy = options?.sortBy;
    const sortOrder = options?.sortOrder ?? "asc";
    const signal = options?.signal;
    const visitedDirs = new Set<string>();

    let filesScanned = 0;
    const matchedFiles = new Set<string>();
    const fileCounts: Record<string, number> = {};
    const groupedByFile: Record<string, RipgrepMatch[]> = {};

    const positiveIncludes: string[] = [];
    const negativeIncludes: string[] = [];
    if (options?.includes) {
      for (const inc of options.includes) {
        if (inc.startsWith("!")) {
          negativeIncludes.push(inc.slice(1));
        } else {
          positiveIncludes.push(inc);
        }
      }
    }

    const excludes = [...(options?.excludes ?? []), ...negativeIncludes];

    const checkExists = await fs.stat(searchPath).catch(() => null);
    if (!checkExists) {
      return {
        matches: [],
        totalMatches: 0,
        filesScanned: 0,
        filesMatched: 0,
        durationMs: 0,
        truncated: false,
      };
    }

    // Fast literal optimization if single query without regex/multiline/invertMatch/highlight/fuzzy/previewReplacement/ignoreComments/uniqueLines
    const isSingleLiteralPure = queries.length === 1 && !uniqueLines && !ignoreComments && !highlight && !fuzzy && previewReplacement === undefined && (isRegex === false || (!isMultilineQuery && !wordMatch && !invertMatch && !queries[0].includes("\\") && !queries[0].includes("[")));
    const queryLower = caseInsensitive && queries.length === 1 ? queries[0].toLowerCase() : queries[0];
    const regex = this.buildRegex(queries, caseInsensitive, wordMatch, isRegex, isMultilineQuery, fuzzy);

    const searchFile = async (filePath: string): Promise<void> => {
      if (signal?.aborted || matches.length >= (maxResults + offset)) return;
      if (pathRegex && !pathRegex.test(filePath)) return;

      try {
        filesScanned++;
        const rawContent = await fs.readFile(filePath, "utf-8");
        if (minFileSize !== undefined && rawContent.length < minFileSize) return;
        if (rawContent.length > maxFileSize) return;
        const content = this.cleanContent(rawContent);
        if (content === null) return;

        if (requireAllQueriesInFile && queries.length > 1) {
          const allMatch = queries.every((q) =>
            this.buildRegex([q], caseInsensitive, wordMatch, isRegex, isMultilineQuery, fuzzy).test(content)
          );
          if (!allMatch) return;
        }

        let fileMatchCount = 0;
        const fileMatches: RipgrepMatch[] = [];
        const seenLines = new Set<string>();

        if (isMultilineQuery && !invertMatch) {
          const globalFlags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
          const globalRegex = new RegExp(regex.source, globalFlags);
          let match: RegExpExecArray | null;

          while ((match = globalRegex.exec(content)) !== null) {
            if (signal?.aborted || matches.length >= (maxResults + offset)) break;
            if (maxMatchesPerFile !== undefined && fileMatchCount >= maxMatchesPerFile) break;

            const matchIndex = match.index;
            const textBefore = content.slice(0, matchIndex);
            const lineNum = (textBefore.match(/\n/g) || []).length + 1;
            if (lineNum < startLine || lineNum > endLine) continue;

            const lines = content.split("\n");
            const lineIdx = lineNum - 1;
            const rawLine = lines[lineIdx] ?? match[0];
            if (ignoreComments && this.isCommentLine(rawLine)) continue;

            const displayContent = preserveWhitespace ? rawLine : rawLine.trim();
            if (uniqueLines) {
              if (seenLines.has(displayContent)) continue;
              seenLines.add(displayContent);
            }

            const lastNl = textBefore.lastIndexOf("\n");
            const colNum = matchIndex - (lastNl === -1 ? 0 : lastNl + 1) + 1;

            fileMatchCount++;
            if (!filesOnly) {
              const finalContent = highlight ? this.highlightMatch(displayContent, colNum, match[0].length, highlightTags) : displayContent;
              const previewLine = previewReplacement !== undefined ? rawLine.replace(regex, previewReplacement) : undefined;

              const matchObj: RipgrepMatch = {
                filePath,
                lineNumber: lineNum,
                columnNumber: colNum,
                matchLength: match[0].length,
                captures: match.length > 1 ? Array.from(match).slice(1) : undefined,
                lineContent: this.truncateLine(finalContent, colNum, maxLineLength),
                previewLineContent: previewLine !== undefined ? this.truncateLine(preserveWhitespace ? previewLine : previewLine.trim(), colNum, maxLineLength) : undefined,
              };

              if (contextBefore > 0 || contextAfter > 0) {
                const startBefore = Math.max(0, lineIdx - contextBefore);
                const endAfter = Math.min(lines.length, lineIdx + 1 + contextAfter);
                matchObj.contextBefore = lines.slice(startBefore, lineIdx).map((l) => (preserveWhitespace ? l.slice(0, maxLineLength) : l.trim().slice(0, maxLineLength)));
                matchObj.contextAfter = lines.slice(lineIdx + 1, endAfter).map((l) => (preserveWhitespace ? l.slice(0, maxLineLength) : l.trim().slice(0, maxLineLength)));
              }

              fileMatches.push(matchObj);
            }

            if (match[0].length === 0) {
              globalRegex.lastIndex++;
            }
          }
        } else if (isSingleLiteralPure && !preserveWhitespace && startLine === 1 && endLine === Number.MAX_SAFE_INTEGER) {
          // Ultrafast literal substring scan
          const lines = content.split("\n");
          if (lines.length > 0 && lines[lines.length - 1] === "") {
            lines.pop();
          }
          for (let i = 0; i < lines.length; i++) {
            if (signal?.aborted || matches.length >= (maxResults + offset)) break;
            if (maxMatchesPerFile !== undefined && fileMatchCount >= maxMatchesPerFile) break;

            const lineToSearch = caseInsensitive ? lines[i].toLowerCase() : lines[i];
            const idx = lineToSearch.indexOf(queryLower);
            if (idx !== -1) {
              fileMatchCount++;
              if (!filesOnly) {
                const rawLine = lines[i];
                const displayContent = rawLine.trim();
                const colNum = idx + 1;

                const matchObj: RipgrepMatch = {
                  filePath,
                  lineNumber: i + 1,
                  columnNumber: colNum,
                  matchLength: queryLower.length,
                  lineContent: this.truncateLine(displayContent, colNum, maxLineLength),
                };

                if (contextBefore > 0 || contextAfter > 0) {
                  const startBefore = Math.max(0, i - contextBefore);
                  const endAfter = Math.min(lines.length, i + 1 + contextAfter);
                  matchObj.contextBefore = lines.slice(startBefore, i).map((l) => l.trim().slice(0, maxLineLength));
                  matchObj.contextAfter = lines.slice(i + 1, endAfter).map((l) => l.trim().slice(0, maxLineLength));
                }

                fileMatches.push(matchObj);
              }
            }
          }
        } else {
          // Fast single-line regex iteration
          const lines = content.split("\n");
          if (lines.length > 0 && lines[lines.length - 1] === "") {
            lines.pop();
          }
          const fromIdx = Math.max(0, startLine - 1);
          const toIdx = Math.min(lines.length, endLine);

          for (let i = fromIdx; i < toIdx; i++) {
            if (signal?.aborted || matches.length >= (maxResults + offset)) break;
            if (maxMatchesPerFile !== undefined && fileMatchCount >= maxMatchesPerFile) break;

            const matchExec = regex.exec(lines[i]);
            const isMatch = invertMatch ? !matchExec : !!matchExec;

            if (isMatch) {
              const rawLine = lines[i];
              if (ignoreComments && this.isCommentLine(rawLine)) continue;

              const displayContent = preserveWhitespace ? rawLine : rawLine.trim();
              if (uniqueLines) {
                if (seenLines.has(displayContent)) continue;
                seenLines.add(displayContent);
              }

              fileMatchCount++;
              if (!filesOnly) {
                const colNum = matchExec ? matchExec.index + 1 : 1;
                const matchLen = matchExec ? matchExec[0].length : 0;
                const finalContent = highlight && matchExec ? this.highlightMatch(displayContent, colNum, matchLen, highlightTags) : displayContent;
                const previewLine = previewReplacement !== undefined ? rawLine.replace(regex, previewReplacement) : undefined;

                const matchObj: RipgrepMatch = {
                  filePath,
                  lineNumber: i + 1,
                  columnNumber: colNum,
                  matchLength: matchLen,
                  captures: matchExec && matchExec.length > 1 ? Array.from(matchExec).slice(1) : undefined,
                  lineContent: this.truncateLine(finalContent, colNum, maxLineLength),
                  previewLineContent: previewLine !== undefined ? this.truncateLine(preserveWhitespace ? previewLine : previewLine.trim(), colNum, maxLineLength) : undefined,
                };

                if (contextBefore > 0 || contextAfter > 0) {
                  const startBefore = Math.max(0, i - contextBefore);
                  const endAfter = Math.min(lines.length, i + 1 + contextAfter);
                  matchObj.contextBefore = lines.slice(startBefore, i).map((l) => (preserveWhitespace ? l.slice(0, maxLineLength) : l.trim().slice(0, maxLineLength)));
                  matchObj.contextAfter = lines.slice(i + 1, endAfter).map((l) => (preserveWhitespace ? l.slice(0, maxLineLength) : l.trim().slice(0, maxLineLength)));
                }

                fileMatches.push(matchObj);
              }
            }
          }
        }

        if (fileMatchCount >= minMatchesPerFile) {
          matchedFiles.add(filePath);
          fileCounts[filePath] = fileMatchCount;
          for (const m of fileMatches) {
            matches.push(m);
            if (groupByFile) {
              if (!groupedByFile[filePath]) groupedByFile[filePath] = [];
              groupedByFile[filePath].push(m);
            }
          }
        }
      } catch {
        // Skip unreadable files
      }
    };

    const walkAndSearch = async (target: string, currentDepth: number): Promise<void> => {
      if (signal?.aborted || matches.length >= (maxResults + offset)) return;
      if (maxDepth !== undefined && currentDepth > maxDepth) return;

      try {
        const stat = await fs.stat(target);
        if (minFileSize !== undefined && stat.size < minFileSize) return;
        if (mtimeAfterMs !== undefined && stat.mtimeMs < mtimeAfterMs) return;
        if (mtimeBeforeMs !== undefined && stat.mtimeMs > mtimeBeforeMs) return;

        if (stat.isFile()) {
          await searchFile(target);
          return;
        }

        const realDir = await fs.realpath(target).catch(() => target);
        if (visitedDirs.has(realDir)) return;
        visitedDirs.add(realDir);

        const entries = await fs.readdir(target, { withFileTypes: true });
        const subdirs: string[] = [];
        const filesToScan: string[] = [];

        for (const entry of entries) {
          if (
            entry.name === "node_modules" ||
            entry.name === ".git" ||
            entry.name === "dist" ||
            entry.name === ".turbo" ||
            entry.name === ".next" ||
            entry.name === "coverage" ||
            entry.name === ".cache"
          ) {
            continue;
          }

          const fullPath = path.join(target, entry.name);
          if (excludes.length > 0) {
            const isExcluded = excludes.some((pat) => this.matchesGlob(entry.name, fullPath, pat));
            if (isExcluded) continue;
          }

          if (entry.isDirectory()) {
            subdirs.push(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (BINARY_EXTENSIONS.has(ext)) continue;

            if (positiveIncludes.length > 0) {
              const matchesInclude = positiveIncludes.some((pat) => this.matchesGlob(entry.name, fullPath, pat));
              if (!matchesInclude) continue;
            }

            if (pathRegex && !pathRegex.test(fullPath)) continue;

            filesToScan.push(fullPath);
          }
        }

        const chunkSize = 10;
        for (let i = 0; i < filesToScan.length; i += chunkSize) {
          if (signal?.aborted || matches.length >= (maxResults + offset)) break;
          const chunk = filesToScan.slice(i, i + chunkSize);
          await Promise.all(chunk.map((f) => searchFile(f)));
        }

        for (const subdir of subdirs) {
          if (signal?.aborted || matches.length >= (maxResults + offset)) break;
          await walkAndSearch(subdir, currentDepth + 1);
        }
      } catch {
        // Unreadable directory
      }
    };

    await walkAndSearch(searchPath, 0);

    if (sortBy) {
      const order = sortOrder === "desc" ? -1 : 1;
      if (sortBy === "path") {
        matches.sort((a, b) => (a.filePath.localeCompare(b.filePath) || a.lineNumber - b.lineNumber) * order);
      } else if (sortBy === "matches") {
        matches.sort((a, b) => ((fileCounts[b.filePath] ?? 0) - (fileCounts[a.filePath] ?? 0) || a.filePath.localeCompare(b.filePath)) * order);
      } else if (sortBy === "line") {
        matches.sort((a, b) => (a.lineNumber - b.lineNumber) * order);
      }
    }

    if (offset > 0) {
      matches = matches.slice(offset);
    }
    if (matches.length > maxResults) {
      matches = matches.slice(0, maxResults);
    }

    const durationMs = Number((performance.now() - startTime).toFixed(2));
    const totalMatches = filesOnly
      ? Object.values(fileCounts).reduce((a, b) => a + b, 0)
      : matches.length;

    return {
      matches,
      totalMatches,
      filesScanned,
      filesMatched: matchedFiles.size,
      matchedFiles: Array.from(matchedFiles),
      fileCounts,
      groupedByFile: groupByFile ? groupedByFile : undefined,
      durationMs,
      truncated: totalMatches >= maxResults,
    };
  }

  async search(
    query: string | string[],
    searchPath: string,
    options?: RipgrepOptions
  ): Promise<RipgrepMatch[]> {
    const res = await this.searchDetailed(query, searchPath, options);
    return res.matches;
  }
}
