import type {
  EnvironmentSessionState,
  IBroccoliEnvironmentSubstrate,
} from "../../../core/contracts/environment.contracts.js";

/**
 * In-Memory Broccolidb Environment Substrate.
 *
 * Tracks active execution sessions, working directories, and execution counts
 * in zero-GC memory structures.
 */
export class BroccoliEnvironmentSubstrate implements IBroccoliEnvironmentSubstrate {
  private readonly sessions: Map<string, EnvironmentSessionState> = new Map();
  private totalExecutions: number = 0;

  getSession(sessionId: string): EnvironmentSessionState | undefined {
    return this.sessions.get(sessionId);
  }

  saveSession(state: EnvironmentSessionState): void {
    this.sessions.set(state.sessionId, state);
  }

  listSessions(): readonly EnvironmentSessionState[] {
    return Array.from(this.sessions.values());
  }

  getExecutionCount(): number {
    return this.totalExecutions;
  }

  incrementExecutionCount(): number {
    this.totalExecutions++;
    return this.totalExecutions;
  }

  setExecutionCount(count: number): void {
    this.totalExecutions = count;
  }

  clear(): void {
    this.sessions.clear();
    this.totalExecutions = 0;
  }
}
