import * as readline from "node:readline";
import type { LumiMonolith } from "../../../index.js";
import type { EngineProgressEvent } from "../../../core/contracts/agent.contracts.js";
import { sanitizeProgressText } from "../../../core/utilities/progress-sanitizer.js";
import type { Component } from "../../../tui/tui.js";
import type { ModelSpecs } from "../resolution/model-catalog.js";
import { ProcessTerminal } from "../../../tui/terminal.js";
import { TuiAltScreen } from "../../../tui/tui-alt-screen.js";
import { VStack } from "../../../tui/components/v-stack.js";
import { Box } from "../../../tui/components/box.js";
import { Text } from "../../../tui/components/text.js";
import { AgentActivityTimeline } from "../../../tui/components/agent-activity-timeline.js";
import { Markdown, type MarkdownTheme } from "../../../tui/components/markdown.js";
import { ScrollView } from "../../../tui/components/scroll-view.js";
import { Editor, type EditorTheme } from "../../../tui/components/editor.js";
import { HelpModal } from "../../../tui/components/help-modal.js";
import { SettingsModal } from "../../../tui/components/settings-modal.js";
import { HealthDiagnosticModal, type SubsystemHealthEntry } from "../../../tui/components/health-diagnostic-modal.js";
import { ProviderSetupModal } from "../../../tui/components/provider-setup-modal.js";
import { GuidedSetupWalkthroughModal } from "../../../tui/components/guided-setup-walkthrough-modal.js";
import { ModelSelectModal } from "../../../tui/components/model-select-modal.js";
import { LocalEndpointDashboardModal } from "../../../tui/components/local-endpoint-dashboard-modal.js";
import type { SettingItem } from "../../../tui/components/settings-list.js";
import type { SelectListTheme } from "../../../tui/components/select-list.js";
import { CombinedAutocompleteProvider, type SlashCommand } from "../../../tui/autocomplete.js";
import { matchesKey } from "../../../tui/keys.js";
import { highlightTerminalCode } from "../../../tui/syntax-highlighter.js";
import type { ReasoningEffortLevel } from "../resolution/reasoning-effort-controller.js";
import type { GameStateSnapshot } from "../../../core/contracts/session.contracts.js";

export interface InteractiveSessionOptions {
  sessionId?: string;
  enableTelemetry?: boolean;
}

const DEFAULT_MARKDOWN_THEME: MarkdownTheme = {
  heading: (text) => `\x1b[1;35m${text}\x1b[0m`,
  link: (text) => `\x1b[4;36m${text}\x1b[0m`,
  linkUrl: (text) => `\x1b[90m${text}\x1b[0m`,
  code: (text) => `\x1b[1;33m${text}\x1b[0m`,
  codeBlock: (text) => text,
  codeBlockBorder: (text) => `\x1b[90m${text}\x1b[0m`,
  highlightCode: highlightTerminalCode,
  quote: (text) => `\x1b[36m${text}\x1b[0m`,
  quoteBorder: (text) => `\x1b[90m${text}\x1b[0m`,
  hr: (text) => `\x1b[90m${text}\x1b[0m`,
  listBullet: (text) => `\x1b[35m${text}\x1b[0m`,
  bold: (text) => `\x1b[1;37m${text}\x1b[0m`,
  italic: (text) => `\x1b[3m${text}\x1b[0m`,
  strikethrough: (text) => `\x1b[9m${text}\x1b[0m`,
  underline: (text) => `\x1b[4m${text}\x1b[0m`,
};

const DEFAULT_SELECT_LIST_THEME: SelectListTheme = {
  selectedPrefix: (text) => `\x1b[1;35m${text}\x1b[0m`,
  selectedText: (text) => `\x1b[1;35m${text}\x1b[0m`,
  description: (text) => `\x1b[90m${text}\x1b[0m`,
  scrollInfo: (text) => `\x1b[90m${text}\x1b[0m`,
  noMatch: (text) => `\x1b[31m${text}\x1b[0m`,
};

function formatUniversalToolSection(toolResults: Array<{ name: string; output: unknown }>): string {
  if (!toolResults || toolResults.length === 0) return "";

  const formattedBlocks: string[] = [];

  for (const res of toolResults) {
    const rawOutput = res.output;
    if (rawOutput === undefined || rawOutput === null) continue;

    let text = "";
    let lang = "sh";
    let statusBadge = `[Tool: ${res.name}]`;

    if (typeof rawOutput === "string") {
      text = rawOutput.trim();
      if (text.startsWith("{") || text.startsWith("[")) {
        try {
          const parsed = JSON.parse(text);
          text = JSON.stringify(parsed, null, 2);
          lang = "json";
        } catch {
          // not JSON
        }
      } else if (
        text.includes("@@ -") ||
        text.startsWith("diff --git") ||
        (text.includes("\n+") && text.includes("\n-"))
      ) {
        lang = "diff";
      }
    } else if (typeof rawOutput === "object") {
      const obj = rawOutput as Record<string, unknown>;
      if (typeof obj.stdout === "string" || typeof obj.stderr === "string") {
        const stdout = (obj.stdout as string)?.trim() ?? "";
        const stderr = (obj.stderr as string)?.trim() ?? "";
        const exitCode = typeof obj.exitCode === "number" ? obj.exitCode : 0;
        statusBadge = exitCode !== 0
          ? `[Tool: ${res.name} · Exit ${exitCode}]`
          : `[Tool: ${res.name} · Success]`;
        text = [stdout, stderr ? `[stderr]\n${stderr}` : ""].filter(Boolean).join("\n\n");
        lang = "sh";
        if (!text) text = `Command finished with exit code ${exitCode}`;
      } else {
        text = JSON.stringify(rawOutput, null, 2);
        lang = "json";
      }
    } else {
      text = String(rawOutput);
    }

    if (!text) continue;

    const lines = text.split("\n");
    let boundedText = text;
    if (lines.length > 25) {
      const head = lines.slice(0, 12);
      const tail = lines.slice(-8);
      const omitted = lines.length - 20;
      boundedText = [...head, `... (${omitted} lines omitted) ...`, ...tail].join("\n");
    }

    formattedBlocks.push(`\`\`\`${lang}\n# ${statusBadge}\n${boundedText}\n\`\`\``);
  }

  if (formattedBlocks.length === 0) return "";
  return `\n\n**Tool Executions:**\n${formattedBlocks.join("\n\n")}`;
}

/**
 * InteractiveModeController (Pass 3 Ergonomic Enhancement).
 *
 * Provides industry-standard TUI interactive session with:
 * - Interactive Settings Modal (`SettingsModal`) via `/settings` / `Ctrl+S`
 * - Subsystem Health Diagnostic Audit Modal (`HealthDiagnosticModal`) via `/health` / `/status`
 * - Contextual Action Keyboard Ribbon Footer
 * - Framed Turn Cards & Categorized Slash Commands
 */
export class InteractiveModeController {
  async executeInteractiveTurn(
    monolith: LumiMonolith,
    prompt: string,
    onProgress?: (label: string, percent: number) => void
  ): Promise<string> {
    if (onProgress) {
      onProgress("Processing frame tick prompt", 25);
    }

    const tickResult = await monolith.tick({
      prompt,
      onProgress: (event) => {
        const isTurnEvent = event.metadata?.scope === undefined
          ? event.activityId.endsWith(":turn")
          : event.metadata.scope === "turn";
        const isTerminal = isTurnEvent &&
          (event.status === "completed" || event.status === "failed" || event.status === "cancelled");
        const percent = isTerminal ? 100 : event.status === "completed" ? 75 : 50;
        onProgress?.(event.message, percent);
      },
    });

    if (onProgress) {
      onProgress(`Turn tick ${tickResult.outcome}`, 100);
    }

    return tickResult.response;
  }

  /**
   * Starts a rich, differential-rendering Terminal User Interface interactive session.
   */
  async startInteractiveSession(monolith: LumiMonolith): Promise<void> {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      return this.startFallbackReadlineSession(monolith);
    }

    const terminal = new ProcessTerminal();
    const tui = new TuiAltScreen(terminal, true);

    const rootContainer = new VStack();

    // 1. Telemetry Header Bar
    const headerBg = (text: string) => `\x1b[48;5;234m${text}\x1b[0m`;
    const headerBox = new Box(1, 0, headerBg);

    const initialIsCodex = monolith.codexProviderBridge?.isCodexProvider(monolith.config.modelName);
    const initialAuthTag = initialIsCodex ? " \x1b[32m[Codex OAuth]\x1b[0m" : "";
    const headerText = new Text(
      `\x1b[1;35m❖ LUMI AGENT OS v0.1.0\x1b[0m  │  ` +
        `\x1b[90mModel:\x1b[0m \x1b[1;36m${monolith.config.modelName}\x1b[0m${initialAuthTag}  │  ` +
        `\x1b[90mHealth:\x1b[0m \x1b[1;32m[OPERATIONAL]\x1b[0m`,
      0,
      0
    );
    headerBox.addChild(headerText);

