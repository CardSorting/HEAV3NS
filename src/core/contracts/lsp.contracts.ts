/**
 * lsp.contracts.ts
 *
 * Core data contracts for the Deterministic LSP, AST Code Intelligence & Semantic Diagnostic Substrate (Phase 78 / ADR-030).
 */

export type LspDiagnosticSeverity = "error" | "warning" | "information" | "hint";

export interface LspPosition {
  readonly line: number;
  readonly character: number;
}

export interface LspRange {
  readonly start: LspPosition;
  readonly end: LspPosition;
}

export interface LspDiagnosticRelatedInformation {
  readonly location: {
    readonly uri: string;
    readonly range: LspRange;
  };
  readonly message: string;
}

export interface LspDiagnostic {
  readonly range: LspRange;
  readonly severity: LspDiagnosticSeverity;
  readonly code?: string | number;
  readonly source?: string;
  readonly message: string;
  readonly relatedInformation?: readonly LspDiagnosticRelatedInformation[];
}

export type LspSymbolKind =
  | "file"
  | "module"
  | "namespace"
  | "package"
  | "class"
  | "method"
  | "property"
  | "field"
  | "constructor"
  | "enum"
  | "interface"
  | "function"
  | "variable"
  | "constant"
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "key"
  | "null"
  | "enumMember"
  | "struct"
  | "event"
  | "operator"
  | "typeParameter";

export interface LspSymbolInformation {
  readonly name: string;
  readonly kind: LspSymbolKind;
  readonly location: {
    readonly uri: string;
    readonly range: LspRange;
  };
  readonly containerName?: string;
}

export interface LspHoverInfo {
  readonly contents: string;
  readonly range?: LspRange;
}

export interface LspDefinition {
  readonly uri: string;
  readonly range: LspRange;
}

export interface LspReferenceLocation {
  readonly uri: string;
  readonly range: LspRange;
  readonly lineContent: string;
}

export interface LspDocumentState {
  readonly uri: string;
  readonly version: number;
  readonly content: string;
  readonly diagnostics: readonly LspDiagnostic[];
  readonly symbols: readonly LspSymbolInformation[];
  readonly lastUpdated: number;
}

export interface LspWorkspaceSnapshot {
  readonly documents: readonly LspDocumentState[];
  readonly totalDocuments: number;
  readonly totalDiagnostics: number;
  readonly timestamp: number;
}

export interface LspQueryOptions {
  readonly uri: string;
  readonly position?: LspPosition;
  readonly line?: number;
  readonly character?: number;
}
