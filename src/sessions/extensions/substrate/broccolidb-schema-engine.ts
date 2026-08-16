/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-schema-engine.ts
 *
 * Declarative Schema Evolution, Type Coercion & Migration Engine (Phase 73 / ADR-122).
 *
 * Implements versioned table schemas, on-read/batch migrations, automatic type coercion
 * (string to number, ISO date to timestamp), and human-friendly schema validation.
 */

import type {
  SchemaValidationResult,
  TableMigrationFn,
  TableSchemaVersionDefinition,
} from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliSchemaEngine<T extends Record<string, unknown> = Record<string, unknown>> {
  private schema?: TableSchemaVersionDefinition<T>;

  setSchema(schema: TableSchemaVersionDefinition<T>): void {
    this.schema = schema;
  }

  getSchema(): TableSchemaVersionDefinition<T> | undefined {
    return this.schema;
  }

  getSchemaVersion(): number {
    return this.schema?.version ?? 1;
  }

  /**
   * Validates and coerces a record against active schema rules.
   */
  validateAndCoerce(record: T): SchemaValidationResult {
    if (!this.schema) {
      return { valid: true, errors: [], coercedRecord: { ...record } };
    }

    const errors: string[] = [];
    const coerced: Record<string, unknown> = { ...record };

    for (const [fieldName, fieldDef] of Object.entries(this.schema.fields)) {
      let val = coerced[fieldName];

      // Required check
      if (val === undefined || val === null) {
        if (fieldDef.default !== undefined) {
          coerced[fieldName] = fieldDef.default;
          val = fieldDef.default;
        } else if (fieldDef.required) {
          errors.push(`Field '${fieldName}' is required but was not provided.`);
          continue;
        } else {
          continue;
        }
      }

      // Type Coercion & Verification
      switch (fieldDef.type) {
        case "number": {
          if (typeof val !== "number") {
            const num = Number(val);
            if (!Number.isNaN(num)) {
              coerced[fieldName] = num;
            } else {
              errors.push(`Field '${fieldName}' must be a number; received ${typeof val} (${JSON.stringify(val)}).`);
            }
          }
          break;
        }
        case "string": {
          if (typeof val !== "string") {
            coerced[fieldName] = String(val);
          }
          break;
        }
        case "boolean": {
          if (typeof val !== "boolean") {
            if (val === "true" || val === 1) coerced[fieldName] = true;
            else if (val === "false" || val === 0) coerced[fieldName] = false;
            else errors.push(`Field '${fieldName}' must be a boolean; received ${typeof val}.`);
          }
          break;
        }
        case "array": {
          if (!Array.isArray(val)) {
            errors.push(`Field '${fieldName}' must be an array; received ${typeof val}.`);
          }
          break;
        }
        case "object": {
          if (typeof val !== "object" || val === null || Array.isArray(val)) {
            errors.push(`Field '${fieldName}' must be an object; received ${typeof val}.`);
          }
          break;
        }
        case "date": {
          if (typeof val === "string") {
            const parsed = Date.parse(val);
            if (!Number.isNaN(parsed)) {
              coerced[fieldName] = parsed;
            }
          } else if (val instanceof Date) {
            coerced[fieldName] = val.getTime();
          }
          break;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      coercedRecord: coerced,
    };
  }

  /**
   * Migrates a historical record from an older schema version up to current version.
   */
  migrateRecord(record: Record<string, unknown>, fromVersion: number): T {
    if (!this.schema || !this.schema.migrations) {
      return record as T;
    }

    let current = { ...record };
    for (let v = fromVersion + 1; v <= this.schema.version; v++) {
      const migrationFn: TableMigrationFn | undefined = this.schema.migrations[v];
      if (migrationFn) {
        current = migrationFn(current);
      }
    }

    return current as T;
  }
}
