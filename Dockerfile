# Stage 1: Build frontend
FROM node:20-alpine as frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend with Python
FROM python:3.11-slim
WORKDIR /app

# Install Node.js runtime (leggero per servire il frontend)
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Copy backend
COPY backend/ ./backend/

# Install Python dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy built frontend
COPY --from=frontend-build /app/frontend/.next /app/frontend/.next
COPY --from=frontend-build /app/frontend/public /app/frontend/public
COPY --from=frontend-build /app/frontend/package.json /app/frontend/package.json
COPY --from=frontend-build /app/frontend/next.config.* /app/frontend/

# Install frontend production dependencies
WORKDIR /app/frontend
RUN npm ci --production

WORKDIR /app

# Expose port (Railway di default usa questa)
EXPOSE 8000

# Start backend (FastAPI serve il frontend via staticfiles)
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
