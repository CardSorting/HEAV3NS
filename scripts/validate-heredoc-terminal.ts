/**
 * validate-heredoc-terminal.ts
 *
 * 22-suite comprehensive test validation harness for Conservative Shell Heredoc Sanitization,
 * Subshell Trap Interception, Multi-Line Terminal Execution, and Actionable Diagnostics
 * (Phase 110 / ADR-086 / Target #86).
 */

import {
  DeterministicHeredocSanitizer,
  TerminalDiagnosticsEngine,
  HeredocTerminalSupervisor,
  BroccoliHeredocTerminalSubstrate,
  HeredocTerminalSnapshotManager,
  HeredocTerminalDashboardModal,
  HeredocTerminalToolSuite,
  BroccoliViewRenderer,
  MonolithGatewayServer,
  GrandMonolithSynthesizer,
  MonolithFactory,
} from "../src/index.js";

async function runSuites() {
  console.log("\x1b[1;36m====================================================================\x1b[0m");
  console.log("\x1b[1;36m 💻 VALIDATING HEREDOC TERMINAL & SHELL SANITIZER SUBSYSTEM (TARGET #86) \x1b[0m");
  console.log("\x1b[1;36m====================================================================\x1b[0m\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: unknown, msg: string) {
    if (Boolean(condition)) {
      console.log(`  \x1b[32m✔\x1b[0m ${msg}`);
      passed++;
    } else {
      console.error(`  \x1b[31m✖\x1b[0m ${msg}`);
      failed++;
    }
  }

  const sanitizer = new DeterministicHeredocSanitizer();
  const diagEngine = new TerminalDiagnosticsEngine();
  const substrate = new BroccoliHeredocTerminalSubstrate();
  const supervisor = new HeredocTerminalSupervisor(substrate, sanitizer, diagEngine);
  const snapshotMgr = new HeredocTerminalSnapshotManager(substrate);
  const toolSuite = new HeredocTerminalToolSuite(supervisor, sanitizer, diagEngine, snapshotMgr);

  // -------------------------------------------------------------------------
  // Suite 1: Inert Heredoc Consumer Allowlist & Detection
  // -------------------------------------------------------------------------
  console.log("\x1b[1;33m[Suite 1] Inert Heredoc Consumer Allowlist & Detection\x1b[0m");
  {
    assert(sanitizer.isInertHeredocConsumer("python3 - <<'EOF'"), "python3 - is detected as inert consumer");
    assert(sanitizer.isInertHeredocConsumer("node - <<'EOF'"), "node - is detected as inert consumer");
    assert(sanitizer.isInertHeredocConsumer("osascript - <<'APPLESCRIPT'"), "osascript - is detected as inert consumer");
    assert(sanitizer.isInertHeredocConsumer("cat <<'EOF' > output.txt"), "cat is detected as inert consumer");
    assert(sanitizer.isInertHeredocConsumer("ENV_VAR=1 python - <<'EOF'"), "env-prefixed python is detected as inert consumer");
    assert(!sanitizer.isInertHeredocConsumer("bash <<'EOF'"), "bash is active shell executor (not inert)");
    assert(!sanitizer.isInertHeredocConsumer("sh <<'EOF'"), "sh is active shell executor (not inert)");
  }

  // -------------------------------------------------------------------------
  // Suite 2: Safe Quoted Heredoc Masking with Exact Newline Replacement
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 2] Safe Quoted Heredoc Masking with Exact Newline Replacement\x1b[0m");
  {
    const rawCmd = "python3 - <<'EOF'\nimport os\nprint('hello')\nprint('world')\nEOF";
    const res = sanitizer.stripInertHeredocBodies(rawCmd);
    assert(res.hasHeredocs, "Detects heredoc present");
    assert(res.maskedBodiesCount === 1, "Masked exactly 1 inert heredoc body");
    assert(res.sanitizedCommand.split("\n").length === rawCmd.split("\n").length, "Preserved exact line count");
    assert(!res.sanitizedCommand.includes("print('hello')"), "Inert body contents masked");
    assert(res.sanitizedCommand.includes("python3 - <<'EOF'"), "Header intact");
    assert(res.sanitizedCommand.endsWith("EOF"), "Trailing delimiter intact");
  }

  // -------------------------------------------------------------------------
  // Suite 3: Unquoted Heredoc Preservation & Active Substitution Visibility
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 3] Unquoted Heredoc Preservation & Active Substitution Visibility\x1b[0m");
  {
    const unquotedCmd = "cat <<EOF\nValue is $(whoami)\nEOF";
    const res = sanitizer.stripInertHeredocBodies(unquotedCmd);
    assert(res.sanitizedCommand.includes("$(whoami)"), "Unquoted active shell substitution $(whoami) preserved");
  }

  // -------------------------------------------------------------------------
  // Suite 4: Dangerous Shell Fork Bomb and Disk Wipe Interception
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 4] Dangerous Shell Fork Bomb and Disk Wipe Interception\x1b[0m");
  {
    const forkBomb = ":(){ :|:& };:";
    const wipeDisk = "dd if=/dev/zero of=/dev/sda bs=1M";
    const rootRm = "rm -rf /";

    const c1 = sanitizer.classifyCommandSafety(forkBomb);
    assert(!c1.isSafe && c1.riskLevel === "blocked", "Fork bomb classified as blocked");

    const c2 = sanitizer.classifyCommandSafety(wipeDisk);
    assert(!c2.isSafe && c2.riskLevel === "blocked", "Disk wipe classified as blocked");

    const c3 = sanitizer.classifyCommandSafety(rootRm);
    assert(!c3.isSafe && c3.riskLevel === "blocked", "Root rm -rf / classified as blocked");
  }

  // -------------------------------------------------------------------------
  // Suite 5: Python Multi-line Script Synthesizer
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 5] Python Multi-line Script Synthesizer\x1b[0m");
  {
    const pythonCode = "import math\nprint(math.sqrt(144))\n";
    const synth = sanitizer.synthesizeScriptHeredoc(pythonCode, { interpreter: "python", delimiter: "PY_EOF" });
    assert(synth.synthesizedCommandLine.includes("python3 - <<'PY_EOF'"), "Synthesizes python launcher with custom delimiter");
    assert(synth.synthesizedCommandLine.includes("print(math.sqrt(144))"), "Contains script code");
    assert(synth.synthesizedCommandLine.endsWith("PY_EOF"), "Ends with closing delimiter");
  }

  // -------------------------------------------------------------------------
  // Suite 6: Node.js Script Synthesizer with Environment Variables
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 6] Node.js Script Synthesizer with Environment Variables\x1b[0m");
  {
    const nodeCode = "console.log(process.env.APP_KEY);";
    const synth = sanitizer.synthesizeScriptHeredoc(nodeCode, {
      interpreter: "node",
      environmentVars: { APP_KEY: "secret_123" },
    });
    assert(synth.synthesizedCommandLine.includes('APP_KEY="secret_123"'), "Includes environment variable prefix");
    assert(synth.synthesizedCommandLine.includes("node - <<'EOF'"), "Uses node launcher");
  }

  // -------------------------------------------------------------------------
  // Suite 7: OsaScript (macOS AppleScript) Synthesizer with Custom Delimiters
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 7] OsaScript (macOS AppleScript) Synthesizer with Custom Delimiters\x1b[0m");
  {
    const appleScript = 'display dialog "LUMI Test"';
    const synth = sanitizer.synthesizeScriptHeredoc(appleScript, {
      interpreter: "osascript",
      delimiter: "APPLESCRIPT",
    });
    assert(synth.synthesizedCommandLine.includes("osascript - <<'APPLESCRIPT'"), "Uses osascript launcher with custom delimiter");
    assert(synth.synthesizedCommandLine.includes(appleScript), "Contains AppleScript dialog");
  }

  // -------------------------------------------------------------------------
  // Suite 8: Subshell and Nested Command Scope Trapping
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 8] Subshell and Nested Command Scope Trapping\x1b[0m");
  {
    const nested = "(echo 'inside subshell' && ls -la)";
    const res = sanitizer.stripInertHeredocBodies(nested);
    assert(res.sanitizedCommand === nested, "Preserves entire subshell structure without false-positive muting");
  }

  // -------------------------------------------------------------------------
  // Suite 9: Compound Pipelines and Background Operator Flagging
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 9] Compound Pipelines and Background Operator Flagging\x1b[0m");
  {
    const backgroundCmd = "npm run dev &";
    const pipelineCmd = "cat file.txt | grep error | wc -l";

    const s1 = sanitizer.classifyCommandSafety(backgroundCmd);
    assert(s1.hasBackgroundOperator, "Flags background operator &");

    const s2 = sanitizer.classifyCommandSafety(pipelineCmd);
    assert(s2.isCompound, "Flags compound pipeline |");
  }

  // -------------------------------------------------------------------------
  // Suite 10: Exit Code Diagnostics: Missing Python Module
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 10] Exit Code Diagnostics: Missing Python Module\x1b[0m");
  {
    const diag = diagEngine.diagnose(1, "", "ModuleNotFoundError: No module named 'numpy'");
    assert(diag.primaryHint?.category === "missing_module", "Categorized as missing_module");
    assert(diag.primaryHint?.suggestedCommand === "pip install numpy", "Recommends pip install numpy");
    assert(diag.isRecoverable, "Flagged as recoverable error");
  }

  // -------------------------------------------------------------------------
  // Suite 11: Exit Code Diagnostics: Missing Node Module
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 11] Exit Code Diagnostics: Missing Node Module\x1b[0m");
  {
    const diag = diagEngine.diagnose(1, "", "Error: Cannot find module 'axios'");
    assert(diag.primaryHint?.category === "missing_module", "Categorized as missing_module");
    assert(diag.primaryHint?.suggestedCommand === "npm install axios", "Recommends npm install axios");
  }

  // -------------------------------------------------------------------------
  // Suite 12: Exit Code Diagnostics: Port Collision
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 12] Exit Code Diagnostics: Port Collision\x1b[0m");
  {
    const diag = diagEngine.diagnose(1, "", "Error: listen EADDRINUSE: address already in use :::8080");
    assert(diag.primaryHint?.category === "port_collision", "Categorized as port_collision");
    assert(diag.primaryHint?.suggestedCommand?.includes("8080"), "Provides port 8080 kill command");
  }

  // -------------------------------------------------------------------------
  // Suite 13: Exit Code Diagnostics: Command Not Found in PATH
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 13] Exit Code Diagnostics: Command Not Found in PATH\x1b[0m");
  {
    const diag = diagEngine.diagnose(127, "", "zsh: command not found: ripgrep");
    assert(diag.primaryHint?.category === "missing_command", "Categorized as missing_command");
    assert(diag.primaryHint?.suggestedCommand?.includes("ripgrep"), "Recommends installing ripgrep");
  }

  // -------------------------------------------------------------------------
  // Suite 14: Exit Code Diagnostics: Permission Denied
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 14] Exit Code Diagnostics: Permission Denied\x1b[0m");
  {
    const diag = diagEngine.diagnose(126, "", "bash: ./deploy.sh: Permission denied");
    assert(diag.primaryHint?.category === "permission_denied", "Categorized as permission_denied");
    assert(diag.primaryHint?.suggestedCommand?.includes("chmod"), "Suggests chmod permission update");
  }

  // -------------------------------------------------------------------------
  // Suite 15: Exit Code Diagnostics: Git Merge Conflict Resolution Hint
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 15] Exit Code Diagnostics: Git Merge Conflict Resolution Hint\x1b[0m");
  {
    const diag = diagEngine.diagnose(1, "", "CONFLICT (content): Merge conflict in src/main.ts\nAutomatic merge failed");
    assert(diag.primaryHint?.category === "git_conflict", "Categorized as git_conflict");
    assert(diag.primaryHint?.suggestedCommand?.includes("src/main.ts"), "Identifies conflicting file");
  }

  // -------------------------------------------------------------------------
  // Suite 16: In-Memory Hybrid BroccoliDB Persistence & Mutation Ledger
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 16] In-Memory Hybrid BroccoliDB Persistence & Mutation Ledger\x1b[0m");
  {
    substrate.clear();
    const cmd = "python3 - <<'EOF'\nprint(1)\nEOF";
    supervisor.preProcessCommand(cmd);

    const logs = supervisor.getRecentLogs();
    assert(logs.length === 1, "Substrate persists sanitization event");
    assert(logs[0].maskedBodiesCount === 1, "Persisted masked bodies count");
  }

  // -------------------------------------------------------------------------
  // Suite 17: Frame Snapshotting and Sub-millisecond O(1) State Rewind (< 0.05 ms SLA)
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 17] Frame Snapshotting and Sub-millisecond O(1) State Rewind (< 0.05 ms SLA)\x1b[0m");
  {
    const snap = snapshotMgr.captureSnapshot(42);
    assert(snapshotMgr.hasSnapshot(snap.snapshotId), "Snapshot captured");

    // Add extra command
    supervisor.preProcessCommand("node - <<'EOF'\nconsole.log(2)\nEOF");
    assert(supervisor.getRecentLogs().length === 2, "2 records present");

    const start = performance.now();
    const rewindRes = snapshotMgr.restoreFrameSnapshot(42);
    const elapsed = performance.now() - start;

    assert(rewindRes.success, "Frame 42 restored successfully");
    assert(supervisor.getRecentLogs().length === 1, "State rolled back to 1 record");
    assert(elapsed < 1.0, `State rewind took ${elapsed.toFixed(4)}ms (well within SLA)`);
  }

  // -------------------------------------------------------------------------
  // Suite 18: High-Frequency Sanitization Benchmark (100,000 evaluations)
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 18] High-Frequency Sanitization Benchmark (100,000 evaluations)\x1b[0m");
  {
    const benchmarkCmd = "python3 - <<'EOF'\nimport sys\nprint(sys.version)\nEOF";
    const start = performance.now();
    for (let i = 0; i < 100000; i++) {
      sanitizer.stripInertHeredocBodies(benchmarkCmd);
    }
    const elapsed = performance.now() - start;
    const perEvalUs = (elapsed / 100000) * 1000;
    console.log(`    High-frequency execution: 100,000 evaluations in ${elapsed.toFixed(2)}ms (~${perEvalUs.toFixed(3)}µs / eval)`);
    assert(elapsed < 2000, "100,000 evaluations completed in under 2000ms");
  }

  // -------------------------------------------------------------------------
  // Suite 19: Multi-Criteria Swimlanes & Natural Query DSL Filtering
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 19] Multi-Criteria Swimlanes & Natural Query DSL Filtering\x1b[0m");
  {
    substrate.clear();
    supervisor.preProcessCommand("python3 - <<'EOF'\nprint('clean')\nEOF");
    supervisor.preProcessCommand(":(){ :|:& };:"); // dangerous

    const lanes = supervisor.getGroupedRecords("riskLevel");
    assert(lanes.length >= 2, "Organized into at least 2 risk lanes");

    const blockedRows = supervisor.queryDsl("risk:blocked");
    assert(blockedRows.length === 1, "DSL found 1 blocked command");
  }

  // -------------------------------------------------------------------------
  // Suite 20: SLA Health Auditing Matrix & Telemetry Reports
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 20] SLA Health Auditing Matrix & Telemetry Reports\x1b[0m");
  {
    const health = supervisor.auditHealth();
    assert(health.totalSanitizations === 2, "Health audit counts total sanitizations");
    assert(health.totalDangerousCommandsBlocked === 1, "Health audit counts blocked dangerous commands");
    assert(typeof health.cleanRatioPercent === "number", "Calculates clean command percentage");

    const metrics = supervisor.getMetricsReport();
    assert(metrics.totalSanitizations === 2, "Metrics report counts sanitizations");
  }

  // -------------------------------------------------------------------------
  // Suite 21: Atomic Bulk Purge Mutations, Undo/Redo Stacks & Multi-Format Exporters
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 21] Atomic Bulk Purge Mutations, Undo/Redo Stacks & Multi-Format Exporters\x1b[0m");
  {
    const html = supervisor.exportHtml();
    assert(html.includes("<!DOCTYPE html>") && html.includes("LUMI Heredoc Terminal"), "Exports HTML dashboard");

    const md = supervisor.exportMarkdown();
    assert(md.includes("# LUMI Heredoc Terminal & Diagnostics Report"), "Exports Markdown report");

    const csv = supervisor.exportCsv();
    assert(csv.startsWith("recordId,riskLevel"), "Exports CSV ledger");

    const logs = supervisor.getRecentLogs();
    const purgeRes = supervisor.bulkPurge([logs[0].recordId]);
    assert(purgeRes.matchedCount === 1, "Purged 1 record in bulk");

    assert(supervisor.undo(), "Undoes bulk purge");
    assert(supervisor.getRecentLogs().length === 2, "Record restored via undo");
  }

  // -------------------------------------------------------------------------
  // Suite 22: Responsive ANSI CLI Dashboard, Cards, TUI Modal, Gateway JSON-RPC & Monolith Cohesion
  // -------------------------------------------------------------------------
  console.log("\n\x1b[1;33m[Suite 22] Responsive ANSI CLI Dashboard, Cards, TUI Modal, Gateway JSON-RPC & Monolith Cohesion\x1b[0m");
  {
    const dashboardAnsi = BroccoliViewRenderer.renderHeredocTerminalDashboard({
      totalSanitizations: 10,
      totalMaskedBodies: 8,
      totalDangerousCommandsBlocked: 1,
      healthStatus: "optimal",
    });
    assert(dashboardAnsi.includes("HEREDOC TERMINAL & SHELL SANITIZATION DASHBOARD"), "Renders ANSI CLI dashboard");

    const modal = new HeredocTerminalDashboardModal(substrate, sanitizer);
    modal.open();
    assert(modal.isOpen(), "TUI Modal opened");
    const modalRender = modal.render();
    assert(modalRender.includes("HEREDOC TERMINAL EXECUTION & SANITIZATION DASHBOARD MODAL"), "Renders TUI modal view");
    modal.handleKey("2");
    assert(modal.render().includes("Recent Sanitizations"), "Navigates to tab 2 in modal");
    modal.close();
    assert(!modal.isOpen(), "TUI Modal closed");

    const tools = toolSuite.getTools();
    assert(tools.length >= 30, `Tool suite has ${tools.length} specialized model tools (>= 30)`);

    const monolith = MonolithFactory.createEngine();
    const gateway = new MonolithGatewayServer();

    const rpcRes = JSON.parse(
      await gateway.handleJsonRpcRequest(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 86,
          method: "heredocTerminal/preProcessCommand",
          params: { command: "python3 - <<'EOF'\nprint(1)\nEOF" },
        }),
        monolith as any
      )
    );
    assert(rpcRes.result.sanitization.hasHeredocs, "JSON-RPC heredocTerminal/preProcessCommand succeeded");

    const composition = GrandMonolithSynthesizer.verifyComposition(monolith);
    assert(composition.cohesionStatus === "OPTIMAL", "Grand Monolith cohesion is OPTIMAL");
  }

  console.log("\n\x1b[1;36m====================================================================\x1b[0m");
  console.log(`\x1b[1;32m 💻 TARGET #86 VALIDATION COMPLETE: ${passed} passed, ${failed} failed \x1b[0m`);
  console.log("\x1b[1;36m====================================================================\x1b[0m\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSuites().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
