#!/usr/bin/env bash
# Pulihkan database dari file backup (MENIMPA semua data saat ini).
# Pakai:  bash deploy/restore.sh backups/bupi-YYYYMMDD-HHMMSS.sql.gz
set -euo pipefail
cd "$(dirname "$0")/.."
FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Pakai: bash deploy/restore.sh backups/bupi-YYYYMMDD-HHMMSS.sql.gz"
  echo "Backup yang ada:"; ls -1t backups/bupi-*.sql.gz 2>/dev/null | head -10 || echo "  (belum ada)"
  exit 1
fi
echo "Ini akan MENGGANTI seluruh database dengan isi $FILE."
read -r -p "Ketik PULIHKAN untuk lanjut: " OKAY
[ "$OKAY" = "PULIHKAN" ] || { echo "Dibatalkan."; exit 1; }

echo "==> Backup kondisi sekarang dulu (jaga-jaga)"
bash deploy/backup.sh
echo "==> Hentikan aplikasi"
docker compose stop app
echo "==> Kosongkan & pulihkan database"
docker compose exec -T db psql -U kb -d postgres -v ON_ERROR_STOP=1 -c "drop database if exists bupi with (force)" -c "create database bupi owner kb"
gunzip -c "$FILE" | docker compose exec -T db psql -U kb -d bupi -v ON_ERROR_STOP=1 -q
echo "==> Jalankan lagi aplikasi"
docker compose start app
echo "Selesai. Cek admin → Versi & changelog dan https://<domain>/healthz"
