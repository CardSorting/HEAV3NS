# ROADMAP.md

## 1. Project Center of Gravity

**Core Purpose:** Help developers finish reviewable work quickly in a calm, local-first terminal agent.

**Primary Users / Operators:** Developers and their coding agents, especially during long tasks with multiple tools and dependencies.

**Canonical Architecture:** The CLI/TUI presents task state. ExecutionFunnel owns tool admission and execution; TaskLifecycleFunnel owns lifecycle decisions. RoadmapService owns workspace steering, with ROADMAP.md as the human-readable checkpoint.

**Canonical Workflows:** Understand the task → execute authorized work → verify outcomes → explain what changed → roll the checkpoint forward. Continue independent work while a dependency waits.

**Primary Runtime / Operational Center:** `src/index.ts`, `src/core/task/`, `src/tui/`, and `src/services/roadmap/`. Runtime evidence and persisted workspace state explain progress; prose alone cannot establish completion.

**What This Project Must Not Become:** Competing schedulers, invisible permission expansion, repeated audit loops, or a checklist that declares unverified work complete.

## 2. Roadmap Health

**Status:** Recovering

**Summary:** Established execution and roadmap systems now have a concrete QoL direction. Four implementation passes cover validation recovery, priority fairness, cooperating-writer persistence, evidence isolation, and clearer roadmap/task activity views. A reproducible local mixed-I/O baseline is recorded; broader task-state UX and real workflow latency remain open.

**Why This Status:**
- Root ROADMAP.md now directs a small, evidence-backed active queue and rolls at meaningful checkpoints.
- Remediation rollback incorrectly manufactured schema validity; cached validation could strand a fresh mutation. Both now have regression coverage.
- Parent I/O already has cancellation and per-class caps; bounded priority overtaking now protects older eligible work.

**Primary Risk:** Arbitrary external editors do not participate in the persistence lock. Pre-publish conflict checks detect changed bases, but the filesystem does not provide an atomic compare-and-swap against an uncooperative writer.

**Primary Opportunity:** Make every task expose its outcome, current state, blocker, and one concrete next action through existing surfaces.

## 3. Strategic Narrative

HEAV3NS should feel predictable during execution and easy to review at completion. Work should continue where it can, stop exactly where required, and explain what would unblock it. Speed comes from fewer redundant operations, bounded concurrency, and useful work during waits.

