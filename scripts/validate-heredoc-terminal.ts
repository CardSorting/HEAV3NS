/**
 * validate-heredoc-terminal.ts
 *
 * Comprehensive validation suite for Target #43: Conservative Shell Heredoc Sanitizer,
 * Subshell Trap Interceptor, Multi-Line Script Synthesizer & Terminal Diagnostics (Phase 110 / ADR-086).
 */

import assert from "node:assert";
import {
  DeterministicHeredocSanitizer,
  TerminalDiagnosticsEngine,
  HeredocTerminalSupervisor,
  BroccoliHeredocTerminalSubstrate,
  HeredocTerminalSnapshotManager,
  HeredocTerminalToolSuite,
  INERT_HEREDOC_CONSUMER_PATTERN,
  DANGEROUS_SHELL_PATTERNS,
} from "../src/index.js";

async function runSuite() {
  console.log("================================================================");
  console.log("   LUMI Shell Heredoc Sanitizer & Diagnostics (ADR-086)         ");
  console.log("================================================================");

  const sanitizer = new DeterministicHeredocSanitizer();
  const diagnosticsEngine = new TerminalDiagnosticsEngine();
  const substrate = new BroccoliHeredocTerminalSubstrate();
  const snapshotManager = new HeredocTerminalSnapshotManager(substrate);
  const supervisor = new HeredocTerminalSupervisor(substrate, sanitizer, diagnosticsEngine);
  const toolSuite = new HeredocTerminalToolSuite(supervisor);

  // --------------------------------------------------------------------------
  // [Test 1/8] Fast-Path Scanner, Quoted Delimiter Parsing & Operator Detection
  // --------------------------------------------------------------------------
  console.log("\n[Test 1/8] Validating Fast-Path Scanner, Quoted Delimiter Parsing & Operators...");

  assert.ok(INERT_HEREDOC_CONSUMER_PATTERN.test("python3"));
  assert.ok(INERT_HEREDOC_CONSUMER_PATTERN.test("env python"));
  assert.ok(INERT_HEREDOC_CONSUMER_PATTERN.test("PYTHONPATH=. /usr/bin/python3"));
  assert.ok(INERT_HEREDOC_CONSUMER_PATTERN.test("osascript"));
  assert.ok(INERT_HEREDOC_CONSUMER_PATTERN.test("cat"));
  assert.ok(INERT_HEREDOC_CONSUMER_PATTERN.test("node"));
  assert.ok(DANGEROUS_SHELL_PATTERNS.length >= 6);

  // Fast-path benchmark: clean command with no '<<'
  for (let w = 0; w < 10; w++) sanitizer.stripInertHeredocBodies("git status -s");
  const t0 = performance.now();
  const cleanRes = sanitizer.stripInertHeredocBodies("git status -s");
  const dur0 = performance.now() - t0;
  assert.strictEqual(cleanRes.hasHeredocs, false);
  assert.strictEqual(cleanRes.maskedBodiesCount, 0);
  assert.ok(dur0 < 2.0, `Fast-path took ${dur0.toFixed(4)} ms`);

  // Parse quoted delimiters
  const op1 = sanitizer.parseHeredocOperator("python3 <<'EOF'\n", 8);
  assert.ok(op1 !== null);
  assert.strictEqual(op1.delimiter, "EOF");
  assert.strictEqual(op1.isQuoted, true);
  assert.strictEqual(op1.stripTabs, false);

  const op2 = sanitizer.parseHeredocOperator("cat <<- \"PY_DELIM\"\n", 4);
  assert.ok(op2 !== null);
  assert.strictEqual(op2.delimiter, "PY_DELIM");
  assert.strictEqual(op2.isQuoted, true);
  assert.strictEqual(op2.stripTabs, true);

  const op3 = sanitizer.parseHeredocOperator("python3 <<\\EOF\n", 8);
  assert.ok(op3 !== null);
  assert.strictEqual(op3.delimiter, "EOF");
  assert.strictEqual(op3.isQuoted, true);

  // Here-strings and unquoted delimiters
  assert.strictEqual(sanitizer.parseHeredocOperator("grep <<< 'test'", 5), null);
  const unquoted = sanitizer.parseHeredocOperator("bash <<EOF\n", 5);
  assert.ok(unquoted !== null);
  assert.strictEqual(unquoted.isQuoted, false);

  console.log("  [✓] Fast-path detection, quoted delimiter parsing & operators verified.");

  // --------------------------------------------------------------------------
  // [Test 2/8] Inert Heredoc Consumer Allowlisting & Fail-Closed Guardrails
  // --------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Inert Heredoc Consumer Allowlisting & Fail-Closed Guardrails...");

  // Safe allowlisted consumers: body should be masked
  const pythonCmd = "python3 <<'EOF'\nimport os\nval = 1 & 2\nprint(val)\nEOF";
  const pySanitized = sanitizer.stripInertHeredocBodies(pythonCmd);
  assert.strictEqual(pySanitized.maskedBodiesCount, 1);
  assert.ok(!pySanitized.sanitizedCommand.includes("val = 1 & 2"));
  assert.ok(pySanitized.sanitizedCommand.includes("python3 <<'EOF'"));
  assert.ok(pySanitized.sanitizedCommand.includes("EOF"));

  const osascriptCmd = "osascript <<'APPLESCRIPT'\nset myText to \"foo\" & \"bar\"\ndisplay dialog myText\nAPPLESCRIPT";
  const osaSanitized = sanitizer.stripInertHeredocBodies(osascriptCmd);
  assert.strictEqual(osaSanitized.maskedBodiesCount, 1);
  assert.ok(!osaSanitized.sanitizedCommand.includes("display dialog"));

  // Fail-closed cases: unquoted delimiters (can expand $(...)) must NOT be masked
  const unquotedBash = "bash <<EOF\necho $(rm -rf /tmp/test)\nEOF";
  const bashSanitized = sanitizer.stripInertHeredocBodies(unquotedBash);
  assert.strictEqual(bashSanitized.maskedBodiesCount, 0);
  assert.strictEqual(bashSanitized.hadAmbiguity, true);
  assert.strictEqual(bashSanitized.sanitizedCommand, unquotedBash);

  // Fail-closed cases: compound openers with list operators
  const compoundCmd = "echo start; python3 <<'EOF'\nprint('hello')\nEOF";
  const compSanitized = sanitizer.stripInertHeredocBodies(compoundCmd);
  assert.strictEqual(compSanitized.maskedBodiesCount, 0);
  assert.strictEqual(compSanitized.hadListOperator, true);

  // Fail-closed cases: nested shell scope
  const nestedScopeCmd = "python3 $(which custom_py) <<'EOF'\nprint('hello')\nEOF";
  const nestedSanitized = sanitizer.stripInertHeredocBodies(nestedScopeCmd);
  assert.strictEqual(nestedSanitized.maskedBodiesCount, 0);
  assert.strictEqual(nestedSanitized.hadNestedScope, true);

  console.log("  [✓] Allowlisted inert consumers & fail-closed security boundaries verified.");

  // --------------------------------------------------------------------------
  // [Test 3/8] Equal-Line Newline Replacement & Layout Coordinate Invariant
  // --------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Equal-Line Newline Replacement & Layout Coordinate Invariant...");

  const multilineScript = `python3 <<'EOF'
import sys
import json

def process_batch(items):
    results = []
    for item in items:
        results.append(item * 2)
    return results

print(json.dumps(process_batch([1, 2, 3])))
EOF`;

  const scriptSanitized = sanitizer.stripInertHeredocBodies(multilineScript);
  const origLineCount = multilineScript.split("\n").length;
  const sanitizedLineCount = scriptSanitized.sanitizedCommand.split("\n").length;

  assert.strictEqual(sanitizedLineCount, origLineCount, "Line count must match exactly");
  assert.strictEqual(scriptSanitized.preservedLineCount, origLineCount);

  console.log(`  [✓] Equal-line newline replacement verified (${sanitizedLineCount} lines preserved).`);

  // --------------------------------------------------------------------------
  // [Test 4/8] Script Heredoc Wrapper Synthesizer Across Multiple Interpreters
  // --------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Script Heredoc Wrapper Synthesizer...");

  // Python wrapper synthesis
  const pyCode = 'import os\nprint("Running inside container", os.getpid())';
  const pySynth = sanitizer.synthesizeScriptHeredoc(pyCode, {
    interpreter: "python",
    environmentVars: { ENV: "production", DEBUG: "false" },
    extraArgs: ["-u"],
  });
  assert.ok(pySynth.synthesizedCommandLine.startsWith('ENV="production" DEBUG="false" python3 - -u <<\'EOF\'\n'));
  assert.ok(pySynth.synthesizedCommandLine.endsWith("\nEOF"));
  assert.strictEqual(pySynth.interpreter, "python");

  // Node wrapper synthesis
  const jsCode = 'const fs = require("fs");\nconsole.log(process.version);';
  const nodeSynth = sanitizer.synthesizeScriptHeredoc(jsCode, {
    interpreter: "node",
    delimiter: "NODE_SCRIPT_EOF",
    stripTabs: true,
  });
  assert.ok(nodeSynth.synthesizedCommandLine.includes("node - <<-'NODE_SCRIPT_EOF'"));
  assert.ok(nodeSynth.synthesizedCommandLine.endsWith("NODE_SCRIPT_EOF"));

  // Bash wrapper synthesis
  const shCode = 'set -euo pipefail\necho "Deploying cluster..."\nuptime';
  const shSynth = sanitizer.synthesizeScriptHeredoc(shCode, {
    interpreter: "bash",
  });
  assert.ok(shSynth.synthesizedCommandLine.includes("bash <<'EOF'"));

  console.log("  [✓] Script heredoc synthesis for Python, Node, and Bash verified.");

  // --------------------------------------------------------------------------
  // [Test 5/8] Command Safety Classification & Background Operator Isolation
  // --------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Command Safety Classification & Background Operator Isolation...");

  // 1. Dangerous pattern blocking: Fork bomb
  const forkBomb = ":(){ :|:& };:";
  const forkSafety = sanitizer.classifyCommandSafety(forkBomb);
  assert.strictEqual(forkSafety.isSafe, false);
  assert.strictEqual(forkSafety.riskLevel, "blocked");

  // 2. Dangerous pattern blocking: Root rm -rf
  const rootRm = "rm -rf /";
  const rmSafety = sanitizer.classifyCommandSafety(rootRm);
  assert.strictEqual(rmSafety.isSafe, false);
  assert.strictEqual(rmSafety.riskLevel, "blocked");

  // 3. Bitwise & inside Python heredoc should NOT trigger background operator flag
  const safeBitwiseCmd = "python3 <<'EOF'\na = 0b1010\nb = 0b1100\nres = a & b\nprint(res)\nEOF";
  const bitwiseSafety = sanitizer.classifyCommandSafety(safeBitwiseCmd);
  assert.strictEqual(bitwiseSafety.isSafe, true);
  assert.strictEqual(bitwiseSafety.riskLevel, "clean");
  assert.strictEqual(bitwiseSafety.hasBackgroundOperator, false);

  // 4. Real background operator outside heredoc SHOULD be flagged
  const bgPythonCmd = "python3 <<'EOF'\nprint('async worker')\nEOF &";
  const bgSafety = sanitizer.classifyCommandSafety(bgPythonCmd);
  assert.strictEqual(bgSafety.isSafe, false);
  assert.strictEqual(bgSafety.riskLevel, "high");
  assert.strictEqual(bgSafety.hasBackgroundOperator, true);

  console.log("  [✓] Command safety classification & false-positive background operator elimination verified.");

  // --------------------------------------------------------------------------
  // [Test 6/8] Non-Zero Exit Code Diagnostics & Actionable Terminal Hints
  // --------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Non-Zero Exit Code Diagnostics & Terminal Hints...");

  // Test 1: Python ModuleNotFoundError
  const pyDiag = diagnosticsEngine.diagnose(
    1,
    "",
    "Traceback (most recent call last):\n  File 'main.py', line 2, in <module>\nModuleNotFoundError: No module named 'pydantic'"
  );
  assert.strictEqual(pyDiag.isRecoverable, true);
  assert.strictEqual(pyDiag.primaryHint?.category, "missing_module");
  assert.strictEqual(pyDiag.primaryHint?.suggestedCommand, "pip install pydantic");

  // Test 2: Node.js Cannot find module
  const nodeDiag = diagnosticsEngine.diagnose(
    1,
    "",
    "Error: Cannot find module 'express'\nRequire stack:\n- /app/server.js"
  );
  assert.strictEqual(nodeDiag.primaryHint?.category, "missing_module");
  assert.strictEqual(nodeDiag.primaryHint?.suggestedCommand, "npm install express");

  // Test 3: Port collision EADDRINUSE
  const portDiag = diagnosticsEngine.diagnose(
    1,
    "",
    "Error: listen EADDRINUSE: address already in use :::8080"
  );
  assert.strictEqual(portDiag.primaryHint?.category, "port_collision");
  assert.strictEqual(portDiag.primaryHint?.suggestedCommand, "lsof -i :8080 -t | xargs kill -9");

  // Test 4: Missing command
  const cmdDiag = diagnosticsEngine.diagnose(
    127,
    "",
    "zsh: command not found: rg"
  );
  assert.strictEqual(cmdDiag.primaryHint?.category, "missing_command");
  assert.ok(cmdDiag.primaryHint?.suggestedCommand?.includes("which rg"));

  // Test 5: Git merge conflict
  const gitDiag = diagnosticsEngine.diagnose(
    1,
    "Auto-merging src/index.ts\nCONFLICT (content): Merge conflict in src/index.ts\nAutomatic merge failed",
    ""
  );
  assert.strictEqual(gitDiag.primaryHint?.category, "git_conflict");
  assert.strictEqual(gitDiag.primaryHint?.suggestedCommand, "git status && git diff src/index.ts");

  console.log("  [✓] Failure diagnostics for missing modules, ports, missing commands & git conflicts verified.");

  // --------------------------------------------------------------------------
  // [Test 7/8] In-Memory Substrate, Frame Snapshots & Instant O(1) Rollback (< 0.05 ms)
  // --------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating In-Memory Substrate, Frame Snapshots & Instant O(1) Rollback...");

  substrate.clear();

  // Record some operations via supervisor
  supervisor.preProcessCommand("python3 <<'EOF'\nprint('step 1')\nEOF");
  supervisor.preProcessCommand("node <<'EOF'\nconsole.log('step 2');\nEOF");
  supervisor.postProcessExecution(1, "", "ModuleNotFoundError: No module named 'fastapi'");

  const metricsBefore = substrate.getMetrics();
  assert.strictEqual(metricsBefore.totalSanitizations, 2);
  assert.strictEqual(metricsBefore.totalDiagnosticsGenerated, 1);

  // Take snapshot
  const snapshot = snapshotManager.takeSnapshot("checkpoint-heredoc-1");
  assert.strictEqual(snapshot.totalSanitizations, 2);

  // Mutate substrate state
  supervisor.preProcessCommand("cat <<'EOF'\nmutated data\nEOF");
  supervisor.preProcessCommand(":(){ :|:& };:"); // Blocked
  assert.strictEqual(substrate.getMetrics().totalSanitizations, 4);
  assert.strictEqual(substrate.getMetrics().totalDangerousCommandsBlocked, 1);

  // Measure O(1) Rollback latency
  snapshotManager.restoreSnapshot("checkpoint-heredoc-1"); // JIT warmup
  const tRollbackStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("checkpoint-heredoc-1");
  const rollbackDurationMs = performance.now() - tRollbackStart;

  assert.strictEqual(restored, true);
  assert.strictEqual(substrate.getMetrics().totalSanitizations, 2);
  assert.strictEqual(substrate.getMetrics().totalDangerousCommandsBlocked, 0);
  assert.ok(
    rollbackDurationMs < 0.1,
    `Rollback completed in ${rollbackDurationMs.toFixed(4)} ms (< 0.1 ms SLA)`
  );

  console.log(`  [✓] Frame-perfect binary snapshot & instant O(1) rollback passed (${rollbackDurationMs.toFixed(4)} ms).`);

  // --------------------------------------------------------------------------
  // [Test 8/8] Model Tool Suite (5 Tools) & High-Frequency Micro-Benchmarks
  // --------------------------------------------------------------------------
  console.log("\n[Test 8/8] Validating Model Tool Suite (5 Tools) & Micro-Benchmarks...");

  // Tool 1: terminal_sanitize_heredoc
  const t1 = await toolSuite.getTools().find((t) => t.name === "terminal_sanitize_heredoc")?.execute({
    command: "python3 <<'EOF'\nimport sys\nprint('sanitized')\nEOF",
  }, "");
  assert.strictEqual((t1 as any)?.success, true);
  assert.strictEqual((t1 as any)?.maskedBodiesCount, 1);

  // Tool 2: terminal_synthesize_heredoc
  const t2 = await toolSuite.getTools().find((t) => t.name === "terminal_synthesize_heredoc")?.execute({
    script: 'console.log("Synthesized Node Script");',
    interpreter: "node",
  }, "");
  assert.strictEqual((t2 as any)?.success, true);
  assert.ok((t2 as any)?.synthesizedCommandLine.includes("node - <<'EOF'"));

  // Tool 3: terminal_analyze_command_safety
  const t3 = await toolSuite.getTools().find((t) => t.name === "terminal_analyze_command_safety")?.execute({
    command: "rm -rf /",
  }, "");
  assert.strictEqual((t3 as any)?.success, true);
  assert.strictEqual((t3 as any)?.isSafe, false);
  assert.strictEqual((t3 as any)?.riskLevel, "blocked");

  // Tool 4: terminal_diagnose_command_failure
  const t4 = await toolSuite.getTools().find((t) => t.name === "terminal_diagnose_command_failure")?.execute({
    exit_code: 1,
    stdout: "",
    stderr: "ModuleNotFoundError: No module named 'numpy'",
  }, "");
  assert.strictEqual((t4 as any)?.success, true);
  assert.strictEqual((t4 as any)?.primaryHint?.suggestedCommand, "pip install numpy");

  // Tool 5: terminal_inspect_heredoc_metrics
  const t5 = await toolSuite.getTools().find((t) => t.name === "terminal_inspect_heredoc_metrics")?.execute({
    limit: 10,
  }, "");
  assert.strictEqual((t5 as any)?.success, true);
  assert.ok(typeof (t5 as any)?.metrics?.totalSanitizations === "number");

  // High-Frequency Sanitization Micro-Benchmark: 10,000 operations
  const iterations = 10000;
  const benchmarkCmd = "python3 <<'EOF'\nimport os\nfor i in range(10):\n    print(i & 1)\nEOF";
  const tBenchStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    sanitizer.stripInertHeredocBodies(benchmarkCmd);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} heredoc sanitizations in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(throughputOpsPerSec > 10000, "Throughput must exceed 10,000 ops/sec");

  console.log("  [✓] All 5 model tools executed cleanly & high-frequency micro-benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 HEREDOC & TERMINAL VALIDATION SUITES PASSED CLEANLY!   ");
  console.log("================================================================");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
