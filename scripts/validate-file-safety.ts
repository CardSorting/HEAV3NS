/**
 * validate-file-safety.ts
 *
 * Comprehensive validation suite for File Safety Mutation Guards, Sensitive Path Firewall
 * & Safe Root Governance Subsystem (Phase 126 / ADR-102 / Target #59).
 */

import assert from "node:assert";
import { homedir } from "node:os";
import { normalize } from "node:path";
import { performance } from "node:perf_hooks";

import { DeterministicFileSafetyGuard } from "../src/agents/extensions/file_safety/deterministic-file-safety-guard.js";
import { FileSafetySupervisor } from "../src/agents/extensions/file_safety/file-safety-supervisor.js";
import { BroccoliFileSafetySubstrate } from "../src/sessions/extensions/file_safety/broccoli-file-safety-substrate.js";
import { FileSafetySnapshotManager } from "../src/sessions/extensions/file_safety/file-safety-snapshot-manager.js";
import { FileSafetyToolSuite } from "../src/tooling/extensions/file_safety/file-safety-tool-suite.js";

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI File Safety & Path Firewall Validation (ADR-102)        ");
  console.log("================================================================\n");

  const testHome = normalize("/Users/testuser");
  const engine = new DeterministicFileSafetyGuard(testHome);
  const substrate = new BroccoliFileSafetySubstrate();
  const snapshotManager = new FileSafetySnapshotManager(substrate);
  const supervisor = new FileSafetySupervisor(substrate, engine);
  const toolSuite = new FileSafetyToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Suite 1: Path Normalization, Tilde Expansion & Absolute Resolution
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating Path Normalization & Tilde Expansion...");

  assert.strictEqual(engine.normalizePath("~/.ssh/id_rsa"), `${testHome}/.ssh/id_rsa`);
  assert.strictEqual(engine.normalizePath("~/project/app.ts"), `${testHome}/project/app.ts`);
  assert.strictEqual(engine.normalizePath("./src/index.ts", "/workspace"), "/workspace/src/index.ts");
  console.log("  [✓] Path normalization and home tilde expansion verified.");

  // ---------------------------------------------------------------------------
  // Suite 2: Hard-Denied System & Key File Protection
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Hard-Denied System & Key File Protection...");

  const res1 = supervisor.checkWrite("~/.ssh/id_rsa");
  assert.strictEqual(res1.allowed, false);
  assert.strictEqual(res1.verdict, "denied_hard");

  const res2 = supervisor.checkWrite("~/.ssh/authorized_keys");
  assert.strictEqual(res2.allowed, false);
  assert.strictEqual(res2.verdict, "denied_hard");

  const res3 = supervisor.checkWrite("/etc/sudoers");
  assert.strictEqual(res3.allowed, false);
  assert.strictEqual(res3.verdict, "denied_hard");

  const res4 = supervisor.checkWrite("~/.npmrc");
  assert.strictEqual(res4.allowed, false);
  assert.strictEqual(res4.verdict, "denied_hard");
  console.log("  [✓] Hard-denied system, SSH keys, and credential stores blocked.");

  // ---------------------------------------------------------------------------
  // Suite 3: Hard-Denied Directory Prefix Firewall
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Hard-Denied Directory Prefix Firewall...");

  const resAws = supervisor.checkWrite("~/.aws/credentials");
  assert.strictEqual(resAws.allowed, false);
  assert.strictEqual(resAws.verdict, "denied_hard");

  const resGpg = supervisor.checkWrite("~/.gnupg/secring.gpg");
  assert.strictEqual(resGpg.allowed, false);
  assert.strictEqual(resGpg.verdict, "denied_hard");

  const resKube = supervisor.checkWrite("~/.kube/config");
  assert.strictEqual(resKube.allowed, false);
  assert.strictEqual(resKube.verdict, "denied_hard");

  const resSystem = supervisor.checkWrite("/System/Library/CoreServices");
  assert.strictEqual(resSystem.allowed, false);
  assert.strictEqual(resSystem.verdict, "denied_hard");
  console.log("  [✓] Protected directory prefixes blocked across ~/.aws, ~/.gnupg, ~/.kube, /System.");

  // ---------------------------------------------------------------------------
  // Suite 4: Approval-Gated Path Classification
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Approval-Gated Path Classification...");

  const resSshConfig = supervisor.checkWrite("~/.ssh/config");
  assert.strictEqual(resSshConfig.allowed, true);
  assert.strictEqual(resSshConfig.verdict, "approval_required");

  const resGitConfig = supervisor.checkWrite("~/.gitconfig");
  assert.strictEqual(resGitConfig.allowed, true);
  assert.strictEqual(resGitConfig.verdict, "approval_required");

  const resZshrc = supervisor.checkWrite("~/.zshrc");
  assert.strictEqual(resZshrc.allowed, true);
  assert.strictEqual(resZshrc.verdict, "approval_required");
  console.log("  [✓] Approval-gated configuration files (~/.ssh/config, ~/.gitconfig, ~/.zshrc) correctly identified.");

  // ---------------------------------------------------------------------------
  // Suite 5: Sensitive Secret Pattern Recognition
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Sensitive Secret Pattern Recognition...");

  assert.strictEqual(engine.isSensitiveSecretFile(".env"), true);
  assert.strictEqual(engine.isSensitiveSecretFile(".env.local"), true);
  assert.strictEqual(engine.isSensitiveSecretFile("server.key"), true);
  assert.strictEqual(engine.isSensitiveSecretFile("cert.pem"), true);
  assert.strictEqual(engine.isSensitiveSecretFile(".anthropic_oauth.json"), true);
  assert.strictEqual(engine.isSensitiveSecretFile("app.ts"), false);

  const readEnv = supervisor.checkRead(".env");
  assert.strictEqual(readEnv.isSensitive, true);
  console.log("  [✓] Sensitive secret patterns and token credentials classified.");

  // ---------------------------------------------------------------------------
  // Suite 6: Safe Root Enclosure Enforcement & Directory Escape Prevention
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Safe Root Enclosure & Escape Prevention...");

  supervisor.configure({
    enforceSafeRoots: true,
    safeRoots: ["/workspace/project"],
  });

  const insideRoot = supervisor.checkWrite("/workspace/project/src/index.ts");
  assert.strictEqual(insideRoot.allowed, true);
  assert.strictEqual(insideRoot.verdict, "allowed");

  const outsideRoot = supervisor.checkWrite("/var/log/system.log");
  assert.strictEqual(outsideRoot.allowed, false);
  assert.strictEqual(outsideRoot.verdict, "outside_safe_root");

  supervisor.configure({ enforceSafeRoots: false });
  console.log("  [✓] Safe root boundary enclosure and outside escape rejection verified.");

  // ---------------------------------------------------------------------------
  // Suite 7: In-Memory Substrate Binary Snapshotting & O(1) State Rollback
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Binary Snapshotting & O(1) State Rollback...");

  const snap1 = snapshotManager.takeSnapshot("snap-safety-1");
  assert.strictEqual(snap1.metrics.writesDenied > 0, true);

  // Modify state
  supervisor.addSafeRoot("/tmp/custom_root");
  supervisor.addCustomDeniedPath("/tmp/blocked.txt");
  assert.strictEqual(supervisor.getConfig().safeRoots.includes("/tmp/custom_root"), true);

  // Rollback
  const tRewindStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("snap-safety-1");
  const rewindLatencyMs = performance.now() - tRewindStart;

  assert.ok(restored, "Snapshot restore must succeed");
  assert.strictEqual(supervisor.getConfig().safeRoots.includes("/tmp/custom_root"), false);
  assert.ok(rewindLatencyMs < 0.1, `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.1 ms SLA`);
  console.log(`  [✓] Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms).`);

  // ---------------------------------------------------------------------------
  // Suite 8: Model Tool Suite Execution & Micro-Benchmarks
  // ---------------------------------------------------------------------------
  console.log("\n[Test 8/8] Validating Model Tool Suite Execution & Micro-Benchmarks...");

  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 5, "Must expose exactly 5 model tools");

  const checkWriteTool = tools.find((t) => t.name === "file_safety_check_write")!;
  const checkReadTool = tools.find((t) => t.name === "file_safety_check_read")!;
  const addSafeRootTool = tools.find((t) => t.name === "file_safety_add_safe_root")!;
  const inspectRulesTool = tools.find((t) => t.name === "file_safety_inspect_rules")!;
  const metricsTool = tools.find((t) => t.name === "file_safety_get_metrics")!;

  const writeRes = (await checkWriteTool.execute({
    path: "/etc/shadow",
  }, "")) as any;
  assert.strictEqual(writeRes.allowed, false);
  assert.strictEqual(writeRes.verdict, "denied_hard");

  const readRes = (await checkReadTool.execute({
    path: ".env.production",
  }, "")) as any;
  assert.strictEqual(readRes.isSensitive, true);

  const addRootRes = (await addSafeRootTool.execute({
    rootPath: "/opt/lumi/data",
  }, "")) as any;
  assert.strictEqual(addRootRes.success, true);

  const inspectRes = (await inspectRulesTool.execute({}, "")) as any;
  assert.strictEqual(inspectRes.success, true);

  const metricsRes = (await metricsTool.execute({}, "")) as any;
  assert.strictEqual(metricsRes.success, true);
  assert.ok(metricsRes.metrics.totalEvaluations > 0);

  // Micro-Benchmark
  const iterations = 100000;
  const config = supervisor.getConfig();
  const tBenchStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    engine.evaluateWrite("/workspace/project/file_" + (i % 100) + ".ts", config, "/workspace", testHome);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} evaluations in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(throughputOpsPerSec > 500000, "Throughput must exceed 500,000 ops/sec");

  console.log("  [✓] All 5 File Safety model tools executed cleanly & benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 FILE SAFETY VALIDATION SUITES PASSED CLEANLY!         ");
  console.log("================================================================\n");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
