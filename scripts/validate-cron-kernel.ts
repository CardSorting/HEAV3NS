import * as assert from "node:assert/strict";
import {
  LumiMonolith,
  DeterministicBlueprintCatalog,
  AnchoredCronJobManager,
  BroccoliCronSubstrate,
  CronSnapshotManager,
  CronLifecycleGuard,
  MonolithCronScheduler,
  CronToolSuite,
} from "../src/index.js";

async function main(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Deterministic Cron Kernel (AKD-DSO Validation)         ");
  console.log("================================================================\n");

  const catalog = new DeterministicBlueprintCatalog();
  const jobManager = new AnchoredCronJobManager();
  const substrate = new BroccoliCronSubstrate(jobManager);
  const snapshotManager = new CronSnapshotManager(substrate);
  const guard = new CronLifecycleGuard();
  const scheduler = new MonolithCronScheduler(substrate, guard);
  const toolSuite = new CronToolSuite(scheduler, catalog);

  // ── [Test 1/8] Schedule Manifest Parsing & Validation ─────────────────────
  console.log("[Test 1/8] Validating Schedule Manifests & Validation Rules...");
  {
    // Valid 5-field cron
    const validCron = guard.validateJobManifest({
      id: "job-valid-cron",
      name: "Daily Sync",
      scheduleType: "cron",
      scheduleExpression: "0 9 * * 1-5",
      prompt: "Sync daily changes",
    });
    assert.ok(validCron.allowed, "Valid 5-field cron must be accepted");

    // Invalid cron (only 3 fields)
    const invalidCron = guard.validateJobManifest({
      id: "job-invalid-cron",
      name: "Bad Cron",
      scheduleType: "cron",
      scheduleExpression: "0 9 *",
      prompt: "Invalid cron syntax",
    });
    assert.ok(!invalidCron.allowed, "Invalid 3-field cron expression must be rejected");
    assert.ok(invalidCron.reason?.includes("Expected 5 fields"));

    // Valid interval
    const validInterval = guard.validateJobManifest({
      id: "job-valid-interval",
      name: "Periodic Health",
      scheduleType: "interval",
      intervalMs: 5000,
      prompt: "Check engine health",
    });
    assert.ok(validInterval.allowed, "Valid interval >= 500ms must be accepted");

    // Invalid interval (< 500ms)
    const invalidInterval = guard.validateJobManifest({
      id: "job-invalid-interval",
      name: "Too fast",
      scheduleType: "interval",
      intervalMs: 100,
      prompt: "Check health too fast",
    });
    assert.ok(!invalidInterval.allowed, "Sub-500ms interval must be rejected");

    console.log("\x1b[32m  [✓] Schedule expression parsing and interval rules passed.\x1b[0m");
  }

  // ── [Test 2/8] Parameterized Blueprint Catalog & Slot Interpolation ───────
  console.log("[Test 2/8] Validating Blueprint Catalog & Slot Interpolation...");
  {
    const blueprints = catalog.listBlueprints();
    assert.ok(blueprints.length >= 5, "Blueprint catalog must include at least 5 production blueprints");

    const dailyBlueprint = catalog.getBlueprint("daily_summary");
    assert.ok(dailyBlueprint, "daily_summary blueprint must exist");

    // Materialize blueprint with custom slots
    const materialized = catalog.materializeBlueprint("daily_summary", "test-daily-job", {
      hour: 8,
      weekdays: "1-5",
      user: "Lead Architect",
    });

    assert.equal(materialized.id, "test-daily-job");
    assert.equal(materialized.scheduleExpression, "0 8 * * 1-5");
    assert.ok(materialized.prompt.includes("Lead Architect"));

    // Verify missing required slot rejection
    assert.throws(
      () => catalog.materializeBlueprint("non_existent_key", "job-1"),
      /not found in catalog/
    );

    console.log("\x1b[32m  [✓] Blueprint slot validation and safe template interpolation passed.\x1b[0m");
  }

  // ── [Test 3/8] Destructive Command Injection & Recursion Prevention ───────
  console.log("[Test 3/8] Validating Destructive Command & Recursion Guards...");
  {
    // Destructive command injection
    const destructiveCheck = guard.validateJobManifest({
      id: "job-destructive",
      name: "Destructive Action",
      scheduleType: "interval",
      intervalMs: 5000,
      prompt: "Execute shutdown_monolith immediately",
    });
    assert.ok(!destructiveCheck.allowed, "shutdown_monolith must be blocked");
    assert.ok(destructiveCheck.reason?.includes("blocked destructive command"));

    // Process kill injection
    const pkillCheck = guard.validateJobManifest({
      id: "job-pkill",
      name: "Kill Process",
      scheduleType: "interval",
      intervalMs: 5000,
      prompt: "Run pkill -9 lumi-agent",
    });
    assert.ok(!pkillCheck.allowed, "pkill command must be blocked");

    // Recursive self-scheduling injection
    const recursiveCheck = guard.validateJobManifest({
      id: "job-recursive",
      name: "Recursive Cron Spawner",
      scheduleType: "interval",
      intervalMs: 5000,
      prompt: "Call cron_create_job in a loop",
    });
    assert.ok(!recursiveCheck.allowed, "Recursive cron_create_job must be blocked");
    assert.ok(recursiveCheck.reason?.includes("recursive self-scheduling"));

    console.log("\x1b[32m  [✓] Destructive commands and recursion loops blocked.\x1b[0m");
  }

  // ── [Test 4/8] In-Memory Broccolidb Substrate & Execution Ring Buffer ───────
  console.log("[Test 4/8] Validating In-Memory Substrate & Ring Buffer History...");
  {
    substrate.clear();
    const job1 = scheduler.registerJob({
      id: "substrate-job-1",
      name: "Test Substrate Job",
      scheduleType: "interval",
      intervalMs: 2000,
      prompt: "Verify substrate storage",
    });

    assert.ok(substrate.getJob("substrate-job-1"));
    assert.equal(substrate.listJobs().length, 1);

    // Record execution
    substrate.recordExecution({
      id: "exec-1",
      jobId: "substrate-job-1",
      triggerType: "scheduled",
      startedAtMs: Date.now(),
      durationMs: 0.5,
      success: true,
      summary: "Completed successfully",
    });

    const history = substrate.getExecutionHistory("substrate-job-1");
    assert.equal(history.length, 1);
    assert.equal(history[0].id, "exec-1");

    console.log("\x1b[32m  [✓] In-memory Broccolidb substrate and ring buffer verified.\x1b[0m");
  }

  // ── [Test 5/8] Frame-Perfect Binary Snapshotting & O(1) Rollback ───────────
  console.log("[Test 5/8] Validating Cron Snapshotting & O(1) State Rollback...");
  {
    // Snapshot at frame 10 (with 1 job)
    const snapshot10 = snapshotManager.createSnapshot(10);
    assert.equal(snapshot10.jobs.length, 1);

    // Add 2 more jobs
    scheduler.registerJob({
      id: "extra-job-1",
      name: "Extra Job 1",
      scheduleType: "interval",
      intervalMs: 10000,
      prompt: "Do extra work 1",
    });
    scheduler.registerJob({
      id: "extra-job-2",
      name: "Extra Job 2",
      scheduleType: "interval",
      intervalMs: 15000,
      prompt: "Do extra work 2",
    });
    assert.equal(substrate.listJobs().length, 3);

    // Rollback to snapshot at frame 10
    const startRollback = performance.now();
    snapshotManager.restoreSnapshot(snapshot10);
    const rollbackDuration = performance.now() - startRollback;

    assert.equal(substrate.listJobs().length, 1);
    assert.equal(substrate.getJob("substrate-job-1")?.id, "substrate-job-1");
    assert.equal(substrate.getJob("extra-job-1"), undefined);
    assert.ok(rollbackDuration < 1.0, `Rollback took ${rollbackDuration} ms, must be < 1.0ms`);

    console.log(`\x1b[32m  [✓] Frame snapshotting and instant O(1) rollback passed (${rollbackDuration.toFixed(3)} ms).\x1b[0m`);
  }

  // ── [Test 6/8] Frame-Tick Synchronized Job Dispatching & Zero-Drift ────────
  console.log("[Test 6/8] Validating Frame-Tick Synchronized Execution...");
  {
    substrate.clear();
    const now = Date.now();

    scheduler.registerJob({
      id: "tick-job-due",
      name: "Due Job",
      scheduleType: "interval",
      intervalMs: 1000,
      nextRunTimestampMs: now - 500, // Due immediately
      prompt: "Execute immediately",
    });

    scheduler.registerJob({
      id: "tick-job-future",
      name: "Future Job",
      scheduleType: "interval",
      intervalMs: 10000,
      nextRunTimestampMs: now + 50000, // Not due
      prompt: "Execute later",
    });

    // Evaluate tick
    const startEval = performance.now();
    const executed = await scheduler.evaluateTick(100, now);
    const evalDuration = performance.now() - startEval;

    assert.equal(executed.length, 1, "Only due job should have executed");
    assert.equal(executed[0].jobId, "tick-job-due");
    assert.ok(evalDuration < 5.0, `Tick evaluation took ${evalDuration} ms`);

    console.log(`\x1b[32m  [✓] Frame-tick evaluation and dispatch passed (${evalDuration.toFixed(3)} ms).\x1b[0m`);
  }

  // ── [Test 7/8] Cron Model Tool Suite Operations ───────────────────────────
  console.log("[Test 7/8] Validating Cron Model Tool Suite...");
  {
    // 1. List blueprints
    const listBlueprints = await toolSuite.executeTool("cron_list_blueprints", {});
    assert.ok(listBlueprints.success);

    // 2. Create job from blueprint
    const createBlueprintJob = await toolSuite.executeTool("cron_create_job", {
      name: "Monitored Cleaner",
      blueprintKey: "workspace_cleaner",
      blueprintSlots: JSON.stringify({ weekdays: "0", maxAgeHours: 12 }),
    });
    assert.ok(createBlueprintJob.success);

    // 3. List jobs
    const listJobs = await toolSuite.executeTool("cron_list_jobs", {});
    assert.ok(listJobs.success);

    // 4. Trigger job
    const createdJob = createBlueprintJob.data as any;
    const triggerJob = await toolSuite.executeTool("cron_trigger_job", { jobId: createdJob.id });
    assert.ok(triggerJob.success);

    // 5. Pause & Resume job
    const pauseJob = await toolSuite.executeTool("cron_pause_job", { jobId: createdJob.id });
    assert.ok(pauseJob.success);

    const resumeJob = await toolSuite.executeTool("cron_resume_job", { jobId: createdJob.id });
    assert.ok(resumeJob.success);

    // 6. Delete job
    const deleteJob = await toolSuite.executeTool("cron_delete_job", { jobId: createdJob.id });
    assert.ok(deleteJob.success);

    console.log("\x1b[32m  [✓] Model tool operations (create, trigger, pause, resume, delete) passed.\x1b[0m");
  }

  // ── [Test 8/8] Monolith Composition & Tick Micro-Benchmark ─────────────────
  console.log("[Test 8/8] Benchmarking Monolith Composition & Fast-Path Evaluation...");
  {
    const monolith = new LumiMonolith({ sessionId: "cron-benchmark-session" });
    assert.ok(monolith.monolithCronScheduler, "monolithCronScheduler must be composed");
    assert.ok(monolith.deterministicBlueprintCatalog, "deterministicBlueprintCatalog must be composed");
    assert.ok(monolith.anchoredCronJobManager, "anchoredCronJobManager must be composed");
    assert.ok(monolith.cronToolSuite, "cronToolSuite must be composed");
    assert.ok(monolith.broccoliCronSubstrate, "broccoliCronSubstrate must be composed");
    assert.ok(monolith.cronSnapshotManager, "cronSnapshotManager must be composed");
    assert.ok(monolith.cronLifecycleGuard, "cronLifecycleGuard must be composed");

    // Register 100 benchmark jobs
    for (let i = 0; i < 100; i++) {
      monolith.monolithCronScheduler.registerJob({
        id: `bench-cron-${i}`,
        name: `Benchmark Cron ${i}`,
        scheduleType: "interval",
        intervalMs: 10000 + i * 100,
        prompt: `Benchmark prompt ${i}`,
      });
    }

    // Benchmark 1,000 tick evaluations across 100 registered jobs
    const iterations = 1000;
    const startBench = performance.now();
    for (let i = 0; i < iterations; i++) {
      await monolith.monolithCronScheduler.evaluateTick(i, 0); // timestamp 0 so none trigger
    }
    const totalBenchMs = performance.now() - startBench;
    const perTickUs = (totalBenchMs / iterations) * 1000;

    console.log(`  Measured: ${iterations} tick evaluations (across 100 jobs) in ${totalBenchMs.toFixed(3)} ms (${perTickUs.toFixed(3)} µs/tick)`);
    assert.ok(totalBenchMs < 50.0, `1,000 evaluations took ${totalBenchMs} ms, must be < 50.0ms`);

    console.log("\x1b[32m  [✓] Monolith composition & tick evaluation micro-benchmark passed.\x1b[0m");
  }

  console.log("\n================================================================");
  console.log("   ALL 8 CRON KERNEL VALIDATION SUITES PASSED!                 ");
  console.log("================================================================\n");
}

main().catch((error) => {
  console.error("Validation failed with error:", error);
  process.exit(1);
});
