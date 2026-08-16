/**
 * deterministic-spill-vault.ts
 *
 * Symlink-safe exclusive file vault, context-overflow tool result persistence,
 * and multi-tier turn budget governor (Phase 117 / ADR-093 / Target #50).
 */

import {
  mkdirSync,
  lstatSync,
  chmodSync,
  unlinkSync,
  openSync,
  writeSync,
  closeSync,
  readFileSync,
  constants as fsConstants,
} from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  DEFAULT_MAX_RESULT_CHARS,
  DEFAULT_MAX_TURN_BUDGET_CHARS,
  DEFAULT_PREVIEW_HEAD,
  DEFAULT_PREVIEW_TAIL,
  PERSISTED_OUTPUT_TAG,
  PERSISTED_OUTPUT_CLOSING_TAG,
  type PersistedResultDescriptor,
  type TurnBudgetConfig,
  type TurnBudgetEnforcementResult,
} from "../../../core/contracts/spill-vault.contracts.js";

export class DeterministicSpillVault {
  /**
   * Symlink-safe directory creation enforcing 0o700 permissions.
   */
  public ensureSpillDirectory(dirPath: string, privateMode: boolean = true): string {
    const target = resolve(dirPath);
    mkdirSync(target, { recursive: true, mode: privateMode ? 0o700 : 0o777 });

    const st = lstatSync(target);
    if (st.isSymbolicLink() || !st.isDirectory()) {
      throw new Error(`Spill directory '${target}' is not a valid directory (symlink detected).`);
    }

    if (privateMode) {
      try {
        chmodSync(target, 0o700);
      } catch {
        // Ignored on platforms without POSIX chmod
      }
    }

    return target;
  }

  /**
   * Symlink-safe exclusive file write using O_CREAT | O_EXCL and 0o600 permissions.
   */
  public writeSpillFile(
    dirPath: string,
    filename: string,
    content: string,
    privateMode: boolean = true
  ): string {
    const dir = this.ensureSpillDirectory(dirPath, privateMode);
    const safeName = filename.replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 120);
    const filePath = join(dir, safeName);

