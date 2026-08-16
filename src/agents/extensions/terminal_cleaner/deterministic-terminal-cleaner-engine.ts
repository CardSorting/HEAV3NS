/**
 * deterministic-terminal-cleaner-engine.ts
 *
 * Pure TypeScript deterministic engine for ECMA-48 ANSI sequence stripping,
 * display control byte filtering, carriage return normalization, and binary asset classification
 * (Phase 136 / ADR-112 / Target #69).
 */

import type {
  BinaryAssetClassification,
  TerminalCleanerConfig,
} from "../../../core/contracts/terminal-cleaner.contracts.js";
import {
  TERMINAL_KNOWN_BINARY_EXTENSIONS,
  TERMINAL_OPAQUE_DOCUMENT_EXTENSIONS,
} from "../../../core/contracts/terminal-cleaner.contracts.js";

// Comprehensive ECMA-48 ANSI Escape Sequence Pattern
// Covers CSI, OSC, DCS, SOS, PM, APC, nF, Fp/Fe/Fs, and 8-bit C1 controls
const ANSI_ESCAPE_RE = new RegExp(
  "\\x1b(?:\\[[\\x30-\\x3f]*[\\x20-\\x2f]*[\\x40-\\x7e]|\\][\\s\\S]*?(?:\\x07|\\x1b\\\\)|[PX^_][\\s\\S]*?(?:\\x1b\\\\)|[\\x20-\\x2f]+[\\x30-\\x7e]|[\\x30-\\x7e])|\\x9b[\\x30-\\x3f]*[\\x20-\\x2f]*[\\x40-\\x7e]|\\x9d[\\s\\S]*?(?:\\x07|\\x9c)|[\\x80-\\x9f]",
  "g"
);

// Fast-path scanner for ESC or C1 bytes
const HAS_ESCAPE_RE = /[\x1b\x80-\x9f]/;

// Dangerous C0 control characters (excluding \t 0x09 and \n 0x0a) + DEL 0x7f
const CONTROL_CHARS_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

// Fast-path scanner for any control byte, CR, DEL, ESC, or C1
const HAS_CONTROL_RE = /[\x00-\x08\x0b-\x1f\x7f-\x9f]/;

export class DeterministicTerminalCleanerEngine {
  /**
   * Fast-path aware removal of ANSI/ECMA-48 escape sequences.
   */
  public stripAnsi(text: string): { cleaned: string; wasModified: boolean; fastPath: boolean } {
    if (!text || !HAS_ESCAPE_RE.test(text)) {
      return { cleaned: text, wasModified: false, fastPath: true };
    }

    const cleaned = text.replace(ANSI_ESCAPE_RE, "");
    return {
      cleaned,
      wasModified: cleaned !== text,
      fastPath: false,
    };
  }

  /**
   * Sanitizes untrusted text before echoing to terminal or storing in session history.
   * Strips ANSI escapes, normalizes carriage returns, and strips dangerous C0 controls.
   */
  public sanitizeDisplayText(text: string): { cleaned: string; wasModified: boolean; fastPath: boolean } {
    if (!text || !HAS_CONTROL_RE.test(text)) {
      return { cleaned: text, wasModified: false, fastPath: true };
    }

    // 1. Strip ANSI escapes
    let result = text.replace(ANSI_ESCAPE_RE, "");

    // 2. Normalize carriage returns to prevent \r-overwrite spoofing
    if (result.includes("\r")) {
      result = result.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    }

    // 3. Remove bare control characters
    result = result.replace(CONTROL_CHARS_RE, "");

    return {
      cleaned: result,
      wasModified: result !== text,
      fastPath: false,
    };
  }

  /**
   * Classifies a file path based on its extension. Pure string check, zero I/O.
   */
  public classifyPath(filePath: string): BinaryAssetClassification {
    const dotIdx = filePath.lastIndexOf(".");
    if (dotIdx === -1) {
      return "text";
    }

    const ext = filePath.substring(dotIdx).toLowerCase();

    if (ext === ".pdf") {
      return "pdf";
    }

    if (TERMINAL_OPAQUE_DOCUMENT_EXTENSIONS.has(ext)) {
      return "opaque_document";
    }

    if (TERMINAL_KNOWN_BINARY_EXTENSIONS.has(ext)) {
      return "binary";
    }

    return "text";
  }

  /**
   * Evaluates whether a file path can safely be written as plain text.
   */
  public canWriteAsText(filePath: string, config: TerminalCleanerConfig): { allowed: boolean; reason?: string } {
    if (!config.guardOpaqueDocuments) {
      return { allowed: true };
    }

    const classification = this.classifyPath(filePath);
    if (classification === "opaque_document") {
      return {
        allowed: false,
        reason: `Cannot write plain text to opaque container document '${filePath}'. Use appropriate binary tools or conversions.`,
      };
    }

    return { allowed: true };
  }
}
