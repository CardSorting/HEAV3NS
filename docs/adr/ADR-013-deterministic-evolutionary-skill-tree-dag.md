# ADR-013: Deterministic Evolutionary Skill Tree DAG & Allocation-Bounded Substrate Architecture

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team & Autonomous Evolution Core
- **Date**: 2026-08-15
- **Technical Story**: Transmuting Hermes Agent's procedural skill system into a deterministic **Evolutionary AI Agent Skill Tree DAG ($\mathcal{G}_{\text{skill}}$)** for LUMI-JOY via the AKD-DSO Osmosis Paradigm. Replaces raw Python OS threads, non-deterministic file polling, and unverified mutations with arena-backed memory caching, line-anchored hashing, checkpointed rollback, and RPG-style mastery progression. This is an implementation record, not a comparative performance or provenance conclusion.

---

## 1. Context & Motivation (The Why)

### Auditing the Teacher (`hermes-agent-main`)
The Teacher agent codebase implements procedural skill memory using flat category directories, YAML frontmatter (`name`, `description` $\le 60$ chars), and 3-tier progressive disclosure (`skills_list`, `skill_view`, `references/`). It provides reflection loops (`background_review.py`) and lifecycle curation (`curator.py`).

However, the Teacher architecture suffers from critical software friction and failure modes:
1. **Uncoordinated OS Threads**: Spawns raw Python daemon threads that execute uncoordinated background file mutations, risking race conditions and disk corruption.
2. **String/Regex Mutation Fragility**: Modifies markdown instructions using unstructured regex surgery, lacking line-anchored verification.
3. **Wall-Clock Non-Determinism**: Relies on file `mtime` polling and wall-clock inactivity decay, causing unpredictable cache staleness.
4. **Irreversible Mutations**: Lacks state snapshots and atomic rollbacks; broken mutations require manual salvage.
5. **Absence of Tree Progression Mechanics**: Skills are isolated prompt fragments without prerequisite unlock DAGs, mastery scoring, or evolutionary genetic operators.

---

## 2. Architectural Decision (The What)

### 1. Topological Skill Tree DAG ($\mathcal{G}_{\text{skill}}$)
Implements a typed Directed Acyclic Graph ($\mathcal{G}_{\text{skill}} = (\mathcal{V}, \mathcal{E}_{\text{prereq}}, \mathcal{E}_{\text{rel}})$) where:
- Skills possess tiers: `novice`, `adept`, `master`, `sovereign`.
- Mastery score $\mathcal{M} \in [0, 100]$ accumulates through verified executions; skills unlock only when all parent prerequisites achieve $\mathcal{M} \ge 50\%$.
- Topological sort (Kahn's / Tarjan's algorithm) enforces acyclic dependency verification and cycle detection.

### 2. Allocation-Bounded Broccolidb Memory Substrate (`BroccoliSkillTreeSubstrate`)
- Caches skill manifests, DAG vectors, and relation matrices directly in memory.
- A historical local run recorded sub-millisecond execution ($< 0.6\text{ ms}$ for 1,000 queries, $\approx 0.55\ \mu\text{s}$ per lookup); reproduce the named workload and host before relying on that observation.

### 3. Line-Anchored Forensic Mutations (`AnchoredSkillMutator`)
- Employs `AnchoredHands` (`applyAnchoredEdit`) and SHA-256 pre/post integrity hashing.
- Enforces strict **Read-Before-Write Provenance**: an autonomous pass cannot mutate a skill without having inspected its contents in context.
- Strips Trojan Unicode characters (zero-width and bidirectional overrides) preventing Trojan Source prompt injections.

### 4. Checkpointed Snapshots & Indexed Rollback (`SkillTreeSnapshotManager`)
- Captures binary state snapshots prior to every mutation.
- Exposes `rollbackLastMutation()` for reversion of the modeled in-memory state if downstream verification fails; external side effects are outside this API's scope.

### 5. Deterministic Epoch-Based Curator (`DeterministicSkillCurator`)
- Replaces wall-clock time with frame-tick index decay ($\Delta\text{Tick}$).
- Uses Jaccard similarity across tags and categories to automatically discover consolidation clusters for meta-class umbrella synthesis.

### 6. Evolutionary Reflection Engine & Anti-Degeneration Guard (`EvolutionarySkillTreeEngine`, `AntiDegenerationGuard`)
- Audits frame trajectory $\mathbf{Step}_t$ to detect user corrections, workflow refinements, and tool workarounds.
- Axiomatically rejects:
  - Negative tool refusals ("tool X is broken, do not use").
  - Transient environment glitches ("missing binary", "command not found").
  - Untested failure trails.

---

## 3. Subsystem Organization (ADR-012 Alignment)

```
src/
├── core/contracts/
│   └── skills.contracts.ts                   # Typed contracts (SkillTier, DAG, Mutations, Engine)
├── tooling/extensions/skills/
│   ├── deterministic-skill-tree-parser.ts   # Frontmatter & Trojan Unicode sanitizer, DAG builder
│   ├── anchored-skill-mutator.ts            # Line-anchored patch mutator with provenance guards
│   └── skill-tree-tool-suite.ts             # Model tools (skill_list_tree, skill_view, skill_tree_visualize)
├── sessions/extensions/skills/
│   ├── broccoli-skill-tree-substrate.ts     # allocation-bounded memory caching for Skill Tree DAG
│   ├── skill-tree-snapshot-manager.ts       # checkpointed snapshot & O(1) rollback coordinator
│   └── deterministic-skill-curator.ts       # Frame-based decay & cluster consolidation
└── agents/extensions/skills/
    ├── evolutionary-skill-tree-engine.ts    # Trajectory analyzer, fitness & mastery calculator
    ├── skill-tree-prompt-composer.ts        # 3-tier progressive context injector
    └── anti-degeneration-guard.ts           # Axiomatic filter rejecting negative self-refusals
```

---

## 4. Verification & Consequences

- **TypeScript verification**: `tsc --noEmit` completed with zero errors in the recorded run.
- **Validation record**: `scripts/validate-skill-tree-evolution.ts` executed 8 recorded suites spanning frontmatter, DAG, mutations, snapshots, guards, curator, and benchmarks.
- **Historical measurement (not an SLA)**: The 1,000-query result is a host- and workload-specific observation; no product-wide latency guarantee is made.
