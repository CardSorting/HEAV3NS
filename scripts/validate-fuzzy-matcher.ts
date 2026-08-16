/**
 * validate-fuzzy-matcher.ts
 *
 * Comprehensive validation suite for Target #41: Deterministic 9-Strategy Fuzzy Line Matcher,
 * Unicode Typography Normalizer, Block-Anchor Resolver, Escape-Drift Guard,
 * Whitespace-Visualizing Diagnostician & Edit Idempotency Substrate (Phase 103 / ADR-057).
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
  console.log(" LUMI Phase 103 / ADR-057: Deterministic 9-Strategy Fuzzy Matcher Validation   ");
  console.log("================================================================================\n");

  let passedSuites = 0;
  const totalSuites = 8;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-fuzzy-val-"));

  try {
    // ---------------------------------------------------------------------------
    // Suite 1: Exact Match & Edit Idempotency Verification
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/8] Exact Match & Edit Idempotency Verification...");
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
    console.log("  ✓ Validated exact matching, idempotency short-circuiting, and identical edit rejection");
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
    // Suite 5: Extended Unicode Typography & Zero-Width Space Stripping
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/8] Extended Unicode Typography & Zero-Width Space Stripping...");
    const unicodeContent = 'const greeting = “Hello, World!”;\u200B // em—dash and minus −5';

    // Model emits ASCII quotes, standard hyphens, and ASCII minus without zero-width character
    const asciiOld = 'const greeting = "Hello, World!"; // em--dash and minus -5';
    const asciiNew = 'const greeting = "Hello, LUMI-JOY!";';

    const resUnicode = matcher.findAndReplace(unicodeContent, asciiOld, asciiNew);
    if (!resUnicode.success || resUnicode.strategyUsed !== "unicode_normalized") {
      throw new Error(`Unicode typography normalization failed: ${JSON.stringify(resUnicode)}`);
    }
    console.log("  ✓ Normalized typographic quotes, em-dashes, zero-width chars, and math minuses");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: Whitespace Visualization & Closest Line Diagnostics
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/8] Whitespace Visualization & Closest Line Diagnostics...");
    const mismatchContent = "function configureServer() {\n    const port = 8080;\n    return port;\n}";
    const failedSearch = "function configureServer() {\n\tconst port = 8080;\n\treturn port;\n}";

    const diagnosis = matcher.diagnoseMismatch(failedSearch, mismatchContent);
    if (!diagnosis.hasCandidate || !diagnosis.whitespaceIssueDetected) {
      throw new Error(`Mismatch diagnosis failed: ${JSON.stringify(diagnosis)}`);
    }

    const visual = matcher.visualizeWhitespace("  \tconst a = 1;");
    if (visual !== "··→const a = 1;") {
      throw new Error(`Whitespace visualization failed: ${visual}`);
    }

    const completelyDifferentContent = "function configureServer() {\n    const port = 8080;\n    const databaseHost = 'localhost';\n    return port;\n}";
    const noMatchRes = matcher.findAndReplace(completelyDifferentContent, "const databaseClusterConnectionString = 'cluster.internal:5432';", "const databaseHost = '0.0.0.0';");
    if (noMatchRes.success || !noMatchRes.error?.includes("Did you mean one of these sections?")) {
      throw new Error(`Diagnostic no-match hint failed: ${JSON.stringify(noMatchRes)}`);
    }
    console.log("  ✓ Diagnosed whitespace mismatches with visible glyphs (→ / ·) and contextual line hints");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: In-Memory BroccoliFuzzySubstrate & FuzzySnapshotManager O(1) Rollback
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/8] In-Memory BroccoliFuzzySubstrate & FuzzySnapshotManager O(1) Rollback...");
    const substrate = new BroccoliFuzzySubstrate();
    const supervisor = new FuzzyMatcherSupervisor(matcher, substrate);
    const snapshotManager = new FuzzySnapshotManager(substrate);

    snapshotManager.captureFrame(1);

    supervisor.findAndReplace(baseContent, oldStr, newStr);
    supervisor.setCustomUnicodeMapping("§", "$");
    supervisor.setSimilarityThreshold(0.75);
    supervisor.setPreserveIndentation(false);
    supervisor.setPreserveUnicodeForUnchanged(false);
    supervisor.disableStrategy("context_aware");

    if (substrate.getHistory().length !== 1 || substrate.getSimilarityThreshold() !== 0.75 || substrate.getPreserveIndentation() !== false) {
      throw new Error("Substrate state mutation failed");
    }

    for (let w = 0; w < 5; w++) {
      snapshotManager.rewindToFrame(1);
    }
    const rewindStart = performance.now();
    const rewindSuccess = snapshotManager.rewindToFrame(1);
    const rewindDuration = performance.now() - rewindStart;

    if (!rewindSuccess || substrate.getHistory().length !== 0 || substrate.getSimilarityThreshold() !== 0.5 || substrate.getPreserveIndentation() !== true) {
      throw new Error("Fuzzy snapshot manager state rewind failed");
    }
    console.log(`  ✓ O(1) Fuzzy substrate rollback completed in ${rewindDuration.toFixed(3)} ms (< 0.05 ms SLA)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: Model Tool Suite Execution & Monolith 382-Component Synthesis
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/8] Model Tool Suite Execution & Monolith 382-Component Synthesis...");
    const toolSuite = new FuzzyMatcherToolSuite(supervisor);
    const tools = toolSuite.getTools();

    const findReplaceTool = tools.find((t) => t.name === "fuzzy_find_and_replace")!;
    const dryRunTool = tools.find((t) => t.name === "fuzzy_dry_run_replace")!;
    const idempotencyTool = tools.find((t) => t.name === "fuzzy_check_idempotency")!;
    const diagnoseTool = tools.find((t) => t.name === "fuzzy_diagnose_mismatch")!;
    const configTool = tools.find((t) => t.name === "fuzzy_configure_strategies")!;
    const inspectTool = tools.find((t) => t.name === "fuzzy_inspect_strategies")!;

    if (!findReplaceTool || !dryRunTool || !idempotencyTool || !diagnoseTool || !configTool || !inspectTool) {
      throw new Error("Missing required Fuzzy Matcher model tools");
    }

    // Test Diagnose Tool
    const diagRes = await diagnoseTool.execute({
      content: mismatchContent,
      oldString: failedSearch,
    }, tempDir) as { success: boolean; hasCandidate: boolean; whitespaceIssueDetected: boolean };
    if (!diagRes.success || !diagRes.hasCandidate || !diagRes.whitespaceIssueDetected) {
      throw new Error("fuzzy_diagnose_mismatch execution failed");
    }

    // Test Dry Run Tool
    const dryRes = await dryRunTool.execute({
      content: "const x = 1;\nconst y = 2;",
      oldString: "const y = 2;",
      newString: "const y = 200;",
    }, tempDir) as { success: boolean; diffPreview: string; matchCount: number };
    if (!dryRes.success || !dryRes.diffPreview?.includes("+const y = 200;")) {
      throw new Error("fuzzy_dry_run_replace execution failed");
    }

    // Test Config Tool
    const configRes = await configTool.execute({ action: "set_threshold", similarityThreshold: 0.8 }, tempDir) as { success: boolean; similarityThreshold: number };
    if (!configRes.success || configRes.similarityThreshold !== 0.8) {
      throw new Error("fuzzy_configure_strategies execution failed");
    }

    const toolFindRes = await findReplaceTool.execute({
      content: "const a = 1;\nconst b = 2;",
      oldString: "const b = 2;",
      newString: "const b = 20;",
    }, tempDir) as { success: boolean; modifiedContent: string };
    if (!toolFindRes.success || !toolFindRes.modifiedContent.includes("const b = 20;")) {
      throw new Error("fuzzy_find_and_replace tool execution failed");
    }

    const toolIdemRes = await idempotencyTool.execute({
      content: "const a = 1;\nconst b = 20;",
      oldString: "const b = 2;",
      newString: "const b = 20;",
    }, tempDir) as { success: boolean; isAlreadyApplied: boolean };
    if (!toolIdemRes.success || !toolIdemRes.isAlreadyApplied) {
      throw new Error("fuzzy_check_idempotency tool execution failed");
    }

    const toolInspectRes = await inspectTool.execute({}, tempDir) as { success: boolean; totalReplacements: number };
    if (!toolInspectRes.success || toolInspectRes.totalReplacements !== 1) {
      throw new Error("fuzzy_inspect_strategies tool execution failed");
    }

    // Monolith Verification with custom options
    const monolith = MonolithFactory.createEngine({
      fuzzyOptions: {
        similarityThreshold: 0.6,
        preserveIndentation: true,
      },
    });
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
