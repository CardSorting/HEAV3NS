/**
 * tool-output-summarizer.ts
 *
 * Intelligent Error-Aware Semantic Output Summarizer.
 * Scans verbose tool execution outputs (build logs, test runs, compiler output)
 * for error blocks, stack traces, test failure summaries, and assertion misses.
 * Elevates critical failure diagnostic chunks to the LLM context while compressing
 * progress bars, spinners, and repetitive passing logs.
 */

export interface OutputSummaryResult {
  readonly summary: string;
  readonly failureChunksFound: number;
  readonly originalLineCount: number;
  readonly summaryLineCount: number;
  readonly compressionRatio: number;
}

export class ToolOutputSummarizer {
  private readonly failurePatterns = [
    /error:/i,
    /fail(ed|ure)?/i,
    /fatal/i,
    /exception/i,
    /stack\s*trace/i,
    /at\s+[\w$./\\-]+\s+\(/i,
    /cannot\s+find/i,
    /typeerror/i,
    /syntaxerror/i,
    /assertionerror/i,
    /referenceerror/i,
    /exit\s*code\s*[1-9]/i,
  ];

  private readonly noisePatterns = [
    /^\s*[\\|/\-]\s*$/, // spinner lines
    /^\s*\[\s*[0-9]+%\s*\]/, // build percentage progress
    /^\s*✓\s+/i, // passing test marks
    /^\s*pass\s+/i, // passing test marks
    /^\s*\.\.\.\s*$/,
  ];

  /**
   * Evaluates if a line contains error/failure indicators.
   */
  private isFailureLine(line: string): boolean {
    return this.failurePatterns.some((pattern) => pattern.test(line));
  }

  /**
   * Evaluates if a line is disposable progress or repetitive noise.
   */
  private isNoiseLine(line: string): boolean {
    return this.noisePatterns.some((pattern) => pattern.test(line));
  }

  /**
   * Summarizes raw output while guaranteeing preservation of failure sections.
   */
  public summarizeOutput(
    rawOutput: string,
    options: { maxOutputLines?: number; contextPadding?: number } = {}
  ): OutputSummaryResult {
    const maxLines = options.maxOutputLines ?? 60;
    const padding = options.contextPadding ?? 2;

    const lines = rawOutput.split(/\r?\n/);
    if (lines.length <= maxLines) {
      return {
        summary: rawOutput,
        failureChunksFound: lines.filter((l) => this.isFailureLine(l)).length,
        originalLineCount: lines.length,
        summaryLineCount: lines.length,
        compressionRatio: 1.0,
      };
    }

    // Step 1: Identify indices of failure lines
    const failureIndices = new Set<number>();
    for (let i = 0; i < lines.length; i++) {
      if (this.isFailureLine(lines[i])) {
        // Add failure line and surrounding context padding
        for (let p = Math.max(0, i - padding); p <= Math.min(lines.length - 1, i + padding); p++) {
          failureIndices.add(p);
        }
      }
    }

    const failureChunksFound = failureIndices.size;
    const outputLines: string[] = [];

    if (failureChunksFound > 0) {
      outputLines.push(`[TOOL OUTPUT SUMMARY: Extracted ${failureChunksFound} critical failure context lines from ${lines.length} total lines]`);

      let lastIndex = -1;
      const sortedIndices = Array.from(failureIndices).sort((a, b) => a - b);

      for (const idx of sortedIndices) {
        if (lastIndex !== -1 && idx > lastIndex + 1) {
          outputLines.push(`... [${idx - lastIndex - 1} noise lines omitted] ...`);
        }
        outputLines.push(lines[idx]);
        lastIndex = idx;
      }

      if (lastIndex < lines.length - 1) {
        outputLines.push(`... [${lines.length - 1 - lastIndex} trailing lines omitted] ...`);
      }
    } else {
      // No explicit failures, keep head and tail, omitting noise in between
      const filtered = lines.filter((l) => !this.isNoiseLine(l));
      const headCount = Math.floor(maxLines / 2);
      const tailCount = Math.floor(maxLines / 2);

      outputLines.push(...filtered.slice(0, headCount));
      if (filtered.length > maxLines) {
        outputLines.push(`\n... [${filtered.length - maxLines} intermediate lines omitted] ...\n`);
        outputLines.push(...filtered.slice(filtered.length - tailCount));
      }
    }

    const summary = outputLines.join("\n");
    const summaryLineCount = outputLines.length;
    const compressionRatio = Number((summaryLineCount / lines.length).toFixed(2));

    return {
      summary,
      failureChunksFound,
      originalLineCount: lines.length,
      summaryLineCount,
      compressionRatio,
    };
  }
}
