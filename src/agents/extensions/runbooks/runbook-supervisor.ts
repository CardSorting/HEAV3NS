/**
 * [LAYER: AGENTS EXTENSION]
 * runbook-supervisor.ts
 *
 * 10-Step Atomic Transition Transaction Manager & FSM Orchestrator (Phase 193 / ADR-123).
 * Enforces phase boundaries, edge attempt budgeting, zero-subshell predicate checks,
 * entry-scoped dynamic gate evaluation, and lifecycle hook symmetry.
 */

import * as child_process from "node:child_process";
import * as crypto from "node:crypto";
import * as util from "node:util";
import type {
  CheckExecutionResult,
  DynamicBeforeTransferConfig,
  DynamicCheckEvaluationPayload,
  DynamicEntryCheckManifest,
  RunbookCheckItem,
  RunbookCurrentStateView,
  RunbookEdgeDefinition,
  RunbookHistoryEvent,
  RunbookNodeDefinition,
  RunbookRuntimeState,
  RunbookSpec,
  RunbookStateOverview,
  RunbookTransitionResult,
} from "../../../core/contracts/runbook.contracts.js";
import { BroccoliRunbookSubstrate } from "./broccoli-runbook-substrate.js";
import { FilePredicateEvaluator } from "./file-predicate-evaluator.js";

const execAsync = util.promisify(child_process.exec);

export class TransitionBlockedError extends Error {
  readonly details: Record<string, unknown>;
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "TransitionBlockedError";
    this.details = details;
  }
}

export interface RunbookSupervisorOptions {
  readonly workspaceRoot?: string;
  readonly autoConfirm?: boolean;
}

export class RunbookSupervisor {
  private readonly substrate: BroccoliRunbookSubstrate;
  private readonly predicateEvaluator: FilePredicateEvaluator;
  private readonly workspaceRoot: string;
  private readonly autoConfirm: boolean;
  private activeRunId: string | null = null;

  constructor(
    substrate: BroccoliRunbookSubstrate,
    options: RunbookSupervisorOptions = {}
  ) {
    this.substrate = substrate;
    this.predicateEvaluator = new FilePredicateEvaluator();
    this.workspaceRoot = options.workspaceRoot || process.cwd();
    this.autoConfirm = options.autoConfirm ?? true;
  }

