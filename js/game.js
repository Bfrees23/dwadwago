const DIRS = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
};

export function gridSize(grid) {
  return grid.length;
}

export function createEmptyGrid(size = 4) {
  const n = Number(size) || 4;
  return Array.from({ length: n }, () => Array(n).fill(0));
}

export function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

function emptyCells(grid) {
  const cells = [];
  const n = gridSize(grid);
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (grid[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

export function addRandomTile(grid) {
  const cells = emptyCells(grid);
  if (!cells.length) return null;
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  grid[r][c] = value;
  return { r, c, value };
}

function slideLine(line) {
  const size = line.length;
  const filtered = line.filter((v) => v !== 0);
  const merged = [];
  const mergeAt = [];
  let score = 0;
  let merges = 0;
  let i = 0;

  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const value = filtered[i] * 2;
      mergeAt.push(merged.length);
      merged.push(value);
      score += value;
      merges += 1;
      i += 2;
    } else {
      merged.push(filtered[i]);
      i += 1;
    }
  }

  while (merged.length < size) merged.push(0);

  const moved = merged.some((v, idx) => v !== line[idx]);
  return { line: merged, score, moved, merges, mergeAt };
}

function getLine(grid, dir, index) {
  const n = gridSize(grid);
  const line = [];
  for (let i = 0; i < n; i += 1) {
    if (dir === "left") line.push(grid[index][i]);
    if (dir === "right") line.push(grid[index][n - 1 - i]);
    if (dir === "up") line.push(grid[i][index]);
    if (dir === "down") line.push(grid[n - 1 - i][index]);
  }
  return line;
}

function setLine(grid, dir, index, line) {
  const n = gridSize(grid);
  for (let i = 0; i < n; i += 1) {
    if (dir === "left") grid[index][i] = line[i];
    if (dir === "right") grid[index][n - 1 - i] = line[i];
    if (dir === "up") grid[i][index] = line[i];
    if (dir === "down") grid[n - 1 - i][index] = line[i];
  }
}

function lineIndexToCell(dir, index, offset, size) {
  if (dir === "left") return [index, offset];
  if (dir === "right") return [index, size - 1 - offset];
  if (dir === "up") return [offset, index];
  return [size - 1 - offset, index];
}

export function move(grid, dir) {
  if (!DIRS[dir]) return { grid, scoreGained: 0, moved: false, merges: 0, mergeCells: [] };

  const n = gridSize(grid);
  const next = cloneGrid(grid);
  let scoreGained = 0;
  let moved = false;
  let merges = 0;
  const mergeCells = [];

  for (let i = 0; i < n; i += 1) {
    const line = getLine(next, dir, i);
    const result = slideLine(line);
    setLine(next, dir, i, result.line);
    scoreGained += result.score;
    merges += result.merges;
    if (result.moved) moved = true;
    for (const offset of result.mergeAt) {
      const [r, c] = lineIndexToCell(dir, i, offset, n);
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
      const v = grid[r][c];
      if (c + 1 < n && grid[r][c + 1] === v) return true;
      if (r + 1 < n && grid[r + 1][c] === v) return true;
    }
  }
  return false;
}

export function maxTile(grid) {
  let max = 0;
  for (const row of grid) {
    for (const v of row) max = Math.max(max, v);
  }
  return max;
}

export function createGame(size = 4, winTile = 2048) {
  const grid = createEmptyGrid(size);
  addRandomTile(grid);
  addRandomTile(grid);
  return {
    grid,
    size: gridSize(grid),
    score: 0,
    won: false,
    over: false,
    winTile,
  };
}

export function applyMove(state, dir) {
  if (state.over) return { ...state, moved: false, scoreGained: 0, spawned: null, mergeCells: [] };

  const result = move(state.grid, dir);
  if (!result.moved) {
    return { ...state, moved: false, scoreGained: 0, spawned: null, mergeCells: [] };
  }

  const grid = result.grid;
  const spawned = addRandomTile(grid);
  const score = state.score + result.scoreGained;
  const winTile = state.winTile || 2048;
  const won = state.won || maxTile(grid) >= winTile;
  const over = !canMove(grid);

  return {
    ...state,
    grid,
    score,
    won,
    over,
    moved: true,
    scoreGained: result.scoreGained,
    spawned,
    merges: result.merges,
    mergeCells: result.mergeCells,
  };
}

export { DIRS };
