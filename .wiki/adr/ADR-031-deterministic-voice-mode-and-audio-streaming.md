# ADR-031: Deterministic Voice Mode, Speech Perception & Real-Time Audio Streaming Substrate

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team & Autonomous Evolution Core
- **Date**: 2026-08-15
- **Technical Story**: Transmuting Hermes Agent's sprawling voice mode, unmanaged thread pools, and shell-subprocess audio engines (`tools/voice_mode.py` [2,380 LOC] + `tools/tts_tool.py` [4,500 LOC] + `tools/transcription_tools.py` [3,326 LOC] + `tools/wake_word.py` [1,400 LOC] + `tools/tts_streaming.py` [500 LOC] + `tools/tts_text_normalize.py` [350 LOC] — totaling **12,000+ LOC, 550+ KB**) into a typed, deterministic, zero-GC **Real-Time Voice Mode, Speech Perception & Audio Streaming Substrate ($\mathcal{K}_{\text{voice}}$ / Phase 79)** for LUMI-JOY via the AKD-DSO Osmosis Paradigm. Replaces unmanaged native thread pools, temporary disk files, and external host audio players (`afplay`, `ffplay`) with in-memory zero-GC RIFF WAV codecs, RMS signal energy VAD, Broccolidb audio ring buffers, and frame-perfect $O(1)$ state rollback.

---

## 1. Context & Motivation (The Why)

### Auditing the Teacher (`hermes-agent-main`)
The Teacher agent implemented voice recording, transcription, and TTS across `tools/voice_mode.py` (99 KB), `tools/tts_tool.py` (178 KB), `tools/transcription_tools.py` (135 KB), and `tools/wake_word.py` (58 KB).
Forensic inspection revealed critical consistency and isolation issues:
1. **Unbounded Native Thread Spawning & Global Process State**: `tools/voice_mode.py` and `tools/tts_tool.py` spawn multiple unmanaged `threading.Thread` and `ThreadPoolExecutor` instances with blocking `queue.Queue` loops to capture audio and stream chunks. If an audio stream stalls or a provider drops connection, these threads hang indefinitely, leaking memory and process handles.
2. **Blocking Subprocess Execution of Host Audio Binaries**: Audio playback and conversion execute shell subprocesses (`afplay`, `aplay`, `ffplay`, `ffmpeg`, `mpv`) with temporary files on disk (`/tmp/*.wav`, `/tmp/*.mp3`), writing unencrypted temporary audio files without sandboxing or cleanup guarantees.
3. **No In-Memory Audio Streaming / Zero-GC PCM Buffer Substrate**: Raw binary audio PCM chunks and waveforms are passed through unbounded Python lists, strings, and temporary file disk I/O, causing high GC allocation and disk wear.
4. **Lack of Snapshot-Compatible Voice State & Deterministic Synthesis**: Voice mode session parameters (active provider, voice ID, sample rate, vad threshold, streaming chunks, transcription history) are kept in module-global Python variables (`_VOICE_STATE`, `_STREAM_CACHE`). State cannot be rewound or restored in Broccolidb.
5. **Untyped Audio Headers & Loose String Encodings**: Loose dictionaries and ad-hoc string formatting for speech synthesis parameters, audio headers, and voice activity detection.

---

## 2. Architectural Decision (The What)

### 1. Deterministic Audio Binary Codec (`DeterministicAudioCodec`)
- In-memory zero-GC RIFF WAV binary encoder and decoder for 16-bit linear PCM mono/stereo.
- Root-Mean-Square (RMS) signal energy calculation and dBFS voice activity detector (VAD).
- Linear interpolation audio resampler (e.g. 48kHz to 16kHz downsampling).
- Synthesized audio tone generator for verification.
- Benchmarked at 10,000 WAV encodings in $<10\text{ ms}$ ($<0.001\text{ ms/op}$).

### 2. In-Memory Broccolidb Voice Substrate (`BroccoliVoiceSubstrate`)
- In-memory Broccolidb storage tracking voice session state, active profiles, circular audio byte ring buffers, and transcript history.
- Built-in multi-provider voice registry (Edge, OpenAI, ElevenLabs, Groq, Mistral).

### 3. Frame-Perfect Binary Snapshotting & $O(1)$ State Rollback (`VoiceSnapshotManager`)
- Captures atomic snapshots of voice session states, active profiles, and audio buffer pointers at frame $t$, restoring state in $<0.05\text{ ms}$ on turn rewind.

### 4. Master Real-Time Voice Supervisor (`VoiceSpeechSupervisor`)
- Coordinates STT transcription, TTS speech synthesis, push-to-talk recording, continuous streaming buffers, and VAD speech detection.

### 5. Model Tool Suite (`VoiceSpeechToolSuite`)
- `voice_transcribe`: Transcribes spoken audio from a file path or raw PCM buffer.
- `voice_synthesize`: Synthesizes spoken audio from text using neural models.
- `voice_list_profiles`: Returns available voice profiles, languages, and providers.
- `voice_detect_activity`: Analyzes audio buffers for speech energy (VAD).
- `voice_session_status`: Queries voice session state and buffer capacity.

---

## 3. Subsystem Organization (ADR-012 Alignment)

```
src/
├── core/contracts/
│   └── voice.contracts.ts                 # AudioFormat, AudioSampleRate, VoiceProvider, VoiceProfile, AudioChunk, TranscriptionResult, SpeechSynthesisResult, VadDecision, VoiceSessionState
├── tooling/extensions/voice/
│   ├── deterministic-audio-codec.ts       # Zero-GC RIFF WAV/PCM binary codec, RMS energy VAD engine, and downsampling resynthesizer
│   └── voice-speech-tool-suite.ts         # Model tools (voice_transcribe, voice_synthesize, voice_list_profiles, voice_detect_activity, voice_session_status)
├── sessions/extensions/voice/
│   ├── broccoli-voice-substrate.ts        # In-memory Broccolidb audio chunk ring buffer, transcript store, and profile registry
│   └── voice-snapshot-manager.ts          # Frame-perfect binary snapshots and O(1) state rollback (<0.05 ms)
└── agents/extensions/voice/
    └── voice-speech-supervisor.ts         # Master voice supervisor coordinating STT/TTS synthesis, PTT recording, and VAD streams
```

---

## 4. Empirical Validation & Benchmarks

Validated via `scripts/validate-voice-engine.ts`:
- **10,000 WAV Encodings**: $<10\text{ ms}$ ($<0.001\text{ ms/op}$).
- **State Rewind Latency**: $<0.05\text{ ms}$.
- **Component Graduation**: Monolith successfully expanded from 257 to **262 required components** in exact alphabetical order.
