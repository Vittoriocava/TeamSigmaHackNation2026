# Multi-stage build for Next.js frontend
FROM node:20-slim AS deps
WORKDIR /app
# When building from repo root, these live under frontend/
COPY frontend/package.json frontend/package-lock.json* frontend/.npmrc* ./
RUN npm install --production=false

FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/. .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Set Next.js port (Railway/GCP typically inject PORT)
ENV PORT=8080
ENV HOST=0.0.0.0
# Prevent Next telemetry in container
ENV NEXT_TELEMETRY_DISABLED=1

# Copy built assets and runtime deps
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/package*.json ./

EXPOSE 8080

# Explicitly pass hostname/port to Next to avoid binding issues on platforms with custom PORT
CMD ["sh", "-c", "PORT=${PORT:-8080} npm run start -- --hostname 0.0.0.0 --port ${PORT:-8080}"]
