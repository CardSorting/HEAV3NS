/**
 * broccoli-turn-retry-substrate.ts
 *
 * In-memory Broccolidb repository storing turn retry states, one-shot guards,
 * restart signals, and transition telemetry (Phase 131 / ADR-107 / Target #64).
 */

import type {
  TurnRecoveryBranch,
  TurnRestartSignalKey,
  TurnRetryConfig,
  TurnRetryMetrics,
  TurnRetryStateDescriptor,
  TurnRetryWorkspaceSnapshot,
} from "../../../core/contracts/turn-retry.contracts.js";
import {
  DEFAULT_TURN_RETRY_CONFIG,
  DEFAULT_TURN_RETRY_GUARDS,
  DEFAULT_TURN_RESTART_SIGNALS,
} from "../../../core/contracts/turn-retry.contracts.js";

export class BroccoliTurnRetrySubstrate {
  private config: TurnRetryConfig = { ...DEFAULT_TURN_RETRY_CONFIG };
  private activeState?: TurnRetryStateDescriptor;
  private archivedStates: TurnRetryStateDescriptor[] = [];
  private metrics: TurnRetryMetrics = {
    totalStatesCreated: 0,
    totalGuardsTriggered: 0,
    totalSignalsEmitted: 0,
    guardTriggerCounts: {},
    signalTriggerCounts: {},
  };

  public setConfig(config: Partial<TurnRetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): TurnRetryConfig {
    return { ...this.config };
  }

  public createTurnState(turnIndex = 0, attemptIndex = 0): TurnRetryStateDescriptor {
    if (this.activeState) {
      this.archiveCurrentState();
    }

    const stateId = `turn-retry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newState: TurnRetryStateDescriptor = {
      stateId,
      turnIndex,
      attemptIndex,
      timestamp: Date.now(),
      guards: { ...DEFAULT_TURN_RETRY_GUARDS },
      restartSignals: { ...DEFAULT_TURN_RESTART_SIGNALS },
      history: [
        {
          timestamp: Date.now(),
          action: "reset",
          key: "state_init",
          details: `Created turn retry state for turn #${turnIndex} attempt #${attemptIndex}`,
        },
      ],
    };

    this.activeState = newState;
    this.metrics.totalStatesCreated++;
    return { ...newState, guards: { ...newState.guards }, restartSignals: { ...newState.restartSignals } };
  }

  public getActiveState(): TurnRetryStateDescriptor | undefined {
    if (!this.activeState) return undefined;
    return {
      ...this.activeState,
      guards: { ...this.activeState.guards },
      restartSignals: { ...this.activeState.restartSignals },
      history: [...this.activeState.history],
    };
  }

  public triggerGuard(branch: TurnRecoveryBranch, details?: string): boolean {
    if (!this.activeState) {
      this.createTurnState();
    }
    const state = this.activeState!;

    // One-shot check: if already fired, return false
    if (state.guards[branch]) {
      return false;
    }

    state.guards[branch] = true;
    state.history.push({
      timestamp: Date.now(),
      action: "guard_triggered",
      key: branch,
      details,
    });

    this.metrics.totalGuardsTriggered++;
    this.metrics.guardTriggerCounts[branch] = (this.metrics.guardTriggerCounts[branch] || 0) + 1;
    return true;
  }

  public setRestartSignal(signalKey: TurnRestartSignalKey, details?: string): boolean {
    if (!this.activeState) {
      this.createTurnState();
    }
    const state = this.activeState!;

    state.restartSignals[signalKey] = true;
    state.history.push({
      timestamp: Date.now(),
      action: "signal_set",
      key: signalKey,
      details,
    });

    this.metrics.totalSignalsEmitted++;
    this.metrics.signalTriggerCounts[signalKey] = (this.metrics.signalTriggerCounts[signalKey] || 0) + 1;
    return true;
  }

  public archiveCurrentState(): void {
    if (!this.activeState) return;
    this.archivedStates.push({
      ...this.activeState,
      guards: { ...this.activeState.guards },
      restartSignals: { ...this.activeState.restartSignals },
      history: [...this.activeState.history],
    });
    if (this.archivedStates.length > 50) {
      this.archivedStates.shift();
    }
    this.activeState = undefined;
  }

  public getArchivedStates(): TurnRetryStateDescriptor[] {
    return this.archivedStates.map((s) => ({
      ...s,
      guards: { ...s.guards },
      restartSignals: { ...s.restartSignals },
      history: [...s.history],
    }));
  }

  public getMetrics(): TurnRetryMetrics {
    return {
      ...this.metrics,
      guardTriggerCounts: { ...this.metrics.guardTriggerCounts },
      signalTriggerCounts: { ...this.metrics.signalTriggerCounts },
    };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): TurnRetryWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      config: this.getConfig(),
      metrics: this.getMetrics(),
      activeState: this.getActiveState(),
      archivedStates: this.getArchivedStates(),
    };
  }

  public restoreSnapshot(snapshot: TurnRetryWorkspaceSnapshot): void {
    this.config = { ...snapshot.config };
    this.metrics = {
      ...snapshot.metrics,
      guardTriggerCounts: { ...snapshot.metrics.guardTriggerCounts },
      signalTriggerCounts: { ...snapshot.metrics.signalTriggerCounts },
    };
    this.activeState = snapshot.activeState
      ? {
          ...snapshot.activeState,
          guards: { ...snapshot.activeState.guards },
          restartSignals: { ...snapshot.activeState.restartSignals },
          history: [...snapshot.activeState.history],
        }
      : undefined;
    this.archivedStates = snapshot.archivedStates.map((s) => ({
      ...s,
      guards: { ...s.guards },
      restartSignals: { ...s.restartSignals },
      history: [...s.history],
    }));
  }

  public clear(): void {
    this.config = { ...DEFAULT_TURN_RETRY_CONFIG };
    this.activeState = undefined;
    this.archivedStates = [];
    this.metrics = {
      totalStatesCreated: 0,
      totalGuardsTriggered: 0,
      totalSignalsEmitted: 0,
      guardTriggerCounts: {},
      signalTriggerCounts: {},
    };
  }
}
