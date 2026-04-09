# Sales Celebration Display

A Raspberry Pi 5-powered sales dashboard that listens for sales events from Slack, displays a live leaderboard on a touchscreen, and triggers disco lights via TP-Link Kasa smart plugs for celebration moments.

## Hardware

- **Raspberry Pi 5** (any RAM size)
- **XBONFIRE EM101** 10.1" touchscreen (1920x1200, HDMI + USB, plug-and-play)
- **Speakers** (3.5mm or USB — the XBONFIRE has built-in speakers as a backup)
- **TP-Link Kasa smart plug** (any model: HS100, HS103, HS105, KP115, etc.)
- **Disco lights** plugged into the Kasa smart plug
- **Micro SD card** (32GB+ recommended)

## Quick Start (Development on Mac/PC)

```bash
# Install dependencies
npm install

# Copy env template and fill in your Slack tokens
cp .env.example .env

# Run in development mode (Vite + Express)
npm run dev
```

The dashboard opens at http://localhost:5173 (hot-reloading).
The API server runs at http://localhost:3000.

## Raspberry Pi Setup

### Step 1: Flash the SD Card

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on your Mac/PC
2. Insert the micro SD card into your computer
3. In the Imager:
   - **Device**: Raspberry Pi 5
   - **OS**: Raspberry Pi OS (64-bit) — the Desktop version
   - **Storage**: your SD card
4. Click the **gear icon** (or "Edit Settings") before writing:
   - Set a **hostname** (e.g. `salesdisplay`)
   - Set **username and password**
   - Configure **WiFi** (SSID and password)
   - Enable **SSH** (password authentication)
5. Write the image to the SD card

### Step 2: First Boot

1. Insert the SD card into the Pi
2. Connect the XBONFIRE monitor:
   - **HDMI cable** from Pi to monitor (video)
   - **USB cable** from Pi to monitor (touch input)
3. Connect speakers (3.5mm jack or USB)
4. Connect power to the Pi
5. Wait for it to boot to the desktop (first boot takes a few minutes)

### Step 3: Deploy the App

SSH into your Pi or open a terminal on it:

```bash
# Clone or copy the project to the Pi
# Option A: Git clone (if you have a repo)
git clone <your-repo-url> ~/sales-display

# Option B: SCP from your Mac
# scp -r ./sales-display pi@salesdisplay.local:~/

# Run the setup script
cd ~/sales-display
bash scripts/setup-pi.sh
```

### Step 4: Configure Slack

**The Pi needs its own `.env` file.** `.env` is not in git (it’s in `.gitignore`). If you only edited `.env` on your Mac, copy it to the Pi, e.g. `scp .env hdehler@salesdisplay:~/sales-display/`

1. Copy the environment template:
   ```bash
   cp .env.example .env
   nano .env
   ```

2. Follow the Slack setup instructions below to get your tokens

3. Restart the app:
   ```bash
   pm2 restart sales-display
   ```

4. Reboot to test autostart (Electron desktop window):
   ```bash
   sudo reboot
   ```

## Slide Cloud order messages (Block Kit)

Sale posts from **Slide Cloud** use Slack **Block Kit** (structured fields like Account, Order, Hardware, Service), not plain text. The server parses those blocks automatically when it sees **New Order Created** (or Account + Order + Hardware/Service).

- **Ticker / dashboard:** shows **order id** (e.g. `o_52x4laoem1w4`), **account**, and **hardware · service**.
- **Celebration overlay:** **NEW ORDER!** with order id and account (no dollar amount — Slide messages do not include price in the notification).
- **Triggers:** use `CELEBRATION_TRIGGER_PRODUCTS` keywords that appear in the combined hardware/service line (e.g. `F1-16`, `Subscription`).

After changing parser code on the Pi: `npm run build && pm2 restart sales-display`.

## Slack App Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**
2. Choose **From scratch**, give it a name (e.g. "Sales Display"), select your workspace
3. Go to **Socket Mode** (left sidebar) → toggle it **ON**
   - Click **Generate** to create an App-Level Token
   - Name it anything (e.g. "socket-token")
   - Add the `connections:write` scope
   - Copy the token — this is your `SLACK_APP_TOKEN` (`xapp-...`)
4. Go to **Event Subscriptions** → toggle **ON**
   - Under "Subscribe to bot events", add: `message.channels`
   - Save changes
5. Go to **OAuth & Permissions**:
   - Under "Bot Token Scopes", add: `channels:history`, `channels:read`
   - Click **Install to Workspace** and authorize
   - Copy the "Bot User OAuth Token" — this is your `SLACK_BOT_TOKEN` (`xoxb-...`)
6. **Invite the bot** to your sales channel:
   - In Slack, go to the sales channel
   - Type `/invite @YourBotName`

7. **Get the channel ID**:
   - Right-click the channel name → "View channel details"
   - The Channel ID is at the bottom (starts with `C`)
   - This is your `SLACK_SALES_CHANNEL_ID`

The **`channels:history`** scope is required so the app can read **past** messages (backfill), not only new ones.

## Slack history (orders that already happened)

The live Socket listener only sees **new** messages. To import **existing** Slide / plain-text orders from the channel:

