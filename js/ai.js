import { SIZE, move, canMove, cloneGrid } from "./game.js";

function emptyCount(grid) {
  let n = 0;
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (grid[r][c] === 0) n += 1;
    }
  }
  return n;
}

function smoothness(grid) {
  let score = 0;
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const v = grid[r][c];
      if (!v) continue;
      if (c + 1 < SIZE && grid[r][c + 1]) {
        score -= Math.abs(Math.log2(v) - Math.log2(grid[r][c + 1]));
      }
      if (r + 1 < SIZE && grid[r + 1][c]) {
        score -= Math.abs(Math.log2(v) - Math.log2(grid[r + 1][c]));
      }
    }
  }
  return score;
}

function monotonicity(grid) {
  const totals = [0, 0, 0, 0];

  for (let r = 0; r < SIZE; r += 1) {
    const row = [];
    for (let c = 0; c < SIZE; c += 1) {
      if (grid[r][c]) row.push(Math.log2(grid[r][c]));
    }
    for (let i = 0; i < row.length - 1; i += 1) {
      if (row[i] > row[i + 1]) totals[0] += row[i + 1] - row[i];
      else totals[1] += row[i] - row[i + 1];
    }
  }

  for (let c = 0; c < SIZE; c += 1) {
    const col = [];
    for (let r = 0; r < SIZE; r += 1) {
      if (grid[r][c]) col.push(Math.log2(grid[r][c]));
    }
    for (let i = 0; i < col.length - 1; i += 1) {
      if (col[i] > col[i + 1]) totals[2] += col[i + 1] - col[i];
      else totals[3] += col[i] - col[i + 1];
    }
  }

  return Math.max(totals[0], totals[1]) + Math.max(totals[2], totals[3]);
}

function cornerBonus(grid) {
  const corners = [
    grid[0][0],
    grid[0][SIZE - 1],
    grid[SIZE - 1][0],
    grid[SIZE - 1][SIZE - 1],
  ];
  return Math.max(...corners);
}

function evaluate(grid) {
  const empty = emptyCount(grid);
  return (
    empty * 270 +
    smoothness(grid) * 12 +
    monotonicity(grid) * 45 +
    Math.log2(cornerBonus(grid) || 2) * 20
  );
}

function search(grid, depth, prob) {
  if (depth <= 0 || prob < 0.08 || !canMove(grid)) {
    return evaluate(grid);
  }

  let best = -Infinity;
  for (const dir of ["up", "left", "down", "right"]) {
    const result = move(grid, dir);
    if (!result.moved) continue;

    const empties = [];
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (result.grid[r][c] === 0) empties.push([r, c]);
      }
    }

    if (!empties.length) {
      best = Math.max(best, evaluate(result.grid));
      continue;
    }

    let expected = 0;
    const sample = empties.length > 6
      ? empties.sort(() => Math.random() - 0.5).slice(0, 6)
      : empties;

    for (const [r, c] of sample) {
      const g2 = cloneGrid(result.grid);
      g2[r][c] = 2;
      expected += 0.9 * search(g2, depth - 1, prob * 0.9);

      const g4 = cloneGrid(result.grid);
      g4[r][c] = 4;
      expected += 0.1 * search(g4, depth - 1, prob * 0.1);
    }

    expected /= sample.length;
    best = Math.max(best, expected + result.scoreGained * 0.15);
  }

  return best === -Infinity ? evaluate(grid) : best;
}

export function chooseBestMove(grid) {
  const empty = emptyCount(grid);
  const depth = empty > 8 ? 2 : empty > 4 ? 3 : 4;

  let bestDir = null;
  let bestScore = -Infinity;

  for (const dir of ["up", "left", "down", "right"]) {
    const result = move(grid, dir);
    if (!result.moved) continue;
    const score = search(result.grid, depth - 1, 1) + result.scoreGained * 0.2;
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }

  return bestDir;
}
