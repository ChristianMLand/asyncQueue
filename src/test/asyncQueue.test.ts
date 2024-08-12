import { expect } from "chai";
import { AsyncQueue } from "../asyncQueue.js";

describe('AsyncQueue', function () {
  describe('.enqueue()', function () {
    it("should add a request to the queue", function () {
      const q = new AsyncQueue<number, number>();
      expect(q.size).to.equal(0);
      expect(() => q.enqueue(() => Promise.resolve(100))).to.not.throw();
      expect(q.size).to.equal(1);
      expect(() => q.enqueue(1)).to.throw(Error, "Invalid request! Either provide a factory method to the class, or use a callback.");
      expect(() => q.withConfig({ factory: (num: number) => Promise.resolve(num ** 2) }).enqueue(2)).to.not.throw();
      expect(q.size).to.equal(2);
    });
  });
  describe(".dequeue()", function () {
    it("should remove a result from the queue", async function () {
      const q = AsyncQueue.from([1, 2], { factory: (num: number) => Promise.resolve(num ** 2) });
      expect(q.size).to.equal(2);
      expect((await q.dequeue()).value).to.equal(1);
      expect(q.size).to.equal(1);
      expect((await q.dequeue()).unwrap()).to.equal(4);
      expect(q.size).to.equal(0);
      q.enqueue(() => Promise.reject(new Error("Failed 1")), { maxRetries: 0 });
      expect(q.size).to.equal(1);
      const result = await q.dequeue();
      expect(q.size).to.equal(0);
      expect(() => result.unwrap()).to.throw(Error, "Failed 1");
      expect(result.unwrap(-1)).to.equal(-1);
      q.dequeue().catch(err => expect(err).to.equal(Error))
      // expect(async () => await q.dequeue()).to.throw(Error, "Queue is empty!");
    });
  });
  // describe(".collect()", function() {

  // })
  // describe(".clear()", function() {

  // })
  // describe(".from()", function() {

  // })
  // describe(".withConfig()", function() {

  // })
});

describe("AsyncPriorityQueue", function () {

})

describe("Queue", function () {

})

describe("PriorityQueue", function () {

})