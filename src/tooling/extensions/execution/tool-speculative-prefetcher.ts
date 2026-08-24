/**
 * tool-speculative-prefetcher.ts
 *
 * Speculative Tool Execution & Prefetch Warmer.
 * Anticipates read operations (file views, directory listings, symbol lookups)
 * based on partial argument streams or agent turn planning, warming results
 * in memory before the formal execution call arrives for sub-millisecond latency.
 */

import * as crypto from "node:crypto";
import type { IToolRegistry } from "../../../core/contracts/tooling.contracts.js";

export interface PrefetchEntry {
  readonly key: string;
  readonly toolName: string;
  readonly args: Record<string, unknown>;
  readonly promise: Promise<unknown>;
  readonly startTime: number;
}

export class ToolSpeculativePrefetcher {
  private activePrefetches = new Map<string, PrefetchEntry>();
  private readonly maxTtlMs: number;

  constructor(options: { maxTtlMs?: number } = {}) {
    this.maxTtlMs = options.maxTtlMs ?? 15_000;
  }

  /**
   * Generates a deterministic cache key for a prefetch request.
   */
  public generateKey(toolName: string, args: Record<string, unknown>, cwd: string): string {
    const serialized = JSON.stringify({ toolName, args, cwd });
    return crypto.createHash("sha256").update(serialized).digest("hex").slice(0, 16);
  }

  /**
   * Starts a speculative prefetch execution in the background.
   */
  public prefetch(
    toolName: string,
    args: Record<string, unknown>,
    cwd: string,
    registry: IToolRegistry
  ): void {
    // Only prefetch read-only tools
    const tool = registry.getTool(toolName);
    if (tool?.isMutating) return;

    const key = this.generateKey(toolName, args, cwd);
    if (this.activePrefetches.has(key)) return;

    const promise = registry.executeTool(toolName, args, cwd).catch((err) => {
      // Isolate prefetch errors
      return { prefetchError: err instanceof Error ? err.message : String(err) };
    });

    this.activePrefetches.set(key, {
      key,
      toolName,
      args,
      promise,
      startTime: Date.now(),
    });

    // Auto-cleanup after TTL
    setTimeout(() => {
      this.activePrefetches.delete(key);
    }, this.maxTtlMs).unref();
  }

  /**
   * Attempts to consume a pre-warmed execution result.
   */
  public async consumePrefetch(
    toolName: string,
    args: Record<string, unknown>,
    cwd: string
  ): Promise<{ hit: boolean; result?: unknown }> {
    const key = this.generateKey(toolName, args, cwd);
    const entry = this.activePrefetches.get(key);

    if (!entry) {
      return { hit: false };
    }

    this.activePrefetches.delete(key);

    try {
      const result = await entry.promise;
      return { hit: true, result };
    } catch {
      return { hit: false };
    }
  }

  /**
   * Clears all pending prefetches.
   */
  public clear(): void {
    this.activePrefetches.clear();
  }
}
