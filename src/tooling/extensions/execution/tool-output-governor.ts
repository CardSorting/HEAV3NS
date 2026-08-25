/**
 * tool-output-governor.ts
 *
 * Content-Aware Output Bounding, Markdown Table Formatting, and Spillover Management.
 * Protects LLM context window from massive tool outputs while preserving essential head,
 * tail, stack traces, and structured representations.
 */

import * as crypto from "node:crypto";

export interface BoundedOutputResult {
  readonly outputText: string;
  readonly originalLength: number;
  readonly boundedLength: number;
  readonly wasTruncated: boolean;
  readonly omittedLines?: number;
  readonly spillId?: string;
}

export interface OutputGovernorOptions {
  readonly maxCharacters?: number;
  readonly maxLines?: number;
  readonly headLines?: number;
  readonly tailLines?: number;
  readonly enableSpillVault?: boolean;
}

export class ToolOutputGovernor {
  private readonly defaultMaxChars: number;
  private readonly defaultMaxLines: number;
  private readonly defaultHeadLines: number;
  private readonly defaultTailLines: number;
  private readonly spillVault = new Map<string, { content: string; createdAt: number }>();

  constructor(options: OutputGovernorOptions = {}) {
    this.defaultMaxChars = options.maxCharacters ?? 40_000;
    this.defaultMaxLines = options.maxLines ?? 60;
    this.defaultHeadLines = options.headLines ?? 30;
    this.defaultTailLines = options.tailLines ?? 20;
  }

  /**
   * Transforms raw tool output into an optimized, bounded representation.
   */
  public governOutput(
    rawOutput: unknown,
    toolName = "tool",
    options: OutputGovernorOptions = {}
  ): BoundedOutputResult {
    const maxChars = options.maxCharacters ?? this.defaultMaxChars;
    const maxLines = options.maxLines ?? this.defaultMaxLines;
    const headLinesCount = options.headLines ?? this.defaultHeadLines;
    const tailLinesCount = options.tailLines ?? this.defaultTailLines;

    let stringOutput = "";
    if (typeof rawOutput === "string") {
      stringOutput = rawOutput;
    } else if (rawOutput === null || rawOutput === undefined) {
      stringOutput = "";
    } else if (typeof rawOutput === "object") {
      // If tabular array of objects, format as markdown table
      if (Array.isArray(rawOutput) && rawOutput.length > 0 && typeof rawOutput[0] === "object" && rawOutput[0] !== null) {
        stringOutput = this.formatAsMarkdownTable(rawOutput);
      } else {
        stringOutput = JSON.stringify(rawOutput, null, 2);
      }
    } else {
      stringOutput = String(rawOutput);
    }

    const originalLength = stringOutput.length;
    const lines = stringOutput.split("\n");

    if (originalLength <= maxChars && lines.length <= maxLines) {
      return {
        outputText: stringOutput,
        originalLength,
        boundedLength: originalLength,
        wasTruncated: false,
      };
    }

    // Generate spill ID if saving to in-memory spill vault
    const spillId = `spill_${crypto.createHash("sha256").update(stringOutput).digest("hex").slice(0, 12)}`;
    this.spillVault.set(spillId, { content: stringOutput, createdAt: Date.now() });

    // Clean up old spill vault entries (> 100 entries)
    if (this.spillVault.size > 100) {
      const oldestKey = this.spillVault.keys().next().value;
      if (oldestKey) this.spillVault.delete(oldestKey);
    }

    let boundedText = "";
    let omittedLines = 0;

    if (lines.length > maxLines) {
      const head = lines.slice(0, headLinesCount);
      const tail = lines.slice(-tailLinesCount);
      omittedLines = lines.length - (headLinesCount + tailLinesCount);

      const notice = `\n... [${omittedLines.toLocaleString()} lines / ${(originalLength - 1000).toLocaleString()} chars omitted for context efficiency · Reference ID: ${spillId}] ...\n`;
      boundedText = [...head, notice, ...tail].join("\n");
    } else {
      const headChars = Math.floor(maxChars * 0.6);
      const tailChars = Math.floor(maxChars * 0.35);
      const omittedChars = originalLength - (headChars + tailChars);

      const head = stringOutput.slice(0, headChars);
      const tail = stringOutput.slice(-tailChars);
      boundedText = `${head}\n\n... [${omittedChars.toLocaleString()} characters omitted · Reference ID: ${spillId}] ...\n\n${tail}`;
    }

    return {
      outputText: boundedText,
      originalLength,
      boundedLength: boundedText.length,
      wasTruncated: true,
      omittedLines: omittedLines > 0 ? omittedLines : undefined,
      spillId,
    };
  }

  /**
   * Formats an array of objects into a clean Markdown table.
   */
  public formatAsMarkdownTable(items: Array<Record<string, unknown>>): string {
    if (!items || items.length === 0) return "[]";

    // Gather unique keys from first few items
    const keysSet = new Set<string>();
    for (const item of items.slice(0, 50)) {
      if (item && typeof item === "object") {
        for (const k of Object.keys(item)) {
          keysSet.add(k);
        }
      }
    }

    const headers = Array.from(keysSet).slice(0, 8); // Max 8 columns
    if (headers.length === 0) return JSON.stringify(items, null, 2);

    const headerRow = `| ${headers.join(" | ")} |`;
    const separatorRow = `| ${headers.map(() => "---").join(" | ")} |`;

    const rows = items.slice(0, 100).map((item) => {
      const cols = headers.map((h) => {
        const val = item[h];
        if (val === null || val === undefined) return "";
        if (typeof val === "object") return JSON.stringify(val).replace(/\|/g, "\\|");
        return String(val).replace(/\|/g, "\\|").replace(/\n/g, " ");
      });
      return `| ${cols.join(" | ")} |`;
    });

    return [headerRow, separatorRow, ...rows].join("\n");
  }

  /**
   * Retrieves full un-truncated content from spill vault by spill ID.
   */
  public getSpillContent(spillId: string): string | null {
    const entry = this.spillVault.get(spillId);
    return entry ? entry.content : null;
  }

  /**
   * Retrieves a specific line range slice from spilled content by spill ID.
   */
  public retrieveSpillSlice(
    spillId: string,
    startLine = 1,
    endLine?: number
  ): { content: string; totalLines: number; startLine: number; endLine: number } | null {
    const raw = this.getSpillContent(spillId);
    if (!raw) return null;

    const lines = raw.split("\n");
    const totalLines = lines.length;
    const s = Math.max(1, Math.min(startLine, totalLines));
    const e = Math.min(endLine ?? totalLines, totalLines);

    const sliceLines = lines.slice(s - 1, e);
    return {
      content: sliceLines.join("\n"),
      totalLines,
      startLine: s,
      endLine: e,
    };
  }
}

