/**
 * code-execution-supervisor.ts
 *
 * Master Code Execution Supervisor coordinating in-memory sandboxed script execution,
 * tool bridge binding, and execution telemetry (Phase 83 / ADR-035).
 */

import type {
  CodeExecutionLanguage,
  CodeExecutionResult,
  ExecutionRecord,
  ExecutionWorkspaceSnapshot,
  SandboxContext,
} from "../../../core/contracts/execution.contracts.js";
import {
  DeterministicCodeExecutor,
  type ToolDispatchFn,
} from "../../../tooling/extensions/execution/deterministic-code-executor.js";
import { BroccoliExecutionSubstrate } from "../../../sessions/extensions/execution/broccoli-execution-substrate.js";

export class CodeExecutionSupervisor {
  private executor: DeterministicCodeExecutor;
  private substrate: BroccoliExecutionSubstrate;
  private toolDispatcher?: ToolDispatchFn;
  private availableTools: string[];
  private currentFrame: number;

  constructor(executor: DeterministicCodeExecutor, substrate: BroccoliExecutionSubstrate) {
    this.executor = executor;
    this.substrate = substrate;
    this.availableTools = [];
    this.currentFrame = 1;
  }

  /**
   * Binds the in-process tool dispatcher for programmatic tool calling.
   */
  setToolDispatcher(dispatcher: ToolDispatchFn, availableTools: readonly string[]): void {
    this.toolDispatcher = dispatcher;
    this.availableTools = [...availableTools];
  }

  /**
   * Sets current frame index for telemetry records.
   */
  setFrameIndex(frame: number): void {
    this.currentFrame = frame;
  }

  /**
   * Executes a code snippet in the sandbox with direct tool invocation.
   */
  async executeScript(
    code: string,
    language: CodeExecutionLanguage = "javascript",
    contextOverride?: Partial<SandboxContext>
  ): Promise<CodeExecutionResult> {
    const result = await this.executor.execute(
      code,
      this.toolDispatcher,
      this.availableTools,
      contextOverride,
      language
    );

    const record: ExecutionRecord = {
      id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      code,
      language,
      result,
      createdFrame: this.currentFrame,
      timestamp: Date.now(),
    };

    this.substrate.recordExecution(record);
    return result;
  }

  /**
   * Returns stats and history.
   */
  getStats(): ExecutionWorkspaceSnapshot {
    return this.substrate.exportSnapshot();
  }

  /**
   * Lists historical execution records.
   */
  listHistory(limit: number = 20): readonly ExecutionRecord[] {
    return this.substrate.listExecutions(limit);
  }
}
