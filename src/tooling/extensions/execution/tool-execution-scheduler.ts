import * as path from "node:path";
import type {
  ExecutionAuthorityLevel,
  IToolRegistry,
  PipelinedStreamChunk,
  ToolDefinition,
  ToolExecutionOptions,
  ToolExecutionRecord,
} from "../../../core/contracts/tooling.contracts.js";
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
  readonly allowParallelDisjointMutations?: boolean;
  readonly executionAuthority?: ExecutionAuthorityLevel;
  readonly bypassConfirmation?: boolean;
  readonly bypassThreatDetection?: boolean;
  readonly onToolStart?: (call: ScheduledToolCall, wave: number) => void;
  readonly onToolComplete?: (record: ToolExecutionRecord) => void;
}

export interface SchedulerMetrics {
  readonly totalCalls: number;
  readonly parallelBatches: number;
  readonly cacheHits: number;
  readonly executionTimeMs: number;
  readonly concurrencySpeedup: number;
  readonly disjointParallelWaves?: number;
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
    this.defaultMaxConcurrency = options.maxConcurrency ?? 16;
  }

  /**
   * Extracts targeted resources (e.g. file paths, DB keys) from a tool call.
   */
  public extractTargetResources(call: ScheduledToolCall, cwd: string): string[] {
    const rawArgs =
      typeof call.args === "string"
        ? this.parser.parseRawArguments(call.args).args
        : call.args || {};

    const resources: string[] = [];
    const pathCandidate =
      typeof rawArgs.path === "string"
        ? rawArgs.path
        : typeof rawArgs.filePath === "string"
          ? rawArgs.filePath
          : typeof rawArgs.targetFile === "string"
            ? rawArgs.targetFile
            : typeof rawArgs.targetPath === "string"
              ? rawArgs.targetPath
              : undefined;

    if (pathCandidate) {
      const resolved = path.isAbsolute(pathCandidate)
        ? path.normalize(pathCandidate)
        : path.normalize(path.join(cwd, pathCandidate));
      resources.push(resolved);
    }

    if (typeof rawArgs.source === "string") {
      const resolvedSource = path.isAbsolute(rawArgs.source)
        ? path.normalize(rawArgs.source)
        : path.normalize(path.join(cwd, rawArgs.source));
      resources.push(resolvedSource);
    }

    if (typeof rawArgs.target === "string") {
      const resolvedTarget = path.isAbsolute(rawArgs.target)
        ? path.normalize(rawArgs.target)
        : path.normalize(path.join(cwd, rawArgs.target));
      resources.push(resolvedTarget);
    }

    if (Array.isArray(rawArgs.files)) {
      for (const item of rawArgs.files) {
        if (typeof item === "string") {
          resources.push(path.isAbsolute(item) ? path.normalize(item) : path.normalize(path.join(cwd, item)));
        } else if (item && typeof item === "object" && typeof (item as any).path === "string") {
          const p = (item as any).path;
          resources.push(path.isAbsolute(p) ? path.normalize(p) : path.normalize(path.join(cwd, p)));
        }
      }
    }

    return resources;
  }

  /**
   * Partitions scheduled tool calls into concurrent waves using Resource-Aware Disjoint Partitioning.
   * If disjoint mutations targeting non-overlapping resources are enabled, they run concurrently in parallel waves!
   */
  public partitionWaves(
    calls: readonly ScheduledToolCall[],
    registry: IToolRegistry,
    options: { allowParallelDisjointMutations?: boolean; cwd?: string } = {}
  ): ScheduledToolCall[][] {
    if (calls.length <= 1) {
      return [Array.from(calls)];
    }

    const allowDisjoint = options.allowParallelDisjointMutations ?? true;
    const cwd = options.cwd ?? process.cwd();
    const waves: ScheduledToolCall[][] = [];

    let currentWave: ScheduledToolCall[] = [];
    let currentWaveResources = new Set<string>();
    let currentWaveHasMutations = false;

    for (const call of calls) {
      const toolDef = registry.getTool(call.name);
      const isMutating = toolDef?.isMutating === true || this.isKnownMutatingTool(call.name);
      const resources = this.extractTargetResources(call, cwd);

      if (!isMutating) {
        // Read-only tools can join any wave that doesn't conflict with mutating resources
        const hasConflictWithMutatingWave =
          currentWaveHasMutations && resources.some((r) => currentWaveResources.has(r));

        if (hasConflictWithMutatingWave) {
          // Flush current wave
          if (currentWave.length > 0) {
            waves.push(currentWave);
            currentWave = [];
            currentWaveResources.clear();
            currentWaveHasMutations = false;
          }
        }
        currentWave.push(call);
        for (const r of resources) currentWaveResources.add(r);
      } else {
        // Mutating tool
        if (!allowDisjoint) {
          // Strict serial mutation waves
          if (currentWave.length > 0) {
            waves.push(currentWave);
            currentWave = [];
            currentWaveResources.clear();
            currentWaveHasMutations = false;
          }
          waves.push([call]);
          continue;
        }

        // If preceding wave only contained read tools, flush it so reads complete before mutations
        if (currentWave.length > 0 && !currentWaveHasMutations) {
          waves.push(currentWave);
          currentWave = [];
          currentWaveResources.clear();
          currentWaveHasMutations = false;
        }

        // Disjoint check: Does this mutating tool conflict with any resource in current mutating wave?
        const hasResourceConflict =
          resources.length > 0 && resources.some((r) => currentWaveResources.has(r));

        // If command/process tool with unknown global impact, serialize
        const isGlobalUnboundCommand =
          (call.name === "run_command" || call.name === "terminal" || call.name === "bash") &&
          resources.length === 0;

        if (hasResourceConflict || isGlobalUnboundCommand || currentWave.length >= this.defaultMaxConcurrency) {
          // Conflict or global command: flush current wave
          if (currentWave.length > 0) {
            waves.push(currentWave);
            currentWave = [];
            currentWaveResources.clear();
            currentWaveHasMutations = false;
          }
        }

        currentWave.push(call);
        currentWaveHasMutations = true;

        for (const r of resources) currentWaveResources.add(r);

        if (isGlobalUnboundCommand) {
          // Global unbound command executes as isolated wave
          waves.push(currentWave);
          currentWave = [];
          currentWaveResources.clear();
          currentWaveHasMutations = false;
        }
      }
    }

    if (currentWave.length > 0) {
      waves.push(currentWave);
    }

    return waves;
  }

  /**
   * Executes a batch of tool calls with parallel concurrency for disjoint waves.
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

    const waves = this.partitionWaves(calls, registry, {
      allowParallelDisjointMutations: options.allowParallelDisjointMutations ?? true,
      cwd,
    });

    let disjointParallelWaves = 0;

    for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
      const wave = waves[waveIndex];

      if (wave.length === 1) {
        // Single call execution
        const call = wave[0];
        options.onToolStart?.(call, waveIndex + 1);
        const record = await this.executeSingleCall(
          call,
          registry,
          cwd,
          enableCache,
          enableGov,
          options
        );
        if (record.isCached) cacheHits++;
        resultsMap.set(call.id, record);
        options.onToolComplete?.(record);
      } else {
        // Parallel batch execution (multiple concurrent reads or disjoint mutations)
        disjointParallelWaves++;
        const executions = wave.map(async (call) => {
          options.onToolStart?.(call, waveIndex + 1);
          const record = await this.executeSingleCall(
            call,
            registry,
            cwd,
            enableCache,
            enableGov,
            options
          );
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
        disjointParallelWaves,
      },
    };
  }

  /**
   * Streams tool execution records wave by wave as an async generator for real-time responsiveness.
   */
  public async *executePipelinedStream(
    calls: readonly ScheduledToolCall[],
    registry: IToolRegistry,
    cwd: string,
    options: SchedulerOptions = {}
  ): AsyncGenerator<PipelinedStreamChunk, void, unknown> {
    const enableCache = options.enableCache ?? true;
    const enableGov = options.enableOutputGovernance ?? true;
    const waves = this.partitionWaves(calls, registry, {
      allowParallelDisjointMutations: options.allowParallelDisjointMutations ?? true,
      cwd,
    });

    let totalYielded = 0;

    for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
      const wave = waves[waveIndex];
      const wavePromises = wave.map(async (call) => {
        options.onToolStart?.(call, waveIndex + 1);
        const record = await this.executeSingleCall(
          call,
          registry,
          cwd,
          enableCache,
          enableGov,
          options
        );
        options.onToolComplete?.(record);
        return { call, record };
      });

      const waveResults = await Promise.all(wavePromises);

      for (let i = 0; i < waveResults.length; i++) {
        totalYielded++;
        const { call, record } = waveResults[i];
        const isLastInWave = i === waveResults.length - 1;
        const isFinal = totalYielded === calls.length;

        yield {
          waveIndex: waveIndex + 1,
          totalWaves: waves.length,
          callId: call.id,
          toolName: call.name,
          record,
          isLastInWave,
          isFinal,
        };
      }
    }
  }

  /**
   * Executes a single tool call with caching, argument repair, output governance, and error healing.
   */
  public async executeSingleCall(
    call: ScheduledToolCall,
    registry: IToolRegistry,
    cwd: string,
    enableCache: boolean,
    enableGovernance: boolean,
    schedulerOptions: SchedulerOptions = {}
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

    // 3. Execute Tool with execution authority options
    let rawResult: unknown = null;
    let isSuccess = true;
    let exitCode: number | undefined;

    const execOptions: ToolExecutionOptions = {
      bypassConfirmation: schedulerOptions.bypassConfirmation ?? true,
      bypassThreatDetection: schedulerOptions.bypassThreatDetection ?? true,
      executionAuthority: schedulerOptions.executionAuthority ?? "autonomous",
    };

    try {
      rawResult = await registry.executeTool(call.name, parsedArgs, cwd, execOptions);

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

