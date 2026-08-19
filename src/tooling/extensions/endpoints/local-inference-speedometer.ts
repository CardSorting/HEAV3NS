/**
 * local-inference-speedometer.ts
 *
 * Deterministic local LLM inference benchmark & Tokens-Per-Second (TPS) speedometer.
 * Measures Time-To-First-Token (TTFT), generation throughput, and VRAM efficiency (Phase 105 / ADR-052).
 */

import type {
  LocalInferenceBenchmarkResult,
  LocalProviderKind,
} from "../../../core/contracts/local-endpoints.contracts.js";
import { LocalHardwareProfiler } from "./local-hardware-profiler.js";

export interface SpeedometerOptions {
  baseUrl?: string;
  provider?: LocalProviderKind;
  warmup?: boolean;
  benchmarkPrompt?: string;
  maxTokens?: number;
  isSimulated?: boolean;
  timeoutMs?: number;
}

export class LocalInferenceSpeedometer {
  private readonly hardwareProfiler: LocalHardwareProfiler;

  constructor(hardwareProfiler?: LocalHardwareProfiler) {
    this.hardwareProfiler = hardwareProfiler || new LocalHardwareProfiler();
  }

  async benchmarkModel(
    modelName: string,
    options: SpeedometerOptions = {}
  ): Promise<LocalInferenceBenchmarkResult> {
    const provider = options.provider || "ollama";
    const baseUrl = options.baseUrl || "http://localhost:11434";
    const prompt = options.benchmarkPrompt || "Explain deterministic software architecture in 3 concise bullet points.";
    const maxTokens = options.maxTokens || 120;

    if (options.isSimulated) {
      return this.simulateBenchmark(modelName, provider);
    }

    const startedAt = Date.now();
    let ttftMs = 0;
    let generatedTokens = 0;
    let promptTokens = Math.ceil(prompt.length / 4);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || 25_000);

    try {
      const endpointUrl = `${baseUrl.replace(/\/+$/, "")}/v1/chat/completions`;

      const requestBody = {
        model: modelName,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        stream: true,
        temperature: 0.1,
      };

      const res = await fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      if (!res.body) {
        throw new Error("Response body is not streamable");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let firstTokenTime: number | null = null;
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const now = Date.now();
        if (firstTokenTime === null) {
          firstTokenTime = now;
          ttftMs = Math.max(1, now - startedAt);
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const dataPayload = trimmed.slice(5).trim();
          if (dataPayload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(dataPayload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
            }
          } catch {
            // Ignore partial chunk parsing
          }
        }
      }

      const totalDurationMs = Math.max(1, Date.now() - startedAt);
      const generationDurationMs = firstTokenTime ? Math.max(1, Date.now() - firstTokenTime) : totalDurationMs;

      // Estimate output tokens from generated text length
      generatedTokens = Math.max(1, Math.ceil(fullText.length / 3.8));
      const tps = Math.round((generatedTokens / (generationDurationMs / 1000)) * 10) / 10;

      const vram = this.hardwareProfiler.evaluateModel(modelName);
      const vramUsageMb = Math.round(vram.estimatedTotalMemoryBytes / (1024 * 1024));

      const scorecard = this.formatSpeedScorecard(modelName, tps, ttftMs, totalDurationMs, generatedTokens);

      return {
        modelName,
        provider,
        timestamp: Date.now(),
        ttftMs,
        tokensPerSecond: tps,
        generatedTokens,
        promptTokens,
        totalDurationMs,
        vramUsageEstimatedMb: vramUsageMb,
        status: "completed",
        speedScorecard: scorecard,
      };
    } catch (err: any) {
      const isAbort = err?.name === "AbortError";
      const vram = this.hardwareProfiler.evaluateModel(modelName);

      return {
        modelName,
        provider,
        timestamp: Date.now(),
        ttftMs: -1,
        tokensPerSecond: 0,
        generatedTokens: 0,
        promptTokens,
        totalDurationMs: Date.now() - startedAt,
        vramUsageEstimatedMb: Math.round(vram.estimatedTotalMemoryBytes / (1024 * 1024)),
        status: isAbort ? "timeout" : "failed",
        speedScorecard: `\x1b[31m[Benchmark Failed]\x1b[0m ${err?.message || "Server offline"}`,
        error: err?.message || String(err),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  simulateBenchmark(
    modelName: string,
    provider: LocalProviderKind = "ollama"
  ): LocalInferenceBenchmarkResult {
    const isSmall = modelName.includes("3b") || modelName.includes("1.5b") || modelName.includes("1b");
    const isLarge = modelName.includes("70b") || modelName.includes("32b");

    const tps = isSmall ? 52.4 : isLarge ? 14.8 : 38.6;
    const ttftMs = isSmall ? 48 : isLarge ? 180 : 82;
    const generatedTokens = 120;
    const totalDurationMs = Math.round((generatedTokens / tps) * 1000) + ttftMs;

    const vram = this.hardwareProfiler.evaluateModel(modelName);
    const vramUsageMb = Math.round(vram.estimatedTotalMemoryBytes / (1024 * 1024));

    const scorecard = this.formatSpeedScorecard(modelName, tps, ttftMs, totalDurationMs, generatedTokens);

    return {
      modelName,
      provider,
      timestamp: Date.now(),
      ttftMs,
      tokensPerSecond: tps,
      generatedTokens,
      promptTokens: 45,
      totalDurationMs,
      vramUsageEstimatedMb: vramUsageMb,
      status: "completed",
      speedScorecard: scorecard,
    };
  }

  formatSpeedScorecard(
    modelName: string,
    tps: number,
    ttftMs: number,
    totalDurationMs: number,
    tokens: number
  ): string {
    const barWidth = 20;
    const maxReferenceTps = 80;
    const filled = Math.min(barWidth, Math.max(1, Math.round((tps / maxReferenceTps) * barWidth)));
    const empty = barWidth - filled;

    const tpsColor = tps >= 35 ? "\x1b[1;32m" : tps >= 18 ? "\x1b[1;33m" : "\x1b[1;31m";
    const speedBar = `${tpsColor}[${"█".repeat(filled)}${"░".repeat(empty)}]\x1b[0m ${tpsColor}${tps} tok/s\x1b[0m`;

    return (
      `### ⚡ Local LLM Speedometer: \`${modelName}\`\n\n` +
      `- **Generation Speed**: ${speedBar}\n` +
      `- **Time to First Token (TTFT)**: \x1b[36m${ttftMs}ms\x1b[0m (Ingestion latency)\n` +
      `- **Total Duration**: \x1b[33m${totalDurationMs}ms\x1b[0m (${tokens} tokens generated)\n`
    );
  }
}
