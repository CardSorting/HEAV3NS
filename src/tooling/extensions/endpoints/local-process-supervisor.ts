/**
 * local-process-supervisor.ts
 *
 * Process supervisor and daemon auto-launcher for local LLM engines (Ollama, llama.cpp).
 * Auto-locates binaries across system PATH and environment, safely launches background
 * server processes, monitors port health, and generates 1-line installation scripts (Phase 105 / ADR-052).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { spawn } from "node:child_process";
import type {
  LocalProviderKind,
  ProcessSpawnResult,
} from "../../../core/contracts/local-endpoints.contracts.js";

export class LocalProcessSupervisor {
  findBinary(provider: LocalProviderKind): string | null {
    const isWindows = process.platform === "win32";
    const binaryNames: Record<LocalProviderKind, string[]> = {
      ollama: isWindows ? ["ollama.exe"] : ["ollama"],
      llamacpp: isWindows ? ["llama-server.exe", "server.exe"] : ["llama-server", "server"],
      lmstudio: isWindows ? ["lms.exe"] : ["lms"],
      vllm: ["vllm"],
      localai: isWindows ? ["local-ai.exe"] : ["local-ai"],
      custom: [],
    };

    const names = binaryNames[provider] || [];
    if (names.length === 0) return null;

    // 1. Search PATH
    const envPath = process.env.PATH || "";
    const pathDirs = envPath.split(path.delimiter);

    for (const dir of pathDirs) {
      if (!dir) continue;
      for (const name of names) {
        const full = path.join(dir, name);
        try {
          if (fs.existsSync(full)) return full;
        } catch {
          // Ignore filesystem access errors
        }
      }
    }

    // 2. Search common installation directories
    const commonPaths: string[] = [
      "/usr/local/bin",
      "/opt/homebrew/bin",
      "/usr/bin",
      "/bin",
      path.join(os.homedir(), ".local", "bin"),
      path.join(os.homedir(), ".ollama", "bin"),
    ];

    if (isWindows) {
      const localAppData = process.env.LOCALAPPDATA || "";
      if (localAppData) {
        commonPaths.push(path.join(localAppData, "Programs", "Ollama"));
      }
    }

    for (const dir of commonPaths) {
      for (const name of names) {
        const full = path.join(dir, name);
        try {
          if (fs.existsSync(full)) return full;
        } catch {
          // Ignore
        }
      }
    }

    return null;
  }

  async startServer(
    provider: LocalProviderKind,
    healthCheckFn?: () => Promise<boolean>,
    customBinPath?: string
  ): Promise<ProcessSpawnResult> {
    const binPath = customBinPath || this.findBinary(provider);

    if (!binPath) {
      const instructions = this.getInstallInstructions(provider);
      return {
        provider,
        started: false,
        message: `${provider.toUpperCase()} executable not found in PATH or standard installation directories.\n${instructions}`,
        commandAttempted: `${provider} serve`,
        alreadyRunning: false,
        error: "Binary not found",
      };
    }

    // Check if already running
    if (healthCheckFn) {
      try {
        const isHealthy = await healthCheckFn();
        if (isHealthy) {
          return {
            provider,
            started: true,
            message: `${provider.toUpperCase()} server is already active and healthy.`,
            commandAttempted: binPath,
            alreadyRunning: true,
          };
        }
      } catch {
        // Not running yet, proceed to spawn
      }
    }

    const spawnArgs = provider === "ollama" ? ["serve"] : [];

    try {
      const child = spawn(binPath, spawnArgs, {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });

      child.unref();

      // Poll health endpoint for up to 6 seconds
      if (healthCheckFn) {
        const started = Date.now();
        while (Date.now() - started < 6000) {
          await new Promise((r) => setTimeout(r, 400));
          try {
            const ok = await healthCheckFn();
            if (ok) {
              return {
                provider,
                started: true,
                pid: child.pid,
                message: `Successfully launched ${provider.toUpperCase()} daemon (PID: ${child.pid}). Server is ready!`,
                commandAttempted: `${binPath} ${spawnArgs.join(" ")}`,
                alreadyRunning: false,
              };
            }
          } catch {
            // Keep polling
          }
        }
      }

      return {
        provider,
        started: true,
        pid: child.pid,
        message: `Spawned ${provider.toUpperCase()} daemon (PID: ${child.pid}). Initializing server...`,
        commandAttempted: `${binPath} ${spawnArgs.join(" ")}`,
        alreadyRunning: false,
      };
    } catch (err: any) {
      return {
        provider,
        started: false,
        message: `Failed to spawn ${provider}: ${err?.message || String(err)}`,
        commandAttempted: `${binPath} ${spawnArgs.join(" ")}`,
        alreadyRunning: false,
        error: err?.message || String(err),
      };
    }
  }

  getInstallInstructions(provider: LocalProviderKind): string {
    const isMac = process.platform === "darwin";
    const isWin = process.platform === "win32";

    if (provider === "ollama") {
      if (isMac) {
        return `Install Ollama on macOS:\n  - Option 1: brew install ollama\n  - Option 2: Download installer at https://ollama.com/download`;
      } else if (isWin) {
        return `Install Ollama on Windows:\n  - Download installer at https://ollama.com/download/windows`;
      } else {
        return `Install Ollama on Linux:\n  - Run: curl -fsSL https://ollama.com/install.sh | sh`;
      }
    }

    if (provider === "llamacpp") {
      if (isMac) {
        return `Install llama.cpp on macOS:\n  - Run: brew install llama.cpp\n  - Then start with: llama-server -m <model.gguf> -c 8192`;
      }
      return `Download llama.cpp binaries from https://github.com/ggerganov/llama.cpp/releases`;
    }

    if (provider === "lmstudio") {
      return `Download LM Studio GUI from https://lmstudio.ai (Start server under the Developer tab on port 1234)`;
    }

    return `Refer to the documentation for ${provider} to install and launch the inference server.`;
  }
}
