# ==========================================
# STAGE 1: Build & Bundle with esbuild
# ==========================================
FROM node:24-trixie AS builder
WORKDIR /app
ARG FRONTEND_BUILD_MODE=local-dev
# 1. Copy root and workspace package manifests
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
# Add this line if aws/ is a workspace or has a package.json:
COPY aws/package*.json ./aws/

# 2. Install dependencies
RUN npm ci

# 3. Copy ALL required source directories (ADDED aws/)
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY aws/ ./aws/

# 4. Build backend
RUN npm run build --workspace=backend

RUN npm run build --workspace=frontend -- --mode ${FRONTEND_BUILD_MODE}
# ==========================================
# STAGE 2: Distroless Production Runtime
# ==========================================
FROM gcr.io/distroless/nodejs24-debian13 AS runner

WORKDIR /app

ENV NODE_ENV=production

# Distroless images include a built-in non-root user named "nonroot" (UID 65532)
USER nonroot:nonroot

COPY --from=mwader/static-ffmpeg:7.1 /ffmpeg /usr/local/bin/ffmpeg

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package.json ./package.json

EXPOSE 3000

# Distroless Node image automatically invokes 'node' behind the scenes.
# The CMD argument directly passes your entry point script file to Node.
CMD ["--enable-source-maps", "dist/index.js"]
