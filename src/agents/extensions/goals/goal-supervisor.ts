/**
 * Goal Supervisor coordinating Goal Lifecycle, Quality Gates, Milestone DAGs & Slash Command UX
 * Reference: hermes-agent-main/hermes_cli/goals.py, hermes_cli/loops.py
 * Subsystem: Target #74 / ADR-117
 */

import type {
  GoalContract,
  GoalEvaluationResult,
  GoalGate,
  GoalGatePolicy,
  GoalMilestone,
  GoalQueryFilter,
  GoalRetroSummary,
  GoalState,
  GoalTemplate,
} from "../../../core/contracts/goal.contracts.js";
import {
  DEFAULT_GATE_MAX_RETRIES,
  DEFAULT_GATE_TIMEOUT_SECONDS,
  DEFAULT_GOAL_MAX_TURNS,
} from "../../../core/contracts/goal.contracts.js";
import { BroccoliGoalSubstrate } from "../../../sessions/extensions/goals/broccoli-goal-substrate.js";
import { DeterministicGoalEngine } from "./deterministic-goal-engine.js";

export class GoalSupervisor {
  private readonly substrate: BroccoliGoalSubstrate;
  private readonly engine: DeterministicGoalEngine;

  constructor(
    substrate: BroccoliGoalSubstrate,
    engine: DeterministicGoalEngine
  ) {
    this.substrate = substrate;
    this.engine = engine;
  }

  setGoal(
    sessionId: string,
    rawText: string,
    options: {
      maxTurns?: number;
      contract?: GoalContract;
      gates?: GoalGate[];
      milestones?: string[];
      category?: string;
      icon?: string;
    } = {}
  ): GoalState {
    this.substrate.recordInvocation();
    const { headline, contract } = this.engine.parseContract(rawText);
    const effectiveGoal = headline || rawText;
    const mergedContract = { ...contract, ...(options.contract || {}) };

    const milestones: GoalMilestone[] = (options.milestones || []).map((m, idx) => ({
      id: `m-${idx + 1}`,
      title: m,
      status: "pending",
      progressPercent: 0,
    }));

    const state: GoalState = {
      sessionId,
      goal: effectiveGoal,
      category: options.category as any || "general",
      icon: options.icon || "🎯",
      status: "active",
      turnsUsed: 0,
      maxTurns: options.maxTurns || DEFAULT_GOAL_MAX_TURNS,
      progressPercent: 0,
      createdAtMs: Date.now(),
      lastTurnAtMs: Date.now(),
      consecutiveParseFailures: 0,
      consecutiveTransportFailures: 0,
      subgoals: [],
      milestones,
      contract: mergedContract,
      gates: options.gates ? options.gates.map((g) => ({ ...g })) : [],
    };

    this.substrate.setGoal(state);
    return state;
  }

  instantiateTemplate(
    templateId: string,
    sessionId: string,
    targetOutcome?: string
  ): GoalState | undefined {
    const state = this.engine.instantiateTemplate(templateId, sessionId, targetOutcome);
    if (!state) return undefined;
    this.substrate.setGoal(state);
    this.substrate.recordInvocation();
    return state;
  }

  listTemplates(): readonly GoalTemplate[] {
    return this.engine.listTemplates();
  }

  getGoal(sessionId: string): GoalState | null {
    return this.substrate.getGoal(sessionId);
  }

  listGoals(queryOrFilter?: string | GoalQueryFilter): GoalState[] {
    if (!queryOrFilter) return this.substrate.listGoals();
    if (typeof queryOrFilter === "string") {
      const filter = this.engine.parseQueryDSL(queryOrFilter);
      return this.substrate.listGoals(filter);
    }
    return this.substrate.listGoals(queryOrFilter);
  }

  addMilestone(sessionId: string, title: string): boolean {
    const state = this.substrate.getGoal(sessionId);
    if (!state) return false;

    const newId = `m-${state.milestones.length + 1}`;
    state.milestones.push({
      id: newId,
      title: title.trim(),
      status: "pending",
      progressPercent: 0,
    });

    this.substrate.setGoal(state);
    return true;
  }

  completeMilestone(sessionId: string, milestoneId: string): boolean {
    const state = this.substrate.getGoal(sessionId);
    if (!state) return false;

    const ms = state.milestones.find((m) => m.id === milestoneId || m.title.toLowerCase() === milestoneId.toLowerCase());
    if (!ms) return false;

    ms.status = "completed";
    ms.progressPercent = 100;
    ms.completedAtMs = Date.now();

    this.substrate.setGoal(state);
    return true;
  }

