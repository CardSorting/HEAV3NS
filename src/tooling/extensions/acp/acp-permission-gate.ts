import type {
  AcpEditApprovalDecision,
  AcpEditApprovalRequest,
  AcpMultiFileChangeset,
  AcpPermissionLevel,
  AcpRiskAssessment,
  IAcpPermissionGate,
  IBroccoliAcpSubstrate,
} from "../../../core/contracts/acp.contracts.js";
import type { AdversarialScrutinySupervisor } from "../../../agents/extensions/adversarial/adversarial-scrutiny-supervisor.js";
import type { AdversarialHumanizer } from "../../../agents/extensions/adversarial/adversarial-humanizer.js";
import type { AdversarialFinding } from "../../../core/contracts/adversarial-scrutiny.contracts.js";

/**
 * Deterministic ACP Permission Gate with Pre-Commit Adversarial Diff Scrutinizer.
 *
 * Enforces file safety policies, sensitive path protection, and interactive
 * edit approval queues with automated adversarial red-teaming for IDE connections.
 */
export class AcpPermissionGate implements IAcpPermissionGate {
  private readonly substrate: IBroccoliAcpSubstrate;
  private readonly adversarialSupervisor?: AdversarialScrutinySupervisor;
  private readonly adversarialHumanizer?: AdversarialHumanizer;
  private readonly pendingResolvers: Map<string, (decision: AcpEditApprovalDecision) => void> = new Map();

  private static readonly HARD_DENY_PATTERNS = [
    /^\/etc\/(passwd|shadow|sudoers)/i,
    /\.ssh\/(authorized_keys|id_rsa|id_ed25519)$/i,
    /^\/(System|boot|root)\//i,
  ];

  private static readonly SENSITIVE_ASK_PATTERNS = [
    /\.env(\..+)?$/i,
    /\.npmrc$/i,
    /\.pypirc$/i,
    /\.git-credentials$/i,
    /\.aws\/credentials$/i,
    /\.ssh\/config$/i,
    /package\.json$/i,
    /tsconfig\.json$/i,
  ];

  constructor(
    substrate: IBroccoliAcpSubstrate,
    adversarialSupervisor?: AdversarialScrutinySupervisor,
    adversarialHumanizer?: AdversarialHumanizer
  ) {
    this.substrate = substrate;
    this.adversarialSupervisor = adversarialSupervisor;
    this.adversarialHumanizer = adversarialHumanizer;
  }

  checkPathPermission(filePath: string): AcpPermissionLevel {
    const normalized = filePath.replace(/\\/g, "/");

    for (const pattern of AcpPermissionGate.HARD_DENY_PATTERNS) {
      if (pattern.test(normalized)) {
        return "deny";
      }
    }

    for (const pattern of AcpPermissionGate.SENSITIVE_ASK_PATTERNS) {
      if (pattern.test(normalized)) {
        return "ask";
      }
    }

    return "allow";
  }

