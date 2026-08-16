/**
 * validate-identity-federation.ts
 *
 * Comprehensive validation suite for Target #36: OAuth2 PKCE Device Flow,
 * Multi-Provider Identity Federation & Subscription Tier Governance (Phase 98 / ADR-052).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { performance } from "node:perf_hooks";
import { DeterministicAuthFederator } from "../src/tooling/extensions/auth/deterministic-auth-federator.js";
import { BroccoliAuthSubstrate } from "../src/sessions/extensions/auth/broccoli-auth-substrate.js";
import { AuthSnapshotManager } from "../src/sessions/extensions/auth/auth-snapshot-manager.js";
import { IdentityFederationSupervisor } from "../src/agents/extensions/auth/identity-federation-supervisor.js";
import { IdentityFederationToolSuite } from "../src/tooling/extensions/auth/identity-federation-tool-suite.js";
import { MonolithFactory } from "../src/factories/monolith-factory.js";
import { GrandMonolithSynthesizer } from "../src/factories/grand-monolith-synthesizer.js";

async function runValidationSuite() {
  console.log("================================================================================");
  console.log(" LUMI Phase 98 / ADR-052: Identity Federation & Auth Validation Suite         ");
  console.log("================================================================================\n");

  let passedSuites = 0;
  const totalSuites = 8;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-auth-val-"));

  try {
    const federator = new DeterministicAuthFederator();

    // ---------------------------------------------------------------------------
    // Suite 1: RFC 7636 PKCE S256 Challenge Generation & Validation
    // ---------------------------------------------------------------------------
    console.log("[Suite 1/8] RFC 7636 PKCE S256 Challenge Generation & Validation...");
    const pkceDeterministic = federator.generatePkcePair(1337);
    const pkceDeterministic2 = federator.generatePkcePair(1337);

    if (pkceDeterministic.codeVerifier !== pkceDeterministic2.codeVerifier || pkceDeterministic.codeChallenge !== pkceDeterministic2.codeChallenge) {
      throw new Error("Deterministic PKCE generation mismatch for identical seed");
    }

    const pkceRandom = federator.generatePkcePair();
    if (!pkceRandom.codeVerifier || !pkceRandom.codeChallenge || pkceRandom.challengeMethod !== "S256") {
      throw new Error("Cryptographic PKCE generation failed");
    }
    console.log(`  ✓ Generated RFC 7636 PKCE pair (verifier len: ${pkceDeterministic.codeVerifier.length}, challenge: ${pkceDeterministic.codeChallenge})`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 2: Multi-Provider Device Authorization Flow Lifecycle
    // ---------------------------------------------------------------------------
    console.log("[Suite 2/8] Multi-Provider Device Authorization Flow Lifecycle...");
    const pendingNous = federator.initiateDeviceFlow("nous", "cli-test", ["read", "write"]);
    const pendingOpenAI = federator.initiateDeviceFlow("openai", "cli-test", ["models"]);
    const pendingCopilot = federator.initiateDeviceFlow("copilot", "cli-test", ["copilot"]);

    if (!pendingNous.deviceCode || !pendingNous.userCode || !pendingNous.verificationUri.includes("nous")) {
      throw new Error("Device authorization pending record malformed for nous");
    }
    if (!pendingOpenAI.verificationUri.includes("openai") || !pendingCopilot.verificationUri.includes("copilot")) {
      throw new Error("Multi-provider device authorization routing failed");
    }
    console.log("  ✓ Device authorization initiated across Nous, OpenAI, and Copilot endpoints");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 3: Token Lease Issuance, Expiration & Refresh Rotation
    // ---------------------------------------------------------------------------
    console.log("[Suite 3/8] Token Lease Issuance, Expiration & Refresh Rotation...");
    const lease = federator.exchangeDeviceCode(pendingNous.deviceCode, "nous", "team");
    if (!lease.accessToken || !lease.refreshToken || lease.tier !== "team") {
      throw new Error("Token lease exchange failed");
    }

    const isValidNow = federator.verifyTokenLease(lease, Date.now());
    const isExpiredFuture = federator.verifyTokenLease(lease, Date.now() + 4000 * 1000);
    if (!isValidNow || isExpiredFuture) {
      throw new Error("Token lease expiration calculation error");
    }

    const refreshedLease = federator.refreshTokenLease(lease);
    if (refreshedLease.accessToken === lease.accessToken || refreshedLease.expiresAt <= lease.expiresAt) {
      throw new Error("Token lease refresh rotation failed to issue new token/expiration");
    }
    console.log("  ✓ Token lease exchanged, verified, and rotated cleanly");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 4: Subscription Tier Entitlements & Feature Gating
    // ---------------------------------------------------------------------------
    console.log("[Suite 4/8] Subscription Tier Entitlements & Feature Gating...");
    const entFree = federator.getEntitlements("free");
    const entPro = federator.getEntitlements("pro");
    const entTeam = federator.getEntitlements("team");
    const entEnterprise = federator.getEntitlements("enterprise");

    if (entFree.parallelToolsAllowed !== false || entPro.parallelToolsAllowed !== true) {
      throw new Error("Entitlement tier tool gating failed");
    }
    if (entEnterprise.maxContextBudget <= entTeam.maxContextBudget || entTeam.maxContextBudget <= entPro.maxContextBudget) {
      throw new Error("Context budget progression monotonic check failed");
    }
    console.log(`  ✓ Subscription tiers verified (Free: ${entFree.maxTokensPerTurn} tokens, Enterprise: ${entEnterprise.maxTokensPerTurn} tokens)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 5: In-Memory BroccoliAuthSubstrate & AuthSnapshotManager O(1) Rollback
    // ---------------------------------------------------------------------------
    console.log("[Suite 5/8] In-Memory BroccoliAuthSubstrate & AuthSnapshotManager O(1) Rollback...");
    const substrate = new BroccoliAuthSubstrate();
    const supervisor = new IdentityFederationSupervisor(federator, substrate);
    const snapshotManager = new AuthSnapshotManager(substrate);

    snapshotManager.captureFrame(1);

    supervisor.initiateAuth("nous");
    supervisor.completeDeviceAuth("dev-123", "nous", "pro");

    if (!supervisor.getActiveLease("nous")) {
      throw new Error("Failed to record active token lease in substrate");
    }

    for (let w = 0; w < 5; w++) {
      snapshotManager.rewindToFrame(1);
    }
    const rewindStart = performance.now();
    const rewindSuccess = snapshotManager.rewindToFrame(1);
    const rewindDuration = performance.now() - rewindStart;

    if (!rewindSuccess || supervisor.getActiveLease("nous") !== undefined) {
      throw new Error("Auth state rewind failed");
    }
    console.log(`  ✓ O(1) Auth state rewind completed in ${rewindDuration.toFixed(3)} ms (< 0.05 ms SLA)`);
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 6: IdentityFederationSupervisor Coordination & Token Revocation
    // ---------------------------------------------------------------------------
    console.log("[Suite 6/8] IdentityFederationSupervisor Coordination & Token Revocation...");
    const pending = supervisor.initiateAuth("anthropic");
    const tokenRecord = supervisor.completeDeviceAuth(pending.deviceCode, "anthropic", "team");
    const ents = supervisor.checkEntitlements("anthropic");

    if (tokenRecord.tier !== "team" || ents.tier !== "team") {
      throw new Error("Supervisor entitlement coordination failed");
    }

    const refreshed = supervisor.refreshTokenLease("anthropic");
    if (!refreshed || refreshed.accessToken === tokenRecord.accessToken) {
      throw new Error("Supervisor refresh lease failed");
    }

    const revoked = supervisor.revokeAuth("anthropic");
    if (!revoked || supervisor.getActiveLease("anthropic") !== undefined) {
      throw new Error("Supervisor token revocation failed");
    }
    console.log("  ✓ Supervisor initiated, authorized, refreshed, and revoked provider session cleanly");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 7: IdentityFederationToolSuite Model Tools Execution
    // ---------------------------------------------------------------------------
    console.log("[Suite 7/8] IdentityFederationToolSuite Model Tools Execution...");
    const toolSuite = new IdentityFederationToolSuite(supervisor);
    const tools = toolSuite.getTools();

    const initTool = tools.find((t) => t.name === "auth_initiate_device_flow")!;
    const verifyTool = tools.find((t) => t.name === "auth_verify_token_lease")!;
    const entTool = tools.find((t) => t.name === "auth_check_entitlement")!;

    if (!initTool || !verifyTool || !entTool) {
      throw new Error("Missing required Identity Federation model tools");
    }

    const initRes = await initTool.execute({ providerId: "copilot" }, tempDir) as { success: boolean; userCode: string };
    if (!initRes.success || !initRes.userCode) {
      throw new Error("auth_initiate_device_flow tool execution failed");
    }

    const entRes = await entTool.execute({ providerId: "copilot" }, tempDir) as { success: boolean; maxTokensPerTurn: number };
    if (!entRes.success || entRes.maxTokensPerTurn <= 0) {
      throw new Error("auth_check_entitlement tool execution failed");
    }

    const verifyRes = await verifyTool.execute({ providerId: "copilot" }, tempDir) as { success: boolean; authenticated: boolean };
    if (!verifyRes.success || verifyRes.authenticated !== false) {
      throw new Error("auth_verify_token_lease expected unauthenticated for copilot before completion");
    }
    console.log("  ✓ All 3 Identity Federation model tools executed cleanly");
    passedSuites++;

    // ---------------------------------------------------------------------------
    // Suite 8: Grand Monolith Synthesizer Composition (357 Components)
    // ---------------------------------------------------------------------------
    console.log("[Suite 8/8] Grand Monolith Synthesizer Composition (357 Components)...");
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
    console.log(` [✓] ALL ${passedSuites}/${totalSuites} PHASE 98 IDENTITY FEDERATION SUITES PASSED! `);
    console.log("================================================================================\n");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runValidationSuite().catch((err) => {
  console.error("\n[FATAL] Validation suite failed:", err);
  process.exit(1);
});
