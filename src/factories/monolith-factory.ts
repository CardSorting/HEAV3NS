import { AgentConfig } from "../agents/base/agent-config.js";
import { AgentEngine } from "../agents/extensions/execution/agent-engine.js";
import { PromptComposer } from "../agents/extensions/compaction/prompt-composer.js";
import { ModelResolver } from "../agents/extensions/resolution/model-resolver.js";
import { AgentSlashRouter } from "../agents/extensions/resolution/agent-slash-router.js";
import { MentionResolver } from "../agents/extensions/mentions/mention-resolver.js";
import { AgentSwarmDispatcher } from "../agents/extensions/swarm/agent-swarm-dispatcher.js";
import { WorkspaceIntelligenceEngine } from "../agents/extensions/intelligence/workspace-intelligence.js";
import { KnowledgeGraphSubstrate } from "../agents/extensions/intelligence/knowledge-graph-substrate.js";
import { ModelCatalog } from "../agents/extensions/resolution/model-catalog.js";
import { InteractiveModeController } from "../agents/extensions/execution/interactive-mode-controller.js";
import { EnvironmentKeyResolver } from "../agents/extensions/resolution/environment-key-resolver.js";
import { ImageModelRegistry } from "../agents/extensions/resolution/image-model-registry.js";
import { LlmProxyGateway } from "../agents/extensions/resolution/llm-proxy-gateway.js";
import { ReasoningEffortController } from "../agents/extensions/resolution/reasoning-effort-controller.js";
import { DynamicModelCache } from "../agents/extensions/resolution/dynamic-model-cache.js";
import { LoopPhaseController } from "../agents/extensions/execution/loop-phase-controller.js";
import { ContextBudgetCalculator } from "../agents/extensions/compaction/context-budget-calculator.js";
import { TokenTruncator } from "../agents/extensions/compaction/token-truncator.js";
import { PromptTemplateEngine } from "../agents/extensions/compaction/prompt-template-engine.js";
import { DynamicVariableInjector } from "../agents/extensions/compaction/dynamic-variable-injector.js";
import { AgentLoopHarness } from "../agents/extensions/execution/agent-loop-harness.js";
import { ProviderAttributionComposer } from "../agents/extensions/resolution/provider-attribution.js";
import { HttpDispatcherOverlay } from "../agents/extensions/resolution/http-dispatcher.js";
import { AuthStorageVault } from "../agents/extensions/resolution/auth-storage-vault.js";
import { CodexOAuthManager } from "../agents/extensions/resolution/codex-oauth-manager.js";
import { CodexProviderBridge } from "../agents/extensions/resolution/codex-provider-bridge.js";
import { SetupWizard } from "../agents/extensions/setup/setup-wizard.js";

import { SessionContext } from "../sessions/base/session-context.js";
import { PersistentSessionStore } from "../sessions/extensions/persistence/session-store.js";
import { SessionCompactor } from "../sessions/extensions/compaction/session-compactor.js";
import { SessionVfs } from "../sessions/extensions/vfs/session-vfs.js";
import { SessionMemoryStore } from "../sessions/extensions/memory/session-memory-store.js";
import { ContextStalenessTracker, CognitiveFreshnessGuard } from "../sessions/extensions/memory/context-staleness-tracker.js";
import { StabilityDoctor } from "../sessions/extensions/integrity/stability-doctor.js";
import { PostmortemDiagnostic } from "../sessions/extensions/integrity/postmortem-diagnostic.js";
import { SystemHealthAggregator } from "../sessions/extensions/integrity/system-health-aggregator.js";
import { SnapcompactEngine } from "../sessions/extensions/compaction/snapcompact-engine.js";
import { FileLockManager, LruCache } from "../sessions/extensions/substrate/file-lock.js";
import { GatewaySessionRegistry } from "../sessions/extensions/persistence/gateway-session-registry.js";
import { SnapshotStorageIndex } from "../sessions/extensions/persistence/snapshot-storage-index.js";
import { SnowflakeIdGenerator } from "../sessions/extensions/substrate/snowflake-id-generator.js";
import { SystemDirectoryResolver } from "../sessions/extensions/substrate/system-directory-resolver.js";
import { FixedRingBuffer } from "../sessions/extensions/substrate/ring-buffer.js";
import { SemanticVersionComparator } from "../sessions/extensions/integrity/semantic-version-comparator.js";
import { GitIgnoreFilter } from "../sessions/extensions/vfs/git-ignore-filter.js";
import { WorkspaceTreeWalker } from "../sessions/extensions/vfs/workspace-tree-walker.js";
import { LockAuthorityEngine } from "../sessions/extensions/substrate/lock-authority.js";
import { NativeMutationTransactionSubstrate } from "../sessions/extensions/substrate/native-mutation-substrate.js";
import { WriteCoalescerSubstrate } from "../sessions/extensions/substrate/write-coalescer.js";
import { BroccoliSubstrateStore } from "../sessions/extensions/substrate/broccoli-substrate-store.js";
import { BroccoliCasCompactor } from "../sessions/extensions/compaction/broccolidb-cas-compactor.js";
import { ConvergenceEngineSubstrate } from "../agents/extensions/swarm/convergence-engine.js";
import { BroccoliTaskDagScheduler } from "../agents/extensions/swarm/broccoli-task-dag-scheduler.js";
import { BroccoliSpiderAuditEngine } from "../agents/extensions/intelligence/broccolidb-spider-audit.js";
import { BroccoliEpistemicReasoningEngine } from "../agents/extensions/intelligence/broccolidb-epistemic-reasoning.js";
import { BroccoliBlastRadiusCalculator } from "../agents/extensions/intelligence/broccolidb-blast-radius.js";
import { BroccoliCognitiveSuggestionEngine } from "../agents/extensions/intelligence/broccolidb-cognitive-suggestion.js";
import { BroccoliVerificationPipeline } from "../agents/extensions/intelligence/broccolidb-verification-pipeline.js";
import { BroccoliRepairMutationExecutor } from "../agents/extensions/execution/broccolidb-repair-executor.js";
import { BroccoliSystemInvariantEngine } from "../sessions/extensions/integrity/broccolidb-system-invariant.js";
import { BroccoliTaskStateEngine } from "../sessions/extensions/persistence/broccolidb-task-state.js";
import { BroccoliFencingMutexEngine } from "../sessions/extensions/substrate/broccolidb-fencing-mutex.js";
import { BroccoliRollbackCoordinator } from "../sessions/extensions/substrate/broccolidb-rollback-coordinator.js";
import { BroccoliInterAgentMailbox } from "../agents/extensions/swarm/broccolidb-inter-agent-mailbox.js";
import { BroccoliApprovalPolicyEngine } from "../tooling/extensions/permissions/broccolidb-approval-policy.js";
import { BroccoliMutationPlanner } from "../agents/extensions/execution/broccolidb-mutation-planner.js";
import { BroccoliExecutionTraceRecorder } from "../tooling/extensions/telemetry/broccolidb-execution-trace.js";
import { BroccoliIntentTracer } from "../agents/extensions/intelligence/broccolidb-intent-tracer.js";
import { BroccoliCASScratchpadService } from "../sessions/extensions/persistence/broccolidb-cas-scratchpad.js";
import { BroccoliContextDiagnosisService } from "../sessions/extensions/integrity/broccolidb-context-diagnosis.js";
import { BroccoliRetentionCleanupService } from "../sessions/extensions/integrity/broccolidb-retention-cleanup.js";
import { BroccoliTaskCoordinator } from "../agents/extensions/swarm/broccolidb-task-coordinator.js";
import { BroccoliSideQueryService } from "../agents/extensions/execution/broccolidb-side-query.js";
import { BroccoliTokenEstimator } from "../tooling/extensions/policy/broccolidb-token-estimator.js";
import { BroccoliQueryLoopOrchestrator } from "../agents/extensions/execution/broccolidb-query-loop.js";
import { BroccoliStructuralDiscoveryService } from "../tooling/extensions/perception/broccolidb-structural-discovery.js";
import { BroccoliAxiomVerifier } from "../tooling/extensions/permissions/broccolidb-axiom-verifier.js";
import { BroccoliPlanModeEnforcer } from "../agents/extensions/execution/broccolidb-plan-enforcer.js";
import { BroccoliJoyZoningEngine } from "../tooling/extensions/permissions/broccolidb-joy-zoning.js";
import { BroccoliJoyZoningGuard } from "../tooling/extensions/permissions/broccolidb-joy-zoning-guard.js";
import { BroccoliWorkspaceArchitectureProfiler } from "../tooling/extensions/permissions/broccolidb-architecture-profiler.js";
import { BroccoliJoyZoningModuleDecomposer } from "../tooling/extensions/permissions/broccolidb-module-decomposer.js";
import { BroccoliTspPolicyPlugin } from "../tooling/extensions/permissions/broccolidb-tsp-policy.js";
import { BroccoliJoyRideDiagnostics } from "../tooling/extensions/cache/broccolidb-joyride-diagnostics.js";
import { BroccoliJoyRideContractVerifier } from "../tooling/extensions/cache/broccolidb-joyride-contract.js";
import { BroccoliReactivePolicyObserver } from "../tooling/extensions/permissions/broccolidb-reactive-policy.js";
import { BroccoliUniversalGuard } from "../tooling/extensions/permissions/broccolidb-universal-guard.js";
import { BroccoliJoyRideDecisionLog } from "../tooling/extensions/cache/broccolidb-joyride-decision-log.js";
import { BroccoliIntegrityProtocol } from "../tooling/extensions/permissions/broccolidb-integrity-protocol.js";
import { BroccoliAutomatedModeController } from "../agents/extensions/execution/broccolidb-mode-controller.js";
import { BroccoliIntegrityOptimizer } from "../tooling/extensions/permissions/broccolidb-integrity-optimizer.js";
import { BroccoliStabilityForensics } from "../tooling/extensions/permissions/broccolidb-stability-forensics.js";
import { BroccoliSemanticAxiomEngine } from "../tooling/extensions/permissions/broccolidb-semantic-axiom.js";
import { BroccoliSimulationEngine } from "../tooling/extensions/permissions/broccolidb-simulation-engine.js";
import { BroccoliCommandSanitizer } from "../tooling/extensions/permissions/broccolidb-command-sanitizer.js";
import { BroccoliShellEnvironmentResolver } from "../tooling/extensions/permissions/broccolidb-shell-resolver.js";
import { BroccoliCommandDiagnostics } from "../tooling/extensions/permissions/broccolidb-command-diagnostics.js";
import { BroccoliCommandOutputBuffer } from "../tooling/extensions/telemetry/broccolidb-output-buffer.js";

