# Tilestudio Hub — panel de gestión multi-cliente.
# Necesita el CLI de docker + compose porque opera el stack del host a través
# del socket /var/run/docker.sock, y bash/openssl para add-client.sh.
FROM node:20-alpine

RUN apk add --no-cache docker-cli docker-cli-compose bash openssl curl

WORKDIR /hub
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]
