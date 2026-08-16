/**
 * stream-diag-tool-suite.ts
 *
 * Model tool definitions exposing LLM Stream Diagnostics & Upstream Header Forensics
 * (Phase 130 / ADR-106 / Target #63).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { StreamDiagSupervisor } from "../../../agents/extensions/stream_diag/stream-diag-supervisor.js";

export class StreamDiagToolSuite {
  private readonly supervisor: StreamDiagSupervisor;

  constructor(supervisor: StreamDiagSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "stream_diag_inspect_attempts",
        description: "Retrieves recent LLM stream attempts, drop events, upstream headers, and latency metrics.",
        parameters: {
          limit: {
            type: "number",
            description: "Optional maximum number of attempts to return.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const limit = typeof args.limit === "number" ? Math.max(1, args.limit) : 20;
          const attempts = this.supervisor.getRecentAttempts().slice(-limit);
          const dropEvents = this.supervisor.getDropEvents().slice(-limit);

          return {
            success: true,
            attemptsCount: attempts.length,
            dropEventsCount: dropEvents.length,
            attempts,
            dropEvents,
          };
        },
      },
      {
        name: "stream_diag_record_event",
        description: "Simulates or records a stream lifecycle event for diagnostic auditing.",
        parameters: {
          provider: {
            type: "string",
            description: "Inference provider name (e.g. 'openrouter', 'anthropic').",
            required: true,
          },
          model: {
            type: "string",
            description: "Model name.",
            required: true,
          },
          bytes: {
            type: "number",
            description: "Number of bytes received in the stream.",
            required: false,
          },
          chunks: {
            type: "number",
            description: "Number of chunks received.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const provider = String(args.provider || "generic").trim();
          const model = String(args.model || "generic-model").trim();
          const bytes = typeof args.bytes === "number" ? args.bytes : 1024;
          const chunks = typeof args.chunks === "number" ? args.chunks : 8;

          const attempt = this.supervisor.startAttempt(provider, model);
          this.supervisor.captureResponse(attempt.attemptId, 200, {
            "x-openrouter-provider": provider,
            "cf-ray": "mock-cf-ray-12345",
          });

          for (let i = 0; i < chunks; i++) {
            this.supervisor.recordChunk(attempt.attemptId, Math.round(bytes / chunks));
          }

          this.supervisor.completeAttempt(attempt.attemptId);

          return {
            success: true,
            attempt: this.supervisor.getRecentAttempts().find((a) => a.attemptId === attempt.attemptId),
          };
        },
      },
      {
        name: "stream_diag_format_chain",
        description: "Flattens an exception or error diagnostic chain into a single-line forensic trace.",
        parameters: {
          errorMessage: {
            type: "string",
            description: "Root error message or description.",
            required: true,
          },
          innerCause: {
            type: "string",
            description: "Optional underlying nested error cause.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const errorMessage = String(args.errorMessage || "UnknownError");
          const innerCause = typeof args.innerCause === "string" ? args.innerCause : undefined;

          const errorObj = new Error(errorMessage);
          if (innerCause) {
            (errorObj as { cause?: Error }).cause = new Error(innerCause);
          }

          // Unpack via engine
          const supervisorObj = this.supervisor as unknown as { engine: { flattenExceptionChain: (e: unknown) => string } };
          const chain = supervisorObj.engine.flattenExceptionChain(errorObj);

          return {
            success: true,
            chain,
          };
        },
      },
      {
        name: "stream_diag_configure",
        description: "Configures monitored upstream headers and attempt retention limits.",
        parameters: {
          maxTrackedAttempts: {
            type: "number",
            description: "Maximum number of attempts to retain in memory.",
            required: false,
          },
          maxDropEvents: {
            type: "number",
            description: "Maximum number of drop events to retain in memory.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const maxTrackedAttempts = typeof args.maxTrackedAttempts === "number" ? args.maxTrackedAttempts : undefined;
          const maxDropEvents = typeof args.maxDropEvents === "number" ? args.maxDropEvents : undefined;

          this.supervisor.configure({
            maxTrackedAttempts,
            maxDropEvents,
          });

          return {
            success: true,
            config: this.supervisor.getConfig(),
          };
        },
      },
      {
        name: "stream_diag_get_metrics",
        description: "Retrieves aggregate LLM stream performance and error statistics.",
        parameters: {},
        execute: async () => {
          const metrics = this.supervisor.getMetrics();
          return {
            success: true,
            metrics,
          };
        },
      },
    ];
  }
}
