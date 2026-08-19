import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as readline from "node:readline";
import * as http from "node:http";
import * as url from "node:url";
import { spawn } from "node:child_process";
import type { EnvironmentKeyResolver, ProviderKeyStatus } from "../resolution/environment-key-resolver.js";
import type { AuthStorageVault } from "../resolution/auth-storage-vault.js";
import {
  CodexOAuthManager,
  OPENAI_CODEX_OAUTH_CONFIG,
  writeAtomicJsonFile,
  type CodexAuthUrlDetails,
  type OpenAiCodexCredentials,
} from "../resolution/codex-oauth-manager.js";
import type { CodexProviderBridge } from "../resolution/codex-provider-bridge.js";
import type { LlmProxyGateway } from "../resolution/llm-proxy-gateway.js";

export interface ProviderAuditStatus {
  provider: string;
  configured: boolean;
  source: "environment" | "vault" | "disk-oauth" | "proxy" | "none";
  maskedValue?: string;
}

export interface WhoAmIResult {
  authenticated: boolean;
  activeModel: string;
  codexOAuth?: {
    authenticated: boolean;
    email?: string;
    accountId?: string;
    expiresInMs?: number;
    syncStatus: string;
  };
  configuredProviders: Array<{
    provider: string;
    source: string;
    maskedValue?: string;
  }>;
}

export interface SetupWizardOptions {
  envKeyResolver: EnvironmentKeyResolver;
  authStorageVault: AuthStorageVault;
  codexOAuthManager: CodexOAuthManager;
  codexProviderBridge: CodexProviderBridge;
  proxyGateway: LlmProxyGateway;
  browserLauncher?: (targetUrl: string) => Promise<void>;
}

export type ApiKeyProviderId = "anthropic" | "openai" | "google" | "deepseek";

export interface CodexOAuthFlow {
  auth: CodexAuthUrlDetails;
  callback: Promise<string | null>;
  close: () => void;
}

