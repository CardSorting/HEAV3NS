import type {
  CredentialAccount,
  CredentialRotationStrategy,
  ICredentialPool,
} from "../../../core/contracts/credential.contracts.js";
import { DeterministicCredentialPool } from "../../../tooling/extensions/credential/deterministic-credential-pool.js";
import { CredentialCircuitBreaker } from "./credential-circuit-breaker.js";
import { TokenBucketRateGovernor } from "../../../tooling/extensions/credential/token-bucket-rate-governor.js";
import { BroccoliCredentialSubstrate } from "../../../sessions/extensions/credential/broccoli-credential-substrate.js";

/**
 * Monolith Credential Manager & Dispatch Orchestrator.
 */
export class MonolithCredentialManager {
  private readonly substrate: BroccoliCredentialSubstrate;
  private readonly pool: DeterministicCredentialPool;
  private readonly circuitBreaker: CredentialCircuitBreaker;
  private readonly rateGovernor: TokenBucketRateGovernor;

  constructor(
    substrate: BroccoliCredentialSubstrate,
    pool: DeterministicCredentialPool,
    circuitBreaker: CredentialCircuitBreaker,
    rateGovernor: TokenBucketRateGovernor
  ) {
    this.substrate = substrate;
    this.pool = pool;
    this.circuitBreaker = circuitBreaker;
    this.rateGovernor = rateGovernor;
  }

  getPool(): ICredentialPool {
    return this.pool;
  }

  setStrategy(strategy: CredentialRotationStrategy): void {
    this.pool.setStrategy(strategy);
  }

  acquireCredential(
    provider: string,
    estimatedTokens = 100
  ): { account?: CredentialAccount; error?: string } {
    const result = this.pool.selectAccount(provider, estimatedTokens);
    if (!result.account) {
      return { error: result.reason || "No available credentials" };
    }

    const check = this.circuitBreaker.evaluateAccountStatus(result.account);
    if (!check.canAttempt) {
      return { error: `Selected account '${result.account.id}' is in ${check.status} state` };
    }

    return { account: result.account };
  }

  handleExecutionSuccess(accountId: string, tokensUsed: number): void {
    this.pool.recordUsage(accountId, tokensUsed);
    this.pool.recordSuccess(accountId);
  }

  handleExecutionFailure(accountId: string, errorReason: string): { newStatus: string; isTerminal: boolean } {
    const account = this.substrate.getAccount(accountId);
    if (!account) return { newStatus: "dead", isTerminal: true };

    const classification = this.circuitBreaker.classifyFailure(account, errorReason);
    const updated: CredentialAccount = {
      ...account,
      status: classification.newStatus,
      consecutiveFailures: account.consecutiveFailures + 1,
      cooldownUntilTimestampMs: Date.now() + classification.cooldownMs,
      deadReason: classification.isTerminal ? errorReason : undefined,
    };
    this.substrate.updateAccount(updated);

    return {
      newStatus: classification.newStatus,
      isTerminal: classification.isTerminal,
    };
  }
}
