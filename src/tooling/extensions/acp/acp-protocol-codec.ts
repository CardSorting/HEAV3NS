import type {
  AcpRpcNotification,
  AcpRpcRequest,
  IAcpProtocolCodec,
} from "../../../core/contracts/acp.contracts.js";

/**
 * Strict JSON-RPC 2.0 & LSP Content-Length Stream Protocol Codec for ACP.
 */
export class AcpProtocolCodec implements IAcpProtocolCodec {
  encodeResponse(id: string | number, result: unknown): string {
    return JSON.stringify({
      jsonrpc: "2.0",
      id,
      result,
    });
  }

  encodeError(id: string | number, code: number, message: string, data?: unknown): string {
    return JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        ...(data !== undefined ? { data } : {}),
      },
    });
  }

  encodeNotification(method: string, params?: Record<string, unknown>): string {
    return JSON.stringify({
      jsonrpc: "2.0",
      method,
      ...(params !== undefined ? { params } : {}),
    });
  }

  encodeLspMessage(jsonPayload: string): string {
    const bytes = Buffer.byteLength(jsonPayload, "utf8");
    return `Content-Length: ${bytes}\r\n\r\n${jsonPayload}`;
  }

  parseMessage(rawJson: string): AcpRpcRequest | AcpRpcNotification {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      throw new Error("Parse error: Invalid JSON payload (-32700)");
    }

    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Invalid Request: Payload must be an object (-32600)");
    }

    const obj = parsed as Record<string, unknown>;
    if (obj.jsonrpc !== "2.0") {
      throw new Error("Invalid Request: Missing or invalid 'jsonrpc' version field (-32600)");
    }

    if (typeof obj.method !== "string" || !obj.method.trim()) {
      throw new Error("Invalid Request: Missing or invalid 'method' field (-32600)");
    }

    const params = typeof obj.params === "object" && obj.params !== null
      ? (obj.params as Record<string, unknown>)
      : undefined;

    if (obj.id !== undefined && (typeof obj.id === "string" || typeof obj.id === "number")) {
      return {
        jsonrpc: "2.0",
        id: obj.id,
        method: obj.method,
        params,
      };
    }

    return {
      jsonrpc: "2.0",
      method: obj.method,
      params,
    };
  }

  parseStreamBuffer(buffer: string): { messages: readonly (AcpRpcRequest | AcpRpcNotification)[]; remainder: string } {
    const messages: (AcpRpcRequest | AcpRpcNotification)[] = [];
    let current = buffer;

    while (current.length > 0) {
      // Case 1: Header-framed (LSP style)
      if (current.startsWith("Content-Length:")) {
        const headerEnd = current.indexOf("\r\n\r\n");
        if (headerEnd === -1) {
          // Incomplete header
          break;
        }

        const headerLine = current.slice(0, headerEnd);
        const match = headerLine.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          // Corrupted header, skip past headerEnd
          current = current.slice(headerEnd + 4);
          continue;
        }

        const contentLength = parseInt(match[1], 10);
        const bodyStart = headerEnd + 4;
        if (current.length < bodyStart + contentLength) {
          // Incomplete message body
          break;
        }

        const body = current.slice(bodyStart, bodyStart + contentLength);
        try {
          messages.push(this.parseMessage(body));
        } catch {
          // Skip invalid frame
        }

        current = current.slice(bodyStart + contentLength);
      } else {
        // Case 2: Newline-delimited JSON (NDJSON)
        const lineEnd = current.indexOf("\n");
        if (lineEnd === -1) {
          // Might be a single raw JSON object without trailing newline
          const trimmed = current.trim();
          if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            try {
              messages.push(this.parseMessage(trimmed));
              current = "";
            } catch {
              // Wait for more data
            }
          }
          break;
        }

        const line = current.slice(0, lineEnd).trim();
        current = current.slice(lineEnd + 1);

        if (line.length > 0) {
          try {
            messages.push(this.parseMessage(line));
          } catch {
            // Ignore blank or non-json lines
          }
        }
      }
    }

    return { messages, remainder: current };
  }
}
