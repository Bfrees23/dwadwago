const STORAGE_KEY = "dwadwago-2048-leaderboard";
const NAME_KEY = "dwadwago-2048-player";
const BEST_KEY = "dwadwago-2048-best-by-mode";
const LEGACY_BEST_KEY = "dwadwago-2048-best";
const MAX_ENTRIES = 15;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function getPlayerName() {
  return localStorage.getItem(NAME_KEY) || "";
}

export function setPlayerName(name) {
  const cleaned = String(name || "").trim().slice(0, 16);
  if (cleaned) localStorage.setItem(NAME_KEY, cleaned);
  else localStorage.removeItem(NAME_KEY);
  return cleaned;
}

function readBestMap() {
  const map = readJson(BEST_KEY, null);
  if (map && typeof map === "object") return map;

  // migrate legacy single best into classic 4×4
  const legacy = Number(localStorage.getItem(LEGACY_BEST_KEY) || 0);
  if (Number.isFinite(legacy) && legacy > 0) {
    const migrated = { 4: legacy };
    localStorage.setItem(BEST_KEY, JSON.stringify(migrated));
    return migrated;
  }
  return {};
}

export function getBestScore(modeId = "4") {
  const map = readBestMap();
  const value = Number(map[String(modeId)] || 0);
  return Number.isFinite(value) ? value : 0;
}

export function setBestScore(score, modeId = "4") {
  const map = readBestMap();
  const key = String(modeId);
  const best = Math.max(Number(map[key] || 0), Number(score) || 0);
  map[key] = best;
  localStorage.setItem(BEST_KEY, JSON.stringify(map));
  return best;
}

export function getLeaderboard(modeId = null) {
  const list = readJson(STORAGE_KEY, []);
  if (!Array.isArray(list)) return [];
  return list
    .filter((e) => e && typeof e.score === "number")
    .filter((e) => (modeId == null ? true : String(e.modeId || "4") === String(modeId)))
    .sort((a, b) => b.score - a.score || b.maxTile - a.maxTile)
    .slice(0, MAX_ENTRIES);
}

export function saveScore({ name, score, maxTile, auto, modeId = "4", modeLabel = "4×4" }) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: (name || "Гость").trim().slice(0, 16) || "Гость",
    score: Number(score) || 0,
    maxTile: Number(maxTile) || 0,
    auto: Boolean(auto),
    modeId: String(modeId),
    modeLabel: String(modeLabel),
    at: new Date().toISOString(),
  };

  const all = readJson(STORAGE_KEY, []);
  const list = Array.isArray(all) ? all : [];
  list.push(entry);

  // keep top scores overall, but prefer retaining mode diversity
  list.sort((a, b) => b.score - a.score || b.maxTile - a.maxTile);
  const next = list.slice(0, 60);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  setBestScore(entry.score, entry.modeId);
  return getLeaderboard(entry.modeId);
}

export function clearLeaderboard(modeId = null) {
  if (modeId == null) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const all = readJson(STORAGE_KEY, []);
  const list = Array.isArray(all) ? all : [];
  const next = list.filter((e) => String(e.modeId || "4") !== String(modeId));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearBestScores() {
  localStorage.removeItem(BEST_KEY);
  localStorage.removeItem(LEGACY_BEST_KEY);
}

export function clearAllLocalData() {
  clearLeaderboard(null);
  clearBestScores();
  localStorage.removeItem(NAME_KEY);
}

export function formatDate(iso) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}
