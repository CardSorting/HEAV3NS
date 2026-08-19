import type { Component, Focusable } from "../tui.js";
import { Box } from "./box.js";
import { SelectList, type SelectItem, type SelectListTheme } from "./select-list.js";
import { VStack } from "./v-stack.js";
import { Text } from "./text.js";
import { Markdown, type MarkdownTheme } from "./markdown.js";
import { matchesKey } from "../keys.js";
import type { ModelSpecs } from "../../agents/extensions/resolution/model-catalog.js";
import { LocalHardwareProfiler } from "../../tooling/extensions/endpoints/local-hardware-profiler.js";

const MODEL_SELECT_THEME: SelectListTheme = {
  selectedPrefix: (text) => `\x1b[1;35m▶ \x1b[0m`,
  selectedText: (text) => `\x1b[1;36m${text}\x1b[0m`,
  description: (text) => `\x1b[90m${text}\x1b[0m`,
  scrollInfo: (text) => `\x1b[90m${text}\x1b[0m`,
  noMatch: (text) => `\x1b[31m  No matching models in active category\x1b[0m`,
};

const INSPECTOR_MARKDOWN_THEME: MarkdownTheme = {
  heading: (text) => `\x1b[1;35m${text}\x1b[0m`,
  link: (text) => `\x1b[4;36m${text}\x1b[0m`,
  linkUrl: (text) => `\x1b[90m${text}\x1b[0m`,
  code: (text) => `\x1b[1;33m${text}\x1b[0m`,
  codeBlock: (text) => text,
  codeBlockBorder: (text) => `\x1b[90m${text}\x1b[0m`,
  quote: (text) => `\x1b[36m${text}\x1b[0m`,
  quoteBorder: (text) => `\x1b[90m${text}\x1b[0m`,
  hr: (text) => `\x1b[90m${text}\x1b[0m`,
  listBullet: (text) => `\x1b[35m${text}\x1b[0m`,
  bold: (text) => `\x1b[1;37m${text}\x1b[0m`,
  italic: (text) => `\x1b[3m${text}\x1b[0m`,
  strikethrough: (text) => `\x1b[9m${text}\x1b[0m`,
  underline: (text) => `\x1b[4m${text}\x1b[0m`,
};

export type CategoryTab = "all" | "openai-codex" | "openrouter" | "local" | "ollama";

export class ModelSelectModal implements Component, Focusable {
  focused: boolean = false;
  private readonly container: Box;
  private readonly vstack: VStack;
  private selectList: SelectList;
  private readonly availableModels: ModelSpecs[];
  private readonly modelMap: Map<string, ModelSpecs> = new Map();
  private readonly favoriteModels: Set<string> = new Set([
    "gpt-5.6-terra",
    "gpt-5.6-luna",
    "gpt-5.6-sol",
    "anthropic/claude-3.5-sonnet",
    "qwen2.5-coder:latest",
  ]);
  private activeCategory: CategoryTab = "all";
  private currentModel: string;
  private readonly onSelectModel: (modelName: string) => void;
  private readonly onClose: () => void;
  private inspectorMarkdown: Markdown;

  constructor(
    availableModels: ModelSpecs[],
    currentModel: string,
    onSelectModel: (modelName: string) => void,
    onClose: () => void
  ) {
    this.availableModels = availableModels;
    this.currentModel = currentModel;
    this.onSelectModel = onSelectModel;
    this.onClose = onClose;

    for (const m of availableModels) {
      this.modelMap.set(m.modelName, m);
    }

    const bgFn = (text: string) => `\x1b[48;5;235m${text}\x1b[0m`;
    this.container = new Box(2, 1, bgFn);
    this.vstack = new VStack();

    const firstModel = availableModels[0];
    this.inspectorMarkdown = new Markdown(
      this.buildInspectorText(firstModel, currentModel),
      0,
      0,
      INSPECTOR_MARKDOWN_THEME
    );

    this.selectList = this.createSelectListForCategory(this.activeCategory);

    this.renderModal();
    this.container.addChild(this.vstack);
  }

  private isLocalSpec(m: ModelSpecs): boolean {
    if (m.isLocal) return true;
    const p = m.provider.toLowerCase();
    return (
      p === "ollama" ||
      p === "llamacpp" ||
      p === "lmstudio" ||
      p === "vllm" ||
      p === "localai" ||
      p === "local" ||
      p === "onprem" ||
      p === "custom" ||
      m.modelName.includes(":latest") ||
      m.modelName.startsWith("llamacpp/") ||
      m.modelName.startsWith("lmstudio/")
    );
  }

