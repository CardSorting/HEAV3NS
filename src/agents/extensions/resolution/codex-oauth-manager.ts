import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { AuthStorageVault } from "./auth-storage-vault.js";

export interface OpenAiCodexCredentials {
  type: "openai-codex";
  access_token: string;
  refresh_token: string;
  expires: number; // ms since epoch
  email?: string;
  accountId?: string;
  id_token?: string;
}

export interface CodexAuthUrlDetails {
  url: string;
  codeVerifier: string;
  state: string;
}

export interface AuthSourceAudit {
  path: string;
  exists: boolean;
  mode?: number;
  isReadable: boolean;
  lastModified?: number;
  hasTokens: boolean;
  accountId?: string;
  expiresAt?: number;
}

export interface CodexAuthDiagnostics {
  authenticated: boolean;
  accountId?: string;
  email?: string;
  expiresAt?: number;
  expiresInMs?: number;
  isExpired: boolean;
  hasValidRefreshToken: boolean;
  sources: AuthSourceAudit[];
  syncStatus: "SYNCHRONIZED" | "DESYNCHRONIZED" | "UNCONFIGURED";
}

export const OPENAI_CODEX_OAUTH_CONFIG = {
  authorizationEndpoint: "https://auth.openai.com/oauth/authorize",
  tokenEndpoint: "https://auth.openai.com/oauth/token",
  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
  redirectUri: "http://localhost:1455/auth/callback",
  scopes: "openid profile email offline_access",
  callbackPort: 1455,
  callbackHost: "127.0.0.1",
} as const;

interface IdTokenClaims {
  chatgpt_account_id?: string;
  organizations?: Array<{ id: string }>;
  email?: string;
  exp?: number;
  iat?: number;
  "https://api.openai.com/auth"?: {
    chatgpt_account_id?: string;
  };
  "https://api.openai.com/profile"?: {
    email?: string;
    name?: string;
  };
}

function parseJwtClaims(token: string): IdTokenClaims | undefined {
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;
  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload) as IdTokenClaims;
  } catch {
    return undefined;
  }
}

function extractAccountIdFromToken(token: string): string | undefined {
  const claims = parseJwtClaims(token);
  if (!claims) return undefined;
  return (
    claims.chatgpt_account_id ||
    claims["https://api.openai.com/auth"]?.chatgpt_account_id ||
    claims.organizations?.[0]?.id
  );
}

function extractEmailFromToken(token: string): string | undefined {
  const claims = parseJwtClaims(token);
  if (!claims) return undefined;
  return claims.email || claims["https://api.openai.com/profile"]?.email;
}

function extractExpiryFromToken(token: string): number | undefined {
  const claims = parseJwtClaims(token);
  if (claims && typeof claims.exp === "number" && claims.exp > 0) {
    return claims.exp * 1000;
  }
  return undefined;
}

/**
 * Writes data atomically to disk with explicit 0o600 file permissions and fsync flushing.
 * Avoids partial writes, race condition corruption, or permission leakage.
 */
