import type {
  AutomationBlueprint,
  BlueprintSlot,
  CronJobManifest,
} from "../../../core/contracts/cron.contracts.js";

/**
 * DeterministicBlueprintCatalog.
 * Absorbed under ADR-016 (AKD-DSO Osmosis Paradigm).
 *
 * Provides typed, parameterized automation blueprint templates with schema-validated
 * slot interpolation and pre-packaged production workflows.
 */
export class DeterministicBlueprintCatalog {
  private readonly catalog = new Map<string, AutomationBlueprint>();

  constructor() {
    this.registerBuiltinBlueprints();
  }

  private registerBuiltinBlueprints(): void {
    this.registerBlueprint({
      key: "daily_summary",
      title: "Daily Workspace & Git Summary",
      description: "Generates an aggregated summary of git changes, open files, and active session tasks.",
      category: "productivity",
      scheduleTemplate: "0 {hour} * * {weekdays}",
      promptTemplate: "Review workspace git status, summarize modified files, and produce a daily report for {user}.",
      slots: [
        { name: "hour", type: "number", label: "Hour of Day (0-23)", default: 9, help: "Hour in 24h format" },
        { name: "weekdays", type: "weekdays", label: "Days of Week", default: "1-5", options: ["*", "1-5", "0,6"] },
        { name: "user", type: "text", label: "Target User", default: "Developer", optional: true },
      ],
      defaultTags: ["summary", "daily", "git"],
    });

    this.registerBlueprint({
      key: "health_check_monitor",
      title: "Engine Health & Subsystem Monitor",
      description: "Periodically audits engine health aggregator, memory slabs, and circuit breaker status.",
      category: "operations",
      scheduleTemplate: "*/{intervalMinutes} * * * *",
      promptTemplate: "Run system health aggregator audit and verify all subsystems are healthy.",
      slots: [
        { name: "intervalMinutes", type: "number", label: "Interval in Minutes", default: 15, options: ["5", "15", "30", "60"] },
      ],
      defaultTags: ["health", "monitoring", "operations"],
    });

    this.registerBlueprint({
      key: "workspace_cleaner",
      title: "Scratch & Ephemeral Workspace Cleaner",
      description: "Scans and cleans temporary scratch directories, orphaned test outputs, and unused logs.",
      category: "maintenance",
      scheduleTemplate: "0 0 * * {weekdays}",
      promptTemplate: "Clean orphaned scratch files and temporary test outputs older than {maxAgeHours} hours.",
      slots: [
        { name: "weekdays", type: "weekdays", label: "Days of Week", default: "0", options: ["*", "1-5", "0,6", "0"] },
        { name: "maxAgeHours", type: "number", label: "Max Age (Hours)", default: 24 },
      ],
      defaultTags: ["cleaner", "maintenance", "storage"],
    });

    this.registerBlueprint({
      key: "dependency_audit",
      title: "Package Dependency & Security Audit",
      description: "Runs package dependency checks and validates pinned versions against security baselines.",
      category: "security",
      scheduleTemplate: "0 8 * * 1",
      promptTemplate: "Audit package dependencies for security advisories and pinned version compliance.",
      slots: [],
      defaultTags: ["security", "audit", "dependencies"],
    });

    this.registerBlueprint({
      key: "benchmark_guard",
      title: "Continuous Benchmark & SLA Guard",
      description: "Executes micro-benchmarks and verifies turn latency (<1ms) and throughput (>1000 fps).",
      category: "performance",
      scheduleTemplate: "0 */{intervalHours} * * *",
      promptTemplate: "Run performance benchmark suite and verify all repository SLAs pass.",
      slots: [
        { name: "intervalHours", type: "number", label: "Interval in Hours", default: 4 },
      ],
      defaultTags: ["performance", "benchmark", "sla"],
    });
  }

  registerBlueprint(blueprint: AutomationBlueprint): void {
    this.catalog.set(blueprint.key, Object.freeze(blueprint));
  }

  getBlueprint(key: string): AutomationBlueprint | undefined {
    return this.catalog.get(key);
  }

  listBlueprints(categoryFilter?: string): readonly AutomationBlueprint[] {
    const list = Array.from(this.catalog.values());
    if (categoryFilter) {
      return Object.freeze(list.filter((b) => b.category === categoryFilter));
    }
    return Object.freeze(list);
  }

  /**
   * Validates user-supplied slots and interpolates them safely into a valid CronJobManifest template.
   */
  materializeBlueprint(
    key: string,
    jobId: string,
    slotValues: Record<string, unknown> = {}
  ): Omit<CronJobManifest, "status" | "totalRuns" | "createdTick"> {
    const blueprint = this.catalog.get(key);
    if (!blueprint) {
      throw new Error(`Automation blueprint '${key}' not found in catalog`);
    }

    const resolvedSlots: Record<string, unknown> = {};

    // Validate slots against schema
    for (const slot of blueprint.slots) {
      let value = slotValues[slot.name];
      if (value === undefined || value === null) {
        if (!slot.optional && slot.default === undefined) {
          throw new Error(`Missing required slot '${slot.name}' for blueprint '${key}'`);
        }
        value = slot.default;
      }

      if (slot.options && slot.options.length > 0 && slot.strict !== false) {
        const strVal = String(value);
        if (!slot.options.includes(strVal)) {
          throw new Error(`Invalid value '${strVal}' for slot '${slot.name}'. Allowed: ${slot.options.join(", ")}`);
        }
      }

      resolvedSlots[slot.name] = value;
    }

    // Safely interpolate scheduleTemplate and promptTemplate
    const scheduleExpression = this.interpolateTemplate(blueprint.scheduleTemplate, resolvedSlots);
    const prompt = this.interpolateTemplate(blueprint.promptTemplate, resolvedSlots);

    return {
      id: jobId,
      name: blueprint.title,
      description: blueprint.description,
      scheduleType: "cron",
      scheduleExpression,
      prompt,
      blueprintKey: key,
      blueprintSlots: Object.freeze(resolvedSlots),
    };
  }

  private interpolateTemplate(template: string, slots: Record<string, unknown>): string {
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, slotName) => {
      if (slotName in slots) {
        return String(slots[slotName]);
      }
      return match;
    });
  }
}
