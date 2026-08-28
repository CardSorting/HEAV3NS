/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-query-optimizer.ts
 *
 * Cost-Based Query Optimizer & Index Router for BroccoliDB (Pass 198 / ADR-136).
 * Analyzes query ASTs and predicates to dynamically choose optimal execution plans.
 */

import type {
  BroccoliQueryPlan,
  IBroccoliQueryOptimizer,
} from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliQueryOptimizer implements IBroccoliQueryOptimizer {
  /**
   * Evaluates query filters against primary keys and secondary indices to formulate an optimal execution plan.
   */
  public planQuery<T extends Record<string, unknown>>(
    tableName: string,
    filter: Partial<T> | Record<string, unknown>,
    availableIndices: readonly string[] = []
  ): BroccoliQueryPlan {
    if (typeof filter === "function") {
      return {
        planType: "FULL_TABLE_SCAN",
        targetTable: tableName,
        estimatedCost: 100,
        explanation: `Filter is an opaque closure function; executing full in-memory table scan across '${tableName}'`,
      };
    }

    if (!filter || Object.keys(filter).length === 0) {
      return {
        planType: "FULL_TABLE_SCAN",
        targetTable: tableName,
        estimatedCost: 50,
        explanation: `Unconstrained query on '${tableName}'; scanning all records`,
      };
    }

    const filterKeys = Object.keys(filter);

    // 1. Primary Key Lookup (id or _id exact match)
    if (filterKeys.includes("id") && typeof (filter as any).id === "string") {
      return {
        planType: "PRIMARY_KEY_LOOKUP",
        targetTable: tableName,
        estimatedCost: 1,
        explanation: `Constant-time primary key lookup on '${tableName}.id' = '${(filter as any).id}'`,
        scanRange: { min: (filter as any).id, max: (filter as any).id },
      };
    }

    // 2. Secondary Index Seek (exact match on indexed column)
    for (const indexName of availableIndices) {
      if (filterKeys.includes(indexName)) {
        const val = (filter as any)[indexName];
        if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
          return {
            planType: "SECONDARY_INDEX_SEEK",
            targetTable: tableName,
            selectedIndex: indexName,
            estimatedCost: 5,
            explanation: `Secondary index lookup using B-Tree index '${indexName}' on '${tableName}'`,
            scanRange: { min: val, max: val },
          };
        }
      }
    }

    // 3. Range Scan ($gt, $lt, $gte, $lte)
    for (const key of filterKeys) {
      const val = (filter as any)[key];
      if (val && typeof val === "object" && ("$gt" in val || "$lt" in val || "$gte" in val || "$lte" in val)) {
        return {
          planType: "RANGE_SCAN",
          targetTable: tableName,
          selectedIndex: availableIndices.includes(key) ? key : undefined,
          estimatedCost: availableIndices.includes(key) ? 15 : 45,
          explanation: `Range scan on field '${key}' in '${tableName}'`,
          scanRange: { min: val.$gt ?? val.$gte, max: val.$lt ?? val.$lte },
        };
      }
    }

    // 4. Default to Full Table Scan
    return {
      planType: "FULL_TABLE_SCAN",
      targetTable: tableName,
      estimatedCost: 100,
      explanation: `No suitable index found for predicate keys [${filterKeys.join(", ")}]; executing sequential table scan`,
    };
  }
}
