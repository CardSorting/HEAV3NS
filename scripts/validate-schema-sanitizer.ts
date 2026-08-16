/**
 * validate-schema-sanitizer.ts
 *
 * Comprehensive validation suite for Deterministic Tool Parameter Schema Sanitizer,
 * Non-Conforming Key Bidirectional Rewriter & LLM GBNF Grammar Firewall Subsystem (Phase 139 / ADR-115 / Target #72).
 */

import assert from "node:assert";
import { performance } from "node:perf_hooks";

import { DeterministicSchemaSanitizerEngine } from "../src/agents/extensions/schema_sanitizer/deterministic-schema-sanitizer-engine.js";
import { SchemaSanitizerSupervisor } from "../src/agents/extensions/schema_sanitizer/schema-sanitizer-supervisor.js";
import { BroccoliSchemaSanitizerSubstrate } from "../src/sessions/extensions/schema_sanitizer/broccoli-schema-sanitizer-substrate.js";
import { SchemaSanitizerSnapshotManager } from "../src/sessions/extensions/schema_sanitizer/schema-sanitizer-snapshot-manager.js";
import { SchemaSanitizerToolSuite } from "../src/tooling/extensions/schema_sanitizer/schema-sanitizer-tool-suite.js";

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Tool Parameter Schema Sanitizer System (ADR-115)       ");
  console.log("================================================================\n");

  const substrate = new BroccoliSchemaSanitizerSubstrate();
  const engine = new DeterministicSchemaSanitizerEngine();
  const snapshotManager = new SchemaSanitizerSnapshotManager(substrate);
  const supervisor = new SchemaSanitizerSupervisor(substrate, engine);
  const toolSuite = new SchemaSanitizerToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Suite 1: Non-Conforming Property Keys Sanitization & Collision Suffixes
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating Non-Conforming Property Key Sanitization...");

  const rawSchemaWithBadKeys = {
    type: "object",
    properties: {
      "issue_class~neq": { type: "string" },
      "meta.<field>[<op>]": { type: "number" },
      "valid_key-1.0": { type: "boolean" },
      "dup!name": { type: "string" },
      "dup?name": { type: "string" },
    },
    required: ["issue_class~neq", "valid_key-1.0"],
  };

  const result = supervisor.sanitizeToolSchema(rawSchemaWithBadKeys);
  const props = (result.sanitizedSchema.properties || {}) as Record<string, unknown>;

  assert.ok("issue_class_neq" in props, "Must sanitize 'issue_class~neq'");
  assert.ok("meta._field___op__" in props, "Must sanitize 'meta.<field>[<op>]'");
  assert.ok("valid_key-1.0" in props, "Must preserve conforming 'valid_key-1.0'");
  assert.ok("dup_name" in props, "Must sanitize first 'dup!name'");
  assert.ok("dup_name_2" in props, "Must assign numeric suffix to collision 'dup?name'");

  const required = (result.sanitizedSchema.required || []) as string[];
  assert.ok(required.includes("issue_class_neq"), "Required array must reflect renamed keys");
  assert.ok(required.includes("valid_key-1.0"), "Required array must preserve existing keys");

  console.log("  [✓] Non-conforming keys and collision resolution verified.");

  // ---------------------------------------------------------------------------
  // Suite 2: Bidirectional Model Argument Unrenaming
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Bidirectional Argument Unrenaming...");

  const modelEmittedArgs = {
    issue_class_neq: "security_vulnerability",
    "meta._field___op__": 42,
    "valid_key-1.0": true,
    dup_name: "val1",
    dup_name_2: "val2",
  };

  const restoredArgs = supervisor.unrenameToolArgs(rawSchemaWithBadKeys, modelEmittedArgs);
  assert.strictEqual(restoredArgs["issue_class~neq"], "security_vulnerability");
  assert.strictEqual(restoredArgs["meta.<field>[<op>]"], 42);
  assert.strictEqual(restoredArgs["valid_key-1.0"], true);
  assert.strictEqual(restoredArgs["dup!name"], "val1");
  assert.strictEqual(restoredArgs["dup?name"], "val2");

  console.log("  [✓] Bidirectional model argument restoration verified with 100% fidelity.");

  // ---------------------------------------------------------------------------
  // Suite 3: Nullable Union Collapsing
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Nullable Union Collapsing...");

  const schemaWithNullableUnion = {
    type: "object",
    properties: {
      optional_comment: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      array_nullable: {
        type: ["number", "null"],
      },
    },
  };

  const collapsedResult = supervisor.sanitizeToolSchema(schemaWithNullableUnion);
  const colProps = collapsedResult.sanitizedSchema.properties as Record<string, any>;

  assert.strictEqual(colProps.optional_comment.type, "string");
  assert.strictEqual(colProps.optional_comment.nullable, true);
  assert.strictEqual(colProps.optional_comment.anyOf, undefined);

  assert.strictEqual(colProps.array_nullable.type, "number");
  assert.strictEqual(colProps.array_nullable.nullable, true);

  console.log("  [✓] Nullable union and array type collapsing verified.");

  // ---------------------------------------------------------------------------
  // Suite 4: Object Schema Normalization (Missing Properties / Bare Strings)
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Object Normalization & Missing Properties...");

  const bareSchema = {
    type: "object",
    additionalProperties: "object",
  };

  const normResult = supervisor.sanitizeToolSchema(bareSchema);
  assert.deepStrictEqual(normResult.sanitizedSchema.properties, {});
  assert.strictEqual(normResult.sanitizedSchema.additionalProperties, true);

  console.log("  [✓] Missing properties and bare string schema normalization verified.");

  // ---------------------------------------------------------------------------
  // Suite 5: Draft-07 $ref Sibling Keyword Stripping
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Draft-07 $ref Sibling Keyword Stripping...");

  const refSchema = {
    type: "object",
    properties: {
      user_ref: {
        $ref: "#/$defs/User",
        default: null,
      },
    },
  };

  const refResult = supervisor.sanitizeToolSchema(refSchema);
  const refProps = refResult.sanitizedSchema.properties as Record<string, any>;
  assert.strictEqual(refProps.user_ref.$ref, "#/$defs/User");
  assert.strictEqual(refProps.user_ref.default, undefined);

  console.log("  [✓] Forbidden $ref sibling keyword stripping verified.");

  // ---------------------------------------------------------------------------
  // Suite 6: Top-Level Combinator Stripping
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Top-Level Combinator Stripping...");

  const combinatorSchema = {
    type: "object",
    properties: {
      target: { type: "string" },
    },
    allOf: [{ if: { properties: { target: { const: "a" } } }, then: { required: ["target"] } }],
    oneOf: [{ required: ["target"] }],
  };

  const combResult = supervisor.sanitizeToolSchema(combinatorSchema);
  assert.strictEqual((combResult.sanitizedSchema as any).allOf, undefined);
  assert.strictEqual((combResult.sanitizedSchema as any).oneOf, undefined);
  assert.strictEqual(combResult.sanitizedSchema.type, "object");

  console.log("  [✓] Top-level combinator stripping verified.");

  // ---------------------------------------------------------------------------
  // Suite 7: Substrate Binary Snapshotting & Instant O(1) Rollback
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Substrate Binary Snapshotting & O(1) Rollback...");

  const initialSanitized = supervisor.getMetrics().totalSchemasSanitized;
  const snap = snapshotManager.takeSnapshot("snap-schema-1");
  supervisor.sanitizeToolSchema({ type: "object", properties: { "bad~key": { type: "string" } } });
  assert.strictEqual(supervisor.getMetrics().totalSchemasSanitized, initialSanitized + 1);

  // Rewind (warmed)
  snapshotManager.restoreSnapshot("snap-schema-1");
  const tRewindStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("snap-schema-1");
  const rewindLatencyMs = performance.now() - tRewindStart;

  assert.ok(restored, "Restore must succeed");
  assert.strictEqual(supervisor.getMetrics().totalSchemasSanitized, initialSanitized);
  assert.ok(
    rewindLatencyMs < 0.05,
    `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.05 ms SLA`
  );
  console.log(`  [✓] Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms).`);

  // ---------------------------------------------------------------------------
  // Suite 8: Model Tool Suite Execution & Micro-Benchmarks
  // ---------------------------------------------------------------------------
  console.log("\n[Test 8/8] Validating Model Tool Suite & Micro-Benchmarks...");

  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 5, "Must expose exactly 5 model tools");

  const sanitizeTool = tools.find((t) => t.name === "schema_sanitizer_sanitize_tool_schema")!;
  const unrenameTool = tools.find((t) => t.name === "schema_sanitizer_unrename_args")!;
  const validateTool = tools.find((t) => t.name === "schema_sanitizer_validate_property_key")!;
  const configTool = tools.find((t) => t.name === "schema_sanitizer_configure")!;
  const metricsTool = tools.find((t) => t.name === "schema_sanitizer_get_metrics")!;

  const sanRes = (await sanitizeTool.execute(
    { schema: JSON.stringify({ type: "object", properties: { "api:key": { type: "string" } } }) },
    ""
  )) as any;
  assert.strictEqual(sanRes.success, true);
  assert.ok("api_key" in sanRes.sanitizedSchema.properties);

  const unrenRes = (await unrenameTool.execute(
    {
      originalSchema: JSON.stringify({ type: "object", properties: { "api:key": { type: "string" } } }),
      args: JSON.stringify({ api_key: "secret-token-123" }),
    },
    ""
  )) as any;
  assert.strictEqual(unrenRes.success, true);
  assert.strictEqual(unrenRes.unrenamedArgs["api:key"], "secret-token-123");

  const valRes = (await validateTool.execute({ key: "valid_name-1.0" }, "")) as any;
  assert.strictEqual(valRes.success, true);
  assert.strictEqual(valRes.isValid, true);

  const cfgRes = (await configTool.execute({ collapseNullableUnions: true }, "")) as any;
  assert.strictEqual(cfgRes.success, true);

  const metRes = (await metricsTool.execute({}, "")) as any;
  assert.strictEqual(metRes.success, true);
  assert.ok(metRes.metrics.totalSchemasSanitized > 0);

  // Micro-Benchmark
  const iterations = 100000;
  const sampleSchema = {
    type: "object",
    properties: {
      "user~id": { type: "string" },
      status: { anyOf: [{ type: "string" }, { type: "null" }] },
    },
  };
  const cfg = supervisor.getConfig();

  const tBenchStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    engine.sanitizeSchema(sampleSchema, cfg);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(
    `  Measured: ${iterations} schema sanitizations in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/schema | ${throughputOpsPerSec.toLocaleString()} schemas/sec)`
  );
  assert.ok(throughputOpsPerSec > 500000, "Throughput must exceed 500,000 schemas/sec");

  console.log("  [✓] All 5 model tools executed cleanly & ultra-high-throughput benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 SCHEMA SANITIZER VALIDATION SUITES PASSED!            ");
  console.log("================================================================\n");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
