import { PriorityQueue } from "./priorityQueue.js";
import { AsyncQueue, Task, Request, Factory, TaskConfig } from "./asyncQueue.js";

export type AsyncPriorityQueueConfig<Input, Output> = {
  maxWorkers?: number,
  factory?: Factory<Input, Output>,
  defaultPriority?: number,
  defaultMaxRetries?: number,
  defaultDelay?: number
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
  
  get defaultPriority() {
    return this.config.defaultPriority;
  }

  override enqueue(req: Input | Request<Output>, config: TaskConfig = {}): void {
    config = {
      attempts: 0,
      maxRetries: this.defaultMaxRetries,
      delay: this.defaultDelay,
      order: this.size + 1,
      priority: this.defaultPriority,
      ...config
    };
    if (!this.factory && typeof req !== "function") {
      throw new Error("Invalid task! Either provide a factory method in the config, or use a callback.");
    }
    if (config.delay > 0) {
      req = this.delay(req, config.delay);
    }
    this.queue.enqueue(() => this.createTask(req, config), config.priority);
  }
}