import axios, { AxiosResponse } from "axios";
import { Queue, AsyncQueue, PriorityQueue, AsyncPriorityQueue } from './index.js';

type PokeData = {
  name: string
}

async function fetchPokemonName(id: number): Promise<string> {
  return axios
    .get("https://pokeapi.co/api/v2/pokemon/" + id)
    .then((res: AxiosResponse<PokeData, undefined>) => res.data.name);
}

(async function () {
  const qConfig = {
    maxWorkers: 3,
    defaultMaxRetries: 3,
    factory: fetchPokemonName,
  };

  const q = new AsyncPriorityQueue(qConfig);

  q.on("start", ({ order, priority }) => {
    console.warn(`Starting task: ${order}, priority: ${priority}`);
  });

  q.on("end", ({ order, priority }) => {
    console.warn(`Finished task: ${order}, priority: ${priority}`);
  })

  q.on("fail", ({ order, delay }) => {
    console.error(`Failed   task: ${order}, retrying in ${delay}ms...`);
  });

  q.on("retry", ({ order, priority }) => {
    console.warn(`Retrying task: ${order}, priority: ${priority}`);
  });

  q.enqueue(() => Promise.reject(new Error("Failed")), { delay: 250 });

  for (let i = 1; i < 10; i++) {
    q.enqueue(i);
  }

  q.enqueue(493, { priority: 1 });

  console.log("------- start q1 --------")
  while (q.size) {
    const result = await q.dequeue();
    if (result.isOk()) {
      console.log(result.value);
    } else {
      console.error(result.value.toString());
    }
  }
  console.log("------- end q1 ----------");
})();