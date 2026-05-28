# syntax=docker/dockerfile:1.6
#
# Production Dockerfile for Guesty World Cup 2026 backend.
# Designed to run on Google Cloud Run.
#
# Build:  docker build -t worldcup-backend -f backend/Dockerfile backend
# Local:  docker run -p 8080:8080 --env-file backend/.env worldcup-backend
#
# In Cloud Run, credentials come from the attached service account
# (Application Default Credentials) — do NOT bake a JSON key into the image.

# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Production deps only (no tsc, no tsx)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Cloud Run injects PORT; we listen on 0.0.0.0 inside server.ts
EXPOSE 8080

# Drop root for runtime
USER node

CMD ["node", "dist/server.js"]
