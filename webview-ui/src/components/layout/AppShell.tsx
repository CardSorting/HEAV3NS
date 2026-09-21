import { StringArrayRequest, StringRequest } from "@shared/proto/dietcode/common"
import { TaskFavoriteRequest } from "@shared/proto/dietcode/task"
import { GitBranch, History, Menu, MessageSquare, MoreHorizontal, Plus, Search, Settings, Star, Trash2, X } from "lucide-react"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Heav3nsSignalMark } from "@/assets/Heav3nsSignalMark"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { cn } from "@/lib/utils"
import { TaskServiceClient } from "@/services/core-grpc-client"

interface AppShellProps {
	children: React.ReactNode
	onRequestNewChat: () => void
}

const formatRelativeTime = (ts: number) => {
	const now = Date.now()
	const diff = now - ts
	const sec = Math.floor(diff / 1000)
	const min = Math.floor(sec / 60)
	const hr = Math.floor(min / 60)
	const day = Math.floor(hr / 24)

	if (sec < 60) return "Just now"
	if (min < 60) return `${min}m ago`
	if (hr < 24) return `${hr}h ago`
	if (day === 1) return "Yesterday"
	return `${day}d ago`
}

export const AppShell: React.FC<AppShellProps> = ({ children, onRequestNewChat }) => {
	const {
		taskHistory,
		currentTaskItem,
		workspaceRoots,
		navigateToHistory,
		navigateToSettings,
		navigateToWorktrees,
		showHistory,
		showSettings,
		showWorktrees,
		navigateToChat,
	} = useExtensionState()

	const [searchQuery, setSearchQuery] = useState("")
	const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
	const searchInputRef = useRef<HTMLInputElement>(null)

	// Filter history list based on search query
	const filteredHistory = useMemo(() => {
		const base = [...taskHistory].filter((item) => item.ts && item.task).sort((a, b) => b.ts - a.ts)

		const query = searchQuery.trim().toLowerCase()
		if (!query) return base
		return base.filter((item) => item.task.toLowerCase().includes(query))
	}, [taskHistory, searchQuery])

	// Active task ID
	const activeTaskId = currentTaskItem?.id

	// Keyboard shortcut listeners
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
			const modifier = isMac ? e.metaKey : e.ctrlKey

			if (modifier && e.key === "k") {
				e.preventDefault()
				onRequestNewChat()
				setIsMobileSidebarOpen(false)
			}
			if (modifier && e.key === "f") {
				e.preventDefault()
				searchInputRef.current?.focus()
			}
		}
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [onRequestNewChat])

	const handleOpenTask = useCallback(
		(id: string) => {
			TaskServiceClient.showTaskWithId(StringRequest.create({ value: id }))
				.then(() => {
					navigateToChat()
					setIsMobileSidebarOpen(false)
				})
				.catch((error) => console.error("Error opening task:", error))
		},
		[navigateToChat],
	)

	const handleDeleteTask = useCallback((id: string, e: React.MouseEvent) => {
		e.stopPropagation()
		TaskServiceClient.deleteTasksWithIds(StringArrayRequest.create({ value: [id] })).catch((error) =>
			console.error("Error deleting task:", error),
		)
	}, [])

	const handleToggleFavorite = useCallback((id: string, isFavorited: boolean, e: React.MouseEvent) => {
		e.stopPropagation()
		TaskServiceClient.toggleTaskFavorite(
			TaskFavoriteRequest.create({
				taskId: id,
				isFavorited: !isFavorited,
			}),
		).catch((error) => console.error("Error toggling favorite:", error))
	}, [])

	// Determine current view tab
	const activeTab = useMemo(() => {
		if (showHistory) return "history"
		if (showSettings) return "settings"
		if (showWorktrees) return "worktrees"
		return "chat"
	}, [showHistory, showSettings, showWorktrees])

	const handleNav = useCallback(
		(tab: "chat" | "history" | "worktrees" | "settings") => {
			if (tab === "chat") navigateToChat()
			else if (tab === "history") navigateToHistory()
			else if (tab === "worktrees") navigateToWorktrees()
			else if (tab === "settings") navigateToSettings()
			setIsMobileSidebarOpen(false)
		},
		[navigateToChat, navigateToHistory, navigateToWorktrees, navigateToSettings],
	)

	const renderSidebarContent = () => (
		<div className="flex h-full w-full flex-col bg-heav3ns-bg-dark text-heav3ns-text-primary select-none border-r border-heav3ns-border">
			{/* New chat button */}
			<div className="px-4 pt-4 pb-2">
				<button
					className="flex w-full items-center justify-between rounded-lg bg-heav3ns-active px-4 py-3 text-sm font-semibold text-heav3ns-foreground transition-all hover:bg-heav3ns-active/85 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heav3ns"
					onClick={() => {
						onRequestNewChat()
						setIsMobileSidebarOpen(false)
					}}
					type="button">
					<span className="flex items-center gap-2">
						<Plus className="size-4" />
						New chat
					</span>
					<kbd className="hidden font-sans text-xs opacity-60 min-[240px]:inline-block">⌘K</kbd>
				</button>
			</div>

			{/* Search input */}
			<div className="px-4 py-2">
				<div className="relative flex items-center">
					<Search className="absolute left-3 size-4 text-heav3ns-text-secondary/65" />
					<input
						className="w-full rounded-lg bg-heav3ns-panel-raised border border-heav3ns-border py-2.5 pl-10 pr-4 text-xs text-heav3ns-text-primary placeholder:text-heav3ns-text-secondary/55 focus:outline-none focus:ring-1 focus:ring-heav3ns/70"
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search chats..."
						ref={searchInputRef}
						type="text"
						value={searchQuery}
					/>
					{searchQuery && (
						<button
							className="absolute right-3 text-heav3ns-text-secondary/65 hover:text-heav3ns-text-primary"
							onClick={() => setSearchQuery("")}
							type="button">
							<X className="size-3.5" />
						</button>
					)}
				</div>
			</div>

			{/* Recent chats section */}
			<div className="flex-1 overflow-y-auto px-2 py-2">
				<div className="flex items-center justify-between px-2.5 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-heav3ns-text-secondary/65">
					<span>Recent chats</span>
				</div>

				<div className="space-y-0.5">
					{filteredHistory.map((item) => {
						const isSelected = activeTaskId === item.id && activeTab === "chat"
						// If multiline task, split it to show preview
						const lines = item.task.split("\n").filter(Boolean)
						const title = lines[0] || ""
						const subtitle = lines.slice(1).join(" ") || undefined

						return (
							<div
								className={cn(
									"group relative flex min-h-12 w-full cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors",
									isSelected
										? "bg-heav3ns-active/10 border border-heav3ns-active/30"
										: "hover:bg-heav3ns-panel-raised border border-transparent",
								)}
								key={item.id}
								onClick={() => handleOpenTask(item.id)}>
								<MessageSquare
									className={cn("size-4 mt-0.5 shrink-0 text-heav3ns-text-secondary/65", isSelected && "text-heav3ns-cyan")}
								/>
								<div className="flex-1 min-w-0 pr-6">
									<div className="flex items-baseline justify-between gap-1.5">
										<p className="truncate text-xs font-semibold leading-tight text-heav3ns-text-primary">{title}</p>
									</div>
									<div className="flex items-center gap-1.5 mt-1">
										{subtitle && (
											<p className="truncate text-[10px] leading-tight text-heav3ns-text-secondary/65 flex-1">
												{subtitle}
											</p>
										)}
										<span className="text-[10px] leading-tight text-heav3ns-text-secondary/45 whitespace-nowrap">
											{formatRelativeTime(item.ts)}
										</span>
									</div>
								</div>

								{/* Action buttons (Star, Delete) inside Popover menu */}
								<div className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
									<Popover>
										<PopoverTrigger asChild>
											<button
												className="flex size-6 items-center justify-center rounded-lg hover:bg-heav3ns-panel-raised text-heav3ns-text-secondary/65 hover:text-heav3ns-text-primary"
												onClick={(e) => e.stopPropagation()}
												type="button">
												<MoreHorizontal className="size-3.5" />
											</button>
										</PopoverTrigger>
										<PopoverContent align="end" className="w-36 p-1 bg-heav3ns-panel-raised border-heav3ns-border rounded-lg">
											<button
												className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-heav3ns-panel-raised text-heav3ns-text-primary"
												onClick={(e) => handleToggleFavorite(item.id, !!item.isFavorited, e)}
												type="button">
													<Star
														className={cn(
															"size-3.5 text-heav3ns-text-secondary/70",
														item.isFavorited && "fill-yellow-500 text-yellow-500",
													)}
												/>
												{item.isFavorited ? "Unsave" : "Save"}
											</button>
											<button
												className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-red-500/10 text-red-400"
												onClick={(e) => handleDeleteTask(item.id, e)}
												type="button">
												<Trash2 className="size-3.5" />
												Delete
											</button>
										</PopoverContent>
									</Popover>
								</div>
							</div>
						)
					})}
					{filteredHistory.length === 0 && (
						<p className="px-3 py-4 text-center text-xs text-heav3ns-text-secondary/55">No chats found</p>
					)}
				</div>
			</div>
		</div>
	)

	return (
		<div className="flex h-screen w-full overflow-hidden bg-heav3ns-bg-dark">
			{/* Desktop Sidebar (Left) */}
			<aside className="hidden md:block w-[300px] shrink-0 h-full">{renderSidebarContent()}</aside>

			{/* Mobile Sidebar Slide-out Drawer */}
			{isMobileSidebarOpen && (
				<div className="fixed inset-0 z-50 flex md:hidden">
					{/* Overlay */}
					<div className="fixed inset-0 bg-black/60 transition-opacity" onClick={() => setIsMobileSidebarOpen(false)} />
					{/* Drawer Panel */}
					<div className="relative flex w-[280px] max-w-[80%] flex-col bg-heav3ns-bg-dark h-full shadow-2xl animate-in slide-in-from-left duration-200">
						{renderSidebarContent()}
						{/* Close button inside drawer */}
						<button
							className="absolute top-4 right-[-44px] flex size-9 items-center justify-center rounded-lg bg-heav3ns-bg-dark border border-heav3ns-border text-heav3ns-text-primary shadow-lg"
							onClick={() => setIsMobileSidebarOpen(false)}
							type="button">
							<X className="size-4" />
						</button>
					</div>
				</div>
			)}

			{/* Main Workspace Area (Right) */}
			<div className="flex flex-1 flex-col min-w-0 h-full relative">
				{/* Top application bar */}
				<header className="flex h-16 items-center justify-between border-b border-heav3ns-border bg-heav3ns-bg-dark/90 px-4 select-none shrink-0 z-20">
					{/* Left: Back button (if in sub-view) or Hamburger menu + Brand Identity */}
					<div className="flex items-center gap-3">
						{activeTab !== "chat" ? (
							<button
								className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-heav3ns-panel-raised hover:bg-heav3ns-graphite text-xs font-semibold text-heav3ns-text-primary transition-all cursor-pointer border border-heav3ns-border active:scale-[0.98]"
								onClick={() => handleNav("chat")}
								type="button">
								<svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
									<path d="M19 12H5M12 19l-7-7 7-7" />
								</svg>
								Back to Chat
							</button>
						) : (
							<>
								<button
									aria-label="Open sidebar"
									className="flex md:hidden size-9 items-center justify-center rounded-lg hover:bg-heav3ns-panel-raised text-heav3ns-text-primary transition-colors"
									onClick={() => setIsMobileSidebarOpen(true)}
									type="button">
									<Menu className="size-5" />
								</button>
								<div
									className="flex items-center gap-2.5 cursor-pointer active:opacity-85"
									onClick={() => handleNav("chat")}>
									<div className="heav3ns-shell-mark" aria-hidden="true">
										<Heav3nsSignalMark accentColor="var(--color-heav3ns-cyan)" className="h-auto w-5 text-heav3ns-active" />
									</div>
									<span className="text-sm font-bold tracking-wider text-heav3ns-text-primary uppercase font-mono">
										HEAV3NS
									</span>
								</div>
							</>
						)}
					</div>

					{/* Right: Actions */}
					<div className="flex items-center gap-1">
						{/* History Button */}
						<button
							className={cn(
								"flex size-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-heav3ns",
								activeTab === "history"
									? "bg-heav3ns-panel-raised text-heav3ns-text-primary"
									: "text-heav3ns-text-secondary/85 hover:bg-heav3ns-panel-raised/60 hover:text-heav3ns-text-primary",
							)}
							onClick={() => handleNav("history")}
							title="Chat history"
							type="button">
							<History className="size-4" />
						</button>

						{/* Worktrees / Branches */}
						<button
							className={cn(
								"flex size-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-heav3ns",
								activeTab === "worktrees"
									? "bg-heav3ns-panel-raised text-heav3ns-text-primary"
									: "text-heav3ns-text-secondary/85 hover:bg-heav3ns-panel-raised/60 hover:text-heav3ns-text-primary",
							)}
							onClick={() => handleNav("worktrees")}
							title="Branch workspaces"
							type="button">
							<GitBranch className="size-4" />
						</button>

						{/* Settings */}
						<button
							className={cn(
								"flex size-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-heav3ns",
								activeTab === "settings"
									? "bg-heav3ns-panel-raised text-heav3ns-text-primary"
									: "text-heav3ns-text-secondary/85 hover:bg-heav3ns-panel-raised/60 hover:text-heav3ns-text-primary",
							)}
							onClick={() => handleNav("settings")}
							title="Settings"
							type="button">
							<Settings className="size-4" />
						</button>
					</div>
				</header>

				{/* Children Content Panel (centered workspace) */}
				<main className="flex-1 overflow-hidden relative flex flex-col items-center">
					<div className="w-full max-w-[1000px] h-full flex flex-col">{children}</div>
				</main>
			</div>
		</div>
	)
}
