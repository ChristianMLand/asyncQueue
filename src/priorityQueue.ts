import { QueueLike } from "./queue.js";

type Task<T> = {
  order: number,
  priority: number,
  data: T
}

export class PriorityQueue<T> implements QueueLike<T, T> {
  #heap: Task<T>[];
  #count: number;

  constructor() {
    this.#heap = [null];
    this.#count = 0;
  }

  clear(): void {
    this.#heap.length = 1;
    this.#count = 0;
  }

  get size(): number {
    return this.#heap.length - 1;
  }

  #compare(idxA: number, idxB: number) {
    const a = this.#heap[idxA];
    const b = this.#heap[idxB];
    if (a?.priority === b?.priority) {
      return a?.order < b?.order;
    }
    return a?.priority > b?.priority;
  }

  #swap(idxA: number, idxB: number) {
    const tmp = this.#heap[idxA];
    this.#heap[idxA] = this.#heap[idxB];
    this.#heap[idxB] = tmp;
  }

  enqueue(data: T, priority: number = 2): void {
    this.#heap.push({ data, priority, order: this.#count++ });
    let taskIdx = this.size;
    let parIdx = Math.floor(taskIdx / 2);
    while (this.#compare(taskIdx, parIdx)) {
      this.#swap(taskIdx, parIdx);
      taskIdx = parIdx;
      parIdx = Math.floor(taskIdx / 2);
    }
  }

  dequeue(): T {
    const min = this.#heap[1].data;
    this.#heap[1] = this.#heap[this.size];
    this.#heap.pop();
    let parIdx = 1;
    let smallerIdx = parIdx * 2;
    if (this.#compare(smallerIdx + 1, smallerIdx)) {
      smallerIdx++;
    }
    while (this.#heap[smallerIdx] && this.#compare(smallerIdx, parIdx)) {
      this.#swap(parIdx, smallerIdx);
      parIdx = smallerIdx;
      smallerIdx = parIdx * 2;
      if (this.#compare(smallerIdx + 1, smallerIdx)) {
        smallerIdx++;
      }
    }
    return min;
  }
}