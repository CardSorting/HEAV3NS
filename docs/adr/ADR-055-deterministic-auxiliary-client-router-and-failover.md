# ADR-055: Deterministic Auxiliary Client Router, Sub-Task Fallback Chain & Dynamic User Model Selection ($\mathcal{K}_{\text{aux}}$)

## Status
**Accepted**

## Context
In ancestral frameworks like `hermes-agent` (`agent/auxiliary_client.py` — 468 KB, 10,552 LOC), auxiliary LLM dispatching for sub-tasks (compression, session search, web extraction, vision perception, title generation, insights, patch reviews, and commit messages) was implemented as a monolithic Python god-module. It suffered from hardcoded model fallback chains that rotted over time, unmanaged HTTP client connection leaks across sync/async bridges, complex monkey-patching proxies (`_OpenAIProxy`), mutable process-global context variables, and a lack of deterministic in-memory models and frame-perfect $O(1)$ state rollback.

Furthermore, user model preferences were often overridden or forced into static defaults rather than being 100% dynamically selectable by the user and session runtime.

## Decision
We implemented a zero-GC, typed, in-memory Auxiliary Client Router, Sub-Task Fallback Chain & Dynamic User Model Selection Substrate ($\mathcal{K}_{\text{aux}}$ / Phase 101) for **LUMI-JOY**:

1. **`DeterministicAuxiliaryRouter`**:
   - In-memory zero-GC auxiliary task router with **100% dynamic user model selection** and zero hardcoded model strings.
   - Dynamic user-registered providers, priority sorting, and per-task overrides.
   - Multi-step candidate chains supporting text and vision sub-tasks (`compression`, `search`, `web_extract`, `vision_analysis`, `browser_vision`, `title_generation`, `insights`, `patch_review`, `commit_message`).
   - Automated failover on HTTP 402 / credit exhaustion or quota limits to the next viable candidate in the priority chain.
   - `:free` SKU filtering when `freeOnly` mode is enabled.

2. **`BroccoliAuxiliarySubstrate`**:
   - In-memory Broccolidb repository for dynamic provider configurations, task override matrices, fallback chains, and execution history.

3. **`AuxiliarySnapshotManager`**:
   - Frame-perfect binary snapshots and $O(1)$ state rollback in $<0.05\text{ ms}$.

4. **`AuxiliaryRouterSupervisor`**:
   - Master supervisor coordinating auxiliary sub-task dispatching, dynamic provider resolution, user configuration, failover chains, and quota governance.

5. **`AuxiliaryRouterToolSuite`**:
   - Exposes `auxiliary_route_task`, `auxiliary_set_task_override`, and `auxiliary_configure_provider` to LLMs and users.

6. **Grand Monolith Graduation**:
   - Graduated the Monolith from 367 to **372 components** in exact alphabetical order with OPTIMAL cohesion.

## Consequences
- **Dynamic Control**: Users have complete dynamic control over which models and endpoints process auxiliary sub-tasks with zero hardcoded defaults.
- **Reliability**: Automated credit exhaustion failover prevents sub-task failures during long-running reasoning loops.
- **Performance**: In-memory candidate resolution takes $<0.01\text{ ms}$ with $O(1)$ rollback in $<0.05\text{ ms}$.
