# Build stage for frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app
COPY studio/package*.json ./studio/
RUN cd studio && npm ci
COPY studio/ ./studio/
RUN cd studio && npm run build

# Production stage
FROM node:20-alpine

RUN apk add --no-cache ffmpeg rubberband

WORKDIR /app

# Copy backend package files and install dependencies
COPY studio-api/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY studio-api/server.js ./
COPY studio-api/src/ ./src/

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/public ./public

# Create directories for persistent data
RUN mkdir -p projects data .tmp_chunks

# Environment
ENV NODE_ENV=production
ENV PORT=8080
ENV PUBLIC_PATH=/app/public

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/projects || exit 1

EXPOSE 8080

CMD ["node", "server.js"]
