/**
 * local-hardware-profiler.ts
 *
 * Deterministic system hardware profiler, Apple Silicon Metal / Unified Memory
 * detector, and VRAM model compatibility evaluator (Phase 105 / ADR-052).
 */

import * as os from "node:os";
import type {
  LocalHardwareAssessment,
  ModelVramCompatibility,
  VramCompatibilityTier,
} from "../../../core/contracts/local-endpoints.contracts.js";

export class LocalHardwareProfiler {
  assessHardware(): LocalHardwareAssessment {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const totalGb = Math.round((totalBytes / (1024 * 1024 * 1024)) * 10) / 10;
    const freeGb = Math.round((freeBytes / (1024 * 1024 * 1024)) * 10) / 10;
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const cpuModel = cpus[0]?.model || "Standard CPU";
    const arch = os.arch();
    const platform = os.platform();

    // Apple Silicon (darwin + arm64) uses Unified Memory Architecture (UMA)
    // where macOS allows the Metal framework to address up to ~75% of total RAM as VRAM.
    const isAppleSilicon = platform === "darwin" && arch === "arm64";

    const estimatedGpuHeadroomBytes = isAppleSilicon
      ? Math.round(totalBytes * 0.75)
      : Math.round(totalBytes * 0.5);
    const estimatedGpuHeadroomGb =
      Math.round((estimatedGpuHeadroomBytes / (1024 * 1024 * 1024)) * 10) / 10;

    let recommendedMaxModelParams = "3B - 7B Q4";
    let recommendedModelTier = "qwen2.5-coder:7b or llama3.2:3b";

    if (totalGb >= 64) {
      recommendedMaxModelParams = "Up to 70B Q4 / 32B Q8";
      recommendedModelTier = "llama3.3:70b or qwen2.5-coder:32b";
    } else if (totalGb >= 32) {
      recommendedMaxModelParams = "Up to 32B Q4 / 14B Q8";
      recommendedModelTier = "qwen2.5-coder:14b or deepseek-r1:14b";
    } else if (totalGb >= 16) {
      recommendedMaxModelParams = "Up to 14B Q4 / 8B Q8";
      recommendedModelTier = "qwen2.5-coder:7b or deepseek-r1:8b";
    } else if (totalGb >= 8) {
      recommendedMaxModelParams = "Up to 8B Q4 / 3B Q8";
      recommendedModelTier = "llama3.2:3b or qwen2.5-coder:7b";
    } else {
      recommendedMaxModelParams = "1.5B - 3B Q4";
      recommendedModelTier = "llama3.2:1b or qwen2.5-coder:1.5b";
    }

    const archLabel = isAppleSilicon ? "Apple Silicon (Metal UMA)" : `${platform} (${arch})`;
    const summaryText = `${totalGb} GB RAM (${freeGb} GB free) • ${cpuCount} Cores • ${archLabel} • Rec: ${recommendedMaxModelParams}`;

    return {
      timestamp: Date.now(),
      totalMemoryBytes: totalBytes,
      freeMemoryBytes: freeBytes,
      totalMemoryGb: totalGb,
      freeMemoryGb: freeGb,
      cpuCores: cpuCount,
      cpuModel,
      arch,
      platform,
      hasAppleSiliconMetal: isAppleSilicon,
      estimatedGpuHeadroomBytes,
      estimatedGpuHeadroomGb,
      recommendedMaxModelParams,
      recommendedModelTier,
      summaryText,
    };
  }

