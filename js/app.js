import {
  createGame,
  applyMove,
  undoMove,
  maxTile,
  toMatrix,
  markWonShown,
  endByTime,
} from "./game.js";
import { createAutoBrain } from "./ai.js";
import { createBoardView } from "./board-view.js";
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
const overlayActions = document.getElementById("overlay-actions");
const playerInput = document.getElementById("player-name");
const btnAuto = document.getElementById("btn-auto");
const btnUndo = document.getElementById("btn-undo");
const autoBar = document.getElementById("auto-bar");
const autoSpeed = document.getElementById("auto-speed");
const autoSpeedLabel = document.getElementById("auto-speed-label");
const autoStrength = document.getElementById("auto-strength");
const autoStrengthLabel = document.getElementById("auto-strength-label");
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

const SPEED_MS = { 1: 420, 2: 280, 3: 160, 4: 90, 5: 40 };
const SPEED_LABELS = { 1: "медленно", 2: "спокойно", 3: "нормально", 4: "быстро", 5: "turbo" };
const STRENGTH_MS = { 1: 12, 2: 28, 3: 45, 4: 70, 5: 110 };
const STRENGTH_LABELS = { 1: "лёгкий", 2: "средне", 3: "умный", 4: "сильный", 5: "мастер" };

const boardView = createBoardView(boardEl);
const brain = createAutoBrain();

let mode = getModeById(getSavedModeId());
let state = createGame(modeRules(mode));
let usedAuto = false;
let autoOn = false;
let autoTimer = null;
let autoBusy = false;
let blitzTimer = null;
let blitzEndsAt = 0;
let touchStart = null;
let lbFilterMode = mode.id;
let lbTab = "github";
let inputLocked = false;

function boardSizeCss(size) {
  if (size >= 8) return "min(96vw, 520px)";
  if (size >= 7) return "min(95vw, 500px)";
  if (size >= 6) return "min(94vw, 460px)";
  if (size >= 5) return "min(93vw, 440px)";
  return "min(92vw, 420px)";
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
    const sec = Math.max(0, Math.ceil((blitzEndsAt - Date.now()) / 1000));
    challengeValue.textContent = `${sec}с`;
    return;
  }
  challengeStat.classList.add("hidden");
}

function updateScore(delta = 0) {
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(setBestScore(state.score, mode.id));
  updateChallengeUI();
  if (btnUndo) btnUndo.disabled = !(state.history && state.history.length);

  if (delta > 0) {
    scoreDeltaEl.textContent = `+${delta}`;
    scoreDeltaEl.classList.remove("show");
    void scoreDeltaEl.offsetWidth;
    scoreDeltaEl.classList.add("show");
  }
}

function setOverlayActions(kind) {
  // kind: over | win
  overlayActions.innerHTML = "";
  if (kind === "win") {
    overlayActions.innerHTML = `
      <button type="button" class="btn btn-primary" id="btn-continue">Продолжить</button>
      <button type="button" class="btn btn-ghost" id="btn-restart">Заново</button>
    `;
    document.getElementById("btn-continue").onclick = () => {
      state = markWonShown(state);
      hideOverlay();
    };
    document.getElementById("btn-restart").onclick = () => newGame();
    return;
  }

  overlayActions.innerHTML = `
    <button type="button" class="btn btn-primary" id="btn-restart">Сыграть ещё</button>
    <button type="button" class="btn btn-ghost" id="btn-save-score">В локальный</button>
    <button type="button" class="btn btn-accent" id="btn-save-github">В GitHub</button>
  `;
  document.getElementById("btn-restart").onclick = () => newGame();
  document.getElementById("btn-save-score").onclick = () => saveCurrentScore();
  document.getElementById("btn-save-github").onclick = () => saveScoreToGitHub();
}

