/**
 * [LAYER: SESSIONS EXTENSION]
 * Pass 125: Zero-Dependency Broccoli System Invariant Engine
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/agent-context/InvariantEngine.ts).
 * Performs system invariant auditing, scanning workspace disk surfaces and source code text
 * for banned database files, security bypass symbols, and structural compliance violations. Zero external npm dependencies.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface SystemInvariantViolation {
  id: string;
  type: "banned-file" | "banned-symbol" | "security-bypass" | "isolation-breach";
  target: string;
  line?: number;
  message: string;
  severity: "high" | "medium" | "low";
}

export interface InvariantAuditReport {
  timestamp: number;
  scannedFilesCount: number;
  violations: SystemInvariantViolation[];
  passed: boolean;
}

export class BroccoliSystemInvariantEngine {
  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Audits workspace disk surfaces for banned files or illegal sqlite database artifacts.
   */
  public async auditDiskInvariants(): Promise<SystemInvariantViolation[]> {
    const violations: SystemInvariantViolation[] = [];
    const bannedPatterns = ["telemetry_queue.db", "telemetry_queue.db-wal", "telemetry_queue.db-shm"];

    for (const pattern of bannedPatterns) {
      const fullPath = path.resolve(this.workspaceRoot, pattern);
      try {
        await fs.stat(fullPath);
        violations.push({
          id: `inv-file-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: "banned-file",
          target: pattern,
          message: `Banned system telemetry queue database artifact found on disk: '${pattern}'`,
          severity: "high",
        });
      } catch {
        // File clean
      }
    }

    return violations;
  }

  /**
   * Audits source code text for banned security bypass patterns or unvalidated SQL/eval calls.
   */
  public auditCodeContent(filePath: string, content: string): SystemInvariantViolation[] {
    const violations: SystemInvariantViolation[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const lineContent = lines[i];

      if (/\beval\s*\(/i.test(lineContent)) {
        violations.push({
          id: `inv-code-eval-${i + 1}`,
          type: "security-bypass",
          target: filePath,
          line: i + 1,
          message: `Dynamic eval() call detected in '${filePath}:${i + 1}'`,
          severity: "high",
        });
      }

      if (/\bprocess\.env\.[A-Z0-9_]+\s*=\s*/i.test(lineContent)) {
        violations.push({
          id: `inv-code-env-${i + 1}`,
          type: "isolation-breach",
          target: filePath,
          line: i + 1,
          message: `Direct process.env mutation detected in '${filePath}:${i + 1}'`,
          severity: "medium",
        });
      }
    }

    return violations;
  }

  /**
   * Executes a full system invariant audit across workspace surfaces.
   */
  public async runFullInvariantAudit(codeFiles: Array<{ path: string; content: string }>): Promise<InvariantAuditReport> {
    const diskViolations = await this.auditDiskInvariants();
    const codeViolations: SystemInvariantViolation[] = [];

    for (const f of codeFiles) {
      codeViolations.push(...this.auditCodeContent(f.path, f.content));
    }

    const violations = [...diskViolations, ...codeViolations];

    return {
      timestamp: Date.now(),
      scannedFilesCount: codeFiles.length,
      violations,
      passed: violations.length === 0,
    };
  }
}
