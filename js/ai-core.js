import { moveMatrix, canMoveMatrix } from "./game.js";

const DIRS = ["up", "left", "down", "right"];

function emptyCells(matrix) {
  const cells = [];
  const n = matrix.length;
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!matrix[r][c]) cells.push([r, c]);
    }
  }
  return cells;
}

function cloneMatrix(matrix) {
  return matrix.map((row) => row.slice());
}

function spawnValues(rules) {
  const eight = rules.spawnEightChance || 0;
  const two = Math.max(0, (rules.spawnTwoChance ?? 0.9) * (1 - eight));
  const four = Math.max(0, 1 - eight - two);
  const out = [];
  if (two > 0) out.push([2, two]);
  if (four > 0) out.push([4, four]);
  if (eight > 0) out.push([8, eight]);
  if (!out.length) out.push([2, 1]);
  const sum = out.reduce((a, [, p]) => a + p, 0);
  return out.map(([v, p]) => [v, p / sum]);
}

function weightTable(size) {
  const table = Array.from({ length: size }, () => Array(size).fill(0));
  let rank = 0;
  for (let r = 0; r < size; r += 1) {
    if (r % 2 === 0) {
      for (let c = 0; c < size; c += 1) table[r][c] = rank++;
    } else {
      for (let c = size - 1; c >= 0; c -= 1) table[r][c] = rank++;
    }
  }
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      table[r][c] = (size * size - 1 - table[r][c]) ** 1.35;
    }
  }
  return table;
}

const WEIGHT_CACHE = new Map();
function weights(size) {
  if (!WEIGHT_CACHE.has(size)) WEIGHT_CACHE.set(size, weightTable(size));
  return WEIGHT_CACHE.get(size);
}

function smoothness(matrix) {
  let score = 0;
  const n = matrix.length;
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const v = matrix[r][c];
      if (!v) continue;
      const log = Math.log2(v);
      if (c + 1 < n && matrix[r][c + 1]) score -= Math.abs(log - Math.log2(matrix[r][c + 1]));
      if (r + 1 < n && matrix[r + 1][c]) score -= Math.abs(log - Math.log2(matrix[r + 1][c]));
    }
  }
  return score;
}

function monotonicity(matrix) {
  const totals = [0, 0, 0, 0];
  const n = matrix.length;
  for (let r = 0; r < n; r += 1) {
    const vals = [];
    for (let c = 0; c < n; c += 1) if (matrix[r][c]) vals.push(Math.log2(matrix[r][c]));
    for (let i = 0; i < vals.length - 1; i += 1) {
      if (vals[i] > vals[i + 1]) totals[0] += vals[i + 1] - vals[i];
      else totals[1] += vals[i] - vals[i + 1];
    }
  }
  for (let c = 0; c < n; c += 1) {
    const vals = [];
    for (let r = 0; r < n; r += 1) if (matrix[r][c]) vals.push(Math.log2(matrix[r][c]));
    for (let i = 0; i < vals.length - 1; i += 1) {
      if (vals[i] > vals[i + 1]) totals[2] += vals[i + 1] - vals[i];
      else totals[3] += vals[i] - vals[i + 1];
    }
  }
  return Math.max(totals[0], totals[1]) + Math.max(totals[2], totals[3]);
}

function freeMerges(matrix) {
  let merges = 0;
  const n = matrix.length;
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const v = matrix[r][c];
      if (!v) continue;
      if (c + 1 < n && matrix[r][c + 1] === v) merges += 1;
      if (r + 1 < n && matrix[r + 1][c] === v) merges += 1;
    }
  }
  return merges;
}

export function evaluate(matrix) {
  const n = matrix.length;
  const w = weights(n);
  let weighted = 0;
  let empty = 0;
  let max = 0;
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const v = matrix[r][c];
      if (!v) {
        empty += 1;
        continue;
      }
      max = Math.max(max, v);
      weighted += Math.log2(v) * w[r][c];
    }
  }
  return (
    weighted * 11 +
    empty * 270 +
    smoothness(matrix) * 18 +
    monotonicity(matrix) * 55 +
    freeMerges(matrix) * 80 +
    Math.log2(max || 2) * 15
  );
}

function sampleEmpties(empties, limit) {
  if (empties.length <= limit) return empties;
  const out = [];
  const step = empties.length / limit;
  for (let i = 0; i < limit; i += 1) {
    out.push(empties[Math.min(empties.length - 1, Math.floor(i * step))]);
  }
  return out;
}

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function expectSpawn(matrix, rules, depth, prob, deadline, dist) {
  if (now() > deadline) return evaluate(matrix);
  const empties = emptyCells(matrix);
  if (!empties.length) return evaluate(matrix);

  const spawnCount = Math.max(1, rules.spawnPerMove || 1);
  const sample = sampleEmpties(empties, rules.size >= 6 ? 4 : 6);
  let total = 0;

  for (const [r, c] of sample) {
    for (const [value, pVal] of dist) {
      const next = cloneMatrix(matrix);
      next[r][c] = value;
      let node = next;
      if (spawnCount > 1) {
        const rest = emptyCells(node);
        for (let s = 1; s < spawnCount && rest.length; s += 1) {
          const [rr, cc] = rest[(r * 7 + c * 13 + s) % rest.length];
          const [v2] = dist[Math.min(dist.length - 1, s % dist.length)];
          node[rr][cc] = v2;
          const idx = rest.findIndex(([a, b]) => a === rr && b === cc);
          if (idx >= 0) rest.splice(idx, 1);
        }
      }
      total += pVal * searchMove(node, rules, depth, prob * pVal, deadline, dist);
    }
  }
  return total / sample.length;
}

function searchMove(matrix, rules, depth, prob, deadline, dist) {
  if (depth <= 0 || prob < 0.05 || now() > deadline || !canMoveMatrix(matrix)) {
    return evaluate(matrix);
  }
  let best = -Infinity;
  for (const dir of DIRS) {
    const result = moveMatrix(matrix, dir);
    if (!result.moved) continue;
    const score =
      expectSpawn(result.matrix, rules, depth - 1, prob * 0.9, deadline, dist) +
      result.scoreGained * 0.18;
    if (score > best) best = score;
  }
  return best === -Infinity ? evaluate(matrix) : best;
}

function depthBudget(matrix) {
  const empty = emptyCells(matrix).length;
  const size = matrix.length;
  if (size >= 8) return empty > 20 ? 1 : 2;
  if (size >= 7) return empty > 16 ? 1 : 2;
  if (size >= 6) return empty > 12 ? 2 : 3;
  if (size >= 5) return empty > 10 ? 2 : 3;
  if (empty > 8) return 3;
  if (empty > 4) return 4;
  return 5;
}

export function chooseBestMove(matrix, rules = {}, options = {}) {
  const timeMs = options.timeMs ?? (matrix.length >= 6 ? 28 : 45);
  const deadline = now() + timeMs;
  const dist = spawnValues(rules);
  const maxDepth = options.depth ?? depthBudget(matrix);

  let bestDir = null;
  let bestScore = -Infinity;

  for (const dir of DIRS) {
    const result = moveMatrix(matrix, dir);
    if (!result.moved) continue;
    let score = evaluate(result.matrix) + result.scoreGained * 0.2;
    for (let depth = 1; depth <= maxDepth; depth += 1) {
      if (now() > deadline) break;
      score =
        expectSpawn(result.matrix, rules, depth - 1, 1, deadline, dist) +
        result.scoreGained * 0.2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }

  if (!bestDir) {
    for (const dir of DIRS) {
      if (moveMatrix(matrix, dir).moved) return dir;
    }
  }
  return bestDir;
}
