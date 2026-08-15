/**
 * security-risk-classifier.ts
 *
 * High-performance deterministic multi-tier risk taxonomy and security classifier.
 * Evaluates shell commands, file writes, and memory mutations against categorized threat patterns.
 */

import type {
  ApprovalActionType,
  ApprovalRiskLevel,
  RiskAssessmentResult,
} from "../../../core/contracts/arbiter.contracts.js";

interface ClassifiedPattern {
  readonly regex: RegExp;
  readonly riskLevel: ApprovalRiskLevel;
  readonly reason: string;
}

const DANGEROUS_PATTERNS: readonly ClassifiedPattern[] = [
  // ── Critical Tier ────────────────────────────────────────────────────────
  {
    regex: /\brm\s+-(?:[a-zA-Z]*r[a-zA-Z]*)\s+(?:\/|\/\*|~\/|\$HOME)(?:\s|$)/i,
    riskLevel: "critical",
    reason: "Recursive deletion of root or home directory",
  },
  {
    regex: /:\(\)\s*\{\s*:\|:&\s*\};\s*:/,
    riskLevel: "critical",
    reason: "Shell fork bomb denial of service",
  },
  {
    regex: /\bmkfs(?:\.[a-z0-9]+)?\s+/i,
    riskLevel: "critical",
    reason: "Filesystem formatting operation",
  },
  {
    regex: /\bdd\s+if=[^\s]+\s+of=\/dev\/(?:sd[a-z]|nvme[0-9]|hd[a-z]|disk[0-9])/i,
    riskLevel: "critical",
    reason: "Direct raw block device write via dd",
  },
  {
    regex: />\s*\/dev\/(?:sd[a-z]|nvme[0-9]|hd[a-z]|disk[0-9])/i,
    riskLevel: "critical",
    reason: "Direct redirection to storage block device",
  },
  {
    regex: /\bDROP\s+(?:TABLE|DATABASE)\b/i,
    riskLevel: "critical",
    reason: "Destructive SQL DROP TABLE or DATABASE",
  },
  {
    regex: /\bTRUNCATE\s+(?:TABLE\s+)?\w+/i,
    riskLevel: "critical",
    reason: "Destructive SQL TRUNCATE TABLE",
  },
  {
    regex: /\bDELETE\s+FROM\s+\w+\s*(?!WHERE\b)/i,
    riskLevel: "critical",
    reason: "Unbounded SQL DELETE without WHERE clause",
  },
  {
    regex: /\bvssadmin\b[^\n]*\bdelete\s+shadows\b/i,
    riskLevel: "critical",
    reason: "Ransomware-style deletion of Volume Shadow Copies",
  },
  {
    regex: /\bformat-volume\b|\bclear-disk\b|\bdiskpart\b/i,
    riskLevel: "critical",
    reason: "Windows disk partitioning / volume wipe",
  },

  // ── High Tier ────────────────────────────────────────────────────────────
  {
    regex: /\bchmod\s+(-[^\s]*\s+)*(?:777|666|o\+[rwx]*w|a\+[rwx]*w)\b/i,
    riskLevel: "high",
    reason: "World-writable permission escalation",
  },
  {
    regex: /\bchown\s+(-[^\s]*)?R\s+root/i,
    riskLevel: "high",
    reason: "Recursive ownership change to root",
  },
  {
    regex: /\b(?:sudo|doas|pkexec)\b/i,
    riskLevel: "high",
    reason: "Superuser privilege escalation attempt",
  },
  {
    regex: /\b(?:cat|head|tail|less|more|nano|vim|vi)\s+[^\n]*\.(?:ssh[\\/]|env\b|aws[\\/])/i,
    riskLevel: "high",
    reason: "Reading sensitive secrets or private cryptographic keys",
  },
  {
    regex: /\b(?:pkill|killall)\s+-(?:9|KILL|SIGKILL)\b/i,
    riskLevel: "high",
    reason: "Unconditional force-kill of processes",
  },
  {
    regex: /\bsystemctl\s+(-[^\s]+\s+)*(?:stop|disable|mask)\b/i,
    riskLevel: "high",
    reason: "System service termination or masking",
  },
  {
    regex: /\breg(?:\.exe)?\s+delete\b[^\n]*\s\/f\b/i,
    riskLevel: "high",
    reason: "Forced Windows registry deletion",
  },

  // ── Medium Tier ──────────────────────────────────────────────────────────
  {
    regex: /\b(?:curl|wget|iwr|invoke-webrequest)\b[^\n]*\|\s*(?:sh|bash|zsh|iex|invoke-expression)\b/i,
    riskLevel: "medium",
    reason: "Piping unverified remote internet content directly into shell",
  },
  {
    regex: /\bgit\s+push\b[^\n]*\s-(?:f|force)\b/i,
    riskLevel: "medium",
    reason: "Git destructive force-push",
  },
  {
    regex: /\b(?:npm\s+i(?:nstall)?\s+-g|pip\s+install\s+--break-system-packages)\b/i,
    riskLevel: "medium",
    reason: "Global environment package modification",
  },
  {
    regex: /\brm\s+-(?:[a-zA-Z]*r[a-zA-Z]*)\s+[^\s]+/i,
    riskLevel: "medium",
    reason: "Recursive directory deletion",
  },
];

