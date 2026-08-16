/**
 * speech-normalizer-supervisor.ts
 *
 * Master supervisor coordinating text normalization, non-spoken stripping, custom phonetic
 * lexicons, and aggregate speech metrics (Phase 115 / ADR-091 / Target #48).
 */

import type { BroccoliSpeechNormalizerSubstrate } from "../../../sessions/extensions/speech_normalizer/broccoli-speech-normalizer-substrate.js";
import type { DeterministicSpeechTextNormalizer } from "./deterministic-speech-text-normalizer.js";
import type {
  SpeechNormalizationOptions,
  SpeechNormalizationResult,
  SpeechLexiconEntry,
} from "../../../core/contracts/speech-normalizer.contracts.js";

export class SpeechNormalizerSupervisor {
  private readonly substrate: BroccoliSpeechNormalizerSubstrate;
  private readonly normalizer: DeterministicSpeechTextNormalizer;

  constructor(
    substrate: BroccoliSpeechNormalizerSubstrate,
    normalizer: DeterministicSpeechTextNormalizer
  ) {
    this.substrate = substrate;
    this.normalizer = normalizer;
  }

  /**
   * Normalize input text into a spoken script for TTS synthesis.
   */
  public normalizeText(
    text: string,
    options: SpeechNormalizationOptions = {}
  ): SpeechNormalizationResult {
    // Merge substrate lexicon if customLexicon not explicitly passed
    let mergedLexicon = options.customLexicon;
    const substrateEntries = this.substrate.listLexiconEntries();
    if (substrateEntries.length > 0) {
      const dict: Record<string, string> = { ...(options.customLexicon ?? {}) };
      for (const entry of substrateEntries) {
        if (!dict[entry.term]) {
          dict[entry.term] = entry.replacement;
        }
      }
      mergedLexicon = dict;
    }

    const result = this.normalizer.prepareSpokenText(text, {
      ...options,
      customLexicon: mergedLexicon,
    });

    this.substrate.recordNormalization(
      result.charCountBefore,
      result.strippedBlockCount
    );

    return result;
  }

  /**
   * Strip non-spoken blocks (<think> and file-mutation verifiers).
   */
  public stripNonspoken(text: string) {
    return this.normalizer.stripNonspokenBlocks(text);
  }

  /**
   * Expand symbols and units into phonetic text.
   */
  public expandSymbols(text: string) {
    const dict: Record<string, string> = {};
    for (const entry of this.substrate.listLexiconEntries()) {
      dict[entry.term] = entry.replacement;
    }
    return this.normalizer.normalizeSymbols(text, dict);
  }

  /**
   * Register a custom phonetic lexicon entry.
   */
  public registerLexiconEntry(entry: SpeechLexiconEntry): void {
    this.substrate.registerLexiconEntry(entry);
  }

  public listLexiconEntries(): readonly SpeechLexiconEntry[] {
    return this.substrate.listLexiconEntries();
  }

  public removeLexiconEntry(term: string): boolean {
    return this.substrate.removeLexiconEntry(term);
  }

  public getMetrics() {
    return this.substrate.getMetrics();
  }

  public clear(): void {
    this.substrate.clear();
  }
}
