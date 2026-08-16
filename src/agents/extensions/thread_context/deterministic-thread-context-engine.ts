/**
 * deterministic-thread-context-engine.ts
 *
 * Pure TypeScript AsyncLocalStorage Context Holder, Security Callback Propagator
 * & Fail-Closed Approval Gate Engine (Phase 133 / ADR-109 / Target #66).
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type {
  AsyncTurnContextDescriptor,
  ContextPropagationConfig,
  SecurityApprovalCallback,
  SudoPasswordCallback,
} from "../../../core/contracts/thread-context.contracts.js";

export interface ActiveContextStore {
  descriptor: AsyncTurnContextDescriptor;
  approvalCallback?: SecurityApprovalCallback;
  sudoPasswordCallback?: SudoPasswordCallback;
}

export class DeterministicThreadContextEngine {
  private readonly asyncLocalStorage = new AsyncLocalStorage<ActiveContextStore>();

  /**
   * Returns the currently active context store, if one is running in the current async execution stack.
   */
  public getActiveContextStore(): ActiveContextStore | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Executes a synchronous or asynchronous function within a bound execution context.
   */
  public runWithStore<T>(store: ActiveContextStore, fn: () => T): T {
    return this.asyncLocalStorage.run(store, fn);
  }

  /**
   * Evaluates if a dangerous command should be approved or blocked under fail-closed security rules.
   */
  public async evaluateApproval(
    command: string,
    reason: string,
    config: ContextPropagationConfig
  ): Promise<{ approved: boolean; failClosed: boolean; rationale: string }> {
    const currentStore = this.getActiveContextStore();

    // 1. Missing context or missing approval callback in interactive mode -> Fail Closed
    if (!currentStore || !currentStore.approvalCallback) {
      if (config.failClosedOnMissingApproval) {
        return {
          approved: false,
          failClosed: true,
          rationale: "Fail-closed: No security approval callback registered in active async context.",
        };
      }
      if (config.allowNonInteractiveAutoApprove && (!currentStore || !currentStore.descriptor.isInteractive)) {
        return {
          approved: true,
          failClosed: false,
          rationale: "Auto-approved: Non-interactive mode permitted by configuration.",
        };
      }
      return {
        approved: false,
        failClosed: true,
        rationale: "Denied: Missing approval callback.",
      };
    }

    // 2. Invoke parent approval callback with try-catch fail-closed protection
    try {
      const userApproved = await currentStore.approvalCallback(command, reason);
      return {
        approved: userApproved,
        failClosed: false,
        rationale: userApproved ? "User explicitly approved execution." : "User denied execution.",
      };
    } catch (err) {
      return {
        approved: false,
        failClosed: true,
        rationale: `Fail-closed: Approval callback threw an error: ${String(err)}`,
      };
    }
  }

  /**
   * Resolves sudo password from the active context's callback.
   */
  public async evaluateSudo(): Promise<string | undefined> {
    const currentStore = this.getActiveContextStore();
    if (!currentStore || !currentStore.sudoPasswordCallback) {
      return undefined;
    }
    try {
      return await currentStore.sudoPasswordCallback();
    } catch {
      return undefined;
    }
  }

  /**
   * Creates a callable wrapper that propagates the active thread context across async worker dispatches.
   */
  public propagateContext<TArgs extends any[], TResult>(
    target: (...args: TArgs) => TResult | Promise<TResult>
  ): (...args: TArgs) => Promise<TResult> {
    const parentStore = this.getActiveContextStore();
    if (!parentStore) {
      return async (...args: TArgs) => await target(...args);
    }

    return async (...args: TArgs) => {
      return this.asyncLocalStorage.run(parentStore, async () => {
        return await target(...args);
      });
    };
  }
}
