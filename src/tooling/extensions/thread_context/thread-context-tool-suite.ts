/**
 * thread-context-tool-suite.ts
 *
 * Model tool definitions exposing Async Context Propagation & Fail-Closed Approvals
 * (Phase 133 / ADR-109 / Target #66).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { ThreadContextSupervisor } from "../../../agents/extensions/thread_context/thread-context-supervisor.js";

export class ThreadContextToolSuite {
  private readonly supervisor: ThreadContextSupervisor;

  constructor(supervisor: ThreadContextSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "thread_context_inspect",
        description: "Inspects the active async execution context, parent session ID, and security callbacks.",
        parameters: {},
        execute: async () => {
          const activeContext = this.supervisor.getActiveContext();
          const allContexts = this.supervisor.getAllContexts();
          return {
            success: true,
            hasActiveContext: !!activeContext,
            activeContext,
            totalActiveContexts: allContexts.length,
          };
        },
      },
      {
        name: "thread_context_request_approval",
        description: "Simulates a dangerous command execution request against the active context's approval callback.",
        parameters: {
          command: {
            type: "string",
            description: "Command line to request approval for.",
            required: true,
          },
          reason: {
            type: "string",
            description: "Rationale or security risk category.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const command = String(args.command || "");
          const reason = String(args.reason || "");

          const result = await this.supervisor.requestDangerousApproval(command, reason);
          return {
            success: true,
            command,
            approved: result.approved,
            failClosed: result.failClosed,
            rationale: result.rationale,
          };
        },
      },
      {
        name: "thread_context_verify_propagation",
        description: "Validates that async context and callbacks propagate cleanly across asynchronous worker boundaries.",
        parameters: {},
        execute: async () => {
          const active = this.supervisor.getActiveContext();
          const wrapped = this.supervisor.wrapWorkerDispatch(async () => {
            return this.supervisor.getActiveContext();
          });

          const propagated = await wrapped();
          return {
            success: true,
            propagatedMatch: (active?.contextId === propagated?.contextId),
            parentContextId: active?.contextId,
            workerContextId: propagated?.contextId,
          };
        },
      },
      {
        name: "thread_context_configure",
        description: "Configures fail-closed security gates, non-interactive bypasses, and context dispatch limits.",
        parameters: {
          failClosedOnMissingApproval: {
            type: "boolean",
            description: "Whether commands fail-closed when no callback is registered.",
            required: false,
          },
          allowNonInteractiveAutoApprove: {
            type: "boolean",
            description: "Whether non-interactive contexts are allowed to auto-approve.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const failClosedOnMissingApproval =
            typeof args.failClosedOnMissingApproval === "boolean"
              ? args.failClosedOnMissingApproval
              : undefined;
          const allowNonInteractiveAutoApprove =
            typeof args.allowNonInteractiveAutoApprove === "boolean"
              ? args.allowNonInteractiveAutoApprove
              : undefined;

          this.supervisor.configure({
            failClosedOnMissingApproval,
            allowNonInteractiveAutoApprove,
          });

          return {
            success: true,
            config: this.supervisor.getConfig(),
          };
        },
      },
      {
        name: "thread_context_get_metrics",
        description: "Retrieves context dispatch metrics, audit logs, and fail-closed block counters.",
        parameters: {},
        execute: async () => {
          const metrics = this.supervisor.getMetrics();
          const auditLogs = this.supervisor.getAuditLogs();
          return {
            success: true,
            metrics,
            auditLogs,
          };
        },
      },
    ];
  }
}
