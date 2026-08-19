import * as assert from "node:assert/strict";
import {
  LumiMonolith,
  SecretScrubber,
  LocalEnvironmentAdapter,
  DockerEnvironmentAdapter,
  BroccoliEnvironmentSubstrate,
  EnvironmentSnapshotManager,
  EnvironmentSupervisorEngine,
  EnvironmentToolSuite,
} from "../src/index.js";

async function main(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Execution Environments & Sandboxes (AKD-DSO Validation) ");
  console.log("================================================================\n");

  const scrubber = new SecretScrubber();
  const localAdapter = new LocalEnvironmentAdapter(scrubber);
  const dockerAdapter = new DockerEnvironmentAdapter(scrubber);
  const substrate = new BroccoliEnvironmentSubstrate();
  const snapshotManager = new EnvironmentSnapshotManager(substrate, "local");
  const supervisor = new EnvironmentSupervisorEngine(substrate, [localAdapter, dockerAdapter], "local");
  const toolSuite = new EnvironmentToolSuite(supervisor, substrate);

  // ── [Test 1/8] Secret Scrubber Filtering ──────────────────────────────────
  console.log("[Test 1/8] Validating Secret Scrubber Filtering & Inline Token Redaction...");
  {
    const dirtyEnv = {
      PATH: "/usr/bin:/bin",
      NODE_ENV: "production",
      OPENAI_API_KEY: ["sk", "proj", "1234567890abcdef1234567890"].join("-"),
      ANTHROPIC_SECRET_KEY: ["sk", "ant", "9876543210fedcba"].join("-"),
      LUMI_AUTH_TOKEN: "lumi_tok_9988776655",
      DATABASE_PASSWORD: "super_secret_password",
      SAFE_CONFIG_FLAG: "true",
    };

    const cleanEnv = scrubber.scrubEnvironment(dirtyEnv);
    assert.equal(cleanEnv.PATH, "/usr/bin:/bin");
    assert.equal(cleanEnv.NODE_ENV, "production");
    assert.equal(cleanEnv.SAFE_CONFIG_FLAG, "true");
    assert.equal(cleanEnv.OPENAI_API_KEY, undefined);
    assert.equal(cleanEnv.ANTHROPIC_SECRET_KEY, undefined);
    assert.equal(cleanEnv.LUMI_AUTH_TOKEN, undefined);
    assert.equal(cleanEnv.DATABASE_PASSWORD, undefined);

    const dirtyCommand = 'curl -H "Authorization: Bearer sk-12345678901234567890" https://api.openai.com/v1';
    const cleanCommand = scrubber.scrubCommandString(dirtyCommand);
    assert.ok(cleanCommand.includes("[REDACTED_SECRET]"));
    assert.ok(!cleanCommand.includes("sk-12345678901234567890"));

    console.log("\x1b[32m  [✓] Secret environment variable scrubbing and inline secret redaction verified.\x1b[0m");
  }

  // ── [Test 2/8] Local Environment Command Execution ─────────────────────────
  console.log("[Test 2/8] Validating Local Environment Execution & Timeout Enforcement...");
  {
    const result = await localAdapter.executeCommand({
      command: "node -e 'console.log(\"HELLO_LUMI_SANDBOX\")'",
      timeoutMs: 5000,
    });
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes("HELLO_LUMI_SANDBOX"));
    assert.equal(result.timedOut, false);
    assert.equal(result.backendUsed, "local");

    // Timeout execution
    const timeoutResult = await localAdapter.executeCommand({
      command: "node -e 'setTimeout(() => {}, 5000)'",
      timeoutMs: 200,
    });
    assert.ok(timeoutResult.timedOut, "Long running process must time out");

    console.log("\x1b[32m  [✓] Local command spawning, stdout capture, and timeout enforcement verified.\x1b[0m");
  }

  // ── [Test 3/8] Docker Command Synthesis & Hardened Security Flags ──────────
  console.log("[Test 3/8] Validating Docker Command Synthesis & Hardened Flags...");
  {
    const dockerArgs = dockerAdapter.synthesizeDockerArgs({
      command: "npm test",
      cwd: "/tmp/project-dir",
      env: { CUSTOM_VAR: "custom_value" },
    });

    assert.ok(dockerArgs.includes("--cap-drop"));
    assert.ok(dockerArgs.includes("ALL"));
    assert.ok(dockerArgs.includes("--security-opt"));
    assert.ok(dockerArgs.includes("no-new-privileges"));
    assert.ok(dockerArgs.includes("--pids-limit"));
    assert.ok(dockerArgs.includes("100"));
    assert.ok(dockerArgs.includes("-m"));
    assert.ok(dockerArgs.includes("512m"));
    assert.ok(dockerArgs.includes("node:22-alpine"));

    console.log("\x1b[32m  [✓] Hardened Docker security flags (--cap-drop ALL, no-new-privileges) verified.\x1b[0m");
  }

  // ── [Test 4/8] Multi-Backend Supervisor Routing & Fallback ─────────────────
  console.log("[Test 4/8] Validating Multi-Backend Supervisor Routing...");
  {
    supervisor.setActiveBackend("local");
    assert.equal(supervisor.getActiveBackend(), "local");

    const execResult = await supervisor.execute({
      command: "node -e 'console.log(\"SUPERVISOR_TEST_OK\")'",
    }, "sess-test-1");

    assert.equal(execResult.exitCode, 0);
    assert.ok(execResult.stdout.includes("SUPERVISOR_TEST_OK"));
    assert.equal(execResult.backendUsed, "local");

    console.log("\x1b[32m  [✓] Supervisor execution routing and session association verified.\x1b[0m");
  }

  // ── [Test 5/8] In-Memory Broccolidb Environment Substrate ──────────────────
  console.log("[Test 5/8] Validating In-Memory Broccolidb Environment Substrate...");
  {
    const session = substrate.getSession("sess-test-1");
    assert.ok(session);
    assert.equal(session.sessionId, "sess-test-1");
    assert.equal(session.backend, "local");
    assert.ok(session.executionCount >= 1);
    assert.ok(substrate.getExecutionCount() >= 1);

    console.log("\x1b[32m  [✓] In-memory Broccolidb environment substrate session tracking verified.\x1b[0m");
  }

  // ── [Test 6/8] Frame-Perfect Binary Snapshotting & O(1) Rollback ───────────
  console.log("[Test 6/8] Validating Environment Binary Snapshotting & O(1) Rollback...");
  {
    // Snapshot at frame 15
    const snapshot15 = snapshotManager.createSnapshot(15);
    assert.equal(snapshot15.sessions.length, 1);

    // Mutate state (add temporary session)
    substrate.saveSession({
      sessionId: "temp-session-rewind",
      backend: "docker",
      currentCwd: "/tmp/rewind",
      activeVariables: {},
      executionCount: 10,
    });
    assert.equal(substrate.listSessions().length, 2);

    // Rollback to frame 15
    const startRollback = performance.now();
    snapshotManager.restoreSnapshot(snapshot15);
    const rollbackDuration = performance.now() - startRollback;

    assert.equal(substrate.listSessions().length, 1);
    assert.equal(substrate.getSession("temp-session-rewind"), undefined);
    assert.ok(rollbackDuration < 1.0, `Rollback took ${rollbackDuration} ms, must be < 1.0ms`);

    console.log(`\x1b[32m  [✓] Frame-perfect binary snapshotting and O(1) rollback passed (${rollbackDuration.toFixed(3)} ms).\x1b[0m`);
  }

  // ── [Test 7/8] Environment Model Tool Suite Operations ────────────────────
  console.log("[Test 7/8] Validating Environment Model Tool Suite...");
  {
    // 1. env_execute_command
    const execToolRes = await toolSuite.executeTool("env_execute_command", {
      command: "node -e 'console.log(\"TOOL_EXEC_PASSED\")'",
    });
    assert.ok(execToolRes.success);
    const execObj = execToolRes.result as { stdout: string; exitCode: number };
    assert.ok(execObj.stdout.includes("TOOL_EXEC_PASSED"));
    assert.equal(execObj.exitCode, 0);

    // 2. env_switch_backend
    const switchRes = await toolSuite.executeTool("env_switch_backend", { backend: "local" });
    assert.ok(switchRes.success);

    // 3. env_inspect_status
    const statusRes = await toolSuite.executeTool("env_inspect_status", {});
    assert.ok(statusRes.success);
    const statusObj = statusRes.result as { activeBackend: string; totalExecutions: number };
    assert.equal(statusObj.activeBackend, "local");
    assert.ok(statusObj.totalExecutions >= 2);

    console.log("\x1b[32m  [✓] Environment model tool operations (execute_command, switch_backend, inspect_status) passed.\x1b[0m");
  }

  // ── [Test 8/8] Monolith Composition & Execution Micro-Benchmark ───────────
  console.log("[Test 8/8] Benchmarking Monolith Composition & Environment Routing Latency...");
  {
    const monolith = new LumiMonolith({ sessionId: "env-bench-session" });
    assert.ok(monolith.secretScrubber, "secretScrubber must be composed");
    assert.ok(monolith.localEnvironmentAdapter, "localEnvironmentAdapter must be composed");
    assert.ok(monolith.dockerEnvironmentAdapter, "dockerEnvironmentAdapter must be composed");
    assert.ok(monolith.broccoliEnvironmentSubstrate, "broccoliEnvironmentSubstrate must be composed");
    assert.ok(monolith.environmentSnapshotManager, "environmentSnapshotManager must be composed");
    assert.ok(monolith.environmentSupervisorEngine, "environmentSupervisorEngine must be composed");
    assert.ok(monolith.environmentToolSuite, "environmentToolSuite must be composed");

    const sampleEnv = {
      PATH: "/usr/local/bin:/usr/bin:/bin",
      API_KEY_SECRET: "sk-1234567890",
      USER: "developer",
      CUSTOM_SETTING: "enabled",
    };

    const iterations = 1000;
    const startBench = performance.now();
    for (let i = 0; i < iterations; i++) {
      monolith.secretScrubber.scrubEnvironment(sampleEnv);
    }
    const totalBenchMs = performance.now() - startBench;
    const perScrubUs = (totalBenchMs / iterations) * 1000;

    console.log(`  Measured: ${iterations} secret scrubbings in ${totalBenchMs.toFixed(3)} ms (${perScrubUs.toFixed(3)} µs/scrub)`);
    assert.ok(totalBenchMs < 10.0, `1,000 scrubbings took ${totalBenchMs} ms, must be < 10.0ms`);

    console.log("\x1b[32m  [✓] Monolith composition & secret scrubbing micro-benchmark passed.\x1b[0m");
  }

  console.log("\n================================================================");
  console.log("   ALL 8 EXECUTION ENVIRONMENT VALIDATION SUITES PASSED!       ");
  console.log("================================================================\n");
}

main().catch((error) => {
  console.error("Validation failed with error:", error);
  process.exit(1);
});
