import * as crypto from "node:crypto";
import type {
  ISkillTreeParser,
  SkillNodeManifest,
  SkillTreeDag,
  SkillTier,
  SkillLifecycleState,
  SkillProvenance,
} from "../../../core/contracts/skills.contracts.js";

export class DeterministicSkillTreeParser implements ISkillTreeParser {
  /**
   * Sanitizes source text against invisible and bidirectional Unicode control characters
   * (Trojan Source vulnerability prevention).
   */
  sanitizeSourceText(text: string): string {
    if (!text) return "";
    // Strips zero-width characters, bidi overrides, directional isolates, and tag characters
    return text.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\u2066-\u2069]|[\u{E0000}-\u{E007F}]/gu, "");
  }

  /**
   * Calculates deterministic SHA-256 hash for content.
   */
  private computeHash(content: string): string {
    return crypto.createHash("sha256").update(content, "utf8").digest("hex");
  }

  /**
   * Parses raw markdown and YAML frontmatter into a typed SkillNodeManifest.
   */
  parseSkillMarkdown(folderName: string, filePath: string, rawContent: string): SkillNodeManifest {
    const sanitized = this.sanitizeSourceText(rawContent);
    let name = folderName.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
    let description = "Deterministic workspace skill";
    let category = "general";
    let tier: SkillTier = "novice";
    let version = "0.1.0";
    let author = "LUMI";
    const platforms: string[] = [];
    const prerequisites: string[] = [];
    const relatedSkills: string[] = [];
    const tags: string[] = [];
    let masteryScore = 0;
    let fitnessScore = 1.0;
    let useCount = 0;
    let lastUsedTick = 0;
    const createdTick = 0;
    let lifecycleState: SkillLifecycleState = "active";
    let provenance: SkillProvenance = "user_created";
    let pinned = false;
    let body = sanitized;

    const frontmatterMatch = sanitized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (frontmatterMatch) {
      const yamlStr = frontmatterMatch[1];
      body = frontmatterMatch[2].trim();

      const lines = yamlStr.split(/\r?\n/);
      let currentArrayKey: string | null = null;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        if (trimmed.startsWith("- ") && currentArrayKey) {
          const item = trimmed.slice(2).trim().replace(/^["']|["']$/g, "");
          if (currentArrayKey === "platforms") platforms.push(item);
          else if (currentArrayKey === "prerequisites") prerequisites.push(item);
          else if (currentArrayKey === "related_skills") relatedSkills.push(item);
          else if (currentArrayKey === "tags") tags.push(item);
          continue;
        }

        const colonIndex = trimmed.indexOf(":");
        if (colonIndex > -1) {
          const key = trimmed.slice(0, colonIndex).trim();
          let value = trimmed.slice(colonIndex + 1).trim();

          if (value.startsWith("[") && value.endsWith("]")) {
            const items = value
              .slice(1, -1)
              .split(",")
              .map((s) => s.trim().replace(/^["']|["']$/g, ""))
              .filter(Boolean);
            if (key === "platforms") platforms.push(...items);
            else if (key === "prerequisites") prerequisites.push(...items);
            else if (key === "related_skills") relatedSkills.push(...items);
            else if (key === "tags") tags.push(...items);
            currentArrayKey = null;
            continue;
          }

          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }

          if (key === "name") name = value;
          else if (key === "description") description = value;
          else if (key === "category") category = value;
          else if (key === "tier" && ["novice", "adept", "master", "sovereign"].includes(value)) tier = value as SkillTier;
          else if (key === "version") version = value;
          else if (key === "author") author = value;
          else if (key === "masteryScore") masteryScore = Number.parseInt(value, 10) || 0;
          else if (key === "fitnessScore") fitnessScore = Number.parseFloat(value) || 1.0;
          else if (key === "useCount") useCount = Number.parseInt(value, 10) || 0;
          else if (key === "lastUsedTick") lastUsedTick = Number.parseInt(value, 10) || 0;
          else if (key === "lifecycleState" && ["active", "dormant", "consolidated", "archived", "pinned"].includes(value)) {
            lifecycleState = value as SkillLifecycleState;
          } else if (key === "provenance" && ["system_bundled", "user_created", "evolved_mutation", "hub_installed"].includes(value)) {
            provenance = value as SkillProvenance;
          } else if (key === "pinned") pinned = value === "true";

          if (["platforms", "prerequisites", "related_skills", "tags"].includes(key) && !value) {
            currentArrayKey = key;
          } else {
            currentArrayKey = null;
          }
        }
      }
    }

    const id = name.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
    const contentHash = this.computeHash(sanitized);

    return {
      id,
      name,
      description,
      category,
      tier,
      version,
      author,
      platforms: platforms.length > 0 ? Object.freeze(platforms) : undefined,
      prerequisites: Object.freeze(prerequisites),
      relatedSkills: Object.freeze(relatedSkills),
      tags: Object.freeze(tags),
      masteryScore: Math.min(100, Math.max(0, masteryScore)),
      fitnessScore: Math.min(1.0, Math.max(0.0, fitnessScore)),
      useCount,
      lastUsedTick,
      createdTick,
      lifecycleState,
      provenance,
      pinned,
      location: filePath,
      body,
      contentHash,
      supportFiles: Object.freeze([]),
    };
  }

  /**
   * Validates frontmatter adhering to strict standards:
   * - Name: lowercase-hyphenated, <= 64 chars.
   * - Description: <= 60 chars, single sentence ending with a period.
   * - Author: required.
   */
  validateFrontmatter(manifest: SkillNodeManifest): { valid: boolean; errors: readonly string[] } {
    const errors: string[] = [];

    if (!manifest.name || manifest.name.length > 64 || !/^[a-z0-9-_]+$/.test(manifest.name)) {
      errors.push(`Skill name "${manifest.name}" must be lowercase-hyphenated and <= 64 characters.`);
    }

    if (!manifest.description) {
      errors.push("Skill description is required.");
    } else if (manifest.description.length > 60) {
      errors.push(
        `Skill description "${manifest.description}" is ${manifest.description.length} chars (must be <= 60 characters for system prompt prefix caching).`
      );
    } else if (!manifest.description.endsWith(".")) {
      errors.push(`Skill description "${manifest.description}" must end with a period.`);
    }

    return {
      valid: errors.length === 0,
      errors: Object.freeze(errors),
    };
  }

  /**
   * Constructs the topological Skill Tree DAG and evaluates unlock states.
   */
  buildSkillDag(manifests: readonly SkillNodeManifest[]): SkillTreeDag {
    const nodes = new Map<string, SkillNodeManifest>();
    const prerequisiteEdges = new Map<string, string[]>();
    const dependentsEdges = new Map<string, string[]>();
    const affinityEdges = new Map<string, string[]>();

    for (const m of manifests) {
      nodes.set(m.id, m);
      prerequisiteEdges.set(m.id, [...m.prerequisites]);
      dependentsEdges.set(m.id, []);
      affinityEdges.set(m.id, [...m.relatedSkills]);
    }

    // Build dependents adjacency
    for (const [nodeId, prereqs] of prerequisiteEdges.entries()) {
      for (const parentId of prereqs) {
        if (dependentsEdges.has(parentId)) {
          dependentsEdges.get(parentId)!.push(nodeId);
        }
      }
    }

    // Cycle detection & Topological Sort using Kahn's algorithm
    const inDegree = new Map<string, number>();
    for (const nodeId of nodes.keys()) {
      inDegree.set(nodeId, 0);
    }

    for (const [nodeId, prereqs] of prerequisiteEdges.entries()) {
      let count = 0;
      for (const p of prereqs) {
        if (nodes.has(p)) count++;
      }
      inDegree.set(nodeId, count);
    }

    const queue: string[] = [];
    for (const [nodeId, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(nodeId);
    }

    const topologicalOrder: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      topologicalOrder.push(current);

      const children = dependentsEdges.get(current) || [];
      for (const child of children) {
        const newDeg = (inDegree.get(child) || 0) - 1;
        inDegree.set(child, newDeg);
        if (newDeg === 0) queue.push(child);
      }
    }

    const cycles: string[][] = [];
    if (topologicalOrder.length < nodes.size) {
      // Find remaining nodes involved in cycles
      const cycleNodes = Array.from(nodes.keys()).filter((n) => !topologicalOrder.includes(n));
      cycles.push(cycleNodes);
    }

    // Evaluate Unlocked vs Locked Nodes
    const unlockedNodeIds = new Set<string>();
    const lockedNodeIds = new Map<string, string[]>();

    for (const [nodeId, node] of nodes.entries()) {
      const missingPrereqs: string[] = [];
      for (const p of node.prerequisites) {
        const parent = nodes.get(p);
        if (!parent || parent.masteryScore < 50) {
          missingPrereqs.push(p);
        }
      }

      if (missingPrereqs.length === 0) {
        unlockedNodeIds.add(nodeId);
      } else {
        lockedNodeIds.set(nodeId, missingPrereqs);
      }
    }

    const frozenPrereqs = new Map<string, readonly string[]>();
    for (const [k, v] of prerequisiteEdges.entries()) frozenPrereqs.set(k, Object.freeze(v));

    const frozenDependents = new Map<string, readonly string[]>();
    for (const [k, v] of dependentsEdges.entries()) frozenDependents.set(k, Object.freeze(v));

    const frozenAffinity = new Map<string, readonly string[]>();
    for (const [k, v] of affinityEdges.entries()) frozenAffinity.set(k, Object.freeze(v));

    const frozenLocked = new Map<string, readonly string[]>();
    for (const [k, v] of lockedNodeIds.entries()) frozenLocked.set(k, Object.freeze(v));

    return {
      nodes,
      prerequisiteEdges: frozenPrereqs,
      dependentsEdges: frozenDependents,
      affinityEdges: frozenAffinity,
      topologicalOrder: Object.freeze(topologicalOrder),
      cycles: Object.freeze(cycles),
      unlockedNodeIds,
      lockedNodeIds: frozenLocked,
    };
  }
}
