/**
 * runbook-humanizer.ts
 *
 * Plain-English Diagnostic Translator, Executive Storyteller, and Visual ASCII Pipeline Renderer
 * for StateM / Runbook FSM (ADR-123).
 *
 * Translates low-level finite state machine mechanics, file predicates, JSON paths, and gate failures
 * into empathetic, actionable, and approachable guidance for non-technical users and stakeholders.
 */

import type {
  RunbookSpec,
  RunbookNodeDefinition,
  RunbookRuntimeState,
  RunbookHistoryEvent,
  CheckExecutionResult,
} from "../../../core/contracts/runbook.contracts.js";

export interface HumanizedStateInfo {
  readonly nodeId: string;
  readonly displayName: string;
  readonly category: "planning" | "execution" | "verification" | "delivery" | "recovery" | "custom";
  readonly icon: string;
  readonly summary: string;
  readonly nextPermittedActions: readonly string[];
  readonly progressPercent: number;
}

export interface HumanizedGateDiagnostic {
  readonly title: string;
  readonly severity: "blocking" | "warning" | "advisory";
  readonly plainExplanation: string;
  readonly technicalDetail: string;
  readonly suggestedRemediation: string;
}

export interface HumanizedWorkflowStory {
  readonly runId: string;
  readonly workflowName: string;
  readonly activeStage: HumanizedStateInfo;
  readonly whatWasDone: readonly string[];
  readonly whatIsHappeningNow: string;
  readonly whatWillHappenNext: readonly string[];
  readonly healthStatus: "on_track" | "gate_blocked" | "completed" | "retrying";
  readonly plainSummary: string;
}

export class RunbookHumanizer {
  private static readonly KNOWN_STAGE_PROFILES: Record<
    string,
    { displayName: string; icon: string; category: HumanizedStateInfo["category"]; summary: string }
  > = {
    plan: {
      displayName: "Planning & Scoping",
      icon: "📋",
      category: "planning",
      summary: "Reviewing objectives, inspecting requirements, and establishing the execution strategy.",
    },
    init: {
      displayName: "Initialization & Setup",
      icon: "🚀",
      category: "planning",
      summary: "Bootstrapping environment and validating prerequisites.",
    },
    discovery: {
      displayName: "Discovery & Architecture",
      icon: "🔍",
      category: "planning",
      summary: "Exploring the repository, analyzing dependencies, and drafting specifications.",
    },
    execute: {
      displayName: "Active Implementation",
      icon: "⚡",
      category: "execution",
      summary: "Applying code changes, building features, and executing tasks.",
    },
    work: {
      displayName: "Work in Progress",
      icon: "🛠️",
      category: "execution",
      summary: "Performing core operations according to the approved plan.",
    },
    direct_solve: {
      displayName: "Fast-Track Solution",
      icon: "🎯",
      category: "execution",
      summary: "Directly synthesizing code modifications for focused tasks.",
    },
    repair: {
      displayName: "Defect Repair & Healing",
      icon: "🩺",
      category: "recovery",
      summary: "Resolving detected failures, test errors, and lint regressions.",
    },
    review: {
      displayName: "Quality & Verification Review",
      icon: "🛡️",
      category: "verification",
      summary: "Running automated tests, auditing output artifacts, and verifying predicates.",
    },
    verify: {
      displayName: "Quality Verification",
      icon: "✅",
      category: "verification",
      summary: "Ensuring all quality criteria and benchmarks are fully met.",
    },
    handoff: {
      displayName: "Completion & Delivery",
      icon: "🏁",
      category: "delivery",
      summary: "Packaging artifacts, generating walkthrough documentation, and handing off to the user.",
    },
    done: {
      displayName: "Finished",
      icon: "🎉",
      category: "delivery",
      summary: "Workflow completed successfully with all gates verified.",
    },
  };

