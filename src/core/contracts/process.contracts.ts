/**
 * process.contracts.ts
 *
 * Core interface contracts for the Deterministic Interactive Process Registry,
 * PTY Multiplexer, and Background Task Supervisor Subsystem (Phase 74 / ADR-026).
 */

export type ProcessExecutionStatus =
  | "starting"
  | "running"
  | "completed"
  | "failed"
  | "killed"
  | "timed_out"
  | "orphaned";

export interface ProcessWatchPattern {
  readonly pattern: string;
  readonly isRegex?: boolean;
  readonly notifyMessage?: string;
}

export interface ProcessWatchMatch {
  readonly pattern: string;
  readonly matchedText: string;
  readonly timestamp: number;
  readonly processId: string;
}

export interface ProcessSpawnOptions {
  readonly id?: string;
  readonly command: string;
  readonly args?: string[];
  readonly cwd?: string;
  readonly env?: Record<string, string>;
  readonly taskId?: string;
  readonly timeoutMs?: number;
  readonly watchPatterns?: ProcessWatchPattern[];
  readonly maxBufferBytes?: number;
  readonly interactive?: boolean;
}

export interface ProcessHandleDescriptor {
  readonly id: string;
  readonly pid: number;
  readonly command: string;
  readonly args: string[];
  readonly cwd: string;
  readonly taskId?: string;
  readonly status: ProcessExecutionStatus;
  readonly startTime: number;
  readonly endTime?: number;
  readonly exitCode?: number | null;
  readonly error?: string;
  readonly totalBytesRead: number;
  readonly watchMatches: ProcessWatchMatch[];
  readonly strikeCount: number;
  readonly lastWatchMatchTime: number;
}

export interface ProcessPollResult {
  readonly processId: string;
  readonly status: ProcessExecutionStatus;
  readonly exitCode: number | null | undefined;
  readonly durationMs: number;
  readonly stdoutTail: string;
  readonly stderrTail: string;
  readonly totalBytesRead: number;
  readonly watchMatches: ProcessWatchMatch[];
}

export interface ProcessSessionSnapshot {
  readonly activeProcesses: ProcessHandleDescriptor[];
  readonly historyProcesses: ProcessHandleDescriptor[];
  readonly totalSpawned: number;
  readonly totalCompleted: number;
  readonly totalFailed: number;
  readonly totalKilled: number;
  readonly timestamp: number;
}
