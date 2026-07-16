import { defaultRng } from "./rng.js";

export const DIRS = ["up", "down", "left", "right"];

const DEFAULT_RULES = {
  size: 4,
  winTile: 2048,
  spawnTwoChance: 0.9,
  spawnEightChance: 0,
  spawnPerMove: 1,
  startTiles: 2,
  maxMoves: null,
  timeLimitSec: null,
};

let tileSeq = 1;

function nextTileId() {
  tileSeq += 1;
  return tileSeq;
}

export function resetTileIds(start = 1) {
  tileSeq = start;
}

export function makeTile(value, opts = {}) {
  return {
    id: opts.id ?? nextTileId(),
    value,
    newborn: Boolean(opts.newborn),
    merged: Boolean(opts.merged),
  };
}

export function gridSize(grid) {
  return grid.length;
}

export function createEmptyGrid(size = 4) {
  const n = Number(size) || 4;
  return Array.from({ length: n }, () => Array(n).fill(null));
}

export function cloneGrid(grid) {
  return grid.map((row) => row.map((tile) => (tile ? { ...tile, newborn: false, merged: false } : null)));
}

export function toMatrix(grid) {
  return grid.map((row) => row.map((tile) => (tile ? tile.value : 0)));
}

export function emptyCells(grid) {
  const cells = [];
  const n = gridSize(grid);
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!grid[r][c]) cells.push([r, c]);
    }
  }
  return cells;
}

export function pickSpawnValue(rules, rng = defaultRng) {
  const eightChance = rules.spawnEightChance || 0;
  if (eightChance > 0 && rng.next() < eightChance) return 8;
  return rng.next() < (rules.spawnTwoChance ?? 0.9) ? 2 : 4;
}

export function addRandomTile(grid, rules = DEFAULT_RULES, rng = defaultRng) {
  const cells = emptyCells(grid);
  if (!cells.length) return null;
  const [r, c] = rng.pick(cells);
  const value = pickSpawnValue(rules, rng);
  const tile = makeTile(value, { newborn: true });
  grid[r][c] = tile;
  return { r, c, tile, value };
}

function addRandomTiles(grid, count, rules, rng) {
  const spawned = [];
  for (let i = 0; i < count; i += 1) {
    const item = addRandomTile(grid, rules, rng);
    if (!item) break;
    spawned.push(item);
  }
  return spawned;
}

function slideTiles(line) {
  const filled = line.filter(Boolean);
  const result = Array(line.length).fill(null);
  const merges = [];
  let score = 0;
  let write = 0;
  let i = 0;
  let moved = false;

  while (i < filled.length) {
    const current = filled[i];
    const next = filled[i + 1];
    if (next && current.value === next.value) {
      const merged = makeTile(current.value * 2, { merged: true });
      result[write] = merged;
      merges.push({
        at: write,
        tile: merged,
        sources: [current.id, next.id],
      });
      score += merged.value;
      write += 1;
      i += 2;
    } else {
      result[write] = { ...current, newborn: false, merged: false };
      write += 1;
      i += 1;
    }
  }

  for (let idx = 0; idx < line.length; idx += 1) {
    const before = line[idx];
    const after = result[idx];
    if ((before?.id || null) !== (after?.id || null) || (before?.value || 0) !== (after?.value || 0)) {
      moved = true;
      break;
    }
  }

  return { line: result, score, moved, merges };
}

function readVector(grid, dir, index) {
  const n = gridSize(grid);
  const line = [];
  for (let i = 0; i < n; i += 1) {
    if (dir === "left") line.push(grid[index][i]);
    else if (dir === "right") line.push(grid[index][n - 1 - i]);
    else if (dir === "up") line.push(grid[i][index]);
    else line.push(grid[n - 1 - i][index]);
  }
  return line;
}

function writeVector(grid, dir, index, line) {
  const n = gridSize(grid);
  for (let i = 0; i < n; i += 1) {
    if (dir === "left") grid[index][i] = line[i];
    else if (dir === "right") grid[index][n - 1 - i] = line[i];
    else if (dir === "up") grid[i][index] = line[i];
    else grid[n - 1 - i][index] = line[i];
  }
}

