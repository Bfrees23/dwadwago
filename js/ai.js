export { evaluate, chooseBestMove } from "./ai-core.js";

/** Async brain: Web Worker when available, sync fallback otherwise. */
export function createAutoBrain() {
  let worker = null;
  let reqId = 0;
  const pending = new Map();

  const canWorker = typeof Worker !== "undefined" && typeof window !== "undefined";
  if (canWorker) {
    try {
      worker = new Worker(new URL("./ai-worker.js", import.meta.url), { type: "module" });
      worker.onmessage = (event) => {
        const { id, dir, error } = event.data || {};
        const job = pending.get(id);
        if (!job) return;
        pending.delete(id);
        if (error) job.reject(new Error(error));
        else job.resolve(dir);
      };
      worker.onerror = () => {
        worker.terminate();
        worker = null;
      };
    } catch {
      worker = null;
    }
  }

  return {
    async choose(matrix, rules, options = {}) {
      const { chooseBestMove } = await import("./ai-core.js");
      if (!worker) return chooseBestMove(matrix, rules, options);

      const id = (reqId += 1);
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          if (!pending.has(id)) return;
          pending.delete(id);
          resolve(chooseBestMove(matrix, rules, { ...options, timeMs: 12 }));
        }, (options.timeMs || 45) + 100);

        pending.set(id, {
          resolve: (dir) => {
            clearTimeout(timer);
            resolve(dir);
          },
          reject: () => {
            clearTimeout(timer);
            resolve(chooseBestMove(matrix, rules, { ...options, timeMs: 12 }));
          },
        });
        worker.postMessage({ id, matrix, rules, options });
      });
    },
    dispose() {
      if (worker) worker.terminate();
      worker = null;
      pending.clear();
    },
  };
}
