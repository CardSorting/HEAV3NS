/**
 * deterministic-streaming-scrubber-engine.ts
 *
 * Pure TypeScript stateful streaming scrubber handling chunked delta feeds,
 * partial-tag tail holdback across chunk boundaries, boundary-gated block openers,
 * closed pair extraction, and end-of-stream flushing (Phase 137 / ADR-113 / Target #70).
 */

import type {
  StreamingScrubberState,
  StreamingThinkScrubberConfig,
} from "../../../core/contracts/streaming-think-scrubber.contracts.js";
import { DEFAULT_REASONING_TAG_NAMES } from "../../../core/contracts/streaming-think-scrubber.contracts.js";

export class DeterministicStreamingScrubberEngine {
  private readonly openTags: readonly string[];
  private readonly closeTags: readonly string[];

  constructor(tagNames: readonly string[] = DEFAULT_REASONING_TAG_NAMES) {
    this.openTags = tagNames.map((name) => `<${name.toLowerCase()}>`);
    this.closeTags = tagNames.map((name) => `</${name.toLowerCase()}>`);
  }

  /**
   * Feeds one delta chunk; returns scrubbed visible portion and updated state.
   */
  public feed(
    text: string,
    state: StreamingScrubberState,
    config: StreamingThinkScrubberConfig
  ): {
    visibleText: string;
    nextState: StreamingScrubberState;
    suppressed: boolean;
    blockEntered: boolean;
    heldBackTail: boolean;
  } {
    if (!config.enabled || !text) {
      return {
        visibleText: text,
        nextState: { ...state },
        suppressed: false,
        blockEntered: false,
        heldBackTail: false,
      };
    }

    let inBlock = state.inBlock;
    let buf = state.heldBuffer + text;
    let lastEmittedEndedNewline = state.lastEmittedEndedNewline;
    const out: string[] = [];
    let wasSuppressed = false;
    let blockEntered = false;
    let heldBackTail = false;

    while (buf.length > 0) {
      if (inBlock) {
        // Hunt for the earliest close tag
        const closeMatch = this.findFirstTag(buf, this.closeTags);
        if (closeMatch.index === -1) {
          // No close tag yet — hold back potential partial close-tag prefix
          const held = this.maxPartialSuffix(buf, this.closeTags);
          const newHeldBuffer = held > 0 ? buf.slice(-held) : "";
          wasSuppressed = true;
          return {
            visibleText: out.join(""),
            nextState: {
              ...state,
              inBlock: true,
              heldBuffer: newHeldBuffer,
              lastEmittedEndedNewline,
            },
            suppressed: true,
            blockEntered,
            heldBackTail: newHeldBuffer.length > 0,
          };
        }

        // Found close tag: discard block content + close tag
        buf = buf.slice(closeMatch.index + closeMatch.length);
        inBlock = false;
        wasSuppressed = true;
      } else {
        // Priority 1 — closed <tag>X</tag> pair anywhere in buf
        const pair = this.findEarliestClosedPair(buf);

        // Priority 2 — unterminated open tag at a block boundary
        const openMatch = this.findOpenAtBoundary(buf, out, lastEmittedEndedNewline, config);

        if (pair !== null && (openMatch.index === -1 || pair.startIndex <= openMatch.index)) {
          const preceding = buf.slice(0, pair.startIndex);
          if (preceding) {
            const strippedPreceding = this.stripOrphanCloseTags(preceding);
            if (strippedPreceding) {
              out.push(strippedPreceding);
              lastEmittedEndedNewline = strippedPreceding.endsWith("\n");
            }
          }
          buf = buf.slice(pair.endIndex);
          wasSuppressed = true;
          continue;
        }

        if (openMatch.index !== -1) {
          const preceding = buf.slice(0, openMatch.index);
          if (preceding) {
            const strippedPreceding = this.stripOrphanCloseTags(preceding);
            if (strippedPreceding) {
              out.push(strippedPreceding);
              lastEmittedEndedNewline = strippedPreceding.endsWith("\n");
            }
          }
          inBlock = true;
          blockEntered = true;
          wasSuppressed = true;
          buf = buf.slice(openMatch.index + openMatch.length);
          continue;
        }

        // No resolvable tag structure in buf. Hold back partial prefix at tail
        const heldOpen = this.maxPartialSuffix(buf, this.openTags);
        const heldClose = this.maxPartialSuffix(buf, this.closeTags);
        const held = Math.max(heldOpen, heldClose);

        let emitText = "";
        let newHeldBuffer = "";

        if (held > 0) {
          emitText = buf.slice(0, -held);
          newHeldBuffer = buf.slice(-held);
          heldBackTail = true;
        } else {
          emitText = buf;
          newHeldBuffer = "";
        }

        if (emitText) {
          emitText = this.stripOrphanCloseTags(emitText);
          if (emitText) {
            out.push(emitText);
            lastEmittedEndedNewline = emitText.endsWith("\n");
          }
        }

        return {
          visibleText: out.join(""),
          nextState: {
            ...state,
            inBlock: false,
            heldBuffer: newHeldBuffer,
            lastEmittedEndedNewline,
          },
          suppressed: wasSuppressed,
          blockEntered,
          heldBackTail,
        };
      }
    }

    return {
      visibleText: out.join(""),
      nextState: {
        ...state,
        inBlock,
        heldBuffer: "",
        lastEmittedEndedNewline,
      },
      suppressed: wasSuppressed,
      blockEntered,
      heldBackTail,
    };
  }

