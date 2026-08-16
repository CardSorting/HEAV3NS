/**
 * deterministic-doc-extractor.ts
 *
 * High-performance, zero-dependency structured document text extractor,
 * binary extension classifier, and opaque document destruction guard
 * (Phase 116 / ADR-092 / Target #49).
 */

import { inflateRawSync } from "node:zlib";
import {
  BINARY_EXTENSIONS,
  OPAQUE_DOCUMENT_EXTENSIONS,
  type DocumentExtractionOptions,
  type DocumentExtractionResult,
  type DocumentFormat,
  type OpaqueWriteCheckResult,
} from "../../../core/contracts/doc-extractor.contracts.js";

export class DeterministicDocExtractor {
  /**
   * Fast pure-string check if a path has a binary extension.
   */
  public hasBinaryExtension(filePath: string): boolean {
    if (!filePath) return false;
    const dot = filePath.lastIndexOf(".");
    if (dot === -1) return false;
    return BINARY_EXTENSIONS.has(filePath.slice(dot).toLowerCase());
  }

  /**
   * Fast pure-string check if a path is an opaque document container (.docx, .xlsx, etc.).
   */
  public isOpaqueDocument(filePath: string): boolean {
    if (!filePath) return false;
    const dot = filePath.lastIndexOf(".");
    if (dot === -1) return false;
    return OPAQUE_DOCUMENT_EXTENSIONS.has(filePath.slice(dot).toLowerCase());
  }

  /**
   * Guard checking if a write operation targeting filePath would destroy an opaque container.
   */
  public verifySafeWrite(filePath: string): OpaqueWriteCheckResult {
    if (!filePath) {
      return { safe: true };
    }

    const dot = filePath.lastIndexOf(".");
    const ext = dot !== -1 ? filePath.slice(dot).toLowerCase() : "";

    if (OPAQUE_DOCUMENT_EXTENSIONS.has(ext)) {
      return {
        safe: false,
        format: "opaque_container",
        reason: `Target path '${filePath}' is an opaque container document (${ext}). A plain-text write would corrupt and destroy the compound archive structure.`,
        recommendedAction: `Export or convert content via a dedicated document exporter, or write to a plain text/markdown file (e.g. ${filePath.replace(ext, ".md")}).`,
      };
    }

    return { safe: true };
  }

