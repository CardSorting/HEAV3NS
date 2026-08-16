/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-relations.ts
 *
 * Declarative Relational Topologies & Foreign Key Cascade Engine (Phase 73 / ADR-122).
 *
 * Implements belongsTo, hasMany, and hasOne relations across BroccoliDbTable instances,
 * sub-microsecond indexed join query resolution, and referential integrity cascades
 * (CASCADE, SET_NULL, RESTRICT) with zero external C++ dependencies.
 */

import type {
  DbJoinedRecord,
  DbJoinOptions,
  DbRelationDefinition,
  IDbTable,
  ReferentialAction,
} from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliRelationEngine {
  private readonly relations = new Map<string, DbRelationDefinition>();

  /**
   * Registers a relational link definition on a table.
   */
  defineRelation(relation: DbRelationDefinition): void {
    this.relations.set(relation.name, { ...relation });
  }

  getRelation(name: string): DbRelationDefinition | undefined {
    return this.relations.get(name);
  }

  listRelations(): readonly DbRelationDefinition[] {
    return Array.from(this.relations.values());
  }

  /**
   * Executes a nested relational join between the parent records and target table.
   */
  executeJoin<
    T extends Record<string, unknown> = Record<string, unknown>,
    R extends Record<string, unknown> = Record<string, unknown>
  >(
    parentRecords: readonly T[],
    options: DbJoinOptions,
    tableResolver: (tableName: string) => IDbTable<R> | undefined
  ): readonly DbJoinedRecord<T, R>[] {
    const relationDef = this.relations.get(options.relation);
    if (!relationDef) {
      throw new Error(`Relation '${options.relation}' is not defined on this table.`);
    }

    const targetTable = tableResolver(relationDef.targetTable);
    if (!targetTable) {
      throw new Error(`Target table '${relationDef.targetTable}' could not be resolved.`);
    }

    const joinedResults: DbJoinedRecord<T, R>[] = [];

    for (const parent of parentRecords) {
      const foreignVal = parent[relationDef.foreignKey];
      let relatedData: R | readonly R[] | null = null;

      if (foreignVal !== undefined && foreignVal !== null) {
        if (relationDef.type === "belongsTo" || relationDef.type === "hasOne") {
          // Point lookup by targetKey
          const matches = targetTable.query({
            where: { [relationDef.targetKey]: foreignVal, ...options.where },
            limit: 1,
          });
          relatedData = matches[0] ? this.projectFields(matches[0], options.select) : null;
        } else if (relationDef.type === "hasMany") {
          // Multi-record query
          const matches = targetTable.query({
            where: { [relationDef.targetKey]: foreignVal, ...options.where },
          });
          relatedData = matches.map((m) => this.projectFields(m, options.select));
        }
      } else {
        relatedData = relationDef.type === "hasMany" ? [] : null;
      }

      joinedResults.push({
        record: { ...parent },
        relations: {
          [options.relation]: relatedData,
        },
      });
    }

    return joinedResults;
  }

  /**
   * Enforces referential integrity cascades when a parent record is deleted.
   */
  handleParentDelete(
    parentId: string,
    tableResolver: (tableName: string) => IDbTable<Record<string, unknown>> | undefined
  ): void {
    for (const relation of this.relations.values()) {
      const action: ReferentialAction = relation.onDelete ?? "RESTRICT";
      const targetTable = tableResolver(relation.targetTable);
      if (!targetTable) continue;

      const dependents = targetTable.query({
        where: { [relation.targetKey]: parentId },
      });

      if (dependents.length === 0) continue;

      if (action === "RESTRICT") {
        throw new Error(
          `Foreign key constraint violation: cannot delete record '${parentId}' because ${dependents.length} record(s) in '${relation.targetTable}' reference it.`
        );
      } else if (action === "CASCADE") {
        for (const dep of dependents) {
          const depId = String(dep.id ?? dep._id ?? dep.key);
          if (depId) {
            targetTable.delete(depId);
          }
        }
      } else if (action === "SET_NULL") {
        for (const dep of dependents) {
          const depId = String(dep.id ?? dep._id ?? dep.key);
          if (depId) {
            const updated = { ...dep, [relation.targetKey]: null };
            targetTable.put(depId, updated);
          }
        }
      }
    }
  }

  private projectFields<R extends Record<string, unknown>>(record: R, select?: readonly string[]): R {
    if (!select || select.length === 0) return { ...record };
    const projected: Record<string, unknown> = {};
    for (const field of select) {
      if (field in record) {
        projected[field] = record[field];
      }
    }
    return projected as R;
  }
}