  /**
   * End-of-stream flush.
   */
  public flush(
    state: StreamingScrubberState,
    config: StreamingThinkScrubberConfig
  ): {
    tailText: string;
    nextState: StreamingScrubberState;
  } {
    if (state.inBlock) {
      // Unterminated block at end of stream: discard held-back content
      return {
        tailText: "",
        nextState: {
          ...state,
          inBlock: false,
          heldBuffer: "",
          lastEmittedEndedNewline: true,
        },
      };
    }

    const tail = state.heldBuffer;
    return {
      tailText: tail ? this.stripOrphanCloseTags(tail) : "",
      nextState: {
        ...state,
        inBlock: false,
        heldBuffer: "",
        lastEmittedEndedNewline: true,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  private findFirstTag(buf: string, tags: readonly string[]): { index: number; length: number } {
    const lowerBuf = buf.toLowerCase();
    let bestIdx = -1;
    let bestLen = 0;

    for (const tag of tags) {
      const idx = lowerBuf.indexOf(tag);
      if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
        bestIdx = idx;
        bestLen = tag.length;
      }
    }

    return { index: bestIdx, length: bestLen };
  }

  private maxPartialSuffix(buf: string, tags: readonly string[]): number {
    const lowerBuf = buf.toLowerCase();
    let maxLen = 0;

    for (const tag of tags) {
      const maxPossible = Math.min(tag.length - 1, lowerBuf.length);
      for (let k = maxPossible; k > maxLen; k--) {
        if (lowerBuf.endsWith(tag.slice(0, k))) {
          maxLen = k;
          break;
        }
      }
    }

    return maxLen;
  }

  private findEarliestClosedPair(buf: string): { startIndex: number; endIndex: number } | null {
    const lowerBuf = buf.toLowerCase();
    let bestPair: { startIndex: number; endIndex: number } | null = null;

    for (let i = 0; i < this.openTags.length; i++) {
      const openTag = this.openTags[i];
      const closeTag = this.closeTags[i];

      const openIdx = lowerBuf.indexOf(openTag);
      if (openIdx === -1) continue;

      const closeIdx = lowerBuf.indexOf(closeTag, openIdx + openTag.length);
      if (closeIdx === -1) continue;

      const endIdx = closeIdx + closeTag.length;
      if (bestPair === null || openIdx < bestPair.startIndex) {
        bestPair = { startIndex: openIdx, endIndex: endIdx };
      }
    }

    return bestPair;
  }

  private findOpenAtBoundary(
    buf: string,
    out: readonly string[],
    lastEmittedEndedNewline: boolean,
    config: StreamingThinkScrubberConfig
  ): { index: number; length: number } {
    const lowerBuf = buf.toLowerCase();
    let bestIdx = -1;
    let bestLen = 0;

    for (const openTag of this.openTags) {
      let searchPos = 0;
      while (searchPos < lowerBuf.length) {
        const idx = lowerBuf.indexOf(openTag, searchPos);
        if (idx === -1) break;

        // Check if idx is at a block boundary
        if (!config.preserveProseMentions || this.isAtBoundary(buf, idx, out, lastEmittedEndedNewline)) {
          if (bestIdx === -1 || idx < bestIdx) {
            bestIdx = idx;
            bestLen = openTag.length;
          }
          break;
        }

        searchPos = idx + 1;
      }
    }

    return { index: bestIdx, length: bestLen };
  }

  private isAtBoundary(
    buf: string,
    pos: number,
    out: readonly string[],
    lastEmittedEndedNewline: boolean
  ): boolean {
    if (pos === 0) {
      if (out.length === 0) {
        return lastEmittedEndedNewline;
      }
      return out[out.length - 1].endsWith("\n");
    }

    // Check characters preceding pos in buf
    const preceding = buf.slice(0, pos);
    const lastNewlineIdx = preceding.lastIndexOf("\n");

    if (lastNewlineIdx === -1) {
      // No newline in current buffer preceding pos
      const isWhitespace = /^\s*$/.test(preceding);
      if (!isWhitespace) {
        return false;
      }
      return out.length === 0 ? lastEmittedEndedNewline : out[out.length - 1].endsWith("\n");
    }

    // There is a newline in buf before pos; check if only whitespace sits between \n and pos
    const lineFragment = preceding.slice(lastNewlineIdx + 1);
    return /^\s*$/.test(lineFragment);
  }

  private stripOrphanCloseTags(text: string): string {
    let result = text;
    for (const closeTag of this.closeTags) {
      const reg = new RegExp(closeTag, "gi");
      result = result.replace(reg, "");
    }
    return result;
  }
}
