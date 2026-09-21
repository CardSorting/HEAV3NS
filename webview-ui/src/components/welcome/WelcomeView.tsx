import { ApiProvider } from "@shared/api"
import { BooleanRequest } from "@shared/proto/dietcode/common"
import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { ChangeEvent, memo, useState } from "react"
import { Heav3nsSignalMark } from "@/assets/Heav3nsSignalMark"
import { useApiConfigurationHandlers } from "@/components/settings/utils/useApiConfigurationHandlers"
import { VscIcon } from "@/components/ui/vsc-icon"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { StateServiceClient } from "@/services/grpc-client"

const WelcomeView = memo(() => {
	const { apiConfiguration, mode } = useExtensionState()
	const [isSaving, setIsSaving] = useState(false)
	const { handleModeFieldChange, handleFieldChange } = useApiConfigurationHandlers()

	const [openRouterKey, setOpenRouterKey] = useState(apiConfiguration?.openRouterApiKey || "")
	const [showKey, setShowKey] = useState(false)

	const handleOpenRouterKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
		const val = event.target.value
		setOpenRouterKey(val)
		handleFieldChange("openRouterApiKey", val)
	}

	const handleProceed = async () => {
		setIsSaving(true)
		try {
			if (openRouterKey.trim()) {
				await handleFieldChange("openRouterApiKey", openRouterKey.trim(), { flushImmediately: true })
				await handleModeFieldChange(
					{ plan: "planModeApiProvider", act: "actModeApiProvider" },
					"openrouter" as ApiProvider,
					mode,
					{ flushImmediately: true },
				)
			}
			await StateServiceClient.setWelcomeViewCompleted(BooleanRequest.create({ value: true }))
		} catch (error) {
			console.error("Failed to complete welcome view:", error)
		} finally {
			setIsSaving(false)
		}
	}

	const handleSkip = async () => {
		try {
			await StateServiceClient.setWelcomeViewCompleted(BooleanRequest.create({ value: true }))
		} catch (error) {
			console.error("Failed to skip welcome view:", error)
		}
	}

	const isProceedEnabled = openRouterKey.trim().length > 0

	return (
		<div className="fixed inset-0 p-0 flex flex-col items-center justify-center bg-background overflow-y-auto">
			<div className="heav3ns-welcome-panel max-w-[420px] w-[90%] my-8 p-7 flex flex-col gap-6 animate-fade-slide-in">
				<div className="flex flex-col items-center gap-3">
					<div className="heav3ns-signal-stage" aria-hidden="true">
						<Heav3nsSignalMark accentColor="var(--color-heav3ns-cyan)" className="h-auto w-36 text-heav3ns-active" />
						<div className="heav3ns-signal-readout">
							<span>CHANNEL 01</span>
							<span className="heav3ns-signal-status">READY</span>
						</div>
					</div>
					<h2 className="text-2xl font-bold tracking-[0.16em] text-foreground uppercase">HEAV3NS</h2>
					<p className="text-description text-center text-sm m-0">Clear signal for complex work.</p>
				</div>

				<p className="text-sm leading-relaxed text-center text-foreground m-0">
					Powered by OpenRouter. Defaulting to <b>GPT-5.6 Terra</b> for balanced frontier agentic coding.
				</p>

				<div className="flex flex-col gap-3 mt-2">
					<p className="text-xs text-description text-center font-semibold tracking-wider uppercase m-0">
						Connect OpenRouter
					</p>

					{/* OpenRouter API key card */}
					<div className="heav3ns-key-card flex flex-col gap-3 p-4">
						<div className="flex items-center gap-3">
							<div className="heav3ns-key-icon p-2">
								<VscIcon className="size-5" name="key" />
							</div>
							<div className="flex flex-col">
								<h3 className="font-semibold text-sm text-foreground m-0">OpenRouter API Key</h3>
								<p className="text-[11px] text-description m-0 mt-0.5 leading-normal">
									Access OpenAI-compatible models through a single API.
								</p>
							</div>
						</div>

						<div className="mt-2 pt-2 border-t border-border-panel/40 flex flex-col gap-2">
							<div className="flex items-center gap-2 bg-muted/40 border border-border rounded-lg px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-heav3ns focus-within:border-transparent">
								<input
									className="bg-transparent border-none text-foreground text-xs w-full focus:outline-none placeholder:text-muted-foreground"
									onChange={handleOpenRouterKeyChange}
									placeholder="sk-or-v1-..."
									type={showKey ? "text" : "password"}
									value={openRouterKey}
								/>
								<button
									aria-label={showKey ? "Hide API key" : "Show API key"}
									className="bg-transparent border-none p-1 text-description hover:text-foreground cursor-pointer flex items-center"
									onClick={() => setShowKey(!showKey)}
									type="button">
									<VscIcon className="size-3.5" name={showKey ? "eye-closed" : "eye"} />
								</button>
							</div>
							<div className="flex justify-between items-center px-1">
								<span className="text-[10px] text-description">Stored securely in VS Code SecretStorage</span>
								<VSCodeLink
									href="https://openrouter.ai/keys"
									style={{ fontSize: "11px", textDecoration: "none", fontWeight: 500 }}>
									Get Key
								</VSCodeLink>
							</div>
						</div>
					</div>
				</div>

				<div className="flex flex-col gap-2 mt-2">
					<VSCodeButton
						className="btn-premium-heav3ns w-full h-10"
						disabled={!isProceedEnabled || isSaving}
						onClick={handleProceed}>
						{isSaving ? "Connecting..." : "Get Started"}
					</VSCodeButton>
					<VSCodeButton appearance="secondary" className="w-full h-9 rounded-lg" onClick={handleSkip}>
						Configure Later
					</VSCodeButton>
				</div>
			</div>
		</div>
	)
})

WelcomeView.displayName = "WelcomeView"

export default WelcomeView
