/**
 * wake-word-tool-suite.ts
 *
 * Model tool definitions exposing Acoustic Wake-Word Detection to agents
 * (Phase 121 / ADR-097 / Target #54).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { WakeWordSupervisor } from "../../../agents/extensions/wake_word/wake-word-supervisor.js";

export class WakeWordToolSuite {
  private readonly supervisor: WakeWordSupervisor;

  constructor(supervisor: WakeWordSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "wake_word_feed_audio",
        description:
          "Feeds a PCM audio chunk into the streaming wake-word ring buffer and evaluates detection.",
        parameters: {
          samples: {
            type: "string",
            description: "JSON array or comma-separated 16-bit PCM integer samples (e.g. 1280 samples at 16kHz mono).",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          let samplesArray: Int16Array;
          if (Array.isArray(args.samples)) {
            samplesArray = new Int16Array(args.samples as number[]);
          } else if (typeof args.samples === "string") {
            try {
              const parsed = JSON.parse(args.samples);
              if (Array.isArray(parsed)) {
                samplesArray = new Int16Array(parsed);
              } else {
                samplesArray = new Int16Array(1280);
              }
            } catch {
              samplesArray = new Int16Array(1280);
            }
          } else {
            // Default synthesized speech frame (1280 samples)
            samplesArray = new Int16Array(1280);
            for (let i = 0; i < 1280; i++) {
              samplesArray[i] = Math.sin(i / 10) * 1000;
            }
          }

          const result = this.supervisor.feedAudio(samplesArray);
          return {
            success: true,
            triggered: result.triggered,
            state: result.state,
            score: result.score,
            rmsEnergy: result.rmsEnergy,
            peakAmplitude: result.peakAmplitude,
            silent: result.silent,
            consecutiveHits: result.consecutiveHits,
          };
        },
      },
      {
        name: "wake_word_configure",
        description:
          "Configures wake-word detection parameters (provider, phrase, sensitivity, confirmation frames).",
        parameters: {
          phrase: {
            type: "string",
            description: "Target wake phrase (e.g. 'hey lumi', 'hey hermes').",
            required: false,
          },
          sensitivity: {
            type: "number",
            description: "Detection sensitivity threshold between 0.0 and 1.0.",
            required: false,
          },
          confirmationFrames: {
            type: "number",
            description: "Number of consecutive above-threshold frames required to trigger.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const updates: Record<string, unknown> = {};
          if (typeof args.phrase === "string") updates.phrase = args.phrase;
          if (typeof args.sensitivity === "number") updates.sensitivity = args.sensitivity;
          if (typeof args.confirmationFrames === "number") updates.confirmationFrames = args.confirmationFrames;

          this.supervisor.configure(updates);
          return {
            success: true,
            config: this.supervisor.getConfig(),
            message: "Wake-word configuration updated.",
          };
        },
      },
      {
        name: "wake_word_control",
        description:
          "Controls wake-word detector state (start, pause, resume, mute, unmute, reset).",
        parameters: {
          action: {
            type: "string",
            description: "Action to execute: 'start' | 'pause' | 'resume' | 'mute' | 'unmute' | 'reset'.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const action = typeof args.action === "string" ? args.action.toLowerCase() : "";
          switch (action) {
            case "start":
              this.supervisor.startListening();
              break;
            case "pause":
              this.supervisor.pause();
              break;
            case "resume":
              this.supervisor.resume();
              break;
            case "mute":
              this.supervisor.mute();
              break;
            case "unmute":
              this.supervisor.unmute();
              break;
            case "reset":
              this.supervisor.reset();
              break;
            default:
              return { success: false, error: `Unknown action '${action}'` };
          }
          return {
            success: true,
            action,
            state: this.supervisor.getState(),
          };
        },
      },
      {
        name: "wake_word_inspect_status",
        description:
          "Inspects the active status, configuration, and microphone health of the wake-word detector.",
        parameters: {},
        execute: async () => {
          return {
            success: true,
            state: this.supervisor.getState(),
            config: this.supervisor.getConfig(),
            isDeadMic: this.supervisor.isDeadMic(),
            historyCount: this.supervisor.getHistory().length,
          };
        },
      },
      {
        name: "wake_word_get_metrics",
        description:
          "Retrieves aggregate metrics for acoustic frames, trigger events, and false-positive rejections.",
        parameters: {},
        execute: async () => {
          return {
            success: true,
            metrics: this.supervisor.getMetrics(),
          };
        },
      },
    ];
  }
}
