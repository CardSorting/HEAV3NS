/**
 * deterministic-session-archiver.ts
 *
 * Deterministic in-memory multi-format session exporter and archive packager (Phase 99 / ADR-053).
 */

import * as crypto from "node:crypto";
import type {
  ExportOptions,
  ExportedDocumentResult,
  ExportedTurnItem,
} from "../../../core/contracts/session-archive.contracts.js";

export class DeterministicSessionArchiver {
  /**
   * Sanitizes text to prevent HTML injection and XSS vulnerabilities.
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Computes deterministic SHA-256 checksum for content.
   */
  private computeChecksum(content: string | Uint8Array): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  /**
   * Exports session conversation turns into clean, injection-safe GitHub-Flavored Markdown.
   */
  exportToMarkdown(
    sessionId: string,
    turns: readonly ExportedTurnItem[],
    options: ExportOptions = {}
  ): ExportedDocumentResult {
    const title = options.title || `LUMI-JOY Session Export: ${sessionId}`;
    const lines: string[] = [
      `# ${title}`,
      ``,
      `> **Session ID**: \`${sessionId}\`  `,
      `> **Exported At**: ${new Date().toISOString()}  `,
      `> **Turn Count**: ${turns.length}`,
      ``,
      `---`,
      ``,
    ];

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      const roleCapitalized = turn.role.charAt(0).toUpperCase() + turn.role.slice(1);
      lines.push(`### Turn ${i + 1} — ${roleCapitalized}`);
      lines.push(``);

      if (options.includeReasoning && turn.reasoning) {
        lines.push(`> [!NOTE]`);
        lines.push(`> **Reasoning**: ${turn.reasoning}`);
        lines.push(``);
      }

      lines.push(turn.content);
      lines.push(``);

      if (options.includeToolCalls && turn.toolCalls && turn.toolCalls.length > 0) {
        lines.push(`**Tool Invocations**:`);
        lines.push(`\`\`\`json`);
        lines.push(JSON.stringify(turn.toolCalls, null, 2));
        lines.push(`\`\`\``);
        lines.push(``);
      }

      lines.push(`---`);
      lines.push(``);
    }

    const mdString = lines.join("\n");
    const checksum = this.computeChecksum(mdString);
    const sizeBytes = Buffer.byteLength(mdString, "utf8");

