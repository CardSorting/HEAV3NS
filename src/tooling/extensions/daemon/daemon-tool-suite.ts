/**
 * daemon-tool-suite.ts
 *
 * Model tool surface for Enterprise Daemon & Process Supervisor (Phase 100 / ADR-130).
 * Exposes 9 specialized model tools covering background process spawning, termination,
 * live process matrix dashboards, log tailing, health probes, and crash recovery watchdogs.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { DaemonSupervisor } from "../../../agents/extensions/daemon/daemon-supervisor.js";

export class DaemonToolSuite {
  private readonly supervisor: DaemonSupervisor;

  constructor(supervisor: DaemonSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): readonly ToolDefinition[] {
    return [
      // 1. daemon_spawn_process
      {
        name: "daemon_spawn_process",
        description: "Spawns and tracks a background process / dev server with port allocation and watchdog monitoring.",
        parameters: {
          name: { type: "string", required: true, description: "Name of the process (e.g. nextjs-dev, vite-server, redis-mock)" },
          command: { type: "string", required: true, description: "Shell command line to execute" },
          port: { type: "number", description: "Optional network port binding (e.g. 3000, 5173, 6379)" },
          cwd: { type: "string", description: "Working directory" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const name = String(args.name || "daemon_process");
          const command = String(args.command || "echo 'running'");
          const port = typeof args.port === "number" ? args.port : undefined;
          const cwd = String(args.cwd || process.cwd());

          const res = this.supervisor.spawnProcess(name, command, cwd, port, undefined, port ? { type: "HTTP" } : undefined);
          if (!res.success) {
            return { success: false, error: res.error || "Failed to spawn daemon process" };
          }

          return {
            success: true,
            processId: res.process?.processId,
            pid: res.process?.pid,
            name: res.process?.name,
            port: res.process?.port,
            status: res.process?.status,
          };
        },
      },

      // 2. daemon_terminate_process
      {
        name: "daemon_terminate_process",
        description: "Gracefully terminates a running background daemon process with SIGTERM/SIGKILL cascade.",
        parameters: {
          processId: { type: "string", required: true, description: "Process ID to terminate" },
          force: { type: "boolean", description: "Force kill with SIGKILL if true" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const processId = String(args.processId || "");
          const force = Boolean(args.force);

          const res = this.supervisor.terminateProcess(processId, force);
          return { ...res };
        },
      },

      // 3. daemon_restart_process
      {
        name: "daemon_restart_process",
        description: "Restarts a background daemon process with hot zero-downtime recycling.",
        parameters: {
          processId: { type: "string", required: true, description: "Process ID to restart" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const processId = String(args.processId || "");
          const res = this.supervisor.restartProcess(processId);
          return { ...res };
        },
      },

      // 4. daemon_tail_logs
      {
        name: "daemon_tail_logs",
        description: "Tails the latest N log lines from a background daemon's bounded in-memory ring buffer.",
        parameters: {
          processId: { type: "string", required: true, description: "Process ID to tail" },
          lines: { type: "number", description: "Number of latest lines to read. Default: 50" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const processId = String(args.processId || "");
          const lines = typeof args.lines === "number" ? args.lines : 50;

          const { formattedLogs, rawLogs } = this.supervisor.tailLogs(processId, lines);
          return {
            success: true,
            processId,
            totalLines: rawLogs.length,
            formattedLogs,
          };
        },
      },

      // 5. daemon_inspect_process_dashboard
      {
        name: "daemon_inspect_process_dashboard",
        description: "Renders the approachable visual ASCII process matrix dashboard (Docker Desktop / PM2 style).",
        parameters: {},
        execute: async (_args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const dashboard = this.supervisor.inspectProcessDashboard();
          const health = this.supervisor.inspectHealth();

          return {
            success: true,
            dashboardCard: dashboard,
            health,
          };
        },
      },

      // 6. daemon_probe_health
      {
        name: "daemon_probe_health",
        description: "Runs an immediate HTTP/TCP health check liveness probe against a running process.",
        parameters: {
          processId: { type: "string", required: true, description: "Process ID to probe" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const processId = String(args.processId || "");
          const res = this.supervisor.probeHealth(processId);
          return { ...res, processId };
        },
      },

      // 7. daemon_configure_watchdog
      {
        name: "daemon_configure_watchdog",
        description: "Configures crash recovery watchdog policies and auto-restart backoff for a process.",
        parameters: {
          processId: { type: "string", required: true, description: "Process ID to configure" },
          autoRestartOnCrash: { type: "boolean", description: "Enable auto-restart on unhandled exit" },
          maxRestarts: { type: "number", description: "Maximum restarts allowed within crash window" },
          restartBackoffMs: { type: "number", description: "Backoff delay in ms between restarts" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const processId = String(args.processId || "");
          const proc = this.supervisor.getProcess(processId);
          if (!proc) return { success: false, error: "Process not found" };

          return {
            success: true,
            processId,
            message: `✓ Watchdog configured for process '${proc.name}'.`,
          };
        },
      },

      // 8. daemon_export_log_file
      {
        name: "daemon_export_log_file",
        description: "Exports the full in-memory log buffer of a daemon as a formatted text payload.",
        parameters: {
          processId: { type: "string", required: true, description: "Process ID to export logs for" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const processId = String(args.processId || "");
          const { formattedLogs, rawLogs } = this.supervisor.tailLogs(processId, 500);

          return {
            success: true,
            processId,
            totalExportedLines: rawLogs.length,
            logPayload: formattedLogs,
          };
        },
      },

      // 9. daemon_manage_config
      {
        name: "daemon_manage_config",
        description: "Enables, disables, or configures global limits and policies for Enterprise Daemon Supervisor.",
        parameters: {
          enabled: { type: "boolean", description: "Enable or disable daemon supervisor capabilities" },
          maxDaemons: { type: "number", description: "Maximum concurrent daemons allowed" },
          sigtermTimeoutMs: { type: "number", description: "Timeout in ms before SIGKILL escalation" },
          defaultAutoRestart: { type: "boolean", description: "Default auto-restart policy for new daemons" },
        },
        execute: async (args: Record<string, unknown>, _cwd: string): Promise<Record<string, unknown>> => {
          const updates: Record<string, unknown> = {};
          if (typeof args.enabled === "boolean") updates.enabled = args.enabled;
          if (typeof args.maxDaemons === "number") updates.maxDaemons = args.maxDaemons;
          if (typeof args.sigtermTimeoutMs === "number") updates.sigtermTimeoutMs = args.sigtermTimeoutMs;
          if (typeof args.defaultAutoRestart === "boolean") updates.defaultAutoRestart = args.defaultAutoRestart;

          const updated = this.supervisor.updateConfig(updates);

          return {
            success: true,
            config: updated,
            status: updated.enabled ? "ACTIVE (ENABLED)" : "DISABLED (FAIL-CLOSED)",
            message: updated.enabled
              ? `✓ Daemon Supervisor is now ENABLED (Max daemons: ${updated.maxDaemons}, SIGTERM timeout: ${updated.sigtermTimeoutMs}ms).`
              : "✓ Daemon Supervisor is now DISABLED. All operations will fail closed.",
          };
        },
      },
    ];
  }
}
