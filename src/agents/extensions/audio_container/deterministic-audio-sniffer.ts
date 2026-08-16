/**
 * deterministic-audio-sniffer.ts
 *
 * Deterministic magic-byte audio/AV container sniffer, RIFF form-type parser,
 * ISO ftyp brand splitter, 0xFF 0xFx sync word disambiguator, and extension repairer
 * (Phase 114 / ADR-090 / Target #47).
 */

import {
  type AudioContainerId,
  type AudioSniffResult,
  CONTAINER_TO_EXT,
  CONTAINER_TO_MIME,
} from "../../../core/contracts/audio-container.contracts.js";

export class DeterministicAudioSniffer {
  private static readonly OGG_HEADER = Buffer.from("OggS", "utf8");
  private static readonly FLAC_HEADER = Buffer.from("fLaC", "utf8");
  private static readonly RIFF_HEADER = Buffer.from("RIFF", "utf8");
  private static readonly WAVE_HEADER = Buffer.from("WAVE", "utf8");
  private static readonly ID3_HEADER = Buffer.from("ID3", "utf8");
  private static readonly FTYP_HEADER = Buffer.from("ftyp", "utf8");
  private static readonly WEBM_HEADER = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

  private static readonly MP4_AUDIO_BRANDS = ["m4a ", "m4b "];

  /**
   * Sniff raw binary buffer to determine container ID from magic bytes.
   * Returns undefined if unrecognized or image (e.g. RIFF/WEBP).
   */
  public sniffContainer(data: Uint8Array | Buffer): AudioContainerId | undefined {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const len = buf.length;

    // 1. ISO Base Media File Format (ftyp box)
    if (len >= 8 && buf.subarray(4, 8).equals(DeterministicAudioSniffer.FTYP_HEADER)) {
      if (len >= 12) {
        const brand = buf.subarray(8, 12).toString("utf8").toLowerCase();
        if (DeterministicAudioSniffer.MP4_AUDIO_BRANDS.includes(brand)) {
          return "m4a";
        }
      }
      return "mp4";
    }

    // 2. Ogg Container (OggS)
    if (len >= 4 && buf.subarray(0, 4).equals(DeterministicAudioSniffer.OGG_HEADER)) {
      return "ogg";
    }

    // 3. FLAC (fLaC)
    if (len >= 4 && buf.subarray(0, 4).equals(DeterministicAudioSniffer.FLAC_HEADER)) {
      return "flac";
    }

    // 4. RIFF/WAVE (Distinguish from RIFF/WEBP images)
    if (
      len >= 12 &&
      buf.subarray(0, 4).equals(DeterministicAudioSniffer.RIFF_HEADER) &&
      buf.subarray(8, 12).equals(DeterministicAudioSniffer.WAVE_HEADER)
    ) {
      return "wav";
    }

    // 5. MP3 with ID3 Tag Header (ID3)
    if (len >= 3 && buf.subarray(0, 3).equals(DeterministicAudioSniffer.ID3_HEADER)) {
      return "mp3";
    }

    // 6. 0xFF 0xFx Sync Word (Disambiguate MP3 Frame vs ADTS AAC)
    if (len >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
      // ADTS AAC has ID=0 (MPEG-4) or ID=1 (MPEG-2) with layer=00 (mask 0xF6 == 0xF0)
      if ((buf[1] & 0xf6) === 0xf0) {
        return "aac";
      }
      return "mp3";
    }

    // 7. Matroska / WebM Container (\x1a\x45\xdf\xa3)
    if (len >= 4 && buf.subarray(0, 4).equals(DeterministicAudioSniffer.WEBM_HEADER)) {
      return "webm";
    }

    return undefined;
  }

  /**
   * Sniff and return canonical extension, mapping mp4 to .m4a in audio contexts.
   */
  public sniffAudioExt(data: Uint8Array | Buffer, fallbackExt = ".ogg"): string {
    const fallback = fallbackExt.startsWith(".") ? fallbackExt : `.${fallbackExt}`;
    const container = this.sniffContainer(data);
    if (!container) {
      return fallback;
    }
    if (container === "mp4") {
      return ".m4a";
    }
    return CONTAINER_TO_EXT[container];
  }

  /**
   * Perform comprehensive sniff and extension reconciliation.
   */
  public sniffAndRepair(
    data: Uint8Array | Buffer,
    claimedPathOrExt?: string
  ): AudioSniffResult {
    const container = this.sniffContainer(data);
    const claimedNormalized = claimedPathOrExt
      ? this.extractExtension(claimedPathOrExt)
      : undefined;

    if (!container) {
      const fallbackExt = claimedNormalized ?? ".ogg";
      return {
        containerId: undefined,
        canonicalExtension: fallbackExt,
        mimeType: undefined,
        recognized: false,
        repairedExtension: undefined,
        isRepaired: false,
        confidence: 0,
      };
    }

    let canonicalExtension = CONTAINER_TO_EXT[container];
    if (container === "mp4" && claimedNormalized && claimedNormalized !== ".mp4") {
      canonicalExtension = ".m4a";
    }

    const mimeType = CONTAINER_TO_MIME[container];
    const isRepaired = Boolean(claimedNormalized && claimedNormalized !== canonicalExtension);
    const repairedExtension = isRepaired ? canonicalExtension : undefined;

    return {
      containerId: container,
      canonicalExtension,
      mimeType,
      recognized: true,
      repairedExtension,
      isRepaired,
      confidence: 1.0,
    };
  }

  /**
   * Repair filename with proper extension based on binary sniff.
   */
  public repairFilename(data: Uint8Array | Buffer, filename: string): string {
    const result = this.sniffAndRepair(data, filename);
    if (!result.recognized || !result.isRepaired) {
      return filename;
    }

    const dotIndex = filename.lastIndexOf(".");
    const base = dotIndex >= 0 ? filename.slice(0, dotIndex) : filename;
    return `${base}${result.canonicalExtension}`;
  }

  private extractExtension(pathOrExt: string): string {
    const dotIndex = pathOrExt.lastIndexOf(".");
    if (dotIndex >= 0) {
      return pathOrExt.slice(dotIndex).toLowerCase();
    }
    return `.${pathOrExt.toLowerCase()}`;
  }
}