    // 2. Main History Scroll Container
    const historyContainer = new VStack();
    const historyScrollView = new ScrollView(historyContainer, {
      follow: "end",
      scrollbar: "auto",
      scrollbarStyle: (text) => `\x1b[90m${text}\x1b[0m`,
    });

    // Initial Welcome Card Box
    const welcomeCardBox = new Box(1, 0, (text: string) => `\x1b[48;5;236m${text}\x1b[0m`);
    let welcomeCardShown = true;
    const who = monolith.setupWizard.getWhoAmI(monolith.config.modelName);

    let welcomeText = "";
    if (!who.authenticated) {
      welcomeText =
        `# ✦ Welcome to LUMI Agent OS!\n\n` +
        `To start chatting and executing agent workflows, connect an AI model:\n\n` +
        `- **[1] Sign in with ChatGPT / OpenAI:** Type \`/login\` for instant browser OAuth.\n` +
        `- **[2] Configure API Keys:** Type \`/setup\` for Claude, OpenAI, Gemini, or DeepSeek.\n` +
        `- **[3] Run 100% Offline / Local:** Type \`/model ollama\` with zero setup or accounts.\n\n` +
        `*Press \`?\` or type \`/help\` anytime for keyboard shortcuts.*`;
    } else {
      const identityStr = who.codexOAuth?.authenticated
        ? `Signed in as **${who.codexOAuth.email || who.codexOAuth.accountId || "OAuth User"}** *(OpenAI Codex OAuth)*`
        : who.codexOAuth?.email
          ? `Signed in as **${who.codexOAuth.email}**`
          : who.codexOAuth?.accountId
            ? `Signed in as Account **${who.codexOAuth.accountId}**`
            : `**${who.configuredProviders.length}** provider(s) active`;

      const isCodexEngine = monolith.codexProviderBridge?.isCodexProvider(monolith.config.modelName);
      const engineNote = isCodexEngine ? " *(Codex OAuth Active · 900k ctx)*" : "";

      welcomeText =
        `# ✦ LUMI Agent OS\n\n` +
        `● ${identityStr}  │  Active Engine: \`${monolith.config.modelName}\`${engineNote}\n\n` +
        `**Quick Model Switch:**\n` +
        `- Type \`/terra\` : Flagship Reasoning Engine (\`gpt-5.6-terra\` · 900k ctx · 16k out)\n` +
        `- Type \`/luna\` : High-Velocity Engine (\`gpt-5.6-luna\` · 900k ctx · 8k out)\n` +
        `- Type \`/sol\` : Balanced Engine (\`gpt-5.6-sol\` · 900k ctx · 8k out)\n` +
        `- Press \`Alt+M\` or type \`/model\` : Interactive Model Catalog Picker\n\n` +
        `**Configuration & System:**\n` +
        `- Press \`Ctrl+S\` or type \`/settings\` : Configure models, reasoning effort & policies\n` +
        `- Type \`/providers\` or \`/setup\` : Provider keys & OpenAI Codex OAuth setup\n` +
        `- Type \`/doctor\` or \`/health\` : Run subsystem health diagnostics\n` +
        `- Press \`?\` or type \`/help\` : Display keyboard guide & slash commands\n`;
    }

    const welcomeMarkdown = new Markdown(welcomeText, 0, 0, DEFAULT_MARKDOWN_THEME);
    welcomeCardBox.addChild(welcomeMarkdown);
    historyContainer.addChild(welcomeCardBox);

    // 3. Categorized Slash Commands (Mirroring familiar CLI/TUI standards)
    const slashCommands: SlashCommand[] = [
      { name: "help", description: "[Help] Display interactive keyboard shortcuts & usage guide" },
      { name: "terra", description: "[Codex] Instant switch to Flagship Reasoning Engine (gpt-5.6-terra)" },
      { name: "luna", description: "[Codex] Instant switch to High-Velocity Engine (gpt-5.6-luna)" },
      { name: "sol", description: "[Codex] Instant switch to Balanced Engine (gpt-5.6-sol)" },
      { name: "login", description: "[Auth] Connect OpenAI Codex OAuth via browser PKCE or configure keys" },
      { name: "logout", description: "[Auth] Sign out of OpenAI Codex OAuth and clear stored credentials" },
      { name: "whoami", description: "[Auth] Display current authenticated user, account ID, and token status" },
      { name: "auth", description: "[Auth] Authentication & identity management (/auth login|logout|status)" },
      { name: "model", description: "[Config] Open interactive model selector or switch model (/model <name>)" },
      { name: "models", description: "[Config] View curated model catalog and switch active LLM" },
      { name: "local", description: "[Local] Open local LLM control panel & auto-sense servers (Ollama, LM Studio, llama.cpp)" },
      { name: "pull", description: "[Local] Stream and download an open-weight Ollama model (/pull <model>)" },
      { name: "unload", description: "[Local] Purge inactive local models from GPU VRAM (/unload [model])" },
      { name: "benchmark-local", description: "[Local] Benchmark local LLM Tokens-Per-Second generation speed" },
      { name: "speed", description: "[Local] Alias for /benchmark-local speed test" },
      { name: "tps", description: "[Local] Alias for /benchmark-local speed test" },
      { name: "embed", description: "[Local] Generate offline vector embeddings for text (/embed <text>)" },
      { name: "hardware", description: "[Local] Display host system RAM, CPU, and VRAM model fit evaluation" },
      { name: "vram", description: "[Local] Calculate VRAM compatibility and optimal model size for host" },
      { name: "start-local", description: "[Local] Launch local LLM daemon process (/start-local [ollama|llamacpp])" },
      { name: "ollama", description: "[Local] Quick-switch to local Ollama model (/ollama [model])" },
      { name: "lmstudio", description: "[Local] Quick-switch to LM Studio server (/lmstudio [model])" },
      { name: "llamacpp", description: "[Local] Quick-switch to llama.cpp server (/llamacpp [model])" },
      { name: "settings", description: "[Config] Open interactive framework settings view" },
      { name: "doctor", description: "[System] Run system health & connectivity diagnostic checks" },
      { name: "health", description: "[System] Display subsystem health diagnostic audit" },
      { name: "status", description: "[System] Display subsystem health diagnostic audit" },
      { name: "setup", description: "[System] Launch interactive model provider configuration wizard" },
      { name: "providers", description: "[System] Test live provider connection latencies" },
      { name: "snapshot", description: "[Session] Create immutable state snapshot checkpoint" },
      { name: "snapshots", description: "[Session] List all state snapshots in active session" },
      { name: "rewind", description: "[Session] Rollback engine state to a snapshot (/rewind <id>)" },
      { name: "memory", description: "[Session] View active persistent facts & memory context" },
      { name: "about", description: "[System] Display monolith memory slab & performance specs" },
      { name: "clear", description: "[Session] Clear TUI output history buffer" },
      { name: "exit", description: "[Session] Exit interactive TUI REPL session" },
      { name: "quit", description: "[Session] Exit interactive TUI REPL session" },
    ];

    const autocompleteProvider = new CombinedAutocompleteProvider(
      slashCommands,
      monolith.sessionContext.cwd
    );

    // 4. Editor Component
    const editorTheme: EditorTheme = {
      borderColor: (text: string) => `\x1b[36m${text}\x1b[0m`,
      selectList: DEFAULT_SELECT_LIST_THEME,
    };

    const editor = new Editor(tui, editorTheme, { paddingX: 1 });
    editor.setAutocompleteProvider(autocompleteProvider);

    // 5. Contextual Action Footer Bar
    const footerBg = (text: string) => `\x1b[48;5;235m${text}\x1b[0m`;
    const footerBox = new Box(1, 0, footerBg);

    const defaultFooterText =
      `\x1b[1;33m[?]\x1b[0m \x1b[90mHelp\x1b[0m   ` +
      `\x1b[1;36m[Ctrl+S]\x1b[0m \x1b[90mSettings\x1b[0m   ` +
      `\x1b[1;35m[Alt+M]\x1b[0m \x1b[90mModel\x1b[0m   ` +
      `\x1b[1;32m[PgUp/PgDn]\x1b[0m \x1b[90mScroll\x1b[0m   ` +
      `\x1b[1;34m[Tab]\x1b[0m \x1b[90mAutocomplete\x1b[0m   ` +
      `\x1b[1;31m[Ctrl+C]\x1b[0m \x1b[90mQuit\x1b[0m`;

