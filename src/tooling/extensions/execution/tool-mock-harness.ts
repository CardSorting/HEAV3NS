/**
 * tool-mock-harness.ts
 *
 * Deterministic Mock Sandbox & Fixture Replay Harness.
 * Enables offline benchmarking, unit testing, and deterministic evaluation
 * without mutating real workspaces or firing external network calls.
 */

import * as crypto from "node:crypto";
import type { ToolExecutionRecord } from "../../../core/contracts/tooling.contracts.js";

export type MockMode = "live" | "mock_only" | "record" | "replay";

export type MockHandler = (
  args: Record<string, unknown>,
  cwd: string
) => Promise<unknown> | unknown;

export interface MockFixture {
  readonly toolName: string;
  readonly argsHash: string;
  readonly args: Record<string, unknown>;
  readonly result: unknown;
  readonly durationMs: number;
}

export class ToolMockHarness {
  private mode: MockMode = "live";
  private mockHandlers = new Map<string, MockHandler[]>();
  private fixtures = new Map<string, MockFixture>();
  private recordedFixtures: MockFixture[] = [];

  constructor(options: { mode?: MockMode } = {}) {
    this.mode = options.mode ?? "live";
  }

  public setMode(mode: MockMode): void {
    this.mode = mode;
  }

  public getMode(): MockMode {
    return this.mode;
  }

  /**
   * Generates a deterministic signature hash for tool arguments.
   */
  public generateHash(toolName: string, args: Record<string, unknown>): string {
    const serialized = JSON.stringify(args, Object.keys(args).sort());
    return crypto.createHash("sha256").update(`${toolName}:${serialized}`).digest("hex").slice(0, 16);
  }

  /**
   * Registers a mock handler for a specific tool.
   */
  public mockTool(toolName: string, handler: MockHandler): this {
    const list = this.mockHandlers.get(toolName) || [];
    list.push(handler);
    this.mockHandlers.set(toolName, list);
    return this;
  }

  /**
   * Loads fixtures for replay mode.
   */
  public loadFixtures(fixtures: readonly MockFixture[]): void {
    for (const f of fixtures) {
      this.fixtures.set(`${f.toolName}:${f.argsHash}`, f);
    }
  }

  /**
   * Checks if an execution should be intercepted by mock or replay.
   */
  public async interceptExecution(
    toolName: string,
    args: Record<string, unknown>,
    cwd: string
  ): Promise<{ intercepted: boolean; result?: unknown }> {
    if (this.mode === "replay") {
      const hash = this.generateHash(toolName, args);
      const fixture = this.fixtures.get(`${toolName}:${hash}`);
      if (fixture) {
        return { intercepted: true, result: fixture.result };
      }
      throw new Error(`[Mock Replay Miss]: No fixture found for '${toolName}' with hash ${hash}`);
    }

    if (this.mode === "mock_only" || this.mockHandlers.has(toolName)) {
      const handlers = this.mockHandlers.get(toolName);
      if (handlers && handlers.length > 0) {
        const handler = handlers[handlers.length - 1];
        const res = await handler(args, cwd);
        return { intercepted: true, result: res };
      }
      if (this.mode === "mock_only") {
        throw new Error(`[Mock Only]: Tool '${toolName}' was invoked with no registered mock handler.`);
      }
    }

    return { intercepted: false };
  }

  /**
   * Records a completed execution when in record mode.
   */
  public recordExecution(record: ToolExecutionRecord): void {
    if (this.mode === "record" && record.success) {
      const toolName = record.name || record.toolName || "";
      const args = record.args || {};
      const hash = this.generateHash(toolName, args);
      this.recordedFixtures.push({
        toolName,
        argsHash: hash,
        args,
        result: record.result !== undefined ? record.result : record.output,
        durationMs: record.durationMs ?? 0,
      });
    }
  }

  /**
   * Returns all recorded fixtures.
   */
  public getRecordedFixtures(): readonly MockFixture[] {
    return this.recordedFixtures;
  }

  /**
   * Resets all mocks and recorded fixtures.
   */
  public reset(): void {
    this.mockHandlers.clear();
    this.fixtures.clear();
    this.recordedFixtures = [];
    this.mode = "live";
  }
}