**Option A — on each server start** (good for a fresh Pi):

```env
SLACK_BACKFILL_ON_START=true
SLACK_BACKFILL_MAX_MESSAGES=500
```

Restart: `pm2 restart sales-display`. Watch logs for `[Backfill] Done: scanned=… inserted=…`. Duplicates are skipped using Slack message timestamps.

**Option B — one-shot CLI** (does not require restarting the server first; only needs `SLACK_BOT_TOKEN` + `SLACK_SALES_CHANNEL_ID`):

```bash
cd ~/sales-display
npx tsx src/server/slack-backfill-cli.ts 800
```

(800 = max messages to scan; optional, default 500 in code path.)

Backfill **does not** fire celebrations or disco — it only fills SQLite. New live messages still behave as before.

## Desktop app on the Pi (not a generic browser)

The UI is still built with web tech, but it runs in a **dedicated Electron window** (fullscreen / kiosk, no tabs, no address bar) so it feels like a normal desktop app. The Node server stays on **127.0.0.1:3000** on the same machine; Electron is just the shell (same pattern as Slack, VS Code, etc.).

- **Autostart:** `scripts/setup-pi.sh` installs `~/.config/autostart/sales-display.desktop`, which runs `npm run desktop` after login.
- **Manual:** with PM2 already running the API, open a terminal on the Pi and run:
  ```bash
  cd ~/sales-display && npm run desktop
  ```
- **Without Electron:** enable the fallback autostart file `sales-display-chromium.desktop` (set `Hidden=false` and `X-GNOME-Autostart-enabled=true`) and disable the Electron one — it uses `chromium-browser --app=http://127.0.0.1:3000` (minimal chrome, still not “localhost in a tabbed browser”).

**Dev on Mac:** `npm start` in one terminal, `npm run desktop` in another.

## Kasa Smart Plug Setup

1. Download the **Kasa** app on your phone
2. Add your smart plug(s) following the app instructions
3. Connect the plug to the **same WiFi network** as the Raspberry Pi
4. Plug your disco lights into the Kasa smart plug
5. The app auto-discovers plugs on the network — no configuration needed
6. (Optional) If auto-discovery doesn't work, find the plug's IP address in the Kasa app and set `KASA_PLUG_HOSTS` in `.env`

## Celebration Triggers

Configure which sales trigger the disco lights in `.env`:

- `CELEBRATION_TRIGGER_PRODUCTS` — comma-separated keywords. If a sale's product name contains any of these, it triggers a celebration. Example: `enterprise,premium,annual`
- `MILESTONE_INTERVAL` — triggers a celebration every N sales per day. Example: `10` means the 10th, 20th, 30th sale, etc.
- `CELEBRATION_DURATION` — how long the party lasts in seconds

## Custom Sounds

Drop any `.mp3` file at `public/sounds/celebration.mp3` to replace the default chime. The file is played through the browser on the touchscreen, which routes to your connected speakers.

## Project Structure

```
src/
  server/
    index.ts          — entry point: Express + Socket.IO + Slack
    config.ts         — env-based configuration
    db.ts             — SQLite storage for sales
    slack.ts          — Slack Bot listener
    parseSlackMessage.ts — parse live + history messages
    slackHistoryBackfill.ts — conversations.history importer
    plugs.ts          — Kasa smart plug control
    celebration.ts    — celebration orchestration and queue
  client/
    App.tsx           — main React app
    components/
      Dashboard.tsx   — layout: header + ticker + chart + stats
      Celebration.tsx — full-screen celebration overlay
      Leaderboard.tsx — ranked sales reps
      SalesChart.tsx  — 14-day trend chart
      SalesTicker.tsx — scrolling recent sales
      StatsCards.tsx  — today/week/month totals
      Header.tsx      — branding and clock
    hooks/
      useSocket.ts    — Socket.IO client hook
  shared/
    types.ts          — shared TypeScript types
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Development mode (hot-reloading) |
| `npm run build` | Build the React client for production |
| `npm start` | Start the production server |
| `npm run setup` | Install deps + build (used by setup script) |
| `npm run desktop` | Open dashboard in Electron (server must be running) |
| `npm run slack-backfill` | One-shot Slack history import (optional max messages as arg) |

## Troubleshooting (Pi / PM2)

**PM2: `Error: No script path - aborting`** — This was caused by `ecosystem.config.js` using ES module syntax while the project has `"type": "module"`. PM2 did not load the config correctly. The fix is [`ecosystem.config.cjs`](ecosystem.config.cjs) (CommonJS). Pull the latest repo, then on the Pi:

```bash
cd ~/sales-display
ls -la ecosystem.config.cjs   # must exist; if "No such file", run: git pull
pm2 delete sales-display 2>/dev/null || true
pm2 start "$PWD/ecosystem.config.cjs"
pm2 save
```

If you never got a running app, `pm2 delete all` then the same `pm2 start "$PWD/ecosystem.config.cjs"` is fine.

**`File ecosystem.config.cjs not found`** means that file is not on the Pi yet (old copy of the repo). From your Mac, sync the project (e.g. `git pull` on the Pi, or `scp ecosystem.config.cjs hdehler@salesdisplay:~/sales-display/`), then run the commands above again.