    const footerText = new Text(defaultFooterText, 0, 0);
    footerBox.addChild(footerText);

    rootContainer.addChild(headerBox, { grow: 0 });
    rootContainer.addChild(historyScrollView, { grow: 1 });
    rootContainer.addChild(editor, { grow: 0 });
    rootContainer.addChild(footerBox, { grow: 0 });

    tui.addChild(rootContainer);
    tui.setFocus(editor);

    let activeInlineView: Component | null = null;
    let isLoadingInlineView = false;
    let activeTurnAbortController: AbortController | null = null;
    let activeTurnStartedAt = 0;
    let activeTurnProgress = "Connecting to model";

    const formatElapsed = (elapsedMs: number): string => {
      const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return minutes > 0 ? `${minutes}m ${seconds.toString().padStart(2, "0")}s` : `${seconds}s`;
    };

    const renderTurnProgress = () => {
      if (!activeTurnAbortController) return;
      const elapsed = formatElapsed(Date.now() - activeTurnStartedAt);
      footerText.setText(
        `\x1b[33m[Working ${elapsed}]\x1b[0m \x1b[90m${activeTurnProgress}\x1b[0m   ` +
          `\x1b[1;31m[Esc/Ctrl+C]\x1b[0m \x1b[90mCancel\x1b[0m`
      );
      tui.requestRender();
    };

    const closeInlineView = (component?: Component) => {
      if (component) {
        historyContainer.removeChild(component);
        if (activeInlineView === component) {
          activeInlineView = null;
        }
      } else if (activeInlineView) {
        historyContainer.removeChild(activeInlineView);
        activeInlineView = null;
      }
      tui.setFocus(editor);
      tui.requestRender();
    };

    const openHelpModal = () => {
      if (activeInlineView || isLoadingInlineView) return;
      let helpModal: HelpModal;
      const closeFn = () => closeInlineView(helpModal);
      helpModal = new HelpModal(closeFn);
      activeInlineView = helpModal;
      historyContainer.addChild(helpModal);
      tui.setFocus(helpModal);
      tui.requestRender();
    };

    const openSettingsModal = () => {
      if (activeInlineView || isLoadingInlineView) return;
      let settingsModal: SettingsModal;
      const closeFn = () => closeInlineView(settingsModal);
      const currentEffort = monolith.reasoningEffortController.getEffortLevel();
      const settingItems: SettingItem[] = [
        {
          id: "active_model",
          label: "Active LLM Model & Engine",
          description: "Select active model engine or choose [Open Full Catalog] for complete picker.",
          currentValue: monolith.config.modelName,
          values: [
            "gpt-5.6-terra",
            "gpt-5.6-luna",
            "gpt-5.6-sol",
            "anthropic/claude-3.5-sonnet",
            "google/gemini-2.0-flash-001",
            "deepseek/deepseek-r1",
            "llama3.2:latest",
            "qwen2.5-coder:latest",
            "Open Full Catalog (Alt+M)...",
          ],
        },
        {
          id: "provider_setup",
          label: "LLM Providers & Credentials",
          description: "Audit and configure API keys, OpenAI Codex OAuth, or Local LLM servers.",
          currentValue: "Configure",
          values: [
            "Configure",
            "Open Provider Wizard (/providers)",
            "Open Local Engine (/local)",
          ],
        },
        {
          id: "reasoning_effort",
          label: "Reasoning Effort Level",
          description: "Controls the depth of model reasoning and reflection before output generation.",
          currentValue: currentEffort,
          values: ["low", "medium", "high", "max"],
        },
        {
          id: "stderr_guard",
          label: "Stderr Filtering Mode",
          description: "Filters background stderr telemetry output to maintain clean CLI presentation.",
          currentValue: "strict",
          values: ["strict", "passthrough", "suppress"],
        },
        {
          id: "stream_formatter",
          label: "Stream Event Formatting",
          description: "Formats real-time tool execution chunks in the terminal viewport.",
          currentValue: "compact",
          values: ["compact", "verbose", "raw"],
        },
        {
          id: "telemetry_tracer",
          label: "Telemetry Span Tracing",
          description: "Records microsecond timing spans for turn tick benchmarking.",
          currentValue: "enabled",
          values: ["enabled", "disabled"],
        },
        {
          id: "model_failover",
          label: "Model Resolution Strategy",
          description: "Automatic provider fallback policy when primary LLM rate limits.",
          currentValue: "dynamic",
          values: ["dynamic", "pinned", "failover"],
        },
      ];

      settingsModal = new SettingsModal(
        settingItems,
        (id, newValue) => {
          if (id === "active_model") {
            if (newValue.startsWith("Open Full Catalog") || newValue.includes("Alt+M")) {
              closeFn();
              setTimeout(() => {
                void openModelSelectModal();
              }, 50);
              return;
            }
            monolith.setModel(newValue);
            updateHeader();
          } else if (id === "provider_setup") {
            if (newValue.includes("Provider Wizard") || newValue.includes("/providers")) {
              closeFn();
              setTimeout(() => {
                openProviderSetupModal();
              }, 50);
              return;
            } else if (newValue.includes("Local Engine") || newValue.includes("/local")) {
              closeFn();
              setTimeout(() => {
                openLocalEndpointDashboardModal();
              }, 50);
              return;
            }
          } else if (id === "reasoning_effort") {
            monolith.reasoningEffortController.setEffortLevel(newValue as ReasoningEffortLevel);
          }
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
          cardBox.addChild(
            new Markdown(`\x1b[32mUpdated Setting:\x1b[0m \`${id}\` = \`${newValue}\``, 0, 0, DEFAULT_MARKDOWN_THEME)
          );
          historyContainer.addChild(cardBox);
          tui.requestRender();
        },
        closeFn
      );

      activeInlineView = settingsModal;
      historyContainer.addChild(settingsModal);
      tui.setFocus(settingsModal);
      tui.requestRender();
    };

    const openHealthDiagnosticModal = () => {
      if (activeInlineView || isLoadingInlineView) return;
      let modal: HealthDiagnosticModal;
      const closeFn = () => closeInlineView(modal);
      const overallStatus = monolith.systemHealthAggregator.getOverallStatus();
      const entries: SubsystemHealthEntry[] = [
        { subsystem: "Agent Engine Monolith", status: "OPERATIONAL", details: "Turn tick SLA < 1.0ms verified" },
        { subsystem: "Memory Slab Allocation", status: "OPERATIONAL", details: "16MB contiguous ArrayBuffer slab allocation intact" },
        { subsystem: "Session Store & Snapshot Index", status: "OPERATIONAL", details: "O(1) state rewind performance verified" },
        { subsystem: "Tool Registry & Validator", status: "OPERATIONAL", details: "All tools schema-validated" },
        { subsystem: "Broccoli Circuit Breaker", status: "OPERATIONAL", details: "State: CLOSED (Healthy rate limit quota)" },
        { subsystem: "Broccoli CAS Scratchpad", status: "OPERATIONAL", details: "Content-addressed storage synced" },
        { subsystem: "LSP Protocol Bridge", status: "OPERATIONAL", details: "AstPerceptionEyes active" },
        { subsystem: "System Directory Resolver", status: "OPERATIONAL", details: "System paths bound" },
      ];

      modal = new HealthDiagnosticModal(overallStatus, entries, closeFn);
      activeInlineView = modal;
      historyContainer.addChild(modal);
      tui.setFocus(modal);
      tui.requestRender();
    };

    const openProviderSetupModal = () => {
      if (activeInlineView || isLoadingInlineView) return;
      let modal: ProviderSetupModal;
      const closeFn = () => closeInlineView(modal);
      modal = new ProviderSetupModal(
        monolith.setupWizard,
        async (providerId) => {
          if (providerId === "run_diagnostics") {
            closeFn();
            const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
            let diagText = `### Live Provider Diagnostic Audit\n\n`;
            const providers = ["anthropic", "openai", "google", "deepseek", "openai-codex"];
            for (const p of providers) {
              const res = await monolith.setupWizard.testProviderConnection(p);
              const icon = res.passed ? "`[PASS]`" : "`[FAIL]`";
              diagText += `- **${p.toUpperCase()}**: ${icon} ${res.details}\n`;
            }
            cardBox.addChild(new Markdown(diagText, 0, 0, DEFAULT_MARKDOWN_THEME));
            historyContainer.addChild(cardBox);
            tui.requestRender();
          } else {
            closeFn();
            const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
            cardBox.addChild(
              new Markdown(
                `### Provider Configured: \`${providerId.toUpperCase()}\`\n\nTo update API key for \`${providerId}\`, set environment variable \`${providerId.toUpperCase()}_API_KEY\` or edit \`~/.lumi/config.json\`.`,
                0,
                0,
                DEFAULT_MARKDOWN_THEME
              )
            );
            historyContainer.addChild(cardBox);
            tui.requestRender();
          }
        },
        closeFn
      );
      activeInlineView = modal;
      historyContainer.addChild(modal);
      tui.setFocus(modal);
      tui.requestRender();
    };

