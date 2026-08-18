/**
 * deterministic-heredoc-sanitizer.ts
 *
 * Conservative shell heredoc sanitizer, delimiter parser, nested scope guard,
 * equal-line newline substituter, and canonical multi-line script heredoc generator.
 *
 * Adapted and elevated from Wolfram Ravenwolf's security-hardened parser
 * (Phase 110 / ADR-086 / Target #43).
 */

import {
  INERT_HEREDOC_CONSUMER_PATTERN,
  DANGEROUS_SHELL_PATTERNS,
  type HeredocInterpreterType,
  type HeredocOperatorSpec,
  type HeredocBodySpan,
  type HeredocSanitizationResult,
  type CommandSafetyClassification,
  type ScriptHeredocOptions,
  type ScriptHeredocResult,
} from "../../../core/contracts/heredoc-terminal.contracts.js";

export class DeterministicHeredocSanitizer {
  /**
   * Blank inert quoted spans without erasing shell-active substitutions.
   */
  public maskSimpleQuotes(command: string): string {
    const result: string[] = [];
    let cursor = 0;

    while (cursor < command.length) {
      const char = command[cursor];

      if (char === "'") {
        const closing = command.indexOf("'", cursor + 1);
        if (closing === -1) {
          result.push(command.slice(cursor));
          break;
        }
        result.push("''");
        cursor = closing + 1;
        continue;
      }

      if (char === '"') {
        let end = cursor + 1;
        while (end < command.length) {
          if (command[end] === "\\" && end + 1 < command.length) {
            end += 2;
            continue;
          }
          if (command[end] === '"') {
            end += 1;
            break;
          }
          end += 1;
        }
        if (!command.slice(cursor, end).endsWith('"')) {
          result.push(command.slice(cursor));
          break;
        }
        const segment = command.slice(cursor, end);
        result.push(segment.includes("$(") || segment.includes("`") ? segment : '""');
        cursor = end;
        continue;
      }

      if (char === "`") {
        let end = cursor + 1;
        while (end < command.length) {
          if (command[end] === "\\" && end + 1 < command.length) {
            end += 2;
            continue;
          }
          if (command[end] === "`") {
            end += 1;
            break;
          }
          end += 1;
        }
        result.push(command.slice(cursor, end));
        cursor = end;
        continue;
      }

      result.push(char);
      cursor += 1;
    }

    return result.join("");
  }

  /**
   * Check if a quote-masked opener contains nested executable syntax.
   */
  public containsNestedShellScope(maskedOpener: string): boolean {
    return (
      maskedOpener.includes("$(") ||
      maskedOpener.includes("`") ||
      maskedOpener.includes("<(") ||
      maskedOpener.includes(">(")
    );
  }

  /**
   * Parse one active '<<' redirection and return delimiter metadata.
   */
  public parseHeredocOperator(
    command: string,
    index: number
  ): HeredocOperatorSpec | null {
    if (!command.startsWith("<<", index) || command.startsWith("<<<", index)) {
      return null;
    }

    let cursor = index + 2;
    let stripTabs = false;

    if (cursor < command.length && command[cursor] === "-") {
      stripTabs = true;
      cursor += 1;
    }

    while (cursor < command.length && (command[cursor] === " " || command[cursor] === "\t")) {
      cursor += 1;
    }

    if (cursor >= command.length || command[cursor] === "\r" || command[cursor] === "\n") {
      return null;
    }

    const delimiterChars: string[] = [];
    let isQuoted = false;

    while (cursor < command.length) {
      const char = command[cursor];

      if (/\s/.test(char) || ";|&<>()".includes(char)) {
        break;
      }

      if (char === "\\") {
        if (cursor + 1 >= command.length || command[cursor + 1] === "\r" || command[cursor + 1] === "\n") {
          return null;
        }
        isQuoted = true;
        delimiterChars.push(command[cursor + 1]);
        cursor += 2;
        continue;
      }

      if (char === "'" || char === '"') {
        isQuoted = true;
        const quoteChar = char;
        cursor += 1;

        while (cursor < command.length && command[cursor] !== quoteChar) {
          if (quoteChar === '"' && command[cursor] === "\\") {
            if (cursor + 1 >= command.length) {
              return null;
            }
            const nextChar = command[cursor + 1];
            if ("$`\"\\\n".includes(nextChar)) {
              delimiterChars.push(nextChar);
              cursor += 2;
              continue;
            }
            delimiterChars.push("\\");
            cursor += 1;
            continue;
          }
          if (command[cursor] === "\r" || command[cursor] === "\n") {
            return null;
          }
          delimiterChars.push(command[cursor]);
          cursor += 1;
        }

        if (cursor >= command.length) {
          return null;
        }
        cursor += 1;
        continue;
      }

      delimiterChars.push(char);
      cursor += 1;
    }

    if (delimiterChars.length === 0 && !isQuoted) {
      return null;
    }

    return {
      delimiter: delimiterChars.join(""),
      stripTabs,
      isQuoted,
      openerEndOffset: cursor,
    };
  }

