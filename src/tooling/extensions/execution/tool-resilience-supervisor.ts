/**
 * tool-resilience-supervisor.ts
 *
 * In-Turn Tool Resilience & Self-Healing Supervisor.
 * Transparently recovers from common tool invocation friction points:
 * 1. Whitespace & indentation discrepancies during file editing (fuzzy patch healing)
 * 2. Missing parent directory creation on file creation/mutation (mkdir -p)
 * 3. Common parameter name hallucinations (alias auto-coercion)
 * 4. Transient filesystem lock contention (micro-retry with exponential backoff)
 *
 * Preserves high agent throughput and eliminates turn blockers without sacrificing security.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { IToolRegistry, ToolDefinition, ToolExecutionOptions } from "../../../core/contracts/tooling.contracts.js";
import { ToolErrorAutoHealer } from "./tool-error-auto-healer.js";

export interface ResilienceRecord {
  readonly toolName: string;
  readonly originalArgs: Record<string, unknown>;
  readonly strategy: "fuzzy_patch" | "mkdir_parent" | "param_alias" | "transient_retry";
  readonly healedArgs: Record<string, unknown>;
  readonly timestamp: number;
  readonly success: boolean;
  readonly details: string;
}

export interface ResilienceStats {
  readonly totalAttempts: number;
  readonly totalRecovered: number;
  readonly recoveryRatePercent: number;
  readonly strategyCounts: Record<string, number>;
}

export class ToolResilienceSupervisor {
  private readonly autoHealer = new ToolErrorAutoHealer();
  private readonly recoveryHistory: ResilienceRecord[] = [];
  private readonly maxHistory = 200;

  private totalAttempts = 0;
  private totalRecovered = 0;
  private strategyCounts: Record<string, number> = {
    fuzzy_patch: 0,
    mkdir_parent: 0,
    param_alias: 0,
    transient_retry: 0,
  };

  /**
   * Attempts transparent in-turn auto-recovery for a failed tool execution.
   */
  public async attemptAutoRecovery(
    toolName: string,
    rawArgs: Record<string, unknown>,
    error: unknown,
    cwd: string,
    registry: IToolRegistry,
    toolDef?: ToolDefinition,
    options?: ToolExecutionOptions
  ): Promise<{ recovered: boolean; result?: unknown; record?: ResilienceRecord }> {
    this.totalAttempts++;
    const errMsg = error instanceof Error ? error.message : String(error);
    const lowerError = errMsg.toLowerCase();

    // ------------------------------------------------------------------------
    // Strategy 1: Whitespace-Tolerant File Replacement Auto-Healing
    // ------------------------------------------------------------------------
    const isTargetNotFound =
      (lowerError.includes("target") && lowerError.includes("not found")) ||
      lowerError.includes("failed to locate") ||
      lowerError.includes("chunk") ||
      lowerError.includes("could not find target") ||
      lowerError.includes("mismatch");

    if ((toolName === "replace_file_content" || toolName === "search_and_replace") && isTargetNotFound) {
      const filePath = typeof rawArgs.path === "string" ? rawArgs.path : (typeof rawArgs.targetFile === "string" ? rawArgs.targetFile : undefined);
      const targetContent = typeof rawArgs.targetContent === "string" ? rawArgs.targetContent : (typeof rawArgs.target === "string" ? rawArgs.target : undefined);
      const replacementContent = typeof rawArgs.replacementContent === "string" ? rawArgs.replacementContent : (typeof rawArgs.replacement === "string" ? rawArgs.replacement : undefined);

      if (filePath && targetContent !== undefined && replacementContent !== undefined) {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
        try {
          const fileText = await fs.readFile(fullPath, "utf8");
          const fuzzyMatch = this.autoHealer.healFuzzyPatch(fileText, targetContent);

          if (fuzzyMatch.found && fuzzyMatch.adjustedTarget) {
            const updatedText = fileText.replace(fuzzyMatch.adjustedTarget, replacementContent);
            await fs.writeFile(fullPath, updatedText, "utf8");

            this.totalRecovered++;
            this.strategyCounts.fuzzy_patch = (this.strategyCounts.fuzzy_patch || 0) + 1;

            const rec: ResilienceRecord = {
              toolName,
              originalArgs: rawArgs,
              strategy: "fuzzy_patch",
              healedArgs: { ...rawArgs, targetContent: fuzzyMatch.adjustedTarget },
              timestamp: Date.now(),
              success: true,
              details: `Fuzzy patch auto-healed matching line block with ${(fuzzyMatch.confidence * 100).toFixed(0)}% confidence.`,
            };
            this.recordHistory(rec);

            return {
              recovered: true,
              result: {
                success: true,
                autoHealed: true,
                strategy: "fuzzy_patch",
                message: `Successfully replaced content via whitespace-tolerant fuzzy patch auto-recovery.`,
                path: filePath,
              },
              record: rec,
            };
          }
        } catch {
          // Fall through if file cannot be read
        }
      }
    }

    // ------------------------------------------------------------------------
    // Strategy 2: Missing Parent Directory Auto-Creation (mkdir -p)
    // ------------------------------------------------------------------------
    if (
      (toolName === "write_file" || toolName === "create_file" || toolName === "write_to_file") &&
      (lowerError.includes("enoent") || lowerError.includes("no such file or directory"))
    ) {
      const filePath = typeof rawArgs.path === "string" ? rawArgs.path : (typeof rawArgs.targetFile === "string" ? rawArgs.targetFile : undefined);
      if (filePath) {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
        const parentDir = path.dirname(fullPath);

        try {
          await fs.mkdir(parentDir, { recursive: true });
          const retryRes = await registry.executeTool(toolName, rawArgs, cwd, {
            ...options,
            autoHeal: false,
            bypassConfirmation: true,
          });

          this.totalRecovered++;
          this.strategyCounts.mkdir_parent = (this.strategyCounts.mkdir_parent || 0) + 1;

          const rec: ResilienceRecord = {
            toolName,
            originalArgs: rawArgs,
            strategy: "mkdir_parent",
            healedArgs: rawArgs,
            timestamp: Date.now(),
            success: true,
            details: `Auto-created parent directory '${parentDir}'.`,
          };
          this.recordHistory(rec);

          return {
            recovered: true,
            result: retryRes,
            record: rec,
          };
        } catch {
          // Fall through
        }
      }
    }

    // ------------------------------------------------------------------------
    // Strategy 3: Parameter Name Alias Auto-Repair
    // ------------------------------------------------------------------------
    if (toolDef && toolDef.parameters && (lowerError.includes("missing required") || lowerError.includes("validation failed"))) {
      const validParams = Object.keys(toolDef.parameters);
      const healedArgs: Record<string, unknown> = { ...rawArgs };
      let repaired = false;

      for (const [key, val] of Object.entries(rawArgs)) {
        if (!validParams.includes(key)) {
          const match = this.autoHealer.fuzzyMatchParameter(key, validParams);
          if (match.match && match.score >= 0.8 && !(match.match in healedArgs)) {
            healedArgs[match.match] = val;
            delete healedArgs[key];
            repaired = true;
          }
        }
      }

      if (repaired) {
        try {
          const retryRes = await registry.executeTool(toolName, healedArgs, cwd, {
            ...options,
            autoHeal: false,
            bypassConfirmation: true,
          });

          this.totalRecovered++;
          this.strategyCounts.param_alias = (this.strategyCounts.param_alias || 0) + 1;

          const rec: ResilienceRecord = {
            toolName,
            originalArgs: rawArgs,
            strategy: "param_alias",
            healedArgs,
            timestamp: Date.now(),
            success: true,
            details: `Auto-repaired parameter aliases: ${JSON.stringify(healedArgs)}`,
          };
          this.recordHistory(rec);

          return {
            recovered: true,
            result: retryRes,
            record: rec,
          };
        } catch {
          // Fall through
        }
      }
    }

    // ------------------------------------------------------------------------
    // Strategy 4: Transient Filesystem Lock Contention Micro-Retry
    // ------------------------------------------------------------------------
    const isLockError = /\b(ebusy|eexist|lock|locked|contention|resource temporarily unavailable)\b/i.test(errMsg);
    if (isLockError) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        await new Promise((r) => setTimeout(r, attempt * 40));
        try {
          const retryRes = await registry.executeTool(toolName, rawArgs, cwd, {
            ...options,
            autoHeal: false,
            bypassConfirmation: true,
          });

          this.totalRecovered++;
          this.strategyCounts.transient_retry = (this.strategyCounts.transient_retry || 0) + 1;

          const rec: ResilienceRecord = {
            toolName,
            originalArgs: rawArgs,
            strategy: "transient_retry",
            healedArgs: rawArgs,
            timestamp: Date.now(),
            success: true,
            details: `Recovered from transient lock after ${attempt} micro-retries.`,
          };
          this.recordHistory(rec);

          return {
            recovered: true,
            result: retryRes,
            record: rec,
          };
        } catch {
          // continue loop
        }
      }
    }

    return { recovered: false };
  }

  private recordHistory(rec: ResilienceRecord): void {
    this.recoveryHistory.push(rec);
    if (this.recoveryHistory.length > this.maxHistory) {
      this.recoveryHistory.shift();
    }
  }

  /**
   * Returns summary resilience metrics.
   */
  public getStats(): ResilienceStats {
    const recoveryRatePercent =
      this.totalAttempts > 0
        ? Number(((this.totalRecovered / this.totalAttempts) * 100).toFixed(1))
        : 0;

    return {
      totalAttempts: this.totalAttempts,
      totalRecovered: this.totalRecovered,
      recoveryRatePercent,
      strategyCounts: { ...this.strategyCounts },
    };
  }

  /**
   * Returns recent recovery records.
   */
  public getRecentRecoveries(limit = 20): ResilienceRecord[] {
    return this.recoveryHistory.slice(-limit).reverse();
  }
}
