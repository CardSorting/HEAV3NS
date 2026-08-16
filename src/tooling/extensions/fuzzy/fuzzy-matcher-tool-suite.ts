/**
 * fuzzy-matcher-tool-suite.ts
 *
 * Model tool suite exposing 9-strategy fuzzy search & replace, dry-run diff preview,
 * edit idempotency verification, and strategy configuration (Phase 103 / ADR-057).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  ConflictResolutionStrategy,
  FuzzyStrategyName,
  MultiFileTransactionHunk,
} from "../../../core/contracts/fuzzy-matcher.contracts.js";
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
        name: "fuzzy_multi_replace",
        description: "Atomically applies multiple non-contiguous search-and-replace hunks across a file with pre-flight overlap collision detection and offset-stable rollback.",
        parameters: {
          content: {
            type: "string",
            description: "The full file content to patch",
            required: true,
          },
          hunks: {
            type: "string",
            description: "JSON-encoded array of hunks or hunk list: [{ oldString: string, newString: string, replaceAll?: boolean }]",
            required: true,
          },
          dryRun: {
            type: "boolean",
            description: "If true, simulate the multi-hunk patch and return diff without modifying content",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.content !== "string") {
            return { success: false, error: "Missing required parameter 'content' (string)." };
          }

          let hunksArray: Array<{ oldString: string; newString: string; replaceAll?: boolean }>;
          if (typeof args.hunks === "string") {
            try {
              hunksArray = JSON.parse(args.hunks);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              return { success: false, error: `Invalid JSON for hunks parameter: ${msg}` };
            }
          } else if (Array.isArray(args.hunks)) {
            hunksArray = args.hunks as Array<{ oldString: string; newString: string; replaceAll?: boolean }>;
          } else {
            return { success: false, error: "Missing required parameter 'hunks' (JSON string or array)." };
          }

          const dryRun = Boolean(args.dryRun);
          const result = this.supervisor.findAndReplaceMulti(args.content, hunksArray, { dryRun });

          if (!result.success) {
            return {
              success: false,
              error: result.error,
              failedHunkIndex: result.failedHunkIndex,
              failedHunkError: result.failedHunkError,
              totalHunks: result.totalHunks,
              appliedHunks: 0,
            };
          }

          return {
            success: true,
            modifiedContent: result.modifiedContent,
            totalHunks: result.totalHunks,
            appliedHunks: result.appliedHunks,
            isFullyIdempotent: result.isFullyIdempotent,
            strategiesUsed: result.strategiesUsed,
            diffPreview: result.diffPreview,
            message: result.isFullyIdempotent
              ? "All hunks were already applied (idempotent no-op)."
              : dryRun
                ? `[DRY-RUN] Verified ${result.appliedHunks}/${result.totalHunks} hunk(s) across strategies: ${result.strategiesUsed.join(", ")}.`
                : `Successfully applied ${result.appliedHunks}/${result.totalHunks} hunk(s) atomically.`,
          };
        },
      },
      {
        name: "fuzzy_generate_patch",
        description: "Generates a standard unified diff patch (with @@ hunk headers) between two text strings.",
        parameters: {
          originalContent: {
            type: "string",
            description: "The original file content",
            required: true,
          },
          newContent: {
            type: "string",
            description: "The modified file content",
            required: true,
          },
          filename: {
            type: "string",
            description: "Optional filename for patch headers (default: 'file')",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.originalContent !== "string" || typeof args.newContent !== "string") {
            return { success: false, error: "Missing required string parameters ('originalContent', 'newContent')." };
          }

          const filename = typeof args.filename === "string" ? args.filename : "file";
          const patch = this.supervisor.generateUnifiedDiff(args.originalContent, args.newContent, filename);

          return {
            success: true,
            patch,
            linesTotal: patch.split("\n").length,
          };
        },
      },
      {
        name: "fuzzy_apply_patch",
        description: "Applies a standard unified diff patch (containing @@ -start,count +start,count @@ headers) directly to file content.",
        parameters: {
          content: {
            type: "string",
            description: "The original file content to be patched",
            required: true,
          },
          patch: {
            type: "string",
            description: "The unified diff patch string to apply",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.content !== "string" || typeof args.patch !== "string") {
            return { success: false, error: "Missing required string parameters ('content', 'patch')." };
          }

          const result = this.supervisor.applyUnifiedPatch(args.content, args.patch);
          if (!result.success) {
            return {
              success: false,
              error: result.error,
              hunksParsed: result.hunksParsed,
              hunksApplied: result.hunksApplied,
            };
          }

          return {
            success: true,
            modifiedContent: result.modifiedContent,
            hunksParsed: result.hunksParsed,
            hunksApplied: result.hunksApplied,
            diffPreview: result.diffPreview,
            message: `Successfully applied ${result.hunksApplied}/${result.hunksParsed} unified diff hunk(s).`,
          };
        },
      },
      {
        name: "fuzzy_apply_search_replace_blocks",
        description: "Parses and applies standard <<<<<<< SEARCH ... ======= ... >>>>>>> REPLACE blocks directly to file content with atomic multi-hunk validation.",
        parameters: {
          content: {
            type: "string",
            description: "The file content to be modified",
            required: true,
          },
          blockText: {
            type: "string",
            description: "The SEARCH/REPLACE block text string",
            required: true,
          },
          dryRun: {
            type: "boolean",
            description: "If true, simulates without committing modifications",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.content !== "string" || typeof args.blockText !== "string") {
            return { success: false, error: "Missing required string parameters ('content', 'blockText')." };
          }

          const dryRun = args.dryRun === true;
          const result = this.supervisor.applySearchReplaceBlocks(args.content, args.blockText, { dryRun });

          return {
            success: result.success,
            modifiedContent: result.modifiedContent,
            totalHunks: result.totalHunks,
            appliedHunks: result.appliedHunks,
            isFullyIdempotent: result.isFullyIdempotent,
            strategiesUsed: result.strategiesUsed,
            diffPreview: result.diffPreview,
            error: result.error,
          };
        },
      },
      {
        name: "fuzzy_find_and_replace_at_line",
        description: "Finds and replaces code centered near an expected line number hint (lineHint ± lineTolerance) to disambiguate identical lines across large files.",
        parameters: {
          content: {
            type: "string",
            description: "The file content to search",
            required: true,
          },
          oldString: {
            type: "string",
            description: "The string to match",
            required: true,
          },
          newString: {
            type: "string",
            description: "The replacement string",
            required: true,
          },
          lineHint: {
            type: "number",
            description: "Expected line number (1-indexed) where edit occurs",
            required: true,
          },
          lineTolerance: {
            type: "number",
            description: "Search radius in lines around lineHint (default: 15)",
            required: false,
          },
          dryRun: {
            type: "boolean",
            description: "If true, simulates without committing modifications",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.content !== "string" || typeof args.oldString !== "string" || typeof args.newString !== "string" || typeof args.lineHint !== "number") {
            return { success: false, error: "Missing required parameters ('content', 'oldString', 'newString', 'lineHint')." };
          }

          const lineTolerance = typeof args.lineTolerance === "number" ? args.lineTolerance : 15;
          const dryRun = args.dryRun === true;

          const result = this.supervisor.findAndReplaceAtLine(args.content, args.oldString, args.newString, args.lineHint, lineTolerance, { dryRun });

          return {
            success: result.success,
            modifiedContent: result.modifiedContent,
            matchCount: result.matchCount,
            strategyUsed: result.strategyUsed,
            isIdempotent: result.isIdempotent,
            similarityScore: result.similarityScore,
            diffPreview: result.diffPreview,
            error: result.error,
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
        name: "fuzzy_resolve_conflict_markers",
        description: "Parses and deterministically resolves git merge conflict markers (<<<<<<< ... ======= ... >>>>>>>) within content.",
        parameters: {
          content: {
            type: "string",
            description: "The file content containing git conflict markers",
            required: true,
          },
          strategy: {
            type: "string",
            description: "Resolution strategy: 'take_ours' (default), 'take_theirs', 'take_both_ours_first', or 'take_both_theirs_first'",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.content !== "string") {
            return { success: false, error: "Missing required parameter 'content' (string)." };
          }
          const strategy = (typeof args.strategy === "string" ? args.strategy : "take_ours") as ConflictResolutionStrategy;
          const result = this.supervisor.resolveConflictMarkers(args.content, strategy);
          return {
            success: result.success,
            modifiedContent: result.modifiedContent,
            conflictsFound: result.conflictsFound,
            conflictsResolved: result.conflictsResolved,
            chunks: result.chunks,
            error: result.error,
          };
        },
      },
      {
        name: "fuzzy_harmonize_indentation",
        description: "Detects the prevailing indentation style of a target file and proportionally harmonizes a replacement snippet to match.",
        parameters: {
          targetContent: {
            type: "string",
            description: "The destination file content establishing the reference indentation style",
            required: true,
          },
          snippet: {
            type: "string",
            description: "The code snippet whose indentation should be adapted to the target file style",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.targetContent !== "string" || typeof args.snippet !== "string") {
            return { success: false, error: "Missing required string parameters ('targetContent', 'snippet')." };
          }
          const result = this.supervisor.harmonizeIndentation(args.targetContent, args.snippet);
          return {
            success: true,
            originalSnippet: result.originalSnippet,
            harmonizedSnippet: result.harmonizedSnippet,
            detectedStyle: result.detectedStyle,
            linesAdjusted: result.linesAdjusted,
          };
        },
      },
      {
        name: "fuzzy_apply_multi_file_transaction",
        description: "Executes an all-or-nothing multi-file transaction across memory file maps with complete rollback if any file edit fails.",
        parameters: {
          fileContents: {
            type: "string",
            description: "JSON-encoded object or map of filePath -> fileContent for all participating files",
            required: true,
          },
          transactions: {
            type: "string",
            description: "JSON-encoded array or list of MultiFileTransactionHunk specifications per file",
            required: true,
          },
          dryRun: {
            type: "boolean",
            description: "If true, validate and stage without mutating permanent files",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          let fileContentsMap: Record<string, string>;
          if (typeof args.fileContents === "string") {
            try {
              fileContentsMap = JSON.parse(args.fileContents);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              return { success: false, error: `Invalid JSON for fileContents parameter: ${msg}` };
            }
          } else if (typeof args.fileContents === "object" && args.fileContents !== null) {
            fileContentsMap = args.fileContents as Record<string, string>;
          } else {
            return { success: false, error: "Missing required parameter 'fileContents' (string or object)." };
          }

          let txList: MultiFileTransactionHunk[];
          if (typeof args.transactions === "string") {
            try {
              txList = JSON.parse(args.transactions);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              return { success: false, error: `Invalid JSON for transactions parameter: ${msg}` };
            }
          } else if (Array.isArray(args.transactions)) {
            txList = args.transactions as MultiFileTransactionHunk[];
          } else {
            return { success: false, error: "Missing required parameter 'transactions' (string or array)." };
          }

          const dryRun = Boolean(args.dryRun);
          const result = this.supervisor.applyMultiFileTransaction(
            fileContentsMap,
            txList,
            { dryRun }
          );
          return {
            success: result.success,
            committedFiles: result.committedFiles,
            totalFilesTargeted: result.totalFilesTargeted,
            totalFilesModified: result.totalFilesModified,
            rollbackTriggered: result.rollbackTriggered,
            fileErrors: result.fileErrors,
            error: result.error,
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
