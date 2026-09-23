# HEAV3NS Agent Flight Test

> **Precision at speed. Pilot in command.**

Every agent has a flight profile. Cargo planes carry the operation; fighter jets are built for tight turns. HEAV3NS is aimed at the focused coding mission: inspect the right context, make a scoped change, verify the result, then hand the controls back to the developer.

“Break the sound barrier” is the ambition: shorten the path from intent to evidence. It is not a measured speed claim. The Flight Test below checks a small set of real harness behaviors; it does not benchmark live model ability.

## Run the Flight Test

Requirements: Node.js 22.12 or later and the repository dependencies. No API key, model download, Docker daemon, or account is needed.

```sh
npm ci
npm run benchmark:flight
```

Save the machine-readable report when you want to share or inspect a run:

```sh
npm run benchmark:flight -- --output /tmp/heav3ns-flight-report.json
```

Use JSON on stdout for scripts:

```sh
npm run benchmark:flight -- --format json
```

Use npm's silent mode when piping the JSON stream to another program; otherwise npm's own command banner precedes the JSON:

```sh
npm run --silent benchmark:flight -- --format json | node -e 'let data = ""; process.stdin.on("data", chunk => data += chunk); process.stdin.on("end", () => console.log(JSON.parse(data).summary));'
```

The command returns a nonzero exit code if any required scenario check fails. Wall times are diagnostic only; compare neither across machines nor with live agent latency.

## What it exercises

The suite invokes the real `AgentEngine`, registered workspace tools, and tool scheduler. A local scripted provider fixture supplies fixed OpenAI-compatible responses through an in-process fetch trap. Each scenario gets a fresh `AgentEngine` and fixture workspace, so one scenario cannot pass because another left behind a file or session state.

| Scenario | Contract under test |
| --- | --- |
| `FT-01` Read context | The file tool succeeds, its result reaches the next provider decision, and the turn returns the expected fixture fact. |
| `FT-02` Repair and verify | The engine dispatches read → exact-block edit → reread; tool results reach the next decision; the saved file matches the expected repair. |
| `FT-03` Recover from invalid arguments | Schema-invalid tool input becomes a failed tool result; a later valid call can complete the turn. |
| `FT-04` Recover from HTTP 503 | The transient provider error reaches the retry path, then a successful response completes the turn. |
| `FT-05` Cancel in flight | An in-flight provider request observes cancellation; the turn and progress stream end as cancelled without a success terminal. |

All five scenarios must pass. A run is reported as pass/fail, not as a model score or a public leaderboard percentage.

## Read the result

The text output is the quick view: scenario status, assertion counts, and diagnostic time. The JSON report follows the published [version 2 JSON Schema](report-schema-v2.json) and carries:

- benchmark and report-schema versions;
- start and finish timestamps;
- Node version, operating system, architecture, source revision, and worktree status;
- a SHA-256 digest and the file list for declared benchmark inputs;
- per-scenario outcomes, failed assertions, tool-call counts, and diagnostic durations.

The report excludes prompts, fixture contents, API keys, and provider conversation bodies. In CI, the workflow adds a compact result and direct report link to the GitHub Actions run summary, then uploads the JSON report as a commit-keyed artifact.

## Boundaries

The provider is scripted, the task set is five scenarios, and the tests cover selected control-flow contracts. This suite does not measure whether a live model chooses the right tools, solves unseen issues, writes production-quality code, or outperforms another agent. It is not an SWE-bench or Terminal-Bench result.

It also does not prove general filesystem sandboxing, permission UX, shell safety, provider parity, or the behavior of every registered tool. The file-edit case covers `replace_file_content`'s exact-block path only. See [Methodology](METHODOLOGY.md) for the full protocol, [Launch strategy](LAUNCH-STRATEGY.md) for the product story and release gates, and the [public PR draft](PUBLIC-PR.md) for a copy-ready launch review.
