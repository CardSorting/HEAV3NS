# ADR-012: Non-Destructive Osmosis Class Extension & Mutation Directory Strategy

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Establishing an explicit Non-Destructive Class Extension & Mutation Directory Strategy across all evolutionary passes absorbed from `pi-main` and `packages/codemarie`. Enforces single-responsibility extension classes organized within domain-scoped mutation subdirectories (`src/*/extensions/<mutation-domain>/`).

---

## 1. Context & Motivation (The Why)

### Protecting Subsystem Integrity & Preventing Overwrites
As `/Users/bozoegg/Desktop/LUMI-NEW` evolves across sequential passes (Pass 1 through Pass 14+), absorbing features directly into existing base files (`eyes.ts`, `ears.ts`, `session-store.ts`) introduces structural drift, risks overwriting previous pass implementations, and breaks single-responsibility separation.

To ensure long-term architectural stability:
1. **Base Classes Are Immutable**: Foundational domain contracts and base classes in `src/*/base/` remain pure and unchanged.
2. **Mutation Subdirectory Organization**: Extension files are grouped into domain-scoped mutation subdirectories inside `src/*/extensions/` (e.g., `substrate/`, `perception/`, `progress/`, `persistence/`, `mentions/`).
3. **Additive Single-Responsibility Extensions**: Each pass creates a dedicated extension file in its mutation subdirectory (e.g., `src/tooling/extensions/perception/ast-eyes.ts`, `src/sessions/extensions/substrate/arena-allocator.ts`).
4. **Dependency Inversion Composition**: Container factories (`MonolithFactory`) and composition roots (`LumiMonolith`) compose these extension classes without mutating base implementations.

---

## 2. Architectural Decision (The What)

### Mutation-Organized Subsystem Directory Hierarchy

```
src/
├── core/                                # Contracts & Abstracts
│   ├── contracts/                       # Interfaces & Snapshots
│   └── abstracts/                       # Abstract Base Classes (DIP)
│
├── agents/                              # Tier 1: Agents Subsystem
│   ├── base/                            # Agent Base Config
│   └── extensions/                      # Mutation Subdirectories
│       ├── compaction/                  # Pass 1: prompt-composer.ts
│       ├── resolution/                  # Pass 2: model-resolver.ts, agent-slash-router.ts
│       ├── execution/                   # AKD-DSO: agent-engine.ts
│       ├── mentions/                    # Pass 9: mention-resolver.ts
│       └── swarm/                       # Pass 11: agent-swarm-dispatcher.ts
│
├── sessions/                            # Tier 2: Sessions Subsystem
│   ├── base/                            # Session Base Context
│   └── extensions/                      # Mutation Subdirectories
│       ├── compaction/                  # Pass 1: session-compactor.ts
│       ├── vfs/                         # Pass 3: session-vfs.ts
│       ├── memory/                      # Pass 4: session-memory-store.ts
│       ├── persistence/                 # Pass 5: session-store.ts
│       ├── substrate/                   # Pass 6: arena-allocator.ts
│       └── integrity/                   # Pass 12: stability-doctor.ts
│
└── tooling/                             # Tier 3: Tooling Subsystem
    ├── base/                            # Base Domain (eyes.ts)
    └── extensions/                      # Mutation Subdirectories
        ├── hashline/                    # Pass 5: hands.ts
        ├── registry/                    # Pass 5: skills-ingestor.ts, tool-registry.ts
        ├── telemetry/                   # Pass 5: ears.ts
        ├── perception/                  # Pass 7: ast-eyes.ts
        ├── progress/                    # Pass 8: progress-ears.ts
        ├── policy/                      # Pass 10: module-decomposer.ts
        └── permissions/                 # Pass 14: command-permission-controller.ts
```

---

## 3. Technical Implementation (The How)

### Additive Extension & Monolith Factory Composition

```typescript
// Subclass extension in src/tooling/extensions/perception/ast-eyes.ts
export class AstPerceptionEyes extends Eyes {
  async searchSymbols(dirPath: string, query: string): Promise<SymbolSearchResult[]> { ... }
}

// Subclass extension in src/tooling/extensions/progress/progress-ears.ts
export class ProgressStreamingEars extends ProtocolEars {
  emitProgress(label: string, percent = 0): JsonRpcNotification { ... }
}

// Subclass extension in src/sessions/extensions/substrate/arena-allocator.ts
export class ArenaAllocator { ... }

// Monolith Factory Composition Root
const eyes = new AstPerceptionEyes();
const ears = new ProgressStreamingEars();
const sessionStore = new PersistentSessionStore();
```

---

## 4. Verification

- **Type Safety**: `npm run check` passed cleanly with 0 type errors.
- **Runtime Composition**: `npm start` (`npx tsx src/index.ts`) verified clean composition of `AstPerceptionEyes` and `ProgressStreamingEars` with zero regressions.
