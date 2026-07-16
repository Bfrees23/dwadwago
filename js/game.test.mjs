import { createRng } from "./rng.js";
import {
  createEmptyGrid,
  move,
  moveMatrix,
  addRandomTile,
  canMove,
  applyMove,
  createGame,
  undoMove,
  toMatrix,
  makeTile,
} from "./game.js";
import { chooseBestMove, evaluate } from "./ai-core.js";
import { MODES, getModeById, modeRules, getModesByGroup } from "./modes.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function testMergeLeft() {
  const grid = createEmptyGrid(4);
  grid[0] = [makeTile(2, { id: 1 }), makeTile(2, { id: 2 }), null, null];
  const { grid: next, scoreGained, moved } = move(grid, "left");
  assert(moved, "should move");
  assert(next[0][0].value === 4, "2+2 -> 4");
  assert(next[0][0].merged, "merged flag");
  assert(scoreGained === 4, "score +4");
}

function testMatrixMove() {
  const matrix = [
    [2, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const { matrix: next, scoreGained, moved } = moveMatrix(matrix, "left");
  assert(moved && next[0][0] === 4 && scoreGained === 4, "matrix merge");
}

function testNoMove() {
  const grid = createEmptyGrid(4);
  grid[0] = [makeTile(2), makeTile(4), makeTile(8), makeTile(16)];
  const { moved } = move(grid, "left");
  assert(!moved, "already packed left");
}

function testRngSpawn() {
  const rng = createRng(42);
  const grid = createEmptyGrid(4);
  const a = addRandomTile(grid, { spawnTwoChance: 0, spawnEightChance: 0 }, rng);
  assert(a.value === 4, "forced fours");
}

function testApplyAndUndo() {
  const rng = createRng(7);
  let state = createGame({ size: 4, winTile: 2048 }, rng);
  assert(state.grid.flat().filter(Boolean).length === 2, "starts with 2");
  let moved = null;
  for (const dir of ["up", "down", "left", "right"]) {
    const next = applyMove(state, dir, rng);
    if (next.moved) {
      moved = next;
      break;
    }
  }
  assert(moved, "opening move");
  assert(moved.history.length === 1, "history saved");
  const back = undoMove(moved);
  assert(back.score === state.score, "undo score");
  assert(back.history.length === 0, "history popped");
}

function testAllModesBoot() {
  assert(getModesByGroup("size").length === 7, "seven size modes");
  assert(getModesByGroup("special").length === 6, "six special");
  for (const mode of MODES) {
    const state = createGame(modeRules(mode), createRng(1));
    assert(state.grid.length === mode.size, `${mode.id} size`);
    assert(state.winTile === mode.winTile, `${mode.id} win`);
  }
}

function testSprintMoves() {
  const rng = createRng(3);
  let state = createGame(modeRules(getModeById("sprint")), rng);
  assert(state.movesLeft === 50, "50 moves");
  for (const dir of ["up", "down", "left", "right"]) {
    const next = applyMove(state, dir, rng);
    if (next.moved) {
      state = next;
      break;
    }
  }
  assert(state.movesLeft === 49, "decrement");
}

function testAiRespectsFours() {
  const matrix = [
    [4, 4, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const dir = chooseBestMove(matrix, modeRules(getModeById("fours")), { timeMs: 20, depth: 2 });
  assert(dir === "left" || dir === "right" || dir === "up" || dir === "down", "legal dir");
  assert(typeof evaluate(matrix) === "number", "evaluate");
}

function testAiSmokeAllModes() {
  for (const m of MODES) {
    let state = createGame(modeRules(m), createRng(11));
    for (let i = 0; i < 8; i += 1) {
      const dir = chooseBestMove(toMatrix(state.grid), state.rules, { timeMs: 8, depth: 1 });
      if (!dir) break;
      const next = applyMove(state, dir, createRng(11 + i));
      if (!next.moved) break;
      state = next;
      if (state.over) break;
    }
    assert(state.score >= 0, `${m.id} ran`);
  }
}

function testCanMove() {
  const grid = createEmptyGrid(2);
  grid[0][0] = makeTile(2);
  grid[0][1] = makeTile(4);
  grid[1][0] = makeTile(8);
  grid[1][1] = makeTile(16);
  assert(!canMove(grid), "dead 2x2");
}

testMergeLeft();
testMatrixMove();
testNoMove();
testRngSpawn();
testApplyAndUndo();
testAllModesBoot();
testSprintMoves();
testAiRespectsFours();
testAiSmokeAllModes();
testCanMove();
console.log("All game tests passed");
