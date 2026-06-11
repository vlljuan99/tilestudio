#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Reconstruye la imagen tilestudio:latest desde src.tar.gz (subido por
# deploy.ps1) y recrea los contenedores de clientes con la imagen nueva.
# Se ejecuta EN el servidor.
# ----------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

[[ -f src.tar.gz ]] || { echo "Falta src.tar.gz — súbelo con deploy.ps1"; exit 1; }

rm -rf src && mkdir src
tar -xzf src.tar.gz -C src

docker build -t tilestudio:latest src

# `up -d` recrea solo los contenedores cuya imagen ha cambiado
docker compose up -d --remove-orphans
docker image prune -f >/dev/null

echo "✔ Imagen reconstruida y clientes actualizados"