  evaluateModel(
    modelId: string,
    parameterSizeStr?: string,
    quantizationStr?: string,
    contextWindowTokens = 8192
  ): ModelVramCompatibility {
    const hw = this.assessHardware();
    const raw = modelId.toLowerCase();

    // 1. Parse Parameter Size
    let paramsB = 7.0; // default 7B
    if (parameterSizeStr) {
      const match = parameterSizeStr.match(/(\d+(\.\d+)?)\s*[bBmM]/);
      if (match && match[1]) {
        const num = parseFloat(match[1]);
        paramsB = parameterSizeStr.toLowerCase().includes("m") ? num / 1000 : num;
      }
    } else {
      // Auto-extract from name
      if (raw.includes("70b")) paramsB = 70.0;
      else if (raw.includes("32b")) paramsB = 32.0;
      else if (raw.includes("14b")) paramsB = 14.0;
      else if (raw.includes("8b")) paramsB = 8.0;
      else if (raw.includes("7b")) paramsB = 7.0;
      else if (raw.includes("3b") || raw.includes("3.2") || raw.includes("3.1")) paramsB = 3.0;
      else if (raw.includes("1.5b") || raw.includes("1b")) paramsB = 1.5;
    }

    // 2. Parse Quantization
    let quantBits = 4.5; // default Q4_K_M (~4.5 bits/weight)
    if (quantizationStr) {
      const q = quantizationStr.toUpperCase();
      if (q.includes("Q8") || q.includes("8BIT")) quantBits = 8.5;
      else if (q.includes("Q6")) quantBits = 6.5;
      else if (q.includes("Q5")) quantBits = 5.5;
      else if (q.includes("Q4") || q.includes("4BIT")) quantBits = 4.5;
      else if (q.includes("Q3")) quantBits = 3.5;
      else if (q.includes("Q2")) quantBits = 2.5;
      else if (q.includes("FP16") || q.includes("16BIT")) quantBits = 16.0;
    }

    // 3. Weight Memory Calculation: (Params * 10^9 * bits / 8) bytes
    const weightBytes = Math.round((paramsB * 1e9 * quantBits) / 8);

    // 4. KV Cache Calculation: 2 * layers * heads * dim * context * 2 bytes
    // For a typical model: ~0.15 MB per 1000 context tokens per billion params
    const kvCacheBytes = Math.round(contextWindowTokens * 1024 * (paramsB / 7.0) * 128);

    // 5. Total Estimated Memory Footprint with runtime overhead (500MB)
    const runtimeOverhead = 500 * 1024 * 1024;
    const totalMemoryBytes = weightBytes + kvCacheBytes + runtimeOverhead;
    const totalMemoryGb = Math.round((totalMemoryBytes / (1024 * 1024 * 1024)) * 10) / 10;

    // 6. Evaluate Compatibility Tier against Host
    let tier: VramCompatibilityTier = "optimal_gpu";
    let badge = "\x1b[32m[🟢 100% GPU / Fast]\x1b[0m";
    let explanation = `Requires ~${totalMemoryGb} GB. Fits comfortably in GPU/Metal memory for instant token generation.`;
    let isRecommended = true;

    if (totalMemoryBytes <= hw.estimatedGpuHeadroomBytes) {
      tier = "optimal_gpu";
      badge = "\x1b[32m[🟢 100% GPU / Fast]\x1b[0m";
      explanation = `Requires ~${totalMemoryGb} GB. Fits 100% in GPU/Metal VRAM for maximum speed.`;
      isRecommended = true;
    } else if (totalMemoryBytes <= hw.totalMemoryBytes * 0.8) {
      tier = "partial_offload";
      badge = "\x1b[33m[🟡 Partial GPU Offload]\x1b[0m";
      explanation = `Requires ~${totalMemoryGb} GB. Will offload majority of layers to GPU with slight RAM spillover.`;
      isRecommended = true;
    } else if (totalMemoryBytes <= hw.totalMemoryBytes * 0.95) {
      tier = "cpu_spill";
      badge = "\x1b[38;5;208m[🟠 CPU Spill / Slower]\x1b[0m";
      explanation = `Requires ~${totalMemoryGb} GB. Exceeds GPU headroom and will run mainly in CPU/System RAM (slower inference).`;
      isRecommended = false;
    } else {
      tier = "insufficient_ram";
      badge = "\x1b[31m[🔴 Insufficient RAM]\x1b[0m";
      explanation = `Requires ~${totalMemoryGb} GB, but host only has ${hw.totalMemoryGb} GB RAM. Loading this model may cause system freeze/OOM.`;
      isRecommended = false;
    }

    return {
      modelId,
      parameterSizeNumericB: paramsB,
      quantizationBits: quantBits,
      estimatedWeightBytes: weightBytes,
      estimatedKvCacheBytes: kvCacheBytes,
      estimatedTotalMemoryBytes: totalMemoryBytes,
      estimatedTotalMemoryGb: totalMemoryGb,
      tier,
      badge,
      explanation,
      isRecommendedForHost: isRecommended,
    };
  }

  formatHardwareCard(): string {
    const hw = this.assessHardware();
    const usedBytes = hw.totalMemoryBytes - hw.freeMemoryBytes;
    const usedGb = Math.round((usedBytes / (1024 * 1024 * 1024)) * 10) / 10;
    const usedPercent = Math.round((usedBytes / hw.totalMemoryBytes) * 100);

    const barWidth = 24;
    const filledBlocks = Math.round((usedPercent / 100) * barWidth);
    const emptyBlocks = barWidth - filledBlocks;
    const progressBar = `\x1b[36m[${"█".repeat(filledBlocks)}${"░".repeat(emptyBlocks)}]\x1b[0m ${usedPercent}% (${usedGb}/${hw.totalMemoryGb} GB)`;

    const metalBadge = hw.hasAppleSiliconMetal
      ? "\x1b[32m[✓ Apple Silicon Metal Active - 75% UMA VRAM Allocation]\x1b[0m"
      : `\x1b[90m[Standard Architecture: ${hw.platform}/${hw.arch}]\x1b[0m`;

    return (
      `### 💻 System Hardware & Local VRAM Capacity\n\n` +
      `- **Host Platform**: \`${hw.platform} (${hw.arch})\` • **CPU**: \`${hw.cpuModel}\` (${hw.cpuCores} cores)\n` +
      `- **Total System RAM**: \`${hw.totalMemoryGb} GB\` (${hw.freeMemoryGb} GB currently free)\n` +
      `- **GPU / Metal Headroom**: \`${hw.estimatedGpuHeadroomGb} GB\` ${metalBadge}\n` +
      `- **Active RAM Utilization**: ${progressBar}\n\n` +
      `**Recommended Local Model Sizes for this Host:**\n` +
      `- **Optimal Performance**: \`${hw.recommendedMaxModelParams}\` (e.g. \`${hw.recommendedModelTier}\`)\n` +
      `- **Reasoning / Code Quality**: High-precision 4-bit / 8-bit quantized models.\n`
    );
  }
}
