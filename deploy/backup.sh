#!/usr/bin/env bash
# Dump database ke ./backups (dikompres), simpan 14 hari terakhir.
# Ditulis ke file sementara dulu: bila dump gagal, tidak ada file backup rusak/kosong yang tertinggal.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
FILE="backups/bupi-$(date +%Y%m%d-%H%M%S).sql.gz"
# dua backup di detik yang sama (mis. restore.sh tepat setelah backup) tidak saling menimpa
[ -e "$FILE" ] && FILE="${FILE%.sql.gz}-$$.sql.gz"
TMP="$FILE.part"
trap 'rm -f -- "$TMP"' EXIT
docker compose exec -T db pg_dump -U kb -d bupi | gzip > "$TMP"
# dump yang sah selalu memuat penanda akhir dari pg_dump
gunzip -c "$TMP" | tail -n 20 | grep -q "PostgreSQL database dump complete" || { echo "!! backup tidak lengkap, dibatalkan" >&2; exit 1; }
mv -- "$TMP" "$FILE"
find backups -name 'bupi-*.sql.gz' -mtime +14 -delete 2>/dev/null || true
echo "backup: $FILE ($(du -h "$FILE" | cut -f1))"
