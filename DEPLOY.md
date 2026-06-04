# Despliegue en Heroku

Guía paso a paso para desplegar Tilestudio en Heroku con Docker, Postgres y
Cloudflare R2 para los archivos.

## Stack

- **App** → Heroku Container Runtime (Docker)
- **DB** → Heroku Postgres `essential-0` (~5 $/mes)
- **Media** → Cloudflare R2 (10 GB **gratis**)
- **IA** → tus keys de OpenAI/Gemini

Coste estimado: **~5–7 $/mes** (solo el Postgres + el dyno; R2 gratis hasta
10 GB).

---

## Pre-requisitos

- `heroku` CLI instalado y logueado (`heroku login`)
- Cuenta de [Cloudflare](https://dash.cloudflare.com) (gratuita)
- Repo conectado a Heroku (lo configuramos abajo)

---

## 1. (Opcional) Borrar la app vieja

```powershell
heroku apps:destroy huan-commerce-staging --confirm huan-commerce-staging
```

## 2. Crear la app nueva con stack container

```powershell
# Cambia el nombre por el que quieras
heroku apps:create tilestudio-staging --stack container --region eu
```

Si el nombre está cogido, prueba `tilestudio-helvagres` o lo que prefieras.

## 3. Provisionar Heroku Postgres

```powershell
heroku addons:create heroku-postgresql:essential-0 --app tilestudio-staging
```

Esto inyecta automáticamente `DATABASE_URL` (postgres://…) como config var.

## 4. Crear bucket en Cloudflare R2

1. Entra a [dash.cloudflare.com/r2](https://dash.cloudflare.com/?to=/:account/r2)
2. **R2 → Create bucket** → nombre `tilestudio-media` (o el que quieras)
3. En el bucket, pestaña **Settings → Public Access**:
   - Activa "Custom Domains" si quieres tu propio dominio, **o**
   - Activa "R2.dev subdomain" para obtener una URL `https://pub-xxxxx.r2.dev`
4. **R2 → Manage R2 API Tokens → Create API Token**:
   - Permissions: **Object Read & Write**
   - Bucket: solo `tilestudio-media` (más seguro)
   - Crea y **guarda** Access Key ID + Secret Access Key (no se vuelven a mostrar)
5. Apunta también el **Account ID** que sale arriba a la derecha en R2 — lo
   necesitas para el endpoint.

## 5. Configurar variables de entorno

```powershell
heroku config:set `
  PAYLOAD_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")" `
  NEXT_PUBLIC_SERVER_URL="https://tilestudio-staging.herokuapp.com" `
  OPENAI_API_KEY="sk-proj-..." `
  GOOGLE_API_KEY="AQ..." `
  AI_PROVIDER="gemini" `
  AI_VISION_PROVIDER="openai" `
  S3_BUCKET="tilestudio-media" `
  S3_ENDPOINT="https://<TU_ACCOUNT_ID>.r2.cloudflarestorage.com" `
  S3_ACCESS_KEY_ID="<R2_ACCESS_KEY>" `
  S3_SECRET_ACCESS_KEY="<R2_SECRET>" `
  S3_PUBLIC_URL="https://pub-xxxxx.r2.dev" `
  S3_REGION="auto" `
  --app tilestudio-staging
```

Sustituye:
- `<TU_ACCOUNT_ID>` por el Account ID de Cloudflare
- `<R2_ACCESS_KEY>` y `<R2_SECRET>` por los del token que creaste
- `S3_PUBLIC_URL` por el subdominio R2.dev (o tu dominio si configuraste uno)

> **DATABASE_URL** la inyecta Heroku Postgres automáticamente, no la pongas tú.

## 6. Conectar el repo y desplegar

Si aún no lo has hecho:

```powershell
git remote add heroku https://git.heroku.com/tilestudio-staging.git
```

Asegúrate de que tienes los archivos en la rama:

```powershell
git status
git add Dockerfile heroku.yml .dockerignore src/payload.config.ts src/lib/ DEPLOY.md
git commit -m "feat: deploy config (Docker + Postgres + R2)"
git push heroku main   # o `master` según tu rama
```

El primer build tarda 5-8 min. Verás en logs cómo descarga Sharp + canvas y
hace `next build`.

## 7. Crear el primer usuario admin

Cuando termine el deploy:

```powershell
heroku open --app tilestudio-staging
```

Ve a `/admin` y rellena el formulario del primer usuario. Listo, ya tienes
acceso al panel.

## 8. Probar el flujo entero

1. **Configurar paleta y branding** → Configuración → Apariencia → sube tu logo
   → "Sugerir paleta desde el logo".
2. **Subir un catálogo PDF** desde el menú "Catálogos importados".
3. Ver los azulejos en `/catalogo`.
4. Probar el simulador IA con una foto.

---

## Mantenimiento

| Cosa | Comando |
|---|---|
| Ver logs en vivo | `heroku logs --tail --app tilestudio-staging` |
| Reiniciar dynos | `heroku ps:restart --app tilestudio-staging` |
| Ver config vars | `heroku config --app tilestudio-staging` |
| Cambiar una var | `heroku config:set CLAVE=valor --app tilestudio-staging` |
| Conectar a la BD | `heroku pg:psql --app tilestudio-staging` |
| Backup de la BD | `heroku pg:backups:capture --app tilestudio-staging` |
| Descargar backup | `heroku pg:backups:download --app tilestudio-staging` |
| SSH al dyno | `heroku ps:exec --app tilestudio-staging` |
| Ver uso/coste | `heroku ps --app tilestudio-staging` |

## Solución de problemas

**El healthcheck de Heroku falla y reinicia el dyno:**
- Mira `heroku logs --tail`. Casi siempre es `DATABASE_URL` no llegó (¿provisionaste el add-on?) o conexión SSL mal.

**Las imágenes se ven rotas o devuelven 403:**
- Tu R2 bucket no tiene acceso público activado. Revisa **R2 → bucket → Settings → Public Access**. Activa el subdominio R2.dev y vuelve a poner `S3_PUBLIC_URL` con esa URL.

**Build falla con `Could not load the "sharp" module`:**
- Sharp 0.32 está pinned para Payload. Si Heroku te dice que el binario falta, asegúrate de que en el Dockerfile usas `node:20-bookworm-slim` (no Alpine).

**Build muy lento (>10 min) y al final timeout:**
- Heroku tiene timeout de 15 min para el build. Si es un build inicial y tarda mucho, probablemente está compilando `@napi-rs/canvas` desde fuente — eso significa que el prebuilt no encaja con tu base image. Confirma `node:20-bookworm-slim` en el Dockerfile.

**Subir un PDF tarda 10-15 min y el dyno se reinicia a mitad:**
- Heroku reinicia dynos cada 24h y al deploy. Si tienes un import en proceso, se pierde el progreso. Soluciones:
  - Lanzar imports en horarios sin deploys.
  - Procesar rangos cortos de páginas (`maxPages = 10`) y repetir.
  - Para futuro: mover el worker a una cola separada (Inngest, BullMQ).

**Las imágenes y PDFs subidos se borran al hacer deploy:**
- Significa que el storage S3 no está activo. Revisa que `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` estén bien con `heroku config`. Sin ellas, Payload escribe en el filesystem del dyno (efímero).

---

## Coste detallado

- Dyno `Basic` 1× — gratis con créditos de tu cuenta o $7/mes
- Postgres `essential-0` — $5/mes (10 GB, 20 conexiones, ya suficiente)
- R2 — $0/mes hasta 10 GB de almacenamiento + 10M operaciones/mes
- OpenAI y Gemini — pagas según uso (gpt-4o-mini ~$0.01/página, Nano Banana ~$0.04/simulación)

**Total fijo: ~$5-12/mes** según el dyno. Por encima de eso solo lo que gastes
en IA.
