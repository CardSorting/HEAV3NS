/**
 * validate-url-safety.ts
 *
 * Comprehensive validation suite for Target #51: SSRF Defense Firewall,
 * Cloud Metadata & Private IP Blocker, and URL Normalizer Subsystem (Phase 118 / ADR-094).
 */

import assert from "node:assert";
import {
  DeterministicUrlSafety,
  UrlSafetySupervisor,
  BroccoliUrlSafetySubstrate,
  UrlSafetySnapshotManager,
  UrlSafetyToolSuite,
} from "../src/index.js";

async function runSuite() {
  console.log("================================================================");
  console.log("   LUMI SSRF Defense Firewall & URL Normalizer (ADR-094)        ");
  console.log("================================================================");

  const urlSafety = new DeterministicUrlSafety();
  const substrate = new BroccoliUrlSafetySubstrate();
  const snapshotManager = new UrlSafetySnapshotManager(substrate);
  const supervisor = new UrlSafetySupervisor(substrate, urlSafety);
  const toolSuite = new UrlSafetyToolSuite(supervisor);

  // --------------------------------------------------------------------------
  // [Test 1/8] Cloud Metadata Endpoint Denial
  // --------------------------------------------------------------------------
  console.log("\n[Test 1/8] Validating Cloud Metadata Endpoint Denial...");

  const awsRes = supervisor.checkUrl("http://169.254.169.254/latest/meta-data/");
  assert.strictEqual(awsRes.isSafe, false);
  assert.strictEqual(awsRes.verdict, "blocked_cloud_metadata");

  const gcpRes = supervisor.checkUrl("http://metadata.google.internal/computeMetadata/v1/");
  assert.strictEqual(gcpRes.isSafe, false);
  assert.strictEqual(gcpRes.verdict, "blocked_cloud_metadata");

  const aliRes = supervisor.checkUrl("http://100.100.100.200/latest/meta-data/");
  assert.strictEqual(aliRes.isSafe, false);
  assert.strictEqual(aliRes.verdict, "blocked_cloud_metadata");

  const ecsRes = supervisor.checkUrl("http://169.254.170.2/v2/credentials");
  assert.strictEqual(ecsRes.isSafe, false);
  assert.strictEqual(ecsRes.verdict, "blocked_cloud_metadata");

  console.log("  [✓] AWS, GCP, Azure, Alibaba, and ECS task metadata endpoints unconditionally blocked.");

  // --------------------------------------------------------------------------
  // [Test 2/8] RFC 1918 Private Ranges & Loopback Blocking
  // --------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating RFC 1918 Private Ranges & Loopback Blocking...");

  const loopbackRes = supervisor.checkUrl("http://127.0.0.1:8080/admin");
  assert.strictEqual(loopbackRes.isSafe, false);
  assert.strictEqual(loopbackRes.verdict, "blocked_loopback");

  const localhostRes = supervisor.checkUrl("http://localhost:3000/api");
  assert.strictEqual(localhostRes.isSafe, false);
  assert.strictEqual(localhostRes.verdict, "blocked_loopback");

  const rfc10 = supervisor.checkUrl("http://10.0.1.5/dashboard");
  assert.strictEqual(rfc10.isSafe, false);
  assert.strictEqual(rfc10.verdict, "blocked_private_ip");

  const rfc172 = supervisor.checkUrl("http://172.20.10.1/config");
  assert.strictEqual(rfc172.isSafe, false);
  assert.strictEqual(rfc172.verdict, "blocked_private_ip");

  const rfc192 = supervisor.checkUrl("http://192.168.1.1/router");
  assert.strictEqual(rfc192.isSafe, false);
  assert.strictEqual(rfc192.verdict, "blocked_private_ip");

  const cgnat = supervisor.checkUrl("http://100.64.0.1/service");
  assert.strictEqual(cgnat.isSafe, false);
  assert.strictEqual(cgnat.verdict, "blocked_private_ip");

  const publicRes = supervisor.checkUrl("https://api.github.com/repos/CardSorting/LUMI-JOY");
  assert.strictEqual(publicRes.isSafe, true);
  assert.strictEqual(publicRes.verdict, "allowed");

  console.log("  [✓] Loopback and RFC 1918 / CGNAT private subnets blocked; public APIs allowed.");

  // --------------------------------------------------------------------------
  // [Test 3/8] Alternative IP Format Decoding & Bypass Neutralization
  // --------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Alternative IP Formats (Integer, Hex, Octal, IPv6 Mapped)...");

  // Pure Integer (2130706433 = 127.0.0.1)
  const intIpRes = supervisor.checkUrl("http://2130706433/");
  assert.strictEqual(intIpRes.isSafe, false);
  assert.strictEqual(intIpRes.verdict, "blocked_loopback");

  // Pure Hex (0x7f000001 = 127.0.0.1)
  const hexIpRes = supervisor.checkUrl("http://0x7f000001/");
  assert.strictEqual(hexIpRes.isSafe, false);
  assert.strictEqual(hexIpRes.verdict, "blocked_loopback");

  // Octal dotted (0177.0.0.1 = 127.0.0.1)
  const octalIpRes = supervisor.checkUrl("http://0177.0.0.1/");
  assert.strictEqual(octalIpRes.isSafe, false);
  assert.strictEqual(octalIpRes.verdict, "blocked_loopback");

  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  const mappedLoopRes = supervisor.checkUrl("http://[::ffff:127.0.0.1]/");
  assert.strictEqual(mappedLoopRes.isSafe, false);
  assert.strictEqual(mappedLoopRes.verdict, "blocked_loopback");

  // IPv4-mapped Cloud Metadata (::ffff:169.254.169.254)
  const mappedMetaRes = supervisor.checkUrl("http://[::ffff:169.254.169.254]/");
  assert.strictEqual(mappedMetaRes.isSafe, false);
  assert.strictEqual(mappedMetaRes.verdict, "blocked_cloud_metadata");

  console.log("  [✓] Integer, hex, octal, and IPv4-mapped IPv6 bypass attempts decoded and neutralized.");

  // --------------------------------------------------------------------------
  // [Test 4/8] URL Normalization, Intra-Scheme Whitespace Repair & Punycode
  // --------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating URL Normalization, Intra-Scheme Whitespace & Punycode...");

  const brokenScheme = "https:// docs.example.com/api/v1";
  const fixedScheme = urlSafety.normalizeUrl(brokenScheme);
  assert.strictEqual(fixedScheme, "https://docs.example.com/api/v1");

  const iriUrl = "https://wttr.in/Köln?format=3";
  const normalizedIri = urlSafety.normalizeUrl(iriUrl);
  assert.ok(normalizedIri.includes("https://wttr.in/"));
  assert.ok(normalizedIri.includes("format=3"));

  console.log("  [✓] URL normalization and whitespace repairs verified.");

  // --------------------------------------------------------------------------
  // [Test 5/8] Custom Allow & Deny List Policies
  // --------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Custom Allow & Deny List Policies...");

  supervisor.addCustomBlockedHost("malicious-analytics.io");
  const blockedCustom = supervisor.checkUrl("https://malicious-analytics.io/track");
  assert.strictEqual(blockedCustom.isSafe, false);
  assert.strictEqual(blockedCustom.verdict, "blocked_custom_rule");

  supervisor.addCustomAllowedHost("internal-test.local");
  const allowedCustom = supervisor.checkUrl("http://internal-test.local/health");
  assert.strictEqual(allowedCustom.isSafe, true);
  assert.strictEqual(allowedCustom.verdict, "allowed");

  console.log("  [✓] Custom allowlist overrides and denylist enforcement verified.");

  // --------------------------------------------------------------------------
  // [Test 6/8] In-Memory Substrate Logging & Blocked Request Ledgers
  // --------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating In-Memory Substrate Logging & Metrics...");

  const metrics = supervisor.getMetrics();
  assert.ok(metrics.totalChecks >= 15);
  assert.ok(metrics.blockedMetadataCount >= 4);
  assert.ok(metrics.blockedLoopbackCount >= 4);
  assert.ok(metrics.blockedPrivateCount >= 4);
  assert.ok(metrics.blockedCustomCount >= 1);

  const ledger = supervisor.getBlockedLedger();
  assert.ok(ledger.length >= 10);
  assert.ok(ledger.some((e) => e.verdict === "blocked_cloud_metadata"));

  console.log(`  [✓] Substrate recorded ${metrics.totalChecks} checks (${metrics.allowedCount} allowed, ${ledger.length} blocked in ledger).`);

  // --------------------------------------------------------------------------
  // [Test 7/8] Binary Snapshotting & O(1) State Rollback
  // --------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating Binary Snapshotting & O(1) State Rollback...");

  const initialLedgerCount = substrate.getBlockedLedger().length;
  snapshotManager.takeSnapshot("checkpoint-url-1");

  supervisor.checkUrl("http://10.99.99.99/probe");
  supervisor.checkUrl("http://192.168.99.99/probe");
  assert.strictEqual(substrate.getBlockedLedger().length, initialLedgerCount + 2);

  // JIT Warmup
  for (let i = 0; i < 50; i++) {
    snapshotManager.restoreSnapshot("checkpoint-url-1");
  }

  supervisor.checkUrl("http://10.99.99.99/probe");
  const tRollbackStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("checkpoint-url-1");
  const rollbackDurationMs = performance.now() - tRollbackStart;

  assert.strictEqual(restored, true);
  assert.strictEqual(substrate.getBlockedLedger().length, initialLedgerCount);
  assert.ok(
    rollbackDurationMs < 0.05,
    `Rollback completed in ${rollbackDurationMs.toFixed(4)} ms (< 0.05 ms SLA)`
  );

  console.log(`  [✓] Substrate state rollback verified (${rollbackDurationMs.toFixed(4)} ms).`);

  // --------------------------------------------------------------------------
  // [Test 8/8] Model Tool Suite (5 Tools) & Ultra-High-Throughput Micro-Benchmark
  // --------------------------------------------------------------------------
  console.log("\n[Test 8/8] Validating Model Tool Suite & Micro-Benchmarks...");

  // Tool 1: url_check_safety
  const t1 = await toolSuite.getTools().find((t) => t.name === "url_check_safety")?.execute({
    url: "https://api.github.com",
  }, "");
  assert.strictEqual((t1 as any)?.success, true);
  assert.strictEqual((t1 as any)?.isSafe, true);

  // Tool 2: url_normalize_target
  const t2 = await toolSuite.getTools().find((t) => t.name === "url_normalize_target")?.execute({
    url: "https:// docs.example.com",
  }, "");
  assert.strictEqual((t2 as any)?.success, true);
  assert.strictEqual((t2 as any)?.normalizedUrl, "https://docs.example.com/");

  // Tool 3: url_resolve_and_verify
  const t3 = await toolSuite.getTools().find((t) => t.name === "url_resolve_and_verify")?.execute({
    host_or_ip: "169.254.169.254",
  }, "");
  assert.strictEqual((t3 as any)?.success, true);
  assert.strictEqual((t3 as any)?.isSafe, false);
  assert.strictEqual((t3 as any)?.category, "cloud_metadata");

  // Tool 4: url_inspect_security_ledger
  const t4 = await toolSuite.getTools().find((t) => t.name === "url_inspect_security_ledger")?.execute({}, "");
  assert.strictEqual((t4 as any)?.success, true);
  assert.ok((t4 as any)?.blockedCount >= 1);

  // Tool 5: url_get_firewall_metrics
  const t5 = await toolSuite.getTools().find((t) => t.name === "url_get_firewall_metrics")?.execute({}, "");
  assert.strictEqual((t5 as any)?.success, true);
  assert.ok((t5 as any)?.metrics?.totalChecks >= 1);

  // Ultra-High-Throughput Micro-Benchmark: 50,000 URL safety checks
  const iterations = 50000;
  const sampleUrls = [
    "https://api.openai.com/v1/models",
    "http://169.254.169.254/latest/meta-data/",
    "http://127.0.0.1:8000/metrics",
    "http://0x7f000001/status",
    "https://wttr.in/Paris",
    "http://10.0.0.1/admin",
  ];
  const tBenchStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    const u = sampleUrls[i % sampleUrls.length];
    urlSafety.checkUrlSafety(u);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} checks in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/check | ${throughputOpsPerSec.toLocaleString()} checks/sec)`);
  assert.ok(throughputOpsPerSec > 200000, "Throughput must exceed 200,000 checks/sec");

  console.log("  [✓] All 5 model tools executed cleanly & ultra-high-throughput benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 URL SAFETY VALIDATION SUITES PASSED CLEANLY!           ");
  console.log("================================================================");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
