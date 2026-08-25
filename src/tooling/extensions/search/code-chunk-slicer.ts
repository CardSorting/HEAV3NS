/**
 * code-chunk-slicer.ts
 *
 * Semantic Code Chunk Slicer & Context Window Compressor.
 * Extracts targeted function/method boundaries or line windows while prepending
 * enclosing class/namespace signatures and essential imports to minimize prompt token waste.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface SlicedChunkResult {
  readonly success: boolean;
  readonly filePath: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly totalLines: number;
  readonly slicedLinesCount: number;
  readonly headerContext: string;
  readonly codeChunk: string;
}

export class CodeChunkSlicer {
  /**
   * Slices semantic code chunks from a file.
   */
  public async sliceChunk(
    filePath: string,
    rootDir: string,
    options: { startLine?: number; endLine?: number; functionName?: string; maxLines?: number } = {}
  ): Promise<SlicedChunkResult> {
    const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(rootDir, filePath);
    const content = await fs.readFile(resolvedPath, "utf-8");
    const lines = content.split("\n");
    const totalLines = lines.length;

    let startLine = options.startLine || 1;
    let endLine = options.endLine || Math.min(totalLines, startLine + (options.maxLines || 50) - 1);

    if (options.functionName) {
      const fnName = options.functionName;
      const fnRegex = new RegExp(`(?:function|async function|class|interface|type)\\s+${fnName}|(?:public|private|protected)\\s+(?:async\\s+)?${fnName}\\s*\\(`, "i");

      for (let i = 0; i < lines.length; i++) {
        if (fnRegex.test(lines[i])) {
          startLine = i + 1;
          // Find matching end line (or next 40 lines)
          endLine = Math.min(totalLines, startLine + (options.maxLines || 40) - 1);
          break;
        }
      }
    }

    startLine = Math.max(1, Math.min(totalLines, startLine));
    endLine = Math.max(startLine, Math.min(totalLines, endLine));

    // Extract top imports & class context
    const imports: string[] = [];
    let enclosingClass = "";

    for (let i = 0; i < Math.min(startLine - 1, 30); i++) {
      const line = lines[i].trim();
      if (line.startsWith("import ")) {
        imports.push(line);
      }
      if (line.startsWith("export class ") || line.startsWith("class ")) {
        enclosingClass = line;
      }
    }

    const headerContext = [
      imports.slice(0, 5).join("\n"),
      enclosingClass ? `// ... inside ${enclosingClass}` : "",
    ].filter(Boolean).join("\n");

    const codeChunk = lines.slice(startLine - 1, endLine).join("\n");

    return {
      success: true,
      filePath: path.relative(rootDir, resolvedPath).replace(/\\/g, "/"),
      startLine,
      endLine,
      totalLines,
      slicedLinesCount: endLine - startLine + 1,
      headerContext,
      codeChunk,
    };
  }
}
