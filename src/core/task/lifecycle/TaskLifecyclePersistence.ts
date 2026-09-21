import {
	isTaskLifecycleEvent,
	isTaskLifecycleEventForRecord,
	isTaskLifecycleRecord,
	type TaskLifecycleEvent,
	type TaskLifecycleRecord,
	type TaskParentLink,
	taskLifecycleRecordFromEvent,
} from "@shared/lifecycle/taskLifecycleEvent"
import { getCachedStatement, getCoordinationDb } from "@/infrastructure/db/Config"

export interface LifecycleCommitExpectation {
	generationId?: string
	lifecycleRevision?: number
	absent?: boolean
}

export type LifecyclePersistenceCommitResult =
	| { kind: "committed"; record: TaskLifecycleRecord; event: TaskLifecycleEvent }
	| { kind: "duplicate_intent"; record: TaskLifecycleRecord; event: TaskLifecycleEvent }
	| { kind: "compare_and_swap_failed"; current?: TaskLifecycleRecord }
	| { kind: "constraint_failed"; reason: string; current?: TaskLifecycleRecord }

export interface TaskLifecyclePersistence {
	load(taskId: string): Promise<TaskLifecycleRecord | undefined>
	loadEvent(eventId: string): Promise<TaskLifecycleEvent | undefined>
	commit(
		expectation: LifecycleCommitExpectation,
		record: TaskLifecycleRecord,
		event: TaskLifecycleEvent,
	): Promise<LifecyclePersistenceCommitResult>
	listAttachedChildren(parent: TaskParentLink): Promise<TaskLifecycleRecord[]>
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T
}

function withSequence(
	record: TaskLifecycleRecord,
	event: TaskLifecycleEvent,
	sequence: number,
): { record: TaskLifecycleRecord; event: TaskLifecycleEvent } {
	const committedRecord = { ...record, monotonicSequence: sequence }
	const committedEvent = {
		...event,
		committed: { ...event.committed, monotonicSequence: sequence },
		monotonicSequence: sequence,
	}
	return { record: committedRecord, event: committedEvent }
}

function attachedParentConstraint(
	record: TaskLifecycleRecord,
	event: TaskLifecycleEvent,
	parent: TaskLifecycleRecord | undefined,
): string | undefined {
	if (record.parent?.governance !== "attached" || event.transition === "register_generation") return undefined
	if (!parent || parent.generationId !== record.parent.generationId) {
		return "The attached child targets a stale or unknown parent generation."
	}
	if (event.cause.source === "parent_lifecycle") {
		if (event.cause.originatingEventId !== parent.lastEventId) {
			return "Parent propagation must name the current committed parent lifecycle event."
		}
		if (event.transition === "request_cancellation") {
			if (parent.cancellation.status !== "requested") {
				return "Parent cancellation propagation requires a committed parent cancellation request."
			}
		} else if (event.transition === "settle_cancellation") {
			if (parent.state !== "terminal" || parent.terminalOutcome !== "cancelled") {
				return "Parent cancellation settlement requires terminal parent cancellation."
			}
		} else if (event.transition === "propagate_parent_termination") {
			if (
				parent.state !== "terminal" ||
				(parent.terminalOutcome !== "failed" && parent.terminalOutcome !== "timed_out") ||
				record.terminalOutcome !== parent.terminalOutcome
			) {
				return "Parent termination propagation must match the committed parent failure or timeout."
			}
		} else {
			return "The parent_lifecycle causal source is valid only for a typed propagation transition."
		}
	}
	if (event.transition === "propagate_parent_termination" && event.cause.source !== "parent_lifecycle") {
		return "Parent termination propagation requires the parent_lifecycle causal source."
	}
	const parentSettlement =
		event.cause.source === "parent_lifecycle" &&
		(event.transition === "propagate_parent_termination" || event.transition === "settle_cancellation")
	if (parent.state === "terminal" && !parentSettlement) {
		return "The attached child cannot transition after its parent generation terminalized."
	}
	if (
		parent.cancellation.status === "requested" &&
		event.transition !== "request_cancellation" &&
		event.transition !== "settle_cancellation"
	) {
		return "The attached child transition is fenced by parent cancellation."
	}
	return undefined
}

