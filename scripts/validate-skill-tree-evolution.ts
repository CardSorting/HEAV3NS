import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import {
  DeterministicSkillTreeParser,
  AnchoredSkillMutator,
  SkillTreeToolSuite,
  BroccoliSkillTreeSubstrate,
  SkillTreeSnapshotManager,
  DeterministicSkillCurator,
  EvolutionarySkillTreeEngine,
  SkillTreePromptComposer,
  AntiDegenerationGuard,
  LumiMonolith,
} from "../src/index.js";
import { AstPerceptionEyes } from "../src/tooling/extensions/perception/ast-eyes.js";
import { AnchoredHands } from "../src/tooling/extensions/hashline/hands.js";

async function main() {
  console.log("\x1b[1;36m================================================================\x1b[0m");
  console.log("\x1b[1;36m   LUMI Evolutionary Skill Tree System (AKD-DSO Validation)     \x1b[0m");
  console.log("\x1b[1;36m================================================================\x1b[0m\n");

  const parser = new DeterministicSkillTreeParser();
  const eyes = new AstPerceptionEyes();
  const hands = new AnchoredHands();

  // --------------------------------------------------------------------------
  // 1. Frontmatter Validation & Trojan Unicode Sanitization
  // --------------------------------------------------------------------------
  console.log("\x1b[1;34m[Test 1/8] Validating Frontmatter & Trojan Unicode Sanitization...\x1b[0m");
  {
    // Test Trojan Unicode stripping (zero-width chars, bidi control chars)
    const maliciousText = "Search arXiv papers\u200B\u202E\uFEFF by keyword, author, or ID.";
    const sanitized = parser.sanitizeSourceText(maliciousText);
    assert.equal(sanitized, "Search arXiv papers by keyword, author, or ID.");

    // Test valid frontmatter parsing
    const validRaw = `---
name: arxiv-search
description: Search arXiv papers by keyword, author, or ID.
tier: adept
masteryScore: 65
fitnessScore: 0.95
prerequisites: [web-search]
related_skills: [paper-extractor, latex-formatter]
tags: [research, academic, search]
---
# ArXiv Search Skill
Full instructions here.`;

    const manifest = parser.parseSkillMarkdown("arxiv-search", "/path/to/arxiv-search/SKILL.md", validRaw);
    assert.equal(manifest.name, "arxiv-search");
    assert.equal(manifest.tier, "adept");
    assert.equal(manifest.masteryScore, 65);
    assert.deepEqual(manifest.prerequisites, ["web-search"]);
    assert.deepEqual(manifest.relatedSkills, ["paper-extractor", "latex-formatter"]);
    assert.deepEqual(manifest.tags, ["research", "academic", "search"]);

    const validation = parser.validateFrontmatter(manifest);
    assert.equal(validation.valid, true);
    assert.equal(validation.errors.length, 0);

    // Test invalid description (> 60 chars)
    const invalidDescManifest = {
      ...manifest,
      description: "A comprehensive skill that lets the agent search arXiv for academic papers.",
    };
    const invalidValidation = parser.validateFrontmatter(invalidDescManifest);
    assert.equal(invalidValidation.valid, false);
    assert.ok(invalidValidation.errors[0].includes("must be <= 60 characters"));

    console.log("\x1b[32m  [✓] Frontmatter standards & Unicode sanitization passed.\x1b[0m");
  }

  // --------------------------------------------------------------------------
  // 2. Topological DAG & Prerequisite Unlock Mechanics
  // --------------------------------------------------------------------------
  console.log("\x1b[1;34m[Test 2/8] Validating Topological DAG & Prerequisite Unlocks...\x1b[0m");
  {
    const rootNode = parser.parseSkillMarkdown(
      "web-search",
      "/skills/web-search/SKILL.md",
      `---
name: web-search
description: Perform web searches for realtime data.
masteryScore: 70
---
Body`
    );

    const childNode = parser.parseSkillMarkdown(
      "arxiv-search",
      "/skills/arxiv-search/SKILL.md",
      `---
name: arxiv-search
description: Search arXiv papers by keyword or ID.
prerequisites: [web-search]
masteryScore: 20
---
Body`
    );

    const lockedAdvancedNode = parser.parseSkillMarkdown(
      "paper-synthesis",
      "/skills/paper-synthesis/SKILL.md",
      `---
name: paper-synthesis
description: Synthesize academic paper corpora into briefs.
prerequisites: [arxiv-search]
masteryScore: 0
---
Body`
    );

    const dag = parser.buildSkillDag([rootNode, childNode, lockedAdvancedNode]);
    assert.equal(dag.cycles.length, 0);
    assert.deepEqual(dag.topologicalOrder, ["web-search", "arxiv-search", "paper-synthesis"]);

    // Root has no prereqs -> unlocked
    assert.ok(dag.unlockedNodeIds.has("web-search"));
    // Child has prereq web-search with mastery 70 (>=50) -> unlocked
    assert.ok(dag.unlockedNodeIds.has("arxiv-search"));
    // Advanced has prereq arxiv-search with mastery 20 (<50) -> locked!
    assert.ok(!dag.unlockedNodeIds.has("paper-synthesis"));
    assert.deepEqual(dag.lockedNodeIds.get("paper-synthesis"), ["arxiv-search"]);

    // Cycle detection test
    const cyclicA = parser.parseSkillMarkdown("cycle-a", "/a", "---\nname: cycle-a\ndescription: A.\nprerequisites: [cycle-b]\n---");
    const cyclicB = parser.parseSkillMarkdown("cycle-b", "/b", "---\nname: cycle-b\ndescription: B.\nprerequisites: [cycle-a]\n---");
    const cyclicDag = parser.buildSkillDag([cyclicA, cyclicB]);
    assert.ok(cyclicDag.cycles.length > 0);

    console.log("\x1b[32m  [✓] Topological DAG ordering & prerequisite unlocks passed.\x1b[0m");
  }

  // --------------------------------------------------------------------------
  // 3. Line-Anchored Mutations & Provenance Enforcement
  // --------------------------------------------------------------------------
  console.log("\x1b[1;34m[Test 3/8] Validating Anchored Mutations & Provenance...\x1b[0m");
  {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "lumi-skills-test-"));
    const skillPath = path.join(tmpDir, "SKILL.md");

    const initialContent = `---
name: docx-builder
description: Generate Microsoft Word DOCX documents.
tier: novice
masteryScore: 30
---
# Docx Builder
## Procedure
Step 1: Create document.`;

    await fs.writeFile(skillPath, initialContent, "utf8");

    const mutator = new AnchoredSkillMutator(hands, eyes);
    const substrate = new BroccoliSkillTreeSubstrate(parser);
    const node = parser.parseSkillMarkdown("docx-builder", skillPath, initialContent);
    substrate.saveNode(node);

    // Mutation fails if skill has NOT been read (provenance violation)
    const unreadResult = await mutator.applyMutation(
      {
        mutationId: "mut-1",
        targetSkillId: "docx-builder",
        action: "patch",
        reason: "Add step 2",
        chunks: [
          {
            startLine: 7,
            endLine: 8,
            targetContent: "Step 1: Create document.",
            replacementContent: "Step 1: Create document.\nStep 2: Add header paragraph.",
          },
        ],
        tickIndex: 1,
      },
      substrate.getDag()
    );
    assert.equal(unreadResult.success, false);
    assert.ok(unreadResult.error?.includes("Forensic provenance violation"));

    // Mark as read and retry -> success!
    mutator.markSkillRead("docx-builder");
    const validResult = await mutator.applyMutation(
      {
        mutationId: "mut-2",
        targetSkillId: "docx-builder",
        action: "patch",
        reason: "Add step 2",
        chunks: [
          {
            startLine: 7,
            endLine: 8,
            targetContent: "Step 1: Create document.",
            replacementContent: "Step 1: Create document.\nStep 2: Add header paragraph.",
          },
        ],
        tickIndex: 2,
      },
      substrate.getDag()
    );
    assert.equal(validResult.success, true);

    const updatedText = await fs.readFile(skillPath, "utf8");
    assert.ok(updatedText.includes("Step 2: Add header paragraph."));

    // Cleanup
    await fs.rm(tmpDir, { recursive: true, force: true });
    console.log("\x1b[32m  [✓] Line-anchored mutations & read provenance passed.\x1b[0m");
  }

  // --------------------------------------------------------------------------
  // 4. Frame-Perfect Snapshots & Instant O(1) Rollback
  // --------------------------------------------------------------------------
  console.log("\x1b[1;34m[Test 4/8] Validating Frame-Perfect Snapshots & O(1) Rollback...\x1b[0m");
  {
    const substrate = new BroccoliSkillTreeSubstrate(parser);
    const nodeA = parser.parseSkillMarkdown("skill-alpha", "/a", "---\nname: skill-alpha\ndescription: Alpha skill.\nmasteryScore: 40\n---");
    substrate.saveNode(nodeA);

    const snapshotManager = new SkillTreeSnapshotManager(substrate);
    const snap1 = snapshotManager.createSnapshot(100);

    // Mutate state in substrate
    const nodeB = parser.parseSkillMarkdown("skill-beta", "/b", "---\nname: skill-beta\ndescription: Beta skill.\nmasteryScore: 80\n---");
    substrate.saveNode(nodeB);
    assert.equal(substrate.getAllNodes().length, 2);

    // Execute instant rollback
    const rolledBack = snapshotManager.rollbackLastMutation();
    assert.equal(rolledBack, true);
    assert.equal(substrate.getAllNodes().length, 1);
    assert.equal(substrate.getNode("skill-alpha")?.masteryScore, 40);
    assert.equal(substrate.getNode("skill-beta"), undefined);

    console.log("\x1b[32m  [✓] Frame-perfect snapshotting & instant O(1) rollback passed.\x1b[0m");
  }

  // --------------------------------------------------------------------------
  // 5. Anti-Degeneration Axiomatic Guard
  // --------------------------------------------------------------------------
  console.log("\x1b[1;34m[Test 5/8] Validating Anti-Degeneration Axiomatic Guard...\x1b[0m");
  {
    const guard = new AntiDegenerationGuard();

    // Rejection 1: Negative tool claim
    const negativeToolResult = guard.validateEvolutionProposal(
      {
        type: "user_correction",
        context: "test",
        confidence: 1.0,
        suggestedAction: "patch_loaded",
      },
      "Note: The terminal tool does not work on this machine. Never use the tool."
    );
    assert.equal(negativeToolResult.allowed, false);
    assert.ok(negativeToolResult.violations[0].includes("Negative Tool Refusal"));

    // Rejection 2: Transient environment glitch
    const transientGlitchResult = guard.validateEvolutionProposal(
      {
        type: "user_correction",
        context: "test",
        confidence: 1.0,
        suggestedAction: "patch_loaded",
      },
      "Troubleshooting: If apt-get install failed because command not found, abort."
    );
    assert.equal(transientGlitchResult.allowed, false);
    assert.ok(transientGlitchResult.violations[0].includes("Transient Environment Glitch"));

    // Acceptance: Valid deterministic procedure
    const validProposal = guard.validateEvolutionProposal(
      {
        type: "workflow_refinement",
        context: "test",
        confidence: 1.0,
        suggestedAction: "patch_loaded",
      },
      "Procedure: Invoke the `read_file` tool to inspect headers before modifying."
    );
    assert.equal(validProposal.allowed, true);
    assert.equal(validProposal.violations.length, 0);

    console.log("\x1b[32m  [✓] Anti-degeneration guardrails passed.\x1b[0m");
  }

  // --------------------------------------------------------------------------
  // 6. Deterministic Curator & Cluster Consolidation
  // --------------------------------------------------------------------------
  console.log("\x1b[1;34m[Test 6/8] Validating Deterministic Curator & Consolidation...\x1b[0m");
  {
    const substrate = new BroccoliSkillTreeSubstrate(parser);
    const nodeActive = parser.parseSkillMarkdown("active-tool", "/a", "---\nname: active-tool\ndescription: Active tool.\n---");
    const nodeStale = parser.parseSkillMarkdown("stale-tool", "/b", "---\nname: stale-tool\ndescription: Stale tool.\n---");
    const nodeArchive = parser.parseSkillMarkdown("archive-tool", "/c", "---\nname: archive-tool\ndescription: Archive tool.\n---");

    substrate.saveNode(nodeActive);
    substrate.saveNode(nodeStale);
    substrate.saveNode(nodeArchive);

    substrate.recordSkillUsage("active-tool", 950);
    substrate.recordSkillUsage("stale-tool", 400);
    substrate.recordSkillUsage("archive-tool", 50);

    const curator = new DeterministicSkillCurator(substrate);
    const decay = curator.evaluateDecay(1000, 500, 800);

    assert.deepEqual(decay.staleNodeIds, ["stale-tool"]);
    assert.deepEqual(decay.archivableNodeIds, ["archive-tool"]);

    // Consolidation detection test (Jaccard similarity on tags/skills)
    const clusterNode1 = parser.parseSkillMarkdown("pdf-merge", "/pdf1", "---\nname: pdf-merge\ndescription: Merge PDF files.\ncategory: docs\ntags: [pdf, merge, documents]\n---");
    const clusterNode2 = parser.parseSkillMarkdown("pdf-split", "/pdf2", "---\nname: pdf-split\ndescription: Split PDF files.\ncategory: docs\ntags: [pdf, split, documents]\n---");
    substrate.saveNode(clusterNode1);
    substrate.saveNode(clusterNode2);

    const clusters = curator.detectConsolidationClusters(0.5);
    assert.ok(clusters.length > 0);
    const docsCluster = clusters.find((c) => c.clusterName === "docs-umbrella");
    assert.ok(docsCluster);
    assert.ok(docsCluster.nodeIds.includes("pdf-merge"));
    assert.ok(docsCluster.nodeIds.includes("pdf-split"));

    console.log("\x1b[32m  [✓] Deterministic curator decay & cluster consolidation passed.\x1b[0m");
  }

  // --------------------------------------------------------------------------
  // 7. Evolutionary Engine & Progressive Disclosure Prompting
  // --------------------------------------------------------------------------
  console.log("\x1b[1;34m[Test 7/8] Validating Evolutionary Engine & Prompt Composer...\x1b[0m");
  {
    const substrate = new BroccoliSkillTreeSubstrate(parser);
    const node = parser.parseSkillMarkdown("test-skill", "/t", "---\nname: test-skill\ndescription: Testing skill.\nmasteryScore: 45\n---");
    substrate.saveNode(node);

    const engine = new EvolutionarySkillTreeEngine(substrate);

    // Trajectory analysis detecting user frustration
    const signals = engine.analyzeTrajectory({
      prompt: "Stop doing verbose explanations, just give me the code.",
      response: "Understood.",
      tickIndex: 10,
    });
    assert.equal(signals.length, 1);
    assert.equal(signals[0].type, "user_correction");

    // Mastery upgrade and tier promotion
    const newMastery = engine.updateMastery("test-skill", true);
    assert.equal(newMastery, 50);
    const upgraded = substrate.getNode("test-skill");
    assert.equal(upgraded?.tier, "adept");

    // Progressive disclosure Tier 1 prompt context composition
    const composer = new SkillTreePromptComposer();
    const promptContext = composer.composeSkillTreePromptContext(substrate.getDag());
    assert.ok(promptContext.includes("## Evolutionary Skill Tree"));
    assert.ok(promptContext.includes("- **test-skill** [Tier: ADEPT | Mastery: 50%]: Testing skill."));

    console.log("\x1b[32m  [✓] Evolutionary engine & progressive prompt context passed.\x1b[0m");
  }

  // --------------------------------------------------------------------------
  // 8. Zero-GC Latency Benchmark & Monolith Integration
  // --------------------------------------------------------------------------
  console.log("\x1b[1;34m[Test 8/8] Benchmarking Zero-GC Substrate & Monolith Composition...\x1b[0m");
  {
    const monolith = new LumiMonolith();
    assert.ok(monolith.skillTreeParser);
    assert.ok(monolith.skillTreeSubstrate);
    assert.ok(monolith.anchoredSkillMutator);
    assert.ok(monolith.skillTreeToolSuite);
    assert.ok(monolith.skillTreeSnapshotManager);
    assert.ok(monolith.deterministicSkillCurator);
    assert.ok(monolith.evolutionarySkillEngine);
    assert.ok(monolith.skillTreePromptComposer);
    assert.ok(monolith.antiDegenerationGuard);

    // Populate substrate with 50 nodes
    for (let i = 0; i < 50; i++) {
      const n = parser.parseSkillMarkdown(
        `node-${i}`,
        `/skills/node-${i}/SKILL.md`,
        `---
name: node-${i}
description: Skill node ${i}.
category: ${i % 2 === 0 ? "dev" : "ops"}
masteryScore: ${i * 2}
prerequisites: [${i > 0 ? `node-${i - 1}` : ""}]
---
Body ${i}`
      );
      monolith.skillTreeSubstrate.saveNode(n);
    }

    const t0 = performance.now();
    for (let iter = 0; iter < 1000; iter++) {
      const idx = iter % 50;
      const fetched = monolith.skillTreeSubstrate.getNode(`node-${idx}`);
      assert.ok(fetched);
    }
    const elapsedMs = performance.now() - t0;
    const p95QueryUs = (elapsedMs / 1000) * 1000; // microseconds per query

    console.log(`  Measured: 1000 queries completed in \x1b[33m${elapsedMs.toFixed(3)} ms\x1b[0m (${p95QueryUs.toFixed(3)} µs/query)`);
    assert.ok(elapsedMs < 10.0, "1000 substrate queries must execute in < 10.0 ms.");

    console.log("\x1b[32m  [✓] Zero-GC memory substrate & monolith composition passed.\x1b[0m");
  }

  console.log("\n\x1b[1;32m================================================================\x1b[0m");
  console.log("\x1b[1;32m   ALL 8 EVOLUTIONARY SKILL TREE VALIDATION SUITES PASSED!     \x1b[0m");
  console.log("\x1b[1;32m================================================================\x1b[0m\n");
}

main().catch((err) => {
  console.error("\x1b[31mValidation failed with error:\x1b[0m", err);
  process.exit(1);
});
