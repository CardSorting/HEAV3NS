/**
 * fuzzy-matcher-tool-suite.ts
 *
 * Model tool suite exposing 9-strategy fuzzy search & replace, dry-run diff preview,
 * edit idempotency verification, and strategy configuration (Phase 103 / ADR-057).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { FuzzyStrategyName } from "../../../core/contracts/fuzzy-matcher.contracts.js";
import { FuzzyMatcherSupervisor } from "../../../agents/extensions/fuzzy/fuzzy-matcher-supervisor.js";

export class FuzzyMatcherToolSuite {
  private supervisor: FuzzyMatcherSupervisor;

  constructor(supervisor: FuzzyMatcherSupervisor) {
    this.supervisor = supervisor;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "fuzzy_find_and_replace",
        description: "Robustly finds and replaces text across an increasingly fuzzy 9-strategy cascade (exact, line-trimmed, whitespace, indentation, escapes, boundaries, Unicode, block anchors, context similarity) with optional indentation adaptation.",
        parameters: {
          content: {
            type: "string",
            description: "The full file content to search and replace within",
            required: true,
          },
          oldString: {
            type: "string",
            description: "The existing string to find and replace",
            required: true,
          },
          newString: {
            type: "string",
            description: "The replacement string",
            required: true,
          },
          replaceAll: {
            type: "boolean",
            description: "If true, replace all exact/structural occurrences; if false, require uniqueness",
            required: false,
          },
          dryRun: {
            type: "boolean",
            description: "If true, compute the replacement diff and similarity without applying changes to content",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.content !== "string") {
            return { success: false, error: "Missing required parameter 'content' (string)." };
          }
          if (typeof args.oldString !== "string") {
            return { success: false, error: "Missing required parameter 'oldString' (string)." };
          }
          if (typeof args.newString !== "string") {
            return { success: false, error: "Missing required parameter 'newString' (string)." };
          }

          const replaceAll = Boolean(args.replaceAll);
          const dryRun = Boolean(args.dryRun);

          const result = this.supervisor.findAndReplace(
            args.content,
            args.oldString,
            args.newString,
            replaceAll,
            { dryRun }
          );

          if (!result.success) {
            return {
              success: false,
              error: result.error,
              matchCount: result.matchCount,
              strategyAttempted: result.strategyUsed,
              ambiguityLocations: result.ambiguityLocations,
              contextWindows: result.contextWindows,
            };
          }

          return {
            success: true,
            modifiedContent: result.modifiedContent,
            matchCount: result.matchCount,
            strategyUsed: result.strategyUsed,
            isIdempotent: result.isIdempotent,
            similarityScore: result.similarityScore,
            diffPreview: result.diffPreview,
            linesAffected: result.linesAffected,
            message: result.isIdempotent
              ? "Edit was already applied (idempotent no-op)."
              : dryRun
                ? `[DRY-RUN] Matched ${result.matchCount} occurrence(s) using '${result.strategyUsed}' strategy (similarity: ${result.similarityScore?.toFixed(2)}).`
                : `Successfully replaced ${result.matchCount} occurrence(s) using '${result.strategyUsed}' strategy.`,
          };
        },
      },
      {
        name: "fuzzy_dry_run_replace",
        description: "Simulates a search-and-replace edit, returning the unified diff preview, match count, strategy used, and surrounding context without mutating content.",
        parameters: {
          content: {
            type: "string",
            description: "The file content to test",
            required: true,
          },
          oldString: {
            type: "string",
            description: "The string to match",
            required: true,
          },
          newString: {
            type: "string",
            description: "The proposed replacement string",
            required: true,
          },
          replaceAll: {
            type: "boolean",
            description: "If true, test multiple replacements; if false, require uniqueness",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.content !== "string" || typeof args.oldString !== "string" || typeof args.newString !== "string") {
            return { success: false, error: "Missing required string parameters ('content', 'oldString', 'newString')." };
          }

          const replaceAll = Boolean(args.replaceAll);
          const result = this.supervisor.dryRun(args.content, args.oldString, args.newString, replaceAll);

          return {
            success: result.success,
            matchCount: result.matchCount,
            strategyUsed: result.strategyUsed,
            isIdempotent: result.isIdempotent,
            similarityScore: result.similarityScore,
            diffPreview: result.diffPreview,
            contextWindows: result.contextWindows,
            error: result.error,
          };
        },
      },
      {
        name: "fuzzy_check_idempotency",
        description: "Checks if a proposed code edit is already present in the content, avoiding redundant edit attempts.",
        parameters: {
          content: {
            type: "string",
            description: "The file content to inspect",
            required: true,
          },
          oldString: {
            type: "string",
            description: "The text intended to be replaced",
            required: true,
          },
          newString: {
            type: "string",
            description: "The intended replacement text",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.content !== "string" || typeof args.oldString !== "string" || typeof args.newString !== "string") {
            return { success: false, error: "Missing required string parameters ('content', 'oldString', 'newString')." };
          }

          const isApplied = this.supervisor.checkIdempotency(args.content, args.oldString, args.newString);
          return {
            success: true,
            isAlreadyApplied: isApplied,
            message: isApplied
              ? "The requested edit is already present in the content."
              : "The requested edit is not yet applied.",
          };
        },
      },
      {
        name: "fuzzy_configure_strategies",
        description: "Dynamically configures active fuzzy matching strategies, similarity thresholds, and indentation preservation settings.",
        parameters: {
          action: {
            type: "string",
            description: "Action to perform: 'enable', 'disable', 'set_threshold', 'set_indentation', 'list'",
            required: true,
          },
          strategy: {
            type: "string",
            description: "Strategy name (e.g. 'block_anchor', 'context_aware', 'unicode_normalized')",
            required: false,
          },
          similarityThreshold: {
            type: "number",
            description: "Similarity threshold (0.1 to 1.0) when action is 'set_threshold'",
            required: false,
          },
          preserveIndentation: {
            type: "boolean",
            description: "Enable or disable automatic indentation preservation when action is 'set_indentation'",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const action = (args.action as string || "").toLowerCase();

          switch (action) {
            case "enable": {
              if (typeof args.strategy === "string") {
                this.supervisor.enableStrategy(args.strategy as FuzzyStrategyName);
                return {
                  success: true,
                  message: `Enabled strategy '${args.strategy}'.`,
                  activeStrategies: this.supervisor.getEnabledStrategies(),
                };
              }
              return { success: false, error: "Missing 'strategy' name to enable." };
            }
            case "disable": {
              if (typeof args.strategy === "string") {
                this.supervisor.disableStrategy(args.strategy as FuzzyStrategyName);
                return {
                  success: true,
                  message: `Disabled strategy '${args.strategy}'.`,
                  activeStrategies: this.supervisor.getEnabledStrategies(),
                };
              }
              return { success: false, error: "Missing 'strategy' name to disable." };
            }
            case "set_threshold": {
              if (typeof args.similarityThreshold === "number") {
                this.supervisor.setSimilarityThreshold(args.similarityThreshold);
                return {
                  success: true,
                  similarityThreshold: this.supervisor.getSimilarityThreshold(),
                  message: `Updated similarity threshold to ${args.similarityThreshold}.`,
                };
              }
              return { success: false, error: "Missing or invalid 'similarityThreshold' number." };
            }
            case "set_indentation": {
              if (typeof args.preserveIndentation === "boolean") {
                this.supervisor.setPreserveIndentation(args.preserveIndentation);
                return {
                  success: true,
                  preserveIndentation: this.supervisor.getPreserveIndentation(),
                  message: `Indentation preservation set to ${args.preserveIndentation}.`,
                };
              }
              return { success: false, error: "Missing boolean 'preserveIndentation'." };
            }
            case "list":
            default: {
              return {
                success: true,
                activeStrategies: this.supervisor.getEnabledStrategies(),
                similarityThreshold: this.supervisor.getSimilarityThreshold(),
                preserveIndentation: this.supervisor.getPreserveIndentation(),
                normalizeLineEndings: this.supervisor.getNormalizeLineEndings(),
              };
            }
          }
        },
      },
      {
        name: "fuzzy_diagnose_mismatch",
        description: "Diagnoses why a search string failed to match within file content, returning closest candidate line snippets and visible whitespace differences (→ = tab, · = space).",
        parameters: {
          content: {
            type: "string",
            description: "The file content that failed to match",
            required: true,
          },
          oldString: {
            type: "string",
            description: "The search string that failed to match",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.content !== "string" || typeof args.oldString !== "string") {
            return { success: false, error: "Missing required string parameters ('content', 'oldString')." };
          }

          const diagnosis = this.supervisor.diagnoseMismatch(args.oldString, args.content);
          return {
            success: true,
            hasCandidate: diagnosis.hasCandidate,
            whitespaceIssueDetected: diagnosis.whitespaceIssueDetected,
            formattedHint: diagnosis.formattedHint,
            candidatesCount: diagnosis.candidates.length,
            candidates: diagnosis.candidates,
          };
        },
      },
      {
        name: "fuzzy_inspect_strategies",
        description: "Inspects fuzzy matching execution metrics, strategy usage analytics, and active Unicode normalization maps.",
        parameters: {},
        execute: async () => {
          const analytics = this.supervisor.getStrategyAnalytics();
          const history = this.supervisor.getExecutionHistory();
          const unicodeMap = this.supervisor.getUnicodeMap();
          const threshold = this.supervisor.getSimilarityThreshold();

          return {
            success: true,
            totalReplacements: analytics.totalReplacements,
            strategyUsageCounts: analytics.strategyUsageCounts,
            recentExecutionsCount: history.length,
            similarityThreshold: threshold,
            activeUnicodeMappingsCount: Object.keys(unicodeMap).length,
            preserveIndentation: this.supervisor.getPreserveIndentation(),
            preserveUnicodeForUnchanged: this.supervisor.getPreserveUnicodeForUnchanged(),
          };
        },
      },
    ];
  }
}
