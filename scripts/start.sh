#!/bin/sh
set -e

echo "🔄 Running database migrations..."
node scripts/migrate.js

echo "🚀 Starting application..."
exec node server.js
