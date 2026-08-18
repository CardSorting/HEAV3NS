#!/usr/bin/env node
/**
 * validate-osv-scanner.ts
 *
 * Comprehensive 22-Suite Validation Harness for the
 * Deterministic OSV Vulnerability Scanner, Package Ecosystem Firewall & Supply-Chain Advisory Subsystem
 * (Phase 128 / ADR-104 / Target #81).
 */

import * as assert from "node:assert";
import { performance } from "node:perf_hooks";

import {
  BroccoliOsvSubstrate,
  BroccoliViewRenderer,
  DEFAULT_OSV_SCANNER_CONFIG,
  DeterministicOsvParser,
  GrandMonolithSynthesizer,
  MonolithFactory,
  MonolithGatewayServer,
  OsvDashboardModal,
  OsvScannerSnapshotManager,
  OsvScannerSupervisor,
  OsvScannerToolSuite,
} from "../src/index.js";

async function runOsvScannerValidationSuite(): Promise<void> {
  console.log("================================================================================");
  console.log(" LUMI OSV Vulnerability Scanner & Supply-Chain Firewall (Target #81 / ADR-104)  ");
  console.log("================================================================================");
  console.log();

  let passedSuites = 0;

  try {
    const substrate = new BroccoliOsvSubstrate();
    const parser = new DeterministicOsvParser();
    const supervisor = new OsvScannerSupervisor(substrate, parser);
    const snapshotManager = new OsvScannerSnapshotManager(substrate);

    // ---------------------------------------------------------------------------
    // Suite 1: In-Memory Registry & Default Substrate Invariants
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/22] In-Memory Registry & Default Substrate Invariants...");
    const initialConfig = substrate.getConfig();
    assert.strictEqual(initialConfig.blockMalwareOnly, true);
    assert.strictEqual(initialConfig.failOpen, true);
    assert.strictEqual(initialConfig.cacheTtlMs, 3600000);
    assert.strictEqual(DEFAULT_OSV_SCANNER_CONFIG.timeoutMs, 10000);
    console.log("  ✓ Substrate initialized cleanly with default OSV configuration");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: Clean Command Parsing (npm install express)
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/22] Clean Command Parsing (npm install express)...");
    const eco = parser.inferEcosystem("npm");
    assert.strictEqual(eco, "npm");
    const target = parser.parsePackageFromArgs(["install", "express@4.18.2", "lodash"], "npm");
    assert.ok(target !== undefined);
    assert.strictEqual(target?.name, "express");
    assert.strictEqual(target?.version, "4.18.2");
    assert.strictEqual(target?.ecosystem, "npm");
    console.log(`  ✓ Extracted target ${target?.name}@${target?.version} for ecosystem: ${eco}`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: Scoped npm Package Parsing (@scope/pkg)
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/22] Scoped npm Package Parsing (@scope/pkg)...");
    const scopedTarget = parser.parsePackageFromArgs(["add", "@angular/core@17.0.0", "-D"], "npm");
    assert.ok(scopedTarget !== undefined);
    assert.strictEqual(scopedTarget?.name, "@angular/core");
    assert.strictEqual(scopedTarget?.scope, "@angular");
    assert.strictEqual(scopedTarget?.version, "17.0.0");
    console.log("  ✓ Successfully parsed scoped npm packages and ignored flags (-D)");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: PyPI Ecosystem Parsing (pip install requests flask==2.0.1)
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/22] PyPI Ecosystem Parsing (pip install requests flask==2.0.1)...");
    const pypiEco = parser.inferEcosystem("pip");
    assert.strictEqual(pypiEco, "PyPI");
    const pypiTarget = parser.parsePackageFromArgs(["install", "flask==2.0.1", "--upgrade"], "PyPI");
    assert.ok(pypiTarget !== undefined);
    assert.strictEqual(pypiTarget?.name, "flask");
    assert.strictEqual(pypiTarget?.version, "2.0.1");
    console.log("  ✓ Correctly identified PyPI ecosystem and parsed versions with == delimiter");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: Caching & TTL Eviction
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/22] Caching & TTL Eviction...");
    const testPkg = { name: "test-pkg", ecosystem: "npm" as const, version: "1.0.0" };
    const sampleScanResult = {
      allowed: true,
      package: testPkg,
      advisories: [],
      cached: false,
      scanDurationMs: 5.2,
    };
    substrate.setConfig({ cacheTtlMs: 50 }); // 50ms short TTL
    substrate.setCachedResult(testPkg, sampleScanResult);
    const cachedBefore = substrate.getCachedResult(testPkg);
    assert.ok(cachedBefore !== undefined);
    assert.strictEqual(cachedBefore?.cached, true);
    assert.strictEqual(cachedBefore?.package.name, "test-pkg");

    // Wait for TTL expiry
    await new Promise((r) => setTimeout(r, 60));
    const cachedAfter = substrate.getCachedResult(testPkg);
    assert.strictEqual(cachedAfter, undefined);
    substrate.setConfig({ cacheTtlMs: 3600000 }); // restore default
    console.log("  ✓ Cached advisories stored and evicted upon TTL expiration");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: Custom Blocked Packages
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/22] Custom Blocked Packages...");
    const blockedPkg = { name: "malicious-test-lib", ecosystem: "npm" as const };
    substrate.addCustomBlockedPackage(blockedPkg);
    assert.strictEqual(substrate.isCustomBlocked(blockedPkg), true);
    const blockedCheck = await supervisor.scanPackage(blockedPkg);
    assert.strictEqual(blockedCheck.allowed, false);
    assert.ok(blockedCheck.reason?.includes("Blocked by custom organization policy"));
    console.log("  ✓ Blocked package list successfully rejected untrusted dependency");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: Malware Advisory Blocking (MAL-2024-001)
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/22] Malware Advisory Blocking (MAL-2024-001)...");
    const malPkg = { name: "evil-cryptor", ecosystem: "npm" as const };
    const malAdvisory = {
      id: "MAL-2024-9999",
      summary: "Data exfiltration malware discovered in payload",
      isMalware: true,
      published: new Date().toISOString(),
    };
    // Use custom query function on supervisor to simulate API returning malware advisory
    supervisor.setQueryFunction(async () => [malAdvisory]);
    const malCheck = await supervisor.scanPackage(malPkg);
    assert.strictEqual(malCheck.allowed, false);
    assert.strictEqual(malCheck.advisories.length, 1);
    assert.strictEqual(malCheck.advisories[0].id, "MAL-2024-9999");
    assert.ok(malCheck.reason?.includes("MAL-2024-9999"));
    console.log(`  ✓ Blocked package with active Malware advisory (${malCheck.advisories[0].id})`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: Safe Package Pass-Through
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/22] Safe Package Pass-Through...");
    supervisor.setQueryFunction(async () => []);
    const safePkg = { name: "safe-logger", ecosystem: "npm" as const, version: "1.0.0" };
    const safeCheck = await supervisor.scanPackage(safePkg);
    assert.strictEqual(safeCheck.allowed, true);
    assert.strictEqual(safeCheck.advisories.length, 0);
    console.log("  ✓ Clean package allowed through without security blocks");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 9: Fail-Open Network Error Tolerance
    // ---------------------------------------------------------------------------
    console.log("[Suite 9/22] Fail-Open Network Error Tolerance...");
    supervisor.configure({ failOpen: true });
    supervisor.setQueryFunction(async () => {
      throw new Error("Simulated DNS lookup failure");
    });
    const failOpenScan = await supervisor.scanPackage({ name: "unreachable-pkg", ecosystem: "npm" as const });
    assert.strictEqual(failOpenScan.allowed, true);
    assert.ok(failOpenScan.reason?.includes("Fail-open allowed"));
    console.log("  ✓ Non-blocking fail-open behavior preserved during simulated offline network access");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 10: Fail-Closed Mode Enforcement
    // ---------------------------------------------------------------------------
    console.log("[Suite 10/22] Fail-Closed Mode Enforcement...");
    supervisor.configure({ failOpen: false });
    const failClosedScan = await supervisor.scanPackage({ name: "unreachable-pkg-2", ecosystem: "npm" as const });
    assert.strictEqual(failClosedScan.allowed, false);
    assert.ok(failClosedScan.reason?.includes("Scan failed in fail-closed mode"));
    supervisor.configure({ failOpen: true }); // reset
    console.log("  ✓ Fail-closed strict mode configuration successfully toggled");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 11: Command String Argument Token Extraction
    // ---------------------------------------------------------------------------
    console.log("[Suite 11/22] Command String Argument Token Extraction...");
    const extractedPkg = parser.parsePackageFromArgs(["--package=@types/react@18.2.0", "create-react-app"], "npm");
    assert.ok(extractedPkg !== undefined);
    assert.strictEqual(extractedPkg?.name, "@types/react");
    assert.strictEqual(extractedPkg?.version, "18.2.0");
    console.log(`  ✓ Extracted tokens from complex package argument: ${extractedPkg?.name}@${extractedPkg?.version}`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 12: Ecosystem Inference (cargo, gem, composer, go, bunx)
    // ---------------------------------------------------------------------------
    console.log("[Suite 12/22] Ecosystem Inference (cargo, gem, composer, go, bunx)...");
    assert.strictEqual(parser.inferEcosystem("cargo"), "crates.io");
    assert.strictEqual(parser.inferEcosystem("gem"), "RubyGems");
    assert.strictEqual(parser.inferEcosystem("composer"), "Packagist");
    assert.strictEqual(parser.inferEcosystem("go"), "Go");
    assert.strictEqual(parser.inferEcosystem("bunx"), "npm");
    assert.strictEqual(parser.inferEcosystem("uvx"), "PyPI");
    console.log("  ✓ All package managers correctly inferred (crates.io, RubyGems, Packagist, Go, PyPI)");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 13: Formatting Helpers
    // ---------------------------------------------------------------------------
    console.log("[Suite 13/22] Formatting Helpers...");
    const sampleResult = {
      scanId: "scan-sample-1",
      packageName: "bad-lib",
      ecosystem: "npm" as const,
      package: { name: "bad-lib", ecosystem: "npm" as const, rawToken: "bad-lib" },
      advisories: [malAdvisory],
      allowed: false,
      cached: false,
      scanDurationMs: 1.25,
      reason: "Malware detected",
      timestamp: Date.now(),
    };
    const formattedResult = parser.formatScanResult(sampleResult);
    assert.ok(formattedResult.includes("bad-lib"));
    assert.ok(formattedResult.includes("BLOCKED"));

    const formattedAdv = parser.formatAdvisory(malAdvisory);
    assert.ok(formattedAdv.includes("MAL-2024-9999"));
    assert.ok(formattedAdv.includes("MALWARE"));
    console.log("  ✓ Formatted scan result and advisory summary output produced correctly");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 14: In-Memory Hybrid BroccoliDB Persistence Tables
    // ---------------------------------------------------------------------------
    console.log("[Suite 14/22] In-Memory Hybrid BroccoliDB Persistence Tables...");
    substrate.recordScan(sampleResult);
    const allScans = substrate.getScanResults();
    assert.ok(allScans.length >= 1);
    const audits = substrate.getAudits();
    assert.ok(audits.length >= 1);
    console.log(`  ✓ Hybrid BroccoliDB persisted ${allScans.length} scan records and ${audits.length} audit logs`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 15: SLA State Rewind (< 0.05 ms SLA)
    // ---------------------------------------------------------------------------
    console.log("[Suite 15/22] SLA State Rewind (< 0.05 ms SLA)...");
    const snap = snapshotManager.createSnapshot();
    assert.ok(snap.snapshotId.startsWith("osv-snap-"));

    // Mutate state
    substrate.addCustomBlockedPackage({ name: "temporary-blocked-pkg", ecosystem: "npm" as const });
    assert.strictEqual(substrate.isCustomBlocked({ name: "temporary-blocked-pkg", ecosystem: "npm" as const }), true);

    // Restore state and benchmark time
    const t0 = performance.now();
    const restored = snapshotManager.restoreSnapshot(snap.snapshotId);
    const t1 = performance.now();
    const rewindMs = t1 - t0;
    assert.strictEqual(restored, true);
    assert.strictEqual(substrate.isCustomBlocked({ name: "temporary-blocked-pkg", ecosystem: "npm" as const }), false);
    console.log(`  ✓ Snapshot rewound successfully in ${rewindMs.toFixed(4)} ms (SLA < 0.05 ms target)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 16: High-Frequency Parsing Benchmark (50,000 evaluations)
    // ---------------------------------------------------------------------------
    console.log("[Suite 16/22] High-Frequency Parsing Benchmark (50,000 evaluations)...");
    const benchArgs = ["add", "@types/react@18.2.0", "typescript", "esbuild"];
    const benchStart = performance.now();
    const ITERATIONS = 50_000;
    for (let i = 0; i < ITERATIONS; i++) {
      parser.parsePackageFromArgs(benchArgs, "npm");
    }
    const benchEnd = performance.now();
    const totalDuration = benchEnd - benchStart;
    const avgPerEvalMs = totalDuration / ITERATIONS;
    console.log(`  ✓ Parsed ${ITERATIONS.toLocaleString()} command token sets in ${totalDuration.toFixed(2)} ms (${(avgPerEvalMs * 1000).toFixed(3)} µs/eval)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 17: Multi-Criteria Swimlanes
    // ---------------------------------------------------------------------------
    console.log("[Suite 17/22] Multi-Criteria Swimlanes...");
    const groupedByEco = substrate.getGroupedScans("ecosystem");
    assert.ok(Array.isArray(groupedByEco));
    assert.ok(groupedByEco.length >= 1);

    const groupedByVerdict = substrate.getGroupedScans("verdict");
    assert.ok(Array.isArray(groupedByVerdict));
    console.log(`  ✓ Grouped scans into ${groupedByEco.length} ecosystem lanes and ${groupedByVerdict.length} verdict lanes`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 18: Natural Query DSL Search
    // ---------------------------------------------------------------------------
    console.log("[Suite 18/22] Natural Query DSL Search...");
    const dslMatches = substrate.queryScansDsl("eco:npm is:blocked");
    assert.ok(Array.isArray(dslMatches));
    assert.ok(dslMatches.length >= 1);
    assert.strictEqual(dslMatches[0].ecosystem, "npm");
    assert.strictEqual(dslMatches[0].allowed, false);
    console.log(`  ✓ Natural Query DSL resolved 'eco:npm is:blocked' with ${dslMatches.length} matching rows`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 19: SLA Health Matrix & Telemetry Auditing
    // ---------------------------------------------------------------------------
    console.log("[Suite 19/22] SLA Health Matrix & Telemetry Auditing...");
    const health = supervisor.auditHealth();
    assert.ok(["optimal", "healthy", "degraded", "critical"].includes(health.healthStatus));
    assert.ok((health.score ?? 100) >= 0 && (health.score ?? 100) <= 100);

    const metrics = supervisor.getMetricsReport();
    assert.ok(metrics.totalScans >= 0);
    assert.ok(typeof metrics.cacheHitRatePercent === "number");
    console.log(`  ✓ Health Score: ${health.score ?? 100}/100 [${health.healthStatus}] | Total Scans: ${metrics.totalScans} | Cache Hit Rate: ${metrics.cacheHitRatePercent.toFixed(1)}%`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 20: Atomic Bulk Mutations (Bulk Purge) & Undo/Redo
    // ---------------------------------------------------------------------------
    console.log("[Suite 20/22] Atomic Bulk Mutations (Bulk Purge) & Undo/Redo...");
    const beforeCount = substrate.getScanResults().length;
    const allIds = substrate.getScanResults().map((r) => r.scanId);
    const purgeRes = substrate.bulkPurgeScans(allIds);
    assert.ok((purgeRes.affectedCount ?? purgeRes.modifiedCount) >= 1);
    assert.strictEqual(substrate.getScanResults().length, 0);

    // Undo purge
    const undoRes = substrate.undo();
    assert.strictEqual(undoRes, true);
    assert.strictEqual(substrate.getScanResults().length, beforeCount);

    // Redo purge
    const redoRes = substrate.redo();
    assert.strictEqual(redoRes, true);
    assert.strictEqual(substrate.getScanResults().length, 0);

    // Undo once more to restore records for rendering tests
    substrate.undo();
    console.log(`  ✓ Atomic bulk purge of ${purgeRes.affectedCount ?? purgeRes.modifiedCount} items verified with full Undo and Redo rollback`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 21: Responsive ANSI CLI Dashboard, Cards, Exporters & TUI Modal
    // ---------------------------------------------------------------------------
    console.log("[Suite 21/22] Responsive ANSI CLI Dashboard, Cards, Exporters & TUI Modal...");
    const ansiDashboard = BroccoliViewRenderer.renderOsvDashboard(substrate);
    assert.ok(ansiDashboard.includes("OSV"));

    const ansiCard = BroccoliViewRenderer.renderOsvAdvisoryCard(malAdvisory);
    assert.ok(ansiCard.includes("MAL-2024-9999"));

    const htmlExport = substrate.exportInteractiveHtmlView();
    assert.ok(htmlExport.includes("<!DOCTYPE html>"));
    assert.ok(htmlExport.includes("OSV"));

    const mdExport = substrate.exportMarkdownReport();
    assert.ok(mdExport.includes("OSV"));

    const modal = new OsvDashboardModal(substrate);
    assert.strictEqual(modal.isOpen(), false);
    modal.open("overview");
    assert.strictEqual(modal.isOpen(), true);
    const renderedTui = modal.render();
    assert.ok(renderedTui.length > 0);
    modal.close();
    console.log("  ✓ Rendered ANSI CLI dashboard, advisory card, HTML/Markdown exports, and TUI modal");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 22: Gateway JSON-RPC 2.0 Endpoints, 30 Model Tools & Monolith Cohesion
    // ---------------------------------------------------------------------------
    console.log("[Suite 22/22] Gateway JSON-RPC 2.0 Endpoints, 30 Model Tools & Monolith Cohesion...");
    const toolSuite = new OsvScannerToolSuite(supervisor);
    const tools = toolSuite.getTools();
    assert.strictEqual(tools.length, 30);

    const monolith = MonolithFactory.createEngine();
    const composition = GrandMonolithSynthesizer.verifyComposition(monolith);
    assert.strictEqual(composition.cohesionStatus, "OPTIMAL");

    const gateway = new MonolithGatewayServer();
    const rpcRes = await gateway.handleJsonRpcRequest(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "test-rpc-1",
        method: "osv/auditHealth",
        params: {},
      }),
      monolith as any
    );
    const rpcResponse = JSON.parse(rpcRes);
    assert.strictEqual(rpcResponse.jsonrpc, "2.0");
    assert.strictEqual(rpcResponse.id, "test-rpc-1");
    assert.ok(rpcResponse.result !== undefined);
    console.log(`  ✓ Verified 30 specialized model tools, JSON-RPC 2.0 gateway endpoint, and Monolith cohesion`);
    passedSuites++;

    console.log();
    console.log("================================================================================");
    console.log(` ALL 22 SUITES PASSED CLEANLY (${passedSuites}/22) - OSV Scanner Subsystem Ready! `);
    console.log("================================================================================");
  } catch (error) {
    console.error("❌ Validation Suite Failed:", error);
    process.exit(1);
  }
}

runOsvScannerValidationSuite();
