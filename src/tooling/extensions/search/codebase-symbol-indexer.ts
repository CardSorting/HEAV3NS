/**
 * codebase-symbol-indexer.ts
 *
 * High-Throughput In-Memory Multi-Language Codebase Symbol Indexer.
 * Fast parallel extraction of symbols (classes, interfaces, functions, methods, types, enums, structs)
 * across workspace files without external subshell overhead.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export type SymbolKind =
  | "interface"
  | "type"
  | "class"
  | "function"
  | "method"
  | "enum"
  | "constant"
  | "struct"
  | "trait";

export interface CodeSymbol {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly file: string;
  readonly line: number;
  readonly signature: string;
}

export interface SymbolSearchOptions {
  readonly query?: string;
  readonly kind?: SymbolKind;
  readonly limit?: number;
  readonly includePatterns?: string[];
  readonly excludePatterns?: string[];
}

const SUPPORTED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".py",
  ".rs",
  ".go",
  ".java",
]);

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".gemini",
  "scratch",
]);

export class CodebaseSymbolIndexer {
  /**
   * Scans a workspace directory recursively and searches for symbols matching criteria.
   */
  public async searchSymbols(
    rootDir: string,
    options: SymbolSearchOptions = {}
  ): Promise<{ totalFound: number; symbols: CodeSymbol[] }> {
    const query = options.query?.toLowerCase() || "";
    const targetKind = options.kind;
    const limit = options.limit || 50;

    const files = await this.collectFiles(rootDir);
    const symbols: CodeSymbol[] = [];

    // Parallel scanning in chunks of 20
    const chunkSize = 20;
    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(
        chunk.map(async (filePath) => {
          try {
            const content = await fs.readFile(filePath, "utf-8");
            const relPath = path.relative(rootDir, filePath);
            return this.extractSymbolsFromFile(content, relPath);
          } catch {
            return [];
          }
        })
      );

      for (const list of chunkResults) {
        for (const sym of list) {
          if (targetKind && sym.kind !== targetKind) continue;
          if (query && !sym.name.toLowerCase().includes(query)) continue;

          symbols.push(sym);
          if (symbols.length >= limit) {
            return { totalFound: symbols.length, symbols };
          }
        }
      }
    }

    return { totalFound: symbols.length, symbols };
  }

  /**
   * Finds the primary declaration of a symbol by exact or case-insensitive match.
   */
  public async findDefinition(rootDir: string, symbolName: string): Promise<CodeSymbol | null> {
    const res = await this.searchSymbols(rootDir, { query: symbolName, limit: 10 });
    const exact = res.symbols.find((s) => s.name === symbolName);
    if (exact) return exact;
    const caseInsensitive = res.symbols.find((s) => s.name.toLowerCase() === symbolName.toLowerCase());
    return caseInsensitive || null;
  }

  /**
   * Finds all references and call sites of a symbol across workspace files.
   */
  public async findReferences(
    rootDir: string,
    symbolName: string,
    limit = 50
  ): Promise<{ totalFound: number; references: Array<{ file: string; line: number; text: string }> }> {
    const files = await this.collectFiles(rootDir);
    const references: Array<{ file: string; line: number; text: string }> = [];
    const regex = new RegExp(`\\b${symbolName}\\b`);

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, "utf-8");
        if (!content.includes(symbolName)) continue;

        const relPath = path.relative(rootDir, filePath);
        const lines = content.split(/\r?\n/);

        for (let idx = 0; idx < lines.length; idx++) {
          const line = lines[idx];
          if (regex.test(line)) {
            references.push({
              file: relPath,
              line: idx + 1,
              text: line.trim().slice(0, 120),
            });
            if (references.length >= limit) {
              return { totalFound: references.length, references };
            }
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return { totalFound: references.length, references };
  }

  /**
   * Extracts code symbols from raw file content.
   */
  public extractSymbolsFromFile(content: string, relPath: string): CodeSymbol[] {
    const ext = path.extname(relPath).toLowerCase();
    const lines = content.split(/\r?\n/);
    const symbols: CodeSymbol[] = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*")) {
        continue;
      }

      const lineNum = idx + 1;

      // TypeScript / JavaScript
      if (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx" || ext === ".mjs") {
        // export? interface Name
        const ifaceMatch = trimmed.match(/^(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/);
        if (ifaceMatch) {
          symbols.push({ name: ifaceMatch[1], kind: "interface", file: relPath, line: lineNum, signature: trimmed.slice(0, 100) });
          continue;
        }

        // export? type Name
        const typeMatch = trimmed.match(/^(?:export\s+)?type\s+([A-Za-z0-9_$]+)\s*=/);
        if (typeMatch) {
          symbols.push({ name: typeMatch[1], kind: "type", file: relPath, line: lineNum, signature: trimmed.slice(0, 100) });
          continue;
        }

        // export? (abstract)? class Name
        const classMatch = trimmed.match(/^(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/);
        if (classMatch) {
          symbols.push({ name: classMatch[1], kind: "class", file: relPath, line: lineNum, signature: trimmed.slice(0, 100) });
          continue;
        }

        // export? (async)? function Name
        const funcMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/);
        if (funcMatch) {
          symbols.push({ name: funcMatch[1], kind: "function", file: relPath, line: lineNum, signature: trimmed.slice(0, 100) });
          continue;
        }

        // export? enum Name
        const enumMatch = trimmed.match(/^(?:export\s+)?enum\s+([A-Za-z0-9_$]+)/);
        if (enumMatch) {
          symbols.push({ name: enumMatch[1], kind: "enum", file: relPath, line: lineNum, signature: trimmed.slice(0, 100) });
          continue;
        }

        // export const Name =
        const constMatch = trimmed.match(/^export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/);
        if (constMatch) {
          symbols.push({ name: constMatch[1], kind: "constant", file: relPath, line: lineNum, signature: trimmed.slice(0, 100) });
          continue;
        }
      }

      // Python (def, class)
      if (ext === ".py") {
        const pyClass = trimmed.match(/^class\s+([A-Za-z0-9_]+)/);
        if (pyClass) {
          symbols.push({ name: pyClass[1], kind: "class", file: relPath, line: lineNum, signature: trimmed.slice(0, 100) });
          continue;
        }
        const pyDef = trimmed.match(/^def\s+([A-Za-z0-9_]+)\s*\(/);
        if (pyDef) {
          symbols.push({ name: pyDef[1], kind: "function", file: relPath, line: lineNum, signature: trimmed.slice(0, 100) });
          continue;
        }
      }

      // Rust (pub fn, struct, enum, trait)
      if (ext === ".rs") {
        const rsStruct = trimmed.match(/^(?:pub\s+)?struct\s+([A-Za-z0-9_]+)/);
        if (rsStruct) {
          symbols.push({ name: rsStruct[1], kind: "struct", file: relPath, line: lineNum, signature: trimmed.slice(0, 100) });
          continue;
        }
        const rsTrait = trimmed.match(/^(?:pub\s+)?trait\s+([A-Za-z0-9_]+)/);
        if (rsTrait) {
          symbols.push({ name: rsTrait[1], kind: "trait", file: relPath, line: lineNum, signature: trimmed.slice(0, 100) });
          continue;
        }
        const rsFn = trimmed.match(/^(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)/);
        if (rsFn) {
          symbols.push({ name: rsFn[1], kind: "function", file: relPath, line: lineNum, signature: trimmed.slice(0, 100) });
          continue;
        }
      }

      // Go (type Struct struct, func Name)
      if (ext === ".go") {
        const goType = trimmed.match(/^type\s+([A-Za-z0-9_]+)\s+struct/);
        if (goType) {
          symbols.push({ name: goType[1], kind: "struct", file: relPath, line: lineNum, signature: trimmed.slice(0, 100) });
          continue;
        }
        const goFunc = trimmed.match(/^func\s+(?:\([^\)]+\)\s+)?([A-Za-z0-9_]+)\s*\(/);
        if (goFunc) {
          symbols.push({ name: goFunc[1], kind: "function", file: relPath, line: lineNum, signature: trimmed.slice(0, 100) });
          continue;
        }
      }
    }

    return symbols;
  }

  private async collectFiles(dir: string): Promise<string[]> {
    const results: string[] = [];

    const walk = async (current: string, depth = 0) => {
      if (depth > 8) return;
      let entries: any[] = [];
      try {
        entries = await fs.readdir(current, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (IGNORED_DIRECTORIES.has(entry.name) || entry.name.startsWith(".")) {
          continue;
        }
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(full, depth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (SUPPORTED_EXTENSIONS.has(ext)) {
            results.push(full);
          }
        }
      }
    };

    await walk(dir);
    return results;
  }
}
