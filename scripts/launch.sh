#!/usr/bin/env bash
# One-click launcher for the Sales Display app.
# Starts the API server + Electron window.
# Safe to double-click from a file manager or run from a terminal.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# On Linux (Pi) make sure we have a display
if [ -z "${DISPLAY:-}" ] && [ "$(uname -s)" = "Linux" ]; then
  export DISPLAY=:0
  export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"
fi

# Build if first run
if [ ! -f dist/client/index.html ]; then
  echo "First run — building client…"
  npm run build
fi

# Kill any leftover server on port 3000
if command -v fuser >/dev/null 2>&1; then
  fuser -k 3000/tcp 2>/dev/null || true
elif command -v lsof >/dev/null 2>&1; then
  lsof -ti:3000 | xargs kill 2>/dev/null || true
fi

# Stop PM2 instance if running
if command -v pm2 >/dev/null 2>&1; then
  pm2 stop sales-display 2>/dev/null || true
fi

sleep 1

# Start everything (server + Electron)
exec npm run start:all
