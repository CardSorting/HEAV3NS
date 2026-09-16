import { ApiProvider } from "@shared/api"
import { BooleanRequest } from "@shared/proto/dietcode/common"
import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { ChangeEvent, memo, useState } from "react"
import DietCodeLogoWhite from "@/assets/DietCodeLogoWhite"
import { LumiAmbientOrb } from "@/components/common/LumiAmbientOrb"
import { useApiConfigurationHandlers } from "@/components/settings/utils/useApiConfigurationHandlers"
import { VscIcon } from "@/components/ui/vsc-icon"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { resolveOrbMood, useLumiSessionComfort } from "@/hooks/useLumiSessionComfort"
import { StateServiceClient } from "@/services/grpc-client"

const WelcomeView = memo(() => {
	const { apiConfiguration, mode } = useExtensionState()
	const [isSaving, setIsSaving] = useState(false)
	const { isStill, calmTier } = useLumiSessionComfort()
	const { handleModeFieldChange, handleFieldChange } = useApiConfigurationHandlers()

	const [galxKey, setGalxKey] = useState(apiConfiguration?.galxApiKey || "")
	const [showKey, setShowKey] = useState(false)

	const handleGalxKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
		const val = event.target.value
		setGalxKey(val)
		handleFieldChange("galxApiKey", val)
	}

	const handleProceed = async () => {
		setIsSaving(true)
		try {
			if (galxKey.trim()) {
				await handleFieldChange("galxApiKey", galxKey.trim(), { flushImmediately: true })
				await handleModeFieldChange(
					{ plan: "planModeApiProvider", act: "actModeApiProvider" },
					"galx" as ApiProvider,
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

	const isProceedEnabled = galxKey.trim().length > 0

	return (
		<div className="fixed inset-0 p-0 flex flex-col items-center justify-center bg-background overflow-y-auto">
			<div className="max-w-[420px] w-[90%] my-8 glass-panel p-8 rounded-3xl flex flex-col gap-6 shadow-2xl animate-fade-slide-in">
				<div className="flex flex-col items-center gap-3">
					<h2 className="text-2xl font-bold tracking-tight text-foreground">Hi, I'm LUMI</h2>
					<p className="text-description text-center text-sm m-0">Your calm coding companion.</p>
					<LumiAmbientOrb calmTier={calmTier} mood={resolveOrbMood("idle", isStill)}>
						<DietCodeLogoWhite className="size-20 drop-shadow-lg" />
					</LumiAmbientOrb>
				</div>

				<p className="text-sm leading-relaxed text-center text-foreground m-0">
					Powered exclusively by GALX AI Wholesale Compute Clearinghouse. Defaulting to <b>GPT-5.6 Terra</b> for balanced frontier agentic coding.
				</p>

				<div className="flex flex-col gap-3 mt-2">
					<p className="text-xs text-description text-center font-semibold tracking-wider uppercase m-0">
						Connect GALX AI Clearinghouse
					</p>

					{/* GALX AI Key Card */}
					<div className="flex flex-col gap-3 p-4 rounded-2xl border bg-lumi/10 border-lumi shadow-[0_4px_16px_rgba(99,102,160,0.15)]">
						<div className="flex items-center gap-3">
							<div className="p-2 rounded-lg bg-lumi text-lumi-foreground">
								<VscIcon className="size-5" name="key" />
							</div>
							<div className="flex flex-col">
								<h3 className="font-semibold text-sm text-foreground m-0">GALX AI API Key</h3>
								<p className="text-[11px] text-description m-0 mt-0.5 leading-normal">
									Wholesale compute with 75% prompt cache pass-through.
								</p>
							</div>
						</div>

						<div className="mt-2 pt-2 border-t border-border-panel/40 flex flex-col gap-2">
							<div className="flex items-center gap-2 bg-muted/40 border border-border rounded-lg px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-lumi focus-within:border-transparent">
								<input
									className="bg-transparent border-none text-foreground text-xs w-full focus:outline-none placeholder:text-muted-foreground"
									onChange={handleGalxKeyChange}
									placeholder="galx_live_..."
									type={showKey ? "text" : "password"}
									value={galxKey}
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
									href="https://galx.ai/keys"
									style={{ fontSize: "11px", textDecoration: "none", fontWeight: 500 }}>
									Get Key
								</VSCodeLink>
							</div>
						</div>
					</div>
				</div>

				<div className="flex flex-col gap-2 mt-2">
					<VSCodeButton
						className="btn-premium-lumi w-full h-10 rounded-xl font-medium"
						disabled={!isProceedEnabled || isSaving}
						onClick={handleProceed}>
						{isSaving ? "Connecting..." : "Get Started"}
					</VSCodeButton>
					<VSCodeButton appearance="secondary" className="w-full h-9 rounded-xl" onClick={handleSkip}>
						Configure Later
					</VSCodeButton>
				</div>
			</div>
		</div>
	)
})

WelcomeView.displayName = "WelcomeView"

export default WelcomeView
