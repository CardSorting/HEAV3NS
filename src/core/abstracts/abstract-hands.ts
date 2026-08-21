import * as fs from "node:fs/promises";
import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { IHands } from "../contracts/tooling.contracts.js";

const execAsync = promisify(exec);

export interface ProcessExecutionOptions {
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  maxBuffer?: number;
}

export interface ReplacementChunk {
  target: string;
  replacement: string;
}

export interface MultiReplaceResult {
  success: boolean;
  replacementsApplied: number;
  error?: string;
}

export abstract class AbstractHands implements IHands {
  resolvePath(filePath: string, cwd?: string): string {
    let target = filePath.trim();
    if (target.startsWith("~")) {
      const home = process.env.HOME || process.env.USERPROFILE || "";
      target = path.join(home, target.slice(1));
    }
    if (!path.isAbsolute(target)) {
      target = path.resolve(cwd || process.cwd(), target);
    }
    return path.normalize(target);
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const resolvedPath = this.resolvePath(filePath);
    const parentDir = path.dirname(resolvedPath);
    await fs.mkdir(parentDir, { recursive: true });
    await fs.writeFile(resolvedPath, content, "utf-8");
  }

  async writeMultipleFiles(files: { path: string; content: string }[]): Promise<{ path: string; written: boolean }[]> {
    const results: { path: string; written: boolean }[] = [];
    for (const file of files) {
      try {
        await this.writeFile(file.path, file.content);
        results.push({ path: this.resolvePath(file.path), written: true });
      } catch {
        results.push({ path: this.resolvePath(file.path), written: false });
      }
    }
    return results;
  }

  async appendFile(filePath: string, content: string): Promise<boolean> {
    try {
      const resolvedPath = this.resolvePath(filePath);
      const parentDir = path.dirname(resolvedPath);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.appendFile(resolvedPath, content, "utf-8");
      return true;
    } catch {
      return false;
    }
  }

  async clearFile(filePath: string): Promise<boolean> {
    try {
      const resolvedPath = this.resolvePath(filePath);
      await fs.writeFile(resolvedPath, "", "utf-8");
      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const resolvedPath = this.resolvePath(filePath);
      await fs.rm(resolvedPath, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  async deleteMultipleFiles(filePaths: string[]): Promise<{ path: string; deleted: boolean }[]> {
    const results: { path: string; deleted: boolean }[] = [];
    for (const filePath of filePaths) {
      const deleted = await this.deleteFile(filePath);
      results.push({ path: this.resolvePath(filePath), deleted });
    }
    return results;
  }

  async moveFile(sourcePath: string, targetPath: string): Promise<boolean> {
    try {
      const resolvedSource = this.resolvePath(sourcePath);
      const resolvedTarget = this.resolvePath(targetPath);
      const parentDir = path.dirname(resolvedTarget);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.rename(resolvedSource, resolvedTarget);
      return true;
    } catch {
      return false;
    }
  }

  async createDirectory(dirPath: string): Promise<boolean> {
    try {
      const resolvedPath = this.resolvePath(dirPath);
      await fs.mkdir(resolvedPath, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  async copyFile(sourcePath: string, targetPath: string): Promise<boolean> {
    try {
      const resolvedSource = this.resolvePath(sourcePath);
      const resolvedTarget = this.resolvePath(targetPath);
      const parentDir = path.dirname(resolvedTarget);
      await fs.mkdir(parentDir, { recursive: true });
      await fs.cp(resolvedSource, resolvedTarget, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  async editFile(
    filePath: string,
    target: string,
    replacement: string
  ): Promise<boolean> {
    const resolvedPath = this.resolvePath(filePath);
    const content = await fs.readFile(resolvedPath, "utf-8");
    if (content.includes(target)) {
      const updated = content.replace(target, replacement);
      await fs.writeFile(resolvedPath, updated, "utf-8");
      return true;
    }

    // Normalized newline fallback
    const normContent = content.replace(/\r\n/g, "\n");
    const normTarget = target.replace(/\r\n/g, "\n");
    if (normContent.includes(normTarget)) {
      const updated = normContent.replace(normTarget, replacement.replace(/\r\n/g, "\n"));
      await fs.writeFile(resolvedPath, updated, "utf-8");
      return true;
    }

    return false;
  }

  async replaceFileContent(
    filePath: string,
    target: string,
    replacement: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const resolvedPath = this.resolvePath(filePath);
      const content = await fs.readFile(resolvedPath, "utf-8");
      if (content.includes(target)) {
        const updated = content.replace(target, replacement);
        await fs.writeFile(resolvedPath, updated, "utf-8");
        return { success: true };
      }

      // Normalized newline fallback
      const normContent = content.replace(/\r\n/g, "\n");
      const normTarget = target.replace(/\r\n/g, "\n");
      if (normContent.includes(normTarget)) {
        const updated = normContent.replace(normTarget, replacement.replace(/\r\n/g, "\n"));
        await fs.writeFile(resolvedPath, updated, "utf-8");
        return { success: true };
      }

      return {
        success: false,
        error: `Target content block not found in '${filePath}'`,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async multiReplaceFileContent(
    filePath: string,
    chunks: ReplacementChunk[]
  ): Promise<MultiReplaceResult> {
    try {
      const resolvedPath = this.resolvePath(filePath);
      let content = await fs.readFile(resolvedPath, "utf-8");
      let applied = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (content.includes(chunk.target)) {
          content = content.replace(chunk.target, chunk.replacement);
          applied++;
        } else {
          const normContent = content.replace(/\r\n/g, "\n");
          const normTarget = chunk.target.replace(/\r\n/g, "\n");
          if (normContent.includes(normTarget)) {
            content = normContent.replace(normTarget, chunk.replacement.replace(/\r\n/g, "\n"));
            applied++;
          } else {
            return {
              success: false,
              replacementsApplied: applied,
              error: `Chunk #${i + 1} target content not found in '${filePath}'`,
            };
          }
        }
      }

      await fs.writeFile(resolvedPath, content, "utf-8");
      return {
        success: true,
        replacementsApplied: applied,
      };
    } catch (err) {
      return {
        success: false,
        replacementsApplied: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  protected async runRawProcess(
    command: string,
    cwd: string,
    options?: ProcessExecutionOptions
  ): Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number }> {
    const startedAt = performance.now();
    try {
      const maxBuffer = options?.maxBuffer ?? 10 * 1024 * 1024; // 10MB execution buffer
      const timeout = options?.timeoutMs;
      const env = options?.env ? { ...process.env, ...options.env } : process.env;

      const { stdout, stderr } = await execAsync(command, {
        cwd,
        maxBuffer,
        timeout,
        env,
      });
      const durationMs = Number((performance.now() - startedAt).toFixed(2));
      return { stdout: stdout ?? "", stderr: stderr ?? "", exitCode: 0, durationMs };
    } catch (err: unknown) {
      const durationMs = Number((performance.now() - startedAt).toFixed(2));
      const errorObj = err as { stdout?: string; stderr?: string; code?: number; signal?: string };
      return {
        stdout: errorObj.stdout ?? "",
        stderr: errorObj.stderr ?? (errorObj.signal ? `Process terminated with signal ${errorObj.signal}` : String(err)),
        exitCode: typeof errorObj.code === "number" ? errorObj.code : 1,
        durationMs,
      };
    }
  }
}
