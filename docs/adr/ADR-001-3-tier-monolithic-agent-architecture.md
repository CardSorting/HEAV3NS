# ADR-001: 3-Tier Monolithic Agent Architecture

- **Status**: Accepted (Updated)
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Establishing the 3-tier monolithic architecture (`agents`, `sessions`, `tooling`) for `/Users/bozoegg/Desktop/LUMI-NEW`.

---

## 1. Context & Motivation

Initial multi-agent experiments using 6+ separate agent micro-services suffered from context fragmentation, serial RPC overhead, and uncoordinated state mutations. Moving to a 3-tier monolithic structure consolidates orchestration into single execution loops while preserving modularity.

---

## 2. Architectural Decision

### 3-Tier Monolithic System Layout
The system is divided into three distinct operational tiers, modeling a **Deterministic Game Engine**:

1. **AGENTS (`src/agents/`)**: Primary decision-making tier containing agent configuration, prompt composition, fallback model resolution, interactive slash command routing, and the deterministic tick engine loop.
2. **SESSIONS (`src/sessions/`)**: World state tier managing session context, turn history compaction, Virtual File System (VFS) staging, long-term memory fact stores, and state store persistence.
3. **TOOLING (`src/tooling/`)**: Sensory subsystem tier containing perception ([Eyes](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/base/eyes.ts#L14)), physics & mutation ([AnchoredHands](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/extensions/hands.ts#L10)), telemetry & audio ([ProtocolEars](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/extensions/ears.ts#L4)), skill manifest ingestor ([SkillsIngestor](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/extensions/skills-ingestor.ts#L11)), and parameter-validated tool registry ([ValidatingToolRegistry](file:///Users/bozoegg/Desktop/LUMI-NEW/src/tooling/extensions/tool-registry.ts#L9)).

### Organic Extension Rule
Tiers may expand beyond initial class limits as subsystem complexity grows, provided all new components strictly align with and model the **Deterministic Game Engine Strategy**.
