/**
 * [LAYER: AGENTS EXTENSION]
 * Pass 137: Zero-Dependency Broccoli Verification Pipeline
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/orchestration/VerificationPipeline.ts).
 * Performs 2-phase post-mutation verification comparing baseline reports vs post-audit findings (introducedFindings, resolvedFindings),
 * invariant compliance checks, and gate status evaluation. Zero external npm dependencies.
 */

export interface VerificationFinding {
  id: string;
  filePath: string;
  message: string;
  line?: number;
  severity: "error" | "warning";
}

export interface VerificationReport {
  sessionId: string;
  executionId: string;
  verifiedAt: number;
  passed: boolean;
  introducedFindings: VerificationFinding[];
  resolvedFindings: VerificationFinding[];
  invariantViolations: string[];
}

export class BroccoliVerificationPipeline {
  private findingKey(f: VerificationFinding): string {
    return `${f.filePath}:${f.line ?? 0}:${f.message}`;
  }

  /**
   * Verifies post-mutation code integrity against a pre-edit baseline report.
   */
  public verify(params: {
    sessionId: string;
    executionId: string;
    baselineFindings: VerificationFinding[];
    postMutationFindings: VerificationFinding[];
    invariantViolations: string[];
  }): VerificationReport {
    const { sessionId, executionId, baselineFindings, postMutationFindings, invariantViolations } = params;

    const baselineKeys = new Set(baselineFindings.map(this.findingKey));
    const postKeys = new Set(postMutationFindings.map(this.findingKey));

    const introducedFindings = postMutationFindings.filter((f) => !baselineKeys.has(this.findingKey(f)));
    const resolvedFindings = baselineFindings.filter((f) => !postKeys.has(this.findingKey(f)));

    const passed = introducedFindings.filter((f) => f.severity === "error").length === 0 && invariantViolations.length === 0;

    return {
      sessionId,
      executionId,
      verifiedAt: Date.now(),
      passed,
      introducedFindings,
      resolvedFindings,
      invariantViolations,
    };
  }
}
