#!/usr/bin/env bash
# Desktop launcher: git pull, build, free port 3000, then npm run start:all (API + Electron).
# Usage: bash scripts/create-desktop-shortcut.sh
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

# Exec must be one logical line. Embed ROOT when generating the file — do not use "~" or "$HOME"
# inside .desktop (many parsers do not expand them). Avoid nested double-quotes around paths.
cat > "$SHORTCUT" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Sales Display
Comment=Update, rebuild, restart API and Electron window
Exec=/usr/bin/bash -lc 'cd ${ROOT} && git pull && npm run build && fuser -k 3000/tcp; sleep 1 && npm run start:all'
Terminal=true
Icon=${ICON}
Categories=Utility;
EOF

chmod +x "$SHORTCUT"
echo "Created: $SHORTCUT"
echo "Right-click → Allow Launching if prompted. Terminal=true shows git/npm output."
