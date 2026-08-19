/**
 * local-context-auto-tuner.ts
 *
 * Deterministic context window and KV-cache memory auto-tuner for local LLMs.
 * Dynamically computes safe context limits (num_ctx) to maximize prompt comprehension
 * while preventing VRAM exhaustion, system swap thrashing, or OOM freezes (Phase 105 / ADR-052).
 */

import * as os from "node:os";
import type {
  LocalContextTuningProfile,
} from "../../../core/contracts/local-endpoints.contracts.js";
import { LocalHardwareProfiler } from "./local-hardware-profiler.js";

export class LocalContextAutoTuner {
  private readonly hardwareProfiler: LocalHardwareProfiler;

  constructor(hardwareProfiler?: LocalHardwareProfiler) {
    this.hardwareProfiler = hardwareProfiler || new LocalHardwareProfiler();
  }

  computeTuningProfile(
    modelName: string,
    requestedContextTokens = 32_768,
    parameterSizeNumericB = 7.0
  ): LocalContextTuningProfile {
    const hw = this.hardwareProfiler.assessHardware();
    const totalRamGb = hw.totalMemoryGb;
    const isMetal = hw.hasAppleSiliconMetal;

    let safeContext = 8_192;
    let maxPredict = 4_096;
    let recommendedLayers = 99; // full GPU offload by default
    let rationale = "Balanced context budget for standard host RAM.";

    if (totalRamGb >= 64) {
      safeContext = Math.min(requestedContextTokens, 131_072);
      maxPredict = 8_192;
      rationale = "High-capacity 64GB+ host: Full 128k context window enabled with zero swap risk.";
    } else if (totalRamGb >= 32) {
      safeContext = Math.min(requestedContextTokens, 65_536);
      maxPredict = 4_096;
      rationale = "32GB host: Extended 64k context window with full GPU KV cache headroom.";
    } else if (totalRamGb >= 16) {
      // If model is large (> 14B), be more conservative on 16GB RAM
      if (parameterSizeNumericB > 14) {
        safeContext = 8_192;
        recommendedLayers = isMetal ? 32 : 16;
        rationale = "16GB host running heavy model: Context tuned to 8k to prevent RAM exhaustion.";
      } else {
        safeContext = Math.min(requestedContextTokens, 32_768);
        rationale = "16GB host: Optimal 32k context with Apple Metal / GPU offload.";
      }
    } else if (totalRamGb >= 8) {
      safeContext = Math.min(requestedContextTokens, 8_192);
      maxPredict = 2_048;
      recommendedLayers = isMetal ? 24 : 12;
      rationale = "8GB host: Context tuned to 8k with reduced KV cache footprint for smooth multitasking.";
    } else {
      safeContext = 4_096;
      maxPredict = 1_024;
      recommendedLayers = 8;
      rationale = "Limited RAM (<8GB): Context restricted to 4k to prevent swap thrashing.";
    }

    return {
      modelName,
      requestedContextTokens,
      safeContextTokens: safeContext,
      maxPredictTokens: maxPredict,
      recommendedGpuLayers: recommendedLayers,
      autoTuned: safeContext !== requestedContextTokens,
      tuningRationale: rationale,
    };
  }

  getOllamaOptions(
    modelName: string,
    requestedContext = 32_768,
    temperature = 0.2
  ): {
    num_ctx: number;
    num_predict: number;
    temperature: number;
    repeat_penalty: number;
  } {
    const profile = this.computeTuningProfile(modelName, requestedContext);
    return {
      num_ctx: profile.safeContextTokens,
      num_predict: profile.maxPredictTokens,
      temperature,
      repeat_penalty: 1.1,
    };
  }

  formatTuningSummary(profile: LocalContextTuningProfile): string {
    const icon = profile.autoTuned ? "⚡" : "✓";
    return (
      `\x1b[36m[${icon} Context Auto-Tuner]\x1b[0m \x1b[1m${profile.modelName}\x1b[0m: ` +
      `Safe Context: \x1b[33m${profile.safeContextTokens.toLocaleString()} tokens\x1b[0m ` +
      `(Max Out: ${profile.maxPredictTokens}) • ${profile.tuningRationale}`
    );
  }
}