import { JoyRideHotPathCache, HotPathCommandClassifier } from "../tooling/extensions/cache/joyride-cache.js";
import { LumiIgnorePolicyController } from "../tooling/extensions/permissions/lumi-ignore-controller.js";
import { BroccoliCircuitBreaker, TokenBucketRateGovernor } from "../tooling/extensions/policy/broccoli-circuit-breaker.js";
import { BroccoliStreamingToolExecutor } from "../tooling/extensions/registry/broccolidb-streaming-tool-executor.js";
import { BroccoliLspProtocolBridge } from "../tooling/extensions/perception/broccolidb-lsp-bridge.js";
import { TransportConnectionController } from "../tooling/extensions/gateway/transport-connection-controller.js";
import { ResilientFetchClient } from "../tooling/extensions/telemetry/resilient-fetch-client.js";
import { FrontmatterParser } from "../tooling/extensions/perception/frontmatter-parser.js";
import { BoundedFilePeeker } from "../tooling/extensions/perception/file-peeker.js";
import { CommandPathResolver } from "../tooling/extensions/permissions/command-path-resolver.js";
import { TerminalTextSanitizer } from "../tooling/extensions/telemetry/text-sanitizer.js";
import { MicrosecondTimingBuffer } from "../tooling/extensions/telemetry/timing-buffer.js";
import { TabSpacingNormalizer } from "../tooling/extensions/hashline/tab-spacing-normalizer.js";
import { ToolCallSchemaValidator } from "../tooling/extensions/registry/tool-call-schema-validator.js";
import { ArgumentCoercer } from "../tooling/extensions/registry/argument-coercer.js";
import { BatchEditAnchorer } from "../tooling/extensions/hashline/batch-edit-anchorer.js";
import { DiffSynthesizer } from "../tooling/extensions/hashline/diff-synthesizer.js";
import { MasterBenchmarkOrchestrator } from "../tooling/extensions/evals/master-benchmark-orchestrator.js";
import { McpHub } from "../tooling/extensions/mcp/mcp-hub.js";
import { RipgrepSearchService } from "../tooling/extensions/perception/ripgrep-search-service.js";
import { UrlContentFetcher } from "../tooling/extensions/perception/url-content-fetcher.js";
import { LanguageSyntaxParser } from "../tooling/extensions/perception/language-syntax-parser.js";
import { RoadmapCompletionGate } from "../tooling/extensions/policy/roadmap-completion-gate.js";
import { RoadmapCheckpointDigest } from "../tooling/extensions/policy/roadmap-checkpoint-digest.js";
import { Eyes } from "../tooling/base/eyes.js";
import { AstPerceptionEyes } from "../tooling/extensions/perception/ast-eyes.js";
import { NativeClipboardBridge } from "../tooling/extensions/perception/native-clipboard.js";
import { AnchoredHands } from "../tooling/extensions/hashline/hands.js";
import { CommandPermissionController } from "../tooling/extensions/permissions/command-permission-controller.js";
import { ProcessLifecycleManager } from "../tooling/extensions/permissions/process-lifecycle-manager.js";
import { KeybindingsController } from "../tooling/extensions/permissions/keybindings-controller.js";
import { ProtocolEars } from "../tooling/extensions/telemetry/ears.js";
import { ProgressStreamingEars } from "../tooling/extensions/progress/progress-ears.js";
import { SkillsIngestor } from "../tooling/extensions/registry/skills-ingestor.js";
import { ValidatingToolRegistry } from "../tooling/extensions/registry/tool-registry.js";
import { MonolithGatewayServer } from "../tooling/extensions/gateway/monolith-gateway-server.js";
import { MonolithBenchmarkEvaluator } from "../tooling/extensions/evals/benchmark-evaluator.js";
import { TelemetryTracer } from "../tooling/extensions/telemetry/telemetry-tracer.js";
import { AgenticCommitGenerator } from "../tooling/extensions/policy/agentic-commit-generator.js";
import { StreamEventFormatter } from "../tooling/extensions/telemetry/stream-event-formatter.js";
import { StderrGuardFilter } from "../tooling/extensions/telemetry/stderr-guard.js";
import { TTSRCoordinator } from "../tooling/extensions/telemetry/ttsr-coordinator.js";
import { CentennialPassMarker } from "../tooling/extensions/policy/centennial-pass-marker.js";

import { DeterministicSkillTreeParser } from "../tooling/extensions/skills/deterministic-skill-tree-parser.js";
import { AnchoredSkillMutator } from "../tooling/extensions/skills/anchored-skill-mutator.js";
import { SkillTreeToolSuite } from "../tooling/extensions/skills/skill-tree-tool-suite.js";
import { BroccoliSkillTreeSubstrate } from "../sessions/extensions/skills/broccoli-skill-tree-substrate.js";
import { SkillTreeSnapshotManager } from "../sessions/extensions/skills/skill-tree-snapshot-manager.js";
import { DeterministicSkillCurator } from "../sessions/extensions/skills/deterministic-skill-curator.js";
import { EvolutionarySkillTreeEngine } from "../agents/extensions/skills/evolutionary-skill-tree-engine.js";
import { SkillTreePromptComposer } from "../agents/extensions/skills/skill-tree-prompt-composer.js";
import { AntiDegenerationGuard } from "../agents/extensions/skills/anti-degeneration-guard.js";

import { DeterministicSoulParser } from "../tooling/extensions/soul/deterministic-soul-parser.js";
import { AnchoredSoulMutator } from "../tooling/extensions/soul/anchored-soul-mutator.js";
import { SoulToolSuite } from "../tooling/extensions/soul/soul-tool-suite.js";
import { BroccoliSoulSubstrate } from "../sessions/extensions/soul/broccoli-soul-substrate.js";
import { SoulSnapshotManager } from "../sessions/extensions/soul/soul-snapshot-manager.js";
import { SoulThreatGuard } from "../agents/extensions/soul/soul-threat-guard.js";
import { SoulPromptComposer } from "../agents/extensions/soul/soul-prompt-composer.js";

import { AnchoredWorktreeManager } from "../tooling/extensions/delegation/anchored-worktree-manager.js";
import { SwarmToolSuite } from "../tooling/extensions/delegation/swarm-tool-suite.js";
import { SubagentVfsBrancher } from "../sessions/extensions/delegation/subagent-vfs-brancher.js";
import { SubagentBudgetGovernor } from "../sessions/extensions/delegation/subagent-budget-governor.js";
import { SubagentLifecycleGuard } from "../agents/extensions/delegation/subagent-lifecycle-guard.js";
import { MonolithSwarmDelegator } from "../agents/extensions/delegation/monolith-swarm-delegator.js";

import { DeterministicBlueprintCatalog } from "../tooling/extensions/cron/deterministic-blueprint-catalog.js";
import { AnchoredCronJobManager } from "../tooling/extensions/cron/anchored-cron-job-manager.js";
import { CronToolSuite } from "../tooling/extensions/cron/cron-tool-suite.js";
import { BroccoliCronSubstrate } from "../sessions/extensions/cron/broccoli-cron-substrate.js";
import { CronSnapshotManager } from "../sessions/extensions/cron/cron-snapshot-manager.js";
import { CronLifecycleGuard } from "../agents/extensions/cron/cron-lifecycle-guard.js";
import { MonolithCronScheduler } from "../agents/extensions/cron/monolith-cron-scheduler.js";

import { CdpNavigationGuard } from "../agents/extensions/cdp/cdp-navigation-guard.js";
import { CdpDialogPolicyEngine } from "../agents/extensions/cdp/cdp-dialog-policy-engine.js";
import { CdpDomSnapshotter } from "../tooling/extensions/cdp/cdp-dom-snapshotter.js";
import { CdpProtocolClient } from "../tooling/extensions/cdp/cdp-protocol-client.js";
import { BroccoliBrowserSubstrate } from "../sessions/extensions/cdp/broccoli-browser-substrate.js";
import { BrowserSnapshotManager } from "../sessions/extensions/cdp/browser-snapshot-manager.js";
import { CdpSupervisorEngine } from "../agents/extensions/cdp/cdp-supervisor-engine.js";
import { CdpToolSuite } from "../tooling/extensions/cdp/cdp-tool-suite.js";

