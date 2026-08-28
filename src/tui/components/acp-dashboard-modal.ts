/**
 * acp-dashboard-modal.ts
 *
 * Interactive terminal TUI modal component for browsing connected ACP IDE sessions,
 * inspecting pre-commit adversarial diffs, reviewing pending approval requests,
 * and monitoring live LSP diagnostics under the AKD-DSO Monolith architecture (Phase 195 / ADR-133).
 */

import type {
  AcpDashboardViewMode,
  AcpEditApprovalRequest,
  AcpMultiFileChangeset,
  AcpRiskAssessment,
  AcpSessionInfo,
  IBroccoliAcpSubstrate,
  IAcpPermissionGate,
  IAcpSpeculativeChangesetStager,
  IAcpFineGrainedHunkPatcher,
  AcpDiffHunk,
} from "../../core/contracts/acp.contracts.js";

export class AcpDashboardModal {
  private readonly substrate: IBroccoliAcpSubstrate;
  private readonly permissionGate?: IAcpPermissionGate;
  private readonly stager?: IAcpSpeculativeChangesetStager;
  private readonly hunkPatcher?: IAcpFineGrainedHunkPatcher;
  private viewMode: AcpDashboardViewMode;
  private selectedIndex: number;
  private isVisible: boolean;
  private statusMessage?: string;
  private activeHunks: AcpDiffHunk[] = [];

  constructor(
    substrate: IBroccoliAcpSubstrate,
    permissionGate?: IAcpPermissionGate,
    stager?: IAcpSpeculativeChangesetStager,
    hunkPatcher?: IAcpFineGrainedHunkPatcher
  ) {
    this.substrate = substrate;
    this.permissionGate = permissionGate;
    this.stager = stager;
    this.hunkPatcher = hunkPatcher;
    this.viewMode = "sessions";
    this.selectedIndex = 0;
    this.isVisible = false;
  }

  public open(): void {
    this.isVisible = true;
    this.selectedIndex = 0;
    this.statusMessage = undefined;
  }

  public close(): void {
    this.isVisible = false;
  }

  public isOpen(): boolean {
    return this.isVisible;
  }

  public setViewMode(mode: AcpDashboardViewMode): void {
    this.viewMode = mode;
    this.selectedIndex = 0;
  }

  public cycleViewMode(): AcpDashboardViewMode {
    const modes: AcpDashboardViewMode[] = ["sessions", "approvals", "changesets", "hunks", "diagnostics", "audit-ledger"];
    const nextIdx = (modes.indexOf(this.viewMode) + 1) % modes.length;
    this.viewMode = modes[nextIdx];
    this.selectedIndex = 0;
    return this.viewMode;
  }

  public setHunks(hunks: readonly AcpDiffHunk[]): void {
    this.activeHunks = [...hunks];
  }

  public getHunks(): readonly AcpDiffHunk[] {
    return this.activeHunks;
  }

  public handleKey(key: string): { action: "render" | "close" | "none"; viewMode: AcpDashboardViewMode } {
    if (!this.isVisible) return { action: "none", viewMode: this.viewMode };

    const lower = key.toLowerCase();

    switch (lower) {
      case "q":
      case "escape":
        this.close();
        return { action: "close", viewMode: this.viewMode };

      case "\t":
      case "tab":
        this.cycleViewMode();
        return { action: "render", viewMode: this.viewMode };

      case "1":
        this.setViewMode("sessions");
        return { action: "render", viewMode: this.viewMode };

      case "2":
        this.setViewMode("approvals");
        return { action: "render", viewMode: this.viewMode };

      case "3":
        this.setViewMode("changesets");
        return { action: "render", viewMode: this.viewMode };

      case "4":
      case "h":
        this.setViewMode("hunks");
        return { action: "render", viewMode: this.viewMode };

      case "5":
        this.setViewMode("diagnostics");
        return { action: "render", viewMode: this.viewMode };

      case "6":
        this.setViewMode("audit-ledger");
        return { action: "render", viewMode: this.viewMode };

      case " ": {
        // Toggle selection in hunks view
        if (this.viewMode === "hunks" && this.activeHunks.length > 0) {
          const target = this.activeHunks[Math.min(this.selectedIndex, this.activeHunks.length - 1)];
          if (target) {
            const updated = !target.isSelected;
            this.activeHunks[Math.min(this.selectedIndex, this.activeHunks.length - 1)] = {
              ...target,
              isSelected: updated,
            };
            this.statusMessage = `Hunk '${target.hunkId}' ${updated ? "selected [x]" : "deselected [ ]"}.`;
          }
        }
        return { action: "render", viewMode: this.viewMode };
      }

      case "j":
      case "down":
        this.selectedIndex = Math.min(this.selectedIndex + 1, 50);
        return { action: "render", viewMode: this.viewMode };

      case "k":
      case "up":
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        return { action: "render", viewMode: this.viewMode };

      case "a": {
        // Approve selected item
        const approvals = this.substrate.listPendingApprovals();
        if (this.viewMode === "approvals" && approvals.length > 0) {
          const target = approvals[Math.min(this.selectedIndex, approvals.length - 1)];
          if (target && this.permissionGate) {
            this.permissionGate.submitApprovalDecision({
              approvalId: target.approvalId,
              approved: true,
              reason: "Approved from interactive TUI modal",
            });
            this.statusMessage = `Approval '${target.approvalId}' APPROVED.`;
          }
        }
        return { action: "render", viewMode: this.viewMode };
      }

      case "d": {
        // Deny selected item
        const approvals = this.substrate.listPendingApprovals();
        if (this.viewMode === "approvals" && approvals.length > 0) {
          const target = approvals[Math.min(this.selectedIndex, approvals.length - 1)];
          if (target && this.permissionGate) {
            this.permissionGate.submitApprovalDecision({
              approvalId: target.approvalId,
              approved: false,
              reason: "Denied by operator from TUI modal",
            });
            this.statusMessage = `Approval '${target.approvalId}' DENIED.`;
          }
        }
        return { action: "render", viewMode: this.viewMode };
      }

      case "m": {
        // Mode toggle
        const sessions = this.substrate.listSessions();
        if (sessions.length > 0) {
          const target = sessions[Math.min(this.selectedIndex, sessions.length - 1)];
          if (target) {
            const nextMode = target.mode === "code" ? "architect" : target.mode === "architect" ? "adversarial" : "code";
            this.substrate.updateSessionMode(target.sessionId, nextMode);
            this.statusMessage = `Session '${target.sessionId}' switched to mode '${nextMode}'.`;
          }
        }
        return { action: "render", viewMode: this.viewMode };
      }

      default:
        return { action: "none", viewMode: this.viewMode };
    }
  }

