# 🚀 Deploy EduPulse to Cloudflare Pages

## Предварительные требования

1. **Аккаунт Cloudflare** — [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Node.js 18+** — для сборки
3. **Wrangler CLI** (опционально): `npm install -g wrangler`

## Настройка переменных окружения

Перед деплоем добавьте в **Cloudflare Pages → ваш проект → Settings → Environment variables**:

| Переменная | Обязательная | Описание |
|-----------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | Да | Токен Telegram бота (из @BotFather) |
| `JWT_SECRET` | Нет | Секрет для JWT (если не задан — используется default) |
| `OWNER_TELEGRAM_ID` | Да | Ваш Telegram ID для доступа к панели Owner |
| `DEBUG` | Нет | `true` — режим демо без авторизации (только для теста) |

### Google Sheets (опционально)

Для работы с Google Sheets потребуется **RS256 JWT подпись**, которая пока не реализована для Workers runtime.
**Рекомендация:** Пока используйте демо-режим (`DEBUG=true`) — данные сбрасываются при перезапуске, но всё работает.
Для production рассмотрите Cloudflare D1 (SQLite) как хранилище.

## Деплой через Cloudflare Dashboard

1. Зайдите в **Cloudflare Dashboard → Workers & Pages → Pages**
2. Нажмите **Create → Connect to Git**
3. Выберите репозиторий с проектом
4. Настройте сборку:

| Поле | Значение |
|------|----------|
| **Project name** | `edupulse` |
| **Production branch** | `main` |
| **Build command** | `cd frontend && npm install && npm run build` |
| **Build output directory** | `frontend/dist` |
| **Root directory** | (оставьте пустым — корень репозитория) |

5. В разделе **Environment variables (advanced)** добавьте переменные из таблицы выше
6. Нажмите **Save and Deploy**

Cloudflare Pages автоматически:
- Соберёт React фронтенд
- Обнаружит `functions/` директорию
- Запустит Pages Functions как API-бэкенд

## Деплой через Wrangler CLI

```bash
# 1. Установите зависимости для Functions
cd functions && npm install && cd ..

# 2. Авторизация Wrangler
wrangler login

# 3. Деплой
wrangler pages deploy frontend/dist --branch production
```

## Локальная разработка

### Frontend (отдельно)

```bash
cd frontend
npm run dev
# → http://localhost:5173
```

### Frontend + Functions (через Wrangler)

```bash
# Установите Wrangler глобально
npm install -g wrangler

# Запустите локальный сервер Pages
wrangler pages dev frontend/dist -- npm run dev --prefix frontend
```

Или используйте параллельно:
```bash
# Терминал 1: Python бэкенд (для разработки)
cd backend && uvicorn app.main:app --reload

# Терминал 2: Frontend
cd frontend && npm run dev -- --host
```

## Структура Cloudflare Pages

```
edupulse/
├── frontend/              ← React SPA (собирается в frontend/dist)
│   └── dist/              ← Build output (указан в Pages)
├── functions/             ← Cloudflare Pages Functions (API)
│   ├── _utils/
│   │   ├── auth.ts        ← JWT + Telegram initData (Web Crypto API)
│   │   ├── services.ts    ← Вся бизнес-логика
│   │   ├── store.ts       ← In-memory data store
│   │   ├── seed.ts        ← Демо-данные
│   │   ├── types.ts       ← TypeScript типы
│   │   └── sheets.ts      ← Google Sheets заглушка
│   ├── [[path]].ts        ← Hono роутер (все /api/* запросы)
│   └── package.json       ← Зависимости (hono)
├── wrangler.toml          ← Cloudflare конфигурация
└── CLOUDFLARE_DEPLOY.md   ← Этот файл
```

## Как это работает

1. **Cloudflare Pages** отдаёт статику из `frontend/dist` (React SPA)
2. Все запросы к `/api/*` перехватываются Pages Functions
3. **Hono** обрабатывает роутинг (аналог FastAPI)
4. Данные хранятся **in-memory** (заглушка для Google Sheets)
5. **JWT** и **Telegram initData** работают через Web Crypto API

## Известные ограничения

- **Google Sheets** — заглушен, использует in-memory (данные сбрасываются)
- **Telegram initData** — требует `TELEGRAM_BOT_TOKEN` в production
- **Wrangler** — для продакшена рекомендуется деплой через Cloudflare Dashboard
- **Compatibility flag** — требуется `nodejs_compat` (уже в `wrangler.toml`)
