/**
 * deterministic-local-endpoint-engine.ts
 *
 * Deterministic engine for managing local and on-premises LLM endpoints,
 * zero-config auto-sensing, dynamic model discovery, health diagnostics,
 * hardware VRAM profiling, streaming in-TUI model pulling, daemon auto-launching,
 * context auto-tuning, inference speed benchmarking, VRAM purging, and offline embeddings (Phase 105 / ADR-052).
 */

import type {
  DiscoveredLocalModel,
  LocalContextTuningProfile,
  LocalEmbeddingResult,
  LocalEndpointAuditReport,
  LocalEndpointMetricsReport,
  LocalEndpointProfile,
  LocalHardwareAssessment,
  LocalInferenceBenchmarkResult,
  LocalModelUnloadResult,
  LocalProviderKind,
  LocalQuickstartGuide,
  LocalServerHealthStatus,
  ModelPullProgress,
  ModelVramCompatibility,
  ProcessSpawnResult,
} from "../../../core/contracts/local-endpoints.contracts.js";
import { LocalHardwareProfiler } from "./local-hardware-profiler.js";
import { LocalModelPuller, type PullModelOptions } from "./local-model-puller.js";
import { LocalProcessSupervisor } from "./local-process-supervisor.js";
import { LocalContextAutoTuner } from "./local-context-auto-tuner.js";
import { LocalInferenceSpeedometer, type SpeedometerOptions } from "./local-inference-speedometer.js";
import { LocalVramReclaimer, type LoadedModelRecord } from "./local-vram-reclaimer.js";
import { LocalEmbeddingsEngine } from "./local-embeddings-engine.js";

export const DEFAULT_LOCAL_ENDPOINT_PRESETS: Record<LocalProviderKind, LocalEndpointProfile> = {
  ollama: {
    id: "ollama",
    provider: "ollama",
    displayName: "Ollama Local Daemon",
    baseUrl: "http://localhost:11434",
    chatCompletionsUrl: "http://localhost:11434/v1/chat/completions",
    defaultPort: 11434,
    timeoutMs: 60_000,
    isDefault: true,
    notes: "Default local Ollama instance with zero-configuration model discovery.",
  },
  llamacpp: {
    id: "llamacpp",
    provider: "llamacpp",
    displayName: "llama.cpp (llama-server)",
    baseUrl: "http://localhost:8080",
    chatCompletionsUrl: "http://localhost:8080/v1/chat/completions",
    defaultPort: 8080,
    timeoutMs: 90_000,
    notes: "High-performance GGUF inference server with slot telemetry and metal/cuda acceleration.",
  },
  lmstudio: {
    id: "lmstudio",
    provider: "lmstudio",
    displayName: "LM Studio Local Server",
    baseUrl: "http://localhost:1234",
    chatCompletionsUrl: "http://localhost:1234/v1/chat/completions",
    defaultPort: 1234,
    timeoutMs: 60_000,
    notes: "Local GUI model hub with OpenAI-compatible server on port 1234.",
  },
  vllm: {
    id: "vllm",
    provider: "vllm",
    displayName: "vLLM High-Throughput Engine",
    baseUrl: "http://localhost:8000",
    chatCompletionsUrl: "http://localhost:8000/v1/chat/completions",
    defaultPort: 8000,
    timeoutMs: 120_000,
    notes: "Enterprise high-throughput PagedAttention inference server.",
  },
  localai: {
    id: "localai",
    provider: "localai",
    displayName: "LocalAI On-Premises Gateway",
    baseUrl: "http://localhost:8080",
    chatCompletionsUrl: "http://localhost:8080/v1/chat/completions",
    defaultPort: 8080,
    timeoutMs: 90_000,
    notes: "Self-hosted, drop-in replacement REST API for local AI services.",
  },
  custom: {
    id: "custom",
    provider: "custom",
    displayName: "Custom On-Premises Endpoint",
    baseUrl: "http://localhost:8000",
    chatCompletionsUrl: "http://localhost:8000/v1/chat/completions",
    defaultPort: 8000,
    timeoutMs: 60_000,
    notes: "Generic OpenAI-compatible custom local or corporate private proxy.",
  },
};

