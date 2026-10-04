#!/usr/bin/env sh
# Redeploy the portal on a VPS: pull main, rebuild images, restart.
# Usage: scripts/deploy.sh [branch]   (default: main)
set -eu
cd "$(dirname "$0")/.."
branch="${1:-main}"
git fetch -q origin "$branch" && git checkout -q "$branch" && git reset -q --hard "origin/$branch"
files="-f docker-compose.yml"
[ -n "${EDGE_NETWORK:-}" ] || grep -q '^EDGE_NETWORK=' .env 2>/dev/null && files="$files -f docker-compose.traefik.yml"
# shellcheck disable=SC2086
docker compose $files up -d --build --remove-orphans
docker image prune -f >/dev/null
docker compose ps
