/**
 * semantic-code-supervisor.ts
 *
 * Master Semantic Code Intelligence Supervisor.
 * Coordinates in-memory document parsing, symbol indexing, hover inspections,
 * definition resolutions, cross-file reference finding, and pre-edit/post-edit delta diagnostics.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  LspDefinition,
  LspDiagnostic,
  LspHoverInfo,
  LspPosition,
  LspReferenceLocation,
  LspSymbolInformation,
} from "../../../core/contracts/lsp.contracts.js";
import { DeterministicLspEngine } from "../../../tooling/extensions/lsp/deterministic-lsp-engine.js";
import { BroccoliLspSubstrate } from "../../../sessions/extensions/lsp/broccoli-lsp-substrate.js";

export class SemanticCodeSupervisor {
  private readonly engine: DeterministicLspEngine;
  private readonly substrate: BroccoliLspSubstrate;

  constructor(engine?: DeterministicLspEngine, substrate?: BroccoliLspSubstrate) {
    this.engine = engine ?? new DeterministicLspEngine();
    this.substrate = substrate ?? new BroccoliLspSubstrate(this.engine);
  }

  public getEngine(): DeterministicLspEngine {
    return this.engine;
  }

  public getSubstrate(): BroccoliLspSubstrate {
    return this.substrate;
  }

  /**
   * Syncs file content into the in-memory LSP substrate.
   */
  public touchFile(filePath: string, content?: string, cwd = process.cwd()): void {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
    let fileContent = content;

    if (fileContent === undefined && fs.existsSync(fullPath)) {
      try {
        fileContent = fs.readFileSync(fullPath, "utf-8");
      } catch {
        // Skip unreadable files
        return;
      }
    }

    if (fileContent !== undefined) {
      this.substrate.openOrUpdateDocument(fullPath, fileContent);
    }
  }

  /**
   * Captures a pre-edit baseline for the given file to compute delta diagnostics.
   */
  public snapshotPreEdit(filePath: string, cwd = process.cwd()): void {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
    this.touchFile(fullPath, undefined, cwd);
    this.substrate.snapshotBaseline(fullPath);
  }

  /**
   * Retrieves diagnostics for a file or workspace.
   */
  public getDiagnostics(filePath?: string, deltaOnly = false, cwd = process.cwd()): readonly LspDiagnostic[] {
    if (filePath) {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
      this.touchFile(fullPath, undefined, cwd);
      return deltaOnly
        ? this.substrate.getDeltaDiagnostics(fullPath)
        : this.substrate.getDiagnostics(fullPath);
    }

    return this.substrate.getDiagnostics();
  }

  /**
   * Gets hover card information at position (line, character).
   */
  public getHover(filePath: string, line: number, character: number, cwd = process.cwd()): LspHoverInfo | null {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
    this.touchFile(fullPath, undefined, cwd);

    const doc = this.substrate.getDocument(fullPath);
    if (!doc) return null;

    const position: LspPosition = { line, character };
    return this.engine.getHoverInfo(doc.content, fullPath, position);
  }

  /**
   * Resolves definition location for symbol at position.
   */
  public getDefinition(filePath: string, line: number, character: number, cwd = process.cwd()): LspDefinition | null {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
    this.touchFile(fullPath, undefined, cwd);

    const position: LspPosition = { line, character };
    return this.engine.resolveDefinition(this.substrate.getAllDocuments(), fullPath, position);
  }

  /**
   * Finds all references and call sites for a symbol across workspace.
   */
  public getReferences(symbolName: string): readonly LspReferenceLocation[] {
    return this.engine.findReferences(this.substrate.getAllDocuments(), symbolName);
  }

  /**
   * Extracts document outline symbols.
   */
  public getDocumentSymbols(filePath: string, cwd = process.cwd()): readonly LspSymbolInformation[] {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
    this.touchFile(fullPath, undefined, cwd);

    const doc = this.substrate.getDocument(fullPath);
    return doc ? doc.symbols : [];
  }

  /**
   * Searches workspace symbols matching a query prefix.
   */
  public searchWorkspaceSymbols(query: string): readonly LspSymbolInformation[] {
    return this.substrate.searchWorkspaceSymbols(query);
  }
}
