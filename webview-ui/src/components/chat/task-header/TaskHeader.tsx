import type { AuditMessageSnapshot, AuditTrend } from "@shared/audit/auditMessages"
import type { PreCompletionChecklistSummary } from "@shared/audit/auditPreCompletionChecklist"
import type { AuditHealthSummary } from "@shared/audit/auditRollup"
import type { SubagentAuditSummary } from "@shared/audit/auditSubagentRollup"
import type { ResolvedCompletionFunnelSnapshot } from "@shared/completion/completionFunnelMessages"
import { DietCodeMessage } from "@shared/ExtensionMessage"
import { StringArrayRequest } from "@shared/proto/dietcode/common"
import React, { useCallback, useId, useMemo, useState } from "react"
import Thumbnails from "@/components/common/Thumbnails"
import { getModeSpecificFields, normalizeApiConfiguration } from "@/components/settings/utils/providerUtils"
import {
	resetJoyZoningTaskOverride,
	updateSettingAsync,
	updateTaskSetting,
} from "@/components/settings/utils/settingsHandlers"
import { Switch } from "@/components/ui/switch"
import { useIsCompact } from "@/context/DensityContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { cn } from "@/lib/utils"
import { TaskServiceClient } from "@/services/grpc-client"
import { ExecutionStatusHeader } from "../execution-status/ExecutionStatusHeader"
import { deriveExecutionStatus } from "../execution-status/executionStatus"
import OpenDiskConversationHistoryButton from "./buttons/OpenDiskConversationHistoryButton"
import { CheckpointError } from "./CheckpointError"
import ContextWindow from "./ContextWindow"
import { FocusChain } from "./FocusChain"
import { TaskNotesSection } from "./TaskNotesSection"

const IS_DEV = process.env.IS_DEV === '"true"'
interface TaskHeaderProps {
	task: DietCodeMessage
	messages: DietCodeMessage[]
	tokensIn: number
	tokensOut: number
	doesModelSupportPromptCache: boolean
	cacheWrites?: number
	cacheReads?: number
	totalCost: number
	lastApiReqTotalTokens?: number
	lastProgressMessageText?: string
	latestAuditMetadata?: DietCodeMessage["auditMetadata"]
	completionFunnelSnapshot?: ResolvedCompletionFunnelSnapshot
	auditTrend?: AuditTrend
	auditSnapshots?: AuditMessageSnapshot[]
	auditHealth?: AuditHealthSummary
	subagentAuditSummary?: SubagentAuditSummary
	checklistSummary?: PreCompletionChecklistSummary
	showFocusChainPlaceholder?: boolean
	onScrollToAuditMessage?: (ts: number) => void
	onScrollToLatestGateBlock?: () => void
	onScrollToLatestAdvisory?: () => void
	onClose: () => void
	onSendMessage?: (command: string, files: string[], images: string[]) => void
}

const BUTTON_CLASS = "max-h-3 border-0 font-bold bg-transparent hover:opacity-100 text-foreground"

