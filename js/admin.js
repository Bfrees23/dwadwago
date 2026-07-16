import { detectRepo } from "./github-leaderboard.js";

const SESSION_KEY = "dwadwago-2048-admin-session";
const SESSION_HOURS = 12;

/** Only these GitHub logins can become admin (repo owner + aliases). */
export function allowedAdminLogins() {
  const { owner } = detectRepo();
  const set = new Set(
    [owner, "Bfrees23", "bfrees23"]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase()),
  );
  return set;
}

export function getAdminSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.login || !data?.exp) return null;
    if (Date.now() > Number(data.exp)) {
      clearAdminSession();
      return null;
    }
    if (!allowedAdminLogins().has(String(data.login).toLowerCase())) {
      clearAdminSession();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function isAdmin() {
  return Boolean(getAdminSession());
}

export function clearAdminSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function saveSession(login) {
  const data = {
    login,
    exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  return data;
}

/**
 * Verify a GitHub PAT against api.github.com/user.
 * Only the repo owner (and allowlisted aliases) is accepted.
 * Token is never written to localStorage / the repo — only used for this request.
 */
export async function loginWithGitHubToken(token) {
  const cleaned = String(token || "").trim();
  if (!cleaned) {
    return { ok: false, error: "Вставь GitHub Personal Access Token." };
  }
  if (cleaned.length < 20) {
    return { ok: false, error: "Токен слишком короткий — это не похоже на GitHub PAT." };
  }

  let res;
  try {
    res = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${cleaned}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch {
    return { ok: false, error: "Нет сети или GitHub API недоступен." };
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: "Токен отклонён GitHub. Проверь PAT и срок действия." };
  }
  if (!res.ok) {
    return { ok: false, error: `GitHub ответил ${res.status}. Попробуй другой токен.` };
  }

  const user = await res.json();
  const login = String(user.login || "");
  if (!allowedAdminLogins().has(login.toLowerCase())) {
    return {
      ok: false,
      error: `Доступ запрещён для @${login}. Админ только владелец репозитория.`,
    };
  }

  const session = saveSession(login);
  return { ok: true, session, user };
}

export function adminHelpText() {
  const { owner, name } = detectRepo();
  return {
    owner,
    name,
    tokenUrl: "https://github.com/settings/tokens?type=beta",
    classicUrl: "https://github.com/settings/tokens",
  };
}
