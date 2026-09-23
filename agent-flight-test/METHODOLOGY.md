# Benchmark methodology

## Protocol identity

| Field | Value |
| --- | --- |
| Benchmark | HEAV3NS Agent Flight Test |
| Benchmark version | `0.3.0` |
| Report schema | `2` |
| Track | `harness-conformance` |
| System under test | HEAV3NS `AgentEngine`, registered workspace tools, and tool scheduler |
| Provider | Local scripted OpenAI-compatible fixture |
| Runtime policy | Package requires Node.js `>=22.12.0`; CI covers Node `22.x` and `24.x` LTS lines |
| External model/API | None |
| Required outcome | All five scenarios pass |

This is an integration benchmark for harness behavior. The fixed provider responses remove model sampling and external API variance. The results establish whether selected engine contracts work in this source revision and runtime; they do not establish model capability or product superiority.

Increment the suite minor version whenever a scenario, fixture, or pass/fail oracle changes. Increment the major version when the track or score meaning changes enough that prior results cannot be compared. Reserve patch versions for documentation and reporting changes that cannot alter execution or scenario outcomes. Increment the report-schema version whenever the serialized report contract changes. Every published result should retain both versions, the tested revision, and the declared-input digest.

## Task design and independent oracles

Each run creates a unique temporary root. Every scenario receives a new engine, session ID, and workspace seeded from checked-in fixture files. Scenarios run serially with a reset scripted response sequence. The real engine dispatches each tool call; the provider fixture never edits files or returns tool outputs on the engine's behalf.

Acceptance checks inspect the returned turn outcome, structured tool records, provider request context, progress events, and saved filesystem state. In `FT-02`, the final text cannot make the case pass by claiming success: the runner also checks that the exact repaired contents are on disk and that the reread result reached the final provider request.

| ID | Scenario | Required evidence |
| --- | --- | --- |
| `FT-01` | Read workspace context | A successful `read_file`, the fixture value in the tool result sent to the next provider decision, a completed turn, and the expected value in the final answer. |
| `FT-02` | Read, repair, verify | Successful `read_file` → `replace_file_content` → `read_file`; tool replies arrive before subsequent decisions; repaired implementation is persisted and reread. |
| `FT-03` | Invalid-argument recovery | Invalid arguments produce a failed tool record; a later valid read succeeds; the turn completes. |
| `FT-04` | Transient provider failure | The first provider request returns HTTP 503; the retry reaches the fixture exactly once; the response completes the turn. |
| `FT-05` | In-flight cancellation | The fixture blocks until the caller aborts; the turn outcome and exactly one terminal progress event are `cancelled`; no `completed` terminal is emitted. |

The expected outcomes are deliberately implementation-specific where the object under test is a harness contract, such as the order of tool dispatch or terminal progress status. This is suitable for a conformance suite. A future task-solving benchmark needs outcome-level tests that allow multiple valid implementations.

## Scoring and interpretation

- Each scenario is pass/fail: every required assertion must pass.
- The suite passes only when all five scenarios pass. There is no weighted score, percentage leaderboard, or partial-credit headline.
- Assertion counts, tool-call counts, and durations are diagnostics for debugging. Durations depend on the host and are not a latency or throughput claim.
- Do not call repeated runs of this fixed script `pass@k` or `pass^k`. Repetition can detect harness flakiness, but it does not create independent model attempts.
- Report failures, timeouts, cancellations, and provider errors as outcomes. Do not remove them from the denominator after seeing results.

## Reproduce locally

Use Node.js 22.12 or later with repository dependencies installed:

```sh
npm ci
npm run benchmark:flight
npm run benchmark:flight -- --output /tmp/heav3ns-flight-report.json
npm run --silent benchmark:flight -- --format json
```

The command does not require a provider key or network access. The `fetch` trap accepts only the reserved `.invalid` endpoint and throws for any other provider URL. It temporarily clears `OPENAI_API_KEY` and restores the original value and `fetch` implementation in `finally`. Scenarios operate on disposable temporary workspaces and the runner removes them after the run. The harness test is not an operating-system network sandbox; it does not constrain arbitrary native sockets outside the exercised provider path.

## Report contract

The [version 2 JSON Schema](report-schema-v2.json) is the artifact contract. The report includes benchmark and report-schema versions, track, provider type, start/finish timestamps, runtime, source commit, dirty-worktree state, scenario outcomes, assertion details, tool-call counts, diagnostic durations, and a SHA-256 digest with its input-file list. The digest covers package manifests, the workflow, fixtures, and the engine, provider gateway, factory, scheduler, registry, contracts, CLI, summary writer, schema, and benchmark runner exercised here. It identifies these declared inputs when the worktree is dirty; it is not a digest of every file in the repository.

Reports omit prompts, fixture contents, API credentials, and raw provider conversation bodies. A failed assertion can include sanitized tool error details. CI uploads one JSON artifact per supported Node LTS line, and a short summary with a direct report link is shown on the workflow run. The summary is for navigation; the JSON artifact is the detailed record.

## Scope limits

This v0.3.0 suite covers five scripted integration paths. It does not evaluate live-model tool selection, code quality, unseen issue resolution, user trust, approvals, shell execution, generalized filesystem containment, full terminal UI behavior, or provider equivalence. `FT-02` tests `replace_file_content`'s exact-block behavior; it does not validate whole-file write aliases. Passing these checks is evidence of these contracts only.

