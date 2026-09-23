# Public launch PR draft

Use this as the PR body for introducing the Agent Flight Test. Replace the bracketed fields with links from the actual pull request run; do not paste a local result as if it came from CI.

## Suggested title

Add a deterministic Agent Flight Test for harness conformance

## Copy-ready description

### What this adds

HEAV3NS is built for the tight coding loop: inspect the relevant context, make a focused change, verify it, and hand the diff back to the developer. The Agent Flight Test adds a small, reproducible check for the harness behaviors that support that loop.

The suite runs five scripted integration scenarios against the real `AgentEngine`, registered workspace tools, and tool scheduler. Each scenario uses a fresh engine and temporary workspace. It needs no API key and makes no live provider request.

### Run it

```sh
npm ci
npm run benchmark:flight
```

Save the JSON report with `npm run benchmark:flight -- --output /tmp/heav3ns-flight-report.json`.

### Evidence

- Local command: `npm run benchmark:flight` — [paste result and Node version]
- Unit and harness command: `npm test` — [paste result]
- CI: [link Node 22.x result] · [link Node 24.x result]
- Full machine-readable report: [link the artifact from the workflow run]

CI posts the scenario summary beside the workflow run and uploads a commit-keyed JSON report for each Node line. A green check means the declared harness contracts passed on that revision; it is not a product safety or model-quality score.

### Scope and limits

This is the `harness-conformance` track. It covers workspace reads, an exact-block edit and reread, invalid tool-argument recovery, retry after a scripted HTTP 503, and cancellation of an in-flight provider request. It does not measure live-model coding ability, solve unseen issues, establish cross-product rankings, or prove general filesystem/network isolation.

The fighter-jet language describes the focused mission profile. “Break the sound barrier” is the product ambition to shorten the path from intent to evidence; it is not a speed claim. Cargo capacity remains useful for other workflows, and this copy does not rank other agents.

### Reviewer focus

- Are each scenario's inputs, scripted responses, and observable oracles clear?
- Would the scenario fail if its required harness behavior regressed?
- Does the report make the tested revision and protocol easy to identify?
- Are the launch claims no stronger than the evidence?

## Maintainer checklist

- [ ] Confirm the workflow summary and both Node matrix checks completed.
- [ ] Open the uploaded JSON report and confirm revision, suite version, schema version, and digest match the PR.
- [ ] Review failures as evidence; do not remove a failing task to improve a headline.
- [ ] Keep the scenario list and protocol version aligned with [Methodology](METHODOLOGY.md).
- [ ] Include limits and reviewer questions in the public PR; keep merge approval with human reviewers.
