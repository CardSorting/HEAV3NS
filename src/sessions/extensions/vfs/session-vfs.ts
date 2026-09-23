import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createHash } from "node:crypto";
import type { VfsDiskBaseline } from "../../../core/contracts/session.contracts.js";

export interface VfsFileOverlay {
  path: string;
  content: string;
  isDeleted: boolean;
  timestamp: number;
  diskBaseline?: VfsDiskBaseline;
}

export class SessionVfs {
  private readonly stagedFiles: Map<string, VfsFileOverlay>;

  constructor() {
    this.stagedFiles = new Map();
  }

  stageWrite(filePath: string, content: string, diskBaseline?: VfsDiskBaseline): void {
    const normalized = path.normalize(filePath);
    this.stagedFiles.set(normalized, {
      path: normalized,
      content,
      isDeleted: false,
      timestamp: Date.now(),
      ...(diskBaseline ? { diskBaseline: { ...diskBaseline } } : {}),
    });
  }

  stageDelete(filePath: string, diskBaseline?: VfsDiskBaseline): void {
    const normalized = path.normalize(filePath);
    this.stagedFiles.set(normalized, {
      path: normalized,
      content: "",
      isDeleted: true,
      timestamp: Date.now(),
      ...(diskBaseline ? { diskBaseline: { ...diskBaseline } } : {}),
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

    await this.assertDiskBaseline(overlay);

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
    const overlays = Array.from(this.stagedFiles.values());
    // Validate delegated edits together before writing, so a stale child result
    // cannot leave a partially committed batch behind.
    await Promise.all(overlays.map((overlay) => this.assertDiskBaseline(overlay)));
    for (const overlay of overlays) {
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

  private async assertDiskBaseline(overlay: VfsFileOverlay): Promise<void> {
    const baseline = overlay.diskBaseline;
    if (!baseline) return;

    try {
      const contents = await fs.readFile(overlay.path);
      const stat = await fs.stat(overlay.path, { bigint: true });
      const signature = [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs, stat.mode].map(String).join(":");
      const contentHash = createHash("sha256").update(contents).digest("hex");
      if (baseline.signature === null || baseline.signature !== signature || baseline.contentHash !== contentHash) {
        throw new Error(`Staged file changed on disk since review: ${overlay.path}. The staged change was preserved.`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && baseline.signature === null) return;
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Staged file changed on disk since review: ${overlay.path}. The staged change was preserved.`);
      }
      throw error;
    }
  }
}
