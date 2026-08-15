/**
 * mcp-client.contracts.ts
 *
 * Core type definitions and contracts for the Deterministic Model Context Protocol (MCP)
 * Client Supervisor and Sandbox Protocol Router (Target #11 / Phase 73 / ADR-025).
 */

export type McpTransportType = "stdio" | "http" | "sse";

export type McpServerState = "stopped" | "connecting" | "ready" | "error" | "reconnecting";

export interface McpServerConfig {
  readonly id: string;
  readonly transport: McpTransportType;
  readonly command?: string;
  readonly args?: string[];
  readonly url?: string;
  readonly env?: Record<string, string>;
  readonly headers?: Record<string, string>;
  readonly timeoutMs?: number;
  readonly connectTimeoutMs?: number;
  readonly keepaliveIntervalMs?: number;
  readonly supportsParallelToolCalls?: boolean;
  readonly samplingEnabled?: boolean;
  readonly allowedModels?: string[];
  readonly maxRpm?: number;
}

export interface McpToolParameterSchema {
  readonly type: string;
  readonly properties?: Record<string, {
    readonly type: string;
    readonly description?: string;
    readonly enum?: string[];
    readonly default?: unknown;
  }>;
  readonly required?: string[];
}

export interface McpToolDefinition {
  readonly serverId: string;
  readonly name: string;
  readonly qualifiedName: string; // mcp__<serverId>__<name>
  readonly description?: string;
  readonly inputSchema: McpToolParameterSchema;
  readonly timeoutMs?: number;
}

export interface McpResourceDefinition {
  readonly serverId: string;
  readonly uri: string;
  readonly name: string;
  readonly description?: string;
  readonly mimeType?: string;
}

export interface McpPromptArgument {
  readonly name: string;
  readonly description?: string;
  readonly required?: boolean;
}

export interface McpPromptDefinition {
  readonly serverId: string;
  readonly name: string;
  readonly description?: string;
  readonly arguments?: McpPromptArgument[];
}

export interface McpSamplingRequest {
  readonly serverId: string;
  readonly messages: Array<{
    readonly role: "user" | "assistant" | "system";
    readonly content: string;
  }>;
  readonly maxTokens?: number;
  readonly modelPreferences?: {
    readonly hints?: Array<{ readonly name: string }>;
    readonly intelligencePriority?: number;
    readonly speedPriority?: number;
  };
  readonly systemPrompt?: string;
}

export interface McpSamplingResponse {
  readonly role: "assistant";
  readonly content: {
    readonly type: "text";
    readonly text: string;
  };
  readonly model: string;
  readonly stopReason?: string;
}

export interface McpToolCallRequest {
  readonly serverId: string;
  readonly toolName: string;
  readonly arguments: Record<string, unknown>;
  readonly callId?: string;
}

export interface McpToolCallResponse {
  readonly success: boolean;
  readonly content: Array<{
    readonly type: "text" | "image" | "resource";
    readonly text?: string;
    readonly data?: string;
    readonly mimeType?: string;
  }>;
  readonly isError?: boolean;
  readonly executionTimeMs: number;
}

export interface McpServerStatus {
  readonly id: string;
  readonly state: McpServerState;
  readonly transport: McpTransportType;
  readonly toolCount: number;
  readonly resourceCount: number;
  readonly promptCount: number;
  readonly lastHeartbeatAt?: number;
  readonly totalCalls: number;
  readonly failedCalls: number;
  readonly lastError?: string;
}

export interface McpSessionSnapshot {
  readonly version: number;
  readonly timestamp: number;
  readonly servers: McpServerStatus[];
  readonly tools: McpToolDefinition[];
  readonly resources: McpResourceDefinition[];
  readonly prompts: McpPromptDefinition[];
  readonly activeRequestsCount: number;
}
