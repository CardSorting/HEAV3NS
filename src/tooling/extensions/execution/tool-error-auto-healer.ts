/**
 * tool-error-auto-healer.ts
 *
 * Model-Facing Conversational Diagnostic & Self-Healing Error Recovery Subsystem.
 * When a tool execution encounters an error (e.g., file not found, bad line ranges,
 * missing target edit chunk, command exit code non-zero), synthesizes actionable,
 * precise remediation advice with fuzzy matching to help the LLM self-correct immediately.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";

export interface HealedErrorResult {
  readonly originalError: string;
  readonly actionableMessage: string;
  readonly suggestions: readonly string[];
  readonly remediationAction?: string;
  readonly matchedCandidates?: readonly string[];
}

export class ToolErrorAutoHealer {
  /**
   * Performs whitespace- and indentation-tolerant fuzzy chunk location in file content.
   */
  public healFuzzyPatch(
    fileContent: string,
    targetSnippet: string
  ): { found: boolean; startIndex?: number; endIndex?: number; confidence: number; adjustedTarget?: string } {
    if (!fileContent || !targetSnippet) {
      return { found: false, confidence: 0 };
    }

    // Pass 1: Direct exact match
    const exactIndex = fileContent.indexOf(targetSnippet);
    if (exactIndex !== -1) {
      return {
        found: true,
        startIndex: exactIndex,
        endIndex: exactIndex + targetSnippet.length,
        confidence: 1.0,
        adjustedTarget: targetSnippet,
      };
    }

    // Pass 2: Line-by-line whitespace-trimmed comparison
    const fileLines = fileContent.split(/\r?\n/);
    const targetLines = targetSnippet.split(/\r?\n/).filter((l) => l.length > 0);

    if (targetLines.length === 0) {
      return { found: false, confidence: 0 };
    }

    for (let i = 0; i <= fileLines.length - targetLines.length; i++) {
      let matches = true;
      for (let j = 0; j < targetLines.length; j++) {
        if (fileLines[i + j].trim() !== targetLines[j].trim()) {
          matches = false;
          break;
        }
      }

      if (matches) {
        // Found matching line range [i, i + targetLines.length - 1]
        const matchedLines = fileLines.slice(i, i + targetLines.length);
        const adjustedTarget = matchedLines.join("\n");
        const startIndex = fileContent.indexOf(matchedLines[0]);
        if (startIndex !== -1) {
          return {
            found: true,
            startIndex,
            endIndex: startIndex + adjustedTarget.length,
            confidence: 0.95,
            adjustedTarget,
          };
        }
      }
    }

    return { found: false, confidence: 0 };
  }

  /**
   * Computes Levenshtein edit distance between two strings.
   */
  public levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Finds the best matching parameter name from valid parameters using Levenshtein distance.
   */
  public fuzzyMatchParameter(
    paramName: string,
    validParams: readonly string[]
  ): { match?: string; score: number } {
    const target = paramName.toLowerCase();
    let bestMatch: string | undefined;
    let minDistance = Infinity;

    for (const valid of validParams) {
      const v = valid.toLowerCase();
      if (v === target) return { match: valid, score: 1.0 };
      if (v.includes(target) || target.includes(v)) {
        return { match: valid, score: 0.9 };
      }

      const dist = this.levenshtein(target, v);
      if (dist < minDistance && dist <= 3) {
        minDistance = dist;
        bestMatch = valid;
      }
    }

    if (bestMatch) {
      const score = Math.max(0, 1 - minDistance / Math.max(target.length, bestMatch.length));
      return { match: bestMatch, score };
    }

    return { score: 0 };
  }

  /**
   * Analyzes a tool execution failure and generates self-healing diagnostic guidance.
   */
  public diagnoseAndHeal(
    toolName: string,
    args: Record<string, unknown>,
    error: unknown,
    cwd: string,
    toolDef?: ToolDefinition
  ): HealedErrorResult {
    const rawError = error instanceof Error ? error.message : String(error);
    const suggestions: string[] = [];
    let actionableMessage = rawError;
    let remediationAction: string | undefined;
    let matchedCandidates: string[] | undefined;

    const lowerError = rawError.toLowerCase();
    const filePath = typeof args.path === "string" ? args.path : (typeof args.filePath === "string" ? args.filePath : undefined);

    // 1. File / Path Not Found Heuristics
    if (
      lowerError.includes("no such file") ||
      lowerError.includes("enoent") ||
      lowerError.includes("not found") ||
      lowerError.includes("cannot find")
    ) {
      if (filePath) {
        const basename = path.basename(filePath);
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
        const dir = path.dirname(resolvedPath);

        let nearbyFiles: string[] = [];
        try {
          if (fs.existsSync(dir)) {
            nearbyFiles = fs.readdirSync(dir);
          } else if (fs.existsSync(cwd)) {
            nearbyFiles = fs.readdirSync(cwd);
          }
        } catch {
          // ignore fs access errors
        }

        // Fuzzy match basename against nearby files
        const matches = nearbyFiles
          .filter((f) => f.toLowerCase().includes(basename.toLowerCase()) || basename.toLowerCase().includes(f.toLowerCase()))
          .slice(0, 5);

        if (matches.length > 0) {
          matchedCandidates = matches;
          suggestions.push(`Did you mean one of these files? ${matches.map((m) => `"${m}"`).join(", ")}`);
          actionableMessage = `File not found: '${filePath}'.\nPossible matches in workspace: ${matches.join(", ")}`;
          remediationAction = `Check the file path or run list_dir on '${dir}' to inspect directory contents.`;
        } else {
          suggestions.push(`Run list_dir or find_files to locate the target file.`);
          remediationAction = `Verify the relative path relative to working directory '${cwd}'.`;
        }
      }
    }

    // 2. File Edit / Chunk Not Found Heuristics
    else if (
      lowerError.includes("could not find target content") ||
      lowerError.includes("target content not found") ||
      lowerError.includes("failed to locate exact match") ||
      lowerError.includes("chunk")
    ) {
      const targetChunk = typeof args.targetContent === "string" ? args.targetContent : (typeof args.target === "string" ? args.target : undefined);
      suggestions.push("The target content must match existing file content character-for-character, including whitespace and line endings.");
      suggestions.push("Run view_file with specific startLine and endLine to inspect the exact lines before replacing.");
      actionableMessage = `Target content to replace was not found in '${filePath || "target file"}'.`;
      if (targetChunk) {
        const preview = targetChunk.slice(0, 100).replace(/\n/g, "\\n");
        actionableMessage += `\nTarget snippet: "${preview}"`;
      }
      remediationAction = "Call view_file on the target line range to verify the exact string before making the edit.";
    }

    // 3. Line Number Out of Bounds
    else if (lowerError.includes("out of range") || lowerError.includes("line number") || lowerError.includes("startline")) {
      suggestions.push("Inspect the total number of lines with view_file without line constraints.");
      actionableMessage = `Requested line numbers are out of bounds for '${filePath || "target file"}'.`;
      remediationAction = "Query file with view_file without startLine/endLine to discover valid line bounds.";
    }

    // 4. Command Execution Failure / Non-Zero Exit Code
    else if (lowerError.includes("command failed") || lowerError.includes("exit code") || toolName === "run_command" || toolName === "terminal") {
      const cmd = typeof args.command === "string" ? args.command : (typeof args.cmd === "string" ? args.cmd : "");
      suggestions.push(`Examine stderr to understand why '${cmd.slice(0, 60)}' failed.`);
      if (cmd.includes("npm") && (lowerError.includes("missing") || lowerError.includes("not found"))) {
        suggestions.push("Check if node_modules dependencies are installed with 'npm install'.");
      }
      actionableMessage = `Command execution returned an error:\n${rawError}`;
      remediationAction = "Review the command output and adjust arguments or dependencies.";
    }

    // 5. Schema Validation & Missing Parameter Diagnostics
    else if (toolDef && toolDef.parameters) {
      const requiredParams = Object.entries(toolDef.parameters)
        .filter(([_, schema]) => schema.required)
        .map(([name]) => name);

      const missingRequired = requiredParams.filter((p) => args[p] === undefined || args[p] === null);
      if (missingRequired.length > 0) {
        suggestions.push(`Missing required parameter(s): ${missingRequired.map((p) => `'${p}'`).join(", ")}`);
        const exampleObj: Record<string, unknown> = {};
        for (const p of requiredParams) {
          const schema = toolDef.parameters[p];
          exampleObj[p] = schema?.type === "number" ? 1 : schema?.type === "boolean" ? true : `value_${p}`;
        }
        suggestions.push(`Example invocation: ${JSON.stringify(exampleObj)}`);
        actionableMessage = `Tool '${toolName}' invocation failed validation: missing ${missingRequired.join(", ")}`;
      }
    }

    // Fallback general guidance if no specific pattern matched
    if (suggestions.length === 0) {
      suggestions.push("Check tool parameter documentation and verify argument types.");
      suggestions.push("Verify file paths and permissions within the current working directory.");
    }

    return {
      originalError: rawError,
      actionableMessage,
      suggestions,
      remediationAction,
      matchedCandidates,
    };
  }

  /**
   * Formats a healed error into a clean JSON-structured diagnostic object suitable for the LLM.
   */
  public formatForModel(healed: HealedErrorResult): Record<string, unknown> {
    return {
      error: healed.actionableMessage,
      remediation: healed.remediationAction,
      suggestions: healed.suggestions,
      ...(healed.matchedCandidates ? { candidateFiles: healed.matchedCandidates } : {}),
    };
  }
}

