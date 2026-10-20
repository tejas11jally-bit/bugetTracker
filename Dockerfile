# Multi-arch: builds natively on amd64 and arm64 (Apple Silicon, Raspberry Pi).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Prisma CLI with its own dependencies, used only to apply migrations at start-up.
# Keep the version in step with package.json.
FROM node:22-alpine AS prisma-cli
WORKDIR /cli
RUN npm init -y >/dev/null && npm install --omit=dev -E prisma@6.19.3

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/data \
    BACKUP_DIR=/app/backups \
    PRISMA_CLI=/app/prisma-cli/node_modules/prisma/build/index.js
RUN mkdir -p /app/data /app/backups && chown -R node:node /app
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
# Migrations run on every start (no-op when up to date).
COPY --from=prisma-cli --chown=node:node /cli/node_modules ./prisma-cli/node_modules
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/scripts ./scripts
USER node
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node server.js"]
