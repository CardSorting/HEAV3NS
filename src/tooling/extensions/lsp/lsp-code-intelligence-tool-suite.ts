/**
 * lsp-code-intelligence-tool-suite.ts
 *
 * Model tool suite exposing semantic AST code intelligence and diagnostics:
 * - `lsp_diagnostics`: Fetches syntax, lint, and type diagnostics (with delta filtering).
 * - `lsp_hover`: Fetches type signature and declaration info at cursor.
 * - `lsp_definition`: Resolves declaration location for a symbol.
 * - `lsp_references`: Finds all references and call sites for a symbol.
 * - `lsp_document_symbols`: Extracts document outline of symbols.
 * - `lsp_workspace_symbols`: Searches symbols across workspace.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { SemanticCodeSupervisor } from "../../../agents/extensions/lsp/semantic-code-supervisor.js";

export class LspCodeIntelligenceToolSuite {
  private readonly supervisor: SemanticCodeSupervisor;

  constructor(supervisor: SemanticCodeSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "lsp_diagnostics",
        description: "Fetches syntax, structural, and semantic diagnostics for a file or workspace, with optional delta filtering to show only newly introduced errors.",
        parameters: {
          filePath: {
            type: "string",
            required: false,
            description: "Optional relative or absolute file path. If omitted, returns diagnostics across entire workspace.",
          },
          deltaOnly: {
            type: "boolean",
            required: false,
            description: "If true, only returns new diagnostics introduced since the pre-edit baseline snapshot.",
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const filePath = args.filePath ? String(args.filePath).trim() : undefined;
          const deltaOnly = Boolean(args.deltaOnly);

          const diagnostics = this.supervisor.getDiagnostics(filePath, deltaOnly, cwd);
          return {
            success: true,
            filePath,
            totalDiagnostics: diagnostics.length,
            diagnostics: diagnostics.map((d) => ({
              line: d.range.start.line + 1,
              character: d.range.start.character + 1,
              severity: d.severity,
              message: d.message,
              source: d.source,
            })),
          };
        },
      },
      {
        name: "lsp_hover",
        description: "Fetches type signatures, declaration headers, and docstrings for a symbol at a specific file position (line and character).",
        parameters: {
          filePath: {
            type: "string",
            required: true,
            description: "Path to the file to inspect.",
          },
          line: {
            type: "number",
            required: true,
            description: "1-indexed line number.",
          },
          character: {
            type: "number",
            required: true,
            description: "1-indexed character position on the line.",
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const filePath = String(args.filePath || "").trim();
          const line = Math.max(0, Number(args.line || 1) - 1);
          const character = Math.max(0, Number(args.character || 1) - 1);

          const hover = this.supervisor.getHover(filePath, line, character, cwd);
          return {
            success: true,
            filePath,
            line: line + 1,
            character: character + 1,
            hover: hover ? hover.contents : null,
          };
        },
      },
      {
        name: "lsp_definition",
        description: "Resolves the definition location (file path and line number) for a symbol at a specific file position.",
        parameters: {
          filePath: {
            type: "string",
            required: true,
            description: "Path to the file containing the symbol reference.",
          },
          line: {
            type: "number",
            required: true,
            description: "1-indexed line number.",
          },
          character: {
            type: "number",
            required: true,
            description: "1-indexed character position on the line.",
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const filePath = String(args.filePath || "").trim();
          const line = Math.max(0, Number(args.line || 1) - 1);
          const character = Math.max(0, Number(args.character || 1) - 1);

          const def = this.supervisor.getDefinition(filePath, line, character, cwd);
          if (!def) {
            return {
              success: false,
              error: "Definition not found for symbol at specified position",
            };
          }

          return {
            success: true,
            definition: {
              filePath: def.uri,
              line: def.range.start.line + 1,
              character: def.range.start.character + 1,
            },
          };
        },
      },
      {
        name: "lsp_references",
        description: "Finds all occurrences, references, and call sites for a given symbol name across all indexed workspace files.",
        parameters: {
          symbolName: {
            type: "string",
            required: true,
            description: "The symbol identifier name to search across the workspace.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const symbolName = String(args.symbolName || "").trim();
          const references = this.supervisor.getReferences(symbolName);

          return {
            success: true,
            symbolName,
            totalReferences: references.length,
            references: references.map((r) => ({
              filePath: r.uri,
              line: r.range.start.line + 1,
              character: r.range.start.character + 1,
              snippet: r.lineContent,
            })),
          };
        },
      },
      {
        name: "lsp_document_symbols",
        description: "Extracts a structured outline of all top-level and member AST symbols (classes, interfaces, functions, methods, variables) in a file.",
        parameters: {
          filePath: {
            type: "string",
            required: true,
            description: "Path to the file to inspect.",
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const filePath = String(args.filePath || "").trim();
          const symbols = this.supervisor.getDocumentSymbols(filePath, cwd);

          return {
            success: true,
            filePath,
            totalSymbols: symbols.length,
            symbols: symbols.map((s) => ({
              name: s.name,
              kind: s.kind,
              containerName: s.containerName,
              line: s.location.range.start.line + 1,
            })),
          };
        },
      },
      {
        name: "lsp_workspace_symbols",
        description: "Searches for symbols (classes, interfaces, functions, variables) across all workspace files matching a query string.",
        parameters: {
          query: {
            type: "string",
            required: true,
            description: "Query prefix or search string.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const query = String(args.query || "").trim();
          const symbols = this.supervisor.searchWorkspaceSymbols(query);

          return {
            success: true,
            query,
            totalSymbols: symbols.length,
            symbols: symbols.map((s) => ({
              name: s.name,
              kind: s.kind,
              filePath: s.location.uri,
              line: s.location.range.start.line + 1,
            })),
          };
        },
      },
    ];
  }
}
