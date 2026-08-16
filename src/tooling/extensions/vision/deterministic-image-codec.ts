/**
 * deterministic-image-codec.ts
 *
 * High-performance zero-GC in-memory binary image header decoder,
 * aspect ratio calculator, and synthetic image generator.
 */

import type {
  ImageDimensions,
  ImageFormat,
  ImageMetadata,
} from "../../../core/contracts/vision.contracts.js";

export class DeterministicImageCodec {
  /**
   * Decodes image format and dimensions directly from raw binary bytes.
   */
  public decodeImageMetadata(data: Uint8Array): ImageMetadata {
    if (data.byteLength < 8) {
      throw new Error("Invalid image data: buffer too small to contain valid header");
    }

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    // 1. Check PNG (Magic: 89 50 4E 47 0D 0A 1A 0A)
    if (
      data[0] === 0x89 &&
      data[1] === 0x50 &&
      data[2] === 0x4e &&
      data[3] === 0x47 &&
      data[4] === 0x0d &&
      data[5] === 0x0a &&
      data[6] === 0x1a &&
      data[7] === 0x0a
    ) {
      if (data.byteLength < 24) {
        throw new Error("Invalid PNG: truncated IHDR chunk");
      }
      const width = view.getUint32(16, false); // big-endian
      const height = view.getUint32(20, false); // big-endian
      const colorDepth = data[24] ?? 8;

      return {
        format: "png",
        dimensions: {
          width,
          height,
          aspectRatio: this.calculateAspectRatio(width, height),
        },
        byteLength: data.byteLength,
        mimeType: "image/png",
        colorDepth,
      };
    }

    // 2. Check JPEG (Magic: FF D8 FF)
    if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
      let offset = 2;
      let width = 0;
      let height = 0;

      while (offset + 4 < data.byteLength) {
        if (data[offset] !== 0xff) break;
        const marker = data[offset + 1];
        const length = view.getUint16(offset + 2, false);

        // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          height = view.getUint16(offset + 5, false);
          width = view.getUint16(offset + 7, false);
          break;
        }

        offset += 2 + length;
      }

      if (width === 0 || height === 0) {
        width = 800;
        height = 600;
      }

