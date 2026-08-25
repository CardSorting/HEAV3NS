/**
 * code-structure-extractor.ts
 *
 * High-Precision AST Code Structure & Symbol Outline Extractor.
 * Parses source code into structured hierarchies of symbols (classes, interfaces,
 * methods, functions, types, enums) with exact line spans, signatures, and visibility.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface OutlineItem {
  readonly name: string;
  readonly kind: "class" | "interface" | "function" | "method" | "type" | "enum" | "property" | "constructor";
  readonly startLine: number;
  readonly endLine: number;
  readonly signature: string;
  readonly visibility?: "public" | "private" | "protected";
  readonly isExported?: boolean;
  readonly children?: OutlineItem[];
}

export interface FileOutlineResult {
  readonly filePath: string;
  readonly totalLines: number;
  readonly items: OutlineItem[];
  readonly formattedOutline: string;
}

export class CodeStructureExtractor {
  /**
   * Extracts structured outline from a file path.
   */
  public async extractOutline(targetPath: string): Promise<FileOutlineResult> {
    const content = await fs.readFile(targetPath, "utf-8");
    return this.extractFromContent(content, targetPath);
  }

  /**
   * Extracts structured outline from raw file content.
   */
  public extractFromContent(content: string, filePath: string): FileOutlineResult {
    const lines = content.split(/\r?\n/);
    const ext = path.extname(filePath).toLowerCase();
    const items: OutlineItem[] = [];

    let currentParent: { item: OutlineItem; indent: number; braceDepth: number } | null = null;
    let braceDepth = 0;

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const trimmed = line.trim();
      const lineNum = idx + 1;

      // Track brace depth
      for (const char of line) {
        if (char === "{") braceDepth++;
        if (char === "}") {
          braceDepth--;
          if (currentParent && braceDepth < currentParent.braceDepth) {
            (currentParent.item as any).endLine = lineNum;
            currentParent = null;
          }
        }
      }

      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
        continue;
      }

      // Check if TypeScript / JavaScript
      if (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx" || ext === ".mjs") {
        // Export flag & visibility
        const isExported = /\bexport\b/.test(trimmed);
        const visibility = trimmed.includes("private ")
          ? "private"
          : trimmed.includes("protected ")
          ? "protected"
          : trimmed.includes("public ")
          ? "public"
          : undefined;

        // Class
        const classMatch = trimmed.match(/(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/);
        if (classMatch) {
          const item: OutlineItem = {
            name: classMatch[1],
            kind: "class",
            startLine: lineNum,
            endLine: lineNum,
            signature: trimmed.slice(0, 100),
            isExported,
            visibility,
            children: [],
          };
          items.push(item);
          currentParent = { item, indent: line.search(/\S/), braceDepth };
          continue;
        }

        // Interface
        const ifaceMatch = trimmed.match(/(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/);
        if (ifaceMatch) {
          const item: OutlineItem = {
            name: ifaceMatch[1],
            kind: "interface",
            startLine: lineNum,
            endLine: lineNum,
            signature: trimmed.slice(0, 100),
            isExported,
            visibility,
            children: [],
          };
          items.push(item);
          currentParent = { item, indent: line.search(/\S/), braceDepth };
          continue;
        }

        // Type
        const typeMatch = trimmed.match(/(?:export\s+)?type\s+([A-Za-z0-9_$]+)\s*=/);
        if (typeMatch) {
          items.push({
            name: typeMatch[1],
            kind: "type",
            startLine: lineNum,
            endLine: lineNum,
            signature: trimmed.slice(0, 100),
            isExported,
          });
          continue;
        }

        // Enum
        const enumMatch = trimmed.match(/(?:export\s+)?enum\s+([A-Za-z0-9_$]+)/);
        if (enumMatch) {
          const item: OutlineItem = {
            name: enumMatch[1],
            kind: "enum",
            startLine: lineNum,
            endLine: lineNum,
            signature: trimmed.slice(0, 100),
            isExported,
            children: [],
          };
          items.push(item);
          currentParent = { item, indent: line.search(/\S/), braceDepth };
          continue;
        }

        // Methods / Member Functions inside a class or interface
        if (currentParent) {
          // Constructor
          const ctorMatch = trimmed.match(/(?:public|private|protected)?\s*constructor\s*\(/);
          if (ctorMatch) {
            currentParent.item.children?.push({
              name: "constructor",
              kind: "constructor",
              startLine: lineNum,
              endLine: lineNum,
              signature: trimmed.slice(0, 100),
              visibility,
            });
            continue;
          }

          // Method
          const methodMatch = trimmed.match(/(?:(?:public|private|protected|static|async|override|readonly)\s+)*([A-Za-z0-9_$]+)\s*\(/);
          if (methodMatch && !["if", "for", "while", "switch", "catch"].includes(methodMatch[1])) {
            currentParent.item.children?.push({
              name: methodMatch[1],
              kind: "method",
              startLine: lineNum,
              endLine: lineNum,
              signature: trimmed.slice(0, 100),
              visibility,
            });
            continue;
          }
        } else {
          // Standalone Function
          const funcMatch = trimmed.match(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/);
          if (funcMatch) {
            items.push({
              name: funcMatch[1],
              kind: "function",
              startLine: lineNum,
              endLine: lineNum,
              signature: trimmed.slice(0, 100),
              isExported,
            });
            continue;
          }
        }
      }

      // Python
      if (ext === ".py") {
        const pyClass = trimmed.match(/^class\s+([A-Za-z0-9_]+)/);
        if (pyClass) {
          items.push({
            name: pyClass[1],
            kind: "class",
            startLine: lineNum,
            endLine: lineNum,
            signature: trimmed.slice(0, 100),
          });
          continue;
        }
        const pyDef = trimmed.match(/^def\s+([A-Za-z0-9_]+)\s*\(/);
        if (pyDef) {
          items.push({
            name: pyDef[1],
            kind: "function",
            startLine: lineNum,
            endLine: lineNum,
            signature: trimmed.slice(0, 100),
          });
          continue;
        }
      }
    }

    const formattedOutline = this.formatOutlineTree(items, path.basename(filePath));

    return {
      filePath,
      totalLines: lines.length,
      items,
      formattedOutline,
    };
  }

  private formatOutlineTree(items: OutlineItem[], filename: string): string {
    const lines: string[] = [`📄 ${filename}`];

    const formatItems = (list: OutlineItem[], prefix: string) => {
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const isLast = i === list.length - 1;
        const branch = isLast ? "└── " : "├── ";
        const nextPrefix = prefix + (isLast ? "    " : "│   ");

        const icon =
          item.kind === "class"
            ? "🏛️"
            : item.kind === "interface"
            ? "📐"
            : item.kind === "function"
            ? "⚡"
            : item.kind === "method"
            ? "🔹"
            : item.kind === "constructor"
            ? "🔨"
            : item.kind === "type"
            ? "🏷️"
            : item.kind === "enum"
            ? "🔢"
            : "🔸";

        const lineSpan = item.endLine > item.startLine
          ? ` (L${item.startLine}-${item.endLine})`
          : ` (L${item.startLine})`;

        const visBadge = item.visibility ? `[${item.visibility}] ` : "";
        const expBadge = item.isExported ? "[export] " : "";

        lines.push(`${prefix}${branch}${icon} ${expBadge}${visBadge}${item.kind} ${item.name}${lineSpan}`);

        if (item.children && item.children.length > 0) {
          formatItems(item.children, nextPrefix);
        }
      }
    };

    formatItems(items, "");
    return lines.join("\n");
  }
}
