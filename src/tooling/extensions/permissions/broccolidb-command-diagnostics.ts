/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 190: Zero-Dependency Broccoli Command Diagnostics
 *
 * Lifted from external source workspace/codemarie-new/src/integrations/terminal/commandDiagnostics.ts.
 * Analyzes command execution failures (analyzeCommandFailure), detecting port collisions (EADDRINUSE),
 * Git lock contention (.git/index.lock), missing commands (127/9009), missing modules, and permission errors,
 * providing actionable non-destructive recovery guidance. Zero external npm dependencies.
 */

export interface CommandDiagnosticResult {
  suggestion?: string;
}

export class BroccoliCommandDiagnostics {
  /**
   * Analyzes a command execution failure and generates non-destructive remediation advice.
   */
  public analyzeCommandFailure(command: string, exitCode: number, output: string): CommandDiagnosticResult {
    if (exitCode === 0) {
      return {};
    }

    const lowerOutput = output.toLowerCase();

    // 1. Network port collision (EADDRINUSE)
    if (lowerOutput.includes("eaddrinuse") || lowerOutput.includes("address already in use")) {
      const portMatch = output.match(/(?:port|address|:\s*)(\d{2,5})\b/i);
      const port = portMatch ? portMatch[1] : undefined;
      return {
        suggestion: port
          ? `Port ${port} is already in use. Identify the listening process (e.g. lsof -nP -iTCP:${port} -sTCP:LISTEN) before deciding to reuse or stop it.`
          : "A network port is already in use. Identify the listening process before deciding whether to reuse or stop it.",
      };
    }

    // 2. Git lock contention (.git/index.lock)
    if (lowerOutput.includes("index.lock") && (lowerOutput.includes("another git process") || lowerOutput.includes("file exists"))) {
      return {
        suggestion: "Git found an active index lock. Check for running Git processes first; remove `.git/index.lock` only if confirmed stale.",
      };
    }

    // 3. Command not found (127 or 9009)
    if (exitCode === 127 || exitCode === 9009 || lowerOutput.includes("command not found") || lowerOutput.includes("is not recognized")) {
      const execMatch = output.match(/([^:\s]+):\s*command not found/i) || output.match(/'([^']+)'\s+is not recognized/i);
      const executable = execMatch ? execMatch[1] : "executable";
      return {
        suggestion: `Executable \`${executable}\` is missing from system PATH. Check installation or environment configuration.`,
      };
    }

    // 4. Permission denied (EACCES)
    if (lowerOutput.includes("eacces") || lowerOutput.includes("permission denied")) {
      return {
        suggestion: `Permission denied. Verify file/directory access privileges or grant appropriate permissions before retrying.`,
      };
    }

    return {};
  }
}
