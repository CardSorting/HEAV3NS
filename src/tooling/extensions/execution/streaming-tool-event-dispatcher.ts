/**
 * streaming-tool-event-dispatcher.ts
 *
 * Real-Time Streaming Tool Output Chunker & Lifecycle Broadcaster.
 * Emits fine-grained streaming execution chunks and phase updates
 * (queued -> validating -> running -> chunk -> completed / failed / timeout)
 * to terminal UIs, websocket transports, and progress adapters.
 */

export type ToolLifecycleState =
  | "queued"
  | "validating"
  | "running"
  | "chunk"
  | "completed"
  | "failed"
  | "cancelled"
  | "timeout";

export interface ToolStreamChunkEvent {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly state: ToolLifecycleState;
  readonly chunkText?: string;
  readonly isStderr?: boolean;
  readonly progressPercent?: number;
  readonly elapsedMs: number;
  readonly timestamp: number;
}

export type ToolStreamEventListener = (event: ToolStreamChunkEvent) => void;

export class StreamingToolEventDispatcher {
  private listeners: Set<ToolStreamEventListener> = new Set();
  private activeStreams = new Map<string, { startTime: number; toolName: string }>();

  /**
   * Subscribes to live streaming tool events.
   */
  public subscribe(listener: ToolStreamEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Starts tracking a new streaming tool execution.
   */
  public emitStart(toolCallId: string, toolName: string): void {
    const startTime = Date.now();
    this.activeStreams.set(toolCallId, { startTime, toolName });
    this.broadcast({
      toolCallId,
      toolName,
      state: "running",
      elapsedMs: 0,
      timestamp: startTime,
    });
  }

  /**
   * Emits an incremental output chunk from a tool (e.g. stdout/stderr line from shell).
   */
  public emitChunk(toolCallId: string, chunkText: string, isStderr = false): void {
    const stream = this.activeStreams.get(toolCallId);
    const startTime = stream?.startTime ?? Date.now();
    const toolName = stream?.toolName ?? "unknown_tool";

    this.broadcast({
      toolCallId,
      toolName,
      state: "chunk",
      chunkText,
      isStderr,
      elapsedMs: Date.now() - startTime,
      timestamp: Date.now(),
    });
  }

  /**
   * Emits tool completion.
   */
  public emitComplete(toolCallId: string, finalOutput?: string): void {
    const stream = this.activeStreams.get(toolCallId);
    const startTime = stream?.startTime ?? Date.now();
    const toolName = stream?.toolName ?? "unknown_tool";

    this.broadcast({
      toolCallId,
      toolName,
      state: "completed",
      chunkText: finalOutput,
      elapsedMs: Date.now() - startTime,
      timestamp: Date.now(),
    });

    this.activeStreams.delete(toolCallId);
  }

  /**
   * Emits tool failure.
   */
  public emitError(toolCallId: string, errorMessage: string): void {
    const stream = this.activeStreams.get(toolCallId);
    const startTime = stream?.startTime ?? Date.now();
    const toolName = stream?.toolName ?? "unknown_tool";

    this.broadcast({
      toolCallId,
      toolName,
      state: "failed",
      chunkText: errorMessage,
      isStderr: true,
      elapsedMs: Date.now() - startTime,
      timestamp: Date.now(),
    });

    this.activeStreams.delete(toolCallId);
  }

  private broadcast(event: ToolStreamChunkEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Safe listener exception isolation
      }
    }
  }
}
