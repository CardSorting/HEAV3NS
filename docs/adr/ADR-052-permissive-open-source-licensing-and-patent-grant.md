# ADR-052: Apache licensing, provenance, and evidence-bounded IP records

## Status

Accepted and superseded in part by the current claim-control records.

## Context

The project adopted Apache-2.0 and began keeping dated engineering disclosures
for its architecture and benchmark history. Earlier versions of this ADR used
broader language about patent scope, prior-art effect, and project-wide
ownership than the available evidence supported. A permissive license also
needs a clear boundary between first-party work, dependencies, inspirations,
and trademarks.

## Decision

Keep Apache License 2.0 as the current project license and make the following
controls authoritative for future changes:

1. `LICENSE` controls first-party copyright and the Apache contributor patent
   grant.
2. `NOTICE` records factual attribution and does not change the license.
3. `DCO` and signed-off commits provide a contributor provenance control.
4. `TRADEMARKS.md` separates names, logos, and endorsement from copyright
   permissions.
5. `.wiki/ip/CLAIM-REGISTER.md` and `.wiki/ip/SOURCE-PROVENANCE.md` bound
   technical claims and preserve source/license records.
6. Automated legal, claim, DCO, and package-boundary checks run before release.

## Consequences

The project can remain broadly reusable under Apache-2.0 while making fewer
unsupported statements about patentability, ownership, or benchmark outcomes,
or third-party work. The cost is that a copied or imported component with an
unresolved license must be treated as a release blocker until its provenance is
recorded or the component is removed.

## Evidence

- [Licensing and claim-control strategy](../../docs/LEGAL-STRATEGY.md)
- [Claim register](../../.wiki/ip/CLAIM-REGISTER.md)
- [Source provenance](../../.wiki/ip/SOURCE-PROVENANCE.md)
- [Apache License 2.0](../../LICENSE)
