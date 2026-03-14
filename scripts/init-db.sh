#!/bin/bash
set -e

echo "🔧 Initializing DashAdmin database..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

echo "📦 Applying base schema..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /app/src/db/schema.sql

echo "🔄 Applying migrations..."
MAX_PASSES="${MIGRATION_MAX_PASSES:-5}"
pass=1
had_failure=1

while [ "$pass" -le "$MAX_PASSES" ]; do
  echo "  ➜ Pass $pass/$MAX_PASSES"
  had_failure=0

  for migration in /app/migrations/*.sql; do
    if [ -f "$migration" ]; then
      name="$(basename "$migration")"
      echo "    - Applying $name"
      if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"; then
        echo "    ⚠️  Failed: $name"
        had_failure=1
      fi
    fi
  done

  if [ "$had_failure" -eq 0 ]; then
    break
  fi

  pass=$((pass + 1))
done

if [ "$had_failure" -ne 0 ]; then
  echo "❌ Some migrations still fail after $MAX_PASSES pass(es)."
  exit 1
fi

echo "✅ Database initialization complete!"
