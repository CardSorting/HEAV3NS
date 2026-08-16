/**
 * subdirectory-hints.contracts.ts
 *
 * Core contracts, interfaces, and invariants for Progressive Subdirectory Context
 * Discovery & Dynamic Instruction Hints (Phase 129 / ADR-105 / Target #62).
 */

export interface DiscoveredSubdirHint {
  directoryPath: string;
  relativeDirectory: string;
  filename: string;
  content: string;
  contentDigest: string;
  charCount: number;
  discoveredAt: number;
}

export interface SubdirHintDiscoveryResult {
  hintsFound: DiscoveredSubdirHint[];
  formattedAttachment?: string;
  inspectedPaths: string[];
  durationMs: number;
}

export interface SubdirectoryHintsConfig {
  workingDir: string;
  maxHintChars: number;
  maxAncestorWalk: number;
  hintFilenames: string[];
  excludedDirNames: string[];
}

export interface SubdirectoryHintsMetrics {
  totalToolChecks: number;
  pathsEvaluated: number;
  hintsDiscovered: number;
  duplicatesSkipped: number;
  bytesInjected: number;
}

export interface SubdirectoryHintsWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  config: SubdirectoryHintsConfig;
  metrics: SubdirectoryHintsMetrics;
  loadedDirectories: string[];
  loadedDigests: string[];
  discoveredHints: DiscoveredSubdirHint[];
  virtualHints: Array<{ directoryPath: string; filename: string; content: string }>;
}

export const DEFAULT_SUBDIRECTORY_HINTS_CONFIG: SubdirectoryHintsConfig = {
  workingDir: process.cwd(),
  maxHintChars: 8000,
  maxAncestorWalk: 5,
  hintFilenames: [
    "AGENTS.md",
    "agents.md",
    "CLAUDE.md",
    "claude.md",
    ".cursorrules",
    ".windsurfrules",
  ],
  excludedDirNames: [
    "node_modules",
    "venv",
    ".venv",
    "__pycache__",
    ".git",
    ".hg",
    ".svn",
    ".Trash",
    ".cache",
    ".tox",
    ".mypy_cache",
    ".pytest_cache",
    "site-packages",
    "dist-packages",
    "backups",
    "backup",
    ".backups",
    "vendor",
    "third_party",
    "dist",
    "build",
  ],
};
