import type { ModelSpecs } from "../../agents/extensions/resolution/model-catalog.js"
import {
	CLAUDE_SUBSCRIPTION_DIRECTSDK_DEFAULT_MODEL,
	CLAUDE_SUBSCRIPTION_DIRECTSDK_PROVIDER,
	getAgentProviderLabel,
	isClaudeSubscriptionDirectSdkProvider,
	OPENAI_CODEX_PROVIDER,
} from "../../core/providers/provider-ids.js"
import { LocalHardwareProfiler } from "../../tooling/extensions/endpoints/local-hardware-profiler.js"
import type { Component, Focusable } from "../tui.js"
import { Box } from "./box.js"
import { Markdown, type MarkdownTheme } from "./markdown.js"
import { type SelectItem, SelectList, type SelectListTheme } from "./select-list.js"
import { Text } from "./text.js"
import { VStack } from "./v-stack.js"
import { matchesKey } from "../keys.js"

const MODEL_SELECT_THEME: SelectListTheme = {
	selectedPrefix: () => "\x1b[1;35m▶ \x1b[0m",
	selectedText: (text) => `\x1b[1;36m${text}\x1b[0m`,
	description: (text) => `\x1b[90m${text}\x1b[0m`,
	scrollInfo: (text) => `\x1b[90m${text}\x1b[0m`,
	noMatch: () => "\x1b[31m  No matching models in active category\x1b[0m",
}

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
}

export type CategoryTab = "all" | "openai-codex" | "claude-subscription-directsdk-experimental" | "custom"

export interface ModelSelectModalOptions {
	activeProvider?: string
	catalogNotice?: string
	onRefresh?: () => void
}

export class ModelSelectModal implements Component, Focusable {
	focused = false
	private readonly container: Box
	private readonly vstack: VStack
	private selectList: SelectList
	private readonly availableModels: ModelSpecs[]
	private readonly modelMap: Map<string, ModelSpecs> = new Map()
	private readonly activeProvider: string
	private readonly favoriteModels: Set<string> = new Set([
		"gpt-5.6-terra",
		"openai-codex/gpt-5.6-terra",
		CLAUDE_SUBSCRIPTION_DIRECTSDK_DEFAULT_MODEL,
	])
	private activeCategory: CategoryTab = "all"
	private currentModel: string
	private readonly catalogNotice?: string
	private readonly onRefresh?: () => void
	private searchQuery = ""
	private searchActive = false
	private readonly onSelectModel: (modelName: string, provider?: string) => void
	private readonly onClose: () => void
	private inspectorMarkdown: Markdown

	constructor(
		availableModels: ModelSpecs[],
		currentModel: string,
		onSelectModel: (modelName: string, provider?: string) => void,
		onClose: () => void,
		options: ModelSelectModalOptions = {},
	) {
		const activeProvider =
			options.activeProvider ??
			(currentModel.toLowerCase().startsWith("claude-") ? CLAUDE_SUBSCRIPTION_DIRECTSDK_PROVIDER : OPENAI_CODEX_PROVIDER)
		this.activeProvider = activeProvider
		this.availableModels =
			availableModels.length > 0
				? availableModels
				: [
						isClaudeSubscriptionDirectSdkProvider(activeProvider)
							? {
									modelName: CLAUDE_SUBSCRIPTION_DIRECTSDK_DEFAULT_MODEL,
									provider: CLAUDE_SUBSCRIPTION_DIRECTSDK_PROVIDER,
									contextWindowTokens: 1_000_000,
									maxOutputTokens: 128_000,
									inputPricePer1M: 0,
									outputPricePer1M: 0,
									supportsVision: true,
									supportsReasoning: true,
									estimatedLatencyMs: 1_500,
									description: "Claude route through the signed-in Claude Code subscription transport",
								}
							: {
									modelName: "gpt-5.6-terra",
									provider: OPENAI_CODEX_PROVIDER,
									contextWindowTokens: 900_000,
									maxOutputTokens: 128_000,
									inputPricePer1M: 2.25,
									outputPricePer1M: 9.0,
									supportsVision: true,
									supportsReasoning: true,
									estimatedLatencyMs: 25,
									description: "Flagship Frontier Reasoning Engine (900k context window)",
								},
					]
		this.currentModel = currentModel
		this.catalogNotice = options.catalogNotice
		this.onRefresh = options.onRefresh
		this.onSelectModel = onSelectModel
		this.onClose = onClose

		for (const m of this.availableModels) {
			this.modelMap.set(m.modelName, m)
		}

		const bgFn = (text: string) => `\x1b[48;5;235m${text}\x1b[0m`
		this.container = new Box(2, 1, bgFn)
		this.vstack = new VStack()

		const firstModel = this.availableModels[0]
		const initialModel = this.modelMap.get(currentModel) ?? firstModel
		this.inspectorMarkdown = new Markdown(this.buildInspectorText(initialModel, currentModel), 0, 0, INSPECTOR_MARKDOWN_THEME)

		this.selectList = this.createSelectListForCategory(this.activeCategory)

		this.renderModal()
		this.container.addChild(this.vstack)
	}

