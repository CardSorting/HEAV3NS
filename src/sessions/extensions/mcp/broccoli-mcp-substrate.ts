/**
 * broccoli-mcp-substrate.ts
 *
 * In-memory zero-GC Broccolidb storage layer for MCP servers, tools, resources, and prompt definitions.
 */

import type {
  McpServerConfig,
  McpServerStatus,
  McpToolDefinition,
  McpResourceDefinition,
  McpPromptDefinition,
  McpSessionSnapshot,
} from "../../../core/contracts/mcp-client.contracts.js";

export class BroccoliMcpSubstrate {
  private readonly servers = new Map<string, McpServerConfig>();
  private readonly statuses = new Map<string, McpServerStatus>();
  private readonly tools = new Map<string, McpToolDefinition>();
  private readonly resources = new Map<string, McpResourceDefinition>();
  private readonly prompts = new Map<string, McpPromptDefinition>();
  private activeRequests = 0;

  /**
   * Registers or updates an MCP server configuration.
   */
  public setServer(config: McpServerConfig): void {
    this.servers.set(config.id, config);
    if (!this.statuses.has(config.id)) {
      this.statuses.set(config.id, {
        id: config.id,
        state: "stopped",
        transport: config.transport,
        toolCount: 0,
        resourceCount: 0,
        promptCount: 0,
        totalCalls: 0,
        failedCalls: 0,
      });
    }
  }

  /**
   * Updates server runtime status.
   */
  public updateStatus(id: string, partial: Partial<McpServerStatus>): void {
    const existing = this.statuses.get(id);
    if (!existing) return;
    this.statuses.set(id, { ...existing, ...partial });
  }

  /**
   * Gets server config by ID.
   */
  public getServer(id: string): McpServerConfig | undefined {
    return this.servers.get(id);
  }

  /**
   * Gets server status by ID.
   */
  public getStatus(id: string): McpServerStatus | undefined {
    return this.statuses.get(id);
  }

  /**
   * Lists all server configurations.
   */
  public listServers(): McpServerConfig[] {
    return Array.from(this.servers.values());
  }

  /**
   * Lists all server statuses.
   */
  public listStatuses(): McpServerStatus[] {
    return Array.from(this.statuses.values());
  }

  /**
   * Stores discovered tools for a given server.
   */
  public setToolsForServer(serverId: string, newTools: McpToolDefinition[]): void {
    // Remove existing tools for this server
    for (const [k, t] of this.tools.entries()) {
      if (t.serverId === serverId) {
        this.tools.delete(k);
      }
    }
    // Insert new tools
    for (const t of newTools) {
      this.tools.set(t.qualifiedName, t);
    }
    this.updateStatus(serverId, { toolCount: newTools.length });
  }

  /**
   * Gets a tool by qualified name (mcp__<serverId>__<toolName>) or local name.
   */
  public getTool(qualifiedOrLocalName: string): McpToolDefinition | undefined {
    return this.tools.get(qualifiedOrLocalName);
  }

  /**
   * Lists all registered tools across all servers.
   */
  public listTools(): McpToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Stores discovered resources for a given server.
   */
  public setResourcesForServer(serverId: string, newResources: McpResourceDefinition[]): void {
    for (const [k, r] of this.resources.entries()) {
      if (r.serverId === serverId) {
        this.resources.delete(k);
      }
    }
    for (const r of newResources) {
      this.resources.set(`${serverId}::${r.uri}`, r);
    }
    this.updateStatus(serverId, { resourceCount: newResources.length });
  }

  /**
   * Lists all resources across all servers.
   */
  public listResources(): McpResourceDefinition[] {
    return Array.from(this.resources.values());
  }

  /**
   * Stores discovered prompts for a given server.
   */
  public setPromptsForServer(serverId: string, newPrompts: McpPromptDefinition[]): void {
    for (const [k, p] of this.prompts.entries()) {
      if (p.serverId === serverId) {
        this.prompts.delete(k);
      }
    }
    for (const p of newPrompts) {
      this.prompts.set(`${serverId}::${p.name}`, p);
    }
    this.updateStatus(serverId, { promptCount: newPrompts.length });
  }

  /**
   * Lists all prompts across all servers.
   */
  public listPrompts(): McpPromptDefinition[] {
    return Array.from(this.prompts.values());
  }

  /**
   * Tracks call outcome metrics.
   */
  public recordCall(serverId: string, success: boolean): void {
    const status = this.statuses.get(serverId);
    if (!status) return;
    this.statuses.set(serverId, {
      ...status,
      totalCalls: status.totalCalls + 1,
      failedCalls: success ? status.failedCalls : status.failedCalls + 1,
    });
  }

  public incrementActiveRequests(): void {
    this.activeRequests += 1;
  }

  public decrementActiveRequests(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  public getActiveRequestsCount(): number {
    return this.activeRequests;
  }

  /**
   * Clears all state.
   */
  public clear(): void {
    this.servers.clear();
    this.statuses.clear();
    this.tools.clear();
    this.resources.clear();
    this.prompts.clear();
    this.activeRequests = 0;
  }

  /**
   * Exports full session state snapshot.
   */
  public createSnapshot(): McpSessionSnapshot {
    return {
      version: 1,
      timestamp: Date.now(),
      servers: this.listStatuses(),
      tools: this.listTools(),
      resources: this.listResources(),
      prompts: this.listPrompts(),
      activeRequestsCount: this.activeRequests,
    };
  }

  /**
   * Restores state from a snapshot.
   */
  public restoreSnapshot(snapshot: McpSessionSnapshot): void {
    this.tools.clear();
    for (const t of snapshot.tools) {
      this.tools.set(t.qualifiedName, t);
    }

    this.resources.clear();
    for (const r of snapshot.resources) {
      this.resources.set(`${r.serverId}::${r.uri}`, r);
    }

    this.prompts.clear();
    for (const p of snapshot.prompts) {
      this.prompts.set(`${p.serverId}::${p.name}`, p);
    }

    this.statuses.clear();
    for (const s of snapshot.servers) {
      this.statuses.set(s.id, s);
    }

    this.activeRequests = snapshot.activeRequestsCount;
  }
}
