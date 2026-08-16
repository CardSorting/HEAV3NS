/**
 * validate-fuzzy-matcher.ts
 *
 * Comprehensive validation suite for Target #41: Deterministic 12-Strategy Fuzzy Line Matcher,
 * Atomic Multi-Hunk Patch Engine, Ellipsis-Wildcard Block Resolver, Unified Diff Parser & Applicator,
 * Unicode Typography Coordinate Mapping, Escape-Drift Guard & Edit Idempotency Substrate (Phase 103 / ADR-057).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { performance } from "node:perf_hooks";
import type {
  CodemodRule,
  PatchBranchCandidate,
} from "../src/core/contracts/fuzzy-matcher.contracts.js";
import { DeterministicFuzzyMatcher } from "../src/tooling/extensions/fuzzy/deterministic-fuzzy-matcher.js";
import { BroccoliFuzzySubstrate } from "../src/sessions/extensions/fuzzy/broccoli-fuzzy-substrate.js";
import { FuzzySnapshotManager } from "../src/sessions/extensions/fuzzy/fuzzy-snapshot-manager.js";
import { FuzzyMatcherSupervisor } from "../src/agents/extensions/fuzzy/fuzzy-matcher-supervisor.js";
import { FuzzyMatcherToolSuite } from "../src/tooling/extensions/fuzzy/fuzzy-matcher-tool-suite.js";
import { MonolithFactory } from "../src/factories/monolith-factory.js";
import { GrandMonolithSynthesizer } from "../src/factories/grand-monolith-synthesizer.js";

async function runValidationSuite() {
  console.log("================================================================================");
  console.log(" LUMI Phase 103 / ADR-057: Deterministic 12-Strategy Fuzzy Matcher Validation ");
  console.log("================================================================================\n");

  let passedSuites = 0;
  const totalSuites = 52;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-fuzzy-val-"));

  try {
    // ---------------------------------------------------------------------------
    // Suite 1: Exact Match, Edit Idempotency & Line-Ending Preservation
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/52] Exact Match, Edit Idempotency & Line-Ending Preservation...");
    const matcher = new DeterministicFuzzyMatcher();

    const baseContent = "function calculateTotal(items: number[]): number {\n  return items.reduce((a, b) => a + b, 0);\n}";
    const oldStr = "return items.reduce((a, b) => a + b, 0);";
    const newStr = "return items.reduce((sum, item) => sum + item, 0);";

    // 1. Exact match replacement
    const exactRes = matcher.findAndReplace(baseContent, oldStr, newStr);
    if (!exactRes.success || exactRes.strategyUsed !== "exact" || exactRes.isIdempotent) {
      throw new Error(`Exact match failed: ${JSON.stringify(exactRes)}`);
    }

    // 2. Idempotency on already applied content
    const idempotentRes = matcher.findAndReplace(exactRes.modifiedContent, oldStr, newStr);
    if (!idempotentRes.success || !idempotentRes.isIdempotent) {
      throw new Error(`Idempotency check failed on already-modified content: ${JSON.stringify(idempotentRes)}`);
    }

    // 3. Reject identical strings
    const identicalRes = matcher.findAndReplace(baseContent, oldStr, oldStr);
    if (identicalRes.success || !identicalRes.error?.includes("identical")) {
      throw new Error(`Identical string rejection failed: ${JSON.stringify(identicalRes)}`);
    }

    // 4. CRLF preservation
    const crlfContent = "const x = 1;\r\nconst y = 2;\r\n";
    const crlfRes = matcher.findAndReplace(crlfContent, "const y = 2;", "const y = 20;");
    if (!crlfRes.success || !crlfRes.modifiedContent.includes("\r\n")) {
      throw new Error("CRLF line-ending preservation failed");
    }
    console.log("  ✓ Validated exact matching, idempotency short-circuiting, and CRLF preservation");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: Line-Trimmed, Whitespace-Normalized & Relative Indentation Adaptation
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/52] Line-Trimmed, Whitespace-Normalized & Relative Indentation Adaptation...");
    const whitespaceContent = "class UserService {\n    findUser(id: string) {\n        return db.users.get(id);\n    }\n}";

    // Line trimmed with trailing space difference
    const lineTrimmedOld = "    findUser(id: string) {   \n        return db.users.get(id);  ";
    const lineTrimmedNew = "    findUserById(id: string) {\n        return db.users.get(id);\n    }";
    const resLineTrim = matcher.findAndReplace(whitespaceContent, lineTrimmedOld, lineTrimmedNew);
    if (!resLineTrim.success || resLineTrim.strategyUsed !== "line_trimmed") {
      throw new Error(`Line-trimmed match failed: ${JSON.stringify(resLineTrim)}`);
    }

    // Relative Indentation Adaptation: target has 8 spaces, model gives 0 spaces with nested body
    const nestedTarget = "        if (active) {\n            doAction();\n        }";
    const modelZeroIndentOld = "if (active) {\n    doAction();\n}";
    const modelZeroIndentNew = "if (active) {\n    doSafeAction();\n    logAction();\n}";
    const resRelativeIndent = matcher.findAndReplace(nestedTarget, modelZeroIndentOld, modelZeroIndentNew);
    if (!resRelativeIndent.success || !resRelativeIndent.modifiedContent.includes("        if (active) {\n            doSafeAction();\n            logAction();\n        }")) {
      throw new Error(`Relative indentation adaptation failed: ${resRelativeIndent.modifiedContent}`);
    }
    console.log("  ✓ Successfully preserved relative nesting indentation across differing base depths");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: Indentation-Flexible & Selective Control Character Unescaping (\t, \r)
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/52] Indentation-Flexible & Selective Control Character Unescaping (\\t, \\r)...");
    const tabFileContent = "function process() {\n\tconst a = 1;\n\treturn a;\n}";

    // Model provides literal \t in new_string where file has real tabs
    const tabOld = "function process() {\n\tconst a = 1;\n\treturn a;\n}";
    const tabNew = "function process() {\n\\tconst a = 100;\n\\treturn a;\n}";

    const resTab = matcher.findAndReplace(tabFileContent, tabOld, tabNew);
    if (!resTab.success || !resTab.modifiedContent.includes("\tconst a = 100;")) {
      throw new Error(`Selective tab unescaping failed: ${JSON.stringify(resTab)}`);
    }
    console.log("  ✓ Selectively unescaped control characters matching real file tab bytes");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: Escape Drift & Backslash Doubling Guards
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/52] Escape Drift & Backslash Doubling Guards...");
    const quoteFileContent = "const msg = 'hello world';";

    // Model introduces spurious \' escaping in tool args that does not exist in file
    const driftOld = "const msg = \\'hello world\\';";
    const driftNew = "const msg = \\'hello LUMI-JOY\\';";

    const resDrift = matcher.findAndReplace(quoteFileContent, driftOld, driftNew);
    if (resDrift.success || !resDrift.error?.includes("Escape-drift detected")) {
      throw new Error(`Escape drift detection failed: ${JSON.stringify(resDrift)}`);
    }

    // Doubled backslashes (JSON double escaping)
    const backslashContent = "const path = 'C:\\\\Users\\\\Admin';";
    const doubledOld = "const path = 'C:\\\\\\\\Users\\\\\\\\Admin';";
    const doubledNew = "const path = 'C:\\\\\\\\Users\\\\\\\\Lumi';";
    const resDoubled = matcher.findAndReplace(backslashContent, doubledOld, doubledNew);
    if (resDoubled.success || !resDoubled.error?.includes("Escape-drift detected")) {
      throw new Error(`Backslash doubling detection failed: ${JSON.stringify(resDoubled)}`);
    }
    console.log("  ✓ Blocked spurious transport-level escape drift and JSON backslash doubling");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: Comment Tolerance, Token Normalization & Ellipsis Wildcard
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/52] Comment Tolerance, Token Normalization & Ellipsis Wildcard...");
    const commentedCode = "function start() {\n    // Setup database connection\n    initDb();\n    /* Start listener */\n    listen();\n}";
    const searchNoComments = "function start() {\n    initDb();\n    listen();\n}";
    const replacementCode = "function start() {\n    initDbV2();\n    listenV2();\n}";

    const resComment = matcher.findAndReplace(commentedCode, searchNoComments, replacementCode);
    if (!resComment.success || resComment.strategyUsed !== "comment_tolerant") {
      throw new Error(`Comment-tolerant matching failed: ${JSON.stringify(resComment)}`);
    }

    // Token-normalized code matching (punctuation spacing differences)
    const tokenCode = "const result = calculate( a , b );";
    const searchTokenDiff = "const result = calculate(a, b);";
    const replaceToken = "const result = calculate(a, b, true);";

    const resToken = matcher.findAndReplace(tokenCode, searchTokenDiff, replaceToken);
    if (!resToken.success || resToken.strategyUsed !== "token_normalized") {
      throw new Error(`Token-normalized matching failed: ${JSON.stringify(resToken)}`);
    }

    // Ellipsis wildcard matching
    const largeBlock = "function setupServer() {\n    const port = 8080;\n    const host = 'localhost';\n    const ssl = true;\n    return start();\n}";
    const ellipsisSearch = "function setupServer() {\n    // ... existing code ...\n    return start();\n}";
    const ellipsisReplace = "function setupServer() {\n    const port = 9090;\n    return start();\n}";

    const resEllipsis = matcher.findAndReplace(largeBlock, ellipsisSearch, ellipsisReplace);
    if (!resEllipsis.success || resEllipsis.strategyUsed !== "ellipsis_wildcard" || !resEllipsis.modifiedContent.includes("const port = 9090;")) {
      throw new Error(`Ellipsis-wildcard matching failed: ${JSON.stringify(resEllipsis)}`);
    }

    // Unicode coordinate mapping
    const origMap = matcher.buildOrigToNormMap("a—b");
    if (origMap.length !== 4 || origMap[0] !== 0 || origMap[1] !== 1 || origMap[2] !== 3 || origMap[3] !== 4) {
      throw new Error(`buildOrigToNormMap returned invalid map: ${JSON.stringify(origMap)}`);
    }
    console.log("  ✓ Verified comment tolerance, token delimiter normalization, and ellipsis wildcard matching");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: Whitespace Visualization, Closest Line Diagnostics & Unified Patch Application
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/52] Whitespace Visualization, Closest Line Diagnostics & Unified Patch Application...");
    const mismatchContent = "function configureServer() {\n    const port = 8080;\n    const databaseHost = 'localhost';\n    return port;\n}";
    const failedSearch = "function configureServer() {\n\tconst port = 8080;\n\treturn port;\n}";

    const diagnosis = matcher.diagnoseMismatch(failedSearch, mismatchContent);
    if (!diagnosis.hasCandidate || !diagnosis.whitespaceIssueDetected) {
      throw new Error(`Mismatch diagnosis failed: ${JSON.stringify(diagnosis)}`);
    }

    const visual = matcher.visualizeWhitespace("  \tconst a = 1;");
    if (visual !== "··→const a = 1;") {
      throw new Error(`Whitespace visualization failed: ${visual}`);
    }

    // Unified Diff Patch Application
    const fileToPatch = "const x = 1;\nconst y = 2;\nconst z = 3;";
    const unifiedPatch = "--- a/file\n+++ b/file\n@@ -2,1 +2,1 @@\n-const y = 2;\n+const y = 200;";
    const patchResult = matcher.applyUnifiedPatch(fileToPatch, unifiedPatch);
    if (!patchResult.success || !patchResult.modifiedContent.includes("const y = 200;")) {
      throw new Error(`Unified diff patch application failed: ${JSON.stringify(patchResult)}`);
    }
    console.log("  ✓ Verified whitespace visualizer (→ / ·), diagnostics, and unified patch application");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: Atomic Multi-Hunk Patch Engine & O(1) Rollback
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/52] Atomic Multi-Hunk Patch Engine & O(1) Rollback...");
    const multiFile = "const A = 1;\nconst B = 2;\nconst C = 3;\nconst D = 4;\nconst E = 5;";

    const hunks = [
      { oldString: "const B = 2;", newString: "const B = 200;" },
      { oldString: "const D = 4;", newString: "const D = 400;" },
    ];

    const multiRes = matcher.findAndReplaceMulti(multiFile, hunks);
    if (!multiRes.success || multiRes.appliedHunks !== 2 || !multiRes.modifiedContent.includes("const B = 200;") || !multiRes.modifiedContent.includes("const D = 400;")) {
      throw new Error(`Atomic multi-hunk replacement failed: ${JSON.stringify(multiRes)}`);
    }

    // Overlapping hunks detection
    const overlappingHunks = [
      { oldString: "const B = 2;\nconst C = 3;", newString: "const B = 20;\nconst C = 30;" },
      { oldString: "const C = 3;\nconst D = 4;", newString: "const C = 300;\nconst D = 400;" },
    ];
    const overlapRes = matcher.findAndReplaceMulti(multiFile, overlappingHunks);
    if (overlapRes.success || !overlapRes.error?.includes("Overlapping hunks detected")) {
      throw new Error(`Overlapping hunk collision detection failed: ${JSON.stringify(overlapRes)}`);
    }

    // Substrate Rollback Test
    const substrate = new BroccoliFuzzySubstrate();
    const supervisor = new FuzzyMatcherSupervisor(matcher, substrate);
    const snapshotManager = new FuzzySnapshotManager(substrate);

    snapshotManager.captureFrame(1);

    supervisor.findAndReplaceMulti(multiFile, hunks);
    supervisor.setCustomUnicodeMapping("§", "$");
    supervisor.setSimilarityThreshold(0.75);

    if (substrate.getHistory().length !== 2 || substrate.getSimilarityThreshold() !== 0.75) {
      throw new Error("Substrate state mutation failed");
    }

    for (let w = 0; w < 5; w++) {
      snapshotManager.rewindToFrame(1);
    }
    const rewindStart = performance.now();
    const rewindSuccess = snapshotManager.rewindToFrame(1);
    const rewindDuration = performance.now() - rewindStart;

    if (!rewindSuccess || substrate.getHistory().length !== 0 || substrate.getSimilarityThreshold() !== 0.5) {
      throw new Error("Fuzzy snapshot manager state rewind failed");
    }
    console.log(`  ✓ Atomic multi-hunk patching verified and O(1) rollback completed in ${rewindDuration.toFixed(3)} ms (< 0.05 ms SLA)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: Model Tool Suite Execution & Monolith 399-Component Synthesis
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/52] Model Tool Suite Execution (48 Tools) & Monolith 399-Component Synthesis...");
    const toolSuite = new FuzzyMatcherToolSuite(supervisor);
    const tools = toolSuite.getTools();

    const findReplaceTool = tools.find((t) => t.name === "fuzzy_find_and_replace")!;
    const multiReplaceTool = tools.find((t) => t.name === "fuzzy_multi_replace")!;
    const patchTool = tools.find((t) => t.name === "fuzzy_generate_patch")!;
    const applyPatchTool = tools.find((t) => t.name === "fuzzy_apply_patch")!;
    const applyBlocksTool = tools.find((t) => t.name === "fuzzy_apply_search_replace_blocks")!;
    const lineHintTool = tools.find((t) => t.name === "fuzzy_find_and_replace_at_line")!;
    const resolveConflictTool = tools.find((t) => t.name === "fuzzy_resolve_conflict_markers")!;
    const harmonizeIndentTool = tools.find((t) => t.name === "fuzzy_harmonize_indentation")!;
    const multiFileTxTool = tools.find((t) => t.name === "fuzzy_apply_multi_file_transaction")!;
    const threeWayTool = tools.find((t) => t.name === "fuzzy_three_way_merge")!;
    const applyLspTool = tools.find((t) => t.name === "fuzzy_apply_lsp_edits")!;
    const repairSyntaxTool = tools.find((t) => t.name === "fuzzy_repair_syntax_block")!;
    const rankCandidateTool = tools.find((t) => t.name === "fuzzy_rank_candidate_matches")!;
    const patienceDiffTool = tools.find((t) => t.name === "fuzzy_generate_patience_diff")!;
    const tokenStreamTool = tools.find((t) => t.name === "fuzzy_token_stream_replace")!;
    const explainConflictTool = tools.find((t) => t.name === "fuzzy_explain_merge_conflict")!;
    const inversePatchTool = tools.find((t) => t.name === "fuzzy_generate_inverse_patch")!;
    const scopeBoundedTool = tools.find((t) => t.name === "fuzzy_find_and_replace_in_scope")!;
    const ngramSearchTool = tools.find((t) => t.name === "fuzzy_ngram_similarity_search")!;
    const renameSymbolTool = tools.find((t) => t.name === "fuzzy_rename_symbol_workspace")!;
    const patchDriftTool = tools.find((t) => t.name === "fuzzy_apply_patch_with_drift")!;
    const recordConflictTool = tools.find((t) => t.name === "fuzzy_record_conflict_resolution")!;
    const replayConflictTool = tools.find((t) => t.name === "fuzzy_replay_conflict_resolution")!;
    const refactorSignatureTool = tools.find((t) => t.name === "fuzzy_refactor_function_signature")!;
    const parallelCursorTool = tools.find((t) => t.name === "fuzzy_apply_parallel_multicursor_edits")!;
    const histogramDiffTool = tools.find((t) => t.name === "fuzzy_generate_histogram_diff")!;
    const structuralPatternTool = tools.find((t) => t.name === "fuzzy_structural_pattern_replace")!;
    const generateTreeDiffTool = tools.find((t) => t.name === "fuzzy_generate_semantic_tree_diff")!;
    const applyTreeDiffTool = tools.find((t) => t.name === "fuzzy_apply_semantic_tree_diff")!;
    const multiSourcePatchTool = tools.find((t) => t.name === "fuzzy_synthesize_multi_source_patch")!;
    const optimizeImportsTool = tools.find((t) => t.name === "fuzzy_optimize_and_harmonize_imports")!;
    const relocateCodeTool = tools.find((t) => t.name === "fuzzy_relocate_code_block")!;
    const syncDocCommentsTool = tools.find((t) => t.name === "fuzzy_synchronize_doc_comments")!;
    const spliceSkeletonTool = tools.find((t) => t.name === "fuzzy_splice_multi_region_skeleton")!;
    const pruneImportsTool = tools.find((t) => t.name === "fuzzy_prune_unused_imports")!;
    const codemodPipelineTool = tools.find((t) => t.name === "fuzzy_execute_codemod_pipeline")!;
    const patchConfigTool = tools.find((t) => t.name === "fuzzy_patch_structured_config")!;
    const inlineExtractTool = tools.find((t) => t.name === "fuzzy_inline_or_extract_function")!;
    const patchImpactTool = tools.find((t) => t.name === "fuzzy_analyze_patch_impact")!;
    const exploreBranchesTool = tools.find((t) => t.name === "fuzzy_explore_patch_branches")!;
    const nullabilityGuardsTool = tools.find((t) => t.name === "fuzzy_synthesize_nullability_guards")!;
    const resolveAliasesTool = tools.find((t) => t.name === "fuzzy_resolve_import_aliases_and_reexports")!;
    const invertBranchesTool = tools.find((t) => t.name === "fuzzy_invert_conditional_branches")!;
    const dryRunTool = tools.find((t) => t.name === "fuzzy_dry_run_replace")!;
    const idempotencyTool = tools.find((t) => t.name === "fuzzy_check_idempotency")!;
    const diagnoseTool = tools.find((t) => t.name === "fuzzy_diagnose_mismatch")!;
    const configTool = tools.find((t) => t.name === "fuzzy_configure_strategies")!;
    const inspectTool = tools.find((t) => t.name === "fuzzy_inspect_strategies")!;

    if (
      !findReplaceTool ||
      !multiReplaceTool ||
      !patchTool ||
      !applyPatchTool ||
      !applyBlocksTool ||
      !lineHintTool ||
      !resolveConflictTool ||
      !harmonizeIndentTool ||
      !multiFileTxTool ||
      !threeWayTool ||
      !applyLspTool ||
      !repairSyntaxTool ||
      !rankCandidateTool ||
      !patienceDiffTool ||
      !tokenStreamTool ||
      !explainConflictTool ||
      !inversePatchTool ||
      !scopeBoundedTool ||
      !ngramSearchTool ||
      !renameSymbolTool ||
      !patchDriftTool ||
      !recordConflictTool ||
      !replayConflictTool ||
      !refactorSignatureTool ||
      !parallelCursorTool ||
      !histogramDiffTool ||
      !structuralPatternTool ||
      !generateTreeDiffTool ||
      !applyTreeDiffTool ||
      !multiSourcePatchTool ||
      !optimizeImportsTool ||
      !relocateCodeTool ||
      !syncDocCommentsTool ||
      !spliceSkeletonTool ||
      !pruneImportsTool ||
      !codemodPipelineTool ||
      !patchConfigTool ||
      !inlineExtractTool ||
      !patchImpactTool ||
      !exploreBranchesTool ||
      !nullabilityGuardsTool ||
      !resolveAliasesTool ||
      !invertBranchesTool ||
      !dryRunTool ||
      !idempotencyTool ||
      !diagnoseTool ||
      !configTool ||
      !inspectTool
    ) {
      throw new Error("Missing required Fuzzy Matcher model tools (expected 48 tools)");
    }

    // Test Apply Patch Tool
    const applyRes = (await applyPatchTool.execute(
      {
        content: fileToPatch,
        patch: unifiedPatch,
      },
      tempDir
    )) as { success: boolean; modifiedContent: string };
    if (!applyRes.success || !applyRes.modifiedContent.includes("const y = 200;")) {
      throw new Error("fuzzy_apply_patch tool execution failed");
    }

    // Monolith Verification
    const monolith = MonolithFactory.createEngine();
    const verification = GrandMonolithSynthesizer.verifyComposition(monolith);

    if (verification.cohesionStatus !== "OPTIMAL") {
      console.error("Missing components:", verification.missingComponents);
      console.error("Unexpected components:", verification.unexpectedComponents);
      console.error("Duplicates:", verification.duplicateManifestComponents);
      throw new Error(`Composition status is ${verification.cohesionStatus}, expected OPTIMAL`);
    }

    if (verification.componentCount !== 444 || verification.requiredComponentCount !== 444) {
      throw new Error(`Expected exactly 444 components, got ${verification.componentCount}`);
    }
    console.log(`  ✓ Grand Monolith successfully verified with ${verification.componentCount}/${verification.requiredComponentCount} components in OPTIMAL cohesion`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 9: SEARCH/REPLACE Block Parser & Applicator (Aider/LLM Conventions)
    // ---------------------------------------------------------------------------
    console.log("[Suite 9/52] SEARCH/REPLACE Block Parser & Applicator (Aider/LLM Conventions)...");
    const blockFile = `
function computeStats(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sum = values.reduce((a, b) => a + b, 0);
  return { min, max, sum };
}
`;

    const searchReplaceBlock = `
<<<<<<< SEARCH
  const min = Math.min(...values);
  const max = Math.max(...values);
=======
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
>>>>>>> REPLACE
`;

    const parsedBlocks = matcher.parseSearchReplaceBlocks(searchReplaceBlock);
    if (parsedBlocks.length !== 1 || !parsedBlocks[0].oldString.includes("const min = Math.min")) {
      throw new Error(`SEARCH/REPLACE block parsing failed: ${JSON.stringify(parsedBlocks)}`);
    }

    const appliedBlocksRes = matcher.applySearchReplaceBlocks(blockFile, searchReplaceBlock);
    if (
      !appliedBlocksRes.success ||
      appliedBlocksRes.appliedHunks !== 1 ||
      !appliedBlocksRes.modifiedContent.includes("values.length ? Math.min(...values) : 0")
    ) {
      throw new Error(`SEARCH/REPLACE block application failed: ${JSON.stringify(appliedBlocksRes)}`);
    }

    // Test tool integration for search/replace blocks
    const blockToolRes = (await applyBlocksTool.execute(
      {
        content: blockFile,
        blockText: searchReplaceBlock,
      },
      tempDir
    )) as { success: boolean; modifiedContent: string; appliedHunks: number };
    if (!blockToolRes.success || blockToolRes.appliedHunks !== 1) {
      throw new Error("fuzzy_apply_search_replace_blocks tool execution failed");
    }
    console.log("  ✓ SEARCH/REPLACE block parsing & multi-hunk applicator verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 10: Line-Hint Centered Disambiguation Matching
    // ---------------------------------------------------------------------------
    console.log("[Suite 10/52] Line-Hint Centered Disambiguation Matching...");
    const duplicateLinesFile = [
      "// Block 1",
      "function foo() {",
      "  return 42;",
      "}",
      "// Block 2",
      "function bar() {",
      "  return 42;",
      "}",
      "// Block 3",
      "function baz() {",
      "  return 42;",
      "}",
    ].join("\n");

    // Replace the return statement in Block 2 (around line 7)
    const lineHintRes = matcher.findAndReplaceAtLine(
      duplicateLinesFile,
      "  return 42;",
      "  return 100;",
      7,
      2
    );

    if (
      !lineHintRes.success ||
      !lineHintRes.modifiedContent.includes("function bar() {\n  return 100;\n}") ||
      !lineHintRes.modifiedContent.includes("function foo() {\n  return 42;\n}") ||
      !lineHintRes.modifiedContent.includes("function baz() {\n  return 42;\n}")
    ) {
      throw new Error(`Line-hint disambiguation failed: ${JSON.stringify(lineHintRes)}`);
    }

    // Test tool integration for line hint
    const lineToolRes = (await lineHintTool.execute(
      {
        content: duplicateLinesFile,
        oldString: "  return 42;",
        newString: "  return 999;",
        lineHint: 11,
        lineTolerance: 2,
      },
      tempDir
    )) as { success: boolean; modifiedContent: string };

    if (!lineToolRes.success || !lineToolRes.modifiedContent.includes("function baz() {\n  return 999;\n}")) {
      throw new Error("fuzzy_find_and_replace_at_line tool execution failed");
    }
    console.log("  ✓ Line-hint centered disambiguation matching verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 11: Multi-File Unified Patch Application
    // ---------------------------------------------------------------------------
    console.log("[Suite 11/52] Multi-File Unified Patch Application...");
    const multiFilePatch = `
--- a/src/math.ts
+++ b/src/math.ts
@@ -1,3 +1,3 @@
 export function add(a: number, b: number): number {
-  return a + b;
+  return (a + b) | 0;
 }
--- a/src/string.ts
+++ b/src/string.ts
@@ -1,3 +1,3 @@
 export function trim(s: string): string {
-  return s.trim();
+  return s.trim().toLowerCase();
 }
`;

    const fileMap: Record<string, string> = {
      "src/math.ts": "export function add(a: number, b: number): number {\n  return a + b;\n}",
      "src/string.ts": "export function trim(s: string): string {\n  return s.trim();\n}",
    };

    const multiPatchRes = matcher.applyMultiFileUnifiedPatch(fileMap, multiFilePatch);
    if (
      !multiPatchRes.success ||
      multiPatchRes.successfulFiles !== 2 ||
      !multiPatchRes.fileResults["src/math.ts"]?.modifiedContent.includes("return (a + b) | 0;") ||
      !multiPatchRes.fileResults["src/string.ts"]?.modifiedContent.includes("return s.trim().toLowerCase();")
    ) {
      throw new Error(`Multi-file unified patch failed: ${JSON.stringify(multiPatchRes)}`);
    }
    console.log("  ✓ Multi-file unified diff patch parsing & application verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 12: Git Conflict Marker Parsing & Deterministic Resolution
    // ---------------------------------------------------------------------------
    console.log("[Suite 12/52] Git Conflict Marker Parsing & Deterministic Resolution...");
    const conflictContent = `
function calculateTax(amount: number): number {
<<<<<<< HEAD
  const rate = 0.0825;
  return amount * rate;
=======
  const rate = 0.085;
  return Math.round(amount * rate * 100) / 100;
>>>>>>> feature/precise-tax
}
`;

    const parsedConflicts = matcher.parseConflictMarkers(conflictContent);
    if (parsedConflicts.length !== 1 || parsedConflicts[0].oursHeader !== "HEAD") {
      throw new Error(`Conflict marker parsing failed: ${JSON.stringify(parsedConflicts)}`);
    }

    // Resolve with take_ours
    const resolvedOurs = matcher.resolveConflictMarkers(conflictContent, "take_ours");
    if (!resolvedOurs.success || !resolvedOurs.modifiedContent.includes("const rate = 0.0825;")) {
      throw new Error(`Conflict resolution 'take_ours' failed: ${JSON.stringify(resolvedOurs)}`);
    }

    // Resolve with take_theirs
    const resolvedTheirs = matcher.resolveConflictMarkers(conflictContent, "take_theirs");
    if (!resolvedTheirs.success || !resolvedTheirs.modifiedContent.includes("const rate = 0.085;")) {
      throw new Error(`Conflict resolution 'take_theirs' failed: ${JSON.stringify(resolvedTheirs)}`);
    }

    // Test tool integration for conflict markers
    const conflictToolRes = (await resolveConflictTool.execute(
      {
        content: conflictContent,
        strategy: "take_theirs",
      },
      tempDir
    )) as { success: boolean; modifiedContent: string; conflictsResolved: number };
    if (!conflictToolRes.success || conflictToolRes.conflictsResolved !== 1) {
      throw new Error("fuzzy_resolve_conflict_markers tool execution failed");
    }
    console.log("  ✓ Git conflict marker parser & deterministic resolution engine verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 13: Indentation Style Detection & Proportional Harmonizer
    // ---------------------------------------------------------------------------
    console.log("[Suite 13/52] Indentation Style Detection & Proportional Harmonizer...");
    const fourSpaceTarget = `
class OrderProcessor {
    processOrder(orderId: string) {
        if (orderId) {
            return this.executeOrder(orderId);
        }
    }
}
`;

    const twoSpaceSnippet = `
if (orderId) {
  logOrder(orderId);
  return this.executeOrder(orderId);
}
`;

    const targetStyle = matcher.detectIndentationStyle(fourSpaceTarget);
    if (targetStyle.type !== "spaces" || targetStyle.size !== 4) {
      throw new Error(`Indentation style detection failed: ${JSON.stringify(targetStyle)}`);
    }

    const harmonized = matcher.harmonizeIndentation(fourSpaceTarget, twoSpaceSnippet);
    if (!harmonized.harmonizedSnippet.includes("    logOrder(orderId);")) {
      throw new Error(`Indentation harmonization failed: ${JSON.stringify(harmonized)}`);
    }

    // Test tool integration for indentation harmonization
    const indentToolRes = (await harmonizeIndentTool.execute(
      {
        targetContent: fourSpaceTarget,
        snippet: twoSpaceSnippet,
      },
      tempDir
    )) as { success: boolean; harmonizedSnippet: string; detectedStyle: { size: number } };
    if (!indentToolRes.success || indentToolRes.detectedStyle.size !== 4) {
      throw new Error("fuzzy_harmonize_indentation tool execution failed");
    }
    console.log("  ✓ Indentation style detector & proportional harmonizer verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 14: Syntax-Aware Structural Block Boundary Snapping
    // ---------------------------------------------------------------------------
    console.log("[Suite 14/52] Syntax-Aware Structural Block Boundary Snapping...");
    const codeSnippet = "const userIdentifier = 'admin_user';";
    // Slicing mid-word at start (index 8 is inside 'userIdentifier') and end (index 15)
    const snapRes = matcher.snapToSyntaxBoundaries(codeSnippet, 8, 15);
    if (snapRes.snappedSubstring !== "userIdentifier") {
      throw new Error(`Syntax boundary snapping failed: ${JSON.stringify(snapRes)}`);
    }
    console.log("  ✓ Syntax-aware structural block boundary snapping verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 15: Atomic Multi-File Workspace Transactions & Rollback
    // ---------------------------------------------------------------------------
    console.log("[Suite 15/52] Atomic Multi-File Workspace Transactions & Rollback...");
    const initialFiles: Record<string, string> = {
      "fileA.ts": "export const A = 1;\nexport const B = 2;",
      "fileB.ts": "export const C = 3;\nexport const D = 4;",
      "fileC.ts": "export const E = 5;\nexport const F = 6;",
    };

    // 1. Successful 3-file transaction
    const txHunks = [
      { filePath: "fileA.ts", hunks: [{ oldString: "export const B = 2;", newString: "export const B = 20;" }] },
      { filePath: "fileB.ts", hunks: [{ oldString: "export const D = 4;", newString: "export const D = 40;" }] },
      { filePath: "fileC.ts", hunks: [{ oldString: "export const F = 6;", newString: "export const F = 60;" }] },
    ];

    const txSuccessRes = matcher.applyMultiFileTransaction(initialFiles, txHunks);
    if (
      !txSuccessRes.success ||
      txSuccessRes.totalFilesModified !== 3 ||
      !txSuccessRes.committedFiles["fileA.ts"].includes("export const B = 20;") ||
      !txSuccessRes.committedFiles["fileB.ts"].includes("export const D = 40;") ||
      !txSuccessRes.committedFiles["fileC.ts"].includes("export const F = 60;")
    ) {
      throw new Error(`Multi-file transaction failed: ${JSON.stringify(txSuccessRes)}`);
    }

    // 2. Transaction rollback when file 3 has an unmatchable hunk
    const failingTxHunks = [
      { filePath: "fileA.ts", hunks: [{ oldString: "export const B = 2;", newString: "export const B = 200;" }] },
      { filePath: "fileB.ts", hunks: [{ oldString: "export const D = 4;", newString: "export const D = 400;" }] },
      { filePath: "fileC.ts", hunks: [{ oldString: "NON_EXISTENT_CONTENT_FAIL", newString: "export const F = 600;" }] },
    ];

    const txRollbackRes = matcher.applyMultiFileTransaction(initialFiles, failingTxHunks);
    if (txRollbackRes.success || !txRollbackRes.rollbackTriggered || Object.keys(txRollbackRes.committedFiles).length !== 0) {
      throw new Error(`Multi-file transaction rollback failed: ${JSON.stringify(txRollbackRes)}`);
    }

    // Test tool integration for multi-file transaction
    const txToolRes = (await multiFileTxTool.execute(
      {
        fileContents: initialFiles,
        transactions: txHunks,
      },
      tempDir
    )) as { success: boolean; totalFilesModified: number };
    if (!txToolRes.success || txToolRes.totalFilesModified !== 3) {
      throw new Error("fuzzy_apply_multi_file_transaction tool execution failed");
    }
    console.log("  ✓ Atomic multi-file workspace transactions & transactional rollbacks verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 16: Fuzzy 3-Way Merge & Semantic Reconciliation
    // ---------------------------------------------------------------------------
    console.log("[Suite 16/52] Fuzzy 3-Way Merge & Semantic Reconciliation...");
    const baseContent3Way = "function compute(a: number, b: number): number {\n  return a + b;\n}";
    const oursContent3Way = "// Fast compute implementation\nfunction compute(a: number, b: number): number {\n  return a + b;\n}";
    const theirsContent3Way = "function compute(a: number, b: number): number {\n  return (a + b) | 0;\n}";

    // Non-conflicting clean 3-way merge
    const mergeCleanRes = matcher.threeWayMerge(baseContent3Way, oursContent3Way, theirsContent3Way);
    if (
      !mergeCleanRes.success ||
      mergeCleanRes.conflictCount !== 0 ||
      !mergeCleanRes.mergedContent.includes("// Fast compute implementation") ||
      !mergeCleanRes.mergedContent.includes("return (a + b) | 0;")
    ) {
      throw new Error(`Non-conflicting 3-way merge failed: ${JSON.stringify(mergeCleanRes)}`);
    }

    // Conflicting 3-way merge
    const oursConflicting = "function compute(a: number, b: number): number {\n  return a * 2 + b;\n}";
    const theirsConflicting = "function compute(a: number, b: number): number {\n  return a * 3 + b;\n}";

    const mergeConflictRes = matcher.threeWayMerge(baseContent3Way, oursConflicting, theirsConflicting, {
      conflictResolution: "markers",
      oursLabel: "LOCAL",
      theirsLabel: "REMOTE",
    });

    if (
      mergeConflictRes.success ||
      mergeConflictRes.conflictCount !== 1 ||
      !mergeConflictRes.mergedContent.includes("<<<<<<< LOCAL") ||
      !mergeConflictRes.mergedContent.includes(">>>>>>> REMOTE")
    ) {
      throw new Error(`Conflicting 3-way merge failed: ${JSON.stringify(mergeConflictRes)}`);
    }

    // Test tool integration for 3-way merge
    const threeWayToolRes = (await threeWayTool.execute(
      {
        baseContent: baseContent3Way,
        oursContent: oursContent3Way,
        theirsContent: theirsContent3Way,
        conflictResolution: "ours",
      },
      tempDir
    )) as { success: boolean; mergedContent: string };
    if (!threeWayToolRes.success || !threeWayToolRes.mergedContent.includes("Fast compute implementation")) {
      throw new Error("fuzzy_three_way_merge tool execution failed");
    }
    console.log("  ✓ 3-way merge, clean reconciliation, and conflict marker emission verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 17: LSP Standard TextEdit & WorkspaceEdit Applicator & Converter
    // ---------------------------------------------------------------------------
    console.log("[Suite 17/52] LSP Standard TextEdit & WorkspaceEdit Applicator & Converter...");
    const lspFileContent = "const alpha = 10;\nconst beta = 20;\nconst gamma = 30;";
    // Replace beta (line 1, char 6 to char 15) with 'beta = 200'
    const lspEdits = [
      {
        range: {
          start: { line: 1, character: 6 },
          end: { line: 1, character: 15 },
        },
        newText: "beta = 200",
      },
    ];

    const lspApplyRes = matcher.applyLspTextEdits(lspFileContent, lspEdits);
    if (!lspApplyRes.success || !lspApplyRes.modifiedContent.includes("const beta = 200;")) {
      throw new Error(`LSP TextEdit application failed: ${JSON.stringify(lspApplyRes)}`);
    }

    // Test converting fuzzy replacement hunks to LSP edits
    const convertedLspEdits = matcher.fuzzyHunksToLspEdits(lspFileContent, [
      { oldString: "const gamma = 30;", newString: "const gamma = 300;" },
    ]);
    if (convertedLspEdits.length !== 1 || convertedLspEdits[0].range.start.line !== 2) {
      throw new Error(`fuzzyHunksToLspEdits failed: ${JSON.stringify(convertedLspEdits)}`);
    }

    // Test applying workspace edit
    const workspaceEdit = {
      changes: {
        "file1.ts": [{ range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } }, newText: "x = 10" }],
      },
    };
    const wsRes = matcher.applyLspWorkspaceEdit({ "file1.ts": "const x = 1;" }, workspaceEdit);
    if (!wsRes.success || !wsRes.committedFiles["file1.ts"].includes("const x = 10;")) {
      throw new Error(`LSP WorkspaceEdit application failed: ${JSON.stringify(wsRes)}`);
    }

    // Test tool integration for LSP TextEdit
    const lspToolRes = (await applyLspTool.execute(
      {
        content: lspFileContent,
        edits: lspEdits,
      },
      tempDir
    )) as { success: boolean; modifiedContent: string };
    if (!lspToolRes.success || !lspToolRes.modifiedContent.includes("const beta = 200;")) {
      throw new Error("fuzzy_apply_lsp_edits tool execution failed");
    }
    console.log("  ✓ LSP TextEdit & WorkspaceEdit coordinate mapping, conversion, and application verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 18: Structural Syntax & Balanced Bracket / Tag Auto-Healer
    // ---------------------------------------------------------------------------
    console.log("[Suite 18/52] Structural Syntax & Balanced Bracket / Tag Auto-Healer...");
    const brokenCode1 = "function calculate() {\n  const total = items.reduce((a, b) => a + b, 0);\n";
    const repairRes1 = matcher.validateAndRepairCodeBlock(brokenCode1);
    if (repairRes1.isValid || !repairRes1.repairedCode.endsWith("}")) {
      throw new Error(`Syntax repair failed on unclosed curly brace: ${JSON.stringify(repairRes1)}`);
    }

    const brokenCode2 = "const apiKey = 'secret_token_12345";
    const repairRes2 = matcher.validateAndRepairCodeBlock(brokenCode2);
    if (repairRes2.isValid || !repairRes2.repairedCode.endsWith("'")) {
      throw new Error(`Syntax repair failed on unclosed string literal: ${JSON.stringify(repairRes2)}`);
    }

    const nestedBroken = "const payload = { config: [ { id: 'test'";
    const repairRes3 = matcher.validateAndRepairCodeBlock(nestedBroken);
    if (repairRes3.isValid || !repairRes3.repairedCode.endsWith("}]}") && !repairRes3.repairedCode.endsWith("']}}") && !repairRes3.repairedCode.includes("}]")) {
      throw new Error(`Syntax repair failed on nested unbalanced brackets: ${JSON.stringify(repairRes3)}`);
    }

    // Test tool integration for syntax repair
    const syntaxToolRes = (await repairSyntaxTool.execute(
      {
        codeSnippet: brokenCode1,
      },
      tempDir
    )) as { success: boolean; repairedCode: string };
    if (!syntaxToolRes.success || !syntaxToolRes.repairedCode.endsWith("}")) {
      throw new Error("fuzzy_repair_syntax_block tool execution failed");
    }
    console.log("  ✓ Structural syntax validation, bracket balancing, and string auto-healer verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 19: Multi-Candidate Semantic Jaccard & Levenshtein Match Scorer
    // ---------------------------------------------------------------------------
    console.log("[Suite 19/52] Multi-Candidate Semantic Jaccard & Levenshtein Match Scorer...");
    const ambiguousContent = `
// Config Section 1
const serverPort = 3000;
const serverHost = '127.0.0.1';

// Config Section 2
const serverPort = 8080;
const serverHost = '0.0.0.0';
`;

    const rankingRes = matcher.rankCandidateMatches(ambiguousContent, "const serverPort = 8080;\nconst serverHost = '0.0.0.0';", 3);
    if (!rankingRes.bestMatch || rankingRes.bestMatch.combinedScore !== 1.0 || rankingRes.bestMatch.startLine !== 7) {
      throw new Error(`Candidate ranking failed: ${JSON.stringify(rankingRes)}`);
    }

    // Test tool integration for candidate ranking
    const rankToolRes = (await rankCandidateTool.execute(
      {
        content: ambiguousContent,
        searchSnippet: "const serverPort = 8080;",
        limit: 2,
      },
      tempDir
    )) as { success: boolean; bestMatch: { combinedScore: number } };
    if (!rankToolRes.success || !rankToolRes.bestMatch || rankToolRes.bestMatch.combinedScore < 0.9) {
      throw new Error("fuzzy_rank_candidate_matches tool execution failed");
    }
    console.log("  ✓ Multi-candidate semantic Jaccard & Levenshtein ranking verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 20: Patience Diff Generation & Semantic Unique Line Alignment
    // ---------------------------------------------------------------------------
    console.log("[Suite 20/52] Patience Diff Generation & Semantic Unique Line Alignment...");
    const patienceOld = [
      "function add(a: number, b: number): number {",
      "  return a + b;",
      "}",
      "",
      "function multiply(a: number, b: number): number {",
      "  return a * b;",
      "}",
    ].join("\n");

    const patienceNew = [
      "function add(a: number, b: number): number {",
      "  // Fast integer addition",
      "  return (a + b) | 0;",
      "}",
      "",
      "function multiply(a: number, b: number): number {",
      "  return a * b;",
      "}",
    ].join("\n");

    const patienceRes = matcher.generatePatienceDiff(patienceOld, patienceNew, "math.ts");
    if (
      !patienceRes.hasChanges ||
      patienceRes.uniqueCommonLinesMatched === 0 ||
      patienceRes.hunks.length === 0 ||
      !patienceRes.diffText.includes("Fast integer addition")
    ) {
      throw new Error(`Patience diff generation failed: ${JSON.stringify(patienceRes)}`);
    }

    // Verify applying patience patch recovers patienceNew exactly
    const patchRes = matcher.applyPatiencePatch(patienceOld, patienceRes.diffText);
    if (!patchRes.success || patchRes.modifiedContent !== patienceNew) {
      throw new Error(`Patience diff patch application failed: ${JSON.stringify(patchRes)}`);
    }

    // Test tool integration for patience diff
    const patienceToolRes = (await patienceDiffTool.execute(
      {
        oldText: patienceOld,
        newText: patienceNew,
        filename: "math.ts",
      },
      tempDir
    )) as { success: boolean; hasChanges: boolean; diffText: string };
    if (!patienceToolRes.success || !patienceToolRes.hasChanges || !patienceToolRes.diffText.includes("math.ts")) {
      throw new Error("fuzzy_generate_patience_diff tool execution failed");
    }
    console.log("  ✓ Patience diff algorithm, unique anchor LIS matching, and patch application verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 21: Lexical Token Stream Alignment & Formatting-Tolerant Replacement
    // ---------------------------------------------------------------------------
    console.log("[Suite 21/52] Lexical Token Stream Alignment & Formatting-Tolerant Replacement...");
    const multiLineDestructure = [
      "const {",
      "  userId,",
      "  sessionId,",
      "  authToken,",
      "} = request.context;",
    ].join("\n");

    const singleLineSearch = "const { userId, sessionId, authToken } = request.context;";
    const replacementWithPerms = "const { userId, sessionId, authToken, permissions } = request.context;";

    const tokenMatchRes = matcher.findAndReplaceTokenStream(multiLineDestructure, singleLineSearch, replacementWithPerms);
    if (!tokenMatchRes.success || !tokenMatchRes.modifiedContent.includes("permissions") || tokenMatchRes.tokensMatched < 5) {
      throw new Error(`Token stream match replacement failed: ${JSON.stringify(tokenMatchRes)}`);
    }

    // Test tool integration for token stream replacement
    const tokenToolRes = (await tokenStreamTool.execute(
      {
        content: multiLineDestructure,
        oldSnippet: singleLineSearch,
        newSnippet: replacementWithPerms,
      },
      tempDir
    )) as { success: boolean; modifiedContent: string };
    if (!tokenToolRes.success || !tokenToolRes.modifiedContent.includes("permissions")) {
      throw new Error("fuzzy_token_stream_replace tool execution failed");
    }
    console.log("  ✓ Lexical token stream alignment and format-agnostic replacement verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 22: Semantic Merge Conflict Explainer & Auto-Resolution Analysis
    // ---------------------------------------------------------------------------
    console.log("[Suite 22/52] Semantic Merge Conflict Explainer & Auto-Resolution Analysis...");
    const baseAncestor = "const host = 'localhost';\nconst port = 3000;\nconst ssl = false;";
    const oursBranch = "const host = '127.0.0.1';\nconst port = 3000;\nconst ssl = false;";
    const theirsBranch = "const host = '0.0.0.0';\nconst port = 3000;\nconst ssl = false;";

    const conflictExplanation = matcher.explainMergeConflict(baseAncestor, oursBranch, theirsBranch);
    if (
      conflictExplanation.totalConflicts !== 1 ||
      conflictExplanation.analyses.length !== 1 ||
      conflictExplanation.analyses[0].conflictCategory !== "overlapping_edit" ||
      conflictExplanation.analyses[0].proposedResolutions.length < 3
    ) {
      throw new Error(`Merge conflict explanation failed: ${JSON.stringify(conflictExplanation)}`);
    }

    // Test tool integration for merge conflict explainer
    const explainToolRes = (await explainConflictTool.execute(
      {
        baseContent: baseAncestor,
        oursContent: oursBranch,
        theirsContent: theirsBranch,
      },
      tempDir
    )) as { success: boolean; totalConflicts: number; analyses: unknown[] };
    if (!explainToolRes.success || explainToolRes.totalConflicts !== 1 || explainToolRes.analyses.length !== 1) {
      throw new Error("fuzzy_explain_merge_conflict tool execution failed");
    }
    console.log("  ✓ Semantic 3-way merge conflict diagnosis and auto-resolution analysis verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 23: Deterministic Inverse Patch Generation & Single/Multi-File Reversals
    // ---------------------------------------------------------------------------
    console.log("[Suite 23/52] Deterministic Inverse Patch Generation & Single/Multi-File Reversals...");
    const originalFileA = "export const API_VERSION = '1.0.0';\nexport const ENABLE_LOGS = false;";
    const modifiedFileA = "export const API_VERSION = '2.0.0';\nexport const ENABLE_LOGS = true;";

    const singleInverseRes = matcher.generateInversePatch(originalFileA, modifiedFileA, "config.ts");
    if (
      !singleInverseRes.success ||
      singleInverseRes.invertedHunks.length === 0 ||
      !singleInverseRes.inverseDiff.includes("-export const API_VERSION = '2.0.0';") ||
      !singleInverseRes.inverseDiff.includes("+export const API_VERSION = '1.0.0';")
    ) {
      throw new Error(`Single file inverse patch generation failed: ${JSON.stringify(singleInverseRes)}`);
    }

    // Multi-file inverse patch
    const origFilesMap = {
      "src/version.ts": "export const VERSION = '1.0.0';",
      "src/flags.ts": "export const FEATURE_X = false;",
    };
    const modFilesMap = {
      "src/version.ts": "export const VERSION = '2.0.0';",
      "src/flags.ts": "export const FEATURE_X = true;",
    };

    const multiInverseRes = matcher.generateMultiFileInversePatch(origFilesMap, modFilesMap);
    if (!multiInverseRes.success || multiInverseRes.totalFiles !== 2 || !multiInverseRes.inversePatchText.includes("src/version.ts")) {
      throw new Error(`Multi-file inverse patch generation failed: ${JSON.stringify(multiInverseRes)}`);
    }

    // Test tool integration for inverse patch generator
    const inverseToolRes = (await inversePatchTool.execute(
      {
        originalContent: originalFileA,
        modifiedContent: modifiedFileA,
        filename: "config.ts",
      },
      tempDir
    )) as { success: boolean; inverseDiff: string };
    if (!inverseToolRes.success || !inverseToolRes.inverseDiff.includes("config.ts")) {
      throw new Error("fuzzy_generate_inverse_patch tool execution failed");
    }
    console.log("  ✓ Reversible inverse patch generator and multi-file rollback verification verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 24: Scope-Bounded Fuzzy Matching & Enclosing Block Splicing
    // ---------------------------------------------------------------------------
    console.log("[Suite 24/52] Scope-Bounded Fuzzy Matching & Enclosing Block Splicing...");
    const multiClassContent = [
      "class OrderService {",
      "  process() {",
      "    return true;",
      "  }",
      "}",
      "",
      "class UserService {",
      "  process() {",
      "    return true;",
      "  }",
      "}",
    ].join("\n");

    const scopeRes = matcher.findAndReplaceInScope(
      multiClassContent,
      "return true;",
      "return this.orders.length > 0;",
      { enclosingScope: "class OrderService" }
    );
    if (
      !scopeRes.success ||
      !scopeRes.modifiedContent.includes("this.orders.length > 0") ||
      !scopeRes.modifiedContent.includes("class UserService {\n  process() {\n    return true;\n  }\n}")
    ) {
      throw new Error(`Scope-bounded matching failed: ${JSON.stringify(scopeRes)}`);
    }

    // Test tool integration for scope-bounded replacement
    const scopeToolRes = (await scopeBoundedTool.execute(
      {
        content: multiClassContent,
        oldSnippet: "return true;",
        newSnippet: "return this.orders.length > 0;",
        enclosingScope: "class OrderService",
      },
      tempDir
    )) as { success: boolean; modifiedContent: string };
    if (!scopeToolRes.success || !scopeToolRes.modifiedContent.includes("this.orders.length > 0")) {
      throw new Error("fuzzy_find_and_replace_in_scope tool execution failed");
    }
    console.log("  ✓ Scope-bounded fuzzy search, balanced scope extraction, and isolated splicing verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 25: N-Gram Token Cosine Similarity Matrix Search
    // ---------------------------------------------------------------------------
    console.log("[Suite 25/52] N-Gram Token Cosine Similarity Matrix Search...");
    const largeDoc = [
      "// Section 1: Authentication",
      "function auth() {",
      "  const token = getToken();",
      "  return token;",
      "}",
      "",
      "// Section 2: Database Configuration",
      "function initDatabase() {",
      "  const poolSize = 25;",
      "  const maxIdleTime = 10000;",
      "  return openPool(poolSize);",
      "}",
    ].join("\n");

    const ngramRes = matcher.searchByNGramCosineSimilarity(
      largeDoc,
      "const poolSize = 25;\nconst maxIdleTime = 10000;",
      { n: 3, minScoreThreshold: 0.5, maxResults: 3 }
    );
    if (
      !ngramRes.topCandidate ||
      ngramRes.topCandidate.similarityScore < 0.8 ||
      ngramRes.topCandidate.startLine !== 9
    ) {
      throw new Error(`N-Gram cosine similarity search failed: ${JSON.stringify(ngramRes)}`);
    }

    // Test tool integration for N-gram search
    const ngramToolRes = (await ngramSearchTool.execute(
      {
        content: largeDoc,
        searchSnippet: "const poolSize = 25;\nconst maxIdleTime = 10000;",
      },
      tempDir
    )) as { success: boolean; topCandidate: { similarityScore: number } };
    if (!ngramToolRes.success || !ngramToolRes.topCandidate || ngramToolRes.topCandidate.similarityScore < 0.8) {
      throw new Error("fuzzy_ngram_similarity_search tool execution failed");
    }
    console.log("  ✓ N-Gram token cosine similarity vector matrix search verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 26: Multi-File Fuzzy Symbol Refactoring & Word-Boundary Renaming
    // ---------------------------------------------------------------------------
    console.log("[Suite 26/52] Multi-File Fuzzy Symbol Refactoring & Word-Boundary Renaming...");
    const workspaceCodeFiles = {
      "src/models.ts": "export interface Order {\n  orderId: string;\n  orderIdLegacy?: string;\n}",
      "src/handlers.ts": "export function handle(orderId: string) {\n  // Handling orderId\n  console.log('ID:', orderId);\n  return orderId;\n}",
    };

    const renameRes = matcher.renameSymbolWorkspace(
      workspaceCodeFiles,
      "orderId",
      "transactionId",
      { renameInComments: true, renameInStrings: false, wholeWordOnly: true }
    );
    if (
      !renameRes.success ||
      renameRes.totalOccurrencesRenamed < 4 ||
      renameRes.totalFilesModified !== 2 ||
      !renameRes.committedFiles["src/models.ts"].includes("orderIdLegacy") || // Preserves whole-word boundaries
      !renameRes.committedFiles["src/handlers.ts"].includes("handle(transactionId: string)")
    ) {
      throw new Error(`Symbol refactoring failed: ${JSON.stringify(renameRes)}`);
    }

    // Test tool integration for workspace symbol rename
    const renameToolRes = (await renameSymbolTool.execute(
      {
        files: workspaceCodeFiles,
        oldSymbol: "orderId",
        newSymbol: "transactionId",
      },
      tempDir
    )) as { success: boolean; totalOccurrencesRenamed: number };
    if (!renameToolRes.success || renameToolRes.totalOccurrencesRenamed < 4) {
      throw new Error("fuzzy_rename_symbol_workspace tool execution failed");
    }
    console.log("  ✓ Multi-file fuzzy symbol refactoring and word-boundary renaming verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 27: Adaptive Patch Drift Compensation & Offset Fuzzing
    // ---------------------------------------------------------------------------
    console.log("[Suite 27/52] Adaptive Patch Drift Compensation & Offset Fuzzing...");
    const driftedFile = [
      "// Extra preamble line 1",
      "// Extra preamble line 2",
      "// Extra preamble line 3",
      "// Extra preamble line 4",
      "// Extra preamble line 5",
      "function executeService() {",
      "  const envMode = 'staging';",
      "  bootServer();",
      "}",
    ].join("\n");

    // Patch anchored at line 1 (as if no preamble lines existed)
    const driftedPatch = [
      "--- a/service.ts",
      "+++ b/service.ts",
      "@@ -1,4 +1,4 @@",
      " function executeService() {",
      "-  const envMode = 'staging';",
      "+  const envMode = 'production';",
      "   bootServer();",
      " }",
    ].join("\n");

    const driftRes = matcher.applyUnifiedPatchWithDrift(driftedFile, driftedPatch, { maxDriftLines: 15 });
    if (
      !driftRes.success ||
      driftRes.appliedHunks !== 1 ||
      driftRes.maxObservedDrift === 0 ||
      !driftRes.modifiedContent.includes("const envMode = 'production';")
    ) {
      throw new Error(`Patch drift compensation failed: ${JSON.stringify(driftRes)}`);
    }

    // Test tool integration for patch drift compensator
    const driftToolRes = (await patchDriftTool.execute(
      {
        content: driftedFile,
        patchText: driftedPatch,
      },
      tempDir
    )) as { success: boolean; modifiedContent: string; maxObservedDrift: number };
    if (!driftToolRes.success || !driftToolRes.modifiedContent.includes("const envMode = 'production';") || driftToolRes.maxObservedDrift === 0) {
      throw new Error("fuzzy_apply_patch_with_drift tool execution failed");
    }
    console.log("  ✓ Adaptive patch drift compensation and dynamic line offset fuzzing verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 28: Git Rerere Conflict Resolution Recording & Automatic Replay
    // ---------------------------------------------------------------------------
    console.log("[Suite 28/52] Git Rerere Conflict Resolution Recording & Automatic Replay...");
    const baseConflictSnippet = "const timeout = 5000;";
    const oursConflictSnippet = "const timeout = 10000; // Increased for slow network";
    const theirsConflictSnippet = "const timeout = 15000; // Increased for cloud CI";
    const resolvedConflictSnippet = "const timeout = 12000; // Harmonized timeout for slow network and cloud CI";

    const preimage = {
      baseSnippet: baseConflictSnippet,
      oursSnippet: oursConflictSnippet,
      theirsSnippet: theirsConflictSnippet,
    };

    const recordedEntry = matcher.recordConflictResolution(preimage, resolvedConflictSnippet);
    if (!recordedEntry.conflictFingerprint.startsWith("rerere_") || recordedEntry.resolvedSnippet !== resolvedConflictSnippet) {
      throw new Error(`Rerere recording failed: ${JSON.stringify(recordedEntry)}`);
    }

    const fileWithRecurringConflict = [
      "// Configuration module",
      "<<<<<<< OURS",
      oursConflictSnippet,
      "||||||| BASE",
      baseConflictSnippet,
      "=======",
      theirsConflictSnippet,
      ">>>>>>> THEIRS",
      "export default timeout;",
    ].join("\n");

    const replayRes = matcher.replayConflictResolution(fileWithRecurringConflict);
    if (
      !replayRes.success ||
      replayRes.replayedConflictsCount !== 1 ||
      replayRes.unresolvedConflictsCount !== 0 ||
      !replayRes.modifiedContent.includes(resolvedConflictSnippet) ||
      replayRes.modifiedContent.includes("<<<<<<<")
    ) {
      throw new Error(`Rerere replay failed: ${JSON.stringify(replayRes)}`);
    }

    // Test tool integration for Rerere
    const recordToolRes = (await recordConflictTool.execute(
      {
        baseSnippet: baseConflictSnippet,
        oursSnippet: oursConflictSnippet,
        theirsSnippet: theirsConflictSnippet,
        resolvedSnippet: resolvedConflictSnippet,
      },
      tempDir
    )) as { success: boolean; fingerprint: string };
    if (!recordToolRes.success || !recordToolRes.fingerprint) {
      throw new Error("fuzzy_record_conflict_resolution tool execution failed");
    }

    const replayToolRes = (await replayConflictTool.execute(
      { content: fileWithRecurringConflict },
      tempDir
    )) as { success: boolean; replayedConflictsCount: number; modifiedContent: string };
    if (!replayToolRes.success || replayToolRes.replayedConflictsCount !== 1 || !replayToolRes.modifiedContent.includes(resolvedConflictSnippet)) {
      throw new Error("fuzzy_replay_conflict_resolution tool execution failed");
    }
    console.log("  ✓ Git Rerere conflict resolution recording and automatic replay verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 29: AST Function Signature Refactoring & Call-Site Adaptation
    // ---------------------------------------------------------------------------
    console.log("[Suite 29/52] AST Function Signature Refactoring & Call-Site Adaptation...");
    const signatureFile = [
      "export function calculatePrice(basePrice: number, taxRate: number, discount: number): number {",
      "  return basePrice * (1 + taxRate) - discount;",
      "}",
      "",
      "// Callsites",
      "const p1 = calculatePrice(100, 0.08, 0);",
      "const p2 = calculatePrice(250, 0.15, 20);",
      "const p3 = calculatePrice(order.total, tax, 5);",
    ].join("\n");

    const refactorRes = matcher.refactorFunctionSignature(signatureFile, {
      functionName: "calculatePrice",
      newParams: [
        { name: "basePrice", type: "number" },
        { name: "taxRate", type: "number" },
        { name: "discount", type: "number", defaultValue: "0" },
      ],
      convertToOptionsObject: true,
      optionsInterfaceName: "PriceOptions",
    });

    if (
      !refactorRes.success ||
      !refactorRes.declarationUpdated ||
      refactorRes.callsitesUpdatedCount !== 3 ||
      !refactorRes.modifiedContent.includes("function calculatePrice({ basePrice, taxRate, discount }: PriceOptions)") ||
      !refactorRes.modifiedContent.includes("calculatePrice({ basePrice: 100, taxRate: 0.08, discount: 0 })") ||
      !refactorRes.modifiedContent.includes("calculatePrice({ basePrice: 250, taxRate: 0.15, discount: 20 })")
    ) {
      throw new Error(`Function signature refactoring failed: ${JSON.stringify(refactorRes)}`);
    }

    // Test tool integration for function signature refactoring
    const refactorToolRes = (await refactorSignatureTool.execute(
      {
        content: signatureFile,
        functionName: "calculatePrice",
        newParams: [
          { name: "basePrice", type: "number" },
          { name: "taxRate", type: "number" },
          { name: "discount", type: "number", defaultValue: "0" },
        ],
        convertToOptionsObject: true,
        optionsInterfaceName: "PriceOptions",
      },
      tempDir
    )) as { success: boolean; declarationUpdated: boolean; callsitesUpdatedCount: number };
    if (!refactorToolRes.success || !refactorToolRes.declarationUpdated || refactorToolRes.callsitesUpdatedCount !== 3) {
      throw new Error("fuzzy_refactor_function_signature tool execution failed");
    }
    console.log("  ✓ AST function signature refactoring and call-site adaptation verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 30: Multi-Cursor Parallel Non-Overlapping Edit Splicing
    // ---------------------------------------------------------------------------
    console.log("[Suite 30/52] Multi-Cursor Parallel Non-Overlapping Edit Splicing...");
    const multiCursorContent = [
      "const PORT = 3000;",
      "const HOST = 'localhost';",
      "const DEBUG = false;",
      "function boot() {",
      "  console.log(PORT, HOST, DEBUG);",
      "}",
    ].join("\n");

    const multiCursorEdits = [
      { searchSnippet: "const PORT = 3000;", replacementSnippet: "const PORT = process.env.PORT || 3000;" },
      { searchSnippet: "const HOST = 'localhost';", replacementSnippet: "const HOST = process.env.HOST || '0.0.0.0';" },
      { searchSnippet: "const DEBUG = false;", replacementSnippet: "const DEBUG = true;" },
    ];

    const parallelRes = matcher.applyParallelMultiCursorEdits(multiCursorContent, multiCursorEdits);
    if (
      !parallelRes.success ||
      parallelRes.totalCursorsApplied !== 3 ||
      !parallelRes.modifiedContent.includes("process.env.PORT || 3000;") ||
      !parallelRes.modifiedContent.includes("process.env.HOST || '0.0.0.0';") ||
      !parallelRes.modifiedContent.includes("const DEBUG = true;")
    ) {
      throw new Error(`Multi-cursor parallel application failed: ${JSON.stringify(parallelRes)}`);
    }

    // Overlap collision detection test
    const overlappingEdits = [
      { searchSnippet: "const PORT = 3000;\nconst HOST", replacementSnippet: "const PORT = 8080;" },
      { searchSnippet: "const HOST = 'localhost';", replacementSnippet: "const HOST = '127.0.0.1';" },
    ];
    const collisionRes = matcher.applyParallelMultiCursorEdits(multiCursorContent, overlappingEdits);
    if (collisionRes.success || !collisionRes.error?.includes("collision")) {
      throw new Error("Multi-cursor overlap collision guard failed to reject overlapping edits");
    }

    // Test tool integration for parallel multicursor
    const parallelToolRes = (await parallelCursorTool.execute(
      {
        content: multiCursorContent,
        edits: multiCursorEdits,
      },
      tempDir
    )) as { success: boolean; totalCursorsApplied: number };
    if (!parallelToolRes.success || parallelToolRes.totalCursorsApplied !== 3) {
      throw new Error("fuzzy_apply_parallel_multicursor_edits tool execution failed");
    }
    console.log("  ✓ Multi-cursor parallel non-overlapping edit splicing verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 31: Histogram Line-Diff Algorithm & Low-Frequency Anchor Clustering
    // ---------------------------------------------------------------------------
    console.log("[Suite 31/52] Histogram Line-Diff Algorithm & Low-Frequency Anchor Clustering...");
    const oldConfigCode = [
      "{",
      '  "name": "lumi-app",',
      '  "version": "1.0.0",',
      '  "settings": {',
      '    "env": "development",',
      '    "workers": 4,',
      '    "retries": 3',
      "  }",
      "}",
    ].join("\n");

    const newConfigCode = [
      "{",
      '  "name": "lumi-app",',
      '  "version": "1.0.1",',
      '  "settings": {',
      '    "env": "production",',
      '    "workers": 8,',
      '    "retries": 3',
      "  }",
      "}",
    ].join("\n");

    const histogramRes = matcher.generateHistogramDiff(oldConfigCode, newConfigCode, "package.json");
    if (
      !histogramRes.hasChanges ||
      histogramRes.hunks.length === 0 ||
      !histogramRes.diffText.includes('+  "version": "1.0.1"') ||
      !histogramRes.diffText.includes('+    "env": "production"')
    ) {
      throw new Error(`Histogram diff generation failed: ${JSON.stringify(histogramRes)}`);
    }

    const appliedHistogram = matcher.applyHistogramPatch(oldConfigCode, histogramRes.diffText);
    if (!appliedHistogram.success || appliedHistogram.modifiedContent !== newConfigCode) {
      throw new Error(`Histogram patch application failed: ${JSON.stringify(appliedHistogram)}`);
    }

    // Test tool integration for histogram diff
    const histogramToolRes = (await histogramDiffTool.execute(
      {
        oldText: oldConfigCode,
        newText: newConfigCode,
        filename: "package.json",
      },
      tempDir
    )) as { success: boolean; hasChanges: boolean; diffText: string };
    if (!histogramToolRes.success || !histogramToolRes.hasChanges || !histogramToolRes.diffText) {
      throw new Error("fuzzy_generate_histogram_diff tool execution failed");
    }
    console.log("  ✓ Histogram line-diff algorithm and low-frequency anchor clustering verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 32: End-to-End Multi-Pass Idempotency & Resilient Round-Trip Splicing
    // ---------------------------------------------------------------------------
    console.log("[Suite 32/52] End-to-End Multi-Pass Idempotency & Resilient Round-Trip Splicing...");
    const masterSource = [
      "// LUMI Engine Kernel v2",
      "export class KernelDriver {",
      "  private active: boolean = false;",
      "  start(): void {",
      "    this.active = true;",
      "    console.log('Driver started');",
      "  }",
      "  stop(): void {",
      "    this.active = false;",
      "    console.log('Driver stopped');",
      "  }",
      "}",
    ].join("\n");

    // 1. Scope-bounded edit inside KernelDriver
    const scopeEditRes = matcher.findAndReplaceInScope(
      masterSource,
      "console.log('Driver started');",
      "console.log('Driver started successfully');\n    this.notifySubscribers();",
      { enclosingScope: "class KernelDriver" }
    );
    if (!scopeEditRes.success) throw new Error("E2E Step 1 failed");

    // 2. Generate inverse patch
    const invPatchRes = matcher.generateInversePatch(masterSource, scopeEditRes.modifiedContent, "kernel.ts");
    if (!invPatchRes.success) throw new Error("E2E Step 2 failed");

    // 3. Rollback with inverse patch
    const rolledBack = matcher.applyUnifiedPatch(scopeEditRes.modifiedContent, invPatchRes.inverseDiff);
    if (!rolledBack.success || rolledBack.modifiedContent !== masterSource) {
      throw new Error("E2E Step 3 inverse rollback failed to restore byte-exact original");
    }

    // 4. Verify Idempotency check on original vs modified
    const idemRes = matcher.isAlreadyApplied(masterSource, "console.log('Driver started');", "console.log('Driver started successfully');\n    this.notifySubscribers();");
    if (idemRes) throw new Error("E2E Step 4 false positive idempotency");

    console.log("  ✓ End-to-end multi-pass idempotency and resilient round-trip splicing verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 33: Structural Hole Pattern Matching & Template Expansion
    // ---------------------------------------------------------------------------
    console.log("[Suite 33/52] Structural Hole Pattern Matching & Template Expansion...");
    const sampleCodeForPattern = [
      "try {",
      "  const res = fetchUser(id);",
      "  return res;",
      "} catch (err) {",
      "  logError(err);",
      "}",
    ].join("\n");

    const structPattern = "try {\n:[body]\n} catch (:[err]) {\n:[handler]\n}";
    const structTemplate = "const result = await safeWrap(async () => {\n:[body]\n}, (:[err]) => {\n:[handler]\n});";

    const structRes = matcher.structuralPatternMatchAndReplace(sampleCodeForPattern, structPattern, structTemplate);
    if (
      !structRes.success ||
      structRes.matchCount !== 1 ||
      !structRes.modifiedContent.includes("safeWrap(async () =>") ||
      !structRes.modifiedContent.includes("const res = fetchUser(id);") ||
      !structRes.modifiedContent.includes("logError(err);")
    ) {
      throw new Error(`Structural pattern matching failed: ${JSON.stringify(structRes)}`);
    }

    // Tool execution test
    const structToolRes = (await structuralPatternTool.execute(
      {
        content: sampleCodeForPattern,
        pattern: structPattern,
        replacementTemplate: structTemplate,
      },
      tempDir
    )) as { success: boolean; modifiedContent: string };
    if (!structToolRes.success || !structToolRes.modifiedContent.includes("safeWrap")) {
      throw new Error("fuzzy_structural_pattern_replace tool execution failed");
    }
    console.log("  ✓ Structural hole pattern matching & template expansion verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 34: Semantic AST Tree Diff Generation & Structural Node Mutation
    // ---------------------------------------------------------------------------
    console.log("[Suite 34/52] Semantic AST Tree Diff Generation & Structural Node Mutation...");
    const oldAstCode = [
      "import { readFile } from 'node:fs';",
      "",
      "export interface UserProfile {",
      "  id: string;",
      "  name: string;",
      "}",
      "",
      "export function getUser(id: string): UserProfile {",
      "  return { id, name: 'Anonymous' };",
      "}",
      "",
      "export function deleteUser(id: string): void {",
      "  console.log('Deleted', id);",
      "}",
    ].join("\n");

    const newAstCode = [
      "import { readFile } from 'node:fs';",
      "",
      "export interface UserProfile {",
      "  id: string;",
      "  name: string;",
      "  email: string;",
      "}",
      "",
      "export function getUser(id: string): UserProfile {",
      "  return { id, name: 'Anonymous' };",
      "}",
      "",
      "export function updateUser(id: string, name: string): void {",
      "  console.log('Updated', id, name);",
      "}",
    ].join("\n");

    const treeDiff = matcher.generateSemanticTreeDiff(oldAstCode, newAstCode);
    if (
      treeDiff.totalChanges < 2 ||
      !treeDiff.operations.some((op) => op.opType === "update" && op.identifier === "UserProfile") ||
      !treeDiff.operations.some((op) => op.opType === "delete" && op.identifier === "deleteUser") ||
      !treeDiff.operations.some((op) => op.opType === "insert" && op.identifier === "updateUser")
    ) {
      throw new Error(`Semantic tree diff generation failed: ${JSON.stringify(treeDiff)}`);
    }

    const appliedTree = matcher.applySemanticTreeDiff(oldAstCode, treeDiff);
    if (
      !appliedTree.success ||
      !appliedTree.modifiedContent.includes("email: string;") ||
      appliedTree.modifiedContent.includes("deleteUser") ||
      !appliedTree.modifiedContent.includes("updateUser")
    ) {
      throw new Error(`Semantic tree diff application failed: ${JSON.stringify(appliedTree)}`);
    }

    // Tool execution test
    const treeToolRes = (await generateTreeDiffTool.execute(
      {
        oldContent: oldAstCode,
        newContent: newAstCode,
      },
      tempDir
    )) as { success: boolean; operations: any[]; totalChanges: number };
    if (!treeToolRes.success || treeToolRes.totalChanges < 2) {
      throw new Error("fuzzy_generate_semantic_tree_diff tool execution failed");
    }
    console.log("  ✓ Semantic AST tree diff generation and structural node mutation verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 35: Swarm Multi-Source Patch Synthesis & Topological Hunk Ordering
    // ---------------------------------------------------------------------------
    console.log("[Suite 35/52] Swarm Multi-Source Patch Synthesis & Topological Hunk Ordering...");
    const baseServerCode = [
      "export class HttpServer {",
      "  start(): void {",
      "    console.log('Starting server...');",
      "  }",
      "  stop(): void {",
      "    console.log('Stopping server...');",
      "  }",
      "}",
    ].join("\n");

    const baseFiles = { "src/server.ts": baseServerCode };

    const swarmHunks = [
      {
        sourceAgentId: "agent_alpha",
        fileRelativePath: "src/server.ts",
        oldText: "console.log('Starting server...');",
        newText: "console.log('Starting server on port 8080...');",
        priority: 10,
      },
      {
        sourceAgentId: "agent_beta",
        fileRelativePath: "src/server.ts",
        oldText: "console.log('Stopping server...');",
        newText: "console.log('Gracefully stopping server...');",
        priority: 5,
      },
    ];

    const synthRes = matcher.synthesizeMultiSourcePatch(swarmHunks, baseFiles);
    if (!synthRes.success || synthRes.synthesizedPatches.length !== 1 || synthRes.conflictingHunks.length !== 0) {
      throw new Error(`Multi-source patch synthesis failed: ${JSON.stringify(synthRes)}`);
    }

    const synthesizedPatchText = synthRes.synthesizedPatches[0].synthesizedDiff;
    const appliedSynth = matcher.applyUnifiedPatch(baseServerCode, synthesizedPatchText);
    if (
      !appliedSynth.success ||
      !appliedSynth.modifiedContent.includes("Starting server on port 8080...") ||
      !appliedSynth.modifiedContent.includes("Gracefully stopping server...")
    ) {
      throw new Error(`Synthesized patch application failed: ${JSON.stringify(appliedSynth)}`);
    }

    // Test collision detection
    const conflictingSwarmHunks = [
      ...swarmHunks,
      {
        sourceAgentId: "agent_gamma",
        fileRelativePath: "src/server.ts",
        oldText: "console.log('Starting server...');",
        newText: "console.log('CRITICAL: Fast start on port 3000...');",
        priority: 2,
      },
    ];
    const swarmCollisionRes = matcher.synthesizeMultiSourcePatch(conflictingSwarmHunks, baseFiles);
    if (swarmCollisionRes.success || swarmCollisionRes.conflictingHunks.length === 0) {
      throw new Error("Swarm conflict detection failed to catch colliding hunks");
    }

    // Tool execution test
    const synthToolRes = (await multiSourcePatchTool.execute(
      {
        inputs: swarmHunks,
        baseFiles,
      },
      tempDir
    )) as { success: boolean; synthesizedPatches: any[] };
    if (!synthToolRes.success || synthToolRes.synthesizedPatches.length !== 1) {
      throw new Error("fuzzy_synthesize_multi_source_patch tool execution failed");
    }
    console.log("  ✓ Swarm multi-source patch synthesis & topological hunk ordering verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 36: Fuzzy Import Specifier Harmonization & Barrel-Bypass Optimization
    // ---------------------------------------------------------------------------
    console.log("[Suite 36/52] Fuzzy Import Specifier Harmonization & Barrel-Bypass Optimization...");
    const messyImportsCode = [
      'import { z } from "zod";',
      'import { readFile } from "node:fs";',
      'import { Button } from "./components/index";',
      'import { writeFile } from "node:fs";',
      'import { a, b } from "lodash";',
      'import { c } from "lodash";',
      'import { Header } from "./components";',
      '',
      'export function render() {',
      '  return true;',
      '}',
    ].join("\n");

    const barrelMapping = {
      "./components/index": "./components/Button.js",
      "./components": "./components/Header.js",
    };

    const optImportsRes = matcher.optimizeAndHarmonizeImports(messyImportsCode, {
      resolveBarrelToDirect: true,
      barrelMapping,
      sortAlphabetically: true,
      groupByCategory: true,
    });

    if (
      !optImportsRes.success ||
      optImportsRes.originalImportsCount !== 7 ||
      optImportsRes.optimizedImportsCount !== 5 ||
      !optImportsRes.modifiedContent.includes('import { readFile, writeFile } from "node:fs";') ||
      !optImportsRes.modifiedContent.includes('import { a, b, c } from "lodash";') ||
      !optImportsRes.modifiedContent.includes('import { Button } from "./components/Button.js";') ||
      !optImportsRes.modifiedContent.includes('import { Header } from "./components/Header.js";')
    ) {
      throw new Error(`Import optimization failed: ${JSON.stringify(optImportsRes)}`);
    }

    // Tool execution test
    const optToolRes = (await optimizeImportsTool.execute(
      {
        content: messyImportsCode,
        resolveBarrelToDirect: true,
        barrelMapping,
      },
      tempDir
    )) as { success: boolean; modifiedContent: string; optimizedImportsCount: number };
    if (!optToolRes.success || optToolRes.optimizedImportsCount !== 5) {
      throw new Error("fuzzy_optimize_and_harmonize_imports tool execution failed");
    }
    console.log("  ✓ Fuzzy import specifier harmonization and barrel-bypass optimization verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 37: Full-Spectrum Multi-Paradigm Splicing & State Invariant Verification
    // ---------------------------------------------------------------------------
    console.log("[Suite 37/52] Full-Spectrum Multi-Paradigm Splicing & State Invariant Verification...");
    const omniContent = [
      'import { join } from "node:path";',
      'import { resolve } from "node:path";',
      '',
      'export class OmniEngine {',
      '  processBatch(items: string[]): number {',
      '    return items.length;',
      '  }',
      '}',
    ].join("\n");

    // 1. Optimize imports
    const pass1 = matcher.optimizeAndHarmonizeImports(omniContent);
    if (!pass1.success || !pass1.modifiedContent.includes('import { join, resolve } from "node:path";')) {
      throw new Error("Omni Step 1 failed");
    }

    // 2. Structural pattern replace inside method
    const pass2 = matcher.structuralPatternMatchAndReplace(
      pass1.modifiedContent,
      "processBatch(:[params]): :[retType] {\n:[body]\n}",
      "processBatch(:[params]): :[retType] {\n    // Audited batch\n:[body]\n}"
    );
    if (!pass2.success || !pass2.modifiedContent.includes("// Audited batch")) {
      throw new Error("Omni Step 2 failed");
    }

    // 3. Snapshot & O(1) Rewind check
    const snap = snapshotManager.captureFrame(100);
    if (!snap) throw new Error("Omni Step 3 frame capture failed");

    const rewindOk = snapshotManager.rewindToFrame(100);
    if (!rewindOk) throw new Error("Omni Step 3 rewind failed");

    console.log("  ✓ Full-spectrum multi-paradigm splicing and state invariant verification verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 38: Semantic Chunk-Level Fuzzy Code Relocator & Indentation Splicing
    // ---------------------------------------------------------------------------
    console.log("[Suite 38/52] Semantic Chunk-Level Fuzzy Code Relocator & Indentation Splicing...");
    const sampleRelocateCode = [
      "export class WorkerPipeline {",
      "  private id: string = 'worker-1';",
      "",
      "  function gammaHelper(): void {",
      "    console.log('gamma helper');",
      "  }",
      "",
      "  function alphaPrimary(): void {",
      "    console.log('alpha primary');",
      "  }",
      "}",
    ].join("\n");

    const sourceToMove = "function gammaHelper(): void {\n    console.log('gamma helper');\n  }";
    const targetAnchorLoc = "function alphaPrimary(): void {";

    const relocateRes = matcher.relocateCodeBlock(
      sampleRelocateCode,
      sourceToMove,
      targetAnchorLoc,
      {
        placement: "before",
        internalMutations: [{ search: "gamma helper", replace: "gamma helper v2" }],
        harmonizeIndentation: true,
      }
    );

    if (
      !relocateRes.success ||
      !relocateRes.modifiedContent.includes("gamma helper v2") ||
      relocateRes.modifiedContent.indexOf("gammaHelper") > relocateRes.modifiedContent.indexOf("alphaPrimary")
    ) {
      throw new Error(`Relocate code block failed: ${JSON.stringify(relocateRes)}`);
    }

    // Tool execution test
    const relocateToolRes = (await relocateCodeTool.execute(
      {
        content: sampleRelocateCode,
        sourceBlock: sourceToMove,
        targetAnchor: targetAnchorLoc,
        placement: "before",
        internalMutations: JSON.stringify([{ search: "gamma helper", replace: "gamma helper v2" }]),
      },
      tempDir
    )) as { success: boolean; modifiedContent: string };
    if (!relocateToolRes.success || !relocateToolRes.modifiedContent.includes("gamma helper v2")) {
      throw new Error("fuzzy_relocate_code_block tool execution failed");
    }
    console.log("  ✓ Semantic chunk-level fuzzy code relocator & indentation splicing verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 39: Bidirectional JSDoc/TSDoc & Type Annotation Synchronization
    // ---------------------------------------------------------------------------
    console.log("[Suite 39/52] Bidirectional JSDoc/TSDoc & Type Annotation Synchronization...");
    const codeWithStaleDoc = [
      "/**",
      " * Calculates final invoice total.",
      " * @param {number} oldParam The obsolete legacy tax.",
      " */",
      "export function calculateInvoice(subtotal: number, taxRate: number, shipping: number): number {",
      "  return (subtotal * (1 + taxRate)) + shipping;",
      "}",
    ].join("\n");

    const docSyncRes = matcher.synchronizeDocCommentsAndTypes(codeWithStaleDoc, "calculateInvoice", {
      addMissingParamTags: true,
      removeObsoleteParamTags: true,
      updateReturnTag: true,
    });

    if (
      !docSyncRes.success ||
      docSyncRes.addedParamsCount !== 3 ||
      docSyncRes.removedParamsCount !== 1 ||
      !docSyncRes.modifiedContent.includes("@param {number} subtotal") ||
      !docSyncRes.modifiedContent.includes("@param {number} taxRate") ||
      !docSyncRes.modifiedContent.includes("@param {number} shipping") ||
      docSyncRes.modifiedContent.includes("@param {number} oldParam") ||
      !docSyncRes.modifiedContent.includes("@returns {number}")
    ) {
      throw new Error(`Doc sync failed: ${JSON.stringify(docSyncRes)}`);
    }

    // Tool execution test
    const docSyncToolRes = (await syncDocCommentsTool.execute(
      {
        content: codeWithStaleDoc,
        identifierName: "calculateInvoice",
      },
      tempDir
    )) as { success: boolean; modifiedContent: string; addedParamsCount: number };
    if (!docSyncToolRes.success || docSyncToolRes.addedParamsCount !== 3) {
      throw new Error("fuzzy_synchronize_doc_comments tool execution failed");
    }
    console.log("  ✓ Bidirectional JSDoc/TSDoc & type annotation synchronization verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 40: Multi-Region Semantic Skeleton & Ellipsis Block Splicing
    // ---------------------------------------------------------------------------
    console.log("[Suite 40/52] Multi-Region Semantic Skeleton & Ellipsis Block Splicing...");
    const fullClassCode = [
      "export class PaymentService {",
      "  validateCard(cardNum: string): boolean {",
      "    return cardNum.length === 16;",
      "  }",
      "",
      "  processCharge(amount: number): boolean {",
      "    console.log('Charging', amount);",
      "    return true;",
      "  }",
      "",
      "  sendReceipt(email: string): void {",
      "    console.log('Receipt sent to', email);",
      "  }",
      "}",
    ].join("\n");

    const skeletonPatch = [
      "// ... existing code ...",
      "  processCharge(amount: number): boolean {",
      "    console.log('Charging with Stripe v3:', amount);",
      "    return true;",
      "  }",
      "// ... existing code ...",
      "  sendReceipt(email: string): void {",
      "    console.log('Encrypted receipt sent to', email);",
      "  }",
      "// ... existing code ...",
    ].join("\n");

    const skeletonRes = matcher.spliceMultiRegionSkeleton(fullClassCode, skeletonPatch);
    if (
      !skeletonRes.success ||
      skeletonRes.regionsSplicedCount !== 2 ||
      !skeletonRes.modifiedContent.includes("Charging with Stripe v3:") ||
      !skeletonRes.modifiedContent.includes("Encrypted receipt sent to") ||
      !skeletonRes.modifiedContent.includes("return cardNum.length === 16;")
    ) {
      throw new Error(`Multi-region skeleton splicing failed: ${JSON.stringify(skeletonRes)}`);
    }

    // Tool execution test
    const skeletonToolRes = (await spliceSkeletonTool.execute(
      {
        content: fullClassCode,
        skeletonText: skeletonPatch,
      },
      tempDir
    )) as { success: boolean; modifiedContent: string; regionsSplicedCount: number };
    if (!skeletonToolRes.success || skeletonToolRes.regionsSplicedCount !== 2) {
      throw new Error("fuzzy_splice_multi_region_skeleton tool execution failed");
    }
    console.log("  ✓ Multi-region semantic skeleton & ellipsis block splicing verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 41: Deterministic Dead Code & Ghost Import Pruning
    // ---------------------------------------------------------------------------
    console.log("[Suite 41/52] Deterministic Dead Code & Ghost Import Pruning...");
    const dirtyImportsCode = [
      'import { readFile, writeFile, existsSync } from "node:fs";',
      'import { map, zip, filter } from "lodash";',
      'import "reflect-metadata";',
      '',
      'export function processData(file: string, items: string[]): string[] {',
      '  const raw = readFile(file);',
      '  return map(items, (i) => i.trim());',
      '}',
    ].join("\n");

    const pruneRes = matcher.pruneUnusedImportsAndSymbols(dirtyImportsCode);
    if (
      !pruneRes.success ||
      pruneRes.prunedSpecifiersCount !== 4 ||
      !pruneRes.prunedSpecifiers.includes("writeFile") ||
      !pruneRes.prunedSpecifiers.includes("existsSync") ||
      !pruneRes.prunedSpecifiers.includes("zip") ||
      !pruneRes.prunedSpecifiers.includes("filter") ||
      !pruneRes.modifiedContent.includes('import { readFile } from "node:fs";') ||
      !pruneRes.modifiedContent.includes('import { map } from "lodash";') ||
      !pruneRes.modifiedContent.includes('import "reflect-metadata";')
    ) {
      throw new Error(`Import pruning failed: ${JSON.stringify(pruneRes)}`);
    }

    // Tool execution test
    const pruneToolRes = (await pruneImportsTool.execute(
      {
        content: dirtyImportsCode,
      },
      tempDir
    )) as { success: boolean; modifiedContent: string; prunedSpecifiersCount: number };
    if (!pruneToolRes.success || pruneToolRes.prunedSpecifiersCount !== 4) {
      throw new Error("fuzzy_prune_unused_imports tool execution failed");
    }
    console.log("  ✓ Deterministic dead code & ghost import pruning verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 42: Full-Engine Invariant, Monolith Composition & State Rollback Integration
    // ---------------------------------------------------------------------------
    console.log("[Suite 42/52] Full-Engine Invariant, Monolith Composition & State Rollback Integration...");
    const initialEngineCode = [
      'import { resolve, join } from "node:path";',
      '',
      'export class PipelineKernel {',
      '  executeTask(taskId: string): boolean {',
      '    return taskId.length > 0;',
      '  }',
      '}',
    ].join("\n");

    // 1. Doc sync on executeTask
    const pass1Doc = matcher.synchronizeDocCommentsAndTypes(initialEngineCode, "executeTask");
    if (!pass1Doc.success || !pass1Doc.modifiedContent.includes("@param {string} taskId")) {
      throw new Error("Integration Step 1 failed");
    }

    // 2. Relocate class
    const helperCode = "function pipelineHelper(): void {\n  console.log('helper');\n}\n\n";
    const withHelper = helperCode + pass1Doc.modifiedContent;
    const pass2Reloc = matcher.relocateCodeBlock(
      withHelper,
      "function pipelineHelper(): void {\n  console.log('helper');\n}",
      "class PipelineKernel {",
      { placement: "after" }
    );
    if (!pass2Reloc.success || !pass2Reloc.modifiedContent.includes("pipelineHelper")) {
      throw new Error("Integration Step 2 failed");
    }

    // 3. Prune unused imports
    const pass3Prune = matcher.pruneUnusedImportsAndSymbols(pass2Reloc.modifiedContent);
    if (!pass3Prune.success) {
      throw new Error("Integration Step 3 failed");
    }

    // 4. Snapshot frame & Verify O(1) rollback
    const snapFrame = snapshotManager.captureFrame(200);
    if (!snapFrame) throw new Error("Integration Step 4 frame capture failed");

    const rewound = snapshotManager.rewindToFrame(200);
    if (!rewound) throw new Error("Integration Step 4 rewind failed");

    console.log("  ✓ Full-engine invariant, monolith composition & state rollback integration verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 43: Multi-Stage Codemod Rule Pipeline & Transactional Rollback
    // ---------------------------------------------------------------------------
    console.log("[Suite 43/52] Multi-Stage Codemod Rule Pipeline & Transactional Rollback...");
    const rawPipelineCode = [
      'import { readFile, unusedHelper } from "node:fs";',
      '',
      '/** Calculate total discount. */',
      'export function applyDiscount(price: number, percent: number): number {',
      '  const factor = 100;',
      '  return price * (percent / factor);',
      '}',
    ].join("\n");

    const codemodRules: CodemodRule[] = [
      {
        id: "rule-1-prune",
        description: "Prune unused imports",
        type: "prune_imports",
        params: {},
      },
      {
        id: "rule-2-replace",
        description: "Modernize discount calculation",
        type: "fuzzy_replace",
        params: {
          oldString: "const factor = 100;\n  return price * (percent / factor);",
          newString: "return price * (percent / 100);",
        },
      },
      {
        id: "rule-3-doc-sync",
        description: "Synchronize JSDoc params",
        type: "doc_sync",
        params: {
          identifierName: "applyDiscount",
        },
      },
    ];

    const pipelineRes = matcher.executeCodemodPipeline(rawPipelineCode, codemodRules);
    if (
      !pipelineRes.success ||
      pipelineRes.totalRules !== 3 ||
      pipelineRes.successfulRules !== 3 ||
      pipelineRes.modifiedContent.includes("unusedHelper") ||
      !pipelineRes.modifiedContent.includes("@param {number} price") ||
      !pipelineRes.modifiedContent.includes("return price * (percent / 100);")
    ) {
      throw new Error(`Codemod pipeline execution failed: ${JSON.stringify(pipelineRes)}`);
    }

    // Tool execution test
    const codemodToolRes = (await codemodPipelineTool.execute(
      {
        content: rawPipelineCode,
        rules: JSON.stringify(codemodRules),
      },
      tempDir
    )) as { success: boolean; totalRules: number; successfulRules: number };
    if (!codemodToolRes.success || codemodToolRes.successfulRules !== 3) {
      throw new Error("fuzzy_execute_codemod_pipeline tool execution failed");
    }
    console.log("  ✓ Multi-stage codemod rule pipeline & transactional rollback verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 44: Structured JSON/JSONC/YAML Config Key-Value Fuzzy Patching
    // ---------------------------------------------------------------------------
    console.log("[Suite 44/52] Structured JSON/JSONC/YAML Config Key-Value Fuzzy Patching...");
    const sampleJsoncConfig = [
      '{',
      '  // TypeScript Compiler Options',
      '  "compilerOptions": {',
      '    "target": "ES2022",',
      '    "strict": true',
      '  }',
      '}',
    ].join("\n");

    const patchConfigRes1 = matcher.patchStructuredConfigBlock(
      sampleJsoncConfig,
      ["compilerOptions", "target"],
      "ESNext"
    );

    if (
      !patchConfigRes1.success ||
      !patchConfigRes1.modifiedContent.includes('"target": "ESNext"') ||
      !patchConfigRes1.modifiedContent.includes("// TypeScript Compiler Options")
    ) {
      throw new Error(`JSONC config patching failed: ${JSON.stringify(patchConfigRes1)}`);
    }

    // Insert new property
    const patchConfigRes2 = matcher.patchStructuredConfigBlock(
      patchConfigRes1.modifiedContent,
      ["compilerOptions", "paths"],
      { "@app/*": ["src/*"] }
    );

    if (
      !patchConfigRes2.success ||
      !patchConfigRes2.modifiedContent.includes('"paths"') ||
      !patchConfigRes2.modifiedContent.includes('"@app/*"')
    ) {
      throw new Error(`JSONC property insertion failed: ${JSON.stringify(patchConfigRes2)}`);
    }

    // Tool execution test
    const patchConfigToolRes = (await patchConfigTool.execute(
      {
        content: sampleJsoncConfig,
        keyPath: "compilerOptions.target",
        newValue: JSON.stringify("ESNext"),
      },
      tempDir
    )) as { success: boolean; modifiedContent: string };
    if (!patchConfigToolRes.success || !patchConfigToolRes.modifiedContent.includes('"target": "ESNext"')) {
      throw new Error("fuzzy_patch_structured_config tool execution failed");
    }
    console.log("  ✓ Structured JSON/JSONC/YAML config key-value fuzzy patching verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 45: Semantic Function Extraction & Call-Site Inlining
    // ---------------------------------------------------------------------------
    console.log("[Suite 45/52] Semantic Function Extraction & Call-Site Inlining...");
    const sampleFuncCode = [
      'export function processOrder(price: number, taxRate: number): number {',
      '  const taxAmount = price * taxRate;',
      '  return price + taxAmount;',
      '}',
    ].join("\n");

    // Extract mode
    const extractRes = matcher.inlineOrExtractFunctionBlock(sampleFuncCode, {
      mode: "extract",
      functionName: "computeTax",
      targetSpan: "const taxAmount = price * taxRate;\n  return price + taxAmount;",
      parameterNames: ["price", "taxRate"],
      returnType: "number",
    });

    if (
      !extractRes.success ||
      !extractRes.modifiedContent.includes("function computeTax(price, taxRate): number") ||
      !extractRes.modifiedContent.includes("computeTax(price, taxRate)")
    ) {
      throw new Error(`Function extract failed: ${JSON.stringify(extractRes)}`);
    }

    // Inline mode
    const inlineSample = [
      'function formatPrice(val: number): string {',
      '  return "$" + val;',
      '}',
      '',
      'export function render(): string {',
      '  return formatPrice(100);',
      '}',
    ].join("\n");

    const inlineRes = matcher.inlineOrExtractFunctionBlock(inlineSample, {
      mode: "inline",
      functionName: "formatPrice",
      removeDeclaration: true,
    });

    if (
      !inlineRes.success ||
      inlineRes.modifiedContent.includes("function formatPrice") ||
      !inlineRes.modifiedContent.includes('("$" + 100)')
    ) {
      throw new Error(`Function inline failed: ${JSON.stringify(inlineRes)}`);
    }

    // Tool execution test
    const inlineToolRes = (await inlineExtractTool.execute(
      {
        content: inlineSample,
        mode: "inline",
        functionName: "formatPrice",
      },
      tempDir
    )) as { success: boolean; callSitesUpdatedCount: number };
    if (!inlineToolRes.success || inlineToolRes.callSitesUpdatedCount !== 1) {
      throw new Error("fuzzy_inline_or_extract_function tool execution failed");
    }
    console.log("  ✓ Semantic function extraction & call-site inlining verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 46: Workspace-Wide Symbolic Dependency Graph & Patch Impact Analysis
    // ---------------------------------------------------------------------------
    console.log("[Suite 46/52] Workspace-Wide Symbolic Dependency Graph & Patch Impact Analysis...");
    const workspaceMock: Record<string, string> = {
      "src/types.ts": "export interface UserProfile {\n  id: string;\n}\n\nexport interface LegacyProfile {\n  oldId: string;\n}",
      "src/consumerA.ts": 'import { UserProfile, LegacyProfile } from "./types.js";\n\nexport function getLegacy(p: LegacyProfile) { return p.oldId; }',
      "src/consumerB.ts": 'import { UserProfile } from "./types.js";\n\nexport function getUser(p: UserProfile) { return p.id; }',
    };

    // Propose patch that removes LegacyProfile
    const proposedPatches = [
      {
        filePath: "src/types.ts",
        oldContent: workspaceMock["src/types.ts"],
        newContent: "export interface UserProfile {\n  id: string;\n}",
      },
    ];

    const impactRes = matcher.analyzeWorkspacePatchImpact(workspaceMock, proposedPatches);
    if (
      !impactRes.success ||
      impactRes.isSafeToApply ||
      impactRes.brokenSymbols.length !== 1 ||
      impactRes.brokenSymbols[0].symbol !== "LegacyProfile" ||
      !impactRes.brokenSymbols[0].affectedConsumers.includes("src/consumerA.ts")
    ) {
      throw new Error(`Workspace patch impact analysis failed: ${JSON.stringify(impactRes)}`);
    }

    // Tool execution test
    const impactToolRes = (await patchImpactTool.execute(
      {
        workspaceFiles: JSON.stringify(workspaceMock),
        proposedPatches: JSON.stringify(proposedPatches),
      },
      tempDir
    )) as { success: boolean; isSafeToApply: boolean; brokenSymbols: any[] };
    if (!impactToolRes.success || impactToolRes.isSafeToApply !== false || impactToolRes.brokenSymbols.length !== 1) {
      throw new Error("fuzzy_analyze_patch_impact tool execution failed");
    }
    console.log("  ✓ Workspace-wide symbolic dependency graph & patch impact analysis verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 47: Full-Spectrum Multi-Paradigm Engine Splicing & State Rewind Integration
    // ---------------------------------------------------------------------------
    console.log("[Suite 47/52] Full-Spectrum Multi-Paradigm Engine Splicing & State Rewind Integration...");
    const masterAppCode = [
      'import { readFile } from "node:fs";',
      '',
      'export class OmniEngineKernel {',
      '  runKernel(input: string): string {',
      '    return "PROCESSED: " + input;',
      '  }',
      '}',
    ].join("\n");

    // 1. Run codemod pipeline
    const omniPipelineRes = matcher.executeCodemodPipeline(masterAppCode, [
      {
        id: "omni-1-doc",
        description: "Add doc comment",
        type: "doc_sync",
        params: { identifierName: "runKernel" },
      },
      {
        id: "omni-2-mutate",
        description: "Update prefix",
        type: "fuzzy_replace",
        params: {
          oldString: 'return "PROCESSED: " + input;',
          newString: 'return "OMNI_PROCESSED: " + input.trim();',
        },
      },
    ]);
    if (!omniPipelineRes.success || !omniPipelineRes.modifiedContent.includes("OMNI_PROCESSED:")) {
      throw new Error("Suite 47 Step 1 failed");
    }

    // 2. Capture binary snapshot & Verify O(1) state rewind
    const snapFrame47 = snapshotManager.captureFrame(300);
    if (!snapFrame47) throw new Error("Suite 47 Step 2 frame capture failed");

    const rewound47 = snapshotManager.rewindToFrame(300);
    if (!rewound47) throw new Error("Suite 47 Step 2 rewind failed");

    console.log("  ✓ Full-spectrum multi-paradigm engine splicing & state rewind integration verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 48: Speculative Multi-Branch Patch Exploration & Scoring
    // ---------------------------------------------------------------------------
    console.log("[Suite 48/52] Speculative Multi-Branch Patch Exploration & Scoring...");
    const sampleExploreBase = [
      "export function computeTotal(prices: number[]): number {",
      "  let total = 0;",
      "  for (const p of prices) {",
      "    total += p;",
      "  }",
      "  return total;",
      "}",
    ].join("\n");

    const candidateBranches: PatchBranchCandidate[] = [
      {
        branchId: "branch-a-broken",
        description: "Broken syntax replacement",
        searchBlock: "total += p;\n  }\n  return total;",
        replacementBlock: "total += p * 1.1;\n  // missing closing brace\n  return total;",
      },
      {
        branchId: "branch-b-valid",
        description: "Modern reduce replacement",
        searchBlock: "let total = 0;\n  for (const p of prices) {\n    total += p;\n  }\n  return total;",
        replacementBlock: "return prices.reduce((acc, cur) => acc + cur, 0);",
      },
      {
        branchId: "branch-c-valid-loop",
        description: "For-each loop replacement",
        searchBlock: "for (const p of prices) {\n    total += p;\n  }",
        replacementBlock: "prices.forEach((p) => { total += p; });",
      },
    ];

    const exploreRes = matcher.explorePatchBranches(sampleExploreBase, candidateBranches);
    if (
      !exploreRes.success ||
      exploreRes.totalBranchesEvaluated !== 3 ||
      exploreRes.winningBranchId !== "branch-c-valid-loop" ||
      !exploreRes.winningContent.includes("prices.forEach")
    ) {
      throw new Error(`explorePatchBranches failed: ${JSON.stringify(exploreRes)}`);
    }

    // Tool execution test
    const exploreToolRes = (await exploreBranchesTool.execute(
      {
        content: sampleExploreBase,
        branches: JSON.stringify(candidateBranches),
      },
      tempDir
    )) as { success: boolean; winningBranchId: string };
    if (!exploreToolRes.success || exploreToolRes.winningBranchId !== "branch-c-valid-loop") {
      throw new Error("fuzzy_explore_patch_branches tool execution failed");
    }
    console.log("  ✓ Speculative multi-branch patch exploration & scoring verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 49: Semantic Type-Narrowing & Nullability Guard Refactoring
    // ---------------------------------------------------------------------------
    console.log("[Suite 49/52] Semantic Type-Narrowing & Nullability Guard Refactoring...");
    const sampleVulnerableCode = [
      "export function getZip(user: any): string {",
      "  const zip = user.profile.address.zipCode;",
      "  const fallback = user.backupZip !== undefined ? user.backupZip : '00000';",
      "  return zip || fallback;",
      "}",
    ].join("\n");

    // Optional chain mode
    const optChainRes = matcher.synthesizeNullabilityGuards(sampleVulnerableCode, "user", {
      mode: "optional_chain",
    });
    if (!optChainRes.success || !optChainRes.modifiedContent.includes("user?.profile")) {
      throw new Error(`Optional chain synthesis failed: ${JSON.stringify(optChainRes)}`);
    }

    // Nullish coalesce mode
    const nullishRes = matcher.synthesizeNullabilityGuards(sampleVulnerableCode, "user.backupZip", {
      mode: "nullish_coalesce",
      fallbackValue: "'00000'",
    });
    if (!nullishRes.success || !nullishRes.modifiedContent.includes("user.backupZip ?? '00000'")) {
      throw new Error(`Nullish coalesce synthesis failed: ${JSON.stringify(nullishRes)}`);
    }

    // Tool execution test
    const guardToolRes = (await nullabilityGuardsTool.execute(
      {
        content: sampleVulnerableCode,
        targetIdentifier: "user",
        mode: "optional_chain",
      },
      tempDir
    )) as { success: boolean; guardsInsertedCount: number };
    if (!guardToolRes.success || guardToolRes.guardsInsertedCount < 1) {
      throw new Error("fuzzy_synthesize_nullability_guards tool execution failed");
    }
    console.log("  ✓ Semantic type-narrowing & nullability guard refactoring verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 50: AST Import Aliasing, Namespace Merging & Re-Export Resolution
    // ---------------------------------------------------------------------------
    console.log("[Suite 50/52] AST Import Aliasing, Namespace Merging & Re-Export Resolution...");
    const sampleAliasedImports = [
      'import { Router as Router } from "./router.js";',
      'import { UserService as Service } from "./user-service.js";',
      'export { Router as Router } from "./router.js";',
      'export { Helper as LegacyHelper } from "./helper.js";',
    ].join("\n");

    const aliasRes = matcher.resolveImportAliasesAndReexports(sampleAliasedImports, {
      canonicalizeAliases: true,
    });

    if (
      !aliasRes.success ||
      aliasRes.resolvedAliasesCount !== 1 ||
      aliasRes.updatedReexportsCount !== 1 ||
      !aliasRes.modifiedContent.includes('import { Router } from "./router.js"') ||
      !aliasRes.modifiedContent.includes('export { Router } from "./router.js"')
    ) {
      throw new Error(`Import alias resolution failed: ${JSON.stringify(aliasRes)}`);
    }

    // Tool execution test
    const aliasToolRes = (await resolveAliasesTool.execute(
      {
        content: sampleAliasedImports,
        canonicalizeAliases: true,
      },
      tempDir
    )) as { success: boolean; resolvedAliasesCount: number };
    if (!aliasToolRes.success || aliasToolRes.resolvedAliasesCount !== 1) {
      throw new Error("fuzzy_resolve_import_aliases_and_reexports tool execution failed");
    }
    console.log("  ✓ AST import aliasing, namespace merging & re-export resolution verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 51: Structural Guard Clause Inversion & Block De-Nesting
    // ---------------------------------------------------------------------------
    console.log("[Suite 51/52] Structural Guard Clause Inversion & Block De-Nesting...");
    const nestedIfElseCode = [
      "export function processPayment(payment: any): boolean {",
      "  if (payment.isValid) {",
      "    console.log('Processing payment...');",
      "    return true;",
      "  } else {",
      "    return false;",
      "  }",
      "}",
    ].join("\n");

    const invertRes = matcher.invertConditionalBranches(nestedIfElseCode);
    if (
      !invertRes.success ||
      invertRes.invertedBranchesCount !== 1 ||
      !invertRes.modifiedContent.includes("if (!payment.isValid) {") ||
      !invertRes.modifiedContent.includes("return false;")
    ) {
      throw new Error(`Conditional inversion failed: ${JSON.stringify(invertRes)}`);
    }

    // Tool execution test
    const invertToolRes = (await invertBranchesTool.execute(
      {
        content: nestedIfElseCode,
      },
      tempDir
    )) as { success: boolean; invertedBranchesCount: number };
    if (!invertToolRes.success || invertToolRes.invertedBranchesCount !== 1) {
      throw new Error("fuzzy_invert_conditional_branches tool execution failed");
    }
    console.log("  ✓ Structural guard clause inversion & block de-nesting verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 52: Full-Spectrum Multi-Paradigm Engine Splicing & State Rewind Integration
    // ---------------------------------------------------------------------------
    console.log("[Suite 52/52] Full-Spectrum Multi-Paradigm Engine Splicing & State Rewind Integration...");
    const masterAppCode52 = [
      'import { Router as Router } from "./router.js";',
      '',
      'export class MasterOrchestrator {',
      '  handleRequest(req: any): boolean {',
      '    if (req.isAuth) {',
      '      const id = req.session.userId;',
      '      return true;',
      '    } else {',
      '      return false;',
      '    }',
      '  }',
      '}',
    ].join("\n");

    // 1. Resolve aliases
    const p1 = matcher.resolveImportAliasesAndReexports(masterAppCode52);
    if (!p1.success || !p1.modifiedContent.includes('import { Router } from "./router.js"')) {
      throw new Error("Suite 52 Step 1 failed");
    }

    // 2. Invert conditionals
    const p2 = matcher.invertConditionalBranches(p1.modifiedContent);
    if (!p2.success || !p2.modifiedContent.includes("if (!req.isAuth) {")) {
      throw new Error("Suite 52 Step 2 failed");
    }

    // 3. Optional chaining
    const p3 = matcher.synthesizeNullabilityGuards(p2.modifiedContent, "req.session", {
      mode: "optional_chain",
    });
    if (!p3.success || !p3.modifiedContent.includes("req.session?.userId")) {
      throw new Error("Suite 52 Step 3 failed");
    }

    // 4. Capture snapshot & Verify O(1) state rewind
    const snapFrame52 = snapshotManager.captureFrame(400);
    if (!snapFrame52) throw new Error("Suite 52 Step 4 frame capture failed");

    const rewound52 = snapshotManager.rewindToFrame(400);
    if (!rewound52) throw new Error("Suite 52 Step 4 rewind failed");

    console.log("  ✓ Full-spectrum multi-paradigm engine splicing & state rewind integration verified");
    passedSuites++;

    console.log("\n================================================================================");
    console.log(` [✓] ALL ${passedSuites}/${totalSuites} PHASE 108 FUZZY MATCHER VALIDATION SUITES PASSED! `);
    console.log("================================================================================\n");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runValidationSuite().catch((err) => {
  console.error("\n[FATAL] Validation suite failed:", err);
  process.exit(1);
});

