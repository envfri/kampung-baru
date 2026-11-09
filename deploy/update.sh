#!/usr/bin/env bash
# Ambil versi terbaru dari GitHub lalu build ulang tanpa menghapus data.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
docker compose ps
