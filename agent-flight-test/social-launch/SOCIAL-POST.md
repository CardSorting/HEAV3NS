# Agent Flight Test social launch

## Publish order

Post the seven PNGs in `slides-expanded/` in numeric order. They are 1080 × 1350 exports of `Agent-Flight-Test-Launch-Expanded.pptx`. The original `slides/` folder is the earlier five-slide export.

## Suggested caption

The current HEAV3NS Agent Flight Test baseline passes all five scripted harness scenarios. That confirms selected execution contracts, not task-solving speed.

The next track is designed to compare complete agent systems on game development, responsive web work, and project knowledge tasks. It publishes separate verified-completion and execution-speed rankings by project domain, alongside p90 timing, failures, and whether the system preserves project state across a 72-hour, multi-session run. Trust checks gate eligibility; model quality is not ranked.

Run the current baseline with Node.js 22.12+ after installing repository dependencies:

    npm ci
    npm run benchmark:flight

The current command needs no API key or live-model request. It does not run the proposed project-scale comparison. Read the [current protocol and planned track](https://github.com/CardSorting/HEAV3NS/tree/main/agent-flight-test).

## Alt text

1. An experimental jet climbs above bright clouds. The cover introduces the measured harness baseline and a proposed project-scale benchmark for speed, verified completion, and long-run continuity.
2. An illustrative jet flies above clouds at sunset. The slide maps current coding-agent surfaces: local and IDE tools, and hosted asynchronous agents. It places HEAV3NS as a local-first CLI harness and says the map is not a capability ranking.
3. A dark runway with red and cyan lights sits behind five harness scenarios: context readback, edit and reread, invalid-argument recovery, HTTP 503 retry, and in-flight cancellation. Each scenario shows its passed assertion count.
4. An illustrative flight-test recorder sits on a lab bench. The slide reports the actual v0.3.0 local run: 5/5 scenarios and 24/24 checks passed; 279 ms is labeled diagnostic, not task latency.
5. Five rows define proposed project workloads: game development, responsive web design, project knowledge, linked follow-up tasks, and independent outcome checks.
6. Five rows define the proposed system benchmark: 72-hour continuity, verifier-based completion, prompt-to-pass speed, trust checks, and separate completion and speed rankings by domain. The slide labels the comparison as proposed, not measured.
7. An aircraft waits at the end of a runway at sunrise. The slide shows `npm ci` and `npm run benchmark:flight`, explains the current no-key harness run, and links to the benchmark protocol.
