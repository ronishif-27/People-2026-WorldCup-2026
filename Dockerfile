# syntax=docker/dockerfile:1.6
#
# Production Dockerfile for the World Cup 2026 frontend (React + Vite).
# Designed to run on Google Cloud Run.
#
# Build:  docker build -t worldcup-frontend -f Dockerfile .
# Deploy: gcloud run deploy worldcup-frontend --source=.
#
# Two-stage build:
#   1. Node 20 Alpine builds the React app (`npm run build` -> dist/)
#   2. nginx:alpine serves dist/ with SPA fallback for React Router
#
# CRITICAL: this image expects VITE_API_URL to be baked in at BUILD time.
# Cloud Run env vars do not flow into client-side bundles. Pass it as a
# --build-arg, or use Cloud Build substitutions:
#   docker build --build-arg VITE_API_URL=https://api.worldcup.guesty.com -t ... .

# ─── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Stage 2: runtime (nginx) ────────────────────────────────────────────────
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cloud Run sets PORT to 8080; nginx listens on $PORT via the conf file.
ENV PORT=8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
