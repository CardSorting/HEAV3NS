/**
 * deterministic-deadline-engine.ts
 *
 * Pure TypeScript Unified Deadline Engine, Bounded Wall-Clock Execution & Process Tree Termination
 * (Phase 125 / ADR-101 / Target #58).
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  BoundedResult,
  DeadlineConfig,
  EstopState,
} from "../../../core/contracts/deadline.contracts.js";
import {
  DEFAULT_DEADLINE_CONFIG,
  MAX_SAFE_TIMEOUT_MS,
} from "../../../core/contracts/deadline.contracts.js";

export class DeterministicDeadlineEngine {
  /**
   * Resolves timeout with default fallbacks and strict bounds clamping.
   */
  public resolveTimeout(
    configuredTimeoutMs?: number,
    fallbackTimeoutMs = DEFAULT_DEADLINE_CONFIG.defaultTimeoutMs
  ): number {
    if (configuredTimeoutMs === undefined || configuredTimeoutMs === null || isNaN(configuredTimeoutMs)) {
      return this.clampTimeout(fallbackTimeoutMs);
    }
    if (configuredTimeoutMs <= 0) {
      return this.clampTimeout(fallbackTimeoutMs);
    }
    return this.clampTimeout(configuredTimeoutMs);
  }

  /**
   * Clamps timeout value to platform-safe interval [1ms, MAX_SAFE_TIMEOUT_MS].
   */
  public clampTimeout(timeoutMs: number): number {
    if (timeoutMs <= 0) return 1;
    if (timeoutMs > MAX_SAFE_TIMEOUT_MS) return MAX_SAFE_TIMEOUT_MS;
    return Math.floor(timeoutMs);
  }

  /**
   * Executes an asynchronous task bounded by a strict wall-clock timeout.
   * If timeout expires, rejects immediately without waiting for stalled promises.
   */
  public async runBoundedAsync<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<BoundedResult<T>> {
    const clampedTimeout = this.clampTimeout(timeoutMs);
    const start = Date.now();

    let timer: NodeJS.Timeout | null = null;
    let timedOut = false;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        reject(new Error(`Deadline expired: execution exceeded ${clampedTimeout}ms limit`));
      }, clampedTimeout);
    });

    try {
      const data = await Promise.race([fn(), timeoutPromise]);
      if (timer) clearTimeout(timer);
      const durationMs = Date.now() - start;

      return {
        success: true,
        data,
        durationMs,
        outcome: "completed",
        timedOut: false,
      };
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      const durationMs = Date.now() - start;

      return {
        success: false,
        error: err.message || String(err),
        durationMs,
        outcome: timedOut ? "timed_out" : "aborted",
        timedOut,
      };
    }
  }

  /**
   * Inspects filesystem sentinel file for external ESTOP engagement.
   */
  public checkFsSentinel(baseDir: string, sentinelFilename = "ESTOP"): EstopState {
    if (!baseDir) return { engaged: false };
    const sentinelPath = join(baseDir, sentinelFilename);

    try {
      if (existsSync(sentinelPath)) {
        const raw = readFileSync(sentinelPath, "utf-8").trim();
        if (!raw) {
          return {
            engaged: true,
            reason: "Filesystem ESTOP sentinel detected",
            engagedAt: Date.now(),
          };
        }
        try {
          const parsed = JSON.parse(raw);
          return {
            engaged: true,
            reason: parsed.reason || "Filesystem ESTOP sentinel detected",
            engagedAt: parsed.engaged_at ? new Date(parsed.engaged_at).getTime() : Date.now(),
            engagedBy: parsed.engaged_by,
          };
        } catch {
          return {
            engaged: true,
            reason: raw,
            engagedAt: Date.now(),
          };
        }
      }
    } catch {
      // Fail safe: if read error occurs on sentinel, treat as engaged
      return {
        engaged: true,
        reason: "ESTOP sentinel check failed (fail-safe engaged)",
        engagedAt: Date.now(),
      };
    }

    return { engaged: false };
  }

  /**
   * Creates or removes the filesystem ESTOP sentinel.
   */
  public writeFsSentinel(
    baseDir: string,
    engaged: boolean,
    reason?: string,
    sentinelFilename = "ESTOP"
  ): boolean {
    if (!baseDir) return false;
    const sentinelPath = join(baseDir, sentinelFilename);

    try {
      if (engaged) {
        const payload = {
          engaged_at: new Date().toISOString(),
          reason: reason || "Emergency Stop Engaged",
        };
        writeFileSync(sentinelPath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
        return true;
      } else {
        if (existsSync(sentinelPath)) {
          unlinkSync(sentinelPath);
          return true;
        }
      }
    } catch {
      return false;
    }
    return false;
  }
}
