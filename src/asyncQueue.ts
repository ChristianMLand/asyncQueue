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

export type Factory<Input, Output> = (value: Input) => Promise<Output>;

export interface AsyncQueueConfig<Input, Output> {
  maxWorkers?: number;
  factory?: Factory<Input, Output>;
  defaultMaxRetries?: number;
  defaultDelay?: number;
}

export interface RequestConfig {
  delay?: number;
  maxRetries?: number;
}

export interface TaskConfig extends RequestConfig {
  order?: number;
  attempts?: number;
  processing?: number;
}

export type EventHandler = (event: TaskConfig) => void;

export type EventHandlers = {
  start?: EventHandler,
  end?: EventHandler,
  fail?: EventHandler,
  retry?: EventHandler
}

export type EventType = keyof EventHandlers;

export type Request<Output> = () => Promise<Output>;

export type Task<Output> = () => Promise<Result<Output>>;

export class AsyncQueue<Input, Output> implements QueueLike<Input | Request<Output>, Promise<Result<Output>>> {
  protected config: AsyncQueueConfig<Input, Output>;
  protected queue: QueueLike<Task<Output>, Task<Output>>;
  protected output: Queue<Promise<Result<Output>>>;
  protected processing: number;
  protected handlers: EventHandlers;

  constructor(config: AsyncQueueConfig<Input, Output> = {}) {
    this.config = {
      maxWorkers: 3,
      defaultMaxRetries: 0,
      defaultDelay: 0,
      ...config
    };
    this.queue = new Queue();
    this.output = new Queue();
    this.processing = 0;
    this.handlers = {};
  }

  on(eventType: EventType, cb: (event: TaskConfig) => void): void {
    this.handlers[eventType] = cb;
  }

  protected notify(eventType: EventType, data: any) {
    if (this.handlers[eventType] === undefined) return;
    this.handlers[eventType](data);
  }

  withConfig(config: AsyncQueueConfig<Input, Output>) {
    this.config = { ...this.config, ...config };
    return this;
  }

  static from<Input, Output>(items: Iterable<Input>, config: AsyncQueueConfig<Input, Output> = {}) {
    const q = new AsyncQueue(config);
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
      while (this.processing < this.config.maxWorkers && this.queue.size) {
        this.process();
      }
      yield this.output.dequeue();
    }
  }

  protected isCallback<Input, Output>(maybeFunc: Input | Request<Output>): maybeFunc is Request<Output> {
    return typeof maybeFunc === 'function';
  }

  protected createTask(req: Input | Request<Output>, config: TaskConfig): Promise<Result<Output>> {
    return new Promise(async resolve => {
      config.processing = ++this.processing;
      this.notify(config.attempts > 0 ? "retry" : "start", config);
      const result = new Result(await (this.isCallback(req) ? req() : this.config.factory(req)).catch(err => err));
      config.processing = --this.processing;
      if (result.isErr() && config.attempts < config.maxRetries) {
        config.delay = 2 ** config.attempts * 50;
        config.attempts++;
        this.notify("fail", config);
        this.enqueue(req, config);
      } else {
        this.notify("end", config);
      }
      resolve(result);
    })
  }

  enqueue(req: Input | Request<Output>, config: RequestConfig = {}): void {
    const taskConfig: TaskConfig = {
      maxRetries: this.config.defaultMaxRetries,
      delay: this.config.defaultDelay,
      attempts: 0,
      order: this.size + 1,
      ...config
    }
    if (!this.config.factory && !this.isCallback(req)) {
      throw new Error("Invalid request: Either provide a factory method to the class, or use a callback.");
    }
    if (taskConfig.delay > 0) {
      req = this.delay(req, taskConfig.delay);
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
      setTimeout(() => resolve(typeof req === "function" ? (req as Request<Output>)() : this.config.factory(req)), delay);
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