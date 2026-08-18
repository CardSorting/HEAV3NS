/**
 * atomic-mutation-supervisor.ts
 *
 * Master File Mutation Supervisor.
 * Coordinates unified diff / V4A patch application, paginated reads with truncation guards,
 * contiguous & multi-chunk file replacements, and transactional rollback.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  FilePaginatedReadResult,
  FilePaginationOptions,
  PatchApplyResult,
  PatchOperation,
} from "../../../core/contracts/patch-mutation.contracts.js";
import { DeterministicPatchEngine } from "../../../tooling/extensions/patch/deterministic-patch-engine.js";
import { BroccoliPatchSubstrate } from "../../../sessions/extensions/patch/broccoli-patch-substrate.js";

const DEFAULT_MAX_READ_CHARS = 100_000;

export class AtomicMutationSupervisor {
  private readonly patchEngine: DeterministicPatchEngine;
  private readonly substrate: BroccoliPatchSubstrate;

  constructor(
    patchEngine?: DeterministicPatchEngine,
    substrate?: BroccoliPatchSubstrate
  ) {
    this.patchEngine = patchEngine ?? new DeterministicPatchEngine();
    this.substrate = substrate ?? new BroccoliPatchSubstrate();
  }

  public getPatchEngine(): DeterministicPatchEngine {
    return this.patchEngine;
  }

  public getSubstrate(): BroccoliPatchSubstrate {
    return this.substrate;
  }

  /**
   * Applies a Unified Diff or V4A patch across multiple files.
   */
  public async applyPatch(
    patchText: string,
    options: { format?: "unified" | "v4a" | "auto"; dryRun?: boolean; cwd?: string } = {}
  ): Promise<PatchApplyResult> {
    const cwd = options.cwd ?? process.cwd();
    const format = options.format ?? (patchText.includes("*** Begin Patch") ? "v4a" : "unified");

    const operations: PatchOperation[] =
      format === "v4a"
        ? this.patchEngine.parseV4APatch(patchText)
        : this.patchEngine.parseUnifiedDiff(patchText);

    if (operations.length === 0) {
      return {
        success: false,
        modifiedFiles: [],
        errors: ["No valid patch operations found in patch input"],
        dryRun: !!options.dryRun,
      };
    }

    const modifiedFiles: string[] = [];
    const errors: string[] = [];
    const rollbackMap = new Map<string, string | null>(); // filePath -> previousContent

    for (const op of operations) {
      const fullPath = path.isAbsolute(op.filePath) ? op.filePath : path.join(cwd, op.filePath);

      try {
        let existingContent: string | null = null;
        if (fs.existsSync(fullPath)) {
          existingContent = fs.readFileSync(fullPath, "utf-8");
        }
        rollbackMap.set(fullPath, existingContent);

        if (op.type === "add") {
          const content = op.content ?? "";
          this.substrate.stageFile(fullPath, content, existingContent);
          if (!options.dryRun) {
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, content, "utf-8");
          }
          modifiedFiles.push(op.filePath);
        } else if (op.type === "delete") {
          this.substrate.stageFile(fullPath, null, existingContent);
          if (!options.dryRun && fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
          modifiedFiles.push(op.filePath);
        } else if (op.type === "move" && op.newPath) {
          const newFullPath = path.isAbsolute(op.newPath) ? op.newPath : path.join(cwd, op.newPath);
          this.substrate.stageFile(fullPath, null, existingContent);
          this.substrate.stageFile(newFullPath, existingContent, null);
          if (!options.dryRun && existingContent !== null) {
            fs.mkdirSync(path.dirname(newFullPath), { recursive: true });
            fs.writeFileSync(newFullPath, existingContent, "utf-8");
            fs.unlinkSync(fullPath);
          }
          modifiedFiles.push(`${op.filePath} -> ${op.newPath}`);
        } else if (op.type === "update") {
          if (existingContent === null) {
            errors.push(`Target file does not exist for update: ${op.filePath}`);
            continue;
          }

          const applied = this.patchEngine.applyHunks(existingContent, op.hunks);
          if (!applied.success || applied.newContent === undefined) {
            errors.push(`Failed to apply hunks to ${op.filePath}: ${applied.error}`);
            continue;
          }

          this.substrate.stageFile(fullPath, applied.newContent, existingContent);
          if (!options.dryRun) {
            fs.writeFileSync(fullPath, applied.newContent, "utf-8");
          }
          modifiedFiles.push(op.filePath);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error executing operation on ${op.filePath}: ${msg}`);
      }
    }

    if (errors.length > 0 && !options.dryRun) {
      // Rollback on any failure
      for (const [filePath, prev] of rollbackMap) {
        try {
          if (prev === null) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          } else {
            fs.writeFileSync(filePath, prev, "utf-8");
          }
        } catch {
          // Ignore rollback cleanup errors
        }
      }
      this.substrate.revertAll();
      return {
        success: false,
        modifiedFiles: [],
        errors,
        dryRun: false,
      };
    }

    return {
      success: errors.length === 0,
      modifiedFiles,
      errors,
      dryRun: !!options.dryRun,
    };
  }

  /**
   * Reads a file with line-range pagination and character truncation safety limits.
   */
  public readPaginated(options: FilePaginationOptions, cwd = process.cwd()): FilePaginatedReadResult {
    const fullPath = path.isAbsolute(options.filePath) ? options.filePath : path.join(cwd, options.filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${options.filePath}`);
    }

    const rawBuffer = fs.readFileSync(fullPath);
    // Binary detection: check for null bytes in initial 512 bytes
    const checkLen = Math.min(512, rawBuffer.length);
    let isBinary = false;
    for (let i = 0; i < checkLen; i++) {
      if (rawBuffer[i] === 0) {
        isBinary = true;
        break;
      }
    }

    if (isBinary) {
      return {
        filePath: options.filePath,
        content: `[Binary file (${rawBuffer.length} bytes)]`,
        totalLines: 0,
        startLine: 0,
        endLine: 0,
        truncated: false,
        isBinary: true,
      };
    }

    const fullText = rawBuffer.toString("utf-8");
    const lines = fullText.split(/\r?\n/);
    const totalLines = lines.length;

    const startLine = options.startLine ? Math.max(1, options.startLine) : 1;
    const endLine = options.endLine ? Math.min(totalLines, options.endLine) : Math.min(totalLines, startLine + 800 - 1);

    const sliceLines = lines.slice(startLine - 1, endLine);
    let sliceText = sliceLines.join("\n");

    const maxChars = options.maxChars ?? DEFAULT_MAX_READ_CHARS;
    let truncated = false;

    if (sliceText.length > maxChars) {
      sliceText = sliceText.slice(0, maxChars) + "\n... [TRUNCATED DUE TO SIZE LIMIT]";
      truncated = true;
    }

    return {
      filePath: options.filePath,
      content: sliceText,
      totalLines,
      startLine,
      endLine,
      truncated,
      isBinary: false,
    };
  }

  /**
   * Atomic file write with directory auto-creation and substrate staging.
   */
  public writeAtomic(filePath: string, content: string, overwrite = true, cwd = process.cwd()): { success: boolean; bytesWritten: number } {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);

    if (fs.existsSync(fullPath) && !overwrite) {
      throw new Error(`File already exists and overwrite is false: ${filePath}`);
    }

    const prevContent = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf-8") : null;
    this.substrate.stageFile(fullPath, content, prevContent);

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");

    return {
      success: true,
      bytesWritten: Buffer.byteLength(content, "utf-8"),
    };
  }

  /**
   * Atomic contiguous text replacement within a file.
   */
  public async applyReplaceContent(
    options: { filePath: string; targetContent: string; replacementContent: string; startLine?: number; endLine?: number; allowMultiple?: boolean },
    cwd = process.cwd()
  ): Promise<{ success: boolean; modified: boolean; bytesWritten?: number; error?: string }> {
    const fullPath = path.isAbsolute(options.filePath) ? options.filePath : path.join(cwd, options.filePath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, modified: false, error: `File not found: ${options.filePath}` };
    }
    const existing = fs.readFileSync(fullPath, "utf-8");
    const res = this.patchEngine.replaceContiguous(existing, options.targetContent, options.replacementContent, options);
    if (!res.success || res.newContent === undefined) {
      return { success: false, modified: false, error: res.error };
    }
    this.substrate.stageFile(fullPath, res.newContent, existing);
    fs.writeFileSync(fullPath, res.newContent, "utf-8");
    return { success: true, modified: true, bytesWritten: Buffer.byteLength(res.newContent, "utf-8") };
  }

  /**
   * Atomic multi-chunk non-contiguous replacement within a file.
   */
  public async applyMultiReplace(
    options: { filePath: string; chunks: Array<{ targetContent: string; replacementContent: string; startLine?: number; endLine?: number; allowMultiple?: boolean }> },
    cwd = process.cwd()
  ): Promise<{ success: boolean; modified: boolean; bytesWritten?: number; error?: string }> {
    const fullPath = path.isAbsolute(options.filePath) ? options.filePath : path.join(cwd, options.filePath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, modified: false, error: `File not found: ${options.filePath}` };
    }
    let content = fs.readFileSync(fullPath, "utf-8");
    const original = content;

    for (const chunk of options.chunks) {
      const res = this.patchEngine.replaceContiguous(content, chunk.targetContent, chunk.replacementContent, chunk);
      if (!res.success || res.newContent === undefined) {
        return { success: false, modified: false, error: `Chunk replacement failed: ${res.error}` };
      }
      content = res.newContent;
    }

    this.substrate.stageFile(fullPath, content, original);
    fs.writeFileSync(fullPath, content, "utf-8");
    return { success: true, modified: true, bytesWritten: Buffer.byteLength(content, "utf-8") };
  }

  public stageFile(filePath: string, stagedContent: string, previousContent?: string | null) {
    return this.substrate.stageFile(filePath, stagedContent, previousContent);
  }

  public listStaged() {
    return this.substrate.listStaged();
  }

  public unstageFile(filePath: string) {
    return this.substrate.unstageFile(filePath);
  }

  public commitAll() {
    return this.substrate.commitAll();
  }

  public revertAll() {
    return this.substrate.revertAll();
  }

  public auditHealth() {
    return this.substrate.auditHealth();
  }

  public getMetrics() {
    return this.substrate.getMetrics();
  }

  public getGroupedMutations(groupBy?: any, sortBy?: any, direction?: any) {
    return this.substrate.getGroupedMutations(groupBy, sortBy, direction);
  }

  public queryDsl(query: any) {
    return this.substrate.queryMutationsDsl(query);
  }

  public bulkPurge(paths: readonly string[]) {
    return this.substrate.bulkPurgeStaged(paths);
  }

  public bulkCommit() {
    return this.substrate.bulkCommitStaged();
  }

  public undo(): boolean {
    return this.substrate.undo();
  }

  public redo(): boolean {
    return this.substrate.redo();
  }

  public exportHtml(): string {
    return this.substrate.exportInteractiveHtmlView();
  }

  public exportMarkdown(): string {
    return this.substrate.exportMarkdownReport();
  }

  public exportCsv(): string {
    return this.substrate.exportCsvReport();
  }
}
