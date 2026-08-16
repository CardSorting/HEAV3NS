/**
 * schema-sanitizer-supervisor.ts
 *
 * Master supervisor managing JSON Schema sanitization before LLM API dispatch,
 * bidirectional argument restoration before tool execution, and metrics aggregation (Phase 139 / ADR-115 / Target #72).
 */

import type { BroccoliSchemaSanitizerSubstrate } from "../../../sessions/extensions/schema_sanitizer/broccoli-schema-sanitizer-substrate.js";
import type { DeterministicSchemaSanitizerEngine } from "./deterministic-schema-sanitizer-engine.js";
import type {
  SchemaSanitizationResult,
  SchemaSanitizerConfig,
  SchemaSanitizerMetrics,
} from "../../../core/contracts/schema-sanitizer.contracts.js";
import { PROPERTY_KEY_REGEX } from "../../../core/contracts/schema-sanitizer.contracts.js";
import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";

export class SchemaSanitizerSupervisor {
  private readonly substrate: BroccoliSchemaSanitizerSubstrate;
  private readonly engine: DeterministicSchemaSanitizerEngine;

  constructor(
    substrate: BroccoliSchemaSanitizerSubstrate,
    engine: DeterministicSchemaSanitizerEngine
  ) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public configure(config: Partial<SchemaSanitizerConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): SchemaSanitizerConfig {
    return this.substrate.getConfig();
  }

  public getMetrics(): SchemaSanitizerMetrics {
    return this.substrate.getMetrics();
  }

  /**
   * Sanitizes a JSON tool parameters schema for cross-provider compatibility.
   */
  public sanitizeToolSchema(rawSchema: Record<string, unknown>): SchemaSanitizationResult {
    const config = this.substrate.getConfig();
    const result = this.engine.sanitizeSchema(rawSchema, config);

    const renamedCount = Object.keys(result.renamedKeys).length;
    const nullableCount = result.mutationsApplied.filter((m) => m.includes("nullable")).length;
    const refCount = result.mutationsApplied.filter((m) => m.includes("$ref")).length;
    const combCount = result.mutationsApplied.filter((m) => m.includes("combinator")).length;

    this.substrate.recordSchemaSanitized(renamedCount, nullableCount, refCount, combCount);

    return result;
  }

  /**
   * Deep-copies and sanitizes an array of LUMI tool definitions.
   */
  public sanitizeToolDefinitions(tools: readonly ToolDefinition[]): ToolDefinition[] {
    const config = this.substrate.getConfig();
    if (!config.enabled) {
      return [...tools];
    }

    return tools.map((tool) => {
      const sanitized = this.sanitizeToolSchema(tool.parameters as unknown as Record<string, unknown>);
      return {
        ...tool,
        parameters: sanitized.sanitizedSchema as unknown as ToolDefinition["parameters"],
      };
    });
  }

  /**
   * Maps model-emitted argument keys back to original raw wire names before execution.
   */
  public unrenameToolArgs(
    paramsSchema: Record<string, unknown> | undefined,
    args: Record<string, unknown> | undefined
  ): Record<string, unknown> {
    const unrenamed = this.engine.unrenameToolArgs(paramsSchema, args);
    this.substrate.recordArgumentUnrenamed();
    return unrenamed;
  }

  /**
   * Validates if a property key complies with standard LLM provider key constraints.
   */
  public validatePropertyKey(key: string): boolean {
    return PROPERTY_KEY_REGEX.test(key);
  }
}
