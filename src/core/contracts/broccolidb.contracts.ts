/**
 * broccolidb.contracts.ts
 *
 * Core data contracts for the Deterministic Hybrid In-Memory + Handrolled BroccoliDB Kernel
 * (Phase 71 / ADR-120, Phase 72 / ADR-121 & Phase 73 / ADR-122).
 *
 * Establishes the typed interfaces for L1 Reactive Tables (Multi-Modal Indexing,
 * Rich Operators, Reactive CDC Subscriptions, Relational Joins, Aggregation Pipeline,
 * Git-for-Data Table Branching, Undo/Redo, TTL Expiration, and Human-Centric Views),
 * L2 Append-Only Write-Ahead Log (WAL), L3 Sharded Content-Addressable Storage (CAS),
 * L4 Double-Buffered Checkpointing, and the Unified 4-Pillar Forensic Diagnostic Probe.
 */

export type DbDurabilityMode = "SYNCHRONOUS" | "MICRO_BATCHED" | "SPECULATIVE";

export type WalOperationType = "INSERT" | "UPDATE" | "DELETE" | "CLEAR" | "CHECKPOINT" | "ROLLBACK" | "BRANCH_MERGE";

export interface WalFrame {
  readonly frameId: number;
  readonly timestamp: number;
  readonly op: WalOperationType;
  readonly table: string;
  readonly recordId: string;
  readonly payload?: Record<string, unknown>;
  readonly checksum: string; // SHA-256 integrity hash
  readonly previousFrameHash?: string; // Cryptographic chaining
}

// -------------------------------------------------------------
// Rich Query DSL & Operator Filters
// -------------------------------------------------------------

export type DbOperator =
  | "$eq"
  | "$ne"
  | "$gt"
  | "$gte"
  | "$lt"
  | "$lte"
  | "$in"
  | "$nin"
  | "$between"
  | "$startsWith"
  | "$endsWith"
  | "$contains"
  | "$regex"
  | "$exists";

export interface DbFieldFilter {
  readonly $eq?: unknown;
  readonly $ne?: unknown;
  readonly $gt?: number | string | Date;
  readonly $gte?: number | string | Date;
  readonly $lt?: number | string | Date;
  readonly $lte?: number | string | Date;
  readonly $in?: readonly unknown[];
  readonly $nin?: readonly unknown[];
  readonly $between?: readonly [number | string | Date, number | string | Date];
  readonly $startsWith?: string;
  readonly $endsWith?: string;
  readonly $contains?: string;
  readonly $regex?: string | RegExp;
  readonly $exists?: boolean;
}

export type DbWhereValue = unknown | DbFieldFilter;

export interface DbQueryOptions {
  readonly where?: Record<string, DbWhereValue>;
  readonly and?: readonly Record<string, DbWhereValue>[];
  readonly or?: readonly Record<string, DbWhereValue>[];
  readonly not?: Record<string, DbWhereValue>;
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: string | readonly string[];
  readonly sortOrder?: "asc" | "desc" | readonly ("asc" | "desc")[];
}

// -------------------------------------------------------------
// Index Definitions & Types
// -------------------------------------------------------------

export type IndexType = "equality" | "sorted" | "composite" | "prefix";

export interface IndexDefinition {
  readonly name: string;
  readonly type: IndexType;
  readonly fields: readonly string[];
  readonly cardinality: number;
  readonly isUnique?: boolean;
}

// -------------------------------------------------------------
// Mutation Options & TTL Expiration
// -------------------------------------------------------------

export interface DbPutOptions {
  readonly ttlMs?: number;
  readonly idempotencyKey?: string;
}

// -------------------------------------------------------------
// Relational Joins & Foreign Keys
// -------------------------------------------------------------

export type DbRelationType = "belongsTo" | "hasMany" | "hasOne";
export type ReferentialAction = "CASCADE" | "SET_NULL" | "RESTRICT";

export interface DbRelationDefinition {
  readonly name: string;
  readonly type: DbRelationType;
  readonly targetTable: string;
  readonly foreignKey: string;
  readonly targetKey: string;
  readonly onDelete?: ReferentialAction;
}

export interface DbJoinOptions {
  readonly relation: string;
  readonly where?: Record<string, DbWhereValue>;
  readonly select?: readonly string[];
}

export interface DbJoinedRecord<
  T extends Record<string, unknown> = Record<string, unknown>,
  R extends Record<string, unknown> = Record<string, unknown>
