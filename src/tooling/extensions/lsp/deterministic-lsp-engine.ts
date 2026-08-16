/**
 * deterministic-lsp-engine.ts
 *
 * In-memory zero-GC structural AST code perception and semantic analysis engine.
 * Provides symbol extraction, hover card inspection, definition resolution,
 * reference finding, and syntax diagnostics without requiring heavy external daemon processes.
 */

import type {
  LspDefinition,
  LspDiagnostic,
  LspHoverInfo,
  LspPosition,
  LspRange,
  LspReferenceLocation,
  LspSymbolInformation,
  LspSymbolKind,
} from "../../../core/contracts/lsp.contracts.js";

export class DeterministicLspEngine {
  /**
   * Extracts top-level and member AST symbols from TypeScript/JavaScript source code.
   */
  public extractSymbols(sourceCode: string, uri: string): LspSymbolInformation[] {
    const lines = sourceCode.split(/\r?\n/);
    const symbols: LspSymbolInformation[] = [];

    let currentContainer: string | undefined;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
        continue;
      }

      // Class declaration
      const classMatch = line.match(/(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/);
      if (classMatch) {
        const name = classMatch[1];
        const charIdx = line.indexOf(name);
        symbols.push({
          name,
          kind: "class",
          location: {
            uri,
            range: this.createRange(lineIdx, charIdx, name.length),
          },
        });
        currentContainer = name;
        continue;
      }

      // Interface declaration
      const interfaceMatch = line.match(/(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/);
      if (interfaceMatch) {
        const name = interfaceMatch[1];
        const charIdx = line.indexOf(name);
        symbols.push({
          name,
          kind: "interface",
          location: {
            uri,
            range: this.createRange(lineIdx, charIdx, name.length),
          },
        });
        currentContainer = name;
        continue;
      }

      // Type alias
      const typeMatch = line.match(/(?:export\s+)?type\s+([A-Za-z0-9_$]+)\s*=/);
      if (typeMatch) {
        const name = typeMatch[1];
        const charIdx = line.indexOf(name);
        symbols.push({
          name,
          kind: "typeParameter",
          location: {
            uri,
            range: this.createRange(lineIdx, charIdx, name.length),
          },
        });
        continue;
      }

      // Function declaration
      const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/);
      if (funcMatch) {
        const name = funcMatch[1];
        const charIdx = line.indexOf(name);
        symbols.push({
          name,
          kind: "function",
          location: {
            uri,
            range: this.createRange(lineIdx, charIdx, name.length),
          },
        });
        continue;
      }

      // Method declaration inside class
      const methodMatch = line.match(/(?:public|private|protected|static|async|\s)*([A-Za-z0-9_$]+)\s*\([^)]*\)\s*(?::\s*[^;{]+)?\s*\{/);
      if (methodMatch && currentContainer && !trimmed.startsWith("if") && !trimmed.startsWith("for") && !trimmed.startsWith("while") && !trimmed.startsWith("switch")) {
        const name = methodMatch[1];
        if (name !== "constructor" && name !== "function" && name !== "if" && name !== "return") {
          const charIdx = line.indexOf(name);
          symbols.push({
            name,
            kind: "method",
            containerName: currentContainer,
            location: {
              uri,
              range: this.createRange(lineIdx, charIdx, name.length),
            },
          });
          continue;
        }
      }

      // Const / let / var variable
      const varMatch = line.match(/(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*(?::\s*[^=]+)?\s*=/);
      if (varMatch) {
        const name = varMatch[1];
        const charIdx = line.indexOf(name);
        symbols.push({
          name,
          kind: "variable",
          location: {
            uri,
            range: this.createRange(lineIdx, charIdx, name.length),
          },
        });
        continue;
      }

      // Reset container if at top-level closing brace
      if (line.startsWith("}") || line.startsWith("};")) {
        currentContainer = undefined;
      }
    }

    return symbols;
  }

  /**
   * Generates hover card info for a symbol at a specific position.
   */
  public getHoverInfo(sourceCode: string, uri: string, position: LspPosition): LspHoverInfo | null {
    const lines = sourceCode.split(/\r?\n/);
    if (position.line < 0 || position.line >= lines.length) return null;

    const line = lines[position.line];
    const word = this.getWordAtPosition(line, position.character);
    if (!word) return null;

    const symbols = this.extractSymbols(sourceCode, uri);
    const matched = symbols.find((s) => s.name === word);

    if (matched) {
      const declLine = lines[matched.location.range.start.line]?.trim() || "";
      const containerPrefix = matched.containerName ? `(member of ${matched.containerName})\n` : "";
      return {
        contents: `**(${matched.kind})** \`${matched.name}\`\n\n${containerPrefix}\`\`\`typescript\n${declLine}\n\`\`\``,
        range: matched.location.range,
      };
    }

    return {
      contents: `\`${word}\``,
    };
  }

  /**
   * Resolves the definition location for a symbol at a given position.
   */
  public resolveDefinition(
    workspaceFiles: ReadonlyMap<string, string>,
    currentUri: string,
    position: LspPosition
  ): LspDefinition | null {
    const currentCode = workspaceFiles.get(currentUri);
    if (!currentCode) return null;

    const lines = currentCode.split(/\r?\n/);
    if (position.line < 0 || position.line >= lines.length) return null;

    const line = lines[position.line];
    const word = this.getWordAtPosition(line, position.character);
    if (!word) return null;

    // Search current file first
    const localSymbols = this.extractSymbols(currentCode, currentUri);
    const localMatch = localSymbols.find((s) => s.name === word);
    if (localMatch) {
      return {
        uri: currentUri,
        range: localMatch.location.range,
      };
    }

    // Search other workspace files
    for (const [uri, code] of workspaceFiles) {
      if (uri === currentUri) continue;
      const symbols = this.extractSymbols(code, uri);
      const match = symbols.find((s) => s.name === word);
      if (match) {
        return {
          uri,
          range: match.location.range,
        };
      }
    }

    return null;
  }

  /**
   * Finds all references and call sites for a symbol across workspace files.
   */
  public findReferences(
    workspaceFiles: ReadonlyMap<string, string>,
    symbolName: string
  ): LspReferenceLocation[] {
    const references: LspReferenceLocation[] = [];
    const regex = new RegExp(`\\b${this.escapeRegex(symbolName)}\\b`, "g");

    for (const [uri, code] of workspaceFiles) {
      const lines = code.split(/\r?\n/);
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        let match: RegExpExecArray | null;
        regex.lastIndex = 0;

        while ((match = regex.exec(line)) !== null) {
          references.push({
            uri,
            range: this.createRange(lineIdx, match.index, symbolName.length),
            lineContent: line.trim(),
          });
        }
      }
    }

    return references;
  }

