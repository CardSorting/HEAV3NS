/**
 * doc-extractor.contracts.ts
 *
 * Core contracts, data types, and binary/opaque extension sets for
 * Binary Extension Perception, Opaque Document Destruction Guard & Structured Document Extractor
 * (Phase 116 / ADR-092 / Target #49).
 */

export type DocumentFormat =
  | "ipynb"
  | "docx"
  | "xlsx"
  | "pdf"
  | "text"
  | "opaque_container"
  | "binary";

export type BinaryCategory =
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "executable"
  | "bytecode"
  | "database"
  | "design"
  | "lockfile"
  | "font";

export interface DocumentExtractionOptions {
  maxChars?: number;
  maxRows?: number;
  maxCols?: number;
  includeOutputs?: boolean;
}

export interface DocumentExtractionResult {
  format: DocumentFormat;
  textContent: string;
  charCount: number;
  pageOrSheetCount?: number;
  truncated: boolean;
  metadata?: Record<string, unknown>;
}

export interface OpaqueWriteCheckResult {
  safe: boolean;
  format?: DocumentFormat;
  reason?: string;
  recommendedAction?: string;
}

export interface CachedExtractedDoc {
  path: string;
  format: DocumentFormat;
  charCount: number;
  extractedAt: number;
}

export interface DocExtractorMetrics {
  totalExtractions: number;
  totalCharsExtracted: number;
  totalOpaqueBlocks: number;
  cacheSize: number;
}

export interface DocExtractorWorkspaceSnapshot {
  snapshotId: string;
  timestamp: number;
  extractedCache: readonly CachedExtractedDoc[];
  metrics: {
    totalExtractions: number;
    totalCharsExtracted: number;
    totalOpaqueBlocks: number;
  };
}

export const BINARY_EXTENSIONS: ReadonlySet<string> = new Set([
  // Images
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".tiff", ".tif",
  // Videos
  ".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".flv", ".m4v", ".mpeg", ".mpg",
  // Audio
  ".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a", ".wma", ".aiff", ".opus",
  // Archives
  ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".xz", ".z", ".tgz", ".iso",
  // Executables / Binaries
  ".exe", ".dll", ".so", ".dylib", ".bin", ".o", ".a", ".obj", ".lib",
  ".app", ".msi", ".deb", ".rpm",
  // Documents (opaque container archives)
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".odt", ".ods", ".odp",
  // Fonts
  ".ttf", ".otf", ".woff", ".woff2", ".eot",
  // Bytecode / VM artifacts
  ".pyc", ".pyo", ".class", ".jar", ".war", ".ear", ".node", ".wasm", ".rlib",
  // Database files
  ".sqlite", ".sqlite3", ".db", ".mdb", ".idx",
  // Design / 3D
  ".psd", ".ai", ".eps", ".sketch", ".fig", ".xd", ".blend", ".3ds", ".max",
  // Flash / Animation
  ".swf", ".fla",
  // Lock / Profiling data
  ".lockb", ".dat", ".data",
]);

export const OPAQUE_DOCUMENT_EXTENSIONS: ReadonlySet<string> = new Set([
  ".doc", ".docx", ".docm",
  ".xls", ".xlsx", ".xlsm", ".xlsb",
  ".ppt", ".pps", ".pot", ".pptx", ".pptm", ".ppsx", ".ppsm",
  ".odt", ".ods", ".odp",
  ".rtf", ".epub",
]);

export const EXTRACTABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  ".ipynb", ".docx", ".xlsx", ".pdf",
]);
