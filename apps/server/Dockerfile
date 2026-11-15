# Build from monorepo root:
#   docker build -f apps/server/Dockerfile -t mailtrack-server .

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/dashboard/package.json ./apps/dashboard/
COPY apps/extension/package.json ./apps/extension/

RUN npm ci --ignore-scripts

COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

RUN npm run build --workspace=@mailtrack/shared \
  && npm run prisma:generate --workspace=@mailtrack/server \
  && npm run build --workspace=@mailtrack/server \
  && npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma

USER node
EXPOSE 4000

CMD ["node", "apps/server/dist/server.js"]
