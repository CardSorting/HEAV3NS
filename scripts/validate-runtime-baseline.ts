import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { LumiMonolith } from "../src/index.js";
import {
  CURRENT_EVOLUTION_BASELINE,
  GrandMonolithSynthesizer,
} from "../src/factories/grand-monolith-synthesizer.js";
import { RuntimeSmokeSuite } from "../src/tooling/extensions/evals/runtime-smoke-suite.js";
import { LiveBaselineReporter } from "../src/tooling/extensions/evals/live-baseline-reporter.js";
import { FlappyBirdProjectBenchmark } from "../src/tooling/extensions/evals/flappy-bird-project-benchmark.js";
import {
  FLAPPY_BIRD_PROJECT_DIRECTORY,
  FlappyBirdProjectSynthesizer,
} from "../src/agents/extensions/execution/flappy-bird-project-synthesizer.js";
import { ArchitectureGuardrailGate } from "../src/tooling/extensions/policy/architecture-guardrail-gate.js";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class BrokenFlappyBirdProjectSynthesizer extends FlappyBirdProjectSynthesizer {
  override synthesize() {
    const project = super.synthesize();
    return {
      ...project,
      files: project.files.map((file) => file.path === "src/App.tsx"
        ? { ...file, content: file.content.replaceAll("requestAnimationFrame", "missingAnimationFrame") }
        : file),
    };
  }
}

