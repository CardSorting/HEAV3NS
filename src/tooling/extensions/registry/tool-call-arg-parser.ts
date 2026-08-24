import type {
  ParameterSchema,
  SchemaValidationResult,
  ToolDefinition,
} from "../../../core/contracts/tooling.contracts.js";

const COMMON_PARAM_ALIASES: Record<string, readonly string[]> = {
  path: ["filePath", "file_path", "file", "targetFile", "target_file", "targetPath", "target_path", "filename", "directory", "dir"],
  paths: ["filePaths", "file_paths", "files", "targetFiles"],
  source: ["sourcePath", "source_path", "from", "src", "inputPath"],
  target: ["targetPath", "target_path", "to", "dest", "destination", "outputPath"],
  command: ["cmd", "script", "shellCommand", "shell_command", "run"],
  content: ["text", "body", "data", "code", "fileContent", "file_content"],
  query: ["pattern", "search_term", "searchTerm", "search_query", "term", "q"],
  replacement: ["replace", "new_text", "newText", "newContent", "new_content"],
  startLine: ["start_line", "fromLine", "start"],
  endLine: ["end_line", "toLine", "end"],
};

export interface ParsedToolArgs {
  readonly args: Record<string, unknown>;
  readonly rawInput: string | Record<string, unknown>;
  readonly repaired: boolean;
  readonly errors: readonly string[];
}

/**
 * World-class multi-strategy tool call argument parser and self-healing repair engine.
 * Handles messy, malformed, or ambiguous LLM outputs deterministically.
 */