> {
  readonly record: T;
  readonly relations: Record<string, R | readonly R[] | null>;
}

// -------------------------------------------------------------
// Multi-Dimensional Aggregation Pipeline
// -------------------------------------------------------------

export type DbAggregateMetric = "sum" | "avg" | "min" | "max" | "count" | "stddev";

export interface DbAggregateQuery {
  readonly groupBy?: readonly string[];
  readonly metrics: Record<string, { readonly metric: DbAggregateMetric; readonly field?: string }>;
  readonly where?: Record<string, DbWhereValue>;
  readonly having?: Record<string, DbWhereValue>;
  readonly limit?: number;
}

export interface DbGroupResult {
  readonly keys: Record<string, unknown>;
  readonly metrics: Record<string, number>;
  readonly recordCount: number;
}

export interface DbAggregateResult {
  readonly table: string;
  readonly totalRecordsEvaluated: number;
  readonly groups: readonly DbGroupResult[];
  readonly grandTotals: Record<string, number>;
  readonly executionTimeMicros: number;
}

// -------------------------------------------------------------
// Git-for-Data Table Branching & Undo/Redo
// -------------------------------------------------------------

export interface DbTableBranch {
  readonly branchName: string;
  readonly baseSnapshotHash: string;
  readonly createdAt: number;
  readonly recordCount: number;
  readonly isHead: boolean;
}

export interface DbMergeConflict<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly recordId: string;
  readonly mainValue?: T;
  readonly branchValue?: T;
  readonly conflictReason: string;
}

export type MergeResolutionStrategy = "LAST_WRITE_WINS" | "FAIL_ON_CONFLICT" | "TAKE_BRANCH" | "TAKE_MAIN";

export interface DbMergeResult<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly success: boolean;
  readonly branchName: string;
  readonly mergedRecordsCount: number;
  readonly conflictsDetected: number;
  readonly conflicts: readonly DbMergeConflict<T>[];
  readonly resolutionStrategy: MergeResolutionStrategy;
}

export interface UndoRedoState {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoStackDepth: number;
  readonly redoStackDepth: number;
}

// -------------------------------------------------------------
// Declarative Schema Evolution & Migrations
// -------------------------------------------------------------

export type TableMigrationFn<
  TOld extends Record<string, unknown> = Record<string, unknown>,
  TNew extends Record<string, unknown> = Record<string, unknown>
> = (oldRecord: TOld) => TNew;

export interface TableSchemaVersionDefinition<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly version: number;
  readonly fields: Record<
    string,
    {
      readonly type: "string" | "number" | "boolean" | "array" | "object" | "date";
      readonly required?: boolean;
      readonly default?: unknown;
    }
  >;
  readonly migrations?: Record<number, TableMigrationFn>;
}

export interface SchemaValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly coercedRecord?: Record<string, unknown>;
}

// -------------------------------------------------------------
// Human-Centric Visual Views
// -------------------------------------------------------------

export interface SpreadsheetViewOptions {
  readonly columns?: readonly string[];
  readonly maxColumnWidth?: number;
  readonly limit?: number;
  readonly includeStatsFooter?: boolean;
}

export interface KanbanViewOptions {
  readonly groupByColumn: string;
  readonly titleColumn?: string;
  readonly cardLimitPerLane?: number;
}

export interface TableDiffViewResult {
  readonly table: string;
  readonly addedCount: number;
  readonly modifiedCount: number;
  readonly deletedCount: number;
  readonly formattedDiff: string;
}

// -------------------------------------------------------------
// Reactive Change Data Capture (CDC) & Observables
// -------------------------------------------------------------

export type TableChangeOperation = "INSERT" | "UPDATE" | "DELETE" | "CLEAR" | "EXPIRE";

export interface TableChangeEvent<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly operation: TableChangeOperation;
  readonly table: string;
  readonly recordId: string;
  readonly before?: T;
  readonly after?: T;
  readonly diff?: Record<string, { readonly old?: unknown; readonly new?: unknown }>;
  readonly timestamp: number;
}

export type TableChangeCallback<T extends Record<string, unknown> = Record<string, unknown>> = (
  event: TableChangeEvent<T>
) => void;

export interface TableChangeSubscription {
  readonly subscriptionId: string;
  unsubscribe(): void;
}

// -------------------------------------------------------------
// Atomic Transaction & Batch Mutation Units of Work
// -------------------------------------------------------------

