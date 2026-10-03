FROM node:24-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app

COPY package*.json pnpm-*.yaml ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
RUN --mount=type=cache,id=corepack,target=/root/.cache/corepack \
    pnpm -F backend build


FROM node:24-slim AS runner
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

USER node

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package.json ./package.json

EXPOSE 3000

CMD ["node", "dist/index.js"]
