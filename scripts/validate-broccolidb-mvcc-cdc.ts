/**
 * validate-broccolidb-mvcc-cdc.ts
 *
 * Dedicated validation suite for Pass 199 / ADR-137:
 * - BroccoliMvccEngine (snapshot isolation, non-blocking readers/writers, transaction rollback, vacuum)
 * - BroccoliSparseIndexEngine (64-record data block summaries, min/max bounds, 64-bit Bloom filter pruning)
 * - BroccoliCdcStream (LSN event sequencing, rewindable replay, table/op filters)
 * - Grand Monolith Baseline (Pass 199 / 606 components in OPTIMAL status)
 */

import {
  BroccoliCdcStream,
  BroccoliMvccEngine,
  BroccoliSparseIndexEngine,
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

async function runBroccoliMvccCdcValidation(): Promise<void> {
  console.log("================================================================================");
  console.log(" LUMI BroccoliDB MVCC, Sparse Index & CDC Validation Suite (Pass 199 / ADR-137) ");
  console.log("================================================================================");

  // ---------------------------------------------------------------------------
  // Test 1: MVCC Transaction Lifecycle & Snapshot Isolation Visibility
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating MVCC Transaction Lifecycle & Snapshot Visibility...");
  const mvcc = new BroccoliMvccEngine();

  const tx1 = mvcc.beginTransaction();
  mvcc.writeRecord("users", "usr_100", { name: "Alice", balance: 500 }, tx1.txId);
  const readTx1 = mvcc.readRecord<{ name: string; balance: number }>("users", "usr_100", tx1.txId);
  assert(readTx1?.name === "Alice", "Tx1 must see its own uncommitted write");

  // Tx2 started before Tx1 commits
  const tx2 = mvcc.beginTransaction();
  const readTx2 = mvcc.readRecord("users", "usr_100", tx2.txId);
  assert(readTx2 === undefined, "Tx2 must NOT see Tx1 write before Tx1 commit");

  // Commit Tx1
  mvcc.commitTransaction(tx1.txId);

  // Tx3 started after Tx1 commit
  const tx3 = mvcc.beginTransaction();
  const readTx3 = mvcc.readRecord<{ name: string; balance: number }>("users", "usr_100", tx3.txId);
  assert(readTx3?.name === "Alice", "Tx3 (started after commit) must see Alice");
  console.log("  [✓] MVCC snapshot visibility and transaction commit verified.");

  // ---------------------------------------------------------------------------
  // Test 2: Concurrent Non-Blocking Updates (Snapshot Isolation)
  // ---------------------------------------------------------------------------
  console.log("[Test 2/8] Validating Concurrent Non-Blocking Updates & Snapshot Isolation...");
  const txReader = mvcc.beginTransaction(); // Snapshot frozen at this epoch

  // TxWriter updates Alice -> Bob
  const txWriter = mvcc.beginTransaction();
  mvcc.writeRecord("users", "usr_100", { name: "Bob", balance: 600 }, txWriter.txId);
  mvcc.commitTransaction(txWriter.txId);

  // txReader still reads Alice (frozen snapshot view)
  const readerSnapshot = mvcc.readRecord<{ name: string; balance: number }>("users", "usr_100", txReader.txId);
  assert(readerSnapshot?.name === "Alice", "Reader must maintain frozen snapshot view of Alice");

  // New transaction reads Bob
  const txFresh = mvcc.beginTransaction();
  const freshSnapshot = mvcc.readRecord<{ name: string; balance: number }>("users", "usr_100", txFresh.txId);
  assert(freshSnapshot?.name === "Bob", "Fresh transaction must read Bob");
  console.log("  [✓] Concurrent non-blocking updates and snapshot isolation verified.");

  // ---------------------------------------------------------------------------
  // Test 3: Transaction Rollback & State Isolation
  // ---------------------------------------------------------------------------
  console.log("[Test 3/8] Validating MVCC Transaction Rollback...");
  const txRollback = mvcc.beginTransaction();
  mvcc.writeRecord("users", "usr_temp", { name: "Ghost Record" }, txRollback.txId);
  assert(mvcc.readRecord("users", "usr_temp", txRollback.txId) !== undefined, "Written in tx");

  mvcc.rollbackTransaction(txRollback.txId);

  const txAfterRollback = mvcc.beginTransaction();
  assert(mvcc.readRecord("users", "usr_temp", txAfterRollback.txId) === undefined, "Rolled back record must not exist");
  console.log("  [✓] MVCC transaction rollback verified.");

  // ---------------------------------------------------------------------------
  // Test 4: MVCC Vacuuming & Obsolete Tuple Reclamation
  // ---------------------------------------------------------------------------
  console.log("[Test 4/8] Validating MVCC Vacuuming & Dead Tuple Reclamation...");
  const txA = mvcc.beginTransaction();
  mvcc.writeRecord("audit_log", "log_1", { msg: "v1" }, txA.txId);
  mvcc.commitTransaction(txA.txId);

  const txB = mvcc.beginTransaction();
  mvcc.writeRecord("audit_log", "log_1", { msg: "v2" }, txB.txId);
  mvcc.commitTransaction(txB.txId);

  const txC = mvcc.beginTransaction();
  mvcc.deleteRecord("audit_log", "log_1", txC.txId);
  mvcc.commitTransaction(txC.txId);

  // Vacuum with threshold higher than txC
  const purged = mvcc.vacuum(txC.txId + 1);
  assert(purged >= 1, "Vacuum should purge obsolete versions");
  console.log(`  [✓] MVCC vacuum verified (purged ${purged} obsolete version tuples).`);

  // ---------------------------------------------------------------------------
  // Test 5: Sparse Block Index Construction & Min/Max Summaries
  // ---------------------------------------------------------------------------
  console.log("[Test 5/8] Validating Sparse Block Index Construction & Summary Metadata...");
  const sparseEngine = new BroccoliSparseIndexEngine();

  const sampleRecords = Array.from({ length: 160 }, (_, i) => ({
    id: `item_${i.toString().padStart(3, "0")}`,
    category: i < 50 ? "electronics" : i < 100 ? "apparel" : "grocery",
    price: (i + 1) * 10,
  }));

  const summaries = sparseEngine.buildSparseIndex("products", sampleRecords, ["id", "category", "price"], 64);
  assert(summaries.length === 3, "160 records with blockSize 64 should produce 3 blocks");
  assert(summaries[0].recordCount === 64, "Block 0 should have 64 records");
  assert(summaries[2].recordCount === 32, "Block 2 should have 32 records");
  assert(summaries[0].bounds.price.min === 10, "Block 0 min price should be 10");
  assert(summaries[0].bounds.price.max === 640, "Block 0 max price should be 640");
  console.log("  [✓] Sparse block index construction and min/max summaries verified.");

  // ---------------------------------------------------------------------------
  // Test 6: Sparse Block Bloom Filter & Boundary Pruning
  // ---------------------------------------------------------------------------
  console.log("[Test 6/8] Validating Bloom Filter & Boundary Pruning...");
  // Query for price > 1000: Block 0 (max 640) must be pruned!
  const rangeScan = sparseEngine.pruneBlocks("products", { price: { $gt: 1000 } });
  assert(rangeScan.prunedBlocks >= 1, "Block 0 should be pruned by price boundary");
  assert(rangeScan.matchedRecordIds.length > 0, "Matched records should be identified");

  // Query for non-existent category: Bloom filter should prune all blocks
  const nonExistentScan = sparseEngine.pruneBlocks("products", { category: "non_existent_cat" });
  assert(nonExistentScan.prunedBlocks === 3, "All blocks should be pruned by bloom filter");
  assert(nonExistentScan.matchedRecordIds.length === 0, "No records matched");
  console.log(`  [✓] Bloom filter and boundary block pruning verified (pruned ${nonExistentScan.prunedBlocks}/${nonExistentScan.totalBlocks} blocks).`);

  // ---------------------------------------------------------------------------
  // Test 7: Change Data Capture (CDC) Stream & Rewindable Replay
  // ---------------------------------------------------------------------------
  console.log("[Test 7/8] Validating Change Data Capture Stream & Replay...");
  const cdc = new BroccoliCdcStream();

  const receivedEvents: any[] = [];
  const sub = cdc.subscribe({ tables: ["users", "orders"] }, (ev) => {
    receivedEvents.push(ev);
  });

  cdc.emitEvent("users", "INSERT", "usr_1", undefined, { name: "Carol" });
  cdc.emitEvent("users", "UPDATE", "usr_1", { name: "Carol" }, { name: "Caroline" });
  cdc.emitEvent("settings", "UPDATE", "cfg_theme", { theme: "light" }, { theme: "dark" }); // Filtered out

  assert(receivedEvents.length === 2, "Subscriber should only receive 2 matching events");
  assert(receivedEvents[0].op === "INSERT" && receivedEvents[0].lsn === 1, "First event should be LSN 1 INSERT");
  assert(receivedEvents[1].op === "UPDATE" && receivedEvents[1].lsn === 2, "Second event should be LSN 2 UPDATE");

  // Rewindable replay from LSN 1
  const replayed: any[] = [];
  const replaySub = cdc.subscribe({ fromLsn: 1 }, (ev) => {
    replayed.push(ev);
  });
  assert(replayed.length === 3, "Rewind from LSN 1 should replay all 3 historical events");

  sub.unsubscribe();
  replaySub.unsubscribe();
  console.log("  [✓] CDC stream emission, filtering, and rewindable LSN replay verified.");

  // ---------------------------------------------------------------------------
  // Test 8: Grand Monolith Integration & Baseline
  // ---------------------------------------------------------------------------
  console.log("[Test 8/8] Validating Grand Monolith Baseline (Pass 199+ / 606+ components)...");
  const monolith = new LumiMonolith({ cwd: process.cwd(), sessionId: "mvcc-cdc-session" });

  assert(monolith.components.broccoliMvccEngine instanceof BroccoliMvccEngine, "MVCC engine must be wired");
  assert(monolith.components.broccoliSparseIndexEngine instanceof BroccoliSparseIndexEngine, "Sparse index engine must be wired");
  assert(monolith.components.broccoliCdcStream instanceof BroccoliCdcStream, "CDC stream must be wired");

  const synthesis = GrandMonolithSynthesizer.verifyComposition(monolith.components);
  assert(synthesis.cohesionStatus === "OPTIMAL", `Synthesis status should be OPTIMAL, got ${synthesis.cohesionStatus}`);
  assert(synthesis.missingComponents.length === 0, `Missing: ${synthesis.missingComponents.join(", ")}`);
  assert(synthesis.unexpectedComponents.length === 0, `Unexpected: ${synthesis.unexpectedComponents.join(", ")}`);

  assert(CURRENT_EVOLUTION_BASELINE.highestRecordedPass >= 199, "Baseline highestRecordedPass must be >= 199");
  assert(CURRENT_REQUIRED_COMPONENTS.length >= 606, `Expected >= 606 components, got ${CURRENT_REQUIRED_COMPONENTS.length}`);
  console.log(`  [✓] Grand Monolith verified with ${CURRENT_REQUIRED_COMPONENTS.length} components in OPTIMAL status (Pass ${CURRENT_EVOLUTION_BASELINE.highestRecordedPass}).`);

  console.log("================================================================================");
  console.log(" [✓] ALL 8/8 BROCCOLIDB MVCC, SPARSE INDEX & CDC SUITES PASSED!                 ");
  console.log("================================================================================");
}

runBroccoliMvccCdcValidation().catch((err) => {
  console.error("\n[✗] BROCCOLIDB MVCC/CDC VALIDATION FAILED:", err);
  process.exit(1);
});
