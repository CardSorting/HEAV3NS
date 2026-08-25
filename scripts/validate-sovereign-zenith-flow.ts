/**
 * validate-sovereign-zenith-flow.ts
 *
 * Comprehensive Validation Suite for Sovereign Zenith Pass:
 * 1. Symbol Definition & Reference Navigation (get_symbol_definition, get_symbol_references)
 * 2. In-Memory Code Formatter (format_code_content)
 * 3. Chained Multi-Step Workflow Pipeline Executor (execute_workflow_pipeline)
 * 4. Automated Failure Diagnostic Doctor (diagnose_tool_failure)
 * 5. Cryptographic Workspace Integrity Auditor (audit_workspace_integrity)
 */

import * as assert from "node:assert";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { MonolithFactory } from "../src/factories/monolith-factory.js";

async function run() {
  console.log("================================================================================");
  console.log(" LUMI Sovereign Zenith: Symbols, Formatter, Pipelines & Diagnostics             ");
  console.log("================================================================================\n");

  const components = MonolithFactory.createEngine();
  const registry = components.toolRegistry;
  const testDir = path.join(process.cwd(), "scratch", "sovereign-zenith-test");
  await fs.mkdir(testDir, { recursive: true });

  // --------------------------------------------------------------------------
  // Test 1: Symbol Definition & Reference Navigation
  // --------------------------------------------------------------------------
  console.log("[Test 1/5] Validating Symbol Definition & Reference Navigation...");
  {
    const fileA = path.join(testDir, "payment.service.ts");
    const fileB = path.join(testDir, "order.controller.ts");

    await fs.writeFile(
      fileA,
      `export class PaymentService {\n  public processPayment(amount: number): boolean {\n    return amount > 0;\n  }\n}\n`,
      "utf8"
    );

    await fs.writeFile(
      fileB,
      `import { PaymentService } from './payment.service';\nexport class OrderController {\n  private paymentService: PaymentService = new PaymentService();\n}\n`,
      "utf8"
    );

    // Test get_symbol_definition
    const defRes: any = await registry.executeTool(
      "get_symbol_definition",
      { symbol: "PaymentService" },
      testDir
    );

    assert.strictEqual(defRes.success, true);
    assert.strictEqual(defRes.definition.name, "PaymentService");
    assert.strictEqual(defRes.definition.kind, "class");
    assert.strictEqual(defRes.definition.file, "payment.service.ts");

    // Test get_symbol_references
    const refRes: any = await registry.executeTool(
      "get_symbol_references",
      { symbol: "PaymentService" },
      testDir
    );

    assert.strictEqual(refRes.success, true);
    assert.ok(refRes.totalFound >= 2);

    console.log(`  [✓] Symbol 'PaymentService' definition resolved at payment.service.ts:1 and ${refRes.totalFound} references located.`);
  }

  // --------------------------------------------------------------------------
  // Test 2: In-Memory Multi-Language Code Formatter
  // --------------------------------------------------------------------------
  console.log("[Test 2/5] Validating In-Memory Code Formatter...");
  {
    const unformattedJson = `{"name": "lumi", "active": true, "count": 100}`;
    const formatRes: any = await registry.executeTool(
      "format_code_content",
      { code: unformattedJson, language: "json", indentSize: 2 },
      testDir
    );

    assert.strictEqual(formatRes.success, true);
    assert.ok(formatRes.formattedCode.includes("  \"name\": \"lumi\""));
    assert.ok(formatRes.formattedCode.endsWith("\n"));

    console.log("  [✓] JSON code formatted with 2-space indentation.");
  }

  // --------------------------------------------------------------------------
  // Test 3: Chained Multi-Step Workflow Pipeline Execution
  // --------------------------------------------------------------------------
  console.log("[Test 3/5] Validating Chained Workflow Pipeline Executor...");
  {
    const pipelineRes: any = await registry.executeTool(
      "execute_workflow_pipeline",
      {
        name: "test_pipeline",
        steps: [
          {
            id: "step1",
            tool: "write_file",
            args: { path: "pipeline_temp.txt", content: "Initial Pipeline Content" },
          },
          {
            id: "step2",
            tool: "view_file",
            args: { path: "pipeline_temp.txt" },
          },
        ],
      },
      testDir
    );

    assert.strictEqual(pipelineRes.success, true);
    assert.strictEqual(pipelineRes.totalSteps, 2);
    assert.strictEqual(pipelineRes.executedStepsCount, 2);
    assert.ok(pipelineRes.stepResults[1].output.content.includes("Initial Pipeline Content"));

    console.log(`  [✓] Chained pipeline executed 2/2 steps in ${pipelineRes.durationMs}ms.`);
  }

  // --------------------------------------------------------------------------
  // Test 4: Automated Tool Failure Diagnostic Doctor
  // --------------------------------------------------------------------------
  console.log("[Test 4/5] Validating Tool Failure Diagnostic Doctor...");
  {
    const diagEnoent: any = await registry.executeTool(
      "diagnose_tool_failure",
      { toolName: "view_file", error: "ENOENT: no such file or directory, open 'missing.ts'", args: { path: "missing.ts" } },
      testDir
    );

    assert.strictEqual(diagEnoent.category, "file_not_found");
    assert.ok(diagEnoent.suggestions.length > 0);
    assert.strictEqual(diagEnoent.recommendedTool?.name, "find_files_by_pattern");

    const diagPatch: any = await registry.executeTool(
      "diagnose_tool_failure",
      { toolName: "replace_file_content", error: "Target content could not be matched", args: { path: "app.ts" } },
      testDir
    );

    assert.strictEqual(diagPatch.category, "patch_mismatch");
    assert.strictEqual(diagPatch.recommendedTool?.name, "heal_and_apply_patch");

    console.log("  [✓] Diagnostic doctor categorized ENOENT & patch mismatch with recovery tool recommendations.");
  }

  // --------------------------------------------------------------------------
  // Test 5: Cryptographic Workspace Integrity Auditor
  // --------------------------------------------------------------------------
  console.log("[Test 5/5] Validating Cryptographic Workspace Integrity Auditor...");
  {
    const integrityRes: any = await registry.executeTool(
      "audit_workspace_integrity",
      { maxFiles: 10 },
      testDir
    );

    assert.strictEqual(integrityRes.success, true);
    assert.ok(integrityRes.totalFiles >= 2);
    assert.ok(integrityRes.files[0].sha256.length === 64);

    console.log(`  [✓] Integrity audit fingerprinted ${integrityRes.totalFiles} files in ${integrityRes.durationMs}ms.`);
  }

  // Cleanup testDir
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});

  console.log("\n================================================================================");
  console.log("  [✓] ALL 5/5 SOVEREIGN ZENITH FLOW SUITES PASSED!  ");
  console.log("================================================================================\n");
}

run().catch((err) => {
  console.error("Validation failed:", err);
  process.exit(1);
});
