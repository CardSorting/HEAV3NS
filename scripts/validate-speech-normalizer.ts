/**
 * validate-speech-normalizer.ts
 *
 * Comprehensive validation suite for Target #48: Deterministic Speech Text Normalizer,
 * Non-Spoken Block Stripper & Symbol Expansion Subsystem (Phase 115 / ADR-091).
 */

import assert from "node:assert";
import {
  DeterministicSpeechTextNormalizer,
  SpeechNormalizerSupervisor,
  BroccoliSpeechNormalizerSubstrate,
  SpeechNormalizerSnapshotManager,
  SpeechNormalizerToolSuite,
} from "../src/index.js";

async function runSuite() {
  console.log("================================================================");
  console.log("   LUMI Speech Text Normalizer & Phonetics Subsystem (ADR-091) ");
  console.log("================================================================");

  const normalizer = new DeterministicSpeechTextNormalizer();
  const substrate = new BroccoliSpeechNormalizerSubstrate();
  const snapshotManager = new SpeechNormalizerSnapshotManager(substrate);
  const supervisor = new SpeechNormalizerSupervisor(substrate, normalizer);
  const toolSuite = new SpeechNormalizerToolSuite(supervisor);

  // --------------------------------------------------------------------------
  // [Test 1/8] Non-Spoken Block Stripping (<think> and file-mutation verifiers)
  // --------------------------------------------------------------------------
  console.log("\n[Test 1/8] Validating Non-Spoken Block Stripping...");

  const rawAssistant1 = "<think>Let me formulate the exact answer for the user.</think> The operation completed successfully.";
  const res1 = normalizer.stripNonspokenBlocks(rawAssistant1);
  assert.strictEqual(res1.strippedCount, 1);
  assert.strictEqual(res1.text.trim(), "The operation completed successfully.");

  const unclosedReasoning = "<think>Streaming cut off mid-thought";
  const resUnclosed = normalizer.stripNonspokenBlocks(unclosedReasoning);
  assert.strictEqual(resUnclosed.strippedCount, 1);
  assert.strictEqual(resUnclosed.text.trim(), "");

  const withVerifier = "Done.\n\n⚠️ File-mutation verifier: 2 files NOT modified\n  • src/app.ts\n  • package.json";
  const resVerifier = normalizer.stripNonspokenBlocks(withVerifier);
  assert.strictEqual(resVerifier.text.trim(), "Done.");

  console.log("  [✓] <think> reasoning blocks and file-mutation verifiers stripped cleanly.");

  // --------------------------------------------------------------------------
  // [Test 2/8] Markdown Syntax & Pipe Table Stripping
  // --------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Markdown Syntax & Table Stripping...");

  const mdInput = "Check `git status` and run:\n```bash\nnpm run build\n```\nSee [Hermes Docs](https://hermes.agent/docs) for **vital** info and ~~deprecated~~ notes.";
  const mdStripped = normalizer.stripMarkdown(mdInput);
  assert.ok(!mdStripped.includes("```"));
  assert.ok(!mdStripped.includes("`git status`"));
  assert.ok(!mdStripped.includes("https://"));
  assert.ok(mdStripped.includes("Hermes Docs"));
  assert.ok(mdStripped.includes("vital"));
  assert.ok(mdStripped.includes("deprecated"));

  const tableInput = "| Feature | Status |\n| Speed | Fast |";
  const tableStripped = normalizer.stripMarkdown(tableInput);
  assert.ok(!tableStripped.includes("|"));
  assert.ok(tableStripped.includes(";"));
  assert.ok(tableStripped.includes("Feature"));
  assert.ok(tableStripped.includes("Status"));

  console.log("  [✓] Markdown code blocks, links, formatting, and tables stripped into speakable words.");

  // --------------------------------------------------------------------------
  // [Test 3/8] Temperature Range & Degree Symbol Expansion
  // --------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Temperature Range & Degree Symbol Expansion...");

  const tempRangeC = normalizer.normalizeSymbols("Tomorrow will be 11–17 °C with light rain.");
  assert.strictEqual(tempRangeC.text, "Tomorrow will be 11 to 17 degrees Celsius with light rain.");

  const tempRangeF = normalizer.normalizeSymbols("Set thermostat between 68-72 °F tonight.");
  assert.strictEqual(tempRangeF.text, "Set thermostat between 68 to 72 degrees Fahrenheit tonight.");

  const singleTemp = normalizer.normalizeSymbols("The water is 25 °C and the oven is 350°.");
  assert.strictEqual(singleTemp.text, "The water is 25 degrees Celsius and the oven is 350 degrees.");

  console.log("  [✓] Temperature ranges and degree symbols phonetically expanded.");

  // --------------------------------------------------------------------------
  // [Test 4/8] Currencies, Percentages & Numeric Rates Expansion
  // --------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Currencies, Percentages & Numeric Rates...");

  const currencyText = "Prices: NZ$50, A$75.25, US$100, €45, £30, and $20.";
  const currencyRes = normalizer.normalizeSymbols(currencyText);
  assert.strictEqual(
    currencyRes.text,
    "Prices: 50 New Zealand dollars, 75.25 Australian dollars, 100 US dollars, 45 euros, 30 pounds, and 20 dollars."
  );

  const ratesText = "Capacity is 99.5% with 5/month and 100/sec limit.";
  const ratesRes = normalizer.normalizeSymbols(ratesText);
  assert.strictEqual(ratesRes.text, "Capacity is 99.5 percent with 5 per month and 100 per sec limit.");

  console.log("  [✓] Currencies, percentages, and numeric rates phonetically expanded.");

  // --------------------------------------------------------------------------
  // [Test 5/8] Units, Math Glyphs, Arrows & Emoji Filtering
  // --------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Units, Math Glyphs, Arrows & Emoji Filtering...");

  const unitsText = "Driving at 100 km/h over 50 mm clearance • A & B → C ≈ 10 🚀🎉";
  const unitsRes = normalizer.normalizeSymbols(unitsText);
  assert.strictEqual(
    unitsRes.text.trim(),
    "Driving at 100 kilometres per hour over 50 millimetres clearance   A  and  B  to  C  about  10"
  );

  console.log("  [✓] Physical measurement units, math symbols, arrows, and emojis filtered.");

  // --------------------------------------------------------------------------
  // [Test 6/8] Heading Lead-In Cadence & Newline Flattening
  // --------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Heading Lead-Ins & Newline Flattening...");

  const scriptWithHeading = "# Weather Forecast\nIt will be sunny today across the region.";
  const prep = normalizer.prepareSpokenText(scriptWithHeading);
  assert.strictEqual(
    prep.spokenScript,
    "Weather Forecast, It will be sunny today across the region."
  );

  const multiline = "Line one.\nLine two.\nLine three.";
  const flattened = normalizer.flattenNewlines(multiline);
  assert.strictEqual(flattened, "Line one. Line two. Line three.");

  console.log("  [✓] Heading cadence lead-ins and single-line payload flattening verified.");

  // --------------------------------------------------------------------------
  // [Test 7/8] In-Memory Substrate Lexicon, Binary Snapshots & O(1) Rollback
  // --------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Custom Pronunciation Lexicons & O(1) Rollback...");

  substrate.clear();
  supervisor.registerLexiconEntry({
    term: "K8s",
    replacement: "Kubernetes",
    caseSensitive: false,
    category: "custom",
  });
  supervisor.registerLexiconEntry({
    term: "pgvector",
    replacement: "Postgres vector",
    caseSensitive: false,
    category: "custom",
  });

  const customText = "Deploy K8s cluster with pgvector support.";
  const normalizedCustom = supervisor.normalizeText(customText);
  assert.strictEqual(
    normalizedCustom.spokenScript,
    "Deploy Kubernetes cluster with Postgres vector support."
  );

  // Snapshot & Rollback
  const snapshot = snapshotManager.takeSnapshot("checkpoint-speech-1");

  supervisor.registerLexiconEntry({
    term: "GraphQL",
    replacement: "Graph Q L",
    caseSensitive: false,
    category: "custom",
  });
  assert.strictEqual(supervisor.listLexiconEntries().length, 3);

  // Warmup JIT
  for (let i = 0; i < 5; i++) {
    snapshotManager.restoreSnapshot("checkpoint-speech-1");
  }

  supervisor.registerLexiconEntry({ term: "GraphQL", replacement: "Graph Q L", caseSensitive: false, category: "custom" });
  const tRollbackStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("checkpoint-speech-1");
  const rollbackDurationMs = performance.now() - tRollbackStart;

  assert.strictEqual(restored, true);
  assert.strictEqual(supervisor.listLexiconEntries().length, 2);
  assert.ok(
    rollbackDurationMs < 0.05,
    `Rollback completed in ${rollbackDurationMs.toFixed(4)} ms (< 0.05 ms SLA)`
  );

  console.log(`  [✓] Custom lexicon registration & instant O(1) rollback verified (${rollbackDurationMs.toFixed(4)} ms).`);

  // --------------------------------------------------------------------------
  // [Test 8/8] Model Tool Suite (5 Tools) & Ultra-High-Throughput Micro-Benchmark
  // --------------------------------------------------------------------------
  console.log("\n[Test 8/8] Validating Model Tool Suite & Micro-Benchmarks...");

  // Tool 1: speech_normalize_text
  const t1 = await toolSuite.getTools().find((t) => t.name === "speech_normalize_text")?.execute({
    text: "<think>thinking...</think> # Status Report\nServer load is 45% at 22 °C with $150 budget.",
  }, "");
  assert.strictEqual((t1 as any)?.success, true);
  assert.strictEqual((t1 as any)?.spokenScript, "Status Report, Server load is 45 percent at 22 degrees Celsius with 150 dollars budget.");

  // Tool 2: speech_strip_nonspoken_blocks
  const t2 = await toolSuite.getTools().find((t) => t.name === "speech_strip_nonspoken_blocks")?.execute({
    text: "<think>hidden</think>Visible text",
  }, "");
  assert.strictEqual((t2 as any)?.success, true);
  assert.strictEqual((t2 as any)?.cleanedText.trim(), "Visible text");

  // Tool 3: speech_expand_symbols
  const t3 = await toolSuite.getTools().find((t) => t.name === "speech_expand_symbols")?.execute({
    text: "Temp is 30 °C.",
  }, "");
  assert.strictEqual((t3 as any)?.success, true);
  assert.ok((t3 as any)?.expandedText.includes("30 degrees Celsius"));

  // Tool 4: speech_register_lexicon_entry
  const t4 = await toolSuite.getTools().find((t) => t.name === "speech_register_lexicon_entry")?.execute({
    term: "Wasm",
    replacement: "Web Assembly",
  }, "");
  assert.strictEqual((t4 as any)?.success, true);

  // Tool 5: speech_get_normalizer_metrics
  const t5 = await toolSuite.getTools().find((t) => t.name === "speech_get_normalizer_metrics")?.execute({}, "");
  assert.strictEqual((t5 as any)?.success, true);
  assert.ok((t5 as any)?.metrics?.totalNormalizations >= 1);

  // Ultra-High-Throughput Micro-Benchmark: 50,000 normalizations
  const iterations = 50000;
  const sampleAssistantTexts = [
    "<think>plan</think> # Update\nEverything is running at 100 km/h with 15 °C temperature.",
    "Cost is US$50 with 10% discount for 5/month plan.",
    "Check `README.md` and [Website](https://example.com) for details.",
    "| Task | State |\n| Step 1 | Done |",
  ];
  const tBenchStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    normalizer.prepareSpokenText(sampleAssistantTexts[i % sampleAssistantTexts.length]);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} normalizations in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(throughputOpsPerSec > 100000, "Throughput must exceed 100,000 ops/sec");

  console.log("  [✓] All 5 model tools executed cleanly & ultra-high-throughput benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 SPEECH NORMALIZER VALIDATION SUITES PASSED CLEANLY!   ");
  console.log("================================================================");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
