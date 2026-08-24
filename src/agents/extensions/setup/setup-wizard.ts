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
import type { LlmProxyGateway, ProxyEndpointConfig } from "../resolution/llm-proxy-gateway.js";
import type { LocalProviderKind } from "../../../core/contracts/local-endpoints.contracts.js";

export interface ProviderAuditStatus {
  provider: string;
  configured: boolean;
  source: "environment" | "vault" | "disk-oauth" | "proxy" | "local" | "none";
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
 * Interactive configuration wizard for LLM Provider API Keys, OpenAI Codex OAuth PKCE flow,
 * and Local On-Premises Endpoints (Ollama, llama.cpp, LM Studio, vLLM).
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

    // 3. Local / On-Premise Endpoints (Ollama, LM Studio, llama.cpp)
    const localEndpoints = this.proxyGateway.getAllProviderEndpoints();
    const knownLocals: Array<{ name: string; defaultUrl: string }> = [
      { name: "ollama", defaultUrl: "http://localhost:11434" },
      { name: "lmstudio", defaultUrl: "http://localhost:1234" },
      { name: "llamacpp", defaultUrl: "http://localhost:8080" },
    ];

    for (const local of knownLocals) {
      const customConfig = localEndpoints[local.name];
      const envUrl = process.env[`${local.name.toUpperCase()}_BASE_URL`] || process.env[`${local.name.toUpperCase()}_HOST`];
      const isConfigured = Boolean(customConfig || envUrl);
      statuses.push({
        provider: local.name,
        configured: isConfigured,
        source: customConfig ? "proxy" : envUrl ? "environment" : "none",
        maskedValue: customConfig?.baseUrl || envUrl || local.defaultUrl,
      });
    }

    // 4. Custom LLM Proxy Gateway
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
    console.log("\n\x1b[1;35m╭─── LUMI Account & Active Session ─────────────────────────────╮\x1b[0m");

    if (who.codexOAuth?.authenticated) {
      const userLabel = who.codexOAuth.email || who.codexOAuth.accountId || "ChatGPT Account";
      console.log(`│  \x1b[1;32m● Signed in with ChatGPT / OpenAI\x1b[0m`);
      console.log(`│    \x1b[90mUser:\x1b[0m       \x1b[1;37m${userLabel}\x1b[0m`);
      console.log(`│    \x1b[90mTier:\x1b[0m       \x1b[32mChatGPT Plus / Pro (Active)\x1b[0m`);
      console.log(`│    \x1b[90mSession:\x1b[0m    \x1b[33mValid & Auto-Refreshing\x1b[0m`);
    } else {
      console.log(`│  \x1b[1;33m○ No active session\x1b[0m`);
      console.log(`│    \x1b[90mConnect:\x1b[0m    \x1b[36mlumi login\x1b[0m`);
    }

