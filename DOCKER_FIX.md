# ✅ Исправление ошибки сборки Docker

## Проблема
```
Error: Cannot find module 'typescript'
```

Dockerfile использовал `npm ci --only=production`, что не устанавливало devDependencies (TypeScript, ESLint и т.д.), необходимые для сборки Next.js приложения.

## Решение

Изменил Dockerfile:
- **Было:** `RUN npm ci --only=production` 
- **Стало:** `RUN npm ci` (устанавливает ВСЕ зависимости)

## Что делать дальше

1. **В Coolify нажмите "Redeploy"** или "Deploy" снова
2. Coolify загрузит новый Dockerfile с GitHub
3. Сборка пройдёт успешно (будут установлены devDependencies)

## Также рекомендую

В Coolify в **Environment Variables**:
- Найдите `NODE_ENV`
- **Снимите галочку "Available at Buildtime"** (чтобы NODE_ENV=production не влиял на сборку)
- Оставьте только "Available at Runtime"

Это уберёт предупреждение которое было в логах.

---

✅ Изменения запушены в GitHub: commit `2a3a63a`