  /**
   * Scan one logical shell command unit.
   */
  public scanHeredocCommandUnit(command: string, start: number) {
    let cursor = start;
    let currentQuote: string | null = null;
    let isComment = false;
    const specs: HeredocOperatorSpec[] = [];
    let unknownOperator = false;
    let hasListOperator = false;

    while (cursor < command.length) {
      const char = command[cursor];

      if (isComment) {
        if (char === "\n") {
          return {
            endIndex: cursor,
            specs,
            unknownOperator,
            hasListOperator,
          };
        }
        cursor += 1;
        continue;
      }

      if (currentQuote !== null) {
        if ((currentQuote === '"' || currentQuote === "`") && char === "\\" && cursor + 1 < command.length) {
          cursor += 2;
          continue;
        }
        if (char === currentQuote) {
          currentQuote = null;
        }
        cursor += 1;
        continue;
      }

      if (char === "\\" && cursor + 1 < command.length) {
        cursor += 2;
        continue;
      }

      if (char === "'" || char === '"' || char === "`") {
        currentQuote = char;
        cursor += 1;
        continue;
      }

      if (char === "#") {
        const previous = cursor > start ? command[cursor - 1] : "";
        if (cursor === start || /\s/.test(previous) || ";|()".includes(previous)) {
          isComment = true;
          cursor += 1;
          continue;
        }
      }

      if (char === "\n") {
        return {
          endIndex: cursor,
          specs,
          unknownOperator,
          hasListOperator,
        };
      }

      if (command.startsWith("<<<", cursor)) {
        cursor += 3;
        continue;
      }

      if (command.startsWith("<<", cursor)) {
        const parsed = this.parseHeredocOperator(command, cursor);
        if (!parsed) {
          unknownOperator = true;
          cursor += 2;
          continue;
        }
        specs.push(parsed);
        cursor = parsed.openerEndOffset;
        continue;
      }

      if (";|&".includes(char)) {
        hasListOperator = true;
      }

      cursor += 1;
    }

    return {
      endIndex: command.length,
      specs,
      unknownOperator,
      hasListOperator,
    };
  }

  /**
   * Find the offset after an exact shell heredoc terminator line.
   */
  public findHeredocClose(
    command: string,
    bodyStart: number,
    delimiter: string,
    stripTabs: boolean
  ): { bodyEnd: number; closeEnd: number } | null {
    let cursor = bodyStart;

    while (true) {
      const newlineIndex = command.indexOf("\n", cursor);
      let line: string;
      let afterNewline: number;

      if (newlineIndex === -1) {
        line = command.slice(cursor);
        afterNewline = command.length;
      } else {
        line = command.slice(cursor, newlineIndex);
        afterNewline = newlineIndex + 1;
      }

      if (line.endsWith("\r")) {
        line = line.slice(0, -1);
      }

      const candidate = stripTabs ? line.replace(/^\t+/, "") : line;
      if (candidate === delimiter) {
        return { bodyEnd: cursor, closeEnd: afterNewline };
      }

      if (newlineIndex === -1) {
        return null;
      }

      cursor = afterNewline;
    }
  }

