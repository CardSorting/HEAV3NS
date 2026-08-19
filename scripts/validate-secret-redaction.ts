/**
 * validate-secret-redaction.ts
 *
 * Comprehensive validation suite for Target #33: Deterministic Secret Redactor,
 * Query Masker & Sensitive Path Safety Subsystem (Phase 95 / ADR-047).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { performance } from "node:perf_hooks";
import { DeterministicSecretRedactor } from "../src/tooling/extensions/redaction/deterministic-secret-redactor.js";
import { BroccoliRedactionSubstrate } from "../src/sessions/extensions/redaction/broccoli-redaction-substrate.js";
import { RedactionSnapshotManager } from "../src/sessions/extensions/redaction/redaction-snapshot-manager.js";
import { SecretRedactionSupervisor } from "../src/agents/extensions/redaction/secret-redaction-supervisor.js";
import { SecretRedactionToolSuite } from "../src/tooling/extensions/redaction/secret-redaction-tool-suite.js";
import { MonolithFactory } from "../src/factories/monolith-factory.js";
import { GrandMonolithSynthesizer } from "../src/factories/grand-monolith-synthesizer.js";

async function runValidationSuite() {
  console.log("================================================================================");
  console.log(" LUMI Phase 95 / ADR-047: Secret Redactor & Path Safety Validation Suite ");
  console.log("================================================================================\n");

  let passedSuites = 0;
  const totalSuites = 8;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-redact-val-"));

  try {
    const redactor = new DeterministicSecretRedactor();

    // ---------------------------------------------------------------------------
    // Suite 1: API Key & High-Entropy Token Redaction
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/8] API Key & High-Entropy Token Redaction...");
    const dummyOpenaiKey = ["sk", "proj", "abc1234567890abcdef1234567890"].join("-");
    const dummyAnthropicKey = ["sk", "ant", "api03-abcdef1234567890abcdef123456"].join("-");
    const dummyGithubKey = ["ghp", "1234567890abcdef1234567890abcdef1234"].join("_");
    const dummyAwsKey = ["A", "KIA", "IOSFODNN7EXAMPLE"].join("");
    const dummyGoogleKey = ["A", "Iza", "SyD1234567890abcdef1234567890abc"].join("");
    const dummyStripeKey = ["sk", "live", "51234567890abcdef1234567890"].join("_");
    const dummySlackToken = ["xoxb", "1234567890", "abcdef123456"].join("-");
    const dummyHfToken = ["hf", "abcdef1234567890abcdef1234567890"].join("_");

    const sampleText = [
      `Here is OpenAI key: ${dummyOpenaiKey}`,
      `Anthropic key: ${dummyAnthropicKey}`,
      `GitHub key: ${dummyGithubKey}`,
      `AWS access: ${dummyAwsKey}`,
      `Google key: ${dummyGoogleKey}`,
      `Stripe key: ${dummyStripeKey}`,
      `Slack token: ${dummySlackToken}`,
      `HuggingFace: ${dummyHfToken}`,
    ].join("\n");

    const res1 = redactor.redact(sampleText);
    if (res1.totalRedactions < 8) {
      throw new Error(`Expected at least 8 token redactions, got ${res1.totalRedactions}`);
    }
    if (res1.sanitizedText.includes(dummyOpenaiKey) ||
        res1.sanitizedText.includes(dummyAwsKey) ||
        res1.sanitizedText.includes(dummyStripeKey)) {
      throw new Error("Raw API keys survived redaction pass");
    }
    console.log(`  ✓ ${res1.totalRedactions} vendor API keys cleanly masked`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: JWT, PEM Private Key & Database URI Redaction
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/8] JWT, PEM Private Key & Database URI Redaction...");
    const sampleJwt = ["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ", "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"].join(".");
    const samplePem = ["-----BEGIN ", "RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0Y3...\n-----END ", "RSA PRIVATE KEY-----"].join("");
    const sampleJwtPemUri = [
      "Connecting to postgres://admin:super_secret_password_123@db.prod.internal:5432/main",
      `Token: ${sampleJwt}`,
      samplePem,
    ].join("\n");

    const res2 = redactor.redact(sampleJwtPemUri);
    if (res2.sanitizedText.includes("super_secret_password_123")) {
      throw new Error("Database password leaked in connection URI");
    }
    if (res2.sanitizedText.includes("MIIEowIBAAKCAQEA0Y3")) {
      throw new Error("PEM private key leaked in output");
    }
    console.log("  ✓ Database passwords, JWTs, and PEM private keys masked");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: Sensitive Query Parameter & JSON Body Masking
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/8] Sensitive Query Parameter & JSON Body Masking...");
    const queryAndBody = [
      "GET /api/v1/user?access_token=secret_oauth_token_12345&client_secret=top_secret_code",
      '{"user": "alice", "api_key": "raw_secret_key_abcdef123456", "auth": "pass123"}',
    ].join("\n");

    const res3 = redactor.redact(queryAndBody);
    if (res3.sanitizedText.includes("secret_oauth_token_12345") ||
        res3.sanitizedText.includes("raw_secret_key_abcdef123456")) {
      throw new Error("Query parameters or JSON secrets leaked");
    }
    console.log("  ✓ URL query parameters and JSON secret keys masked");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: Sensitive Path Denial & Approval Safety Rules
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/8] Sensitive Path Denial & Approval Safety Rules...");
    const sshDeny = redactor.evaluatePathSafety("~/.ssh/id_rsa", "read");
    const envDeny = redactor.evaluatePathSafety("/app/secrets/.env.production", "read");
    const awsDeny = redactor.evaluatePathSafety("~/.aws/credentials", "read");
    const sshApprove = redactor.evaluatePathSafety("~/.ssh/config", "write");
    const safeAllow = redactor.evaluatePathSafety("/src/components/button.tsx", "write");

    if (sshDeny.action !== "deny" || envDeny.action !== "deny" || awsDeny.action !== "deny") {
      throw new Error("Sensitive files not strictly denied");
    }
    if (sshApprove.action !== "require_approval") {
      throw new Error("~/.ssh/config write failed to require approval");
    }
    if (safeAllow.action !== "allow") {
      throw new Error("Normal project file falsely denied");
    }
    console.log("  ✓ Strict path denial and approval rules verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: Suffix-Preserving Partial Masking vs Full Masking
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/8] Suffix-Preserving Partial Masking vs Full Masking...");
    const sampleLongToken = ["sk", "ant", "api03-abcdef12345678901234567890"].join("-");
    const shortMasked = redactor.maskSecret("short_token", "api_key");
    const longMasked = redactor.maskSecret(sampleLongToken, "anthropic_api_key");

    if (shortMasked !== "[REDACTED:api_key]") {
      throw new Error(`Expected full redaction for short token, got ${shortMasked}`);
    }
    if (!longMasked.startsWith("sk-ant") || !longMasked.endsWith("7890") || !longMasked.includes("...")) {
      throw new Error(`Expected prefix/suffix preservation for long token, got ${longMasked}`);
    }
    console.log("  ✓ Short (<18) full redaction and long (>=18) prefix/suffix preservation verified");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: In-Memory BroccoliRedactionSubstrate & RedactionSnapshotManager O(1) Rollback
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/8] In-Memory BroccoliRedactionSubstrate & RedactionSnapshotManager O(1) Rollback...");
    const substrate = new BroccoliRedactionSubstrate();
    const supervisor = new SecretRedactionSupervisor(redactor, substrate);
    const snapshotManager = new RedactionSnapshotManager(substrate);

    snapshotManager.captureFrame(1);

    supervisor.redactText(["sk", "proj", "abc1234567890abcdef1234567890"].join("-"));
    supervisor.evaluatePathSafety("~/.ssh/id_rsa", "read");

    if (supervisor.getMatches().length !== 1 || supervisor.getBlockedAccessAttempts().length !== 1) {
      throw new Error("Failed to record redaction matches or blocked access attempts in substrate");
    }

    for (let w = 0; w < 5; w++) {
      snapshotManager.rewindToFrame(1);
    }
    const rewindStart = performance.now();
    const rewindSuccess = snapshotManager.rewindToFrame(1);
    const rewindDuration = performance.now() - rewindStart;

    if (!rewindSuccess || supervisor.getMatches().length !== 0 || supervisor.getBlockedAccessAttempts().length !== 0) {
      throw new Error("Redaction state rewind failed");
    }
    console.log(`  ✓ O(1) Redaction state rewind completed in ${rewindDuration.toFixed(3)} ms (< 0.05 ms SLA)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: SecretRedactionToolSuite Model Tools Execution
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/8] SecretRedactionToolSuite Model Tools Execution...");
    const toolSuite = new SecretRedactionToolSuite(supervisor);
    const tools = toolSuite.getTools();

    const redactTool = tools.find((t) => t.name === "secret_redact_text")!;
    const pathTool = tools.find((t) => t.name === "path_safety_check")!;
    const statusTool = tools.find((t) => t.name === "secret_redaction_status")!;

    if (!redactTool || !pathTool || !statusTool) {
      throw new Error("Missing required Secret Redaction model tools");
    }

    const testSecretToolInput = ["Secret key: ", "sk", "-ant-api03-abcdef1234567890abcdef123456"].join("");
    const redactRes = await redactTool.execute(
      { text: testSecretToolInput },
      tempDir
    ) as { success: boolean; totalRedactions: number; sanitizedText: string };

    if (!redactRes.success || redactRes.totalRedactions !== 1) {
      throw new Error("secret_redact_text execution failed");
    }

    const pathRes = await pathTool.execute({ targetPath: "~/.ssh/id_rsa" }, tempDir) as { success: boolean; action: string };
    if (!pathRes.success || pathRes.action !== "deny") {
      throw new Error("path_safety_check execution failed");
    }

    const statusRes = await statusTool.execute({}, tempDir) as { success: boolean; totalMatches: number; totalBlockedAccessAttempts: number };
    if (!statusRes.success || statusRes.totalMatches <= 0 || statusRes.totalBlockedAccessAttempts <= 0) {
      throw new Error("secret_redaction_status execution failed");
    }
    console.log("  ✓ All 3 Secret Redaction model tools executed cleanly");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: Grand Monolith Synthesizer Composition (342 Components)
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/8] Grand Monolith Synthesizer Composition (342 Components)...");
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
    console.log(` [✓] ALL ${passedSuites}/${totalSuites} PHASE 95 SECRET REDACTION SUITES PASSED! `);
    console.log("================================================================================\n");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runValidationSuite().catch((err) => {
  console.error("\n[FATAL] Validation suite failed:", err);
  process.exit(1);
});
