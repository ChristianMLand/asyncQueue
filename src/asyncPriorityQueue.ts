import { PriorityQueue } from "./priorityQueue.js";
import {
  AsyncQueue,
  Task, Request,
  EventType,
  AsyncQueueConfig,
  TaskConfig,
  RequestConfig
} from "./asyncQueue.js";

export interface AsyncPriorityQueueConfig<Input, Output> extends AsyncQueueConfig<Input, Output> {
  defaultPriority?: number;
}

export interface PriorityTaskConfig extends TaskConfig {
  priority?: number;
}

export interface PriorityRequestConfig extends RequestConfig {
  priority?: number;
}

export class AsyncPriorityQueue<Input, Output> extends AsyncQueue<Input, Output> {
  declare protected queue: PriorityQueue<Task<Output>>;
  declare protected config: AsyncPriorityQueueConfig<Input, Output>;

  constructor(config: AsyncPriorityQueueConfig<Input, Output> = {}) {
    super({ defaultPriority: 0, ...config });
    this.queue = new PriorityQueue();
  }

  static override from<Input, Output>(items: Iterable<Input>, config: AsyncPriorityQueueConfig<Input, Output> = {}) {
    const q = new AsyncPriorityQueue(config);
    for (const item of items) {
      q.enqueue(item);
    }
    return q;
  }

  override on(eventType: EventType, cb: (event: PriorityTaskConfig) => void): void {
    super.on(eventType, cb);
  }

  override enqueue(req: Input | Request<Output>, config: PriorityRequestConfig = {}): void {
    const taskConfig: PriorityTaskConfig = {
      maxRetries: this.config.defaultMaxRetries,
      delay: this.config.defaultDelay,
      priority: this.config.defaultPriority,
      attempts: 0,
      order: this.size + 1,
      ...config
    }
    if (!this.config.factory && !this.isCallback(req)) {
      throw new Error("Invalid request: Either provide a factory method in the config, or use a callback.");
    }
    if (taskConfig.delay > 0) {
      req = this.delay(req, taskConfig.delay);
    }
    this.queue.enqueue(() => this.createTask(req, taskConfig), taskConfig.priority);
  }
}