export const LOCAL_QUICKSTART_GUIDES: Record<LocalProviderKind, LocalQuickstartGuide> = {
  ollama: {
    provider: "ollama",
    displayName: "Ollama",
    tagline: "Easiest way to run open-weight models locally with zero setup.",
    downloadUrl: "https://ollama.com/download",
    defaultPort: 11434,
    oneLineCommand: "ollama run llama3.2",
    guiSteps: [
      "Download and install Ollama from https://ollama.com",
      "Launch Ollama (the llama icon will appear in your system tray/menu bar)",
      "Run 'ollama run qwen2.5-coder' or 'ollama run llama3.2' in any terminal",
      "LUMI will automatically detect and connect to your running models!",
    ],
    recommendedModels: [
      {
        name: "qwen2.5-coder:7b",
        description: "Best compact coding model for programming & refactoring",
        ramRequired: "8 GB RAM / 4.7 GB VRAM",
        command: "ollama run qwen2.5-coder:7b",
        vramTier: "optimal_gpu",
      },
      {
        name: "llama3.2:3b",
        description: "Super-fast lightweight assistant for quick queries",
        ramRequired: "4 GB RAM / 2.0 GB VRAM",
        command: "ollama run llama3.2:3b",
        vramTier: "optimal_gpu",
      },
      {
        name: "deepseek-r1:8b",
        description: "Distilled reasoning model with strong chain-of-thought",
        ramRequired: "8 GB RAM / 4.9 GB VRAM",
        command: "ollama run deepseek-r1:8b",
        vramTier: "optimal_gpu",
      },
      {
        name: "llama3.3:70b",
        description: "Flagship tier intelligence matching GPT-4o for heavy workstations",
        ramRequired: "48 GB RAM / 40 GB VRAM",
        command: "ollama run llama3.3:70b",
        vramTier: "partial_offload",
      },
    ],
  },
  llamacpp: {
    provider: "llamacpp",
    displayName: "llama.cpp (llama-server)",
    tagline: "Maximum speed, minimum overhead GGUF runner with Apple Metal / CUDA acceleration.",
    downloadUrl: "https://github.com/ggerganov/llama.cpp/releases",
    defaultPort: 8080,
    oneLineCommand: "llama-server -m <model.gguf> -c 16384 --port 8080",
    guiSteps: [
      "Install llama.cpp via Homebrew (brew install llama.cpp) or download binary release",
      "Download any .gguf model from Hugging Face (e.g. Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf)",
      "Launch server: llama-server -m ./model.gguf -c 8192 -ngl 99 --port 8080",
      "LUMI connects directly to http://localhost:8080/v1/chat/completions",
    ],
    recommendedModels: [
      {
        name: "Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf",
        description: "High-precision code completion with full GPU layer offload",
        ramRequired: "6 GB VRAM",
        command: "llama-server -m ./qwen2.5-coder-7b.gguf -c 16384 -ngl 99",
      },
      {
        name: "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
        description: "Versatile conversational agent with 128k context support",
        ramRequired: "6.5 GB VRAM",
        command: "llama-server -m ./llama-3.1-8b.gguf -c 16384 -ngl 99",
      },
    ],
  },
  lmstudio: {
    provider: "lmstudio",
    displayName: "LM Studio",
    tagline: "Beautiful desktop GUI for browsing, downloading, and hosting LLMs locally.",
    downloadUrl: "https://lmstudio.ai",
    defaultPort: 1234,
    oneLineCommand: "lms server start",
    guiSteps: [
      "Download and install LM Studio from https://lmstudio.ai",
      "Search for and download any model (e.g. Qwen 2.5 Coder or DeepSeek-R1)",
      "Navigate to the Developer / Local Server tab (<-> icon)",
      "Click 'Start Server' (defaults to port 1234)",
      "LUMI connects automatically with zero configuration!",
    ],
    recommendedModels: [
      {
        name: "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF",
        description: "Top-rated coding intelligence with full LM Studio tooling",
        ramRequired: "8 GB RAM",
        command: "Load in LM Studio UI",
      },
      {
        name: "deepseek-ai/DeepSeek-R1-Distill-Qwen-8B-GGUF",
        description: "Local reasoning agent with formatted thought traces",
        ramRequired: "8 GB RAM",
        command: "Load in LM Studio UI",
      },
    ],
  },
  vllm: {
    provider: "vllm",
    displayName: "vLLM",
    tagline: "High-throughput, low-latency production inference server with PagedAttention.",
    downloadUrl: "https://docs.vllm.ai",
    defaultPort: 8000,
    oneLineCommand: "python3 -m vllm.entrypoints.openai.api_server --model Qwen/Qwen2.5-Coder-7B-Instruct",
    guiSteps: [
      "Install vLLM via pip: pip install vllm",
      "Launch OpenAI API server: python3 -m vllm.entrypoints.openai.api_server --model <model>",
      "LUMI routes requests via http://localhost:8000/v1/chat/completions",
    ],
    recommendedModels: [
      {
        name: "Qwen/Qwen2.5-Coder-7B-Instruct",
        description: "Ultra-high concurrency batch coding server",
        ramRequired: "16 GB VRAM",
        command: "vllm serve Qwen/Qwen2.5-Coder-7B-Instruct",
      },
    ],
  },
  localai: {
    provider: "localai",
    displayName: "LocalAI",
    tagline: "Drop-in OpenAI replacement REST API for CPU & GPU inference.",
    downloadUrl: "https://localai.io",
    defaultPort: 8080,
    oneLineCommand: "docker run -p 8080:8080 localai/localai:latest",
    guiSteps: [
      "Run LocalAI docker container: docker run -p 8080:8080 localai/localai:latest",
      "Or install standalone binary from https://localai.io",
      "LUMI connects via http://localhost:8080/v1/chat/completions",
    ],
    recommendedModels: [],
  },
  custom: {
    provider: "custom",
    displayName: "Custom On-Premises",
    tagline: "Connect to any OpenAI-compatible custom gateway, LiteLLM, or corporate cluster.",
    downloadUrl: "https://github.com",
    defaultPort: 8000,
    oneLineCommand: "Configure via /local or lumi setup",
    guiSteps: [
      "Deploy your custom OpenAI-compatible server or proxy",
      "Set environment variable LOCAL_LLM_BASE_URL or run /local in LUMI",
      "All requests will be routed to your enterprise gateway with zero data leakage!",
    ],
    recommendedModels: [],
  },
};

