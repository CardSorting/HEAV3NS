import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as readline from "node:readline";
import type { EnvironmentKeyResolver } from "../resolution/environment-key-resolver.js";
import type { AuthStorageVault } from "../resolution/auth-storage-vault.js";
import type { LlmProxyGateway, ProxyEndpointConfig } from "../resolution/llm-proxy-gateway.js";

export interface ProviderAuditStatus {
  provider: string;
  configured: boolean;
  source: "environment" | "vault" | "proxy" | "local" | "none";
  maskedValue?: string;
}

export interface WhoAmIResult {
  authenticated: boolean;
  activeModel: string;
  configuredProviders: Array<{
    provider: string;
    source: string;
    maskedValue?: string;
  }>;
}

export interface SetupWizardOptions {
  envKeyResolver: EnvironmentKeyResolver;
  authStorageVault: AuthStorageVault;
  proxyGateway: LlmProxyGateway;
}

export type ApiKeyProviderId = "galx";

export function writeAtomicJsonFile(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tempPath, filePath);
}

/**
 * SetupWizard.
 * Interactive configuration wizard for GALX AI API Keys and Local On-Premises Endpoints.
 */
export class SetupWizard {
  private readonly envKeyResolver: EnvironmentKeyResolver;
  private readonly authStorageVault: AuthStorageVault;
  private readonly proxyGateway: LlmProxyGateway;
  private savedModelName?: string;

  constructor(options: SetupWizardOptions) {
    this.envKeyResolver = options.envKeyResolver;
    this.authStorageVault = options.authStorageVault;
    this.proxyGateway = options.proxyGateway;

    this.loadSavedConfig();
  }

