import type {
  ClassifiedFault,
  IBroccoliFaultSubstrate,
  IDeterministicErrorClassifier,
  IFaultRecoverySupervisor,
  IJitteredBackoffGovernor,
} from "../../../core/contracts/fault.contracts.js";

/**
 * High-Level Fault Recovery Supervisor.
 *
 * Coordinates fault classification, calculates jittered backoffs based on attempt counts,
 * updates provider health in Broccolidb, and issues actionable recovery directives.
 */
export class FaultRecoverySupervisor implements IFaultRecoverySupervisor {
  private readonly classifier: IDeterministicErrorClassifier;
  private readonly backoffGovernor: IJitteredBackoffGovernor;
  private readonly substrate: IBroccoliFaultSubstrate;

  constructor(
    classifier: IDeterministicErrorClassifier,
    backoffGovernor: IJitteredBackoffGovernor,
    substrate: IBroccoliFaultSubstrate
  ) {
    this.classifier = classifier;
    this.backoffGovernor = backoffGovernor;
    this.substrate = substrate;
  }

  evaluateRecovery(
    error: unknown,
    context?: {
      provider?: string;
      model?: string;
      attemptCount?: number;
      statusCode?: number;
      headers?: Record<string, string | string[] | undefined>;
    }
  ): ClassifiedFault {
    const classified = this.classifier.classify(error, {
      provider: context?.provider,
      model: context?.model,
      statusCode: context?.statusCode,
      headers: context?.headers,
    });

    const providerName = context?.provider ?? "default-provider";
    this.substrate.recordFault(providerName, classified.category);

    // Calculate dynamic backoff for the current attempt count
    const attempt = context?.attemptCount ?? 1;
    const rawRetryAfter = context?.headers?.["retry-after"] ?? context?.headers?.["Retry-After"];
    const retryAfter = Array.isArray(rawRetryAfter) ? rawRetryAfter[0] : rawRetryAfter;

    const dynamicBackoffMs = classified.retryable
      ? this.backoffGovernor.calculateBackoffMs(attempt, {}, retryAfter)
      : 0;

    return {
      ...classified,
      suggestedBackoffMs: dynamicBackoffMs,
    };
  }
}
