/**
 * broccoli-speech-normalizer-substrate.ts
 *
 * In-memory Broccolidb repository storing custom phonetic pronunciation lexicons,
 * normalization transform history, and aggregate telemetry (Phase 115 / ADR-091 / Target #48).
 */

import type {
  SpeechLexiconEntry,
  SpeechWorkspaceSnapshot,
} from "../../../core/contracts/speech-normalizer.contracts.js";

export class BroccoliSpeechNormalizerSubstrate {
  private readonly lexicon = new Map<string, SpeechLexiconEntry>();
  private totalNormalizations = 0;
  private totalCharsProcessed = 0;
  private totalBlocksStripped = 0;

  // Lexicon Management
  public registerLexiconEntry(entry: SpeechLexiconEntry): void {
    this.lexicon.set(entry.term.toLowerCase(), entry);
  }

  public getLexiconEntry(term: string): SpeechLexiconEntry | undefined {
    return this.lexicon.get(term.toLowerCase());
  }

  public hasLexiconEntry(term: string): boolean {
    return this.lexicon.has(term.toLowerCase());
  }

  public listLexiconEntries(): readonly SpeechLexiconEntry[] {
    return Array.from(this.lexicon.values());
  }

  public removeLexiconEntry(term: string): boolean {
    return this.lexicon.delete(term.toLowerCase());
  }

  // Telemetry & Metrics
  public recordNormalization(charsProcessed: number, blocksStripped: number): void {
    this.totalNormalizations++;
    this.totalCharsProcessed += charsProcessed;
    this.totalBlocksStripped += blocksStripped;
  }

  public getMetrics() {
    return {
      totalNormalizations: this.totalNormalizations,
      totalCharsProcessed: this.totalCharsProcessed,
      totalBlocksStripped: this.totalBlocksStripped,
      lexiconRuleCount: this.lexicon.size,
    };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): SpeechWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      lexicon: Array.from(this.lexicon.values()),
      metrics: {
        totalNormalizations: this.totalNormalizations,
        totalCharsProcessed: this.totalCharsProcessed,
        totalBlocksStripped: this.totalBlocksStripped,
      },
    };
  }

  public restoreSnapshot(snapshot: SpeechWorkspaceSnapshot): void {
    this.lexicon.clear();
    for (const entry of snapshot.lexicon) {
      this.lexicon.set(entry.term.toLowerCase(), entry);
    }
    this.totalNormalizations = snapshot.metrics.totalNormalizations;
    this.totalCharsProcessed = snapshot.metrics.totalCharsProcessed;
    this.totalBlocksStripped = snapshot.metrics.totalBlocksStripped;
  }

  public clear(): void {
    this.lexicon.clear();
    this.totalNormalizations = 0;
    this.totalCharsProcessed = 0;
    this.totalBlocksStripped = 0;
  }
}
