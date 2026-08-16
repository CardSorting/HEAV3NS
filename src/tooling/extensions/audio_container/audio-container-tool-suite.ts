/**
 * audio-container-tool-suite.ts
 *
 * Model tool definitions exposing Audio Container Magic-Byte Sniffer, Streaming Audio Cache
 * & Voice Extension Repair Subsystem to agents and CLI (Phase 114 / ADR-090 / Target #47).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { AudioCacheEntry } from "../../../core/contracts/audio-container.contracts.js";
import type { AudioContainerSupervisor } from "../../../agents/extensions/audio_container/audio-container-supervisor.js";

export class AudioContainerToolSuite {
  private readonly supervisor: AudioContainerSupervisor;

  constructor(supervisor: AudioContainerSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "audio_sniff_container",
        description:
          "Sniffs binary magic bytes of an audio payload to identify container format (OGG, FLAC, WAV, MP3, AAC, M4A, MP4, WEBM) and canonical file extension.",
        parameters: {
          payload_base64: {
            type: "string",
            description: "Base64 encoded raw audio file bytes.",
            required: true,
          },
          claimed_filename_or_ext: {
            type: "string",
            description: "Optional claimed filename or extension (e.g. 'voice.ogg').",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const payloadBase64 = typeof args.payload_base64 === "string" ? args.payload_base64 : "";
          const claimed = typeof args.claimed_filename_or_ext === "string" ? args.claimed_filename_or_ext : undefined;

          const result = this.supervisor.sniffAudio(payloadBase64, claimed);
          return {
            success: true,
            containerId: result.containerId,
            canonicalExtension: result.canonicalExtension,
            mimeType: result.mimeType,
            recognized: result.recognized,
            isRepaired: result.isRepaired,
            repairedExtension: result.repairedExtension,
          };
        },
      },
      {
        name: "audio_repair_extension",
        description:
          "Repairs a mismatched audio filename or path based on real magic-byte container analysis (e.g. repairs 'voice.ogg' containing MP3 bytes into 'voice.mp3').",
        parameters: {
          payload_base64: {
            type: "string",
            description: "Base64 encoded raw audio file bytes.",
            required: true,
          },
          filename: {
            type: "string",
            description: "The existing or claimed filename to repair.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const payloadBase64 = typeof args.payload_base64 === "string" ? args.payload_base64 : "";
          const filename = typeof args.filename === "string" ? args.filename : "";

          const repaired = this.supervisor.repairFilename(payloadBase64, filename);
          return {
            success: true,
            originalFilename: filename,
            repairedFilename: repaired,
            isRepaired: filename !== repaired,
          };
        },
      },
      {
        name: "audio_cache_payload",
        description:
          "Validates, sniffs, repairs, and stores audio payload into the in-memory Broccolidb audio cache.",
        parameters: {
          path_or_url: {
            type: "string",
            description: "Source path or URL identifier for the audio resource.",
            required: true,
          },
          payload_base64: {
            type: "string",
            description: "Base64 encoded raw audio bytes.",
            required: true,
          },
          metadata_json: {
            type: "string",
            description: "Optional JSON metadata object.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const pathOrUrl = typeof args.path_or_url === "string" ? args.path_or_url : "";
          const payloadBase64 = typeof args.payload_base64 === "string" ? args.payload_base64 : "";
          let metadata: Record<string, unknown> | undefined = undefined;
          if (typeof args.metadata_json === "string") {
            try {
              metadata = JSON.parse(args.metadata_json);
            } catch {
              return { success: false, error: "Invalid JSON in metadata_json" };
            }
          }

          const entry = this.supervisor.cacheAudio({
            pathOrUrl,
            data: payloadBase64,
            metadata,
          });

          return {
            success: true,
            cacheKey: entry.cacheKey,
            containerId: entry.containerId,
            extension: entry.extension,
            mimeType: entry.mimeType,
            sizeBytes: entry.sizeBytes,
          };
        },
      },
      {
        name: "audio_inspect_cache",
        description:
          "Inspects audio cache records, listing cached audio keys, container formats, and sizes.",
        parameters: {
          cache_key: {
            type: "string",
            description: "Optional specific cache key to inspect.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const cacheKey = typeof args.cache_key === "string" ? args.cache_key : undefined;

          if (cacheKey) {
            const entry = this.supervisor.getCacheEntry(cacheKey);
            if (!entry) {
              return { success: false, error: `Cache entry not found for key '${cacheKey}'` };
            }
            return { success: true, entry };
          }

          const entries = this.supervisor.listCacheEntries().map((e: AudioCacheEntry) => ({
            cacheKey: e.cacheKey,
            originalPathOrUrl: e.originalPathOrUrl,
            containerId: e.containerId,
            extension: e.extension,
            mimeType: e.mimeType,
            sizeBytes: e.sizeBytes,
            timestamp: e.timestamp,
          }));

          return {
            success: true,
            totalEntries: entries.length,
            entries,
          };
        },
      },
      {
        name: "audio_get_container_metrics",
        description:
          "Retrieves aggregate audio container sniffing, format repair, and cache storage telemetry.",
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
