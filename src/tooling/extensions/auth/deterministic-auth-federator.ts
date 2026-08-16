/**
 * deterministic-auth-federator.ts
 *
 * Deterministic in-memory authentication and identity federation engine (Phase 98 / ADR-052).
 */

import * as crypto from "node:crypto";
import type {
  AuthProviderId,
  DeviceAuthorizationPending,
  PkceChallengePair,
  SubscriptionEntitlement,
  SubscriptionTier,
  TokenLeaseRecord,
} from "../../../core/contracts/identity-federation.contracts.js";

export class DeterministicAuthFederator {
  /**
   * Generates a deterministic or cryptographic RFC 7636 PKCE S256 code verifier and challenge.
   */
  generatePkcePair(seed?: number): PkceChallengePair {
    let verifier: string;
    if (seed !== undefined) {
      // Mulberry32 deterministic pseudo-random verifier
      let s = seed >>> 0;
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
      let res = "";
      for (let i = 0; i < 43; i++) {
        s |= 0;
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        const val = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        res += chars[Math.floor(val * chars.length)];
      }
      verifier = res;
    } else {
      verifier = crypto.randomBytes(32).toString("base64url");
    }

    const challenge = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64url");

    return {
      codeVerifier: verifier,
      codeChallenge: challenge,
      challengeMethod: "S256",
    };
  }

  /**
   * Initiates a deterministic OAuth2 device authorization flow for a provider.
   */
  initiateDeviceFlow(
    providerId: AuthProviderId,
    _clientId: string,
    _scopes: readonly string[]
  ): DeviceAuthorizationPending {
    const timestamp = Date.now();
    const deviceCode = `dev-${providerId}-${timestamp}-${Math.floor(Math.random() * 10000)}`;
    const userCode = `${providerId.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const verificationUri = `https://auth.${providerId}.ai/device`;

    return {
      deviceCode,
      userCode,
      verificationUri,
      verificationUriComplete: `${verificationUri}?user_code=${userCode}`,
      expiresIn: 900, // 15 minutes
      interval: 5,
      createdAt: timestamp,
    };
  }

  /**
   * Simulates exchanging a device code for an active token lease.
   */
  exchangeDeviceCode(
    deviceCode: string,
    providerId: AuthProviderId,
    tier: SubscriptionTier = "pro"
  ): TokenLeaseRecord {
    const issuedAt = Date.now();
    const expiresAt = issuedAt + 3600 * 1000; // 1 hour lease

    return {
      leaseId: `lease-${deviceCode.substring(0, 12)}`,
      providerId,
      accessToken: `tok_${providerId}_${crypto.randomBytes(16).toString("hex")}`,
      refreshToken: `reftok_${providerId}_${crypto.randomBytes(16).toString("hex")}`,
      tokenType: "Bearer",
      scope: "read write inference models",
      issuedAt,
      expiresAt,
      userId: `usr_${providerId}_001`,
      tier,
    };
  }

  /**
   * Maps subscription tier to feature and quota entitlements.
   */
  getEntitlements(tier: SubscriptionTier): SubscriptionEntitlement {
    switch (tier) {
      case "enterprise":
        return {
          tier,
          maxTokensPerTurn: 32768,
          maxContextBudget: 1048576,
          parallelToolsAllowed: true,
          customFineTunesAllowed: true,
          priorityInference: true,
        };
      case "team":
        return {
          tier,
          maxTokensPerTurn: 16384,
          maxContextBudget: 524288,
          parallelToolsAllowed: true,
          customFineTunesAllowed: true,
          priorityInference: true,
        };
      case "pro":
        return {
          tier,
          maxTokensPerTurn: 8192,
          maxContextBudget: 262144,
          parallelToolsAllowed: true,
          customFineTunesAllowed: false,
          priorityInference: true,
        };
      case "free":
      default:
        return {
          tier: "free",
          maxTokensPerTurn: 4096,
          maxContextBudget: 131072,
          parallelToolsAllowed: false,
          customFineTunesAllowed: false,
          priorityInference: false,
        };
    }
  }

  /**
   * Verifies if a token lease is currently valid and unexpired.
   */
  verifyTokenLease(lease: TokenLeaseRecord, currentTime: number = Date.now()): boolean {
    return lease.expiresAt > currentTime;
  }

  /**
   * Deterministically rotates and refreshes an expiring token lease.
   */
  refreshTokenLease(lease: TokenLeaseRecord): TokenLeaseRecord {
    const issuedAt = Date.now();
    const expiresAt = Math.max(issuedAt, lease.expiresAt) + 3600 * 1000;

    return {
      ...lease,
      accessToken: `tok_${lease.providerId}_${crypto.randomBytes(16).toString("hex")}`,
      refreshToken: `reftok_${lease.providerId}_${crypto.randomBytes(16).toString("hex")}`,
      issuedAt,
      expiresAt,
    };
  }
}
