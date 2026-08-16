/**
 * validate-website-policy.ts
 *
 * Comprehensive validation suite for Target #53: Website Access Policy Engine,
 * Domain Wildcard Matching & URL Access Governance (Phase 120 / ADR-096).
 */

import assert from "node:assert";
import {
  DeterministicWebsitePolicy,
  WebsitePolicySupervisor,
  BroccoliWebsitePolicySubstrate,
  WebsitePolicySnapshotManager,
  WebsitePolicyToolSuite,
} from "../src/index.js";

async function runSuite() {
  console.log("================================================================");
  console.log("   LUMI Website Access Policy & Domain Blocklist (ADR-096)      ");
  console.log("================================================================");

  const policyEngine = new DeterministicWebsitePolicy();
  const substrate = new BroccoliWebsitePolicySubstrate();
  const snapshotManager = new WebsitePolicySnapshotManager(substrate);
  const supervisor = new WebsitePolicySupervisor(substrate, policyEngine);
  const toolSuite = new WebsitePolicyToolSuite(supervisor);

  // --------------------------------------------------------------------------
  // [Test 1/8] Exact Domain Blocking & Subdomain Inheritance
  // --------------------------------------------------------------------------
  console.log("\n[Test 1/8] Validating Exact Domain & Subdomain Inheritance...");

  supervisor.addRule("blocked-network.com", "config");

  const apexRes = supervisor.checkAccess("blocked-network.com");
  assert.strictEqual(apexRes.allowed, false);
  assert.strictEqual(apexRes.host, "blocked-network.com");

  const subRes = supervisor.checkAccess("api.blocked-network.com");
  assert.strictEqual(subRes.allowed, false);

  const deepSubRes = supervisor.checkAccess("stage.auth.blocked-network.com");
  assert.strictEqual(deepSubRes.allowed, false);

  const allowedRes = supervisor.checkAccess("safe-network.com");
  assert.strictEqual(allowedRes.allowed, true);

  console.log("  [✓] Apex domain and subdomains blocked; safe domains allowed.");

  // --------------------------------------------------------------------------
  // [Test 2/8] Wildcard Pattern Matching (*.ads.*, *tracker*)
  // --------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Wildcard Pattern Matching (*.ads.*, *tracker*)...");

  supervisor.addRule("*.ads.*", "config");
  supervisor.addRule("*tracker*", "config");

  const adsRes1 = supervisor.checkAccess("cdn.ads.net");
  assert.strictEqual(adsRes1.allowed, false);

  const adsRes2 = supervisor.checkAccess("banner.ads.io");
  assert.strictEqual(adsRes2.allowed, false);

  const trackerRes1 = supervisor.checkAccess("mytracker.com");
  assert.strictEqual(trackerRes1.allowed, false);

  const trackerRes2 = supervisor.checkAccess("user-telemetry-tracker.org");
  assert.strictEqual(trackerRes2.allowed, false);

  const innocentRes = supervisor.checkAccess("wikipedia.org");
  assert.strictEqual(innocentRes.allowed, true);

  console.log("  [✓] Glob wildcard patterns (*.ads.*, *tracker*) matched accurately.");

  // --------------------------------------------------------------------------
  // [Test 3/8] URL Normalization, Scheme Stripping & www. Prefix
  // --------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating URL Normalization & www. Prefix Handling...");

  supervisor.addRule("malicious-portal.org", "config");

  const urlWithScheme = supervisor.checkAccess("https://www.malicious-portal.org/login?ref=123");
  assert.strictEqual(urlWithScheme.allowed, false);
  assert.strictEqual(urlWithScheme.host, "malicious-portal.org");

  const urlWithPort = supervisor.checkAccess("http://malicious-portal.org:8443/api/v1");
  assert.strictEqual(urlWithPort.allowed, false);

  const schemelessUrl = supervisor.checkAccess("//www.malicious-portal.org/test");
  assert.strictEqual(schemelessUrl.allowed, false);

  console.log("  [✓] URLs with protocols, www prefixes, ports, and paths normalized correctly.");

  // --------------------------------------------------------------------------
  // [Test 4/8] Shared Blocklist File Parsing with Comments (#) & Deduplication
  // --------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Shared Blocklist File Parsing & Comments...");

  const mockFileContent = `
# Phishing Blocklist - Updated 2026
phishing-site-1.com
# Some commentary
https://www.phishing-site-2.net/bad/path
*.suspicious-network.*

# Duplicate entry
phishing-site-1.com
`;

  const loadedCount = supervisor.loadSharedBlocklist(mockFileContent, "/etc/blocklists/phishing.txt");
  assert.strictEqual(loadedCount, 3); // 3 unique rules

  const p1 = supervisor.checkAccess("phishing-site-1.com");
  assert.strictEqual(p1.allowed, false);
  assert.strictEqual(p1.matchedRule?.source, "shared_file");
  assert.strictEqual(p1.matchedRule?.sourcePath, "/etc/blocklists/phishing.txt");

  const p2 = supervisor.checkAccess("api.phishing-site-2.net");
  assert.strictEqual(p2.allowed, false);

  console.log("  [✓] Shared blocklist file parsed cleanly with comment and duplicate handling.");

  // --------------------------------------------------------------------------
  // [Test 5/8] Dynamic Runtime Rule Addition & Removal & Master Toggle
  // --------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Dynamic Rule Mutations & Policy Toggle...");

  supervisor.addRule("temporary-quarantine.io", "runtime");
  assert.strictEqual(supervisor.checkAccess("temporary-quarantine.io").allowed, false);

  supervisor.removeRule("temporary-quarantine.io");
  assert.strictEqual(supervisor.checkAccess("temporary-quarantine.io").allowed, true);

  // Master policy toggle
  supervisor.setEnabled(false);
  assert.strictEqual(supervisor.checkAccess("blocked-network.com").allowed, true);

  supervisor.setEnabled(true);
  assert.strictEqual(supervisor.checkAccess("blocked-network.com").allowed, false);

  console.log("  [✓] Dynamic addition, removal, and enable/disable toggle verified.");

  // --------------------------------------------------------------------------
  // [Test 6/8] In-Memory Substrate Logging, Audit Ledgers & Metrics
  // --------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating In-Memory Substrate Logging & Metrics...");

  const metrics = supervisor.getMetrics();
  assert.ok(metrics.totalChecks >= 15);
  assert.ok(metrics.blockedCount >= 10);
  assert.ok(metrics.allowedCount >= 3);
  assert.ok(metrics.activeRulesCount >= 5);

  const history = supervisor.getHistory();
  assert.ok(history.length >= 10);
  assert.ok(history.every((h) => !h.allowed));

  console.log(`  [✓] Substrate recorded ${metrics.totalChecks} checks (${metrics.blockedCount} blocked in audit ledger).`);

  // --------------------------------------------------------------------------
  // [Test 7/8] Binary Snapshotting & O(1) State Rollback
  // --------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Binary Snapshotting & O(1) State Rollback...");

  const initialRulesCount = supervisor.getRules().length;
  snapshotManager.takeSnapshot("checkpoint-policy-1");

  supervisor.addRule("extra-domain-1.com", "runtime");
  supervisor.addRule("extra-domain-2.com", "runtime");
  assert.strictEqual(supervisor.getRules().length, initialRulesCount + 2);

  // JIT Warmup
  for (let i = 0; i < 50; i++) {
    snapshotManager.restoreSnapshot("checkpoint-policy-1");
  }

  supervisor.addRule("extra-domain-1.com", "runtime");
  const tRollbackStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("checkpoint-policy-1");
  const rollbackDurationMs = performance.now() - tRollbackStart;

  assert.strictEqual(restored, true);
  assert.strictEqual(supervisor.getRules().length, initialRulesCount);
  assert.ok(
    rollbackDurationMs < 0.05,
    `Rollback completed in ${rollbackDurationMs.toFixed(4)} ms (< 0.05 ms SLA)`
  );

  console.log(`  [✓] Substrate state rollback verified (${rollbackDurationMs.toFixed(4)} ms).`);

  // --------------------------------------------------------------------------
  // [Test 8/8] Model Tool Suite (5 Tools) & Ultra-High-Throughput Benchmark
  // --------------------------------------------------------------------------
  console.log("\n[Test 8/8] Validating Model Tool Suite & Micro-Benchmarks...");

  // Tool 1: website_policy_check_url
  const t1 = await toolSuite.getTools().find((t) => t.name === "website_policy_check_url")?.execute({
    url: "https://wikipedia.org",
  }, "");
  assert.strictEqual((t1 as any)?.success, true);
  assert.strictEqual((t1 as any)?.allowed, true);

  // Tool 2: website_policy_add_rule
  const t2 = await toolSuite.getTools().find((t) => t.name === "website_policy_add_rule")?.execute({
    pattern: "dynamic-tool-block.com",
  }, "");
  assert.strictEqual((t2 as any)?.success, true);

  // Tool 3: website_policy_remove_rule
  const t3 = await toolSuite.getTools().find((t) => t.name === "website_policy_remove_rule")?.execute({
    pattern: "dynamic-tool-block.com",
  }, "");
  assert.strictEqual((t3 as any)?.success, true);

  // Tool 4: website_policy_inspect_rules
  const t4 = await toolSuite.getTools().find((t) => t.name === "website_policy_inspect_rules")?.execute({}, "");
  assert.strictEqual((t4 as any)?.success, true);
  assert.ok((t4 as any)?.rulesCount >= 1);

  // Tool 5: website_policy_get_metrics
  const t5 = await toolSuite.getTools().find((t) => t.name === "website_policy_get_metrics")?.execute({}, "");
  assert.strictEqual((t5 as any)?.success, true);
  assert.ok((t5 as any)?.metrics?.totalChecks >= 1);

  // Ultra-High-Throughput Micro-Benchmark: 50,000 website policy checks
  const iterations = 50000;
  const sampleDomains = [
    "https://api.github.com/repos",
    "http://cdn.ads.net/banner.js",
    "https://sub.blocked-network.com/auth",
    "https://wikipedia.org/wiki/Main_Page",
    "http://phishing-site-1.com/secure",
  ];

  // Warmup JIT
  for (let w = 0; w < 5000; w++) {
    supervisor.checkAccess(sampleDomains[w % sampleDomains.length]);
  }

  const tBenchStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    const d = sampleDomains[i % sampleDomains.length];
    supervisor.checkAccess(d);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} policy checks in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/check | ${throughputOpsPerSec.toLocaleString()} checks/sec)`);
  assert.ok(throughputOpsPerSec > 200000, "Throughput must exceed 200,000 checks/sec");

  console.log("  [✓] All 5 model tools executed cleanly & ultra-high-throughput benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 WEBSITE POLICY VALIDATION SUITES PASSED CLEANLY!       ");
  console.log("================================================================");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
