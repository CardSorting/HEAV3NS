/**
 * SoulDropVault.
 * Formalized under ADR-014 (AKD-DSO Osmosis Paradigm) & SOUL-001.
 *
 * Dedicated Drag-and-Drop Directory Ingestion & Export Engine.
 * Enables zero-command, drag-and-drop SOUL persona management in a dedicated directory (.lumi/souls/).
 *
 * Automatically detects file formats:
 * - Markdown Frontmatter (*.soul.md, *.md)
 * - CharacterCard V2 JSON (*.card.json, *.json)
 * - OpenAI Custom GPT Schema (*.gpt.json)
 * - Anthropic Claude XML (*.claude.xml, *.xml)
 * - JSON-LD Agent Specifications (*.jsonld)
 * - Raw Natural Language Prompts (*.txt, *.prompt)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  IBroccoliSoulSubstrate,
  SoulDirectorySyncReport,
  SoulDroppedFileEntry,
  SoulDropVaultStatus,
  SoulFormatExportKind,
  SoulImportResult,
} from "../../../core/contracts/soul.contracts.js";
import { DeterministicSoulParser } from "./deterministic-soul-parser.js";

export class SoulDropVault {
  private defaultDirectory: string;
  private readonly parser: DeterministicSoulParser;
  private readonly supportedExtensions = [".md", ".json", ".xml", ".txt", ".yaml", ".yml", ".jsonld"];

  constructor(
    defaultDirectory?: string,
    parser = new DeterministicSoulParser()
  ) {
    if (defaultDirectory) {
      this.defaultDirectory = defaultDirectory;
    } else {
      // Prioritize top-level visible 'souls/' directory, fallback to '.lumi/souls/'
      const visibleSoulsDir = path.join(process.cwd(), "souls");
      const hiddenSoulsDir = path.join(process.cwd(), ".lumi", "souls");
      if (fs.existsSync(hiddenSoulsDir) && !fs.existsSync(visibleSoulsDir)) {
        this.defaultDirectory = hiddenSoulsDir;
      } else {
        this.defaultDirectory = visibleSoulsDir;
      }
    }
    this.parser = parser;
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
   * Ensures the dedicated `souls/` directory and starter templates exist.
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
        const content = `# 🔮 LUMI SOUL Drop Vault (\`souls/\`)

Welcome to the **SOUL Drop Vault**! You can manage, switch, or customize your agent's persona simply by **dragging and dropping** files into this folder.

## 🚀 How to Use (Zero Configuration)

1. **Drop Any Persona File Here**:
   - **Markdown Frontmatter**: \`my-agent.soul.md\` or \`my-agent.md\`
   - **CharacterCard V2**: \`my-character.card.json\` or \`my-character.json\`
   - **OpenAI Custom GPT**: \`my-assistant.gpt.json\`
   - **Anthropic Claude XML**: \`my-prompt.claude.xml\` or \`my-prompt.xml\`
   - **Plain English Prompt**: \`my-bot.txt\` *(Describes what you want in plain text — auto-synthesizes a persona!)*

2. **Automatic Ingestion**:
   - LUMI automatically scans this folder, detects the format, computes the cryptographic SHA-256 integrity hash, and registers the profile into the live runtime.

3. **Starter Templates**:
   - Look in the \`templates/\` folder for ready-to-use persona templates!
   - Duplicate any template into this folder, rename it (e.g. \`patient-tutor.soul.md\`), and edit its traits.

4. **Export & Share**:
   - Any persona created in LUMI can be exported here so you can drag it out to share on Discord, Slack, or GitHub.
`;
        fs.writeFileSync(readmePath, content, "utf8");
      }
    } catch {
      // Non-blocking
    }
  }

  /**
   * Seeds starter template files so users can quickly duplicate, tweak, or drag in new personas.
   */
  public seedStarterTemplates(customPath?: string): void {
    const dir = customPath || this.defaultDirectory;
    const templatesDir = path.join(dir, "templates");

    try {
      const templateMdPath = path.join(templatesDir, "starter-mentor.soul.md");
      if (!fs.existsSync(templateMdPath)) {
        const sampleManifest = this.parser.createDefaultSoulManifestForArchetype("socratic_mentor");
        const md = this.parser.exportFormat(sampleManifest, "soul_markdown");
        fs.writeFileSync(templateMdPath, md, "utf8");
      }

      const templateCardPath = path.join(templatesDir, "starter-charactercard-v2.json");
      if (!fs.existsSync(templateCardPath)) {
        const sampleManifest = this.parser.createDefaultSoulManifestForArchetype("game_engine_architect");
        const card = this.parser.exportFormat(sampleManifest, "character_card_v2");
        fs.writeFileSync(templateCardPath, card, "utf8");
      }

      const templateGptPath = path.join(templatesDir, "starter-custom-gpt.json");
      if (!fs.existsSync(templateGptPath)) {
        const sampleManifest = this.parser.createDefaultSoulManifestForArchetype("executive_assistant");
        const gpt = this.parser.exportFormat(sampleManifest, "openai_gpt_schema");
        fs.writeFileSync(templateGptPath, gpt, "utf8");
      }

      const templateClaudePath = path.join(templatesDir, "starter-claude-prompt.xml");
      if (!fs.existsSync(templateClaudePath)) {
        const sampleManifest = this.parser.createDefaultSoulManifestForArchetype("formal_verifier");
        const claude = this.parser.exportFormat(sampleManifest, "anthropic_claude_xml");
        fs.writeFileSync(templateClaudePath, claude, "utf8");
      }
    } catch {
      // Non-blocking
    }
  }

  /**
   * Automatically detects the SOUL format based on content analysis and filename extension.
   */
  public detectFileFormat(content: string, filename: string): SoulFormatExportKind | "unknown_text" {
    const trimmed = content.trim();
    const ext = path.extname(filename).toLowerCase();

    // 1. Markdown with YAML Frontmatter
    if (trimmed.startsWith("---") && (ext === ".md" || ext === ".soul")) {
      return "soul_markdown";
    }

    // 2. JSON-based formats
    if (trimmed.startsWith("{") || ext === ".json" || ext === ".jsonld") {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.spec === "chara_card_v2" || parsed.data?.character_book !== undefined) {
          return "character_card_v2";
        }
        if (parsed["@context"] || parsed["@type"]) {
          return "json_ld_agent";
        }
        if (parsed.instructions !== undefined || parsed.conversation_starters !== undefined) {
          return "openai_gpt_schema";
        }
        if (parsed.archetype !== undefined && parsed.traits !== undefined) {
          return "soul_markdown"; // Canonical JSON manifest
        }
      } catch {
        // Fallthrough
      }
    }

    // 3. XML format
    if ((trimmed.startsWith("<") || ext === ".xml") && trimmed.includes("<agent_system_prompt>")) {
      return "anthropic_claude_xml";
    }

    // 4. Default to markdown if it's an .md file
    if (ext === ".md") {
      return "soul_markdown";
    }

    return "unknown_text";
  }

  public extractBaseName(filename: string): string {
    return filename
      .replace(/\.(soul|card|gpt|claude|agent)\.[a-z0-9]+$/i, "")
      .replace(/\.[a-z0-9]+$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-");
  }

  public extractProfileId(filename: string): string {
    return `drop-${this.extractBaseName(filename)}`;
  }

  /**
   * Scans the dedicated `.lumi/souls/` directory, detects dropped files, parses them,
   * and ingests them into the active substrate profile registry.
   */
  public syncFromDirectory(substrate: IBroccoliSoulSubstrate, customPath?: string): SoulDirectorySyncReport {
    const dir = this.ensureDirectoryStructure(customPath);
    const droppedFiles: SoulDroppedFileEntry[] = [];
    const loadedProfiles: string[] = [];

    if (!fs.existsSync(dir)) {
      return {
        directoryPath: dir,
        isInitialized: false,
        filesScanned: 0,
        loadedCount: 0,
        failedCount: 0,
        droppedFiles: [],
        activeProfileId: substrate.getActiveProfileId(),
        loadedProfiles: [],
        syncTimestamp: Date.now(),
      };
    }

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) continue; // Skip subdirectories like /templates
        if (entry.name.toLowerCase() === "readme.md" || entry.name.startsWith(".")) continue; // Skip documentation and dotfiles
        const ext = path.extname(entry.name).toLowerCase();
        if (!this.supportedExtensions.includes(ext)) continue;

        const fullPath = path.join(dir, entry.name);
        const stats = fs.statSync(fullPath);
        const rawContent = fs.readFileSync(fullPath, "utf8");

        const detectedFormat = this.detectFileFormat(rawContent, entry.name);
        const baseName = this.extractBaseName(entry.name);
        const profileId = this.extractProfileId(entry.name);

        let importResult: SoulImportResult;
        if (detectedFormat === "unknown_text") {
          // Free-form raw prompt: synthesize directly
          const manifest = (substrate as any).forgeCustomSoul
            ? (substrate as any).forgeCustomSoul(rawContent, { name: baseName }, profileId)
            : this.parser.createDefaultSoulManifest();
          importResult = {
            success: true,
            sourceFormat: "soul_markdown",
            manifest,
            warnings: [],
          };
        } else {
          importResult = substrate.importFormat(rawContent, detectedFormat, profileId);
        }

        if (importResult.success && importResult.manifest) {
          loadedProfiles.push(profileId);
          droppedFiles.push({
            filename: entry.name,
            fullPath,
            formatDetected: detectedFormat,
            profileId,
            sizeBytes: stats.size,
            lastModified: stats.mtimeMs,
            isValid: true,
            manifestName: importResult.manifest.name,
            archetype: importResult.manifest.archetype,
          });
        } else {
          droppedFiles.push({
            filename: entry.name,
            fullPath,
            formatDetected: detectedFormat,
            profileId,
            sizeBytes: stats.size,
            lastModified: stats.mtimeMs,
            isValid: false,
            errorMessage: importResult.error || "Failed to parse dropped persona file",
          });
        }
      }
    } catch {
      // Non-blocking
    }

    const loadedCount = droppedFiles.filter((f) => f.isValid).length;
    const failedCount = droppedFiles.filter((f) => !f.isValid).length;
    const activeProfileId = substrate.getActiveProfileId();

    return {
      directoryPath: dir,
      isInitialized: true,
      filesScanned: droppedFiles.length,
      loadedCount,
      failedCount,
      droppedFiles: Object.freeze(droppedFiles),
      activeProfileId,
      loadedProfiles: Object.freeze(loadedProfiles),
      syncTimestamp: Date.now(),
    };
  }

  /**
   * Ingests a single dropped file path into the active substrate.
   */
  public ingestDroppedFile(substrate: IBroccoliSoulSubstrate, filePath: string): SoulImportResult {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        sourceFormat: "soul_markdown",
        warnings: [],
        error: `Dropped file '${filePath}' does not exist on filesystem`,
      };
    }

    try {
      const filename = path.basename(filePath);
      const rawContent = fs.readFileSync(filePath, "utf8");
      const detectedFormat = this.detectFileFormat(rawContent, filename);
      const baseName = this.extractBaseName(filename);
      const profileId = this.extractProfileId(filename);

      if (detectedFormat === "unknown_text") {
        const manifest = (substrate as any).forgeCustomSoul
          ? (substrate as any).forgeCustomSoul(rawContent, { name: baseName }, profileId)
          : this.parser.createDefaultSoulManifest();
        return {
          success: true,
          sourceFormat: "soul_markdown",
          manifest,
          warnings: [],
        };
      }

      return substrate.importFormat(rawContent, detectedFormat, profileId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        sourceFormat: "soul_markdown",
        warnings: [],
        error: `Failed to ingest dropped file: ${message}`,
      };
    }
  }

  /**
   * Exports an active or specified profile directly into the `.lumi/souls/` directory
   * so the user can drag it out to share or commit to git.
   */
  public exportToDropDirectory(
    substrate: IBroccoliSoulSubstrate,
    profileId?: string,
    format: SoulFormatExportKind = "soul_markdown",
    customFilename?: string,
    customPath?: string
  ): string {
    const dir = this.ensureDirectoryStructure(customPath);
    const manifest = substrate.getManifest(profileId);
    const exportedContent = substrate.exportFormat(format, profileId);

    let defaultExt = ".soul.md";
    if (format === "character_card_v2") defaultExt = ".card.json";
    else if (format === "openai_gpt_schema") defaultExt = ".gpt.json";
    else if (format === "anthropic_claude_xml") defaultExt = ".claude.xml";
    else if (format === "json_ld_agent") defaultExt = ".agent.jsonld";

    const filename = customFilename || `${manifest.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}${defaultExt}`;
    const targetFile = path.join(dir, filename);

    try {
      fs.writeFileSync(targetFile, exportedContent, "utf8");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to export persona to drop directory '${dir}': ${message}`);
    }

    return targetFile;
  }

  /**
   * Returns telemetry on the dedicated drop vault directory.
   */
  public getDropVaultStatus(substrate: IBroccoliSoulSubstrate, customPath?: string): SoulDropVaultStatus {
    const dir = customPath || this.defaultDirectory;
    const isInitialized = fs.existsSync(dir);
    let totalFiles = 0;

    if (isInitialized) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        totalFiles = entries.filter(
          (e) =>
            !e.isDirectory() &&
            e.name.toLowerCase() !== "readme.md" &&
            !e.name.startsWith(".") &&
            this.supportedExtensions.includes(path.extname(e.name).toLowerCase())
        ).length;
      } catch {
        totalFiles = 0;
      }
    }

    const templatesAvailable = fs.existsSync(path.join(dir, "templates"));
    const activeProfileId = substrate.getActiveProfileId();
    const allProfiles = substrate.getAllProfiles();

    return {
      directoryPath: dir,
      isInitialized,
      totalFiles,
      loadedProfilesCount: allProfiles.length,
      activeProfileId,
      supportedExtensions: Object.freeze([...this.supportedExtensions]),
      templatesAvailable,
    };
  }
}
