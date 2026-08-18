/**
 * deterministic-schema-sanitizer-engine.ts
 *
 * Pure TypeScript deterministic JSON Schema AST transformer, key sanitizer,
 * and bidirectional tool argument restorer (Phase 139 / ADR-115 / Target #72).
 */

import type {
  SchemaSanitizationResult,
  SchemaSanitizerConfig,
} from "../../../core/contracts/schema-sanitizer.contracts.js";
import {
  FORBIDDEN_REF_SIBLING_KEYWORDS,
  PROPERTY_KEY_INVALID_CHARS_REGEX,
  PROPERTY_KEY_REGEX,
  TOP_LEVEL_FORBIDDEN_COMBINATORS,
} from "../../../core/contracts/schema-sanitizer.contracts.js";

export class DeterministicSchemaSanitizerEngine {
  /**
   * Deterministically sanitizes an OpenAI/Anthropic tool parameters schema.
   */
  public sanitizeSchema(
    rawSchema: Record<string, unknown>,
    config: SchemaSanitizerConfig
  ): SchemaSanitizationResult {
    if (!config.enabled) {
      return {
        sanitizedSchema: JSON.parse(JSON.stringify(rawSchema)),
        renamedKeys: {},
        mutationsApplied: [],
        warnings: [],
      };
    }

    const mutations: string[] = [];
    const warnings: string[] = [];
    const renamedKeys: Record<string, string> = {};

    // Deep clone to prevent mutating original
    let schema: Record<string, unknown> = JSON.parse(JSON.stringify(rawSchema));

    // Ensure root is an object with properties
    if (typeof schema !== "object" || schema === null || Array.isArray(schema)) {
      mutations.push("Normalized invalid root to object schema");
      return {
        sanitizedSchema: { type: "object", properties: {} },
        renamedKeys: {},
        mutationsApplied: mutations,
        warnings: ["Root schema was not a valid object"],
      };
    }

    // Step 1: Strip top-level forbidden combinators
    if (config.stripTopLevelCombinators) {
      for (const comb of TOP_LEVEL_FORBIDDEN_COMBINATORS) {
        if (comb in schema) {
          delete schema[comb];
          mutations.push(`Stripped top-level combinator '${comb}'`);
        }
      }
    }

    // Step 2: Recursive node sanitization
    schema = this.sanitizeNode(schema, "", config, renamedKeys, mutations, warnings);

    // Step 3: Collapse nullable unions
    if (config.collapseNullableUnions) {
      schema = this.collapseNullableUnions(schema, mutations);
    }

    // Step 4: Strip forbidden $ref siblings
    if (config.stripRefSiblings) {
      schema = this.stripRefSiblings(schema, mutations);
    }

    // Ensure top-level structure is strictly valid
    if (schema.type !== "object") {
      schema.type = "object";
      mutations.push("Forced root type to 'object'");
    }
    if (!schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) {
      schema.properties = {};
      mutations.push("Initialized missing root properties dictionary");
    }

    return {
      sanitizedSchema: schema,
      renamedKeys,
      mutationsApplied: mutations,
      warnings,
    };
  }