export class DeterministicLocalEndpointEngine {
  private readonly profiles = new Map<LocalProviderKind, LocalEndpointProfile>();
  private readonly cachedStatuses = new Map<LocalProviderKind, LocalServerHealthStatus>();
  private readonly hardwareProfiler: LocalHardwareProfiler;
  private readonly modelPuller: LocalModelPuller;
  private readonly processSupervisor: LocalProcessSupervisor;
  private readonly contextAutoTuner: LocalContextAutoTuner;
  private readonly inferenceSpeedometer: LocalInferenceSpeedometer;
  private readonly vramReclaimer: LocalVramReclaimer;
  private readonly embeddingsEngine: LocalEmbeddingsEngine;

  private totalTurns = 0;
  private totalTokens = 0;
  private totalDurationMs = 0;
  private lastProvider?: LocalProviderKind;
  private lastDurationMs?: number;

  constructor() {
    this.hardwareProfiler = new LocalHardwareProfiler();
    this.modelPuller = new LocalModelPuller();
    this.processSupervisor = new LocalProcessSupervisor();
    this.contextAutoTuner = new LocalContextAutoTuner(this.hardwareProfiler);
    this.inferenceSpeedometer = new LocalInferenceSpeedometer(this.hardwareProfiler);
    this.vramReclaimer = new LocalVramReclaimer(this.hardwareProfiler);
    this.embeddingsEngine = new LocalEmbeddingsEngine();
    this.initDefaultProfiles();
  }

