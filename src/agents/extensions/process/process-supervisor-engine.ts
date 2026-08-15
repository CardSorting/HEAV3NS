/**
 * process-supervisor-engine.ts
 *
 * Master Process Supervisor Engine.
 * Manages background subprocess lifecycles, PID tracking, PTY-style input streaming,
 * rolling ring buffer ingestion, watch pattern monitoring with strike rate-limits,
 * and deterministic teardown.
 */

import { spawn, type ChildProcess } from "node:child_process";
import type {
  ProcessSpawnOptions,
  ProcessHandleDescriptor,
  ProcessPollResult,
  ProcessWatchPattern,
} from "../../../core/contracts/process.contracts.js";
import { BroccoliProcessSubstrate } from "../../../sessions/extensions/process/broccoli-process-substrate.js";
import { ProcessSecuritySandbox } from "../../../tooling/extensions/process/process-security-sandbox.js";

const WATCH_COOLDOWN_MS = 15000; // Minimum 15s between notifications per pattern
const WATCH_STRIKE_LIMIT = 3;

export class ProcessSupervisorEngine {
  private readonly substrate: BroccoliProcessSubstrate;
  private readonly sandbox: ProcessSecuritySandbox;
  private readonly childHandles = new Map<string, ChildProcess>();
  private readonly processWatchers = new Map<string, ProcessWatchPattern[]>();
  private readonly timeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    substrate: BroccoliProcessSubstrate,
    sandbox: ProcessSecuritySandbox
  ) {
    this.substrate = substrate;
    this.sandbox = sandbox;
  }

  /**
   * Spawns a background command and tracks its lifecycle.
   */
  public async spawnProcess(options: ProcessSpawnOptions): Promise<ProcessHandleDescriptor> {
    const safety = this.sandbox.evaluateCommand(options.command, options.args);
    if (!safety.safe) {
      throw new Error(`Process spawn blocked by security sandbox: ${safety.reason}`);
    }

    const processId = options.id || `proc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const sanitizedEnv = this.sandbox.sanitizeEnvironment(process.env, options.env || {});
    const cwd = options.cwd || process.cwd();
    const args = options.args || [];

    const descriptor: ProcessHandleDescriptor = {
      id: processId,
      pid: 0,
      command: options.command,
      args,
      cwd,
      taskId: options.taskId,
      status: "starting",
      startTime: Date.now(),
      totalBytesRead: 0,
      watchMatches: [],
      strikeCount: 0,
      lastWatchMatchTime: 0,
    };

    this.substrate.registerProcess(descriptor, options.maxBufferBytes || 262144);
    if (options.watchPatterns && options.watchPatterns.length > 0) {
      this.processWatchers.set(processId, options.watchPatterns);
    }

    try {
      const child = spawn(options.command, args, {
        cwd,
        env: sanitizedEnv,
        shell: true,
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.childHandles.set(processId, child);
      const pid = child.pid || 0;

      this.substrate.updateProcess(processId, {
        pid,
        status: "running",
      });

      const ringBuffer = this.substrate.getBuffer(processId);

      child.stdout?.on("data", (chunk: Buffer) => {
        ringBuffer?.append(chunk);
        this.substrate.updateProcess(processId, {
          totalBytesRead: ringBuffer?.getTotalBytes() || 0,
        });
        this.evaluateWatchers(processId, chunk.toString("utf-8"));
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        ringBuffer?.append(chunk);
        this.substrate.updateProcess(processId, {
          totalBytesRead: ringBuffer?.getTotalBytes() || 0,
        });
        this.evaluateWatchers(processId, chunk.toString("utf-8"));
      });

      child.on("error", (err: Error) => {
        this.clearProcessTimeout(processId);
        this.substrate.updateProcess(processId, {
          status: "failed",
          endTime: Date.now(),
          error: this.sandbox.redactError(err.message),
        });
        this.childHandles.delete(processId);
      });

      child.on("close", (code: number | null) => {
        this.clearProcessTimeout(processId);
        const current = this.substrate.getProcess(processId);
        const nextStatus = current?.status === "killed" ? "killed" : code === 0 ? "completed" : "failed";
        this.substrate.updateProcess(processId, {
          status: nextStatus,
          endTime: Date.now(),
          exitCode: code,
        });
        this.childHandles.delete(processId);
      });

      if (options.timeoutMs && options.timeoutMs > 0) {
        const timer = setTimeout(() => {
          this.killProcess(processId, "SIGTERM");
          this.substrate.updateProcess(processId, {
            status: "timed_out",
            endTime: Date.now(),
          });
        }, options.timeoutMs);
        this.timeouts.set(processId, timer);
      }

      return this.substrate.getProcess(processId)!;
    } catch (err) {
      const errorMsg = this.sandbox.redactError(String(err));
      this.substrate.updateProcess(processId, {
        status: "failed",
        endTime: Date.now(),
        error: errorMsg,
      });
      throw new Error(`Failed to spawn process [${options.command}]: ${errorMsg}`);
    }
  }

  /**
   * Polls the current execution status and recent stdout/stderr output.
   */
  public pollProcess(idOrTaskId: string, tailChars = 4096): ProcessPollResult {
    const proc = this.substrate.getProcess(idOrTaskId);
    if (!proc) {
      throw new Error(`Process with id or taskId '${idOrTaskId}' not found`);
    }

    const ringBuffer = this.substrate.getBuffer(proc.id);
    const durationMs = (proc.endTime || Date.now()) - proc.startTime;
    const stdoutTail = ringBuffer?.getTail(tailChars, true) || "";

    return {
      processId: proc.id,
      status: proc.status,
      exitCode: proc.exitCode,
      durationMs,
      stdoutTail,
      stderrTail: "", // Combined in the ring buffer
      totalBytesRead: proc.totalBytesRead,
      watchMatches: proc.watchMatches,
    };
  }

  /**
   * Sends text input to child process's stdin.
   */
  public sendInput(idOrTaskId: string, input: string): boolean {
    const proc = this.substrate.getProcess(idOrTaskId);
    if (!proc) return false;
    const child = this.childHandles.get(proc.id);
    if (!child || !child.stdin || child.killed) return false;

    try {
      child.stdin.write(input.endsWith("\n") ? input : `${input}\n`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sends termination signal to the process.
   */
  public killProcess(idOrTaskId: string, signal: NodeJS.Signals = "SIGTERM"): boolean {
    const proc = this.substrate.getProcess(idOrTaskId);
    if (!proc) return false;
    this.clearProcessTimeout(proc.id);

    const child = this.childHandles.get(proc.id);
    this.substrate.updateProcess(proc.id, {
      status: "killed",
      endTime: Date.now(),
    });

    if (child && !child.killed) {
      try {
        child.kill(signal);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * Waits for process completion up to timeoutMs.
   */
  public async waitForProcess(idOrTaskId: string, timeoutMs = 30000): Promise<ProcessPollResult> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const poll = this.pollProcess(idOrTaskId);
      if (
        poll.status === "completed" ||
        poll.status === "failed" ||
        poll.status === "killed" ||
        poll.status === "timed_out"
      ) {
        return poll;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return this.pollProcess(idOrTaskId);
  }

  /**
   * Shuts down all active child processes (called during engine teardown to prevent zombies).
   */
  public shutdownAll(): void {
    for (const [id, timer] of this.timeouts.entries()) {
      clearTimeout(timer);
      this.timeouts.delete(id);
    }

    for (const [id, child] of this.childHandles.entries()) {
      try {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      } catch {
        // Ignore kill errors during emergency shutdown
      }
      this.substrate.updateProcess(id, {
        status: "killed",
        endTime: Date.now(),
      });
    }
    this.childHandles.clear();
    this.processWatchers.clear();
  }

  private evaluateWatchers(processId: string, chunk: string): void {
    const watchers = this.processWatchers.get(processId);
    if (!watchers || watchers.length === 0) return;

    const proc = this.substrate.getProcess(processId);
    if (!proc || proc.strikeCount >= WATCH_STRIKE_LIMIT) return;

    const now = Date.now();
    for (const watcher of watchers) {
      let matched = false;
      if (watcher.isRegex) {
        try {
          const re = new RegExp(watcher.pattern);
          matched = re.test(chunk);
        } catch {
          matched = chunk.includes(watcher.pattern);
        }
      } else {
        matched = chunk.includes(watcher.pattern);
      }

      if (matched) {
        if (now - proc.lastWatchMatchTime < WATCH_COOLDOWN_MS) {
          this.substrate.incrementStrike(processId);
          continue;
        }

        this.substrate.recordWatchMatch(processId, {
          pattern: watcher.pattern,
          matchedText: chunk.trim().slice(0, 256),
          timestamp: now,
          processId,
        });
      }
    }
  }

  private clearProcessTimeout(processId: string): void {
    const timer = this.timeouts.get(processId);
    if (timer) {
      clearTimeout(timer);
      this.timeouts.delete(processId);
    }
  }
}