function vectorIndexToCell(dir, index, offset, size) {
  if (dir === "left") return [index, offset];
  if (dir === "right") return [index, size - 1 - offset];
  if (dir === "up") return [offset, index];
  return [size - 1 - offset, index];
}

function slideValues(line) {
  const filled = line.filter((v) => v);
  const result = Array(line.length).fill(0);
  let score = 0;
  let write = 0;
  let i = 0;
  while (i < filled.length) {
    if (i + 1 < filled.length && filled[i] === filled[i + 1]) {
      const value = filled[i] * 2;
      result[write] = value;
      score += value;
      write += 1;
      i += 2;
    } else {
      result[write] = filled[i];
      write += 1;
      i += 1;
    }
  }
  const moved = result.some((v, idx) => v !== line[idx]);
  return { line: result, score, moved };
}

function readValueVector(matrix, dir, index) {
  const n = matrix.length;
  const line = [];
  for (let i = 0; i < n; i += 1) {
    if (dir === "left") line.push(matrix[index][i]);
    else if (dir === "right") line.push(matrix[index][n - 1 - i]);
    else if (dir === "up") line.push(matrix[i][index]);
    else line.push(matrix[n - 1 - i][index]);
  }
  return line;
}

function writeValueVector(matrix, dir, index, line) {
  const n = matrix.length;
  for (let i = 0; i < n; i += 1) {
    if (dir === "left") matrix[index][i] = line[i];
    else if (dir === "right") matrix[index][n - 1 - i] = line[i];
    else if (dir === "up") matrix[i][index] = line[i];
    else matrix[n - 1 - i][index] = line[i];
  }
}

/** Pure number-matrix move for AI — does not touch tile ids. */
export function moveMatrix(matrix, dir) {
  if (!DIRS.includes(dir)) return { matrix, scoreGained: 0, moved: false };
  const n = matrix.length;
  const next = matrix.map((row) => row.slice());
  let scoreGained = 0;
  let moved = false;
  for (let i = 0; i < n; i += 1) {
    const slid = slideValues(readValueVector(next, dir, i));
    writeValueVector(next, dir, i, slid.line);
    scoreGained += slid.score;
    if (slid.moved) moved = true;
  }
  return { matrix: next, scoreGained, moved };
}

export function move(grid, dir) {
  if (!DIRS.includes(dir)) {
    return { grid, scoreGained: 0, moved: false, merges: [], mergeCells: [] };
  }

  const n = gridSize(grid);
  const next = cloneGrid(grid);
  let scoreGained = 0;
  let moved = false;
  const merges = [];
  const mergeCells = [];

  for (let i = 0; i < n; i += 1) {
    const line = readVector(next, dir, i);
    const slid = slideTiles(line);
    writeVector(next, dir, i, slid.line);
    scoreGained += slid.score;
    if (slid.moved) moved = true;
    for (const merge of slid.merges) {
      const [r, c] = vectorIndexToCell(dir, i, merge.at, n);
      merges.push({ r, c, tile: merge.tile, sources: merge.sources });
      mergeCells.push(`${r},${c}`);
    }
  }

  return { grid: next, scoreGained, moved, merges, mergeCells };
}

export function canMove(grid) {
  const n = gridSize(grid);
  if (emptyCells(grid).length) return true;
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const v = grid[r][c]?.value;
      if (!v) continue;
      if (c + 1 < n && grid[r][c + 1]?.value === v) return true;
      if (r + 1 < n && grid[r + 1][c]?.value === v) return true;
    }
  }
  return false;
}

export function canMoveMatrix(matrix) {
  const n = matrix.length;
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (!matrix[r][c]) return true;
      const v = matrix[r][c];
      if (c + 1 < n && matrix[r][c + 1] === v) return true;
      if (r + 1 < n && matrix[r + 1][c] === v) return true;
    }
  }
  return false;
}

