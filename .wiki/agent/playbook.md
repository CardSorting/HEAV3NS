# LUMI-NEW Agent Playbook

This playbook serves as the primary orientation document for AI agents working in `/Users/bozoegg/Desktop/LUMI-NEW`.

## Current System Snapshot

LUMI-NEW is a greenfield 3-tier monolithic agent framework built in TypeScript for Node.js (ESM). It is structured around the architectural design of a **Deterministic Game Engine**, where interactions execute as frame ticks (`tick()`), state transitions are captured in immutable snapshots (`GameStateSnapshot`), memory is pre-allocated in a 16MB contiguous slab (`ArenaAllocator`), and the runtime supports sub-millisecond ($<0.1\text{ ms}$ warmed p95) frame-perfect state rewind (`rewindToSnapshot()`) and session forking (`forkSession()`).

Tiers expand organically as needed to support specialized subsystem features, with the primary constraint being strict alignment with the Deterministic Game Engine Strategy ([ADR-008](../adr/ADR-008-deterministic-game-engine-architecture.md)).

Current generated verification is **Pass 193 + runtime hardening & GALX integration**: 593/593 exact composition entries in OPTIMAL cohesion, 139/139 test suites passing, and zero barrel imports (ADR-012). Active providers are strictly scoped to **OpenRouter**, **Codex (OpenAI)**, and **GALX AI Wholesale Compute** ([ADR-147](../adr/ADR-147-galx-ai-provider-integration-and-auxiliary-provider-consolidation.md)). Use [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json) for exact current measurements.

### Deterministic Game Engine Subsystems

- **Core Contracts & Abstracts (`src/core/`)**
  - Contracts: `agent.contracts.ts`, `session.contracts.ts`, `tooling.contracts.ts`, `galx.contracts.ts`
  - Abstracts: `AbstractAgentEngine`, `AbstractSessionStore`, `AbstractHands`, `AbstractEars`, `AbstractToolRegistry`
- **Tier 1: Agents (`src/agents/`)**
  - `base/agent-config.ts`: AgentConfig
  - `extensions/execution/`: AgentEngine, InteractiveModeController, CodexProgressAdapter
  - `extensions/resolution/`: ModelResolver, AgentSlashRouter, GalxProviderEngine, OpenRouterProviderEngine, CodexProviderBridge, ModelCatalog, EnvironmentKeyResolver
  - `extensions/setup/`: SetupWizard
- **Tier 2: Sessions (`src/sessions/`)**
  - `base/session-context.ts`: SessionContext
  - `extensions/`: SessionCompactor, SessionVfs, SessionMemoryStore, PersistentSessionStore (`extends AbstractSessionStore`)
- **Tier 3: Tooling (`src/tooling/`)**
  - `base/eyes.ts`: Eyes
  - `extensions/`: SkillsIngestor, AnchoredHands (`extends AbstractHands`), ProtocolEars (`extends AbstractEars`), ValidatingToolRegistry (`extends AbstractToolRegistry`), UniversalToolCallAdapter, RoadmapCompletionGate
- **Integrations & Transport (`src/integrations/`)**
  - `galx/GalxTransportClient.ts`: Enterprise Hardened Client (RFC 9530, RFC 9421, Circuit Breaker, AIMD, Token Bucket)
  - `galx/BroccoliTransportSubstrate.ts`: BroccoliDB Write-Ahead Ledger, Merkle hash chain, RFC 9449 DPoP, AES-256-GCM Envelope Crypto
- **Terminal UI (`src/tui/`)**
  - `components/agent-activity-timeline.ts`: identity-based, persistent provider activity rendering
  - `components/model-select-modal.ts`: 4-tab model selector ([1] ALL, [2] CODEX OAUTH, [3] GALX WHOLESALE, [4] OPENROUTER)
  - `components/guided-setup-walkthrough-modal.ts`: credential setup, browser fallback, and model activation
- **Container Factory & Composition Root**:
  - `src/factories/monolith-factory.ts`: MonolithFactory (synthesizes all 593 components)
  - `src/factories/grand-monolith-synthesizer.ts`: GrandMonolithSynthesizer (verifies OPTIMAL cohesion)
  - `src/index.ts`: LumiMonolith (`IAgentEngine`)

