# ADR-039: Phase 22 MCP Hub & Ripgrep Search Service (Passes 76–78)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing Model Context Protocol integration (`McpHub` from `packages/codemarie/src/services/mcp`), workspace pattern search (`RipgrepSearchService` from `packages/codemarie/src/services/ripgrep`), and performing Phase 22 master subsystem synthesis (Passes 76–78) into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy**.

---

## 1. Context & Motivation (The Why)

To complete Phase 22 monorepo feature absorption into the single deterministic monolith engine architecture:
1. **Pass 76**: Model Context Protocol (MCP) server hub and dynamic tool registry (`McpHub`).
2. **Pass 77**: High-speed workspace ripgrep pattern match service (`RipgrepSearchService`).
3. **Pass 78**: Phase 22 master subsystem synthesis verification.

---

## 2. Architectural Decision (The What)

Following **ADR-012**:
- `src/tooling/extensions/mcp/mcp-hub.ts` (`McpHub`)
- `src/tooling/extensions/perception/ripgrep-search-service.ts` (`RipgrepSearchService`)
- `src/index.ts` (`LumiMonolith` master composition root)
