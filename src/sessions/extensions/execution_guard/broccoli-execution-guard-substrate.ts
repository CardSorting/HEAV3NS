/**
 * broccoli-execution-guard-substrate.ts
 *
 * In-memory Broccolidb repository for tool batch segments and loop guardrail records (Phase 94 / ADR-046).
 */

import type {
  ToolExecutionBatchSegment,
  ToolExecutionWorkspaceSnapshot,
  ToolLoopViolationRecord,
} from "../../../core/contracts/tool-execution-segment.contracts.js";

export class BroccoliExecutionGuardSubstrate {
  private violations: ToolLoopViolationRecord[];
  private latestSegments: ToolExecutionBatchSegment[];

  constructor() {
    this.violations = [];
    this.latestSegments = [];
  }

  recordViolation(record: ToolLoopViolationRecord): void {
    this.violations.push(record);
    if (this.violations.length > 500) {
      this.violations.shift();
    }
  }

  getViolations(): readonly ToolLoopViolationRecord[] {
    return this.violations;
  }

  setLatestSegments(segments: readonly ToolExecutionBatchSegment[]): void {
    this.latestSegments = [...segments];
  }

  getLatestSegments(): readonly ToolExecutionBatchSegment[] {
    return this.latestSegments;
  }

  exportSnapshot(): ToolExecutionWorkspaceSnapshot {
    return {
      totalViolations: this.violations.length,
      activeViolations: [...this.violations],
      lastRepetitionHash:
        this.violations.length > 0
          ? this.violations[this.violations.length - 1].argsHash
          : undefined,
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: ToolExecutionWorkspaceSnapshot): void {
    this.violations = [...snapshot.activeViolations];
    this.latestSegments = [];
  }

  clear(): void {
    this.violations = [];
    this.latestSegments = [];
  }
}
