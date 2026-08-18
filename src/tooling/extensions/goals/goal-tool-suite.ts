/**
 * Model Tool Suite for Goal Management, Quality Gates, Milestone DAGs, Diffing & Retrospectives
 * Subsystem: Target #74 / ADR-117
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  GoalCategory,
  GoalGroupBy,
  GoalNotificationTrigger,
  GoalNotificationUrgency,
  GoalSortBy,
  GoalSortDirection,
  GoalStatus,
} from "../../../core/contracts/goal.contracts.js";
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
        description: "Inspect active goal, milestone DAG progression, quality gates, and wait status for a session.",
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
        description: "Add a milestone checkpoint (with optional DAG dependencies) or mark an existing milestone as completed.",
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
          dependsOn: {
            type: "string",
            description: "Optional comma-separated IDs of prerequisites milestones.",
            required: false,
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
          const dependsOn =
            typeof args.dependsOn === "string" && args.dependsOn.length > 0
              ? args.dependsOn.split(",").map((d) => d.trim()).filter(Boolean)
              : [];

          if (!titleOrId) return { success: false, error: "titleOrId is required" };

          if (action === "add") {
            const ok = this.supervisor.addMilestone(sessionId, titleOrId, dependsOn);
            return {
              success: ok,
              message: ok ? `Added milestone '${titleOrId}' (depends on: ${dependsOn.join(",") || "none"})` : "No active goal found",
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
          autoRemediateCommand: {
            type: "string",
            description: "Optional shell command to automatically execute if the gate fails before aborting.",
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
          const autoRemediateCommand = typeof args.autoRemediateCommand === "string" ? args.autoRemediateCommand : undefined;
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const timeoutSeconds = typeof args.timeoutSeconds === "number" ? args.timeoutSeconds : undefined;

          const success = this.supervisor.addGate(sessionId, command, { policy, timeoutSeconds, autoRemediateCommand });
          return {
            success,
            message: success ? `Added ${policy} quality gate '$ ${command}' to session '${sessionId}'.` : `No active goal found for session '${sessionId}'.`,
          };
        },
      },
      {
        name: "goal_diff",
        description: "Perform a structural diff comparison between two session goals.",
        parameters: {
          sessionIdA: {
            type: "string",
            description: "First session ID.",
            required: true,
          },
          sessionIdB: {
            type: "string",
            description: "Second session ID.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const idA = String(args.sessionIdA || "").trim();
          const idB = String(args.sessionIdB || "").trim();
          if (!idA || !idB) return { success: false, error: "sessionIdA and sessionIdB are required" };

          const diff = this.supervisor.diffGoals(idA, idB);
          if (!diff) return { success: false, error: `One or both goals ('${idA}', '${idB}') not found` };

          return {
            success: true,
            diff,
          };
        },
      },
      {
        name: "goal_trajectory",
        description: "Inspect chronological step execution events and gate evaluations trajectory for a session goal.",
        parameters: {
          sessionId: {
            type: "string",
            description: "Session identifier.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const trajectory = this.supervisor.getTrajectory(sessionId);

          return {
            success: true,
            totalEvents: trajectory.length,
            trajectory,
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
      {
        name: "goal_group_and_sort",
        description: "Group and sort goals across sessions by status, category, progress tier, or turns budget utilization.",
        parameters: {
          groupBy: { type: "string", description: "status | category | progress | turns (default: status)" },
          sortBy: { type: "string", description: "createdAt | progress | turns | milestones | gates (default: createdAt)" },
          sortDirection: { type: "string", description: "asc | desc (default: desc)" },
          status: { type: "string", description: "Optional status filter" },
          category: { type: "string", description: "Optional category filter" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const groupBy = (typeof args.groupBy === "string" ? args.groupBy : "status") as GoalGroupBy;
          const sortBy = (typeof args.sortBy === "string" ? args.sortBy : "createdAt") as GoalSortBy;
          const sortDirection = (typeof args.sortDirection === "string" ? args.sortDirection : "desc") as GoalSortDirection;
          const lanes = this.supervisor.getGroupedGoals(groupBy, sortBy, sortDirection, {
            status: typeof args.status === "string" ? (args.status as GoalStatus) : undefined,
            category: typeof args.category === "string" ? (args.category as GoalCategory) : undefined,
          });

          return {
            success: true,
            groupBy,
            sortBy,
            sortDirection,
            lanes,
          };
        },
      },
      {
        name: "goal_get_hierarchy",
        description: "Retrieve complete parent-to-child goal DAG hierarchy and aggregate progress metrics.",
        parameters: {
          sessionId: { type: "string", description: "Session identifier (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const hierarchy = this.supervisor.getGoalWithHierarchy(sessionId);
          if (!hierarchy) return { success: false, error: `Goal '${sessionId}' not found` };

          return {
            success: true,
            hierarchy,
          };
        },
      },
      {
        name: "goal_get_velocity_metrics",
        description: "Calculate overall goal completion throughput, turn allocation efficiency, and quality gate pass rates.",
        parameters: {},
        execute: async (_args: Record<string, unknown>, _cwd: string) => {
          const metrics = this.supervisor.getVelocityMetrics();
          return {
            success: true,
            metrics,
          };
        },
      },
      {
        name: "goal_bulk_update",
        description: "Apply status, category, or turn budget mutations to multiple goal sessions atomically.",
        parameters: {
          sessionIds: { type: "string", required: true, description: "Comma-separated list of session IDs" },
          status: { type: "string", description: "Target status (active | paused | done | cleared | failed)" },
          category: { type: "string", description: "Target category" },
          maxTurns: { type: "number", description: "Target max turns" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const rawIds = String(args.sessionIds || "").trim();
          if (!rawIds) return { success: false, error: "sessionIds is required" };

          const sessionIds = rawIds.split(",").map((s) => s.trim()).filter(Boolean);
          const res = this.supervisor.bulkUpdateGoals(sessionIds, {
            status: typeof args.status === "string" ? (args.status as GoalStatus) : undefined,
            category: typeof args.category === "string" ? (args.category as GoalCategory) : undefined,
            maxTurns: typeof args.maxTurns === "number" ? args.maxTurns : undefined,
          });

          return {
            success: res.updatedCount > 0,
            result: res,
          };
        },
      },
      {
        name: "goal_undo",
        description: "Undo the last mutation on a goal session.",
        parameters: {
          sessionId: { type: "string", description: "Session identifier (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const res = this.supervisor.undo(sessionId);
          return {
            success: res.success,
            restoredGoal: res.restoredGoal,
            error: res.error,
          };
        },
      },
      {
        name: "goal_export_html",
        description: "Export an interactive single-page Linear/Notion-inspired HTML dashboard for goal tracking, milestone DAGs, and quality gates.",
        parameters: {
          sessionId: { type: "string", description: "Session identifier (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const html = this.supervisor.exportHtml(sessionId);
          return {
            success: true,
            sessionId,
            html,
          };
        },
      },
      {
        name: "goal_export_markdown",
        description: "Export a goal and its milestone checkpoints as a clean GitHub-flavored markdown report.",
        parameters: {
          sessionId: { type: "string", description: "Session identifier (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const markdown = this.supervisor.exportMarkdown(sessionId);
          return {
            success: true,
            sessionId,
            markdown,
          };
        },
      },
      {
        name: "goal_export_csv",
        description: "Export all session goals and metrics into CSV spreadsheet format.",
        parameters: {},
        execute: async (_args: Record<string, unknown>, _cwd: string) => {
          const csv = this.supervisor.exportCsv();
          return {
            success: true,
            csv,
          };
        },
      },
      {
        name: "goal_render_dag_graph",
        description: "Render visual ASCII / Unicode DAG dependency tree of goal milestones in terminal.",
        parameters: {
          sessionId: { type: "string", description: "Session identifier (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const graph = this.supervisor.renderDagGraph(sessionId);
          return {
            success: true,
            sessionId,
            graph,
          };
        },
      },
      {
        name: "goal_render_dashboard",
        description: "Render a comprehensive ANSI CLI dashboard summary of goal progress, milestones, and quality gates.",
        parameters: {
          sessionId: { type: "string", description: "Session identifier (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const dashboard = this.supervisor.renderDashboard(sessionId);
          return {
            success: true,
            sessionId,
            dashboard,
          };
        },
      },
      {
        name: "goal_send_notification",
        description: "Dispatch a cross-platform desktop or terminal notification regarding a goal event.",
        parameters: {
          title: { type: "string", required: true, description: "Notification title" },
          message: { type: "string", required: true, description: "Notification message body" },
          urgency: { type: "string", description: "low | normal | critical (default: normal)" },
          trigger: { type: "string", description: "Trigger kind (default: custom)" },
          sessionId: { type: "string", description: "Associated session ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const title = String(args.title || "");
          const message = String(args.message || "");
          const urgency = (typeof args.urgency === "string" ? args.urgency : "normal") as GoalNotificationUrgency;
          const trigger = (typeof args.trigger === "string" ? args.trigger : "custom") as GoalNotificationTrigger;
          const sessionId = typeof args.sessionId === "string" ? args.sessionId : undefined;

          const res = await this.supervisor.getSubstrate().getNotificationDispatcher().dispatch({
            title,
            message,
            urgency,
            trigger,
            sessionId,
          });

          return {
            success: res.dispatched,
            channels: res.channels,
            recordId: res.record?.id,
            reason: res.reason,
          };
        },
      },
      {
        name: "goal_get_notifications",
        description: "Retrieve recent goal notification history buffer.",
        parameters: {
          unreadOnly: { type: "boolean", description: "Only return unread notifications" },
          limit: { type: "number", description: "Max records to return (default: 50)" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const unreadOnly = typeof args.unreadOnly === "boolean" ? args.unreadOnly : false;
          const limit = typeof args.limit === "number" ? args.limit : 50;
          const records = this.supervisor.getSubstrate().getNotificationDispatcher().getHistory({ unreadOnly, limit });

          return {
            success: true,
            count: records.length,
            notifications: records,
          };
        },
      },
      {
        name: "goal_configure_notifications",
        description: "Configure goal desktop notification preferences (sound, DND, minimum urgency).",
        parameters: {
          enabled: { type: "boolean", description: "Master enable flag" },
          soundEnabled: { type: "boolean", description: "Enable sound effects" },
          dndEnabled: { type: "boolean", description: "Enable Do Not Disturb mode" },
          minUrgency: { type: "string", description: "low | normal | critical" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const prefs = this.supervisor.getSubstrate().getNotificationDispatcher().updatePreferences({
            enabled: typeof args.enabled === "boolean" ? args.enabled : undefined,
            soundEnabled: typeof args.soundEnabled === "boolean" ? args.soundEnabled : undefined,
            dndEnabled: typeof args.dndEnabled === "boolean" ? args.dndEnabled : undefined,
            minUrgency: typeof args.minUrgency === "string" ? (args.minUrgency as GoalNotificationUrgency) : undefined,
          });

          return {
            success: true,
            preferences: prefs,
          };
        },
      },
      {
        name: "goal_toggle_milestone_checklist",
        description: "Toggle completion status of a checklist subtask item within a milestone checkpoint.",
        parameters: {
          sessionId: { type: "string", description: "Session identifier (default: 'default')" },
          milestoneId: { type: "string", required: true, description: "Milestone ID (e.g. 'm-1')" },
          checkId: { type: "string", required: true, description: "Checklist item ID or text" },
          done: { type: "boolean", description: "Target done status (toggle if omitted)" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const milestoneId = String(args.milestoneId || "");
          const checkId = String(args.checkId || "");
          const done = typeof args.done === "boolean" ? args.done : undefined;

          const ok = this.supervisor.toggleMilestoneChecklist(sessionId, milestoneId, checkId, done);
          return {
            success: ok,
            sessionId,
            milestoneId,
            checkId,
            message: ok ? `Checklist item '${checkId}' in milestone '${milestoneId}' updated.` : `Failed to update checklist item.`,
          };
        },
      },
      {
        name: "goal_auto_assign_swarm",
        description: "Autonomous Swarm Workload Balancer: Distributes uncompleted milestones across worker session IDs evenly.",
        parameters: {
          parentSessionId: { type: "string", required: true, description: "Parent goal session ID" },
          workerSessionIds: { type: "string", required: true, description: "Comma-separated list of worker session IDs" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const parentSessionId = String(args.parentSessionId || "").trim();
          const rawWorkers = String(args.workerSessionIds || "").trim();
          const workerIds = rawWorkers.split(",").map((s) => s.trim()).filter(Boolean);

          const result = this.supervisor.autoAssignSwarm(parentSessionId, workerIds);
          return {
            success: result.assignedMilestonesCount > 0,
            result,
          };
        },
      },
      {
        name: "goal_archive_completed",
        description: "Archive completed and fulfilled goals to maintain clean high-velocity active workspaces.",
        parameters: {
          cutoffMs: { type: "number", description: "Optional cutoff timestamp age in ms" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const cutoffMs = typeof args.cutoffMs === "number" ? args.cutoffMs : 0;
          const result = this.supervisor.archiveCompletedGoals(cutoffMs);
          return {
            success: true,
            result,
          };
        },
      },
      {
        name: "goal_clone",
        description: "Clone a goal session into a new session for subsequent sprint iterations or phase transitions.",
        parameters: {
          sourceSessionId: { type: "string", required: true, description: "Source session ID" },
          targetSessionId: { type: "string", required: true, description: "Target new session ID" },
          resetProgress: { type: "boolean", description: "Reset progress and checklists to pending (default: false)" },
          resetGates: { type: "boolean", description: "Reset gate attempt counters (default: false)" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const src = String(args.sourceSessionId || "");
          const tgt = String(args.targetSessionId || "");
          const resetProgress = typeof args.resetProgress === "boolean" ? args.resetProgress : false;
          const resetGates = typeof args.resetGates === "boolean" ? args.resetGates : false;

          const cloned = this.supervisor.cloneGoal(src, tgt, { resetProgress, resetGates });
          return {
            success: cloned !== null,
            clonedGoal: cloned,
          };
        },
      },
      {
        name: "goal_create_from_template",
        description: "Instantiate a specialized goal directly from built-in template with preset quality gates & milestone DAGs.",
        parameters: {
          templateId: { type: "string", required: true, description: "Template kind: bugfix | feature | refactor | security_fix | performance_optimization | audit | release | learning" },
          sessionId: { type: "string", description: "Target session ID (default: 'default')" },
          targetOutcome: { type: "string", description: "Specific outcome or title for the goal" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const tmplId = String(args.templateId || "feature");
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const targetOutcome = typeof args.targetOutcome === "string" ? args.targetOutcome : undefined;

          const state = this.supervisor.instantiateTemplate(tmplId, sessionId, targetOutcome);
          return {
            success: state !== undefined,
            state,
            message: state ? `Goal instantiated from '${tmplId}' template for session '${sessionId}'.` : `Template '${tmplId}' not found.`,
          };
        },
      },
      {
        name: "goal_adjust_milestone_progress",
        description: "Adjust milestone progress percentage by a relative delta (e.g. +10, -20).",
        parameters: {
          sessionId: { type: "string", description: "Session identifier (default: 'default')" },
          milestoneId: { type: "string", required: true, description: "Milestone ID" },
          deltaPercent: { type: "number", required: true, description: "Delta percent to add/subtract (e.g. 10 or -10)" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const milestoneId = String(args.milestoneId || "");
          const deltaPercent = typeof args.deltaPercent === "number" ? args.deltaPercent : 10;

          const ok = this.supervisor.adjustMilestoneProgress(sessionId, milestoneId, deltaPercent);
          return {
            success: ok,
            sessionId,
            milestoneId,
            deltaPercent,
            message: ok ? `Adjusted milestone '${milestoneId}' progress by ${deltaPercent}%.` : `Failed to adjust progress.`,
          };
        },
      },
      {
        name: "goal_set_milestone_blocked",
        description: "Set or clear the blocked status of a milestone checkpoint with optional reason.",
        parameters: {
          sessionId: { type: "string", description: "Session identifier (default: 'default')" },
          milestoneId: { type: "string", required: true, description: "Milestone ID" },
          blocked: { type: "boolean", required: true, description: "True to mark blocked, false to unblock" },
          reason: { type: "string", description: "Optional explanation for blocking" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const milestoneId = String(args.milestoneId || "");
          const blocked = typeof args.blocked === "boolean" ? args.blocked : true;
          const reason = typeof args.reason === "string" ? args.reason : undefined;

          const ok = this.supervisor.setMilestoneBlocked(sessionId, milestoneId, blocked, reason);
          return {
            success: ok,
            sessionId,
            milestoneId,
            blocked,
            message: ok ? `Milestone '${milestoneId}' ${blocked ? "marked as BLOCKED" : "unblocked"}.` : `Failed to update milestone blocked status.`,
          };
        },
      },
      {
        name: "goal_audit_health",
        description: "Audit SLA delivery health, pacing consumption rate against maxTurns budget, and remaining turns estimation.",
        parameters: {
          sessionId: { type: "string", description: "Session identifier (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const report = this.supervisor.auditGoalHealth(sessionId);
          return {
            success: report !== null,
            health: report,
          };
        },
      },
      {
        name: "goal_diagnose_risks",
        description: "Diagnose root-cause failure risks, blast radius in DAG, and formulate immediate actionable remediation steps.",
        parameters: {
          sessionId: { type: "string", description: "Session identifier (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const diagnosis = this.supervisor.diagnoseGoalRisks(sessionId);
          return {
            success: diagnosis !== null,
            diagnosis,
          };
        },
      },
      {
        name: "goal_tag_milestone",
        description: "Attach or update tag labels (e.g. ['backend', 'p0', 'security']) to a goal or specific milestone.",
        parameters: {
          sessionId: { type: "string", description: "Session identifier (default: 'default')" },
          tags: { type: "string", required: true, description: "Comma-separated list of tags" },
          milestoneId: { type: "string", description: "Optional milestone ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const rawTags = String(args.tags || "");
          const tags = rawTags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean);
          const milestoneId = typeof args.milestoneId === "string" ? args.milestoneId : undefined;

          const ok = this.supervisor.tagGoalOrMilestone(sessionId, tags, milestoneId);
          return {
            success: ok,
            sessionId,
            milestoneId,
            tags,
            message: ok ? `Tagged with ${tags.map((t) => `#${t}`).join(", ")}.` : `Failed to tag goal or milestone.`,
          };
        },
      },
      {
        name: "goal_set_deadline",
        description: "Set a target completion deadline timestamp for a goal or specific milestone.",
        parameters: {
          sessionId: { type: "string", description: "Session identifier (default: 'default')" },
          deadlineMs: { type: "number", required: true, description: "Target deadline epoch timestamp in milliseconds" },
          milestoneId: { type: "string", description: "Optional milestone ID" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const deadlineMs = Number(args.deadlineMs || 0);
          const milestoneId = typeof args.milestoneId === "string" ? args.milestoneId : undefined;

          const ok = this.supervisor.setGoalDeadline(sessionId, deadlineMs, milestoneId);
          return {
            success: ok,
            sessionId,
            milestoneId,
            deadlineMs,
            targetDate: new Date(deadlineMs).toISOString(),
          };
        },
      },
      {
        name: "goal_decompose_prompt",
        description: "Intelligently decompose a high-level goal prompt into an autonomous DAG of milestones, subtask checklists, and quality gates.",
        parameters: {
          prompt: { type: "string", required: true, description: "Natural language goal description" },
          category: { type: "string", description: "Optional goal category ('bugfix' | 'feature' | 'refactor' | 'audit' | 'release' | 'learning')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const prompt = String(args.prompt || "");
          const category = typeof args.category === "string" ? (args.category as any) : undefined;
          const decomposition = this.supervisor.decomposeGoalPrompt(prompt, category);
          return {
            success: true,
            decomposition,
          };
        },
      },
      {
        name: "goal_revert_milestone",
        description: "Rollback a milestone to pending or in_progress state, atomically rolling back downstream dependent milestones.",
        parameters: {
          sessionId: { type: "string", description: "Session identifier (default: 'default')" },
          milestoneId: { type: "string", required: true, description: "Milestone ID to revert" },
          reason: { type: "string", description: "Explanation for the rollback" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const milestoneId = String(args.milestoneId || "");
          const reason = typeof args.reason === "string" ? args.reason : undefined;

          const rollbackResult = this.supervisor.revertMilestone(sessionId, milestoneId, reason);
          return {
            success: rollbackResult.success,
            rollback: rollbackResult,
          };
        },
      },
      {
        name: "goal_search_dsl",
        description: "Search and filter goals using natural DSL queries (e.g. 'status:active cat:bugfix tag:p0 progress:>50 health:at_risk search term').",
        parameters: {
          query: { type: "string", required: true, description: "Natural query DSL filter string" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const rawQuery = String(args.query || "");
          const goals = this.supervisor.queryGoalsDsl(rawQuery);
          return {
            success: true,
            query: rawQuery,
            count: goals.length,
            goals,
          };
        },
      },
      {
        name: "goal_get_burnup_forecast",
        description: "Retrieve velocity burnup forecast, turns completion projection, and ASCII progress graph for a goal.",
        parameters: {
          sessionId: { type: "string", description: "Session identifier (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const forecast = this.supervisor.getBurnupForecast(sessionId);
          return {
            success: forecast !== null,
            forecast,
          };
        },
      },
      {
        name: "goal_export_burnup_chart",
        description: "Export the ASCII or SVG burnup and velocity forecast chart for terminal or documentation embedding.",
        parameters: {
          sessionId: { type: "string", description: "Session identifier (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const forecast = this.supervisor.getBurnupForecast(sessionId);
          return {
            success: forecast !== null,
            chart: forecast?.asciiChart || "No forecast available",
            projectedTurn: forecast?.projectedCompletionTurn,
            isOnBudget: forecast?.isAchievableWithinBudget,
          };
        },
      },
      {
        name: "goal_handoff_swarm",
        description: "Hand off a milestone from one worker agent session to another within a parent goal swarm hierarchy.",
        parameters: {
          parentSessionId: { type: "string", required: true, description: "Parent session ID" },
          milestoneId: { type: "string", required: true, description: "Milestone ID to transfer" },
          targetWorkerSessionId: { type: "string", required: true, description: "Target worker session ID" },
          contextPayload: { type: "string", description: "Optional JSON context payload or state diff" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const parentSessionId = String(args.parentSessionId || "default");
          const milestoneId = String(args.milestoneId || "");
          const targetWorkerSessionId = String(args.targetWorkerSessionId || "");
          let contextPayload: Record<string, unknown> | undefined;
          if (typeof args.contextPayload === "string" && args.contextPayload.trim()) {
            try {
              contextPayload = JSON.parse(args.contextPayload);
            } catch {
              contextPayload = { raw: args.contextPayload };
            }
          }

          const res = this.supervisor.handOffMilestone(parentSessionId, milestoneId, targetWorkerSessionId, contextPayload);
          return {
            success: res.success,
            handoff: res,
          };
        },
      },
      {
        name: "goal_watchdog_evaluate",
        description: "Execute continuous quality gate watchdog evaluations with automated retry loops and remediation telemetry.",
        parameters: {
          sessionId: { type: "string", description: "Session identifier (default: 'default')" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : "default";
          const report = await this.supervisor.watchdogEvaluateGates(sessionId);
          return {
            success: report.allPassed,
            watchdog: report,
          };
        },
      },
    ];
  }
}
