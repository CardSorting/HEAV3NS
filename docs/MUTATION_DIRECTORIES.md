# 🧬 Mutation Directory Responsibility Matrix (ADR-012)

This document specifies the complete directory structure and single-responsibility module mapping under the **Non-Destructive Osmosis Extension Strategy ([ADR-012](../.wiki/adr/ADR-012-non-destructive-osmosis-class-extension-strategy.md))**.

---

## Architectural Principles

1. **Base Class Immutability**: Foundational base classes in `src/*/base/` remain immutable.
2. **Single-Responsibility Mutation Subdirectories**: Every evolutionary pass creates a dedicated file in a domain-scoped subdirectory inside `src/*/extensions/<mutation-domain>/`.
3. **Zero-Barrel Import Policy**: All intermediate `index.ts` barrel re-export files are prohibited. Imports target explicit, deep relative paths.
4. **Dependency Inversion Monolith Composition**: Extension classes extend base abstractions and are composed at the composition root (`MonolithFactory` & `LumiMonolith`).

---

## Complete Subsystem Mutation Directory Matrix

| Subsystem Tier | Mutation Directory | Pass / Feature Responsibility | Extension Class |
|---|---|---|---|
| **Agents** (`src/agents/extensions/`) | `compaction/` | System prompt compilation, context assembly & semantic compression | `PromptComposer`, `ContextCompressionSupervisor` |
| | `resolution/` | Model fallback resolution, slash routing & pricing specs | `ModelResolver`, `AgentSlashRouter`, `ModelCatalog` |
| | `execution/` | Deterministic tick execution, Codex lifecycle adaptation, interactive orchestration | `AgentEngine`, `CodexProgressAdapter`, `InteractiveModeController` |
| | `execution_guard/` | Tool execution batch segmentation, loop firewall & batch parallelism | `ToolExecutionGuardSupervisor` |
| | `prompt/` | Byte-stable prompt caching & system envelope boundary management | `PromptCacheSupervisor` |
| | `evidence/` | Verification evidence recording, stop-gate evaluation & session insights | `VerificationEvidenceSupervisor` |
| | `redaction/` | Secret redaction, query masking & sensitive path gating | `SecretRedactionSupervisor` |
| | `review/` | Background review, candidate fact extraction & self-improvement | `BackgroundReviewSupervisor` |
| | `doctor/` | Subsystem health diagnostics, orphaned turn salvage & state integrity | `DiagnosticDoctorSupervisor` |
| | `auth/` | Multi-provider identity federation & RFC 7636 PKCE OAuth device flow | `IdentityFederationSupervisor` |
| | `archive/` | Multi-format session export, archive packaging & encrypted backup | `SessionArchiveSupervisor` |
| | `skin/` | TrueColor terminal UI skin engine, palette resolution & animated banners | `TerminalSkinSupervisor` |
| | `auxiliary/` | Sub-task client routing, failover chains & dynamic user model selection | `AuxiliaryRouterSupervisor` |
| | `reasoning/` | Streaming reasoning scrubber, chunk-boundary parser & thinking budgets | `ReasoningSupervisor` |
| | `fuzzy/` | 9-strategy fuzzy line matcher, Unicode normalizer & edit idempotency | `FuzzyMatcherSupervisor` |
| | `goals/` | Topological milestone DAG & task roadmap orchestration | `GoalSupervisor` |
| | `skills/` | Evolutionary skill tree DAG parser & frame-tick decay curator | `SkillTreeSupervisor`, `EvolutionarySkillEngine` |
| | `soul/` | Persona ethos manifest parser, trait tuning & threat firewall | `SoulSupervisor` |
| | `threat/` | Compiled threat pattern scanner & code safety firewall | `ThreatFirewallSupervisor` |
| | `clarify/` | Intent disambiguation & interactive clarification inquiry engine | `ClarifyInquirySupervisor` |
| | `cost/` | Micro-cent pricing governor, token accounting & hard-cap budget gating | `CostGovernanceSupervisor` |
| | `disclosure/` | 4-tier progressive tool disclosure & deferred tool activation | `ToolDisclosureSupervisor` |
| | `computer-use/` | Virtual display driver & Set-of-Marks (SoM) OS automation | `ComputerUseSupervisor` |
| | `cdp/` | Headless browser CDP supervisor, dialog policy & DOM tree extraction | `CdpSupervisor` |
| | `cron/` | Self-healing cron scheduler & job blueprint catalog | `CronSupervisor` |
| | `swarm/` | Multi-agent priority lattice consensus & subagent task delegation | `AgentSwarmDispatcher`, `BroccoliTaskCoordinator` |
| | `intelligence/` | Workspace topology, package identity indexing & blast radius calculation | `WorkspaceIntelligenceEngine`, `BroccoliBlastRadiusCalculator` |
| | `mentions/` *(Pass 9)* | Prompt `@mention` context expansion | `MentionResolver` |
| **Sessions** (`src/sessions/extensions/`) | `substrate/` | Contiguous 16MB ArrayBuffer slab allocation, Broccolidb tables, view renderer & file locks | `ArenaAllocator`, `BroccoliDbTable`, `BroccoliViewRenderer`, `FileLockManager` |
| | `persistence/` | File persistence, CAS storage & frame-perfect snapshot rewind | `PersistentSessionStore`, `BroccoliCASStorageService` |
| | `memory/` | Long-term fact store & semantic knowledge graph persistence | `SessionMemoryStore`, `KnowledgeGraphSubstrate` |
| | `vfs/` | In-memory Virtual File System diff overlay | `SessionVfs` |
| | `compaction/` | Sliding window compaction & dense bitmap archiving | `SessionCompactor`, `SnapcompactEngine` |
| | `integrity/` *(Pass 12)* | Environment auditing & forensic self-healing | `StabilityDoctor`, `BroccoliRetentionCleanupService` |
| | `execution_guard/` | In-memory Broccolidb execution guard substrate & snapshot manager | `BroccoliExecutionGuardSubstrate`, `ExecutionGuardSnapshotManager` |
| | `prompt/` | In-memory prompt cache boundary substrate & frame snapshot manager | `BroccoliPromptCacheSubstrate`, `PromptCacheSnapshotManager` |
| | `evidence/` | In-memory verification evidence ledger substrate & snapshot manager | `BroccoliEvidenceSubstrate`, `EvidenceSnapshotManager` |
| | `redaction/` | In-memory secret redaction substrate & snapshot manager | `BroccoliRedactionSubstrate`, `RedactionSnapshotManager` |
| | `review/` | In-memory background review substrate & snapshot manager | `BroccoliReviewSubstrate`, `ReviewSnapshotManager` |
| | `doctor/` | In-memory health diagnostic substrate & snapshot manager | `BroccoliDoctorSubstrate`, `DoctorSnapshotManager` |
| | `auth/` | In-memory auth federation substrate & snapshot manager | `BroccoliAuthSubstrate`, `AuthSnapshotManager` |
| | `archive/` | In-memory session archive substrate & snapshot manager | `BroccoliArchiveSubstrate`, `ArchiveSnapshotManager` |
| | `skin/` | In-memory terminal skin substrate & snapshot manager | `BroccoliSkinSubstrate`, `SkinSnapshotManager` |
| | `auxiliary/` | In-memory auxiliary router substrate & snapshot manager | `BroccoliAuxiliarySubstrate`, `AuxiliarySnapshotManager` |
| | `reasoning/` | In-memory reasoning scrubber substrate & snapshot manager | `BroccoliReasoningSubstrate`, `ReasoningSnapshotManager` |
| | `fuzzy/` | In-memory fuzzy matching substrate & snapshot manager | `BroccoliFuzzySubstrate`, `FuzzySnapshotManager` |
| | `database/` | Hybrid in-memory Broccolidb kernel, WAL journal, sharded CAS & tables | `BroccoliDatabaseKernel`, `BroccoliWriteAheadLog`, `BroccoliDbTable` |
| **Tooling** (`src/tooling/extensions/`) | `execution_guard/` | Deterministic tool execution segmenter & 30-tool execution guard suite | `DeterministicToolSegmenter`, `ToolExecutionGuardToolSuite` |
| | `prompt/` | Deterministic prompt cache boundary calculator & 30-tool prompt suite | `DeterministicPromptCacher`, `PromptCacheToolSuite` |
| | `evidence/` | Deterministic coding verification evidence ledger & stop-gate suite | `DeterministicEvidenceLedger`, `VerificationEvidenceToolSuite` |
| | `redaction/` | Deterministic secret redactor & query masking tool suite | `DeterministicSecretRedactor`, `SecretRedactionToolSuite` |
| | `review/` | Deterministic background review evaluator & self-improvement suite | `DeterministicReviewEvaluator`, `BackgroundReviewToolSuite` |
| | `doctor/` | Deterministic diagnostic health doctor & salvage tool suite | `DeterministicDiagnosticDoctor`, `DiagnosticDoctorToolSuite` |
| | `auth/` | Deterministic PKCE device flow & identity federation tool suite | `DeterministicAuthFederator`, `IdentityFederationToolSuite` |
| | `archive/` | Deterministic multi-format session archiver & backup tool suite | `DeterministicSessionArchiver`, `SessionArchiveToolSuite` |
| | `skin/` | Deterministic TrueColor terminal skin engine & UI tool suite | `DeterministicSkinEngine`, `TerminalSkinToolSuite` |
| | `auxiliary/` | Deterministic auxiliary client router & failover tool suite | `DeterministicAuxiliaryRouter`, `AuxiliaryRouterToolSuite` |
| | `reasoning/` | Deterministic streaming reasoning tag scrubber & budget tool suite | `DeterministicReasoningScrubber`, `ReasoningToolSuite` |
| | `fuzzy/` | Deterministic 9-strategy fuzzy line matcher & mutation tool suite | `DeterministicFuzzyMatcher`, `FuzzyMatcherToolSuite` |
| | `perception/` | AST structural code symbol search & LSP bridge | `AstPerceptionEyes`, `BroccoliLspProtocolBridge` |
| | `progress/` | Legacy JSON-RPC progress notification formatting | `ProgressStreamingEars`, `TerminalProgressRenderer` |
| | `telemetry/` | Microsecond performance timers, trace recorder & OpenTelemetry spans | `ProtocolEars`, `TelemetryTracer`, `BroccoliExecutionTraceRecorder` |
| | `hashline/` | Line-anchored hash edit verification | `AnchoredHands` |
| | `registry/` | Skill discovery, schema validation & streaming tool execution | `SkillsIngestor`, `ValidatingToolRegistry`, `BroccoliStreamingToolExecutor` |
| | `permissions/` | Command permission controller, sanitizers & universal guardrails | `CommandPermissionController`, `BroccoliCommandSanitizer`, `BroccoliUniversalGuard` |
| | `gateway/` | JSON-RPC 2.0 streaming gateway server & delivery ledger | `MonolithGatewayServer`, `GatewayDispatcherEngine` |
| **TUI** (`src/tui/components/`) | `components/` | 30+ interactive terminal ANSI dashboard modals & visual cards | `ToolExecutionGuardDashboardModal`, `PromptCacheDashboardModal`, `VerificationEvidenceDashboardModal`, `ThreadContextDashboardModal`, `SoulDashboardModal`, `SkillTreeModal`, `MemoryCuratorModal`, `BillingUsageDashboardModal`, `DiagnosticDoctorDashboardModal`, `EmailInboxModal`, `ExecutionDashboardModal`, `HeredocTerminalDashboardModal`, `IdentityFederationDashboardModal`, `IntegrationsDashboardModal`, `OsvDashboardModal`, `PatchMutationDashboardModal`, `PreflightDashboardModal`, `ProfileDashboardModal`, `SchemaSanitizerDashboardModal`, `SelfRepoGuardDashboardModal`, `SessionArchiveDashboardModal`, `SkillLinterDashboardModal`, `StreamingScrubberDashboardModal`, `SubdirHintsDashboardModal`, `SwarmDashboardModal`, `TerminalCleanerDashboardModal`, `TitleInsightsDashboardModal`, `ToolDisclosureDashboardModal`, `TurnRetryDashboardModal`, `UrlSafetyDashboardModal`, `WalletDashboardModal` |

---

## Related Documentation

- [Runtime Architecture Guide](RUNTIME_ARCHITECTURE_GUIDE.md)
- [Architecture Diagrams](ARCHITECTURE_DIAGRAMS.md)
- [ADR-012 Specification](../.wiki/adr/ADR-012-non-destructive-osmosis-class-extension-strategy.md)
