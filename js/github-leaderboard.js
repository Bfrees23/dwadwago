const MAX_SHOW = 20;

export function detectRepo() {
  try {
    const host = window.location.hostname;
    if (host.endsWith(".github.io")) {
      const owner = host.split(".")[0];
      const parts = window.location.pathname.split("/").filter(Boolean);
      const name = parts[0] || owner;
      return { owner, name };
    }
  } catch {
    /* ignore */
  }
  return { owner: "Bfrees23", name: "dwadwago" };
}

export function leaderboardUrls(repo = detectRepo()) {
  const relative = "./data/leaderboard.json";
  const raw = `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/main/data/leaderboard.json`;
  return { relative, raw };
}

export async function fetchGitHubLeaderboard(modeId = null) {
  const { relative, raw } = leaderboardUrls();
  let data = null;

  // Prefer raw.githubusercontent.com so scores appear even before Pages redeploys.
  for (const url of [`${raw}?t=${Date.now()}`, raw, relative]) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      data = await res.json();
      break;
    } catch {
      /* try next */
    }
  }

  if (!data || !Array.isArray(data.entries)) {
    return { updatedAt: null, entries: [], source: null };
  }

  const entries = data.entries
    .filter((e) => e && typeof e.score === "number")
    .filter((e) => (modeId == null || modeId === "all" ? true : String(e.modeId) === String(modeId)))
    .sort((a, b) => b.score - a.score || b.maxTile - a.maxTile)
    .slice(0, MAX_SHOW);

  return {
    updatedAt: data.updatedAt || null,
    entries,
    source: "github",
  };
}

export function buildScoreIssueUrl(entry, repo = detectRepo()) {
  const payload = {
    name: entry.name,
    score: entry.score,
    maxTile: entry.maxTile,
    modeId: entry.modeId,
    modeLabel: entry.modeLabel,
    auto: Boolean(entry.auto),
    at: entry.at || new Date().toISOString(),
  };

  const body = [
    "### Score Submission",
    "",
    "Отправлено из игры 2048. Бот запишет результат в `data/leaderboard.json`.",
    "",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
    "",
  ].join("\n");

  const title = `score: ${payload.score} · ${payload.modeLabel} · ${payload.name}`;
  const params = new URLSearchParams({
    title,
    labels: "score",
    body,
  });

  return `https://github.com/${repo.owner}/${repo.name}/issues/new?${params.toString()}`;
}
