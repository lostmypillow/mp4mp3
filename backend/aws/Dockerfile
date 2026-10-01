# Dockerfile
FROM --platform=linux/amd64 node:24-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Run esbuild inside the target x86_64 architecture
RUN npm run build

# Verification stage to inspect the generated dist folder
FROM scratch AS artifacts
COPY --from=builder /app/dist /
