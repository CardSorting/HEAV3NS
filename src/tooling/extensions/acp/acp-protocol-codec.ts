import type {
  AcpRpcNotification,
  AcpRpcRequest,
  IAcpProtocolCodec,
} from "../../../core/contracts/acp.contracts.js";

/**
 * Strict JSON-RPC 2.0 Protocol Codec for ACP.
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
}
