/** Stable binary min-heap for bounded A*. Internal use; npm test exercises routing.
 * Sequence numbers resolve equal priorities deterministically; empty pop returns undefined.
 */
interface Entry<T> { value: T; priority: number; sequence: number }

export class MinHeap<T> {
  private entries: Entry<T>[] = [];
  private sequence = 0;

  get size(): number {
    return this.entries.length;
  }

  push(value: T, priority: number): void {
    const entry = { value, priority, sequence: this.sequence++ };
    let index = this.entries.length;
    this.entries.push(entry);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.before(entry, this.entries[parent]!)) break;
      this.entries[index] = this.entries[parent]!;
      index = parent;
    }
    this.entries[index] = entry;
  }

  pop(): T | undefined {
    const root = this.entries[0];
    const last = this.entries.pop();
    if (!root) return;
    if (this.entries.length && last) {
      let index = 0;
      while (true) {
        let child = index * 2 + 1;
        if (child >= this.entries.length) break;
        if (child + 1 < this.entries.length && this.before(this.entries[child + 1]!, this.entries[child]!)) child++;
        if (!this.before(this.entries[child]!, last)) break;
        this.entries[index] = this.entries[child]!;
        index = child;
      }
      this.entries[index] = last;
    }
    return root.value;
  }

  private before(one: Entry<T>, two: Entry<T>): boolean {
    return one.priority < two.priority || (one.priority === two.priority && one.sequence < two.sequence);
  }
}