  /**
   * Translates a raw FSM node into human-friendly representation.
   */
  static humanizeState(
    nodeName: string,
    nodeDef?: RunbookNodeDefinition,
    spec?: RunbookSpec
  ): HumanizedStateInfo {
    const lower = nodeName.toLowerCase();
    const profile = this.KNOWN_STAGE_PROFILES[lower] ?? {
      displayName: this.formatTitle(nodeName),
      icon: "📌",
      category: "custom",
      summary: nodeDef?.prompt
        ? this.truncate(nodeDef.prompt.split("\n")[0].trim(), 120)
        : "Executing stage operations.",
    };

    const nextPermittedActions: string[] = [];
    if (spec?.edges) {
      for (const edge of spec.edges) {
        if (edge.from === nodeName) {
          nextPermittedActions.push(
            `Move to '${this.formatTitle(edge.to)}' ${edge.condition ? `(${edge.condition})` : ""}`
          );
        }
      }
    }

    const progressPercent = this.calculateProgressPercent(nodeName, spec);

    return {
      nodeId: nodeName,
      displayName: profile.displayName,
      category: profile.category,
      icon: profile.icon,
      summary: profile.summary,
      nextPermittedActions,
      progressPercent,
    };
  }

  /**
   * Translates a technical predicate failure into approachable plain-English instructions.
   */
  static humanizeGateFailure(
    failure: { path?: string; reason?: string; error?: string; errors?: readonly string[]; passed?: boolean },
    nodeName: string,
    targetName?: string
  ): HumanizedGateDiagnostic {
    const rawErrors = "errors" in failure && failure.errors ? failure.errors : [];
    const errorStr = rawErrors.join("; ") || (failure as any).error || (failure as any).reason || "Predicate condition not met";
    const filePath = (failure as any).path || "Target file";

    let title = "Verification Check Incomplete";
    let plainExplanation = `The workflow paused before entering '${this.formatTitle(targetName || nodeName)}' because a quality check is not ready yet.`;
    let suggestedRemediation = "Review the requirements for this stage and retry the transition.";

    if (errorStr.includes("does not exist")) {
      title = `Missing File: ${filePath}`;
      plainExplanation = `The required file '${filePath}' has not been created yet.`;
      suggestedRemediation = `Ensure the agent creates or writes to '${filePath}' before advancing.`;
    } else if (errorStr.includes("is empty")) {
      title = `Empty File: ${filePath}`;
      plainExplanation = `The file '${filePath}' exists, but it contains no content.`;
      suggestedRemediation = `Populate '${filePath}' with required data or summaries.`;
    } else if (errorStr.includes("JSONPath")) {
      title = `Data Field Verification Pending: ${filePath}`;
      plainExplanation = `The file '${filePath}' is missing expected fields or values (${errorStr}).`;
      suggestedRemediation = `Update '${filePath}' so that the evaluated JSON properties match the expected values.`;
    } else if (errorStr.includes("does not match pattern")) {
      title = `Pattern Check Pending: ${filePath}`;
      plainExplanation = `The content in '${filePath}' does not match the required format.`;
      suggestedRemediation = `Verify the format of '${filePath}' satisfies the stage criteria.`;
    } else if (errorStr.includes("dynamic_before_transfer")) {
      title = "Dynamic Micro-Check Pending";
      plainExplanation = `This stage requires registered verification items from current execution before progressing.`;
      suggestedRemediation = `Register and satisfy the required dynamic checks using 'runbook_dynamic_write'.`;
    }

    return {
      title,
      severity: "blocking",
      plainExplanation,
      technicalDetail: errorStr,
      suggestedRemediation,
    };
  }

