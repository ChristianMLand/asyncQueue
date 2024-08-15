import { QueueLike } from "./queue.js";

type Task = {
  order: number,
  priority: number,
}

export class PriorityQueue implements QueueLike<Task, Task> {
  #heap: Task[];

  constructor() {
    this.#heap = [null];
  }

  static from(items: Iterable<Task>) : PriorityQueue {
    const q = new PriorityQueue();
    for (const item of items) {
      q.enqueue(item);
    }
    return q;
  }

  *[Symbol.iterator]() {
    while (this.size) {
      yield this.dequeue();
    }
  }

  get size(): number {
    return this.#heap.length - 1;
  }

  enqueue(data: Task): void {
    this.#heap.push(data);
    let taskIdx = this.size;
    let parIdx = Math.floor(taskIdx / 2);
    while (this.#compare(taskIdx, parIdx)) {
      this.#swap(taskIdx, parIdx);
      taskIdx = parIdx;
      parIdx = Math.floor(taskIdx / 2);
    }
  }

  dequeue(): Task {
    const max = this.#heap[1];
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
    return max;
  }

  clear(): void {
    this.#heap.length = 1;
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
}