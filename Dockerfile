FROM node:24-alpine AS builder

ARG PRISMA_GENERATE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/velo

RUN apk add --no-cache libssl3

RUN corepack enable && corepack prepare pnpm@10.18.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm config set store-dir /root/.pnpm-store

RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile

COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN DATABASE_URL="$PRISMA_GENERATE_DATABASE_URL" pnpm prisma generate

COPY . .
RUN DATABASE_URL="$PRISMA_GENERATE_DATABASE_URL" pnpm build

RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm prune --prod --ignore-scripts

# For prisma runtime files
COPY ./tsconfig.json ./tsconfig.json

FROM node:24-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache libssl3

WORKDIR /app

COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=node:node /app/public ./public

USER node

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node ./dist/main.js"]