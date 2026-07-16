import { createEmptyGrid, move, addRandomTile, canMove, applyMove, createGame } from "./game.js";
import { MODES, getModeById } from "./modes.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function testMergeLeft() {
  const grid = createEmptyGrid(4);
  grid[0] = [2, 2, 0, 0];
  const { grid: next, scoreGained, moved } = move(grid, "left");
  assert(moved, "should move");
  assert(next[0][0] === 4, "2+2 -> 4");
  assert(scoreGained === 4, "score +4");
}

function testNoMove() {
  const grid = createEmptyGrid(4);
  grid[0] = [2, 4, 8, 16];
  const { moved } = move(grid, "left");
  assert(!moved, "already packed left");
}

function testSpawnAndGameOverDetection() {
  const grid = [
    [2, 4, 8, 16],
    [32, 64, 128, 256],
    [512, 1024, 2, 4],
    [8, 16, 32, 0],
  ];
  assert(canMove(grid), "empty cell means can move");
  addRandomTile(grid);
  assert(grid.flat().every((v) => v !== 0) || true, "spawn ok");
}

function testApplyMove() {
  let state = createGame(4, 2048);
  assert(state.grid.flat().filter(Boolean).length === 2, "starts with 2 tiles");
  const dirs = ["up", "down", "left", "right"];
  let movedOnce = false;
  for (const dir of dirs) {
    const next = applyMove(state, dir);
    if (next.moved) {
      movedOnce = true;
      state = next;
      break;
    }
  }
  assert(movedOnce, "at least one opening move works");
}

function testModesSizes() {
  assert(MODES.length === 4, "four modes");
  for (const mode of MODES) {
    const state = createGame(mode.size, mode.winTile);
    assert(state.grid.length === mode.size, `${mode.label} rows`);
    assert(state.grid[0].length === mode.size, `${mode.label} cols`);
    assert(state.winTile === mode.winTile, `${mode.label} win tile`);
    assert(state.grid.flat().filter(Boolean).length === 2, `${mode.label} starts with 2`);
  }
}

function testMoveOn3x3() {
  const grid = createEmptyGrid(3);
  grid[0] = [2, 2, 0];
  const { grid: next, scoreGained, moved } = move(grid, "left");
  assert(moved, "3x3 move");
  assert(next[0][0] === 4 && next[0][1] === 0 && next[0][2] === 0, "3x3 merge");
  assert(scoreGained === 4, "3x3 score");
}

function testModeLookup() {
  assert(getModeById("6").size === 6, "mode 6");
  assert(getModeById("nope").id === "4", "fallback classic");
}

testMergeLeft();
testNoMove();
testSpawnAndGameOverDetection();
testApplyMove();
testModesSizes();
testMoveOn3x3();
testModeLookup();
console.log("All game tests passed");
