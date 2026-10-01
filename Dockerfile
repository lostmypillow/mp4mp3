FROM node:24-slim AS builder

WORKDIR /app
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

RUN npm ci

COPY backend/ ./backend/

ENV NODE_PATH=/app

RUN npm run build --workspace=backend
RUN npm prune --omit=dev


FROM node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

USER node

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package.json ./package.json

EXPOSE 3000

CMD ["node", "dist/index.js"]
