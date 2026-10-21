import RoadWorker from "../workers/roads.worker";
import { createRoadEngine } from "./roadEngine";

export function createRoadProcessor(factory = () => new RoadWorker()) {
  let worker,
    failed = false,
    sequence = 0,
    generation = 0;
  let latestInput,
    fallback,
    fallbackGeneration = 0;
  const pending = new Map();
  function disable() {
    failed = true;
    worker?.terminate();
    worker = null;
    for (const request of pending.values())
      request.reject(new Error("Worker unavailable"));
    pending.clear();
  }
  function request(method, input, version) {
    if (failed) return Promise.reject(new Error("Worker unavailable"));
    return new Promise((resolve, reject) => {
      try {
        if (!worker) {
          worker = factory();
          worker.onmessage = ({ data }) => {
            const request = pending.get(data.id);
            if (!request) return;
            pending.delete(data.id);
            if (data.error) request.reject(new Error(data.error));
            else request.resolve(data.result);
          };
          worker.onerror = disable;
          worker.onmessageerror = disable;
        }
        const id = ++sequence;
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, method, input, generation: version });
      } catch (error) {
        disable();
        reject(error);
      }
    });
  }
  async function run(method, input, version) {
    try {
      return await request(method, input, version);
    } catch (error) {
      if (version !== generation) return null;
      // Browsers with workers disabled retain the same functionality.
      disable();
      if (!fallback) fallback = createRoadEngine();
      if (method === "load") {
        const data = fallback.load(input);
        fallbackGeneration = generation;
        return data;
      }
      if (fallbackGeneration !== generation) {
        fallback.load(latestInput);
        fallbackGeneration = generation;
      }
      return fallback[method](input);
    }
  }
  return {
    async load(input) {
      const previousInput = latestInput;
      const previousGeneration = generation;
      latestInput = input;
      const version = ++generation;
      try {
        return { data: await run("load", input, version), version };
      } catch (error) {
        if (generation === version) {
          generation = previousGeneration;
          latestInput = previousInput;
          fallbackGeneration = 0;
        }
        throw error;
      }
    },
    view(input, version) {
      return run("view", input, version);
    },
    search(input, version) {
      return run("search", input, version);
    },
  };
}

export const roadProcessor = createRoadProcessor();
