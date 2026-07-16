/** Seedable RNG for tests and deterministic AI rollouts. */
export function createRng(seed = Date.now() % 1_000_000) {
  let s = (Number(seed) >>> 0) || 1;
  return {
    seed: s,
    next() {
      // xorshift32
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) / 4294967296);
    },
    int(max) {
      return Math.floor(this.next() * max);
    },
    pick(list) {
      return list[this.int(list.length)];
    },
  };
}

export const defaultRng = {
  next: () => Math.random(),
  int: (max) => Math.floor(Math.random() * max),
  pick: (list) => list[Math.floor(Math.random() * list.length)],
};
