# ADR-052: Permissive Open-Source Licensing, Patent Grant & Prior-Art IP Protection

## Status
**Accepted**

## Context
The August 9, 2026 disclosure recorded sub-millisecond local turn execution, a fixed 16MB ArrayBuffer slab, and $O(1)$ state restoration. Those decision-time measurements are preserved in the prior-art record; they are not current guarantees. Current worktree evidence is generated in [`docs/LIVE_BASELINE.json`](../../docs/LIVE_BASELINE.json). Protecting the intellectual property and public prior-art rights of the project while keeping the codebase **100% permissive for commercial and community adoption** was critical.

## Decision
We adopted the **Apache License, Version 2.0** alongside an explicit **Attribution NOTICE** and **Invention Disclosure Specification** ([INVENTION-DISCLOSURE-AND-PRIOR-ART.md](file:///Users/bozoegg/Desktop/LUMI-NEW/.wiki/ip/INVENTION-DISCLOSURE-AND-PRIOR-ART.md)).

### Core IP Protection Mechanisms

1. **Permissive Open-Source Utilization**:
   - Allows royalty-free commercial, open-source, and enterprise usage, reproduction, and modification.

2. **Perpetual Royalty-Free Patent License Grant**:
   - Explicitly grants patent rights for the underlying implementation to all users and contributors.

3. **Defensive Patent Termination Clause**:
   - Automatically revokes patent rights for any entity that files patent infringement lawsuits against the project or its contributors.

4. **Public Prior-Art Timestamping**:
   - Documents August 9, 2026 as the formal prior-art disclosure date for AKD-DSO, zero-GC slab memory allocation, and $O(1)$ state pointer rewinding.

## Consequences

### Positive
- Fully permissive open-source license encourages broad adoption.
- Protects the project and contributors against predatory patent litigation.
- Establishes clear public prior art precluding third-party patent claims.
