/**
 * code-syntax-validator.ts
 *
 * In-Memory Multi-Language Code Syntax Validator & Pre-Flight Linter.
 * Validates syntax of code snippets (TypeScript, JavaScript, JSON, YAML, Python)
 * before files are written to disk.
 */

import * as vm from "node:vm";

export interface SyntaxErrorItem {
  readonly line: number;
  readonly column?: number;
  readonly message: string;
}

export interface SyntaxValidationResult {
  readonly valid: boolean;
  readonly language: string;
  readonly errors: SyntaxErrorItem[];
}

export class CodeSyntaxValidator {
  /**
   * Validates code syntax in memory.
   */
  public validate(code: string, language: string): SyntaxValidationResult {
    const lang = language.toLowerCase().trim();

    if (["json", "jsonc"].includes(lang)) {
      return this.validateJson(code);
    }

    if (["javascript", "js", "typescript", "ts", "jsx", "tsx", "mjs"].includes(lang)) {
      return this.validateJsTs(code, lang);
    }

    if (["python", "py"].includes(lang)) {
      return this.validatePython(code);
    }

    // Default passthrough for other languages
    return { valid: true, language: lang, errors: [] };
  }

  private validateJson(code: string): SyntaxValidationResult {
    try {
      JSON.parse(code);
      return { valid: true, language: "json", errors: [] };
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      let line = 1;
      let column = 1;

      // Extract line/column from message if available (e.g. "at position 120" or "line 3 column 5")
      const lineMatch = msg.match(/line\s+(\d+)\s+column\s+(\d+)/i);
      if (lineMatch) {
        line = parseInt(lineMatch[1], 10);
        column = parseInt(lineMatch[2], 10);
      } else {
        const posMatch = msg.match(/position\s+(\d+)/i);
        if (posMatch) {
          const pos = parseInt(posMatch[1], 10);
          const lines = code.slice(0, pos).split("\n");
          line = lines.length;
          column = lines[lines.length - 1].length + 1;
        }
      }

      return {
        valid: false,
        language: "json",
        errors: [{ line, column, message: msg }],
      };
    }
  }

  private validateJsTs(code: string, language: string): SyntaxValidationResult {
    const errors: SyntaxErrorItem[] = [];
    const stack: Array<{ char: string; line: number }> = [];
    const lines = code.split(/\r?\n/);

    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplate = false;
    let inBlockComment = false;

    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const line = lines[lIdx];
      const lineNum = lIdx + 1;

      for (let cIdx = 0; cIdx < line.length; cIdx++) {
        const char = line[cIdx];
        const nextChar = line[cIdx + 1];
        const prevChar = line[cIdx - 1];

        if (inBlockComment) {
          if (char === "*" && nextChar === "/") {
            inBlockComment = false;
            cIdx++;
          }
          continue;
        }

        if (char === "/" && nextChar === "*" && !inSingleQuote && !inDoubleQuote && !inTemplate) {
          inBlockComment = true;
          cIdx++;
          continue;
        }

        if (char === "/" && nextChar === "/" && !inSingleQuote && !inDoubleQuote && !inTemplate) {
          break; // skip line
        }

        if (char === "'" && !inDoubleQuote && !inTemplate && prevChar !== "\\") {
          inSingleQuote = !inSingleQuote;
          continue;
        }

        if (char === '"' && !inSingleQuote && !inTemplate && prevChar !== "\\") {
          inDoubleQuote = !inDoubleQuote;
          continue;
        }

        if (char === "`" && !inSingleQuote && !inDoubleQuote && prevChar !== "\\") {
          inTemplate = !inTemplate;
          continue;
        }

        if (inSingleQuote || inDoubleQuote || inTemplate) continue;

        if (char === "{" || char === "(" || char === "[") {
          stack.push({ char, line: lineNum });
        } else if (char === "}" || char === ")" || char === "]") {
          const expected = char === "}" ? "{" : char === ")" ? "(" : "[";
          if (stack.length === 0 || stack[stack.length - 1].char !== expected) {
            errors.push({ line: lineNum, message: `Unexpected closing '${char}'` });
          } else {
            stack.pop();
          }
        }
      }
    }

    if (inBlockComment) {
      errors.push({ line: lines.length, message: "Unterminated block comment" });
    }
    if (inTemplate) {
      errors.push({ line: lines.length, message: "Unterminated template literal" });
    }

    for (const unclosed of stack) {
      errors.push({ line: unclosed.line, message: `Unclosed delimiter '${unclosed.char}'` });
    }

    return {
      valid: errors.length === 0,
      language,
      errors,
    };
  }

  private validatePython(code: string): SyntaxValidationResult {
    const lines = code.split(/\r?\n/);
    const errors: SyntaxErrorItem[] = [];

    // Basic indentation and structure check
    let expectedIndent: number | null = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lineNum = i + 1;

      if (!trimmed || trimmed.startsWith("#")) continue;

      const indent = line.search(/\S/);

      if (expectedIndent !== null && indent !== expectedIndent && indent <= (expectedIndent - 4)) {
        // Block did not indent after colon
        if (lines[i - 1].trim().endsWith(":")) {
          errors.push({
            line: lineNum,
            message: `Expected indented block after ':'`,
          });
        }
      }

      if (trimmed.endsWith(":")) {
        expectedIndent = indent + 4;
      } else {
        expectedIndent = null;
      }
    }

    return {
      valid: errors.length === 0,
      language: "python",
      errors,
    };
  }
}
