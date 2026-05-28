# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install ALL dependencies (including dev — needed for tsc + prisma)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and Prisma schema
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./

# Generate Prisma client (requires schema before build)
RUN npx prisma generate

# Compile TypeScript → dist/
RUN npm run build

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy compiled output and Prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy Prisma schema (needed for prisma migrate deploy at startup)
COPY prisma ./prisma

# Cloud Run provides PORT env var; default 8080
ENV PORT=8080
EXPOSE 8080

# Run migrations then start the server
# (migrate deploy is safe to run on every startup — it's a no-op if DB is current)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
