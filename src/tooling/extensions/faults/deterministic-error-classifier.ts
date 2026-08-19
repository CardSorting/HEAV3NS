import type {
  ClassifiedFault,
  FaultCategory,
  IDeterministicErrorClassifier,
  IJitteredBackoffGovernor,
  RecoveryDirectiveType,
} from "../../../core/contracts/fault.contracts.js";

/**
 * Deterministic Provider Error Classifier.
 *
 * Provides structured classification of API errors, HTTP statuses, and error codes
 * into normalized fault categories and actionable recovery directives.
 */
export class DeterministicErrorClassifier implements IDeterministicErrorClassifier {
  private readonly backoffGovernor: IJitteredBackoffGovernor;

  constructor(backoffGovernor: IJitteredBackoffGovernor) {
    this.backoffGovernor = backoffGovernor;
  }

  private extractStatus(err: unknown, explicitStatus?: number): number | undefined {
    if (explicitStatus && explicitStatus > 0) return explicitStatus;
    if (typeof err === "object" && err !== null) {
      const e = err as Record<string, unknown>;
      if (typeof e.status === "number") return e.status;
      if (typeof e.statusCode === "number") return e.statusCode;
      if (typeof e.status_code === "number") return e.status_code;
    }
    return undefined;
  }

  private extractMessage(err: unknown): string {
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message;
    if (typeof err === "object" && err !== null) {
      const e = err as Record<string, unknown>;
      if (typeof e.message === "string") return e.message;
      if (typeof e.error === "string") return e.error;
      if (typeof e.error === "object" && e.error !== null) {
        const inner = e.error as Record<string, unknown>;
        if (typeof inner.message === "string") return inner.message;
      }
    }
    return String(err ?? "Unknown Error");
  }

  private extractErrorCode(err: unknown): string | undefined {
    if (typeof err === "object" && err !== null) {
      const e = err as Record<string, unknown>;
      if (typeof e.code === "string") return e.code;
      if (typeof e.error_code === "string") return e.error_code;
      if (typeof e.error === "object" && e.error !== null) {
        const inner = e.error as Record<string, unknown>;
        if (typeof inner.code === "string") return inner.code;
        if (typeof inner.type === "string") return inner.type;
      }
    }
    return undefined;
  }

  classify(
    error: unknown,
    options?: {
      provider?: string;
      model?: string;
      statusCode?: number;
      headers?: Record<string, string | string[] | undefined>;
    }
  ): ClassifiedFault {
    const status = this.extractStatus(error, options?.statusCode);
    const message = this.extractMessage(error);
    const errorCode = this.extractErrorCode(error);
    const provider = options?.provider;
    const model = options?.model;

    const lowerMsg = message.toLowerCase();
    const lowerCode = errorCode?.toLowerCase() ?? "";

    let category: FaultCategory = "unknown";
    let directive: RecoveryDirectiveType = "retry_backoff";
    let retryable = true;

    // 1. SSL / TLS Verification Failures (Deterministic Host Issue - Fail Fast)
    if (
      lowerMsg.includes("self_signed_cert") ||
      lowerMsg.includes("certificate") ||
      lowerMsg.includes("unable_to_verify_leaf_signature") ||
      lowerCode.includes("cert") ||
      lowerCode === "depth_zero_self_signed_cert"
    ) {
      category = "ssl_failure";
      directive = "abort_fail_fast";
      retryable = false;
    }
    // 2. Billing & Quota Exhaustion
    else if (
      status === 402 ||
      lowerMsg.includes("quota exceeded") ||
      lowerMsg.includes("insufficient credit") ||
      lowerMsg.includes("billing") ||
      lowerCode === "insufficient_quota" ||
      lowerCode === "credit_exhausted"
    ) {
      category = "billing_exhausted";
      directive = "rotate_credential";
      retryable = true;
    }
    // 3. Authentication & Authorization Failures
    else if (status === 401 || status === 403 || lowerCode === "invalid_api_key" || lowerMsg.includes("unauthorized")) {
      if (lowerMsg.includes("account suspended") || lowerMsg.includes("revoked")) {
        category = "auth_permanent";
        directive = "abort_fail_fast";
        retryable = false;
      } else {
        category = "auth_transient";
        directive = "rotate_credential";
        retryable = true;
      }
    }
    // 4. Rate Limiting & Throttling
    else if (status === 429 || lowerMsg.includes("rate limit") || lowerCode === "rate_limit_exceeded") {
      if (lowerMsg.includes("upstream model") || lowerMsg.includes("provider overloaded")) {
        category = "upstream_rate_limit";
        directive = "fallback_model";
        retryable = true;
      } else {
        category = "rate_limit";
        directive = "rotate_credential";
        retryable = true;
      }
    }
    // 5. Context Overflow / Window Limits
    else if (
      status === 413 ||
      lowerMsg.includes("context length") ||
      lowerMsg.includes("maximum context length") ||
      lowerMsg.includes("prompt is too long") ||
      lowerCode === "context_length_exceeded" ||
      lowerCode === "string_above_max_length"
    ) {
      category = "context_overflow";
      directive = "compress_context";
      retryable = true;
    }
    // 6. Model Availability / Not Found
    else if (status === 404 || lowerMsg.includes("model not found") || lowerCode === "model_not_found") {
      category = "model_unavailable";
      directive = "fallback_model";
      retryable = true;
    }
    // 7. Overloaded / Server Errors & Mid-Stream Terminations
    else if (
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 529 ||
      lowerMsg.includes("overloaded") ||
      lowerMsg.includes("internal server error") ||
      lowerMsg.includes("openrouter mid-stream error") ||
      lowerMsg.includes("stream terminated with error status")
    ) {
      category = "overloaded_server";
      directive = "retry_backoff";
      retryable = true;
    }
    // 8. Network Timeout
    else if (
      lowerMsg.includes("timeout") ||
      lowerMsg.includes("etimedout") ||
      lowerMsg.includes("econnreset") ||
      lowerCode === "timeout" ||
      lowerCode === "aborterror"
    ) {
      category = "network_timeout";
      directive = "retry_backoff";
      retryable = true;
    }
    // 9. Schema / Grammar Rejection
    else if (
      status === 400 &&
      (lowerMsg.includes("json schema") || lowerMsg.includes("grammar") || lowerMsg.includes("schema rejected"))
    ) {
      category = "schema_rejected";
      directive = "strip_schema";
      retryable = true;
    }
    // 10. Content / Safety Policy Blocked
    else if (lowerMsg.includes("safety filter") || lowerMsg.includes("content policy") || lowerCode === "content_filter") {
      category = "content_policy_blocked";
      directive = "abort_fail_fast";
      retryable = false;
    }

    // Extract suggested backoff
    const rawRetryAfter = options?.headers?.["retry-after"] ?? options?.headers?.["Retry-After"];
    const retryAfter = Array.isArray(rawRetryAfter) ? rawRetryAfter[0] : rawRetryAfter;
    const suggestedBackoffMs = retryable ? this.backoffGovernor.calculateBackoffMs(1, {}, retryAfter) : 0;

    return {
      category,
      directive,
      statusCode: status,
      provider,
      model,
      errorCode,
      message,
      retryable,
      suggestedBackoffMs,
    };
  }
}
