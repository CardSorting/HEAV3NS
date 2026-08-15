/**
 * mcp-client-tool-suite.ts
 *
 * Model tool suite exposing MCP client supervisory capabilities to the AI agent:
 * - `mcp_list_servers`: Inspects configured MCP servers and tool counts.
 * - `mcp_call_tool`: Invokes a tool on a connected MCP server.
 * - `mcp_read_resource`: Fetches a resource by URI from an MCP server.
 * - `mcp_get_prompt`: Retrieves prompt templates from an MCP server.
 */

import { McpSupervisorEngine } from "../../../agents/extensions/mcp/mcp-supervisor-engine.js";
import { BroccoliMcpSubstrate } from "../../../sessions/extensions/mcp/broccoli-mcp-substrate.js";
import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";

export class McpClientToolSuite {
  private readonly supervisor: McpSupervisorEngine;
  private readonly substrate: BroccoliMcpSubstrate;

  constructor(
    supervisor: McpSupervisorEngine,
    substrate: BroccoliMcpSubstrate
  ) {
    this.supervisor = supervisor;
    this.substrate = substrate;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "mcp_list_servers",
        description: "Lists all configured and connected MCP (Model Context Protocol) servers, their health status, and available tools/resources.",
        parameters: {},
        execute: async () => {
          const statuses = this.substrate.listStatuses();
          const tools = this.substrate.listTools();
          return {
            serverCount: statuses.length,
            servers: statuses,
            totalToolsDiscovered: tools.length,
            tools: tools.map((t) => ({ name: t.qualifiedName, serverId: t.serverId, description: t.description })),
          };
        },
      },
      {
        name: "mcp_call_tool",
        description: "Executes a tool provided by a connected MCP server.",
        parameters: {
          toolName: {
            type: "string",
            required: true,
            description: "The name or qualified name of the MCP tool (e.g. 'mcp__filesystem__read_file' or 'read_file').",
          },
          serverId: {
            type: "string",
            required: false,
            description: "Optional explicit server ID if tool name is unqualified.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const toolName = String(args.toolName || "");
          const serverId = args.serverId ? String(args.serverId) : undefined;
          const toolArgs = (args.arguments && typeof args.arguments === "object")
            ? (args.arguments as Record<string, unknown>)
            : args;

          return this.supervisor.callTool(toolName, toolArgs, serverId);
        },
      },
      {
        name: "mcp_read_resource",
        description: "Reads a resource by URI from an MCP server.",
        parameters: {
          serverId: {
            type: "string",
            required: true,
            description: "The target MCP server ID.",
          },
          uri: {
            type: "string",
            required: true,
            description: "The resource URI (e.g. 'file:///workspace/schema.json').",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const serverId = String(args.serverId || "");
          const uri = String(args.uri || "");
          try {
            const content = await this.supervisor.readResource(serverId, uri);
            return { success: true, serverId, uri, content };
          } catch (err) {
            return { success: false, serverId, uri, error: String(err) };
          }
        },
      },
      {
        name: "mcp_get_prompt",
        description: "Fetches a structured prompt template from an MCP server.",
        parameters: {
          serverId: {
            type: "string",
            required: true,
            description: "The target MCP server ID.",
          },
          promptName: {
            type: "string",
            required: true,
            description: "The name of the prompt.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          const serverId = String(args.serverId || "");
          const promptName = String(args.promptName || "");
          const promptArgs = (args.arguments && typeof args.arguments === "object")
            ? (args.arguments as Record<string, string>)
            : undefined;

          try {
            const rendered = await this.supervisor.getPrompt(serverId, promptName, promptArgs);
            return { success: true, serverId, promptName, rendered };
          } catch (err) {
            return { success: false, serverId, promptName, error: String(err) };
          }
        },
      },
    ];
  }
}