  /**
   * Extract text from Jupyter Notebook (.ipynb) files.
   */
  public extractIpynb(
    data: string | Uint8Array | Buffer,
    options: DocumentExtractionOptions = {}
  ): DocumentExtractionResult {
    try {
      const rawText = typeof data === "string" ? data : Buffer.from(data).toString("utf-8");
      const nb = JSON.parse(rawText);

      const cells = Array.isArray(nb.cells) ? nb.cells : [];
      const lines: string[] = [];
      const maxChars = options.maxChars ?? 200000;
      const includeOutputs = options.includeOutputs !== false;

      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        const cellType = cell.cell_type;
        const sourceLines = Array.isArray(cell.source)
          ? cell.source.join("")
          : typeof cell.source === "string"
          ? cell.source
          : "";

        if (cellType === "markdown") {
          lines.push(sourceLines.trim());
          lines.push("");
        } else if (cellType === "code") {
          const execCount = cell.execution_count !== undefined ? `[${cell.execution_count}]` : "";
          lines.push(`\`\`\`python # In ${execCount}`);
          lines.push(sourceLines.trimEnd());
          lines.push("```");

          if (includeOutputs && Array.isArray(cell.outputs) && cell.outputs.length > 0) {
            for (const out of cell.outputs) {
              if (out.output_type === "stream" && out.text) {
                const streamText = Array.isArray(out.text) ? out.text.join("") : String(out.text);
                lines.push("```output");
                lines.push(streamText.trimEnd());
                lines.push("```");
              } else if (out.data && out.data["text/plain"]) {
                const plainText = Array.isArray(out.data["text/plain"])
                  ? out.data["text/plain"].join("")
                  : String(out.data["text/plain"]);
                lines.push("```output");
                lines.push(plainText.trimEnd());
                lines.push("```");
              } else if (out.output_type === "error" && Array.isArray(out.traceback)) {
                // Strip ANSI escape codes from traceback
                const tb = out.traceback.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
                lines.push("```error");
                lines.push(tb.trimEnd());
                lines.push("```");
              }
            }
          }
          lines.push("");
        }
      }

      let fullText = lines.join("\n").trim();
      let truncated = false;
      if (maxChars > 0 && fullText.length > maxChars) {
        fullText = fullText.slice(0, maxChars) + "\n\n... [Content Truncated]";
        truncated = true;
      }

      return {
        format: "ipynb",
        textContent: fullText,
        charCount: fullText.length,
        pageOrSheetCount: cells.length,
        truncated,
        metadata: {
          nbformat: nb.nbformat,
          kernel: nb.metadata?.kernelspec?.name,
          cellCount: cells.length,
        },
      };
    } catch (err: any) {
      return {
        format: "ipynb",
        textContent: `Error extracting Jupyter notebook: ${err?.message ?? String(err)}`,
        charCount: 0,
        truncated: false,
      };
    }
  }

  /**
   * Extract text from OpenXML Word Document (.docx) files.
   */
  public extractDocx(
    data: Uint8Array | Buffer,
    options: DocumentExtractionOptions = {}
  ): DocumentExtractionResult {
    try {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const zipEntries = this.readZipEntries(buf);
      const docXmlEntry = zipEntries.get("word/document.xml");

      if (!docXmlEntry) {
        return {
          format: "docx",
          textContent: "Error: word/document.xml not found in .docx archive.",
          charCount: 0,
          truncated: false,
        };
      }

      const xmlText = docXmlEntry.toString("utf-8");
      const textContent = this.parseWordXml(xmlText);

      const maxChars = options.maxChars ?? 200000;
      let outText = textContent;
      let truncated = false;
      if (maxChars > 0 && outText.length > maxChars) {
        outText = outText.slice(0, maxChars) + "\n\n... [Content Truncated]";
        truncated = true;
      }

      return {
        format: "docx",
        textContent: outText,
        charCount: outText.length,
        truncated,
      };
    } catch (err: any) {
      return {
        format: "docx",
        textContent: `Error extracting Word document: ${err?.message ?? String(err)}`,
        charCount: 0,
        truncated: false,
      };
    }
  }

  /**
   * Extract text and tabular data from OpenXML Excel Spreadsheet (.xlsx) files.
   */
  public extractXlsx(
    data: Uint8Array | Buffer,
    options: DocumentExtractionOptions = {}
  ): DocumentExtractionResult {
    try {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const zipEntries = this.readZipEntries(buf);

      // 1. Read shared strings if present
      const sharedStrings: string[] = [];
      const ssEntry = zipEntries.get("xl/sharedStrings.xml");
      if (ssEntry) {
        const ssXml = ssEntry.toString("utf-8");
        const tMatches = ssXml.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [];
        for (const m of tMatches) {
          const val = m.replace(/<[^>]+>/g, "");
          sharedStrings.push(this.decodeXmlEntities(val));
        }
      }

      // 2. Read sheets
      const sheetLines: string[] = [];
      let sheetCount = 0;
      const maxRows = options.maxRows ?? 500;
      const maxCols = options.maxCols ?? 50;

      for (const [name, entryBuf] of zipEntries.entries()) {
        if (name.startsWith("xl/worksheets/sheet") && name.endsWith(".xml")) {
          sheetCount++;
          const sheetXml = entryBuf.toString("utf-8");
          const sheetName = name.replace("xl/worksheets/", "").replace(".xml", "");
          sheetLines.push(`## Sheet: ${sheetName}`);
          sheetLines.push("");

          const rowMatches = sheetXml.match(/<row[^>]*>([\s\S]*?)<\/row>/g) ?? [];
          let rowCount = 0;

          for (const rowXml of rowMatches) {
            if (rowCount >= maxRows) {
              sheetLines.push(`... [Truncated after ${maxRows} rows]`);
              break;
            }
            rowCount++;

            const cellMatches = rowXml.match(/<c\b([^>]*)>([\s\S]*?)<\/c>/g) ?? [];
            const rowVals: string[] = [];

            for (let cIdx = 0; cIdx < Math.min(cellMatches.length, maxCols); cIdx++) {
              const cellStr = cellMatches[cIdx];
              const isShared = cellStr.includes('t="s"');
              const vMatch = cellStr.match(/<v>([\s\S]*?)<\/v>/);
              if (vMatch) {
                const rawVal = vMatch[1];
                if (isShared) {
                  const sIdx = parseInt(rawVal, 10);
                  rowVals.push(sharedStrings[sIdx] ?? rawVal);
                } else {
                  rowVals.push(rawVal);
                }
              } else {
                const tMatch = cellStr.match(/<t[^>]*>([\s\S]*?)<\/t>/);
                if (tMatch) {
                  rowVals.push(this.decodeXmlEntities(tMatch[1].replace(/<[^>]+>/g, "")));
                } else {
                  rowVals.push("");
                }
              }
            }

            if (rowVals.length > 0) {
              sheetLines.push(`| ${rowVals.join(" | ")} |`);
            }
          }
          sheetLines.push("");
        }
      }

      let fullText = sheetLines.join("\n").trim();
      const maxChars = options.maxChars ?? 200000;
      let truncated = false;
      if (maxChars > 0 && fullText.length > maxChars) {
        fullText = fullText.slice(0, maxChars) + "\n\n... [Content Truncated]";
        truncated = true;
      }

      return {
        format: "xlsx",
        textContent: fullText,
        charCount: fullText.length,
        pageOrSheetCount: sheetCount,
        truncated,
      };
    } catch (err: any) {
      return {
        format: "xlsx",
        textContent: `Error extracting Excel spreadsheet: ${err?.message ?? String(err)}`,
        charCount: 0,
        truncated: false,
      };
    }
  }

  /**
   * Extract text streams and font glyph sequences from PDF (.pdf) files.
   */
  public extractPdfText(
    data: Uint8Array | Buffer,
    options: DocumentExtractionOptions = {}
  ): DocumentExtractionResult {
    try {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const str = buf.toString("latin1");

      const textBlocks: string[] = [];
      let pageCount = (str.match(/\/Type\s*\/Page\b/g) ?? []).length;
      if (pageCount === 0) pageCount = 1;

      // Extract BT ... ET text blocks
      const btRegex = /BT[\s\S]*?ET/g;
      let match: RegExpExecArray | null;

      while ((match = btRegex.exec(str)) !== null) {
        const block = match[0];
        // Match string literals inside parentheses: (Some text)
        const litMatches = block.match(/\((?:[^()\\]|\\.)*\)/g) ?? [];
        const words: string[] = [];
        for (const rawLit of litMatches) {
          const inner = rawLit.slice(1, -1);
          const unescaped = this.unescapePdfString(inner);
          if (unescaped.trim().length > 0) {
            words.push(unescaped);
          }
        }
        if (words.length > 0) {
          textBlocks.push(words.join(" "));
        }
      }

      let fullText = textBlocks.join("\n").trim();
      if (!fullText) {
        fullText = "[PDF contains no direct extractable text streams; may contain scanned bitmap images]";
      }

      const maxChars = options.maxChars ?? 200000;
      let truncated = false;
      if (maxChars > 0 && fullText.length > maxChars) {
        fullText = fullText.slice(0, maxChars) + "\n\n... [Content Truncated]";
        truncated = true;
      }

      return {
        format: "pdf",
        textContent: fullText,
        charCount: fullText.length,
        pageOrSheetCount: pageCount,
        truncated,
      };
    } catch (err: any) {
      return {
        format: "pdf",
        textContent: `Error extracting PDF document: ${err?.message ?? String(err)}`,
        charCount: 0,
        truncated: false,
      };
    }
  }

  /**
   * Universal document extractor routing to specific handlers.
   */
  public extractDocument(
    filePath: string,
    data: Uint8Array | Buffer | string,
    options: DocumentExtractionOptions = {}
  ): DocumentExtractionResult {
    const dot = filePath.lastIndexOf(".");
    const ext = dot !== -1 ? filePath.slice(dot).toLowerCase() : "";

    if (ext === ".ipynb") {
      return this.extractIpynb(data, options);
    }
    if (ext === ".docx") {
      const buf = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
      return this.extractDocx(buf, options);
    }
    if (ext === ".xlsx") {
      const buf = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
      return this.extractXlsx(buf, options);
    }
    if (ext === ".pdf") {
      const buf = typeof data === "string" ? Buffer.from(data, "latin1") : data;
      return this.extractPdfText(buf, options);
    }

    // Default plain text
    const textContent = typeof data === "string" ? data : Buffer.from(data).toString("utf-8");
    return {
      format: "text",
      textContent,
      charCount: textContent.length,
      truncated: false,
    };
  }

  // --------------------------------------------------------------------------
  // Internal Helpers & Zero-Dependency ZIP Reader
  // --------------------------------------------------------------------------

  private readZipEntries(buffer: Buffer): Map<string, Buffer> {
    const entries = new Map<string, Buffer>();
    let offset = 0;

    while (offset + 30 <= buffer.length) {
      const sig = buffer.readUInt32LE(offset);
      if (sig !== 0x04034b50) {
        // End of local file headers or central directory reached
        break;
      }

      const compMethod = buffer.readUInt16LE(offset + 8);
      const compSize = buffer.readUInt32LE(offset + 18);
      const uncompSize = buffer.readUInt32LE(offset + 22);
      const fileNameLen = buffer.readUInt16LE(offset + 26);
      const extraFieldLen = buffer.readUInt16LE(offset + 28);

      const fileNameOffset = offset + 30;
      const fileName = buffer.toString("utf-8", fileNameOffset, fileNameOffset + fileNameLen);
      const dataOffset = fileNameOffset + fileNameLen + extraFieldLen;

      if (compSize > 0 && dataOffset + compSize <= buffer.length) {
        const rawData = buffer.subarray(dataOffset, dataOffset + compSize);
        if (compMethod === 0) {
          // Stored (no compression)
          entries.set(fileName, Buffer.from(rawData));
        } else if (compMethod === 8) {
          // DEFLATE
          try {
            const decompressed = inflateRawSync(rawData);
            entries.set(fileName, decompressed);
          } catch {
            // Ignored if invalid stream
          }
        }
      }

      offset = dataOffset + compSize;
    }

    return entries;
  }

  private parseWordXml(xml: string): string {
    const lines: string[] = [];
    const pMatches = xml.match(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g) ?? [];

    for (const p of pMatches) {
      // Table handling inside p or separate
      const tMatches = p.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) ?? [];
      const textParts: string[] = [];
      for (const t of tMatches) {
        const val = t.replace(/<[^>]+>/g, "");
        textParts.push(this.decodeXmlEntities(val));
      }
      const pText = textParts.join("").trim();
      if (pText.length > 0) {
        lines.push(pText);
      }
    }

    return lines.join("\n\n");
  }

  private decodeXmlEntities(str: string): string {
    return str
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  private unescapePdfString(str: string): string {
    return str
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\b/g, "\b")
      .replace(/\\f/g, "\f")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\");
  }
}
