# True 1-to-1 Package Mapping Matrix: `pi-main` vs `LUMI-NEW`

This document provides a formal, industry-standard 1-to-1 technical mapping between the 18 packages in the Teacher Model ([pi-main](file:///Users/bozoegg/Downloads/pi-main/packages)) and their reinvented monolithic implementations in the Student Model ([LUMI-NEW](file:///Users/bozoegg/Desktop/LUMI-NEW/src)).

---

## 1. Monorepo vs Monolith Mapping Summary

```
   TEACHER MONOREPO PACKAGES (pi-main)               STUDENT MONOLITH SUBSYSTEMS (LUMI-NEW)
   ══════════════════════════════════               ══════════════════════════════════════
   packages/hashline          ───────────►          AnchoredHands.applyAnchoredEdit() (src/tooling)
   packages/omptype           ───────────►          ValidatingToolRegistry.validateToolArgs() (src/tooling)
   packages/session-backends  ───────────►          PersistentSessionStore.saveToFile() (src/sessions)
   packages/protocol         ───────────►          ProtocolEars.formatJsonRpcEvent() (src/tooling)
   packages/snapcompact       ───────────►          SessionCompactor.compact() (src/sessions)
   packages/telemetry         ───────────►          ProtocolEars.startTimer() / endTimer() (src/tooling)
   packages/coding-agent      ───────────►          AgentEngine, InteractiveModeController & LumiMonolith
   packages/ai                ───────────►          ModelResolver & CodexProgressAdapter (src/agents)
   packages/tui               ───────────►          TuiAltScreen & AgentActivityTimeline (src/tui)
   packages/broccolidb        ───────────►          BroccoliDatabaseKernel (Hybrid WAL + CAS + Reactive Tables - ADR-120)
   packages/codemarie         ───────────►          AstPerceptionEyes (AST Symbol Perception - Pass 7)
```

---

## 2. Detailed 1-to-1 Technical Specifications

### Package 1: `packages/hashline` $\longrightarrow$ `AnchoredHands.applyAnchoredEdit()`

- **Teacher Package Path**: `/Users/bozoegg/Downloads/pi-main/packages/hashline`
- **Teacher Signature**: `applyLineDelta(filePath: string, line: number, expectedHash: string, newContent: string)`
- **Student Implementation**: [AnchoredHands.applyAnchoredEdit()](../../src/tooling/extensions/hashline/hands.ts) in `src/tooling/extensions/hashline/hands.ts`
- **Code-Level Comparison**:

```typescript
// Teacher (pi-main/packages/hashline): Multi-file AST hash parser dependency
import { xxhash3 } from "xxhash-wasm";
export async function applyLineDelta(file, line, hash, content) { ... }

// Student (LUMI-NEW/src/tooling/extensions/hashline/hands.ts): Clean, zero-dependency bitwise line hash
static computeLineHash(lineContent: string): string {
  let hash = 0;
  const str = lineContent.trim();
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash).toString(16)}`;
}
```

- **Architectural Rationale**: Replaced heavy WebAssembly `xxhash-wasm` dependency with pure bitwise hashing (`computeLineHash`) running in native Node strip-only mode without async WASM loading overhead.

---

### Package 2: `packages/omptype` $\longrightarrow$ `ValidatingToolRegistry.validateToolArgs()`

- **Teacher Package Path**: `/Users/bozoegg/Downloads/pi-main/packages/omptype`
- **Teacher Signature**: `parseAndValidateSchema(schema: OmpSchema, data: unknown): ValidationResult`
- **Student Implementation**: [ValidatingToolRegistry.validateToolArgs()](../../src/tooling/extensions/registry/tool-registry.ts) in `src/tooling/extensions/registry/tool-registry.ts`
- **Code-Level Comparison**:

```typescript
// Teacher (pi-main/packages/omptype): Multi-file JSON Schema validator with complex error formatters
export function validate(schema, args) { /* 300+ lines across 4 files */ }

// Student (LUMI-NEW/src/tooling/extensions/registry/tool-registry.ts): Direct runtime schema validator
validateToolArgs(name: string, args: Record<string, unknown>): SchemaValidationResult {
  const tool = this.tools.get(name);
  if (!tool || !tool.parameters) return { valid: true, errors: [] };
  const errors: string[] = [];
  for (const [paramName, schema] of Object.entries(tool.parameters)) {
    const val = args[paramName];
    if (schema.required && (val === undefined || val === null || val === "")) {
      errors.push(`Missing required parameter '${paramName}'`);
    }
  }
  return { valid: errors.length === 0, errors };
}
```

- **Architectural Rationale**: Integrated parameter schema validation directly into tool execution dispatch (`executeTool`), blocking invalid model invocations before tool execution.

---

### Package 3: `packages/session-backends` $\longrightarrow$ `PersistentSessionStore`

- **Teacher Package Path**: `/Users/bozoegg/Downloads/pi-main/packages/session-backends`
- **Teacher Signature**: `JsonlSessionBackend.save(session: SessionData): Promise<void>`
- **Student Implementation**: [PersistentSessionStore.saveToFile()](../../src/sessions/extensions/persistence/session-store.ts) in `src/sessions/extensions/persistence/session-store.ts`
- **Code-Level Comparison**:

```typescript
// Student (LUMI-NEW/src/sessions/extensions/persistence/session-store.ts):
export class PersistentSessionStore extends AbstractSessionStore {
  exportJsonl(): string {
    return this.messages.map((msg) => JSON.stringify(msg)).join("\n");
  }
  async saveToFile(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, this.exportJsonl(), "utf-8");
  }
}
```

- **Architectural Rationale**: Consolidated JSONL serialization directly into `PersistentSessionStore`, preserving `createSnapshot()` and `rewindToSnapshot()` compatibility.

---

### Package 4: `packages/protocol` $\longrightarrow$ `ProtocolEars.formatJsonRpcEvent()`

- **Teacher Package Path**: `/Users/bozoegg/Downloads/pi-main/packages/protocol`
- **Teacher Signature**: `createNotification(method: string, params: object): JsonRpcNotification`
- **Student Implementation**: [ProtocolEars.formatJsonRpcEvent()](../../src/tooling/extensions/telemetry/ears.ts) in `src/tooling/extensions/telemetry/ears.ts`
- **Code-Level Comparison**:

```typescript
// Student (LUMI-NEW/src/tooling/extensions/telemetry/ears.ts):
formatJsonRpcEvent(event: ToolingEvent): JsonRpcNotification {
  return {
    jsonrpc: "2.0",
    method: `telemetry/${event.type}`,
    params: {
      event: event.type,
      source: event.source,
      payload: event.payload,
      timestamp: event.timestamp,
      durationMs: event.durationMs,
    },
  };
}
```

- **Architectural Rationale**: Wrapped event telemetry inside standard JSON-RPC 2.0 notification payloads, allowing external IDEs and UIs to stream performance events cleanly.

---

## 3. Package Coverage Index

| Teacher Package in `pi-main` | Functional Role | LUMI-NEW Equivalent | Status |
|---|---|---|---|
| `packages/hashline` | Anchored line delta editing | `AnchoredHands.applyAnchoredEdit()` | **Absorbed** |
| `packages/omptype` | Tool parameter schema validation | `ValidatingToolRegistry.validateToolArgs()` | **Absorbed** |
| `packages/session-backends` | File persistence (JSONL) | `PersistentSessionStore.saveToFile()` | **Absorbed** |
| `packages/protocol` | Telemetry event protocol | `ProtocolEars.formatJsonRpcEvent()` | **Absorbed** |
| `packages/snapcompact` | History context compactor | `SessionCompactor.compact()` | **Absorbed** |
| `packages/telemetry` | Microsecond execution timing | `ProtocolEars.startTimer()` / `endTimer()` | **Absorbed** |
| `packages/coding-agent` | Core agent loop, interactive mode, cancellation | `AgentEngine`, `InteractiveModeController` & `LumiMonolith` | **Absorbed** |
| `packages/ai` | Model resolution and provider event lifecycle | `ModelResolver`, `CodexProviderBridge` & `CodexProgressAdapter` | **Absorbed** |
| `packages/broccolidb` | Slab array memory & database kernel | `BroccoliDatabaseKernel`, `BroccoliDbTable`, `BroccoliWriteAheadLog`, `BroccoliCASStorageService` (ADR-120) | **Absorbed** |
| `packages/codemarie` | AST structural symbol search | `AstPerceptionEyes` | **Absorbed** |
| `packages/tui` | Differential terminal rendering and persistent agent activity | `TuiAltScreen` & `AgentActivityTimeline` | **Absorbed** |

### Current Streaming Refinement

The original `packages/protocol` mapping remains responsible for JSON-RPC telemetry envelopes. User-facing live model activity is a separate execution concern governed by [ADR-082](../adr/ADR-082-structured-agent-activity-streaming.md): `CodexProgressAdapter` translates provider events into `EngineProgressEvent`, and `AgentActivityTimeline` performs identity-based upserts. This separation prevents telemetry framing, provider semantics, and terminal presentation from collapsing into one formatter.
