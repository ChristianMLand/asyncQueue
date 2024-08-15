>**Author: Christian Land**
# Setup
To run the main file: `npm run dev`

To run the build script: `npm run build`

To run the test suites: `npm run test`
# AsyncQueue
## Creating a queue
You can provide a config to the class constructor.
Queue Config options include:
- `maxWorkers`: The maximum number of requests that can be processed concurrently (3 if not provided).
- `defaultFactory`: The default factory function that takes in an input, and returns a promise of an output.
- `defaultMaxRetries`: The default number of times a failed request can attempt to retry if not specified by the request config (0 if not provided).
- `defaultDelay`: The default amount of time in milliseconds that a request should be delayed before processing if not specified by the request config (0 if not provided).
- `defaultPriority`: The default priority of enqueued requests (0 if not provided).
```ts
const q = new AsyncQueue({ maxworkers: 3 });
```
Alternatively you can generate an AsyncQueue by providing a factory and a synchronous iterable to the static `from()` method.
```ts
const q2 = AsyncQueue.from([1,2,3,4], { defaultFactory: api });
```
You can also update the config with the `withConfig()` builder method.
```ts
// will set the maxWorkers to 5 before consuming the queue
for await(const result of q.withConfig({ maxWorkers: 5 })) { 
  console.log(result.unwrap("Failed"));
}
```
## Populating a queue
You can add requests to the queue with the `enqueue()` method.
The `enqueue()` method takes in input data for a configured factory function.
```ts
for (let i = 0; i < 10; i++) {
  q.enqueue(i);
}
```
You can also provide a config as the second argument to `enqueue()`.
Request config options include:
- `maxRetries`: The maximum number of times that a failed request can attempt to retry. This overrides any default provided by the queue's config.
- `delay`: The amount of time in milliseconds that a request should be delayed before processing. This overrides any default provided by the queue's config.
- `priority`: The priority of the request. This overrides any default provided by the queue's config.
- `factory`: The factory function toi be applied to the request. It should take in the input and return a promise of an output.
```ts
 q.enqueue(1, { factory: maybeFailRequest, priority: -100, maxRetries: 3, delay: 250 });
```
## Methods for consuming the queue (**FIFO**):
You can process and consume requests in insertion order as they finish with the `dequeue` method.
`dequeue` is an asynchronous method that needs to be awaited, and returns an output or undefined if the request failed.
>**NOTE:** Attempting to `dequeue()` when the `AsyncQueue` is empty will throw an exception!
```ts
while (q.size > 0) {
  console.log(await q.dequeue());
}
// throws an exception
const result = await q.dequeue();
```
Requests can also be processed and consumed as they finish by iterating over the queue as an async iterable.
```ts
for await (const result of q) {
  console.log(result);
}
```
The `collect()` method asynchronously consumes all of the requests in the queue and returns an array of the results.
```ts
const results = await q.collect();
console.log(results);
```
## Registering event listeners
You can listen for several events emitted by the queue with the `on()` method.
The `on()` method takes an event name, and a callback to be executed once the event fires.
Event names include:
- `start`: This event is fired when a request begins processing.
- `end`: This event is fired when a request finishes processing.
- `fail`: This event is fired when a request fails.
- `retry`: This event is fired when a failed request begins processing a new attempt.
```ts
const q = new AsyncPriorityQueue(qConfig);

q.on("start", ({ index, priority }) => {
  console.warn(`Starting task: ${index}, priority: ${priority}`);
});

q.on("end", ({ index, priority }) => {
  console.warn(`Finished task: ${index}, priority: ${priority}`);
})

q.on("fail", ({ index, delay }) => {
  console.error(`Task ${index} failed, retrying in ${delay}ms...`);
});

q.on("retry", ({ index, priority }) => {
  console.warn(`Retrying task: ${index}, priority: ${priority}`);
});
```
The event data provided includes:
- `order`: The order number in which the request was enqueued, starting from 1.
- `attempts`: The amount of times the request has failed, starting from 0.
- `processing`: The amount of requests concurrently processing.
- `request`: The request input itself.
- `result`: The processed result (or undefined if the request has not resolved successfully).
- `error`: The error object of a failed request.

as well as all task config data.
## Iterating synchronously (Not recommended)
In addition to being an asychronous iterable, `AsyncQueue` is also a synchronous iterable that yields promises.
>**NOTE:** any `AsyncQueue` methods performed while iterating synchronously (such as `enqueue()` or `clear()`) will not take effect until the iteration completes. *This includes automatically retrying any failed requests*.
```ts
for (const task of q) {
    const result = await task;
    if (result !== undefined) {
      console.log(result);
    } else {
      q.enqueue(10); // this new task won't be captured by the loop!
    }
}
const result = await q.dequeue(); // now we can successfully dequeue it
console.log(result ?? "Failed");
```
`AsyncQueues` also work with `Promise.all()`.
>**NOTE** you should prefer using `collect()` instead if requests are allowed to retry.
```ts
console.log(await Promise.all(q));
```
> **NOTE:** `Promise.race()` will always resolve to the first item in the queue, rather than the first task to finish processing.
```ts
console.log(await Promise.race(q)) // always the first item of the queue!
```
## Other Properties
- `clear()`: Clear any remaining tasks from the queue
  **NOTE:** tasks that have already started processing will still be completed.
  ```ts
  for await(const result of q) {
    if (result !== undefined) {
      console.log(result);
    } else {
      break;
    }
  }
  q.clear();
  ```
- `size`: Check to see the remaining items in the queue.
  >**NOTE:** this is not the count of items that have yet to be processed, but the count of items that have yet to be consumed.
  ```ts
  console.log(q.size);
  ```
------------------------------------------
# Queue and PriorityQueue
If you don't need an asynchronous data structure, both a `Queue` and `PriorityQueue` class are provided, with the same interface of:
- `size`: The count of items currently enqueued.
- `enqueue()`: A method to add a new item to the queue.
- `dequeue()`: A method to remove an item from the queue.
- `clear()`: A method to clear the queue of any remaining items.

however the `PriorityQueue`'s `enqueue()` method requires an object with a key for order and a key for priority. Any other keys will be preserved but ignored.

Both `Queue` and `PriorityQueue` are also synchronous iterables, and items can be processed and consumed by iterating over them.