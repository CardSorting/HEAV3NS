# Engineering disclosure and historical prior-art record

**Document ID:** `IP-2026-08-09-AKD-DSO-01`

**Record owner:** William Andrew Cruz (`bozoegg` / `CardSorting`)

**Project-recorded disclosure date:** 2026-08-09

**Last reviewed:** 2026-09-21

**Status:** historical engineering record; legal review not performed

This document preserves technical observations recorded by the project at the
time of the referenced commits. It is not a patent application, an ownership
assignment, a novelty opinion, or a conclusion about the legal status of any
publication. The Apache License 2.0 in the repository root controls the
copyright and patent permissions for material to which a contributor has
rights; this document does not add a second license.

## Evidence boundary

The repository history and the files linked below are the evidence to inspect.
Performance values are historical measurements and must not be copied into a
current product claim without a fresh run of the current benchmark. A source
reference shows where an implementation was recorded; it does not by itself
establish inventorship, originality, or a license to redistribute third-party
material.

## Technical observations

### 1. Fixed-size arena state substrate

The `ArenaAllocator` implementation reserves a fixed-size ArrayBuffer for part
of the session state substrate. The design goal is to bound and reuse selected
storage rather than to make a universal claim about V8 allocation or garbage
collection behavior.

**Evidence:** `src/sessions/extensions/substrate/arena-allocator.ts`,
`src/sessions/extensions/persistence/session-store.ts`, and the current
guardrail scripts.

### 2. In-memory snapshot and rewind

The session store exposes snapshot and rewind operations for its modeled state.
The record does not extend that behavior to files, terminals, network calls,
provider requests, or other external side effects.

**Evidence:** `src/sessions/extensions/persistence/session-store.ts` and the
runtime validation commands named by `CONTRIBUTING.md`.

### 3. Tick-oriented agent execution

Selected agent paths use typed lifecycle contracts around a tick-oriented
execution model. Provider and operating-system behavior remain outside the
scope of an in-memory lifecycle observation.

**Evidence:** `src/core/abstracts/`, `src/agents/`, and the generated runtime
baseline reports.

### 4. Anchored edit verification

The hashline tooling computes a line digest before applying an anchored edit.
The digest is a drift-detection aid, not a cryptographic identity proof or a
collision-avoidance note for the described implementation.

**Evidence:** `src/tooling/extensions/hashline/` and its tests.

### 5. PKCE loopback setup

The setup flow uses PKCE and a temporary loopback callback for supported
provider authentication. The result depends on provider, browser, local
firewall, and operating-system behavior.

**Evidence:** `src/agents/extensions/setup/` and the authentication tests.

## Related records

- [Claim register](CLAIM-REGISTER.md)
- [Source provenance](SOURCE-PROVENANCE.md)
- [Defensive prior-art record](DEFENSIVE-PRIOR-ART-CLAIMS.md)
- [Live runtime baseline](../../docs/LIVE_BASELINE.json)
- [Apache License 2.0](../../LICENSE)
