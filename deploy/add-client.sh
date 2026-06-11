#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Alta de un cliente nuevo de Tilestudio (se ejecuta EN el servidor).
#
# Uso: ./add-client.sh <slug> [dominio]
#   slug    — identificador corto en minúsculas (ej: helvagres)
#   dominio — opcional. Si se pasa (ej: catalogo.helvagres.es), Caddy emite
#             TLS automático. Si no, queda en http://<slug>.$PUBLIC_HOST
#
# Crea: base de datos propia, .env con secretos, contenedor y ruta en Caddy.
# ----------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

SLUG="${1:?Uso: ./add-client.sh <slug> [dominio]}"
DOMAIN="${2:-}"

[[ "$SLUG" =~ ^[a-z0-9-]+$ ]] || { echo "Slug inválido: solo a-z, 0-9 y guiones"; exit 1; }

source .env # POSTGRES_PASSWORD, PUBLIC_HOST

DB="tilestudio_${SLUG//-/_}"
DIR="clients/$SLUG"

[[ -d "$DIR" ]] && { echo "El cliente $SLUG ya existe ($DIR)"; exit 1; }
mkdir -p "$DIR/media"
# La app corre como uid 1001 (usuario nextjs de la imagen); sin esto el
# bind-mount queda en manos de root y las subidas fallan con EACCES.
chown -R 1001:1001 "$DIR/media"

# 1. Base de datos propia del cliente
docker compose exec -T postgres psql -U postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1 ||
  docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE $DB"

# 2. URL pública
if [[ -n "$DOMAIN" ]]; then
  URL="https://$DOMAIN"
  SITE="$DOMAIN"
else
  URL="http://$SLUG.$PUBLIC_HOST"
  SITE="http://$SLUG.$PUBLIC_HOST"
fi

# 3. Variables de entorno del cliente (las keys de IA van en shared.env)
cat > "$DIR/.env" <<EOF
PAYLOAD_SECRET=$(openssl rand -base64 32)
DATABASE_URI=postgres://postgres:$POSTGRES_PASSWORD@postgres:5432/$DB?sslmode=disable
NEXT_PUBLIC_SERVER_URL=$URL
PORT=3000
EOF

# 4. Servicio de compose (rutas relativas a este archivo, por `include:`)
cat > "$DIR/compose.yml" <<EOF
services:
  app-$SLUG:
    image: tilestudio:latest
    restart: unless-stopped
    env_file:
      - ../../shared.env
      - .env
    volumes:
      - ./media:/app/media
EOF

# 5. Registrarlo en el include: del compose principal
grep -q "^include:" docker-compose.yml || printf '\ninclude:\n' >> docker-compose.yml
grep -q "$DIR/compose.yml" docker-compose.yml ||
  sed -i "/^include:/a\\  - $DIR/compose.yml" docker-compose.yml

# 6. Sincronizar el esquema de Payload en la BD nueva.
#    En producción Payload NO hace push automático del esquema; db-push.ts
#    fuerza NODE_ENV=development solo durante esta sincronización inicial.
docker compose run --rm --no-deps "app-$SLUG" npm run db:push

# 7. Ruta en Caddy
mkdir -p sites
cat > "sites/$SLUG.caddy" <<EOF
$SITE {
	encode gzip
	reverse_proxy app-$SLUG:3000
}
EOF

# Con dominio propio, la URL de staging (por IP, sin DNS) sigue sirviendo
if [[ -n "$DOMAIN" ]]; then
  cat >> "sites/$SLUG.caddy" <<EOF

http://$SLUG.$PUBLIC_HOST {
	encode gzip
	reverse_proxy app-$SLUG:3000
}
EOF
fi

# 8. Arrancar contenedor y recargar proxy
docker compose up -d "app-$SLUG"
docker compose exec -w /etc/caddy caddy caddy reload

echo ""
echo "✔ Cliente '$SLUG' desplegado en $URL"
echo "  → Entra en $URL/admin para crear el usuario administrador."
