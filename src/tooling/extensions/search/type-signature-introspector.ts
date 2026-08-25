/**
 * type-signature-introspector.ts
 *
 * In-Memory TypeScript API Surface & Type Signature Introspector.
 * Extracts minimal, condensed public `.d.ts`-style signatures from source code
 * without including private implementation bodies, maximizing context token efficiency.
 */

export interface TypeSignatureReport {
  readonly filePath: string;
  readonly originalTokensEst: number;
  readonly condensedTokensEst: number;
  readonly compressionRatio: string;
  readonly signatures: string;
}

export class TypeSignatureIntrospector {
  /**
   * Introspects source code and extracts condensed public API type signatures.
   */
  public introspect(sourceCode: string, filePath = "source.ts"): TypeSignatureReport {
    const lines = sourceCode.split(/\r?\n/);
    const signatureLines: string[] = [];
    let insideClass = false;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Track brace depth
      for (const char of line) {
        if (char === "{") braceDepth++;
        if (char === "}") braceDepth--;
      }

      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
        continue;
      }

      // Exported interfaces
      if (/^export\s+interface\s+/.test(trimmed)) {
        signatureLines.push(trimmed);
        continue;
      }

      // Exported types
      if (/^export\s+type\s+/.test(trimmed)) {
        signatureLines.push(trimmed);
        continue;
      }

      // Exported enums
      if (/^export\s+enum\s+/.test(trimmed) || /^export\s+const\s+enum\s+/.test(trimmed)) {
        signatureLines.push(trimmed);
        continue;
      }

      // Exported classes
      if (/^export\s+(abstract\s+)?class\s+/.test(trimmed)) {
        const header = trimmed.split("{")[0].trim() + " {";
        signatureLines.push(header);
        insideClass = true;
        continue;
      }

      // Inside class public methods & properties
      if (insideClass) {
        if (braceDepth <= 0) {
          insideClass = false;
          signatureLines.push("}");
          continue;
        }

        if (/^public\s+|^readonly\s+|^get\s+|^set\s+|^constructor\s*\(/.test(trimmed)) {
          const sig = trimmed.split("{")[0].trim().replace(/;$/, "") + ";";
          signatureLines.push(`  ${sig}`);
        }
        continue;
      }

      // Exported functions
      if (/^export\s+(async\s+)?function\s+/.test(trimmed)) {
        const sig = trimmed.split("{")[0].trim().replace(/;$/, "") + ";";
        signatureLines.push(sig);
        continue;
      }

      // Exported constants
      if (/^export\s+const\s+([a-zA-Z0-9_$]+)(\s*:\s*[^=;]+)?/.test(trimmed)) {
        const match = trimmed.match(/^export\s+const\s+([a-zA-Z0-9_$]+)(\s*:\s*[^=;]+)?/);
        if (match) {
          signatureLines.push(`export const ${match[1]}${match[2] || ": unknown"};`);
        }
        continue;
      }

      // Type property lines within interfaces/types
      if (trimmed.endsWith(";") || trimmed.endsWith(",")) {
        if (signatureLines.length > 0 && (signatureLines[signatureLines.length - 1].endsWith("{") || signatureLines[signatureLines.length - 1].startsWith("  "))) {
          signatureLines.push(`  ${trimmed}`);
        }
      } else if (trimmed === "}" || trimmed === "};") {
        signatureLines.push(trimmed);
      }
    }

    const signatures = signatureLines.join("\n");
    const origTokens = Math.ceil(sourceCode.length / 4);
    const condensedTokens = Math.ceil(signatures.length / 4);
    const ratio = origTokens > 0 ? `${((1 - condensedTokens / origTokens) * 100).toFixed(1)}%` : "0%";

    return {
      filePath,
      originalTokensEst: origTokens,
      condensedTokensEst: condensedTokens,
      compressionRatio: ratio,
      signatures,
    };
  }
}
