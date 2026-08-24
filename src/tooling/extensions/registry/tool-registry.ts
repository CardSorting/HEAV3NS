import * as os from "node:os";
import { AbstractToolRegistry } from "../../../core/abstracts/abstract-tool-registry.js";
import type { SchemaValidationResult } from "../../../core/contracts/tooling.contracts.js";
import type { Eyes } from "../../base/eyes.js";
import type { AstPerceptionEyes } from "../perception/ast-eyes.js";
import type { AnchoredHands } from "../hashline/hands.js";
import type { ProtocolEars } from "../telemetry/ears.js";
import { SkillsIngestor } from "./skills-ingestor.js";
import { ArgumentCoercer } from "./argument-coercer.js";
import { ToolCallArgParser } from "./tool-call-arg-parser.js";
import { ToolSchemaSerializer } from "./tool-schema-serializer.js";
import { ToolExecutionScheduler } from "../execution/tool-execution-scheduler.js";
import { ToolExecutionCache } from "../execution/tool-execution-cache.js";
import { ToolOutputGovernor } from "../execution/tool-output-governor.js";
import { ToolErrorAutoHealer } from "../execution/tool-error-auto-healer.js";
import { ToolTransactionJournal } from "../execution/tool-transaction-journal.js";
import { ToolSafetyPolicyManager } from "../execution/tool-safety-policy-manager.js";
import { ToolConfirmationGatekeeper } from "../execution/tool-confirmation-gatekeeper.js";
import { ToolLoopBreaker } from "../execution/tool-loop-breaker.js";
import { ToolTelemetryLedger } from "../execution/tool-telemetry-ledger.js";
import { MultiFileAtomicPatchOrchestrator } from "../execution/multi-file-atomic-patch-orchestrator.js";
import { ToolPipelineMiddlewareChain } from "../execution/tool-pipeline-middleware.js";
import { ToolSchemaCompressor } from "./tool-schema-compressor.js";
import { ToolSpeculativePrefetcher } from "../execution/tool-speculative-prefetcher.js";
import { DynamicToolRouter } from "./dynamic-tool-router.js";
import { ToolDependencyGraphPlanner } from "../execution/tool-dependency-graph-planner.js";
import { ToolOutputSummarizer } from "../execution/tool-output-summarizer.js";
import { ToolMockHarness } from "../execution/tool-mock-harness.js";
import { ToolChoicePolicyOrchestrator } from "./tool-choice-policy-orchestrator.js";
import type { SessionMemoryStore } from "../../../sessions/extensions/memory/session-memory-store.js";

import { BroccoliCircuitBreaker } from "../policy/broccoli-circuit-breaker.js";
import { ModuleDecomposer } from "../policy/module-decomposer.js";
import { StabilityDoctor } from "../../../sessions/extensions/integrity/stability-doctor.js";
import { BroccoliStreamingToolExecutor } from "./broccolidb-streaming-tool-executor.js";

import type { SkillTreeToolSuite } from "../skills/skill-tree-tool-suite.js";
import type { SoulToolSuite } from "../soul/soul-tool-suite.js";
import type { SwarmToolSuite } from "../delegation/swarm-tool-suite.js";
import type { CronToolSuite } from "../cron/cron-tool-suite.js";
import type { CdpToolSuite } from "../cdp/cdp-tool-suite.js";
import type { CredentialToolSuite } from "../credential/credential-tool-suite.js";
import type { GatewayToolSuite } from "../gateway/gateway-tool-suite.js";
import type { CompressionToolSuite } from "../compaction/compression-tool-suite.js";
import type { SearchToolSuite } from "../search/search-tool-suite.js";
import type { EnvironmentToolSuite } from "../environments/environment-tool-suite.js";
import type { FaultDiagnosticToolSuite } from "../faults/fault-diagnostic-tool-suite.js";
import type { AcpToolSuite } from "../acp/acp-tool-suite.js";
import type { McpClientToolSuite } from "../mcp/mcp-client-tool-suite.js";
import type { ProcessToolSuite } from "../process/process-tool-suite.js";
import type { ArbiterToolSuite } from "../arbiter/arbiter-tool-suite.js";
import type { LearningCuratorToolSuite } from "../memory/learning-curator-tool-suite.js";
import type { FileMutationToolSuite } from "../patch/file-mutation-tool-suite.js";
import type { LspCodeIntelligenceToolSuite } from "../lsp/lsp-code-intelligence-tool-suite.js";
import type { VoiceSpeechToolSuite } from "../voice/voice-speech-tool-suite.js";
import type { MultimodalVisionToolSuite } from "../vision/multimodal-vision-tool-suite.js";
import type { KanbanOrchestrationToolSuite } from "../kanban/kanban-orchestration-tool-suite.js";
import type { WebIntelligenceToolSuite } from "../web/web-intelligence-tool-suite.js";
import type { CodeExecutionToolSuite } from "../execution/code-execution-tool-suite.js";
import type { BatchEvaluationToolSuite } from "../batch/batch-evaluation-tool-suite.js";
import type { ClarifyInquiryToolSuite } from "../clarify/clarify-inquiry-tool-suite.js";
import type { ThreatFirewallToolSuite } from "../threat/threat-firewall-tool-suite.js";
import type { CheckpointKernelToolSuite } from "../checkpoint/checkpoint-kernel-tool-suite.js";
import type { ComputerUseToolSuite } from "../computer-use/computer-use-tool-suite.js";
import type { SkillsHubToolSuite } from "../skills-hub/skills-hub-tool-suite.js";
import type { CostGovernanceToolSuite } from "../cost/cost-governance-tool-suite.js";
import type { ToolDisclosureToolSuite } from "../disclosure/tool-disclosure-tool-suite.js";
import type { VerificationEvidenceToolSuite } from "../evidence/verification-evidence-tool-suite.js";
import type { PromptCacheToolSuite } from "../prompt/prompt-cache-tool-suite.js";
import type { ToolExecutionGuardToolSuite } from "../execution_guard/tool-execution-guard-tool-suite.js";
import type { SecretRedactionToolSuite } from "../redaction/secret-redaction-tool-suite.js";
import type { BackgroundReviewToolSuite } from "../review/background-review-tool-suite.js";
import type { DiagnosticDoctorToolSuite } from "../doctor/diagnostic-doctor-tool-suite.js";
import type { IdentityFederationToolSuite } from "../auth/identity-federation-tool-suite.js";
import type { SessionArchiveToolSuite } from "../archive/session-archive-tool-suite.js";
import type { TerminalSkinToolSuite } from "../skin/terminal-skin-tool-suite.js";
import type { AuxiliaryRouterToolSuite } from "../router/auxiliary-router-tool-suite.js";
import type { ReasoningToolSuite } from "../reasoning/reasoning-tool-suite.js";
import type { FuzzyMatcherToolSuite } from "../fuzzy/fuzzy-matcher-tool-suite.js";
import type { TitleInsightsToolSuite } from "../title_insights/title-insights-tool-suite.js";
import type { HeredocTerminalToolSuite } from "../heredoc_terminal/heredoc-terminal-tool-suite.js";
import type { StealthBrowserToolSuite } from "../stealth_browser/stealth-browser-tool-suite.js";
import type { SkillsSyncToolSuite } from "../skills_sync/skills-sync-tool-suite.js";
import type { PreflightToolSuite } from "../preflight_scanner/preflight-tool-suite.js";
import type { AudioContainerToolSuite } from "../audio_container/audio-container-tool-suite.js";
import type { SpeechNormalizerToolSuite } from "../speech_normalizer/speech-normalizer-tool-suite.js";
import type { DocExtractorToolSuite } from "../doc_extractor/doc-extractor-tool-suite.js";
import type { SpillVaultToolSuite } from "../spill_vault/spill-vault-tool-suite.js";
import type { UrlSafetyToolSuite } from "../url_safety/url-safety-tool-suite.js";
import type { V4aPatchToolSuite } from "../v4a_patch/v4a-patch-tool-suite.js";
import type { WebsitePolicyToolSuite } from "../website_policy/website-policy-tool-suite.js";
import type { WakeWordToolSuite } from "../wake_word/wake-word-tool-suite.js";
import type { MediaSourceToolSuite } from "../media_source/media-source-tool-suite.js";
import type { WorktreeToolSuite } from "../worktree/worktree-tool-suite.js";
import type { TranscriptionToolSuite } from "../transcription/transcription-tool-suite.js";
import type { DeadlineToolSuite } from "../deadline/deadline-tool-suite.js";
import type { FileSafetyToolSuite } from "../file_safety/file-safety-tool-suite.js";
import type { ContextBreakdownToolSuite } from "../context_breakdown/context-breakdown-tool-suite.js";
import type { OsvScannerToolSuite } from "../osv/osv-scanner-tool-suite.js";
import type { SubdirHintsToolSuite } from "../subdir_hints/subdir-hints-tool-suite.js";
import type { StreamDiagToolSuite } from "../stream_diag/stream-diag-tool-suite.js";
import type { TurnRetryToolSuite } from "../turn_retry/turn-retry-tool-suite.js";
import type { BillingUsageToolSuite } from "../billing_usage/billing-usage-tool-suite.js";
import type { ThreadContextToolSuite } from "../thread_context/thread-context-tool-suite.js";
import type { EnvProbeToolSuite } from "../env_probe/env-probe-tool-suite.js";
import type { SkillLinterToolSuite } from "../skill_linter/skill-linter-tool-suite.js";
import type { TerminalCleanerToolSuite } from "../terminal_cleaner/terminal-cleaner-tool-suite.js";
import type { StreamingScrubberToolSuite } from "../streaming_scrubber/streaming-scrubber-tool-suite.js";
import type { SelfRepoGuardToolSuite } from "../self_repo_guard/self-repo-guard-tool-suite.js";
import type { SchemaSanitizerToolSuite } from "../schema_sanitizer/schema-sanitizer-tool-suite.js";
import type { NousPortalToolSuite } from "../nous_portal/nous-portal-tool-suite.js";
import type { GoalToolSuite } from "../goals/goal-tool-suite.js";
import type { ProfileToolSuite } from "../profiles/profile-tool-suite.js";
import type { DatabaseToolSuite } from "../database/database-tools.js";
import type { WalletToolSuite } from "../wallet/wallet-tool-suite.js";
import type { EmailToolSuite } from "../email/email-tool-suite.js";
import type { OtlpToolSuite } from "../otlp/otlp-tool-suite.js";
import type { DaemonToolSuite } from "../daemon/daemon-tool-suite.js";
import type { RunbookToolSuite } from "../runbooks/runbook-tool-suite.js";

