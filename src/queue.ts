export interface QueueLike<Input, Output> {
    size: number;
    enqueue(element: Input): void;
    dequeue(): Output;
    clear(): void;
}

export class Node<T> {
    value: T
    next: Node<T> | null

    constructor(value: T) {
        this.value = value;
        this.next = null;
    }
}

export class Queue<T> implements QueueLike<T, T> {
    #head: Node<T> | null;
    #tail: Node<T> | null;
    #size: number;

    constructor() {
        this.#size = 0;
        this.#head = null;
        this.#tail = null;
    }

    static from<T>(items: Iterable<T>): Queue<T> {
        const q = new Queue<T>();
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
        return this.#size;
    }

    enqueue(element: T): void {
        const newNode = new Node(element);
        if (this.#tail) {
            this.#tail.next = newNode;
        } else {
            this.#head = newNode;
        }
        this.#tail = newNode;
        this.#size++;
    }

    dequeue(): T {
        const removed = this.#head;
        if (!removed) throw new Error("Queue is empty!");
        this.#head = removed.next;
        if (this.#head) {
            removed.next = null;
        } else {
            this.#tail = null;
        }
        this.#size--;
        return removed.value;
    }

    clear(): void {
        this.#head = null;
        this.#tail = null;
        this.#size = 0;
    }
}