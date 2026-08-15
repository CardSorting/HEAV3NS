/**
 * arbiter-tool-suite.ts
 *
 * Model tool suite exposing security governance & human-in-the-loop approval:
 * - `arbiter_request_approval`: Explicitly requests human authorization.
 * - `arbiter_resolve_approval`: Resolves a pending authorization request.
 * - `arbiter_list_pending`: Lists pending approvals and write-staged artifacts.
 * - `arbiter_estop`: Emergency stop killswitch.
 */

import { InteractiveSecurityArbiter } from "../../../agents/extensions/arbiter/interactive-security-arbiter.js";
import { BroccoliArbiterSubstrate } from "../../../sessions/extensions/arbiter/broccoli-arbiter-substrate.js";
import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type {
  ApprovalActionType,
  ApprovalVerdict,
} from "../../../core/contracts/arbiter.contracts.js";

export class ArbiterToolSuite {
  private readonly arbiter: InteractiveSecurityArbiter;
  private readonly substrate: BroccoliArbiterSubstrate;

  constructor(
    arbiter: InteractiveSecurityArbiter,
    substrate: BroccoliArbiterSubstrate
  ) {
    this.arbiter = arbiter;
    this.substrate = substrate;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "arbiter_request_approval",
        description: "Explicitly evaluates and requests human-in-the-loop authorization for a sensitive command, mutation, or egress action.",
        parameters: {
          actionType: {
            type: "string",
            required: true,
            description: "Action type: 'shell_execution', 'file_mutation', 'skill_mutation', 'memory_mutation', 'credential_access', 'network_egress'.",
          },
          target: {
            type: "string",
            required: true,
            description: "The command string, file path, skill name, or target to authorize.",
          },
          reason: {
            type: "string",
            required: false,
            description: "Optional justification for why this action is required.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const actionType = String(args.actionType || "shell_execution") as ApprovalActionType;
          const target = String(args.target || "");
          const reason = args.reason ? String(args.reason) : undefined;

          try {
            const result = await this.arbiter.evaluateAndAuthorize(actionType, target, { reason });
            return {
              success: result.authorized,
              verdict: result.verdict,
              riskLevel: result.riskAssessment.riskLevel,
              isDangerous: result.riskAssessment.isDangerous,
              commandHash: result.commandHash,
              requestId: result.requestId,
            };
          } catch (err) {
            return {
              success: false,
              error: String(err),
            };
          }
        },
      },
      {
        name: "arbiter_resolve_approval",
        description: "Resolves a pending authorization request by granting or denying approval.",
        parameters: {
          requestId: {
            type: "string",
            required: true,
            description: "The request ID or command hash.",
          },
          verdict: {
            type: "string",
            required: true,
            description: "Verdict: 'approved', 'denied', 'session_allowed', 'always_allowed'.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const requestId = String(args.requestId || "");
          const verdict = String(args.verdict || "denied") as ApprovalVerdict;
          const resolved = this.arbiter.resolveApproval(requestId, verdict);

          if (!resolved) {
            return {
              success: false,
              error: `Pending request '${requestId}' not found`,
            };
          }

          return {
            success: true,
            requestId: resolved.id,
            verdict,
            actionType: resolved.actionType,
            target: resolved.target,
          };
        },
      },
      {
        name: "arbiter_list_pending",
        description: "Lists all currently pending human-in-the-loop approvals and write-staged artifacts.",
        parameters: {},
        execute: async () => {
          const pending = this.substrate.listPending();
          const stagedWrites = this.substrate.listStagedWrites();
          return {
            pendingCount: pending.length,
            stagedCount: stagedWrites.length,
            isEstopped: this.substrate.getIsEstopped(),
            pending: pending.map((p) => ({
              id: p.id,
              actionType: p.actionType,
              target: p.target,
              riskLevel: p.riskAssessment.riskLevel,
              reason: p.riskAssessment.reason,
              createdAt: p.createdAt,
              expiresAt: p.expiresAt,
            })),
            stagedWrites: stagedWrites.map((s) => ({
              id: s.id,
              subsystem: s.subsystem,
              targetPath: s.targetPath,
              gist: s.gist,
              status: s.status,
            })),
          };
        },
      },
      {
        name: "arbiter_estop",
        description: "Emergency Stop (E-Stop) killswitch: halts execution and blocks all pending and future commands until explicitly cleared.",
        parameters: {
          action: {
            type: "string",
            required: true,
            description: "'trigger' to activate emergency stop, or 'clear' to resume normal operations.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const action = String(args.action || "trigger");
          if (action === "clear") {
            this.arbiter.clearEstop();
            return {
              success: true,
              isEstopped: false,
              message: "Emergency stop cleared. Operations resumed.",
            };
          }

          this.arbiter.triggerEstop();
          return {
            success: true,
            isEstopped: true,
            message: "EMERGENCY STOP ACTIVATED: All active and future operations blocked.",
          };
        },
      },
    ];
  }
}
