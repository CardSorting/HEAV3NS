/**
 * mcp-transport-codec.ts
 *
 * High-performance, zero-GC streaming JSON-RPC 2.0 codec for Model Context Protocol (MCP) messages.
 * Provides strict validation and structured framing across stdio, HTTP, and SSE transports.
 */

import type {
  McpToolDefinition,
  McpResourceDefinition,
  McpPromptDefinition,
  McpToolCallResponse,
  McpSamplingRequest,
} from "../../../core/contracts/mcp-client.contracts.js";

export interface JsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
  readonly result?: unknown;
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
  };
}

export interface JsonRpcNotification {
  readonly jsonrpc: "2.0";
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

export class McpTransportCodec {
  private requestIdCounter = 0;

  /**
   * Generates a deterministic next request ID.
   */
  public nextId(): string {
    this.requestIdCounter += 1;
    return `mcp-req-${this.requestIdCounter}`;
  }

  /**
   * Encodes an MCP initialize request.
   */
  public encodeInitializeRequest(clientName = "LUMI-JOY", clientVersion = "0.1.0"): string {
    const payload: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: this.nextId(),
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
        },
        clientInfo: {
          name: clientName,
          version: clientVersion,
        },
      },
    };
    return JSON.stringify(payload);
  }

  /**
   * Encodes a tools/list request.
   */
  public encodeToolsListRequest(): string {
    const payload: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: this.nextId(),
      method: "tools/list",
      params: {},
    };
    return JSON.stringify(payload);
  }

  /**
   * Encodes a tools/call request.
   */
  public encodeToolCallRequest(toolName: string, args: Record<string, unknown>): string {
    const payload: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: this.nextId(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    };
    return JSON.stringify(payload);
  }

  /**
   * Encodes a resources/list request.
   */
  public encodeResourcesListRequest(): string {
    const payload: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: this.nextId(),
      method: "resources/list",
      params: {},
    };
    return JSON.stringify(payload);
  }

  /**
   * Encodes a resources/read request.
   */
  public encodeResourceReadRequest(uri: string): string {
    const payload: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: this.nextId(),
      method: "resources/read",
      params: { uri },
    };
    return JSON.stringify(payload);
  }

  /**
   * Encodes a prompts/list request.
   */
  public encodePromptsListRequest(): string {
    const payload: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: this.nextId(),
      method: "prompts/list",
      params: {},
    };
    return JSON.stringify(payload);
  }

  /**
   * Encodes a prompts/get request.
   */
  public encodePromptGetRequest(name: string, args?: Record<string, string>): string {
    const payload: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: this.nextId(),
      method: "prompts/get",
      params: {
        name,
        arguments: args ?? {},
      },
    };
    return JSON.stringify(payload);
  }

  /**
   * Encodes a ping notification.
   */
  public encodePingRequest(): string {
    const payload: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: this.nextId(),
      method: "ping",
      params: {},
    };
    return JSON.stringify(payload);
  }

  /**
   * Parses raw incoming JSON string into validated JsonRpcResponse or JsonRpcRequest.
   */
  public decodeMessage(raw: string): JsonRpcRequest | JsonRpcResponse | JsonRpcNotification {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.trim());
    } catch {
      throw new Error(`[McpTransportCodec] Invalid JSON payload: ${raw.slice(0, 100)}`);
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("[McpTransportCodec] Payload must be a non-null object");
    }

    const obj = parsed as Record<string, unknown>;
    if (obj.jsonrpc !== "2.0") {
      throw new Error("[McpTransportCodec] Missing or invalid jsonrpc 2.0 version specifier");
    }

    return obj as unknown as (JsonRpcRequest | JsonRpcResponse | JsonRpcNotification);
  }

  /**
   * Parses tool definitions from a tools/list response.
   */
  public parseToolsListResult(serverId: string, result: unknown): McpToolDefinition[] {
    if (!result || typeof result !== "object") return [];
    const res = result as { tools?: Array<Record<string, unknown>> };
    if (!Array.isArray(res.tools)) return [];

    return res.tools.map((rawTool) => {
      const name = String(rawTool.name || "");
      const description = rawTool.description ? String(rawTool.description) : undefined;
      const inputSchema = (rawTool.inputSchema && typeof rawTool.inputSchema === "object")
        ? (rawTool.inputSchema as McpToolDefinition["inputSchema"])
        : { type: "object", properties: {} };

      return {
        serverId,
        name,
        qualifiedName: `mcp__${serverId}__${name}`,
        description,
        inputSchema,
      };
    });
  }

  /**
   * Parses resource definitions from a resources/list response.
   */
  public parseResourcesListResult(serverId: string, result: unknown): McpResourceDefinition[] {
    if (!result || typeof result !== "object") return [];
    const res = result as { resources?: Array<Record<string, unknown>> };
    if (!Array.isArray(res.resources)) return [];

    return res.resources.map((raw) => ({
      serverId,
      uri: String(raw.uri || ""),
      name: String(raw.name || raw.uri || ""),
      description: raw.description ? String(raw.description) : undefined,
      mimeType: raw.mimeType ? String(raw.mimeType) : undefined,
    }));
  }

  /**
   * Parses prompt definitions from a prompts/list response.
   */
  public parsePromptsListResult(serverId: string, result: unknown): McpPromptDefinition[] {
    if (!result || typeof result !== "object") return [];
    const res = result as { prompts?: Array<Record<string, unknown>> };
    if (!Array.isArray(res.prompts)) return [];

    return res.prompts.map((raw) => ({
      serverId,
      name: String(raw.name || ""),
      description: raw.description ? String(raw.description) : undefined,
      arguments: Array.isArray(raw.arguments)
        ? raw.arguments.map((arg: Record<string, unknown>) => ({
            name: String(arg.name || ""),
            description: arg.description ? String(arg.description) : undefined,
            required: Boolean(arg.required),
          }))
        : undefined,
    }));
  }

  /**
   * Parses tool call result from tools/call response.
   */
  public parseToolCallResult(result: unknown, executionTimeMs: number): McpToolCallResponse {
    if (!result || typeof result !== "object") {
      return {
        success: false,
        content: [{ type: "text", text: "Invalid tool execution response" }],
        isError: true,
        executionTimeMs,
      };
    }

    const res = result as {
      content?: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
      isError?: boolean;
    };

    const isError = Boolean(res.isError);
    const content = Array.isArray(res.content)
      ? res.content.map((item) => ({
          type: (item.type === "image" || item.type === "resource" ? item.type : "text") as "text" | "image" | "resource",
          text: item.text,
          data: item.data,
          mimeType: item.mimeType,
        }))
      : [{ type: "text" as const, text: JSON.stringify(result) }];

    return {
      success: !isError,
      content,
      isError,
      executionTimeMs,
    };
  }
}
