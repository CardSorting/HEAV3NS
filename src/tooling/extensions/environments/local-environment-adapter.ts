import { spawn } from "node:child_process";
import type {
  ExecutionBackendType,
  ExecutionCommandResult,
  ExecutionCommandSpec,
  IExecutionEnvironmentAdapter,
  ISecretScrubber,
} from "../../../core/contracts/environment.contracts.js";

/**
 * Deterministic Local Execution Environment Adapter.
 *
 * Spawns child processes locally with strict timeout enforcement,
 * environment secret scrubbing, and bounded stream output capture.
 */
export class LocalEnvironmentAdapter implements IExecutionEnvironmentAdapter {
  readonly backendType: ExecutionBackendType = "local";
  private readonly secretScrubber: ISecretScrubber;

  constructor(secretScrubber: ISecretScrubber) {
    this.secretScrubber = secretScrubber;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async executeCommand(spec: ExecutionCommandSpec): Promise<ExecutionCommandResult> {
    const startedAt = Date.now();
    const timeoutMs = spec.timeoutMs ?? 30000;
    const cwd = spec.cwd ?? process.cwd();

    // Prepare clean environment without secrets
    const baseEnv = spec.env ?? (process.env as Record<string, string>);
    const cleanEnv = this.secretScrubber.scrubEnvironment(baseEnv);

    return new Promise<ExecutionCommandResult>((resolve) => {
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let finished = false;

      // Extract binary and args
      const commandParts = spec.command.trim().split(/\s+/);
      const executable = commandParts[0];
      const inlineArgs = commandParts.slice(1);
      const fullArgs = spec.args ? [...inlineArgs, ...spec.args] : inlineArgs;

      // Spawn process
      let child: ReturnType<typeof spawn>;
      try {
        child = spawn(executable, fullArgs, {
          cwd,
          env: cleanEnv,
          shell: true,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return resolve({
          stdout: "",
          stderr: `Spawn error: ${errorMsg}`,
          exitCode: 1,
          durationMs: Date.now() - startedAt,
          timedOut: false,
          backendUsed: "local",
          workingDirectory: cwd,
        });
      }

      // Timeout timer
      const timer = setTimeout(() => {
        if (!finished) {
          timedOut = true;
          try {
            child.kill("SIGTERM");
            setTimeout(() => {
              if (!finished) child.kill("SIGKILL");
            }, 1000);
          } catch {
            // Ignore kill errors
          }
        }
      }, timeoutMs);

      child.stdout?.on("data", (chunk: Buffer | string) => {
        if (stdout.length < 500000) {
          stdout += chunk.toString();
        }
      });

      child.stderr?.on("data", (chunk: Buffer | string) => {
        if (stderr.length < 500000) {
          stderr += chunk.toString();
        }
      });

      child.on("error", (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve({
          stdout,
          stderr: `${stderr}\nProcess error: ${err.message}`.trim(),
          exitCode: 1,
          durationMs: Date.now() - startedAt,
          timedOut,
          backendUsed: "local",
          workingDirectory: cwd,
        });
      });

      child.on("close", (exitCode) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve({
          stdout,
          stderr,
          exitCode: exitCode ?? (timedOut ? 124 : 0),
          durationMs: Date.now() - startedAt,
          timedOut,
          backendUsed: "local",
          workingDirectory: cwd,
        });
      });
    });
  }
}
