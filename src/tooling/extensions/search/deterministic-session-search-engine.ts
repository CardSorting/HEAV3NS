import type {
  IBroccoliSearchSubstrate,
  IDeterministicSessionSearchEngine,
  IFtsQuerySanitizer,
  IndexedMessageRecord,
  SearchMatchSnippet,
  SearchQueryOptions,
} from "../../../core/contracts/search.contracts.js";

/**
 * Deterministic Session Search Engine with BM25 & Trigram Relevance Scoring.
 */
export class DeterministicSessionSearchEngine implements IDeterministicSessionSearchEngine {
  private readonly substrate: IBroccoliSearchSubstrate;
  private readonly sanitizer: IFtsQuerySanitizer;

  constructor(substrate: IBroccoliSearchSubstrate, sanitizer: IFtsQuerySanitizer) {
    this.substrate = substrate;
    this.sanitizer = sanitizer;
  }

  indexMessage(record: IndexedMessageRecord): void {
    this.substrate.indexMessage(record);
  }

  search(options: SearchQueryOptions): readonly SearchMatchSnippet[] {
    const { cleanQuery, tokens } = this.sanitizer.sanitizeQuery(options.query);
    if (tokens.length === 0) {
      return [];
    }

    const limit = options.limit ?? 20;
    const minScore = options.minScore ?? 0.01;
    const totalDocs = Math.max(1, this.substrate.totalDocuments);

    // Accumulate term scores per document using posting lists
    const docMatches = new Map<string, { score: number; matchedTerms: string[] }>();

    for (const token of tokens) {
      const postings = this.substrate.getPostings(token);
      if (postings.length === 0) continue;
      const idf = Math.log(1 + (totalDocs - postings.length + 0.5) / (postings.length + 0.5));

      for (const id of postings) {
        let entry = docMatches.get(id);
        if (!entry) {
          entry = { score: 0, matchedTerms: [] };
          docMatches.set(id, entry);
        }
        entry.matchedTerms.push(token);
        entry.score += idf;
      }
    }

    if (docMatches.size === 0) {
      return [];
    }

    // Sort candidate matches by score descending
    const sortedEntries = Array.from(docMatches.entries())
      .filter(([_, match]) => match.score >= minScore)
      .sort((a, b) => b[1].score - a[1].score);

    const results: SearchMatchSnippet[] = [];

    for (const [id, match] of sortedEntries) {
      if (results.length >= limit) break;

      const record = this.substrate.getMessage(id);
      if (!record) continue;

      // Filter by role if specified
      if (options.roleFilter && record.role !== options.roleFilter) {
        continue;
      }
      // Filter by toolName if specified
      if (options.toolNameFilter && record.toolName !== options.toolNameFilter) {
        continue;
      }
      // Filter by session if specified
      if (options.sessionFilter && record.sessionId !== options.sessionFilter) {
        continue;
      }

      // Generate snippet around first matched term
      const firstTerm = match.matchedTerms[0];
      const contentLower = record.content.toLowerCase();
      const matchIdx = contentLower.indexOf(firstTerm);
      const snippetStart = Math.max(0, matchIdx - 60);
      const snippetEnd = Math.min(record.content.length, matchIdx + 120);
      let snippet = record.content.slice(snippetStart, snippetEnd);
      if (snippetStart > 0) snippet = "..." + snippet;
      if (snippetEnd < record.content.length) snippet = snippet + "...";

      results.push({
        recordId: record.id,
        sessionId: record.sessionId,
        turnIndex: record.turnIndex,
        role: record.role,
        snippet,
        matchedTerms: match.matchedTerms,
        score: Number(match.score.toFixed(4)),
      });
    }

    return results;
  }
}
