# DashAdmin Coolify Deployment Architecture

## 🏗️ Архитектура приложения

**DashAdmin** = Next.js Fullstack приложение (одно целое)
- ✅ Frontend: React компоненты, страницы (Next.js App Router)
- ✅ Backend: API Routes в папке `src/app/api/`
- ✅ Запускается: одна команда `node server.js` (production)
- ✅ Один порт: 3000

## 🚢 Coolify конфигурация

### Сервисы в Coolify:

```
┌─────────────────────────────────────┐
│  1. PostgreSQL Database             │
│     dashadmin-db:5432               │
│     (Отдельный сервис)              │
└─────────────────────────────────────┘
              ↕ DATABASE_URL
┌─────────────────────────────────────┐
│  2. DashAdmin Application           │
│     Next.js (Frontend + Backend)    │
│     Port: 3000                      │
│     Image: собирается из Dockerfile │
└─────────────────────────────────────┘
              ↕
         Your Domain
```

### Переменные окружения для приложения:

```env
DATABASE_URL=postgresql://user:password@dashadmin-db:5432/dashadmin
NODE_ENV=production
PORT=3000
```

## 📝 Шаги деплоя в Coolify

1. **Создать PostgreSQL** (Resources → Database → PostgreSQL)
   - Название: `dashadmin-db`
   
2. **Создать Application** (Resources → Application → Git Repository)
   - URL: `https://github.com/makebazar/Dash-Admin.git`
   - Build Pack: Docker (автоматически определится)
   - Port: 3000

3. **Настроить Environment Variables**
   - `DATABASE_URL` - из PostgreSQL сервиса
   - `NODE_ENV=production`

4. **Deploy** ← Coolify соберёт образ и запустит

5. **Миграции БД**
   - Миграции запускаются автоматически при старте контейнера (см. `scripts/start.sh` → `node scripts/migrate.js`).
   - Для ручного прогона (если нужно): `node scripts/migrate.js`
   - `./scripts/init-db.sh` больше не обязателен (он просто запускает тот же `migrate.js`).

## ✅ Готово!

Приложение будет доступно по домену. Всё работает в одном контейнере - и frontend, и backend API.

---

## 🆚 Сравнение с "Делаем Базар"

| Проект | Архитектура | Coolify сервисов |
|--------|-------------|------------------|
| **Делаем Базар** | Backend (NestJS) + Frontend (React) | 2 приложения + 1 БД |
| **DashAdmin** | Next.js Fullstack | 1 приложение + 1 БД |

Оба подхода валидны! Next.js fullstack проще деплоить (меньше сервисов).
