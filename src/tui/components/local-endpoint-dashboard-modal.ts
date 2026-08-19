/**
 * local-endpoint-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for browsing local on-premises LLM servers,
 * auto-sensing Ollama, llama.cpp, LM Studio, and vLLM endpoints, discovered model library,
 * hardware VRAM compatibility, in-TUI model pulling, beginner quickstarts, and live diagnostics (Phase 105 / ADR-052).
 */

import type {
  DiscoveredLocalModel,
  LocalEndpointAuditReport,
  LocalEndpointMetricsReport,
  LocalHardwareAssessment,
  LocalProviderKind,
  LocalServerHealthStatus,
  ModelPullProgress,
} from "../../core/contracts/local-endpoints.contracts.js";
import { DeterministicLocalEndpointEngine } from "../../tooling/extensions/endpoints/deterministic-local-endpoint-engine.js";

export type LocalDashboardViewMode =
  | "fleet"
  | "models"
  | "pull"
  | "hardware"
  | "endpoints"
  | "guides"
  | "diagnostics";

export class LocalEndpointDashboardModal {
  private readonly engine: DeterministicLocalEndpointEngine;
  private viewMode: LocalDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;
  private auditReport: LocalEndpointAuditReport | null = null;
  private pullProgress: ModelPullProgress | null = null;
  private isPulling = false;
  private statusBanner?: string;
  private readonly onSelectModel?: (modelName: string) => void;

  constructor(
    engine?: DeterministicLocalEndpointEngine,
    onSelectModel?: (modelName: string) => void
  ) {
    this.engine = engine || new DeterministicLocalEndpointEngine();
    this.viewMode = "fleet";
    this.selectedIndex = 0;
    this.isVisible = false;
    this.onSelectModel = onSelectModel;
  }

  public open(): void {
    this.isVisible = true;
    this.selectedIndex = 0;
    void this.refreshFleet();
  }

  public close(): void {
    this.isVisible = false;
  }

  public isOpen(): boolean {
    return this.isVisible;
  }

  public setViewMode(mode: LocalDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): LocalDashboardViewMode {
    const modes: LocalDashboardViewMode[] = [
      "fleet",
      "models",
      "pull",
      "hardware",
      "endpoints",
      "guides",
      "diagnostics",
    ];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx]!;
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public async refreshFleet(): Promise<void> {
    this.auditReport = await this.engine.probeAllServers();
  }

  public handleKey(key: string): { action: "render" | "close" | "select" | "none"; selectedModel?: string } {
    if (!this.isVisible) return { action: "none" };

    const k = key.toLowerCase();

    switch (k) {
      case "q":
      case "escape":
        this.close();
        return { action: "close" };

      case "\t":
      case "tab":
        this.cycleViewMode();
        return { action: "render" };

      case "1":
        this.setViewMode("fleet");
        return { action: "render" };

      case "2":
        this.setViewMode("models");
        return { action: "render" };

      case "3":
        this.setViewMode("pull");
        return { action: "render" };

      case "4":
        this.setViewMode("hardware");
        return { action: "render" };

      case "5":
        this.setViewMode("endpoints");
        return { action: "render" };

      case "6":
        this.setViewMode("guides");
        return { action: "render" };

      case "7":
        this.setViewMode("diagnostics");
        return { action: "render" };

      case "s":
        if (this.viewMode === "fleet") {
          void this.triggerAutoStart("ollama");
          return { action: "render" };
        }
        break;

      case "p":
        if (this.viewMode === "models" || this.viewMode === "fleet") {
          this.setViewMode("pull");
          return { action: "render" };
        }
        break;

      case "u":
      case "U":
        if (this.viewMode === "models") {
          const allModels = this.getAllDiscoveredModels();
          const target = allModels[this.selectedIndex];
          if (target) {
            void this.triggerUnload(target.modelId);
            return { action: "render" };
          }
        }
        void this.triggerUnloadAll();
        return { action: "render" };

      case "b":
      case "B":
        if (this.viewMode === "models") {
          const allModels = this.getAllDiscoveredModels();
          const target = allModels[this.selectedIndex];
          if (target) {
            void this.triggerBenchmark(target.modelId);
            return { action: "render" };
          }
        }
        break;

      case "r":
        void this.refreshFleet();
        return { action: "render" };

      case "up":
      case "k":
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        return { action: "render" };

      case "down":
      case "j":
        this.selectedIndex++;
        return { action: "render" };

      case "\r":
      case "\n":
      case "enter":
        if (this.viewMode === "models") {
          const allModels = this.getAllDiscoveredModels();
          const target = allModels[this.selectedIndex];
          if (target) {
            this.onSelectModel?.(target.modelId);
            this.close();
            return { action: "select", selectedModel: target.modelId };
          }
        } else if (this.viewMode === "pull") {
          const recs = this.engine.getQuickstartGuide("ollama").recommendedModels;
          const target = recs[this.selectedIndex];
          if (target && !this.isPulling) {
            void this.triggerPull(target.name);
            return { action: "render" };
          }
        }
        break;
    }

    return { action: "render" };
  }