  /**
   * Detect interpreter from command opener text.
   */
  public detectInterpreter(commandOpener: string): HeredocInterpreterType {
    const trimmed = commandOpener.trim();
    if (/\bpython(?:3(?:\.\d+)*)?\b/i.test(trimmed)) return "python";
    if (/\bnode\b/i.test(trimmed)) return "node";
    if (/\bosascript\b/i.test(trimmed)) return "osascript";
    if (/\bcat\b/i.test(trimmed)) return "cat";
    if (/\bbash\b/i.test(trimmed)) return "bash";
    if (/\bsh\b/i.test(trimmed)) return "sh";
    if (/\bruby\b/i.test(trimmed)) return "ruby";
    if (/\bperl\b/i.test(trimmed)) return "perl";
    return "unknown";
  }

  /**
   * Mask inert heredoc bodies while leaving real command syntax visible.
   * Preserves exact line numbers by replacing masked bodies with equal-count newlines.
   */
  public stripInertHeredocBodies(command: string): HeredocSanitizationResult {
    const startTime = performance.now();

    // Fast-path: no '<<' anywhere means no heredoc can exist
    if (!command.includes("<<")) {
      return {
        originalCommand: command,
        sanitizedCommand: command,
        hasHeredocs: false,
        maskedBodiesCount: 0,
        preservedLineCount: command.split("\n").length,
        hadAmbiguity: false,
        hadListOperator: false,
        hadNestedScope: false,
        inertSpans: [],
        latencyMs: performance.now() - startTime,
      };
    }

    const ranges: { start: number; end: number; span: HeredocBodySpan }[] = [];
    let commandStart = 0;
    let hadAmbiguity = false;
    let hadListOperatorGlobal = false;
    let hadNestedScopeGlobal = false;

    const lastOpener = command.lastIndexOf("<<");

    while (commandStart <= lastOpener && commandStart < command.length) {
      const {
        endIndex: openerEnd,
        specs,
        unknownOperator,
        hasListOperator,
      } = this.scanHeredocCommandUnit(command, commandStart);

      if (!specs.length) {
        commandStart = openerEnd < command.length && command[openerEnd] === "\n" ? openerEnd + 1 : openerEnd;
        continue;
      }

      if (unknownOperator) {
        hadAmbiguity = true;
        break;
      }

      if (hasListOperator) {
        hadListOperatorGlobal = true;
        break;
      }

      const rawOpener = command.slice(commandStart, openerEnd);
      const maskedOpener = this.maskSimpleQuotes(rawOpener);

      if (!INERT_HEREDOC_CONSUMER_PATTERN.test(maskedOpener)) {
        hadAmbiguity = true;
        break;
      }

      if (this.containsNestedShellScope(maskedOpener)) {
        hadNestedScopeGlobal = true;
        break;
      }

      if (specs.some((s) => !s.isQuoted)) {
        hadAmbiguity = true;
        break;
      }

      if (openerEnd >= command.length || command[openerEnd] !== "\n") {
        hadAmbiguity = true;
        break;
      }

      let bodyCursor = openerEnd + 1;
      let allClosed = true;
      const unitRanges: { start: number; end: number; span: HeredocBodySpan }[] = [];
      const interpreter = this.detectInterpreter(rawOpener);

      for (const spec of specs) {
        const closeInfo = this.findHeredocClose(command, bodyCursor, spec.delimiter, spec.stripTabs);
        if (closeInfo === null) {
          allClosed = false;
          hadAmbiguity = true;
          break;
        }

        const bodyContent = command.slice(bodyCursor, closeInfo.bodyEnd);
        const newlineCount = (bodyContent.match(/\n/g) || []).length;
        const maskedBodyText = "\n".repeat(newlineCount);

        unitRanges.push({
          start: bodyCursor,
          end: closeInfo.bodyEnd,
          span: {
            startOffset: bodyCursor,
            endOffset: closeInfo.bodyEnd,
            delimiter: spec.delimiter,
            stripTabs: spec.stripTabs,
            isQuoted: spec.isQuoted,
            interpreter,
            originalBodyText: bodyContent,
            maskedBodyText,
          },
        });
        bodyCursor = closeInfo.closeEnd;
      }

      if (!allClosed) {
        break;
      }

      ranges.push(...unitRanges);
      commandStart = bodyCursor;
    }

    // Fail closed if ambiguity or unparseable state was detected
    if (hadAmbiguity || hadListOperatorGlobal || hadNestedScopeGlobal) {
      return {
        originalCommand: command,
        sanitizedCommand: command,
        hasHeredocs: true,
        maskedBodiesCount: 0,
        preservedLineCount: command.split("\n").length,
        hadAmbiguity,
        hadListOperator: hadListOperatorGlobal,
        hadNestedScope: hadNestedScopeGlobal,
        inertSpans: [],
        latencyMs: performance.now() - startTime,
      };
    }

    if (!ranges.length) {
      return {
        originalCommand: command,
        sanitizedCommand: command,
        hasHeredocs: true,
        maskedBodiesCount: 0,
        preservedLineCount: command.split("\n").length,
        hadAmbiguity: false,
        hadListOperator: false,
        hadNestedScope: false,
        inertSpans: [],
        latencyMs: performance.now() - startTime,
      };
    }

    // Replace each body with equivalent newlines
    const resultParts: string[] = [];
    let currentIdx = 0;
    const inertSpans: HeredocBodySpan[] = [];

    for (const r of ranges) {
      resultParts.push(command.slice(currentIdx, r.start));
      resultParts.push(r.span.maskedBodyText);
      inertSpans.push(r.span);
      currentIdx = r.end;
    }
    resultParts.push(command.slice(currentIdx));

    const sanitizedCommand = resultParts.join("");

    return {
      originalCommand: command,
      sanitizedCommand,
      hasHeredocs: true,
      maskedBodiesCount: ranges.length,
      preservedLineCount: sanitizedCommand.split("\n").length,
      hadAmbiguity: false,
      hadListOperator: false,
      hadNestedScope: false,
      inertSpans,
      latencyMs: performance.now() - startTime,
    };
  }

