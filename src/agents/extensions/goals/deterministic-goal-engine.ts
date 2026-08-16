/**
 * Deterministic Goal Engine, Contract Parser & Quality Gate Pipeline
 * Reference: hermes-agent-main/hermes_cli/goals.py
 * Subsystem: Target #74 / ADR-117
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import type {
  GoalContract,
  GoalEvaluationResult,
  GoalGate,
  GoalState,
  GoalVerdict,
} from "../../../core/contracts/goal.contracts.js";
import {
  DEFAULT_GATE_MAX_RETRIES,
  DEFAULT_GATE_TIMEOUT_SECONDS,
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

  constructor(substrate: BroccoliGoalSubstrate) {
    this.substrate = substrate;
  }

  /**
   * Splits user-typed goal text into a headline + structured 5-field completion contract.
   */
  parseContract(text: string): { headline: string; contract: GoalContract } {
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

    for (const rawLine of text.split("\n")) {
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
   * Renders the byte-stable continuation prompt for the active goal.
   */
  renderContinuationPrompt(
    goal: string,
    contract?: GoalContract,
    subgoals?: string[]
  ): string {
    const hasContract =
      contract &&
      (contract.outcome ||
        contract.verification ||
        contract.constraints ||
        contract.boundaries ||
        contract.stopWhen);

    if (hasContract) {
      const contractLines: string[] = [];
      if (contract.outcome) contractLines.push(`- Outcome: ${contract.outcome}`);
      if (contract.verification) contractLines.push(`- Verification: ${contract.verification}`);
      if (contract.constraints) contractLines.push(`- Constraints: ${contract.constraints}`);
      if (contract.boundaries) contractLines.push(`- Boundaries: ${contract.boundaries}`);
      if (contract.stopWhen) contractLines.push(`- Stop when blocked: ${contract.stopWhen}`);

      return (
        `[Continuing toward your standing goal]\n` +
        `Goal: ${goal}\n\n` +
        `Completion contract:\n${contractLines.join("\n")}\n\n` +
        `Continue working toward the outcome above. Take the next concrete step. ` +
        `Stay within the stated boundaries and do not violate the constraints. ` +
        `Before claiming the goal is done, satisfy the Verification criterion and show concrete evidence. ` +
        `If you hit the stated stop condition or are otherwise blocked, say so clearly and stop.`
      );
    }

    if (subgoals && subgoals.length > 0) {
      const subgoalsBlock = subgoals.map((s, i) => `${i + 1}. ${s}`).join("\n");
      return (
        `[Continuing toward your standing goal]\n` +
        `Goal: ${goal}\n\n` +
        `Additional criteria added mid-loop:\n${subgoalsBlock}\n\n` +
        `Continue working toward the goal AND all additional criteria. Take the next concrete step. ` +
        `If you believe the goal and all additional criteria are complete, state so explicitly and stop. ` +
        `If you are blocked and need input from the user, say so clearly and stop.`
      );
    }

    return (
      `[Continuing toward your standing goal]\n` +
      `Goal: ${goal}\n\n` +
      `Continue working toward this goal. Take the next concrete step. ` +
      `If you believe the goal is complete, state so explicitly and stop. ` +
      `If you are blocked and need input from the user, say so clearly and stop.`
    );
  }

  /**
   * Renders the gate failure prompt containing actionable output tail.
   */
  renderGateFailedPrompt(goal: string, gate: GoalGate): string {
    return (
      `[Continuing toward your standing goal — a quality gate failed]\n` +
      `Goal: ${goal}\n\n` +
      `The quality gate command below must pass before this goal can be declared done, ` +
      `and it just failed (attempt ${gate.attempts}/${gate.maxRetries}):\n` +
      `  $ ${gate.command}\n` +
      `Exit code: ${gate.lastExitCode ?? -1}\n` +
      `Output (tail):\n` +
      `\`\`\`\n` +
      `${gate.lastOutputTail}\n` +
      `\`\`\`\n\n` +
      `Fix the underlying problem so this gate passes, then re-run it to confirm. ` +
      `Do not declare the goal complete while any gate fails. If the gate itself cannot pass, say so clearly and stop.`
    );
  }

  /**
   * Executes a single quality gate command with timeout and output bounding.
   */
  async runGate(
    gate: GoalGate,
    cwd?: string,
    currentFingerprint: string = ""
  ): Promise<{ passed: boolean; exitCode: number; outputTail: string }> {
    this.substrate.recordGateEvaluation();

    // Fast-path: Unchanged workspace skip
    if (
      currentFingerprint &&
      gate.lastFailedFingerprint === currentFingerprint &&
      gate.attempts > 0
    ) {
      gate.attempts += 1;
      return {
        passed: false,
        exitCode: gate.lastExitCode ?? 1,
        outputTail: gate.lastOutputTail,
      };
    }

    const timeoutMs = (gate.timeoutSeconds || DEFAULT_GATE_TIMEOUT_SECONDS) * 1000;

    try {
      const { stdout, stderr } = await execAsync(gate.command, {
        cwd: cwd || process.cwd(),
        timeout: timeoutMs,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024,
      });

      const combined = `${stdout || ""}\n${stderr || ""}`.trim();
      const tail = combined.slice(-GATE_OUTPUT_TAIL_CHARS);

      gate.lastExitCode = 0;
      gate.lastOutputTail = tail;
      gate.lastFailedFingerprint = "";

      return { passed: true, exitCode: 0, outputTail: tail };
    } catch (err: any) {
      const exitCode = typeof err.code === "number" ? err.code : 1;
      const combined = `${err.stdout || ""}\n${err.stderr || ""}\n${err.message || ""}`.trim();
      const tail = combined.slice(-GATE_OUTPUT_TAIL_CHARS);

      gate.attempts += 1;
      gate.lastExitCode = exitCode;
      gate.lastOutputTail = tail;
      gate.lastFailedFingerprint = currentFingerprint;

      return { passed: false, exitCode, outputTail: tail };
    }
  }

  /**
   * Deterministic 3-state Epistemic Judge (DONE | WAIT | CONTINUE).
   */
  async judgeGoal(options: {
    goal: string;
    contract?: GoalContract;
    subgoals?: string[];
    lastResponse: string;
    backgroundProcesses?: Array<{ pid: number; session?: string; command?: string }>;
    judgeFn?: (prompt: string) => Promise<{
      verdict: string;
      reason: string;
      wait_on_session?: string;
      wait_on_pid?: number;
      wait_for_seconds?: number;
    }>;
  }): Promise<GoalEvaluationResult> {
    const { goal, contract, subgoals, lastResponse, backgroundProcesses, judgeFn } = options;
    const lowerRes = lastResponse.toLowerCase();

    // 1. Check if custom judge function provided
    if (judgeFn) {
      try {
        const prompt = `${goal}\n\nResponse:\n${lastResponse}`;
        const res = await judgeFn(prompt);
        const verdict = (res.verdict || "continue").toLowerCase() as GoalVerdict;
        if (verdict === "done") {
          return { shouldContinue: false, verdict: "done", reason: res.reason || "Goal satisfied." };
        }
        if (verdict === "wait") {
          return {
            shouldContinue: false,
            verdict: "wait",
            reason: res.reason || "Waiting on background operation.",
            waitOnPid: res.wait_on_pid,
            waitOnSession: res.wait_on_session,
            waitForSeconds: res.wait_for_seconds,
          };
        }
        return {
          shouldContinue: true,
          verdict: "continue",
          reason: res.reason || "Goal in progress.",
          continuationPrompt: this.renderContinuationPrompt(goal, contract, subgoals),
        };
      } catch (err) {
        // Fail-open: continuation
        return {
          shouldContinue: true,
          verdict: "continue",
          reason: "Judge evaluation completed (fail-open continuation)",
          continuationPrompt: this.renderContinuationPrompt(goal, contract, subgoals),
        };
      }
    }

    // 2. Deterministic Pattern-Matching Evaluator
    // Check for explicit stop / blocked condition
    const isBlocked =
      lowerRes.includes("i am blocked") ||
      lowerRes.includes("need user input") ||
      lowerRes.includes("stop condition hit") ||
      lowerRes.includes("cannot proceed without");

    if (isBlocked) {
      return {
        shouldContinue: false,
        verdict: "done",
        reason: "Agent indicated it is blocked or needs user input.",
      };
    }

    // Check for async wait barriers
    if (backgroundProcesses && backgroundProcesses.length > 0) {
      const mentionsWait =
        lowerRes.includes("waiting for background") ||
        lowerRes.includes("process is still running") ||
        lowerRes.includes("awaiting ci");

      if (mentionsWait) {
        const proc = backgroundProcesses[0];
        return {
          shouldContinue: false,
          verdict: "wait",
          reason: `Waiting on background process ${proc.pid} (${proc.command || "task"}).`,
          waitOnPid: proc.pid,
          waitOnSession: proc.session,
        };
      }
    }

    // Check for verified completion criteria
    const hasCompletionClaim =
      lowerRes.includes("goal complete") ||
      lowerRes.includes("goal is complete") ||
      lowerRes.includes("successfully completed") ||
      lowerRes.includes("all requirements satisfied") ||
      lowerRes.includes("all tests pass") ||
      lowerRes.includes("task finished successfully");

    if (hasCompletionClaim) {
      return {
        shouldContinue: false,
        verdict: "done",
        reason: "Agent confirmed goal completion with verified outcome.",
      };
    }

    // Default: Continue
    return {
      shouldContinue: true,
      verdict: "continue",
      reason: "Work remains in progress toward the goal.",
      continuationPrompt: this.renderContinuationPrompt(goal, contract, subgoals),
    };
  }

  /**
   * Evaluates post-turn goal state: gates -> judge -> budget.
   */
  async evaluateAfterTurn(options: {
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
    const { state, lastResponse, cwd, currentFingerprint, backgroundProcesses, judgeFn } = options;

    if (state.status !== "active") {
      return {
        shouldContinue: false,
        verdict: "skipped",
        reason: `Goal is ${state.status}.`,
      };
    }

    state.turnsUsed += 1;
    state.lastTurnAtMs = Date.now();

    // Check Turn Budget limit
    if (state.turnsUsed >= state.maxTurns) {
      state.status = "paused";
      state.pausedReason = `Turn budget reached (${state.maxTurns} turns).`;
      this.substrate.setGoal(state);
      return {
        shouldContinue: false,
        verdict: "continue",
        reason: state.pausedReason,
        pausedReason: state.pausedReason,
      };
    }

    // 1. Evaluate Quality Gates (Deterministic Pre-Judge Gates)
    for (const gate of state.gates) {
      const gateRes = await this.runGate(gate, cwd, currentFingerprint);
      if (!gateRes.passed) {
        if (gate.attempts >= gate.maxRetries) {
          state.status = "paused";
          state.pausedReason = `Quality gate '${gate.command}' exceeded max retries (${gate.maxRetries}).`;
          this.substrate.setGoal(state);
          return {
            shouldContinue: false,
            verdict: "continue",
            reason: state.pausedReason,
            pausedReason: state.pausedReason,
            gateFailed: true,
          };
        }

        this.substrate.setGoal(state);
        return {
          shouldContinue: true,
          verdict: "continue",
          reason: `Quality gate '${gate.command}' failed.`,
          continuationPrompt: this.renderGateFailedPrompt(state.goal, gate),
          gateFailed: true,
        };
      }
    }

    // 2. Evaluate with 3-state Judge
    const judgeResult = await this.judgeGoal({
      goal: state.goal,
      contract: state.contract,
      subgoals: state.subgoals,
      lastResponse,
      backgroundProcesses,
      judgeFn,
    });

    state.lastVerdict = judgeResult.verdict;
    state.lastReason = judgeResult.reason;

    if (judgeResult.verdict === "done") {
      state.status = "done";
      this.substrate.recordCompletion();
    } else if (judgeResult.verdict === "wait") {
      state.waitingOnPid = judgeResult.waitOnPid;
      state.waitingOnSession = judgeResult.waitOnSession;
      if (judgeResult.waitForSeconds) {
        state.waitingUntil = Date.now() + judgeResult.waitForSeconds * 1000;
      }
      state.waitingReason = judgeResult.reason;
      state.waitingSince = Date.now();
    }

    this.substrate.setGoal(state);
    return judgeResult;
  }
}
