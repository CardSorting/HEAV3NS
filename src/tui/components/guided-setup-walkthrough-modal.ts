import type { ApiKeyProviderId, SetupWizard } from "../../agents/extensions/setup/setup-wizard.js"
import type { Component, Focusable } from "../tui.js"
import { Box } from "./box.js"
import { Input } from "./input.js"
import { Markdown, type MarkdownTheme } from "./markdown.js"
import { type SelectItem, SelectList, type SelectListTheme } from "./select-list.js"
import { Text } from "./text.js"
import { VStack } from "./v-stack.js"

type SetupProviderId = ApiKeyProviderId

const PROVIDER_DETAILS: Record<SetupProviderId, { label: string; envVar?: string }> = {
	openrouter: { label: "OpenRouter", envVar: "OPENROUTER_API_KEY" },
}

const WIZARD_MARKDOWN_THEME: MarkdownTheme = {
	heading: (text) => `\x1b[1;36m${text}\x1b[0m`,
	link: (text) => `\x1b[4;34m${text}\x1b[0m`,
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

const WIZARD_SELECT_THEME: SelectListTheme = {
	selectedPrefix: (text) => `\x1b[1;35m${text}\x1b[0m`,
	selectedText: (text) => `\x1b[1;35m${text}\x1b[0m`,
	description: (text) => `\x1b[90m${text}\x1b[0m`,
	scrollInfo: (text) => `\x1b[90m${text}\x1b[0m`,
	noMatch: (text) => `\x1b[31m${text}\x1b[0m`,
}

export class GuidedSetupWalkthroughModal implements Component, Focusable {
	focused = false
	private currentStep = 1
	private readonly totalSteps: number = 4
	private readonly container: Box
	private readonly vstack: VStack
	private readonly setupWizard: SetupWizard
	private readonly onClose: (completed: boolean) => void
	private readonly onProviderConfigured: (providerId: SetupProviderId) => void
	private readonly requestRender: () => void
	private activeStepComponent: Component | null = null
	private stepMarkdownComponent: Markdown | null = null
	private selectedProvider: SetupProviderId | null = null
	private providerFeedback = ""
	private oauthStatus = ""

	constructor(
		setupWizard: SetupWizard,
		onClose: (completed: boolean) => void,
		onProviderConfigured: (providerId: SetupProviderId) => void = () => undefined,
		requestRender: () => void = () => undefined,
	) {
		this.setupWizard = setupWizard
		this.onClose = onClose
		this.onProviderConfigured = onProviderConfigured
		this.requestRender = requestRender

		const bgFn = (text: string) => `\x1b[48;5;235m${text}\x1b[0m`
		this.container = new Box(2, 1, bgFn)
		this.vstack = new VStack()

		this.renderCurrentStep()
		this.container.addChild(this.vstack)
	}

	private renderCurrentStep(): void {
		this.vstack.clear()
		this.activeStepComponent = null

		const titleText = new Text(
			`\x1b[1;35m━━━ LUMI AGENT OS GUIDED SETUP WALKTHROUGH ━━━\x1b[0m  \x1b[1;33m[Step ${this.currentStep}/${this.totalSteps}]\x1b[0m`,
			0,
			0,
		)
		this.vstack.addChild(titleText)

		let stepMarkdownText = ""

		if (this.currentStep === 1) {
			stepMarkdownText =
				`### Step 1/4: Environment & Workspace Key Audit\n\n` +
				`Scanning workspace \`.env\` files, system environment variables, and local vault storage...\n\n`

			const auditStatuses = this.setupWizard.auditStatus()
			for (const st of auditStatuses) {
				const icon = st.configured ? "`[✓ ACTIVE]`" : "`[✗ UNCONFIGURED]`"
				const src = st.source !== "none" ? `(source: \`${st.source}\`)` : ""
				stepMarkdownText += `- **${st.provider.toUpperCase()}**: ${icon} ${src} ${st.maskedValue || ""}\n`
			}

			stepMarkdownText += `\nSelect **Proceed to Step 2** to configure missing credentials or test connections.`

			this.stepMarkdownComponent = new Markdown(stepMarkdownText, 0, 0, WIZARD_MARKDOWN_THEME)
			this.vstack.addChild(this.stepMarkdownComponent)

			const items: SelectItem[] = [
				{
					value: "next",
					label: "Proceed to Step 2: Configure Providers",
					description: "Advance to provider selection and API key setup.",
				},
				{ value: "cancel", label: "Exit Setup Wizard", description: "Close wizard and return to interactive shell." },
			]

			const selectList = new SelectList(items, 2, WIZARD_SELECT_THEME)
			selectList.onSelect = (item) => {
				if (item.value === "next") {
					this.currentStep = 2
					this.renderCurrentStep()
				} else {
					this.onClose(false)
				}
			}
			this.activeStepComponent = selectList
			this.vstack.addChild(selectList)
		} else if (this.currentStep === 2 && this.selectedProvider) {
			this.renderProviderConfiguration(this.selectedProvider)
		} else if (this.currentStep === 2) {
			stepMarkdownText =
				`### Step 2/4: Model Provider Selection & Purpose\n\n` +
				`Choose a provider below to configure its credentials and make its default model active:\n\n` +
				`- **OpenRouter**: OpenAI-compatible model routing for supported frontier and open models.\n` +
				(this.providerFeedback ? `\n${this.providerFeedback}\n` : "")

			this.stepMarkdownComponent = new Markdown(stepMarkdownText, 0, 0, WIZARD_MARKDOWN_THEME)
			this.vstack.addChild(this.stepMarkdownComponent)

			const items: SelectItem[] = [
				{ value: "openrouter", label: "OpenRouter API Key", description: "OpenRouter model routing." },
				{
					value: "next",
					label: "Proceed to Step 3: Custom Proxy Setup",
					description: "Advance to optional proxy gateway configuration.",
				},
				{ value: "back", label: "Back to Step 1", description: "Return to environment audit step." },
			]

			const selectList = new SelectList(items, 5, WIZARD_SELECT_THEME)
			selectList.onSelect = (item) => {
				if (item.value === "next") {
					this.currentStep = 3
					this.renderCurrentStep()
				} else if (item.value === "back") {
					this.currentStep = 1
					this.renderCurrentStep()
				} else if (this.isProviderId(item.value)) {
					this.openProviderConfiguration(item.value)
				}
			}
			selectList.onCancel = () => this.close(false)
			this.activeStepComponent = selectList
			this.vstack.addChild(selectList)
		} else if (this.currentStep === 3) {
			const proxyStatus = this.setupWizard.auditStatus().find((status) => status.provider === "custom-llm-proxy")
			stepMarkdownText =
				`### Step 3/4: Custom LLM Proxy & Local Engine Presets\n\n` +
				`Configure an optional custom HTTP proxy endpoint or select a 1-click preset for local offline servers (Ollama, LM Studio, llama.cpp, vLLM).\n\n` +
				`Current Proxy Endpoint: \`${proxyStatus?.maskedValue ?? "none (direct provider connection)"}\`\n\n` +
				`Select an option or 1-click local preset below:`

			this.stepMarkdownComponent = new Markdown(stepMarkdownText, 0, 0, WIZARD_MARKDOWN_THEME)
			this.vstack.addChild(this.stepMarkdownComponent)

			const items: SelectItem[] = [
				{
					value: "connect_ollama",
					label: "Preset: Ollama Daemon (http://localhost:11434/v1)",
					description: "1-click connect to local Ollama instance.",
				},
				{
					value: "connect_lmstudio",
					label: "Preset: LM Studio (http://localhost:1234/v1)",
					description: "1-click connect to local LM Studio server.",
				},
				{
					value: "connect_llamacpp",
					label: "Preset: llama.cpp (http://localhost:8080/v1)",
					description: "1-click connect to local llama-server.",
				},
				{
					value: "keep_default",
					label: "Use Default Direct Gateway (Cloud APIs)",
					description: "Bypass proxy and connect directly to provider APIs.",
				},
				{
					value: "next",
					label: "Proceed to Step 4: Verification & Diagnostic Test",
					description: "Advance to live diagnostic test.",
				},
				{ value: "back", label: "Back to Step 2", description: "Return to provider selection step." },
			]

			const selectList = new SelectList(items, 5, WIZARD_SELECT_THEME)
			selectList.onSelect = (item) => {
				if (item.value === "connect_ollama") {
					this.setupWizard.configureLocalEndpoint("ollama", "http://localhost:11434/v1")
					this.currentStep = 4
					this.renderCurrentStep()
				} else if (item.value === "connect_lmstudio") {
					this.setupWizard.configureLocalEndpoint("lmstudio", "http://localhost:1234/v1")
					this.currentStep = 4
					this.renderCurrentStep()
				} else if (item.value === "connect_llamacpp") {
					this.setupWizard.configureLocalEndpoint("llamacpp", "http://localhost:8080/v1")
					this.currentStep = 4
					this.renderCurrentStep()
				} else if (item.value === "keep_default") {
					this.setupWizard.useDefaultProxyGateway()
					this.currentStep = 4
					this.renderCurrentStep()
				} else if (item.value === "next") {
					this.currentStep = 4
					this.renderCurrentStep()
				} else if (item.value === "back") {
					this.currentStep = 2
					this.renderCurrentStep()
				}
			}
			this.activeStepComponent = selectList
			this.vstack.addChild(selectList)
		} else if (this.currentStep === 4) {
			const providerStatuses = this.setupWizard.auditStatus().filter((status) => status.provider !== "custom-llm-proxy")
			const configuredCount = providerStatuses.filter((status) => status.configured).length
			stepMarkdownText =
				`### Step 4/4: Credential Resolution Audit\n\n` +
				providerStatuses
					.map((status) => {
						const result = status.configured ? "`[READY]`" : "`[NOT CONFIGURED]`"
						const source = status.configured ? ` Auth mode: \`${status.source}\`.` : ""
						return `- **${status.provider.toUpperCase()}**: ${result}${source}`
					})
					.join("\n") +
				`\n\n` +
				(configuredCount > 0
					? `**[✓] ${configuredCount} provider${configuredCount === 1 ? " is" : "s are"} ready.**\n\nCredentials and the selected model are persisted in \`~/.lumi/config.json\`.`
					: `**[!] No model provider is configured yet.** Go back to Step 2 to add an API key or connect Codex OAuth.`)

			this.stepMarkdownComponent = new Markdown(stepMarkdownText, 0, 0, WIZARD_MARKDOWN_THEME)
			this.vstack.addChild(this.stepMarkdownComponent)

			const items: SelectItem[] = [
				{
					value: "finish",
					label: "Finish Setup & Start Interactive Shell",
					description: "Save configuration and return to prompt turn execution.",
				},
				{ value: "back", label: "Back to Step 3", description: "Return to proxy setup step." },
			]

			const selectList = new SelectList(items, 2, WIZARD_SELECT_THEME)
			selectList.onSelect = (item) => {
				if (item.value === "finish") {
					this.close(true)
				} else if (item.value === "back") {
					this.currentStep = 3
					this.renderCurrentStep()
				}
			}
			this.activeStepComponent = selectList
			this.vstack.addChild(selectList)
		}
	}

	private renderProviderConfiguration(providerId: SetupProviderId): void {
		const provider = PROVIDER_DETAILS[providerId]
		const status = this.getProviderStatus(providerId)
		const statusText = status?.configured
			? `\`[✓ ACTIVE]\` via \`${status.source}\` ${status.maskedValue ?? ""}`
			: "`[✗ UNCONFIGURED]`"

		const markdown =
			`### Configure ${provider.label}\n\n` +
			`Current status: ${statusText}\n\n` +
			`Paste the API key below. It will be saved to the local LUMI credential vault. ` +
			`You can also provide it through \`${provider.envVar}\`.\n\n` +
			(status?.configured
				? `Press **Enter** with an empty field to keep the existing key and select this provider.\n\n`
				: "") +
			(this.oauthStatus ? `${this.oauthStatus}\n\n` : "") +
			`Press **Esc** to return to the provider list.`

		this.stepMarkdownComponent = new Markdown(markdown, 0, 0, WIZARD_MARKDOWN_THEME)
		this.vstack.addChild(this.stepMarkdownComponent)

		const input = new Input({ maskCharacter: "•" })
		input.focused = true
		input.onSubmit = (value) => {
			const cleaned = value.trim()
			if (!cleaned && status?.configured) {
				this.finishProviderConfiguration(providerId, `Existing ${provider.label} credentials selected.`)
				return
			}
			if (!cleaned) {
				this.oauthStatus = "`[ERROR]` Enter an API key before continuing."
				this.renderCurrentStep()
				this.requestRender()
				return
			}

			try {
				this.setupWizard.configureProviderApiKey(providerId, cleaned)
				this.finishProviderConfiguration(providerId, `${provider.label} credentials saved.`)
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				this.oauthStatus = `\`[ERROR]\` ${message}`
				this.renderCurrentStep()
				this.requestRender()
			}
		}
		input.onEscape = () => this.cancelProviderConfiguration()
		this.activeStepComponent = input
		this.vstack.addChild(input)
	}

	private openProviderConfiguration(providerId: SetupProviderId): void {
		this.selectedProvider = providerId
		this.providerFeedback = ""
		this.oauthStatus = ""
		this.renderCurrentStep()
		this.requestRender()
	}

	private finishProviderConfiguration(providerId: SetupProviderId, message: string): void {
		this.onProviderConfigured(providerId)
		this.selectedProvider = null
		this.oauthStatus = ""
		this.providerFeedback = `\`[✓]\` ${message} Its default model is now active.`
		this.renderCurrentStep()
		this.requestRender()
	}

	private cancelProviderConfiguration(): void {
		this.selectedProvider = null
		this.oauthStatus = ""
		this.renderCurrentStep()
		this.requestRender()
	}

	private getProviderStatus(providerId: SetupProviderId) {
		return this.setupWizard.auditStatus().find((status) => status.provider === providerId)
	}

	private isProviderId(value: string): value is SetupProviderId {
		return value in PROVIDER_DETAILS
	}

	private close(completed: boolean): void {
		this.onClose(completed)
	}

	invalidate(): void {
		this.container.invalidate()
		this.activeStepComponent?.invalidate?.()
	}

	handleInput(data: string): void {
		if (this.activeStepComponent) {
			this.activeStepComponent.handleInput?.(data)
		}
	}

	render(width: number): string[] {
		return this.container.render(width)
	}
}
