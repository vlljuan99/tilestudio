#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Reconstruye la imagen tilestudio:latest desde src.tar.gz (subido por
# deploy.ps1 o por el endpoint /api/deploy del hub), sincroniza el esquema de
# BD de cada cliente y recrea los contenedores con la imagen nueva.
# Se ejecuta EN el servidor.
# ----------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

[[ -f src.tar.gz ]] || { echo "Falta src.tar.gz — súbelo con deploy.ps1 o vía GitHub Actions"; exit 1; }

rm -rf src && mkdir src
tar -xzf src.tar.gz -C src

docker build -t tilestudio:latest src

# El hub se construye aparte (imagen pequeña; .dockerignore lo excluye de la app)
if [[ -d src/hub ]]; then
  docker build -t tilestudio-hub:latest src/hub
fi

# Sincroniza el esquema de Postgres de CADA cliente con la imagen nueva.
# Sin esto, un campo nuevo en una colección rompe el admin en producción
# (Payload solo hace push de esquema en dev). Si no hay cambios, es un no-op.
# Los servicios registrados en compose son la fuente de verdad (en clients/
# quedan directorios _deleted-* de bajas que ya no tienen servicio).
for svc in $(docker compose config --services | grep '^app-' || true); do
  echo "== Sincronizando esquema de BD: ${svc#app-} =="
  docker compose run --rm --no-deps "$svc" npm run db:push
done

# `up -d` recrea solo los contenedores cuya imagen ha cambiado
docker compose up -d --remove-orphans
docker image prune -f >/dev/null

echo "✔ Imagen reconstruida, esquemas sincronizados y clientes actualizados"
