# Licensing, provenance, and claim-control strategy

**Status:** engineering control for the current repository line

**Last reviewed:** 2026-09-21

This document describes release controls. It is not a legal opinion, patent
search, ownership opinion, or substitute for counsel.

## License boundary

The current project line is Apache-2.0. `LICENSE` is the controlling license
for first-party copyrightable work for which the contributing party has the
right to grant that license. `NOTICE` is informational and does not add terms
to Apache-2.0. `TRADEMARKS.md` reserves names and branding separately.

Historical commits before the Apache adoption commit `c1405ab` may contain the
earlier MIT-licensed project state. A consumer must read the license files at
the exact tag or commit being used; the current license must not be projected
back onto historical releases.

Apache-2.0 is intentionally permissive. It grants the rights stated in the
license and the contributor patent grant described there; it cannot prevent a
fork, a competing implementation, independent development, or lawful use of
general ideas. Creator protection in this repository therefore comes from
accurate attribution, contributor provenance, the Apache patent-termination
mechanism, trademark separation, and preserved release evidence—not from
adding unsupported restrictions to an Apache release.

## Provenance controls

The repository also contains a nested MIT-licensed JoyRide subtree. Consult
LICENSE-MAP.md and THIRD-PARTY-NOTICES.md before redistributing source
outside the normal package boundary; a root Apache-2.0 summary does not
relicense a nested component.

- Contributors sign the [Developer Certificate of Origin](../DCO) with a
  `Signed-off-by:` trailer.
- Source and dependency provenance is recorded in
  [`.wiki/ip/SOURCE-PROVENANCE.md`](../.wiki/ip/SOURCE-PROVENANCE.md).
- The local BroccoliDB dependency is pinned to a reviewed Git commit rather
  than an unresolvable sibling-directory path.
- Third-party terms remain separate. A project-wide Apache label never
  overrides a dependency's license or a file-specific notice.
- New copied, generated, or imported material must identify its source,
  license, and any required notice before release.
- A nested license, file-level notice, or asset term takes precedence over a
  convenient repository-wide summary for that material.

## Claim controls

The [claim register](../.wiki/ip/CLAIM-REGISTER.md) classifies statements as
implementation observations, dated measurements, design intent, or external
provenance. Performance numbers must link to a reproducible report and state
their workload and environment. Memory, rollback, security, cost, and
provider behavior must not be described as universal guarantees when they are
only local or workload-specific observations.

The automated IP check rejects unsupported patent and out-of-license dedication language,
absolute local paths in legal surfaces, and stale headline savings claims. It
does not decide inventorship, patentability, infringement, or ownership.

## Patent and prior-art posture

The repository keeps dated engineering disclosures for defensive research and
historical provenance. A repository publication is evidence of what was
published in that repository at that time; it is not a finding about legal
prior-art status, novelty, enforceability, or the effect of a disclosure in a
particular jurisdiction.

The Apache patent grant is limited to the terms and scope of Apache-2.0 and is
made by each contributor for the claims that contributor can license. The
project policy in `PATENT-NON-AGGRESSION-PLEDGE.md` does not expand that grant,
bind people who did not adopt it, or create rights in third-party patents.

## Release gates

Before a release or marketplace upload, run:

```bash
npm run legal:check
npm run check
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

The package-boundary check must pass for both the npm metadata boundary and
the VSIX file list. A failed provenance, license, claim, dependency, or
package check is a release blocker until the record is corrected or the
affected material is removed from the artifact.
