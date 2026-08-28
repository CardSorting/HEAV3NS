/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-vector-engine.ts
 *
 * Vectorized Columnar Execution Engine for BroccoliDB (Pass 200 / ADR-138).
 * Processes batches of data in columnar chunks with typed array buffers and SIMD-friendly vectorized operators.
 */

import type {
  BroccoliVectorAggType,
  BroccoliVectorChunk,
  BroccoliVectorFilterOp,
  IBroccoliVectorEngine,
} from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliVectorEngine implements IBroccoliVectorEngine {
  public createVectorChunk<T extends Record<string, unknown>>(
    records: readonly T[],
    numericColumns: readonly string[] = [],
    stringColumns: readonly string[] = []
  ): BroccoliVectorChunk {
    const length = records.length;
    const columns: Record<string, Float64Array | Int32Array | (string | null | undefined)[]> = {};
    const nullMasks: Record<string, Uint8Array> = {};
    const recordIds: string[] = new Array(length);

    // Initialize numeric columns as Float64Array
    for (const numCol of numericColumns) {
      columns[numCol] = new Float64Array(length);
      nullMasks[numCol] = new Uint8Array(length);
    }

    // Initialize string columns
    for (const strCol of stringColumns) {
      columns[strCol] = new Array(length);
      nullMasks[strCol] = new Uint8Array(length);
    }

    // Populate columnar arrays
    for (let i = 0; i < length; i++) {
      const rec = records[i];
      recordIds[i] = String(rec.id ?? rec._id ?? `rec_${i}`);

      for (const numCol of numericColumns) {
        const val = rec[numCol];
        if (typeof val === "number" && !isNaN(val)) {
          (columns[numCol] as Float64Array)[i] = val;
          nullMasks[numCol][i] = 0;
        } else {
          (columns[numCol] as Float64Array)[i] = 0;
          nullMasks[numCol][i] = 1; // null
        }
      }

      for (const strCol of stringColumns) {
        const val = rec[strCol];
        if (val !== undefined && val !== null) {
          (columns[strCol] as (string | null | undefined)[])[i] = String(val);
          nullMasks[strCol][i] = 0;
        } else {
          (columns[strCol] as (string | null | undefined)[])[i] = null;
          nullMasks[strCol][i] = 1;
        }
      }
    }

    return {
      length,
      columns,
      nullMasks,
      recordIds,
    };
  }

  public vectorFilter(
    chunk: BroccoliVectorChunk,
    column: string,
    op: BroccoliVectorFilterOp,
    value: unknown,
    selectionVector?: readonly number[]
  ): readonly number[] {
    const colData = chunk.columns[column];
    const nullMask = chunk.nullMasks[column];
    if (!colData) return [];

    const indices = selectionVector ?? Array.from({ length: chunk.length }, (_, i) => i);
    const matched: number[] = [];

    // Fast path: Typed Float64Array numeric comparisons
    if (colData instanceof Float64Array || colData instanceof Int32Array) {
      const numVal = Number(value);
      for (const idx of indices) {
        if (nullMask && nullMask[idx] === 1) continue;
        const cell = colData[idx];

        let pass = false;
        switch (op) {
          case "eq": pass = cell === numVal; break;
          case "neq": pass = cell !== numVal; break;
          case "gt": pass = cell > numVal; break;
          case "gte": pass = cell >= numVal; break;
          case "lt": pass = cell < numVal; break;
          case "lte": pass = cell <= numVal; break;
        }
        if (pass) matched.push(idx);
      }
      return matched;
    }

    // String comparisons
    const strVal = String(value);
    for (const idx of indices) {
      if (nullMask && nullMask[idx] === 1) continue;
      const cell = colData[idx];
      if (cell === null || cell === undefined) continue;

      let pass = false;
      switch (op) {
        case "eq": pass = cell === strVal; break;
        case "neq": pass = cell !== strVal; break;
        case "contains": pass = cell.includes(strVal); break;
        case "gt": pass = cell > strVal; break;
        case "gte": pass = cell >= strVal; break;
        case "lt": pass = cell < strVal; break;
        case "lte": pass = cell <= strVal; break;
      }
      if (pass) matched.push(idx);
    }

    return matched;
  }

  public vectorAggregate(
    chunk: BroccoliVectorChunk,
    column: string,
    aggType: BroccoliVectorAggType,
    selectionVector?: readonly number[]
  ): number {
    const colData = chunk.columns[column];
    const nullMask = chunk.nullMasks[column];
    if (!colData) return 0;

    const indices = selectionVector ?? Array.from({ length: chunk.length }, (_, i) => i);
    if (indices.length === 0) return 0;

    if (aggType === "COUNT") {
      let count = 0;
      for (const idx of indices) {
        if (!nullMask || nullMask[idx] === 0) count++;
      }
      return count;
    }

    if (colData instanceof Float64Array || colData instanceof Int32Array) {
      let sum = 0;
      let count = 0;
      let min = Infinity;
      let max = -Infinity;

      for (const idx of indices) {
        if (nullMask && nullMask[idx] === 1) continue;
        const val = colData[idx];
        sum += val;
        count++;
        if (val < min) min = val;
        if (val > max) max = val;
      }

      if (count === 0) return 0;

      switch (aggType) {
        case "SUM": return sum;
        case "AVG": return sum / count;
        case "MIN": return min === Infinity ? 0 : min;
        case "MAX": return max === -Infinity ? 0 : max;
        default: return 0;
      }
    }

    return 0;
  }
}
