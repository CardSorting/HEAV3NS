# ADR-130: Enterprise Background Daemon Process Supervisor, Process Matrix & Watchdogs

## Status
Accepted (Phase 100)

## Context
Enterprise agents frequently require persistent background services (e.g. databases, local servers, sync watchers, mock API servers). Without a dedicated process supervisor with automatic health probing and crash recovery, background processes risk orphan execution, unmonitored failures, and noisy log sprawl.

## Decision
Implement the Enterprise Daemon Process Supervisor within the LUMI AKD-DSO Monolith architecture:
1. **Isolated Process Lifecycle**: Spawning, graceful SIGTERM/SIGKILL escalation cascades, and process grouping.
2. **500-Line Log Ring Buffers**: High-capacity in-memory ring buffers per process with ANSI escape code stripping for crystal-clear readability.
3. **Multi-Protocol Health Probes**: Active TCP socket, HTTP endpoint, PID liveness, and EXEC command probes with configurable intervals and timeouts.
4. **Auto-Healing Watchdogs**: Exponential backoff governors, failure counters, and maximum restart ceilings.
5. **Process Matrix Dashboard**: Clean ASCII dashboard table modeled after Docker Desktop and PM2.
6. **Model Tool Suite**: 9 deterministic tools (`daemon_spawn`, `daemon_stop`, `daemon_restart`, `daemon_tail_logs`, `daemon_get_dashboard`, `daemon_probe_health`, `daemon_list`, `daemon_configure`, `daemon_get_health`).

## Consequences
- Robust management and auto-healing of all background dependencies.
- Clear, approachable operational observability for non-technical users.
- Contiguous memory footprint and zero leak invariants during long-running tasks.
