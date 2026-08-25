/**
 * failure-diagnostic-doctor.ts
 *
 * Automated Tool Execution Failure Diagnostic & Remediation Engine.
 * Analyzes tool execution errors and generates actionable root-cause insights
 * and recommended auto-repair tool calls.
 */

export interface FailureDiagnosis {
  readonly toolName: string;
  readonly category: "file_not_found" | "patch_mismatch" | "syntax_error" | "lock_contention" | "schema_validation" | "timeout" | "permission_denied" | "unknown";
  readonly rootCause: string;
  readonly suggestions: string[];
  readonly recommendedTool?: {
    readonly name: string;
    readonly args: Record<string, unknown>;
  };
}

export class FailureDiagnosticDoctor {
  /**
   * Diagnoses a tool failure and provides recovery strategies.
   */
  public diagnose(toolName: string, errorMsg: string, args: Record<string, unknown> = {}): FailureDiagnosis {
    const err = (errorMsg || "").toLowerCase();

    // File not found (ENOENT)
    if (err.includes("enoent") || err.includes("no such file") || err.includes("cannot find file") || err.includes("not found")) {
      const targetPath = String(args.path || args.filePath || "");
      return {
        toolName,
        category: "file_not_found",
        rootCause: `Target path '${targetPath || "unknown"}' does not exist on disk.`,
        suggestions: [
          `Use 'find_files_by_pattern' to locate similar or moved files.`,
          `Use 'get_workspace_file_tree' to inspect existing directory structure.`,
          `If writing a new file, parent directories will be auto-created with 'write_file'.`,
        ],
        recommendedTool: targetPath
          ? { name: "find_files_by_pattern", args: { pattern: `*${targetPath.split("/").pop()}*` } }
          : undefined,
      };
    }

    // Patch / Hunk mismatch
    if (err.includes("hunk") || err.includes("patch") || err.includes("target content") || err.includes("could not be matched")) {
      return {
        toolName,
        category: "patch_mismatch",
        rootCause: `Target code snippet does not match exact line content in file.`,
        suggestions: [
          `Use 'heal_and_apply_patch' for whitespace- and indentation-tolerant fuzzy patching.`,
          `Use 'view_file' or 'get_file_outline' to inspect current file lines before patching.`,
          `Use 'apply_workspace_edit_plan' for multi-file atomic transactions.`,
        ],
        recommendedTool: args.path
          ? { name: "heal_and_apply_patch", args: { path: args.path, targetContent: args.targetContent || args.target, replacementContent: args.replacementContent || args.replacement } }
          : undefined,
      };
    }

    // Syntax error
    if (err.includes("syntaxerror") || err.includes("unexpected token") || err.includes("unclosed")) {
      return {
        toolName,
        category: "syntax_error",
        rootCause: `Source code contains invalid syntax or unclosed delimiters.`,
        suggestions: [
          `Use 'validate_code_syntax' to locate the exact invalid line before writing.`,
          `Use 'format_code_content' to normalize indentation and syntax blocks.`,
        ],
        recommendedTool: args.code
          ? { name: "validate_code_syntax", args: { code: args.code, language: "typescript" } }
          : undefined,
      };
    }

    // Lock contention
    if (err.includes("ebusy") || err.includes("lock") || err.includes("contention") || err.includes("resource temporarily unavailable")) {
      return {
        toolName,
        category: "lock_contention",
        rootCause: `Filesystem or resource lock contention detected.`,
        suggestions: [
          `Retry with 'autonomous' authority which utilizes automatic exponential backoff.`,
          `Verify no background process holds an exclusive handle on the file.`,
        ],
      };
    }

    // Timeout
    if (err.includes("timeout") || err.includes("timed out")) {
      return {
        toolName,
        category: "timeout",
        rootCause: `Operation exceeded allotted timeout duration.`,
        suggestions: [
          `Increase timeoutMs parameter if operation is long-running.`,
          `Spawn as a background task using 'process_spawn' and await with 'process_wait_for_exit'.`,
        ],
      };
    }

    return {
      toolName,
      category: "unknown",
      rootCause: errorMsg || "Unspecified failure",
      suggestions: [
        `Check tool parameters against schema using 'get_tool_resilience_status'.`,
        `Inspect turn mutation logs with 'get_turn_execution_profile'.`,
      ],
    };
  }
}
