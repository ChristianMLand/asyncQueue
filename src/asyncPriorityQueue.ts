import { PriorityQueue } from "./priorityQueue.js";
import { AsyncQueue, Task, Request, EventType, AsyncQueueConfig, TaskConfig, RequestConfig } from "./asyncQueue.js";

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
    super();
    this.config = {
      maxWorkers: 3,
      defaultPriority: 0,
      defaultMaxRetries: 0,
      defaultDelay: 0,
      ...config
    };
    this.queue = new PriorityQueue();
  }

  on(eventType: EventType, cb: (event: PriorityTaskConfig) => void): void {
    this.callbacks[eventType] = cb;
  }

  override enqueue(req: Input | Request<Output>, config: PriorityRequestConfig = {}): void {
    config = {
      maxRetries: this.config.defaultMaxRetries,
      delay: this.config.defaultDelay,
      priority: this.config.defaultPriority,
      ...config
    };
    const taskConfig: PriorityTaskConfig = {
      attempts: 0,
      order: this.size + 1,
      ...config
    }
    if (!this.config.factory && typeof req !== "function") {
      throw new Error("Invalid task! Either provide a factory method in the config, or use a callback.");
    }
    if (config.delay > 0) {
      req = this.delay(req, config.delay);
    }
    this.queue.enqueue(() => this.createTask(req, taskConfig), config.priority);
  }
}