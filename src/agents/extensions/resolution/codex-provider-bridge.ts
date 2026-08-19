import type { CodexOAuthManager } from "./codex-oauth-manager.js";
import type { AuthStorageVault } from "./auth-storage-vault.js";
import type { EnvironmentKeyResolver } from "./environment-key-resolver.js";

export interface ResolvedAuthHeaders {
  headers: Record<string, string>;
  authType: "codex-oauth" | "api-key" | "none";
}

export const MODERN_GPT56_MODELS = [
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-5.6-sol",
  "gpt-5.6-codex",
] as const;

export type ModernGpt56Model = typeof MODERN_GPT56_MODELS[number];

/**
 * Pass 104: Codex Provider Bridge
 * Integrates OpenAI Codex OAuth alongside standard API Key providers in LUMI-JOY model resolution.
 * Detects Codex & modern GPT 5.6 (Terra/Luna/Sol) model requests and injects Bearer OAuth access tokens and ChatGPT-Account-Id headers.
 */
export class CodexProviderBridge {
  private readonly codexOAuthManager: CodexOAuthManager;
  private readonly authVault?: AuthStorageVault;
  private readonly envKeyResolver?: EnvironmentKeyResolver;

  constructor(
    codexOAuthManager: CodexOAuthManager,
    authVault?: AuthStorageVault,
    envKeyResolver?: EnvironmentKeyResolver
  ) {
    this.codexOAuthManager = codexOAuthManager;
    this.authVault = authVault;
    this.envKeyResolver = envKeyResolver;
  }

  isCodexProvider(modelName: string): boolean {
    const lower = modelName.toLowerCase();
    return (
      lower.includes("codex") ||
      lower.startsWith("openai-codex") ||
      lower.includes("gpt-5.6") ||
      lower.includes("terra") ||
      lower.includes("luna") ||
      lower.includes("sol") ||
      lower.includes("gpt-5")
    );
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
    if (this.isCodexProvider(lower)) return "openai";
    if (lower.startsWith("openrouter/") || lower.includes("openrouter")) return "openrouter";
    if (lower.startsWith("anthropic/") || lower.includes("claude")) return "anthropic";
    if (lower.startsWith("google/") || lower.includes("gemini")) return "google";
    if (lower.startsWith("deepseek/") || lower.includes("deepseek")) return "deepseek";
    if (lower.startsWith("ollama/") || lower.includes("ollama") || lower.includes(":latest")) return "ollama";
    if (lower.startsWith("openai/") || lower.includes("gpt")) return "openai";
    if (lower.includes("/")) return lower.split("/")[0];
    return lower;
  }

  getDefaultEndpointForModel(modelName: string): string {
    const provider = this.resolveProviderName(modelName);
    switch (provider) {
      case "openrouter":
        return "https://openrouter.ai/api/v1/chat/completions";
      case "deepseek":
        return "https://api.deepseek.com/v1/chat/completions";
      case "ollama":
        return "http://localhost:11434/v1/chat/completions";
      case "anthropic":
        return "https://api.anthropic.com/v1/messages";
      default:
        return "https://api.openai.com/v1/chat/completions";
    }
  }

  async resolveProviderAuth(modelName: string, fallbackApiKey?: string): Promise<ResolvedAuthHeaders> {
    if (this.isCodexProvider(modelName)) {
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
        anthropic: process.env.ANTHROPIC_API_KEY,
        google: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
        deepseek: process.env.DEEPSEEK_API_KEY,
        openrouter: process.env.OPENROUTER_API_KEY,
      };
      apiKey = envMap[providerName] || process.env.OPENAI_API_KEY || undefined;
    }

    if (apiKey) {
      const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
      if (providerName === "openrouter") {
        headers["HTTP-Referer"] = "https://lumi.agent";
        headers["X-Title"] = "LUMI AGENT OS";
      }
      return {
        headers,
        authType: "api-key",
      };
    }

    // Special case for local Ollama instances which don't require an API Key
    if (providerName === "ollama") {
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

  getOAuthManager(): CodexOAuthManager {
    return this.codexOAuthManager;
  }
}

