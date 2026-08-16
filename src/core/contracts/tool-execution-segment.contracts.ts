/**
 * tool-execution-segment.contracts.ts
 *
 * Core data contracts for Deterministic Tool Execution Segmenter,
 * Batch Parallelism Scheduler & Loop-Guardrail Subsystem (Phase 94 / ADR-046).
 */

export type ToolExecutionMode = "sequential" | "parallel" | "barrier";

export interface ToolCallItem {
  readonly callId: string;
  readonly toolName: string;
  readonly parameters: Record<string, unknown>;
}

export interface ToolExecutionBatchSegment {
  readonly segmentIndex: number;
  readonly mode: ToolExecutionMode;
  readonly toolCalls: readonly ToolCallItem[];
  readonly isMutating: boolean;
}

export interface LoopGuardrailDecision {
  readonly action: "allow" | "warn" | "block_synthetic" | "abort_turn";
  readonly reason?: string;
  readonly repetitionCount: number;
  readonly duplicateCallHash?: string;
}

export interface ToolLoopViolationRecord {
  readonly frameIndex: number;
  readonly toolName: string;
  readonly argsHash: string;
  readonly repetitionCount: number;
  readonly actionTaken: string;
  readonly timestamp: number;
}

export interface ToolExecutionWorkspaceSnapshot {
  readonly totalViolations: number;
  readonly activeViolations: readonly ToolLoopViolationRecord[];
  readonly lastRepetitionHash?: string;
  readonly timestamp: number;
}
