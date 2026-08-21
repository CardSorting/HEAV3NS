/**
 * ArgumentCoercer.
 * Absorbed in Pass 62 (ADR-034 / ADR-012).
 *
 * Coerces stringified numbers and boolean flags in tool call inputs to native TypeScript primitives.
 */
export class ArgumentCoercer {
  coerce(params: Record<string, unknown>): Record<string, unknown> {
    const coerced: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed === "true") {
          coerced[key] = true;
        } else if (trimmed === "false") {
          coerced[key] = false;
        } else if (!isNaN(Number(trimmed)) && trimmed !== "") {
          coerced[key] = Number(trimmed);
        } else if (
          (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
          (trimmed.startsWith("[") && trimmed.endsWith("]"))
        ) {
          try {
            coerced[key] = JSON.parse(trimmed);
          } catch {
            coerced[key] = value;
          }
        } else {
          coerced[key] = value;
        }
      } else {
        coerced[key] = value;
      }
    }

    return coerced;
  }
}