export class ValidatingToolRegistry extends AbstractToolRegistry {
  readonly skillsIngestor: SkillsIngestor;
  readonly skillTreeToolSuite?: SkillTreeToolSuite;
  readonly soulToolSuite?: SoulToolSuite;
  readonly swarmToolSuite?: SwarmToolSuite;
  readonly cronToolSuite?: CronToolSuite;
  readonly cdpToolSuite?: CdpToolSuite;
  readonly credentialToolSuite?: CredentialToolSuite;
  readonly gatewayToolSuite?: GatewayToolSuite;
  readonly compressionToolSuite?: CompressionToolSuite;
  readonly searchToolSuite?: SearchToolSuite;
  readonly environmentToolSuite?: EnvironmentToolSuite;
  readonly faultDiagnosticToolSuite?: FaultDiagnosticToolSuite;
  readonly acpToolSuite?: AcpToolSuite;
  readonly mcpClientToolSuite?: McpClientToolSuite;
  readonly processToolSuite?: ProcessToolSuite;
  readonly arbiterToolSuite?: ArbiterToolSuite;
  readonly learningCuratorToolSuite?: LearningCuratorToolSuite;
  readonly fileMutationToolSuite?: FileMutationToolSuite;
  readonly lspCodeIntelligenceToolSuite?: LspCodeIntelligenceToolSuite;
  readonly voiceSpeechToolSuite?: VoiceSpeechToolSuite;
  readonly multimodalVisionToolSuite?: MultimodalVisionToolSuite;
  readonly kanbanOrchestrationToolSuite?: KanbanOrchestrationToolSuite;
  readonly webIntelligenceToolSuite?: WebIntelligenceToolSuite;
  readonly codeExecutionToolSuite?: CodeExecutionToolSuite;
  readonly batchEvaluationToolSuite?: BatchEvaluationToolSuite;
  readonly clarifyInquiryToolSuite?: ClarifyInquiryToolSuite;
  readonly threatFirewallToolSuite?: ThreatFirewallToolSuite;
  readonly checkpointKernelToolSuite?: CheckpointKernelToolSuite;
  readonly computerUseToolSuite?: ComputerUseToolSuite;
  readonly skillsHubToolSuite?: SkillsHubToolSuite;
  readonly costGovernanceToolSuite?: CostGovernanceToolSuite;
  readonly toolDisclosureToolSuite?: ToolDisclosureToolSuite;
  readonly verificationEvidenceToolSuite?: VerificationEvidenceToolSuite;
  readonly promptCacheToolSuite?: PromptCacheToolSuite;
  readonly toolExecutionGuardToolSuite?: ToolExecutionGuardToolSuite;
  readonly secretRedactionToolSuite?: SecretRedactionToolSuite;
  readonly backgroundReviewToolSuite?: BackgroundReviewToolSuite;
  readonly diagnosticDoctorToolSuite?: DiagnosticDoctorToolSuite;
  readonly identityFederationToolSuite?: IdentityFederationToolSuite;
  readonly sessionArchiveToolSuite?: SessionArchiveToolSuite;
  readonly terminalSkinToolSuite?: TerminalSkinToolSuite;
  readonly auxiliaryRouterToolSuite?: AuxiliaryRouterToolSuite;
  readonly reasoningToolSuite?: ReasoningToolSuite;
  readonly fuzzyMatcherToolSuite?: FuzzyMatcherToolSuite;
  readonly titleInsightsToolSuite?: TitleInsightsToolSuite;
  readonly heredocTerminalToolSuite?: HeredocTerminalToolSuite;
  readonly stealthBrowserToolSuite?: StealthBrowserToolSuite;
  readonly skillsSyncToolSuite?: SkillsSyncToolSuite;
  readonly preflightToolSuite?: PreflightToolSuite;
  readonly audioContainerToolSuite?: AudioContainerToolSuite;
  readonly speechNormalizerToolSuite?: SpeechNormalizerToolSuite;
  readonly docExtractorToolSuite?: DocExtractorToolSuite;
  readonly spillVaultToolSuite?: SpillVaultToolSuite;
  readonly urlSafetyToolSuite?: UrlSafetyToolSuite;
  readonly v4aPatchToolSuite?: V4aPatchToolSuite;
  readonly websitePolicyToolSuite?: WebsitePolicyToolSuite;
  readonly wakeWordToolSuite?: WakeWordToolSuite;
  readonly mediaSourceToolSuite?: MediaSourceToolSuite;
  readonly worktreeToolSuite?: WorktreeToolSuite;
  readonly transcriptionToolSuite?: TranscriptionToolSuite;
  readonly deadlineToolSuite?: DeadlineToolSuite;
  readonly fileSafetyToolSuite?: FileSafetyToolSuite;
  readonly contextBreakdownToolSuite?: ContextBreakdownToolSuite;
  readonly osvScannerToolSuite?: OsvScannerToolSuite;
  readonly subdirHintsToolSuite?: SubdirHintsToolSuite;
  readonly streamDiagToolSuite?: StreamDiagToolSuite;
  readonly turnRetryToolSuite?: TurnRetryToolSuite;
  readonly billingUsageToolSuite?: BillingUsageToolSuite;
  readonly threadContextToolSuite?: ThreadContextToolSuite;
  readonly envProbeToolSuite?: EnvProbeToolSuite;
  readonly skillLinterToolSuite?: SkillLinterToolSuite;
  readonly terminalCleanerToolSuite?: TerminalCleanerToolSuite;
  readonly streamingScrubberToolSuite?: StreamingScrubberToolSuite;
  readonly selfRepoGuardToolSuite?: SelfRepoGuardToolSuite;
  readonly schemaSanitizerToolSuite?: SchemaSanitizerToolSuite;
  readonly nousPortalToolSuite?: NousPortalToolSuite;
  readonly goalToolSuite?: GoalToolSuite;
  readonly profileToolSuite?: ProfileToolSuite;
  readonly databaseToolSuite?: DatabaseToolSuite;
  readonly walletToolSuite?: WalletToolSuite;
  readonly emailToolSuite?: EmailToolSuite;
  readonly otlpToolSuite?: OtlpToolSuite;
  readonly daemonToolSuite?: DaemonToolSuite;
  readonly runbookToolSuite?: RunbookToolSuite;
  readonly memoryStore?: SessionMemoryStore;
  readonly moduleDecomposer: ModuleDecomposer;
  readonly stabilityDoctor: StabilityDoctor;
  readonly circuitBreaker: BroccoliCircuitBreaker;
  readonly streamingExecutor: BroccoliStreamingToolExecutor;
  readonly argParser: ToolCallArgParser;
  readonly schemaSerializer: ToolSchemaSerializer;

