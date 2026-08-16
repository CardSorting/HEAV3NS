/**
 * Model Tool Suite for Goal Management, Quality Gates, Milestone DAGs & Retrospectives
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
        description: "Set or update a persistent standing goal for the current session with optional completion contract and milestones.",
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
          milestones: {
            type: "string",
            description: "Optional comma-separated list of milestone checkpoints.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const goal = String(args.goal || "");
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const maxTurns = typeof args.maxTurns === "number" ? args.maxTurns : undefined;
          const milestones =
            typeof args.milestones === "string" && args.milestones.length > 0
              ? args.milestones.split(",").map((m) => m.trim()).filter(Boolean)
              : undefined;

          const state = this.supervisor.setGoal(sessionId, goal, { maxTurns, milestones });
          return {
            success: true,
            state,
            message: `Goal set for session '${sessionId}': "${state.goal}" (${state.maxTurns} turns budget, ${state.milestones.length} milestones).`,
          };
        },
      },
      {
        name: "goal_status",
        description: "Inspect active goal, milestone progression, quality gates, and wait status for a session.",
        parameters: {
          sessionId: {
            type: "string",
            description: "Session identifier.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
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
        name: "goal_template",
        description: "List built-in goal templates (e.g. bugfix, feature, refactor, audit, release) or instantiate a goal from a template.",
        parameters: {
          action: {
            type: "string",
            description: "'list' | 'instantiate'",
            required: true,
          },
          templateId: {
            type: "string",
            description: "Template ID (required for 'instantiate').",
            required: false,
          },
          sessionId: {
            type: "string",
            description: "Session identifier (defaults to 'default').",
            required: false,
          },
          outcome: {
            type: "string",
            description: "Optional custom outcome text for the goal.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const action = String(args.action || "").toLowerCase();

          if (action === "list") {
            const templates = this.supervisor.listTemplates();
            return {
              success: true,
              totalTemplates: templates.length,
              templates,
            };
          }

          if (action === "instantiate") {
            const tmplId = String(args.templateId || "").trim();
            const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
            const outcome = typeof args.outcome === "string" ? args.outcome : undefined;

            if (!tmplId) return { success: false, error: "templateId is required for instantiate" };

            const state = this.supervisor.instantiateTemplate(tmplId, sessionId, outcome);
            if (!state) return { success: false, error: `Template '${tmplId}' not found` };

            return {
              success: true,
              state,
              message: `Instantiated goal from template '${tmplId}' for session '${sessionId}'`,
            };
          }

          return { success: false, error: "action must be 'list' or 'instantiate'" };
        },
      },
      {
        name: "goal_milestone",
        description: "Add a milestone checkpoint or mark an existing milestone as completed.",
        parameters: {
          action: {
            type: "string",
            description: "'add' | 'complete'",
            required: true,
          },
          titleOrId: {
            type: "string",
            description: "Milestone title (for 'add') or milestone ID/title (for 'complete').",
            required: true,
          },
          sessionId: {
            type: "string",
            description: "Session identifier.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const action = String(args.action || "").toLowerCase();
          const titleOrId = String(args.titleOrId || "").trim();
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";

          if (!titleOrId) return { success: false, error: "titleOrId is required" };

          if (action === "add") {
            const ok = this.supervisor.addMilestone(sessionId, titleOrId);
            return {
              success: ok,
              message: ok ? `Added milestone '${titleOrId}'` : "No active goal found",
            };
          }

          if (action === "complete") {
            const ok = this.supervisor.completeMilestone(sessionId, titleOrId);
            return {
              success: ok,
              message: ok ? `Completed milestone '${titleOrId}'` : "Milestone or goal not found",
            };
          }

          return { success: false, error: "action must be 'add' or 'complete'" };
        },
      },
      {
        name: "goal_gate",
        description: "Add an automated quality gate verification shell command that must pass before the goal can be completed.",
        parameters: {
          command: {
            type: "string",
            description: "The shell verification command (e.g. 'npm test', 'npm run check').",
            required: true,
          },
          policy: {
            type: "string",
            description: "'blocking' (strictly fails closed) | 'advisory' (warns only). Default: 'blocking'.",
            required: false,
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
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const command = String(args.command || "");
          const policy = args.policy === "advisory" ? "advisory" : "blocking";
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const timeoutSeconds = typeof args.timeoutSeconds === "number" ? args.timeoutSeconds : undefined;

          const success = this.supervisor.addGate(sessionId, command, { policy, timeoutSeconds });
          return {
            success,
            message: success ? `Added ${policy} quality gate '$ ${command}' to session '${sessionId}'.` : `No active goal found for session '${sessionId}'.`,
          };
        },
      },
      {
        name: "goal_control",
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
        execute: async (args: Record<string, unknown>, _cwd: string) => {
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
          }

          return {
            success,
            action,
            message: success ? `Goal action '${action}' executed successfully on session '${sessionId}'.` : `Action '${action}' failed or no active goal found.`,
          };
        },
      },
      {
        name: "goal_retro",
        description: "Retrieve retrospective audit metrics, gate completion score, and turn efficiency for a goal.",
        parameters: {
          sessionId: {
            type: "string",
            description: "Session identifier.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const retro = this.supervisor.getRetrospective(sessionId);
          if (!retro) return { success: false, error: "No goal found for this session." };

          return {
            success: true,
            retrospective: retro,
          };
        },
      },
      {
        name: "goal_list",
        description: "List or search all goals across sessions using optional Natural Query DSL (e.g. 'is:active category:bugfix sort:progress').",
        parameters: {
          query: {
            type: "string",
            description: "Optional Natural Query DSL filter string.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const query = typeof args.query === "string" ? args.query : undefined;
          const goals = this.supervisor.listGoals(query);

          return {
            success: true,
            totalGoals: goals.length,
            goals,
          };
        },
      },
    ];
  }
}