export interface ITableTransaction<T extends Record<string, unknown> = Record<string, unknown>> {
  get(id: string): T | undefined;
  put(id: string, record: T, options?: DbPutOptions): T;
  delete(id: string): boolean;
  query(options?: DbQueryOptions): readonly T[];
}

// -------------------------------------------------------------
// Table Introspection, Schema Description & Statistics
// -------------------------------------------------------------

export interface ColumnStatistics {
  readonly columnName: string;
  readonly inferredType: "string" | "number" | "boolean" | "object" | "array" | "null" | "mixed";
  readonly nonNullCount: number;
  readonly nullCount: number;
  readonly uniqueCount: number;
  readonly minValue?: unknown;
  readonly maxValue?: unknown;
  readonly average?: number;
}

export interface TableSchemaDescription {
  readonly name: string;
  readonly totalRecords: number;
  readonly columns: readonly string[];
  readonly indices: readonly IndexDefinition[];
  readonly computedColumns: readonly string[];
  readonly relations: readonly DbRelationDefinition[];
  readonly branches: readonly string[];
  readonly currentBranch: string;
  readonly schemaVersion: number;
  readonly memoryFootprintBytes: number;
  readonly lastModifiedTimestamp: number;
}

export interface QueryExecutionPlan {
  readonly table: string;
  readonly matchedIndex?: string;
  readonly indexType?: IndexType;
  readonly scanStrategy: "INDEX_LOOKUP" | "INDEX_RANGE_SCAN" | "PREFIX_SCAN" | "FULL_TABLE_SCAN";
  readonly candidatesScanned: number;
  readonly recordsMatched: number;
  readonly executionTimeMicros: number;
  readonly query: DbQueryOptions;
}

// -------------------------------------------------------------
// Natural Query Expression & Parsed AST
// -------------------------------------------------------------

export interface NaturalQueryParsed {
  readonly rawText: string;
  readonly targetTable: string;
  readonly queryOptions: DbQueryOptions;
  readonly confidence: number;
  readonly tokensMatched: readonly string[];
}

// -------------------------------------------------------------
// Fluent Query Builder Contract
// -------------------------------------------------------------

export interface IFluentQueryBuilder<T extends Record<string, unknown> = Record<string, unknown>> {
  where(field: keyof T & string): IFluentFieldPredicate<T>;
  and(field: keyof T & string): IFluentFieldPredicate<T>;
  or(clause: (builder: IFluentQueryBuilder<T>) => void): IFluentQueryBuilder<T>;
  orderBy(field: keyof T & string, direction?: "asc" | "desc"): IFluentQueryBuilder<T>;
  limit(count: number): IFluentQueryBuilder<T>;
  offset(count: number): IFluentQueryBuilder<T>;
  execute(): readonly T[];
  explain(): QueryExecutionPlan;
  first(): T | undefined;
  count(): number;
}

export interface IFluentFieldPredicate<T extends Record<string, unknown> = Record<string, unknown>> {
  equals(value: unknown): IFluentQueryBuilder<T>;
  notEquals(value: unknown): IFluentQueryBuilder<T>;
  greaterThan(value: number | string | Date): IFluentQueryBuilder<T>;
  greaterThanOrEqual(value: number | string | Date): IFluentQueryBuilder<T>;
  lessThan(value: number | string | Date): IFluentQueryBuilder<T>;
  lessThanOrEqual(value: number | string | Date): IFluentQueryBuilder<T>;
  in(values: readonly unknown[]): IFluentQueryBuilder<T>;
  notIn(values: readonly unknown[]): IFluentQueryBuilder<T>;
  between(min: number | string | Date, max: number | string | Date): IFluentQueryBuilder<T>;
  startsWith(prefix: string): IFluentQueryBuilder<T>;
  contains(substring: string): IFluentQueryBuilder<T>;
  matches(regex: string | RegExp): IFluentQueryBuilder<T>;
}

// -------------------------------------------------------------
// Master Table Interface
// -------------------------------------------------------------

