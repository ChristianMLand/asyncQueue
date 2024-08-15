import axios, { AxiosResponse } from "axios";
import {
  Queue,
  AsyncQueue,
  PriorityQueue,
} from './index.js';

type PokeData = {
  name: string
}

async function fetchPokemonName(id: number): Promise<string> {
  return axios
    .get("https://pokeapi.co/api/v2/pokemon/" + id)
    .then((res: AxiosResponse<PokeData, undefined>) => res.data.name);
}

function maybeFailRequest(_: any): Promise<any> {
  return new Promise((res, rej) => {
    if (Math.floor(Math.random() * 2) === 0) {
      res("Success!");
    } else {
      rej(new Error("Failed!"))
    }
  });
}

(async function () {
  const qConfig = {
    maxWorkers: 3,
    defaultMaxRetries: 3,
    defaultFactory: fetchPokemonName,
  };

  const q = new AsyncQueue(qConfig);

  q.on("start", ({ order, priority, processing }) => {
    console.warn(`Starting task: ${order}, priority: ${priority}, processing: ${processing}`);
  });

  q.on("end", ({ order, processing, result }) => {
    console.warn(`Finished task: ${order}, result: ${result}, processing: ${processing}`);
  })

  q.on("fail", ({ order, delay, error }) => {
    console.error(`Failed task: ${order}, with: ${error}, retrying in: ${delay}ms...`);
  });

  q.on("retry", ({ order, priority, processing }) => {
    console.warn(`Retrying task: ${order}, priority: ${priority}, processing: ${processing}`);
  });

  for (let i = 1; i < 10; i++) {
    q.enqueue(i);
  }

  q.enqueue(1, { factory: maybeFailRequest, priority: -100 });

  console.log("------- start q1 --------");
  for await (const result of q) {
    console.log(result);
  }
  console.log("------- end q1 ----------");
  console.log("------- start q2 --------");
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  console.log(await AsyncQueue.from(items, qConfig).collect());
  console.log("------- end q2 ----------");
})();