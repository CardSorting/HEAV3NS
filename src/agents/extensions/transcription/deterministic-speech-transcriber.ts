/**
 * deterministic-speech-transcriber.ts
 *
 * Pure TypeScript Speech-to-Text Parser, Audio Hash Generator, Timestamp Aligner
 * & Speaker Diarization Engine (Phase 124 / ADR-100 / Target #57).
 */

import { createHash } from "node:crypto";
import type {
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionSegment,
  WordTimestamp,
} from "../../../core/contracts/transcription.contracts.js";

export class DeterministicSpeechTranscriber {
  private static readonly SUPPORTED_EXTENSIONS = new Set([
    "mp3",
    "mp4",
    "mpeg",
    "mpga",
    "m4a",
    "wav",
    "webm",
    "ogg",
    "aac",
    "flac",
  ]);

  /**
   * Validates if the file path or MIME type has a supported audio extension.
   */
  public isSupportedAudio(filenameOrPath: string): boolean {
    if (!filenameOrPath) return false;
    const clean = filenameOrPath.toLowerCase().split("?")[0].split("#")[0];
    const parts = clean.split(".");
    if (parts.length < 2) return false;
    const ext = parts[parts.length - 1];
    return DeterministicSpeechTranscriber.SUPPORTED_EXTENSIONS.has(ext);
  }

  /**
   * Computes SHA-256 fingerprint for audio buffer or path.
   */
  public computeAudioHash(data: Uint8Array | Buffer | string): string {
    const hasher = createHash("sha256");
    if (typeof data === "string") {
      hasher.update(Buffer.from(data, "utf-8"));
    } else {
      hasher.update(data);
    }
    return hasher.digest("hex");
  }

  /**
   * Synthesizes word timestamps and segment boundaries deterministically from raw transcript text.
   */
  public alignSegments(
    rawText: string,
    durationMs: number,
    speaker = "speaker_0"
  ): readonly TranscriptionSegment[] {
    const trimmed = rawText.trim();
    if (!trimmed) return [];

    // Split sentences or punctuation-delimited phrases
    const sentences = trimmed
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (sentences.length === 0) return [];

    const totalChars = sentences.reduce((sum, s) => sum + s.length, 0);
    const msPerChar = totalChars > 0 ? durationMs / totalChars : durationMs;

    let currentStartMs = 0;
    const segments: TranscriptionSegment[] = [];

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const segmentDuration = Math.max(200, Math.round(sentence.length * msPerChar));
      const segmentEndMs = Math.min(durationMs, currentStartMs + segmentDuration);

      // Generate word timestamps
      const words = sentence.split(/\s+/).filter(Boolean);
      const wordMs = words.length > 0 ? (segmentEndMs - currentStartMs) / words.length : 0;
      const wordTimestamps: WordTimestamp[] = [];

      let wordStart = currentStartMs;
      for (const w of words) {
        const wordEnd = Math.round(wordStart + wordMs);
        wordTimestamps.push({
          word: w,
          startMs: Math.round(wordStart),
          endMs: wordEnd,
          confidence: 0.98,
        });
        wordStart = wordEnd;
      }

      segments.push({
        id: `seg_${i + 1}`,
        startMs: Math.round(currentStartMs),
        endMs: Math.round(segmentEndMs),
        text: sentence,
        speaker,
        confidence: 0.95,
        words: wordTimestamps,
      });

      currentStartMs = segmentEndMs;
    }

    return segments;
  }

  /**
   * Simulates/executes deterministic transcription against the specified provider.
   */
  public synthesizeTranscription(
    provider: TranscriptionProvider,
    audioHash: string,
    rawText: string,
    durationMs = 5000,
    language = "en"
  ): TranscriptionResult {
    const segments = this.alignSegments(rawText, durationMs, "speaker_0");

    return {
      success: true,
      transcript: rawText.trim(),
      language,
      durationMs,
      segments,
      provider,
      cached: false,
      audioHash,
    };
  }

  /**
   * Partitions segments across alternating speakers for diarization analysis.
   */
  public diarizeSegments(
    segments: readonly TranscriptionSegment[],
    speakerCount = 2
  ): readonly TranscriptionSegment[] {
    return segments.map((seg, idx) => ({
      ...seg,
      speaker: `speaker_${idx % speakerCount}`,
    }));
  }
}
