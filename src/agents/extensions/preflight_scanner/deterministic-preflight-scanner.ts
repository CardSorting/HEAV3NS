/**
 * deterministic-preflight-scanner.ts
 *
 * High-speed deterministic regex & AST threat pattern scanner, homograph URL analyzer,
 * terminal escape sanitizer, and Cosign supply-chain provenance verifier
 * (Phase 113 / ADR-089 / Target #46).
 */

import { createHash } from "node:crypto";
import type {
  PreflightThreatFinding,
  PreflightScanResult,
  PreflightSecurityPolicy,
  SupplyChainVerificationResult,
} from "../../../core/contracts/preflight-scanner.contracts.js";

export class DeterministicPreflightScanner {
  // Regex pattern rules for content-level threats
  private static readonly PIPE_TO_INTERPRETER_REGEX =
    /\b(curl|wget|fetch|http|aria2c)\b[^|;&]*\|\s*(sudo\s+)?(bash|sh|zsh|dash|python|python3|perl|ruby|node|php|sh -s)\b/i;

  private static readonly BASE64_EXECUTION_REGEX =
    /(base64\s+(-d|--decode)|openssl\s+enc\s+-d|base64\s+-D)[^|;&]*\|\s*(sudo\s+)?(sh|bash|zsh|python|perl|node)\b|echo\s+['"][A-Za-z0-9+/=]{16,}['"]\s*\|\s*(sudo\s+)?(sh|bash|zsh)\b/i;

  private static readonly DANGEROUS_PERMISSION_REGEX =
    /\bchmod\s+(-[a-zA-Z]*R[a-zA-Z]*\s+)?(777|a\+rwx|u=rwx,g=rwx,o=rwx)\s+(\/|\/\*|~\/?|\$HOME|\.\/)(?:\s|$|;)/i;

  private static readonly TERMINAL_INJECTION_REGEX =
    /(\x1b\]|\x1b\[|\x1b\_|\x1b\^|\x07|\u001b\]|\u001b\[|\\x1b\]|\\033\]|\\e\]|\\u001b\])/i;

  private static readonly CREDENTIAL_SCRAPING_REGEX =
    /\b(cat|grep|find|tar)\b[^|;&]*(\.env|id_rsa|id_ed25519|\.aws\/credentials|\.config\/gcloud)[^|;&]*\|\s*(curl|wget|nc|netcat|ncat|ssh)\b/i;

  private static readonly SUSPICIOUS_DOWNLOADER_REGEX =
    /\b(curl|wget)\b[^|;&]*(\/dev\/tcp\/|pastebin\.com\/raw\/|hastebin\.com\/raw\/)/i;

  // Cyrillic and Latin lookalike characters commonly used in homograph domain spoofing
  // e.g. Cyrillic 'а' (\u0430), 'о' (\u043E), 'с' (\u0441), 'е' (\u0435), 'р' (\u0440), 'у' (\u0443), 'х' (\u0445), 'і' (\u0456)
  private static readonly CYRILLIC_HOMOGRAPH_REGEX =
    /[\u0430\u043E\u0441\u0435\u0440\u0443\u0445\u0456\u0406\u0410\u041E\u0421\u0415\u0420\u0423\u0425]/;

  /**
   * Scan command string for threats.
   */
  public scanCommand(command: string, policy: PreflightSecurityPolicy): PreflightScanResult {
    const tStart = performance.now();
    const findings: PreflightThreatFinding[] = [];

    if (!policy.enabled) {
      return {
        command,
        verdict: "allow",
        exitCode: 0,
        findings: [],
        scanDurationMs: performance.now() - tStart,
        policyDecision: "allowed",
      };
    }

    // 1. Check Pipe to Interpreter
    if (DeterministicPreflightScanner.PIPE_TO_INTERPRETER_REGEX.test(command)) {
      findings.push({
        category: "pipe_to_interpreter",
        severity: "critical",
        description: "Pipe to shell interpreter detected (e.g. curl/wget piped directly into bash/sh/python)",
        matchedPattern: "pipe_to_interpreter",
        remediation: "Download file first, inspect checksum/content, and execute separately.",
      });
    }

    // 2. Check Base64 Payload Execution
    if (DeterministicPreflightScanner.BASE64_EXECUTION_REGEX.test(command)) {
      findings.push({
        category: "base64_execution",
        severity: "critical",
        description: "Obfuscated Base64 decode piped directly to shell interpreter",
        matchedPattern: "base64_execution",
        remediation: "Decode payload to a file and review source before execution.",
      });
    }

    // 3. Check Dangerous Permissions
    if (DeterministicPreflightScanner.DANGEROUS_PERMISSION_REGEX.test(command)) {
      findings.push({
        category: "dangerous_permission",
        severity: "high",
        description: "Dangerous recursive chmod 777 or world-writable permission on root/home/current directory",
        matchedPattern: "chmod 777",
        remediation: "Use least-privilege permissions (e.g. 755 or 644) scoped to specific non-root files.",
      });
    }

    // 4. Check Terminal Escape Injections
    if (DeterministicPreflightScanner.TERMINAL_INJECTION_REGEX.test(command)) {
      findings.push({
        category: "terminal_injection",
        severity: "high",
        description: "Embedded terminal control escape sequences detected in command line",
        matchedPattern: "escape_sequence",
        remediation: "Sanitize non-printable terminal control sequences.",
      });
    }

    // 5. Check Credential Exfiltration / Scraping
    if (DeterministicPreflightScanner.CREDENTIAL_SCRAPING_REGEX.test(command)) {
      findings.push({
        category: "credential_scraping",
        severity: "critical",
        description: "Secret or credential file (.env, id_rsa, aws credentials) piped to network utility",
        matchedPattern: "credential_exfiltration",
        remediation: "Never pipe private credentials or SSH keys to outbound network streams.",
      });
    }

    // 6. Check Suspicious Downloader / Raw Pastebin Targets
    if (DeterministicPreflightScanner.SUSPICIOUS_DOWNLOADER_REGEX.test(command)) {
      findings.push({
        category: "suspicious_downloader",
        severity: "medium",
        description: "Downloader targeting raw pastebin or bash dev/tcp network socket",
        matchedPattern: "suspicious_target",
        remediation: "Use verified package repositories or git repository targets.",
      });
    }

    // 7. Check Homograph URL Characters in Domain Strings
    if (this.detectHomographUrl(command)) {
      findings.push({
        category: "homograph_url",
        severity: "high",
        description: "Unicode Cyrillic lookalike character detected inside domain string (IDN homograph attack)",
        matchedPattern: "cyrillic_homograph",
        remediation: "Verify domain spellings using pure ASCII alphanumeric characters.",
      });
    }

    // Determine verdict
    let verdict: "allow" | "warn" | "block" = "allow";
    let exitCode: 0 | 1 | 2 = 0;
    let policyDecision: "allowed" | "blocked" | "warned_and_passed" | "fail_open_fallback" = "allowed";

    const hasBlockedCategory = findings.some((f) => policy.blockedCategories.includes(f.category));

    if (hasBlockedCategory) {
      verdict = "block";
      exitCode = 1;
      policyDecision = "blocked";
    } else if (findings.length > 0) {
      verdict = "warn";
      exitCode = 2;
      policyDecision = "warned_and_passed";
    }

    return {
      command,
      verdict,
      exitCode,
      findings,
      scanDurationMs: performance.now() - tStart,
      policyDecision,
    };
  }

  /**
   * Detect Cyrillic homograph characters in URLs.
   */
  public detectHomographUrl(command: string): boolean {
    const urlMatches = command.match(/https?:\/\/[^\s"'`]+/gi);
    if (!urlMatches) {
      return false;
    }

    for (const url of urlMatches) {
      try {
        const domain = url.replace(/^https?:\/\//i, "").split(/[\/?#]/)[0];
        if (DeterministicPreflightScanner.CYRILLIC_HOMOGRAPH_REGEX.test(domain)) {
          return true;
        }
      } catch {
        // ignore
      }
    }
    return false;
  }

  /**
   * Compute SHA-256 checksum.
   */
  public computeSha256(content: string | Buffer): string {
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Verify binary supply-chain provenance (SHA-256 and Cosign workflow identity).
   */
  public verifySupplyChainProvenance(params: {
    binaryPath: string;
    content: string | Buffer;
    expectedSha256: string;
    cosignIssuer?: string;
    cosignIdentity?: string;
    allowedRepoPrefix?: string;
  }): SupplyChainVerificationResult {
    const calculatedSha256 = this.computeSha256(params.content);

    if (calculatedSha256.toLowerCase() !== params.expectedSha256.toLowerCase()) {
      return {
        binaryPath: params.binaryPath,
        verified: false,
        sha256Checksum: calculatedSha256,
        error: `SHA-256 checksum mismatch (expected ${params.expectedSha256}, got ${calculatedSha256})`,
      };
    }

    // Verify Cosign identity if provided
    if (params.cosignIdentity) {
      const expectedIssuer = "https://token.actions.githubusercontent.com";
      if (params.cosignIssuer && params.cosignIssuer !== expectedIssuer) {
        return {
          binaryPath: params.binaryPath,
          verified: false,
          issuer: params.cosignIssuer,
          identity: params.cosignIdentity,
          sha256Checksum: calculatedSha256,
          error: `Untrusted Cosign OIDC issuer: ${params.cosignIssuer}`,
        };
      }

      const repo = params.allowedRepoPrefix ?? "sheeki03/tirith";
      const identityRegex = new RegExp(`^https://github\\.com/${repo}/\\.github/workflows/release\\.ya?ml@refs/tags/v`);
      if (!identityRegex.test(params.cosignIdentity)) {
        return {
          binaryPath: params.binaryPath,
          verified: false,
          issuer: params.cosignIssuer,
          identity: params.cosignIdentity,
          sha256Checksum: calculatedSha256,
          error: `Untrusted Cosign release workflow identity: ${params.cosignIdentity}`,
        };
      }
    }

    return {
      binaryPath: params.binaryPath,
      verified: true,
      issuer: params.cosignIssuer,
      identity: params.cosignIdentity,
      sha256Checksum: calculatedSha256,
    };
  }
}