      return {
        format: "jpeg",
        dimensions: {
          width,
          height,
          aspectRatio: this.calculateAspectRatio(width, height),
        },
        byteLength: data.byteLength,
        mimeType: "image/jpeg",
        colorDepth: 24,
      };
    }

    // 3. Check GIF (Magic: GIF87a or GIF89a)
    if (
      data[0] === 0x47 &&
      data[1] === 0x49 &&
      data[2] === 0x46 &&
      data[3] === 0x38 &&
      (data[4] === 0x37 || data[4] === 0x39) &&
      data[5] === 0x61
    ) {
      const width = view.getUint16(6, true); // little-endian
      const height = view.getUint16(8, true); // little-endian

      return {
        format: "gif",
        dimensions: {
          width,
          height,
          aspectRatio: this.calculateAspectRatio(width, height),
        },
        byteLength: data.byteLength,
        mimeType: "image/gif",
        colorDepth: 8,
      };
    }

    // 4. Check WebP (Magic: RIFF....WEBP)
    if (
      data[0] === 0x52 &&
      data[1] === 0x49 &&
      data[2] === 0x46 &&
      data[3] === 0x46 &&
      data[8] === 0x57 &&
      data[9] === 0x45 &&
      data[10] === 0x42 &&
      data[11] === 0x50
    ) {
      let width = 512;
      let height = 512;

      // VP8 (lossy)
      if (data[12] === 0x56 && data[13] === 0x50 && data[14] === 0x38 && data[15] === 0x20) {
        width = view.getUint16(26, true) & 0x3fff;
        height = view.getUint16(28, true) & 0x3fff;
      }
      // VP8L (lossless)
      else if (data[12] === 0x56 && data[13] === 0x50 && data[14] === 0x38 && data[15] === 0x4c) {
        const b0 = data[21];
        const b1 = data[22];
        const b2 = data[23];
        const b3 = data[24];
        width = 1 + (((b1 & 0x3f) << 8) | b0);
        height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      }

      return {
        format: "webp",
        dimensions: {
          width,
          height,
          aspectRatio: this.calculateAspectRatio(width, height),
        },
        byteLength: data.byteLength,
        mimeType: "image/webp",
      };
    }

    // 5. Check BMP (Magic: BM)
    if (data[0] === 0x42 && data[1] === 0x4d) {
      const width = view.getInt32(18, true);
      const height = Math.abs(view.getInt32(22, true));

      return {
        format: "bmp",
        dimensions: {
          width: width > 0 ? width : 100,
          height: height > 0 ? height : 100,
          aspectRatio: this.calculateAspectRatio(width > 0 ? width : 100, height > 0 ? height : 100),
        },
        byteLength: data.byteLength,
        mimeType: "image/bmp",
        colorDepth: view.getUint16(28, true),
      };
    }

    // 6. Check SVG (Textual <svg)
    const textStart = new TextDecoder().decode(data.subarray(0, Math.min(256, data.byteLength)));
    if (textStart.includes("<svg") || textStart.includes("<?xml")) {
      const widthMatch = textStart.match(/width=["'](\d+)["']/);
      const heightMatch = textStart.match(/height=["'](\d+)["']/);
      const width = widthMatch ? parseInt(widthMatch[1], 10) : 800;
      const height = heightMatch ? parseInt(heightMatch[1], 10) : 600;

      return {
        format: "svg",
        dimensions: {
          width,
          height,
          aspectRatio: this.calculateAspectRatio(width, height),
        },
        byteLength: data.byteLength,
        mimeType: "image/svg+xml",
      };
    }

    throw new Error("Unsupported image format or unrecognized binary header");
  }

  /**
   * Computes simplified aspect ratio using GCD.
   */
  public calculateAspectRatio(width: number, height: number): string {
    if (width <= 0 || height <= 0) return "1:1";
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    const rW = width / divisor;
    const rH = height / divisor;

    // Common standard aspect ratio approximations
    const ratio = width / height;
    if (Math.abs(ratio - 16 / 9) < 0.02) return "16:9";
    if (Math.abs(ratio - 9 / 16) < 0.02) return "9:16";
    if (Math.abs(ratio - 4 / 3) < 0.02) return "4:3";
    if (Math.abs(ratio - 3 / 4) < 0.02) return "3:4";
    if (Math.abs(ratio - 1.0) < 0.02) return "1:1";
    if (Math.abs(ratio - 21 / 9) < 0.02) return "21:9";

    return `${rW}:${rH}`;
  }

  /**
   * Generates a deterministic in-memory BMP image buffer for testing and mock perception.
   */
  public generateSyntheticBmp(width = 64, height = 64, r = 70, g = 130, b = 180): Uint8Array {
    const rowPadding = (4 - ((width * 3) % 4)) % 4;
    const rowSize = width * 3 + rowPadding;
    const imageSize = rowSize * height;
    const fileSize = 54 + imageSize;

    const buffer = new Uint8Array(fileSize);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // BITMAPFILEHEADER (14 bytes)
    buffer[0] = 0x42; // 'B'
    buffer[1] = 0x4d; // 'M'
    view.setUint32(2, fileSize, true);
    view.setUint32(6, 0, true); // reserved
    view.setUint32(10, 54, true); // offset to pixel data

    // BITMAPINFOHEADER (40 bytes)
    view.setUint32(14, 40, true); // header size
    view.setInt32(18, width, true);
    view.setInt32(22, height, true);
    view.setUint16(26, 1, true); // planes
    view.setUint16(28, 24, true); // 24 bpp (RGB)
    view.setUint32(30, 0, true); // compression (BI_RGB)
    view.setUint32(34, imageSize, true);
    view.setInt32(38, 2835, true); // 72 DPI
    view.setInt32(42, 2835, true); // 72 DPI
    view.setUint32(46, 0, true);
    view.setUint32(50, 0, true);

    // Pixel Data (BGR format)
    let offset = 54;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        buffer[offset++] = b;
        buffer[offset++] = g;
        buffer[offset++] = r;
      }
      for (let p = 0; p < rowPadding; p++) {
        buffer[offset++] = 0;
      }
    }

    return buffer;
  }

  /**
   * Generates a deterministic SVG image string buffer.
   */
  public generateSyntheticSvg(width = 800, height = 600, title = "LUMI Architecture Diagram"): Uint8Array {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#0d1117"/>
  <rect x="50" y="50" width="${width - 100}" height="${height - 100}" rx="12" fill="#161b22" stroke="#30363d" stroke-width="2"/>
  <text x="${width / 2}" y="${height / 2}" fill="#58a6ff" font-family="sans-serif" font-size="24" text-anchor="middle">${title}</text>
</svg>`;

    return new TextEncoder().encode(svg);
  }
}
