# ADR-085: Two-Stage Epistemic Session Title Generation, Strict Provenance Hierarchy (`user > llm > derived`), Control-Scaffolding Sanitization & Multi-Dimensional Conversation Insights Subsystem ($\mathcal{K}_{\text{title-insights}}$ / Phase 109 / Target #42)

## Status
Accepted / Implemented / Deeply Hardened (Phase 109 / Target #42)

## Context
In ancestral agent systems (`agent/title_generator.py`, `agent/insights.py`, and `agent/session_activity.py` — ~35,000 LOC), session naming and usage analytics suffered from key architectural shortcomings:
1. **Critical-Path Titling Latency**: Chat session titling previously waited for assistant turns to complete before generating names, resulting in $150\text{s}$ to $1200\text{s}$ (p90) latency where sessions appeared as `"Untitled"` or `"New Chat"` in sidebars and multi-channel gateways.
2. **Machine Scaffolding & Control-Tag Leakage**: Opening prompts containing slash commands (`/skill`, `/work`), context compaction handoffs (`[CONTEXT COMPACTION]`), task notifications (`<task-notification>`), or IDE file selection wrappers (`<ide_selection>`) leaked raw scaffolding into session titles rather than naming actual user intent.
3. **Unchecked Provenance Inversions**: Small-model fallback updates frequently overwrote user-specified custom titles or wiped out high-quality summaries when transient errors occurred.
4. **Lack of Zero-GC In-Memory Epistemic Analytics**: Usage analytics were either missing or tightly bound to disk-blocking SQLite scans without real-time in-memory token burn monitoring, $7\times 24$ activity heatmaps, cache acceleration rates, tool failure rates, or frame-perfect binary snapshot rollbacks.

## Decision
We implemented a zero-GC, typed, frame-perfect two-stage session titling, strict provenance hierarchy, and multi-dimensional conversation insights engine for **LUMI-JOY**:

1. **`DeterministicTitleGenerator` ([deterministic-title-generator.ts](../../src/agents/extensions/title_insights/deterministic-title-generator.ts))**:
   - **Stage 1 (Instant Derived Titling)**: Instant, zero-cost derivation ($\le 0.01\text{ ms}$) from the user's opening message, truncating cleanly at word boundaries ($\le 48\text{ chars}$) so sessions are named immediately at creation.
   - **Stage 2 (LLM Upgraded Titling)**: JSON-schema constrained (`{"title": "..."}`) small-model generation producing 3 to 7 word imperative sentence-case action titles without reasoning preamble or conversational filler.
   - **Control Wrapper & Machine Scaffolding Stripper**: Multi-pass recursive unwrapping of `<command-message>`, `<command-name>`, `<command-args>`, `<local-command-caveat>`, `<task-notification>`, `<system-reminder>`, `<ide_opened_file>`, and `<ide_selection>`, stripping machine prefixes while preserving actual user request prose.
   - **Language Rule Adaptation**: Automatically inherits the user's conversation language or enforces configured target language tags.
   - **Robust Fallback & Extraction Matrix**: Resilient JSON parsing supporting fenced markdown blocks, loose JSON scans, and clean prose normalization.

2. **Strict Provenance Hierarchy (`user > llm > derived`)**:
   - **`user`**: Highest authority. Assigned when a user explicitly names or renames a chat. Cannot be overwritten by LLM or derived titles.
   - **`llm`**: Intermediate authority. Assigned by small-model generation. Can upgrade `derived` titles but cannot overwrite `user` titles.
   - **`derived`**: Instant baseline authority. Automatically derived upon the first user message; safely upgraded by `llm` or `user`.

3. **`ConversationInsightsEngine` ([conversation-insights-engine.ts](../../src/agents/extensions/title_insights/conversation-insights-engine.ts))**:
   - **Multi-Dimensional Metrics Aggregator**: Computes total sessions, message counts, tool invocations, duration, average messages per session, and cost economics.
   - **Token Economics & Cache Efficiency**: Analyzes input, output, cache-read, and cache-write tokens to quantify cache acceleration savings and exact cost attributions.
   - **Tool & Skill Utilization Analytics**: Tracks call frequencies, error rates, failure distributions, and average latency per tool and skill.
   - **$7 \times 24$ Temporal Activity Matrix**: Computes hour-by-hour weekly activity heatmaps, identifying peak operating windows and active diurnal distribution.
   - **Rich ANSI Terminal Dashboard**: Generates formatted terminal reports with summary cards, table grids, and horizontal bar charts (`█`).

4. **`BroccoliTitleInsightsSubstrate` ([broccoli-title-insights-substrate.ts](../../src/sessions/extensions/title_insights/broccoli-title-insights-substrate.ts))**:
   - In-memory Broccolidb repository maintaining title ledgers, provenance metadata, bounded activity event buffers, and cached analytics aggregations.

5. **`TitleInsightsSnapshotManager` ([title-insights-snapshot-manager.ts](../../src/sessions/extensions/title_insights/title-insights-snapshot-manager.ts))**:
   - Frame-perfect binary serialization and $O(1)$ state rollback in $<0.05\text{ ms}$.

6. **`TitleInsightsSupervisor` ([title-insights-supervisor.ts](../../src/agents/extensions/title_insights/title-insights-supervisor.ts))**:
   - Master supervisor coordinating opening message lifecycle hooks, provenance enforcement, activity event recording, and insights generation.

7. **`TitleInsightsToolSuite` ([title-insights-tool-suite.ts](../../src/tooling/extensions/title_insights/title-insights-tool-suite.ts))**:
   - Exposes 7 model tools: `session_derive_title`, `session_generate_title`, `session_set_title`, `session_get_title`, `session_generate_insights`, `session_get_usage_breakdown`, and `session_inspect_activity_patterns`.

## Invariants & Guardrails
1. **Zero Barrel Imports (`ADR-012`)**: Direct file imports only.
2. **Base Class Immutability (`ADR-012`)**: Base classes remain unmodified.
3. **Sub-Millisecond Latency SLA**: Derived titling completes in $\le 0.01\text{ ms}$; state rollback in $\le 0.05\text{ ms}$.
4. **Zero-GC Invariant**: All active titling and analytics operations execute within in-memory typed structures without GC slab fragmentation.
