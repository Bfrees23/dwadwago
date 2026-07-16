import { SIZE, createGame, applyMove, maxTile } from "./game.js";
import { chooseBestMove } from "./ai.js";
import {
  getPlayerName,
  setPlayerName,
  getBestScore,
  setBestScore,
  getLeaderboard,
  saveScore,
  clearLeaderboard,
  formatDate,
} from "./leaderboard.js";

const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const scoreDeltaEl = document.getElementById("score-delta");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlay-title");
const overlayTextEl = document.getElementById("overlay-text");
const playerInput = document.getElementById("player-name");
const btnAuto = document.getElementById("btn-auto");
const autoBar = document.getElementById("auto-bar");
const autoSpeed = document.getElementById("auto-speed");
const autoSpeedLabel = document.getElementById("auto-speed-label");
const lbDialog = document.getElementById("modal-leaderboard");
const howDialog = document.getElementById("modal-how");
const lbList = document.getElementById("leaderboard-list");
const lbEmpty = document.getElementById("leaderboard-empty");

const SPEED_MS = { 1: 420, 2: 280, 3: 160, 4: 90, 5: 45 };
const SPEED_LABELS = {
  1: "медленно",
  2: "спокойно",
  3: "нормально",
  4: "быстро",
  5: "turbo",
};

let state = createGame();
let usedAuto = false;
let autoTimer = null;
let touchStart = null;
let tileLayer = null;

function cellPosition(r, c) {
  const gap = 8;
  const pad = 10;
  const cell = (boardEl.clientWidth - pad * 2 - gap * 3) / 4;
  return {
    x: pad + c * (cell + gap),
    y: pad + r * (cell + gap),
    cell,
  };
}

function ensureBoardScaffold() {
  boardEl.innerHTML = "";
  for (let i = 0; i < SIZE * SIZE; i += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.setAttribute("role", "gridcell");
    boardEl.appendChild(cell);
  }
  tileLayer = document.createElement("div");
  tileLayer.style.position = "absolute";
  tileLayer.style.inset = "0";
  tileLayer.style.pointerEvents = "none";
  boardEl.style.position = "relative";
  boardEl.appendChild(tileLayer);
}

function renderTiles(spawned = null, mergedPositions = null) {
  if (!tileLayer) ensureBoardScaffold();
  tileLayer.innerHTML = "";

  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const value = state.grid[r][c];
      if (!value) continue;
      const { x, y, cell } = cellPosition(r, c);
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.v = String(value);
      tile.textContent = String(value);
      tile.style.width = `${cell}px`;
      tile.style.height = `${cell}px`;
      tile.style.transform = `translate(${x}px, ${y}px)`;

      if (spawned && spawned.r === r && spawned.c === c) tile.classList.add("new");
      if (mergedPositions?.has(`${r},${c}`)) tile.classList.add("merge");

      tileLayer.appendChild(tile);
    }
  }
}

function updateScore(delta = 0) {
  scoreEl.textContent = String(state.score);
  const best = setBestScore(state.score);
  bestEl.textContent = String(best);

  if (delta > 0) {
    scoreDeltaEl.textContent = `+${delta}`;
    scoreDeltaEl.classList.remove("show");
    void scoreDeltaEl.offsetWidth;
    scoreDeltaEl.classList.add("show");
  }
}

