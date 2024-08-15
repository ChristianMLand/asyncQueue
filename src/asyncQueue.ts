import { Queue, QueueLike } from "./queue.js";
import { PriorityQueue } from "./priorityQueue.js";

export type Factory<Input, Output> = (value: Input) => Promise<Output>;

export interface AsyncQueueConfig<Input, Output> {
  maxWorkers?: number;
  defaultFactory?: Factory<Input, Output>;
  defaultMaxRetries?: number;
  defaultDelay?: number;
  defaultPriority?: number;
}

export interface RequestConfig<T, U> {
  delay?: number;
  maxRetries?: number;
  priority?: number;
  factory?: Factory<T, U>;
}

export interface TaskConfig<T, U> extends RequestConfig<T, U> {
  order: number;
  priority: number;
  factory: Factory<T, U>;
  attempts: number;
  request: T;
  processing?: number;
  result?: U;
  error?: Error;
}

export type EventHandler<T, U> = (event: TaskConfig<T, U>) => any;

export type EventHandlers<T, U> = {
  start?: EventHandler<T, U>,
  end?: EventHandler<T, U>,
  fail?: EventHandler<T, U>,
  retry?: EventHandler<T, U>
};

export type EventType = keyof EventHandlers<any, any>;

export type Request<Output> = () => Promise<Output>;

export type Task<Output> = () => Promise<Output>;

export class AsyncQueue<Input, Output> implements QueueLike<Input, Promise<Output>> {
  #config: AsyncQueueConfig<Input, Output>;
  #handlers: EventHandlers<Input, Output>;
  #queue: PriorityQueue;
  #output: Queue<Promise<Output>>;
  #processing: number;

  constructor(config: AsyncQueueConfig<Input, Output> = {}) {
    this.#config = {
      defaultPriority: 0,
      maxWorkers: 3,
      defaultMaxRetries: 0,
      defaultDelay: 0,
      ...config
    };
    this.#queue = new PriorityQueue();
    this.#output = new Queue();
    this.#processing = 0;
    this.#handlers = {};
  }

  static from<Input, Output>(items: Iterable<Input>, config: AsyncQueueConfig<Input, Output> = {}) {
    const q = new AsyncQueue(config);
    for (const item of items) {
      q.enqueue(item);
    }
    return q;
  }

  *[Symbol.iterator](): Generator<Promise<Output>, void, void> {
    const iter = this[Symbol.asyncIterator]();
    const size = this.size;
    for (let i = 0; i < size; i++) {
      yield iter.next().then(r => r.value) as Promise<Output>;
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<Output, void, void> {
    while (this.size) {
      while (this.#processing < this.#config.maxWorkers && this.#queue.size) {
        this.#process();
      }
      yield this.#output.dequeue();
    }
  }

  get size(): number {
    return this.#queue.size + this.#output.size;
  }

  enqueue(req: Input, config: RequestConfig<Input, Output> = {}): void {
    const taskConfig: TaskConfig<Input, Output> = {
      factory: this.#config.defaultFactory,
      priority: this.#config.defaultPriority,
      maxRetries: this.#config.defaultMaxRetries,
      delay: this.#config.defaultDelay,
      request: req,
      attempts: 0,
      order: this.size + 1,
      ...config
    }
    if (!taskConfig.factory) {
      throw new Error("Invalid request: Either provide a factory method to the class, or use a callback.");
    }
    this.#queue.enqueue(taskConfig);
  }

  async dequeue(): Promise<Output> {
    const { value, done } = await this[Symbol.asyncIterator]().next();
    if (done) {
      throw new Error("Queue is empty!");
    }
    return value as Output;
  }

  clear(): void {
    this.#queue.clear();
    this.#output.clear();
  }

  withConfig(config: AsyncQueueConfig<Input, Output>) {
    this.#config = { ...this.#config, ...config };
    return this;
  }

  on(eventType: EventType, cb: (event: TaskConfig<Input, Output>) => void): void {
    this.#handlers[eventType] = cb;
  }

  async collect(): Promise<Array<Output>> {
    const output: Array<Output> = [];
    for await (const task of this) {
      output.push(task);
    }
    return output;
  }

  #notify(eventType: EventType, data: any) {
    if (this.#handlers[eventType] === undefined) return;
    this.#handlers[eventType](data);
  }

  async #process(): Promise<void> {
    while (this.#queue.size) {
      const promise = this.#createTask(this.#queue.dequeue() as TaskConfig<Input, Output>);
      this.#output.enqueue(promise);
      await promise;
    }
  }

  #timeout(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  #createTask(config: TaskConfig<Input, Output>): Promise<Output> {
    return new Promise(async resolve => {
      if (config.delay) {
        await this.#timeout(config.delay);
      }
      config.processing = ++this.#processing;
      this.#notify(config.attempts > 0 ? "retry" : "start", config);
      const result = await config.factory(config.request).catch(err => err);
      config.processing = --this.#processing;
      if (!(result instanceof Error)) {
        config.result = result;
        this.#notify("end", config);
        return resolve(result);
      } else if (config.attempts < config.maxRetries) {
        config.delay = 2 ** config.attempts * 1000;
        config.attempts++;
        config.error = result;
        this.#notify("fail", config);
        this.enqueue(config.request, config);
      }
      resolve(undefined);
    });
  }
}