Familiar references guide behavior: [Linear cycles](https://linear.app/docs/use-cycles) carry unfinished issues into the next cycle; [GitHub status checks](https://docs.github.com/en/pull-requests/reference/status-checks) expose explicit check outcomes; [VS Code tasks](https://code.visualstudio.com/docs/debugtest/tasks) distinguish background activity from readiness. HEAV3NS adapts those ideas to terminal tasks, without treating a progress message as evidence of success.

### Rolling policy

- **Trigger:** On a meaningful authorized implementation checkpoint, recovery, or completion, the agent reconciles this file once. This is session-driven maintenance, not a scheduled background worker.
- **Capacity:** Keep 1–3 ready Now items; hard ceiling 5. Preserve stable QoL IDs across moves. Priority order is correctness/recovery, blocked-work relief, clarity, then polish.
- **Carry forward:** Preserve unfinished work, evidence, and the next action. Move blocked work to Next with an owner, reason, and unblock condition; continue independent authorized work.
- **Promote:** Move the highest-priority ready Next item into a free Now slot only when its dependency is satisfied, its acceptance check is concrete, and it belongs to the authorized scope. Moving an item never authorizes unrelated execution.
- **Complete:** Record the outcome, actual checks, known limitations, and review location. Archive verified work; do not complete items based on age, confidence, or an agent summary alone.
- **Avoid loops:** Retry after a changed input or recovery action. Repeated identical failures trigger root-cause investigation and an explicit blocker, not another identical audit.
- **Compress:** Replace section 11, merge duplicate findings, and preserve consequential decisions. Run relevant gates after changes; do not require manual roadmap validation before every tool call.

## 4. Now

### 1. QOL-05 — Give every task one understandable next action

**Goal:** Users can identify what is running, what is waiting, and what they can do in one scan.

**Why It Matters:** Clear state reduces repeated status requests and unnecessary intervention.

**Current State:** The roadmap cockpit leads with status and one next action. The task activity timeline now separates tool calls from verification, preserves unreported child outcomes at turn completion, sanitizes metadata, and offers one evidence-based follow-up. Recovery actions reach the existing autocomplete path; stale suggestions clear at the next turn. Approval states and a live keyboard walkthrough still need review.

**Next Concrete Action:** Trace approval/waiting surfaces to lifecycle authority and exercise full-screen keyboard navigation; review timeline retention cost for very long turns without losing unresolved activity evidence.

**Success Signal:** At 80- and 120-column widths, each state shows a plain-language label and actionable recovery without truncating the primary action; keyboard-only navigation reaches its details.

**Gravity Impact:** Strengthens  
**Centralization Effect:** Centralizes  
**Entropy Risk:** Low

**Risk / Mitigation:** A wording-only change can conceal unresolved state disagreement; derive labels from lifecycle authority and test transitions.

### 2. QOL-08 — Keep completion evidence fresh across every consumer

**Goal:** Reuse valid evidence without allowing an outer cache to hide a changed input.

**Why It Matters:** Stale readiness misleads the agent even when the underlying gate detects the change.

**Current State:** Session briefs share the service cache. Snapshot identity now includes the observed document text, covering preserved timestamps and explicit drafts. Snapshot and validation caches isolate producer/consumer objects; both retain at most 128 entries. The audit now maps broader completion evidence ownership and records the Git-status digest and age-renewal gaps.

**Next Concrete Action:** Reproduce repeated edits to an already-dirty file through the general completion audit. Replace status-only identity with a measured, bounded content/freshness contract, and reconcile age renewal with CompletionFunnel TTL semantics. Preserve advisory versus terminal authority boundaries.

**Success Signal:** Affected gates rerun, unaffected evidence remains reusable, and callers cannot mutate retained evidence.

**Gravity Impact:** Strengthens  
**Centralization Effect:** Centralizes  
**Entropy Risk:** Medium

**Risk / Mitigation:** Removing duplicate caches adds freshness-check I/O; use the existing service cache and measure end-to-end tasks before tuning.

## 5. Next

### 1. QOL-07 — Make completion walkthroughs reviewable in the terminal

**Opportunity:** Turn the final result into a short review path: outcome → changed files/behavior → checks → limitations.

**Why Soon:** All completion tool variants now request this structure; prompt guidance is not a guarantee of model adherence.

**Dependency:** Representative final task receipts and QOL-05 state vocabulary.

**First Validation Step:** Exercise a one-file fix, multi-step feature, partial failure, and no-code answer; verify that each final view links to available evidence and never fabricates a check. Keep simple answers short.

**Confidence:** High  
**Gravity Impact:** Strengthens  
**Centralization Effect:** Centralizes  
**Entropy Risk:** Low

## 6. Later

### 1. QOL-09 — Resume interrupted work with a clear recovery preview

**Direction:** Show the last verified result, interrupted operation, and safe next action on resume.

**Potential Upside:** Less rereading and fewer repeated tool calls after disconnects or restarts.

**Why Not Now:** Requires stable evidence freshness and conflict-aware state ownership.

**Promotion Trigger:** QOL-04 and QOL-08 pass interruption/restart scenarios with no lost or falsely completed work.

**Gravity Impact:** Strengthens  
**Centralization Effect:** Centralizes  
**Entropy Risk:** Medium

## 7. Discovery

### 1. Which waits dominate user-perceived latency?

**Question:** Are the largest delays queueing, backend I/O, repeated verification, or unclear permission prompts?

**Evidence Needed:** Reproducible task traces, queue/service timing, and counts of duplicate prompts and checks. No production latency claim is established by this pass.

**Possible Outcomes:** Tune a class budget; eliminate repeated work; improve status copy; leave concurrency unchanged.

**Decision Needed:** Select the next optimization using measured impact and correctness risk.

## 8. Maintenance Gravity

### Hotspots

| Area | Symptom | Risk | Recommended Action |
|---|---|---|---|
| Roadmap persistence | External editors can bypass the shared lock | Medium | Document the compare/rename window; use the service for cooperating mutations |
| Completion evidence | General audit uses Git status as a content proxy and can renew old evidence | Medium | QOL-08 establish content freshness and age semantics through public consumers |
| Task surfaces | Timeline truth repaired; approval flows and long-turn retention remain | Medium | Finish QOL-05 with live keyboard and retention evidence |
| Reference docs | Docs-index guard and audit runner repaired; historical claims still need curation | Low | Keep navigation checks aligned with current evidence |

### Repeated Friction

- Cached validation must not strand pending state after identical-content writes.
- Priority boosts must not indefinitely postpone older eligible I/O.
- Completion diagnostics must distinguish mechanical cleanup from real content failures.

### Documentation Gaps

Local mixed-I/O measurements are in the audit record. End-to-end task latency, roadmap persistence cost, and a terminal task-state walkthrough remain unmeasured/unreviewed.

### Agent Confusion Points

`src/services/roadmap/RoadmapCompletionGate.ts` governs workspace roadmap completion; `src/tooling/extensions/policy/roadmap-completion-gate.ts` is a different policy evaluator. Patch the actual call path, not a similarly named subsystem.

## 9. Centralization & Code Soup Audit

**Overall Code Soup Risk:** Medium

### Canonical Path Integrity

**Assessment:** This pass extends the existing parent I/O pool, roadmap service, and completion prompt variants. No second scheduler or roadmap store was introduced.

### Authority Boundaries

**Assessment:** ExecutionFunnel retains permission and mutation authority; TaskLifecycleFunnel retains lifecycle authority. Roadmap prose steers planning; explicit gate results establish readiness. Priority changes do not grant new I/O permissions.

### Structural Drift

**Assessment:** Result caching and persistence recovery were coupled incorrectly. State writes invalidate cached validation; cooperating mutations share a persistence lock; invalid drafts never publish; remediation no longer restores old files over newer edits. External-editor atomicity remains a documented limit.

### Agent Coherence

**Assessment:** Stable IDs, acceptance signals, source paths, and a single next action give future sessions a concrete continuation point. Repeated audits require new evidence.

### Centralization Recommendation

Keep service mutations and coordinator commits inside the existing governed persistence boundary. Measure its I/O cost before tuning concurrency; continue the task-surface review without adding another state owner.

## 10. Decision Log

### 2026-09-29 — Roll progress at meaningful checkpoints

**Decision:** Use the existing 12-section roadmap and session steering; carry unfinished work, archive verified outcomes, and promote ready scoped work within a small WIP limit.

**Reason:** The repository already has roadmap lifecycle integration. A separate daemon would add state and authority without evidence of need.

**Impact:** Future sessions have a bounded continuation policy; user authorization remains separate from planning promotion.

**Follow-up:** QOL-05 and QOL-08; retain current capacity until end-to-end evidence justifies a change.

## 11. Recent Checkpoint

**Date:** 2026-09-29

**Checkpoint Summary:** Repaired task timeline evidence: ordinary tools no longer imply verification, URL mentions do not imply live previews, and turn settlement does not manufacture child success. Added bounded, relevant follow-up suggestions, metadata isolation/sanitization, and autocomplete recovery wiring. Roadmap caches now include observed document content, isolate retained objects, and cap validation retention.

**Moved:** QOL-05 and QOL-08 remain active with narrower, evidence-backed next steps. QOL-07 retains broader completion-receipt work; the timeline now supplies a truthful foundation.

**Added:** Regression cases for same-mtime edits, producer/consumer mutation, cache retention, terminal states, metadata controls, 1,000 activities, terminal widths, and autocomplete action application.

**Updated:** [Audit evidence and cache ownership map](docs/QOL_ROLLING_AUDIT.md). No concurrency or execution-authority expansion.

**Verification:** Focused suite: 362 passing. Full unit, type, build, rendered-output review and audit results are recorded in the audit.

**Archived:** No open roadmap item was declared complete based on partial coverage; previous archive evidence remains intact.

**Code Soup Risk:** Medium — general audit content identity and full-screen approval UX remain open.

**Recommended Next Move:** Reproduce the general audit's already-dirty-file freshness gap, then finish the approval/keyboard review.

## 12. Archive

### QOL-01 — Honest roadmap completion and retry recovery

**Archived Date:** 2026-09-29  
**Reason:** Rollback preserves pending/unknown validation; missing gate decisions block completion; state changes invalidate cached validation; known schema failures remain blocking in previews. Roadmap regression suite passes.

**Evidence:** `src/services/roadmap/__tests__/RoadmapCompletionGate.test.ts`, `RoadmapAutoGovernance.test.ts`; see the [audit and verification record](docs/QOL_ROLLING_AUDIT.md).

**Restore Condition:** Any invalid roadmap passes completion or an unchanged-content write becomes stuck pending again.

### QOL-02 — Bounded priority overtaking for parent I/O

**Archived Date:** 2026-09-29  
**Reason:** After eight eligible bypasses, oldest eligible work takes precedence over priority boosts. Global/per-class caps and queued cancellation are preserved.

**Evidence:** `src/core/task/tools/io/__tests__/parentIoThroughput.test.ts` covers priority bursts, eventual admission, repeated release, caps, and cancellation. No wall-clock speedup is claimed.

**Restore Condition:** Eligible requests starve, capacity leaks, or measured urgent-request latency regresses materially.

### QOL-03 — Shared completion walkthrough and rolling guidance

**Archived Date:** 2026-09-29  
**Reason:** Completion tool variants share outcome/review/check/limitation guidance; roadmap steering now gives a bounded session-driven rollover procedure. Terminal rendering and model-adherence evaluation remain QOL-07.

**Evidence:** `src/core/prompts/system-prompt/tools/attempt_completion.ts` and `components/roadmap_steering.ts`.

**Restore Condition:** Provider variants omit the guidance or instruction conflicts prevent useful completion reports.

### QOL-04 — Cooperating-writer persistence and non-destructive recovery

**Archived Date:** 2026-09-29  
**Reason:** RoadmapService and coordinator commits serialize read/modify/write work using the existing governed file-lock backend. Unique synced staging files replace shared temporary paths. Changed document bases reject publication, corrupt state is preserved, failed writes throw, and invalid remediation drafts never replace the document. No stale backup is restored.

**Evidence:** `RoadmapPersistence.test.ts` exercises 24 concurrent patches, 12 continuation updates, a contested lease, separate-process updates, external edits, persistence failures, and snapshot freshness. Existing coordinator projection tests pass.

**Restore Condition:** A cooperating update is lost, failed persistence reports success, or remediation restores stale bytes. Arbitrary external writers still have a compare/rename race window; cross-file crash atomicity and recovery from a crashed lock owner are not newly guaranteed.

### QOL-06 — Reproducible mixed parent-I/O baseline

**Archived Date:** 2026-09-29  
**Reason:** A production-pool harness runs one warmup and five measured bursts of 192 requests across four classes, reports queue/service p50/p95 and backend call counts, asserts caps and drained queues, then cancels 32 queued requests and verifies recovery. No capacity tuning was justified or performed, so no before/after speedup is claimed.

**Evidence:** [Raw baseline](docs/PARENT_IO_BASELINE.json) and [methodology/results](docs/QOL_ROLLING_AUDIT.md). Peak active count 4; 528 filesystem calls per measured burst; all queued cancellations rejected with no stranded slots.

**Restore Condition:** The harness violates caps, leaks requests, or a proposed throughput change needs a matched baseline. Production search, coalescing, roadmap persistence, and full task latency require separate workloads.