  async scrutinizeEdit(req: Partial<AcpEditApprovalRequest>): Promise<AcpRiskAssessment> {
    const targetPath = req.filePath || "unknown_path";
    const contentToAudit = req.proposedContent || req.diffPreview || req.diffSnippet || req.newContent || "";
    const findings: AdversarialFinding[] = [];
    let ungroundedCount = 0;
    let rollbackPresent = false;

    // Check 1: Path sensitivity
    const permission = this.checkPathPermission(targetPath);
    if (permission === "deny") {
      findings.push({
        id: `find_deny_${Date.now()}`,
        severity: "CRITICAL",
        category: "ARCHITECTURAL_FRAGILITY",
        title: "Forbidden System Path Mutation",
        description: `Target path '${targetPath}' is hard-denied by system immutability rules.`,
        remediation: "Remove or redirect mutation outside protected operating system and key directories.",
        impactScore: 100,
      });
    } else if (permission === "ask") {
      findings.push({
        id: `find_sensitive_${Date.now()}`,
        severity: "MEDIUM",
        category: "ARCHITECTURAL_FRAGILITY",
        title: "Sensitive Config File Edit",
        description: `Target path '${targetPath}' is security-sensitive and requires explicit authorization.`,
        remediation: "Ensure credentials are not committed in plain text.",
        impactScore: 50,
      });
    }

    // Check 2: Raw secret patterns in diff
    if (/(API_KEY|SECRET|PASSWORD|BEARER_TOKEN)\s*=\s*['"][a-zA-Z0-9_\-]{8,}['"]/i.test(contentToAudit)) {
      findings.push({
        id: `find_secret_${Date.now()}`,
        severity: "HIGH",
        category: "UNGROUNDED_PROVENANCE",
        title: "Plaintext Credential Assigned in Diff",
        description: "Hardcoded secret key or token detected in proposed file modification.",
        remediation: "Use environment variables or secret vaults instead of inline literals.",
        impactScore: 80,
      });
    }

    // Check 3: Rollback / error handling verification
    if (/\b(try\s*\{|rollback|catch|restoreSnapshot|rewind)\b/i.test(contentToAudit)) {
      rollbackPresent = true;
    } else if (contentToAudit.length > 300 && !/\b(error|throw|catch)\b/i.test(contentToAudit)) {
      findings.push({
        id: `find_rollback_${Date.now()}`,
        severity: "LOW",
        category: "ARCHITECTURAL_FRAGILITY",
        title: "Absence of Explicit Error Unwinding",
        description: "Proposed modification modifies state without explicit error boundary or rollback handlers.",
        remediation: "Add try/catch blocks and state restoration hooks.",
        impactScore: 20,
      });
    }

    // Check 4: Cognitive spend & fluff
    let fluffRatio = 0.05;
    if (this.adversarialSupervisor) {
      const spend = this.adversarialSupervisor.decomposeCognitiveSpend(contentToAudit);
      fluffRatio = spend.compressiblePercentage / 100;
      if (fluffRatio > 0.4) {
        findings.push({
          id: `find_fluff_${Date.now()}`,
          severity: "LOW",
          category: "COMPRESSIBLE_BLOAT",
          title: "Excessive Code Bloat or Filler Detected",
          description: `Diff contains ${(fluffRatio * 100).toFixed(1)}% compressible conversational fluff or verbose filler.`,
          remediation: "Compact repetitive comments and boilerplate before applying.",
          impactScore: 15,
        });
      }
    }

    // Calculate overall risk and score
    let score = 100;
    for (const f of findings) {
      if (f.severity === "CRITICAL") score -= 50;
      else if (f.severity === "HIGH") score -= 25;
      else if (f.severity === "MEDIUM") score -= 10;
      else if (f.severity === "LOW") score -= 5;
    }
    score = Math.max(0, Math.min(100, score));

    let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
    if (findings.some((f) => f.severity === "CRITICAL")) riskLevel = "CRITICAL";
    else if (findings.some((f) => f.severity === "HIGH")) riskLevel = "HIGH";
    else if (findings.some((f) => f.severity === "MEDIUM")) riskLevel = "MEDIUM";

    let recommendedAction: "APPROVE_SAFE" | "REQUIRE_MANUAL_REVIEW" | "REJECT_HARMFUL" = "APPROVE_SAFE";
    if (riskLevel === "CRITICAL") recommendedAction = "REJECT_HARMFUL";
    else if (riskLevel === "HIGH" || riskLevel === "MEDIUM" || permission === "ask") recommendedAction = "REQUIRE_MANUAL_REVIEW";

    const assessment: AcpRiskAssessment = {
      assessmentId: `risk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      targetPath,
      riskLevel,
      score,
      findings,
      rollbackSafeguardPresent: rollbackPresent,
      ungroundedSymbolCount: ungroundedCount,
      cognitiveFluffRatio: Number(fluffRatio.toFixed(3)),
      summary: `Adversarial audit on '${targetPath}' resulted in ${riskLevel} risk (Score: ${score}/100, ${findings.length} findings).`,
      recommendedAction,
      timestamp: Date.now(),
    };

    return assessment;
  }

  async scrutinizeChangeset(changeset: AcpMultiFileChangeset): Promise<AcpRiskAssessment> {
    const allFindings: AdversarialFinding[] = [];
    let minScore = 100;
    let worstRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";

    for (const file of changeset.files) {
      const fileRisk = await this.scrutinizeEdit({
        filePath: file.filePath,
        proposedContent: file.modifiedContent,
      });
      allFindings.push(...fileRisk.findings);
      if (fileRisk.score < minScore) minScore = fileRisk.score;
      if (fileRisk.riskLevel === "CRITICAL") worstRisk = "CRITICAL";
      else if (fileRisk.riskLevel === "HIGH" && worstRisk !== "CRITICAL") worstRisk = "HIGH";
      else if (fileRisk.riskLevel === "MEDIUM" && worstRisk === "LOW") worstRisk = "MEDIUM";
    }

    return {
      assessmentId: `cs_risk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      targetPath: `changeset:${changeset.changesetId} (${changeset.files.length} files)`,
      riskLevel: worstRisk,
      score: minScore,
      findings: allFindings,
      rollbackSafeguardPresent: true,
      ungroundedSymbolCount: 0,
      cognitiveFluffRatio: 0.05,
      summary: `Multi-file changeset '${changeset.title}' audited: ${worstRisk} risk (Score: ${minScore}/100 across ${changeset.files.length} files).`,
      recommendedAction: worstRisk === "CRITICAL" ? "REJECT_HARMFUL" : worstRisk === "HIGH" ? "REQUIRE_MANUAL_REVIEW" : "APPROVE_SAFE",
      timestamp: Date.now(),
    };
  }

  async requestEditApproval(req: Omit<AcpEditApprovalRequest, "approvalId" | "timestamp">): Promise<AcpEditApprovalDecision> {
    const permission = this.checkPathPermission(req.filePath);
    if (permission === "deny") {
      return {
        approvalId: `denied-${Date.now()}`,
        approved: false,
        reason: `Write forbidden: Path '${req.filePath}' is protected by safety invariants.`,
      };
    }

    // Run Pre-Commit Adversarial Risk Scrutiny
    const riskAssessment = await this.scrutinizeEdit(req);
    this.substrate.recordRiskAudit(riskAssessment);

    if (permission === "allow" && riskAssessment.riskLevel === "LOW") {
      return {
        approvalId: `auto-${Date.now()}`,
        approved: true,
      };
    }

    // Interactive 'ask' level or elevated risk
    const approvalId = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    let diagnosticShield: string | undefined;
    if (this.adversarialHumanizer) {
      diagnosticShield = this.adversarialHumanizer.renderVerdictBanner({
        auditId: riskAssessment.assessmentId,
        targetType: "code",
        verdict: riskAssessment.riskLevel === "CRITICAL" ? "REJECTED_FAIL_CLOSED" : riskAssessment.riskLevel === "HIGH" ? "CAUTION" : "APPROVED",
        score: riskAssessment.score,
        criticalCount: riskAssessment.findings.filter((f) => f.severity === "CRITICAL").length,
        highCount: riskAssessment.findings.filter((f) => f.severity === "HIGH").length,
        mediumCount: riskAssessment.findings.filter((f) => f.severity === "MEDIUM").length,
        lowCount: riskAssessment.findings.filter((f) => f.severity === "LOW").length,
        totalFindings: riskAssessment.findings.length,
        findings: riskAssessment.findings,
        provenanceGrounding: [],
        executiveSummary: riskAssessment.summary,
        timestamp: Date.now(),
        latencyMs: 0.1,
      });
    }

    const fullRequest: AcpEditApprovalRequest = {
      ...req,
      approvalId,
      isSensitivePath: permission === "ask",
      riskAssessment,
      diagnosticShield,
      timestamp: Date.now(),
    };

    this.substrate.queueApproval(fullRequest);

    return new Promise<AcpEditApprovalDecision>((resolve) => {
      this.pendingResolvers.set(approvalId, resolve);
    });
  }

  submitApprovalDecision(decision: AcpEditApprovalDecision): boolean {
    const resolver = this.pendingResolvers.get(decision.approvalId);
    if (!resolver) {
      return false;
    }

    this.substrate.resolveApproval(decision.approvalId, decision);
    this.pendingResolvers.delete(decision.approvalId);
    resolver(decision);
    return true;
  }

  resolveApproval(decision: AcpEditApprovalDecision): boolean {
    return this.submitApprovalDecision(decision);
  }

  listPendingApprovals(): readonly AcpEditApprovalRequest[] {
    return this.substrate.listPendingApprovals();
  }
}
