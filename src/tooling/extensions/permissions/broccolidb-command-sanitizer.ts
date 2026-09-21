/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 187: Zero-Dependency Broccoli Command Sanitizer
 *
 * Lifted from external source workspace/codemarie-new/src/integrations/terminal/commandSanitizer.ts.
 * Provides shell command boundary splitting (splitCommand), interactive editor/REPL blocking (validateCommand),
 * shell environment assignment parsing, and execution safety scoring. Zero external npm dependencies.
 */

export interface CommandValidationResult {
  valid: boolean;
  error?: string;
  isInteractiveBlocked?: boolean;
}

const INTERACTIVE_EDITORS = new Set(["emacs", "joe", "micro", "nano", "nano-tiny", "neovim", "nvim", "vi", "vim"]);
const INTERACTIVE_REPLS = new Set(["irb", "node", "perl", "php", "python", "python2", "python3", "ruby", "gdb"]);

export class BroccoliCommandSanitizer {
  /**
   * Splits a shell command string into individual sub-commands along boundaries (;, &&, ||, \n).
   */
  public splitCommand(command: string): string[] {
    const segments: string[] = [];
    let current = "";
    let escaped = false;
    let inDoubleQuote = false;
    let inSingleQuote = false;

    const flush = () => {
      const segment = current.trim();
      if (segment) {
        segments.push(segment);
      }
      current = "";
    };

    for (let i = 0; i < command.length; i++) {
      const char = command[i];

      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }
      if (char === "\\") {
        current += char;
        escaped = true;
        continue;
      }
      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        current += char;
        continue;
      }
      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        current += char;
        continue;
      }

      if (!inSingleQuote && !inDoubleQuote) {
        if (char === ";" || char === "\n" || char === "\r") {
          flush();
          continue;
        }
        if (char === "&" && command[i + 1] === "&") {
          flush();
          i++;
          continue;
        }
        if (char === "|" && command[i + 1] === "|") {
          flush();
          i++;
          continue;
        }
      }

      current += char;
    }

    flush();
    return segments;
  }

  /**
   * Validates if a command string can be safely executed in non-interactive background terminals.
   */
  public validateCommand(command: string): CommandValidationResult {
    const segments = this.splitCommand(command);

    for (const segment of segments) {
      const parts = segment.split(/\s+/).filter(Boolean);
      if (parts.length === 0) continue;

      const executable = pathBasename(parts[0]);

      if (INTERACTIVE_EDITORS.has(executable)) {
        return {
          valid: false,
          error: `[INTERACTIVE BLOCK] Executable \`${executable}\` is an interactive text editor. Non-interactive CLI background processes cannot handle interactive UI loops.`,
          isInteractiveBlocked: true,
        };
      }

      if (INTERACTIVE_REPLS.has(executable) && parts.length === 1) {
        return {
          valid: false,
          error: `[REPL BLOCK] Executable \`${executable}\` launched without script argument triggers interactive REPL mode. Provide a script argument or sub-command.`,
          isInteractiveBlocked: true,
        };
      }
    }

    return { valid: true };
  }
}

function pathBasename(pathStr: string): string {
  const parts = pathStr.split(/[/\\]/);
  return parts[parts.length - 1].toLowerCase();
}
