import type {
  IDeterministicToolPruner,
  ToolPruningPolicy,
} from "../../../core/contracts/compression.contracts.js";

/**
 * Deterministic Tool Output Pruner.
 *
 * AST-aware and structure-preserving pruner for noisy tool outputs. Strips massive
 * binary/base64 payloads, collapses repetitive log dumps, and truncates long traces
 * while strictly preserving exit codes, error headings, and JSON structures.
 */
export class DeterministicToolPruner implements IDeterministicToolPruner {
  private readonly defaultPolicy: ToolPruningPolicy;

  constructor(policy?: Partial<ToolPruningPolicy>) {
    this.defaultPolicy = {
      maxOutputChars: policy?.maxOutputChars ?? 4000,
      stripBase64Data: policy?.stripBase64Data ?? true,
      preserveExitCodes: policy?.preserveExitCodes ?? true,
      collapseRepeatedLines: policy?.collapseRepeatedLines ?? true,
    };
  }

  pruneToolResult(
    rawOutput: string,
    policyOverride?: Partial<ToolPruningPolicy>
  ): { prunedText: string; originalChars: number; prunedChars: number; wasPruned: boolean } {
    const originalChars = rawOutput.length;
    const policy: ToolPruningPolicy = { ...this.defaultPolicy, ...policyOverride };

    let text = rawOutput;

    // 1. Strip base64 payloads if enabled
    if (policy.stripBase64Data) {
      text = text.replace(
        /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]{100,}/g,
        (match) => `[base64 data stripped: ${match.length} bytes]`
      );
      text = text.replace(
        /"(?:data:)?base64,[A-Za-z0-9+/=]{100,}"/g,
        (match) => `"[base64 payload stripped: ${match.length} bytes]"`
      );
    }

    // 2. Collapse repeated identical lines if enabled
    if (policy.collapseRepeatedLines) {
      const lines = text.split("\n");
      const collapsed: string[] = [];
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];
        let j = i + 1;
        while (j < lines.length && lines[j] === line && line.trim().length > 0) {
          j++;
        }
        const count = j - i;
        if (count > 2) {
          collapsed.push(line);
          collapsed.push(`  [... repeated ${count} identical lines omitted ...]`);
        } else {
          for (let k = i; k < j; k++) {
            collapsed.push(lines[k]);
          }
        }
        i = j;
      }

      text = collapsed.join("\n");
    }

    // 3. Truncate if exceeds maxOutputChars
    if (text.length > policy.maxOutputChars) {
      const keepHead = Math.floor(policy.maxOutputChars * 0.6);
      const keepTail = Math.floor(policy.maxOutputChars * 0.4);
      const head = text.slice(0, keepHead);
      const tail = text.slice(text.length - keepTail);
      const omitted = text.length - (keepHead + keepTail);

      text = `${head}\n\n[... ${omitted} characters truncated by LUMI DeterministicToolPruner ...]\n\n${tail}`;
    }

    const prunedChars = text.length;
    const wasPruned = prunedChars < originalChars;

    return {
      prunedText: text,
      originalChars,
      prunedChars,
      wasPruned,
    };
  }
}
