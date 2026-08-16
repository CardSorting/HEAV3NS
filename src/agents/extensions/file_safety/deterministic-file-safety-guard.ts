/**
 * deterministic-file-safety-guard.ts
 *
 * Pure TypeScript File Safety Mutation Guard, Path Firewall & Sensitive File Detection
 * (Phase 126 / ADR-102 / Target #59).
 */

import { homedir } from "node:os";
import { isAbsolute, normalize, resolve } from "node:path";
import type {
  FileSafetyEvaluation,
  FileSafetyPolicyConfig,
} from "../../../core/contracts/file-safety.contracts.js";

export class DeterministicFileSafetyGuard {
  private readonly defaultHome: string;
  private readonly defaultHardDeniedPaths: Set<string>;
  private readonly defaultHardDeniedPrefixes: string[];
  private readonly defaultApprovalPaths: Set<string>;
  private readonly defaultSshConfigPath: string;

  constructor(home = homedir()) {
    this.defaultHome = normalize(home);
    this.defaultHardDeniedPaths = this.buildHardDeniedWritePaths(this.defaultHome);
    this.defaultHardDeniedPrefixes = this.buildHardDeniedWritePrefixes(this.defaultHome);
    this.defaultApprovalPaths = this.buildApprovalRequiredPaths(this.defaultHome);
    this.defaultSshConfigPath = normalize(`${this.defaultHome}/.ssh/config`);
  }

  /**
   * Normalizes an arbitrary path string safely.
   */
  public normalizePath(targetPath: string, cwd = process.cwd()): string {
    if (!targetPath) return "";
    let clean = targetPath.trim();
    if (clean.startsWith("~")) {
      clean = clean.replace(/^~(?=$|\/|\\)/, this.defaultHome);
    }
    if (!isAbsolute(clean)) {
      clean = resolve(cwd, clean);
    }
    return normalize(clean);
  }

  private buildHardDeniedWritePaths(home: string): Set<string> {
    return new Set([
      normalize(`${home}/.ssh/authorized_keys`),
      normalize(`${home}/.ssh/id_rsa`),
      normalize(`${home}/.ssh/id_ed25519`),
      normalize(`${home}/.ssh/id_ecdsa`),
      normalize(`${home}/.ssh/id_dsa`),
      normalize(`${home}/.netrc`),
      normalize(`${home}/.pgpass`),
      normalize(`${home}/.npmrc`),
      normalize(`${home}/.pypirc`),
      normalize(`${home}/.git-credentials`),
      normalize("/etc/sudoers"),
      normalize("/etc/passwd"),
      normalize("/etc/shadow"),
      normalize("/etc/master.passwd"),
    ]);
  }

  private buildHardDeniedWritePrefixes(home: string): string[] {
    return [
      normalize(`${home}/.ssh/`),
      normalize(`${home}/.aws/`),
      normalize(`${home}/.gnupg/`),
      normalize(`${home}/.kube/`),
      normalize(`${home}/.docker/`),
      normalize(`${home}/.azure/`),
      normalize(`${home}/.config/gh/`),
      normalize(`${home}/.config/gcloud/`),
      normalize("/etc/sudoers.d/"),
      normalize("/etc/systemd/"),
      normalize("/System/"),
      normalize("/usr/bin/"),
      normalize("/usr/sbin/"),
      normalize("/bin/"),
      normalize("/sbin/"),
    ];
  }

  private buildApprovalRequiredPaths(home: string): Set<string> {
    return new Set([
      normalize(`${home}/.ssh/config`),
      normalize(`${home}/.gitconfig`),
      normalize(`${home}/.zshrc`),
      normalize(`${home}/.bashrc`),
      normalize(`${home}/.profile`),
      normalize(`${home}/.bash_profile`),
    ]);
  }

  public getHardDeniedWritePaths(home = this.defaultHome): Set<string> {
    if (home === this.defaultHome) return this.defaultHardDeniedPaths;
    return this.buildHardDeniedWritePaths(home);
  }

  public getHardDeniedWritePrefixes(home = this.defaultHome): string[] {
    if (home === this.defaultHome) return this.defaultHardDeniedPrefixes;
    return this.buildHardDeniedWritePrefixes(home);
  }

  public getApprovalRequiredPaths(home = this.defaultHome): Set<string> {
    if (home === this.defaultHome) return this.defaultApprovalPaths;
    return this.buildApprovalRequiredPaths(home);
  }

  /**
   * Identifies if a file pattern matches sensitive secrets (read/write caution).
   */
  public isSensitiveSecretFile(targetPath: string): boolean {
    if (!targetPath) return false;
    const lastSlash = Math.max(targetPath.lastIndexOf("/"), targetPath.lastIndexOf("\\"));
    const basename = (lastSlash >= 0 ? targetPath.slice(lastSlash + 1) : targetPath).toLowerCase();

    if (basename === ".env" || basename.startsWith(".env.")) {
      return true;
    }
    if (basename.endsWith(".pem") || basename.endsWith(".key") || basename.endsWith(".pkcs12") || basename.endsWith(".pfx")) {
      return true;
    }
    if (basename.includes("oauth") && basename.endsWith(".json")) {
      return true;
    }
    if (basename.includes("credential") || basename.includes("secret") || basename.includes("token")) {
      return true;
    }
    return false;
  }

