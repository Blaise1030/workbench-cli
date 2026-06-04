const DEFAULT_CAP = 512 * 1024;

export class RingBuffer {
  private chunks: string[] = [];
  private totalChars = 0;
  private readonly cap: number;

  constructor(cap = DEFAULT_CAP) {
    this.cap = cap;
  }

  append(chunk: string) {
    this.chunks.push(chunk);
    this.totalChars += chunk.length;
    while (this.totalChars > this.cap && this.chunks.length > 0) {
      this.totalChars -= this.chunks.shift()!.length;
    }
  }

  snapshot(): string {
    return this.chunks.join('');
  }

  get isEmpty(): boolean {
    return this.chunks.length === 0;
  }
}