export function writeAtomicJsonFile(targetPath: string, data: unknown): void {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const tempFile = path.join(
    dir,
    `.tmp.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString("hex")}`
  );

  const serialized = JSON.stringify(data, null, 2);
  const fd = fs.openSync(tempFile, "w", 0o600);
  try {
    fs.writeFileSync(fd, serialized, "utf-8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  try {
    fs.renameSync(tempFile, targetPath);
    try {
      fs.chmodSync(targetPath, 0o600);
    } catch {
      // Best-effort chmod if filesystem permits
    }
  } catch (err) {
    try {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    } catch {
      // Non-fatal cleanup
    }
    throw err;
  }
}

/**
 * Pass 103: OpenAI Codex OAuth Manager (Enterprise Resilience Edition)
 * Ingests OpenAI Codex OAuth PKCE flow & credentials lifecycle.
 * Features:
 * - Single-Flight Refresh Mutex: Eliminates race conditions during token rotation.
 * - Atomic Multi-Source Persistence: Deterministically writes to ~/.codex/auth.json and ~/.lumi/config.json with 0o600 mode.
 * - Multi-Source Freshness Reconciliation: Evaluates last_refresh, file mtimeMs, and JWT claims to avoid stale tokens.
 * - Deep Diagnostics: Provides comprehensive telemetry on token leases and synchronization posture.
 */
export class CodexOAuthManager {
  private credentials: OpenAiCodexCredentials | null = null;
  private readonly authVault?: AuthStorageVault;
  private refreshPromise: Promise<OpenAiCodexCredentials> | null = null;

  constructor(authVault?: AuthStorageVault) {
    this.authVault = authVault;
  }

  generateAuthUrl(): CodexAuthUrlDetails {
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest().toString("base64url");
    const state = crypto.randomBytes(16).toString("hex");

    const params = new URLSearchParams({
      client_id: OPENAI_CODEX_OAUTH_CONFIG.clientId,
      redirect_uri: OPENAI_CODEX_OAUTH_CONFIG.redirectUri,
      scope: OPENAI_CODEX_OAUTH_CONFIG.scopes,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      response_type: "code",
      state,
      codex_cli_simplified_flow: "true",
      originator: "dietcode",
    });

    const url = `${OPENAI_CODEX_OAUTH_CONFIG.authorizationEndpoint}?${params.toString()}`;
    return { url, codeVerifier, state };
  }

  async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<OpenAiCodexCredentials> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: OPENAI_CODEX_OAUTH_CONFIG.clientId,
      code,
      redirect_uri: OPENAI_CODEX_OAUTH_CONFIG.redirectUri,
      code_verifier: codeVerifier,
    });

    const response = await fetch(OPENAI_CODEX_OAUTH_CONFIG.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Codex OAuth token exchange failed: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      id_token?: string;
      expires_in: number;
      email?: string;
    };

    if (!data.refresh_token) {
      throw new Error("Codex OAuth token exchange response missing refresh_token");
    }

    const tokenSource = data.id_token || data.access_token;
    const accountId = extractAccountIdFromToken(tokenSource);
    const email = data.email || extractEmailFromToken(tokenSource);
    const jwtExpiry = extractExpiryFromToken(data.access_token);
    const computedExpiry = typeof jwtExpiry === "number" ? jwtExpiry : Date.now() + data.expires_in * 1000;

    const idToken = data.id_token || data.access_token;
    const creds: OpenAiCodexCredentials = {
      type: "openai-codex",
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires: computedExpiry,
      email,
      accountId,
      id_token: idToken,
    };

    this.saveCredentials(creds);
    return creds;
  }

  /**
   * Refreshes the active access token using Single-Flight in-flight deduplication.
   * Concurrently invoked calls coalesce on the single active network request to prevent RTR token invalidation collisions.
   */
  async refreshAccessToken(): Promise<OpenAiCodexCredentials> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        if (!this.credentials || !this.credentials.refresh_token) {
          throw new Error("No refresh token available to refresh Codex OAuth credentials");
        }

        const body = new URLSearchParams({
          grant_type: "refresh_token",
          client_id: OPENAI_CODEX_OAUTH_CONFIG.clientId,
          refresh_token: this.credentials.refresh_token,
        });

        const response = await fetch(OPENAI_CODEX_OAUTH_CONFIG.tokenEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Codex OAuth token refresh failed: ${response.status} - ${errorText}`);
        }

        const data = (await response.json()) as {
          access_token: string;
          refresh_token?: string;
          id_token?: string;
          expires_in: number;
          email?: string;
        };

        const tokenSource = data.id_token || data.access_token;
        const newAccountId = extractAccountIdFromToken(tokenSource) ?? this.credentials.accountId;
        const newEmail = data.email ?? extractEmailFromToken(tokenSource) ?? this.credentials.email;
        const jwtExpiry = extractExpiryFromToken(data.access_token);
        const computedExpiry = typeof jwtExpiry === "number" ? jwtExpiry : Date.now() + (data.expires_in ?? 3600) * 1000;
        const idToken = data.id_token ?? this.credentials.id_token ?? data.access_token;

        const creds: OpenAiCodexCredentials = {
          type: "openai-codex",
          access_token: data.access_token,
          refresh_token: data.refresh_token ?? this.credentials.refresh_token,
          expires: computedExpiry,
          email: newEmail,
          accountId: newAccountId,
          id_token: idToken,
        };

        this.saveCredentials(creds);
        return creds;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  isTokenExpired(bufferMs = 5 * 60 * 1000): boolean {
    if (!this.credentials) return true;
    return Date.now() >= this.credentials.expires - bufferMs;
  }

  async getValidAccessToken(): Promise<string | null> {
    if (!this.credentials) {
      this.loadFromDisk();
    }
    if (!this.credentials) return null;

    if (this.isTokenExpired()) {
      try {
        await this.refreshAccessToken();
      } catch {
        return null;
      }
    }
    return this.credentials?.access_token ?? null;
  }

  getCredentials(): Readonly<OpenAiCodexCredentials> | null {
    return this.credentials;
  }

  saveCredentials(credentials: OpenAiCodexCredentials, syncToDisk = true): void {
    this.credentials = credentials;
    if (this.authVault) {
      this.authVault.setToken("openai-codex", credentials.access_token);
    }
    if (syncToDisk) {
      this.syncCredentialsToDisk(credentials);
    }
  }

  syncCredentialsToDisk(credentials: OpenAiCodexCredentials): void {
    try {
      // 1. Sync to ~/.codex/auth.json for @openai/codex-sdk native binary execution
      const codexAuthPath = path.join(os.homedir(), ".codex", "auth.json");
      let existingCodex: any = {};
      if (fs.existsSync(codexAuthPath)) {
        try {
          existingCodex = JSON.parse(fs.readFileSync(codexAuthPath, "utf-8"));
        } catch {
          existingCodex = {};
        }
      }
      const idToken = credentials.id_token || existingCodex.tokens?.id_token || credentials.access_token;
      const codexData = {
        auth_mode: existingCodex.auth_mode || "chatgpt",
        OPENAI_API_KEY: existingCodex.OPENAI_API_KEY || null,
        tokens: {
          id_token: idToken,
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token,
          account_id: credentials.accountId || existingCodex.tokens?.account_id,
        },
        last_refresh: new Date().toISOString(),
      };
      writeAtomicJsonFile(codexAuthPath, codexData);

      // 2. Sync to ~/.lumi/config.json
      const lumiConfigPath = path.join(os.homedir(), ".lumi", "config.json");
      let lumiConfig: any = {};
      if (fs.existsSync(lumiConfigPath)) {
        try {
          lumiConfig = JSON.parse(fs.readFileSync(lumiConfigPath, "utf-8"));
        } catch {
          lumiConfig = {};
        }
      }
      lumiConfig.codexOAuth = credentials;
      lumiConfig.updatedAt = Date.now();
      writeAtomicJsonFile(lumiConfigPath, lumiConfig);
    } catch {
      // Non-fatal disk sync fallback
    }
  }

  /**
   * Evaluates all candidate credential paths, choosing the freshest valid credentials
   * and synchronizing all stores to prevent cross-process drift.
   */
  loadFromDisk(authPath?: string, candidatePathsOverride?: string[]): boolean {
    const candidatePaths: string[] = candidatePathsOverride ?? [
      authPath,
      path.join(os.homedir(), ".lumi", "config.json"),
      path.join(os.homedir(), ".codex", "auth.json"),
      path.join(os.homedir(), ".pi", "auth.json"),
    ].filter((p): p is string => Boolean(p));

    interface ParsedCandidate {
      creds: OpenAiCodexCredentials;
      timestamp: number;
      sourcePath: string;
    }

    const discovered: ParsedCandidate[] = [];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const stats = fs.statSync(p);
          const raw = fs.readFileSync(p, "utf-8");
          const data = JSON.parse(raw) as any;

          // Candidate 1: LUMI config format
          if (
            data.codexOAuth?.access_token &&
            data.codexOAuth?.refresh_token &&
            typeof data.codexOAuth?.expires === "number"
          ) {
            const tokenSource = data.codexOAuth.id_token || data.codexOAuth.access_token;
            const accountId = data.codexOAuth.accountId || extractAccountIdFromToken(tokenSource);
            const email = data.codexOAuth.email || extractEmailFromToken(tokenSource);
            const jwtExp = extractExpiryFromToken(data.codexOAuth.access_token);
            const expires = typeof jwtExp === "number" ? jwtExp : data.codexOAuth.expires;

            discovered.push({
              creds: {
                type: "openai-codex",
                access_token: data.codexOAuth.access_token,
                refresh_token: data.codexOAuth.refresh_token,
                expires,
                email,
                accountId,
                id_token: data.codexOAuth.id_token,
              },
              timestamp: typeof data.updatedAt === "number" ? data.updatedAt : stats.mtimeMs,
              sourcePath: p,
            });
          }

          // Candidate 2: Codex auth.json format
          if (data.tokens?.access_token && data.tokens?.refresh_token) {
            const tokenSource = data.tokens.id_token || data.tokens.access_token;
            const accountId = data.tokens.account_id || extractAccountIdFromToken(tokenSource);
            const email = extractEmailFromToken(tokenSource);
            const jwtExp = extractExpiryFromToken(data.tokens.access_token);
            const expires = typeof jwtExp === "number" ? jwtExp : Date.now() + (data.tokens.expires_in ?? 3600) * 1000;

            let parsedTimestamp = stats.mtimeMs;
            if (data.last_refresh) {
              const dt = Date.parse(data.last_refresh);
              if (!isNaN(dt)) parsedTimestamp = dt;
            }

            discovered.push({
              creds: {
                type: "openai-codex",
                access_token: data.tokens.access_token,
                refresh_token: data.tokens.refresh_token,
                expires,
                accountId,
                email,
                id_token: data.tokens.id_token,
              },
              timestamp: parsedTimestamp,
              sourcePath: p,
            });
          }
        } catch {
          // Ignore individual file parse errors
        }
      }
    }

    if (discovered.length === 0) {
      return false;
    }

    // Sort by freshest timestamp descending
    discovered.sort((a, b) => b.timestamp - a.timestamp);
    const chosen = discovered[0];

    // Save and re-sync across all disk targets
    this.saveCredentials(chosen.creds, true);
    return true;
  }

  getAuthDiagnostics(): CodexAuthDiagnostics {
    const candidatePaths: string[] = [
      path.join(os.homedir(), ".lumi", "config.json"),
      path.join(os.homedir(), ".codex", "auth.json"),
      path.join(os.homedir(), ".pi", "auth.json"),
    ];

    const sources: AuthSourceAudit[] = candidatePaths.map((p) => {
      const exists = fs.existsSync(p);
      let mode: number | undefined;
      let isReadable = false;
      let lastModified: number | undefined;
      let hasTokens = false;
      let accountId: string | undefined;
      let expiresAt: number | undefined;

      if (exists) {
        try {
          const stat = fs.statSync(p);
          mode = stat.mode & 0o777;
          lastModified = stat.mtimeMs;
          const raw = fs.readFileSync(p, "utf-8");
          isReadable = true;
          const data = JSON.parse(raw);
          if (data.codexOAuth?.access_token) {
            hasTokens = true;
            accountId = data.codexOAuth.accountId;
            expiresAt = data.codexOAuth.expires;
          } else if (data.tokens?.access_token) {
            hasTokens = true;
            accountId = data.tokens.account_id;
          }
        } catch {
          isReadable = false;
        }
      }

      return {
        path: p,
        exists,
        mode,
        isReadable,
        lastModified,
        hasTokens,
        accountId,
        expiresAt,
      };
    });

    const hasCreds = this.credentials !== null;
    const isExpired = this.isTokenExpired();
    const tokenSourcesWithAuth = sources.filter((s) => s.hasTokens);

    let syncStatus: CodexAuthDiagnostics["syncStatus"] = "UNCONFIGURED";
    if (tokenSourcesWithAuth.length >= 2) {
      syncStatus = "SYNCHRONIZED";
    } else if (tokenSourcesWithAuth.length === 1) {
      syncStatus = "DESYNCHRONIZED";
    }

    return {
      authenticated: hasCreds && !isExpired,
      accountId: this.credentials?.accountId,
      email: this.credentials?.email,
      expiresAt: this.credentials?.expires,
      expiresInMs: this.credentials ? Math.max(0, this.credentials.expires - Date.now()) : undefined,
      isExpired,
      hasValidRefreshToken: Boolean(this.credentials?.refresh_token),
      sources,
      syncStatus,
    };
  }

  getChatGPTAccountId(): string | undefined {
    return this.credentials?.accountId;
  }

  clearCredentials(): void {
    this.credentials = null;
    if (this.authVault) {
      this.authVault.clearToken("openai-codex");
    }
  }
}

