/**
 * validate-env-probe.ts
 *
 * Comprehensive validation suite for Toolchain Environment Diagnostic Prober,
 * Prompt Hint Generator & Non-Blocking Substrate Subsystem (Phase 134 / ADR-110 / Target #67).
 */

import assert from "node:assert";
import { performance } from "node:perf_hooks";

import { DeterministicEnvProbeEngine } from "../src/agents/extensions/env_probe/deterministic-env-probe-engine.js";
import { EnvProbeSupervisor } from "../src/agents/extensions/env_probe/env-probe-supervisor.js";
import { BroccoliEnvProbeSubstrate } from "../src/sessions/extensions/env_probe/broccoli-env-probe-substrate.js";
import { EnvProbeSnapshotManager } from "../src/sessions/extensions/env_probe/env-probe-snapshot-manager.js";
import { EnvProbeToolSuite } from "../src/tooling/extensions/env_probe/env-probe-tool-suite.js";

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Toolchain Environment Diagnostic Prober (ADR-110)      ");
  console.log("================================================================\n");

  const substrate = new BroccoliEnvProbeSubstrate();
  const engine = new DeterministicEnvProbeEngine();
  const snapshotManager = new EnvProbeSnapshotManager(substrate);
  const supervisor = new EnvProbeSupervisor(substrate, engine);
  const toolSuite = new EnvProbeToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Suite 1: Toolchain Diagnostic Sensing & Clean Environment
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating Clean Toolchain Environment Probing...");

  const cleanProbe = supervisor.executeProbe({
    pythonPath: "/opt/homebrew/bin/python3",
    pipPath: "/opt/homebrew/bin/pip",
    pythonVersion: "3.12.3",
    isPep668Managed: false,
    hasActiveVenv: true,
    venvPath: "/Users/bozoegg/.venv",
    nodeVersion: "v20.11.0",
    packageManager: "pnpm",
    probeDurationMs: 2,
  });

  assert.strictEqual(cleanProbe.detectedAnomalies.length, 0);
  assert.strictEqual(cleanProbe.diagnosticHint, "");
  console.log("  [✓] Clean environment detected with 0 anomalies and empty hint.");

  // ---------------------------------------------------------------------------
  // Suite 2: PEP 668 Externally Managed Environment Detection
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating PEP 668 Externally Managed Detection...");

  const pep668Probe = supervisor.executeProbe({
    pythonPath: "/usr/bin/python3",
    pipPath: "/usr/bin/pip",
    pythonVersion: "3.12.0",
    isPep668Managed: true,
    hasActiveVenv: false,
    probeDurationMs: 3,
  });

  assert.ok(pep668Probe.detectedAnomalies.includes("pep668_managed"));
  assert.ok(pep668Probe.diagnosticHint.includes("PEP 668"));
  console.log(`  Diagnostic Hint: "${pep668Probe.diagnosticHint}"`);
  console.log("  [✓] PEP 668 managed system python detected and actionable hint generated.");

  // ---------------------------------------------------------------------------
  // Suite 3: Python vs Pip Path Mismatch Detection
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Python vs Pip Path Mismatch Detection...");

  const mismatchProbe = supervisor.executeProbe({
    pythonPath: "/usr/local/bin/python3",
    pipPath: "/Users/bozoegg/.local/bin/pip",
    pythonVersion: "3.11.8",
    isPep668Managed: false,
    hasActiveVenv: false,
    probeDurationMs: 2,
  });

  assert.ok(mismatchProbe.detectedAnomalies.includes("python_path_mismatch"));
  assert.ok(mismatchProbe.diagnosticHint.includes("python3 -m pip"));
  console.log(`  Diagnostic Hint: "${mismatchProbe.diagnosticHint}"`);
  console.log("  [✓] Python vs Pip directory mismatch detected with python3 -m pip recommendation.");

  // ---------------------------------------------------------------------------
  // Suite 4: Zero-Overhead Single-Line Prompt Hint Synthesis
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Zero-Overhead Prompt Hint Generation...");

  // Set clean probe in substrate
  supervisor.executeProbe({
    pythonPath: "/usr/bin/python3",
    pipPath: "/usr/bin/pip",
    isPep668Managed: false,
    hasActiveVenv: true,
  });

  const promptHint = supervisor.getSystemPromptHint("cli");
  assert.strictEqual(promptHint, "", "Clean environment must produce empty string");
  console.log("  [✓] Zero token overhead verified for clean environments.");

  // ---------------------------------------------------------------------------
  // Suite 5: Remote Sandbox Platform Bypass (Docker, Modal, SSH)
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Remote Sandbox Platform Bypass...");

  // Invalidate and inject anomaly
  supervisor.executeProbe({
    pythonPath: "/usr/bin/python3",
    isPep668Managed: true,
    hasActiveVenv: false,
  });

  const dockerHint = supervisor.getSystemPromptHint("docker");
  const modalHint = supervisor.getSystemPromptHint("modal");
  const sshHint = supervisor.getSystemPromptHint("ssh");
  const cliHint = supervisor.getSystemPromptHint("cli");

  assert.strictEqual(dockerHint, "", "Docker sandbox must skip local probe");
  assert.strictEqual(modalHint, "", "Modal sandbox must skip local probe");
  assert.strictEqual(sshHint, "", "SSH sandbox must skip local probe");
  assert.ok(cliHint.length > 0, "CLI local session must include hint");
  console.log("  [✓] Remote execution sandboxes bypassed local environment diagnostics.");

  // ---------------------------------------------------------------------------
  // Suite 6: In-Memory Substrate Binary Snapshotting & O(1) Rollback
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Binary Snapshotting & O(1) Rollback...");

  const snap = snapshotManager.takeSnapshot("snap-env-1");
  assert.ok(snap.cachedProbe !== undefined);

  // Mutate substrate
  supervisor.invalidateCache();
  assert.strictEqual(supervisor.getCachedProbe(), undefined);

  // Rewind (warmed)
  snapshotManager.restoreSnapshot("snap-env-1");
  const tRewindStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("snap-env-1");
  const rewindLatencyMs = performance.now() - tRewindStart;

  assert.ok(restored, "Snapshot restore must succeed");
  assert.ok(supervisor.getCachedProbe() !== undefined);
  assert.ok(rewindLatencyMs < 0.05, `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.05 ms SLA`);
  console.log(`  [✓] Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms).`);

  // ---------------------------------------------------------------------------
  // Suite 7: Model Tool Suite Execution
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Model Tool Suite Execution...");

  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 5, "Must expose exactly 5 model tools");

  const inspectTool = tools.find((t) => t.name === "env_probe_inspect")!;
  const refreshTool = tools.find((t) => t.name === "env_probe_refresh")!;
  const promptTool = tools.find((t) => t.name === "env_probe_generate_prompt_hint")!;
  const configTool = tools.find((t) => t.name === "env_probe_configure")!;
  const metricsTool = tools.find((t) => t.name === "env_probe_get_metrics")!;

  const inspRes = (await inspectTool.execute({}, "")) as any;
  assert.strictEqual(inspRes.success, true);
  assert.ok(inspRes.hasCachedProbe);

  const refRes = (await refreshTool.execute({ isPep668Managed: true }, "")) as any;
  assert.strictEqual(refRes.success, true);
  assert.ok(refRes.probe.isPep668Managed);

  const pmtRes = (await promptTool.execute({ platform: "cli" }, "")) as any;
  assert.strictEqual(pmtRes.success, true);
  assert.ok(pmtRes.hint.includes("PEP 668"));

  const cfgRes = (await configTool.execute({ skipRemoteBackends: true }, "")) as any;
  assert.strictEqual(cfgRes.success, true);

  const metRes = (await metricsTool.execute({}, "")) as any;
  assert.strictEqual(metRes.success, true);
  assert.ok(metRes.metrics.totalProbesRun > 0);
  console.log("  [✓] All 5 Environment Probe model tools executed cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 8: High-Frequency Toolchain Analysis Micro-Benchmarks
  // ---------------------------------------------------------------------------
  console.log("\n[Test 8/8] Benchmarking High-Frequency Toolchain Analysis...");

  const iterations = 100000;
  const rawParams = {
    pythonPath: "/usr/bin/python3",
    pipPath: "/usr/local/bin/pip",
    pythonVersion: "3.12.0",
    isPep668Managed: true,
    hasActiveVenv: false,
    probeDurationMs: 1,
  };

  const tBenchStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    engine.analyzeToolchain(rawParams);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} toolchain analyses in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(throughputOpsPerSec > 1000000, "Throughput must exceed 1,000,000 ops/sec");

  console.log("  [✓] Ultra-high-throughput benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 ENV PROBE VALIDATION SUITES PASSED CLEANLY!            ");
  console.log("================================================================\n");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
