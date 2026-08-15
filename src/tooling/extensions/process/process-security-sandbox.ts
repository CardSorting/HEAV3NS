/**
 * process-security-sandbox.ts
 *
 * Security sandbox and permission governor for background child processes.
 * Enforces command safety policies, blocks destructive shell scripts,
 * and strips credential tokens from subprocess environments.
 */

const BLOCKED_COMMAND_PATTERNS = [
  /rm\s+-(?:[a-zA-Z]*r[a-zA-Z]*)\s+(?:\/|\/\*|~\/|\$HOME)/i,
  /:\(\)\s*\{\s*:\|:&\s*\};\s*:/, // Fork bomb
  /mkfs(?:\.[a-z0-9]+)?\s+/i,
  /dd\s+if=[^\s]+\s+of=\/dev\/(?:sd[a-z]|nvme[0-9]|hd[a-z]|disk[0-9])/i,
  />\s*\/dev\/(?:sd[a-z]|nvme[0-9]|hd[a-z]|disk[0-9])/i,
  /chmod\s+-R\s+777\s+\//i,
  /chown\s+-R\s+.*\s+\//i,
];

const SENSITIVE_ENV_KEYS = new Set([
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "SLACK_BOT_TOKEN",
  "SLACK_APP_TOKEN",
  "TELEGRAM_BOT_TOKEN",
  "DISCORD_BOT_TOKEN",
  "DATABASE_URL",
  "HERMES_AUTH_TOKEN",
  "LUMI_AUTH_TOKEN",
]);

export interface CommandSafetyVerdict {
  readonly safe: boolean;
  readonly reason?: string;
}

export class ProcessSecuritySandbox {
  /**
   * Evaluates command line string for destructive patterns.
   */
  public evaluateCommand(command: string, args: string[] = []): CommandSafetyVerdict {
    const fullCmd = [command, ...args].join(" ").trim();
    if (!fullCmd) {
      return { safe: false, reason: "Empty command string" };
    }

    for (const pattern of BLOCKED_COMMAND_PATTERNS) {
      if (pattern.test(fullCmd)) {
        return {
          safe: false,
          reason: `Command matched forbidden destructive pattern: ${pattern.toString()}`,
        };
      }
    }

    return { safe: true };
  }

  /**
   * Produces a sanitized copy of the parent/child environment variables.
   */
  public sanitizeEnvironment(
    env: Record<string, string | undefined> = process.env,
    customEnv: Record<string, string> = {}
  ): Record<string, string> {
    const cleanEnv: Record<string, string> = {};

    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) continue;
      const upper = key.toUpperCase();
      if (SENSITIVE_ENV_KEYS.has(upper)) continue;
      if (upper.includes("KEY") || upper.includes("SECRET") || upper.includes("TOKEN") || upper.includes("PASSWORD")) {
        continue;
      }
      cleanEnv[key] = value;
    }

    for (const [key, value] of Object.entries(customEnv)) {
      cleanEnv[key] = value;
    }

    return cleanEnv;
  }

  /**
   * Sanitizes error message strings to prevent token leakage in stack traces.
   */
  public redactError(text: string): string {
    return text
      .replace(/sk-[a-zA-Z0-9_-]{20,}/g, "[REDACTED_API_KEY]")
      .replace(/ghp_[a-zA-Z0-9]{36}/g, "[REDACTED_GH_TOKEN]")
      .replace(/Bearer\s+[a-zA-Z0-9._-]{20,}/gi, "Bearer [REDACTED_TOKEN]");
  }
}