	private isLocalSpec(m: ModelSpecs): boolean {
		if (m.isLocal) return true
		const p = m.provider.toLowerCase()
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
		)
	}

	private isOpenAiSpec(m: ModelSpecs): boolean {
		return m.provider.toLowerCase() === OPENAI_CODEX_PROVIDER || m.modelName.startsWith(`${OPENAI_CODEX_PROVIDER}/`)
	}

	private modelsForCategory(category: CategoryTab): ModelSpecs[] {
		if (category === "all") return [...this.availableModels]
		if (category === "openai-codex") return this.availableModels.filter((m) => this.isOpenAiSpec(m))
		if (category === "claude-subscription-directsdk-experimental") {
			return this.availableModels.filter((m) => isClaudeSubscriptionDirectSdkProvider(m.provider))
		}
		// The custom tab is a semantic bucket for local/on-prem routes rather
		// than a single provider ID (Ollama, LM Studio, llama.cpp, etc.).
		return this.availableModels.filter((m) => this.isLocalSpec(m))
	}

	private categoryCount(category: CategoryTab): number {
		return this.modelsForCategory(category).length
	}

	private createSelectListForCategory(category: CategoryTab): SelectList {
		const filtered = this.modelsForCategory(category)

		// Sort pinned favorites to the top
		filtered.sort((a, b) => {
			const aFav = this.favoriteModels.has(a.modelName) ? 1 : 0
			const bFav = this.favoriteModels.has(b.modelName) ? 1 : 0
			return bFav - aFav
		})

		const items: SelectItem[] = filtered.map((m) => {
			const isCurrent = m.modelName === this.currentModel ? " [ACTIVE]" : ""
			const isFav = this.favoriteModels.has(m.modelName) ? " [★ FAV]" : ""
			const isLocalTag = this.isLocalSpec(m) ? " [LOCAL]" : ""
			const isSubscriptionTag = isClaudeSubscriptionDirectSdkProvider(m.provider) ? " [SUBSCRIPTION]" : ""
			const isLiveRoute = m.catalogSource === "live" ? " [LIVE ACCOUNT]" : ""
			const isFallbackRoute = m.catalogSource === "pinned" ? " [VERIFIED FALLBACK]" : ""
			const isFreeTag =
				!isSubscriptionTag && (m.modelName.includes(":free") || (m.inputPricePer1M === 0 && m.outputPricePer1M === 0))
					? " [FREE]"
					: ""
			const contextLabel = m.contextWindowTokens >= 1_000_000 ? "1M" : `${Math.round(m.contextWindowTokens / 1000)}k`
			const displayName = m.displayName?.trim()
			const routeLabel = displayName && displayName.toLowerCase() !== m.modelName.toLowerCase() ? displayName : m.modelName
			const providerLabel = getAgentProviderLabel(m.provider)
			const availabilityNote = m.availabilityNote ? ` · ${m.availabilityNote}` : ""
			const desc =
				`${providerLabel} · ${contextLabel} context · ${m.maxOutputTokens.toLocaleString("en-US")} max output` +
				`${availabilityNote}${isCurrent}${isLiveRoute}${isFallbackRoute}${isFav}${isLocalTag}${isFreeTag}`
			const listLabel = routeLabel === m.modelName ? m.modelName : `${routeLabel} · ${m.modelName}`
			return {
				value: m.modelName,
				label: `${this.favoriteModels.has(m.modelName) ? "★ " : ""}${listLabel}`,
				description: desc,
			}
		})

		const list = new SelectList(items, 7, MODEL_SELECT_THEME, { minPrimaryColumnWidth: 35, maxPrimaryColumnWidth: 46 })
		const currentIndex = items.findIndex((item) => item.value === this.currentModel)
		if (currentIndex >= 0) list.setSelectedIndex(currentIndex)

		list.onSelectionChange = (item) => {
			this.updateInspector(item.value)
			this.renderModal()
		}

		list.onSelect = (item) => {
			const spec = this.modelMap.get(item.value)
			this.onSelectModel(item.value, spec?.provider)
			this.onClose()
		}
		list.onCancel = () => {
			this.onClose()
		}

		return list
	}

	private updateInspector(modelName: string): void {
		const spec = this.modelMap.get(modelName)
		if (spec)
			this.inspectorMarkdown = new Markdown(
				this.buildInspectorText(spec, this.currentModel),
				0,
				0,
				INSPECTOR_MARKDOWN_THEME,
			)
	}

	private renderModal(): void {
		this.vstack.clear()

		const providerLabel = getAgentProviderLabel(this.activeProvider)
		const routeCount = this.categoryCount(this.activeCategory)
		const routeNoun = routeCount === 1 ? "route" : "routes"
		const title = new Text(
			`\x1b[1;35mMODEL SELECTOR\x1b[0m  \x1b[90mProvider:\x1b[0m \x1b[1;35m${providerLabel}\x1b[0m  \x1b[90mActive:\x1b[0m \x1b[1;36m${this.currentModel}\x1b[0m`,
			0,
			0,
		)
		this.vstack.addChild(title)
		if (this.catalogNotice) {
			this.vstack.addChild(new Text(`\x1b[90m${this.catalogNotice}\x1b[0m`, 0, 0))
		}

		// Render familiar category tabs with counts so users can predict whether
		// switching filters will produce an empty state.
		const tab = (key: string, category: CategoryTab, label: string): string => {
			const text = `[${key}] ${label} · ${this.categoryCount(category)}`
			return this.activeCategory === category ? `\x1b[1;36m${text}\x1b[0m` : `\x1b[90m${text}\x1b[0m`
		}
		const tabAll = tab("1", "all", "ALL")
		const tabCodex = tab("2", "openai-codex", "OPENAI CODEX")
		const tabClaude = tab("3", "claude-subscription-directsdk-experimental", "CLAUDE CODE")
		const tabCustom = tab("4", "custom", "LOCAL / CUSTOM")

		const tabsHeader = new Text(`${tabAll}  ${tabCodex}  ${tabClaude}  ${tabCustom}`, 0, 0)
		this.vstack.addChild(tabsHeader)
		this.vstack.addChild(
			new Text(`\x1b[90mShowing ${routeCount} ${routeNoun} · choose a route to inspect its capabilities\x1b[0m`, 0, 0),
		)
		if (this.searchActive) {
			this.vstack.addChild(new Text(`\x1b[1;33mSearch:\x1b[0m /${this.searchQuery}\x1b[90m█\x1b[0m`, 0, 0))
		}
		this.vstack.addChild(this.selectList)

		const inspectorBox = new Box(1, 0, (text: string) => `\x1b[48;5;236m${text}\x1b[0m`)
		inspectorBox.addChild(this.inspectorMarkdown)
		this.vstack.addChild(inspectorBox)

		const footerGuide = new Text(
			"\x1b[90m[/] Search  │  [↑/↓] Navigate  │  [Enter] Use  │  [f] Favorite  │  [r] Refresh  │  [1–4]/[Tab] Filter  │  [Esc] Close\x1b[0m",
			0,
			0,
		)
		this.vstack.addChild(footerGuide)
		this.container.invalidate()
	}

	private buildInspectorText(spec: ModelSpecs | undefined, currentModel: string): string {
		if (!spec) return "*No model details available.*"
		const isActive = spec.modelName === currentModel ? " `[ACTIVE MODEL]`" : ""
		const isFav = this.favoriteModels.has(spec.modelName) ? " `[★ FAVORITE]`" : ""
		const isLocal = this.isLocalSpec(spec)
		const displayName = spec.displayName?.trim()
		const hasDisplayName = Boolean(displayName && displayName.toLowerCase() !== spec.modelName.toLowerCase())
		const availability =
			spec.catalogSource === "live"
				? "Live account picker"
				: spec.catalogSource === "pinned"
					? "Verified fallback route"
					: "Provider catalog"
		const localBadge = isLocal ? " `[100% PRIVATE & OFFLINE]`" : ""
		const vision = spec.supportsVision ? "`[YES]`" : "`[NO]`"
		const reasoning = spec.supportsReasoning ? "`[YES]`" : "`[NO]`"
		const contextLabel = spec.contextWindowTokens >= 1_000_000 ? "1M" : `${Math.round(spec.contextWindowTokens / 1000)}k`
		const latency = spec.estimatedLatencyMs ?? (isLocal ? 5 : 25)
		const inPrice = isLocal || spec.inputPricePer1M === 0 ? "Free / Local Hardware" : `$${spec.inputPricePer1M.toFixed(2)}/1M`
		const outPrice =
			isLocal || spec.outputPricePer1M === 0 ? "Free / Local Hardware" : `$${spec.outputPricePer1M.toFixed(2)}/1M`

		let vramSection = ""
		if (isLocal) {
			const profiler = new LocalHardwareProfiler()
			const vram = profiler.evaluateModel(spec.modelName)
			vramSection = `\n- **VRAM Fit**: \`${vram.badge}\` — *${vram.explanation}*`
		}

		return (
			`### ${hasDisplayName ? displayName : spec.modelName}${isActive}${isFav}${localBadge}\n` +
			(hasDisplayName ? `\`${spec.modelName}\`\n` : "") +
			`- **Provider**: \`${getAgentProviderLabel(spec.provider)}\`\n` +
			`- **Availability**: \`${availability}\`${spec.availabilityNote ? ` · ${spec.availabilityNote}` : ""}\n` +
			`- **Context Window**: \`${contextLabel} tokens\`\n` +
			`- **Max Output**: \`${spec.maxOutputTokens.toLocaleString("en-US")} tokens\`\n` +
			`- **Pricing**: In: \`${inPrice}\` | Out: \`${outPrice}\`\n` +
			`- **Capabilities**: Vision: ${vision} | Reasoning: ${reasoning}\n` +
			`- **Est. Latency**: \`~${latency}ms\`\n` +
			`- **Description**: *${spec.description || "Frontier Model"}*${vramSection}`
		)
	}

	render(width: number): string[] {
		return this.container.render(width)
	}

	invalidate(): void {
		this.container.invalidate()
		this.selectList.invalidate()
	}

	handleInput(data: string): void {
		// Familiar command-palette search: slash enters a scoped route search;
		// Escape clears it first and closes the modal only when search is idle.
		if (!this.searchActive && data === "/") {
			this.searchActive = true
			this.searchQuery = ""
			this.renderModal()
			return
		}
		if (this.searchActive) {
			if (matchesKey(data, "escape")) {
				this.searchActive = false
				this.searchQuery = ""
				this.selectList.setFilter("")
				this.renderModal()
				return
			}
			if (matchesKey(data, "backspace")) {
				this.searchQuery = this.searchQuery.slice(0, -1)
				this.selectList.setFilter(this.searchQuery)
				const selected = this.selectList.getSelectedItem()
				if (selected) this.updateInspector(selected.value)
				this.renderModal()
				return
			}
			if (data.length === 1 && data >= " " && data !== "\t") {
				this.searchQuery += data
				this.selectList.setFilter(this.searchQuery)
				const selected = this.selectList.getSelectedItem()
				if (selected) this.updateInspector(selected.value)
				this.renderModal()
				return
			}
		}

		// Handle category tab switches via number keys 1-4 or Tab
		if (data === "1") {
			this.activeCategory = "all"
			this.selectList = this.createSelectListForCategory(this.activeCategory)
			this.renderModal()
			return
		}
		if (data === "2") {
			this.activeCategory = "openai-codex"
			this.selectList = this.createSelectListForCategory(this.activeCategory)
			this.renderModal()
			return
		}
		if (data === "3") {
			this.activeCategory = "claude-subscription-directsdk-experimental"
			this.selectList = this.createSelectListForCategory(this.activeCategory)
			this.renderModal()
			return
		}
		if (data === "4") {
			this.activeCategory = "custom"
			this.selectList = this.createSelectListForCategory(this.activeCategory)
			this.renderModal()
			return
		}
		if (data === "\t") {
			const cats: CategoryTab[] = ["all", "openai-codex", "claude-subscription-directsdk-experimental", "custom"]
			const nextIdx = (cats.indexOf(this.activeCategory) + 1) % cats.length
			const nextCat = cats[nextIdx]
			if (nextCat) {
				this.activeCategory = nextCat
				this.selectList = this.createSelectListForCategory(this.activeCategory)
				this.renderModal()
			}
			return
		}

		if ((data === "r" || data === "R") && this.onRefresh) {
			this.onRefresh()
			return
		}

		// Toggle favorite model with 'f' key
		if (data === "f" || data === "F") {
			const selected = this.selectList.getSelectedItem()
			if (selected) {
				if (this.favoriteModels.has(selected.value)) {
					this.favoriteModels.delete(selected.value)
				} else {
					this.favoriteModels.add(selected.value)
				}
				this.selectList = this.createSelectListForCategory(this.activeCategory)
				this.renderModal()
			}
			return
		}

		this.selectList.handleInput(data)
	}
}