export interface IDbTable<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly name: string;
  readonly currentBranch: string;
  get(id: string): T | undefined;
  getAll(): readonly T[];
  put(id: string, record: T, options?: DbPutOptions): T;
  delete(id: string): boolean;
  query(options?: DbQueryOptions): readonly T[];
  createIndex(field: keyof T & string): void;
  createSortedIndex(field: keyof T & string): void;
  createCompositeIndex(fields: readonly (keyof T & string)[]): void;
  createPrefixIndex(field: keyof T & string): void;
  
  // Relations & Joins
  defineRelation(relation: DbRelationDefinition): void;
  join(options: DbJoinOptions): readonly DbJoinedRecord<T>[];

  // Aggregation Pipeline
  aggregate(query: DbAggregateQuery): DbAggregateResult;

  // Git-for-Data Branching & Time-Travel
  forkBranch(branchName: string): boolean;
  checkoutBranch(branchName: string): boolean;
  listBranches(): readonly DbTableBranch[];
  mergeBranch(branchName: string, strategy?: MergeResolutionStrategy): DbMergeResult<T>;
  undo(): boolean;
  redo(): boolean;
  getUndoRedoState(): UndoRedoState;

  // Schema & Migrations
  setSchema(schema: TableSchemaVersionDefinition<T>): void;
  validateRecord(record: T): SchemaValidationResult;

  // Visual View Renderers
  renderSpreadsheet(options?: SpreadsheetViewOptions): string;
  renderKanban(options: KanbanViewOptions): string;
  renderDiff(otherSnapshot: Map<string, T>): TableDiffViewResult;

  // Query & Subscriptions
  select(): IFluentQueryBuilder<T>;
  subscribe(callback: TableChangeCallback<T>, filter?: (record: T) => boolean): TableChangeSubscription;
  transaction<R>(fn: (tx: ITableTransaction<T>) => R): R;
  bulkPut(records: readonly { readonly id: string; readonly record: T; readonly options?: DbPutOptions }[]): readonly T[];
  bulkDelete(ids: readonly string[]): number;
  addComputedColumn(name: string, computeFn: (record: T) => unknown): void;
  describe(): TableSchemaDescription;
  columnStats(columnName: keyof T & string): ColumnStatistics;
  explain(options?: DbQueryOptions): QueryExecutionPlan;
  count(): number;
  clear(): void;
  createSnapshot(): Map<string, T>;
  restoreSnapshot(snapshot: Map<string, T>): void;
}

export interface CasBlobDescriptor {
  readonly hash: string;
  readonly sizeBytes: number;
  readonly compressedSizeBytes: number;
  readonly isCompressed: boolean;
  readonly createdAt: number;
  readonly shard: string;
}

export interface CasStorageStats {
  readonly totalBlobs: number;
  readonly totalRawBytes: number;
  readonly totalStoredBytes: number;
  readonly compressionSavingsPct: number;
  readonly corruptCount: number;
  readonly quarantinedBlobs: readonly string[];
}

export interface TimelineCheckpointRecord {
  readonly checkpointId: string;
  readonly timestamp: number;
  readonly frameIndex: number;
  readonly label: string;
  readonly tableCount: number;
  readonly totalRecords: number;
  readonly snapshotHash: string;
}

export interface DbHealthReport {
  readonly status: "HEALTHY" | "DEGRADED" | "CORRUPTED";
  readonly timestamp: number;
  readonly pillars: {
    readonly diskInvariants: {
      readonly valid: boolean;
      readonly baseDir: string;
      readonly diskUsageBytes: number;
      readonly writeable: boolean;
    };
    readonly casIntegrity: {
      readonly totalBlobs: number;
      readonly corruptCount: number;
      readonly compressionSavingsPct: number;
      readonly healthy: boolean;
    };
    readonly walJournal: {
      readonly totalFrames: number;
      readonly uncommittedFrames: number;
      readonly lastSyncTimestamp: number;
      readonly healthy: boolean;
    };
    readonly tableConsistency: {
      readonly tableCount: number;
      readonly totalRecords: number;
      readonly indexParity: boolean;
      readonly healthy: boolean;
    };
  };
  readonly actionableRecommendations: readonly string[];
}

export interface IBroccoliDatabaseKernel {
  readonly workspaceRoot: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  flush(): Promise<void>;
  getTable<T extends Record<string, unknown> = Record<string, unknown>>(name: string): IDbTable<T>;
  transaction<R>(fn: () => Promise<R>): Promise<R>;
  checkpoint(label?: string): Promise<TimelineCheckpointRecord>;
  rollback(checkpointId: string): Promise<boolean>;
  listCheckpoints(): readonly TimelineCheckpointRecord[];
  health(): Promise<DbHealthReport>;
  storeBlob(content: Buffer | string): Promise<string>;
  readBlob(hash: string): Promise<Buffer | null>;
  gc(): Promise<number>;
}
