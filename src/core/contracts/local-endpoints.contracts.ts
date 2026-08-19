/**
 * local-endpoints.contracts.ts
 *
 * Core contracts for local and on-premises LLM endpoints, server auto-sensing,
 * model discovery, quickstart guides, hardware VRAM assessment, in-TUI model pulling,
 * daemon process supervision, context auto-tuning, inference speed benchmarking,
 * VRAM memory reclaiming, and offline embeddings (Phase 105 / ADR-052).
 */

export type LocalProviderKind =
  | "ollama"
  | "llamacpp"
  | "lmstudio"
  | "vllm"
  | "localai"
  | "custom";

export interface LocalEndpointProfile {
  id: string;
  provider: LocalProviderKind;
  displayName: string;
  baseUrl: string;
  chatCompletionsUrl: string;
  defaultPort: number;
  apiKey?: string;
  customHeaders?: Record<string, string>;
  timeoutMs: number;
  isDefault?: boolean;
  notes?: string;
}

export interface DiscoveredLocalModel {
  modelId: string;
  provider: LocalProviderKind;
  rawName: string;
  displayName: string;
  parameterSize?: string;
  quantization?: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsReasoning?: boolean;
  modifiedAt?: number;
  sizeBytes?: number;
  isLoaded: boolean;
  vramCompatibility?: ModelVramCompatibility;
  tuningProfile?: LocalContextTuningProfile;
}

export interface LocalServerHealthStatus {
  provider: LocalProviderKind;
  displayName: string;
  baseUrl: string;
  chatCompletionsUrl: string;
  reachable: boolean;
  latencyMs: number;
  serverSoftware: "ollama" | "llama.cpp" | "lmstudio" | "vllm" | "localai" | "generic";
  version?: string;
  detectedModels: DiscoveredLocalModel[];
  activeModelCount: number;
  error?: string;
  checkedAt: number;
  canAutoStart?: boolean;
}

export interface LocalQuickstartGuide {
  provider: LocalProviderKind;
  displayName: string;
  tagline: string;
  downloadUrl: string;
  defaultPort: number;
  oneLineCommand: string;
  guiSteps: string[];
  recommendedModels: Array<{
    name: string;
    description: string;
    ramRequired: string;
    command: string;
    vramTier?: string;
  }>;
}

export interface LocalEndpointAuditReport {
  timestamp: number;
  activeServers: number;
  totalServersChecked: number;
  totalLocalModelsDiscovered: number;
  serverStatuses: LocalServerHealthStatus[];
  recommendedActiveModel?: string;
  overallHealthy: boolean;
  hardwareAssessment?: LocalHardwareAssessment;
}

export interface LocalEndpointMetricsReport {
  totalLocalTurns: number;
  totalLocalTokens: number;
  meanLatencyMs: number;
  lastTurnProvider?: LocalProviderKind;
  lastTurnDurationMs?: number;
  estimatedCostSavedUsd: number;
}

/**
 * System Hardware & VRAM Profiling Contracts
 */
export type VramCompatibilityTier =
  | "optimal_gpu"       // 100% GPU VRAM fit (Fastest inference)
  | "partial_offload"   // Fits mostly in GPU, some layers in RAM
  | "cpu_spill"         // Exceeds GPU, runs in system RAM (slower)
  | "insufficient_ram"; // Exceeds system RAM (swap thrashing / OOM risk)

export interface LocalHardwareAssessment {
  timestamp: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  totalMemoryGb: number;
  freeMemoryGb: number;
  cpuCores: number;
  cpuModel: string;
  arch: string;
  platform: "darwin" | "linux" | "win32" | string;
  hasAppleSiliconMetal: boolean;
  estimatedGpuHeadroomBytes: number;
  estimatedGpuHeadroomGb: number;
  recommendedMaxModelParams: string;
  recommendedModelTier: string;
  summaryText: string;
}

export interface ModelVramCompatibility {
  modelId: string;
  parameterSizeNumericB: number; // e.g. 7.0 for 7B
  quantizationBits: number;      // e.g. 4 for Q4_K_M
  estimatedWeightBytes: number;
  estimatedKvCacheBytes: number;
  estimatedTotalMemoryBytes: number;
  estimatedTotalMemoryGb: number;
  tier: VramCompatibilityTier;
  badge: string;                 // e.g. "[🟢 100% GPU / Instant]"
  explanation: string;
  isRecommendedForHost: boolean;
}

/**
 * In-TUI & CLI Model Pulling Streaming Contracts
 */
export type ModelPullPhase =
  | "initializing"
  | "pulling_manifest"
  | "downloading"
  | "verifying"
  | "writing"
  | "completed"
  | "failed";

export interface ModelPullProgress {
  modelTag: string;
  phase: ModelPullPhase;
  statusText: string;
  completedBytes: number;
  totalBytes: number;
  percentage: number;
  speedBytesPerSec: number;
  etaSeconds: number;
  layerDigest?: string;
  error?: string;
  done: boolean;
  progressBarText: string;
}

export interface ProcessSpawnResult {
  provider: LocalProviderKind;
  started: boolean;
  pid?: number;
  message: string;
  commandAttempted: string;
  alreadyRunning: boolean;
  error?: string;
}

export interface LocalFailoverRoute {
  primaryProvider: LocalProviderKind;
  backupProviders: LocalProviderKind[];
  activeProvider: LocalProviderKind;
  lastFailoverAt?: number;
  failoverReason?: string;
}

/**
 * Local Inference Benchmark & Speedometer Contracts
 */
export interface LocalInferenceBenchmarkResult {
  modelName: string;
  provider: LocalProviderKind;
  timestamp: number;
  ttftMs: number;               // Time To First Token in ms
  tokensPerSecond: number;      // Generation throughput
  generatedTokens: number;      // Number of output tokens
  promptTokens: number;         // Prompt token length
  totalDurationMs: number;      // Total wall clock time
  vramUsageEstimatedMb: number; // Peak VRAM during generation
  status: "completed" | "failed" | "timeout";
  speedScorecard: string;       // Formatted visual scorecard
  error?: string;
}

/**
 * Local Context Window Auto-Tuner Contracts
 */
export interface LocalContextTuningProfile {
  modelName: string;
  requestedContextTokens: number;
  safeContextTokens: number;
  maxPredictTokens: number;
  recommendedGpuLayers: number;
  autoTuned: boolean;
  tuningRationale: string;
}

/**
 * Local VRAM Memory Reclaimer Contracts
 */
export interface LocalModelUnloadResult {
  modelTag: string;
  provider: LocalProviderKind;
  success: boolean;
  freedVramEstimatedMb: number;
  message: string;
  error?: string;
}

/**
 * Offline Local Embeddings Contracts
 */
export interface LocalEmbeddingResult {
  modelName: string;
  provider: LocalProviderKind;
  embedding: number[];
  dimensions: number;
  durationMs: number;
  tokensProcessed: number;
}