export class InMemoryTaskLifecyclePersistence implements TaskLifecyclePersistence {
	private readonly records = new Map<string, TaskLifecycleRecord>()
	private readonly eventsByIntent = new Map<string, TaskLifecycleEvent>()
	private sequence = 0

	async load(taskId: string): Promise<TaskLifecycleRecord | undefined> {
		const record = this.records.get(taskId)
		return record ? clone(record) : undefined
	}

	async loadEvent(eventId: string): Promise<TaskLifecycleEvent | undefined> {
		const event = [...this.eventsByIntent.values()].find((candidate) => candidate.eventId === eventId)
		return event ? clone(event) : undefined
	}

	async commit(
		expectation: LifecycleCommitExpectation,
		record: TaskLifecycleRecord,
		event: TaskLifecycleEvent,
	): Promise<LifecyclePersistenceCommitResult> {
		const duplicate = this.eventsByIntent.get(event.intentId)
		if (duplicate) {
			const existingRecord = this.records.get(duplicate.taskId)
			if (!existingRecord) return { kind: "compare_and_swap_failed" }
			return { kind: "duplicate_intent", record: clone(existingRecord), event: clone(duplicate) }
		}

		const current = this.records.get(record.taskId)
		const matches =
			expectation.absent === true
				? current === undefined
				: current !== undefined &&
					current.generationId === expectation.generationId &&
					current.lifecycleRevision === expectation.lifecycleRevision
		if (!matches) {
			return { kind: "compare_and_swap_failed", current: current ? clone(current) : undefined }
		}
		if (event.transition === "register_generation" && record.parent?.governance === "attached") {
			const parent = this.records.get(record.parent.taskId)
			if (
				!parent ||
				parent.generationId !== record.parent.generationId ||
				parent.state !== "active" ||
				parent.cancellation.status === "requested"
			) {
				return {
					kind: "constraint_failed",
					reason: "An attached child requires the exact active, unfenced parent generation.",
					current: current ? clone(current) : undefined,
				}
			}
		}
		const parentConstraint = attachedParentConstraint(
			record,
			event,
			record.parent ? this.records.get(record.parent.taskId) : undefined,
		)
		if (parentConstraint) {
			return {
				kind: "constraint_failed",
				reason: parentConstraint,
				current: current ? clone(current) : undefined,
			}
		}
		if (event.transition === "settle_completion" && record.parent?.governance === "attached") {
			const parent = this.records.get(record.parent.taskId)
			if (
				!parent ||
				parent.generationId !== record.parent.generationId ||
				parent.state === "terminal" ||
				parent.cancellation.status === "requested"
			) {
				return {
					kind: "constraint_failed",
					reason: "Attached child completion is fenced by its parent lifecycle.",
					current: current ? clone(current) : undefined,
				}
			}
		}
		if (event.transition === "settle_completion" || event.transition === "replace_generation") {
			const governedGeneration =
				event.transition === "replace_generation" ? event.previous?.generationId : record.generationId
			const activeChild = [...this.records.values()].find(
				(candidate) =>
					candidate.parent?.governance === "attached" &&
					candidate.parent.taskId === record.taskId &&
					candidate.parent.generationId === governedGeneration &&
					candidate.state !== "terminal",
			)
			if (activeChild) {
				return {
					kind: "constraint_failed",
					reason: `Attached child '${activeChild.taskId}' must terminalize before parent completion or generation replacement.`,
					current: current ? clone(current) : undefined,
				}
			}
		}

		const committed = withSequence(record, event, ++this.sequence)
		this.records.set(record.taskId, clone(committed.record))
		this.eventsByIntent.set(event.intentId, clone(committed.event))
		return { kind: "committed", record: clone(committed.record), event: clone(committed.event) }
	}

