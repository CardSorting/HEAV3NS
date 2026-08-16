/**
 * deterministic-stream-diag-engine.ts
 *
 * Pure TypeScript Exception Cause Chain Flattener, Upstream Header Extractor,
 * TTFB & Latency Metrics Calculator & Diagnostic Formatter (Phase 130 / ADR-106 / Target #63).
 */

import type {
  StreamDiagConfig,
  StreamDiagnosticAttempt,
  StreamDropEvent,
} from "../../../core/contracts/stream-diag.contracts.js";

export class DeterministicStreamDiagEngine {
  /**
   * Unwraps and flattens an exception cause chain into a compact one-liner:
   * "APIConnectionError(Failed) <- ConnectError(Connection reset by peer)".
   */
  public flattenExceptionChain(error: unknown, maxDepth = 4): string {
    if (!error) return "UnknownError";

    const seen: unknown[] = [];
    let link: unknown = error;
    const parts: string[] = [];

    while (link && seen.length < maxDepth) {
      if (seen.includes(link)) {
        break;
      }
      seen.push(link);

      const errName = (link as { name?: string }).name || (link as { constructor?: { name: string } }).constructor?.name || "Error";
      const errMsg = (link as { message?: string }).message || String(link);
      const cleanMsg = errMsg.replace(/\s+/g, " ").trim();
      const truncated = cleanMsg.length > 140 ? `${cleanMsg.slice(0, 140)}…` : cleanMsg;

      parts.push(truncated && truncated !== errName ? `${errName}(${truncated})` : errName);

      const nextCause = (link as { cause?: unknown }).cause;
      if (!nextCause || nextCause === link) {
        break;
      }
      link = nextCause;
    }

    return parts.length > 0 ? parts.join(" <- ") : "Error";
  }

  /**
   * Captures tracked upstream diagnostic headers from an HTTP response or headers map.
   */
  public captureUpstreamHeaders(
    headers: Record<string, string | string[] | undefined>,
    config: StreamDiagConfig
  ): Record<string, string> {
    const result: Record<string, string> = {};
    if (!headers) return result;

    const lowerMap = new Map<string, string>();
    for (const [k, v] of Object.entries(headers)) {
      if (v !== undefined) {
        lowerMap.set(k.toLowerCase(), Array.isArray(v) ? v.join(", ") : String(v));
      }
    }

    for (const targetName of config.monitoredHeaders) {
      const val = lowerMap.get(targetName.toLowerCase());
      if (val) {
        result[targetName] = val.slice(0, config.maxHeaderValueLength);
      }
    }

    return result;
  }

  /**
   * Composes a compact user-facing status message for stream drop & retries.
   */
  public formatUserFacingDropMessage(
    provider: string,
    error: unknown,
    attempt: number,
    maxAttempts: number,
    elapsedMs: number,
    midToolCall: boolean,
    subagentId?: string
  ): string {
    const prefix = subagentId ? `[subagent:${subagentId}] ` : "";
    const kind = midToolCall ? "mid tool-call" : "stream";
    const errName = (error as { name?: string })?.name || "Error";
    const elapsedSec = (elapsedMs / 1000).toFixed(1);
    const timingStr = elapsedMs > 0 ? ` after ${elapsedSec}s` : "";

    return `${prefix}Stream drop ${kind} (${provider}, ${errName}${timingStr}) — retrying (${attempt}/${maxAttempts})…`;
  }

  /**
   * Generates a structured drop event payload.
   */
  public createDropEvent(
    attempt: StreamDiagnosticAttempt,
    error: unknown,
    attemptNum: number,
    maxAttempts: number
  ): StreamDropEvent {
    const errorSummary = (error as { message?: string })?.message || String(error);
    const exceptionChain = this.flattenExceptionChain(error);
    const userFacingMessage = this.formatUserFacingDropMessage(
      attempt.provider,
      error,
      attemptNum,
      maxAttempts,
      attempt.elapsedMs,
      attempt.midToolCall,
      attempt.subagentId
    );

    return {
      eventId: `drop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      attemptId: attempt.attemptId,
      timestamp: Date.now(),
      kind: attempt.midToolCall ? "drop mid tool-call" : "drop",
      provider: attempt.provider,
      model: attempt.model,
      attempt: attemptNum,
      maxAttempts,
      subagentId: attempt.subagentId,
      delegateDepth: attempt.delegateDepth,
      httpStatus: attempt.httpStatus,
      bytes: attempt.bytes,
      chunks: attempt.chunks,
      elapsedMs: attempt.elapsedMs,
      ttfbMs: attempt.ttfbMs,
      upstreamHeaders: { ...attempt.headers },
      errorSummary,
      exceptionChain,
      userFacingMessage,
    };
  }
}
