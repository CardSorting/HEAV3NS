/**
 * broccoli-thread-context-substrate.ts
 *
 * In-memory Broccolidb repository storing active execution contexts, audit trails,
 * fail-closed security blocks, and dispatch telemetry (Phase 133 / ADR-109 / Target #66).
 */

import type {
  AsyncTurnContextDescriptor,
  ContextPropagationConfig,
  ContextPropagationMetrics,
  ExecutionDispatchEvent,
  ThreadContextWorkspaceSnapshot,
} from "../../../core/contracts/thread-context.contracts.js";
import { DEFAULT_CONTEXT_PROPAGATION_CONFIG } from "../../../core/contracts/thread-context.contracts.js";

export class BroccoliThreadContextSubstrate {
  private config: ContextPropagationConfig = { ...DEFAULT_CONTEXT_PROPAGATION_CONFIG };
  private contexts = new Map<string, AsyncTurnContextDescriptor>();
  private auditLogs: ExecutionDispatchEvent[] = [];
  private metrics: ContextPropagationMetrics = {
    totalContextsSpawned: 0,
    totalExecutionsWrapped: 0,
    totalApprovalsInherited: 0,
    totalFailClosedBlocks: 0,
    activeContextCount: 0,
  };

  public setConfig(config: Partial<ContextPropagationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): ContextPropagationConfig {
    return { ...this.config };
  }

  public registerContext(descriptor: AsyncTurnContextDescriptor): void {
    this.contexts.set(descriptor.contextId, descriptor);
    this.metrics.totalContextsSpawned++;
    this.metrics.activeContextCount = this.contexts.size;

    if (descriptor.hasApprovalCallback) {
      this.metrics.totalApprovalsInherited++;
    }

    this.recordAudit({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      contextId: descriptor.contextId,
      action: "context_spawned",
      details: `Platform: ${descriptor.platform}, Interactive: ${descriptor.isInteractive}`,
    });

    if (this.contexts.size > this.config.maxActiveContexts) {
      const oldestKey = this.contexts.keys().next().value;
      if (oldestKey) {
        this.contexts.delete(oldestKey);
        this.metrics.activeContextCount = this.contexts.size;
      }
    }
  }

  public getContext(contextId: string): AsyncTurnContextDescriptor | undefined {
    return this.contexts.get(contextId);
  }

  public removeContext(contextId: string): boolean {
    const deleted = this.contexts.delete(contextId);
    if (deleted) {
      this.metrics.activeContextCount = this.contexts.size;
      this.recordAudit({
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        contextId,
        action: "context_cleaned",
      });
    }
    return deleted;
  }

  public getAllContexts(): AsyncTurnContextDescriptor[] {
    return Array.from(this.contexts.values());
  }

  public recordAudit(event: ExecutionDispatchEvent): void {
    if (!this.config.auditLogDispatches) return;
    this.auditLogs.push(event);
    if (this.auditLogs.length > 200) {
      this.auditLogs.shift();
    }
  }

  public recordWrappedExecution(): void {
    this.metrics.totalExecutionsWrapped++;
  }

  public recordFailClosedBlock(contextId: string, command: string, reason: string): void {
    this.metrics.totalFailClosedBlocks++;
    this.recordAudit({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      contextId,
      action: "fail_closed_blocked",
      commandOrTask: command,
      approved: false,
      details: reason,
    });
  }

  public getAuditLogs(): ExecutionDispatchEvent[] {
    return [...this.auditLogs];
  }

  public getMetrics(): ContextPropagationMetrics {
    return { ...this.metrics };
  }

  // Snapshot & Rollback
  public createSnapshot(snapshotId: string): ThreadContextWorkspaceSnapshot {
    return {
      snapshotId,
      timestamp: Date.now(),
      config: this.getConfig(),
      contexts: this.getAllContexts(),
      auditLogs: this.getAuditLogs(),
      metrics: this.getMetrics(),
    };
  }

  public restoreSnapshot(snapshot: ThreadContextWorkspaceSnapshot): void {
    this.config = { ...snapshot.config };
    this.contexts.clear();
    for (const ctx of snapshot.contexts) {
      this.contexts.set(ctx.contextId, { ...ctx });
    }
    this.auditLogs = [...snapshot.auditLogs];
    this.metrics = { ...snapshot.metrics };
  }

  public clear(): void {
    this.config = { ...DEFAULT_CONTEXT_PROPAGATION_CONFIG };
    this.contexts.clear();
    this.auditLogs = [];
    this.metrics = {
      totalContextsSpawned: 0,
      totalExecutionsWrapped: 0,
      totalApprovalsInherited: 0,
      totalFailClosedBlocks: 0,
      activeContextCount: 0,
    };
  }
}
