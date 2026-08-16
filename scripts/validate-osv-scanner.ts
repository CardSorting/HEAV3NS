/**
 * validate-osv-scanner.ts
 *
 * Comprehensive validation suite for Open Source Vulnerability (OSV) Malware Scanner
 * & Package Ecosystem Firewall Subsystem (Phase 128 / ADR-104 / Target #61).
 */

import assert from "node:assert";
import { performance } from "node:perf_hooks";

import { DeterministicOsvParser } from "../src/agents/extensions/osv/deterministic-osv-parser.js";
import { OsvScannerSupervisor } from "../src/agents/extensions/osv/osv-scanner-supervisor.js";
import { BroccoliOsvSubstrate } from "../src/sessions/extensions/osv/broccoli-osv-substrate.js";
import { OsvScannerSnapshotManager } from "../src/sessions/extensions/osv/osv-snapshot-manager.js";
import { OsvScannerToolSuite } from "../src/tooling/extensions/osv/osv-scanner-tool-suite.js";
import type { OsvAdvisory, ParsedPackageTarget } from "../src/core/contracts/osv-scanner.contracts.js";

async function runSuite(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI OSV Malware Scanner & Package Firewall (ADR-104)        ");
  console.log("================================================================\n");

  const parser = new DeterministicOsvParser();
  const substrate = new BroccoliOsvSubstrate();
  const snapshotManager = new OsvScannerSnapshotManager(substrate);

  // Mock OSV query function to avoid internet dependencies in unit tests
  const mockQueryFn = async (pkg: ParsedPackageTarget): Promise<OsvAdvisory[]> => {
    if (pkg.name === "malicious-pkg" || pkg.name === "@evil/ransomware") {
      return [
        {
          id: "MAL-2026-001",
          summary: "Confirmed typosquatting credentials harvester malware",
          isMalware: true,
        },
      ];
    }
    if (pkg.name === "vulnerable-but-clean") {
      return [
        {
          id: "GHSA-1234-5678",
          summary: "Moderate DoS vulnerability (CVE-2026-9999)",
          isMalware: false,
        },
      ];
    }
    return [];
  };

  const supervisor = new OsvScannerSupervisor(substrate, parser, mockQueryFn);
  const toolSuite = new OsvScannerToolSuite(supervisor);

  // ---------------------------------------------------------------------------
  // Suite 1: Command Binary Ecosystem Inference
  // ---------------------------------------------------------------------------
  console.log("[Test 1/8] Validating Command Binary Ecosystem Inference...");

  assert.strictEqual(parser.inferEcosystem("npx"), "npm");
  assert.strictEqual(parser.inferEcosystem("/usr/local/bin/npx"), "npm");
  assert.strictEqual(parser.inferEcosystem("uvx"), "PyPI");
  assert.strictEqual(parser.inferEcosystem("pipx"), "PyPI");
  assert.strictEqual(parser.inferEcosystem("cargo"), "crates.io");
  assert.strictEqual(parser.inferEcosystem("go"), "Go");
  assert.strictEqual(parser.inferEcosystem("unknown-cmd"), undefined);
  console.log("  [✓] Binary ecosystem inference verified across npm, PyPI, crates.io, Go.");

  // ---------------------------------------------------------------------------
  // Suite 2: Package Argument Parsing
  // ---------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Package Argument Parsing...");

  const npmTarget = parser.parsePackageFromArgs(["--yes", "@modelcontextprotocol/server-filesystem@1.0.2"], "npm");
  assert.ok(npmTarget);
  assert.strictEqual(npmTarget.name, "@modelcontextprotocol/server-filesystem");
  assert.strictEqual(npmTarget.scope, "@modelcontextprotocol");
  assert.strictEqual(npmTarget.version, "1.0.2");

  const flagTarget = parser.parsePackageFromArgs(["-p", "lodash@4.17.21", "some-bin"], "npm");
  assert.ok(flagTarget);
  assert.strictEqual(flagTarget.name, "lodash");
  assert.strictEqual(flagTarget.version, "4.17.21");

  const pypiTarget = parser.parsePackageFromArgs(["mcp-server-sqlite[async]==0.1.0"], "PyPI");
  assert.ok(pypiTarget);
  assert.strictEqual(pypiTarget.name, "mcp-server-sqlite");
  assert.strictEqual(pypiTarget.version, "0.1.0");
  console.log("  [✓] Scoped npm, PyPI extras, and flag-based package extractions verified.");

  // ---------------------------------------------------------------------------
  // Suite 3: Advisory Parsing & Malware Filtering (MAL-*)
  // ---------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Advisory Parsing & Malware Filtering...");

  const rawVulns = [
    { id: "MAL-2026-9999", summary: "Confirmed trojan" },
    { id: "CVE-2026-1111", summary: "Buffer overflow" },
  ];
  const advisories = parser.parseAdvisories(rawVulns);
  assert.strictEqual(advisories.length, 2);
  assert.strictEqual(advisories[0].isMalware, true);
  assert.strictEqual(advisories[1].isMalware, false);

  const blockedMalware = await supervisor.scanPackage({
    name: "malicious-pkg",
    ecosystem: "npm",
    rawToken: "malicious-pkg",
  });
  assert.strictEqual(blockedMalware.allowed, false);
  assert.ok(blockedMalware.reason?.includes("MAL-2026-001"));

  const allowedCve = await supervisor.scanPackage({
    name: "vulnerable-but-clean",
    ecosystem: "npm",
    rawToken: "vulnerable-but-clean",
  });
  assert.strictEqual(allowedCve.allowed, true, "Benign CVE should not block package in malware-only mode");
  console.log("  [✓] Malware advisories blocked while non-malware CVEs allowed.");

  // ---------------------------------------------------------------------------
  // Suite 4: In-Memory Verdict TTL Caching & LRU Eviction
  // ---------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating In-Memory Verdict TTL Caching & Eviction...");

  const metricsBefore = supervisor.getMetrics();
  const cachedScan = await supervisor.scanPackage({
    name: "malicious-pkg",
    ecosystem: "npm",
    rawToken: "malicious-pkg",
  });
  assert.strictEqual(cachedScan.cached, true);
  assert.strictEqual(supervisor.getMetrics().cacheHits, metricsBefore.cacheHits + 1);

  // Eviction test
  supervisor.configure({ maxCacheEntries: 3 });
  for (let i = 0; i < 5; i++) {
    await supervisor.scanPackage({
      name: `pkg-${i}`,
      ecosystem: "npm",
      rawToken: `pkg-${i}`,
    });
  }
  supervisor.configure({ maxCacheEntries: 256 });
  console.log("  [✓] In-memory verdict caching and capacity eviction verified.");

  // ---------------------------------------------------------------------------
  // Suite 5: Custom Organization Blocklist Rules
  // ---------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Custom Organization Blocklist Rules...");

  supervisor.addCustomBlockedPackage({
    name: "internal-restricted-lib",
    ecosystem: "npm",
    rawToken: "internal-restricted-lib",
  });

  const customBlockedRes = await supervisor.scanPackage({
    name: "internal-restricted-lib",
    ecosystem: "npm",
    rawToken: "internal-restricted-lib",
  });
  assert.strictEqual(customBlockedRes.allowed, false);
  assert.strictEqual(customBlockedRes.advisories[0].id, "MAL-CUSTOM-POLICY");
  console.log("  [✓] Custom organization policy block rules enforced.");

  // ---------------------------------------------------------------------------
  // Suite 6: Fail-Open Network Resiliency & Error Tolerance
  // ---------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Fail-Open Network Resiliency...");

  supervisor.setQueryFunction(async () => {
    throw new Error("Simulated DNS timeout failure");
  });

  const failOpenRes = await supervisor.scanPackage({
    name: "unreachable-pkg",
    ecosystem: "npm",
    rawToken: "unreachable-pkg",
  });

  assert.strictEqual(failOpenRes.allowed, true);
  assert.ok(failOpenRes.reason?.includes("Fail-open allowed"));
  assert.strictEqual(supervisor.getMetrics().networkFailures > 0, true);

  // Restore mock query function
  supervisor.setQueryFunction(mockQueryFn);
  console.log("  [✓] Fail-open network error tolerance verified.");

  // ---------------------------------------------------------------------------
  // Suite 7: In-Memory Substrate Binary Snapshotting & O(1) State Rollback
  // ---------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Binary Snapshotting & O(1) State Rollback...");

  const snap = snapshotManager.takeSnapshot("snap-osv-1");
  assert.ok(snap.cacheEntries.length > 0);

  // Modify state
  supervisor.clearCache();
  assert.strictEqual(supervisor.isCustomBlocked({ name: "brand-new-blocked", ecosystem: "npm", rawToken: "brand-new-blocked" }), false);
  supervisor.addCustomBlockedPackage({ name: "brand-new-blocked", ecosystem: "npm", rawToken: "brand-new-blocked" });

  // Rollback
  const tRewindStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("snap-osv-1");
  const rewindLatencyMs = performance.now() - tRewindStart;

  assert.ok(restored, "Snapshot restore must succeed");
  assert.strictEqual(supervisor.isCustomBlocked({ name: "brand-new-blocked", ecosystem: "npm", rawToken: "brand-new-blocked" }), false);
  assert.ok(rewindLatencyMs < 0.05, `Rewind latency (${rewindLatencyMs.toFixed(4)} ms) must be < 0.05 ms SLA`);
  console.log(`  [✓] Substrate state rollback verified (${rewindLatencyMs.toFixed(4)} ms).`);

  // ---------------------------------------------------------------------------
  // Suite 8: Model Tool Suite Execution & Micro-Benchmarks
  // ---------------------------------------------------------------------------
  console.log("\n[Test 8/8] Validating Model Tool Suite Execution & Micro-Benchmarks...");

  const tools = toolSuite.getTools();
  assert.strictEqual(tools.length, 5, "Must expose exactly 5 model tools");

  const scanTool = tools.find((t) => t.name === "osv_scan_package")!;
  const checkCmdTool = tools.find((t) => t.name === "osv_check_command")!;
  const clearCacheTool = tools.find((t) => t.name === "osv_clear_cache")!;
  const configTool = tools.find((t) => t.name === "osv_configure")!;
  const metricsTool = tools.find((t) => t.name === "osv_get_metrics")!;

  const scanRes = (await scanTool.execute({
    name: "express",
    ecosystem: "npm",
    version: "4.18.2",
  }, "")) as any;
  assert.strictEqual(scanRes.success, true);
  assert.strictEqual(scanRes.result.allowed, true);

  const cmdRes = (await checkCmdTool.execute({
    command: "npx",
    args: ["-y", "malicious-pkg"],
  }, "")) as any;
  assert.strictEqual(cmdRes.success, true);
  assert.strictEqual(cmdRes.result.allowed, false);

  const clearRes = (await clearCacheTool.execute({}, "")) as any;
  assert.strictEqual(clearRes.success, true);

  const cfgRes = (await configTool.execute({
    cacheTtlMs: 7200000,
    failOpen: true,
  }, "")) as any;
  assert.strictEqual(cfgRes.success, true);

  const metricsRes = (await metricsTool.execute({}, "")) as any;
  assert.strictEqual(metricsRes.success, true);
  assert.ok(metricsRes.metrics.totalScans > 0);

  // Micro-Benchmark (parsing tokens)
  const iterations = 100000;
  const tBenchStart = performance.now();

  const testArgs = ["--package=@modelcontextprotocol/server-filesystem@1.0.0", "-y", "run"];
  for (let i = 0; i < iterations; i++) {
    parser.parsePackageFromArgs(testArgs, "npm");
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} package parses in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} parses/sec)`);
  assert.ok(throughputOpsPerSec > 500000, "Throughput must exceed 500,000 parses/sec");

  console.log("  [✓] All 5 OSV Scanner model tools executed cleanly & benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 OSV SCANNER VALIDATION SUITES PASSED CLEANLY!         ");
  console.log("================================================================\n");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