  private createSelectListForCategory(category: CategoryTab): SelectList {
    let filtered = this.availableModels;
    if (category === "local" || category === "ollama") {
      filtered = this.availableModels.filter((m) => this.isLocalSpec(m));
    } else if (category !== "all") {
      filtered = this.availableModels.filter((m) => m.provider.toLowerCase() === category);
    }

    // Sort pinned favorites to the top
    filtered.sort((a, b) => {
      const aFav = this.favoriteModels.has(a.modelName) ? 1 : 0;
      const bFav = this.favoriteModels.has(b.modelName) ? 1 : 0;
      return bFav - aFav;
    });

    const items: SelectItem[] = filtered.map((m) => {
      const isCurrent = m.modelName === this.currentModel ? " [ACTIVE]" : "";
      const isFav = this.favoriteModels.has(m.modelName) ? " [★ FAV]" : "";
      const isLocalTag = this.isLocalSpec(m) ? " [LOCAL]" : "";
      const ctxKb = Math.round(m.contextWindowTokens / 1000);
      const desc = `[${m.provider.toUpperCase()}] Ctx: ${ctxKb}k | Out: ${m.maxOutputTokens}${isCurrent}${isFav}${isLocalTag}`;
      return {
        value: m.modelName,
        label: `${this.favoriteModels.has(m.modelName) ? "★ " : ""}${m.modelName}`,
        description: desc,
      };
    });

    const list = new SelectList(
      items,
      7,
      MODEL_SELECT_THEME,
      { minPrimaryColumnWidth: 35, maxPrimaryColumnWidth: 46 }
    );

    list.onSelectionChange = (item) => {
      const spec = this.modelMap.get(item.value);
      if (spec) {
        this.inspectorMarkdown = new Markdown(
          this.buildInspectorText(spec, this.currentModel),
          0,
          0,
          INSPECTOR_MARKDOWN_THEME
        );
        this.renderModal();
      }
    };

    list.onSelect = (item) => {
      this.onSelectModel(item.value);
      this.onClose();
    };
    list.onCancel = () => {
      this.onClose();
    };

    return list;
  }

  private renderModal(): void {
    this.vstack.clear();

    const title = new Text(
      `\x1b[1;35m━━━ SELECT ACTIVE LLM MODEL (CURRENT: \x1b[1;36m${this.currentModel}\x1b[1;35m) ━━━\x1b[0m`,
      0,
      0
    );
    this.vstack.addChild(title);

    // Render Category Filter Tabs Header Bar
    const tabAll = this.activeCategory === "all" ? "\x1b[1;36m[1: ALL]\x1b[0m" : "\x1b[90m[1: ALL]\x1b[0m";
    const tabCodex = this.activeCategory === "openai-codex" ? "\x1b[1;36m[2: CODEX OAUTH]\x1b[0m" : "\x1b[90m[2: CODEX OAUTH]\x1b[0m";
    const tabRouter = this.activeCategory === "openrouter" ? "\x1b[1;36m[3: OPENROUTER]\x1b[0m" : "\x1b[90m[3: OPENROUTER]\x1b[0m";
    const isLocalActive = this.activeCategory === "local" || this.activeCategory === "ollama";
    const tabLocal = isLocalActive ? "\x1b[1;36m[4: LOCAL / ON-PREM]\x1b[0m" : "\x1b[90m[4: LOCAL / ON-PREM]\x1b[0m";

    const tabsHeader = new Text(`${tabAll}  ${tabCodex}  ${tabRouter}  ${tabLocal}`, 0, 0);
    this.vstack.addChild(tabsHeader);
    this.vstack.addChild(this.selectList);

    const inspectorBox = new Box(1, 0, (text: string) => `\x1b[48;5;236m${text}\x1b[0m`);
    inspectorBox.addChild(this.inspectorMarkdown);
    this.vstack.addChild(inspectorBox);

    const footerGuide = new Text(
      `\x1b[90m[1-4/Tab] Filter  │  [t] Terra  [l] Luna  [s] Sol  │  [f] Toggle Fav  │  [Enter] Select  │  [Esc] Close\x1b[0m`,
      0,
      0
    );
    this.vstack.addChild(footerGuide);
    this.container.invalidate();
  }

