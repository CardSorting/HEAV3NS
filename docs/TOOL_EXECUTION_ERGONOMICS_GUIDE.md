# 🛠️ LUMI Tool Execution Ergonomics & Subsystem Reference Guide

This document is the authoritative technical reference for the **Apex-Tier Tool Execution Subsystem** in **LUMI-JOY**. It details the multi-provider wire serialization, 4-pass self-healing argument parser, parallel concurrency scheduler, microsecond read caching, topological DAG execution planner, sentinel safety gatekeepers, atomic mutation journals, and error-aware log summarizer.

---

## 1. 🌟 Architectural Overview & Design Philosophy

Traditional AI agent frameworks treat tool execution as naive RPC calls:
1. **Single-Provider Lock-In**: Codebases are tightly coupled to OpenAI Function Calling or Anthropic Tool Use.
2. **Brittle Argument Parsing**: Malformed markdown fences (` ```json `), Python boolean literals (`True`/`False`), or trailing commas cause unrecoverable turn crashes.
3. **Serial I/O Latency**: Read-only tools execute sequentially, compounding network and disk latency.
4. **Hallucination Runaways**: Models trapped in loops repeat failing tool calls indefinitely.
5. **Context Token Bloat**: Exposing verbose JSON schemas across 1,600+ tools exhausts context limits.

LUMI resolves these challenges with a **5-Layer Deterministic Tool Execution Engine**:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│              APEX-TIER TOOL EXECUTION & ERGONOMICS ARCHITECTURE                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Layer 1: Universal Serialization & Wire Format Adapters                         │
│   ├── ToolSchemaSerializer (OpenAI Strict, Anthropic, Gemini, MCP)              │
│   ├── UniversalToolCallAdapter (OpenAI tool_calls, Anthropic tool_use, Gemini)  │
│   └── ToolChoicePolicyOrchestrator (auto, required, forced, system fallback)    │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Layer 2: Resilient Argument Parsing & Dynamic Discovery                         │
│   ├── ToolCallArgParser (Multi-Pass Strip Fences, Python Literals, Auto-Repair) │
│   ├── ToolSemanticIndex (In-Memory Robertson-Spärck Jones BM25 & Synonyms)      │
│   ├── ToolSchemaCompressor (43% Token Minified Parameter Schemas)               │
│   └── Model Discovery Tools (search_tools_catalog, explain_tool_parameters)     │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Layer 3: Composable Middleware Execution Pipeline Stack                         │
│   ├── ToolPipelineMiddlewareChain (Onion Interceptor Architecture)              │
│   ├── ToolSpeculativePrefetcher (Background Read Warming & Microsecond Hits)    │
│   └── ToolExecutionCache (Deterministic SHA-256 Keying & Path Invalidation)     │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Layer 4: Parallel Scheduling & Topological DAG Execution                        │
│   ├── ToolExecutionScheduler (Concurrent Read Waves: ~2.9x Speedup)             │
│   └── ToolDependencyGraphPlanner (Kahn's Topological Sort & Piped Args: $node1)│
├─────────────────────────────────────────────────────────────────────────────────┤
│ Layer 5: Output Intelligence, Sentinel Safety & Atomic Rollback Substrate       │
│   ├── ToolOutputGovernor & ToolOutputSummarizer (Error Extraction & Spill Vault)│
│   ├── ToolConfirmationGatekeeper & ToolSafetyPolicyManager (Dry-Run Simulation) │
│   ├── ToolLoopBreaker (Sliding Ring Buffer Call Deduplication & Self-Correction)│
│   ├── MultiFileAtomicPatchOrchestrator (Zero-Disk Mutation Mismatch Abort)      │
│   ├── ToolTelemetryLedger (Execution p50/p95 Percentiles & Error Rates)         │
│   └── ToolTransactionJournal (Atomic Inverse Rollbacks: rollback_last_mutation) │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 🔌 Universal Multi-Provider Serialization & Wire Protocols (ADR-138)

Every tool in LUMI is defined using a clean, typed `ToolDefinition` interface. The `ToolSchemaSerializer` and `UniversalToolCallAdapter` translate declarations and wire payloads losslessly across all major LLM providers:

### Supported Provider Formats
- **OpenAI & OpenRouter**: Serializes into `{ type: "function", function: { name, description, parameters, strict: true } }`. Invocations parse from `tool_calls: [{ id, function: { name, arguments } }]`.
- **Anthropic Claude**: Serializes into `{ name, description, input_schema }`. Invocations parse from `content: [{ type: "tool_use", id, name, input }]`.
- **Google Gemini**: Serializes into `{ functionDeclarations: [{ name, description, parameters }] }`. Invocations parse from `functionCalls: [{ name, args }]`.
- **Model Context Protocol (MCP)**: Serializes into standard `{ name, description, inputSchema }`.

```typescript
import { ToolSchemaSerializer } from "./src/tooling/extensions/registry/tool-schema-serializer.js";

const serializer = new ToolSchemaSerializer();
const openAISchema = serializer.toOpenAIFunction(myTool, { strict: true });
const anthropicSchema = serializer.toAnthropicTool(myTool);
const geminiSchema = serializer.toGeminiFunctionDeclaration(myTool);
```

---

## 3. 🛡️ 4-Pass Self-Healing Argument Parser (`ToolCallArgParser`)

When LLMs invoke tools, arguments often contain syntax irregularities. Rather than failing the turn, `ToolCallArgParser` passes arguments through a 4-stage recovery pipeline:

1. **Pass 1: Markdown Fence Stripper**: Removes markdown code blocks (` ```json ... ``` `), unescapes raw newlines, and trims leading/trailing whitespace.
2. **Pass 2: Python Literal & Syntax Auto-Repair**: Converts Python literals (`True` -> `true`, `False` -> `false`, `None` -> `null`), replaces unquoted single quotes, fixes trailing commas, and balances missing closing braces.
3. **Pass 3: JSON Substring Extractor**: Employs a brace-matching state machine to extract embedded JSON objects when models interleave conversational text with JSON payloads.
4. **Pass 4: Primitive Type Coercer & Alias Normalizer**: Coerces stringified numbers (`"10"` -> `10`), booleans (`"true"` -> `true`), normalizes parameter aliases (`filePath` -> `path`, `cmd` -> `command`), and parses stringified JSON arrays.

If an argument remains invalid after all 4 passes, `ToolErrorAutoHealer` generates an **actionable prompt advisory** detailing the exact schema mismatch and remediation guidance for the model to self-correct on the next tick.

---

## 4. ⚡ Parallel Wave Scheduling & In-Memory Caching (ADR-139)

### Parallel Concurrency Scheduling (`ToolExecutionScheduler`)
When an agent requests multiple tool calls in a single turn, the scheduler partitions the batch into sequential waves:
- **Concurrent Read Waves**: Read-only tools (`view_file`, `grep_search`, `list_dir`, `file_info`) are executed simultaneously via `Promise.allSettled`, yielding a **~2.9x concurrency speedup**.
- **Serialized Mutation Waves**: Mutating tools (`write_file`, `replace_file_content`, `delete_file`) are executed sequentially with transactional barrier locks to prevent race conditions.

### Microsecond Read Caching (`ToolExecutionCache`)
- Computes deterministic SHA-256 argument hashes: $\text{key} = \text{SHA256}(\text{toolName} \parallel \text{cwd} \parallel \text{sortedArgs})$.
- Serves read hits in **`< 0.01 ms`**.
- **Mutation-Driven Invalidation**: Any file write, edit, or deletion extracts the affected file path and automatically purges all cached entries for that path and its containing directories.

---

## 5. 🛑 Sentinel Runtime Safety & Transactional Rollbacks (ADR-140)

### 3-Tier Threat Evaluation & Safety Policies (`ToolSafetyPolicyManager`)
- **`SAFE`**: Read operations and metadata lookups; executed immediately.
- **`MUTATING`**: Non-destructive filesystem edits; recorded in transaction journal.
- **`CRITICAL`**: Destructive shell patterns (`rm -rf /`, `git reset --hard`, database drops, edits to `.git/config` or `.env.production`); blocked or gated behind interactive confirmation.
- **Dry-Run Simulation**: Passing `isDryRun: true` executes the tool in simulation mode, generating non-destructive diffs without modifying disk.

### Consecutive Hallucination Loop Breaker (`ToolLoopBreaker`)
Tracks tool signatures in a sliding ring buffer. If **3 consecutive calls** share identical arguments without making progress, the loop breaker pauses execution and feeds a self-correcting prompt advisory to the model.

### Atomic Mutation Journal & Rollback (`ToolTransactionJournal`)
- Snapshots previous file contents prior to disk modifications.
- Tracks newly created and deleted files.
- Exposes `rollback_last_mutation` and `rollbackTurn()` for instantaneous state restoration in **`< 0.05 ms`**.

### Multi-File Atomic Patch Orchestrator (`MultiFileAtomicPatchOrchestrator`)
Pre-validates all search-and-replace target chunks across all files in a single transaction. If any chunk mismatches, **zero files are modified on disk**, preventing broken intermediate states.

---

## 6. 🧅 Composable Onion Middleware Pipeline Stack (ADR-141)

Cross-cutting concerns are organized into a clean, typed Onion middleware chain:

```typescript
import { ToolPipelineMiddlewareChain } from "./src/tooling/extensions/execution/tool-pipeline-middleware.js";

const chain = new ToolPipelineMiddlewareChain();

chain.use({
  name: "telemetry-interceptor",
  async execute(context, next) {
    const start = Date.now();
    try {
      const result = await next();
      console.log(`Tool ${context.toolName} took ${Date.now() - start}ms`);
      return result;
    } catch (err) {
      console.error(`Tool ${context.toolName} failed:`, err);
      throw err;
    }
  },
});
```

---

## 7. 🗺️ Topological Dependency DAG Execution Planner (`ToolDependencyGraphPlanner`)

Supports multi-tool turn workflows with data pipelines (e.g. searching for a file, then passing the discovered path to `view_file`):

```typescript
const dagNodes = [
  { id: "search", toolName: "find_files", args: { pattern: "*.config.ts" }, dependencies: [] },
  { id: "inspect", toolName: "view_file", args: { path: "$search.result[0]" }, dependencies: ["search"] },
];

const records = await dagPlanner.executeDAG(dagNodes, cwd, registry);
```

- **Topological Wave Partitioning**: Executes independent nodes concurrently in waves.
- **Dynamic Argument Piping**: Substitutes `$nodeId.result.path` placeholders with upstream results.
- **Cycle Detection**: Validates DAG acyclicity with Kahn's algorithm before dispatch.

---

## 8. 🔍 Model-Facing Tool Discovery & Introspection Tools

| Built-in Tool | Description | Category |
| :--- | :--- | :--- |
| **`search_tools_catalog`** | Search all 1,600+ tools using in-memory BM25 semantic scoring and keyword ranking. | Discovery |
| **`explain_tool_parameters`** | Introspect complete JSON schema definitions, types, constraints, and examples for any tool. | Discovery |
| **`rollback_last_mutation`** | Atomically undo the most recent file mutation or all mutations in the current turn. | Journal |
| **`atomic_multi_file_patch`** | Atomically apply search-and-replace patches across multiple files with zero-disk mutation on mismatch. | Hands |
| **`get_tool_telemetry`** | Inspect p50/p95 latency percentiles, throughput, and error rates per tool. | Telemetry |
| **`summarize_tool_output`** | Elevate compiler errors and stack traces while compressing progress spinners and noise. | Summarizer |

---

## 9. 🧪 Deterministic Mock Sandbox & Replay Harness (`ToolMockHarness`)

Enables offline testing, benchmark evaluation, and record/replay fixtures without touching physical disks:

```typescript
import { ToolMockHarness } from "./src/tooling/extensions/execution/tool-mock-harness.js";

const harness = new ToolMockHarness();

// 1. Programmatic Mocking
harness.mockTool("fetch_remote_data", async (args) => ({ status: 200, data: [1, 2, 3] }));

// 2. Record Mode
harness.setMode("record");
// Executions automatically write fixtures to recordedFixtures array

// 3. Replay Mode
harness.setMode("replay");
harness.loadFixtures(savedFixtures);
// Matching tool calls replay instantly from recorded fixtures
```

---

## 10. 📊 Complete Verification & SLA Benchmarks

| Benchmark Metric | Target SLA | Measured Value | Verification Suite |
| :--- | :--- | :--- | :--- |
| **Tool Execution Concurrency Speedup** | $\ge 2.0\times$ speedup | **`2.91x speedup`** | [`scripts/validate-apex-tool-execution-pipeline.ts`](../scripts/validate-apex-tool-execution-pipeline.ts) |
| **Read Cache Lookup Latency** | $< 0.05\text{ ms}$ | **`< 0.01 ms`** | [`scripts/validate-apex-tool-execution-pipeline.ts`](../scripts/validate-apex-tool-execution-pipeline.ts) |
| **Schema Token Compression Ratio** | $\ge 35\%\text{ savings}$ | **`43.9% token savings`** | [`scripts/validate-apex-tool-middleware-engine.ts`](../scripts/validate-apex-tool-middleware-engine.ts) |
| **State Rewind Latency** | $< 0.10\text{ ms p95}$ | **`0.022 ms p95`** | [`scripts/validate-apex-tool-ecosystem-zenith.ts`](../scripts/validate-apex-tool-ecosystem-zenith.ts) |
| **Ergonomics & Schema Suite** | $6/6\text{ tests}$ | **`6/6 passed (100%)`** | [`scripts/validate-tool-calling-ergonomics.ts`](../scripts/validate-tool-calling-ergonomics.ts) |
| **Sentinel Safety Suite** | $7/7\text{ tests}$ | **`7/7 passed (100%)`** | [`scripts/validate-apex-tool-runtime-sentinel.ts`](../scripts/validate-apex-tool-runtime-sentinel.ts) |
| **DAG & Mock Engine Suite** | $6/6\text{ tests}$ | **`6/6 passed (100%)`** | [`scripts/validate-apex-tool-dag-engine.ts`](../scripts/validate-apex-tool-dag-engine.ts) |
| **QoL I/O Authority Suite** | $78/78\text{ tests}$ | **`78/78 passed (100%)`** | [`scripts/validate-qol-enhancements.ts`](../scripts/validate-qol-enhancements.ts) |
| **TypeScript Type Checking** | $0\text{ errors}$ | **`0 errors (tsc --noEmit)`** | `npm run check` |
| **Documentation Integrity** | $100\%\text{ valid links}$ | **`409/409 files valid`** | `scripts/validate-documentation.ts` |