async function main(): Promise<void> {
  const monolith = new LumiMonolith({ cwd: process.cwd(), sessionId: "runtime-baseline-validation" });
  const smoke = await new RuntimeSmokeSuite().run(monolith);
  assert(smoke.passed, `Runtime smoke failed: ${smoke.checks.filter((check) => !check.passed).map((check) => check.id).join(", ")}`);
  assert(smoke.baseline.highestRecordedPass === 200, "Runtime baseline did not advance beyond the legacy Pass 105 ceiling");
  assert(smoke.composition.missingComponents.length === 0, "Current composition is missing required capabilities");
  assert(smoke.composition.unexpectedComponents.length === 0, "Current composition has capabilities absent from the baseline manifest");
  assert(smoke.composition.duplicateManifestComponents.length === 0, "Current composition manifest contains duplicate capabilities");
  const degradedComposition = GrandMonolithSynthesizer.verifyComposition({
    ...monolith.components,
    broccoliOutputBuffer: undefined,
  });
  assert(
    degradedComposition.cohesionStatus === "DEGRADED"
      && degradedComposition.missingComponents.includes("broccoliOutputBuffer"),
    "Composition verification accepted a present-but-uninitialized required capability"
  );
  const driftedComposition = GrandMonolithSynthesizer.verifyComposition({
    ...monolith.components,
    unrecordedCapability: {},
  });
  assert(
    driftedComposition.cohesionStatus === "DEGRADED"
      && driftedComposition.unexpectedComponents.includes("unrecordedCapability"),
    "Composition verification accepted an unrecorded capability without a baseline update"
  );

  const flappyWorkload = new FlappyBirdProjectBenchmark().execute();
  assert(flappyWorkload.outcome === "completed" && flappyWorkload.assertionPassed === true, "Complete Flappy Bird workload failed");
  assert(flappyWorkload.assertions?.length === 8 && flappyWorkload.assertions.every((check) => check.passed), "Flappy Bird workload did not execute all eight validation lanes");
  const brokenFlappyWorkload = new FlappyBirdProjectBenchmark(new BrokenFlappyBirdProjectSynthesizer()).execute();
  assert(brokenFlappyWorkload.outcome === "failed" && brokenFlappyWorkload.assertionPassed === false, "Corrupted Flappy Bird project passed validation");

  const generationRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-flappy-route-"));
  try {
    const generationMonolith = new LumiMonolith({ cwd: generationRoot, sessionId: "flappy-generation-route" });
    const generation = await generationMonolith.tick({ prompt: "flappy bird react vite" });
    const generatedPackage = path.join(generationRoot, FLAPPY_BIRD_PROJECT_DIRECTORY, "package.json");
    assert(generation.outcome === "completed", "Explicit Flappy Bird project route did not complete");
    assert(fs.existsSync(generatedPackage), "Explicit Flappy Bird project route did not materialize the project");
    assert(generationMonolith.sessionVfs.exportStaged().length === 12, "Explicit Flappy Bird route did not stage all project files");
  } finally {
    fs.rmSync(generationRoot, { recursive: true, force: true });
  }

  const compatibility = GrandMonolithSynthesizer.verifyAllPasses({ cwd: process.cwd() });
  assert(compatibility.passCount === CURRENT_EVOLUTION_BASELINE.highestRecordedPass, "Compatibility verification returned a stale pass count");
  assert(compatibility.cohesionStatus === "OPTIMAL", "Compatibility composition verification is degraded");

  const emptyBenchmark = await monolith.masterBenchmarkOrchestrator.runGrandBenchmarkSuite(monolith, []);
  assert(!emptyBenchmark.passed && emptyBenchmark.suiteResult.passRate === 0, "Empty benchmark suite passed vacuously");
  const falseCompletion = await monolith.masterBenchmarkOrchestrator.runGrandBenchmarkSuite(monolith, [{
    name: "Failed Outcome Cannot Pass",
    expectedKeywords: ["looks complete"],
    execute: () => ({ outcome: "failed", response: "looks complete", assertionPassed: true }),
  }]);
  assert(!falseCompletion.passed, "Benchmark accepted response content from a failed outcome as completion");

  const benchmark = await monolith.masterBenchmarkOrchestrator.runGrandBenchmarkSuite(monolith, [
    { name: "Baseline Memory Frame", prompt: "remember: baseline = live", expectedKeywords: ["live"] },
    { name: "Baseline Slash Frame", prompt: "/stats", expectedKeywords: ["Telemetry"] },
  ]);
  assert(benchmark.passed, "Live baseline benchmark assertions failed");
  assert(benchmark.totalDurationMs >= 0 && benchmark.throughputTps >= 0, "Benchmark did not expose live timing metrics");
  const guardrails = await new ArchitectureGuardrailGate().runFullGuardrailAudit(monolith);
  assert(guardrails.overallPassed, "Live baseline guardrail audit failed");

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-live-baseline-"));
  try {
    const writeResult = new LiveBaselineReporter().write(temporaryRoot, {
      repositoryVersion: "test",
      configuredModel: monolith.modelResolver.getActiveModel(),
      smoke,
      benchmark,
      guardrails,
    });
    assert(writeResult.passed, "Reporter marked a passing live run as failed");
    assert(writeResult.files.length === 3, "Reporter did not generate all baseline artifacts");

    const jsonPath = path.join(temporaryRoot, "docs", "LIVE_BASELINE.json");
    const benchmarkPath = path.join(temporaryRoot, "docs", "BENCHMARK_REPORT.md");
    const auditPath = path.join(temporaryRoot, "docs", "GRAND_ARCHITECTURAL_AUDIT.md");
    assert(fs.existsSync(jsonPath) && fs.existsSync(benchmarkPath) && fs.existsSync(auditPath), "One or more baseline artifacts are missing");

    const json = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as {
      schemaVersion?: number;
      passed?: boolean;
      runtime?: { configuredModel?: string };
    };
    const benchmarkMarkdown = fs.readFileSync(benchmarkPath, "utf8");
    const auditMarkdown = fs.readFileSync(auditPath, "utf8");
    assert(json.schemaVersion === 1 && json.passed === true, "Machine-readable baseline schema is invalid");
    assert(json.runtime?.configuredModel === monolith.modelResolver.getActiveModel(), "Baseline did not identify the configured model");
    assert(benchmarkMarkdown.includes("LUMI Live Benchmark Baseline"), "Benchmark report is not live-generated");
    assert(auditMarkdown.includes("LUMI Live Architectural Audit"), "Architectural audit is not live-generated");
    assert(!benchmarkMarkdown.toLowerCase().includes("historical benchmark snapshot"), "Historical snapshot language leaked into live baseline output");

    const failedGuardrails = {
      ...guardrails,
      overallPassed: false,
      passedCount: guardrails.passedCount - 1,
      failedCount: guardrails.failedCount + 1,
      results: guardrails.results.map((result, index) => index === 0 ? { ...result, passed: false } : result),
    };
    const failedWrite = new LiveBaselineReporter().write(temporaryRoot, {
      repositoryVersion: "test",
      configuredModel: monolith.modelResolver.getActiveModel(),
      smoke,
      benchmark,
      guardrails: failedGuardrails,
    });
    const failedJson = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as { passed?: boolean };
    const failedBenchmarkMarkdown = fs.readFileSync(benchmarkPath, "utf8");
    assert(!failedWrite.passed && failedJson.passed === false, "Reporter blessed a failed guardrail lane");
    assert(failedBenchmarkMarkdown.includes("**Live Baseline Status**: `FAILED`"), "Benchmark view hid an overall baseline failure");
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }

  console.log("Runtime baseline validation passed (modern smoke, exact composition, deep Flappy synthesis, live metrics, and atomic report generation).\n");
}

main().catch((error) => {
  console.error("Runtime baseline validation failed:", error);
  process.exitCode = 1;
});