	async listAttachedChildren(parent: TaskParentLink): Promise<TaskLifecycleRecord[]> {
		return [...this.records.values()]
			.filter(
				(record) =>
					record.parent?.governance === "attached" &&
					record.parent.taskId === parent.taskId &&
					record.parent.generationId === parent.generationId,
			)
			.map(clone)
	}
}

interface LifecycleRawDatabase {
	prepare(sql: string): {
		get(...parameters: unknown[]): unknown
		all(...parameters: unknown[]): unknown[]
		run(...parameters: unknown[]): { changes: number }
	}
}

interface LifecycleDatabaseContext {
	db: LifecycleRawDatabase
	transaction<T>(callback: () => T): Promise<T>
}

interface LifecycleRecordRow {
	taskId: string
	generationId: string
	lifecycleRevision: number
	recordJson: string
}

interface LifecycleEventRow {
	eventJson: string
	monotonicSequence?: unknown
	eventId?: unknown
	intentId?: unknown
	taskId?: unknown
	generationId?: unknown
	lifecycleRevision?: unknown
	committedAt?: unknown
}

function parseEventRow(row: unknown): TaskLifecycleEvent {
	if (!row || typeof (row as Partial<LifecycleEventRow>).eventJson !== "string") {
		throw new Error("Malformed task lifecycle event persistence row.")
	}
	const candidate = JSON.parse((row as LifecycleEventRow).eventJson) as unknown
	if (!isTaskLifecycleEvent(candidate)) throw new Error("Task lifecycle event row contains an invalid event payload.")
	const persisted = row as Partial<LifecycleEventRow>
	const fields: readonly [keyof LifecycleEventRow, unknown][] = [
		["eventId", candidate.eventId],
		["intentId", candidate.intentId],
		["taskId", candidate.taskId],
		["generationId", candidate.generationId],
		["lifecycleRevision", candidate.lifecycleRevision],
		["monotonicSequence", candidate.monotonicSequence],
		["committedAt", candidate.committedAt],
	]
	for (const [field, expected] of fields) {
		if (persisted[field] !== undefined && persisted[field] !== expected) {
			throw new Error(`Task lifecycle event row column '${String(field)}' does not match its payload.`)
		}
	}
	return candidate
}

function assertUniqueJournalSequences(events: readonly TaskLifecycleEvent[]): void {
	const sequenceOwners = new Map<number, string>()
	for (const event of events) {
		const previousEventId = sequenceOwners.get(event.monotonicSequence)
		if (previousEventId && previousEventId !== event.eventId) {
			throw new Error(`Task lifecycle event journal has conflicting sequence ${event.monotonicSequence}.`)
		}
		sequenceOwners.set(event.monotonicSequence, event.eventId)
	}
}

function latestJournalEvent(db: LifecycleRawDatabase, taskId: string): TaskLifecycleEvent | undefined {
	const rows = getCachedStatement(
		db,
		`SELECT eventJson, monotonicSequence, eventId, intentId, taskId, generationId, lifecycleRevision, committedAt
			 FROM task_lifecycle_events
			 WHERE taskId = ?`,
	).all(taskId) as LifecycleEventRow[]
	let latest: TaskLifecycleEvent | undefined
	for (const row of rows) {
		const candidate = parseEventRow(row)
		if (candidate.taskId !== taskId) {
			throw new Error(`Task lifecycle event journal contains a malformed event for '${taskId}'.`)
		}
		if (!latest || candidate.monotonicSequence > latest.monotonicSequence) {
			latest = candidate
		} else if (candidate.monotonicSequence === latest.monotonicSequence && candidate.eventId !== latest.eventId) {
			throw new Error(`Task lifecycle event journal has conflicting sequence ${candidate.monotonicSequence}.`)
		}
	}
	return latest
}

function latestJournalRecord(db: LifecycleRawDatabase, taskId: string): TaskLifecycleRecord | undefined {
	const event = latestJournalEvent(db, taskId)
	if (!event) return undefined
	const record = taskLifecycleRecordFromEvent(event)
	if (!record || !isTaskLifecycleEventForRecord(event, record)) {
		throw new Error(`Task lifecycle event '${event.eventId}' cannot reconstruct its committed record.`)
	}
	return record
}

