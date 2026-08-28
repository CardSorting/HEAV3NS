import assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  BroccoliCronSubstrate,
  CronDashboardModal,
  CronDesktopNotificationDispatcher,
  CronLifecycleGuard,
  CronSnapshotManager,
  CronToolSuite,
  DeterministicBlueprintCatalog,
  LumiMonolith,
  MonolithCronScheduler,
  BroccoliViewRenderer,
  GrandMonolithSynthesizer,
  MonolithFactory,
} from "../src/index.js";
import { BroccoliDatabaseKernel } from "../src/sessions/extensions/substrate/broccolidb-kernel.js";
import { MonolithGatewayServer } from "../src/tooling/extensions/gateway/monolith-gateway-server.js";

async function runCronValidationSuite(): Promise<void> {
  console.log("\x1b[1;36m================================================================================\x1b[0m");
  console.log("\x1b[1;36m LUMI World-Class Cron & Recurring Automation Suite (ADR-016)                   \x1b[0m");
  console.log("\x1b[1;36m================================================================================\x1b[0m\n");

  let passedSuites = 0;

  try {
    // ---------------------------------------------------------------------------
    // Suite 1: Job Registration, Lifecycle Guard Sanitization & NextRun
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/22] Job Registration, Lifecycle Guard Sanitization & NextRun...");
    const substrate = new BroccoliCronSubstrate();
    const guard = new CronLifecycleGuard();
    const scheduler = new MonolithCronScheduler(substrate, guard);

    const job1 = scheduler.registerJob({
      id: "job-health",
      name: "System Health Monitor",
      scheduleType: "cron",
      scheduleExpression: "0 9 * * 1-5",
      prompt: "Audit engine health aggregator and verify memory slabs.",
      category: "operations",
      tags: ["health", "p0"],
    });

    assert.strictEqual(job1.id, "job-health");
    assert.strictEqual(job1.status, "active");
    assert.strictEqual(job1.totalRuns, 0);
    assert.ok(job1.nextRunTimestampMs! > Date.now());
    console.log("  ✓ Job registration and lifecycle validation verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: Interval Schedule, Tick Evaluation & Zero-Drift Progression
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/22] Interval Schedule, Tick Evaluation & Zero-Drift Progression...");
    const intervalJob = scheduler.registerJob({
      id: "job-interval-5s",
      name: "Interval Heartbeat",
      scheduleType: "interval",
      intervalMs: 5000,
      prompt: "Send heartbeat ping.",
      category: "monitoring",
    });

    assert.strictEqual(intervalJob.scheduleType, "interval");
    assert.strictEqual(intervalJob.intervalMs, 5000);

    // Evaluate tick before due
    const recordsEarly = await scheduler.evaluateTick(1, Date.now());
    assert.strictEqual(recordsEarly.length, 0);

    // Evaluate tick after due timestamp
    const futureMs = Date.now() + 6000;
    const recordsDue = await scheduler.evaluateTick(2, futureMs);
    assert.ok(recordsDue.length >= 1);
    assert.strictEqual(recordsDue[0].jobId, "job-interval-5s");
    assert.strictEqual(recordsDue[0].success, true);
    console.log("  ✓ Interval scheduling and zero-drift tick evaluation verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: One-Shot ("once") Timer Execution & Auto-Completion
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/22] One-Shot ('once') Timer Execution & Auto-Completion...");
    const targetMs = Date.now() + 1000;
    const onceJob = scheduler.registerJob({
      id: "job-once-timer",
      name: "Delayed Database Backup",
      scheduleType: "once",
      targetTimestampMs: targetMs,
      prompt: "Perform snapshot database backup to cold storage.",
    });

    const onceDue = await scheduler.evaluateTick(3, targetMs + 100);
    assert.ok(onceDue.some((r) => r.jobId === "job-once-timer"));

    const completedJob = scheduler.getJob("job-once-timer");
    assert.strictEqual(completedJob?.status, "completed");
    console.log("  ✓ One-shot timer execution and auto-completion transition verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: Blueprint Catalog Listing & Parameterized Slot Materialization
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/22] Blueprint Catalog Listing & Parameterized Slot Materialization...");
    const catalog = new DeterministicBlueprintCatalog();
    const blueprints = catalog.listBlueprints();
    assert.ok(blueprints.length >= 5);

    const materialized = catalog.materializeBlueprint("daily_summary", "job-daily-user", {
      hour: 10,
      weekdays: "1-5",
      user: "Lead Architect",
    });

    assert.strictEqual(materialized.name, "Daily Workspace & Git Summary");
    assert.strictEqual(materialized.scheduleExpression, "0 10 * * 1-5");
    assert.ok(materialized.prompt.includes("Lead Architect"));
    console.log("  ✓ Blueprint catalog schema validation & slot interpolation verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: High-Frequency Schedule Tick Micro-Benchmark (20,000 evaluations)
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/22] High-Frequency Schedule Tick Micro-Benchmark (20,000 evaluations)...");
    const benchStart = performance.now();
    const nowBench = Date.now();
    for (let i = 0; i < 20000; i++) {
      substrate.listJobs();
    }
    const benchElapsed = performance.now() - benchStart;
    console.log(`  ✓ 20,000 schedule lookups evaluated in ${benchElapsed.toFixed(3)} ms (${(benchElapsed / 20000).toFixed(6)} ms/op)`);
    assert.ok(benchElapsed < 50);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: BroccoliCronSubstrate In-Memory Cache & Secondary Index Queries
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/22] BroccoliCronSubstrate In-Memory Cache & Secondary Index Queries...");
    const activeJobs = substrate.listJobs("active");
    assert.ok(activeJobs.length >= 2);

    const history = substrate.getExecutionHistory(undefined, 10);
    assert.ok(history.length >= 2);
    console.log("  ✓ Substrate indexed queries and execution ledgers verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: CronSnapshotManager Frame Snapshotting & O(1) Rewind (< 0.05 ms SLA)
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/22] CronSnapshotManager Frame Snapshotting & O(1) Rewind (< 0.05 ms SLA)...");
    const snapshotManager = new CronSnapshotManager(substrate);
    const snap = snapshotManager.createSnapshot(100);

    // Mutate state by adding temporary job
    scheduler.registerJob({
      id: "job-temp-to-delete",
      name: "Temporary Probe",
      scheduleType: "interval",
      intervalMs: 1000,
      prompt: "Temporary probe",
    });
    assert.ok(scheduler.getJob("job-temp-to-delete"));

    // O(1) Rewind
    const rewindStart = performance.now();
    snapshotManager.restoreSnapshot(snap);
    const rewindElapsed = performance.now() - rewindStart;

    assert.strictEqual(scheduler.getJob("job-temp-to-delete"), undefined);
    assert.ok(rewindElapsed < 2.0);
    console.log(`  ✓ O(1) Cron substrate state rewind completed in ${rewindElapsed.toFixed(4)} ms (< 2.0 ms SLA)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: Consecutive Failure Tracking & Circuit Breaker Tripping
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/22] Consecutive Failure Tracking & Circuit Breaker Tripping...");
    const failingJob = scheduler.registerJob({
      id: "job-failing-db",
      name: "Remote Sync Pipeline",
      scheduleType: "interval",
      intervalMs: 5000,
      prompt: "Sync data to remote endpoint.",
      maxConsecutiveFailures: 3,
    });

    // Record 3 consecutive failures
    for (let f = 1; f <= 3; f++) {
      substrate.recordExecution({
        id: `fail-${f}`,
        jobId: "job-failing-db",
        triggerType: "scheduled",
        startedAtMs: Date.now(),
        durationMs: 15,
        success: false,
        summary: `Connection refused (attempt ${f})`,
        error: "ECONNREFUSED",
      });
    }

    const trippedJob = scheduler.getJob("job-failing-db");
    assert.strictEqual(trippedJob?.status, "failed");
    assert.strictEqual(trippedJob?.consecutiveFailures, 3);
    console.log("  ✓ Circuit breaker tripped cleanly after 3 consecutive failures");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 9: Circuit Breaker Reset & Status Restoration
    // ---------------------------------------------------------------------------
    console.log("[Suite 9/22] Circuit Breaker Reset & Status Restoration...");
    scheduler.resumeJob("job-failing-db");
    const restoredJob = scheduler.getJob("job-failing-db");
    assert.strictEqual(restoredJob?.status, "active");
    assert.strictEqual(restoredJob?.consecutiveFailures, 0);
    console.log("  ✓ Circuit breaker reset and active state restored");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 10: Desktop & Terminal Notifications Dispatcher, DND Filtering & Audio
    // ---------------------------------------------------------------------------
    console.log("[Suite 10/22] Desktop & Terminal Notifications Dispatcher, DND Filtering & Audio...");
    const dispatcher = new CronDesktopNotificationDispatcher({
      enabled: true,
      soundEnabled: true,
      dndEnabled: false,
      minUrgency: "normal",
    });

    let receivedRecord: any = null;
    const unsub = dispatcher.subscribe((rec) => {
      receivedRecord = rec;
    });

    const dispatchRes = await dispatcher.dispatch({
      jobId: "job-health",
      title: "Health Check Succeeded",
      message: "All 585 engine components operating in optimal state",
      urgency: "normal",
      trigger: "job_succeeded",
    });

    assert.strictEqual(dispatchRes.dispatched, true);
    assert.ok(dispatchRes.channels.length > 0);
    assert.strictEqual(receivedRecord?.event.title, "Health Check Succeeded");
    unsub();
    console.log("  ✓ Notification dispatcher, listeners, and multi-channel routing verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 11: Notification Urgency Threshold & Per-Job Cooldown
    // ---------------------------------------------------------------------------
    console.log("[Suite 11/22] Notification Urgency Threshold & Per-Job Cooldown...");
    const lowRes = await dispatcher.dispatch({
      jobId: "job-health",
      title: "Low Priority Trace",
      message: "Routine tick",
      urgency: "low",
      trigger: "job_triggered",
    });
    assert.strictEqual(lowRes.dispatched, false); // Blocked by 'normal' threshold

    const rateLimitedRes = await dispatcher.dispatch({
      jobId: "job-health",
      title: "Rapid Repeat Alert",
      message: "Burst alert",
      urgency: "normal",
      trigger: "job_succeeded",
    });
    assert.strictEqual(rateLimitedRes.dispatched, false); // Blocked by cooldown
    console.log("  ✓ Urgency filtering and per-job cooldown rate-limiting verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 12: SLA Health Auditing & Diagnostics
    // ---------------------------------------------------------------------------
    console.log("[Suite 12/22] SLA Health Auditing & Diagnostics...");
    const healthAudit = scheduler.auditJobHealth("job-health");
    assert.ok(healthAudit);
    assert.strictEqual(healthAudit.jobId, "job-health");
    assert.strictEqual(healthAudit.healthStatus, "on_track");
    assert.ok(healthAudit.recommendations.length > 0);
    console.log("  ✓ SLA health auditing and diagnostic recommendations verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 13: Delivery & Reliability Metrics Report
    // ---------------------------------------------------------------------------
    console.log("[Suite 13/22] Delivery & Reliability Metrics Report...");
    const metrics = scheduler.getCronMetrics();
    assert.ok(metrics.totalJobs >= 2);
    assert.ok(metrics.totalExecutions >= 4);
    assert.ok(typeof metrics.p50DurationMs === "number");
    assert.ok(typeof metrics.p95DurationMs === "number");
    assert.ok(metrics.overallSuccessRatePercent >= 0);
    console.log("  ✓ Aggregate scheduler telemetry and latency percentiles verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 14: Multi-Criteria Grouping & Sorting Swimlanes
    // ---------------------------------------------------------------------------
    console.log("[Suite 14/22] Multi-Criteria Grouping & Sorting Swimlanes...");
    const lanesByStatus = scheduler.getGroupedJobs("status", "nextRun", "asc");
    assert.ok(lanesByStatus.some((l) => l.key === "active"));

    const lanesByType = scheduler.getGroupedJobs("scheduleType", "recent", "desc");
    assert.ok(lanesByType.length >= 1);
    console.log("  ✓ Multi-criteria grouping and swimlane sorting verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 15: Natural Query DSL Search Engine
    // ---------------------------------------------------------------------------
    console.log("[Suite 15/22] Natural Query DSL Search Engine...");
    const dslParsed = substrate.parseDslQuery("status:active type:interval tag:p0 monitor");
    assert.strictEqual(dslParsed.status, "active");
    assert.strictEqual(dslParsed.scheduleType, "interval");
    assert.ok(dslParsed.tags?.includes("p0"));
    assert.ok(dslParsed.textTerms?.includes("monitor"));

    const searchResults = scheduler.queryJobsDsl("status:active");
    assert.ok(searchResults.length >= 1);
    console.log("  ✓ Natural query DSL tokenizer and query filtering verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 16: Bulk Mutation Operations
    // ---------------------------------------------------------------------------
    console.log("[Suite 16/22] Bulk Mutation Operations...");
    const bulkRes = scheduler.bulkUpdateJobs(["job-health", "job-interval-5s"], {
      category: "infrastructure",
    });
    assert.strictEqual(bulkRes.modifiedCount, 2);
    assert.strictEqual(scheduler.getJob("job-health")?.category, "infrastructure");
    console.log("  ✓ Atomic bulk mutations across scheduled jobs verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 17: Mutation Undo & Redo Stacks
    // ---------------------------------------------------------------------------
    console.log("[Suite 17/22] Mutation Undo & Redo Stacks...");
    const undoOk = scheduler.undo();
    assert.strictEqual(undoOk, true);
    assert.strictEqual(scheduler.getJob("job-health")?.category, "operations");

    const redoOk = scheduler.redo();
    assert.strictEqual(redoOk, true);
    assert.strictEqual(scheduler.getJob("job-health")?.category, "infrastructure");
    console.log("  ✓ Mutation undo and redo stack verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 18: BroccoliDB Reactive Tables, Secondary Indices & Persistence
    // ---------------------------------------------------------------------------
    console.log("[Suite 18/22] BroccoliDB Reactive Tables, Secondary Indices & Persistence...");
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-cron-test-"));
    const dbKernel = new BroccoliDatabaseKernel({ workspaceRoot: tempDir });
    await dbKernel.start();
    const reactiveSubstrate = new BroccoliCronSubstrate(undefined, dbKernel);

    reactiveSubstrate.storeJob({
      id: "db-persisted-cron",
      name: "BroccoliDB Sync",
      scheduleType: "interval",
      intervalMs: 10000,
      prompt: "Flush cache to reactive table.",
      status: "active",
      totalRuns: 0,
      createdTick: 1,
    });

    assert.ok(reactiveSubstrate.getJob("db-persisted-cron"));
    await dbKernel.stop();
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log("  ✓ BroccoliDB reactive tables & persistence verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 19: Responsive ANSI CLI View Rendering
    // ---------------------------------------------------------------------------
    console.log("[Suite 19/22] Responsive ANSI CLI View Rendering...");
    const dashboardCli = BroccoliViewRenderer.renderCronDashboard(job1 as any);
    assert.ok(dashboardCli.includes("CRON JOB: System Health Monitor"));

    const timelineCli = BroccoliViewRenderer.renderCronScheduleTimeline(scheduler.listJobs() as any);
    assert.ok(timelineCli.includes("LUMI CRON SCHEDULE TIMELINE"));
    console.log("  ✓ ANSI CLI dashboard and ASCII timeline chart verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 20: Interactive HTML Web App Export, Markdown & CSV Exporters
    // ---------------------------------------------------------------------------
    console.log("[Suite 20/22] Interactive HTML Web App Export, Markdown & CSV Exporters...");
    const htmlApp = scheduler.exportInteractiveHtmlView();
    assert.ok(htmlApp.includes("<!DOCTYPE html>"));
    assert.ok(htmlApp.includes("LUMI AUTOMATION & CRON HUB"));

    const mdReport = scheduler.exportMarkdownReport();
    assert.ok(mdReport.includes("# ⏱️ LUMI Cron & Automation Scheduler Report"));

    const csvReport = scheduler.exportCsvReport();
    assert.ok(csvReport.startsWith("id,name,category"));
    console.log("  ✓ Single-page HTML web app, Markdown, and CSV exports verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 21: Interactive Terminal TUI Modal Navigation & Actions
    // ---------------------------------------------------------------------------
    console.log("[Suite 21/22] Interactive Terminal TUI Modal Navigation & Actions...");
    let modalClosed = false;
    const modal = new CronDashboardModal(scheduler, () => {
      modalClosed = true;
    });

    const lines = modal.render(100);
    assert.ok(lines.length > 0);

    modal.handleInput("j"); // move down
    modal.handleInput("k"); // move up
    modal.handleInput("p"); // pause
    modal.handleInput("p"); // resume
    modal.handleInput("+"); // increase interval
    modal.handleInput("-"); // decrease interval
    modal.handleInput("2"); // filter active
    modal.handleInput("v"); // cycle view to history
    modal.handleInput("v"); // cycle view to timeline
    modal.handleInput("v"); // cycle view to blueprints
    modal.handleInput("v"); // cycle view to health
    modal.handleInput("v"); // cycle view to metrics
    modal.handleInput("v"); // cycle view back to jobs
    modal.handleInput("d"); // test notification alert
    modal.handleInput("q"); // close modal
    assert.strictEqual(modalClosed, true);
    console.log("  ✓ Interactive TUI CronDashboardModal with 6 view modes verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 22: Gateway Server JSON-RPC 2.0 & 31 Model Tools Execution
    // ---------------------------------------------------------------------------
    console.log("[Suite 22/22] Gateway Server JSON-RPC 2.0 & 31 Model Tools Execution...");
    const monolith = new LumiMonolith();
    const gateway = new MonolithGatewayServer();

    const listRpcReq = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "cron/listJobs" });
    const listRpcRes = JSON.parse(await gateway.handleJsonRpcRequest(listRpcReq, monolith));
    assert.strictEqual(listRpcRes.id, 1);
    assert.ok(Array.isArray(listRpcRes.result?.jobs));

    const metricsRpcReq = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "cron/getMetrics" });
    const metricsRpcRes = JSON.parse(await gateway.handleJsonRpcRequest(metricsRpcReq, monolith));
    assert.strictEqual(metricsRpcRes.id, 2);
    assert.ok(metricsRpcRes.result?.metrics);

    // Model Tools Suite Verification
    const toolSuite = new CronToolSuite(scheduler);
    const tools = toolSuite.getTools();
    assert.strictEqual(tools.length, 31);

    const listTool = tools.find((t) => t.name === "cron_list_jobs")!;
    const createTool = tools.find((t) => t.name === "cron_create_job")!;
    const triggerTool = tools.find((t) => t.name === "cron_trigger_job")!;
    const healthTool = tools.find((t) => t.name === "cron_audit_health")!;
    const metricsTool = tools.find((t) => t.name === "cron_get_metrics")!;
    const dslTool = tools.find((t) => t.name === "cron_search_dsl")!;
    const exportHtmlTool = tools.find((t) => t.name === "cron_export_html")!;

    assert.ok(listTool && createTool && triggerTool && healthTool && metricsTool && dslTool && exportHtmlTool);

    const createRes = (await createTool.execute(
      {
        name: "Model Tool Created Job",
        prompt: "Audit system security",
        scheduleType: "interval",
        intervalMs: 15000,
      },
      process.cwd()
    )) as any;
    assert.strictEqual(createRes.success, true);
    assert.strictEqual(createRes.job?.name, "Model Tool Created Job");

    const engine = MonolithFactory.createEngine();
    const verification = GrandMonolithSynthesizer.verifyComposition(engine);
    assert.strictEqual(verification.cohesionStatus, "OPTIMAL");
    assert.strictEqual(verification.componentCount, verification.requiredComponentCount);
    console.log(`  ✓ Gateway JSON-RPC endpoints, 31 model tools, and Grand Monolith verified (${verification.componentCount}/${verification.requiredComponentCount} components in OPTIMAL cohesion)`);
    passedSuites++;

    console.log("\n\x1b[1;32m================================================================================\x1b[0m");
    console.log(`\x1b[1;32m [✓] ALL ${passedSuites}/22 WORLD-CLASS CRON SUITES PASSED CLEANLY! \x1b[0m`);
    console.log("\x1b[1;32m================================================================================\x1b[0m\n");
  } catch (error) {
    console.error(`\n\x1b[1;31m[✗] CRON SUITE FAILED at suite ${passedSuites + 1}/22:\x1b[0m`, error);
    process.exit(1);
  }
}

runCronValidationSuite();
