#!/usr/bin/env bash
# Dump database ke ./backups (dikompres), simpan 14 hari terakhir.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
FILE="backups/kampungbulu-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T db pg_dump -U kb -d kampungbulu | gzip > "$FILE"
find backups -name 'kampungbulu-*.sql.gz' -mtime +14 -delete 2>/dev/null || true
echo "backup: $FILE ($(du -h "$FILE" | cut -f1))"
