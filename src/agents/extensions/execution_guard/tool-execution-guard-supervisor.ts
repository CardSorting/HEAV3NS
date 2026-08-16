/**
 * tool-execution-guard-supervisor.ts
 *
 * Master supervisor coordinating tool batch segmentation, parallelism scheduling,
 * and loop guardrail policies (Phase 94 / ADR-046).
 */

import type {
  LoopGuardrailDecision,
  ToolCallItem,
  ToolExecutionBatchSegment,
  ToolLoopViolationRecord,
} from "../../../core/contracts/tool-execution-segment.contracts.js";
import { DeterministicToolSegmenter } from "../../../tooling/extensions/execution_guard/deterministic-tool-segmenter.js";
import { BroccoliExecutionGuardSubstrate } from "../../../sessions/extensions/execution_guard/broccoli-execution-guard-substrate.js";

export class ToolExecutionGuardSupervisor {
  private segmenter: DeterministicToolSegmenter;
  private substrate: BroccoliExecutionGuardSubstrate;

  constructor(
    segmenter: DeterministicToolSegmenter,
    substrate: BroccoliExecutionGuardSubstrate
  ) {
    this.segmenter = segmenter;
    this.substrate = substrate;
  }

  /**
   * Plans batch segments for a series of requested tool calls.
   */
  planSegments(toolCalls: readonly ToolCallItem[]): readonly ToolExecutionBatchSegment[] {
    const segments = this.segmenter.planBatchSegments(toolCalls);
    this.substrate.setLatestSegments(segments);
    return segments;
  }

  /**
   * Evaluates if a tool invocation triggers a loop guardrail.
   */
  checkLoopGuardrail(
    frameIndex: number,
    toolName: string,
    parameters: Record<string, unknown>
  ): LoopGuardrailDecision {
    const decision = this.segmenter.evaluateLoopGuardrail(toolName, parameters);

    if (decision.action !== "allow") {
      const record: ToolLoopViolationRecord = {
        frameIndex,
        toolName,
        argsHash: decision.duplicateCallHash ?? "",
        repetitionCount: decision.repetitionCount,
        actionTaken: decision.action,
        timestamp: Date.now(),
      };
      this.substrate.recordViolation(record);
    }

    return decision;
  }

  /**
   * Retrieves all loop violation records.
   */
  getViolations(): readonly ToolLoopViolationRecord[] {
    return this.substrate.getViolations();
  }

  /**
   * Retrieves the latest planned segments.
   */
  getLatestSegments(): readonly ToolExecutionBatchSegment[] {
    return this.substrate.getLatestSegments();
  }
}