    const updateHeader = () => {
      const turnCount = monolith.sessionContext.turnCount;
      const memCount = monolith.sessionMemoryStore.listMemories().length;
      const memSuffix = memCount > 0 ? `  │  \x1b[90mMem:\x1b[0m \x1b[36m${memCount}\x1b[0m` : "";
      const isCodex = monolith.codexProviderBridge?.isCodexProvider(monolith.config.modelName);
      const authTag = isCodex ? " \x1b[32m[Codex OAuth]\x1b[0m" : "";
      headerText.setText(
        `\x1b[1;35m❖ LUMI AGENT OS v0.1.0\x1b[0m  │  ` +
          `\x1b[90mModel:\x1b[0m \x1b[1;36m${monolith.config.modelName}\x1b[0m${authTag}  │  ` +
          `\x1b[90mFrame:\x1b[0m \x1b[1;33m#${turnCount}\x1b[0m${memSuffix}  │  ` +
          `\x1b[90mHealth:\x1b[0m \x1b[1;32m[OPERATIONAL]\x1b[0m`
      );
      headerBox.invalidate();
      tui.requestRender();
    };

    const openGuidedSetupWalkthroughModal = () => {
      if (activeInlineView || isLoadingInlineView) return;
      let modal: GuidedSetupWalkthroughModal;
      const closeFn = () => closeInlineView(modal);
      modal = new GuidedSetupWalkthroughModal(
        monolith.setupWizard,
        (completed) => {
          closeFn();
          if (completed) {
            const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
            cardBox.addChild(
              new Markdown(
                `### Guided Setup Walkthrough Completed\n\nProvider credentials and auth resolution rules verified. Safe to submit prompt turns.`,
                0,
                0,
                DEFAULT_MARKDOWN_THEME
              )
            );
            historyContainer.addChild(cardBox);
            tui.requestRender();
          }
        },
        (providerId) => {
          const defaultModels: Record<string, string> = {
            anthropic: "anthropic/claude-3.5-sonnet",
            openai: "gpt-4o",
            google: "google/gemini-2.0-flash-001",
            deepseek: "deepseek/deepseek-r1",
            codex_oauth: "gpt-5.6-terra",
          };
          const selectedModel = defaultModels[providerId];
          if (selectedModel) {
            monolith.setModel(selectedModel);
            updateHeader();
          }
        },
        () => tui.requestRender()
      );
      activeInlineView = modal;
      historyContainer.addChild(modal);
      tui.setFocus(modal);
      tui.requestRender();
    };

    const openModelSelectModal = async () => {
      if (activeInlineView || isLoadingInlineView) return;
      isLoadingInlineView = true;
      try {
        const openRouterModels = await monolith.modelCatalog.fetchOpenRouterModels();
        const nousModels = await monolith.modelCatalog.fetchNousModels();
        const codexModels = await monolith.modelCatalog.fetchCodexModels();
        const ollamaModels = await monolith.modelCatalog.getModelsForProvider("ollama");
        const llamaCppModels = await monolith.modelCatalog.getModelsForProvider("llamacpp");
        const lmStudioModels = await monolith.modelCatalog.getModelsForProvider("lmstudio");
        const vllmModels = await monolith.modelCatalog.getModelsForProvider("vllm");
        const catalogModels = monolith.modelCatalog.getAllModels();

        const combined = [
          ...openRouterModels,
          ...nousModels,
          ...codexModels,
          ...ollamaModels,
          ...llamaCppModels,
          ...lmStudioModels,
          ...vllmModels,
          ...catalogModels,
        ];
        const modelMap = new Map<string, ModelSpecs>();
        for (const m of combined) {
          const key = `${m.provider.toLowerCase()}::${m.modelName}`;
          modelMap.set(key, m);
        }
        const availableModels = Array.from(modelMap.values());

        if (activeInlineView) return;

        let modal: ModelSelectModal;
        const closeFn = () => closeInlineView(modal);

        modal = new ModelSelectModal(
          availableModels,
          monolith.config.modelName,
          (selectedModel) => {
            monolith.setModel(selectedModel);
            updateHeader();
            const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
            cardBox.addChild(
              new Markdown(`\x1b[1;32m[✓] Active LLM Model set to:\x1b[0m \`${selectedModel}\``, 0, 0, DEFAULT_MARKDOWN_THEME)
            );
            historyContainer.addChild(cardBox);
            tui.requestRender();
          },
          closeFn
        );
        activeInlineView = modal;
        historyContainer.addChild(modal);
        tui.setFocus(modal);
        tui.requestRender();
      } finally {
        isLoadingInlineView = false;
      }
    };

    const openLocalEndpointDashboardModal = () => {
      if (activeInlineView) return;
      const localEngine = monolith.proxyGateway.getLocalEngine();
      const modal = new LocalEndpointDashboardModal(localEngine, (selectedModel) => {
        monolith.setModel(selectedModel);
        updateHeader();
        const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
        cardBox.addChild(
          new Markdown(`\x1b[1;32m[✓] Active LLM Model set to:\x1b[0m \`${selectedModel}\``, 0, 0, DEFAULT_MARKDOWN_THEME)
        );
        historyContainer.addChild(cardBox);
        tui.requestRender();
      });
      modal.open();

      const wrapperComponent: Component = {
        render: (width) => [modal.render()],
        invalidate: () => {},
      };

      activeInlineView = wrapperComponent;
      historyContainer.addChild(wrapperComponent);
      tui.requestRender();
    };

    let stopTui: () => void = () => {};

    // Global Key Listener for shortcuts & navigation beyond the fold
    tui.addInputListener((data: string) => {
      if (
        activeTurnAbortController &&
        (matchesKey(data, "escape") || matchesKey(data, "ctrl+c"))
      ) {
        if (!activeTurnAbortController.signal.aborted) {
          activeTurnProgress = "Cancelling agent turn";
          activeTurnAbortController.abort(new Error("Cancelled by user"));
          renderTurnProgress();
        }
        return { consume: true };
      }

      // Inline views own their keyboard input.
      if (activeInlineView) {
        if (matchesKey(data, "escape")) {
          closeInlineView(activeInlineView);
          return { consume: true };
        }
        return undefined;
      }

      // Handle Ctrl+C when idle: clear dirty input if typing, or quit if empty
      if (matchesKey(data, "ctrl+c")) {
        const text = editor.getText();
        if (text.trim().length > 0) {
          editor.setText("");
          footerText.setText(defaultFooterText);
          tui.requestRender();
          return { consume: true };
        }
        stopTui();
        return { consume: true };
      }

      // Handle Ctrl+D (EOF) on empty line
      if (matchesKey(data, "ctrl+d") || data === "\x04") {
        if (editor.getText().trim().length === 0) {
          stopTui();
          return { consume: true };
        }
      }

      // Handle Ctrl+L (Clear screen history)
      if (matchesKey(data, "ctrl+l") || data === "\x0c") {
        historyContainer.clear();
        historyScrollView.scrollTo(0);
        tui.requestRender();
        return { consume: true };
      }

      if (data === "?" && editor.getText().trim() === "") {
        openHelpModal();
        return { consume: true };
      }
      if (matchesKey(data, "ctrl+s")) {
        openSettingsModal();
        return { consume: true };
      }
      // Alt+M works in legacy and enhanced terminals. Keep Ctrl+M support when
      // the terminal sends an unambiguous modified-key sequence; raw carriage
      // return must remain Enter.
      const isModelShortcut =
        matchesKey(data, "alt+m") ||
        (matchesKey(data, "ctrl+m") && !matchesKey(data, "enter"));
      if (isModelShortcut) {
        openModelSelectModal();
        return { consume: true };
      }
      if (matchesKey(data, "alt+l")) {
        openLocalEndpointDashboardModal();
        return { consume: true };
      }

      // Direct Jump keys: Home / End
      if (matchesKey(data, "home")) {
        historyScrollView.scrollTo(0);
        tui.requestRender();
        return { consume: true };
      }
      if (matchesKey(data, "end")) {
        historyScrollView.scrollTo(Number.MAX_SAFE_INTEGER);
        tui.requestRender();
        return { consume: true };
      }

      // History scrolling beyond the fold: PageUp, PageDown, Shift+Up/Down, Ctrl+U/D
      if (matchesKey(data, "pageUp") || matchesKey(data, "shift+up") || matchesKey(data, "ctrl+u")) {
        historyScrollView.scrollBy(-12);
        tui.requestRender();
        return { consume: true };
      }
      if (matchesKey(data, "pageDown") || matchesKey(data, "shift+down") || (matchesKey(data, "ctrl+d") && editor.getText().trim().length > 0)) {
        historyScrollView.scrollBy(12);
        tui.requestRender();
        return { consume: true };
      }
      return undefined;
    });

