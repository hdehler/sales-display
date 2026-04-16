# Sales display — shortcuts for common commands
# Usage: make help | make start | make dev | …

.PHONY: help run install build setup start dev desktop desktop-pi slack-backfill clean stats pm2-restart pm2-logs pm2-stop pm2-status

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