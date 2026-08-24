import { BroccoliDbTable } from "../../../sessions/extensions/substrate/broccolidb-table.js";

export interface AuthTokenRecord {
  id?: string;
  provider: string;
  token: string;
  updatedAt: number;
}

/**
 * Pass 97 & Phase 112: Hybrid BroccoliDB-Backed Auth Storage Vault
 * Backed by high-velocity in-memory BroccoliDbTable with secondary equality & sorted indices.
 * Manages runtime provider tokens, API keys, and authorization credentials safely with sub-microsecond latency.
 */
export class AuthStorageVault {
  private readonly table: BroccoliDbTable<AuthTokenRecord & Record<string, unknown>>;

  constructor() {
    this.table = new BroccoliDbTable("auth_credentials_vault");
    this.table.createIndex("provider");
    this.table.createSortedIndex("updatedAt");
  }

  setToken(provider: string, token: string): AuthTokenRecord {
    const key = provider.toLowerCase();
    const record: AuthTokenRecord & Record<string, unknown> = {
      id: key,
      provider: key,
      token,
      updatedAt: Date.now(),
    };
    this.table.put(key, record);
    return record;
  }

  getToken(provider: string): string | undefined {
    const record = this.table.get(provider.toLowerCase());
    return record?.token as string | undefined;
  }

  hasToken(provider: string): boolean {
    const record = this.table.get(provider.toLowerCase());
    const token = record?.token as string | undefined;
    return token !== undefined && token.trim().length > 0;
  }

  clearToken(provider: string): boolean {
    return this.table.delete(provider.toLowerCase());
  }

  listProviders(): readonly string[] {
    return this.table.getAll().map((rec) => (rec.provider as string) || (rec.id as string));
  }

  getTable(): BroccoliDbTable<AuthTokenRecord & Record<string, unknown>> {
    return this.table;
  }
}

