/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 173: Zero-Dependency Broccoli Reactive Policy Observer
 *
 * Lifted from external source workspace/codemarie-new/src/core/policy/ReactivePolicyObserver.ts.
 * Monitors real-time tool execution streams, inspecting file mutation payloads to provide proactive
 * Joy-Zoning warnings (cross-layer imports, I/O in domain) before write execution completes. Zero external npm dependencies.
 */

import { BroccoliJoyZoningEngine } from "./broccolidb-joy-zoning.js";

export interface ToolExecutionPayload {
  name: string;
  params?: {
    path?: string;
    content?: string;
    diff?: string;
  };
}

export interface ReactiveObservationResult {
  warning?: string;
  interrupt?: boolean;
}

export class BroccoliReactivePolicyObserver {
  private readonly joyEngine: BroccoliJoyZoningEngine;

  constructor(joyEngine = new BroccoliJoyZoningEngine()) {
    this.joyEngine = joyEngine;
  }

  /**
   * Scans a tool execution payload for proactive Joy-Zoning layer violations.
   */
  public observeToolExecution(payload: ToolExecutionPayload, isPlanMode = false): ReactiveObservationResult {
    if (
      (payload.name === "write_to_file" || payload.name === "replace_file_content" || payload.name === "multi_replace_file_content") &&
      payload.params?.path
    ) {
      const filePath = payload.params.path;
      const layer = this.joyEngine.getLayer(filePath);
      const content = payload.params.content || payload.params.diff || "";

      if (layer === "domain") {
        // Rule 1: Cross-layer imports in Domain layer
        if (/import\s+.*from\s+["'].*(?:infrastructure|services|integrations|ui|webview)/i.test(content)) {
          if (isPlanMode) {
            return {
              warning: `📍 [PLANNING ADVISORY] DOMAIN file \`${filePath}\` contains cross-layer imports. Plan an interface in Domain and implementation in Infrastructure.`,
            };
          }
          return {
            warning: `📍 [LAYER ADVISORY] Writing to DOMAIN file \`${filePath}\` with cross-layer import. Domain files must not depend on Infrastructure/UI.`,
          };
        }

        // Rule 2: Raw I/O imports in Domain layer
        if (/import\s+.*from\s+["'](?:fs|node:fs|http|node:http|net|child_process)/i.test(content)) {
          if (isPlanMode) {
            return {
              warning: `📍 [PLANNING ADVISORY] DOMAIN file \`${filePath}\` contains raw I/O imports. Wrap I/O operations in an Infrastructure adapter.`,
            };
          }
          return {
            warning: `📍 [LAYER ADVISORY] Writing to DOMAIN file \`${filePath}\` with raw I/O import (fs/http). Domain logic should be pure.`,
          };
        }
      }
    }

    return {};
  }
}
