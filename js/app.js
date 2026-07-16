import { createGame, applyMove, maxTile } from "./game.js";
import { chooseBestMove } from "./ai.js";
import {
  MODE_GROUPS,
  getModeById,
  getModesByGroup,
  getSavedModeId,
  saveModeId,
  modeRules,
  MODES,
} from "./modes.js";
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
import { fetchGitHubLeaderboard, buildScoreIssueUrl } from "./github-leaderboard.js";

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
const modePanels = document.getElementById("mode-panels");
const modeSelect = document.getElementById("mode-select");
const modeHint = document.getElementById("mode-hint");
const challengeStat = document.getElementById("challenge-stat");
const challengeLabel = document.getElementById("challenge-label");
const challengeValue = document.getElementById("challenge-value");
const lbDialog = document.getElementById("modal-leaderboard");
const howDialog = document.getElementById("modal-how");
const lbList = document.getElementById("leaderboard-list");
const lbEmpty = document.getElementById("leaderboard-empty");
const lbModeFilter = document.getElementById("lb-mode-filter");
const lbLead = document.getElementById("lb-lead");
const lbStatus = document.getElementById("lb-status");
const tabGithub = document.getElementById("tab-github");
const tabLocal = document.getElementById("tab-local");
const btnClearLb = document.getElementById("btn-clear-lb");

const SPEED_MS = { 1: 420, 2: 280, 3: 160, 4: 90, 5: 45 };
const SPEED_LABELS = {
  1: "медленно",
  2: "спокойно",
  3: "нормально",
  4: "быстро",
  5: "turbo",
};

let mode = getModeById(getSavedModeId());
let state = createGame(modeRules(mode));
let usedAuto = false;
let autoTimer = null;
let blitzTimer = null;
let blitzEndsAt = 0;
let touchStart = null;
let tileLayer = null;
let lbFilterMode = mode.id;
let lbTab = "github";
let githubCache = { updatedAt: null, entries: [] };

function currentSize() {
  return state?.size || mode.size;
}

function cellPosition(r, c) {
  const n = currentSize();
  const gap = n >= 7 ? 4 : n >= 6 ? 6 : 8;
  const pad = n >= 7 ? 8 : 10;
  const cell = (boardEl.clientWidth - pad * 2 - gap * (n - 1)) / n;
  return {
    x: pad + c * (cell + gap),
    y: pad + r * (cell + gap),
    cell,
  };
}

function ensureBoardScaffold() {
  const n = currentSize();
  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  boardEl.style.gridTemplateRows = `repeat(${n}, 1fr)`;
  boardEl.style.gap = n >= 7 ? "4px" : n >= 6 ? "6px" : "8px";
  boardEl.style.padding = n >= 7 ? "8px" : "10px";
  boardEl.dataset.size = String(n);
  boardEl.setAttribute("aria-label", `Поле ${n} на ${n}`);

  for (let i = 0; i < n * n; i += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    if (n >= 7) cell.classList.add("cell-tiny");
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

function renderTiles(spawnedList = null, mergedPositions = null) {
  if (!tileLayer) ensureBoardScaffold();
  tileLayer.innerHTML = "";
  const n = currentSize();
  const spawnKeys = new Set(
    (spawnedList || []).map((t) => `${t.r},${t.c}`),
  );

  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const value = state.grid[r][c];
      if (!value) continue;
      const { x, y, cell } = cellPosition(r, c);
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.v = String(Math.min(value, 65536));
      tile.textContent = String(value);
      tile.style.width = `${cell}px`;
      tile.style.height = `${cell}px`;
      tile.style.transform = `translate(${x}px, ${y}px)`;
      if (n >= 5) tile.classList.add("tile-compact");
      if (n >= 6) tile.classList.add("tile-tiny");
      if (n >= 8) tile.classList.add("tile-micro");

      if (spawnKeys.has(`${r},${c}`)) tile.classList.add("new");
      if (mergedPositions?.has(`${r},${c}`)) tile.classList.add("merge");

      tileLayer.appendChild(tile);
    }
  }
}

