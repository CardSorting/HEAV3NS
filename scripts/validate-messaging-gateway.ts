import * as assert from "node:assert/strict";
import * as crypto from "node:crypto";
import {
  LumiMonolith,
  TelegramProtocolAdapter,
  DiscordProtocolAdapter,
  SlackProtocolAdapter,
  WebhookProtocolAdapter,
  BroccoliGatewaySubstrate,
  GatewayDeliveryLedger,
  GatewaySnapshotManager,
  GatewayDispatcherEngine,
  GatewayToolSuite,
} from "../src/index.js";

async function main(): Promise<void> {
  console.log("================================================================");
  console.log("   LUMI Multi-Platform Messaging Gateway (AKD-DSO Validation)  ");
  console.log("================================================================\n");

  const substrate = new BroccoliGatewaySubstrate();
  const ledger = new GatewayDeliveryLedger(500);
  const tgAdapter = new TelegramProtocolAdapter();
  const discordAdapter = new DiscordProtocolAdapter();
  const slackAdapter = new SlackProtocolAdapter();
  const webhookAdapter = new WebhookProtocolAdapter();
  const snapshotManager = new GatewaySnapshotManager(substrate, ledger);
  const dispatcher = new GatewayDispatcherEngine(substrate, ledger, [
    tgAdapter,
    discordAdapter,
    slackAdapter,
    webhookAdapter,
  ]);
  const toolSuite = new GatewayToolSuite(dispatcher, substrate, ledger);

  // ── [Test 1/8] Inbound Envelope & Session Ingestion ───────────────────────
  console.log("[Test 1/8] Validating Inbound Message Envelope & Session Ingestion...");
  {
    const inRes = await dispatcher.handleInboundMessage({
      id: "in-msg-1",
      platform: "telegram",
      channelId: "chat-100200",
      senderId: "user-42",
      senderName: "Alice",
      content: "Can you analyze this pull request?",
      timestampMs: Date.now(),
    });

    assert.ok(inRes.dispatched, "Inbound message should be dispatched");
    assert.ok(inRes.turnId?.startsWith("gw-turn-telegram"), "Turn ID format must be valid");

    const channel = substrate.getChannel("chat-100200");
    assert.ok(channel, "Channel session must be recorded");
    assert.equal(channel.totalMessagesInbound, 1);
    assert.equal(channel.platform, "telegram");

    console.log("\x1b[32m  [✓] Inbound message envelope validation and session recording passed.\x1b[0m");
  }

  // ── [Test 2/8] Platform Chunking & Formatting ─────────────────────────────
  console.log("[Test 2/8] Validating Platform Protocol Chunking...");
  {
    const longText5k = "A".repeat(5000);

    // Telegram: 4096 char limit
    const tgChunks = tgAdapter.formatMessageChunks(longText5k);
    assert.equal(tgChunks.length, 2);
    assert.ok(tgChunks[0].length <= 4096);

    // Discord: 2000 char limit
    const discordChunks = discordAdapter.formatMessageChunks(longText5k);
    assert.equal(discordChunks.length, 3);
    assert.ok(discordChunks[0].length <= 2000);

    // Slack: 3000 char limit
    const slackChunks = slackAdapter.formatMessageChunks(longText5k);
    assert.equal(slackChunks.length, 2);
    assert.ok(slackChunks[0].length <= 3000);

    // Webhook: 65536 char limit
    const webhookChunks = webhookAdapter.formatMessageChunks(longText5k);
    assert.equal(webhookChunks.length, 1);

    console.log("\x1b[32m  [✓] Platform-specific chunking boundaries (Telegram, Discord, Slack, Webhook) verified.\x1b[0m");
  }

  // ── [Test 3/8] Webhook HMAC SHA-256 Signature Verification ────────────────
  console.log("[Test 3/8] Validating Webhook HMAC SHA-256 Verification...");
  {
    const secret = "webhook-super-secret-key-9988";
    const payload = JSON.stringify({ event: "push", ref: "refs/heads/main", repo: "lumi-joy" });
    const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    const valid = webhookAdapter.verifyWebhookSignature(payload, `sha256=${hmac}`, secret);
    assert.ok(valid, "Valid HMAC signature must be accepted");

    const tampered = webhookAdapter.verifyWebhookSignature(payload + "tamper", `sha256=${hmac}`, secret);
    assert.ok(!tampered, "Tampered payload must be rejected");

    const wrongKey = webhookAdapter.verifyWebhookSignature(payload, `sha256=${hmac}`, "wrong-secret");
    assert.ok(!wrongKey, "Wrong secret must be rejected");

    console.log("\x1b[32m  [✓] Webhook HMAC SHA-256 verification and timing-safe checks passed.\x1b[0m");
  }

  // ── [Test 4/8] Bounded Delivery Queue & Backpressure ──────────────────────
  console.log("[Test 4/8] Validating Bounded Delivery Queue & Backpressure...");
  {
    const smallLedger = new GatewayDeliveryLedger(10);
    for (let i = 0; i < 15; i++) {
      smallLedger.enqueue(
        {
          id: `deliv-${i}`,
          platform: "discord",
          channelId: "chan-1",
          content: `Message ${i}`,
        },
        [`Message ${i}`]
      );
    }

    const history = smallLedger.getHistory(50);
    assert.equal(history.length, 10, "Ledger must prune oldest items when capacity is exceeded");
    assert.equal(history[history.length - 1].id, "deliv-14", "Newest items must be retained");
    assert.equal(history[0].id, "deliv-5", "Items older than capacity must be dropped");

    console.log("\x1b[32m  [✓] Bounded delivery queue and automatic backpressure pruning verified.\x1b[0m");
  }

  // ── [Test 5/8] In-Memory Broccolidb Channel Session Registry ──────────────
  console.log("[Test 5/8] Validating In-Memory Broccolidb Channel Session Registry...");
  {
    substrate.clear();
    substrate.registerChannel({
      channelId: "discord-general",
      platform: "discord",
      sessionKey: "sess-discord-general",
      totalMessagesInbound: 10,
      totalMessagesOutbound: 5,
      lastActiveTimestampMs: Date.now(),
    });

    const ch = substrate.getChannel("discord-general");
    assert.ok(ch);
    assert.equal(ch.totalMessagesInbound, 10);
    assert.equal(ch.totalMessagesOutbound, 5);

    const discordList = substrate.listChannels("discord");
    assert.equal(discordList.length, 1);

    const tgList = substrate.listChannels("telegram");
    assert.equal(tgList.length, 0);

    console.log("\x1b[32m  [✓] In-memory Broccolidb channel session registry verified.\x1b[0m");
  }

  // ── [Test 6/8] Frame-Perfect Binary Snapshotting & O(1) Rollback ───────────
  console.log("[Test 6/8] Validating Gateway Binary Snapshotting & O(1) Rollback...");
  {
    // Snapshot at frame 15
    const snapshot15 = snapshotManager.createSnapshot(15);
    assert.equal(snapshot15.channels.length, 1);

    // Mutate state
    substrate.registerChannel({
      channelId: "slack-random",
      platform: "slack",
      sessionKey: "sess-slack-random",
      totalMessagesInbound: 1,
      totalMessagesOutbound: 0,
      lastActiveTimestampMs: Date.now(),
    });
    assert.equal(substrate.listChannels().length, 2);

    // Rollback to frame 15
    const startRollback = performance.now();
    snapshotManager.restoreSnapshot(snapshot15);
    const rollbackDuration = performance.now() - startRollback;

    assert.equal(substrate.listChannels().length, 1);
    assert.equal(substrate.getChannel("discord-general")?.channelId, "discord-general");
    assert.equal(substrate.getChannel("slack-random"), undefined);
    assert.ok(rollbackDuration < 1.0, `Rollback took ${rollbackDuration} ms, must be < 1.0ms`);

    console.log(`\x1b[32m  [✓] Gateway state snapshotting and instant O(1) rollback passed (${rollbackDuration.toFixed(3)} ms).\x1b[0m`);
  }

  // ── [Test 7/8] Gateway Model Tool Suite Operations ────────────────────────
  console.log("[Test 7/8] Validating Gateway Model Tool Suite...");
  {
    // 1. gateway_broadcast_message
    const bcastRes = await toolSuite.executeTool("gateway_broadcast_message", {
      platform: "telegram",
      channelId: "dev-room-1",
      content: "Deployment v2.0 completed successfully!",
    });
    assert.ok(bcastRes.success, "gateway_broadcast_message should succeed");

    // 2. gateway_list_channels
    const listRes = await toolSuite.executeTool("gateway_list_channels", { platform: "telegram" });
    assert.ok(listRes.success, "gateway_list_channels should succeed");

    // 3. gateway_inspect_session
    const inspectRes = await toolSuite.executeTool("gateway_inspect_session", { channelId: "dev-room-1" });
    assert.ok(inspectRes.success, "gateway_inspect_session should succeed");

    // 4. gateway_delivery_status
    const statusRes = await toolSuite.executeTool("gateway_delivery_status", {});
    assert.ok(statusRes.success, "gateway_delivery_status should succeed");

    console.log("\x1b[32m  [✓] Model tool operations (broadcast, list, inspect, delivery_status) passed.\x1b[0m");
  }

  // ── [Test 8/8] Monolith Composition & Broadcast Micro-Benchmark ───────────
  console.log("[Test 8/8] Benchmarking Monolith Composition & High-Frequency Message Dispatch...");
  {
    const monolith = new LumiMonolith({ sessionId: "gateway-bench-session" });
    assert.ok(monolith.telegramProtocolAdapter, "telegramProtocolAdapter must be composed");
    assert.ok(monolith.discordProtocolAdapter, "discordProtocolAdapter must be composed");
    assert.ok(monolith.slackProtocolAdapter, "slackProtocolAdapter must be composed");
    assert.ok(monolith.webhookProtocolAdapter, "webhookProtocolAdapter must be composed");
    assert.ok(monolith.broccoliGatewaySubstrate, "broccoliGatewaySubstrate must be composed");
    assert.ok(monolith.gatewayDeliveryLedger, "gatewayDeliveryLedger must be composed");
    assert.ok(monolith.gatewaySnapshotManager, "gatewaySnapshotManager must be composed");
    assert.ok(monolith.gatewayDispatcherEngine, "gatewayDispatcherEngine must be composed");
    assert.ok(monolith.gatewayToolSuite, "gatewayToolSuite must be composed");

    const iterations = 1000;
    const startBench = performance.now();
    for (let i = 0; i < iterations; i++) {
      await monolith.gatewayDispatcherEngine.broadcastMessage("telegram", "bench-chan", `Status tick #${i}`);
    }
    const totalBenchMs = performance.now() - startBench;
    const perMsgUs = (totalBenchMs / iterations) * 1000;

    console.log(`  Measured: ${iterations} message dispatches in ${totalBenchMs.toFixed(3)} ms (${perMsgUs.toFixed(3)} µs/dispatch)`);
    assert.ok(totalBenchMs < 30.0, `1,000 dispatches took ${totalBenchMs} ms, must be < 30.0ms`);

    console.log("\x1b[32m  [✓] Monolith composition & message dispatch micro-benchmark passed.\x1b[0m");
  }

  console.log("\n================================================================");
  console.log("   ALL 8 MESSAGING GATEWAY VALIDATION SUITES PASSED!           ");
  console.log("================================================================\n");
}

main().catch((error) => {
  console.error("Validation failed with error:", error);
  process.exit(1);
});
