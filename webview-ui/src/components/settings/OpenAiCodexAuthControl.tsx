import { EmptyRequest } from "@shared/proto/dietcode/common"
import { useState } from "react"
import { Heav3nsSignalMark } from "@/assets/Heav3nsSignalMark"
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
	const [operation, setOperation] = useState<"sign-in" | "sign-out" | null>(null)
	const [error, setError] = useState<string>()
	const isBusy = operation !== null

	const statusText =
		operation === "sign-in"
			? "Finish signing in with ChatGPT in your browser. HEAV3NS will confirm when the connection is complete."
			: operation === "sign-out"
				? "Removing the saved ChatGPT connection…"
				: !openAiCodexIsAuthenticated
					? "Use your ChatGPT account for Codex subscription access."
					: openAiCodexModelsLoading
						? "Connected with ChatGPT. Checking Codex model access…"
						: openAiCodexModelsError
							? "Connected, but the Codex model catalog is unavailable. Retry it below."
							: "Connected with ChatGPT. Choose a Codex model below."

	const signIn = async () => {
		setOperation("sign-in")
		setError(undefined)
		try {
			await AccountServiceClient.openAiCodexSignIn(EmptyRequest.create({}))
		} catch (signInError) {
			setError(signInError instanceof Error ? signInError.message : "OpenAI Codex sign-in failed")
		} finally {
			setOperation(null)
		}
	}

	const signOut = async () => {
		setOperation("sign-out")
		setError(undefined)
		try {
			await AccountServiceClient.openAiCodexSignOut(EmptyRequest.create({}))
		} catch (signOutError) {
			setError(signOutError instanceof Error ? signOutError.message : "OpenAI Codex sign-out failed")
		} finally {
			setOperation(null)
		}
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
				<div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
					<Heav3nsSignalMark
						accentColor="var(--color-heav3ns-active, #d8ff5e)"
						aria-hidden="true"
						height={18}
						style={{ color: "var(--vscode-foreground)", flex: "0 0 auto" }}
						width={33}
					/>
					<div style={{ minWidth: 0 }}>
						<div style={{ fontSize: 12, fontWeight: 600 }}>OpenAI Codex</div>
						<div
							aria-atomic="true"
							aria-live="polite"
							role="status"
							style={{ color: "var(--vscode-descriptionForeground)", fontSize: 11 }}>
							{statusText}
						</div>
					</div>
				</div>
				<button
					aria-busy={isBusy}
					aria-label={
						operation === "sign-in"
							? "Waiting for ChatGPT sign-in"
							: operation === "sign-out"
								? "Signing out of OpenAI Codex"
								: openAiCodexIsAuthenticated
									? "Sign out of OpenAI Codex"
									: "Continue with ChatGPT"
					}
					disabled={isBusy}
					onClick={openAiCodexIsAuthenticated ? signOut : signIn}
					style={{ ...buttonStyle, cursor: isBusy ? "wait" : "pointer", flex: "0 0 auto", marginLeft: "auto", whiteSpace: "nowrap" }}
					type="button">
					{operation === "sign-in"
						? "Waiting for ChatGPT…"
						: operation === "sign-out"
							? "Signing out…"
							: openAiCodexIsAuthenticated
								? "Sign out"
								: "Continue with ChatGPT"}
				</button>
			</div>
			{error && (
				<div aria-live="assertive" role="alert" style={{ color: "var(--vscode-errorForeground)", fontSize: 11 }}>
					{error}
				</div>
			)}
		</div>
	)
}
