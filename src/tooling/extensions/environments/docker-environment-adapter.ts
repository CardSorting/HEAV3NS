import { exec } from "node:child_process";
import { promisify } from "node:util";
import type {
  ExecutionBackendType,
  ExecutionCommandResult,
  ExecutionCommandSpec,
  IExecutionEnvironmentAdapter,
  ISecretScrubber,
  SecurityIsolationProfile,
} from "../../../core/contracts/environment.contracts.js";

const execAsync = promisify(exec);

/**
 * Hardened Docker Execution Environment Adapter.
 *
 * Runs commands inside isolated container sandboxes with dropped capabilities,
 * no new privileges, and memory/PID limits.
 */
export class DockerEnvironmentAdapter implements IExecutionEnvironmentAdapter {
  readonly backendType: ExecutionBackendType = "docker";
  private readonly secretScrubber: ISecretScrubber;
  private readonly defaultImage: string;
  private readonly defaultProfile: SecurityIsolationProfile;

  constructor(
    secretScrubber: ISecretScrubber,
    defaultImage: string = "node:22-alpine",
    profile?: Partial<SecurityIsolationProfile>
  ) {
    this.secretScrubber = secretScrubber;
    this.defaultImage = defaultImage;
    this.defaultProfile = {
      capDropAll: true,
      noNewPrivileges: true,
      readOnlyRoot: false,
      secretScrubbing: true,
      pidLimit: 100,
      memoryLimitMb: 512,
      timeoutMs: 30000,
      ...profile,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execAsync("docker --version");
      return stdout.includes("Docker version");
    } catch {
      return false;
    }
  }

  synthesizeDockerArgs(spec: ExecutionCommandSpec): readonly string[] {
    const cwd = spec.cwd ?? process.cwd();
    const args: string[] = [
      "run",
      "--rm",
      "-i",
      "-w",
      "/workspace",
      "-v",
      `${cwd}:/workspace`,
    ];

    if (this.defaultProfile.capDropAll) {
      args.push("--cap-drop", "ALL");
    }
    if (this.defaultProfile.noNewPrivileges) {
      args.push("--security-opt", "no-new-privileges");
    }
    if (this.defaultProfile.pidLimit > 0) {
      args.push("--pids-limit", String(this.defaultProfile.pidLimit));
    }
    if (this.defaultProfile.memoryLimitMb > 0) {
      args.push("-m", `${this.defaultProfile.memoryLimitMb}m`);
    }

    // Add clean environment variables
    const baseEnv = spec.env ?? (process.env as Record<string, string>);
    const cleanEnv = this.secretScrubber.scrubEnvironment(baseEnv);
    for (const [k, v] of Object.entries(cleanEnv)) {
      if (k.length > 0 && /^[A-Z0-9_]+$/i.test(k) && !k.includes("PATH")) {
        args.push("-e", `${k}=${v}`);
      }
    }

    args.push(this.defaultImage);

    // Command
    const cmdStr = spec.args && spec.args.length > 0
      ? `${spec.command} ${spec.args.join(" ")}`
      : spec.command;
    args.push("sh", "-c", cmdStr);

    return args;
  }

  async executeCommand(spec: ExecutionCommandSpec): Promise<ExecutionCommandResult> {
    const startedAt = Date.now();
    const cwd = spec.cwd ?? process.cwd();
    const timeoutMs = spec.timeoutMs ?? this.defaultProfile.timeoutMs;

    const available = await this.isAvailable();
    if (!available) {
      return {
        stdout: "",
        stderr: "Docker daemon is not available or not installed in current environment.",
        exitCode: 127,
        durationMs: Date.now() - startedAt,
        timedOut: false,
        backendUsed: "docker",
        workingDirectory: cwd,
      };
    }

    const dockerArgs = this.synthesizeDockerArgs(spec);
    const fullCmd = `docker ${dockerArgs.map((a) => (a.includes(" ") || a.includes(":") ? `"${a}"` : a)).join(" ")}`;

    try {
      const { stdout, stderr } = await execAsync(fullCmd, {
        cwd,
        timeout: timeoutMs,
      });

      return {
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: 0,
        durationMs: Date.now() - startedAt,
        timedOut: false,
        backendUsed: "docker",
        workingDirectory: cwd,
      };
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string; code?: number; killed?: boolean };
      return {
        stdout: execErr.stdout?.toString() ?? "",
        stderr: execErr.stderr?.toString() ?? (err instanceof Error ? err.message : String(err)),
        exitCode: execErr.code ?? 1,
        durationMs: Date.now() - startedAt,
        timedOut: Boolean(execErr.killed),
        backendUsed: "docker",
        workingDirectory: cwd,
      };
    }
  }
}
