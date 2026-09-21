/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 191: Zero-Dependency Broccoli Command Output Buffer
 *
 * Lifted from external source workspace/codemarie-new/src/integrations/terminal/CommandOrchestrator.ts buffering logic.
 * Bounded terminal output chunking (appendChunk), head/tail summary line retention (SUMMARY_LINES_TO_KEEP),
 * byte/line threshold enforcement, and stream output formatting. Zero external npm dependencies.
 */

export interface BufferSummaryOptions {
  maxLines?: number;
  maxBytes?: number;
  summaryLinesToKeep?: number;
}

export class BroccoliCommandOutputBuffer {
  private chunks: string[] = [];
  private readonly defaultMaxLines: number;
  private readonly defaultMaxBytes: number;
  private totalBytes = 0;
  private totalLines = 0;

  constructor(defaultMaxLines = 1000, defaultMaxBytes = 256 * 1024) {
    this.defaultMaxLines = defaultMaxLines;
    this.defaultMaxBytes = defaultMaxBytes;
  }

  /**
   * Appends a chunk of terminal stdout/stderr data.
   */
  public appendChunk(chunk: string): void {
    if (!chunk) return;

    this.chunks.push(chunk);
    this.totalBytes += Buffer.byteLength(chunk, "utf-8");
    this.totalLines += (chunk.match(/\n/g) || []).length;
  }

  /**
   * Returns complete accumulated raw output text.
   */
  public getRawOutput(): string {
    return this.chunks.join("");
  }

  /**
   * Formats output for display, truncating intermediate lines if byte/line bounds are exceeded.
   */
  public getFormattedSummary(options: BufferSummaryOptions = {}): string {
    const maxLines = options.maxLines ?? this.defaultMaxLines;
    const maxBytes = options.maxBytes ?? this.defaultMaxBytes;
    const linesToKeep = options.summaryLinesToKeep ?? 30;

    const fullText = this.getRawOutput();
    const lines = fullText.split("\n");

    if (lines.length <= maxLines && Buffer.byteLength(fullText, "utf-8") <= maxBytes) {
      return fullText;
    }

    // Keep head and tail lines when output exceeds limits
    const headLines = lines.slice(0, linesToKeep);
    const tailLines = lines.slice(-linesToKeep);
    const truncatedCount = lines.length - headLines.length - tailLines.length;

    return (
      headLines.join("\n") +
      `\n\n... [${truncatedCount} lines truncated by BroccoliCommandOutputBuffer] ...\n\n` +
      tailLines.join("\n")
    );
  }

  /**
   * Clears accumulated buffer.
   */
  public clear(): void {
    this.chunks = [];
    this.totalBytes = 0;
    this.totalLines = 0;
  }
}
