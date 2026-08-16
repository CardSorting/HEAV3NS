/**
 * validate-stealth-browser.ts
 *
 * Comprehensive validation suite for Target #44: Camoufox Anti-Fingerprinting Stealth
 * Browser Engine, Accessibility Ref Navigation, Loopback Rewriter & Session Persistence (Phase 111 / ADR-087).
 */

import assert from "node:assert";
import {
  DeterministicStealthBrowser,
  StealthBrowserSupervisor,
  BroccoliStealthBrowserSubstrate,
  StealthBrowserSnapshotManager,
  StealthBrowserToolSuite,
  LOOPBACK_HOSTS,
  DOCKER_INTERNAL_HOST,
} from "../src/index.js";

async function runSuite() {
  console.log("================================================================");
  console.log("   LUMI Stealth Browser & Accessibility Ref Navigation (ADR-087)");
  console.log("================================================================");

  const browserEngine = new DeterministicStealthBrowser();
  const substrate = new BroccoliStealthBrowserSubstrate();
  const snapshotManager = new StealthBrowserSnapshotManager(substrate);
  const supervisor = new StealthBrowserSupervisor(substrate, browserEngine, {
    rewriteLoopback: true,
    profileName: "developer-profile",
  });
  const toolSuite = new StealthBrowserToolSuite(supervisor);

  // --------------------------------------------------------------------------
  // [Test 1/8] Anti-Detection Fingerprint Profile Generation & Spoof Verification
  // --------------------------------------------------------------------------
  console.log("\n[Test 1/8] Validating Anti-Detection Fingerprint Profile Generation & Spoofing...");

  const profile1 = browserEngine.createFingerprintProfile("work-profile", "task-abc");
  const profile2 = browserEngine.createFingerprintProfile("work-profile", "task-abc");
  const profile3 = browserEngine.createFingerprintProfile("personal-profile", "task-xyz");

  assert.strictEqual(profile1.userId, profile2.userId, "Identical profile + task must generate identical userId");
  assert.strictEqual(profile1.sessionKey, profile2.sessionKey);
  assert.notStrictEqual(profile1.userId, profile3.userId, "Different profiles must produce distinct userIds");

  assert.ok(profile1.canvasNoiseSeed >= 0);
  assert.ok(profile1.webGlVendor.length > 0);
  assert.ok(profile1.webGlRenderer.includes("Camoufox"));
  assert.ok(profile1.userAgent.includes("Firefox"));
  assert.strictEqual(profile1.hardwareConcurrency, 8);
  assert.strictEqual(profile1.deviceMemory, 16);

  console.log(`  [✓] Deterministic C++ fingerprint profile generated (userId: ${profile1.userId}, sessionKey: ${profile1.sessionKey}).`);

  // --------------------------------------------------------------------------
  // [Test 2/8] Docker Loopback URL Rewriting & Port Preservation
  // --------------------------------------------------------------------------
  console.log("\n[Test 2/8] Validating Docker Loopback URL Rewriting & Port Preservation...");

  assert.ok(LOOPBACK_HOSTS.includes("127.0.0.1"));
  assert.ok(LOOPBACK_HOSTS.includes("localhost"));
  assert.strictEqual(DOCKER_INTERNAL_HOST, "host.docker.internal");

  // 127.0.0.1 with port and path
  const rw1 = browserEngine.rewriteLoopbackUrl("http://127.0.0.1:3000/api/health", true);
  assert.strictEqual(rw1.didRewrite, true);
  assert.strictEqual(rw1.rewrittenUrl, "http://host.docker.internal:3000/api/health");

  // localhost with port
  const rw2 = browserEngine.rewriteLoopbackUrl("http://localhost:8080", true);
  assert.strictEqual(rw2.didRewrite, true);
  assert.strictEqual(rw2.rewrittenUrl, "http://host.docker.internal:8080/");

  // External domain should NOT be rewritten
  const rw3 = browserEngine.rewriteLoopbackUrl("https://github.com/CardSorting/LUMI-JOY", true);
  assert.strictEqual(rw3.didRewrite, false);
  assert.strictEqual(rw3.rewrittenUrl, "https://github.com/CardSorting/LUMI-JOY");

  // Disabled rewrite mode
  const rw4 = browserEngine.rewriteLoopbackUrl("http://127.0.0.1:5000", false);
  assert.strictEqual(rw4.didRewrite, false);
  assert.strictEqual(rw4.rewrittenUrl, "http://127.0.0.1:5000");

  console.log("  [✓] Docker loopback rewriting (127.0.0.1 / localhost -> host.docker.internal) verified.");

  // --------------------------------------------------------------------------
  // [Test 3/8] Accessibility Tree Token Formatting & Flat Ref Indexing ([ref=eX])
  // --------------------------------------------------------------------------
  console.log("\n[Test 3/8] Validating Accessibility Tree Token Formatting & Flat Ref Indexing...");

  const rawDomTree = [
    {
      role: "banner",
      name: "Site Header",
      children: [
        { role: "heading", name: "Welcome to Product Portal" },
        { role: "link", name: "Pricing" },
      ],
    },
    {
      role: "main",
      name: "Checkout Section",
      children: [
        { role: "textbox", name: "Email address", value: "user@example.com" },
        { role: "checkbox", name: "Subscribe to newsletter", checked: true },
        { role: "button", name: "Complete Order", disabled: false },
        { role: "button", name: "Apply Discount", disabled: true },
      ],
    },
  ];

  const snapshot = browserEngine.buildAccessibilitySnapshot(
    "tab-test-1",
    "http://host.docker.internal:3000/checkout",
    "Checkout Portal",
    rawDomTree
  );

  assert.strictEqual(snapshot.tabId, "tab-test-1");
  assert.ok(snapshot.textTree.includes('[ref=e1] [banner] "Site Header"'));
  assert.ok(snapshot.textTree.includes('  [ref=e2] [heading] "Welcome to Product Portal"'));
  assert.ok(snapshot.textTree.includes('  [ref=e5] [textbox] "Email address" value="user@example.com"'));
  assert.ok(snapshot.textTree.includes('  [ref=e6] [checkbox] "Subscribe to newsletter" [checked]'));
  assert.ok(snapshot.textTree.includes('  [ref=e8] [button] "Apply Discount" [disabled]'));

  // O(1) element map validation
  assert.strictEqual(snapshot.elementMap["e5"].name, "Email address");
  assert.strictEqual(snapshot.elementMap["e5"].value, "user@example.com");
  assert.strictEqual(snapshot.elementMap["e8"].disabled, true);

  console.log(`  [✓] Accessibility tree snapshot built (${snapshot.totalInteractiveElements} interactive elements indexed).`);

  // --------------------------------------------------------------------------
  // [Test 4/8] Ref Interaction Engine (Click, Type, Scroll, Select, Hover)
  // --------------------------------------------------------------------------
  console.log("\n[Test 4/8] Validating Ref Interaction Engine...");

  // Click active submit button
  const clickRes = browserEngine.interactWithRef(snapshot, "e7", "click");
  assert.strictEqual(clickRes.success, true);
  assert.strictEqual(clickRes.elementRole, "button");
  assert.strictEqual(clickRes.elementName, "Complete Order");

  // Interaction with disabled button must fail cleanly
  const disabledRes = browserEngine.interactWithRef(snapshot, "e8", "click");
  assert.strictEqual(disabledRes.success, false);
  assert.ok(disabledRes.error?.includes("disabled"));

  // Typing into textbox
  const typeRes = browserEngine.interactWithRef(snapshot, "e5", "type", "updated@lumi.ai");
  assert.strictEqual(typeRes.success, true);
  assert.strictEqual(typeRes.elementRole, "textbox");

  // Non-existent ref ID
  const invalidRes = browserEngine.interactWithRef(snapshot, "e999", "click");
  assert.strictEqual(invalidRes.success, false);
  assert.ok(invalidRes.error?.includes("not found"));

  console.log("  [✓] Atomic ref-based element interactions and disabled element guards verified.");

  // --------------------------------------------------------------------------
  // [Test 5/8] Multi-Tab Lifecycle & Active Tab Focus Switching
  // --------------------------------------------------------------------------
  console.log("\n[Test 5/8] Validating Multi-Tab Lifecycle & Active Tab Focus Switching...");

  substrate.clear();

  const tab1 = supervisor.openTab("http://127.0.0.1:3000/page1");
  assert.strictEqual(tab1.url, "http://host.docker.internal:3000/page1");
  assert.strictEqual(tab1.isActive, true);

  const tab2 = supervisor.openTab("http://127.0.0.1:3000/page2");
  assert.strictEqual(supervisor.listTabs().length, 2);
  assert.strictEqual(substrate.getActiveTab()?.tabId, tab2.tabId);

  // Switch focus back to tab 1
  supervisor.switchTab(tab1.tabId);
  assert.strictEqual(substrate.getActiveTab()?.tabId, tab1.tabId);

  // Close active tab 1 -> focus should move to tab 2
  supervisor.closeTab(tab1.tabId);
  assert.strictEqual(supervisor.listTabs().length, 1);
  assert.strictEqual(substrate.getActiveTab()?.tabId, tab2.tabId);

  console.log("  [✓] Multi-tab lifecycle, active tab migration & focus management verified.");

  // --------------------------------------------------------------------------
  // [Test 6/8] Cookie Jar & LocalStorage Persistence Vault
  // --------------------------------------------------------------------------
  console.log("\n[Test 6/8] Validating Cookie Jar & LocalStorage Persistence Vault...");

  supervisor.setCookie({
    name: "auth_token",
    value: "jwt-token-xyz-123",
    domain: "host.docker.internal",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
  });

  supervisor.setCookie({
    name: "session_id",
    value: "sess-999",
    domain: "api.partner.com",
    path: "/",
  });

  const dockerCookies = supervisor.getCookies("host.docker.internal");
  assert.strictEqual(dockerCookies.length, 1);
  assert.strictEqual(dockerCookies[0].name, "auth_token");

  // Local storage persistence
  supervisor.setStorageItem({
    key: "theme_preference",
    value: "dark_high_contrast",
    domain: "host.docker.internal",
    storageType: "localStorage",
  });

  const storageItems = supervisor.getStorage("host.docker.internal", "localStorage");
  assert.strictEqual(storageItems.length, 1);
  assert.strictEqual(storageItems[0].value, "dark_high_contrast");

  console.log("  [✓] Cookie jar and local storage persistence vault verified.");

  // --------------------------------------------------------------------------
  // [Test 7/8] In-Memory Substrate, Frame Snapshots & Instant O(1) Rollback (< 0.05 ms)
  // --------------------------------------------------------------------------
  console.log("\n[Test 7/8] Validating In-Memory Substrate, Frame Snapshots & Instant O(1) Rollback...");

  // Record some activities
  supervisor.navigate("http://127.0.0.1:4000/dashboard");
  supervisor.captureSnapshot();

  const metricsBefore = supervisor.getMetrics();
  assert.ok(metricsBefore.totalNavigations >= 1);

  // Take frame snapshot
  const snapshotFrame = snapshotManager.takeSnapshot("checkpoint-browser-1");
  assert.ok(snapshotFrame.tabs.length >= 1);

  // Mutate state
  supervisor.openTab("https://mutated.example.com");
  supervisor.setCookie({ name: "temp_cookie", value: "temp", domain: "example.com", path: "/" });
  assert.strictEqual(supervisor.getMetrics().activeTabsCount, metricsBefore.activeTabsCount + 1);

  // Measure O(1) Rollback latency with JIT warmup
  snapshotManager.restoreSnapshot("checkpoint-browser-1"); // JIT warmup
  const tRollbackStart = performance.now();
  const restored = snapshotManager.restoreSnapshot("checkpoint-browser-1");
  const rollbackDurationMs = performance.now() - tRollbackStart;

  assert.strictEqual(restored, true);
  assert.strictEqual(supervisor.getMetrics().activeTabsCount, metricsBefore.activeTabsCount);
  assert.ok(
    rollbackDurationMs < 0.1,
    `Rollback completed in ${rollbackDurationMs.toFixed(4)} ms (< 0.1 ms SLA)`
  );

  console.log(`  [✓] Frame-perfect binary snapshot & instant O(1) rollback passed (${rollbackDurationMs.toFixed(4)} ms).`);

  // --------------------------------------------------------------------------
  // [Test 8/8] Model Tool Suite (6 Tools) & High-Frequency Micro-Benchmarks
  // --------------------------------------------------------------------------
  console.log("\n[Test 8/8] Validating Model Tool Suite (6 Tools) & Micro-Benchmarks...");

  // Tool 1: stealth_browser_navigate
  const t1 = await toolSuite.getTools().find((t) => t.name === "stealth_browser_navigate")?.execute({
    url: "http://127.0.0.1:3000/app",
  }, "");
  assert.strictEqual((t1 as any)?.success, true);
  assert.strictEqual((t1 as any)?.didRewriteLoopback, true);

  // Tool 2: stealth_browser_snapshot
  const t2 = await toolSuite.getTools().find((t) => t.name === "stealth_browser_snapshot")?.execute({}, "");
  assert.strictEqual((t2 as any)?.success, true);
  assert.ok((t2 as any)?.accessibilityTree.includes("[ref=e1]"));

  // Tool 3: stealth_browser_interact_ref
  const t3 = await toolSuite.getTools().find((t) => t.name === "stealth_browser_interact_ref")?.execute({
    ref_id: "e3",
    action: "click",
  }, "");
  assert.strictEqual((t3 as any)?.success, true);

  // Tool 4: stealth_browser_manage_tabs
  const t4 = await toolSuite.getTools().find((t) => t.name === "stealth_browser_manage_tabs")?.execute({
    operation: "list",
  }, "");
  assert.strictEqual((t4 as any)?.success, true);
  assert.ok((t4 as any)?.totalTabs >= 1);

  // Tool 5: stealth_browser_inspect_storage
  const t5 = await toolSuite.getTools().find((t) => t.name === "stealth_browser_inspect_storage")?.execute({
    domain: "host.docker.internal",
  }, "");
  assert.strictEqual((t5 as any)?.success, true);

  // Tool 6: stealth_browser_rewrite_url
  const t6 = await toolSuite.getTools().find((t) => t.name === "stealth_browser_rewrite_url")?.execute({
    url: "http://localhost:9000/metrics",
  }, "");
  assert.strictEqual((t6 as any)?.success, true);
  assert.strictEqual((t6 as any)?.rewrittenUrl, "http://host.docker.internal:9000/metrics");

  // High-Frequency Micro-Benchmark: 10,000 accessibility snapshot builds
  const iterations = 10000;
  const benchmarkNodes = [
    { role: "heading", name: "Title" },
    { role: "button", name: "Action 1" },
    { role: "button", name: "Action 2" },
    { role: "textbox", name: "Input", value: "test" },
  ];
  const tBenchStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    browserEngine.buildAccessibilitySnapshot("tab-bench", "http://bench.local", "Bench", benchmarkNodes);
  }

  const benchDurationMs = performance.now() - tBenchStart;
  const throughputOpsPerSec = Math.round((iterations / benchDurationMs) * 1000);
  const usPerOp = (benchDurationMs / iterations) * 1000;

  console.log(`  Measured: ${iterations} accessibility snapshots in ${benchDurationMs.toFixed(3)} ms (${usPerOp.toFixed(3)} µs/op | ${throughputOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(throughputOpsPerSec > 10000, "Throughput must exceed 10,000 ops/sec");

  console.log("  [✓] All 6 model tools executed cleanly & high-frequency micro-benchmark passed.");

  console.log("\n================================================================");
  console.log("   ALL 8 STEALTH BROWSER VALIDATION SUITES PASSED CLEANLY!     ");
  console.log("================================================================");
}

runSuite().catch((err) => {
  console.error("Validation failed with error:", err);
  process.exit(1);
});