  /**
   * Generates an executive plain-English narrative story for stakeholders and non-technical users.
   */
  static humanizeStory(
    state: RunbookRuntimeState,
    spec: RunbookSpec,
    history: readonly RunbookHistoryEvent[] = []
  ): HumanizedWorkflowStory {
    const activeStage = this.humanizeState(state.current, spec.nodes[state.current], spec);

    // What was done
    const whatWasDone: string[] = [];
    const completedTransitions = history.filter((h) => h.event === "goto" && h.from !== h.to);
    for (const trans of completedTransitions) {
      const fromTitle = this.formatTitle(trans.from || "Start");
      const toTitle = this.formatTitle(trans.to || "Next");
      whatWasDone.push(`Completed '${fromTitle}' stage and transitioned to '${toTitle}'.`);
    }

    if (whatWasDone.length === 0) {
      whatWasDone.push(`Initialized workflow '${spec.name}' at stage '${activeStage.displayName}'.`);
    }

    // What is happening now
    const whatIsHappeningNow = `Currently in '${activeStage.displayName}'. ${activeStage.summary}`;

    // What will happen next
    const whatWillHappenNext: string[] = [];
    const outgoingEdges = (spec.edges || []).filter((e) => e.from === state.current);
    if (outgoingEdges.length === 0) {
      whatWillHappenNext.push("This is the final stage. The workflow will conclude upon completion.");
    } else {
      for (const edge of outgoingEdges) {
        whatWillHappenNext.push(
          `Transition to '${this.formatTitle(edge.to)}' once ${edge.condition || "all gates pass"}.`
        );
      }
    }

    let healthStatus: HumanizedWorkflowStory["healthStatus"] = "on_track";
    const recentBlocked = history.slice(-3).some((h) => h.event === "goto_blocked");
    if (state.current === "handoff" || state.current === "done") {
      healthStatus = "completed";
    } else if (recentBlocked) {
      healthStatus = "gate_blocked";
    }

    const plainSummary = [
      `🎯 **Workflow**: ${this.formatTitle(spec.name)}`,
      `📍 **Active Stage**: ${activeStage.icon} ${activeStage.displayName} (${activeStage.progressPercent}% complete)`,
      `ℹ️ **Overview**: ${activeStage.summary}`,
      `🔜 **Next Step**: ${whatWillHappenNext[0] || "Handoff to user."}`,
    ].join("\n");

    return {
      runId: state.runId,
      workflowName: spec.name,
      activeStage,
      whatWasDone,
      whatIsHappeningNow,
      whatWillHappenNext,
      healthStatus,
      plainSummary,
    };
  }

  /**
   * Renders a rich ASCII/ANSI pipeline breadcrumb trail showing progress across stages.
   * Example: [✔ 1. Plan] ──► [● 2. Execute (⚡ ACTIVE)] ──► [○ 3. Review] ──► [○ 4. Handoff]
   */
  static renderAsciiPipeline(
    spec: RunbookSpec,
    currentState: string,
    options: { useColor?: boolean } = {}
  ): string {
    const useColor = options.useColor ?? true;
    const nodeKeys = Object.keys(spec.nodes);
    if (nodeKeys.length === 0) return "(No nodes in runbook)";

    const currentIndex = nodeKeys.indexOf(currentState);
    const parts: string[] = [];

    nodeKeys.forEach((key, index) => {
      const isPast = currentIndex !== -1 && index < currentIndex;
      const isCurrent = key === currentState;
      const isFuture = currentIndex === -1 || index > currentIndex;

      const profile = this.KNOWN_STAGE_PROFILES[key.toLowerCase()];
      const icon = profile?.icon || "📌";
      const name = profile?.displayName || this.formatTitle(key);

      let badge = "";
      if (isPast) {
        badge = useColor
          ? `\x1b[1;32m[✔ ${index + 1}. ${name}]\x1b[0m`
          : `[✔ ${index + 1}. ${name}]`;
      } else if (isCurrent) {
        badge = useColor
          ? `\x1b[1;36;7m ${icon} ${index + 1}. ${name} (ACTIVE) \x1b[0m`
          : `[● ${index + 1}. ${name} (ACTIVE)]`;
      } else {
        badge = useColor
          ? `\x1b[90m[○ ${index + 1}. ${name}]\x1b[0m`
          : `[○ ${index + 1}. ${name}]`;
      }

      parts.push(badge);
    });

    const arrow = useColor ? ` \x1b[1;35m──►\x1b[0m ` : ` ──► `;
    return parts.join(arrow);
  }

  /**
   * Formats an identifier (e.g. `direct_solve`) into a clean Title Case string.
   */
  static formatTitle(id: string): string {
    if (!id) return "";
    return id
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  private static calculateProgressPercent(nodeName: string, spec?: RunbookSpec): number {
    if (!spec?.nodes) return 0;
    const nodeKeys = Object.keys(spec.nodes);
    if (nodeKeys.length === 0) return 0;

    const idx = nodeKeys.indexOf(nodeName);
    if (idx === -1) return 0;
    if (idx === nodeKeys.length - 1) return 100;

    return Math.round(((idx + 1) / nodeKeys.length) * 100);
  }

  private static truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen - 3) + "...";
  }
}