  addSubgoal(sessionId: string, criterion: string): boolean {
    const state = this.substrate.getGoal(sessionId);
    if (!state) return false;
    state.subgoals.push(criterion.trim());
    this.substrate.setGoal(state);
    return true;
  }

  addGate(
    sessionId: string,
    command: string,
    options: { name?: string; policy?: GoalGatePolicy; timeoutSeconds?: number; maxRetries?: number } = {}
  ): boolean {
    const state = this.substrate.getGoal(sessionId);
    if (!state) return false;

    const gate: GoalGate = {
      id: `gate-${state.gates.length + 1}`,
      name: options.name || command.trim().split(" ")[0],
      command: command.trim(),
      policy: options.policy || "blocking",
      timeoutSeconds: options.timeoutSeconds || DEFAULT_GATE_TIMEOUT_SECONDS,
      maxRetries: options.maxRetries || DEFAULT_GATE_MAX_RETRIES,
      attempts: 0,
      lastOutputTail: "",
      lastFailedFingerprint: "",
    };

    state.gates.push(gate);
    this.substrate.setGoal(state);
    return true;
  }

  pauseGoal(sessionId: string, reason: string = "Paused by user"): boolean {
    const state = this.substrate.getGoal(sessionId);
    if (!state) return false;
    state.status = "paused";
    state.pausedReason = reason;
    this.substrate.setGoal(state);
    return true;
  }

  resumeGoal(sessionId: string): boolean {
    const state = this.substrate.getGoal(sessionId);
    if (!state) return false;
    state.status = "active";
    state.pausedReason = undefined;
    state.waitingOnPid = undefined;
    state.waitingOnSession = undefined;
    state.waitingUntil = undefined;
    state.waitingReason = undefined;
    this.substrate.setGoal(state);
    return true;
  }

  clearGoal(sessionId: string): boolean {
    const state = this.substrate.getGoal(sessionId);
    if (!state) return false;
    state.status = "cleared";
    this.substrate.setGoal(state);
    return true;
  }

  getRetrospective(sessionId: string): GoalRetroSummary | undefined {
    const state = this.substrate.getGoal(sessionId);
    if (!state) return undefined;
    return this.engine.generateRetrospective(state);
  }

  getMetrics() {
    return this.substrate.getMetrics();
  }

  async evaluateTurn(
    sessionId: string,
    lastResponse: string,
    options: {
      cwd?: string;
      currentFingerprint?: string;
      backgroundProcesses?: Array<{ pid: number; session?: string; command?: string }>;
      judgeFn?: (prompt: string) => Promise<{
        verdict: string;
        reason: string;
        wait_on_session?: string;
        wait_on_pid?: number;
        wait_for_seconds?: number;
      }>;
    } = {}
  ): Promise<GoalEvaluationResult> {
    const state = this.substrate.getGoal(sessionId);
    if (!state) {
      return {
        shouldContinue: false,
        verdict: "skipped",
        reason: "No active goal set for this session.",
      };
    }

    return this.engine.evaluateAfterTurn({
      state,
      lastResponse,
      cwd: options.cwd,
      currentFingerprint: options.currentFingerprint,
      backgroundProcesses: options.backgroundProcesses,
      judgeFn: options.judgeFn,
    });
  }

