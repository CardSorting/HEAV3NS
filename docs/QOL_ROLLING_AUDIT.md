# QoL rolling roadmap audit — 2026-09-29

[ROADMAP.md](../ROADMAP.md) is the rolling source of priorities, acceptance signals, blockers, and completed outcomes. This record tracks the implementation passes and how to inspect the current behavior.

## First pass: completion correctness and fairness

| Finding | Root cause | Change | Regression evidence |
|---|---|---|---|
| Invalid rollback recorded as valid | File existence used as proof of schema validity | Restore pending/unknown validation | Invalid document remains blocked on repeated attempts |
| Identical-content mutation could stay pending | Five-second result cache ignored state changes | Invalidate on state writes; check persisted validation state before cache reuse; hash final autofilled bytes | Mutation and direct state restoration both revalidate |
| Missing readiness could pass | Only explicit `false` blocked completion | Require explicit `true` | Incomplete operational status blocks |
| Schema errors appeared auto-clearable | Mechanical gate list could override known invalid schema | Known schema failure takes precedence | Preview remains blocking |
| Older parent I/O could starve | Priority comparison had no bound on overtaking | Prefer oldest eligible request after eight bypasses | Continuous priority bursts eventually admit waiting work |
| Completion had no shared review path | Provider variants requested generic summaries | Shared outcome, review location, checks, limitations instruction | Prompt integration verification |

## Review walkthrough

1. Read **Now** in [ROADMAP.md](../ROADMAP.md): each item has a next action and success signal. Follow stable IDs as items move.
2. In an active HEAV3NS session, use `/roadmap cockpit` for status and one next action. Use `/roadmap cockpit --verbose` for the full diagnostics and history, or `/roadmap explain-gate` for checks. Governance still runs at completion.
3. Inspect the regression tests alongside the runtime fixes. Queue fairness is bounded by dispatch opportunities; it cannot guarantee latency if an active backend never releases its slot.
4. At completion, review the actual changed behavior/files and check results. The new walkthrough is prompt guidance; no deterministic receipt renderer or guaranteed model adherence is claimed.
5. Future authorized sessions reconcile the roadmap once at meaningful checkpoints. No scheduled worker was installed, and moving an item into Now does not start it automatically.

## Familiar patterns used