export class ToolCallArgParser {
  /**
   * Parses raw string or object arguments using multi-stage repair techniques.
   */
  public parseRawArguments(raw: unknown): { args: Record<string, unknown>; repaired: boolean } {
    if (raw === null || raw === undefined) {
      return { args: {}, repaired: false };
    }

    if (typeof raw === "object" && !Array.isArray(raw)) {
      return { args: { ...(raw as Record<string, unknown>) }, repaired: false };
    }

    if (typeof raw !== "string") {
      return { args: {}, repaired: false };
    }

    const trimmed = raw.trim();
    if (!trimmed || trimmed === "{}" || trimmed === "null" || trimmed === "undefined") {
      return { args: {}, repaired: false };
    }

    // Pass 1: Direct JSON.parse
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return { args: parsed, repaired: false };
      }
    } catch {
      // Continue to repair passes
    }

    // Pass 2: Strip Markdown code fences
    let sanitized = trimmed;
    if (sanitized.includes("```")) {
      const match = sanitized.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        sanitized = match[1].trim();
      }
    }

    // Pass 3: Extract first outer JSON object if wrapped in explanatory text
    const firstBrace = sanitized.indexOf("{");
    const lastBrace = sanitized.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      sanitized = sanitized.substring(firstBrace, lastBrace + 1);
    }

    // Try parsing after extraction
    try {
      const parsed = JSON.parse(sanitized);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return { args: parsed, repaired: true };
      }
    } catch {
      // Continue to heuristic repairs
    }

    // Pass 4: Heuristic syntax repair
    const repairedText = this.repairJsonString(sanitized);
    try {
      const parsed = JSON.parse(repairedText);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return { args: parsed, repaired: true };
      }
    } catch {
      // Return empty with raw fallback
    }

    return { args: {}, repaired: true };
  }

  /**
   * Applies heuristic syntax repairs to damaged JSON strings.
   */
  public repairJsonString(input: string): string {
    let text = input.trim();

    // Fix single quotes around keys and values: {'key': 'val'} -> {"key": "val"}
    text = text.replace(/'((?:\\.|[^'])*)'/g, '"$1"');

    // Fix Python boolean and null literals: True -> true, False -> false, None -> null
    text = text.replace(/:\s*\bTrue\b/g, ": true");
    text = text.replace(/:\s*\bFalse\b/g, ": false");
    text = text.replace(/:\s*\bNone\b/g, ": null");

    // Remove trailing commas before closing braces/brackets: { "a": 1, } -> { "a": 1 }
    text = text.replace(/,\s*([\}\]])/g, "$1");

    // Fix unescaped newlines inside strings
    text = text.replace(/:\s*"([^"]*)"/g, (match, str) => {
      const fixed = str.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
      return `: "${fixed}"`;
    });

    // Auto-close missing trailing brackets/braces if truncated
    const openBraces = (text.match(/\{/g) || []).length;
    const closeBraces = (text.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
      text = text + "}".repeat(openBraces - closeBraces);
    }

    const openBrackets = (text.match(/\[/g) || []).length;
    const closeBrackets = (text.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      text = text + "]".repeat(openBrackets - closeBrackets);
    }

    return text;
  }

  /**
   * Normalizes argument names using known canonical aliases and schema hints.
   */
  public normalizeAliases(
    args: Record<string, unknown>,
    toolParams?: Record<string, ParameterSchema>
  ): Record<string, unknown> {
    const normalized: Record<string, unknown> = { ...args };

    for (const [canonicalKey, aliasList] of Object.entries(COMMON_PARAM_ALIASES)) {
      if (normalized[canonicalKey] === undefined) {
        for (const alias of aliasList) {
          if (normalized[alias] !== undefined) {
            normalized[canonicalKey] = normalized[alias];
            break;
          }
        }
      }
    }

    // If tool specifies specific parameter names, check case-insensitive match
    if (toolParams) {
      for (const paramName of Object.keys(toolParams)) {
        if (normalized[paramName] === undefined) {
          const lowerParam = paramName.toLowerCase();
          for (const [key, val] of Object.entries(normalized)) {
            if (key.toLowerCase() === lowerParam) {
              normalized[paramName] = val;
              break;
            }
          }
        }
      }
    }

    return normalized;
  }

  /**
   * Coerces primitive types based on the declared parameter schema.
   */
  public coerceTypes(
    args: Record<string, unknown>,
    paramsSchema?: Record<string, ParameterSchema>
  ): Record<string, unknown> {
    if (!paramsSchema) return { ...args };

    const coerced: Record<string, unknown> = { ...args };

    for (const [paramName, schema] of Object.entries(paramsSchema)) {
      const val = coerced[paramName];
      if (val === undefined || val === null) continue;

      if (schema.type === "number" || schema.type === "integer") {
        if (typeof val === "string") {
          const num = schema.type === "integer" ? parseInt(val, 10) : parseFloat(val);
          if (!isNaN(num)) {
            coerced[paramName] = num;
          }
        }
      } else if (schema.type === "boolean") {
        if (typeof val === "string") {
          const lower = val.trim().toLowerCase();
          if (lower === "true" || lower === "1" || lower === "yes") {
            coerced[paramName] = true;
          } else if (lower === "false" || lower === "0" || lower === "no") {
            coerced[paramName] = false;
          }
        }
      } else if (schema.type === "string") {
        if (typeof val !== "string") {
          coerced[paramName] = String(val);
        }
      } else if (schema.type === "array") {
        if (!Array.isArray(val)) {
          if (typeof val === "string") {
            const trimmed = val.trim();
            if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
              try {
                coerced[paramName] = JSON.parse(trimmed);
              } catch {
                coerced[paramName] = [val];
              }
            } else if (trimmed.includes(",")) {
              coerced[paramName] = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
            } else if (trimmed.length > 0) {
              coerced[paramName] = [trimmed];
            } else {
              coerced[paramName] = [];
            }
          } else {
            coerced[paramName] = [val];
          }
        }
      } else if (schema.type === "object") {
        if (typeof val === "string") {
          const trimmed = val.trim();
          if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            try {
              coerced[paramName] = JSON.parse(trimmed);
            } catch {
              // keep as-is
            }
          }
        }
      }
    }

    // Auto-parse stringified JSON for any remaining properties not explicitly constrained
    for (const [key, val] of Object.entries(coerced)) {
      if (typeof val === "string") {
        const trimmed = val.trim();
        if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
          try {
            coerced[key] = JSON.parse(trimmed);
          } catch {
            // keep as string
          }
        }
      }
    }

    return coerced;
  }

  /**
   * Validates arguments against tool parameter schemas and generates self-healing diagnostic errors with suggestions.
   */
  public validate(
    tool: ToolDefinition,
    args: Record<string, unknown>
  ): SchemaValidationResult {
    const errors: string[] = [];
    const suggestions: string[] = [];

    if (!tool.parameters) {
      return { valid: true, errors: [] };
    }

    const availableParams = Object.keys(tool.parameters);

    for (const [paramName, schema] of Object.entries(tool.parameters)) {
      const val = args[paramName];

      if (schema.required) {
        if (val === undefined || val === null || val === "") {
          errors.push(`Missing required parameter '${paramName}' for tool '${tool.name}'`);

          // Check if user passed an obvious alias
          const passedKeys = Object.keys(args);
          const similar = passedKeys.find(
            (k) => k.toLowerCase() === paramName.toLowerCase() || k.includes(paramName) || paramName.includes(k)
          );
          if (similar) {
            suggestions.push(`Found parameter '${similar}'. Use '${paramName}' instead.`);
          } else {
            suggestions.push(`Required parameter '${paramName}' (${schema.description || schema.type}) is required. Available parameters: ${availableParams.join(", ")}`);
          }
          continue;
        }
      }

      if (val !== undefined && val !== null) {
        let typeMatches = true;
        if (schema.type === "array") {
          typeMatches = Array.isArray(val);
        } else if (schema.type === "object") {
          typeMatches = typeof val === "object" && val !== null && !Array.isArray(val);
        } else if (schema.type === "integer") {
          typeMatches = typeof val === "number" && Number.isInteger(val);
        } else if (schema.type === "number") {
          typeMatches = typeof val === "number" && !isNaN(val);
        } else {
          typeMatches = typeof val === schema.type;
        }

        if (!typeMatches) {
          errors.push(`Parameter '${paramName}' must be of type '${schema.type}', got '${Array.isArray(val) ? "array" : typeof val}'`);
        }

        if (schema.enum && schema.enum.length > 0) {
          if (!schema.enum.includes(val as any)) {
            errors.push(`Parameter '${paramName}' must be one of: [${schema.enum.join(", ")}], got '${val}'`);
            suggestions.push(`Valid values for '${paramName}' are: ${schema.enum.join(", ")}`);
          }
        }

        if (typeof schema.minimum === "number" && typeof val === "number" && val < schema.minimum) {
          errors.push(`Parameter '${paramName}' must be >= ${schema.minimum}, got ${val}`);
        }

        if (typeof schema.maximum === "number" && typeof val === "number" && val > schema.maximum) {
          errors.push(`Parameter '${paramName}' must be <= ${schema.maximum}, got ${val}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  /**
   * Executes the full pipeline: Parse -> Alias Normalize -> Coerce Types -> Validate.
   */
  public prepareArguments(
    tool: ToolDefinition,
    raw: unknown
  ): {
    args: Record<string, unknown>;
    validation: SchemaValidationResult;
    repaired: boolean;
  } {
    const { args: parsed, repaired } = this.parseRawArguments(raw);
    const aliased = this.normalizeAliases(parsed, tool.parameters);
    const coerced = this.coerceTypes(aliased, tool.parameters);
    const validation = this.validate(tool, coerced);

    return {
      args: coerced,
      validation,
      repaired,
    };
  }
}
