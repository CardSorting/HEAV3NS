/**
 * voice-speech-tool-suite.ts
 *
 * Model tool suite exposing real-time speech-to-text, text-to-speech,
 * voice activity detection, and voice profile governance:
 * - `voice_transcribe`: Transcribes audio data or audio files.
 * - `voice_synthesize`: Synthesizes speech from text.
 * - `voice_list_profiles`: Lists available neural voice profiles.
 * - `voice_detect_activity`: Analyzes audio buffers for speech energy (VAD).
 * - `voice_session_status`: Inspects active voice session status.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { VoiceSpeechSupervisor } from "../../../agents/extensions/voice/voice-speech-supervisor.js";

export class VoiceSpeechToolSuite {
  private readonly supervisor: VoiceSpeechSupervisor;

  constructor(supervisor: VoiceSpeechSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "voice_transcribe",
        description: "Transcribes spoken audio from a file path or raw PCM buffer into text using the speech-to-text pipeline.",
        parameters: {
          filePath: {
            type: "string",
            required: true,
            description: "Path to the audio file (WAV, MP3, OGG, PCM) to transcribe.",
          },
          language: {
            type: "string",
            required: false,
            description: "Optional language code (e.g. 'en', 'es', 'fr', 'de').",
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const filePath = String(args.filePath || "").trim();
          const language = args.language ? String(args.language).trim() : undefined;

          try {
            const result = await this.supervisor.transcribeAudio(filePath, { language }, cwd);
            return {
              success: true,
              filePath,
              transcript: result.text,
              durationSeconds: result.durationSeconds,
              confidence: result.confidence,
              language: result.language,
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        },
      },
      {
        name: "voice_synthesize",
        description: "Synthesizes spoken audio from text using neural text-to-speech (TTS) models and returns the generated WAV audio metadata.",
        parameters: {
          text: {
            type: "string",
            required: true,
            description: "Text message to synthesize into spoken audio.",
          },
          profileId: {
            type: "string",
            required: false,
            description: "Voice profile ID (e.g. 'edge-aria', 'openai-alloy', 'elevenlabs-rachel').",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const text = String(args.text || "").trim();
          const profileId = args.profileId ? String(args.profileId).trim() : undefined;

          try {
            const result = await this.supervisor.synthesizeSpeech(text, { profileId });
            return {
              success: true,
              format: result.format,
              durationSeconds: result.durationSeconds,
              sampleRate: result.sampleRate,
              byteLength: result.byteLength,
              profileId: profileId ?? "edge-aria",
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        },
      },
      {
        name: "voice_list_profiles",
        description: "Returns a list of all configured neural voice profiles, languages, and providers (Edge, OpenAI, ElevenLabs, Groq, Mistral).",
        parameters: {},
        execute: async () => {
          const profiles = this.supervisor.listProfiles();
          return {
            success: true,
            totalProfiles: profiles.length,
            profiles: profiles.map((p) => ({
              id: p.id,
              name: p.name,
              provider: p.provider,
              language: p.language,
              gender: p.gender,
              sampleRate: p.sampleRate,
            })),
          };
        },
      },
      {
        name: "voice_detect_activity",
        description: "Analyzes audio waveform energy (RMS) to determine whether human speech is active (Voice Activity Detection / VAD).",
        parameters: {
          audioBase64: {
            type: "string",
            required: true,
            description: "Base64-encoded PCM or WAV audio data.",
          },
          thresholdDb: {
            type: "number",
            required: false,
            description: "VAD threshold in dBFS (default: -35 dBFS).",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const base64 = String(args.audioBase64 || "");
          const thresholdDb = args.thresholdDb !== undefined ? Number(args.thresholdDb) : -35.0;
          const buffer = Buffer.from(base64, "base64");
          const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

          const vad = this.supervisor.detectVad(uint8, thresholdDb);
          return {
            success: true,
            isSpeech: vad.isSpeech,
            energyRms: vad.energyRms,
            dbFs: vad.dbFs,
            threshold: vad.threshold,
          };
        },
      },
      {
        name: "voice_session_status",
        description: "Queries the current state of a voice session, including recording/playback status, buffer capacity, and transcript history.",
        parameters: {
          sessionId: {
            type: "string",
            required: true,
            description: "The unique identifier of the voice session.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const sessionId = String(args.sessionId || "").trim();
          const state = this.supervisor.getSessionStatus(sessionId);

          return {
            success: true,
            sessionId: state.sessionId,
            activeVoice: state.activeVoice,
            isRecording: state.isRecording,
            isPlaying: state.isPlaying,
            bufferedAudioBytes: state.bufferedAudioBytes,
            totalTranscripts: state.transcriptHistory.length,
            transcriptHistory: state.transcriptHistory,
          };
        },
      },
    ];
  }
}
