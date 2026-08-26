# Design Patterns & Workflows

Comprehensive overview of architectural design patterns and sequence workflows in `/Users/bozoegg/Desktop/LUMI-NEW`.

---

## 1. Deterministic Engine Tick Sequence

The following sequence diagram illustrates how an `EngineTickInput` prompt moves deterministically through the 3-tier architecture:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Monolith as LumiMonolith (index.ts)
    participant Engine as AgentEngine (src/agents)
    participant Session as SessionStore & Context (src/sessions)
    participant Registry as ToolRegistry (src/tooling)
    participant Sensory as Eyes / Hands / Ears (src/tooling)

    User->>Monolith: tick({ prompt })
    Monolith->>Engine: tick(input)
    Engine->>Session: compact() history check
    
    alt Intercepted slash command
        Engine->>Engine: SlashRouter.handleCommand()
        Engine-->>Monolith: EngineTickResult(outcome, isSlashCommand=true)
    else Standard game-engine tick
        Engine->>Session: incrementTurn() & addMessage(user)
        Engine->>Sensory: Ears.emit("turn_start")

        alt Local tool action
            Engine->>Registry: executeTool(name, args, cwd)
            Registry->>Registry: validateToolArgs(name, args)
            Registry->>Sensory: Hands / Eyes execution
            Sensory-->>Registry: tool result
            Registry-->>Engine: validated output
        else Live provider turn
            Engine->>Engine: dispatch provider attempt(s)
            Engine->>Engine: validate provider terminal and final response
        end

        Engine->>Engine: commit completed/failed/cancelled outcome
        Engine->>Session: addMessage(assistant response or safe guidance)
        Engine->>Sensory: Ears.emit("turn_complete", outcome)
        Engine-->>Monolith: EngineTickResult(outcome)
    end

    Monolith-->>User: frameIndex, outcome, response
```

`turn_complete` above is a post-frame protocol telemetry envelope. It reports the already-decided `EngineTickResult.outcome`; it must never be used as evidence that the provider completed successfully.

---

## 2. Key Enterprise Design Patterns

### Dependency Inversion Principle (DIP)
All high-level monolith subsystems depend on contracts and abstract base classes defined in `src/core/contracts/` and `src/core/abstracts/`:

- [IAgentEngine](../../src/core/contracts/agent.contracts.ts) $\rightarrow$ [AbstractAgentEngine](../../src/core/abstracts/abstract-agent-engine.ts)
- [ISessionStore](../../src/core/contracts/session.contracts.ts) $\rightarrow$ [AbstractSessionStore](../../src/core/abstracts/abstract-session-store.ts)
- [IHands, IEars, and IToolRegistry](../../src/core/contracts/tooling.contracts.ts)

### Template Method Pattern
The engine tick loop enforces an invariant execution sequence with overridable lifecycle hooks:

```typescript
async tick(input: EngineTickInput): Promise<EngineTickResult> {
  await this.preTick(input);            // Hook 1: Pre-tick compaction & validation
  const result = await this.executeTick(input); // Hook 2: Core tick execution
  await this.postTick(result);          // Hook 3: Post-tick telemetry emission
  return result;
}
```

### Immutable Snapshot & Time Travel Rewind Pattern
Captures complete state frames for zero-drift time travel:

```typescript
const snapshot = lumi.createSnapshot(); // Captures messages, VFS buffers, memory facts, metrics
lumi.rewindToSnapshot(snapshot);        // Rewinds frame index and store state frame-perfectly
```

---

## 3. Tool Execution via Sensory Classification

Tools are instantiated under their sensory classification ([Eyes](../../src/tooling/base/eyes.ts), [AnchoredHands](../../src/tooling/extensions/hashline/hands.ts), [ProtocolEars](../../src/tooling/extensions/telemetry/ears.ts)) and registered in [ValidatingToolRegistry](../../src/tooling/extensions/registry/tool-registry.ts):

```typescript
this.registerTool({
  name: "view_file",
  description: "Read contents of a file (Eyes)",
  parameters: {
    path: { type: "string", required: true }
  },
  execute: async (args) => this.eyes.readFile(String(args.path))
});
```

---

## 4. Protocol Telemetry & JSON-RPC Streaming

The `ProtocolEars` subsystem formats telemetry events into standard JSON-RPC 2.0 notifications:

```typescript
lumi.ears.listen("turn_complete", (event) => {
  const jsonRpcNotification = lumi.ears.formatJsonRpcEvent(event);
  console.log(`[JSON-RPC 2.0]`, jsonRpcNotification);
});
```

Protocol telemetry is an integration envelope for remote consumers. It is not the terminal activity model and must not be used as a substitute for provider lifecycle events.

---

## 5. Structured Agent Activity Lifecycle

Live model work follows an identity-based lifecycle instead of rewriting one spinner label:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as InteractiveModeController
    participant Engine as AgentEngine
    participant SDK as Codex SDK
    participant Adapter as CodexProgressAdapter
    participant Timeline as AgentActivityTimeline

    User->>UI: Submit prompt
    UI->>Engine: tick({ prompt, signal, onProgress })
    Engine->>Adapter: start()
    Engine->>SDK: thread.runStreamed(prompt, { signal })
    SDK-->>Engine: thread/turn/item events
    Engine->>Adapter: handle(event)
    Adapter-->>Timeline: sanitized EngineProgressEvent
    Timeline->>Timeline: upsert activityId; reject stale sequence
    SDK-->>Engine: item.completed(agent_message)
    Engine->>Engine: retain response candidate
    SDK-->>Engine: turn.completed or terminal failure
    alt provider completed and candidate is non-empty
        Engine->>Adapter: publish accepted turn completion
        Adapter-->>Timeline: turn-scoped completed terminal
        Engine-->>UI: EngineTickResult(outcome=completed)
    else retry remains
        Adapter-->>Timeline: attempt-scoped failed activity
        Engine->>SDK: dispatch one fallback attempt
    else cancelled or final failure
        Adapter-->>Timeline: turn-scoped failed/cancelled terminal
        Engine-->>UI: EngineTickResult(outcome=failed/cancelled)
    end
```

