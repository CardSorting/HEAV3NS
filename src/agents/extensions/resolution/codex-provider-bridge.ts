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
  private readonly codexOAuthManager: CodexOAuthManager;
  private readonly authVault?: AuthStorageVault;
  private readonly envKeyResolver?: EnvironmentKeyResolver;
  private readonly proxyGateway?: LlmProxyGateway;

  constructor(
    codexOAuthManager: CodexOAuthManager,
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
    return (
      lower.includes("codex") ||
      lower.startsWith("openai-codex") ||
      lower.includes("gpt-5") ||
      lower.includes("gpt-6") ||
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
    const p = providerName.toLowerCase();
    return (
      p === "ollama" ||
      p === "llamacpp" ||
      p === "llama.cpp" ||
      p === "lmstudio" ||
      p === "lm-studio" ||
      p === "vllm" ||
      p === "localai" ||
      p === "local" ||
      p === "onprem" ||
      p === "custom"
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
    if (lower.startsWith("openrouter/") || lower.includes("openrouter")) return "openrouter";
    if (lower.startsWith("nous/") || lower.includes("nous") || lower.includes("hermes")) return "nous";
    if (lower.startsWith("cline-pass/") || lower.includes("clinepass")) return "clinepass";
    if (lower.startsWith("llamacpp/") || lower.startsWith("llama.cpp/") || lower.startsWith("llama-cpp/") || lower.startsWith("gguf/")) return "llamacpp";
    if (lower.startsWith("lmstudio/") || lower.startsWith("lm-studio/")) return "lmstudio";
    if (lower.startsWith("vllm/")) return "vllm";
    if (lower.startsWith("localai/")) return "localai";
    if (lower.startsWith("onprem/")) return "onprem";
    if (lower.startsWith("local/")) return "local";
    if (lower.startsWith("ollama/") || lower.includes("ollama") || lower.includes(":latest")) return "ollama";
    if (this.isCodexProvider(lower)) return "openai";
    if (lower.startsWith("anthropic/") || lower.includes("claude")) return "anthropic";
    if (lower.startsWith("google/") || lower.includes("gemini")) return "google";
    if (lower.startsWith("deepseek/") || lower.includes("deepseek")) return "deepseek";
    if (lower.startsWith("groq/") || lower.includes("groq")) return "groq";
    if (lower.startsWith("cerebras/") || lower.includes("cerebras")) return "cerebras";
    if (lower.startsWith("xai/") || lower.includes("grok")) return "xai";
    if (lower.startsWith("qwen/") || lower.includes("dashscope")) return "qwen";
    if (lower.startsWith("zai/") || lower.includes("bigmodel") || lower.includes("glm")) return "zai";
    if (lower.startsWith("cloudflare/") || lower.startsWith("@cf/")) return "cloudflare";
    if (lower.startsWith("openai/") || lower.includes("gpt")) return "openai";
    if (lower.includes("/")) return lower.split("/")[0];
    return lower;
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
      case "openrouter":
        return "https://openrouter.ai/api/v1/chat/completions";
      case "nous":
        return "https://inference-api.nousresearch.com/v1/chat/completions";
      case "clinepass":
        return "https://api.cline.bot/api/v1/chat/completions";
      case "deepseek":
        return "https://api.deepseek.com/chat/completions";
      case "groq":
        return "https://api.groq.com/openai/v1/chat/completions";
      case "cerebras":
        return "https://api.cerebras.ai/v1/chat/completions";
      case "xai":
        return "https://api.x.ai/v1/chat/completions";
      case "qwen":
        return "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
      case "zai":
        return "https://open.bigmodel.cn/api/paas/v4/chat/completions";
      case "ollama":
        return "http://localhost:11434/v1/chat/completions";
      case "llamacpp":
        return "http://localhost:8080/v1/chat/completions";
      case "lmstudio":
        return "http://localhost:1234/v1/chat/completions";
      case "vllm":
        return "http://localhost:8000/v1/chat/completions";
      case "localai":
        return "http://localhost:8080/v1/chat/completions";
      case "local":
      case "onprem":
      case "custom":
        return "http://localhost:8000/v1/chat/completions";
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
        nous: process.env.NOUS_API_KEY || process.env.HERMES_PORTAL_TOKEN,
        clinepass: process.env.CLINEPASS_API_KEY || process.env.CLINE_API_KEY,
        groq: process.env.GROQ_API_KEY,
        cerebras: process.env.CEREBRAS_API_KEY,
        xai: process.env.XAI_API_KEY,
        qwen: process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY,
        zai: process.env.BIGMODEL_API_KEY || process.env.ZAI_API_KEY,
        openrouter: process.env.OPENROUTER_API_KEY,
        ollama: process.env.OLLAMA_API_KEY,
        llamacpp: process.env.LLAMACPP_API_KEY,
        lmstudio: process.env.LMSTUDIO_API_KEY,
        vllm: process.env.VLLM_API_KEY,
        localai: process.env.LOCALAI_API_KEY,
        local: process.env.LOCAL_LLM_API_KEY,
        onprem: process.env.ONPREM_API_KEY,
        custom: process.env.CUSTOM_LLM_API_KEY,
      };
      apiKey = envMap[providerName] || undefined;
    }

    if (apiKey) {
      const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
      if (providerName === "openrouter") {
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

  getOAuthManager(): CodexOAuthManager {
    return this.codexOAuthManager;
  }
}