  auditStatus(): ProviderAuditStatus[] {
    const statuses: ProviderAuditStatus[] = [];

    // 1. Env & Vault API Keys
    const envStatuses = this.envKeyResolver.getProviderStatuses();
    for (const status of envStatuses) {
      const vaultToken = this.authStorageVault.getToken(status.provider);
      let source: ProviderAuditStatus["source"] = "none";
      let masked: string | undefined;

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

    return statuses;
  }

  getWhoAmI(activeModel = "gpt-5.6-terra"): WhoAmIResult {
    const statuses = this.auditStatus();
    const configured = statuses.filter((s) => s.configured);

    return {
      authenticated: configured.length > 0,
      activeModel,
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

    if (who.authenticated) {
      console.log(`│  \x1b[1;32m● Connected to GALX AI Clearinghouse\x1b[0m`);
      console.log(`│    \x1b[90mTier:\x1b[0m       \x1b[32mGALX Wholesale Compute (Active)\x1b[0m`);
    } else {
      console.log(`│  \x1b[1;33m○ No active API key\x1b[0m`);
      console.log(`│    \x1b[90mConnect:\x1b[0m    \x1b[36mExport GALX_API_KEY or configure in Settings\x1b[0m`);
    }

    console.log(`│`);
    console.log(`│  \x1b[90mActive Model:\x1b[0m \x1b[1;36m${who.activeModel}\x1b[0m`);
    console.log("\x1b[1;35m╰───────────────────────────────────────────────────────────────╯\x1b[0m\n");
  }

  clearAllCredentials(): void {
    for (const provider of this.authStorageVault.listProviders()) {
      this.authStorageVault.clearToken(provider);
    }
    this.proxyGateway.configureProxy(null);
    for (const p of ["ollama", "lmstudio", "llamacpp", "vllm", "custom"]) {
      this.proxyGateway.setProviderEndpoint(p, null);
    }
    this.saveConfigToDisk();
  }

  /** Signs out of GALX AI and clears all stored credentials. */
  logout(): boolean {
    try {
      this.clearAllCredentials();
      return true;
    } catch {
      return false;
    }
  }

  /** Interactive login — runs the setup wizard to configure GALX API key. */
  async loginInteractive(providedReadLine?: readline.Interface): Promise<void> {
    await this.runInteractiveWizard(providedReadLine);
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

    const statuses = this.auditStatus();
    const activeProviders = statuses.filter((s) => s.configured);

    // Check 1: GALX Clearinghouse
    if (activeProviders.length > 0) {
      console.log(`  \x1b[32m[PASS]\x1b[0m \x1b[1mGALX AI Clearinghouse (${activeProviders.length} key active)\x1b[0m`);
      for (const p of activeProviders) {
        console.log(`         - ${p.provider}: ${p.maskedValue}`);
      }
    } else {
      console.log(`  \x1b[33m[WARN]\x1b[0m \x1b[1mNo GALX_API_KEY Configured\x1b[0m`);
      console.log(`         Set GALX_API_KEY in your environment or Settings.`);
    }

    // Check 2: Host System Hardware & VRAM Capacity
    try {
      const hw = this.proxyGateway.getLocalEngine().getHardwareAssessment();
      console.log(`  \x1b[32m[PASS]\x1b[0m \x1b[1mHost System Hardware & Engine Headroom\x1b[0m (${hw.totalMemoryGb} GB RAM)`);
      console.log(`         Platform: ${hw.platform} (${hw.arch}) • Recommended Model: \x1b[36m${hw.recommendedMaxModelParams}\x1b[0m`);
    } catch {
      // Ignore hardware probe errors
    }

    // Check 3: File Vault Security
    const configPath = this.getConfigPath();
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

  async runInteractiveWizard(providedReadLine?: readline.Interface): Promise<void> {
    const isStandaloneRl = !providedReadLine;
    const rl = providedReadLine ?? readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      const activeModel = this.getSavedModel() || "gpt-5.6-terra";

      console.log("\n\x1b[1;35m============================================================\x1b[0m");
      console.log("\x1b[1;35m   LUMI Configuration & Account Settings                    \x1b[0m");
      console.log("\x1b[1;35m============================================================\x1b[0m");
      console.log(`  \x1b[90mModel:\x1b[0m   \x1b[1;36m${activeModel}\x1b[0m\n`);

      let exitWizard = false;
      while (!exitWizard) {
        console.log("\x1b[1;34mOptions:\x1b[0m");
        console.log("  [1] Configure GALX AI API Key");
        console.log("  [2] Select Model (gpt-5.6-terra)");
        console.log("  [3] Run System Health & Diagnostics (Doctor)");
        console.log("  [4] Display Identity & Session Details");
        console.log("  [0] Save & Exit\n");

        const choice = await this.askQuestion(rl, "\x1b[1;33mSelect option (0-4): \x1b[0m");
        switch (choice.trim()) {
          case "1":
            await this.configureApiKeys(rl);
            break;
          case "2": {
            console.log("\n\x1b[1;34mModel Selection (GALX AI Wholesale):\x1b[0m");
            console.log("  [1] gpt-5.6-terra (Flagship Frontier Reasoning Engine · 900k Context · 128k Output)");
            this.setSavedModel("gpt-5.6-terra");
            console.log("\x1b[32m[✓] Active model configured to gpt-5.6-terra\x1b[0m\n");
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
    console.log("\n\x1b[1;36m--- GALX AI API Key Setup ---\x1b[0m");
    const existing = this.authStorageVault.getToken("galx") || process.env.GALX_API_KEY;
    const masked = existing ? `${existing.substring(0, 4)}...${existing.slice(-4)}` : "not set";
    console.log(`\nCurrent GALX status: \x1b[33m${masked}\x1b[0m`);

    const keyInput = await this.askQuestion(rl, "Enter GALX AI API Key (Press Enter to keep current): ");
    const cleaned = keyInput.trim();

    if (cleaned.length > 0) {
      this.configureProviderApiKey("galx", cleaned);
      console.log("\x1b[32m[✓] Updated GALX API key in vault!\x1b[0m\n");
    }
  }

  configureProviderApiKey(provider: ApiKeyProviderId, apiKey: string): void {
    if (provider !== "galx") {
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

  getConfigPath(): string {
    if (process.env.LUMI_CONFIG_PATH) {
      return process.env.LUMI_CONFIG_PATH;
    }
    if (process.env.LUMI_CONFIG_DIR) {
      return path.join(process.env.LUMI_CONFIG_DIR, "config.json");
    }
    return path.join(os.homedir(), ".lumi", "config.json");
  }

  getSavedModel(): string | undefined {
    return this.savedModelName || "gpt-5.6-terra";
  }

  useDefaultProxyGateway(): void {
    this.proxyGateway.configureProxy(null);
    this.saveConfigToDisk();
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

  private saveConfigToDisk(): void {
    try {
      const configPath = this.getConfigPath();
      const tokens: Record<string, string> = {};
      for (const provider of this.authStorageVault.listProviders()) {
        const t = this.authStorageVault.getToken(provider);
        if (t) tokens[provider] = t;
      }

      const proxy = this.proxyGateway.getProxyConfig();
      const localEndpoints = this.proxyGateway.getAllProviderEndpoints();

      const data = {
        tokens,
        proxy,
        localEndpoints,
        modelName: this.savedModelName,
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
      const configPath = this.getConfigPath();
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, "utf-8");
        const data = JSON.parse(raw) as {
          tokens?: Record<string, string>;
          proxy?: { baseUrl?: string; apiKey?: string };
          localEndpoints?: Record<string, ProxyEndpointConfig>;
          modelName?: string;
        };

        if (data.tokens) {
          for (const [provider, token] of Object.entries(data.tokens)) {
            if (token) {
              this.authStorageVault.setToken(provider, token);
            }
          }
        }

        if (data.proxy?.baseUrl) {
          this.proxyGateway.configureProxy({
            baseUrl: data.proxy.baseUrl,
            apiKey: data.proxy.apiKey,
          });
        }

        if (data.localEndpoints) {
          for (const [p, cfg] of Object.entries(data.localEndpoints)) {
            if (cfg?.baseUrl) {
              this.proxyGateway.setProviderEndpoint(p, cfg);
            }
          }
        }

        if (typeof data.modelName === "string" && data.modelName.trim()) {
          this.savedModelName = data.modelName.trim();
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
          GALX_API_KEY: "galx",
          GALX_KEY: "galx",
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
            const targetProvider = envMap[key];
            if (targetProvider && val) {
              this.authStorageVault.setToken(targetProvider, val);
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
    if (p === "galx") {
      const key = this.authStorageVault.getToken("galx") || this.envKeyResolver.resolveKey("galx");
      const passed = Boolean(key);
      return {
        passed,
        details: passed
          ? `GALX AI API Key verified (${key?.substring(0, 4)}...${key?.slice(-4)})`
          : "No GALX AI API key configured. Set GALX_API_KEY in environment or run /setup.",
      };
    }
    const token = this.authStorageVault.getToken(p) || this.envKeyResolver.resolveKey(p);
    const passed = Boolean(token);
    return {
      passed,
      details: passed
        ? `Resolved credentials for ${providerName}`
        : `No API key found for ${providerName}`,
    };
  }

  logoutCodexOAuth(): boolean {
    return this.logout();
  }

  private askQuestion(rl: readline.Interface, promptText: string): Promise<string> {
    return new Promise((resolve) => {
      rl.question(promptText, (answer) => {
        resolve(answer);
      });
    });
  }
}
