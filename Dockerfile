# syntax=docker/dockerfile:1.7
# ----------------------------------------------------------------------------
# Tilestudio — Dockerfile multi-stage para Fly.io
#
# Node 20 + Debian (glibc) → sharp 0.32 y @napi-rs/canvas usan prebuilts.
# Payload 3 + Next.js 15. La imagen final lleva el build y los node_modules
# necesarios para arrancar Next en producción + el código fuente porque
# Payload referencia componentes via importMap por ruta.
# ----------------------------------------------------------------------------

ARG NODE_VERSION=20

#############################################
# Stage 1: deps — instalación de dependencias
#############################################
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app

# Herramientas que algunos postinstalls (canvas, sharp) usan como fallback.
# Si los prebuilts hacen su trabajo, no se compila nada y este apt-get es barato.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund --prefer-offline

#############################################
# Stage 2: builder — build de Next.js
#############################################
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app
ENV NODE_ENV=production

# Build args para vars NEXT_PUBLIC_* (se embeben en el bundle de cliente)
ARG NEXT_PUBLIC_SERVER_URL=http://localhost:3000
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL

# Variables sin secretos para que payload.config sepa qué adapter usar en build
ARG DATABASE_URI=file:/tmp/build.db
ENV DATABASE_URI=$DATABASE_URI
ENV PAYLOAD_SECRET=build-time-only-secret

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build && \
    # Limpiamos el cache de Next que no se necesita en runtime
    rm -rf .next/cache

#############################################
# Stage 3: runner — imagen ligera de runtime
#############################################
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

# tini = PID 1 correcto (señales SIGTERM, evita zombies)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -u 1001 -m nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copiamos el build + node_modules + código + assets estáticos.
# El código fuente es necesario porque el importMap de Payload referencia
# componentes por ruta y Next dev/prod los resuelve via require.
COPY --from=builder --chown=nextjs:nextjs /app/.next ./.next
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nextjs /app/src ./src
COPY --from=builder --chown=nextjs:nextjs /app/package.json /app/next.config.mjs /app/tsconfig.json /app/postcss.config.mjs /app/tailwind.config.ts ./

# /app/media va a un volumen persistente de Fly. Lo creamos para que el primer
# arranque sin volume montado siga funcionando.
RUN mkdir -p /app/media && chown -R nextjs:nextjs /app/media

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npm", "run", "start"]
