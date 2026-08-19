/**
 * runbook-catalog.ts
 *
 * Curated Catalog of Industry-Standard Runbook Templates and Workflow Presets (ADR-123).
 *
 * Provides ready-to-use, battle-tested finite state machine workflows for coding,
 * bug reproduction & patching, feature delivery, competitive benchmark solving, and security auditing.
 */

import type { RunbookSpec } from "../../../core/contracts/runbook.contracts.js";

export interface RunbookPresetMetadata {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly category: "software_engineering" | "debugging" | "delivery" | "security" | "benchmark";
  readonly description: string;
  readonly stageCount: number;
  readonly stages: readonly string[];
  readonly recommendedFor: string;
}

export interface RunbookInstantiationOptions {
  readonly customName?: string;
  readonly testCommand?: string;
  readonly docPath?: string;
  readonly maxAttemptsPerStage?: number;
}

export class RunbookCatalog {
  private static readonly PRESETS: Record<string, { metadata: RunbookPresetMetadata; specFactory: (opts?: RunbookInstantiationOptions) => RunbookSpec }> = {
    coding_loop: {
      metadata: {
        id: "coding_loop",
        name: "Standard Software Engineering Loop",
        icon: "💻",
        category: "software_engineering",
        description: "The gold-standard 4-stage engineering lifecycle: Plan, Execute, Review, and Handoff.",
        stageCount: 4,
        stages: ["plan", "execute", "review", "handoff"],
        recommendedFor: "General coding tasks, refactorings, and multi-file code modifications.",
      },
      specFactory: (opts) => ({
        name: opts?.customName || "standard-coding-loop",
        initial: "plan",
        nodes: {
          plan: {
            id: "plan",
            prompt: "Review the user's request and workspace. Establish a concrete, bounded plan with clear verification criteria.",
            beforeTransfer: [
              {
                type: "predicate",
                path: opts?.docPath || "progress.md",
                exists: true,
                nonEmpty: true,
              },
            ],
          },
          execute: {
            id: "execute",
            prompt: "Implement the required code changes according to the approved plan. Ensure clean code structure and type safety.",
            dynamicBeforeTransfer: {
              path: "current_entry",
              required: false,
            },
          },
          review: {
            id: "review",
            prompt: "Verify the implementation by running automated tests, checking for regressions, and validating edge cases.",
          },
          handoff: {
            id: "handoff",
            prompt: "Summarize the accomplished changes, verification results, and any follow-up guidance for the user.",
          },
        },
        edges: [
          { from: "plan", to: "execute", condition: "Plan and scope documented.", maxAttempts: opts?.maxAttemptsPerStage ?? 3 },
          { from: "execute", to: "review", condition: "Implementation completed.", maxAttempts: opts?.maxAttemptsPerStage ?? 3 },
          { from: "review", to: "handoff", condition: "Verification passed with zero regressions." },
          { from: "review", to: "execute", condition: "Issues detected during review needing fixes." },
        ],
      }),
    },

    bugfix_patch: {
      metadata: {
        id: "bugfix_patch",
        name: "Targeted Bug Triage & Surgical Patch",
        icon: "🩺",
        category: "debugging",
        description: "High-precision defect isolation: Reproduce bug, Root-Cause Diagnosis, Surgical Patch, and Verification.",
        stageCount: 5,
        stages: ["reproduce", "diagnose", "patch", "verify", "handoff"],
        recommendedFor: "Bug fixes, test failures, unexpected crashes, and regression resolution.",
      },
      specFactory: (opts) => ({
        name: opts?.customName || "bugfix-patch-workflow",
        initial: "reproduce",
        nodes: {
          reproduce: {
            id: "reproduce",
            prompt: "Reproduce the reported bug. Create a minimal reproduction test or capture the exact failure logs.",
            beforeTransfer: [
              {
                type: "checklist",
                items: ["Bug is consistently reproduced", "Reproduction script or test case created"],
              },
            ],
          },
          diagnose: {
            id: "diagnose",
            prompt: "Identify the root cause of the defect. Trace the call stack and inspect data flow.",
          },
          patch: {
            id: "patch",
            prompt: "Apply a minimal, surgical fix addressing the root cause without side effects.",
          },
          verify: {
            id: "verify",
            prompt: "Run the reproduction test to verify the fix, and run the broader test suite to ensure no regressions.",
          },
          handoff: {
            id: "handoff",
            prompt: "Deliver fix documentation detailing the root cause, patch rationale, and test results.",
          },
        },
        edges: [
          { from: "reproduce", to: "diagnose", condition: "Defect reproduced and scoped." },
          { from: "diagnose", to: "patch", condition: "Root cause pinpointed." },
          { from: "patch", to: "verify", condition: "Patch applied." },
          { from: "verify", to: "handoff", condition: "Reproduction test passes & zero regressions." },
          { from: "verify", to: "patch", condition: "Verification failed, revising patch." },
        ],
      }),
    },

    feature_delivery: {
      metadata: {
        id: "feature_delivery",
        name: "End-to-End Feature Delivery",
        icon: "🚀",
        category: "delivery",
        description: "Complete feature cycle: Discovery, API Spec, Implementation, Automated Tests, Documentation, and Delivery.",
        stageCount: 6,
        stages: ["discovery", "specification", "implementation", "verification", "documentation", "handoff"],
        recommendedFor: "Major new features, new API integrations, and significant architectural capabilities.",
      },
      specFactory: (opts) => ({
        name: opts?.customName || "feature-delivery-workflow",
        initial: "discovery",
        nodes: {
          discovery: {
            id: "discovery",
            prompt: "Explore existing codebase patterns, interfaces, and dependencies.",
          },
          specification: {
            id: "specification",
            prompt: "Author the formal data contracts, API schemas, and architecture plan.",
          },
          implementation: {
            id: "implementation",
            prompt: "Implement all feature components and wire them into the system.",
          },
          verification: {
            id: "verification",
            prompt: "Execute automated unit tests, integration tests, and composition checks.",
          },
          documentation: {
            id: "documentation",
            prompt: "Author walkthrough documentation, usage examples, and API guides.",
          },
          handoff: {
            id: "handoff",
            prompt: "Deliver completed feature to user with full summary and verification receipt.",
          },
        },
        edges: [
          { from: "discovery", to: "specification", condition: "Architecture requirements discovered." },
          { from: "specification", to: "implementation", condition: "Contracts approved." },
          { from: "implementation", to: "verification", condition: "Code written." },
          { from: "verification", to: "documentation", condition: "All tests green." },
          { from: "documentation", to: "handoff", condition: "Docs complete." },
        ],
      }),
    },

    benchmark_solve: {
      metadata: {
        id: "benchmark_solve",
        name: "Autonomous High-Reliability Competitive Solve",
        icon: "🏆",
        category: "benchmark",
        description: "StateM's 10-step atomic transition architecture: Direct Solve, Dynamic Manifest Check, Self-Review, Repair, and Graceful Handoff.",
        stageCount: 6,
        stages: ["direct_solve", "task_contract_check", "self_review", "repair", "deadline_handoff", "handoff"],
        recommendedFor: "Complex autonomous benchmarks (Terminal-Bench 2.1, SWE-bench), time-budgeted problem solving, and zero-subshell workflows.",
      },
      specFactory: (opts) => ({
        name: opts?.customName || "benchmark-competitive-solve",
        initial: "direct_solve",
        nodes: {
          direct_solve: {
            id: "direct_solve",
            prompt: "Quickly synthesize the primary solution to the task contract with high focus.",
          },
          task_contract_check: {
            id: "task_contract_check",
            prompt: "Validate that all output files, formats, and structural invariants are strictly satisfied.",
            dynamicBeforeTransfer: {
              path: "current_entry",
              required: true,
              minItems: 1,
            },
          },
          self_review: {
            id: "self_review",
            prompt: "Perform strict adversarial self-review against edge cases and corner conditions.",
          },
          repair: {
            id: "repair",
            prompt: "Repair any discrepancies or failures identified during self-review.",
          },
          deadline_handoff: {
            id: "deadline_handoff",
            prompt: "Prepare graceful handoff artifacts, preserve evidence receipts in BroccoliDB, and finalize state.",
          },
          handoff: {
            id: "handoff",
            prompt: "Final completion.",
          },
        },
        edges: [
          { from: "direct_solve", to: "task_contract_check", condition: "Initial solve synthesized." },
          { from: "task_contract_check", to: "self_review", condition: "Dynamic verification manifest passes." },
          { from: "self_review", to: "repair", condition: "Discrepancy detected in self-review." },
          { from: "repair", to: "task_contract_check", condition: "Fix applied, re-verifying." },
          { from: "self_review", to: "deadline_handoff", condition: "Self-review clean." },
          { from: "deadline_handoff", to: "handoff", condition: "Receipts committed to BroccoliDB." },
        ],
      }),
    },

    security_audit: {
      metadata: {
        id: "security_audit",
        name: "Security Vulnerability Audit & Hardening",
        icon: "🛡️",
        category: "security",
        description: "Comprehensive security workflow: Threat Scanning, Triage, Remediation, Defense Verification, and Audit Reporting.",
        stageCount: 5,
        stages: ["threat_scan", "triage", "remediation", "penetration_verify", "report"],
        recommendedFor: "Vulnerability analysis, dependency auditing, permission sandboxing, and security hardening.",
      },
      specFactory: (opts) => ({
        name: opts?.customName || "security-audit-workflow",
        initial: "threat_scan",
        nodes: {
          threat_scan: {
            id: "threat_scan",
            prompt: "Run automated security vulnerability scanners across dependencies and source files.",
          },
          triage: {
            id: "triage",
            prompt: "Classify findings by CVSS severity and estimate the blast radius of potential exploits.",
          },
          remediation: {
            id: "remediation",
            prompt: "Upgrade affected packages, patch unsafe inputs, and apply defense-in-depth sanitizers.",
          },
          penetration_verify: {
            id: "penetration_verify",
            prompt: "Verify that all patched attack vectors are closed and standard application tests continue to pass.",
          },
          report: {
            id: "report",
            prompt: "Generate a comprehensive executive security report with remediation audit trails.",
          },
        },
        edges: [
          { from: "threat_scan", to: "triage", condition: "Scan complete." },
          { from: "triage", to: "remediation", condition: "Threats classified." },
          { from: "remediation", to: "penetration_verify", condition: "Patches applied." },
          { from: "penetration_verify", to: "report", condition: "Vulnerabilities verified closed." },
          { from: "penetration_verify", to: "remediation", condition: "Residual risk detected, adjusting patch." },
        ],
      }),
    },
  };

  /**
   * Lists all available workflow presets.
   */
  static listPresets(): readonly RunbookPresetMetadata[] {
    return Object.values(this.PRESETS).map((p) => p.metadata);
  }

  /**
   * Retrieves a specific preset's metadata.
   */
  static getPresetMetadata(id: string): RunbookPresetMetadata | undefined {
    return this.PRESETS[id]?.metadata;
  }

  /**
   * Instantiates a fully configured RunbookSpec for a preset.
   */
  static instantiate(id: string, options: RunbookInstantiationOptions = {}): RunbookSpec {
    const entry = this.PRESETS[id];
    if (!entry) {
      const available = Object.keys(this.PRESETS).join(", ");
      throw new Error(`Runbook preset '${id}' not found. Available presets: ${available}`);
    }
    return entry.specFactory(options);
  }
}
