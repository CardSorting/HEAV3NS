/**
 * deterministic-threat-scanner.ts
 *
 * In-memory zero-GC threat pattern scanner and code safety firewall (Phase 86 / ADR-038).
 */

import { performance } from "node:perf_hooks";
import type {
  ThreatCategory,
  ThreatFinding,
  ThreatScanResult,
  ThreatSeverity,
  ThreatTrustLevel,
} from "../../../core/contracts/threat.contracts.js";

interface CompiledRule {
  readonly id: string;
  readonly category: ThreatCategory;
  readonly severity: ThreatSeverity;
  readonly pattern: RegExp;
  readonly description: string;
}

export class DeterministicThreatScanner {
  private static readonly MAX_SCAN_CHARS = 65536;
  private readonly rules: readonly CompiledRule[];

  constructor() {
    this.rules = [
      // Prompt Injection Patterns
      {
        id: "RULE-PI-01",
        category: "prompt_injection",
        severity: "critical",
        pattern: /ignore(?:\s+\w+){0,8}\s+(?:prior|previous|all)\s+instructions/i,
        description: "Classic prompt injection instruction override attempt",
      },
      {
        id: "RULE-PI-02",
        category: "prompt_injection",
        severity: "critical",
        pattern: /disregard(?:\s+\w+){0,8}\s+(?:prior|previous|system)\s+prompts?/i,
        description: "Prompt injection system prompt disregard directive",
      },
      {
        id: "RULE-PI-03",
        category: "prompt_injection",
        severity: "dangerous",
        pattern: /(?:developer|jailbreak|DAN)\s+mode\s+(?:enabled|activated)/i,
        description: "Jailbreak / role-play mode escape attempt",
      },

      // Data Exfiltration Patterns
      {
        id: "RULE-EX-01",
        category: "data_exfiltration",
        severity: "critical",
        pattern: /curl\b(?:\s+-[A-Za-z0-9_-]+|\s+['"][^'"]+['"]|\s+\S+)*\s+-[A-Za-z0-9]*d\s+@[A-Za-z0-9_.\-\/~]+/i,
        description: "File exfiltration attempt via curl HTTP POST",
      },
      {
        id: "RULE-EX-02",
        category: "data_exfiltration",
        severity: "critical",
        pattern: /wget\b(?:\s+-[A-Za-z0-9_-]+|\s+['"][^'"]+['"]|\s+\S+)*\s+--post-file/i,
        description: "File exfiltration attempt via wget POST payload",
      },
      {
        id: "RULE-EX-03",
        category: "data_exfiltration",
        severity: "dangerous",
        pattern: /(?:webhook\.site|transfer\.sh|pastebin\.com\/api)/i,
        description: "Unverified third-party drop point domain detected",
      },

      // Destructive Commands
      {
        id: "RULE-CMD-01",
        category: "destructive_command",
        severity: "critical",
        pattern: /rm\s+-[A-Za-z0-9]*r[A-Za-z0-9]*f\s+(?:\/|~|\$HOME|\*)/i,
        description: "Recursive root/home directory deletion command",
      },
      {
        id: "RULE-CMD-02",
        category: "destructive_command",
        severity: "critical",
        pattern: /mkfs\.[A-Za-z0-9]+\s+\/dev/i,
        description: "Filesystem formatting command on raw block device",
      },
      {
        id: "RULE-CMD-03",
        category: "destructive_command",
        severity: "critical",
        pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
        description: "Fork-bomb denial-of-service shell payload",
      },

      // Git Repo Worktree Skew
      {
        id: "RULE-GIT-01",
        category: "repo_skew",
        severity: "dangerous",
        pattern: /git\s+(?:checkout\s+-f|reset\s+--hard|clean\s+-[A-Za-z0-9]*f|switch\s+-f)/i,
        description: "Destructive Git worktree mutation modifying backing checkout",
      },
      {
        id: "RULE-GIT-02",
        category: "repo_skew",
        severity: "warning",
        pattern: /git\s+(?:rebase|merge|pull)\b/i,
        description: "Git branch synchronization operation requiring clean worktree verification",
      },

      // Reverse Shells & Untrusted Code Execution
      {
        id: "RULE-C2-01",
        category: "c2_beacon",
        severity: "critical",
        pattern: /\/dev\/tcp\/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\/[0-9]+/i,
        description: "Raw bash TCP socket reverse-shell tunnel",
      },
      {
        id: "RULE-C2-02",
        category: "untrusted_import",
        severity: "dangerous",
        pattern: /(?:eval\s*\(|exec\s*\()\s*base64_decode/i,
        description: "Obfuscated base64 code execution payload",
      },
    ];
  }

  /**
   * Scans a text payload against compiled threat rules with bounded execution.
   */
  scanPayload(
    payload: string,
    trustLevel: ThreatTrustLevel = "community",
    location?: string
  ): ThreatScanResult {
    const startedAt = performance.now();
    const boundedPayload = payload.slice(0, DeterministicThreatScanner.MAX_SCAN_CHARS);
    const findings: ThreatFinding[] = [];

    for (let i = 0; i < this.rules.length; i++) {
      const rule = this.rules[i];
      if (rule.pattern.test(boundedPayload)) {
        findings.push({
          id: rule.id,
          category: rule.category,
          severity: rule.severity,
          description: rule.description,
          matchedPattern: rule.pattern.source,
          location,
        });
      }
    }

    const duration = Number((performance.now() - startedAt).toFixed(3));
    const clean = findings.length === 0;

    let verdict: "allow" | "warn" | "block" = "allow";

    if (!clean) {
      if (trustLevel === "builtin") {
        verdict = "allow";
      } else {
        const hasCritical = findings.some((f) => f.severity === "critical");
        const hasDangerous = findings.some((f) => f.severity === "dangerous");

        if (hasCritical || hasDangerous) {
          verdict = "block";
        } else if (findings.some((f) => f.severity === "warning")) {
          verdict = trustLevel === "trusted" ? "warn" : "block";
        } else {
          verdict = "warn";
        }
      }
    }

    return {
      clean,
      verdict,
      findings,
      scanDurationMs: duration,
      bytesScanned: boundedPayload.length,
      timestamp: Date.now(),
    };
  }
}
