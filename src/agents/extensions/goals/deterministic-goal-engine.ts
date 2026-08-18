/**
 * Deterministic Goal Engine, Contract Parser, Quality Gate Pipeline, Milestone DAG & Diffing Engine
 * Reference: hermes-agent-main/hermes_cli/goals.py, hermes_cli/loops.py
 * Subsystem: Target #74 / ADR-117
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import type {
  GoalCategory,
  GoalContract,
  GoalDiffResult,
  GoalEvaluationResult,
  GoalGate,
  GoalMilestone,
  GoalQueryFilter,
  GoalRetroSummary,
  GoalState,
  GoalStepEvent,
  GoalTemplate,
  GoalVerdict,
} from "../../../core/contracts/goal.contracts.js";
import {
  DEFAULT_GATE_MAX_RETRIES,
  DEFAULT_GATE_TIMEOUT_SECONDS,
  DEFAULT_GOAL_MAX_TURNS,
  GATE_OUTPUT_TAIL_CHARS,
} from "../../../core/contracts/goal.contracts.js";
import { BroccoliGoalSubstrate } from "../../../sessions/extensions/goals/broccoli-goal-substrate.js";

const execAsync = promisify(exec);

const CONTRACT_ALIASES: Record<string, keyof GoalContract> = {
  outcome: "outcome",
  goal: "outcome",
  done: "outcome",
  "done when": "outcome",
  verification: "verification",
  verify: "verification",
  "verified by": "verification",
  evidence: "verification",
  proof: "verification",
  constraints: "constraints",
  constraint: "constraints",
  preserve: "constraints",
  "must not": "constraints",
  "do not change": "constraints",
  boundaries: "boundaries",
  boundary: "boundaries",
  scope: "boundaries",
  allowed: "boundaries",
  files: "boundaries",
  "stop when": "stopWhen",
  stop_when: "stopWhen",
  blocked: "stopWhen",
  "stop if blocked": "stopWhen",
  "give up when": "stopWhen",
};

export class DeterministicGoalEngine {
  private readonly substrate: BroccoliGoalSubstrate;
  private readonly templates: Map<string, GoalTemplate> = new Map();

  constructor(substrate?: BroccoliGoalSubstrate) {
    this.substrate = substrate || new BroccoliGoalSubstrate();
    this.initTemplates();
  }

  private initTemplates(): void {
    const builtins: GoalTemplate[] = [
      {
        id: "bugfix",
        name: "Bug Diagnostic & Regression Fix",
        description: "Diagnose defect, construct reproduction test, apply minimal-footprint fix, and verify regression safety.",
        category: "bugfix",
        icon: "🐛",
        defaultContract: {
          outcome: "Defect is resolved and confirmed by a reproducible test case.",
          verification: "Reproduction test passes and entire repository test suite passes with zero regressions.",
          constraints: "Do not alter public API signatures; maintain backwards compatibility.",
          boundaries: "Only mutate files directly responsible for the bug.",
          stopWhen: "Root cause stems from external unresolvable dependency.",
        },
        recommendedGates: [
          { name: "Unit Test Suite", command: "npm test", policy: "blocking", timeoutSeconds: 300 },
        ],
        defaultMilestones: [
          { id: "m-1", title: "Reproduce bug with a deterministic test case", dependsOn: [] },
          { id: "m-2", title: "Identify root cause in source codebase", dependsOn: ["m-1"] },
          { id: "m-3", title: "Apply line-anchored bug fix", dependsOn: ["m-2"] },
          { id: "m-4", title: "Verify all tests pass cleanly", dependsOn: ["m-3"] },
        ],
        maxTurns: 20,
      },
      {
        id: "feature",
        name: "Feature Implementation & E2E Verification",
        description: "Implement new capability with modular contracts, unit tests, and documentation integration.",
        category: "feature",
        icon: "🚀",
        defaultContract: {
          outcome: "New feature capability is implemented, tested, and integrated.",
          verification: "Feature unit and integration tests pass cleanly; documentation updated.",
          constraints: "Zero circular imports, zero barrel files (ADR-012), strict TypeScript compliance.",
          boundaries: "Stay within designated subsystem folder boundaries.",
          stopWhen: "Blocked on missing architectural specification.",
        },
        recommendedGates: [
          { name: "TypeScript Check", command: "npm run check", policy: "blocking", timeoutSeconds: 60 },
          { name: "Regression Suite", command: "npm test", policy: "blocking", timeoutSeconds: 300 },
        ],
        defaultMilestones: [
          { id: "m-1", title: "Define data contracts and interfaces", dependsOn: [] },
          { id: "m-2", title: "Implement zero-GC substrate and engine logic", dependsOn: ["m-1"] },
          { id: "m-3", title: "Expose model tool suite and supervisor coordination", dependsOn: ["m-2"] },
          { id: "m-4", title: "Verify with end-to-end automated validation suite", dependsOn: ["m-3"] },
        ],
        maxTurns: 25,
      },
      {
        id: "refactor",
        name: "Modular Decomposition & Architectural Refactor",
        description: "Extract monolithic modules into clean, focused classes with identical behavior contracts.",
        category: "refactor",
        icon: "♻️",
        defaultContract: {
          outcome: "Code is modularized and decoupled with zero behavioral change.",
          verification: "All unit tests pass before and after refactoring without modifications to test assertions.",
          constraints: "Preserve all external API contracts and performance SLAs.",
          boundaries: "Target only designated refactoring scope.",
          stopWhen: "Refactoring introduces cascading breaking changes.",
        },
        recommendedGates: [
          { name: "Type Safety Check", command: "npm run check", policy: "blocking", timeoutSeconds: 60 },
          { name: "Test Suite", command: "npm test", policy: "blocking", timeoutSeconds: 300 },
        ],
        defaultMilestones: [
          { id: "m-1", title: "Establish baseline passing test suite", dependsOn: [] },
          { id: "m-2", title: "Extract focused classes and decouple dependencies", dependsOn: ["m-1"] },
          { id: "m-3", title: "Wire into factory composition roots", dependsOn: ["m-2"] },
          { id: "m-4", title: "Verify identical behavior and microsecond SLAs", dependsOn: ["m-3"] },
        ],
        maxTurns: 20,
      },
      {
        id: "audit",
        name: "Forensic Integrity & Security Audit",
        description: "Comprehensive review of code invariants, security boundaries, and architectural guidelines.",
        category: "audit",
        icon: "🛡️",
        defaultContract: {
          outcome: "Forensic audit complete with zero security or invariant violations.",
          verification: "Forensic audit script passes 100% checks.",
          constraints: "Read-only inspection; do not perform mutating actions during audit.",
          boundaries: "Entire repository scope.",
          stopWhen: "Audit uncovers critical blocking vulnerability requiring architectural redesign.",
        },
        recommendedGates: [
          { name: "Forensic Integrity", command: "node --import tsx scripts/validate-forensic-integrity.ts", policy: "blocking", timeoutSeconds: 60 },
        ],
        defaultMilestones: [
          { id: "m-1", title: "Audit component manifest and ordering", dependsOn: [] },
          { id: "m-2", title: "Audit zero barrel file and base class immutability invariants", dependsOn: ["m-1"] },
          { id: "m-3", title: "Verify frame tick determinism and microsecond rewind SLAs", dependsOn: ["m-2"] },
        ],
        maxTurns: 15,
      },
      {
        id: "release",
        name: "Production Release & Build Packaging",
        description: "Verify production bundle, changelog provenance, and semver tag readiness.",
        category: "release",
        icon: "📦",
        defaultContract: {
          outcome: "Production bundle builds cleanly with zero errors.",
          verification: "npm run build produces valid dist bundle.",
          constraints: "Git working tree must be clean before packaging.",
          boundaries: "Release distribution pipeline.",
          stopWhen: "Build fails or missing dependencies detected.",
        },
        recommendedGates: [
          { name: "Production Build", command: "npm run build", policy: "blocking", timeoutSeconds: 120 },
        ],
        defaultMilestones: [
          { id: "m-1", title: "Run full verification test suite", dependsOn: [] },
          { id: "m-2", title: "Compile production distribution bundle", dependsOn: ["m-1"] },
          { id: "m-3", title: "Verify documentation and live baseline sync", dependsOn: ["m-2"] },
        ],
        maxTurns: 15,
      },
      {
        id: "learning",
        name: "Codebase Exploration & Concept Mastery",
        description: "Investigate unfamiliar modules, diagram architectural flows, and synthesize mental models.",
        category: "learning",
        icon: "📚",
        defaultContract: {
          outcome: "Clear understanding and documentation of the target subsystem.",
          verification: "Synthesis document generated with architectural diagrams.",
          constraints: "Do not modify existing working code without explicit instruction.",
          boundaries: "Designated exploration subsystem.",
          stopWhen: "Sufficient conceptual clarity is achieved.",
        },
        recommendedGates: [],
        defaultMilestones: [
          { id: "m-1", title: "Map core data contracts and entry points", dependsOn: [] },
          { id: "m-2", title: "Trace execution flow and state transitions", dependsOn: ["m-1"] },
          { id: "m-3", title: "Document findings and architectural takeaways", dependsOn: ["m-2"] },
        ],
        maxTurns: 15,
      },
      {
        id: "security_fix",
        name: "Security Vulnerability & CVE Remediation",
        description: "Assess blast radius, patch vulnerability, and verify zero regressions with automated audit gates.",
        category: "bugfix",
        icon: "🔒",
        defaultContract: {
          outcome: "Security vulnerability remediated and confirmed via deterministic penetration/regression test.",
          verification: "Security test suite passes and npm audit reports zero high/critical vulnerabilities.",
          constraints: "Zero breaking changes to authenticated user flows.",
          boundaries: "Security and authentication layers.",
          stopWhen: "Remediation requires breaking cryptographic protocol changes.",
        },
        recommendedGates: [
          { name: "Type Check", command: "npm run check", policy: "blocking", timeoutSeconds: 60 },
          { name: "Security Audit", command: "npm test", policy: "blocking", timeoutSeconds: 120 },
        ],
        defaultMilestones: [
          { id: "m-1", title: "Analyze vulnerability CVE and assess blast radius", dependsOn: [] },
          { id: "m-2", title: "Construct regression test asserting the vulnerability", dependsOn: ["m-1"] },
          { id: "m-3", title: "Apply minimal surgical security fix", dependsOn: ["m-2"] },
          { id: "m-4", title: "Verify security audit and regression test pass", dependsOn: ["m-3"] },
        ],
        maxTurns: 20,
      },
      {
        id: "performance_optimization",
        name: "Sub-Millisecond Latency & Throughput Optimization",
        description: "Profile hot paths, eliminate allocations/garbage collection, and verify microsecond SLAs.",
        category: "refactor",
        icon: "⚡",
        defaultContract: {
          outcome: "Hot path latency reduced with sub-millisecond execution SLAs maintained.",
          verification: "Micro-benchmarks demonstrate >= 2x throughput with zero SLA violations.",
          constraints: "Preserve 100% functional correctness and base class immutability.",
          boundaries: "Targeted hot paths and memory slabs.",
          stopWhen: "Further micro-optimizations degrade code readability without measurable gain.",
        },
        recommendedGates: [
          { name: "Type Check", command: "npm run check", policy: "blocking", timeoutSeconds: 60 },
          { name: "Repo Guardrails", command: "node --import tsx scripts/validate-repo.ts", policy: "blocking", timeoutSeconds: 60 },
        ],
        defaultMilestones: [
          { id: "m-1", title: "Profile CPU/memory allocations and establish baseline SLA", dependsOn: [] },
          { id: "m-2", title: "Refactor hot paths to contiguous buffers and zero-GC", dependsOn: ["m-1"] },
          { id: "m-3", title: "Run 20,000-op micro-benchmark and verify SLAs", dependsOn: ["m-2"] },
        ],
        maxTurns: 20,
      },
    ];

    for (const t of builtins) {
      this.templates.set(t.id, t);
    }
  }

  /**
   * Lists all available goal templates.
   */
  public listTemplates(): readonly GoalTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Retrieves a template by ID.
   */
  public getTemplate(id: string): GoalTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Instantiates a new goal state from a template with topological milestone DAG.
   */
  public instantiateTemplate(
    templateId: string,
    sessionId: string,
    targetOutcome?: string
  ): GoalState | undefined {
    const tmpl = this.templates.get(templateId);
    if (!tmpl) return undefined;

    const contract: GoalContract = {
      ...tmpl.defaultContract,
      outcome: targetOutcome || tmpl.defaultContract.outcome,
    };

    const milestones: GoalMilestone[] = tmpl.defaultMilestones.map((m) => ({
      id: m.id,
      title: m.title,
      status: (m.dependsOn && m.dependsOn.length > 0) ? "blocked" : "pending",
      progressPercent: 0,
      dependsOn: m.dependsOn ? [...m.dependsOn] : [],
      blockers: m.dependsOn ? [...m.dependsOn] : [],
    }));

    const gates: GoalGate[] = tmpl.recommendedGates.map((g, idx) => ({
      id: `gate-${idx + 1}`,
      name: g.name,
      command: g.command,
      policy: g.policy,
      timeoutSeconds: g.timeoutSeconds || DEFAULT_GATE_TIMEOUT_SECONDS,
      maxRetries: DEFAULT_GATE_MAX_RETRIES,
      attempts: 0,
      lastOutputTail: "",
      lastFailedFingerprint: "",
      autoRemediateCommand: g.autoRemediateCommand,
    }));

    const now = Date.now();
    return {
      sessionId,
      goal: targetOutcome || tmpl.name,
      templateId: tmpl.id,
      category: tmpl.category,
      icon: tmpl.icon,
      status: "active",
      turnsUsed: 0,
      maxTurns: tmpl.maxTurns || DEFAULT_GOAL_MAX_TURNS,
      progressPercent: 0,
      createdAtMs: now,
      lastTurnAtMs: now,
      consecutiveParseFailures: 0,
      consecutiveTransportFailures: 0,
      subgoals: [],
      milestones,
      trajectory: [],
      contract,
      gates,
    };
  }

  /**
   * Splits user-typed goal text into a headline + structured 5-field completion contract.
   */
  public parseContract(text: string): { headline: string; contract: GoalContract } {
    if (!text || text.trim().length === 0) {
      return { headline: "", contract: {} };
    }

    const headlineParts: string[] = [];
    const fields: Record<keyof GoalContract, string[]> = {
      outcome: [],
      verification: [],
      constraints: [],
      boundaries: [],
      stopWhen: [],
    };

    // Normalize inline aliases like ' verify:' or ' constraints:' to newlines
    let normalized = text;
    for (const alias of Object.keys(CONTRACT_ALIASES)) {
      const regex = new RegExp(`\\s+(${alias}:)`, "gi");
      normalized = normalized.replace(regex, "\n$1");
    }

    for (const rawLine of normalized.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;

      let matched = false;
      if (line.includes(":")) {
        const colonIdx = line.indexOf(":");
        const prefix = line.slice(0, colonIdx).trim().toLowerCase();
        const value = line.slice(colonIdx + 1).trim();
        const canonicalKey = CONTRACT_ALIASES[prefix];

        if (canonicalKey && value.length > 0) {
          fields[canonicalKey].push(value);
          matched = true;
        }
      }

      if (!matched) {
        headlineParts.push(line);
      }
    }

    const headline = headlineParts.join(" ").trim();
    const contract: GoalContract = {};

    if (fields.outcome.length > 0) contract.outcome = fields.outcome.join(" ").trim();
    if (fields.verification.length > 0) contract.verification = fields.verification.join(" ").trim();
    if (fields.constraints.length > 0) contract.constraints = fields.constraints.join(" ").trim();
    if (fields.boundaries.length > 0) contract.boundaries = fields.boundaries.join(" ").trim();
    if (fields.stopWhen.length > 0) contract.stopWhen = fields.stopWhen.join(" ").trim();

    return { headline, contract };
  }

  /**
   * Performs structural diff comparison between two session goal states.
   */
  public diffGoals(goalA: GoalState, goalB: GoalState): GoalDiffResult {
    const differences: { field: string; valueA: unknown; valueB: unknown }[] = [];

    const scalarFields: (keyof GoalState)[] = [
      "goal",
      "status",
      "category",
      "templateId",
      "maxTurns",
      "progressPercent",
    ];

    for (const field of scalarFields) {
      if (goalA[field] !== goalB[field]) {
        differences.push({
          field,
          valueA: goalA[field] ?? null,
          valueB: goalB[field] ?? null,
        });
      }
    }

    // Milestones delta
    const msA = new Set(goalA.milestones.map((m) => m.title));
    const msB = new Set(goalB.milestones.map((m) => m.title));
    const onlyMsA = Array.from(msA).filter((t) => !msB.has(t));
    const onlyMsB = Array.from(msB).filter((t) => !msA.has(t));
    const sharedMs = Array.from(msA).filter((t) => msB.has(t));

    if (onlyMsA.length > 0 || onlyMsB.length > 0) {
      differences.push({
        field: "milestones",
        valueA: Array.from(msA),
        valueB: Array.from(msB),
      });
    }

    // Gates delta
    const gatesA = new Set(goalA.gates.map((g) => g.command));
    const gatesB = new Set(goalB.gates.map((g) => g.command));
    const onlyGatesA = Array.from(gatesA).filter((c) => !gatesB.has(c));
    const onlyGatesB = Array.from(gatesB).filter((c) => !gatesA.has(c));
    const sharedGates = Array.from(gatesA).filter((c) => gatesB.has(c));

    if (onlyGatesA.length > 0 || onlyGatesB.length > 0) {
      differences.push({
        field: "gates",
        valueA: Array.from(gatesA),
        valueB: Array.from(gatesB),
      });
    }

    return {
      sessionIdA: goalA.sessionId,
      sessionIdB: goalB.sessionId,
      identical: differences.length === 0,
      differences,
      milestoneDelta: {
        onlyInA: onlyMsA,
        onlyInB: onlyMsB,
        shared: sharedMs,
      },
      gateDelta: {
        onlyInA: onlyGatesA,
        onlyInB: onlyGatesB,
        shared: sharedGates,
      },
    };
  }

  /**
   * Parses Natural Query DSL expressions like 'is:active category:bugfix sort:progress'
   */
  public parseQueryDSL(query: string): GoalQueryFilter {
    if (!query || !query.trim()) return {};

    const tokens = query.trim().split(/\s+/);
    const filter: GoalQueryFilter = {};
    const textParts: string[] = [];

    for (const token of tokens) {
      const lower = token.toLowerCase();
      if (lower === "is:active") {
        filter.status = "active";
      } else if (lower === "is:paused") {
        filter.status = "paused";
      } else if (lower === "is:done" || lower === "is:completed") {
        filter.status = "done";
      } else if (lower.startsWith("category:") || lower.startsWith("cat:")) {
        filter.category = token.split(":")[1] as GoalCategory;
      } else if (lower.startsWith("template:") || lower.startsWith("tmpl:")) {
        filter.templateId = token.split(":")[1];
      } else if (lower.startsWith("parent:")) {
        filter.parentSessionId = token.split(":")[1];
      } else if (lower.startsWith("sort:")) {
        const sortVal = token.split(":")[1].toLowerCase();
        if (sortVal === "recent" || sortVal === "progress" || sortVal === "turns") {
          filter.sortBy = sortVal;
        }
      } else if (lower.startsWith("limit:")) {
        const l = parseInt(token.split(":")[1], 10);
        if (!isNaN(l) && l > 0) filter.limit = l;
      } else {
        textParts.push(token);
      }
    }

    if (textParts.length > 0) {
      filter.text = textParts.join(" ");
    }

    return filter;
  }

  /**
   * Updates milestone states based on text mentions or explicit status toggles.
   */
  public updateMilestonesFromText(milestones: GoalMilestone[], responseText: string): boolean {
    if (!milestones || milestones.length === 0 || !responseText) return false;
    let modified = false;

    for (const m of milestones) {
      if (m.status === "completed") continue;

      const lowerResp = responseText.toLowerCase();
      const lowerTitle = m.title.toLowerCase();

      const isMentionedDone =
        (lowerResp.includes(`[x] ${lowerTitle}`) ||
          lowerResp.includes(`✓ ${lowerTitle}`) ||
          lowerResp.includes(`completed: ${lowerTitle}`) ||
          lowerResp.includes(`finished ${lowerTitle}`)) &&
        !lowerResp.includes(`[ ] ${lowerTitle}`);

      if (isMentionedDone) {
        m.status = "completed";
        m.progressPercent = 100;
        m.completedAtMs = Date.now();
        modified = true;
      }
    }

    if (modified) {
      this.substrate.resolveMilestoneDAG(milestones);
    }

    return modified;
  }

  /**
   * Renders the byte-stable continuation prompt for the active goal.
   */
  public renderContinuationPrompt(
    goal: string,
    contract?: GoalContract,
    subgoals?: string[],
    milestones?: GoalMilestone[]
  ): string {
    const hasContract =
      contract &&
      (contract.outcome ||
        contract.verification ||
        contract.constraints ||
        contract.boundaries ||
        contract.stopWhen);

    let prompt = `[Continuing toward your standing goal]\nGoal: ${goal}\n\n`;

    if (hasContract) {
      const contractLines: string[] = [];
      if (contract.outcome) contractLines.push(`- Outcome: ${contract.outcome}`);
      if (contract.verification) contractLines.push(`- Verification: ${contract.verification}`);
      if (contract.constraints) contractLines.push(`- Constraints: ${contract.constraints}`);
      if (contract.boundaries) contractLines.push(`- Boundaries: ${contract.boundaries}`);
      if (contract.stopWhen) contractLines.push(`- Stop when blocked: ${contract.stopWhen}`);

      prompt += `Completion contract:\n${contractLines.join("\n")}\n\n`;
    }

    if (milestones && milestones.length > 0) {
      const msLines = milestones.map((m) => {
        let tag = "[ ]";
        if (m.status === "completed") tag = "[x]";
        else if (m.status === "blocked") tag = `[BLOCKED by ${m.blockers?.join(", ")}]`;
        return `${tag} ${m.title} (${m.status})`;
      });
      prompt += `Milestone DAG Progress:\n${msLines.join("\n")}\n\n`;
    } else if (subgoals && subgoals.length > 0) {
      const subgoalsBlock = subgoals.map((s, i) => `${i + 1}. ${s}`).join("\n");
      prompt += `Additional criteria added mid-loop:\n${subgoalsBlock}\n\n`;
    }

    prompt +=
      `Continue working toward the goal. Take the next concrete step. ` +
      `Stay within the stated boundaries and do not violate the constraints. ` +
      `Before claiming the goal is done, satisfy the Verification criterion and show concrete evidence. ` +
      `If you hit the stated stop condition or are otherwise blocked, say so clearly and stop.`;

    return prompt;
  }

  /**
   * Generates a post-goal retrospective summary.
   */
  public generateRetrospective(state: GoalState): GoalRetroSummary {
    const completedMs = state.milestones.filter((m) => m.status === "completed").length;
    const passedGates = state.gates.filter((g) => g.lastExitCode === 0).length;
    const durationMs = Math.max(0, state.lastTurnAtMs - state.createdAtMs);

    let adherenceScore = 100;
    if (state.turnsUsed > state.maxTurns) adherenceScore -= 20;
    if (state.gates.some((g) => g.policy === "blocking" && g.lastExitCode !== 0)) adherenceScore -= 40;

    return {
      sessionId: state.sessionId,
      goal: state.goal,
      category: state.category || "general",
      status: state.status,
      turnsUsed: state.turnsUsed,
      maxTurns: state.maxTurns,
      totalMilestones: state.milestones.length,
      completedMilestones: completedMs,
      totalGates: state.gates.length,
      passedGates,
      durationMs,
      finalVerdict: state.lastVerdict,
      finalReason: state.lastReason,
      contractAdherenceScore: Math.max(0, adherenceScore),
      trajectoryEventsCount: state.trajectory ? state.trajectory.length : 0,
    };
  }

  /**
   * Evaluates quality gates, performs auto-remediation if configured, and evaluates turn progression.
   */
  public async evaluateGoalTurn(state: GoalState, lastResponse: string, cwd?: string): Promise<GoalEvaluationResult> {
    return this.evaluateAfterTurn({ state, lastResponse, cwd });
  }

  /**
   * Evaluates quality gates, performs auto-remediation if configured, and evaluates turn progression.
   */
  public async evaluateAfterTurn(options: {
    state: GoalState;
    lastResponse: string;
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
  }): Promise<GoalEvaluationResult> {
    const { state, lastResponse, cwd } = options;

    state.turnsUsed += 1;
    state.lastTurnAtMs = Date.now();

    // Check milestone mentions in response
    const milestonesUpdated = this.updateMilestonesFromText(state.milestones, lastResponse);

    // Recalculate progress percentage
    if (state.milestones && state.milestones.length > 0) {
      const completed = state.milestones.filter((m) => m.status === "completed").length;
      state.progressPercent = Math.round((completed / state.milestones.length) * 100);
    }

    // 1. Check turns budget
    if (state.turnsUsed >= state.maxTurns) {
      state.status = "paused";
      state.pausedReason = `Maximum turn budget (${state.maxTurns}) reached.`;
      state.lastVerdict = "continue";
      state.lastReason = state.pausedReason;
      this.substrate.setGoal(state);

      this.recordStep(state, "Max turn budget reached", 0, 0, "continue");

      return {
        shouldContinue: false,
        verdict: "continue",
        reason: state.pausedReason,
        pausedReason: state.pausedReason,
        milestonesUpdated,
      };
    }

    // 2. Evaluate quality gates with auto-remediation
    let blockingGateFailed = false;
    let remediationAttempted = false;
    let gatesEvaluated = 0;
    let gatesPassed = 0;

    for (const gate of state.gates) {
      this.substrate.recordGateEvaluation();
      gate.attempts += 1;
      gatesEvaluated += 1;
      const timeoutMs = (gate.timeoutSeconds || DEFAULT_GATE_TIMEOUT_SECONDS) * 1000;

      try {
        const { stdout, stderr } = await execAsync(gate.command, {
          cwd: cwd || process.cwd(),
          timeout: timeoutMs,
        });

        gate.lastExitCode = 0;
        const combined = (stdout || "") + (stderr || "");
        gate.lastOutputTail = combined.slice(-GATE_OUTPUT_TAIL_CHARS);
        gatesPassed += 1;
      } catch (err: any) {
        gate.lastExitCode = typeof err.code === "number" ? err.code : 1;
        const combined = (err.stdout || "") + (err.stderr || "") + (err.message || "");
        gate.lastOutputTail = combined.slice(-GATE_OUTPUT_TAIL_CHARS);

        // Attempt auto-remediation if available
        if (gate.autoRemediateCommand && (gate.remediatedCount || 0) < 2) {
          try {
            remediationAttempted = true;
            this.substrate.recordRemediation();
            gate.remediatedCount = (gate.remediatedCount || 0) + 1;
            await execAsync(gate.autoRemediateCommand, {
              cwd: cwd || process.cwd(),
              timeout: 60000,
            });

            // Re-run gate command after remediation
            const retryRes = await execAsync(gate.command, {
              cwd: cwd || process.cwd(),
              timeout: timeoutMs,
            });
            gate.lastExitCode = 0;
            gate.lastOutputTail = ((retryRes.stdout || "") + (retryRes.stderr || "")).slice(-GATE_OUTPUT_TAIL_CHARS);
            gatesPassed += 1;
            continue;
          } catch {
            // Remediation didn't clear the issue; continue to fail gate
          }
        }

        if (gate.policy === "blocking" || gate.policy === undefined) {
          blockingGateFailed = true;
        }
      }
    }

    if (blockingGateFailed) {
      const failedGate = state.gates.find((g) => g.lastExitCode !== 0 && (g.policy === "blocking" || g.policy === undefined));
      const reason = `Blocking quality gate '${failedGate?.command}' failed with exit code ${failedGate?.lastExitCode}`;
      state.lastVerdict = "continue";
      state.lastReason = reason;
      this.substrate.setGoal(state);

      this.recordStep(state, `Blocking gate '${failedGate?.command}' failed`, gatesEvaluated, gatesPassed, "continue");

      return {
        shouldContinue: true,
        verdict: "continue",
        reason,
        continuationPrompt: this.renderContinuationPrompt(state.goal, state.contract, state.subgoals, state.milestones),
        gateFailed: true,
        milestonesUpdated,
        remediationAttempted,
      };
    }

    // 3. Evaluate completion from response text
    const lowerResp = lastResponse.toLowerCase();
    const isExplicitlyDone =
      lowerResp.includes("[goal:done]") ||
      lowerResp.includes("goal completed successfully") ||
      (state.milestones.length > 0 && state.milestones.every((m) => m.status === "completed"));

    if (isExplicitlyDone) {
      state.status = "done";
      state.lastVerdict = "done";
      state.lastReason = "Goal and all verification criteria completed.";
      state.progressPercent = 100;
      this.substrate.setGoal(state);
      this.substrate.recordCompletion();

      this.recordStep(state, "Goal completed successfully", gatesEvaluated, gatesPassed, "done");

      const retro = this.generateRetrospective(state);
      this.substrate.archiveGoal(retro);

      return {
        shouldContinue: false,
        verdict: "done",
        reason: state.lastReason,
        milestonesUpdated,
        remediationAttempted,
      };
    }

    // 4. Default: continue toward goal
    state.lastVerdict = "continue";
    state.lastReason = "Continuing toward goal outcome.";
    this.substrate.setGoal(state);

    this.recordStep(state, "Continuing toward goal", gatesEvaluated, gatesPassed, "continue");

    return {
      shouldContinue: true,
      verdict: "continue",
      reason: state.lastReason,
      continuationPrompt: this.renderContinuationPrompt(state.goal, state.contract, state.subgoals, state.milestones),
      milestonesUpdated,
      remediationAttempted,
    };
  }

  private recordStep(
    state: GoalState,
    summary: string,
    gatesEvaluated: number,
    gatesPassed: number,
    verdict: GoalVerdict
  ): void {
    const completedMs = state.milestones.filter((m) => m.status === "completed").map((m) => m.id);
    const event: GoalStepEvent = {
      turnIndex: state.turnsUsed,
      timestampMs: Date.now(),
      actionSummary: summary,
      gatesEvaluated,
      gatesPassed,
      milestonesCompleted: completedMs,
      verdict,
    };
    this.substrate.recordStepEvent(state.sessionId, event);
  }
}
