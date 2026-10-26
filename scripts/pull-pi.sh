#!/usr/bin/env sh
# Copy the Pi's database (Team, walk-up songs, orders) and uploaded sounds to this machine so
# `make local` tests against real rep names and songs. Read-only on the Pi apart from a temp file.
#   PI=salesdisplay PI_DIR=sales-display sh scripts/pull-pi.sh
set -e
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
PI="${PI:-salesdisplay}"
PI_DIR="${PI_DIR:-sales-display}"
SNAP=/tmp/sales-display-snapshot.db

# better-sqlite3 backup gives a consistent copy while PM2 has the WAL-mode DB open.
ssh -o BatchMode=yes "$PI" "cd $PI_DIR && node -e \"require('better-sqlite3')('data/sales.db').backup('$SNAP').then(() => console.log('snapshot ok'))\""
mkdir -p "$ROOT/data"
scp -q "$PI:$SNAP" "$ROOT/data/pi-snapshot.db"
ssh -o BatchMode=yes "$PI" "rm -f $SNAP"

rsync -a "$PI:$PI_DIR/public/sounds/" "$ROOT/public/sounds/"

rm -f "$ROOT/data/local.db" "$ROOT/data/local.db-wal" "$ROOT/data/local.db-shm"
cp "$ROOT/data/pi-snapshot.db" "$ROOT/data/local.db"
echo "Pulled Pi data into data/local.db (pristine copy: data/pi-snapshot.db) and public/sounds/"
