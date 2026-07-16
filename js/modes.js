export const MODES = [
  {
    id: "2",
    size: 2,
    label: "2×2",
    title: "Мини",
    desc: "Крошечное поле — почти пазл",
    winTile: 128,
    group: "size",
  },
  {
    id: "3",
    size: 3,
    label: "3×3",
    title: "Хардкор",
    desc: "Маленькое поле, меньше места для манёвра",
    winTile: 1024,
    group: "size",
  },
  {
    id: "4",
    size: 4,
    label: "4×4",
    title: "Классика",
    desc: "Оригинальный 2048",
    winTile: 2048,
    group: "size",
  },
  {
    id: "5",
    size: 5,
    label: "5×5",
    title: "Простор",
    desc: "Больше клеток и длинные комбинации",
    winTile: 2048,
    group: "size",
  },
  {
    id: "6",
    size: 6,
    label: "6×6",
    title: "Марафон",
    desc: "Большое поле для долгих партий",
    winTile: 4096,
    group: "size",
  },
  {
    id: "7",
    size: 7,
    label: "7×7",
    title: "Гигант",
    desc: "Огромное поле и высокий потолок",
    winTile: 4096,
    group: "size",
  },
  {
    id: "8",
    size: 8,
    label: "8×8",
    title: "Эпос",
    desc: "Максимальный размер — играй часами",
    winTile: 8192,
    group: "size",
  },
  {
    id: "fours",
    size: 4,
    label: "×4",
    title: "Четвёрки",
    desc: "Всегда появляются только плитки 4",
    winTile: 2048,
    group: "special",
    spawnTwoChance: 0,
  },
  {
    id: "chaos",
    size: 4,
    label: "??",
    title: "Хаос",
    desc: "Чаще четвёрки и по две плитки за ход",
    winTile: 2048,
    group: "special",
    spawnTwoChance: 0.45,
    spawnPerMove: 2,
  },
  {
    id: "joker",
    size: 4,
    label: "8+",
    title: "Джокер",
    desc: "Иногда выпадает сразу 8",
    winTile: 2048,
    group: "special",
    spawnTwoChance: 0.85,
    spawnEightChance: 0.12,
  },
  {
    id: "sprint",
    size: 4,
    label: "50",
    title: "Спринт",
    desc: "Всего 50 ходов — успей набрать счёт",
    winTile: 2048,
    group: "special",
    maxMoves: 50,
  },
  {
    id: "blitz",
    size: 4,
    label: "60с",
    title: "Блиц",
    desc: "Минута на партию — гонка со временем",
    winTile: 2048,
    group: "special",
    timeLimitSec: 60,
  },
  {
    id: "wide",
    size: 5,
    label: "×5",
    title: "Широкий хаос",
    desc: "Поле 5×5 и двойной спавн каждый ход",
    winTile: 4096,
    group: "special",
    spawnTwoChance: 0.55,
    spawnPerMove: 2,
  },
];

export const MODE_GROUPS = [
  { id: "size", title: "Размер поля" },
  { id: "special", title: "Особые режимы" },
];

export const DEFAULT_MODE_ID = "4";
const MODE_KEY = "dwadwago-2048-mode";

export function getModeById(id) {
  return MODES.find((m) => m.id === String(id)) || MODES.find((m) => m.id === DEFAULT_MODE_ID);
}

export function getModesByGroup(groupId) {
  return MODES.filter((m) => m.group === groupId);
}

export function getSavedModeId() {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved && getModeById(saved)?.id === saved) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_MODE_ID;
}

export function saveModeId(id) {
  const mode = getModeById(id);
  try {
    localStorage.setItem(MODE_KEY, mode.id);
  } catch {
    /* ignore */
  }
  return mode;
}

export function modeRules(mode) {
  return {
    size: mode.size,
    winTile: mode.winTile,
    spawnTwoChance: mode.spawnTwoChance ?? 0.9,
    spawnEightChance: mode.spawnEightChance ?? 0,
    spawnPerMove: mode.spawnPerMove ?? 1,
    startTiles: mode.startTiles ?? 2,
    maxMoves: mode.maxMoves ?? null,
    timeLimitSec: mode.timeLimitSec ?? null,
  };
}