The reducer pattern is deliberately small:

```ts
function applyProgress(
  activities: Map<string, EngineProgressEvent>,
  event: EngineProgressEvent
): void {
  const current = activities.get(event.activityId);
  if (!current || event.sequence >= current.sequence) {
    activities.set(event.activityId, event);
  }
}
```

The important invariants are:

- Reuse an attempt-scoped provider item ID across `started`, `in_progress`, and terminal updates; preserve one stable logical turn ID across retries.
- Treat `item.completed` as authoritative only for its item. Successful turn completion requires a provider turn terminal and a validated non-empty response candidate.
- Keep retriable failures activity-scoped. Commit exactly one immutable frame outcome and require callers to read `EngineTickResult.outcome`.
- Keep local controls such as `AbortSignal` and callbacks outside serialized remote payloads.
- Show only concise, sanitized activity summaries. Never place credentials, raw command output, tool payloads, complete model responses, or hidden reasoning in progress events.
- Preserve fidelity: Codex SDK turns expose detailed item activity; API-key HTTP routes may expose only coarse request states.

The provider activity stream, individual tool executor progress, and JSON-RPC protocol telemetry are related but separate layers. See the [Agent Activity Streaming Strategy](streaming-activity-strategy.md) and [ADR-082](../adr/ADR-082-structured-agent-activity-streaming.md).

---

## 5. Autonomous Multi-Attempt Gated Execution Loop

The following sequence diagram illustrates zenith-tier attempt completion gating and self-healing multi-attempt turns without manual user intervention:

```mermaid
sequenceDiagram
    autonumber
    participant Harness as AgentLoopHarness / Engine
    participant Gate as RoadmapCompletionGate
    participant Executor as AttemptExecutor / Provider
    participant Guard as AntiOscillation & CircuitBreaker

    Harness->>Gate: executeAutonomousAttemptLoop(gateId, options)
    
    loop Attempts 1..maxAttempts
        Harness->>Guard: check circuit breaker state
        alt Circuit open
            Guard-->>Harness: fail fast (circuit breaker tripped)
        else Circuit closed
            Harness->>Executor: executeAttempt(attempt, feedback, directive)
            Executor-->>Harness: candidate response + tool outputs + errors
            
            Harness->>Gate: evaluateAttemptGate(gateId, evalContext)
            Gate->>Gate: execute dynamic criteria evaluators
            Gate->>Gate: compute attempt diff & regression metrics
            
            alt All required criteria passed
                Gate-->>Harness: allowedToProceed = true (SUCCESS)
                Harness-->>Harness: return successful outcome
            else Gating blocked
                Gate->>Gate: deriveRemediationDirective() & deriveAutonomousFeedback()
                Gate->>Guard: detectOscillation(repeatedBlockingCriteria)
                Gate-->>Harness: allowedToProceed = false + feedback + directive
                Harness->>Harness: apply adaptive backoff delay (linear/exponential/jittered)
                Harness->>Harness: escalate remediation strategy (PATCH -> REWRITE -> PIVOT)
            end
        end
    end
```

### Key Architectural Invariants

- **Differential Progression**: Attempt $N+1$ evaluates against Attempt $N$ to detect newly passing criteria vs regressions (`newlyFailing`).
- **Cognitive Remediation Directives**: Directives specify concrete action steps rather than vague error messages.
- **Anti-Oscillation Protection**: Prevents flip-flopping across repeating failure cycles.
- **Circuit Breaker Governance**: Protects against runaway token burn during persistent environment failures.

See [ADR-084](../adr/ADR-084-attempt-completion-gate-strategy.md) for detailed specifications.

---

## 6. GALX AI Wholesale Transport & Cryptographic Receipt Workflow

The following sequence illustrates the RFC-hardened transport and Merkle hash-chained delivery receipt generation for wholesale LLM compute clearinghouse requests:

```mermaid
sequenceDiagram
    autonumber
    participant Agent as AgentEngine / Resolver
    participant Engine as GalxProviderEngine
    participant Client as GalxTransportClient
    participant Substrate as BroccoliTransportSubstrate
    participant Edge as GALX Clearinghouse Edge (galx.ai/v1)

    Agent->>Engine: prepareRequestPayload(modelId, messages, tools)
    Engine->>Client: post("/chat/completions", payload, { idempotencyKey })
    Client->>Substrate: enqueueOutbox(path, payload) (Write-Ahead Ledger)
    Client->>Client: computeDigests(jsonBody) (RFC 9530 / RFC 3230)
    Client->>Client: generateSignatureHeaders(RFC 9421 HMAC-SHA256)
    Client->>Substrate: generateDPoPProof(method, url, accessToken) (RFC 9449)
    Client->>Client: acquireRateToken() (Token Bucket Governor)
    Client->>Edge: HTTPS POST with Digest, Signature, DPoP, X-GALX-Client
    Edge-->>Client: 200 OK + Stream/Completion Payload + Trace Headers
    Client->>Substrate: sealReceipt(entryId, response, routingMeta)
    Substrate->>Substrate: compute Merkle hash chain & rolling SLA percentiles (P50/P90/P99)
    Client-->>Engine: GalxTransportResponse(success, data, durationMs, traceId)
    Engine-->>Agent: Parsed LLM completion + Token Cost
```

See [ADR-147](../adr/ADR-147-galx-ai-provider-integration-and-auxiliary-provider-consolidation.md) for detailed specifications.

