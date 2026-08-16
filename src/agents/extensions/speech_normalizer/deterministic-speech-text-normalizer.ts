/**
 * deterministic-speech-text-normalizer.ts
 *
 * High-speed deterministic text normalization pipeline for Text-to-Speech (TTS) synthesis.
 * Strips reasoning blocks (<think>), file-mutation footers, Markdown syntax, expands symbols/units/currencies,
 * folds headings into spoken lead-ins, and flattens newlines for single-line audio backends
 * (Phase 115 / ADR-091 / Target #48).
 */

import type {
  SpeechNormalizationOptions,
  SpeechNormalizationResult,
} from "../../../core/contracts/speech-normalizer.contracts.js";

export class DeterministicSpeechTextNormalizer {
  private static readonly HEAD_SENTINEL = "\x00";

  private static readonly MD_CODE_BLOCK_RE = /```[\s\S]*?```/g;
  private static readonly MD_LINK_RE = /\[([^\]]+)\]\((?:[^()]|\([^)]*\))*\)/g;
  private static readonly MD_IMAGE_RE = /!\[([^\]]*)\]\((?:[^()]|\([^)]*\))*\)/g;
  private static readonly MD_INLINE_CODE_RE = /`([^`]+)`/g;
  private static readonly MD_BOLD_RE = /\*\*(.+?)\*\*/g;
  private static readonly MD_UNDERSCORE_BOLD_RE = /__(.+?)__/g;
  private static readonly MD_ITALIC_RE = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;
  private static readonly MD_UNDERSCORE_ITALIC_RE = /(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g;
  private static readonly MD_STRIKE_RE = /~~(.+?)~~/g;
  private static readonly MD_HEADING_LINE_RE = /^[ \t]{0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm;
  private static readonly MD_BLOCKQUOTE_RE = /^\s*>\s?/gm;
  private static readonly MD_LIST_ITEM_RE = /^\s*(?:[-*+]|\d+[.)])\s+/gm;
  private static readonly MD_HR_RE = /^\s*[-*_]{3,}\s*$/gm;
  private static readonly MD_TABLE_PIPE_RE = /\s*\|\s*/g;
  private static readonly URL_RE = /https?:\/\/\S+/g;

  private static readonly THINK_BLOCK_RE = /<think[\s>].*?<\/think>/gis;
  private static readonly THINK_BLOCK_OPEN_RE = /<think[\s>].*$/gis;
  private static readonly VERIFIER_FOOTER_RE = /^\s*⚠️?\s*File-mutation verifier:.*(?:\n[ \t]+•.*)*/gm;

  private static readonly EMOJI_RE = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{27BF}]+/gu;
  private static readonly VARIATION_SELECTOR_RE = /[\uFE0E\uFE0F]/g;

  /**
   * Strip non-spoken blocks: <think> reasoning blocks and file-mutation verifier footers.
   */
  public stripNonspokenBlocks(text: string): { text: string; strippedCount: number } {
    if (!text) {
      return { text: "", strippedCount: 0 };
    }

    let count = 0;
    let result = text.replace(DeterministicSpeechTextNormalizer.THINK_BLOCK_RE, () => {
      count++;
      return " ";
    });
    result = result.replace(DeterministicSpeechTextNormalizer.THINK_BLOCK_OPEN_RE, () => {
      count++;
      return " ";
    });
    result = result.replace(DeterministicSpeechTextNormalizer.VERIFIER_FOOTER_RE, () => {
      count++;
      return " ";
    });

    return { text: result, strippedCount: count };
  }

  /**
   * Strip Markdown formatting while preserving speakable words.
   */
  public stripMarkdown(text: string): string {
    if (!text) {
      return "";
    }

    let out = text;
    // Decode basic HTML entities
    out = out
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    out = out.replace(DeterministicSpeechTextNormalizer.MD_CODE_BLOCK_RE, " ");
    out = out.replace(DeterministicSpeechTextNormalizer.MD_IMAGE_RE, (_, alt) => (alt ? ` ${alt} ` : " "));
    out = out.replace(DeterministicSpeechTextNormalizer.MD_LINK_RE, "$1");
    out = out.replace(DeterministicSpeechTextNormalizer.URL_RE, "");
    out = out.replace(DeterministicSpeechTextNormalizer.MD_INLINE_CODE_RE, "$1");
    out = out.replace(DeterministicSpeechTextNormalizer.MD_BOLD_RE, "$1");
    out = out.replace(DeterministicSpeechTextNormalizer.MD_UNDERSCORE_BOLD_RE, "$1");
    out = out.replace(DeterministicSpeechTextNormalizer.MD_ITALIC_RE, "$1");
    out = out.replace(DeterministicSpeechTextNormalizer.MD_UNDERSCORE_ITALIC_RE, "$1");
    out = out.replace(DeterministicSpeechTextNormalizer.MD_STRIKE_RE, "$1");

    // Headings: attach sentinel \x00 so whitespace smoother can fold them into subsequent sentences
    out = out.replace(
      DeterministicSpeechTextNormalizer.MD_HEADING_LINE_RE,
      (_, title) => title.trimEnd() + DeterministicSpeechTextNormalizer.HEAD_SENTINEL
    );

    out = out.replace(DeterministicSpeechTextNormalizer.MD_BLOCKQUOTE_RE, "");
    out = out.replace(DeterministicSpeechTextNormalizer.MD_LIST_ITEM_RE, "");
    out = out.replace(DeterministicSpeechTextNormalizer.MD_HR_RE, "");
    out = out.replace(DeterministicSpeechTextNormalizer.MD_TABLE_PIPE_RE, "; ");

    return out;
  }

  /**
   * Expand symbols, temperatures, currencies, units, and rates into phonetic words.
   */
  public normalizeSymbols(
    text: string,
    customLexicon?: Readonly<Record<string, string>>
  ): { text: string; expandedCount: number } {
    if (!text) {
      return { text: "", expandedCount: 0 };
    }

    let count = 0;
    let out = text;

    // Non-breaking & thin spaces
    out = out.replace(/[\u00A0\u2007\u202F]/g, " ");
    out = out.replace(/\u2212/g, "-");
    out = out.replace(/…/g, "...");

    // 1. Custom Lexicon (if provided)
    if (customLexicon) {
      for (const [k, v] of Object.entries(customLexicon)) {
        const regex = new RegExp(`\\b${k}\\b`, "gi");
        out = out.replace(regex, () => {
          count++;
          return v;
        });
      }
    }

    // 2. Temperature Ranges: 11-17 °C -> "11 to 17 degrees Celsius"
    out = out.replace(
      /(?<!\w)([-+]?\d+(?:\.\d+)?)\s*[\u2013\u2014-]\s*([-+]?\d+(?:\.\d+)?)\s*°\s*C\b/gi,
      (_, t1, t2) => {
        count++;
        return `${t1} to ${t2} degrees Celsius`;
      }
    );
    out = out.replace(
      /(?<!\w)([-+]?\d+(?:\.\d+)?)\s*[\u2013\u2014-]\s*([-+]?\d+(?:\.\d+)?)\s*°\s*F\b/gi,
      (_, t1, t2) => {
        count++;
        return `${t1} to ${t2} degrees Fahrenheit`;
      }
    );

    // 3. Single Temperatures
    out = out.replace(/(?<!\w)([-+]?\d+(?:\.\d+)?)\s*°\s*C\b/gi, (_, val) => {
      count++;
      return `${val} degrees Celsius`;
    });
    out = out.replace(/(?<!\w)([-+]?\d+(?:\.\d+)?)\s*°\s*F\b/gi, (_, val) => {
      count++;
      return `${val} degrees Fahrenheit`;
    });
    out = out.replace(/°\s*C\b/gi, () => {
      count++;
      return "degrees Celsius";
    });
    out = out.replace(/°\s*F\b/gi, () => {
      count++;
      return "degrees Fahrenheit";
    });
    out = out.replace(/(?<!\w)([-+]?\d+(?:\.\d+)?)\s*°/g, (_, val) => {
      count++;
      return `${val} degrees`;
    });
    out = out.replace(/°/g, () => {
      count++;
      return " degrees";
    });

    // 4. Units of Measurement
    out = out.replace(/(?<=\d)\s*km\s*\/\s*h\b/gi, () => {
      count++;
      return " kilometres per hour";
    });
    out = out.replace(/(?<=\d)\s*mm\b/gi, () => {
      count++;
      return " millimetres";
    });
    out = out.replace(/(?<=\d)\s*cm\b/gi, () => {
      count++;
      return " centimetres";
    });
    out = out.replace(/(?<=\d)\s*m\b/gi, () => {
      count++;
      return " metres";
    });

    // 5. Numeric Rates: 5/month -> "5 per month"
    out = out.replace(/(?<=\d)\s*\/\s*(?=[A-Za-z])/g, () => {
      count++;
      return " per ";
    });

    // 6. Currencies & Percentages
    out = out.replace(/NZ\$\s*([\d,]*\d(?:\.\d+)?)/gi, (_, amt) => {
      count++;
      return `${amt} New Zealand dollars`;
    });
    out = out.replace(/A\$\s*([\d,]*\d(?:\.\d+)?)/gi, (_, amt) => {
      count++;
      return `${amt} Australian dollars`;
    });
    out = out.replace(/US\$\s*([\d,]*\d(?:\.\d+)?)/gi, (_, amt) => {
      count++;
      return `${amt} US dollars`;
    });
    out = out.replace(/€\s*([\d,]*\d(?:\.\d+)?)/g, (_, amt) => {
      count++;
      return `${amt} euros`;
    });
    out = out.replace(/£\s*([\d,]*\d(?:\.\d+)?)/g, (_, amt) => {
      count++;
      return `${amt} pounds`;
    });
    out = out.replace(/\$\s*([\d,]*\d(?:\.\d+)?)/g, (_, amt) => {
      count++;
      return `${amt} dollars`;
    });
    out = out.replace(/(?<=\d)\s*%/g, () => {
      count++;
      return " percent";
    });

    // 7. Math & Common Glyphs
    out = out.replace(/&/g, () => {
      count++;
      return " and ";
    });
    out = out.replace(/[•◦▪▫]/g, " ");
    out = out.replace(/→|⇒/g, () => {
      count++;
      return " to ";
    });
    out = out.replace(/≈|~/g, () => {
      count++;
      return " about ";
    });

    // 8. Emojis and Variation Selectors
    out = out.replace(DeterministicSpeechTextNormalizer.VARIATION_SELECTOR_RE, "");
    out = out.replace(DeterministicSpeechTextNormalizer.EMOJI_RE, "");

    return { text: out, expandedCount: count };
  }

  /**
   * Smooth whitespace and fold former headings into spoken lead-ins.
   */
  public smoothWhitespace(text: string): string {
    if (!text) {
      return "";
    }

    const rawLines = text.split("\n");
    const addSentencePauses =
      rawLines.filter((l) => l.replace(DeterministicSpeechTextNormalizer.HEAD_SENTINEL, "").trim().length > 0)
        .length > 1;

    const lines: string[] = [];
    let pendingHeading: string | null = null;

    const flushPending = () => {
      if (pendingHeading !== null) {
        lines.push(pendingHeading.replace(/[.:;,]+$/, "") + ".");
        pendingHeading = null;
      }
    };

    for (const rawLine of rawLines) {
      const isHeading = rawLine.trimEnd().endsWith(DeterministicSpeechTextNormalizer.HEAD_SENTINEL);
      let line = rawLine.replace(DeterministicSpeechTextNormalizer.HEAD_SENTINEL, "").trim();

      if (!line) {
        if (pendingHeading === null && lines.length > 0 && lines[lines.length - 1] !== "") {
          lines.push("");
        }
        continue;
      }

      if (isHeading) {
        if (pendingHeading !== null) {
          lines.push(pendingHeading.replace(/[.:;,]+$/, "") + ".");
        }
        pendingHeading = line.replace(/[.:;,]+$/, "");
        continue;
      }

      if (pendingHeading !== null) {
        line = `${pendingHeading.replace(/[.:;,]+$/, "")}, ${line}`;
        pendingHeading = null;
      }

      if (addSentencePauses && !/[.!?;:]$/.test(line)) {
        line += ".";
      }
      lines.push(line);
    }

    if (pendingHeading !== null) {
      lines.push(pendingHeading.replace(/[.:;,]+$/, "") + ".");
      pendingHeading = null;
    }

    let result = lines.join("\n");
    result = result.replace(/\n{3,}/g, "\n\n");
    result = result.replace(/[ \t]{2,}/g, " ");
    result = result.replace(/\s+([,.;:!?])/g, "$1");
    result = result.replace(/([,.;:!?])([A-Za-z])/g, "$1 $2");
    result = result.replace(/\.{4,}/g, "...");

    return result.trim();
  }

  /**
   * Collapse newlines into single-line payload for newline-sensitive backends.
   */
  public flattenNewlines(text: string): string {
    if (!text) {
      return "";
    }

    let out = text.replace(/\n{2,}/g, ". ");
    out = out.replace(/(?<=[.!?;:,])\n/g, " ");
    out = out.replace(/\n/g, ". ");
    out = out.replace(/\.\s*\./g, ".");
    out = out.replace(/[ \t]{2,}/g, " ");
    return out.trim();
  }

  /**
   * Complete deterministic speech normalization pipeline.
   */
  public prepareSpokenText(
    text: string,
    options: SpeechNormalizationOptions = {}
  ): SpeechNormalizationResult {
    const original = text ?? "";
    const charCountBefore = original.length;

    let processed = original;
    let strippedBlockCount = 0;
    let expandedSymbolCount = 0;

    // 1. Strip Non-spoken Blocks (<think> and mutation footers)
    if (options.stripReasoning !== false) {
      const stripped = this.stripNonspokenBlocks(processed);
      processed = stripped.text;
      strippedBlockCount = stripped.strippedCount;
    }

    // 2. Strip Markdown Syntax
    if (options.stripMarkdown !== false) {
      processed = this.stripMarkdown(processed);
    }

    // 3. Expand Symbols & Units
    if (options.expandSymbols !== false) {
      const expanded = this.normalizeSymbols(processed, options.customLexicon);
      processed = expanded.text;
      expandedSymbolCount = expanded.expandedCount;
    }

    // 4. Smooth Whitespace & Fold Headings
    processed = this.smoothWhitespace(processed);

    // 5. Flatten Newlines (Single-line Payload)
    if (options.flattenNewlines !== false) {
      processed = this.flattenNewlines(processed);
    }

    // 6. Max Characters Bounding
    const maxChars = options.maxChars ?? 4000;
    if (maxChars > 0 && processed.length > maxChars) {
      processed = processed.slice(0, maxChars).trimEnd();
    }

    return {
      originalText: original,
      spokenScript: processed,
      charCountBefore,
      charCountAfter: processed.length,
      strippedBlockCount,
      expandedSymbolCount,
    };
  }
}
