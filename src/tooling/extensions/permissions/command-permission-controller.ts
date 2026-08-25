import type { ExecutionAuthorityLevel } from "../../../core/contracts/tooling.contracts.js";

export interface CommandPermissionRule {
  allow?: string[];
  deny?: string[];
  allowRedirects?: boolean;
  executionAuthority?: ExecutionAuthorityLevel;
}

export interface PermissionValidationResult {
  allowed: boolean;
  reason: string;
  blockedSegment?: string;
  bypassed?: boolean;
  authorityLevel?: ExecutionAuthorityLevel;
}

/**
 * CommandPermissionController & Security Guardrails.
 * Absorbed from packages/codemarie/src/core/permissions (Pass 14 / ADR-012).
 *
 * Enforces shell execution security guardrails, allowlists/denylists, and
 * dangerous command pattern detection prior to terminal execution in AnchoredHands.
 */
export class CommandPermissionController {
  private readonly defaultDenyPatterns = [
    /\bsudo\b/i,
    /\brm\s+-rf\s+[\/\~]/i,
    /\bchmod\s+777\b/i,
    /\bmkfs\b/i,
    /\bdd\s+if=/i,
    />\s*\/dev\/sd/i,
  ];

  private ruleConfig: CommandPermissionRule | null = null;
  private currentAuthority: ExecutionAuthorityLevel = "balanced";

  constructor(ruleConfig?: CommandPermissionRule) {
    this.ruleConfig = ruleConfig ?? null;
    if (ruleConfig?.executionAuthority) {
      this.currentAuthority = ruleConfig.executionAuthority;
    }
  }

  public setExecutionAuthority(authority: ExecutionAuthorityLevel): void {
    this.currentAuthority = authority;
  }

  public getExecutionAuthority(): ExecutionAuthorityLevel {
    return this.currentAuthority;
  }

  validateCommand(
    command: string,
    authorityOverride?: ExecutionAuthorityLevel
  ): PermissionValidationResult {
    const trimmed = command.trim();
    if (!trimmed) {
      return { allowed: false, reason: "empty_command" };
    }

    const effectiveAuthority = authorityOverride ?? this.currentAuthority;

    // In autonomous mode with non-critical operations, allow execution with audit tracking
    if (effectiveAuthority === "autonomous" || effectiveAuthority === "high_throughput") {
      // Still prevent raw filesystem destruction like mkfs or raw disk overwrites
      const isExtremeCatastrophic =
        /\bmkfs\b/i.test(trimmed) ||
        /\bdd\s+if=/i.test(trimmed) ||
        />\s*\/dev\/sd/i.test(trimmed) ||
        /\brm\s+-rf\s+\/(?:\s|$)/i.test(trimmed);

      if (!isExtremeCatastrophic) {
        return {
          allowed: true,
          reason: "permitted_autonomous_authority",
          bypassed: true,
          authorityLevel: effectiveAuthority,
        };
      }
    }

    // 1. Check default destructive security patterns
    for (const pattern of this.defaultDenyPatterns) {
      if (pattern.test(trimmed)) {
        return {
          allowed: false,
          reason: `Security Violation: Destructive shell pattern detected matching '${pattern.source}'`,
          blockedSegment: trimmed,
          authorityLevel: effectiveAuthority,
        };
      }
    }

    // 2. Check explicit deny rules if configured
    if (this.ruleConfig?.deny) {
      for (const denyPattern of this.ruleConfig.deny) {
        if (trimmed.includes(denyPattern)) {
          return {
            allowed: false,
            reason: `Permission Denied: Command matches deny rule '${denyPattern}'`,
            blockedSegment: trimmed,
            authorityLevel: effectiveAuthority,
          };
        }
      }
    }

    // 3. Check explicit allow rules if configured
    if (this.ruleConfig?.allow && this.ruleConfig.allow.length > 0) {
      const isAllowed = this.ruleConfig.allow.some((allowPattern) => trimmed.startsWith(allowPattern));
      if (!isAllowed) {
        return {
          allowed: false,
          reason: "Permission Denied: Command does not match any configured allowlist rules",
          blockedSegment: trimmed,
          authorityLevel: effectiveAuthority,
        };
      }
    }

    return {
      allowed: true,
      reason: "permitted",
      authorityLevel: effectiveAuthority,
    };
  }
}

