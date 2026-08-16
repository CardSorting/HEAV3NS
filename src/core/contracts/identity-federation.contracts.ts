/**
 * identity-federation.contracts.ts
 *
 * Core contracts for OAuth2 PKCE Device Flow, Multi-Provider Identity Federation,
 * and Subscription Tier Governance (Phase 98 / ADR-052).
 */

export type AuthProviderId = "nous" | "openai" | "anthropic" | "copilot" | "custom";

export type AuthFlowType = "pkce_device_flow" | "authorization_code" | "api_key" | "jwt_bearer";

export type SubscriptionTier = "free" | "pro" | "team" | "enterprise";

export interface PkceChallengePair {
  readonly codeVerifier: string;
  readonly codeChallenge: string;
  readonly challengeMethod: "S256";
}

export interface DeviceAuthorizationPending {
  readonly deviceCode: string;
  readonly userCode: string;
  readonly verificationUri: string;
  readonly verificationUriComplete?: string;
  readonly expiresIn: number;
  readonly interval: number;
  readonly createdAt: number;
}

export interface TokenLeaseRecord {
  readonly leaseId: string;
  readonly providerId: AuthProviderId;
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly tokenType: string;
  readonly scope: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly userId?: string;
  readonly tier: SubscriptionTier;
}

export interface SubscriptionEntitlement {
  readonly tier: SubscriptionTier;
  readonly maxTokensPerTurn: number;
  readonly maxContextBudget: number;
  readonly parallelToolsAllowed: boolean;
  readonly customFineTunesAllowed: boolean;
  readonly priorityInference: boolean;
}

export interface AuthWorkspaceSnapshot {
  readonly totalTokens: number;
  readonly activeLeases: readonly TokenLeaseRecord[];
  readonly pendingAuthorizations: readonly DeviceAuthorizationPending[];
  readonly timestamp: number;
}
