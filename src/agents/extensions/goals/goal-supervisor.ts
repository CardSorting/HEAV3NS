/**
 * Goal Supervisor coordinating Goal Lifecycle, Quality Gates, Milestone DAGs, Diffing & Slash Command UX
 * Reference: hermes-agent-main/hermes_cli/goals.py, hermes_cli/loops.py
 * Subsystem: Target #74 / ADR-117
 */

import type {
  GoalArchiveResult,
  GoalBulkMutationResult,
  GoalCloneOptions,
  GoalContract,
  GoalDiffResult,
  GoalEvaluationResult,
  GoalGate,
  GoalGatePolicy,
  GoalGroupBy,
  GoalGroupedLane,
  GoalHealthAuditReport,
  GoalHealthStatus,
  GoalHierarchyReport,
  GoalMilestone,
  GoalQueryFilter,
  GoalRetroSummary,
  GoalRiskDiagnosis,
  GoalSortBy,
  GoalSortDirection,
  GoalState,
  GoalStepEvent,
  GoalSwarmBalanceResult,
  GoalTemplate,
  GoalVelocityMetrics,
} from "../../../core/contracts/goal.contracts.js";
import {
  DEFAULT_GATE_MAX_RETRIES,
  DEFAULT_GATE_TIMEOUT_SECONDS,
  DEFAULT_GOAL_MAX_TURNS,
} from "../../../core/contracts/goal.contracts.js";
import { BroccoliGoalSubstrate } from "../../../sessions/extensions/goals/broccoli-goal-substrate.js";
import { BroccoliViewRenderer } from "../../../sessions/extensions/substrate/broccolidb-view-renderer.js";
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
      milestones?: string[] | GoalMilestone[];
      category?: string;
      icon?: string;
      parentGoalSessionId?: string;
    } = {}
  ): GoalState {
    this.substrate.recordInvocation();
    const { headline, contract } = this.engine.parseContract(rawText);
    const effectiveGoal = headline || rawText;
    const mergedContract = { ...contract, ...(options.contract || {}) };

    let milestones: GoalMilestone[] = [];
    if (Array.isArray(options.milestones)) {
      if (options.milestones.length > 0 && typeof options.milestones[0] === "string") {
        milestones = (options.milestones as string[]).map((m, idx) => ({
          id: `m-${idx + 1}`,
          title: m,
          status: "pending",
          progressPercent: 0,
        }));
      } else {
        milestones = (options.milestones as GoalMilestone[]).map((m) => ({ ...m }));
      }
    }

    const state: GoalState = {
      sessionId,
      goal: effectiveGoal,
      parentGoalSessionId: options.parentGoalSessionId,
      category: (options.category as any) || "general",
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
      trajectory: [],
      contract: mergedContract,
      gates: options.gates ? options.gates.map((g) => ({ ...g })) : [],
    };

    this.substrate.setGoal(state);

    if (options.parentGoalSessionId) {
      this.substrate.linkChildGoal(options.parentGoalSessionId, sessionId);
    }

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

  diffGoals(sessionIdA: string, sessionIdB: string): GoalDiffResult | undefined {
    const goalA = this.substrate.getGoal(sessionIdA);
    const goalB = this.substrate.getGoal(sessionIdB);
    if (!goalA || !goalB) return undefined;
    return this.engine.diffGoals(goalA, goalB);
  }

  addMilestone(sessionId: string, title: string, dependsOn: string[] = []): boolean {
    const state = this.substrate.getGoal(sessionId);
    if (!state) return false;

    const newId = `m-${state.milestones.length + 1}`;
    state.milestones.push({
      id: newId,
      title: title.trim(),
      status: dependsOn.length > 0 ? "blocked" : "pending",
      progressPercent: 0,
      dependsOn: [...dependsOn],
      blockers: [...dependsOn],
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

  delegateSubGoal(
    parentSessionId: string,
    childSessionId: string,
    subGoalTitle: string,
    options: { maxTurns?: number; category?: string } = {}
  ): GoalState | undefined {
    const parent = this.substrate.getGoal(parentSessionId);
    if (!parent) return undefined;

    const child = this.setGoal(childSessionId, subGoalTitle, {
      maxTurns: options.maxTurns || 15,
      category: options.category || parent.category,
      parentGoalSessionId: parentSessionId,
      contract: {
        ...parent.contract,
        outcome: subGoalTitle,
      },
    });

    return child;
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
    commandOrGate: string | Partial<GoalGate>,
    options: {
      name?: string;
      policy?: GoalGatePolicy;
      timeoutSeconds?: number;
      maxRetries?: number;
      autoRemediateCommand?: string;
    } = {}
  ): boolean {
    const state = this.substrate.getGoal(sessionId);
    if (!state) return false;

    const command = typeof commandOrGate === "string" ? commandOrGate : commandOrGate.command || "";
    const name = typeof commandOrGate === "object" ? commandOrGate.name : options.name;
    const policy = typeof commandOrGate === "object" ? commandOrGate.policy : options.policy;
    const timeoutSeconds = typeof commandOrGate === "object" ? commandOrGate.timeoutSeconds : options.timeoutSeconds;
    const maxRetries = typeof commandOrGate === "object" ? commandOrGate.maxRetries : options.maxRetries;
    const autoRemediateCommand = typeof commandOrGate === "object" ? commandOrGate.autoRemediateCommand : options.autoRemediateCommand;

    const gate: GoalGate = {
      id: `gate-${state.gates.length + 1}`,
      name: name || command.trim().split(" ")[0],
      command: command.trim(),
      policy: policy || "blocking",
      timeoutSeconds: timeoutSeconds || DEFAULT_GATE_TIMEOUT_SECONDS,
      maxRetries: maxRetries || DEFAULT_GATE_MAX_RETRIES,
      attempts: 0,
      lastOutputTail: "",
      lastFailedFingerprint: "",
      autoRemediateCommand,
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

  updateGoal(sessionId: string, mutation: Partial<GoalState>): boolean {
    const state = this.substrate.getGoal(sessionId);
    if (!state) return false;

    if (mutation.status !== undefined) state.status = mutation.status;
    if (mutation.category !== undefined) state.category = mutation.category;
    if (mutation.maxTurns !== undefined) state.maxTurns = mutation.maxTurns;
    if (mutation.goal !== undefined) state.goal = mutation.goal;
    if (mutation.icon !== undefined) state.icon = mutation.icon;

    this.substrate.setGoal(state);
    return true;
  }

  updateMilestone(
    sessionId: string,
    milestoneId: string,
    mutation: Partial<GoalMilestone>
  ): boolean {
    const state = this.substrate.getGoal(sessionId);
    if (!state) return false;

    const ms = state.milestones.find((m) => m.id === milestoneId || m.title.toLowerCase() === milestoneId.toLowerCase());
    if (!ms) return false;

    if (mutation.status !== undefined) ms.status = mutation.status;
    if (mutation.progressPercent !== undefined) ms.progressPercent = mutation.progressPercent;
    if (mutation.title !== undefined) ms.title = mutation.title;
    if (mutation.dependsOn !== undefined) ms.dependsOn = [...mutation.dependsOn];
    if (mutation.description !== undefined) ms.description = mutation.description;
    if (ms.status === "completed" && !ms.completedAtMs) ms.completedAtMs = Date.now();

    this.substrate.setGoal(state);
    return true;
  }

  completeGoal(sessionId: string, reason?: string): boolean {
    const state = this.substrate.getGoal(sessionId);
    if (!state) return false;

    state.status = "done";
    state.progressPercent = 100;
    state.lastVerdict = "done";
    state.lastReason = reason || "Goal marked as completed.";
    for (const m of state.milestones) {
      m.status = "completed";
      m.progressPercent = 100;
      m.completedAtMs = Date.now();
    }

    this.substrate.setGoal(state);
    this.substrate.recordCompletion();

    const retro = this.engine.generateRetrospective(state);
    this.substrate.archiveGoal(retro);
    return true;
  }

  async evaluateGates(
    sessionId: string,
    cwd?: string
  ): Promise<{
    allPassed: boolean;
    passed: number;
    failed: number;
    totalEvaluated: number;
    remediationsAttempted: number;
    results: Array<{ name: string; command: string; exitCode: number; policy: string }>;
  }> {
    const state = this.substrate.getGoal(sessionId);
    if (!state || state.gates.length === 0) {
      return {
        allPassed: true,
        passed: 0,
        failed: 0,
        totalEvaluated: 0,
        remediationsAttempted: 0,
        results: [],
      };
    }

    const evalResult = await this.engine.evaluateAfterTurn({
      state,
      lastResponse: "",
      cwd,
    });

    const results = state.gates.map((g) => ({
      name: g.name || g.command,
      command: g.command,
      exitCode: g.lastExitCode ?? -1,
      policy: g.policy || "blocking",
    }));

    const passed = results.filter((r) => r.exitCode === 0).length;
    const failed = results.length - passed;

    return {
      allPassed: !evalResult.gateFailed && failed === 0,
      passed,
      failed,
      totalEvaluated: results.length,
      remediationsAttempted: evalResult.remediationAttempted ? 1 : 0,
      results,
    };
  }

  getTrajectory(sessionId: string): readonly GoalStepEvent[] {
    const state = this.substrate.getGoal(sessionId);
    return state?.trajectory ? [...state.trajectory] : [];
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
        out.push(``, `\x1b[1;34mMilestone DAG Progress:\x1b[0m`);
        for (const m of state.milestones) {
          let statusIcon = "\x1b[90m[ ]\x1b[0m";
          if (m.status === "completed") statusIcon = "\x1b[32m[✓]\x1b[0m";
          else if (m.status === "blocked") statusIcon = `\x1b[31m[🔒 Blocked by ${m.blockers?.join(",")}]\x1b[0m`;
          out.push(`  ${statusIcon} \x1b[1m${m.title}\x1b[0m (${m.status})`);
        }
      }

      if (state.gates.length > 0) {
        out.push(``, `\x1b[1;34mQuality Gates:\x1b[0m`);
        for (const g of state.gates) {
          const pass = g.lastExitCode === 0 ? "\x1b[32m[PASS]\x1b[0m" : g.lastExitCode !== undefined ? "\x1b[31m[FAIL]\x1b[0m" : "\x1b[90m[UNRUN]\x1b[0m";
          out.push(`  ${pass} \x1b[1m$ ${g.command}\x1b[0m (${g.policy || "blocking"})`);
        }
      }

      out.push(``, `\x1b[90mCommands: /goal tree | /goal diff <a b> | /goal milestone add <title> | /goal retro\x1b[0m`);
      return { success: true, output: out.join("\n") };
    }

    // /goal tree
    if (subCmd === "tree" || subCmd === "dag") {
      const state = this.substrate.getGoal(sessionId);
      if (!state) return { success: false, output: "No active goal set for this session." };

      const out = [
        `\x1b[1;36m=== Milestone Dependency DAG: ${state.goal} ===\x1b[0m`,
        ...state.milestones.map((m, idx) => {
          const prefix = idx === state.milestones.length - 1 ? "└── " : "├── ";
          const icon = m.status === "completed" ? "✓" : m.status === "blocked" ? "🔒" : "⏳";
          const depStr = m.dependsOn && m.dependsOn.length > 0 ? ` (depends on: ${m.dependsOn.join(", ")})` : "";
          return `${prefix}[${icon}] \x1b[1m${m.id}: ${m.title}\x1b[0m [${m.status}]${depStr}`;
        }),
      ];
      return { success: true, output: out.join("\n") };
    }

    // /goal diff <idA> <idB>
    if (subCmd === "diff" || subCmd === "compare") {
      const idA = parts[2];
      const idB = parts[3];
      if (!idA || !idB) return { success: false, output: "Usage: /goal diff <session_id_a> <session_id_b>" };

      const diff = this.diffGoals(idA, idB);
      if (!diff) return { success: false, output: `One or both session goals ('${idA}', '${idB}') not found.` };

      if (diff.identical) {
        return { success: true, output: `\x1b[1;32m✓ Goals in sessions '${idA}' and '${idB}' are structurally identical.\x1b[0m` };
      }

      const out = [
        `\x1b[1;36m=== Goal Structural Diff: ${idA} <-> ${idB} ===\x1b[0m`,
        ...diff.differences.map((d) => `  \x1b[1m${d.field.padEnd(16)}\x1b[0m: \x1b[31m${JSON.stringify(d.valueA)}\x1b[0m -> \x1b[32m${JSON.stringify(d.valueB)}\x1b[0m`),
      ];
      if (diff.milestoneDelta.onlyInA.length > 0) {
        out.push(`  Milestones only in ${idA}: \x1b[31m${diff.milestoneDelta.onlyInA.join(", ")}\x1b[0m`);
      }
      if (diff.milestoneDelta.onlyInB.length > 0) {
        out.push(`  Milestones only in ${idB}: \x1b[32m${diff.milestoneDelta.onlyInB.join(", ")}\x1b[0m`);
      }
      return { success: true, output: out.join("\n") };
    }

    // /goal trajectory
    if (subCmd === "trajectory" || subCmd === "timeline") {
      const targetSid = parts[2] || sessionId;
      const trajectory = this.getTrajectory(targetSid);
      if (!trajectory || trajectory.length === 0) {
        return { success: true, output: `No recorded trajectory events for session '${targetSid}'.` };
      }

      const out = [
        `\x1b[1;36m=== Goal Execution Trajectory (${trajectory.length} Events) ===\x1b[0m`,
        ...trajectory.map((e) => `  \x1b[33m[Turn ${e.turnIndex}]\x1b[0m \x1b[90m${new Date(e.timestampMs).toISOString().slice(11, 19)}\x1b[0m - ${e.actionSummary} (\x1b[32m${e.verdict}\x1b[0m)`),
      ];
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
        `  /goal tree                   - View ASCII milestone dependency DAG tree`,
        `  /goal diff <idA> <idB>       - Compare structural differences between goals`,
        `  /goal trajectory [id]        - Chronological timeline audit trail`,
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

  public getSubstrate(): BroccoliGoalSubstrate {
    return this.substrate;
  }

  public getEngine(): DeterministicGoalEngine {
    return this.engine;
  }

  public getGroupedGoals(
    groupBy: GoalGroupBy = "status",
    sortBy: GoalSortBy = "createdAt",
    sortDir: GoalSortDirection = "desc",
    filter: GoalQueryFilter = {}
  ): readonly GoalGroupedLane[] {
    return this.substrate.getGroupedGoals(groupBy, sortBy, sortDir, filter);
  }

  public getGoalWithHierarchy(sessionId: string): GoalHierarchyReport | null {
    return this.substrate.getGoalWithHierarchy(sessionId);
  }

  public getVelocityMetrics(): GoalVelocityMetrics {
    return this.substrate.getVelocityMetrics();
  }

  public bulkUpdateGoals(sessionIds: readonly string[], mutation: Partial<GoalState>): GoalBulkMutationResult {
    return this.substrate.bulkUpdateGoals(sessionIds, mutation);
  }

  public undo(sessionId: string): { success: boolean; restoredGoal?: GoalState; error?: string } {
    return this.substrate.undo(sessionId);
  }

  public redo(sessionId: string): { success: boolean; restoredGoal?: GoalState; error?: string } {
    return this.substrate.redo(sessionId);
  }

  public exportHtml(sessionId: string = "default"): string {
    return this.substrate.exportInteractiveHtmlView(sessionId);
  }

  public exportMarkdown(sessionId: string = "default"): string {
    return this.substrate.exportMarkdown(sessionId);
  }

  public exportCsv(): string {
    return this.substrate.exportCsv();
  }

  public exportJson(sessionId: string = "default"): string {
    return this.substrate.exportJson(sessionId);
  }

  public renderDagGraph(sessionId: string = "default"): string {
    const goal = this.getGoal(sessionId);
    if (!goal) return `Goal '${sessionId}' not found.`;
    return BroccoliViewRenderer.renderGoalMilestoneGraph(goal);
  }

  public renderDashboard(sessionId: string = "default"): string {
    const goal = this.getGoal(sessionId);
    if (!goal) return `Goal '${sessionId}' not found.`;
    return BroccoliViewRenderer.renderGoalDashboard(goal);
  }

  public toggleMilestoneChecklist(
    sessionId: string,
    milestoneId: string,
    checkId: string,
    done?: boolean
  ): boolean {
    return this.substrate.toggleMilestoneChecklist(sessionId, milestoneId, checkId, done);
  }

  public autoAssignSwarm(
    parentSessionId: string,
    workerSessionIds: readonly string[]
  ): GoalSwarmBalanceResult {
    return this.substrate.autoAssignSwarm(parentSessionId, workerSessionIds);
  }

  public archiveCompletedGoals(cutoffMs: number = 0): GoalArchiveResult {
    return this.substrate.archiveCompletedGoals(cutoffMs);
  }

  public cloneGoal(
    sourceSessionId: string,
    targetSessionId: string,
    options: GoalCloneOptions = {}
  ): GoalState | null {
    return this.substrate.cloneGoal(sourceSessionId, targetSessionId, options);
  }

  public adjustMilestoneProgress(
    sessionId: string,
    milestoneId: string,
    deltaPercent: number
  ): boolean {
    return this.substrate.adjustMilestoneProgress(sessionId, milestoneId, deltaPercent);
  }

  public setMilestoneBlocked(
    sessionId: string,
    milestoneId: string,
    blocked: boolean,
    reason?: string
  ): boolean {
    return this.substrate.setMilestoneBlocked(sessionId, milestoneId, blocked, reason);
  }

  public auditGoalHealth(sessionId: string): GoalHealthAuditReport | null {
    return this.substrate.auditGoalHealth(sessionId);
  }

  public diagnoseGoalRisks(sessionId: string): GoalRiskDiagnosis | null {
    return this.substrate.diagnoseGoalRisks(sessionId);
  }

  public tagGoalOrMilestone(sessionId: string, tags: string[], milestoneId?: string): boolean {
    return this.substrate.tagGoalOrMilestone(sessionId, tags, milestoneId);
  }

  public setGoalDeadline(sessionId: string, deadlineMs: number, milestoneId?: string): boolean {
    return this.substrate.setGoalDeadline(sessionId, deadlineMs, milestoneId);
  }
}
