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
  private totalPrefetched = 0;
  private totalConsumed = 0;

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
   * Analyzes a streaming raw JSON token buffer and speculatively prefetches read targets early.
   */
  public onStreamChunk(
    toolName: string,
    partialJson: string,
    cwd: string,
    registry: IToolRegistry
  ): boolean {
    if (!partialJson || partialJson.length < 5) return false;

    // Fast heuristic extraction of path or query arguments
    const pathMatch = partialJson.match(/"(?:path|filePath|file|targetFile)"\s*:\s*"([^"]+)"/);
    if (pathMatch && pathMatch[1]) {
      const extractedPath = pathMatch[1];
      if (toolName === "view_file" || toolName === "file_info" || toolName === "path_exists") {
        this.prefetch(toolName, { path: extractedPath }, cwd, registry);
        return true;
      }
    }

    const queryMatch = partialJson.match(/"(?:query|pattern|search_term)"\s*:\s*"([^"]+)"/);
    if (queryMatch && queryMatch[1] && toolName === "grep_search") {
      this.prefetch(toolName, { query: queryMatch[1] }, cwd, registry);
      return true;
    }

    const dirMatch = partialJson.match(/"(?:directory|dir)"\s*:\s*"([^"]+)"/);
    if (dirMatch && dirMatch[1] && toolName === "list_dir") {
      this.prefetch(toolName, { directory: dirMatch[1] }, cwd, registry);
      return true;
    }

    return false;
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

    this.totalPrefetched++;
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
   * Proactively warms a collection of workspace paths into cache via view_file / file_info.
   */
  public warmPaths(paths: readonly string[], cwd: string, registry: IToolRegistry): number {
    let count = 0;
    for (const p of paths) {
      if (typeof p === "string" && p.trim()) {
        this.prefetch("view_file", { path: p.trim() }, cwd, registry);
        this.prefetch("file_info", { path: p.trim() }, cwd, registry);
        count++;
      }
    }
    return count;
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
    this.totalConsumed++;

    try {
      const result = await entry.promise;
      return { hit: true, result };
    } catch {
      return { hit: false };
    }
  }

  /**
   * Returns operational statistics of the speculative prefetcher.
   */
  public getStats(): {
    activeCount: number;
    totalPrefetched: number;
    totalConsumed: number;
    hitRatePercent: number;
  } {
    const hitRatePercent =
      this.totalPrefetched > 0
        ? Number(((this.totalConsumed / this.totalPrefetched) * 100).toFixed(1))
        : 0;

    return {
      activeCount: this.activePrefetches.size,
      totalPrefetched: this.totalPrefetched,
      totalConsumed: this.totalConsumed,
      hitRatePercent,
    };
  }

  /**
   * Clears all pending prefetches.
   */
  public clear(): void {
    this.activePrefetches.clear();
  }
}

