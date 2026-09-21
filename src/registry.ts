import { Logger } from "@/shared/services/Logger"
import { withTimeout } from "@/utils/withTimeout"
import { name, publisher, version } from "../package.json"
import { HostProvider } from "./hosts/host-provider"

const prefix =
	name === "claude-dev" || name === "marie-coder" || name === "dietcode" ? "dietcode" : name === "lumi-vscode" ? "lumi" : name

/**
 * List of commands with the name of the extension they are registered under.
 * These should match the command IDs defined in package.json.
 * For Nightly build, the publish script has updated all the commands to use the extension name as prefix.
 * In production, all commands are registered under "dietcode" for consistency.
 */
const DietCodeCommands = {
	PlusButton: `${prefix}.plusButtonClicked`,
	McpButton: `${prefix}.mcpButtonClicked`,
	SettingsButton: `${prefix}.settingsButtonClicked`,
	HistoryButton: `${prefix}.historyButtonClicked`,
	AccountButton: `${prefix}.accountButtonClicked`,
	WorktreesButton: `${prefix}.worktreesButtonClicked`,
	JoyZoningButton: `${prefix}.joyZoningButtonClicked`,
	JoyZoningAudit: `${prefix}.joyZoningAudit`,
	TerminalOutput: `${prefix}.addTerminalOutputToChat`,
	AddToChat: `${prefix}.addToChat`,
	FixWithDietCode: `${prefix}.fixWithDietCode`,
	ExplainCode: `${prefix}.explainCode`,
	ImproveCode: `${prefix}.improveCode`,
	FocusChatInput: `${prefix}.focusChatInput`,
	RunHealthCheck: `${prefix}.runHealthCheck`,
	Walkthrough: `${prefix}.openWalkthrough`,
	GenerateCommit: `${prefix}.generateGitCommitMessage`,
	AbortCommit: `${prefix}.abortGitCommitMessage`,
	ReconstructTaskHistory: `${prefix}.reconstructTaskHistory`,
	ClearCache: `${prefix}.clearCache`,
	// Jupyter Notebook commands
	JupyterGenerateCell: `${prefix}.jupyterGenerateCell`,
	JupyterExplainCell: `${prefix}.jupyterExplainCell`,
	JupyterImproveCell: `${prefix}.jupyterImproveCell`,
}

/**
 * IDs for the views registered by the extension.
 * These should match the name + view IDs defined in package.json.
 */
const DietCodeViewIds = {
	Sidebar: `${prefix}.SidebarProvider`,
}

/**
 * The registry info for the extension, including its ID, name, version, commands, and views
 * registered for the current host.
 */
export const ExtensionRegistryInfo = {
	id: `${publisher}.${name}`,
	name,
	version,
	publisher,
	commands: DietCodeCommands,
	views: DietCodeViewIds,
}

export interface HostInfo {
	/**
	 * The name of the host platform, e.g VSCode, IntelliJ Ultimate Edition, etc.
	 */
	platform: string
	/**
	 * The operating system platform, e.g. linux, darwin, win32
	 */
	os: string
	/**
	 * The type of the dietcode host environment, e.g. 'VSCode Extension', 'DietCode for JetBrains', 'CLI'
	 * This is different from the platform because there are many JetBrains IDEs, but they all use the same
	 * plugin.
	 */
	ide: string
	/**
	 * A distinct ID for this installation of the host client
	 */
	distinctId: string
	/**
	 * The version of the host platform, e.g. 1.103.0 for VSCode, or 2025.1.1.1 for JetBrains IDEs.
	 */
	hostVersion?: string
	/**
	 * The version of DietCode that the host client is running
	 */
	extensionVersion: string
}

let hostInfo = null as HostInfo | null
const HOST_INFO_TIMEOUT_MS = 1500

export const HostRegistryInfo = {
	init: async (distinctId: string) => {
		try {
			const host = await withTimeout(
				HostProvider.env.getHostVersion({}),
				HOST_INFO_TIMEOUT_MS,
				"Editor host metadata lookup",
			)
			const hostVersion = host.version
			const extensionVersion = host.dietcodeVersion || ExtensionRegistryInfo.version
			const platform = host.platform || "unknown"
			const os = process.platform || "unknown"
			const ide = host.dietcodeType || "unknown"
			hostInfo = { hostVersion, extensionVersion, platform, os, ide, distinctId }
		} catch (error) {
			// Host metadata is useful for telemetry and banners, but a compatible
			// editor bridge must not be able to prevent the extension from starting.
			Logger.warn("[HostRegistryInfo] Host metadata unavailable; continuing with fallback values.", error)
			hostInfo = {
				platform: "unknown",
				os: process.platform || "unknown",
				ide: "unknown",
				distinctId,
				extensionVersion: ExtensionRegistryInfo.version,
			}
		}
	},
	get: () => hostInfo,
}
