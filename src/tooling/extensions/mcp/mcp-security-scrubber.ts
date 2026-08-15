/**
 * mcp-security-scrubber.ts
 *
 * Deterministic environment secret scrubber, credential redactor, and path sanitizer
 * for MCP child processes and transport payloads.
 */

export class McpSecurityScrubber {
  private static readonly SENSITIVE_ENV_KEYS = new Set([
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "GITHUB_TOKEN",
    "GH_TOKEN",
    "SLACK_BOT_TOKEN",
    "TELEGRAM_BOT_TOKEN",
    "DISCORD_TOKEN",
    "DATABASE_URL",
    "POSTGRES_PASSWORD",
    "MYSQL_PWD",
    "HERMES_API_KEY",
    "LUMI_AUTH_TOKEN",
    "OPENROUTER_API_KEY",
    "GROQ_API_KEY",
    "COHERE_API_KEY",
    "TAVILY_API_KEY",
  ]);

  private static readonly CREDENTIAL_PATTERNS: RegExp[] = [
    /sk-[a-zA-Z0-9_-]{20,}/g,
    /ghp_[a-zA-Z0-9]{36}/g,
    /gho_[a-zA-Z0-9]{36}/g,
    /xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}/g,
    /Bearer\s+[a-zA-Z0-9._~+/-]+=*/gi,
    /password=["']?[^\s"']{6,}["']?/gi,
  ];

  /**
   * Cleans parent environment before passing to child MCP subprocess.
   */
  public scrubEnvironment(
    parentEnv: Record<string, string | undefined>,
    customEnv?: Record<string, string>,
    allowedPassthroughKeys: Set<string> = new Set()
  ): Record<string, string> {
    const cleanEnv: Record<string, string> = {};

    // Standard safe defaults
    const safeDefaults = ["PATH", "HOME", "USER", "LANG", "LC_ALL", "SHELL", "TMPDIR", "NODE_ENV"];
    for (const key of safeDefaults) {
      if (parentEnv[key] !== undefined) {
        cleanEnv[key] = parentEnv[key]!;
      }
    }

    // Add parent env vars that are NOT sensitive
    for (const [k, v] of Object.entries(parentEnv)) {
      if (v === undefined) continue;
      if (McpSecurityScrubber.SENSITIVE_ENV_KEYS.has(k.toUpperCase())) {
        if (allowedPassthroughKeys.has(k)) {
          cleanEnv[k] = v;
        }
        continue;
      }
      if (!cleanEnv[k]) {
        cleanEnv[k] = v;
      }
    }

    // Overlay explicit custom env vars
    if (customEnv) {
      for (const [k, v] of Object.entries(customEnv)) {
        cleanEnv[k] = v;
      }
    }

    return cleanEnv;
  }

  /**
   * Redacts sensitive bearer tokens, API keys, and passwords from strings.
   */
  public redactSensitiveText(text: string): string {
    if (!text) return text;
    let result = text;
    for (const pattern of McpSecurityScrubber.CREDENTIAL_PATTERNS) {
      result = result.replace(pattern, "[REDACTED_CREDENTIAL]");
    }
    return result;
  }

  /**
   * Sanitizes relative paths to ensure they stay within allowed base workspace directory.
   */
  public sanitizePath(rawPath: string, baseDir: string): string {
    const normalized = rawPath.replace(/\\/g, "/");
    if (normalized.includes("..") || normalized.startsWith("/")) {
      const parts = normalized.split("/").filter((p) => p.length > 0 && p !== ".");
      const resolvedParts: string[] = [];
      for (const p of parts) {
        if (p === "..") {
          resolvedParts.pop();
        } else {
          resolvedParts.push(p);
        }
      }
      return `${baseDir.replace(/\\/g, "/").replace(/\/+$/, "")}/${resolvedParts.join("/")}`;
    }
    return `${baseDir.replace(/\\/g, "/").replace(/\/+$/, "")}/${normalized}`;
  }
}
