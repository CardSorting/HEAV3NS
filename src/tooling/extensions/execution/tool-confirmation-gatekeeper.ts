/**
 * tool-confirmation-gatekeeper.ts
 *
 * Interactive & Programmable Tool Confirmation Gatekeeper.
 * Intercepts tools marked with `requiresConfirmation: true` or evaluated as `CRITICAL`
 * by ToolSafetyPolicyManager. Supports interactive decisions (allow, deny, allow_all_session)
 * and feeds model-facing rejection reasons back into the reasoning loop.
 */

import type { ToolSafetyAssessment } from "./tool-safety-policy-manager.js";

export type ConfirmationDecision = "allow" | "allow_all_session" | "deny";

export interface ConfirmationRequest {
  readonly toolName: string;
  readonly args: Record<string, unknown>;
  readonly safetyAssessment: ToolSafetyAssessment;
  readonly promptMessage: string;
}

export interface ConfirmationResponse {
  readonly decision: ConfirmationDecision;
  readonly feedback?: string;
}

export type ConfirmationHook = (
  request: ConfirmationRequest
) => Promise<ConfirmationResponse> | ConfirmationResponse;

export class ToolConfirmationGatekeeper {
  private allowedSessionTools = new Set<string>();
  private confirmationHook?: ConfirmationHook;

  constructor(options: { confirmationHook?: ConfirmationHook } = {}) {
    this.confirmationHook = options.confirmationHook;
  }

  /**
   * Sets or updates the confirmation hook.
   */
  public setConfirmationHook(hook: ConfirmationHook): void {
    this.confirmationHook = hook;
  }

  /**
   * Checks if an execution requires confirmation and resolves the decision.
   */
  public async checkConfirmation(
    toolName: string,
    args: Record<string, unknown>,
    safety: ToolSafetyAssessment
  ): Promise<{ approved: boolean; rejectionFeedback?: string }> {
    if (!safety.requiresConfirmation) {
      return { approved: true };
    }

    if (this.allowedSessionTools.has(toolName)) {
      return { approved: true };
    }

    const promptMessage = `Tool '${toolName}' requires confirmation (Risk: ${safety.riskTier}, Score: ${safety.riskScore}/100).\n${safety.warnings.join("\n")}`;

    const request: ConfirmationRequest = {
      toolName,
      args,
      safetyAssessment: safety,
      promptMessage,
    };

    if (!this.confirmationHook) {
      // Default: If no interactive hook is installed, block critical operations safely
      return {
        approved: false,
        rejectionFeedback: `Operation blocked: Tool '${toolName}' requires confirmation but no confirmation handler is active.`,
      };
    }

    const response = await this.confirmationHook(request);

    if (response.decision === "allow_all_session") {
      this.allowedSessionTools.add(toolName);
      return { approved: true };
    }

    if (response.decision === "allow") {
      return { approved: true };
    }

    const userFeedback = response.feedback ? ` Reason: ${response.feedback}` : "";
    return {
      approved: false,
      rejectionFeedback: `Tool execution for '${toolName}' was denied by user.${userFeedback}`,
    };
  }

  /**
   * Clears session approved tools.
   */
  public resetSessionApprovals(): void {
    this.allowedSessionTools.clear();
  }
}
