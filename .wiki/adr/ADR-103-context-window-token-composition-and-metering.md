# ADR-103: Context Window Token Composition Breakdown & Category Metering Subsystem

## Status
**Accepted** (Target #60 / Phase 127 — 2026-08-16)

## Context
Long-running autonomous agent sessions accumulate large amounts of context across diverse functional domains: system prompt instructions, dynamic rule sets, loaded skills catalogs, MCP tools, subagent delegations, working memory, and turn histories. Without fine-grained category metering, operators and agents cannot observe where token capacity is consumed, when context compression is imminent, or how to prune underutilized components.

Hermes Agent introduced real-time context token breakdown and telemetry in `agent/context_breakdown.py`.

## Decision
We implement a zero-GC, typed, deterministic **Context Window Token Composition Breakdown & Category Metering Subsystem** in LUMI-JOY:

1. **Contracts Layer (`context-breakdown.contracts.ts`)**:
   - Defines `ContextCategoryId` (`"system_prompt" | "tool_definitions" | "rules" | "skills" | "mcp" | "subagent_definitions" | "memory" | "conversation"`).
   - Defines `ContextCategorySlice`, `ContextBreakdownReport`, `ContextBreakdownConfig`, `ContextBreakdownMetrics`, and `ContextBreakdownWorkspaceSnapshot`.

2. **Substrate & Snapshots (`broccoli-context-breakdown-substrate.ts`, `context-breakdown-snapshot-manager.ts`)**:
   - In-memory Broccolidb repository storing latest breakdown snapshots, per-category historical token trends, configuration parameters, and telemetry metrics.
   - Binary snapshot manager for frame-perfect state rollback in $<0.05\text{ ms}$.

3. **Deterministic Engine & Supervisor (`deterministic-context-breakdown-engine.ts`, `context-breakdown-supervisor.ts`)**:
   - `DeterministicContextBreakdownEngine`: Computes fast zero-allocation token estimations (`charsToTokens`, `jsonTokens`), partitions model tools (builtin, MCP, subagent), calculates capacity utilization percentages, headroom tokens, compression proximity triggers, and renders ASCII progress bars.
   - `ContextBreakdownSupervisor`: Coordinates live breakdown computations, ASCII bar rendering, and substrate state caching.

4. **Model Tool Suite (`context-breakdown-tool-suite.ts`)**:
   - Exposes 5 model tools:
     - `context_breakdown_compute`: Computes real-time categorical token consumption breakdown.
     - `context_breakdown_render_bar`: Formats an ASCII visual bar chart of token utilization.
     - `context_breakdown_check_compression`: Checks whether current token volume is approaching compression threshold.
     - `context_breakdown_configure`: Adjusts context limits and threshold percentages.
     - `context_breakdown_get_metrics`: Retrieves aggregate statistics on token evaluations and headroom.

5. **Grand Monolith Expansion**:
   - Expands Grand Monolith from **474 to 479 components** in exact alphabetical cohesion.

## Consequences
- Provides real-time epistemic observability into token economics across 8 discrete categories.
- Signals pre-emptive compression triggers before reaching hard token limits.
- Grand Monolith cohesion expanded to 479/479 components in OPTIMAL state.
- Zero barrel imports and base class immutability preserved.
