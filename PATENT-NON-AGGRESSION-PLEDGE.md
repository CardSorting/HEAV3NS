# Defensive patent and prior-art policy

**Project:** HEAV3NS / LUMI-JOY

**Policy owner:** William Andrew Cruz (`bozoegg` / `CardSorting`)

**Last reviewed:** 2026-09-21

This document records project intent and evidence-handling practice. It is not a patent application, patent search, legal opinion, covenant for people who
did not adopt it, or a substitute for the Apache License 2.0.

## 1. Controlling instruments

The Apache License, Version 2.0 in `LICENSE`, is the controlling copyright and
patent instrument for the current project line. Its patent grant is made by
each contributor only to the extent described by Apache-2.0 and only for
claims that contributor can license. The patent-termination rule in Apache
Section 3 applies according to the text of that license.

This policy does not expand the Apache grant, create a license to a third
party's patent, change the conditions for a contribution, or add restrictions
to an Apache-2.0 recipient. `NOTICE` remains informational. `TRADEMARKS.md`
controls the project-name and branding boundary.

## 2. Defensive publication practice

The repository preserves dated commits, source references, benchmark inputs,
and engineering disclosures under `.wiki/ip/`. Those records are intended to
make the project's development history easier to inspect and search. Their
legal effect depends on the applicable jurisdiction, publication facts,
claim scope, and other evidence; no result is promised by this policy.

The claim register therefore uses bounded implementation descriptions and
links each material assertion to a source file or reproducible report. It does
not state that a feature is new, that a claim is invalid, or that a particular
document has a specified legal effect.

## 3. Non-aggression intent

The steward intends to keep the first-party implementation available under
Apache-2.0 and to use the license's defensive patent mechanism consistently.
That intent does not bind independent contributors, downstream distributors,
employers, assignees, or patent holders who have not separately agreed to it.

If a patent notice or demand concerns this project, preserve the notice and
its provenance, avoid admissions, and seek qualified counsel. The project may
publish factual engineering records or participate in a defense, but it does
not promise a legal outcome, a filing, an inter partes review, or a response in
any particular forum.

## 4. Required diligence for new material

Before adding imported or generated material, contributors should record:

- the source repository, commit, author, or generator;
- the applicable license and required attribution;
- whether the material is copied, modified, generated, or merely inspired; and
- the release artifacts that will contain it.

Unverified source material is a release blocker. It must be removed, replaced,
or separately identified until the steward can establish a lawful distribution
path.

## Related records

- [Apache License 2.0](LICENSE)
- [Project NOTICE](NOTICE)
- [Trademarks](TRADEMARKS.md)
- [Claim register](.wiki/ip/CLAIM-REGISTER.md)
- [Source provenance](.wiki/ip/SOURCE-PROVENANCE.md)
- [Licensing and claim-control strategy](docs/LEGAL-STRATEGY.md)
