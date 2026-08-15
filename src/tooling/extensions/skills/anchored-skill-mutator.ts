import * as crypto from "node:crypto";
import type { AnchoredHands } from "../hashline/hands.js";
import type { Eyes } from "../../base/eyes.js";
import type {
  IAnchoredSkillMutator,
  SkillMutationPayload,
  SkillMutationResult,
  SkillTreeDag,
  SkillNodeManifest,
  SkillSupportFile,
} from "../../../core/contracts/skills.contracts.js";

export class AnchoredSkillMutator implements IAnchoredSkillMutator {
  private readonly hands: AnchoredHands;
  private readonly eyes: Eyes;
  private readonly readSkillIds = new Set<string>();

  constructor(hands: AnchoredHands, eyes: Eyes) {
    this.hands = hands;
    this.eyes = eyes;
  }

  markSkillRead(skillId: string): void {
    this.readSkillIds.add(skillId.toLowerCase());
  }

  verifyProvenanceRead(skillId: string): boolean {
    return this.readSkillIds.has(skillId.toLowerCase());
  }

  private computeHash(content: string): string {
    return crypto.createHash("sha256").update(content, "utf8").digest("hex");
  }

  async applyMutation(payload: SkillMutationPayload, currentDag: SkillTreeDag): Promise<SkillMutationResult> {
    const timestamp = Date.now();
    const skillId = payload.targetSkillId.toLowerCase();

    // 1. Create Action
    if (payload.action === "create") {
      if (!payload.newNode || !payload.newNode.name || !payload.newNode.location) {
        return {
          mutationId: payload.mutationId,
          success: false,
          skillId,
          error: "Create mutation requires newNode with name and location.",
          timestamp,
        };
      }

      const location = payload.newNode.location;
      const body = payload.newNode.body || "";
      const frontmatter = [
        "---",
        `name: ${payload.newNode.name}`,
        `description: ${payload.newNode.description || "Evolved workspace skill."}`,
        `tier: ${payload.newNode.tier || "novice"}`,
        `version: ${payload.newNode.version || "0.1.0"}`,
        `author: ${payload.newNode.author || "LUMI"}`,
        `masteryScore: ${payload.newNode.masteryScore ?? 0}`,
        `fitnessScore: ${payload.newNode.fitnessScore ?? 1.0}`,
        `lifecycleState: ${payload.newNode.lifecycleState || "active"}`,
        `provenance: evolved_mutation`,
        `prerequisites: [${(payload.newNode.prerequisites || []).join(", ")}]`,
        `related_skills: [${(payload.newNode.relatedSkills || []).join(", ")}]`,
        `tags: [${(payload.newNode.tags || []).join(", ")}]`,
        "---",
        "",
        body,
      ].join("\n");

      await this.hands.writeFile(location, frontmatter);
      this.markSkillRead(skillId);

      return {
        mutationId: payload.mutationId,
        success: true,
        skillId,
        newHash: this.computeHash(frontmatter),
        timestamp,
      };
    }

    // 2. Existing Node Mutations Require Read-Before-Write Provenance
    const existingNode = currentDag.nodes.get(skillId);
    if (!existingNode) {
      return {
        mutationId: payload.mutationId,
        success: false,
        skillId,
        error: `Target skill "${skillId}" not found in Skill DAG.`,
        timestamp,
      };
    }

    if (!this.verifyProvenanceRead(skillId)) {
      return {
        mutationId: payload.mutationId,
        success: false,
        skillId,
        error: `Forensic provenance violation: Skill "${skillId}" must be read prior to applying mutations.`,
        timestamp,
      };
    }

    if (existingNode.pinned) {
      return {
        mutationId: payload.mutationId,
        success: false,
        skillId,
        error: `Skill "${skillId}" is pinned and protected against autonomous mutations.`,
        timestamp,
      };
    }

    const previousHash = existingNode.contentHash;

    // 3. Patch Action (Line-anchored chunk edits)
    if (payload.action === "patch") {
      if (!payload.chunks || payload.chunks.length === 0) {
        return {
          mutationId: payload.mutationId,
          success: false,
          skillId,
          error: "Patch action requires at least one SkillMutationChunk.",
          timestamp,
        };
      }

      const fileResult = await this.eyes.readFile(existingNode.location);
      let content = fileResult.content;

      for (const chunk of payload.chunks) {
        if (!content.includes(chunk.targetContent)) {
          return {
            mutationId: payload.mutationId,
            success: false,
            skillId,
            error: `Anchored chunk target content not found in ${existingNode.location}.`,
            previousHash,
            timestamp,
          };
        }
        content = content.replace(chunk.targetContent, chunk.replacementContent);
      }

      await this.hands.writeFile(existingNode.location, content);
      const newHash = this.computeHash(content);

      return {
        mutationId: payload.mutationId,
        success: true,
        skillId,
        previousHash,
        newHash,
        timestamp,
      };
    }

    // 4. Add Support File Action
    if (payload.action === "add_support_file") {
      if (!payload.supportFile) {
        return {
          mutationId: payload.mutationId,
          success: false,
          skillId,
          error: "add_support_file action requires supportFile payload.",
          timestamp,
        };
      }

      const basePath = existingNode.location.replace(/SKILL\.md$/, "");
      const fullPath = `${basePath}${payload.supportFile.relativePath}`;
      await this.hands.writeFile(fullPath, payload.supportFile.content);

      return {
        mutationId: payload.mutationId,
        success: true,
        skillId,
        previousHash,
        newHash: previousHash,
        timestamp,
      };
    }

    // 5. Rewrite Action
    if (payload.action === "rewrite") {
      if (!payload.newNode || !payload.newNode.body) {
        return {
          mutationId: payload.mutationId,
          success: false,
          skillId,
          error: "Rewrite action requires newNode body.",
          timestamp,
        };
      }

      const frontmatter = [
        "---",
        `name: ${payload.newNode.name || existingNode.name}`,
        `description: ${payload.newNode.description || existingNode.description}`,
        `tier: ${payload.newNode.tier || existingNode.tier}`,
        `version: ${payload.newNode.version || existingNode.version}`,
        `author: ${payload.newNode.author || existingNode.author}`,
        `masteryScore: ${payload.newNode.masteryScore ?? existingNode.masteryScore}`,
        `fitnessScore: ${payload.newNode.fitnessScore ?? existingNode.fitnessScore}`,
        `lifecycleState: ${payload.newNode.lifecycleState || existingNode.lifecycleState}`,
        `provenance: evolved_mutation`,
        `prerequisites: [${(payload.newNode.prerequisites || existingNode.prerequisites).join(", ")}]`,
        `related_skills: [${(payload.newNode.relatedSkills || existingNode.relatedSkills).join(", ")}]`,
        `tags: [${(payload.newNode.tags || existingNode.tags).join(", ")}]`,
        "---",
        "",
        payload.newNode.body,
      ].join("\n");

      await this.hands.writeFile(existingNode.location, frontmatter);
      const newHash = this.computeHash(frontmatter);

      return {
        mutationId: payload.mutationId,
        success: true,
        skillId,
        previousHash,
        newHash,
        timestamp,
      };
    }

    return {
      mutationId: payload.mutationId,
      success: false,
      skillId,
      error: `Unsupported mutation action: ${payload.action}`,
      timestamp,
    };
  }
}
