/**
 * streaming-scrubber-tool-suite.ts
 *
 * Model tool definitions exposing Streaming Reasoning Scrubber, Delta Filtration
 * & Holdback Simulation (Phase 137 / ADR-113 / Target #70).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { StreamingScrubberSupervisor } from "../../../agents/extensions/streaming_scrubber/streaming-scrubber-supervisor.js";

export class StreamingScrubberToolSuite {
  private readonly supervisor: StreamingScrubberSupervisor;

  constructor(supervisor: StreamingScrubberSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "streaming_scrubber_feed_delta",
        description: "Feeds a streaming delta chunk for a session and returns the sanitized visible text.",
        parameters: {
          sessionId: {
            type: "string",
            description: "Session identifier for stream state tracking.",
            required: true,
          },
          delta: {
            type: "string",
            description: "Delta text chunk received from LLM stream.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const sessionId = String(args.sessionId || "default-session");
          const delta = String(args.delta || "");
          const visibleText = this.supervisor.feedDelta(sessionId, delta);
          const state = this.supervisor.getSessionState(sessionId);

          return {
            success: true,
            sessionId,
            visibleText,
            inBlock: state.inBlock,
            heldBufferLength: state.heldBuffer.length,
          };
        },
      },
      {
        name: "streaming_scrubber_flush_stream",
        description: "Flushes the held-back buffer at the end of a stream turn.",
        parameters: {
          sessionId: {
            type: "string",
            description: "Session identifier for stream state tracking.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const sessionId = String(args.sessionId || "default-session");
          const tailText = this.supervisor.flushStream(sessionId);

          return {
            success: true,
            sessionId,
            tailText,
          };
        },
      },
      {
        name: "streaming_scrubber_simulate_stream",
        description: "Simulates feeding an array of split delta chunks and returns the reconstructed text and emissions.",
        parameters: {
          chunks: {
            type: "string",
            description: "JSON-encoded array of string delta chunks or string array to simulate.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          let rawChunks: unknown[] = [];
          if (Array.isArray(args.chunks)) {
            rawChunks = args.chunks;
          } else if (typeof args.chunks === "string") {
            try {
              const parsed = JSON.parse(args.chunks);
              if (Array.isArray(parsed)) {
                rawChunks = parsed;
              } else {
                rawChunks = [args.chunks];
              }
            } catch {
              rawChunks = [args.chunks];
            }
          }
          const chunks = rawChunks.map((c) => String(c));
          const simulation = this.supervisor.simulateStream(chunks);

          return {
            success: true,
            chunkCount: chunks.length,
            emissions: simulation.emissions,
            accumulatedText: simulation.accumulatedText,
            totalSuppressedDeltas: simulation.totalSuppressedDeltas,
          };
        },
      },
      {
        name: "streaming_scrubber_configure",
        description: "Configures streaming scrubber tag sets, boundary rules, and suppression policies.",
        parameters: {
          enabled: {
            type: "boolean",
            description: "Whether the streaming scrubber is enabled.",
            required: false,
          },
          preserveProseMentions: {
            type: "boolean",
            description: "Whether to preserve inline prose mentions of tags not at block boundaries.",
            required: false,
          },
          discardUnterminatedOnFlush: {
            type: "boolean",
            description: "Whether to discard unterminated reasoning blocks at stream end.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const enabled = typeof args.enabled === "boolean" ? args.enabled : undefined;
          const preserveProseMentions =
            typeof args.preserveProseMentions === "boolean"
              ? args.preserveProseMentions
              : undefined;
          const discardUnterminatedOnFlush =
            typeof args.discardUnterminatedOnFlush === "boolean"
              ? args.discardUnterminatedOnFlush
              : undefined;

          this.supervisor.configure({
            enabled,
            preserveProseMentions,
            discardUnterminatedOnFlush,
          });

          return {
            success: true,
            config: this.supervisor.getConfig(),
          };
        },
      },
      {
        name: "streaming_scrubber_get_metrics",
        description: "Retrieves operational metrics for streaming reasoning tag suppression.",
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
