import { estimateMessagesTokens, estimateTextTokens } from "../../../core/utilities/token-estimator.js";

/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 155: Zero-Dependency Broccoli Token Estimator
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/agent-context/TokenService.ts).
 * Adaptive character-ratio token estimation heuristics (estimateTokens, roughTokenCountEstimation),
 * token budget overflow checking, and message token calculations. Zero external npm dependencies.
 */

export interface TokenEstimationReport {
  estimatedTokens: number;
  totalLength: number;
  bytesPerToken: number;
  exceedsBudget: boolean;
  budgetLimit: number;
}

export class BroccoliTokenEstimator {
  /**
   * Fast rough token count estimation based on character length ratio.
   */
  public static roughTokenCountEstimation(content: string, bytesPerToken = 4): number {
    if (bytesPerToken === 4) {
      return estimateTextTokens(content);
    }
    const safeRatio = Number.isFinite(bytesPerToken) && bytesPerToken > 0 ? bytesPerToken : 4;
    return content.length === 0 ? 0 : Math.max(1, Math.ceil(content.length / safeRatio));
  }

  /**
   * Estimates token usage for an array of structured text contents.
   */
  public estimateMessages(contents: string[]): number {
    return estimateMessagesTokens(
      contents.map((content) => ({ role: "user" as const, content, timestamp: 0 }))
    );
  }

  /**
   * Evaluates text token count against a defined context budget limit.
   */
  public evaluateBudget(content: string, budgetLimit = 128_000, bytesPerToken = 4): TokenEstimationReport {
    const estimatedTokens = BroccoliTokenEstimator.roughTokenCountEstimation(content, bytesPerToken);

    return {
      estimatedTokens,
      totalLength: content.length,
      bytesPerToken,
      exceedsBudget: estimatedTokens > budgetLimit,
      budgetLimit,
    };
  }
}
