/**
 * process-tool-suite.ts
 *
 * Model tool suite exposing interactive background process management to the AI agent:
 * - `process_spawn`: Starts a background command.
 * - `process_poll`: Checks process status and recent output.
 * - `process_send_input`: Sends input to a running process.
 * - `process_kill`: Terminates a running process.
 * - `process_list`: Lists active and historical processes.
 */

import { ProcessSupervisorEngine } from "../../../agents/extensions/process/process-supervisor-engine.js";
import { BroccoliProcessSubstrate } from "../../../sessions/extensions/process/broccoli-process-substrate.js";
import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";

export class ProcessToolSuite {
  private readonly supervisor: ProcessSupervisorEngine;
  private readonly substrate: BroccoliProcessSubstrate;

  constructor(
    supervisor: ProcessSupervisorEngine,
    substrate: BroccoliProcessSubstrate
  ) {
    this.supervisor = supervisor;
    this.substrate = substrate;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "process_spawn",
        description: "Spawns a long-running command in the background (e.g. dev server, build watcher, test runner).",
        parameters: {
          command: {
            type: "string",
            required: true,
            description: "The shell command to execute in the background.",
          },
          taskId: {
            type: "string",
            required: false,
            description: "Optional task or subtask identifier.",
          },
          cwd: {
            type: "string",
            required: false,
            description: "Optional working directory.",
          },
          timeoutMs: {
            type: "number",
            required: false,
            description: "Optional timeout in milliseconds before automatically terminating.",
          },
        },
        execute: async (args: Record<string, unknown>, defaultCwd: string) => {
          const command = String(args.command || "");
          const taskId = args.taskId ? String(args.taskId) : undefined;
          const cwd = args.cwd ? String(args.cwd) : defaultCwd;
          const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : undefined;

          try {
            const handle = await this.supervisor.spawnProcess({
              command,
              taskId,
              cwd,
              timeoutMs,
            });
            return {
              success: true,
              processId: handle.id,
              pid: handle.pid,
              command: handle.command,
              status: handle.status,
            };
          } catch (err) {
            return {
              success: false,
              command,
              error: String(err),
            };
          }
        },
      },
      {
        name: "process_poll",
        description: "Polls a background process for its current status, exit code, and recent output tail.",
        parameters: {
          processId: {
            type: "string",
            required: true,
            description: "The process ID or task ID returned by process_spawn.",
          },
          tailChars: {
            type: "number",
            required: false,
            description: "Maximum characters of recent output to return (default 4096).",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const processId = String(args.processId || "");
          const tailChars = typeof args.tailChars === "number" ? args.tailChars : 4096;

          try {
            const poll = this.supervisor.pollProcess(processId, tailChars);
            return {
              success: true,
              ...poll,
            };
          } catch (err) {
            return {
              success: false,
              processId,
              error: String(err),
            };
          }
        },
      },
      {
        name: "process_send_input",
        description: "Sends interactive standard input (stdin) to a running background process.",
        parameters: {
          processId: {
            type: "string",
            required: true,
            description: "The process ID or task ID.",
          },
          input: {
            type: "string",
            required: true,
            description: "The text input string to write to process stdin.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const processId = String(args.processId || "");
          const input = String(args.input || "");
          const sent = this.supervisor.sendInput(processId, input);
          return {
            success: sent,
            processId,
          };
        },
      },
      {
        name: "process_kill",
        description: "Sends a termination signal (SIGTERM or SIGKILL) to a running background process.",
        parameters: {
          processId: {
            type: "string",
            required: true,
            description: "The process ID or task ID to terminate.",
          },
          signal: {
            type: "string",
            required: false,
            description: "Signal to send (e.g. 'SIGTERM', 'SIGKILL', default 'SIGTERM').",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const processId = String(args.processId || "");
          const signal = (args.signal ? String(args.signal) : "SIGTERM") as NodeJS.Signals;
          const killed = this.supervisor.killProcess(processId, signal);
          return {
            success: killed,
            processId,
            signal,
          };
        },
      },
      {
        name: "process_list",
        description: "Lists all active background processes and recent process history.",
        parameters: {},
        execute: async () => {
          const active = this.substrate.listActive();
          const history = this.substrate.listHistory();
          return {
            activeCount: active.length,
            historyCount: history.length,
            active: active.map((p) => ({
              id: p.id,
              pid: p.pid,
              command: p.command,
              status: p.status,
              durationMs: Date.now() - p.startTime,
              totalBytesRead: p.totalBytesRead,
            })),
            recentHistory: history.slice(-10).map((p) => ({
              id: p.id,
              command: p.command,
              status: p.status,
              exitCode: p.exitCode,
              durationMs: (p.endTime || Date.now()) - p.startTime,
            })),
          };
        },
      },
    ];
  }
}