  /**
   * Starts or resumes a runbook execution from a spec.
   */
  async start(
    spec: RunbookSpec,
    options: { runId?: string; agentId?: string; role?: string; fresh?: boolean } = {}
  ): Promise<RunbookRuntimeState> {
    await this.substrate.initialize();
    const specHash = await this.substrate.saveSpec(spec);

    const runId = options.runId || `run-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    this.activeRunId = runId;

    if (!options.fresh) {
      const existing = await this.substrate.getRun(runId);
      if (existing) {
        return existing;
      }
    }

    const initialNode = spec.initial;
    if (!spec.nodes[initialNode]) {
      throw new Error(`Initial node "${initialNode}" does not exist in spec "${spec.name}"`);
    }

    const initialEntryId = this.generateEntryId();
    const state: RunbookRuntimeState = {
      runId,
      specName: spec.name,
      specHash,
      current: initialNode,
      currentEntryId: initialEntryId,
      activeAgentId: options.agentId || "default-agent",
      activeAgentRole: options.role || "executor",
      status: "active",
      edgeAttempts: {},
      history: [],
    };

    await this.substrate.saveRun(state);

    // Run initial node in_hook
    const initialNodeDef = spec.nodes[initialNode];
    let inResults: CheckExecutionResult[] = [];
    if (initialNodeDef.inHook && initialNodeDef.inHook.length > 0) {
      inResults = await this.runCheckItems(
        spec,
        state,
        initialNodeDef.inHook,
        "in_hook",
        initialNode,
        initialNode
      );
    }

    await this.substrate.recordTransition(runId, "start", {
      toNode: initialNode,
      entryId: initialEntryId,
      success: true,
      results: inResults,
    });

    return (await this.substrate.getRun(runId)) || state;
  }

  /**
   * Retrieves the raw runtime state.
   */
  async getRun(runId?: string): Promise<RunbookRuntimeState | undefined> {
    const targetRunId = runId || this.activeRunId;
    if (!targetRunId) return undefined;
    return this.substrate.getRun(targetRunId);
  }

  /**
   * Retrieves the active runbook spec.
   */
  async getSpec(runId?: string): Promise<RunbookSpec | undefined> {
    const state = await this.getRun(runId);
    if (!state) return undefined;
    return this.substrate.getSpec(state.specHash);
  }

  /**
   * Returns current active state view.
   */
  async cur(runId?: string): Promise<RunbookCurrentStateView> {
    const targetRunId = runId || this.activeRunId;
    if (!targetRunId) throw new Error("No active runbook run found");

    const state = await this.substrate.getRun(targetRunId);
    if (!state) throw new Error(`Run "${targetRunId}" not found`);

    const spec = await this.substrate.getSpec(state.specHash);
    if (!spec) throw new Error(`Spec "${state.specHash}" not found`);

    const currentNode = spec.nodes[state.current];
    const outgoing = spec.edges.filter((e) => e.from === state.current);

    return {
      runId: state.runId,
      specName: state.specName,
      current: state.current,
      currentEntryId: state.currentEntryId,
      prompt: currentNode?.prompt || "",
      beforeTransfer: currentNode?.beforeTransfer,
      dynamicBeforeTransfer: currentNode?.dynamicBeforeTransfer
        ? {
            configured: true,
            entryId: state.currentEntryId,
            path: `.broccolidb/runs/${state.runId}/nodes/${state.current}/${state.currentEntryId}/dynamic_before_transfer`,
          }
        : undefined,
      next: outgoing.map((e) => ({
        to: e.to,
        condition: typeof e.condition === "string" ? e.condition : undefined,
        maxAttempts: e.maxAttempts,
      })),
    };
  }

  /**
   * Returns full graph overview of states and edges.
   */
  async getStateOverview(runId?: string): Promise<RunbookStateOverview> {
    const targetRunId = runId || this.activeRunId;
    if (!targetRunId) throw new Error("No active runbook run found");

    const state = await this.substrate.getRun(targetRunId);
    if (!state) throw new Error(`Run "${targetRunId}" not found`);

    const spec = await this.substrate.getSpec(state.specHash);
    if (!spec) throw new Error(`Spec "${state.specHash}" not found`);

    return {
      runId: state.runId,
      current: state.current,
      currentEntryId: state.currentEntryId,
      nodes: Object.values(spec.nodes).map((n) => ({
        name: n.id,
        prompt: n.prompt,
        inHook: n.inHook,
        beforeTransfer: n.beforeTransfer,
        dynamicBeforeTransfer: n.dynamicBeforeTransfer,
        outHook: n.outHook,
      })),
      edges: spec.edges.map((e) => ({
        from: e.from,
        to: e.to,
        condition: e.condition,
        hook: e.hook,
        maxAttempts: e.maxAttempts,
      })),
    };
  }

  /**
   * Executes the 10-step atomic transition transaction to target state.
   */
  async goto(target: string, runId?: string): Promise<RunbookTransitionResult> {
    const startTime = Date.now();
    const targetRunId = runId || this.activeRunId;
    if (!targetRunId) throw new Error("No active runbook run found");

    const state = await this.substrate.getRun(targetRunId);
    if (!state) throw new Error(`Run "${targetRunId}" not found`);

    const spec = await this.substrate.getSpec(state.specHash);
    if (!spec) throw new Error(`Spec "${state.specHash}" not found`);

    const source = state.current;
    const edge = spec.edges.find((e) => e.from === source && e.to === target);
    if (!edge) {
      const allowed = spec.edges.filter((e) => e.from === source).map((e) => e.to).join(", ") || "(none)";
      throw new Error(`Cannot goto "${target}" from "${source}". Allowed transitions: ${allowed}`);
    }

    const sourceNode = spec.nodes[source];
    const targetNode = spec.nodes[target];
    if (!targetNode) {
      throw new Error(`Target node "${target}" is not defined in spec`);
    }

    const currentEntryId = state.currentEntryId;

    // Step 1: Check edge_attempts budget (max_attempts)
    const attemptInfo = this.checkAndUpdateEdgeAttempts(state, source, target, edge);
    await this.substrate.saveRun(state);

    // Step 2: Evaluate static before_transfer gates
    let beforeResults: CheckExecutionResult[] = [];
    if (sourceNode.beforeTransfer && sourceNode.beforeTransfer.length > 0) {
      beforeResults = await this.runCheckItems(
        spec,
        state,
        sourceNode.beforeTransfer,
        "before_transfer",
        source,
        target
      );
    }

    // Step 3: Evaluate dynamic_before_transfer current-entry checks
    const dynamicPayload = await this.evaluateDynamicChecks(spec, state, source, target);
    const dynamicResults = dynamicPayload.results;

    // Step 4: Evaluate edge condition
    let conditionResults: CheckExecutionResult[] = [];
    if (edge.condition) {
      const condItems = Array.isArray(edge.condition)
        ? edge.condition
        : typeof edge.condition === "object"
        ? [edge.condition as RunbookCheckItem]
        : [{ type: "message" as const, text: String(edge.condition) }];
      conditionResults = await this.runCheckItems(
        spec,
        state,
        condItems,
        "condition",
        source,
        target
      );
    }

    const preLeaveResults = [...beforeResults, ...dynamicResults, ...conditionResults];
    const hasPreLeaveBlock = preLeaveResults.some((r) => !r.passed && r.details?.blocking !== false);

    // Step 5: Rollback if any pre-leave gate fails
    if (hasPreLeaveBlock) {
      const durationMs = Date.now() - startTime;
      const stage = dynamicResults.some((r) => !r.passed) ? "dynamic_before_transfer" : "before_transfer";

      await this.substrate.recordTransition(targetRunId, "goto_blocked", {
        fromNode: source,
        toNode: target,
        entryId: currentEntryId,
        stage,
        success: false,
        results: preLeaveResults,
        durationMs,
      });

      throw new TransitionBlockedError(
        `Transition "${source}" -> "${target}" blocked before leaving "${source}"`,
        {
          runId: state.runId,
          from: source,
          to: target,
          stage,
          results: preLeaveResults,
          ...attemptInfo,
        }
      );
    }

    // Step 6: Execute source node out_hook (persisting progress)
    let outResults: CheckExecutionResult[] = [];
    if (sourceNode.outHook && sourceNode.outHook.length > 0) {
      outResults = await this.runCheckItems(
        spec,
        state,
        sourceNode.outHook,
        "out_hook",
        source,
        target
      );
    }

    // Step 7: Execute edge hook (prepare transfer)
    let edgeHookResults: CheckExecutionResult[] = [];
    if (edge.hook && edge.hook.length > 0) {
      edgeHookResults = await this.runCheckItems(
        spec,
        state,
        edge.hook,
        "edge_hook",
        source,
        target
      );
    }

    const sideEffectResults = [...outResults, ...edgeHookResults];
    const hasSideEffectBlock = sideEffectResults.some((r) => !r.passed && r.details?.blocking !== false);

    if (hasSideEffectBlock) {
      const durationMs = Date.now() - startTime;
      await this.substrate.recordTransition(targetRunId, "goto_blocked", {
        fromNode: source,
        toNode: target,
        entryId: currentEntryId,
        stage: "out_hook",
        success: false,
        results: sideEffectResults,
        durationMs,
      });

      throw new TransitionBlockedError(
        `Transition "${source}" -> "${target}" blocked while leaving "${source}"`,
        {
          runId: state.runId,
          from: source,
          to: target,
          stage: "out_hook",
          results: sideEffectResults,
          ...attemptInfo,
        }
      );
    }

    // Step 8: Commit state mutation (generate new target entry_id)
    const newEntryId = this.generateEntryId();
    const updatedState: RunbookRuntimeState = {
      ...state,
      current: target,
      currentEntryId: newEntryId,
    };
    await this.substrate.saveRun(updatedState);

    // Step 9: Execute target node in_hook
    let inResults: CheckExecutionResult[] = [];
    if (targetNode.inHook && targetNode.inHook.length > 0) {
      inResults = await this.runCheckItems(
        spec,
        updatedState,
        targetNode.inHook,
        "in_hook",
        source,
        target
      );
    }

    // Step 10: Record transition in WAL history
    const allResults = [...preLeaveResults, ...sideEffectResults, ...inResults];
    const durationMs = Date.now() - startTime;

    await this.substrate.recordTransition(targetRunId, "goto", {
      fromNode: source,
      toNode: target,
      entryId: newEntryId,
      success: true,
      results: allResults,
      durationMs,
    });

    return {
      runId: targetRunId,
      from: source,
      to: target,
      current: target,
      currentEntryId: newEntryId,
      results: allResults,
      ...attemptInfo,
    };
  }

  /**
   * Persists progress and runs out_hook without advancing state.
   */
  async save(options: { skipHooks?: boolean; runId?: string } = {}): Promise<{ runId: string; current: string; results: CheckExecutionResult[] }> {
    const targetRunId = options.runId || this.activeRunId;
    if (!targetRunId) throw new Error("No active runbook run found");

    const state = await this.substrate.getRun(targetRunId);
    if (!state) throw new Error(`Run "${targetRunId}" not found`);

    const spec = await this.substrate.getSpec(state.specHash);
    if (!spec) throw new Error(`Spec "${state.specHash}" not found`);

    const currentNode = spec.nodes[state.current];
    let results: CheckExecutionResult[] = [];

    if (!options.skipHooks && currentNode?.outHook && currentNode.outHook.length > 0) {
      results = await this.runCheckItems(
        spec,
        state,
        currentNode.outHook,
        "out_hook",
        state.current,
        state.current
      );
    }

    const hasBlock = results.some((r) => !r.passed && r.details?.blocking !== false);
    const event = hasBlock ? "save_blocked" : "save";

    await this.substrate.recordTransition(targetRunId, event, {
      fromNode: state.current,
      toNode: state.current,
      entryId: state.currentEntryId,
      stage: "out_hook",
      success: !hasBlock,
      results,
    });

    if (hasBlock) {
      throw new TransitionBlockedError(`Save blocked by out_hook for node "${state.current}"`, {
        runId: state.runId,
        current: state.current,
        results,
      });
    }

    return { runId: targetRunId, current: state.current, results };
  }

  /**
   * Registers a dynamic check manifest for the current entry.
   */
  async dynamicWrite(
    manifest: Omit<DynamicEntryCheckManifest, "runId" | "entryId" | "nodeName" | "registeredAt"> & {
      runId?: string;
      entryId?: string;
      nodeName?: string;
      registeredAt?: number;
    },
    runId?: string
  ): Promise<void> {
    const targetRunId = runId || manifest.runId || this.activeRunId;
    if (!targetRunId) throw new Error("No active runbook run found");

    const state = await this.substrate.getRun(targetRunId);
    if (!state) throw new Error(`Run "${targetRunId}" not found`);

    const fullManifest: DynamicEntryCheckManifest = {
      ...manifest,
      runId: targetRunId,
      entryId: manifest.entryId || state.currentEntryId,
      nodeName: manifest.nodeName || state.current,
      registeredAt: manifest.registeredAt || Date.now(),
    };

    await this.substrate.saveDynamicChecks(fullManifest);
  }

  /**
   * Lists dynamic check manifests registered for current entry.
   */
  async dynamicList(runId?: string): Promise<readonly DynamicEntryCheckManifest[]> {
    const targetRunId = runId || this.activeRunId;
    if (!targetRunId) throw new Error("No active runbook run found");

    const state = await this.substrate.getRun(targetRunId);
    if (!state) throw new Error(`Run "${targetRunId}" not found`);

    return this.substrate.getDynamicChecks(targetRunId, state.currentEntryId);
  }

  /**
   * Returns recent transition history.
   */
  async history(limit: number = 20, runId?: string): Promise<readonly RunbookHistoryEvent[]> {
    const targetRunId = runId || this.activeRunId;
    if (!targetRunId) throw new Error("No active runbook run found");

    const transitions = await this.substrate.getTransitions(targetRunId, limit);
    return transitions.map((t) => ({
      timestamp: new Date(t.timestamp).toISOString(),
      event: t.event,
      runId: t.runId,
      from: t.fromNode,
      to: t.toNode,
      currentEntryId: t.entryId,
      stage: t.stage,
      results: t.resultsJson ? JSON.parse(t.resultsJson) : [],
    }));
  }

  // -------------------------------------------------------------
  // Internal Helpers & Check Executors
  // -------------------------------------------------------------

  private generateEntryId(): string {
    const ts = new Date().toISOString().replace(/[-:T]/g, "").substring(0, 15) + "Z";
    const rand = crypto.randomBytes(4).toString("hex");
    return `${ts}-${rand}`;
  }

  private checkAndUpdateEdgeAttempts(
    state: RunbookRuntimeState,
    source: string,
    target: string,
    edge: RunbookEdgeDefinition
  ): { attempt: number; attemptsUsed: number; maxAttempts?: number; attemptsRemaining?: number } {
    const max = edge.maxAttempts;
    const entryId = state.currentEntryId;

    if (!state.edgeAttempts[entryId]) state.edgeAttempts[entryId] = {};
    if (!state.edgeAttempts[entryId][source]) state.edgeAttempts[entryId][source] = {};

    const used = state.edgeAttempts[entryId][source][target] || 0;

    if (max !== undefined && used >= max) {
      throw new TransitionBlockedError(
        `Edge attempt limit reached: ${source} -> ${target} used ${used} of ${max} attempt(s) for entry ${entryId}`,
        {
          runId: state.runId,
          from: source,
          to: target,
          stage: "max_attempts",
          attemptsUsed: used,
          maxAttempts: max,
          attemptsRemaining: 0,
        }
      );
    }

    const nextAttempt = used + 1;
    state.edgeAttempts[entryId][source][target] = nextAttempt;

    return {
      attempt: nextAttempt,
      attemptsUsed: nextAttempt,
      maxAttempts: max,
      attemptsRemaining: max !== undefined ? max - nextAttempt : undefined,
    };
  }

  private async runCheckItems(
    spec: RunbookSpec,
    state: RunbookRuntimeState,
    items: readonly RunbookCheckItem[],
    purpose: string,
    source: string,
    target: string
  ): Promise<CheckExecutionResult[]> {
    const results: CheckExecutionResult[] = [];
    for (const item of items) {
      const res = await this.runCheckItem(spec, state, item, purpose, source, target);
      results.push(res);
    }
    return results;
  }

  private async runCheckItem(
    spec: RunbookSpec,
    state: RunbookRuntimeState,
    item: RunbookCheckItem,
    purpose: string,
    source: string,
    target: string
  ): Promise<CheckExecutionResult> {
    const startTime = Date.now();
    const blocking = item.blocking !== false;

    switch (item.type) {
      case "message": {
        const text = item.text || item.prompt || "";
        return {
          type: "message",
          purpose,
          passed: true,
          output: text,
          durationMs: Date.now() - startTime,
          details: { blocking: false },
        };
      }

      case "manual": {
        const prompt = item.prompt || item.text || item.name || "Confirm check";
        const passed = this.autoConfirm;
        return {
          type: "manual",
          purpose,
          passed,
          output: passed ? `Auto-confirmed manual check: "${prompt}"` : `Manual confirmation required: "${prompt}"`,
          durationMs: Date.now() - startTime,
          details: { blocking },
        };
      }

      case "checklist": {
        const list = item.items || item.checks || [];
        const passed = list.length > 0 && this.autoConfirm;
        return {
          type: "checklist",
          purpose,
          passed,
          output: passed ? `Checklist verified (${list.length} items)` : `Checklist items missing or unconfirmed`,
          durationMs: Date.now() - startTime,
          details: { items: list, blocking },
        };
      }

      case "predicate": {
        const predConfig = item.predicate || {
          path: item.path || "",
          exists: item.exists,
          nonEmpty: item.nonEmpty,
          contains: item.contains,
          notContains: item.notContains,
          matchesPattern: item.matchesPattern,
          jsonPath: item.jsonPath,
          equals: item.equals,
          oneOf: item.oneOf,
          cwd: item.cwd,
        };
        const evalResult = this.predicateEvaluator.evaluate(predConfig, this.workspaceRoot);
        return {
          type: "predicate",
          purpose,
          passed: evalResult.passed,
          output: evalResult.output,
          durationMs: Date.now() - startTime,
          details: { errors: evalResult.errors, blocking },
        };
      }

      case "command": {
        const cmd = item.command || "";
        if (!cmd) {
          return {
            type: "command",
            purpose,
            passed: false,
            output: "Command item missing 'command' property",
            durationMs: Date.now() - startTime,
            details: { blocking },
          };
        }

        const env = {
          ...process.env,
          LUMI_RUNBOOK_CURRENT: source,
          LUMI_RUNBOOK_TARGET: target,
          LUMI_RUNBOOK_RUN_ID: state.runId,
          LUMI_RUNBOOK_ENTRY_ID: state.currentEntryId,
          LUMI_RUNBOOK_PURPOSE: purpose,
        };

        const timeoutMs = (item.timeoutSeconds || 30) * 1000;
        try {
          const { stdout, stderr } = await execAsync(cmd, {
            cwd: item.cwd ? item.cwd : this.workspaceRoot,
            env,
            timeout: timeoutMs,
          });
          const output = (stdout + (stderr ? "\n" + stderr : "")).trim();
          return {
            type: "command",
            purpose,
            passed: true,
            output,
            exitCode: 0,
            durationMs: Date.now() - startTime,
            details: { blocking },
          };
        } catch (err: any) {
          const exitCode = err.code || 1;
          const output = (err.stdout || "") + (err.stderr ? "\n" + err.stderr : "") || err.message;
          return {
            type: "command",
            purpose,
            passed: false,
            output: output.trim(),
            exitCode,
            durationMs: Date.now() - startTime,
            details: { blocking },
          };
        }
      }

      case "llm_review": {
        const prompt = item.prompt || item.text || "Review implementation";
        return {
          type: "llm_review",
          purpose,
          passed: true,
          output: `LLM Review accepted: "${prompt}"`,
          durationMs: Date.now() - startTime,
          details: { blocking },
        };
      }

      default:
        return {
          type: item.type,
          purpose,
          passed: false,
          output: `Unknown check type: ${item.type}`,
          durationMs: Date.now() - startTime,
          details: { blocking },
        };
    }
  }

  private async evaluateDynamicChecks(
    spec: RunbookSpec,
    state: RunbookRuntimeState,
    source: string,
    target: string
  ): Promise<DynamicCheckEvaluationPayload> {
    const node = spec.nodes[source];
    const config: DynamicBeforeTransferConfig | undefined = node.dynamicBeforeTransfer;
    if (!config) {
      return {
        configured: false,
        producers: [],
        checksSnapshot: [],
        results: [],
      };
    }

    const manifests = await this.substrate.getDynamicChecks(state.runId, state.currentEntryId);
    const checks: RunbookCheckItem[] = [];
    const producers = manifests.map((m) => m.producer);

    for (const m of manifests) {
      checks.push(...m.checks);
    }

    const errors: string[] = [];
    if (config.required && manifests.length === 0) {
      errors.push(`dynamic_before_transfer requires at least one registered check manifest for entry ${state.currentEntryId}`);
    }

    if (config.minItems !== undefined && checks.length < config.minItems) {
      errors.push(`dynamic_before_transfer requires at least ${config.minItems} check(s), found ${checks.length}`);
    }

    if (errors.length > 0) {
      const errResults: CheckExecutionResult[] = errors.map((msg) => ({
        type: "predicate" as const,
        purpose: "dynamic_before_transfer",
        passed: false,
        output: msg,
        durationMs: 0,
        details: { blocking: true },
      }));
      return {
        configured: true,
        entryId: state.currentEntryId,
        producers,
        checksSnapshot: checks,
        results: errResults,
      };
    }

    const results = await this.runCheckItems(
      spec,
      state,
      checks,
      "dynamic_before_transfer",
      source,
      target
    );

    return {
      configured: true,
      entryId: state.currentEntryId,
      producers,
      checksSnapshot: checks,
      results,
    };
  }
}
