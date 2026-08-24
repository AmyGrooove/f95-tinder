FROM node:22-alpine AS api-build

WORKDIR /app/apps/api

RUN corepack enable

COPY apps/api/package.json apps/api/pnpm-lock.yaml apps/api/pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

COPY apps/api ./

RUN pnpm build
RUN pnpm prune --prod

FROM node:22-alpine AS api

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV APP_NAME=f95-tinder
ENV PORT=3000

COPY --from=api-build /app/apps/api/package.json ./package.json
COPY --chown=node:node --from=api-build /app/apps/api/node_modules ./node_modules
COPY --chown=node:node --from=api-build /app/apps/api/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]

FROM node:22-alpine AS web-build

WORKDIR /app/apps/web

RUN corepack enable

COPY apps/web/package.json apps/web/pnpm-lock.yaml ./
COPY apps/web/pnpm-workspace.yaml ./pnpm-workspace.yaml

RUN pnpm install --frozen-lockfile

COPY apps/web ./

RUN pnpm build

FROM node:22-alpine AS web

WORKDIR /app/apps/web

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --chown=node:node --from=web-build /app/apps/web/public ./public
COPY --chown=node:node --from=web-build /app/apps/web/.next/standalone ./
COPY --chown=node:node --from=web-build /app/apps/web/.next/static ./.next/static

USER node

EXPOSE 3000

CMD ["node", "server.js"]