function latestJournalRecords(db: LifecycleRawDatabase): TaskLifecycleRecord[] {
	const rows = getCachedStatement(
		db,
		"SELECT eventJson, monotonicSequence, eventId, intentId, taskId, generationId, lifecycleRevision, committedAt FROM task_lifecycle_events",
	).all() as LifecycleEventRow[]
	const latestByTask = new Map<string, TaskLifecycleEvent>()
	const events: TaskLifecycleEvent[] = []
	for (const row of rows) {
		const candidate = parseEventRow(row)
		events.push(candidate)
		const previous = latestByTask.get(candidate.taskId)
		if (!previous || candidate.monotonicSequence > previous.monotonicSequence) {
			latestByTask.set(candidate.taskId, candidate)
		} else if (candidate.monotonicSequence === previous.monotonicSequence && candidate.eventId !== previous.eventId) {
			throw new Error(`Task lifecycle event journal has conflicting sequence ${candidate.monotonicSequence}.`)
		}
	}
	assertUniqueJournalSequences(events)
	return [...latestByTask.values()].map((event) => {
		const record = taskLifecycleRecordFromEvent(event)
		if (!record || !isTaskLifecycleEventForRecord(event, record)) {
			throw new Error(`Task lifecycle event '${event.eventId}' cannot reconstruct its committed record.`)
		}
		return record
	})
}

function readProjection(
	db: LifecycleRawDatabase,
	taskId: string,
): {
	record?: TaskLifecycleRecord
	rowCount: number
	malformed: boolean
} {
	const rows = getCachedStatement(
		db,
		`SELECT taskId, generationId, lifecycleRevision, recordJson
			 FROM task_lifecycle_records
			 WHERE taskId = ?`,
	).all(taskId)
	let record: TaskLifecycleRecord | undefined
	let malformed = false
	for (const row of rows) {
		try {
			const candidate = parseRecordRow(row)
			if (candidate && (!record || candidate.monotonicSequence > record.monotonicSequence)) record = candidate
		} catch {
			malformed = true
		}
	}
	return { record, rowCount: rows.length, malformed }
}

function readAuthoritativeRecord(db: LifecycleRawDatabase, taskId: string): TaskLifecycleRecord | undefined {
	const projection = readProjection(db, taskId)
	const journalRecord = latestJournalRecord(db, taskId)
	if (!journalRecord) {
		if (projection.rowCount > 0) {
			// With no journal commit marker there is no authoritative state to
			// preserve. Drop both valid and malformed projections so a retry can
			// register the task instead of being permanently fenced by debris.
			getCachedStatement(db, "DELETE FROM task_lifecycle_records WHERE taskId = ?").run(taskId)
		}
		return undefined
	}
	const journalEvent = latestJournalEvent(db, taskId)
	const projectionMatchesJournal =
		!projection.malformed &&
		projection.rowCount === 1 &&
		projection.record !== undefined &&
		isTaskLifecycleEventForRecord(journalEvent, projection.record)
	if (!projectionMatchesJournal) persistRecordProjection(db, journalRecord)
	return journalRecord
}

function persistRecordProjection(db: LifecycleRawDatabase, record: TaskLifecycleRecord): void {
	getCachedStatement(db, "DELETE FROM task_lifecycle_records WHERE taskId = ?").run(record.taskId)
	const inserted = getCachedStatement(
		db,
		`INSERT INTO task_lifecycle_records
			(taskId, generationId, lifecycleRevision, recordJson, updatedAt)
		 VALUES (?, ?, ?, ?, ?)`,
	).run(record.taskId, record.generationId, record.lifecycleRevision, JSON.stringify(record), record.committedAt)
	if (inserted.changes !== 1) throw new Error(`Task lifecycle projection for '${record.taskId}' could not be repaired.`)
}

