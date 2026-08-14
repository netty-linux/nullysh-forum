#!/usr/bin/env bash
set -euo pipefail
export PATH="/home/netty/.local/bin:/usr/local/bin:/usr/bin:/bin"
export XDG_CONFIG_HOME="/mnt/c/Users/01 Bigode/AppData/Roaming/xdg.config"
cd /home/netty/nullysh-forum-build
WR="./node_modules/.bin/wrangler"

echo "==> D1 migration 002_nullpass_entitlements"
$WR d1 execute nullysh-forum-db --remote --file=migrations/d1/002_nullpass_entitlements.sql

echo "==> Verify nullpass tables"
$WR d1 execute nullysh-forum-db --remote --json \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'nullpass%';"

rm -f /tmp/nullysh-matrix-hmac.raw
echo "D1_OK"