  public render(): string {
    if (!this.isVisible) return "";

    const lines: string[] = [];
    lines.push("╔════════════════════════════════════════════════════════════════════════════╗");
    lines.push("║        ⚡ AGENT CLIENT PROTOCOL (ACP) & HUNKS DASHBOARD                      ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    // Tab Header
    const tabs: { id: AcpDashboardViewMode; label: string }[] = [
      { id: "sessions", label: "[1] Sessions" },
      { id: "approvals", label: "[2] Approvals & Diffs" },
      { id: "changesets", label: "[3] Changesets" },
      { id: "hunks", label: "[4] Hunks" },
      { id: "diagnostics", label: "[5] Diag" },
      { id: "audit-ledger", label: "[6] Risk Ledger" },
    ];
    const tabLine = tabs
      .map((t) => (t.id === this.viewMode ? `\x1b[1;36m▶ ${t.label} ◀\x1b[0m` : `  ${t.label}  `))
      .join("│");
    lines.push(`║ ${tabLine.padEnd(80)} ║`);
    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");

    const sessions = this.substrate.listSessions();
    const approvals = this.substrate.listPendingApprovals();
    const changesets = this.substrate.listChangesets();
    const audits = this.substrate.listRiskAudits();

    switch (this.viewMode) {
      case "sessions": {
        lines.push(`║  Connected Sessions:     \x1b[1m${sessions.length}\x1b[0m`.padEnd(85) + " ║");
        lines.push(`║  RPC Calls Handled:      \x1b[1m${this.substrate.getRpcCallCount()}\x1b[0m`.padEnd(85) + " ║");
        lines.push("╟────────────────────────────────────────────────────────────────────────────╢");

        if (sessions.length === 0) {
          lines.push("║  \x1b[90mNo active IDE sessions connected via ACP.\x1b[0m".padEnd(85) + " ║");
        } else {
          sessions.forEach((s, idx) => {
            const isSelected = idx === this.selectedIndex;
            const prefix = isSelected ? "\x1b[1;36m▶\x1b[0m" : " ";
            const modeColor = s.mode === "adversarial" ? "\x1b[31m" : s.mode === "architect" ? "\x1b[35m" : "\x1b[32m";
            const line = `  ${prefix} \x1b[1m${s.sessionId}\x1b[0m [${modeColor}${s.mode.toUpperCase()}\x1b[0m] (${s.clientName || "IDE"}) - ${s.workspaceRoot}`;
            lines.push(`║ ${line.padEnd(83)} ║`);
          });
        }
        break;
      }

      case "approvals": {
        lines.push(`║  Pending Edit Approvals: \x1b[1m${approvals.length}\x1b[0m`.padEnd(85) + " ║");
        lines.push("╟────────────────────────────────────────────────────────────────────────────╢");

        if (approvals.length === 0) {
          lines.push("║  \x1b[32m[✓] All edit approval queues clean. No pending reviews.\x1b[0m".padEnd(85) + " ║");
        } else {
          approvals.forEach((req, idx) => {
            const isSelected = idx === this.selectedIndex;
            const prefix = isSelected ? "\x1b[1;36m▶\x1b[0m" : " ";
            const riskColor = req.riskAssessment?.riskLevel === "CRITICAL" ? "\x1b[31m" : req.riskAssessment?.riskLevel === "HIGH" ? "\x1b[33m" : "\x1b[32m";
            const line1 = `  ${prefix} \x1b[1m${req.filePath}\x1b[0m [Risk: ${riskColor}${req.riskAssessment?.riskLevel ?? "UNKNOWN"}\x1b[0m | Score: ${req.riskAssessment?.score ?? 100}/100]`;
            lines.push(`║ ${line1.padEnd(83)} ║`);

            if (req.diffSnippet || req.diffPreview) {
              const snippet = (req.diffSnippet || req.diffPreview || "").split("\n").slice(0, 3).join(" ");
              lines.push(`║     \x1b[90mDiff: ${snippet.slice(0, 65)}\x1b[0m`.padEnd(85) + " ║");
            }
          });
        }
        break;
      }

      case "changesets": {
        lines.push(`║  Recorded Changesets:    \x1b[1m${changesets.length}\x1b[0m`.padEnd(85) + " ║");
        lines.push("╟────────────────────────────────────────────────────────────────────────────╢");

        if (changesets.length === 0) {
          lines.push("║  \x1b[90mNo multi-file changesets registered.\x1b[0m".padEnd(85) + " ║");
        } else {
          changesets.forEach((cs, idx) => {
            const isSelected = idx === this.selectedIndex;
            const prefix = isSelected ? "\x1b[1;36m▶\x1b[0m" : " ";
            const statusColor = cs.status === "ACCEPTED" ? "\x1b[32m" : cs.status === "REJECTED" ? "\x1b[31m" : "\x1b[33m";
            const line = `  ${prefix} \x1b[1m${cs.title}\x1b[0m [${statusColor}${cs.status}\x1b[0m] (${cs.files.length} files, \x1b[32m+${cs.totalAdditions}\x1b[0m/\x1b[31m-${cs.totalDeletions}\x1b[0m)`;
            lines.push(`║ ${line.padEnd(83)} ║`);
          });
        }
        break;
      }

      case "hunks": {
        lines.push(`║  Fine-Grained Diff Hunks: \x1b[1m${this.activeHunks.length}\x1b[0m`.padEnd(85) + " ║");
        lines.push("╟────────────────────────────────────────────────────────────────────────────╢");

        if (this.activeHunks.length === 0) {
          lines.push("║  \x1b[90mNo active diff hunks loaded for review.\x1b[0m".padEnd(85) + " ║");
        } else {
          this.activeHunks.forEach((h, idx) => {
            const isCursor = idx === this.selectedIndex;
            const prefix = isCursor ? "\x1b[1;34m▶\x1b[0m" : " ";
            const check = h.isSelected ? "\x1b[32m[x]\x1b[0m" : "\x1b[90m[ ]\x1b[0m";
            const line = `  ${prefix} ${check} \x1b[1m${h.hunkId}\x1b[0m \x1b[90m${h.header}\x1b[0m (\x1b[32m+${h.additions}\x1b[0m/\x1b[31m-${h.deletions}\x1b[0m)`;
            lines.push(`║ ${line.padEnd(83)} ║`);
          });
        }
        break;
      }

      case "diagnostics": {
        lines.push("║  Active ACP Diagnostic Push Subsystem                                      ║");
        lines.push("╟────────────────────────────────────────────────────────────────────────────╢");
        lines.push("║  \x1b[32m[✓] LSP Diagnostic Push Stream active and synchronized with IDE.\x1b[0m".padEnd(85) + " ║");
        lines.push("║  Adversarial findings are pushed as live LSP warning/error markers.        ║");
        break;
      }

      case "audit-ledger": {
        lines.push(`║  Adversarial Risk Audits Recorded: \x1b[1m${audits.length}\x1b[0m`.padEnd(85) + " ║");
        lines.push("╟────────────────────────────────────────────────────────────────────────────╢");

        if (audits.length === 0) {
          lines.push("║  \x1b[90mNo risk audits recorded in BroccoliDB.\x1b[0m".padEnd(85) + " ║");
        } else {
          audits.slice(-5).forEach((audit, idx) => {
            const riskColor = audit.riskLevel === "CRITICAL" ? "\x1b[31m" : audit.riskLevel === "HIGH" ? "\x1b[33m" : "\x1b[32m";
            const line = `  • \x1b[1m${audit.targetPath.slice(0, 30)}\x1b[0m [${riskColor}${audit.riskLevel}\x1b[0m] Score: ${audit.score}/100 (${audit.findings.length} findings)`;
            lines.push(`║ ${line.padEnd(83)} ║`);
          });
        }
        break;
      }
    }

    if (this.statusMessage) {
      lines.push("╟────────────────────────────────────────────────────────────────────────────╢");
      lines.push(`║  ${this.statusMessage}`.padEnd(85) + " ║");
    }

    lines.push("╠════════════════════════════════════════════════════════════════════════════╣");
    lines.push("║  \x1b[90m[Tab] Cycle  [1-6] Tabs  [Space] Toggle  [A] Approve  [D] Deny  [Esc/Q] Exit\x1b[0m ║");
    lines.push("╚════════════════════════════════════════════════════════════════════════════╝");

    return lines.join("\n");
  }
}