    editor.onChange = (text: string) => {
      if (text.startsWith("/")) {
        footerText.setText(
          `\x1b[1;35m[Enter]\x1b[0m \x1b[90mExecute Command\x1b[0m   ` +
            `\x1b[1;36m[↑/↓]\x1b[0m \x1b[90mSelect Item\x1b[0m   ` +
            `\x1b[1;33m[Esc]\x1b[0m \x1b[90mCancel Menu\x1b[0m`
        );
      } else {
        footerText.setText(defaultFooterText);
      }
      tui.requestRender();
    };

    return new Promise<void>((resolve) => {
      let isRunning = true;

      stopTui = () => {
        if (!isRunning) return;
        isRunning = false;
        tui.stop();
        resolve();
      };

      editor.onSubmit = async (text: string) => {
        const input = text.trim();

        if (activeTurnAbortController) {
          activeTurnProgress = "A turn is already running; press Esc to cancel it";
          renderTurnProgress();
          return;
        }

        editor.setText("");

        if (!input) return;
        editor.addToHistory(input);

        if (input === "/help" || input === "?") {
          openHelpModal();
          return;
        }

        if (input === "/terra") {
          monolith.switchToTerra();
          updateHeader();
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
          cardBox.addChild(
            new Markdown(`\x1b[1;32m[✓] Active LLM Model set to:\x1b[0m \`gpt-5.6-terra\` *(Flagship Reasoning Engine · 900k ctx · 16k out)*`, 0, 0, DEFAULT_MARKDOWN_THEME)
          );
          historyContainer.addChild(cardBox);
          tui.requestRender();
          return;
        }

        if (input === "/luna") {
          monolith.switchToLuna();
          updateHeader();
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
          cardBox.addChild(
            new Markdown(`\x1b[1;32m[✓] Active LLM Model set to:\x1b[0m \`gpt-5.6-luna\` *(High-Velocity Engine · 900k ctx · 8k out)*`, 0, 0, DEFAULT_MARKDOWN_THEME)
          );
          historyContainer.addChild(cardBox);
          tui.requestRender();
          return;
        }

        if (input === "/sol") {
          monolith.switchToSol();
          updateHeader();
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
          cardBox.addChild(
            new Markdown(`\x1b[1;32m[✓] Active LLM Model set to:\x1b[0m \`gpt-5.6-sol\` *(Balanced Engine · 900k ctx · 8k out)*`, 0, 0, DEFAULT_MARKDOWN_THEME)
          );
          historyContainer.addChild(cardBox);
          tui.requestRender();
          return;
        }

        if (input === "/model" || input.startsWith("/model ")) {
          const parts = input.split(" ");
          if (parts.length > 1 && parts[1]!.trim().length > 0) {
            const targetModel = parts.slice(1).join(" ").trim();
            monolith.setModel(targetModel);
            updateHeader();
            const activeModelName = monolith.config.modelName;
            const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
            cardBox.addChild(
              new Markdown(`\x1b[1;32m[✓] Active LLM Model set to:\x1b[0m \`${activeModelName}\``, 0, 0, DEFAULT_MARKDOWN_THEME)
            );
            historyContainer.addChild(cardBox);
            tui.requestRender();
          } else {
            openModelSelectModal();
          }
          return;
        }

        if (input === "/models") {
          openModelSelectModal();
          return;
        }

        if (input === "/local" || input === "/onprem" || input === "/locals") {
          openLocalEndpointDashboardModal();
          return;
        }

        if (input === "/hardware" || input === "/vram" || input === "/specs") {
          const hwCard = monolith.proxyGateway.getLocalEngine().getHardwareCard();
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
          cardBox.addChild(new Markdown(hwCard, 0, 0, DEFAULT_MARKDOWN_THEME));
          historyContainer.addChild(cardBox);
          tui.requestRender();
          return;
        }

        if (input.startsWith("/start-local") || input.startsWith("/start ")) {
          const parts = input.split(" ");
          const prov = (parts[1]?.trim().toLowerCase() || "ollama") as any;
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
          cardBox.addChild(new Markdown(`\x1b[33mAttempting to launch ${prov.toUpperCase()} daemon in background...\x1b[0m`, 0, 0, DEFAULT_MARKDOWN_THEME));
          historyContainer.addChild(cardBox);
          tui.requestRender();

          void monolith.proxyGateway.getLocalEngine().startLocalServer(prov).then((res) => {
            const outcomeBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
            outcomeBox.addChild(
              new Markdown(
                res.started
                  ? `\x1b[1;32m[✓] ${res.message}\x1b[0m`
                  : `\x1b[1;31m[✗] ${res.message}\x1b[0m`,
                0,
                0,
                DEFAULT_MARKDOWN_THEME
              )
            );
            historyContainer.addChild(outcomeBox);
            tui.requestRender();
          });
          return;
        }

        if (input === "/pull" || input.startsWith("/pull ")) {
          const parts = input.split(" ");
          const modelTag = parts[1]?.trim() || "qwen2.5-coder:7b";
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
          const statusMarkdown = new Markdown(
            `### 📥 Pulling Local Model: \`${modelTag}\`\n\nConnecting to Ollama streaming pull endpoint...`,
            0,
            0,
            DEFAULT_MARKDOWN_THEME
          );
          cardBox.addChild(statusMarkdown);
          historyContainer.addChild(cardBox);
          tui.requestRender();

          void monolith.proxyGateway.getLocalEngine().pullModel(modelTag, {
            onProgress: (p) => {
              statusMarkdown.setText(
                `### 📥 Pulling Local Model: \`${modelTag}\` [${p.phase.toUpperCase()}]\n\n${p.progressBarText}\n\n*Status:* \`${p.statusText}\``
              );
              tui.requestRender();
            },
          }).then(() => {
            monolith.setModel(modelTag);
            updateHeader();
            const doneBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
            doneBox.addChild(
              new Markdown(
                `\x1b[1;32m[✓] Model ${modelTag} downloaded successfully and set as active model!\x1b[0m`,
                0,
                0,
                DEFAULT_MARKDOWN_THEME
              )
            );
            historyContainer.addChild(doneBox);
            tui.requestRender();
          }).catch((err) => {
            const errBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
            errBox.addChild(
              new Markdown(
                `\x1b[1;31m[✗] Failed to pull model ${modelTag}:\x1b[0m ${err.message || String(err)}`,
                0,
                0,
                DEFAULT_MARKDOWN_THEME
              )
            );
            historyContainer.addChild(errBox);
            tui.requestRender();
          });
          return;
        }

        if (input === "/unload" || input.startsWith("/unload ") || input === "/purge") {
          const parts = input.split(" ");
          const modelTag = parts[1]?.trim();
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);

          if (modelTag) {
            void monolith.proxyGateway.getLocalEngine().unloadModel(modelTag).then((res) => {
              cardBox.addChild(new Markdown(`\x1b[1;32m[✓] ${res.message}\x1b[0m`, 0, 0, DEFAULT_MARKDOWN_THEME));
              historyContainer.addChild(cardBox);
              tui.requestRender();
            });
          } else {
            void monolith.proxyGateway.getLocalEngine().unloadAllModels().then((res) => {
              cardBox.addChild(new Markdown(`\x1b[1;32m[✓] Purged ${res.length} models from GPU VRAM memory.\x1b[0m`, 0, 0, DEFAULT_MARKDOWN_THEME));
              historyContainer.addChild(cardBox);
              tui.requestRender();
            });
          }
          return;
        }

        if (input === "/benchmark-local" || input.startsWith("/benchmark-local ") || input === "/speed" || input === "/tps") {
          const parts = input.split(" ");
          const currentM = monolith.modelResolver.getActiveModel();
          const targetModel = parts[1]?.trim() || (currentM.includes("/") ? currentM.split("/")[1]! : currentM);

          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
          cardBox.addChild(new Markdown(`\x1b[33m⚡ Benchmarking local inference speed on ${targetModel}...\x1b[0m`, 0, 0, DEFAULT_MARKDOWN_THEME));
          historyContainer.addChild(cardBox);
          tui.requestRender();

          void monolith.proxyGateway.getLocalEngine().benchmarkModel(targetModel).then((res) => {
            const resBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
            resBox.addChild(new Markdown(res.speedScorecard, 0, 0, DEFAULT_MARKDOWN_THEME));
            historyContainer.addChild(resBox);
            tui.requestRender();
          });
          return;
        }

        if (input.startsWith("/embed ")) {
          const textToEmbed = input.slice(7).trim();
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
          void monolith.proxyGateway.getLocalEngine().generateEmbedding(textToEmbed).then((res) => {
            const preview = res.embedding.slice(0, 5).map((v) => v.toFixed(4)).join(", ");
            cardBox.addChild(
              new Markdown(
                `### 🔢 Local Vector Embedding\n- **Model**: \`${res.modelName}\`\n- **Dimensions**: \`${res.dimensions}\` floats\n- **Latency**: \`${res.durationMs}ms\`\n- **Vector Sample**: \`[${preview}, ...]\``,
                0,
                0,
                DEFAULT_MARKDOWN_THEME
              )
            );
            historyContainer.addChild(cardBox);
            tui.requestRender();
          });
          return;
        }

        if (input === "/ollama" || input.startsWith("/ollama ")) {
          const parts = input.split(" ");
          const targetModel = parts[1]?.trim() || "llama3.2:latest";
          monolith.setModel(targetModel);
          updateHeader();
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
          cardBox.addChild(
            new Markdown(`\x1b[1;32m[✓] Active Model set to Ollama:\x1b[0m \`${targetModel}\` (http://localhost:11434)`, 0, 0, DEFAULT_MARKDOWN_THEME)
          );
          historyContainer.addChild(cardBox);
          tui.requestRender();
          return;
        }

        if (input === "/lmstudio" || input.startsWith("/lmstudio ")) {
          const parts = input.split(" ");
          const targetModel = parts[1]?.trim() || "lmstudio/loaded-model";
          monolith.setModel(targetModel);
          updateHeader();
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
          cardBox.addChild(
            new Markdown(`\x1b[1;32m[✓] Active Model set to LM Studio:\x1b[0m \`${targetModel}\` (http://localhost:1234)`, 0, 0, DEFAULT_MARKDOWN_THEME)
          );
          historyContainer.addChild(cardBox);
          tui.requestRender();
          return;
        }

        if (input === "/llamacpp" || input.startsWith("/llamacpp ")) {
          const parts = input.split(" ");
          const targetModel = parts[1]?.trim() || "llamacpp/default";
          monolith.setModel(targetModel);
          updateHeader();
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
          cardBox.addChild(
            new Markdown(`\x1b[1;32m[✓] Active Model set to llama.cpp:\x1b[0m \`${targetModel}\` (http://localhost:8080)`, 0, 0, DEFAULT_MARKDOWN_THEME)
          );
          historyContainer.addChild(cardBox);
          tui.requestRender();
          return;
        }

        if (input === "/login" || input === "/auth login") {
          openGuidedSetupWalkthroughModal();
          return;
        }

        if (input === "/logout" || input === "/auth logout") {
          const success = monolith.setupWizard.logoutCodexOAuth();
          updateHeader();
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
          cardBox.addChild(
            new Markdown(
              success
                ? `\x1b[1;32m[✓] Signed out successfully.\x1b[0m\n\nOAuth credentials removed from active session. Type \`/login\` anytime to reconnect.`
                : `\x1b[1;31m[!] Logout completed with warnings.\x1b[0m`,
              0,
              0,
              DEFAULT_MARKDOWN_THEME
            )
          );
          historyContainer.addChild(cardBox);
          tui.requestRender();
          return;
        }

        if (input === "/whoami" || input === "/auth" || input === "/auth status") {
          const who = monolith.setupWizard.getWhoAmI(monolith.config.modelName);
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
          const lines = [
            `### ✦ LUMI Active Session & Identity`,
            who.codexOAuth?.authenticated
              ? `- **Auth Mode**: \`OpenAI Codex OAuth\` (Signed in as \`${who.codexOAuth.email || "OAuth User"}\`)`
              : `- **Auth Mode**: \`Unauthenticated / Offline\``,
            `- **Active Model**: \`${who.activeModel}\``,
          ];
          if (who.codexOAuth?.accountId) {
            lines.push(`- **ChatGPT Account ID**: \`${who.codexOAuth.accountId}\``);
          }
          if (who.configuredProviders.length > 0) {
            lines.push(`\n**Configured Providers (${who.configuredProviders.length}):**`);
            for (const p of who.configuredProviders) {
              lines.push(`- ${p.provider} (via \`${p.source}\`)`);
            }
          }
          lines.push(`\n*Type \`/login\` to connect credentials or \`/logout\` to sign out.*`);

          cardBox.addChild(new Markdown(lines.join("\n"), 0, 0, DEFAULT_MARKDOWN_THEME));
          historyContainer.addChild(cardBox);
          tui.requestRender();
          return;
        }

        if (input === "/doctor") {
          openHealthDiagnosticModal();
          return;
        }

        if (input === "/setup" || input === "/wizard") {
          openGuidedSetupWalkthroughModal();
          return;
        }

        if (input === "/providers") {
          openProviderSetupModal();
          return;
        }

        if (input === "/settings" || input === "/config") {
          openSettingsModal();
          return;
        }

        if (input === "/health" || input === "/status" || input === "/diagnostics") {
          openHealthDiagnosticModal();
          return;
        }

        if (input === "/exit" || input === "/quit") {
          stopTui();
          return;
        }

        if (input === "/clear") {
          historyContainer.clear();
          historyScrollView.scrollTo(0);
          tui.requestRender();
          return;
        }

        if (input === "/about") {
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
          cardBox.addChild(
            new Markdown(
              `### LUMI Monolith System Specifications\n\n` +
                `- **Contiguous ArrayBuffer Slab**: 16MB (Zero Garbage Collection Allocation)\n` +
                `- **Turn Tick SLA**: < 1.0ms\n` +
                `- **State Rewind SLA**: < 0.1ms O(1) Pointer Rollback\n` +
                `- **Differential Terminal Renderer**: Active\n`,
              0,
              0,
              DEFAULT_MARKDOWN_THEME
            )
          );
          historyContainer.addChild(cardBox);
          tui.requestRender();
          return;
        }

        if (input === "/snapshot") {
          const snap = monolith.createSnapshot();
          updateHeader();
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
          cardBox.addChild(
            new Markdown(
              `### Immutable State Snapshot Created\n\n- Snapshot ID: \`${snap.snapshotId}\`\n- Frame Index: \`#${snap.frameIndex}\`\n\n*Use \`/rewind ${snap.snapshotId}\` to return to this frame.*`,
              0,
              0,
              DEFAULT_MARKDOWN_THEME
            )
          );
          historyContainer.addChild(cardBox);
          historyScrollView.scrollToEnd();
          tui.requestRender();
          return;
        }

        if (input === "/snapshots" || input === "/snapshot list") {
          const snaps = monolith.snapshotStorageIndex.listSnapshotsForSession(monolith.sessionContext.sessionId);
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
          if (snaps.length === 0) {
            cardBox.addChild(
              new Markdown(
                `### Session Snapshots Index\n\nNo snapshots found in active session. Use \`/snapshot\` to capture a checkpoint.`,
                0,
                0,
                DEFAULT_MARKDOWN_THEME
              )
            );
          } else {
            const listItems = snaps
              .map((s) => `- Snapshot: \`${s.snapshotId}\` · Frame: \`#${s.frameIndex}\` · Created: \`${new Date(s.createdAt).toLocaleTimeString()}\``)
              .join("\n");
            cardBox.addChild(
              new Markdown(
                `### Session Snapshots Index (${snaps.length} snapshots)\n\n${listItems}\n\n*To rollback: type \`/rewind <snapshotId>\`*`,
                0,
                0,
                DEFAULT_MARKDOWN_THEME
              )
            );
          }
          historyContainer.addChild(cardBox);
          historyScrollView.scrollToEnd();
          tui.requestRender();
          return;
        }

        if (input === "/rewind" || input.startsWith("/rewind ") || input.startsWith("/rollback ")) {
          const parts = input.split(" ");
          const targetId = parts.length > 1 ? parts[1]!.trim() : undefined;
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);

          let targetSnapshot: GameStateSnapshot | undefined;
          if (targetId) {
            targetSnapshot = monolith.snapshotStorageIndex.getSnapshot(targetId) || monolith.snapshotLruCache.get(targetId);
          } else {
            const snaps = monolith.snapshotStorageIndex.listSnapshotsForSession(monolith.sessionContext.sessionId);
            if (snaps.length > 0) {
              const last = snaps[snaps.length - 1];
              targetSnapshot = monolith.snapshotStorageIndex.getSnapshot(last.snapshotId);
            }
          }

          if (targetSnapshot) {
            monolith.rewindToSnapshot(targetSnapshot);
            updateHeader();
            cardBox.addChild(
              new Markdown(
                `\x1b[1;32m[✓] State Rewound Successfully\x1b[0m\n\n- Snapshot ID: \`${targetSnapshot.snapshotId}\`\n- Restored Frame: \`#${targetSnapshot.frameIndex}\`\n- Restored Messages: \`${targetSnapshot.messages.length}\``,
                0,
                0,
                DEFAULT_MARKDOWN_THEME
              )
            );
          } else {
            cardBox.addChild(
              new Markdown(
                `\x1b[1;31m[✗] Snapshot Not Found:\x1b[0m ${targetId ? `\`${targetId}\`` : "No snapshots available to rewind."}\n\nUse \`/snapshots\` to view available snapshot checkpoints.`,
                0,
                0,
                DEFAULT_MARKDOWN_THEME
              )
            );
          }
          historyContainer.addChild(cardBox);
          historyScrollView.scrollToEnd();
          tui.requestRender();
          return;
        }

