/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-inverted-index-engine.ts
 *
 * Adaptive BM25 Inverted Full-Text Search Engine for BroccoliDB (Pass 200 / ADR-138).
 * Provides probabilistic BM25 ranking, positional phrase queries, and inverted posting lists.
 */

import type {
  Bm25SearchResult,
  IBroccoliInvertedIndexEngine,
} from "../../../core/contracts/broccolidb.contracts.js";

interface PostingEntry {
  termFrequency: number;
  positions: number[];
}

interface TableIndexState {
  docs: Map<string, { length: number; text: string; metadata?: Record<string, unknown> }>;
  // term -> (docId -> PostingEntry)
  postings: Map<string, Map<string, PostingEntry>>;
  totalDocLength: number;
}

export class BroccoliInvertedIndexEngine implements IBroccoliInvertedIndexEngine {
  private readonly tables = new Map<string, TableIndexState>();

  public indexDocument(table: string, docId: string, text: string, metadata?: Record<string, unknown>): void {
    const state = this.getOrCreateTableState(table);

    // If doc previously existed, remove it first
    if (state.docs.has(docId)) {
      this.removeDocument(table, docId);
    }

    const tokens = this.tokenize(text);
    const docLength = tokens.length;
    state.docs.set(docId, { length: docLength, text, metadata });
    state.totalDocLength += docLength;

    for (let pos = 0; pos < tokens.length; pos++) {
      const term = tokens[pos];
      if (!state.postings.has(term)) {
        state.postings.set(term, new Map());
      }
      const termMap = state.postings.get(term)!;
      if (!termMap.has(docId)) {
        termMap.set(docId, { termFrequency: 0, positions: [] });
      }
      const entry = termMap.get(docId)!;
      entry.termFrequency++;
      entry.positions.push(pos);
    }
  }

  public removeDocument(table: string, docId: string): boolean {
    const state = this.tables.get(table);
    if (!state || !state.docs.has(docId)) return false;

    const doc = state.docs.get(docId)!;
    state.totalDocLength -= doc.length;
    state.docs.delete(docId);

    // Clean from postings
    for (const [term, docMap] of Array.from(state.postings.entries())) {
      docMap.delete(docId);
      if (docMap.size === 0) {
        state.postings.delete(term);
      }
    }

    return true;
  }

  public search(
    table: string,
    query: string,
    limit = 10,
    options: { readonly k1?: number; readonly b?: number; readonly phrase?: boolean } = {}
  ): readonly Bm25SearchResult[] {
    const state = this.tables.get(table);
    if (!state || state.docs.size === 0) return [];

    const k1 = options.k1 ?? 1.2;
    const b = options.b ?? 0.75;
    const isPhrase = options.phrase ?? false;

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const N = state.docs.size;
    const avgdl = state.totalDocLength / N;

    // docId -> score & matched terms
    const docScores = new Map<string, { score: number; matchedTerms: Set<string> }>();

    for (const term of queryTokens) {
      const docMap = state.postings.get(term);
      if (!docMap) continue;

      const n = docMap.size;
      // BM25 standard IDF with smoothing
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));

      for (const [docId, posting] of docMap.entries()) {
        const doc = state.docs.get(docId);
        if (!doc) continue;

        const tf = posting.termFrequency;
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (doc.length / (avgdl || 1)));
        const termScore = idf * (numerator / denominator);

        if (!docScores.has(docId)) {
          docScores.set(docId, { score: 0, matchedTerms: new Set() });
        }
        const acc = docScores.get(docId)!;
        acc.score += termScore;
        acc.matchedTerms.add(term);
      }
    }

    let results: Bm25SearchResult[] = Array.from(docScores.entries()).map(([docId, val]) => ({
      docId,
      score: val.score,
      matchedTerms: Array.from(val.matchedTerms),
    }));

    // If phrase search is enabled, filter for exact contiguous token positions
    if (isPhrase && queryTokens.length > 1) {
      results = results.filter((res) => {
        if (res.matchedTerms.length < queryTokens.length) return false;
        return this.matchesPhrasePositions(state, res.docId, queryTokens);
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  public getDocumentCount(table: string): number {
    return this.tables.get(table)?.docs.size ?? 0;
  }

  private matchesPhrasePositions(state: TableIndexState, docId: string, tokens: string[]): boolean {
    const firstTermPostings = state.postings.get(tokens[0])?.get(docId);
    if (!firstTermPostings) return false;

    for (const startPos of firstTermPostings.positions) {
      let isMatch = true;
      for (let i = 1; i < tokens.length; i++) {
        const nextPostings = state.postings.get(tokens[i])?.get(docId);
        if (!nextPostings || !nextPostings.positions.includes(startPos + i)) {
          isMatch = false;
          break;
        }
      }
      if (isMatch) return true;
    }

    return false;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9_\-\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }

  private getOrCreateTableState(table: string): TableIndexState {
    if (!this.tables.has(table)) {
      this.tables.set(table, {
        docs: new Map(),
        postings: new Map(),
        totalDocLength: 0,
      });
    }
    return this.tables.get(table)!;
  }
}
