# 2048

Классическая головоломка с режимами, умным авторежимом и рейтингом на GitHub Pages.

## Возможности

- **Выбор режима** над полем: размеры 2×2…8×8 и особые правила
- **Отмена хода** (кнопка / Ctrl+Z)
- **Авторежим**: expectimax + snake-эвристика, Web Worker, скорость и сила ИИ
- **Локальный рейтинг** и **общий рейтинг на GitHub** (`data/leaderboard.json`)

## Локально

ES-модули требуют http(s), не `file://`:

```bash
python3 -m http.server 8080
```

Тесты:

```bash
node js/game.test.mjs
```

## GitHub Pages

1. **Settings → Pages → Source: GitHub Actions**
2. Сайт: `https://bfrees23.github.io/dwadwago/`

## Рейтинг на GitHub

1. **В GitHub** → Issue с JSON счёта  
2. Action `ingest-score` пишет в `data/leaderboard.json`  
3. Игра читает общий топ с `raw.githubusercontent.com`

## Админ

Кнопка **Админ** → вход только через GitHub PAT аккаунта владельца репозитория (`Bfrees23`).

1. Создай Fine-grained или classic token (scopes можно не включать — нужен только `GET /user`)
2. Вставь токен в форму — игра спросит `api.github.com/user`
3. Если логин не владелец репо — отказ
4. Токен не сохраняется в репозитории; сессия держится в `sessionStorage` вкладки ~12 часов

Чужой GitHub-аккаунт зайти не сможет.

## Архитектура

```
js/rng.js           # seedable RNG
js/game.js          # движок: плитки с id, undo, правила спавна
js/ai-core.js       # ИИ (expectimax, учитывает режим)
js/ai.js            # обёртка + Web Worker
js/ai-worker.js
js/board-view.js    # отрисовка с анимацией transform
js/modes.js
js/leaderboard.js / github-leaderboard.js
js/app.js           # связка UI
```
