#!/bin/sh
set -e

echo "🔄 Running database migrations..."

# Run migrations using the new robust script
node scripts/migrate.js

echo "🚀 Starting application..."
exec node server.js
