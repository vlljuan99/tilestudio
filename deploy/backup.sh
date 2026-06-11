#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Backup diario (cron a las 04:00): dump de todas las BDs + media de clientes.
# Conserva 7 días en /opt/tilestudio/backups.
# ----------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups

STAMP=$(date +%F)
docker compose exec -T postgres pg_dumpall -U postgres | gzip > "backups/pg-$STAMP.sql.gz"
tar -czf "backups/media-$STAMP.tar.gz" clients/*/media 2>/dev/null || true
find backups -name '*.gz' -mtime +7 -delete
