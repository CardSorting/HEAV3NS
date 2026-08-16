/**
 * transcription-tool-suite.ts
 *
 * Model tool definitions exposing Multi-Provider Speech-to-Text Transcription to agents
 * (Phase 124 / ADR-100 / Target #57).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { TranscriptionSupervisor } from "../../../agents/extensions/transcription/transcription-supervisor.js";
import type { TranscriptionProvider } from "../../../core/contracts/transcription.contracts.js";

export class TranscriptionToolSuite {
  private readonly supervisor: TranscriptionSupervisor;

  constructor(supervisor: TranscriptionSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "audio_transcribe",
        description:
          "Transcribes an audio file or raw payload into text with word timestamps and speaker diarization.",
        parameters: {
          audioPath: {
            type: "string",
            description: "Path to audio file or raw base64/text identifier.",
            required: true,
          },
          provider: {
            type: "string",
            description: "Optional provider ('local', 'groq', 'openai', 'mistral', 'xai', 'elevenlabs', 'mock').",
            required: false,
          },
          language: {
            type: "string",
            description: "Optional ISO language code hint (e.g. 'en', 'es', 'fr', 'auto').",
            required: false,
          },
          diarize: {
            type: "boolean",
            description: "Whether to partition transcript into multi-speaker turns.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const audioPath = typeof args.audioPath === "string" ? args.audioPath : "";
          if (!audioPath) {
            return { success: false, error: "audioPath is required" };
          }
          const provider = (typeof args.provider === "string" ? args.provider : undefined) as TranscriptionProvider | undefined;
          const language = typeof args.language === "string" ? args.language : undefined;
          const diarize = args.diarize === true;

          try {
            const result = await this.supervisor.transcribe(audioPath, {
              provider,
              language,
              diarize,
            });

            return {
              success: result.success,
              transcript: result.transcript,
              language: result.language,
              durationMs: result.durationMs,
              segmentCount: result.segments.length,
              segments: result.segments,
              provider: result.provider,
              cached: result.cached,
              audioHash: result.audioHash,
            };
          } catch (err: any) {
            return { success: false, error: err.message || String(err) };
          }
        },
      },
      {
        name: "audio_diarize",
        description:
          "Performs speaker diarization over a cached audio transcript.",
        parameters: {
          audioHashOrPath: {
            type: "string",
            description: "SHA-256 hash or path of the audio to diarize.",
            required: true,
          },
          speakerCount: {
            type: "number",
            description: "Estimated number of distinct speakers (default: 2).",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const audioHashOrPath = typeof args.audioHashOrPath === "string" ? args.audioHashOrPath : "";
          if (!audioHashOrPath) {
            return { success: false, error: "audioHashOrPath is required" };
          }
          const speakerCount = typeof args.speakerCount === "number" ? args.speakerCount : 2;

          const segments = this.supervisor.diarize(audioHashOrPath, speakerCount);
          return {
            success: true,
            segmentCount: segments.length,
            segments,
          };
        },
      },
      {
        name: "transcription_cache_inspect",
        description:
          "Inspects cached transcription records by SHA-256 audio hash.",
        parameters: {
          audioHash: {
            type: "string",
            description: "SHA-256 hash of the target audio.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const audioHash = typeof args.audioHash === "string" ? args.audioHash : "";
          if (!audioHash) {
            return { success: false, error: "audioHash is required" };
          }

          const record = this.supervisor.inspectCache(audioHash);
          if (!record) {
            return { success: false, error: `Transcript not found in cache for hash '${audioHash}'` };
          }

          return {
            success: true,
            audioHash: record.audioHash,
            transcript: record.result.transcript,
            provider: record.result.provider,
            hitCount: record.hitCount,
            timestamp: record.timestamp,
          };
        },
      },
      {
        name: "transcription_configure",
        description:
          "Updates active speech-to-text transcription configuration and defaults.",
        parameters: {
          defaultProvider: {
            type: "string",
            description: "Default STT provider.",
            required: false,
          },
          defaultModel: {
            type: "string",
            description: "Default model name.",
            required: false,
          },
          defaultLanguage: {
            type: "string",
            description: "Default language code.",
            required: false,
          },
          enableDiarization: {
            type: "boolean",
            description: "Whether diarization is enabled by default.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const updates: Record<string, unknown> = {};
          if (typeof args.defaultProvider === "string") updates.defaultProvider = args.defaultProvider;
          if (typeof args.defaultModel === "string") updates.defaultModel = args.defaultModel;
          if (typeof args.defaultLanguage === "string") updates.defaultLanguage = args.defaultLanguage;
          if (typeof args.enableDiarization === "boolean") updates.enableDiarization = args.enableDiarization;

          this.supervisor.configure(updates);
          return {
            success: true,
            config: this.supervisor.getConfig(),
          };
        },
      },
      {
        name: "transcription_get_metrics",
        description:
          "Retrieves aggregate statistics on audio transcriptions, durations, and cache efficiency.",
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