import { TokenBucketRateGovernor as CredentialRateGovernor } from "../tooling/extensions/credential/token-bucket-rate-governor.js";
import { DeterministicCredentialPool } from "../tooling/extensions/credential/deterministic-credential-pool.js";
import { CredentialToolSuite } from "../tooling/extensions/credential/credential-tool-suite.js";
import { BroccoliCredentialSubstrate } from "../sessions/extensions/credential/broccoli-credential-substrate.js";
import { CredentialSnapshotManager } from "../sessions/extensions/credential/credential-snapshot-manager.js";
import { CredentialCircuitBreaker } from "../agents/extensions/credential/credential-circuit-breaker.js";
import { MonolithCredentialManager } from "../agents/extensions/credential/monolith-credential-manager.js";

import { TelegramProtocolAdapter } from "../tooling/extensions/gateway/platform-adapters/telegram-protocol-adapter.js";
import { DiscordProtocolAdapter } from "../tooling/extensions/gateway/platform-adapters/discord-protocol-adapter.js";
import { SlackProtocolAdapter } from "../tooling/extensions/gateway/platform-adapters/slack-protocol-adapter.js";
import { WebhookProtocolAdapter } from "../tooling/extensions/gateway/platform-adapters/webhook-protocol-adapter.js";
import { GatewayToolSuite } from "../tooling/extensions/gateway/gateway-tool-suite.js";
import { GatewayDeliveryLedger } from "../sessions/extensions/gateway/gateway-delivery-ledger.js";
import { BroccoliGatewaySubstrate } from "../sessions/extensions/gateway/broccoli-gateway-substrate.js";
import { GatewaySnapshotManager } from "../sessions/extensions/gateway/gateway-snapshot-manager.js";
import { GatewayDispatcherEngine } from "../agents/extensions/gateway/gateway-dispatcher-engine.js";

import { HeadTailBudgetGovernor } from "../tooling/extensions/compaction/head-tail-budget-governor.js";
import { DeterministicToolPruner } from "../tooling/extensions/compaction/deterministic-tool-pruner.js";
import { BroccoliCompressionSubstrate } from "../sessions/extensions/compaction/broccoli-compression-substrate.js";
import { CompressionSnapshotManager } from "../sessions/extensions/compaction/compression-snapshot-manager.js";
import { TrajectoryCompactorEngine } from "../agents/extensions/compaction/trajectory-compactor-engine.js";
import { CompressionToolSuite } from "../tooling/extensions/compaction/compression-tool-suite.js";

import { FtsQuerySanitizer } from "../tooling/extensions/search/fts-query-sanitizer.js";
import { BroccoliSearchSubstrate } from "../sessions/extensions/search/broccoli-search-substrate.js";
import { SearchSnapshotManager } from "../sessions/extensions/search/search-snapshot-manager.js";
import { DeterministicSessionSearchEngine } from "../tooling/extensions/search/deterministic-session-search-engine.js";
import { SearchToolSuite } from "../tooling/extensions/search/search-tool-suite.js";

import { SecretScrubber } from "../tooling/extensions/environments/secret-scrubber.js";
import { LocalEnvironmentAdapter } from "../tooling/extensions/environments/local-environment-adapter.js";
import { DockerEnvironmentAdapter } from "../tooling/extensions/environments/docker-environment-adapter.js";
import { BroccoliEnvironmentSubstrate } from "../sessions/extensions/environments/broccoli-environment-substrate.js";
import { EnvironmentSnapshotManager } from "../sessions/extensions/environments/environment-snapshot-manager.js";
import { EnvironmentSupervisorEngine } from "../agents/extensions/environments/environment-supervisor-engine.js";
import { EnvironmentToolSuite } from "../tooling/extensions/environments/environment-tool-suite.js";

import { JitteredBackoffGovernor } from "../tooling/extensions/faults/jittered-backoff-governor.js";
import { DeterministicErrorClassifier } from "../tooling/extensions/faults/deterministic-error-classifier.js";
import { BroccoliFaultSubstrate } from "../sessions/extensions/faults/broccoli-fault-substrate.js";
import { FaultSnapshotManager } from "../sessions/extensions/faults/fault-snapshot-manager.js";
import { FaultRecoverySupervisor } from "../agents/extensions/faults/fault-recovery-supervisor.js";
import { FaultDiagnosticToolSuite } from "../tooling/extensions/faults/fault-diagnostic-tool-suite.js";

import { AcpProtocolCodec } from "../tooling/extensions/acp/acp-protocol-codec.js";
import { AcpPermissionGate } from "../tooling/extensions/acp/acp-permission-gate.js";
import { BroccoliAcpSubstrate } from "../sessions/extensions/acp/broccoli-acp-substrate.js";
import { AcpSnapshotManager } from "../sessions/extensions/acp/acp-snapshot-manager.js";
import { AcpBridgeServer } from "../agents/extensions/acp/acp-bridge-server.js";
import { AcpToolSuite } from "../tooling/extensions/acp/acp-tool-suite.js";

import { McpTransportCodec } from "../tooling/extensions/mcp/mcp-transport-codec.js";
import { McpSecurityScrubber } from "../tooling/extensions/mcp/mcp-security-scrubber.js";
import { BroccoliMcpSubstrate } from "../sessions/extensions/mcp/broccoli-mcp-substrate.js";
import { McpSnapshotManager } from "../sessions/extensions/mcp/mcp-snapshot-manager.js";
import { McpSupervisorEngine } from "../agents/extensions/mcp/mcp-supervisor-engine.js";
import { McpClientToolSuite } from "../tooling/extensions/mcp/mcp-client-tool-suite.js";

import { ProcessOutputRingBuffer } from "../tooling/extensions/process/process-output-ring-buffer.js";
import { ProcessSecuritySandbox } from "../tooling/extensions/process/process-security-sandbox.js";
import { BroccoliProcessSubstrate } from "../sessions/extensions/process/broccoli-process-substrate.js";
import { ProcessSnapshotManager } from "../sessions/extensions/process/process-snapshot-manager.js";
import { ProcessSupervisorEngine } from "../agents/extensions/process/process-supervisor-engine.js";
import { ProcessToolSuite } from "../tooling/extensions/process/process-tool-suite.js";

import { SecurityRiskClassifier } from "../tooling/extensions/arbiter/security-risk-classifier.js";
import { ApprovalHashLedger } from "../tooling/extensions/arbiter/approval-hash-ledger.js";
import { BroccoliArbiterSubstrate } from "../sessions/extensions/arbiter/broccoli-arbiter-substrate.js";
import { ArbiterSnapshotManager } from "../sessions/extensions/arbiter/arbiter-snapshot-manager.js";
import { InteractiveSecurityArbiter } from "../agents/extensions/arbiter/interactive-security-arbiter.js";
import { ArbiterToolSuite } from "../tooling/extensions/arbiter/arbiter-tool-suite.js";

import { SemanticKnowledgeGraph } from "../sessions/extensions/memory/semantic-knowledge-graph.js";
import { BroccoliLearningSubstrate } from "../sessions/extensions/memory/broccoli-learning-substrate.js";
import { LearningSnapshotManager } from "../sessions/extensions/memory/learning-snapshot-manager.js";
import { ContinuousLearningCurator } from "../agents/extensions/memory/continuous-learning-curator.js";
import { LearningCuratorToolSuite } from "../tooling/extensions/memory/learning-curator-tool-suite.js";

import { DeterministicPatchEngine } from "../tooling/extensions/patch/deterministic-patch-engine.js";
import { BroccoliPatchSubstrate } from "../sessions/extensions/patch/broccoli-patch-substrate.js";
import { PatchSnapshotManager } from "../sessions/extensions/patch/patch-snapshot-manager.js";
import { AtomicMutationSupervisor } from "../agents/extensions/patch/atomic-mutation-supervisor.js";
import { FileMutationToolSuite } from "../tooling/extensions/patch/file-mutation-tool-suite.js";

import type { GameStateSnapshot } from "../core/contracts/session.contracts.js";

export interface MonolithFactoryOptions {
  cwd?: string;
  sessionId?: string;
  config?: AgentConfig;
  maxTurnHistory?: number;
  fallbackModels?: readonly string[];
}

