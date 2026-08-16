/**
 * media-source-tool-suite.ts
 *
 * Model tool definitions exposing Unified Media Source Resolution to agents
 * (Phase 122 / ADR-098 / Target #55).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { MediaSourceSupervisor } from "../../../agents/extensions/media_source/media-source-supervisor.js";

export class MediaSourceToolSuite {
  private readonly supervisor: MediaSourceSupervisor;

  constructor(supervisor: MediaSourceSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "media_source_resolve",
        description:
          "Resolves a media URI (data: URL, file path, web link) into verified bytes, MIME, and dimensions.",
        parameters: {
          uri: {
            type: "string",
            description: "The media URI or Data URL to resolve.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const uri = typeof args.uri === "string" ? args.uri : "";
          if (!uri) {
            return { success: false, error: "uri is required" };
          }
          try {
            const resolved = await this.supervisor.resolve(uri);
            return {
              success: true,
              mime: resolved.mime,
              kind: resolved.kind,
              origin: resolved.origin,
              sizeBytes: resolved.sizeBytes,
              width: resolved.width,
              height: resolved.height,
              sha256: resolved.sha256,
            };
          } catch (err: any) {
            return { success: false, error: err.message || String(err) };
          }
        },
      },
      {
        name: "media_source_inspect_magic",
        description:
          "Inspects binary magic bytes and returns genuine MIME type and MediaKind (image, video, etc.).",
        parameters: {
          base64: {
            type: "string",
            description: "Base64 encoded binary payload to inspect.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const base64Str = typeof args.base64 === "string" ? args.base64 : "";
          if (!base64Str) {
            return { success: false, error: "base64 is required" };
          }
          const buf = Buffer.from(base64Str, "base64");
          const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
          const { mime, kind } = this.supervisor.sniffMagicBytes(bytes);
          return {
            success: true,
            mime,
            kind,
            sizeBytes: bytes.length,
          };
        },
      },
      {
        name: "media_source_extract_dimensions",
        description:
          "Extracts width and height dimensions directly from image binary headers.",
        parameters: {
          base64: {
            type: "string",
            description: "Base64 encoded image binary to inspect.",
            required: true,
          },
          mime: {
            type: "string",
            description: "Expected MIME type (e.g. 'image/png', 'image/jpeg', 'image/gif').",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const base64Str = typeof args.base64 === "string" ? args.base64 : "";
          if (!base64Str) {
            return { success: false, error: "base64 is required" };
          }
          const buf = Buffer.from(base64Str, "base64");
          const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
          let mime = typeof args.mime === "string" ? args.mime : "";
          if (!mime) {
            mime = this.supervisor.sniffMagicBytes(bytes).mime;
          }
          const dimensions = this.supervisor.extractDimensions(bytes, mime);
          return {
            success: true,
            mime,
            width: dimensions.width,
            height: dimensions.height,
          };
        },
      },
      {
        name: "media_source_to_data_url",
        description:
          "Encodes raw base64 media into an RFC 2397 Data URL.",
        parameters: {
          base64: {
            type: "string",
            description: "Base64 encoded binary payload.",
            required: true,
          },
          mime: {
            type: "string",
            description: "MIME type (e.g. 'image/png').",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const base64Str = typeof args.base64 === "string" ? args.base64 : "";
          if (!base64Str) {
            return { success: false, error: "base64 is required" };
          }
          const buf = Buffer.from(base64Str, "base64");
          const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
          let mime = typeof args.mime === "string" ? args.mime : "";
          if (!mime) {
            mime = this.supervisor.sniffMagicBytes(bytes).mime;
          }
          const dataUrl = this.supervisor.toDataUrl(bytes, mime);
          return {
            success: true,
            dataUrl,
            mime,
            sizeBytes: bytes.length,
          };
        },
      },
      {
        name: "media_source_get_metrics",
        description:
          "Retrieves aggregate statistics for media resolution operations, bytes ingested, and MIME counts.",
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
