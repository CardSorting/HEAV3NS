/**
 * deterministic-tool-segmenter.ts
 *
 * In-memory zero-GC tool batch segmentation planner & loop guardrail engine (Phase 94 / ADR-046 / Target #85).
 */

import * as crypto from "node:crypto";
import type {
  LoopGuardrailDecision,
  ToolCallItem,
  ToolExecutionBatchSegment,
  ToolExecutionGuardConfig,
  ToolExecutionGuardMetrics,
  ToolLoopViolationRecord,
} from "../../../core/contracts/tool-execution-segment.contracts.js";
import { DEFAULT_TOOL_EXECUTION_GUARD_CONFIG } from "../../../core/contracts/tool-execution-segment.contracts.js";

const DEFAULT_IDEMPOTENT_TOOLS = new Set<string>([
  "read_file",
  "search_files",
  "list_directory",
  "web_search",
  "web_extract",
  "session_search",
  "browser_snapshot",
  "browser_console",
  "prompt_cache_status",
  "evidence_stop_check",
  "evidence_insights_report",
  "tool_search",
  "tool_describe",
  "tool_disclosure_status",
  "cost_get_balance",
  "cost_get_model_pricing",
  "skills_hub_search",
  "skills_hub_inspect",
  "computer_display_info",
  "checkpoint_list",
  "clarify_history",
]);

const DEFAULT_MUTATING_TOOLS = new Set<string>([
  "terminal",
  "execute_code",
  "write_file",
  "patch",
  "todo",
  "memory",
  "skill_manage",
  "browser_click",
  "browser_type",
  "browser_press",
  "browser_scroll",
  "browser_navigate",
  "send_message",
  "cronjob",
  "delegate_task",
  "process",
  "evidence_record",
  "skills_hub_install",
  "skills_hub_uninstall",
  "computer_mouse_click",
  "computer_mouse_move",
  "computer_key_tap",
  "checkpoint_create",
  "checkpoint_restore",
  "checkpoint_branch",
]);

export class DeterministicToolSegmenter {
  private callHistory: string[];
  private readonly idempotentTools = new Set<string>(DEFAULT_IDEMPOTENT_TOOLS);
  private readonly mutatingTools = new Set<string>(DEFAULT_MUTATING_TOOLS);
  private config: ToolExecutionGuardConfig = { ...DEFAULT_TOOL_EXECUTION_GUARD_CONFIG };

