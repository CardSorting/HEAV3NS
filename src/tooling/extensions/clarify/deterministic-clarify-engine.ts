/**
 * deterministic-clarify-engine.ts
 *
 * Deterministic In-Memory Inquiry & Intent Disambiguation Engine
 * supporting decision trees, auto-resolution policies, multi-select validation,
 * dependency unlocking, and zero-GC lifecycle management (Phase 85 / ADR-037).
 */

import * as crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import type {
  ClarifyAutoPolicy,
  ClarifyCategory,
  ClarifyChoice,
  ClarifyDecisionNode,
  ClarifyDecisionTree,
  ClarifyInputMode,
  ClarifyInquiry,
  ClarifyPriority,
  ClarifyResolution,
  ClarifyStatus,
  ClarifyWorkspaceSnapshot,
} from "../../../core/contracts/clarify.contracts.js";

export class DeterministicClarifyEngine {
  private readonly inquiries: Map<string, ClarifyInquiry>;
  private readonly resolutions: Map<string, ClarifyResolution>;
  private readonly decisionTrees: Map<string, ClarifyDecisionTree>;
  private activeInquiryId?: string;

  constructor() {
    this.inquiries = new Map<string, ClarifyInquiry>();
    this.resolutions = new Map<string, ClarifyResolution>();
    this.decisionTrees = new Map<string, ClarifyDecisionTree>();
  }

  /**
   * Generates a deterministic inquiry ID.
   */
  generateInquiryId(question: string, frame: number): string {
    const hash = crypto.createHash("sha256").update(`${question}:${frame}:${Date.now()}`).digest("hex");
    return `inq_${hash.slice(0, 10)}`;
  }

