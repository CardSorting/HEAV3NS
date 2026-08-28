/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-materialized-view-engine.ts
 *
 * Continuous Incremental Materialized View Substrate for BroccoliDB (Pass 201 / ADR-139).
 * Maintains pre-aggregated and filtered projections incrementally from mutation streams for O(1) query access.
 */

import type {
  IBroccoliMaterializedViewEngine,
  MaterializedViewDefinition,
  MaterializedViewRow,
} from "../../../core/contracts/broccolidb.contracts.js";

interface InternalViewGroup {
  groupKey: string;
  sum: number;
  count: number;
  min: number;
  max: number;
  lastUpdatedAt: number;
}

export class BroccoliMaterializedViewEngine implements IBroccoliMaterializedViewEngine {
  private readonly definitions = new Map<string, MaterializedViewDefinition<any>>();
  private readonly viewStore = new Map<string, Map<string, InternalViewGroup>>();

  public createView<TRecord extends Record<string, any> = Record<string, any>>(
    def: MaterializedViewDefinition<TRecord>
  ): void {
    this.definitions.set(def.viewName, def);
    if (!this.viewStore.has(def.viewName)) {
      this.viewStore.set(def.viewName, new Map());
    }
  }

  public dropView(viewName: string): boolean {
    const d1 = this.definitions.delete(viewName);
    const d2 = this.viewStore.delete(viewName);
    return d1 || d2;
  }

  public applyMutation<TRecord extends Record<string, any> = Record<string, any>>(
    sourceTable: string,
    operation: "INSERT" | "UPDATE" | "DELETE",
    before?: TRecord,
    after?: TRecord
  ): void {
    for (const [viewName, def] of this.definitions.entries()) {
      if (def.sourceTable !== sourceTable) continue;

      const groupMap = this.viewStore.get(viewName)!;

      // 1. Subtract 'before' record if applicable
      if (before && (operation === "DELETE" || operation === "UPDATE")) {
        const passesFilter = !def.filterPredicate || def.filterPredicate(before);
        if (passesFilter) {
          const rec = before as Record<string, unknown>;
          const groupKey = def.groupByField ? String(rec[def.groupByField] ?? "default") : "global";
          const aggVal = def.aggregateField ? Number(rec[def.aggregateField] ?? 0) : 1;

          const group = groupMap.get(groupKey);
          if (group) {
            group.count--;
            group.sum -= aggVal;
            group.lastUpdatedAt = Date.now();
            if (group.count <= 0) {
              groupMap.delete(groupKey);
            }
          }
        }
      }

      // 2. Add 'after' record if applicable
      if (after && (operation === "INSERT" || operation === "UPDATE")) {
        const passesFilter = !def.filterPredicate || def.filterPredicate(after);
        if (passesFilter) {
          const rec = after as Record<string, unknown>;
          const groupKey = def.groupByField ? String(rec[def.groupByField] ?? "default") : "global";
          const aggVal = def.aggregateField ? Number(rec[def.aggregateField] ?? 0) : 1;

          let group = groupMap.get(groupKey);
          if (!group) {
            group = {
              groupKey,
              sum: 0,
              count: 0,
              min: Infinity,
              max: -Infinity,
              lastUpdatedAt: Date.now(),
            };
            groupMap.set(groupKey, group);
          }

          group.count++;
          group.sum += aggVal;
          if (aggVal < group.min) group.min = aggVal;
          if (aggVal > group.max) group.max = aggVal;
          group.lastUpdatedAt = Date.now();
        }
      }
    }
  }

  public getViewData(viewName: string): readonly MaterializedViewRow[] {
    const def = this.definitions.get(viewName);
    const groupMap = this.viewStore.get(viewName);
    if (!def || !groupMap) return [];

    const rows: MaterializedViewRow[] = [];
    const func = def.aggregateFunc ?? "COUNT";

    for (const group of groupMap.values()) {
      let aggregateValue = group.count;

      if (func === "SUM") {
        aggregateValue = group.sum;
      } else if (func === "AVG") {
        aggregateValue = group.count > 0 ? group.sum / group.count : 0;
      } else if (func === "MIN") {
        aggregateValue = group.count > 0 ? group.min : 0;
      } else if (func === "MAX") {
        aggregateValue = group.count > 0 ? group.max : 0;
      }

      rows.push({
        groupKey: group.groupKey,
        aggregateValue,
        rowCount: group.count,
        lastUpdatedAt: group.lastUpdatedAt,
      });
    }

    return rows;
  }

  public getViewRow(viewName: string, groupKey: string): MaterializedViewRow | undefined {
    const data = this.getViewData(viewName);
    return data.find((r) => r.groupKey === groupKey);
  }

  public listViews(): readonly string[] {
    return Array.from(this.definitions.keys());
  }
}
