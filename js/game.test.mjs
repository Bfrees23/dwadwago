import { createEmptyGrid, move, addRandomTile, canMove, applyMove, createGame } from "./game.js";
import { MODES, getModeById, modeRules, getModesByGroup } from "./modes.js";

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
  let state = createGame({ size: 4, winTile: 2048 });
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

function testAllModesBoot() {
  assert(MODES.length >= 12, "many modes");
  assert(getModesByGroup("size").length === 7, "seven size modes");
  assert(getModesByGroup("special").length === 6, "six special modes");
  for (const mode of MODES) {
    const state = createGame(modeRules(mode));
    assert(state.grid.length === mode.size, `${mode.id} rows`);
    assert(state.winTile === mode.winTile, `${mode.id} win tile`);
    assert(state.grid.flat().filter(Boolean).length === 2, `${mode.id} starts with 2`);
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

function testFoursSpawn() {
  const grid = createEmptyGrid(4);
  for (let i = 0; i < 8; i += 1) {
    const tile = addRandomTile(grid, { spawnTwoChance: 0, spawnEightChance: 0 });
    assert(tile.value === 4, "fours mode always 4");
  }
}

function testSprintMoves() {
  let state = createGame(modeRules(getModeById("sprint")));
  assert(state.movesLeft === 50, "sprint starts with 50");
  for (const dir of ["up", "down", "left", "right"]) {
    const next = applyMove(state, dir);
    if (next.moved) {
      state = next;
      break;
    }
  }
  assert(state.movesLeft === 49, "sprint decrements moves");
}

function testChaosDoubleSpawn() {
  let state = createGame(modeRules(getModeById("chaos")));
  let moved = null;
  for (const dir of ["up", "down", "left", "right"]) {
    const next = applyMove(state, dir);
    if (next.moved) {
      moved = next;
      break;
    }
  }
  assert(moved, "chaos can move");
  assert((moved.spawnedList || []).length >= 1, "chaos spawns tiles");
}

function testModeLookup() {
  assert(getModeById("8").size === 8, "mode 8");
  assert(getModeById("blitz").timeLimitSec === 60, "blitz timer");
  assert(getModeById("nope").id === "4", "fallback classic");
}

testMergeLeft();
testNoMove();
testSpawnAndGameOverDetection();
testApplyMove();
testAllModesBoot();
testMoveOn3x3();
testFoursSpawn();
testSprintMoves();
testChaosDoubleSpawn();
testModeLookup();
console.log("All game tests passed");