function updateChallengeUI() {
  const rules = modeRules(mode);
  if (rules.maxMoves != null) {
    challengeStat.classList.remove("hidden");
    challengeLabel.textContent = "Ходы";
    challengeValue.textContent = String(state.movesLeft ?? rules.maxMoves);
    return;
  }
  if (rules.timeLimitSec != null) {
    challengeStat.classList.remove("hidden");
    challengeLabel.textContent = "Таймер";
    const leftMs = Math.max(0, blitzEndsAt - Date.now());
    const sec = Math.ceil(leftMs / 1000);
    challengeValue.textContent = `${sec}с`;
    return;
  }
  challengeStat.classList.add("hidden");
}

function updateScore(delta = 0) {
  scoreEl.textContent = String(state.score);
  const best = setBestScore(state.score, mode.id);
  bestEl.textContent = String(best);
  updateChallengeUI();

  if (delta > 0) {
    scoreDeltaEl.textContent = `+${delta}`;
    scoreDeltaEl.classList.remove("show");
    void scoreDeltaEl.offsetWidth;
    scoreDeltaEl.classList.add("show");
  }
}

function showOverlay() {
  if (state.won && !state.over) {
    overlayTitleEl.textContent = `${mode.winTile}!`;
    overlayTextEl.textContent = `Счёт ${state.score}. Можно продолжать.`;
  } else if (state.reason === "moves") {
    overlayTitleEl.textContent = "Ходы закончились";
    overlayTextEl.textContent = `${mode.title} · счёт ${state.score} · макс. плитка ${maxTile(state.grid)}`;
  } else if (state.reason === "time") {
    overlayTitleEl.textContent = "Время вышло";
    overlayTextEl.textContent = `${mode.title} · счёт ${state.score} · макс. плитка ${maxTile(state.grid)}`;
  } else {
    overlayTitleEl.textContent = "Игра окончена";
    overlayTextEl.textContent = `${mode.title} · счёт ${state.score} · макс. плитка ${maxTile(state.grid)}`;
  }
  overlayEl.classList.remove("hidden");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function stopBlitzTimer() {
  if (blitzTimer) {
    clearInterval(blitzTimer);
    blitzTimer = null;
  }
}

function endBlitzByTime() {
  if (state.over) return;
  state = { ...state, over: true, reason: "time" };
  stopAuto();
  stopBlitzTimer();
  updateChallengeUI();
  showOverlay();
}

function startBlitzTimer() {
  stopBlitzTimer();
  const rules = modeRules(mode);
  if (rules.timeLimitSec == null) return;
  blitzEndsAt = Date.now() + rules.timeLimitSec * 1000;
  updateChallengeUI();
  blitzTimer = setInterval(() => {
    updateChallengeUI();
    if (Date.now() >= blitzEndsAt) endBlitzByTime();
  }, 200);
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
    state = { ...state, over: true, reason: "board" };
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
  if (state.over) return false;

  if (modeRules(mode).timeLimitSec != null && Date.now() >= blitzEndsAt) {
    endBlitzByTime();
    return false;
  }

  const next = applyMove(state, dir);
  if (!next.moved) return false;

  state = next;
  renderTiles(next.spawnedList || (next.spawned ? [next.spawned] : []), new Set(next.mergeCells || []));
  updateScore(next.scoreGained);

  if (state.over) {
    stopAuto();
    stopBlitzTimer();
    showOverlay();
  }

  return true;
}

function newGame() {
  stopAuto();
  stopBlitzTimer();
  state = createGame(modeRules(mode));
  usedAuto = false;
  hideOverlay();
  ensureBoardScaffold();
  renderTiles();
  updateScore(0);
  bestEl.textContent = String(getBestScore(mode.id));
  startBlitzTimer();
}

function boardSizeCss(size) {
  if (size >= 8) return "min(96vw, 520px)";
  if (size >= 7) return "min(95vw, 500px)";
  if (size >= 6) return "min(94vw, 460px)";
  if (size >= 5) return "min(93vw, 440px)";
  return "min(92vw, 420px)";
}

function syncModeUI() {
  if (modeSelect) modeSelect.value = mode.id;
  modePanels.querySelectorAll(".mode-btn").forEach((btn) => {
    const active = btn.dataset.mode === mode.id;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
  const extras = [];
  if (mode.maxMoves) extras.push(`${mode.maxMoves} ходов`);
  if (mode.timeLimitSec) extras.push(`${mode.timeLimitSec} сек`);
  if (mode.spawnPerMove > 1) extras.push("двойной спавн");
  if (mode.spawnTwoChance === 0) extras.push("только 4");
  const extraText = extras.length ? ` · ${extras.join(", ")}` : "";
  modeHint.textContent = `${mode.title}: ${mode.desc}. Цель — ${mode.winTile}.${extraText}`;
  document.documentElement.style.setProperty("--board-size", boardSizeCss(mode.size));
  updateChallengeUI();
}

function setMode(modeId, { restart = true } = {}) {
  mode = saveModeId(modeId);
  lbFilterMode = mode.id;
  if (lbModeFilter) lbModeFilter.value = mode.id;
  syncModeUI();
  if (restart) newGame();
}

function renderModeSelect() {
  modeSelect.innerHTML = "";
  for (const group of MODE_GROUPS) {
    const og = document.createElement("optgroup");
    og.label = group.title;
    for (const m of getModesByGroup(group.id)) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.title} — ${m.label}`;
      og.appendChild(opt);
    }
    modeSelect.appendChild(og);
  }
  modeSelect.value = mode.id;
}

function renderModePanels() {
  modePanels.innerHTML = "";
  for (const group of MODE_GROUPS) {
    const wrap = document.createElement("div");
    wrap.className = "mode-group";

    const caption = document.createElement("p");
    caption.className = "mode-caption";
    caption.textContent = group.title;
    wrap.appendChild(caption);

    const switchEl = document.createElement("div");
    switchEl.className = `mode-switch mode-switch-${group.id}`;
    switchEl.setAttribute("role", "group");
    switchEl.setAttribute("aria-label", group.title);

    for (const m of getModesByGroup(group.id)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mode-btn";
      btn.dataset.mode = m.id;
      btn.setAttribute("aria-pressed", "false");
      btn.title = m.desc;
      btn.innerHTML = `<span class="mode-label">${m.label}</span><span class="mode-title">${m.title}</span>`;
      btn.addEventListener("click", () => {
        if (m.id === mode.id) {
          newGame();
          return;
        }
        setMode(m.id);
      });
      switchEl.appendChild(btn);
    }

    wrap.appendChild(switchEl);
    modePanels.appendChild(wrap);
  }
  syncModeUI();
}

function setLbTab(tab) {
  lbTab = tab;
  tabGithub.classList.toggle("is-active", tab === "github");
  tabLocal.classList.toggle("is-active", tab === "local");
  tabGithub.setAttribute("aria-selected", String(tab === "github"));
  tabLocal.setAttribute("aria-selected", String(tab === "local"));
  btnClearLb.classList.toggle("hidden", tab !== "local");
  if (tab === "github") {
    lbLead.textContent = "Общий рейтинг в репозитории GitHub (`data/leaderboard.json`). Отправка — через Issue, запись делает Action.";
  } else {
    lbLead.textContent = "Локальный топ только на этом устройстве (localStorage), доступен офлайн.";
  }
  renderLeaderboard();
}

function paintLeaderboard(list) {
  lbList.innerHTML = "";
  lbEmpty.classList.toggle("hidden", list.length > 0);

  list.forEach((entry, index) => {
    const li = document.createElement("li");
    const modeText = entry.modeLabel || `${entry.modeId || 4}`;
    const who = entry.githubUser ? ` @${entry.githubUser}` : "";
    li.innerHTML = `
      <span class="lb-rank">${index + 1}</span>
      <span class="lb-name">${escapeHtml(entry.name)}${escapeHtml(who)}${entry.auto ? " · авто" : ""} · ${escapeHtml(modeText)}</span>
      <span class="lb-meta">
        <span class="lb-score">${entry.score}</span>
        плитка ${entry.maxTile} · ${formatDate(entry.at)}
      </span>
    `;
    lbList.appendChild(li);
  });
}

async function renderLeaderboard() {
  const filter = lbModeFilter?.value || "all";
  lbStatus.textContent = lbTab === "github" ? "Загрузка с GitHub…" : "";

  if (lbTab === "local") {
    const list = filter === "all" ? getLeaderboard(null) : getLeaderboard(filter);
    paintLeaderboard(list);
    lbStatus.textContent = list.length ? `${list.length} локальных результатов` : "";
    return;
  }

  try {
    const board = await fetchGitHubLeaderboard(filter === "all" ? null : filter);
    githubCache = board;
    paintLeaderboard(board.entries);
    if (!board.entries.length) {
      lbStatus.textContent = "Пока нет общих результатов — отправь свой через «В GitHub».";
    } else {
      const when = board.updatedAt ? ` · обновлён ${formatDate(board.updatedAt)}` : "";
      lbStatus.textContent = `${board.entries.length} в общем рейтинге${when}`;
    }
  } catch {
    paintLeaderboard([]);
    lbStatus.textContent = "Не удалось загрузить рейтинг GitHub. Проверь сеть или открой позже.";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function currentEntry() {
  const name = setPlayerName(playerInput.value);
  playerInput.value = name;
  return {
    name,
    score: state.score,
    maxTile: maxTile(state.grid),
    auto: usedAuto,
    modeId: mode.id,
    modeLabel: `${mode.title} (${mode.label})`,
    at: new Date().toISOString(),
  };
}

function saveCurrentScore() {
  saveScore(currentEntry());
  lbFilterMode = mode.id;
  if (lbModeFilter) lbModeFilter.value = mode.id;
  setLbTab("local");
  lbDialog.showModal();
}

function saveScoreToGitHub() {
  const entry = currentEntry();
  saveScore(entry); // also keep a local copy
  const url = buildScoreIssueUrl(entry);
  window.open(url, "_blank", "noopener,noreferrer");
  lbStatus.textContent = "Открой Issue на GitHub и нажми Submit — бот запишет счёт в рейтинг.";
  setLbTab("github");
  lbDialog.showModal();
}

function populateLbFilter() {
  lbModeFilter.innerHTML = `<option value="all">Все режимы</option>`;
  for (const group of MODE_GROUPS) {
    for (const m of getModesByGroup(group.id)) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.title} · ${m.label}`;
      lbModeFilter.appendChild(opt);
    }
  }
  lbModeFilter.value = lbFilterMode === "all" || MODES.some((m) => m.id === lbFilterMode)
    ? lbFilterMode
    : "all";
}

function bindEvents() {
  document.getElementById("btn-new").addEventListener("click", newGame);
  document.getElementById("btn-restart").addEventListener("click", newGame);
  document.getElementById("btn-save-score").addEventListener("click", saveCurrentScore);
  document.getElementById("btn-save-github").addEventListener("click", saveScoreToGitHub);
  document.getElementById("btn-auto").addEventListener("click", toggleAuto);
  document.getElementById("btn-leaderboard").addEventListener("click", () => {
    populateLbFilter();
    setLbTab(lbTab);
    lbDialog.showModal();
  });
  document.getElementById("btn-how").addEventListener("click", () => howDialog.showModal());
  document.getElementById("btn-refresh-lb").addEventListener("click", () => renderLeaderboard());
  btnClearLb.addEventListener("click", () => {
    if (lbTab !== "local") return;
    const filter = lbModeFilter.value;
    clearLeaderboard(filter === "all" ? null : filter);
    renderLeaderboard();
  });

  tabGithub.addEventListener("click", () => setLbTab("github"));
  tabLocal.addEventListener("click", () => setLbTab("local"));

  modeSelect.addEventListener("change", () => setMode(modeSelect.value));

  lbModeFilter.addEventListener("change", () => {
    lbFilterMode = lbModeFilter.value;
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
    if (event.target.matches("input, textarea, select, button")) return;
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
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (modeRules(mode).timeLimitSec != null && !state.over && Date.now() >= blitzEndsAt) {
      endBlitzByTime();
    }
  });
}

function init() {
  renderModeSelect();
  renderModePanels();
  populateLbFilter();
  setLbTab("github");
  autoSpeedLabel.textContent = SPEED_LABELS[autoSpeed.value];
  bindEvents();
  newGame();
}

init();