const TaskHeader: React.FC<TaskHeaderProps> = ({
	task,
	messages,
	tokensIn,
	tokensOut,
	cacheWrites,
	cacheReads,
	totalCost,
	lastApiReqTotalTokens,
	lastProgressMessageText,
	latestAuditMetadata,
	completionFunnelSnapshot,
	auditTrend: _auditTrend,
	auditSnapshots,
	auditHealth,
	subagentAuditSummary,
	checklistSummary,
	showFocusChainPlaceholder,
	onScrollToAuditMessage,
	onScrollToLatestGateBlock,
	onScrollToLatestAdvisory,
	onClose: _onClose,
	onSendMessage,
}) => {
	const {
		apiConfiguration,
		currentTaskItem,
		checkpointManagerErrorMessage,
		focusChainSettings,
		joyZoningSteeringEnabled,
		joyZoningSteeringTaskOverride,
		navigateToSettings,
		mode,
		expandTaskHeader: isTaskExpanded,
		setExpandTaskHeader,
		taskLifecycleEvent,
	} = useExtensionState()

	const [deleteConfirmationVisible, setDeleteConfirmationVisible] = useState(false)
	const [isSavingArchitectureGuidance, setIsSavingArchitectureGuidance] = useState(false)
	const [architectureGuidanceError, setArchitectureGuidanceError] = useState<string | null>(null)
	const [pendingArchitectureGuidance, setPendingArchitectureGuidance] = useState<boolean | null>(null)
	const architectureGuidanceStatusId = useId()
	const architectureGuidanceErrorId = useId()

	const handleCheckpointSettingsClick = useCallback(() => {
		navigateToSettings("features")
	}, [navigateToSettings])

	const handleJoyZoningToggle = useCallback(
		async (enabled: boolean) => {
			setPendingArchitectureGuidance(enabled)
			setArchitectureGuidanceError(null)
			setIsSavingArchitectureGuidance(true)
			try {
				if (currentTaskItem?.id) {
					await updateTaskSetting("joyZoningSteeringEnabled", enabled, currentTaskItem.id)
				} else {
					await updateSettingAsync("joyZoningSteeringEnabled", enabled)
				}
			} catch (error) {
				console.error("Failed to update task architecture guidance:", error)
				setArchitectureGuidanceError("Couldn't save this change. Try again.")
			} finally {
				setPendingArchitectureGuidance(null)
				setIsSavingArchitectureGuidance(false)
			}
		},
		[currentTaskItem?.id],
	)

	const handleUseDefaultJoyZoningSetting = useCallback(async () => {
		setArchitectureGuidanceError(null)
		setIsSavingArchitectureGuidance(true)
		try {
			await resetJoyZoningTaskOverride(currentTaskItem?.id)
		} catch (error) {
			console.error("Failed to reset task architecture guidance:", error)
			setArchitectureGuidanceError("Couldn't restore the default. Try again.")
		} finally {
			setIsSavingArchitectureGuidance(false)
		}
	}, [currentTaskItem?.id])

	const isCompact = useIsCompact()
	const isJoyZoningSteeringEnabled = pendingArchitectureGuidance ?? joyZoningSteeringEnabled !== false
	const hasTaskJoyZoningOverride = joyZoningSteeringTaskOverride !== undefined
	const joyZoningScopeLabel = hasTaskJoyZoningOverride ? "This task" : "Using default"
	const architectureGuidanceStatus = isSavingArchitectureGuidance
		? "Saving…"
		: architectureGuidanceError ||
			(hasTaskJoyZoningOverride
				? `${isJoyZoningSteeringEnabled ? "On" : "Off"} for this task · next request`
				: `${isJoyZoningSteeringEnabled ? "On" : "Off"} by default · next request`)

	// Simplified computed values
	const { selectedModelInfo } = normalizeApiConfiguration(apiConfiguration, mode)
	const modeFields = getModeSpecificFields(apiConfiguration, mode)

	const status = useMemo(
		() =>
			deriveExecutionStatus({
				messages,
				auditMetadata: latestAuditMetadata,
				auditHealth,
				completionFunnel: completionFunnelSnapshot,
				lifecycleEvent: taskLifecycleEvent,
				checkpointError: checkpointManagerErrorMessage,
			}),
		[messages, latestAuditMetadata, auditHealth, completionFunnelSnapshot, taskLifecycleEvent, checkpointManagerErrorMessage],
	)

	const isCostAvailable = Boolean(totalCost) && modeFields.apiProvider !== "openai-codex" // Subscription-based, no per-token costs

	const handleCopyTask = useCallback(() => {
		if (task.text) {
			void navigator.clipboard.writeText(task.text)
		}
	}, [task.text])

	const handleDeleteTask = useCallback(() => {
		if (currentTaskItem?.id) {
			void TaskServiceClient.deleteTasksWithIds(StringArrayRequest.create({ value: [currentTaskItem.id] }))
			setDeleteConfirmationVisible(false)
		}
	}, [currentTaskItem?.id])

	return (
		<div className="flex flex-col min-h-0 px-3 py-1.5">
			<ExecutionStatusHeader
				auditHealth={auditHealth}
				auditMetadata={latestAuditMetadata}
				checkpointError={checkpointManagerErrorMessage}
				completionFunnel={completionFunnelSnapshot}
				isDetailsOpen={isTaskExpanded}
				lifecycleEvent={taskLifecycleEvent}
				messages={messages}
				onReviewBlock={onScrollToLatestGateBlock}
				onToggleDetails={() => setExpandTaskHeader(!isTaskExpanded)}
				subagentAuditSummary={subagentAuditSummary}>
				{isTaskExpanded && (
					<div
						className={cn(
							"border-t border-current/10 bg-background/5 overflow-y-auto flex flex-col gap-1.5 min-h-0 max-h-[30vh]",
							isCompact ? "p-1.5 px-2" : "p-2 px-2.5",
						)}>
						<CheckpointError
							checkpointManagerErrorMessage={checkpointManagerErrorMessage}
							handleCheckpointSettingsClick={handleCheckpointSettingsClick}
						/>
						<div
							aria-busy={isSavingArchitectureGuidance}
							className="flex items-center justify-between gap-2 rounded-md border border-border/20 bg-background/20 px-2 py-1.5">
							<div className="min-w-0">
								<div className="text-[10px] font-medium text-foreground">Follow workspace patterns</div>
								<div
									aria-atomic="true"
									className={cn("text-[10px] text-muted-foreground", architectureGuidanceError && "text-error")}
									id={architectureGuidanceStatusId}
									role={architectureGuidanceError ? "alert" : "status"}>
									{joyZoningScopeLabel} · {architectureGuidanceStatus}
								</div>
							</div>
							<div className="flex shrink-0 items-center gap-2">
								{hasTaskJoyZoningOverride && (
									<button
										aria-label="Reset workspace pattern guidance to default"
										className="min-h-7 rounded border-0 bg-transparent px-2 py-1 text-[9px] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50"
										disabled={isSavingArchitectureGuidance}
										onClick={handleUseDefaultJoyZoningSetting}
										title="Reset this task to the saved default"
										type="button">
										Reset to default
									</button>
								)}
								<Switch
									aria-describedby={`${architectureGuidanceStatusId}${architectureGuidanceError ? ` ${architectureGuidanceErrorId}` : ""}`}
									aria-label="Follow workspace patterns for this task"
									checked={isJoyZoningSteeringEnabled}
									disabled={isSavingArchitectureGuidance}
									onCheckedChange={handleJoyZoningToggle}
								/>
							</div>
							{architectureGuidanceError && <span className="sr-only" id={architectureGuidanceErrorId}>{architectureGuidanceError}</span>}
						</div>
						<div className="flex items-start gap-1.5 text-xs">
							<span className="font-bold text-muted-foreground shrink-0 uppercase tracking-wide text-[9px] mt-0.5">
								Task:
							</span>
							<div className="flex-1 min-w-0 text-foreground/90 truncate" title={task.text}>
								{task.text}
							</div>
						</div>

						{((task.images && task.images.length > 0) || (task.files && task.files.length > 0)) && (
							<Thumbnails files={task.files ?? []} images={task.images ?? []} />
						)}

						{focusChainSettings.enabled && (
							<FocusChain
								currentTaskItemId={currentTaskItem?.id}
								executionState={status.state}
								lastProgressMessageText={lastProgressMessageText}
								showPlaceholderWhenEmpty={showFocusChainPlaceholder}
							/>
						)}

						<ContextWindow
							cacheReads={cacheReads}
							cacheWrites={cacheWrites}
							contextWindow={selectedModelInfo?.contextWindow}
							lastApiReqTotalTokens={lastApiReqTotalTokens}
							onSendMessage={onSendMessage}
							tokensIn={tokensIn}
							tokensOut={tokensOut}
							useAutoCondense={false}
						/>

						<TaskNotesSection
							auditHealth={auditHealth}
							auditSnapshots={auditSnapshots}
							auditTrend={_auditTrend}
							checklistSummary={checklistSummary}
							completionFunnelSnapshot={completionFunnelSnapshot}
							latestAuditMetadata={latestAuditMetadata}
							onScrollToAuditMessage={onScrollToAuditMessage}
							onScrollToLatestAdvisory={onScrollToLatestAdvisory}
							onScrollToLatestGateBlock={onScrollToLatestGateBlock}
							subagentAuditSummary={subagentAuditSummary}
						/>

						<div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2.5 mt-0.5 border-t border-border/25">
							<button
								className="text-[10px] text-muted-foreground hover:text-foreground bg-transparent border-0 p-0 cursor-pointer"
								onClick={handleCopyTask}
								type="button">
								Copy prompt
							</button>
							{deleteConfirmationVisible ? (
								<fieldset
									aria-label="Confirm chat deletion"
									className="m-0 flex items-center gap-2 rounded-md border border-error/25 bg-error/[0.04] px-2 py-1">
									<span className="text-[10px] text-error">Delete permanently?</span>
									<button
										className="rounded border-0 bg-transparent px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
										onClick={() => setDeleteConfirmationVisible(false)}
										type="button">
										Cancel
									</button>
									<button
										className="rounded border border-error/35 bg-error/10 px-1.5 py-1 text-[10px] font-medium text-error hover:bg-error/15"
										onClick={handleDeleteTask}
										type="button">
										Delete
									</button>
								</fieldset>
							) : (
								<button
									className="text-[10px] text-muted-foreground hover:text-destructive bg-transparent border-0 p-0 cursor-pointer disabled:opacity-40"
									disabled={!currentTaskItem?.id}
									onClick={() => setDeleteConfirmationVisible(true)}
									type="button">
									Delete chat…
								</button>
							)}
							{IS_DEV && (
								<OpenDiskConversationHistoryButton className={BUTTON_CLASS} taskId={currentTaskItem?.id} />
							)}
							{isCostAvailable && (
								<span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
									${totalCost?.toFixed(4)}
								</span>
							)}
						</div>
					</div>
				)}
			</ExecutionStatusHeader>
		</div>
	)
}

export default TaskHeader
