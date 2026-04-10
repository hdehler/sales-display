#!/usr/bin/env sh
# Electron needs a display. Over SSH on a Pi, DISPLAY is usually unset — use the
# local HDMI/touch session (:0). macOS/Windows: leave env unchanged.
set -e
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

if [ -z "${DISPLAY:-}" ] && [ "$(uname -s)" = "Linux" ]; then
  export DISPLAY=:0
  export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"
fi

exec "$ROOT/node_modules/.bin/electron" .