export function maxTile(grid) {
  let max = 0;
  for (const row of grid) {
    for (const tile of row) {
      if (tile) max = Math.max(max, tile.value);
    }
  }
  return max;
}

export function maxTileMatrix(matrix) {
  let max = 0;
  for (const row of matrix) {
    for (const v of row) max = Math.max(max, v);
  }
  return max;
}

function clearTransientFlags(grid) {
  for (const row of grid) {
    for (const tile of row) {
      if (tile) {
        tile.newborn = false;
        tile.merged = false;
      }
    }
  }
}

export function createGame(rulesInput = {}, rng = defaultRng) {
  const rules = { ...DEFAULT_RULES, ...rulesInput };
  resetTileIds(1);
  const grid = createEmptyGrid(rules.size);
  addRandomTiles(grid, rules.startTiles, rules, rng);
  clearTransientFlags(grid);
  // mark start tiles as newborn for first paint
  for (const row of grid) {
    for (const tile of row) {
      if (tile) tile.newborn = true;
    }
  }

  return {
    grid,
    size: rules.size,
    score: 0,
    won: false,
    wonShown: false,
    over: false,
    reason: null,
    winTile: rules.winTile,
    rules,
    moves: 0,
    movesLeft: rules.maxMoves,
    history: [],
  };
}

function snapshot(state) {
  return {
    grid: cloneGrid(state.grid),
    score: state.score,
    won: state.won,
    wonShown: state.wonShown,
    over: state.over,
    reason: state.reason,
    moves: state.moves,
    movesLeft: state.movesLeft,
  };
}

export function applyMove(state, dir, rng = defaultRng) {
  if (state.over) {
    return { ...state, moved: false, scoreGained: 0, spawned: [], mergeCells: [] };
  }

  const result = move(state.grid, dir);
  if (!result.moved) {
    return { ...state, moved: false, scoreGained: 0, spawned: [], mergeCells: [] };
  }

  const rules = state.rules || DEFAULT_RULES;
  const history = [...(state.history || []), snapshot(state)].slice(-30);
  const grid = result.grid;
  const spawned = addRandomTiles(grid, rules.spawnPerMove || 1, rules, rng);
  const score = state.score + result.scoreGained;
  const reachedWin = maxTile(grid) >= (state.winTile || rules.winTile || 2048);
  const won = state.won || reachedWin;
  const justWon = reachedWin && !state.won;
  const moves = (state.moves || 0) + 1;

  let movesLeft = state.movesLeft;
  if (typeof movesLeft === "number") movesLeft = Math.max(0, movesLeft - 1);

  let over = !canMove(grid);
  let reason = over ? "board" : null;
  if (!over && typeof movesLeft === "number" && movesLeft <= 0) {
    over = true;
    reason = "moves";
  }

  return {
    ...state,
    grid,
    score,
    won,
    justWon,
    over,
    reason,
    moves,
    movesLeft,
    history,
    moved: true,
    scoreGained: result.scoreGained,
    spawned,
    merges: result.merges,
    mergeCells: result.mergeCells,
  };
}

export function undoMove(state) {
  const history = state.history || [];
  if (!history.length) return { ...state, moved: false };
  // Don't undo a hard time-out with empty board history semantics — still allow restore.
  const prev = history[history.length - 1];
  return {
    ...state,
    grid: cloneGrid(prev.grid),
    score: prev.score,
    won: prev.won,
    wonShown: prev.wonShown,
    over: false,
    reason: null,
    moves: prev.moves,
    movesLeft: prev.movesLeft,
    history: history.slice(0, -1),
    moved: true,
    scoreGained: 0,
    spawned: [],
    mergeCells: [],
    justWon: false,
  };
}

export function markWonShown(state) {
  return { ...state, wonShown: true, justWon: false };
}

export function endByTime(state) {
  if (state.over) return state;
  return { ...state, over: true, reason: "time" };
}

export { DEFAULT_RULES };
