/**
 * deterministic-secret-redactor.ts
 *
 * Deterministic, zero-GC Secret Redaction, Query Masking, and Sensitive Path Safety Engine (Phase 95 / ADR-047).
 */

import type {
  PathSafetyDecision,
  RedactionCategory,
  RedactionMatch,
  RedactionResult,
} from "../../../core/contracts/secret-redaction.contracts.js";

interface RedactionPatternDef {
  name: string;
  category: RedactionCategory;
  regex: RegExp;
}

export class DeterministicSecretRedactor {
  private patterns: RedactionPatternDef[];
  private deniedPathSubstrings: string[];
  private approvalPathSubstrings: string[];

  constructor() {
    this.patterns = [
      // PEM Private Keys
      {
        name: "pem_private_key",
        category: "pem_key",
        regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
      },
      // Database Connection Strings
      {
        name: "db_connection_uri",
        category: "connection_string",
        regex: /\b(?:postgres|postgresql|mysql|mongodb|redis):\/\/[^:\s]+:([^@\s]+)@[^\s]+/gi,
      },
      // AWS Access Key ID
      {
        name: "aws_access_key",
        category: "api_key",
        regex: /\b(AKIA[0-9A-Z]{16})\b/g,
      },
      // OpenAI API Key
      {
        name: "openai_api_key",
        category: "api_key",
        regex: /\b(sk-[a-zA-Z0-9]{20,}|sk-proj-[a-zA-Z0-9_-]{20,})\b/g,
      },
      // Anthropic API Key
      {
        name: "anthropic_api_key",
        category: "api_key",
        regex: /\b(sk-ant-[a-zA-Z0-9_-]{20,})\b/g,
      },
      // GitHub Token
      {
        name: "github_token",
        category: "api_key",
        regex: /\b(gh[pousr]_[A-Za-z0-9_]{36,})\b/g,
      },
      // Google API Key
      {
        name: "google_api_key",
        category: "api_key",
        regex: /\b(AIza[0-9A-Za-z-_]{30,})\b/g,
      },
      // Stripe Key
      {
        name: "stripe_api_key",
        category: "api_key",
        regex: /\b(sk_(?:test|live)_[0-9a-zA-Z]{24,})\b/g,
      },
      // Slack Token
      {
        name: "slack_token",
        category: "oauth_token",
        regex: /\b(xox[baprs]-[0-9a-zA-Z-]{10,64})\b/g,
      },
      // HuggingFace Token
      {
        name: "huggingface_token",
        category: "api_key",
        regex: /\b(hf_[a-zA-Z0-9]{24,})\b/g,
      },
      // JWT
      {
        name: "jwt_token",
        category: "jwt",
        regex: /\b(eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g,
      },
      // Sensitive URL Query Parameters
      {
        name: "url_query_secret",
        category: "query_param",
        regex: /([?&](?:access_token|refresh_token|id_token|token|api_key|apikey|client_secret|password|auth|jwt|secret|signature)=)([^&\s]+)/gi,
      },
      // Sensitive JSON/Form Body Fields
      {
        name: "json_body_secret",
        category: "body_field",
        regex: /("?(?:access_token|refresh_token|id_token|token|api_key|apikey|client_secret|password|auth|jwt|secret)"?\s*[:=]\s*"?)([^",\s}]+)("?)/gi,
      },
    ];

    this.deniedPathSubstrings = [
      ".ssh/id_rsa",
      ".ssh/id_ed25519",
      ".ssh/id_ecdsa",
      ".ssh/authorized_keys",
      ".aws/credentials",
      ".docker/config.json",
      ".kube/config",
      ".gnupg",
      ".netrc",
      ".git-credentials",
      ".anthropic_oauth.json",
      "bws_cache.enc.json",
    ];

    this.approvalPathSubstrings = [
      ".ssh/config",
      ".bashrc",
      ".zshrc",
      ".profile",
    ];
  }

  /**
   * Masks a secret string according to the partial preservation policy:
   * Tokens < 18 chars are fully masked.
   * Tokens >= 18 chars preserve first 6 and last 4 characters.
   */
  maskSecret(secret: string, patternName: string): string {
    if (secret.length < 18) {
      return `[REDACTED:${patternName}]`;
    }
    const prefix = secret.slice(0, 6);
    const suffix = secret.slice(-4);
    return `${prefix}...${suffix}`;
  }

