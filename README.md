# DashAdmin

Административная панель для управления клубами, сотрудниками, сменами и финансами.

## 🚀 Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4, Radix UI
- **Database**: PostgreSQL
- **Charts**: Recharts
- **Auth**: Custom phone verification

## 📋 Features

- 👥 Управление пользователями и ролями
- 🏢 Многоуровневая система клубов
- 📊 Отслеживание смен и зарплат сотрудников
- 💰 Финансовые отчеты и транзакции
- 📈 Аналитика и KPI
- 🔐 Аутентификация по номеру телефона
- 👨‍💼 Роли: Super Admin, Club Owner, Admin, Employee

## 🛠️ Development

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- npm или yarn

### Installation

```bash
# Клонировать репозиторий
git clone https://github.com/makebazar/Dash-Admin.git
cd Dash-Admin

# Установить зависимости
npm install

# Настроить переменные окружения
cp .env.example .env
# Отредактировать .env и указать DATABASE_URL
```

### Database Setup

```bash
# Применить схему базы данных
psql $DATABASE_URL -f src/db/schema.sql

# Применить миграции
for f in migrations/*.sql; do psql $DATABASE_URL -f "$f"; done
```

### Running Locally

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## 🐳 Docker Deployment

### Build Docker Image

```bash
docker build -t dashadmin:latest .
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@host:5432/dashadmin` |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Application port | `3000` |

### Running with Docker

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:password@host:5432/dashadmin" \
  -e NODE_ENV=production \
  dashadmin:latest
```

## 🚢 Coolify Deployment

1. **Создайте новый проект в Coolify**
2. **Подключите GitHub репозиторий**: `https://github.com/makebazar/Dash-Admin.git`
3. **Настройте переменные окружения**:
   - `DATABASE_URL` - URL вашей PostgreSQL базы данных
   - `NODE_ENV=production`
4. **Настройте PostgreSQL** (если еще не создана):
   - В Coolify создайте новый PostgreSQL сервис
   - Используйте connection string из Coolify для `DATABASE_URL`
5. **Инициализация БД**:
   ```bash
   # Выполните один раз после первого деплоя
   ./scripts/init-db.sh
   ```
6. **Deploy!** - Coolify автоматически соберет и запустит приложение

## 📁 Project Structure

```
DashAdmin/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── api/          # API routes
│   │   ├── login/        # Login page
│   │   ├── dashboard/    # Dashboard view
│   │   ├── employee/     # Employee workspace
│   │   ├── clubs/        # Club management
│   │   └── dashadmin-x/  # Super admin panel (v2)
│   ├── components/       # Reusable React components
│   ├── db/              # Database schema and connection
│   └── lib/             # Utilities and helpers
├── migrations/          # Database migrations
├── scripts/            # Utility scripts
├── public/             # Static assets
└── Dockerfile          # Docker configuration
```

## 🔒 Security

- Passwords хешируются с помощью bcrypt
- Session management через cookies
- Role-based access control (RBAC)
- Environment variables для sensitive data

## 📝 License

Private Project

## 👥 Team

Made with ❤️ by MakeBazar
