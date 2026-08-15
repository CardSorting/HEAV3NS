import type {
  CredentialAccount,
  CredentialStatus,
  CredentialRotationStrategy,
  ICredentialPool,
  IBroccoliCredentialSubstrate,
} from "../../../core/contracts/credential.contracts.js";
import { TokenBucketRateGovernor } from "./token-bucket-rate-governor.js";

/**
 * Deterministic Credential Pool for Provider Failover & Load Balancing.
 */
export class DeterministicCredentialPool implements ICredentialPool {
  private readonly substrate: IBroccoliCredentialSubstrate;
  private readonly rateGovernor: TokenBucketRateGovernor;
  private strategy: CredentialRotationStrategy;
  private rotationIndex = 0;

  constructor(
    substrate: IBroccoliCredentialSubstrate,
    rateGovernor = new TokenBucketRateGovernor(),
    strategy: CredentialRotationStrategy = "least_utilized"
  ) {
    this.substrate = substrate;
    this.rateGovernor = rateGovernor;
    this.strategy = strategy;
  }

  setStrategy(strategy: CredentialRotationStrategy): void {
    this.strategy = strategy;
  }

  getStrategy(): CredentialRotationStrategy {
    return this.strategy;
  }

  addAccount(
    input: Omit<
      CredentialAccount,
      | "totalRequestsServed"
      | "totalTokensConsumed"
      | "consecutiveFailures"
      | "status"
      | "tokenBucket"
      | "createdTimestampMs"
    >
  ): CredentialAccount {
    const bucket = this.rateGovernor.createDefaultBucket();
    const account: CredentialAccount = {
      ...input,
      status: "healthy",
      totalRequestsServed: 0,
      totalTokensConsumed: 0,
      consecutiveFailures: 0,
      tokenBucket: bucket,
      createdTimestampMs: Date.now(),
    };

    this.substrate.addAccount(account);
    return account;
  }

  removeAccount(accountId: string): void {
    this.substrate.removeAccount(accountId);
  }

  getAccount(accountId: string): CredentialAccount | undefined {
    return this.substrate.getAccount(accountId);
  }

  listAccounts(provider?: string): readonly CredentialAccount[] {
    return this.substrate.listAccounts(provider);
  }

  selectAccount(
    provider: string,
    requiredTokens = 100,
    nowMs = Date.now()
  ): { account?: CredentialAccount; reason?: string } {
    const all = this.substrate.listAccounts(provider);
    if (all.length === 0) {
      return { reason: `No credentials registered for provider '${provider}'` };
    }

    // Filter healthy or recovered accounts
    const available = all.filter((acc) => {
      if (acc.status === "dead") return false;
      if (acc.status === "cooldown" && acc.cooldownUntilTimestampMs && nowMs >= acc.cooldownUntilTimestampMs) {
        // Recovered from cooldown
        return true;
      }
      return acc.status === "healthy";
    });

    if (available.length === 0) {
      return { reason: `All credentials for provider '${provider}' are exhausted, dead, or on cooldown` };
    }

    // Filter by token bucket availability
    const capable = available.filter((acc) =>
      this.rateGovernor.canConsume(acc.tokenBucket, requiredTokens, 1, nowMs)
    );

    const candidates = capable.length > 0 ? capable : available;

    let selected: CredentialAccount;

    switch (this.strategy) {
      case "round_robin": {
        const idx = this.rotationIndex % candidates.length;
        selected = candidates[idx];
        this.rotationIndex++;
        break;
      }
      case "priority_failover": {
        // Sort descending by priority, ascending by consecutive failures
        selected = [...candidates].sort((a, b) => b.priority - a.priority || a.consecutiveFailures - b.consecutiveFailures)[0];
        break;
      }
      case "least_utilized":
      default: {
        // Sort ascending by totalRequestsServed, descending by weight
        selected = [...candidates].sort(
          (a, b) => a.totalRequestsServed - b.totalRequestsServed || b.weight - a.weight
        )[0];
        break;
      }
    }

    return { account: selected };
  }

  recordUsage(accountId: string, tokensUsed: number, nowMs = Date.now()): void {
    const acc = this.substrate.getAccount(accountId);
    if (!acc) return;

    const { bucket } = this.rateGovernor.consume(acc.tokenBucket, tokensUsed, 1, nowMs);
    const updated: CredentialAccount = {
      ...acc,
      totalRequestsServed: acc.totalRequestsServed + 1,
      totalTokensConsumed: acc.totalTokensConsumed + tokensUsed,
      tokenBucket: bucket,
    };
    this.substrate.updateAccount(updated);
  }

  recordSuccess(accountId: string): void {
    const acc = this.substrate.getAccount(accountId);
    if (!acc) return;

    const updated: CredentialAccount = {
      ...acc,
      status: "healthy",
      consecutiveFailures: 0,
      cooldownUntilTimestampMs: undefined,
    };
    this.substrate.updateAccount(updated);
  }

  recordFailure(
    accountId: string,
    errorReason: string,
    isRateLimit = false,
    nowMs = Date.now()
  ): { newStatus: CredentialStatus; cooldownMs?: number } {
    const acc = this.substrate.getAccount(accountId);
    if (!acc) return { newStatus: "dead" };

    const consecutiveFailures = acc.consecutiveFailures + 1;
    let newStatus: CredentialStatus = "cooldown";
    let cooldownMs = 1000 * Math.pow(2, Math.min(consecutiveFailures, 6)); // Exponential backoff up to 64s

    if (isRateLimit) {
      cooldownMs = Math.max(cooldownMs, 30000); // 30s min for 429
    }

    if (consecutiveFailures >= 5) {
      newStatus = "exhausted";
      cooldownMs = 300000; // 5 min
    }

    const updated: CredentialAccount = {
      ...acc,
      status: newStatus,
      consecutiveFailures,
      cooldownUntilTimestampMs: nowMs + cooldownMs,
    };

    this.substrate.updateAccount(updated);
    return { newStatus, cooldownMs };
  }
}
