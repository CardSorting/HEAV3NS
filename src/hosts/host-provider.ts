import { WebviewProvider } from "@/core/webview"
import { CommentReviewController } from "@/integrations/editor/CommentReviewController"
import { DiffViewProvider } from "@/integrations/editor/DiffViewProvider"
import { ITerminalManager } from "@/integrations/terminal/types"
import { getStorageDataDirectory } from "@/shared/storage/storage-context"
import { HostBridgeClientProvider } from "./host-provider-types"
/**
 * Singleton class that manages host-specific providers for dependency injection.
 *
 * This system runs on two different platforms (VSCode extension and dietcode-core),
 * so all the host-specific classes and properties are contained in here. The
 * rest of the codebase can use the host provider interface to access platform-specific
 * implementations in a platform-agnostic way.
 *
 * Usage:
 * - Initialize once: HostProvider.initialize(webviewCreator, diffCreator, hostBridge)
 * - Access HostBridge services: HostProvider.window.showMessage()
 * - Access Host Provider factories: HostProvider.get().createDiffViewProvider()
 */
export class HostProvider {
	private static instance: HostProvider | null = null
	private static isHeadlessFallback = false

	createWebviewProvider: WebviewProviderCreator
	createDiffViewProvider: DiffViewProviderCreator
	createCommentReviewController: CommentReviewControllerCreator
	createTerminalManager: TerminalManagerCreator
	hostBridge: HostBridgeClientProvider

	// Logs to a user-visible output channel.
	logToChannel: LogToChannel

	// Returns a callback URL that will redirect to DietCode.
	// The path parameter specifies the route for the callback (e.g., "/auth").
	getCallbackUrl: (path: string) => Promise<string>

	// Returns the location of the binary `name`.
	// Use `getBinaryLocation()` from utils/ts.ts instead of using
	// this directly. The helper function correctly handles the file
	// extension on Windows.
	getBinaryLocation: (name: string) => Promise<string>

	// The absolute file system path where the extension is installed.
	// Use to this to get the location of extension assets.
	extensionFsPath: string

	// The absolute file system path where the extension can store global state.
	globalStorageFsPath: string

	// Private constructor to enforce singleton pattern
	private constructor(
		createWebviewProvider: WebviewProviderCreator,
		createDiffViewProvider: DiffViewProviderCreator,
		createCommentReviewController: CommentReviewControllerCreator,
		createTerminalManager: TerminalManagerCreator,
		hostBridge: HostBridgeClientProvider,
		logToChannel: LogToChannel,
		getCallbackUrl: (path: string) => Promise<string>,
		getBinaryLocation: (name: string) => Promise<string>,
		extensionFsPath: string,
		globalStorageFsPath: string,
	) {
		this.createWebviewProvider = createWebviewProvider
		this.createDiffViewProvider = createDiffViewProvider
		this.createCommentReviewController = createCommentReviewController
		this.createTerminalManager = createTerminalManager
		this.hostBridge = hostBridge
		this.logToChannel = logToChannel
		this.getCallbackUrl = getCallbackUrl
		this.getBinaryLocation = getBinaryLocation
		this.extensionFsPath = extensionFsPath
		this.globalStorageFsPath = globalStorageFsPath
	}