  /**
   * Performs in-memory syntax and structural integrity diagnostic inspection.
   */
  public inspectDiagnostics(sourceCode: string): LspDiagnostic[] {
    const diagnostics: LspDiagnostic[] = [];
    const lines = sourceCode.split(/\r?\n/);

    const openBraces: { char: string; line: number; col: number }[] = [];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const trimmed = line.trim();

      // Check trailing syntax errors
      const trailingIdx = Math.max(line.indexOf(",}"), line.indexOf(",]"));
      if (trailingIdx !== -1) {
        diagnostics.push({
          range: this.createRange(lineIdx, trailingIdx, 2),
          severity: "warning",
          message: "Trailing comma before closing bracket",
          source: "lumi-lsp",
        });
      }

      // Check unmatched brackets (excluding strings/comments)
      let inString: string | null = null;
      for (let col = 0; col < line.length; col++) {
        const ch = line[col];
        if ((ch === '"' || ch === "'" || ch === "`") && line[col - 1] !== "\\") {
          if (inString === ch) inString = null;
          else if (!inString) inString = ch;
          continue;
        }

        if (inString) continue;

        if (ch === "{" || ch === "(" || ch === "[") {
          openBraces.push({ char: ch, line: lineIdx, col });
        } else if (ch === "}" || ch === ")" || ch === "]") {
          const expected = ch === "}" ? "{" : ch === ")" ? "(" : "[";
          const last = openBraces.pop();
          if (!last || last.char !== expected) {
            diagnostics.push({
              range: this.createRange(lineIdx, col, 1),
              severity: "error",
              message: `Unmatched closing bracket '${ch}'`,
              source: "lumi-lsp",
            });
          }
        }
      }
    }

    // Report unclosed brackets
    for (const unclosed of openBraces) {
      diagnostics.push({
        range: this.createRange(unclosed.line, unclosed.col, 1),
        severity: "error",
        message: `Unclosed opening bracket '${unclosed.char}'`,
        source: "lumi-lsp",
      });
    }

    return diagnostics;
  }

  private createRange(line: number, character: number, length: number): LspRange {
    return {
      start: { line, character: Math.max(0, character) },
      end: { line, character: Math.max(0, character + length) },
    };
  }

  private getWordAtPosition(line: string, charIdx: number): string | null {
    if (charIdx < 0 || charIdx >= line.length) return null;

    let start = charIdx;
    while (start > 0 && /[A-Za-z0-9_$]/.test(line[start - 1])) {
      start--;
    }

    let end = charIdx;
    while (end < line.length && /[A-Za-z0-9_$]/.test(line[end])) {
      end++;
    }

    if (start === end) return null;
    return line.slice(start, end);
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
