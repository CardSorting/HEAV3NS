import * as crypto from "node:crypto";
import type {
  CompressedTurnSummary,
  IBroccoliCompressionSubstrate,
  IDeterministicToolPruner,
  IHeadTailBudgetGovernor,
  ITrajectoryCompactorEngine,
  TokenWindowBudget,
} from "../../../core/contracts/compression.contracts.js";

/**
 * High-Level Trajectory Compactor Engine.
 *
 * Orchestrates multi-turn trajectory compaction into structured, byte-stable
 * LUMI-CONTEXT summary blocks while preserving initial system prompt anchors,
 * active tail reasoning turns, and prompt cache prefix stability.
 */
export class TrajectoryCompactorEngine implements ITrajectoryCompactorEngine {
  private readonly substrate: IBroccoliCompressionSubstrate;
  private readonly budgetGovernor: IHeadTailBudgetGovernor;
  private readonly toolPruner: IDeterministicToolPruner;

  constructor(
    substrate: IBroccoliCompressionSubstrate,
    budgetGovernor: IHeadTailBudgetGovernor,
    toolPruner: IDeterministicToolPruner
  ) {
    this.substrate = substrate;
    this.budgetGovernor = budgetGovernor;
    this.toolPruner = toolPruner;
  }

  public generateSummaryId(startTurn: number, endTurn: number, timestamp = Date.now()): string {
    const hash = crypto.createHash("sha256").update(`summary:${startTurn}:${endTurn}:${timestamp}`).digest("hex");
    return `comp_${hash.slice(0, 10)}`;
  }

  compactTrajectory(
    turns: readonly { turnIndex: number; role: string; content: string }[],
    budget: TokenWindowBudget
  ): {
    compactedTurns: readonly { turnIndex: number; role: string; content: string }[];
    summary?: CompressedTurnSummary;
    tokensSaved: number;
  } {
    if (turns.length <= 6) {
      return { compactedTurns: turns, tokensSaved: 0 };
    }

    const { head, middle, tail } = this.budgetGovernor.partitionTurns(turns, 2, 4);

    if (middle.length === 0) {
      return { compactedTurns: turns, tokensSaved: 0 };
    }

    // Estimate middle turns token consumption (approx 4 chars/token)
    let originalChars = 0;
    const keyActions: string[] = [];
    const resolvedGoals: string[] = [];
    const pendingGoals: string[] = [];

    for (const turn of middle) {
      originalChars += turn.content.length;

      // Extract brief semantic signals
      const firstLine = turn.content.split("\n")[0].trim().slice(0, 100);
      if (firstLine.length > 0) {
        keyActions.push(`- Turn #${turn.turnIndex} (${turn.role}): ${firstLine}`);
      }

      if (turn.content.includes("COMPLETED:") || turn.content.includes("RESOLVED:")) {
        resolvedGoals.push(`Turn #${turn.turnIndex} goal resolved`);
      }
      if (turn.content.includes("TODO:") || turn.content.includes("PENDING:")) {
        pendingGoals.push(`Turn #${turn.turnIndex} pending subtask`);
      }
    }

    const startTurn = middle[0].turnIndex;
    const endTurn = middle[middle.length - 1].turnIndex;

    const summaryText = [
      `### [LUMI-COMPACTED-TRAJECTORY: Turns #${startTurn} to #${endTurn}]`,
      `The conversation history between turn #${startTurn} and turn #${endTurn} was compacted to maintain token budget.`,
      `\n**Key Progress Summary:**`,
      keyActions.slice(0, 8).join("\n"),
      resolvedGoals.length > 0 ? `\n**Resolved Items:**\n${resolvedGoals.join("\n")}` : "",
      pendingGoals.length > 0 ? `\n**Active Work In Progress:**\n${pendingGoals.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const originalTokens = Math.ceil(originalChars / 4);
    const compressedTokens = Math.ceil(summaryText.length / 4);
    const tokensSaved = Math.max(0, originalTokens - compressedTokens);

    const summaryId = this.generateSummaryId(startTurn, endTurn);

    const summary: CompressedTurnSummary = {
      id: summaryId,
      sourceTurnStart: startTurn,
      sourceTurnEnd: endTurn,
      originalTokens,
      compressedTokens,
      summaryText,
      resolvedGoals,
      pendingGoals,
      timestampMs: Date.now(),
    };

    this.substrate.recordSummary(summary);

    // Assemble compacted turns: Head + Summary Turn + Tail
    const summaryTurn = {
      turnIndex: startTurn,
      role: "system",
      content: summaryText,
    };

    const compactedTurns = [...head, summaryTurn, ...tail];

    return {
      compactedTurns,
      summary,
      tokensSaved,
    };
  }
}