  /**
   * Classify command safety and detect risky shell patterns.
   */
  public classifyCommandSafety(command: string): CommandSafetyClassification {
    const matchedPatterns: string[] = [];

    // Check dangerous patterns
    for (const pat of DANGEROUS_SHELL_PATTERNS) {
      if (pat.test(command)) {
        matchedPatterns.push(pat.source);
      }
    }

    if (matchedPatterns.length > 0) {
      return {
        command,
        isSafe: false,
        riskLevel: "blocked",
        hasBackgroundOperator: /&(?![&>])/.test(command),
        isCompound: /[;&|]/.test(command),
        interpreter: this.detectInterpreter(command),
        matchedDangerousPatterns: matchedPatterns,
        reason: `Command matches critical blocked patterns: ${matchedPatterns.join(", ")}`,
      };
    }

    // Mask inert heredocs before checking background operators
    const sanitization = this.stripInertHeredocBodies(command);
    const effectiveCommand = sanitization.sanitizedCommand;

    const hasBackgroundOperator = /&(?![&>])/.test(effectiveCommand);
    const isCompound = /[;&|]/.test(effectiveCommand);
    const interpreter = this.detectInterpreter(command);

    if (hasBackgroundOperator) {
      return {
        command,
        isSafe: false,
        riskLevel: "high",
        hasBackgroundOperator: true,
        isCompound,
        interpreter,
        matchedDangerousPatterns: [],
        reason: "Active foreground-background '&' operator detected outside inert heredoc body",
        suggestedSanitization: sanitization.sanitizedCommand,
      };
    }

    if (isCompound) {
      return {
        command,
        isSafe: true,
        riskLevel: "low",
        hasBackgroundOperator: false,
        isCompound: true,
        interpreter,
        matchedDangerousPatterns: [],
        reason: "Compound shell command sequence",
      };
    }

    return {
      command,
      isSafe: true,
      riskLevel: "clean",
      hasBackgroundOperator: false,
      isCompound: false,
      interpreter,
      matchedDangerousPatterns: [],
      reason: "Clean single-unit command",
    };
  }

