# Sales display — shortcuts for common commands
# Usage: make help | make start | make dev | …

.PHONY: help local local-reset pull-pi sim-order sim-demo test run install build setup start dev desktop desktop-pi slack-backfill clean stats pm2-restart pm2-logs pm2-stop pm2-status

.DEFAULT_GOAL := help

help:
	@echo "Sales display"
	@echo ""
	@echo "  --- Pick ONE way to run the API (never two at once) ---"
	@echo ""
	@echo "  A) Pi with PM2 (recommended):"
	@echo "       pm2 start ecosystem.config.cjs   # once, then pm2 saves on boot"
	@echo "       make pm2-restart                 # after code/.env changes"
	@echo "       make desktop                     # open Electron (API already on :3000)"
	@echo "       # or rely on autostart for Electron"
	@echo ""
	@echo "  B) Manual / dev (no PM2 on port 3000):"
	@echo "       make pm2-stop                    # stop PM2 first if you use it!"
	@echo "       make run                         # API + Electron together"
	@echo ""
	@echo "  --- Local testing (no Pi, no Slack) ---"
	@echo "  make pull-pi          copy the Pi's Team, songs and orders here (PI=salesdisplay)"
	@echo "  make local            hot-reload app at http://localhost:5173, Slack off, fake DWH"
	@echo "                        (REAL_BQ=1 uses BigQuery; needs GOOGLE_APPLICATION_CREDENTIALS)"
	@echo "  make sim-order ACCOUNT=\"Grissom Technology\" [NEW=1]   fake Slide order (NEW=1: first order -> AE)"
	@echo "  make sim-demo BDR=\"Jane Doe\" [COMPANY=Acme]           fake HubSpot demo booking"
	@echo "  make local-reset      reset data/local.db to the last Pi pull (or empty)"
	@echo "  make test             attribution + walk-up song checks"
	@echo ""
	@echo "  make run              build if needed, then API + Electron (needs :3000 free)"
	@echo ""
	@echo "  make install          Install npm dependencies"
	@echo "  make build            Build the production client (Vite → dist/client)"
	@echo "  make setup            install + build (same as npm run setup)"
	@echo "  make start            API only (http://localhost:3000) — use with PM2 on Pi"
	@echo "  make dev              Dev mode: hot-reload server + Vite (browser)"
	@echo "  make desktop          Electron (Linux SSH: auto DISPLAY=:0 if unset)"
	@echo "  make desktop-pi       alias for make desktop"
	@echo "  make slack-backfill   Import Slack history (N=500 default). For a month use npm run slack-backfill -- YYYY-MM-DD YYYY-MM-DD"
	@echo "  make stats            curl /api/stats (server must be running)"
	@echo "  make clean            Remove dist/client"
	@echo ""
	@echo "Pi / PM2:"
	@echo "  make pm2-status       pm2 status"
	@echo "  make pm2-stop         pm2 stop sales-display  (frees port 3000)"
	@echo "  make pm2-restart      pm2 restart sales-display"
	@echo "  make pm2-logs         pm2 logs sales-display --lines 80"

run:
	@test -f dist/client/index.html || $(MAKE) build
	@if command -v fuser >/dev/null 2>&1 && fuser -s 3000/tcp 2>/dev/null; then \
		echo ""; echo "Port 3000 is busy (usually PM2). Run:  make pm2-stop   then try again."; echo "Or keep PM2 and only run:  make desktop"; echo ""; exit 1; \
	fi
	npm run start:all

# ── Local testing ─────────────────────────────────────────
# Slack stays off (the Pi's app token would split live events with the Pi), the DB is
# data/local.db, and DWH owners come from dev/mock-owners.json unless REAL_BQ=1.
LOCAL_DB ?= data/local.db
SIM_URL ?= http://127.0.0.1:3000/api/dev/simulate
LOCAL_ENV = SLACK_DISABLED=1 ENABLE_DEV_ENDPOINTS=1 SALES_DB_PATH=$(LOCAL_DB) \
	$(if $(REAL_BQ),,BIGQUERY_MOCK_OWNERS_FILE=dev/mock-owners.json)

local:
	$(LOCAL_ENV) npm run dev

local-reset:
	rm -f $(LOCAL_DB) $(LOCAL_DB)-wal $(LOCAL_DB)-shm
	@if [ -f data/pi-snapshot.db ]; then cp data/pi-snapshot.db $(LOCAL_DB) && echo "Reset to last Pi pull"; else echo "Reset to empty"; fi

pull-pi:
	sh scripts/pull-pi.sh

sim-order:
	@test -n "$(ACCOUNT)" || (echo 'Usage: make sim-order ACCOUNT="Grissom Technology" [NEW=1]'; exit 1)
	@node -e 'fetch(process.argv[1], {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({account: process.argv[2], newBuyingPartner: process.argv[3] === "1"})}).then(r => r.json()).then(j => console.log(JSON.stringify(j, null, 2)), e => {console.error("Is make local running?", e.message); process.exit(1)})' "$(SIM_URL)/order" "$(ACCOUNT)" "$(NEW)"

sim-demo:
	@test -n "$(BDR)" || (echo 'Usage: make sim-demo BDR="Jane Doe" [COMPANY=Acme]'; exit 1)
	@node -e 'fetch(process.argv[1], {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({bdr: process.argv[2], company: process.argv[3]})}).then(r => r.json()).then(j => console.log(JSON.stringify(j, null, 2)), e => {console.error("Is make local running?", e.message); process.exit(1)})' "$(SIM_URL)/demo" "$(BDR)" "$(COMPANY)"

test:
	npm test

install:
	npm install

build:
	npm run build

setup: install build

start:
	npm run start

dev:
	npm run dev

desktop:
	npm run desktop

desktop-pi: desktop

# Default: newest 500 channel messages only. For a date range (full pagination + threads), use:
#   npm run slack-backfill -- 2026-04-01 2026-04-16
slack-backfill:
	npm run slack-backfill -- $(or $(N),500)

clean:
	rm -rf dist/client

stats:
	@curl -sf http://127.0.0.1:3000/api/stats || (echo "Server not reachable (run make start first?)"; exit 1)

pm2-restart:
	pm2 restart sales-display

pm2-stop:
	pm2 stop sales-display

pm2-status:
	pm2 status

pm2-logs:
	pm2 logs sales-display --lines 80

deploy:
	cd ~/sales-display && git pull && npm run build && fuser -k 3000/tcp; sleep 1 && npm run start:all