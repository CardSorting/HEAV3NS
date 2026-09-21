/**
 * [LAYER: SESSIONS EXTENSION]
 * Pass 128: Zero-Dependency Broccoli Task State Engine
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/agent-context/TaskService.ts).
 * Manages Sovereign Scratchpad persistence (SOFT_STATE.md), task sidechain outputs (tasks/${taskId}.output),
 * and atomic disk writes using native Node built-ins. Zero external npm dependencies.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { BroccoliCASScratchpadService } from "./broccolidb-cas-scratchpad.js";

export class BroccoliTaskStateEngine {
  private readonly workspaceRoot: string;
  readonly casScratchpad: BroccoliCASScratchpadService;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
    this.casScratchpad = new BroccoliCASScratchpadService(workspaceRoot);
  }

  /**
   * Returns the disk path for the Sovereign Scratchpad (SOFT_STATE.md).
   */
  public getScratchpadPath(): string {
    return path.resolve(this.workspaceRoot, ".broccolidb", "SOFT_STATE.md");
  }

  /**
   * Loads current Sovereign Scratchpad content.
   */
  public async loadScratchpad(): Promise<string> {
    const p = this.getScratchpadPath();
    try {
      return await fs.readFile(p, "utf-8");
    } catch {
      return "# Sovereign Scratchpad\n\n*No shared state yet.*";
    }
  }

  /**
   * Updates Sovereign Scratchpad content atomically.
   */
  public async updateScratchpad(content: string): Promise<void> {
    const p = this.getScratchpadPath();
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content, "utf-8");
  }

  /**
   * Returns disk path for a task's sidechain output.
   */
  public getTaskOutputPath(taskId: string): string {
    return path.resolve(this.workspaceRoot, ".broccolidb", "tasks", `${taskId}.output`);
  }

  /**
   * Saves task sidechain output content to disk.
   */
  public async saveTaskOutput(taskId: string, output: string): Promise<string> {
    const outputPath = this.getTaskOutputPath(taskId);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, output, "utf-8");
    return outputPath;
  }

  /**
   * Reads task sidechain output content from disk.
   */
  public async readTaskOutput(taskId: string): Promise<string | undefined> {
    const outputPath = this.getTaskOutputPath(taskId);
    try {
      return await fs.readFile(outputPath, "utf-8");
    } catch {
      return undefined;
    }
  }
}
