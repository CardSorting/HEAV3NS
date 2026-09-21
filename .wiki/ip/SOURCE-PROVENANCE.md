# Source provenance record

**Document ID:** `IP-2026-09-21-LUMI-PROVENANCE-01`

**Status:** maintained engineering record; review before every release

## First-party repository record

The visible repository history is authored under the `CardSorting` identity.
That history is useful evidence of who made a commit; it is not, by itself, a
copyright assignment or a complete chain-of-title record. Contributors remain
responsible for the rights they certify through the DCO.

The current project line is Apache-2.0. Files that came from another person,
organization, or license must retain their original notices and must not be
silently swept into the first-party Apache grant.

## Known dependency and migration boundaries

| Source or reference | Repository treatment | License/notice control |
|---|---|---|
| `@noorm/broccolidb` | Pinned to the public `CardSorting/ABroccoliDB` commit recorded in `package.json` and `package-lock.json`. | The dependency's own Apache-2.0 package, `LICENSE`, `NOTICE`, and other notices remain controlling for that dependency. |
| Historical `codemarie-new` migration annotations | Several first-party files retain comments identifying an internal migration source. Those comments are provenance pointers, not a license grant. | The steward must confirm authorship or preserve the source license before distributing any affected material as first-party Apache-2.0 work. |
| Hermes Agent / Nous Research | Documentation records architectural inspiration and attribution. | No blanket code-copy or relicensing claim is made; consult the upstream MIT license and any file-level notices if code is included. |
| StateM and related research | Documentation records workflow and evaluation inspiration. | No ownership, endorsement, or code-inclusion claim is made by this repository. |
| Provider SDKs, fonts, icons, and generated assets | Distributed according to their individual package or asset terms. | See `package-lock.json`, dependency license files, and `THIRD-PARTY-NOTICES.md`. |

| src/core/joyride/** | Retained as a separately licensed nested component. | Preserve src/core/joyride/LICENSE (MIT); the root Apache-2.0 label does not relicense this subtree. |
| locales/** and translated documentation | Present in the repository with embedded attribution that is not sufficient to establish chain of title. | Verify the source repository, applicable license, and permission before shipping translations or treating them as first-party Apache-2.0 material. |

## Release rule

If a release contains material whose author or license cannot be established,
the material must be removed, replaced, or separately identified before the
release artifact is published. A source comment alone is not sufficient
permission to redistribute copied code.