  constructor(
    eyes: Eyes,
    hands: AnchoredHands,
    ears: ProtocolEars,
    skillsIngestor?: SkillsIngestor,
    memoryStore?: SessionMemoryStore,
    skillTreeToolSuite?: SkillTreeToolSuite,
    soulToolSuite?: SoulToolSuite,
    swarmToolSuite?: SwarmToolSuite,
    cronToolSuite?: CronToolSuite,
    cdpToolSuite?: CdpToolSuite,
    credentialToolSuite?: CredentialToolSuite,
    gatewayToolSuite?: GatewayToolSuite,
    compressionToolSuite?: CompressionToolSuite,
    searchToolSuite?: SearchToolSuite,
    environmentToolSuite?: EnvironmentToolSuite,
    faultDiagnosticToolSuite?: FaultDiagnosticToolSuite,
    acpToolSuite?: AcpToolSuite,
    mcpClientToolSuite?: McpClientToolSuite,
    processToolSuite?: ProcessToolSuite,
    arbiterToolSuite?: ArbiterToolSuite,
    learningCuratorToolSuite?: LearningCuratorToolSuite,
    fileMutationToolSuite?: FileMutationToolSuite,
    lspCodeIntelligenceToolSuite?: LspCodeIntelligenceToolSuite,
    voiceSpeechToolSuite?: VoiceSpeechToolSuite,
    multimodalVisionToolSuite?: MultimodalVisionToolSuite,
    kanbanOrchestrationToolSuite?: KanbanOrchestrationToolSuite,
    webIntelligenceToolSuite?: WebIntelligenceToolSuite,
    codeExecutionToolSuite?: CodeExecutionToolSuite,
    batchEvaluationToolSuite?: BatchEvaluationToolSuite,
    clarifyInquiryToolSuite?: ClarifyInquiryToolSuite,
    threatFirewallToolSuite?: ThreatFirewallToolSuite,
    checkpointKernelToolSuite?: CheckpointKernelToolSuite,
    computerUseToolSuite?: ComputerUseToolSuite,
    skillsHubToolSuite?: SkillsHubToolSuite,
    costGovernanceToolSuite?: CostGovernanceToolSuite,
    toolDisclosureToolSuite?: ToolDisclosureToolSuite,
    verificationEvidenceToolSuite?: VerificationEvidenceToolSuite,
    promptCacheToolSuite?: PromptCacheToolSuite,
    toolExecutionGuardToolSuite?: ToolExecutionGuardToolSuite,
    secretRedactionToolSuite?: SecretRedactionToolSuite,
    backgroundReviewToolSuite?: BackgroundReviewToolSuite,
    diagnosticDoctorToolSuite?: DiagnosticDoctorToolSuite,
    identityFederationToolSuite?: IdentityFederationToolSuite,
    sessionArchiveToolSuite?: SessionArchiveToolSuite,
    terminalSkinToolSuite?: TerminalSkinToolSuite,
    auxiliaryRouterToolSuite?: AuxiliaryRouterToolSuite,
    reasoningToolSuite?: ReasoningToolSuite,
    fuzzyMatcherToolSuite?: FuzzyMatcherToolSuite,
    titleInsightsToolSuite?: TitleInsightsToolSuite,
    heredocTerminalToolSuite?: HeredocTerminalToolSuite,
    stealthBrowserToolSuite?: StealthBrowserToolSuite,
    skillsSyncToolSuite?: SkillsSyncToolSuite,
    preflightToolSuite?: PreflightToolSuite,
    audioContainerToolSuite?: AudioContainerToolSuite,
    speechNormalizerToolSuite?: SpeechNormalizerToolSuite,
    docExtractorToolSuite?: DocExtractorToolSuite,
    spillVaultToolSuite?: SpillVaultToolSuite,
    urlSafetyToolSuite?: UrlSafetyToolSuite,
    v4aPatchToolSuite?: V4aPatchToolSuite,
    websitePolicyToolSuite?: WebsitePolicyToolSuite,
    wakeWordToolSuite?: WakeWordToolSuite,
    mediaSourceToolSuite?: MediaSourceToolSuite,
    worktreeToolSuite?: WorktreeToolSuite,
    transcriptionToolSuite?: TranscriptionToolSuite,
    deadlineToolSuite?: DeadlineToolSuite,
    fileSafetyToolSuite?: FileSafetyToolSuite,
    contextBreakdownToolSuite?: ContextBreakdownToolSuite,
    osvScannerToolSuite?: OsvScannerToolSuite,
    subdirHintsToolSuite?: SubdirHintsToolSuite,
    streamDiagToolSuite?: StreamDiagToolSuite,
    turnRetryToolSuite?: TurnRetryToolSuite,
    billingUsageToolSuite?: BillingUsageToolSuite,
    threadContextToolSuite?: ThreadContextToolSuite,
    envProbeToolSuite?: EnvProbeToolSuite,
    skillLinterToolSuite?: SkillLinterToolSuite,
    terminalCleanerToolSuite?: TerminalCleanerToolSuite,
    streamingScrubberToolSuite?: StreamingScrubberToolSuite,
    selfRepoGuardToolSuite?: SelfRepoGuardToolSuite,
    schemaSanitizerToolSuite?: SchemaSanitizerToolSuite,
    nousPortalToolSuite?: NousPortalToolSuite,
    goalToolSuite?: GoalToolSuite,
    profileToolSuite?: ProfileToolSuite,
    databaseToolSuite?: DatabaseToolSuite,
    walletToolSuite?: WalletToolSuite,
    emailToolSuite?: EmailToolSuite,
    otlpToolSuite?: OtlpToolSuite,
    daemonToolSuite?: DaemonToolSuite,
    runbookToolSuite?: RunbookToolSuite
  ) {
    super(eyes, hands, ears);
    this.skillsIngestor = skillsIngestor ?? new SkillsIngestor(eyes);
    this.skillTreeToolSuite = skillTreeToolSuite;
    this.soulToolSuite = soulToolSuite;
    this.swarmToolSuite = swarmToolSuite;
    this.cronToolSuite = cronToolSuite;
    this.cdpToolSuite = cdpToolSuite;
    this.credentialToolSuite = credentialToolSuite;
    this.gatewayToolSuite = gatewayToolSuite;
    this.compressionToolSuite = compressionToolSuite;
    this.searchToolSuite = searchToolSuite;
    this.environmentToolSuite = environmentToolSuite;
    this.faultDiagnosticToolSuite = faultDiagnosticToolSuite;
    this.acpToolSuite = acpToolSuite;
    this.mcpClientToolSuite = mcpClientToolSuite;
    this.processToolSuite = processToolSuite;
    this.arbiterToolSuite = arbiterToolSuite;
    this.learningCuratorToolSuite = learningCuratorToolSuite;
    this.fileMutationToolSuite = fileMutationToolSuite;
    this.lspCodeIntelligenceToolSuite = lspCodeIntelligenceToolSuite;
    this.voiceSpeechToolSuite = voiceSpeechToolSuite;
    this.multimodalVisionToolSuite = multimodalVisionToolSuite;
    this.kanbanOrchestrationToolSuite = kanbanOrchestrationToolSuite;
    this.webIntelligenceToolSuite = webIntelligenceToolSuite;
    this.codeExecutionToolSuite = codeExecutionToolSuite;
    this.batchEvaluationToolSuite = batchEvaluationToolSuite;
    this.clarifyInquiryToolSuite = clarifyInquiryToolSuite;
    this.threatFirewallToolSuite = threatFirewallToolSuite;
    this.checkpointKernelToolSuite = checkpointKernelToolSuite;
    this.computerUseToolSuite = computerUseToolSuite;
    this.skillsHubToolSuite = skillsHubToolSuite;
    this.costGovernanceToolSuite = costGovernanceToolSuite;
    this.toolDisclosureToolSuite = toolDisclosureToolSuite;
    this.verificationEvidenceToolSuite = verificationEvidenceToolSuite;
    this.promptCacheToolSuite = promptCacheToolSuite;
    this.toolExecutionGuardToolSuite = toolExecutionGuardToolSuite;
    this.secretRedactionToolSuite = secretRedactionToolSuite;
    this.backgroundReviewToolSuite = backgroundReviewToolSuite;
    this.diagnosticDoctorToolSuite = diagnosticDoctorToolSuite;
    this.identityFederationToolSuite = identityFederationToolSuite;
    this.sessionArchiveToolSuite = sessionArchiveToolSuite;
    this.terminalSkinToolSuite = terminalSkinToolSuite;
    this.auxiliaryRouterToolSuite = auxiliaryRouterToolSuite;
    this.reasoningToolSuite = reasoningToolSuite;
    this.fuzzyMatcherToolSuite = fuzzyMatcherToolSuite;
    this.titleInsightsToolSuite = titleInsightsToolSuite;
    this.heredocTerminalToolSuite = heredocTerminalToolSuite;
    this.stealthBrowserToolSuite = stealthBrowserToolSuite;
    this.skillsSyncToolSuite = skillsSyncToolSuite;
    this.preflightToolSuite = preflightToolSuite;
    this.audioContainerToolSuite = audioContainerToolSuite;
    this.speechNormalizerToolSuite = speechNormalizerToolSuite;
    this.docExtractorToolSuite = docExtractorToolSuite;
    this.spillVaultToolSuite = spillVaultToolSuite;
    this.urlSafetyToolSuite = urlSafetyToolSuite;
    this.v4aPatchToolSuite = v4aPatchToolSuite;
    this.websitePolicyToolSuite = websitePolicyToolSuite;
    this.wakeWordToolSuite = wakeWordToolSuite;
    this.mediaSourceToolSuite = mediaSourceToolSuite;
    this.worktreeToolSuite = worktreeToolSuite;
    this.transcriptionToolSuite = transcriptionToolSuite;
    this.deadlineToolSuite = deadlineToolSuite;
    this.fileSafetyToolSuite = fileSafetyToolSuite;
    this.contextBreakdownToolSuite = contextBreakdownToolSuite;
    this.osvScannerToolSuite = osvScannerToolSuite;
    this.subdirHintsToolSuite = subdirHintsToolSuite;
    this.streamDiagToolSuite = streamDiagToolSuite;
    this.turnRetryToolSuite = turnRetryToolSuite;
    this.billingUsageToolSuite = billingUsageToolSuite;
    this.threadContextToolSuite = threadContextToolSuite;
    this.envProbeToolSuite = envProbeToolSuite;
    this.skillLinterToolSuite = skillLinterToolSuite;
    this.terminalCleanerToolSuite = terminalCleanerToolSuite;
    this.streamingScrubberToolSuite = streamingScrubberToolSuite;
    this.selfRepoGuardToolSuite = selfRepoGuardToolSuite;
    this.schemaSanitizerToolSuite = schemaSanitizerToolSuite;
    this.nousPortalToolSuite = nousPortalToolSuite;
    this.goalToolSuite = goalToolSuite;
    this.profileToolSuite = profileToolSuite;
    this.databaseToolSuite = databaseToolSuite;
    this.walletToolSuite = walletToolSuite;
    this.emailToolSuite = emailToolSuite;
    this.otlpToolSuite = otlpToolSuite;
    this.daemonToolSuite = daemonToolSuite;
    this.runbookToolSuite = runbookToolSuite;
    this.memoryStore = memoryStore;
    this.moduleDecomposer = new ModuleDecomposer();
    this.stabilityDoctor = new StabilityDoctor();
    this.circuitBreaker = new BroccoliCircuitBreaker();
    this.streamingExecutor = new BroccoliStreamingToolExecutor();
    this.argParser = new ToolCallArgParser();
    this.schemaSerializer = new ToolSchemaSerializer();
    this.cache = new ToolExecutionCache();
    this.governor = new ToolOutputGovernor();
    this.healer = new ToolErrorAutoHealer();
    this.journal = new ToolTransactionJournal();
    this.safetyPolicy = new ToolSafetyPolicyManager();
    this.confirmationGatekeeper = new ToolConfirmationGatekeeper();
    this.loopBreaker = new ToolLoopBreaker();
    this.telemetryLedger = new ToolTelemetryLedger();
    this.atomicPatchOrchestrator = new MultiFileAtomicPatchOrchestrator(this.journal);
    this.middlewareChain = new ToolPipelineMiddlewareChain();
    this.schemaCompressor = new ToolSchemaCompressor();
    this.prefetcher = new ToolSpeculativePrefetcher();
    this.dynamicRouter = new DynamicToolRouter();
    this.dagPlanner = new ToolDependencyGraphPlanner();
    this.summarizer = new ToolOutputSummarizer();
    this.mockHarness = new ToolMockHarness();
    this.choiceOrchestrator = new ToolChoicePolicyOrchestrator();
    this.scheduler = new ToolExecutionScheduler({
      cache: this.cache,
      governor: this.governor,
      healer: this.healer,
      parser: this.argParser,
    });
    this.registerBuiltins();
  }

  readonly cache: ToolExecutionCache;
  readonly governor: ToolOutputGovernor;
  readonly healer: ToolErrorAutoHealer;
  readonly scheduler: ToolExecutionScheduler;
  readonly journal: ToolTransactionJournal;
  readonly safetyPolicy: ToolSafetyPolicyManager;
  readonly confirmationGatekeeper: ToolConfirmationGatekeeper;
  readonly loopBreaker: ToolLoopBreaker;
  readonly telemetryLedger: ToolTelemetryLedger;
  readonly atomicPatchOrchestrator: MultiFileAtomicPatchOrchestrator;
  readonly middlewareChain: ToolPipelineMiddlewareChain;
  readonly schemaCompressor: ToolSchemaCompressor;
  readonly prefetcher: ToolSpeculativePrefetcher;
  readonly dynamicRouter: DynamicToolRouter;
  readonly dagPlanner: ToolDependencyGraphPlanner;
  readonly summarizer: ToolOutputSummarizer;
  readonly mockHarness: ToolMockHarness;
  readonly choiceOrchestrator: ToolChoicePolicyOrchestrator;

  validateToolArgs(name: string, rawArgs: Record<string, unknown>): SchemaValidationResult {
    const canonicalName = this.getTool(name)?.name ?? name;
    const tool = this.tools.get(canonicalName);
    if (!tool) {
      return { valid: false, errors: [`Tool '${name}' not found`] };
    }

    const { args: preparedArgs, validation } = this.argParser.prepareArguments(tool, rawArgs);
    for (const [k, v] of Object.entries(preparedArgs)) {
      rawArgs[k] = v;
    }

    return validation;
  }

