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
import { CodexOAuthManager, type OpenAiCodexCredentials, type CodexAuthUrlDetails } from "./agents/extensions/resolution/codex-oauth-manager.js";
import { CodexProviderBridge, MODERN_GPT56_MODELS, type ResolvedAuthHeaders, type ModernGpt56Model } from "./agents/extensions/resolution/codex-provider-bridge.js";
import { SetupWizard } from "./agents/extensions/setup/setup-wizard.js";

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

import { HeadTailBudgetGovernor } from "./tooling/extensions/compaction/head-tail-budget-governor.js";
import { DeterministicToolPruner } from "./tooling/extensions/compaction/deterministic-tool-pruner.js";
import { BroccoliCompressionSubstrate } from "./sessions/extensions/compaction/broccoli-compression-substrate.js";
import { CompressionSnapshotManager } from "./sessions/extensions/compaction/compression-snapshot-manager.js";
import { TrajectoryCompactorEngine } from "./agents/extensions/compaction/trajectory-compactor-engine.js";
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
  ISkillTreeParser,
  IAnchoredSkillMutator,
  IBroccoliSkillTreeSubstrate,
  ISkillTreeSnapshotManager,
  IDeterministicSkillCurator,
  IEvolutionarySkillEngine,
  IAntiDegenerationGuard,
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
} from "./core/contracts/soul.contracts.js";
export type {
  SwarmTaskStatus,
  SubagentBudget,
  WorktreeIsolationSpec,
  SwarmTaskManifest,
  DelegationOutcome,
  BatchDelegationResult,
  ISwarmDelegator,
  IWorktreeManager,
  ISubagentVfsBrancher,
  ISubagentBudgetGovernor,
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
  GatewayPlatformType,
  GatewayDeliveryStatus,
  GatewayMessageEnvelope,
  GatewayOutboundPayload,
  GatewayChannelSession,
  GatewayStateSnapshot,
  IGatewayPlatformAdapter,
  IBroccoliGatewaySubstrate,
  IGatewayDeliveryLedger,
  IGatewaySnapshotManager,
  IGatewayDispatcher,
} from "./core/contracts/gateway.contracts.js";
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
  AcpSessionMode,
  AcpPermissionLevel,
  AcpRpcRequest,
  AcpRpcResponse,
  AcpRpcNotification,
  AcpSessionInfo,
  AcpEditApprovalRequest,
  AcpEditApprovalDecision,
  AcpStateSnapshot,
  IAcpProtocolCodec,
  IAcpPermissionGate,
  IBroccoliAcpSubstrate,
  IAcpSnapshotManager,
  IAcpBridgeServer,
} from "./core/contracts/acp.contracts.js";
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
export { ModelResolver } from "./agents/extensions/resolution/model-resolver.js";
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
export { CodexOAuthManager } from "./agents/extensions/resolution/codex-oauth-manager.js";
export type { OpenAiCodexCredentials, CodexAuthUrlDetails } from "./agents/extensions/resolution/codex-oauth-manager.js";
export { CodexProviderBridge, MODERN_GPT56_MODELS } from "./agents/extensions/resolution/codex-provider-bridge.js";
export type { ResolvedAuthHeaders, ModernGpt56Model } from "./agents/extensions/resolution/codex-provider-bridge.js";

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
export { SkillTreeToolSuite } from "./tooling/extensions/skills/skill-tree-tool-suite.js";
export { BroccoliSkillTreeSubstrate } from "./sessions/extensions/skills/broccoli-skill-tree-substrate.js";
export { SkillTreeSnapshotManager } from "./sessions/extensions/skills/skill-tree-snapshot-manager.js";
export { DeterministicSkillCurator } from "./sessions/extensions/skills/deterministic-skill-curator.js";
export { EvolutionarySkillTreeEngine } from "./agents/extensions/skills/evolutionary-skill-tree-engine.js";
export { SkillTreePromptComposer } from "./agents/extensions/skills/skill-tree-prompt-composer.js";
export { AntiDegenerationGuard } from "./agents/extensions/skills/anti-degeneration-guard.js";

