/**
 * terminal-diagnostics-engine.ts
 *
 * Pattern matching, exit code analysis, and actionable terminal diagnostic hint synthesis
 * (Phase 110 / ADR-086 / Target #43).
 */

import type {
  TerminalDiagnosticHint,
  TerminalExecutionDiagnostics,
} from "../../../core/contracts/heredoc-terminal.contracts.js";

export class TerminalDiagnosticsEngine {
  /**
   * Diagnose terminal execution output and exit code to produce actionable hints.
   */
  public diagnose(exitCode: number, stdout: string, stderr: string, executionTimeMs?: number): TerminalExecutionDiagnostics {
    if (exitCode === 0) {
      return {
        exitCode: 0,
        stdout,
        stderr,
        executionTimeMs,
        isRecoverable: true,
        allHints: [],
        rootCauseSummary: "Command executed successfully with exit code 0",
      };
    }

    const combinedOutput = `${stdout}\n${stderr}`;
    const hints: TerminalDiagnosticHint[] = [];

    // 1. Python missing module
    const pyModuleMatch = combinedOutput.match(/ModuleNotFoundError:\s+No module named\s+['"]([^'"]+)['"]/);
    if (pyModuleMatch) {
      const mod = pyModuleMatch[1];
      hints.push({
        category: "missing_module",
        title: `Missing Python Module '${mod}'`,
        description: `The Python interpreter failed because the module '${mod}' is not installed in the active environment.`,
        suggestedCommand: `pip install ${mod}`,
        confidence: 0.95,
        matchedSignature: pyModuleMatch[0],
      });
    }

    // 2. Node.js missing module
    const nodeModuleMatch = combinedOutput.match(/Error:\s+Cannot find module\s+['"]([^'"]+)['"]/);
    if (nodeModuleMatch) {
      const mod = nodeModuleMatch[1];
      hints.push({
        category: "missing_module",
        title: `Missing Node.js Module '${mod}'`,
        description: `Node.js failed to resolve module '${mod}'.`,
        suggestedCommand: `npm install ${mod}`,
        confidence: 0.95,
        matchedSignature: nodeModuleMatch[0],
      });
    }

    // 3. Port collision (EADDRINUSE)
    const portMatch = combinedOutput.match(/(?:EADDRINUSE|address already in use|bind: Address already in use)[:\s]+.*?(\d{2,5})/i) ||
      combinedOutput.match(/port\s+(\d{2,5})\s+is already in use/i);
    if (portMatch) {
      const port = portMatch[1];
      hints.push({
        category: "port_collision",
        title: `Port Collision on ${port}`,
        description: `Another process is actively listening on TCP port ${port}.`,
        suggestedCommand: `lsof -i :${port} -t | xargs kill -9`,
        confidence: 0.92,
        matchedSignature: portMatch[0],
      });
    }

    // 4. Missing command / command not found
    const cmdNotFoundMatch = combinedOutput.match(/(?:command not found|is not recognized as an internal or external command):\s*(\S+)/i) ||
      combinedOutput.match(/(\S+):\s*command not found/i);
    if (cmdNotFoundMatch) {
      const cmd = cmdNotFoundMatch[1].replace(/['"`]/g, "");
      hints.push({
        category: "missing_command",
        title: `Command Not Found: '${cmd}'`,
        description: `The executable '${cmd}' was not found in PATH.`,
        suggestedCommand: `which ${cmd} || brew install ${cmd} || apt-get install ${cmd}`,
        confidence: 0.9,
        matchedSignature: cmdNotFoundMatch[0],
      });
    }

    // 5. Permission denied (EACCES)
    const permMatch = combinedOutput.match(/(?:Permission denied|EACCES: permission denied)/i);
    if (permMatch) {
      hints.push({
        category: "permission_denied",
        title: "Permission Denied (EACCES)",
        description: "The command attempted to access or modify a protected file or resource without sufficient privileges.",
        suggestedCommand: "chmod +x <file> # or verify user ownership",
        confidence: 0.85,
        matchedSignature: permMatch[0],
      });
    }

    // 6. Git merge conflict / detached HEAD
    const gitConflictMatch = combinedOutput.match(/CONFLICT\s+\(content\):\s+Merge conflict in\s+(\S+)/);
    if (gitConflictMatch) {
      const file = gitConflictMatch[1];
      hints.push({
        category: "git_conflict",
        title: `Git Merge Conflict in ${file}`,
        description: `Automatic merge failed in ${file}. Manual resolution required.`,
        suggestedCommand: `git status && git diff ${file}`,
        confidence: 0.95,
        matchedSignature: gitConflictMatch[0],
      });
    }

    // 7. Generic non-zero fallback
    if (hints.length === 0) {
      hints.push({
        category: "generic",
        title: `Command Failed with Exit Code ${exitCode}`,
        description: stderr.trim() || stdout.trim() || `Process exited with error code ${exitCode}`,
        confidence: 0.5,
      });
    }

    const primaryHint = hints[0];
    const isRecoverable = hints.some((h) => h.category !== "generic");

    return {
      exitCode,
      stdout,
      stderr,
      executionTimeMs,
      isRecoverable,
      primaryHint,
      allHints: hints,
      rootCauseSummary: primaryHint ? primaryHint.title : `Non-zero exit code ${exitCode}`,
    };
  }

  /**
   * Formats terminal diagnostics into a concise human-readable string.
   */
  public formatTerminalDiagnostics(diagnostics: TerminalExecutionDiagnostics): string {
    if (diagnostics.exitCode === 0) {
      return "[TERMINAL-DIAGNOSTICS] Success (exit code 0)";
    }
    const cat = diagnostics.primaryHint ? diagnostics.primaryHint.category.toUpperCase() : "ERROR";
    const hintStr = diagnostics.primaryHint?.suggestedCommand
      ? ` -> Suggestion: \`${diagnostics.primaryHint.suggestedCommand}\``
      : "";
    return `[TERMINAL-DIAGNOSTICS:${cat}] Exit Code ${diagnostics.exitCode} (${diagnostics.rootCauseSummary})${hintStr}`;
  }
}