  override async executeTool(
    name: string,
    rawArgs: Record<string, unknown>,
    cwd: string
  ): Promise<unknown> {
    const canonicalName = this.getTool(name)?.name ?? name;
    if (!this.circuitBreaker.canExecute(canonicalName)) {
      throw new Error(`Circuit Breaker OPEN: Execution of tool '${canonicalName}' is temporarily blocked due to repeated failures.`);
    }

    const tool = this.tools.get(canonicalName);
    if (!tool) {
      throw new Error(`Tool standard target '${name}' not found in registry`);
    }

    const { args: preparedArgs, validation } = this.argParser.prepareArguments(tool, rawArgs);
    for (const [k, v] of Object.entries(preparedArgs)) {
      rawArgs[k] = v;
    }

    if (preparedArgs.isDryRun === true) {
      return this.safetyPolicy.simulateDryRun(canonicalName, preparedArgs, cwd, tool);
    }

    if (!validation.valid) {
      this.circuitBreaker.recordFailure(canonicalName);
      const suggestionsMsg = validation.suggestions && validation.suggestions.length > 0
        ? `\nSuggestions: ${validation.suggestions.join(" ")}`
        : "";
      throw new Error(`Tool '${canonicalName}' argument schema validation failed: ${validation.errors.join("; ")}${suggestionsMsg}`);
    }

    // Check mock sandbox harness
    const mockHit = await this.mockHarness.interceptExecution(canonicalName, preparedArgs, cwd);
    if (mockHit.intercepted) {
      return mockHit.result;
    }

    // Check recursive tool loop
    const loopCheck = this.loopBreaker.recordAndCheck(canonicalName, preparedArgs);
    if (loopCheck.loopDetected) {
      throw new Error(loopCheck.advisoryMessage);
    }

    // Check safety policy & confirmation gatekeeper
    const safety = this.safetyPolicy.evaluateSafety(canonicalName, preparedArgs, cwd, tool);
    const confirmation = await this.confirmationGatekeeper.checkConfirmation(canonicalName, preparedArgs, safety);
    if (!confirmation.approved) {
      throw new Error(confirmation.rejectionFeedback || `Execution of tool '${canonicalName}' was blocked by confirmation policy.`);
    }

    // Check speculative prefetch cache
    const prefetchHit = await this.prefetcher.consumePrefetch(canonicalName, preparedArgs, cwd);
    if (prefetchHit.hit) {
      return prefetchHit.result;
    }

    // Check read cache
    const cached = this.cache.get(canonicalName, preparedArgs, cwd);
    if (cached !== null) {
      return cached;
    }

    const startTime = Date.now();
    try {
      const result = await super.executeTool(canonicalName, preparedArgs, cwd);
      const elapsed = Date.now() - startTime;
      this.circuitBreaker.recordSuccess(canonicalName);
      this.telemetryLedger.recordSample(
        canonicalName,
        elapsed,
        true,
        typeof result === "string" ? result.length : 0
      );

      this.mockHarness.recordExecution({
        name: canonicalName,
        toolName: canonicalName,
        callId: `call_${Date.now()}`,
        args: preparedArgs,
        output: result,
        result,
        success: true,
        durationMs: elapsed,
      });

      if (tool.isMutating) {
        const paths = this.cache.extractPaths(preparedArgs, cwd);
        this.cache.invalidatePaths(paths, cwd);
      } else {
        this.cache.set(canonicalName, preparedArgs, cwd, result);
      }

      return result;
    } catch (err) {
      const elapsed = Date.now() - startTime;
      this.circuitBreaker.recordFailure(canonicalName);
      this.telemetryLedger.recordSample(canonicalName, elapsed, false);
      throw err;
    }
  }

