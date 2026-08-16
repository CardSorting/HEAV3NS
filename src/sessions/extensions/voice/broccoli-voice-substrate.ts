/**
 * broccoli-voice-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate for real-time audio chunk ring buffering,
 * voice session state management, and profile registries.
 */

import type {
  AudioChunk,
  VoiceProfile,
  VoiceSessionState,
  VoiceWorkspaceSnapshot,
} from "../../../core/contracts/voice.contracts.js";

export class BroccoliVoiceSubstrate {
  private readonly sessions = new Map<string, VoiceSessionState>();
  private readonly profiles = new Map<string, VoiceProfile>();
  private readonly audioRingBuffers = new Map<string, AudioChunk[]>();
  private readonly maxChunksPerSession: number;

  constructor(maxChunksPerSession = 128) {
    this.maxChunksPerSession = maxChunksPerSession;
    this.initDefaultProfiles();
  }

  private initDefaultProfiles(): void {
    const defaults: VoiceProfile[] = [
      { id: "edge-aria", name: "Aria (Neural)", provider: "edge", language: "en-US", gender: "female", sampleRate: 24000 },
      { id: "edge-guy", name: "Guy (Neural)", provider: "edge", language: "en-US", gender: "male", sampleRate: 24000 },
      { id: "openai-alloy", name: "Alloy", provider: "openai", language: "en-US", gender: "neutral", sampleRate: 24000 },
      { id: "openai-echo", name: "Echo", provider: "openai", language: "en-US", gender: "male", sampleRate: 24000 },
      { id: "elevenlabs-rachel", name: "Rachel", provider: "elevenlabs", language: "en-US", gender: "female", sampleRate: 44100 },
      { id: "groq-whisper", name: "Groq Whisper", provider: "groq", language: "en", sampleRate: 16000 },
      { id: "mistral-voxtral", name: "Mistral Voxtral", provider: "mistral", language: "en", sampleRate: 24000 },
    ];

    for (const p of defaults) {
      this.profiles.set(p.id, p);
    }
  }

  public getOrCreateSession(sessionId: string): VoiceSessionState {
    let session = this.sessions.get(sessionId);
    if (!session) {
      const defaultVoice = this.profiles.get("edge-aria")!;
      session = {
        sessionId,
        activeVoice: defaultVoice,
        isRecording: false,
        isPlaying: false,
        bufferedAudioBytes: 0,
        transcriptHistory: [],
        lastUpdated: Date.now(),
      };
      this.sessions.set(sessionId, session);
      this.audioRingBuffers.set(sessionId, []);
    }
    return session;
  }

  public setRecordingState(sessionId: string, isRecording: boolean): void {
    const session = this.getOrCreateSession(sessionId);
    this.sessions.set(sessionId, {
      ...session,
      isRecording,
      lastUpdated: Date.now(),
    });
  }

  public setPlayingState(sessionId: string, isPlaying: boolean): void {
    const session = this.getOrCreateSession(sessionId);
    this.sessions.set(sessionId, {
      ...session,
      isPlaying,
      lastUpdated: Date.now(),
    });
  }

  public setActiveProfile(sessionId: string, profileId: string): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    const session = this.getOrCreateSession(sessionId);
    this.sessions.set(sessionId, {
      ...session,
      activeVoice: profile,
      lastUpdated: Date.now(),
    });
    return true;
  }

  public pushAudioChunk(sessionId: string, data: Uint8Array, isFinal = false): void {
    this.getOrCreateSession(sessionId);
    let buffer = this.audioRingBuffers.get(sessionId);
    if (!buffer) {
      buffer = [];
      this.audioRingBuffers.set(sessionId, buffer);
    }

    const chunkIndex = buffer.length;
    const chunk: AudioChunk = {
      chunkIndex,
      data,
      timestamp: Date.now(),
      isFinal,
    };

    buffer.push(chunk);
    if (buffer.length > this.maxChunksPerSession) {
      buffer.shift();
    }

    const totalBytes = buffer.reduce((acc, c) => acc + c.data.byteLength, 0);
    const session = this.sessions.get(sessionId)!;
    this.sessions.set(sessionId, {
      ...session,
      bufferedAudioBytes: totalBytes,
      lastUpdated: Date.now(),
    });
  }

  public drainAudioBuffer(sessionId: string): Uint8Array {
    const buffer = this.audioRingBuffers.get(sessionId) || [];
    const totalBytes = buffer.reduce((acc, c) => acc + c.data.byteLength, 0);
    const combined = new Uint8Array(totalBytes);

    let offset = 0;
    for (const chunk of buffer) {
      combined.set(chunk.data, offset);
      offset += chunk.data.byteLength;
    }

    this.audioRingBuffers.set(sessionId, []);
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.set(sessionId, {
        ...session,
        bufferedAudioBytes: 0,
        lastUpdated: Date.now(),
      });
    }

    return combined;
  }

  public appendTranscript(sessionId: string, text: string): void {
    const session = this.getOrCreateSession(sessionId);
    this.sessions.set(sessionId, {
      ...session,
      transcriptHistory: [...session.transcriptHistory, text],
      lastUpdated: Date.now(),
    });
  }

  public listProfiles(): readonly VoiceProfile[] {
    return Array.from(this.profiles.values());
  }

  public registerProfile(profile: VoiceProfile): void {
    this.profiles.set(profile.id, profile);
  }

  public captureSnapshot(): VoiceWorkspaceSnapshot {
    return {
      activeSessions: Array.from(this.sessions.values()).map((s) => ({
        ...s,
        transcriptHistory: [...s.transcriptHistory],
      })),
      registeredVoices: Array.from(this.profiles.values()),
      totalTranscripts: Array.from(this.sessions.values()).reduce(
        (acc, s) => acc + s.transcriptHistory.length,
        0
      ),
      timestamp: Date.now(),
    };
  }

  public restoreSnapshot(snapshot: VoiceWorkspaceSnapshot): void {
    this.sessions.clear();
    this.audioRingBuffers.clear();
    for (const s of snapshot.activeSessions) {
      this.sessions.set(s.sessionId, {
        ...s,
        transcriptHistory: [...s.transcriptHistory],
      });
      this.audioRingBuffers.set(s.sessionId, []);
    }

    for (const p of snapshot.registeredVoices) {
      this.profiles.set(p.id, p);
    }
  }

  public clear(): void {
    this.sessions.clear();
    this.audioRingBuffers.clear();
    this.initDefaultProfiles();
  }
}