const SAFE_COMMANDS = new Set([
  "ls",
  "dir",
  "pwd",
  "echo",
  "cd",
  "git status",
  "git diff",
  "git log",
  "git branch",
  "npm test",
  "npm run test",
  "pytest",
  "tsc --noEmit",
  "node --version",
  "python --version",
  "cargo --version",
]);

export class SecurityRiskClassifier {
  /**
   * Evaluates an action and returns a comprehensive RiskAssessmentResult.
   */
  public evaluate(
    actionType: ApprovalActionType,
    target: string,
    metadata: Record<string, unknown> = {}
  ): RiskAssessmentResult {
    switch (actionType) {
      case "shell_execution":
        return this.evaluateShellCommand(target);

      case "file_mutation":
        return this.evaluateFileMutation(target, metadata);

      case "skill_mutation":
        return this.evaluateSkillMutation(target, metadata);

      case "memory_mutation":
        return this.evaluateMemoryMutation(target, metadata);

      case "credential_access":
        return {
          riskLevel: "high",
          isDangerous: true,
          reason: `Direct access to credential store target: ${target}`,
          requiresHumanApproval: true,
        };

      case "network_egress":
        return {
          riskLevel: "medium",
          isDangerous: false,
          reason: `Outbound network egress to: ${target}`,
          requiresHumanApproval: false,
        };

      default:
        return {
          riskLevel: "low",
          isDangerous: false,
          requiresHumanApproval: false,
        };
    }
  }

  public evaluateShellCommand(command: string): RiskAssessmentResult {
    const trimmed = command.trim();
    if (!trimmed) {
      return {
        riskLevel: "safe",
        isDangerous: false,
        requiresHumanApproval: false,
      };
    }

    if (SAFE_COMMANDS.has(trimmed)) {
      return {
        riskLevel: "safe",
        isDangerous: false,
        requiresHumanApproval: false,
      };
    }

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.regex.test(trimmed)) {
        const requiresHumanApproval =
          pattern.riskLevel === "critical" || pattern.riskLevel === "high";

        return {
          riskLevel: pattern.riskLevel,
          isDangerous: true,
          matchedPattern: pattern.regex.source,
          reason: pattern.reason,
          requiresHumanApproval,
        };
      }
    }

    // Default heuristics for unknown commands
    return {
      riskLevel: "low",
      isDangerous: false,
      requiresHumanApproval: false,
    };
  }

  public evaluateFileMutation(
    filePath: string,
    metadata: Record<string, unknown> = {}
  ): RiskAssessmentResult {
    const lower = filePath.toLowerCase();

    // Critical system files
    if (
      lower.startsWith("/etc/") ||
      lower.startsWith("/system/") ||
      lower.startsWith("c:\\windows\\") ||
      lower.includes(".ssh/") ||
      lower.endsWith(".env") ||
      lower.includes("credentials")
    ) {
      return {
        riskLevel: "high",
        isDangerous: true,
        reason: `Target file path touches sensitive system or credential storage: ${filePath}`,
        requiresHumanApproval: true,
      };
    }

    const isDelete = metadata.operation === "delete";
    if (isDelete) {
      return {
        riskLevel: "medium",
        isDangerous: false,
        reason: `File deletion requested: ${filePath}`,
        requiresHumanApproval: false,
      };
    }

    return {
      riskLevel: "low",
      isDangerous: false,
      requiresHumanApproval: false,
    };
  }

  public evaluateSkillMutation(
    skillName: string,
    metadata: Record<string, unknown> = {}
  ): RiskAssessmentResult {
    const content = String(metadata.content || "");

    // Check for Trojan Unicode or prompt injection markers
    if (/[\u200B-\u200D\uFEFF]/.test(content) || /[\u202A-\u202E]/.test(content)) {
      return {
        riskLevel: "critical",
        isDangerous: true,
        reason: "Detected invisible Trojan Unicode or Bidirectional Override markers in skill definition",
        requiresHumanApproval: true,
      };
    }

    return {
      riskLevel: "medium",
      isDangerous: false,
      reason: `Skill tree mutation proposed for '${skillName}'`,
      requiresHumanApproval: false,
    };
  }

  public evaluateMemoryMutation(
    factKey: string,
    metadata: Record<string, unknown> = {}
  ): RiskAssessmentResult {
    const value = String(metadata.value || "");

    if (value.length > 4096) {
      return {
        riskLevel: "medium",
        isDangerous: false,
        reason: "Memory entry exceeds standard 4KB size threshold",
        requiresHumanApproval: false,
      };
    }

    return {
      riskLevel: "low",
      isDangerous: false,
      requiresHumanApproval: false,
    };
  }
}
