/**
 * deterministic-media-resolver.ts
 *
 * Pure TypeScript Multi-Scheme URI Resolver, Magic-Byte MIME Sniffer,
 * Header Dimension Extractor & RFC 2397 Data-URL Synthesizer
 * (Phase 122 / ADR-098 / Target #55).
 */

import { createHash } from "node:crypto";
import type {
  MediaKind,
  ResolvedMedia,
} from "../../../core/contracts/media-source.contracts.js";

export class DeterministicMediaResolver {
  /**
   * Sniffs magic bytes from the binary payload to determine genuine MIME type and MediaKind.
   */
  public sniffMagicBytes(bytes: Uint8Array): { mime: string; kind: MediaKind } {
    if (!bytes || bytes.length < 4) {
      return { mime: "application/octet-stream", kind: "unknown" };
    }

    // 1. PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return { mime: "image/png", kind: "image" };
    }

    // 2. JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { mime: "image/jpeg", kind: "image" };
    }

    // 3. GIF: GIF87a or GIF89a (47 49 46 38 37/39 61)
    if (
      bytes.length >= 6 &&
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38 &&
      (bytes[4] === 0x37 || bytes[4] === 0x39) &&
      bytes[5] === 0x61
    ) {
      return { mime: "image/gif", kind: "image" };
    }

    // 4. WebP: RIFF (bytes 0..3) ... WEBP (bytes 8..11)
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return { mime: "image/webp", kind: "image" };
    }

    // 5. BMP: 'BM' (42 4D)
    if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
      return { mime: "image/bmp", kind: "image" };
    }

    // 6. TIFF: 'II*\0' (49 49 2A 00) or 'MM\0*' (4D 4D 00 2A)
    if (
      (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
    ) {
      return { mime: "image/tiff", kind: "image" };
    }

    // 7. WebM / Matroska: 1A 45 DF A3
    if (
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    ) {
      return { mime: "video/webm", kind: "video" };
    }

    // 8. MP4 / MOV: '....ftyp' (bytes 4..7: 66 74 79 70)
    if (
      bytes.length >= 12 &&
      bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70
    ) {
      return { mime: "video/mp4", kind: "video" };
    }

    // 9. SVG text detection
    const textSnippet = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 512))).trim().toLowerCase();
    if (textSnippet.startsWith("<svg") || (textSnippet.startsWith("<?xml") && textSnippet.includes("<svg"))) {
      return { mime: "image/svg+xml", kind: "image" };
    }

    return { mime: "application/octet-stream", kind: "unknown" };
  }

  /**
   * Extracts width and height from binary headers without rendering.
   */
  public extractDimensions(
    bytes: Uint8Array,
    mime: string
  ): { width?: number; height?: number } {
    if (!bytes || bytes.length < 10) return {};

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    try {
      // PNG (bytes 16..24)
      if (mime === "image/png" && bytes.length >= 24) {
        const width = view.getUint32(16, false); // Big endian
        const height = view.getUint32(20, false);
        return { width, height };
      }

      // GIF (bytes 6..10)
      if (mime === "image/gif" && bytes.length >= 10) {
        const width = view.getUint16(6, true); // Little endian
        const height = view.getUint16(8, true);
        return { width, height };
      }

      // BMP (bytes 18..26)
      if (mime === "image/bmp" && bytes.length >= 26) {
        const width = view.getInt32(18, true); // Little endian
        const height = Math.abs(view.getInt32(22, true));
        return { width, height };
      }

      // WebP VP8 / VP8L / VP8X
      if (mime === "image/webp" && bytes.length >= 30) {
        const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
        if (chunkType === "VP8 " && bytes.length >= 30) {
          const width = (view.getUint16(26, true) & 0x3fff);
          const height = (view.getUint16(28, true) & 0x3fff);
          return { width, height };
        } else if (chunkType === "VP8L" && bytes.length >= 25) {
          const b0 = bytes[21];
          const b1 = bytes[22];
          const b2 = bytes[23];
          const b3 = bytes[24];
          const width = 1 + (((b1 & 0x3f) << 8) | b0);
          const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
          return { width, height };
        } else if (chunkType === "VP8X" && bytes.length >= 30) {
          const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
          const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
          return { width, height };
        }
      }

      // JPEG SOF scan
      if (mime === "image/jpeg") {
        let offset = 2;
        while (offset < bytes.length - 8) {
          if (bytes[offset] !== 0xff) {
            offset++;
            continue;
          }
          const marker = bytes[offset + 1];
          // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
          if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
            const height = view.getUint16(offset + 5, false); // Big endian
            const width = view.getUint16(offset + 7, false);
            return { width, height };
          }
          const length = view.getUint16(offset + 2, false);
          offset += 2 + length;
        }
      }
    } catch {
      // Fallback on corrupt header
    }

    return {};
  }

  /**
   * Computes SHA-256 hex string for binary payload.
   */
  public computeSha256(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex");
  }

  /**
   * Resolves an RFC 2397 Data URL into raw bytes, MIME, and dimensions.
   */
  public resolveDataUrl(dataUrl: string): ResolvedMedia {
    if (!dataUrl.startsWith("data:")) {
      throw new Error("Invalid data URL: must begin with 'data:'");
    }

    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex === -1) {
      throw new Error("Invalid data URL: missing data payload separator");
    }

    const header = dataUrl.slice(5, commaIndex);
    const rawPayload = dataUrl.slice(commaIndex + 1);

    const isBase64 = header.endsWith(";base64") || header.includes(";base64;");
    const mimeFromHeader = header.replace(/;base64.*$/, "").trim() || "text/plain";

    let data: Uint8Array;
    if (isBase64) {
      const buffer = Buffer.from(rawPayload, "base64");
      data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else {
      const decoded = decodeURIComponent(rawPayload);
      data = new TextEncoder().encode(decoded);
    }

    const { mime: sniffedMime, kind } = this.sniffMagicBytes(data);
    const mime = sniffedMime !== "application/octet-stream" ? sniffedMime : mimeFromHeader;
    const { width, height } = this.extractDimensions(data, mime);
    const sha256 = this.computeSha256(data);

    return {
      data,
      mime,
      kind,
      origin: "data",
      sizeBytes: data.length,
      width,
      height,
      sha256,
    };
  }

  /**
   * Encodes raw binary media into an RFC 2397 Data URL.
   */
  public toDataUrl(bytes: Uint8Array, mime: string): string {
    const base64 = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
    return `data:${mime};base64,${base64}`;
  }
}