function launchSystemBrowser(targetUrl: string): Promise<void> {
  const parsed = new URL(targetUrl);
  if (parsed.protocol !== "https:" || parsed.hostname !== "auth.openai.com") {
    return Promise.reject(new Error("Refusing to open an unexpected OAuth URL"));
  }

  const command = process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "rundll32"
      : "xdg-open";
  const args = process.platform === "win32"
    ? ["url.dll,FileProtocolHandler", targetUrl]
    : [targetUrl];

  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "ignore",
      windowsHide: true,
    });
    let settled = false;
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    child.once("close", (exitCode) => {
      if (settled) return;
      settled = true;
      if (exitCode === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with status ${exitCode ?? "unknown"}`));
      }
    });
  });
}

/**
 * SetupWizard.
 * Interactive configuration wizard for LLM Provider API Keys & OpenAI Codex OAuth PKCE flow.
 * Manages key entry, local OAuth callback HTTP server execution, isolated disk persistence (~/.lumi/config.json),
 * and connection diagnostic testing.
 */
export class SetupWizard {
  private readonly envKeyResolver: EnvironmentKeyResolver;
  private readonly authStorageVault: AuthStorageVault;
  private readonly codexOAuthManager: CodexOAuthManager;
  private readonly codexProviderBridge: CodexProviderBridge;
  private readonly proxyGateway: LlmProxyGateway;
  private readonly browserLauncher: (targetUrl: string) => Promise<void>;
  private savedModelName?: string;

  constructor(options: SetupWizardOptions) {
    this.envKeyResolver = options.envKeyResolver;
    this.authStorageVault = options.authStorageVault;
    this.codexOAuthManager = options.codexOAuthManager;
    this.codexProviderBridge = options.codexProviderBridge;
    this.proxyGateway = options.proxyGateway;
    this.browserLauncher = options.browserLauncher ?? launchSystemBrowser;

    this.loadSavedConfig();
  }

  auditStatus(): ProviderAuditStatus[] {
    const statuses: ProviderAuditStatus[] = [];

    // 1. Env & Vault API Keys
    const envStatuses = this.envKeyResolver.getProviderStatuses();
    for (const status of envStatuses) {
      const vaultToken = this.authStorageVault.getToken(status.provider);
      let source: ProviderAuditStatus["source"] = "none";
      let masked: string | undefined = undefined;

      if (vaultToken) {
        source = "vault";
        masked = `${vaultToken.substring(0, 4)}...${vaultToken.slice(-4)}`;
      } else if (status.hasKey) {
        source = "environment";
        masked = status.maskedKey;
      }

      statuses.push({
        provider: status.provider,
        configured: source !== "none",
        source,
        maskedValue: masked,
      });
    }

    // 2. OpenAI Codex OAuth
    const diag = this.codexOAuthManager.getAuthDiagnostics();
    let codexMasked: string | undefined = undefined;
    if (diag.authenticated) {
      const ttlMinutes = diag.expiresInMs ? Math.round(diag.expiresInMs / 60000) : 0;
      const ttlHours = Math.floor(ttlMinutes / 60);
      const ttlDays = Math.floor(ttlHours / 24);
      const ttlStr = ttlDays > 0 ? `${ttlDays}d remaining` : `${ttlHours}h remaining`;
      codexMasked = `Account: ${diag.accountId || "standard"} (${diag.email || "OAuth User"}) • ${ttlStr} [${diag.syncStatus}]`;
    } else if (diag.isExpired && diag.hasValidRefreshToken) {
      codexMasked = `Token Expired (Refresh Ready) [${diag.syncStatus}]`;
    }

    statuses.push({
      provider: "openai-codex (OAuth)",
      configured: diag.authenticated || (diag.hasValidRefreshToken && !diag.isExpired),
      source: diag.authenticated ? "disk-oauth" : "none",
      maskedValue: codexMasked,
    });

    // 3. Custom LLM Proxy Gateway
    const proxyConfig = this.proxyGateway.getProxyConfig();
    statuses.push({
      provider: "custom-llm-proxy",
      configured: Boolean(proxyConfig?.baseUrl),
      source: proxyConfig?.baseUrl ? "proxy" : "none",
      maskedValue: proxyConfig?.baseUrl,
    });

    return statuses;
  }

  getWhoAmI(activeModel = "gpt-5.6-terra"): WhoAmIResult {
    const statuses = this.auditStatus();
    const configured = statuses.filter((s) => s.configured);
    const diag = this.codexOAuthManager.getAuthDiagnostics();

    return {
      authenticated: configured.length > 0,
      activeModel,
      codexOAuth: diag.authenticated
        ? {
            authenticated: true,
            email: diag.email,
            accountId: diag.accountId,
            expiresInMs: diag.expiresInMs,
            syncStatus: diag.syncStatus,
          }
        : undefined,
      configuredProviders: configured.map((s) => ({
        provider: s.provider,
        source: s.source,
        maskedValue: s.maskedValue,
      })),
    };
  }

  displayWhoAmI(activeModel = "gpt-5.6-terra"): void {
    const who = this.getWhoAmI(activeModel);
    console.log("\n\x1b[1;35m╭─── LUMI Identity & Active Session ────────────────────────────╮\x1b[0m");

    if (who.codexOAuth?.authenticated) {
      const ttlMinutes = who.codexOAuth.expiresInMs ? Math.round(who.codexOAuth.expiresInMs / 60000) : 0;
      const ttlDays = Math.floor(ttlMinutes / 1440);
      const ttlStr = ttlDays > 0 ? `${ttlDays} days remaining` : `${Math.floor(ttlMinutes / 60)} hours remaining`;

      console.log(`│  \x1b[1;32m● Signed in with OpenAI Codex OAuth\x1b[0m`);
      if (who.codexOAuth.email) {
        console.log(`│    \x1b[90mUser Email:\x1b[0m    \x1b[1;37m${who.codexOAuth.email}\x1b[0m`);
      }
      console.log(`│    \x1b[90mAccount ID:\x1b[0m    \x1b[36m${who.codexOAuth.accountId || "standard"}\x1b[0m`);
      console.log(`│    \x1b[90mToken Lease:\x1b[0m   \x1b[33m${ttlStr}\x1b[0m (\x1b[32m${who.codexOAuth.syncStatus}\x1b[0m)`);
    } else {
      console.log(`│  \x1b[1;33m○ No OpenAI Codex OAuth session active\x1b[0m`);
    }

    console.log(`│`);
    console.log(`│  \x1b[90mActive LLM Model:\x1b[0m  \x1b[1;36m${who.activeModel}\x1b[0m`);

    if (who.configuredProviders.length > 0) {
      console.log(`│  \x1b[90mConfigured Providers (${who.configuredProviders.length}):\x1b[0m`);
      for (const p of who.configuredProviders) {
        const masked = p.maskedValue ? `(${p.maskedValue})` : "";
        console.log(`│    \x1b[32m✓\x1b[0m \x1b[37m${p.provider.padEnd(20)}\x1b[0m \x1b[90mvia ${p.source}\x1b[0m ${masked}`);
      }
    } else {
      console.log(`│  \x1b[31m✗ No external model providers configured\x1b[0m`);
    }

    console.log("\x1b[1;35m╰───────────────────────────────────────────────────────────────╯\x1b[0m");
    console.log(`\x1b[90mTip: Use \x1b[36mlumi login\x1b[90m to connect or \x1b[36mlumi logout\x1b[90m to sign out.\x1b[0m\n`);
  }

  logoutCodexOAuth(): boolean {
    try {
      this.codexOAuthManager.clearCredentials();

      // Clean ~/.codex/auth.json
      const codexAuthPath = path.join(os.homedir(), ".codex", "auth.json");
      if (fs.existsSync(codexAuthPath)) {
        const clearedCodex = {
          auth_mode: "chatgpt",
          OPENAI_API_KEY: null,
          tokens: {
            id_token: null,
            access_token: null,
            refresh_token: null,
            account_id: null,
          },
          last_refresh: new Date().toISOString(),
        };
        writeAtomicJsonFile(codexAuthPath, clearedCodex);
      }

      this.saveConfigToDisk();
      return true;
    } catch {
      return false;
    }
  }

  clearAllCredentials(): void {
    this.logoutCodexOAuth();
    for (const provider of this.authStorageVault.listProviders()) {
      this.authStorageVault.clearToken(provider);
    }
    this.proxyGateway.configureProxy(null);
    this.saveConfigToDisk();
  }

  displayAuditTable(): void {
    console.log("\n\x1b[1;36m--- LUMI Model Provider & OAuth Status Audit ---\x1b[0m");
    const statuses = this.auditStatus();
    for (const status of statuses) {
      const icon = status.configured ? "\x1b[32m[✓ ACTIVE]\x1b[0m" : "\x1b[31m[✗ UNCONFIGURED]\x1b[0m";
      const sourceStr = status.source !== "none" ? `(\x1b[33m${status.source}\x1b[0m)` : "";
      const details = status.maskedValue ? `- ${status.maskedValue}` : "";
      console.log(`  ${icon} ${status.provider.padEnd(22)} ${sourceStr} ${details}`);
    }
    console.log();
  }

  displayDoctor(): void {
    console.log("\n\x1b[1;36m============================================================\x1b[0m");
    console.log("\x1b[1;36m   LUMI System Health & Connectivity Doctor                 \x1b[0m");
    console.log("\x1b[1;36m============================================================\x1b[0m\n");

    const diag = this.codexOAuthManager.getAuthDiagnostics();
    const statuses = this.auditStatus();
    const activeProviders = statuses.filter((s) => s.configured);

    // Check 1: OAuth Session
    if (diag.authenticated) {
      console.log(`  \x1b[32m[PASS]\x1b[0m \x1b[1mOpenAI Codex OAuth\x1b[0m`);
      console.log(`         Signed in as \x1b[36m${diag.email || diag.accountId || "OAuth User"}\x1b[0m · Sync: \x1b[32m${diag.syncStatus}\x1b[0m`);
    } else if (diag.isExpired && diag.hasValidRefreshToken) {
      console.log(`  \x1b[33m[WARN]\x1b[0m \x1b[1mOpenAI Codex OAuth Token Expired\x1b[0m`);
      console.log(`         Refresh token ready. Run \x1b[36mlumi login\x1b[0m or launch LUMI to auto-refresh.`);
    } else {
      console.log(`  \x1b[90m[INFO]\x1b[0m \x1b[1mOpenAI Codex OAuth\x1b[0m`);
      console.log(`         Not signed in. Connect anytime with \x1b[36mlumi login\x1b[0m.`);
    }

    // Check 2: Model Providers
    if (activeProviders.length > 0) {
      console.log(`  \x1b[32m[PASS]\x1b[0m \x1b[1mModel Providers (${activeProviders.length} active)\x1b[0m`);
      for (const p of activeProviders) {
        console.log(`         - ${p.provider} (${p.source})`);
      }
    } else {
      console.log(`  \x1b[33m[WARN]\x1b[0m \x1b[1mNo Model Providers Configured\x1b[0m`);
      console.log(`         Run \x1b[36mlumi login\x1b[0m or \x1b[36mlumi setup\x1b[0m to configure API keys or OAuth.`);
    }

    // Check 3: File Vault Security
    const configPath = path.join(os.homedir(), ".lumi", "config.json");
    if (fs.existsSync(configPath) && process.platform !== "win32") {
      const mode = fs.statSync(configPath).mode & 0o777;
      if (mode === 0o600) {
        console.log(`  \x1b[32m[PASS]\x1b[0m \x1b[1mCredential Vault Security\x1b[0m (~/.lumi/config.json mode 0o600 intact)`);
      } else {
        console.log(`  \x1b[33m[WARN]\x1b[0m \x1b[1mCredential Vault Permissions\x1b[0m (Current: 0o${mode.toString(8)}, recommended: 0o600)`);
      }
    }

    console.log("\n\x1b[32mDoctor diagnostic completed.\x1b[0m\n");
  }

  async runInteractiveWizard(providedReadLine?: readline.Interface): Promise<void> {
    const isStandaloneRl = !providedReadLine;
    const rl = providedReadLine ?? readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log("\n\x1b[1;35m============================================================\x1b[0m");
      console.log("\x1b[1;35m   LUMI Setup Wizard - Model Providers & OAuth Setup         \x1b[0m");
      console.log("\x1b[1;35m============================================================\x1b[0m");

      this.displayAuditTable();

      let exitWizard = false;
      while (!exitWizard) {
        console.log("\x1b[1;34mSetup Options:\x1b[0m");
        console.log("  [1] Configure API Keys (Anthropic, OpenAI, Gemini, DeepSeek)");
        console.log("  [2] Connect OpenAI Codex OAuth (PKCE Web Login)");
        console.log("  [3] Configure Custom LLM Proxy Endpoint");
        console.log("  [4] Test Connections & Verification Diagnostic");
        console.log("  [5] Display Status Audit Table");
        console.log("  [0] Save & Exit Setup Wizard\n");

        const choice = await this.askQuestion(rl, "\x1b[1;33mSelect option (0-5): \x1b[0m");
        switch (choice.trim()) {
          case "1":
            await this.configureApiKeys(rl);
            break;
          case "2":
            await this.configureCodexOAuth(rl);
            break;
          case "3":
            await this.configureProxyGateway(rl);
            break;
          case "4":
            await this.testConnections();
            break;
          case "5":
            this.displayAuditTable();
            break;
          case "0":
          case "exit":
          case "quit":
            exitWizard = true;
            console.log("\n\x1b[32m[✓] Setup wizard configuration saved successfully!\x1b[0m\n");
            break;
          default:
            console.log("\x1b[31mInvalid option, please choose 0 - 5.\x1b[0m\n");
            break;
        }
      }
    } finally {
      if (isStandaloneRl) {
        rl.close();
      }
    }
  }

  async configureApiKeys(rl: readline.Interface): Promise<void> {
    console.log("\n\x1b[1;36m--- Provider API Keys Setup ---\x1b[0m");
    const providers = [
      { name: "anthropic", label: "Anthropic API Key (sk-ant-...)", envVar: "ANTHROPIC_API_KEY" },
      { name: "openai", label: "OpenAI API Key (sk-...)", envVar: "OPENAI_API_KEY" },
      { name: "google", label: "Google Gemini API Key (AIzaSy...)", envVar: "GEMINI_API_KEY" },
      { name: "deepseek", label: "DeepSeek API Key (sk-...)", envVar: "DEEPSEEK_API_KEY" },
    ];

    for (const p of providers) {
      const existing = this.authStorageVault.getToken(p.name) || process.env[p.envVar];
      const masked = existing ? `${existing.substring(0, 4)}...${existing.slice(-4)}` : "not set";
      console.log(`\nCurrent ${p.name.toUpperCase()} status: \x1b[33m${masked}\x1b[0m`);

      const keyInput = await this.askQuestion(rl, `Enter new ${p.label} (Press Enter to keep current): `);
      const cleaned = keyInput.trim();

      if (cleaned.length > 0) {
        this.configureProviderApiKey(p.name as ApiKeyProviderId, cleaned);
        console.log(`\x1b[32m[✓] Updated ${p.name} API key in vault!\x1b[0m`);
      }
    }

    console.log("\n\x1b[32m[✓] All API key updates persisted.\x1b[0m\n");
  }

  configureProviderApiKey(provider: ApiKeyProviderId, apiKey: string): void {
    const supportedProviders: readonly ApiKeyProviderId[] = ["anthropic", "openai", "google", "deepseek"];
    if (!supportedProviders.includes(provider)) {
      throw new Error(`Unsupported API key provider: ${provider}`);
    }

    const cleaned = apiKey.trim();
    if (!cleaned) {
      throw new Error(`API key cannot be empty for ${provider}`);
    }

    this.authStorageVault.setToken(provider, cleaned);
    this.saveConfigToDisk();
  }

  setSavedModel(modelName: string): void {
    const cleaned = modelName.trim();
    if (!cleaned) {
      throw new Error("Model name cannot be empty");
    }
    this.savedModelName = cleaned;
    this.saveConfigToDisk();
  }

  getSavedModel(): string | undefined {
    return this.savedModelName;
  }

  useDefaultProxyGateway(): void {
    this.proxyGateway.configureProxy(null);
    this.saveConfigToDisk();
  }

  beginCodexOAuthFlow(): CodexOAuthFlow {
    const auth = this.codexOAuthManager.generateAuthUrl();
    let callbackServer: http.Server | null = null;
    let settled = false;
    let resolveCallback: (code: string | null) => void = () => undefined;

    const callback = new Promise<string | null>((resolve) => {
      resolveCallback = resolve;
    });

    const settle = (code: string | null) => {
      if (settled) return;
      settled = true;
      resolveCallback(code);
    };

    try {
      callbackServer = http.createServer((req, res) => {
        if (!req.url) {
          res.writeHead(400);
          res.end("Invalid OAuth callback");
          return;
        }

        const parsed = url.parse(req.url, true);
        const returnedState = typeof parsed.query.state === "string" ? parsed.query.state : null;
        const code = typeof parsed.query.code === "string" ? parsed.query.code : null;

        if (parsed.pathname !== "/auth/callback" || !code) {
          res.writeHead(400);
          res.end("No authorization code found");
          return;
        }

        if (returnedState && returnedState !== auth.state) {
          res.writeHead(400);
          res.end("OAuth state mismatch");
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <body style="font-family: system-ui; text-align: center; padding: 40px; background: #0f172a; color: #f8fafc;">
              <h1 style="color: #38bdf8;">Authorization Successful!</h1>
              <p style="font-size: 18px;">LUMI received your OpenAI Codex authorization code.</p>
              <p style="color: #94a3b8;">You may close this tab and return to your terminal.</p>
            </body>
          </html>
        `);
        settle(code);
      });

      callbackServer.listen(
        OPENAI_CODEX_OAUTH_CONFIG.callbackPort,
        OPENAI_CODEX_OAUTH_CONFIG.callbackHost
      );
      callbackServer.on("error", () => settle(null));
    } catch {
      settle(null);
    }

    return {
      auth,
      callback,
      close: () => {
        if (callbackServer) {
          try {
            callbackServer.close();
          } catch {
            // Already closed.
          }
        }
        settle(null);
      },
    };
  }

  openCodexOAuthLogin(targetUrl: string): Promise<void> {
    return this.browserLauncher(targetUrl);
  }

  async completeCodexOAuthFlow(
    authorizationResponse: string,
    codeVerifier: string
  ): Promise<OpenAiCodexCredentials> {
    const code = this.extractAuthorizationCode(authorizationResponse);
    if (!code) {
      throw new Error("No authorization code was provided");
    }

    const credentials = await this.codexOAuthManager.exchangeCodeForTokens(code, codeVerifier);
    this.saveCodexCredentialsToDisk(credentials);
    return credentials;
  }

  async configureCodexOAuth(rl: readline.Interface): Promise<void> {
    console.log("\n\x1b[1;36m--- OpenAI Codex OAuth PKCE Connection Setup ---\x1b[0m");

    const flow = this.beginCodexOAuthFlow();
    const authDetails = flow.auth;
    console.log("\n\x1b[1;33mStep 1: Open the following URL in your browser to authenticate:\x1b[0m");
    console.log(`\x1b[4;36m${authDetails.url}\x1b[0m\n`);
    console.log(`\x1b[90mListening for OAuth redirect callback on http://${OPENAI_CODEX_OAUTH_CONFIG.callbackHost}:${OPENAI_CODEX_OAUTH_CONFIG.callbackPort}/auth/callback...\x1b[0m`);

    console.log("\x1b[1;34mStep 2:\x1b[0m Waiting for browser login redirect OR paste code/URL manually below.");
    
    // Prompt user in parallel (race auto callback vs manual paste)
    const manualInputPromise = this.askQuestion(rl, "Paste authorization code or full callback URL (or press Enter if auto-captured): ");

    const inputResult = await Promise.race([
      flow.callback,
      manualInputPromise.then((text) => text.trim()),
    ]);

    flow.close();

    if (!inputResult) {
      console.log("\x1b[31m[!] No authorization code received. OAuth setup cancelled.\x1b[0m\n");
      return;
    }

    console.log("\n\x1b[33mExchanging authorization code for OpenAI Codex OAuth tokens...\x1b[0m");
    try {
      const creds = await this.completeCodexOAuthFlow(inputResult, authDetails.codeVerifier);

      console.log("\x1b[1;32m[✓] OpenAI Codex OAuth Authentication Successful!\x1b[0m");
      console.log(`  Account ID: \x1b[36m${creds.accountId || "standard"}\x1b[0m`);
      if (creds.email) console.log(`  User Email: \x1b[36m${creds.email}\x1b[0m`);
      console.log(`  Expires In: \x1b[36m${Math.round((creds.expires - Date.now()) / 60000)} minutes\x1b[0m`);
      console.log(`  Saved to:   \x1b[90m~/.lumi/config.json & ~/.codex/auth.json\x1b[0m (synchronized for Codex CLI & SDK)\n`);
    } catch (err: any) {
      console.error(`\x1b[31m[✗] Codex OAuth Token Exchange Failed:\x1b[0m`, err?.message || err);
    }
  }

  async configureProxyGateway(rl: readline.Interface): Promise<void> {
    console.log("\n\x1b[1;36m--- Custom LLM Proxy Gateway Setup ---\x1b[0m");
    const currentProxy = this.proxyGateway.getProxyConfig();
    console.log(`Current Proxy Base URL: \x1b[33m${currentProxy?.baseUrl || "none"}\x1b[0m`);

    const newUrl = await this.askQuestion(rl, "Enter Custom LLM Proxy Base URL (e.g. http://localhost:8080/v1, or press Enter to clear): ");
    const cleaned = newUrl.trim();

    if (cleaned.length === 0) {
      this.proxyGateway.configureProxy(null);
      console.log("\x1b[32m[✓] Custom LLM Proxy cleared.\x1b[0m\n");
    } else {
      const apiKey = await this.askQuestion(rl, "Enter Proxy Bearer Token / API Key (optional): ");
      this.proxyGateway.configureProxy({
        baseUrl: cleaned,
        apiKey: apiKey.trim() || undefined,
      });
      console.log("\x1b[32m[✓] Custom LLM Proxy configured successfully!\x1b[0m\n");
    }

    this.saveConfigToDisk();
  }

  async testConnections(): Promise<void> {
    console.log("\n\x1b[1;36m--- Connection Verification Diagnostic ---\x1b[0m");

    const testModels = [
      { name: "gpt-5.6-terra", provider: "OpenAI Codex OAuth" },
      { name: "claude-3-5-sonnet", provider: "Anthropic" },
      { name: "gpt-4o", provider: "OpenAI" },
      { name: "gemini-1.5-pro", provider: "Google Gemini" },
      { name: "deepseek-v3", provider: "DeepSeek" },
    ];

    for (const item of testModels) {
      const resolvedAuth = await this.codexProviderBridge.resolveProviderAuth(item.name);
      const hasAuth = resolvedAuth.authType !== "none";
      const statusIcon = hasAuth ? "\x1b[32m[PASS]\x1b[0m" : "\x1b[31m[FAIL]\x1b[0m";
      const authTypeStr = `Auth Type: \x1b[33m${resolvedAuth.authType}\x1b[0m`;
      const headerCount = Object.keys(resolvedAuth.headers).length;
      console.log(`  ${statusIcon} Model: ${item.name.padEnd(20)} (${item.provider.padEnd(20)}) -> ${authTypeStr} (${headerCount} headers resolved)`);
    }

    console.log("\n\x1b[32mDiagnostic completed.\x1b[0m\n");
  }

  private saveConfigToDisk(): void {
    try {
      const configPath = path.join(os.homedir(), ".lumi", "config.json");
      const tokens: Record<string, string> = {};
      for (const provider of this.authStorageVault.listProviders()) {
        if (provider === "openai-codex") continue;
        const t = this.authStorageVault.getToken(provider);
        if (t) tokens[provider] = t;
      }

      const proxy = this.proxyGateway.getProxyConfig();
      const codexOAuth = this.codexOAuthManager.getCredentials();

      const data = {
        tokens,
        proxy,
        modelName: this.savedModelName,
        codexOAuth,
        updatedAt: Date.now(),
      };

      writeAtomicJsonFile(configPath, data);
    } catch {
      // Ignore write errors
    }
  }

  private loadSavedConfig(): void {
    this.loadDotEnvFile();
    try {
      const configPath = path.join(os.homedir(), ".lumi", "config.json");
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, "utf-8");
        const data = JSON.parse(raw) as {
          tokens?: Record<string, string>;
          proxy?: { baseUrl?: string; apiKey?: string };
          modelName?: string;
          codexOAuth?: OpenAiCodexCredentials;
        };

        if (data.tokens) {
          for (const [provider, token] of Object.entries(data.tokens)) {
            if (token) {
              this.authStorageVault.setToken(provider, token);
            }
          }
        }

        if (data.proxy && data.proxy.baseUrl) {
          this.proxyGateway.configureProxy({
            baseUrl: data.proxy.baseUrl,
            apiKey: data.proxy.apiKey,
          });
        }

        if (typeof data.modelName === "string" && data.modelName.trim()) {
          this.savedModelName = data.modelName.trim();
        }

        if (
          data.codexOAuth?.access_token &&
          data.codexOAuth.refresh_token &&
          typeof data.codexOAuth.expires === "number"
        ) {
          this.codexOAuthManager.saveCredentials(data.codexOAuth);
        }
      }
    } catch {
      // Ignore load errors
    }
  }

  private loadDotEnvFile(): void {
    try {
      const cwdDotEnv = path.join(process.cwd(), ".env");
      if (fs.existsSync(cwdDotEnv)) {
        const content = fs.readFileSync(cwdDotEnv, "utf-8");
        const lines = content.split(/\r?\n/);
        const envMap: Record<string, string> = {
          ANTHROPIC_API_KEY: "anthropic",
          OPENAI_API_KEY: "openai",
          GEMINI_API_KEY: "google",
          DEEPSEEK_API_KEY: "deepseek",
        };

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (envMap[key] && val) {
              this.authStorageVault.setToken(envMap[key]!, val);
            }
          }
        }
      }
    } catch {
      // Ignore load errors
    }
  }

  async testProviderConnection(providerName: string): Promise<{ passed: boolean; details: string }> {
    const modelMap: Record<string, string> = {
      anthropic: "claude-3-5-sonnet",
      openai: "gpt-4o",
      google: "gemini-1.5-pro",
      deepseek: "deepseek-v3",
      "openai-codex": "gpt-5.6-terra",
    };

    const modelName = modelMap[providerName] || "gpt-4o";
    const auth = await this.codexProviderBridge.resolveProviderAuth(modelName);
    const passed = auth.authType !== "none";
    const headerCount = Object.keys(auth.headers).length;
    return {
      passed,
      details: passed
        ? `Resolved auth mode: ${auth.authType} (${headerCount} headers)`
        : `No API key or OAuth credentials found for ${providerName}`,
    };
  }

  private saveCodexCredentialsToDisk(creds: OpenAiCodexCredentials): void {
    this.codexOAuthManager.saveCredentials(creds);
    this.saveConfigToDisk();
  }

  private extractAuthorizationCode(input: string): string | null {
    const cleaned = input.trim();
    if (!cleaned) return null;

    if (!cleaned.includes("code=")) {
      return cleaned;
    }

    try {
      const parsed = new URL(cleaned.startsWith("http") ? cleaned : `http://localhost?${cleaned}`);
      return parsed.searchParams.get("code");
    } catch {
      return null;
    }
  }

  private askQuestion(rl: readline.Interface, promptText: string): Promise<string> {
    return new Promise((resolve) => {
      rl.question(promptText, (answer) => {
        resolve(answer);
      });
    });
  }
}