  private async triggerAutoStart(provider: LocalProviderKind): Promise<void> {
    this.statusBanner = `\x1b[33mAttempting to spawn ${provider.toUpperCase()} daemon...\x1b[0m`;
    const res = await this.engine.startLocalServer(provider);
    if (res.started) {
      this.statusBanner = `\x1b[32m✓ ${res.message}\x1b[0m`;
      await this.refreshFleet();
    } else {
      this.statusBanner = `\x1b[31m✗ ${res.message}\x1b[0m`;
    }
  }

  public async triggerPull(modelTag: string): Promise<void> {
    this.isPulling = true;
    this.statusBanner = `\x1b[36mConnecting to pull ${modelTag}...\x1b[0m`;
    try {
      await this.engine.pullModel(modelTag, {
        onProgress: (p) => {
          this.pullProgress = p;
        },
      });
      this.statusBanner = `\x1b[32m✓ Successfully pulled ${modelTag}!\x1b[0m`;
      await this.refreshFleet();
    } catch (err: any) {
      this.statusBanner = `\x1b[31m✗ Pull failed: ${err.message || String(err)}\x1b[0m`;
    } finally {
      this.isPulling = false;
    }
  }

  public async triggerUnload(modelTag: string): Promise<void> {
    this.statusBanner = `\x1b[33mPurging ${modelTag} from GPU VRAM...\x1b[0m`;
    const res = await this.engine.unloadModel(modelTag);
    if (res.success) {
      this.statusBanner = `\x1b[32m✓ ${res.message}\x1b[0m`;
      await this.refreshFleet();
    } else {
      this.statusBanner = `\x1b[31m✗ Unload failed: ${res.message}\x1b[0m`;
    }
  }

  public async triggerUnloadAll(): Promise<void> {
    this.statusBanner = `\x1b[33mPurging all inactive models from GPU VRAM...\x1b[0m`;
    const res = await this.engine.unloadAllModels();
    this.statusBanner = `\x1b[32m✓ GPU VRAM memory reclaimed (${res.length} models purged).\x1b[0m`;
    await this.refreshFleet();
  }

  public async triggerBenchmark(modelTag: string): Promise<void> {
    this.statusBanner = `\x1b[36mRunning live inference benchmark on ${modelTag}...\x1b[0m`;
    const res = await this.engine.benchmarkModel(modelTag, { isSimulated: false });
    if (res.status === "completed") {
      this.statusBanner = `\x1b[32m✓ Benchmark: ${res.tokensPerSecond} tok/s (TTFT: ${res.ttftMs}ms)\x1b[0m`;
    } else {
      this.statusBanner = `\x1b[31m✗ Benchmark: ${res.error || "Server offline"}\x1b[0m`;
    }
  }

  private getAllDiscoveredModels(): DiscoveredLocalModel[] {
    if (!this.auditReport) return [];
    return this.auditReport.serverStatuses.flatMap((s) => s.detectedModels);
  }

