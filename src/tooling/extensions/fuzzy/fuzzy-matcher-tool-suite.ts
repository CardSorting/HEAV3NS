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
  LspTextEdit,
  MultiFileTransactionHunk,
  ThreeWayMergeConflictResolution,
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
        name: "fuzzy_three_way_merge",
        description: "Performs a 3-way merge between baseContent, oursContent, and theirsContent, automatically applying clean non-conflicting hunks and handling conflicts.",
        parameters: {
          baseContent: {
            type: "string",
            description: "The common ancestor base file content",
            required: true,
          },
          oursContent: {
            type: "string",
            description: "The local / current version of the file content",
            required: true,
          },
          theirsContent: {
            type: "string",
            description: "The incoming / edited version of the file content",
            required: true,
          },
          conflictResolution: {
            type: "string",
            description: "Resolution mode: 'markers' (default, emits git conflict markers), 'ours', 'theirs', 'both_ours_first', 'both_theirs_first'",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.baseContent !== "string" || typeof args.oursContent !== "string" || typeof args.theirsContent !== "string") {
            return { success: false, error: "Missing required string parameters ('baseContent', 'oursContent', 'theirsContent')." };
          }
          const resolution = (typeof args.conflictResolution === "string" ? args.conflictResolution : "markers") as ThreeWayMergeConflictResolution;
          const result = this.supervisor.threeWayMerge(args.baseContent, args.oursContent, args.theirsContent, { conflictResolution: resolution });
          return {
            success: result.success,
            mergedContent: result.mergedContent,
            cleanHunksApplied: result.cleanHunksApplied,
            conflictCount: result.conflictCount,
            conflictChunks: result.conflictChunks,
            error: result.error,
          };
        },
      },
      {
        name: "fuzzy_apply_lsp_edits",
        description: "Applies an array of LSP-compliant 0-indexed TextEdit objects ({ range: { start: { line, character }, end: { line, character } }, newText: string }) to content.",
        parameters: {
          content: {
            type: "string",
            description: "The file content to patch",
            required: true,
          },
          edits: {
            type: "string",
            description: "JSON-encoded array or list of LSP TextEdit objects",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.content !== "string") {
            return { success: false, error: "Missing required parameter 'content' (string)." };
          }
          let editList: LspTextEdit[];
          if (typeof args.edits === "string") {
            try {
              editList = JSON.parse(args.edits);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              return { success: false, error: `Invalid JSON for edits parameter: ${msg}` };
            }
          } else if (Array.isArray(args.edits)) {
            editList = args.edits as LspTextEdit[];
          } else {
            return { success: false, error: "Missing required parameter 'edits' (string or array)." };
          }

          const result = this.supervisor.applyLspTextEdits(args.content, editList);
          return {
            success: result.success,
            modifiedContent: result.modifiedContent,
            editsApplied: result.editsApplied,
            error: result.error,
          };
        },
      },
      {
        name: "fuzzy_repair_syntax_block",
        description: "Inspects code snippet syntax for unclosed strings, unbalanced brackets ({}, (), []), and automatically auto-heals them.",
        parameters: {
          codeSnippet: {
            type: "string",
            description: "The code snippet to validate and repair",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.codeSnippet !== "string") {
            return { success: false, error: "Missing required parameter 'codeSnippet' (string)." };
          }
          const result = this.supervisor.validateAndRepairCodeBlock(args.codeSnippet);
          return {
            success: true,
            isValid: result.isValid,
            repairedCode: result.repairedCode,
            issuesFound: result.issuesFound,
            repairsApplied: result.repairsApplied,
          };
        },
      },
      {
        name: "fuzzy_rank_candidate_matches",
        description: "Ranks candidate match windows within content using combined token Jaccard similarity and character Levenshtein distance.",
        parameters: {
          content: {
            type: "string",
            description: "The file content to search within",
            required: true,
          },
          searchSnippet: {
            type: "string",
            description: "The search snippet to rank candidates for",
            required: true,
          },
          limit: {
            type: "number",
            description: "Maximum number of candidate matches to return (default: 5)",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.content !== "string" || typeof args.searchSnippet !== "string") {
            return { success: false, error: "Missing required string parameters ('content', 'searchSnippet')." };
          }
          const limit = typeof args.limit === "number" ? args.limit : 5;
          const result = this.supervisor.rankCandidateMatches(args.content, args.searchSnippet, limit);
          return {
            success: true,
            bestMatch: result.bestMatch,
            candidates: result.candidates,
            totalEvaluated: result.totalEvaluated,
          };
        },
      },
      {
        name: "fuzzy_generate_patience_diff",
        description: "Generates a Patience Diff, aligning unique common lines as semantic anchors to avoid ambiguous closing-brace matching.",
        parameters: {
          oldText: {
            type: "string",
            description: "Original source text",
            required: true,
          },
          newText: {
            type: "string",
            description: "Modified new source text",
            required: true,
          },
          filename: {
            type: "string",
            description: "Filename for diff header (default: 'file')",
            required: false,
          },
          contextLines: {
            type: "number",
            description: "Number of context lines surrounding changes (default: 3)",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.oldText !== "string" || typeof args.newText !== "string") {
            return { success: false, error: "Missing required string parameters ('oldText', 'newText')." };
          }
          const filename = typeof args.filename === "string" ? args.filename : "file";
          const contextLines = typeof args.contextLines === "number" ? args.contextLines : 3;
          const result = this.supervisor.generatePatienceDiff(args.oldText, args.newText, filename, { contextLines });
          return {
            success: true,
            diffText: result.diffText,
            hunks: result.hunks,
            uniqueCommonLinesMatched: result.uniqueCommonLinesMatched,
            totalLinesChanged: result.totalLinesChanged,
            hasChanges: result.hasChanges,
          };
        },
      },
      {
        name: "fuzzy_token_stream_replace",
        description: "Matches and replaces code across lexical token streams, ignoring formatting variations like single vs multi-line destructuring and trailing commas.",
        parameters: {
          content: {
            type: "string",
            description: "Target source code to search and replace within",
            required: true,
          },
          oldSnippet: {
            type: "string",
            description: "Search code snippet (token-stream matched)",
            required: true,
          },
          newSnippet: {
            type: "string",
            description: "Replacement code snippet to insert",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.content !== "string" || typeof args.oldSnippet !== "string" || typeof args.newSnippet !== "string") {
            return { success: false, error: "Missing required string parameters ('content', 'oldSnippet', 'newSnippet')." };
          }
          const result = this.supervisor.findAndReplaceTokenStream(args.content, args.oldSnippet, args.newSnippet);
          return {
            success: result.success,
            modifiedContent: result.modifiedContent,
            matchSpan: result.matchSpan,
            tokensMatched: result.tokensMatched,
            error: result.error,
          };
        },
      },
      {
        name: "fuzzy_explain_merge_conflict",
        description: "Analyzes 3-way merge conflict regions, extracting base ancestor snippets, local changes, remote changes, and proposing confidence-rated auto-resolutions.",
        parameters: {
          baseContent: {
            type: "string",
            description: "Common ancestor / base version content",
            required: true,
          },
          oursContent: {
            type: "string",
            description: "Local / current branch content",
            required: true,
          },
          theirsContent: {
            type: "string",
            description: "Remote / incoming branch content",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.baseContent !== "string" || typeof args.oursContent !== "string" || typeof args.theirsContent !== "string") {
            return { success: false, error: "Missing required string parameters ('baseContent', 'oursContent', 'theirsContent')." };
          }
          const result = this.supervisor.explainMergeConflict(args.baseContent, args.oursContent, args.theirsContent);
          return {
            success: true,
            totalConflicts: result.totalConflicts,
            analyses: result.analyses,
            summary: result.summary,
            autoResolvable: result.autoResolvable,
          };
        },
      },
      {
        name: "fuzzy_generate_inverse_patch",
        description: "Generates a verified reversible inverse diff that cleanly undoes mutations back to original content.",
        parameters: {
          originalContent: {
            type: "string",
            description: "Original pre-mutation content",
            required: true,
          },
          modifiedContent: {
            type: "string",
            description: "Modified post-mutation content to reverse",
            required: true,
          },
          filename: {
            type: "string",
            description: "Filename for diff header (default: 'file')",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.originalContent !== "string" || typeof args.modifiedContent !== "string") {
            return { success: false, error: "Missing required string parameters ('originalContent', 'modifiedContent')." };
          }
          const filename = typeof args.filename === "string" ? args.filename : "file";
          const result = this.supervisor.generateInversePatch(args.originalContent, args.modifiedContent, filename);
          return {
            success: result.success,
            inverseDiff: result.inverseDiff,
            invertedHunks: result.invertedHunks,
            error: result.error,
          };
        },
      },
      {
        name: "fuzzy_find_and_replace_in_scope",
        description: "Restricts fuzzy search and replace strictly to a specified enclosing function, class, interface, or block declaration.",
        parameters: {
          content: {
            type: "string",
            description: "The complete file content",
            required: true,
          },
          oldSnippet: {
            type: "string",
            description: "The target code snippet to replace inside the scope",
            required: true,
          },
          newSnippet: {
            type: "string",
            description: "The replacement code snippet",
            required: true,
          },
          enclosingScope: {
            type: "string",
            description: "The declaration of the enclosing scope (e.g. 'class OrderProcessor', 'function calculateTotal')",
            required: true,
          },
          caseSensitive: {
            type: "boolean",
            description: "Whether scope declaration matching should be case sensitive (default: true)",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (
            typeof args.content !== "string" ||
            typeof args.oldSnippet !== "string" ||
            typeof args.newSnippet !== "string" ||
            typeof args.enclosingScope !== "string"
          ) {
            return {
              success: false,
              error: "Missing required string parameters ('content', 'oldSnippet', 'newSnippet', 'enclosingScope').",
            };
          }
          const result = this.supervisor.findAndReplaceInScope(args.content, args.oldSnippet, args.newSnippet, {
            enclosingScope: args.enclosingScope,
            caseSensitive: typeof args.caseSensitive === "boolean" ? args.caseSensitive : true,
          });
          return {
            success: result.success,
            modifiedContent: result.modifiedContent,
            matchedScopeSpan: result.matchedScopeSpan,
            error: result.error,
          };
        },
      },
      {
        name: "fuzzy_ngram_similarity_search",
        description: "Searches for similar candidate code blocks across large files using N-gram vector cosine similarity.",
        parameters: {
          content: {
            type: "string",
            description: "The complete file content to search",
            required: true,
          },
          searchSnippet: {
            type: "string",
            description: "The code snippet to find candidates for",
            required: true,
          },
          n: {
            type: "number",
            description: "The N-gram length (default: 3 for tri-grams)",
            required: false,
          },
          minScoreThreshold: {
            type: "number",
            description: "Minimum cosine similarity score (0.0 to 1.0, default: 0.2)",
            required: false,
          },
          maxResults: {
            type: "number",
            description: "Maximum number of candidate windows to return (default: 5)",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.content !== "string" || typeof args.searchSnippet !== "string") {
            return {
              success: false,
              error: "Missing required string parameters ('content', 'searchSnippet').",
            };
          }
          const result = this.supervisor.searchByNGramCosineSimilarity(args.content, args.searchSnippet, {
            n: typeof args.n === "number" ? args.n : 3,
            minScoreThreshold: typeof args.minScoreThreshold === "number" ? args.minScoreThreshold : 0.2,
            maxResults: typeof args.maxResults === "number" ? args.maxResults : 5,
          });
          return {
            success: true,
            candidates: result.candidates,
            topCandidate: result.topCandidate,
            totalEvaluatedWindows: result.totalEvaluatedWindows,
          };
        },
      },
      {
        name: "fuzzy_rename_symbol_workspace",
        description: "Executes whole-word fuzzy identifier renaming across multiple files with comment/string filters and dry-run validation.",
        parameters: {
          files: {
            type: "string",
            description: "JSON-encoded object or map of filePath -> fileContent for all participating files",
            required: true,
          },
          oldSymbol: {
            type: "string",
            description: "The identifier to rename",
            required: true,
          },
          newSymbol: {
            type: "string",
            description: "The new identifier name",
            required: true,
          },
          renameInComments: {
            type: "boolean",
            description: "Whether to rename occurrences in comments (default: true)",
            required: false,
          },
          renameInStrings: {
            type: "boolean",
            description: "Whether to rename occurrences in string literals (default: false)",
            required: false,
          },
          wholeWordOnly: {
            type: "boolean",
            description: "Whether to match whole word boundaries only (default: true)",
            required: false,
          },
          dryRun: {
            type: "boolean",
            description: "If true, simulates renaming without updating committedFiles (default: false)",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          let filesMap: Record<string, string>;
          if (typeof args.files === "string") {
            try {
              filesMap = JSON.parse(args.files);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              return { success: false, error: `Invalid JSON for files parameter: ${msg}` };
            }
          } else if (typeof args.files === "object" && args.files !== null) {
            filesMap = args.files as Record<string, string>;
          } else {
            return {
              success: false,
              error: "Missing required parameter 'files' (string or object).",
            };
          }

          if (typeof args.oldSymbol !== "string" || typeof args.newSymbol !== "string") {
            return {
              success: false,
              error: "Missing required string parameters ('oldSymbol', 'newSymbol').",
            };
          }
          const result = this.supervisor.renameSymbolWorkspace(
            filesMap,
            args.oldSymbol,
            args.newSymbol,
            {
              renameInComments: typeof args.renameInComments === "boolean" ? args.renameInComments : true,
              renameInStrings: typeof args.renameInStrings === "boolean" ? args.renameInStrings : false,
              wholeWordOnly: typeof args.wholeWordOnly === "boolean" ? args.wholeWordOnly : true,
              dryRun: typeof args.dryRun === "boolean" ? args.dryRun : false,
            }
          );
          return {
            success: result.success,
            totalOccurrencesRenamed: result.totalOccurrencesRenamed,
            totalFilesModified: result.totalFilesModified,
            fileResults: result.fileResults,
            committedFiles: result.committedFiles,
            error: result.error,
          };
        },
      },
      {
        name: "fuzzy_apply_patch_with_drift",
        description: "Applies unified diff patches with dynamic line offset drift search (+-K lines) and fuzzy similarity compensation.",
        parameters: {
          content: {
            type: "string",
            description: "The file content to apply the patch to",
            required: true,
          },
          patchText: {
            type: "string",
            description: "The unified diff patch text",
            required: true,
          },
          maxDriftLines: {
            type: "number",
            description: "Maximum line offset drift search window (default: 50)",
            required: false,
          },
          similarityThreshold: {
            type: "number",
            description: "Minimum context matching similarity (default: 0.6)",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.content !== "string" || typeof args.patchText !== "string") {
            return {
              success: false,
              error: "Missing required string parameters ('content', 'patchText').",
            };
          }
          const result = this.supervisor.applyUnifiedPatchWithDrift(args.content, args.patchText, {
            maxDriftLines: typeof args.maxDriftLines === "number" ? args.maxDriftLines : 50,
            similarityThreshold: typeof args.similarityThreshold === "number" ? args.similarityThreshold : 0.6,
          });
          return {
            success: result.success,
            modifiedContent: result.modifiedContent,
            totalHunks: result.totalHunks,
            appliedHunks: result.appliedHunks,
            maxObservedDrift: result.maxObservedDrift,
            hunkResults: result.hunkResults,
            error: result.error,
          };
        },
      },
      {
        name: "fuzzy_record_conflict_resolution",
        description: "Records a verified merge conflict resolution in the in-memory Git Rerere cache for automatic replay across recurring merges.",
        parameters: {
          baseSnippet: {
            type: "string",
            description: "The base ancestor conflict snippet",
            required: false,
          },
          oursSnippet: {
            type: "string",
            description: "Our branch conflict snippet",
            required: true,
          },
          theirsSnippet: {
            type: "string",
            description: "Their branch conflict snippet",
            required: true,
          },
          resolvedSnippet: {
            type: "string",
            description: "The resolved output snippet to remember",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.oursSnippet !== "string" || typeof args.theirsSnippet !== "string" || typeof args.resolvedSnippet !== "string") {
            return {
              success: false,
              error: "Missing required string parameters ('oursSnippet', 'theirsSnippet', 'resolvedSnippet').",
            };
          }
          const preimage = {
            baseSnippet: typeof args.baseSnippet === "string" ? args.baseSnippet : "",
            oursSnippet: args.oursSnippet,
            theirsSnippet: args.theirsSnippet,
          };
          const entry = this.supervisor.recordConflictResolution(preimage, args.resolvedSnippet);
          return {
            success: true,
            fingerprint: entry.conflictFingerprint,
            recordedAt: entry.recordedAt,
            entry,
          };
        },
      },
      {
        name: "fuzzy_replay_conflict_resolution",
        description: "Scans content with git conflict markers and automatically replays matching recorded resolutions from the Rerere cache.",
        parameters: {
          content: {
            type: "string",
            description: "The file content containing git conflict markers",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.content !== "string") {
            return {
              success: false,
              error: "Missing required parameter 'content' (string).",
            };
          }
          const result = this.supervisor.replayConflictResolution(args.content);
          return {
            success: result.success,
            modifiedContent: result.modifiedContent,
            replayedConflictsCount: result.replayedConflictsCount,
            unresolvedConflictsCount: result.unresolvedConflictsCount,
            appliedResolutions: result.appliedResolutions,
            error: result.error,
          };
        },
      },
      {
        name: "fuzzy_refactor_function_signature",
        description: "Refactors a function signature (parameter reordering, options-object conversions) and synchronizes callsites across the file.",
        parameters: {
          content: {
            type: "string",
            description: "The source code content containing the function declaration and callsites",
            required: true,
          },
          functionName: {
            type: "string",
            description: "The name of the function to refactor",
            required: true,
          },
          newParams: {
            type: "string",
            description: "JSON array or list of new parameter definitions [{ name, type, defaultValue, isRest }]",
            required: true,
          },
          convertToOptionsObject: {
            type: "boolean",
            description: "Whether to convert positional arguments into a single options object destructuring",
            required: false,
          },
          optionsInterfaceName: {
            type: "string",
            description: "Optional interface name for the options parameter (e.g. 'ProcessOptions')",
            required: false,
          },
          paramMapping: {
            type: "string",
            description: "Optional JSON object mapping from new param name to old param name or old 0-indexed position",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          let parsedParams: any[];
          if (typeof args.newParams === "string") {
            try {
              parsedParams = JSON.parse(args.newParams);
            } catch {
              parsedParams = [];
            }
          } else if (Array.isArray(args.newParams)) {
            parsedParams = args.newParams;
          } else {
            return {
              success: false,
              error: "Missing required parameter 'newParams' (array or JSON string).",
            };
          }

          let parsedMapping: Record<string, string | number> | undefined;
          if (typeof args.paramMapping === "string") {
            try {
              parsedMapping = JSON.parse(args.paramMapping);
            } catch {
              parsedMapping = undefined;
            }
          } else if (typeof args.paramMapping === "object" && args.paramMapping !== null) {
            parsedMapping = args.paramMapping as Record<string, string | number>;
          }

          if (typeof args.content !== "string" || typeof args.functionName !== "string") {
            return {
              success: false,
              error: "Missing required parameters ('content', 'functionName').",
            };
          }
          const result = this.supervisor.refactorFunctionSignature(args.content, {
            functionName: args.functionName,
            newParams: parsedParams,
            convertToOptionsObject: typeof args.convertToOptionsObject === "boolean" ? args.convertToOptionsObject : false,
            optionsInterfaceName: typeof args.optionsInterfaceName === "string" ? args.optionsInterfaceName : undefined,
            paramMapping: parsedMapping,
          });
          return {
            success: result.success,
            modifiedContent: result.modifiedContent,
            declarationUpdated: result.declarationUpdated,
            callsitesUpdatedCount: result.callsitesUpdatedCount,
            error: result.error,
          };
        },
      },
      {
        name: "fuzzy_apply_parallel_multicursor_edits",
        description: "Executes atomic simultaneous replacements across multiple non-overlapping cursor loci in a file.",
        parameters: {
          content: {
            type: "string",
            description: "The original file content",
            required: true,
          },
          edits: {
            type: "string",
            description: "JSON array or list of cursor edits [{ searchSnippet, replacementSnippet, expectedLineHint }]",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          let parsedEdits: any[];
          if (typeof args.edits === "string") {
            try {
              parsedEdits = JSON.parse(args.edits);
            } catch {
              parsedEdits = [];
            }
          } else if (Array.isArray(args.edits)) {
            parsedEdits = args.edits;
          } else {
            return {
              success: false,
              error: "Missing required parameter 'edits' (array or JSON string).",
            };
          }

          if (typeof args.content !== "string") {
            return {
              success: false,
              error: "Missing required parameter 'content' (string).",
            };
          }
          const result = this.supervisor.applyParallelMultiCursorEdits(args.content, parsedEdits);
          return {
            success: result.success,
            modifiedContent: result.modifiedContent,
            totalCursorsApplied: result.totalCursorsApplied,
            appliedSpans: result.appliedSpans,
            error: result.error,
          };
        },
      },
      {
        name: "fuzzy_generate_histogram_diff",
        description: "Generates a Git-style --histogram unified diff isolating low-frequency anchor lines for optimal diff quality on repetitive code.",
        parameters: {
          oldText: {
            type: "string",
            description: "Original text before changes",
            required: true,
          },
          newText: {
            type: "string",
            description: "Modified text after changes",
            required: true,
          },
          filename: {
            type: "string",
            description: "Filename label for diff header (default: 'file')",
            required: false,
          },
          contextLines: {
            type: "number",
            description: "Number of surrounding context lines (default: 3)",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (typeof args.oldText !== "string" || typeof args.newText !== "string") {
            return {
              success: false,
              error: "Missing required string parameters ('oldText', 'newText').",
            };
          }
          const result = this.supervisor.generateHistogramDiff(
            args.oldText,
            args.newText,
            typeof args.filename === "string" ? args.filename : "file",
            { contextLines: typeof args.contextLines === "number" ? args.contextLines : 3 }
          );
          return {
            success: true,
            diffText: result.diffText,
            hunksCount: result.hunks.length,
            lowFrequencyAnchorsUsed: result.lowFrequencyAnchorsUsed,
            totalLinesChanged: result.totalLinesChanged,
            hasChanges: result.hasChanges,
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
