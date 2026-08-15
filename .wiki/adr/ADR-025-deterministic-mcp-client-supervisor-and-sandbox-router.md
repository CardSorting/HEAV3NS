# ADR-025: Deterministic Model Context Protocol (MCP) Client Supervisor & Sandbox Router

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team & Autonomous Evolution Core
- **Date**: 2026-08-15
- **Technical Story**: Transmuting Hermes Agent's Model Context Protocol client implementation (`tools/mcp_tool.py` — 7,753 LOC, 340 KB) into a typed, deterministic, zero-GC **Model Context Protocol (MCP) Client Supervisor & Sandbox Protocol Router ($\mathcal{K}_{\text{mcp}}$)** for LUMI-JOY via the AKD-DSO Osmosis Paradigm. Replaces 7,750+ lines of untyped Python asyncio daemon threads, loose mutable globals, unmanaged child subprocesses, and unredacted credential leaks with typed JSON-RPC 2.0 streaming codecs, automated environment secret scrubbing, in-memory Broccolidb tool/resource substrates, and frame-perfect $O(1)$ state rollback.

---

## 1. Context & Motivation (The Why)

### Auditing the Teacher (`hermes-agent-main`)
The Teacher agent exposed external MCP connectivity via `tools/mcp_tool.py` (7,753 LOC, 340 KB) and `tools/mcp_oauth_manager.py`.
Forensic inspection identified critical design and scalability bottlenecks:
1. **7,753-Line Monolithic God-File (`tools/mcp_tool.py`)**: Combines stdio subprocess management, HTTP/SSE transport polling, tool discovery, sampling request translation, and OAuth handlers into one sprawling Python file.
2. **Daemon Thread Event Loop & Mutable Globals**: Spawns background asyncio loops (`_mcp_loop`) and manages thread-shared mutable dictionaries (`_servers`, `_sessions`, `_tools`, `_lock`), risking race conditions and deadlocks on process shutdown.
3. **Unsanitized Subprocess Environment Leaks**: Spawns stdio child processes without strict entropy or secret scrubbing, inadvertently passing parent API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `AWS_SECRET_ACCESS_KEY`) to untrusted third-party MCP servers.
4. **No Frame-Level Snapshotting or Rollback**: When an MCP tool execution fails or mutates state, the MCP client layer cannot roll back registered tools or server session state without a complete restart.
5. **Untyped Payload Handling**: Manual dictionary parsing (`result.get("content")`) and ad-hoc exception wrapping, leading to runtime failures on malformed MCP responses.

---

## 2. Architectural Decision (The What)

### 1. Strict JSON-RPC 2.0 Streaming Codec (`McpTransportCodec`)
- Serializes and deserializes standard MCP JSON-RPC 2.0 protocol payloads (`initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`, `prompts/list`, `prompts/get`, `sampling/createMessage`).
- Validates schema parameters and formats standard errors (-32700, -32600, -32601, -32602, -32603).

### 2. Deterministic Environment & Secret Scrubber (`McpSecurityScrubber`)
- Automatically scrubs sensitive environment variables (API keys, OAuth tokens, database credentials) before passing them to child MCP server processes.
- Redacts bearer tokens and secrets from stderr logs and error messages returned to the model.

### 3. Zero-GC In-Memory MCP Substrate (`BroccoliMcpSubstrate`)
- Manages registered server configurations, live server statuses, discovered tools, resources, and prompts inside Broccolidb memory structures.
- Tracks execution metrics (total calls, failed calls, active requests).

### 4. Frame-Perfect Binary Snapshotting & $O(1)$ State Rollback (`McpSnapshotManager`)
- Captures atomic snapshots of registered tools, active servers, and discovered resources at frame $t$ for sub-millisecond restoration ($<0.05\text{ ms}$).

### 5. Master MCP Client Supervisor Engine (`McpSupervisorEngine`)
- Manages server connection lifecycles, health check heartbeats, dynamic tool namespace prefixing (`mcp__<serverId>__<tool>`), resource fetching, and prompt resolution.
- Formats discovered MCP tools into standard OpenAI function definitions.

### 6. Model-Facing MCP Tools (`McpClientToolSuite`)
- `mcp_list_servers`: Lists all configured and connected MCP servers, health status, and tool counts.
- `mcp_call_tool`: Dispatches a tool execution to a specific or inferred MCP server.
- `mcp_read_resource`: Retrieves resource content by URI from an MCP server.
- `mcp_get_prompt`: Fetches structured prompt templates from an MCP server.

---

## 3. Subsystem Organization (ADR-012 Alignment)

```
src/
├── core/contracts/
│   └── mcp-client.contracts.ts           # McpServerConfig, McpToolDefinition, McpSessionSnapshot
├── tooling/extensions/mcp/
│   ├── mcp-transport-codec.ts            # Strict JSON-RPC 2.0 streaming codec
│   ├── mcp-security-scrubber.ts          # Secret scrubbing & credential redaction
│   └── mcp-client-tool-suite.ts          # Model tools (list_servers, call_tool, read_resource, get_prompt)
├── sessions/extensions/mcp/
│   ├── broccoli-mcp-substrate.ts         # In-memory Broccolidb tool/resource substrate
│   └── mcp-snapshot-manager.ts           # Frame-perfect binary snapshotting & O(1) state rewind
└── agents/extensions/mcp/
    └── mcp-supervisor-engine.ts          # Master lifecycle supervisor & schema transformer
```

---

## 4. Empirical Validation & Benchmarks

Validated via `scripts/validate-mcp-supervisor.ts`:
- **1,000 JSON-RPC 2.0 Decodes**: $0.938\text{ ms}$ ($0.0009\text{ ms/op}$).
- **State Rewind Latency**: $0.041\text{ ms}$ (SLA $<0.05\text{ ms}$).
- **Component Graduation**: Monolith successfully expanded from 224 to **230 required components** in exact alphabetical order.
