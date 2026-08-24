/**
 * tool-execution-scheduler.ts
 *
 * High-Performance Parallel Tool Execution Scheduler & Concurrency Governor.
 * Partitions multi-tool calls into concurrent read waves and serialized mutation waves,
 * integrating zero-GC read caching, output governance, and error auto-healing.
 */

import type { IToolRegistry, ToolDefinition, ToolExecutionRecord } from "../../../core/contracts/tooling.contracts.js";
import { ToolExecutionCache } from "./tool-execution-cache.js";
import { ToolOutputGovernor } from "./tool-output-governor.js";
import { ToolErrorAutoHealer } from "./tool-error-auto-healer.js";
import { ToolCallArgParser } from "../registry/tool-call-arg-parser.js";

export interface ScheduledToolCall {
  readonly id: string;
  readonly name: string;
  readonly args: Record<string, unknown> | string;
}

export interface SchedulerOptions {
  readonly maxConcurrency?: number;
  readonly enableCache?: boolean;
  readonly enableOutputGovernance?: boolean;
  readonly onToolStart?: (call: ScheduledToolCall, wave: number) => void;
  readonly onToolComplete?: (record: ToolExecutionRecord) => void;
}

export interface SchedulerMetrics {
  readonly totalCalls: number;
  readonly parallelBatches: number;
  readonly cacheHits: number;
  readonly executionTimeMs: number;
  readonly concurrencySpeedup: number;
}

export class ToolExecutionScheduler {
  readonly cache: ToolExecutionCache;
  readonly governor: ToolOutputGovernor;
  readonly healer: ToolErrorAutoHealer;
  readonly parser: ToolCallArgParser;
  private readonly defaultMaxConcurrency: number;

  constructor(options: {
    cache?: ToolExecutionCache;
    governor?: ToolOutputGovernor;
    healer?: ToolErrorAutoHealer;
    parser?: ToolCallArgParser;
    maxConcurrency?: number;
  } = {}) {
    this.cache = options.cache ?? new ToolExecutionCache();
    this.governor = options.governor ?? new ToolOutputGovernor();
    this.healer = options.healer ?? new ToolErrorAutoHealer();
    this.parser = options.parser ?? new ToolCallArgParser();
    this.defaultMaxConcurrency = options.maxConcurrency ?? 8;
  }

  /**
   * Partitions scheduled tool calls into concurrent read waves and serialized mutation waves.
   */
  public partitionWaves(
    calls: readonly ScheduledToolCall[],
    registry: IToolRegistry
  ): ScheduledToolCall[][] {
    if (calls.length <= 1) {
      return [Array.from(calls)];
    }

    const waves: ScheduledToolCall[][] = [];
    let currentReadWave: ScheduledToolCall[] = [];

    for (const call of calls) {
      const toolDef = registry.getTool(call.name);
      const isMutating = toolDef?.isMutating === true || this.isKnownMutatingTool(call.name);

      if (isMutating) {
        // Flush previous read wave if any
        if (currentReadWave.length > 0) {
          waves.push(currentReadWave);
          currentReadWave = [];
        }
        // Mutating tools get their own dedicated single-item wave to preserve order
        waves.push([call]);
      } else {
        currentReadWave.push(call);
      }
    }

    if (currentReadWave.length > 0) {
      waves.push(currentReadWave);
    }

    return waves;
  }

  /**
   * Executes a batch of tool calls with parallel concurrency for read-only waves.
   */
  public async executeBatch(
    calls: readonly ScheduledToolCall[],
    registry: IToolRegistry,
    cwd: string,
    options: SchedulerOptions = {}
  ): Promise<{ results: ToolExecutionRecord[]; metrics: SchedulerMetrics }> {
    const startedAt = Date.now();
    const enableCache = options.enableCache ?? true;
    const enableGov = options.enableOutputGovernance ?? true;
    const resultsMap = new Map<string, ToolExecutionRecord>();
    let cacheHits = 0;

    const waves = this.partitionWaves(calls, registry);

    for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
      const wave = waves[waveIndex];

      if (wave.length === 1) {
        // Single call execution (mutation or lone read)
        const call = wave[0];
        options.onToolStart?.(call, waveIndex + 1);
        const record = await this.executeSingleCall(call, registry, cwd, enableCache, enableGov);
        if (record.isCached) cacheHits++;
        resultsMap.set(call.id, record);
        options.onToolComplete?.(record);
      } else {
        // Parallel batch execution (multiple concurrent reads)
        const executions = wave.map(async (call) => {
          options.onToolStart?.(call, waveIndex + 1);
          const record = await this.executeSingleCall(call, registry, cwd, enableCache, enableGov);
          if (record.isCached) cacheHits++;
          resultsMap.set(call.id, record);
          options.onToolComplete?.(record);
        });

        await Promise.all(executions);
      }
    }

