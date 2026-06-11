# Despliegue en Hetzner — Tilestudio multi-cliente

Un único VPS de Hetzner Cloud corre **una instancia de Tilestudio por cliente**,
cada una con su contenedor, su base de datos y su carpeta de media. Caddy hace
de reverse proxy (con TLS automático cuando hay dominio) y Postgres 17 aloja
una BD por cliente.

```
Internet ──► Caddy ──► app-helvagres ─┐
   (80/443)       ──► app-cliente2  ─┼──► Postgres 17 (una BD por cliente)
                  ──► ...           ─┘
```

## Layout en el servidor (`/opt/tilestudio`)

```
/opt/tilestudio/
├── docker-compose.yml      # caddy + postgres + include de clientes
├── Caddyfile               # importa sites/*.caddy
├── sites/<slug>.caddy      # ruta del proxy de cada cliente
├── .env                    # POSTGRES_PASSWORD, PUBLIC_HOST
├── shared.env              # keys de IA compartidas (OpenAI, Gemini)
├── clients/<slug>/
│   ├── compose.yml         # servicio app-<slug>
│   ├── .env                # PAYLOAD_SECRET, DATABASE_URI, URL pública
│   └── media/              # archivos subidos (volumen persistente)
├── add-client.sh           # alta de cliente nuevo
├── build-on-server.sh      # rebuild de imagen + redeploy
├── backup.sh               # cron diario 04:00, conserva 7 días
└── backups/
```

## El Hub (panel de gestión)

`hub/` es un panel web (servicio `hub` del compose, definido en
`hub-compose.yml`) desde el que se hace todo sin terminal: alta/baja de
clientes con usuario admin automático, dominios con DNS en IONOS,
logs, reinicios y rebuilds. Acceso protegido por contraseña
(`HUB_PASSWORD_HASH` bcrypt en `/opt/tilestudio/hub.env`). La integración
DNS se configura desde el propio hub (Ajustes → DNS y dominio).

## Operaciones frecuentes

| Qué | Cómo |
|---|---|
| Casi todo | El Hub: `https://hub.<dominio>` (o `https://hub.<IP>.sslip.io` sin dominio) |
| Desplegar código nuevo | `.\deploy\deploy.ps1` (desde tu Windows) |
| Alta de cliente (manual) | `ssh root@IP` → `cd /opt/tilestudio && ./add-client.sh <slug> [dominio]` |
| Logs de un cliente | `docker compose logs -f app-<slug>` |
| Reiniciar un cliente | `docker compose restart app-<slug>` |
| Conectar a una BD | `docker compose exec postgres psql -U postgres tilestudio_<slug>` |
| Backup manual | `./backup.sh` |
| Estado general | `docker compose ps` |

La clave SSH es `~/.ssh/tilestudio_hetzner` (usuario `root`).

## Dominios

El DNS se gestiona en **IONOS** (donde está registrado el dominio) a través
de su API (`hub/lib/ionos.js`), configurada desde el hub en «DNS y dominio»
(dominio base + API key de developer.hosting.ionos.es).

- **Sin dominio configurado:** cada cliente responde en
  `http://<slug>.<IP>.sslip.io` (sslip.io resuelve cualquier subdominio a la
  IP embebida — no hay que configurar nada).
- **Con el dominio base configurado:** el alta desde el hub crea
  automáticamente el registro `A` de `<slug>.<dominio>` en IONOS y Caddy
  emite el certificado Let's Encrypt solo. El cambio de dominio de un
  cliente existente se hace desde el hub («Más → Aplicar dominio»).
- **Dominio propio del cliente:** el cliente apunta un registro `A` de su
  dominio a nuestra IP; desde el hub se le asigna ese dominio y Caddy emite
  el certificado.

## Escalado

Con 4 GB de RAM (CX22) caben ~3-5 clientes activos. Cuando se quede corto:
**Hetzner Console → servidor → Rescale** (subir a CX32/CX42 sin migrar nada;
requiere un reinicio). A partir de ~10 clientes, plantearse separar Postgres
o un segundo servidor.

## Provisionado de un servidor nuevo

1. Crear servidor en Hetzner (Ubuntu 24.04) con `cloud-init.yaml` como
   user-data y la clave SSH `tilestudio_hetzner`.
2. Copiar `docker-compose.yml`, `hub-compose.yml`, `Caddyfile` y los `.sh` a
   `/opt/tilestudio/`.
3. Crear `/opt/tilestudio/.env` (POSTGRES_PASSWORD, PUBLIC_HOST),
   `shared.env` (keys de IA) y `hub.env` (HUB_PASSWORD_HASH bcrypt,
   HUB_SESSION_SECRET, SERVER_IP) — sin `hub.env` compose no arranca.
4. `docker compose up -d caddy postgres`
5. `.\deploy\deploy.ps1` para construir las imágenes (app + hub).
6. `docker compose up -d hub` y crear `sites/hub.caddy`.
7. Altas de clientes desde el hub (o `./add-client.sh <slug>`).
