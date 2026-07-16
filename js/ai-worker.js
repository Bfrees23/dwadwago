import { chooseBestMove } from "./ai-core.js";

self.onmessage = (event) => {
  const { id, matrix, rules, options } = event.data || {};
  try {
    const dir = chooseBestMove(matrix, rules || {}, options || {});
    self.postMessage({ id, dir });
  } catch (err) {
    self.postMessage({ id, dir: null, error: String(err?.message || err) });
  }
};
