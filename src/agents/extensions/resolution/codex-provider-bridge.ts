import type { CodexOAuthManager } from "./codex-oauth-manager.js";
import type { AuthStorageVault } from "./auth-storage-vault.js";
import type { EnvironmentKeyResolver } from "./environment-key-resolver.js";
import type { LlmProxyGateway } from "./llm-proxy-gateway.js";

export interface ResolvedAuthHeaders {
  headers: Record<string, string>;
  authType: "codex-oauth" | "api-key" | "none";
}

export const MODERN_GPT56_MODELS = [
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-5.6-sol",
] as const;

export type ModernGpt56Model = typeof MODERN_GPT56_MODELS[number];

/**
 * Pass 104 & 105: Codex Provider Bridge
 * Integrates OpenAI Codex OAuth alongside standard API Key providers and local on-premise engines
 * (Ollama, llama.cpp, LM Studio, vLLM, LocalAI) in LUMI-JOY model resolution.
 */
export class CodexProviderBridge {
  private readonly codexOAuthManager?: CodexOAuthManager;
  private readonly authVault?: AuthStorageVault;
  private readonly envKeyResolver?: EnvironmentKeyResolver;
  private readonly proxyGateway?: LlmProxyGateway;

  constructor(
    codexOAuthManager?: CodexOAuthManager,
    authVault?: AuthStorageVault,
    envKeyResolver?: EnvironmentKeyResolver,
    proxyGateway?: LlmProxyGateway
  ) {
    this.codexOAuthManager = codexOAuthManager;
    this.authVault = authVault;
    this.envKeyResolver = envKeyResolver;
    this.proxyGateway = proxyGateway;
  }

  isCodexProvider(modelName: string): boolean {
    const lower = modelName.toLowerCase();
    if (lower.startsWith("galx/") || lower.startsWith("openrouter/")) {
      return false;
    }
    return (
      lower.includes("codex") ||
      lower.startsWith("openai-codex") ||
      lower.startsWith("gpt-") ||
      lower.includes("chatgpt") ||
      lower.includes("terra") ||
      lower.includes("luna") ||
      lower.includes("sol") ||
      lower === "o1" ||
      lower.startsWith("o1-") ||
      lower === "o3" ||
      lower.startsWith("o3-")
    );
  }

  isLocalProvider(providerName: string): boolean {
    return false;
  }

  createCodexFetchHeaders(accessToken: string, accountId?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (accountId && accountId.trim().length > 0) {
      headers["ChatGPT-Account-Id"] = accountId.trim();
    }
    return headers;
  }

  resolveProviderName(modelName: string): string {
    const lower = modelName.toLowerCase();
    if (lower.startsWith("galx/") || lower === "galx" || lower.includes("galx")) return "galx";
    if (lower.startsWith("openrouter/") || lower.includes("openrouter")) return "openrouter";
    if (this.isCodexProvider(lower) || lower.startsWith("openai/") || lower.includes("gpt")) return "openai-codex";
    if (lower.includes("/")) return "openrouter";
    return "openrouter";
  }

  getDefaultEndpointForModel(modelName: string): string {
    const provider = this.resolveProviderName(modelName);

    // If a proxy gateway is configured with an override for this provider, use it
    if (this.proxyGateway) {
      const effective = this.proxyGateway.getEffectiveEndpoint(provider, "");
      if (effective.url) {
        return effective.url;
      }
    }

    switch (provider) {
      case "galx":
        return "https://galx.ai/v1/chat/completions";
      case "openrouter":
        return "https://openrouter.ai/api/v1/chat/completions";
      case "openai-codex":
      case "openai":
      default:
        return "https://api.openai.com/v1/chat/completions";
    }
  }

  async resolveProviderAuth(modelName: string, fallbackApiKey?: string): Promise<ResolvedAuthHeaders> {
    if (this.isCodexProvider(modelName) && this.codexOAuthManager) {
      const accessToken = await this.codexOAuthManager.getValidAccessToken();
      if (accessToken) {
        const accountId = this.codexOAuthManager.getChatGPTAccountId();
        return {
          headers: this.createCodexFetchHeaders(accessToken, accountId),
          authType: "codex-oauth",
        };
      }
    }

    const providerName = this.resolveProviderName(modelName);
    let apiKey = fallbackApiKey || (this.authVault ? this.authVault.getToken(providerName) : undefined);

    if (!apiKey && this.envKeyResolver) {
      apiKey = this.envKeyResolver.resolveKey(providerName) || undefined;
    }
    if (!apiKey) {
      const envMap: Record<string, string | undefined> = {
        openai: process.env.OPENAI_API_KEY,
        "openai-codex": process.env.OPENAI_API_KEY,
        openrouter: process.env.OPENROUTER_API_KEY,
        galx: process.env.GALX_API_KEY || process.env.GALX_KEY,
      };
      apiKey = envMap[providerName] || undefined;
    }

    if (apiKey) {
      const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
      if (providerName === "galx") {
        headers["X-GALX-Client"] = "LUMI/12.5.0";
        headers["X-GALX-Client-ID"] = "lumi-ide";
        headers["X-OpenRouter-Title"] = "LUMI";
        headers["HTTP-Referer"] = "https://github.com/CardSorting/LUMI-JOY";
      } else if (providerName === "openrouter") {
        headers["HTTP-Referer"] = "https://github.com/CardSorting/LUMI-JOY";
        headers["X-Title"] = "LUMI AGENT OS";
        headers["X-OpenRouter-Title"] = "LUMI";
        headers["X-OpenRouter-Categories"] = "ide-extension";
      }
      return {
        headers,
        authType: "api-key",
      };
    }

    // Special case for local instances (Ollama, llama.cpp, LM Studio, vLLM, LocalAI, local, onprem)
    // which do not require a mandatory API Key
    if (this.isLocalProvider(providerName)) {
      return {
        headers: {},
        authType: "api-key",
      };
    }

    return {
      headers: {},
      authType: "none",
    };
  }

  getModernModels(): readonly string[] {
    return MODERN_GPT56_MODELS;
  }

  getOAuthManager(): CodexOAuthManager | undefined {
    return this.codexOAuthManager;
  }
}
