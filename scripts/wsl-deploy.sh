#!/usr/bin/env bash
# Build + deploy OpenNext no WSL (Linux). Evita bug de chunks do OpenNext no Windows.
set -euo pipefail

export PATH="/home/netty/.local/bin:/usr/local/bin:/usr/bin:/bin"
export XDG_CONFIG_HOME="/mnt/c/Users/01 Bigode/AppData/Roaming/xdg.config"

SRC="/mnt/d/Nullysh.DEV/NULLYSH-FORUM/nullysh-forum"
DEST="/home/netty/nullysh-forum-build"

echo "==> Sync source → $DEST"
mkdir -p "$DEST"
rsync -a --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .open-next \
  --exclude .git \
  --exclude data/media \
  --exclude design-audit \
  --exclude .playwright-mcp \
  "$SRC/" "$DEST/"

cd "$DEST"
echo "node: $(which node) $(node -v)"

if [[ ! -d node_modules ]]; then
  echo "==> npm install"
  npm install
else
  echo "==> npm install (update)"
  npm install
fi

echo "==> OpenNext build"
npx opennextjs-cloudflare build

echo "==> Deploy"
./node_modules/.bin/wrangler deploy

echo "DEPLOY_OK → https://nullysh-forum.ngdigitalsuporte.workers.dev"