  /**
   * Interactive /goal Slash Command Router (Raycast/Alfred style ergonomics)
   */
  public executeSlashCommand(sessionId: string, commandLine: string): { success: boolean; output: string } {
    const parts = commandLine.trim().split(/\s+/);
    const subCmd = parts[1]?.toLowerCase();

    // /goal (Interactive Dashboard Overview)
    if (!subCmd || subCmd === "status" || subCmd === "dashboard") {
      const state = this.substrate.getGoal(sessionId);
      if (!state) {
        const templates = this.engine.listTemplates();
        const out = [
          `\x1b[1;36m=== LUMI Goal & Quality Gate Orchestrator ===\x1b[0m`,
          `No active goal set for session '\x1b[33m${sessionId}\x1b[0m'.`,
          ``,
          `\x1b[1;34mReady-to-Use Goal Templates:\x1b[0m`,
          ...templates.map((t) => `  ${t.icon} \x1b[1m${t.id.padEnd(10)}\x1b[0m - ${t.name}\n    \x1b[90m${t.description}\x1b[0m`),
          ``,
          `\x1b[33mType '/goal template <name>' or '/goal set <objective>' to activate a goal.\x1b[0m`,
        ];
        return { success: true, output: out.join("\n") };
      }

      // Progress bar visualization
      const filled = Math.round(state.progressPercent / 10);
      const empty = 10 - filled;
      const bar = `[${"█".repeat(filled)}${"░".repeat(empty)}] ${state.progressPercent}%`;

      const out = [
        `\x1b[1;36m=== Active Session Goal: ${state.icon || "🎯"} ${state.goal} ===\x1b[0m`,
        `Status:             \x1b[1;32m${state.status.toUpperCase()}\x1b[0m · Turns: ${state.turnsUsed}/${state.maxTurns}`,
        `Progress:           \x1b[1;33m${bar}\x1b[0m`,
        `Category:           ${(state.category || "general").toUpperCase()}`,
      ];

      if (state.milestones.length > 0) {
        out.push(``, `\x1b[1;34mMilestones Checklist:\x1b[0m`);
        for (const m of state.milestones) {
          const check = m.status === "completed" ? "\x1b[32m[✓]\x1b[0m" : "\x1b[90m[ ]\x1b[0m";
          out.push(`  ${check} \x1b[1m${m.title}\x1b[0m (${m.status})`);
        }
      }

      if (state.gates.length > 0) {
        out.push(``, `\x1b[1;34mQuality Gates:\x1b[0m`);
        for (const g of state.gates) {
          const pass = g.lastExitCode === 0 ? "\x1b[32m[PASS]\x1b[0m" : g.lastExitCode !== undefined ? "\x1b[31m[FAIL]\x1b[0m" : "\x1b[90m[UNRUN]\x1b[0m";
          out.push(`  ${pass} \x1b[1m$ ${g.command}\x1b[0m (${g.policy || "blocking"})`);
        }
      }

      out.push(``, `\x1b[90mCommands: /goal milestone add <title> | /goal gate add <cmd> | /goal pause | /goal retro\x1b[0m`);
      return { success: true, output: out.join("\n") };
    }

    // /goal set <text>
    if (subCmd === "set" || subCmd === "create") {
      const text = parts.slice(2).join(" ");
      if (!text) {
        return { success: false, output: "Usage: /goal set <goal objective and optional contracts>" };
      }
      const state = this.setGoal(sessionId, text);
      return {
        success: true,
        output: `\x1b[1;32m✓ Goal activated for session '${sessionId}':\x1b[0m "${state.goal}" (${state.maxTurns} turns budget)`,
      };
    }

    // /goal template <template_id> [outcome]
    if (subCmd === "template" || subCmd === "init") {
      const tmplId = parts[2]?.toLowerCase();
      const outcome = parts.slice(3).join(" ");
      if (!tmplId) {
        const tmpls = this.engine.listTemplates().map((t) => `${t.icon} ${t.id}`).join(", ");
        return { success: false, output: `Usage: /goal template <template_id> [outcome]\nAvailable: ${tmpls}` };
      }

      const state = this.instantiateTemplate(tmplId, sessionId, outcome || undefined);
      if (!state) {
        return { success: false, output: `\x1b[1;31mError:\x1b[0m Template '${tmplId}' not found.` };
      }

      return {
        success: true,
        output: `\x1b[1;32m✓ Instantiated goal from template '${tmplId}':\x1b[0m "${state.goal}" with ${state.milestones.length} milestones and ${state.gates.length} quality gates.`,
      };
    }

    // /goal milestone add|complete
    if (subCmd === "milestone" || subCmd === "ms") {
      const action = parts[2]?.toLowerCase();
      const titleOrId = parts.slice(3).join(" ");

      if (action === "add") {
        if (!titleOrId) return { success: false, output: "Usage: /goal milestone add <milestone_title>" };
        const ok = this.addMilestone(sessionId, titleOrId);
        return { success: ok, output: ok ? `\x1b[1;32m✓ Added milestone:\x1b[0m "${titleOrId}"` : "No active goal set." };
      }

      if (action === "complete" || action === "done") {
        if (!titleOrId) return { success: false, output: "Usage: /goal milestone complete <id_or_title>" };
        const ok = this.completeMilestone(sessionId, titleOrId);
        return { success: ok, output: ok ? `\x1b[1;32m✓ Completed milestone:\x1b[0m "${titleOrId}"` : "Milestone or goal not found." };
      }

      return { success: false, output: "Usage: /goal milestone add <title> | /goal milestone complete <id>" };
    }

    // /goal gate add <command>
    if (subCmd === "gate") {
      const action = parts[2]?.toLowerCase();
      if (action === "add") {
        const cmd = parts.slice(3).join(" ");
        if (!cmd) return { success: false, output: "Usage: /goal gate add <shell_command>" };
        const isAdvisory = cmd.includes("--advisory");
        const cleanCmd = cmd.replace("--advisory", "").trim();
        const ok = this.addGate(sessionId, cleanCmd, { policy: isAdvisory ? "advisory" : "blocking" });
        return { success: ok, output: ok ? `\x1b[1;32m✓ Added quality gate:\x1b[0m '$ ${cleanCmd}' (${isAdvisory ? "advisory" : "blocking"})` : "No active goal." };
      }
      return { success: false, output: "Usage: /goal gate add <command>" };
    }

    // /goal pause
    if (subCmd === "pause") {
      const reason = parts.slice(2).join(" ") || "Manually paused";
      const ok = this.pauseGoal(sessionId, reason);
      return { success: ok, output: ok ? `\x1b[1;33m⏸ Goal paused:\x1b[0m ${reason}` : "No active goal." };
    }

    // /goal resume
    if (subCmd === "resume") {
      const ok = this.resumeGoal(sessionId);
      return { success: ok, output: ok ? `\x1b[1;32m▶ Goal resumed.\x1b[0m` : "No goal found." };
    }

    // /goal clear
    if (subCmd === "clear" || subCmd === "delete") {
      const ok = this.clearGoal(sessionId);
      return { success: ok, output: ok ? `\x1b[1;32m✓ Goal cleared.\x1b[0m` : "No goal found." };
    }

    // /goal retro
    if (subCmd === "retro" || subCmd === "summary") {
      const retro = this.getRetrospective(sessionId);
      if (!retro) return { success: false, output: "No goal found to generate retrospective." };

      const out = [
        `\x1b[1;36m=== Goal Retrospective Summary ===\x1b[0m`,
        `Goal:                   "${retro.goal}"`,
        `Status:                 ${retro.status}`,
        `Duration:               ${(retro.durationMs / 1000).toFixed(2)}s`,
        `Turns Used:             ${retro.turnsUsed}/${retro.maxTurns}`,
        `Milestones Completed:   ${retro.completedMilestones}/${retro.totalMilestones}`,
        `Gates Passed:           ${retro.passedGates}/${retro.totalGates}`,
        `Adherence Score:        \x1b[1;32m${retro.contractAdherenceScore}/100\x1b[0m`,
      ];
      return { success: true, output: out.join("\n") };
    }

    // /goal templates
    if (subCmd === "templates") {
      const tmpls = this.engine.listTemplates();
      const out = [
        `\x1b[1;36m=== Available Goal Templates (${tmpls.length}) ===\x1b[0m`,
        ...tmpls.map((t) => `  ${t.icon} \x1b[1m${t.id.padEnd(10)}\x1b[0m - ${t.name}\n    \x1b[90m${t.description}\x1b[0m`),
      ];
      return { success: true, output: out.join("\n") };
    }

    // /goal list [dsl_query]
    if (subCmd === "list" || subCmd === "ls") {
      const q = parts.slice(2).join(" ");
      const goals = this.listGoals(q || undefined);
      const out = [
        `\x1b[1;36m=== Goals List (${goals.length}) ===\x1b[0m`,
        ...goals.map((g) => `  ${g.icon || "🎯"} \x1b[1m${g.sessionId.padEnd(14)}\x1b[0m [${g.status}] ${g.progressPercent}% - "${g.goal}"`),
      ];
      return { success: true, output: out.join("\n") };
    }

    // Help
    return {
      success: true,
      output: [
        `\x1b[1;36m=== /goal Command Navigation ===\x1b[0m`,
        `  /goal                        - Show active goal dashboard, progress & gates`,
        `  /goal set <text>             - Set active standing goal with contract`,
        `  /goal template <id> [outcome]- Instantiate goal from template`,
        `  /goal templates              - Browse built-in templates`,
        `  /goal milestone add <title>  - Add milestone criterion`,
        `  /goal milestone complete <id>- Complete milestone`,
        `  /goal gate add <cmd>         - Add automated quality gate`,
        `  /goal pause / resume / clear - Lifecycle control`,
        `  /goal retro                  - View retrospective audit summary`,
        `  /goal list [query]           - List goals across sessions`,
      ].join("\n"),
    };
  }
}
