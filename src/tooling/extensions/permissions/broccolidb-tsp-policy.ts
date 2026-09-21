/**
 * [LAYER: TOOLING EXTENSION]
 * Pass 169: Zero-Dependency Broccoli TSP Policy Plugin
 *
 * Lifted from external source workspace/codemarie-new/src/core/policy/TspPolicyPlugin.ts.
 * Implements configurable architectural enforcement themes (strict, relaxed, safety),
 * exception rule registry (whitelists and exclusions), and real-time layer boundary policy evaluation. Zero external npm dependencies.
 */

export type EnforcementTheme = "strict" | "relaxed" | "safety";

export interface ExceptionRule {
  type: "whitelist" | "exclusion";
  extension: string;
  notes?: string;
}

export interface PolicyEvaluationResult {
  passed: boolean;
  theme: EnforcementTheme;
  violations: string[];
}

export class BroccoliTspPolicyPlugin {
  private theme: EnforcementTheme;
  private readonly exceptions: ExceptionRule[] = [];

  constructor(theme: EnforcementTheme = "safety") {
    this.theme = theme;
  }

  /**
   * Sets the active enforcement theme.
   */
  public setTheme(theme: EnforcementTheme): void {
    this.theme = theme;
  }

  /**
   * Returns current enforcement theme.
   */
  public getTheme(): EnforcementTheme {
    return this.theme;
  }

  /**
   * Registers a file extension bypass exception rule.
   */
  public addExceptionRule(rule: ExceptionRule): void {
    this.exceptions.push(rule);
  }

  /**
   * Checks whether a given file path is exempted by an exception rule.
   */
  public isExempted(filePath: string): boolean {
    return this.exceptions.some((e) => filePath.endsWith(e.extension));
  }

  /**
   * Evaluates architectural compliance based on active enforcement theme.
   */
  public evaluatePolicy(filePath: string, lineCount: number, hasLayerTag: boolean): PolicyEvaluationResult {
    const violations: string[] = [];

    if (this.isExempted(filePath)) {
      return { passed: true, theme: this.theme, violations: [] };
    }

    if (this.theme === "strict") {
      if (!hasLayerTag) {
        violations.push("Strict Theme: File lacks mandatory architectural [LAYER: ...] header tag.");
      }
      if (lineCount > 300) {
        violations.push(`Strict Theme: File length (${lineCount} lines) exceeds 300-line strict limit.`);
      }
    } else if (this.theme === "safety") {
      if (lineCount > 1500) {
        violations.push(`Safety Theme: File length (${lineCount} lines) exceeds 1500-line safety threshold.`);
      }
    }

    return {
      passed: violations.length === 0,
      theme: this.theme,
      violations,
    };
  }
}
