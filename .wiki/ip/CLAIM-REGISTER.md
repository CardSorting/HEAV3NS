# LUMI-JOY claim register and evidence boundaries

**Document ID:** `IP-2026-09-21-LUMI-CLAIMS-01`

**Status:** engineering review record; not legal advice

**Last reviewed:** 2026-09-21

This register keeps public descriptions tied to code and reproducible evidence.
It distinguishes what the repository implements from what a benchmark measured,
what the design intends, and what came from another project or research
community. It does not assert inventorship, novelty, non-infringement, or
patentability.

## Register

| ID | Statement class | Current bounded statement | Evidence | Required limitation |
|---|---|---|---|---|
| CR-001 | Implementation | The runtime models selected agent work as typed tick and lifecycle contracts. | `src/core/abstracts/`, `src/agents/`, `npm run smoke` | Provider latency, network time, subprocesses, and user approval time are outside an in-memory tick observation. |
| CR-002 | Implementation | `ArenaAllocator` reserves a fixed-size ArrayBuffer for the state substrate. | `src/sessions/extensions/substrate/arena-allocator.ts` and its tests | A reserved slab does not prove that the full runtime performs no allocations or garbage collection. |
| CR-003 | Implementation | Snapshot and rewind APIs restore the modeled in-memory state representation. | `src/sessions/extensions/persistence/session-store.ts`, runtime validation scripts | File changes, provider side effects, terminals, and external services are not automatically rewound. |
| CR-004 | Implementation | The hashline editor checks a line digest before applying an anchored edit. | `src/tooling/extensions/hashline/` | The digest is not a cryptographic proof of file identity and must not be described as collision-free. |
| CR-005 | Implementation | The setup flow uses PKCE and a temporary loopback callback for supported provider authentication. | `src/agents/extensions/setup/`, auth tests | Local firewall, browser, provider, and operating-system behavior can change the result. |
| CR-006 | Dated measurement | Historical latency, throughput, memory, and benchmark figures describe a named workload and environment. | `docs/LIVE_BASELINE.json` and generated reports | A historical or host-sensitive number is not a product-wide SLA or savings promise. |
| CR-007 | External provenance | Hermes, StateM, BroccoliDB, and other projects are references or dependencies with their own terms. | `NOTICE`, `SOURCE-PROVENANCE.md`, `package-lock.json` | An acknowledgment does not claim ownership of another project or relicense its work. |
| CR-008 | Brand | HEAV3NS, LUMI, LUMI-JOY, CardSorting, and bozoegg identify the project or steward. | `TRADEMARKS.md`, package metadata | Apache-2.0 does not grant trademark or endorsement rights. |

## Review rules

1. Use `observed`, `measured`, `historical`, or `design intent` rather than
   absolute language when the evidence is scoped.
2. Link a benchmark to its command, input, version, host, and report date.
3. Keep patent, ownership, and legal-effect conclusions out of engineering
   prose unless counsel supplies the wording.
4. Do not convert a dependency, inspiration, or internal migration note into
   a first-party ownership statement without a source and license record.
5. When a claim changes, update this register and the automated claim check in
   the same change.
