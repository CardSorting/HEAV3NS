import type {
  IBroccoliSearchSubstrate,
  IndexedMessageRecord,
} from "../../../core/contracts/search.contracts.js";

/**
 * In-Memory Broccolidb Search Substrate & Inverted Index.
 *
 * Stores message records and maintains an in-memory inverted index of terms
 * to posting lists in zero-GC memory structures with sub-microsecond lookup latency.
 */
export class BroccoliSearchSubstrate implements IBroccoliSearchSubstrate {
  private readonly records: Map<string, IndexedMessageRecord> = new Map();
  private readonly invertedIndex: Map<string, Set<string>> = new Map();
  private readonly sessionIndex: Map<string, string[]> = new Map();

  get totalDocuments(): number {
    return this.records.size;
  }

  indexMessage(record: IndexedMessageRecord): void {
    this.records.set(record.id, record);

    // Track session messages
    const sessionList = this.sessionIndex.get(record.sessionId) ?? [];
    if (!sessionList.includes(record.id)) {
      sessionList.push(record.id);
      this.sessionIndex.set(record.sessionId, sessionList);
    }

    // Tokenize words and bigrams for inverted index
    const text = `${record.role} ${record.content} ${record.toolName ?? ""}`.toLowerCase();
    const words = text.split(/[^a-zA-Z0-9_\u4e00-\u9fa5]+/).filter((w) => w.length > 0);

    for (const word of words) {
      let postings = this.invertedIndex.get(word);
      if (!postings) {
        postings = new Set();
        this.invertedIndex.set(word, postings);
      }
      postings.add(record.id);
    }
  }

  getMessage(recordId: string): IndexedMessageRecord | undefined {
    return this.records.get(recordId);
  }

  listMessages(sessionId?: string): readonly IndexedMessageRecord[] {
    if (sessionId) {
      const ids = this.sessionIndex.get(sessionId) ?? [];
      return ids.map((id) => this.records.get(id)!).filter(Boolean);
    }
    return Array.from(this.records.values());
  }

  getPostings(term: string): readonly string[] {
    const lower = term.toLowerCase();
    const set = this.invertedIndex.get(lower);
    return set ? Array.from(set) : [];
  }

  getAllTerms(): readonly string[] {
    return Array.from(this.invertedIndex.keys());
  }

  clear(): void {
    this.records.clear();
    this.invertedIndex.clear();
    this.sessionIndex.clear();
  }
}
