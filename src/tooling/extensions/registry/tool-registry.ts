import { AbstractToolRegistry } from "../../../core/abstracts/abstract-tool-registry.js";
import type { SchemaValidationResult } from "../../../core/contracts/tooling.contracts.js";
import type { Eyes } from "../../base/eyes.js";
import type { AstPerceptionEyes } from "../perception/ast-eyes.js";
import type { AnchoredHands } from "../hashline/hands.js";
import type { ProtocolEars } from "../telemetry/ears.js";
import { SkillsIngestor } from "./skills-ingestor.js";
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
  readonly memoryStore?: SessionMemoryStore;
  readonly moduleDecomposer: ModuleDecomposer;
  readonly stabilityDoctor: StabilityDoctor;
  readonly circuitBreaker: BroccoliCircuitBreaker;
  readonly streamingExecutor: BroccoliStreamingToolExecutor;

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
    wakeWordToolSuite?: WakeWordToolSuite
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
    this.memoryStore = memoryStore;
    this.moduleDecomposer = new ModuleDecomposer();
    this.stabilityDoctor = new StabilityDoctor();
    this.circuitBreaker = new BroccoliCircuitBreaker();
    this.streamingExecutor = new BroccoliStreamingToolExecutor();
    this.registerBuiltins();
  }

  validateToolArgs(name: string, args: Record<string, unknown>): SchemaValidationResult {
    const tool = this.tools.get(name);
    if (!tool) {
      return { valid: false, errors: [`Tool '${name}' not found`] };
    }

    if (!tool.parameters) {
      return { valid: true, errors: [] };
    }

    const errors: string[] = [];
    for (const [paramName, schema] of Object.entries(tool.parameters)) {
      const val = args[paramName];
      if (schema.required && (val === undefined || val === null || val === "")) {
        errors.push(`Missing required parameter '${paramName}'`);
        continue;
      }
      if (val !== undefined && val !== null) {
        const actualType = typeof val;
        if (actualType !== schema.type) {
          errors.push(`Parameter '${paramName}' must be of type '${schema.type}', got '${actualType}'`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  override async executeTool(
    name: string,
    args: Record<string, unknown>,
    cwd: string
  ): Promise<unknown> {
    if (!this.circuitBreaker.canExecute(name)) {
      throw new Error(`Circuit Breaker OPEN: Execution of tool '${name}' is temporarily blocked due to repeated failures.`);
    }

    const validation = this.validateToolArgs(name, args);
    if (!validation.valid) {
      this.circuitBreaker.recordFailure(name);
      throw new Error(`Tool '${name}' argument schema validation failed: ${validation.errors.join("; ")}`);
    }

    try {
      const result = await super.executeTool(name, args, cwd);
      this.circuitBreaker.recordSuccess(name);
      return result;
    } catch (err) {
      this.circuitBreaker.recordFailure(name);
      throw err;
    }
  }

  protected registerBuiltins(): void {
    const hands = this.hands as AnchoredHands;

    this.registerTool({
      name: "view_file",
      description: "Read contents of a file (Eyes)",
      parameters: {
        path: { type: "string", required: true, description: "Absolute or relative file path" },
      },
      execute: async (args) => {
        const filePath = String(args.path);
        const startLine = typeof args.startLine === "number" ? args.startLine : undefined;
        const endLine = typeof args.endLine === "number" ? args.endLine : undefined;
        return this.eyes.readFile(filePath, { startLine, endLine });
      },
    });

    this.registerTool({
      name: "write_file",
      description: "Write content to a file (Hands)",
      parameters: {
        path: { type: "string", required: true, description: "Target file path" },
        content: { type: "string", required: true, description: "Content string" },
      },
      execute: async (args) => {
        const filePath = String(args.path);
        const content = String(args.content);
        await hands.writeFile(filePath, content);
        return { success: true, path: filePath };
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
      execute: async (args) => {
        const filePath = String(args.path);
        const line = Number(args.line);
        const hash = String(args.hash);
        const replacement = String(args.replacement);
        return hands.applyAnchoredEdit(filePath, line, hash, replacement);
      },
    });

    this.registerTool({
      name: "run_command",
      description: "Execute a shell command (Hands)",
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
  }
}

export { ValidatingToolRegistry as ToolRegistry };
