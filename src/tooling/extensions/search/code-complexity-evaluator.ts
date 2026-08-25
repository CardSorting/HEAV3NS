/**
 * code-complexity-evaluator.ts
 *
 * Code Complexity & Maintainability Index Evaluator.
 * Computes cyclomatic complexity, logical branch counts, function densities,
 * and Microsoft-standard Maintainability Index (0-100) across source files.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface ComplexityMetrics {
  readonly filePath: string;
  readonly linesOfCode: number;
  readonly functionCount: number;
  readonly cyclomaticComplexity: number;
  readonly maintainabilityIndex: number;
  readonly riskRating: "LOW" | "MEDIUM" | "HIGH";
}

export class CodeComplexityEvaluator {
  /**
   * Evaluates code complexity for a single source file.
   */
  public async evaluateFile(filePath: string, rootDir: string): Promise<ComplexityMetrics> {
    const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(rootDir, filePath);
    const content = await fs.readFile(resolvedPath, "utf-8");

    const lines = content.split("\n");
    const loc = lines.filter((l) => l.trim().length > 0 && !l.trim().startsWith("//") && !l.trim().startsWith("/*")).length;

    // Branches for Cyclomatic Complexity
    const branchRegex = /\b(if|else\s+if|case|default|for|while|catch|throw)\b|&&|\|\||\?/g;
    const branchMatches = content.match(branchRegex) || [];
    const cyclomaticComplexity = 1 + branchMatches.length;

    // Function declarations and arrow functions
    const funcRegex = /\b(function|async\s+function)\b|=>|\b(public|private|protected)\s+(async\s+)?([a-zA-Z0-9_$]+)\s*\(/g;
    const funcMatches = content.match(funcRegex) || [];
    const functionCount = Math.max(1, funcMatches.length);

    // Maintainability Index (SEI formula normalized to 0-100)
    const rawMI = 171 - 5.2 * Math.log(Math.max(1, loc)) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(functionCount);
    const maintainabilityIndex = Math.max(0, Math.min(100, Number((rawMI * 100 / 171).toFixed(1))));

    let riskRating: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    if (cyclomaticComplexity > 25 || maintainabilityIndex < 40) {
      riskRating = "HIGH";
    } else if (cyclomaticComplexity > 12 || maintainabilityIndex < 65) {
      riskRating = "MEDIUM";
    }

    return {
      filePath: path.relative(rootDir, resolvedPath).replace(/\\/g, "/"),
      linesOfCode: loc,
      functionCount,
      cyclomaticComplexity,
      maintainabilityIndex,
      riskRating,
    };
  }
}
