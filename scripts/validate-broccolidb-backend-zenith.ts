/**
 * validate-broccolidb-backend-zenith.ts
 *
 * Dedicated validation suite for Pass 198 / ADR-136:
 * - BroccoliConnectionPool (bounded leases, shared/exclusive isolation, fair FIFO queues, metrics)
 * - BroccoliLockAuthority (reentrant locking, TTL auto-expiration, atomic multi-key deadlock immunity)
 * - BroccoliQueryOptimizer (cost-based execution plans, primary key & index routing, explain output)
 * - Grand Monolith Composition Baseline (Pass 198 / 603 components)
 */

import {
  BroccoliConnectionPool,
  BroccoliLockAuthority,
  BroccoliQueryOptimizer,
  CURRENT_EVOLUTION_BASELINE,
  CURRENT_REQUIRED_COMPONENTS,
  GrandMonolithSynthesizer,
  LumiMonolith,
} from "../src/index.js";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runBroccoliBackendZenithValidation(): Promise<void> {
  console.log("================================================================================");
  console.log(" LUMI BroccoliDB Backend Zenith Validation Suite (Pass 198 / ADR-136)           ");
  console.log("================================================================================");

  // ---------------------------------------------------------------------------
  // Test 1: Connection Pool Basic Lease Lifecycle
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating Connection Pool Lease Acquisition & Release...");
  const pool = new BroccoliConnectionPool({ maxConcurrentLeases: 4, defaultLeaseTtlMs: 2000 });

  const lease1 = await pool.acquireLease("acp_subsystem", "SHARED_READ");
  assert(lease1.isActive, "Lease 1 should be active");
  assert(lease1.subsystem === "acp_subsystem", "Subsystem should match");
  assert(pool.getActiveLeases().length === 1, "Active leases should be 1");

  const lease2 = await pool.acquireLease("cron_subsystem", "SHARED_READ");
  assert(pool.getActiveLeases().length === 2, "Active leases should be 2");

  const released = pool.releaseLease(lease1.leaseId);
  assert(released, "Lease 1 should be released");
  assert(pool.getActiveLeases().length === 1, "Active leases should now be 1");
  pool.releaseLease(lease2.leaseId);
  assert(pool.getActiveLeases().length === 0, "All leases released");
  console.log("  [✓] Connection pool basic lease lifecycle verified.");

  // ---------------------------------------------------------------------------
  // Test 2: Shared vs Exclusive Concurrency & Isolation
  // ---------------------------------------------------------------------------
  console.log("[Test 2/8] Validating Shared vs Exclusive Concurrency Modes...");
  const exclPool = new BroccoliConnectionPool({ maxConcurrentLeases: 2 });
  const exclLease = await exclPool.acquireLease("wal_writer", "EXCLUSIVE_WRITE");
  assert(exclPool.getMetrics().activeWrites === 1, "Active writes should be 1");

  let sharedAcquired = false;
  const sharedPromise = exclPool.acquireLease("reader_1", "SHARED_READ", 500).then((handle) => {
    sharedAcquired = true;
    exclPool.releaseLease(handle.leaseId);
  });

  // Small delay: shared lease should be waiting in queue
  await new Promise((r) => setTimeout(r, 50));
  assert(!sharedAcquired, "Shared lease should wait while exclusive lease is held");

  // Release exclusive lease
  exclPool.releaseLease(exclLease.leaseId);
  await sharedPromise;
  assert(sharedAcquired, "Shared lease should acquire after exclusive lease releases");
  console.log("  [✓] Shared vs Exclusive concurrency modes verified.");

  // ---------------------------------------------------------------------------
  // Test 3: RAII Helper (withLease) and Metrics
  // ---------------------------------------------------------------------------
  console.log("[Test 3/8] Validating withLease() RAII Helper & Pool Telemetry...");
  let executionRan = false;
  const result = await pool.withLease("profiles", "SHARED_READ", async () => {
    assert(pool.getActiveLeases().length === 1, "Inside withLease, lease must be active");
    executionRan = true;
    return "SUCCESS_VAL";
  });

  assert(result === "SUCCESS_VAL", "withLease should return computed value");
  assert(executionRan, "withLease body should execute");
  assert(pool.getActiveLeases().length === 0, "After withLease, lease must be automatically released");

  const metrics = pool.getMetrics();
  assert(metrics.totalLeasesIssued >= 3, "Total leases issued metric should track history");
  console.log(`  [✓] withLease() RAII helper and metrics verified (total leases: ${metrics.totalLeasesIssued}).`);

  // ---------------------------------------------------------------------------
  // Test 4: Distributed Lock Authority Basic Acquisition & Reentrancy
  // ---------------------------------------------------------------------------
  console.log("[Test 4/8] Validating Lock Authority Reentrancy & Mutual Exclusion...");
  const lockAuth = new BroccoliLockAuthority();

  const lock1 = await lockAuth.acquireLock("file:src/App.tsx", "agent-alpha", "SHARED_READ", 5000);
  assert(lock1.resourceKey === "file:src/App.tsx", "Resource key should match");
  assert(lockAuth.isLocked("file:src/App.tsx"), "Resource should be locked");

  // Reentrant shared lock by same owner
  const reentrantLock = await lockAuth.acquireLock("file:src/App.tsx", "agent-alpha", "SHARED_READ", 5000);
  assert(reentrantLock.lockId === lock1.lockId, "Reentrant lock by same owner should return existing handle");

  // Exclusive lock attempt on shared resource should fail
  let exclusiveFailed = false;
  try {
    await lockAuth.acquireLock("file:src/App.tsx", "agent-beta", "EXCLUSIVE_WRITE", 1000);
  } catch {
    exclusiveFailed = true;
  }
  assert(exclusiveFailed, "Exclusive lock should fail when shared lock is held by another agent");

  lockAuth.releaseLock(lock1.lockId);
  assert(!lockAuth.isLocked("file:src/App.tsx"), "Resource should be unlocked");
  console.log("  [✓] Lock Authority reentrancy and mutual exclusion verified.");

  // ---------------------------------------------------------------------------
  // Test 5: Atomic Multi-Resource Locking (acquireAll) with Deadlock Immunity
  // ---------------------------------------------------------------------------
  console.log("[Test 5/8] Validating Atomic Multi-Resource Locking & Batch Rollback...");
  const keys = ["resource_gamma", "resource_alpha", "resource_beta"];
  const multiLocks = await lockAuth.acquireAll(keys, "agent-swarm-leader", "EXCLUSIVE_WRITE");
  assert(multiLocks.length === 3, "Should acquire all 3 locks");
  assert(lockAuth.getActiveLocks().length === 3, "Active locks should be 3");

  // Attempting to acquire batch that overlaps with held lock
  let batchFailed = false;
  try {
    await lockAuth.acquireAll(["resource_delta", "resource_alpha"], "agent-other", "EXCLUSIVE_WRITE");
  } catch {
    batchFailed = true;
  }
  assert(batchFailed, "Batch acquisition should fail on conflict");
  assert(!lockAuth.isLocked("resource_delta"), "Non-conflicting keys in failed batch must be rolled back");

  const releasedCount = lockAuth.releaseAllForOwner("agent-swarm-leader");
  assert(releasedCount === 3, "releaseAllForOwner should release 3 locks");
  assert(lockAuth.getActiveLocks().length === 0, "No locks should remain");
  console.log("  [✓] Atomic multi-resource locking and batch rollback verified.");

  // ---------------------------------------------------------------------------
  // Test 6: Cost-Based Query Optimizer - Primary Key & Index Seeks
  // ---------------------------------------------------------------------------
  console.log("[Test 6/8] Validating Cost-Based Query Optimizer (PK & Index Seeks)...");
  const optimizer = new BroccoliQueryOptimizer();

  const pkPlan = optimizer.planQuery("users", { id: "user_123" });
  assert(pkPlan.planType === "PRIMARY_KEY_LOOKUP", "Expected PRIMARY_KEY_LOOKUP plan");
  assert(pkPlan.estimatedCost === 1, "PK lookup cost should be 1");
  assert(pkPlan.explanation.includes("Constant-time"), "PK explanation should mention constant-time");

  const idxPlan = optimizer.planQuery("sessions", { email: "dev@lumi.ai" }, ["email", "created_at"]);
  assert(idxPlan.planType === "SECONDARY_INDEX_SEEK", "Expected SECONDARY_INDEX_SEEK plan");
  assert(idxPlan.selectedIndex === "email", "Selected index should be 'email'");
  assert(idxPlan.estimatedCost === 5, "Index seek cost should be 5");
  console.log("  [✓] Primary key and secondary index seek optimization verified.");

  // ---------------------------------------------------------------------------
  // Test 7: Cost-Based Query Optimizer - Range Scans & Full Scans
  // ---------------------------------------------------------------------------
  console.log("[Test 7/8] Validating Range Scans & Fallback Full Table Scans...");
  const rangePlan = optimizer.planQuery("metrics", { latency: { $gt: 100 } }, ["latency"]);
  assert(rangePlan.planType === "RANGE_SCAN", "Expected RANGE_SCAN plan");
  assert(rangePlan.estimatedCost <= 15, "Indexed range scan cost should be <= 15");

  const fullScanPlan = optimizer.planQuery("logs", { message: "error", code: 500 });
  assert(fullScanPlan.planType === "FULL_TABLE_SCAN", "Expected FULL_TABLE_SCAN plan");
  assert(fullScanPlan.estimatedCost === 100, "Full table scan cost should be 100");
  console.log("  [✓] Range scans and full table scans query optimization verified.");

  // ---------------------------------------------------------------------------
  // Test 8: Grand Monolith Integration & Evolution Baseline
  // ---------------------------------------------------------------------------
  console.log("[Test 8/8] Validating Grand Monolith Baseline (Pass 198+ / 603+ components)...");
  const monolith = new LumiMonolith({ cwd: process.cwd(), sessionId: "backend-zenith-session" });

  assert(monolith.components.broccoliConnectionPool instanceof BroccoliConnectionPool, "Connection pool must be wired");
  assert(monolith.components.broccoliLockAuthority instanceof BroccoliLockAuthority, "Lock authority must be wired");
  assert(monolith.components.broccoliQueryOptimizer instanceof BroccoliQueryOptimizer, "Query optimizer must be wired");

  const synthesis = GrandMonolithSynthesizer.verifyComposition(monolith.components);
  assert(synthesis.cohesionStatus === "OPTIMAL", `Synthesis status should be OPTIMAL, got ${synthesis.cohesionStatus}`);
  assert(synthesis.missingComponents.length === 0, `Missing: ${synthesis.missingComponents.join(", ")}`);
  assert(synthesis.unexpectedComponents.length === 0, `Unexpected: ${synthesis.unexpectedComponents.join(", ")}`);

  assert(CURRENT_EVOLUTION_BASELINE.highestRecordedPass >= 198, "Baseline highestRecordedPass must be >= 198");
  assert(CURRENT_REQUIRED_COMPONENTS.length >= 603, `Expected >= 603 components, got ${CURRENT_REQUIRED_COMPONENTS.length}`);
  console.log(`  [✓] Grand Monolith verified with ${CURRENT_REQUIRED_COMPONENTS.length} components in OPTIMAL status (Pass ${CURRENT_EVOLUTION_BASELINE.highestRecordedPass}).`);

  console.log("================================================================================");
  console.log(" [✓] ALL 8/8 BROCCOLIDB BACKEND ZENITH VALIDATION SUITES PASSED!               ");
  console.log("================================================================================");
}

runBroccoliBackendZenithValidation().catch((err) => {
  console.error("\n[✗] BROCCOLIDB BACKEND ZENITH VALIDATION FAILED:", err);
  process.exit(1);
});