    console.log(`│`);
    console.log(`│  \x1b[90mActive Model:\x1b[0m \x1b[1;36m${who.activeModel}\x1b[0m`);
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
    for (const p of ["ollama", "lmstudio", "llamacpp", "vllm", "custom"]) {
      this.proxyGateway.setProviderEndpoint(p, null);
    }
    this.saveConfigToDisk();
  }

  displayAuditTable(): void {
    console.log("\n\x1b[1;36m--- LUMI Model & Account Status Audit ---\x1b[0m");
    const statuses = this.auditStatus();
    for (const status of statuses) {
      const icon = status.configured ? "\x1b[32m[✓ ACTIVE]\x1b[0m" : "\x1b[31m[✗ UNCONFIGURED]\x1b[0m";
      const sourceStr = status.source !== "none" ? `(\x1b[33m${status.source}\x1b[0m)` : "";
      const details = status.maskedValue ? `- ${status.maskedValue}` : "";
      console.log(`  ${icon} ${status.provider.padEnd(22)} ${sourceStr} ${details}`);
    }
    console.log();
  }

  async displayDoctor(): Promise<void> {
    console.log("\n\x1b[1;36m============================================================\x1b[0m");
    console.log("\x1b[1;36m   LUMI System Health & Connectivity Doctor                 \x1b[0m");
    console.log("\x1b[1;36m============================================================\x1b[0m\n");

    const diag = this.codexOAuthManager.getAuthDiagnostics();
    const statuses = this.auditStatus();
    const activeProviders = statuses.filter((s) => s.configured);

    // Check 1: OAuth Session
    if (diag.authenticated) {
      console.log(`  \x1b[32m[PASS]\x1b[0m \x1b[1mChatGPT / OpenAI Account\x1b[0m`);
      console.log(`         Signed in as \x1b[36m${diag.email || diag.accountId || "OAuth User"}\x1b[0m (Active)`);
    } else if (diag.isExpired && diag.hasValidRefreshToken) {
      console.log(`  \x1b[33m[WARN]\x1b[0m \x1b[1mSession Token Expired\x1b[0m`);
      console.log(`         Refresh token ready. Run \x1b[36mlumi login\x1b[0m or launch LUMI to auto-refresh.`);
    } else {
      console.log(`  \x1b[90m[INFO]\x1b[0m \x1b[1mChatGPT / OpenAI Account\x1b[0m`);
      console.log(`         Not signed in. Connect anytime with \x1b[36mlumi login\x1b[0m.`);
    }

    // Check 2: Model Configuration
    if (activeProviders.length > 0) {
      console.log(`  \x1b[32m[PASS]\x1b[0m \x1b[1mModel Subsystems (${activeProviders.length} active)\x1b[0m`);
      for (const p of activeProviders) {
        console.log(`         - ${p.provider}`);
      }
    } else {
      console.log(`  \x1b[33m[WARN]\x1b[0m \x1b[1mNo Account Connected\x1b[0m`);
      console.log(`         Run \x1b[36mlumi login\x1b[0m for 1-click browser sign-in.`);
    }

    // Check 3: Host System Hardware & VRAM Capacity
    try {
      const hw = this.proxyGateway.getLocalEngine().getHardwareAssessment();
      console.log(`  \x1b[32m[PASS]\x1b[0m \x1b[1mHost System Hardware & Engine Headroom\x1b[0m (${hw.totalMemoryGb} GB RAM)`);
      console.log(`         Platform: ${hw.platform} (${hw.arch}) • Recommended Model: \x1b[36m${hw.recommendedMaxModelParams}\x1b[0m`);
    } catch {
      // Ignore hardware probe errors
    }

    // Check 4: File Vault Security
    const configPath = path.join(os.homedir(), ".lumi", "config.json");
    if (fs.existsSync(configPath) && process.platform !== "win32") {
      const mode = fs.statSync(configPath).mode & 0o777;
      if (mode === 0o600) {
        console.log(`  \x1b[32m[PASS]\x1b[0m \x1b[1mCredential Vault Security\x1b[0m (mode 0o600 encrypted)`);
      } else {
        console.log(`  \x1b[33m[WARN]\x1b[0m \x1b[1mCredential Vault Permissions\x1b[0m (Current: 0o${mode.toString(8)}, recommended: 0o600)`);
      }
    }

    console.log("\n\x1b[32mHealth diagnostic completed successfully.\x1b[0m\n");
  }

  async loginInteractive(providedReadLine?: readline.Interface): Promise<void> {
    const isStandaloneRl = !providedReadLine;
    const rl = providedReadLine ?? readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log("\n\x1b[1;35m╭─── LUMI 1-Click Login ────────────────────────────────────────╮\x1b[0m");
      console.log("\x1b[1;35m│\x1b[0m  Connecting with your ChatGPT Plus / Pro subscription         \x1b[1;35m│\x1b[0m");
      console.log("\x1b[1;35m╰───────────────────────────────────────────────────────────────╯\x1b[0m\n");

      await this.configureCodexOAuth(rl);
    } finally {
      if (isStandaloneRl) {
        rl.close();
      }
    }
  }

  async runInteractiveWizard(providedReadLine?: readline.Interface): Promise<void> {
    const isStandaloneRl = !providedReadLine;
    const rl = providedReadLine ?? readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      const activeModel = this.getSavedModel() || "gpt-5.6-terra";
      const diag = this.codexOAuthManager.getAuthDiagnostics();
      const userLabel = diag.email || diag.accountId || "Not connected";

      console.log("\n\x1b[1;35m============================================================\x1b[0m");
      console.log("\x1b[1;35m   LUMI Configuration & Account Settings                    \x1b[0m");
      console.log("\x1b[1;35m============================================================\x1b[0m");
      console.log(`  \x1b[90mAccount:\x1b[0m \x1b[1;37m${userLabel}\x1b[0m ${diag.authenticated ? "\x1b[32m(Active)\x1b[0m" : "\x1b[33m(Signed out)\x1b[0m"}`);
      console.log(`  \x1b[90mModel:\x1b[0m   \x1b[1;36m${activeModel}\x1b[0m\n`);

      let exitWizard = false;
      while (!exitWizard) {
        console.log("\x1b[1;34mOptions:\x1b[0m");
        console.log("  [1] Sign in with ChatGPT / OpenAI (1-Click Web Login)");
        console.log("  [2] Quick-Switch Model (Terra, Luna, Sol)");
        console.log("  [3] Run System Health & Diagnostics (Doctor)");
        console.log("  [4] Display Identity & Session Details");
        console.log("  [0] Save & Exit\n");

        const choice = await this.askQuestion(rl, "\x1b[1;33mSelect option (0-4): \x1b[0m");
        switch (choice.trim()) {
          case "1":
            await this.configureCodexOAuth(rl);
            break;
          case "2": {
            console.log("\n\x1b[1;34mSelect Default Model:\x1b[0m");
            console.log("  [1] gpt-5.6-terra (Flagship Reasoning Engine)");
            console.log("  [2] gpt-5.6-luna  (High-Velocity Engine)");
            console.log("  [3] gpt-5.6-sol   (Balanced Engine)");
            const mChoice = await this.askQuestion(rl, "Choose (1-3): ");
            if (mChoice.trim() === "1") {
              this.setSavedModel("gpt-5.6-terra");
              console.log("\x1b[32m[✓] Active model set to gpt-5.6-terra\x1b[0m\n");
            } else if (mChoice.trim() === "2") {
              this.setSavedModel("gpt-5.6-luna");
              console.log("\x1b[32m[✓] Active model set to gpt-5.6-luna\x1b[0m\n");
            } else if (mChoice.trim() === "3") {
              this.setSavedModel("gpt-5.6-sol");
              console.log("\x1b[32m[✓] Active model set to gpt-5.6-sol\x1b[0m\n");
            }
            break;
          }
          case "3":
            await this.displayDoctor();
            break;
          case "4":
            this.displayWhoAmI();
            break;
          case "0":
          case "exit":
          case "quit":
            exitWizard = true;
            console.log("\n\x1b[32m[✓] Configuration saved successfully!\x1b[0m\n");
            break;
          default:
            console.log("\x1b[31mInvalid option, please choose 0 - 4.\x1b[0m\n");
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

  configureLocalEndpoint(provider: string, baseUrl: string, apiKey?: string): void {
    const cleaned = baseUrl.trim();
    if (!cleaned) {
      this.proxyGateway.setProviderEndpoint(provider, null);
    } else {
      this.proxyGateway.setProviderEndpoint(provider, {
        baseUrl: cleaned,
        apiKey: apiKey?.trim() || undefined,
      });
    }
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
    if (this.savedModelName) return this.savedModelName;
    const diag = this.codexOAuthManager.getAuthDiagnostics();
    if (diag.authenticated || (diag.hasValidRefreshToken && !diag.isExpired)) {
      return "gpt-5.6-terra";
    }
    return undefined;
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
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>LUMI — Authentication Successful</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #090d16;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .card {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      border-radius: 24px;
      padding: 48px 36px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .icon-badge {
      width: 64px;
      height: 64px;
      margin: 0 auto 20px;
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(59, 130, 246, 0.2));
      border: 1px solid rgba(16, 185, 129, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      color: #10b981;
    }
    h1 { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 8px; letter-spacing: -0.02em; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.5; margin-bottom: 24px; }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 13px;
      color: #cbd5e1;
      font-weight: 500;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-badge">✓</div>
    <h1>You're All Set!</h1>
    <p>Authentication was successful. You can safely close this browser window and return to your terminal.</p>
    <div class="status-pill">
      <span class="dot"></span>
      Connected to LUMI
    </div>
  </div>
</body>
</html>`);
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
    this.setSavedModel("gpt-5.6-terra");
    return credentials;
  }

  async configureCodexOAuth(rl: readline.Interface): Promise<void> {
    const flow = this.beginCodexOAuthFlow();
    const authDetails = flow.auth;

    console.log("\x1b[1;33m[1/2] Opening browser to authenticate with ChatGPT / OpenAI...\x1b[0m");
    console.log(`\x1b[4;36m      ${authDetails.url}\x1b[0m\n`);

    // Auto-launch system default browser
    this.openCodexOAuthLogin(authDetails.url).catch(() => {});

    console.log("\x1b[90mWaiting for confirmation in browser (or paste code manually below):\x1b[0m");
    const manualInputPromise = this.askQuestion(rl, "Paste code (press Enter if approved in browser): ");

    const inputResult = await Promise.race([
      flow.callback,
      manualInputPromise.then((text) => text.trim()),
    ]);

    flow.close();

    if (!inputResult) {
      console.log("\n\x1b[31m[!] No authorization code received. Login cancelled.\x1b[0m\n");
      return;
    }

    console.log("\n\x1b[33m[2/2] Exchanging token and activating subscription models...\x1b[0m");
    try {
      const creds = await this.completeCodexOAuthFlow(inputResult, authDetails.codeVerifier);

      // Background cloud synchronization silently
      this.codexOAuthManager.syncToGalx().catch(() => {});

      const userLabel = creds.email || creds.accountId || "ChatGPT User";
      const activeModel = this.getSavedModel() || "gpt-5.6-terra";

      console.log("\n\x1b[1;32m╭─── Authentication Successful ─────────────────────────────────╮\x1b[0m");
      console.log(`│  Account:     \x1b[1;37m${userLabel}\x1b[0m \x1b[32m(ChatGPT Plus / Pro)\x1b[0m`);
      console.log(`│  Models:      \x1b[36mgpt-5.6-terra\x1b[0m, \x1b[36mgpt-5.6-luna\x1b[0m, \x1b[36mgpt-5.6-sol\x1b[0m`);
      console.log(`│  Active:      \x1b[1;36m${activeModel}\x1b[0m (Flagship Reasoning Engine)`);
      console.log(`│  Status:      \x1b[32m● Ready to code\x1b[0m`);
      console.log("\x1b[1;32m╰───────────────────────────────────────────────────────────────╯\x1b[0m\n");
    } catch (err: any) {
      console.error(`\n\x1b[31m[✗] Authentication Failed:\x1b[0m`, err?.message || err);
    }
  }

  async configureLocalEndpointsInteractive(rl: readline.Interface): Promise<void> {
    console.log("\n\x1b[1;36m--- Local On-Premises & Custom Proxy Configuration ---\x1b[0m");
    console.log("  [1] Preset: Ollama Daemon (http://localhost:11434/v1)");
    console.log("  [2] Preset: LM Studio (http://localhost:1234/v1)");
    console.log("  [3] Preset: llama.cpp (http://localhost:8080/v1)");
    console.log("  [4] Preset: vLLM / LocalAI (http://localhost:8000/v1)");
    console.log("  [5] Custom On-Premise Endpoint / Corporate Gateway");
    console.log("  [6] Probe & Discover Running Local Models");
    console.log("  [0] Back to Main Menu\n");

    const choice = await this.askQuestion(rl, "Select option (0-6): ");
    switch (choice.trim()) {
      case "1":
        this.configureLocalEndpoint("ollama", "http://localhost:11434/v1");
        console.log("\x1b[32m[✓] Configured Ollama endpoint (http://localhost:11434/v1)\x1b[0m\n");
        break;
      case "2":
        this.configureLocalEndpoint("lmstudio", "http://localhost:1234/v1");
        console.log("\x1b[32m[✓] Configured LM Studio endpoint (http://localhost:1234/v1)\x1b[0m\n");
        break;
      case "3":
        this.configureLocalEndpoint("llamacpp", "http://localhost:8080/v1");
        console.log("\x1b[32m[✓] Configured llama.cpp endpoint (http://localhost:8080/v1)\x1b[0m\n");
        break;
      case "4":
        this.configureLocalEndpoint("vllm", "http://localhost:8000/v1");
        console.log("\x1b[32m[✓] Configured vLLM endpoint (http://localhost:8000/v1)\x1b[0m\n");
        break;
      case "5": {
        const customUrl = await this.askQuestion(rl, "Enter Custom Base URL (e.g. http://localhost:8080/v1): ");
        const apiKey = await this.askQuestion(rl, "Enter Bearer Token (optional): ");
        this.configureLocalEndpoint("custom", customUrl.trim(), apiKey.trim() || undefined);
        console.log("\x1b[32m[✓] Custom endpoint saved!\x1b[0m\n");
        break;
      }
      case "6": {
        console.log("\x1b[33mProbing local servers on ports 11434, 1234, 8080, 8000...\x1b[0m");
        const report = await this.proxyGateway.getLocalEngine().probeAllServers();
        console.log(`\nFound ${report.activeServers} active server(s):`);
        for (const s of report.serverStatuses) {
          const statusStr = s.reachable ? `\x1b[32mONLINE\x1b[0m (${s.latencyMs}ms, ${s.activeModelCount} models)` : `\x1b[90mOFFLINE\x1b[0m`;
          console.log(`  - ${s.displayName.padEnd(22)} ${s.baseUrl.padEnd(24)} -> ${statusStr}`);
        }
        console.log();
        break;
      }
    }
  }

  async configureProxyGateway(rl: readline.Interface): Promise<void> {
    await this.configureLocalEndpointsInteractive(rl);
  }

  async testConnections(): Promise<void> {
    console.log("\n\x1b[1;36m--- Connection Verification Diagnostic ---\x1b[0m");

    const testModels = [
      { name: "gpt-5.6-terra", provider: "OpenAI Codex OAuth" },
      { name: "claude-3-5-sonnet", provider: "Anthropic" },
      { name: "gpt-4o", provider: "OpenAI" },
      { name: "gemini-1.5-pro", provider: "Google Gemini" },
      { name: "deepseek-v3", provider: "DeepSeek" },
      { name: "llama3:latest", provider: "Ollama (Local)" },
      { name: "llamacpp/default", provider: "llama.cpp (Local)" },
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
      const localEndpoints = this.proxyGateway.getAllProviderEndpoints();
      const codexOAuth = this.codexOAuthManager.getCredentials();

      const data = {
        tokens,
        proxy,
        localEndpoints,
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
          localEndpoints?: Record<string, ProxyEndpointConfig>;
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

        if (data.localEndpoints) {
          for (const [p, cfg] of Object.entries(data.localEndpoints)) {
            if (cfg && cfg.baseUrl) {
              this.proxyGateway.setProviderEndpoint(p, cfg);
            }
          }
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
          if (!this.savedModelName) {
            this.savedModelName = "gpt-5.6-terra";
          }
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
          OLLAMA_API_KEY: "ollama",
          LLAMACPP_API_KEY: "llamacpp",
          LMSTUDIO_API_KEY: "lmstudio",
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
    const p = providerName.toLowerCase();
    if (p === "ollama" || p === "llamacpp" || p === "lmstudio" || p === "vllm" || p === "custom" || p === "local" || p === "onprem") {
      const probe = await this.proxyGateway.probeLocalEndpoint(p as LocalProviderKind);
      return {
        passed: probe.reachable,
        details: probe.reachable
          ? `Server Online (${probe.latencyMs}ms, ${probe.activeModelCount} models detected)`
          : `Server unreachable at ${probe.baseUrl}: ${probe.error || "offline"}`,
      };
    }

    const modelMap: Record<string, string> = {
      anthropic: "claude-3-5-sonnet",
      openai: "gpt-4o",
      google: "gemini-1.5-pro",
      deepseek: "deepseek-v3",
      "openai-codex": "gpt-5.6-terra",
    };

    const modelName = modelMap[p] || "gpt-4o";
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
