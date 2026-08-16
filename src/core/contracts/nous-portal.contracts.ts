/**
 * Native Nous Portal Provider, Attribution Tagging & Tool-Pool Entitlement Contracts
 * Reference: hermes-agent-main/agent/portal_tags.py, hermes_cli/nous_account.py, hermes_cli/auth.py
 * Subsystem: Target #73 / ADR-116
 */

export const DEFAULT_NOUS_PORTAL_URL = "https://portal.nousresearch.com";
export const DEFAULT_NOUS_INFERENCE_URL = "https://inference-api.nousresearch.com/v1";
export const DEFAULT_NOUS_CLIENT_ID = "lumi-cli";
export const NOUS_INFERENCE_INVOKE_SCOPE = "inference:invoke";
export const NOUS_BILLING_MANAGE_SCOPE = "billing:manage";
export const DEFAULT_NOUS_SCOPE = "inference:invoke billing:manage";

export type NousAccountInfoSource = "jwt" | "account_api" | "inference_key" | "none" | "error";

export const NOUS_TOOL_COVERAGE_CATEGORIES = [
  "firecrawl",
  "fal",
  "fal-video",
  "openai-audio",
  "browser-use",
  "modal",
] as const;

export type NousToolCoverageCategory = (typeof NOUS_TOOL_COVERAGE_CATEGORIES)[number];

export interface NousPortalSubscriptionInfo {
  plan?: string;
  tier?: number;
  monthlyCharge?: number;
  monthlyCredits?: number;
  currentPeriodEnd?: string;
  creditsRemaining?: number;
  rolloverCredits?: number;
}

export interface NousPaidServiceAccessInfo {
  allowed?: boolean;
  paidAccess?: boolean;
  reason?: string;
  organisationId?: string;
  effectiveAtMs?: number;
  hasActiveSubscription?: boolean;
  activeSubscriptionIsPaid?: boolean;
  subscriptionTier?: number;
  subscriptionMonthlyCharge?: number;
  subscriptionCreditsRemaining?: number;
  purchasedCreditsRemaining?: number;
  totalUsableCredits?: number;
  memberSpendCapExceeded?: boolean;
  memberSpendCapUsd?: number;
  memberSpendUsd?: number;
  memberSpendCapRemainingUsd?: number;
}

export interface NousToolAccessInfo {
  enabled: boolean;
  coverage: Partial<Record<NousToolCoverageCategory, boolean>>;
}

export interface NousPortalAccountInfo {
  loggedIn: boolean;
  source: NousAccountInfoSource;
  fresh: boolean;
  userId?: string;
  orgId?: string;
  orgSlug?: string;
  orgName?: string;
  clientId?: string;
  productId?: string;
  nousClient?: string;
  portalBaseUrl?: string;
  inferenceBaseUrl?: string;
  inferenceCredentialPresent: boolean;
  credentialSource?: string;
  expiresAt?: string;
  email?: string;
  privyDid?: string;
  subscription?: NousPortalSubscriptionInfo;
  paidServiceAccess?: boolean;
  toolAccess?: NousToolAccessInfo;
}

export interface NousPortalDeviceCodeSession {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresIn: number;
  interval: number;
  createdAtMs: number;
}

export interface NousPortalTokenResponse {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  tokenType: string;
  expiresIn: number;
  scope?: string;
}

export interface NousPortalModelSpec {
  id: string;
  name: string;
  contextLength: number;
  maxOutputTokens: number;
  pricing: {
    promptPerMillion: number;
    completionPerMillion: number;
  };
  supportsVision: boolean;
  supportsReasoning: boolean;
  description: string;
}

export interface NousPortalRequestPayload {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  sessionId?: string;
  extraBody?: {
    tags?: string[];
    [key: string]: unknown;
  };
}

export interface NousPortalCompletionResponse {
  id: string;
  model: string;
  content: string;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  attributedTags: string[];
  latencyMs: number;
}

export interface NousPortalModelsFetchOptions {
  inferenceBaseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  forceFresh?: boolean;
  fetchFn?: (input: string | URL | any, init?: any) => Promise<Response>;
}

export interface NousPortalDynamicModelItem {
  id: string;
  name?: string;
  context_length?: number;
  max_output_tokens?: number;
  pricing?: {
    prompt?: string | number;
    completion?: string | number;
  };
  architecture?: {
    modality?: string;
    instruct_type?: string;
  };
  description?: string;
}

export interface NousPortalModelsFetchResult {
  success: boolean;
  count: number;
  models: NousPortalModelSpec[];
  error?: string;
  cached: boolean;
  fetchedAtMs: number;
}

export interface NousPortalStateSnapshot {
  version: number;
  account: NousPortalAccountInfo | null;
  activeDeviceSession: NousPortalDeviceCodeSession | null;
  cachedModels: NousPortalModelSpec[];
  totalInvocations: number;
  totalTokensConsumed: number;
  totalEstimatedSpendUsd: number;
  lastFetchedAtMs: number;
  lastUpdatedMs: number;
}
