import type {
  SoulAxiom,
  SoulManifest,
  SoulMutationIntent,
  SoulMutationResult,
  SoulTrait,
} from "../../../core/contracts/soul.contracts.js";
import { DeterministicSoulParser } from "./deterministic-soul-parser.js";
import { AnchoredHands } from "../hashline/hands.js";

/**
 * AnchoredSoulMutator.
 * Absorbed under ADR-014 (AKD-DSO Osmosis Paradigm).
 *
 * Enforces line-anchored non-destructive mutations, read-before-write provenance,
 * trait weight bounds, and immutable axiom protections on SOUL.md manifests.
 */
export class AnchoredSoulMutator {
  private readonly parser: DeterministicSoulParser;
  private readonly hands: AnchoredHands;
  private readonly forensicReadRegistry = new Map<string, string>(); // soulId -> lastInspectedHash

  constructor(
    parser = new DeterministicSoulParser(),
    hands = new AnchoredHands()
  ) {
    this.parser = parser;
    this.hands = hands;
  }

  /**
   * Registers a forensic read to satisfy the read-before-write provenance rule.
   */
  recordForensicRead(soulId: string, currentHash: string): void {
    this.forensicReadRegistry.set(soulId, currentHash);
  }

  /**
   * Applies a mutation intent against an active SoulManifest with strict invariant validation.
   */
  applyMutation(
    currentManifest: SoulManifest,
    intent: SoulMutationIntent,
    currentTick = 0
  ): SoulMutationResult {
    const previousHash = currentManifest.integrityHash;

    // 1. Enforce Read-Before-Write Provenance
    const recordedHash = this.forensicReadRegistry.get(currentManifest.id);
    if (!recordedHash || recordedHash !== previousHash) {
      return {
        success: false,
        previousHash,
        newHash: previousHash,
        failureReason: `Read-before-write violation: SOUL '${currentManifest.id}' has not been forensically inspected at hash ${previousHash}`,
        auditedBy: "AnchoredSoulMutator",
      };
    }

    let updatedAxioms: SoulAxiom[] = [...currentManifest.axioms];
    let updatedTraits: SoulTrait[] = [...currentManifest.traits];
    let updatedStyle = { ...currentManifest.style };
    let updatedBody = currentManifest.rawBody;
    let updatedArchetype = currentManifest.archetype;

    // 2. Execute Intent by Mutation Type
    switch (intent.type) {
      case "tune_trait": {
        if (!intent.targetTraitId || intent.targetWeight === undefined) {
          return {
            success: false,
            previousHash,
            newHash: previousHash,
            failureReason: "tune_trait requires targetTraitId and targetWeight",
            auditedBy: "AnchoredSoulMutator",
          };
        }

        const traitIndex = updatedTraits.findIndex((t) => t.id === intent.targetTraitId);
        if (traitIndex === -1) {
          return {
            success: false,
            previousHash,
            newHash: previousHash,
            failureReason: `Trait '${intent.targetTraitId}' not found in soul manifest`,
            auditedBy: "AnchoredSoulMutator",
          };
        }

        const trait = updatedTraits[traitIndex];
        // Clamp weight to bounded min/max
        const boundedWeight = Math.max(trait.minWeight, Math.min(trait.maxWeight, intent.targetWeight));
        updatedTraits[traitIndex] = Object.freeze({
          ...trait,
          weight: Number(boundedWeight.toFixed(3)),
        });
        break;
      }

      case "append_axiom": {
        if (!intent.newAxiom) {
          return {
            success: false,
            previousHash,
            newHash: previousHash,
            failureReason: "append_axiom requires newAxiom payload",
            auditedBy: "AnchoredSoulMutator",
          };
        }

        if (updatedAxioms.some((a) => a.id === intent.newAxiom?.id)) {
          return {
            success: false,
            previousHash,
            newHash: previousHash,
            failureReason: `Axiom with id '${intent.newAxiom.id}' already exists`,
            auditedBy: "AnchoredSoulMutator",
          };
        }

        updatedAxioms.push(Object.freeze({ ...intent.newAxiom }));
        break;
      }

      case "update_style": {
        if (!intent.targetStyle) {
          return {
            success: false,
            previousHash,
            newHash: previousHash,
            failureReason: "update_style requires targetStyle payload",
            auditedBy: "AnchoredSoulMutator",
          };
        }

        updatedStyle = { ...updatedStyle, ...intent.targetStyle };
        break;
      }

      case "switch_archetype": {
        if (!intent.targetArchetype) {
          return {
            success: false,
            previousHash,
            newHash: previousHash,
            failureReason: "switch_archetype requires targetArchetype payload",
            auditedBy: "AnchoredSoulMutator",
          };
        }

        updatedArchetype = intent.targetArchetype;
        break;
      }

      case "patch_body": {
        if (!intent.bodyPatch?.searchAnchor || intent.bodyPatch.replaceWith === undefined) {
          return {
            success: false,
            previousHash,
            newHash: previousHash,
            failureReason: "patch_body requires searchAnchor and replaceWith",
            auditedBy: "AnchoredSoulMutator",
          };
        }

        if (!updatedBody.includes(intent.bodyPatch.searchAnchor)) {
          return {
            success: false,
            previousHash,
            newHash: previousHash,
            failureReason: `Search anchor '${intent.bodyPatch.searchAnchor}' not found in SOUL raw body`,
            auditedBy: "AnchoredSoulMutator",
          };
        }

        updatedBody = updatedBody.replace(
          intent.bodyPatch.searchAnchor,
          intent.bodyPatch.replaceWith
        );
        break;
      }
    }

    const partialManifest = {
      id: currentManifest.id,
      name: currentManifest.name,
      archetype: updatedArchetype,
      version: currentManifest.version,
      summary: currentManifest.summary,
      axioms: Object.freeze(updatedAxioms),
      traits: Object.freeze(updatedTraits),
      style: Object.freeze(updatedStyle),
      rawBody: updatedBody.trim(),
      updatedTick: currentTick,
    };

    const newHash = this.parser.computeSoulHash(partialManifest);
    const updatedManifest: SoulManifest = Object.freeze({
      ...partialManifest,
      integrityHash: newHash,
    });

    // Update forensic read registry to new hash
    this.forensicReadRegistry.set(currentManifest.id, newHash);

    return {
      success: true,
      previousHash,
      newHash,
      updatedManifest,
      auditedBy: "AnchoredSoulMutator",
    };
  }
}
