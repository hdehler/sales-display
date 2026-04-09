# Sales display — shortcuts for common commands
# Usage: make help | make start | make dev | …

.PHONY: help run install build setup start dev desktop slack-backfill clean stats pm2-restart pm2-logs

.DEFAULT_GOAL := help

help:
	@echo "Sales display"
	@echo ""
	@echo "  make run              ONE COMMAND: build if needed, API + Electron window"
	@echo "        (same as: npm run start:all  after a build)"
	@echo ""
	@echo "  make install          Install npm dependencies"
	@echo "  make build            Build the production client (Vite → dist/client)"
	@echo "  make setup            install + build (same as npm run setup)"
	@echo "  make start            API only (http://localhost:3000) — use with PM2 on Pi"
	@echo "  make dev              Dev mode: hot-reload server + Vite (browser)"
	@echo "  make desktop          Electron only (API must already be running)"
	@echo "  make slack-backfill   Import Slack channel history (optional: N=800)"
	@echo "  make stats            curl /api/stats (server must be running)"
	@echo "  make clean            Remove dist/client"
	@echo ""
	@echo "Pi / PM2 (if installed):"
	@echo "  make pm2-restart      pm2 restart sales-display"
	@echo "  make pm2-logs         pm2 logs sales-display --lines 80"
	@echo ""
	@echo "  On the Pi with desktop: you can also  make run  (or keep PM2 + autostart)."

run:
	@test -f dist/client/index.html || $(MAKE) build
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

# Default 500 messages; override: make slack-backfill N=800
slack-backfill:
	npm run slack-backfill -- $(or $(N),500)

clean:
	rm -rf dist/client

stats:
	@curl -sf http://127.0.0.1:3000/api/stats || (echo "Server not reachable (run make start first?)"; exit 1)

pm2-restart:
	pm2 restart sales-display

pm2-logs:
	pm2 logs sales-display --lines 80
