import type {
  CredentialAccount,
  IBroccoliCredentialSubstrate,
} from "../../../core/contracts/credential.contracts.js";

/**
 * Zero-GC in-memory storage substrate for credential accounts in Broccolidb.
 */
export class BroccoliCredentialSubstrate implements IBroccoliCredentialSubstrate {
  private readonly accounts = new Map<string, CredentialAccount>();

  addAccount(account: CredentialAccount): void {
    this.accounts.set(account.id, account);
  }

  updateAccount(account: CredentialAccount): void {
    this.accounts.set(account.id, account);
  }

  removeAccount(accountId: string): void {
    this.accounts.delete(accountId);
  }

  getAccount(accountId: string): CredentialAccount | undefined {
    return this.accounts.get(accountId);
  }

  listAccounts(provider?: string): readonly CredentialAccount[] {
    const list = Array.from(this.accounts.values());
    if (provider) {
      return list.filter((a) => a.provider === provider);
    }
    return list;
  }

  clear(): void {
    this.accounts.clear();
  }
}