  public render(): string {
    const lines: string[] = [];

    // Modal Frame Header
    lines.push("\x1b[1;35m╭─────────────────────────────────────────────────────────────────────────────╮\x1b[0m");
    lines.push("│ \x1b[1;37m✦ LOCAL & ON-PREMISES LLM CONTROL PANEL\x1b[0m \x1b[90m(100% Private & Offline)\x1b[0m             │");
    lines.push("\x1b[1;35m├─────────────────────────────────────────────────────────────────────────────┤\x1b[0m");

    // 7-Tab Navigation Bar
    const tabItem = (key: string, label: string, mode: LocalDashboardViewMode) => {
      return this.viewMode === mode
        ? `\x1b[1;30;46m [${key}:${label}] \x1b[0m`
        : `\x1b[90m[${key}:${label}]\x1b[0m`;
    };

    const navRow = [
      tabItem("1", "FLEET", "fleet"),
      tabItem("2", "MODELS", "models"),
      tabItem("3", "PULL", "pull"),
      tabItem("4", "HARDWARE", "hardware"),
      tabItem("5", "ENDPOINTS", "endpoints"),
      tabItem("6", "GUIDES", "guides"),
      tabItem("7", "TELEMETRY", "diagnostics"),
    ].join(" ");
    lines.push(`│  ${navRow}  │`);
    lines.push("\x1b[1;35m├─────────────────────────────────────────────────────────────────────────────┤\x1b[0m");

    if (this.statusBanner) {
      lines.push(`│  ${this.statusBanner}`);
      lines.push("\x1b[1;35m├─────────────────────────────────────────────────────────────────────────────┤\x1b[0m");
    }

    // Body by View Mode
    switch (this.viewMode) {
      case "fleet":
        lines.push(...this.renderFleetTab());
        break;
      case "models":
        lines.push(...this.renderModelsTab());
        break;
      case "pull":
        lines.push(...this.renderPullTab());
        break;
      case "hardware":
        lines.push(...this.renderHardwareTab());
        break;
      case "endpoints":
        lines.push(...this.renderEndpointsTab());
        break;
      case "guides":
        lines.push(...this.renderGuidesTab());
        break;
      case "diagnostics":
        lines.push(...this.renderDiagnosticsTab());
        break;
    }

    // Modal Footer
    lines.push("\x1b[1;35m├─────────────────────────────────────────────────────────────────────────────┤\x1b[0m");
    lines.push("│  \x1b[90m[1-7/Tab] Tabs │ [S] Start │ [P] Pull │ [U] Unload │ [B] Speed │ [Enter] Switch │ [Esc] Close\x1b[0m │");
    lines.push("\x1b[1;35m╰─────────────────────────────────────────────────────────────────────────────╯\x1b[0m");

    return lines.join("\n");
  }

  private renderFleetTab(): string[] {
    const lines: string[] = [];
    const statuses = this.auditReport?.serverStatuses ?? [];

    lines.push("│  \x1b[1;36mSERVER FLEET AUTO-SENSING & LIVE HEALTH\x1b[0m                                   │");
    lines.push("│  \x1b[90mDetects running Ollama, LM Studio, llama.cpp, and vLLM daemons automatically.\x1b[0m│");
    lines.push("│");

    if (statuses.length === 0) {
      lines.push("│  \x1b[33mProbing local ports (11434, 1234, 8080, 8000)...\x1b[0m");
    } else {
      for (const s of statuses) {
        const badge = s.reachable
          ? `\x1b[1;32m● ONLINE\x1b[0m  \x1b[33m${s.latencyMs}ms\x1b[0m (${s.activeModelCount} model${s.activeModelCount === 1 ? "" : "s"})`
          : `\x1b[90m○ OFFLINE\x1b[0m ${s.canAutoStart ? "\x1b[36m[Press 'S' to Start]\x1b[0m" : ""}`;

        lines.push(`│  • \x1b[1;37m${s.displayName.padEnd(26)}\x1b[0m \x1b[36m${s.baseUrl.padEnd(24)}\x1b[0m ${badge}`);
      }
    }

    lines.push("│");
    const activeCount = this.auditReport?.activeServers ?? 0;
    const totalModels = this.auditReport?.totalLocalModelsDiscovered ?? 0;
    lines.push(`│  \x1b[90mFleet Summary:\x1b[0m \x1b[1m${activeCount}\x1b[0m online • \x1b[1m${totalModels}\x1b[0m discovered model(s) • \x1b[32m100% Free / $0.00\x1b[0m`);

    return lines;
  }