    // If file exists, unlink first to avoid symlink follow
    try {
      const st = lstatSync(filePath);
      if (st.isDirectory()) {
        throw new Error(`Refusing to overwrite directory '${filePath}' as a spill file.`);
      }
      unlinkSync(filePath);
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        throw err;
      }
    }

    const flags = fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL;
    const mode = privateMode ? 0o600 : 0o666;
    const fd = openSync(filePath, flags, mode);

    try {
      const buf = Buffer.from(content, "utf-8");
      writeSync(fd, buf, 0, buf.length, null);
    } finally {
      closeSync(fd);
    }

    return filePath;
  }

  /**
   * Generate structured head/tail preview for oversized content.
   */
  public generatePreview(
    content: string,
    headChars: number = DEFAULT_PREVIEW_HEAD,
    tailChars: number = DEFAULT_PREVIEW_TAIL
  ): { preview: string; isTruncated: boolean } {
    if (!content || content.length <= headChars + tailChars) {
      return { preview: content ?? "", isTruncated: false };
    }

    let head = content.slice(0, headChars);
    const lastHeadNl = head.lastIndexOf("\n");
    if (lastHeadNl > headChars / 2) {
      head = head.slice(0, lastHeadNl + 1);
    }

    let tail = content.slice(-tailChars);
    const firstTailNl = tail.indexOf("\n");
    if (firstTailNl > 0 && firstTailNl < tailChars / 2) {
      tail = tail.slice(firstTailNl + 1);
    }

    const omittedChars = content.length - head.length - tail.length;
    const preview = `${head}\n\n... [${omittedChars.toLocaleString()} characters omitted - see full content in persisted file] ...\n\n${tail}`;

    return { preview, isTruncated: true };
  }

  /**
   * Persist a tool result if its size exceeds maxResultChars.
   */
  public maybePersistResult(
    toolUseId: string,
    toolName: string,
    content: string,
    sessionId: string,
    spillDir: string,
    config: Partial<TurnBudgetConfig> = {}
  ): { inContextText: string; persisted?: PersistedResultDescriptor } {
    if (config.enabled === false || !content) {
      return { inContextText: content };
    }

    const maxResultChars = config.maxResultChars ?? DEFAULT_MAX_RESULT_CHARS;
    if (content.length <= maxResultChars) {
      return { inContextText: content };
    }

    const headChars = config.previewHeadChars ?? DEFAULT_PREVIEW_HEAD;
    const tailChars = config.previewTailChars ?? DEFAULT_PREVIEW_TAIL;
    const { preview } = this.generatePreview(content, headChars, tailChars);

    const safeId = this.generateSafeFilename(toolUseId || toolName);
    const sessionDir = join(spillDir, sessionId || "default_session");
    const filePath = this.writeSpillFile(sessionDir, `${safeId}.txt`, content, true);

    const persisted: PersistedResultDescriptor = {
      resultId: toolUseId || safeId,
      sessionId: sessionId || "default_session",
      toolName,
      filePath,
      originalSize: content.length,
      previewSize: preview.length,
      createdAt: Date.now(),
    };

    const inContextText = `${PERSISTED_OUTPUT_TAG} path="${filePath}" size="${content.length}" tool="${toolName}"\n${preview}\n${PERSISTED_OUTPUT_CLOSING_TAG}`;

    return { inContextText, persisted };
  }

  /**
   * Enforce aggregate per-turn character budget across multiple tool results.
   */
  public enforceTurnBudget(
    results: readonly { id: string; toolName: string; text: string }[],
    sessionId: string,
    spillDir: string,
    config: Partial<TurnBudgetConfig> = {}
  ): {
    updatedResults: { id: string; toolName: string; text: string }[];
    outcome: TurnBudgetEnforcementResult;
  } {
    if (config.enabled === false || results.length === 0) {
      const originalTotalChars = results.reduce((acc, r) => acc + r.text.length, 0);
      return {
        updatedResults: results.map((r) => ({ ...r })),
        outcome: {
          spilledCount: 0,
          originalTotalChars,
          finalTotalChars: originalTotalChars,
          persistedResults: [],
        },
      };
    }

    const maxTurnBudget = config.maxTurnBudgetChars ?? DEFAULT_MAX_TURN_BUDGET_CHARS;
    const headChars = config.previewHeadChars ?? DEFAULT_PREVIEW_HEAD;
    const tailChars = config.previewTailChars ?? DEFAULT_PREVIEW_TAIL;

    const working = results.map((r) => ({ ...r }));
    const originalTotalChars = working.reduce((acc, r) => acc + r.text.length, 0);

    let currentTotal = originalTotalChars;
    const persistedList: PersistedResultDescriptor[] = [];
    let spilledCount = 0;

    if (currentTotal > maxTurnBudget) {
      // Sort indices by result size descending (prioritizing non-already-persisted items)
      const sortedIndices = working
        .map((r, idx) => ({ idx, len: r.text.length, isPersisted: r.text.includes(PERSISTED_OUTPUT_TAG) }))
        .filter((item) => !item.isPersisted && item.len > headChars + tailChars)
        .sort((a, b) => b.len - a.len);

      for (const item of sortedIndices) {
        if (currentTotal <= maxTurnBudget) {
          break;
        }

        const target = working[item.idx];
        const { preview } = this.generatePreview(target.text, headChars, tailChars);
        const safeId = this.generateSafeFilename(target.id || target.toolName);
        const sessionDir = join(spillDir, sessionId || "default_session");
        const filePath = this.writeSpillFile(sessionDir, `${safeId}.txt`, target.text, true);

        const desc: PersistedResultDescriptor = {
          resultId: target.id || safeId,
          sessionId: sessionId || "default_session",
          toolName: target.toolName,
          filePath,
          originalSize: target.text.length,
          previewSize: preview.length,
          createdAt: Date.now(),
        };

        const formatted = `${PERSISTED_OUTPUT_TAG} path="${filePath}" size="${target.text.length}" tool="${target.toolName}"\n${preview}\n${PERSISTED_OUTPUT_CLOSING_TAG}`;

        currentTotal = currentTotal - target.text.length + formatted.length;
        working[item.idx].text = formatted;
        persistedList.push(desc);
        spilledCount++;
      }
    }

    const finalTotalChars = working.reduce((acc, r) => acc + r.text.length, 0);

    return {
      updatedResults: working,
      outcome: {
        spilledCount,
        originalTotalChars,
        finalTotalChars,
        persistedResults: persistedList,
      },
    };
  }

  /**
   * Spill oversized hook-injected context to disk.
   */
  public spillHookContext(
    contextText: string,
    sessionId: string,
    spillDir: string,
    config: Partial<TurnBudgetConfig> = {}
  ): { inPromptContext: string; isSpilled: boolean; filePath?: string } {
    if (config.enabled === false || !contextText) {
      return { inPromptContext: contextText, isSpilled: false };
    }

    const maxChars = config.maxResultChars ?? DEFAULT_MAX_RESULT_CHARS;
    if (contextText.length <= maxChars) {
      return { inPromptContext: contextText, isSpilled: false };
    }

    const headChars = config.previewHeadChars ?? DEFAULT_PREVIEW_HEAD;
    const tailChars = config.previewTailChars ?? DEFAULT_PREVIEW_TAIL;
    const { preview } = this.generatePreview(contextText, headChars, tailChars);

    const safeId = `hook_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const sessionDir = join(spillDir, sessionId || "default_session", "hooks");
    const filePath = this.writeSpillFile(sessionDir, `${safeId}.txt`, contextText, true);

    const inPromptContext = `[Hook context spilled to file: ${filePath} (${contextText.length} chars)]\n${preview}`;

    return { inPromptContext, isSpilled: true, filePath };
  }

  /**
   * Read raw content from a persisted spill file.
   */
  public readPersistedFile(filePath: string): string {
    const target = resolve(filePath);
    const st = lstatSync(target);
    if (st.isSymbolicLink() || !st.isFile()) {
      throw new Error(`Persisted file '${target}' is not a regular file (symlink rejected).`);
    }
    return readFileSync(target, "utf-8");
  }

  private generateSafeFilename(rawId: string): string {
    const safeStem = rawId.replace(/[^A-Za-z0-9_.-]+/g, "_").replace(/^[._-]+|[._-]+$/g, "");
    if (!safeStem || safeStem.length > 80) {
      const hash = createHash("sha256").update(rawId).digest("hex").slice(0, 12);
      return `${(safeStem || "tool_result").slice(0, 60)}_${hash}`;
    }
    return safeStem;
  }
}
