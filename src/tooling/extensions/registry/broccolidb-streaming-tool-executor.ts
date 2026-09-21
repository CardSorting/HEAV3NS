/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 127: Zero-Dependency Broccoli Streaming Tool Executor
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/agent-context/StreamingToolExecutor.ts).
 * Manages tool execution phase transitions (queued -> validating -> running -> completed/failed/timeout),
 * native timeout cancellation via AbortController, and progress callbacks. Zero external npm dependencies.
 */

export type ToolExecutionPhase =
  | "queued"
  | "validating"
  | "running"
  | "completed"
  | "failed"
  | "timeout";

export interface ToolExecutionProgress {
  toolUseId: string;
  toolName: string;
  phase: ToolExecutionPhase;
  elapsedMs: number;
  message?: string;
}

export interface StreamingToolExecutorOptions {
  defaultTimeoutMs?: number;
  onProgress?: (progress: ToolExecutionProgress) => void;
}

export class BroccoliStreamingToolExecutor {
  private readonly defaultTimeoutMs: number;
  private readonly onProgress?: (progress: ToolExecutionProgress) => void;

  constructor(options: StreamingToolExecutorOptions = {}) {
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000;
    this.onProgress = options.onProgress;
  }

  private notifyProgress(toolUseId: string, toolName: string, phase: ToolExecutionPhase, startTime: number, message?: string): void {
    if (this.onProgress) {
      this.onProgress({
        toolUseId,
        toolName,
        phase,
        elapsedMs: Date.now() - startTime,
        message,
      });
    }
  }

  /**
   * Executes a tool with streaming progress tracking and timeout control.
   */
  public async executeWithLifecycle<T>(
    toolUseId: string,
    toolName: string,
    executeFn: (signal: AbortSignal) => Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    const startTime = Date.now();
    const effectiveTimeoutMs = timeoutMs ?? this.defaultTimeoutMs;

    this.notifyProgress(toolUseId, toolName, "queued", startTime, "Tool queued for execution");

    const controller = new AbortController();
    let timeoutTimer: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        controller.abort();
        this.notifyProgress(toolUseId, toolName, "timeout", startTime, `Tool execution timed out after ${effectiveTimeoutMs}ms`);
        reject(new Error(`Tool Execution Timeout: Tool '${toolName}' (ID: ${toolUseId}) exceeded ${effectiveTimeoutMs}ms limit`));
      }, effectiveTimeoutMs);
    });

    try {
      this.notifyProgress(toolUseId, toolName, "validating", startTime, "Validating parameters");
      this.notifyProgress(toolUseId, toolName, "running", startTime, "Executing tool function");

      const result = await Promise.race([executeFn(controller.signal), timeoutPromise]);

      this.notifyProgress(toolUseId, toolName, "completed", startTime, "Tool execution completed successfully");
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.notifyProgress(toolUseId, toolName, "failed", startTime, errorMsg);
      throw err;
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    }
  }
}
