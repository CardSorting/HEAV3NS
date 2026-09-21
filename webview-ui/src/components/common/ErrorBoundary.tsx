import React, { Component, type ErrorInfo, type ReactNode } from "react"

interface Props {
	children: ReactNode
	fallback?: ReactNode
	onReset?: () => void
}

interface State {
	hasError: boolean
	error: Error | null
	errorInfo: ErrorInfo | null
	copied: boolean
}

export class ErrorBoundary extends Component<Props, State> {
	public state: State = {
		hasError: false,
		error: null,
		errorInfo: null,
		copied: false,
	}

	public static getDerivedStateFromError(error: Error): State {
		return {
			hasError: true,
			error,
			errorInfo: null,
			copied: false,
		}
	}

	public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		this.setState({ errorInfo })
		console.error("[HEAV3NS ErrorBoundary] Uncaught UI error:", error, errorInfo)
	}

	private handleRetry = () => {
		this.setState({ hasError: false, error: null, errorInfo: null, copied: false })
		if (this.props.onReset) {
			this.props.onReset()
		}
	}

	private handleReload = () => {
		window.location.reload()
	}

	private handleCopyDetails = async () => {
		const { error, errorInfo } = this.state
		const details = [
			"=== HEAV3NS UI CRASH DIAGNOSTIC ===",
			`Time: ${new Date().toISOString()}`,
			`Message: ${error?.message || "Unknown error"}`,
			`Stack: ${error?.stack || "No stack trace available"}`,
			`Component Stack: ${errorInfo?.componentStack || "No component stack"}`,
			`User Agent: ${navigator.userAgent}`,
		].join("\n\n")

		try {
			await navigator.clipboard.writeText(details)
			this.setState({ copied: true })
			setTimeout(() => this.setState({ copied: false }), 2000)
		} catch (err) {
			console.error("Failed to copy error details:", err)
		}
	}

	public render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback
			}

			const { error, copied } = this.state

			return (
				<div className="flex h-screen w-full flex-col items-center justify-center p-6 bg-background text-foreground select-none">
					<div className="w-full max-w-md rounded-xl border border-border/60 bg-card/80 p-6 shadow-2xl backdrop-blur-md">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex size-10 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
								<svg
									className="size-5"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									viewBox="0 0 24 24"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
									/>
								</svg>
							</div>
							<div>
								<h2 className="text-base font-semibold tracking-tight text-foreground">
									Something went wrong
								</h2>
								<p className="text-xs text-muted-foreground">
									HEAV3NS encountered an unexpected UI error
								</p>
							</div>
						</div>

						{error?.message && (
							<div className="mb-4 rounded-lg bg-muted/40 p-3 text-xs font-mono text-muted-foreground border border-border/40 max-h-28 overflow-y-auto break-words">
								{error.message}
							</div>
						)}

						<div className="flex flex-col gap-2">
							<div className="flex gap-2">
								<button
									type="button"
									onClick={this.handleRetry}
									className="flex-1 inline-flex items-center justify-center rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								>
									Try Again
								</button>
								<button
									type="button"
									onClick={this.handleReload}
									className="flex-1 inline-flex items-center justify-center rounded-lg border border-border bg-secondary px-3.5 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								>
									Reload Webview
								</button>
							</div>

							<button
								type="button"
								onClick={this.handleCopyDetails}
								className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
							>
								{copied ? "✓ Copied to clipboard" : "Copy Diagnostic Details"}
							</button>
						</div>
					</div>
				</div>
			)
		}

		return this.props.children
	}
}
