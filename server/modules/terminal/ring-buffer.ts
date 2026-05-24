export class RingBuffer {
  private chunks: Buffer[] = [];
  private totalBytes = 0;

  constructor(private readonly capBytes: number) {}

  append(data: string | Buffer): void {
    const buf = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
    if (buf.length === 0) return;
    this.chunks.push(buf);
    this.totalBytes += buf.length;
    while (this.totalBytes > this.capBytes && this.chunks.length > 0) {
      const removed = this.chunks.shift()!;
      this.totalBytes -= removed.length;
    }
  }

  snapshot(): Buffer {
    if (this.chunks.length === 0) return Buffer.alloc(0);
    return Buffer.concat(this.chunks);
  }

  get byteLength(): number {
    return this.totalBytes;
  }
}
