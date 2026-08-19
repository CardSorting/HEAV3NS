/**
 * [LAYER: AGENTS EXTENSION]
 * file-predicate-evaluator.ts
 *
 * In-memory zero-subshell file predicate and JSONPath inspection engine (Phase 193 / ADR-123).
 * Evaluates file existence, non-emptiness, substring inclusion/exclusion, regex matching,
 * and JSONPath assertions natively without spawning shell child processes.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { FilePredicateConfig } from "../../../core/contracts/runbook.contracts.js";

export interface PredicateEvaluationResult {
  readonly passed: boolean;
  readonly errors: readonly string[];
  readonly output: string;
}

export class FilePredicateEvaluator {
  /**
   * Evaluates a declarative FilePredicateConfig against the filesystem.
   */
  evaluate(config: FilePredicateConfig, baseDir: string = process.cwd()): PredicateEvaluationResult {
    const rawPath = config.path;
    if (!rawPath || typeof rawPath !== "string") {
      return {
        passed: false,
        errors: ["Predicate requires a valid 'path' string"],
        output: "Predicate evaluation error: missing 'path'",
      };
    }

    const effectiveCwd = config.cwd ? (path.isAbsolute(config.cwd) ? config.cwd : path.resolve(baseDir, config.cwd)) : baseDir;
    const resolvedPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(effectiveCwd, rawPath);

    const errors: string[] = [];
    const exists = fs.existsSync(resolvedPath);

    if (config.exists !== undefined) {
      const expected = Boolean(config.exists);
      if (exists !== expected) {
        errors.push(`File existence expected ${expected}, got ${exists}: ${resolvedPath}`);
      }
    }

    const needsContent = Boolean(
      config.nonEmpty ||
      config.contains !== undefined ||
      config.notContains !== undefined ||
      config.matchesPattern !== undefined ||
      config.jsonPath !== undefined
    );

    if (needsContent && !exists) {
      errors.push(`File does not exist for content inspection: ${resolvedPath}`);
      return {
        passed: false,
        errors,
        output: errors.join("; "),
      };
    }

    if (exists) {
      try {
        const stats = fs.statSync(resolvedPath);

        if (config.nonEmpty === true && stats.size === 0) {
          errors.push(`File is empty (0 bytes): ${resolvedPath}`);
        }

        if (config.contains !== undefined || config.notContains !== undefined || config.matchesPattern !== undefined || config.jsonPath !== undefined) {
          const content = fs.readFileSync(resolvedPath, "utf-8");

          if (config.contains !== undefined && !content.includes(String(config.contains))) {
            errors.push(`File does not contain expected text: "${config.contains}"`);
          }

          if (config.notContains !== undefined && content.includes(String(config.notContains))) {
            errors.push(`File contains forbidden text: "${config.notContains}"`);
          }

          if (config.matchesPattern !== undefined) {
            try {
              const regex = new RegExp(config.matchesPattern);
              if (!regex.test(content)) {
                errors.push(`File content does not match regex: /${config.matchesPattern}/`);
              }
            } catch (reErr) {
              errors.push(`Invalid regular expression pattern "${config.matchesPattern}": ${(reErr as Error).message}`);
            }
          }

          if (config.jsonPath !== undefined) {
            try {
              const parsed = JSON.parse(content);
              const { found, value } = this.resolveJsonPath(parsed, String(config.jsonPath));

              if (!found) {
                errors.push(`JSON path not found: "${config.jsonPath}"`);
              } else {
                if (config.equals !== undefined && value !== config.equals) {
                  errors.push(
                    `JSON path "${config.jsonPath}" expected ${JSON.stringify(config.equals)}, got ${JSON.stringify(value)}`
                  );
                }
                if (config.oneOf !== undefined && Array.isArray(config.oneOf)) {
                  if (!config.oneOf.includes(value)) {
                    errors.push(
                      `JSON path "${config.jsonPath}" value ${JSON.stringify(value)} not in allowed set: ${JSON.stringify(config.oneOf)}`
                    );
                  }
                }
              }
            } catch (jsonErr) {
              errors.push(`Invalid JSON content in ${resolvedPath}: ${(jsonErr as Error).message}`);
            }
          }
        }
      } catch (readErr) {
        errors.push(`Failed to read file ${resolvedPath}: ${(readErr as Error).message}`);
      }
    }

    const passed = errors.length === 0;
    return {
      passed,
      errors,
      output: passed ? `Predicate passed for ${resolvedPath}` : errors.join("; "),
    };
  }

  /**
   * Resolves dot-separated or index-separated path against a JSON data object.
   * e.g. "a.b.2.c" or "status"
   */
  resolveJsonPath(data: unknown, pathExpr: string): { found: boolean; value: unknown } {
    if (!pathExpr || typeof pathExpr !== "string") {
      return { found: true, value: data };
    }

    let current = data;
    const parts = pathExpr.split(".");

    for (const part of parts) {
      if (current === null || current === undefined) {
        return { found: false, value: undefined };
      }

      if (typeof current === "object") {
        if (Array.isArray(current)) {
          const idx = parseInt(part, 10);
          if (!isNaN(idx) && idx >= 0 && idx < current.length) {
            current = current[idx];
          } else {
            return { found: false, value: undefined };
          }
        } else if (part in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return { found: false, value: undefined };
        }
      } else {
        return { found: false, value: undefined };
      }
    }

    return { found: true, value: current };
  }
}
