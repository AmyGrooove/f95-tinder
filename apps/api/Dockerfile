FROM node:22-alpine AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json

RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages/contracts packages/contracts
COPY packages/config packages/config

RUN pnpm --filter @f95/contracts build
RUN pnpm --filter @f95/api build
RUN pnpm --filter @f95/api deploy --prod --legacy /production

FROM node:22-alpine AS production

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build --chown=node:node /production ./
COPY --from=build --chown=node:node /workspace/apps/api/dist ./dist
COPY --from=build --chown=node:node /workspace/apps/api/resources ./resources

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