  /**
   * Maps sanitized property keys in model-emitted arguments back to original wire names.
   */
  public unrenameToolArgs(
    paramsSchema: Record<string, unknown> | undefined,
    args: Record<string, unknown> | undefined
  ): Record<string, unknown> {
    if (!paramsSchema || typeof paramsSchema !== "object" || !args || typeof args !== "object") {
      return args || {};
    }

    const props = paramsSchema.properties as Record<string, unknown> | undefined;
    if (!props || typeof props !== "object" || Array.isArray(props)) {
      return { ...args };
    }

    const renames = this.computePropertyKeyRenames(props);
    const reverseMap: Record<string, string> = {};
    for (const [orig, renamed] of Object.entries(renames)) {
      reverseMap[renamed] = orig;
    }

    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args)) {
      const origKey = reverseMap[key] || key;
      const subSchema = props[origKey] as Record<string, unknown> | undefined;

      if (subSchema && typeof subSchema === "object") {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          output[origKey] = this.unrenameToolArgs(subSchema, value as Record<string, unknown>);
          continue;
        }
        if (Array.isArray(value) && subSchema.items && typeof subSchema.items === "object") {
          output[origKey] = value.map((item) =>
            typeof item === "object" && item !== null && !Array.isArray(item)
              ? this.unrenameToolArgs(subSchema.items as Record<string, unknown>, item as Record<string, unknown>)
              : item
          );
          continue;
        }
      }

      output[origKey] = value;
    }

    return output;
  }

  /**
   * Deterministically sanitizes an individual property key to match ^[a-zA-Z0-9_.-]{1,64}$.
   */
  public sanitizePropertyKey(key: string, maxLen: number = 64): string {
    const cleaned = key.replace(PROPERTY_KEY_INVALID_CHARS_REGEX, "_").substring(0, maxLen);
    return cleaned || "param";
  }

  /**
   * Computes property key rename dictionary for a given properties object.
   */
  public computePropertyKeyRenames(props: Record<string, unknown>): Record<string, string> {
    const renames: Record<string, string> = {};
    const taken = new Set<string>();

    for (const key of Object.keys(props)) {
      if (PROPERTY_KEY_REGEX.test(key)) {
        taken.add(key);
      }
    }

    for (const key of Object.keys(props)) {
      if (PROPERTY_KEY_REGEX.test(key)) {
        continue;
      }
      const base = this.sanitizePropertyKey(key);
      let candidate = base;
      let suffix = 2;
      while (taken.has(candidate)) {
        const sufStr = `_${suffix}`;
        candidate = base.substring(0, 64 - sufStr.length) + sufStr;
        suffix++;
      }
      taken.add(candidate);
      renames[key] = candidate;
    }

    return renames;
  }

  // ---------------------------------------------------------------------------
  // Internal Recursive AST Sanitizers
  // ---------------------------------------------------------------------------

  private sanitizeNode(
    node: unknown,
    currentPath: string,
    config: SchemaSanitizerConfig,
    renamedKeys: Record<string, string>,
    mutations: string[],
    warnings: string[]
  ): Record<string, unknown> {
    if (typeof node !== "object" || node === null || Array.isArray(node)) {
      return { type: "string" };
    }

    const dict = { ...(node as Record<string, unknown>) };

    // Handle "type": ["string", "null"] array types
    if (Array.isArray(dict.type)) {
      const nonNullTypes = dict.type.filter((t) => t !== "null");
      if (nonNullTypes.length === 1) {
        dict.type = nonNullTypes[0];
        dict.nullable = true;
        mutations.push(`Collapsed array type at '${currentPath}' to '${dict.type}' with nullable: true`);
      } else if (nonNullTypes.length > 1) {
        dict.type = nonNullTypes[0];
        mutations.push(`Reduced multi-type array at '${currentPath}' to first type '${dict.type}'`);
      } else {
        dict.type = "string";
        dict.nullable = true;
      }
    }

    // Handle bare string in additionalProperties / properties
    if (dict.additionalProperties === "object" || typeof dict.additionalProperties === "string") {
      dict.additionalProperties = true;
      mutations.push(`Normalized bare string additionalProperties at '${currentPath}'`);
    }

    // Handle object type missing properties
    if (dict.type === "object" && (!dict.properties || typeof dict.properties !== "object" || Array.isArray(dict.properties))) {
      dict.properties = {};
      mutations.push(`Added missing empty properties object at '${currentPath}'`);
    }

    // Sanitize properties object
    if (dict.properties && typeof dict.properties === "object" && !Array.isArray(dict.properties)) {
      const rawProps = dict.properties as Record<string, unknown>;
      const sanitizedProps: Record<string, unknown> = {};

      if (config.enforceConformingKeys) {
        const renames = this.computePropertyKeyRenames(rawProps);
        for (const [origKey, val] of Object.entries(rawProps)) {
          const conformingKey = renames[origKey] || origKey;
          if (conformingKey !== origKey) {
            renamedKeys[origKey] = conformingKey;
            mutations.push(`Renamed non-conforming property key '${origKey}' -> '${conformingKey}' at '${currentPath}'`);
          }
          sanitizedProps[conformingKey] = this.sanitizeNode(
            val,
            currentPath ? `${currentPath}.${conformingKey}` : conformingKey,
            config,
            renamedKeys,
            mutations,
            warnings
          );
        }

        // Update required list if keys were renamed
        if (Array.isArray(dict.required)) {
          dict.required = dict.required.map((reqKey) =>
            typeof reqKey === "string" ? renames[reqKey] || reqKey : reqKey
          );
        }
      } else {
        for (const [k, val] of Object.entries(rawProps)) {
          sanitizedProps[k] = this.sanitizeNode(
            val,
            currentPath ? `${currentPath}.${k}` : k,
            config,
            renamedKeys,
            mutations,
            warnings
          );
        }
      }

      dict.properties = sanitizedProps;
    }

    // Sanitize array items
    if (dict.items && typeof dict.items === "object" && !Array.isArray(dict.items)) {
      dict.items = this.sanitizeNode(
        dict.items,
        `${currentPath}[]`,
        config,
        renamedKeys,
        mutations,
        warnings
      );
    }

    return dict;
  }

  private collapseNullableUnions(
    node: Record<string, unknown>,
    mutations: string[]
  ): Record<string, unknown> {
    const dict = { ...node };

    for (const unionKey of ["anyOf", "oneOf"] as const) {
      if (Array.isArray(dict[unionKey])) {
        const branches = dict[unionKey] as unknown[];
        if (branches.length === 2) {
          const nullBranchIdx = branches.findIndex(
            (b) => typeof b === "object" && b !== null && (b as Record<string, unknown>).type === "null"
          );
          if (nullBranchIdx !== -1) {
            const nonNullBranch = branches[1 - nullBranchIdx] as Record<string, unknown>;
            if (typeof nonNullBranch === "object" && nonNullBranch !== null) {
              delete dict[unionKey];
              Object.assign(dict, nonNullBranch);
              dict.nullable = true;
              mutations.push(`Collapsed nullable ${unionKey} union to single type with nullable: true`);
            }
          }
        }
      }
    }

    if (dict.properties && typeof dict.properties === "object" && !Array.isArray(dict.properties)) {
      const newProps: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(dict.properties as Record<string, unknown>)) {
        newProps[k] =
          typeof v === "object" && v !== null && !Array.isArray(v)
            ? this.collapseNullableUnions(v as Record<string, unknown>, mutations)
            : v;
      }
      dict.properties = newProps;
    }

    if (dict.items && typeof dict.items === "object" && !Array.isArray(dict.items)) {
      dict.items = this.collapseNullableUnions(dict.items as Record<string, unknown>, mutations);
    }

    return dict;
  }

  private stripRefSiblings(
    node: Record<string, unknown>,
    mutations: string[]
  ): Record<string, unknown> {
    const dict = { ...node };

    if ("$ref" in dict) {
      for (const forbidden of FORBIDDEN_REF_SIBLING_KEYWORDS) {
        if (forbidden in dict) {
          delete dict[forbidden];
          mutations.push(`Stripped forbidden sibling keyword '${forbidden}' from $ref node`);
        }
      }
    }

    if (dict.properties && typeof dict.properties === "object" && !Array.isArray(dict.properties)) {
      const newProps: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(dict.properties as Record<string, unknown>)) {
        newProps[k] =
          typeof v === "object" && v !== null && !Array.isArray(v)
            ? this.stripRefSiblings(v as Record<string, unknown>, mutations)
            : v;
      }
      dict.properties = newProps;
    }

    if (dict.items && typeof dict.items === "object" && !Array.isArray(dict.items)) {
      dict.items = this.stripRefSiblings(dict.items as Record<string, unknown>, mutations);
    }

    return dict;
  }

  public formatSanitizeResult(result: SchemaSanitizationResult): string {
    const renamedCount = Object.keys(result.renamedKeys).length;
    return `[SCHEMA-SANITIZED] ${result.mutationsApplied.length} mutations, ${renamedCount} keys renamed, ${result.warnings.length} warnings`;
  }

  public formatSanitizerMetrics(metrics: { totalSchemas: number; renamedKeys: number }): string {
    return `[SCHEMA-METRICS] Schemas: ${metrics.totalSchemas} | Renamed Keys: ${metrics.renamedKeys}`;
  }
}