	/**
	 * Initializes or returns a headless HostProvider fallback for CLI and standalone environments.
	 * This ensures that CLI executions, background workers, scripts, and tests never crash
	 * with "HostProvider not setup" when accessing host bridge services or paths.
	 */
	public static initializeHeadless(): HostProvider {
		if (HostProvider.instance && !HostProvider.isHeadlessFallback) {
			return HostProvider.instance
		}
		const noopAsync = async () => ({}) as Record<string, never>
		const headlessBridge: HostBridgeClientProvider = {
			workspaceClient: {
				getWorkspacePaths: async () => ({ paths: [process.cwd()] }),
				getDiagnostics: async () => ({ fileDiagnostics: [] }),
				saveOpenDocumentIfDirty: noopAsync,
				openProblemsPanel: noopAsync,
				openInFileExplorerPanel: noopAsync,
				openTerminalPanel: noopAsync,
				openDietCodeSidebarPanel: noopAsync,
				openFolder: noopAsync,
			} as unknown as HostBridgeClientProvider["workspaceClient"],
			envClient: {
				getHostVersion: async () => ({
					platform: process.platform,
					version: "13.0.1",
					dietcodeType: "cli",
					dietcodeVersion: "13.0.1",
				}),
				getTelemetrySettings: async () => ({ isEnabled: 1 }),
				getIdeRedirectUri: async () => ({ value: "http://localhost" }),
				clipboardWriteText: noopAsync,
				clipboardReadText: async () => ({ value: "" }),
				openExternal: noopAsync,
				debugLog: noopAsync,
				subscribeToTelemetrySettings: () => () => {},
			} as unknown as HostBridgeClientProvider["envClient"],
			windowClient: {
				showMessage: noopAsync,
				getOpenTabs: async () => ({ paths: [] as string[] }),
				getVisibleTabs: async () => ({ paths: [] as string[] }),
				getActiveEditor: async () => ({ filePath: "" }),
				showOpenDialogue: noopAsync,
				openFile: noopAsync,
				showTextDocument: noopAsync,
				openSettings: noopAsync,
				showInputBox: noopAsync,
			} as unknown as HostBridgeClientProvider["windowClient"],
			diffClient: {
				openMultiFileDiff: noopAsync,
			} as unknown as HostBridgeClientProvider["diffClient"],
		}

		HostProvider.instance = new HostProvider(
			(() => null) as unknown as WebviewProviderCreator,
			(() => null) as unknown as DiffViewProviderCreator,
			(() => null) as unknown as CommentReviewControllerCreator,
			(() => null) as unknown as TerminalManagerCreator,
			headlessBridge,
			() => {},
			async () => "http://localhost",
			async () => "",
			process.cwd(),
			getStorageDataDirectory(),
		)
		HostProvider.isHeadlessFallback = true
		return HostProvider.instance
	}

	public static initialize(
		webviewProviderCreator: WebviewProviderCreator,
		diffViewProviderCreator: DiffViewProviderCreator,
		commentReviewControllerCreator: CommentReviewControllerCreator,
		terminalManagerCreator: TerminalManagerCreator,
		hostBridgeProvider: HostBridgeClientProvider,
		logToChannel: LogToChannel,
		getCallbackUrl: (path: string) => Promise<string>,
		getBinaryLocation: (name: string) => Promise<string>,
		extensionFsPath: string,
		globalStorageFsPath: string,
	): HostProvider {
		if (HostProvider.instance && !HostProvider.isHeadlessFallback) {
			throw new Error("Host provider has already been initialized.")
		}
		HostProvider.isHeadlessFallback = false
		HostProvider.instance = new HostProvider(
			webviewProviderCreator,
			diffViewProviderCreator,
			commentReviewControllerCreator,
			terminalManagerCreator,
			hostBridgeProvider,
			logToChannel,
			getCallbackUrl,
			getBinaryLocation,
			extensionFsPath,
			globalStorageFsPath,
		)
		return HostProvider.instance
	}

	/**
	 * Gets the singleton instance
	 */
	public static get(): HostProvider {
		if (!HostProvider.instance) {
			return HostProvider.initializeHeadless()
		}
		return HostProvider.instance
	}

	public static isInitialized(): boolean {
		return !!HostProvider.instance
	}

	/**
	 * Resets the HostProvider instance (primarily for testing)
	 * This allows tests to reinitialize the HostProvider with different configurations
	 */
	public static reset(): void {
		HostProvider.instance = null
		HostProvider.isHeadlessFallback = false
	}

	public static get workspace() {
		return HostProvider.get().hostBridge.workspaceClient
	}

	public static get env() {
		return HostProvider.get().hostBridge.envClient
	}

	public static get window() {
		return HostProvider.get().hostBridge.windowClient
	}

	public static get diff() {
		return HostProvider.get().hostBridge.diffClient
	}
}

/**
 * A function that creates WebviewProvider instances
 */
export type WebviewProviderCreator = () => WebviewProvider

/**
 * A function that creates DiffViewProvider instances
 */
export type DiffViewProviderCreator = () => DiffViewProvider

/**
 * A function that creates CommentReviewController instances
 */
export type CommentReviewControllerCreator = () => CommentReviewController

export type LogToChannel = (message: string) => void

/**
 * A function that creates TerminalManager instances
 */
export type TerminalManagerCreator = () => ITerminalManager
