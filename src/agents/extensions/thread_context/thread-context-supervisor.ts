/**
 * thread-context-supervisor.ts
 *
 * Master supervisor coordinating thread context creation, worker wrapper propagation,
 * fail-closed approval evaluation, and zero-leak cleanup (Phase 133 / ADR-109 / Target #66).
 */

import type { BroccoliThreadContextSubstrate } from "../../../sessions/extensions/thread_context/broccoli-thread-context-substrate.js";
import type {
  ActiveContextStore,
  DeterministicThreadContextEngine,
} from "./deterministic-thread-context-engine.js";
import type {
  AsyncTurnContextDescriptor,
  ContextPropagationConfig,
  ContextPropagationMetrics,
  ExecutionDispatchEvent,
  SecurityApprovalCallback,
  SudoPasswordCallback,
} from "../../../core/contracts/thread-context.contracts.js";

export class ThreadContextSupervisor {
  private readonly substrate: BroccoliThreadContextSubstrate;
  private readonly engine: DeterministicThreadContextEngine;

  constructor(substrate: BroccoliThreadContextSubstrate, engine: DeterministicThreadContextEngine) {
    this.substrate = substrate;
    this.engine = engine;
  }

  public configure(config: Partial<ContextPropagationConfig>): void {
    this.substrate.setConfig(config);
  }

  public getConfig(): ContextPropagationConfig {
    return this.substrate.getConfig();
  }

  public getMetrics(): ContextPropagationMetrics {
    return this.substrate.getMetrics();
  }

  public getAuditLogs(): ExecutionDispatchEvent[] {
    return this.substrate.getAuditLogs();
  }

  public getAllContexts(): AsyncTurnContextDescriptor[] {
    return this.substrate.getAllContexts();
  }

  public getActiveContext(): AsyncTurnContextDescriptor | undefined {
    const store = this.engine.getActiveContextStore();
    return store?.descriptor;
  }

  /**
   * Spawns and registers a new async turn context.
   */
  public spawnContext(params: {
    parentSessionId: string;
    platform: string;
    hasApprovalCallback?: boolean;
    hasSudoCallback?: boolean;
    isInteractive?: boolean;
    metadata?: Record<string, string>;
  }): AsyncTurnContextDescriptor {
    const contextId = `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const descriptor: AsyncTurnContextDescriptor = {
      contextId,
      parentSessionId: params.parentSessionId,
      platform: params.platform,
      hasApprovalCallback: !!params.hasApprovalCallback,
      hasSudoCallback: !!params.hasSudoCallback,
      isInteractive: params.isInteractive !== false,
      createdAt: Date.now(),
      metadata: params.metadata || {},
    };

    this.substrate.registerContext(descriptor);
    return descriptor;
  }

  /**
   * Executes a target function inside a fully-bound AsyncLocalStorage context with fail-closed callbacks.
   */
  public async runInContext<T>(
    descriptor: AsyncTurnContextDescriptor,
    callbacks: {
      approvalCallback?: SecurityApprovalCallback;
      sudoPasswordCallback?: SudoPasswordCallback;
    },
    fn: () => Promise<T>
  ): Promise<T> {
    const store: ActiveContextStore = {
      descriptor: {
        ...descriptor,
        hasApprovalCallback: !!callbacks.approvalCallback,
        hasSudoCallback: !!callbacks.sudoPasswordCallback,
      },
      approvalCallback: callbacks.approvalCallback,
      sudoPasswordCallback: callbacks.sudoPasswordCallback,
    };

    this.substrate.recordWrappedExecution();
    return await this.engine.runWithStore(store, async () => {
      try {
        return await fn();
      } finally {
        // Zero-leak guarantee: clean up references
        this.substrate.removeContext(descriptor.contextId);
      }
    });
  }

  /**
   * Wraps an asynchronous task to propagate the parent async context into worker/background dispatches.
   */
  public wrapWorkerDispatch<TArgs extends any[], TResult>(
    target: (...args: TArgs) => TResult | Promise<TResult>
  ): (...args: TArgs) => Promise<TResult> {
    this.substrate.recordWrappedExecution();
    return this.engine.propagateContext(target);
  }

  /**
   * Evaluates security approval for a command, enforcing fail-closed policies on missing callbacks.
   */
  public async requestDangerousApproval(
    command: string,
    reason: string
  ): Promise<{ approved: boolean; failClosed: boolean; rationale: string }> {
    const config = this.substrate.getConfig();
    const result = await this.engine.evaluateApproval(command, reason, config);
    const activeCtx = this.getActiveContext();
    const contextId = activeCtx?.contextId || "unbound-context";

    if (result.failClosed) {
      this.substrate.recordFailClosedBlock(contextId, command, result.rationale);
    } else {
      this.substrate.recordAudit({
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        contextId,
        action: "approval_resolved",
        commandOrTask: command,
        approved: result.approved,
        details: result.rationale,
      });
    }

    return result;
  }

  /**
   * Resolves sudo password from current async context.
   */
  public async requestSudo(): Promise<string | undefined> {
    return await this.engine.evaluateSudo();
  }
}
