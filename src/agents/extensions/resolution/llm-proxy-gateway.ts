import {
  DeterministicLocalEndpointEngine,
  DEFAULT_LOCAL_ENDPOINT_PRESETS,
} from "../../../tooling/extensions/endpoints/deterministic-local-endpoint-engine.js";
import type {
  LocalProviderKind,
  LocalServerHealthStatus,
} from "../../../core/contracts/local-endpoints.contracts.js";

export interface ProxyEndpointConfig {
  baseUrl: string;
  apiKey?: string;
  customHeaders?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * LlmProxyGateway.
 * Absorbed from packages/agent/src/proxy.ts (Pass 28 / ADR-012) & upgraded for Local On-Prem (Pass 105 / ADR-052).
 *
 * Manages global proxy base URLs, per-provider custom endpoints (Ollama, llama.cpp, LM Studio, vLLM, Custom),
 * request header injection, auto-sensing of local host environment variables, and connection timeout guardrails.
 */
export class LlmProxyGateway {
  private config: ProxyEndpointConfig | null = null;
  private readonly providerEndpoints = new Map<string, ProxyEndpointConfig>();
  private readonly localEngine: DeterministicLocalEndpointEngine;

  constructor(localEngine?: DeterministicLocalEndpointEngine) {
    this.localEngine = localEngine ?? new DeterministicLocalEndpointEngine();
  }

  public getLocalEngine(): DeterministicLocalEndpointEngine {
    return this.localEngine;
  }

  public configureProxy(config: ProxyEndpointConfig | null): void {
    this.config = config;
  }

  public getProxyConfig(): ProxyEndpointConfig | null {
    return this.config;
  }

  public setProviderEndpoint(provider: string, config: ProxyEndpointConfig | null): void {
    const key = provider.toLowerCase();
    if (config) {
      this.providerEndpoints.set(key, config);
    } else {
      this.providerEndpoints.delete(key);
    }
  }

  public getProviderEndpoint(provider: string): ProxyEndpointConfig | null {
    return this.providerEndpoints.get(provider.toLowerCase()) ?? null;
  }

  public getAllProviderEndpoints(): Record<string, ProxyEndpointConfig> {
    const result: Record<string, ProxyEndpointConfig> = {};
    for (const [key, val] of this.providerEndpoints.entries()) {
      result[key] = { ...val };
    }
    return result;
  }

  public getEffectiveEndpoint(
    provider: string,
    defaultUrl: string
  ): { url: string; headers: Record<string, string>; timeoutMs: number } {
    const p = provider.toLowerCase();

    // 1. Check per-provider override
    const providerOverride = this.providerEndpoints.get(p);
    if (providerOverride) {
      const headers: Record<string, string> = { ...(providerOverride.customHeaders ?? {}) };
      if (providerOverride.apiKey) {
        headers["Authorization"] = `Bearer ${providerOverride.apiKey}`;
      }
      return {
        url: this.localEngine.normalizeChatCompletionsUrl(providerOverride.baseUrl),
        headers,
        timeoutMs: providerOverride.timeoutMs ?? 60_000,
      };
    }

    // 2. Check global proxy configuration
    if (this.config) {
      const headers: Record<string, string> = { ...(this.config.customHeaders ?? {}) };
      if (this.config.apiKey) {
        headers["Authorization"] = `Bearer ${this.config.apiKey}`;
      }
      return {
        url: this.localEngine.normalizeChatCompletionsUrl(this.config.baseUrl),
        headers,
        timeoutMs: this.config.timeoutMs ?? 30_000,
      };
    }

    // 3. Check environment variables for local providers
    const envUrl = this.resolveEnvUrlForProvider(p);
    if (envUrl) {
      const envKey = this.resolveEnvKeyForProvider(p);
      const headers: Record<string, string> = {};
      if (envKey) {
        headers["Authorization"] = `Bearer ${envKey}`;
      }
      return {
        url: this.localEngine.normalizeChatCompletionsUrl(envUrl),
        headers,
        timeoutMs: 60_000,
      };
    }

    // 4. Default URL fallback
    return {
      url: defaultUrl,
      headers: {},
      timeoutMs: 30_000,
    };
  }

  private resolveEnvUrlForProvider(provider: string): string | null {
    if (provider === "ollama") {
      return process.env.OLLAMA_BASE_URL || process.env.OLLAMA_HOST || null;
    }
    if (provider === "llamacpp" || provider === "llama.cpp") {
      return process.env.LLAMA_CPP_BASE_URL || process.env.LLAMACPP_BASE_URL || process.env.LLAMA_SERVER_URL || null;
    }
    if (provider === "lmstudio" || provider === "lm-studio") {
      return process.env.LMSTUDIO_BASE_URL || process.env.LM_STUDIO_BASE_URL || process.env.LMSTUDIO_HOST || null;
    }
    if (provider === "vllm") {
      return process.env.VLLM_BASE_URL || null;
    }
    if (provider === "local" || provider === "onprem" || provider === "custom") {
      return process.env.LOCAL_LLM_BASE_URL || process.env.CUSTOM_LLM_BASE_URL || process.env.ONPREM_LLM_BASE_URL || null;
    }
    return null;
  }

  private resolveEnvKeyForProvider(provider: string): string | null {
    if (provider === "ollama") return process.env.OLLAMA_API_KEY || null;
    if (provider === "llamacpp" || provider === "llama.cpp") return process.env.LLAMACPP_API_KEY || null;
    if (provider === "lmstudio" || provider === "lm-studio") return process.env.LMSTUDIO_API_KEY || null;
    if (provider === "vllm") return process.env.VLLM_API_KEY || null;
    if (provider === "local" || provider === "onprem" || provider === "custom") {
      return process.env.LOCAL_LLM_API_KEY || process.env.CUSTOM_LLM_API_KEY || process.env.ONPREM_API_KEY || null;
    }
    return null;
  }

  public async probeLocalEndpoint(
    providerOrUrl: string,
    apiKey?: string
  ): Promise<LocalServerHealthStatus> {
    const isUrl = providerOrUrl.startsWith("http://") || providerOrUrl.startsWith("https://") || providerOrUrl.includes(":");
    if (isUrl) {
      return this.localEngine.probeServer("custom", providerOrUrl, apiKey);
    }
    const providerKind = (providerOrUrl.toLowerCase() as LocalProviderKind) || "ollama";
    return this.localEngine.probeServer(providerKind, undefined, apiKey);
  }
}
