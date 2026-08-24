/**
 * tool-semantic-index.ts
 *
 * High-Performance In-Memory BM25 + TF-IDF Semantic Tool Retrieval Index.
 * Indexes tool names, descriptions, tags, parameters, and intent synonyms.
 * Computes BM25 relevance scores for user prompts and queries to discover the top-k
 * most relevant tools with microsecond query latency.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";

export interface ToolScoredMatch {
  readonly tool: ToolDefinition;
  readonly score: number;
  readonly matchedTerms: readonly string[];
}

export interface BM25Config {
  readonly k1?: number;
  readonly b?: number;
}

const INTENT_SYNONYMS: Record<string, string[]> = {
  find: ["search", "grep", "locate", "query", "lookup", "discover"],
  search: ["find", "grep", "query", "lookup", "ripgrep", "match"],
  read: ["view", "inspect", "cat", "open", "show", "get"],
  view: ["read", "inspect", "show", "open", "cat"],
  edit: ["modify", "replace", "patch", "change", "update", "rewrite"],
  replace: ["edit", "modify", "patch", "change", "substitute"],
  write: ["create", "save", "write_file", "output", "generate"],
  delete: ["remove", "unlink", "rm", "erase", "clear", "purge"],
  run: ["execute", "exec", "terminal", "bash", "command", "shell"],
  execute: ["run", "exec", "terminal", "bash", "command", "process"],
  browser: ["web", "navigate", "page", "dom", "click", "scrape", "cdp"],
  web: ["browser", "http", "fetch", "url", "scrape", "navigate"],
  database: ["sql", "query", "table", "schema", "db", "select", "insert"],
  git: ["commit", "worktree", "branch", "diff", "repo", "vcs"],
  test: ["check", "validate", "benchmark", "assert", "eval", "suite"],
  fix: ["heal", "repair", "correct", "remedy", "resolve", "patch"],
  ast: ["syntax", "tree", "parse", "symbol", "declaration", "lsp"],
  lsp: ["diagnostics", "definition", "references", "symbols", "autocomplete"],
  security: ["threat", "secret", "redact", "mask", "guard", "firewall"],
  audio: ["speech", "voice", "transcribe", "sound", "container", "wav"],
  image: ["vision", "visual", "multimodal", "picture", "screenshot"],
};

export class ToolSemanticIndex {
  private readonly k1: number;
  private readonly b: number;
  private documents: Array<{
    tool: ToolDefinition;
    tokens: string[];
    termFrequencies: Map<string, number>;
    length: number;
  }> = [];
  private invertedIndex = new Map<string, Array<{ docIndex: number; tf: number }>>();
  private docFrequencies = new Map<string, number>();
  private avgDocLength = 0;
  private totalDocs = 0;

  constructor(config: BM25Config = {}) {
    this.k1 = config.k1 ?? 1.5;
    this.b = config.b ?? 0.75;
  }

  /**
   * Tokenizes text into normalized stems, expanding synonyms and removing stop words.
   */
  public tokenize(text: string): string[] {
    const rawTokens = text
      .toLowerCase()
      .replace(/[^a-z0-9_ -]/g, " ")
      .split(/[\s_-]+/)
      .filter((t) => t.length > 1);

    const expanded: string[] = [];
    const stopWords = new Set(["the", "and", "for", "with", "this", "that", "from", "into", "over"]);

    for (const t of rawTokens) {
      if (stopWords.has(t)) continue;
      expanded.push(t);
      // Add synonym expansions
      if (INTENT_SYNONYMS[t]) {
        for (const syn of INTENT_SYNONYMS[t]) {
          expanded.push(syn);
        }
      }
    }

    return expanded;
  }

  /**
   * Builds the inverted index over a list of tool definitions.
   */
  public indexTools(tools: readonly ToolDefinition[]): void {
    this.documents = [];
    this.invertedIndex.clear();
    this.docFrequencies.clear();

    let totalLength = 0;

    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      const docText = [
        tool.name,
        tool.name.replace(/_/g, " "),
        tool.description,
        tool.category || "",
        ...(tool.tags || []),
        ...Object.keys(tool.parameters || {}),
        ...Object.values(tool.parameters || {}).map((p) => p.description || ""),
      ].join(" ");

      const tokens = this.tokenize(docText);
      const tfMap = new Map<string, number>();

      for (const token of tokens) {
        tfMap.set(token, (tfMap.get(token) || 0) + 1);
      }

      this.documents.push({
        tool,
        tokens,
        termFrequencies: tfMap,
        length: tokens.length,
      });

      totalLength += tokens.length;

      for (const token of tfMap.keys()) {
        const postings = this.invertedIndex.get(token) || [];
        postings.push({ docIndex: i, tf: tfMap.get(token)! });
        this.invertedIndex.set(token, postings);
        this.docFrequencies.set(token, (this.docFrequencies.get(token) || 0) + 1);
      }
    }

    this.totalDocs = tools.length;
    this.avgDocLength = this.totalDocs > 0 ? totalLength / this.totalDocs : 0;
  }

  /**
   * Searches the indexed tools using BM25 scoring.
   */
  public search(query: string, topK = 10, minScore = 0.5): ToolScoredMatch[] {
    if (this.totalDocs === 0 || !query.trim()) return [];

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const scores = new Float64Array(this.totalDocs);
    const matchedTermsMap = new Map<number, Set<string>>();

    for (const qToken of queryTokens) {
      const postings = this.invertedIndex.get(qToken);
      if (!postings) continue;

      const df = this.docFrequencies.get(qToken) || 0;
      // Robertson-Spärck Jones IDF formula
      const idf = Math.log((this.totalDocs - df + 0.5) / (df + 0.5) + 1);

      for (const posting of postings) {
        const doc = this.documents[posting.docIndex];
        const tf = posting.tf;
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (doc.length / this.avgDocLength));
        const termScore = idf * (numerator / denominator);

        scores[posting.docIndex] += termScore;

        if (!matchedTermsMap.has(posting.docIndex)) {
          matchedTermsMap.set(posting.docIndex, new Set());
        }
        matchedTermsMap.get(posting.docIndex)!.add(qToken);
      }
    }

    const matches: ToolScoredMatch[] = [];
    for (let i = 0; i < this.totalDocs; i++) {
      if (scores[i] >= minScore) {
        matches.push({
          tool: this.documents[i].tool,
          score: Number(scores[i].toFixed(3)),
          matchedTerms: Array.from(matchedTermsMap.get(i) || []),
        });
      }
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}
