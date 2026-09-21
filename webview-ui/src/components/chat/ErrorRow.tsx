import { DietCodeMessage } from "@shared/ExtensionMessage"
import { AlertCircle, ChevronDown } from "lucide-react"
import { memo } from "react"
import CreditLimitError from "@/components/chat/CreditLimitError"
import { CopyButton } from "@/components/common/CopyButton"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icons"
import { useDietCodeAuth, useDietCodeSignIn } from "@/context/DietCodeAuthContext"
import { pickRecoveryLine } from "@/copy/heav3nsVoice"
import { DietCodeError, DietCodeErrorType } from "../../../../src/services/error/DietCodeError"
import {
	buildRecoveryDiagnostics,
	getRecoveryCopy,
	hasDiagnosticMetadata,
	isOpaqueRecoveryError,
	parseRecoveryError,
	type RecoveryErrorInfo,
} from "./errorRecovery"

interface ErrorRowProps {
	message: DietCodeMessage
	errorType: "error" | "mistake_limit_reached" | "diff_error" | "dietcodeignore_error"
	apiRequestFailedMessage?: string
	apiReqStreamingFailedMessage?: string
}

const ErrorDiagnostics = ({ error }: { error: RecoveryErrorInfo | undefined }) => {
	if (!hasDiagnosticMetadata(error)) return null

	const diagnostics = buildRecoveryDiagnostics(error)
	return (
		<details className="lumi-inline-disclosure rounded-md border border-description/15 bg-background/30">
			<summary className="flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-[10px] text-description/80 hover:text-foreground">
				<ChevronDown
					aria-hidden
					className="size-3 shrink-0 -rotate-90 transition-transform [[open]>&]:rotate-0"
					strokeWidth={1.8}
				/>
				<span>Show technical details</span>
				<span className="ml-auto text-[9px] text-description/55">No chat content included</span>
			</summary>
			<div className="border-t border-description/10 px-2.5 pb-2 pt-1.5">
				<div className="flex items-start justify-between gap-2">
					<pre className="m-0 min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[9px] leading-relaxed text-description/85">
						{diagnostics}
					</pre>
					<CopyButton ariaLabel="Copy technical details" textToCopy={diagnostics} />
				</div>
			</div>
		</details>
	)
}

const ErrorRow = memo(({ message, errorType, apiRequestFailedMessage, apiReqStreamingFailedMessage }: ErrorRowProps) => {
	const { dietcodeUser } = useDietCodeAuth()
	const rawApiError = apiRequestFailedMessage || apiReqStreamingFailedMessage

	const { isLoginLoading, handleSignIn } = useDietCodeSignIn()

	const renderErrorContent = () => {
		switch (errorType) {
			case "mistake_limit_reached":
				return (
					<div className="flex flex-col gap-2.5">
						{message.text && (
							<p className="m-0 whitespace-pre-wrap text-description/90 wrap-anywhere text-sm leading-relaxed">
								{message.text}
							</p>
						)}
						<p className="m-0 text-description/80 text-sm">{pickRecoveryLine(message.ts)}</p>
					</div>
				)
			case "error":
				// Handle API request errors with special error parsing
				if (rawApiError) {
					const dietcodeError = DietCodeError.parse(rawApiError)
					const errorInfo = parseRecoveryError(rawApiError, dietcodeError)
					const errorMessage = errorInfo?.message || rawApiError
					const recoveryCopy = getRecoveryCopy(errorInfo)
					const providerMessage = errorInfo && !isOpaqueRecoveryError(errorInfo) ? errorInfo.message : undefined
					const providerId = errorInfo?.providerId
					const isDietCodeProvider = providerId === "dietcode"

					if (dietcodeError?.isErrorType(DietCodeErrorType.Balance)) {
						const errorDetails = dietcodeError._error?.details
						return (
							<CreditLimitError
								buyCreditsUrl={errorDetails?.buy_credits_url}
								currentBalance={errorDetails?.current_balance}
								message={errorDetails?.message}
								totalPromotions={errorDetails?.total_promotions}
								totalSpent={errorDetails?.total_spent}
							/>
						)
					}

					return (
						<div className="flex flex-col gap-3 rounded-lg border border-error/30 bg-error/[0.035] p-3 text-description/90">
							<div className="flex items-start gap-2">
								<AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-error" strokeWidth={1.9} />
								<div className="min-w-0 flex-1">
									<p className="m-0 text-sm font-semibold leading-tight text-foreground">{recoveryCopy.title}</p>
									<p className="m-0 mt-1 text-xs leading-relaxed text-description">{recoveryCopy.detail}</p>
									{providerMessage && providerMessage !== recoveryCopy.detail && (
										<p className="m-0 mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-description/90">
											{providerMessage}
										</p>
									)}
									{!errorInfo && (
										<p className="m-0 mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-description/90">
											{rawApiError}
										</p>
									)}
								</div>
							</div>

							{/* Windows Powershell Issue */}
							{errorMessage.toLowerCase().includes("powershell") && (
								<div>
									It seems like you're having Windows PowerShell issues, please see this{" "}
									<a
										className="underline text-inherit"
										href="https://github.com/dietcode/dietcode/wiki/TroubleShooting-%E2%80%90-%22PowerShell-is-not-recognized-as-an-internal-or-external-command%22">
										troubleshooting guide
									</a>
									.
								</div>
							)}

							{/* Display Login button for non-logged in users using the HEAV3NS provider */}
							<div>
								{/* The user is signed in or not using dietcode provider */}
								{isDietCodeProvider && !dietcodeUser ? (
									<Button className="w-full mb-4" disabled={isLoginLoading} onClick={handleSignIn}>
										Sign in
										{isLoginLoading && (
											<span className="ml-1 animate-spin">
												<Icon className="" name="refresh" />
											</span>
										)}
									</Button>
								) : (
									<span className="text-xs text-description">{pickRecoveryLine(message.ts)}</span>
								)}
							</div>

							<ErrorDiagnostics error={errorInfo} />
						</div>
					)
				}

				// Regular error message
				return (
					<p className="m-0 mt-0 whitespace-pre-wrap text-description/90 wrap-anywhere leading-relaxed">
						{message.text}
					</p>
				)

			case "diff_error":
				return (
					<div className="flex flex-col gap-1.5 p-2 rounded text-xs opacity-80 bg-quote text-foreground">
						<div>That didn't quite match — I'll try again.</div>
						<div className="text-description">{pickRecoveryLine(message.ts)}</div>
					</div>
				)

			case "dietcodeignore_error":
				return (
					<div className="flex flex-col p-2 rounded text-xs opacity-80 bg-quote text-foreground">
						<div>
							I can't open <code>{message.text}</code> — it's blocked by your <code>.dietcodeignore</code> file.
						</div>
					</div>
				)

			default:
				return null
		}
	}

	// For diff_error and dietcodeignore_error, we don't show the header separately
	if (errorType === "diff_error" || errorType === "dietcodeignore_error") {
		return renderErrorContent()
	}

	// For other error types, show header + content
	return renderErrorContent()
})

export default ErrorRow
