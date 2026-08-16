/**
 * deterministic-subdir-hint-engine.ts
 *
 * Ultra-High-Performance Pure TypeScript Path Extractor, Ancestor Traverser,
 * Workspace Confinement, SHA-256 Digest Calculator & Hint Formatter
 * (Phase 129 / ADR-105 / Target #62).
 */

import { createHash } from "node:crypto";
import path from "node:path";
import type {
  DiscoveredSubdirHint,
  SubdirectoryHintsConfig,
} from "../../../core/contracts/subdirectory-hints.contracts.js";

const PATH_ARG_KEYS = ["path", "file_path", "workdir", "target_path", "destination_path", "source_path"];
const COMMAND_TOOLS = new Set(["terminal", "terminal_run", "shell_execute", "execute_command"]);

export class DeterministicSubdirHintEngine {
  private excludedSetsCache = new WeakMap<string[], Set<string>>();

  private getExcludedSet(excludedDirNames: string[]): Set<string> {
    let set = this.excludedSetsCache.get(excludedDirNames);
    if (!set) {
      set = new Set(excludedDirNames);
      this.excludedSetsCache.set(excludedDirNames, set);
    }
    return set;
  }

  /**
   * Calculates SHA-256 hex digest of string content.
   */
  public computeDigest(content: string): string {
    return createHash("sha256").update(content.trim(), "utf8").digest("hex");
  }

  /**
   * Checks if candidate directory path is within the workspace workingDir.
   */
  public isWithinWorkspace(dirPath: string, workingDir: string): boolean {
    const d = dirPath.startsWith("/") ? dirPath : path.resolve(dirPath);
    const w = workingDir.startsWith("/") ? workingDir : path.resolve(workingDir);
    return d === w || d.startsWith(w + "/");
  }

  /**
   * Checks if directory name is in excluded list (e.g. node_modules, .git, vendor).
   */
  public isExcludedDirectory(
    dirPath: string,
    workingDir: string,
    excludedSet: Set<string> | string[]
  ): boolean {
    if (dirPath === workingDir) return false;

    const rel = dirPath.startsWith(workingDir + "/") ? dirPath.slice(workingDir.length + 1) : dirPath;
    const set = Array.isArray(excludedSet) ? this.getExcludedSet(excludedSet) : excludedSet;

    let start = 0;
    for (let i = 0; i <= rel.length; i++) {
      if (i === rel.length || rel[i] === "/" || rel[i] === "\\") {
        const seg = rel.slice(start, i);
        if (seg && set.has(seg)) {
          return true;
        }
        start = i + 1;
      }
    }
    return false;
  }

  /**
   * Extracts path candidate directories from tool arguments.
   */
  public extractCandidateDirectories(
    toolName: string,
    args: Record<string, unknown>,
    config: SubdirectoryHintsConfig
  ): string[] {
    const candidates: string[] = [];
    const workingDir = config.workingDir;
    const excludedSet = this.getExcludedSet(config.excludedDirNames);

    // Direct path arguments
    for (let i = 0; i < PATH_ARG_KEYS.length; i++) {
      const val = args[PATH_ARG_KEYS[i]];
      if (typeof val === "string" && val.length > 0) {
        this.addPathCandidates(val.trim(), workingDir, config, candidates, excludedSet);
      }
    }

    // Command tools (e.g. terminal)
    if (COMMAND_TOOLS.has(toolName)) {
      const cmd = typeof args.command === "string" ? args.command : typeof args.cmd === "string" ? args.cmd : "";
      if (cmd) {
        this.extractPathsFromCommand(cmd, workingDir, config, candidates, excludedSet);
      }
    }

    return candidates;
  }

  /**
   * Walks up ancestors from a resolved directory up to maxAncestorWalk levels.
   */
  public addPathCandidates(
    rawPath: string,
    workingDir: string,
    config: SubdirectoryHintsConfig,
    candidates: string[] | Set<string>,
    excludedSet?: Set<string>
  ): void {
    try {
      const root = workingDir;
      let resolved = rawPath.charCodeAt(0) === 47 ? rawPath : `${root}/${rawPath}`;
      if (resolved.charCodeAt(resolved.length - 1) === 47) {
        resolved = resolved.slice(0, -1);
      }

      // Fast check if file has extension
      const lastSlash = resolved.lastIndexOf("/");
      const lastDot = resolved.lastIndexOf(".");
      if (lastDot > lastSlash) {
        resolved = resolved.slice(0, lastSlash);
      }

      if (resolved !== root && !resolved.startsWith(root + "/")) {
        return;
      }

      const exSet = excludedSet || this.getExcludedSet(config.excludedDirNames);
      if (this.isExcludedDirectory(resolved, root, exSet)) {
        return;
      }

      let current = resolved;
      for (let i = 0; i < config.maxAncestorWalk; i++) {
        if (Array.isArray(candidates)) {
          if (!candidates.includes(current)) {
            candidates.push(current);
          }
        } else {
          candidates.add(current);
        }

        if (current === root) {
          break;
        }
        const slashIdx = current.lastIndexOf("/");
        if (slashIdx <= 0) {
          break;
        }
        current = current.slice(0, slashIdx);
        if (current !== root && !current.startsWith(root + "/")) {
          break;
        }
      }
    } catch {
      // Ignore unparseable paths
    }
  }

  /**
   * Extracts path-like tokens from shell commands.
   */
  public extractPathsFromCommand(
    cmd: string,
    workingDir: string,
    config: SubdirectoryHintsConfig,
    candidates: string[] | Set<string>,
    excludedSet?: Set<string>
  ): void {
    const tokens = cmd.split(/\s+/);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.startsWith("-")) continue;
      if (!token.includes("/") && !token.includes(".")) continue;
      if (token.startsWith("http://") || token.startsWith("https://") || token.startsWith("git@")) continue;

      this.addPathCandidates(token, workingDir, config, candidates, excludedSet);
    }
  }

  /**
   * Formats discovered hints into markdown attachments for tool return messages.
   */
  public formatHintAttachment(hints: DiscoveredSubdirHint[]): string {
    if (!hints || hints.length === 0) return "";

    const blocks = hints.map((h) => {
      const location = h.relativeDirectory ? `in \`${h.relativeDirectory}/\`` : "in project root";
      return `--- Subdirectory Context Hint (${location}: \`${h.filename}\`) ---\n${h.content}\n--- End Context Hint ---`;
    });

    return `\n\n${blocks.join("\n\n")}`;
  }
}
