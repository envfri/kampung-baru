#!/usr/bin/env bash
# Ambil versi terbaru dari GitHub lalu build ulang tanpa menghapus data.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
export GIT_SHA="$(git -c safe.directory='*' rev-parse --short HEAD 2>/dev/null || true)"
echo "Membangun versi commit ${GIT_SHA:-?}"
docker compose up -d --build
docker image prune -f >/dev/null
docker compose ps