    const totalElapsed = Date.now() - startedAt;

    // Maintain original call order
    const orderedResults = calls.map((call) => resultsMap.get(call.id)!);

    // Estimate theoretical serial execution duration
    const serialDuration = orderedResults.reduce((acc, r) => acc + (r.durationMs ?? 0), 0);
    const speedup = totalElapsed > 0 ? Number((serialDuration / Math.max(1, totalElapsed)).toFixed(2)) : 1.0;

    return {
      results: orderedResults,
      metrics: {
        totalCalls: calls.length,
        parallelBatches: waves.length,
        cacheHits,
        executionTimeMs: totalElapsed,
        concurrencySpeedup: Math.max(1.0, speedup),
      },
    };
  }

  /**
   * Executes a single tool call with caching, argument repair, output governance, and error healing.
   */
  public async executeSingleCall(
    call: ScheduledToolCall,
    registry: IToolRegistry,
    cwd: string,
    enableCache: boolean,
    enableGovernance: boolean
  ): Promise<ToolExecutionRecord & { isCached?: boolean }> {
    const callStart = Date.now();
    const toolDef = registry.getTool(call.name);

    // 1. Parse & Repair Arguments
    let parsedArgs: Record<string, unknown> = {};
    if (toolDef) {
      const prepared = this.parser.prepareArguments(toolDef, call.args);
      parsedArgs = prepared.args;
    } else {
      parsedArgs = this.parser.parseRawArguments(call.args).args;
    }

    // 2. Check Read Cache
    if (enableCache) {
      const cached = this.cache.get(call.name, parsedArgs, cwd);
      if (cached !== null) {
        return {
          name: call.name,
          callId: call.id,
          args: parsedArgs,
          output: cached,
          durationMs: 0,
          success: true,
          isCached: true,
        };
      }
    }

    // 3. Execute Tool
    let rawResult: unknown = null;
    let isSuccess = true;
    let exitCode: number | undefined;

    try {
      rawResult = await registry.executeTool(call.name, parsedArgs, cwd);

      if (typeof rawResult === "object" && rawResult !== null) {
        const obj = rawResult as Record<string, unknown>;
        if (typeof obj.exitCode === "number") exitCode = obj.exitCode;
      }

      // If mutating tool, invalidate affected cache entries
      const isMutating = toolDef?.isMutating === true || this.isKnownMutatingTool(call.name);
      if (isMutating && enableCache) {
        const paths = this.cache.extractPaths(parsedArgs, cwd);
        this.cache.invalidatePaths(paths, cwd);
      } else if (enableCache) {
        // Cache read-only result
        this.cache.set(call.name, parsedArgs, cwd, rawResult);
      }
    } catch (err: unknown) {
      isSuccess = false;
      // 4. Model-Facing Diagnostic Auto-Healing
      const healed = this.healer.diagnoseAndHeal(call.name, parsedArgs, err, cwd, toolDef);
      rawResult = this.healer.formatForModel(healed);
    }

    const elapsed = Date.now() - callStart;

    // 5. Output Governance & Bounding
    let finalOutput = rawResult;
    if (enableGovernance && typeof rawResult === "string" && rawResult.length > 50_000) {
      finalOutput = this.governor.governOutput(rawResult, call.name).outputText;
    }

    return {
      name: call.name,
      callId: call.id,
      args: parsedArgs,
      output: finalOutput,
      durationMs: elapsed,
      success: isSuccess,
      exitCode,
    };
  }

  private isKnownMutatingTool(name: string): boolean {
    const canonical = name.toLowerCase();
    return (
      canonical.includes("write") ||
      canonical.includes("replace") ||
      canonical.includes("delete") ||
      canonical.includes("create") ||
      canonical.includes("remove") ||
      canonical.includes("move") ||
      canonical.includes("edit") ||
      canonical.includes("append") ||
      canonical.includes("exec") ||
      canonical.includes("run_command") ||
      canonical.includes("terminal") ||
      canonical.includes("bash")
    );
  }
}
