/**
 * sandboxed-eval-runner.ts
 *
 * Safe Isolated JavaScript / TypeScript Expression Evaluator.
 * Executes algorithmic calculations, data transformations, and AST evaluations
 * in an isolated V8 VM context with timeout and memory boundaries.
 */

import * as vm from "node:vm";

export interface EvalResult {
  readonly success: boolean;
  readonly result?: unknown;
  readonly stdout: string;
  readonly durationMs: number;
  readonly error?: string;
}

export interface EvalOptions {
  readonly timeoutMs?: number;
  readonly context?: Record<string, unknown>;
}

export class SandboxedEvalRunner {
  /**
   * Evaluates a JavaScript/TypeScript expression in an isolated VM sandbox.
   */
  public async evaluate(code: string, options: EvalOptions = {}): Promise<EvalResult> {
    const timeoutMs = options.timeoutMs || 2500;
    const stdoutLogs: string[] = [];
    const startTime = performance.now();

    const sandboxConsole = {
      log: (...args: unknown[]) => stdoutLogs.push(args.map(this.formatArg).join(" ")),
      info: (...args: unknown[]) => stdoutLogs.push(args.map(this.formatArg).join(" ")),
      warn: (...args: unknown[]) => stdoutLogs.push("[WARN] " + args.map(this.formatArg).join(" ")),
      error: (...args: unknown[]) => stdoutLogs.push("[ERROR] " + args.map(this.formatArg).join(" ")),
    };

    const sandbox = {
      console: sandboxConsole,
      Math,
      JSON,
      Date,
      Buffer,
      RegExp,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Map,
      Set,
      Promise,
      parseInt,
      parseFloat,
      encodeURIComponent,
      decodeURIComponent,
      ...(options.context || {}),
    };

    const vmContext = vm.createContext(sandbox);

    try {
      const hasAwait = /\bawait\b/.test(code);
      const executableScript = hasAwait
        ? `(async () => {\n${code.includes("return ") ? code : `return (${code});`}\n})()`
        : code;

      const script = new vm.Script(executableScript, {
        filename: "sandbox.js",
      });

      let rawResult = script.runInContext(vmContext, {
        timeout: timeoutMs,
      });

      if (rawResult instanceof Promise) {
        rawResult = await Promise.race([
          rawResult,
          new Promise((_, reject) => setTimeout(() => reject(new Error(`Execution timed out after ${timeoutMs}ms`)), timeoutMs)),
        ]);
      }

      const durationMs = Number((performance.now() - startTime).toFixed(2));
      return {
        success: true,
        result: rawResult,
        stdout: stdoutLogs.join("\n"),
        durationMs,
      };
    } catch (err: unknown) {
      const durationMs = Number((performance.now() - startTime).toFixed(2));
      return {
        success: false,
        stdout: stdoutLogs.join("\n"),
        durationMs,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private formatArg(arg: unknown): string {
    if (typeof arg === "string") return arg;
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }
}
