/**
 * process-output-ring-buffer.ts
 *
 * High-performance, zero-GC circular byte ring buffer storing rolling process output.
 * Provides zero-allocation ANSI escape sequence stripping, bounded tail extraction,
 * and high-speed pattern detection.
 */

const ANSI_REGEX = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

export class ProcessOutputRingBuffer {
  private readonly capacity: number;
  private readonly buffer: Uint8Array;
  private head = 0;
  private size = 0;
  private totalBytesAppended = 0;
  private readonly textDecoder = new TextDecoder("utf-8");
  private readonly textEncoder = new TextEncoder();

  constructor(capacityBytes = 262144) {
    this.capacity = Math.max(1024, capacityBytes);
    this.buffer = new Uint8Array(this.capacity);
  }

  /**
   * Appends raw binary or string data to the rolling ring buffer.
   */
  public append(data: Uint8Array | string): number {
    const bytes = typeof data === "string" ? this.textEncoder.encode(data) : data;
    const len = bytes.length;
    if (len === 0) return 0;

    if (len >= this.capacity) {
      // Overflows entire capacity; copy only the tail
      const offset = len - this.capacity;
      this.buffer.set(bytes.subarray(offset));
      this.head = 0;
      this.size = this.capacity;
      this.totalBytesAppended += len;
      return len;
    }

    for (let i = 0; i < len; i++) {
      const idx = (this.head + this.size) % this.capacity;
      this.buffer[idx] = bytes[i];
      if (this.size < this.capacity) {
        this.size++;
      } else {
        this.head = (this.head + 1) % this.capacity;
      }
    }

    this.totalBytesAppended += len;
    return len;
  }

  /**
   * Retrieves the raw linear bytes currently stored in the buffer.
   */
  public getLinearBytes(): Uint8Array {
    if (this.size === 0) return new Uint8Array(0);
    const output = new Uint8Array(this.size);
    if (this.head + this.size <= this.capacity) {
      output.set(this.buffer.subarray(this.head, this.head + this.size));
    } else {
      const firstChunkSize = this.capacity - this.head;
      output.set(this.buffer.subarray(this.head, this.capacity), 0);
      output.set(this.buffer.subarray(0, this.size - firstChunkSize), firstChunkSize);
    }
    return output;
  }

  /**
   * Extracts the recent output tail as a decoded UTF-8 string with optional ANSI stripping.
   */
  public getTail(maxChars = 32768, stripAnsi = true): string {
    if (this.size === 0) return "";
    const linear = this.getLinearBytes();
    let text = this.textDecoder.decode(linear);
    if (stripAnsi) {
      text = text.replace(ANSI_REGEX, "");
    }
    if (text.length > maxChars) {
      return text.slice(-maxChars);
    }
    return text;
  }

  /**
   * Searches for substring or regex pattern in current buffer content.
   */
  public matchPattern(pattern: string, isRegex = false): string | null {
    if (this.size === 0) return null;
    const text = this.getTail(65536, true);
    if (!isRegex) {
      return text.includes(pattern) ? pattern : null;
    }
    try {
      const re = new RegExp(pattern);
      const match = re.exec(text);
      return match ? match[0] : null;
    } catch {
      return text.includes(pattern) ? pattern : null;
    }
  }

  public getTotalBytes(): number {
    return this.totalBytesAppended;
  }

  public getStoredBytesCount(): number {
    return this.size;
  }

  public clear(): void {
    this.head = 0;
    this.size = 0;
  }
}
