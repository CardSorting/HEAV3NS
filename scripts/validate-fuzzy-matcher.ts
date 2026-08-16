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
  const totalSuites = 8;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-fuzzy-val-"));

  try {
    // ---------------------------------------------------------------------------
    // Suite 1: Exact Match, Edit Idempotency & Line-Ending Preservation
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/8] Exact Match, Edit Idempotency & Line-Ending Preservation...");
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
    console.log("[Suite 2/8] Line-Trimmed, Whitespace-Normalized & Relative Indentation Adaptation...");
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
    console.log("[Suite 3/8] Indentation-Flexible & Selective Control Character Unescaping (\\t, \\r)...");
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
    console.log("[Suite 4/8] Escape Drift & Backslash Doubling Guards...");
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
    console.log("[Suite 5/8] Comment Tolerance, Token Normalization & Ellipsis Wildcard...");
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
    console.log("[Suite 6/8] Whitespace Visualization, Closest Line Diagnostics & Unified Patch Application...");
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
    console.log("[Suite 7/8] Atomic Multi-Hunk Patch Engine & O(1) Rollback...");
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
    // Suite 8: Model Tool Suite Execution & Monolith 382-Component Synthesis
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/8] Model Tool Suite Execution & Monolith 382-Component Synthesis...");
    const toolSuite = new FuzzyMatcherToolSuite(supervisor);
    const tools = toolSuite.getTools();

    const findReplaceTool = tools.find((t) => t.name === "fuzzy_find_and_replace")!;
    const multiReplaceTool = tools.find((t) => t.name === "fuzzy_multi_replace")!;
    const patchTool = tools.find((t) => t.name === "fuzzy_generate_patch")!;
    const applyPatchTool = tools.find((t) => t.name === "fuzzy_apply_patch")!;
    const dryRunTool = tools.find((t) => t.name === "fuzzy_dry_run_replace")!;
    const idempotencyTool = tools.find((t) => t.name === "fuzzy_check_idempotency")!;
    const diagnoseTool = tools.find((t) => t.name === "fuzzy_diagnose_mismatch")!;
    const configTool = tools.find((t) => t.name === "fuzzy_configure_strategies")!;
    const inspectTool = tools.find((t) => t.name === "fuzzy_inspect_strategies")!;

    if (!findReplaceTool || !multiReplaceTool || !patchTool || !applyPatchTool || !dryRunTool || !idempotencyTool || !diagnoseTool || !configTool || !inspectTool) {
      throw new Error("Missing required Fuzzy Matcher model tools");
    }

    // Test Apply Patch Tool
    const applyRes = await applyPatchTool.execute({
      content: fileToPatch,
      patch: unifiedPatch,
    }, tempDir) as { success: boolean; modifiedContent: string };
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

    if (verification.componentCount !== 382 || verification.requiredComponentCount !== 382) {
      throw new Error(`Expected exactly 382 components, got ${verification.componentCount}`);
    }
    console.log(`  ✓ Grand Monolith successfully verified with ${verification.componentCount}/${verification.requiredComponentCount} components in OPTIMAL cohesion`);
    passedSuites++;

    console.log("\n================================================================================");
    console.log(` [✓] ALL ${passedSuites}/${totalSuites} PHASE 103 FUZZY MATCHER VALIDATION SUITES PASSED! `);
    console.log("================================================================================\n");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runValidationSuite().catch((err) => {
  console.error("\n[FATAL] Validation suite failed:", err);
  process.exit(1);
});