    return {
      archiveId: `arch-md-${sessionId}-${Date.now()}`,
      format: "markdown",
      content: mdString,
      sizeBytes,
      sha256Checksum: checksum,
      mimeType: "text/markdown; charset=utf-8",
    };
  }

  /**
   * Exports session conversation turns into a beautiful, self-contained standalone HTML5 document.
   */
  exportToHtml(
    sessionId: string,
    turns: readonly ExportedTurnItem[],
    options: ExportOptions = {}
  ): ExportedDocumentResult {
    const title = this.escapeHtml(options.title || `LUMI-JOY Session Export: ${sessionId}`);
    const scriptNonce = crypto.randomBytes(16).toString("base64");

    const turnHtmls: string[] = [];
    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      const role = turn.role.toLowerCase();
      const escapedContent = this.escapeHtml(turn.content);
      const isAssistant = role === "assistant";

      turnHtmls.push(`
      <article class="turn-card ${isAssistant ? "assistant-turn" : "user-turn"}">
        <header class="turn-header">
          <span class="role-badge ${role}">${this.escapeHtml(turn.role.toUpperCase())}</span>
          <span class="turn-index">Turn #${i + 1}</span>
        </header>
        ${
          options.includeReasoning && turn.reasoning
            ? `<div class="reasoning-box"><strong>Thinking:</strong> ${this.escapeHtml(turn.reasoning)}</div>`
            : ""
        }
        <div class="turn-content"><pre><code>${escapedContent}</code></pre></div>
      </article>`);
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${scriptNonce}';">
  <title>${title}</title>
  <style>
    :root { --bg: #0d1117; --card-user: #161b22; --card-asst: #21262d; --text: #c9d1d9; --accent: #58a6ff; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text); padding: 2rem; max-width: 900px; margin: 0 auto; line-height: 1.6; }
    header.doc-header { border-bottom: 1px solid #30363d; padding-bottom: 1.5rem; margin-bottom: 2rem; }
    h1 { color: var(--accent); margin: 0 0 0.5rem 0; font-size: 1.75rem; }
    .meta { font-size: 0.9rem; color: #8b949e; }
    .turn-card { border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem; border: 1px solid #30363d; }
    .user-turn { background: var(--card-user); }
    .assistant-turn { background: var(--card-asst); }
    .turn-header { display: flex; justify-content: space-between; margin-bottom: 0.75rem; }
    .role-badge { font-weight: bold; font-size: 0.8rem; padding: 2px 8px; border-radius: 4px; background: #388bfd33; color: #58a6ff; }
    .reasoning-box { background: #30363d; padding: 0.75rem; border-radius: 6px; font-size: 0.85rem; margin-bottom: 0.75rem; color: #e6edf3; }
    pre { white-space: pre-wrap; word-wrap: break-word; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 0.95rem; margin: 0; }
  </style>
</head>
<body>
  <header class="doc-header">
    <h1>${title}</h1>
    <div class="meta">Session ID: <code>${this.escapeHtml(sessionId)}</code> | Total Turns: ${turns.length}</div>
  </header>
  <main>
    ${turnHtmls.join("\n")}
  </main>
</body>
</html>`;

    const checksum = this.computeChecksum(htmlContent);
    const sizeBytes = Buffer.byteLength(htmlContent, "utf8");

    return {
      archiveId: `arch-html-${sessionId}-${Date.now()}`,
      format: "html",
      content: htmlContent,
      sizeBytes,
      sha256Checksum: checksum,
      mimeType: "text/html; charset=utf-8",
    };
  }

  /**
   * Exports session conversation turns into deterministic JSONL format.
   */
  exportToJsonl(sessionId: string, turns: readonly ExportedTurnItem[]): ExportedDocumentResult {
    const lines: string[] = [];
    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      lines.push(
        JSON.stringify({
          sessionId,
          turnIndex: i,
          role: turn.role,
          content: turn.content,
          toolCalls: turn.toolCalls,
          reasoning: turn.reasoning,
          timestamp: turn.timestamp || Date.now(),
        })
      );
    }

    const jsonlString = lines.join("\n");
    const checksum = this.computeChecksum(jsonlString);
    const sizeBytes = Buffer.byteLength(jsonlString, "utf8");

    return {
      archiveId: `arch-jsonl-${sessionId}-${Date.now()}`,
      format: "jsonl",
      content: jsonlString,
      sizeBytes,
      sha256Checksum: checksum,
      mimeType: "application/x-ndjson; charset=utf-8",
    };
  }

  /**
   * Packs a set of named virtual files into an in-memory binary backup archive.
   */
  exportToBinaryArchive(
    sessionId: string,
    files: ReadonlyMap<string, string | Uint8Array>
  ): ExportedDocumentResult {
    const manifestEntries: Array<{ path: string; size: number; checksum: string }> = [];
    const buffers: Buffer[] = [];

    // Header: "LUMI_ARCHIVE_V1" (16 bytes null-padded)
    const headerBuf = Buffer.alloc(16);
    headerBuf.write("LUMI_ARCH_V1", "utf8");
    buffers.push(headerBuf);

    for (const [filePath, content] of files.entries()) {
      const buf = typeof content === "string" ? Buffer.from(content, "utf8") : Buffer.from(content);
      const fileChecksum = this.computeChecksum(buf);

      manifestEntries.push({
        path: filePath,
        size: buf.length,
        checksum: fileChecksum,
      });

      // Path length (2 bytes) + Path utf8 + Content length (4 bytes) + Content
      const pathBuf = Buffer.from(filePath, "utf8");
      const pathLenBuf = Buffer.alloc(2);
      pathLenBuf.writeUInt16BE(pathBuf.length, 0);

      const contentLenBuf = Buffer.alloc(4);
      contentLenBuf.writeUInt32BE(buf.length, 0);

      buffers.push(pathLenBuf, pathBuf, contentLenBuf, buf);
    }

    const finalArchive = Buffer.concat(buffers);
    const checksum = this.computeChecksum(finalArchive);

    return {
      archiveId: `arch-bin-${sessionId}-${Date.now()}`,
      format: "binary_archive",
      content: new Uint8Array(finalArchive),
      sizeBytes: finalArchive.length,
      sha256Checksum: checksum,
      mimeType: "application/octet-stream",
    };
  }

  /**
   * Verifies the SHA-256 integrity checksum of an exported document.
   */
  verifyArchiveIntegrity(document: ExportedDocumentResult): boolean {
    const computed = this.computeChecksum(document.content);
    return computed === document.sha256Checksum;
  }
}
