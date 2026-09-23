# Product launch, adoption, and trust

## Positioning

### The mission

**HEAV3NS is a focused coding agent for developers who want to move from intent to a reviewable, verified change while staying in command.** The core value is the tight loop: find context, make a scoped change, run a check, inspect the result.

### The fighter-jet story

**Every agent has a flight profile.** Cargo planes are built to carry the operation. Fighter jets are built to make a fast, precise turn. HEAV3NS takes the fighter-jet mission: one developer-directed coding task, close to the code, with the pilot able to inspect the work and choose what ships.

The metaphor is about a mission profile, not a ranking. Cargo capacity is useful; this product is for the shorter, more maneuverable coding loop. “Break the sound barrier” is the north star: remove avoidable drag between an idea and evidence that the change works. It is not a claim that HEAV3NS currently has the lowest latency, highest task-success rate, or safest autonomy.

**Hero headline:** Your cockpit for the tight coding loop.

**Hero subhead:** Move from a coding task to a verified, reviewable change with an agent you can steer.

**Launch one-liner:** Precision at speed. Pilot in command.

**Short public description:** HEAV3NS is a local-first coding agent for focused developer missions. It helps inspect a codebase, make a scoped change, and verify the result in your workspace. The Agent Flight Test makes selected harness behavior reproducible; it does not measure live-model coding ability.

### Evidence attached to the story

The launch narrative should follow this sequence in a product demo and README:

1. **Mission:** one concrete coding task with a bounded goal.
2. **Context:** show the files or evidence the agent actually inspected.
3. **Maneuver:** show the focused change and the execution state.
4. **Flight check:** show the relevant verification command and its actual output.
5. **Handoff:** inspect the diff; the developer decides what to keep, commit, or merge.

The metaphor stays in the headline and section names. Product instructions, permissions, failures, and progress messages should use plain words such as *read*, *edit*, *run*, *cancel*, *review*, and *retry*. Avoid turning core controls into aviation jargon.

## Familiar patterns users already understand