function showOverlay() {
  if (state.won && !state.over) {
    overlayTitleEl.textContent = "2048!";
    overlayTextEl.textContent = `Счёт ${state.score}. Можно продолжать.`;
  } else {
    overlayTitleEl.textContent = "Игра окончена";
    overlayTextEl.textContent = `Счёт ${state.score} · макс. плитка ${maxTile(state.grid)}`;
  }
  overlayEl.classList.remove("hidden");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function stopAuto() {
  if (autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
  btnAuto.setAttribute("aria-pressed", "false");
  btnAuto.textContent = "Авторежим";
  autoBar.classList.add("hidden");
}

function scheduleAuto() {
  if (btnAuto.getAttribute("aria-pressed") !== "true") return;
  stopAutoPendingOnly();
  const delay = SPEED_MS[autoSpeed.value] || 160;
  autoTimer = setTimeout(runAutoStep, delay);
}

function stopAutoPendingOnly() {
  if (autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
}

function runAutoStep() {
  if (state.over) {
    stopAuto();
    showOverlay();
    return;
  }

  const dir = chooseBestMove(state.grid);
  if (!dir) {
    state.over = true;
    stopAuto();
    showOverlay();
    return;
  }

  usedAuto = true;
  doMove(dir, { fromAuto: true });
  if (btnAuto.getAttribute("aria-pressed") === "true" && !state.over) {
    scheduleAuto();
  }
}

function startAuto() {
  usedAuto = true;
  btnAuto.setAttribute("aria-pressed", "true");
  btnAuto.textContent = "Стоп авто";
  autoBar.classList.remove("hidden");
  hideOverlay();
  scheduleAuto();
}

function toggleAuto() {
  if (btnAuto.getAttribute("aria-pressed") === "true") stopAuto();
  else startAuto();
}

function doMove(dir, { fromAuto = false } = {}) {
  if (!fromAuto && btnAuto.getAttribute("aria-pressed") === "true") stopAuto();

  const next = applyMove(state, dir);
  if (!next.moved) return false;

  state = next;
  renderTiles(next.spawned, new Set(next.mergeCells || []));
  updateScore(next.scoreGained);

  if (state.over) {
    stopAuto();
    showOverlay();
  }

  return true;
}

function newGame() {
  stopAuto();
  state = createGame();
  usedAuto = false;
  hideOverlay();
  renderTiles();
  updateScore(0);
}

function renderLeaderboard() {
  const list = getLeaderboard();
  lbList.innerHTML = "";
  lbEmpty.classList.toggle("hidden", list.length > 0);

  list.forEach((entry, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="lb-rank">${index + 1}</span>
      <span class="lb-name">${escapeHtml(entry.name)}${entry.auto ? " · авто" : ""}</span>
      <span class="lb-meta">
        <span class="lb-score">${entry.score}</span>
        плитка ${entry.maxTile} · ${formatDate(entry.at)}
      </span>
    `;
    lbList.appendChild(li);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function saveCurrentScore() {
  const name = setPlayerName(playerInput.value);
  playerInput.value = name;
  saveScore({
    name,
    score: state.score,
    maxTile: maxTile(state.grid),
    auto: usedAuto,
  });
  renderLeaderboard();
  lbDialog.showModal();
}

function bindEvents() {
  document.getElementById("btn-new").addEventListener("click", newGame);
  document.getElementById("btn-restart").addEventListener("click", newGame);
  document.getElementById("btn-save-score").addEventListener("click", saveCurrentScore);
  document.getElementById("btn-auto").addEventListener("click", toggleAuto);
  document.getElementById("btn-leaderboard").addEventListener("click", () => {
    renderLeaderboard();
    lbDialog.showModal();
  });
  document.getElementById("btn-how").addEventListener("click", () => howDialog.showModal());
  document.getElementById("btn-clear-lb").addEventListener("click", () => {
    clearLeaderboard();
    renderLeaderboard();
  });

  playerInput.value = getPlayerName();
  playerInput.addEventListener("change", () => {
    playerInput.value = setPlayerName(playerInput.value);
  });

  autoSpeed.addEventListener("input", () => {
    autoSpeedLabel.textContent = SPEED_LABELS[autoSpeed.value] || "нормально";
    if (btnAuto.getAttribute("aria-pressed") === "true") scheduleAuto();
  });

  document.querySelectorAll(".pad-btn").forEach((btn) => {
    btn.addEventListener("click", () => doMove(btn.dataset.dir));
  });

  window.addEventListener("keydown", (event) => {
    const map = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      W: "up",
      s: "down",
      S: "down",
      a: "left",
      A: "left",
      d: "right",
      D: "right",
    };
    const dir = map[event.key];
    if (!dir) return;
    if (event.target.matches("input, textarea")) return;
    event.preventDefault();
    doMove(dir);
  });

  boardEl.addEventListener("touchstart", (event) => {
    const t = event.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });

  boardEl.addEventListener("touchend", (event) => {
    if (!touchStart) return;
    const t = event.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? "right" : "left");
    else doMove(dy > 0 ? "down" : "up");
  }, { passive: true });

  window.addEventListener("resize", () => renderTiles());
}

function init() {
  ensureBoardScaffold();
  bestEl.textContent = String(getBestScore());
  autoSpeedLabel.textContent = SPEED_LABELS[autoSpeed.value];
  bindEvents();
  newGame();
}

init();
