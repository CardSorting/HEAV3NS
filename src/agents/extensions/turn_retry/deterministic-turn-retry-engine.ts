/**
 * deterministic-turn-retry-engine.ts
 *
 * Pure TypeScript One-Shot Guard Evaluator, Recovery Branch Arbitrator,
 * Payload Transform Synthesizer & Escalation Classifier (Phase 131 / ADR-107 / Target #64).
 */

import type {
  TurnRecoveryBranch,
  TurnRestartSignalKey,
  TurnRetryConfig,
  TurnRetryGuards,
  TurnRestartSignals,
} from "../../../core/contracts/turn-retry.contracts.js";

export class DeterministicTurnRetryEngine {
  /**
   * Evaluates if a recovery branch can be legally triggered under one-shot rules and configuration.
   */
  public canTrigger(
    branch: TurnRecoveryBranch,
    guards: TurnRetryGuards,
    config: TurnRetryConfig
  ): boolean {
    if (guards[branch]) {
      return false; // Already attempted
    }
    if (!config.allowedRecoveryBranches.includes(branch)) {
      return false; // Disallowed by policy
    }
    return true;
  }

  /**
   * Classifies an incoming API error or status code to recommend a recovery branch.
   */
  public classifyErrorRecovery(
    error: unknown,
    statusCode?: number,
    provider?: string
  ): { recommendedBranch?: TurnRecoveryBranch; recommendedSignal?: TurnRestartSignalKey; reason: string } {
    const p = (provider || "").toLowerCase();
    const errMsg = String((error as { message?: string })?.message || error || "").toLowerCase();

    // 401 / 403 Authentication errors
    if (statusCode === 401 || statusCode === 403 || errMsg.includes("unauthorized") || errMsg.includes("invalid api key")) {
      if (p === "codex" || p.includes("openai")) {
        return { recommendedBranch: "codexAuthRetryAttempted", reason: "Codex OAuth re-exchange needed" };
      }
      if (p === "anthropic") {
        return { recommendedBranch: "anthropicAuthRetryAttempted", reason: "Anthropic API key refresh needed" };
      }
      if (p === "nous") {
        return { recommendedBranch: "nousAuthRetryAttempted", reason: "Nous research portal token refresh" };
      }
      if (p === "copilot" || p.includes("github")) {
        return { recommendedBranch: "copilotAuthRetryAttempted", reason: "GitHub Copilot OAuth token refresh" };
      }
      if (p === "vertex" || p.includes("google")) {
        return { recommendedBranch: "vertexAuthRetryAttempted", reason: "Google Vertex ADC credential refresh" };
      }
      return { recommendedBranch: "authFailoverAttempted", reason: "Generic auth failure; escalate to provider failover" };
    }

    // Copilot stale credential 400
    if (statusCode === 400 && p.includes("copilot") && (errMsg.includes("model_not_available_for_integrator") || errMsg.includes("model_not_supported"))) {
      return { recommendedBranch: "copilotStaleCredRetryAttempted", reason: "Copilot stale integrator credential refresh" };
    }

    // 429 Rate limits
    if (statusCode === 429 || errMsg.includes("rate limit") || errMsg.includes("quota exceeded")) {
      return { recommendedBranch: "hasRetried429", reason: "Rate limit encountered; retry with backoff or alternative pool credential" };
    }

    // Thinking tag format rejection
    if (errMsg.includes("thinking signature") || errMsg.includes("invalid reasoning format")) {
      return {
        recommendedBranch: "thinkingSigRetryAttempted",
        recommendedSignal: "restartWithRebuiltMessages",
        reason: "Model rejected thinking signature tags; strip thinking tokens and restart",
      };
    }

    // Context length or compaction rejection
    if (errMsg.includes("context length exceeded") || errMsg.includes("maximum context length") || errMsg.includes("prompt is too long")) {
      return {
        recommendedBranch: "nativeCompactionRejectRetryAttempted",
        recommendedSignal: "restartWithCompressedMessages",
        reason: "Context length overflow; compress conversation history and restart",
      };
    }

    // Image payload size rejection
    if (errMsg.includes("image exceeds maximum size") || errMsg.includes("payload too large") || errMsg.includes("image dimensions")) {
      return {
        recommendedBranch: "imageShrinkRetryAttempted",
        recommendedSignal: "restartWithRebuiltMessages",
        reason: "Image payload oversized; downscale and compress image attachments",
      };
    }

    // Multimodal tool result stripping
    if (errMsg.includes("tool result contains image") || errMsg.includes("unsupported tool content type")) {
      return {
        recommendedBranch: "multimodalToolContentRetryAttempted",
        recommendedSignal: "restartWithRebuiltMessages",
        reason: "Provider rejected multimodal tool result; strip images to plain text summary",
      };
    }

    // Default primary transport recovery
    return {
      recommendedBranch: "primaryRecoveryAttempted",
      reason: "General network / connection drop; retry attempt",
    };
  }

  /**
   * Generates a summary description of active restart signals.
   */
  public formatRestartAction(signals: TurnRestartSignals): string {
    const active: string[] = [];
    if (signals.restartWithCompressedMessages) active.push("compress_messages");
    if (signals.restartWithLengthContinuation) active.push("length_continuation");
    if (signals.restartWithRebuiltMessages) active.push("rebuild_messages");
    if (signals.restartWithRedirectedMessages) active.push("redirect_messages");

    return active.length > 0 ? active.join(" | ") : "none";
  }
}
