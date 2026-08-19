/**
 * [LAYER: AGENTS EXTENSION]
 * mini-yaml-parser.ts
 *
 * Zero-dependency in-tree YAML subset parser for agent runbook specifications (Phase 193 / ADR-123).
 * Parses nested mappings, lists, scalars, and block strings (| and >) natively.
 */

export class MiniYamlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MiniYamlError";
  }
}

interface Line {
  readonly number: number;
  readonly indent: number;
  readonly text: string;
}

export class MiniYamlParser {
  /**
   * Parses a YAML or JSON string into a structured JavaScript object.
   */
  static parse(text: string): unknown {
    const stripped = text.trim();
    if (!stripped) {
      return {};
    }

    if (stripped.startsWith("{") || stripped.startsWith("[")) {
      try {
        return JSON.parse(stripped);
      } catch (err) {
        throw new MiniYamlError(`Failed to parse inline JSON: ${(err as Error).message}`);
      }
    }

    const lines = MiniYamlParser.extractLogicalLines(text);
    const parser = new MiniYamlParserInternal(lines);
    const result = parser.parseBlock(0);
    parser.expectDone();
    return result;
  }

  private static extractLogicalLines(text: string): Line[] {
    const lines: Line[] = [];
    const rawLines = text.split(/\r?\n/);

    for (let i = 0; i < rawLines.length; i++) {
      const raw = rawLines[i];
      const number = i + 1;
      const leadingTabs = raw.match(/^\t+/);
      if (leadingTabs) {
        throw new MiniYamlError(`Line ${number}: tabs are not supported for indentation`);
      }

      const stripped = raw.trim();
      if (!stripped || stripped.startsWith("#")) {
        continue;
      }

      const indent = raw.length - raw.trimStart().length;
      lines.push({
        number,
        indent,
        text: raw.substring(indent).trimEnd(),
      });
    }

    return lines;
  }
}

class MiniYamlParserInternal {
  private readonly lines: Line[];
  private index = 0;

  constructor(lines: Line[]) {
    this.lines = lines;
  }

  expectDone(): void {
    if (this.index < this.lines.length) {
      const line = this.lines[this.index];
      throw new MiniYamlError(`Line ${line.number}: unexpected content "${line.text}"`);
    }
  }

  parseBlock(indent: number): unknown {
    if (this.index >= this.lines.length) {
      return {};
    }

    const line = this.lines[this.index];
    if (line.indent < indent) {
      return {};
    }
    if (line.indent > indent) {
      throw new MiniYamlError(`Line ${line.number}: unexpected indentation`);
    }

    if (line.text.startsWith("- ")) {
      return this.parseList(indent);
    }
    return this.parseMapping(indent);
  }

  parseMapping(indent: number): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    while (this.index < this.lines.length) {
      const line = this.lines[this.index];
      if (line.indent < indent) {
        break;
      }
      if (line.indent > indent) {
        throw new MiniYamlError(`Line ${line.number}: unexpected indentation`);
      }
      if (line.text.startsWith("- ")) {
        break;
      }

      const [key, valueText] = this.splitKeyValue(line);
      this.index++;

      if (valueText === "|" || valueText === ">") {
        result[key] = this.collectBlockScalar(line.indent, valueText === ">");
      } else if (valueText === "") {
        result[key] = this.parseChildOrEmpty(line.indent);
      } else {
        result[key] = this.parseScalar(valueText);
      }
    }

    return result;
  }

  parseList(indent: number): unknown[] {
    const result: unknown[] = [];

    while (this.index < this.lines.length) {
      const line = this.lines[this.index];
      if (line.indent < indent) {
        break;
      }
      if (line.indent > indent) {
        throw new MiniYamlError(`Line ${line.number}: unexpected indentation`);
      }
      if (!line.text.startsWith("- ")) {
        break;
      }

      const itemText = line.text.substring(2).trim();
      this.index++;

      if (itemText === "") {
        result.push(this.parseChildOrEmpty(line.indent));
        continue;
      }

      if (this.looksLikeKeyValue(itemText)) {
        const [key, valueText] = this.splitInlineKeyValue(itemText, line.number);
        const item: Record<string, unknown> = {};

        if (valueText === "|" || valueText === ">") {
          item[key] = this.collectBlockScalar(line.indent, valueText === ">");
        } else if (valueText === "") {
          item[key] = this.parseChildOrEmpty(line.indent);
        } else {
          item[key] = this.parseScalar(valueText);
        }

        if (this.index < this.lines.length && this.lines[this.index].indent > indent) {
          const child = this.parseBlock(this.lines[this.index].indent);
          if (child && typeof child === "object" && !Array.isArray(child)) {
            Object.assign(item, child);
          }
        }
        result.push(item);
      } else {
        result.push(this.parseScalar(itemText));
      }
    }

    return result;
  }

  private parseChildOrEmpty(parentIndent: number): unknown {
    if (this.index >= this.lines.length || this.lines[this.index].indent <= parentIndent) {
      return {};
    }
    return this.parseBlock(this.lines[this.index].indent);
  }

  private collectBlockScalar(parentIndent: number, folded: boolean): string {
    const blockLines: Line[] = [];

    while (this.index < this.lines.length && this.lines[this.index].indent > parentIndent) {
      blockLines.push(this.lines[this.index]);
      this.index++;
    }

    if (blockLines.length === 0) {
      return "";
    }

    const minIndent = Math.min(...blockLines.filter((l) => l.text.length > 0).map((l) => l.indent));
    const values = blockLines.map((l) => {
      const extraIndent = l.indent >= minIndent ? " ".repeat(l.indent - minIndent) : "";
      return extraIndent + l.text;
    });

    if (folded) {
      return values.map((v) => v.trim()).join(" ").trim();
    }
    return values.join("\n").trim();
  }

  private splitKeyValue(line: Line): [string, string] {
    const colonIdx = line.text.indexOf(":");
    if (colonIdx === -1) {
      throw new MiniYamlError(`Line ${line.number}: expected key-value mapping (missing ':')`);
    }

    const key = line.text.substring(0, colonIdx).trim();
    const value = line.text.substring(colonIdx + 1).trim();
    return [key, value];
  }

  private splitInlineKeyValue(itemText: string, lineNumber: number): [string, string] {
    const colonIdx = itemText.indexOf(":");
    if (colonIdx === -1) {
      throw new MiniYamlError(`Line ${lineNumber}: expected key-value mapping in list item`);
    }

    const key = itemText.substring(0, colonIdx).trim();
    const value = itemText.substring(colonIdx + 1).trim();
    return [key, value];
  }

  private looksLikeKeyValue(text: string): boolean {
    const colonIdx = text.indexOf(":");
    if (colonIdx <= 0) return false;
    const beforeColon = text.substring(0, colonIdx);
    return !beforeColon.includes(" ") && !beforeColon.startsWith("\"") && !beforeColon.startsWith("'");
  }

  private parseScalar(text: string): unknown {
    const trimmed = text.trim();
    if (!trimmed) return "";

    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null" || trimmed === "~") return null;

    // Quoted strings
    if (
      (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.substring(1, trimmed.length - 1);
    }

    // Numbers
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (!isNaN(num)) return num;
    }

    // JSON Arrays or Objects
    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}"))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Return raw text if not valid JSON
      }
    }

    return trimmed;
  }
}
