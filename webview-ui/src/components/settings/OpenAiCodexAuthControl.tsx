import { EmptyRequest } from "@shared/proto/dietcode/common"
import { useState } from "react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { AccountServiceClient } from "@/services/grpc-client"

const buttonStyle = {
	border: "1px solid var(--vscode-button-border, transparent)",
	borderRadius: 6,
	padding: "6px 10px",
	background: "var(--vscode-button-background)",
	color: "var(--vscode-button-foreground)",
	cursor: "pointer",
	fontSize: 12,
}

export default function OpenAiCodexAuthControl() {
	const { openAiCodexIsAuthenticated, openAiCodexModelsError, openAiCodexModelsLoading } = useExtensionState()
	const [isBusy, setIsBusy] = useState(false)
	const [error, setError] = useState<string>()

	const signIn = async () => {
		setIsBusy(true)
		setError(undefined)
		try {
			await AccountServiceClient.openAiCodexSignIn(EmptyRequest.create({}))
		} catch (signInError) {
			setError(signInError instanceof Error ? signInError.message : "OpenAI Codex sign-in failed")
		} finally {
			setIsBusy(false)
		}
	}

	const signOut = async () => {
		setIsBusy(true)
		setError(undefined)
		try {
			await AccountServiceClient.openAiCodexSignOut(EmptyRequest.create({}))
		} catch (signOutError) {
			setError(signOutError instanceof Error ? signOutError.message : "OpenAI Codex sign-out failed")
		} finally {
			setIsBusy(false)
		}
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
				<div>
					<div style={{ fontSize: 12, fontWeight: 600 }}>OpenAI Codex OAuth</div>
					<div style={{ fontSize: 11, color: "var(--vscode-descriptionForeground)" }}>
						{!openAiCodexIsAuthenticated
							? "Use your ChatGPT Plus or Pro subscription"
							: openAiCodexModelsLoading
								? "Signed in; checking Codex model access..."
								: openAiCodexModelsError
									? "Signed in; the Codex model catalog is unavailable"
									: "Connected with your ChatGPT subscription"}
					</div>
				</div>
				<button disabled={isBusy} onClick={openAiCodexIsAuthenticated ? signOut : signIn} style={buttonStyle} type="button">
					{isBusy ? "Opening browser..." : openAiCodexIsAuthenticated ? "Sign out" : "Sign in to OpenAI Codex"}
				</button>
			</div>
			{error && <div style={{ color: "var(--vscode-errorForeground)", fontSize: 11 }}>{error}</div>}
		</div>
	)
}
