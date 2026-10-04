#!/bin/sh
set -e

echo "🚀 Starting application with CS2 WebSocket Server..."
exec node scripts/server-with-ws.js
