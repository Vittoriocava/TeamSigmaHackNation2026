# Multi-stage build for Next.js frontend
FROM node:20-slim AS deps
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
# npm ci è più sicuro per le build riproducibili
RUN npm ci

FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Railway inietta dinamicamente la variabile PORT, Next la rileva in automatico
ENV PORT=8080
# HOSTNAME è fondamentale per far esporre il server all'esterno del container
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Copia solo gli asset necessari per la modalità standalone
COPY --from=build /app/public ./public
# I file standalone vengono generati automaticamente grazie alla modifica al next.config.js
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 8080

# In standalone, avviamo direttamente il server Node.js ottimizzato, senza usare npm!
CMD ["node", "server.js"]