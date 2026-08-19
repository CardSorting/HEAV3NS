/**
 * local-model-puller.ts
 *
 * Streaming model puller and download progress manager for Ollama and local model hubs.
 * Provides real-time byte counters, download speeds (MB/s), layer digest tracking,
 * and formatted ANSI progress bars right within the TUI and CLI (Phase 105 / ADR-052).
 */

import type {
  ModelPullPhase,
  ModelPullProgress,
} from "../../../core/contracts/local-endpoints.contracts.js";

export interface PullModelOptions {
  baseUrl?: string;
  onProgress?: (progress: ModelPullProgress) => void;
  signal?: AbortSignal;
  isSimulated?: boolean;
}

export class LocalModelPuller {
  private readonly defaultBaseUrl: string;

  constructor(defaultBaseUrl = "http://localhost:11434") {
    this.defaultBaseUrl = defaultBaseUrl;
  }

  async pullModel(
    modelTag: string,
    options: PullModelOptions = {}
  ): Promise<ModelPullProgress> {
    const cleanedTag = modelTag.trim();
    if (!cleanedTag) {
      throw new Error("Model tag cannot be empty");
    }

    if (options.isSimulated) {
      return this.simulatePull(cleanedTag, options.onProgress, options.signal);
    }

    const baseUrl = options.baseUrl || this.defaultBaseUrl;
    const url = `${baseUrl.replace(/\/+$/, "")}/api/pull`;
    const startedAt = Date.now();
    let lastBytes = 0;
    let lastTime = startedAt;
    let currentSpeed = 0;

    let latestProgress: ModelPullProgress = {
      modelTag: cleanedTag,
      phase: "initializing",
      statusText: "Connecting to Ollama pull endpoint...",
      completedBytes: 0,
      totalBytes: 0,
      percentage: 0,
      speedBytesPerSec: 0,
      etaSeconds: 0,
      done: false,
      progressBarText: this.formatProgressBar(0, 0, 0, 0, 0),
    };

    options.onProgress?.(latestProgress);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanedTag, stream: true }),
        signal: options.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText.slice(0, 300)}`);
      }

      if (!response.body) {
        throw new Error("Response body is not streamable");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const chunk = JSON.parse(trimmed) as {
              status?: string;
              digest?: string;
              total?: number;
              completed?: number;
              error?: string;
            };

            if (chunk.error) {
              throw new Error(chunk.error);
            }

            const now = Date.now();
            const deltaMs = now - lastTime;
            const completed = chunk.completed || 0;
            const total = chunk.total || 0;

            if (deltaMs >= 400 && completed > lastBytes) {
              const deltaBytes = completed - lastBytes;
              currentSpeed = (deltaBytes / deltaMs) * 1000;
              lastBytes = completed;
              lastTime = now;
            }

            const percentage = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
            const remainingBytes = Math.max(0, total - completed);
            const eta = currentSpeed > 0 ? Math.round(remainingBytes / currentSpeed) : 0;

            let phase: ModelPullPhase = "downloading";
            const rawStatus = (chunk.status || "").toLowerCase();

            if (rawStatus.includes("manifest") || rawStatus.includes("pulling manifest")) {
              phase = "pulling_manifest";
            } else if (rawStatus.includes("verifying")) {
              phase = "verifying";
            } else if (rawStatus.includes("writing")) {
              phase = "writing";
            } else if (rawStatus.includes("success")) {
              phase = "completed";
            }

            latestProgress = {
              modelTag: cleanedTag,
              phase,
              statusText: chunk.status || "Downloading layers...",
              completedBytes: completed,
              totalBytes: total,
              percentage,
              speedBytesPerSec: currentSpeed,
              etaSeconds: eta,
              layerDigest: chunk.digest,
              done: phase === "completed",
              progressBarText: this.formatProgressBar(
                percentage,
                completed,
                total,
                currentSpeed,
                eta
              ),
            };

            options.onProgress?.(latestProgress);
          } catch (jsonErr: any) {
            // Ignore parse errors on partial chunks
          }
        }
      }

      latestProgress = {
        ...latestProgress,
        phase: "completed",
        statusText: `Successfully pulled ${cleanedTag}!`,
        percentage: 100,
        done: true,
        progressBarText: this.formatProgressBar(100, latestProgress.totalBytes, latestProgress.totalBytes, 0, 0),
      };
      options.onProgress?.(latestProgress);
      return latestProgress;
    } catch (err: any) {
      latestProgress = {
        ...latestProgress,
        phase: "failed",
        statusText: `Pull failed: ${err.message || String(err)}`,
        error: err.message || String(err),
        done: true,
      };
      options.onProgress?.(latestProgress);
      throw err;
    }
  }

  async simulatePull(
    modelTag: string,
    onProgress?: (progress: ModelPullProgress) => void,
    signal?: AbortSignal
  ): Promise<ModelPullProgress> {
    const totalBytes = 3.8 * 1024 * 1024 * 1024; // 3.8 GB
    const steps = 10;
    const speed = 45 * 1024 * 1024; // 45 MB/s

    for (let i = 1; i <= steps; i++) {
      if (signal?.aborted) throw new Error("Pull cancelled by user");

      const completed = Math.round((i / steps) * totalBytes);
      const pct = Math.round((i / steps) * 100);
      const eta = Math.round((totalBytes - completed) / speed);

      const progress: ModelPullProgress = {
        modelTag,
        phase: i === steps ? "completed" : i === 1 ? "pulling_manifest" : "downloading",
        statusText: i === steps ? "Successfully pulled model!" : `Downloading layer #${i}...`,
        completedBytes: completed,
        totalBytes,
        percentage: pct,
        speedBytesPerSec: speed,
        etaSeconds: eta,
        done: i === steps,
        progressBarText: this.formatProgressBar(pct, completed, totalBytes, speed, eta),
      };

      onProgress?.(progress);
      await new Promise((r) => setTimeout(r, 20));
    }

    return {
      modelTag,
      phase: "completed",
      statusText: `Model ${modelTag} is ready for local execution.`,
      completedBytes: totalBytes,
      totalBytes,
      percentage: 100,
      speedBytesPerSec: 0,
      etaSeconds: 0,
      done: true,
      progressBarText: this.formatProgressBar(100, totalBytes, totalBytes, 0, 0),
    };
  }

  formatProgressBar(
    percentage: number,
    completedBytes: number,
    totalBytes: number,
    speedBytesPerSec: number,
    etaSeconds: number,
    barWidth = 20
  ): string {
    const clampedPct = Math.min(100, Math.max(0, percentage));
    const filled = Math.round((clampedPct / 100) * barWidth);
    const empty = barWidth - filled;

    const compGb = (completedBytes / (1024 * 1024 * 1024)).toFixed(1);
    const totGb = (totalBytes / (1024 * 1024 * 1024)).toFixed(1);
    const speedMb = (speedBytesPerSec / (1024 * 1024)).toFixed(1);
    const etaStr = etaSeconds > 0 ? `ETA ${etaSeconds}s` : "complete";

    const bar = `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
    if (totalBytes > 0) {
      return `\x1b[36m${bar}\x1b[0m \x1b[1m${clampedPct}%\x1b[0m (${compGb}/${totGb} GB @ \x1b[33m${speedMb} MB/s\x1b[0m • ${etaStr})`;
    }
    return `\x1b[36m${bar}\x1b[0m \x1b[1m${clampedPct}%\x1b[0m (connecting...)`;
  }
}
