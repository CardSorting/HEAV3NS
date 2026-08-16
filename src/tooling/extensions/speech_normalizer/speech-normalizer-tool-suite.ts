/**
 * speech-normalizer-tool-suite.ts
 *
 * Model tool definitions exposing Speech Text Normalizer, Non-Spoken Block Stripper,
 * and Phonetic Lexicon Subsystem to agents and CLI (Phase 115 / ADR-091 / Target #48).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { SpeechNormalizerSupervisor } from "../../../agents/extensions/speech_normalizer/speech-normalizer-supervisor.js";
import type { LexiconCategory } from "../../../core/contracts/speech-normalizer.contracts.js";

export class SpeechNormalizerToolSuite {
  private readonly supervisor: SpeechNormalizerSupervisor;

  constructor(supervisor: SpeechNormalizerSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "speech_normalize_text",
        description:
          "Prepares assistant text or Markdown into a clean spoken script for TTS speech synthesis, stripping code/links/reasoning and expanding symbols.",
        parameters: {
          text: {
            type: "string",
            description: "The raw assistant text or Markdown to normalize for speech.",
            required: true,
          },
          max_chars: {
            type: "number",
            description: "Optional maximum character length bound (defaults to 4000).",
            required: false,
          },
          flatten_newlines: {
            type: "boolean",
            description: "Whether to flatten newlines into single-line spoken script (defaults to true).",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const text = typeof args.text === "string" ? args.text : "";
          const maxChars = typeof args.max_chars === "number" ? args.max_chars : undefined;
          const flattenNewlines = typeof args.flatten_newlines === "boolean" ? args.flatten_newlines : undefined;

          const result = this.supervisor.normalizeText(text, {
            maxChars,
            flattenNewlines,
          });

          return {
            success: true,
            spokenScript: result.spokenScript,
            charCountBefore: result.charCountBefore,
            charCountAfter: result.charCountAfter,
            strippedBlockCount: result.strippedBlockCount,
            expandedSymbolCount: result.expandedSymbolCount,
          };
        },
      },
      {
        name: "speech_strip_nonspoken_blocks",
        description:
          "Removes <think> reasoning blocks, unclosed streaming reasoning tags, and file-mutation verifier footers from text.",
        parameters: {
          text: {
            type: "string",
            description: "Text containing potential non-spoken blocks.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const text = typeof args.text === "string" ? args.text : "";
          const res = this.supervisor.stripNonspoken(text);
          return {
            success: true,
            cleanedText: res.text,
            strippedCount: res.strippedCount,
          };
        },
      },
      {
        name: "speech_expand_symbols",
        description:
          "Phonetically expands temperatures, currencies, percentages, rates, and unit abbreviations into words.",
        parameters: {
          text: {
            type: "string",
            description: "Text containing symbols and numeric units.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const text = typeof args.text === "string" ? args.text : "";
          const res = this.supervisor.expandSymbols(text);
          return {
            success: true,
            expandedText: res.text,
            expandedCount: res.expandedCount,
          };
        },
      },
      {
        name: "speech_register_lexicon_entry",
        description:
          "Registers a custom phonetic pronunciation rule for domain-specific terminology, acronyms, or symbols.",
        parameters: {
          term: {
            type: "string",
            description: "The term, acronym, or word to match.",
            required: true,
          },
          replacement: {
            type: "string",
            description: "The phonetic spoken replacement.",
            required: true,
          },
          category: {
            type: "string",
            description: "Optional lexicon category ('currency', 'unit', 'symbol', 'temperature', 'custom').",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const term = typeof args.term === "string" ? args.term : "";
          const replacement = typeof args.replacement === "string" ? args.replacement : "";
          const category = (typeof args.category === "string" ? args.category : "custom") as LexiconCategory;

          if (!term || !replacement) {
            return { success: false, error: "term and replacement are required" };
          }

          this.supervisor.registerLexiconEntry({
            term,
            replacement,
            caseSensitive: false,
            category,
          });

          return {
            success: true,
            registeredTerm: term,
            replacement,
            category,
          };
        },
      },
      {
        name: "speech_get_normalizer_metrics",
        description:
          "Retrieves aggregate speech text normalization telemetry, processed character count, and registered lexicon entries.",
        parameters: {},
        execute: async () => {
          const metrics = this.supervisor.getMetrics();
          const lexicon = this.supervisor.listLexiconEntries();
          return {
            success: true,
            metrics,
            lexicon,
          };
        },
      },
    ];
  }
}
