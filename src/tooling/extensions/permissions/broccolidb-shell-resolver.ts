/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 188: Zero-Dependency Broccoli Shell Environment Resolver
 *
 * Lifted from external source workspace/codemarie-new/src/utils/shell.ts.
 * Platform-aware shell path detection (detectDefaultShell), system shell profile map generator (getSystemShellProfiles),
 * and terminal execution argument composition for macOS, Linux, and Windows. Zero external npm dependencies.
 */

import * as os from "node:os";

export interface ShellProfile {
  name: string;
  executable: string;
  args: string[];
}

export class BroccoliShellEnvironmentResolver {
  private readonly platform: NodeJS.Platform;

  constructor(platform: NodeJS.Platform = os.platform()) {
    this.platform = platform;
  }

  /**
   * Detects default shell path based on platform environment variables.
   */
  public detectDefaultShell(): string {
    const envShell = process.env.SHELL;
    if (envShell) return envShell;

    if (this.platform === "win32") {
      return process.env.COMSPEC || "C:\\Windows\\System32\\cmd.exe";
    } else if (this.platform === "darwin") {
      return "/bin/zsh";
    } else {
      return "/bin/bash";
    }
  }

  /**
   * Generates shell profiles supported by the operating system.
   */
  public getSystemShellProfiles(): ShellProfile[] {
    const defaultShell = this.detectDefaultShell();

    if (this.platform === "win32") {
      return [
        { name: "PowerShell", executable: "pwsh.exe", args: ["-NoProfile"] },
        { name: "CMD", executable: "cmd.exe", args: [] },
      ];
    } else if (this.platform === "darwin") {
      return [
        { name: "zsh", executable: defaultShell || "/bin/zsh", args: ["-l"] },
        { name: "bash", executable: "/bin/bash", args: ["-l"] },
      ];
    } else {
      return [
        { name: "bash", executable: defaultShell || "/bin/bash", args: ["-l"] },
        { name: "sh", executable: "/bin/sh", args: [] },
      ];
    }
  }

  /**
   * Composes execution invocation arguments for a target command string.
   */
  public composeInvocation(command: string): { executable: string; args: string[] } {
    const shell = this.detectDefaultShell();
    const isWindows = this.platform === "win32";

    if (isWindows) {
      if (shell.toLowerCase().endsWith("pwsh.exe") || shell.toLowerCase().endsWith("powershell.exe")) {
        return { executable: shell, args: ["-NoProfile", "-Command", command] };
      }
      return { executable: shell, args: ["/d", "/s", "/c", command] };
    }

    return { executable: shell, args: ["-c", command] };
  }
}
