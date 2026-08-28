/**
 * validate-broccolidb-vector-2pc.ts
 *
 * Dedicated validation suite for Pass 200 Centennial Landmark / ADR-138:
 * - BroccoliVectorEngine (columnar typed chunks, vectorized filters, SIMD-style batch aggregations)
 * - BroccoliInvertedIndexEngine (BM25 probabilistic relevance ranking, positional phrase queries)
 * - BroccoliTwoPhaseCommitCoordinator (distributed 2PC prepare/commit/abort cycles)
 * - Grand Monolith Baseline (Pass 200 Centennial Landmark / 609 components in OPTIMAL status)
 */

import {
  BroccoliInvertedIndexEngine,
  BroccoliTwoPhaseCommitCoordinator,
  BroccoliVectorEngine,
  CURRENT_EVOLUTION_BASELINE,
  CURRENT_REQUIRED_COMPONENTS,
  GrandMonolithSynthesizer,
  IBroccoli2pcParticipant,
  LumiMonolith,
} from "../src/index.js";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runBroccoliVector2pcValidation(): Promise<void> {
  console.log("================================================================================");
  console.log(" LUMI BroccoliDB Vector, BM25 & 2PC Validation Suite (Pass 200 / ADR-138)       ");
  console.log("================================================================================");

  // ---------------------------------------------------------------------------
  // Test 1: Vector Chunk Creation & Columnar Buffer Packing
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating Vector Chunk Creation & Columnar Buffers...");
  const vectorEngine = new BroccoliVectorEngine();

  const sampleRecords = Array.from({ length: 500 }, (_, i) => ({
    id: `rec_${i}`,
    amount: (i + 1) * 2.5,
    status: i % 2 === 0 ? "active" : "pending",
    category: i % 3 === 0 ? "finance" : "dev",
  }));

  const chunk = vectorEngine.createVectorChunk(sampleRecords, ["amount"], ["status", "category"]);
  assert(chunk.length === 500, "Chunk length should be 500");
  assert(chunk.columns.amount instanceof Float64Array, "Amount column must be Float64Array");
  assert((chunk.columns.amount as Float64Array)[0] === 2.5, "Amount[0] should be 2.5");
  assert(chunk.nullMasks.amount.length === 500, "Null mask length should be 500");
  console.log("  [✓] Vector chunk creation and typed array buffers verified.");

  // ---------------------------------------------------------------------------
  // Test 2: Vectorized Columnar Filtering & Selection Vectors
  // ---------------------------------------------------------------------------
  console.log("[Test 2/8] Validating Vectorized Columnar Filtering...");
  const t0 = performance.now();
  // Filter amount > 500
  const sel1 = vectorEngine.vectorFilter(chunk, "amount", "gt", 500);
  assert(sel1.length > 0, "Selection vector should have matches");

  // Chain filter: status == "active"
  const sel2 = vectorEngine.vectorFilter(chunk, "status", "eq", "active", sel1);
  const filterDuration = performance.now() - t0;
  assert(sel2.length <= sel1.length, "Chained filter should narrow selection");
  console.log(`  [✓] Vectorized filtering verified (${sel2.length} matches in ${filterDuration.toFixed(3)} ms).`);

  // ---------------------------------------------------------------------------
  // Test 3: Vectorized Batch Aggregations (SUM, AVG, MIN, MAX, COUNT)
  // ---------------------------------------------------------------------------
  console.log("[Test 3/8] Validating Vectorized SIMD-Style Batch Aggregations...");
  const sum = vectorEngine.vectorAggregate(chunk, "amount", "SUM");
  const count = vectorEngine.vectorAggregate(chunk, "amount", "COUNT");
  const avg = vectorEngine.vectorAggregate(chunk, "amount", "AVG");
  const min = vectorEngine.vectorAggregate(chunk, "amount", "MIN");
  const max = vectorEngine.vectorAggregate(chunk, "amount", "MAX");

  assert(count === 500, "Count should be 500");
  assert(min === 2.5, "Min should be 2.5");
  assert(max === 500 * 2.5, "Max should be 1250");
  assert(Math.abs(avg - sum / count) < 0.0001, "Avg should equal sum / count");
  console.log(`  [✓] Vectorized aggregations verified (SUM: ${sum}, AVG: ${avg.toFixed(2)}, MIN: ${min}, MAX: ${max}).`);

  // ---------------------------------------------------------------------------
  // Test 4: BM25 Inverted Index Construction & Document Management
  // ---------------------------------------------------------------------------
  console.log("[Test 4/8] Validating BM25 Inverted Index & Postings Lists...");
  const indexEngine = new BroccoliInvertedIndexEngine();

  indexEngine.indexDocument("logs", "doc_1", "Fatal error in database transaction kernel");
  indexEngine.indexDocument("logs", "doc_2", "Warning: database connection pool lease timeout");
  indexEngine.indexDocument("logs", "doc_3", "Information: system running smoothly with optimal health");

  assert(indexEngine.getDocumentCount("logs") === 3, "Document count should be 3");
  console.log("  [✓] Inverted index construction verified.");

  // ---------------------------------------------------------------------------
  // Test 5: BM25 Relevance Scoring & Positional Phrase Search
  // ---------------------------------------------------------------------------
  console.log("[Test 5/8] Validating BM25 Probabilistic Ranking & Phrase Search...");
  const searchResults = indexEngine.search("logs", "database kernel error", 5);
  assert(searchResults.length >= 1, "Should match relevant documents");
  assert(searchResults[0].docId === "doc_1", "doc_1 should be top-ranked for 'database kernel error'");
  assert(searchResults[0].score > 0, "Score should be positive");

  // Positional phrase search
  const phraseMatch = indexEngine.search("logs", "connection pool", 5, { phrase: true });
  assert(phraseMatch.length === 1 && phraseMatch[0].docId === "doc_2", "Phrase search must match doc_2");

  const phraseNoMatch = indexEngine.search("logs", "error kernel", 5, { phrase: true });
  assert(phraseNoMatch.length === 0, "Non-contiguous words should not match phrase query");
  console.log("  [✓] BM25 probabilistic ranking and positional phrase search verified.");

  // ---------------------------------------------------------------------------
  // Test 6: 2PC Coordinator - Successful Commit Cycle
  // ---------------------------------------------------------------------------
  console.log("[Test 6/8] Validating 2PC Coordinator Commit Cycle...");
  const coordinator = new BroccoliTwoPhaseCommitCoordinator();

  const mockPartA: IBroccoli2pcParticipant = {
    participantId: "table_users",
    prepare: async () => true,
    commit: async () => {},
    rollback: async () => {},
  };

  const mockPartB: IBroccoli2pcParticipant = {
    participantId: "table_orders",
    prepare: async () => true,
    commit: async () => {},
    rollback: async () => {},
  };

  coordinator.registerParticipant(mockPartA);
  coordinator.registerParticipant(mockPartB);

  coordinator.begin2pcTransaction("tx_2pc_success", ["table_users", "table_orders"]);
  const success = await coordinator.execute2pc("tx_2pc_success");
  assert(success === true, "2PC commit should succeed when all participants prepare");
  const session = coordinator.getTransaction("tx_2pc_success");
  assert(session?.state === "COMMITTED", "Session state must be COMMITTED");
  console.log("  [✓] 2PC commit cycle verified.");

  // ---------------------------------------------------------------------------
  // Test 7: 2PC Coordinator - Abort & Rollback Cycle
  // ---------------------------------------------------------------------------
  console.log("[Test 7/8] Validating 2PC Coordinator Abort & Rollback Cycle...");
  let rolledBack: boolean = false;
  const mockPartC: IBroccoli2pcParticipant = {
    participantId: "table_inventory",
    prepare: async () => false, // Fails prepare!
    commit: async () => {},
    rollback: async () => { rolledBack = true; },
  };

  coordinator.registerParticipant(mockPartC);
  coordinator.begin2pcTransaction("tx_2pc_abort", ["table_users", "table_inventory"]);
  const failure = await coordinator.execute2pc("tx_2pc_abort");
  assert(failure === false, "2PC must abort when a participant fails prepare");
  const abortSession = coordinator.getTransaction("tx_2pc_abort");
  assert(abortSession?.state === "ABORTED", "Session state must be ABORTED");
  assert(rolledBack, "Participant rollback must be invoked");
  console.log("  [✓] 2PC abort and rollback cycle verified.");

  // ---------------------------------------------------------------------------
  // Test 8: Grand Monolith Integration & Centennial Baseline (Pass 200 / 609 components)
  // ---------------------------------------------------------------------------
  console.log("[Test 8/8] Validating Grand Monolith Baseline (Pass 200+ / 609+ components)...");
  const monolith = new LumiMonolith({ cwd: process.cwd(), sessionId: "vector-2pc-session" });

  assert(monolith.components.broccoliVectorEngine instanceof BroccoliVectorEngine, "Vector engine must be wired");
  assert(monolith.components.broccoliInvertedIndexEngine instanceof BroccoliInvertedIndexEngine, "Inverted index engine must be wired");
  assert(monolith.components.broccoliTwoPhaseCommitCoordinator instanceof BroccoliTwoPhaseCommitCoordinator, "2PC coordinator must be wired");

  const synthesis = GrandMonolithSynthesizer.verifyComposition(monolith.components);
  assert(synthesis.cohesionStatus === "OPTIMAL", `Synthesis status should be OPTIMAL, got ${synthesis.cohesionStatus}`);
  assert(synthesis.missingComponents.length === 0, `Missing: ${synthesis.missingComponents.join(", ")}`);
  assert(synthesis.unexpectedComponents.length === 0, `Unexpected: ${synthesis.unexpectedComponents.join(", ")}`);

  assert(CURRENT_EVOLUTION_BASELINE.highestRecordedPass >= 200, "Baseline highestRecordedPass must be >= 200");
  assert(CURRENT_REQUIRED_COMPONENTS.length >= 609, `Expected >= 609 components, got ${CURRENT_REQUIRED_COMPONENTS.length}`);
  console.log(`  [✓] Grand Monolith verified with ${CURRENT_REQUIRED_COMPONENTS.length} components in OPTIMAL status (Pass ${CURRENT_EVOLUTION_BASELINE.highestRecordedPass}).`);

  console.log("================================================================================");
  console.log(" [✓] ALL 8/8 BROCCOLIDB VECTOR, BM25 & 2PC SUITES PASSED!                       ");
  console.log("================================================================================");
}

runBroccoliVector2pcValidation().catch((err) => {
  console.error("\n[✗] BROCCOLIDB VECTOR/2PC VALIDATION FAILED:", err);
  process.exit(1);
});