  private initDefaultProfiles(): void {
    for (const [provider, profile] of Object.entries(DEFAULT_LOCAL_ENDPOINT_PRESETS)) {
      this.profiles.set(provider as LocalProviderKind, { ...profile });
    }
  }

  public getProfile(provider: LocalProviderKind): LocalEndpointProfile {
    return this.profiles.get(provider) ?? { ...DEFAULT_LOCAL_ENDPOINT_PRESETS[provider] };
  }

  public setProfile(profile: LocalEndpointProfile): void {
    const normalizedChatUrl = this.normalizeChatCompletionsUrl(profile.chatCompletionsUrl || profile.baseUrl);
    const normalizedBaseUrl = this.extractBaseUrl(profile.baseUrl || profile.chatCompletionsUrl);
    this.profiles.set(profile.provider, {
      ...profile,
      baseUrl: normalizedBaseUrl,
      chatCompletionsUrl: normalizedChatUrl,
    });
  }

  public getAllProfiles(): LocalEndpointProfile[] {
    return Array.from(this.profiles.values());
  }

  public getHardwareProfiler(): LocalHardwareProfiler {
    return this.hardwareProfiler;
  }

  public getModelPuller(): LocalModelPuller {
    return this.modelPuller;
  }

  public getProcessSupervisor(): LocalProcessSupervisor {
    return this.processSupervisor;
  }

  public getContextAutoTuner(): LocalContextAutoTuner {
    return this.contextAutoTuner;
  }

  public getInferenceSpeedometer(): LocalInferenceSpeedometer {
    return this.inferenceSpeedometer;
  }

  public getVramReclaimer(): LocalVramReclaimer {
    return this.vramReclaimer;
  }

  public getEmbeddingsEngine(): LocalEmbeddingsEngine {
    return this.embeddingsEngine;
  }

  public getHardwareAssessment(): LocalHardwareAssessment {
    return this.hardwareProfiler.assessHardware();
  }

  public getHardwareCard(): string {
    return this.hardwareProfiler.formatHardwareCard();
  }

  public evaluateModelCompatibility(
    modelId: string,
    paramSizeStr?: string,
    quantStr?: string
  ): ModelVramCompatibility {
    return this.hardwareProfiler.evaluateModel(modelId, paramSizeStr, quantStr);
  }

  public getSafeContextBudget(
    modelName: string,
    requestedContext = 32_768
  ): LocalContextTuningProfile {
    return this.contextAutoTuner.computeTuningProfile(modelName, requestedContext);
  }

  public getOllamaOptions(
    modelName: string,
    requestedContext = 32_768,
    temperature = 0.2
  ): { num_ctx: number; num_predict: number; temperature: number; repeat_penalty: number } {
    return this.contextAutoTuner.getOllamaOptions(modelName, requestedContext, temperature);
  }

  public async benchmarkModel(
    modelName: string,
    options: SpeedometerOptions = {}
  ): Promise<LocalInferenceBenchmarkResult> {
    return this.inferenceSpeedometer.benchmarkModel(modelName, options);
  }

  public async unloadModel(
    modelTag: string,
    baseUrl?: string
  ): Promise<LocalModelUnloadResult> {
    return this.vramReclaimer.unloadModel(modelTag, baseUrl);
  }

  public async unloadAllModels(baseUrl?: string): Promise<LocalModelUnloadResult[]> {
    return this.vramReclaimer.unloadAll(baseUrl);
  }

  public async getLoadedModels(baseUrl?: string): Promise<LoadedModelRecord[]> {
    return this.vramReclaimer.getLoadedModels(baseUrl);
  }

  public async generateEmbedding(
    text: string,
    modelName?: string,
    baseUrl?: string
  ): Promise<LocalEmbeddingResult> {
    return this.embeddingsEngine.generateEmbedding(text, modelName, baseUrl);
  }

