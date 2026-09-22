import type { Component, Focusable } from "../tui.js"
import { Box } from "./box.js"
import { SettingsList, type SettingItem, type SettingsListTheme } from "./settings-list.js"
import { Text } from "./text.js"
import { VStack } from "./v-stack.js"
import type { SetupWizard } from "../../agents/extensions/setup/setup-wizard.js"
import { getAgentProviderLabel, isClaudeSubscriptionDirectSdkProvider } from "../../core/providers/provider-ids.js"

const PROVIDER_SETUP_THEME: SettingsListTheme = {
	label: (text, selected) => (selected ? `\x1b[1;36m${text}\x1b[0m` : text),
	value: (text, selected) => (selected ? `\x1b[1;32m${text}\x1b[0m` : `\x1b[33m${text}\x1b[0m`),
	description: (text) => `\x1b[90m${text}\x1b[0m`,
	cursor: "\x1b[1;35m▶ \x1b[0m",
	hint: (text) => `\x1b[90m${text}\x1b[0m`,
}

export class ProviderSetupModal implements Component, Focusable {
	focused: boolean = false
	private readonly container: Box
	private readonly settingsList: SettingsList
	private readonly setupWizard: SetupWizard
	private readonly onClose: () => void

	constructor(setupWizard: SetupWizard, onSelectProvider: (providerId: string, action?: string) => void, onClose: () => void) {
		this.setupWizard = setupWizard
		this.onClose = onClose

		const bgFn = (text: string) => `\x1b[48;5;235m${text}\x1b[0m`
		this.container = new Box(2, 1, bgFn)

		const vstack = new VStack()
		const title = new Text(`\x1b[1;35m━━━ PROVIDER SETUP ━━━\x1b[0m`, 0, 0)
		const subtitle = new Text(
			`\x1b[90mChoose a provider to configure or verify. Enter opens the selected action; Esc returns to chat.\x1b[0m`,
			0,
			0,
		)

		const statuses = setupWizard.auditStatus()
		const items: SettingItem[] = statuses.map((st) => {
			const isClaude = isClaudeSubscriptionDirectSdkProvider(st.provider)
			const statusBadge = isClaude
				? st.configured
					? "[~ CLI DETECTED · VERIFY LOGIN]"
					: "[✗ CLI NOT FOUND]"
				: st.configured
					? `[✓ ACTIVE - ${st.source}]`
					: "[✗ UNCONFIGURED]"
			return {
				id: st.provider,
				label: getAgentProviderLabel(st.provider),
				description: `${statusBadge} ${st.maskedValue ? `· ${st.maskedValue}` : ""} Choose Configure to select it, or Test Connection to verify it without switching.`,
				currentValue: isClaude
					? st.configured
						? "Verify Login"
						: "Install / Configure"
					: st.configured
						? st.maskedValue || "Configured"
						: "Not Set",
				values: ["Configure", "Test Connection"],
			}
		})

		items.push({
			id: "run_diagnostics",
			label: "RUN ALL DIAGNOSTICS",
			description: "Run a complete provider and credential health check.",
			currentValue: "Run Tests",
			values: ["Execute Audit"],
		})

		this.settingsList = new SettingsList(
			items,
			7,
			PROVIDER_SETUP_THEME,
			(id, newValue) => {
				onSelectProvider(id, newValue)
			},
			onClose,
		)

		vstack.addChild(title)
		vstack.addChild(subtitle)
		vstack.addChild(this.settingsList)
		this.container.addChild(vstack)
	}

	invalidate(): void {
		this.container.invalidate()
		this.settingsList.invalidate()
	}

	handleInput(data: string): void {
		this.settingsList.handleInput(data)
	}

	render(width: number): string[] {
		return this.container.render(width)
	}
}
