#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Pipeline de despliegue con bookkeeping: ejecuta build-on-server.sh anotando
# estado y log en deploys/<id>.* para que el hub y GitHub Actions lo puedan
# monitorizar.
#
# El hub lo lanza en un CONTENEDOR HERMANO (docker run con el socket montado),
# no dentro del propio hub: así el deploy sobrevive cuando `compose up -d`
# recrea el contenedor del hub con la imagen nueva.
#
# Uso: deploy-on-server.sh <deploy-id>
# ----------------------------------------------------------------------------
set -uo pipefail
cd "$(dirname "$0")"

ID="${1:?Uso: deploy-on-server.sh <deploy-id>}"
case "$ID" in
  *[!a-zA-Z0-9_-]*) echo "deploy-id inválido: $ID"; exit 1 ;;
esac

mkdir -p deploys
LOG="deploys/$ID.log"
echo running > "deploys/$ID.status"

(
  set -e
  echo "== Deploy $ID — $(date -u '+%F %T UTC') =="

  # El tar nuevo trae versiones nuevas de los scripts del servidor: se
  # sincronizan ANTES del build. mv = rename atómico, no corrompe este mismo
  # script mientras se ejecuta.
  if [[ -f src.tar.gz ]]; then
    rm -rf .deploy-scripts && mkdir .deploy-scripts
    tar -xzf src.tar.gz -C .deploy-scripts deploy || true
    for f in build-on-server.sh add-client.sh backup.sh deploy-on-server.sh; do
      if [[ -f ".deploy-scripts/deploy/$f" ]]; then
        tr -d '\r' < ".deploy-scripts/deploy/$f" > "$f.new"
        chmod +x "$f.new"
        mv "$f.new" "$f"
      fi
    done
    if [[ -f .deploy-scripts/deploy/hub-compose.yml ]]; then
      tr -d '\r' < .deploy-scripts/deploy/hub-compose.yml > hub-compose.yml.new
      mv hub-compose.yml.new hub-compose.yml
    fi
    rm -rf .deploy-scripts
  fi

  bash build-on-server.sh
) >> "$LOG" 2>&1
rc=$?

date -u '+%FT%TZ' > "deploys/$ID.finished"
if [[ $rc -eq 0 ]]; then
  echo success > "deploys/$ID.status"
  echo "== DEPLOY OK ==" >> "$LOG"
else
  echo error > "deploys/$ID.status"
  echo "== DEPLOY FALLÓ (rc=$rc) ==" >> "$LOG"
fi
exit $rc
