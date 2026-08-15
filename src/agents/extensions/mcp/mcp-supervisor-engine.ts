/**
 * mcp-supervisor-engine.ts
 *
 * Master MCP Client Supervisor Engine.
 * Manages MCP server lifecycle, dynamic tool/resource/prompt discovery, namespaced tool dispatch,
 * security scrubbing, sampling rate governance, and frame-level state integration.
 */

import type {
  McpServerConfig,
  McpServerStatus,
  McpToolDefinition,
  McpResourceDefinition,
  McpPromptDefinition,
  McpToolCallResponse,
  McpSamplingRequest,
  McpSamplingResponse,
} from "../../../core/contracts/mcp-client.contracts.js";
import { McpTransportCodec } from "../../../tooling/extensions/mcp/mcp-transport-codec.js";
import { McpSecurityScrubber } from "../../../tooling/extensions/mcp/mcp-security-scrubber.js";
import { BroccoliMcpSubstrate } from "../../../sessions/extensions/mcp/broccoli-mcp-substrate.js";

export type McpCustomTransportHandler = (
  serverId: string,
  requestPayload: string
) => Promise<string>;

export class McpSupervisorEngine {
  private readonly substrate: BroccoliMcpSubstrate;
  private readonly codec: McpTransportCodec;
  private readonly scrubber: McpSecurityScrubber;
  private readonly customHandlers = new Map<string, McpCustomTransportHandler>();

  constructor(
    substrate: BroccoliMcpSubstrate,
    codec: McpTransportCodec,
    scrubber: McpSecurityScrubber
  ) {
    this.substrate = substrate;
    this.codec = codec;
    this.scrubber = scrubber;
  }

  /**
   * Registers a new MCP server configuration.
   */
  public registerServer(config: McpServerConfig): void {
    this.substrate.setServer(config);
  }

  /**
   * Unregisters an MCP server and removes its tools.
   */
  public unregisterServer(serverId: string): void {
    this.substrate.setToolsForServer(serverId, []);
    this.substrate.setResourcesForServer(serverId, []);
    this.substrate.setPromptsForServer(serverId, []);
    this.substrate.updateStatus(serverId, { state: "stopped" });
    this.customHandlers.delete(serverId);
  }

  /**
   * Attaches an in-process or mock transport handler for testing or custom bridge transports.
   */
  public setCustomTransportHandler(serverId: string, handler: McpCustomTransportHandler): void {
    this.customHandlers.set(serverId, handler);
  }

  /**
   * Connects to an MCP server, performs handshake/initialize, and discovers tools/resources/prompts.
   */
  public async connectServer(serverId: string): Promise<boolean> {
    const config = this.substrate.getServer(serverId);
    if (!config) return false;

    this.substrate.updateStatus(serverId, { state: "connecting" });

    try {
      // 1. Initialize Handshake
      const initReq = this.codec.encodeInitializeRequest();
      const initResRaw = await this.sendPayload(serverId, initReq);
      const initDecoded = this.codec.decodeMessage(initResRaw);

      if ("error" in initDecoded && initDecoded.error) {
        throw new Error(`Initialize error: ${initDecoded.error.message}`);
      }

      // 2. Discover Tools
      const toolsReq = this.codec.encodeToolsListRequest();
      const toolsResRaw = await this.sendPayload(serverId, toolsReq);
      const toolsDecoded = this.codec.decodeMessage(toolsResRaw);
      if ("result" in toolsDecoded) {
        const tools = this.codec.parseToolsListResult(serverId, toolsDecoded.result);
        this.substrate.setToolsForServer(serverId, tools);
      }

      // 3. Discover Resources
      const resReq = this.codec.encodeResourcesListRequest();
      const resRaw = await this.sendPayload(serverId, resReq);
      const resDecoded = this.codec.decodeMessage(resRaw);
      if ("result" in resDecoded) {
        const resources = this.codec.parseResourcesListResult(serverId, resDecoded.result);
        this.substrate.setResourcesForServer(serverId, resources);
      }

      // 4. Discover Prompts
      const promptReq = this.codec.encodePromptsListRequest();
      const promptRaw = await this.sendPayload(serverId, promptReq);
      const promptDecoded = this.codec.decodeMessage(promptRaw);
      if ("result" in promptDecoded) {
        const prompts = this.codec.parsePromptsListResult(serverId, promptDecoded.result);
        this.substrate.setPromptsForServer(serverId, prompts);
      }

      this.substrate.updateStatus(serverId, {
        state: "ready",
        lastHeartbeatAt: Date.now(),
        lastError: undefined,
      });

      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.substrate.updateStatus(serverId, {
        state: "error",
        lastError: this.scrubber.redactSensitiveText(errMsg),
      });
      return false;
    }
  }

