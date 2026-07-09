# 🚀 Deploy EduPulse to Cloudflare Pages

## 📋 Architecture (Updated)

```
┌─────────────────────┐         ┌──────────────────────┐
│  Cloudflare Pages   │         │  Render (FastAPI)    │
│  (Static Frontend)  │ ──────▶ │  (Backend API)       │
│  edypulse.pages.dev │  HTTPS  │  edypulse.onrender   │
│                     │         │  .com/api/*          │
└─────────────────────┘         └──────────────────────┘
```

- **Cloudflare Pages** serves only the static React SPA (`frontend/dist`)
- **Render** runs the FastAPI backend with all API routes (`/api/*`)
- Frontend points to `https://edypulse.onrender.com/api` via `VITE_API_URL`
- Cloudflare Pages Functions are **no longer used** for API requests

## Предварительные требования

1. **Аккаунт Cloudflare** — [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Node.js 18+** — для сборки
3. **Wrangler CLI** (опционально): `npm install -g wrangler`

## Настройка переменных окружения

### Build-time (Vite)

`VITE_API_URL` задаётся в файле `frontend/.env.production`:
```
VITE_API_URL=https://edypulse.onrender.com/api
```

Vite автоматически подхватывает этот файл при сборке (`npm run build`).
Не требует настройки в Cloudflare Dashboard.

### Runtime (Cloudflare Pages Functions — больше не используются)

Переменные для Cloudflare Functions **больше не нужны**, так как API работает на Render.
Если потребуется вернуть Functions — добавьте в Cloudflare Dashboard:

| Переменная | Описание |
|-----------|----------|
| `TELEGRAM_BOT_TOKEN` | Токен Telegram бота (из @BotFather) |
| `JWT_SECRET` | Секрет для JWT |
| `OWNER_TELEGRAM_ID` | Ваш Telegram ID |
| `DEBUG` | `true` — режим демо без авторизации |

### Backend (Render)

Настройте следующие переменные в **Render Dashboard → Environment**:

| Переменная | Обязательная | Описание |
|-----------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | Да | Токен Telegram бота |
| `JWT_SECRET` | Нет | Секрет для JWT |
| `OWNER_TELEGRAM_ID` | Да | Ваш Telegram ID |

## Деплой через Cloudflare Dashboard

1. Зайдите в **Cloudflare Dashboard → Workers & Pages → Pages**
2. Нажмите **Create → Connect to Git**
3. Выберите репозиторий с проектом
4. Настройте сборку:

| Поле | Значение |
|------|----------|
| **Project name** | `edupulse` |
| **Production branch** | `main` |
| **Build command** | `cd frontend && npm install && npm run build && cd ../functions && npm install` |
| **Build output directory** | `frontend/dist` |
| **Root directory** | (оставьте пустым — корень репозитория) |

5. В разделе **Environment variables (advanced)** можно оставить пустым — `VITE_API_URL` уже задан в `.env.production`
6. Нажмите **Save and Deploy**

> **Важно:** Build command включает установку зависимостей Functions для обратной совместимости.
> Если вы удалили `functions/` — уберите часть `&& cd ../functions && npm install`.

## Деплой через Wrangler CLI

```bash
# 1. Сборка фронтенда
cd frontend && npm install && npm run build

# 2. Деплой статики
wrangler pages deploy frontend/dist --branch production
```

## Локальная разработка

```bash
cd frontend
npm run dev
# → http://localhost:5173
```

В режиме разработки фронтенд использует запасной URL `/api` (локальный бэкенд или Cloudflare Functions).
Чтобы направить запросы на Render в dev-режиме:

```bash
# Windows (CMD)
set VITE_API_URL=https://edypulse.onrender.com/api && npm run dev

# Windows (PowerShell)
$env:VITE_API_URL="https://edypulse.onrender.com/api"; npm run dev

# macOS/Linux
VITE_API_URL=https://edypulse.onrender.com/api npm run dev
```

## Структура проекта (после изменений)

```
edupulse/
├── frontend/                   ← React SPA
│   ├── .env.production         ← VITE_API_URL для продакшена
│   ├── src/services/api.ts     ← API клиент (указывает на Render)
│   └── dist/                   ← Build output
├── functions/                  ← Cloudflare Functions (DEPRECATED)
│   ├── api/[[path]].ts         ← Заглушка (больше не обрабатывает запросы)
│   └── _utils/                 ← Утилиты (не используются)
├── backend/                    ← FastAPI бэкенд (на Render)
│   ├── app/
│   │   ├── api/routes/         ← Все API endpoints
│   │   ├── services/           ← Бизнес-логика
│   │   └── core/               ← Конфиг, безопасность
│   └── main.py
├── wrangler.toml               ← Cloudflare конфигурация
└── CLOUDFLARE_DEPLOY.md        ← Этот файл
```

## Как это работает

1. **Cloudflare Pages** отдаёт статику React SPA из `frontend/dist`
2. Все API запросы идут напрямую на **Render** (`https://edypulse.onrender.com/api/*`)
3. **FastAPI** на Render обрабатывает роутинг, авторизацию и бизнес-логику
4. **Google Sheets** используется как база данных (in-memory если не настроен)
5. Cloudflare Functions больше **не участвуют** в обработке API

## Отладка

### Проверка, куда идут запросы

Откройте DevTools (F12) → Network tab → найдите любой XHR/Fetch запрос.
URL должен начинаться с `https://edypulse.onrender.com/api/...`.

Если запросы идут на `edypulse.pages.dev/api/...` — значит `VITE_API_URL` не установлен.

### Проверка бэкенда

```bash
curl https://edypulse.onrender.com/api/health
# → {"status":"ok","version":"1.0.0",...}
```

Swagger-документация: https://edypulse.onrender.com/docs
