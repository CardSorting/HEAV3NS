/**
 * turn-retry-supervisor.ts
 *
 * Master supervisor coordinating turn retry lifecycle, one-shot recovery execution,
 * adaptive restart signal dispatching, and audit ledgers (Phase 131 / ADR-107 / Target #64).
 */

import type { BroccoliTurnRetrySubstrate } from "../../../sessions/extensions/turn_retry/broccoli-turn-retry-substrate.js";
import type { DeterministicTurnRetryEngine } from "./deterministic-turn-retry-engine.js";
import type {
  TurnRecoveryBranch,
  TurnRestartSignalKey,
  TurnRetryConfig,
  TurnRetryMetrics,
  TurnRetryStateDescriptor,
} from "../../../core/contracts/turn-retry.contracts.js";

export class TurnRetrySupervisor {
  private readonly substrate: BroccoliTurnRetrySubstrate;
  private readonly engine: DeterministicTurnRetryEngine;

  constructor(substrate: BroccoliTurnRetrySubstrate, engine: DeterministicTurnRetryEngine) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public configure(config: Partial<TurnRetryConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): TurnRetryConfig {
    return this.substrate.getConfig();
  }

  public getMetrics(): TurnRetryMetrics {
    return this.substrate.getMetrics();
  }

  public getActiveState(): TurnRetryStateDescriptor | undefined {
    return this.substrate.getActiveState();
  }

  public getArchivedStates(): TurnRetryStateDescriptor[] {
    return this.substrate.getArchivedStates();
  }

  /**
   * Initializes a fresh TurnRetryState for an iteration of the turn loop.
   */
  public createTurnState(turnIndex = 0, attemptIndex = 0): TurnRetryStateDescriptor {
    return this.substrate.createTurnState(turnIndex, attemptIndex);
  }

  /**
   * Evaluates and triggers a one-shot recovery branch.
   */
  public triggerRecovery(branch: TurnRecoveryBranch, details?: string): boolean {
    let state = this.substrate.getActiveState();
    if (!state) {
      state = this.substrate.createTurnState();
    }

    const config = this.substrate.getConfig();
    if (!this.engine.canTrigger(branch, state.guards, config)) {
      return false;
    }

    return this.substrate.triggerGuard(branch, details);
  }

  /**
   * Sets an adaptive payload restart signal.
   */
  public setRestartSignal(signalKey: TurnRestartSignalKey, details?: string): boolean {
    return this.substrate.setRestartSignal(signalKey, details);
  }

  /**
   * High-level helper to classify an error and automatically fire the appropriate one-shot recovery branch.
   */
  public handleAttemptError(
    error: unknown,
    statusCode?: number,
    provider?: string
  ): {
    branchTriggered?: TurnRecoveryBranch;
    signalSet?: TurnRestartSignalKey;
    recovered: boolean;
    reason: string;
  } {
    const classification = this.engine.classifyErrorRecovery(error, statusCode, provider);
    let recovered = false;

    if (classification.recommendedBranch) {
      recovered = this.triggerRecovery(classification.recommendedBranch, classification.reason);
    }

    if (classification.recommendedSignal) {
      this.setRestartSignal(classification.recommendedSignal, classification.reason);
    }

    return {
      branchTriggered: classification.recommendedBranch,
      signalSet: classification.recommendedSignal,
      recovered,
      reason: classification.reason,
    };
  }

  /**
   * Concludes the current turn retry attempt and archives its state.
   */
  public finishAttempt(): void {
    this.substrate.archiveCurrentState();
  }
}
