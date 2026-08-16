/**
 * broccoli-lsp-substrate.ts
 *
 * In-memory zero-GC Broccolidb substrate for document versioning,
 * semantic AST symbol indexing, and delta diagnostic tracking.
 */

import type {
  LspDiagnostic,
  LspDocumentState,
  LspSymbolInformation,
  LspWorkspaceSnapshot,
} from "../../../core/contracts/lsp.contracts.js";
import { DeterministicLspEngine } from "../../../tooling/extensions/lsp/deterministic-lsp-engine.js";

export class BroccoliLspSubstrate {
  private readonly documents = new Map<string, LspDocumentState>();
  private readonly baselineDiagnostics = new Map<string, readonly LspDiagnostic[]>();
  private readonly engine: DeterministicLspEngine;

  constructor(engine?: DeterministicLspEngine) {
    this.engine = engine ?? new DeterministicLspEngine();
  }

  public openOrUpdateDocument(uri: string, content: string): LspDocumentState {
    const existing = this.documents.get(uri);
    const version = existing ? existing.version + 1 : 1;

    const symbols = this.engine.extractSymbols(content, uri);
    const diagnostics = this.engine.inspectDiagnostics(content);

    const docState: LspDocumentState = {
      uri,
      version,
      content,
      diagnostics,
      symbols,
      lastUpdated: Date.now(),
    };

    this.documents.set(uri, docState);
    return docState;
  }

  public getDocument(uri: string): LspDocumentState | undefined {
    return this.documents.get(uri);
  }

  public getAllDocuments(): ReadonlyMap<string, string> {
    const map = new Map<string, string>();
    for (const [uri, doc] of this.documents) {
      map.set(uri, doc.content);
    }
    return map;
  }

  public snapshotBaseline(uri: string): void {
    const doc = this.documents.get(uri);
    this.baselineDiagnostics.set(uri, doc ? [...doc.diagnostics] : []);
  }

  public getDeltaDiagnostics(uri: string): readonly LspDiagnostic[] {
    const doc = this.documents.get(uri);
    if (!doc) return [];

    const baseline = this.baselineDiagnostics.get(uri) || [];
    const baselineMessages = new Set(baseline.map((d) => `${d.range.start.line}:${d.message}`));

    return doc.diagnostics.filter(
      (d) => !baselineMessages.has(`${d.range.start.line}:${d.message}`)
    );
  }

  public getDiagnostics(uri?: string): readonly LspDiagnostic[] {
    if (uri) {
      const doc = this.documents.get(uri);
      return doc ? doc.diagnostics : [];
    }

    const all: LspDiagnostic[] = [];
    for (const doc of this.documents.values()) {
      all.push(...doc.diagnostics);
    }
    return all;
  }

  public searchWorkspaceSymbols(query: string): readonly LspSymbolInformation[] {
    const norm = query.toLowerCase().trim();
    const results: LspSymbolInformation[] = [];

    for (const doc of this.documents.values()) {
      for (const sym of doc.symbols) {
        if (!norm || sym.name.toLowerCase().includes(norm)) {
          results.push(sym);
        }
      }
    }

    return results;
  }

  public captureSnapshot(): LspWorkspaceSnapshot {
    return {
      documents: Array.from(this.documents.values()).map((d) => ({
        ...d,
        diagnostics: [...d.diagnostics],
        symbols: [...d.symbols],
      })),
      totalDocuments: this.documents.size,
      totalDiagnostics: Array.from(this.documents.values()).reduce(
        (acc, d) => acc + d.diagnostics.length,
        0
      ),
      timestamp: Date.now(),
    };
  }

  public restoreSnapshot(snapshot: LspWorkspaceSnapshot): void {
    this.documents.clear();
    this.baselineDiagnostics.clear();
    for (const doc of snapshot.documents) {
      this.documents.set(doc.uri, {
        ...doc,
        diagnostics: [...doc.diagnostics],
        symbols: [...doc.symbols],
      });
    }
  }

  public clear(): void {
    this.documents.clear();
    this.baselineDiagnostics.clear();
  }
}
