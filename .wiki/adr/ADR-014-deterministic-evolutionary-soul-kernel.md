# ADR-014: Deterministic Evolutionary SOUL.md & Identity Kernel Strategy

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team & Autonomous Evolution Core
- **Date**: 2026-08-15
- **Technical Story**: Transmuting Hermes Agent's unstructured, truncating `SOUL.md` persona implementation into a typed **Evolutionary AI Agent Soul & Ethos Kernel System ($\mathcal{K}_{\text{soul}}$)** for LUMI-JOY via the AKD-DSO Osmosis Paradigm. Replaces raw string concatenations, disk thrashing, and naive blacklists with structured manifests, immutable operational axioms, bounded dynamic trait modulation, arena-backed substrate caching, line-anchored provenance verification, and multi-layered threat checks. This record does not establish ownership, novelty, or universal runtime properties.

---

## 1. Context & Motivation (The Why)

### Auditing the Teacher (`hermes-agent-main`)
The Teacher agent codebase implements persona management via a `SOUL.md` markdown file in `~/.hermes/` (or profile directory). It is injected into Slot #1 of the system prompt (`system_prompt.py`), features basic injection regex scanning (`_scan_context_content`), supports multi-profile directories (`profiles.py`), and provides web REST endpoints (`GET/PUT /api/profiles/{name}/soul`).

However, the Teacher architecture suffers from critical software friction and safety hazards:
1. **Unstructured String Blobs**: `SOUL.md` is treated as flat text without structured typed traits, core operational axioms, or dynamic trait modulation.
2. **Naive Keyword Blacklists**: Threat scanning in `_scan_context_content` relies on simple string matching easily bypassed by indirect prompt injection or Unicode masking.
3. **Destructive Truncating Writes**: Persona edits perform full file overwrites without line-anchored verification or read-before-write provenance.
4. **Filesystem Thrashing**: Disk checks during every turn cycle create file descriptor churn and race conditions across multi-session execution loops.
5. **Absence of State Rollback**: Lacks binary snapshots; persona corruption requires manual restoration from templates.

---

## 2. Architectural Decision (The What)

### 1. Structured Persona & Ethos Manifest ($\mathcal{M}_{\text{soul}}$)
Implements a typed manifest (`SoulManifest`) comprising:
- **Archetypes**: `lumi_core`, `game_engine_architect`, `formal_verifier`, `autonomous_critic`, `security_sentinel`, `custom_persona`.
- **Core Axioms ($\mathcal{A}$)**: Immutable operational invariants (e.g. Hard Determinism, Zero Fabrication, arena-backed memory, Prompt Cache Purity, Read-Before-Write) that the mutation path is designed to protect.
- **Dynamic Bounded Traits ($\mathcal{T} = \{\tau_i, \omega_i\}$)**: Adaptable personality traits (e.g. Conciseness, Code Density, Mathematical Rigor, Forensic Skepticism) with strictly enforced mathematical bounds $[\omega_{\min}, \omega_{\max}]$.
- **Style Rules**: Explicit tone, verbosity, code preferences, and mathematical rigor definitions.

### 2. Allocation-Bounded Broccolidb Memory Substrate (`BroccoliSoulSubstrate`)
- Caches active and profile-scoped soul manifests directly in memory.
- A historical local run recorded sub-microsecond lookup latency ($< 0.5\ \mu\text{s}$ per query); provider, host, workload, and runtime conditions can change the result.

### 3. Line-Anchored Forensic Mutator (`AnchoredSoulMutator`)
- Executes mutations using `AnchoredHands` with SHA-256 pre/post integrity hashing.
- Enforces strict **Read-Before-Write Provenance**: mutations fail closed unless the caller has recently inspected the target manifest at its current hash.

### 4. Checkpointed Snapshots & Indexed Rollback (`SoulSnapshotManager`)
- Captures binary state snapshots prior to every persona mutation.
- Exposes `rollbackLastMutation()` for modeled-state reversion if downstream verification fails; the implementation does not rewind external side effects.

### 5. Axiomatic Threat Guard & Injection Firewall (`SoulThreatGuard`)
- Real-time multi-layered firewall analyzing prompt text, mutation rationales, and proposed axiom additions.
- Blocks Trojan Unicode injections (`\u200B-\u200D`, `\uFEFF`, `\u202A-\u202E`, `\u{E0000}-\u{E007F}`), role-play jailbreak attacks, C2 command sequences, and unauthorized axiom contradictions.

### 6. Byte-Stable Progressive Prompt Composer (`SoulPromptComposer`)
- Pre-compiles the Slot #1 identity segment for the system prompt.
- Produces byte-stable output for the configured inputs; provider cache behavior and retention remain provider-specific.

### 7. Soul Model Tools (`SoulToolSuite`)
- `soul_view`: Inspects active soul manifest, archetype, axioms, and traits.
- `soul_tune_trait`: Dynamically tunes trait weights within validated mathematical bounds.
- `soul_audit_integrity`: Cryptographically verifies SHA-256 integrity and axiom compliance.

---

## 3. Subsystem Organization (ADR-012 Alignment)

```
src/
├── core/contracts/
│   └── soul.contracts.ts                   # Typed contracts (SoulArchetype, Axioms, Traits, Manifest)
├── tooling/extensions/soul/
│   ├── deterministic-soul-parser.ts        # Frontmatter & Trojan Unicode sanitizer, SHA-256 hashing
│   ├── anchored-soul-mutator.ts            # Line-anchored patch mutator with provenance guards
│   └── soul-tool-suite.ts                  # Model tools (soul_view, soul_tune_trait, soul_audit_integrity)
├── sessions/extensions/soul/
│   ├── broccoli-soul-substrate.ts          # allocation-bounded in-memory persona caching & profile isolation
│   └── soul-snapshot-manager.ts            # checkpointed snapshot & O(1) rollback coordinator
└── agents/extensions/soul/
    ├── soul-threat-guard.ts                # Axiomatic prompt injection firewall & threat detector
    └── soul-prompt-composer.ts             # Byte-stable Slot #1 system prompt identity compiler
```

---

## 4. Verification & Consequences

- **TypeScript verification**: `tsc --noEmit` completed with zero errors in the recorded run.
- **Validation record**: `scripts/validate-soul-kernel.ts` executed 8 recorded suites spanning frontmatter, axioms, traits, provenance, snapshots, threat guard, prompt composer, and latency benchmarks.
- **Historical measurement (not an SLA)**: The 1,000-query result is a host- and workload-specific observation; no product-wide latency guarantee is made.
