/**
 * doc-extractor-tool-suite.ts
 *
 * Model tool definitions exposing Structured Document Extractor,
 * Binary Extension Classifier, and Opaque Document Destruction Guard to agents
 * (Phase 116 / ADR-092 / Target #49).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { DocExtractorSupervisor } from "../../../agents/extensions/doc_extractor/doc-extractor-supervisor.js";

export class DocExtractorToolSuite {
  private readonly supervisor: DocExtractorSupervisor;

  constructor(supervisor: DocExtractorSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "doc_extract_text",
        description:
          "Extracts readable text and formatted Markdown from structured documents (.ipynb Jupyter notebooks, .docx Word documents, .xlsx Excel spreadsheets, and .pdf documents).",
        parameters: {
          file_path: {
            type: "string",
            description: "The path of the document file to extract text from.",
            required: true,
          },
          content_base64: {
            type: "string",
            description: "Optional base64-encoded binary content of the document.",
            required: false,
          },
          content_text: {
            type: "string",
            description: "Optional raw text content (for .ipynb).",
            required: false,
          },
          max_chars: {
            type: "number",
            description: "Maximum character limit for extracted text (default 200,000).",
            required: false,
          },
          max_rows: {
            type: "number",
            description: "Maximum row count for spreadsheet extractions (default 500).",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const filePath = typeof args.file_path === "string" ? args.file_path : "";
          const contentBase64 = typeof args.content_base64 === "string" ? args.content_base64 : undefined;
          const contentText = typeof args.content_text === "string" ? args.content_text : undefined;
          const maxChars = typeof args.max_chars === "number" ? args.max_chars : undefined;
          const maxRows = typeof args.max_rows === "number" ? args.max_rows : undefined;

          if (!filePath) {
            return { success: false, error: "file_path is required" };
          }

          let data: Uint8Array | Buffer | string = "";
          if (contentBase64) {
            data = Buffer.from(contentBase64, "base64");
          } else if (contentText) {
            data = contentText;
          }

          const result = this.supervisor.extractDocument(filePath, data, {
            maxChars,
            maxRows,
          });

          return {
            success: true,
            filePath,
            format: result.format,
            textContent: result.textContent,
            charCount: result.charCount,
            pageOrSheetCount: result.pageOrSheetCount,
            truncated: result.truncated,
            metadata: result.metadata,
          };
        },
      },
      {
        name: "doc_check_binary_extension",
        description:
          "Fast zero-I/O check to determine if a file path is a binary format (image, video, archive, executable, font, DB, lockfile) that should skip text processing.",
        parameters: {
          file_path: {
            type: "string",
            description: "The file path to evaluate.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const filePath = typeof args.file_path === "string" ? args.file_path : "";
          const isBinary = this.supervisor.hasBinaryExtension(filePath);
          const isOpaque = this.supervisor.isOpaqueDocument(filePath);

          return {
            success: true,
            filePath,
            isBinary,
            isOpaqueDocument: isOpaque,
          };
        },
      },
      {
        name: "doc_verify_safe_write",
        description:
          "Guards against corrupting opaque container files (.docx, .xlsx, .pptx, .epub, .odt) by verifying if a write operation is safe.",
        parameters: {
          file_path: {
            type: "string",
            description: "The destination file path intended for writing.",
            required: true,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const filePath = typeof args.file_path === "string" ? args.file_path : "";
          const check = this.supervisor.verifySafeWrite(filePath);

          return {
            success: true,
            filePath,
            safe: check.safe,
            format: check.format,
            reason: check.reason,
            recommendedAction: check.recommendedAction,
          };
        },
      },
      {
        name: "doc_inspect_cache",
        description:
          "Inspects in-memory extracted document cache metadata.",
        parameters: {
          file_path: {
            type: "string",
            description: "Optional specific file path to query in cache.",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const filePath = typeof args.file_path === "string" ? args.file_path : undefined;
          if (filePath) {
            const cached = this.supervisor.getCachedDoc(filePath);
            return {
              success: true,
              cached: cached ?? null,
            };
          }

          const docs = this.supervisor.listCachedDocs();
          return {
            success: true,
            cachedDocs: docs,
            count: docs.length,
          };
        },
      },
      {
        name: "doc_get_extractor_metrics",
        description:
          "Retrieves aggregate document extraction metrics and opaque write guard stats.",
        parameters: {},
        execute: async () => {
          const metrics = this.supervisor.getMetrics();
          return {
            success: true,
            metrics,
          };
        },
      },
    ];
  }
}
