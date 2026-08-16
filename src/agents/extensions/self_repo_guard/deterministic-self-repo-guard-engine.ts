/**
 * deterministic-self-repo-guard-engine.ts
 *
 * Pure TypeScript deterministic shell command AST parser, working directory context tracker,
 * and self-repository Git mutation firewall (Phase 138 / ADR-114 / Target #71).
 */

import * as path from "node:path";

import type {
  GitOperationSafety,
  SelfRepoGuardConfig,
  SelfRepoGuardVerdict,
} from "../../../core/contracts/self-repo-guard.contracts.js";
import {
  RESET_WORKTREE_MODES,
  SAFE_GIT_BUILTINS,
  STASH_SAFE_ACTIONS,
  WORKTREE_MUTATING_GIT_COMMANDS,
  WORKTREE_TARGET_ACTIONS,
} from "../../../core/contracts/self-repo-guard.contracts.js";

const SIMPLE_WRAPPERS = new Set<string>(["sudo", "nohup", "setsid", "time", "exec", "builtin", "env"]);
const SHELL_EXECUTABLES = new Set<string>(["bash", "sh", "zsh", "dash", "ksh"]);

export class DeterministicSelfRepoGuardEngine {
  /**
   * Evaluates a full shell command string against a base cwd and running source root.
   */
  public evaluateCommand(
    command: string,
    cwd: string,
    runningSourceRoot: string,
    config: SelfRepoGuardConfig
  ): SelfRepoGuardVerdict {
    if (!config.enabled || !runningSourceRoot) {
      return { allowed: true };
    }

    const normRunningRoot = path.resolve(runningSourceRoot);
    const commandSegments = this.splitCommandChains(command);
    let currentDir = path.resolve(cwd);

    for (const segment of commandSegments) {
      const words = this.tokenizeWords(segment);
      if (words.length === 0) continue;

      const unwrapped = this.unwrapCommandWrappers(words, currentDir);
      const executable = unwrapped.executable.toLowerCase();
      const args = unwrapped.args;
      currentDir = unwrapped.targetDir;

      // Check if command is cd or pushd
      if (executable === "cd" || executable === "pushd") {
        if (args.length > 0 && args[0] !== "-") {
          currentDir = path.resolve(currentDir, args[0]);
        }
        continue;
      }

      // Check if command is git
      if (executable === "git") {
        const gitInspection = this.inspectGitCommand(args, currentDir, normRunningRoot);
        if (!gitInspection.allowed) {
          return gitInspection;
        }
      }

      // Check nested shell execution (-c "<script>")
      if (SHELL_EXECUTABLES.has(executable)) {
        const cIdx = args.findIndex((a) => a === "-c" || a.startsWith("-c"));
        if (cIdx !== -1 && cIdx + 1 < args.length) {
          const nestedScript = args[cIdx + 1];
          const nestedVerdict = this.evaluateCommand(nestedScript, currentDir, normRunningRoot, config);
          if (!nestedVerdict.allowed) {
            return nestedVerdict;
          }
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Classifies a Git subcommand and argument list.
   */
  public classifyGitOperation(subcommand: string, args: readonly string[]): GitOperationSafety {
    const sub = subcommand.toLowerCase();

    if (SAFE_GIT_BUILTINS.has(sub)) {
      return "safe_read";
    }

    if (sub === "reset") {
      const isHard = args.some((a) => RESET_WORKTREE_MODES.has(a) || /^--h(a(r(d)?)?)?$/i.test(a));
      return isHard ? "destructive_worktree" : "safe_staged";
    }

    if (sub === "clean") {
      const isDryRun = args.some((a) => a === "--dry-run" || (a.startsWith("-") && !a.startsWith("--") && a.includes("n")));
      return isDryRun ? "safe_read" : "destructive_worktree";
    }

    if (sub === "restore") {
      const hasStaged = args.some((a) => a === "--staged" || (a.startsWith("-") && a.includes("S")));
      const hasWorktree = args.some((a) => a === "--worktree" || (a.startsWith("-") && a.includes("W")));
      if (hasWorktree || !hasStaged) {
        return "destructive_worktree";
      }
      return "safe_staged";
    }

    if (sub === "stash") {
      const action = args.find((a) => !a.startsWith("-")) || "push";
      return STASH_SAFE_ACTIONS.has(action) ? "safe_read" : "destructive_worktree";
    }

    if (WORKTREE_MUTATING_GIT_COMMANDS.has(sub)) {
      return "destructive_worktree";
    }

    return "unknown";
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  private inspectGitCommand(
    args: readonly string[],
    currentDir: string,
    normRunningRoot: string
  ): SelfRepoGuardVerdict {
    let targetDir = currentDir;
    let subcommand: string | null = null;
    const remainingArgs: string[] = [];

    let i = 0;
    while (i < args.length) {
      const arg = args[i];
      if (arg === "--") {
        i++;
        break;
      }
      if (arg === "-C" && i + 1 < args.length) {
        targetDir = path.resolve(targetDir, args[i + 1]);
        i += 2;
        continue;
      }
      if (arg.startsWith("-C") && arg.length > 2) {
        targetDir = path.resolve(targetDir, arg.substring(2));
        i++;
        continue;
      }
      if (arg.startsWith("--work-tree=")) {
        targetDir = path.resolve(targetDir, arg.split("=")[1]);
        i++;
        continue;
      }
      if (arg === "--work-tree" && i + 1 < args.length) {
        targetDir = path.resolve(targetDir, args[i + 1]);
        i += 2;
        continue;
      }
      if (arg.startsWith("-")) {
        i++;
        continue;
      }
      subcommand = arg;
      i++;
      break;
    }

    while (i < args.length) {
      remainingArgs.push(args[i]);
      i++;
    }

    if (!subcommand) {
      return { allowed: true };
    }

    const normTarget = path.resolve(targetDir);
    const isTargetingRunningRoot =
      normTarget === normRunningRoot || normTarget.startsWith(normRunningRoot + path.sep);

    // Check git worktree remove <root>
    if (subcommand.toLowerCase() === "worktree") {
      const action = remainingArgs.find((a) => !a.startsWith("-"));
      if (action && WORKTREE_TARGET_ACTIONS.has(action.toLowerCase())) {
        const pathArg = remainingArgs.filter((a) => !a.startsWith("-"))[1];
        if (pathArg && path.resolve(currentDir, pathArg) === normRunningRoot) {
          return {
            allowed: false,
            operation: `git worktree ${action}`,
            targetPath: normRunningRoot,
            runningRoot: normRunningRoot,
            reason: `Blocked destructive 'git worktree ${action}' targeting the running agent checkout.`,
            suggestedRemediation: "Use an isolated worktree directory outside the running agent root.",
          };
        }
      }
    }

    if (!isTargetingRunningRoot) {
      // Mutation is in a separate external repository
      return { allowed: true };
    }

    const safety = this.classifyGitOperation(subcommand, remainingArgs);
    if (safety === "destructive_worktree") {
      return {
        allowed: false,
        operation: `git ${subcommand}`,
        targetPath: normTarget,
        runningRoot: normRunningRoot,
        reason: `Blocked 'git ${subcommand}' on the running source checkout '${normRunningRoot}'. Mutating the active worktree causes fatal module skew and crashes.`,
        suggestedRemediation:
          "To test branch changes or historical commits, create an isolated worktree with 'git worktree add /tmp/worktree <branch>' or work in a separate cloned directory.",
      };
    }

    return { allowed: true };
  }

  private unwrapCommandWrappers(
    words: readonly string[],
    currentDir: string
  ): { executable: string; args: string[]; targetDir: string } {
    let index = 0;
    let targetDir = currentDir;

    while (index < words.length) {
      const word = words[index];
      const baseName = path.basename(word.replace(/\\/g, "/")).toLowerCase();

      if (SIMPLE_WRAPPERS.has(baseName)) {
        if (baseName === "env") {
          index++;
          while (index < words.length) {
            const envArg = words[index];
            if (envArg === "-C" && index + 1 < words.length) {
              targetDir = path.resolve(targetDir, words[index + 1]);
              index += 2;
              continue;
            }
            if (envArg.startsWith("-C") && envArg.length > 2) {
              targetDir = path.resolve(targetDir, envArg.substring(2));
              index++;
              continue;
            }
            if (envArg.includes("=") || envArg.startsWith("-")) {
              index++;
              continue;
            }
            break;
          }
          continue;
        }

        index++;
        while (index < words.length && words[index].startsWith("-")) {
          index++;
        }
        continue;
      }

      return {
        executable: word,
        args: words.slice(index + 1),
        targetDir,
      };
    }

    return {
      executable: words[0] || "",
      args: words.slice(1),
      targetDir,
    };
  }

  private splitCommandChains(command: string): string[] {
    const segments: string[] = [];
    let current = "";
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < command.length; i++) {
      const char = command[i];

      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        current += char;
        continue;
      }
      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        current += char;
        continue;
      }

      if (!inSingleQuote && !inDoubleQuote) {
        if (char === "\n" || char === ";") {
          if (current.trim()) segments.push(current.trim());
          current = "";
          continue;
        }
        if (
          (char === "&" && command[i + 1] === "&") ||
          (char === "|" && command[i + 1] === "|")
        ) {
          if (current.trim()) segments.push(current.trim());
          current = "";
          i++;
          continue;
        }
        if (char === "|") {
          if (current.trim()) segments.push(current.trim());
          current = "";
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      segments.push(current.trim());
    }

    return segments;
  }

  private tokenizeWords(commandSegment: string): string[] {
    const words: string[] = [];
    let current = "";
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < commandSegment.length; i++) {
      const char = commandSegment[i];

      if (char === "'" && !inDouble) {
        inSingle = !inSingle;
        continue;
      }
      if (char === '"' && !inSingle) {
        inDouble = !inDouble;
        continue;
      }

      if (!inSingle && !inDouble && /\s/.test(char)) {
        if (current.length > 0) {
          words.push(current);
          current = "";
        }
        continue;
      }

      current += char;
    }

    if (current.length > 0) {
      words.push(current);
    }

    return words;
  }
}
