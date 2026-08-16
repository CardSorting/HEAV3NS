/**
 * deterministic-audio-codec.ts
 *
 * In-memory zero-GC RIFF WAV binary encoder/decoder, mathematical RMS energy VAD engine,
 * and linear audio resampler/normalizer.
 */

import type {
  AudioSampleRate,
  SpeechSynthesisResult,
  VadDecision,
} from "../../../core/contracts/voice.contracts.js";

export class DeterministicAudioCodec {
  /**
   * Encodes raw 16-bit linear PCM byte buffer into a canonical 44-byte RIFF WAV container.
   */
  public encodeWav(
    pcmData: Uint8Array,
    sampleRate: AudioSampleRate = 16000,
    numChannels = 1
  ): Uint8Array {
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmData.byteLength;
    const buffer = new Uint8Array(44 + dataSize);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // RIFF chunk descriptor
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true); // ChunkSize
    this.writeString(view, 8, "WAVE");

    // fmt sub-chunk
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for linear PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data sub-chunk
    this.writeString(view, 36, "data");
    view.setUint32(40, dataSize, true);

    // Copy PCM audio payload
    buffer.set(pcmData, 44);

    return buffer;
  }

  /**
   * Decodes a canonical RIFF WAV container into raw PCM bytes and metadata.
   */
  public decodeWav(wavData: Uint8Array): {
    pcmData: Uint8Array;
    sampleRate: number;
    numChannels: number;
    bitsPerSample: number;
  } {
    if (wavData.byteLength < 44) {
      throw new Error("Invalid WAV data: buffer too small");
    }

    const view = new DataView(wavData.buffer, wavData.byteOffset, wavData.byteLength);
    const riff = this.readString(view, 0, 4);
    const wave = this.readString(view, 8, 4);

    if (riff !== "RIFF" || wave !== "WAVE") {
      throw new Error("Invalid WAV header format");
    }

    const numChannels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);

    // Locate data chunk
    let offset = 12;
    let dataOffset = 44;
    let dataLength = wavData.byteLength - 44;

    while (offset + 8 <= wavData.byteLength) {
      const chunkId = this.readString(view, offset, 4);
      const chunkSize = view.getUint32(offset + 4, true);

      if (chunkId === "data") {
        dataOffset = offset + 8;
        dataLength = Math.min(chunkSize, wavData.byteLength - dataOffset);
        break;
      }
      offset += 8 + chunkSize;
    }

    const pcmData = wavData.subarray(dataOffset, dataOffset + dataLength);

    return {
      pcmData,
      sampleRate,
      numChannels,
      bitsPerSample,
    };
  }

  /**
   * Computes Root-Mean-Square (RMS) signal energy and Voice Activity Detection (VAD) decision.
   */
  public detectVoiceActivity(
    pcmData: Uint8Array,
    thresholdDb = -35.0,
    timestamp = Date.now()
  ): VadDecision {
    if (pcmData.byteLength < 2) {
      return {
        isSpeech: false,
        energyRms: 0,
        dbFs: -100,
        threshold: thresholdDb,
        frameTimestamp: timestamp,
      };
    }

    const view = new DataView(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
    const numSamples = Math.floor(pcmData.byteLength / 2);
    let sumSquares = 0;

    for (let i = 0; i < numSamples; i++) {
      const sample = view.getInt16(i * 2, true);
      const normalized = sample / 32768.0;
      sumSquares += normalized * normalized;
    }

    const energyRms = Math.sqrt(sumSquares / numSamples);
    // dBFS = 20 * log10(RMS)
    const dbFs = energyRms > 0.000001 ? 20 * Math.log10(energyRms) : -100;
    const isSpeech = dbFs >= thresholdDb;

    return {
      isSpeech,
      energyRms,
      dbFs,
      threshold: thresholdDb,
      frameTimestamp: timestamp,
    };
  }

  /**
   * Resamples 16-bit mono linear PCM from sourceRate to targetRate using linear interpolation.
   */
  public resamplePcm(
    pcmData: Uint8Array,
    sourceRate: number,
    targetRate: number
  ): Uint8Array {
    if (sourceRate === targetRate || pcmData.byteLength < 2) {
      return pcmData;
    }

    const srcSamplesCount = Math.floor(pcmData.byteLength / 2);
    const srcView = new DataView(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
    const ratio = targetRate / sourceRate;
    const dstSamplesCount = Math.floor(srcSamplesCount * ratio);

    const dstBuffer = new Uint8Array(dstSamplesCount * 2);
    const dstView = new DataView(dstBuffer.buffer, dstBuffer.byteOffset, dstBuffer.byteLength);

    for (let i = 0; i < dstSamplesCount; i++) {
      const srcPos = i / ratio;
      const srcIdx = Math.floor(srcPos);
      const frac = srcPos - srcIdx;

      const s0 = srcView.getInt16(srcIdx * 2, true);
      const s1 = srcIdx + 1 < srcSamplesCount ? srcView.getInt16((srcIdx + 1) * 2, true) : s0;

      const interpolated = Math.round(s0 + frac * (s1 - s0));
      dstView.setInt16(i * 2, Math.max(-32768, Math.min(32767, interpolated)), true);
    }

    return dstBuffer;
  }

  /**
   * Generates a deterministic synthesized 16-bit PCM sine wave tone for verification and simulation.
   */
  public generateSineTone(
    frequencyHz: number,
    durationSeconds: number,
    sampleRate: AudioSampleRate = 16000,
    amplitude = 0.5
  ): SpeechSynthesisResult {
    const numSamples = Math.floor(sampleRate * durationSeconds);
    const pcmData = new Uint8Array(numSamples * 2);
    const view = new DataView(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const sampleValue = Math.sin(2 * Math.PI * frequencyHz * t) * amplitude;
      const int16Val = Math.round(sampleValue * 32767);
      view.setInt16(i * 2, Math.max(-32768, Math.min(32767, int16Val)), true);
    }

    const wavData = this.encodeWav(pcmData, sampleRate, 1);

    return {
      audioData: wavData,
      format: "wav",
      durationSeconds,
      sampleRate,
      byteLength: wavData.byteLength,
    };
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  private readString(view: DataView, offset: number, length: number): string {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(view.getUint8(offset + i));
    }
    return result;
  }
}
