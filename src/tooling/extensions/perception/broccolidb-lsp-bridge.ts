/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 130: Zero-Dependency Broccoli LSP Protocol Bridge
 *
 * Lifted from /Users/bozoegg/Downloads/codemarie-new/broccolidb (core/agent-context/LspService.ts).
 * Formats JSON-RPC LSP protocol requests (initialize, textDocument/definition, textDocument/hover),
 * manages language server executable maps, and indexes diagnostic notifications. Zero external npm dependencies.
 */

import { type ChildProcess } from "node:child_process";
import * as path from "node:path";

export interface LspLocation {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface LspDiagnostic {
  uri: string;
  message: string;
  severity: "error" | "warning" | "info" | "hint";
  line: number;
  character: number;
}

export class BroccoliLspProtocolBridge {
  private readonly workspaceRoot: string;
  private readonly activeServers = new Map<string, ChildProcess>();
  private readonly diagnosticsMap = new Map<string, LspDiagnostic[]>();
  private requestId = 0;

  private readonly SERVER_REGISTRY: Record<string, { command: string; args: string[] }> = {
    typescript: { command: "typescript-language-server", args: ["--stdio"] },
    javascript: { command: "typescript-language-server", args: ["--stdio"] },
    python: { command: "pyright-langserver", args: ["--stdio"] },
    go: { command: "gopls", args: [] },
  };

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Formats a standard JSON-RPC 2.0 protocol message payload string.
   */
  public static formatJsonRpc(method: string, params: unknown, id?: number): string {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });
    return `Content-Length: ${Buffer.byteLength(payload, "utf-8")}\r\n\r\n${payload}`;
  }

  /**
   * Identifies language server registry configuration for a file extension.
   */
  public getServerConfigForFile(filePath: string): { languageId: string; command: string; args: string[] } | undefined {
    const ext = path.extname(filePath).toLowerCase();
    let languageId = "typescript";

    if (ext === ".py") languageId = "python";
    else if (ext === ".go") languageId = "go";
    else if (ext === ".js" || ext === ".jsx") languageId = "javascript";
    else if (ext === ".ts" || ext === ".tsx") languageId = "typescript";
    else return undefined;

    const conf = this.SERVER_REGISTRY[languageId];
    if (!conf) return undefined;

    return { languageId, ...conf };
  }

  /**
   * Records a diagnostic item into the diagnostics map.
   */
  public recordDiagnostic(uri: string, diagnostic: LspDiagnostic): void {
    const list = this.diagnosticsMap.get(uri) ?? [];
    list.push(diagnostic);
    this.diagnosticsMap.set(uri, list);
  }

  /**
   * Returns current diagnostics for a file URI.
   */
  public getDiagnostics(uri: string): LspDiagnostic[] {
    return this.diagnosticsMap.get(uri) ?? [];
  }

  /**
   * Stops all running child language servers.
   */
  public shutdown(): void {
    for (const proc of this.activeServers.values()) {
      try {
        proc.kill();
      } catch {
        // Safe termination
      }
    }
    this.activeServers.clear();
    this.diagnosticsMap.clear();
  }
}
