/**
 * execution.contracts.ts
 *
 * Core data contracts for the Deterministic Programmatic Tool Execution & Scripting Sandbox Subsystem (Phase 83 / ADR-035).
 */

export type CodeExecutionLanguage = "javascript" | "typescript" | "json";

export interface ProgrammaticToolCall {
  readonly toolName: string;
  readonly args: Record<string, unknown>;
  readonly result: unknown;
  readonly executionTimeMs: number;
  readonly timestamp: number;
}

export interface CodeExecutionResult {
  readonly success: boolean;
  readonly output: string;
  readonly logs: readonly string[];
  readonly error?: string;
  readonly executionTimeMs: number;
  readonly toolCallsExecuted: number;
  readonly toolCalls: readonly ProgrammaticToolCall[];
}

export interface SandboxContext {
  readonly timeoutMs: number;
  readonly maxToolCalls: number;
  readonly allowAsync: boolean;
  readonly env?: Record<string, string>;
}

export interface ExecutionRecord {
  readonly id: string;
  readonly code: string;
  readonly language: CodeExecutionLanguage;
  readonly result: CodeExecutionResult;
  readonly createdFrame: number;
  readonly timestamp: number;
}

export interface ExecutionWorkspaceSnapshot {
  readonly totalExecutions: number;
  readonly totalToolCalls: number;
  readonly historySize: number;
  readonly timestamp: number;
}
