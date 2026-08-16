/**
 * validate-skill-linter.ts
 *
 * Comprehensive validation suite for Deterministic Skill Tree Linter,
 * Frontmatter Conventions Verifier & Anti-Scaffolding Guard Subsystem (Phase 135 / ADR-111 / Target #68).
 */

import assert from "node:assert";
import { performance } from "node:perf_hooks";

import { DeterministicSkillLinterEngine } from "../src/agents/extensions/skill_linter/deterministic-skill-linter-engine.js";
import { SkillLinterSupervisor } from "../src/agents/extensions/skill_linter/skill-linter-supervisor.js";
import { BroccoliSkillLinterSubstrate } from "../src/sessions/extensions/skill_linter/broccoli-skill-linter-substrate.js";
import { SkillLinterSnapshotManager } from "../src/sessions/extensions/skill_linter/skill-linter-snapshot-manager.js";
import { SkillLinterToolSuite } from "../src/tooling/extensions/skill_linter/skill-linter-tool-suite.js";

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Deterministic Skill Tree Linter (ADR-111)               ");
  console.log("================================================================\n");

  const substrate = new BroccoliSkillLinterSubstrate();
  const engine = new DeterministicSkillLinterEngine();
  const snapshotManager = new SkillLinterSnapshotManager(substrate);
  const supervisor = new SkillLinterSupervisor(substrate, engine);
  const toolSuite = new SkillLinterToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Suite 1: Clean Skill Frontmatter & Prose Validation
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating Clean Skill Package...");

  const cleanContent = `---
name: "git_advanced"
description: "Handles git rebase and cherry-pick workflows when git history surgery is required."
---
# Git Advanced Instructions
When performing git history cleanup, invoke search_files to inspect changed files.
`;

  const cleanReport = supervisor.lintSkill({
    skillName: "git_advanced",
    rawContent: cleanContent,
    dirName: "git_advanced",
    filesInDir: ["SKILL.md", "scripts/rebase.sh"],
    scriptContents: {
      "scripts/rebase.sh": "echo 'rebasing'",
    },
  });

  assert.strictEqual(cleanReport.isValid, true);
  assert.strictEqual(cleanReport.findings.length, 0);
  console.log("  [✓] Clean skill package verified with 0 findings.");

  // ---------------------------------------------------------------------------
  // Suite 2: Banned Shell Utility Detection (grep -> search_files, cat -> read_file)
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Banned Shell Utility Detection...");

  const shellContent = `---
name: "log_scanner"
description: "Scans application logs for errors."
---
# Instructions
To search errors, run grep on the log file, or call cat to view everything.
`;

  const shellReport = supervisor.lintSkill({
    skillName: "log_scanner",
    rawContent: shellContent,
  });

  const bannedShellFindings = shellReport.findings.filter((f) => f.ruleCode === "BANNED_SHELL_TOOL");
  assert.ok(bannedShellFindings.length >= 2, "Must detect both grep and cat recommendations");
  console.log(`  Detected ${bannedShellFindings.length} banned shell tool recommendations.`);
  console.log(`  Suggested fix: ${bannedShellFindings[0].suggestedFix}`);
  console.log("  [✓] Banned shell utility detection verified.");

  // ---------------------------------------------------------------------------
  // Suite 3: Marketing Buzzword Detection & Description Length Warning
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Marketing Buzzword Detection...");

  const buzzContent = `---
name: "seo_optimizer"
description: "A powerful, cutting-edge, and revolutionary tool for seamless search ranking improvements."
---
# Body
`;

  const buzzReport = supervisor.lintSkill({
    skillName: "seo_optimizer",
    rawContent: buzzContent,
  });

  const buzzFindings = buzzReport.findings.filter((f) => f.ruleCode === "MARKETING_BUZZWORD");
  assert.ok(buzzFindings.length >= 3, "Must flag powerful, cutting-edge, and revolutionary");
  console.log(`  Flagged ${buzzFindings.length} marketing buzzwords in description.`);
  console.log("  [✓] Marketing buzzword suppression verified.");

  // ---------------------------------------------------------------------------
  // Suite 4: Forbidden Scaffolding File Detection
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Forbidden Scaffolding File Detection...");

  const scaffoldReport = supervisor.lintSkill({
    skillName: "data_scraper",
    rawContent: "---\nname: 'data_scraper'\ndescription: 'Scrapes web tables.'\n---\n",
    filesInDir: ["SKILL.md", "README.md", "CHANGELOG.md", ".env"],
  });

  const scaffoldFindings = scaffoldReport.findings.filter((f) => f.ruleCode === "FORBIDDEN_SCAFFOLDING");
  assert.strictEqual(scaffoldFindings.length, 3, "Must flag README.md, CHANGELOG.md, and .env");
  assert.strictEqual(scaffoldReport.errorCount, 3);
  assert.strictEqual(scaffoldReport.isValid, false, "Scaffolding errors must invalidate skill when blockOnError=true");
  console.log("  [✓] Forbidden scaffolding files blocked cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 5: Missing Platform Gates on POSIX Script Primitives
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Missing Platform Gate Detection...");

  const posixReport = supervisor.lintSkill({
    skillName: "mac_automator",
    rawContent: "---\nname: 'mac_automator'\ndescription: 'Automates macOS system settings.'\n---\n",
    scriptContents: {
      "scripts/notify.py": "import os\nos.system('osascript -e \"display notification\"')",
    },
  });

  const posixFindings = posixReport.findings.filter((f) => f.ruleCode === "MISSING_PLATFORM_GATE");
  assert.strictEqual(posixFindings.length, 1, "Must flag ungated osascript");
  console.log(`  Suggested Fix: ${posixFindings[0].suggestedFix}`);
  console.log("  [✓] Un-gated POSIX script primitives detected.");

  // ---------------------------------------------------------------------------
  // Suite 6: In-Memory Substrate Binary Snapshotting & O(1) Rollback
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Substrate Binary Snapshotting & O(1) Rollback...");

  const snap = snapshotManager.takeSnapshot("snap-skill-1");
  assert.strictEqual(substrate.getAllReports().length >= 4, true);

  // Clear substrate
  substrate.clear();
  assert.strictEqual(substrate.getAllReports().length, 0);

  // Rewind (warmed)
  snapshotManager.restoreSnapshot("snap-skill-1");
  const tRewindStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("snap-skill-1");
  const rewindLatencyMs = performance.now() - tRewindStart;

  assert.ok(restored, "Snapshot restore must succeed");
  assert.ok(substrate.getAllReports().length >= 4);
  assert.ok(rewindLatencyMs < 0.05, `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.05 ms SLA`);
  console.log(`  [✓] Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms).`);

  // ---------------------------------------------------------------------------
  // Suite 7: Model Tool Suite Execution
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Model Tool Suite Execution...");

  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 5, "Must expose exactly 5 model tools");

  const lintTool = tools.find((t) => t.name === "skill_linter_lint_skill")!;
  const inspectTool = tools.find((t) => t.name === "skill_linter_inspect_findings")!;
  const valDescTool = tools.find((t) => t.name === "skill_linter_validate_description")!;
  const configTool = tools.find((t) => t.name === "skill_linter_configure")!;
  const metricsTool = tools.find((t) => t.name === "skill_linter_get_metrics")!;

  const lintRes = (await lintTool.execute(
    {
      skillName: "tool_test",
      content: "---\nname: 'tool_test'\ndescription: 'A robust test skill.'\n---\n",
    },
    ""
  )) as any;
  assert.strictEqual(lintRes.success, true);
  assert.ok(lintRes.report.findings.length > 0);

  const inspRes = (await inspectTool.execute({ skillName: "tool_test" }, "")) as any;
  assert.strictEqual(inspRes.success, true);
  assert.ok(inspRes.hasReport);

  const descRes = (await valDescTool.execute(
    { description: "A cutting-edge data analyzer." },
    ""
  )) as any;
  assert.strictEqual(descRes.success, true);
  assert.ok(descRes.warnings.length > 0);

  const cfgRes = (await configTool.execute({ checkMarketingWords: false }, "")) as any;
  assert.strictEqual(cfgRes.success, true);
  assert.strictEqual(cfgRes.config.checkMarketingWords, false);

  const metRes = (await metricsTool.execute({}, "")) as any;
  assert.strictEqual(metRes.success, true);
  assert.ok(metRes.metrics.totalSkillsAudited > 0);
  console.log("  [✓] All 5 Skill Linter model tools executed cleanly.");

  // ---------------------------------------------------------------------------
  // Suite 8: High-Frequency Skill Linting Micro-Benchmarks
  // ---------------------------------------------------------------------------
  console.log("\n[Test 8/8] Benchmarking High-Frequency Skill Linting...");

  const iterations = 100000;
  const sampleEnvelope = {
    name: "perf_benchmark",
    description: "Performs high-frequency microsecond benchmarks.",
    body: "Use search_files and read_file to process source data efficiently.",
  };
  const activeConfig = substrate.getConfig();

  // JIT warm-up
  for (let w = 0; w < 5000; w++) {
    engine.lintSkill("perf_benchmark", sampleEnvelope, activeConfig);
  }

  const tBenchStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    engine.lintSkill("perf_benchmark", sampleEnvelope, activeConfig);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} skill audits in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(throughputOpsPerSec > 500000, "Throughput must exceed 500,000 ops/sec");

  console.log("  [✓] Ultra-high-throughput benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 SKILL LINTER VALIDATION SUITES PASSED CLEANLY!         ");
  console.log("================================================================\n");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