  constructor(config?: Partial<ToolExecutionGuardConfig>) {
    this.callHistory = [];
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  public setConfig(config: Partial<ToolExecutionGuardConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): ToolExecutionGuardConfig {
    return { ...this.config };
  }

  public registerIdempotentTool(toolName: string): void {
    this.idempotentTools.add(toolName);
    this.mutatingTools.delete(toolName);
  }

  public registerMutatingTool(toolName: string): void {
    this.mutatingTools.add(toolName);
    this.idempotentTools.delete(toolName);
  }

  /**
   * Identifies if a tool is mutating vs read-only idempotent.
   */
  public isMutatingTool(toolName: string): boolean {
    if (this.mutatingTools.has(toolName)) {
      return true;
    }
    if (this.idempotentTools.has(toolName)) {
      return false;
    }
    // Default fail-safe: unknown tools treated as mutating
    return this.config.failSafeMutatingDefault;
  }

  /**
   * Computes a deterministic SHA-256 hash of a tool call and its parameters.
   */
  public computeCallHash(toolName: string, parameters: Record<string, unknown>): string {
    const keys = Object.keys(parameters).sort();
    const sortedObj: Record<string, unknown> = {};
    for (let i = 0; i < keys.length; i++) {
      sortedObj[keys[i]] = parameters[keys[i]];
    }
    const payload = `${toolName}:${JSON.stringify(sortedObj)}`;
    return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
  }

  /**
   * Plans safe sequential and parallel batch execution segments for an array of tool calls.
   */
  public planBatchSegments(toolCalls: readonly ToolCallItem[]): readonly ToolExecutionBatchSegment[] {
    if (toolCalls.length === 0) {
      return [];
    }

    const segments: ToolExecutionBatchSegment[] = [];
    let currentParallel: ToolCallItem[] = [];

    const flushParallel = () => {
      if (currentParallel.length > 0) {
        segments.push({
          segmentIndex: segments.length,
          mode: currentParallel.length > 1 && this.config.enableParallelBatching ? "parallel" : "sequential",
          toolCalls: [...currentParallel],
          isMutating: false,
        });
        currentParallel = [];
      }
    };

    for (let i = 0; i < toolCalls.length; i++) {
      const call = toolCalls[i];
      const isMutating = this.isMutatingTool(call.toolName);

      if (isMutating) {
        flushParallel();
        segments.push({
          segmentIndex: segments.length,
          mode: "sequential",
          toolCalls: [call],
          isMutating: true,
        });
      } else {
        currentParallel.push(call);
        if (currentParallel.length >= this.config.maxParallelBatchSize) {
          flushParallel();
        }
      }
    }

    flushParallel();
    return segments;
  }

  /**
   * Evaluates if a proposed tool call violates loop guardrails or exhibits repetitive oscillation.
   */
  public evaluateLoopGuardrail(
    toolName: string,
    parameters: Record<string, unknown>
  ): LoopGuardrailDecision {
    const callHash = this.computeCallHash(toolName, parameters);
    this.callHistory.push(callHash);
    if (this.callHistory.length > 100) {
      this.callHistory.shift();
    }

    // Count consecutive identical calls from the tail
    let repetitionCount = 0;
    for (let i = this.callHistory.length - 1; i >= 0; i--) {
      if (this.callHistory[i] === callHash) {
        repetitionCount++;
      } else {
        break;
      }
    }

    if (repetitionCount >= this.config.abortThreshold) {
      return {
        action: "abort_turn",
        reason: `Repetitive tool call limit reached (${this.config.abortThreshold}x identical invocations of '${toolName}').`,
        repetitionCount,
        duplicateCallHash: callHash,
      };
    }

    if (repetitionCount >= this.config.maxConsecutiveIdenticalCalls) {
      return {
        action: "block_synthetic",
        reason: `Loop guardrail blocked invocation: '${toolName}' called ${this.config.maxConsecutiveIdenticalCalls}x consecutively with identical arguments without forward progress.`,
        repetitionCount,
        duplicateCallHash: callHash,
      };
    }

    if (repetitionCount >= this.config.warnThreshold) {
      return {
        action: "warn",
        reason: `Duplicate tool call warning: identical invocation of '${toolName}' observed.`,
        repetitionCount,
        duplicateCallHash: callHash,
      };
    }

    return {
      action: "allow",
      repetitionCount: 1,
      duplicateCallHash: callHash,
    };
  }

  /**
   * Formatting helpers
   */
  public formatSegment(segment: ToolExecutionBatchSegment): string {
    const names = segment.toolCalls.map((c) => c.toolName).join(", ");
    return `[SEGMENT #${segment.segmentIndex}] Mode: ${segment.mode.toUpperCase()} (${segment.toolCalls.length} calls: ${names}) [Mutating: ${segment.isMutating}]`;
  }

  public formatLoopDecision(decision: LoopGuardrailDecision): string {
    return `[LOOP-GUARD] Action: ${decision.action.toUpperCase()} (reps: ${decision.repetitionCount}) - ${decision.reason || "Call permitted"}`;
  }

  public formatViolationRecord(record: ToolLoopViolationRecord): string {
    return `[VIOLATION:Frame #${record.frameIndex}] Tool: ${record.toolName} | Reps: ${record.repetitionCount} | Action: ${record.actionTaken} | Hash: ${record.argsHash.slice(0, 8)}`;
  }

  public formatGuardMetrics(metrics: ToolExecutionGuardMetrics): string {
    return `[GUARD-METRICS] Plans: ${metrics.totalPlansPlanned} | Segments: ${metrics.totalSegmentsExecuted} | Parallel: ${metrics.parallelBatchesCreated} | Violations: ${metrics.totalViolationsDetected}`;
  }

  /**
   * Clears the active call history.
   */
  public clear(): void {
    this.callHistory = [];
  }
}
