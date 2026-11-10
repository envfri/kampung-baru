#!/usr/bin/env bash
# Ambil versi terbaru dari GitHub lalu build ulang tanpa menghapus data.
# Database di-backup dulu, jadi aman untuk kembali ke versi sebelumnya (lihat DEPLOY.md → Rollback).
set -euo pipefail
cd "$(dirname "$0")/.."

BEFORE="$(git -c safe.directory='*' rev-parse --short HEAD 2>/dev/null || echo '?')"
if docker compose ps --status running --services 2>/dev/null | grep -qx db; then
  echo "==> Backup database sebelum update"
  bash deploy/backup.sh
fi

echo "==> Ambil kode terbaru"
git pull --ff-only
export GIT_SHA="$(git -c safe.directory='*' rev-parse --short HEAD 2>/dev/null || true)"
if [ "$GIT_SHA" = "$BEFORE" ]; then echo "    sudah versi terbaru ($GIT_SHA), tetap build ulang"; fi

echo "==> Build & jalankan commit ${GIT_SHA:-?} (sebelumnya $BEFORE)"
docker compose up -d --build
docker image prune -f >/dev/null

OK=0
for i in $(seq 1 40); do
  if docker compose exec -T app wget -qO- http://127.0.0.1:8787/healthz >/dev/null 2>&1; then OK=1; break; fi
  sleep 3
done
if [ "$OK" = "1" ]; then
  echo "==> Sehat. Versi berjalan: $(docker compose exec -T app wget -qO- http://127.0.0.1:8787/api/version 2>/dev/null || echo '?')"
else
  echo "!! Server belum sehat setelah 2 menit. Cek: docker compose logs app --tail 100"
  echo "   Kembali ke versi sebelumnya: lihat DEPLOY.md → Rollback (commit sebelumnya: $BEFORE)"
  exit 1
fi
docker compose ps
