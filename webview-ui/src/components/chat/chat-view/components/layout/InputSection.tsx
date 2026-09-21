import type { DietCodeMessage } from "@shared/ExtensionMessage"
import { AlertCircle, LoaderCircle, LockKeyhole, MessageSquarePlus, X } from "lucide-react"
import React, { useMemo, useState } from "react"
import ChatTextArea from "@/components/chat/ChatTextArea"
import QuotedMessagePreview from "@/components/chat/QuotedMessagePreview"
import { QuoteSelectionBar } from "@/components/chat/QuoteSelectionBar"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { isChatInputEnabled } from "../../shared/chatInputPolicy"
import { deriveComposerMode, shouldCollapseComposer } from "../../shared/composerState"
import { ChatState, MessageHandlers, ScrollBehavior } from "../../types/chatTypes"

interface InputSectionProps {
	messages: DietCodeMessage[]
	taskSessionActive: boolean
	chatState: ChatState
	messageHandlers: MessageHandlers
	scrollBehavior: ScrollBehavior
	placeholderText: string
	shouldDisableFilesAndImages: boolean
	selectFilesAndImages: () => Promise<void>
}

/**
 * Input section including quoted message preview and chat text area
 */
export const InputSection: React.FC<InputSectionProps> = ({
	messages,
	taskSessionActive,
	chatState,
	messageHandlers,
	scrollBehavior,
	placeholderText,
	shouldDisableFilesAndImages,
	selectFilesAndImages,
}) => {
	const { taskLifecycleEvent } = useExtensionState()
	const {
		activeQuote,
		setActiveQuote,
		pendingQuote,
		setPendingQuote,
		isTextAreaFocused,
		inputValue,
		setInputValue,
		sendingDisabled,
		dietcodeAsk,
		selectedImages,
		setSelectedImages,
		selectedFiles,
		setSelectedFiles,
		textAreaRef,
		handleFocusChange,
	} = chatState

	const sendRouteOptions = useMemo(() => ({ taskSessionActive }), [taskSessionActive])

	const inputEnabled = useMemo(
		() => isChatInputEnabled(messages, dietcodeAsk, { sendingDisabled }, sendRouteOptions),
		[messages, dietcodeAsk, sendingDisabled, sendRouteOptions],
	)
	const composerMode = useMemo(
		() => deriveComposerMode(messages, dietcodeAsk, inputEnabled, taskLifecycleEvent),
		[messages, dietcodeAsk, inputEnabled, taskLifecycleEvent],
	)
	const lastMessageTs = messages.at(-1)?.ts
	const composerKey = `${lastMessageTs ?? "empty"}:${composerMode}`
	const [expandedComposerKey, setExpandedComposerKey] = useState<string>()
	const secondaryComposerExpanded = expandedComposerKey === composerKey
	const composerCollapsed =
		!secondaryComposerExpanded && shouldCollapseComposer(composerMode, Boolean(inputValue.trim()), Boolean(activeQuote))

	const { isAtBottom, scrollToBottomAuto } = scrollBehavior
	const updateActiveQuote = (quote: string | null) => {
		messageHandlers.handleDraftChanged()
		setActiveQuote(quote)
	}

	return (
		<>
			{pendingQuote && !activeQuote && (
				<div className="mx-2.5 mb-1">
						<QuoteSelectionBar
							onQuote={() => {
							updateActiveQuote(pendingQuote)
							setPendingQuote(null)
							window.getSelection()?.removeAllRanges()
						}}
					/>
				</div>
			)}
			{activeQuote && (
				<QuotedMessagePreview isFocused={isTextAreaFocused} onDismiss={() => updateActiveQuote(null)} text={activeQuote} />
			)}
			{messageHandlers.sendError && (
				<div
					aria-atomic="true"
					className="mx-3 mb-2 flex min-w-0 items-center gap-2 rounded-md border border-error/30 bg-error/[0.06] px-2.5 py-2 text-xs text-foreground"
					role="alert">
					<AlertCircle aria-hidden className="size-3.5 shrink-0 text-error" />
					<p className="m-0 min-w-0 flex-1 break-words leading-snug">{messageHandlers.sendError}</p>
					{messageHandlers.canRetrySend && (
						<button
							className="shrink-0 rounded px-1.5 py-1 font-medium text-link underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							disabled={messageHandlers.isSending}
							onClick={() => void messageHandlers.retryLastSend()}
							type="button">
							Retry
						</button>
					)}
					<button
						aria-label="Dismiss message"
						className="flex size-6 shrink-0 items-center justify-center rounded text-description transition-colors hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						onClick={messageHandlers.clearSendError}
						type="button">
						<X aria-hidden className="size-3" />
					</button>
				</div>
			)}
			{messageHandlers.isSending && (
				<div aria-live="polite" className="mx-4 mb-1 flex items-center gap-1.5 text-[10px] text-description" role="status">
					<LoaderCircle aria-hidden className="size-3 animate-spin" />
					Sending…
				</div>
			)}

			{composerMode === "disabled" ? (
				<div className="px-3 pb-2">
					<div className="flex min-h-9 items-center gap-2 rounded-lg border border-border/45 bg-foreground/[0.025] px-3 text-[10px] text-description">
						<LockKeyhole aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
						<span>Composer unavailable until recovery is resolved.</span>
					</div>
				</div>
			) : composerCollapsed ? (
				<div className="px-3 pb-2">
					<button
						className="flex min-h-9 w-full items-center gap-2 rounded-lg border border-border/50 bg-transparent px-3 text-left text-[10px] text-description transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						onClick={() => {
							setExpandedComposerKey(composerKey)
							setTimeout(() => textAreaRef.current?.focus(), 0)
						}}
						type="button">
						<MessageSquarePlus aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
						<span>
							{composerMode === "approval"
								? "Add optional guidance"
								: composerMode === "recovering"
									? "Add recovery guidance"
									: "Ask a follow-up"}
						</span>
						<span className="ml-auto text-[8px] uppercase tracking-wide text-description/60">Optional</span>
					</button>
				</div>
			) : (
				<ChatTextArea
					activeQuote={activeQuote}
					composerMode={composerMode}
					inputValue={inputValue}
					onFocusChange={handleFocusChange}
					onHeightChange={() => {
						if (isAtBottom) {
							scrollToBottomAuto()
						}
					}}
					onSelectFilesAndImages={selectFilesAndImages}
					onSend={(value) => messageHandlers.handleSendMessage(value || inputValue, selectedImages, selectedFiles)}
					placeholderText={placeholderText}
					ref={textAreaRef}
					selectedFiles={selectedFiles}
					selectedImages={selectedImages}
						sendingDisabled={!inputEnabled || messageHandlers.isSending}
						setInputValue={(value) => {
							messageHandlers.handleDraftChanged()
							setInputValue(value)
						}}
						setSelectedFiles={(value) => {
							messageHandlers.handleDraftChanged()
							setSelectedFiles(value)
						}}
						setSelectedImages={(value) => {
							messageHandlers.handleDraftChanged()
							setSelectedImages(value)
						}}
					shouldDisableFilesAndImages={shouldDisableFilesAndImages}
				/>
			)}
		</>
	)
}
