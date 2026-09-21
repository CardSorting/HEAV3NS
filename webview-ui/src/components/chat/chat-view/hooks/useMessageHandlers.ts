import type { DietCodeMessage } from "@shared/ExtensionMessage"
import { EmptyRequest, StringRequest } from "@shared/proto/dietcode/common"
import { AskResponseRequest, NewTaskRequest } from "@shared/proto/dietcode/task"
import { useCallback, useMemo, useRef, useState } from "react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { SlashServiceClient, TaskServiceClient } from "@/services/grpc-client"
import type { ButtonActionType } from "../shared/buttonConfig"
import { resolveChatSendRoute } from "../shared/chatInputPolicy"
import type { ChatState, MessageHandlers } from "../types/chatTypes"

/**
 * Custom hook for managing message handlers
 * Handles sending messages, button clicks, and task management
 */
export function useMessageHandlers(messages: DietCodeMessage[], chatState: ChatState): MessageHandlers {
	const { backgroundCommandRunning, currentTaskItem } = useExtensionState()
	const [sendError, setSendError] = useState<string>()
	const [isSending, setIsSending] = useState(false)
	const [canRetrySend, setCanRetrySend] = useState(false)
	const messagesRef = useRef(messages)
	messagesRef.current = messages
	const chatStateRef = useRef(chatState)
	chatStateRef.current = chatState
	const backgroundCommandRunningRef = useRef(backgroundCommandRunning)
	backgroundCommandRunningRef.current = backgroundCommandRunning
	const taskIdRef = useRef(currentTaskItem?.id)
	taskIdRef.current = currentTaskItem?.id
	const cancelInFlightRef = useRef(false)
	const sendInFlightRef = useRef(false)
	const pendingNewTaskRequestIdRef = useRef<string>()
	const failedSendRef = useRef<{ text: string; images: string[]; files: string[] }>()

	const handleDraftChanged = useCallback(() => {
		pendingNewTaskRequestIdRef.current = undefined
		failedSendRef.current = undefined
		setSendError(undefined)
		setCanRetrySend(false)
	}, [])
	const clearSendError = useCallback(() => setSendError(undefined), [])

	const getNewTaskRequestId = useCallback(() => {
		if (!pendingNewTaskRequestIdRef.current) {
			const bytes = new Uint8Array(16)
			if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes)
			else bytes.forEach((_, index) => (bytes[index] = Math.floor(Math.random() * 256)))
			const nonce = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
			pendingNewTaskRequestIdRef.current = `${Date.now()}-${nonce}`
		}
		return pendingNewTaskRequestIdRef.current
	}, [])

	// Handle sending a message
	const handleSendMessage = useCallback(async (text: string, images: string[], files: string[]) => {
		if (sendInFlightRef.current) return
		const currentChatState = chatStateRef.current
		const currentMessages = messagesRef.current
		const activeQuote = currentChatState.activeQuote
		const dietcodeAsk = currentChatState.dietcodeAsk
		const sendRouteOptions = { taskSessionActive: Boolean(taskIdRef.current) }
		let messageToSend = text.trim()
		const hasContent = messageToSend || images.length > 0 || files.length > 0

		// Prepend the active quote if it exists
		if (activeQuote && hasContent) {
			const prefix = "[context] \n> "
			const formattedQuote = activeQuote
			const suffix = "\n[/context] \n\n"
			messageToSend = `${prefix} ${formattedQuote} ${suffix} ${messageToSend}`
		}

		if (!hasContent) return
		sendInFlightRef.current = true
		setIsSending(true)
		setSendError(undefined)
		setCanRetrySend(false)
		let sendRoute: ReturnType<typeof resolveChatSendRoute> | undefined
		try {
			sendRoute = resolveChatSendRoute(currentMessages, dietcodeAsk, sendRouteOptions)
			console.log("[ChatView] handleSendMessage - route:", sendRoute, messageToSend)
			let messageSent = false

			if (sendRoute === "new_task") {
				await TaskServiceClient.newTask(
					NewTaskRequest.create({
						requestId: getNewTaskRequestId(),
						text: messageToSend,
						images,
						files,
					}),
				)
				messageSent = true
			} else if (sendRoute === "ask") {
				if (dietcodeAsk === "resume_task" || dietcodeAsk === "resume_completed_task") {
					await TaskServiceClient.askResponse(
						AskResponseRequest.create({
							responseType: "yesButtonClicked",
							text: messageToSend,
							images,
							files,
						}),
					)
					messageSent = true
				} else {
					switch (dietcodeAsk) {
						case "followup":
						case "plan_mode_respond":
						case "tool":
						case "browser_action_launch":
						case "command":
						case "command_output":
						case "use_mcp_server":
						case "use_subagents":
						case "completion_result":
						case "mistake_limit_reached":
						case "api_req_failed":
						case "new_task":
						case "condense":
						case "report_bug":
							await TaskServiceClient.askResponse(
								AskResponseRequest.create({
									responseType: "messageResponse",
									text: messageToSend,
									images,
									files,
								}),
							)
							messageSent = true
							break
					}
				}
			} else if (sendRoute === "follow_up") {
				await TaskServiceClient.askResponse(
					AskResponseRequest.create({
						responseType: "messageResponse",
						text: messageToSend,
						images,
						files,
					}),
				)
				messageSent = true
			} else {
				console.warn("[ChatView] Message not sent — no active send route", {
					dietcodeAsk,
					messageCount: currentMessages.length,
				})
			}

			if (messageSent) {
				const isFollowUpMessage = sendRoute === "follow_up"
				currentChatState.setInputValue("")
				currentChatState.setActiveQuote(null)
				currentChatState.setPendingQuote(null)
				if (!isFollowUpMessage) {
					currentChatState.setSendingDisabled(true)
					currentChatState.setEnableButtons(false)
				}
				currentChatState.setSelectedImages([])
				currentChatState.setSelectedFiles([])
				failedSendRef.current = undefined
				pendingNewTaskRequestIdRef.current = undefined
				setCanRetrySend(false)
			} else {
				throw new Error("No active route can accept this message.")
			}
		} catch (error) {
			console.error("[ChatView] Message submission failed:", error)
			failedSendRef.current = { text, images, files }
			setCanRetrySend(true)
			setSendError(
				sendRoute === "new_task"
					? "Couldn't start this task. Your draft and attachments are still here. Try again."
					: "Couldn't send this message. Your draft and attachments are still here. Try again.",
			)
		} finally {
			sendInFlightRef.current = false
			setIsSending(false)
		}
	}, [getNewTaskRequestId])

	const retryLastSend = useCallback(async () => {
		const failedSend = failedSendRef.current
		if (failedSend) await handleSendMessage(failedSend.text, failedSend.images, failedSend.files)
	}, [handleSendMessage])

	// Start a new task
	const startNewTask = useCallback(async () => {
		chatStateRef.current.setActiveQuote(null)
		chatStateRef.current.setPendingQuote(null)
		try {
			await TaskServiceClient.clearTask(EmptyRequest.create({}))
			pendingNewTaskRequestIdRef.current = undefined
			failedSendRef.current = undefined
			setSendError(undefined)
			setCanRetrySend(false)
		} catch (error) {
			console.error("[ChatView] Failed to clear the current task:", error)
			setSendError("Couldn't open a new task. Your current conversation is still available; try again.")
			setCanRetrySend(false)
		}
	}, [])

	// Clear input state helper
	const clearInputState = useCallback(() => {
		const currentChatState = chatStateRef.current
		currentChatState.setInputValue("")
		currentChatState.setActiveQuote(null)
		currentChatState.setPendingQuote(null)
		currentChatState.setSelectedImages([])
		currentChatState.setSelectedFiles([])
		pendingNewTaskRequestIdRef.current = undefined
		failedSendRef.current = undefined
		setSendError(undefined)
		setCanRetrySend(false)
	}, [])

	// Execute button action based on type
	const executeButtonAction = useCallback(
		async (actionType: ButtonActionType, text?: string, images?: string[], files?: string[]) => {
			const currentChatState = chatStateRef.current
			const dietcodeAsk = currentChatState.dietcodeAsk
			const lastMessage = currentChatState.lastMessage
			const trimmedInput = text?.trim()
			const hasContent = trimmedInput || (images && images.length > 0) || (files && files.length > 0)

			try {
				switch (actionType) {
				case "retry":
					// For API retry (api_req_failed), always send simple approval without content
					await TaskServiceClient.askResponse(
						AskResponseRequest.create({
							responseType: "yesButtonClicked",
						}),
					)
					clearInputState()
					break
				case "approve":
					if (hasContent) {
						await TaskServiceClient.askResponse(
							AskResponseRequest.create({
								responseType: "yesButtonClicked",
								text: trimmedInput,
								images: images,
								files: files,
							}),
						)
					} else {
						await TaskServiceClient.askResponse(
							AskResponseRequest.create({
								responseType: "yesButtonClicked",
							}),
						)
					}
					clearInputState()
					break

				case "reject":
					if (hasContent) {
						await TaskServiceClient.askResponse(
							AskResponseRequest.create({
								responseType: "noButtonClicked",
								text: trimmedInput,
								images: images,
								files: files,
							}),
						)
					} else {
						await TaskServiceClient.askResponse(
							AskResponseRequest.create({
								responseType: "noButtonClicked",
							}),
						)
					}
					clearInputState()
					break

				case "proceed":
					if (hasContent) {
						await TaskServiceClient.askResponse(
							AskResponseRequest.create({
								responseType: "yesButtonClicked",
								text: trimmedInput,
								images: images,
								files: files,
							}),
						)
					} else {
						await TaskServiceClient.askResponse(
							AskResponseRequest.create({
								responseType: "yesButtonClicked",
							}),
						)
					}
					clearInputState()
					break

				case "new_task":
					if (dietcodeAsk === "new_task") {
						await TaskServiceClient.newTask(
							NewTaskRequest.create({
								requestId: getNewTaskRequestId(),
								text: lastMessage?.text,
								images: [],
								files: [],
							}),
						)
						pendingNewTaskRequestIdRef.current = undefined
						setSendError(undefined)
						setCanRetrySend(false)
					} else {
						await startNewTask()
					}
					break

				case "cancel": {
					if (cancelInFlightRef.current) {
						return
					}
					cancelInFlightRef.current = true
					currentChatState.setSendingDisabled(true)
					currentChatState.setEnableButtons(false)
					try {
						if (backgroundCommandRunningRef.current) {
							await TaskServiceClient.cancelBackgroundCommand(EmptyRequest.create({})).catch((err) =>
								console.error("Failed to cancel background command:", err),
							)
						}
						await TaskServiceClient.cancelTask(EmptyRequest.create({}))
					} finally {
						cancelInFlightRef.current = false
						// Clear any pending state that might interfere with resume
						currentChatState.setSendingDisabled(false)
						currentChatState.setEnableButtons(true)
					}
					break
				}

				case "utility":
					switch (dietcodeAsk) {
						case "condense":
							await SlashServiceClient.condense(StringRequest.create({ value: lastMessage?.text })).catch((err) =>
								console.error(err),
							)
							break
						case "report_bug":
							await SlashServiceClient.reportBug(StringRequest.create({ value: lastMessage?.text })).catch((err) =>
								console.error(err),
							)
							break
					}
					break
				}
			} catch (error) {
				console.error(`[ChatView] Button action '${actionType}' failed:`, error)
				setSendError("Couldn't complete that action. You can retry it from the same task controls.")
				setCanRetrySend(false)
			}
		},
		[clearInputState, getNewTaskRequestId, startNewTask],
	)

	// Handle task close button click
	const handleTaskCloseButtonClick = useCallback(() => {
		startNewTask()
	}, [startNewTask])

	return useMemo(
		() => ({
			sendError,
			isSending,
			canRetrySend,
			handleSendMessage,
			executeButtonAction,
			retryLastSend,
			handleDraftChanged,
			clearSendError,
			handleTaskCloseButtonClick,
			startNewTask,
		}),
		[
			sendError,
			isSending,
			canRetrySend,
			handleSendMessage,
			executeButtonAction,
			retryLastSend,
			handleDraftChanged,
			clearSendError,
			handleTaskCloseButtonClick,
			startNewTask,
		],
	)
}
