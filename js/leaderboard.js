const STORAGE_KEY = "dwadwago-2048-leaderboard";
const NAME_KEY = "dwadwago-2048-player";
const BEST_KEY = "dwadwago-2048-best";
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

export function getBestScore() {
  const value = Number(localStorage.getItem(BEST_KEY) || 0);
  return Number.isFinite(value) ? value : 0;
}

export function setBestScore(score) {
  const best = Math.max(getBestScore(), Number(score) || 0);
  localStorage.setItem(BEST_KEY, String(best));
  return best;
}

export function getLeaderboard() {
  const list = readJson(STORAGE_KEY, []);
  if (!Array.isArray(list)) return [];
  return list
    .filter((e) => e && typeof e.score === "number")
    .sort((a, b) => b.score - a.score || b.maxTile - a.maxTile)
    .slice(0, MAX_ENTRIES);
}

export function saveScore({ name, score, maxTile, auto }) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: (name || "Гость").trim().slice(0, 16) || "Гость",
    score: Number(score) || 0,
    maxTile: Number(maxTile) || 0,
    auto: Boolean(auto),
    at: new Date().toISOString(),
  };

  const list = getLeaderboard();
  list.push(entry);
  list.sort((a, b) => b.score - a.score || b.maxTile - a.maxTile);
  const next = list.slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  setBestScore(entry.score);
  return next;
}

export function clearLeaderboard() {
  localStorage.removeItem(STORAGE_KEY);
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