  /**
   * Scans and redacts all secrets and credentials from a text string.
   */
  redact(text: string): RedactionResult {
    const startTime = Date.now();
    let sanitized = text;
    const matches: RedactionMatch[] = [];

    for (let i = 0; i < this.patterns.length; i++) {
      const p = this.patterns[i];
      p.regex.lastIndex = 0;

      if (p.name === "url_query_secret") {
        sanitized = sanitized.replace(p.regex, (fullMatch, prefix, secretValue, offset) => {
          const masked = this.maskSecret(secretValue, p.name);
          matches.push({
            category: p.category,
            patternName: p.name,
            originalLength: secretValue.length,
            maskedValue: masked,
            startOffset: offset + prefix.length,
            endOffset: offset + fullMatch.length,
            timestamp: Date.now(),
          });
          return `${prefix}${masked}`;
        });
      } else if (p.name === "json_body_secret") {
        sanitized = sanitized.replace(p.regex, (fullMatch, prefix, secretValue, quote, offset) => {
          const masked = this.maskSecret(secretValue, p.name);
          matches.push({
            category: p.category,
            patternName: p.name,
            originalLength: secretValue.length,
            maskedValue: masked,
            startOffset: offset + prefix.length,
            endOffset: offset + prefix.length + secretValue.length,
            timestamp: Date.now(),
          });
          return `${prefix}${masked}${quote}`;
        });
      } else if (p.name === "db_connection_uri") {
        sanitized = sanitized.replace(p.regex, (fullMatch, password, offset) => {
          const maskedPassword = "[REDACTED:password]";
          matches.push({
            category: p.category,
            patternName: p.name,
            originalLength: password.length,
            maskedValue: maskedPassword,
            startOffset: offset,
            endOffset: offset + fullMatch.length,
            timestamp: Date.now(),
          });
          return fullMatch.replace(`:${password}@`, `:${maskedPassword}@`);
        });
      } else {
        sanitized = sanitized.replace(p.regex, (fullMatch, capture, offset) => {
          const val = typeof capture === "string" ? capture : fullMatch;
          const masked = this.maskSecret(val, p.name);
          matches.push({
            category: p.category,
            patternName: p.name,
            originalLength: val.length,
            maskedValue: masked,
            startOffset: offset,
            endOffset: offset + fullMatch.length,
            timestamp: Date.now(),
          });
          return masked;
        });
      }
    }

    const duration = Date.now() - startTime;
    return {
      sanitizedText: sanitized,
      totalRedactions: matches.length,
      matches,
      executionDurationMs: duration,
    };
  }

  /**
   * Evaluates if a file path is sensitive, denied, or requires interactive approval.
   */
  evaluatePathSafety(targetPath: string, mode: "read" | "write" = "read"): PathSafetyDecision {
    const normalized = targetPath.replace(/\\/g, "/").toLowerCase();
    const basename = normalized.split("/").pop() ?? "";

    // 1. Check exact/basename env file rules
    if (
      basename === ".env" ||
      basename.startsWith(".env.") ||
      basename.endsWith(".env")
    ) {
      return {
        action: "deny",
        reason: `Access to environment configuration file '${basename}' is strictly denied.`,
        canonicalPath: targetPath,
        isSensitive: true,
      };
    }

    // 2. Check hard denied substrings
    for (let i = 0; i < this.deniedPathSubstrings.length; i++) {
      const sub = this.deniedPathSubstrings[i].toLowerCase();
      if (normalized.includes(sub)) {
        return {
          action: "deny",
          reason: `Access to critical security path containing '${sub}' is strictly denied.`,
          canonicalPath: targetPath,
          isSensitive: true,
        };
      }
    }

    // 3. Check approval paths
    for (let i = 0; i < this.approvalPathSubstrings.length; i++) {
      const sub = this.approvalPathSubstrings[i].toLowerCase();
      if (normalized.includes(sub)) {
        if (mode === "write") {
          return {
            action: "require_approval",
            reason: `Modifying user configuration file containing '${sub}' requires explicit approval.`,
            canonicalPath: targetPath,
            isSensitive: true,
          };
        }
      }
    }

    return {
      action: "allow",
      reason: "Path is safe and unrestricted.",
      canonicalPath: targetPath,
      isSensitive: false,
    };
  }
}