  private renderModelsTab(): string[] {
    const lines: string[] = [];
    const models = this.getAllDiscoveredModels();

    lines.push("│  \x1b[1;36mDISCOVERED LOCAL MODEL LIBRARY & VRAM SUITABILITY\x1b[0m                         │");
    lines.push("│  \x1b[90mSelect any model and press [Enter] to switch active model instantly.\x1b[0m       │");
    lines.push("│");

    if (models.length === 0) {
      lines.push("│  \x1b[33mNo local models detected on active servers.\x1b[0m");
      lines.push("│  \x1b[90mTip: Go to Tab [3: PULL] or press 'P' to download popular models in 1-click!\x1b[0m");
    } else {
      const displayCount = Math.min(models.length, 6);
      for (let i = 0; i < displayCount; i++) {
        const m = models[i]!;
        const isSelected = i === this.selectedIndex;
        const pointer = isSelected ? "\x1b[1;32m▸\x1b[0m" : " ";
        const nameStyled = isSelected ? `\x1b[1;32;4m${m.modelId}\x1b[0m` : `\x1b[37m${m.modelId}\x1b[0m`;
        const vramBadge = m.vramCompatibility?.badge || "\x1b[32m[🟢 Local]\x1b[0m";

        lines.push(`│  ${pointer} ${nameStyled.padEnd(30)} \x1b[90m(${m.provider})\x1b[0m ${vramBadge}`);
      }
    }

    return lines;
  }

  private renderPullTab(): string[] {
    const lines: string[] = [];
    const recs = this.engine.getQuickstartGuide("ollama").recommendedModels;

    lines.push("│  \x1b[1;36mIN-APP MODEL DOWNLOADER & HUB\x1b[0m                                         │");
    lines.push("│  \x1b[90mDownload models directly without leaving LUMI. Uses Ollama streaming API.\x1b[0m  │");
    lines.push("│");

    if (this.pullProgress && this.isPulling) {
      lines.push(`│  \x1b[1;33mPulling:\x1b[0m \x1b[1;36m${this.pullProgress.modelTag}\x1b[0m [${this.pullProgress.phase.toUpperCase()}]`);
      lines.push(`│  ${this.pullProgress.progressBarText}`);
      lines.push(`│  \x1b[90mStatus:\x1b[0m ${this.pullProgress.statusText}`);
    } else {
      lines.push("│  \x1b[1;37mRecommended Quick Downloads (Press [Enter] to pull):\x1b[0m");
      for (let i = 0; i < recs.length; i++) {
        const rec = recs[i]!;
        const isSelected = i === this.selectedIndex;
        const pointer = isSelected ? "\x1b[1;32m▸\x1b[0m" : " ";
        const nameStyled = isSelected ? `\x1b[1;32;4m${rec.name}\x1b[0m` : `\x1b[37m${rec.name}\x1b[0m`;
        lines.push(`│  ${pointer} ${nameStyled.padEnd(26)} \x1b[90m${rec.ramRequired.padEnd(24)}\x1b[0m`);
        lines.push(`│     \x1b[90m└─ ${rec.description}\x1b[0m`);
      }
    }

    return lines;
  }

