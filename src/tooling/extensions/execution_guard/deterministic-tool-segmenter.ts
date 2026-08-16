/**
 * deterministic-tool-segmenter.ts
 *
 * In-memory zero-GC tool batch segmentation planner & loop guardrail engine (Phase 94 / ADR-046).
 */

import * as crypto from "node:crypto";
import type {
  LoopGuardrailDecision,
  ToolCallItem,
  ToolExecutionBatchSegment,
} from "../../../core/contracts/tool-execution-segment.contracts.js";

const IDEMPOTENT_TOOLS = new Set<string>([
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

const MUTATING_TOOLS = new Set<string>([
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

  constructor() {
    this.callHistory = [];
  }

  /**
   * Identifies if a tool is mutating vs read-only idempotent.
   */
  isMutatingTool(toolName: string): boolean {
    if (MUTATING_TOOLS.has(toolName)) {
      return true;
    }
    if (IDEMPOTENT_TOOLS.has(toolName)) {
      return false;
    }
    // Default fail-safe: unknown tools treated as mutating
    return true;
  }

  /**
   * Computes a deterministic SHA-256 hash of a tool call and its parameters.
   */
  computeCallHash(toolName: string, parameters: Record<string, unknown>): string {
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
  planBatchSegments(toolCalls: readonly ToolCallItem[]): readonly ToolExecutionBatchSegment[] {
    if (toolCalls.length === 0) {
      return [];
    }

    const segments: ToolExecutionBatchSegment[] = [];
    let currentParallel: ToolCallItem[] = [];

    const flushParallel = () => {
      if (currentParallel.length > 0) {
        segments.push({
          segmentIndex: segments.length,
          mode: currentParallel.length > 1 ? "parallel" : "sequential",
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
      }
    }

    flushParallel();
    return segments;
  }

  /**
   * Evaluates if a proposed tool call violates loop guardrails or exhibits repetitive oscillation.
   */
  evaluateLoopGuardrail(
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

    if (repetitionCount >= 5) {
      return {
        action: "abort_turn",
        reason: `Repetitive tool call limit reached (5x identical invocations of '${toolName}').`,
        repetitionCount,
        duplicateCallHash: callHash,
      };
    }

    if (repetitionCount >= 3) {
      return {
        action: "block_synthetic",
        reason: `Loop guardrail blocked invocation: '${toolName}' called 3x consecutively with identical arguments without forward progress.`,
        repetitionCount,
        duplicateCallHash: callHash,
      };
    }

    if (repetitionCount === 2) {
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
   * Clears the active call history.
   */
  clear(): void {
    this.callHistory = [];
  }
}
