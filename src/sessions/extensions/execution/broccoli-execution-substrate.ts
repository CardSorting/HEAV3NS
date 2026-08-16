/**
 * broccoli-execution-substrate.ts
 *
 * In-memory Broccolidb substrate for code execution records and tool traces (Phase 83 / ADR-035).
 */

import type {
  ExecutionRecord,
  ExecutionWorkspaceSnapshot,
} from "../../../core/contracts/execution.contracts.js";

export class BroccoliExecutionSubstrate {
  private records: Map<string, ExecutionRecord>;
  private totalExecutions: number;
  private totalToolCalls: number;

  constructor() {
    this.records = new Map<string, ExecutionRecord>();
    this.totalExecutions = 0;
    this.totalToolCalls = 0;
  }

  /**
   * Stores an execution record in the ledger.
   */
  recordExecution(record: ExecutionRecord): void {
    this.records.set(record.id, record);
    this.totalExecutions++;
    this.totalToolCalls += record.result.toolCallsExecuted;
  }

  /**
   * Retrieves an execution record by ID.
   */
  getExecution(id: string): ExecutionRecord | undefined {
    return this.records.get(id);
  }

  /**
   * Lists historical execution records.
   */
  listExecutions(limit: number = 20): readonly ExecutionRecord[] {
    const all = Array.from(this.records.values());
    return all.slice(-limit);
  }

  /**
   * Exports full state snapshot.
   */
  exportSnapshot(): ExecutionWorkspaceSnapshot {
    return {
      totalExecutions: this.totalExecutions,
      totalToolCalls: this.totalToolCalls,
      historySize: this.records.size,
      timestamp: Date.now(),
    };
  }

  /**
   * Restores state from a snapshot.
   */
  importSnapshot(snapshot: ExecutionWorkspaceSnapshot): void {
    this.totalExecutions = snapshot.totalExecutions;
    this.totalToolCalls = snapshot.totalToolCalls;
  }

  /**
   * Clears all execution state.
   */
  clear(): void {
    this.records.clear();
    this.totalExecutions = 0;
    this.totalToolCalls = 0;
  }
}
