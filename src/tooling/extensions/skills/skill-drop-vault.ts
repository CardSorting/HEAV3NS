/**
 * SkillDropVault.
 * Formalized under ADR-014 (AKD-DSO Osmosis Paradigm) & SKILL-001.
 *
 * Dedicated Drag-and-Drop Skill Directory Ingestion & Export Engine.
 * Enables zero-command, drag-and-drop skill management in a dedicated directory (skills/).
 *
 * Automatically detects file & directory formats:
 * - Skill Markdown Directories / Files (skills/<id>/SKILL.md, *.skill.md, *.md)
 * - OpenAI Function & Tool Schemas (*.tool.json, *.json)
 * - Anthropic Tool Specs (*.claude.xml, *.tool.xml)
 * - JSON-LD Skill Definitions (*.skill.jsonld)
 * - Declarative YAML Workflows (*.skill.yaml, *.skill.yml)
 * - Standalone Executable Scripts (*.ts, *.js, *.py)
 * - Raw Natural Language Prompts (*.txt, *.prompt)
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  IBroccoliSkillTreeSubstrate,
  SkillDirectorySyncReport,
  SkillDroppedFileEntry,
  SkillDropVaultStatus,
  SkillFormatExportKind,
  SkillImportResult,
  SkillNodeManifest,
} from "../../../core/contracts/skills.contracts.js";
import { DeterministicSkillTreeParser } from "./deterministic-skill-tree-parser.js";
import { SkillCustomForgeEngine } from "./skill-custom-forge-engine.js";

export class SkillDropVault {
  private defaultDirectory: string;
  private readonly parser: DeterministicSkillTreeParser;
  private readonly forgeEngine: SkillCustomForgeEngine;
  private readonly supportedExtensions = [".md", ".json", ".xml", ".txt", ".yaml", ".yml", ".jsonld", ".ts", ".js", ".py"];

  constructor(
    defaultDirectory?: string,
    parser = new DeterministicSkillTreeParser(),
    forgeEngine?: SkillCustomForgeEngine
  ) {
    if (defaultDirectory) {
      this.defaultDirectory = defaultDirectory;
    } else {
      const visibleSkillsDir = path.join(process.cwd(), "skills");
      const hiddenSkillsDir = path.join(process.cwd(), ".lumi", "skills");
      if (fs.existsSync(hiddenSkillsDir) && !fs.existsSync(visibleSkillsDir)) {
        this.defaultDirectory = hiddenSkillsDir;
      } else {
        this.defaultDirectory = visibleSkillsDir;
      }
    }
    this.parser = parser;
    this.forgeEngine = forgeEngine ?? new SkillCustomForgeEngine(parser);

    try {
      this.ensureDirectoryStructure();
    } catch {
      // Non-blocking
    }
  }

  public getDirectoryPath(): string {
    return this.defaultDirectory;
  }

  public setDirectoryPath(newPath: string): void {
    this.defaultDirectory = newPath;
    try {
      this.ensureDirectoryStructure(newPath);
    } catch {
      // Non-blocking
    }
  }

  /**
   * Ensures the dedicated `skills/` directory and starter templates exist.
   */
  public ensureDirectoryStructure(customPath?: string): string {
    const dir = customPath || this.defaultDirectory;
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const templatesDir = path.join(dir, "templates");
      if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
      }
      this.seedStarterTemplates(dir);
      this.seedVaultReadme(dir);
    } catch {
      // Non-blocking
    }
    return dir;
  }

  /**
   * Seeds an instructional README in the drop folder explaining drag-and-drop usage.
   */
  public seedVaultReadme(customPath?: string): void {
    const dir = customPath || this.defaultDirectory;
    const readmePath = path.join(dir, "README.md");
    try {
      if (!fs.existsSync(readmePath)) {
        const content = `# ⚡ LUMI Skill Drop Vault (\`skills/\`)

Welcome to the **Skill Drop Vault**! You can install, customize, or create new skills simply by **dragging and dropping** folders or files into this directory.

## 🚀 Supported Skill Formats (Zero Configuration)

1. **Skill Folder or Markdown**:
   - \`skills/my-skill/SKILL.md\` (Standard LUMI / Antigravity skill structure)
   - \`my-skill.skill.md\` or \`my-skill.md\`
2. **OpenAI Tool & Function Schema**:
   - \`my-tool.json\` or \`my-tool.tool.json\`
3. **Anthropic Tool Spec**:
   - \`my-tool.claude.xml\`
4. **Declarative Workflow**:
   - \`my-pipeline.skill.yaml\`
5. **Standalone Scripts**:
   - \`audit-script.ts\`, \`helper.py\`
6. **Plain English Prompt**:
   - \`my-workflow.txt\` *(Describes what you want in plain text — auto-synthesizes a complete skill!)*

## 📂 Quick Templates

Look in the \`templates/\` directory for pre-built starter templates:
- \`templates/starter-skill/SKILL.md\` (Standard Skill Tree node)
- \`templates/starter-tool.json\` (OpenAI function calling schema)
- \`templates/starter-workflow.yaml\` (Declarative multi-step pipeline)
`;
        fs.writeFileSync(readmePath, content, "utf8");
      }
    } catch {
      // Non-blocking
    }
  }

  /**
   * Seeds starter template files so users can quickly duplicate, tweak, or drag in new skills.
   */
  public seedStarterTemplates(customPath?: string): void {
    const dir = customPath || this.defaultDirectory;
    const templatesDir = path.join(dir, "templates");

    try {
      const templateSkillDir = path.join(templatesDir, "starter-skill");
      if (!fs.existsSync(templateSkillDir)) {
        fs.mkdirSync(templateSkillDir, { recursive: true });
      }
      const templateSkillMd = path.join(templateSkillDir, "SKILL.md");
      if (!fs.existsSync(templateSkillMd)) {
        const content = `---
name: starter-skill
description: "Foundational skill template demonstrating procedural steps and safety guardrails."
category: workflow
tier: novice
version: 1.0.0
---

# Starter Skill Guide

Use this template to define structured capabilities for your agent.

## 📋 Execution Protocol
1. **Prepare**: Validate input parameters and prerequisites.
2. **Execute**: Carry out step-by-step actions.
3. **Verify**: Assert output state and report metrics.

## 🛡️ Operational Guardrails
- Assert all input invariants before applying changes.
- Handle exceptions gracefully with clear error context.
`;
        fs.writeFileSync(templateSkillMd, content, "utf8");
      }

      const templateToolJson = path.join(templatesDir, "starter-tool.json");
      if (!fs.existsSync(templateToolJson)) {
        const toolJson = JSON.stringify(
          {
            name: "execute_diagnostics",
            description: "Run diagnostic assertions against project state.",
            parameters: {
              type: "object",
              properties: {
                targetPath: { type: "string", description: "Path to inspect" },
                deepAudit: { type: "boolean", description: "Enable deep recursive audit" },
              },
              required: ["targetPath"],
            },
          },
          null,
          2
        );
        fs.writeFileSync(templateToolJson, toolJson, "utf8");
      }
    } catch {
      // Non-blocking
    }
  }

  /**
   * Automatically detects the skill format based on content analysis and filename extension.
   */
  public detectFileFormat(content: string, filename: string): SkillFormatExportKind | "unknown_text" | "script_code" {
    const trimmed = content.trim();
    const ext = path.extname(filename).toLowerCase();

    // 1. Script Code
    if (ext === ".ts" || ext === ".js" || ext === ".py") {
      return "script_code";
    }

    // 2. Markdown with YAML Frontmatter
    if (trimmed.startsWith("---") && (ext === ".md" || ext === ".skill" || filename.toLowerCase() === "skill.md")) {
      return "skill_markdown";
    }

    // 3. JSON-based formats
    if (trimmed.startsWith("{") || ext === ".json" || ext === ".jsonld") {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed["@context"] || parsed["@type"] === "Skill") {
          return "json_ld_skill";
        }
        if (parsed.type === "function" || parsed.function !== undefined || parsed.parameters !== undefined) {
          return "openai_tool_schema";
        }
        if (parsed.input_schema !== undefined) {
          return "anthropic_tool_spec";
        }
        if (parsed.category !== undefined && parsed.tier !== undefined) {
          return "skill_markdown"; // Canonical JSON manifest
        }
      } catch {
        // Fallthrough
      }
    }

    // 4. XML format
    if ((trimmed.startsWith("<") || ext === ".xml") && (trimmed.includes("<tool_description>") || trimmed.includes("<agent_skill>"))) {
      return "anthropic_tool_spec";
    }

    // 5. Declarative YAML
    if ((ext === ".yaml" || ext === ".yml") && (trimmed.includes("steps:") || trimmed.includes("actions:") || trimmed.includes("name:"))) {
      return "declarative_yaml";
    }

    // 6. Default to markdown if it's an .md file
    if (ext === ".md") {
      return "skill_markdown";
    }

    return "unknown_text";
  }

  public extractBaseName(filename: string): string {
    return filename
      .replace(/\.(skill|tool|workflow|agent)\.[a-z0-9]+$/i, "")
      .replace(/\.[a-z0-9]+$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-");
  }

  public extractSkillId(filename: string): string {
    return `drop-${this.extractBaseName(filename)}`;
  }

  /**
   * Scans the dedicated `skills/` directory, detects dropped skill folders & files,
   * parses them, and ingests them into the active substrate DAG.
   */
  public syncFromDirectory(substrate: IBroccoliSkillTreeSubstrate, customPath?: string): SkillDirectorySyncReport {
    const dir = this.ensureDirectoryStructure(customPath);
    const droppedFiles: SkillDroppedFileEntry[] = [];
    const loadedSkillIds: string[] = [];

    if (!fs.existsSync(dir)) {
      return {
        directoryPath: dir,
        isInitialized: false,
        filesScanned: 0,
        loadedCount: 0,
        failedCount: 0,
        droppedFiles: [],
        loadedSkillIds: [],
        syncTimestamp: Date.now(),
      };
    }

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.toLowerCase() === "templates" || entry.name.toLowerCase() === "readme.md" || entry.name.startsWith(".")) {
          continue; // Skip templates, readmes, and dotfiles
        }

        const fullPath = path.join(dir, entry.name);

        // Case A: Skill directory containing SKILL.md
        if (entry.isDirectory()) {
          const skillMdPath = path.join(fullPath, "SKILL.md");
          if (fs.existsSync(skillMdPath)) {
            const rawContent = fs.readFileSync(skillMdPath, "utf8");
            const stats = fs.statSync(skillMdPath);
            const skillId = `drop-${entry.name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}`;

            const manifest = this.parseSkillContent(rawContent, "skill_markdown", skillId, entry.name);
            substrate.saveNode(manifest);
            loadedSkillIds.push(skillId);

            droppedFiles.push({
              filename: entry.name,
              fullPath: skillMdPath,
              formatDetected: "skill_markdown",
              skillId,
              sizeBytes: stats.size,
              lastModified: stats.mtimeMs,
              isValid: true,
              skillName: manifest.name,
              tier: manifest.tier,
              category: manifest.category,
            });
          }
          continue;
        }

        // Case B: Standalone dropped file
        const ext = path.extname(entry.name).toLowerCase();
        if (!this.supportedExtensions.includes(ext)) continue;

        const stats = fs.statSync(fullPath);
        const rawContent = fs.readFileSync(fullPath, "utf8");
        const detectedFormat = this.detectFileFormat(rawContent, entry.name);
        const skillId = this.extractSkillId(entry.name);
        const baseName = this.extractBaseName(entry.name);

        let manifest: SkillNodeManifest;
        if (detectedFormat === "unknown_text") {
          manifest = this.forgeEngine.synthesizeFromPrompt(rawContent, {
            name: baseName,
            targetSkillId: skillId,
          });
        } else {
          manifest = this.parseSkillContent(rawContent, detectedFormat as SkillFormatExportKind, skillId, baseName);
        }

        substrate.saveNode(manifest);
        loadedSkillIds.push(skillId);

        droppedFiles.push({
          filename: entry.name,
          fullPath,
          formatDetected: detectedFormat,
          skillId,
          sizeBytes: stats.size,
          lastModified: stats.mtimeMs,
          isValid: true,
          skillName: manifest.name,
          tier: manifest.tier,
          category: manifest.category,
        });
      }
    } catch {
      // Non-blocking
    }

    const loadedCount = droppedFiles.filter((f) => f.isValid).length;
    const failedCount = droppedFiles.filter((f) => !f.isValid).length;

    return {
      directoryPath: dir,
      isInitialized: true,
      filesScanned: droppedFiles.length,
      loadedCount,
      failedCount,
      droppedFiles: Object.freeze(droppedFiles),
      loadedSkillIds: Object.freeze(loadedSkillIds),
      syncTimestamp: Date.now(),
    };
  }

  /**
   * Ingests a single dropped file path into the active skill tree substrate.
   */
  public ingestDroppedFile(substrate: IBroccoliSkillTreeSubstrate, filePath: string): SkillImportResult {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        sourceFormat: "skill_markdown",
        warnings: [],
        error: `Dropped skill file '${filePath}' does not exist on filesystem`,
      };
    }

    try {
      const filename = path.basename(filePath);
      const rawContent = fs.readFileSync(filePath, "utf8");
      const detectedFormat = this.detectFileFormat(rawContent, filename);
      const skillId = this.extractSkillId(filename);
      const baseName = this.extractBaseName(filename);

      let manifest: SkillNodeManifest;
      if (detectedFormat === "unknown_text") {
        manifest = this.forgeEngine.synthesizeFromPrompt(rawContent, {
          name: baseName,
          targetSkillId: skillId,
        });
      } else {
        manifest = this.parseSkillContent(rawContent, detectedFormat as SkillFormatExportKind, skillId, baseName);
      }

      substrate.saveNode(manifest);

      return {
        success: true,
        sourceFormat: detectedFormat === "unknown_text" ? "skill_markdown" : (detectedFormat as SkillFormatExportKind),
        skillId,
        manifest,
        warnings: [],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        sourceFormat: "skill_markdown",
        warnings: [],
        error: `Failed to ingest dropped skill file: ${message}`,
      };
    }
  }

  /**
   * Exports a skill directly into the `skills/` directory for instant drag-out sharing.
   */
  public exportToDropDirectory(
    substrate: IBroccoliSkillTreeSubstrate,
    skillId: string,
    format: SkillFormatExportKind = "skill_markdown",
    customFilename?: string,
    customPath?: string
  ): string {
    const dir = this.ensureDirectoryStructure(customPath);
    const node = substrate.getNode(skillId);
    if (!node) {
      throw new Error(`Skill '${skillId}' not found in substrate registry`);
    }

    let defaultExt = ".skill.md";
    let content = node.body;

    if (format === "openai_tool_schema") {
      defaultExt = ".tool.json";
      content = JSON.stringify(
        {
          type: "function",
          function: {
            name: node.id.replace(/[^a-zA-Z0-9_]/g, "_"),
            description: node.description,
            parameters: {
              type: "object",
              properties: {
                input: { type: "string", description: "Operational argument" },
              },
            },
          },
        },
        null,
        2
      );
    } else if (format === "anthropic_tool_spec") {
      defaultExt = ".claude.xml";
      content = `<tool_description>\n  <tool_name>${node.id}</tool_name>\n  <description>${node.description}</description>\n</tool_description>`;
    } else if (format === "compact_json") {
      defaultExt = ".skill.json";
      content = JSON.stringify(node, null, 2);
    }

    const filename = customFilename || `${node.id}${defaultExt}`;
    const targetFile = path.join(dir, filename);

    try {
      fs.writeFileSync(targetFile, content, "utf8");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to export skill to drop directory '${dir}': ${message}`);
    }

    return targetFile;
  }

  /**
   * Returns telemetry on the dedicated skill drop vault directory.
   */
  public getDropVaultStatus(substrate: IBroccoliSkillTreeSubstrate, customPath?: string): SkillDropVaultStatus {
    const dir = customPath || this.defaultDirectory;
    const isInitialized = fs.existsSync(dir);
    let totalFiles = 0;

    if (isInitialized) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        totalFiles = entries.filter(
          (e) =>
            e.name.toLowerCase() !== "readme.md" &&
            !e.name.startsWith(".") &&
            e.name.toLowerCase() !== "templates"
        ).length;
      } catch {
        totalFiles = 0;
      }
    }

    const templatesAvailable = fs.existsSync(path.join(dir, "templates"));
    const allNodes = substrate.getAllNodes();

    return {
      directoryPath: dir,
      isInitialized,
      totalFiles,
      loadedSkillsCount: allNodes.length,
      supportedExtensions: Object.freeze([...this.supportedExtensions]),
      templatesAvailable,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal Content Parser Helper
  // ---------------------------------------------------------------------------

  private parseSkillContent(
    content: string,
    format: SkillFormatExportKind | "script_code",
    skillId: string,
    skillName: string
  ): SkillNodeManifest {
    if (format === "openai_tool_schema" || format === "compact_json" || format === "json_ld_skill") {
      try {
        const parsed = JSON.parse(content);
        const name = parsed.name || parsed.function?.name || skillName;
        const description = parsed.description || parsed.function?.description || "Imported JSON tool capability";
        return this.forgeEngine.synthesizeFromPrompt(description, {
          name,
          targetSkillId: skillId,
        });
      } catch {
        // Fallthrough
      }
    }

    if (format === "anthropic_tool_spec") {
      const descMatch = content.match(/<description>([\s\S]*?)<\/description>/);
      const desc = descMatch ? descMatch[1].trim() : "Imported Claude tool capability";
      return this.forgeEngine.synthesizeFromPrompt(desc, {
        name: skillName,
        targetSkillId: skillId,
      });
    }

    // Default: parse markdown or wrap script code
    if (content.startsWith("---")) {
      const frontmatter = this.extractFrontmatter(content);
      const body = content;
      const contentHash = crypto.createHash("sha256").update(body).digest("hex");
      return {
        id: skillId,
        name: frontmatter.name || skillName,
        description: frontmatter.description || `${skillName} procedure`,
        category: frontmatter.category || "workflow",
        tier: (frontmatter.tier as any) || "adept",
        version: frontmatter.version || "1.0.0",
        author: "Skill Drop Ingestion",
        prerequisites: [],
        relatedSkills: [],
        tags: ["dropped_skill", frontmatter.category || "workflow"],
        masteryScore: 75,
        fitnessScore: 0.85,
        useCount: 0,
        lastUsedTick: 0,
        createdTick: 0,
        lifecycleState: "active",
        provenance: "user_created",
        pinned: false,
        location: `skills/${skillId}/SKILL.md`,
        body,
        contentHash,
        supportFiles: [],
      };
    }

    return this.forgeEngine.synthesizeFromPrompt(content.slice(0, 300), {
      name: skillName,
      targetSkillId: skillId,
    });
  }

  private extractFrontmatter(content: string): Record<string, string> {
    const res: Record<string, string> = {};
    const lines = content.split("\n");
    if (!lines[0].startsWith("---")) return res;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === "---") break;
      const colonIdx = line.indexOf(":");
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim();
        let val = line.slice(colonIdx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        res[key] = val;
      }
    }
    return res;
  }
}
