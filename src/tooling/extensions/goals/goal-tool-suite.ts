/**
 * Model Tool Suite for Goal Management, Quality Gates & Ralph Loop Control
 * Subsystem: Target #74 / ADR-117
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { GoalSupervisor } from "../../../agents/extensions/goals/goal-supervisor.js";

export class GoalToolSuite {
  private readonly supervisor: GoalSupervisor;

  constructor(supervisor: GoalSupervisor) {
    this.supervisor = supervisor;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "goal_set",
        description: "Set or update a persistent standing goal for the current session with optional completion contract.",
        parameters: {
          goal: {
            type: "string",
            description: "The goal objective text (can include inline verify:, constraints:, boundaries:, stop when:).",
            required: true,
          },
          sessionId: {
            type: "string",
            description: "Session identifier (defaults to current active session).",
            required: false,
          },
          maxTurns: {
            type: "number",
            description: "Optional maximum turns budget before auto-pausing (default: 20).",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const goal = String(args.goal || "");
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const maxTurns = typeof args.maxTurns === "number" ? args.maxTurns : undefined;

          const state = this.supervisor.setGoal(sessionId, goal, { maxTurns });
          return {
            success: true,
            state,
            message: `Goal set for session '${sessionId}': "${state.goal}" (${state.maxTurns} turns budget).`,
          };
        },
      },
      {
        name: "goal_status",
        description: "Inspect active goal, progress, subgoals, quality gates, and wait status for a session.",
        parameters: {
          sessionId: {
            type: "string",
            description: "Session identifier.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const state = this.supervisor.getGoal(sessionId);
          const metrics = this.supervisor.getMetrics();

          return {
            success: true,
            hasGoal: state !== null,
            state,
            metrics,
          };
        },
      },
      {
        name: "goal_add_subgoal",
        description: "Add an additional criterion or subgoal requirement to the active standing goal.",
        parameters: {
          subgoal: {
            type: "string",
            description: "The subgoal / criterion to append.",
            required: true,
          },
          sessionId: {
            type: "string",
            description: "Session identifier.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const subgoal = String(args.subgoal || "");
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";

          const success = this.supervisor.addSubgoal(sessionId, subgoal);
          return {
            success,
            message: success ? `Added subgoal to session '${sessionId}': "${subgoal}"` : `No active goal found for session '${sessionId}'.`,
          };
        },
      },
      {
        name: "goal_add_gate",
        description: "Add a deterministic quality gate shell command that must pass before the goal can be declared done.",
        parameters: {
          command: {
            type: "string",
            description: "The shell verification command (e.g. 'npm test', 'pytest', 'tsc --noEmit').",
            required: true,
          },
          sessionId: {
            type: "string",
            description: "Session identifier.",
            required: false,
          },
          timeoutSeconds: {
            type: "number",
            description: "Command timeout in seconds (default: 300).",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const command = String(args.command || "");
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const timeoutSeconds = typeof args.timeoutSeconds === "number" ? args.timeoutSeconds : undefined;

          const success = this.supervisor.addGate(sessionId, command, { timeoutSeconds });
          return {
            success,
            message: success ? `Added quality gate '$ ${command}' to session '${sessionId}'.` : `No active goal found for session '${sessionId}'.`,
          };
        },
      },
      {
        name: "goal_pause_resume_clear",
        description: "Control the lifecycle of an active session goal (pause, resume, or clear).",
        parameters: {
          action: {
            type: "string",
            description: "Lifecycle action to perform: 'pause', 'resume', or 'clear'.",
            required: true,
          },
          sessionId: {
            type: "string",
            description: "Session identifier.",
            required: false,
          },
          reason: {
            type: "string",
            description: "Optional reason (e.g. for pause).",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const action = String(args.action || "").toLowerCase();
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const reason = typeof args.reason === "string" ? args.reason : undefined;

          let success = false;
          if (action === "pause") {
            success = this.supervisor.pauseGoal(sessionId, reason);
          } else if (action === "resume") {
            success = this.supervisor.resumeGoal(sessionId);
          } else if (action === "clear") {
            success = this.supervisor.clearGoal(sessionId);
          } else {
            return { success: false, error: `Unrecognized action '${action}'. Must be 'pause', 'resume', or 'clear'.` };
          }

          return {
            success,
            action,
            message: success ? `Goal in session '${sessionId}' successfully ${action}d.` : `Failed to ${action} goal for session '${sessionId}'.`,
          };
        },
      },
      {
        name: "goal_evaluate_turn",
        description: "Evaluate whether the assistant's last response satisfies the goal or generates the continuation prompt.",
        parameters: {
          lastResponse: {
            type: "string",
            description: "The assistant's most recent output.",
            required: true,
          },
          sessionId: {
            type: "string",
            description: "Session identifier.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const lastResponse = String(args.lastResponse || "");
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";

          const result = await this.supervisor.evaluateTurn(sessionId, lastResponse, { cwd });
          return {
            success: true,
            result,
          };
        },
      },
    ];
  }
}
