#!/usr/bin/env bash
# Install a clickable desktop launcher for Sales Display (Electron) with the Slide icon.
# Usage: bash scripts/create-desktop-shortcut.sh
# Requires: backend already managed by PM2, or start it before opening the window.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICON="${ROOT}/src/images/logo-icon-only-rounded-256.png"
DESKTOP_DIR="${HOME}/Desktop"
SHORTCUT="${DESKTOP_DIR}/Sales-Display.desktop"

if [ ! -f "$ICON" ]; then
  echo "Slide icon not found at: $ICON" >&2
  exit 1
fi

mkdir -p "$DESKTOP_DIR"

cat > "$SHORTCUT" <<EOF
[Desktop Entry]
Type=Application
Name=Sales Display
Comment=Sales dashboard (Slide / Electron)
Exec=bash -lc "cd \"$ROOT\" && npm run desktop"
Terminal=false
Icon=${ICON}
Categories=Utility;
EOF

chmod +x "$SHORTCUT"
echo "Created: $SHORTCUT"
echo "If the icon does not show, right-click the shortcut → Allow Launching (Pi desktop)."
