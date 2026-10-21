import { createRoadEngine } from "../lib/roadEngine";

const engine = createRoadEngine();
let version = 0;
self.onmessage = ({ data: { id, method, input, generation } }) => {
  try {
    let result = null;
    if (method === "load") {
      result = engine.load(input);
      version = generation;
    } else if (generation === version) {
      result = engine[method](input);
    }
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