  /**
   * Evaluates if a write mutation is safe, hard-denied, or requires approval.
   */
  public evaluateWrite(
    targetPath: string,
    config: FileSafetyPolicyConfig,
    cwd = process.cwd(),
    home = this.defaultHome
  ): FileSafetyEvaluation {
    const normalized = this.normalizePath(targetPath, cwd);
    if (!normalized) {
      return {
        allowed: false,
        verdict: "denied_hard",
        path: targetPath,
        normalizedPath: "",
        reason: "Empty or invalid path provided",
        isSensitive: false,
      };
    }

    const isSensitive = this.isSensitiveSecretFile(normalized);

    // 1. Check custom denied paths
    if (config.customDeniedPaths.length > 0) {
      for (const customPath of config.customDeniedPaths) {
        if (this.normalizePath(customPath, cwd) === normalized) {
          return {
            allowed: false,
            verdict: "denied_hard",
            path: targetPath,
            normalizedPath: normalized,
            reason: `Path is explicitly blocked by custom deny rule: ${customPath}`,
            isSensitive,
          };
        }
      }
    }

    // 2. Check hard denied exact paths
    const hardDeniedPaths = home === this.defaultHome ? this.defaultHardDeniedPaths : this.getHardDeniedWritePaths(home);
    if (hardDeniedPaths.has(normalized)) {
      return {
        allowed: false,
        verdict: "denied_hard",
        path: targetPath,
        normalizedPath: normalized,
        reason: `Target path is protected by security policy: ${normalized}`,
        isSensitive: true,
      };
    }

    // 3. Check custom denied prefixes
    if (config.customDeniedPrefixes.length > 0) {
      for (const customPrefix of config.customDeniedPrefixes) {
        const normPrefix = this.normalizePath(customPrefix, cwd);
        if (normalized.startsWith(normPrefix)) {
          return {
            allowed: false,
            verdict: "denied_hard",
            path: targetPath,
            normalizedPath: normalized,
            reason: `Path prefix is blocked by custom deny rule: ${customPrefix}`,
            isSensitive,
          };
        }
      }
    }

    // 4. Check hard denied directory prefixes (excluding ~/.ssh/config handled in approval)
    const hardDeniedPrefixes = home === this.defaultHome ? this.defaultHardDeniedPrefixes : this.getHardDeniedWritePrefixes(home);
    const isSshConfig = normalized === (home === this.defaultHome ? this.defaultSshConfigPath : normalize(`${home}/.ssh/config`));

    if (!isSshConfig) {
      for (const prefix of hardDeniedPrefixes) {
        if (normalized.startsWith(prefix)) {
          return {
            allowed: false,
            verdict: "denied_hard",
            path: targetPath,
            normalizedPath: normalized,
            reason: `Target directory is protected by system firewall: ${prefix}`,
            isSensitive: true,
          };
        }
      }
    }

    // 5. Check approval required paths
    const approvalPaths = home === this.defaultHome ? this.defaultApprovalPaths : this.getApprovalRequiredPaths(home);
    if (approvalPaths.has(normalized)) {
      return {
        allowed: true,
        verdict: "approval_required",
        path: targetPath,
        normalizedPath: normalized,
        reason: `Writing to ${normalized} requires explicit operator approval`,
        isSensitive,
      };
    }

    // 6. Check safe roots enclosure if enabled
    if (config.enforceSafeRoots && config.safeRoots.length > 0) {
      let enclosedInSafeRoot = false;
      for (const root of config.safeRoots) {
        const normRoot = this.normalizePath(root, cwd);
        if (normalized.startsWith(normRoot)) {
          enclosedInSafeRoot = true;
          break;
        }
      }
      if (!enclosedInSafeRoot) {
        return {
          allowed: false,
          verdict: "outside_safe_root",
          path: targetPath,
          normalizedPath: normalized,
          reason: `Target path ${normalized} is outside configured safe roots`,
          isSensitive,
        };
      }
    }

    return {
      allowed: true,
      verdict: "allowed",
      path: targetPath,
      normalizedPath: normalized,
      isSensitive,
    };
  }

  /**
   * Evaluates if a read operation is accessing a sensitive credential store.
   */
  public evaluateRead(
    targetPath: string,
    cwd = process.cwd(),
    home = this.defaultHome
  ): FileSafetyEvaluation {
    const normalized = this.normalizePath(targetPath, cwd);
    const hardDeniedPaths = home === this.defaultHome ? this.defaultHardDeniedPaths : this.getHardDeniedWritePaths(home);
    const isSensitive = this.isSensitiveSecretFile(normalized) || hardDeniedPaths.has(normalized);

    return {
      allowed: true,
      verdict: "allowed",
      path: targetPath,
      normalizedPath: normalized,
      reason: isSensitive ? "Sensitive credential store access" : undefined,
      isSensitive,
    };
  }
}