function parseRecordRow(row: unknown): TaskLifecycleRecord | undefined {
	if (!row) return undefined
	const candidate = row as Partial<LifecycleRecordRow>
	if (
		typeof candidate.taskId !== "string" ||
		typeof candidate.generationId !== "string" ||
		!Number.isInteger(candidate.lifecycleRevision) ||
		typeof candidate.recordJson !== "string"
	) {
		throw new Error("Malformed task lifecycle persistence row.")
	}
	const record = JSON.parse(candidate.recordJson) as unknown
	if (
		!isTaskLifecycleRecord(record) ||
		record.taskId !== candidate.taskId ||
		record.generationId !== candidate.generationId ||
		record.lifecycleRevision !== candidate.lifecycleRevision
	) {
		throw new Error("Task lifecycle persistence row does not match its record payload.")
	}
	return record
}

export class BroccoliTaskLifecyclePersistence implements TaskLifecyclePersistence {
	private async database(): Promise<LifecycleDatabaseContext> {
		const database = await getCoordinationDb()
		const db = database.prepare() as LifecycleRawDatabase
		return {
			db,
			transaction: (callback) => database.transaction().execute(callback),
		}
	}

	async load(taskId: string): Promise<TaskLifecycleRecord | undefined> {
		const { db, transaction } = await this.database()
		return this.readOrRepairAuthoritativeRecord(db, taskId, transaction)
	}

	async loadEvent(eventId: string): Promise<TaskLifecycleEvent | undefined> {
		const { db, transaction } = await this.database()
		return transaction(() => {
			const row = getCachedStatement(
				db,
				`SELECT eventJson, monotonicSequence, eventId, intentId, taskId, generationId, lifecycleRevision, committedAt
					 FROM task_lifecycle_events
					 WHERE eventId = ?`,
			).get(eventId) as LifecycleEventRow | undefined
			if (!row) return undefined
			const event = parseEventRow(row)
			if (event.eventId !== eventId) {
				throw new Error("Task lifecycle event row is malformed or does not match its event payload.")
			}
			return event
		})
	}

	private async readOrRepairAuthoritativeRecord(
		db: LifecycleRawDatabase,
		taskId: string,
		transaction: LifecycleDatabaseContext["transaction"],
	): Promise<TaskLifecycleRecord | undefined> {
		return transaction(() => {
			// The event journal is the commit marker. Read both sides under the
			// kernel mutex so cleanup cannot race a concurrent commit and delete a
			// newly written projection.
			const projection = readProjection(db, taskId)
			const journalEvent = latestJournalEvent(db, taskId)
			const journalRecord = journalEvent ? taskLifecycleRecordFromEvent(journalEvent) : undefined
			if (journalEvent && (!journalRecord || !isTaskLifecycleEventForRecord(journalEvent, journalRecord))) {
				throw new Error(`Task lifecycle event '${journalEvent.eventId}' cannot reconstruct its committed record.`)
			}

			if (!journalRecord) {
				if (projection.rowCount > 0) {
					// A projection without its event is an interrupted write and must not
					// fence a retry, even when the projection payload itself is malformed.
					getCachedStatement(db, "DELETE FROM task_lifecycle_records WHERE taskId = ?").run(taskId)
				}
				return undefined
			}

			const projectionMatchesJournal =
				!projection.malformed &&
				projection.rowCount === 1 &&
				projection.record !== undefined &&
				isTaskLifecycleEventForRecord(journalEvent, projection.record)
			if (!projectionMatchesJournal) persistRecordProjection(db, journalRecord)
			return journalRecord
		})
	}

