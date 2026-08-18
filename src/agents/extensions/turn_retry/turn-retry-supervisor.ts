/**
 * turn-retry-supervisor.ts
 *
 * Master Turn Retry Supervisor orchestrating one-shot recovery guards,
 * adaptive payload restart signals, error classification, and state recovery (Phase 131 / ADR-107).
 */

import type {
  TurnRecoveryBranch,
  TurnRestartSignalKey,
  TurnRetryAttemptRecord,
  TurnRetryBulkMutationResult,
  TurnRetryDslQueryFilter,
  TurnRetryErrorCategory,
  TurnRetryGroupBy,
  TurnRetryGroupedLane,
  TurnRetryHealthAuditReport,
  TurnRetryMetricsReport,
  TurnRetrySortBy,
  TurnRetrySortDirection,
  TurnRetryStateDescriptor,
  TurnRetryWorkspaceSnapshot,
} from "../../../core/contracts/turn-retry.contracts.js";
import { DeterministicTurnRetryEngine } from "./deterministic-turn-retry-engine.js";
import { BroccoliTurnRetrySubstrate } from "../../../sessions/extensions/turn_retry/broccoli-turn-retry-substrate.js";

export class TurnRetrySupervisor {
  private readonly engine: DeterministicTurnRetryEngine;
  private readonly substrate: BroccoliTurnRetrySubstrate;
  private currentFrame: number;

  constructor(
    substrate?: BroccoliTurnRetrySubstrate,
    engine?: DeterministicTurnRetryEngine
  ) {
    this.substrate = substrate ?? new BroccoliTurnRetrySubstrate();
    this.engine = engine ?? new DeterministicTurnRetryEngine();
    this.currentFrame = 1;
  }

  public setFrameIndex(frame: number): void {
    this.currentFrame = frame;
  }

  /**
   * Initializes a new Turn Retry state descriptor.
   */
  public createState(turnIndex: number, errorCategory?: TurnRetryErrorCategory): TurnRetryStateDescriptor {
    const state = this.engine.createState(turnIndex, errorCategory);
    this.substrate.recordState(state);
    return state;
  }

  /**
   * Evaluates and trips a one-shot recovery guard.
   */
  public triggerGuard(stateId: string, branch: TurnRecoveryBranch, details?: string): boolean {
    const ok = this.engine.triggerGuard(stateId, branch, details);
    const updated = this.engine.getState(stateId);
    if (updated) {
      this.substrate.recordState(updated);
    }
    return ok;
  }

  /**
   * Emits an adaptive payload restart signal.
   */
  public setRestartSignal(stateId: string, signalKey: TurnRestartSignalKey, value = true, details?: string): void {
    this.engine.setRestartSignal(stateId, signalKey, value, details);
    const updated = this.engine.getState(stateId);
    if (updated) {
      this.substrate.recordState(updated);
    }
  }

  /**
   * Classifies an error, trips the recommended guard, emits restart signal, and records attempt.
   */
  public classifyAndRecover(
    turnIndex: number,
    errorMessage: string,
    stateId?: string
  ): {
    stateId: string;
    category: TurnRetryErrorCategory;
    guardTriggered?: TurnRecoveryBranch;
    signalEmitted?: TurnRestartSignalKey;
    canRetry: boolean;
    attempt: TurnRetryAttemptRecord;
  } {
    let activeStateId = stateId;
    if (!activeStateId) {
      const newState = this.createState(turnIndex);
      activeStateId = newState.stateId;
    }

    const plan = this.engine.classifyAndPlanRecovery(errorMessage, activeStateId);
    let guardFired = false;

    if (plan.recommendedGuard) {
      guardFired = this.triggerGuard(activeStateId, plan.recommendedGuard, `Auto-recovery from: ${errorMessage}`);
    }

    if (plan.recommendedSignal) {
      this.setRestartSignal(activeStateId, plan.recommendedSignal, true, `Auto-restart signal for: ${plan.category}`);
    }

    const attempt = this.engine.recordAttempt(
      activeStateId,
      plan.category,
      errorMessage,
      plan.recommendedGuard,
      plan.recommendedSignal,
      guardFired,
      10
    );
    this.substrate.recordAttempt(attempt);

    const updatedState = this.engine.getState(activeStateId);
    if (updatedState) {
      this.substrate.recordState(updatedState);
    }

    return {
      stateId: activeStateId,
      category: plan.category,
      guardTriggered: plan.recommendedGuard,
      signalEmitted: plan.recommendedSignal,
      canRetry: guardFired,
      attempt,
    };
  }

  public recordAttempt(
    stateId: string,
    errorCategory: TurnRetryErrorCategory,
    errorMessage: string,
    guardTriggered?: TurnRecoveryBranch,
    signalEmitted?: TurnRestartSignalKey,
    success = false,
    durationMs = 0
  ): TurnRetryAttemptRecord {
    const attempt = this.engine.recordAttempt(
      stateId,
      errorCategory,
      errorMessage,
      guardTriggered,
      signalEmitted,
      success,
      durationMs
    );
    this.substrate.recordAttempt(attempt);
    const updated = this.engine.getState(stateId);
    if (updated) {
      this.substrate.recordState(updated);
    }
    return attempt;
  }

  // ---------------------------------------------------------------------------
  // Queries & Diagnostics
  // ---------------------------------------------------------------------------

  public getState(stateId: string): TurnRetryStateDescriptor | undefined {
    return this.engine.getState(stateId) ?? this.substrate.getState(stateId);
  }

  public listStates(limit: number = 20): readonly TurnRetryStateDescriptor[] {
    return this.substrate.listStates(limit);
  }

  public listAttempts(stateId?: string, limit: number = 50): readonly TurnRetryAttemptRecord[] {
    return this.substrate.listAttempts(stateId, limit);
  }

  public updateStateStatus(stateId: string, status: TurnRetryStateDescriptor["status"]): boolean {
    this.engine.updateStateStatus(stateId, status);
    return this.substrate.updateStateStatus(stateId, status);
  }

  public auditHealth(): TurnRetryHealthAuditReport {
    return this.substrate.auditTurnRetryHealth();
  }

  public getMetrics(): TurnRetryMetricsReport {
    return this.substrate.getTurnRetryMetrics();
  }

  public getGroupedStates(groupBy?: TurnRetryGroupBy, sortBy?: TurnRetrySortBy, direction?: TurnRetrySortDirection): readonly TurnRetryGroupedLane[] {
    return this.substrate.getGroupedStates(groupBy, sortBy, direction);
  }

  public queryDsl(query: TurnRetryDslQueryFilter | string): readonly TurnRetryStateDescriptor[] {
    return this.substrate.queryStatesDsl(query);
  }

  public bulkReset(stateIds: readonly string[]): TurnRetryBulkMutationResult {
    this.engine.bulkResetStates(stateIds);
    return this.substrate.bulkResetStates(stateIds);
  }

  public bulkClearGuards(stateIds: readonly string[]): TurnRetryBulkMutationResult {
    this.engine.bulkClearGuards(stateIds);
    return this.substrate.bulkClearGuards(stateIds);
  }

  public getStats(): TurnRetryWorkspaceSnapshot {
    return this.substrate.exportSnapshot();
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public exportHtml(): string {
    return this.substrate.exportInteractiveHtmlView();
  }

  public exportMarkdown(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsv(): string {
    return this.substrate.exportCsvReport();
  }

  public getEngine(): DeterministicTurnRetryEngine {
    return this.engine;
  }

  public getSubstrate(): BroccoliTurnRetrySubstrate {
    return this.substrate;
  }
}
