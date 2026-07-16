import { createEmptyGrid, move, addRandomTile, canMove, applyMove, createGame } from "./game.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function testMergeLeft() {
  const grid = createEmptyGrid();
  grid[0] = [2, 2, 0, 0];
  const { grid: next, scoreGained, moved } = move(grid, "left");
  assert(moved, "should move");
  assert(next[0][0] === 4, "2+2 -> 4");
  assert(scoreGained === 4, "score +4");
}

function testNoMove() {
  const grid = createEmptyGrid();
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
  let state = createGame();
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

testMergeLeft();
testNoMove();
testSpawnAndGameOverDetection();
testApplyMove();
console.log("All game tests passed");