  /**
   * Synthesize canonical quoted heredoc wrapper command for multi-line scripts.
   */
  public synthesizeScriptHeredoc(
    scriptContent: string,
    options: ScriptHeredocOptions = {}
  ): ScriptHeredocResult {
    const interpreter = options.interpreter || "python";
    const delimiter = options.delimiter || "EOF";
    const stripTabs = options.stripTabs ?? false;

    let launcher = options.customInterpreterCommand;
    if (!launcher) {
      switch (interpreter) {
        case "python":
          launcher = "python3 -";
          break;
        case "node":
          launcher = "node -";
          break;
        case "osascript":
          launcher = "osascript -";
          break;
        case "bash":
          launcher = "bash";
          break;
        case "sh":
          launcher = "sh";
          break;
        case "ruby":
          launcher = "ruby -";
          break;
        default:
          launcher = "cat -";
          break;
      }
    }

    const envPrefix = options.environmentVars
      ? Object.entries(options.environmentVars)
          .map(([k, v]) => `${k}=${JSON.stringify(v)} `)
          .join("")
      : "";

    const extraArgsStr = options.extraArgs && options.extraArgs.length > 0 ? " " + options.extraArgs.join(" ") : "";

    const operator = stripTabs ? "<<-" : "<<";
    const quotedDelim = `'${delimiter}'`;

    const cleanScript = scriptContent.replace(/\r\n/g, "\n");
    const scriptLines = cleanScript.endsWith("\n") ? cleanScript : cleanScript + "\n";

    const synthesizedCommandLine = `${envPrefix}${launcher}${extraArgsStr} ${operator}${quotedDelim}\n${scriptLines}${delimiter}`;

    return {
      scriptText: scriptContent,
      interpreter,
      delimiter,
      synthesizedCommandLine,
      totalLines: synthesizedCommandLine.split("\n").length,
    };
  }

  /**
   * Formats a sanitization result into a clean one-line status summary.
   */
  public formatSanitizationResult(result: HeredocSanitizationResult): string {
    const heredocInfo = result.hasHeredocs
      ? `${result.maskedBodiesCount} heredoc(s) masked (${result.preservedLineCount} lines preserved)`
      : "No heredocs";
    const amb = result.hadAmbiguity ? " [AMBIGUOUS]" : "";
    return `[HEREDOC-SANITIZATION] ${heredocInfo} in ${result.latencyMs.toFixed(3)}ms${amb}`;
  }

  /**
   * Formats a safety classification into a concise status tag.
   */
  public formatSafetyClassification(classification: CommandSafetyClassification): string {
    const verdict = classification.isSafe ? "SAFE" : "DANGEROUS";
    const patternInfo =
      classification.matchedDangerousPatterns.length > 0
        ? ` [Matched: ${classification.matchedDangerousPatterns.join(", ")}]`
        : "";
    return `[COMMAND-SAFETY:${verdict}] Risk: ${classification.riskLevel.toUpperCase()}${patternInfo} - ${classification.reason}`;
  }

  /**
   * Evaluates if a command opener matches known safe inert consumers.
   */
  public isInertHeredocConsumer(commandOpener: string): boolean {
    const masked = this.maskSimpleQuotes(commandOpener);
    return INERT_HEREDOC_CONSUMER_PATTERN.test(masked) && !this.containsNestedShellScope(masked);
  }
}
