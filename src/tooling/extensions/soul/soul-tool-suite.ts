import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { DeterministicSoulParser } from "./deterministic-soul-parser.js";
import { AnchoredSoulMutator } from "./anchored-soul-mutator.js";
import type { BroccoliSoulSubstrate } from "../../../sessions/extensions/soul/broccoli-soul-substrate.js";

/**
 * SoulToolSuite.
 * Absorbed under ADR-014 (AKD-DSO Osmosis Paradigm).
 *
 * Model tool suite exposing persona inspection, trait tuning, and integrity audit tools.
 */
export class SoulToolSuite {
  private readonly parser: DeterministicSoulParser;
  private readonly mutator: AnchoredSoulMutator;
  private substrate?: BroccoliSoulSubstrate;

  constructor(
    parser = new DeterministicSoulParser(),
    mutator = new AnchoredSoulMutator()
  ) {
    this.parser = parser;
    this.mutator = mutator;
  }

  setSubstrate(substrate: BroccoliSoulSubstrate): void {
    this.substrate = substrate;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "soul_view",
        description: "Inspect active AI agent SOUL manifest, immutable operational axioms, dynamic traits, and style rules.",
        parameters: {
          profileId: {
            type: "string",
            required: false,
            description: "Optional profile identifier to view (defaults to active soul).",
          },
        },
        execute: async () => {
          return this.executeTool("soul_view", {});
        },
      },
      {
        name: "soul_tune_trait",
        description: "Safely tune a dynamic personality trait weight within predefined mathematical bounds.",
        parameters: {
          traitId: {
            type: "string",
            required: true,
            description: "Identifier of the trait to tune (e.g., 'trait-conciseness', 'trait-code-density').",
          },
          weight: {
            type: "number",
            required: true,
            description: "Target weight between 0.0 and 1.0.",
          },
          rationale: {
            type: "string",
            required: true,
            description: "Technical justification for modifying the persona trait.",
          },
        },
        execute: async (args: Record<string, unknown>) => {
          return this.executeTool("soul_tune_trait", args);
        },
      },
      {
        name: "soul_audit_integrity",
        description: "Perform cryptographic SHA-256 verification and immutable axiom compliance check on the active SOUL.",
        parameters: {},
        execute: async () => {
          return this.executeTool("soul_audit_integrity", {});
        },
      },
    ];
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!this.substrate) {
      return { success: false, error: "SoulSubstrate not attached to SoulToolSuite" };
    }

    switch (name) {
      case "soul_view": {
        const manifest = this.substrate.getActiveManifest();
        // Record forensic read for read-before-write provenance
        this.mutator.recordForensicRead(manifest.id, manifest.integrityHash);
        return {
          success: true,
          data: {
            id: manifest.id,
            name: manifest.name,
            archetype: manifest.archetype,
            version: manifest.version,
            summary: manifest.summary,
            style: manifest.style,
            axioms: manifest.axioms,
            traits: manifest.traits,
            integrityHash: manifest.integrityHash,
            updatedTick: manifest.updatedTick,
          },
        };
      }

      case "soul_tune_trait": {
        const traitId = String(args.traitId ?? "");
        const weight = Number(args.weight ?? 0.5);
        const rationale = String(args.rationale ?? "Model tuning");

        const manifest = this.substrate.getActiveManifest();
        // Ensure read was recorded
        this.mutator.recordForensicRead(manifest.id, manifest.integrityHash);

        const mutationResult = this.mutator.applyMutation(
          manifest,
          {
            type: "tune_trait",
            targetTraitId: traitId,
            targetWeight: weight,
            rationale,
          },
          this.substrate.getCurrentTick()
        );

        if (!mutationResult.success || !mutationResult.updatedManifest) {
          return {
            success: false,
            error: mutationResult.failureReason ?? "Failed to tune soul trait",
          };
        }

        this.substrate.setActiveManifest(mutationResult.updatedManifest);
        return {
          success: true,
          data: {
            traitId,
            newWeight: mutationResult.updatedManifest.traits.find((t) => t.id === traitId)?.weight,
            previousHash: mutationResult.previousHash,
            newHash: mutationResult.newHash,
          },
        };
      }

      case "soul_audit_integrity": {
        const manifest = this.substrate.getActiveManifest();
        const expectedHash = this.parser.computeSoulHash(manifest);
        const isHashValid = manifest.integrityHash === expectedHash;
        const immutableAxiomsPreserved = manifest.axioms.every((a) => a.isImmutable);

        return {
          success: isHashValid && immutableAxiomsPreserved,
          data: {
            manifestId: manifest.id,
            currentHash: manifest.integrityHash,
            computedHash: expectedHash,
            isHashValid,
            totalAxioms: manifest.axioms.length,
            immutableAxiomsPreserved,
            status: isHashValid && immutableAxiomsPreserved ? "OPTIMAL" : "TAMPERED",
          },
        };
      }

      default:
        return { success: false, error: `Unknown soul tool: ${name}` };
    }
  }
}
