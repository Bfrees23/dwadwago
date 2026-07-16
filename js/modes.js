export const MODES = [
  {
    id: "3",
    size: 3,
    label: "3×3",
    title: "Хардкор",
    desc: "Маленькое поле, меньше места для манёвра",
    winTile: 1024,
  },
  {
    id: "4",
    size: 4,
    label: "4×4",
    title: "Классика",
    desc: "Оригинальный 2048",
    winTile: 2048,
  },
  {
    id: "5",
    size: 5,
    label: "5×5",
    title: "Простор",
    desc: "Больше клеток и длинные комбинации",
    winTile: 2048,
  },
  {
    id: "6",
    size: 6,
    label: "6×6",
    title: "Марафон",
    desc: "Большое поле для долгих партий",
    winTile: 4096,
  },
];

export const DEFAULT_MODE_ID = "4";
const MODE_KEY = "dwadwago-2048-mode";

export function getModeById(id) {
  return MODES.find((m) => m.id === String(id)) || MODES.find((m) => m.id === DEFAULT_MODE_ID);
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
