# ADR-015: Swarm Subagent Task Delegation (`codemarie`)

- **Status**: Accepted
- **Deciders**: LUMI Architectural Team
- **Date**: 2026-08-09
- **Technical Story**: Absorbing swarm mutex locks and subagent task delegation from teacher package `/Users/bozoegg/Downloads/pi-main/packages/codemarie/src/core/swarm/SwarmMutexService.ts` into `/Users/bozoegg/Desktop/LUMI-NEW` via the **Osmosis Strategy** (Pass 11).

---

## 1. Context & Motivation (The Why)

When complex user prompts require multi-step parallel investigation or isolated sub-tasks, a single session loop can pollute main turn context history.

To enable safe parallel execution without state corruption or lock contention:
1. **Isolated Subagent Session Forking**: Spawns a child `LumiMonolith` session pre-initialized with an immutable parent `GameStateSnapshot`.
2. **Atomic Fencing Locks**: Manages resource leases (`acquireLock`, `releaseLock`) with fencing tokens to prevent subagents from racing on workspace state.

---

## 2. Architectural Decision (The What)

### Non-Destructive Extension & Swarm Mutation Subdirectory (`ADR-012`)

Following **ADR-012**:
1. Created `AgentSwarmDispatcher` in `src/agents/extensions/swarm/agent-swarm-dispatcher.ts`.
2. Implemented `delegateSubagentTask(taskPrompt, parentEngine)` using `LumiMonolith.forkSession()`.
3. Composed `AgentSwarmDispatcher` cleanly inside `MonolithFactory` and `LumiMonolith`.

---

## 3. Technical Implementation (The How)

```typescript
export class AgentSwarmDispatcher {
  acquireLock(resourceKey: string, ownerId: string, ttlMs?: number): SwarmLease { ... }
  releaseLock(resourceKey: string, lockId: string): boolean { ... }

  async delegateSubagentTask(
    taskPrompt: string,
    parentEngine: LumiMonolith,
    subagentId?: string
  ): Promise<SwarmSubagentTaskResult> { ... }
}
```

---

## 4. Verification

- **Type Verification**: `npm run check` passed clean with 0 type errors.
- **Engine Integration**: `npm start` (`npx tsx src/index.ts`) verified clean subagent forking, fencing lock acquisition/release, and response return during frame tick execution.