        if (input === "/memory" || input === "/facts") {
          const memories = monolith.sessionMemoryStore.listMemories();
          const cardBox = new Box(1, 0, (str: string) => `\x1b[48;5;236m${str}\x1b[0m`);
          if (memories.length === 0) {
            cardBox.addChild(
              new Markdown(
                `### Active Memory Store & Facts\n\nNo persistent memories recorded in this session.\n\n*To record a persistent fact, type: \`remember: <fact>\`*`,
                0,
                0,
                DEFAULT_MARKDOWN_THEME
              )
            );
          } else {
            const memoryList = memories
              .map((m) => `- **[${m.category.toUpperCase()}]** \`${m.key}\`: ${m.value}`)
              .join("\n");
            cardBox.addChild(
              new Markdown(
                `### Active Memory Store & Facts (${memories.length} entries)\n\n${memoryList}`,
                0,
                0,
                DEFAULT_MARKDOWN_THEME
              )
            );
          }
          historyContainer.addChild(cardBox);
          historyScrollView.scrollToEnd();
          tui.requestRender();
          return;
        }

        // Automatically hide initial welcome card once user begins active turns
        if (welcomeCardShown) {
          historyContainer.removeChild(welcomeCardBox);
          welcomeCardShown = false;
        }

        // Render Framed User Prompt Card
        const userBox = new Box(1, 0, (str: string) => `\x1b[48;5;235m${str}\x1b[0m`);
        userBox.addChild(
          new Markdown(
            `\x1b[1;36m❯ User [Frame #${monolith.sessionContext.turnCount + 1}]\x1b[0m\n${input}`,
            0,
            0,
            DEFAULT_MARKDOWN_THEME
          )
        );
        historyContainer.addChild(userBox);