| Familiar product pattern | What users know already | HEAV3NS implementation |
| --- | --- | --- |
| GitHub Copilot review comments and suggested changes | Review feedback is attached to the change; people can inspect and apply suggestions individually. | Demo the actual diff and test output in context. Keep the final review decision visible. Do not imply that AI review itself is approval. [GitHub Copilot code review](https://docs.github.com/en/copilot/concepts/agents/code-review) |
| GitHub checks on a pull request | A named check belongs to a specific commit and has a clear pass/fail state. | The `Agent Flight Test (Node 22.x)` and `(Node 24.x)` checks run separately. Each report includes the tested revision and a digest plus file list for the declared benchmark inputs. Any future branch-protection requirement should be an explicit repository-owner choice. [GitHub protected-branch checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) |
| GitHub Actions job summary plus downloadable artifacts | Read the short result first; open logs or download the detailed artifact when something needs investigation. | Put scenario outcomes and failed assertions in the run summary, and attach the JSON report per Node line. Keep the full detail out of a wall of console output. [Job summaries](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands), [workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts) |
| npm's project-local scripts | One command works from the repository root and can be copied into local or CI use. | Use `npm run benchmark:flight`; support `--output <path>` for an artifact and `npm run --silent benchmark:flight -- --format json` for a clean JSON stream. No API key is required for the conformance track. |
| Guided first-run flows in developer tools | Start with a small success, then unlock more advanced work after users understand the controls. | Start with an inspect-only mission, then a one-file edit, a review, a test run, and finally a multi-step task. Explain each execution state in plain language. |

GitHub's review flow is the closest trust analogue: make feedback actionable and visible where the change is reviewed, while preserving human review. Its status-check pattern makes evidence discoverable at the commit. The Flight Test follows the same shape: concise status near the run, inspectable failures, and a detailed artifact for reviewers.

## Adoption path

### 1. Discover: show one real mission

Publish a short terminal recording with a fresh repository and a bounded issue. Show the prompt, relevant context, tool activity, resulting diff, test command, and handoff. Name the exact HEAV3NS revision and provider/model used. Do not cut out retries, permission prompts, or failed attempts that materially change what the viewer would expect.

### 2. Try: make the first command predictable

The README should put prerequisites, install steps, provider setup, and the expected first result next to each other. Lead with the no-key Flight Test for contributors who want to check their install; label it clearly as harness conformance. Keep the live-provider quick start separate and disclose that it needs provider credentials and may incur usage costs before the first request.

### 3. Understand: teach the control surface in small steps

Use a starter mission that only reads files first. Then let the user ask for a one-file change and inspect it before any broader workflow. Show what was changed, what was verified, and what still needs a human decision in one final summary.

### 4. Trust: explain boundaries at the moment they matter

Name which operations are read-only, which change the workspace, and which reach external systems. Make cancellation and recovery discoverable. Describe permission and approval behavior only where the running product and its tests establish that exact behavior. The scripted benchmark is not evidence for live-model judgment or general filesystem isolation.

### 5. Retain: fit the daily coding loop

Prioritize repository context, keyboard flow, useful test output, recoverable sessions, and a patch that is easy to review with standard Git tools. Ask for feedback after a meaningful completed task, make it opt-in, and never make trust depend on hidden telemetry.

## Public pull-request experience

The benchmark PR should work like a small, ordinary repository contribution: open the checks, see the result, inspect a report, and leave review comments without needing private setup.

Use the [copy-ready public PR draft](PUBLIC-PR.md) for the title, evidence fields, scope statement, and reviewer questions. Fill its CI links from the actual run after both matrix entries finish.

1. **Start with a clean README path.** The Flight Test page gives the Node requirement, `npm ci`, the one-command run, how to save JSON, what the tests cover, and what they cannot prove.
2. **Give the check a clear name.** CI runs on Node 22 and 24, the supported LTS lines at launch. The harness check has its own matrix job, so an earlier lint or unit-test failure in the broader workflow does not erase its result.
3. **Put the short answer in the PR workflow view.** The job summary lists each scenario and failed assertions. Reviewers should not need to open a long build log to know what failed.
4. **Keep a detailed, commit-keyed artifact.** Upload the report for each matrix line and retain it for a declared period. The report includes commit, benchmark-input digest and file list, runtime, protocol/schema versions, task outcomes, and diagnostics.
5. **Use explicit CI permissions and pinned actions.** The benchmark job needs read-only repository access and no model credentials. Keep third-party action references pinned to full commit SHAs.
6. **Review the claim as part of the code.** PR body: intent, scope, exact local command, CI evidence, known limits, and reviewer questions. Invite contributors to challenge a verifier or add a scenario; require an outcome oracle and an explanation of how it can fail.
7. **Keep the merge decision human.** Green checks show that the declared suite passed. They do not establish safety, quality, benchmark leadership, or a substitute for code review.

For every new scenario, review the instruction, scripted provider sequence, failure case, fixture, and oracle together. Validate that the scenario fails when its required behavior is absent, and that reasonable alternate outcomes are not rejected by an unnecessarily narrow assertion. This follows the task-quality emphasis on clear instructions, outcome-based verifiers, and public iteration in Terminal-Bench. [Task-quality guidance](https://www.tbench.ai/news/writing-a-good-terminal-bench-task), [Terminal-Bench contribution review](https://github.com/harbor-framework/terminal-bench/blob/main/CONTRIBUTING.md).

## Product release sequence

### Preview

- Land the local Flight Test and methodology with the product README links.
- Publish the exact result from the pull request and show the current terminal flow in a short demo.
- Invite developers to try a bounded task and submit feedback through an issue template that asks for HEAV3NS revision, operating system, Node version, provider/model if applicable, expected result, and observed result.
- Fix harness failures, confusing setup, and permission-state gaps before expanding the claim.

### General availability gate

- `npm run benchmark:flight` works from a fresh install with no credentials.
- Both supported Node LTS jobs run and retain per-run reports.
- `npm test` reaches the unit and benchmark stages; repository lint, type check, and docs checks pass.
- The demo and onboarding use current UI and do not hide material prompts, failures, or costs.
- Public copy separates measured harness facts from product goals and live model behavior.
- Changelog explains user-visible changes and recovery or migration needs.

### Agent-system benchmark (planned)

Keep the current five-scenario result labeled as harness conformance. The next track should compare complete agent systems on game, web-design, and project-knowledge tasks while measuring verified completion, prompt-to-pass time, and continuity across a 72-hour multi-session run. Use a shared pinned model/version and matched host, tool, and task budgets where supported; publish separate cohorts when systems cannot use the same model. Publish separate completion-rate and median-speed rankings by project type, with p90 times and failures visible beside speed results. Trust checks gate eligibility. Do not publish a model-quality ranking or imply that the current v0.3.0 result measures project task success. The detailed protocol is in [Methodology](METHODOLOGY.md).

## Adoption and trust measures

Instrument only with clear notice and opt-in. Define each measure before collecting it:

| Measure | Definition to publish | Product decision it informs |
| --- | --- | --- |
| First-task activation | New installs that complete one bounded task / eligible first runs, over a stated window. | Setup friction and onboarding. |
| Time to first verified change | Elapsed time from first run to a developer-reviewed change with a passing relevant check; publish median and sample size. | Whether the first mission is sized well. |
| Diff disposition | Opt-in sessions where the user keeps, edits, or discards the agent's proposed changes. | Whether changes are useful and reviewable. |
| Recovery success | Interrupted tasks safely resumed or abandoned / interrupted tasks. | Cancellation and recovery ergonomics. |
| Repeat use | Users returning for another task in a stated period / users with a completed first task. | Durable daily value. |
| Trust comprehension | Users who can correctly explain what changed, what ran, and what needs their decision. | Whether status and handoff are clear. |

For each measure, publish denominator, time window, collection method, retention period, and opt-in policy. Do not treat a benchmark pass as a trust or adoption score.

## Claim guardrails

### Supported by the current Flight Test

- It runs a deterministic local suite against the real `AgentEngine` and selected registered tools.
- It exercises five named scenarios for workspace read, edit/readback, argument validation, provider retry, and cancellation.
- It needs no model API key and reports commit/runtime/scenario details.

### Not supported by the current Flight Test

- “Fastest,” “breaks the sound barrier,” or any cross-product ranking.
- Live-model task success, SWE-bench or Terminal-Bench score, or model reliability.
- “Zero-risk,” “fully autonomous,” general sandboxing, or universal approval guarantees.
- User adoption, satisfaction, or trust claims.

Use the evocative flight language to make the product memorable; let reviewable diffs, actual checks, and honest limits make it credible.
