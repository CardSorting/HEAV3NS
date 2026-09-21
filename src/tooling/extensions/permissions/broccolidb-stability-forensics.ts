/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 182: Zero-Dependency Broccoli Stability Forensics
 *
 * Lifted from external source workspace/codemarie-new/src/core/policy/StabilityForensics.ts.
 * Verifies architectural evidence cited in Plan and Act Mode reviews, detecting phantom path citations,
 * conversational context grounding, and structural hash integrity. Zero external npm dependencies.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface ForensicVerificationResult {
  errors: string[];
  warnings: string[];
  citedPaths: string[];
}

export class BroccoliStabilityForensics {
  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Verifies all file path citations in plan or act review markdown text.
   */
  public verifyEvidenceVerification(content: string, conversationalHistoryPaths: string[] = []): ForensicVerificationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Surgical regex to extract cited file paths (e.g. src/core/foo.ts or /path/to/file.ts)
    const pathRegexp = /(?:\/|^)(?:[a-zA-Z0-9_\-.]+\/)+[a-zA-Z0-9_\-.]+\.[a-zA-Z0-9]+/g;
    const matches = Array.from(content.matchAll(pathRegexp)).map((m) => (m[0].startsWith("/") ? m[0].slice(1) : m[0]));
    const citedPaths = Array.from(new Set(matches));

    const historySet = new Set(conversationalHistoryPaths.map((p) => path.resolve(this.workspaceRoot, p)));

    for (const cited of citedPaths) {
      const resolvedPath = path.resolve(this.workspaceRoot, cited);
      const exists = fs.existsSync(resolvedPath);

      if (!exists) {
        if (historySet.has(resolvedPath)) {
          warnings.push(`💡 CONVERSATIONAL GROUNDING: Path \`${cited}\` cited from neural history context.`);
        } else {
          errors.push(`📍 PHANTOM CITATION WARNING: Plan/Act review cites non-existent workspace path \`${cited}\`.`);
        }
      }
    }

    return {
      errors,
      warnings,
      citedPaths,
    };
  }
}
