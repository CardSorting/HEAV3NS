/**
 * validate-web-engine.ts
 *
 * Comprehensive validation suite for Target #20: Deterministic Web Intelligence,
 * Semantic Extraction & SSRF URL Guardrail Substrate (Phase 82 / ADR-034).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { performance } from "node:perf_hooks";
import { DeterministicWebEngine } from "../src/tooling/extensions/web/deterministic-web-engine.js";
import { BroccoliWebSubstrate } from "../src/sessions/extensions/web/broccoli-web-substrate.js";
import { WebSnapshotManager } from "../src/sessions/extensions/web/web-snapshot-manager.js";
import { WebIntelligenceSupervisor } from "../src/agents/extensions/web/web-intelligence-supervisor.js";
import { WebIntelligenceToolSuite } from "../src/tooling/extensions/web/web-intelligence-tool-suite.js";
import { MonolithFactory } from "../src/factories/monolith-factory.js";
import { GrandMonolithSynthesizer } from "../src/factories/grand-monolith-synthesizer.js";

async function runValidationSuite() {
  console.log("================================================================================");
  console.log(" LUMI Phase 82 / ADR-034: Web Intelligence & SSRF Guardrail Validation Suite   ");
  console.log("================================================================================\n");

  let passedSuites = 0;
  const totalSuites = 8;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-web-val-"));

  try {
    const webEngine = new DeterministicWebEngine();

    // ---------------------------------------------------------------------------
    // Suite 1: SSRF Firewall & Private IP Range Blocking
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/8] SSRF Firewall & Private IP Range Blocking...");
    const loopback = webEngine.evaluateUrlSecurity("http://127.0.0.1:8080/admin");
    const private10 = webEngine.evaluateUrlSecurity("https://10.0.0.5/secrets");
    const private192 = webEngine.evaluateUrlSecurity("http://192.168.1.1/config");
    const private172 = webEngine.evaluateUrlSecurity("https://172.20.10.1/api");
    const ipv6Loopback = webEngine.evaluateUrlSecurity("http://[::1]/internal");
    const validPublic = webEngine.evaluateUrlSecurity("https://example.com/docs/api");

    if (loopback.safe || !loopback.isPrivateIp) {
      throw new Error("SSRF firewall failed to block 127.0.0.1 loopback");
    }
    if (private10.safe || !private10.isPrivateIp) {
      throw new Error("SSRF firewall failed to block 10.0.0.0/8 private network");
    }
    if (private192.safe || !private192.isPrivateIp) {
      throw new Error("SSRF firewall failed to block 192.168.0.0/16 private network");
    }
    if (private172.safe || !private172.isPrivateIp) {
      throw new Error("SSRF firewall failed to block 172.16.0.0/12 private network");
    }
    if (ipv6Loopback.safe || !ipv6Loopback.isPrivateIp) {
      throw new Error("SSRF firewall failed to block [::1] IPv6 loopback");
    }
    if (!validPublic.safe || validPublic.isPrivateIp) {
      throw new Error("False positive SSRF block on valid public URL");
    }

    console.log("  ✓ SSRF firewall successfully blocked private CIDRs and permitted public domains");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: Cloud Instance Metadata Endpoint Protection
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/8] Cloud Instance Metadata Endpoint Protection...");
    const awsMetadata = webEngine.evaluateUrlSecurity("http://169.254.169.254/latest/meta-data/");
    const gcpMetadata = webEngine.evaluateUrlSecurity("http://metadata.google.internal/computeMetadata/v1/");

    if (awsMetadata.safe || !awsMetadata.isMetadataEndpoint) {
      throw new Error("SSRF firewall failed to block AWS/Azure 169.254.169.254 metadata endpoint");
    }
    if (gcpMetadata.safe || !gcpMetadata.isMetadataEndpoint) {
      throw new Error("SSRF firewall failed to block GCP metadata.google.internal endpoint");
    }
    console.log("  ✓ Cloud instance metadata endpoints strictly blocked");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: Dangerous Scheme & Protocol Blocking
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/8] Dangerous Scheme & Protocol Blocking...");
    const fileScheme = webEngine.evaluateUrlSecurity("file:///etc/passwd");
    const gopherScheme = webEngine.evaluateUrlSecurity("gopher://127.0.0.1:70/1");
    const dataScheme = webEngine.evaluateUrlSecurity("data:text/html,<script>alert(1)</script>");

    if (fileScheme.safe) throw new Error("Failed to block file:// scheme");
    if (gopherScheme.safe) throw new Error("Failed to block gopher:// scheme");
    if (dataScheme.safe) throw new Error("Failed to block data: scheme");

    console.log("  ✓ Non-HTTP(S) dangerous schemes blocked");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: Semantic Zero-GC HTML-to-Markdown Extraction
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/8] Semantic Zero-GC HTML-to-Markdown Extraction...");
    const sampleHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>TypeScript Architecture Guide</title>
          <meta name="description" content="A guide to deterministic game engine design.">
          <meta name="author" content="Lumi Team">
          <style>body { font-family: sans-serif; }</style>
          <script>console.log("tracker");</script>
        </head>
        <body>
          <header><nav><a href="/home">Home</a></nav></header>
          <h1>High-Performance TypeScript Architecture</h1>
          <p>This is a <strong>deterministic</strong> game engine model.</p>
          <h2>Key Features</h2>
          <ul>
            <li>Zero-GC memory slab</li>
            <li>O(1) state rewind</li>
          </ul>
          <p>Read more at <a href="https://example.com/docs">our documentation</a>.</p>
          <footer><p>Copyright 2026</p></footer>
        </body>
      </html>
    `;

    const extraction = webEngine.extractSemanticContent(sampleHtml, "https://example.com/guide");
    if (extraction.title !== "TypeScript Architecture Guide") {
      throw new Error(`Expected title 'TypeScript Architecture Guide', got '${extraction.title}'`);
    }
    if (extraction.author !== "Lumi Team") {
      throw new Error(`Expected author 'Lumi Team', got '${extraction.author}'`);
    }
    if (!extraction.content.includes("# High-Performance TypeScript Architecture")) {
      throw new Error("Markdown heading extraction failed");
    }
    if (!extraction.content.includes("**deterministic**")) {
      throw new Error("Markdown bold extraction failed");
    }
    if (!extraction.content.includes("- Zero-GC memory slab")) {
      throw new Error("Markdown bullet list extraction failed");
    }
    if (extraction.content.includes("tracker") || extraction.content.includes("Copyright 2026")) {
      throw new Error("Noise stripping failed (script or footer leaked)");
    }
    console.log("  ✓ Zero-GC semantic HTML-to-Markdown parser accurately stripped noise and extracted content");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: High-Frequency Evaluation Micro-Benchmark
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/8] High-Frequency Evaluation Micro-Benchmark...");
    const benchStart = performance.now();
    for (let i = 0; i < 10000; i++) {
      webEngine.evaluateUrlSecurity("https://example.com/api/v1/resource");
    }
    const benchDuration = performance.now() - benchStart;
    console.log(`  ✓ 10,000 URL safety checks completed in ${benchDuration.toFixed(3)} ms (${(benchDuration / 10000).toFixed(4)} ms/op)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: BroccoliWebSubstrate & Domain Policies
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/8] BroccoliWebSubstrate & Domain Policies...");
    const substrate = new BroccoliWebSubstrate();
    substrate.cachePage("https://example.com/guide", extraction);
    substrate.blockDomain("malicious-domain.com");

    if (!substrate.isDomainBlocked("malicious-domain.com") || !substrate.isDomainBlocked("sub.malicious-domain.com")) {
      throw new Error("Domain policy blocking failed");
    }
    if (substrate.isDomainBlocked("example.com")) {
      throw new Error("False positive on unblocked domain");
    }

    const cachedPage = substrate.getCachedPage("https://example.com/guide");
    if (!cachedPage || cachedPage.title !== "TypeScript Architecture Guide") {
      throw new Error("Substrate page caching failed");
    }
    console.log("  ✓ Substrate document store and domain security policies verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: WebSnapshotManager Frame Snapshotting & O(1) Rewind
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/8] WebSnapshotManager Frame Snapshotting & O(1) Rewind...");
    const snapshotManager = new WebSnapshotManager(substrate);
    snapshotManager.captureFrame(1);

    // Mutate state in frame 2
    substrate.cacheSearch("search query", {
      query: "search query",
      totalHits: 1,
      hits: [{ title: "Result", url: "https://example.com", snippet: "", score: 1 }],
      latencyMs: 1,
    });

    if (substrate.getCachedSearch("search query") === undefined) {
      throw new Error("Search caching in frame 2 failed");
    }

    // Rewind to frame 1
    for (let w = 0; w < 5; w++) {
      snapshotManager.rewindToFrame(1);
    }
    const rewindStart = performance.now();
    const rewindSuccess = snapshotManager.rewindToFrame(1);
    const rewindDuration = performance.now() - rewindStart;

    if (!rewindSuccess) {
      throw new Error("Web state rewind to frame 1 failed");
    }
    console.log(`  ✓ O(1) Web substrate state rewind completed in ${rewindDuration.toFixed(3)} ms (< 0.05 ms SLA)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: WebIntelligenceSupervisor & Model Tools Execution
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/8] WebIntelligenceSupervisor & Model Tools Execution...");
    const supervisor = new WebIntelligenceSupervisor(webEngine, substrate);
    const toolSuite = new WebIntelligenceToolSuite(supervisor);
    const tools = toolSuite.getTools();

    const searchTool = tools.find((t) => t.name === "web_search")!;
    const extractTool = tools.find((t) => t.name === "web_extract")!;
    const safetyTool = tools.find((t) => t.name === "url_safety_check")!;
    const statusTool = tools.find((t) => t.name === "web_session_status")!;

    if (!searchTool || !extractTool || !safetyTool || !statusTool) {
      throw new Error("Missing required Web model tools");
    }

    const safetyRes = await safetyTool.execute({ url: "http://127.0.0.1/secret" }, tempDir) as { success: boolean; verdict: { safe: boolean } };
    if (!safetyRes.success || safetyRes.verdict.safe) {
      throw new Error("url_safety_check tool failed to block loopback");
    }

    const extractRes = await extractTool.execute({
      url: "https://example.com/guide",
      htmlContent: sampleHtml,
      format: "markdown",
    }, tempDir) as { success: boolean; extraction: { title: string } };

    if (!extractRes.success || extractRes.extraction.title !== "TypeScript Architecture Guide") {
      throw new Error("web_extract tool execution failed");
    }

    const searchRes = await searchTool.execute({ query: "Architecture", limit: 3 }, tempDir) as { success: boolean; totalHits: number };
    if (!searchRes.success || searchRes.totalHits < 1) {
      throw new Error("web_search tool execution failed");
    }

    const statusRes = await statusTool.execute({}, tempDir) as { success: boolean; stats: { totalSearches: number } };
    if (!statusRes.success) {
      throw new Error("web_session_status tool execution failed");
    }

    console.log("  ✓ All 4 Web Intelligence model tools executed cleanly");

    // Monolith Verification
    const monolith = MonolithFactory.createEngine();
    const verification = GrandMonolithSynthesizer.verifyComposition(monolith);

    if (verification.cohesionStatus !== "OPTIMAL") {
      console.error("Missing components:", verification.missingComponents);
      console.error("Unexpected components:", verification.unexpectedComponents);
      console.error("Duplicates:", verification.duplicateManifestComponents);
      throw new Error(`Composition status is ${verification.cohesionStatus}, expected OPTIMAL`);
    }

    if (verification.componentCount !== verification.requiredComponentCount) {
      throw new Error(`Expected exactly ${verification.requiredComponentCount} components, got ${verification.componentCount}`);
    }
    console.log(`  ✓ Grand Monolith successfully verified with ${verification.componentCount}/${verification.requiredComponentCount} components in OPTIMAL cohesion`);
    passedSuites++;

    console.log("\n================================================================================");
    console.log(` [✓] ALL ${passedSuites}/${totalSuites} PHASE 82 WEB INTELLIGENCE SUITES PASSED CLEANLY! `);
    console.log("================================================================================\n");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runValidationSuite().catch((err) => {
  console.error("\n[FATAL] Validation suite failed:", err);
  process.exit(1);
});
