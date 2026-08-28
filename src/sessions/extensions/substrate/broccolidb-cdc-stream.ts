/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-cdc-stream.ts
 *
 * Change Data Capture (CDC) Stream Engine for BroccoliDB (Pass 199 / ADR-137).
 * Captures transactional data mutations with Log Sequence Numbers (LSN) and powers reactive zero-polling subscriptions.
 */

import type {
  BroccoliCdcCallback,
  BroccoliCdcEvent,
  BroccoliCdcFilter,
  BroccoliCdcOp,
  BroccoliCdcSubscription,
  IBroccoliCdcStream,
} from "../../../core/contracts/broccolidb.contracts.js";

export class BroccoliCdcStream implements IBroccoliCdcStream {
  private currentLsn = 0;
  private readonly events: BroccoliCdcEvent<Record<string, unknown>>[] = [];
  private readonly maxEventHistory: number;
  private readonly subscribers = new Map<string, {
    filter: BroccoliCdcFilter;
    callback: BroccoliCdcCallback;
  }>();

  constructor(maxEventHistory = 10000) {
    this.maxEventHistory = maxEventHistory;
  }

  public emitEvent<T extends Record<string, unknown>>(
    table: string,
    op: BroccoliCdcOp,
    recordId: string,
    before?: T,
    after?: T,
    txId?: number
  ): BroccoliCdcEvent<T> {
    const lsn = ++this.currentLsn;
    const event: BroccoliCdcEvent<T> = {
      lsn,
      timestamp: Date.now(),
      table,
      op,
      recordId,
      before: before ? { ...before } : undefined,
      after: after ? { ...after } : undefined,
      txId,
    };

    this.events.push(event as BroccoliCdcEvent<Record<string, unknown>>);
    if (this.events.length > this.maxEventHistory) {
      this.events.shift();
    }

    // Dispatch to subscribers
    for (const sub of this.subscribers.values()) {
      if (this.matchesFilter(event, sub.filter)) {
        try {
          sub.callback(event as BroccoliCdcEvent);
        } catch {
          // Prevent consumer error from failing event stream
        }
      }
    }

    return event;
  }

  public subscribe(filter: BroccoliCdcFilter, callback: BroccoliCdcCallback): BroccoliCdcSubscription {
    const subscriptionId = `sub_cdc_${Math.random().toString(36).slice(2, 9)}`;
    this.subscribers.set(subscriptionId, { filter, callback });

    // If fromLsn is requested, replay past matching events
    if (filter.fromLsn !== undefined) {
      const historical = this.getEvents(filter.fromLsn);
      for (const ev of historical) {
        if (this.matchesFilter(ev, filter)) {
          callback(ev);
        }
      }
    }

    return {
      subscriptionId,
      unsubscribe: () => {
        this.subscribers.delete(subscriptionId);
      },
    };
  }

  public getEvents(fromLsn = 1, limit = 100): readonly BroccoliCdcEvent[] {
    return this.events
      .filter((e) => e.lsn >= fromLsn)
      .slice(0, limit);
  }

  public getLatestLsn(): number {
    return this.currentLsn;
  }

  private matchesFilter(event: BroccoliCdcEvent, filter: BroccoliCdcFilter): boolean {
    if (filter.tables && filter.tables.length > 0 && !filter.tables.includes(event.table)) {
      return false;
    }

    if (filter.ops && filter.ops.length > 0 && !filter.ops.includes(event.op)) {
      return false;
    }

    return true;
  }
}
