/**
 * turn-retry-tool-suite.ts
 *
 * Model tool definitions exposing Turn Retry State Machine & One-Shot Recovery Guards
 * (Phase 131 / ADR-107 / Target #64).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { TurnRetrySupervisor } from "../../../agents/extensions/turn_retry/turn-retry-supervisor.js";
import type {
  TurnRecoveryBranch,
  TurnRestartSignalKey,
} from "../../../core/contracts/turn-retry.contracts.js";

export class TurnRetryToolSuite {
  private readonly supervisor: TurnRetrySupervisor;

  constructor(supervisor: TurnRetrySupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "turn_retry_inspect_state",
        description: "Inspects the active turn retry state machine, fired one-shot guards, and restart signals.",
        parameters: {},
        execute: async () => {
          const activeState = this.supervisor.getActiveState();
          return {
            success: true,
            hasActiveState: !!activeState,
            state: activeState,
          };
        },
      },
      {
        name: "turn_retry_trigger_recovery",
        description: "Triggers an isolated one-shot recovery branch (e.g. codexAuthRetryAttempted, thinkingSigRetryAttempted).",
        parameters: {
          branch: {
            type: "string",
            description: "Name of the recovery branch to trigger.",
            required: true,
          },
          details: {
            type: "string",
            description: "Optional forensic rationale or error message.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const branch = String(args.branch || "") as TurnRecoveryBranch;
          const details = typeof args.details === "string" ? args.details : undefined;

          const triggered = this.supervisor.triggerRecovery(branch, details);
          return {
            success: true,
            branch,
            triggered,
            currentState: this.supervisor.getActiveState(),
          };
        },
      },
      {
        name: "turn_retry_set_restart_signal",
        description: "Sets an adaptive restart signal (e.g. restartWithCompressedMessages, restartWithRebuiltMessages).",
        parameters: {
          signalKey: {
            type: "string",
            description: "Name of the restart signal to set.",
            required: true,
          },
          details: {
            type: "string",
            description: "Optional rationale or transform context.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const signalKey = String(args.signalKey || "") as TurnRestartSignalKey;
          const details = typeof args.details === "string" ? args.details : undefined;

          const set = this.supervisor.setRestartSignal(signalKey, details);
          return {
            success: true,
            signalKey,
            set,
            currentState: this.supervisor.getActiveState(),
          };
        },
      },
      {
        name: "turn_retry_configure",
        description: "Configures turn retry policies, maximum retry limits, and compression budgets.",
        parameters: {
          maxRetriesPerTurn: {
            type: "number",
            description: "Maximum retries allowed per model turn.",
            required: false,
          },
          maxCompressionAttempts: {
            type: "number",
            description: "Maximum compression attempts before failing.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const maxRetriesPerTurn = typeof args.maxRetriesPerTurn === "number" ? args.maxRetriesPerTurn : undefined;
          const maxCompressionAttempts = typeof args.maxCompressionAttempts === "number" ? args.maxCompressionAttempts : undefined;

          this.supervisor.configure({
            maxRetriesPerTurn,
            maxCompressionAttempts,
          });

          return {
            success: true,
            config: this.supervisor.getConfig(),
          };
        },
      },
      {
        name: "turn_retry_get_metrics",
        description: "Retrieves aggregate telemetry metrics on turn retries, recovery branches, and restart signals.",
        parameters: {},
        execute: async () => {
          const metrics = this.supervisor.getMetrics();
          return {
            success: true,
            metrics,
          };
        },
      },
    ];
  }
}
