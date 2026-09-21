/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 178: Zero-Dependency Broccoli Integrity Protocol
 *
 * Lifted from external source workspace/codemarie-new/src/core/policy/IntegrityProtocol.ts.
 * Provides TRIAD AUDIT template generation (The Architect, The Critic, The SRE), section headers,
 * and semantic compliance checking for strategic Plan Mode reviews. Zero external npm dependencies.
 */

export interface TriadAuditCheck {
  architectReview: boolean;
  criticReview: boolean;
  sreReview: boolean;
  complete: boolean;
}

export class BroccoliIntegrityProtocol {
  public static readonly HEADERS = {
    ARCHITECT: "### The Architect",
    CRITIC: "### The Critic",
    SRE: "### The SRE",
  } as const;

  /**
   * Generates a standard TRIAD AUDIT template string.
   */
  public static generateAuditTemplate(topic = "Architectural Review"): string {
    return (
      `# STRATEGIC AUDIT: ${topic}\n\n` +
      `## Requirement Analysis\n` +
      `- Objective: Define system goals and constraints.\n\n` +
      `${BroccoliIntegrityProtocol.HEADERS.ARCHITECT}\n` +
      `- Architecture soundness & JoyZoning layer discipline.\n\n` +
      `${BroccoliIntegrityProtocol.HEADERS.CRITIC}\n` +
      `- Edge cases, failure modes, and scaling concerns.\n\n` +
      `${BroccoliIntegrityProtocol.HEADERS.SRE}\n` +
      `- System reliability, observability, and rollback plan.\n`
    );
  }

  /**
   * Evaluates whether a markdown document contains required TRIAD AUDIT sections.
   */
  public evaluateAudit(content: string): TriadAuditCheck {
    const architectReview = content.includes(BroccoliIntegrityProtocol.HEADERS.ARCHITECT) || /architect/i.test(content);
    const criticReview = content.includes(BroccoliIntegrityProtocol.HEADERS.CRITIC) || /critic/i.test(content);
    const sreReview = content.includes(BroccoliIntegrityProtocol.HEADERS.SRE) || /sre/i.test(content);

    return {
      architectReview,
      criticReview,
      sreReview,
      complete: architectReview && criticReview && sreReview,
    };
  }
}
