/**
 * deadline-tool-suite.ts
 *
 * Model tool definitions exposing Unified Deadline & Emergency Stop Governance to agents
 * (Phase 125 / ADR-101 / Target #58).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { DeadlineSupervisor } from "../../../agents/extensions/deadline/deadline-supervisor.js";

export class DeadlineToolSuite {
  private readonly supervisor: DeadlineSupervisor;

  constructor(supervisor: DeadlineSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "deadline_run_bounded",
        description:
          "Executes a simulated or asynchronous operation bounded by a strict wall-clock deadline.",
        parameters: {
          actionName: {
            type: "string",
            description: "Descriptive name of the action being executed.",
            required: true,
          },
          timeoutMs: {
            type: "number",
            description: "Timeout in milliseconds.",
            required: false,
          },
          simulatedDurationMs: {
            type: "number",
            description: "Simulated duration for testing deadline enforcement.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const actionName = typeof args.actionName === "string" ? args.actionName : "unnamed_action";
          const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : 5000;
          const simDuration = typeof args.simulatedDurationMs === "number" ? args.simulatedDurationMs : 10;

          const result = await this.supervisor.runBounded(async () => {
            await new Promise((resolve) => setTimeout(resolve, simDuration));
            return { action: actionName, status: "completed" };
          }, timeoutMs);

          return {
            success: result.success,
            outcome: result.outcome,
            timedOut: result.timedOut,
            durationMs: result.durationMs,
            data: result.data,
            error: result.error,
          };
        },
      },
      {
        name: "estop_engage",
        description:
          "Engages the global Emergency Stop (ESTOP), preventing any new work from starting.",
        parameters: {
          reason: {
            type: "string",
            description: "Audit reason for engaging the emergency stop.",
            required: false,
          },
          engagedBy: {
            type: "string",
            description: "Operator or agent identity engaging the stop.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const reason = typeof args.reason === "string" ? args.reason : "Operator manual stop";
          const engagedBy = typeof args.engagedBy === "string" ? args.engagedBy : "operator";

          const state = this.supervisor.engageEstop(reason, engagedBy);
          return {
            success: true,
            engaged: state.engaged,
            reason: state.reason,
            engagedAt: state.engagedAt,
            engagedBy: state.engagedBy,
          };
        },
      },
      {
        name: "estop_disengage",
        description:
          "Lifts the global Emergency Stop, restoring normal execution for new work.",
        parameters: {},
        execute: async () => {
          this.supervisor.disengageEstop();
          return {
            success: true,
            engaged: false,
            message: "Emergency Stop disengaged. System active.",
          };
        },
      },
      {
        name: "estop_get_status",
        description:
          "Inspects the active global Emergency Stop state and audit trail.",
        parameters: {},
        execute: async () => {
          const state = this.supervisor.getEstopState();
          return {
            success: true,
            engaged: state.engaged,
            reason: state.reason,
            engagedAt: state.engagedAt,
            engagedBy: state.engagedBy,
          };
        },
      },
      {
        name: "deadline_get_metrics",
        description:
          "Retrieves aggregate statistics on bounded executions, timeouts, and ESTOP events.",
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
