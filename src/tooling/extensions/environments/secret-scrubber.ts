import type { ISecretScrubber } from "../../../core/contracts/environment.contracts.js";

/**
 * Deterministic Secret Scrubber.
 *
 * Sanitizes sensitive environment variables and command payloads to prevent
 * accidental API key or credential leakage to sub-processes and containers.
 */
export class SecretScrubber implements ISecretScrubber {
  private static readonly SECRET_KEY_PATTERNS = [
    /_KEY$/i,
    /_SECRET$/i,
    /_TOKEN$/i,
    /_AUTH$/i,
    /_PASSWORD$/i,
    /_PRIVATE_KEY$/i,
    /^OPENAI_/i,
    /^ANTHROPIC_/i,
    /^GEMINI_/i,
    /^AWS_/i,
    /^AZURE_/i,
    /^HERMES_/i,
    /^BEARER/i,
    /^API_KEY/i,
  ];

  private static readonly SECRET_INLINE_PATTERNS = [
    /sk-[a-zA-Z0-9]{20,}/g,
    /ghp_[a-zA-Z0-9]{30,}/g,
    /bearer\s+[a-zA-Z0-9\-_.]+/gi,
  ];

  isSecretKey(key: string): boolean {
    const trimmed = key.trim();
    return SecretScrubber.SECRET_KEY_PATTERNS.some((pattern) => pattern.test(trimmed));
  }

  scrubEnvironment(env: Readonly<Record<string, string>>): Record<string, string> {
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      if (!this.isSecretKey(key)) {
        clean[key] = value;
      }
    }
    return clean;
  }

  scrubCommandString(command: string): string {
    let scrubbed = command;
    for (const pattern of SecretScrubber.SECRET_INLINE_PATTERNS) {
      scrubbed = scrubbed.replace(pattern, "[REDACTED_SECRET]");
    }
    return scrubbed;
  }
}