## Validation & Execution Commands

```bash
# Type-check code without emitting JS
npm run check

# Run repository policy and regression validation
npm test

# Compile distributable JavaScript
npm run build

# Launch interactive Setup Wizard (Model Providers & Codex OAuth)
lumi --setup

# Run the hermetic engine benchmark & throughput evaluation suite
npm run benchmark

# Verify current composition and critical runtime contracts
npm run smoke

# Publish synchronized live baseline reports after smoke and guardrails pass
npm run baseline:update

# Run interactive REPL session
lumi
```

## Live model turn checklist

When changing model dispatch or the interactive shell:

1. Preserve `EngineTickInput.signal` and `onProgress` through every local call boundary.
2. Map provider events to stable `activityId` values; upsert started/updated/completed states rather than appending duplicates.
3. Sanitize every message and detail. Progress must not contain raw output, credentials, tool payloads, or hidden reasoning.
4. Emit or synthesize exactly one immutable turn terminal: `completed`, `failed`, or `cancelled`. A completed item, partial response, HTTP 200, stream EOF, or silence is not a turn terminal.
5. Keep retry-attempt failures activity-scoped and share one increasing sequence across the full logical turn.
6. Set `EngineTickResult.outcome`; never make consumers infer success from a resolved promise or response text.
7. Clear elapsed timers and active abort-controller references in `finally`.
8. Verify success, empty completion, premature EOF, retry, final failure, cancellation, and a subsequent prompt in the same session.
9. Verify attempt completion gates (`RoadmapCompletionGate`) and self-healing multi-attempt loops satisfy required criteria before turn terminal publication.

Provider fidelity is intentionally asymmetric: Codex OAuth is dispatched through `@openai/codex-sdk` and provides full lifecycle events, while API-key HTTP routes provide coarse request status. Do not manufacture detailed tool activity for a route that does not expose it.

## Key Documentation & Strategy Links

- [Runtime Universal Pass & Executive Agent Operations](runtime-universal-pass.md)
- [Runtime Architecture & Executive Subsystem Guide](../../docs/RUNTIME_ARCHITECTURE_GUIDE.md)
- [Runtime Universal Optimization & Hardening Record](../../docs/RUNTIME_OPTIMIZATION_RECORD.md)
- [Current Machine-Readable Baseline](../../docs/LIVE_BASELINE.json)
- [Generated Benchmark Evidence](../../docs/BENCHMARK_REPORT.md)
- [Generated Architectural Audit](../../docs/GRAND_ARCHITECTURAL_AUDIT.md)
- [Benchmark Performance Field Note](../field-notes/BENCHMARK-PERFORMANCE-FIELD-NOTE.md)
- [The Osmosis Learning Methodology & Strategy Guide](osmosis-methodology.md)
- [ADR-001: 3-Tier Monolithic Agent Architecture](../adr/ADR-001-3-tier-monolithic-agent-architecture.md)
- [ADR-049: Interactive Setup Wizard & Provider Bridge](../adr/ADR-049-interactive-setup-wizard-and-provider-bridge.md)
- [ADR-082: Structured Agent Activity Streaming](../adr/ADR-082-structured-agent-activity-streaming.md)
- [ADR-083: Token-Aware Multi-Turn Context Lifecycle](../adr/ADR-083-token-aware-multi-turn-context-lifecycle.md)
- [ADR-084: Attempt Completion Gate Strategy & Autonomous Turn Progression](../adr/ADR-084-attempt-completion-gate-strategy.md)
- [ADR-050: Automated Benchmark & Throughput Evaluation](../adr/ADR-050-automated-benchmark-and-throughput-evaluation.md)
- [API Reference](api-reference.md)
- [Agent Activity Streaming Strategy](streaming-activity-strategy.md)
- [Design Patterns & Workflows](patterns.md)
- [Troubleshooting & Verification](troubleshooting.md)
- [Agent Memory & Constraints](agent-memory.md)
