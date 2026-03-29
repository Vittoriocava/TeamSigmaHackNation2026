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
# Set Next.js port
ENV PORT=3000
ENV HOST=0.0.0.0
# Prevent Next telemetry in container
ENV NEXT_TELEMETRY_DISABLED=1

# Copy built assets and runtime deps
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/package*.json ./

EXPOSE 3000

CMD ["sh", "-c", "HOST=${HOST:-0.0.0.0} PORT=${PORT:-3000} npm run start"]
