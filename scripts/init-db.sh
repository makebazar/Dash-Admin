#!/bin/bash
set -e

echo "🔧 Initializing DashAdmin database..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "🔄 Running database migrations..."
node scripts/migrate.js

echo "✅ Database initialization complete!"