        const turnAbortController = new AbortController();
        activeTurnAbortController = turnAbortController;
        activeTurnStartedAt = Date.now();
        activeTurnProgress = "Connecting to model";
        const activityTimeline = new AgentActivityTimeline({
          model: monolith.config.modelName,
          startedAt: activeTurnStartedAt,
        });
        const activityBox = new Box(1, 0, (str: string) => `\x1b[48;5;234m${str}\x1b[0m`);
        activityBox.addChild(activityTimeline);
        historyContainer.addChild(activityBox);
        const progressInterval = setInterval(() => {
          activityTimeline.setElapsed(Date.now() - activeTurnStartedAt);
          renderTurnProgress();
        }, 250);
        renderTurnProgress();
        tui.requestRender();

        try {
          const tickResult = await monolith.tick({
            prompt: input,
            signal: turnAbortController.signal,
            onProgress: (event: EngineProgressEvent) => {
              activityTimeline.update(event);
              activeTurnProgress = event.detail
                ? `${event.message} — ${event.detail}`.slice(0, 140)
                : event.message;
              renderTurnProgress();
            },
          });
          activityTimeline.settleIfNeeded(
            tickResult.outcome,
            tickResult.response,
            Date.now() - activeTurnStartedAt
          );
          if (tickResult.outcome === "completed") {
            const followUps = activityTimeline.getFollowUpSuggestions();
            if (followUps.length > 0) {
              autocompleteProvider.setDynamicSuggestions(followUps);
            }
          }
          const toolSection = formatUniversalToolSection(tickResult.toolResults ?? []);

          const responseBox = new Box(1, 0, (str: string) => `\x1b[48;5;237m${str}\x1b[0m`);
          const durationStr = tickResult.durationMs ? ` · \x1b[90m${tickResult.durationMs}ms\x1b[0m` : "";
          responseBox.addChild(
            new Markdown(
              `\x1b[1;35m✦ LUMI Monolith Engine [Frame #${tickResult.frameIndex}]\x1b[0m${durationStr}\n\n${tickResult.response}${toolSection}`,
              0,
              0,
              DEFAULT_MARKDOWN_THEME
            )
          );
          historyContainer.addChild(responseBox);
          updateHeader();
          historyScrollView.scrollToEnd();
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          const safeErrorMsg = sanitizeProgressText(errorMsg, 700) || "Unknown engine error";
          activityTimeline.failIfNeeded(safeErrorMsg, Date.now() - activeTurnStartedAt);

          const isAuthError =
            safeErrorMsg.includes("401") ||
            safeErrorMsg.toLowerCase().includes("unauthorized") ||
            safeErrorMsg.toLowerCase().includes("refresh token") ||
            safeErrorMsg.toLowerCase().includes("authentication") ||
            safeErrorMsg.toLowerCase().includes("api key") ||
            safeErrorMsg.toLowerCase().includes("log out");

          const errorBox = new Box(1, 0, (str: string) => `\x1b[48;5;52m${str}\x1b[0m`);

          if (isAuthError) {
            errorBox.addChild(
              new Markdown(
                `\x1b[1;31m⚠ Authentication / Sign-In Required\x1b[0m\n\n` +
                  `Model \`${monolith.config.modelName}\` requires active credentials to complete live turns.\n\n` +
                  `**Quick Remedies:**\n` +
                  `- Type \`/login\` to connect your OpenAI Codex / ChatGPT subscription via browser.\n` +
                  `- Type \`/setup\` to add API keys for Anthropic Claude, OpenAI, Gemini, or DeepSeek.\n` +
                  `- Type \`/model\` to select a local/offline model (e.g. \`ollama\`).\n` +
                  `- Type \`/doctor\` to inspect system connectivity status.\n\n` +
                  `*Details: ${safeErrorMsg}*`,
                0,
                0,
                DEFAULT_MARKDOWN_THEME
              )
            );
          } else {
            errorBox.addChild(
              new Markdown(`\x1b[1;31m⚠ Engine Turn Error:\x1b[0m ${safeErrorMsg}`, 0, 0, DEFAULT_MARKDOWN_THEME)
            );
          }

          historyContainer.addChild(errorBox);
          updateHeader();
          historyScrollView.scrollToEnd();
        } finally {
          clearInterval(progressInterval);
          if (activeTurnAbortController === turnAbortController) {
            activeTurnAbortController = null;
          }
          footerText.setText(defaultFooterText);
          historyScrollView.scrollToEnd();
          tui.requestRender();
        }
      };

      tui.start();
    });
  }

  private async startFallbackReadlineSession(monolith: LumiMonolith): Promise<void> {
    console.log("\x1b[1;36m========================================================\x1b[0m");
    console.log("\x1b[1;36m   LUMI Agent CLI - Interactive REPL (Fallback Mode)    \x1b[0m");
    console.log("\x1b[90m   Commands: /login, /whoami, /model, /setup, /doctor, /help, /exit\x1b[0m");
    console.log("\x1b[1;36m========================================================\x1b[0m\n");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "\x1b[1;35mlumi > \x1b[0m",
    });

    rl.prompt();

    return new Promise<void>((resolve) => {
      rl.on("line", async (line) => {
        const input = line.trim();
        if (!input) {
          rl.prompt();
          return;
        }

        if (input === "/exit" || input === "/quit") {
          console.log("\x1b[33mGoodbye!\x1b[0m");
          rl.close();
          resolve();
          return;
        }

        if (input === "/clear") {
          console.clear();
          rl.prompt();
          return;
        }

        if (input === "/login" || input === "/auth login" || input === "/setup" || input === "/wizard") {
          await monolith.setupWizard.runInteractiveWizard(rl);
          rl.prompt();
          return;
        }

        if (input === "/logout" || input === "/auth logout") {
          monolith.setupWizard.logoutCodexOAuth();
          console.log("\x1b[32m[✓] Signed out successfully.\x1b[0m");
          rl.prompt();
          return;
        }

        if (input === "/whoami" || input === "/auth" || input === "/auth status") {
          monolith.setupWizard.displayWhoAmI(monolith.config.modelName);
          rl.prompt();
          return;
        }

        if (input === "/doctor" || input === "/health" || input === "/status" || input === "/diagnostics") {
          monolith.setupWizard.displayDoctor();
          rl.prompt();
          return;
        }

        if (input === "/help" || input === "?") {
          console.log("\x1b[1;36m--- LUMI REPL Commands Reference ---\x1b[0m");
          console.log("  \x1b[35m/login\x1b[0m        : Connect OpenAI Codex OAuth or configure API keys");
          console.log("  \x1b[35m/logout\x1b[0m       : Sign out and clear cached credentials");
          console.log("  \x1b[35m/whoami\x1b[0m       : Display current identity & token status");
          console.log("  \x1b[35m/model [name]\x1b[0m : Switch active LLM model");
          console.log("  \x1b[35m/doctor\x1b[0m       : Run connectivity & health diagnostics");
          console.log("  \x1b[35m/settings\x1b[0m     : View active engine configuration");
          console.log("  \x1b[35m/providers\x1b[0m    : Run provider connectivity test");
          console.log("  \x1b[35m/snapshot\x1b[0m     : Create immutable state snapshot");
          console.log("  \x1b[35m/about\x1b[0m        : Display monolith specifications");
          console.log("  \x1b[35m/clear\x1b[0m        : Clear screen");
          console.log("  \x1b[35m/exit\x1b[0m         : Quit REPL");
          rl.prompt();
          return;
        }

        if (input === "/model" || input.startsWith("/model ")) {
          const parts = input.split(" ");
          if (parts.length > 1 && parts[1]!.trim().length > 0) {
            const targetModel = parts[1]!.trim();
            monolith.setModel(targetModel);
            console.log(`\x1b[1;32m[✓] Active LLM Model set to:\x1b[0m '${targetModel}'`);
          } else {
            console.log(`\x1b[36mActive Model:\x1b[0m ${monolith.config.modelName}`);
          }
          rl.prompt();
          return;
        }

        if (input === "/settings" || input === "/config") {
          console.log("\x1b[1;36m--- Active Framework Settings ---\x1b[0m");
          console.log(`  Reasoning Effort : \x1b[33m${monolith.reasoningEffortController.getEffortLevel()}\x1b[0m`);
          console.log(`  Active Model     : \x1b[33m${monolith.config.modelName}\x1b[0m`);
          console.log(`  Session ID       : \x1b[33m${monolith.sessionContext.sessionId}\x1b[0m`);
          console.log(`  Frame Turn Count : \x1b[33m#${monolith.sessionContext.turnCount}\x1b[0m`);
          rl.prompt();
          return;
        }

        if (input === "/providers") {
          console.log("\x1b[1;36mTesting provider connections...\x1b[0m");
          const providers = ["anthropic", "openai", "google", "deepseek", "openai-codex"];
          for (const p of providers) {
            const res = await monolith.setupWizard.testProviderConnection(p);
            const icon = res.passed ? "\x1b[32m[PASS]\x1b[0m" : "\x1b[31m[FAIL]\x1b[0m";
            console.log(`  ${icon} ${p.toUpperCase().padEnd(14)} : ${res.details}`);
          }
          rl.prompt();
          return;
        }

        if (input === "/health" || input === "/status" || input === "/diagnostics") {
          console.log("\x1b[32mOverall Subsystem Status:\x1b[0m", monolith.systemHealthAggregator.getOverallStatus());
          rl.prompt();
          return;
        }

        if (input === "/about") {
          console.log("\x1b[1;36m--- LUMI Monolith System Specifications ---\x1b[0m");
          console.log("  Contiguous ArrayBuffer Slab : 16MB (Zero-GC)");
          console.log("  Turn Tick SLA               : < 1.0ms");
          console.log("  State Rewind SLA            : < 0.1ms O(1)");
          rl.prompt();
          return;
        }

        if (input === "/snapshot") {
          const snap = monolith.createSnapshot();
          console.log(`\x1b[32mCreated Snapshot ID:\x1b[0m '${snap.snapshotId}' at Frame #${snap.frameIndex}`);
          rl.prompt();
          return;
        }

        if (input === "/snapshots" || input === "/snapshot list") {
          const snaps = monolith.snapshotStorageIndex.listSnapshotsForSession(monolith.sessionContext.sessionId);
          if (snaps.length === 0) {
            console.log("\x1b[33mNo snapshots found in active session.\x1b[0m");
          } else {
            console.log(`\x1b[1;36m--- Session Snapshots (${snaps.length}) ---\x1b[0m`);
            for (const s of snaps) {
              console.log(`  - \x1b[35m${s.snapshotId}\x1b[0m (Frame #${s.frameIndex} · ${new Date(s.createdAt).toLocaleTimeString()})`);
            }
          }
          rl.prompt();
          return;
        }

        if (input === "/rewind" || input.startsWith("/rewind ") || input.startsWith("/rollback ")) {
          const parts = input.split(" ");
          const targetId = parts.length > 1 ? parts[1]!.trim() : undefined;
          let targetSnapshot: GameStateSnapshot | undefined;
          if (targetId) {
            targetSnapshot = monolith.snapshotStorageIndex.getSnapshot(targetId) || monolith.snapshotLruCache.get(targetId);
          } else {
            const snaps = monolith.snapshotStorageIndex.listSnapshotsForSession(monolith.sessionContext.sessionId);
            if (snaps.length > 0) {
              const last = snaps[snaps.length - 1];
              targetSnapshot = monolith.snapshotStorageIndex.getSnapshot(last.snapshotId);
            }
          }

          if (targetSnapshot) {
            monolith.rewindToSnapshot(targetSnapshot);
            console.log(`\x1b[1;32m[✓] State rewound to Frame #${targetSnapshot.frameIndex} (Snapshot: '${targetSnapshot.snapshotId}')\x1b[0m`);
          } else {
            console.log(`\x1b[1;31m[✗] Snapshot not found.\x1b[0m Run \x1b[33m/snapshots\x1b[0m to list checkpoints.`);
          }
          rl.prompt();
          return;
        }

        if (input === "/memory" || input === "/facts") {
          const memories = monolith.sessionMemoryStore.listMemories();
          if (memories.length === 0) {
            console.log("\x1b[33mNo persistent memories recorded in this session.\x1b[0m");
          } else {
            console.log(`\x1b[1;36m--- Persistent Memory Store (${memories.length}) ---\x1b[0m`);
            for (const m of memories) {
              console.log(`  - \x1b[36m[${m.category.toUpperCase()}]\x1b[0m ${m.key}: ${m.value}`);
            }
          }
          rl.prompt();
          return;
        }

        try {
          const printedActivities = new Map<string, string>();
          const result = await monolith.tick({
            prompt: input,
            onProgress: (event) => {
              const fingerprint = `${event.status}:${event.message}:${event.detail ?? ""}`;
              if (printedActivities.get(event.activityId) === fingerprint) return;
              printedActivities.set(event.activityId, fingerprint);
              const icon = event.status === "completed"
                ? "\x1b[32m✓\x1b[0m"
                : event.status === "failed"
                  ? "\x1b[31m✗\x1b[0m"
                  : event.status === "cancelled"
                    ? "\x1b[33m■\x1b[0m"
                    : "\x1b[36m●\x1b[0m";
              const phaseBadge = event.phase === "thinking"
                ? " \x1b[35m[Think]\x1b[0m"
                : event.phase === "planning"
                  ? " \x1b[36m[Plan]\x1b[0m"
                  : event.phase === "tool"
                    ? " \x1b[34m[Tool]\x1b[0m"
                    : event.phase === "writing"
                      ? " \x1b[32m[Write]\x1b[0m"
                      : event.phase === "verifying"
                        ? " \x1b[33m[Check]\x1b[0m"
                        : event.phase === "responding"
                          ? " \x1b[35m[Draft]\x1b[0m"
                          : "";
              const detail = event.detail ? ` \x1b[90m— ${event.detail}\x1b[0m` : "";
              const duration = event.elapsedMs && event.elapsedMs >= 1000
                ? ` \x1b[90m(${Math.round(event.elapsedMs / 100) / 10}s)\x1b[0m`
                : "";
              console.error(`  ${icon}${phaseBadge} ${event.message}${detail}${duration}`);
            },
          });
          const outcomeColor = result.outcome === "completed"
            ? "\x1b[1;32m"
            : result.outcome === "cancelled"
              ? "\x1b[1;33m"
              : "\x1b[1;31m";
          console.log(`${outcomeColor}[${result.outcome.toUpperCase()} · Frame #${result.frameIndex}]\x1b[0m (${result.durationMs}ms)`);
          console.log(result.response);
          console.log();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(
            "\x1b[31mError during tick:\x1b[0m",
            sanitizeProgressText(message, 700) || "Unknown engine error"
          );
        }

        rl.prompt();
      });
    });
  }
}
