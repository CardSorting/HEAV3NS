import type {
  SoulAxiom,
  SoulManifest,
  SoulMutationIntent,
  SoulMutationResult,
  SoulTrait,
} from "../../../core/contracts/soul.contracts.js";
import { DeterministicSoulParser } from "./deterministic-soul-parser.js";
import { SoulErgonomicsEngine } from "./soul-ergonomics-engine.js";
import { SoulThreatGuard } from "../../../agents/extensions/soul/soul-threat-guard.js";
import { AnchoredHands } from "../hashline/hands.js";

/**
 * AnchoredSoulMutator.
 * Absorbed under ADR-014 (AKD-DSO Osmosis Paradigm) & SOUL-001.
 *
 * Enforces line-anchored non-destructive mutations, read-before-write provenance,
 * trait weight bounds, preset application, and immutable axiom protections on SOUL.md manifests.
 */
export class AnchoredSoulMutator {
  private readonly parser: DeterministicSoulParser;
  private readonly ergonomics: SoulErgonomicsEngine;
  private readonly threatGuard: SoulThreatGuard;
  private readonly hands: AnchoredHands;
  private readonly forensicReadRegistry = new Map<string, string>(); // soulId -> lastInspectedHash

  constructor(
    parser = new DeterministicSoulParser(),
    hands = new AnchoredHands(),
    ergonomics = new SoulErgonomicsEngine(),
    threatGuard = new SoulThreatGuard()
  ) {
    this.parser = parser;
    this.hands = hands;
    this.ergonomics = ergonomics;
    this.threatGuard = threatGuard;
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

    // 2. Axiomatic Threat Scan Validation
    const threatScan = this.threatGuard.validateMutation(currentManifest, intent);
    if (!threatScan.isSafe) {
      return {
        success: false,
        previousHash,
        newHash: previousHash,
        failureReason: threatScan.blockedReason || "Mutation rejected by Axiomatic Threat Guard",
        auditedBy: "SoulThreatGuard",
      };
    }

    let updatedAxioms: SoulAxiom[] = [...currentManifest.axioms];
    let updatedTraits: SoulTrait[] = [...currentManifest.traits];
    let updatedStyle = { ...currentManifest.style };
    let updatedBody = currentManifest.rawBody;
    let updatedArchetype = currentManifest.archetype;

    // 3. Execute Intent by Mutation Type
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

      case "apply_preset": {
        if (!intent.presetId) {
          return {
            success: false,
            previousHash,
            newHash: previousHash,
            failureReason: "apply_preset requires presetId",
            auditedBy: "AnchoredSoulMutator",
          };
        }

        const preset = this.ergonomics.getPresetById(intent.presetId);
        if (!preset) {
          return {
            success: false,
            previousHash,
            newHash: previousHash,
            failureReason: `Preset '${intent.presetId}' not found in catalog`,
            auditedBy: "AnchoredSoulMutator",
          };
        }

        updatedArchetype = preset.archetype;
        updatedStyle = { ...updatedStyle, ...preset.targetStyle };

        for (const targetT of preset.targetTraits) {
          const idx = updatedTraits.findIndex((t) => t.id === targetT.traitId);
          if (idx !== -1) {
            const trait = updatedTraits[idx];
            const clamped = Math.max(trait.minWeight, Math.min(trait.maxWeight, targetT.weight));
            updatedTraits[idx] = Object.freeze({
              ...trait,
              weight: Number(clamped.toFixed(3)),
            });
          }
        }
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

    const diffReport = this.ergonomics.generateDiffReport(currentManifest, updatedManifest);

    return {
      success: true,
      previousHash,
      newHash,
      updatedManifest,
      auditedBy: "AnchoredSoulMutator",
      narrativeDiff: diffReport.summaryNarrative,
      timestamp: Date.now(),
      mutationId: `mut-${Date.now()}`,
    };
  }
}

