/**
 * schema-sanitizer-tool-suite.ts
 *
 * Model tool definitions exposing JSON Schema Sanitizer & Bidirectional Key Rewriting
 * (Phase 139 / ADR-115 / Target #72).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { SchemaSanitizerSupervisor } from "../../../agents/extensions/schema_sanitizer/schema-sanitizer-supervisor.js";

export class SchemaSanitizerToolSuite {
  private readonly supervisor: SchemaSanitizerSupervisor;

  constructor(supervisor: SchemaSanitizerSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "schema_sanitizer_sanitize_tool_schema",
        description: "Sanitizes a JSON tool parameters schema to ensure 100% compatibility across Anthropic, OpenAI Codex, Bedrock, and local llama.cpp GBNF parsers.",
        parameters: {
          schema: {
            type: "string",
            description: "JSON string or object representing the tool parameters schema.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          let rawSchema: Record<string, unknown> = {};
          if (typeof args.schema === "string") {
            try {
              rawSchema = JSON.parse(args.schema);
            } catch {
              rawSchema = { type: "object", properties: {} };
            }
          } else if (typeof args.schema === "object" && args.schema !== null) {
            rawSchema = args.schema as Record<string, unknown>;
          }

          const result = this.supervisor.sanitizeToolSchema(rawSchema);

          return {
            success: true,
            sanitizedSchema: result.sanitizedSchema,
            renamedKeys: result.renamedKeys,
            mutationsApplied: result.mutationsApplied,
            warnings: result.warnings,
          };
        },
      },
      {
        name: "schema_sanitizer_unrename_args",
        description: "Maps sanitized argument keys emitted by LLMs back to raw original wire property names using the original parameters schema.",
        parameters: {
          originalSchema: {
            type: "string",
            description: "JSON string or object of the original raw parameters schema.",
            required: true,
          },
          args: {
            type: "string",
            description: "JSON string or object of model-emitted arguments.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          let originalSchema: Record<string, unknown> = {};
          let emittedArgs: Record<string, unknown> = {};

          if (typeof args.originalSchema === "string") {
            try {
              originalSchema = JSON.parse(args.originalSchema);
            } catch {
              originalSchema = {};
            }
          } else if (typeof args.originalSchema === "object" && args.originalSchema !== null) {
            originalSchema = args.originalSchema as Record<string, unknown>;
          }

          if (typeof args.args === "string") {
            try {
              emittedArgs = JSON.parse(args.args);
            } catch {
              emittedArgs = {};
            }
          } else if (typeof args.args === "object" && args.args !== null) {
            emittedArgs = args.args as Record<string, unknown>;
          }

          const unrenamed = this.supervisor.unrenameToolArgs(originalSchema, emittedArgs);

          return {
            success: true,
            unrenamedArgs: unrenamed,
          };
        },
      },
      {
        name: "schema_sanitizer_validate_property_key",
        description: "Validates whether a property key conforms to strict provider regex constraints (^[a-zA-Z0-9_.-]{1,64}$).",
        parameters: {
          key: {
            type: "string",
            description: "Property key name to validate.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const key = String(args.key || "");
          const isValid = this.supervisor.validatePropertyKey(key);

          return {
            success: true,
            key,
            isValid,
          };
        },
      },
      {
        name: "schema_sanitizer_configure",
        description: "Configures active JSON schema sanitization policies.",
        parameters: {
          enabled: {
            type: "boolean",
            description: "Whether schema sanitization is enabled.",
            required: false,
          },
          enforceConformingKeys: {
            type: "boolean",
            description: "Whether to rewrite non-conforming property keys.",
            required: false,
          },
          collapseNullableUnions: {
            type: "boolean",
            description: "Whether to collapse anyOf nullable unions to single types.",
            required: false,
          },
          stripRefSiblings: {
            type: "boolean",
            description: "Whether to remove forbidden sibling keywords from $ref nodes.",
            required: false,
          },
          stripTopLevelCombinators: {
            type: "boolean",
            description: "Whether to strip top-level combinators.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const enabled = typeof args.enabled === "boolean" ? args.enabled : undefined;
          const enforceConformingKeys =
            typeof args.enforceConformingKeys === "boolean" ? args.enforceConformingKeys : undefined;
          const collapseNullableUnions =
            typeof args.collapseNullableUnions === "boolean"
              ? args.collapseNullableUnions
              : undefined;
          const stripRefSiblings =
            typeof args.stripRefSiblings === "boolean" ? args.stripRefSiblings : undefined;
          const stripTopLevelCombinators =
            typeof args.stripTopLevelCombinators === "boolean"
              ? args.stripTopLevelCombinators
              : undefined;

          this.supervisor.configure({
            enabled,
            enforceConformingKeys,
            collapseNullableUnions,
            stripRefSiblings,
            stripTopLevelCombinators,
          });

          return {
            success: true,
            config: this.supervisor.getConfig(),
          };
        },
      },
      {
        name: "schema_sanitizer_get_metrics",
        description: "Retrieves operational metrics for schema transformations.",
        parameters: {},
        execute: async () => {
          const metrics = this.supervisor.getMetrics();

          return {
            success: true,
            metrics,
          };
        },
      },
    ];
  }
}