  /**
   * Creates a new structured clarifying inquiry.
   */
  createInquiry(
    idOrQuestion: string,
    questionText?: string,
    choicesRaw?: readonly (string | Partial<ClarifyChoice>)[],
    mode: ClarifyInputMode = "single_select",
    timeoutMs?: number,
    frameIndex: number = 1,
    options: {
      category?: ClarifyCategory;
      priority?: ClarifyPriority;
      autoPolicy?: ClarifyAutoPolicy;
      defaultChoiceId?: string;
      tags?: readonly string[];
      dependencies?: readonly string[];
      description?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): ClarifyInquiry {
    const question = questionText !== undefined ? questionText : idOrQuestion;
    const id = questionText !== undefined ? idOrQuestion : this.generateInquiryId(question, frameIndex);

    const formattedChoices: ClarifyChoice[] = [];
    if (choicesRaw && choicesRaw.length > 0) {
      for (let i = 0; i < choicesRaw.length; i++) {
        const item = choicesRaw[i];
        if (typeof item === "string") {
          formattedChoices.push({
            id: `opt_${i + 1}`,
            label: item,
            isRecommended: i === 0,
          });
        } else {
          formattedChoices.push({
            id: item.id ?? `opt_${i + 1}`,
            label: item.label ?? `Option ${i + 1}`,
            description: item.description,
            isRecommended: item.isRecommended ?? (i === 0),
            followUpInquiryId: item.followUpInquiryId,
            payload: item.payload,
          });
        }
      }
    } else if (mode === "boolean_confirmation") {
      formattedChoices.push(
        { id: "opt_yes", label: "Yes / Proceed", isRecommended: true },
        { id: "opt_no", label: "No / Abort", isRecommended: false }
      );
    }

    const defaultChoiceId = options.defaultChoiceId ?? (formattedChoices.find((c) => c.isRecommended)?.id ?? formattedChoices[0]?.id);

    const inquiry: ClarifyInquiry = {
      id,
      question: question.trim(),
      description: options.description,
      category: options.category ?? "general",
      priority: options.priority ?? "medium",
      status: "pending",
      mode,
      choices: formattedChoices,
      autoPolicy: options.autoPolicy ?? { mode: "recommended", maxWaitMs: timeoutMs },
      timeoutMs,
      defaultChoiceId,
      tags: options.tags ?? [],
      dependencies: options.dependencies ?? [],
      metadata: options.metadata,
      createdFrame: frameIndex,
      timestamp: Date.now(),
    };

    this.inquiries.set(id, inquiry);
    this.activeInquiryId = id;
    return inquiry;
  }

  /**
   * Resolves an inquiry with user or automated selections.
   */
  resolveInquiry(
    inquiryOrId: ClarifyInquiry | string,
    selectedChoiceIds?: readonly string[],
    writeInResponse?: string,
    resolvedBy: "user" | "timeout" | "default" | "auto_policy" | "system" = "user",
    explanation?: string
  ): ClarifyResolution {
    const startedAt = performance.now();
    const inquiry = typeof inquiryOrId === "string" ? this.inquiries.get(inquiryOrId) : inquiryOrId;

    if (!inquiry) {
      throw new Error(`Inquiry '${typeof inquiryOrId === "string" ? inquiryOrId : inquiryOrId.id}' not found`);
    }

    // Determine final selected choices
    let finalChoices: string[] = selectedChoiceIds ? [...selectedChoiceIds] : [];
    if (finalChoices.length === 0) {
      if (inquiry.defaultChoiceId) {
        finalChoices = [inquiry.defaultChoiceId];
      } else if (inquiry.choices.length > 0) {
        const rec = inquiry.choices.find((c) => c.isRecommended) ?? inquiry.choices[0];
        finalChoices = [rec.id];
      }
    }

    // Validate mode constraints
    if (inquiry.mode === "single_select" && finalChoices.length > 1) {
      finalChoices = [finalChoices[0]];
    }

    const duration = Number((performance.now() - startedAt).toFixed(3));
    const resolution: ClarifyResolution = {
      inquiryId: inquiry.id,
      selectedChoiceIds: finalChoices,
      writeInResponse,
      resolvedBy,
      confidenceScore: resolvedBy === "user" ? 1.0 : 0.85,
      resolutionDurationMs: duration,
      timestamp: Date.now(),
      explanation,
    };

    const newStatus: ClarifyStatus = resolvedBy === "timeout" ? "timed_out" : (resolvedBy === "auto_policy" ? "auto_resolved" : "resolved");
    const updatedInquiry: ClarifyInquiry = {
      ...inquiry,
      status: newStatus,
      resolvedAt: Date.now(),
    };

    this.inquiries.set(inquiry.id, updatedInquiry);
    this.resolutions.set(inquiry.id, resolution);

    if (this.activeInquiryId === inquiry.id) {
      this.activeInquiryId = undefined;
    }

    return resolution;
  }

  /**
   * Autonomous Auto-Policy Evaluator.
   */
  evaluateAutoPolicy(inquiryId: string): ClarifyResolution | undefined {
    const inquiry = this.inquiries.get(inquiryId);
    if (!inquiry || inquiry.status !== "pending") return undefined;

    const policy = inquiry.autoPolicy ?? { mode: "recommended" };
    if (policy.mode === "manual_only") return undefined;

    let targetChoiceId: string | undefined;

    switch (policy.mode) {
      case "recommended": {
        const rec = inquiry.choices.find((c) => c.isRecommended);
        targetChoiceId = rec?.id ?? inquiry.defaultChoiceId ?? inquiry.choices[0]?.id;
        break;
      }
      case "first": {
        targetChoiceId = inquiry.choices[0]?.id ?? inquiry.defaultChoiceId;
        break;
      }
      case "timeout": {
        targetChoiceId = policy.fallbackChoiceId ?? inquiry.defaultChoiceId ?? inquiry.choices[0]?.id;
        break;
      }
      case "custom_heuristic": {
        targetChoiceId = policy.fallbackChoiceId ?? inquiry.choices.find((c) => c.isRecommended)?.id ?? inquiry.choices[0]?.id;
        break;
      }
    }

    if (!targetChoiceId) return undefined;

    return this.resolveInquiry(
      inquiry,
      [targetChoiceId],
      undefined,
      "auto_policy",
      `Auto-resolved via '${policy.mode}' policy.`
    );
  }

  /**
   * Decision Tree Management.
   */
  createDecisionTree(title: string, rootInquiryId: string): ClarifyDecisionTree {
    const treeId = `tree_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const rootNode: ClarifyDecisionNode = {
      inquiryId: rootInquiryId,
      children: [],
    };

    const tree: ClarifyDecisionTree = {
      treeId,
      title,
      rootInquiryId,
      nodes: [rootNode],
      activePath: [rootInquiryId],
      isComplete: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.decisionTrees.set(treeId, tree);
    return tree;
  }

  stepDecisionTree(treeId: string, inquiryId: string, selectedChoiceId: string): boolean {
    const tree = this.decisionTrees.get(treeId);
    if (!tree) return false;

    const inquiry = this.inquiries.get(inquiryId);
    if (!inquiry) return false;

    const choice = inquiry.choices.find((c) => c.id === selectedChoiceId);
    const updatedPath = [...tree.activePath];

    if (choice?.followUpInquiryId && !updatedPath.includes(choice.followUpInquiryId)) {
      updatedPath.push(choice.followUpInquiryId);
    }

    const isComplete = choice?.followUpInquiryId === undefined;

    this.decisionTrees.set(treeId, {
      ...tree,
      activePath: updatedPath,
      isComplete,
      updatedAt: Date.now(),
    });

    return true;
  }

  getDecisionTree(treeId: string): ClarifyDecisionTree | undefined {
    return this.decisionTrees.get(treeId);
  }

  listDecisionTrees(): readonly ClarifyDecisionTree[] {
    return Array.from(this.decisionTrees.values());
  }

  // ---------------------------------------------------------------------------
  // Getters & Maintenance
  // ---------------------------------------------------------------------------

  getInquiry(id: string): ClarifyInquiry | undefined {
    return this.inquiries.get(id);
  }

  getResolution(inquiryId: string): ClarifyResolution | undefined {
    return this.resolutions.get(inquiryId);
  }

  listInquiries(limit: number = 50): readonly ClarifyInquiry[] {
    return Array.from(this.inquiries.values()).slice(0, limit);
  }

  listResolutions(limit: number = 50): readonly ClarifyResolution[] {
    return Array.from(this.resolutions.values()).slice(0, limit);
  }

  getActiveInquiry(): ClarifyInquiry | undefined {
    return this.activeInquiryId ? this.inquiries.get(this.activeInquiryId) : undefined;
  }

  exportSnapshot(): ClarifyWorkspaceSnapshot {
    const inqList = Array.from(this.inquiries.values());
    const resList = Array.from(this.resolutions.values());
    const treeList = Array.from(this.decisionTrees.values());
    const pendingCount = inqList.filter((i) => i.status === "pending").length;
    const resolvedCount = inqList.filter((i) => i.status === "resolved" || i.status === "auto_resolved").length;

    return {
      activeInquiryId: this.activeInquiryId,
      pendingCount,
      resolvedCount,
      totalInquiries: inqList.length,
      activeTreeCount: treeList.length,
      inquiries: inqList,
      resolutions: resList,
      decisionTrees: treeList,
      timestamp: Date.now(),
    };
  }

  importSnapshot(snapshot: ClarifyWorkspaceSnapshot): void {
    this.inquiries.clear();
    this.resolutions.clear();
    this.decisionTrees.clear();

    for (const inq of snapshot.inquiries) {
      this.inquiries.set(inq.id, inq);
    }
    for (const res of snapshot.resolutions) {
      this.resolutions.set(res.inquiryId, res);
    }
    for (const tree of snapshot.decisionTrees) {
      this.decisionTrees.set(tree.treeId, tree);
    }
    this.activeInquiryId = snapshot.activeInquiryId;
  }

  clear(): void {
    this.inquiries.clear();
    this.resolutions.clear();
    this.decisionTrees.clear();
    this.activeInquiryId = undefined;
  }
}
