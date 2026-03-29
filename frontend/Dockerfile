# 1. Fase di dipendenze
FROM node:20-slim AS deps
WORKDIR /app
# Prende i package dal frontend e li mette nella root di /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# 2. Fase di build
FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Copia tutto il contenuto della cartella frontend/ dentro /app/
COPY frontend/ ./
RUN npm run build

# 3. Fase di esecuzione (Runner)
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Copia solo gli asset necessari per la modalità standalone
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 8080

# In standalone, il server si avvia direttamente senza npm
CMD ["node", "server.js"]