  protected registerBuiltins(): void {
    const hands = this.hands as AnchoredHands;

    this.registerTool({
      name: "view_file",
      description: "Read contents of a file with optional line slicing and offset (Eyes)",
      parameters: {
        path: { type: "string", required: true, description: "Absolute or relative file path" },
        startLine: { type: "number", required: false, description: "1-indexed starting line number" },
        endLine: { type: "number", required: false, description: "1-indexed ending line number" },
        contentOffset: { type: "number", required: false, description: "Byte offset to slice content from" },
      },
      execute: async (args, cwd) => {
        const targetPath = String(args.path);
        const resolvedPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        const startLine = typeof args.startLine === "number" ? args.startLine : undefined;
        const endLine = typeof args.endLine === "number" ? args.endLine : undefined;
        const contentOffset = typeof args.contentOffset === "number" ? args.contentOffset : undefined;
        return this.eyes.readFile(resolvedPath, { startLine, endLine, contentOffset });
      },
    });

    this.registerTool({
      name: "write_file",
      description: "Write content to a file (Hands)",
      isMutating: true,
      parameters: {
        path: { type: "string", required: true, description: "Target file path" },
        content: { type: "string", required: true, description: "Content string" },
      },
      execute: async (args, cwd) => {
        const targetPath = String(args.path);
        const resolvedPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        const content = String(args.content);
        await this.journal.recordFileMutation("write_file", resolvedPath, content);
        await hands.writeFile(resolvedPath, content);
        return { success: true, path: resolvedPath };
      },
    });

    this.registerTool({
      name: "replace_file_content",
      description: "Replace an exact target block of text in a file with new content (Hands)",
      isMutating: true,
      parameters: {
        path: { type: "string", required: true, description: "Target file path" },
        target: { type: "string", required: true, description: "Exact target text to find and replace" },
        replacement: { type: "string", required: true, description: "Replacement text" },
      },
      execute: async (args, cwd) => {
        const targetPath = String(args.path);
        const resolvedPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        const target = String(args.target);
        const replacement = String(args.replacement);
        await this.journal.recordFileMutation("replace_file_content", resolvedPath);
        const res = await hands.replaceFileContent(resolvedPath, target, replacement);
        if (!res.success) {
          throw new Error(res.error || `Target block not found in '${targetPath}'`);
        }
        return { success: true, path: resolvedPath };
      },
    });

    this.registerTool({
      name: "multi_replace_file_content",
      description: "Apply multiple non-contiguous exact text replacements to a file atomically (Hands)",
      isMutating: true,
      parameters: {
        path: { type: "string", required: true, description: "Target file path" },
        chunks: {
          type: "array",
          required: true,
          description: "Array of { target, replacement } chunk objects",
          items: { type: "object" },
        },
      },
      execute: async (args, cwd) => {
        const targetPath = String(args.path);
        const resolvedPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        let rawChunks = args.chunks ?? args.replacementChunks;
        if (typeof rawChunks === "string") {
          try {
            rawChunks = JSON.parse(rawChunks);
          } catch {
            // fallback
          }
        }
        const chunks = Array.isArray(rawChunks) ? (rawChunks as Array<{ target: string; replacement: string }>) : [];
        if (chunks.length === 0) {
          throw new Error("No replacement chunks provided to multi_replace_file_content");
        }
        await this.journal.recordFileMutation("multi_replace_file_content", resolvedPath);
        const res = await hands.multiReplaceFileContent(resolvedPath, chunks);
        if (!res.success) {
          throw new Error(res.error || `Multi-replace failed on '${targetPath}'`);
        }
        return { success: true, path: resolvedPath, replacementsApplied: res.replacementsApplied };
      },
    });

    this.registerTool({
      name: "rollback_last_mutation",
      description: "Atomically rollback the most recent file mutation or all mutations in the current turn (Journal)",
      isMutating: true,
      parameters: {
        allInCurrentTurn: { type: "boolean", required: false, description: "If true, rolls back all file mutations in current turn" },
      },
      execute: async (args) => {
        if (args.allInCurrentTurn) {
          return this.journal.rollbackTurn();
        }
        return this.journal.rollbackLast();
      },
    });

    this.registerTool({
      name: "atomic_multi_file_patch",
      description: "Atomically apply text replacements across multiple files. Fails with zero disk mutations if any chunk mismatches (Hands)",
      isMutating: true,
      parameters: {
        files: {
          type: "array",
          required: true,
          description: "Array of file patch objects: { path: string, chunks: [{ target: string, replacement: string }] }",
          items: { type: "object" },
        },
        description: { type: "string", required: false, description: "Description of the atomic refactor" },
      },
      execute: async (args, cwd) => {
        let rawFiles = args.files;
        if (typeof rawFiles === "string") {
          try {
            rawFiles = JSON.parse(rawFiles);
          } catch {
            // ignore
          }
        }
        const files = Array.isArray(rawFiles)
          ? (rawFiles as Array<{ path: string; chunks: Array<{ target: string; replacement: string }> }>)
          : [];
        return this.atomicPatchOrchestrator.applyAtomicPatch(
          {
            files,
            description: typeof args.description === "string" ? args.description : undefined,
          },
          cwd
        );
      },
    });

    this.registerTool({
      name: "get_tool_telemetry",
      description: "Inspect performance metrics, latency percentiles (p50, p95), and error rates for tools (Telemetry)",
      parameters: {
        toolName: { type: "string", required: false, description: "Optional specific tool name to filter" },
      },
      execute: async (args) => {
        if (typeof args.toolName === "string" && args.toolName.trim()) {
          const metric = this.telemetryLedger.getToolMetric(args.toolName.trim());
          return metric || { message: `No telemetry recorded yet for '${args.toolName}'` };
        }
        return this.telemetryLedger.getAllMetrics();
      },
    });

    this.registerTool({
      name: "search_tools_catalog",
      description: "Search the full system catalog of available tools using BM25 semantic ranking and keyword filtering (Discovery)",
      parameters: {
        query: { type: "string", required: true, description: "Search query or task description" },
        limit: { type: "number", required: false, description: "Max tools to return (default: 10)" },
      },
      execute: async (args) => {
        const query = String(args.query || "");
        const limit = typeof args.limit === "number" ? args.limit : 10;
        const allTools = this.listTools();
        const results = this.dynamicRouter.searchTools(allTools, query);
        return results.slice(0, limit).map((t) => ({
          name: t.name,
          description: t.description,
          category: t.category,
          parameters: Object.keys(t.parameters || {}),
        }));
      },
    });

    this.registerTool({
      name: "explain_tool_parameters",
      description: "Retrieve comprehensive JSON schema definitions, types, descriptions, and examples for a specific tool (Discovery)",
      parameters: {
        toolName: { type: "string", required: true, description: "Target tool name to inspect" },
      },
      execute: async (args) => {
        const toolName = String(args.toolName || "").trim();
        const tool = this.getTool(toolName);
        if (!tool) {
          return { error: `Tool '${toolName}' not found in registry.` };
        }
        return {
          name: tool.name,
          description: tool.description,
          category: tool.category,
          isMutating: tool.isMutating ?? false,
          requiresConfirmation: tool.requiresConfirmation ?? false,
          parameters: tool.parameters || {},
          examples: tool.examples || [],
        };
      },
    });

    this.registerTool({
      name: "summarize_tool_output",
      description: "Intelligently summarize long tool outputs, preserving all compiler errors and stack traces while stripping noise (Summarizer)",
      parameters: {
        rawOutput: { type: "string", required: true, description: "Raw command or tool output to summarize" },
        maxOutputLines: { type: "number", required: false, description: "Max output lines to retain (default: 60)" },
      },
      execute: async (args) => {
        const raw = String(args.rawOutput || "");
        const maxLines = typeof args.maxOutputLines === "number" ? args.maxOutputLines : 60;
        return this.summarizer.summarizeOutput(raw, { maxOutputLines: maxLines });
      },
    });

    this.registerTool({
      name: "delete_file",
      description: "Safely delete a file or directory on disk (Hands)",
      isMutating: true,
      parameters: {
        path: { type: "string", required: true, description: "Path to file or directory to delete" },
      },
      execute: async (args, cwd) => {
        const targetPath = String(args.path);
        const resolvedPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        await this.journal.recordFileDeletion("delete_file", resolvedPath);
        const success = await hands.deleteFile(resolvedPath);
        return { success, path: resolvedPath };
      },
    });

    this.registerTool({
      name: "move_file",
      description: "Move or rename a file or directory across workspace (Hands)",
      isMutating: true,
      parameters: {
        source: { type: "string", required: true, description: "Source file path" },
        target: { type: "string", required: true, description: "Target destination path" },
      },
      execute: async (args, cwd) => {
        const sourcePath = String(args.source);
        const targetPath = String(args.target);
        const resolvedSource = sourcePath.startsWith("/") ? sourcePath : `${cwd}/${sourcePath}`;
        const resolvedTarget = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        const success = await hands.moveFile(resolvedSource, resolvedTarget);
        return { success, source: resolvedSource, target: resolvedTarget };
      },
    });

    this.registerTool({
      name: "create_directory",
      description: "Create a new directory and all parent directories (Hands)",
      isMutating: true,
      parameters: {
        path: { type: "string", required: true, description: "Directory path to create" },
      },
      execute: async (args, cwd) => {
        const targetPath = String(args.path);
        const resolvedPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        const success = await hands.createDirectory(resolvedPath);
        return { success, path: resolvedPath };
      },
    });

    this.registerTool({
      name: "copy_file",
      description: "Copy a file or directory recursively across workspace (Hands)",
      isMutating: true,
      parameters: {
        source: { type: "string", required: true, description: "Source path to copy" },
        target: { type: "string", required: true, description: "Destination target path" },
      },
      execute: async (args, cwd) => {
        const sourcePath = String(args.source);
        const targetPath = String(args.target);
        const resolvedSource = sourcePath.startsWith("/") ? sourcePath : `${cwd}/${sourcePath}`;
        const resolvedTarget = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        const success = await hands.copyFile(resolvedSource, resolvedTarget);
        return { success, source: resolvedSource, target: resolvedTarget };
      },
    });

    this.registerTool({
      name: "path_exists",
      description: "Quickly verify if a file or directory exists on disk (Eyes)",
      parameters: {
        path: { type: "string", required: true, description: "Path to check" },
      },
      execute: async (args, cwd) => {
        const targetPath = String(args.path);
        const resolvedPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        const exists = await this.eyes.exists(resolvedPath);
        return { exists, path: resolvedPath };
      },
    });

    this.registerTool({
      name: "append_file",
      description: "Append content to an existing file or create it if missing (Hands)",
      isMutating: true,
      parameters: {
        path: { type: "string", required: true, description: "Path to file to append to" },
        content: { type: "string", required: true, description: "Content string to append" },
      },
      execute: async (args, cwd) => {
        const targetPath = String(args.path);
        const content = String(args.content);
        const resolvedPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        const success = await hands.appendFile(resolvedPath, content);
        return { success, path: resolvedPath };
      },
    });

    this.registerTool({
      name: "clear_file",
      description: "Clear/truncate file content to 0 bytes on disk (Hands)",
      parameters: {
        path: { type: "string", required: true, description: "Path to file to truncate" },
      },
      execute: async (args, cwd) => {
        const targetPath = String(args.path);
        const resolvedPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        const success = await hands.clearFile(resolvedPath);
        return { success, path: resolvedPath };
      },
    });

    this.registerTool({
      name: "batch_delete_files",
      description: "Delete multiple files simultaneously in a single turn (Hands)",
      parameters: {
        paths: { type: "array", required: true, description: "Array of file paths to delete" },
      },
      execute: async (args, cwd) => {
        const rawPaths = Array.isArray(args.paths) ? args.paths : [String(args.paths)];
        const resolvedPaths = rawPaths.map((p) => (String(p).startsWith("/") ? String(p) : `${cwd}/${String(p)}`));
        return hands.deleteMultipleFiles(resolvedPaths);
      },
    });

    this.registerTool({
      name: "file_hash",
      description: "Compute cryptographic checksum (SHA-256 / MD5) of a file (Eyes)",
      parameters: {
        path: { type: "string", required: true, description: "Path to file" },
      },
      execute: async (args, cwd) => {
        const targetPath = String(args.path);
        const algorithm = typeof args.algorithm === "string" ? args.algorithm : "sha256";
        const resolvedPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        return this.eyes.getFileHash(resolvedPath, algorithm);
      },
    });

    this.registerTool({
      name: "get_env",
      description: "Read environment variables or a specific environment key (Hands)",
      execute: async (args) => {
        if (typeof args.key === "string" && args.key.trim() !== "") {
          const key = args.key.trim();
          return { key, value: process.env[key] ?? null };
        }
        return { env: { ...process.env } };
      },
    });

    this.registerTool({
      name: "set_env",
      description: "Set or update an environment variable in the current runtime process (Hands)",
      parameters: {
        key: { type: "string", required: true, description: "Environment variable key" },
        value: { type: "string", required: true, description: "Environment variable value" },
      },
      execute: async (args) => {
        const key = String(args.key).trim();
        const value = String(args.value);
        process.env[key] = value;
        return { key, value, success: true };
      },
    });

    this.registerTool({
      name: "system_info",
      description: "Inspect host system architecture, platform, memory, and Node.js runtime (Eyes)",
      execute: async () => {
        return {
          platform: os.platform(),
          arch: os.arch(),
          release: os.release(),
          cpus: os.cpus().length,
          totalMemoryBytes: os.totalmem(),
          freeMemoryBytes: os.freemem(),
          uptimeSeconds: Math.floor(os.uptime()),
          nodeVersion: process.version,
          pid: process.pid,
        };
      },
    });

    this.registerTool({
      name: "http_request",
      description: "Perform an HTTP/HTTPS request (GET, POST, PUT, DELETE) with custom headers & body (Hands)",
      parameters: {
        url: { type: "string", required: true, description: "Target URL" },
      },
      execute: async (args) => {
        const url = String(args.url);
        const method = typeof args.method === "string" ? args.method.toUpperCase() : "GET";
        const headers = typeof args.headers === "object" && args.headers !== null ? (args.headers as Record<string, string>) : {};
        const body = args.body !== undefined
          ? (typeof args.body === "string" ? args.body : JSON.stringify(args.body))
          : undefined;
        const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : 15000;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const res = await fetch(url, {
            method,
            headers,
            body: method !== "GET" && method !== "HEAD" ? body : undefined,
            signal: controller.signal,
          });
          const text = await res.text();
          const responseHeaders: Record<string, string> = {};
          res.headers.forEach((val, key) => {
            responseHeaders[key] = val;
          });

          let json: unknown = undefined;
          try {
            json = JSON.parse(text);
          } catch {
            // not json
          }

          return {
            status: res.status,
            statusText: res.statusText,
            ok: res.ok,
            headers: responseHeaders,
            body: text,
            json,
          };
        } catch (err: any) {
          return {
            error: err.name === "AbortError" ? `Request timed out after ${timeoutMs}ms` : err.message,
            ok: false,
            status: 0,
          };
        } finally {
          clearTimeout(timer);
        }
      },
    });

    this.registerTool({
      name: "batch_write_files",
      description: "Write multiple workspace files atomically in a single turn (Hands)",
      parameters: {
        files: { type: "array", required: true, description: "Array of { path: string, content: string } objects" },
      },
      execute: async (args, cwd) => {
        let rawFiles: { path: string; content: string }[] = [];
        if (Array.isArray(args.files)) {
          rawFiles = args.files as any[];
        } else if (typeof args.files === "string") {
          try {
            rawFiles = JSON.parse(args.files);
          } catch {
            rawFiles = [];
          }
        }
        const resolvedFiles = rawFiles.map((f) => ({
          path: String(f.path).startsWith("/") ? String(f.path) : `${cwd}/${String(f.path)}`,
          content: String(f.content ?? ""),
        }));
        return hands.writeMultipleFiles(resolvedFiles);
      },
    });

