#!/usr/bin/env node
import { realpathSync } from "node:fs";
import * as readline from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MonolithFactory, type MonolithFactoryOptions } from "./factories/monolith-factory.js";
import type { EngineTickInput, EngineTickResult, IAgentEngine } from "./core/contracts/agent.contracts.js";
import type { GameStateSnapshot } from "./core/contracts/session.contracts.js";
import { AgentConfig } from "./agents/base/agent-config.js";
import { AgentEngine } from "./agents/extensions/execution/agent-engine.js";
import { PromptComposer } from "./agents/extensions/compaction/prompt-composer.js";
import { ModelResolver } from "./agents/extensions/resolution/model-resolver.js";
import { AgentSlashRouter } from "./agents/extensions/resolution/agent-slash-router.js";
import { MentionResolver } from "./agents/extensions/mentions/mention-resolver.js";
import { AgentSwarmDispatcher, type SwarmSubagentTaskResult } from "./agents/extensions/swarm/agent-swarm-dispatcher.js";
import { WorkspaceIntelligenceEngine, type WorkspaceCognitiveModel } from "./agents/extensions/intelligence/workspace-intelligence.js";
import { ModelCatalog, type ModelSpecs } from "./agents/extensions/resolution/model-catalog.js";
import { InteractiveModeController } from "./agents/extensions/execution/interactive-mode-controller.js";
import { EnvironmentKeyResolver, type ProviderKeyStatus } from "./agents/extensions/resolution/environment-key-resolver.js";
import { ImageModelRegistry, type ImageModelSpecs } from "./agents/extensions/resolution/image-model-registry.js";
import { LlmProxyGateway, type ProxyEndpointConfig } from "./agents/extensions/resolution/llm-proxy-gateway.js";
import { ReasoningEffortController, type ReasoningEffortLevel } from "./agents/extensions/resolution/reasoning-effort-controller.js";
import { DynamicModelCache, type CachedModelList } from "./agents/extensions/resolution/dynamic-model-cache.js";
import { LoopPhaseController, type LoopPhase, type PhaseTransitionEvent } from "./agents/extensions/execution/loop-phase-controller.js";
import { ContextBudgetCalculator, type ContextBudgetInfo } from "./agents/extensions/compaction/context-budget-calculator.js";
import { TokenTruncator } from "./agents/extensions/compaction/token-truncator.js";
import { PromptTemplateEngine } from "./agents/extensions/compaction/prompt-template-engine.js";
import { DynamicVariableInjector } from "./agents/extensions/compaction/dynamic-variable-injector.js";
import { AgentLoopHarness } from "./agents/extensions/execution/agent-loop-harness.js";
import { ProviderAttributionComposer, type AttributionRecord, type AttributionSummary } from "./agents/extensions/resolution/provider-attribution.js";
import { HttpDispatcherOverlay, type DispatcherConfig } from "./agents/extensions/resolution/http-dispatcher.js";
import { AuthStorageVault, type AuthTokenRecord } from "./agents/extensions/resolution/auth-storage-vault.js";
import {
  CodexOAuthManager,
  OPENAI_CODEX_OAUTH_CONFIG,
  writeAtomicJsonFile,
  type OpenAiCodexCredentials,
  type CodexAuthUrlDetails,
  type CodexAuthDiagnostics,
  type AuthSourceAudit,
} from "./agents/extensions/resolution/codex-oauth-manager.js";
import { CodexProviderBridge, MODERN_GPT56_MODELS, type ResolvedAuthHeaders, type ModernGpt56Model } from "./agents/extensions/resolution/codex-provider-bridge.js";
import { OpenRouterProviderEngine, OPENROUTER_STEALTH_MODELS } from "./agents/extensions/resolution/openrouter-provider-engine.js";
import {
  CLAUDE_SONNET_1M_SUFFIX,
  OPENROUTER_PROVIDER_PREFERENCES,
  type OpenRouterModelInfo,
  type OpenRouterProviderPreferences,
  type OpenRouterStreamChunk,
  type OpenRouterStreamUsage,
  type OpenRouterErrorResponse,
  type OpenRouterParsedStreamEvent,
  type OpenRouterGenerationDetails,
  type OpenRouterAttributionHeaders,
  type OpenRouterHandlerOptions,
  type OpenRouterAuthCallbackResult,
} from "./core/contracts/openrouter.contracts.js";
import { SetupWizard } from "./agents/extensions/setup/setup-wizard.js";
import {
  DeterministicLocalEndpointEngine,
  DEFAULT_LOCAL_ENDPOINT_PRESETS,
  LOCAL_QUICKSTART_GUIDES,
} from "./tooling/extensions/endpoints/deterministic-local-endpoint-engine.js";
import { LocalEndpointDashboardModal } from "./tui/components/local-endpoint-dashboard-modal.js";
import type {
  LocalProviderKind,
  LocalEndpointProfile,
  DiscoveredLocalModel,
  LocalServerHealthStatus,
  LocalQuickstartGuide,
  LocalEndpointAuditReport,
  LocalEndpointMetricsReport,
} from "./core/contracts/local-endpoints.contracts.js";

import { SessionContext } from "./sessions/base/session-context.js";
import { PersistentSessionStore, SessionStore } from "./sessions/extensions/persistence/session-store.js";
import { SessionCompactor } from "./sessions/extensions/compaction/session-compactor.js";
import { SessionVfs } from "./sessions/extensions/vfs/session-vfs.js";
import { SessionMemoryStore } from "./sessions/extensions/memory/session-memory-store.js";
import { StabilityDoctor, type EnvironmentIntegrityReport } from "./sessions/extensions/integrity/stability-doctor.js";
import { PostmortemDiagnostic, type ExceptionRecord, type PostmortemReport } from "./sessions/extensions/integrity/postmortem-diagnostic.js";
import { SystemHealthAggregator, type SubsystemHealthStatus, type AggregateHealthReport } from "./sessions/extensions/integrity/system-health-aggregator.js";
import { SnapcompactEngine, type SnapcompactResult } from "./sessions/extensions/compaction/snapcompact-engine.js";
import { FileLockManager, LruCache } from "./sessions/extensions/substrate/file-lock.js";
import { RemoteSessionHandle } from "./sessions/extensions/persistence/remote-session-handle.js";
import { GatewaySessionRegistry, type ActiveSessionInfo } from "./sessions/extensions/persistence/gateway-session-registry.js";
import { SnapshotStorageIndex, type SnapshotMetadata } from "./sessions/extensions/persistence/snapshot-storage-index.js";
import { SnowflakeIdGenerator } from "./sessions/extensions/substrate/snowflake-id-generator.js";
import { SystemDirectoryResolver, type SystemDirectories } from "./sessions/extensions/substrate/system-directory-resolver.js";
import { FixedRingBuffer } from "./sessions/extensions/substrate/ring-buffer.js";
import { SemanticVersionComparator, type ParsedSemver } from "./sessions/extensions/integrity/semantic-version-comparator.js";
import { GitIgnoreFilter } from "./sessions/extensions/vfs/git-ignore-filter.js";
import { WorkspaceTreeWalker, type FileTreeNode } from "./sessions/extensions/vfs/workspace-tree-walker.js";

import { Eyes } from "./tooling/base/eyes.js";
import { AstPerceptionEyes, type SymbolSearchResult } from "./tooling/extensions/perception/ast-eyes.js";
import { FrontmatterParser, type FrontmatterResult } from "./tooling/extensions/perception/frontmatter-parser.js";
import { BoundedFilePeeker, type PeekFileResult } from "./tooling/extensions/perception/file-peeker.js";
import { CommandPathResolver } from "./tooling/extensions/permissions/command-path-resolver.js";
import { TerminalTextSanitizer } from "./tooling/extensions/telemetry/text-sanitizer.js";
import { MicrosecondTimingBuffer, type TimingMeasurement } from "./tooling/extensions/telemetry/timing-buffer.js";
import { TabSpacingNormalizer } from "./tooling/extensions/hashline/tab-spacing-normalizer.js";
import { ToolCallSchemaValidator, type ValidationResult } from "./tooling/extensions/registry/tool-call-schema-validator.js";
import { ArgumentCoercer } from "./tooling/extensions/registry/argument-coercer.js";
import { BatchEditAnchorer, type BatchEditTask } from "./tooling/extensions/hashline/batch-edit-anchorer.js";
import { DiffSynthesizer } from "./tooling/extensions/hashline/diff-synthesizer.js";
import { MasterBenchmarkOrchestrator, type GrandBenchmarkResult } from "./tooling/extensions/evals/master-benchmark-orchestrator.js";
import { RuntimeSmokeSuite, type RuntimeSmokeReport } from "./tooling/extensions/evals/runtime-smoke-suite.js";
import { LiveBaselineReporter } from "./tooling/extensions/evals/live-baseline-reporter.js";
import { FlappyBirdProjectBenchmark } from "./tooling/extensions/evals/flappy-bird-project-benchmark.js";
import { ArchitectureGuardrailGate } from "./tooling/extensions/policy/architecture-guardrail-gate.js";
import { McpHub, type McpServerConfig, type McpDiscoveredTool } from "./tooling/extensions/mcp/mcp-hub.js";
import { RipgrepSearchService, type RipgrepMatch } from "./tooling/extensions/perception/ripgrep-search-service.js";
import { UrlContentFetcher } from "./tooling/extensions/perception/url-content-fetcher.js";
import { LanguageSyntaxParser, type SyntaxSymbol } from "./tooling/extensions/perception/language-syntax-parser.js";
import {
  RoadmapCompletionGate,
  AttemptCompletionGateStrategy,
  type GateCriteria,
  type CompletionGateResult,
  type AttemptGateEvaluationContext,
  type DynamicGateCriteria,
  type CriterionEvaluatorFn,
  type AttemptGateStrategyConfig,
  type AutonomousAttemptExecutionResult,
} from "./tooling/extensions/policy/roadmap-completion-gate.js";
import { RoadmapCheckpointDigest, type CheckpointDigest } from "./tooling/extensions/policy/roadmap-checkpoint-digest.js";
import { NativeClipboardBridge } from "./tooling/extensions/perception/native-clipboard.js";
import { AnchoredHands, Hands } from "./tooling/extensions/hashline/hands.js";
import { CommandPermissionController, type PermissionValidationResult } from "./tooling/extensions/permissions/command-permission-controller.js";
import { ProcessLifecycleManager, type ProcessHandle } from "./tooling/extensions/permissions/process-lifecycle-manager.js";
import { KeybindingsController, type KeybindingBinding } from "./tooling/extensions/permissions/keybindings-controller.js";
import { ProtocolEars, Ears } from "./tooling/extensions/telemetry/ears.js";
import { ProgressStreamingEars, TerminalProgressRenderer } from "./tooling/extensions/progress/progress-ears.js";
import { SkillsIngestor } from "./tooling/extensions/registry/skills-ingestor.js";
import { ValidatingToolRegistry, ToolRegistry } from "./tooling/extensions/registry/tool-registry.js";
import { ModuleDecomposer } from "./tooling/extensions/policy/module-decomposer.js";
import { MonolithGatewayServer } from "./tooling/extensions/gateway/monolith-gateway-server.js";
import { MonolithBenchmarkEvaluator } from "./tooling/extensions/evals/benchmark-evaluator.js";
import { TelemetryTracer, type ActiveSpan } from "./tooling/extensions/telemetry/telemetry-tracer.js";
import { AgenticCommitGenerator, type ConventionalCommitResult } from "./tooling/extensions/policy/agentic-commit-generator.js";
import { StreamEventFormatter, type StreamChunkEvent } from "./tooling/extensions/telemetry/stream-event-formatter.js";
import { TransportConnectionController, type ConnectionHealth } from "./tooling/extensions/gateway/transport-connection-controller.js";
import { ResilientFetchClient, type FetchResult } from "./tooling/extensions/telemetry/resilient-fetch-client.js";
import { StderrGuardFilter, type SuppressionStats } from "./tooling/extensions/telemetry/stderr-guard.js";
import { TTSRCoordinator, type TTSRMeasurement } from "./tooling/extensions/telemetry/ttsr-coordinator.js";
import { CentennialPassMarker, type CentennialMilestone } from "./tooling/extensions/policy/centennial-pass-marker.js";

import { DeterministicSkillTreeParser } from "./tooling/extensions/skills/deterministic-skill-tree-parser.js";
import { AnchoredSkillMutator } from "./tooling/extensions/skills/anchored-skill-mutator.js";
import { SkillTreeToolSuite } from "./tooling/extensions/skills/skill-tree-tool-suite.js";
import { BroccoliSkillTreeSubstrate } from "./sessions/extensions/skills/broccoli-skill-tree-substrate.js";
import { SkillTreeSnapshotManager } from "./sessions/extensions/skills/skill-tree-snapshot-manager.js";
import { DeterministicSkillCurator } from "./sessions/extensions/skills/deterministic-skill-curator.js";
import { EvolutionarySkillTreeEngine } from "./agents/extensions/skills/evolutionary-skill-tree-engine.js";
import { SkillTreePromptComposer } from "./agents/extensions/skills/skill-tree-prompt-composer.js";
import { AntiDegenerationGuard } from "./agents/extensions/skills/anti-degeneration-guard.js";
import { SkillStrategyEngine } from "./agents/extensions/skills/skill-strategy-engine.js";

import { DeterministicSoulParser } from "./tooling/extensions/soul/deterministic-soul-parser.js";
import { AnchoredSoulMutator } from "./tooling/extensions/soul/anchored-soul-mutator.js";
import { SoulToolSuite } from "./tooling/extensions/soul/soul-tool-suite.js";
import { BroccoliSoulSubstrate } from "./sessions/extensions/soul/broccoli-soul-substrate.js";
import { SoulSnapshotManager } from "./sessions/extensions/soul/soul-snapshot-manager.js";
import { SoulThreatGuard } from "./agents/extensions/soul/soul-threat-guard.js";
import { SoulPromptComposer } from "./agents/extensions/soul/soul-prompt-composer.js";

import { AnchoredWorktreeManager } from "./tooling/extensions/delegation/anchored-worktree-manager.js";
import { SwarmToolSuite } from "./tooling/extensions/delegation/swarm-tool-suite.js";
import { SubagentVfsBrancher } from "./sessions/extensions/delegation/subagent-vfs-brancher.js";
import { SubagentBudgetGovernor } from "./sessions/extensions/delegation/subagent-budget-governor.js";
import { SubagentLifecycleGuard } from "./agents/extensions/delegation/subagent-lifecycle-guard.js";
import { MonolithSwarmDelegator } from "./agents/extensions/delegation/monolith-swarm-delegator.js";

import { DeterministicBlueprintCatalog } from "./tooling/extensions/cron/deterministic-blueprint-catalog.js";
import { AnchoredCronJobManager } from "./tooling/extensions/cron/anchored-cron-job-manager.js";
import { CronToolSuite } from "./tooling/extensions/cron/cron-tool-suite.js";
import { BroccoliCronSubstrate } from "./sessions/extensions/cron/broccoli-cron-substrate.js";
import { CronSnapshotManager } from "./sessions/extensions/cron/cron-snapshot-manager.js";
import { CronLifecycleGuard } from "./agents/extensions/cron/cron-lifecycle-guard.js";
import { MonolithCronScheduler } from "./agents/extensions/cron/monolith-cron-scheduler.js";

import { CdpNavigationGuard } from "./agents/extensions/cdp/cdp-navigation-guard.js";
import { CdpDialogPolicyEngine } from "./agents/extensions/cdp/cdp-dialog-policy-engine.js";
import { CdpDomSnapshotter } from "./tooling/extensions/cdp/cdp-dom-snapshotter.js";
import { CdpProtocolClient } from "./tooling/extensions/cdp/cdp-protocol-client.js";
import { BroccoliBrowserSubstrate } from "./sessions/extensions/cdp/broccoli-browser-substrate.js";
import { BrowserSnapshotManager } from "./sessions/extensions/cdp/browser-snapshot-manager.js";
import { CdpSupervisorEngine } from "./agents/extensions/cdp/cdp-supervisor-engine.js";
import { CdpToolSuite } from "./tooling/extensions/cdp/cdp-tool-suite.js";

import { DeterministicCredentialPool } from "./tooling/extensions/credential/deterministic-credential-pool.js";
import { CredentialToolSuite } from "./tooling/extensions/credential/credential-tool-suite.js";
import { BroccoliCredentialSubstrate } from "./sessions/extensions/credential/broccoli-credential-substrate.js";
import { CredentialSnapshotManager } from "./sessions/extensions/credential/credential-snapshot-manager.js";
import { CredentialCircuitBreaker } from "./agents/extensions/credential/credential-circuit-breaker.js";
import { MonolithCredentialManager } from "./agents/extensions/credential/monolith-credential-manager.js";

import { TelegramProtocolAdapter } from "./tooling/extensions/gateway/platform-adapters/telegram-protocol-adapter.js";
import { DiscordProtocolAdapter } from "./tooling/extensions/gateway/platform-adapters/discord-protocol-adapter.js";
import { SlackProtocolAdapter } from "./tooling/extensions/gateway/platform-adapters/slack-protocol-adapter.js";
import { WebhookProtocolAdapter } from "./tooling/extensions/gateway/platform-adapters/webhook-protocol-adapter.js";
import { GatewayToolSuite } from "./tooling/extensions/gateway/gateway-tool-suite.js";
import { GatewayDeliveryLedger } from "./sessions/extensions/gateway/gateway-delivery-ledger.js";
import { BroccoliGatewaySubstrate } from "./sessions/extensions/gateway/broccoli-gateway-substrate.js";
import { GatewaySnapshotManager } from "./sessions/extensions/gateway/gateway-snapshot-manager.js";
import { GatewayDispatcherEngine } from "./agents/extensions/gateway/gateway-dispatcher-engine.js";
import { DeterministicGatewayEngine } from "./tooling/extensions/gateway/deterministic-gateway-engine.js";
import { GatewaySupervisor } from "./agents/extensions/gateway/gateway-supervisor.js";
import { BroccoliIntegrationsSubstrate } from "./sessions/extensions/integrations/broccoli-integrations-substrate.js";
import { IntegrationsSnapshotManager } from "./sessions/extensions/integrations/integrations-snapshot-manager.js";
import { DeterministicIntegrationsEngine } from "./tooling/extensions/integrations/deterministic-integrations-engine.js";
import { IntegrationsSupervisor } from "./agents/extensions/integrations/integrations-supervisor.js";
import { IntegrationsToolSuite } from "./tooling/extensions/integrations/integrations-tool-suite.js";

import { HeadTailBudgetGovernor } from "./tooling/extensions/compaction/head-tail-budget-governor.js";
import { DeterministicToolPruner } from "./tooling/extensions/compaction/deterministic-tool-pruner.js";
import { BroccoliCompressionSubstrate } from "./sessions/extensions/compaction/broccoli-compression-substrate.js";
import { CompressionSnapshotManager } from "./sessions/extensions/compaction/compression-snapshot-manager.js";
import { TrajectoryCompactorEngine } from "./agents/extensions/compaction/trajectory-compactor-engine.js";
import { ContextCompressionSupervisor } from "./agents/extensions/compaction/context-compression-supervisor.js";
import { CompressionToolSuite } from "./tooling/extensions/compaction/compression-tool-suite.js";

import { FtsQuerySanitizer } from "./tooling/extensions/search/fts-query-sanitizer.js";
import { BroccoliSearchSubstrate } from "./sessions/extensions/search/broccoli-search-substrate.js";
import { SearchSnapshotManager } from "./sessions/extensions/search/search-snapshot-manager.js";
import { DeterministicSessionSearchEngine } from "./tooling/extensions/search/deterministic-session-search-engine.js";
import { SearchToolSuite } from "./tooling/extensions/search/search-tool-suite.js";

import { SecretScrubber } from "./tooling/extensions/environments/secret-scrubber.js";
import { LocalEnvironmentAdapter } from "./tooling/extensions/environments/local-environment-adapter.js";
import { DockerEnvironmentAdapter } from "./tooling/extensions/environments/docker-environment-adapter.js";
import { BroccoliEnvironmentSubstrate } from "./sessions/extensions/environments/broccoli-environment-substrate.js";
import { EnvironmentSnapshotManager } from "./sessions/extensions/environments/environment-snapshot-manager.js";
import { EnvironmentSupervisorEngine } from "./agents/extensions/environments/environment-supervisor-engine.js";
import { EnvironmentToolSuite } from "./tooling/extensions/environments/environment-tool-suite.js";

import { JitteredBackoffGovernor } from "./tooling/extensions/faults/jittered-backoff-governor.js";
import { DeterministicErrorClassifier } from "./tooling/extensions/faults/deterministic-error-classifier.js";
import { BroccoliFaultSubstrate } from "./sessions/extensions/faults/broccoli-fault-substrate.js";
import { FaultSnapshotManager } from "./sessions/extensions/faults/fault-snapshot-manager.js";
import { FaultRecoverySupervisor } from "./agents/extensions/faults/fault-recovery-supervisor.js";
import { FaultDiagnosticToolSuite } from "./tooling/extensions/faults/fault-diagnostic-tool-suite.js";

import { AcpProtocolCodec } from "./tooling/extensions/acp/acp-protocol-codec.js";
import { AcpPermissionGate } from "./tooling/extensions/acp/acp-permission-gate.js";
import { BroccoliAcpSubstrate } from "./sessions/extensions/acp/broccoli-acp-substrate.js";
import { AcpSnapshotManager } from "./sessions/extensions/acp/acp-snapshot-manager.js";
import { AcpBridgeServer } from "./agents/extensions/acp/acp-bridge-server.js";
import { AcpToolSuite } from "./tooling/extensions/acp/acp-tool-suite.js";

import { McpTransportCodec } from "./tooling/extensions/mcp/mcp-transport-codec.js";
import { McpSecurityScrubber } from "./tooling/extensions/mcp/mcp-security-scrubber.js";
import { BroccoliMcpSubstrate } from "./sessions/extensions/mcp/broccoli-mcp-substrate.js";
import { McpSnapshotManager } from "./sessions/extensions/mcp/mcp-snapshot-manager.js";
import { McpSupervisorEngine } from "./agents/extensions/mcp/mcp-supervisor-engine.js";
import { McpClientToolSuite } from "./tooling/extensions/mcp/mcp-client-tool-suite.js";

import { ProcessOutputRingBuffer } from "./tooling/extensions/process/process-output-ring-buffer.js";
import { ProcessSecuritySandbox } from "./tooling/extensions/process/process-security-sandbox.js";
import { BroccoliProcessSubstrate } from "./sessions/extensions/process/broccoli-process-substrate.js";
import { ProcessSnapshotManager } from "./sessions/extensions/process/process-snapshot-manager.js";
import { ProcessSupervisorEngine } from "./agents/extensions/process/process-supervisor-engine.js";
import { ProcessToolSuite } from "./tooling/extensions/process/process-tool-suite.js";

import { SecurityRiskClassifier } from "./tooling/extensions/arbiter/security-risk-classifier.js";
import { ApprovalHashLedger } from "./tooling/extensions/arbiter/approval-hash-ledger.js";
import { BroccoliArbiterSubstrate } from "./sessions/extensions/arbiter/broccoli-arbiter-substrate.js";
import { ArbiterSnapshotManager } from "./sessions/extensions/arbiter/arbiter-snapshot-manager.js";
import { InteractiveSecurityArbiter } from "./agents/extensions/arbiter/interactive-security-arbiter.js";
import { ArbiterToolSuite } from "./tooling/extensions/arbiter/arbiter-tool-suite.js";

import { SemanticKnowledgeGraph } from "./sessions/extensions/memory/semantic-knowledge-graph.js";
import { BroccoliLearningSubstrate } from "./sessions/extensions/memory/broccoli-learning-substrate.js";
import { LearningSnapshotManager } from "./sessions/extensions/memory/learning-snapshot-manager.js";
import { ContinuousLearningCurator } from "./agents/extensions/memory/continuous-learning-curator.js";
import { LearningCuratorToolSuite } from "./tooling/extensions/memory/learning-curator-tool-suite.js";

import { DeterministicPatchEngine } from "./tooling/extensions/patch/deterministic-patch-engine.js";
import { BroccoliPatchSubstrate } from "./sessions/extensions/patch/broccoli-patch-substrate.js";
import { PatchSnapshotManager } from "./sessions/extensions/patch/patch-snapshot-manager.js";
import { AtomicMutationSupervisor } from "./agents/extensions/patch/atomic-mutation-supervisor.js";
import { FileMutationToolSuite } from "./tooling/extensions/patch/file-mutation-tool-suite.js";

import { DeterministicLspEngine } from "./tooling/extensions/lsp/deterministic-lsp-engine.js";
import { BroccoliLspSubstrate } from "./sessions/extensions/lsp/broccoli-lsp-substrate.js";
import { LspSnapshotManager } from "./sessions/extensions/lsp/lsp-snapshot-manager.js";
import { SemanticCodeSupervisor } from "./agents/extensions/lsp/semantic-code-supervisor.js";
import { LspCodeIntelligenceToolSuite } from "./tooling/extensions/lsp/lsp-code-intelligence-tool-suite.js";

import { DeterministicAudioCodec } from "./tooling/extensions/voice/deterministic-audio-codec.js";
import { BroccoliVoiceSubstrate } from "./sessions/extensions/voice/broccoli-voice-substrate.js";
import { VoiceSnapshotManager } from "./sessions/extensions/voice/voice-snapshot-manager.js";
import { VoiceSpeechSupervisor } from "./agents/extensions/voice/voice-speech-supervisor.js";
import { VoiceSpeechToolSuite } from "./tooling/extensions/voice/voice-speech-tool-suite.js";

import { DeterministicImageCodec } from "./tooling/extensions/vision/deterministic-image-codec.js";
import { BroccoliVisionSubstrate } from "./sessions/extensions/vision/broccoli-vision-substrate.js";
import { VisionSnapshotManager } from "./sessions/extensions/vision/vision-snapshot-manager.js";
import { MultimodalVisionSupervisor } from "./agents/extensions/vision/multimodal-vision-supervisor.js";
import { MultimodalVisionToolSuite } from "./tooling/extensions/vision/multimodal-vision-tool-suite.js";

import { DeterministicKanbanEngine } from "./tooling/extensions/kanban/deterministic-kanban-engine.js";
import { BroccoliKanbanSubstrate } from "./sessions/extensions/kanban/broccoli-kanban-substrate.js";
import { KanbanSnapshotManager } from "./sessions/extensions/kanban/kanban-snapshot-manager.js";
import { KanbanBoardSupervisor } from "./agents/extensions/kanban/kanban-board-supervisor.js";
import { KanbanOrchestrationToolSuite } from "./tooling/extensions/kanban/kanban-orchestration-tool-suite.js";

import { DeterministicWebEngine } from "./tooling/extensions/web/deterministic-web-engine.js";
import { BroccoliWebSubstrate } from "./sessions/extensions/web/broccoli-web-substrate.js";
import { WebSnapshotManager } from "./sessions/extensions/web/web-snapshot-manager.js";
import { WebIntelligenceSupervisor } from "./agents/extensions/web/web-intelligence-supervisor.js";
import { WebIntelligenceToolSuite } from "./tooling/extensions/web/web-intelligence-tool-suite.js";

import { DeterministicCodeExecutor } from "./tooling/extensions/execution/deterministic-code-executor.js";
import { BroccoliExecutionSubstrate } from "./sessions/extensions/execution/broccoli-execution-substrate.js";
import { ExecutionSnapshotManager } from "./sessions/extensions/execution/execution-snapshot-manager.js";
import { CodeExecutionSupervisor } from "./agents/extensions/execution/code-execution-supervisor.js";
import { CodeExecutionToolSuite } from "./tooling/extensions/execution/code-execution-tool-suite.js";

import { DeterministicBatchEvaluator } from "./tooling/extensions/batch/deterministic-batch-evaluator.js";
import { BroccoliBatchSubstrate } from "./sessions/extensions/batch/broccoli-batch-substrate.js";
import { BatchSnapshotManager } from "./sessions/extensions/batch/batch-snapshot-manager.js";
import { BatchEvaluationSupervisor } from "./agents/extensions/batch/batch-evaluation-supervisor.js";
import { BatchEvaluationToolSuite } from "./tooling/extensions/batch/batch-evaluation-tool-suite.js";

import { DeterministicClarifyEngine } from "./tooling/extensions/clarify/deterministic-clarify-engine.js";
import { BroccoliClarifySubstrate } from "./sessions/extensions/clarify/broccoli-clarify-substrate.js";
import { ClarifySnapshotManager } from "./sessions/extensions/clarify/clarify-snapshot-manager.js";
import { ClarifyInquirySupervisor } from "./agents/extensions/clarify/clarify-inquiry-supervisor.js";
import { ClarifyInquiryToolSuite } from "./tooling/extensions/clarify/clarify-inquiry-tool-suite.js";

import { DeterministicThreatScanner } from "./tooling/extensions/threat/deterministic-threat-scanner.js";
import { BroccoliThreatSubstrate } from "./sessions/extensions/threat/broccoli-threat-substrate.js";
import { ThreatSnapshotManager } from "./sessions/extensions/threat/threat-snapshot-manager.js";
import { ThreatFirewallSupervisor } from "./agents/extensions/threat/threat-firewall-supervisor.js";
import { ThreatFirewallToolSuite } from "./tooling/extensions/threat/threat-firewall-tool-suite.js";

import { DeterministicCasStore } from "./tooling/extensions/checkpoint/deterministic-cas-store.js";
import { BroccoliCheckpointSubstrate } from "./sessions/extensions/checkpoint/broccoli-checkpoint-substrate.js";
import { CheckpointSnapshotManager } from "./sessions/extensions/checkpoint/checkpoint-snapshot-manager.js";
import { CheckpointKernelSupervisor } from "./agents/extensions/checkpoint/checkpoint-kernel-supervisor.js";
import { CheckpointKernelToolSuite } from "./tooling/extensions/checkpoint/checkpoint-kernel-tool-suite.js";

import { DeterministicDisplayDriver } from "./tooling/extensions/computer-use/deterministic-display-driver.js";
import { BroccoliDisplaySubstrate } from "./sessions/extensions/computer-use/broccoli-display-substrate.js";
import { DisplaySnapshotManager } from "./sessions/extensions/computer-use/display-snapshot-manager.js";
import { ComputerUseSupervisor } from "./agents/extensions/computer-use/computer-use-supervisor.js";
import { ComputerUseToolSuite } from "./tooling/extensions/computer-use/computer-use-tool-suite.js";

import { DeterministicSkillsHub } from "./tooling/extensions/skills-hub/deterministic-skills-hub.js";
import { BroccoliSkillsHubSubstrate } from "./sessions/extensions/skills-hub/broccoli-skills-hub-substrate.js";
import { SkillsHubSnapshotManager } from "./sessions/extensions/skills-hub/skills-hub-snapshot-manager.js";
import { SkillsHubSupervisor } from "./agents/extensions/skills-hub/skills-hub-supervisor.js";
import { SkillsHubToolSuite } from "./tooling/extensions/skills-hub/skills-hub-tool-suite.js";

import { DeterministicCostGovernor } from "./tooling/extensions/cost/deterministic-cost-governor.js";
import { BroccoliCostSubstrate } from "./sessions/extensions/cost/broccoli-cost-substrate.js";
import { CostSnapshotManager } from "./sessions/extensions/cost/cost-snapshot-manager.js";
import { CostGovernanceSupervisor } from "./agents/extensions/cost/cost-governance-supervisor.js";
import { CostGovernanceToolSuite } from "./tooling/extensions/cost/cost-governance-tool-suite.js";

import { DeterministicToolDiscloser } from "./tooling/extensions/disclosure/deterministic-tool-discloser.js";
import { BroccoliDisclosureSubstrate } from "./sessions/extensions/disclosure/broccoli-disclosure-substrate.js";
import { ToolDisclosureSnapshotManager } from "./sessions/extensions/disclosure/disclosure-snapshot-manager.js";
import { ToolDisclosureSupervisor } from "./agents/extensions/disclosure/tool-disclosure-supervisor.js";
import { ToolDisclosureToolSuite } from "./tooling/extensions/disclosure/tool-disclosure-tool-suite.js";

import { DeterministicEvidenceLedger } from "./tooling/extensions/evidence/deterministic-evidence-ledger.js";
import { BroccoliEvidenceSubstrate } from "./sessions/extensions/evidence/broccoli-evidence-substrate.js";
import { EvidenceSnapshotManager } from "./sessions/extensions/evidence/evidence-snapshot-manager.js";
import { VerificationEvidenceSupervisor } from "./agents/extensions/evidence/verification-evidence-supervisor.js";
import { VerificationEvidenceToolSuite } from "./tooling/extensions/evidence/verification-evidence-tool-suite.js";

import { DeterministicPromptCacher } from "./tooling/extensions/prompt/deterministic-prompt-cacher.js";
import { BroccoliPromptCacheSubstrate } from "./sessions/extensions/prompt/broccoli-prompt-cache-substrate.js";
import { PromptCacheSnapshotManager } from "./sessions/extensions/prompt/prompt-cache-snapshot-manager.js";
import { PromptCacheSupervisor } from "./agents/extensions/prompt/prompt-cache-supervisor.js";
import { PromptCacheToolSuite } from "./tooling/extensions/prompt/prompt-cache-tool-suite.js";

import { DeterministicToolSegmenter } from "./tooling/extensions/execution_guard/deterministic-tool-segmenter.js";
import { BroccoliExecutionGuardSubstrate } from "./sessions/extensions/execution_guard/broccoli-execution-guard-substrate.js";
import { ExecutionGuardSnapshotManager } from "./sessions/extensions/execution_guard/execution-guard-snapshot-manager.js";
import { ToolExecutionGuardSupervisor } from "./agents/extensions/execution_guard/tool-execution-guard-supervisor.js";
import { ToolExecutionGuardToolSuite } from "./tooling/extensions/execution_guard/tool-execution-guard-tool-suite.js";

import { DeterministicSecretRedactor } from "./tooling/extensions/redaction/deterministic-secret-redactor.js";
import { BroccoliRedactionSubstrate } from "./sessions/extensions/redaction/broccoli-redaction-substrate.js";
import { RedactionSnapshotManager } from "./sessions/extensions/redaction/redaction-snapshot-manager.js";
import { SecretRedactionSupervisor } from "./agents/extensions/redaction/secret-redaction-supervisor.js";
import { SecretRedactionToolSuite } from "./tooling/extensions/redaction/secret-redaction-tool-suite.js";

import { DeterministicReviewEvaluator } from "./tooling/extensions/review/deterministic-review-evaluator.js";
import { BroccoliReviewSubstrate } from "./sessions/extensions/review/broccoli-review-substrate.js";
import { ReviewSnapshotManager } from "./sessions/extensions/review/review-snapshot-manager.js";
import { BackgroundReviewSupervisor } from "./agents/extensions/review/background-review-supervisor.js";
import { BackgroundReviewToolSuite } from "./tooling/extensions/review/background-review-tool-suite.js";

import { DeterministicDiagnosticDoctor } from "./tooling/extensions/doctor/deterministic-diagnostic-doctor.js";
import { BroccoliDoctorSubstrate } from "./sessions/extensions/doctor/broccoli-doctor-substrate.js";
import { DoctorSnapshotManager } from "./sessions/extensions/doctor/doctor-snapshot-manager.js";
import { DiagnosticDoctorSupervisor } from "./agents/extensions/doctor/diagnostic-doctor-supervisor.js";
import { DiagnosticDoctorToolSuite } from "./tooling/extensions/doctor/diagnostic-doctor-tool-suite.js";

import { DeterministicAuthFederator } from "./tooling/extensions/auth/deterministic-auth-federator.js";
import { BroccoliAuthSubstrate } from "./sessions/extensions/auth/broccoli-auth-substrate.js";
import { AuthSnapshotManager } from "./sessions/extensions/auth/auth-snapshot-manager.js";
import { IdentityFederationSupervisor } from "./agents/extensions/auth/identity-federation-supervisor.js";
import { IdentityFederationToolSuite } from "./tooling/extensions/auth/identity-federation-tool-suite.js";

import { DeterministicSessionArchiver } from "./tooling/extensions/archive/deterministic-session-archiver.js";
import { BroccoliArchiveSubstrate } from "./sessions/extensions/archive/broccoli-archive-substrate.js";
import { ArchiveSnapshotManager } from "./sessions/extensions/archive/archive-snapshot-manager.js";
import { SessionArchiveSupervisor } from "./agents/extensions/archive/session-archive-supervisor.js";
import { SessionArchiveToolSuite } from "./tooling/extensions/archive/session-archive-tool-suite.js";

import { DeterministicSkinEngine } from "./tooling/extensions/skin/deterministic-skin-engine.js";
import { BroccoliSkinSubstrate } from "./sessions/extensions/skin/broccoli-skin-substrate.js";
import { SkinSnapshotManager } from "./sessions/extensions/skin/skin-snapshot-manager.js";
import { TerminalSkinSupervisor } from "./agents/extensions/skin/terminal-skin-supervisor.js";
import { TerminalSkinToolSuite } from "./tooling/extensions/skin/terminal-skin-tool-suite.js";

import { DeterministicAuxiliaryRouter } from "./tooling/extensions/router/deterministic-auxiliary-router.js";
import { BroccoliAuxiliarySubstrate } from "./sessions/extensions/router/broccoli-auxiliary-substrate.js";
import { AuxiliarySnapshotManager } from "./sessions/extensions/router/auxiliary-snapshot-manager.js";
import { AuxiliaryRouterSupervisor } from "./agents/extensions/router/auxiliary-router-supervisor.js";
import { AuxiliaryRouterToolSuite } from "./tooling/extensions/router/auxiliary-router-tool-suite.js";

import { DeterministicReasoningScrubber } from "./tooling/extensions/reasoning/deterministic-reasoning-scrubber.js";
import { BroccoliReasoningSubstrate } from "./sessions/extensions/reasoning/broccoli-reasoning-substrate.js";
import { ReasoningSnapshotManager } from "./sessions/extensions/reasoning/reasoning-snapshot-manager.js";
import { ReasoningSupervisor } from "./agents/extensions/reasoning/reasoning-supervisor.js";
import { ReasoningToolSuite } from "./tooling/extensions/reasoning/reasoning-tool-suite.js";

import { DeterministicFuzzyMatcher } from "./tooling/extensions/fuzzy/deterministic-fuzzy-matcher.js";
import { BroccoliFuzzySubstrate } from "./sessions/extensions/fuzzy/broccoli-fuzzy-substrate.js";
import { FuzzySnapshotManager } from "./sessions/extensions/fuzzy/fuzzy-snapshot-manager.js";
import { FuzzyMatcherSupervisor } from "./agents/extensions/fuzzy/fuzzy-matcher-supervisor.js";
import { FuzzyMatcherToolSuite } from "./tooling/extensions/fuzzy/fuzzy-matcher-tool-suite.js";

import { DeterministicTitleGenerator } from "./agents/extensions/title_insights/deterministic-title-generator.js";
import { ConversationInsightsEngine } from "./agents/extensions/title_insights/conversation-insights-engine.js";
import { TitleInsightsSupervisor } from "./agents/extensions/title_insights/title-insights-supervisor.js";
import { BroccoliTitleInsightsSubstrate } from "./sessions/extensions/title_insights/broccoli-title-insights-substrate.js";
import { TitleInsightsSnapshotManager } from "./sessions/extensions/title_insights/title-insights-snapshot-manager.js";
import { TitleInsightsToolSuite } from "./tooling/extensions/title_insights/title-insights-tool-suite.js";

import { DeterministicHeredocSanitizer } from "./agents/extensions/heredoc_terminal/deterministic-heredoc-sanitizer.js";
import { TerminalDiagnosticsEngine } from "./agents/extensions/heredoc_terminal/terminal-diagnostics-engine.js";
import { HeredocTerminalSupervisor } from "./agents/extensions/heredoc_terminal/heredoc-terminal-supervisor.js";
import { BroccoliHeredocTerminalSubstrate } from "./sessions/extensions/heredoc_terminal/broccoli-heredoc-terminal-substrate.js";
import { HeredocTerminalSnapshotManager } from "./sessions/extensions/heredoc_terminal/heredoc-terminal-snapshot-manager.js";
import { HeredocTerminalToolSuite } from "./tooling/extensions/heredoc_terminal/heredoc-terminal-tool-suite.js";

import { DeterministicStealthBrowser } from "./agents/extensions/stealth_browser/deterministic-stealth-browser.js";
import { StealthBrowserSupervisor } from "./agents/extensions/stealth_browser/stealth-browser-supervisor.js";
import { BroccoliStealthBrowserSubstrate } from "./sessions/extensions/stealth_browser/broccoli-stealth-browser-substrate.js";
import { StealthBrowserSnapshotManager } from "./sessions/extensions/stealth_browser/stealth-browser-snapshot-manager.js";
import { StealthBrowserToolSuite } from "./tooling/extensions/stealth_browser/stealth-browser-tool-suite.js";

import { DeterministicSkillsSyncClient } from "./agents/extensions/skills_sync/deterministic-skills-sync-client.js";
import { SkillsSyncSupervisor } from "./agents/extensions/skills_sync/skills-sync-supervisor.js";
import { BroccoliSkillsSyncSubstrate } from "./sessions/extensions/skills_sync/broccoli-skills-sync-substrate.js";
import { SkillsSyncSnapshotManager } from "./sessions/extensions/skills_sync/skills-sync-snapshot-manager.js";
import { SkillsSyncToolSuite } from "./tooling/extensions/skills_sync/skills-sync-tool-suite.js";

import { DeterministicPreflightScanner } from "./agents/extensions/preflight_scanner/deterministic-preflight-scanner.js";
import { PreflightScannerSupervisor } from "./agents/extensions/preflight_scanner/preflight-scanner-supervisor.js";
import { BroccoliPreflightSubstrate } from "./sessions/extensions/preflight_scanner/broccoli-preflight-substrate.js";
import { PreflightSnapshotManager } from "./sessions/extensions/preflight_scanner/preflight-snapshot-manager.js";
import { PreflightToolSuite } from "./tooling/extensions/preflight_scanner/preflight-tool-suite.js";

import { DeterministicAudioSniffer } from "./agents/extensions/audio_container/deterministic-audio-sniffer.js";
import { AudioContainerSupervisor } from "./agents/extensions/audio_container/audio-container-supervisor.js";
import { BroccoliAudioContainerSubstrate } from "./sessions/extensions/audio_container/broccoli-audio-container-substrate.js";
import { AudioContainerSnapshotManager } from "./sessions/extensions/audio_container/audio-container-snapshot-manager.js";
import { AudioContainerToolSuite } from "./tooling/extensions/audio_container/audio-container-tool-suite.js";

import { DeterministicSpeechTextNormalizer } from "./agents/extensions/speech_normalizer/deterministic-speech-text-normalizer.js";
import { SpeechNormalizerSupervisor } from "./agents/extensions/speech_normalizer/speech-normalizer-supervisor.js";
import { BroccoliSpeechNormalizerSubstrate } from "./sessions/extensions/speech_normalizer/broccoli-speech-normalizer-substrate.js";
import { SpeechNormalizerSnapshotManager } from "./sessions/extensions/speech_normalizer/speech-normalizer-snapshot-manager.js";
import { SpeechNormalizerToolSuite } from "./tooling/extensions/speech_normalizer/speech-normalizer-tool-suite.js";

import { DeterministicDocExtractor } from "./agents/extensions/doc_extractor/deterministic-doc-extractor.js";
import { DocExtractorSupervisor } from "./agents/extensions/doc_extractor/doc-extractor-supervisor.js";
import { BroccoliDocExtractorSubstrate } from "./sessions/extensions/doc_extractor/broccoli-doc-extractor-substrate.js";
import { DocExtractorSnapshotManager } from "./sessions/extensions/doc_extractor/doc-extractor-snapshot-manager.js";
import { DocExtractorToolSuite } from "./tooling/extensions/doc_extractor/doc-extractor-tool-suite.js";

import { DeterministicSpillVault } from "./agents/extensions/spill_vault/deterministic-spill-vault.js";
import { SpillVaultSupervisor } from "./agents/extensions/spill_vault/spill-vault-supervisor.js";
import { BroccoliSpillVaultSubstrate } from "./sessions/extensions/spill_vault/broccoli-spill-vault-substrate.js";
import { SpillVaultSnapshotManager } from "./sessions/extensions/spill_vault/spill-vault-snapshot-manager.js";
import { SpillVaultToolSuite } from "./tooling/extensions/spill_vault/spill-vault-tool-suite.js";

import { DeterministicUrlSafety } from "./agents/extensions/url_safety/deterministic-url-safety.js";
import { UrlSafetySupervisor } from "./agents/extensions/url_safety/url-safety-supervisor.js";
import { BroccoliUrlSafetySubstrate } from "./sessions/extensions/url_safety/broccoli-url-safety-substrate.js";
import { UrlSafetySnapshotManager } from "./sessions/extensions/url_safety/url-safety-snapshot-manager.js";
import { UrlSafetyToolSuite } from "./tooling/extensions/url_safety/url-safety-tool-suite.js";
import { UrlSafetyDashboardModal } from "./tui/components/url-safety-dashboard-modal.js";

import { DeterministicV4aPatch } from "./agents/extensions/v4a_patch/deterministic-v4a-patch.js";
import { V4aPatchSupervisor } from "./agents/extensions/v4a_patch/v4a-patch-supervisor.js";
import { BroccoliV4aPatchSubstrate } from "./sessions/extensions/v4a_patch/broccoli-v4a-patch-substrate.js";
import { V4aPatchSnapshotManager } from "./sessions/extensions/v4a_patch/v4a-patch-snapshot-manager.js";
import { V4aPatchToolSuite } from "./tooling/extensions/v4a_patch/v4a-patch-tool-suite.js";

import { DeterministicWebsitePolicy } from "./agents/extensions/website_policy/deterministic-website-policy.js";
import { WebsitePolicySupervisor } from "./agents/extensions/website_policy/website-policy-supervisor.js";
import { BroccoliWebsitePolicySubstrate } from "./sessions/extensions/website_policy/broccoli-website-policy-substrate.js";
import { WebsitePolicySnapshotManager } from "./sessions/extensions/website_policy/website-policy-snapshot-manager.js";
import { WebsitePolicyToolSuite } from "./tooling/extensions/website_policy/website-policy-tool-suite.js";

import { DeterministicWakeWord } from "./agents/extensions/wake_word/deterministic-wake-word.js";
import { WakeWordSupervisor } from "./agents/extensions/wake_word/wake-word-supervisor.js";
import { BroccoliWakeWordSubstrate } from "./sessions/extensions/wake_word/broccoli-wake-word-substrate.js";
import { WakeWordSnapshotManager } from "./sessions/extensions/wake_word/wake-word-snapshot-manager.js";
import { WakeWordToolSuite } from "./tooling/extensions/wake_word/wake-word-tool-suite.js";

import { DeterministicMediaResolver } from "./agents/extensions/media_source/deterministic-media-resolver.js";
import { MediaSourceSupervisor } from "./agents/extensions/media_source/media-source-supervisor.js";
import { BroccoliMediaSourceSubstrate } from "./sessions/extensions/media_source/broccoli-media-source-substrate.js";
import { MediaSourceSnapshotManager } from "./sessions/extensions/media_source/media-source-snapshot-manager.js";
import { MediaSourceToolSuite } from "./tooling/extensions/media_source/media-source-tool-suite.js";

import { DeterministicGitWorktree } from "./agents/extensions/worktree/deterministic-git-worktree.js";
import { WorktreeSupervisor } from "./agents/extensions/worktree/worktree-supervisor.js";
import { BroccoliWorktreeSubstrate } from "./sessions/extensions/worktree/broccoli-worktree-substrate.js";
import { WorktreeSnapshotManager } from "./sessions/extensions/worktree/worktree-snapshot-manager.js";
import { WorktreeToolSuite } from "./tooling/extensions/worktree/worktree-tool-suite.js";

import { DeterministicSpeechTranscriber } from "./agents/extensions/transcription/deterministic-speech-transcriber.js";
import { TranscriptionSupervisor } from "./agents/extensions/transcription/transcription-supervisor.js";
import { BroccoliTranscriptionSubstrate } from "./sessions/extensions/transcription/broccoli-transcription-substrate.js";
import { TranscriptionSnapshotManager } from "./sessions/extensions/transcription/transcription-snapshot-manager.js";
import { TranscriptionToolSuite } from "./tooling/extensions/transcription/transcription-tool-suite.js";

import { DeterministicDeadlineEngine } from "./agents/extensions/deadline/deterministic-deadline-engine.js";
import { DeadlineSupervisor } from "./agents/extensions/deadline/deadline-supervisor.js";
import { BroccoliDeadlineSubstrate } from "./sessions/extensions/deadline/broccoli-deadline-substrate.js";
import { DeadlineSnapshotManager } from "./sessions/extensions/deadline/deadline-snapshot-manager.js";
import { DeadlineToolSuite } from "./tooling/extensions/deadline/deadline-tool-suite.js";

import { DeterministicFileSafetyGuard } from "./agents/extensions/file_safety/deterministic-file-safety-guard.js";
import { FileSafetySupervisor } from "./agents/extensions/file_safety/file-safety-supervisor.js";
import { BroccoliFileSafetySubstrate } from "./sessions/extensions/file_safety/broccoli-file-safety-substrate.js";
import { FileSafetySnapshotManager } from "./sessions/extensions/file_safety/file-safety-snapshot-manager.js";
import { FileSafetyToolSuite } from "./tooling/extensions/file_safety/file-safety-tool-suite.js";

import { DeterministicContextBreakdownEngine } from "./agents/extensions/context_breakdown/deterministic-context-breakdown-engine.js";
import { ContextBreakdownSupervisor } from "./agents/extensions/context_breakdown/context-breakdown-supervisor.js";
import { BroccoliContextBreakdownSubstrate } from "./sessions/extensions/context_breakdown/broccoli-context-breakdown-substrate.js";
import { ContextBreakdownSnapshotManager } from "./sessions/extensions/context_breakdown/context-breakdown-snapshot-manager.js";
import { ContextBreakdownToolSuite } from "./tooling/extensions/context_breakdown/context-breakdown-tool-suite.js";

import { DeterministicOsvParser } from "./agents/extensions/osv/deterministic-osv-parser.js";
import { OsvScannerSupervisor } from "./agents/extensions/osv/osv-scanner-supervisor.js";
import { BroccoliOsvSubstrate } from "./sessions/extensions/osv/broccoli-osv-substrate.js";
import { OsvScannerSnapshotManager } from "./sessions/extensions/osv/osv-snapshot-manager.js";
import { OsvScannerToolSuite } from "./tooling/extensions/osv/osv-scanner-tool-suite.js";

import { DeterministicSubdirHintEngine } from "./agents/extensions/subdir_hints/deterministic-subdir-hint-engine.js";
import { SubdirHintsSupervisor } from "./agents/extensions/subdir_hints/subdir-hints-supervisor.js";
import { BroccoliSubdirHintsSubstrate } from "./sessions/extensions/subdir_hints/broccoli-subdir-hints-substrate.js";
import { SubdirHintsSnapshotManager } from "./sessions/extensions/subdir_hints/subdir-hints-snapshot-manager.js";
import { SubdirHintsToolSuite } from "./tooling/extensions/subdir_hints/subdir-hints-tool-suite.js";

import { DeterministicStreamDiagEngine } from "./agents/extensions/stream_diag/deterministic-stream-diag-engine.js";
import { StreamDiagSupervisor } from "./agents/extensions/stream_diag/stream-diag-supervisor.js";
import { BroccoliStreamDiagSubstrate } from "./sessions/extensions/stream_diag/broccoli-stream-diag-substrate.js";
import { StreamDiagSnapshotManager } from "./sessions/extensions/stream_diag/stream-diag-snapshot-manager.js";
import { StreamDiagToolSuite } from "./tooling/extensions/stream_diag/stream-diag-tool-suite.js";

import { DeterministicTurnRetryEngine } from "./agents/extensions/turn_retry/deterministic-turn-retry-engine.js";
import { TurnRetrySupervisor } from "./agents/extensions/turn_retry/turn-retry-supervisor.js";
import { BroccoliTurnRetrySubstrate } from "./sessions/extensions/turn_retry/broccoli-turn-retry-substrate.js";
import { TurnRetrySnapshotManager } from "./sessions/extensions/turn_retry/turn-retry-snapshot-manager.js";
import { TurnRetryToolSuite } from "./tooling/extensions/turn_retry/turn-retry-tool-suite.js";

import { DeterministicBillingUsageEngine } from "./agents/extensions/billing_usage/deterministic-billing-usage-engine.js";
import { BillingUsageSupervisor } from "./agents/extensions/billing_usage/billing-usage-supervisor.js";
import { BroccoliBillingUsageSubstrate } from "./sessions/extensions/billing_usage/broccoli-billing-usage-substrate.js";
import { BillingUsageSnapshotManager } from "./sessions/extensions/billing_usage/billing-usage-snapshot-manager.js";
import { BillingUsageToolSuite } from "./tooling/extensions/billing_usage/billing-usage-tool-suite.js";

import { DeterministicThreadContextEngine } from "./agents/extensions/thread_context/deterministic-thread-context-engine.js";
import { ThreadContextSupervisor } from "./agents/extensions/thread_context/thread-context-supervisor.js";
import { BroccoliThreadContextSubstrate } from "./sessions/extensions/thread_context/broccoli-thread-context-substrate.js";
import { ThreadContextSnapshotManager } from "./sessions/extensions/thread_context/thread-context-snapshot-manager.js";
import { ThreadContextToolSuite } from "./tooling/extensions/thread_context/thread-context-tool-suite.js";

import { DeterministicEnvProbeEngine } from "./agents/extensions/env_probe/deterministic-env-probe-engine.js";
import { EnvProbeSupervisor } from "./agents/extensions/env_probe/env-probe-supervisor.js";
import { BroccoliEnvProbeSubstrate } from "./sessions/extensions/env_probe/broccoli-env-probe-substrate.js";
import { EnvProbeSnapshotManager } from "./sessions/extensions/env_probe/env-probe-snapshot-manager.js";
import { EnvProbeToolSuite } from "./tooling/extensions/env_probe/env-probe-tool-suite.js";

import { DeterministicSkillLinterEngine } from "./agents/extensions/skill_linter/deterministic-skill-linter-engine.js";
import { SkillLinterSupervisor } from "./agents/extensions/skill_linter/skill-linter-supervisor.js";
import { BroccoliSkillLinterSubstrate } from "./sessions/extensions/skill_linter/broccoli-skill-linter-substrate.js";
import { SkillLinterSnapshotManager } from "./sessions/extensions/skill_linter/skill-linter-snapshot-manager.js";
import { SkillLinterToolSuite } from "./tooling/extensions/skill_linter/skill-linter-tool-suite.js";

import { DeterministicTerminalCleanerEngine } from "./agents/extensions/terminal_cleaner/deterministic-terminal-cleaner-engine.js";
import { TerminalCleanerSupervisor } from "./agents/extensions/terminal_cleaner/terminal-cleaner-supervisor.js";
import { BroccoliTerminalCleanerSubstrate } from "./sessions/extensions/terminal_cleaner/broccoli-terminal-cleaner-substrate.js";
import { TerminalCleanerSnapshotManager } from "./sessions/extensions/terminal_cleaner/terminal-cleaner-snapshot-manager.js";
import { TerminalCleanerToolSuite } from "./tooling/extensions/terminal_cleaner/terminal-cleaner-tool-suite.js";

import { DeterministicStreamingScrubberEngine } from "./agents/extensions/streaming_scrubber/deterministic-streaming-scrubber-engine.js";
import { StreamingScrubberSupervisor } from "./agents/extensions/streaming_scrubber/streaming-scrubber-supervisor.js";
import { BroccoliStreamingScrubberSubstrate } from "./sessions/extensions/streaming_scrubber/broccoli-streaming-scrubber-substrate.js";
import { StreamingScrubberSnapshotManager } from "./sessions/extensions/streaming_scrubber/streaming-scrubber-snapshot-manager.js";
import { StreamingScrubberToolSuite } from "./tooling/extensions/streaming_scrubber/streaming-scrubber-tool-suite.js";

import { DeterministicSelfRepoGuardEngine } from "./agents/extensions/self_repo_guard/deterministic-self-repo-guard-engine.js";
import { SelfRepoGuardSupervisor } from "./agents/extensions/self_repo_guard/self-repo-guard-supervisor.js";
import { BroccoliSelfRepoGuardSubstrate } from "./sessions/extensions/self_repo_guard/broccoli-self-repo-guard-substrate.js";
import { SelfRepoGuardSnapshotManager } from "./sessions/extensions/self_repo_guard/self-repo-guard-snapshot-manager.js";
import { SelfRepoGuardToolSuite } from "./tooling/extensions/self_repo_guard/self-repo-guard-tool-suite.js";

import { DeterministicSchemaSanitizerEngine } from "./agents/extensions/schema_sanitizer/deterministic-schema-sanitizer-engine.js";
import { SchemaSanitizerSupervisor } from "./agents/extensions/schema_sanitizer/schema-sanitizer-supervisor.js";
import { BroccoliSchemaSanitizerSubstrate } from "./sessions/extensions/schema_sanitizer/broccoli-schema-sanitizer-substrate.js";
import { SchemaSanitizerSnapshotManager } from "./sessions/extensions/schema_sanitizer/schema-sanitizer-snapshot-manager.js";
import { SchemaSanitizerToolSuite } from "./tooling/extensions/schema_sanitizer/schema-sanitizer-tool-suite.js";

import { DeterministicNousPortalEngine } from "./agents/extensions/nous_portal/deterministic-nous-portal-engine.js";
import { NousPortalSupervisor } from "./agents/extensions/nous_portal/nous-portal-supervisor.js";
import { BroccoliNousPortalSubstrate } from "./sessions/extensions/nous_portal/broccoli-nous-portal-substrate.js";
import { NousPortalSnapshotManager } from "./sessions/extensions/nous_portal/nous-portal-snapshot-manager.js";
import { NousPortalToolSuite } from "./tooling/extensions/nous_portal/nous-portal-tool-suite.js";

import { DeterministicGoalEngine } from "./agents/extensions/goals/deterministic-goal-engine.js";
import { GoalSupervisor } from "./agents/extensions/goals/goal-supervisor.js";
import { BroccoliGoalSubstrate } from "./sessions/extensions/goals/broccoli-goal-substrate.js";
import { GoalSnapshotManager } from "./sessions/extensions/goals/goal-snapshot-manager.js";
import { GoalToolSuite } from "./tooling/extensions/goals/goal-tool-suite.js";

import { DeterministicProfileEngine } from "./agents/extensions/profiles/deterministic-profile-engine.js";
import { ProfileSupervisor } from "./agents/extensions/profiles/profile-supervisor.js";
import { BroccoliProfileSubstrate } from "./sessions/extensions/profiles/broccoli-profile-substrate.js";
import { ProfileSnapshotManager } from "./sessions/extensions/profiles/profile-snapshot-manager.js";
import { ProfileToolSuite } from "./tooling/extensions/profiles/profile-tool-suite.js";

import { BroccoliDatabaseKernel } from "./sessions/extensions/substrate/broccolidb-kernel.js";
import { BroccoliDbTable } from "./sessions/extensions/substrate/broccolidb-table.js";
import { BroccoliNaturalQueryParser } from "./sessions/extensions/substrate/broccolidb-natural-query.js";
import { BroccoliRelationEngine } from "./sessions/extensions/substrate/broccolidb-relations.js";
import { BroccoliAggregateEngine } from "./sessions/extensions/substrate/broccolidb-aggregation.js";
import { BroccoliBranchingEngine } from "./sessions/extensions/substrate/broccolidb-branching.js";
import { BroccoliSchemaEngine } from "./sessions/extensions/substrate/broccolidb-schema-engine.js";
import { BroccoliViewRenderer } from "./sessions/extensions/substrate/broccolidb-view-renderer.js";
import { BroccoliCASStorageService } from "./sessions/extensions/substrate/broccolidb-cas.js";
import { BroccoliWriteAheadLog } from "./sessions/extensions/substrate/broccolidb-wal.js";
import { ReentrantAsyncMutex, DatabaseLockError, DeadlockTimeoutError } from "./sessions/extensions/substrate/broccolidb-mutex.js";
import { DatabaseToolSuite } from "./tooling/extensions/database/database-tools.js";

import { DeterministicWalletEngine } from "./tooling/extensions/wallet/deterministic-wallet-engine.js";
import { WalletSupervisor } from "./agents/extensions/wallet/wallet-supervisor.js";
import { BroccoliWalletSubstrate } from "./sessions/extensions/wallet/broccoli-wallet-substrate.js";
import { WalletSnapshotManager } from "./sessions/extensions/wallet/wallet-snapshot-manager.js";
import { WalletToolSuite } from "./tooling/extensions/wallet/wallet-tool-suite.js";

import { DeterministicEmailEngine } from "./tooling/extensions/email/deterministic-email-engine.js";
import { EmailSupervisor } from "./agents/extensions/email/email-supervisor.js";
import { BroccoliEmailSubstrate } from "./sessions/extensions/email/broccoli-email-substrate.js";
import { EmailSnapshotManager } from "./sessions/extensions/email/email-snapshot-manager.js";
import { EmailToolSuite } from "./tooling/extensions/email/email-tool-suite.js";

import { DeterministicOtlpEngine } from "./tooling/extensions/otlp/deterministic-otlp-engine.js";
import { OtlpSupervisor } from "./agents/extensions/otlp/otlp-supervisor.js";
import { BroccoliOtlpSubstrate } from "./sessions/extensions/otlp/broccoli-otlp-substrate.js";
import { OtlpSnapshotManager } from "./sessions/extensions/otlp/otlp-snapshot-manager.js";
import { OtlpToolSuite } from "./tooling/extensions/otlp/otlp-tool-suite.js";

import { DeterministicAcpEngine } from "./tooling/extensions/acp/deterministic-acp-engine.js";
import { AcpSupervisor } from "./agents/extensions/acp/acp-supervisor.js";

import { DeterministicDaemonEngine } from "./tooling/extensions/daemon/deterministic-daemon-engine.js";
import { DaemonSupervisor } from "./agents/extensions/daemon/daemon-supervisor.js";
import { BroccoliDaemonSubstrate } from "./sessions/extensions/daemon/broccoli-daemon-substrate.js";
import { DaemonSnapshotManager } from "./sessions/extensions/daemon/daemon-snapshot-manager.js";
import { DaemonToolSuite } from "./tooling/extensions/daemon/daemon-tool-suite.js";

import { FilePredicateEvaluator } from "./agents/extensions/runbooks/file-predicate-evaluator.js";
import { MiniYamlParser, MiniYamlError } from "./agents/extensions/runbooks/mini-yaml-parser.js";
import { BroccoliRunbookSubstrate } from "./agents/extensions/runbooks/broccoli-runbook-substrate.js";
import { RunbookSupervisor, TransitionBlockedError } from "./agents/extensions/runbooks/runbook-supervisor.js";
import { RunbookToolSuite } from "./tooling/extensions/runbooks/runbook-tool-suite.js";
import { StatefulCompactionSynthesizer } from "./tooling/extensions/compaction/stateful-compaction-synthesizer.js";

import { ArenaAllocator } from "./sessions/extensions/substrate/arena-allocator.js";

export type {
  EngineProgressEvent,
  EngineProgressMetadata,
  EngineProgressPhase,
  EngineProgressStatus,
  EngineTickInput,
  EngineTickOutcome,
  EngineTickResult,
  IAgentEngine,
  ProgressTelemetryMetrics,
} from "./core/contracts/agent.contracts.js";
export type { GameStateSnapshot, SessionMessage, ISessionStore, SlabBufferSnapshot } from "./core/contracts/session.contracts.js";
export type { CommandResult, AnchoredEditResult, ToolingEvent, JsonRpcNotification, TerminalProgressFrame, IHands, IEars, IToolRegistry } from "./core/contracts/tooling.contracts.js";
export type {
  SkillTier,
  SkillLifecycleState,
  SkillProvenance,
  SkillSupportFile,
  SkillNodeManifest,
  SkillTreeDag,
  SkillMutationChunk,
  SkillMutationPayload,
  SkillMutationResult,
  SkillEvolutionSignal,
  SkillExecutionPolicy,
  SkillStrategyGoal,
  SkillStrategyStep,
  SkillComboSynergy,
  SkillStrategyPlan,
  SkillEvolutionPath,
  SpecializedBranch,
  SkillRecommendation,
  SkillProgressionTrack,
  SkillEvolutionMilestone,
  SkillCriticalPath,
  SkillSpeciationEvaluation,
  SkillTransactionContext,
  SkillSnapshotDiffResult,
  SkillPruningRecommendation,
  SkillAutoRemediationReport,
  SkillCompetencyUncertainty,
  SkillCompetencyVector,
  SkillEvolutionLineage,
  ISkillStrategyEngine,
  ISkillTreeParser,
  IAnchoredSkillMutator,
  IBroccoliSkillTreeSubstrate,
  ISkillTreeSnapshotManager,
  IDeterministicSkillCurator,
  IEvolutionarySkillEngine,
  IAntiDegenerationGuard,
  SkillHealthStatus,
  SkillHealthAuditReport,
  SkillMetricsReport,
  SkillGroupBy,
  SkillSortBy,
  SkillSortDirection,
  SkillGroupedLane,
  SkillNotificationTrigger,
  SkillNotificationUrgency,
  SkillNotificationEvent,
  SkillNotificationPreferences,
  SkillMutationUndoRecord,
  SkillDslQueryFilter,
  SkillBulkMutationResult,
  SkillStateSnapshot,
  SkillNodeRow,
  SkillMutationRow,
  SkillUsageRow,
  SkillNotificationRow,
  SkillFormatExportKind,
  SkillWizardOption,
  SkillWizardQuestion,
  SkillWizardAnswers,
  SkillPowerUpPack,
  SkillCustomTweakSpec,
  SkillNodeLintSeverity,
  SkillNodeLintIssue,
  SkillNodeLintReport,
  SkillForgeOptions,
  SkillDroppedFileEntry,
  SkillDirectorySyncReport,
  SkillDropVaultStatus,
  SkillImportResult,
} from "./core/contracts/skills.contracts.js";
export type {
  SoulArchetype,
  SoulTrait,
  SoulAxiom,
  SoulStyleRules,
  SoulManifest,
  SoulMutationIntent,
  SoulMutationResult,
  SoulSnapshot,
  SoulHealthStatus,
  SoulHealthAuditReport,
  SoulMetricsReport,
  SoulGroupBy,
  SoulSortBy,
  SoulSortDirection,
  SoulGroupedLane,
  SoulMutationUndoRecord,
  SoulDslQueryFilter,
  SoulBulkMutationResult,
  SoulManifestRow,
  SoulTraitRow,
  SoulAxiomRow,
  SoulMutationRow,
  SoulPresetCategory,
  SoulPresetBundle,
  SoulTaxonomyTraitInfo,
  SoulTaxonomyNode,
  SoulDiffEntry,
  SoulDiffReport,
  SoulBookmark,
  SoulAuditTrailEntry,
  SoulFormatExportKind,
  SoulImportResult,
  SoulFuzzyMatchSuggestion,
  SoulRiskSeverity,
  SoulThreatScanDetailed,
  SoulWizardOption,
  SoulWizardQuestion,
  SoulWizardAnswers,
  SoulPersonalityPack,
  SoulCustomTweakSpec,
  SoulLintSeverity,
  SoulPersonaLintIssue,
  SoulPersonaLintReport,
  SoulForgeOptions,
  SoulDroppedFileEntry,
  SoulDirectorySyncReport,
  SoulDropVaultStatus,
  IBroccoliSoulSubstrate,
} from "./core/contracts/soul.contracts.js";
export type {
  SwarmTaskStatus,
  SubagentBudget,
  WorktreeIsolationSpec,
  SwarmTaskManifest,
  DelegationOutcome,
  BatchDelegationResult,
  SwarmHealthStatus,
  SwarmHealthAuditReport,
  SwarmMetricsReport,
  SwarmGroupBy,
  SwarmSortBy,
  SwarmSortDirection,
  SwarmGroupedLane,
  SwarmNotificationTrigger,
  SwarmNotificationUrgency,
  SwarmNotificationEvent,
  SwarmNotificationPreferences,
  SwarmNotificationRecord,
  SwarmMutationUndoRecord,
  SwarmDslQueryFilter,
  SwarmBulkMutationResult,
  SwarmStateSnapshot,
  SwarmTaskRow,
  SwarmOutcomeRow,
  SwarmWorktreeRow,
  SwarmNotificationRow,
  ISwarmDelegator,
  IWorktreeManager,
  ISubagentVfsBrancher,
  ISubagentBudgetGovernor,
  IBroccoliSwarmSubstrate,
  ISwarmSnapshotManager,
} from "./core/contracts/delegation.contracts.js";
export type {
  CronScheduleType,
  CronJobStatus,
  BlueprintSlotType,
  BlueprintSlot,
  AutomationBlueprint,
  CronJobManifest,
  CronExecutionRecord,
  CronStateSnapshot,
  CronHealthStatus,
  CronHealthAuditReport,
  CronMetricsReport,
  CronGroupBy,
  CronSortBy,
  CronSortDirection,
  CronGroupedLane,
  CronNotificationTrigger,
  CronNotificationUrgency,
  CronNotificationEvent,
  CronNotificationPreferences,
  CronNotificationRecord,
  CronMutationUndoRecord,
  CronQueryFilter,
  CronDslQueryFilter,
  CronBulkMutationResult,
  CronJobRow,
  CronExecutionRow,
  CronBlueprintRow,
  CronNotificationRow,
  ICronScheduler,
  IBroccoliCronSubstrate,
  ICronSnapshotManager,
} from "./core/contracts/cron.contracts.js";
export type {
  CdpTargetType,
  CdpTarget,
  CdpDialogType,
  CdpDialogStatus,
  CdpDialogEvent,
  CdpDialogPolicy,
  CdpDomNode,
  CdpDomSnapshot,
  CdpConsoleMessage,
  CdpNetworkRequest,
  CdpNavigationPolicy,
  CdpBrowserStateSnapshot,
  ICdpProtocolClient,
  IBroccoliBrowserSubstrate,
  IBrowserSnapshotManager,
  ICdpSupervisor,
} from "./core/contracts/cdp.contracts.js";
export type {
  CredentialStatus,
  CredentialRotationStrategy,
  TokenBucketState,
  CredentialAccount,
  CredentialStateSnapshot,
  ICredentialPool,
  IBroccoliCredentialSubstrate,
  ICredentialSnapshotManager,
} from "./core/contracts/credential.contracts.js";
export type {
  ChannelBindingRule,
  ContactVipTier,
  DeliveryReceipt,
  GatewayActionButton,
  GatewayActionButtonStyle,
  GatewayAttachment,
  GatewayChannelSession,
  GatewayDeliveryStatus,
  GatewayHandoverMode,
  GatewayHealthMatrix,
  GatewayInteractiveCard,
  GatewayBallotOption,
  GatewayFilterPill,
  GatewayInlineBallot,
  GatewayInlineDataTable,
  GatewayInlineMenuItem,
  GatewayInlineMenuNode,
  GatewayInlineTab,
  GatewayInlineTabGroup,
  GatewayInlineWizard,
  GatewayInPlaceMutationResult,
  GatewayMediaCard,
  GatewayMediaType,
  GatewayMessage,
  GatewayMessageDirection,
  GatewayMessageEnvelope,
  GatewayMessageFormat,
  GatewayOutboundPayload,
  GatewayPlatform,
  GatewayPlatformType,
  GatewayReaction,
  GatewaySessionLease,
  GatewaySkillConfig,
  GatewaySlaPolicy,
  GatewayStateSnapshot,
  GatewaySubstrateSnapshot,
  GatewayThreadTriage,
  GatewayTypingState,
  GatewayUserIdentity,
  GatewayUserRole,
  GatewayWhisperNote,
  GatewayWizardStep,
  IGatewayDeliveryLedger,
  IGatewayDispatcher,
  IGatewayPlatformAdapter,
  LinkedPlatformIdentity,
  PlatformHealthStatus,
  SlashCommandRoute,
  UnifiedContactProfile,
  WebhookVerificationRequest,
  WebhookVerificationResult,
} from "./core/contracts/gateway.contracts.js";
export type {
  AlertLevel,
  CustomerPaymentStatus,
  IntegrationAuditLog,
  IntegrationAuthType,
  IntegrationCategory,
  IntegrationConnection,
  IntegrationProviderType,
  IntegrationRecipe,
  IntegrationsHealthMatrix,
  IntegrationsSkillConfig,
  IntegrationsSubstrateSnapshot,
  IssuePriority,
  IssueStatus,
  PlatformIntegrationHealth,
  ServiceCatalogEntry,
  UnifiedAlert,
  UnifiedCustomer,
  UnifiedDocument,
  UnifiedIssue,
  WorkflowExecutionResult,
  WorkflowStep,
  IntegrationConnectionRow,
  UnifiedIssueRow,
  IntegrationRecipeRow,
  IntegrationAuditLogRow,
  IntegrationsHealthStatus,
  IntegrationsHealthAuditReport,
  IntegrationsMetricsReport,
  IntegrationsGroupBy,
  IntegrationsSortBy,
  IntegrationsSortDirection,
  IntegrationsGroupedLane,
  IntegrationsDslQueryFilter,
  IntegrationsMutationUndoRecord,
  IntegrationsBulkMutationResult,
  IBroccoliIntegrationsSubstrate,
} from "./core/contracts/integrations.contracts.js";
export type {
  CompressionPolicy,
  TokenWindowBudget,
  CompressedTurnSummary,
  ToolPruningPolicy,
  CompressionStateSnapshot,
  IHeadTailBudgetGovernor,
  IDeterministicToolPruner,
  IBroccoliCompressionSubstrate,
  ICompressionSnapshotManager,
  ITrajectoryCompactorEngine,
  CompressionSummaryRow,
  PrunedToolOutputRow,
  CompressionAuditRow,
  CompressionHealthStatus,
  CompressionHealthAuditReport,
  CompressionMetricsReport,
  CompressionGroupBy,
  CompressionSortBy,
  CompressionSortDirection,
  CompressionGroupedLane,
  CompressionDslQueryFilter,
  CompressionMutationUndoRecord,
  CompressionBulkMutationResult,
} from "./core/contracts/compression.contracts.js";
export type {
  IndexedMessageRecord,
  SearchQueryOptions,
  SearchMatchSnippet,
  SearchIndexSnapshot,
  IFtsQuerySanitizer,
  IBroccoliSearchSubstrate,
  ISearchSnapshotManager,
  IDeterministicSessionSearchEngine,
} from "./core/contracts/search.contracts.js";
export type {
  ExecutionBackendType,
  SecurityIsolationProfile,
  ExecutionCommandSpec,
  ExecutionCommandResult,
  EnvironmentSessionState,
  EnvironmentStateSnapshot,
  ISecretScrubber,
  IExecutionEnvironmentAdapter,
  IBroccoliEnvironmentSubstrate,
  IEnvironmentSnapshotManager,
  IEnvironmentSupervisorEngine,
} from "./core/contracts/environment.contracts.js";
export type {
  FaultCategory,
  RecoveryDirectiveType,
  ClassifiedFault,
  JitterMode,
  BackoffPolicySpec,
  ProviderHealthRecord,
  FaultTaxonomyStateSnapshot,
  IDeterministicErrorClassifier,
  IJitteredBackoffGovernor,
  IBroccoliFaultSubstrate,
  IFaultSnapshotManager,
  IFaultRecoverySupervisor,
} from "./core/contracts/fault.contracts.js";
export type {
  AcpApprovalStatus,
  AcpClientCapabilities,
  AcpClientType,
  AcpDiffCard,
  AcpEditApprovalDecision,
  AcpEditApprovalRequest,
  AcpFileChange,
  AcpMultiFileChangeset,
  AcpPermissionLevel,
  AcpRpcNotification,
  AcpRpcRequest,
  AcpRpcResponse,
  AcpServerConfig,
  AcpSession,
  AcpSessionInfo,
  AcpSessionMode,
  AcpSubstrateSnapshot,
  IAcpBridgeServer,
  IAcpPermissionGate,
  IAcpProtocolCodec,
  IBroccoliAcpSubstrate,
} from "./core/contracts/acp.contracts.js";
export type {
  OtlpBottleneckReport,
  OtlpExporterConfig,
  OtlpFlameGraphSegment,
  OtlpHealthMatrix,
  OtlpSpan,
  OtlpSubstrateSnapshot,
  OtlpTracePayload,
  SpanEvent,
  SpanKind,
  SpanLink,
  SpanStatusCode,
  W3CTraceContext,
} from "./core/contracts/otlp.contracts.js";
export type {
  DaemonHealthMatrix,
  DaemonHealthProbe,
  DaemonLogEntry,
  DaemonProcess,
  DaemonProcessDashboardCard,
  DaemonStatus,
  DaemonSubstrateSnapshot,
  DaemonSupervisorConfig,
  DaemonWatchdogPolicy,
} from "./core/contracts/daemon.contracts.js";
export type {
  DbDurabilityMode,
  WalOperationType,
  WalFrame,
  DbQueryOptions,
  IDbTable,
  CasBlobDescriptor,
  CasStorageStats,
  TimelineCheckpointRecord,
  DbHealthReport,
  IBroccoliDatabaseKernel,
} from "./core/contracts/broccolidb.contracts.js";
export {
  estimateMessageTokens,
  estimateMessagesTokens,
  estimateTextTokens,
  truncateTextToTokenBudget,
} from "./core/utilities/token-estimator.js";

export { AbstractAgentEngine } from "./core/abstracts/abstract-agent-engine.js";
export { AbstractSessionStore } from "./core/abstracts/abstract-session-store.js";
export { AbstractHands } from "./core/abstracts/abstract-hands.js";
export { AbstractEars } from "./core/abstracts/abstract-ears.js";
export { AbstractToolRegistry } from "./core/abstracts/abstract-tool-registry.js";

export { AgentConfig } from "./agents/base/agent-config.js";
export { AgentEngine } from "./agents/extensions/execution/agent-engine.js";
export type { AgentContextServices } from "./agents/extensions/execution/agent-engine.js";
export { PromptComposer } from "./agents/extensions/compaction/prompt-composer.js";
export { ContextDslEngine } from "./agents/extensions/compaction/context-dsl-engine.js";
export type {
  ContextDslEnvelope,
  ContextCheckpointEnvelope,
  ThreadBootstrapEnvelope,
  MemoryEnvelopePayload,
  ToolResultEnvelopePayload,
  GoalEnvelopePayload,
  DslIntegrityResult,
  DslEnvelopeMetrics,
} from "./agents/extensions/compaction/context-dsl-engine.js";
export { ModelResolver, KNOWN_CODEX_MODELS } from "./agents/extensions/resolution/model-resolver.js";
export { AgentSlashRouter } from "./agents/extensions/resolution/agent-slash-router.js";
export { MentionResolver } from "./agents/extensions/mentions/mention-resolver.js";
export { AgentSwarmDispatcher } from "./agents/extensions/swarm/agent-swarm-dispatcher.js";
export type { SwarmSubagentTaskResult } from "./agents/extensions/swarm/agent-swarm-dispatcher.js";
export { WorkspaceIntelligenceEngine } from "./agents/extensions/intelligence/workspace-intelligence.js";
export type { WorkspaceCognitiveModel } from "./agents/extensions/intelligence/workspace-intelligence.js";
export { ModelCatalog } from "./agents/extensions/resolution/model-catalog.js";
export type { ModelSpecs } from "./agents/extensions/resolution/model-catalog.js";
export { InteractiveModeController } from "./agents/extensions/execution/interactive-mode-controller.js";
export { EnvironmentKeyResolver } from "./agents/extensions/resolution/environment-key-resolver.js";
export type { ProviderKeyStatus } from "./agents/extensions/resolution/environment-key-resolver.js";
export { ImageModelRegistry } from "./agents/extensions/resolution/image-model-registry.js";
export type { ImageModelSpecs } from "./agents/extensions/resolution/image-model-registry.js";
export { LlmProxyGateway } from "./agents/extensions/resolution/llm-proxy-gateway.js";
export type { ProxyEndpointConfig } from "./agents/extensions/resolution/llm-proxy-gateway.js";
export { ReasoningEffortController } from "./agents/extensions/resolution/reasoning-effort-controller.js";
export type { ReasoningEffortLevel } from "./agents/extensions/resolution/reasoning-effort-controller.js";
export { DynamicModelCache } from "./agents/extensions/resolution/dynamic-model-cache.js";
export type { CachedModelList } from "./agents/extensions/resolution/dynamic-model-cache.js";
export { LoopPhaseController } from "./agents/extensions/execution/loop-phase-controller.js";
export type { LoopPhase, PhaseTransitionEvent } from "./agents/extensions/execution/loop-phase-controller.js";
export { ContextBudgetCalculator } from "./agents/extensions/compaction/context-budget-calculator.js";
export type { ContextBudgetInfo, ContextBudgetOptions } from "./agents/extensions/compaction/context-budget-calculator.js";
export { TokenTruncator } from "./agents/extensions/compaction/token-truncator.js";
export type { TokenTruncationOptions } from "./agents/extensions/compaction/token-truncator.js";
export { PromptTemplateEngine } from "./agents/extensions/compaction/prompt-template-engine.js";
export { DynamicVariableInjector } from "./agents/extensions/compaction/dynamic-variable-injector.js";
export { AgentLoopHarness } from "./agents/extensions/execution/agent-loop-harness.js";
export type { HarnessStepEvent, HarnessExecutionResult, AutonomousHarnessOptions } from "./agents/extensions/execution/agent-loop-harness.js";
export { ProviderAttributionComposer } from "./agents/extensions/resolution/provider-attribution.js";
export type { AttributionRecord, AttributionSummary } from "./agents/extensions/resolution/provider-attribution.js";
export { HttpDispatcherOverlay } from "./agents/extensions/resolution/http-dispatcher.js";
export type { DispatcherConfig } from "./agents/extensions/resolution/http-dispatcher.js";
export { AuthStorageVault } from "./agents/extensions/resolution/auth-storage-vault.js";
export type { AuthTokenRecord } from "./agents/extensions/resolution/auth-storage-vault.js";
export { CodexOAuthManager, OPENAI_CODEX_OAUTH_CONFIG, writeAtomicJsonFile } from "./agents/extensions/resolution/codex-oauth-manager.js";
export type {
  OpenAiCodexCredentials,
  CodexAuthUrlDetails,
  CodexAuthDiagnostics,
  AuthSourceAudit,
  GalxSyncResult,
  GalxSessionConfig,
  CloudSyncLedgerRecord,
} from "./agents/extensions/resolution/codex-oauth-manager.js";
export { CodexProviderBridge, MODERN_GPT56_MODELS } from "./agents/extensions/resolution/codex-provider-bridge.js";
export type { ResolvedAuthHeaders, ModernGpt56Model } from "./agents/extensions/resolution/codex-provider-bridge.js";
export { OpenRouterProviderEngine, OPENROUTER_STEALTH_MODELS } from "./agents/extensions/resolution/openrouter-provider-engine.js";
export {
  CLAUDE_SONNET_1M_SUFFIX,
  OPENROUTER_PROVIDER_PREFERENCES,
} from "./core/contracts/openrouter.contracts.js";
export type {
  OpenRouterModelInfo,
  OpenRouterProviderPreferences,
  OpenRouterStreamChunk,
  OpenRouterStreamUsage,
  OpenRouterErrorResponse,
  OpenRouterParsedStreamEvent,
  OpenRouterGenerationDetails,
  OpenRouterAttributionHeaders,
  OpenRouterHandlerOptions,
  OpenRouterAuthCallbackResult,
} from "./core/contracts/openrouter.contracts.js";
export {
  DeterministicLocalEndpointEngine,
  DEFAULT_LOCAL_ENDPOINT_PRESETS,
  LOCAL_QUICKSTART_GUIDES,
} from "./tooling/extensions/endpoints/deterministic-local-endpoint-engine.js";
export { LocalHardwareProfiler } from "./tooling/extensions/endpoints/local-hardware-profiler.js";
export { LocalModelPuller, type PullModelOptions } from "./tooling/extensions/endpoints/local-model-puller.js";
export { LocalProcessSupervisor } from "./tooling/extensions/endpoints/local-process-supervisor.js";
export { LocalContextAutoTuner } from "./tooling/extensions/endpoints/local-context-auto-tuner.js";
export { LocalInferenceSpeedometer, type SpeedometerOptions } from "./tooling/extensions/endpoints/local-inference-speedometer.js";
export { LocalVramReclaimer, type LoadedModelRecord } from "./tooling/extensions/endpoints/local-vram-reclaimer.js";
export { LocalEmbeddingsEngine } from "./tooling/extensions/endpoints/local-embeddings-engine.js";
export { LocalEndpointDashboardModal } from "./tui/components/local-endpoint-dashboard-modal.js";
export type {
  LocalProviderKind,
  LocalEndpointProfile,
  DiscoveredLocalModel,
  LocalServerHealthStatus,
  LocalQuickstartGuide,
  LocalEndpointAuditReport,
  LocalEndpointMetricsReport,
  LocalHardwareAssessment,
  ModelVramCompatibility,
  VramCompatibilityTier,
  ModelPullProgress,
  ModelPullPhase,
  ProcessSpawnResult,
  LocalFailoverRoute,
  LocalInferenceBenchmarkResult,
  LocalContextTuningProfile,
  LocalModelUnloadResult,
  LocalEmbeddingResult,
} from "./core/contracts/local-endpoints.contracts.js";

export { SessionContext } from "./sessions/base/session-context.js";
export { PersistentSessionStore, SessionStore } from "./sessions/extensions/persistence/session-store.js";
export { ArenaAllocator } from "./sessions/extensions/substrate/arena-allocator.js";
export { SessionCompactor } from "./sessions/extensions/compaction/session-compactor.js";
export type {
  CompactorOptions,
  CompactionReason,
  ContextCompactionPolicy,
  ContextCompactionReport,
} from "./sessions/extensions/compaction/session-compactor.js";
export { SessionVfs } from "./sessions/extensions/vfs/session-vfs.js";
export { SessionMemoryStore } from "./sessions/extensions/memory/session-memory-store.js";
export { StabilityDoctor } from "./sessions/extensions/integrity/stability-doctor.js";
export type { EnvironmentIntegrityReport } from "./sessions/extensions/integrity/stability-doctor.js";
export { PostmortemDiagnostic } from "./sessions/extensions/integrity/postmortem-diagnostic.js";
export type { ExceptionRecord, PostmortemReport } from "./sessions/extensions/integrity/postmortem-diagnostic.js";
export { SystemHealthAggregator } from "./sessions/extensions/integrity/system-health-aggregator.js";
export type { SubsystemHealthStatus, AggregateHealthReport } from "./sessions/extensions/integrity/system-health-aggregator.js";
export { SnapcompactEngine } from "./sessions/extensions/compaction/snapcompact-engine.js";
export type { SnapcompactResult } from "./sessions/extensions/compaction/snapcompact-engine.js";
export { FileLockManager, LruCache } from "./sessions/extensions/substrate/file-lock.js";
export { RemoteSessionHandle } from "./sessions/extensions/persistence/remote-session-handle.js";
export { GatewaySessionRegistry } from "./sessions/extensions/persistence/gateway-session-registry.js";
export type { ActiveSessionInfo } from "./sessions/extensions/persistence/gateway-session-registry.js";
export { SnapshotStorageIndex } from "./sessions/extensions/persistence/snapshot-storage-index.js";
export type { SnapshotMetadata } from "./sessions/extensions/persistence/snapshot-storage-index.js";
export { SnowflakeIdGenerator } from "./sessions/extensions/substrate/snowflake-id-generator.js";
export { SystemDirectoryResolver } from "./sessions/extensions/substrate/system-directory-resolver.js";
export type { SystemDirectories } from "./sessions/extensions/substrate/system-directory-resolver.js";
export { FixedRingBuffer } from "./sessions/extensions/substrate/ring-buffer.js";
export { SemanticVersionComparator } from "./sessions/extensions/integrity/semantic-version-comparator.js";
export type { ParsedSemver } from "./sessions/extensions/integrity/semantic-version-comparator.js";
export { GitIgnoreFilter } from "./sessions/extensions/vfs/git-ignore-filter.js";
export { WorkspaceTreeWalker } from "./sessions/extensions/vfs/workspace-tree-walker.js";
export type { FileTreeNode } from "./sessions/extensions/vfs/workspace-tree-walker.js";
export { LockAuthorityEngine, BroccoliFencingSubstrate } from "./sessions/extensions/substrate/lock-authority.js";
export type { LockClaim, LockAcquireResult, LockReleaseResult, StaleRecoveryReport } from "./sessions/extensions/substrate/lock-authority.js";
export { JoyRideHotPathCache, HotPathCommandClassifier } from "./tooling/extensions/cache/joyride-cache.js";
export type { JoyRideCacheKind, JoyRideCacheEntry, JoyRideCacheStats, CommandSafetyTier } from "./tooling/extensions/cache/joyride-cache.js";
export { ContextStalenessTracker, CognitiveFreshnessGuard } from "./sessions/extensions/memory/context-staleness-tracker.js";
export type { ContextReadEntry, StalenessReport } from "./sessions/extensions/memory/context-staleness-tracker.js";
export { KnowledgeGraphSubstrate } from "./agents/extensions/intelligence/knowledge-graph-substrate.js";
export type { KnowledgeNode, KnowledgeEdge, GraphTraversalFilter } from "./agents/extensions/intelligence/knowledge-graph-substrate.js";
export { LumiIgnorePolicyController } from "./tooling/extensions/permissions/lumi-ignore-controller.js";
export type { IgnorePolicyStatus } from "./tooling/extensions/permissions/lumi-ignore-controller.js";
export { NativeMutationTransactionSubstrate, isPathInWorkspace, getNormalizedHash } from "./sessions/extensions/substrate/native-mutation-substrate.js";
export type { MutationTransaction, MutationResult } from "./sessions/extensions/substrate/native-mutation-substrate.js";
export { WriteCoalescerSubstrate, calculateFastHash } from "./sessions/extensions/substrate/write-coalescer.js";
export type { PendingWrite, CoalescerStats } from "./sessions/extensions/substrate/write-coalescer.js";
export { ConvergenceEngineSubstrate, PRIORITY_LATTICE } from "./agents/extensions/swarm/convergence-engine.js";
export type { AgentRefinement, ResolvedDecision, ConflictResolution } from "./agents/extensions/swarm/convergence-engine.js";
export { BroccoliSubstrateStore } from "./sessions/extensions/substrate/broccoli-substrate-store.js";
export type { SubstrateEntity, SubstrateQueryFilter, SubstrateTransactionCheckpoint } from "./sessions/extensions/substrate/broccoli-substrate-store.js";
export { BroccoliTaskDagScheduler } from "./agents/extensions/swarm/broccoli-task-dag-scheduler.js";
export type { DagTaskNode, TaskStatus } from "./agents/extensions/swarm/broccoli-task-dag-scheduler.js";
export { BroccoliCircuitBreaker, TokenBucketRateGovernor } from "./tooling/extensions/policy/broccoli-circuit-breaker.js";
export type { CircuitState, CircuitStatus } from "./tooling/extensions/policy/broccoli-circuit-breaker.js";
export { BroccoliCasCompactor } from "./sessions/extensions/compaction/broccolidb-cas-compactor.js";
export type { CasBlobRecord, ContextProjectionRecord } from "./sessions/extensions/compaction/broccolidb-cas-compactor.js";
export { BroccoliSpiderAuditEngine } from "./agents/extensions/intelligence/broccolidb-spider-audit.js";
export type { SpiderAuditItem, SpiderAuditReport } from "./agents/extensions/intelligence/broccolidb-spider-audit.js";
export { BroccoliEpistemicReasoningEngine } from "./agents/extensions/intelligence/broccolidb-epistemic-reasoning.js";
export type { ContradictionReport } from "./agents/extensions/intelligence/broccolidb-epistemic-reasoning.js";
export { BroccoliSystemInvariantEngine } from "./sessions/extensions/integrity/broccolidb-system-invariant.js";
export type { SystemInvariantViolation, InvariantAuditReport } from "./sessions/extensions/integrity/broccolidb-system-invariant.js";
export { BroccoliStreamingToolExecutor } from "./tooling/extensions/registry/broccolidb-streaming-tool-executor.js";
export type { ToolExecutionPhase, ToolExecutionProgress, StreamingToolExecutorOptions } from "./tooling/extensions/registry/broccolidb-streaming-tool-executor.js";
export { BroccoliTaskStateEngine } from "./sessions/extensions/persistence/broccolidb-task-state.js";
export { BroccoliLspProtocolBridge } from "./tooling/extensions/perception/broccolidb-lsp-bridge.js";
export type { LspLocation, LspDiagnostic as BroccoliLspDiagnostic } from "./tooling/extensions/perception/broccolidb-lsp-bridge.js";
export { BroccoliBlastRadiusCalculator } from "./agents/extensions/intelligence/broccolidb-blast-radius.js";
export type { BlastRadiusResult, FileDependencyNode } from "./agents/extensions/intelligence/broccolidb-blast-radius.js";
export { BroccoliCognitiveSuggestionEngine } from "./agents/extensions/intelligence/broccolidb-cognitive-suggestion.js";
export type { PromptSuggestion } from "./agents/extensions/intelligence/broccolidb-cognitive-suggestion.js";
export { BroccoliFencingMutexEngine } from "./sessions/extensions/substrate/broccolidb-fencing-mutex.js";
export type { FencingLockRecord } from "./sessions/extensions/substrate/broccolidb-fencing-mutex.js";
export { BroccoliRepairMutationExecutor } from "./agents/extensions/execution/broccolidb-repair-executor.js";
export type { RepairDirective, MutationStep, MutationPlan, RepairExecution } from "./agents/extensions/execution/broccolidb-repair-executor.js";
export { BroccoliVerificationPipeline } from "./agents/extensions/intelligence/broccolidb-verification-pipeline.js";
export type { VerificationFinding, VerificationReport } from "./agents/extensions/intelligence/broccolidb-verification-pipeline.js";
export { BroccoliRollbackCoordinator } from "./sessions/extensions/substrate/broccolidb-rollback-coordinator.js";
export type { FileSnapshotRecord, RollbackResult } from "./sessions/extensions/substrate/broccolidb-rollback-coordinator.js";
export { BroccoliInterAgentMailbox } from "./agents/extensions/swarm/broccolidb-inter-agent-mailbox.js";
export type { MailboxMessage } from "./agents/extensions/swarm/broccolidb-inter-agent-mailbox.js";
export { BroccoliApprovalPolicyEngine, PolicyBlockedError } from "./tooling/extensions/permissions/broccolidb-approval-policy.js";
export type { ApprovalPolicy, RepairRiskLevel, PolicyDecision } from "./tooling/extensions/permissions/broccolidb-approval-policy.js";
export { BroccoliMutationPlanner } from "./agents/extensions/execution/broccolidb-mutation-planner.js";
export { BroccoliExecutionTraceRecorder } from "./tooling/extensions/telemetry/broccolidb-execution-trace.js";
export type { ExecutionTraceEvent, ExecutionTraceEventKind } from "./tooling/extensions/telemetry/broccolidb-execution-trace.js";
export { BroccoliIntentTracer } from "./agents/extensions/intelligence/broccolidb-intent-tracer.js";
export type { CapabilityIntent, IntentTrace, IntentTracerHealth } from "./agents/extensions/intelligence/broccolidb-intent-tracer.js";
export { BroccoliCASScratchpadService } from "./sessions/extensions/persistence/broccolidb-cas-scratchpad.js";
export type { ScratchpadRecord } from "./sessions/extensions/persistence/broccolidb-cas-scratchpad.js";
export { BroccoliContextDiagnosisService } from "./sessions/extensions/integrity/broccolidb-context-diagnosis.js";
export type { DiagnosisKnowledgeNode, ContextHealthReport } from "./sessions/extensions/integrity/broccolidb-context-diagnosis.js";
export { BroccoliRetentionCleanupService } from "./sessions/extensions/integrity/broccolidb-retention-cleanup.js";
export type { CleanupMetrics } from "./sessions/extensions/integrity/broccolidb-retention-cleanup.js";
export { BroccoliTaskCoordinator } from "./agents/extensions/swarm/broccolidb-task-coordinator.js";
export type { ActiveWorkerRecord, TaskCoordinatorStatus } from "./agents/extensions/swarm/broccolidb-task-coordinator.js";
export { BroccoliSideQueryService } from "./agents/extensions/execution/broccolidb-side-query.js";
export type { SideQueryResult, IntentClassification } from "./agents/extensions/execution/broccolidb-side-query.js";
export { BroccoliTokenEstimator } from "./tooling/extensions/policy/broccolidb-token-estimator.js";
export type { TokenEstimationReport } from "./tooling/extensions/policy/broccolidb-token-estimator.js";
export { BroccoliQueryLoopOrchestrator } from "./agents/extensions/execution/broccolidb-query-loop.js";
export type { QueryLoopState } from "./agents/extensions/execution/broccolidb-query-loop.js";
export { BroccoliStructuralDiscoveryService } from "./tooling/extensions/perception/broccolidb-structural-discovery.js";
export type { StructuralBlastRadius } from "./tooling/extensions/perception/broccolidb-structural-discovery.js";
export { BroccoliAxiomVerifier } from "./tooling/extensions/permissions/broccolidb-axiom-verifier.js";
export type { AxiomVerificationResult } from "./tooling/extensions/permissions/broccolidb-axiom-verifier.js";
export { BroccoliPlanModeEnforcer } from "./agents/extensions/execution/broccolidb-plan-enforcer.js";
export type { PlanReviewResult } from "./agents/extensions/execution/broccolidb-plan-enforcer.js";
export { BroccoliJoyZoningEngine, CommentStyleMap } from "./tooling/extensions/permissions/broccolidb-joy-zoning.js";
export type { JoyLayer, CommentStyle } from "./tooling/extensions/permissions/broccolidb-joy-zoning.js";
export { BroccoliJoyZoningGuard } from "./tooling/extensions/permissions/broccolidb-joy-zoning-guard.js";
export type { BoundaryViolation, BoundaryValidationResult } from "./tooling/extensions/permissions/broccolidb-joy-zoning-guard.js";
export { BroccoliWorkspaceArchitectureProfiler, DEFAULT_JOY_ZONING_STEERING_THRESHOLDS } from "./tooling/extensions/permissions/broccolidb-architecture-profiler.js";
export type { WorkspaceArchitectureMode, JoyZoningSteeringThresholds, WorkspaceArchitectureProfileResult } from "./tooling/extensions/permissions/broccolidb-architecture-profiler.js";
export { BroccoliJoyZoningModuleDecomposer } from "./tooling/extensions/permissions/broccolidb-module-decomposer.js";
export type { DecompositionAction, DecompositionStep, DecompositionPlan } from "./tooling/extensions/permissions/broccolidb-module-decomposer.js";
export { BroccoliTspPolicyPlugin } from "./tooling/extensions/permissions/broccolidb-tsp-policy.js";
export type { EnforcementTheme, ExceptionRule, PolicyEvaluationResult } from "./tooling/extensions/permissions/broccolidb-tsp-policy.js";
export { BroccoliJoyRideDiagnostics } from "./tooling/extensions/cache/broccolidb-joyride-diagnostics.js";
export type { JoyRideDiagnosticMetrics } from "./tooling/extensions/cache/broccolidb-joyride-diagnostics.js";
export { BroccoliJoyRideContractVerifier, JOYRIDE_FORBIDDEN_EXPORTS } from "./tooling/extensions/cache/broccolidb-joyride-contract.js";
export type { ContractValidationResult } from "./tooling/extensions/cache/broccolidb-joyride-contract.js";
export { BroccoliReactivePolicyObserver } from "./tooling/extensions/permissions/broccolidb-reactive-policy.js";
export type { ToolExecutionPayload, ReactiveObservationResult } from "./tooling/extensions/permissions/broccolidb-reactive-policy.js";
export { BroccoliUniversalGuard } from "./tooling/extensions/permissions/broccolidb-universal-guard.js";
export * as Tui from "./tui/tui-facade.js";
export type { ExecutionMode } from "./tooling/extensions/permissions/broccolidb-universal-guard.js";
export { BroccoliJoyRideDecisionLog } from "./tooling/extensions/cache/broccolidb-joyride-decision-log.js";
export type { DecisionType, JoyRideCacheDecision } from "./tooling/extensions/cache/broccolidb-joyride-decision-log.js";
export { BroccoliIntegrityProtocol } from "./tooling/extensions/permissions/broccolidb-integrity-protocol.js";
export type { TriadAuditCheck } from "./tooling/extensions/permissions/broccolidb-integrity-protocol.js";
export { BroccoliAutomatedModeController } from "./agents/extensions/execution/broccolidb-mode-controller.js";
export type { ModeState, ModeGateResult } from "./agents/extensions/execution/broccolidb-mode-controller.js";
export { BroccoliIntegrityOptimizer } from "./tooling/extensions/permissions/broccolidb-integrity-optimizer.js";
export type { OptimizationOpportunity } from "./tooling/extensions/permissions/broccolidb-integrity-optimizer.js";
export { BroccoliStabilityForensics } from "./tooling/extensions/permissions/broccolidb-stability-forensics.js";
export type { ForensicVerificationResult } from "./tooling/extensions/permissions/broccolidb-stability-forensics.js";
export { BroccoliSemanticAxiomEngine } from "./tooling/extensions/permissions/broccolidb-semantic-axiom.js";
export type { AxiomViolation } from "./tooling/extensions/permissions/broccolidb-semantic-axiom.js";
export { BroccoliSimulationEngine } from "./tooling/extensions/permissions/broccolidb-simulation-engine.js";
export { BroccoliDatabaseKernel } from "./sessions/extensions/substrate/broccolidb-kernel.js";
export { BroccoliDbTable } from "./sessions/extensions/substrate/broccolidb-table.js";
export { BroccoliNaturalQueryParser } from "./sessions/extensions/substrate/broccolidb-natural-query.js";
export { BroccoliRelationEngine } from "./sessions/extensions/substrate/broccolidb-relations.js";
export { BroccoliAggregateEngine } from "./sessions/extensions/substrate/broccolidb-aggregation.js";
export { BroccoliBranchingEngine } from "./sessions/extensions/substrate/broccolidb-branching.js";
export { BroccoliSchemaEngine } from "./sessions/extensions/substrate/broccolidb-schema-engine.js";
export { BroccoliViewRenderer } from "./sessions/extensions/substrate/broccolidb-view-renderer.js";
export { BroccoliCASStorageService } from "./sessions/extensions/substrate/broccolidb-cas.js";
export { BroccoliWriteAheadLog } from "./sessions/extensions/substrate/broccolidb-wal.js";
export { ReentrantAsyncMutex, DatabaseLockError, DeadlockTimeoutError } from "./sessions/extensions/substrate/broccolidb-mutex.js";
export { DatabaseToolSuite } from "./tooling/extensions/database/database-tools.js";
export type { SimulationResult } from "./tooling/extensions/permissions/broccolidb-simulation-engine.js";
export { BroccoliCommandSanitizer } from "./tooling/extensions/permissions/broccolidb-command-sanitizer.js";
export type { CommandValidationResult } from "./tooling/extensions/permissions/broccolidb-command-sanitizer.js";
export { BroccoliShellEnvironmentResolver } from "./tooling/extensions/permissions/broccolidb-shell-resolver.js";
export type { ShellProfile } from "./tooling/extensions/permissions/broccolidb-shell-resolver.js";
// Phase 60: Command Diagnostics & Output Buffer
export { BroccoliCommandDiagnostics } from "./tooling/extensions/permissions/broccolidb-command-diagnostics.js";
export type { CommandDiagnosticResult } from "./tooling/extensions/permissions/broccolidb-command-diagnostics.js";
export { BroccoliCommandOutputBuffer } from "./tooling/extensions/telemetry/broccolidb-output-buffer.js";
export type { BufferSummaryOptions } from "./tooling/extensions/telemetry/broccolidb-output-buffer.js";

export type { SymbolSearchResult } from "./tooling/extensions/perception/ast-eyes.js";
export { Eyes } from "./tooling/base/eyes.js";
export { AstPerceptionEyes } from "./tooling/extensions/perception/ast-eyes.js";
export { FrontmatterParser } from "./tooling/extensions/perception/frontmatter-parser.js";
export type { FrontmatterResult } from "./tooling/extensions/perception/frontmatter-parser.js";
export { BoundedFilePeeker } from "./tooling/extensions/perception/file-peeker.js";
export type { PeekFileResult } from "./tooling/extensions/perception/file-peeker.js";
export { CommandPathResolver } from "./tooling/extensions/permissions/command-path-resolver.js";
export { TerminalTextSanitizer } from "./tooling/extensions/telemetry/text-sanitizer.js";
export { MicrosecondTimingBuffer } from "./tooling/extensions/telemetry/timing-buffer.js";
export type { TimingMeasurement } from "./tooling/extensions/telemetry/timing-buffer.js";
export { TabSpacingNormalizer } from "./tooling/extensions/hashline/tab-spacing-normalizer.js";
export { ToolCallSchemaValidator } from "./tooling/extensions/registry/tool-call-schema-validator.js";
export type { ValidationResult } from "./tooling/extensions/registry/tool-call-schema-validator.js";
export { ArgumentCoercer } from "./tooling/extensions/registry/argument-coercer.js";
export { BatchEditAnchorer } from "./tooling/extensions/hashline/batch-edit-anchorer.js";
export type { BatchEditTask } from "./tooling/extensions/hashline/batch-edit-anchorer.js";
export { DiffSynthesizer } from "./tooling/extensions/hashline/diff-synthesizer.js";
export { MasterBenchmarkOrchestrator } from "./tooling/extensions/evals/master-benchmark-orchestrator.js";
export type { GrandBenchmarkResult } from "./tooling/extensions/evals/master-benchmark-orchestrator.js";
export { RuntimeSmokeSuite } from "./tooling/extensions/evals/runtime-smoke-suite.js";
export type { RuntimeSmokeCheckResult, RuntimeSmokeReport } from "./tooling/extensions/evals/runtime-smoke-suite.js";
export { LiveBaselineReporter } from "./tooling/extensions/evals/live-baseline-reporter.js";
export type { LiveBaselineInput, LiveBaselineWriteResult } from "./tooling/extensions/evals/live-baseline-reporter.js";
export { FlappyBirdProjectBenchmark } from "./tooling/extensions/evals/flappy-bird-project-benchmark.js";
export type { FlappyBirdBenchmarkCheck } from "./tooling/extensions/evals/flappy-bird-project-benchmark.js";
export {
  FLAPPY_BIRD_PROJECT_DIRECTORY,
  FlappyBirdProjectSynthesizer,
} from "./agents/extensions/execution/flappy-bird-project-synthesizer.js";
export type {
  SynthesizedFlappyBirdProject,
  SynthesizedProjectFile,
  WrittenFlappyBirdProject,
} from "./agents/extensions/execution/flappy-bird-project-synthesizer.js";
export { ArchitectureGuardrailGate } from "./tooling/extensions/policy/architecture-guardrail-gate.js";
export type { GuardrailAuditReport, GuardrailCheckResult } from "./tooling/extensions/policy/architecture-guardrail-gate.js";
export { McpHub } from "./tooling/extensions/mcp/mcp-hub.js";
export type { McpDiscoveredTool } from "./tooling/extensions/mcp/mcp-hub.js";
export { RipgrepSearchService } from "./tooling/extensions/perception/ripgrep-search-service.js";
export type { RipgrepMatch } from "./tooling/extensions/perception/ripgrep-search-service.js";
export { UrlContentFetcher } from "./tooling/extensions/perception/url-content-fetcher.js";
export { LanguageSyntaxParser } from "./tooling/extensions/perception/language-syntax-parser.js";
export type { SyntaxSymbol } from "./tooling/extensions/perception/language-syntax-parser.js";
export {
  RoadmapCompletionGate,
  AttemptCompletionGateStrategy,
  AttemptFlightRecorder,
  CriterionScoreEvaluator,
  ConsensusArbiter,
  GatePipelineDag,
  DiagnosticPatchSynthesizer,
} from "./tooling/extensions/policy/roadmap-completion-gate.js";
export type {
  GateCriteria,
  CompletionGateResult,
  AttemptGateEvaluationContext,
  DynamicGateCriteria,
  CriterionEvaluatorFn,
  AttemptGateStrategyConfig,
  AutonomousAttemptExecutionResult,
  GateCriterionSeverity,
  GateCriterionCategory,
  GatePhase,
  EvaluationAggregationPolicy,
  RemediationStrategyType,
  RemediationDirective,
  AttemptDiff,
  AttemptFingerprint,
  CircuitBreakerConfig,
  CircuitBreakerStatus,
  CircuitBreakerState,
  FlightEvent,
  FlightLog,
  CriterionScoreResult,
  CandidateBranchEvaluation,
  CandidateArbitrationResult,
  GateNode,
  DagExecutionReport,
  DiagnosticMicroPatch,
  BackoffStrategy,
} from "./tooling/extensions/policy/roadmap-completion-gate.js";
export { RoadmapCheckpointDigest } from "./tooling/extensions/policy/roadmap-checkpoint-digest.js";
export type { CheckpointDigest } from "./tooling/extensions/policy/roadmap-checkpoint-digest.js";
export { NativeClipboardBridge } from "./tooling/extensions/perception/native-clipboard.js";
export { AnchoredHands, Hands } from "./tooling/extensions/hashline/hands.js";
export { CommandPermissionController } from "./tooling/extensions/permissions/command-permission-controller.js";
export type { PermissionValidationResult } from "./tooling/extensions/permissions/command-permission-controller.js";
export { ProcessLifecycleManager } from "./tooling/extensions/permissions/process-lifecycle-manager.js";
export type { ProcessHandle } from "./tooling/extensions/permissions/process-lifecycle-manager.js";
export { KeybindingsController } from "./tooling/extensions/permissions/keybindings-controller.js";
export type { KeybindingBinding } from "./tooling/extensions/permissions/keybindings-controller.js";
export { ProtocolEars, Ears } from "./tooling/extensions/telemetry/ears.js";
export { ProgressStreamingEars, TerminalProgressRenderer } from "./tooling/extensions/progress/progress-ears.js";
export { SkillsIngestor } from "./tooling/extensions/registry/skills-ingestor.js";
export { ValidatingToolRegistry, ToolRegistry } from "./tooling/extensions/registry/tool-registry.js";
export { ModuleDecomposer } from "./tooling/extensions/policy/module-decomposer.js";
export { MonolithGatewayServer } from "./tooling/extensions/gateway/monolith-gateway-server.js";
export { MonolithBenchmarkEvaluator } from "./tooling/extensions/evals/benchmark-evaluator.js";
export type {
  BenchmarkAssertionResult,
  BenchmarkCaseExecution,
  BenchmarkSuiteResult,
  BenchmarkTestCase,
  BenchmarkTestResult,
} from "./tooling/extensions/evals/benchmark-evaluator.js";
export { TelemetryTracer } from "./tooling/extensions/telemetry/telemetry-tracer.js";
export type { ActiveSpan } from "./tooling/extensions/telemetry/telemetry-tracer.js";
export { AgenticCommitGenerator } from "./tooling/extensions/policy/agentic-commit-generator.js";
export type { ConventionalCommitResult } from "./tooling/extensions/policy/agentic-commit-generator.js";
export { StreamEventFormatter } from "./tooling/extensions/telemetry/stream-event-formatter.js";
export type { StreamChunkEvent } from "./tooling/extensions/telemetry/stream-event-formatter.js";
export { TransportConnectionController } from "./tooling/extensions/gateway/transport-connection-controller.js";
export type { ConnectionHealth } from "./tooling/extensions/gateway/transport-connection-controller.js";
export { ResilientFetchClient } from "./tooling/extensions/telemetry/resilient-fetch-client.js";
export type { FetchResult } from "./tooling/extensions/telemetry/resilient-fetch-client.js";
export { StderrGuardFilter } from "./tooling/extensions/telemetry/stderr-guard.js";
export type { SuppressionStats } from "./tooling/extensions/telemetry/stderr-guard.js";
export { TTSRCoordinator } from "./tooling/extensions/telemetry/ttsr-coordinator.js";
export type { TTSRMeasurement } from "./tooling/extensions/telemetry/ttsr-coordinator.js";
export { CentennialPassMarker } from "./tooling/extensions/policy/centennial-pass-marker.js";
export type { CentennialMilestone } from "./tooling/extensions/policy/centennial-pass-marker.js";

export { DeterministicSkillTreeParser } from "./tooling/extensions/skills/deterministic-skill-tree-parser.js";
export { AnchoredSkillMutator } from "./tooling/extensions/skills/anchored-skill-mutator.js";
export { SkillCustomForgeEngine } from "./tooling/extensions/skills/skill-custom-forge-engine.js";
export { SkillDropVault } from "./tooling/extensions/skills/skill-drop-vault.js";
export { SkillTreeToolSuite } from "./tooling/extensions/skills/skill-tree-tool-suite.js";
export {
  SkillDesktopNotificationDispatcher,
  DEFAULT_SKILL_NOTIFICATION_PREFERENCES,
} from "./tooling/extensions/skills/skill-notification-dispatcher.js";
export { SkillTreeModal, type SkillTreeModalViewMode } from "./tui/components/skill-tree-modal.js";
export { BroccoliSkillTreeSubstrate } from "./sessions/extensions/skills/broccoli-skill-tree-substrate.js";
export { SkillTreeSnapshotManager } from "./sessions/extensions/skills/skill-tree-snapshot-manager.js";
export { DeterministicSkillCurator } from "./sessions/extensions/skills/deterministic-skill-curator.js";
export { EvolutionarySkillTreeEngine } from "./agents/extensions/skills/evolutionary-skill-tree-engine.js";
export { SkillStrategyEngine } from "./agents/extensions/skills/skill-strategy-engine.js";
export { SkillTreePromptComposer } from "./agents/extensions/skills/skill-tree-prompt-composer.js";
export { AntiDegenerationGuard } from "./agents/extensions/skills/anti-degeneration-guard.js";

export { DeterministicSoulParser } from "./tooling/extensions/soul/deterministic-soul-parser.js";
export { AnchoredSoulMutator } from "./tooling/extensions/soul/anchored-soul-mutator.js";
export { SoulErgonomicsEngine } from "./tooling/extensions/soul/soul-ergonomics-engine.js";
export { SoulCustomForgeEngine } from "./tooling/extensions/soul/soul-custom-forge-engine.js";
export { SoulDropVault } from "./tooling/extensions/soul/soul-drop-vault.js";
export { SoulToolSuite } from "./tooling/extensions/soul/soul-tool-suite.js";
export { SoulDashboardModal, type SoulDashboardViewMode } from "./tui/components/soul-dashboard-modal.js";
export { BroccoliSoulSubstrate } from "./sessions/extensions/soul/broccoli-soul-substrate.js";
export { SoulSnapshotManager } from "./sessions/extensions/soul/soul-snapshot-manager.js";
export { SoulThreatGuard } from "./agents/extensions/soul/soul-threat-guard.js";
export { SoulPromptComposer } from "./agents/extensions/soul/soul-prompt-composer.js";

export { AnchoredWorktreeManager } from "./tooling/extensions/delegation/anchored-worktree-manager.js";
export { SwarmToolSuite } from "./tooling/extensions/delegation/swarm-tool-suite.js";
export {
  SwarmDesktopNotificationDispatcher,
  DEFAULT_SWARM_NOTIFICATION_PREFERENCES,
} from "./tooling/extensions/delegation/swarm-notification-dispatcher.js";
export { BroccoliSwarmSubstrate } from "./sessions/extensions/delegation/broccoli-swarm-substrate.js";
export { SwarmSnapshotManager } from "./sessions/extensions/delegation/swarm-snapshot-manager.js";
export { SubagentVfsBrancher } from "./sessions/extensions/delegation/subagent-vfs-brancher.js";
export { SubagentBudgetGovernor } from "./sessions/extensions/delegation/subagent-budget-governor.js";
export { SubagentLifecycleGuard } from "./agents/extensions/delegation/subagent-lifecycle-guard.js";
export { MonolithSwarmDelegator } from "./agents/extensions/delegation/monolith-swarm-delegator.js";
export { SwarmDashboardModal } from "./tui/components/swarm-dashboard-modal.js";

export { DeterministicBlueprintCatalog } from "./tooling/extensions/cron/deterministic-blueprint-catalog.js";
export { AnchoredCronJobManager } from "./tooling/extensions/cron/anchored-cron-job-manager.js";
export { CronToolSuite } from "./tooling/extensions/cron/cron-tool-suite.js";
export {
  CronDesktopNotificationDispatcher,
  DEFAULT_CRON_NOTIFICATION_PREFERENCES,
} from "./tooling/extensions/cron/cron-notification-dispatcher.js";
export { BroccoliCronSubstrate } from "./sessions/extensions/cron/broccoli-cron-substrate.js";
export { CronSnapshotManager } from "./sessions/extensions/cron/cron-snapshot-manager.js";
export { CronLifecycleGuard } from "./agents/extensions/cron/cron-lifecycle-guard.js";
export { MonolithCronScheduler } from "./agents/extensions/cron/monolith-cron-scheduler.js";
export { CronDashboardModal } from "./tui/components/cron-dashboard-modal.js";

export { CdpNavigationGuard } from "./agents/extensions/cdp/cdp-navigation-guard.js";
export { CdpDialogPolicyEngine } from "./agents/extensions/cdp/cdp-dialog-policy-engine.js";
export { CdpDomSnapshotter } from "./tooling/extensions/cdp/cdp-dom-snapshotter.js";
export { CdpProtocolClient } from "./tooling/extensions/cdp/cdp-protocol-client.js";
export { BroccoliBrowserSubstrate } from "./sessions/extensions/cdp/broccoli-browser-substrate.js";
export { BrowserSnapshotManager } from "./sessions/extensions/cdp/browser-snapshot-manager.js";
export { CdpSupervisorEngine } from "./agents/extensions/cdp/cdp-supervisor-engine.js";
export { CdpToolSuite } from "./tooling/extensions/cdp/cdp-tool-suite.js";

export { TokenBucketRateGovernor as ContinuousTokenBucketRateGovernor } from "./tooling/extensions/credential/token-bucket-rate-governor.js";
export { DeterministicCredentialPool } from "./tooling/extensions/credential/deterministic-credential-pool.js";
export { CredentialToolSuite } from "./tooling/extensions/credential/credential-tool-suite.js";
export { BroccoliCredentialSubstrate } from "./sessions/extensions/credential/broccoli-credential-substrate.js";
export { CredentialSnapshotManager } from "./sessions/extensions/credential/credential-snapshot-manager.js";
export { CredentialCircuitBreaker } from "./agents/extensions/credential/credential-circuit-breaker.js";
export { MonolithCredentialManager } from "./agents/extensions/credential/monolith-credential-manager.js";

export { AbstractPlatformAdapter } from "./tooling/extensions/gateway/abstract-platform-adapter.js";
export { TelegramProtocolAdapter } from "./tooling/extensions/gateway/platform-adapters/telegram-protocol-adapter.js";
export { DiscordProtocolAdapter } from "./tooling/extensions/gateway/platform-adapters/discord-protocol-adapter.js";
export { SlackProtocolAdapter } from "./tooling/extensions/gateway/platform-adapters/slack-protocol-adapter.js";
export { WebhookProtocolAdapter } from "./tooling/extensions/gateway/platform-adapters/webhook-protocol-adapter.js";
export { GatewayToolSuite } from "./tooling/extensions/gateway/gateway-tool-suite.js";
export { GatewayDeliveryLedger } from "./sessions/extensions/gateway/gateway-delivery-ledger.js";
export { BroccoliGatewaySubstrate } from "./sessions/extensions/gateway/broccoli-gateway-substrate.js";
export { GatewaySnapshotManager } from "./sessions/extensions/gateway/gateway-snapshot-manager.js";
export { GatewayDispatcherEngine } from "./agents/extensions/gateway/gateway-dispatcher-engine.js";
export { DeterministicGatewayEngine } from "./tooling/extensions/gateway/deterministic-gateway-engine.js";
export { GatewaySupervisor } from "./agents/extensions/gateway/gateway-supervisor.js";
export { BroccoliIntegrationsSubstrate } from "./sessions/extensions/integrations/broccoli-integrations-substrate.js";
export { IntegrationsSnapshotManager } from "./sessions/extensions/integrations/integrations-snapshot-manager.js";
export { DeterministicIntegrationsEngine } from "./tooling/extensions/integrations/deterministic-integrations-engine.js";
export { IntegrationsSupervisor } from "./agents/extensions/integrations/integrations-supervisor.js";
export { IntegrationsToolSuite } from "./tooling/extensions/integrations/integrations-tool-suite.js";
export { IntegrationsDashboardModal, type IntegrationsDashboardViewMode } from "./tui/components/integrations-dashboard-modal.js";

export { HeadTailBudgetGovernor } from "./tooling/extensions/compaction/head-tail-budget-governor.js";
export { DeterministicToolPruner } from "./tooling/extensions/compaction/deterministic-tool-pruner.js";
export { BroccoliCompressionSubstrate } from "./sessions/extensions/compaction/broccoli-compression-substrate.js";
export { CompressionSnapshotManager } from "./sessions/extensions/compaction/compression-snapshot-manager.js";
export { TrajectoryCompactorEngine } from "./agents/extensions/compaction/trajectory-compactor-engine.js";
export { ContextCompressionSupervisor } from "./agents/extensions/compaction/context-compression-supervisor.js";
export { CompressionToolSuite } from "./tooling/extensions/compaction/compression-tool-suite.js";
export { CompressionDashboardModal, type CompressionDashboardViewMode } from "./tui/components/compression-dashboard-modal.js";

export { FtsQuerySanitizer } from "./tooling/extensions/search/fts-query-sanitizer.js";
export { BroccoliSearchSubstrate } from "./sessions/extensions/search/broccoli-search-substrate.js";
export { SearchSnapshotManager } from "./sessions/extensions/search/search-snapshot-manager.js";
export { DeterministicSessionSearchEngine } from "./tooling/extensions/search/deterministic-session-search-engine.js";
export { SearchToolSuite } from "./tooling/extensions/search/search-tool-suite.js";

export { SecretScrubber } from "./tooling/extensions/environments/secret-scrubber.js";
export { LocalEnvironmentAdapter } from "./tooling/extensions/environments/local-environment-adapter.js";
export { DockerEnvironmentAdapter } from "./tooling/extensions/environments/docker-environment-adapter.js";
export { BroccoliEnvironmentSubstrate } from "./sessions/extensions/environments/broccoli-environment-substrate.js";
export { EnvironmentSnapshotManager } from "./sessions/extensions/environments/environment-snapshot-manager.js";
export { EnvironmentSupervisorEngine } from "./agents/extensions/environments/environment-supervisor-engine.js";
export { EnvironmentToolSuite } from "./tooling/extensions/environments/environment-tool-suite.js";

export { JitteredBackoffGovernor } from "./tooling/extensions/faults/jittered-backoff-governor.js";
export { DeterministicErrorClassifier } from "./tooling/extensions/faults/deterministic-error-classifier.js";
export { BroccoliFaultSubstrate } from "./sessions/extensions/faults/broccoli-fault-substrate.js";
export { FaultSnapshotManager } from "./sessions/extensions/faults/fault-snapshot-manager.js";
export { FaultRecoverySupervisor } from "./agents/extensions/faults/fault-recovery-supervisor.js";
export { FaultDiagnosticToolSuite } from "./tooling/extensions/faults/fault-diagnostic-tool-suite.js";

export { AcpProtocolCodec } from "./tooling/extensions/acp/acp-protocol-codec.js";
export { AcpPermissionGate } from "./tooling/extensions/acp/acp-permission-gate.js";
export { BroccoliAcpSubstrate } from "./sessions/extensions/acp/broccoli-acp-substrate.js";
export { AcpSnapshotManager } from "./sessions/extensions/acp/acp-snapshot-manager.js";
export { AcpBridgeServer } from "./agents/extensions/acp/acp-bridge-server.js";
export { AcpToolSuite } from "./tooling/extensions/acp/acp-tool-suite.js";

export { McpTransportCodec } from "./tooling/extensions/mcp/mcp-transport-codec.js";
export { McpSecurityScrubber } from "./tooling/extensions/mcp/mcp-security-scrubber.js";
export { BroccoliMcpSubstrate } from "./sessions/extensions/mcp/broccoli-mcp-substrate.js";
export { McpSnapshotManager } from "./sessions/extensions/mcp/mcp-snapshot-manager.js";
export { McpSupervisorEngine } from "./agents/extensions/mcp/mcp-supervisor-engine.js";
export { McpClientToolSuite } from "./tooling/extensions/mcp/mcp-client-tool-suite.js";
export type {
  McpTransportType,
  McpServerState,
  McpServerConfig,
  McpToolParameterSchema,
  McpToolDefinition,
  McpResourceDefinition,
  McpPromptArgument,
  McpPromptDefinition,
  McpSamplingRequest,
  McpSamplingResponse,
  McpToolCallRequest,
  McpToolCallResponse,
  McpServerStatus,
  McpSessionSnapshot,
} from "./core/contracts/mcp-client.contracts.js";

export { ProcessOutputRingBuffer } from "./tooling/extensions/process/process-output-ring-buffer.js";
export { ProcessSecuritySandbox } from "./tooling/extensions/process/process-security-sandbox.js";
export { BroccoliProcessSubstrate } from "./sessions/extensions/process/broccoli-process-substrate.js";
export { ProcessSnapshotManager } from "./sessions/extensions/process/process-snapshot-manager.js";
export { ProcessSupervisorEngine } from "./agents/extensions/process/process-supervisor-engine.js";
export { ProcessToolSuite } from "./tooling/extensions/process/process-tool-suite.js";
export type {
  ProcessExecutionStatus,
  ProcessWatchPattern,
  ProcessWatchMatch,
  ProcessSpawnOptions,
  ProcessHandleDescriptor,
  ProcessPollResult,
  ProcessSessionSnapshot,
} from "./core/contracts/process.contracts.js";

export { SecurityRiskClassifier } from "./tooling/extensions/arbiter/security-risk-classifier.js";
export { ApprovalHashLedger } from "./tooling/extensions/arbiter/approval-hash-ledger.js";
export { BroccoliArbiterSubstrate } from "./sessions/extensions/arbiter/broccoli-arbiter-substrate.js";
export { ArbiterSnapshotManager } from "./sessions/extensions/arbiter/arbiter-snapshot-manager.js";
export { InteractiveSecurityArbiter } from "./agents/extensions/arbiter/interactive-security-arbiter.js";
export { ArbiterToolSuite } from "./tooling/extensions/arbiter/arbiter-tool-suite.js";
export type {
  ApprovalRiskLevel,
  ApprovalActionType,
  ApprovalVerdict,
  RiskAssessmentResult,
  PendingApprovalRequest,
  StagedWriteArtifact,
  ApprovalAuditEntry,
  ArbiterSessionSnapshot,
  ArbiterOptions,
} from "./core/contracts/arbiter.contracts.js";

export { SemanticKnowledgeGraph } from "./sessions/extensions/memory/semantic-knowledge-graph.js";
export { BroccoliLearningSubstrate } from "./sessions/extensions/memory/broccoli-learning-substrate.js";
export { LearningSnapshotManager } from "./sessions/extensions/memory/learning-snapshot-manager.js";
export { ContinuousLearningCurator } from "./agents/extensions/memory/continuous-learning-curator.js";
export { LearningCuratorToolSuite } from "./tooling/extensions/memory/learning-curator-tool-suite.js";
export { MemoryCuratorModal, type MemoryCuratorViewMode } from "./tui/components/memory-curator-modal.js";
export type {
  KnowledgeNodeType,
  CuratorKnowledgeNode,
  CuratorKnowledgeEdge,
  KnowledgeGraphSnapshot,
  MemoryQueryOptions,
  MemoryRecallResult,
  CuratorReviewDirective,
  CuratorOptions,
  MemoryNodeRow,
  MemoryEdgeRow,
  MemoryRecallRow,
  MemoryAuditRow,
  MemoryHealthStatus,
  MemoryHealthAuditReport,
  MemoryMetricsReport,
  MemoryGroupBy,
  MemorySortBy,
  MemorySortDirection,
  MemoryGroupedLane,
  MemoryDslQueryFilter,
  MemoryMutationUndoRecord,
  MemoryBulkMutationResult,
  IBroccoliLearningSubstrate,
} from "./core/contracts/memory-curator.contracts.js";

export { DeterministicPatchEngine } from "./tooling/extensions/patch/deterministic-patch-engine.js";
export { BroccoliPatchSubstrate } from "./sessions/extensions/patch/broccoli-patch-substrate.js";
export { PatchSnapshotManager } from "./sessions/extensions/patch/patch-snapshot-manager.js";
export { AtomicMutationSupervisor } from "./agents/extensions/patch/atomic-mutation-supervisor.js";
export { FileMutationToolSuite } from "./tooling/extensions/patch/file-mutation-tool-suite.js";
export { PatchMutationDashboardModal, type PatchMutationDashboardViewMode } from "./tui/components/patch-mutation-dashboard-modal.js";
export type {
  PatchOperationType,
  PatchHunkLine,
  PatchHunk,
  PatchOperation,
  PatchApplyResult,
  FileMutationEntry,
  FileMutationSnapshot,
  FilePaginationOptions,
  FilePaginatedReadResult,
  FileMutationRow,
  PatchOperationRow,
  PatchAuditRow,
  PatchMutationHealthStatus,
  PatchMutationHealthAuditReport,
  PatchMutationMetricsReport,
  PatchMutationGroupBy,
  PatchMutationSortBy,
  PatchMutationSortDirection,
  PatchMutationGroupedLane,
  PatchMutationDslQueryFilter,
  PatchMutationUndoRecord,
  PatchBulkMutationResult,
  IBroccoliPatchSubstrate,
} from "./core/contracts/patch-mutation.contracts.js";

export { DeterministicLspEngine } from "./tooling/extensions/lsp/deterministic-lsp-engine.js";
export { BroccoliLspSubstrate } from "./sessions/extensions/lsp/broccoli-lsp-substrate.js";
export { LspSnapshotManager } from "./sessions/extensions/lsp/lsp-snapshot-manager.js";
export { SemanticCodeSupervisor } from "./agents/extensions/lsp/semantic-code-supervisor.js";
export { LspCodeIntelligenceToolSuite } from "./tooling/extensions/lsp/lsp-code-intelligence-tool-suite.js";
export type {
  LspDiagnosticSeverity,
  LspPosition,
  LspRange,
  LspDiagnosticRelatedInformation,
  LspDiagnostic,
  LspSymbolKind,
  LspSymbolInformation,
  LspHoverInfo,
  LspDefinition,
  LspReferenceLocation,
  LspDocumentState,
  LspWorkspaceSnapshot,
  LspQueryOptions,
} from "./core/contracts/lsp.contracts.js";

export { DeterministicAudioCodec } from "./tooling/extensions/voice/deterministic-audio-codec.js";
export { BroccoliVoiceSubstrate } from "./sessions/extensions/voice/broccoli-voice-substrate.js";
export { VoiceSnapshotManager } from "./sessions/extensions/voice/voice-snapshot-manager.js";
export { VoiceSpeechSupervisor } from "./agents/extensions/voice/voice-speech-supervisor.js";
export { VoiceSpeechToolSuite } from "./tooling/extensions/voice/voice-speech-tool-suite.js";
export type {
  AudioFormat,
  AudioSampleRate,
  VoiceProvider,
  VoiceProfile,
  AudioChunk,
  TranscriptionWord,
  TranscriptionResult,
  SpeechSynthesisResult,
  VadDecision,
  VoiceSessionState,
  VoiceWorkspaceSnapshot,
} from "./core/contracts/voice.contracts.js";

export { DeterministicImageCodec } from "./tooling/extensions/vision/deterministic-image-codec.js";
export { BroccoliVisionSubstrate } from "./sessions/extensions/vision/broccoli-vision-substrate.js";
export { VisionSnapshotManager } from "./sessions/extensions/vision/vision-snapshot-manager.js";
export { MultimodalVisionSupervisor } from "./agents/extensions/vision/multimodal-vision-supervisor.js";
export { MultimodalVisionToolSuite } from "./tooling/extensions/vision/multimodal-vision-tool-suite.js";
export type {
  ImageFormat,
  ImageDimensions,
  ImageMetadata,
  VisualInspectionResult,
  ImageGenerationRequest,
  ImageGenerationResult,
  VisionSessionState,
  VisionWorkspaceSnapshot,
} from "./core/contracts/vision.contracts.js";

export { DeterministicKanbanEngine } from "./tooling/extensions/kanban/deterministic-kanban-engine.js";
export { BroccoliKanbanSubstrate } from "./sessions/extensions/kanban/broccoli-kanban-substrate.js";
export { KanbanSnapshotManager } from "./sessions/extensions/kanban/kanban-snapshot-manager.js";
export { KanbanBoardSupervisor } from "./agents/extensions/kanban/kanban-board-supervisor.js";
export { KanbanOrchestrationToolSuite } from "./tooling/extensions/kanban/kanban-orchestration-tool-suite.js";
export { KanbanDesktopNotificationDispatcher } from "./tooling/extensions/kanban/kanban-notification-dispatcher.js";
export type {
  KanbanColumn,
  KanbanPriority,
  KanbanTask,
  KanbanBoard,
  KanbanTaskMutation,
  KanbanQueryFilter,
  KanbanWorkspaceSnapshot,
  KanbanNotificationEvent,
  KanbanNotificationPreferences,
  KanbanNotificationRecord,
  KanbanNotificationUrgency,
  KanbanNotificationTrigger,
  KanbanGroupBy,
  KanbanSortBy,
  KanbanSortDirection,
  KanbanGroupedSwimlane,
  KanbanDeadlinesReport,
  KanbanMutationUndoRecord,
  KanbanTaskHierarchy,
  KanbanVelocityMetrics,
  KanbanBulkMutationResult,
  KanbanExportFormat,
  KanbanSubtaskChecklistItem,
  KanbanWorkloadBalanceResult,
} from "./core/contracts/kanban.contracts.js";

export { DeterministicWebEngine } from "./tooling/extensions/web/deterministic-web-engine.js";
export { BroccoliWebSubstrate } from "./sessions/extensions/web/broccoli-web-substrate.js";
export { WebSnapshotManager } from "./sessions/extensions/web/web-snapshot-manager.js";
export { WebIntelligenceSupervisor } from "./agents/extensions/web/web-intelligence-supervisor.js";
export { WebIntelligenceToolSuite } from "./tooling/extensions/web/web-intelligence-tool-suite.js";
export type {
  UrlSecurityVerdict,
  WebExtractionFormat,
  WebSearchHit,
  WebSearchResult,
  WebContentExtraction,
  WebSessionState,
  WebWorkspaceSnapshot,
} from "./core/contracts/web.contracts.js";

export { DeterministicCodeExecutor } from "./tooling/extensions/execution/deterministic-code-executor.js";
export { BroccoliExecutionSubstrate } from "./sessions/extensions/execution/broccoli-execution-substrate.js";
export { ExecutionSnapshotManager } from "./sessions/extensions/execution/execution-snapshot-manager.js";
export { CodeExecutionSupervisor } from "./agents/extensions/execution/code-execution-supervisor.js";
export { CodeExecutionToolSuite } from "./tooling/extensions/execution/code-execution-tool-suite.js";
export { ExecutionDashboardModal, type ExecutionDashboardViewMode } from "./tui/components/execution-dashboard-modal.js";
export type {
  CodeExecutionLanguage,
  ExecutionStatus,
  SandboxSecurityPolicy,
  ProgrammaticToolCall,
  CodeExecutionResult,
  SandboxContext,
  ExecutionRecord,
  ExecutionWorkspaceSnapshot,
  ExecutionRecordRow,
  ToolCallRow,
  ExecutionAuditRow,
  ExecutionHealthStatus,
  ExecutionHealthAuditReport,
  ExecutionMetricsReport,
  ExecutionGroupBy,
  ExecutionSortBy,
  ExecutionSortDirection,
  ExecutionGroupedLane,
  ExecutionDslQueryFilter,
  ExecutionMutationUndoRecord,
  ExecutionBulkMutationResult,
  IBroccoliExecutionSubstrate,
} from "./core/contracts/execution.contracts.js";

export { DeterministicBatchEvaluator } from "./tooling/extensions/batch/deterministic-batch-evaluator.js";
export { BroccoliBatchSubstrate } from "./sessions/extensions/batch/broccoli-batch-substrate.js";
export { BatchSnapshotManager } from "./sessions/extensions/batch/batch-snapshot-manager.js";
export { BatchEvaluationSupervisor } from "./agents/extensions/batch/batch-evaluation-supervisor.js";
export { BatchEvaluationToolSuite } from "./tooling/extensions/batch/batch-evaluation-tool-suite.js";
export { BatchDashboardModal, type BatchDashboardViewMode } from "./tui/components/batch-dashboard-modal.js";
export type {
  BatchTaskStatus,
  BatchPriority,
  BatchBenchmarkType,
  BatchTaskItem,
  BatchTaskResult,
  BatchExecutionConfig,
  BatchRunState,
  BatchRunMetrics,
  BatchWorkspaceSnapshot,
  BatchTaskRow,
  BatchResultRow,
  BatchRunRow,
  BatchAuditRow,
  BatchHealthStatus,
  BatchHealthAuditReport,
  BatchMetricsReport,
  BatchGroupBy,
  BatchSortBy,
  BatchSortDirection,
  BatchGroupedLane,
  BatchDslQueryFilter,
  BatchMutationUndoRecord,
  BatchBulkMutationResult,
  IBroccoliBatchSubstrate,
} from "./core/contracts/batch.contracts.js";

export { DeterministicClarifyEngine } from "./tooling/extensions/clarify/deterministic-clarify-engine.js";
export { BroccoliClarifySubstrate } from "./sessions/extensions/clarify/broccoli-clarify-substrate.js";
export { ClarifySnapshotManager } from "./sessions/extensions/clarify/clarify-snapshot-manager.js";
export { ClarifyInquirySupervisor } from "./agents/extensions/clarify/clarify-inquiry-supervisor.js";
export { ClarifyInquiryToolSuite } from "./tooling/extensions/clarify/clarify-inquiry-tool-suite.js";
export { ClarifyDashboardModal, type ClarifyDashboardViewMode } from "./tui/components/clarify-dashboard-modal.js";
export type {
  ClarifyInputMode,
  ClarifyCategory,
  ClarifyPriority,
  ClarifyStatus,
  ClarifyChoice,
  ClarifyAutoPolicy,
  ClarifyInquiry,
  ClarifyResolution,
  ClarifyDecisionNode,
  ClarifyDecisionTree,
  ClarifyWorkspaceSnapshot,
  ClarifyInquiryRow,
  ClarifyResolutionRow,
  ClarifyAuditRow,
  ClarifyHealthStatus,
  ClarifyHealthAuditReport,
  ClarifyMetricsReport,
  ClarifyGroupBy,
  ClarifySortBy,
  ClarifySortDirection,
  ClarifyGroupedLane,
  ClarifyDslQueryFilter,
  ClarifyMutationUndoRecord,
  ClarifyBulkMutationResult,
  IBroccoliClarifySubstrate,
} from "./core/contracts/clarify.contracts.js";

export { DeterministicThreatScanner } from "./tooling/extensions/threat/deterministic-threat-scanner.js";
export { BroccoliThreatSubstrate } from "./sessions/extensions/threat/broccoli-threat-substrate.js";
export { ThreatSnapshotManager } from "./sessions/extensions/threat/threat-snapshot-manager.js";
export { ThreatFirewallSupervisor } from "./agents/extensions/threat/threat-firewall-supervisor.js";
export { ThreatFirewallToolSuite } from "./tooling/extensions/threat/threat-firewall-tool-suite.js";
export type {
  ThreatSeverity,
  ThreatCategory,
  ThreatTrustLevel,
  ThreatFinding,
  ThreatScanResult,
  ThreatWorkspaceSnapshot,
} from "./core/contracts/threat.contracts.js";

export { DeterministicCasStore } from "./tooling/extensions/checkpoint/deterministic-cas-store.js";
export { BroccoliCheckpointSubstrate } from "./sessions/extensions/checkpoint/broccoli-checkpoint-substrate.js";
export { CheckpointSnapshotManager } from "./sessions/extensions/checkpoint/checkpoint-snapshot-manager.js";
export { CheckpointKernelSupervisor } from "./agents/extensions/checkpoint/checkpoint-kernel-supervisor.js";
export { CheckpointKernelToolSuite } from "./tooling/extensions/checkpoint/checkpoint-kernel-tool-suite.js";
export { CheckpointDashboardModal, type CheckpointDashboardViewMode } from "./tui/components/checkpoint-dashboard-modal.js";
export type {
  CasChunk,
  CasChunkManifest,
  CasDeltaPatch,
  CasDeltaCompressionStats,
  CasBlob,
  BloomFilterManifest,
  TreeEntry,
  CheckpointBranchRef,
  CheckpointTagRef,
  CheckpointSignatureManifest,
  CheckpointNode,
  CheckpointConflictMarker,
  CheckpointConflictManifest,
  CheckpointOpLogType,
  CheckpointOpLogEntry,
  CheckpointRollbackResult,
  CheckpointMergeResult,
  CheckpointDiffResult,
  CheckpointStagingFile,
  CheckpointWorkingTreeStatus,
  CheckpointRebaseResult,
  CheckpointSquashResult,
  CheckpointCherryPickResult,
  CheckpointRevertResult,
  CheckpointBisectState,
  CheckpointBisectResult,
  CheckpointBlameLine,
  CheckpointBlameReport,
  CasPackfileManifest,
  GitBundleManifest,
  GitBundlePayload,
  CheckpointWorkspaceSnapshot,
  CheckpointNodeRow,
  CheckpointBlobRow,
  CheckpointTreeRow,
  CheckpointRefRow,
  CheckpointChunkRow,
  CheckpointOpLogRow,
  CheckpointAuditRow,
  CheckpointHealthStatus,
  CheckpointHealthAuditReport,
  CheckpointMetricsReport,
  CheckpointGroupBy,
  CheckpointSortBy,
  CheckpointSortDirection,
  CheckpointGroupedLane,
  CheckpointDslQueryFilter,
  CheckpointMutationUndoRecord,
  CheckpointBulkMutationResult,
  IBroccoliCheckpointSubstrate,
} from "./core/contracts/checkpoint.contracts.js";

export { DeterministicDisplayDriver } from "./tooling/extensions/computer-use/deterministic-display-driver.js";
export { BroccoliDisplaySubstrate } from "./sessions/extensions/computer-use/broccoli-display-substrate.js";
export { DisplaySnapshotManager } from "./sessions/extensions/computer-use/display-snapshot-manager.js";
export { ComputerUseSupervisor } from "./agents/extensions/computer-use/computer-use-supervisor.js";
export { ComputerUseToolSuite } from "./tooling/extensions/computer-use/computer-use-tool-suite.js";
export { ComputerUseDashboardModal, type ComputerUseDashboardViewMode } from "./tui/components/computer-use-dashboard-modal.js";
export type {
  ComputerActionType,
  UiElementRole,
  UiElementBounds,
  UiElement,
  VirtualWindow,
  VirtualDisplayFrame,
  ComputerActionResult,
  ComputerWorkspaceSnapshot,
  ComputerActionRow,
  UiElementRow,
  DisplayAuditRow,
  ComputerUseHealthStatus,
  ComputerUseHealthAuditReport,
  ComputerUseMetricsReport,
  ComputerUseGroupBy,
  ComputerUseSortBy,
  ComputerUseSortDirection,
  ComputerUseGroupedLane,
  ComputerUseDslQueryFilter,
  ComputerUseMutationUndoRecord,
  ComputerUseBulkMutationResult,
  IBroccoliDisplaySubstrate,
} from "./core/contracts/computer-use.contracts.js";

export { DeterministicSkillsHub } from "./tooling/extensions/skills-hub/deterministic-skills-hub.js";
export { BroccoliSkillsHubSubstrate } from "./sessions/extensions/skills-hub/broccoli-skills-hub-substrate.js";
export { SkillsHubSnapshotManager } from "./sessions/extensions/skills-hub/skills-hub-snapshot-manager.js";
export { SkillsHubSupervisor } from "./agents/extensions/skills-hub/skills-hub-supervisor.js";
export { SkillsHubToolSuite } from "./tooling/extensions/skills-hub/skills-hub-tool-suite.js";
export type {
  SkillPackage,
  SkillRegistryManifest,
  SkillInstallationResult,
  SkillsHubWorkspaceSnapshot,
} from "./core/contracts/skills-hub.contracts.js";

export { DeterministicCostGovernor } from "./tooling/extensions/cost/deterministic-cost-governor.js";
export { BroccoliCostSubstrate } from "./sessions/extensions/cost/broccoli-cost-substrate.js";
export { CostSnapshotManager } from "./sessions/extensions/cost/cost-snapshot-manager.js";
export { CostGovernanceSupervisor } from "./agents/extensions/cost/cost-governance-supervisor.js";
export { CostGovernanceToolSuite } from "./tooling/extensions/cost/cost-governance-tool-suite.js";
export { CostDashboardModal, type CostDashboardViewMode } from "./tui/components/cost-dashboard-modal.js";
export type {
  ModelPricingTier,
  TokenUsageLedgerEntry,
  BudgetCapConfig,
  CostGovernanceResult,
  CostGovernanceWorkspaceSnapshot,
  CostLedgerRow,
  CostPricingTierRow,
  CostBudgetRow,
  CostAuditRow,
  CostHealthStatus,
  CostHealthAuditReport,
  CostMetricsReport,
  CostGroupBy,
  CostSortBy,
  CostSortDirection,
  CostGroupedLane,
  CostDslQueryFilter,
  CostMutationUndoRecord,
  CostBulkMutationResult,
  IBroccoliCostSubstrate,
} from "./core/contracts/cost-governance.contracts.js";

export { DeterministicToolDiscloser } from "./tooling/extensions/disclosure/deterministic-tool-discloser.js";
export { BroccoliDisclosureSubstrate } from "./sessions/extensions/disclosure/broccoli-disclosure-substrate.js";
export { ToolDisclosureSnapshotManager } from "./sessions/extensions/disclosure/disclosure-snapshot-manager.js";
export { ToolDisclosureSupervisor } from "./agents/extensions/disclosure/tool-disclosure-supervisor.js";
export { ToolDisclosureToolSuite } from "./tooling/extensions/disclosure/tool-disclosure-tool-suite.js";
export { ToolDisclosureDashboardModal, type ToolDisclosureDashboardViewMode } from "./tui/components/tool-disclosure-dashboard-modal.js";
export type {
  DeferredToolDefinition,
  DisclosureTier,
  DisclosureManifest,
  ToolSearchResult,
  ToolDisclosureConfig,
  ToolDisclosureMetrics,
  ToolDisclosureWorkspaceSnapshot,
  DeferredToolRow,
  ToolDisclosureAuditRow,
  ToolDisclosureHealthStatus,
  ToolDisclosureHealthAuditReport,
  ToolDisclosureMetricsReport,
  ToolDisclosureGroupBy,
  ToolDisclosureSortBy,
  ToolDisclosureSortDirection,
  ToolDisclosureGroupedLane,
  ToolDisclosureDslQueryFilter,
  ToolDisclosureMutationUndoRecord,
  ToolDisclosureBulkMutationResult,
  IBroccoliToolDisclosureSubstrate,
} from "./core/contracts/tool-disclosure.contracts.js";
export { DEFAULT_TOOL_DISCLOSURE_CONFIG } from "./core/contracts/tool-disclosure.contracts.js";

export { DeterministicEvidenceLedger } from "./tooling/extensions/evidence/deterministic-evidence-ledger.js";
export { BroccoliEvidenceSubstrate } from "./sessions/extensions/evidence/broccoli-evidence-substrate.js";
export { EvidenceSnapshotManager } from "./sessions/extensions/evidence/evidence-snapshot-manager.js";
export { VerificationEvidenceSupervisor } from "./agents/extensions/evidence/verification-evidence-supervisor.js";
export { VerificationEvidenceToolSuite } from "./tooling/extensions/evidence/verification-evidence-tool-suite.js";
export { VerificationEvidenceDashboardModal, type VerificationEvidenceDashboardViewMode } from "./tui/components/verification-evidence-dashboard-modal.js";
export type {
  EvidenceKind,
  EvidenceScope,
  VerificationEvidenceRecord,
  VerificationStopGateEvaluation,
  SessionInsightsReport,
  VerificationEvidenceWorkspaceSnapshot,
  VerificationEvidenceRow,
  EvidenceAuditRow,
  VerificationEvidenceHealthStatus,
  VerificationEvidenceHealthAuditReport,
  VerificationEvidenceMetricsReport,
  VerificationEvidenceGroupBy,
  VerificationEvidenceSortBy,
  VerificationEvidenceSortDirection,
  VerificationEvidenceGroupedLane,
  VerificationEvidenceDslQueryFilter,
  VerificationEvidenceMutationUndoRecord,
  VerificationEvidenceBulkMutationResult,
  IBroccoliEvidenceSubstrate,
} from "./core/contracts/verification-evidence.contracts.js";

export { DeterministicPromptCacher } from "./tooling/extensions/prompt/deterministic-prompt-cacher.js";
export { BroccoliPromptCacheSubstrate } from "./sessions/extensions/prompt/broccoli-prompt-cache-substrate.js";
export { PromptCacheSnapshotManager } from "./sessions/extensions/prompt/prompt-cache-snapshot-manager.js";
export { PromptCacheSupervisor } from "./agents/extensions/prompt/prompt-cache-supervisor.js";
export { PromptCacheToolSuite } from "./tooling/extensions/prompt/prompt-cache-tool-suite.js";
export { PromptCacheDashboardModal, type PromptCacheDashboardViewMode } from "./tui/components/prompt-cache-dashboard-modal.js";
export type {
  CacheBreakpointType,
  PromptCacheMarker,
  PromptCacheBreakpoint,
  ByteStablePromptEnvelope,
  ReasoningSanitizationResult,
  PromptCacheConfig,
  PromptCacheMetrics,
  PromptCacheWorkspaceSnapshot,
  PromptCacheBreakpointRow,
  PromptCacheAuditRow,
  PromptCacheHealthStatus,
  PromptCacheHealthAuditReport,
  PromptCacheMetricsReport,
  PromptCacheGroupBy,
  PromptCacheSortBy,
  PromptCacheSortDirection,
  PromptCacheGroupedLane,
  PromptCacheDslQueryFilter,
  PromptCacheMutationUndoRecord,
  PromptCacheBulkMutationResult,
  IBroccoliPromptCacheSubstrate,
} from "./core/contracts/prompt-cache.contracts.js";
export { DEFAULT_PROMPT_CACHE_CONFIG } from "./core/contracts/prompt-cache.contracts.js";

export { DeterministicToolSegmenter } from "./tooling/extensions/execution_guard/deterministic-tool-segmenter.js";
export { BroccoliExecutionGuardSubstrate, BroccoliToolExecutionGuardSubstrate } from "./sessions/extensions/execution_guard/broccoli-execution-guard-substrate.js";
export { ExecutionGuardSnapshotManager, ToolExecutionGuardSnapshotManager } from "./sessions/extensions/execution_guard/execution-guard-snapshot-manager.js";
export { ToolExecutionGuardSupervisor } from "./agents/extensions/execution_guard/tool-execution-guard-supervisor.js";
export { ToolExecutionGuardToolSuite } from "./tooling/extensions/execution_guard/tool-execution-guard-tool-suite.js";
export { ToolExecutionGuardDashboardModal, type ToolExecutionGuardDashboardViewMode } from "./tui/components/tool-execution-guard-dashboard-modal.js";
export type {
  ToolExecutionMode,
  ToolCallItem,
  ToolExecutionBatchSegment,
  LoopGuardrailDecision,
  ToolLoopViolationRecord,
  ToolExecutionGuardConfig,
  ToolExecutionGuardMetrics,
  ToolExecutionWorkspaceSnapshot,
  ToolLoopViolationRow,
  ToolExecutionSegmentRow,
  ToolExecutionAuditRow,
  ToolExecutionGuardHealthStatus,
  ToolExecutionGuardHealthAuditReport,
  ToolExecutionGuardMetricsReport,
  ToolExecutionGuardGroupBy,
  ToolExecutionGuardSortBy,
  ToolExecutionGuardSortDirection,
  ToolExecutionGuardGroupedLane,
  ToolExecutionGuardDslQueryFilter,
  ToolExecutionGuardMutationUndoRecord,
  ToolExecutionGuardBulkMutationResult,
  IBroccoliExecutionGuardSubstrate,
} from "./core/contracts/tool-execution-segment.contracts.js";
export { DEFAULT_TOOL_EXECUTION_GUARD_CONFIG } from "./core/contracts/tool-execution-segment.contracts.js";

export { DeterministicSecretRedactor } from "./tooling/extensions/redaction/deterministic-secret-redactor.js";
export { BroccoliRedactionSubstrate } from "./sessions/extensions/redaction/broccoli-redaction-substrate.js";
export { RedactionSnapshotManager } from "./sessions/extensions/redaction/redaction-snapshot-manager.js";
export { SecretRedactionSupervisor } from "./agents/extensions/redaction/secret-redaction-supervisor.js";
export { SecretRedactionToolSuite } from "./tooling/extensions/redaction/secret-redaction-tool-suite.js";
export type {
  RedactionCategory,
  RedactionMatch,
  RedactionResult,
  PathSafetyDecision,
  SecretRedactionWorkspaceSnapshot,
} from "./core/contracts/secret-redaction.contracts.js";

export { DeterministicReviewEvaluator } from "./tooling/extensions/review/deterministic-review-evaluator.js";
export { BroccoliReviewSubstrate } from "./sessions/extensions/review/broccoli-review-substrate.js";
export { ReviewSnapshotManager } from "./sessions/extensions/review/review-snapshot-manager.js";
export { BackgroundReviewSupervisor } from "./agents/extensions/review/background-review-supervisor.js";
export { BackgroundReviewToolSuite } from "./tooling/extensions/review/background-review-tool-suite.js";
export { BackgroundReviewDashboardModal, type BackgroundReviewDashboardViewMode } from "./tui/components/background-review-dashboard-modal.js";
export type {
  ReviewTriggerPolicy,
  CandidateFactItem,
  CandidateSkillItem,
  TurnReviewDigest,
  TurnReviewResult,
  SessionInsightsBreakdown,
  SessionTitleSuggestion,
  ReviewWorkspaceSnapshot,
  TurnReviewRow,
  CandidateFactRow,
  CandidateSkillRow,
  ReviewAuditRow,
  BackgroundReviewHealthStatus,
  BackgroundReviewHealthAuditReport,
  BackgroundReviewMetricsReport,
  BackgroundReviewGroupBy,
  BackgroundReviewSortBy,
  BackgroundReviewSortDirection,
  BackgroundReviewGroupedLane,
  BackgroundReviewDslQueryFilter,
  BackgroundReviewMutationUndoRecord,
  BackgroundReviewBulkMutationResult,
  IBroccoliReviewSubstrate,
} from "./core/contracts/background-review.contracts.js";

export { DeterministicDiagnosticDoctor } from "./tooling/extensions/doctor/deterministic-diagnostic-doctor.js";
export { BroccoliDoctorSubstrate } from "./sessions/extensions/doctor/broccoli-doctor-substrate.js";
export { DoctorSnapshotManager } from "./sessions/extensions/doctor/doctor-snapshot-manager.js";
export { DiagnosticDoctorSupervisor } from "./agents/extensions/doctor/diagnostic-doctor-supervisor.js";
export { DiagnosticDoctorToolSuite } from "./tooling/extensions/doctor/diagnostic-doctor-tool-suite.js";
export { DiagnosticDoctorDashboardModal, type DiagnosticDoctorDashboardViewMode } from "./tui/components/diagnostic-doctor-dashboard-modal.js";
export type {
  DiagnosticSeverity,
  DiagnosticCheckCategory,
  DiagnosticCheckResult,
  SystemDiagnosticReport,
  OrphanedTurnRepairItem,
  SessionSalvageReport,
  DoctorWorkspaceSnapshot,
  DiagnosticReportRow,
  DiagnosticCheckRow,
  SessionSalvageRow,
  DoctorAuditRow,
  DiagnosticDoctorHealthStatus,
  DiagnosticDoctorHealthAuditReport,
  DiagnosticDoctorMetricsReport,
  DiagnosticDoctorGroupBy,
  DiagnosticDoctorSortBy,
  DiagnosticDoctorSortDirection,
  DiagnosticDoctorGroupedLane,
  DiagnosticDoctorDslQueryFilter,
  DiagnosticDoctorMutationUndoRecord,
  DiagnosticDoctorBulkMutationResult,
  IBroccoliDoctorSubstrate,
} from "./core/contracts/diagnostic-doctor.contracts.js";

export { DeterministicAuthFederator } from "./tooling/extensions/auth/deterministic-auth-federator.js";
export { BroccoliAuthSubstrate } from "./sessions/extensions/auth/broccoli-auth-substrate.js";
export { AuthSnapshotManager } from "./sessions/extensions/auth/auth-snapshot-manager.js";
export { IdentityFederationSupervisor } from "./agents/extensions/auth/identity-federation-supervisor.js";
export { IdentityFederationToolSuite } from "./tooling/extensions/auth/identity-federation-tool-suite.js";
export { IdentityFederationDashboardModal, type IdentityFederationDashboardViewMode } from "./tui/components/identity-federation-dashboard-modal.js";
export type {
  AuthProviderId,
  AuthFlowType,
  SubscriptionTier,
  PkceChallengePair,
  DeviceAuthorizationPending,
  TokenLeaseRecord,
  SubscriptionEntitlement,
  AuthWorkspaceSnapshot,
  TokenLeaseRow,
  DeviceAuthRow,
  SubscriptionTierRow,
  AuthAuditRow,
  IdentityFederationHealthStatus,
  IdentityFederationHealthAuditReport,
  IdentityFederationMetricsReport,
  IdentityFederationGroupBy,
  IdentityFederationSortBy,
  IdentityFederationSortDirection,
  IdentityFederationGroupedLane,
  IdentityFederationDslQueryFilter,
  IdentityFederationMutationUndoRecord,
  IdentityFederationBulkMutationResult,
  IBroccoliAuthSubstrate,
} from "./core/contracts/identity-federation.contracts.js";

export { DeterministicSessionArchiver } from "./tooling/extensions/archive/deterministic-session-archiver.js";
export { BroccoliArchiveSubstrate } from "./sessions/extensions/archive/broccoli-archive-substrate.js";
export { ArchiveSnapshotManager } from "./sessions/extensions/archive/archive-snapshot-manager.js";
export { SessionArchiveSupervisor } from "./agents/extensions/archive/session-archive-supervisor.js";
export { SessionArchiveToolSuite } from "./tooling/extensions/archive/session-archive-tool-suite.js";
export { SessionArchiveDashboardModal, type SessionArchiveDashboardViewMode } from "./tui/components/session-archive-dashboard-modal.js";
export type {
  SessionExportFormat,
  ExportedTurnItem,
  SessionArchiveManifest,
  ExportOptions,
  ExportedDocumentResult,
  ArchiveWorkspaceSnapshot,
  ArchiveManifestRow,
  ExportedDocumentRow,
  ArchiveAuditRow,
  SessionArchiveHealthStatus,
  SessionArchiveHealthAuditReport,
  SessionArchiveMetricsReport,
  SessionArchiveGroupBy,
  SessionArchiveSortBy,
  SessionArchiveSortDirection,
  SessionArchiveGroupedLane,
  SessionArchiveDslQueryFilter,
  SessionArchiveMutationUndoRecord,
  SessionArchiveBulkMutationResult,
  IBroccoliArchiveSubstrate,
} from "./core/contracts/session-archive.contracts.js";

export { DeterministicSkinEngine } from "./tooling/extensions/skin/deterministic-skin-engine.js";
export { BroccoliSkinSubstrate } from "./sessions/extensions/skin/broccoli-skin-substrate.js";
export { SkinSnapshotManager } from "./sessions/extensions/skin/skin-snapshot-manager.js";
export { TerminalSkinSupervisor } from "./agents/extensions/skin/terminal-skin-supervisor.js";
export { TerminalSkinToolSuite } from "./tooling/extensions/skin/terminal-skin-tool-suite.js";
export type {
  SkinPalette,
  SpinnerConfig,
  SkinBranding,
  TerminalSkinPreset,
  BannerRenderOptions,
  SkinWorkspaceSnapshot,
} from "./core/contracts/terminal-skin.contracts.js";

export { DeterministicAuxiliaryRouter } from "./tooling/extensions/router/deterministic-auxiliary-router.js";
export { BroccoliAuxiliarySubstrate } from "./sessions/extensions/router/broccoli-auxiliary-substrate.js";
export { AuxiliarySnapshotManager } from "./sessions/extensions/router/auxiliary-snapshot-manager.js";
export { AuxiliaryRouterSupervisor } from "./agents/extensions/router/auxiliary-router-supervisor.js";
export { AuxiliaryRouterToolSuite } from "./tooling/extensions/router/auxiliary-router-tool-suite.js";
export type {
  AuxiliaryTaskType,
  AuxiliaryProviderConfig,
  AuxiliaryRoutingRequest,
  AuxiliaryDispatchAttempt,
  AuxiliaryRoutingResult,
  AuxiliaryWorkspaceSnapshot,
} from "./core/contracts/auxiliary-router.contracts.js";

export { DeterministicReasoningScrubber } from "./tooling/extensions/reasoning/deterministic-reasoning-scrubber.js";
export { BroccoliReasoningSubstrate } from "./sessions/extensions/reasoning/broccoli-reasoning-substrate.js";
export { ReasoningSnapshotManager } from "./sessions/extensions/reasoning/reasoning-snapshot-manager.js";
export { ReasoningSupervisor } from "./agents/extensions/reasoning/reasoning-supervisor.js";
export { ReasoningToolSuite } from "./tooling/extensions/reasoning/reasoning-tool-suite.js";
export type {
  ReasoningTagPair,
  ReasoningBlock,
  ScrubbedStreamChunk,
  ReasoningTimeoutConfig,
  ReasoningScrubberOptions,
  ReasoningWorkspaceSnapshot,
} from "./core/contracts/reasoning.contracts.js";

export { DeterministicFuzzyMatcher, DEFAULT_UNICODE_MAP, ALL_STRATEGIES, IDENTICAL_STRINGS_ERROR } from "./tooling/extensions/fuzzy/deterministic-fuzzy-matcher.js";
export { BroccoliFuzzySubstrate } from "./sessions/extensions/fuzzy/broccoli-fuzzy-substrate.js";
export { FuzzySnapshotManager } from "./sessions/extensions/fuzzy/fuzzy-snapshot-manager.js";
export { FuzzyMatcherSupervisor } from "./agents/extensions/fuzzy/fuzzy-matcher-supervisor.js";
export { FuzzyMatcherToolSuite } from "./tooling/extensions/fuzzy/fuzzy-matcher-tool-suite.js";
export type {
  FuzzyStrategyName,
  FuzzyMatchSpan,
  ContextWindow,
  WordDiffHighlight,
  ClosestLineCandidate,
  MismatchDiagnosis,
  EscapeDriftDetection,
  FuzzyMatchResult,
  FuzzyReplacementHunk,
  FuzzyMultiMatchResult,
  SearchReplaceBlock,
  UnifiedPatchHunk,
  UnifiedPatchResult,
  MultiFilePatchResult,
  ConflictMarkerChunk,
  ConflictResolutionStrategy,
  ConflictResolutionResult,
  IndentationStyle,
  IndentationHarmonizationResult,
  SyntaxBoundarySnapResult,
  MultiFileTransactionHunk,
  MultiFileTransactionResult,
  ThreeWayMergeConflictResolution,
  ThreeWayMergeOptions,
  ThreeWayMergeHunk,
  ThreeWayMergeResult,
  LspTextEdit,
  LspWorkspaceEdit,
  LspApplyResult,
  SyntaxBalanceIssue,
  SyntaxRepairResult,
  CandidateMatchScore,
  CandidateRankingResult,
  PatienceDiffOptions,
  PatienceDiffHunk,
  PatienceDiffResult,
  LexicalTokenType,
  LexicalToken,
  TokenStreamMatchOptions,
  TokenStreamMatchResult,
  MergeResolutionCandidate,
  ConflictBlockAnalysis,
  SemanticConflictExplanation,
  InversePatchHunk,
  InversePatchResult,
  MultiFileInversePatchResult,
  ScopeBoundedMatchOptions,
  ScopeBoundedMatchResult,
  NGramSimilarityOptions,
  NGramMatchCandidate,
  NGramSimilarityResult,
  SymbolRenameOptions,
  SymbolRenameOccurrence,
  SymbolRenameFileResult,
  WorkspaceSymbolRenameResult,
  PatchDriftOptions,
  PatchDriftHunkResult,
  PatchDriftResult,
  RecordedConflictPreimage,
  RecordedConflictEntry,
  RerereReplayResult,
  FunctionSignatureParam,
  SignatureRefactorOptions,
  SignatureRefactorResult,
  MultiCursorEditSpan,
  MultiCursorParallelResult,
  HistogramDiffOptions,
  HistogramDiffHunk,
  HistogramDiffResult,
  StructuralPatternOptions,
  StructuralHoleBinding,
  StructuralPatternMatchItem,
  StructuralPatternMatchResult,
  SemanticTreeNodeType,
  SemanticTreeNode,
  SemanticTreeOpType,
  SemanticTreeOp,
  SemanticTreeDiffOptions,
  SemanticTreeDiffResult,
  SemanticTreeApplyResult,
  MultiSourceHunkInput,
  MultiSourceSynthesizedPatch,
  MultiSourcePatchSynthesisResult,
  ImportSpecifierItem,
  ImportStatementAnalysis,
  ImportOptimizationOptions,
  ImportOptimizationResult,
  RelocateMutation,
  RelocateCodeBlockOptions,
  RelocateCodeBlockResult,
  DocSyncOptions,
  DocSyncResult,
  MultiRegionSkeletonOptions,
  SkeletonRegionMatch,
  MultiRegionSkeletonResult,
  PruneUnusedOptions,
  PruneUnusedResult,
  CodemodRuleType,
  CodemodRule,
  CodemodStepResult,
  CodemodPipelineResult,
  StructuredConfigFormat,
  StructuredConfigPatchOptions,
  StructuredConfigPatchResult,
  FunctionExtractOptions,
  FunctionInlineOptions,
  FunctionRefactorOptions,
  FunctionRefactorResult,
  WorkspaceFilePatch,
  ImpactedSymbol,
  WorkspacePatchImpactResult,
  PatchBranchCandidate,
  PatchBranchEvaluation,
  PatchBranchExploreResult,
  NullabilityGuardOptions,
  NullabilityGuardResult,
  ImportAliasResolutionOptions,
  ImportAliasResolutionResult,
  ConditionalInversionOptions,
  ConditionalInversionResult,
  FuzzyMatcherOptions,
  FuzzyExecutionRecord,
  FuzzyWorkspaceSnapshot,
} from "./core/contracts/fuzzy-matcher.contracts.js";

export { DeterministicTitleGenerator } from "./agents/extensions/title_insights/deterministic-title-generator.js";
export { ConversationInsightsEngine } from "./agents/extensions/title_insights/conversation-insights-engine.js";
export { TitleInsightsSupervisor } from "./agents/extensions/title_insights/title-insights-supervisor.js";
export { BroccoliTitleInsightsSubstrate } from "./sessions/extensions/title_insights/broccoli-title-insights-substrate.js";
export { TitleInsightsSnapshotManager } from "./sessions/extensions/title_insights/title-insights-snapshot-manager.js";
export { TitleInsightsToolSuite } from "./tooling/extensions/title_insights/title-insights-tool-suite.js";
export { TitleInsightsDashboardModal, type TitleInsightsDashboardViewMode } from "./tui/components/title-insights-dashboard-modal.js";
export {
  CONTROL_WRAPPERS,
  MACHINE_PREFIXES,
  MAX_DERIVED_TITLE_CHARS,
  MAX_TITLE_INPUT_CHARS,
  MAX_MODEL_TITLE_CHARS,
} from "./core/contracts/title-insights.contracts.js";
export type {
  SessionTitleProvenance,
  SessionTitleRecord,
  TitleGenerationOptions,
  TitleGenerationResult,
  InsightDateRange,
  SessionTokenEconomics,
  ToolUsageMetric,
  SkillUsageMetric,
  ModelUsageMetric,
  PlatformUsageMetric,
  ActivityTrendMetric,
  TopSessionMetric,
  SessionInsightsOverview,
  ConversationInsightsReport,
  SessionActivityEvent,
  TitleInsightsWorkspaceSnapshot,
  SessionTitleRow,
  SessionActivityEventRow,
  InsightSummaryRow,
  TitleAuditRow,
  TitleInsightsHealthStatus,
  TitleInsightsHealthAuditReport,
  TitleInsightsMetricsReport,
  TitleInsightsGroupBy,
  TitleInsightsSortBy,
  TitleInsightsSortDirection,
  TitleInsightsGroupedLane,
  TitleInsightsDslQueryFilter,
  TitleInsightsMutationUndoRecord,
  TitleInsightsBulkMutationResult,
  IBroccoliTitleInsightsSubstrate,
} from "./core/contracts/title-insights.contracts.js";

export { DeterministicHeredocSanitizer } from "./agents/extensions/heredoc_terminal/deterministic-heredoc-sanitizer.js";
export { TerminalDiagnosticsEngine } from "./agents/extensions/heredoc_terminal/terminal-diagnostics-engine.js";
export { HeredocTerminalSupervisor } from "./agents/extensions/heredoc_terminal/heredoc-terminal-supervisor.js";
export { BroccoliHeredocTerminalSubstrate } from "./sessions/extensions/heredoc_terminal/broccoli-heredoc-terminal-substrate.js";
export { HeredocTerminalSnapshotManager } from "./sessions/extensions/heredoc_terminal/heredoc-terminal-snapshot-manager.js";
export { HeredocTerminalDashboardModal, type HeredocTerminalDashboardViewMode } from "./tui/components/heredoc-terminal-dashboard-modal.js";
export { HeredocTerminalToolSuite } from "./tooling/extensions/heredoc_terminal/heredoc-terminal-tool-suite.js";
export {
  INERT_HEREDOC_CONSUMER_PATTERN,
  DANGEROUS_SHELL_PATTERNS,
  DEFAULT_HEREDOC_TERMINAL_CONFIG,
} from "./core/contracts/heredoc-terminal.contracts.js";
export type {
  HeredocInterpreterType,
  CommandRiskLevel,
  TerminalDiagnosticCategory,
  HeredocOperatorSpec,
  HeredocBodySpan,
  HeredocSanitizationResult,
  CommandSafetyClassification,
  ScriptHeredocOptions,
  ScriptHeredocResult,
  TerminalDiagnosticHint,
  TerminalExecutionDiagnostics,
  HeredocSanitizationLogRecord,
  HeredocTerminalWorkspaceSnapshot,
  HeredocTerminalConfig,
  HeredocSanitizationRow,
  HeredocDiagnosticRow,
  HeredocAuditRow,
  HeredocTerminalHealthStatus,
  HeredocTerminalHealthAuditReport,
  HeredocTerminalMetricsReport,
  HeredocTerminalGroupBy,
  HeredocTerminalSortBy,
  HeredocTerminalSortDirection,
  HeredocTerminalGroupedLane,
  HeredocTerminalDslQueryFilter,
  HeredocTerminalMutationUndoRecord,
  HeredocTerminalBulkMutationResult,
  IBroccoliHeredocTerminalSubstrate,
} from "./core/contracts/heredoc-terminal.contracts.js";

export { DeterministicStealthBrowser } from "./agents/extensions/stealth_browser/deterministic-stealth-browser.js";
export { StealthBrowserSupervisor } from "./agents/extensions/stealth_browser/stealth-browser-supervisor.js";
export { BroccoliStealthBrowserSubstrate } from "./sessions/extensions/stealth_browser/broccoli-stealth-browser-substrate.js";
export { StealthBrowserSnapshotManager } from "./sessions/extensions/stealth_browser/stealth-browser-snapshot-manager.js";
export { StealthBrowserToolSuite } from "./tooling/extensions/stealth_browser/stealth-browser-tool-suite.js";
export {
  LOOPBACK_HOSTS,
  DOCKER_INTERNAL_HOST,
  DEFAULT_VIEWPORT,
} from "./core/contracts/stealth-browser.contracts.js";
export type {
  RefInteractionAction,
  StorageType,
  StealthBrowserViewport,
  StealthBrowserTab,
  AccessibilityRefNode,
  AccessibilitySnapshot,
  StealthFingerprintProfile,
  CookieRecord,
  StorageEntry,
  RefInteractionResult,
  UrlRewriteResult,
  StealthBrowserLogRecord,
  StealthBrowserWorkspaceSnapshot,
} from "./core/contracts/stealth-browser.contracts.js";

export { DeterministicSkillsSyncClient } from "./agents/extensions/skills_sync/deterministic-skills-sync-client.js";
export { SkillsSyncSupervisor } from "./agents/extensions/skills_sync/skills-sync-supervisor.js";
export { BroccoliSkillsSyncSubstrate } from "./sessions/extensions/skills_sync/broccoli-skills-sync-substrate.js";
export { SkillsSyncSnapshotManager } from "./sessions/extensions/skills_sync/skills-sync-snapshot-manager.js";
export { SkillsSyncToolSuite } from "./tooling/extensions/skills_sync/skills-sync-tool-suite.js";
export {
  SYNC_WIRE_VERSION,
  DEFAULT_MAX_SYNC_OBJECT_BYTES,
} from "./core/contracts/skills-sync.contracts.js";
export type {
  SyncObjectKind,
  TreeEntryMode,
  SkillProvenanceState,
  ConflictResolutionChoice,
  SkillSyncObject,
  SkillSyncTreeEntry,
  SkillSyncTree,
  SkillSyncCommit,
  SkillSyncManifestEntry,
  SkillSyncManifest,
  SkillThreeWayMergeConflict,
  SkillThreeWayMergeResult,
  SkillSyncPushResult,
  SkillSyncPullResult,
  SkillSyncProvenanceReport,
  SkillSyncWorkspaceSnapshot,
} from "./core/contracts/skills-sync.contracts.js";

export { DeterministicPreflightScanner } from "./agents/extensions/preflight_scanner/deterministic-preflight-scanner.js";
export { PreflightScannerSupervisor } from "./agents/extensions/preflight_scanner/preflight-scanner-supervisor.js";
export { BroccoliPreflightSubstrate } from "./sessions/extensions/preflight_scanner/broccoli-preflight-substrate.js";
export { PreflightSnapshotManager } from "./sessions/extensions/preflight_scanner/preflight-snapshot-manager.js";
export { PreflightToolSuite } from "./tooling/extensions/preflight_scanner/preflight-tool-suite.js";
export { PreflightDashboardModal, type PreflightDashboardViewMode } from "./tui/components/preflight-dashboard-modal.js";
export type {
  PreflightVerdict,
  PreflightThreatCategory,
  PreflightThreatSeverity,
  PreflightThreatFinding,
  PreflightScanResult,
  SupplyChainVerificationResult,
  PreflightSecurityPolicy,
  PreflightWorkspaceSnapshot,
  PreflightScanResultRow,
  PreflightAuditRow,
  PreflightHealthStatus,
  PreflightMetrics,
  PreflightHealthAuditReport,
  PreflightMetricsReport,
  PreflightGroupBy,
  PreflightSortBy,
  PreflightSortDirection,
  PreflightGroupedLane,
  PreflightDslQueryFilter,
  PreflightMutationUndoRecord,
  PreflightBulkMutationResult,
  IBroccoliPreflightSubstrate,
} from "./core/contracts/preflight-scanner.contracts.js";
export { DEFAULT_PREFLIGHT_SECURITY_POLICY } from "./core/contracts/preflight-scanner.contracts.js";

export { DeterministicAudioSniffer } from "./agents/extensions/audio_container/deterministic-audio-sniffer.js";
export { AudioContainerSupervisor } from "./agents/extensions/audio_container/audio-container-supervisor.js";
export { BroccoliAudioContainerSubstrate } from "./sessions/extensions/audio_container/broccoli-audio-container-substrate.js";
export { AudioContainerSnapshotManager } from "./sessions/extensions/audio_container/audio-container-snapshot-manager.js";
export { AudioContainerToolSuite } from "./tooling/extensions/audio_container/audio-container-tool-suite.js";
export type {
  AudioContainerId,
  AudioMimeType,
  AudioContainerDescriptor,
  AudioSniffResult,
  AudioCacheEntry,
  AudioWorkspaceSnapshot,
} from "./core/contracts/audio-container.contracts.js";
export {
  CONTAINER_TO_EXT,
  CONTAINER_TO_MIME,
  MP4_AUDIO_BRANDS,
} from "./core/contracts/audio-container.contracts.js";

export { DeterministicSpeechTextNormalizer } from "./agents/extensions/speech_normalizer/deterministic-speech-text-normalizer.js";
export { SpeechNormalizerSupervisor } from "./agents/extensions/speech_normalizer/speech-normalizer-supervisor.js";
export { BroccoliSpeechNormalizerSubstrate } from "./sessions/extensions/speech_normalizer/broccoli-speech-normalizer-substrate.js";
export { SpeechNormalizerSnapshotManager } from "./sessions/extensions/speech_normalizer/speech-normalizer-snapshot-manager.js";
export { SpeechNormalizerToolSuite } from "./tooling/extensions/speech_normalizer/speech-normalizer-tool-suite.js";
export type {
  SpeechNormalizationOptions,
  SpeechNormalizationResult,
  LexiconCategory,
  SpeechLexiconEntry,
  SpeechWorkspaceSnapshot,
} from "./core/contracts/speech-normalizer.contracts.js";

export { DeterministicDocExtractor } from "./agents/extensions/doc_extractor/deterministic-doc-extractor.js";
export { DocExtractorSupervisor } from "./agents/extensions/doc_extractor/doc-extractor-supervisor.js";
export { BroccoliDocExtractorSubstrate } from "./sessions/extensions/doc_extractor/broccoli-doc-extractor-substrate.js";
export { DocExtractorSnapshotManager } from "./sessions/extensions/doc_extractor/doc-extractor-snapshot-manager.js";
export { DocExtractorToolSuite } from "./tooling/extensions/doc_extractor/doc-extractor-tool-suite.js";
export type {
  DocumentFormat,
  BinaryCategory,
  DocumentExtractionOptions,
  DocumentExtractionResult,
  OpaqueWriteCheckResult,
  CachedExtractedDoc,
  DocExtractorMetrics,
  DocExtractorWorkspaceSnapshot,
} from "./core/contracts/doc-extractor.contracts.js";
export {
  BINARY_EXTENSIONS,
  OPAQUE_DOCUMENT_EXTENSIONS,
  EXTRACTABLE_EXTENSIONS,
} from "./core/contracts/doc-extractor.contracts.js";

export { DeterministicSpillVault } from "./agents/extensions/spill_vault/deterministic-spill-vault.js";
export { SpillVaultSupervisor } from "./agents/extensions/spill_vault/spill-vault-supervisor.js";
export { BroccoliSpillVaultSubstrate } from "./sessions/extensions/spill_vault/broccoli-spill-vault-substrate.js";
export { SpillVaultSnapshotManager } from "./sessions/extensions/spill_vault/spill-vault-snapshot-manager.js";
export { SpillVaultToolSuite } from "./tooling/extensions/spill_vault/spill-vault-tool-suite.js";
export type {
  SpillPrivacyTier,
  PersistedResultDescriptor,
  TurnBudgetConfig,
  TurnBudgetEnforcementResult,
  SpillVaultMetrics,
  SpillVaultWorkspaceSnapshot,
} from "./core/contracts/spill-vault.contracts.js";
export {
  DEFAULT_MAX_RESULT_CHARS,
  DEFAULT_MAX_TURN_BUDGET_CHARS,
  DEFAULT_PREVIEW_HEAD,
  DEFAULT_PREVIEW_TAIL,
  PERSISTED_OUTPUT_TAG,
  PERSISTED_OUTPUT_CLOSING_TAG,
} from "./core/contracts/spill-vault.contracts.js";

export { DeterministicUrlSafety } from "./agents/extensions/url_safety/deterministic-url-safety.js";
export { UrlSafetySupervisor } from "./agents/extensions/url_safety/url-safety-supervisor.js";
export { BroccoliUrlSafetySubstrate } from "./sessions/extensions/url_safety/broccoli-url-safety-substrate.js";
export { UrlSafetySnapshotManager } from "./sessions/extensions/url_safety/url-safety-snapshot-manager.js";
export { UrlSafetyToolSuite } from "./tooling/extensions/url_safety/url-safety-tool-suite.js";
export { UrlSafetyDashboardModal } from "./tui/components/url-safety-dashboard-modal.js";
export type { UrlSafetyDashboardViewMode } from "./tui/components/url-safety-dashboard-modal.js";
export type {
  IpAddressCategory,
  UrlSafetyVerdict,
  UrlSafetyCheckResult,
  UrlSafetyConfig,
  UrlSafetyMetrics,
  UrlSafetyWorkspaceSnapshot,
  UrlSafetyCheckRow,
  UrlSafetyAuditRow,
  UrlSafetyHealthStatus,
  UrlSafetyHealthAuditReport,
  UrlSafetyMetricsReport,
  UrlSafetyGroupBy,
  UrlSafetySortBy,
  UrlSafetySortDirection,
  UrlSafetyGroupedLane,
  UrlSafetyDslQueryFilter,
  UrlSafetyMutationUndoRecord,
  UrlSafetyBulkMutationResult,
  IBroccoliUrlSafetySubstrate,
} from "./core/contracts/url-safety.contracts.js";
export {
  CLOUD_METADATA_IPS,
  CLOUD_METADATA_HOSTS,
  DEFAULT_URL_SAFETY_CONFIG,
} from "./core/contracts/url-safety.contracts.js";

export { DeterministicV4aPatch } from "./agents/extensions/v4a_patch/deterministic-v4a-patch.js";
export { V4aPatchSupervisor } from "./agents/extensions/v4a_patch/v4a-patch-supervisor.js";
export { BroccoliV4aPatchSubstrate } from "./sessions/extensions/v4a_patch/broccoli-v4a-patch-substrate.js";
export { V4aPatchSnapshotManager } from "./sessions/extensions/v4a_patch/v4a-patch-snapshot-manager.js";
export { V4aPatchToolSuite } from "./tooling/extensions/v4a_patch/v4a-patch-tool-suite.js";
export type {
  V4aOperationType,
  V4aHunkLine,
  V4aHunk,
  V4aPatchOperation,
  V4aPatchParseResult,
  V4aApplyResult,
  WorkingDiffMode,
  WorkingDiffResult,
  V4aPatchMetrics,
  V4aPatchWorkspaceSnapshot,
} from "./core/contracts/v4a-patch.contracts.js";

export { DeterministicWebsitePolicy } from "./agents/extensions/website_policy/deterministic-website-policy.js";
export { WebsitePolicySupervisor } from "./agents/extensions/website_policy/website-policy-supervisor.js";
export { BroccoliWebsitePolicySubstrate } from "./sessions/extensions/website_policy/broccoli-website-policy-substrate.js";
export { WebsitePolicySnapshotManager } from "./sessions/extensions/website_policy/website-policy-snapshot-manager.js";
export { WebsitePolicyToolSuite } from "./tooling/extensions/website_policy/website-policy-tool-suite.js";
export type {
  WebsitePolicySource,
  WebsitePolicyRule,
  WebsiteAccessCheckResult,
  WebsitePolicyConfig,
  WebsitePolicyMetrics,
  WebsitePolicyWorkspaceSnapshot,
} from "./core/contracts/website-policy.contracts.js";
export { DEFAULT_WEBSITE_POLICY_CONFIG } from "./core/contracts/website-policy.contracts.js";

export { DeterministicWakeWord } from "./agents/extensions/wake_word/deterministic-wake-word.js";
export { WakeWordSupervisor } from "./agents/extensions/wake_word/wake-word-supervisor.js";
export { BroccoliWakeWordSubstrate } from "./sessions/extensions/wake_word/broccoli-wake-word-substrate.js";
export { WakeWordSnapshotManager } from "./sessions/extensions/wake_word/wake-word-snapshot-manager.js";
export { WakeWordToolSuite } from "./tooling/extensions/wake_word/wake-word-tool-suite.js";
export type {
  WakeWordEngineProvider,
  WakeWordState,
  WakeWordConfig,
  WakeWordFrameResult,
  WakeWordMetrics,
  WakeWordWorkspaceSnapshot,
} from "./core/contracts/wake-word.contracts.js";
export { DEFAULT_WAKE_WORD_CONFIG } from "./core/contracts/wake-word.contracts.js";

export { DeterministicMediaResolver } from "./agents/extensions/media_source/deterministic-media-resolver.js";
export { MediaSourceSupervisor } from "./agents/extensions/media_source/media-source-supervisor.js";
export { BroccoliMediaSourceSubstrate } from "./sessions/extensions/media_source/broccoli-media-source-substrate.js";
export { MediaSourceSnapshotManager } from "./sessions/extensions/media_source/media-source-snapshot-manager.js";
export { MediaSourceToolSuite } from "./tooling/extensions/media_source/media-source-tool-suite.js";
export type {
  MediaSourceOrigin,
  MediaKind,
  ResolvedMedia,
  MediaSourceConfig,
  MediaSourceMetrics,
  MediaSourceWorkspaceSnapshot,
} from "./core/contracts/media-source.contracts.js";
export { DEFAULT_MEDIA_SOURCE_CONFIG } from "./core/contracts/media-source.contracts.js";

export { DeterministicGitWorktree } from "./agents/extensions/worktree/deterministic-git-worktree.js";
export { WorktreeSupervisor } from "./agents/extensions/worktree/worktree-supervisor.js";
export { BroccoliWorktreeSubstrate } from "./sessions/extensions/worktree/broccoli-worktree-substrate.js";
export { WorktreeSnapshotManager } from "./sessions/extensions/worktree/worktree-snapshot-manager.js";
export { WorktreeToolSuite } from "./tooling/extensions/worktree/worktree-tool-suite.js";
export type {
  WorktreeStatus,
  WorktreeDescriptor,
  WorktreeConfig,
  WorktreeMetrics,
  WorktreeWorkspaceSnapshot,
} from "./core/contracts/worktree.contracts.js";
export { DEFAULT_WORKTREE_CONFIG } from "./core/contracts/worktree.contracts.js";

export { DeterministicSpeechTranscriber } from "./agents/extensions/transcription/deterministic-speech-transcriber.js";
export { TranscriptionSupervisor } from "./agents/extensions/transcription/transcription-supervisor.js";
export { BroccoliTranscriptionSubstrate } from "./sessions/extensions/transcription/broccoli-transcription-substrate.js";
export { TranscriptionSnapshotManager } from "./sessions/extensions/transcription/transcription-snapshot-manager.js";
export { TranscriptionToolSuite } from "./tooling/extensions/transcription/transcription-tool-suite.js";
export type {
  TranscriptionProvider,
  WordTimestamp,
  TranscriptionSegment,
  AudioTranscriptionResult,
  TranscriptionConfig,
  TranscriptionMetrics,
  CachedTranscriptRecord,
  TranscriptionWorkspaceSnapshot,
} from "./core/contracts/transcription.contracts.js";
export { DEFAULT_TRANSCRIPTION_CONFIG } from "./core/contracts/transcription.contracts.js";

export { DeterministicDeadlineEngine } from "./agents/extensions/deadline/deterministic-deadline-engine.js";
export { DeadlineSupervisor } from "./agents/extensions/deadline/deadline-supervisor.js";
export { BroccoliDeadlineSubstrate } from "./sessions/extensions/deadline/broccoli-deadline-substrate.js";
export { DeadlineSnapshotManager } from "./sessions/extensions/deadline/deadline-snapshot-manager.js";
export { DeadlineToolSuite } from "./tooling/extensions/deadline/deadline-tool-suite.js";
export { DeadlineDashboardModal, type DeadlineDashboardViewMode } from "./tui/components/deadline-dashboard-modal.js";
export type {
  DeadlineOutcome,
  DeadlineLeaseStatus,
  DeadlineLease,
  BoundedResult,
  EstopState,
  DeadlineConfig,
  DeadlineMetrics,
  DeadlineWorkspaceSnapshot,
  DeadlineLeaseRow,
  DeadlineTimeoutRow,
  DeadlineEstopRow,
  DeadlineAuditRow,
  DeadlineHealthStatus,
  DeadlineHealthAuditReport,
  DeadlineMetricsReport,
  DeadlineGroupBy,
  DeadlineSortBy,
  DeadlineSortDirection,
  DeadlineGroupedLane,
  DeadlineDslQueryFilter,
  DeadlineMutationUndoRecord,
  DeadlineBulkMutationResult,
  IBroccoliDeadlineSubstrate,
} from "./core/contracts/deadline.contracts.js";
export {
  DEFAULT_DEADLINE_CONFIG,
  MAX_SAFE_TIMEOUT_MS,
} from "./core/contracts/deadline.contracts.js";

export { DeterministicFileSafetyGuard } from "./agents/extensions/file_safety/deterministic-file-safety-guard.js";
export { FileSafetySupervisor } from "./agents/extensions/file_safety/file-safety-supervisor.js";
export { BroccoliFileSafetySubstrate } from "./sessions/extensions/file_safety/broccoli-file-safety-substrate.js";
export { FileSafetySnapshotManager } from "./sessions/extensions/file_safety/file-safety-snapshot-manager.js";
export { FileSafetyToolSuite } from "./tooling/extensions/file_safety/file-safety-tool-suite.js";
export type {
  FileSafetyVerdict,
  FileSafetyEvaluation,
  FileSafetyPolicyConfig,
  FileSafetyMetrics,
  FileSafetyWorkspaceSnapshot,
} from "./core/contracts/file-safety.contracts.js";
export { DEFAULT_FILE_SAFETY_CONFIG } from "./core/contracts/file-safety.contracts.js";

export { DeterministicContextBreakdownEngine } from "./agents/extensions/context_breakdown/deterministic-context-breakdown-engine.js";
export { ContextBreakdownSupervisor } from "./agents/extensions/context_breakdown/context-breakdown-supervisor.js";
export { BroccoliContextBreakdownSubstrate } from "./sessions/extensions/context_breakdown/broccoli-context-breakdown-substrate.js";
export { ContextBreakdownSnapshotManager } from "./sessions/extensions/context_breakdown/context-breakdown-snapshot-manager.js";
export { ContextBreakdownToolSuite } from "./tooling/extensions/context_breakdown/context-breakdown-tool-suite.js";
export type {
  ContextCategoryId,
  ContextCategorySlice,
  ContextBreakdownReport,
  ContextBreakdownConfig,
  ContextBreakdownMetrics,
  ContextBreakdownWorkspaceSnapshot,
} from "./core/contracts/context-breakdown.contracts.js";
export { DEFAULT_CONTEXT_BREAKDOWN_CONFIG } from "./core/contracts/context-breakdown.contracts.js";

export { DeterministicOsvParser } from "./agents/extensions/osv/deterministic-osv-parser.js";
export { OsvScannerSupervisor } from "./agents/extensions/osv/osv-scanner-supervisor.js";
export { BroccoliOsvSubstrate } from "./sessions/extensions/osv/broccoli-osv-substrate.js";
export { OsvSnapshotManager, OsvScannerSnapshotManager } from "./sessions/extensions/osv/osv-snapshot-manager.js";
export { OsvScannerToolSuite } from "./tooling/extensions/osv/osv-scanner-tool-suite.js";
export { OsvDashboardModal, type OsvDashboardViewMode } from "./tui/components/osv-dashboard-modal.js";
export type {
  PackageEcosystem,
  ParsedPackageTarget,
  OsvAdvisory,
  OsvScanResult,
  OsvScannerConfig,
  OsvScannerMetrics,
  OsvCachedEntry,
  OsvScannerWorkspaceSnapshot,
  OsvScanResultRow,
  OsvAuditRow,
  OsvHealthStatus,
  OsvHealthAuditReport,
  OsvMetricsReport,
  OsvGroupBy,
  OsvSortBy,
  OsvSortDirection,
  OsvGroupedLane,
  OsvDslQueryFilter,
  OsvMutationUndoRecord,
  OsvBulkMutationResult,
  IBroccoliOsvSubstrate,
} from "./core/contracts/osv-scanner.contracts.js";
export { DEFAULT_OSV_SCANNER_CONFIG } from "./core/contracts/osv-scanner.contracts.js";

export { DeterministicSubdirHintEngine } from "./agents/extensions/subdir_hints/deterministic-subdir-hint-engine.js";
export { SubdirHintsSupervisor } from "./agents/extensions/subdir_hints/subdir-hints-supervisor.js";
export { BroccoliSubdirHintsSubstrate } from "./sessions/extensions/subdir_hints/broccoli-subdir-hints-substrate.js";
export { SubdirHintsSnapshotManager } from "./sessions/extensions/subdir_hints/subdir-hints-snapshot-manager.js";
export { SubdirHintsToolSuite } from "./tooling/extensions/subdir_hints/subdir-hints-tool-suite.js";
export { SubdirHintsDashboardModal, type SubdirHintsDashboardViewMode } from "./tui/components/subdir-hints-dashboard-modal.js";
export type {
  DiscoveredSubdirHint,
  SubdirHintDiscoveryResult,
  SubdirectoryHintsConfig,
  SubdirectoryHintsMetrics,
  SubdirectoryHintsWorkspaceSnapshot,
  SubdirectoryHintRow,
  SubdirectoryHintAuditRow,
  SubdirectoryHintsHealthStatus,
  SubdirectoryHintsHealthAuditReport,
  SubdirectoryHintsMetricsReport,
  SubdirectoryHintsGroupBy,
  SubdirectoryHintsSortBy,
  SubdirectoryHintsSortDirection,
  SubdirectoryHintsGroupedLane,
  SubdirectoryHintsDslQueryFilter,
  SubdirectoryHintsMutationUndoRecord,
  SubdirectoryHintsBulkMutationResult,
  IBroccoliSubdirectoryHintsSubstrate,
} from "./core/contracts/subdirectory-hints.contracts.js";
export { DEFAULT_SUBDIRECTORY_HINTS_CONFIG } from "./core/contracts/subdirectory-hints.contracts.js";

export { DeterministicStreamDiagEngine } from "./agents/extensions/stream_diag/deterministic-stream-diag-engine.js";
export { StreamDiagSupervisor } from "./agents/extensions/stream_diag/stream-diag-supervisor.js";
export { BroccoliStreamDiagSubstrate } from "./sessions/extensions/stream_diag/broccoli-stream-diag-substrate.js";
export { StreamDiagSnapshotManager } from "./sessions/extensions/stream_diag/stream-diag-snapshot-manager.js";
export { StreamDiagToolSuite } from "./tooling/extensions/stream_diag/stream-diag-tool-suite.js";
export type {
  StreamDiagnosticAttempt,
  StreamDropEvent,
  StreamDiagConfig,
  StreamDiagMetrics,
  StreamDiagWorkspaceSnapshot,
} from "./core/contracts/stream-diag.contracts.js";
export {
  STREAM_DIAG_DEFAULT_HEADERS,
  DEFAULT_STREAM_DIAG_CONFIG,
} from "./core/contracts/stream-diag.contracts.js";

export { DeterministicTurnRetryEngine } from "./agents/extensions/turn_retry/deterministic-turn-retry-engine.js";
export { TurnRetrySupervisor } from "./agents/extensions/turn_retry/turn-retry-supervisor.js";
export { BroccoliTurnRetrySubstrate } from "./sessions/extensions/turn_retry/broccoli-turn-retry-substrate.js";
export { TurnRetrySnapshotManager } from "./sessions/extensions/turn_retry/turn-retry-snapshot-manager.js";
export { TurnRetryToolSuite } from "./tooling/extensions/turn_retry/turn-retry-tool-suite.js";
export { TurnRetryDashboardModal, type TurnRetryDashboardViewMode } from "./tui/components/turn-retry-dashboard-modal.js";
export type {
  TurnRetryErrorCategory,
  TurnRetryGuards,
  TurnRestartSignals,
  TurnRecoveryBranch,
  TurnRestartSignalKey,
  TurnRetryHistoryEntry,
  TurnRetryStateDescriptor,
  TurnRetryAttemptRecord,
  TurnRetryConfig,
  TurnRetryMetrics,
  TurnRetryWorkspaceSnapshot,
  TurnRetryStateRow,
  TurnRetryAttemptRow,
  TurnRetryAuditRow,
  TurnRetryHealthStatus,
  TurnRetryHealthAuditReport,
  TurnRetryMetricsReport,
  TurnRetryGroupBy,
  TurnRetrySortBy,
  TurnRetrySortDirection,
  TurnRetryGroupedLane,
  TurnRetryDslQueryFilter,
  TurnRetryMutationUndoRecord,
  TurnRetryBulkMutationResult,
  IBroccoliTurnRetrySubstrate,
} from "./core/contracts/turn-retry.contracts.js";
export {
  DEFAULT_TURN_RETRY_GUARDS,
  DEFAULT_TURN_RESTART_SIGNALS,
  DEFAULT_TURN_RETRY_CONFIG,
} from "./core/contracts/turn-retry.contracts.js";

export { DeterministicBillingUsageEngine } from "./agents/extensions/billing_usage/deterministic-billing-usage-engine.js";
export { BillingUsageSupervisor } from "./agents/extensions/billing_usage/billing-usage-supervisor.js";
export { BroccoliBillingUsageSubstrate } from "./sessions/extensions/billing_usage/broccoli-billing-usage-substrate.js";
export { BillingUsageSnapshotManager } from "./sessions/extensions/billing_usage/billing-usage-snapshot-manager.js";
export { BillingUsageToolSuite } from "./tooling/extensions/billing_usage/billing-usage-tool-suite.js";
export { BillingUsageDashboardModal, type BillingUsageDashboardViewMode } from "./tui/components/billing-usage-dashboard-modal.js";
export type {
  AccountStatus,
  UsageBarDescriptor,
  UsageModelDescriptor,
  BillingAccountInfo,
  BillingUsageConfig,
  BillingTransaction,
  BillingUsageMetrics,
  BillingUsageWorkspaceSnapshot,
  BillingAccountRow,
  BillingTransactionRow,
  BillingBarStateRow,
  BillingAuditRow,
  BillingUsageHealthStatus,
  BillingUsageHealthAuditReport,
  BillingUsageMetricsReport,
  BillingUsageGroupBy,
  BillingUsageSortBy,
  BillingUsageSortDirection,
  BillingUsageGroupedLane,
  BillingUsageDslQueryFilter,
  BillingUsageMutationUndoRecord,
  BillingUsageBulkMutationResult,
  IBroccoliBillingUsageSubstrate,
} from "./core/contracts/billing-usage.contracts.js";
export {
  DEFAULT_LOW_BALANCE_THRESHOLD_USD,
  DEFAULT_BILLING_USAGE_CONFIG,
  DEFAULT_BILLING_ACCOUNT_INFO,
} from "./core/contracts/billing-usage.contracts.js";

export { DeterministicThreadContextEngine } from "./agents/extensions/thread_context/deterministic-thread-context-engine.js";
export { ThreadContextSupervisor } from "./agents/extensions/thread_context/thread-context-supervisor.js";
export { BroccoliThreadContextSubstrate } from "./sessions/extensions/thread_context/broccoli-thread-context-substrate.js";
export { ThreadContextSnapshotManager } from "./sessions/extensions/thread_context/thread-context-snapshot-manager.js";
export { ThreadContextToolSuite } from "./tooling/extensions/thread_context/thread-context-tool-suite.js";
export { ThreadContextDashboardModal, type ThreadContextDashboardViewMode } from "./tui/components/thread-context-dashboard-modal.js";
export type {
  SecurityApprovalCallback,
  SudoPasswordCallback,
  AsyncTurnContextDescriptor,
  ContextPropagationConfig,
  ExecutionDispatchEvent,
  ContextPropagationMetrics,
  ThreadContextWorkspaceSnapshot,
  ThreadContextRow,
  ExecutionDispatchRow,
  ContextAuditRow,
  ThreadContextHealthStatus,
  ThreadContextHealthAuditReport,
  ThreadContextMetricsReport,
  ThreadContextGroupBy,
  ThreadContextSortBy,
  ThreadContextSortDirection,
  ThreadContextGroupedLane,
  ThreadContextDslQueryFilter,
  ThreadContextMutationUndoRecord,
  ThreadContextBulkMutationResult,
  IBroccoliThreadContextSubstrate,
} from "./core/contracts/thread-context.contracts.js";
export {
  DEFAULT_CONTEXT_PROPAGATION_CONFIG,
} from "./core/contracts/thread-context.contracts.js";

export { DeterministicEnvProbeEngine } from "./agents/extensions/env_probe/deterministic-env-probe-engine.js";
export { EnvProbeSupervisor } from "./agents/extensions/env_probe/env-probe-supervisor.js";
export { BroccoliEnvProbeSubstrate } from "./sessions/extensions/env_probe/broccoli-env-probe-substrate.js";
export { EnvProbeSnapshotManager } from "./sessions/extensions/env_probe/env-probe-snapshot-manager.js";
export { EnvProbeToolSuite } from "./tooling/extensions/env_probe/env-probe-tool-suite.js";
export type {
  ToolchainRuntimeKind,
  ToolchainAnomalyCategory,
  ToolchainProbeDescriptor,
  EnvProbeConfig,
  EnvProbeMetrics,
  EnvProbeWorkspaceSnapshot,
} from "./core/contracts/env-probe.contracts.js";
export {
  DEFAULT_ENV_PROBE_CONFIG,
} from "./core/contracts/env-probe.contracts.js";

export { DeterministicSkillLinterEngine } from "./agents/extensions/skill_linter/deterministic-skill-linter-engine.js";
export { SkillLinterSupervisor } from "./agents/extensions/skill_linter/skill-linter-supervisor.js";
export { BroccoliSkillLinterSubstrate } from "./sessions/extensions/skill_linter/broccoli-skill-linter-substrate.js";
export { SkillLinterSnapshotManager } from "./sessions/extensions/skill_linter/skill-linter-snapshot-manager.js";
export { SkillLinterToolSuite } from "./tooling/extensions/skill_linter/skill-linter-tool-suite.js";
export { SkillLinterDashboardModal, type SkillLinterDashboardViewMode } from "./tui/components/skill-linter-dashboard-modal.js";
export type {
  SkillLintSeverity,
  SkillLintRuleCode,
  SkillLintFinding,
  SkillLintReport,
  SkillLinterConfig,
  SkillLinterMetrics,
  SkillLinterWorkspaceSnapshot,
  SkillLintReportRow,
  SkillLintFindingRow,
  SkillLintAuditRow,
  SkillLinterHealthStatus,
  SkillLinterHealthAuditReport,
  SkillLinterMetricsReport,
  SkillLinterGroupBy,
  SkillLinterSortBy,
  SkillLinterSortDirection,
  SkillLinterGroupedLane,
  SkillLinterDslQueryFilter,
  SkillLinterMutationUndoRecord,
  SkillLinterBulkMutationResult,
  IBroccoliSkillLinterSubstrate,
} from "./core/contracts/skill-linter.contracts.js";
export {
  DEFAULT_SKILL_LINTER_CONFIG,
  SHELL_UTIL_TO_TOOL_MAP,
  MARKETING_BUZZWORDS,
  FORBIDDEN_SCAFFOLDING_FILES,
} from "./core/contracts/skill-linter.contracts.js";

export { DeterministicTerminalCleanerEngine } from "./agents/extensions/terminal_cleaner/deterministic-terminal-cleaner-engine.js";
export { TerminalCleanerSupervisor } from "./agents/extensions/terminal_cleaner/terminal-cleaner-supervisor.js";
export { BroccoliTerminalCleanerSubstrate } from "./sessions/extensions/terminal_cleaner/broccoli-terminal-cleaner-substrate.js";
export { TerminalCleanerSnapshotManager } from "./sessions/extensions/terminal_cleaner/terminal-cleaner-snapshot-manager.js";
export { TerminalCleanerToolSuite } from "./tooling/extensions/terminal_cleaner/terminal-cleaner-tool-suite.js";
export { TerminalCleanerDashboardModal, type TerminalCleanerDashboardViewMode } from "./tui/components/terminal-cleaner-dashboard-modal.js";
export type {
  AnsiCleanMode,
  BinaryAssetClassification,
  TerminalCleanResult,
  TerminalCleanerConfig,
  TerminalCleanerMetrics,
  TerminalCleanerWorkspaceSnapshot,
  TerminalCleanEventRow,
  TerminalCleanerAuditRow,
  TerminalCleanerHealthStatus,
  TerminalCleanerHealthAuditReport,
  TerminalCleanerMetricsReport,
  TerminalCleanerGroupBy,
  TerminalCleanerSortBy,
  TerminalCleanerSortDirection,
  TerminalCleanerGroupedLane,
  TerminalCleanerDslQueryFilter,
  TerminalCleanerMutationUndoRecord,
  TerminalCleanerBulkMutationResult,
  IBroccoliTerminalCleanerSubstrate,
} from "./core/contracts/terminal-cleaner.contracts.js";
export {
  DEFAULT_TERMINAL_CLEANER_CONFIG,
  TERMINAL_KNOWN_BINARY_EXTENSIONS,
  TERMINAL_OPAQUE_DOCUMENT_EXTENSIONS,
} from "./core/contracts/terminal-cleaner.contracts.js";

export { DeterministicStreamingScrubberEngine } from "./agents/extensions/streaming_scrubber/deterministic-streaming-scrubber-engine.js";
export { StreamingScrubberSupervisor } from "./agents/extensions/streaming_scrubber/streaming-scrubber-supervisor.js";
export { BroccoliStreamingScrubberSubstrate } from "./sessions/extensions/streaming_scrubber/broccoli-streaming-scrubber-substrate.js";
export { StreamingScrubberSnapshotManager } from "./sessions/extensions/streaming_scrubber/streaming-scrubber-snapshot-manager.js";
export { StreamingScrubberToolSuite } from "./tooling/extensions/streaming_scrubber/streaming-scrubber-tool-suite.js";
export { StreamingScrubberDashboardModal, type StreamingScrubberDashboardViewMode } from "./tui/components/streaming-scrubber-dashboard-modal.js";
export type {
  ReasoningTagName,
  StreamingScrubberState,
  StreamingScrubResult,
  StreamingThinkScrubberConfig,
  StreamingThinkScrubberMetrics,
  StreamingThinkScrubberWorkspaceSnapshot,
  StreamingScrubberEventRow,
  StreamingScrubberAuditRow,
  StreamingScrubberHealthStatus,
  StreamingScrubberHealthAuditReport,
  StreamingScrubberMetricsReport,
  StreamingScrubberGroupBy,
  StreamingScrubberSortBy,
  StreamingScrubberSortDirection,
  StreamingScrubberGroupedLane,
  StreamingScrubberDslQueryFilter,
  StreamingScrubberMutationUndoRecord,
  StreamingScrubberBulkMutationResult,
  IBroccoliStreamingScrubberSubstrate,
} from "./core/contracts/streaming-think-scrubber.contracts.js";
export {
  DEFAULT_REASONING_TAG_NAMES,
  DEFAULT_STREAMING_THINK_SCRUBBER_CONFIG,
} from "./core/contracts/streaming-think-scrubber.contracts.js";

export { DeterministicSelfRepoGuardEngine } from "./agents/extensions/self_repo_guard/deterministic-self-repo-guard-engine.js";
export { SelfRepoGuardSupervisor } from "./agents/extensions/self_repo_guard/self-repo-guard-supervisor.js";
export { BroccoliSelfRepoGuardSubstrate } from "./sessions/extensions/self_repo_guard/broccoli-self-repo-guard-substrate.js";
export { SelfRepoGuardSnapshotManager } from "./sessions/extensions/self_repo_guard/self-repo-guard-snapshot-manager.js";
export { SelfRepoGuardToolSuite } from "./tooling/extensions/self_repo_guard/self-repo-guard-tool-suite.js";
export { SelfRepoGuardDashboardModal, type SelfRepoGuardDashboardViewMode } from "./tui/components/self-repo-guard-dashboard-modal.js";
export type {
  GitOperationSafety,
  SelfRepoGuardConfig,
  SelfRepoGuardIncident,
  SelfRepoGuardMetrics,
  SelfRepoGuardVerdict,
  SelfRepoGuardWorkspaceSnapshot,
  SelfRepoGuardIncidentRow,
  SelfRepoGuardAuditRow,
  SelfRepoGuardHealthStatus,
  SelfRepoGuardHealthAuditReport,
  SelfRepoGuardMetricsReport,
  SelfRepoGuardGroupBy,
  SelfRepoGuardSortBy,
  SelfRepoGuardSortDirection,
  SelfRepoGuardGroupedLane,
  SelfRepoGuardDslQueryFilter,
  SelfRepoGuardMutationUndoRecord,
  SelfRepoGuardBulkMutationResult,
  IBroccoliSelfRepoGuardSubstrate,
} from "./core/contracts/self-repo-guard.contracts.js";
export {
  DEFAULT_SELF_REPO_GUARD_CONFIG,
  RESET_WORKTREE_MODES,
  SAFE_GIT_BUILTINS,
  STASH_SAFE_ACTIONS,
  WORKTREE_MUTATING_GIT_COMMANDS,
  WORKTREE_TARGET_ACTIONS,
} from "./core/contracts/self-repo-guard.contracts.js";

export { DeterministicSchemaSanitizerEngine } from "./agents/extensions/schema_sanitizer/deterministic-schema-sanitizer-engine.js";
export { SchemaSanitizerSupervisor } from "./agents/extensions/schema_sanitizer/schema-sanitizer-supervisor.js";
export { BroccoliSchemaSanitizerSubstrate } from "./sessions/extensions/schema_sanitizer/broccoli-schema-sanitizer-substrate.js";
export { SchemaSanitizerSnapshotManager } from "./sessions/extensions/schema_sanitizer/schema-sanitizer-snapshot-manager.js";
export { SchemaSanitizerToolSuite } from "./tooling/extensions/schema_sanitizer/schema-sanitizer-tool-suite.js";
export { SchemaSanitizerDashboardModal, type SchemaSanitizerDashboardViewMode } from "./tui/components/schema-sanitizer-dashboard-modal.js";
export type {
  SchemaSanitizationResult,
  SchemaSanitizerConfig,
  SchemaSanitizerMetrics,
  SchemaSanitizerWorkspaceSnapshot,
  SchemaSanitizationEventRow,
  SchemaSanitizerAuditRow,
  SchemaSanitizerHealthStatus,
  SchemaSanitizerHealthAuditReport,
  SchemaSanitizerMetricsReport,
  SchemaSanitizerGroupBy,
  SchemaSanitizerSortBy,
  SchemaSanitizerSortDirection,
  SchemaSanitizerGroupedLane,
  SchemaSanitizerDslQueryFilter,
  SchemaSanitizerMutationUndoRecord,
  SchemaSanitizerBulkMutationResult,
  IBroccoliSchemaSanitizerSubstrate,
} from "./core/contracts/schema-sanitizer.contracts.js";
export {
  DEFAULT_SCHEMA_SANITIZER_CONFIG,
  FORBIDDEN_REF_SIBLING_KEYWORDS,
  PROPERTY_KEY_INVALID_CHARS_REGEX,
  PROPERTY_KEY_REGEX,
  TOP_LEVEL_FORBIDDEN_COMBINATORS,
} from "./core/contracts/schema-sanitizer.contracts.js";

export { DeterministicNousPortalEngine } from "./agents/extensions/nous_portal/deterministic-nous-portal-engine.js";
export { NousPortalSupervisor } from "./agents/extensions/nous_portal/nous-portal-supervisor.js";
export { BroccoliNousPortalSubstrate } from "./sessions/extensions/nous_portal/broccoli-nous-portal-substrate.js";
export { NousPortalSnapshotManager } from "./sessions/extensions/nous_portal/nous-portal-snapshot-manager.js";
export { NousPortalToolSuite } from "./tooling/extensions/nous_portal/nous-portal-tool-suite.js";
export type {
  NousAccountInfoSource,
  NousPaidServiceAccessInfo,
  NousPortalAccountInfo,
  NousPortalCompletionResponse,
  NousPortalDeviceCodeSession,
  NousPortalDynamicModelItem,
  NousPortalModelSpec,
  NousPortalModelsFetchOptions,
  NousPortalModelsFetchResult,
  NousPortalRequestPayload,
  NousPortalStateSnapshot,
  NousPortalSubscriptionInfo,
  NousPortalTokenResponse,
  NousToolAccessInfo,
  NousToolCoverageCategory,
} from "./core/contracts/nous-portal.contracts.js";
export {
  DEFAULT_NOUS_CLIENT_ID,
  DEFAULT_NOUS_INFERENCE_URL,
  DEFAULT_NOUS_PORTAL_URL,
  DEFAULT_NOUS_SCOPE,
  NOUS_BILLING_MANAGE_SCOPE,
  NOUS_INFERENCE_INVOKE_SCOPE,
  NOUS_TOOL_COVERAGE_CATEGORIES,
} from "./core/contracts/nous-portal.contracts.js";

export { DeterministicGoalEngine } from "./agents/extensions/goals/deterministic-goal-engine.js";
export { GoalSupervisor } from "./agents/extensions/goals/goal-supervisor.js";
export { BroccoliGoalSubstrate } from "./sessions/extensions/goals/broccoli-goal-substrate.js";
export { GoalSnapshotManager } from "./sessions/extensions/goals/goal-snapshot-manager.js";
export { GoalToolSuite } from "./tooling/extensions/goals/goal-tool-suite.js";
export { GoalDesktopNotificationDispatcher } from "./tooling/extensions/goals/goal-notification-dispatcher.js";
export { GoalDashboardModal } from "./tui/components/goal-dashboard-modal.js";
export type {
  GoalCategory,
  GoalContract,
  GoalDiffResult,
  GoalEvaluationResult,
  GoalGate,
  GoalGatePolicy,
  GoalMilestone,
  GoalQueryFilter,
  GoalRetroSummary,
  GoalState,
  GoalStateSnapshot,
  GoalStatus,
  GoalStepEvent,
  GoalTemplate,
  GoalVerdict,
  MilestoneStatus,
  GoalNotificationEvent,
  GoalNotificationTrigger,
  GoalNotificationUrgency,
  GoalNotificationPreferences,
  GoalNotificationRecord,
  GoalGroupBy,
  GoalSortBy,
  GoalSortDirection,
  GoalExportFormat,
  GoalGroupedLane,
  GoalMutationUndoRecord,
  GoalVelocityMetrics,
  GoalHierarchyReport,
  GoalBulkMutationResult,
  GoalMilestoneChecklistItem,
  GoalSwarmBalanceResult,
  GoalArchiveResult,
  GoalCloneOptions,
  GoalHealthStatus,
  GoalHealthAuditReport,
  GoalRiskDiagnosis,
  GoalDecompositionResult,
  GoalMilestoneRollbackResult,
  GoalBurnupDataPoint,
  GoalBurnupForecast,
  GoalDslQueryFilter,
  GoalSwarmHandoffResult,
  GoalWatchdogReport,
} from "./core/contracts/goal.contracts.js";
export {
  DEFAULT_GATE_MAX_RETRIES,
  DEFAULT_GATE_TIMEOUT_SECONDS,
  DEFAULT_GOAL_JUDGE_TIMEOUT_MS,
  DEFAULT_GOAL_MAX_TURNS,
  GATE_OUTPUT_TAIL_CHARS,
} from "./core/contracts/goal.contracts.js";

export { DeterministicProfileEngine } from "./agents/extensions/profiles/deterministic-profile-engine.js";
export { ProfileSupervisor } from "./agents/extensions/profiles/profile-supervisor.js";
export { BroccoliProfileSubstrate } from "./sessions/extensions/profiles/broccoli-profile-substrate.js";
export { ProfileSnapshotManager } from "./sessions/extensions/profiles/profile-snapshot-manager.js";
export { ProfileToolSuite } from "./tooling/extensions/profiles/profile-tool-suite.js";
export { ProfileDashboardModal, type ProfileDashboardViewMode } from "./tui/components/profile-dashboard-modal.js";
export type {
  ProfileBlueprint,
  ProfileCategory,
  ProfileCloneKind,
  ProfileCloneOptions,
  ProfileDescriptor,
  ProfileDiffResult,
  ProfileExportBundle,
  ProfileMutation,
  ProfileQueryFilter,
  ProfileReasoningEffort,
  ProfileStatus,
  ProfileTelemetry,
  ProfileWorkspaceSnapshot,
  ProfileRow,
  ProfileBindingRow,
  ProfileTransitionRow,
  ProfileAuditRow,
  ProfileRevisionRow,
  ProfileHealthStatus,
  ProfileHealthAuditReport,
  ProfileMetricsReport,
  ProfileGroupBy,
  ProfileSortBy,
  ProfileSortDirection,
  ProfileGroupedLane,
  ProfileDslQueryFilter,
  ProfileMutationUndoRecord,
  ProfileBulkMutationResult,
  ProfileRevision,
  ProfileExecutionParameters,
  ProfileResponseFormat,
  ProfileGovernanceConfig,
  ProfileDelegationConfig,
  ProfileDelegationStrategy,
  ProfileMcpBinding,
  ProfileKnowledgeSource,
  KnowledgeSourceKind,
  ProfileGuardrailConfig,
  ContentModerationTier,
  ProfileConversationStarter,
  ProfileAxiomComplianceReport,
  ProfileTemplateHydrationContext,
  ProfileExemplar,
  ProfileMemoryPolicy,
  MemoryEvictionStrategy,
  ProfileModelFallback,
  FallbackTrigger,
  ProfileVoiceConfig,
  ProfileSecretBinding,
  ProfileVariant,
  ProfilePrefixCacheFrame,
  ProfileRunStatus,
  ProfileRunStep,
  ProfileRunState,
  ProfileEvalAssertion,
  ProfileTestCase,
  ProfileTestCaseResult,
  ProfileEvalReport,
  ProfileLifecycleEvent,
  ProfileLifecycleEventPayload,
  ProfileLifecycleHook,
  IBroccoliProfileSubstrate,
} from "./core/contracts/profile.contracts.js";
export { PROFILE_ID_REGEX } from "./core/contracts/profile.contracts.js";

export { DeterministicWalletEngine } from "./tooling/extensions/wallet/deterministic-wallet-engine.js";
export { WalletSupervisor } from "./agents/extensions/wallet/wallet-supervisor.js";
export { BroccoliWalletSubstrate } from "./sessions/extensions/wallet/broccoli-wallet-substrate.js";
export { WalletSnapshotManager } from "./sessions/extensions/wallet/wallet-snapshot-manager.js";
export { WalletToolSuite } from "./tooling/extensions/wallet/wallet-tool-suite.js";
export { WalletDashboardModal, type WalletDashboardViewMode } from "./tui/components/wallet-dashboard-modal.js";
export type {
  AccountAbstractionSimulationResult,
  AddressBookContact,
  AssetDelta,
  BridgeQuoteRequest,
  BridgeQuoteResult,
  ContractInspectionResult,
  DeFiHealthReport,
  DeFiPosition,
  EIP712SignatureAuditRequest,
  EIP712SignatureAuditResult,
  GasMarketReport,
  GasTierEstimate,
  MultiSigTransactionStage,
  SecurityRiskTier,
  SupportedChain,
  SwapQuoteRequest,
  SwapQuoteResult,
  SwapRouteHop,
  TokenAllowanceRecord,
  TokenHolding,
  TransactionSimulationRequest,
  TransactionSimulationResult,
  UserOperationRequest,
  WalletPortfolio,
  WalletSkillConfig,
  WalletSubstrateSnapshot,
  YieldOptimizationReport,
  YieldStakingPosition,
  WalletPortfolioRow,
  TokenAllowanceRow,
  WalletSimulationRow,
  WalletAuditRow,
  WalletHealthStatus,
  WalletHealthAuditReport,
  WalletMetricsReport,
  WalletGroupBy,
  WalletSortBy,
  WalletSortDirection,
  WalletGroupedLane,
  WalletDslQueryFilter,
  WalletMutationUndoRecord,
  WalletBulkMutationResult,
  IBroccoliWalletSubstrate,
} from "./core/contracts/wallet.contracts.js";

export { DeterministicEmailEngine } from "./tooling/extensions/email/deterministic-email-engine.js";
export { EmailSupervisor } from "./agents/extensions/email/email-supervisor.js";
export {
  EmailDesktopNotificationDispatcher,
  DEFAULT_EMAIL_NOTIFICATION_PREFERENCES,
} from "./tooling/extensions/email/email-notification-dispatcher.js";
export { BroccoliEmailSubstrate } from "./sessions/extensions/email/broccoli-email-substrate.js";
export { EmailSnapshotManager } from "./sessions/extensions/email/email-snapshot-manager.js";
export { EmailToolSuite } from "./tooling/extensions/email/email-tool-suite.js";
export { EmailInboxModal, type EmailInboxViewMode } from "./tui/components/email-inbox-modal.js";
export type {
  DataLossPreventionFinding,
  EmailAddress,
  EmailDisposition,
  EmailDraft,
  EmailMessage,
  EmailSkillConfig,
  EmailSubstrateSnapshot,
  EmailThreatAlert,
  EmailThreatAnalysis,
  EmailTonePersona,
  EmailTriageReport,
  FollowUpReminder,
  MeetingScheduleIntent,
  OutboundDlpReport,
  QuickReplyOption,
  SenderAuthSecurityStatus,
  SmartReplySuggestions,
  ThreadActionItem,
  ThreadCollisionLock,
  ThreadSummaryAnalysis,
  VipContactRule,
  EmailHealthStatus,
  EmailHealthAuditReport,
  EmailMetricsReport,
  EmailGroupBy,
  EmailSortBy,
  EmailSortDirection,
  EmailGroupedLane,
  EmailNotificationTrigger,
  EmailNotificationUrgency,
  EmailNotificationEvent,
  EmailNotificationPreferences,
  EmailNotificationRecord,
  EmailMutationUndoRecord,
  EmailDslQueryFilter,
  EmailBulkMutationResult,
  EmailMessageRow,
  EmailDraftRow,
  EmailTriageRow,
  EmailNotificationRow,
  EmailReminderRow,
  IBroccoliEmailSubstrate,
} from "./core/contracts/email.contracts.js";

export { DeterministicOtlpEngine } from "./tooling/extensions/otlp/deterministic-otlp-engine.js";
export { OtlpSupervisor } from "./agents/extensions/otlp/otlp-supervisor.js";
export { BroccoliOtlpSubstrate } from "./sessions/extensions/otlp/broccoli-otlp-substrate.js";
export { OtlpSnapshotManager } from "./sessions/extensions/otlp/otlp-snapshot-manager.js";
export { OtlpToolSuite } from "./tooling/extensions/otlp/otlp-tool-suite.js";

export { DeterministicAcpEngine } from "./tooling/extensions/acp/deterministic-acp-engine.js";
export { AcpSupervisor } from "./agents/extensions/acp/acp-supervisor.js";

export { DeterministicDaemonEngine } from "./tooling/extensions/daemon/deterministic-daemon-engine.js";
export { DaemonSupervisor } from "./agents/extensions/daemon/daemon-supervisor.js";
export { BroccoliDaemonSubstrate } from "./sessions/extensions/daemon/broccoli-daemon-substrate.js";
export { DaemonSnapshotManager } from "./sessions/extensions/daemon/daemon-snapshot-manager.js";
export { DaemonToolSuite } from "./tooling/extensions/daemon/daemon-tool-suite.js";

export { FilePredicateEvaluator } from "./agents/extensions/runbooks/file-predicate-evaluator.js";
export { MiniYamlParser, MiniYamlError } from "./agents/extensions/runbooks/mini-yaml-parser.js";
export { BroccoliRunbookSubstrate } from "./agents/extensions/runbooks/broccoli-runbook-substrate.js";
export { RunbookSupervisor, TransitionBlockedError } from "./agents/extensions/runbooks/runbook-supervisor.js";
export { RunbookToolSuite } from "./tooling/extensions/runbooks/runbook-tool-suite.js";
export { StatefulCompactionSynthesizer } from "./tooling/extensions/compaction/stateful-compaction-synthesizer.js";
export { RunbookHumanizer } from "./agents/extensions/runbooks/runbook-humanizer.js";
export { RunbookCatalog } from "./agents/extensions/runbooks/runbook-catalog.js";
export { RunbookDashboardModal, type RunbookDashboardViewMode } from "./tui/components/runbook-dashboard-modal.js";
export type * from "./core/contracts/runbook.contracts.js";
export type * from "./core/contracts/broccolidb-runbook.contracts.js";

export { MonolithFactory } from "./factories/monolith-factory.js";
export {
  CURRENT_EVOLUTION_BASELINE,
  CURRENT_REQUIRED_COMPONENTS,
  GrandMonolithSynthesizer,
} from "./factories/grand-monolith-synthesizer.js";
export type { CompositionVerification } from "./factories/grand-monolith-synthesizer.js";

/**
 * Deterministic Game Engine Monolith Composition Root.
 * Models agent interactions as frame ticks (`tick()`), state transitions as immutable snapshots (`GameStateSnapshot`),
 * and provides frame-perfect state rewind and replay.
 */
export class LumiMonolith implements IAgentEngine {
  /** Complete, future-compatible factory composition. Named fields below remain compatibility aliases. */
  readonly components: Readonly<ReturnType<typeof MonolithFactory.createEngine>>;
  readonly config: AgentConfig;
  readonly sessionContext: SessionContext;
  readonly sessionStore: PersistentSessionStore;
  readonly sessionCompactor: SessionCompactor;
  readonly sessionVfs: SessionVfs;
  readonly sessionMemoryStore: SessionMemoryStore;
  readonly stabilityDoctor: StabilityDoctor;
  readonly snapcompactEngine: SnapcompactEngine;
  readonly fileLockManager: FileLockManager;
  readonly snapshotLruCache: LruCache<string, GameStateSnapshot>;
  readonly gatewaySessionRegistry: GatewaySessionRegistry;
  readonly snapshotStorageIndex: SnapshotStorageIndex;
  readonly snowflakeIdGenerator: SnowflakeIdGenerator;
  readonly systemDirectoryResolver: SystemDirectoryResolver;
  readonly ringBuffer: FixedRingBuffer<string>;
  readonly semverComparator: SemanticVersionComparator;
  readonly gitIgnoreFilter: GitIgnoreFilter;
  readonly treeWalker: WorkspaceTreeWalker;
  readonly modelResolver: ModelResolver;
  readonly modelCatalog: ModelCatalog;
  readonly envKeyResolver: EnvironmentKeyResolver;
  readonly imageModelRegistry: ImageModelRegistry;
  readonly proxyGateway: LlmProxyGateway;
  readonly reasoningEffortController: ReasoningEffortController;
  readonly dynamicModelCache: DynamicModelCache;
  readonly loopPhaseController: LoopPhaseController;
  readonly budgetCalculator: ContextBudgetCalculator;
  readonly tokenTruncator: TokenTruncator;
  readonly templateEngine: PromptTemplateEngine;
  readonly variableInjector: DynamicVariableInjector;
  readonly connectionController: TransportConnectionController;
  readonly resilientFetchClient: ResilientFetchClient;
  readonly frontmatterParser: FrontmatterParser;
  readonly filePeeker: BoundedFilePeeker;
  readonly commandPathResolver: CommandPathResolver;
  readonly textSanitizer: TerminalTextSanitizer;
  readonly timingBuffer: MicrosecondTimingBuffer;
  readonly tabSpacingNormalizer: TabSpacingNormalizer;
  readonly schemaValidator: ToolCallSchemaValidator;
  readonly argumentCoercer: ArgumentCoercer;
  readonly batchAnchorer: BatchEditAnchorer;
  readonly diffSynthesizer: DiffSynthesizer;
  readonly masterBenchmarkOrchestrator: MasterBenchmarkOrchestrator;
  readonly mcpHub: McpHub;
  readonly ripgrepSearchService: RipgrepSearchService;
  readonly urlContentFetcher: UrlContentFetcher;
  readonly languageSyntaxParser: LanguageSyntaxParser;
  readonly completionGate: RoadmapCompletionGate;
  readonly checkpointDigest: RoadmapCheckpointDigest;
  readonly clipboardBridge: NativeClipboardBridge;
  readonly loopHarness: AgentLoopHarness;
  readonly postmortemDiagnostic: PostmortemDiagnostic;
  readonly processLifecycleManager: ProcessLifecycleManager;
  readonly providerAttribution: ProviderAttributionComposer;
  readonly stderrGuard: StderrGuardFilter;
  readonly keybindingsController: KeybindingsController;
  readonly httpDispatcher: HttpDispatcherOverlay;
  readonly authStorageVault: AuthStorageVault;
  readonly ttsrCoordinator: TTSRCoordinator;
  readonly centennialPassMarker: CentennialPassMarker;
  readonly systemHealthAggregator: SystemHealthAggregator;
  readonly codexOAuthManager: CodexOAuthManager;
  readonly codexProviderBridge: CodexProviderBridge;
  readonly openRouterEngine: OpenRouterProviderEngine;
  readonly setupWizard: SetupWizard;
  readonly slashRouter: AgentSlashRouter;
  readonly mentionResolver: MentionResolver;
  readonly swarmDispatcher: AgentSwarmDispatcher;
  readonly intelligenceEngine: WorkspaceIntelligenceEngine;
  readonly interactiveController: InteractiveModeController;
  readonly permissionController: CommandPermissionController;
  readonly commitGenerator: AgenticCommitGenerator;
  readonly gatewayServer: MonolithGatewayServer;
  readonly benchmarkEvaluator: MonolithBenchmarkEvaluator;
  readonly telemetryTracer: TelemetryTracer;
  readonly streamFormatter: StreamEventFormatter;
  readonly eyes: AstPerceptionEyes;
  readonly hands: AnchoredHands;
  readonly ears: ProgressStreamingEars;
  readonly skillsIngestor: SkillsIngestor;
  readonly skillTreeParser: DeterministicSkillTreeParser;
  readonly anchoredSkillMutator: AnchoredSkillMutator;
  readonly skillTreeToolSuite: SkillTreeToolSuite;
  readonly skillTreeSubstrate: BroccoliSkillTreeSubstrate;
  readonly skillTreeSnapshotManager: SkillTreeSnapshotManager;
  readonly deterministicSkillCurator: DeterministicSkillCurator;
  readonly evolutionarySkillEngine: EvolutionarySkillTreeEngine;
  readonly skillStrategyEngine: SkillStrategyEngine;
  readonly skillTreePromptComposer: SkillTreePromptComposer;
  readonly antiDegenerationGuard: AntiDegenerationGuard;
  readonly deterministicSoulParser: DeterministicSoulParser;
  readonly anchoredSoulMutator: AnchoredSoulMutator;
  readonly soulToolSuite: SoulToolSuite;
  readonly broccoliSoulSubstrate: BroccoliSoulSubstrate;
  readonly soulSnapshotManager: SoulSnapshotManager;
  readonly soulThreatGuard: SoulThreatGuard;
  readonly soulPromptComposer: SoulPromptComposer;
  readonly anchoredWorktreeManager: AnchoredWorktreeManager;
  readonly subagentBudgetGovernor: SubagentBudgetGovernor;
  readonly subagentLifecycleGuard: SubagentLifecycleGuard;
  readonly subagentVfsBrancher: SubagentVfsBrancher;
  readonly monolithSwarmDelegator: MonolithSwarmDelegator;
  readonly swarmToolSuite: SwarmToolSuite;
  readonly deterministicBlueprintCatalog: DeterministicBlueprintCatalog;
  readonly anchoredCronJobManager: AnchoredCronJobManager;
  readonly cronToolSuite: CronToolSuite;
  readonly broccoliCronSubstrate: BroccoliCronSubstrate;
  readonly cronSnapshotManager: CronSnapshotManager;
  readonly cronLifecycleGuard: CronLifecycleGuard;
  readonly monolithCronScheduler: MonolithCronScheduler;
  readonly cdpNavigationGuard: CdpNavigationGuard;
  readonly cdpDialogPolicyEngine: CdpDialogPolicyEngine;
  readonly cdpDomSnapshotter: CdpDomSnapshotter;
  readonly cdpProtocolClient: CdpProtocolClient;
  readonly broccoliBrowserSubstrate: BroccoliBrowserSubstrate;
  readonly browserSnapshotManager: BrowserSnapshotManager;
  readonly cdpSupervisorEngine: CdpSupervisorEngine;
  readonly cdpToolSuite: CdpToolSuite;
  readonly broccoliCredentialSubstrate: BroccoliCredentialSubstrate;
  readonly deterministicCredentialPool: DeterministicCredentialPool;
  readonly credentialCircuitBreaker: CredentialCircuitBreaker;
  readonly monolithCredentialManager: MonolithCredentialManager;
  readonly credentialSnapshotManager: CredentialSnapshotManager;
  readonly credentialToolSuite: CredentialToolSuite;
  readonly telegramProtocolAdapter: TelegramProtocolAdapter;
  readonly discordProtocolAdapter: DiscordProtocolAdapter;
  readonly slackProtocolAdapter: SlackProtocolAdapter;
  readonly webhookProtocolAdapter: WebhookProtocolAdapter;
  readonly broccoliGatewaySubstrate: BroccoliGatewaySubstrate;
  readonly gatewayDeliveryLedger: GatewayDeliveryLedger;
  readonly gatewaySnapshotManager: GatewaySnapshotManager;
  readonly gatewayDispatcherEngine: GatewayDispatcherEngine;
  readonly deterministicGatewayEngine: DeterministicGatewayEngine;
  readonly gatewaySupervisor: GatewaySupervisor;
  readonly gatewayToolSuite: GatewayToolSuite;
  readonly broccoliIntegrationsSubstrate: BroccoliIntegrationsSubstrate;
  readonly integrationsSnapshotManager: IntegrationsSnapshotManager;
  readonly deterministicIntegrationsEngine: DeterministicIntegrationsEngine;
  readonly integrationsSupervisor: IntegrationsSupervisor;
  readonly integrationsToolSuite: IntegrationsToolSuite;
  readonly headTailBudgetGovernor: HeadTailBudgetGovernor;
  readonly deterministicToolPruner: DeterministicToolPruner;
  readonly broccoliCompressionSubstrate: BroccoliCompressionSubstrate;
  readonly compressionSnapshotManager: CompressionSnapshotManager;
  readonly trajectoryCompactorEngine: TrajectoryCompactorEngine;
  readonly contextCompressionSupervisor: ContextCompressionSupervisor;
  readonly compressionToolSuite: CompressionToolSuite;
  readonly ftsQuerySanitizer: FtsQuerySanitizer;
  readonly broccoliSearchSubstrate: BroccoliSearchSubstrate;
  readonly searchSnapshotManager: SearchSnapshotManager;
  readonly deterministicSessionSearchEngine: DeterministicSessionSearchEngine;
  readonly searchToolSuite: SearchToolSuite;
  readonly secretScrubber: SecretScrubber;
  readonly localEnvironmentAdapter: LocalEnvironmentAdapter;
  readonly dockerEnvironmentAdapter: DockerEnvironmentAdapter;
  readonly broccoliEnvironmentSubstrate: BroccoliEnvironmentSubstrate;
  readonly environmentSnapshotManager: EnvironmentSnapshotManager;
  readonly environmentSupervisorEngine: EnvironmentSupervisorEngine;
  readonly environmentToolSuite: EnvironmentToolSuite;
  readonly jitteredBackoffGovernor: JitteredBackoffGovernor;
  readonly deterministicErrorClassifier: DeterministicErrorClassifier;
  readonly broccoliFaultSubstrate: BroccoliFaultSubstrate;
  readonly faultSnapshotManager: FaultSnapshotManager;
  readonly faultRecoverySupervisor: FaultRecoverySupervisor;
  readonly faultDiagnosticToolSuite: FaultDiagnosticToolSuite;
  readonly acpProtocolCodec: AcpProtocolCodec;
  readonly acpPermissionGate: AcpPermissionGate;
  readonly broccoliAcpSubstrate: BroccoliAcpSubstrate;
  readonly acpSnapshotManager: AcpSnapshotManager;
  readonly acpBridgeServer: AcpBridgeServer;
  readonly acpToolSuite: AcpToolSuite;
  readonly mcpTransportCodec: McpTransportCodec;
  readonly mcpSecurityScrubber: McpSecurityScrubber;
  readonly broccoliMcpSubstrate: BroccoliMcpSubstrate;
  readonly mcpSnapshotManager: McpSnapshotManager;
  readonly mcpSupervisorEngine: McpSupervisorEngine;
  readonly mcpClientToolSuite: McpClientToolSuite;
  readonly processOutputRingBuffer: ProcessOutputRingBuffer;
  readonly processSecuritySandbox: ProcessSecuritySandbox;
  readonly broccoliProcessSubstrate: BroccoliProcessSubstrate;
  readonly processSnapshotManager: ProcessSnapshotManager;
  readonly processSupervisorEngine: ProcessSupervisorEngine;
  readonly processToolSuite: ProcessToolSuite;
  readonly securityRiskClassifier: SecurityRiskClassifier;
  readonly approvalHashLedger: ApprovalHashLedger;
  readonly broccoliArbiterSubstrate: BroccoliArbiterSubstrate;
  readonly arbiterSnapshotManager: ArbiterSnapshotManager;
  readonly interactiveSecurityArbiter: InteractiveSecurityArbiter;
  readonly arbiterToolSuite: ArbiterToolSuite;
  readonly semanticKnowledgeGraph: SemanticKnowledgeGraph;
  readonly broccoliLearningSubstrate: BroccoliLearningSubstrate;
  readonly learningSnapshotManager: LearningSnapshotManager;
  readonly continuousLearningCurator: ContinuousLearningCurator;
  readonly learningCuratorToolSuite: LearningCuratorToolSuite;
  readonly deterministicPatchEngine: DeterministicPatchEngine;
  readonly broccoliPatchSubstrate: BroccoliPatchSubstrate;
  readonly patchSnapshotManager: PatchSnapshotManager;
  readonly atomicMutationSupervisor: AtomicMutationSupervisor;
  readonly fileMutationToolSuite: FileMutationToolSuite;
  readonly deterministicLspEngine: DeterministicLspEngine;
  readonly broccoliLspSubstrate: BroccoliLspSubstrate;
  readonly lspSnapshotManager: LspSnapshotManager;
  readonly semanticCodeSupervisor: SemanticCodeSupervisor;
  readonly lspCodeIntelligenceToolSuite: LspCodeIntelligenceToolSuite;
  readonly deterministicAudioCodec: DeterministicAudioCodec;
  readonly broccoliVoiceSubstrate: BroccoliVoiceSubstrate;
  readonly voiceSnapshotManager: VoiceSnapshotManager;
  readonly voiceSpeechSupervisor: VoiceSpeechSupervisor;
  readonly voiceSpeechToolSuite: VoiceSpeechToolSuite;
  readonly deterministicImageCodec: DeterministicImageCodec;
  readonly broccoliVisionSubstrate: BroccoliVisionSubstrate;
  readonly visionSnapshotManager: VisionSnapshotManager;
  readonly multimodalVisionSupervisor: MultimodalVisionSupervisor;
  readonly multimodalVisionToolSuite: MultimodalVisionToolSuite;
  readonly deterministicKanbanEngine: DeterministicKanbanEngine;
  readonly broccoliKanbanSubstrate: BroccoliKanbanSubstrate;
  readonly kanbanSnapshotManager: KanbanSnapshotManager;
  readonly kanbanBoardSupervisor: KanbanBoardSupervisor;
  readonly kanbanOrchestrationToolSuite: KanbanOrchestrationToolSuite;
  readonly deterministicWebEngine: DeterministicWebEngine;
  readonly broccoliWebSubstrate: BroccoliWebSubstrate;
  readonly webSnapshotManager: WebSnapshotManager;
  readonly webIntelligenceSupervisor: WebIntelligenceSupervisor;
  readonly webIntelligenceToolSuite: WebIntelligenceToolSuite;
  readonly deterministicCodeExecutor: DeterministicCodeExecutor;
  readonly broccoliExecutionSubstrate: BroccoliExecutionSubstrate;
  readonly executionSnapshotManager: ExecutionSnapshotManager;
  readonly codeExecutionSupervisor: CodeExecutionSupervisor;
  readonly codeExecutionToolSuite: CodeExecutionToolSuite;
  readonly deterministicBatchEvaluator: DeterministicBatchEvaluator;
  readonly broccoliBatchSubstrate: BroccoliBatchSubstrate;
  readonly batchSnapshotManager: BatchSnapshotManager;
  readonly batchEvaluationSupervisor: BatchEvaluationSupervisor;
  readonly batchEvaluationToolSuite: BatchEvaluationToolSuite;
  readonly deterministicClarifyEngine: DeterministicClarifyEngine;
  readonly broccoliClarifySubstrate: BroccoliClarifySubstrate;
  readonly clarifySnapshotManager: ClarifySnapshotManager;
  readonly clarifyInquirySupervisor: ClarifyInquirySupervisor;
  readonly clarifyInquiryToolSuite: ClarifyInquiryToolSuite;
  readonly deterministicThreatScanner: DeterministicThreatScanner;
  readonly broccoliThreatSubstrate: BroccoliThreatSubstrate;
  readonly threatSnapshotManager: ThreatSnapshotManager;
  readonly threatFirewallSupervisor: ThreatFirewallSupervisor;
  readonly threatFirewallToolSuite: ThreatFirewallToolSuite;
  readonly deterministicCasStore: DeterministicCasStore;
  readonly broccoliCheckpointSubstrate: BroccoliCheckpointSubstrate;
  readonly checkpointSnapshotManager: CheckpointSnapshotManager;
  readonly checkpointKernelSupervisor: CheckpointKernelSupervisor;
  readonly checkpointKernelToolSuite: CheckpointKernelToolSuite;
  readonly deterministicDisplayDriver: DeterministicDisplayDriver;
  readonly broccoliDisplaySubstrate: BroccoliDisplaySubstrate;
  readonly displaySnapshotManager: DisplaySnapshotManager;
  readonly computerUseSupervisor: ComputerUseSupervisor;
  readonly computerUseToolSuite: ComputerUseToolSuite;
  readonly deterministicSkillsHub: DeterministicSkillsHub;
  readonly broccoliSkillsHubSubstrate: BroccoliSkillsHubSubstrate;
  readonly skillsHubSnapshotManager: SkillsHubSnapshotManager;
  readonly skillsHubSupervisor: SkillsHubSupervisor;
  readonly skillsHubToolSuite: SkillsHubToolSuite;
  readonly deterministicCostGovernor: DeterministicCostGovernor;
  readonly broccoliCostSubstrate: BroccoliCostSubstrate;
  readonly costSnapshotManager: CostSnapshotManager;
  readonly costGovernanceSupervisor: CostGovernanceSupervisor;
  readonly costGovernanceToolSuite: CostGovernanceToolSuite;
  readonly deterministicToolDiscloser: DeterministicToolDiscloser;
  readonly broccoliDisclosureSubstrate: BroccoliDisclosureSubstrate;
  readonly toolDisclosureSnapshotManager: ToolDisclosureSnapshotManager;
  readonly toolDisclosureSupervisor: ToolDisclosureSupervisor;
  readonly toolDisclosureToolSuite: ToolDisclosureToolSuite;
  readonly deterministicEvidenceLedger: DeterministicEvidenceLedger;
  readonly broccoliEvidenceSubstrate: BroccoliEvidenceSubstrate;
  readonly evidenceSnapshotManager: EvidenceSnapshotManager;
  readonly verificationEvidenceSupervisor: VerificationEvidenceSupervisor;
  readonly verificationEvidenceToolSuite: VerificationEvidenceToolSuite;
  readonly deterministicPromptCacher: DeterministicPromptCacher;
  readonly broccoliPromptCacheSubstrate: BroccoliPromptCacheSubstrate;
  readonly promptCacheSnapshotManager: PromptCacheSnapshotManager;
  readonly promptCacheSupervisor: PromptCacheSupervisor;
  readonly promptCacheToolSuite: PromptCacheToolSuite;
  readonly deterministicToolSegmenter: DeterministicToolSegmenter;
  readonly broccoliExecutionGuardSubstrate: BroccoliExecutionGuardSubstrate;
  readonly executionGuardSnapshotManager: ExecutionGuardSnapshotManager;
  readonly toolExecutionGuardSupervisor: ToolExecutionGuardSupervisor;
  readonly toolExecutionGuardToolSuite: ToolExecutionGuardToolSuite;
  readonly deterministicSecretRedactor: DeterministicSecretRedactor;
  readonly broccoliRedactionSubstrate: BroccoliRedactionSubstrate;
  readonly redactionSnapshotManager: RedactionSnapshotManager;
  readonly secretRedactionSupervisor: SecretRedactionSupervisor;
  readonly secretRedactionToolSuite: SecretRedactionToolSuite;
  readonly deterministicReviewEvaluator: DeterministicReviewEvaluator;
  readonly broccoliReviewSubstrate: BroccoliReviewSubstrate;
  readonly reviewSnapshotManager: ReviewSnapshotManager;
  readonly backgroundReviewSupervisor: BackgroundReviewSupervisor;
  readonly backgroundReviewToolSuite: BackgroundReviewToolSuite;
  readonly deterministicDiagnosticDoctor: DeterministicDiagnosticDoctor;
  readonly broccoliDoctorSubstrate: BroccoliDoctorSubstrate;
  readonly doctorSnapshotManager: DoctorSnapshotManager;
  readonly diagnosticDoctorSupervisor: DiagnosticDoctorSupervisor;
  readonly diagnosticDoctorToolSuite: DiagnosticDoctorToolSuite;
  readonly deterministicAuthFederator: DeterministicAuthFederator;
  readonly broccoliAuthSubstrate: BroccoliAuthSubstrate;
  readonly authSnapshotManager: AuthSnapshotManager;
  readonly identityFederationSupervisor: IdentityFederationSupervisor;
  readonly identityFederationToolSuite: IdentityFederationToolSuite;
  readonly deterministicSessionArchiver: DeterministicSessionArchiver;
  readonly broccoliArchiveSubstrate: BroccoliArchiveSubstrate;
  readonly archiveSnapshotManager: ArchiveSnapshotManager;
  readonly sessionArchiveSupervisor: SessionArchiveSupervisor;
  readonly sessionArchiveToolSuite: SessionArchiveToolSuite;
  readonly deterministicSkinEngine: DeterministicSkinEngine;
  readonly broccoliSkinSubstrate: BroccoliSkinSubstrate;
  readonly skinSnapshotManager: SkinSnapshotManager;
  readonly terminalSkinSupervisor: TerminalSkinSupervisor;
  readonly terminalSkinToolSuite: TerminalSkinToolSuite;
  readonly deterministicAuxiliaryRouter: DeterministicAuxiliaryRouter;
  readonly broccoliAuxiliarySubstrate: BroccoliAuxiliarySubstrate;
  readonly auxiliarySnapshotManager: AuxiliarySnapshotManager;
  readonly auxiliaryRouterSupervisor: AuxiliaryRouterSupervisor;
  readonly auxiliaryRouterToolSuite: AuxiliaryRouterToolSuite;
  readonly deterministicReasoningScrubber: DeterministicReasoningScrubber;
  readonly broccoliReasoningSubstrate: BroccoliReasoningSubstrate;
  readonly reasoningSnapshotManager: ReasoningSnapshotManager;
  readonly reasoningSupervisor: ReasoningSupervisor;
  readonly reasoningToolSuite: ReasoningToolSuite;
  readonly deterministicFuzzyMatcher: DeterministicFuzzyMatcher;
  readonly broccoliFuzzySubstrate: BroccoliFuzzySubstrate;
  readonly fuzzySnapshotManager: FuzzySnapshotManager;
  readonly fuzzyMatcherSupervisor: FuzzyMatcherSupervisor;
  readonly fuzzyMatcherToolSuite: FuzzyMatcherToolSuite;
  readonly deterministicTitleGenerator: DeterministicTitleGenerator;
  readonly conversationInsightsEngine: ConversationInsightsEngine;
  readonly titleInsightsSupervisor: TitleInsightsSupervisor;
  readonly broccoliTitleInsightsSubstrate: BroccoliTitleInsightsSubstrate;
  readonly titleInsightsSnapshotManager: TitleInsightsSnapshotManager;
  readonly titleInsightsToolSuite: TitleInsightsToolSuite;
  readonly deterministicHeredocSanitizer: DeterministicHeredocSanitizer;
  readonly terminalDiagnosticsEngine: TerminalDiagnosticsEngine;
  readonly heredocTerminalSupervisor: HeredocTerminalSupervisor;
  readonly broccoliHeredocTerminalSubstrate: BroccoliHeredocTerminalSubstrate;
  readonly heredocTerminalSnapshotManager: HeredocTerminalSnapshotManager;
  readonly heredocTerminalToolSuite: HeredocTerminalToolSuite;
  readonly deterministicStealthBrowser: DeterministicStealthBrowser;
  readonly stealthBrowserSupervisor: StealthBrowserSupervisor;
  readonly broccoliStealthBrowserSubstrate: BroccoliStealthBrowserSubstrate;
  readonly stealthBrowserSnapshotManager: StealthBrowserSnapshotManager;
  readonly stealthBrowserToolSuite: StealthBrowserToolSuite;
  readonly deterministicSkillsSyncClient: DeterministicSkillsSyncClient;
  readonly skillsSyncSupervisor: SkillsSyncSupervisor;
  readonly broccoliSkillsSyncSubstrate: BroccoliSkillsSyncSubstrate;
  readonly skillsSyncSnapshotManager: SkillsSyncSnapshotManager;
  readonly skillsSyncToolSuite: SkillsSyncToolSuite;
  readonly deterministicPreflightScanner: DeterministicPreflightScanner;
  readonly preflightScannerSupervisor: PreflightScannerSupervisor;
  readonly broccoliPreflightSubstrate: BroccoliPreflightSubstrate;
  readonly preflightSnapshotManager: PreflightSnapshotManager;
  readonly preflightToolSuite: PreflightToolSuite;
  readonly deterministicAudioSniffer: DeterministicAudioSniffer;
  readonly audioContainerSupervisor: AudioContainerSupervisor;
  readonly broccoliAudioContainerSubstrate: BroccoliAudioContainerSubstrate;
  readonly audioContainerSnapshotManager: AudioContainerSnapshotManager;
  readonly audioContainerToolSuite: AudioContainerToolSuite;
  readonly deterministicSpeechTextNormalizer: DeterministicSpeechTextNormalizer;
  readonly speechNormalizerSupervisor: SpeechNormalizerSupervisor;
  readonly broccoliSpeechNormalizerSubstrate: BroccoliSpeechNormalizerSubstrate;
  readonly speechNormalizerSnapshotManager: SpeechNormalizerSnapshotManager;
  readonly speechNormalizerToolSuite: SpeechNormalizerToolSuite;
  readonly deterministicDocExtractor: DeterministicDocExtractor;
  readonly docExtractorSupervisor: DocExtractorSupervisor;
  readonly broccoliDocExtractorSubstrate: BroccoliDocExtractorSubstrate;
  readonly docExtractorSnapshotManager: DocExtractorSnapshotManager;
  readonly docExtractorToolSuite: DocExtractorToolSuite;
  readonly deterministicSpillVault: DeterministicSpillVault;
  readonly spillVaultSupervisor: SpillVaultSupervisor;
  readonly broccoliSpillVaultSubstrate: BroccoliSpillVaultSubstrate;
  readonly spillVaultSnapshotManager: SpillVaultSnapshotManager;
  readonly spillVaultToolSuite: SpillVaultToolSuite;
  readonly deterministicUrlSafety: DeterministicUrlSafety;
  readonly urlSafetySupervisor: UrlSafetySupervisor;
  readonly broccoliUrlSafetySubstrate: BroccoliUrlSafetySubstrate;
  readonly urlSafetySnapshotManager: UrlSafetySnapshotManager;
  readonly urlSafetyToolSuite: UrlSafetyToolSuite;
  readonly deterministicV4aPatch: DeterministicV4aPatch;
  readonly v4aPatchSupervisor: V4aPatchSupervisor;
  readonly broccoliV4aPatchSubstrate: BroccoliV4aPatchSubstrate;
  readonly v4aPatchSnapshotManager: V4aPatchSnapshotManager;
  readonly v4aPatchToolSuite: V4aPatchToolSuite;
  readonly deterministicWebsitePolicy: DeterministicWebsitePolicy;
  readonly websitePolicySupervisor: WebsitePolicySupervisor;
  readonly broccoliWebsitePolicySubstrate: BroccoliWebsitePolicySubstrate;
  readonly websitePolicySnapshotManager: WebsitePolicySnapshotManager;
  readonly websitePolicyToolSuite: WebsitePolicyToolSuite;
  readonly deterministicWakeWord: DeterministicWakeWord;
  readonly wakeWordSupervisor: WakeWordSupervisor;
  readonly broccoliWakeWordSubstrate: BroccoliWakeWordSubstrate;
  readonly wakeWordSnapshotManager: WakeWordSnapshotManager;
  readonly wakeWordToolSuite: WakeWordToolSuite;
  readonly deterministicMediaResolver: DeterministicMediaResolver;
  readonly mediaSourceSupervisor: MediaSourceSupervisor;
  readonly broccoliMediaSourceSubstrate: BroccoliMediaSourceSubstrate;
  readonly mediaSourceSnapshotManager: MediaSourceSnapshotManager;
  readonly mediaSourceToolSuite: MediaSourceToolSuite;
  readonly deterministicGitWorktree: DeterministicGitWorktree;
  readonly worktreeSupervisor: WorktreeSupervisor;
  readonly broccoliWorktreeSubstrate: BroccoliWorktreeSubstrate;
  readonly worktreeSnapshotManager: WorktreeSnapshotManager;
  readonly worktreeToolSuite: WorktreeToolSuite;
  readonly deterministicSpeechTranscriber: DeterministicSpeechTranscriber;
  readonly transcriptionSupervisor: TranscriptionSupervisor;
  readonly broccoliTranscriptionSubstrate: BroccoliTranscriptionSubstrate;
  readonly transcriptionSnapshotManager: TranscriptionSnapshotManager;
  readonly transcriptionToolSuite: TranscriptionToolSuite;
  readonly deterministicDeadlineEngine: DeterministicDeadlineEngine;
  readonly deadlineSupervisor: DeadlineSupervisor;
  readonly broccoliDeadlineSubstrate: BroccoliDeadlineSubstrate;
  readonly deadlineSnapshotManager: DeadlineSnapshotManager;
  readonly deadlineToolSuite: DeadlineToolSuite;
  readonly deterministicFileSafetyGuard: DeterministicFileSafetyGuard;
  readonly fileSafetySupervisor: FileSafetySupervisor;
  readonly broccoliFileSafetySubstrate: BroccoliFileSafetySubstrate;
  readonly fileSafetySnapshotManager: FileSafetySnapshotManager;
  readonly fileSafetyToolSuite: FileSafetyToolSuite;
  readonly deterministicContextBreakdownEngine: DeterministicContextBreakdownEngine;
  readonly contextBreakdownSupervisor: ContextBreakdownSupervisor;
  readonly broccoliContextBreakdownSubstrate: BroccoliContextBreakdownSubstrate;
  readonly contextBreakdownSnapshotManager: ContextBreakdownSnapshotManager;
  readonly contextBreakdownToolSuite: ContextBreakdownToolSuite;
  readonly deterministicOsvParser: DeterministicOsvParser;
  readonly osvScannerSupervisor: OsvScannerSupervisor;
  readonly broccoliOsvSubstrate: BroccoliOsvSubstrate;
  readonly osvScannerSnapshotManager: OsvScannerSnapshotManager;
  readonly osvScannerToolSuite: OsvScannerToolSuite;
  readonly deterministicSubdirHintEngine: DeterministicSubdirHintEngine;
  readonly subdirHintsSupervisor: SubdirHintsSupervisor;
  readonly broccoliSubdirHintsSubstrate: BroccoliSubdirHintsSubstrate;
  readonly subdirHintsSnapshotManager: SubdirHintsSnapshotManager;
  readonly subdirHintsToolSuite: SubdirHintsToolSuite;
  readonly deterministicStreamDiagEngine: DeterministicStreamDiagEngine;
  readonly streamDiagSupervisor: StreamDiagSupervisor;
  readonly broccoliStreamDiagSubstrate: BroccoliStreamDiagSubstrate;
  readonly streamDiagSnapshotManager: StreamDiagSnapshotManager;
  readonly streamDiagToolSuite: StreamDiagToolSuite;
  readonly deterministicTurnRetryEngine: DeterministicTurnRetryEngine;
  readonly turnRetrySupervisor: TurnRetrySupervisor;
  readonly broccoliTurnRetrySubstrate: BroccoliTurnRetrySubstrate;
  readonly turnRetrySnapshotManager: TurnRetrySnapshotManager;
  readonly turnRetryToolSuite: TurnRetryToolSuite;
  readonly deterministicBillingUsageEngine: DeterministicBillingUsageEngine;
  readonly billingUsageSupervisor: BillingUsageSupervisor;
  readonly broccoliBillingUsageSubstrate: BroccoliBillingUsageSubstrate;
  readonly billingUsageSnapshotManager: BillingUsageSnapshotManager;
  readonly billingUsageToolSuite: BillingUsageToolSuite;
  readonly deterministicThreadContextEngine: DeterministicThreadContextEngine;
  readonly threadContextSupervisor: ThreadContextSupervisor;
  readonly broccoliThreadContextSubstrate: BroccoliThreadContextSubstrate;
  readonly threadContextSnapshotManager: ThreadContextSnapshotManager;
  readonly threadContextToolSuite: ThreadContextToolSuite;
  readonly deterministicEnvProbeEngine: DeterministicEnvProbeEngine;
  readonly envProbeSupervisor: EnvProbeSupervisor;
  readonly broccoliEnvProbeSubstrate: BroccoliEnvProbeSubstrate;
  readonly envProbeSnapshotManager: EnvProbeSnapshotManager;
  readonly envProbeToolSuite: EnvProbeToolSuite;
  readonly deterministicSkillLinterEngine: DeterministicSkillLinterEngine;
  readonly skillLinterSupervisor: SkillLinterSupervisor;
  readonly broccoliSkillLinterSubstrate: BroccoliSkillLinterSubstrate;
  readonly skillLinterSnapshotManager: SkillLinterSnapshotManager;
  readonly skillLinterToolSuite: SkillLinterToolSuite;
  readonly deterministicTerminalCleanerEngine: DeterministicTerminalCleanerEngine;
  readonly terminalCleanerSupervisor: TerminalCleanerSupervisor;
  readonly broccoliTerminalCleanerSubstrate: BroccoliTerminalCleanerSubstrate;
  readonly terminalCleanerSnapshotManager: TerminalCleanerSnapshotManager;
  readonly terminalCleanerToolSuite: TerminalCleanerToolSuite;
  readonly deterministicStreamingScrubberEngine: DeterministicStreamingScrubberEngine;
  readonly streamingScrubberSupervisor: StreamingScrubberSupervisor;
  readonly broccoliStreamingScrubberSubstrate: BroccoliStreamingScrubberSubstrate;
  readonly streamingScrubberSnapshotManager: StreamingScrubberSnapshotManager;
  readonly streamingScrubberToolSuite: StreamingScrubberToolSuite;
  readonly deterministicSelfRepoGuardEngine: DeterministicSelfRepoGuardEngine;
  readonly selfRepoGuardSupervisor: SelfRepoGuardSupervisor;
  readonly broccoliSelfRepoGuardSubstrate: BroccoliSelfRepoGuardSubstrate;
  readonly selfRepoGuardSnapshotManager: SelfRepoGuardSnapshotManager;
  readonly selfRepoGuardToolSuite: SelfRepoGuardToolSuite;
  readonly deterministicSchemaSanitizerEngine: DeterministicSchemaSanitizerEngine;
  readonly schemaSanitizerSupervisor: SchemaSanitizerSupervisor;
  readonly broccoliSchemaSanitizerSubstrate: BroccoliSchemaSanitizerSubstrate;
  readonly schemaSanitizerSnapshotManager: SchemaSanitizerSnapshotManager;
  readonly schemaSanitizerToolSuite: SchemaSanitizerToolSuite;
  readonly deterministicNousPortalEngine: DeterministicNousPortalEngine;
  readonly nousPortalSupervisor: NousPortalSupervisor;
  readonly broccoliNousPortalSubstrate: BroccoliNousPortalSubstrate;
  readonly nousPortalSnapshotManager: NousPortalSnapshotManager;
  readonly nousPortalToolSuite: NousPortalToolSuite;
  readonly deterministicGoalEngine: DeterministicGoalEngine;
  readonly goalSupervisor: GoalSupervisor;
  readonly broccoliGoalSubstrate: BroccoliGoalSubstrate;
  readonly goalSnapshotManager: GoalSnapshotManager;
  readonly goalToolSuite: GoalToolSuite;
  readonly deterministicProfileEngine: DeterministicProfileEngine;
  readonly profileSupervisor: ProfileSupervisor;
  readonly broccoliProfileSubstrate: BroccoliProfileSubstrate;
  readonly profileSnapshotManager: ProfileSnapshotManager;
  readonly profileToolSuite: ProfileToolSuite;
  readonly databaseKernel: BroccoliDatabaseKernel;
  readonly databaseToolSuite: DatabaseToolSuite;
  readonly deterministicWalletEngine: DeterministicWalletEngine;
  readonly walletSupervisor: WalletSupervisor;
  readonly broccoliWalletSubstrate: BroccoliWalletSubstrate;
  readonly walletSnapshotManager: WalletSnapshotManager;
  readonly walletToolSuite: WalletToolSuite;
  readonly deterministicEmailEngine: DeterministicEmailEngine;
  readonly emailSupervisor: EmailSupervisor;
  readonly broccoliEmailSubstrate: BroccoliEmailSubstrate;
  readonly emailSnapshotManager: EmailSnapshotManager;
  readonly emailToolSuite: EmailToolSuite;
  readonly deterministicOtlpEngine: DeterministicOtlpEngine;
  readonly otlpSupervisor: OtlpSupervisor;
  readonly broccoliOtlpSubstrate: BroccoliOtlpSubstrate;
  readonly otlpSnapshotManager: OtlpSnapshotManager;
  readonly otlpToolSuite: OtlpToolSuite;
  readonly deterministicAcpEngine: DeterministicAcpEngine;
  readonly acpSupervisor: AcpSupervisor;
  readonly deterministicDaemonEngine: DeterministicDaemonEngine;
  readonly daemonSupervisor: DaemonSupervisor;
  readonly broccoliDaemonSubstrate: BroccoliDaemonSubstrate;
  readonly daemonSnapshotManager: DaemonSnapshotManager;
  readonly daemonToolSuite: DaemonToolSuite;
  readonly broccoliRunbookSubstrate: BroccoliRunbookSubstrate;
  readonly runbookSupervisor: RunbookSupervisor;
  readonly runbookToolSuite: RunbookToolSuite;
  readonly toolRegistry: ValidatingToolRegistry;
  readonly promptComposer: PromptComposer;
  readonly agentEngine: AgentEngine;

  constructor(options: MonolithFactoryOptions = {}) {
    const components = MonolithFactory.createEngine(options);
    this.components = components;
    this.config = components.config;
    this.sessionContext = components.sessionContext;
    this.sessionStore = components.sessionStore;
    this.sessionCompactor = components.sessionCompactor;
    this.sessionVfs = components.sessionVfs;
    this.sessionMemoryStore = components.sessionMemoryStore;
    this.stabilityDoctor = components.stabilityDoctor;
    this.snapcompactEngine = components.snapcompactEngine;
    this.fileLockManager = components.fileLockManager;
    this.snapshotLruCache = components.snapshotLruCache;
    this.gatewaySessionRegistry = components.gatewaySessionRegistry;
    this.snapshotStorageIndex = components.snapshotStorageIndex;
    this.snowflakeIdGenerator = components.snowflakeIdGenerator;
    this.systemDirectoryResolver = components.systemDirectoryResolver;
    this.ringBuffer = components.ringBuffer;
    this.semverComparator = components.semverComparator;
    this.gitIgnoreFilter = components.gitIgnoreFilter;
    this.treeWalker = components.treeWalker;
    this.modelResolver = components.modelResolver;
    this.modelCatalog = components.modelCatalog;
    this.envKeyResolver = components.envKeyResolver;
    this.imageModelRegistry = components.imageModelRegistry;
    this.proxyGateway = components.proxyGateway;
    this.reasoningEffortController = components.reasoningEffortController;
    this.dynamicModelCache = components.dynamicModelCache;
    this.loopPhaseController = components.loopPhaseController;
    this.budgetCalculator = components.budgetCalculator;
    this.tokenTruncator = components.tokenTruncator;
    this.templateEngine = components.templateEngine;
    this.variableInjector = components.variableInjector;
    this.connectionController = components.connectionController;
    this.resilientFetchClient = components.resilientFetchClient;
    this.frontmatterParser = components.frontmatterParser;
    this.filePeeker = components.filePeeker;
    this.commandPathResolver = components.commandPathResolver;
    this.textSanitizer = components.textSanitizer;
    this.timingBuffer = components.timingBuffer;
    this.tabSpacingNormalizer = components.tabSpacingNormalizer;
    this.schemaValidator = components.schemaValidator;
    this.argumentCoercer = components.argumentCoercer;
    this.batchAnchorer = components.batchAnchorer;
    this.diffSynthesizer = components.diffSynthesizer;
    this.masterBenchmarkOrchestrator = components.masterBenchmarkOrchestrator;
    this.mcpHub = components.mcpHub;
    this.ripgrepSearchService = components.ripgrepSearchService;
    this.urlContentFetcher = components.urlContentFetcher;
    this.languageSyntaxParser = components.languageSyntaxParser;
    this.completionGate = components.completionGate;
    this.checkpointDigest = components.checkpointDigest;
    this.clipboardBridge = components.clipboardBridge;
    this.loopHarness = components.loopHarness;
    this.postmortemDiagnostic = components.postmortemDiagnostic;
    this.processLifecycleManager = components.processLifecycleManager;
    this.providerAttribution = components.providerAttribution;
    this.stderrGuard = components.stderrGuard;
    this.keybindingsController = components.keybindingsController;
    this.httpDispatcher = components.httpDispatcher;
    this.authStorageVault = components.authStorageVault;
    this.ttsrCoordinator = components.ttsrCoordinator;
    this.centennialPassMarker = components.centennialPassMarker;
    this.systemHealthAggregator = components.systemHealthAggregator;
    this.codexOAuthManager = components.codexOAuthManager;
    this.codexProviderBridge = components.codexProviderBridge;
    this.openRouterEngine = components.openRouterEngine;
    this.setupWizard = components.setupWizard;
    this.slashRouter = components.slashRouter;
    this.mentionResolver = components.mentionResolver;
    this.swarmDispatcher = components.swarmDispatcher;
    this.intelligenceEngine = components.intelligenceEngine;
    this.interactiveController = components.interactiveController;
    this.permissionController = components.permissionController;
    this.commitGenerator = components.commitGenerator;
    this.gatewayServer = components.gatewayServer;
    this.benchmarkEvaluator = components.benchmarkEvaluator;
    this.telemetryTracer = components.telemetryTracer;
    this.streamFormatter = components.streamFormatter;
    this.eyes = components.eyes;
    this.hands = components.hands;
    this.ears = components.ears;
    this.skillsIngestor = components.skillsIngestor;
    this.skillTreeParser = components.skillTreeParser;
    this.anchoredSkillMutator = components.anchoredSkillMutator;
    this.skillTreeToolSuite = components.skillTreeToolSuite;
    this.skillTreeSubstrate = components.skillTreeSubstrate;
    this.skillTreeSnapshotManager = components.skillTreeSnapshotManager;
    this.deterministicSkillCurator = components.deterministicSkillCurator;
    this.evolutionarySkillEngine = components.evolutionarySkillEngine;
    this.skillStrategyEngine = components.skillStrategyEngine;
    this.skillTreePromptComposer = components.skillTreePromptComposer;
    this.antiDegenerationGuard = components.antiDegenerationGuard;
    this.deterministicSoulParser = components.deterministicSoulParser;
    this.anchoredSoulMutator = components.anchoredSoulMutator;
    this.soulToolSuite = components.soulToolSuite;
    this.broccoliSoulSubstrate = components.broccoliSoulSubstrate;
    this.soulSnapshotManager = components.soulSnapshotManager;
    this.soulThreatGuard = components.soulThreatGuard;
    this.soulPromptComposer = components.soulPromptComposer;
    this.anchoredWorktreeManager = components.anchoredWorktreeManager;
    this.subagentBudgetGovernor = components.subagentBudgetGovernor;
    this.subagentLifecycleGuard = components.subagentLifecycleGuard;
    this.subagentVfsBrancher = components.subagentVfsBrancher;
    this.monolithSwarmDelegator = components.monolithSwarmDelegator;
    this.swarmToolSuite = components.swarmToolSuite;
    this.deterministicBlueprintCatalog = components.deterministicBlueprintCatalog;
    this.anchoredCronJobManager = components.anchoredCronJobManager;
    this.cronToolSuite = components.cronToolSuite;
    this.broccoliCronSubstrate = components.broccoliCronSubstrate;
    this.cronSnapshotManager = components.cronSnapshotManager;
    this.cronLifecycleGuard = components.cronLifecycleGuard;
    this.monolithCronScheduler = components.monolithCronScheduler;
    this.cdpNavigationGuard = components.cdpNavigationGuard;
    this.cdpDialogPolicyEngine = components.cdpDialogPolicyEngine;
    this.cdpDomSnapshotter = components.cdpDomSnapshotter;
    this.cdpProtocolClient = components.cdpProtocolClient;
    this.broccoliBrowserSubstrate = components.broccoliBrowserSubstrate;
    this.browserSnapshotManager = components.browserSnapshotManager;
    this.cdpSupervisorEngine = components.cdpSupervisorEngine;
    this.cdpToolSuite = components.cdpToolSuite;
    this.broccoliCredentialSubstrate = components.broccoliCredentialSubstrate;
    this.deterministicCredentialPool = components.deterministicCredentialPool;
    this.credentialCircuitBreaker = components.credentialCircuitBreaker;
    this.monolithCredentialManager = components.monolithCredentialManager;
    this.credentialSnapshotManager = components.credentialSnapshotManager;
    this.credentialToolSuite = components.credentialToolSuite;
    this.telegramProtocolAdapter = components.telegramProtocolAdapter;
    this.discordProtocolAdapter = components.discordProtocolAdapter;
    this.slackProtocolAdapter = components.slackProtocolAdapter;
    this.webhookProtocolAdapter = components.webhookProtocolAdapter;
    this.broccoliGatewaySubstrate = components.broccoliGatewaySubstrate;
    this.gatewayDeliveryLedger = components.gatewayDeliveryLedger;
    this.gatewaySnapshotManager = components.gatewaySnapshotManager;
    this.gatewayDispatcherEngine = components.gatewayDispatcherEngine;
    this.deterministicGatewayEngine = components.deterministicGatewayEngine;
    this.gatewaySupervisor = components.gatewaySupervisor;
    this.gatewayToolSuite = components.gatewayToolSuite;
    this.broccoliIntegrationsSubstrate = components.broccoliIntegrationsSubstrate;
    this.integrationsSnapshotManager = components.integrationsSnapshotManager;
    this.deterministicIntegrationsEngine = components.deterministicIntegrationsEngine;
    this.integrationsSupervisor = components.integrationsSupervisor;
    this.integrationsToolSuite = components.integrationsToolSuite;
    this.headTailBudgetGovernor = components.headTailBudgetGovernor;
    this.deterministicToolPruner = components.deterministicToolPruner;
    this.broccoliCompressionSubstrate = components.broccoliCompressionSubstrate;
    this.compressionSnapshotManager = components.compressionSnapshotManager;
    this.trajectoryCompactorEngine = components.trajectoryCompactorEngine;
    this.contextCompressionSupervisor = components.contextCompressionSupervisor;
    this.compressionToolSuite = components.compressionToolSuite;
    this.ftsQuerySanitizer = components.ftsQuerySanitizer;
    this.broccoliSearchSubstrate = components.broccoliSearchSubstrate;
    this.searchSnapshotManager = components.searchSnapshotManager;
    this.deterministicSessionSearchEngine = components.deterministicSessionSearchEngine;
    this.searchToolSuite = components.searchToolSuite;
    this.secretScrubber = components.secretScrubber;
    this.localEnvironmentAdapter = components.localEnvironmentAdapter;
    this.dockerEnvironmentAdapter = components.dockerEnvironmentAdapter;
    this.broccoliEnvironmentSubstrate = components.broccoliEnvironmentSubstrate;
    this.environmentSnapshotManager = components.environmentSnapshotManager;
    this.environmentSupervisorEngine = components.environmentSupervisorEngine;
    this.environmentToolSuite = components.environmentToolSuite;
    this.jitteredBackoffGovernor = components.jitteredBackoffGovernor;
    this.deterministicErrorClassifier = components.deterministicErrorClassifier;
    this.broccoliFaultSubstrate = components.broccoliFaultSubstrate;
    this.faultSnapshotManager = components.faultSnapshotManager;
    this.faultRecoverySupervisor = components.faultRecoverySupervisor;
    this.faultDiagnosticToolSuite = components.faultDiagnosticToolSuite;
    this.acpProtocolCodec = components.acpProtocolCodec;
    this.acpPermissionGate = components.acpPermissionGate;
    this.broccoliAcpSubstrate = components.broccoliAcpSubstrate;
    this.acpSnapshotManager = components.acpSnapshotManager;
    this.acpBridgeServer = components.acpBridgeServer;
    this.acpToolSuite = components.acpToolSuite;
    this.mcpTransportCodec = components.mcpTransportCodec;
    this.mcpSecurityScrubber = components.mcpSecurityScrubber;
    this.broccoliMcpSubstrate = components.broccoliMcpSubstrate;
    this.mcpSnapshotManager = components.mcpSnapshotManager;
    this.mcpSupervisorEngine = components.mcpSupervisorEngine;
    this.mcpClientToolSuite = components.mcpClientToolSuite;
    this.processOutputRingBuffer = components.processOutputRingBuffer;
    this.processSecuritySandbox = components.processSecuritySandbox;
    this.broccoliProcessSubstrate = components.broccoliProcessSubstrate;
    this.processSnapshotManager = components.processSnapshotManager;
    this.processSupervisorEngine = components.processSupervisorEngine;
    this.processToolSuite = components.processToolSuite;
    this.securityRiskClassifier = components.securityRiskClassifier;
    this.approvalHashLedger = components.approvalHashLedger;
    this.broccoliArbiterSubstrate = components.broccoliArbiterSubstrate;
    this.arbiterSnapshotManager = components.arbiterSnapshotManager;
    this.interactiveSecurityArbiter = components.interactiveSecurityArbiter;
    this.arbiterToolSuite = components.arbiterToolSuite;
    this.semanticKnowledgeGraph = components.semanticKnowledgeGraph;
    this.broccoliLearningSubstrate = components.broccoliLearningSubstrate;
    this.learningSnapshotManager = components.learningSnapshotManager;
    this.continuousLearningCurator = components.continuousLearningCurator;
    this.learningCuratorToolSuite = components.learningCuratorToolSuite;
    this.deterministicPatchEngine = components.deterministicPatchEngine;
    this.broccoliPatchSubstrate = components.broccoliPatchSubstrate;
    this.patchSnapshotManager = components.patchSnapshotManager;
    this.atomicMutationSupervisor = components.atomicMutationSupervisor;
    this.fileMutationToolSuite = components.fileMutationToolSuite;
    this.deterministicLspEngine = components.deterministicLspEngine;
    this.broccoliLspSubstrate = components.broccoliLspSubstrate;
    this.lspSnapshotManager = components.lspSnapshotManager;
    this.semanticCodeSupervisor = components.semanticCodeSupervisor;
    this.lspCodeIntelligenceToolSuite = components.lspCodeIntelligenceToolSuite;
    this.deterministicAudioCodec = components.deterministicAudioCodec;
    this.broccoliVoiceSubstrate = components.broccoliVoiceSubstrate;
    this.voiceSnapshotManager = components.voiceSnapshotManager;
    this.voiceSpeechSupervisor = components.voiceSpeechSupervisor;
    this.voiceSpeechToolSuite = components.voiceSpeechToolSuite;
    this.deterministicImageCodec = components.deterministicImageCodec;
    this.broccoliVisionSubstrate = components.broccoliVisionSubstrate;
    this.visionSnapshotManager = components.visionSnapshotManager;
    this.multimodalVisionSupervisor = components.multimodalVisionSupervisor;
    this.multimodalVisionToolSuite = components.multimodalVisionToolSuite;
    this.deterministicKanbanEngine = components.deterministicKanbanEngine;
    this.broccoliKanbanSubstrate = components.broccoliKanbanSubstrate;
    this.kanbanSnapshotManager = components.kanbanSnapshotManager;
    this.kanbanBoardSupervisor = components.kanbanBoardSupervisor;
    this.kanbanOrchestrationToolSuite = components.kanbanOrchestrationToolSuite;
    this.deterministicWebEngine = components.deterministicWebEngine;
    this.broccoliWebSubstrate = components.broccoliWebSubstrate;
    this.webSnapshotManager = components.webSnapshotManager;
    this.webIntelligenceSupervisor = components.webIntelligenceSupervisor;
    this.webIntelligenceToolSuite = components.webIntelligenceToolSuite;
    this.deterministicCodeExecutor = components.deterministicCodeExecutor;
    this.broccoliExecutionSubstrate = components.broccoliExecutionSubstrate;
    this.executionSnapshotManager = components.executionSnapshotManager;
    this.codeExecutionSupervisor = components.codeExecutionSupervisor;
    this.codeExecutionToolSuite = components.codeExecutionToolSuite;
    this.deterministicBatchEvaluator = components.deterministicBatchEvaluator;
    this.broccoliBatchSubstrate = components.broccoliBatchSubstrate;
    this.batchSnapshotManager = components.batchSnapshotManager;
    this.batchEvaluationSupervisor = components.batchEvaluationSupervisor;
    this.batchEvaluationToolSuite = components.batchEvaluationToolSuite;
    this.deterministicClarifyEngine = components.deterministicClarifyEngine;
    this.broccoliClarifySubstrate = components.broccoliClarifySubstrate;
    this.clarifySnapshotManager = components.clarifySnapshotManager;
    this.clarifyInquirySupervisor = components.clarifyInquirySupervisor;
    this.clarifyInquiryToolSuite = components.clarifyInquiryToolSuite;
    this.deterministicThreatScanner = components.deterministicThreatScanner;
    this.broccoliThreatSubstrate = components.broccoliThreatSubstrate;
    this.threatSnapshotManager = components.threatSnapshotManager;
    this.threatFirewallSupervisor = components.threatFirewallSupervisor;
    this.threatFirewallToolSuite = components.threatFirewallToolSuite;
    this.deterministicCasStore = components.deterministicCasStore;
    this.broccoliCheckpointSubstrate = components.broccoliCheckpointSubstrate;
    this.checkpointSnapshotManager = components.checkpointSnapshotManager;
    this.checkpointKernelSupervisor = components.checkpointKernelSupervisor;
    this.checkpointKernelToolSuite = components.checkpointKernelToolSuite;
    this.deterministicDisplayDriver = components.deterministicDisplayDriver;
    this.broccoliDisplaySubstrate = components.broccoliDisplaySubstrate;
    this.displaySnapshotManager = components.displaySnapshotManager;
    this.computerUseSupervisor = components.computerUseSupervisor;
    this.computerUseToolSuite = components.computerUseToolSuite;
    this.deterministicSkillsHub = components.deterministicSkillsHub;
    this.broccoliSkillsHubSubstrate = components.broccoliSkillsHubSubstrate;
    this.skillsHubSnapshotManager = components.skillsHubSnapshotManager;
    this.skillsHubSupervisor = components.skillsHubSupervisor;
    this.skillsHubToolSuite = components.skillsHubToolSuite;
    this.deterministicCostGovernor = components.deterministicCostGovernor;
    this.broccoliCostSubstrate = components.broccoliCostSubstrate;
    this.costSnapshotManager = components.costSnapshotManager;
    this.costGovernanceSupervisor = components.costGovernanceSupervisor;
    this.costGovernanceToolSuite = components.costGovernanceToolSuite;
    this.deterministicToolDiscloser = components.deterministicToolDiscloser;
    this.broccoliDisclosureSubstrate = components.broccoliDisclosureSubstrate;
    this.toolDisclosureSnapshotManager = components.toolDisclosureSnapshotManager;
    this.toolDisclosureSupervisor = components.toolDisclosureSupervisor;
    this.toolDisclosureToolSuite = components.toolDisclosureToolSuite;
    this.deterministicEvidenceLedger = components.deterministicEvidenceLedger;
    this.broccoliEvidenceSubstrate = components.broccoliEvidenceSubstrate;
    this.evidenceSnapshotManager = components.evidenceSnapshotManager;
    this.verificationEvidenceSupervisor = components.verificationEvidenceSupervisor;
    this.verificationEvidenceToolSuite = components.verificationEvidenceToolSuite;
    this.deterministicPromptCacher = components.deterministicPromptCacher;
    this.broccoliPromptCacheSubstrate = components.broccoliPromptCacheSubstrate;
    this.promptCacheSnapshotManager = components.promptCacheSnapshotManager;
    this.promptCacheSupervisor = components.promptCacheSupervisor;
    this.promptCacheToolSuite = components.promptCacheToolSuite;
    this.deterministicToolSegmenter = components.deterministicToolSegmenter;
    this.broccoliExecutionGuardSubstrate = components.broccoliExecutionGuardSubstrate;
    this.executionGuardSnapshotManager = components.executionGuardSnapshotManager;
    this.toolExecutionGuardSupervisor = components.toolExecutionGuardSupervisor;
    this.toolExecutionGuardToolSuite = components.toolExecutionGuardToolSuite;
    this.deterministicSecretRedactor = components.deterministicSecretRedactor;
    this.broccoliRedactionSubstrate = components.broccoliRedactionSubstrate;
    this.redactionSnapshotManager = components.redactionSnapshotManager;
    this.secretRedactionSupervisor = components.secretRedactionSupervisor;
    this.secretRedactionToolSuite = components.secretRedactionToolSuite;
    this.deterministicReviewEvaluator = components.deterministicReviewEvaluator;
    this.broccoliReviewSubstrate = components.broccoliReviewSubstrate;
    this.reviewSnapshotManager = components.reviewSnapshotManager;
    this.backgroundReviewSupervisor = components.backgroundReviewSupervisor;
    this.backgroundReviewToolSuite = components.backgroundReviewToolSuite;
    this.deterministicDiagnosticDoctor = components.deterministicDiagnosticDoctor;
    this.broccoliDoctorSubstrate = components.broccoliDoctorSubstrate;
    this.doctorSnapshotManager = components.doctorSnapshotManager;
    this.diagnosticDoctorSupervisor = components.diagnosticDoctorSupervisor;
    this.diagnosticDoctorToolSuite = components.diagnosticDoctorToolSuite;
    this.deterministicAuthFederator = components.deterministicAuthFederator;
    this.broccoliAuthSubstrate = components.broccoliAuthSubstrate;
    this.authSnapshotManager = components.authSnapshotManager;
    this.identityFederationSupervisor = components.identityFederationSupervisor;
    this.identityFederationToolSuite = components.identityFederationToolSuite;
    this.deterministicSessionArchiver = components.deterministicSessionArchiver;
    this.broccoliArchiveSubstrate = components.broccoliArchiveSubstrate;
    this.archiveSnapshotManager = components.archiveSnapshotManager;
    this.sessionArchiveSupervisor = components.sessionArchiveSupervisor;
    this.sessionArchiveToolSuite = components.sessionArchiveToolSuite;
    this.deterministicSkinEngine = components.deterministicSkinEngine;
    this.broccoliSkinSubstrate = components.broccoliSkinSubstrate;
    this.skinSnapshotManager = components.skinSnapshotManager;
    this.terminalSkinSupervisor = components.terminalSkinSupervisor;
    this.terminalSkinToolSuite = components.terminalSkinToolSuite;
    this.deterministicAuxiliaryRouter = components.deterministicAuxiliaryRouter;
    this.broccoliAuxiliarySubstrate = components.broccoliAuxiliarySubstrate;
    this.auxiliarySnapshotManager = components.auxiliarySnapshotManager;
    this.auxiliaryRouterSupervisor = components.auxiliaryRouterSupervisor;
    this.auxiliaryRouterToolSuite = components.auxiliaryRouterToolSuite;
    this.deterministicReasoningScrubber = components.deterministicReasoningScrubber;
    this.broccoliReasoningSubstrate = components.broccoliReasoningSubstrate;
    this.reasoningSnapshotManager = components.reasoningSnapshotManager;
    this.reasoningSupervisor = components.reasoningSupervisor;
    this.reasoningToolSuite = components.reasoningToolSuite;
    this.deterministicFuzzyMatcher = components.deterministicFuzzyMatcher;
    this.broccoliFuzzySubstrate = components.broccoliFuzzySubstrate;
    this.fuzzySnapshotManager = components.fuzzySnapshotManager;
    this.fuzzyMatcherSupervisor = components.fuzzyMatcherSupervisor;
    this.fuzzyMatcherToolSuite = components.fuzzyMatcherToolSuite;
    this.deterministicTitleGenerator = components.deterministicTitleGenerator;
    this.conversationInsightsEngine = components.conversationInsightsEngine;
    this.titleInsightsSupervisor = components.titleInsightsSupervisor;
    this.broccoliTitleInsightsSubstrate = components.broccoliTitleInsightsSubstrate;
    this.titleInsightsSnapshotManager = components.titleInsightsSnapshotManager;
    this.titleInsightsToolSuite = components.titleInsightsToolSuite;
    this.deterministicHeredocSanitizer = components.deterministicHeredocSanitizer;
    this.terminalDiagnosticsEngine = components.terminalDiagnosticsEngine;
    this.heredocTerminalSupervisor = components.heredocTerminalSupervisor;
    this.broccoliHeredocTerminalSubstrate = components.broccoliHeredocTerminalSubstrate;
    this.heredocTerminalSnapshotManager = components.heredocTerminalSnapshotManager;
    this.heredocTerminalToolSuite = components.heredocTerminalToolSuite;
    this.deterministicStealthBrowser = components.deterministicStealthBrowser;
    this.stealthBrowserSupervisor = components.stealthBrowserSupervisor;
    this.broccoliStealthBrowserSubstrate = components.broccoliStealthBrowserSubstrate;
    this.stealthBrowserSnapshotManager = components.stealthBrowserSnapshotManager;
    this.stealthBrowserToolSuite = components.stealthBrowserToolSuite;
    this.deterministicSkillsSyncClient = components.deterministicSkillsSyncClient;
    this.skillsSyncSupervisor = components.skillsSyncSupervisor;
    this.broccoliSkillsSyncSubstrate = components.broccoliSkillsSyncSubstrate;
    this.skillsSyncSnapshotManager = components.skillsSyncSnapshotManager;
    this.skillsSyncToolSuite = components.skillsSyncToolSuite;
    this.deterministicPreflightScanner = components.deterministicPreflightScanner;
    this.preflightScannerSupervisor = components.preflightScannerSupervisor;
    this.broccoliPreflightSubstrate = components.broccoliPreflightSubstrate;
    this.preflightSnapshotManager = components.preflightSnapshotManager;
    this.preflightToolSuite = components.preflightToolSuite;
    this.deterministicAudioSniffer = components.deterministicAudioSniffer;
    this.audioContainerSupervisor = components.audioContainerSupervisor;
    this.broccoliAudioContainerSubstrate = components.broccoliAudioContainerSubstrate;
    this.audioContainerSnapshotManager = components.audioContainerSnapshotManager;
    this.audioContainerToolSuite = components.audioContainerToolSuite;
    this.deterministicSpeechTextNormalizer = components.deterministicSpeechTextNormalizer;
    this.speechNormalizerSupervisor = components.speechNormalizerSupervisor;
    this.broccoliSpeechNormalizerSubstrate = components.broccoliSpeechNormalizerSubstrate;
    this.speechNormalizerSnapshotManager = components.speechNormalizerSnapshotManager;
    this.speechNormalizerToolSuite = components.speechNormalizerToolSuite;
    this.deterministicDocExtractor = components.deterministicDocExtractor;
    this.docExtractorSupervisor = components.docExtractorSupervisor;
    this.broccoliDocExtractorSubstrate = components.broccoliDocExtractorSubstrate;
    this.docExtractorSnapshotManager = components.docExtractorSnapshotManager;
    this.docExtractorToolSuite = components.docExtractorToolSuite;
    this.deterministicSpillVault = components.deterministicSpillVault;
    this.spillVaultSupervisor = components.spillVaultSupervisor;
    this.broccoliSpillVaultSubstrate = components.broccoliSpillVaultSubstrate;
    this.spillVaultSnapshotManager = components.spillVaultSnapshotManager;
    this.spillVaultToolSuite = components.spillVaultToolSuite;
    this.deterministicUrlSafety = components.deterministicUrlSafety;
    this.urlSafetySupervisor = components.urlSafetySupervisor;
    this.broccoliUrlSafetySubstrate = components.broccoliUrlSafetySubstrate;
    this.urlSafetySnapshotManager = components.urlSafetySnapshotManager;
    this.urlSafetyToolSuite = components.urlSafetyToolSuite;
    this.deterministicV4aPatch = components.deterministicV4aPatch;
    this.v4aPatchSupervisor = components.v4aPatchSupervisor;
    this.broccoliV4aPatchSubstrate = components.broccoliV4aPatchSubstrate;
    this.v4aPatchSnapshotManager = components.v4aPatchSnapshotManager;
    this.v4aPatchToolSuite = components.v4aPatchToolSuite;
    this.deterministicWebsitePolicy = components.deterministicWebsitePolicy;
    this.websitePolicySupervisor = components.websitePolicySupervisor;
    this.broccoliWebsitePolicySubstrate = components.broccoliWebsitePolicySubstrate;
    this.websitePolicySnapshotManager = components.websitePolicySnapshotManager;
    this.websitePolicyToolSuite = components.websitePolicyToolSuite;
    this.deterministicWakeWord = components.deterministicWakeWord;
    this.wakeWordSupervisor = components.wakeWordSupervisor;
    this.broccoliWakeWordSubstrate = components.broccoliWakeWordSubstrate;
    this.wakeWordSnapshotManager = components.wakeWordSnapshotManager;
    this.wakeWordToolSuite = components.wakeWordToolSuite;
    this.deterministicMediaResolver = components.deterministicMediaResolver;
    this.mediaSourceSupervisor = components.mediaSourceSupervisor;
    this.broccoliMediaSourceSubstrate = components.broccoliMediaSourceSubstrate;
    this.mediaSourceSnapshotManager = components.mediaSourceSnapshotManager;
    this.mediaSourceToolSuite = components.mediaSourceToolSuite;
    this.deterministicGitWorktree = components.deterministicGitWorktree;
    this.worktreeSupervisor = components.worktreeSupervisor;
    this.broccoliWorktreeSubstrate = components.broccoliWorktreeSubstrate;
    this.worktreeSnapshotManager = components.worktreeSnapshotManager;
    this.worktreeToolSuite = components.worktreeToolSuite;
    this.deterministicSpeechTranscriber = components.deterministicSpeechTranscriber;
    this.transcriptionSupervisor = components.transcriptionSupervisor;
    this.broccoliTranscriptionSubstrate = components.broccoliTranscriptionSubstrate;
    this.transcriptionSnapshotManager = components.transcriptionSnapshotManager;
    this.transcriptionToolSuite = components.transcriptionToolSuite;
    this.deterministicDeadlineEngine = components.deterministicDeadlineEngine;
    this.deadlineSupervisor = components.deadlineSupervisor;
    this.broccoliDeadlineSubstrate = components.broccoliDeadlineSubstrate;
    this.deadlineSnapshotManager = components.deadlineSnapshotManager;
    this.deadlineToolSuite = components.deadlineToolSuite;
    this.deterministicFileSafetyGuard = components.deterministicFileSafetyGuard;
    this.fileSafetySupervisor = components.fileSafetySupervisor;
    this.broccoliFileSafetySubstrate = components.broccoliFileSafetySubstrate;
    this.fileSafetySnapshotManager = components.fileSafetySnapshotManager;
    this.fileSafetyToolSuite = components.fileSafetyToolSuite;
    this.deterministicContextBreakdownEngine = components.deterministicContextBreakdownEngine;
    this.contextBreakdownSupervisor = components.contextBreakdownSupervisor;
    this.broccoliContextBreakdownSubstrate = components.broccoliContextBreakdownSubstrate;
    this.contextBreakdownSnapshotManager = components.contextBreakdownSnapshotManager;
    this.contextBreakdownToolSuite = components.contextBreakdownToolSuite;
    this.deterministicOsvParser = components.deterministicOsvParser;
    this.osvScannerSupervisor = components.osvScannerSupervisor;
    this.broccoliOsvSubstrate = components.broccoliOsvSubstrate;
    this.osvScannerSnapshotManager = components.osvScannerSnapshotManager;
    this.osvScannerToolSuite = components.osvScannerToolSuite;
    this.deterministicSubdirHintEngine = components.deterministicSubdirHintEngine;
    this.subdirHintsSupervisor = components.subdirHintsSupervisor;
    this.broccoliSubdirHintsSubstrate = components.broccoliSubdirHintsSubstrate;
    this.subdirHintsSnapshotManager = components.subdirHintsSnapshotManager;
    this.subdirHintsToolSuite = components.subdirHintsToolSuite;
    this.deterministicStreamDiagEngine = components.deterministicStreamDiagEngine;
    this.streamDiagSupervisor = components.streamDiagSupervisor;
    this.broccoliStreamDiagSubstrate = components.broccoliStreamDiagSubstrate;
    this.streamDiagSnapshotManager = components.streamDiagSnapshotManager;
    this.streamDiagToolSuite = components.streamDiagToolSuite;
    this.deterministicTurnRetryEngine = components.deterministicTurnRetryEngine;
    this.turnRetrySupervisor = components.turnRetrySupervisor;
    this.broccoliTurnRetrySubstrate = components.broccoliTurnRetrySubstrate;
    this.turnRetrySnapshotManager = components.turnRetrySnapshotManager;
    this.turnRetryToolSuite = components.turnRetryToolSuite;
    this.deterministicBillingUsageEngine = components.deterministicBillingUsageEngine;
    this.billingUsageSupervisor = components.billingUsageSupervisor;
    this.broccoliBillingUsageSubstrate = components.broccoliBillingUsageSubstrate;
    this.billingUsageSnapshotManager = components.billingUsageSnapshotManager;
    this.billingUsageToolSuite = components.billingUsageToolSuite;
    this.deterministicThreadContextEngine = components.deterministicThreadContextEngine;
    this.threadContextSupervisor = components.threadContextSupervisor;
    this.broccoliThreadContextSubstrate = components.broccoliThreadContextSubstrate;
    this.threadContextSnapshotManager = components.threadContextSnapshotManager;
    this.threadContextToolSuite = components.threadContextToolSuite;
    this.deterministicEnvProbeEngine = components.deterministicEnvProbeEngine;
    this.envProbeSupervisor = components.envProbeSupervisor;
    this.broccoliEnvProbeSubstrate = components.broccoliEnvProbeSubstrate;
    this.envProbeSnapshotManager = components.envProbeSnapshotManager;
    this.envProbeToolSuite = components.envProbeToolSuite;
    this.deterministicSkillLinterEngine = components.deterministicSkillLinterEngine;
    this.skillLinterSupervisor = components.skillLinterSupervisor;
    this.broccoliSkillLinterSubstrate = components.broccoliSkillLinterSubstrate;
    this.skillLinterSnapshotManager = components.skillLinterSnapshotManager;
    this.skillLinterToolSuite = components.skillLinterToolSuite;
    this.deterministicTerminalCleanerEngine = components.deterministicTerminalCleanerEngine;
    this.terminalCleanerSupervisor = components.terminalCleanerSupervisor;
    this.broccoliTerminalCleanerSubstrate = components.broccoliTerminalCleanerSubstrate;
    this.terminalCleanerSnapshotManager = components.terminalCleanerSnapshotManager;
    this.terminalCleanerToolSuite = components.terminalCleanerToolSuite;
    this.deterministicStreamingScrubberEngine = components.deterministicStreamingScrubberEngine;
    this.streamingScrubberSupervisor = components.streamingScrubberSupervisor;
    this.broccoliStreamingScrubberSubstrate = components.broccoliStreamingScrubberSubstrate;
    this.streamingScrubberSnapshotManager = components.streamingScrubberSnapshotManager;
    this.streamingScrubberToolSuite = components.streamingScrubberToolSuite;
    this.deterministicSelfRepoGuardEngine = components.deterministicSelfRepoGuardEngine;
    this.selfRepoGuardSupervisor = components.selfRepoGuardSupervisor;
    this.broccoliSelfRepoGuardSubstrate = components.broccoliSelfRepoGuardSubstrate;
    this.selfRepoGuardSnapshotManager = components.selfRepoGuardSnapshotManager;
    this.selfRepoGuardToolSuite = components.selfRepoGuardToolSuite;
    this.deterministicSchemaSanitizerEngine = components.deterministicSchemaSanitizerEngine;
    this.schemaSanitizerSupervisor = components.schemaSanitizerSupervisor;
    this.broccoliSchemaSanitizerSubstrate = components.broccoliSchemaSanitizerSubstrate;
    this.schemaSanitizerSnapshotManager = components.schemaSanitizerSnapshotManager;
    this.schemaSanitizerToolSuite = components.schemaSanitizerToolSuite;
    this.deterministicNousPortalEngine = components.deterministicNousPortalEngine;
    this.nousPortalSupervisor = components.nousPortalSupervisor;
    this.broccoliNousPortalSubstrate = components.broccoliNousPortalSubstrate;
    this.nousPortalSnapshotManager = components.nousPortalSnapshotManager;
    this.nousPortalToolSuite = components.nousPortalToolSuite;
    this.deterministicGoalEngine = components.deterministicGoalEngine;
    this.goalSupervisor = components.goalSupervisor;
    this.broccoliGoalSubstrate = components.broccoliGoalSubstrate;
    this.goalSnapshotManager = components.goalSnapshotManager;
    this.goalToolSuite = components.goalToolSuite;
    this.deterministicProfileEngine = components.deterministicProfileEngine;
    this.profileSupervisor = components.profileSupervisor;
    this.broccoliProfileSubstrate = components.broccoliProfileSubstrate;
    this.profileSnapshotManager = components.profileSnapshotManager;
    this.profileToolSuite = components.profileToolSuite;
    this.databaseKernel = components.databaseKernel;
    this.databaseToolSuite = components.databaseToolSuite;
    this.deterministicWalletEngine = components.deterministicWalletEngine;
    this.walletSupervisor = components.walletSupervisor;
    this.broccoliWalletSubstrate = components.broccoliWalletSubstrate;
    this.walletSnapshotManager = components.walletSnapshotManager;
    this.walletToolSuite = components.walletToolSuite;
    this.deterministicEmailEngine = components.deterministicEmailEngine;
    this.emailSupervisor = components.emailSupervisor;
    this.broccoliEmailSubstrate = components.broccoliEmailSubstrate;
    this.emailSnapshotManager = components.emailSnapshotManager;
    this.emailToolSuite = components.emailToolSuite;
    this.deterministicOtlpEngine = components.deterministicOtlpEngine;
    this.otlpSupervisor = components.otlpSupervisor;
    this.broccoliOtlpSubstrate = components.broccoliOtlpSubstrate;
    this.otlpSnapshotManager = components.otlpSnapshotManager;
    this.otlpToolSuite = components.otlpToolSuite;
    this.deterministicAcpEngine = components.deterministicAcpEngine;
    this.acpSupervisor = components.acpSupervisor;
    this.deterministicDaemonEngine = components.deterministicDaemonEngine;
    this.daemonSupervisor = components.daemonSupervisor;
    this.broccoliDaemonSubstrate = components.broccoliDaemonSubstrate;
    this.daemonSnapshotManager = components.daemonSnapshotManager;
    this.daemonToolSuite = components.daemonToolSuite;
    this.broccoliRunbookSubstrate = components.broccoliRunbookSubstrate;
    this.runbookSupervisor = components.runbookSupervisor;
    this.runbookToolSuite = components.runbookToolSuite;
    this.toolRegistry = components.toolRegistry;
    this.promptComposer = components.promptComposer;
    this.agentEngine = components.agentEngine;
  }

  /** Primary Game Engine Frame Step (Tick Loop) */
  async tick(input: EngineTickInput): Promise<EngineTickResult> {
    return this.telemetryTracer.startSpan(
      `tick-frame-${this.sessionContext.turnCount + 1}`,
      async (span) => {
        this.telemetryTracer.addEvent(span, "frame_start", { promptLength: input.prompt.length });
        this.loopPhaseController.setPhase("thinking");
        const startTime = Date.now();
        try {
          const res = await this.agentEngine.tick(input);
          this.timingBuffer.record("frame_tick", Date.now() - startTime);
          span.attributes["turn.outcome"] = res.outcome;
          if (res.outcome !== "completed") span.status = "error";
          this.telemetryTracer.addEvent(span, "frame_terminal", {
            outcome: res.outcome,
            responseLength: res.response.length,
          });
          return res;
        } finally {
          this.loopPhaseController.setPhase("idle");
        }
      }
    );
  }

  /** Backward-compatible turn runner */
  async runTurn(prompt: string): Promise<EngineTickResult> {
    return this.tick({ prompt });
  }

  /** Dynamically changes the active LLM model with alias normalization */
  setModel(modelName: string): string {
    const normalized = this.modelResolver.setActiveModel(modelName);
    (this.config as { modelName: string }).modelName = normalized;
    this.setupWizard.setSavedModel(normalized);
    return normalized;
  }

  /** Switches active model to Flagship Reasoning Engine (gpt-5.6-terra) */
  switchToTerra(): string {
    return this.setModel("gpt-5.6-terra");
  }

  /** Switches active model to High-Velocity Engine (gpt-5.6-luna) */
  switchToLuna(): string {
    return this.setModel("gpt-5.6-luna");
  }

  /** Switches active model to Balanced Engine (gpt-5.6-sol) */
  switchToSol(): string {
    return this.setModel("gpt-5.6-sol");
  }

  /** Cycles through modern Codex models (terra -> luna -> sol) */
  cycleCodexModel(): string {
    const next = this.modelResolver.cycleCodexModel();
    (this.config as { modelName: string }).modelName = next;
    this.setupWizard.setSavedModel(next);
    return next;
  }

  /** Creates an immutable frame-perfect snapshot of active game engine state */
  createSnapshot(): GameStateSnapshot {
    const snapshot = this.sessionStore.createSnapshot(
      this.sessionContext.turnCount,
      this.sessionVfs,
      this.sessionMemoryStore,
      this.modelResolver
    );
    this.snapshotLruCache.set(snapshot.snapshotId, snapshot);
    this.snapshotStorageIndex.saveSnapshot(snapshot);
    return snapshot;
  }

  /** Frame-perfect state rewind to a target snapshot */
  rewindToSnapshot(snapshot: GameStateSnapshot): void {
    this.sessionStore.rewindToSnapshot(snapshot);
    this.sessionContext.turnCount = snapshot.frameIndex;
    if (snapshot.memories) {
      this.sessionMemoryStore.clear();
      for (const m of snapshot.memories) {
        const cat = (m.category === "rule" || m.category === "troubleshooting" || m.category === "ki")
          ? m.category
          : "fact";
        this.sessionMemoryStore.saveMemory(m.key, m.value, cat);
      }
    }
    if (snapshot.stagedFiles) {
      this.sessionVfs.clear();
      for (const file of snapshot.stagedFiles) {
        this.sessionVfs.stageWrite(file.path, file.stagedContent);
      }
    }
  }

  /** Forks game engine state into a new isolated engine instance */
  forkSession(newSessionId?: string): LumiMonolith {
    const snapshot = this.createSnapshot();
    const forkedMonolith = new LumiMonolith({
      cwd: this.sessionContext.cwd,
      sessionId: newSessionId ?? `${this.sessionContext.sessionId}-fork-${Date.now()}`,
      config: this.config,
    });
    forkedMonolith.rewindToSnapshot(snapshot);
    return forkedMonolith;
  }
}

// CLI entrypoint when run directly, including through an npm-link symlink.
const cliEntrypoint = process.argv[1];
let isDirectCliExecution = false;
if (cliEntrypoint) {
  try {
    isDirectCliExecution = realpathSync(cliEntrypoint) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    isDirectCliExecution = pathToFileURL(cliEntrypoint).href === import.meta.url;
  }
}

if (isDirectCliExecution) {
  const args = process.argv.slice(2);
  const primaryCmd = args[0]?.toLowerCase();

  const isSmoke = args.includes("--smoke") || args.includes("-s") || primaryCmd === "smoke";
  const isSetup = args.includes("--setup") || primaryCmd === "setup";
  const isBenchmark = args.includes("--benchmark") || args.includes("-b") || primaryCmd === "benchmark";
  const isBaseline = args.includes("--baseline") || primaryCmd === "baseline";
  const isHelp = args.includes("--help") || args.includes("-h") || primaryCmd === "help";

  const isLogin = args.includes("--login") || primaryCmd === "login" || (primaryCmd === "auth" && args[1] === "login");
  const isLogout = args.includes("--logout") || primaryCmd === "logout" || (primaryCmd === "auth" && args[1] === "logout");
  const isWhoAmI = args.includes("--whoami") || primaryCmd === "whoami" || (primaryCmd === "auth" && (!args[1] || args[1] === "status" || args[1] === "whoami"));
  const isDoctor = args.includes("--doctor") || args.includes("--health") || primaryCmd === "doctor" || primaryCmd === "health";
  const isModels = args.includes("--models") || primaryCmd === "models";
  const isLocal = args.includes("--local") || primaryCmd === "local" || primaryCmd === "onprem";
  const isPull = primaryCmd === "pull";
  const isHardware = args.includes("--hardware") || args.includes("--vram") || primaryCmd === "hardware" || primaryCmd === "vram";

  const isTerra = primaryCmd === "terra";
  const isLuna = primaryCmd === "luna";
  const isSol = primaryCmd === "sol";
  const isModelSwitch = primaryCmd === "model" && Boolean(args[1]);

  if (isHelp) {
    console.log(`
\x1b[1;35m❖ LUMI Agent OS — Command Line Interface\x1b[0m

\x1b[1;34mInteractive Mode:\x1b[0m
  lumi                        Start interactive terminal TUI session
  lumi --model <name>         Start interactive session with active model (e.g. luna, terra, sol)

\x1b[1;34mModel Swapping & Catalog:\x1b[0m
  lumi terra                  Quick-switch default model to Flagship Reasoning Engine (gpt-5.6-terra)
  lumi luna                   Quick-switch default model to High-Velocity Engine (gpt-5.6-luna)
  lumi sol                    Quick-switch default model to Balanced Engine (gpt-5.6-sol)
  lumi model <name>           Set active model by name or alias (e.g. lumi model luna)
  lumi models [--refresh]     Fetch live models from Codex & OpenRouter and display catalog
\x1b[1;34mAuthentication & Identity:\x1b[0m
  lumi login                  Sign in with ChatGPT / OpenAI (1-Click browser login)
  lumi logout                 Sign out and clear local session
  lumi whoami                 Display active account, subscription tier, and model
  lumi doctor                 Run system health and connectivity check
  lumi setup                  Interactive account and model settings

\x1b[1;34mLocal On-Premises & Models:\x1b[0m
  lumi local                  Auto-sense and probe local LLM servers (Ollama, LM Studio, llama.cpp)
  lumi local --hardware       Display host RAM, GPU / Apple Silicon VRAM compatibility report
  lumi local --benchmark      Run Tokens-Per-Second (TPS) speed benchmark on local models
  lumi local --unload [model] Purge model from GPU memory to reclaim VRAM
  lumi local --ps             List models currently loaded in GPU VRAM
  lumi pull <model>           Stream and download an open-weight Ollama model (e.g. lumi pull llama3.2)

\x1b[1;34mSystem & Configuration:\x1b[0m
  lumi doctor                 Run system health, permissions, hardware, and connectivity diagnostic audit
  lumi setup                  Launch step-by-step interactive configuration wizard

\x1b[1;34mWorkload & Benchmarks:\x1b[0m
  lumi "your prompt"          Execute a single non-interactive prompt turn
  lumi benchmark (-b)         Run automated engine throughput and latency benchmark suite
  lumi baseline               Run smoke + benchmark + guardrails to update live baseline
  lumi smoke (-s)             Run runtime capability smoke verification suite
  lumi help (-h)              Show this help message
`);
    process.exit(0);
  }

  const runSmokeTest = async (lumi: LumiMonolith): Promise<RuntimeSmokeReport> => {
    console.log("\x1b[1;36m========================================================\x1b[0m");
    console.log("\x1b[1;36m   LUMI Current Runtime Capability Smoke Suite          \x1b[0m");
    console.log("\x1b[1;36m========================================================\x1b[0m\n");

    const report = await new RuntimeSmokeSuite().run(lumi);
    console.log(`Evolution Baseline:       \x1b[36m${report.baseline.label}\x1b[0m`);
    console.log(`Composed Components:      \x1b[36m${report.composition.componentCount}\x1b[0m`);
    console.log(`Required Capabilities:    \x1b[36m${report.composition.requiredComponentCount}\x1b[0m\n`);

    for (const check of report.checks) {
      const status = check.passed ? "\x1b[32m[PASS]\x1b[0m" : "\x1b[31m[FAIL]\x1b[0m";
      console.log(`  ${status} ${check.name}`);
      console.log(`         ${check.detail} (${check.durationMs.toFixed(2)} ms)`);
    }

    console.log(`\nSmoke Result: ${report.passed ? "\x1b[1;32mPASSED" : "\x1b[1;31mFAILED"}\x1b[0m · ${report.passedCount}/${report.totalChecks} checks · ${report.durationMs.toFixed(2)} ms\n`);
    return report;
  };

  const runBenchmarkSuite = async (lumi: LumiMonolith): Promise<GrandBenchmarkResult> => {
    console.log("\x1b[1;36m========================================================\x1b[0m");
    console.log("\x1b[1;36m   LUMI Monolith Benchmark & Throughput Test Suite      \x1b[0m");
    console.log("\x1b[1;36m========================================================\x1b[0m\n");

    const rewindSnapshot = lumi.createSnapshot();
    const rewindMutation = await lumi.tick({ prompt: "remember: benchmark_rewind = mutated" });
    if (rewindMutation.outcome !== "completed") {
      throw new Error("Unable to prepare deterministic rewind benchmark");
    }

    const benchmarkResult = await lumi.masterBenchmarkOrchestrator.runGrandBenchmarkSuite(lumi, [
      { name: "Turn Tick Latency & Fact Storage", prompt: "remember: engine = deterministic", expectedKeywords: ["deterministic"] },
      { name: "VFS File Perception & Reading", prompt: "view: package.json", expectedKeywords: ["package.json"] },
      {
        name: "Complete Flappy Bird React + TypeScript + Vite Synthesis",
        expectedKeywords: ["Generated 12-file", "gameplay state-machine simulation"],
        execute: () => new FlappyBirdProjectBenchmark().execute(),
      },
      { name: "Slash Command Router Latency", prompt: "/stats", expectedKeywords: ["Telemetry"] },
      {
        name: "Snapshot State Rewind Latency",
        expectedKeywords: ["rewound"],
        execute: (current) => {
          current.rewindToSnapshot(rewindSnapshot);
          const restored = current.sessionContext.turnCount === rewindSnapshot.frameIndex
            && current.sessionStore.getMessages().length === rewindSnapshot.messages.length;
          return {
            outcome: restored ? "completed" : "failed",
            response: restored ? `Rewound to frame ${rewindSnapshot.frameIndex}` : "Snapshot rewind state mismatch",
            assertionPassed: restored,
          };
        },
      },
    ]);

    console.log(`\x1b[1;32mBenchmark Results:\x1b[0m`);
    console.log(`  Total Evaluated Tests:  \x1b[36m${benchmarkResult.suiteResult.totalTests}\x1b[0m`);
    console.log(`  Passed Tests:           \x1b[32m${benchmarkResult.suiteResult.passCount}\x1b[0m`);
    console.log(`  Failed Tests:           \x1b[31m${benchmarkResult.suiteResult.failCount}\x1b[0m`);
    console.log(`  Pass Rate:              \x1b[33m${benchmarkResult.suiteResult.passRate}%\x1b[0m`);
    console.log(`  Mean Case Latency:      \x1b[36m${benchmarkResult.suiteResult.meanLatencyMs} ms\x1b[0m`);
    console.log(`  Total Test Time:        \x1b[36m${benchmarkResult.totalDurationMs} ms\x1b[0m`);
    console.log(`  Workload Throughput:    \x1b[1;32m${benchmarkResult.throughputTps} cases/sec (${benchmarkResult.throughputPerMinute} cases/min)\x1b[0m\n`);

    console.log("\x1b[1;34mDetailed Test Case Metrics:\x1b[0m");
    for (const res of benchmarkResult.suiteResult.results) {
      const status = res.passed ? "\x1b[32m[PASS]\x1b[0m" : "\x1b[31m[FAIL]\x1b[0m";
      const assertionSummary = res.assertions.length > 0
        ? ` · Assertions: ${res.assertions.filter((assertion) => assertion.passed).length}/${res.assertions.length}`
        : "";
      console.log(`  ${status} ${res.testName.padEnd(62)} -> Latency: \x1b[33m${res.durationMs} ms\x1b[0m${assertionSummary}`);
      for (const assertion of res.assertions) {
        const assertionStatus = assertion.passed ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
        console.log(`         ${assertionStatus} ${assertion.name}: ${assertion.detail}`);
      }
    }
    console.log();
    return benchmarkResult;
  };

  const updateLiveBaseline = async (lumi: LumiMonolith): Promise<boolean> => {
    const smoke = await runSmokeTest(lumi);
    const benchmark = await runBenchmarkSuite(lumi);
    const guardrails = await new ArchitectureGuardrailGate().runFullGuardrailAudit(lumi);
    const writeResult = new LiveBaselineReporter().write(process.cwd(), {
      repositoryVersion: process.env["npm_package_version"] ?? "0.1.0",
      configuredModel: lumi.modelResolver.getActiveModel(),
      smoke,
      benchmark,
      guardrails,
    });

    console.log("\x1b[1;34mLive baseline artifacts:\x1b[0m");
    for (const file of writeResult.files) console.log(`  - ${file}`);
    console.log(`  Generated: ${writeResult.generatedAt}`);
    console.log(`  Guardrails: ${guardrails.passedCount}/${guardrails.totalChecks}`);
    console.log(`  Status: ${writeResult.passed ? "\x1b[1;32mPASSED" : "\x1b[1;31mFAILED"}\x1b[0m\n`);
    return writeResult.passed;
  };

  const startRepl = async (lumi: LumiMonolith) => {
    await lumi.interactiveController.startInteractiveSession(lumi);
  };

  (async () => {
    const lumi = new LumiMonolith();
    if (process.env.LUMI_MODEL_ID) {
      lumi.setModel(process.env.LUMI_MODEL_ID);
    }

    if (isLogin) {
      await lumi.setupWizard.loginInteractive();
    } else if (isSetup) {
      await lumi.setupWizard.runInteractiveWizard();
    } else if (isLogout) {
      lumi.setupWizard.logoutCodexOAuth();
      console.log("\n\x1b[1;32m[✓] Successfully signed out of ChatGPT / OpenAI.\x1b[0m");
      console.log("\x1b[90mRun \x1b[36mlumi login\x1b[90m anytime to reconnect.\x1b[0m\n");
    } else if (isWhoAmI) {
      lumi.setupWizard.displayWhoAmI(lumi.modelResolver.getActiveModel());
    } else if (isDoctor) {
      await lumi.setupWizard.displayDoctor();
    } else if (isPull) {
      const modelTag = args[1]?.trim() || "qwen2.5-coder:7b";
      console.log(`\n\x1b[1;36mConnecting to pull ${modelTag} via Ollama...\x1b[0m\n`);
      try {
        await lumi.proxyGateway.getLocalEngine().pullModel(modelTag, {
          onProgress: (p) => {
            process.stdout.write(`\r${p.progressBarText}   `);
          },
        });
        console.log(`\n\n\x1b[1;32m[✓] Model ${modelTag} downloaded and ready for offline inference!\x1b[0m\n`);
      } catch (err: any) {
        console.error(`\n\n\x1b[1;31m[✗] Failed to pull model:\x1b[0m ${err.message || String(err)}\n`);
      }
    } else if (isHardware) {
      console.log();
      console.log(lumi.proxyGateway.getLocalEngine().getHardwareCard());
    } else if (isLocal) {
      if (args.includes("--hardware") || args.includes("--vram")) {
        console.log();
        console.log(lumi.proxyGateway.getLocalEngine().getHardwareCard());
      } else if (args.includes("--benchmark") || args.includes("--speed")) {
        const bIdx = args.includes("--benchmark") ? args.indexOf("--benchmark") : args.indexOf("--speed");
        const targetM = args[bIdx + 1] && !args[bIdx + 1]?.startsWith("-") ? args[bIdx + 1]! : "qwen2.5-coder:7b";
        console.log(`\n\x1b[33m⚡ Benchmarking local inference speed on ${targetM}...\x1b[0m\n`);
        const res = await lumi.proxyGateway.getLocalEngine().benchmarkModel(targetM);
        console.log(res.speedScorecard);
      } else if (args.includes("--unload") || args.includes("--purge")) {
        const uIdx = args.includes("--unload") ? args.indexOf("--unload") : args.indexOf("--purge");
        const targetM = args[uIdx + 1];
        if (targetM && !targetM.startsWith("-")) {
          const res = await lumi.proxyGateway.getLocalEngine().unloadModel(targetM);
          console.log(`\n\x1b[32m[✓] ${res.message}\x1b[0m\n`);
        } else {
          const res = await lumi.proxyGateway.getLocalEngine().unloadAllModels();
          console.log(`\n\x1b[32m[✓] Purged ${res.length} model(s) from GPU VRAM memory.\x1b[0m\n`);
        }
      } else if (args.includes("--ps")) {
        const loaded = await lumi.proxyGateway.getLocalEngine().getLoadedModels();
        console.log(`\n\x1b[1;36mModels Resident in GPU VRAM (${loaded.length}):\x1b[0m`);
        if (loaded.length === 0) {
          console.log(`  \x1b[90mNo models currently active in VRAM.\x1b[0m`);
        } else {
          for (const m of loaded) {
            console.log(` • \x1b[33m${m.name}\x1b[0m (${m.sizeGb} GB VRAM) — Expires: ${m.expiresAt}`);
          }
        }
        console.log();
      } else if (args.includes("--start")) {
        console.log("\n\x1b[33mAttempting to spawn Ollama daemon in background...\x1b[0m");
        const res = await lumi.proxyGateway.getLocalEngine().startLocalServer("ollama");
        console.log(res.started ? `\x1b[32m[✓] ${res.message}\x1b[0m\n` : `\x1b[31m[✗] ${res.message}\x1b[0m\n`);
      } else {
        console.log("\n\x1b[1;35m╭─── LUMI Local & On-Premises Engine Fleet Probe ───────────────╮\x1b[0m");
        const report = await lumi.proxyGateway.getLocalEngine().probeAllServers();
        console.log(`│  Active Servers Online: \x1b[1;36m${report.activeServers}/${report.totalServersChecked}\x1b[0m · Total Discovered Models: \x1b[1;33m${report.totalLocalModelsDiscovered}\x1b[0m`);
        console.log(`│`);
        for (const s of report.serverStatuses) {
          const badge = s.reachable ? `\x1b[32m● ONLINE\x1b[0m (${s.latencyMs}ms, ${s.activeModelCount} models)` : `\x1b[90m○ OFFLINE\x1b[0m`;
          console.log(`│  • \x1b[1;37m${s.displayName.padEnd(24)}\x1b[0m \x1b[36m${s.baseUrl.padEnd(24)}\x1b[0m ${badge}`);
          if (s.detectedModels.length > 0) {
            for (const m of s.detectedModels.slice(0, 3)) {
              const vramBadge = m.vramCompatibility?.badge || "";
              console.log(`│      └─ \x1b[90mModel:\x1b[0m \x1b[33m${m.modelId}\x1b[0m ${vramBadge}`);
            }
          }
        }
        console.log("\x1b[1;35m╰───────────────────────────────────────────────────────────────╯\x1b[0m");
        console.log(`\x1b[90mStart local models with \x1b[36mollama run llama3.2\x1b[90m, pull with \x1b[36mlumi pull <model>\x1b[90m, or connect in TUI with \x1b[36m/local\x1b[90m.\x1b[0m\n`);
      }
    } else if (isTerra) {
      const active = lumi.switchToTerra();
      console.log(`\n\x1b[1;32m[✓] Active LLM Model set to:\x1b[0m \x1b[1;36m${active}\x1b[0m (Flagship Reasoning Engine · 900k Context · 16k Max Output)\n`);
    } else if (isLuna) {
      const active = lumi.switchToLuna();
      console.log(`\n\x1b[1;32m[✓] Active LLM Model set to:\x1b[0m \x1b[1;36m${active}\x1b[0m (High-Velocity Engine · 900k Context · 8k Max Output)\n`);
    } else if (isSol) {
      const active = lumi.switchToSol();
      console.log(`\n\x1b[1;32m[✓] Active LLM Model set to:\x1b[0m \x1b[1;36m${active}\x1b[0m (Balanced Engine · 900k Context · 8k Max Output)\n`);
    } else if (isModelSwitch) {
      const targetModel = args.slice(1).join(" ").trim();
      const active = lumi.setModel(targetModel);
      console.log(`\n\x1b[1;32m[✓] Active LLM Model set to:\x1b[0m \x1b[1;36m${active}\x1b[0m\n`);
    } else if (isModels) {
      const force = args.includes("--refresh") || args.includes("-r");
      if (force) {
        console.log("\n\x1b[33mFetching latest models dynamically from Codex, Nous Research, and OpenRouter...\x1b[0m");
        await lumi.modelCatalog.fetchCodexModels(undefined, true);
        await lumi.modelCatalog.fetchNousModels(undefined, true);
        await lumi.modelCatalog.fetchOpenRouterModels(undefined, true);
      }
      console.log("\n\x1b[1;35m╭─── LUMI Curated & Dynamic Model Catalog ──────────────────────╮\x1b[0m");
      const models = lumi.modelCatalog.getAllModels();
      const active = lumi.modelResolver.getActiveModel();
      for (const m of models) {
        const isCurrent = m.modelName === active ? " \x1b[32m[ACTIVE]\x1b[0m" : "";
        const ctxKb = Math.round(m.contextWindowTokens / 1000);
        console.log(`│  • \x1b[1;36m${m.modelName.padEnd(24)}\x1b[0m \x1b[90m(${m.provider.padEnd(14)})\x1b[0m \x1b[33m${ctxKb}k ctx\x1b[0m${isCurrent}`);
      }
      console.log("\x1b[1;35m╰───────────────────────────────────────────────────────────────╯\x1b[0m");
      console.log(`\x1b[90mSwitch models instantly with \x1b[36mlumi terra\x1b[90m, \x1b[36mlumi luna\x1b[90m, \x1b[36mlumi sol\x1b[90m, or in TUI with \x1b[36m/model <name>\x1b[90m.\x1b[0m\n`);
    } else if (isBaseline) {
      const passed = await updateLiveBaseline(lumi);
      if (!passed) throw new Error("Live baseline verification failed");
    } else if (isBenchmark) {
      const benchmark = await runBenchmarkSuite(lumi);
      if (!benchmark.passed) throw new Error("Benchmark suite failed");
    } else if (isSmoke) {
      const smoke = await runSmokeTest(lumi);
      if (!smoke.passed) throw new Error("Runtime smoke suite failed");
    } else if (args.length > 0 && !args[0].startsWith("-")) {
      const prompt = args.join(" ");
      const result = await lumi.tick({ prompt });
      const color = result.outcome === "completed"
        ? "\x1b[1;32m"
        : result.outcome === "cancelled"
          ? "\x1b[1;33m"
          : "\x1b[1;31m";
      console.log(`${color}[${result.outcome.toUpperCase()} · LUMI Frame #${result.frameIndex}]\x1b[0m (${result.durationMs}ms)`);
      console.log(result.response);
    } else {
      await startRepl(lumi);
    }
  })().catch((err) => {
    console.error("LUMI CLI execution failed:", err);
    process.exitCode = 1;
  });
}
