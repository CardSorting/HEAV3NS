/**
 * Session Search & Inverted-Index Contracts
 *
 * Defines typed schemas and interfaces for the Deterministic Full-Text Search,
 * Inverted Index, and BM25 Relevance Scoring subsystem (K_search).
 */

export interface IndexedMessageRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly turnIndex: number;
  readonly role: string;
  readonly content: string;
  readonly toolName?: string;
  readonly timestampMs: number;
}

export interface SearchQueryOptions {
  readonly query: string;
  readonly roleFilter?: string;
  readonly toolNameFilter?: string;
  readonly sessionFilter?: string;
  readonly limit?: number;
  readonly minScore?: number;
}

export interface SearchMatchSnippet {
  readonly recordId: string;
  readonly sessionId: string;
  readonly turnIndex: number;
  readonly role: string;
  readonly snippet: string;
  readonly matchedTerms: readonly string[];
  readonly score: number;
}

export interface SearchIndexSnapshot {
  readonly records: readonly IndexedMessageRecord[];
  readonly totalIndexedTerms: number;
  readonly snapshotTick: number;
}

export interface IFtsQuerySanitizer {
  sanitizeQuery(rawQuery: string): { cleanQuery: string; tokens: readonly string[]; isCjk: boolean };
}

export interface IBroccoliSearchSubstrate {
  readonly totalDocuments: number;
  indexMessage(record: IndexedMessageRecord): void;
  getMessage(recordId: string): IndexedMessageRecord | undefined;
  listMessages(sessionId?: string): readonly IndexedMessageRecord[];
  getPostings(term: string): readonly string[];
  getAllTerms(): readonly string[];
  clear(): void;
}

export interface ISearchSnapshotManager {
  createSnapshot(tick: number): SearchIndexSnapshot;
  restoreSnapshot(snapshot: SearchIndexSnapshot): void;
}

export interface IDeterministicSessionSearchEngine {
  indexMessage(record: IndexedMessageRecord): void;
  search(options: SearchQueryOptions): readonly SearchMatchSnippet[];
}