## Growth path: agent-system execution track

Keep v0.3.0 harness conformance separate from a project-scale track. The new track measures the complete agent system—harness, provider adapter, tools, and project environment—by verified task completion, execution time, and continuity. It is not a model-quality leaderboard. For controlled comparisons, pin the same model/version, decoding settings, context and tool budgets, host resources, network policy, and project commit. Products that cannot use the shared model/version belong in separate cohorts and must not be ranked against the controlled cohort.

### Project workloads and independent oracles

- **Game development:** complete a bounded feature or bug fix. Verify the build, deterministic simulation/unit tests, and a fixed playable smoke path.
- **Web design:** complete a responsive interface task in a pinned browser and viewport set. Verify behavior, accessibility assertions, layout constraints, and saved reference screenshots. Keep any subjective visual review as a separate, blinded measure.
- **Project knowledge:** answer and update facts from versioned repository sources. Verify source-span citations, contradiction handling, and retrieval of the persisted update after an agent restart.

Publish each task, project commit, environment image, acceptance test, and verifier before running agents. Reset to the pinned commit for each independent trial. The verifier must inspect the project state directly; an agent's final claim cannot make a task pass.

### Long-lived project run

Keep each project workspace for a 72-hour run spanning three sessions or process restarts. Sequence dependent tasks in the same repository, then inject a restart, an environment change, a transient provider failure, a cancellation, and a resume. Check that edits and checkpoints survive, follow-up work uses current project state, cancellation leaves no later writes, and the final report matches the diff and verifier output. Run three independent long-lived trials per project type.

### Trial protocol and metrics

Run at least 30 paired, randomized trials per task in the controlled cohort. Pair each agent-system run on the same task and project commit; randomize run order. Keep every failure, timeout, cancellation, and incomplete result in the completion denominator. Record the pinned model and agent versions, runtime, host limits, task and verifier versions, timestamps, tool and model calls, token counts, diffs, test output, permission events, cancellation events, and run artifacts.

- **Verified completion:** independent verifier passes divided by all attempts, reported by project and task.
- **Execution speed:** time from prompt acceptance to an independent verifier pass. Report median and p90 among verified completions alongside the completion rate; publish timeout budgets and failed-run outcomes. Break out setup, model wait, tool execution, verification, and handoff time.
- **Continuity:** follow-up tasks completed after restart, with state loss, stale-state errors, or duplicate edits reported explicitly.
- **Trust gate:** require no out-of-scope writes, no post-cancellation writes, preserved reviewable diffs, and completion claims backed by logs/tests. Report citations and artifact traceability for knowledge and web tasks.

Publish separate game, web, and knowledge boards, each with two independent rankings: verified completion rate and median time from prompt acceptance to an independently verified pass. Show p90 verified time, completion rate, failures, and timeouts alongside the speed ranking so fast results cannot hide a low completion rate. A trust-gate failure makes a run ineligible for either ranking. Do not combine the rankings into a model score or a single opaque composite. This track is proposed; the current v0.3.0 suite has not run these project trials.

Start with a small declared subset as a calibration study. Expand only after oracle stability, verifier alignment, resource limits, and trajectory review pass. Treat public tasks as potentially exposed to model training; avoid claiming contamination resistance unless the data access and curation actually support it.

## Why these precedents

- **SWE-bench:** its original design pairs real GitHub issues and repositories with programmatic patch tests. SWE-bench Verified added expert review, but OpenAI's February 2026 audit found material verifier/specification problems and training contamination, and it stopped reporting that score for frontier launches. We cite it as a lesson in realism and curation—and as a warning that even a widely adopted benchmark can age—not as today's recommended score for HEAV3NS. [Original SWE-bench paper](https://arxiv.org/abs/2310.06770), [OpenAI's 2026 audit](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/).
- **Terminal-Bench and Harbor:** task instructions, environments, and verifiers are explicit; quality guidance emphasizes clear objectives and robust outcome verification. Terminal-Bench 4.0 describes task/resource calibration, removing saturated tasks, fixing flaky tasks, and semantic benchmark versioning. Its maintainers also publish integrity policies and trajectory review. Those practices inform workload design, verifier review, and artifact retention for the proposed agent-system track; they do not change the scope of the current scripted suite. [Terminal-Bench 4.0](https://www.tbench.ai/news/terminal-bench-4-0), [good task guidance](https://www.tbench.ai/news/writing-a-good-terminal-bench-task), [Harbor evaluations guide](https://github.com/harbor-framework/docs/blob/main/guides/running-evaluations.mdx), [leaderboard integrity policy](https://www.tbench.ai/news/leaderboard-integrity-update).
- **τ-bench:** `pass^k` highlights reliability across repeated independent agent attempts. It supports our rule to keep fixed scripted retries separate from live-model reliability claims. [τ-bench paper](https://arxiv.org/abs/2406.12045).
- **Node.js support policy:** the CI matrix follows supported LTS lines rather than a single developer machine runtime. Recheck the official release schedule when changing the matrix. [Node.js release schedule](https://nodejs.org/en/about/previous-releases).
- **GitHub Actions and Copilot review:** a short job summary, downloadable artifact, commit-associated checks, actionable review feedback, and human-owned approval make evidence visible in a familiar workflow. [Workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts), [job summaries](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands), [protected-branch checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [Copilot code review](https://docs.github.com/en/copilot/concepts/agents/code-review).
