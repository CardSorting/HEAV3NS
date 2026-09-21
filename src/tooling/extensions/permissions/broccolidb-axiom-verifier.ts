/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 160: Zero-Dependency Broccoli Axiom Verifier
 *
 * Lifted from external source workspace/codemarie-new/src/core/policy/AxiomVerificationService.ts.
 * Validates file layer headers ([LAYER: DOMAIN/CORE/INFRASTRUCTURE]), provides proactive architectural layer context,
 * and generates actionable correction hints for layer boundary leaks. Zero external npm dependencies.
 */

import * as path from "node:path";
import { BroccoliJoyZoningEngine } from "./broccolidb-joy-zoning.js";
import { BroccoliJoyZoningGuard } from "./broccolidb-joy-zoning-guard.js";
import { BroccoliWorkspaceArchitectureProfiler } from "./broccolidb-architecture-profiler.js";
import { BroccoliTspPolicyPlugin } from "./broccolidb-tsp-policy.js";
import { BroccoliReactivePolicyObserver } from "./broccolidb-reactive-policy.js";
import { BroccoliUniversalGuard } from "./broccolidb-universal-guard.js";
import { BroccoliSemanticAxiomEngine } from "./broccolidb-semantic-axiom.js";

export interface AxiomVerificationResult {
  valid: boolean;
  errors: string[];
  correctionHint?: string;
}

export class BroccoliAxiomVerifier {
  readonly joyZoningEngine = new BroccoliJoyZoningEngine();
  readonly joyZoningGuard = new BroccoliJoyZoningGuard(this.joyZoningEngine);
  readonly profiler = new BroccoliWorkspaceArchitectureProfiler(this.joyZoningEngine);
  readonly tspPolicy = new BroccoliTspPolicyPlugin();
  readonly reactiveObserver = new BroccoliReactivePolicyObserver(this.joyZoningEngine);
  readonly universalGuard = new BroccoliUniversalGuard(this.joyZoningEngine);
  readonly semanticAxiom = new BroccoliSemanticAxiomEngine(this.joyZoningEngine);
  /**
   * Returns proactive architectural guidance for a given file's layer tag.
   */
  public getFileLayerContext(filePath: string, layer: string): string {
    const fileName = path.basename(filePath);
    const upperLayer = layer.toUpperCase();

    switch (upperLayer) {
      case "DOMAIN":
        return `📍 ${fileName} → DOMAIN layer\n  ✅ Pure business logic, models, rules\n  🚫 No I/O, no external imports, no side effects`;
      case "CORE":
        return `📍 ${fileName} → CORE layer\n  ✅ Orchestration, task coordination, prompt assembly\n  🚫 Avoid raw I/O — delegate to Infrastructure adapters`;
      case "INFRASTRUCTURE":
        return `📍 ${fileName} → INFRASTRUCTURE layer\n  ✅ Adapters, API clients, persistence, external services\n  🚫 No business rules`;
      default:
        return `📍 ${fileName} → ${upperLayer} layer\n  ✅ Respect established layer boundaries.`;
    }
  }

  /**
   * Generates a concise correction hint for architectural layer tag violations.
   */
  public getCorrectionHint(errors: string[], filePath?: string, layer = "CORE"): string {
    const fixes: string[] = [];
    const snippets: string[] = [];
    const upperLayer = layer.toUpperCase();

    for (const err of errors) {
      if (err.includes("LAYER") || err.includes("Missing mandatory")) {
        fixes.push(`Add a mandatory [LAYER: ${upperLayer}] tag to the file header.`);
        snippets.push(`/**\n * [LAYER: ${upperLayer}]\n */`);
      } else if (err.includes("Misalignment") || err.includes("Boundary")) {
        fixes.push("Relocate logic to respect single-direction dependency flow.");
      }
    }

    if (fixes.length === 0) return "";

    return (
      `💡 Architectural Correction Hint:\n` +
      fixes.map((f) => `  - ${f}`).join("\n") +
      (snippets.length > 0 ? `\n\nExample Header:\n${snippets.join("\n")}` : "")
    );
  }

  /**
   * Audits file content for architectural layer tag compliance.
   */
  public verifyLayerTag(filePath: string, fileContent: string): AxiomVerificationResult {
    const errors: string[] = [];
    const hasLayerTag = /\[LAYER:\s*(DOMAIN|CORE|INFRASTRUCTURE|AGENTS|SESSIONS|TOOLING)\]/i.test(fileContent);

    if (!hasLayerTag) {
      errors.push(`Missing mandatory [LAYER: ...] header tag in ${path.basename(filePath)}.`);
    }

    const valid = errors.length === 0;
    const correctionHint = valid ? undefined : this.getCorrectionHint(errors, filePath);

    return {
      valid,
      errors,
      correctionHint,
    };
  }
}
