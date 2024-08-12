import { Queue, QueueLike } from "./queue.js";

export class Result<T> {
  readonly value: T | Error;

  constructor(value: T | Error) {
    this.value = value;
  }

  isErr(): boolean {
    return this.value instanceof Error;
  }

  isOk(): boolean {
    return !this.isErr();
  }

  unwrap(fallback?: T): T {
    if (this.isOk()) {
      return this.value as T;
    }
    if (this.isErr() && fallback !== undefined) {
      return fallback;
    }
    throw this.value;
  }
}

export type Request<T> = () => Promise<T>;

export type Task<T> = () => Promise<Result<T>>;

export type Factory<Input, Output> = (value: Input) => Promise<Output>;

export type AsyncQueueConfig<Input, Output> = {
  maxWorkers?: number,
  factory?: Factory<Input, Output>,
  defaultMaxRetries?: number,
  defaultDelay?: number
}

export type TaskConfig = {
  order?: number,
  maxRetries?: number,
  attempts?: number,
  processing?: number,
  delay?: number,
}

export type RequestConfig = {
  delay?: number,
  maxRetries?: number
}

export type CallbackMap = {
  start?: (event: TaskConfig) => void,
  end?: (event: TaskConfig) => void,
  fail?: (event: TaskConfig) => void,
  retry?: (event: TaskConfig) => void
}

export type EventType = "start" | "end" | "fail" | "retry";

export class AsyncQueue<Input, Output> implements QueueLike<Request<Output>, Promise<Result<Output>>> {
  protected config: AsyncQueueConfig<Input, Output>;
  protected queue: QueueLike<Task<Output>, Task<Output>>;
  protected output: Queue<Promise<Result<Output>>>;
  protected concurrent: number;
  protected callbacks: CallbackMap;

  constructor(config: AsyncQueueConfig<Input, Output> = {}) {
    this.config = {
      maxWorkers: 3,
      defaultMaxRetries: 0,
      defaultDelay: 0,
      ...config
    };
    this.queue = new Queue();
    this.output = new Queue();
    this.concurrent = 0;
    this.callbacks = {};
  }

  on(eventType: EventType, cb: (event: TaskConfig) => void): void {
    this.callbacks[eventType] = cb;
  }

  protected notify(eventType: EventType, data: any) {
    if (this.callbacks[eventType] === undefined) return;
    this.callbacks[eventType](data);
  }

  withConfig(config: AsyncQueueConfig<Input, Output>) {
    this.config = { ...this.config, ...config };
    return this;
  }

  get processing() {
    return this.concurrent;
  }

  get maxWorkers() {
    return this.config.maxWorkers;
  }

  get factory() {
    return this.config.factory;
  }

  get defaultMaxRetries() {
    return this.config.defaultMaxRetries;
  }

  get defaultDelay() {
    return this.config.defaultDelay;
  }

  static from<Input, Output>(items: Iterable<Input>, config: AsyncQueueConfig<Input, Output> = {}) {
    config = { maxWorkers: 3, ...config };
    if (!config.factory) {
      throw new ReferenceError("Must provide a factory method!");
    }
    const q = new AsyncQueue<Input, Output>(config);
    for (const item of items) {
      q.enqueue(item);
    }
    return q;
  }

  get size(): number {
    return this.queue.size + this.output.size;
  }

  *[Symbol.iterator](): Generator<Promise<Result<Output>>, void, void> {
    const iter = this[Symbol.asyncIterator]();
    const size = this.size;
    for (let i = 0; i < size; i++) {
      yield iter.next().then(r => r.value) as Promise<Result<Output>>;
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<Result<Output>, void, void> {
    while (this.size) {
      while (this.concurrent < this.maxWorkers && this.queue.size) {
        this.process();
      }
      yield this.output.dequeue();
    }
  }

  protected createTask(req: Input | Request<Output>, config: TaskConfig): Promise<Result<Output>> {
    return new Promise(async resolve => {
      this.concurrent++;
      config.processing = this.processing;
      if (config.attempts > 0) {
        this.notify("retry", config);
      } else {
        this.notify("start", config);
      }
      let result: Result<Output>;
      if (typeof req === "function") {
        result = new Result(await (req as Request<Output>)().catch(err => err));
      } else {
        result = new Result(await this.factory(req).catch(err => err));
      }
      this.concurrent--;
      config.processing = this.processing;
      if (result.isErr() && config.attempts < config.maxRetries) {
        config.delay = 2 ** config.attempts * 50;
        this.notify("fail", config);
        config.attempts++;
        this.enqueue(req, config);
      } else {
        this.notify("end", config);
      }
      resolve(result);
    })
  }

  enqueue(req: Input | Request<Output>, config: RequestConfig = {}): void {
    config = {
      maxRetries: this.defaultMaxRetries,
      delay: this.defaultDelay,
      ...config
    };
    const taskConfig: TaskConfig = {
      attempts: 0,
      order: this.size + 1,
      ...config
    }
    if (!this.factory && typeof req !== "function") {
      throw new Error("Invalid request: Either provide a factory method to the class, or use a callback.");
    }
    if (config.delay > 0) {
      req = this.delay(req, config.delay);
    }
    this.queue.enqueue(() => this.createTask(req, taskConfig));
  }

  async dequeue(): Promise<Result<Output>> {
    const { value, done } = await this[Symbol.asyncIterator]().next();
    if (done) {
      throw new Error("Queue is empty!");
    }
    return value as Result<Output>;
  }

  clear(): void {
    this.queue.clear();
    this.output.clear();
  }

  async collect(): Promise<Array<Result<Output>>> {
    const output: Array<Result<Output>> = [];
    for await (const task of this) {
      output.push(task);
    }
    return output;
  }

  protected delay(req: Input | Request<Output>, delay: number): Request<Output> {
    return () => new Promise(resolve => {
      setTimeout(() => resolve(typeof req === "function" ? (req as Request<Output>)() : this.factory(req)), delay);
    });
  }

  protected async process(): Promise<void> {
    while (this.queue.size) {
      const task = this.queue.dequeue()!;
      const promise = task();
      this.output.enqueue(promise);
      await promise;
    }
  }
}