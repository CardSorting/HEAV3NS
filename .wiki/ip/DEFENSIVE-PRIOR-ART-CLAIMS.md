# Defensive prior-art search record

**Document ID:** `IP-CLAIMS-2026-08-09-01`

**Publication record:** 2026-08-09 project disclosure

**Status:** search-oriented engineering record; legal review not performed

This file gives a search-friendly index of implementation concepts recorded in
the repository. It is deliberately not written as a patent claim set. It does
not determine novelty, inventorship, infringement, enforceability, or the
effect of publication in any jurisdiction.

## Search records

### Record A — fixed-size session arena

The runtime includes a fixed-size ArrayBuffer allocator used by selected
session state paths.

**Evidence:** `src/sessions/extensions/substrate/arena-allocator.ts` and
`src/sessions/extensions/persistence/session-store.ts`.

**Limit:** the record does not establish that the entire runtime is free of
heap allocations or garbage collection.

### Record B — modeled state rewind

The session store can restore its modeled in-memory representation from a
snapshot.

**Evidence:** `src/sessions/extensions/persistence/session-store.ts` and the
runtime validation scripts.

**Limit:** restoring an in-memory object does not undo external effects.

### Record C — tick-oriented lifecycle

Typed contracts represent selected agent work as a lifecycle around a tick
operation.

**Evidence:** `src/core/abstracts/`, `src/agents/`, and generated reports.

**Limit:** the observation excludes provider, network, subprocess, and human
approval time.

### Record D — anchored edit digest

Hashline tooling compares a line digest before applying an anchored edit.

**Evidence:** `src/tooling/extensions/hashline/`.

**Limit:** a short line digest is not a cryptographic proof of file identity.

### Record E — PKCE loopback callback

The setup flow combines a PKCE challenge with a temporary loopback callback for
supported authentication providers.

**Evidence:** `src/agents/extensions/setup/` and authentication tests.

**Limit:** this is an implementation description, not a claim about every
provider or every host configuration.

## Search terms

`AKD-DSO`, `tick`, `ArenaAllocator`, `session snapshot`, `rewindToSnapshot`,
`hashline`, `PKCE`, `loopback callback`, `HEAV3NS`, `LUMI-JOY`.

For license and source rights, use [SOURCE-PROVENANCE.md](SOURCE-PROVENANCE.md)
and the root `LICENSE`, `NOTICE`, and `THIRD-PARTY-NOTICES.md` files.
