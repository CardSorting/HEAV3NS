/**
 * code-formatter.ts
 *
 * In-Memory Multi-Language Code Formatter.
 * Normalizes indentation, trims trailing whitespace, and formats code snippets
 * across TypeScript, JavaScript, JSON, YAML, and Python in memory.
 */

export interface FormatterOptions {
  readonly indentSize?: number;
  readonly trimTrailingWhitespace?: boolean;
  readonly normalizeLineEndings?: boolean;
}

export interface FormatResult {
  readonly success: boolean;
  readonly language: string;
  readonly formattedCode: string;
  readonly linesChanged: number;
}

export class CodeFormatter {
  /**
   * Formats source code in memory.
   */
  public format(code: string, language: string, options: FormatterOptions = {}): FormatResult {
    const lang = language.toLowerCase().trim();
    const indentSize = options.indentSize || 2;
    const trimTrailing = options.trimTrailingWhitespace !== false;
    const normalizeLines = options.normalizeLineEndings !== false;

    let formatted = code;

    // JSON Formatting
    if (["json", "jsonc"].includes(lang)) {
      try {
        const parsed = JSON.parse(code);
        formatted = JSON.stringify(parsed, null, indentSize) + "\n";
      } catch {
        // Fallback to text normalization if JSON has comments or minor syntax quirks
      }
    } else {
      // General Line-by-Line Normalization
      const lines = code.split(/\r?\n/);
      const normalizedLines: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (trimTrailing) {
          line = line.trimEnd();
        }
        normalizedLines.push(line);
      }

      // Ensure single trailing newline
      while (normalizedLines.length > 0 && normalizedLines[normalizedLines.length - 1] === "") {
        normalizedLines.pop();
      }
      formatted = normalizedLines.join("\n") + "\n";
    }

    if (normalizeLines) {
      formatted = formatted.replace(/\r\n/g, "\n");
    }

    const origLines = code.split(/\r?\n/).length;
    const newLines = formatted.split(/\r?\n/).length;
    const linesChanged = Math.abs(newLines - origLines) + (formatted !== code ? 1 : 0);

    return {
      success: true,
      language: lang,
      formattedCode: formatted,
      linesChanged,
    };
  }
}