  private buildInspectorText(spec: ModelSpecs | undefined, currentModel: string): string {
    if (!spec) return `*No model details available.*`;
    const isActive = spec.modelName === currentModel ? " `[ACTIVE MODEL]`" : "";
    const isFav = this.favoriteModels.has(spec.modelName) ? " `[★ FAVORITE]`" : "";
    const isLocal = this.isLocalSpec(spec);
    const localBadge = isLocal ? " `[100% PRIVATE & OFFLINE]`" : "";
    const vision = spec.supportsVision ? "`[YES]`" : "`[NO]`";
    const reasoning = spec.supportsReasoning ? "`[YES]`" : "`[NO]`";
    const ctxKb = Math.round(spec.contextWindowTokens / 1000);
    const latency = spec.estimatedLatencyMs ?? (isLocal ? 5 : spec.provider === "openai-codex" ? 45 : 120);
    const inPrice = isLocal || spec.inputPricePer1M === 0 ? "Free / Local Hardware" : `$${spec.inputPricePer1M.toFixed(2)}/1M`;
    const outPrice = isLocal || spec.outputPricePer1M === 0 ? "Free / Local Hardware" : `$${spec.outputPricePer1M.toFixed(2)}/1M`;

    let vramSection = "";
    if (isLocal) {
      const profiler = new LocalHardwareProfiler();
      const vram = profiler.evaluateModel(spec.modelName);
      vramSection = `\n- **VRAM Fit**: \`${vram.badge}\` — *${vram.explanation}*`;
    }

    return (
      `#### Live Model Detail Inspector${isActive}${isFav}${localBadge}\n` +
      `- **Provider**: \`${spec.provider.toUpperCase()}\` — ${spec.description || spec.modelName}\n` +
      `- **Context Window**: \`${spec.contextWindowTokens.toLocaleString()} tokens (${ctxKb}k)\` │ **Max Output**: \`${spec.maxOutputTokens.toLocaleString()} tokens\`\n` +
      `- **Pricing Specs**: Input: \`${inPrice}\` │ Output: \`${outPrice}\` │ **Est. Latency**: \`~${latency}ms\`\n` +
      `- **Capabilities**: Vision: ${vision} │ Reasoning Mode: ${reasoning}` +
      vramSection
    );
  }

  invalidate(): void {
    this.container.invalidate();
    this.selectList.invalidate();
  }

  handleInput(data: string): void {
    // Instant hotkeys for core Codex models: Terra, Luna, Sol
    if (data === "t" || data === "T") {
      this.onSelectModel("gpt-5.6-terra");
      this.onClose();
      return;
    }
    if (data === "l" || data === "L") {
      this.onSelectModel("gpt-5.6-luna");
      this.onClose();
      return;
    }
    if (data === "s" || data === "S") {
      this.onSelectModel("gpt-5.6-sol");
      this.onClose();
      return;
    }

    // Handle category tab switches via number keys 1-4 or Tab
    if (data === "1") {
      this.activeCategory = "all";
      this.selectList = this.createSelectListForCategory(this.activeCategory);
      this.renderModal();
      return;
    }
    if (data === "2") {
      this.activeCategory = "openai-codex";
      this.selectList = this.createSelectListForCategory(this.activeCategory);
      this.renderModal();
      return;
    }
    if (data === "3") {
      this.activeCategory = "openrouter";
      this.selectList = this.createSelectListForCategory(this.activeCategory);
      this.renderModal();
      return;
    }
    if (data === "4") {
      this.activeCategory = "local";
      this.selectList = this.createSelectListForCategory(this.activeCategory);
      this.renderModal();
      return;
    }
    if (data === "\t") {
      const cats: CategoryTab[] = ["all", "openai-codex", "openrouter", "local"];
      const currentNorm = this.activeCategory === "ollama" ? "local" : this.activeCategory;
      const nextIdx = (cats.indexOf(currentNorm) + 1) % cats.length;
      this.activeCategory = cats[nextIdx]!;
      this.selectList = this.createSelectListForCategory(this.activeCategory);
      this.renderModal();
      return;
    }

    // Toggle favorite model with 'f' key
    if (data === "f" || data === "F") {
      const selected = this.selectList.getSelectedItem();
      if (selected) {
        if (this.favoriteModels.has(selected.value)) {
          this.favoriteModels.delete(selected.value);
        } else {
          this.favoriteModels.add(selected.value);
        }
        this.selectList = this.createSelectListForCategory(this.activeCategory);
        this.renderModal();
      }
      return;
    }

    this.selectList.handleInput(data);
  }

  render(width: number): string[] {
    return this.container.render(width);
  }
}
