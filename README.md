# Sales Celebration Display

A Raspberry Pi 5-powered sales dashboard that listens for sales events from Slack, displays a live leaderboard on a touchscreen, and runs full-screen celebrations with sound on the display.

## Hardware

- **Raspberry Pi 5** (any RAM size)
- **XBONFIRE EM101** 10.1" touchscreen (1920x1200, HDMI + USB, plug-and-play)
- **Speakers** (3.5mm or USB — the XBONFIRE has built-in speakers as a backup)
- **Micro SD card** (32GB+ recommended)

## Quick Start (Development on Mac/PC)

```bash
# Install dependencies
npm install

# Copy env template and fill in your Slack tokens
cp .env.example .env

# One command: production API + Electron window (builds client if needed)
make run
# same as: npm run build && npm run start:all
```

**Development** (hot reload, open http://localhost:5173 in a browser):

```bash
npm run dev
```

The API server always serves production builds at http://localhost:3000 when you use `make run` / `npm run start`.

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
- **Leaderboard:** ranks **accounts** (customer) by order count this month — Slide does **not** send who sold the deal in Slack.
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

**Wipe orders before a full re-import** (keeps reps, settings, and song mappings):

```bash
cd ~/sales-display
npm run clear-sales -- --yes
```

Then run the backfill below. Without clearing first, existing `slack_ts` rows block duplicate inserts.

**Option A — on each server start** (good for a fresh Pi):

```env
SLACK_BACKFILL_ON_START=true
SLACK_BACKFILL_MAX_MESSAGES=500
```

Restart: `pm2 restart sales-display`. Watch logs for `[Backfill] Done: scanned=… inserted=…`. Duplicates are skipped using Slack message timestamps.

**Option B — one-shot CLI** (does not require restarting the server first; only needs `SLACK_BOT_TOKEN` + `SLACK_SALES_CHANNEL_ID`):

```bash
cd ~/sales-display
# Newest-first, cap at N messages (default 500 if omitted)
npx tsx src/server/slack-backfill-cli.ts 800
```

**Date range (UTC calendar days, inclusive):** imports only messages in that window (still capped by max messages).

```bash
# April 1–16, 2026 — up to 15,000 messages (default cap when using two date args)
npx tsx src/server/slack-backfill-cli.ts 2026-04-01 2026-04-16

# Same range with an explicit cap
npx tsx src/server/slack-backfill-cli.ts 20000 2026-04-01 2026-04-16
```

(First form: `max` optional, default 500 for a single numeric arg; two `YYYY-MM-DD` args default to 15,000 max messages.)

Backfill **does not** fire celebrations — it only fills SQLite. New live messages still behave as before.

### Demo bookings history (HubSpot channel)

Past demo notifications live in the same SQLite file as orders — **`data/sales.db`** — in the **`demo_bookings`** table (not in `sales`). Inspect with e.g. `sqlite3 data/sales.db ".schema demo_bookings"` or any SQLite GUI pointed at that file.

Requires **`SLACK_BOT_TOKEN`** and **`SLACK_DEMO_BOOKINGS_CHANNEL_ID`**. Uses the same **`BACKFILL_TIMEZONE`** rules as order backfill (calendar-day bounds).

```bash
cd ~/sales-display
# April 2026 (inclusive), interpreted in BACKFILL_TIMEZONE (default UTC)
npm run demo-bookings-backfill -- 2026-04-01 2026-04-30

# With explicit timezone for local April days:
BACKFILL_TIMEZONE=America/New_York npm run demo-bookings-backfill -- 2026-04-01 2026-04-30
```

No celebrations during import; duplicates are skipped by **`slack_ts`**. Restart the app or rely on the next **`dashboard:update`** / refresh to see leaderboard changes.

## Desktop app on the Pi (not a generic browser)

The UI is still built with web tech, but it runs in a **dedicated Electron window** (fullscreen / kiosk, no tabs, no address bar) so it feels like a normal desktop app. The Node server stays on **127.0.0.1:3000** on the same machine; Electron is just the shell (same pattern as Slack, VS Code, etc.).

- **Autostart:** `scripts/setup-pi.sh` installs `~/.config/autostart/sales-display.desktop`, which runs `npm run desktop` after login.
- **Manual:** with PM2 already running the API, open a terminal on the Pi and run:
  ```bash
  cd ~/sales-display && npm run desktop
  ```
- **Without Electron:** enable the fallback autostart file `sales-display-chromium.desktop` (set `Hidden=false` and `X-GNOME-Autostart-enabled=true`) and disable the Electron one — it uses `chromium-browser --app=http://127.0.0.1:3000` (minimal chrome, still not “localhost in a tabbed browser”).

**Dev on Mac:** `npm start` in one terminal, `npm run desktop` in another.

## Celebration Triggers

Configure which sales trigger celebrations in `.env`:

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

### Dashboard empty / no sales data

1. **API running:** on the Pi run `curl -s http://127.0.0.1:3000/api/health` — expect `{"status":"ok",...}`.
2. **Rows in the database:** `curl -s http://127.0.0.1:3000/api/stats` — check `totalSales`. If `0`, nothing has been parsed into SQLite yet.
3. **PM2 + logs:** `pm2 status` (process **online**), then `pm2 logs sales-display --lines 50`. You want `[Slack] Connected via Socket Mode`. When a matching message arrives you should see `[Slack] Parsed Slide order:` or `[Slack] Parsed sale:`.
4. **Channel ID:** `SLACK_SALES_CHANNEL_ID` must be the **exact** ID of the channel where Slide posts (public `C…`, private `G…`). Wrong ID = every message is ignored.
5. **Your bot in that channel:** run `/invite @YourSalesDisplayApp` in that channel (and in **`SLACK_DEMO_BOOKINGS_CHANNEL_ID`** if you use HubSpot demo posts — same bot, separate channel ID in `.env`).
6. **Import history:** if you only turned the app on recently, turn on `SLACK_BACKFILL_ON_START=true` (or run `npm run slack-backfill -- 500`) so past orders are loaded.
7. **Still nothing:** Slide may be using a Block Kit layout we don’t parse (e.g. `rich_text` only). Check logs for errors; you may need a sample message JSON to extend the parser.

### USB disco light (Raspberry Pi)

During a celebration the API can run **two shell commands**: one when the overlay starts (`CELEBRATION_USB_ON_CMD`) and one when it ends (`CELEBRATION_USB_OFF_CMD`), using the same timing as **`CELEBRATION_DURATION`** (and **Stop** on the kiosk turns the light off early via `celebration:dismiss`). Both variables must be set or USB control stays disabled.

Cheap USB party lights are often **always on when the port delivers power**. On a Pi you can sometimes switch that port with [**uhubctl**](https://github.com/mvp/uhubctl): `sudo apt install uhubctl`, then run **`sudo uhubctl`** (no arguments). **Only hub locations and ports printed there are valid** — copy the exact `-l` value (e.g. `2`, `1-1`, or on Pi 5 often `2`–`5`) and the port number; using a guess like `2-1` usually fails with *No compatible devices detected*. On **Raspberry Pi 4**, upstream docs often use **`uhubctl -l 2 -p 4`** or **`-l 1-1 -p 4`** for the internal hub (all Type-A ports may be **ganged**, so toggling one can affect every port — that is a hardware limit). Update **VL805** EEPROM if power switching does not work on Pi 4 (`sudo rpi-eeprom-update`). **Pi 5** uses a different USB layout; rely on your own `sudo uhubctl` output.

The Unix user running Node needs permission to run those commands (e.g. **sudoers** for passwordless `uhubctl`). If your light does not respond to port power cycling, use a relay or GPIO and point the env vars at your own scripts instead.
