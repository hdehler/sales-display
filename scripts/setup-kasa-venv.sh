#!/usr/bin/env bash
# Create a project-local venv for python-kasa (Raspberry Pi OS / Debian block system pip — PEP 668).
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -d .venv-kasa ]]; then
  python3 -m venv .venv-kasa
fi
.venv-kasa/bin/pip install -U pip
.venv-kasa/bin/pip install -r requirements-kasa.txt
echo ""
echo "Add to .env (adjust path if repo is not ~/sales-display):"
echo "  KASA_PYTHON_BIN=$(pwd)/.venv-kasa/bin/python"
echo ""