	async commit(
		expectation: LifecycleCommitExpectation,
		record: TaskLifecycleRecord,
		event: TaskLifecycleEvent,
	): Promise<LifecyclePersistenceCommitResult> {
		const { db, transaction } = await this.database()
		return transaction(() => {
			const duplicateRow = getCachedStatement(
				db,
				`SELECT eventJson, monotonicSequence, eventId, intentId, taskId, generationId, lifecycleRevision, committedAt
					 FROM task_lifecycle_events
					 WHERE intentId = ?`,
			).get(event.intentId) as LifecycleEventRow | undefined
			if (duplicateRow) {
				const duplicateEvent = parseEventRow(duplicateRow)
				const current = readAuthoritativeRecord(db, duplicateEvent.taskId)
				if (!current) return { kind: "compare_and_swap_failed" }
				return { kind: "duplicate_intent", record: current, event: duplicateEvent }
			}

			const current = readAuthoritativeRecord(db, record.taskId)
			const matches =
				expectation.absent === true
					? current === undefined
					: current !== undefined &&
						current.generationId === expectation.generationId &&
						current.lifecycleRevision === expectation.lifecycleRevision
			if (!matches) {
				return { kind: "compare_and_swap_failed", current }
			}
			if (event.transition === "register_generation" && record.parent?.governance === "attached") {
				const parent = readAuthoritativeRecord(db, record.parent.taskId)
				if (
					!parent ||
					parent.generationId !== record.parent.generationId ||
					parent.state !== "active" ||
					parent.cancellation.status === "requested"
				) {
					return {
						kind: "constraint_failed",
						reason: "An attached child requires the exact active, unfenced parent generation.",
						current,
					}
				}
			}
			const attachedParent =
				record.parent?.governance === "attached" ? readAuthoritativeRecord(db, record.parent.taskId) : undefined
			const parentConstraint = attachedParentConstraint(record, event, attachedParent)
			if (parentConstraint) {
				return { kind: "constraint_failed", reason: parentConstraint, current }
			}
			if (event.transition === "settle_completion" && record.parent?.governance === "attached") {
				const parent = readAuthoritativeRecord(db, record.parent.taskId)
				if (
					!parent ||
					parent.generationId !== record.parent.generationId ||
					parent.state === "terminal" ||
					parent.cancellation.status === "requested"
				) {
					return {
						kind: "constraint_failed",
						reason: "Attached child completion is fenced by its parent lifecycle.",
						current,
					}
				}
			}
			if (event.transition === "settle_completion" || event.transition === "replace_generation") {
				const governedGeneration =
					event.transition === "replace_generation" ? event.previous?.generationId : record.generationId
				const activeChild = latestJournalRecords(db).find(
					(candidate) =>
						candidate.parent?.governance === "attached" &&
						candidate.parent.taskId === record.taskId &&
						candidate.parent.generationId === governedGeneration &&
						candidate.state !== "terminal",
				)
				if (activeChild) {
					return {
						kind: "constraint_failed",
						reason: `Attached child '${activeChild.taskId}' must terminalize before parent completion or generation replacement.`,
						current,
					}
				}
			}

			// Treat the event journal as the high-water mark. Reconcile every commit,
			// since older or interrupted writes can leave the singleton counter absent
			// or behind the durable event history.
			const persistedEvents = getCachedStatement(
				db,
				"SELECT eventJson, monotonicSequence, eventId, intentId, taskId, generationId, lifecycleRevision, committedAt FROM task_lifecycle_events",
			)
				.all()
				.map((row) => parseEventRow(row))
			assertUniqueJournalSequences(persistedEvents)
			const persistedSequences = persistedEvents.map((event) => event.monotonicSequence)
			const validPersistedSequences = persistedSequences.map((value) => {
				if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
					throw new Error("Task lifecycle event journal contains an invalid sequence number.")
				}
				return value
			})
			const highestPersistedSequence = validPersistedSequences.reduce((highest, value) => Math.max(highest, value), 0)
			let sequenceRow = getCachedStatement(db, "SELECT value FROM task_lifecycle_sequence WHERE id = 1").get() as
				| { value: number }
				| undefined
			if (!sequenceRow) {
				getCachedStatement(db, "INSERT OR IGNORE INTO task_lifecycle_sequence (id, value) VALUES (1, ?)").run(
					highestPersistedSequence,
				)
				sequenceRow = getCachedStatement(db, "SELECT value FROM task_lifecycle_sequence WHERE id = 1").get() as
					| { value: number }
					| undefined
			}
			if (!sequenceRow) throw new Error("Task lifecycle sequence row could not be initialized.")
			if (!Number.isSafeInteger(sequenceRow.value) || sequenceRow.value < 0) {
				throw new Error("Task lifecycle sequence counter is malformed.")
			}
			if (sequenceRow.value < highestPersistedSequence) {
				const reconciled = getCachedStatement(db, "UPDATE task_lifecycle_sequence SET value = ? WHERE id = 1").run(
					highestPersistedSequence,
				)
				if (reconciled.changes !== 1) throw new Error("Task lifecycle sequence counter could not be reconciled.")
				sequenceRow = getCachedStatement(db, "SELECT value FROM task_lifecycle_sequence WHERE id = 1").get() as
					| { value: number }
					| undefined
			}
			if (!sequenceRow) throw new Error("Task lifecycle sequence could not be initialized.")

			const sequenceUpdate = getCachedStatement(
				db,
				"UPDATE task_lifecycle_sequence SET value = value + 1 WHERE id = 1",
			).run()
			if (sequenceUpdate.changes !== 1) {
				throw new Error("Task lifecycle sequence counter could not be initialized.")
			}
			sequenceRow = getCachedStatement(db, "SELECT value FROM task_lifecycle_sequence WHERE id = 1").get() as
				| { value: number }
				| undefined
			if (!sequenceRow || !Number.isSafeInteger(sequenceRow.value) || sequenceRow.value <= highestPersistedSequence) {
				throw new Error("Task lifecycle sequence is unavailable.")
			}
			const committed = withSequence(record, event, sequenceRow.value)
			const recordJson = JSON.stringify(committed.record)
			const eventJson = JSON.stringify(committed.event)

			if (current) {
				const updated = getCachedStatement(
					db,
					`UPDATE task_lifecycle_records
						 SET generationId = ?, lifecycleRevision = ?, recordJson = ?, updatedAt = ?
						 WHERE taskId = ? AND generationId = ? AND lifecycleRevision = ?`,
				).run(
					committed.record.generationId,
					committed.record.lifecycleRevision,
					recordJson,
					committed.record.committedAt,
					committed.record.taskId,
					expectation.generationId,
					expectation.lifecycleRevision,
				)
				if (updated.changes !== 1) {
					return { kind: "compare_and_swap_failed", current }
				}
			} else {
				const inserted = getCachedStatement(
					db,
					`INSERT INTO task_lifecycle_records
							(taskId, generationId, lifecycleRevision, recordJson, updatedAt)
						 VALUES (?, ?, ?, ?, ?)`,
				).run(
					committed.record.taskId,
					committed.record.generationId,
					committed.record.lifecycleRevision,
					recordJson,
					committed.record.committedAt,
				)
				if (inserted.changes !== 1) {
					return { kind: "compare_and_swap_failed" }
				}
			}

			const eventInsert = getCachedStatement(
				db,
				`INSERT INTO task_lifecycle_events
					(monotonicSequence, eventId, intentId, taskId, generationId, lifecycleRevision, eventJson, committedAt)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			).run(
				committed.event.monotonicSequence,
				committed.event.eventId,
				committed.event.intentId,
				committed.event.taskId,
				committed.event.generationId,
				committed.event.lifecycleRevision,
				eventJson,
				committed.event.committedAt,
			)
			if (eventInsert.changes !== 1) throw new Error("Task lifecycle commit event could not be written.")
			return { kind: "committed", record: committed.record, event: committed.event }
		})
	}

	async listAttachedChildren(parent: TaskParentLink): Promise<TaskLifecycleRecord[]> {
		const { db, transaction } = await this.database()
		return transaction(() =>
			latestJournalRecords(db).filter(
				(record) =>
					record.parent?.governance === "attached" &&
					record.parent.taskId === parent.taskId &&
					record.parent.generationId === parent.generationId,
			),
		)
	}
}