export { DeterministicSoulParser } from "./tooling/extensions/soul/deterministic-soul-parser.js";
export { AnchoredSoulMutator } from "./tooling/extensions/soul/anchored-soul-mutator.js";
export { SoulToolSuite } from "./tooling/extensions/soul/soul-tool-suite.js";
export { BroccoliSoulSubstrate } from "./sessions/extensions/soul/broccoli-soul-substrate.js";
export { SoulSnapshotManager } from "./sessions/extensions/soul/soul-snapshot-manager.js";
export { SoulThreatGuard } from "./agents/extensions/soul/soul-threat-guard.js";
export { SoulPromptComposer } from "./agents/extensions/soul/soul-prompt-composer.js";

export { AnchoredWorktreeManager } from "./tooling/extensions/delegation/anchored-worktree-manager.js";
export { SwarmToolSuite } from "./tooling/extensions/delegation/swarm-tool-suite.js";
export { SubagentVfsBrancher } from "./sessions/extensions/delegation/subagent-vfs-brancher.js";
export { SubagentBudgetGovernor } from "./sessions/extensions/delegation/subagent-budget-governor.js";
export { SubagentLifecycleGuard } from "./agents/extensions/delegation/subagent-lifecycle-guard.js";
export { MonolithSwarmDelegator } from "./agents/extensions/delegation/monolith-swarm-delegator.js";

export { DeterministicBlueprintCatalog } from "./tooling/extensions/cron/deterministic-blueprint-catalog.js";
export { AnchoredCronJobManager } from "./tooling/extensions/cron/anchored-cron-job-manager.js";
export { CronToolSuite } from "./tooling/extensions/cron/cron-tool-suite.js";
export { BroccoliCronSubstrate } from "./sessions/extensions/cron/broccoli-cron-substrate.js";
export { CronSnapshotManager } from "./sessions/extensions/cron/cron-snapshot-manager.js";
export { CronLifecycleGuard } from "./agents/extensions/cron/cron-lifecycle-guard.js";
export { MonolithCronScheduler } from "./agents/extensions/cron/monolith-cron-scheduler.js";

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

export { HeadTailBudgetGovernor } from "./tooling/extensions/compaction/head-tail-budget-governor.js";
export { DeterministicToolPruner } from "./tooling/extensions/compaction/deterministic-tool-pruner.js";
export { BroccoliCompressionSubstrate } from "./sessions/extensions/compaction/broccoli-compression-substrate.js";
export { CompressionSnapshotManager } from "./sessions/extensions/compaction/compression-snapshot-manager.js";
export { TrajectoryCompactorEngine } from "./agents/extensions/compaction/trajectory-compactor-engine.js";
export { CompressionToolSuite } from "./tooling/extensions/compaction/compression-tool-suite.js";

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
export type {
  KnowledgeNodeType,
  CuratorKnowledgeNode,
  CuratorKnowledgeEdge,
  KnowledgeGraphSnapshot,
  MemoryQueryOptions,
  MemoryRecallResult,
  CuratorReviewDirective,
  CuratorOptions,
} from "./core/contracts/memory-curator.contracts.js";

