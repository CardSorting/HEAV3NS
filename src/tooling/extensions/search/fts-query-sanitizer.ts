import type { IFtsQuerySanitizer } from "../../../core/contracts/search.contracts.js";

/**
 * Deterministic FTS Query Sanitizer.
 *
 * Normalizes Unicode, removes/escapes FTS5 syntax control characters
 * (+{}():"^@/#&|~[]<>,;!?$=\'), detects CJK ideographs, and extracts
 * safe search tokens without throwing syntax errors.
 */
export class FtsQuerySanitizer implements IFtsQuerySanitizer {
  private static readonly SPECIAL_CHARS = /[+{}():"^@/#&|~[\]<>,;!?$=\\']/g;
  private static readonly CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uF900-\uFAFF]/;

  sanitizeQuery(rawQuery: string): { cleanQuery: string; tokens: readonly string[]; isCjk: boolean } {
    if (!rawQuery || typeof rawQuery !== "string") {
      return { cleanQuery: "", tokens: [], isCjk: false };
    }

    const normalized = rawQuery.normalize("NFKC").trim();
    const isCjk = FtsQuerySanitizer.CJK_REGEX.test(normalized);

    // Strip unsafe characters
    const stripped = normalized.replace(FtsQuerySanitizer.SPECIAL_CHARS, " ");
    const cleanQuery = stripped.replace(/\s+/g, " ").trim().toLowerCase();

    // Extract search tokens
    let tokens: string[] = [];
    if (isCjk) {
      // Split into unigrams and bigrams for CJK
      const chars = Array.from(cleanQuery).filter((c) => c.trim().length > 0);
      tokens = [...chars];
      for (let i = 0; i < chars.length - 1; i++) {
        tokens.push(chars[i] + chars[i + 1]);
      }
    } else {
      tokens = cleanQuery.split(" ").filter((t) => t.length > 0);
    }

    return {
      cleanQuery,
      tokens,
      isCjk,
    };
  }
}