    this.registerTool({
      name: "workspace_summary",
      description: "Generate aggregate statistics (file counts, extensions, directory counts, size) of workspace (Eyes)",
      execute: async (args, cwd) => {
        const rootPath = typeof args.path === "string"
          ? (args.path.startsWith("/") ? args.path : `${cwd}/${args.path}`)
          : cwd;

        const extCounts: Record<string, number> = {};
        let totalFiles = 0;
        let totalDirectories = 0;
        let totalSizeBytes = 0;

        const scan = async (dir: string, depth: number) => {
          if (depth > 6) return;
          let entries: any[] = [];
          try {
            entries = await fs.readdir(dir, { withFileTypes: true });
          } catch {
            return;
          }

          for (const entry of entries) {
            if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name.startsWith(".")) {
              continue;
            }
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              totalDirectories++;
              await scan(fullPath, depth + 1);
            } else if (entry.isFile()) {
              totalFiles++;
              const ext = path.extname(entry.name).toLowerCase() || "[no_ext]";
              extCounts[ext] = (extCounts[ext] || 0) + 1;
              try {
                const stat = await fs.stat(fullPath);
                totalSizeBytes += stat.size;
              } catch {
                // ignore
              }
            }
          }
        };

        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        await scan(rootPath, 0);

        return {
          rootPath,
          totalFiles,
          totalDirectories,
          totalSizeBytes,
          extensions: extCounts,
        };
      },
    });

    this.registerTool({
      name: "check_port",
      description: "Check if a TCP port is in use or available on localhost (Eyes)",
      parameters: {
        port: { type: "number", required: true, description: "Port number to check" },
      },
      execute: async (args) => {
        const port = Number(args.port);
        const net = await import("node:net");
        return new Promise((resolve) => {
          const server = net.createServer();
          server.once("error", (err: any) => {
            if (err.code === "EADDRINUSE") {
              resolve({ port, inUse: true, available: false });
            } else {
              resolve({ port, inUse: false, available: false, error: err.message });
            }
          });
          server.once("listening", () => {
            server.close(() => {
              resolve({ port, inUse: false, available: true });
            });
          });
          server.listen(port, "127.0.0.1");
        });
      },
    });

    this.registerTool({
      name: "find_free_port",
      description: "Find an open, available TCP port on localhost for starting servers (Hands)",
      execute: async () => {
        const net = await import("node:net");
        return new Promise((resolve, reject) => {
          const server = net.createServer();
          server.unref();
          server.on("error", reject);
          server.listen(0, "127.0.0.1", () => {
            const port = (server.address() as any).port;
            server.close(() => {
              resolve({ port, available: true });
            });
          });
        });
      },
    });

    this.registerTool({
      name: "memory_usage",
      description: "Inspect active Node.js V8 heap and RSS memory usage (Eyes)",
      execute: async () => {
        const mem = process.memoryUsage();
        return {
          rssBytes: mem.rss,
          heapTotalBytes: mem.heapTotal,
          heapUsedBytes: mem.heapUsed,
          externalBytes: mem.external,
          arrayBuffersBytes: mem.arrayBuffers,
          heapUsedMB: +(mem.heapUsed / (1024 * 1024)).toFixed(2),
          rssMB: +(mem.rss / (1024 * 1024)).toFixed(2),
        };
      },
    });

    this.registerTool({
      name: "download_file",
      description: "Download a remote file or binary asset directly to workspace disk (Hands)",
      parameters: {
        url: { type: "string", required: true, description: "Source URL to download" },
        path: { type: "string", required: true, description: "Destination file path on disk" },
      },
      execute: async (args, cwd) => {
        const url = String(args.url);
        const targetPath = String(args.path);
        const resolvedPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : 30000;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) {
            return { success: false, status: res.status, error: `HTTP ${res.status}: ${res.statusText}` };
          }
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const fs = await import("node:fs/promises");
          const path = await import("node:path");
          await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
          await fs.writeFile(resolvedPath, buffer);

          return {
            success: true,
            path: resolvedPath,
            sizeBytes: buffer.length,
            contentType: res.headers.get("content-type"),
          };
        } catch (err: any) {
          return {
            success: false,
            error: err.name === "AbortError" ? `Download timed out after ${timeoutMs}ms` : err.message,
          };
        } finally {
          clearTimeout(timer);
        }
      },
    });

    this.registerTool({
      name: "touch_file",
      description: "Create an empty file or update access/modification timestamps without altering content (Hands)",
      parameters: {
        path: { type: "string", required: true, description: "File path to touch" },
      },
      execute: async (args, cwd) => {
        const targetPath = String(args.path);
        const resolvedPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        const fs = await import("node:fs/promises");
        const path = await import("node:path");

        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        const now = new Date();
        try {
          await fs.utimes(resolvedPath, now, now);
        } catch {
          await fs.writeFile(resolvedPath, "", { flag: "a" });
        }
        return { success: true, path: resolvedPath };
      },
    });

    this.registerTool({
      name: "disk_usage",
      description: "Calculate disk space consumption for a directory or file tree (Eyes)",
      parameters: {
        path: { type: "string", required: true, description: "Directory or file path to inspect" },
      },
      execute: async (args, cwd) => {
        const targetPath = String(args.path);
        const resolvedPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        const fs = await import("node:fs/promises");
        const path = await import("node:path");

        let totalBytes = 0;
        let totalFiles = 0;
        let totalDirectories = 0;

        async function calc(current: string) {
          try {
            const stat = await fs.stat(current);
            if (stat.isFile()) {
              totalBytes += stat.size;
              totalFiles++;
            } else if (stat.isDirectory()) {
              totalDirectories++;
              const entries = await fs.readdir(current);
              for (const entry of entries) {
                if (entry === "node_modules" || entry === ".git") continue;
                await calc(path.join(current, entry));
              }
            }
          } catch {
            // Ignore unreadable paths
          }
        }

        await calc(resolvedPath);

        const formatBytes = (bytes: number) => {
          if (bytes < 1024) return `${bytes} B`;
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
          return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        };

        return {
          path: resolvedPath,
          totalBytes,
          formattedSize: formatBytes(totalBytes),
          totalFiles,
          totalDirectories,
        };
      },
    });

    this.registerTool({
      name: "search_and_replace",
      description: "Search and replace string occurrences across multiple files matching a glob or directory (Hands)",
      parameters: {
        path: { type: "string", required: true, description: "Root directory path to search within" },
        find: { type: "string", required: true, description: "Exact string or pattern to find" },
        replace: { type: "string", required: true, description: "Replacement string" },
      },
      execute: async (args, cwd) => {
        const targetPath = String(args.path);
        const resolvedPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        const findStr = String(args.find ?? args.target ?? "");
        const replaceStr = String(args.replace ?? args.replacement ?? "");

        const fs = await import("node:fs/promises");
        const path = await import("node:path");

        const modifiedFiles: { path: string; replacements: number }[] = [];

        async function scanAndReplace(current: string) {
          try {
            const stat = await fs.stat(current);
            if (stat.isFile()) {
              const content = await fs.readFile(current, "utf-8");
              if (content.includes(findStr)) {
                const count = content.split(findStr).length - 1;
                const newContent = content.replaceAll(findStr, replaceStr);
                await fs.writeFile(current, newContent, "utf-8");
                modifiedFiles.push({ path: current, replacements: count });
              }
            } else if (stat.isDirectory()) {
              const entries = await fs.readdir(current);
              for (const entry of entries) {
                if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
                await scanAndReplace(path.join(current, entry));
              }
            }
          } catch {
            // Ignore unreadable entries
          }
        }

        await scanAndReplace(resolvedPath);

        return {
          success: true,
          totalFilesModified: modifiedFiles.length,
          totalReplacements: modifiedFiles.reduce((acc, f) => acc + f.replacements, 0),
          modifiedFiles,
        };
      },
    });

    this.registerTool({
      name: "chmod_file",
      description: "Change file mode / permissions or mark file as executable (Hands)",
      parameters: {
        path: { type: "string", required: true, description: "Path to file" },
        mode: { type: "string", required: false, description: "Octal permissions mode (e.g. '755' or '644') or 'executable'" },
      },
      execute: async (args, cwd) => {
        const targetPath = String(args.path);
        const resolvedPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        const modeStr = String(args.mode ?? "755");
        const fs = await import("node:fs/promises");

        const numericMode = modeStr === "executable" || modeStr === "+x" ? 0o755 : parseInt(modeStr, 8) || 0o755;
        try {
          await fs.chmod(resolvedPath, numericMode);
          return { success: true, path: resolvedPath, mode: numericMode.toString(8) };
        } catch (err: any) {
          return { success: false, path: resolvedPath, error: err.message };
        }
      },
    });

    this.registerTool({
      name: "create_temp_dir",
      description: "Create an isolated temporary scratchpad directory in the OS temp space (Hands)",
      parameters: {
        prefix: { type: "string", required: false, description: "Prefix for temp dir name" },
      },
      execute: async (args) => {
        const os = await import("node:os");
        const fs = await import("node:fs/promises");
        const path = await import("node:path");

        const prefix = String(args.prefix ?? "lumi-scratch-");
        const tempDirPath = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
        return {
          success: true,
          path: tempDirPath,
        };
      },
    });

    this.registerTool({
      name: "kill_port",
      description: "Terminate any process listening on a specified TCP port to free it up (Hands)",
      parameters: {
        port: { type: "number", required: true, description: "Port number to liberate" },
      },
      execute: async (args) => {
        const port = Number(args.port);
        const { exec } = await import("node:child_process");
        const util = await import("node:util");
        const execAsync = util.promisify(exec);

        const isWin = process.platform === "win32";
        try {
          if (isWin) {
            const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
            const lines = stdout.trim().split("\n");
            const pids = new Set<string>();
            for (const line of lines) {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 5) {
                pids.add(parts[parts.length - 1]);
              }
            }
            for (const pid of pids) {
              if (pid && pid !== "0") {
                await execAsync(`taskkill /F /PID ${pid}`);
              }
            }
            return { success: true, port, freed: true, killedPids: Array.from(pids) };
          } else {
            const { stdout } = await execAsync(`lsof -ti :${port}`);
            const pids = stdout.trim().split("\n").map((p) => p.trim()).filter(Boolean);
            for (const pid of pids) {
              try {
                process.kill(Number(pid), "SIGKILL");
              } catch {
                // Ignore if process already exited
              }
            }
            return { success: true, port, freed: true, killedPids: pids };
          }
        } catch {
          // If no process was on that port, lsof/netstat exits with code 1, which means port is already free
          return { success: true, port, freed: true, message: `No active process found blocking port ${port}` };
        }
      },
    });

    this.registerTool({
      name: "kill_process",
      description: "Send termination signal (SIGTERM or SIGKILL) to a process by PID (Hands)",
      parameters: {
        pid: { type: "number", required: true, description: "Process ID to terminate" },
        signal: { type: "string", required: false, description: "Signal to send (e.g. 'SIGTERM' or 'SIGKILL', default: 'SIGTERM')" },
      },
      execute: async (args) => {
        const pid = Number(args.pid);
        const signal = (args.signal as NodeJS.Signals) || "SIGTERM";
        try {
          process.kill(pid, signal);
          return { success: true, pid, signal };
        } catch (err: any) {
          return { success: false, pid, error: err.message };
        }
      },
    });

    this.registerTool({
      name: "edit_file_anchored",
      description: "Apply hash-anchored line edit to a file (Hands - hashline)",
      parameters: {
        path: { type: "string", required: true },
        line: { type: "number", required: true },
        hash: { type: "string", required: true },
        replacement: { type: "string", required: true },
      },
      execute: async (args, cwd) => {
        const targetPath = String(args.path);
        const resolvedPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        const line = Number(args.line);
        const hash = String(args.hash);
        const replacement = String(args.replacement);
        return hands.applyAnchoredEdit(resolvedPath, line, hash, replacement);
      },
    });

    this.registerTool({
      name: "run_command",
      description: "Execute a shell command with direct I/O execution authority (Hands)",
      parameters: {
        command: { type: "string", required: true, description: "Shell command string" },
      },
      execute: async (args, cwd) => {
        const command = String(args.command);
        const effectiveCwd = typeof args.cwd === "string" ? args.cwd : cwd;
        return hands.runCommand(command, effectiveCwd);
      },
    });

    this.registerTool({
      name: "list_dir",
      description: "List directory contents with file metadata (isDir, sizeBytes) (Eyes)",
      parameters: {
        path: { type: "string", required: true, description: "Directory path to list" },
      },
      execute: async (args, cwd) => {
        const targetPath = String(args.path);
        const resolvedPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        return this.eyes.listDirectoryDetails(resolvedPath);
      },
    });

    this.registerTool({
      name: "grep_search",
      description: "Fast ripgrep / pattern search across workspace files or specific file (Eyes)",
      parameters: {
        query: { type: "string", required: false, description: "Search query or regex pattern (or provide queries array)" },
        path: { type: "string", required: false, description: "Directory or file path to search" },
        maxResults: { type: "number", required: false, description: "Maximum number of matches to return" },
        includes: { type: "array", required: false, description: "File patterns to include (e.g. ['*.ts'])" },
        excludes: { type: "array", required: false, description: "File or directory patterns to exclude" },
        caseInsensitive: { type: "boolean", required: false, description: "Perform case-insensitive search (default true)" },
        smartCase: { type: "boolean", required: false, description: "Auto-detect case sensitivity if query contains uppercase characters" },
        isRegex: { type: "boolean", required: false, description: "Whether to treat query as a regex pattern (default: auto-detected, false for literal search)" },
        wordMatch: { type: "boolean", required: false, description: "Match whole words only" },
        multiline: { type: "boolean", required: false, description: "Enable multiline query matching" },
        fuzzy: { type: "boolean", required: false, description: "Enable subsequence fuzzy pattern matching" },
        pathRegex: { type: "string", required: false, description: "Regex pattern to filter matching file paths" },
        previewReplacement: { type: "string", required: false, description: "Preview replacement on matched lines (diff preview without modifying files)" },
        minMatchesPerFile: { type: "number", required: false, description: "Only return files having at least N matches" },
        maxMatchesPerFile: { type: "number", required: false, description: "Cap matches returned per file (prevents huge files from monopolizing results)" },
        ignoreComments: { type: "boolean", required: false, description: "Ignore comment lines (//, #, --, /*, *) to eliminate false positives" },
        uniqueLines: { type: "boolean", required: false, description: "Deduplicate identical matched lines within each file" },
        requireAllQueriesInFile: { type: "boolean", required: false, description: "Require file to contain ALL specified queries (AND matching)" },
        contextLines: { type: "number", required: false, description: "Number of before/after context lines to return" },
        contextBefore: { type: "number", required: false, description: "Number of before context lines" },
        contextAfter: { type: "number", required: false, description: "Number of after context lines" },
        minFileSize: { type: "number", required: false, description: "Minimum file size in bytes" },
        maxFileSize: { type: "number", required: false, description: "Maximum file size in bytes to inspect (default: 4MB)" },
        maxLineLength: { type: "number", required: false, description: "Maximum length of returned line snippet (default: 500)" },
        maxDepth: { type: "number", required: false, description: "Maximum directory depth to traverse" },
        mtimeAfter: { type: "number", required: false, description: "Only include files modified after this epoch timestamp (ms)" },
        mtimeBefore: { type: "number", required: false, description: "Only include files modified before this epoch timestamp (ms)" },
        preserveWhitespace: { type: "boolean", required: false, description: "Preserve original line indentation and whitespace (default: false)" },
        invertMatch: { type: "boolean", required: false, description: "Invert match to select non-matching lines (like grep -v)" },
        startLine: { type: "number", required: false, description: "1-indexed starting line to scope search" },
        endLine: { type: "number", required: false, description: "1-indexed ending line to scope search" },
        offset: { type: "number", required: false, description: "Number of matches to skip (pagination offset)" },
        sortBy: { type: "string", required: false, description: "Sort matches by 'path', 'matches', or 'line'" },
        sortOrder: { type: "string", required: false, description: "Sort direction 'asc' or 'desc'" },
        filesOnly: { type: "boolean", required: false, description: "Only return unique matching filenames and counts without line snippets" },
        groupByFile: { type: "boolean", required: false, description: "Group matches by file path in results" },
        highlight: { type: "boolean", required: false, description: "Highlight matched token within returned lineContent" },
        queries: { type: "array", required: false, description: "Multiple search queries / OR patterns" },
        detailed: { type: "boolean", required: false, description: "Return full search statistics (filesScanned, filesMatched, durationMs, truncated)" },
      },
      execute: async (args, cwd) => {
        const query = Array.isArray(args.query) ? args.query.map(String) : String(args.query ?? "");
        const searchPath = typeof args.path === "string"
          ? (args.path.startsWith("/") ? args.path : `${cwd}/${args.path}`)
          : cwd;
        const maxResults = typeof args.maxResults === "number" ? args.maxResults : undefined;
        const offset = typeof args.offset === "number" ? args.offset : undefined;
        let includes: string[] | undefined;
        if (Array.isArray(args.includes)) {
          includes = args.includes.map(String);
        } else if (typeof args.includes === "string") {
          try { includes = JSON.parse(args.includes); } catch { includes = [args.includes]; }
        }

        let excludes: string[] | undefined;
        if (Array.isArray(args.excludes)) {
          excludes = args.excludes.map(String);
        } else if (typeof args.excludes === "string") {
          try { excludes = JSON.parse(args.excludes); } catch { excludes = [args.excludes]; }
        }

        let queries: string[] | undefined;
        if (Array.isArray(args.queries)) {
          queries = args.queries.map(String);
        } else if (typeof args.queries === "string") {
          try { queries = JSON.parse(args.queries); } catch { queries = [args.queries]; }
        }

        const pathRegex = typeof args.pathRegex === "string" ? args.pathRegex : undefined;
        const caseInsensitive = typeof args.caseInsensitive === "boolean" ? args.caseInsensitive : undefined;
        const smartCase = typeof args.smartCase === "boolean" ? args.smartCase : undefined;
        const isRegex = typeof args.isRegex === "boolean" ? args.isRegex : undefined;
        const wordMatch = typeof args.wordMatch === "boolean" ? args.wordMatch : undefined;
        const multiline = typeof args.multiline === "boolean" ? args.multiline : undefined;
        const fuzzy = typeof args.fuzzy === "boolean" ? args.fuzzy : undefined;
        const previewReplacement = typeof args.previewReplacement === "string" ? args.previewReplacement : undefined;
        const minMatchesPerFile = typeof args.minMatchesPerFile === "number" ? args.minMatchesPerFile : undefined;
        const maxMatchesPerFile = typeof args.maxMatchesPerFile === "number" ? args.maxMatchesPerFile : undefined;
        const ignoreComments = typeof args.ignoreComments === "boolean" ? args.ignoreComments : undefined;
        const uniqueLines = typeof args.uniqueLines === "boolean" ? args.uniqueLines : undefined;
        const requireAllQueriesInFile = typeof args.requireAllQueriesInFile === "boolean" ? args.requireAllQueriesInFile : undefined;
        const contextLines = typeof args.contextLines === "number" ? args.contextLines : undefined;
        const contextBefore = typeof args.contextBefore === "number" ? args.contextBefore : undefined;
        const contextAfter = typeof args.contextAfter === "number" ? args.contextAfter : undefined;
        const minFileSize = typeof args.minFileSize === "number" ? args.minFileSize : undefined;
        const maxFileSize = typeof args.maxFileSize === "number" ? args.maxFileSize : undefined;
        const maxLineLength = typeof args.maxLineLength === "number" ? args.maxLineLength : undefined;
        const maxDepth = typeof args.maxDepth === "number" ? args.maxDepth : undefined;
        const mtimeAfter = typeof args.mtimeAfter === "number" ? args.mtimeAfter : undefined;
        const mtimeBefore = typeof args.mtimeBefore === "number" ? args.mtimeBefore : undefined;
        const preserveWhitespace = typeof args.preserveWhitespace === "boolean" ? args.preserveWhitespace : undefined;
        const invertMatch = typeof args.invertMatch === "boolean" ? args.invertMatch : undefined;
        const startLine = typeof args.startLine === "number" ? args.startLine : undefined;
        const endLine = typeof args.endLine === "number" ? args.endLine : undefined;
        const sortBy = args.sortBy === "path" || args.sortBy === "matches" || args.sortBy === "line" ? args.sortBy : undefined;
        const sortOrder = args.sortOrder === "asc" || args.sortOrder === "desc" ? args.sortOrder : undefined;
        const filesOnly = typeof args.filesOnly === "boolean" ? args.filesOnly : undefined;
        const groupByFile = typeof args.groupByFile === "boolean" ? args.groupByFile : undefined;
        const highlight = typeof args.highlight === "boolean" ? args.highlight : undefined;
        const detailed = typeof args.detailed === "boolean" ? args.detailed : false;

        const { RipgrepSearchService } = await import("../perception/ripgrep-search-service.js");
        const service = new RipgrepSearchService();
        if (detailed) {
          return service.searchDetailed(query, searchPath, {
            maxResults,
            offset,
            includes,
            excludes,
            pathRegex,
            queries,
            caseInsensitive,
            smartCase,
            isRegex,
            wordMatch,
            multiline,
            fuzzy,
            previewReplacement,
            minMatchesPerFile,
            maxMatchesPerFile,
            ignoreComments,
            uniqueLines,
            requireAllQueriesInFile,
            contextLines,
            contextBefore,
            contextAfter,
            minFileSize,
            maxFileSize,
            maxLineLength,
            maxDepth,
            mtimeAfter,
            mtimeBefore,
            preserveWhitespace,
            invertMatch,
            startLine,
            endLine,
            sortBy,
            sortOrder,
            filesOnly,
            groupByFile,
            highlight,
          });
        }
        return service.search(query, searchPath, {
          maxResults,
          offset,
          includes,
          excludes,
          pathRegex,
          queries,
          caseInsensitive,
          smartCase,
          isRegex,
          wordMatch,
          multiline,
          fuzzy,
          previewReplacement,
          minMatchesPerFile,
          maxMatchesPerFile,
          ignoreComments,
          uniqueLines,
          requireAllQueriesInFile,
          contextLines,
          contextBefore,
          contextAfter,
          minFileSize,
          maxFileSize,
          maxLineLength,
          maxDepth,
          mtimeAfter,
          mtimeBefore,
          preserveWhitespace,
          invertMatch,
          startLine,
          endLine,
          sortBy,
          sortOrder,
          filesOnly,
          groupByFile,
          highlight,
        });
      },
    });

    this.registerTool({
      name: "batch_view_files",
      description: "Read multiple workspace files simultaneously in a single turn (Eyes)",
      execute: async (args, cwd) => {
        let paths: string[] = [];
        if (Array.isArray(args.paths)) {
          paths = args.paths.map(String);
        } else if (typeof args.paths === "string") {
          try {
            paths = JSON.parse(args.paths);
          } catch {
            paths = [args.paths];
          }
        }
        const resolvedPaths = paths.map((p) => (p.startsWith("/") ? p : `${cwd}/${p}`));
        const maxLines = typeof args.maxLines === "number" ? args.maxLines : undefined;
        return this.eyes.readMultipleFiles(resolvedPaths, { maxLines });
      },
    });

    this.registerTool({
      name: "find_files",
      description: "Find files matching name pattern / glob across workspace (Eyes)",
      execute: async (args, cwd) => {
        const searchPath = typeof args.path === "string"
          ? (args.path.startsWith("/") ? args.path : `${cwd}/${args.path}`)
          : cwd;
        const pattern = typeof args.pattern === "string" ? args.pattern : (typeof args.query === "string" ? args.query : undefined);
        const maxDepth = typeof args.maxDepth === "number" ? args.maxDepth : 5;
        return this.eyes.findFiles(searchPath, pattern, maxDepth);
      },
    });

    this.registerTool({
      name: "file_info",
      description: "Get metadata for a file or directory (exists, isDir, sizeBytes, line count) (Eyes)",
      execute: async (args, cwd) => {
        const targetPath = String(args.path);
        const resolvedPath = targetPath.startsWith("/") ? targetPath : `${cwd}/${targetPath}`;
        return this.eyes.getFileInfo(resolvedPath);
      },
    });

    this.registerTool({
      name: "directory_tree",
      description: "Generate structured ASCII directory tree of workspace folder (Eyes)",
      execute: async (args, cwd) => {
        const searchPath = typeof args.path === "string"
          ? (args.path.startsWith("/") ? args.path : `${cwd}/${args.path}`)
          : cwd;
        const maxDepth = typeof args.maxDepth === "number" ? args.maxDepth : 3;
        return this.eyes.getDirectoryTree(searchPath, maxDepth);
      },
    });

    this.registerTool({
      name: "list_skills",
      description: "Discover available workspace skill manifests (SkillsIngestor)",
      execute: async (_args, cwd) => {
        return this.skillsIngestor.discoverSkills(cwd);
      },
    });

    this.registerTool({
      name: "search_memory",
      description: "Search long-term agent memories & Knowledge Items (SessionMemoryStore)",
      parameters: {
        query: { type: "string", required: true },
      },
      execute: async (args) => {
        if (!this.memoryStore) return [];
        const query = String(args.query ?? "");
        return this.memoryStore.searchMemories(query);
      },
    });

    this.registerTool({
      name: "save_memory",
      description: "Save a persistent fact or Knowledge Item (SessionMemoryStore)",
      parameters: {
        key: { type: "string", required: true },
        value: { type: "string", required: true },
      },
      execute: async (args) => {
        if (!this.memoryStore) return { success: false, reason: "No memory store configured" };
        const key = String(args.key);
        const value = String(args.value);
        const category = (args.category as "fact" | "rule" | "troubleshooting" | "ki") ?? "fact";
        const entry = this.memoryStore.saveMemory(key, value, category);
        return { success: true, entry };
      },
    });

    this.registerTool({
      name: "search_symbols",
      description: "Search AST code symbols (classes, functions, interfaces, types) in workspace (Eyes)",
      parameters: {
        query: { type: "string", required: true, description: "Symbol name or substring to match" },
      },
      execute: async (args, cwd) => {
        const query = String(args.query);
        const searchPath = typeof args.path === "string" ? args.path : cwd;
        const astEyes = this.eyes as AstPerceptionEyes;
        return astEyes.searchSymbols ? astEyes.searchSymbols(searchPath, query) : [];
      },
    });

    this.registerTool({
      name: "audit_symbols",
      description: "Audit workspace orphan zombie symbols and module coupling metrics (ModuleDecomposer)",
      execute: async (_args, cwd) => {
        return this.moduleDecomposer.auditZombieSymbols(cwd, this.eyes);
      },
    });

    this.registerTool({
      name: "audit_integrity",
      description: "Audit workspace environmental leases, write access, and forensic healing (StabilityDoctor)",
      execute: async (_args, cwd) => {
        return this.stabilityDoctor.auditEnvironment(cwd, this.eyes);
      },
    });

    if (this.skillTreeToolSuite) {
      for (const tool of this.skillTreeToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.soulToolSuite) {
      for (const tool of this.soulToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.swarmToolSuite) {
      for (const tool of this.swarmToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.cronToolSuite) {
      for (const tool of this.cronToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.cdpToolSuite) {
      for (const tool of this.cdpToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.credentialToolSuite) {
      for (const tool of this.credentialToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.gatewayToolSuite) {
      for (const tool of this.gatewayToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.compressionToolSuite) {
      for (const tool of this.compressionToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.searchToolSuite) {
      for (const tool of this.searchToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.environmentToolSuite) {
      for (const tool of this.environmentToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.faultDiagnosticToolSuite) {
      for (const tool of this.faultDiagnosticToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.acpToolSuite) {
      for (const tool of this.acpToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.mcpClientToolSuite) {
      for (const tool of this.mcpClientToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.processToolSuite) {
      for (const tool of this.processToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.arbiterToolSuite) {
      for (const tool of this.arbiterToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.learningCuratorToolSuite) {
      for (const tool of this.learningCuratorToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.fileMutationToolSuite) {
      for (const tool of this.fileMutationToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.lspCodeIntelligenceToolSuite) {
      for (const tool of this.lspCodeIntelligenceToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.voiceSpeechToolSuite) {
      for (const tool of this.voiceSpeechToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.multimodalVisionToolSuite) {
      for (const tool of this.multimodalVisionToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.kanbanOrchestrationToolSuite) {
      for (const tool of this.kanbanOrchestrationToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.webIntelligenceToolSuite) {
      for (const tool of this.webIntelligenceToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.codeExecutionToolSuite) {
      for (const tool of this.codeExecutionToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.batchEvaluationToolSuite) {
      for (const tool of this.batchEvaluationToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.clarifyInquiryToolSuite) {
      for (const tool of this.clarifyInquiryToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.threatFirewallToolSuite) {
      for (const tool of this.threatFirewallToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.checkpointKernelToolSuite) {
      for (const tool of this.checkpointKernelToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.computerUseToolSuite) {
      for (const tool of this.computerUseToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.skillsHubToolSuite) {
      for (const tool of this.skillsHubToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.costGovernanceToolSuite) {
      for (const tool of this.costGovernanceToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.toolDisclosureToolSuite) {
      for (const tool of this.toolDisclosureToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.verificationEvidenceToolSuite) {
      for (const tool of this.verificationEvidenceToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.promptCacheToolSuite) {
      for (const tool of this.promptCacheToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.toolExecutionGuardToolSuite) {
      for (const tool of this.toolExecutionGuardToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.secretRedactionToolSuite) {
      for (const tool of this.secretRedactionToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.backgroundReviewToolSuite) {
      for (const tool of this.backgroundReviewToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.diagnosticDoctorToolSuite) {
      for (const tool of this.diagnosticDoctorToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.identityFederationToolSuite) {
      for (const tool of this.identityFederationToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.sessionArchiveToolSuite) {
      for (const tool of this.sessionArchiveToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.terminalSkinToolSuite) {
      for (const tool of this.terminalSkinToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.auxiliaryRouterToolSuite) {
      for (const tool of this.auxiliaryRouterToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.reasoningToolSuite) {
      for (const tool of this.reasoningToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.fuzzyMatcherToolSuite) {
      for (const tool of this.fuzzyMatcherToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.titleInsightsToolSuite) {
      for (const tool of this.titleInsightsToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.heredocTerminalToolSuite) {
      for (const tool of this.heredocTerminalToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.stealthBrowserToolSuite) {
      for (const tool of this.stealthBrowserToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.skillsSyncToolSuite) {
      for (const tool of this.skillsSyncToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.preflightToolSuite) {
      for (const tool of this.preflightToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.audioContainerToolSuite) {
      for (const tool of this.audioContainerToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.speechNormalizerToolSuite) {
      for (const tool of this.speechNormalizerToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.docExtractorToolSuite) {
      for (const tool of this.docExtractorToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.spillVaultToolSuite) {
      for (const tool of this.spillVaultToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.urlSafetyToolSuite) {
      for (const tool of this.urlSafetyToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.v4aPatchToolSuite) {
      for (const tool of this.v4aPatchToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.websitePolicyToolSuite) {
      for (const tool of this.websitePolicyToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.wakeWordToolSuite) {
      for (const tool of this.wakeWordToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.mediaSourceToolSuite) {
      for (const tool of this.mediaSourceToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.worktreeToolSuite) {
      for (const tool of this.worktreeToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.transcriptionToolSuite) {
      for (const tool of this.transcriptionToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.deadlineToolSuite) {
      for (const tool of this.deadlineToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.fileSafetyToolSuite) {
      for (const tool of this.fileSafetyToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.contextBreakdownToolSuite) {
      for (const tool of this.contextBreakdownToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.osvScannerToolSuite) {
      for (const tool of this.osvScannerToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.subdirHintsToolSuite) {
      for (const tool of this.subdirHintsToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.streamDiagToolSuite) {
      for (const tool of this.streamDiagToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.turnRetryToolSuite) {
      for (const tool of this.turnRetryToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.billingUsageToolSuite) {
      for (const tool of this.billingUsageToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.threadContextToolSuite) {
      for (const tool of this.threadContextToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.envProbeToolSuite) {
      for (const tool of this.envProbeToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.skillLinterToolSuite) {
      for (const tool of this.skillLinterToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.terminalCleanerToolSuite) {
      for (const tool of this.terminalCleanerToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.streamingScrubberToolSuite) {
      for (const tool of this.streamingScrubberToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.selfRepoGuardToolSuite) {
      for (const tool of this.selfRepoGuardToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.schemaSanitizerToolSuite) {
      for (const tool of this.schemaSanitizerToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.nousPortalToolSuite) {
      for (const tool of this.nousPortalToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.goalToolSuite) {
      for (const tool of this.goalToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.profileToolSuite) {
      for (const tool of this.profileToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.databaseToolSuite) {
      for (const tool of this.databaseToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.walletToolSuite) {
      for (const tool of this.walletToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.emailToolSuite) {
      for (const tool of this.emailToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.otlpToolSuite) {
      for (const tool of this.otlpToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.daemonToolSuite) {
      for (const tool of this.daemonToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
    if (this.runbookToolSuite) {
      for (const tool of this.runbookToolSuite.getTools()) {
        this.registerTool(tool);
      }
    }
  }
}

export { ValidatingToolRegistry as ToolRegistry };
