import * as assert from "node:assert/strict";
import {
  LumiMonolith,
  FtsQuerySanitizer,
  BroccoliSearchSubstrate,
  SearchSnapshotManager,
  DeterministicSessionSearchEngine,
  SearchToolSuite,
} from "../src/index.js";

async function main(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Session Search & Inverted Index (AKD-DSO Validation)   ");
  console.log("================================================================\n");

  const sanitizer = new FtsQuerySanitizer();
  const substrate = new BroccoliSearchSubstrate();
  const snapshotManager = new SearchSnapshotManager(substrate);
  const searchEngine = new DeterministicSessionSearchEngine(substrate, sanitizer);
  const toolSuite = new SearchToolSuite(searchEngine, substrate);

  // ── [Test 1/8] FTS Query Sanitization ─────────────────────────────────────
  console.log("[Test 1/8] Validating FTS Query Sanitization & CJK Detection...");
  {
    const rawQuery = '+{foo}:"bar"^@/#&|~[baz]<>,;!?$=\'';
    const { cleanQuery, tokens, isCjk } = sanitizer.sanitizeQuery(rawQuery);
    assert.equal(cleanQuery, "foo bar baz");
    assert.deepEqual(tokens, ["foo", "bar", "baz"]);
    assert.equal(isCjk, false);

    // CJK detection & ngram tokenization
    const cjkQuery = "构建游戏引擎";
    const cjkRes = sanitizer.sanitizeQuery(cjkQuery);
    assert.equal(cjkRes.isCjk, true);
    assert.ok(cjkRes.tokens.length >= 6);

    console.log("\x1b[32m  [✓] Unsafe character stripping and CJK n-gram tokenization verified.\x1b[0m");
  }

  // ── [Test 2/8] Inverted Index Ingestion & Postings ─────────────────────────
  console.log("[Test 2/8] Validating Inverted Index Ingestion & Posting Lists...");
  {
    substrate.clear();
    substrate.indexMessage({
      id: "msg-1",
      sessionId: "sess-alpha",
      turnIndex: 1,
      role: "user",
      content: "Build Flappy Bird canvas game.",
      timestampMs: Date.now() - 5000,
    });
    substrate.indexMessage({
      id: "msg-2",
      sessionId: "sess-alpha",
      turnIndex: 2,
      role: "assistant",
      content: "Created HTML5 Canvas renderer for Flappy Bird.",
      timestampMs: Date.now() - 4000,
    });
    substrate.indexMessage({
      id: "msg-3",
      sessionId: "sess-beta",
      turnIndex: 1,
      role: "user",
      content: "Add sound synthesizer to game audio.",
      timestampMs: Date.now() - 2000,
    });

    const birdPostings = substrate.getPostings("bird");
    assert.equal(birdPostings.length, 2);
    assert.ok(birdPostings.includes("msg-1"));
    assert.ok(birdPostings.includes("msg-2"));

    const audioPostings = substrate.getPostings("audio");
    assert.equal(audioPostings.length, 1);
    assert.equal(audioPostings[0], "msg-3");

    console.log("\x1b[32m  [✓] Multi-session message indexing and posting lists verified.\x1b[0m");
  }

  // ── [Test 3/8] BM25 Relevance Scoring & Ranking ───────────────────────────
  console.log("[Test 3/8] Validating BM25 Relevance Scoring & Ranking Order...");
  {
    const results = searchEngine.search({
      query: "Flappy Bird canvas",
    });

    assert.ok(results.length >= 2);
    assert.ok(results[0].score >= results[1].score, "Top result must have highest score");
    assert.ok(results[0].matchedTerms.length >= 2);

    // Role-filtered search
    const assistantOnly = searchEngine.search({
      query: "Flappy Bird",
      roleFilter: "assistant",
    });
    assert.equal(assistantOnly.length, 1);
    assert.equal(assistantOnly[0].role, "assistant");

    console.log("\x1b[32m  [✓] BM25 relevance scoring, ordering, and role filtering verified.\x1b[0m");
  }

  // ── [Test 4/8] Match Snippet Extraction ────────────────────────────────────
  console.log("[Test 4/8] Validating Match Snippet Extraction...");
  {
    const results = searchEngine.search({
      query: "Canvas renderer",
    });
    assert.ok(results.length > 0);
    assert.ok(results[0].snippet.includes("Canvas"), "Snippet must contain match term");

    console.log("\x1b[32m  [✓] Snippet extraction around match offsets verified.\x1b[0m");
  }

  // ── [Test 5/8] In-Memory Broccolidb Search Substrate ───────────────────────
  console.log("[Test 5/8] Validating In-Memory Broccolidb Search Substrate...");
  {
    const terms = substrate.getAllTerms();
    assert.ok(terms.length > 5);
    assert.ok(terms.includes("flappy"));
    assert.ok(terms.includes("canvas"));

    const alphaMsgs = substrate.listMessages("sess-alpha");
    assert.equal(alphaMsgs.length, 2);

    console.log("\x1b[32m  [✓] In-memory Broccolidb search substrate storage passed.\x1b[0m");
  }

  // ── [Test 6/8] Frame-Perfect Binary Snapshotting & O(1) Rollback ───────────
  console.log("[Test 6/8] Validating Search Binary Snapshotting & O(1) Rollback...");
  {
    // Snapshot at frame 10
    const snapshot10 = snapshotManager.createSnapshot(10);
    assert.equal(snapshot10.records.length, 3);

    // Mutate state (add 2 new messages)
    substrate.indexMessage({
      id: "msg-temp-1",
      sessionId: "sess-gamma",
      turnIndex: 1,
      role: "user",
      content: "Temporary message that will be rewound.",
      timestampMs: Date.now(),
    });
    assert.equal(substrate.listMessages().length, 4);

    // Rollback to frame 10
    const startRollback = performance.now();
    snapshotManager.restoreSnapshot(snapshot10);
    const rollbackDuration = performance.now() - startRollback;

    assert.equal(substrate.listMessages().length, 3);
    assert.equal(substrate.getMessage("msg-temp-1"), undefined);
    assert.ok(rollbackDuration < 1.0, `Rollback took ${rollbackDuration} ms, must be < 1.0ms`);

    console.log(`\x1b[32m  [✓] Frame-perfect binary snapshotting and O(1) rollback passed (${rollbackDuration.toFixed(3)} ms).\x1b[0m`);
  }

  // ── [Test 7/8] Search Model Tool Suite Operations ─────────────────────────
  console.log("[Test 7/8] Validating Search Model Tool Suite...");
  {
    // 1. session_search_history
    const searchRes = await toolSuite.executeTool("session_search_history", { query: "Flappy Bird", limit: 5 });
    assert.ok(searchRes.success);
    const resultObj = searchRes.result as { totalMatches: number };
    assert.ok(resultObj.totalMatches >= 2);

    // 2. session_extract_context
    const contextRes = await toolSuite.executeTool("session_extract_context", { recordId: "msg-2", radius: 1 });
    assert.ok(contextRes.success);
    const contextObj = contextRes.result as { contextWindow: unknown[] };
    assert.equal(contextObj.contextWindow.length, 2);

    // 3. session_index_status
    const statusRes = await toolSuite.executeTool("session_index_status", {});
    assert.ok(statusRes.success);
    const statusObj = statusRes.result as { totalIndexedMessages: number; totalUniqueTerms: number };
    assert.equal(statusObj.totalIndexedMessages, 3);
    assert.ok(statusObj.totalUniqueTerms > 5);

    console.log("\x1b[32m  [✓] Search model tool operations (search_history, extract_context, index_status) passed.\x1b[0m");
  }

  // ── [Test 8/8] Monolith Composition & Search Micro-Benchmark ──────────────
  console.log("[Test 8/8] Benchmarking Monolith Composition & In-Memory Search Latency...");
  {
    const monolith = new LumiMonolith({ sessionId: "search-bench-session" });
    assert.ok(monolith.ftsQuerySanitizer, "ftsQuerySanitizer must be composed");
    assert.ok(monolith.broccoliSearchSubstrate, "broccoliSearchSubstrate must be composed");
    assert.ok(monolith.searchSnapshotManager, "searchSnapshotManager must be composed");
    assert.ok(monolith.deterministicSessionSearchEngine, "deterministicSessionSearchEngine must be composed");
    assert.ok(monolith.searchToolSuite, "searchToolSuite must be composed");

    // Populate benchmark messages
    for (let i = 0; i < 50; i++) {
      monolith.deterministicSessionSearchEngine.indexMessage({
        id: `bench-msg-${i}`,
        sessionId: `bench-session-${i % 5}`,
        turnIndex: i,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Iteration ${i}: Executing automated task step ${i} with compiler diagnostics and test coverage.`,
        timestampMs: Date.now() + i * 1000,
      });
    }

    const iterations = 1000;
    const startBench = performance.now();
    for (let i = 0; i < iterations; i++) {
      monolith.deterministicSessionSearchEngine.search({
        query: "compiler diagnostics test coverage",
        limit: 10,
      });
    }
    const totalBenchMs = performance.now() - startBench;
    const perSearchUs = (totalBenchMs / iterations) * 1000;

    console.log(`  Measured: ${iterations} searches (over 50 indexed messages) in ${totalBenchMs.toFixed(3)} ms (${perSearchUs.toFixed(3)} µs/search)`);
    assert.ok(totalBenchMs < 50.0, `1,000 searches took ${totalBenchMs} ms, must be < 50.0ms`);

    console.log("\x1b[32m  [✓] Monolith composition & search micro-benchmark passed.\x1b[0m");
  }

  console.log("\n================================================================");
  console.log("   ALL 8 SESSION SEARCH VALIDATION SUITES PASSED!              ");
  console.log("================================================================\n");
}

main().catch((error) => {
  console.error("Validation failed with error:", error);
  process.exit(1);
});