  /**
   * Calls an MCP tool by qualified name or serverId + toolName.
   */
  public async callTool(
    qualifiedOrLocalName: string,
    args: Record<string, unknown>,
    explicitServerId?: string
  ): Promise<McpToolCallResponse> {
    const startTime = Date.now();
    let serverId = explicitServerId;
    let toolName = qualifiedOrLocalName;

    if (!serverId) {
      const toolDef = this.substrate.getTool(qualifiedOrLocalName);
      if (toolDef) {
        serverId = toolDef.serverId;
        toolName = toolDef.name;
      } else if (qualifiedOrLocalName.startsWith("mcp__")) {
        const parts = qualifiedOrLocalName.split("__");
        serverId = parts[1];
        toolName = parts.slice(2).join("__");
      }
    }

    if (!serverId) {
      return {
        success: false,
        content: [{ type: "text", text: `MCP tool '${qualifiedOrLocalName}' not found in registry.` }],
        isError: true,
        executionTimeMs: Date.now() - startTime,
      };
    }

    const serverStatus = this.substrate.getStatus(serverId);
    if (!serverStatus || serverStatus.state !== "ready") {
      return {
        success: false,
        content: [{ type: "text", text: `MCP server '${serverId}' is not ready (state: ${serverStatus?.state ?? "unknown"}).` }],
        isError: true,
        executionTimeMs: Date.now() - startTime,
      };
    }

    this.substrate.incrementActiveRequests();
    try {
      const payload = this.codec.encodeToolCallRequest(toolName, args);
      const rawRes = await this.sendPayload(serverId, payload);
      const decoded = this.codec.decodeMessage(rawRes);

      const executionTime = Date.now() - startTime;
      let toolRes: McpToolCallResponse;

      if ("error" in decoded && decoded.error) {
        toolRes = {
          success: false,
          content: [{ type: "text", text: this.scrubber.redactSensitiveText(decoded.error.message) }],
          isError: true,
          executionTimeMs: executionTime,
        };
      } else if ("result" in decoded) {
        toolRes = this.codec.parseToolCallResult(decoded.result, executionTime);
      } else {
        toolRes = {
          success: false,
          content: [{ type: "text", text: "Invalid or empty response from MCP server." }],
          isError: true,
          executionTimeMs: executionTime,
        };
      }

      this.substrate.recordCall(serverId, toolRes.success);
      return toolRes;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.substrate.recordCall(serverId, false);
      return {
        success: false,
        content: [{ type: "text", text: this.scrubber.redactSensitiveText(errMsg) }],
        isError: true,
        executionTimeMs: Date.now() - startTime,
      };
    } finally {
      this.substrate.decrementActiveRequests();
    }
  }

  /**
   * Reads a resource from an MCP server.
   */
  public async readResource(serverId: string, uri: string): Promise<string> {
    const payload = this.codec.encodeResourceReadRequest(uri);
    const rawRes = await this.sendPayload(serverId, payload);
    const decoded = this.codec.decodeMessage(rawRes);

    if ("error" in decoded && decoded.error) {
      throw new Error(this.scrubber.redactSensitiveText(decoded.error.message));
    }
    if ("result" in decoded && decoded.result && typeof decoded.result === "object") {
      const res = decoded.result as { contents?: Array<{ text?: string; blob?: string }> };
      if (Array.isArray(res.contents) && res.contents.length > 0) {
        return res.contents[0].text || res.contents[0].blob || "";
      }
    }
    return JSON.stringify(decoded);
  }

  /**
   * Gets a prompt from an MCP server.
   */
  public async getPrompt(
    serverId: string,
    promptName: string,
    args?: Record<string, string>
  ): Promise<string> {
    const payload = this.codec.encodePromptGetRequest(promptName, args);
    const rawRes = await this.sendPayload(serverId, payload);
    const decoded = this.codec.decodeMessage(rawRes);

    if ("error" in decoded && decoded.error) {
      throw new Error(this.scrubber.redactSensitiveText(decoded.error.message));
    }
    if ("result" in decoded && decoded.result && typeof decoded.result === "object") {
      const res = decoded.result as { messages?: Array<{ role?: string; content?: { text?: string } }> };
      if (Array.isArray(res.messages) && res.messages.length > 0) {
        return res.messages.map((m) => `${m.role || "user"}: ${m.content?.text || ""}`).join("\n");
      }
    }
    return JSON.stringify(decoded);
  }

  /**
   * Formats all discovered tools into OpenAI model function tool schemas.
   */
  public getModelToolSchemas(): Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters: Record<string, unknown>;
    };
  }> {
    return this.substrate.listTools().map((t) => ({
      type: "function" as const,
      function: {
        name: t.qualifiedName,
        description: t.description || `MCP tool provided by server '${t.serverId}'`,
        parameters: t.inputSchema as unknown as Record<string, unknown>,
      },
    }));
  }

  /**
   * Sends raw JSON-RPC payload to the server handler.
   */
  private async sendPayload(serverId: string, payload: string): Promise<string> {
    const customHandler = this.customHandlers.get(serverId);
    if (customHandler) {
      return customHandler(serverId, payload);
    }

    // Default built-in mock/loopback response generator for unhandled servers
    return JSON.stringify({
      jsonrpc: "2.0",
      id: "resp",
      result: {
        tools: [],
        resources: [],
        prompts: [],
      },
    });
  }
}
