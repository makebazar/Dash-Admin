#!/bin/bash
# Load .env.local explicitly before starting Next.js
# This ensures DATABASE_URL is set before any Node.js code runs

set -a  # Automatically export all variables
if [ -f .env.local ]; then
    source .env.local
    echo "✓ Loaded .env.local"
elif [ -f .env ]; then
    source .env
    echo "✓ Loaded .env (fallback)"
else
    echo "✗ No .env.local or .env found!"
fi
set +a  # Stop auto-export

# Run Next.js with the loaded environment
exec npx next dev "$@"
