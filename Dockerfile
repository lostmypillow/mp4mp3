FROM --platform=linux/amd64 node:24-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci --no-audit --no-fund

COPY backend/ ./backend/

ENV NODE_PATH=/app

RUN npm run build --workspace=backend
RUN npm prune --omit=dev


FROM --platform=linux/amd64 node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

USER node

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package.json ./package.json

EXPOSE 3000

CMD ["node", "dist/index.js"]