  public async pullModel(
    modelTag: string,
    options: PullModelOptions = {}
  ): Promise<ModelPullProgress> {
    return this.modelPuller.pullModel(modelTag, options);
  }

  public async startLocalServer(provider: LocalProviderKind): Promise<ProcessSpawnResult> {
    const healthCheck = async () => {
      const status = await this.probeServer(provider, undefined, undefined, 1000);
      return status.reachable;
    };
    return this.processSupervisor.startServer(provider, healthCheck);
  }

  public normalizeChatCompletionsUrl(inputUrl: string): string {
    let cleaned = (inputUrl || "").trim().replace(/\/+$/, "");
    if (!cleaned) return "http://localhost:11434/v1/chat/completions";

    if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
      cleaned = `http://${cleaned}`;
    }

    if (cleaned.endsWith("/chat/completions")) {
      return cleaned;
    }
    if (cleaned.endsWith("/v1")) {
      return `${cleaned}/chat/completions`;
    }
    return `${cleaned}/v1/chat/completions`;
  }

  public extractBaseUrl(inputUrl: string): string {
    let cleaned = (inputUrl || "").trim().replace(/\/+$/, "");
    if (!cleaned) return "http://localhost:11434";

    if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
      cleaned = `http://${cleaned}`;
    }

    try {
      const parsed = new URL(cleaned);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return cleaned.replace(/\/v1.*$/, "");
    }
  }

  public getQuickstartGuide(provider: LocalProviderKind): LocalQuickstartGuide {
    return LOCAL_QUICKSTART_GUIDES[provider] ?? LOCAL_QUICKSTART_GUIDES.ollama;
  }

  public getAllQuickstartGuides(): LocalQuickstartGuide[] {
    return Object.values(LOCAL_QUICKSTART_GUIDES);
  }

  public async probeServer(
    provider: LocalProviderKind,
    customUrl?: string,
    apiKey?: string,
    timeoutMs = 2500
  ): Promise<LocalServerHealthStatus> {
    const profile = this.getProfile(provider);
    const targetBaseUrl = customUrl ? this.extractBaseUrl(customUrl) : profile.baseUrl;
    const targetChatUrl = customUrl ? this.normalizeChatCompletionsUrl(customUrl) : profile.chatCompletionsUrl;
    const startedAt = Date.now();
    const canAutoStart = Boolean(this.processSupervisor.findBinary(provider));

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(profile.customHeaders ?? {}),
    };
    if (apiKey || profile.apiKey) {
      headers["Authorization"] = `Bearer ${apiKey || profile.apiKey}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (provider === "ollama") {
        // Ollama tags endpoint
        const tagsUrl = `${targetBaseUrl}/api/tags`;
        const res = await fetch(tagsUrl, {
          method: "GET",
          headers,
          signal: controller.signal,
        });
        clearTimeout(timer);
        const latencyMs = Math.max(1, Date.now() - startedAt);

        if (res.ok) {
          const body = (await res.json()) as {
            models?: Array<{
              name: string;
              size?: number;
              modified_at?: string;
              details?: { parameter_size?: string; quantization_level?: string };
            }>;
          };
          const rawModels = body.models ?? [];
          const detectedModels: DiscoveredLocalModel[] = rawModels.map((m) => {
            const cleanName = m.name;
            const param = m.details?.parameter_size;
            const quant = m.details?.quantization_level;
            const vramComp = this.hardwareProfiler.evaluateModel(cleanName, param, quant);
            const tuning = this.contextAutoTuner.computeTuningProfile(cleanName, 32_768);

            return {
              modelId: cleanName,
              provider: "ollama",
              rawName: cleanName,
              displayName: `Ollama ${cleanName}`,
              parameterSize: param,
              quantization: quant,
              contextWindow: tuning.safeContextTokens,
              maxOutputTokens: tuning.maxPredictTokens,
              supportsVision: cleanName.includes("vision") || cleanName.includes("llava") || cleanName.includes("minicpm"),
              supportsReasoning: cleanName.includes("r1") || cleanName.includes("deepseek") || cleanName.includes("qwq"),
              sizeBytes: m.size,
              modifiedAt: m.modified_at ? new Date(m.modified_at).getTime() : Date.now(),
              isLoaded: true,
              vramCompatibility: vramComp,
              tuningProfile: tuning,
            };
          });

          const status: LocalServerHealthStatus = {
            provider: "ollama",
            displayName: profile.displayName,
            baseUrl: targetBaseUrl,
            chatCompletionsUrl: targetChatUrl,
            reachable: true,
            latencyMs,
            serverSoftware: "ollama",
            detectedModels,
            activeModelCount: detectedModels.length,
            checkedAt: Date.now(),
            canAutoStart,
          };
          this.cachedStatuses.set("ollama", status);
          return status;
        }
      }

      // OpenAI-compatible /v1/models probe (LM Studio, llama.cpp, vLLM, LocalAI, Custom)
      const modelsUrl = `${targetBaseUrl}/v1/models`;
      const res = await fetch(modelsUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const latencyMs = Math.max(1, Date.now() - startedAt);

      if (res.ok) {
        const body = (await res.json()) as { data?: Array<{ id: string; owned_by?: string; context_length?: number }> };
        const rawData = body.data ?? [];
        const detectedModels: DiscoveredLocalModel[] = rawData.map((m) => {
          const id = m.id;
          const isLlamaCpp = id.includes("gguf") || profile.provider === "llamacpp";
          const vramComp = this.hardwareProfiler.evaluateModel(id);
          const tuning = this.contextAutoTuner.computeTuningProfile(id, m.context_length || 32_768);

          return {
            modelId: id.startsWith(`${provider}/`) ? id : `${provider}/${id}`,
            provider,
            rawName: id,
            displayName: `${profile.displayName} - ${id}`,
            contextWindow: tuning.safeContextTokens,
            maxOutputTokens: tuning.maxPredictTokens,
            supportsVision: id.toLowerCase().includes("vision") || id.toLowerCase().includes("vl"),
            supportsReasoning: id.toLowerCase().includes("r1") || id.toLowerCase().includes("reasoning"),
            isLoaded: true,
            vramCompatibility: vramComp,
            tuningProfile: tuning,
          };
        });

        let serverSoftware: LocalServerHealthStatus["serverSoftware"] = "generic";
        if (provider === "llamacpp" || targetBaseUrl.includes("8080")) serverSoftware = "llama.cpp";
        else if (provider === "lmstudio" || targetBaseUrl.includes("1234")) serverSoftware = "lmstudio";
        else if (provider === "vllm" || targetBaseUrl.includes("8000")) serverSoftware = "vllm";
        else if (provider === "localai") serverSoftware = "localai";

        const status: LocalServerHealthStatus = {
          provider,
          displayName: profile.displayName,
          baseUrl: targetBaseUrl,
          chatCompletionsUrl: targetChatUrl,
          reachable: true,
          latencyMs,
          serverSoftware,
          detectedModels,
          activeModelCount: detectedModels.length,
          checkedAt: Date.now(),
          canAutoStart,
        };
        this.cachedStatuses.set(provider, status);
        return status;
      }

      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    } catch (err: any) {
      clearTimeout(timer);
      const status: LocalServerHealthStatus = {
        provider,
        displayName: profile.displayName,
        baseUrl: targetBaseUrl,
        chatCompletionsUrl: targetChatUrl,
        reachable: false,
        latencyMs: -1,
        serverSoftware: provider === "ollama" ? "ollama" : "generic",
        detectedModels: [],
        activeModelCount: 0,
        error: err?.name === "AbortError" ? "Connection timed out" : err?.message || "Server unreachable",
        checkedAt: Date.now(),
        canAutoStart,
      };
      this.cachedStatuses.set(provider, status);
      return status;
    }
  }

  public async probeAllServers(): Promise<LocalEndpointAuditReport> {
    const providers: LocalProviderKind[] = ["ollama", "lmstudio", "llamacpp", "vllm"];
    const promises = providers.map((p) => this.probeServer(p));
    const results = await Promise.allSettled(promises);

    const statuses: LocalServerHealthStatus[] = [];
    let activeCount = 0;
    let totalModels = 0;
    let recommendedModel: string | undefined;

    for (let i = 0; i < results.length; i++) {
      const res = results[i]!;
      if (res.status === "fulfilled") {
        statuses.push(res.value);
        if (res.value.reachable) {
          activeCount++;
          totalModels += res.value.activeModelCount;
          if (!recommendedModel && res.value.detectedModels.length > 0) {
            recommendedModel = res.value.detectedModels[0]?.modelId;
          }
        }
      }
    }

    return {
      timestamp: Date.now(),
      activeServers: activeCount,
      totalServersChecked: providers.length,
      totalLocalModelsDiscovered: totalModels,
      serverStatuses: statuses,
      recommendedActiveModel: recommendedModel,
      overallHealthy: activeCount > 0,
      hardwareAssessment: this.getHardwareAssessment(),
    };
  }

  public getCachedStatus(provider: LocalProviderKind): LocalServerHealthStatus | undefined {
    return this.cachedStatuses.get(provider);
  }

  public getTroubleshootingCard(provider: LocalProviderKind, endpointUrl?: string): string {
    const guide = this.getQuickstartGuide(provider);
    const targetUrl = endpointUrl || this.getProfile(provider).chatCompletionsUrl;
    const canAuto = Boolean(this.processSupervisor.findBinary(provider));
    const autoFixHint = canAuto
      ? `│  \x1b[1;32mAuto-Launch Available:\x1b[0m Type \x1b[36m/start-local ${provider}\x1b[0m or press \x1b[36mS\x1b[0m in \x1b[36m/local\x1b[0m\n`
      : "";

    return (
      `\x1b[1;33m╭─── 💡 Local LLM Server Offline ───────────────────────────────╮\x1b[0m\n` +
      `│ \x1b[1;37m${guide.displayName}\x1b[0m is not reachable at \x1b[36m${targetUrl}\x1b[0m.\n` +
      `│\n` +
      autoFixHint +
      `│ \x1b[1;32mQuick Start Fix:\x1b[0m\n` +
      `│  1. Run command: \x1b[1;36m${guide.oneLineCommand}\x1b[0m\n` +
      `│  2. Or follow GUI steps: ${guide.guiSteps[0] || "Launch server"}\n` +
      `│  3. Download from: \x1b[4;34m${guide.downloadUrl}\x1b[0m\n` +
      `│\n` +
      `│ \x1b[90mTip: Type \x1b[36m/local\x1b[90m to open the Local Server Dashboard or \x1b[36m/model\x1b[90m to switch.\x1b[0m\n` +
      `\x1b[1;33m╰───────────────────────────────────────────────────────────────╯\x1b[0m`
    );
  }

  public recordTurn(provider: LocalProviderKind, tokens: number, durationMs: number): void {
    this.totalTurns++;
    this.totalTokens += tokens;
    this.totalDurationMs += durationMs;
    this.lastProvider = provider;
    this.lastDurationMs = durationMs;
  }

  public getMetrics(): LocalEndpointMetricsReport {
    const costSaved = (this.totalTokens / 1_000_000) * 3.0; // ~$3.00/1M blended cloud tokens
    return {
      totalLocalTurns: this.totalTurns,
      totalLocalTokens: this.totalTokens,
      meanLatencyMs: this.totalTurns > 0 ? Math.round(this.totalDurationMs / this.totalTurns) : 0,
      lastTurnProvider: this.lastProvider,
      lastTurnDurationMs: this.lastDurationMs,
      estimatedCostSavedUsd: Math.round(costSaved * 100) / 100,
    };
  }
}