export class MonolithFactory {
  static createEngine(options: MonolithFactoryOptions = {}): {
    config: AgentConfig;
    sessionContext: SessionContext;
    sessionStore: PersistentSessionStore;
    sessionCompactor: SessionCompactor;
    sessionVfs: SessionVfs;
    sessionMemoryStore: SessionMemoryStore;
    stabilityDoctor: StabilityDoctor;
    snapcompactEngine: SnapcompactEngine;
    fileLockManager: FileLockManager;
    snapshotLruCache: LruCache<string, GameStateSnapshot>;
    gatewaySessionRegistry: GatewaySessionRegistry;
    snapshotStorageIndex: SnapshotStorageIndex;
    snowflakeIdGenerator: SnowflakeIdGenerator;
    systemDirectoryResolver: SystemDirectoryResolver;
    ringBuffer: FixedRingBuffer<string>;
    semverComparator: SemanticVersionComparator;
    gitIgnoreFilter: GitIgnoreFilter;
    treeWalker: WorkspaceTreeWalker;
    lockAuthorityEngine: LockAuthorityEngine;
    joyrideCache: JoyRideHotPathCache;
    stalenessTracker: ContextStalenessTracker;
    knowledgeGraph: KnowledgeGraphSubstrate;
    ignoreController: LumiIgnorePolicyController;
    mutationSubstrate: NativeMutationTransactionSubstrate;
    writeCoalescer: WriteCoalescerSubstrate;
    convergenceEngine: ConvergenceEngineSubstrate;
    broccoliSubstrateStore: BroccoliSubstrateStore;
    broccoliTaskDagScheduler: BroccoliTaskDagScheduler;
    broccoliCircuitBreaker: BroccoliCircuitBreaker;
    tokenBucketRateGovernor: TokenBucketRateGovernor;
    broccoliCasCompactor: BroccoliCasCompactor;
    broccoliSpiderAuditEngine: BroccoliSpiderAuditEngine;
    broccoliEpistemicReasoningEngine: BroccoliEpistemicReasoningEngine;
    broccoliSystemInvariantEngine: BroccoliSystemInvariantEngine;
    broccoliStreamingToolExecutor: BroccoliStreamingToolExecutor;
    broccoliTaskStateEngine: BroccoliTaskStateEngine;
    broccoliLspBridge: BroccoliLspProtocolBridge;
    broccoliBlastRadiusCalculator: BroccoliBlastRadiusCalculator;
    broccoliCognitiveSuggestionEngine: BroccoliCognitiveSuggestionEngine;
    broccoliFencingMutexEngine: BroccoliFencingMutexEngine;
    broccoliRepairMutationExecutor: BroccoliRepairMutationExecutor;
    broccoliVerificationPipeline: BroccoliVerificationPipeline;
    broccoliRollbackCoordinator: BroccoliRollbackCoordinator;
    broccoliInterAgentMailbox: BroccoliInterAgentMailbox;
    broccoliApprovalPolicyEngine: BroccoliApprovalPolicyEngine;
    broccoliMutationPlanner: BroccoliMutationPlanner;
    broccoliExecutionTraceRecorder: BroccoliExecutionTraceRecorder;
    broccoliIntentTracer: BroccoliIntentTracer;
    broccoliCASScratchpad: BroccoliCASScratchpadService;
    broccoliContextDiagnosis: BroccoliContextDiagnosisService;
    broccoliRetentionCleanup: BroccoliRetentionCleanupService;
    broccoliTaskCoordinator: BroccoliTaskCoordinator;
    broccoliSideQuery: BroccoliSideQueryService;
    broccoliTokenEstimator: BroccoliTokenEstimator;
    broccoliQueryLoop: BroccoliQueryLoopOrchestrator;
    broccoliStructuralDiscovery: BroccoliStructuralDiscoveryService;
    broccoliAxiomVerifier: BroccoliAxiomVerifier;
    broccoliPlanEnforcer: BroccoliPlanModeEnforcer;
    broccoliJoyZoningEngine: BroccoliJoyZoningEngine;
    broccoliJoyZoningGuard: BroccoliJoyZoningGuard;
    broccoliArchitectureProfiler: BroccoliWorkspaceArchitectureProfiler;
    broccoliModuleDecomposer: BroccoliJoyZoningModuleDecomposer;
    broccoliTspPolicy: BroccoliTspPolicyPlugin;
    broccoliJoyRideDiagnostics: BroccoliJoyRideDiagnostics;
    broccoliContractVerifier: BroccoliJoyRideContractVerifier;
    broccoliReactiveObserver: BroccoliReactivePolicyObserver;
    broccoliUniversalGuard: BroccoliUniversalGuard;
    broccoliDecisionLog: BroccoliJoyRideDecisionLog;
    broccoliIntegrityProtocol: BroccoliIntegrityProtocol;
    broccoliModeController: BroccoliAutomatedModeController;
    broccoliIntegrityOptimizer: BroccoliIntegrityOptimizer;
    broccoliStabilityForensics: BroccoliStabilityForensics;
    broccoliSemanticAxiom: BroccoliSemanticAxiomEngine;
    broccoliSimulation: BroccoliSimulationEngine;
    broccoliCommandSanitizer: BroccoliCommandSanitizer;
    broccoliShellResolver: BroccoliShellEnvironmentResolver;
    broccoliCommandDiagnostics: BroccoliCommandDiagnostics;
    broccoliOutputBuffer: BroccoliCommandOutputBuffer;
    modelResolver: ModelResolver;
    modelCatalog: ModelCatalog;
    envKeyResolver: EnvironmentKeyResolver;
    imageModelRegistry: ImageModelRegistry;
    proxyGateway: LlmProxyGateway;
    reasoningEffortController: ReasoningEffortController;
    dynamicModelCache: DynamicModelCache;
    loopPhaseController: LoopPhaseController;
    budgetCalculator: ContextBudgetCalculator;
    tokenTruncator: TokenTruncator;
    templateEngine: PromptTemplateEngine;
    variableInjector: DynamicVariableInjector;
    connectionController: TransportConnectionController;
    resilientFetchClient: ResilientFetchClient;
    frontmatterParser: FrontmatterParser;
    filePeeker: BoundedFilePeeker;
    commandPathResolver: CommandPathResolver;
    textSanitizer: TerminalTextSanitizer;
    timingBuffer: MicrosecondTimingBuffer;
    tabSpacingNormalizer: TabSpacingNormalizer;
    schemaValidator: ToolCallSchemaValidator;
    argumentCoercer: ArgumentCoercer;
    batchAnchorer: BatchEditAnchorer;
    diffSynthesizer: DiffSynthesizer;
    masterBenchmarkOrchestrator: MasterBenchmarkOrchestrator;
    mcpHub: McpHub;
    ripgrepSearchService: RipgrepSearchService;
    urlContentFetcher: UrlContentFetcher;
    languageSyntaxParser: LanguageSyntaxParser;
    completionGate: RoadmapCompletionGate;
    checkpointDigest: RoadmapCheckpointDigest;
    clipboardBridge: NativeClipboardBridge;
    loopHarness: AgentLoopHarness;
    postmortemDiagnostic: PostmortemDiagnostic;
    processLifecycleManager: ProcessLifecycleManager;
    providerAttribution: ProviderAttributionComposer;
    stderrGuard: StderrGuardFilter;
    keybindingsController: KeybindingsController;
    httpDispatcher: HttpDispatcherOverlay;
    authStorageVault: AuthStorageVault;
    ttsrCoordinator: TTSRCoordinator;
    centennialPassMarker: CentennialPassMarker;
    systemHealthAggregator: SystemHealthAggregator;
    codexOAuthManager: CodexOAuthManager;
    codexProviderBridge: CodexProviderBridge;
    setupWizard: SetupWizard;
    slashRouter: AgentSlashRouter;
    mentionResolver: MentionResolver;
    swarmDispatcher: AgentSwarmDispatcher;
    intelligenceEngine: WorkspaceIntelligenceEngine;
    interactiveController: InteractiveModeController;
    permissionController: CommandPermissionController;
    commitGenerator: AgenticCommitGenerator;
    gatewayServer: MonolithGatewayServer;
    benchmarkEvaluator: MonolithBenchmarkEvaluator;
    telemetryTracer: TelemetryTracer;
    streamFormatter: StreamEventFormatter;
    eyes: AstPerceptionEyes;
    hands: AnchoredHands;
    ears: ProgressStreamingEars;
    skillsIngestor: SkillsIngestor;
    skillTreeParser: DeterministicSkillTreeParser;
    anchoredSkillMutator: AnchoredSkillMutator;
    skillTreeToolSuite: SkillTreeToolSuite;
    skillTreeSubstrate: BroccoliSkillTreeSubstrate;
    skillTreeSnapshotManager: SkillTreeSnapshotManager;
    deterministicSkillCurator: DeterministicSkillCurator;
    evolutionarySkillEngine: EvolutionarySkillTreeEngine;
    skillTreePromptComposer: SkillTreePromptComposer;
    antiDegenerationGuard: AntiDegenerationGuard;
    deterministicSoulParser: DeterministicSoulParser;
    anchoredSoulMutator: AnchoredSoulMutator;
    soulToolSuite: SoulToolSuite;
    broccoliSoulSubstrate: BroccoliSoulSubstrate;
    soulSnapshotManager: SoulSnapshotManager;
    soulThreatGuard: SoulThreatGuard;
    soulPromptComposer: SoulPromptComposer;
    anchoredWorktreeManager: AnchoredWorktreeManager;
    subagentBudgetGovernor: SubagentBudgetGovernor;
    subagentLifecycleGuard: SubagentLifecycleGuard;
    subagentVfsBrancher: SubagentVfsBrancher;
    monolithSwarmDelegator: MonolithSwarmDelegator;
    swarmToolSuite: SwarmToolSuite;
    deterministicBlueprintCatalog: DeterministicBlueprintCatalog;
    anchoredCronJobManager: AnchoredCronJobManager;
    cronToolSuite: CronToolSuite;
    broccoliCronSubstrate: BroccoliCronSubstrate;
    cronSnapshotManager: CronSnapshotManager;
    cronLifecycleGuard: CronLifecycleGuard;
    monolithCronScheduler: MonolithCronScheduler;
    cdpNavigationGuard: CdpNavigationGuard;
    cdpDialogPolicyEngine: CdpDialogPolicyEngine;
    cdpDomSnapshotter: CdpDomSnapshotter;
    cdpProtocolClient: CdpProtocolClient;
    broccoliBrowserSubstrate: BroccoliBrowserSubstrate;
    browserSnapshotManager: BrowserSnapshotManager;
    cdpSupervisorEngine: CdpSupervisorEngine;
    cdpToolSuite: CdpToolSuite;
    broccoliCredentialSubstrate: BroccoliCredentialSubstrate;
    deterministicCredentialPool: DeterministicCredentialPool;
    credentialCircuitBreaker: CredentialCircuitBreaker;
    monolithCredentialManager: MonolithCredentialManager;
    credentialSnapshotManager: CredentialSnapshotManager;
    credentialToolSuite: CredentialToolSuite;
    telegramProtocolAdapter: TelegramProtocolAdapter;
    discordProtocolAdapter: DiscordProtocolAdapter;
    slackProtocolAdapter: SlackProtocolAdapter;
    webhookProtocolAdapter: WebhookProtocolAdapter;
    broccoliGatewaySubstrate: BroccoliGatewaySubstrate;
    gatewayDeliveryLedger: GatewayDeliveryLedger;
    gatewaySnapshotManager: GatewaySnapshotManager;
    gatewayDispatcherEngine: GatewayDispatcherEngine;
    gatewayToolSuite: GatewayToolSuite;
    headTailBudgetGovernor: HeadTailBudgetGovernor;
    deterministicToolPruner: DeterministicToolPruner;
    broccoliCompressionSubstrate: BroccoliCompressionSubstrate;
    compressionSnapshotManager: CompressionSnapshotManager;
    trajectoryCompactorEngine: TrajectoryCompactorEngine;
    compressionToolSuite: CompressionToolSuite;
    ftsQuerySanitizer: FtsQuerySanitizer;
    broccoliSearchSubstrate: BroccoliSearchSubstrate;
    searchSnapshotManager: SearchSnapshotManager;
    deterministicSessionSearchEngine: DeterministicSessionSearchEngine;
    searchToolSuite: SearchToolSuite;
    secretScrubber: SecretScrubber;
    localEnvironmentAdapter: LocalEnvironmentAdapter;
    dockerEnvironmentAdapter: DockerEnvironmentAdapter;
    broccoliEnvironmentSubstrate: BroccoliEnvironmentSubstrate;
    environmentSnapshotManager: EnvironmentSnapshotManager;
    environmentSupervisorEngine: EnvironmentSupervisorEngine;
    environmentToolSuite: EnvironmentToolSuite;
    jitteredBackoffGovernor: JitteredBackoffGovernor;
    deterministicErrorClassifier: DeterministicErrorClassifier;
    broccoliFaultSubstrate: BroccoliFaultSubstrate;
    faultSnapshotManager: FaultSnapshotManager;
    faultRecoverySupervisor: FaultRecoverySupervisor;
    faultDiagnosticToolSuite: FaultDiagnosticToolSuite;
    acpProtocolCodec: AcpProtocolCodec;
    acpPermissionGate: AcpPermissionGate;
    broccoliAcpSubstrate: BroccoliAcpSubstrate;
    acpSnapshotManager: AcpSnapshotManager;
    acpBridgeServer: AcpBridgeServer;
    acpToolSuite: AcpToolSuite;
    mcpTransportCodec: McpTransportCodec;
    mcpSecurityScrubber: McpSecurityScrubber;
    broccoliMcpSubstrate: BroccoliMcpSubstrate;
    mcpSnapshotManager: McpSnapshotManager;
    mcpSupervisorEngine: McpSupervisorEngine;
    mcpClientToolSuite: McpClientToolSuite;
    processOutputRingBuffer: ProcessOutputRingBuffer;
    processSecuritySandbox: ProcessSecuritySandbox;
    broccoliProcessSubstrate: BroccoliProcessSubstrate;
    processSnapshotManager: ProcessSnapshotManager;
    processSupervisorEngine: ProcessSupervisorEngine;
    processToolSuite: ProcessToolSuite;
    securityRiskClassifier: SecurityRiskClassifier;
    approvalHashLedger: ApprovalHashLedger;
    broccoliArbiterSubstrate: BroccoliArbiterSubstrate;
    arbiterSnapshotManager: ArbiterSnapshotManager;
    interactiveSecurityArbiter: InteractiveSecurityArbiter;
    arbiterToolSuite: ArbiterToolSuite;
    semanticKnowledgeGraph: SemanticKnowledgeGraph;
    broccoliLearningSubstrate: BroccoliLearningSubstrate;
    learningSnapshotManager: LearningSnapshotManager;
    continuousLearningCurator: ContinuousLearningCurator;
    learningCuratorToolSuite: LearningCuratorToolSuite;
    deterministicPatchEngine: DeterministicPatchEngine;
    broccoliPatchSubstrate: BroccoliPatchSubstrate;
    patchSnapshotManager: PatchSnapshotManager;
    atomicMutationSupervisor: AtomicMutationSupervisor;
    fileMutationToolSuite: FileMutationToolSuite;
    toolRegistry: ValidatingToolRegistry;
    promptComposer: PromptComposer;
    agentEngine: AgentEngine;
  } {
    const cwd = options.cwd ?? process.cwd();
    const sessionId = options.sessionId ?? `session-${Date.now()}`;

    const config = options.config ?? AgentConfig.createDefault();
    const sessionContext = new SessionContext({ sessionId, cwd });
    const sessionStore = new PersistentSessionStore();
    const sessionCompactor = new SessionCompactor({
      maxTurnHistory: options.maxTurnHistory ?? config.maxTurns,
    });
    const sessionVfs = new SessionVfs();
    const sessionMemoryStore = new SessionMemoryStore();
    const stabilityDoctor = new StabilityDoctor();
    const snapcompactEngine = new SnapcompactEngine();
    const fileLockManager = new FileLockManager();
    const snapshotLruCache = new LruCache<string, GameStateSnapshot>(50);
    const gatewaySessionRegistry = new GatewaySessionRegistry();
    const snapshotStorageIndex = new SnapshotStorageIndex();
    const snowflakeIdGenerator = new SnowflakeIdGenerator();
    const systemDirectoryResolver = new SystemDirectoryResolver();
    const ringBuffer = new FixedRingBuffer<string>(100);
    const semverComparator = new SemanticVersionComparator();
    const gitIgnoreFilter = new GitIgnoreFilter();
    const treeWalker = new WorkspaceTreeWalker(gitIgnoreFilter);
    const lockAuthorityEngine = new LockAuthorityEngine();
    const joyrideCache = new JoyRideHotPathCache();
    const stalenessTracker = new ContextStalenessTracker(cwd);
    const knowledgeGraph = new KnowledgeGraphSubstrate();
    const ignoreController = new LumiIgnorePolicyController(cwd);
    const mutationSubstrate = new NativeMutationTransactionSubstrate(cwd);
    const writeCoalescer = new WriteCoalescerSubstrate();
    const convergenceEngine = new ConvergenceEngineSubstrate();
    const broccoliSubstrateStore = new BroccoliSubstrateStore();
    const broccoliTaskDagScheduler = new BroccoliTaskDagScheduler();
    const broccoliCircuitBreaker = new BroccoliCircuitBreaker();
    const tokenBucketRateGovernor = new TokenBucketRateGovernor();
    const broccoliCasCompactor = new BroccoliCasCompactor();
    const broccoliSpiderAuditEngine = new BroccoliSpiderAuditEngine(cwd);
    const broccoliEpistemicReasoningEngine = new BroccoliEpistemicReasoningEngine();
    const broccoliSystemInvariantEngine = new BroccoliSystemInvariantEngine(cwd);
    const broccoliStreamingToolExecutor = new BroccoliStreamingToolExecutor();
    const broccoliTaskStateEngine = new BroccoliTaskStateEngine(cwd);
    const broccoliLspBridge = new BroccoliLspProtocolBridge(cwd);
    const broccoliBlastRadiusCalculator = new BroccoliBlastRadiusCalculator(cwd);
    const broccoliCognitiveSuggestionEngine = new BroccoliCognitiveSuggestionEngine();
    const broccoliFencingMutexEngine = new BroccoliFencingMutexEngine();
    const broccoliRepairMutationExecutor = new BroccoliRepairMutationExecutor(cwd);
    const broccoliVerificationPipeline = new BroccoliVerificationPipeline();
    const broccoliRollbackCoordinator = new BroccoliRollbackCoordinator(cwd);
    const broccoliInterAgentMailbox = new BroccoliInterAgentMailbox();
    const broccoliApprovalPolicyEngine = new BroccoliApprovalPolicyEngine();
    const broccoliMutationPlanner = new BroccoliMutationPlanner(broccoliApprovalPolicyEngine);
    const broccoliExecutionTraceRecorder = new BroccoliExecutionTraceRecorder();
    const broccoliIntentTracer = new BroccoliIntentTracer();
    const broccoliCASScratchpad = new BroccoliCASScratchpadService(cwd);
    const broccoliContextDiagnosis = new BroccoliContextDiagnosisService();
    const broccoliRetentionCleanup = new BroccoliRetentionCleanupService(cwd);
    const broccoliTaskCoordinator = new BroccoliTaskCoordinator();
    const broccoliSideQuery = new BroccoliSideQueryService();
    const broccoliTokenEstimator = new BroccoliTokenEstimator();
    const broccoliQueryLoop = new BroccoliQueryLoopOrchestrator();
    const broccoliStructuralDiscovery = new BroccoliStructuralDiscoveryService(cwd);
    const broccoliAxiomVerifier = new BroccoliAxiomVerifier();
    const broccoliPlanEnforcer = new BroccoliPlanModeEnforcer(cwd);
    const broccoliJoyZoningEngine = new BroccoliJoyZoningEngine();
    const broccoliJoyZoningGuard = new BroccoliJoyZoningGuard(broccoliJoyZoningEngine);
    const broccoliArchitectureProfiler = new BroccoliWorkspaceArchitectureProfiler(broccoliJoyZoningEngine);
    const broccoliModuleDecomposer = new BroccoliJoyZoningModuleDecomposer(broccoliJoyZoningEngine);
    const broccoliTspPolicy = new BroccoliTspPolicyPlugin();
    const broccoliJoyRideDiagnostics = new BroccoliJoyRideDiagnostics();
    const broccoliContractVerifier = new BroccoliJoyRideContractVerifier();
    const broccoliReactiveObserver = new BroccoliReactivePolicyObserver(broccoliJoyZoningEngine);
    const broccoliUniversalGuard = new BroccoliUniversalGuard(broccoliJoyZoningEngine);
    const broccoliDecisionLog = new BroccoliJoyRideDecisionLog();
    const broccoliIntegrityProtocol = new BroccoliIntegrityProtocol();
    const broccoliModeController = new BroccoliAutomatedModeController();
    const broccoliIntegrityOptimizer = new BroccoliIntegrityOptimizer(broccoliJoyZoningEngine);
    const broccoliStabilityForensics = new BroccoliStabilityForensics(cwd);
    const broccoliSemanticAxiom = new BroccoliSemanticAxiomEngine(broccoliJoyZoningEngine);
    const broccoliSimulation = new BroccoliSimulationEngine(cwd, broccoliJoyZoningEngine);
    const broccoliCommandSanitizer = new BroccoliCommandSanitizer();
    const broccoliShellResolver = new BroccoliShellEnvironmentResolver();
    const broccoliCommandDiagnostics = new BroccoliCommandDiagnostics();
    const broccoliOutputBuffer = new BroccoliCommandOutputBuffer();

    const modelResolver = new ModelResolver(
      config.modelName,
      options.fallbackModels
    );
    const modelCatalog = new ModelCatalog();
    const envKeyResolver = new EnvironmentKeyResolver();
    const imageModelRegistry = new ImageModelRegistry();
    const proxyGateway = new LlmProxyGateway();
    const reasoningEffortController = new ReasoningEffortController();
    const dynamicModelCache = new DynamicModelCache();
    const loopPhaseController = new LoopPhaseController();
    const budgetCalculator = new ContextBudgetCalculator();
    const tokenTruncator = new TokenTruncator();
    const templateEngine = new PromptTemplateEngine();
    const variableInjector = new DynamicVariableInjector();

    const connectionController = new TransportConnectionController();
    const resilientFetchClient = new ResilientFetchClient();
    const frontmatterParser = new FrontmatterParser();
    const filePeeker = new BoundedFilePeeker();
    const commandPathResolver = new CommandPathResolver();
    const textSanitizer = new TerminalTextSanitizer();
    const timingBuffer = new MicrosecondTimingBuffer(100);
    const tabSpacingNormalizer = new TabSpacingNormalizer();
    const schemaValidator = new ToolCallSchemaValidator();
    const argumentCoercer = new ArgumentCoercer();
    const mcpHub = new McpHub();
    const ripgrepSearchService = new RipgrepSearchService();
    const urlContentFetcher = new UrlContentFetcher(resilientFetchClient);
    const languageSyntaxParser = new LanguageSyntaxParser();
    const completionGate = new RoadmapCompletionGate();
    const checkpointDigest = new RoadmapCheckpointDigest();
    const clipboardBridge = new NativeClipboardBridge();
    const loopHarness = new AgentLoopHarness();
    const postmortemDiagnostic = new PostmortemDiagnostic();
    const processLifecycleManager = new ProcessLifecycleManager();
    const providerAttribution = new ProviderAttributionComposer();
    const stderrGuard = new StderrGuardFilter();
    const keybindingsController = new KeybindingsController();
    const httpDispatcher = new HttpDispatcherOverlay();
    const authStorageVault = new AuthStorageVault();
    for (const status of envKeyResolver.getProviderStatuses()) {
      if (status.hasKey) {
        const key = envKeyResolver.resolveKey(status.provider);
        if (key) {
          authStorageVault.setToken(status.provider, key);
        }
      }
    }
    const ttsrCoordinator = new TTSRCoordinator();
    const centennialPassMarker = new CentennialPassMarker();
    const systemHealthAggregator = new SystemHealthAggregator();
    const codexOAuthManager = new CodexOAuthManager(authStorageVault);
    codexOAuthManager.loadFromDisk();
    const codexProviderBridge = new CodexProviderBridge(codexOAuthManager, authStorageVault, envKeyResolver);
    const setupWizard = new SetupWizard({
      envKeyResolver,
      authStorageVault,
      codexOAuthManager,
      codexProviderBridge,
      proxyGateway,
    });
    const savedModel = setupWizard.getSavedModel();
    if (!options.config && savedModel) {
      (config as { modelName: string }).modelName = savedModel;
      modelResolver.setActiveModel(savedModel);
    }







    const permissionController = new CommandPermissionController();
    const eyes = new AstPerceptionEyes();
    const hands = new AnchoredHands(permissionController);
    const batchAnchorer = new BatchEditAnchorer(hands);
    const diffSynthesizer = new DiffSynthesizer();
    const benchmarkEvaluator = new MonolithBenchmarkEvaluator();
    const masterBenchmarkOrchestrator = new MasterBenchmarkOrchestrator(benchmarkEvaluator);

    const ears = new ProgressStreamingEars();
    const skillsIngestor = new SkillsIngestor(eyes);
    const skillTreeParser = new DeterministicSkillTreeParser();
    const skillTreeSubstrate = new BroccoliSkillTreeSubstrate(skillTreeParser);
    const anchoredSkillMutator = new AnchoredSkillMutator(hands, eyes);
    const skillTreeToolSuite = new SkillTreeToolSuite(skillTreeSubstrate, anchoredSkillMutator, skillTreeParser, eyes);
    const skillTreeSnapshotManager = new SkillTreeSnapshotManager(skillTreeSubstrate);
    const deterministicSkillCurator = new DeterministicSkillCurator(skillTreeSubstrate);
    const evolutionarySkillEngine = new EvolutionarySkillTreeEngine(skillTreeSubstrate);
    const skillTreePromptComposer = new SkillTreePromptComposer();
    const antiDegenerationGuard = new AntiDegenerationGuard();

    const deterministicSoulParser = new DeterministicSoulParser();
    const anchoredSoulMutator = new AnchoredSoulMutator(deterministicSoulParser, hands);
    const soulToolSuite = new SoulToolSuite(deterministicSoulParser, anchoredSoulMutator);
    const broccoliSoulSubstrate = new BroccoliSoulSubstrate(deterministicSoulParser);
    soulToolSuite.setSubstrate(broccoliSoulSubstrate);
    const soulSnapshotManager = new SoulSnapshotManager(broccoliSoulSubstrate, deterministicSoulParser);
    const soulThreatGuard = new SoulThreatGuard();
    const soulPromptComposer = new SoulPromptComposer();

    const subagentLifecycleGuard = new SubagentLifecycleGuard();
    const subagentBudgetGovernor = new SubagentBudgetGovernor();
    const subagentVfsBrancher = new SubagentVfsBrancher();
    subagentVfsBrancher.registerParentVfs(sessionId, sessionVfs);
    const anchoredWorktreeManager = new AnchoredWorktreeManager(hands);
    const monolithSwarmDelegator = new MonolithSwarmDelegator(
      subagentLifecycleGuard,
      subagentBudgetGovernor,
      subagentVfsBrancher,
      anchoredWorktreeManager
    );
    const swarmToolSuite = new SwarmToolSuite(monolithSwarmDelegator);

    const deterministicBlueprintCatalog = new DeterministicBlueprintCatalog();
    const anchoredCronJobManager = new AnchoredCronJobManager();
    const broccoliCronSubstrate = new BroccoliCronSubstrate(anchoredCronJobManager);
    const cronSnapshotManager = new CronSnapshotManager(broccoliCronSubstrate);
    const cronLifecycleGuard = new CronLifecycleGuard();
    const monolithCronScheduler = new MonolithCronScheduler(broccoliCronSubstrate, cronLifecycleGuard);
    const cronToolSuite = new CronToolSuite(monolithCronScheduler, deterministicBlueprintCatalog);

    const cdpNavigationGuard = new CdpNavigationGuard();
    const cdpDomSnapshotter = new CdpDomSnapshotter();
    const cdpProtocolClient = new CdpProtocolClient();
    const broccoliBrowserSubstrate = new BroccoliBrowserSubstrate();
    const browserSnapshotManager = new BrowserSnapshotManager(broccoliBrowserSubstrate);
    const cdpDialogPolicyEngine = new CdpDialogPolicyEngine(broccoliBrowserSubstrate, "auto_dismiss", cdpProtocolClient);
    const cdpSupervisorEngine = new CdpSupervisorEngine(
      broccoliBrowserSubstrate,
      cdpNavigationGuard,
      cdpDialogPolicyEngine,
      cdpDomSnapshotter,
      cdpProtocolClient
    );
    const cdpToolSuite = new CdpToolSuite(cdpSupervisorEngine);

    const broccoliCredentialSubstrate = new BroccoliCredentialSubstrate();
    const credentialRateGovernor = new CredentialRateGovernor();
    const deterministicCredentialPool = new DeterministicCredentialPool(broccoliCredentialSubstrate, credentialRateGovernor);
    const credentialCircuitBreaker = new CredentialCircuitBreaker();
    const monolithCredentialManager = new MonolithCredentialManager(
      broccoliCredentialSubstrate,
      deterministicCredentialPool,
      credentialCircuitBreaker,
      credentialRateGovernor
    );
    const credentialSnapshotManager = new CredentialSnapshotManager(broccoliCredentialSubstrate);
    const credentialToolSuite = new CredentialToolSuite(deterministicCredentialPool);

    const telegramProtocolAdapter = new TelegramProtocolAdapter();
    const discordProtocolAdapter = new DiscordProtocolAdapter();
    const slackProtocolAdapter = new SlackProtocolAdapter();
    const webhookProtocolAdapter = new WebhookProtocolAdapter();
    const broccoliGatewaySubstrate = new BroccoliGatewaySubstrate();
    const gatewayDeliveryLedger = new GatewayDeliveryLedger();
    const gatewaySnapshotManager = new GatewaySnapshotManager(broccoliGatewaySubstrate, gatewayDeliveryLedger);
    const gatewayDispatcherEngine = new GatewayDispatcherEngine(
      broccoliGatewaySubstrate,
      gatewayDeliveryLedger,
      [telegramProtocolAdapter, discordProtocolAdapter, slackProtocolAdapter, webhookProtocolAdapter]
    );
    const gatewayToolSuite = new GatewayToolSuite(
      gatewayDispatcherEngine,
      broccoliGatewaySubstrate,
      gatewayDeliveryLedger
    );

    const headTailBudgetGovernor = new HeadTailBudgetGovernor();
    const deterministicToolPruner = new DeterministicToolPruner();
    const broccoliCompressionSubstrate = new BroccoliCompressionSubstrate();
    const compressionSnapshotManager = new CompressionSnapshotManager(broccoliCompressionSubstrate);
    const trajectoryCompactorEngine = new TrajectoryCompactorEngine(
      broccoliCompressionSubstrate,
      headTailBudgetGovernor,
      deterministicToolPruner
    );
    const compressionToolSuite = new CompressionToolSuite(
      broccoliCompressionSubstrate,
      headTailBudgetGovernor,
      deterministicToolPruner,
      trajectoryCompactorEngine
    );


    const ftsQuerySanitizer = new FtsQuerySanitizer();
    const broccoliSearchSubstrate = new BroccoliSearchSubstrate();
    const searchSnapshotManager = new SearchSnapshotManager(broccoliSearchSubstrate);
    const deterministicSessionSearchEngine = new DeterministicSessionSearchEngine(
      broccoliSearchSubstrate,
      ftsQuerySanitizer
    );
    const searchToolSuite = new SearchToolSuite(
      deterministicSessionSearchEngine,
      broccoliSearchSubstrate
    );

    const secretScrubber = new SecretScrubber();
    const localEnvironmentAdapter = new LocalEnvironmentAdapter(secretScrubber);
    const dockerEnvironmentAdapter = new DockerEnvironmentAdapter(secretScrubber);
    const broccoliEnvironmentSubstrate = new BroccoliEnvironmentSubstrate();
    const environmentSnapshotManager = new EnvironmentSnapshotManager(broccoliEnvironmentSubstrate);
    const environmentSupervisorEngine = new EnvironmentSupervisorEngine(
      broccoliEnvironmentSubstrate,
      [localEnvironmentAdapter, dockerEnvironmentAdapter]
    );
    const environmentToolSuite = new EnvironmentToolSuite(
      environmentSupervisorEngine,
      broccoliEnvironmentSubstrate
    );

    const jitteredBackoffGovernor = new JitteredBackoffGovernor();
    const deterministicErrorClassifier = new DeterministicErrorClassifier(jitteredBackoffGovernor);
    const broccoliFaultSubstrate = new BroccoliFaultSubstrate();
    const faultSnapshotManager = new FaultSnapshotManager(broccoliFaultSubstrate);
    const faultRecoverySupervisor = new FaultRecoverySupervisor(
      deterministicErrorClassifier,
      jitteredBackoffGovernor,
      broccoliFaultSubstrate
    );
    const faultDiagnosticToolSuite = new FaultDiagnosticToolSuite(
      faultRecoverySupervisor,
      broccoliFaultSubstrate
    );

    const acpProtocolCodec = new AcpProtocolCodec();
    const broccoliAcpSubstrate = new BroccoliAcpSubstrate();
    const acpPermissionGate = new AcpPermissionGate(broccoliAcpSubstrate);
    const acpSnapshotManager = new AcpSnapshotManager(broccoliAcpSubstrate);
    const acpBridgeServer = new AcpBridgeServer(
      acpProtocolCodec,
      acpPermissionGate,
      broccoliAcpSubstrate
    );
    const acpToolSuite = new AcpToolSuite(
      acpPermissionGate,
      broccoliAcpSubstrate
    );

    const mcpTransportCodec = new McpTransportCodec();
    const mcpSecurityScrubber = new McpSecurityScrubber();
    const broccoliMcpSubstrate = new BroccoliMcpSubstrate();
    const mcpSnapshotManager = new McpSnapshotManager(broccoliMcpSubstrate);
    const mcpSupervisorEngine = new McpSupervisorEngine(
      broccoliMcpSubstrate,
      mcpTransportCodec,
      mcpSecurityScrubber
    );
    const mcpClientToolSuite = new McpClientToolSuite(
      mcpSupervisorEngine,
      broccoliMcpSubstrate
    );

    const processOutputRingBuffer = new ProcessOutputRingBuffer();
    const processSecuritySandbox = new ProcessSecuritySandbox();
    const broccoliProcessSubstrate = new BroccoliProcessSubstrate();
    const processSnapshotManager = new ProcessSnapshotManager(broccoliProcessSubstrate);
    const processSupervisorEngine = new ProcessSupervisorEngine(
      broccoliProcessSubstrate,
      processSecuritySandbox
    );
    const processToolSuite = new ProcessToolSuite(
      processSupervisorEngine,
      broccoliProcessSubstrate
    );

    const securityRiskClassifier = new SecurityRiskClassifier();
    const approvalHashLedger = new ApprovalHashLedger();
    const broccoliArbiterSubstrate = new BroccoliArbiterSubstrate();
    const arbiterSnapshotManager = new ArbiterSnapshotManager(broccoliArbiterSubstrate);
    const interactiveSecurityArbiter = new InteractiveSecurityArbiter(
      broccoliArbiterSubstrate,
      approvalHashLedger,
      securityRiskClassifier
    );
    const arbiterToolSuite = new ArbiterToolSuite(
      interactiveSecurityArbiter,
      broccoliArbiterSubstrate
    );

    const semanticKnowledgeGraph = new SemanticKnowledgeGraph();
    const broccoliLearningSubstrate = new BroccoliLearningSubstrate(semanticKnowledgeGraph);
    const learningSnapshotManager = new LearningSnapshotManager(broccoliLearningSubstrate);
    const continuousLearningCurator = new ContinuousLearningCurator(broccoliLearningSubstrate);
    const learningCuratorToolSuite = new LearningCuratorToolSuite(
      continuousLearningCurator,
      broccoliLearningSubstrate
    );

    const deterministicPatchEngine = new DeterministicPatchEngine();
    const broccoliPatchSubstrate = new BroccoliPatchSubstrate();
    const patchSnapshotManager = new PatchSnapshotManager(broccoliPatchSubstrate);
    const atomicMutationSupervisor = new AtomicMutationSupervisor(
      deterministicPatchEngine,
      broccoliPatchSubstrate
    );
    const fileMutationToolSuite = new FileMutationToolSuite(atomicMutationSupervisor);

    const slashRouter = new AgentSlashRouter();
    const mentionResolver = new MentionResolver();
    const swarmDispatcher = new AgentSwarmDispatcher();
    const intelligenceEngine = new WorkspaceIntelligenceEngine();
    const interactiveController = new InteractiveModeController();
    const commitGenerator = new AgenticCommitGenerator();
    const gatewayServer = new MonolithGatewayServer();
    const telemetryTracer = new TelemetryTracer();
    const streamFormatter = new StreamEventFormatter();

    const toolRegistry = new ValidatingToolRegistry(
      eyes,
      hands,
      ears,
      skillsIngestor,
      sessionMemoryStore,
      skillTreeToolSuite,
      soulToolSuite,
      swarmToolSuite,
      cronToolSuite,
      cdpToolSuite,
      credentialToolSuite,
      gatewayToolSuite,
      compressionToolSuite,
      searchToolSuite,
      environmentToolSuite,
      faultDiagnosticToolSuite,
      acpToolSuite,
      mcpClientToolSuite,
      processToolSuite,
      arbiterToolSuite,
      learningCuratorToolSuite,
      fileMutationToolSuite
    );

    const promptComposer = new PromptComposer();

    const agentEngine = new AgentEngine(
      config,
      sessionContext,
      sessionStore,
      toolRegistry,
      promptComposer,
      sessionCompactor,
      modelResolver,
      sessionVfs,
      sessionMemoryStore,
      slashRouter,
      codexProviderBridge,
      proxyGateway,
      undefined,
      { modelCatalog, budgetCalculator, tokenTruncator, completionGate }
    );

    return {
      config,
      sessionContext,
      sessionStore,
      sessionCompactor,
      sessionVfs,
      sessionMemoryStore,
      stabilityDoctor,
      snapcompactEngine,
      fileLockManager,
      snapshotLruCache,
      gatewaySessionRegistry,
      snapshotStorageIndex,
      snowflakeIdGenerator,
      systemDirectoryResolver,
      ringBuffer,
      semverComparator,
      gitIgnoreFilter,
      treeWalker,
      lockAuthorityEngine,
      joyrideCache,
      stalenessTracker,
      knowledgeGraph,
      ignoreController,
      mutationSubstrate,
      writeCoalescer,
      convergenceEngine,
      broccoliSubstrateStore,
      broccoliTaskDagScheduler,
      broccoliCircuitBreaker,
      tokenBucketRateGovernor,
      broccoliCasCompactor,
      broccoliSpiderAuditEngine,
      broccoliEpistemicReasoningEngine,
      broccoliSystemInvariantEngine,
      broccoliStreamingToolExecutor,
      broccoliTaskStateEngine,
      broccoliLspBridge,
      broccoliBlastRadiusCalculator,
      broccoliCognitiveSuggestionEngine,
      broccoliFencingMutexEngine,
      broccoliRepairMutationExecutor,
      broccoliVerificationPipeline,
      broccoliRollbackCoordinator,
      broccoliInterAgentMailbox,
      broccoliApprovalPolicyEngine,
      broccoliMutationPlanner,
      broccoliExecutionTraceRecorder,
      broccoliIntentTracer,
      broccoliCASScratchpad,
      broccoliContextDiagnosis,
      broccoliRetentionCleanup,
      broccoliTaskCoordinator,
      broccoliSideQuery,
      broccoliTokenEstimator,
      broccoliQueryLoop,
      broccoliStructuralDiscovery,
      broccoliAxiomVerifier,
      broccoliPlanEnforcer,
      broccoliJoyZoningEngine,
      broccoliJoyZoningGuard,
      broccoliArchitectureProfiler,
      broccoliModuleDecomposer,
      broccoliTspPolicy,
      broccoliJoyRideDiagnostics,
      broccoliContractVerifier,
      broccoliReactiveObserver,
      broccoliUniversalGuard,
      broccoliDecisionLog,
      broccoliIntegrityProtocol,
      broccoliModeController,
      broccoliIntegrityOptimizer,
      broccoliStabilityForensics,
      broccoliSemanticAxiom,
      broccoliSimulation,
      broccoliCommandSanitizer,
      broccoliShellResolver,
      broccoliCommandDiagnostics,
      broccoliOutputBuffer,
      modelResolver,
      modelCatalog,
      envKeyResolver,
      imageModelRegistry,
      proxyGateway,
      reasoningEffortController,
      dynamicModelCache,
      loopPhaseController,
      budgetCalculator,
      tokenTruncator,
      templateEngine,
      variableInjector,
      connectionController,
      resilientFetchClient,
      frontmatterParser,
      filePeeker,
      commandPathResolver,
      textSanitizer,
      timingBuffer,
      tabSpacingNormalizer,
      schemaValidator,
      argumentCoercer,
      batchAnchorer,
      diffSynthesizer,
      masterBenchmarkOrchestrator,
      mcpHub,
      ripgrepSearchService,
      urlContentFetcher,
      languageSyntaxParser,
      completionGate,
      checkpointDigest,
      clipboardBridge,
      loopHarness,
      postmortemDiagnostic,
      processLifecycleManager,
      providerAttribution,
      stderrGuard,
      keybindingsController,
      httpDispatcher,
      authStorageVault,
      ttsrCoordinator,
      centennialPassMarker,
      systemHealthAggregator,
      codexOAuthManager,
      codexProviderBridge,
      setupWizard,
      slashRouter,
      mentionResolver,
      swarmDispatcher,
      intelligenceEngine,
      interactiveController,
      permissionController,
      commitGenerator,
      gatewayServer,
      benchmarkEvaluator,
      telemetryTracer,
      streamFormatter,
      eyes,
      hands,
      ears,
      skillsIngestor,
      skillTreeParser,
      anchoredSkillMutator,
      skillTreeToolSuite,
      skillTreeSubstrate,
      skillTreeSnapshotManager,
      deterministicSkillCurator,
      evolutionarySkillEngine,
      skillTreePromptComposer,
      antiDegenerationGuard,
      deterministicSoulParser,
      anchoredSoulMutator,
      soulToolSuite,
      broccoliSoulSubstrate,
      soulSnapshotManager,
      soulThreatGuard,
      soulPromptComposer,
      anchoredWorktreeManager,
      subagentBudgetGovernor,
      subagentLifecycleGuard,
      subagentVfsBrancher,
      monolithSwarmDelegator,
      swarmToolSuite,
      deterministicBlueprintCatalog,
      anchoredCronJobManager,
      cronToolSuite,
      broccoliCronSubstrate,
      cronSnapshotManager,
      cronLifecycleGuard,
      monolithCronScheduler,
      cdpNavigationGuard,
      cdpDialogPolicyEngine,
      cdpDomSnapshotter,
      cdpProtocolClient,
      broccoliBrowserSubstrate,
      browserSnapshotManager,
      cdpSupervisorEngine,
      cdpToolSuite,
      broccoliCredentialSubstrate,
      deterministicCredentialPool,
      credentialCircuitBreaker,
      monolithCredentialManager,
      credentialSnapshotManager,
      credentialToolSuite,
      telegramProtocolAdapter,
      discordProtocolAdapter,
      slackProtocolAdapter,
      webhookProtocolAdapter,
      broccoliGatewaySubstrate,
      gatewayDeliveryLedger,
      gatewaySnapshotManager,
      gatewayDispatcherEngine,
      gatewayToolSuite,
      headTailBudgetGovernor,
      deterministicToolPruner,
      broccoliCompressionSubstrate,
      compressionSnapshotManager,
      trajectoryCompactorEngine,
      compressionToolSuite,
      ftsQuerySanitizer,
      broccoliSearchSubstrate,
      searchSnapshotManager,
      deterministicSessionSearchEngine,
      searchToolSuite,
      secretScrubber,
      localEnvironmentAdapter,
      dockerEnvironmentAdapter,
      broccoliEnvironmentSubstrate,
      environmentSnapshotManager,
      environmentSupervisorEngine,
      environmentToolSuite,
      jitteredBackoffGovernor,
      deterministicErrorClassifier,
      broccoliFaultSubstrate,
      faultSnapshotManager,
      faultRecoverySupervisor,
      faultDiagnosticToolSuite,
      acpProtocolCodec,
      acpPermissionGate,
      broccoliAcpSubstrate,
      acpSnapshotManager,
      acpBridgeServer,
      acpToolSuite,
      mcpTransportCodec,
      mcpSecurityScrubber,
      broccoliMcpSubstrate,
      mcpSnapshotManager,
      mcpSupervisorEngine,
      mcpClientToolSuite,
      processOutputRingBuffer,
      processSecuritySandbox,
      broccoliProcessSubstrate,
      processSnapshotManager,
      processSupervisorEngine,
      processToolSuite,
      securityRiskClassifier,
      approvalHashLedger,
      broccoliArbiterSubstrate,
      arbiterSnapshotManager,
      interactiveSecurityArbiter,
      arbiterToolSuite,
      semanticKnowledgeGraph,
      broccoliLearningSubstrate,
      learningSnapshotManager,
      continuousLearningCurator,
      learningCuratorToolSuite,
      deterministicPatchEngine,
      broccoliPatchSubstrate,
      patchSnapshotManager,
      atomicMutationSupervisor,
      fileMutationToolSuite,
      toolRegistry,
      promptComposer,
      agentEngine,
    };
  }

  static createFromSnapshot(snapshot: GameStateSnapshot, options: MonolithFactoryOptions = {}): ReturnType<typeof MonolithFactory.createEngine> {
    const components = MonolithFactory.createEngine(options);
    components.sessionStore.rewindToSnapshot(snapshot);
    return components;
  }
}
