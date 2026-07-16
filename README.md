# 2048

Классическая головоломка **2048** с авторежимом и рейтингом.  
Чистый HTML/CSS/JS — без сборки и без сервера. Работает на GitHub Pages и офлайн.

## Возможности

- **Выбор режима** прямо над полем: список + кнопки
- **Размеры поля**: 2×2 … 8×8
- **Особые режимы**: Четвёрки, Хаос, Джокер, Спринт, Блиц, Широкий хаос
- **Авторежим** с регулировкой скорости
- **Локальный рейтинг** (localStorage) и **общий рейтинг на GitHub**

## Как открыть локально

Нужен статический сервер (ES-модули не работают через `file://`):

```bash
python3 -m http.server 8080
```

Открой http://localhost:8080

## Публикация на GitHub Pages

1. **Settings → Pages → Source: GitHub Actions**
2. После пуша в `main` сайт: `https://bfrees23.github.io/dwadwago/`

## Рейтинг на GitHub (без своего сервера)

Схема:

1. Игрок жмёт **«В GitHub»** → открывается Issue с JSON результата
2. Workflow `ingest-score` читает Issue, пишет запись в `data/leaderboard.json`, коммитит в `main`
3. Pages обновляется, игра читает общий топ из этого JSON

Файлы:

- `data/leaderboard.json` — общий рейтинг
- `.github/workflows/ingest-score.yml` — приём результатов
- `.github/ISSUE_TEMPLATE/score.yml` — шаблон Issue

Локальный рейтинг по-прежнему доступен офлайн.

## Структура

```
index.html
css/styles.css
data/leaderboard.json
js/modes.js
js/game.js
js/ai.js
js/leaderboard.js          # локальный
js/github-leaderboard.js   # общий (GitHub)
js/app.js
```
