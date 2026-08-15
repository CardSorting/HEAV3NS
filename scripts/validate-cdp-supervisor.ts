import * as assert from "node:assert/strict";
import {
  LumiMonolith,
  CdpNavigationGuard,
  CdpDialogPolicyEngine,
  CdpDomSnapshotter,
  CdpProtocolClient,
  BroccoliBrowserSubstrate,
  BrowserSnapshotManager,
  CdpSupervisorEngine,
  CdpToolSuite,
} from "../src/index.js";

async function main(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Deterministic CDP Supervisor (AKD-DSO Validation)      ");
  console.log("================================================================\n");

  const navGuard = new CdpNavigationGuard();
  const substrate = new BroccoliBrowserSubstrate();
  const cdpClient = new CdpProtocolClient();
  const domSnapshotter = new CdpDomSnapshotter();
  const snapshotManager = new BrowserSnapshotManager(substrate);
  const dialogPolicy = new CdpDialogPolicyEngine(substrate, "auto_dismiss", cdpClient);
  const supervisor = new CdpSupervisorEngine(substrate, navGuard, dialogPolicy, domSnapshotter, cdpClient);
  const toolSuite = new CdpToolSuite(supervisor);

  // ── [Test 1/8] URL Security & SSRF Guardrails ─────────────────────────────
  console.log("[Test 1/8] Validating URL Security & SSRF Guardrails...");
  {
    // Block AWS / GCP cloud metadata
    const metadataCheck = navGuard.validateNavigationUrl("http://169.254.169.254/latest/meta-data/");
    assert.ok(!metadataCheck.allowed, "Cloud metadata 169.254.169.254 must be blocked");
    assert.ok(metadataCheck.reason?.includes("cloud metadata endpoint"));

    // Block sensitive local file URLs
    const fileCheck = navGuard.validateNavigationUrl("file:///etc/passwd");
    assert.ok(!fileCheck.allowed, "Sensitive system files must be blocked");

    // Allow legitimate HTTPS URLs
    const validHttps = navGuard.validateNavigationUrl("https://github.com/nousresearch/hermes-agent");
    assert.ok(validHttps.allowed, "Legitimate HTTPS URL must be allowed");
    assert.equal(validHttps.sanitizedUrl, "https://github.com/nousresearch/hermes-agent");

    // Allow about:blank
    const validAbout = navGuard.validateNavigationUrl("about:blank");
    assert.ok(validAbout.allowed, "about:blank must be allowed");

    console.log("\x1b[32m  [✓] URL security, metadata blocking, and protocol validation passed.\x1b[0m");
  }

  // ── [Test 2/8] CDP URL Credential Redaction ───────────────────────────────
  console.log("[Test 2/8] Validating CDP Credential Redaction...");
  {
    const rawCdpUrl = "ws://user:secretpassword123@browserbase.internal:9222/devtools/page/abc?token=super-secret-token";
    const redacted = navGuard.redactCdpUrl(rawCdpUrl);

    assert.ok(!redacted.includes("secretpassword123"), "Password must be redacted");
    assert.ok(!redacted.includes("super-secret-token"), "Token must be redacted");
    assert.ok(redacted.includes("[REDACTED]"), "Redacted placeholder must be present");

    console.log("\x1b[32m  [✓] Sensitive CDP credentials and tokens properly masked.\x1b[0m");
  }

  // ── [Test 3/8] Non-Blocking Protocol Dialog Handling ──────────────────────
  console.log("[Test 3/8] Validating Non-Blocking Protocol Dialog Engine...");
  {
    // Auto-dismiss policy
    dialogPolicy.setPolicy("auto_dismiss");
    const dismissRes = await dialogPolicy.handleInboundDialogEvent("target-1", "alert", "Session Expired");
    assert.ok(dismissRes.handled, "Auto-dismiss policy should resolve immediately");
    assert.equal(dismissRes.actionTaken, "dismiss");

    // Auto-accept policy
    dialogPolicy.setPolicy("auto_accept");
    const acceptRes = await dialogPolicy.handleInboundDialogEvent("target-1", "confirm", "Confirm Purchase?");
    assert.ok(acceptRes.handled, "Auto-accept policy should resolve immediately");
    assert.equal(acceptRes.actionTaken, "accept");

    // Interactive policy
    dialogPolicy.setPolicy("interactive");
    const interactiveRes = await dialogPolicy.handleInboundDialogEvent("target-1", "prompt", "Enter 2FA Code", "123456");
    assert.ok(!interactiveRes.handled, "Interactive policy should leave dialog pending");

    const pending = substrate.getPendingDialogs();
    assert.ok(pending.length >= 1, "Pending dialog must be listed in substrate");

    // Respond interactively
    const respondRes = await dialogPolicy.respondToDialog(interactiveRes.dialogId, "accept", "654321");
    assert.ok(respondRes.success, "Responding to interactive dialog must succeed");
    assert.equal(substrate.getPendingDialogs().length, 0, "No pending dialogs should remain");

    console.log("\x1b[32m  [✓] Auto-dismiss, auto-accept, and interactive dialog arbitration passed.\x1b[0m");
  }

  // ── [Test 4/8] Bounded Semantic DOM Snapshotting ───────────────────────────
  console.log("[Test 4/8] Validating Bounded Semantic DOM Snapshotting...");
  {
    const rawDom = {
      nodeId: 1,
      nodeType: 1,
      nodeName: "HTML",
      children: [
        {
          nodeId: 2,
          nodeType: 1,
          nodeName: "BODY",
          children: [
            {
              nodeId: 3,
              nodeType: 1,
              nodeName: "NAV",
              attributes: ["role", "navigation"],
              children: [
                {
                  nodeId: 4,
                  nodeType: 1,
                  nodeName: "A",
                  attributes: ["href", "https://example.com/docs", "id", "docs-link"],
                  children: [{ nodeId: 5, nodeType: 3, nodeName: "#text", nodeValue: "Documentation" }],
                },
              ],
            },
            {
              nodeId: 6,
              nodeType: 1,
              nodeName: "SCRIPT", // Should be stripped
              children: [{ nodeId: 7, nodeType: 3, nodeName: "#text", nodeValue: "console.log('secret');" }],
            },
            {
              nodeId: 8,
              nodeType: 1,
              nodeName: "IMG",
              attributes: ["src", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="],
            },
          ],
        },
      ],
    };

    const snapshot = domSnapshotter.parseRawDom("target-1", "https://example.com", "Example Page", rawDom);

    assert.equal(snapshot.targetId, "target-1");
    assert.ok(snapshot.interactiveNodesCount >= 1, "Link node must be marked interactive");
    assert.ok(!snapshot.textSummary.includes("SCRIPT"), "Script nodes must be omitted from summary");
    assert.ok(snapshot.textSummary.includes("Documentation"), "Text content must be extracted");
    assert.ok(snapshot.textSummary.includes("[interactive]"), "Interactive marker must be rendered");

    console.log("\x1b[32m  [✓] Semantic DOM parsing, interactive tag detection, and noise stripping passed.\x1b[0m");
  }

  // ── [Test 5/8] In-Memory Broccolidb Substrate & History Buffers ────────────
  console.log("[Test 5/8] Validating In-Memory Substrate & History Buffers...");
  {
    substrate.clear();

    substrate.addTarget({
      targetId: "tab-primary",
      type: "page",
      title: "Dashboard",
      url: "https://app.local/dashboard",
      attached: true,
    });

    assert.equal(substrate.listTargets().length, 1);
    assert.equal(substrate.getActiveTarget()?.targetId, "tab-primary");

    // Record console & network events
    substrate.recordConsoleMessage({
      id: "log-1",
      targetId: "tab-primary",
      level: "error",
      text: "Unhandled TypeError at runtime",
      timestampMs: Date.now(),
    });

    substrate.recordNetworkRequest({
      requestId: "req-1",
      targetId: "tab-primary",
      url: "https://api.local/v1/auth",
      method: "POST",
      failed: false,
      timestampMs: Date.now(),
    });

    assert.equal(substrate.listConsoleMessages().length, 1);
    assert.equal(substrate.listNetworkRequests().length, 1);

    console.log("\x1b[32m  [✓] In-memory targets, console ring buffers, and network ledgers verified.\x1b[0m");
  }

  // ── [Test 6/8] Frame-Perfect Binary Snapshotting & O(1) Rollback ───────────
  console.log("[Test 6/8] Validating Browser Snapshotting & O(1) Rollback...");
  {
    // Snapshot state at frame 5
    const snapshot5 = snapshotManager.createSnapshot(5);
    assert.equal(snapshot5.targets.length, 1);

    // Mutate state (add 2 more tabs)
    substrate.addTarget({
      targetId: "tab-2",
      type: "page",
      title: "Tab 2",
      url: "https://app.local/tab2",
      attached: true,
    });
    substrate.addTarget({
      targetId: "tab-3",
      type: "page",
      title: "Tab 3",
      url: "https://app.local/tab3",
      attached: true,
    });
    assert.equal(substrate.listTargets().length, 3);

    // Rollback to frame 5
    const startRollback = performance.now();
    snapshotManager.restoreSnapshot(snapshot5);
    const rollbackDuration = performance.now() - startRollback;

    assert.equal(substrate.listTargets().length, 1);
    assert.equal(substrate.getTarget("tab-primary")?.targetId, "tab-primary");
    assert.equal(substrate.getTarget("tab-2"), undefined);
    assert.ok(rollbackDuration < 1.0, `Rollback took ${rollbackDuration} ms, must be < 1.0ms`);

    console.log(`\x1b[32m  [✓] Browser state snapshotting and instant O(1) rollback passed (${rollbackDuration.toFixed(3)} ms).\x1b[0m`);
  }

  // ── [Test 7/8] Model Tool Suite Operations ────────────────────────────────
  console.log("[Test 7/8] Validating Browser & CDP Model Tool Suite...");
  {
    // 1. browser_navigate
    const navResult = await toolSuite.executeTool("browser_navigate", { url: "https://lumi.engine.local/app" });
    assert.ok(navResult.success, "browser_navigate should succeed");

    // 2. browser_snapshot
    const snapResult = await toolSuite.executeTool("browser_snapshot", {});
    assert.ok(snapResult.success, "browser_snapshot should succeed");

    // 3. browser_click
    const clickResult = await toolSuite.executeTool("browser_click", { selectorOrId: "#submit-btn" });
    assert.ok(clickResult.success, "browser_click should succeed");

    // 4. browser_type
    const typeResult = await toolSuite.executeTool("browser_type", { selectorOrId: "#username-input", text: "admin_user" });
    assert.ok(typeResult.success, "browser_type should succeed");

    // 5. browser_eval
    const evalResult = await toolSuite.executeTool("browser_eval", { expression: "1 + 1" });
    assert.ok(evalResult.success, "browser_eval should succeed");

    // 6. browser_cdp_send
    const cdpSendResult = await toolSuite.executeTool("browser_cdp_send", {
      method: "Browser.getVersion",
      params: "{}",
    });
    assert.ok(cdpSendResult.success, "browser_cdp_send should succeed");

    console.log("\x1b[32m  [✓] Model tool operations (navigate, snapshot, click, type, eval, cdp_send) passed.\x1b[0m");
  }

  // ── [Test 8/8] Monolith Composition & DOM Micro-Benchmark ─────────────────
  console.log("[Test 8/8] Benchmarking Monolith Composition & High-Frequency DOM Parsing...");
  {
    const monolith = new LumiMonolith({ sessionId: "cdp-benchmark-session" });
    assert.ok(monolith.cdpSupervisorEngine, "cdpSupervisorEngine must be composed");
    assert.ok(monolith.cdpNavigationGuard, "cdpNavigationGuard must be composed");
    assert.ok(monolith.cdpDialogPolicyEngine, "cdpDialogPolicyEngine must be composed");
    assert.ok(monolith.cdpDomSnapshotter, "cdpDomSnapshotter must be composed");
    assert.ok(monolith.cdpProtocolClient, "cdpProtocolClient must be composed");
    assert.ok(monolith.broccoliBrowserSubstrate, "broccoliBrowserSubstrate must be composed");
    assert.ok(monolith.browserSnapshotManager, "browserSnapshotManager must be composed");
    assert.ok(monolith.cdpToolSuite, "cdpToolSuite must be composed");

    const sampleRawDom = {
      nodeId: 1,
      nodeType: 1,
      nodeName: "HTML",
      children: [
        {
          nodeId: 2,
          nodeType: 1,
          nodeName: "BODY",
          children: Array.from({ length: 20 }, (_, i) => ({
            nodeId: 10 + i,
            nodeType: 1,
            nodeName: "DIV",
            children: [
              {
                nodeId: 50 + i,
                nodeType: 1,
                nodeName: "BUTTON",
                attributes: ["id", `btn-${i}`, "role", "button"],
                children: [{ nodeId: 100 + i, nodeType: 3, nodeName: "#text", nodeValue: `Action ${i}` }],
              },
            ],
          })),
        },
      ],
    };

    // Benchmark 1,000 DOM parses
    const iterations = 1000;
    const startBench = performance.now();
    for (let i = 0; i < iterations; i++) {
      monolith.cdpDomSnapshotter.parseRawDom("target-bench", "https://lumi.local", "Bench", sampleRawDom);
    }
    const totalBenchMs = performance.now() - startBench;
    const perParseUs = (totalBenchMs / iterations) * 1000;

    console.log(`  Measured: ${iterations} DOM tree snapshot parses in ${totalBenchMs.toFixed(3)} ms (${perParseUs.toFixed(3)} µs/parse)`);
    assert.ok(totalBenchMs < 50.0, `1,000 parses took ${totalBenchMs} ms, must be < 50.0ms`);

    console.log("\x1b[32m  [✓] Monolith composition & DOM micro-benchmark passed.\x1b[0m");
  }

  console.log("\n================================================================");
  console.log("   ALL 8 CDP SUPERVISOR VALIDATION SUITES PASSED!              ");
  console.log("================================================================\n");
}

main().catch((error) => {
  console.error("Validation failed with error:", error);
  process.exit(1);
});
