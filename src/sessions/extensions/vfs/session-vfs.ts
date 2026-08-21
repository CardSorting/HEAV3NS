import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface VfsFileOverlay {
  path: string;
  content: string;
  isDeleted: boolean;
  timestamp: number;
}

export class SessionVfs {
  private readonly stagedFiles: Map<string, VfsFileOverlay>;

  constructor() {
    this.stagedFiles = new Map();
  }

  stageWrite(filePath: string, content: string): void {
    const normalized = path.normalize(filePath);
    this.stagedFiles.set(normalized, {
      path: normalized,
      content,
      isDeleted: false,
      timestamp: Date.now(),
    });
  }

  stageDelete(filePath: string): void {
    const normalized = path.normalize(filePath);
    this.stagedFiles.set(normalized, {
      path: normalized,
      content: "",
      isDeleted: true,
      timestamp: Date.now(),
    });
  }

  getFile(filePath: string): VfsFileOverlay | undefined {
    return this.stagedFiles.get(path.normalize(filePath));
  }

  hasStaged(filePath: string): boolean {
    return this.stagedFiles.has(path.normalize(filePath));
  }

  unstage(filePath: string): boolean {
    return this.stagedFiles.delete(path.normalize(filePath));
  }

  clear(): void {
    this.stagedFiles.clear();
  }

  exportStaged(): VfsFileOverlay[] {
    return Array.from(this.stagedFiles.values());
  }

  async commitFile(filePath: string): Promise<boolean> {
    const normalized = path.normalize(filePath);
    const overlay = this.stagedFiles.get(normalized);
    if (!overlay) return false;

    if (overlay.isDeleted) {
      try {
        await fs.unlink(overlay.path);
      } catch {
        // Ignore if missing
      }
    } else {
      const dir = path.dirname(overlay.path);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(overlay.path, overlay.content, "utf-8");
    }
    this.stagedFiles.delete(normalized);
    return true;
  }

  discardFile(filePath: string): boolean {
    return this.stagedFiles.delete(path.normalize(filePath));
  }

  async generateDiff(filePath: string): Promise<string | undefined> {
    const normalized = path.normalize(filePath);
    const overlay = this.stagedFiles.get(normalized);
    if (!overlay) return undefined;

    let originalContent = "";
    try {
      originalContent = await fs.readFile(normalized, "utf-8");
    } catch {
      originalContent = "";
    }

    const { DiffSynthesizer } = await import("../../../tooling/extensions/hashline/diff-synthesizer.js");
    const synth = new DiffSynthesizer();
    return synth.renderUnifiedDiff(normalized, originalContent, overlay.isDeleted ? "" : overlay.content);
  }

  async commitAll(): Promise<string[]> {
    const committedPaths: string[] = [];
    for (const overlay of this.stagedFiles.values()) {
      if (overlay.isDeleted) {
        try {
          await fs.unlink(overlay.path);
          committedPaths.push(overlay.path);
        } catch {
          // Ignore if missing
        }
      } else {
        const dir = path.dirname(overlay.path);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(overlay.path, overlay.content, "utf-8");
        committedPaths.push(overlay.path);
      }
    }
    this.stagedFiles.clear();
    return committedPaths;
  }
}
