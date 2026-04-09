#!/usr/bin/env bash
set -euo pipefail

# Sales Display — Raspberry Pi Setup Script
# Run this on a fresh Raspberry Pi OS (64-bit Desktop) installation.
# Usage: bash scripts/setup-pi.sh

echo "=== Sales Display: Raspberry Pi Setup ==="
echo ""

# ── 1. System update ──────────────────────────────────────────────
echo "[1/6] Updating system packages..."
sudo apt-get update -qq
sudo apt-get upgrade -y -qq

# ── 2. Install Node.js 20 LTS ────────────────────────────────────
if command -v node &>/dev/null; then
  echo "[2/6] Node.js already installed: $(node -v)"
else
  echo "[2/6] Installing Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
  echo "     Installed: $(node -v)"
fi

# ── 3. Install PM2 ───────────────────────────────────────────────
if command -v pm2 &>/dev/null; then
  echo "[3/6] PM2 already installed"
else
  echo "[3/6] Installing PM2..."
  sudo npm install -g pm2
fi

# ── 4. Install project dependencies and build ────────────────────
echo "[4/6] Installing project dependencies..."
cd "$(dirname "$0")/.."
npm install
echo "     Building client..."
npm run build

# ── 5. Configure PM2 to start on boot ────────────────────────────
echo "[5/6] Configuring PM2 startup..."
pm2 start ecosystem.config.cjs
pm2 save
sudo env PATH="$PATH:/usr/bin" "$(which pm2)" startup systemd -u "$USER" --hp "$HOME"
pm2 save

# ── 6. Configure Chromium kiosk mode ─────────────────────────────
echo "[6/6] Setting up Chromium kiosk mode..."

AUTOSTART_DIR="$HOME/.config/autostart"
mkdir -p "$AUTOSTART_DIR"

# Standalone app window (Electron) — dedicated desktop app, not a generic browser session.
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cat > "$AUTOSTART_DIR/sales-display.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Sales Display
Comment=Sales dashboard (Electron)
Exec=bash -lc 'sleep 10; cd "'"$PROJECT_DIR"'" && npm run desktop'
X-GNOME-Autostart-enabled=true
DESKTOP

# Fallback: minimal browser chrome (no tab bar) if you remove Electron
cat > "$AUTOSTART_DIR/sales-display-chromium.desktop" <<FALLBACK
[Desktop Entry]
Type=Application
Name=Sales Display (Chromium)
Exec=bash -c 'sleep 8 && chromium-browser --app=http://127.0.0.1:3000 --start-fullscreen --noerrdialogs --disable-infobars --disable-session-crashed-bubble'
Hidden=true
X-GNOME-Autostart-enabled=false
FALLBACK

# Disable screen blanking / screensaver
LXDE_AUTOSTART="$HOME/.config/lxsession/LXDE-pi/autostart"
if [ -f "$LXDE_AUTOSTART" ]; then
  if ! grep -q "xset s off" "$LXDE_AUTOSTART" 2>/dev/null; then
    cat >> "$LXDE_AUTOSTART" <<'XSET'
@xset s off
@xset -dpms
@xset s noblank
XSET
  fi
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Copy .env.example to .env and fill in your Slack tokens"
echo "     cp .env.example .env"
echo "     nano .env"
echo ""
echo "  2. Restart PM2 after editing .env:"
echo "     pm2 restart sales-display"
echo ""
echo "  3. Reboot to test kiosk mode:"
echo "     sudo reboot"
echo ""