- [Linear cycles](https://linear.app/docs/use-cycles): retain unfinished work through rollover. Adaptation: meaningful session checkpoints rather than timed sprints.
- [GitHub status checks](https://docs.github.com/en/pull-requests/reference/status-checks): expose explicit outcomes and supporting evidence. Adaptation: a roadmap gate needs a positive readiness decision; missing state cannot mean success.
- [VS Code tasks](https://code.visualstudio.com/docs/debugtest/tasks): distinguish a running background process from completion/readiness. Adaptation: carry this distinction into the task-state work in QOL-05.

These are behavioral references, not claims that HEAV3NS has feature parity or certified compliance with those products.

## Second pass: shared persistence, clarity, and workspace hygiene

| Area | Implementation | Evidence |
|---|---|---|
| Concurrent state | Canonical workspace queue plus the existing governed file-lock backend wraps entire read/modify/write operations, including coordinator commits | Concurrent patches, continuation anchors, contested lease, and separate-process tests |
| Durable publication | Unique staging files are synced and closed; changed document/state bases reject publication; failed or corrupt state never produces a success-shaped return | File preservation, failed-write, staging cleanup, and conflict tests |
| Recovery | Autofill/date edits are staged and schema-checked before publishing; no whole-file backup rollback | External edit survives failed remediation; unrelated state remains intact |
| Date repair | Only the checkpoint date is replaced; unrelated Markdown bytes stay intact | Existing section preservation tests |
| Cache freshness | State, policy, and manifests enter snapshot identity; validation reuse checks policy/dependencies; old snapshot revisions are pruned with a global 128-entry ceiling | External state/policy change and dependency-change tests |
| Read-only inspection | Diagnostic context hydrates an in-memory view and does not persist it | Repeated inspection preserves current work without creating a state file |
| Terminal clarity | Default cockpit leads with status and next action, limits work to three items, and wraps by display width; verbose is reachable from the slash command | 80/120-column review and regressions for Unicode, 1,000 items, unknown/conflicting state, and malformed history |
| Repository hygiene | Ignore only generated roadmap state/lock paths; repair the ESM audit runner; validate current docs-index content and link targets | No user files deleted; both audit commands pass |
| Repeatable checks | `npm run test:qol` selects roadmap, parent I/O, completion, prompt, and coordinator tests | Focused check succeeds |

The compact cockpit labels **roadmap readiness**, not task completion. It does not invent running or approval state where no lifecycle evidence exists. QOL-05 retains that broader task-surface review.

## Third pass: session freshness and measured parent I/O

- Removed the time-only session-brief cache, which could mask an external state or policy change despite fresh service snapshots. The service remains the cache owner; forced refresh invalidates that cache. Returned session data is deeply cloned so caller edits cannot poison subsequent views.
- Regression checks exercise passing → pending → policy-adjusted readiness through `sessionBrief`, external document edits, nested caller mutation, and read-only behavior.
- Parent I/O copies/freezes validated per-class limits and rejects unknown classes/nonfinite priorities before enqueueing. Tests verify caps survive caller mutation and malformed input cannot strand queue entries.
- Added `npm run benchmark:parent-io -- --output /tmp/parent-io.json`. The harness creates and removes its own temporary fixture directory; it does not read user files or contact a model/network service.

### Local benchmark evidence

[Raw baseline and samples](PARENT_IO_BASELINE.json), recorded on Node v26.8.1 / darwin arm64. One warmup, five measured bursts of 192 requests, equal class counts, 32 files of approximately 4 KiB. Metadata/read priority is 2; search/traversal priority is 0. Search sequentially reads eight files per request. Coalescing is disabled. Percentiles use nearest rank across 240 samples per class.

| Class | Queue p50 / p95 (ms) | Service p50 / p95 (ms) |
|---|---:|---:|
| Metadata | 2.282 / 3.992 | 0.029 / 0.055 |
| Small read | 2.306 / 4.019 | 0.047 / 0.078 |
| Search fixture | 5.035 / 8.213 | 0.325 / 0.529 |
| Traversal | 2.323 / 4.043 | 0.074 / 0.111 |

Each measured burst made 528 filesystem API calls, peaked at four active requests, respected per-class caps, and drained completely. A separate cancellation probe rejected all 32 queued requests and successfully acquired/released a new slot afterward. The command exits unsuccessfully if a correctness assertion fails.

Queue time dominates this deliberately bursty workload; the bounded search scan does more filesystem work and has two slots. These results do not establish an end-to-end bottleneck or justify higher concurrency. Caps remain unchanged. This is a baseline, not a before/after speedup claim, and it excludes the production search backend, tool admission, model latency, coalescing and roadmap persistence. Repeat on the same machine/workload when evaluating a proposed change.

## Fourth pass: truthful task activity and cache isolation

| Finding | Fix | Evidence |
|---|---|---|
| Completed tool calls appeared as verification | Tools and Check stages have separate recorded status | Ordinary-tool completion never gets a Check success mark |
| Turn completion manufactured successful child activities | Preserve original events; settled turns display unfinished activities as “outcome not recorded” | Successful, failed, cancelled and late-event cases |
| A URL or screenshot command implied a live preview or captured artifact | URL mentions explicitly say “not checked”; removed screenshot inference; files come from completed-write metadata | URL/screenshot mention and failed-write cases |
| Follow-up suggestions proposed unrelated features or repeated broad checks | One relevant recovery/review action; no suggestion for a plain answer with no recorded changes | Recovery action travels through autocomplete; next turn clears old suggestions |
| Metadata bypassed progress text sanitization | Copy and sanitize file names and telemetry warnings at ingestion | Caller mutation, terminal controls and token redaction |
| Same-mtime edits could reuse old roadmap status | Include observed document text in snapshot identity before lookup | Public status API sees an invalid replacement with preserved timestamp |
| Public results could mutate retained evidence | Clone snapshots on insertion/retrieval and validation results on retention/reuse | Producer, consumer and public validation/status mutation tests |
| Validation results retained every visited workspace | Bound the service map to 128 entries; keep snapshot revision pruning | Snapshot tests exercise 1,000 revisions and cross-workspace eviction; validation uses the same ceiling |

Reviewed completed, failed and cancelled terminal output together at 80/120 columns; automated wrapping also covers 48 columns and 1,000 activities. Recorded checks describe progress events, not independently rerun tests. The existing engine turn outcome stays authoritative. Autocomplete coverage verifies applying the suggested text and cursor position; it does not replace a live full-screen keyboard walkthrough.

### Completion evidence ownership map

| Owner / consumer | Identity and lifetime | Current boundary / next action |
|---|---|---|
| `RoadmapService.resolveWorkspaceContext` → operational status, checkpoint, session brief | Observed roadmap text, persisted state, roadmap config, dependency manifests, evidence tier; snapshot TTL and 128-entry cap | Isolated data; same-mtime change covered. Other gathered repository evidence still follows the snapshot TTL. |
| `RoadmapService.validateRoadmap` → roadmap completion readiness | Document hash, policy, manifests, persisted pending/schema state; five-second reuse and 128-entry cap | Isolated results; mutation invalidates; persistence failure propagates. |
| `completionGatePipeline` → advisory audit diagnostics | Result/description plus `resolveAuditStateIdentifier`, graph revision and age; separate advisory reuse | `computeWorkspaceContentDigest` hashes Git status, policy text and memory version, not file contents. Repeated external edits to an already-dirty file can retain identity. Secondary same-key/revision reuse refreshes age without rerunning the audit. QOL-08 must reconcile both before claiming comprehensive freshness. |
| `CompletionFunnel.evaluateAuditValidity` → canonical completion decision trace | Audit key, graph revision, TTL and registry activity | Funnel applies age checks; pipeline renewal has different semantics. Keep advisory diagnostic scores separate from durable terminal authority. |
| Engine progress → `AgentActivityTimeline` | Ordered per-turn events and immutable terminal outcome | Display evidence only. Rendering is bounded, but retained history still grows with the turn; preserve unresolved evidence when designing retention. |

No new cache or competing completion authority was added. General audit content hashing and age policy are intentionally recorded as unresolved, with a concrete public-path reproduction next, rather than declared fixed by the roadmap-specific work.

## Verification

- Fourth-pass full repository unit run: **2,524 passing** in 59 seconds.
- Fourth-pass `npm run test:qol`: **362 passing**, including timeline evidence, autocomplete, same-mtime edits and cache isolation/retention.
- TypeScript (`tsc --noEmit --incremental`), production bundle (`node esbuild.mjs --production`), changed-file Biome checks, lifecycle boundary check, roadmap schema, and `git diff --check` pass.
- `npm run roadmap:audit`, `docs:check-docs-readme`, and root README link validation pass. The obsolete docs-index baseline failure from pass one is resolved by checking today's documented structure and actual relative link targets.
- Reviewed plain terminal output at 80 and 120 columns. The tests also measure Unicode display width and bounded list output. No interactive full-screen keyboard-navigation claim is made.

Repeat the focused checks:

```sh
npm run test:qol
npm run benchmark:parent-io -- --output /tmp/parent-io.json
npm run roadmap:audit
npm run docs:check-docs-readme
npm run docs:check-root-readme-links
```

## Remaining limits

- Cooperating roadmap writers share a lock. Arbitrary external editors do not: a changed base is checked immediately before rename, but an uncooperative writer can still race that check/rename window. This is not a transactional filesystem or a cross-file crash-atomic commit.
- Process death while holding a governed lock uses the existing lease-expiry/recovery behavior. A contender waits up to five seconds and reports a busy/recovery error; this pass adds no new crash-recovery guarantee.
- Approval/waiting states and live full-screen keyboard navigation remain QOL-05. The activity receipt is evidence-based; broader final-response presentation remains QOL-07.
- The mixed-load fixture baseline is complete (QOL-06). Production backend, coalescing, cross-process persistence and end-to-end task latency remain unmeasured.
- QOL-08 now has an ownership map. General audit content identity and age renewal remain unresolved; roadmap snapshot isolation does not establish freshness for every completion subsystem.
