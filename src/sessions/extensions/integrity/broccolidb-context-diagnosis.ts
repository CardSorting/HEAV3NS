/**
 * [LAYER: SESSIONS EXTENSION]
 * Pass 149: Zero-Dependency Broccoli Context Diagnosis Service
 *
 * Lifted from external source workspace/codemarie-new/broccolidb (core/agent-context/DiagnosisService.ts).
 * Evaluates epistemic context health audits (diagnoseContext), calculating graph health scores (0-100),
 * detecting stale/unverified/contradictory node counts, and flagging high-entropy items. Zero external npm dependencies.
 */

export interface DiagnosisKnowledgeNode {
  id: string;
  createdAt: number;
  confidence: number;
  contradictionCount: number;
  verified: boolean;
}

export interface ContextHealthReport {
  score: number; // 0 - 100
  gaps: string[];
  metrics: {
    staleCount: number;
    contradictionCount: number;
    unverifiedCount: number;
    highEntropyNodes: string[];
  };
  diagnosedAt: number;
}

export class BroccoliContextDiagnosisService {
  /**
   * Performs an epistemic context health audit across a set of knowledge nodes.
   */
  public diagnoseContext(nodes: DiagnosisKnowledgeNode[]): ContextHealthReport {
    const gaps: string[] = [];
    let staleCount = 0;
    let contradictionCount = 0;
    let unverifiedCount = 0;
    const highEntropyNodes: string[] = [];

    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 86_400_000;

    for (const node of nodes) {
      // 1. Check Staleness
      if (now - node.createdAt > SEVEN_DAYS_MS) {
        staleCount++;
      }

      // 2. Check Verification
      if (!node.verified) {
        unverifiedCount++;
      }

      // 3. Check Contradictions
      if (node.contradictionCount > 0) {
        contradictionCount += node.contradictionCount;
      }

      // 4. Check High Entropy / Low Confidence
      if (node.confidence < 0.2) {
        highEntropyNodes.push(node.id);
      }
    }

    if (staleCount > 5) gaps.push(`High staleness detected: ${staleCount} stale knowledge nodes.`);
    if (contradictionCount > 0) gaps.push(`Knowledge contradictions found: ${contradictionCount} conflict edges.`);
    if (unverifiedCount > 10) gaps.push(`Unverified knowledge overload: ${unverifiedCount} unverified nodes.`);

    const totalNodes = Math.max(1, nodes.length);
    const penalty = (staleCount * 2 + contradictionCount * 15 + unverifiedCount * 3 + highEntropyNodes.length * 20) / totalNodes;
    const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));

    return {
      score,
      gaps,
      metrics: {
        staleCount,
        contradictionCount,
        unverifiedCount,
        highEntropyNodes,
      },
      diagnosedAt: now,
    };
  }
}
