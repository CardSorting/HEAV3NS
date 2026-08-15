import type {
  IBroccoliSkillTreeSubstrate,
  SkillNodeManifest,
  SkillTreeDag,
  ISkillTreeParser,
} from "../../../core/contracts/skills.contracts.js";
import { DeterministicSkillTreeParser } from "../../../tooling/extensions/skills/deterministic-skill-tree-parser.js";

export class BroccoliSkillTreeSubstrate implements IBroccoliSkillTreeSubstrate {
  private readonly nodes = new Map<string, SkillNodeManifest>();
  private readonly parser: ISkillTreeParser;
  private cachedDag: SkillTreeDag | null = null;

  constructor(parser?: ISkillTreeParser) {
    this.parser = parser ?? new DeterministicSkillTreeParser();
  }

  initialize(initialNodes?: readonly SkillNodeManifest[]): void {
    this.clear();
    if (initialNodes) {
      for (const node of initialNodes) {
        this.saveNode(node);
      }
    }
  }

  getNode(id: string): SkillNodeManifest | undefined {
    return this.nodes.get(id.toLowerCase());
  }

  getAllNodes(): readonly SkillNodeManifest[] {
    return Array.from(this.nodes.values());
  }

  getDag(): SkillTreeDag {
    if (!this.cachedDag) {
      this.cachedDag = this.parser.buildSkillDag(Array.from(this.nodes.values()));
    }
    return this.cachedDag;
  }

  saveNode(node: SkillNodeManifest): void {
    this.nodes.set(node.id.toLowerCase(), node);
    this.cachedDag = null; // Invalidate DAG cache
  }

  recordSkillUsage(id: string, tickIndex: number): void {
    const node = this.nodes.get(id.toLowerCase());
    if (node) {
      const updated: SkillNodeManifest = {
        ...node,
        useCount: node.useCount + 1,
        lastUsedTick: tickIndex,
        lifecycleState: node.lifecycleState === "dormant" ? "active" : node.lifecycleState,
      };
      this.saveNode(updated);
    }
  }

  clear(): void {
    this.nodes.clear();
    this.cachedDag = null;
  }
}