function showOverlay(kind) {
  if (kind === "win") {
    overlayTitleEl.textContent = `${mode.winTile}!`;
    overlayTextEl.textContent = `Счёт ${state.score}. Можно играть дальше.`;
    setOverlayActions("win");
  } else if (state.reason === "moves") {
    overlayTitleEl.textContent = "Ходы закончились";
    overlayTextEl.textContent = `${mode.title} · счёт ${state.score} · макс. ${maxTile(state.grid)}`;
    setOverlayActions("over");
  } else if (state.reason === "time") {
    overlayTitleEl.textContent = "Время вышло";
    overlayTextEl.textContent = `${mode.title} · счёт ${state.score} · макс. ${maxTile(state.grid)}`;
    setOverlayActions("over");
  } else {
    overlayTitleEl.textContent = "Игра окончена";
    overlayTextEl.textContent = `${mode.title} · счёт ${state.score} · макс. ${maxTile(state.grid)}`;
    setOverlayActions("over");
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
  state = endByTime(state);
  stopAuto();
  stopBlitzTimer();
  updateChallengeUI();
  boardView.render(state.grid, { animate: false });
  showOverlay("over");
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

function stopAutoPending() {
  if (autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
}

function stopAuto() {
  stopAutoPending();
  autoOn = false;
  autoBusy = false;
  btnAuto.setAttribute("aria-pressed", "false");
  btnAuto.textContent = "Авторежим";
  autoBar.classList.add("hidden");
}

function scheduleAuto() {
  if (!autoOn) return;
  stopAutoPending();
  const delay = SPEED_MS[autoSpeed.value] || 160;
  autoTimer = setTimeout(runAutoStep, delay);
}

async function runAutoStep() {
  if (!autoOn || state.over || autoBusy) return;
  autoBusy = true;
  try {
    const timeMs = STRENGTH_MS[autoStrength?.value || 3] || 45;
    const dir = await brain.choose(toMatrix(state.grid), state.rules, { timeMs });
    if (!autoOn) return;
    if (!dir) {
      state = { ...state, over: true, reason: "board" };
      stopAuto();
      showOverlay("over");
      return;
    }
    usedAuto = true;
    await doMove(dir, { fromAuto: true });
  } finally {
    autoBusy = false;
  }
  if (autoOn && !state.over) scheduleAuto();
}

function startAuto() {
  usedAuto = true;
  autoOn = true;
  btnAuto.setAttribute("aria-pressed", "true");
  btnAuto.textContent = "Стоп авто";
  autoBar.classList.remove("hidden");
  hideOverlay();
  scheduleAuto();
}

function toggleAuto() {
  if (autoOn) stopAuto();
  else startAuto();
}

async function doMove(dir, { fromAuto = false } = {}) {
  if (inputLocked && !fromAuto) return false;
  if (!fromAuto && autoOn) stopAuto();
  if (state.over) return false;

  if (modeRules(mode).timeLimitSec != null && Date.now() >= blitzEndsAt) {
    endBlitzByTime();
    return false;
  }

  inputLocked = true;
  const next = applyMove(state, dir);
  if (!next.moved) {
    inputLocked = false;
    return false;
  }

  state = next;
  boardView.render(state.grid, { animate: true });
  updateScore(next.scoreGained);

  if (state.justWon && !state.wonShown) {
    stopAuto();
    showOverlay("win");
    inputLocked = false;
    return true;
  }

  if (state.over) {
    stopAuto();
    stopBlitzTimer();
    showOverlay("over");
  }

  // unlock after slide animation
  setTimeout(() => {
    inputLocked = false;
  }, 130);

  return true;
}

function doUndo() {
  if (autoOn) stopAuto();
  if (!state.history?.length) return;
  state = undoMove(state);
  boardView.render(state.grid, { animate: false });
  updateScore(0);
  hideOverlay();
}

function newGame() {
  stopAuto();
  stopBlitzTimer();
  state = createGame(modeRules(mode));
  usedAuto = false;
  inputLocked = false;
  hideOverlay();
  document.documentElement.style.setProperty("--board-size", boardSizeCss(mode.size));
  boardView.ensureScaffold(mode.size);
  boardView.render(state.grid, { animate: true });
  updateScore(0);
  bestEl.textContent = String(getBestScore(mode.id));
  startBlitzTimer();
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
  modeHint.textContent = `${mode.title}: ${mode.desc}. Цель — ${mode.winTile}.${extras.length ? ` · ${extras.join(", ")}` : ""}`;
  document.documentElement.style.setProperty("--board-size", boardSizeCss(mode.size));
  updateChallengeUI();
}

function setMode(modeId) {
  mode = saveModeId(modeId);
  lbFilterMode = mode.id;
  if (lbModeFilter) lbModeFilter.value = mode.id;
  syncModeUI();
  newGame();
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

    for (const m of getModesByGroup(group.id)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mode-btn";
      btn.dataset.mode = m.id;
      btn.title = m.desc;
      btn.innerHTML = `<span class="mode-label">${m.label}</span><span class="mode-title">${m.title}</span>`;
      btn.addEventListener("click", () => {
        if (m.id === mode.id) newGame();
        else setMode(m.id);
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
  lbLead.textContent = tab === "github"
    ? "Общий рейтинг в репозитории GitHub (`data/leaderboard.json`). Отправка — через Issue, запись делает Action."
    : "Локальный топ только на этом устройстве (localStorage), доступен офлайн.";
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
    paintLeaderboard(board.entries);
    lbStatus.textContent = board.entries.length
      ? `${board.entries.length} в общем рейтинге${board.updatedAt ? ` · ${formatDate(board.updatedAt)}` : ""}`
      : "Пока нет общих результатов — отправь свой через «В GitHub».";
  } catch {
    paintLeaderboard([]);
    lbStatus.textContent = "Не удалось загрузить рейтинг GitHub.";
  }
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
  saveScore(entry);
  window.open(buildScoreIssueUrl(entry), "_blank", "noopener,noreferrer");
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
  document.getElementById("btn-auto").addEventListener("click", toggleAuto);
  if (btnUndo) btnUndo.addEventListener("click", doUndo);

  document.getElementById("btn-leaderboard").addEventListener("click", () => {
    populateLbFilter();
    setLbTab(lbTab);
    lbDialog.showModal();
  });
  document.getElementById("btn-how").addEventListener("click", () => howDialog.showModal());
  document.getElementById("btn-refresh-lb").addEventListener("click", () => renderLeaderboard());
  btnClearLb.addEventListener("click", () => {
    if (lbTab !== "local") return;
    clearLeaderboard(lbModeFilter.value === "all" ? null : lbModeFilter.value);
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
    if (autoOn) scheduleAuto();
  });
  if (autoStrength) {
    autoStrength.addEventListener("input", () => {
      autoStrengthLabel.textContent = STRENGTH_LABELS[autoStrength.value] || "умный";
    });
  }

  document.querySelectorAll(".pad-btn").forEach((btn) => {
    btn.addEventListener("click", () => doMove(btn.dataset.dir));
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "z" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      doUndo();
      return;
    }
    const map = {
      ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
      w: "up", W: "up", s: "down", S: "down", a: "left", A: "left", d: "right", D: "right",
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

  window.addEventListener("resize", () => boardView.resize(state.grid));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (modeRules(mode).timeLimitSec != null && !state.over && Date.now() >= blitzEndsAt) {
      endBlitzByTime();
    }
  });
}

function init() {
  // ensure overlay actions container id
  if (!overlayActions.id) overlayActions.id = "overlay-actions";
  renderModeSelect();
  renderModePanels();
  populateLbFilter();
  setLbTab("github");
  autoSpeedLabel.textContent = SPEED_LABELS[autoSpeed.value];
  if (autoStrengthLabel) autoStrengthLabel.textContent = STRENGTH_LABELS[autoStrength.value];
  bindEvents();
  newGame();
}

init();