  private renderHardwareTab(): string[] {
    const lines: string[] = [];
    const hw = this.auditReport?.hardwareAssessment || this.engine.getHardwareAssessment();
    const usedBytes = hw.totalMemoryBytes - hw.freeMemoryBytes;
    const usedGb = Math.round((usedBytes / (1024 * 1024 * 1024)) * 10) / 10;
    const usedPercent = Math.round((usedBytes / hw.totalMemoryBytes) * 100);

    const barWidth = 24;
    const filledBlocks = Math.round((usedPercent / 100) * barWidth);
    const emptyBlocks = barWidth - filledBlocks;
    const progressBar = `\x1b[36m[${"█".repeat(filledBlocks)}${"░".repeat(emptyBlocks)}]\x1b[0m ${usedPercent}% (${usedGb}/${hw.totalMemoryGb} GB)`;

    lines.push("│  \x1b[1;36mSYSTEM HARDWARE & LOCAL VRAM CAPACITY\x1b[0m                                 │");
    lines.push(`│  • \x1b[90mHost Architecture:\x1b[0m  \x1b[37m${hw.platform} (${hw.arch})\x1b[0m • \x1b[90mCPU:\x1b[0m \x1b[37m${hw.cpuCores} cores\x1b[0m`);
    lines.push(`│  • \x1b[90mTotal System RAM:\x1b[0m   \x1b[1;33m${hw.totalMemoryGb} GB\x1b[0m (${hw.freeMemoryGb} GB currently free)`);
    lines.push(`│  • \x1b[90mRAM Utilization:\x1b[0m    ${progressBar}`);
    lines.push(`│  • \x1b[90mGPU / Metal VRAM:\x1b[0m   \x1b[1;32m${hw.estimatedGpuHeadroomGb} GB headroom\x1b[0m ${hw.hasAppleSiliconMetal ? "\x1b[32m(Apple Metal UMA)\x1b[0m" : ""}`);
    lines.push("│");
    lines.push(`│  \x1b[1;37mRecommended Model Size for this Machine:\x1b[0m`);
    lines.push(`│  \x1b[32m✓ ${hw.recommendedMaxModelParams}\x1b[0m (e.g. \x1b[36m${hw.recommendedModelTier}\x1b[0m)`);

    return lines;
  }

  private renderEndpointsTab(): string[] {
    const lines: string[] = [];
    const profiles = this.engine.getAllProfiles();

    lines.push("│  \x1b[1;36mCONFIGURED LOCAL ENDPOINT PROFILES\x1b[0m                                    │");
    lines.push("│");
    for (const p of profiles) {
      lines.push(`│  • \x1b[1;37m${p.displayName.padEnd(24)}\x1b[0m \x1b[36m${p.chatCompletionsUrl}\x1b[0m`);
      lines.push(`│    \x1b[90m└─ Port: ${p.defaultPort} • Timeout: ${p.timeoutMs / 1000}s • Auth: ${p.apiKey ? "Bearer" : "None (Local)"}\x1b[0m`);
    }

    return lines;
  }

  private renderGuidesTab(): string[] {
    const lines: string[] = [];
    const guides = this.engine.getAllQuickstartGuides().slice(0, 2);

    lines.push("│  \x1b[1;36mBEGINNER LOCAL LLM SETUP QUICKSTARTS\x1b[0m                                 │");
    for (const g of guides) {
      lines.push(`│  • \x1b[1;37m${g.displayName}\x1b[0m \x1b[90m(${g.tagline})\x1b[0m`);
      lines.push(`│    \x1b[90mCommand:\x1b[0m \x1b[1;36m${g.oneLineCommand}\x1b[0m`);
      lines.push(`│    \x1b[90mGUI:\x1b[0m ${g.guiSteps[0] || "Download app"}`);
    }

    return lines;
  }

  private renderDiagnosticsTab(): string[] {
    const lines: string[] = [];
    const metrics = this.engine.getMetrics();

    lines.push("│  \x1b[1;36mLOCAL LLM SLA & TELEMETRY DIAGNOSTICS\x1b[0m                                │");
    lines.push(`│  • \x1b[90mTotal Local Turns Executed:\x1b[0m \x1b[1;32m${metrics.totalLocalTurns}\x1b[0m`);
    lines.push(`│  • \x1b[90mTotal Local Tokens Processed:\x1b[0m \x1b[1;33m${metrics.totalLocalTokens.toLocaleString()}\x1b[0m`);
    lines.push(`│  • \x1b[90mMean Local Turn Latency:\x1b[0m      \x1b[36m${metrics.meanLatencyMs}ms\x1b[0m`);
    lines.push(`│  • \x1b[90mEstimated Cloud Cost Saved:\x1b[0m   \x1b[1;32m$${metrics.estimatedCostSavedUsd.toFixed(2)} USD\x1b[0m`);
    if (metrics.lastTurnProvider) {
      lines.push(`│  • \x1b[90mLast Active Engine:\x1b[0m           \x1b[37m${metrics.lastTurnProvider}\x1b[0m (${metrics.lastTurnDurationMs}ms)`);
    }

    return lines;
  }
}
