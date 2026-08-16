/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-view-renderer.ts
 *
 * Human-Centric Visual Views & Spreadsheet/Kanban Renderer (Phase 73 / ADR-122).
 *
 * Renders structured BroccoliDbTable records into beautiful CLI Spreadsheet tables,
 * Kanban swimlane layouts, and side-by-side Table Diffs for non-technical users
 * and LLM model inspection.
 */

import type {
  KanbanViewOptions,
  SpreadsheetViewOptions,
  TableDiffViewResult,
} from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliViewRenderer {
  /**
   * Renders records into a rich CLI spreadsheet grid table.
   */
  static renderSpreadsheet<T extends Record<string, unknown>>(
    tableName: string,
    records: readonly T[],
    options: SpreadsheetViewOptions = {}
  ): string {
    if (records.length === 0) {
      return `┌────────────────────────────────────────────────────────┐\n│ Table '${tableName}' is empty (0 records)                 │\n└────────────────────────────────────────────────────────┘`;
    }

    const maxColWidth = options.maxColumnWidth ?? 30;
    const limit = options.limit !== undefined ? options.limit : records.length;
    const visibleRecords = records.slice(0, limit);

    // Determine columns
    let columns: string[];
    if (options.columns && options.columns.length > 0) {
      columns = [...options.columns];
    } else {
      const colSet = new Set<string>(["id"]);
      for (const r of visibleRecords) {
        for (const k of Object.keys(r)) colSet.add(k);
      }
      columns = Array.from(colSet);
    }

    // Calculate column widths
    const widths: Record<string, number> = {};
    for (const col of columns) {
      let maxLen = col.length;
      for (const r of visibleRecords) {
        const valStr = this.formatCell(r[col]);
        if (valStr.length > maxLen) maxLen = valStr.length;
      }
      widths[col] = Math.min(maxColWidth, Math.max(6, maxLen));
    }

    // Draw header
    const sepLine = `+` + columns.map((c) => "-".repeat(widths[c] + 2)).join("+") + `+`;
    const headerLine =
      `|` +
      columns
        .map((c) => {
          const padded = c.slice(0, widths[c]).padEnd(widths[c], " ");
          return ` ${padded} `;
        })
        .join("|") +
      `|`;

    const rows: string[] = [sepLine, headerLine, sepLine];

    // Draw data rows
    for (const r of visibleRecords) {
      const rowLine =
        `|` +
        columns
          .map((c) => {
            const rawStr = this.formatCell(r[c]);
            const truncated = rawStr.length > widths[c] ? rawStr.slice(0, widths[c] - 1) + "…" : rawStr;
            const padded = truncated.padEnd(widths[c], " ");
            return ` ${padded} `;
          })
          .join("|") +
        `|`;
      rows.push(rowLine);
    }

    rows.push(sepLine);

    // Footer stats if requested
    if (options.includeStatsFooter) {
      const footer = `| Total: ${records.length} records (showing ${visibleRecords.length})`.padEnd(
        sepLine.length - 1,
        " "
      ) + `|`;
      rows.push(footer);
      rows.push(sepLine);
    }

    return rows.join("\n");
  }

  /**
   * Renders records into a multi-column Kanban board swimlane.
   */
  static renderKanban<T extends Record<string, unknown>>(
    tableName: string,
    records: readonly T[],
    options: KanbanViewOptions
  ): string {
    const groupCol = options.groupByColumn;
    const titleCol = options.titleColumn ?? "title";
    const cardLimit = options.cardLimitPerLane ?? 10;

    const lanes = new Map<string, T[]>();

    for (const r of records) {
      const laneKey = String(r[groupCol] ?? "Unassigned");
      let laneList = lanes.get(laneKey);
      if (!laneList) {
        laneList = [];
        lanes.set(laneKey, laneList);
      }
      laneList.push(r);
    }

    const lines: string[] = [
      `================================================================`,
      ` 📋 Kanban Board: ${tableName} (Grouped by '${groupCol}')`,
      `================================================================`,
    ];

    for (const [laneName, cardList] of lanes.entries()) {
      lines.push(`\n[ ${laneName.toUpperCase()} ] (${cardList.length} cards)`);
      lines.push(`----------------------------------------------------------------`);
      const visibleCards = cardList.slice(0, cardLimit);
      for (const card of visibleCards) {
        const id = card.id ?? card._id ?? card.key ?? "item";
        const title = card[titleCol] ?? "(untitled)";
        lines.push(`  • [${id}] ${title}`);
      }
      if (cardList.length > cardLimit) {
        lines.push(`    ↳ ... and ${cardList.length - cardLimit} more`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Generates a side-by-side Table Diff between two snapshots.
   */
  static renderDiff<T extends Record<string, unknown>>(
    tableName: string,
    currentSnapshot: Map<string, T>,
    otherSnapshot: Map<string, T>
  ): TableDiffViewResult {
    let addedCount = 0;
    let modifiedCount = 0;
    let deletedCount = 0;
    const diffLines: string[] = [`--- Table Diff: ${tableName} ---`];

    // Check added and modified
    for (const [id, currentRec] of currentSnapshot.entries()) {
      const oldRec = otherSnapshot.get(id);
      if (!oldRec) {
        addedCount++;
        diffLines.push(`+ [INSERT] ${id}: ${JSON.stringify(currentRec)}`);
      } else {
        const currentStr = JSON.stringify(currentRec);
        const oldStr = JSON.stringify(oldRec);
        if (currentStr !== oldStr) {
          modifiedCount++;
          diffLines.push(`~ [UPDATE] ${id}:`);
          for (const k of new Set([...Object.keys(oldRec), ...Object.keys(currentRec)])) {
            if (oldRec[k] !== currentRec[k]) {
              diffLines.push(`    ${k}: ${JSON.stringify(oldRec[k])} -> ${JSON.stringify(currentRec[k])}`);
            }
          }
        }
      }
    }

    // Check deleted
    for (const [id, oldRec] of otherSnapshot.entries()) {
      if (!currentSnapshot.has(id)) {
        deletedCount++;
        diffLines.push(`- [DELETE] ${id}: ${JSON.stringify(oldRec)}`);
      }
    }

    if (addedCount === 0 && modifiedCount === 0 && deletedCount === 0) {
      diffLines.push(`(No differences detected - tables are identical)`);
    }

    return {
      table: tableName,
      addedCount,
      modifiedCount,
      deletedCount,
      formattedDiff: diffLines.join("\n"),
    };
  }

  private static formatCell(val: unknown): string {
    if (val === undefined || val === null) return "-";
    if (typeof val === "object") {
      if (Array.isArray(val)) return `[${val.length} items]`;
      return JSON.stringify(val);
    }
    return String(val);
  }
}