export { DeterministicPatchEngine } from "./tooling/extensions/patch/deterministic-patch-engine.js";
export { BroccoliPatchSubstrate } from "./sessions/extensions/patch/broccoli-patch-substrate.js";
export { PatchSnapshotManager } from "./sessions/extensions/patch/patch-snapshot-manager.js";
export { AtomicMutationSupervisor } from "./agents/extensions/patch/atomic-mutation-supervisor.js";
export { FileMutationToolSuite } from "./tooling/extensions/patch/file-mutation-tool-suite.js";
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
export type {
  KanbanColumn,
  KanbanPriority,
  KanbanTask,
  KanbanBoard,
  KanbanTaskMutation,
  KanbanQueryFilter,
  KanbanWorkspaceSnapshot,
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
export type {
  CodeExecutionLanguage,
  ProgrammaticToolCall,
  CodeExecutionResult,
  SandboxContext,
  ExecutionRecord,
  ExecutionWorkspaceSnapshot,
} from "./core/contracts/execution.contracts.js";

export { DeterministicBatchEvaluator } from "./tooling/extensions/batch/deterministic-batch-evaluator.js";
export { BroccoliBatchSubstrate } from "./sessions/extensions/batch/broccoli-batch-substrate.js";
export { BatchSnapshotManager } from "./sessions/extensions/batch/batch-snapshot-manager.js";
export { BatchEvaluationSupervisor } from "./agents/extensions/batch/batch-evaluation-supervisor.js";
export { BatchEvaluationToolSuite } from "./tooling/extensions/batch/batch-evaluation-tool-suite.js";
export type {
  BatchTaskStatus,
  BatchTaskItem,
  BatchTaskResult,
  BatchRunMetrics,
  BatchExecutionConfig,
  BatchWorkspaceSnapshot,
} from "./core/contracts/batch.contracts.js";

export { DeterministicClarifyEngine } from "./tooling/extensions/clarify/deterministic-clarify-engine.js";
export { BroccoliClarifySubstrate } from "./sessions/extensions/clarify/broccoli-clarify-substrate.js";
export { ClarifySnapshotManager } from "./sessions/extensions/clarify/clarify-snapshot-manager.js";
export { ClarifyInquirySupervisor } from "./agents/extensions/clarify/clarify-inquiry-supervisor.js";
export { ClarifyInquiryToolSuite } from "./tooling/extensions/clarify/clarify-inquiry-tool-suite.js";
export type {
  ClarifyInputMode,
  ClarifyChoice,
  ClarifyInquiry,
  ClarifyResolution,
  ClarifyWorkspaceSnapshot,
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
export type {
  CasBlob,
  TreeEntry,
  CheckpointNode,
  CheckpointRollbackResult,
  CheckpointWorkspaceSnapshot,
} from "./core/contracts/checkpoint.contracts.js";

export { DeterministicDisplayDriver } from "./tooling/extensions/computer-use/deterministic-display-driver.js";
export { BroccoliDisplaySubstrate } from "./sessions/extensions/computer-use/broccoli-display-substrate.js";
export { DisplaySnapshotManager } from "./sessions/extensions/computer-use/display-snapshot-manager.js";
export { ComputerUseSupervisor } from "./agents/extensions/computer-use/computer-use-supervisor.js";
export { ComputerUseToolSuite } from "./tooling/extensions/computer-use/computer-use-tool-suite.js";
export type {
  ComputerActionType,
  UiElementBounds,
  UiElement,
  VirtualWindow,
  VirtualDisplayFrame,
  ComputerActionResult,
  ComputerWorkspaceSnapshot,
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
export type {
  ModelPricingTier,
  TokenUsageLedgerEntry,
  BudgetCapConfig,
  CostGovernanceResult,
  CostGovernanceWorkspaceSnapshot,
} from "./core/contracts/cost-governance.contracts.js";

export { DeterministicToolDiscloser } from "./tooling/extensions/disclosure/deterministic-tool-discloser.js";
export { BroccoliDisclosureSubstrate } from "./sessions/extensions/disclosure/broccoli-disclosure-substrate.js";
export { ToolDisclosureSnapshotManager } from "./sessions/extensions/disclosure/disclosure-snapshot-manager.js";
export { ToolDisclosureSupervisor } from "./agents/extensions/disclosure/tool-disclosure-supervisor.js";
export { ToolDisclosureToolSuite } from "./tooling/extensions/disclosure/tool-disclosure-tool-suite.js";
export type {
  DeferredToolDefinition,
  DisclosureTier,
  DisclosureManifest,
  ToolSearchResult,
  ToolDisclosureWorkspaceSnapshot,
} from "./core/contracts/tool-disclosure.contracts.js";

export { DeterministicEvidenceLedger } from "./tooling/extensions/evidence/deterministic-evidence-ledger.js";
export { BroccoliEvidenceSubstrate } from "./sessions/extensions/evidence/broccoli-evidence-substrate.js";
export { EvidenceSnapshotManager } from "./sessions/extensions/evidence/evidence-snapshot-manager.js";
export { VerificationEvidenceSupervisor } from "./agents/extensions/evidence/verification-evidence-supervisor.js";
export { VerificationEvidenceToolSuite } from "./tooling/extensions/evidence/verification-evidence-tool-suite.js";
export type {
  EvidenceKind,
  EvidenceScope,
  VerificationEvidenceRecord,
  VerificationStopGateEvaluation,
  SessionInsightsReport,
  VerificationEvidenceWorkspaceSnapshot,
} from "./core/contracts/verification-evidence.contracts.js";

export { DeterministicPromptCacher } from "./tooling/extensions/prompt/deterministic-prompt-cacher.js";
export { BroccoliPromptCacheSubstrate } from "./sessions/extensions/prompt/broccoli-prompt-cache-substrate.js";
export { PromptCacheSnapshotManager } from "./sessions/extensions/prompt/prompt-cache-snapshot-manager.js";
export { PromptCacheSupervisor } from "./agents/extensions/prompt/prompt-cache-supervisor.js";
export { PromptCacheToolSuite } from "./tooling/extensions/prompt/prompt-cache-tool-suite.js";
export type {
  CacheBreakpointType,
  PromptCacheMarker,
  PromptCacheBreakpoint,
  ByteStablePromptEnvelope,
  ReasoningSanitizationResult,
  PromptCacheWorkspaceSnapshot,
} from "./core/contracts/prompt-cache.contracts.js";

export { DeterministicToolSegmenter } from "./tooling/extensions/execution_guard/deterministic-tool-segmenter.js";
export { BroccoliExecutionGuardSubstrate } from "./sessions/extensions/execution_guard/broccoli-execution-guard-substrate.js";
export { ExecutionGuardSnapshotManager } from "./sessions/extensions/execution_guard/execution-guard-snapshot-manager.js";
export { ToolExecutionGuardSupervisor } from "./agents/extensions/execution_guard/tool-execution-guard-supervisor.js";
export { ToolExecutionGuardToolSuite } from "./tooling/extensions/execution_guard/tool-execution-guard-tool-suite.js";
export type {
  ToolExecutionMode,
  ToolCallItem,
  ToolExecutionBatchSegment,
  LoopGuardrailDecision,
  ToolLoopViolationRecord,
  ToolExecutionWorkspaceSnapshot,
} from "./core/contracts/tool-execution-segment.contracts.js";

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
export type {
  ReviewTriggerPolicy,
  CandidateFactItem,
  CandidateSkillItem,
  TurnReviewDigest,
  TurnReviewResult,
  SessionInsightsBreakdown,
  SessionTitleSuggestion,
  ReviewWorkspaceSnapshot,
} from "./core/contracts/background-review.contracts.js";

export { DeterministicDiagnosticDoctor } from "./tooling/extensions/doctor/deterministic-diagnostic-doctor.js";
export { BroccoliDoctorSubstrate } from "./sessions/extensions/doctor/broccoli-doctor-substrate.js";
export { DoctorSnapshotManager } from "./sessions/extensions/doctor/doctor-snapshot-manager.js";
export { DiagnosticDoctorSupervisor } from "./agents/extensions/doctor/diagnostic-doctor-supervisor.js";
export { DiagnosticDoctorToolSuite } from "./tooling/extensions/doctor/diagnostic-doctor-tool-suite.js";
export type {
  DiagnosticSeverity,
  DiagnosticCheckCategory,
  DiagnosticCheckResult,
  SystemDiagnosticReport,
  OrphanedTurnRepairItem,
  SessionSalvageReport,
  DoctorWorkspaceSnapshot,
} from "./core/contracts/diagnostic-doctor.contracts.js";

export { DeterministicAuthFederator } from "./tooling/extensions/auth/deterministic-auth-federator.js";
export { BroccoliAuthSubstrate } from "./sessions/extensions/auth/broccoli-auth-substrate.js";
export { AuthSnapshotManager } from "./sessions/extensions/auth/auth-snapshot-manager.js";
export { IdentityFederationSupervisor } from "./agents/extensions/auth/identity-federation-supervisor.js";
export { IdentityFederationToolSuite } from "./tooling/extensions/auth/identity-federation-tool-suite.js";
export type {
  AuthProviderId,
  AuthFlowType,
  SubscriptionTier,
  PkceChallengePair,
  DeviceAuthorizationPending,
  TokenLeaseRecord,
  SubscriptionEntitlement,
  AuthWorkspaceSnapshot,
} from "./core/contracts/identity-federation.contracts.js";

export { DeterministicSessionArchiver } from "./tooling/extensions/archive/deterministic-session-archiver.js";
export { BroccoliArchiveSubstrate } from "./sessions/extensions/archive/broccoli-archive-substrate.js";
export { ArchiveSnapshotManager } from "./sessions/extensions/archive/archive-snapshot-manager.js";
export { SessionArchiveSupervisor } from "./agents/extensions/archive/session-archive-supervisor.js";
export { SessionArchiveToolSuite } from "./tooling/extensions/archive/session-archive-tool-suite.js";
export type {
  SessionExportFormat,
  ExportedTurnItem,
  SessionArchiveManifest,
  ExportOptions,
  ExportedDocumentResult,
  ArchiveWorkspaceSnapshot,
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
} from "./core/contracts/title-insights.contracts.js";

export { DeterministicHeredocSanitizer } from "./agents/extensions/heredoc_terminal/deterministic-heredoc-sanitizer.js";
export { TerminalDiagnosticsEngine } from "./agents/extensions/heredoc_terminal/terminal-diagnostics-engine.js";
export { HeredocTerminalSupervisor } from "./agents/extensions/heredoc_terminal/heredoc-terminal-supervisor.js";
export { BroccoliHeredocTerminalSubstrate } from "./sessions/extensions/heredoc_terminal/broccoli-heredoc-terminal-substrate.js";
export { HeredocTerminalSnapshotManager } from "./sessions/extensions/heredoc_terminal/heredoc-terminal-snapshot-manager.js";
export { HeredocTerminalToolSuite } from "./tooling/extensions/heredoc_terminal/heredoc-terminal-tool-suite.js";
export {
  INERT_HEREDOC_CONSUMER_PATTERN,
  DANGEROUS_SHELL_PATTERNS,
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
export type {
  PreflightVerdict,
  PreflightThreatCategory,
  PreflightThreatSeverity,
  PreflightThreatFinding,
  PreflightScanResult,
  SupplyChainVerificationResult,
  PreflightSecurityPolicy,
  PreflightWorkspaceSnapshot,
} from "./core/contracts/preflight-scanner.contracts.js";

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
export type {
  IpAddressCategory,
  UrlSafetyVerdict,
  UrlSafetyCheckResult,
  UrlSafetyConfig,
  UrlSafetyMetrics,
  UrlSafetyWorkspaceSnapshot,
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
export type {
  DeadlineOutcome,
  BoundedResult,
  EstopState,
  DeadlineConfig,
  DeadlineMetrics,
  DeadlineWorkspaceSnapshot,
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
  readonly gatewayToolSuite: GatewayToolSuite;
  readonly headTailBudgetGovernor: HeadTailBudgetGovernor;
  readonly deterministicToolPruner: DeterministicToolPruner;
  readonly broccoliCompressionSubstrate: BroccoliCompressionSubstrate;
  readonly compressionSnapshotManager: CompressionSnapshotManager;
  readonly trajectoryCompactorEngine: TrajectoryCompactorEngine;
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
    this.gatewayToolSuite = components.gatewayToolSuite;
    this.headTailBudgetGovernor = components.headTailBudgetGovernor;
    this.deterministicToolPruner = components.deterministicToolPruner;
    this.broccoliCompressionSubstrate = components.broccoliCompressionSubstrate;
    this.compressionSnapshotManager = components.compressionSnapshotManager;
    this.trajectoryCompactorEngine = components.trajectoryCompactorEngine;
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

  /** Dynamically changes the active LLM model */
  setModel(modelName: string): void {
    (this.config as { modelName: string }).modelName = modelName;
    this.modelResolver.setActiveModel(modelName);
    this.setupWizard.setSavedModel(modelName);
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
  const isSmoke = args.includes("--smoke") || args.includes("-s");
  const isSetup = args.includes("--setup") || args.includes("setup");
  const isBenchmark = args.includes("--benchmark") || args.includes("-b");
  const isBaseline = args.includes("--baseline");
  const isHelp = args.includes("--help") || args.includes("-h");

  if (isHelp) {
    console.log(`
\x1b[1;36mLUMI Agent CLI\x1b[0m

Usage:
  lumi                    Start interactive REPL mode
  lumi --setup            Launch Interactive Setup Wizard (Model Providers & OAuth)
  lumi --benchmark (-b)   Run Automated Engine Benchmark & Throughput Test Suite
  lumi --baseline         Run smoke + benchmark + guardrails and regenerate live baseline reports
  lumi "your prompt"      Run a single prompt turn
  lumi --smoke (-s)       Run current capability-based runtime smoke suite
  lumi --help (-h)        Show this help message
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

    if (isSetup) {
      await lumi.setupWizard.runInteractiveWizard();
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
