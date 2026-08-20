# ADR-084: Attempt Completion Gate Strategy & Autonomous Turn Progression

- **Status**: Accepted
- **Date**: 2026-08-13
- **Scope**: Autonomous multi-attempt turn execution, dynamic quality gate evaluation, structured corrective feedback synthesis, and self-healing loops without manual user feedback

## Context

In complex multi-step coding agent environments, turns often encounter transient provider anomalies, recoverable tool failures, missing output segments, or incomplete file mutations. When an agent loop halts immediately upon encountering such non-terminal issues and prompts the user for manual feedback or next steps, it breaks the flow of autonomy, creating unnecessary friction and cognitive load for the user.

Previously, `RoadmapCompletionGate` validated only static, pre-evaluated boolean criteria lists and lacked dynamic context evaluators, incremental evidence collection, autonomous corrective feedback generation, and multi-attempt retry execution.

## Decision

LUMI adopts an apex / sovereign-tier, industry-standard **Attempt Completion Gate Strategy** across the engine, tooling, and test harnesses:

1. **Phased Evaluation Taxonomy & Categorization**:
   Gates support multi-phase lifecycle checkpoints (`admission`, `in_flight`, `completion`, `postmortem`) and severity classifications (`critical`, `high`, `medium`, `low`, `advisory`) across core dimensions (`integrity`, `safety`, `correctness`, `quality`, `performance`, `governance`, `admission`).

2. **Dynamic Gate Criteria with Evaluators**:
   `RoadmapCompletionGate` supports dynamic asynchronous and synchronous criteria evaluators (`DynamicGateCriteria` and `CriterionEvaluatorFn`) capable of inspecting the full attempt execution context (`AttemptGateEvaluationContext`), including prompt text, response candidates, tool call inputs and outputs, execution error messages, and execution metadata.

3. **Fail-Closed Evidence Integrity & Incremental Recording**:
   Gates remain fail-closed: an execution gate is allowed to proceed only when it is registered, has defined required criteria, and all required criteria are explicitly evaluated and passed. Evidence can be recorded incrementally (`recordCriterionEvidence`, `batchRecordEvidence`) or reset across passes (`resetGateEvidence`).

4. **Multi-Attempt Autonomous Execution Loop**:
   `executeAutonomousAttemptLoop` orchestrates automatic attempt iteration up to `maxAttempts`. When attempt $N$ fails quality gates, synthesized feedback and cognitive directives are injected into attempt $N+1$, allowing the agent to self-correct without user intervention.

5. **Differential Attempt Analysis & Regression Detection**:
   `computeAttemptDiff` compares successive attempts to compute exact delta metrics (`newlyPassing`, `newlyFailing`, `stagnantFailing`, `scoreDelta`), identifying whether an attempt made progress or introduced regressions.

6. **Deterministic State Fingerprinting & Zero-Delta Stagnation Traps**:
   `computeAttemptFingerprint` generates SHA-256 hashes of response candidates and tool execution records. If an attempt produces identical failing outputs without changes, the system flags `[ZERO_DELTA_STAGNATION_TRAP]` and immediately escalates the strategy to `PIVOT_APPROACH` or `SIMPLIFY_SCOPE`.

7. **Forensic Flight Recording & Blackbox Audit Ledgers**:
   `AttemptFlightRecorder` maintains an immutable chronological event timeline for all evaluator runs, score deltas, duration metrics, and decision boundaries, exporting both machine-readable JSON logs and formatted Markdown postmortem reports (`generateFlightLogMarkdown`).

8. **Direct Quantitative Criterion Scoring (`CriterionScoreEvaluator`)**:
   Eliminates subjective voting matrices and quorum locks in favor of direct, objective quantitative scoring ($S = \frac{\sum w_{\text{passed}}}{\sum w_{\text{total}}} \times 100$), ensuring instantaneous mathematical evaluation with zero deadlock risk.

9. **Flattened Single-Pass Candidate Arbitration**:
   `evaluateAttemptCandidates` deterministically scores and ranks parallel candidate branches in a single clean pass, sorting by pass rate, score optimization, and minimal critical violations, guaranteeing forward progression and decisive selection.

10. **Hierarchical DAG Gate Pipelines**:
    `GatePipelineDag` organizes gate evaluation into Directed Acyclic Graphs with topological dependency ordering and upstream failure short-circuiting.

11. **Self-Correction Diagnostic Micro-Patch Synthesis**:
    `DiagnosticPatchSynthesizer` parses compiler diagnostics (`TS\d+`), module resolution (`ENOENT`, `ERR_MODULE_NOT_FOUND`), permission violations (`ERR_FS_PERMISSION`), non-zero process exit codes, and tool failures into line-anchored micro-patch suggestions for the next attempt.

12. **Tri-State Circuit Breakers & Divergence Sentinel**:
    `RoadmapCompletionGate` implements a self-healing `CLOSED` $\to$ `OPEN` $\to$ `HALF_OPEN` state machine with canary probe trial recovery. `deriveRemediationDirective` integrates a Divergence Sentinel that detects severe regressions ($\ge 20\%$ score drop or broken safety invariants) and synthesizes a `RESTORE_CHECKPOINT` directive to unwind breaking changes. In addition, `AgentEngine` uses phase-aware watchdogs (180s reasoning, 300s tool execution) with active heartbeat sensing.

13. **Standard Strategy Factories**:
    `AttemptCompletionGateStrategy` provides turnkey gate definitions:
    - `createAdmissionGate`: validates pre-flight token budgets and registered tool availability.
    - `createResponseVerificationGate`: ensures non-empty content and zero unhandled errors.
    - `createAutonomousRepairGate`: ensures file repair mutation was staged/written and syntax diagnostics are clean.
    - `createTriadAuditGate`: ensures Architect, Critic, and SRE triad perspectives are present with severity & category taxonomy.
    - `createBenchmarkWorkloadGate`: ensures workload completion and assertion satisfaction.
    - `createSecurityGuardrailGate`: ensures command safety verification and credential containment.

14. **Harness & Engine Integration**:
    `AgentLoopHarness` implements `runAutonomousGatedTurn` to verify multi-attempt progression and self-recovery with structured timeline events (`gate_evaluation`, `autonomous_feedback`, `auto_retry`). `AgentEngine` integrates `RoadmapCompletionGate` into live provider dispatch loops for verified turn completion.

## Consequences

- **Autonomous Self-Correction**: Minor errors, tool failures, and incomplete responses are resolved internally in attempt $N+1$ without user intervention.
- **Zero-Delta Stagnation Elimination**: Prevents token-burning loops where the model repeats identical failing outputs.
- **Forensic Observability**: Blackbox flight logs capture exact execution traces, durations, and state transitions.
- **Anti-Flapping & Regression Protection**: Differential analysis prevents regressions and breaks infinite repair loops.
- **Circuit Breaker Safety**: Prevents runaway token consumption during systemic provider or environment failures.
- **Fail-Closed Safety**: Incomplete or failing attempts cannot masquerade as successful completions.
- **Zero Overhead**: Normal successful turns pass gates on attempt 1 in sub-millisecond evaluation time without added latency.
- **Full Traceability**: All attempts, gate evaluation results, per-criterion duration metrics, attempt diffs, and injected feedbacks are retained in attempt history and telemetry events.
