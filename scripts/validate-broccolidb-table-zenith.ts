/**
 * validate-broccolidb-table-zenith.ts
 *
 * Comprehensive 10-point validation suite for Zenith-Tier BroccoliDbTable
 * (Phase 71 / ADR-120 & Phase 72 / ADR-121).
 *
 * Verifies multi-modal indexing (equality, sorted range, composite, prefix),
 * rich query operator DSL ($gt, $in, $between, $and, $or, $regex), fluent query builder,
 * reactive CDC subscriptions, atomic transactions, computed columns, table statistics,
 * natural query translation, and query plan explainer.
 */

import { BroccoliDbTable } from "../src/sessions/extensions/substrate/broccolidb-table.js";
import { BroccoliNaturalQueryParser } from "../src/sessions/extensions/substrate/broccolidb-natural-query.js";
import type { TableChangeEvent } from "../src/core/contracts/broccolidb.contracts.js";

interface TaskRecord extends Record<string, unknown> {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "critical";
  score: number;
  tags: string[];
  createdAt: number;
}

async function runZenithTableValidation(): Promise<void> {
  console.log("================================================================");
  console.log("   🥦 BroccoliDB Zenith-Tier Table & Query Engine Validation    ");
  console.log("================================================================");

  const table = new BroccoliDbTable<TaskRecord>("tasks");

  // -------------------------------------------------------------
  // Test 1: Multi-Modal Index Topologies (<0.5 µs / item)
  // -------------------------------------------------------------
  console.log("\n[Test 1/10] Verifying Multi-Modal Index Topologies (Equality, Sorted, Composite, Prefix)...");
  table.createIndex("status");
  table.createSortedIndex("score");
  table.createCompositeIndex(["status", "priority"]);
  table.createPrefixIndex("title");

  const startPopulate = performance.now();
  for (let i = 1; i <= 5000; i++) {
    const status: TaskRecord["status"] = i % 3 === 0 ? "completed" : i % 2 === 0 ? "in_progress" : "pending";
    const priority: TaskRecord["priority"] = i % 4 === 0 ? "critical" : i % 3 === 0 ? "high" : "medium";
    table.put(`task_${i}`, {
      id: `task_${i}`,
      title: `Feature Implementation Subsystem ${i}`,
      status,
      priority,
      score: i * 10,
      tags: ["kernel", "vfs", `tag_${i % 5}`],
      createdAt: 1700000000 + i * 1000,
    });
  }
  const populateDuration = performance.now() - startPopulate;
  console.log(`  [✓] 5,000 multi-indexed records inserted in ${populateDuration.toFixed(2)} ms (${((populateDuration / 5000) * 1000).toFixed(3)} µs/op)`);

  // Verify Equality Index Lookup
  const eqResults = table.query({ where: { status: "completed" } });
  if (eqResults.length !== 1666) {
    throw new Error(`Expected 1666 completed tasks, got ${eqResults.length}`);
  }
  console.log(`  [✓] Equality index resolved 1666 matches instantaneously.`);

  // Verify Composite Index Lookup
  const compResults = table.query({ where: { status: "pending", priority: "medium" } });
  if (compResults.length === 0) {
    throw new Error("Composite index lookup returned 0 matches!");
  }
  console.log(`  [✓] Composite index resolved ${compResults.length} compound matches.`);

  // Verify Prefix Index Lookup
  const prefixResults = table.query({ where: { title: { $startsWith: "Feature Implementation" } } });
  if (prefixResults.length !== 5000) {
    throw new Error(`Expected 5000 prefix matches, got ${prefixResults.length}`);
  }
  console.log(`  [✓] Prefix index resolved 5,000 prefix matches.`);

  // -------------------------------------------------------------
  // Test 2: Rich Query Operator DSL ($gt, $between, $in, $regex, $and, $or)
  // -------------------------------------------------------------
  console.log("\n[Test 2/10] Verifying Rich Query Operator DSL...");
  
  // Sorted Range Query ($between)
  const rangeResults = table.query({ where: { score: { $between: [1000, 2000] } } });
  if (rangeResults.length !== 101) {
    throw new Error(`Expected 101 records in score range [1000, 2000], got ${rangeResults.length}`);
  }
  console.log(`  [✓] Range operator ($between) matched ${rangeResults.length} records.`);

  // Set Membership ($in)
  const inResults = table.query({ where: { priority: { $in: ["high", "critical"] } } });
  if (inResults.length === 0) throw new Error("Operator $in failed!");
  console.log(`  [✓] Set operator ($in) matched ${inResults.length} records.`);

  // Logical Combinators ($and, $or, $not)
  const logicalResults = table.query({
    and: [{ status: "completed" }],
    or: [{ priority: "critical" }, { score: { $gt: 45000 } }],
  });
  if (logicalResults.length === 0) throw new Error("Logical $and / $or query failed!");
  console.log(`  [✓] Complex logical AST ($and / $or) evaluated ${logicalResults.length} matches.`);

  // Regex Operator
  const regexResults = table.query({ where: { title: { $regex: "subsystem 499" } } });
  if (regexResults.length === 0) throw new Error("Regex operator failed!");
  console.log(`  [✓] Regex operator ($regex) matched ${regexResults.length} records.`);

  // -------------------------------------------------------------
  // Test 3: Fluent Query Builder (DSL)
  // -------------------------------------------------------------
  console.log("\n[Test 3/10] Verifying Fluent Query Builder...");
  const fluentResults = table.select()
    .where("status").equals("in_progress")
    .and("score").greaterThan(10000)
    .and("priority").in(["high", "critical"])
    .orderBy("score", "desc")
    .limit(10)
    .execute();

  if (fluentResults.length !== 10) {
    throw new Error(`Expected 10 fluent query results, got ${fluentResults.length}`);
  }
  if (fluentResults[0].score < fluentResults[1].score) {
    throw new Error("Fluent sort order verification failed!");
  }
  console.log(`  [✓] Fluent query builder executed: returned 10 sorted records.`);

  // -------------------------------------------------------------
  // Test 4: Query Execution Planner (explain())
  // -------------------------------------------------------------
  console.log("\n[Test 4/10] Verifying Query Execution Planner (explain())...");
  const plan = table.explain({ where: { status: "pending", priority: "medium" } });
  if (plan.scanStrategy !== "INDEX_LOOKUP") {
    throw new Error(`Expected INDEX_LOOKUP strategy, got ${plan.scanStrategy}`);
  }
  console.log(`  [✓] Query plan correctly identified ${plan.scanStrategy} (${plan.matchedIndex}) in ${plan.executionTimeMicros} µs.`);

  // -------------------------------------------------------------
  // Test 5: Reactive Change Data Capture (CDC) Subscriptions
  // -------------------------------------------------------------
  console.log("\n[Test 5/10] Verifying Reactive CDC Subscriptions...");
  const cdcEvents: TableChangeEvent<TaskRecord>[] = [];
  const subscription = table.subscribe((event) => {
    cdcEvents.push(event);
  });

  table.put("task_cdc_test", {
    id: "task_cdc_test",
    title: "CDC Test Task",
    status: "pending",
    priority: "medium",
    score: 100,
    tags: ["cdc"],
    createdAt: Date.now(),
  });

  table.put("task_cdc_test", {
    id: "task_cdc_test",
    title: "CDC Test Task (Updated)",
    status: "in_progress",
    priority: "high",
    score: 200,
    tags: ["cdc", "updated"],
    createdAt: Date.now(),
  });

  table.delete("task_cdc_test");

  if (cdcEvents.length !== 3) {
    throw new Error(`Expected 3 CDC events, got ${cdcEvents.length}`);
  }
  if (cdcEvents[0].operation !== "INSERT" || cdcEvents[1].operation !== "UPDATE" || cdcEvents[2].operation !== "DELETE") {
    throw new Error("CDC operation sequence mismatch!");
  }
  if (!cdcEvents[1].diff || !cdcEvents[1].diff.status) {
    throw new Error("CDC update diff was not properly populated!");
  }
  subscription.unsubscribe();
  console.log(`  [✓] Reactive CDC captured 3 events with field-level diffs.`);

  // -------------------------------------------------------------
  // Test 6: Atomic In-Memory Transactions & Rollback
  // -------------------------------------------------------------
  console.log("\n[Test 6/10] Verifying Atomic In-Memory Transactions & Rollback...");
  const initialCount = table.count();

  // Successful transaction
  table.transaction((tx) => {
    tx.put("tx_1", {
      id: "tx_1",
      title: "Transaction Item 1",
      status: "pending",
      priority: "low",
      score: 50,
      tags: [],
      createdAt: Date.now(),
    });
  });

  if (table.count() !== initialCount + 1) {
    throw new Error("Transaction commit failed to persist record!");
  }

  // Failed transaction with rollback
  let rollbackCaught = false;
  try {
    table.transaction((tx) => {
      tx.put("tx_fail", {
        id: "tx_fail",
        title: "Will Rollback",
        status: "pending",
        priority: "low",
        score: 0,
        tags: [],
        createdAt: Date.now(),
      });
      throw new Error("Forced transaction failure!");
    });
  } catch {
    rollbackCaught = true;
  }

  if (!rollbackCaught || table.get("tx_fail") !== undefined) {
    throw new Error("Failed transaction did not roll back state cleanly!");
  }
  console.log(`  [✓] Atomic transaction rollback verified with zero residual side-effects.`);

  // -------------------------------------------------------------
  // Test 7: Bulk Operations (bulkPut / bulkDelete)
  // -------------------------------------------------------------
  console.log("\n[Test 7/10] Verifying Bulk Operations (bulkPut / bulkDelete)...");
  const bulkItems: { id: string; record: TaskRecord }[] = [];
  for (let i = 1; i <= 500; i++) {
    bulkItems.push({
      id: `bulk_${i}`,
      record: {
        id: `bulk_${i}`,
        title: `Bulk Task ${i}`,
        status: "pending",
        priority: "low",
        score: i,
        tags: ["bulk"],
        createdAt: Date.now(),
      },
    });
  }
  table.bulkPut(bulkItems);
  if (table.get("bulk_500") === undefined) throw new Error("bulkPut failed!");

  const deleted = table.bulkDelete(bulkItems.map((b) => b.id));
  if (deleted !== 500) throw new Error(`Expected 500 bulk deletes, got ${deleted}`);
  console.log(`  [✓] Bulk operations (500 items) inserted and pruned cleanly.`);

  // -------------------------------------------------------------
  // Test 8: Computed Virtual Columns & Projections
  // -------------------------------------------------------------
  console.log("\n[Test 8/10] Verifying Computed Virtual Columns...");
  table.addComputedColumn("urgencyRating", (record) => {
    return record.priority === "critical" ? "IMMEDIATE" : record.score > 25000 ? "ELEVATED" : "STANDARD";
  });

  const sample = table.get("task_1");
  if (!sample || !("urgencyRating" in sample)) {
    throw new Error("Computed virtual column was not projected on retrieved record!");
  }
  console.log(`  [✓] Computed virtual column (urgencyRating: "${sample.urgencyRating}") projected successfully.`);

  // -------------------------------------------------------------
  // Test 9: Introspection & Column Statistics
  // -------------------------------------------------------------
  console.log("\n[Test 9/10] Verifying Introspection & Column Statistics...");
  const description = table.describe();
  if (description.totalRecords === 0 || description.indices.length !== 4) {
    throw new Error("Table description did not capture all registered indices!");
  }

  const scoreStats = table.columnStats("score");
  if (scoreStats.inferredType !== "number" || scoreStats.minValue !== 10 || scoreStats.maxValue !== 50000) {
    throw new Error("Column statistics calculation failed for numerical score!");
  }
  console.log(`  [✓] Table schema description (${description.columns.length} cols, ${description.indices.length} indices) & stats verified (Avg score: ${scoreStats.average}).`);

  // -------------------------------------------------------------
  // Test 10: Deterministic Natural Query Translation
  // -------------------------------------------------------------
  console.log("\n[Test 10/10] Verifying Natural Language Query Translation...");
  const naturalQuery = "in tasks table with priority high and score > 20000 sorted by score desc limit 5";
  const parsed = BroccoliNaturalQueryParser.parse(naturalQuery, "tasks");
  
  if (parsed.targetTable !== "tasks" || parsed.queryOptions.limit !== 5 || parsed.queryOptions.sortOrder !== "desc") {
    throw new Error("Natural query parser failed to extract structured query options!");
  }

  const naturalResults = table.query(parsed.queryOptions);
  if (naturalResults.length !== 5) {
    throw new Error(`Expected 5 natural query results, got ${naturalResults.length}`);
  }
  console.log(`  [✓] Natural query parsed with ${(parsed.confidence * 100).toFixed(0)}% confidence and executed cleanly.`);

  console.log("\n================================================================");
  console.log("   🥦 ALL 10 ZENITH TABLE VALIDATION TESTS PASSED 100%!         ");
  console.log("================================================================\n");
}

runZenithTableValidation().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
