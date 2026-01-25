#!/bin/bash
set -e

echo "🔧 Initializing DashAdmin database..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

echo "📦 Applying base schema..."
psql "$DATABASE_URL" -f /app/src/db/schema.sql

echo "🔄 Applying migrations..."
for migration in /app/migrations/*.sql; do
  if [ -f "$migration" ]; then
    echo "  ➜ Applying $(basename $migration)..."
    psql "$DATABASE_URL" -f "$migration" || echo "  ⚠️  Migration $(basename $migration) may have already been applied"
  fi
done

echo "✅ Database initialization complete!"
