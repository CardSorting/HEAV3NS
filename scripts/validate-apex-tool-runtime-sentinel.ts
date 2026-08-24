/**
 * validate-apex-tool-runtime-sentinel.ts
 *
 * Apex-Tier Pass 4 Sentinel Suite:
 * - ToolConfirmationGatekeeper (Interactive & Policy Hooks, Session Approvals, Rejection Diagnostics)
 * - ToolLoopBreaker (Sliding Window Argument Hashing & Loop Abort Advisories)
 * - MultiFileAtomicPatchOrchestrator (Cross-File Atomic Refactoring & Zero-Mutation Mismatch Abort)
 * - ToolTelemetryLedger (Execution Percentiles p50/p95, Error Rates, Bytes Processed)
 * - Monolith Tool Registry End-to-End Sentinel Integration
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import { ToolConfirmationGatekeeper } from "../src/tooling/extensions/execution/tool-confirmation-gatekeeper.js";
import { ToolLoopBreaker } from "../src/tooling/extensions/execution/tool-loop-breaker.js";
import { ToolTelemetryLedger } from "../src/tooling/extensions/execution/tool-telemetry-ledger.js";
import { MultiFileAtomicPatchOrchestrator } from "../src/tooling/extensions/execution/multi-file-atomic-patch-orchestrator.js";
import { ToolTransactionJournal } from "../src/tooling/extensions/execution/tool-transaction-journal.js";
import { MonolithFactory } from "../src/factories/monolith-factory.js";

async function runSentinelSuite(): Promise<void> {
  console.log("================================================================================");
  console.log(" LUMI Sentinel Tier: Approval Gates, Loop Breakers, Atomic Patches & Telemetry  ");
  console.log("================================================================================\n");

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "lumi-sentinel-test-"));
  let passedTests = 0;
  const totalTests = 7;

  try {
    const components = MonolithFactory.createEngine();
    const registry = components.toolRegistry;

    // -------------------------------------------------------------------------
    // Test 1: ToolConfirmationGatekeeper Interactive & Programmable Approval
    // -------------------------------------------------------------------------
    console.log("[Test 1/7] Validating ToolConfirmationGatekeeper Approval & Rejection Feedback...");
    let userApproved = false;
    let feedbackGiven = "";

    const gatekeeper = new ToolConfirmationGatekeeper({
      confirmationHook: async (req) => {
        if (userApproved) {
          return { decision: "allow" };
        }
        return { decision: "deny", feedback: feedbackGiven };
      },
    });

    const criticalSafety = {
      toolName: "run_command",
      riskTier: "CRITICAL" as const,
      riskScore: 95,
      requiresConfirmation: true,
      warnings: ["Destructive command pattern detected"],
      allowedInDryRun: true,
    };

    // 1a. Deny flow
    feedbackGiven = "Do not delete production resources";
    const deniedRes = await gatekeeper.checkConfirmation("run_command", { command: "rm -rf /" }, criticalSafety);
    if (deniedRes.approved || !deniedRes.rejectionFeedback?.includes("Do not delete production resources")) {
      throw new Error(`Gatekeeper deny failed: ${JSON.stringify(deniedRes)}`);
    }

    // 1b. Allow flow
    userApproved = true;
    const allowRes = await gatekeeper.checkConfirmation("run_command", { command: "ls -la" }, criticalSafety);
    if (!allowRes.approved) {
      throw new Error("Gatekeeper allow failed");
    }

    console.log("  [✓] Tool confirmation gatekeeper correctly handled allow/deny decisions and propagated feedback.");
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 2: ToolLoopBreaker Sliding Window Argument Hashing & Loop Abort
    // -------------------------------------------------------------------------
    console.log("[Test 2/7] Validating ToolLoopBreaker Deduplication & Infinite Loop Abortion...");
    const loopBreaker = new ToolLoopBreaker({ maxRepeatThreshold: 3, windowSize: 10 });

    const check1 = loopBreaker.recordAndCheck("view_file", { path: "nonexistent.txt" });
    if (check1.loopDetected || check1.repeatCount !== 1) throw new Error("Check 1 unexpected");

    const check2 = loopBreaker.recordAndCheck("view_file", { path: "nonexistent.txt" });
    if (check2.loopDetected || check2.repeatCount !== 2) throw new Error("Check 2 unexpected");

    const check3 = loopBreaker.recordAndCheck("view_file", { path: "nonexistent.txt" });
    if (!check3.loopDetected || check3.repeatCount !== 3 || !check3.advisoryMessage?.includes("TOOL LOOP DETECTED")) {
      throw new Error(`Loop breaker failed to detect 3x identical repeat cycle: ${JSON.stringify(check3)}`);
    }

    // Changing args resets the specific signature count
    const checkDiff = loopBreaker.recordAndCheck("view_file", { path: "other.txt" });
    if (checkDiff.loopDetected || checkDiff.repeatCount !== 1) {
      throw new Error("Different args should not be flagged as loop");
    }

    console.log("  [✓] Tool loop breaker detected identical call cycle and injected self-correcting prompt advisory.");
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 3: MultiFileAtomicPatchOrchestrator Cross-File Atomic Patching
    // -------------------------------------------------------------------------
    console.log("[Test 3/7] Validating MultiFileAtomicPatchOrchestrator Multi-File Atomic Edits...");
    const journal = new ToolTransactionJournal();
    const orchestrator = new MultiFileAtomicPatchOrchestrator(journal);

    const fileA = path.join(tempDir, "moduleA.ts");
    const fileB = path.join(tempDir, "moduleB.ts");

    await fs.writeFile(fileA, "export interface User { id: string; name: string; }\n", "utf-8");
    await fs.writeFile(fileB, "import { User } from './moduleA.js';\nfunction greet(u: User) {}\n", "utf-8");

    const patchPlan = {
      description: "Rename User to AppUser across moduleA and moduleB",
      files: [
        {
          path: fileA,
          chunks: [{ target: "interface User", replacement: "interface AppUser" }],
        },
        {
          path: fileB,
          chunks: [
            { target: "import { User }", replacement: "import { AppUser }" },
            { target: "greet(u: User)", replacement: "greet(u: AppUser)" },
          ],
        },
      ],
    };

    const patchResult = await orchestrator.applyAtomicPatch(patchPlan, tempDir);
    if (!patchResult.success || patchResult.modifiedFilesCount !== 2 || patchResult.replacedChunksCount !== 3) {
      throw new Error(`Atomic multi-file patch failed: ${JSON.stringify(patchResult)}`);
    }

    const updatedA = await fs.readFile(fileA, "utf-8");
    const updatedB = await fs.readFile(fileB, "utf-8");
    if (!updatedA.includes("interface AppUser") || !updatedB.includes("import { AppUser }")) {
      throw new Error("Files do not contain expected atomic replacements");
    }

    console.log("  [✓] Multi-file atomic patch applied 3 chunks across 2 files in a single transaction.");
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 4: MultiFileAtomicPatchOrchestrator Zero-Disk Mutation on Mismatch
    // -------------------------------------------------------------------------
    console.log("[Test 4/7] Validating MultiFileAtomicPatchOrchestrator Zero-Disk Mutation Mismatch Abort...");
    const badPatchPlan = {
      description: "Should abort because File B target is missing",
      files: [
        {
          path: fileA,
          chunks: [{ target: "interface AppUser", replacement: "interface BrokenUser" }],
        },
        {
          path: fileB,
          chunks: [{ target: "THIS_SNIPPET_DOES_NOT_EXIST_ANYWHERE", replacement: "foo" }],
        },
      ],
    };

    const badResult = await orchestrator.applyAtomicPatch(badPatchPlan, tempDir);
    if (badResult.success || !badResult.validationErrors || badResult.validationErrors.length === 0) {
      throw new Error("Bad patch plan should have failed validation");
    }

    // Verify File A was NOT modified
    const untouchedA = await fs.readFile(fileA, "utf-8");
    if (untouchedA.includes("interface BrokenUser")) {
      throw new Error("Atomic guarantee violated: File A was modified despite File B mismatch");
    }

    console.log("  [✓] Atomic patch correctly aborted with zero disk mutations upon detecting target chunk mismatch.");
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 5: ToolTelemetryLedger Latency Percentiles & Error Tracking
    // -------------------------------------------------------------------------
    console.log("[Test 5/7] Validating ToolTelemetryLedger Latency Percentiles & Error Metrics...");
    const telemetry = new ToolTelemetryLedger();

    // Record sample durations
    const sampleLatencies = [10, 15, 20, 25, 30, 35, 40, 50, 100, 200];
    for (const lat of sampleLatencies) {
      telemetry.recordSample("grep_search", lat, true, 1024);
    }
    telemetry.recordSample("grep_search", 300, false); // 1 failure

    const metric = telemetry.getToolMetric("grep_search");
    if (!metric) throw new Error("Grep search metric missing");

    if (metric.totalInvocations !== 11 || metric.failedInvocations !== 1) {
      throw new Error(`Invocations mismatch: ${JSON.stringify(metric)}`);
    }
    if (metric.p50DurationMs < 20 || metric.p95DurationMs < 100) {
      throw new Error(`Percentile calculation unexpected: p50=${metric.p50DurationMs}, p95=${metric.p95DurationMs}`);
    }

    console.log(`  [✓] Telemetry ledger computed p50=${metric.p50DurationMs}ms, p95=${metric.p95DurationMs}ms, and success rate=${metric.successRatePercent}%.`);
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 6: Monolith Registry atomic_multi_file_patch Builtin Tool
    // -------------------------------------------------------------------------
    console.log("[Test 6/7] Validating Built-in 'atomic_multi_file_patch' Tool Invocations...");
    const file1 = path.join(tempDir, "f1.txt");
    const file2 = path.join(tempDir, "f2.txt");
    await fs.writeFile(file1, "Hello Apple\n", "utf-8");
    await fs.writeFile(file2, "Hello Orange\n", "utf-8");

    const toolPatchRes = (await registry.executeTool(
      "atomic_multi_file_patch",
      {
        files: [
          { path: file1, chunks: [{ target: "Apple", replacement: "Pineapple" }] },
          { path: file2, chunks: [{ target: "Orange", replacement: "Mango" }] },
        ],
      },
      tempDir
    )) as { success: boolean; modifiedFilesCount: number };

    if (!toolPatchRes.success || toolPatchRes.modifiedFilesCount !== 2) {
      throw new Error(`Registry atomic_multi_file_patch failed: ${JSON.stringify(toolPatchRes)}`);
    }

    const f1Content = await fs.readFile(file1, "utf-8");
    const f2Content = await fs.readFile(file2, "utf-8");
    if (f1Content !== "Hello Pineapple\n" || f2Content !== "Hello Mango\n") {
      throw new Error("Registry atomic patch content mismatch on disk");
    }

    console.log("  [✓] Built-in 'atomic_multi_file_patch' executed and validated on disk.");
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 7: Monolith Registry get_tool_telemetry Builtin Tool
    // -------------------------------------------------------------------------
    console.log("[Test 7/7] Validating Built-in 'get_tool_telemetry' Tool Invocations...");
    const allTelemetry = (await registry.executeTool("get_tool_telemetry", {}, tempDir)) as Array<{
      toolName: string;
      totalInvocations: number;
    }>;

    if (!Array.isArray(allTelemetry) || allTelemetry.length === 0) {
      throw new Error(`get_tool_telemetry failed: ${JSON.stringify(allTelemetry)}`);
    }

    console.log(`  [✓] Built-in 'get_tool_telemetry' returned metrics for ${allTelemetry.length} tracked tools.`);
    passedTests++;

  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }

  console.log("\n================================================================================");
  console.log(`  [✓] ALL ${passedTests}/${totalTests} SENTINEL TOOL RUNTIME SUITES PASSED! `);
  console.log("================================================================================\n");
}

runSentinelSuite().catch((err) => {
  console.error("Sentinel validation failed:", err);
  process.exit(1);
});
