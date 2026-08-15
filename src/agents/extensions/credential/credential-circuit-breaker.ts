import type { CredentialAccount, CredentialStatus } from "../../../core/contracts/credential.contracts.js";

const TERMINAL_AUTH_ERRORS = new Set([
  "token_invalidated",
  "token_revoked",
  "invalid_token",
  "invalid_grant",
  "unauthorized_client",
  "account_deactivated",
  "insufficient_quota_permanent",
]);

/**
 * Axiomatic Credential Circuit Breaker & Terminal Fault Classifier.
 */
export class CredentialCircuitBreaker {
  isTerminalAuthError(errorReason: string): boolean {
    if (!errorReason) return false;
    const lower = errorReason.toLowerCase();
    for (const term of TERMINAL_AUTH_ERRORS) {
      if (lower.includes(term)) {
        return true;
      }
    }
    return false;
  }

  evaluateAccountStatus(
    account: CredentialAccount,
    nowMs = Date.now()
  ): { status: CredentialStatus; canAttempt: boolean } {
    if (account.status === "dead") {
      return { status: "dead", canAttempt: false };
    }

    if (account.status === "exhausted") {
      if (account.cooldownUntilTimestampMs && nowMs >= account.cooldownUntilTimestampMs) {
        // Half-open attempt
        return { status: "cooldown", canAttempt: true };
      }
      return { status: "exhausted", canAttempt: false };
    }

    if (account.status === "cooldown") {
      if (account.cooldownUntilTimestampMs && nowMs >= account.cooldownUntilTimestampMs) {
        return { status: "healthy", canAttempt: true };
      }
      return { status: "cooldown", canAttempt: false };
    }

    return { status: "healthy", canAttempt: true };
  }

  classifyFailure(
    account: CredentialAccount,
    errorReason: string,
    nowMs = Date.now()
  ): { newStatus: CredentialStatus; cooldownMs: number; isTerminal: boolean } {
    if (this.isTerminalAuthError(errorReason)) {
      return {
        newStatus: "dead",
        cooldownMs: Infinity,
        isTerminal: true,
      };
    }

    const isRateLimit = errorReason.includes("429") || errorReason.toLowerCase().includes("rate_limit");
    const consecutiveFailures = account.consecutiveFailures + 1;

    let cooldownMs = 1000 * Math.pow(2, Math.min(consecutiveFailures, 6)); // 2s, 4s, 8s, 16s, 32s, 64s
    let newStatus: CredentialStatus = "cooldown";

    if (isRateLimit) {
      cooldownMs = Math.max(cooldownMs, 30000); // 30s min
    }

    if (consecutiveFailures >= 5) {
      newStatus = "exhausted";
      cooldownMs = 300000; // 5 min
    }

    return {
      newStatus,
      cooldownMs,
      isTerminal: false,
    };
  }
}
